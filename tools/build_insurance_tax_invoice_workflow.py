# สร้าง n8n workflow "Insurance Tax Invoice API" (webhook insurance-tax-invoice-api) + DDL
#   เมนู Vehicle Registration → วางบิล → "รับใบกำกับภาษี LOCKTON / COSMOS" (user 2026-11-20)
#   ที่มา: ใบกำกับค่าประกันของงานวางบิล LOCKTON / COSMOS ออกโดยบริษัทประกัน (เออร์โก ไทยวิวัฒน์ ฯลฯ) ซึ่งไม่รู้ล่วงหน้าว่าบริษัทไหน
#     → บันทึกรับใบกำกับ: บริษัทประกัน (พิมพ์เอง) + เลข/วันที่ใบกำกับ + ยอด แล้วผูกกับรายการงานรับเรื่อง (LOCKTON) หรือรอบส่งงาน (COSMOS)
#   LOCKTON: ใบที่บันทึกขึ้นรายงานภาษีซื้อเป็น source 'lockton' (Input_Tax_API — tools/add_insinv_input_tax_source.py)
#   COSMOS : ยอดภาษีซื้อยังคิดจากรอบส่งงานอัตโนมัติเหมือนเดิม ใบที่บันทึกใช้เติมเลขใบกำกับ/ชื่อบริษัทจริง "ไม่บวกยอดซ้ำ" (user เลือก 2026-11-20)
# โครง Webhook → Build SQL → PG → Shape → Respond (ลอกจาก Vehicle_Price_Override_API_Workflow.json) — ตอบแถวแรกแถวเดียว
# ⚠️ ไม่มี ALTER TABLE · ไม่มี $ ใน SQL (ข้อความที่ user พิมพ์ถูกตัด $ ออก)
# output: C:\Users\manat\OneDrive\New folder\Insurance_Tax_Invoice_Workflow.json + Insurance_Tax_Invoice_DDL.sql
import json, os, re, subprocess, tempfile
D = r"C:\Users\manat\OneDrive\New folder"
TEMPLATE = os.path.join(D, "Vehicle_Price_Override_API_Workflow.json")
OUT = os.path.join(D, "Insurance_Tax_Invoice_Workflow.json")

DDL_SQL = """CREATE TABLE IF NOT EXISTS insurance_tax_invoice_receipts (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL,                 -- LOCKTON | COSMOS (งานวางบิลที่ใบกำกับนี้มากับ)
  affiliation TEXT NOT NULL,             -- ป.เปา | สิงห์ชัย (บริษัทที่ใช้ใบกำกับยื่นภาษีซื้อ)
  vendor_name TEXT,                      -- บริษัทประกันผู้ออกใบกำกับ (พิมพ์เอง)
  vendor_tax_id TEXT,
  vendor_branch TEXT,
  tax_invoice_no TEXT NOT NULL,
  tax_invoice_date DATE NOT NULL,
  amount_before_vat NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,   -- รายการที่ใบนี้ครอบคลุม [{key, label, amount}] — LOCKTON: key = เลขใบรับเรื่อง · COSMOS: key = รหัสรอบ/เลข app ของแถวภาษีซื้ออัตโนมัติ
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);"""

BUILD = r"""// insurance-tax-invoice-api: บันทึกรับใบกำกับภาษีค่าประกัน งานวางบิล LOCKTON / COSMOS (user 2026-11-20)
// load {months?}        → {receiptsjson, locktonjson, cosmosjson} ใบที่บันทึกแล้ว + รายการ LOCKTON งานรับเรื่อง + รอบ COSMOS ย้อนหลัง (default 6 เดือน)
// save_receipt {id?, channel, affiliation, vendor_name, vendor_tax_id, vendor_branch, tax_invoice_no, tax_invoice_date, total_amount, amount_before_vat?, vat_amount?, items[], note, user}
//                       → {id} หรือ {error:'duplicate'} (เลขใบกำกับซ้ำในสังกัดเดียวกัน)
// delete_receipt {id}   → {deleted}
const b = $input.first().json.body || {};
const action = String(b.action || '').trim();
const clean = (s) => String(s == null ? '' : s).split(String.fromCharCode(36)).join('').replace(/\\/g, '');   // ตัดเครื่องหมายดอลลาร์/backslash (Postgres node ของ n8n ทำ SQL พัง)
const esc = (s) => clean(s).replace(/'/g, "''");
const txt = (v, n) => { const s = clean(v).trim().slice(0, n || 200); return s ? `'${s.replace(/'/g, "''")}'` : 'NULL'; };
const num = (v) => { const x = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(x) ? x : 0; };
const r2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
const DDL = `__DDL__`;
const T = 'insurance_tax_invoice_receipts';
// เบี้ย COSMOS: บางแผนไม่มีคอลัมน์ premium ต้องอ่านจากข้อความแผน *(1,879.99) — สูตรเดียวกับ Input_Tax_API
const cosPremium = "COALESCE(NULLIF(premium,0), NULLIF(regexp_replace(split_part(split_part(plan_name,'*(',2),')',1), '[^0-9.]', '', 'g'), '')::numeric, 0)";
const linked = (channel, keyExpr) => `(SELECT string_agg(i.tax_invoice_no, ', ' ORDER BY i.tax_invoice_date, i.id) FROM ${T} i WHERE i.channel = '${channel}' AND i.items @> jsonb_build_array(jsonb_build_object('key', ${keyExpr})))`;

if (action === 'load') {
  const months = Math.min(36, Math.max(1, parseInt(b.months, 10) || 6));
  const query = `${DDL}
WITH c AS (
  SELECT submitted_at, to_char(submitted_at, 'YYYYMM') AS ym, plan, app_no, customer_name, ${cosPremium} AS p
  FROM cosmos_submissions
  WHERE submitted_at IS NOT NULL AND submitted_at >= date_trunc('month', now()) - INTERVAL '${months} months'
),
cr AS (
  SELECT 'COSMOS-3PLUS-' || ym AS key, '3plus' AS plan, ym, COUNT(*)::int AS n, ROUND(SUM(p), 2)::float8 AS total, MAX(submitted_at)::date AS d, NULL::text AS customer_name
  FROM c WHERE plan = '3plus' GROUP BY ym HAVING SUM(p) > 0
  UNION ALL
  SELECT 'COSMOS-RSA-' || ym, 'rsa', ym, COUNT(*)::int, ROUND(SUM(p), 2)::float8, MAX(submitted_at)::date, NULL::text
  FROM c WHERE plan = 'rsa' GROUP BY ym HAVING SUM(p) > 0
  UNION ALL
  SELECT app_no, plan, ym, 1, ROUND(p, 2)::float8, submitted_at::date, customer_name
  FROM c WHERE plan IN ('theft', 'theft_renewal') AND p > 0 AND COALESCE(app_no, '') <> ''
),
lk AS (
  SELECT si.receipt_no, MAX(si.customer_name) AS customer_name, MAX(sb.submission_date) AS submission_date, MAX(sb.batch_code) AS batch_code,
         MAX(e.expense_name) AS expense_name, SUM(e.amount)::float8 AS amount, MAX(si.billing_doc_no) AS billing_doc_no, MAX(si.paid_at)::date AS paid_date
  FROM registration_submission_items si
  JOIN registration_submission_batches sb ON sb.id = si.batch_id
  JOIN service_expenses e ON e.status = 'active' AND e.group_by = 'income_type'
    /* ใบรับเรื่องจากระบบใช้ประเภท 'รายได้ประกัน' / 'รายได้ พรบ.' แต่กฎค่าใช้จ่าย (และใบ upload เดิม) ใช้ 'รายได้ประกันภัย/พรบ' → ถือว่าตรงกัน (กฎเดียวกับ Code Receipt Billing SQL ของ Registrations API — ไม่มีกฎนี้ ใบ ก.ย.69 เป็นต้นมาไม่ขึ้น) */
    AND (e.income_type IS NULL OR e.income_type = '' OR e.income_type = si.income_type
         OR (e.income_type = 'รายได้ประกันภัย/พรบ' AND si.income_type IN ('รายได้ประกัน', 'รายได้ พรบ.'))
         OR (si.income_type = 'รายได้ประกันภัย/พรบ' AND e.income_type IN ('รายได้ประกัน', 'รายได้ พรบ.')))
    AND (e.income_name IS NULL OR e.income_name = '' OR e.income_name = si.income_name)
    AND (e.income_amount IS NULL OR e.income_amount = si.net_price)
    AND (e.income_code IS NULL OR e.income_code = '' OR e.income_code = si.income_code)
  WHERE sb.status IN ('submitted', 'received', 'billed') AND (e.expense_name ILIKE '%LOCKTON%' OR e.expense_name ILIKE '%ล็อคตั้น%' OR e.expense_name ILIKE '%ล็อกตั้น%')
  GROUP BY si.receipt_no
)
SELECT
  (SELECT COALESCE(json_agg(row_to_json(q) ORDER BY q.tax_invoice_date DESC, q.id DESC), '[]'::json)::text FROM (
     SELECT id, channel, affiliation, vendor_name, vendor_tax_id, vendor_branch, tax_invoice_no, to_char(tax_invoice_date, 'YYYY-MM-DD') AS tax_invoice_date,
            amount_before_vat::float8 AS amount_before_vat, vat_amount::float8 AS vat_amount, total_amount::float8 AS total_amount, items, note, created_by,
            to_char(created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') AS created_at
     FROM ${T}) q) AS receiptsjson,
  (SELECT COALESCE(json_agg(row_to_json(q) ORDER BY q.submission_date DESC NULLS LAST, q.receipt_no), '[]'::json)::text FROM (
     SELECT lk.receipt_no AS key, lk.receipt_no, lk.customer_name, to_char(lk.submission_date, 'YYYY-MM-DD') AS submission_date, lk.batch_code, lk.expense_name, lk.amount, lk.billing_doc_no, to_char(lk.paid_date, 'YYYY-MM-DD') AS paid_date,
            CASE WHEN LEFT(lk.receipt_no, 5) IN ('SCY05', 'SCY06') THEN 'ป.เปา' ELSE 'สิงห์ชัย' END AS affiliation,
            ${linked('LOCKTON', 'lk.receipt_no')} AS invoice_nos
     FROM lk) q) AS locktonjson,
  (SELECT COALESCE(json_agg(row_to_json(q) ORDER BY q.ym DESC, q.plan, q.key), '[]'::json)::text FROM (
     SELECT cr.key, cr.plan, cr.ym, cr.n, cr.total AS amount, to_char(cr.d, 'YYYY-MM-DD') AS submitted_date, cr.customer_name, 'ป.เปา' AS affiliation,
            ${linked('COSMOS', 'cr.key')} AS invoice_nos
     FROM cr) q) AS cosmosjson;`;
  return [{ json: { query } }];
}

if (action === 'save_receipt') {
  const id = parseInt(b.id, 10) || 0;
  const channel = String(b.channel || '').toUpperCase().trim();
  const aff = clean(b.affiliation).trim();
  const no = clean(b.tax_invoice_no).trim().slice(0, 80);
  const d = String(b.tax_invoice_date || '').slice(0, 10);
  const total = num(b.total_amount);
  if (!['LOCKTON', 'COSMOS'].includes(channel)) return [{ json: { query: "SELECT 'bad channel' AS error" } }];
  if (!['ป.เปา', 'สิงห์ชัย'].includes(aff)) return [{ json: { query: "SELECT 'bad affiliation' AS error" } }];
  if (!no || !/^\d{4}-\d{2}-\d{2}/.test(d) || !(total > 0)) return [{ json: { query: "SELECT 'missing tax_invoice_no/tax_invoice_date/total_amount' AS error" } }];
  // ไม่ส่งมูลค่า/ภาษีมา = ถอด VAT 7% จากยอดรวม (870 → 813.08 + 56.92)
  let base = num(b.amount_before_vat), vat = num(b.vat_amount);
  if (!(base > 0) || Math.abs(base + vat - total) > 0.011) { base = Math.round(total / 1.07 * 100) / 100; vat = Math.round((total - base) * 100) / 100; }
  const items = (Array.isArray(b.items) ? b.items : []).filter((x) => x && clean(x.key).trim()).slice(0, 500)
    .map((x) => ({ key: clean(x.key).trim().slice(0, 80), label: clean(x.label).trim().slice(0, 160), amount: Math.round(num(x.amount) * 100) / 100 }));
  const itemsSql = `'${JSON.stringify(items).replace(/'/g, "''")}'::jsonb`;
  const noKey = no.toUpperCase().replace(/\s/g, '');
  const dup = `dup AS (SELECT id FROM ${T} WHERE affiliation = '${esc(aff)}' AND UPPER(REPLACE(tax_invoice_no, ' ', '')) = '${esc(noKey)}' AND id <> ${id} LIMIT 1)`;
  const vals = { channel: `'${channel}'`, affiliation: `'${esc(aff)}'`, vendor_name: txt(b.vendor_name), vendor_tax_id: txt(String(b.vendor_tax_id || '').replace(/\D/g, ''), 13), vendor_branch: txt(b.vendor_branch, 60),
    tax_invoice_no: `'${esc(no)}'`, tax_invoice_date: `'${d}'::date`, amount_before_vat: r2(base), vat_amount: r2(vat), total_amount: r2(total), items: itemsSql, note: txt(b.note, 300) };
  const cols = Object.keys(vals);
  const query = id
    ? `${DDL}
WITH ${dup},
w AS (UPDATE ${T} SET ${cols.map((c) => c + ' = ' + vals[c]).join(', ')}, updated_at = now() WHERE id = ${id} AND NOT EXISTS (SELECT 1 FROM dup) RETURNING id)
SELECT (SELECT id FROM w)::int AS id, CASE WHEN EXISTS (SELECT 1 FROM dup) THEN 'duplicate' WHEN NOT EXISTS (SELECT 1 FROM w) THEN 'not found' END AS error;`
    : `${DDL}
WITH ${dup},
w AS (INSERT INTO ${T} (${cols.join(', ')}, created_by) SELECT ${cols.map((c) => vals[c]).join(', ')}, ${txt(b.user, 100)} WHERE NOT EXISTS (SELECT 1 FROM dup) RETURNING id)
SELECT (SELECT id FROM w)::int AS id, CASE WHEN EXISTS (SELECT 1 FROM dup) THEN 'duplicate' END AS error;`;
  return [{ json: { query } }];
}

if (action === 'delete_receipt') {
  const id = parseInt(b.id, 10) || 0;
  if (!id) return [{ json: { query: "SELECT 'missing id' AS error" } }];
  return [{ json: { query: `${DDL}
WITH d AS (DELETE FROM ${T} WHERE id = ${id} RETURNING 1)
SELECT (SELECT COUNT(*) FROM d)::int AS deleted;` } }];
}

return [{ json: { query: `SELECT 'unknown action ${esc(action)}' AS error` } }];
""".replace("__DDL__", re.sub(r"--[^\n]*", "", DDL_SQL).replace("\n", " "))   # ตัด comment -- ออกก่อนยุบเป็นบรรทัดเดียว

assert "$" not in DDL_SQL and "ALTER" not in BUILD.upper().replace("ALTERNAT", "")
w = json.load(open(TEMPLATE, encoding="utf-8"))
w["name"] = "Insurance Tax Invoice API"
for k in ("id", "versionId", "pinData", "staticData", "tags"):
    w.pop(k, None)
w["meta"] = {"instanceId": ""}
for n in w["nodes"]:
    if n["type"] == "n8n-nodes-base.webhook":
        n["parameters"]["path"] = "insurance-tax-invoice-api"
        n["webhookId"] = "insurance-tax-invoice-api"
        n["parameters"]["options"] = {"allowedOrigins": "*"}
    if n["name"] == "Build SQL":
        n["parameters"]["jsCode"] = BUILD
    if n["type"] == "n8n-nodes-base.postgres":
        n["credentials"] = {}
        n["alwaysOutputData"] = True
        n["onError"] = "continueRegularOutput"
    n["id"] = "iti" + n["id"][3:] if len(n["id"]) > 3 else "iti_" + n["id"]
json.dump(w, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(os.path.join(D, "Insurance_Tax_Invoice_DDL.sql"), "w", encoding="utf-8").write(
    "-- ใบกำกับภาษีค่าประกันที่รับจากงานวางบิล LOCKTON / COSMOS (insurance-tax-invoice-api, เมนู วางบิล → รับใบกำกับภาษี LOCKTON / COSMOS)\n"
    "-- workflow รัน CREATE TABLE IF NOT EXISTS เองด้วย · LOCKTON ขึ้นรายงานภาษีซื้อ (source lockton) · COSMOS ใช้เติมเลขใบกำกับ/ชื่อบริษัทในแถวอัตโนมัติ\n" + DDL_SQL + "\n")

# ---- syntax check + จำลอง SQL ----
stub = "const $=(x)=>({first:()=>({json:{body:{}}}),all:()=>[]});const $input={first:()=>({json:{body:JSON.parse(process.argv[2]||'{}')}})};\n(async()=>{const r=await (async()=>{" + BUILD + "\n})(); console.log(r[0].json.query);})();"
f = os.path.join(tempfile.gettempdir(), "insinv_build.js"); open(f, "w", encoding="utf-8").write(stub)
r = subprocess.run(["node", "--check", f], capture_output=True, text=True, encoding="utf-8", errors="replace")
print("node --check:", "OK" if r.returncode == 0 else r.stderr)
os.makedirs(os.path.join(tempfile.gettempdir(), "insinv_sql"), exist_ok=True)
for i, body in enumerate([
    {"action": "load"}, {"action": "load", "months": 12},
    {"action": "save_receipt", "channel": "lockton", "affiliation": "สิงห์ชัย", "vendor_name": "บมจ. เออร์โกประกันภัย (ประเทศไทย)", "vendor_tax_id": "0107554000224", "tax_invoice_no": "A001-2610008636",
     "tax_invoice_date": "2026-10-20", "total_amount": 870, "items": [{"key": "SCY01-CA260600025", "label": "นางสาว พัชรา o'k $1", "amount": 870}], "note": "ทดสอบ $ \\ '", "user": "admin"},
    {"action": "save_receipt", "id": 5, "channel": "COSMOS", "affiliation": "ป.เปา", "vendor_name": "บมจ. ประกันภัยไทยวิวัฒน์", "tax_invoice_no": "169/3394", "tax_invoice_date": "2026-10-27",
     "total_amount": 191758.98, "amount_before_vat": 179214, "vat_amount": 12544.98, "items": [{"key": "COSMOS-3PLUS-202610", "label": "3 PLUS 102 กรมธรรม์", "amount": 191758.98}]},
    {"action": "save_receipt", "channel": "LOCKTON", "affiliation": "x", "tax_invoice_no": "1", "tax_invoice_date": "2026-10-20", "total_amount": 1},
    {"action": "save_receipt", "channel": "LOCKTON", "affiliation": "ป.เปา", "tax_invoice_no": "", "tax_invoice_date": "2026-10-20", "total_amount": 1},
    {"action": "delete_receipt", "id": 5}, {"action": "zzz"}]):
    r = subprocess.run(["node", f, json.dumps(body)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    q = r.stdout or r.stderr
    assert "$" not in q, "พบ $ ใน SQL: " + body["action"]
    bal = q.count("(") - q.count(")")
    open(os.path.join(tempfile.gettempdir(), "insinv_sql", f"{i}_{body['action']}.sql"), "w", encoding="utf-8").write(q)
    print("--", body["action"], "| len", len(q), "| parens", bal, "| ", re.sub(r"CREATE TABLE IF NOT EXISTS [^;]+;\s*", "", q).strip().replace("\n", " ")[:330])
print("written:", OUT)
