# -*- coding: utf-8 -*-
"""
เพิ่ม action 'list_theft_insurance' ในโหนด 'Build Expense SQL'
- ดึง flow_expense_documents เฉพาะ expense_type ขึ้นต้นด้วยรหัส (default 52071 = ค่าประกันรถหาย-ออกแทน)
  และ vendor_name = 'บริษัท เอสจีเอฟ แคปปิตอล จำกัด (มหาชน)'
- ข้าม EXCL (52071 ปกติถูกกรองออกจาก list_expenses) → ใช้ action แยกนี้แทน
- กรองช่วงวันที่ + สังกัด (optional) ส่งจาก frontend ได้
แก้ไฟล์ source-of-truth ตาม CLAUDE.md
"""
import json, io, sys

PATH = r"C:\Users\manat\OneDrive\New folder\Upload_Accounting_Expense_Workflow.json"

# anchor: แทรกหลังบล็อก list_expense_types
ANCHOR = ("if((b.action||'')==='list_expense_types'){\n"
          "  const affF=b.affiliation?esc(b.affiliation):null;\n"
          "  let w=\"WHERE expense_type IS NOT NULL AND expense_type<>'' AND \"+KEEP;\n"
          "  if(affF) w+=\" AND affiliation = \"+affF;\n"
          "  const q=\"SELECT DISTINCT expense_type FROM flow_expense_documents \"+w+\" ORDER BY expense_type;\";\n"
          "  return [{ json: { query: q } }];\n"
          "}\n")

BLOCK = (
    "// ---- LIST THEFT INSURANCE (ออกแทน): รหัส 52071 ค่าประกันรถหาย, ตัด vendor ไม่ระบุออก (เอสจีเอฟ/วิริยะ ฯลฯ) ----\n"
    "// เมนู Finance 'บันทึกรับใบกำกับฯ ประกันรถหาย (ออกแทน)' — bypass EXCL (52071 ถูกกรองออกจาก list_expenses)\n"
    "if((b.action||'')==='list_theft_insurance'){\n"
    "  const dFrom=pdate(b.date_from);\n"
    "  const dTo=pdate(b.date_to);\n"
    "  const affF=b.affiliation?esc(b.affiliation):null;\n"
    "  const codePrefix = (b.code_prefix!==undefined && b.code_prefix!==null && String(b.code_prefix).trim()!=='') ? String(b.code_prefix).trim() : '52071';\n"
    "  // vendor_names (array) = allowlist; ไม่ส่ง → ดึงทุก vendor ที่มีชื่อ ตัด exclude_vendors (default 'ไม่ระบุผู้จำหน่าย')\n"
    "  const vlist = Array.isArray(b.vendor_names) ? b.vendor_names.filter(v=>v&&String(v).trim()!=='') : [];\n"
    "  const excl = Array.isArray(b.exclude_vendors) ? b.exclude_vendors.filter(v=>v&&String(v).trim()!=='') : ['ไม่ระบุผู้จำหน่าย'];\n"
    "  let w=\"WHERE expense_type LIKE \"+esc(codePrefix+'%')+\" AND NULLIF(TRIM(vendor_name),'') IS NOT NULL\";\n"
    "  if(vlist.length){ w+=\" AND vendor_name IN (\"+vlist.map(esc).join(',')+\")\"; }\n"
    "  else if(excl.length){ w+=\" AND vendor_name <> ALL (ARRAY[\"+excl.map(esc).join(',')+\"])\"; }\n"
    "  if(dFrom!=='NULL::date') w+=\" AND doc_date >= \"+dFrom;\n"
    "  if(dTo!=='NULL::date') w+=\" AND doc_date <= \"+dTo;\n"
    "  if(affF) w+=\" AND affiliation = \"+affF;\n"
    "  const q=MIG+\"SELECT id, doc_no AS expense_doc_no, affiliation, doc_date, vendor_name, vendor_tax_id, reference_no, expense_type, description, subtotal, vat_pct, vat_amount, total, COALESCE(status,'draft') AS status, paid_doc_no, paid_at FROM flow_expense_documents \"+w+\" ORDER BY doc_date DESC NULLS LAST, id DESC;\";\n"
    "  return [{ json: { query: q } }];\n"
    "}\n"
)


def main():
    wf = json.load(io.open(PATH, "r", encoding="utf-8"))
    node = next((n for n in wf["nodes"] if n.get("name") == "Build Expense SQL"), None)
    if node is None:
        print("ERR: node 'Build Expense SQL' not found"); sys.exit(1)
    code = node["parameters"]["jsCode"]

    if "list_theft_insurance" in code:
        print("SKIP: action already present"); return
    if ANCHOR not in code:
        print("ERR: anchor (list_expense_types block) not found"); sys.exit(1)

    code = code.replace(ANCHOR, ANCHOR + "\n" + BLOCK, 1)
    node["parameters"]["jsCode"] = code
    json.dump(wf, io.open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("OK: list_theft_insurance added to Build Expense SQL")


if __name__ == "__main__":
    main()
