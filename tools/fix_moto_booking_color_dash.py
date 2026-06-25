# -*- coding: utf-8 -*-
"""แก้ moto-booking workflow ให้ลบขีด (-) ออกจากชื่อสีตอนบันทึก
กันสีจองใหม่มีขีด (ขาว-น้ำตาล) ไม่ตรงกับของเก่า (ขาวน้ำตาล) ทำให้ filter/คิวเพี้ยน"""
import json, sys, os
sys.stdout.reconfigure(encoding="utf-8")

TARGET = r"C:\Users\manat\OneDrive\New folder\ระบบจองรถจักรยานยนต์ (PostgreSQL).json"
ESC_DEF = "const esc = v => norm(v).replace(/'/g, \"''\");"
ESCC_DEF = ESC_DEF + "\nconst escC = v => esc(v).replace(/[-–—]/g, '');  // สี: ลบขีดด้วย (ขาว-น้ำตาล -> ขาวน้ำตาล)"

with open(TARGET, "r", encoding="utf-8") as f:
    wf = json.load(f)

changed = []
for nm, old_color, new_color in [
    ("Code Save Booking SQL", "'${esc(body.color_name)}'", "'${escC(body.color_name)}'"),
    ("Code Change Model SQL", "new_color_name = '${esc(body.color_name)}'", "new_color_name = '${escC(body.color_name)}'"),
]:
    node = next((x for x in wf["nodes"] if x.get("name") == nm), None)
    if node is None:
        print("ERROR: ไม่พบ node", nm); sys.exit(1)
    code = node["parameters"]["jsCode"]
    if "escC" in code:
        print("SKIP:", nm, "มี escC แล้ว"); continue
    if ESC_DEF not in code or old_color not in code:
        print("ERROR: ไม่พบ anchor ใน", nm); sys.exit(1)
    code = code.replace(ESC_DEF, ESCC_DEF, 1).replace(old_color, new_color, 1)
    node["parameters"]["jsCode"] = code
    changed.append(nm)

if changed:
    with open(TARGET, "w", encoding="utf-8") as f:
        json.dump(wf, f, ensure_ascii=False, indent=2)
print("OK:", ", ".join(changed) or "ไม่มีการแก้")
