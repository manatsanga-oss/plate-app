# -*- coding: utf-8 -*-
"""
หน้ารายงานรับอะไหล่ (Part_Receipt_Report_API.json, node 'Build report SQL') ฝั่ง HONDA:
เปลี่ยนฐานข้อมูลจาก honda_part_tax_invoices → honda_part_receipts (ตารางรับสินค้า)
แล้ว LEFT JOIN honda_part_tax_invoices (pd_no = tax_invoice_no) เพื่อดึงตัวเลขภาษี
(มูลค่า/VAT/รวม + วันที่ใบกำกับ + เลขที่ใบกำกับ) จากตารางภาษี
→ "วันที่" = receipt_date (วันรับจริง), "วันที่ใบกำกับ" = tax_invoice_date
กรองช่วงเวลาด้วย r.receipt_date
แก้ทั้งไฟล์ underscore + เว้นวรรค (source-of-truth ตาม CLAUDE.md)

หมายเหตุ: ใบรับที่ยังไม่มีใบกำกับ → ภาษี = 0, วันที่ใบกำกับ = NULL (โชว์ "-"); ใบกำกับที่ไม่มีใบรับจะไม่ขึ้นในหน้านี้
(ความครบของภาษีซื้อสำหรับยื่นยังอยู่ที่หน้าจัดการภาษีซื้อซึ่งใช้ honda_part_tax_invoices ตรง ๆ)
"""
import json, io

NEW_ELSE = """} else {
  // HONDA: base = honda_part_receipts (รายการรับสินค้า) + ตัวเลขภาษีจาก honda_part_tax_invoices (link pd_no = tax_invoice_no)
  const conds = [];
  if (df) conds.push(`r.receipt_date >= '${df}'::date`);
  if (dt) conds.push(`r.receipt_date <= '${dt}'::date`);
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  query = `
SELECT 'header' AS kind,
       r.pd_no AS doc_no,
       r.receipt_date AS doc_date,
       COALESCE(t.vendor_name, r.vendor_name) AS vendor_name,
       t.tax_invoice_no AS tax_invoice_no,
       t.tax_invoice_date AS tax_invoice_date,
       COALESCE(t.doc_type, r.doc_type, 'invoice') AS doc_type,
       0::int AS items_count,
       0::float8 AS total_qty,
       COALESCE(t.amount_before_vat, 0)::float8 AS total_cost,
       COALESCE(t.vat_amount, 0)::float8 AS vat_amount,
       COALESCE(t.total_amount, 0)::float8 AS total_incl_vat
  FROM honda_part_receipts r
  LEFT JOIN honda_part_tax_invoices t ON t.tax_invoice_no = r.pd_no
  ${where}
 ORDER BY r.receipt_date DESC, r.pd_no DESC
 LIMIT 2000
`;
}
"""

PATHS = [r"C:\Users\manat\OneDrive\New folder\Part_Receipt_Report_API.json",
         r"C:\Users\manat\OneDrive\New folder\Part Receipt Report API.json"]


def main():
    for p in PATHS:
        try:
            wf = json.load(io.open(p, "r", encoding="utf-8"))
        except FileNotFoundError:
            print("missing:", p); continue
        node = next((n for n in wf["nodes"] if n.get("name") == "Build report SQL"), None)
        if node is None:
            print("no node:", p); continue
        c = node["parameters"]["jsCode"]
        if "FROM honda_part_receipts r" in c:
            print("SKIP already:", p); continue
        start = c.index("} else {")
        end = c.index("return [{ json: { query } }];")
        node["parameters"]["jsCode"] = c[:start] + NEW_ELSE + c[end:]
        json.dump(wf, io.open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("OK:", p)


if __name__ == "__main__":
    main()
