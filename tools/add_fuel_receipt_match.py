# -*- coding: utf-8 -*-
"""แก้ node 'Code Build Fuel SQL' ใน booking-api ให้ LEFT JOIN fuel_vat_entries
จับคู่ใบเสร็จน้ำมัน 1:1 ตาม วันที่เดียวกันเป๊ะ + ยอดเท่ากัน (ROW_NUMBER กันใบเสร็จซ้ำ)"""
import json, sys, os
sys.stdout.reconfigure(encoding="utf-8")

TARGET = r"C:\Users\manat\OneDrive\New folder\ระบบจองคนขับรถ (PostgreSQL).json"

NEW_CODE = r"""const b = $input.first().json.body || {};
const conds = ["payment_type ILIKE '%031%น้ำมัน%'"];
if (b.from) conds.push(`payment_date >= '${b.from}'`);
if (b.to) conds.push(`payment_date <= '${b.to}'`);
if (b.branch_code) conds.push(`payment_no LIKE '${b.branch_code}-%'`);
// จับคู่ใบเสร็จน้ำมัน (fuel_vat_entries) แบบ 1:1 — วันเดียวกันเป๊ะ + ยอดเท่ากัน
// ROW_NUMBER ทั้งสองฝั่งใน (วันที่, ยอด) เดียวกัน กันใบเสร็จใบเดียวจับซ้ำหลายเบิก
const sql = `WITH fe AS (
  SELECT id, payment_no, payment_date, pay_to, payment_type, detail, cash, transfer, check_amount, withholding_tax, credit_note, others, total_amount, prepared_by, status, note,
         ROW_NUMBER() OVER (PARTITION BY payment_date, total_amount ORDER BY payment_no) AS _rn
  FROM daily_expenses WHERE ${conds.join(' AND ')}
),
fv AS (
  SELECT doc_no, doc_date, vendor_name, vat_amount, total, affiliation,
         ROW_NUMBER() OVER (PARTITION BY doc_date, total ORDER BY doc_no) AS _rn
  FROM fuel_vat_entries
)
SELECT fe.id, fe.payment_no, fe.payment_date, fe.pay_to, fe.payment_type, fe.detail, fe.cash, fe.transfer, fe.check_amount, fe.withholding_tax, fe.credit_note, fe.others, fe.total_amount, fe.prepared_by, fe.status, fe.note,
       fv.doc_no AS receipt_no, fv.vendor_name AS receipt_vendor, fv.vat_amount AS receipt_vat, fv.affiliation AS receipt_aff
FROM fe
LEFT JOIN fv ON fv.doc_date = fe.payment_date AND fv.total = fe.total_amount AND fv._rn = fe._rn
ORDER BY fe.payment_date DESC, fe.payment_no DESC LIMIT 500`;
return [{ json: { query: sql } }];"""

with open(TARGET, "r", encoding="utf-8") as f:
    wf = json.load(f)
node = next((n for n in wf["nodes"] if n.get("name") == "Code Build Fuel SQL"), None)
if node is None:
    print("ERROR: ไม่พบ node 'Code Build Fuel SQL'"); sys.exit(1)
if "fuel_vat_entries" in node["parameters"].get("jsCode", ""):
    print("SKIP: มี match อยู่แล้ว"); sys.exit(0)
node["parameters"]["jsCode"] = NEW_CODE
with open(TARGET, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)
print("OK: patched", os.path.basename(TARGET))
