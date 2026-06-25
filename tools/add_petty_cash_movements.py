# -*- coding: utf-8 -*-
# เพิ่ม branch ในงาน list_bank_movements (Code List Movements ใน Accounting API (16)):
#   รายการเบิก น้ำมัน(031) + ค่าแนะนำ จาก daily_expenses -> โผล่เป็น "จ่ายออก" ในบัญชีเงินสดย่อย
#   ยอด = de.cash (เงินสดจ่ายจริง), map สังกัดด้วยชื่อบัญชี (ป.เปา/สิงห์ชัย) + payment_no prefix
import json, io, re

ACC = r"C:\Users\manat\OneDrive\New folder\Accounting API (16).json"
REF = r"C:\Users\manat\OneDrive\New folder\Referral_Fee_Workflow.json"

# 1) keyword ค่าแนะนำ จาก referral workflow (กันพิมพ์ไทยผิด)
rwf = json.load(io.open(REF, encoding="utf-8"))
rc = [n for n in rwf["nodes"] if n["name"] == "Code List Referral"][0]["parameters"]["jsCode"]
m = re.search(r'const c=\[\s*"(.*?)"\s*\]', rc)
assert m, "ไม่พบ referral keyword condition"
REF_COND = m.group(1)  # เช่น (de.payment_type ILIKE '%...%' OR de.detail ILIKE '%...%')
print("REF_COND =", REF_COND)

wf = json.load(io.open(ACC, encoding="utf-8"))
node = [n for n in wf["nodes"] if n["name"] == "Code List Movements"][0]
code = node["parameters"]["jsCode"]

BRANCH = (
"SELECT de.payment_date::timestamptz AS movement_date,\n"
"    de.payment_no AS doc_no,\n"
"    CASE WHEN de.payment_type ILIKE '%031%น้ำมัน%' THEN 'เบิกค่าน้ำมัน' ELSE 'จ่ายค่าแนะนำ' END AS movement_type,\n"
"    de.pay_to AS counterparty,\n"
"    'เงินสด' AS payment_method,\n"
"    de.note AS note,\n"
"    -COALESCE(de.cash, 0) AS amount,\n"
"    'out' AS direction,\n"
"    COALESCE(de.withholding_tax, 0) AS wht_amount\n"
"  FROM daily_expenses de\n"
"  JOIN bank_accounts ba ON ba.account_id = ${accId} AND ba.account_name ILIKE '%เงินสดย่อย%'\n"
"  WHERE COALESCE(de.status,'') NOT ILIKE '%ยกเลิก%'\n"
"    AND ( de.payment_type ILIKE '%031%น้ำมัน%' OR " + REF_COND + " )\n"
"    AND ( (ba.account_name ILIKE '%ป.เปา%' AND LEFT(de.payment_no,5) IN ('SCY05','SCY06'))\n"
"       OR (ba.account_name ILIKE '%สิงห์ชัย%' AND LEFT(de.payment_no,5) IN ('SCY01','SCY04','SCY07')) )\n"
"    ${dateFrom ? `AND (de.payment_date)::date >= '${dateFrom}'::date` : ''}\n"
"    ${dateTo ? `AND (de.payment_date)::date <= '${dateTo}'::date` : ''}"
)

MARK = "petty_cash daily_expenses"
if MARK in code:
    print("already patched — skip")
else:
    anchor = "SELECT * FROM refund_movements\nUNION ALL\n"
    assert code.count(anchor) == 1, "anchor count = %d" % code.count(anchor)
    new = code.replace(anchor, anchor + "/* " + MARK + " */\n" + BRANCH + "\nUNION ALL\n", 1)
    assert new != code
    node["parameters"]["jsCode"] = new
    json.dump(wf, io.open(ACC, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("patched")

# verify
bk = json.load(io.open(ACC, encoding="utf-8"))
c2 = [n for n in bk["nodes"] if n["name"] == "Code List Movements"][0]["parameters"]["jsCode"]
print("branch present:", "เบิกค่าน้ำมัน" in c2 and "เงินสดย่อย" in c2 and MARK in c2)
print("ref cond injected:", REF_COND in c2)
