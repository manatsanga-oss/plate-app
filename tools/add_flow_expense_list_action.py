# -*- coding: utf-8 -*-
"""
เพิ่ม action 'list_expenses' ให้ webhook upload-accounting-expense
อ่านค่าใช้จ่ายจาก flow_expense_documents (ตัวกรอง: ช่วงวันที่ + สังกัด + ประเภทค่าใช้จ่าย)
+ action 'list_expense_types' = distinct ประเภทค่าใช้จ่าย (ไว้ทำ dropdown)
แก้ที่ไฟล์ source-of-truth ใน OneDrive โดยตรง (ตาม CLAUDE.md)
"""
import json, io, sys

PATH = r"C:\Users\manat\OneDrive\New folder\Upload_Accounting_Expense_Workflow.json"

# JS branch ที่จะแทรกไว้ก่อน logic upsert เดิม (อ้าง esc/pdate ที่ประกาศไว้แล้วด้านบน)
LIST_BRANCH = (
    "\n"
    "// ---- LIST: อ่านค่าใช้จ่ายจาก flow (กรองช่วงวันที่ + สังกัด + ประเภท) ----\n"
    "if((b.action||'')==='list_expenses'){\n"
    "  const dFrom=pdate(b.date_from);\n"
    "  const dTo=pdate(b.date_to);\n"
    "  const affF=b.affiliation?esc(b.affiliation):null;\n"
    "  const etype=b.expense_type?esc(b.expense_type):null;\n"
    "  let w=\"WHERE 1=1\";\n"
    "  if(dFrom!=='NULL::date') w+=\" AND doc_date >= \"+dFrom;\n"
    "  if(dTo!=='NULL::date') w+=\" AND doc_date <= \"+dTo;\n"
    "  if(affF) w+=\" AND affiliation = \"+affF;\n"
    "  if(etype) w+=\" AND expense_type = \"+etype;\n"
    "  const q=\"SELECT id, doc_no AS expense_doc_no, affiliation, doc_date, vendor_name, vendor_tax_id, reference_no, expense_type, description, subtotal, vat_pct, vat_amount, total FROM flow_expense_documents \"+w+\" ORDER BY doc_date DESC NULLS LAST, id DESC;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n"
    "// ---- LIST TYPES: distinct ประเภทค่าใช้จ่าย (สำหรับ dropdown) ----\n"
    "if((b.action||'')==='list_expense_types'){\n"
    "  const affF=b.affiliation?esc(b.affiliation):null;\n"
    "  let w=\"WHERE expense_type IS NOT NULL AND expense_type<>''\";\n"
    "  if(affF) w+=\" AND affiliation = \"+affF;\n"
    "  const q=\"SELECT DISTINCT expense_type FROM flow_expense_documents \"+w+\" ORDER BY expense_type;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n"
)

ANCHOR = "function fdoc(v){ const s=String(v||'').trim(); if(!s) return ''; return s.startsWith('F-')?s:'F-'+s; }\n"

def main():
    with io.open(PATH, "r", encoding="utf-8") as f:
        wf = json.load(f)

    node = next((n for n in wf["nodes"] if n.get("name") == "Build Expense SQL"), None)
    if node is None:
        print("!! ไม่พบ node 'Build Expense SQL'"); sys.exit(1)

    code = node["parameters"]["jsCode"]
    if "list_expenses" in code:
        print("== มี action list_expenses อยู่แล้ว — ข้าม"); return
    if ANCHOR not in code:
        print("!! ไม่พบ anchor (fdoc) — โครงสร้างเปลี่ยน?"); sys.exit(1)

    node["parameters"]["jsCode"] = code.replace(ANCHOR, ANCHOR + LIST_BRANCH, 1)

    with io.open(PATH, "w", encoding="utf-8") as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)
    print("OK: เพิ่ม list_expenses + list_expense_types แล้ว →", PATH)

if __name__ == "__main__":
    main()
