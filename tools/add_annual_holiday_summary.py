# -*- coding: utf-8 -*-
"""เพิ่มคอลัมน์ annual_holiday_days (วันหยุดประจำปี) ใน SQL ของ node 'Code Summary'
ใน HR API.json — วางถัดจาก weekly_off_days"""
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

if "annual_holiday_days" in code:
    print("SKIP: มี annual_holiday_days อยู่แล้ว")
    sys.exit(0)

marker = "AS weekly_off_days,\n"
if marker not in code:
    print("ERROR: ไม่พบ marker weekly_off_days")
    sys.exit(1)

insert = (
    "AS weekly_off_days,\n"
    "  COUNT(*) FILTER (WHERE day_status_resolved = 'วันหยุดประจำปี') AS annual_holiday_days,\n"
)
node["parameters"]["jsCode"] = code.replace(marker, insert, 1)

with open(TARGET, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("OK: เพิ่ม annual_holiday_days ลงใน", os.path.basename(TARGET))
