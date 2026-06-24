# -*- coding: utf-8 -*-
"""เพิ่ม op 'delete' ให้ node 'Code Expense Record' ในไฟล์ workflow Accounting API
ลบเอกสารค่าใช้จ่ายถาวร (เฉพาะที่ยังไม่ชำระ) พร้อม items ของมัน"""
import sys, json, glob, os
sys.stdout.reconfigure(encoding="utf-8")

FOLDER = r"C:\Users\manat\OneDrive\New folder"
# ไฟล์ล่าสุด (source of truth)
TARGET = os.path.join(FOLDER, "Accounting API (16).json")

DELETE_BLOCK = (
    "if (op === 'delete') {\n"
    "  const id = Number(b.expense_doc_id);\n"
    "  if (!id) return [{ json: { query: \"SELECT 0 AS deleted_count, 'id required' AS error_msg WHERE FALSE\" } }];\n"
    "  query = `WITH del_items AS (DELETE FROM expense_document_items i USING expense_documents d "
    "WHERE i.expense_doc_id = ${id} AND d.expense_doc_id = ${id} AND d.status <> 'paid' RETURNING i.item_id), "
    "del_doc AS (DELETE FROM expense_documents WHERE expense_doc_id = ${id} AND status <> 'paid' "
    "RETURNING expense_doc_id, expense_doc_no) "
    "SELECT (SELECT COUNT(*) FROM del_doc)::int AS deleted_count, "
    "(SELECT expense_doc_no FROM del_doc) AS expense_doc_no, "
    "(SELECT COUNT(*) FROM del_items)::int AS deleted_items`;\n"
    "  return [{ json: { query } }];\n"
    "}\n"
)

with open(TARGET, "r", encoding="utf-8") as f:
    wf = json.load(f)

node = next((n for n in wf.get("nodes", []) if n.get("name") == "Code Expense Record"), None)
if node is None:
    print("ERROR: ไม่พบ node 'Code Expense Record'")
    sys.exit(1)

code = node["parameters"]["jsCode"]

if "op === 'delete'" in code:
    print("SKIP: มี op 'delete' อยู่แล้ว")
    sys.exit(0)

marker = "if (op === 'save_payment') {"
if marker not in code:
    print("ERROR: ไม่พบ marker save_payment")
    sys.exit(1)

node["parameters"]["jsCode"] = code.replace(marker, DELETE_BLOCK + marker, 1)

with open(TARGET, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("OK: เพิ่ม op 'delete' ลงใน", os.path.basename(TARGET))
