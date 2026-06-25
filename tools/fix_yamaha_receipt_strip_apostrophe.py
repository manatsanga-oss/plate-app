# -*- coding: utf-8 -*-
"""แก้ workflow upload รับอะไหล่ YAMAHA ให้ตัด ' (apostrophe) นำหน้ารหัสอะไหล่ตอน insert
ป้องกัน part_code = 'B5XE76410000 ที่ทำให้ join ค้างรับเข้าไม่ติด"""
import json, sys, os
sys.stdout.reconfigure(encoding="utf-8")

TARGET = r"C:\Users\manat\OneDrive\New folder\Yamaha Part Receipt Upload.json"

with open(TARGET, "r", encoding="utf-8") as f:
    wf = json.load(f)

node = next((n for n in wf["nodes"] if n.get("name") == "Build SQL YPR Items"), None)
if node is None:
    print("ERROR: ไม่พบ node 'Build SQL YPR Items'"); sys.exit(1)

code = node["parameters"]["jsCode"]
changed = []

# 1) เพิ่ม helper gvc() ถัดจาก gv() — ตัด ' นำหน้า + trim
gv_marker = "return row[k];}}return null;}"
gvc_helper = (
    gv_marker +
    "\nfunction gvc(row, names){const v=gv(row,names);"
    "return v==null?null:String(v).replace(/^'+/,'').trim();}"
)
if "function gvc(" not in code:
    if gv_marker not in code:
        print("ERROR: ไม่พบจุดจบของ gv()"); sys.exit(1)
    code = code.replace(gv_marker, gvc_helper, 1)
    changed.append("gvc helper")

# 2) เปลี่ยน part_code / part_code2 ให้ใช้ gvc()
for old, new in [
    ("part_code: gv(row,['รหัสอะไหล่']),",  "part_code: gvc(row,['รหัสอะไหล่']),"),
    ("part_code2: gv(row,['รหัสอะไหล่2']),", "part_code2: gvc(row,['รหัสอะไหล่2']),"),
]:
    if old in code:
        code = code.replace(old, new, 1)
        changed.append(old.split(":")[0])

if not changed:
    print("SKIP: แก้ไปแล้ว / ไม่พบจุดที่ต้องแก้"); sys.exit(0)

node["parameters"]["jsCode"] = code
with open(TARGET, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("OK:", os.path.basename(TARGET), "—", ", ".join(changed))
