"""
เพิ่ม receipt_transfers (รับชำระเงินโอน) เข้าใน Code List Movements ของ Accounting API
- เพิ่ม UNION ALL block ก่อน ORDER BY movement_date DESC
- match bank_accounts.account_no = rt.bank_account_no
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")
dst = src

wf = json.loads(src.read_text(encoding='utf-8'))

target = None
for n in wf['nodes']:
    if n.get('name') == 'Code List Movements':
        target = n
        break

if not target:
    print("ERROR: ไม่พบ node 'Code List Movements'")
    sys.exit(1)

code = target['parameters']['jsCode']

if "receipt_transfers rt" in code and "movement_type" in code and "รับชำระ (เงินโอน)" in code:
    print("INFO: receipt_transfers block already exists — skipping insert")
else:
    # block ที่จะเพิ่ม (เป็น string template literal — ระวัง backtick)
    insert_block = (
        "UNION ALL\n"
        "SELECT dr.receipt_date AS movement_date, rt.receipt_no AS doc_no, "
        "'รับชำระ (เงินโอน)' AS movement_type, "
        "dr.customer_name AS counterparty, 'โอน' AS payment_method, dr.note, "
        "COALESCE(rt.amount, 0) AS amount, 'in' AS direction, 0 AS wht_amount "
        "FROM receipt_transfers rt "
        "JOIN daily_receipts dr ON dr.receipt_no = rt.receipt_no "
        "JOIN bank_accounts ba ON ba.account_no = rt.bank_account_no "
        "WHERE ba.account_id = ${accId} "
        "  AND COALESCE(dr.status, 'ปกติ') <> 'ยกเลิก' "
        "  AND rt.receipt_no NOT LIKE 'SCY10%' "
        "${dateFrom ? `AND dr.receipt_date >= '${dateFrom}'::date` : ''} "
        "${dateTo ? `AND dr.receipt_date <= '${dateTo}'::date + interval '1 day'` : ''}\n"
    )

    # หา anchor ใส่ก่อน ORDER BY movement_date DESC ตัวสุดท้าย
    anchor = "ORDER BY movement_date DESC"
    idx = code.rfind(anchor)
    if idx == -1:
        print("ERROR: ไม่พบ 'ORDER BY movement_date DESC' anchor")
        sys.exit(1)

    new_code = code[:idx] + insert_block + code[idx:]
    target['parameters']['jsCode'] = new_code
    print("OK: inserted receipt_transfers UNION block before ORDER BY")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: saved to {dst}")
