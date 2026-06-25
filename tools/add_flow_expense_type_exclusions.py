# -*- coding: utf-8 -*-
"""
เพิ่ม exclusion: 'ไม่ดึง' ประเภทค่าใช้จ่ายบางตัวออกจาก list_expenses + list_expense_types
- match ด้วยรหัสบัญชี (prefix LIKE) เพราะรหัสเดียวกันชื่อต่างกันข้ามบริษัท + ครอบ 1191->11919
- match ชื่อล้วน (ไม่มีรหัส) ด้วยค่าจริงในตาราง
แก้ node 'Build Expense SQL' ในไฟล์ source-of-truth (ตาม CLAUDE.md)
"""
import json, io, sys

PATH = r"C:\Users\manat\OneDrive\New folder\Upload_Accounting_Expense_Workflow.json"

EXCL_DEFS = (
    "// ---- ประเภทค่าใช้จ่ายที่ \"ไม่ดึง\" (บันทึก/จัดการในเมนูอื่นแล้ว) ----\n"
    "// match ด้วยรหัสบัญชี (prefix) เพราะรหัสเดียวกันชื่อต่างข้ามบริษัท + ชื่อล้วน (ไม่มีรหัส)\n"
    "const EXCL_CODES = ['1191','51141','52063','52065','52066','52067','52071','52072','52074','54201','54501'];\n"
    "const EXCL_NAMES = ['ค่าธรรมเนียมธนาคาร','ค่านายหน้าและส่วนแบ่งการขาย','ค่าน้ำมัน/แก๊ส/รถยนต์','ค่าส่งเอกสาร/เมสเซนเจอร์/ไปรษณีย์'];\n"
    "const codeArr = \"ARRAY[\" + EXCL_CODES.map(c=>esc(c+'%')).join(',') + \"]\";\n"
    "const nameArr = \"ARRAY[\" + EXCL_NAMES.map(esc).join(',') + \"]\";\n"
    "const KEEP = \"(NULLIF(TRIM(expense_type),'') IS NOT NULL AND expense_type NOT LIKE ALL (\"+codeArr+\") AND expense_type <> ALL (\"+nameArr+\"))\";\n"
)

ANCHOR = "// ---- LIST: อ่านค่าใช้จ่ายจาก flow (กรองช่วงวันที่ + สังกัด + ประเภท) ----\n"

def main():
    with io.open(PATH, "r", encoding="utf-8") as f:
        wf = json.load(f)
    node = next((n for n in wf["nodes"] if n.get("name") == "Build Expense SQL"), None)
    if node is None:
        print("ERR: node 'Build Expense SQL' not found"); sys.exit(1)
    code = node["parameters"]["jsCode"]

    if "EXCL_CODES" in code:
        print("SKIP: exclusion already present"); return
    for needle in (ANCHOR, 'let w="WHERE 1=1";',
                   'let w="WHERE expense_type IS NOT NULL AND expense_type<>\'\'";'):
        if needle not in code:
            print("ERR: anchor not found ->", needle[:50]); sys.exit(1)

    # 1) แทรก EXCL defs ก่อน branch list
    code = code.replace(ANCHOR, EXCL_DEFS + ANCHOR, 1)
    # 2) list_expenses: WHERE 1=1 -> WHERE KEEP
    code = code.replace('let w="WHERE 1=1";', 'let w="WHERE "+KEEP;', 1)
    # 3) list_expense_types: append AND KEEP
    code = code.replace(
        'let w="WHERE expense_type IS NOT NULL AND expense_type<>\'\'";',
        'let w="WHERE expense_type IS NOT NULL AND expense_type<>\'\' AND "+KEEP;', 1)

    node["parameters"]["jsCode"] = code
    with io.open(PATH, "w", encoding="utf-8") as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)
    print("OK: exclusion added to Build Expense SQL")

    # ---- self-check: จำลองการ build SQL ของ list_expenses แล้วเขียนลงไฟล์ให้รีวิว ----
    EXCL_CODES = ['1191','51141','52063','52065','52066','52067','52071','52072','52074','54201','54501']
    EXCL_NAMES = ['ค่าธรรมเนียมธนาคาร','ค่านายหน้าและส่วนแบ่งการขาย','ค่าน้ำมัน/แก๊ส/รถยนต์','ค่าส่งเอกสาร/เมสเซนเจอร์/ไปรษณีย์']
    def esc(v): return "'" + str(v).replace("'", "''") + "'"
    codeArr = "ARRAY[" + ",".join(esc(c+"%") for c in EXCL_CODES) + "]"
    nameArr = "ARRAY[" + ",".join(esc(n) for n in EXCL_NAMES) + "]"
    KEEP = "(expense_type IS NULL OR (expense_type NOT LIKE ALL ("+codeArr+") AND expense_type <> ALL ("+nameArr+")))"
    sample = ("SELECT id, doc_no AS expense_doc_no, affiliation, doc_date, vendor_name, vendor_tax_id, "
              "reference_no, expense_type, description, subtotal, vat_pct, vat_amount, total "
              "FROM flow_expense_documents WHERE " + KEEP +
              " AND doc_date >= '2026-05-01'::date AND doc_date <= '2026-05-31'::date "
              "ORDER BY doc_date DESC NULLS LAST, id DESC;")
    with io.open(r"C:\Users\manat\plate-app\tmp_sample_sql.txt", "w", encoding="utf-8") as f:
        f.write(sample + "\n")
    print("WROTE sample SQL -> tmp_sample_sql.txt")

if __name__ == "__main__":
    main()
