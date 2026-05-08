"""
แก้ logic เบี้ยขยันใน HR API → ใช้ day_status_resolved เดียวกับหน้าสรุป
- รองรับ manual override (day_status_override)
- รองรับวันหยุดประจำสัปดาห์ (weekly_day_off)
- รองรับวันหยุดประจำปี (hr_annual_holidays)
- รองรับวันหยุดกลางเดือน (monthly_day_off)
- ตัดเบี้ยเฉพาะ "ขาด/สาย/ลาป่วย/ลากิจ" จริงๆ (วันหยุดไม่ตัด)
"""
import json
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/HR API.json")
dst = Path(r"C:/Users/manat/OneDrive/New folder/HR API (3) - diligence_resolved.json")

wf = json.loads(src.read_text(encoding='utf-8'))
target = next(n for n in wf['nodes'] if n['name'] == 'Code Calc Payroll')
code = target['parameters']['jsCode']

# old block ที่ต้องแทน — เริ่มจาก WITH tt_diligence/tt_violations จนถึง ก่อน tt_laundry
# ตอนนี้ workflow มี 2 รุ่น (HR API.json รุ่นเดิม) — old_block_v1 = single CTE tt_diligence
old_block_v1 = """WITH tt_diligence AS (
  -- เบี้ยขยัน: นับเฉพาะวันที่ "ขยัน" จริง — ไม่ขาด/สาย/ลาป่วย/ลากิจ (ยกเว้น ลาพักร้อน นับเป็นวันขยัน)
  -- รอบเงินเดือน 21 ของเดือนก่อน → 20 ของเดือนนั้น (เช่น เม.ย. = 21/03 → 20/04)
  -- Priority: ถ้า day_status_override = 'มา' (user mark ด้วยมือ) → นับเสมอ
  SELECT
    ${NORM} AS employee_name,
    COUNT(*) AS work_days_eligible
  FROM time_tracking_records
  WHERE clock_date >= ('${month}'::date - interval '11 days')
    AND clock_date < ('${month}'::date + interval '20 days')
    AND (
      TRIM(COALESCE(day_status_override, '')) = 'มา'
      OR (
        TRIM(COALESCE(day_status_override, '')) = ''
        AND (
          -- มา: clock_in มี (trust clock_in มากกว่า absence='Absence' อัตโนมัติ)
          (clock_in IS NOT NULL AND TRIM(clock_in) NOT IN ('', '-'))
          -- หรือ ลาพักร้อน (วันลาพักร้อนนับเป็นวันขยัน)
          OR COALESCE(leave_text, '') ILIKE '%พักร้อน%'
          -- หรือ ไม่มี absence (ปกติ)
          OR COALESCE(NULLIF(TRIM(absence), ''), '') = ''
        )
        AND COALESCE(leave_text, '') NOT ILIKE '%ป่วย%'
        AND COALESCE(leave_text, '') NOT ILIKE '%sick%'
        AND COALESCE(leave_text, '') NOT ILIKE '%กิจ%'
        AND (
          clock_late IS NULL
          OR TRIM(clock_late) = ''
          OR TRIM(clock_late) IN ('0', '0:00', '0:00:00')
          OR TRIM(clock_late) ~* '^0\\s*h\\s*0\\s*m'
        )
      )
    )
  GROUP BY ${NORM}
),"""

# new block: tt_resolved + tt_violations + tt_diligence ใช้ logic เดียวกับ Code Summary
new_block = """WITH tt_resolved AS (
  -- คำนวณ day_status_resolved เหมือนหน้า "สรุปรายพนักงาน"
  -- Priority: override > clock_in > leave_text > weekly > annual > monthly > absence
  SELECT
    regexp_replace(TRIM(t.employee_name), '\\s+', ' ', 'g') AS employee_name,
    t.clock_date,
    t.clock_late,
    COALESCE(
      NULLIF(t.day_status_override, ''),
      CASE
        WHEN t.clock_in IS NOT NULL AND t.clock_in <> '-' AND t.clock_in <> '' THEN 'มา'
        WHEN t.leave_text IS NOT NULL AND t.leave_text <> '-' AND t.leave_text <> '' AND t.leave_text <> 'Absence' THEN t.leave_text
        WHEN e.weekly_day_off IS NOT NULL AND t.day_name = e.weekly_day_off THEN 'วันหยุดประจำสัปดาห์'
        WHEN EXISTS (SELECT 1 FROM hr_annual_holidays h WHERE h.holiday_date = t.clock_date AND h.is_active) THEN 'วันหยุดประจำปี'
        WHEN e.monthly_day_off IS NOT NULL AND t.day_name = e.monthly_day_off THEN 'วันหยุดกลางเดือน'
        WHEN t.absence = 'Absence' THEN 'ขาด'
        ELSE NULL
      END
    ) AS day_status_resolved
  FROM time_tracking_records t
  LEFT JOIN hr_employees e
    ON (regexp_replace(TRIM(e.employee_name), '\\s+', ' ', 'g') = regexp_replace(TRIM(t.employee_name), '\\s+', ' ', 'g')
        OR regexp_replace(TRIM(e.english_name), '\\s+', ' ', 'g') = regexp_replace(TRIM(t.employee_name), '\\s+', ' ', 'g'))
  WHERE t.clock_date >= ('${month}'::date - interval '11 days')
    AND t.clock_date < ('${month}'::date + interval '20 days')
),
tt_violations AS (
  -- รายชื่อพนักงานที่มี "ประวัติเสีย" — ขาด/สาย/ลาป่วย/ลากิจ (วันหยุดไม่ถือเป็น violation)
  SELECT DISTINCT employee_name
  FROM tt_resolved
  WHERE
    -- ขาด (มี absence='Absence' ในวันทำงาน — วันหยุดจะถูก resolve เป็น 'วันหยุด...' ไม่ใช่ 'ขาด')
    day_status_resolved = 'ขาด'
    -- ลาป่วย
    OR day_status_resolved ILIKE '%ป่วย%'
    OR day_status_resolved ILIKE '%sick%'
    -- ลากิจ
    OR day_status_resolved ILIKE '%กิจ%'
    -- มาสาย (เฉพาะวันที่มา)
    OR (
      day_status_resolved = 'มา'
      AND clock_late IS NOT NULL
      AND TRIM(clock_late) <> ''
      AND TRIM(clock_late) NOT IN ('-', '0', '0:00', '0:00:00')
      AND TRIM(clock_late) !~* '^0\\s*h\\s*0\\s*m'
    )
),
tt_diligence AS (
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

# old_block_v2 = ที่ผมแก้ไปก่อนหน้า (มี tt_violations แล้ว) — replace ทั้งหมด
old_block_v2 = """WITH tt_violations AS (
  -- รายชื่อพนักงานที่มี "ประวัติเสีย" ในรอบ (ขาด/สาย/ลาป่วย/ลากิจ) — แม้ 1 วันก็ตัดเบี้ยทั้งเดือน
  -- รอบเงินเดือน 21 ของเดือนก่อน → 20 ของเดือนนั้น
  -- ยกเว้น: day_status_override = 'มา' (user mark ด้วยมือ) ไม่ถือเป็น violation
  SELECT DISTINCT ${NORM} AS employee_name
  FROM time_tracking_records
  WHERE clock_date >= ('${month}'::date - interval '11 days')
    AND clock_date < ('${month}'::date + interval '20 days')
    AND TRIM(COALESCE(day_status_override, '')) <> 'มา'
    AND (
      -- ลาป่วย
      COALESCE(leave_text, '') ILIKE '%ป่วย%'
      OR COALESCE(leave_text, '') ILIKE '%sick%'
      -- ลากิจ
      OR COALESCE(leave_text, '') ILIKE '%กิจ%'
      -- มาสาย (clock_late > 0)
      OR (
        clock_late IS NOT NULL
        AND TRIM(clock_late) <> ''
        AND TRIM(clock_late) NOT IN ('0', '0:00', '0:00:00')
        AND TRIM(clock_late) !~* '^0\\s*h\\s*0\\s*m'
      )
      -- ขาดงาน: ไม่มี clock_in + มี absence + ไม่ใช่ลาพักร้อน
      OR (
        (clock_in IS NULL OR TRIM(clock_in) IN ('', '-'))
        AND COALESCE(NULLIF(TRIM(absence), ''), '') <> ''
        AND COALESCE(leave_text, '') NOT ILIKE '%พักร้อน%'
      )
    )
),
tt_diligence AS (
  -- เบี้ยขยัน: ถ้าไม่มีประวัติเสีย → นับวันที่ "มา" จริง (รวมลาพักร้อน) × อัตรา
  -- ถ้ามีประวัติเสีย → ไม่มีแถว → COALESCE จะให้ work_days_eligible = 0 → diligence = 0
  SELECT
    ${NORM} AS employee_name,
    COUNT(*) AS work_days_eligible
  FROM time_tracking_records ttr
  WHERE clock_date >= ('${month}'::date - interval '11 days')
    AND clock_date < ('${month}'::date + interval '20 days')
    AND (
      TRIM(COALESCE(day_status_override, '')) = 'มา'
      OR (clock_in IS NOT NULL AND TRIM(clock_in) NOT IN ('', '-'))
      OR COALESCE(leave_text, '') ILIKE '%พักร้อน%'
    )
    AND ${NORM} NOT IN (SELECT employee_name FROM tt_violations)
  GROUP BY ${NORM}
),"""

replaced = False
if old_block_v1 in code:
    code = code.replace(old_block_v1, new_block)
    print("OK: replaced v1 (per-day) tt_diligence")
    replaced = True
elif old_block_v2 in code:
    code = code.replace(old_block_v2, new_block)
    print("OK: replaced v2 (all-or-nothing) tt_violations + tt_diligence")
    replaced = True

if not replaced:
    print("ERROR: neither v1 nor v2 patterns matched")
    exit(1)

target['parameters']['jsCode'] = code
dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: saved to {dst}")
