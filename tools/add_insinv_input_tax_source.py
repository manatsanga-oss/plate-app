# แพตช์ Input_Tax_API.json (node "Build Query", action list_input_tax) ให้ใช้ใบกำกับที่บันทึกรับจากเมนู
#   วางบิล → "รับใบกำกับภาษี LOCKTON / COSMOS" (ตาราง insurance_tax_invoice_receipts — tools/build_insurance_tax_invoice_workflow.py) user 2026-11-20
#   1) source ใหม่ 'lockton' = ใบกำกับ channel LOCKTON (เช่น เออร์โกประกันภัย ประกันรถหาย LOCKTON 2 ปี 870) งวดตามวันที่ใบกำกับ ย้ายงวดได้
#   2) แถว 'cosmos' อัตโนมัติ (3PLUS/RSA รายรอบ · ประกันรถหายรายกรมธรรม์): ยอดเท่าเดิม "ไม่บวกซ้ำ" แต่ถ้ามีใบกำกับ channel COSMOS ที่ผูก key ของแถวนั้น
#      → ผู้ขาย/เลขผู้เสียภาษีใช้ของใบจริง + เลขใบกำกับจริงขึ้นช่องอ้างอิง (doc_no คงเดิมเป็นรหัสรอบ/เลข app เพื่อไม่ให้ key ของแบบที่เตรียมไว้เปลี่ยน)
# ⚠️ ไม่มี ALTER TABLE · ไม่มี $ ใน SQL · สำรอง .bak-insinv · รันซ้ำได้ (ข้ามถ้าแพตช์แล้ว)
import json, os, shutil, subprocess, tempfile
D = r"C:\Users\manat\OneDrive\New folder"
F = os.path.join(D, "Input_Tax_API.json")

w = json.load(open(F, encoding="utf-8"))
node = next(n for n in w["nodes"] if n["name"] == "Build Query")
code = node["parameters"]["jsCode"]
if "insurance_tax_invoice_receipts" in code:
    print("แพตช์แล้ว — ข้าม")
    raise SystemExit(0)

def rep(old, new, count=1):
    global code
    assert code.count(old) == count, f"พบ {code.count(old)} ครั้ง (ต้อง {count}): {old[:70]}"
    code = code.replace(old, new)

DDL = ("CREATE TABLE IF NOT EXISTS insurance_tax_invoice_receipts (id BIGSERIAL PRIMARY KEY, channel TEXT NOT NULL, affiliation TEXT NOT NULL, vendor_name TEXT, vendor_tax_id TEXT, vendor_branch TEXT, "
       "tax_invoice_no TEXT NOT NULL, tax_invoice_date DATE NOT NULL, amount_before_vat NUMERIC(14,2) NOT NULL DEFAULT 0, vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0, total_amount NUMERIC(14,2) NOT NULL DEFAULT 0, "
       "items JSONB NOT NULL DEFAULT '[]'::jsonb, note TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());")

# 1) ตัวแปรกรองงวด + ตัวช่วยดึงใบกำกับ COSMOS ที่ผูกกับแถวอัตโนมัติ
rep('const manWhere = f ? ("to_char(m.doc_date, \'YYYYMM\') " + FEQ) : "TRUE";',
    'const manWhere = f ? ("to_char(m.doc_date, \'YYYYMM\') " + FEQ) : "TRUE";\n'
    '// ใบกำกับค่าประกันงานวางบิล LOCKTON / COSMOS ที่บันทึกรับ (เมนู วางบิล → รับใบกำกับภาษี LOCKTON / COSMOS — insurance_tax_invoice_receipts, user 2026-11-20)\n'
    '//   LOCKTON = source ใหม่ (งวดตามวันที่ใบกำกับ ย้ายงวดได้) · COSMOS = ยอดคิดจากรอบส่งงานเหมือนเดิม ใบที่ผูก key ของแถวใช้เติมผู้ขาย/เลขใบกำกับจริง (ไม่บวกยอดซ้ำ)\n'
    'const lkWhere = f ? ("to_char(i.tax_invoice_date, \'YYYYMM\') " + FEQ) : "TRUE";\n'
    'const cosInv = (k) => "LEFT JOIN LATERAL (SELECT string_agg(i.tax_invoice_no, \', \' ORDER BY i.tax_invoice_date, i.id) AS nos, MAX(i.vendor_name) AS vn, MAX(i.vendor_tax_id) AS vt, MAX(i.vendor_branch) AS vb '
    'FROM insurance_tax_invoice_receipts i WHERE i.channel = \'COSMOS\' AND i.items @> jsonb_build_array(jsonb_build_object(\'key\', " + k + "))) ci ON TRUE";')

# 2) DDL กันหน้าพังถ้ายังไม่มีตาราง
rep("\nWITH fuel_pay AS (", "\n" + DDL + "\nWITH fuel_pay AS (")

# 3) COSMOS 3PLUS / RSA (รายรอบ) + ประกันรถหาย (รายกรมธรรม์) — ห่อ subquery แล้ว LATERAL หาใบกำกับที่ผูก
rep("""  SELECT 'cosmos', NULL, 'ป.เปา', MAX(c.submitted_at)::date, 'COSMOS-3PLUS-' || c.ym, COUNT(*)::text || ' กรมธรรม์',
    'บมจ. ประกันภัยไทยวิวัฒน์', '0107536001427', NULL, 'ประกัน 3 PLUS (COSMOS)',
    ROUND(SUM(c.p) / 1.07, 2)::float8, ROUND(SUM(c.p) - SUM(c.p) / 1.07, 2)::float8, ROUND(SUM(c.p), 2)::float8
  FROM (SELECT submitted_at, to_char(submitted_at, 'YYYYMM') AS ym, ${cosPremium} AS p FROM cosmos_submissions WHERE plan = '3plus' AND ${cosWhere}) c
  GROUP BY c.ym HAVING SUM(c.p) > 0""",
    """  SELECT 'cosmos', NULL, 'ป.เปา', g.d, g.k, CASE WHEN ci.nos IS NULL THEN g.r ELSE 'ใบกำกับ ' || ci.nos || ' · ' || g.r END,
    COALESCE(ci.vn, 'บมจ. ประกันภัยไทยวิวัฒน์'), CASE WHEN ci.nos IS NULL THEN '0107536001427' ELSE ci.vt END, ci.vb, 'ประกัน 3 PLUS (COSMOS)',
    g.b, g.v, g.t
  FROM (SELECT MAX(c.submitted_at)::date AS d, 'COSMOS-3PLUS-' || c.ym AS k, COUNT(*)::text || ' กรมธรรม์' AS r,
          ROUND(SUM(c.p) / 1.07, 2)::float8 AS b, ROUND(SUM(c.p) - SUM(c.p) / 1.07, 2)::float8 AS v, ROUND(SUM(c.p), 2)::float8 AS t
        FROM (SELECT submitted_at, to_char(submitted_at, 'YYYYMM') AS ym, ${cosPremium} AS p FROM cosmos_submissions WHERE plan = '3plus' AND ${cosWhere}) c
        GROUP BY c.ym HAVING SUM(c.p) > 0) g
  ${cosInv('g.k')}""")
rep("""  SELECT 'cosmos', NULL, 'ป.เปา', MAX(c.submitted_at)::date, 'COSMOS-RSA-' || c.ym, COUNT(*)::text || ' รายการ',
    'บจก. สยามคอสมอสเซอร์วิส', '0105532100445', NULL, 'ค่าบริการ RSA (COSMOS)',
    ROUND(SUM(c.p) / 1.07, 2)::float8, ROUND(SUM(c.p) - SUM(c.p) / 1.07, 2)::float8, ROUND(SUM(c.p), 2)::float8
  FROM (SELECT submitted_at, to_char(submitted_at, 'YYYYMM') AS ym, ${cosPremium} AS p FROM cosmos_submissions WHERE plan = 'rsa' AND ${cosWhere}) c
  GROUP BY c.ym HAVING SUM(c.p) > 0""",
    """  SELECT 'cosmos', NULL, 'ป.เปา', g.d, g.k, CASE WHEN ci.nos IS NULL THEN g.r ELSE 'ใบกำกับ ' || ci.nos || ' · ' || g.r END,
    COALESCE(ci.vn, 'บจก. สยามคอสมอสเซอร์วิส'), CASE WHEN ci.nos IS NULL THEN '0105532100445' ELSE ci.vt END, ci.vb, 'ค่าบริการ RSA (COSMOS)',
    g.b, g.v, g.t
  FROM (SELECT MAX(c.submitted_at)::date AS d, 'COSMOS-RSA-' || c.ym AS k, COUNT(*)::text || ' รายการ' AS r,
          ROUND(SUM(c.p) / 1.07, 2)::float8 AS b, ROUND(SUM(c.p) - SUM(c.p) / 1.07, 2)::float8 AS v, ROUND(SUM(c.p), 2)::float8 AS t
        FROM (SELECT submitted_at, to_char(submitted_at, 'YYYYMM') AS ym, ${cosPremium} AS p FROM cosmos_submissions WHERE plan = 'rsa' AND ${cosWhere}) c
        GROUP BY c.ym HAVING SUM(c.p) > 0) g
  ${cosInv('g.k')}""")
rep("""  SELECT 'cosmos', NULL, 'ป.เปา', c.submitted_at::date, c.app_no, c.customer_name,
    'บจก. สยามคอสมอสเซอร์วิส', '0105532100445', NULL, 'ประกันรถหาย ' || CASE WHEN c.plan = 'theft_renewal' THEN 'ปีต่อ' ELSE 'ปีแรก' END || ' (COSMOS)',
    ROUND(c.p / 1.07, 2)::float8, ROUND(c.p - c.p / 1.07, 2)::float8, ROUND(c.p, 2)::float8
  FROM (SELECT submitted_at, app_no, customer_name, plan, ${cosPremium} AS p FROM cosmos_submissions WHERE plan IN ('theft','theft_renewal') AND ${cosWhere}) c
  WHERE c.p > 0""",
    """  SELECT 'cosmos', NULL, 'ป.เปา', c.submitted_at::date, c.app_no, CASE WHEN ci.nos IS NULL THEN c.customer_name ELSE 'ใบกำกับ ' || ci.nos || ' · ' || COALESCE(c.customer_name, '') END,
    COALESCE(ci.vn, 'บจก. สยามคอสมอสเซอร์วิส'), CASE WHEN ci.nos IS NULL THEN '0105532100445' ELSE ci.vt END, ci.vb, 'ประกันรถหาย ' || CASE WHEN c.plan = 'theft_renewal' THEN 'ปีต่อ' ELSE 'ปีแรก' END || ' (COSMOS)',
    ROUND(c.p / 1.07, 2)::float8, ROUND(c.p - c.p / 1.07, 2)::float8, ROUND(c.p, 2)::float8
  FROM (SELECT submitted_at, app_no, customer_name, plan, ${cosPremium} AS p FROM cosmos_submissions WHERE plan IN ('theft','theft_renewal') AND ${cosWhere}) c
  ${cosInv('c.app_no')}
  WHERE c.p > 0""")

# 4) source ใหม่ lockton (ก่อน manual)
rep("""  UNION ALL
  SELECT 'manual', NULL, m.affiliation, m.doc_date, m.doc_no, m.ref_no,""",
    """  UNION ALL
  SELECT 'lockton', NULL, i.affiliation, i.tax_invoice_date, i.tax_invoice_no,
    NULLIF((SELECT string_agg(e->>'key', ', ') FROM jsonb_array_elements(i.items) e), ''),
    i.vendor_name, i.vendor_tax_id, i.vendor_branch, 'ประกัน LOCKTON (งานรับเรื่อง)' || COALESCE(' · ' || NULLIF(i.note, ''), ''),
    COALESCE(i.amount_before_vat,0)::float8, COALESCE(i.vat_amount,0)::float8, COALESCE(i.total_amount,0)::float8
  FROM insurance_tax_invoice_receipts i
  WHERE i.channel = 'LOCKTON' AND ${lkWhere}
  UNION ALL
  SELECT 'manual', NULL, m.affiliation, m.doc_date, m.doc_no, m.ref_no,""")

assert code.upper().count("ALTER TABLE") == node["parameters"]["jsCode"].upper().count("ALTER TABLE")   # แพตช์นี้ไม่เพิ่ม ALTER TABLE (ที่มีอยู่คือคำในคอมเมนต์เดิม)
# ---- ตรวจ syntax + จำลอง SQL ก่อนเขียนไฟล์ ----
stub = ("const $=(x)=>({first:()=>({json:{body:{}}}),all:()=>[]});const $input={first:()=>({json:{body:JSON.parse(process.argv[2]||'{}')}})};"
        "const $json=$input.first().json;\n(async()=>{const r=await (async()=>{" + code + "\n})(); console.log(r[0].json.query);})();")
tf = os.path.join(tempfile.gettempdir(), "intax_build_insinv.js"); open(tf, "w", encoding="utf-8").write(stub)
r = subprocess.run(["node", "--check", tf], capture_output=True, text=True, encoding="utf-8", errors="replace")
assert r.returncode == 0, r.stderr
for body in ({"action": "list_input_tax", "year_month": "202610"}, {"action": "list_input_tax"}):
    r = subprocess.run(["node", tf, json.dumps(body)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    q = r.stdout
    assert r.returncode == 0 and q.strip(), r.stderr[:600]
    assert "$" not in q, "พบ $ ใน SQL"
    assert q.count("(") == q.count(")"), "วงเล็บไม่สมดุล"
    open(os.path.join(tempfile.gettempdir(), "intax_insinv_%s.sql" % (body.get("year_month") or "all")), "w", encoding="utf-8").write(q)
    print("จำลอง", body, "| len", len(q), "| lockton", q.count("'lockton'"), "| LATERAL ci", q.count(") ci ON TRUE"))

shutil.copyfile(F, F + ".bak-insinv")
node["parameters"]["jsCode"] = code
json.dump(w, open(F, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("เขียนแล้ว:", F, "(สำรอง .bak-insinv)")
