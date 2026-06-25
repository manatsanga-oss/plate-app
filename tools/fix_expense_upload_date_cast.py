# -*- coding: utf-8 -*-
"""แก้ pdate() ใน node 'Build Expense SQL' ให้ cast ::date ทุกค่า
กัน error: column doc_date is of type date but expression is of type text
(VALUES หลายแถวที่มี date literal ถูกตีความเป็น text)"""
import json, sys, os
sys.stdout.reconfigure(encoding="utf-8")

TARGET = r"C:\Users\manat\OneDrive\New folder\Upload_Accounting_Expense_Workflow.json"

with open(TARGET, "r", encoding="utf-8") as f:
    wf = json.load(f)
node = next((n for n in wf["nodes"] if n.get("name") == "Build Expense SQL"), None)
if node is None:
    print("ERROR: ไม่พบ node"); sys.exit(1)
code = node["parameters"]["jsCode"]

if "'NULL::date'" in code:
    print("SKIP: cast ::date อยู่แล้ว"); sys.exit(0)

repls = [
    # pdate(): null ตอนต้น
    ("function pdate(v){ if(!v) return 'NULL';",
     "function pdate(v){ if(!v) return 'NULL::date';"),
    # pdate(): date จากรูปแบบ dd/mm/yyyy
    ("String(d).padStart(2,'0')+\"'\";}",
     "String(d).padStart(2,'0')+\"'::date\";}"),
    # pdate(): date รูปแบบ ISO + null ตอนท้าย
    ("return \"'\"+s.slice(0,10)+\"'\"; return 'NULL'; }",
     "return \"'\"+s.slice(0,10)+\"'::date\"; return 'NULL::date'; }"),
]
for old, new in repls:
    if old not in code:
        print("ERROR: ไม่พบ anchor:", old[:40]); sys.exit(1)
    code = code.replace(old, new, 1)

# เช็ค ===\'NULL\' (expense map + fuel map) → \'NULL::date\'
n_chk = code.count("pdate(r.doc_date)==='NULL'")
code = code.replace("pdate(r.doc_date)==='NULL'", "pdate(r.doc_date)==='NULL::date'")
print("updated date-null checks:", n_chk)

node["parameters"]["jsCode"] = code
with open(TARGET, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)
print("OK: cast ::date patched")
