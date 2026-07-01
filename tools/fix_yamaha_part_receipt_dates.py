# -*- coding: utf-8 -*-
"""
แก้บั๊ก upload YAMAHA part receipt (Yamaha_Part_Receipt_Upload.json, node 'Build SQL YPR Items'):
ไฟล์ต้นทาง รายงานการรับอะไหล่ เก็บ "วันที่ใบกำกับภาษี" และ "วันที่เอกสาร" แบบแยก 3 คอลัมน์ (วัน/เดือน/ปี)
เหมือนวันที่ใบรับ — แต่โค้ดเดิมอ่านแค่คอลัมน์ 'วันที่...' (ได้เลขวันอย่างเดียว) → parse เป็นวันที่ไม่ได้ → NULL
แก้ให้ประกอบจาก 3 คอลัมน์ด้วย makeDate() เหมือน receipt_date
ต้อง re-import workflow + re-upload ไฟล์ รายงานการรับอะไหล่_*.xlsx เพื่ออัปเดต tax_invoice_date/doc_date ของแถวเดิม
แก้ไฟล์ source-of-truth ตาม CLAUDE.md (ทั้งไฟล์ underscore + เว้นวรรค)
"""
import json, io

PATHS = [r"C:\Users\manat\OneDrive\New folder\Yamaha_Part_Receipt_Upload.json",
         r"C:\Users\manat\OneDrive\New folder\Yamaha Part Receipt Upload.json"]

OLD_DOC = "    doc_date: gv(row,['วันที่เอกสาร']),"
NEW_DOC = "    doc_date: makeDate(gv(row,['ปีเอกสาร']), gv(row,['เดือนเอกสาร']), gv(row,['วันที่เอกสาร'])),"
OLD_TAX = "    tax_invoice_date: gv(row,['วันที่ใบกำกับภาษี']),"
NEW_TAX = "    tax_invoice_date: makeDate(gv(row,['ปีใบกำกับภาษี']), gv(row,['เดือนใบกำกับภาษี']), gv(row,['วันที่ใบกำกับภาษี'])),"


def main():
    for p in PATHS:
        try:
            wf = json.load(io.open(p, "r", encoding="utf-8"))
        except FileNotFoundError:
            print("missing:", p); continue
        node = next((n for n in wf["nodes"] if n.get("name") == "Build SQL YPR Items"), None)
        if node is None:
            print("no node:", p); continue
        c = node["parameters"]["jsCode"]
        if "makeDate(gv(row,['ปีใบกำกับภาษี'])" in c:
            print("SKIP already:", p); continue
        if OLD_DOC not in c or OLD_TAX not in c:
            print("ERR anchors not found:", p); continue
        c = c.replace(OLD_DOC, NEW_DOC, 1).replace(OLD_TAX, NEW_TAX, 1)
        node["parameters"]["jsCode"] = c
        json.dump(wf, io.open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("OK:", p)


if __name__ == "__main__":
    main()
