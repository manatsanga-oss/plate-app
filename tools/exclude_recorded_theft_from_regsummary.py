# -*- coding: utf-8 -*-
"""
รายงานสรุปใบปะหน้า คชจ. ขายรถ (list_registration_summary, node 'Q: List Registration Summary' ใน Accounting API (16).json):
คอลัมน์ "ประกันรถหายออกแทน" (credit_note_total) ให้ = 0 ถ้ารถคันนั้น (sale_invoice_no) ถูกบันทึกรับใบกำกับภาษีแล้ว
(มีใน theft_insurance_invoice_receipts) — ถือว่าเคลียร์ ไม่ต้องโชว์เป็นค่าใช้จ่ายค้างอีก
+ guard CREATE TABLE IF NOT EXISTS กัน query พังถ้ายังไม่มีตาราง
หมายเหตุ: query นี้ใช้ร่วมกับ popup ในหน้าบันทึกรับใบกำกับฯ → รถที่บันทึกแล้วจะหลุดจาก list popup ด้วย (พฤติกรรมที่ต้องการ)
แก้ไฟล์ source-of-truth ตาม CLAUDE.md
"""
import json, io, sys

PATH = r"C:\Users\manat\OneDrive\New folder\Accounting API (16).json"

GUARD = ("CREATE TABLE IF NOT EXISTS theft_insurance_invoice_receipts "
         "(id BIGSERIAL PRIMARY KEY, flow_doc_id BIGINT, flow_doc_no TEXT, affiliation TEXT, vendor_name TEXT, branch TEXT, "
         "sale_invoice_no TEXT, sale_tax_invoice_no TEXT, chassis_no TEXT, engine_no TEXT, model_name TEXT, customer_name TEXT, "
         "finance_company TEXT, credit_note_amount NUMERIC(14,2) DEFAULT 0, tax_invoice_no TEXT, tax_invoice_date DATE, "
         "subtotal NUMERIC(14,2) DEFAULT 0, vat_pct NUMERIC(5,2) DEFAULT 7, vat_amount NUMERIC(14,2) DEFAULT 0, "
         "total NUMERIC(14,2) DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW(), created_by TEXT);\n")

OLD = "COALESCE(rcpts.credit_note_total, 0) AS credit_note_total"
NEW = ("CASE WHEN EXISTS (SELECT 1 FROM theft_insurance_invoice_receipts tir WHERE tir.sale_invoice_no = s.invoice_no) "
       "THEN 0 ELSE COALESCE(rcpts.credit_note_total, 0) END AS credit_note_total")


def main():
    wf = json.load(io.open(PATH, "r", encoding="utf-8"))
    node = next((n for n in wf["nodes"] if n.get("name") == "Q: List Registration Summary"), None)
    if node is None:
        print("ERR: node 'Q: List Registration Summary' not found"); sys.exit(1)
    q = node["parameters"]["query"]
    if "theft_insurance_invoice_receipts" in q:
        print("SKIP: already patched"); return
    cnt = q.count(OLD)
    if cnt != 3:
        print("ERR: expected 3 credit_note_total occurrences, got", cnt); sys.exit(1)
    node["parameters"]["query"] = GUARD + q.replace(OLD, NEW)
    json.dump(wf, io.open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("OK: excluded recorded theft items from registration summary (3 branches)")


if __name__ == "__main__":
    main()
