# -*- coding: utf-8 -*-
# เปลี่ยนการจับคู่ค่าแนะนำให้ใช้ flow_expense_documents (เอกสาร upload ย้ายมาที่นี่)
# - rebuild Code List Referral (splice keyword + affiliation ไทยจากของเดิม)
# - candidate query -> flow_expense_documents
# - wht/net โชว์จาก daily_expenses (flow ไม่มีคอลัมน์นี้) -> ทำที่ frontend
import json, io, re

path = r"C:\Users\manat\OneDrive\New folder\Referral_Fee_Workflow.json"
with io.open(path, encoding="utf-8") as f:
    wf = json.load(f)
nodes = {n["name"]: n for n in wf["nodes"]}

lst = nodes["Code List Referral"]
old = lst["parameters"]["jsCode"]
# extract Thai pieces from current jsCode
m_c = re.search(r"const c=\[[^\n]*?\];", old)
m_aff = re.search(r"CASE WHEN LEFT\(de\.payment_no,5\).*?END AS affiliation", old)
assert m_c, "ไม่พบ const c=[...] line"
assert m_aff, "ไม่พบ affiliation CASE"
C_LINE = m_c.group(0)
AFF = m_aff.group(0)

new_js = (
"const b=$input.first().json.body||{};\n"
"const df=b.date_from&&/^\\d{4}-\\d{2}-\\d{2}/.test(b.date_from)?`'${b.date_from}'::date`:null;\n"
"const dt=b.date_to&&/^\\d{4}-\\d{2}-\\d{2}/.test(b.date_to)?`'${b.date_to}'::date`:null;\n"
+ C_LINE + "\n"
"if(df)c.push(`de.payment_date>=${df}`);if(dt)c.push(`de.payment_date<=${dt}`);\n"
"const where='WHERE '+c.join(' AND ');\n"
"const query=`CREATE TABLE IF NOT EXISTS referral_doc_matches (daily_expense_id BIGINT PRIMARY KEY, expense_doc_id BIGINT NOT NULL, matched_by TEXT, matched_at TIMESTAMPTZ DEFAULT NOW());\n"
"SELECT de.id, de.payment_no, de.payment_date, de.pay_to, de.total_amount, COALESCE(de.cash,0) AS cash_amount, COALESCE(de.withholding_tax,0) AS withholding_tax, de.note, "
+ AFF + ", "
"COALESCE(mm.doc_no, m.doc_no) AS matched_doc_no, COALESCE(mm.doc_date, m.doc_date) AS matched_doc_date, "
"CASE WHEN mm.doc_no IS NOT NULL THEN 'manual' WHEN m.doc_no IS NOT NULL THEN 'auto' ELSE NULL END AS match_type "
"FROM daily_expenses de "
"LEFT JOIN LATERAL (SELECT fd.doc_no, fd.doc_date FROM referral_doc_matches rdm JOIN flow_expense_documents fd ON fd.id = rdm.expense_doc_id WHERE rdm.daily_expense_id = de.id LIMIT 1) mm ON TRUE "
"LEFT JOIN LATERAL (SELECT fd.doc_no, fd.doc_date FROM flow_expense_documents fd WHERE fd.total = de.total_amount AND UPPER(TRIM(BOTH ' -' FROM COALESCE(fd.vendor_name,''))) = UPPER(TRIM(BOTH ' -' FROM COALESCE(de.pay_to,''))) AND fd.doc_date = de.payment_date AND fd.id NOT IN (SELECT expense_doc_id FROM referral_doc_matches) ORDER BY fd.id LIMIT 1) m ON TRUE "
"${where} ORDER BY de.payment_date DESC, de.id DESC LIMIT 5000`;\n"
"return [{json:{query}}];"
)
lst["parameters"]["jsCode"] = new_js

# candidate -> flow_expense_documents
cand_js = r'''const b = $input.first().json.body || {};
const amount = Number(b.amount || 0);
const from = String(b.from || '1900-01-01').slice(0,10);
const to = String(b.to || '2999-12-31').slice(0,10);
function esc(s){ return String(s||'').replace(/'/g,"''"); }
const payTo = esc(b.pay_to || '');
const toks = String(b.pay_to||'').replace(/MR\.|MRS\.|MISS|นาย|นาง|น\.ส\./gi,' ').split(/[\s\-\/.]+/).filter(t=>t.length>=2);
let tok=''; for(const t of toks) if(t.length>tok.length) tok=t;
const tokEsc = esc(tok);
const nameExact = "UPPER(TRIM(BOTH ' -' FROM COALESCE(fd.vendor_name,''))) = UPPER(TRIM(BOTH ' -' FROM '"+payTo+"'))";
const nameLike = tokEsc ? "(fd.vendor_name ILIKE '%"+tokEsc+"%' OR fd.description ILIKE '%"+tokEsc+"%')" : "FALSE";
const sql = `CREATE TABLE IF NOT EXISTS referral_doc_matches (daily_expense_id BIGINT PRIMARY KEY, expense_doc_id BIGINT NOT NULL, matched_by TEXT, matched_at TIMESTAMPTZ DEFAULT NOW());
SELECT fd.id AS id, fd.doc_no AS doc_no, fd.doc_date, fd.vendor_name, fd.total, fd.affiliation, COALESCE(fd.description,'') AS description
FROM flow_expense_documents fd
WHERE fd.total = ${amount}
  AND fd.doc_date >= '${from}' AND fd.doc_date <= '${to}'
  AND fd.id NOT IN (SELECT expense_doc_id FROM referral_doc_matches)
ORDER BY (${nameExact}) DESC, (${nameLike}) DESC, fd.doc_date`;
return [{ json: { query: sql } }];'''
nodes["Code Referral Candidates"]["parameters"]["jsCode"] = cand_js

with io.open(path, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

with io.open(path, encoding="utf-8") as f:
    bk = json.load(f)
lc = [n for n in bk["nodes"] if n["name"]=="Code List Referral"][0]["parameters"]["jsCode"]
cc = [n for n in bk["nodes"] if n["name"]=="Code Referral Candidates"][0]["parameters"]["jsCode"]
print("list uses flow:", "flow_expense_documents fd WHERE fd.total" in lc)
print("list keeps affiliation:", "AS affiliation" in lc)
print("list no expense_documents leftover:", "expense_documents ed" not in lc)
print("cand uses flow:", "FROM flow_expense_documents fd" in cc)
print("DONE")
