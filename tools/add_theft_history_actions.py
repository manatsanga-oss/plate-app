# -*- coding: utf-8 -*-
"""
เพิ่ม actions ประวัติ/แก้ไข/ลบ รับใบกำกับฯ ประกันรถหายออกแทน ในโหนด 'Build Expense SQL'
- theft_history { date_from, date_to, affiliation, search } → list ทุกแถวที่บันทึก (กรองช่วงวันที่/สังกัด/ค้นหา)
- theft_update_receipt { id, tax_invoice_no, tax_invoice_date, subtotal, vat_pct, vat_amount, total } → UPDATE by id
- theft_delete_receipt { id } → DELETE by id
ใช้ TIR_TBL/esc/num/pdate ที่ประกาศไว้แล้วในโหนด (ต้องรัน add_theft_receipt_actions.py ก่อน)
แก้ไฟล์ source-of-truth ตาม CLAUDE.md
"""
import json, io, sys

PATH = r"C:\Users\manat\OneDrive\New folder\Upload_Accounting_Expense_Workflow.json"
ANCHOR = "// ---- PAYMENT OPS (mirror expense_record) ----\n"

BLOCK = (
    "// ---- THEFT HISTORY / EDIT / DELETE ----\n"
    "if((b.action||'')==='theft_history'){\n"
    "  const dFrom=pdate(b.date_from); const dTo=pdate(b.date_to);\n"
    "  const affF=b.affiliation?esc(b.affiliation):null;\n"
    "  const kw=b.search?String(b.search).trim():'';\n"
    "  let w=\"WHERE 1=1\";\n"
    "  if(dFrom!=='NULL::date') w+=\" AND COALESCE(tax_invoice_date, created_at::date) >= \"+dFrom;\n"
    "  if(dTo!=='NULL::date') w+=\" AND COALESCE(tax_invoice_date, created_at::date) <= \"+dTo;\n"
    "  if(affF) w+=\" AND affiliation = \"+affF;\n"
    "  if(kw){ const k=esc('%'+kw+'%'); w+=\" AND (flow_doc_no ILIKE \"+k+\" OR tax_invoice_no ILIKE \"+k+\" OR customer_name ILIKE \"+k+\" OR sale_invoice_no ILIKE \"+k+\" OR vendor_name ILIKE \"+k+\")\"; }\n"
    "  const q=TIR_TBL+\"SELECT id, flow_doc_id, flow_doc_no, affiliation, vendor_name, branch, sale_invoice_no, sale_tax_invoice_no, chassis_no, engine_no, model_name, customer_name, finance_company, credit_note_amount, tax_invoice_no, tax_invoice_date, subtotal, vat_pct, vat_amount, total, created_at FROM theft_insurance_invoice_receipts \"+w+\" ORDER BY created_at DESC, id DESC;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n"
    "if((b.action||'')==='theft_update_receipt'){\n"
    "  const id=num(b.id);\n"
    "  const q=TIR_TBL+\"UPDATE theft_insurance_invoice_receipts SET tax_invoice_no=\"+esc(b.tax_invoice_no)+\", tax_invoice_date=\"+pdate(b.tax_invoice_date)+\", subtotal=\"+num(b.subtotal)+\", vat_pct=\"+num(b.vat_pct)+\", vat_amount=\"+num(b.vat_amount)+\", total=\"+num(b.total)+\" WHERE id=\"+id+\" RETURNING id;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n"
    "if((b.action||'')==='theft_delete_receipt'){\n"
    "  const id=num(b.id);\n"
    "  const q=TIR_TBL+\"DELETE FROM theft_insurance_invoice_receipts WHERE id=\"+id+\" RETURNING id;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n\n"
)


def main():
    wf = json.load(io.open(PATH, "r", encoding="utf-8"))
    node = next((n for n in wf["nodes"] if n.get("name") == "Build Expense SQL"), None)
    if node is None:
        print("ERR: node 'Build Expense SQL' not found"); sys.exit(1)
    code = node["parameters"]["jsCode"]
    if "theft_history" in code:
        print("SKIP: history actions already present"); return
    if ANCHOR not in code:
        print("ERR: anchor (PAYMENT OPS) not found"); sys.exit(1)
    code = code.replace(ANCHOR, BLOCK + ANCHOR, 1)
    node["parameters"]["jsCode"] = code
    json.dump(wf, io.open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("OK: theft_history + theft_update_receipt + theft_delete_receipt added")


if __name__ == "__main__":
    main()
