"""
เพิ่ม CTE loan_interest_payments เข้าใน Code List Movements
- จ่ายดอกเบี้ย/ต้นเงินกู้ → 'out' ในบัญชีธนาคาร
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")

wf = json.loads(src.read_text(encoding='utf-8'))
target = next((n for n in wf['nodes'] if n['name'] == 'Code List Movements'), None)
if not target:
    print("ERROR: Code List Movements not found")
    exit(1)

code = target['parameters']['jsCode']

# ตำแหน่งที่จะแทรก: หลัง refund_movements + ก่อน final SELECT
# refund_movements ลงท้ายด้วย ")\n)" — แล้วตามด้วย "SELECT * FROM rs_movements"

old_marker = """SELECT * FROM rs_movements"""
new_block = """SELECT * FROM lip_movements
UNION ALL
SELECT * FROM rs_movements"""

# CTE ใหม่ที่ต้องเพิ่มก่อน final SELECT
# ใช้ pattern เดียวกับ refund_movements
old_refund_close = """  FROM moto_bookings mb
  WHERE mb.refund_from_bank_account_id = ${accId} AND mb.refund_paid_at IS NOT NULL
    ${dateFrom ? `AND mb.refund_paid_at >= '${dateFrom}'::date` : ''}
    ${dateTo ? `AND mb.refund_paid_at <= '${dateTo}'::date + interval '1 day'` : ''}
)
SELECT * FROM rs_movements"""

new_refund_close = """  FROM moto_bookings mb
  WHERE mb.refund_from_bank_account_id = ${accId} AND mb.refund_paid_at IS NOT NULL
    ${dateFrom ? `AND mb.refund_paid_at >= '${dateFrom}'::date` : ''}
    ${dateTo ? `AND mb.refund_paid_at <= '${dateTo}'::date + interval '1 day'` : ''}
),
lip_movements AS (
  SELECT
    lip.payment_date::timestamptz AS movement_date,
    'LIP-' || lip.payment_id AS doc_no,
    CASE WHEN lip.loan_id IS NULL THEN 'จ่ายดอกเบี้ย OD' ELSE 'จ่ายดอก/ต้นเงินกู้' END AS movement_type,
    COALESCE(la.lender, la.loan_name, '-') AS counterparty,
    COALESCE(lip.payment_method, 'โอน') AS payment_method,
    CASE WHEN lip.loan_id IS NULL THEN 'ดอกเบี้ย OD' ELSE COALESCE(la.loan_name, '') END AS note,
    -COALESCE(lip.total_amount, 0) AS amount,
    'out' AS direction,
    0 AS wht_amount
  FROM loan_interest_payments lip
  LEFT JOIN loan_accounts la ON la.loan_id = lip.loan_id
  WHERE lip.from_bank_account_id = ${accId}
    AND lip.status = 'active'
    ${dateFrom ? `AND lip.payment_date >= '${dateFrom}'::date` : ''}
    ${dateTo ? `AND lip.payment_date <= '${dateTo}'::date` : ''}
)
SELECT * FROM rs_movements"""

if old_refund_close in code:
    code = code.replace(old_refund_close, new_refund_close)
    print("OK: added lip_movements CTE")
else:
    print("WARN: refund_movements close pattern not found")
    exit(1)

# เพิ่ม UNION ของ lip_movements ใน final SELECT
old_union = "SELECT * FROM rs_movements\nUNION ALL"
new_union = "SELECT * FROM lip_movements\nUNION ALL\nSELECT * FROM rs_movements\nUNION ALL"
if old_union in code:
    code = code.replace(old_union, new_union, 1)  # only first occurrence
    print("OK: added lip_movements to UNION")
else:
    print("WARN: UNION pattern not found")
    exit(1)

target['parameters']['jsCode'] = code
src.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: saved to {src}")
