# -*- coding: utf-8 -*-
"""เพิ่มการนำเข้าค่าน้ำมัน → ตาราง fuel_vat_entries ใน workflow upload ค่าใช้จ่าย
(node 'Build Expense SQL') — แยกจาก expense_documents กันชน doc_no ข้ามบริษัท"""
import json, sys, os
sys.stdout.reconfigure(encoding="utf-8")

TARGET = r"C:\Users\manat\OneDrive\New folder\Upload_Accounting_Expense_Workflow.json"

with open(TARGET, "r", encoding="utf-8") as f:
    wf = json.load(f)

node = next((n for n in wf["nodes"] if n.get("name") == "Build Expense SQL"), None)
if node is None:
    print("ERROR: ไม่พบ node 'Build Expense SQL'"); sys.exit(1)

code = node["parameters"]["jsCode"]
if "fuel_vat_entries" in code:
    print("SKIP: มี fuel_vat_entries อยู่แล้ว"); sys.exit(0)

# 1) CREATE TABLE fuel_vat_entries (ต่อท้าย migrate ของ expense_upload_ignored)
A1 = 'sql += "CREATE TABLE IF NOT EXISTS expense_upload_ignored (doc_no TEXT PRIMARY KEY, affiliation TEXT, doc_date DATE, vendor_name TEXT, description TEXT, total NUMERIC, ignored_at TIMESTAMPTZ DEFAULT NOW());\\n";'
FUEL_CREATE = (
    '\nsql += "CREATE TABLE IF NOT EXISTS fuel_vat_entries (id BIGSERIAL PRIMARY KEY, '
    'affiliation TEXT NOT NULL, doc_no TEXT NOT NULL, doc_date DATE, vendor_name TEXT, vendor_tax_id TEXT, '
    'subtotal NUMERIC(14,2) DEFAULT 0, vat_pct NUMERIC(5,2) DEFAULT 0, vat_amount NUMERIC(14,2) DEFAULT 0, '
    'total NUMERIC(14,2) DEFAULT 0, source_file TEXT, created_by TEXT, '
    'created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), '
    'UNIQUE(affiliation, doc_no));\\n";'
)
if A1 not in code:
    print("ERROR: ไม่พบ anchor A1 (expense_upload_ignored CREATE)"); sys.exit(1)
code = code.replace(A1, A1 + FUEL_CREATE, 1)

# 2) บล็อกประมวลผลค่าน้ำมัน → INSERT fuel_vat_entries (วางก่อนส่วนนับจริง)
A2 = "// ---- นับจริง: นำเข้า = doc_no"
FUEL_BLOCK = (
    "// ---- ค่าน้ำมัน -> fuel_vat_entries (แยกตาราง กันชน doc_no ข้ามบริษัท) ----\n"
    "const fuelRaw = Array.isArray(b.fuel) ? b.fuel : [];\n"
    "const fuelMap = new Map();\n"
    "for(const r of fuelRaw){ const k=String((r&&r.expense_doc_no)||'').trim(); if(!k) continue; if(pdate(r.doc_date)==='NULL') continue; fuelMap.set(k,r); }\n"
    "const fuelRows = [...fuelMap.values()];\n"
    "if(fuelRows.length){\n"
    "  const fcols=['affiliation','doc_no','doc_date','vendor_name','vendor_tax_id','subtotal','vat_pct','vat_amount','total','created_by'];\n"
    "  const fvals=fuelRows.map(r => \"(\"+affSql+\", \"+esc(r.expense_doc_no)+\", \"+pdate(r.doc_date)+\", \"+esc(r.vendor_name)+\", \"+esc(r.vendor_tax_id)+\", \"+num(r.subtotal)+\", \"+num(r.vat_pct)+\", \"+num(r.vat_amount)+\", \"+num(r.total)+\", \"+bySql+\")\");\n"
    "  for(let i=0;i<fvals.length;i+=CH){\n"
    "    sql += \"INSERT INTO fuel_vat_entries (\"+fcols.join(\",\")+\") VALUES \"+fvals.slice(i,i+CH).join(\",\\n\")+\" ON CONFLICT (affiliation, doc_no) DO UPDATE SET doc_date=EXCLUDED.doc_date, vendor_name=EXCLUDED.vendor_name, vendor_tax_id=EXCLUDED.vendor_tax_id, subtotal=EXCLUDED.subtotal, vat_pct=EXCLUDED.vat_pct, vat_amount=EXCLUDED.vat_amount, total=EXCLUDED.total, updated_at=NOW();\\n\";\n"
    "  }\n"
    "}\n\n"
)
if A2 not in code:
    print("ERROR: ไม่พบ anchor A2 (นับจริง)"); sys.exit(1)
code = code.replace(A2, FUEL_BLOCK + A2, 1)

# 3) เพิ่ม fuel_added ใน SELECT นับ + ใน return
A3 = '+ignored.length+" AS ignored_added;";'
if A3 not in code:
    print("ERROR: ไม่พบ anchor A3 (SELECT count)"); sys.exit(1)
code = code.replace(A3, '+ignored.length+" AS ignored_added, "+fuelRows.length+" AS fuel_added;";', 1)

A4 = "ignored_added: ignored.length, message: 'upload expense' } }];"
if A4 not in code:
    print("ERROR: ไม่พบ anchor A4 (return)"); sys.exit(1)
code = code.replace(A4, "ignored_added: ignored.length, fuel_added: fuelRows.length, message: 'upload expense' } }];", 1)

node["parameters"]["jsCode"] = code
with open(TARGET, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)
print("OK: patched", os.path.basename(TARGET))
