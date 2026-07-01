# -*- coding: utf-8 -*-
"""
เพิ่ม source 'theft' (ประกันรถหายออกแทน) ในรายงานจัดการภาษีซื้อ — โหนด 'Build Query' ของ Input_Tax_API.json
- ดึงจาก theft_insurance_invoice_receipts (ใบกำกับภาษีที่บันทึกรับไว้ รหัส 52071)
- กรองรอบเดือนด้วย to_char(COALESCE(tax_invoice_date, created_at::date),'YYYYMM')
- มี guard CREATE TABLE IF NOT EXISTS กันหน้าพังถ้ายังไม่มีตาราง
แก้ไฟล์ source-of-truth ตาม CLAUDE.md
"""
import json, io, sys

PATH = r"C:\Users\manat\OneDrive\New folder\Input_Tax_API.json"

FUEL_ANCHOR = "if (f) fuel.push(\"to_char(doc_date, 'YYYYMM') = '\" + f + \"'\");\n"
THEFT_FILTER = ("\nconst theft = [\"COALESCE(vat_amount,0) > 0\"];\n"
                "if (f) theft.push(\"to_char(COALESCE(tax_invoice_date, created_at::date), 'YYYYMM') = '\" + f + \"'\");\n")

CREATE_ANCHOR = "CREATE TABLE IF NOT EXISTS fuel_receipt_matches (daily_expense_id BIGINT PRIMARY KEY, flow_expense_id BIGINT NOT NULL, matched_by TEXT, matched_at TIMESTAMPTZ DEFAULT NOW());\n"
THEFT_CREATE = ("CREATE TABLE IF NOT EXISTS theft_insurance_invoice_receipts (id BIGSERIAL PRIMARY KEY, flow_doc_id BIGINT, flow_doc_no TEXT, affiliation TEXT, vendor_name TEXT, branch TEXT, sale_invoice_no TEXT, sale_tax_invoice_no TEXT, chassis_no TEXT, engine_no TEXT, model_name TEXT, customer_name TEXT, finance_company TEXT, credit_note_amount NUMERIC(14,2) DEFAULT 0, tax_invoice_no TEXT, tax_invoice_date DATE, subtotal NUMERIC(14,2) DEFAULT 0, vat_pct NUMERIC(5,2) DEFAULT 7, vat_amount NUMERIC(14,2) DEFAULT 0, total NUMERIC(14,2) DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), created_by TEXT);\n")

UNION_ANCHOR = "  FROM flow_expense_documents\n  WHERE ${fuel.join(' AND ')}\n) t"
THEFT_UNION = (
    "  FROM flow_expense_documents\n"
    "  WHERE ${fuel.join(' AND ')}\n"
    "  UNION ALL\n"
    "  SELECT 'theft', NULL, affiliation,\n"
    "    COALESCE(tax_invoice_date, created_at::date), tax_invoice_no, sale_invoice_no,\n"
    "    vendor_name, NULL, NULL, COALESCE(NULLIF(model_name,''), 'ประกันรถหายออกแทน'),\n"
    "    COALESCE(subtotal,0)::float8, COALESCE(vat_amount,0)::float8, COALESCE(total,0)::float8\n"
    "  FROM theft_insurance_invoice_receipts\n"
    "  WHERE ${theft.join(' AND ')}\n"
    ") t")


def main():
    wf = json.load(io.open(PATH, "r", encoding="utf-8"))
    node = next((n for n in wf["nodes"] if n.get("name") == "Build Query"), None)
    if node is None:
        print("ERR: node 'Build Query' not found"); sys.exit(1)
    c = node["parameters"]["jsCode"]
    if "'theft'" in c:
        print("SKIP: theft source already present"); return
    for a in (FUEL_ANCHOR, CREATE_ANCHOR, UNION_ANCHOR):
        if a not in c:
            print("ERR: anchor not found ->", a[:40]); sys.exit(1)
    c = c.replace(FUEL_ANCHOR, FUEL_ANCHOR + THEFT_FILTER, 1)
    c = c.replace(CREATE_ANCHOR, CREATE_ANCHOR + THEFT_CREATE, 1)
    c = c.replace(UNION_ANCHOR, THEFT_UNION, 1)
    node["parameters"]["jsCode"] = c
    json.dump(wf, io.open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("OK: theft source added to Input_Tax_API Build Query")


if __name__ == "__main__":
    main()
