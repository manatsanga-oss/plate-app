# -*- coding: utf-8 -*-
# เพิ่ม manual จับคู่เอกสารค่าแนะนำ (referral) ใน Referral_Fee_Workflow:
#  - list_referral_fees: manual (referral_doc_matches) override auto + match_type
#  - action get_referral_candidates + set_referral_match (share PG Execute + Respond)
import json, io, re

path = r"C:\Users\manat\OneDrive\New folder\Referral_Fee_Workflow.json"
with io.open(path, encoding="utf-8") as f:
    wf = json.load(f)
nodes = {n["name"]: n for n in wf["nodes"]}
conns = wf["connections"]

# ---------- 1) list_referral: targeted injects (รักษา keyword ไทยเดิม) ----------
lst = nodes["Code List Referral"]
code = lst["parameters"]["jsCode"]
MIGRATE = "CREATE TABLE IF NOT EXISTS referral_doc_matches (daily_expense_id BIGINT PRIMARY KEY, expense_doc_id BIGINT NOT NULL, matched_by TEXT, matched_at TIMESTAMPTZ DEFAULT NOW());"
# R1: prepend self-migrate
code = code.replace("const query=`SELECT de.id,",
                    "const query=`" + MIGRATE + "\\nSELECT de.id,", 1)
# R2: manual mm-join + COALESCE + match_type
code = code.replace(
  "m.expense_doc_no AS matched_doc_no, m.doc_date AS matched_doc_date FROM daily_expenses de LEFT JOIN LATERAL (SELECT ed.expense_doc_no, ed.doc_date FROM expense_documents ed WHERE",
  "COALESCE(mm.expense_doc_no, m.expense_doc_no) AS matched_doc_no, COALESCE(mm.doc_date, m.doc_date) AS matched_doc_date, CASE WHEN mm.expense_doc_no IS NOT NULL THEN 'manual' WHEN m.expense_doc_no IS NOT NULL THEN 'auto' ELSE NULL END AS match_type, COALESCE(mm.net_to_pay, m.net_to_pay) AS matched_net, COALESCE(mm.wht_amount, m.wht_amount) AS matched_wht FROM daily_expenses de LEFT JOIN LATERAL (SELECT ed2.expense_doc_no, ed2.doc_date, ed2.wht_amount, ed2.net_to_pay FROM referral_doc_matches rdm JOIN expense_documents ed2 ON ed2.expense_doc_id = rdm.expense_doc_id WHERE rdm.daily_expense_id = de.id LIMIT 1) mm ON TRUE LEFT JOIN LATERAL (SELECT ed.expense_doc_no, ed.doc_date, ed.wht_amount, ed.net_to_pay FROM expense_documents ed WHERE",
  1)
# R3: auto LATERAL excludes manually-used docs
code = code.replace(
  "ORDER BY ed.expense_doc_id LIMIT 1) m ON TRUE",
  "AND ed.expense_doc_id NOT IN (SELECT expense_doc_id FROM referral_doc_matches) ORDER BY ed.expense_doc_id LIMIT 1) m ON TRUE",
  1)
lst["parameters"]["jsCode"] = code

# ---------- 2) candidate + match Code ----------
cand_js = r'''const b = $input.first().json.body || {};
const amount = Number(b.amount || 0);
const from = String(b.from || '1900-01-01').slice(0,10);
const to = String(b.to || '2999-12-31').slice(0,10);
function esc(s){ return String(s||'').replace(/'/g,"''"); }
const payTo = esc(b.pay_to || '');
const toks = String(b.pay_to||'').replace(/MR\.|MRS\.|MISS|นาย|นาง|น\.ส\./gi,' ').split(/[\s\-\/.]+/).filter(t=>t.length>=2);
let tok=''; for(const t of toks) if(t.length>tok.length) tok=t;
const tokEsc = esc(tok);
const nameExact = "UPPER(TRIM(BOTH ' -' FROM COALESCE(ed.vendor_name,''))) = UPPER(TRIM(BOTH ' -' FROM '"+payTo+"'))";
const nameLike = tokEsc ? "(ed.vendor_name ILIKE '%"+tokEsc+"%' OR ed.description ILIKE '%"+tokEsc+"%')" : "FALSE";
const sql = `CREATE TABLE IF NOT EXISTS referral_doc_matches (daily_expense_id BIGINT PRIMARY KEY, expense_doc_id BIGINT NOT NULL, matched_by TEXT, matched_at TIMESTAMPTZ DEFAULT NOW());
SELECT ed.expense_doc_id AS id, ed.expense_doc_no AS doc_no, ed.doc_date, ed.vendor_name, ed.total, COALESCE(ed.wht_amount,0) AS wht, COALESCE(ed.net_to_pay, ed.total) AS net, ed.affiliation, COALESCE(ed.description,'') AS description
FROM expense_documents ed
WHERE COALESCE(ed.status,'') <> 'cancelled'
  AND ed.total = ${amount}
  AND ed.doc_date >= '${from}' AND ed.doc_date <= '${to}'
  AND ed.expense_doc_id NOT IN (SELECT expense_doc_id FROM referral_doc_matches)
ORDER BY (${nameExact}) DESC, (${nameLike}) DESC, ed.doc_date`;
return [{ json: { query: sql } }];'''

match_js = r'''const b = $input.first().json.body || {};
const deId = Number(b.daily_expense_id || 0);
const edId = Number(b.expense_doc_id || 0);
const by = String(b.matched_by || 'system').replace(/'/g, "''");
let sql = "CREATE TABLE IF NOT EXISTS referral_doc_matches (daily_expense_id BIGINT PRIMARY KEY, expense_doc_id BIGINT NOT NULL, matched_by TEXT, matched_at TIMESTAMPTZ DEFAULT NOW());\n";
if (!deId) {
  sql += "SELECT false AS success, 'missing daily_expense_id' AS error;";
} else if (!edId) {
  sql += `DELETE FROM referral_doc_matches WHERE daily_expense_id = ${deId};\nSELECT true AS success, 'cleared' AS op;`;
} else {
  sql += `INSERT INTO referral_doc_matches (daily_expense_id, expense_doc_id, matched_by) VALUES (${deId}, ${edId}, '${by}') ON CONFLICT (daily_expense_id) DO UPDATE SET expense_doc_id=EXCLUDED.expense_doc_id, matched_by=EXCLUDED.matched_by, matched_at=NOW();\nSELECT true AS success, 'saved' AS op;`;
}
return [{ json: { query: sql } }];'''

def code_node(nid, name, js, pos):
    return {"parameters": {"jsCode": js}, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": pos, "id": nid, "name": name}

new_nodes = [
    code_node("ref-cand-code", "Code Referral Candidates", cand_js, [460, 520]),
    code_node("ref-match-code", "Code Referral Match", match_js, [460, 700]),
]
existing = {n["name"] for n in wf["nodes"]}
for nn in new_nodes:
    if nn["name"] not in existing:
        wf["nodes"].append(nn)
# re-run safe: อัปเดต jsCode แม้ node มีอยู่แล้ว
_js = {"Code Referral Candidates": cand_js, "Code Referral Match": match_js}
for n in wf["nodes"]:
    if n["name"] in _js:
        n["parameters"]["jsCode"] = _js[n["name"]]

# ---------- 3) switch rules ----------
def rule(cid, action, key):
    return {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{"id": cid, "leftValue": "={{ $json.body.action }}", "rightValue": action,
                            "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
            "renameOutput": True, "outputKey": key}
sw = nodes["Switch Action"]
vals = sw["parameters"]["rules"]["values"]
have = {v["conditions"]["conditions"][0]["rightValue"] for v in vals}
for cid, act, key in [("rf2", "get_referral_candidates", "candidates"), ("rf3", "set_referral_match", "setmatch")]:
    if act not in have:
        vals.append(rule(cid, act, key))

# ---------- 4) connections ----------
sw_main = conns["Switch Action"]["main"]
present = {c[0]["node"] for c in sw_main if c}
for tgt in ["Code Referral Candidates", "Code Referral Match"]:
    if tgt not in present:
        sw_main.append([{"node": tgt, "type": "main", "index": 0}])
# both new Code nodes -> shared PG Execute
for src in ["Code Referral Candidates", "Code Referral Match"]:
    conns[src] = {"main": [[{"node": "PG Execute", "type": "main", "index": 0}]]}

assert len(vals) == len(sw_main), "rules %d != outputs %d" % (len(vals), len(sw_main))
with io.open(path, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

# verify
with io.open(path, encoding="utf-8") as f:
    back = json.load(f)
lc = [n for n in back["nodes"] if n["name"]=="Code List Referral"][0]["parameters"]["jsCode"]
print("switch rules/outputs:", len(vals), len(sw_main))
print("list has manual override:", ("referral_doc_matches" in lc) and ("match_type" in lc))
print("list self-migrate:", "CREATE TABLE IF NOT EXISTS referral_doc_matches" in lc)
print("nodes:", [n["name"] for n in back["nodes"]])
for nm in ["Code Referral Candidates","Code Referral Match"]:
    c=[n for n in back["nodes"] if n["name"]==nm][0]["parameters"]["jsCode"]
    bad=[m.group(0) for m in re.finditer(r".{3}\$.{3}", c) if ("${" not in m.group(0)) and ("$input" not in m.group(0))]
    print("  %s suspicious $: %s" % (nm, bad))
print("DONE")
