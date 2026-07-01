# -*- coding: utf-8 -*-
# แก้ error "value too long for type character varying(20)" ตอนบันทึกจ่ายเงินค่าใช้จ่าย
# ด้วยวิธีจ่าย ภ.พ.36 (ชื่อวิธียาว ~31 ตัว) — เพิ่ม self-heal ALTER method -> TEXT
# ในทุก query ที่ INSERT expense_payment_breakdowns (save_payment 2 แบบ + edit_payment)
import json, io, shutil

PATH = r"C:\Users\manat\OneDrive\New folder\Accounting API (16).json"
d = json.load(io.open(PATH, encoding="utf-8"))
node = next(x for x in d["nodes"] if x["name"] == "Code Expense Record")
c = node["parameters"]["jsCode"]
orig = c

ALTER = "ALTER TABLE expense_payment_breakdowns ALTER COLUMN method TYPE TEXT;\n"

# save_payment: 2 templates เริ่มด้วย (newline)WITH prefix AS (SELECT ('EPAY-'
save_old = "\nWITH prefix AS (SELECT ('EPAY-'"
save_new = "\n" + ALTER + "WITH prefix AS (SELECT ('EPAY-'"
cnt = c.count(save_old)
if cnt != 2:
    raise SystemExit("save anchor expected 2, got %d" % cnt)
c = c.replace(save_old, save_new)

# edit_payment: 1 template query = `WITH upd AS (UPDATE expense_documents SET paid_at=
edit_old = "query = `WITH upd AS (UPDATE expense_documents SET paid_at="
edit_new = "query = `" + ALTER + "WITH upd AS (UPDATE expense_documents SET paid_at="
cnt = c.count(edit_old)
if cnt != 1:
    raise SystemExit("edit anchor expected 1, got %d" % cnt)
c = c.replace(edit_old, edit_new)

if c == orig:
    raise SystemExit("no change")
node["parameters"]["jsCode"] = c
shutil.copyfile(PATH, PATH + ".bak-widenmethod")
with io.open(PATH, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print("OK — expense_payment_breakdowns.method self-heal ALTER added (save x2 + edit), backup .bak-widenmethod")
