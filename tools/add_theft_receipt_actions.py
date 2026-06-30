# -*- coding: utf-8 -*-
"""
เพิ่ม actions รับใบกำกับฯ ประกันรถหายออกแทน (ต่อคัน) ในโหนด 'Build Expense SQL'
- theft_list_receipts { flow_doc_id }            → list รายการที่บันทึกไว้ของเอกสารนั้น
- theft_save_receipts { flow_doc_id, flow_doc_no, affiliation, vendor_name, records[], created_by }
                                                  → replace-all (DELETE by flow_doc_id + INSERT)
ตาราง theft_insurance_invoice_receipts (self-migrate ในแต่ละ action)
แก้ไฟล์ source-of-truth ตาม CLAUDE.md
"""
import json, io, sys

PATH = r"C:\Users\manat\OneDrive\New folder\Upload_Accounting_Expense_Workflow.json"

# แทรกก่อนบล็อก PAYMENT OPS
ANCHOR = "// ---- PAYMENT OPS (mirror expense_record) ----\n"

BLOCK = (
    "// ---- THEFT INSURANCE RECEIPTS: รับใบกำกับฯ ประกันรถหายออกแทน (ต่อคัน) ----\n"
    "const TIR_TBL = \"CREATE TABLE IF NOT EXISTS theft_insurance_invoice_receipts (id BIGSERIAL PRIMARY KEY, flow_doc_id BIGINT, flow_doc_no TEXT, affiliation TEXT, vendor_name TEXT, branch TEXT, sale_invoice_no TEXT, sale_tax_invoice_no TEXT, chassis_no TEXT, engine_no TEXT, model_name TEXT, customer_name TEXT, finance_company TEXT, credit_note_amount NUMERIC(14,2) DEFAULT 0, tax_invoice_no TEXT, tax_invoice_date DATE, subtotal NUMERIC(14,2) DEFAULT 0, vat_pct NUMERIC(5,2) DEFAULT 7, vat_amount NUMERIC(14,2) DEFAULT 0, total NUMERIC(14,2) DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), created_by TEXT);\\nCREATE INDEX IF NOT EXISTS idx_theft_recv_doc ON theft_insurance_invoice_receipts(flow_doc_id);\\nALTER TABLE theft_insurance_invoice_receipts ADD COLUMN IF NOT EXISTS tax_invoice_date DATE;\\n\";\n"
    "if((b.action||'')==='theft_list_receipts'){\n"
    "  const fid=num(b.flow_doc_id);\n"
    "  const q=TIR_TBL+\"SELECT id, flow_doc_id, flow_doc_no, affiliation, vendor_name, branch, sale_invoice_no, sale_tax_invoice_no, chassis_no, engine_no, model_name, customer_name, finance_company, credit_note_amount, tax_invoice_no, tax_invoice_date, subtotal, vat_pct, vat_amount, total FROM theft_insurance_invoice_receipts WHERE flow_doc_id=\"+fid+\" ORDER BY id;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n"
    "if((b.action||'')==='theft_save_receipts'){\n"
    "  const fid=num(b.flow_doc_id);\n"
    "  const recs=Array.isArray(b.records)?b.records:[];\n"
    "  const by=esc(b.created_by||'system');\n"
    "  let q=TIR_TBL+\"DELETE FROM theft_insurance_invoice_receipts WHERE flow_doc_id=\"+fid+\";\\n\";\n"
    "  if(recs.length){\n"
    "    const vals=recs.map(function(r){ return \"(\"+fid+\", \"+esc(b.flow_doc_no)+\", \"+esc(b.affiliation)+\", \"+esc(b.vendor_name)+\", \"+esc(r.branch)+\", \"+esc(r.sale_invoice_no)+\", \"+esc(r.sale_tax_invoice_no)+\", \"+esc(r.chassis_no)+\", \"+esc(r.engine_no)+\", \"+esc(r.model_name)+\", \"+esc(r.customer_name)+\", \"+esc(r.finance_company)+\", \"+num(r.credit_note_amount)+\", \"+esc(r.tax_invoice_no)+\", \"+pdate(r.tax_invoice_date)+\", \"+num(r.subtotal)+\", \"+num(r.vat_pct)+\", \"+num(r.vat_amount)+\", \"+num(r.total)+\", \"+by+\")\"; }).join(\",\\n\");\n"
    "    q+=\"INSERT INTO theft_insurance_invoice_receipts (flow_doc_id, flow_doc_no, affiliation, vendor_name, branch, sale_invoice_no, sale_tax_invoice_no, chassis_no, engine_no, model_name, customer_name, finance_company, credit_note_amount, tax_invoice_no, tax_invoice_date, subtotal, vat_pct, vat_amount, total, created_by) VALUES \"+vals+\";\\n\";\n"
    "  }\n"
    "  q+=\"SELECT \"+recs.length+\" AS saved, \"+fid+\" AS flow_doc_id;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n\n"
)


def main():
    wf = json.load(io.open(PATH, "r", encoding="utf-8"))
    node = next((n for n in wf["nodes"] if n.get("name") == "Build Expense SQL"), None)
    if node is None:
        print("ERR: node 'Build Expense SQL' not found"); sys.exit(1)
    code = node["parameters"]["jsCode"]

    if "theft_save_receipts" in code:
        print("SKIP: theft receipt actions already present"); return
    if ANCHOR not in code:
        print("ERR: anchor (PAYMENT OPS) not found"); sys.exit(1)

    code = code.replace(ANCHOR, BLOCK + ANCHOR, 1)
    node["parameters"]["jsCode"] = code
    json.dump(wf, io.open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("OK: theft_list_receipts + theft_save_receipts added")


if __name__ == "__main__":
    main()
