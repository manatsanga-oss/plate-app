# -*- coding: utf-8 -*-
# เพิ่ม manual จับคู่ใบเสร็จน้ำมัน ลงใน workflow ระบบจองคนขับรถ:
#  - แก้ report query (Code Build Fuel SQL) ให้ใช้ manual (fuel_receipt_matches) override auto
#  - เพิ่ม action get_fuel_receipt_candidates + set_fuel_match (clone branch น้ำมันเดิม)
import json, re, io, sys

path = r"C:\Users\manat\OneDrive\New folder\ระบบจองคนขับรถ (PostgreSQL).json"
with io.open(path, encoding="utf-8") as f:
    wf = json.load(f)
nodes = {n["name"]: n for n in wf["nodes"]}
conns = wf["connections"]

report_js = r'''const b = $input.first().json.body || {};
const conds = ["payment_type ILIKE '%031%น้ำมัน%'", "COALESCE(status,'') NOT ILIKE '%ยกเลิก%'"];
if (b.from) conds.push(`payment_date >= '${b.from}'`);
if (b.to) conds.push(`payment_date <= '${b.to}'`);
if (b.branch_code) conds.push(`payment_no LIKE '${b.branch_code}-%'`);
// จับคู่ใบเสร็จน้ำมัน: manual (fuel_receipt_matches) ก่อน, ไม่มีค่อย auto (วันที่+ยอด+rownumber)
const sql = `CREATE TABLE IF NOT EXISTS fuel_receipt_matches (daily_expense_id BIGINT PRIMARY KEY, flow_expense_id BIGINT NOT NULL, matched_by TEXT, matched_at TIMESTAMPTZ DEFAULT NOW());
WITH fe AS (
  SELECT id, payment_no, payment_date, pay_to, payment_type, detail, cash, transfer, check_amount, withholding_tax, credit_note, others, total_amount, prepared_by, status, note,
         ROW_NUMBER() OVER (PARTITION BY payment_date, total_amount ORDER BY payment_no) AS _rn
  FROM daily_expenses WHERE ${conds.join(' AND ')}
),
mm AS (
  SELECT m.daily_expense_id, f.doc_no, f.vendor_name, f.vat_amount, f.affiliation
  FROM fuel_receipt_matches m JOIN flow_expense_documents f ON f.id = m.flow_expense_id
),
fv AS (
  SELECT doc_no, doc_date, vendor_name, vat_amount, total, affiliation,
         ROW_NUMBER() OVER (PARTITION BY doc_date, total ORDER BY doc_no) AS _rn
  FROM flow_expense_documents
  WHERE expense_type ILIKE '%น้ำมัน%' AND id NOT IN (SELECT flow_expense_id FROM fuel_receipt_matches)
)
SELECT fe.id, fe.payment_no, fe.payment_date, fe.pay_to, fe.payment_type, fe.detail, fe.cash, fe.transfer, fe.check_amount, fe.withholding_tax, fe.credit_note, fe.others, fe.total_amount, fe.prepared_by, fe.status, fe.note,
       COALESCE(mm.doc_no, auto.doc_no) AS receipt_no,
       COALESCE(mm.vendor_name, auto.vendor_name) AS receipt_vendor,
       COALESCE(mm.vat_amount, auto.vat_amount) AS receipt_vat,
       COALESCE(mm.affiliation, auto.affiliation) AS receipt_aff,
       CASE WHEN mm.daily_expense_id IS NOT NULL THEN 'manual' WHEN auto.doc_no IS NOT NULL THEN 'auto' ELSE NULL END AS match_type
FROM fe
LEFT JOIN mm ON mm.daily_expense_id = fe.id
LEFT JOIN fv auto ON mm.daily_expense_id IS NULL AND auto.doc_date = fe.payment_date AND auto.total = fe.total_amount AND auto._rn = fe._rn
ORDER BY fe.payment_date DESC, fe.payment_no DESC LIMIT 500`;
return [{ json: { query: sql } }];'''

cand_js = r'''const b = $input.first().json.body || {};
const amount = Number(b.amount || 0);
const from = String(b.from || '1900-01-01').slice(0,10);
const to = String(b.to || '2999-12-31').slice(0,10);
const sql = `CREATE TABLE IF NOT EXISTS fuel_receipt_matches (daily_expense_id BIGINT PRIMARY KEY, flow_expense_id BIGINT NOT NULL, matched_by TEXT, matched_at TIMESTAMPTZ DEFAULT NOW());
WITH used_auto AS (
  WITH fe AS (
    SELECT id, payment_date, total_amount, ROW_NUMBER() OVER (PARTITION BY payment_date, total_amount ORDER BY payment_no) AS _rn
    FROM daily_expenses
    WHERE payment_type ILIKE '%031%น้ำมัน%' AND COALESCE(status,'') NOT ILIKE '%ยกเลิก%'
      AND id NOT IN (SELECT daily_expense_id FROM fuel_receipt_matches)
  ),
  fv AS (
    SELECT id, doc_date, total, ROW_NUMBER() OVER (PARTITION BY doc_date, total ORDER BY doc_no) AS _rn
    FROM flow_expense_documents
    WHERE expense_type ILIKE '%น้ำมัน%' AND id NOT IN (SELECT flow_expense_id FROM fuel_receipt_matches)
  )
  SELECT fv.id FROM fv JOIN fe ON fe.payment_date = fv.doc_date AND fe.total_amount = fv.total AND fe._rn = fv._rn
)
SELECT f.id, f.doc_no, f.doc_date, f.vendor_name, f.vat_amount, f.total, f.affiliation, f.expense_type
FROM flow_expense_documents f
WHERE f.total = ${amount}
  AND f.doc_date >= '${from}' AND f.doc_date <= '${to}'
  AND f.id NOT IN (SELECT flow_expense_id FROM fuel_receipt_matches)
  AND f.id NOT IN (SELECT id FROM used_auto)
ORDER BY f.doc_date, f.affiliation, f.doc_no`;
return [{ json: { query: sql } }];'''

match_js = r'''const b = $input.first().json.body || {};
const deId = Number(b.daily_expense_id || 0);
const feId = Number(b.flow_expense_id || 0);
const by = String(b.matched_by || 'system').replace(/'/g, "''");
let sql = "CREATE TABLE IF NOT EXISTS fuel_receipt_matches (daily_expense_id BIGINT PRIMARY KEY, flow_expense_id BIGINT NOT NULL, matched_by TEXT, matched_at TIMESTAMPTZ DEFAULT NOW());\n";
if (!deId) {
  sql += "SELECT false AS success, 'missing daily_expense_id' AS error;";
} else if (!feId) {
  sql += `DELETE FROM fuel_receipt_matches WHERE daily_expense_id = ${deId};\n`;
  sql += `SELECT true AS success, 'cleared' AS op, ${deId} AS daily_expense_id;`;
} else {
  sql += `INSERT INTO fuel_receipt_matches (daily_expense_id, flow_expense_id, matched_by) VALUES (${deId}, ${feId}, '${by}') ON CONFLICT (daily_expense_id) DO UPDATE SET flow_expense_id = EXCLUDED.flow_expense_id, matched_by = EXCLUDED.matched_by, matched_at = NOW();\n`;
  sql += `SELECT true AS success, 'saved' AS op, ${deId} AS daily_expense_id, ${feId} AS flow_expense_id;`;
}
return [{ json: { query: sql } }];'''

nodes["Code Build Fuel SQL"]["parameters"]["jsCode"] = report_js

def code_node(nid, name, js, pos):
    return {"parameters": {"jsCode": js}, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": pos, "id": nid, "name": name}
def pg_node(nid, name, pos):
    return {"parameters": {"operation": "executeQuery", "query": "{{ $json.query }}", "options": {}},
            "type": "n8n-nodes-base.postgres", "typeVersion": 2.5, "position": pos, "id": nid, "name": name,
            "credentials": {"postgres": {"id": "JLUeyZRAzUeRqlxu", "name": "Postgres account"}}}
def resp_node(nid, name, pos):
    return {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
            "options": {"responseHeaders": {"entries": [{"name": "Access-Control-Allow-Origin", "value": "*"}]}}},
            "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": pos, "id": nid, "name": name}

new_nodes = [
    code_node("fuel-cand-code", "Code Build Fuel Candidates SQL", cand_js, [13328, 7320]),
    pg_node("fuel-cand-pg", "Postgres Get Fuel Candidates", [13568, 7320]),
    resp_node("fuel-cand-resp", "Respond Fuel Candidates", [13808, 7320]),
    code_node("fuel-match-code", "Code Build Fuel Match SQL", match_js, [13328, 7520]),
    pg_node("fuel-match-pg", "Postgres Set Fuel Match", [13568, 7520]),
    resp_node("fuel-match-resp", "Respond Fuel Match", [13808, 7520]),
]
existing = {n["name"] for n in wf["nodes"]}
for nn in new_nodes:
    if nn["name"] not in existing:
        wf["nodes"].append(nn)

# re-run safe: อัปเดต jsCode ของ candidate/match แม้ node มีอยู่แล้ว
_js_by_name = {"Code Build Fuel Candidates SQL": cand_js, "Code Build Fuel Match SQL": match_js}
for n in wf["nodes"]:
    if n["name"] in _js_by_name:
        n["parameters"]["jsCode"] = _js_by_name[n["name"]]

def rule(cid, action):
    return {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{"id": cid, "leftValue": "={{ $json.body.action }}", "rightValue": action,
                            "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
            "renameOutput": True, "outputKey": action}
sw = nodes["Switch"]
vals = sw["parameters"]["rules"]["values"]
have = {v.get("outputKey") for v in vals}
for cid, act in [("c100", "get_fuel_receipt_candidates"), ("c101", "set_fuel_match")]:
    if act not in have:
        vals.append(rule(cid, act))

sw_main = conns["Switch"]["main"]
present_targets = {c[0]["node"] for c in sw_main if c}
for tgt in ["Code Build Fuel Candidates SQL", "Code Build Fuel Match SQL"]:
    if tgt not in present_targets:
        sw_main.append([{"node": tgt, "type": "main", "index": 0}])

def link(a, b):
    conns[a] = {"main": [[{"node": b, "type": "main", "index": 0}]]}
link("Code Build Fuel Candidates SQL", "Postgres Get Fuel Candidates")
link("Postgres Get Fuel Candidates", "Respond Fuel Candidates")
link("Code Build Fuel Match SQL", "Postgres Set Fuel Match")
link("Postgres Set Fuel Match", "Respond Fuel Match")

assert len(vals) == len(sw_main), "rules %d != outputs %d" % (len(vals), len(sw_main))
with io.open(path, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

with io.open(path, encoding="utf-8") as f:
    back = json.load(f)
bn = {n["name"] for n in back["nodes"]}
print("switch rules:", len(vals), "outputs:", len(sw_main))
print("new nodes present:", all(x in bn for x in ["Code Build Fuel Candidates SQL","Postgres Get Fuel Candidates","Respond Fuel Candidates","Code Build Fuel Match SQL","Postgres Set Fuel Match","Respond Fuel Match"]))
rep = [n for n in back["nodes"] if n["name"]=="Code Build Fuel SQL"][0]["parameters"]["jsCode"]
print("report manual override:", ("fuel_receipt_matches" in rep) and ("match_type" in rep))
for nm in ["Code Build Fuel SQL","Code Build Fuel Candidates SQL","Code Build Fuel Match SQL"]:
    code = [n for n in back["nodes"] if n["name"]==nm][0]["parameters"]["jsCode"]
    bad = [m.group(0) for m in re.finditer(r".{3}\$.{3}", code) if ("${" not in m.group(0)) and ("$input" not in m.group(0)) and ("$json" not in m.group(0))]
    print("  %s suspicious $: %s" % (nm, bad))
print("DONE")
