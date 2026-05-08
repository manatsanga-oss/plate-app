"""
แก้ logic ค่าข้าวใน HR API:
- เดิม: meal_allowance = e.meal_allowance (flat)
- ใหม่: meal_allowance = work_days_meal × meal_rate
  โดย work_days_meal = COUNT(day_status_resolved = 'มา')  เหมือนคอลัมน์ "มา" ในหน้าสรุป
"""
import json
from pathlib import Path

import sys
sys.stdout.reconfigure(encoding='utf-8')

src = Path(r"C:/Users/manat/OneDrive/New folder/HR API (3) - diligence_resolved.json")
dst = src

wf = json.loads(src.read_text(encoding='utf-8'))
target = next(n for n in wf['nodes'] if n['name'] == 'Code Calc Payroll')
code = target['parameters']['jsCode']

# 1. เพิ่ม CTE tt_meal หลัง tt_diligence
old_diligence_close = """tt_diligence AS (
  -- เบี้ยขยัน: ถ้าไม่อยู่ใน violations → นับเฉพาะวัน "มา" จริง × อัตรา
  -- (ลาพักร้อน: ไม่ตัดเบี้ย แต่ก็ไม่นับเป็นวันขยัน)
  SELECT
    employee_name,
    COUNT(*) AS work_days_eligible
  FROM tt_resolved
  WHERE
    day_status_resolved = 'มา'
    AND employee_name NOT IN (SELECT employee_name FROM tt_violations)
  GROUP BY employee_name
),"""

new_diligence_close = """tt_diligence AS (
  -- เบี้ยขยัน: ถ้าไม่อยู่ใน violations → นับเฉพาะวัน "มา" จริง × อัตรา
  -- (ลาพักร้อน: ไม่ตัดเบี้ย แต่ก็ไม่นับเป็นวันขยัน)
  SELECT
    employee_name,
    COUNT(*) AS work_days_eligible
  FROM tt_resolved
  WHERE
    day_status_resolved = 'มา'
    AND employee_name NOT IN (SELECT employee_name FROM tt_violations)
  GROUP BY employee_name
),
tt_meal AS (
  -- ค่าข้าว: นับวัน "มา" ทุกคน (ไม่เช็คขาด/สาย/ลา) — เหมือนคอลัมน์ "มา" ในหน้าสรุป
  SELECT
    employee_name,
    COUNT(*) AS work_days_meal
  FROM tt_resolved
  WHERE day_status_resolved = 'มา'
  GROUP BY employee_name
),"""

if old_diligence_close in code:
    code = code.replace(old_diligence_close, new_diligence_close)
    print("OK: added tt_meal CTE after tt_diligence")
else:
    print("ERROR: tt_diligence pattern not found")
    exit(1)

# 2. แก้ base CTE — เปลี่ยน meal_allowance -> meal_rate, เพิ่ม work_days_meal
# 3. เพิ่ม LEFT JOIN tt_meal
old_base_meal = """    COALESCE(e.meal_allowance, 0) AS meal_allowance,
    COALESCE(e.laundry_allowance, 0) AS laundry_rate,
    COALESCE(tl.work_days_weekday, 0) AS work_days_weekday,"""

new_base_meal = """    COALESCE(e.meal_allowance, 0) AS meal_rate,
    COALESCE(tm.work_days_meal, 0) AS work_days_meal,
    COALESCE(e.laundry_allowance, 0) AS laundry_rate,
    COALESCE(tl.work_days_weekday, 0) AS work_days_weekday,"""

if old_base_meal in code:
    code = code.replace(old_base_meal, new_base_meal)
    print("OK: replaced meal_allowance -> meal_rate + work_days_meal")
else:
    print("ERROR: base meal block not found")
    exit(1)

# 4. เพิ่ม LEFT JOIN tt_meal ใน base
old_join = """  LEFT JOIN tt_laundry tl
    ON tl.employee_name = regexp_replace(TRIM(e.employee_name), '\\s+', ' ', 'g')
    OR tl.employee_name = regexp_replace(TRIM(e.english_name), '\\s+', ' ', 'g')
  WHERE e.status = 'active'"""

new_join = """  LEFT JOIN tt_laundry tl
    ON tl.employee_name = regexp_replace(TRIM(e.employee_name), '\\s+', ' ', 'g')
    OR tl.employee_name = regexp_replace(TRIM(e.english_name), '\\s+', ' ', 'g')
  LEFT JOIN tt_meal tm
    ON tm.employee_name = regexp_replace(TRIM(e.employee_name), '\\s+', ' ', 'g')
    OR tm.employee_name = regexp_replace(TRIM(e.english_name), '\\s+', ' ', 'g')
  WHERE e.status = 'active'"""

if old_join in code:
    code = code.replace(old_join, new_join)
    print("OK: added LEFT JOIN tt_meal")
else:
    print("ERROR: tt_laundry JOIN pattern not found")
    exit(1)

# 5. แก้ final SELECT — meal_allowance ตอนนี้ = meal_rate × work_days_meal
old_select_meal = """  meal_allowance,
  laundry_rate,
  work_days_weekday,"""

new_select_meal = """  meal_rate,
  work_days_meal,
  ROUND(meal_rate * work_days_meal, 2) AS meal_allowance,
  laundry_rate,
  work_days_weekday,"""

if old_select_meal in code:
    code = code.replace(old_select_meal, new_select_meal)
    print("OK: replaced final SELECT meal_allowance with calc")
else:
    print("ERROR: final SELECT meal pattern not found")
    exit(1)

# 6. แก้ total_income & net_income — replace `meal_allowance` ใน formula -> `(meal_rate * work_days_meal)`
# หา `+ meal_allowance +` ใน formula 2 ที่
old_total1 = "(salary + bonus + ot_workday + ot_holiday + meal_allowance + (laundry_rate * work_days_weekday) + (diligence_rate * work_days_eligible) + extra_bonus + other_income) AS total_income"
new_total1 = "(salary + bonus + ot_workday + ot_holiday + (meal_rate * work_days_meal) + (laundry_rate * work_days_weekday) + (diligence_rate * work_days_eligible) + extra_bonus + other_income) AS total_income"
if old_total1 in code:
    code = code.replace(old_total1, new_total1)
    print("OK: replaced total_income formula")

old_net1 = "((salary + bonus + ot_workday + ot_holiday + meal_allowance + (laundry_rate * work_days_weekday) + (diligence_rate * work_days_eligible) + extra_bonus + other_income)"
new_net1 = "((salary + bonus + ot_workday + ot_holiday + (meal_rate * work_days_meal) + (laundry_rate * work_days_weekday) + (diligence_rate * work_days_eligible) + extra_bonus + other_income)"
if old_net1 in code:
    code = code.replace(old_net1, new_net1)
    print("OK: replaced net_income formula")

target['parameters']['jsCode'] = code
dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved to {dst}")
