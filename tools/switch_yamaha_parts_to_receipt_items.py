# -*- coding: utf-8 -*-
"""
หน้าจัดการภาษีซื้อ (Input_Tax_API.json, node 'Build Query'): หมวด "อะไหล่ YAMAHA"
เปลี่ยนแหล่งจาก yamaha_part_tax_invoices (ปนใบซื้อรถ → นับซ้ำกับหมวดรถ)
→ yamaha_part_receipt_items (อะไหล่ที่รับจริง เหมือนหน้ารายงานรับอะไหล่) group by tax_invoice_no
+ Part_Receipt_Report_API.json: HONDA คืน tax_invoice_date จริง (เดิม NULL) เพื่อโชว์คอลัมน์วันที่ใบกำกับ
แก้ไฟล์ source-of-truth ตาม CLAUDE.md
"""
import json, io, sys

IT_PATH = r"C:\Users\manat\OneDrive\New folder\Input_Tax_API.json"
PR_PATHS = [r"C:\Users\manat\OneDrive\New folder\Part_Receipt_Report_API.json",
            r"C:\Users\manat\OneDrive\New folder\Part Receipt Report API.json"]

OLD_FILTER = ("const yPart = [\"COALESCE(invoice_status,'ปกติ') = 'ปกติ'\"];\n"
              "if (f) yPart.push(\"to_char(tax_invoice_date, 'YYYYMM') = '\" + f + \"'\");\n")
NEW_FILTER = ("const yPart = [\"COALESCE(tax_invoice_no,'') <> ''\"];\n"
              "if (f) yPart.push(\"to_char(COALESCE(tax_invoice_date, doc_date, receipt_date), 'YYYYMM') = '\" + f + \"'\");\n")

OLD_BLOCK = (
    "  SELECT 'part', 'yamaha', 'สิงห์ชัย',\n"
    "    tax_invoice_date, tax_invoice_no, doc_no,\n"
    "    vendor_name, vendor_tax_id, vendor_branch, 'อะไหล่ YAMAHA',\n"
    "    COALESCE(amount_before_vat,0)::float8, COALESCE(vat_amount,0)::float8, COALESCE(total_amount,0)::float8\n"
    "  FROM yamaha_part_tax_invoices\n"
    "  WHERE ${yPart.join(' AND ')}")
NEW_BLOCK = (
    "  SELECT 'part', 'yamaha', 'สิงห์ชัย',\n"
    "    MAX(COALESCE(tax_invoice_date, doc_date, receipt_date)), tax_invoice_no, MAX(receipt_no),\n"
    "    MAX(vendor_name), MAX(tax_id), NULL, 'อะไหล่ YAMAHA',\n"
    "    COALESCE(SUM(total_cost),0)::float8, COALESCE(SUM(vat_amount),0)::float8, COALESCE(SUM(total_incl_vat),0)::float8\n"
    "  FROM yamaha_part_receipt_items\n"
    "  WHERE ${yPart.join(' AND ')}\n"
    "  GROUP BY tax_invoice_no")

HONDA_OLD = "       vendor_tax_id AS tax_invoice_no,\n       NULL::date AS tax_invoice_date,"
HONDA_NEW = "       vendor_tax_id AS tax_invoice_no,\n       tax_invoice_date AS tax_invoice_date,"


def patch_input_tax():
    wf = json.load(io.open(IT_PATH, "r", encoding="utf-8"))
    node = next((n for n in wf["nodes"] if n.get("name") == "Build Query"), None)
    c = node["parameters"]["jsCode"]
    if "yamaha_part_receipt_items" in c:
        print("SKIP input-tax: already switched"); return
    assert OLD_FILTER in c and OLD_BLOCK in c, "input-tax anchors not found"
    c = c.replace(OLD_FILTER, NEW_FILTER, 1).replace(OLD_BLOCK, NEW_BLOCK, 1)
    node["parameters"]["jsCode"] = c
    json.dump(wf, io.open(IT_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("OK input-tax: yamaha parts -> yamaha_part_receipt_items")


def patch_report(path):
    wf = json.load(io.open(path, "r", encoding="utf-8"))
    node = next((n for n in wf["nodes"] if n.get("name") == "Build report SQL"), None)
    if node is None:
        print("SKIP report (no node):", path); return
    c = node["parameters"]["jsCode"]
    if "NULL::date AS tax_invoice_date" not in c:
        print("SKIP report (already):", path); return
    node["parameters"]["jsCode"] = c.replace(HONDA_OLD, HONDA_NEW, 1)
    json.dump(wf, io.open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("OK report HONDA tax_invoice_date:", path)


if __name__ == "__main__":
    patch_input_tax()
    for p in PR_PATHS:
        try:
            patch_report(p)
        except FileNotFoundError:
            print("missing:", p)
