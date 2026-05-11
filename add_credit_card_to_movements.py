"""
สำหรับบัญชี 2490391139:
- ไม่แสดง receipt_transfers รายตัว
- รวมเป็น 1 บรรทัดต่อวัน ชื่อ "รับชำระบัตรเครดิต"
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")
dst = src

wf = json.loads(src.read_text(encoding='utf-8'))

target = next((n for n in wf['nodes'] if n.get('name') == 'Code List Movements'), None)
if not target:
    print("ERROR: ไม่พบ Code List Movements")
    sys.exit(1)

code = target['parameters']['jsCode']

# 1) แก้ receipt_transfers UNION เดิม → exclude บัญชี 2490391139
old_filter = "  AND rt.receipt_no NOT LIKE 'SCY10%' "
new_filter = ("  AND rt.receipt_no NOT LIKE 'SCY10%' "
              "AND ${accId} <> COALESCE((SELECT account_id FROM bank_accounts WHERE account_no = '2490391139' LIMIT 1), -1) ")

if "AND ba.account_id = ${accId} " in code and old_filter in code and "<> COALESCE((SELECT account_id FROM bank_accounts WHERE account_no = '2490391139'" not in code:
    code = code.replace(old_filter, new_filter, 1)
    print("OK: excluded บัญชี 2490391139 ออกจาก receipt_transfers UNION")
else:
    print("INFO: receipt_transfers exclude อาจถูกใส่ไปแล้ว (skip)")

# 2) เพิ่ม block "รับชำระบัตรเครดิต" — เฉพาะบัญชี 2490391139, group by date
if "รับชำระบัตรเครดิต" in code:
    print("INFO: credit-card grouped block already exists — skipping")
else:
    insert_block = (
        "UNION ALL\n"
        "SELECT dr.receipt_date AS movement_date, "
        "'CC-' || to_char(dr.receipt_date,'YYMMDD') AS doc_no, "
        "'รับชำระบัตรเครดิต' AS movement_type, "
        "NULL::text AS counterparty, 'บัตรเครดิต' AS payment_method, NULL::text AS note, "
        "SUM(COALESCE(rt.amount,0)) AS amount, 'in' AS direction, 0 AS wht_amount "
        "FROM receipt_transfers rt "
        "JOIN daily_receipts dr ON dr.receipt_no = rt.receipt_no "
        "JOIN bank_accounts ba ON ba.account_no = rt.bank_account_no "
        "WHERE ba.account_id = ${accId} "
        "  AND ${accId} = COALESCE((SELECT account_id FROM bank_accounts WHERE account_no = '2490391139' LIMIT 1), -1) "
        "  AND COALESCE(dr.status,'ปกติ') <> 'ยกเลิก' "
        "  AND rt.receipt_no NOT LIKE 'SCY10%' "
        "${dateFrom ? `AND dr.receipt_date >= '${dateFrom}'::date` : ''} "
        "${dateTo ? `AND dr.receipt_date <= '${dateTo}'::date + interval '1 day'` : ''} "
        "GROUP BY dr.receipt_date "
        "HAVING SUM(COALESCE(rt.amount,0)) > 0\n"
    )

    anchor = "ORDER BY movement_date DESC"
    idx = code.rfind(anchor)
    if idx == -1:
        print("ERROR: ไม่พบ anchor"); sys.exit(1)
    code = code[:idx] + insert_block + code[idx:]
    print("OK: inserted credit-card grouped block")

target['parameters']['jsCode'] = code
dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: saved to {dst}")
