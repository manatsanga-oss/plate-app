# -*- coding: utf-8 -*-
# แก้ auto-match ค่านำพา (import_delivery_fees_from_expenses) จับคู่ไม่เจอ:
#  1) regex ดึงเลขเครื่องจาก note ตัด prefix (G3V5E → V5E) → ใช้ [A-Z0-9]{2,10}E-?[0-9]{4,8}
#  2) join moto_sales แบบ exact → normalize (ตัด -/space) กัน format ต่าง
#  3) auto_candidates ดึงเลขเครื่องสดจาก note (ไม่พึ่ง df.engine_no ที่ยังไม่ refresh ใน statement เดียว)
#  4) refreshed re-extract แถวเดิมที่ engine_no เพี้ยน
import json, io, shutil

PATH = r"C:\Users\manat\OneDrive\New folder\Accounting API (16).json"
d = json.load(io.open(PATH, encoding="utf-8"))
node = next(x for x in d["nodes"] if x["name"] == "Code: import_delivery_fees_from_expenses")
c = node["parameters"]["jsCode"]
orig = c

def repl(s, old, new, n_expected):
    n = s.count(old)
    if n != n_expected:
        raise SystemExit("EXPECT %d got %d for: %r" % (n_expected, n, old[:70]))
    return s.replace(old, new)

EXTRACT_NEW = "'([A-Z0-9]{2,10}E-?[0-9]{4,8})'"

# 1) regex ดึงเลขเครื่อง (refreshed + imported = 2 จุด)
c = repl(c, "'([A-Z]{1,4}[0-9]{1,3}[A-Z]?E-?[0-9]{4,8})'", EXTRACT_NEW, 2)

# 2) refreshed: re-extract แถวเดิมที่ค่าเพี้ยน (ไม่ใช่เฉพาะ null)
c = repl(c,
  "WHERE df.source_expense_id = de.id AND de.note IS NOT NULL AND de.note ~* '[A-Z0-9]+E-?[0-9]{4,}' AND (df.engine_no IS NULL OR df.engine_no = '')",
  "WHERE df.source_expense_id = de.id AND de.note IS NOT NULL AND de.note ~* '[A-Z0-9]+E-?[0-9]{4,}' AND COALESCE(df.engine_no,'') IS DISTINCT FROM substring(UPPER(COALESCE(de.note, '')) from " + EXTRACT_NEW + ")",
  1)

# 3) auto_candidates: normalized match + ดึงเลขเครื่องสดจาก note
old_join = """  FROM delivery_fees df
  JOIN moto_sales ms ON UPPER(ms.engine_no) = UPPER(df.engine_no)
  WHERE df.engine_no IS NOT NULL
    AND df.linked_sale_invoice_no IS NULL
    AND NOT EXISTS (SELECT 1 FROM delivery_fees d2 WHERE d2.linked_sale_invoice_no = ms.invoice_no AND d2.id <> df.id)"""
new_join = """  FROM delivery_fees df
  LEFT JOIN daily_expenses de ON de.id = df.source_expense_id
  JOIN moto_sales ms ON regexp_replace(UPPER(COALESCE(ms.engine_no,'')), '[^A-Z0-9]', '', 'g') = regexp_replace(UPPER(COALESCE(COALESCE(substring(UPPER(COALESCE(de.note,'')) from '([A-Z0-9]{2,10}E-?[0-9]{4,8})'), df.engine_no),'')), '[^A-Z0-9]', '', 'g')
  WHERE df.linked_sale_invoice_no IS NULL
    AND length(regexp_replace(UPPER(COALESCE(COALESCE(substring(UPPER(COALESCE(de.note,'')) from '([A-Z0-9]{2,10}E-?[0-9]{4,8})'), df.engine_no),'')), '[^A-Z0-9]', '', 'g')) >= 6
    AND NOT EXISTS (SELECT 1 FROM delivery_fees d2 WHERE d2.linked_sale_invoice_no = ms.invoice_no AND d2.id <> df.id)"""
c = repl(c, old_join, new_join, 1)

if c == orig:
    raise SystemExit("no change")
node["parameters"]["jsCode"] = c
shutil.copyfile(PATH, PATH + ".bak-deliverymatch")
with io.open(PATH, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print("OK — delivery-fee matching patched, backup .bak-deliverymatch")
