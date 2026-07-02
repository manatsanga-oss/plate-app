# -*- coding: utf-8 -*-
# เพิ่มบริษัท "ธนบรรณ" เข้าเมนูชำระเงินรับฝาก (ค่างวดกรุ๊ปลีส) — ใช้ตาราง grouplease_* ร่วมกัน
#  - grouplease_payments เพิ่มคอลัมน์ company (self-heal ALTER ใน Q: Pending)
#  - Q: Pending: กรอง description ตาม body.company (ธนบรรณ → '%ธนบรรณ%', อื่น ๆ → '%กรุ๊ปลิส%' ตามข้อมูลจริงใน DB)
#    + already_paid/NOT EXISTS เช็คเฉพาะใบโอนของบริษัทเดียวกัน (กันใบเสร็จที่มี 2 บริษัทยอดเท่ากัน)
#  - Build Save SQL: บันทึก company + เลขใบโอน TNB... สำหรับธนบรรณ
#  - Q: List: กรองตาม company (แถวเก่า company NULL = กรุ๊ปลีส)
#  - Q: Report: แยกยอดรับ/ยอดโอนตาม company
import json, io, shutil

PATH = r"C:\Users\manat\OneDrive\New folder\Group Lease Payment API (3).json"
d = json.load(io.open(PATH, encoding="utf-8"))
nodes = {n["name"]: n for n in d["nodes"]}

def repl(s, old, new, n_expected):
    n = s.count(old)
    if n != n_expected:
        raise SystemExit("EXPECT %d got %d for: %r" % (n_expected, n, old[:80]))
    return s.replace(old, new)

# SQL expression เลือก keyword ตาม company ที่ส่งมา (default = กรุ๊ปลิส ตาม data จริง)
KW_CASE = "(CASE WHEN '{{ $json.body.company }}' = 'ธนบรรณ' THEN 'ธนบรรณ' ELSE 'กรุ๊ปลิส' END)"
CO_CASE = "(CASE WHEN '{{ $json.body.company }}' = 'ธนบรรณ' THEN 'ธนบรรณ' ELSE 'กรุ๊ปลีส' END)"

# ---------- Q: Pending ----------
q = nodes["Q: Pending"]["parameters"]["query"]
# self-heal คอลัมน์ company
q = "ALTER TABLE grouplease_payments ADD COLUMN IF NOT EXISTS company TEXT;\n" + q
# กรองบริษัท
q = repl(q, "WHERE i.description ILIKE '%กรุ๊ปลิส%'",
            "WHERE i.description ILIKE '%' || " + KW_CASE + " || '%'", 1)
# already_paid + NOT EXISTS: เช็คเฉพาะใบโอนของบริษัทเดียวกัน (2 จุด)
q = repl(q, "gi.source_receipt_no = i.receipt_no AND",
            "gi.source_receipt_no = i.receipt_no AND COALESCE((SELECT gp.company FROM grouplease_payments gp WHERE gp.id = gi.payment_id), 'กรุ๊ปลีส') = " + CO_CASE + " AND", 2)
nodes["Q: Pending"]["parameters"]["query"] = q

# ---------- Build Save SQL ----------
c = nodes["Build Save SQL"]["parameters"]["jsCode"]
c = repl(c, "const pad = n => String(n).padStart(2, '0');",
            "const pad = n => String(n).padStart(2, '0');\nconst company = (b.company === 'ธนบรรณ') ? 'ธนบรรณ' : 'กรุ๊ปลีส';\nconst noPrefix = company === 'ธนบรรณ' ? 'TNB' : 'GLP';", 1)
c = repl(c, "const paymentNo = `GLP$", "const paymentNo = `${noPrefix}$", 1)
c = repl(c, "(payment_no, payment_date, transfer_amount, fee, transaction_id, from_bank, from_account, to_bank, to_account, to_name, slip_image, slip_mime, status, note, created_by, paid_to_vendor, payment_method, wht_rate, wht_amount, wht_base, from_bank_account_id)",
            "(payment_no, payment_date, transfer_amount, fee, transaction_id, from_bank, from_account, to_bank, to_account, to_name, slip_image, slip_mime, status, note, created_by, paid_to_vendor, payment_method, wht_rate, wht_amount, wht_base, from_bank_account_id, company)", 1)
c = repl(c, "${whtRateExpr}, ${whtAmountExpr}, ${whtBaseExpr}, ${fromBankExpr})",
            "${whtRateExpr}, ${whtAmountExpr}, ${whtBaseExpr}, ${fromBankExpr}, '${company}')", 1)
c = repl(c, "'${esc(b.to_name || 'GROUP LEASE PUBLIC CO.,LTD.')}'",
            "'${esc(b.to_name || (company === 'ธนบรรณ' ? 'บริษัท ธนบรรณ จำกัด' : 'GROUP LEASE PUBLIC CO.,LTD.'))}'", 1)
# self-heal ALTER ใน save ด้วย (กันกดบันทึกก่อนเปิดหน้า list)
c = repl(c, "const sql = `\nWITH ins AS (",
            "const sql = `\nALTER TABLE grouplease_payments ADD COLUMN IF NOT EXISTS company TEXT;\nWITH ins AS (", 1)
nodes["Build Save SQL"]["parameters"]["jsCode"] = c

# ---------- Q: List ----------
q = nodes["Q: List"]["parameters"]["query"]
q = repl(q, "WHERE (('{{ $json.body.date_from }}' = '') OR p.payment_date >= '{{ $json.body.date_from }}')",
            "WHERE (('{{ $json.body.company }}' IN ('', 'undefined')) OR COALESCE(p.company, 'กรุ๊ปลีส') = '{{ $json.body.company }}')\n  AND (('{{ $json.body.date_from }}' = '') OR p.payment_date >= '{{ $json.body.date_from }}')", 1)
nodes["Q: List"]["parameters"]["query"] = q

# ---------- Q: Report ----------
q = nodes["Q: Report"]["parameters"]["query"]
q = repl(q, "WHERE i.description ILIKE '%กรุ๊ปลิส%'",
            "WHERE i.description ILIKE '%' || " + KW_CASE + " || '%'", 1)
q = repl(q, "  FROM grouplease_payments\n  WHERE",
            "  FROM grouplease_payments\n  WHERE COALESCE(company, 'กรุ๊ปลีส') = " + CO_CASE + "\n    AND", 1)
nodes["Q: Report"]["parameters"]["query"] = q

shutil.copyfile(PATH, PATH + ".bak-thanaban")
with io.open(PATH, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print("OK — Group Lease Payment API (3).json patched (thanaban), backup .bak-thanaban")
