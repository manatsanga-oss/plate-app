"""
แก้ logic การคำนวณเบี้ยขยันใน HR API workflow:
- ถ้ามีประวัติ ขาด/สาย/ลาป่วย/ลากิจ แม้ 1 วันในรอบ → diligence = 0
- ถ้าสะอาด → จำนวนวันที่มาทำงาน × อัตรา
"""
import json
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/HR API.json")
dst = Path(r"C:/Users/manat/OneDrive/New folder/HR API (2) - diligence_rules.json")

wf = json.loads(src.read_text(encoding='utf-8'))
target = next(n for n in wf['nodes'] if n['name'] == 'Code Calc Payroll')
code = target['parameters']['jsCode']

# Old tt_diligence CTE — ทั้งบล็อกตั้งแต่ "WITH tt_diligence AS (" จนปิด ")," ก่อน "tt_laundry AS"
old_block = """WITH tt_diligence AS (
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

# New: tt_violations + tt_diligence แบบ all-or-nothing
new_block = """WITH tt_violations AS (
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

if old_block in code:
    code = code.replace(old_block, new_block)
    target['parameters']['jsCode'] = code
    dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"OK: replaced tt_diligence CTE")
    print(f"OK: saved to {dst}")
else:
    print("ERROR: old tt_diligence block not found — pattern may have changed")
    # Help debug
    if 'tt_diligence AS' in code:
        idx = code.find('tt_diligence AS')
        print(f"\n--- found 'tt_diligence AS' at offset {idx}, showing 200 chars before/after ---")
        print(code[max(0,idx-50):idx+1200])
