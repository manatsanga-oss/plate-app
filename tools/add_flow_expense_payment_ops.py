# -*- coding: utf-8 -*-
"""
เพิ่มระบบสถานะ + จ่ายเงิน ให้ flow_expense_documents (mirror ของ expense_record)
- self-migrate คอลัมน์: status, paid_doc_no, paid_at, payment_method, from_bank_account_id, pay_note
- ตาราง flow_expense_payment_breakdowns (multi-method)
- actions: flow_save_payment / flow_edit_payment / flow_cancel_payment / flow_cancel / flow_delete
- list_expenses ส่งคอลัมน์ status + payment กลับด้วย
- เลขใบจ่าย FPAY-YYMMDD-NNN (parallel ของ EPAY ฝั่ง expense_documents)
แก้ node 'Build Expense SQL' ในไฟล์ source-of-truth (ตาม CLAUDE.md)
"""
import json, io, sys

PATH = r"C:\Users\manat\OneDrive\New folder\Upload_Accounting_Expense_Workflow.json"

# ===== block 1: MIG + helper (แทรกหลังบรรทัด KEEP) =====
MIG_BLOCK = (
    "\n"
    "// ---- migrate: คอลัมน์สถานะ/การจ่ายเงิน (self) + helper ----\n"
    "const MIG = \"ALTER TABLE flow_expense_documents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';\\n\"\n"
    "  + \"ALTER TABLE flow_expense_documents ADD COLUMN IF NOT EXISTS paid_doc_no TEXT;\\n\"\n"
    "  + \"ALTER TABLE flow_expense_documents ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;\\n\"\n"
    "  + \"ALTER TABLE flow_expense_documents ADD COLUMN IF NOT EXISTS payment_method TEXT;\\n\"\n"
    "  + \"ALTER TABLE flow_expense_documents ADD COLUMN IF NOT EXISTS from_bank_account_id INTEGER;\\n\"\n"
    "  + \"ALTER TABLE flow_expense_documents ADD COLUMN IF NOT EXISTS pay_note TEXT;\\n\"\n"
    "  + \"CREATE TABLE IF NOT EXISTS flow_expense_payment_breakdowns (pb_id BIGSERIAL PRIMARY KEY, paid_doc_no TEXT, method TEXT, amount NUMERIC(14,2), from_bank_account_id INTEGER, seq INTEGER);\\n\";\n"
    "function payDateExpr(v){ return (v && /^\\d{4}-\\d{2}-\\d{2}/.test(String(v))) ? \"'\"+String(v).slice(0,10)+\"'::date\" : \"CURRENT_DATE\"; }\n"
    "function payTsExpr(v){ return (v && /^\\d{4}-\\d{2}-\\d{2}/.test(String(v))) ? \"'\"+String(v).slice(0,10)+\" 00:00:00+07:00'::timestamptz\" : \"NOW()\"; }\n"
    "function pbValues(payments){ return payments.map((p,i)=>{ const ba=(p.method==='โอน' && Number(p.from_bank_account_id))?Number(p.from_bank_account_id):'NULL'; return \"(\"+esc(p.method)+\"::text, \"+num(p.amount)+\"::numeric, \"+ba+\"::integer, \"+(i+1)+\"::integer)\"; }).join(\", \"); }\n"
)
MIG_ANCHOR = "const KEEP = \"(expense_type IS NULL OR (expense_type NOT LIKE ALL (\"+codeArr+\") AND expense_type <> ALL (\"+nameArr+\")))\";\n"

# ===== block 2: list_expenses query (เปลี่ยนให้ prepend MIG + ส่ง status/payment) =====
LIST_OLD = ("const q=\"SELECT id, doc_no AS expense_doc_no, affiliation, doc_date, vendor_name, vendor_tax_id, "
            "reference_no, expense_type, description, subtotal, vat_pct, vat_amount, total FROM flow_expense_documents \"+w+\" "
            "ORDER BY doc_date DESC NULLS LAST, id DESC;\";")
LIST_NEW = ("const q=MIG+\"SELECT id, doc_no AS expense_doc_no, affiliation, doc_date, vendor_name, vendor_tax_id, "
            "reference_no, expense_type, description, subtotal, vat_pct, vat_amount, total, total AS net_to_pay, "
            "COALESCE(status,'draft') AS status, paid_doc_no, paid_at, payment_method, from_bank_account_id, pay_note "
            "FROM flow_expense_documents \"+w+\" ORDER BY doc_date DESC NULLS LAST, id DESC;\";")

# ===== block 3: payment-op branches (แทรกก่อน upload path) =====
PAY_BRANCHES = (
    "// ---- PAYMENT OPS (mirror expense_record) ----\n"
    "if((b.action||'')==='flow_save_payment'){\n"
    "  const ids=(Array.isArray(b.expense_ids)?b.expense_ids:[]).map(Number).filter(Number.isFinite);\n"
    "  if(!ids.length) return [{ json: { query: \"SELECT NULL AS paid_doc_no, 0 AS updated_count;\" } }];\n"
    "  const payments=Array.isArray(b.payments)?b.payments:[];\n"
    "  const single = payments.length===1 ? payments[0] : null;\n"
    "  const method = single ? single.method : 'ผสม';\n"
    "  const fromBank = (single && single.method==='โอน' && Number(single.from_bank_account_id)) ? Number(single.from_bank_account_id) : 'NULL';\n"
    "  const pd=payDateExpr(b.paid_date), pt=payTsExpr(b.paid_date);\n"
    "  let q=MIG;\n"
    "  q+=\"WITH prefix AS (SELECT ('FPAY-'||TO_CHAR(\"+pd+\",'YYMMDD')) AS p), \";\n"
    "  q+=\"next_seq AS (SELECT COALESCE(MAX(CAST(SPLIT_PART(paid_doc_no,'-',3) AS INT)),0)+1 AS n FROM flow_expense_documents, prefix WHERE paid_doc_no LIKE (prefix.p||'-%')), \";\n"
    "  q+=\"gen AS (SELECT (prefix.p||'-'||LPAD(n::text,3,'0')) AS pay_no FROM next_seq, prefix), \";\n"
    "  q+=\"upd AS (UPDATE flow_expense_documents SET status='paid', paid_at=\"+pt+\", paid_doc_no=(SELECT pay_no FROM gen), payment_method=\"+esc(method)+\", from_bank_account_id=\"+fromBank+\", pay_note=\"+esc(b.payment_note)+\", updated_at=NOW() WHERE id IN (\"+ids.join(',')+\") AND COALESCE(status,'draft')='draft' RETURNING id)\";\n"
    "  if(payments.length){ q+=\", ins_pb AS (INSERT INTO flow_expense_payment_breakdowns (paid_doc_no, method, amount, from_bank_account_id, seq) SELECT (SELECT pay_no FROM gen), v.method, v.amount, v.from_bank_account_id, v.seq FROM (VALUES \"+pbValues(payments)+\") AS v(method, amount, from_bank_account_id, seq) WHERE EXISTS (SELECT 1 FROM upd) RETURNING pb_id)\"; }\n"
    "  q+=\" SELECT (SELECT pay_no FROM gen) AS paid_doc_no, (SELECT COUNT(*) FROM upd) AS updated_count;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n"
    "if((b.action||'')==='flow_edit_payment'){\n"
    "  const docNo=esc(b.paid_doc_no);\n"
    "  const payments=Array.isArray(b.payments)?b.payments:[];\n"
    "  const single = payments.length===1 ? payments[0] : null;\n"
    "  const method = single ? single.method : 'ผสม';\n"
    "  const fromBank = (single && single.method==='โอน' && Number(single.from_bank_account_id)) ? Number(single.from_bank_account_id) : 'NULL';\n"
    "  const pt=payTsExpr(b.paid_date);\n"
    "  let q=MIG;\n"
    "  q+=\"WITH upd AS (UPDATE flow_expense_documents SET paid_at=\"+pt+\", payment_method=\"+esc(method)+\", from_bank_account_id=\"+fromBank+\", pay_note=\"+esc(b.payment_note)+\", updated_at=NOW() WHERE paid_doc_no=\"+docNo+\" RETURNING paid_doc_no), \";\n"
    "  q+=\"del_pb AS (DELETE FROM flow_expense_payment_breakdowns WHERE paid_doc_no=\"+docNo+\" RETURNING pb_id)\";\n"
    "  if(payments.length){ q+=\", ins_pb AS (INSERT INTO flow_expense_payment_breakdowns (paid_doc_no, method, amount, from_bank_account_id, seq) SELECT \"+docNo+\", v.method, v.amount, v.from_bank_account_id, v.seq FROM (VALUES \"+pbValues(payments)+\") AS v(method, amount, from_bank_account_id, seq) WHERE EXISTS (SELECT 1 FROM upd) RETURNING pb_id)\"; }\n"
    "  q+=\" SELECT MAX(paid_doc_no) AS paid_doc_no, (SELECT COUNT(*) FROM upd)::int AS updated_count FROM upd;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n"
    "if((b.action||'')==='flow_cancel_payment'){\n"
    "  const docNo=esc(b.paid_doc_no);\n"
    "  let q=MIG;\n"
    "  q+=\"WITH cancel_pay AS (UPDATE flow_expense_documents SET status='draft', paid_at=NULL, paid_doc_no=NULL, payment_method=NULL, from_bank_account_id=NULL, pay_note=NULL, updated_at=NOW() WHERE paid_doc_no=\"+docNo+\" RETURNING id), \";\n"
    "  q+=\"cancel_pb AS (DELETE FROM flow_expense_payment_breakdowns WHERE paid_doc_no=\"+docNo+\" RETURNING pb_id) \";\n"
    "  q+=\"SELECT (SELECT COUNT(*) FROM cancel_pay) AS cancelled_expenses, (SELECT COUNT(*) FROM cancel_pb) AS deleted_breakdowns;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n"
    "if((b.action||'')==='flow_cancel'){\n"
    "  const id=Number(b.id);\n"
    "  if(!Number.isFinite(id)) return [{ json: { query: \"SELECT 0 AS cancelled;\" } }];\n"
    "  const q=MIG+\"UPDATE flow_expense_documents SET status='cancelled', updated_at=NOW() WHERE id=\"+id+\" RETURNING id, doc_no;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n"
    "if((b.action||'')==='flow_delete'){\n"
    "  const id=Number(b.id);\n"
    "  if(!Number.isFinite(id)) return [{ json: { query: \"SELECT 0 AS deleted_count;\" } }];\n"
    "  const q=MIG+\"WITH del AS (DELETE FROM flow_expense_documents WHERE id=\"+id+\" AND COALESCE(status,'draft')<>'paid' RETURNING id, doc_no) SELECT (SELECT COUNT(*) FROM del)::int AS deleted_count, (SELECT doc_no FROM del) AS doc_no;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n"
)
PAY_ANCHOR = "const affSql = esc(aff);"

def main():
    with io.open(PATH, "r", encoding="utf-8") as f:
        wf = json.load(f)
    node = next((n for n in wf["nodes"] if n.get("name") == "Build Expense SQL"), None)
    if node is None:
        print("ERR: node not found"); sys.exit(1)
    code = node["parameters"]["jsCode"]

    if "flow_save_payment" in code:
        print("SKIP: payment ops already present"); return
    for needle, tag in ((MIG_ANCHOR, "KEEP"), (LIST_OLD, "list query"), (PAY_ANCHOR, "affSql")):
        if needle not in code:
            print("ERR anchor not found:", tag); sys.exit(1)

    code = code.replace(MIG_ANCHOR, MIG_ANCHOR + MIG_BLOCK, 1)
    code = code.replace(LIST_OLD, LIST_NEW, 1)
    code = code.replace(PAY_ANCHOR, PAY_BRANCHES + PAY_ANCHOR, 1)

    node["parameters"]["jsCode"] = code
    with io.open(PATH, "w", encoding="utf-8") as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)
    print("OK: payment ops added")

if __name__ == "__main__":
    main()
