"""
แก้ Code List Movements ให้รวม expense_payment_breakdowns
- เดิม: อ่าน expense_documents.from_bank_account_id
- ใหม่: ถ้ามี breakdown → อ่านจาก breakdown (multi-method)
        ถ้าไม่มี → ใช้ของเดิม (legacy single-method)
"""
import json
import re
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")

wf = json.loads(src.read_text(encoding='utf-8'))

target = next((n for n in wf['nodes'] if n['name'] == 'Code List Movements'), None)
if not target:
    print("ERROR: Code List Movements not found")
    exit(1)

code = target['parameters']['jsCode']

# หา exp_movements CTE block และเพิ่ม condition NOT EXISTS breakdown
# pattern เดิม:
#   exp_movements AS (
#     ...
#     FROM expense_documents ed
#     WHERE ed.from_bank_account_id = ${accId} AND ed.paid_at IS NOT NULL AND ed.status = 'paid'
#       ${dateFrom ? `AND ed.paid_at >= '${dateFrom}'::date` : ''}
#       ${dateTo ? `AND ed.paid_at <= '${dateTo}'::date + interval '1 day'` : ''}
#     ORDER BY ed.paid_doc_no, ed.paid_at
#   ),

old_exp_where = """  FROM expense_documents ed
  WHERE ed.from_bank_account_id = ${accId} AND ed.paid_at IS NOT NULL AND ed.status = 'paid'
    ${dateFrom ? `AND ed.paid_at >= '${dateFrom}'::date` : ''}
    ${dateTo ? `AND ed.paid_at <= '${dateTo}'::date + interval '1 day'` : ''}
  ORDER BY ed.paid_doc_no, ed.paid_at
)"""

# new: legacy รายการ (ที่ไม่มี breakdown)
new_exp_where = """  FROM expense_documents ed
  WHERE ed.from_bank_account_id = ${accId} AND ed.paid_at IS NOT NULL AND ed.status = 'paid'
    AND NOT EXISTS (SELECT 1 FROM expense_payment_breakdowns pb WHERE pb.paid_doc_no = ed.paid_doc_no)
    ${dateFrom ? `AND ed.paid_at >= '${dateFrom}'::date` : ''}
    ${dateTo ? `AND ed.paid_at <= '${dateTo}'::date + interval '1 day'` : ''}
  ORDER BY ed.paid_doc_no, ed.paid_at
),
exp_pb_movements AS (
  SELECT ed.paid_at AS movement_date,
    pb.paid_doc_no AS doc_no,
    'จ่ายค่าใช้จ่าย' AS movement_type,
    (SELECT string_agg(DISTINCT ed2.vendor_name, ', ') FROM expense_documents ed2 WHERE ed2.paid_doc_no = pb.paid_doc_no) AS counterparty,
    pb.method AS payment_method,
    NULL::text AS note,
    -pb.amount AS amount,
    'out' AS direction,
    0 AS wht_amount
  FROM expense_payment_breakdowns pb
  JOIN expense_documents ed ON ed.paid_doc_no = pb.paid_doc_no
  WHERE pb.from_bank_account_id = ${accId}
    AND pb.method = 'โอน'
    AND ed.status = 'paid'
    ${dateFrom ? `AND ed.paid_at >= '${dateFrom}'::date` : ''}
    ${dateTo ? `AND ed.paid_at <= '${dateTo}'::date + interval '1 day'` : ''}
  GROUP BY ed.paid_at, pb.paid_doc_no, pb.method, pb.amount
)"""

if old_exp_where in code:
    code = code.replace(old_exp_where, new_exp_where)
    print("OK: replaced exp_movements WHERE block + added exp_pb_movements")
else:
    print("WARN: old_exp_where pattern not found — manual edit needed")
    # Try fuzzy
    if "exp_movements AS (" in code:
        print("  exp_movements AS exists in code — pattern may have changed")
    exit(1)

# เพิ่ม UNION ALL ของ exp_pb_movements ใน final SELECT
# pattern: "UNION ALL\nSELECT * FROM exp_movements\nUNION ALL\nSELECT * FROM inc_movements"
old_union = "SELECT * FROM exp_movements\nUNION ALL\nSELECT * FROM inc_movements"
new_union = "SELECT * FROM exp_movements\nUNION ALL\nSELECT * FROM exp_pb_movements\nUNION ALL\nSELECT * FROM inc_movements"
if old_union in code:
    code = code.replace(old_union, new_union)
    print("OK: added 'SELECT * FROM exp_pb_movements' to UNION")
else:
    print("WARN: UNION pattern not found")
    exit(1)

target['parameters']['jsCode'] = code
src.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: Saved to {src}")
