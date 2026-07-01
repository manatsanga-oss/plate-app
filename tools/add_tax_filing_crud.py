# -*- coding: utf-8 -*-
"""
เพิ่ม actions CRUD บันทึกแบบภาษีรายเดือน ในโหนด 'Build Query' ของ Input_Tax_API.json
- list_tax_filings / save_tax_filing (insert/update by id) / delete_tax_filing
- self-migrate ตาราง tax_monthly_filings (DDL: Tax_Monthly_Filings_DDL.sql)
แทรกบล็อกหลัง `const b = ($input.first().json.body) || {};`
⚠️ SQL newline ใน CREATE TABLE ต้องเป็น literal backslash-n (ใช้ chr(92)+'n') — heredoc/bash mangle '\\n'
แก้ไฟล์ source-of-truth ตาม CLAUDE.md
"""
import json, io, sys

PATH = r"C:\Users\manat\OneDrive\New folder\Input_Tax_API.json"
ANCHOR = "const b = ($input.first().json.body) || {};\n"
BS = chr(92)

BLOCK = (
    "const b = ($input.first().json.body) || {};\n"
    "// ===== Tax filing records CRUD (เตรียมแบบภาษีรายเดือน) =====\n"
    "const __act = b.action || 'list_input_tax';\n"
    "if (__act === 'list_tax_filings' || __act === 'save_tax_filing' || __act === 'delete_tax_filing') {\n"
    "  const TF_TBL = \"CREATE TABLE IF NOT EXISTS tax_monthly_filings (id BIGSERIAL PRIMARY KEY, filing_month TEXT NOT NULL, affiliation TEXT, tax_form TEXT DEFAULT 'ภ.พ.30', filing_type TEXT DEFAULT 'ยื่นปกติ', payment_date DATE, sales_vat NUMERIC(14,2) DEFAULT 0, purchase_vat NUMERIC(14,2) DEFAULT 0, payable NUMERIC(14,2) DEFAULT 0, status TEXT DEFAULT 'ร่าง', selected_keys JSONB, note TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());" + BS + "nALTER TABLE tax_monthly_filings ADD COLUMN IF NOT EXISTS affiliation TEXT;" + BS + "n\";\n"
    "  const E = (v) => { if (v===null||v===undefined) return 'NULL'; const s=String(v).trim(); if(s==='') return 'NULL'; return \"'\"+s.replace(/'/g,\"''\")+\"'\"; };\n"
    "  const N = (v) => { if(v===null||v===undefined||v==='') return '0'; const x=Number(String(v).replace(/,/g,'')); return isFinite(x)?String(x):'0'; };\n"
    "  const D = (v) => { const s=String(v||'').trim(); return /^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(s) ? \"'\"+s.slice(0,10)+\"'::date\" : 'NULL'; };\n"
    "  if (__act === 'list_tax_filings') {\n"
    "    return [{ json: { query: TF_TBL + \"SELECT id, filing_month, affiliation, tax_form, filing_type, payment_date, sales_vat, purchase_vat, payable, status, selected_keys, note FROM tax_monthly_filings ORDER BY filing_month DESC, id DESC;\" } }];\n"
    "  }\n"
    "  if (__act === 'delete_tax_filing') {\n"
    "    const idd = parseInt(b.id,10);\n"
    "    return [{ json: { query: TF_TBL + \"DELETE FROM tax_monthly_filings WHERE id=\" + (isFinite(idd)?idd:0) + \" RETURNING id;\" } }];\n"
    "  }\n"
    "  const keys = Array.isArray(b.selected_keys) ? b.selected_keys : [];\n"
    "  const keysJson = \"'\" + JSON.stringify(keys).replace(/'/g,\"''\") + \"'::jsonb\";\n"
    "  const setCols = \"filing_month=\"+E(b.filing_month)+\", affiliation=\"+E(b.affiliation)+\", tax_form=\"+E(b.tax_form||'ภ.พ.30')+\", filing_type=\"+E(b.filing_type||'ยื่นปกติ')+\", payment_date=\"+D(b.payment_date)+\", sales_vat=\"+N(b.sales_vat)+\", purchase_vat=\"+N(b.purchase_vat)+\", payable=\"+N(b.payable)+\", status=\"+E(b.status||'ร่าง')+\", selected_keys=\"+keysJson+\", note=\"+E(b.note)+\", updated_at=NOW()\";\n"
    "  const idu = parseInt(b.id,10);\n"
    "  if (isFinite(idu) && idu>0) {\n"
    "    return [{ json: { query: TF_TBL + \"UPDATE tax_monthly_filings SET \"+setCols+\" WHERE id=\"+idu+\" RETURNING id;\" } }];\n"
    "  }\n"
    "  return [{ json: { query: TF_TBL + \"INSERT INTO tax_monthly_filings (filing_month, affiliation, tax_form, filing_type, payment_date, sales_vat, purchase_vat, payable, status, selected_keys, note) VALUES (\"+E(b.filing_month)+\", \"+E(b.affiliation)+\", \"+E(b.tax_form||'ภ.พ.30')+\", \"+E(b.filing_type||'ยื่นปกติ')+\", \"+D(b.payment_date)+\", \"+N(b.sales_vat)+\", \"+N(b.purchase_vat)+\", \"+N(b.payable)+\", \"+E(b.status||'ร่าง')+\", \"+keysJson+\", \"+E(b.note)+\") RETURNING id;\" } }];\n"
    "}\n"
)


def main():
    wf = json.load(io.open(PATH, "r", encoding="utf-8"))
    node = next((n for n in wf["nodes"] if n.get("name") == "Build Query"), None)
    if node is None:
        print("ERR: node 'Build Query' not found"); sys.exit(1)
    c = node["parameters"]["jsCode"]
    if "tax_monthly_filings" in c:
        print("SKIP: already present"); return
    if ANCHOR not in c:
        print("ERR: anchor not found"); sys.exit(1)
    node["parameters"]["jsCode"] = c.replace(ANCHOR, BLOCK, 1)
    json.dump(wf, io.open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("OK: tax filing CRUD added")


if __name__ == "__main__":
    main()
