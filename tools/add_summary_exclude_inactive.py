# -*- coding: utf-8 -*-
"""ไม่แสดงพนักงานที่ปิดงานแล้ว (status='inactive') ในแท็บสรุปรายพนักงาน
เพิ่มเงื่อนไขใน node 'Code Summary' ของ HR API.json
ใช้ COALESCE(...,'active') เพื่อคงแถวที่ไม่ match hr_employees (e เป็น NULL) ไว้เหมือนเดิม"""
import sys, json, os
sys.stdout.reconfigure(encoding="utf-8")

TARGET = r"C:\Users\manat\OneDrive\New folder\HR API.json"

with open(TARGET, "r", encoding="utf-8") as f:
    wf = json.load(f)

node = next((n for n in wf.get("nodes", []) if n.get("name") == "Code Summary"), None)
if node is None:
    print("ERROR: ไม่พบ node 'Code Summary'")
    sys.exit(1)

code = node["parameters"]["jsCode"]

cond = "COALESCE(e.status, 'active') <> 'inactive'"
if cond in code:
    print("SKIP: มีเงื่อนไข exclude inactive อยู่แล้ว")
    sys.exit(0)

marker = 'const conds = ["COALESCE(e.is_executive, FALSE) = FALSE", '
if marker not in code:
    print("ERROR: ไม่พบ marker conds")
    sys.exit(1)

replacement = 'const conds = ["COALESCE(e.is_executive, FALSE) = FALSE", "' + cond + '", '
node["parameters"]["jsCode"] = code.replace(marker, replacement, 1)

with open(TARGET, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("OK: เพิ่มเงื่อนไข exclude inactive ลงใน", os.path.basename(TARGET))
