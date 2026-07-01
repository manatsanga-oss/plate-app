# -*- coding: utf-8 -*-
import json, io, shutil

PATH = r"C:\Users\manat\OneDrive\New folder\Tax_Remittance_Workflow.json"
d = json.load(io.open(PATH, encoding="utf-8"))
node = next(x for x in d["nodes"] if x["name"] == "Build Tax SQL")
c = node["parameters"]["jsCode"]
orig = c

def repl_once(s, old, new):
    n = s.count(old)
    if n != 1:
        raise SystemExit("EXPECT 1 got %d for anchor: %r" % (n, old[:70]))
    return s.replace(old, new)

# ---- 1) MIG: also self-heal expense_payment_breakdowns flag columns ----
c = repl_once(
    c,
    'tax_remitted_at TIMESTAMPTZ;\\n";',
    'tax_remitted_at TIMESTAMPTZ;\\n" +\n'
    '  "ALTER TABLE expense_payment_breakdowns ADD COLUMN IF NOT EXISTS tax_remit_doc_no TEXT;\\n" +\n'
    '  "ALTER TABLE expense_payment_breakdowns ADD COLUMN IF NOT EXISTS tax_remitted_at TIMESTAMPTZ;\\n";'
)

# ---- 2) list_pending_tax: UNION flow + expense breakdowns ----
old_list = ('const q = MIG + SRC_SELECT + w +\n'
            '    " GROUP BY pb.pb_id, pb.paid_doc_no, pb.amount ORDER BY MAX(d.paid_at) DESC NULLS LAST, pb.pb_id DESC;";')
new_list = (
    'const EXP_SELECT =\n'
    '    "SELECT pb.pb_id AS source_id, \'expense_payment_breakdowns\' AS source_table, pb.paid_doc_no, pb.amount, " +\n'
    '    "MAX(d.affiliation) AS affiliation, MAX(d.paid_at) AS paid_at, TO_CHAR(MAX(d.paid_at),\'YYYYMM\') AS period_month, " +\n'
    '    "STRING_AGG(DISTINCT d.vendor_name, \', \') AS vendor_name, STRING_AGG(DISTINCT d.expense_doc_no, \', \') AS doc_refs " +\n'
    '    "FROM expense_payment_breakdowns pb JOIN expense_documents d ON d.paid_doc_no = pb.paid_doc_no ";\n'
    '  const grp = " GROUP BY pb.pb_id, pb.paid_doc_no, pb.amount";\n'
    '  const q = MIG + "SELECT * FROM ( " + SRC_SELECT + w + grp + " UNION ALL " + EXP_SELECT + w + grp +\n'
    '    " ) u ORDER BY u.paid_at DESC NULLS LAST, u.source_id DESC;";')
c = repl_once(c, old_list, new_list)

# ---- 3) save (id-based path): table-aware over flow + expense ----
start = c.find("  const idList = ids.join(',');")
end = c.find("\n// ---------- HISTORY ----------")
if start < 0 or end < 0 or end < start:
    raise SystemExit("save-block markers not found")
new_save = (
"  const idList = ids.join(',');\n"
"  const taxType = b.tax_type || 'ภ.พ.36';\n"
"  const rd = dexpr(b.remit_date);\n"
"  const method = b.payment_method || 'โอน';\n"
"  const fromBank = (method==='โอน' && Number(b.from_bank_account_id)) ? Number(b.from_bank_account_id) : 'NULL';\n"
"  // table-aware: แยก pb_id ตามตารางต้นทาง (flow / expense) — รองรับทั้ง FLOW ACC และบันทึกค่าใช้จ่าย\n"
"  const srcs = Array.isArray(b.sources) ? b.sources : [];\n"
"  let flowIds = srcs.filter(s=>s && s.source_table==='flow_expense_payment_breakdowns').map(s=>Number(s.source_id)).filter(Number.isFinite);\n"
"  let expIds  = srcs.filter(s=>s && s.source_table==='expense_payment_breakdowns').map(s=>Number(s.source_id)).filter(Number.isFinite);\n"
"  if(!srcs.length){ flowIds = ids; }  // backward-compat: source_ids เดิม = flow\n"
"  const flowIn = flowIds.length ? flowIds.join(',') : '-1';\n"
"  const expIn  = expIds.length ? expIds.join(',') : '-1';\n"
"  const q = MIG +\n"
"   \"WITH prefix AS (SELECT ('TRMT-'||TO_CHAR(\"+rd+\",'YYMMDD')) AS p), \" +\n"
"   \"next_seq AS (SELECT COALESCE(MAX(CAST(SPLIT_PART(remit_doc_no,'-',3) AS INT)),0)+1 AS n FROM tax_remittances, prefix WHERE remit_doc_no LIKE (prefix.p||'-%')), \" +\n"
"   \"gen AS (SELECT (prefix.p||'-'||LPAD(n::text,3,'0')) AS rno FROM next_seq, prefix), \" +\n"
"   \"src AS (\" +\n"
"     \"SELECT 'flow_expense_payment_breakdowns' AS source_table, pb.pb_id, pb.amount, pb.paid_doc_no, MAX(d.affiliation) AS affiliation, MAX(d.paid_at) AS paid_at, STRING_AGG(DISTINCT d.vendor_name, ', ') AS vendor_name, STRING_AGG(DISTINCT d.doc_no, ', ') AS doc_refs FROM flow_expense_payment_breakdowns pb JOIN flow_expense_documents d ON d.paid_doc_no=pb.paid_doc_no WHERE pb.pb_id IN (\"+flowIn+\") AND pb.tax_remit_doc_no IS NULL GROUP BY pb.pb_id, pb.amount, pb.paid_doc_no \" +\n"
"     \"UNION ALL \" +\n"
"     \"SELECT 'expense_payment_breakdowns' AS source_table, pb.pb_id, pb.amount, pb.paid_doc_no, MAX(d.affiliation) AS affiliation, MAX(d.paid_at) AS paid_at, STRING_AGG(DISTINCT d.vendor_name, ', ') AS vendor_name, STRING_AGG(DISTINCT d.expense_doc_no, ', ') AS doc_refs FROM expense_payment_breakdowns pb JOIN expense_documents d ON d.paid_doc_no=pb.paid_doc_no WHERE pb.pb_id IN (\"+expIn+\") AND pb.tax_remit_doc_no IS NULL GROUP BY pb.pb_id, pb.amount, pb.paid_doc_no\" +\n"
"   \"), \" +\n"
"   \"hdr AS (INSERT INTO tax_remittances (remit_doc_no, remit_date, tax_type, period_month, affiliation, payment_method, from_bank_account_id, receipt_no, amount_total, note, status, created_by) \" +\n"
"     \"SELECT (SELECT rno FROM gen), \"+rd+\", \"+esc(taxType)+\", \"+esc(b.period_month)+\", \"+esc(b.affiliation)+\", \"+esc(method)+\", \"+fromBank+\", \"+esc(b.receipt_no)+\", (SELECT COALESCE(SUM(amount),0) FROM src), \"+esc(b.note)+\", 'paid', \"+esc(b.created_by)+\" WHERE EXISTS (SELECT 1 FROM src) RETURNING remit_doc_no), \" +\n"
"   \"ins AS (INSERT INTO tax_remittance_items (remit_doc_no, tax_type, source_table, source_id, source_ref, vendor_name, doc_date, affiliation, amount) \" +\n"
"     \"SELECT (SELECT rno FROM gen), \"+esc(taxType)+\", src.source_table, src.pb_id, src.paid_doc_no||COALESCE(' | '||src.doc_refs,''), src.vendor_name, src.paid_at::date, src.affiliation, src.amount FROM src WHERE EXISTS (SELECT 1 FROM hdr) RETURNING source_id), \" +\n"
"   \"uf AS (UPDATE flow_expense_payment_breakdowns SET tax_remit_doc_no=(SELECT rno FROM gen), tax_remitted_at=NOW() WHERE pb_id IN (\"+flowIn+\") AND tax_remit_doc_no IS NULL AND EXISTS (SELECT 1 FROM hdr) RETURNING pb_id), \" +\n"
"   \"ue AS (UPDATE expense_payment_breakdowns SET tax_remit_doc_no=(SELECT rno FROM gen), tax_remitted_at=NOW() WHERE pb_id IN (\"+expIn+\") AND tax_remit_doc_no IS NULL AND EXISTS (SELECT 1 FROM hdr) RETURNING pb_id) \" +\n"
"   \"SELECT (SELECT rno FROM gen) AS remit_doc_no, ((SELECT COUNT(*) FROM uf)+(SELECT COUNT(*) FROM ue)) AS updated_count;\";\n"
"  return [{ json:{ query:q } }];\n"
"}\n"
)
c = c[:start] + new_save + c[end+1:]

# ---- 4) cancel: also un-flag expense_payment_breakdowns ----
c = repl_once(
    c,
    '"WITH unflag AS (UPDATE flow_expense_payment_breakdowns SET tax_remit_doc_no=NULL, tax_remitted_at=NULL WHERE tax_remit_doc_no="+dn+" RETURNING pb_id), " +',
    '"WITH unflag AS (UPDATE flow_expense_payment_breakdowns SET tax_remit_doc_no=NULL, tax_remitted_at=NULL WHERE tax_remit_doc_no="+dn+" RETURNING pb_id), " +\n'
    '   "unflag2 AS (UPDATE expense_payment_breakdowns SET tax_remit_doc_no=NULL, tax_remitted_at=NULL WHERE tax_remit_doc_no="+dn+" RETURNING pb_id), " +'
)
c = repl_once(
    c,
    'SELECT (SELECT COUNT(*) FROM hdr) AS cancelled, (SELECT COUNT(*) FROM unflag) AS unflagged;',
    'SELECT (SELECT COUNT(*) FROM hdr) AS cancelled, ((SELECT COUNT(*) FROM unflag)+(SELECT COUNT(*) FROM unflag2)) AS unflagged;'
)

if c == orig:
    raise SystemExit("no change made")
node["parameters"]["jsCode"] = c
shutil.copyfile(PATH, PATH + ".bak-pp36expense")
with io.open(PATH, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print("OK — Tax_Remittance_Workflow patched (flow+expense ภ.พ.36), backup .bak-pp36expense")
