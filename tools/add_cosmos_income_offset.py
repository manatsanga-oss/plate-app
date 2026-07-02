# -*- coding: utf-8 -*-
# COSMOS: ตัดยอดจ่ายด้วยรายได้อื่น ๆ (income_records) — เก็บ income_offset_doc_no/amount บน cosmos_submissions
#  1) Registrations API (18): save/update/cancel/list รองรับ 2 คอลัมน์ใหม่ (self-heal ALTER)
#  2) Accounting API (16) "Code List Movements": cosmos_movements หัก income_offset ออกจากยอดโอน
import json, io, shutil

REG = r"C:\Users\manat\OneDrive\New folder\Registrations API (18).json"
ACC = r"C:\Users\manat\OneDrive\New folder\Accounting API (16).json"

ALTER = ("ALTER TABLE cosmos_submissions ADD COLUMN IF NOT EXISTS income_offset_doc_no TEXT; "
         "ALTER TABLE cosmos_submissions ADD COLUMN IF NOT EXISTS income_offset_amount NUMERIC; ")

def repl(s, old, new, n_expected, tag):
    n = s.count(old)
    if n != n_expected:
        raise SystemExit("[%s] EXPECT %d got %d: %r" % (tag, n_expected, n, old[:80]))
    return s.replace(old, new)

# ---------- Registrations API ----------
d = json.load(io.open(REG, encoding="utf-8"))
nodes = {n["name"]: n for n in d["nodes"]}

# Save: รับ income_offset + prepend ALTER
c = nodes["Code Save Cosmos Payment"]["parameters"]["jsCode"]
c = repl(c, "const payNo = `PAY-COSMOS-${yymmdd}-${hhmmss}`;",
            "const payNo = `PAY-COSMOS-${yymmdd}-${hhmmss}`;\n"
            "const offDoc = esc(b.income_offset_doc_no || '');\n"
            "const offAmt = Number(b.income_offset_amount);\n"
            "const offAmtExpr = isFinite(offAmt) && offAmt > 0 ? offAmt : 'NULL';", 1, "save-vars")
c = repl(c, "const query = `UPDATE cosmos_submissions SET paid_doc_no = '${payNo}'",
            "const query = `" + ALTER + "UPDATE cosmos_submissions SET paid_doc_no = '${payNo}'", 1, "save-alter")
c = repl(c, "from_bank_account_id = ${fromBankExpr} WHERE batch_no IN (${inList}) AND paid_at IS NULL RETURNING id",
            "from_bank_account_id = ${fromBankExpr}, income_offset_doc_no = NULLIF('${offDoc}',''), income_offset_amount = ${offAmtExpr} WHERE batch_no IN (${inList}) AND paid_at IS NULL RETURNING id", 1, "save-set")
nodes["Code Save Cosmos Payment"]["parameters"]["jsCode"] = c

# Cancel: ล้าง offset ด้วย
c = nodes["Code Cancel Cosmos Payment"]["parameters"]["jsCode"]
c = repl(c, "wht_rate = NULL, wht_amount = NULL, wht_base = NULL, from_bank_account_id = NULL WHERE paid_doc_no",
            "wht_rate = NULL, wht_amount = NULL, wht_base = NULL, from_bank_account_id = NULL, income_offset_doc_no = NULL, income_offset_amount = NULL WHERE paid_doc_no", 1, "cancel-clear")
nodes["Code Cancel Cosmos Payment"]["parameters"]["jsCode"] = c

# List Paid: คืน 2 คอลัมน์ + self-heal ALTER (กัน query พังก่อนมีคอลัมน์)
c = nodes["Code List Paid"]["parameters"]["jsCode"]
c = repl(c, "s.wht_amount, s.wht_rate, s.wht_base, s.from_bank_account_id,",
            "s.wht_amount, s.wht_rate, s.wht_base, s.income_offset_doc_no, s.income_offset_amount, s.from_bank_account_id,", 1, "list-cols")
c = repl(c, "const query = `SELECT s.id,",
            "const query = `" + ALTER + "SELECT s.id,", 1, "list-alter")
nodes["Code List Paid"]["parameters"]["jsCode"] = c

shutil.copyfile(REG, REG + ".bak-incomeoffset")
with io.open(REG, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print("OK — Registrations API patched")

# ---------- Accounting API: cosmos_movements ----------
d2 = json.load(io.open(ACC, encoding="utf-8"))
n2 = next(x for x in d2["nodes"] if x["name"] == "Code List Movements")
c2 = n2["parameters"]["jsCode"]
c2 = repl(c2,
    "-((SELECT COALESCE(SUM(COALESCE(cs2.premium, 0)), 0) FROM cosmos_submissions cs2 WHERE cs2.paid_doc_no = cs.paid_doc_no) - COALESCE(cs.wht_amount, 0)) AS amount,",
    "-((SELECT COALESCE(SUM(COALESCE(cs2.premium, 0)), 0) FROM cosmos_submissions cs2 WHERE cs2.paid_doc_no = cs.paid_doc_no) - COALESCE(cs.wht_amount, 0) - COALESCE(cs.income_offset_amount, 0)) AS amount,",
    1, "mov-amount")
n2["parameters"]["jsCode"] = c2
shutil.copyfile(ACC, ACC + ".bak-cosmosoffset")
with io.open(ACC, "w", encoding="utf-8") as f:
    json.dump(d2, f, ensure_ascii=False, indent=2)
print("OK — Accounting API cosmos_movements patched")
