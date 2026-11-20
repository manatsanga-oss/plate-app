# แพตช์ Flow_Input_Tax_Report_Workflow.json (node "Build SQL", action list_lockton_expenses — ตัวเลือกจับคู่ LOCKTON ในหน้ารายงานภาษีซื้อ FlowAccount)
#   บั๊ก (user 2026-11-20): ใบรับเรื่องจากระบบ (‑CA69… ก.ย.69 เป็นต้นมา) ใช้ income_type 'รายได้ประกัน' / 'รายได้ พรบ.' แต่กฎ service_expenses ใช้ 'รายได้ประกันภัย/พรบ'
#     → join ไม่ติด รายการ LOCKTON ก.ย./ต.ค.69 ไม่ขึ้น (กฎ alias เดียวกับ Code Receipt Billing SQL ของ Registrations API และ insurance-tax-invoice-api)
#   เพิ่ม: ตัดใบรับเรื่องที่ผูกกับใบกำกับที่บันทึกรับแล้ว (เมนู วางบิล → รับใบกำกับภาษี LOCKTON / COSMOS) ออก — ใบนั้นอยู่ใน list_input_tax (source lockton) แล้ว ไม่ต้องเป็นตัวเลือกซ้ำ
# ⚠️ ไม่มี ALTER TABLE · ไม่มี $ ใน SQL · สำรอง .bak-lktalias · รันซ้ำได้
import json, os, shutil, subprocess, tempfile
D = r"C:\Users\manat\OneDrive\New folder"
F = os.path.join(D, "Flow_Input_Tax_Report_Workflow.json")

w = json.load(open(F, encoding="utf-8"))
node = next(n for n in w["nodes"] if n["name"] == "Build SQL")
code = node["parameters"]["jsCode"]
if "insurance_tax_invoice_receipts" in code:
    print("แพตช์แล้ว — ข้าม"); raise SystemExit(0)

def rep(old, new):
    global code
    assert code.count(old) == 1, f"พบ {code.count(old)} ครั้ง: {old[:70]}"
    code = code.replace(old, new)

DDL = ("CREATE TABLE IF NOT EXISTS insurance_tax_invoice_receipts (id BIGSERIAL PRIMARY KEY, channel TEXT NOT NULL, affiliation TEXT NOT NULL, vendor_name TEXT, vendor_tax_id TEXT, vendor_branch TEXT, "
       "tax_invoice_no TEXT NOT NULL, tax_invoice_date DATE NOT NULL, amount_before_vat NUMERIC(14,2) NOT NULL DEFAULT 0, vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0, total_amount NUMERIC(14,2) NOT NULL DEFAULT 0, "
       "items JSONB NOT NULL DEFAULT '[]'::jsonb, note TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()); ")

rep("""  let w = "sb.status IN ('submitted','received','billed') AND (e.expense_name ILIKE '%LOCKTON%' OR e.expense_name ILIKE '%ล็อคตั้น%')";""",
    """  let w = "sb.status IN ('submitted','received','billed') AND (e.expense_name ILIKE '%LOCKTON%' OR e.expense_name ILIKE '%ล็อคตั้น%' OR e.expense_name ILIKE '%ล็อกตั้น%')"
    // ใบรับเรื่องที่ผูกกับใบกำกับที่บันทึกรับแล้ว (เมนู วางบิล → รับใบกำกับภาษี LOCKTON / COSMOS) อยู่ใน list_input_tax แล้ว → ไม่ต้องเป็นตัวเลือกจับคู่ซ้ำ
    + " AND NOT EXISTS (SELECT 1 FROM insurance_tax_invoice_receipts ir WHERE ir.channel = 'LOCKTON' AND ir.items @> jsonb_build_array(jsonb_build_object('key', si.receipt_no)))";""")
rep("""  const q = "SELECT si.receipt_no, si.customer_name, sb.submission_date AS doc_date, sb.batch_code, e.expense_name, e.amount AS amount_incl_vat\"""",
    """  const q = \"""" + DDL + """SELECT si.receipt_no, si.customer_name, sb.submission_date AS doc_date, sb.batch_code, e.expense_name, e.amount AS amount_incl_vat\"""")
rep("""    + " AND (e.income_type IS NULL OR e.income_type='' OR e.income_type=si.income_type)"
    + " AND (e.income_name IS NULL OR e.income_name='' OR e.income_name=si.income_name)"
    + " AND (e.income_amount IS NULL OR e.income_amount=si.net_price)"
    + " AND (e.income_code IS NULL OR e.income_code='' OR e.income_code=si.income_code)"
    + " WHERE "+w+" ORDER BY sb.submission_date DESC NULLS LAST, si.receipt_no;";""",
    """    // ใบรับเรื่องจากระบบใช้ประเภท 'รายได้ประกัน' / 'รายได้ พรบ.' แต่กฎค่าใช้จ่าย (และใบ upload เดิม) ใช้ 'รายได้ประกันภัย/พรบ' → ถือว่าตรงกัน (ไม่มีกฎนี้ รายการ ก.ย.69 เป็นต้นมาไม่ขึ้น — user 2026-11-20)
    + " AND (e.income_type IS NULL OR e.income_type='' OR e.income_type=si.income_type"
    + " OR (e.income_type='รายได้ประกันภัย/พรบ' AND si.income_type IN ('รายได้ประกัน','รายได้ พรบ.'))"
    + " OR (si.income_type='รายได้ประกันภัย/พรบ' AND e.income_type IN ('รายได้ประกัน','รายได้ พรบ.')))"
    + " AND (e.income_name IS NULL OR e.income_name='' OR e.income_name=si.income_name)"
    + " AND (e.income_amount IS NULL OR e.income_amount=si.net_price)"
    + " AND (e.income_code IS NULL OR e.income_code='' OR e.income_code=si.income_code)"
    + " WHERE "+w+" ORDER BY sb.submission_date DESC NULLS LAST, si.receipt_no;";""")

assert code.upper().count("ALTER TABLE") == node["parameters"]["jsCode"].upper().count("ALTER TABLE")
stub = ("const $=(x)=>({first:()=>({json:{body:{}}}),all:()=>[]});const $input={first:()=>({json:{body:JSON.parse(process.argv[2]||'{}')}})};const $json=$input.first().json;\n"
        "(async()=>{const r=await (async()=>{" + code + "\n})(); console.log(r[0].json.query);})();")
tf = os.path.join(tempfile.gettempdir(), "flowtax_build_lkt.js"); open(tf, "w", encoding="utf-8").write(stub)
r = subprocess.run(["node", "--check", tf], capture_output=True, text=True, encoding="utf-8", errors="replace")
assert r.returncode == 0, r.stderr
for body in ({"action": "list_lockton_expenses", "affiliation": "สิงห์ชัย", "tax_period": "2026-10"}, {"action": "list_lockton_expenses"},
             {"action": "list_tax_doc_moves", "affiliation": "IN:สิงห์ชัย"}, {"action": "list_periods"}):
    r = subprocess.run(["node", tf, json.dumps(body)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    q = r.stdout
    assert r.returncode == 0 and q.strip(), (body, r.stderr[:500])
    assert "$" not in q and q.count("(") == q.count(")"), body
    print("จำลอง", body["action"], body.get("tax_period", ""), "| len", len(q), "|", q.strip().replace("\n", " ")[-330:] if body["action"] == "list_lockton_expenses" else "ok")

shutil.copyfile(F, F + ".bak-lktalias")
node["parameters"]["jsCode"] = code
json.dump(w, open(F, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("เขียนแล้ว:", F, "(สำรอง .bak-lktalias)")
