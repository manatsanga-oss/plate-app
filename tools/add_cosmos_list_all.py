# -*- coding: utf-8 -*-
# เพิ่ม action list_cosmos_all — รายการ COSMOS ทั้งหมด (ทุกแผน ทุกสถานะ) กรองช่วงวันที่ (submitted_at)
# ใช้กับแท็บใหม่ "รายการจ่าย" ใน CosmosBillingPage (ดูอย่างเดียว กรองเดือน)
import json, io, shutil

PATH = r"C:\Users\manat\OneDrive\New folder\Registrations API (18).json"
d = json.load(io.open(PATH, encoding="utf-8"))
nodes = {n["name"]: n for n in d["nodes"]}

LIST_ALL_JS = r"""// list_cosmos_all: ทุกแผน ทุกสถานะ + pay_status (pending/billed/paid) — กรองช่วงวันที่บันทึก
const b = $input.first().json.body || {};
const esc = v => String(v == null ? '' : v).replace(/'/g, "''");
const df = esc(b.date_from || '').trim();
const dt = esc(b.date_to || '').trim();
const conds = [];
if (/^\d{4}-\d{2}-\d{2}/.test(df)) conds.push(`s.submitted_at >= '${df}'::date`);
if (/^\d{4}-\d{2}-\d{2}/.test(dt)) conds.push(`s.submitted_at < ('${dt}'::date + INTERVAL '1 day')`);
const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
const query = `SELECT s.id, s.plan, s.app_no, s.invoice_no, s.customer_name, s.chassis_no, s.plan_name,
  COALESCE(NULLIF(s.premium,0), NULLIF(regexp_replace(split_part(split_part(s.plan_name,'*(',2),')',1), '[^0-9.]', '', 'g'), '')::numeric, 0) AS premium,
  s.submitted_at, s.batch_no, s.billing_doc_no, s.paid_doc_no, s.paid_at,
  CASE WHEN s.paid_doc_no IS NOT NULL THEN 'paid' WHEN s.billing_doc_no IS NOT NULL THEN 'billed' ELSE 'pending' END AS pay_status
  FROM cosmos_submissions s ${where} ORDER BY s.plan, s.submitted_at DESC, s.app_no LIMIT 10000`;
return [{ json: { query } }];"""

CRED = {"postgres": {"id": "JLUeyZRAzUeRqlxu", "name": "Postgres account"}}
new_nodes = [
    {"id": "cosmos-all-code", "name": "Code List Cosmos All", "type": "n8n-nodes-base.code", "typeVersion": 2,
     "position": [1337584, 409350], "parameters": {"jsCode": LIST_ALL_JS}},
    {"id": "cosmos-all-pg", "name": "Q: List Cosmos All", "type": "n8n-nodes-base.postgres", "typeVersion": 2.5,
     "position": [1338080, 409350], "parameters": {"operation": "executeQuery", "query": "{{ $json.query }}", "options": {}},
     "credentials": CRED},
    {"id": "cosmos-all-resp", "name": "Respond List Cosmos All", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
     "position": [1338576, 409350],
     "parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
                    "options": {"responseHeaders": {"entries": [
                        {"name": "Access-Control-Allow-Origin", "value": "*"},
                        {"name": "Content-Type", "value": "application/json; charset=utf-8"}]}}}},
]
existing = {n["name"] for n in d["nodes"]}
for n in new_nodes:
    if n["name"] not in existing:
        d["nodes"].append(n)

sw = nodes["Switch Action"]
rules = sw["parameters"]["rules"]["values"]
sw_main = d["connections"]["Switch Action"]["main"]
if not any(r.get("outputKey") == "list_cosmos_all" for r in rules):
    rules.append({"conditions": {"options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
        "conditions": [{"id": "cq-all", "leftValue": "={{ $json.body.action }}", "rightValue": "list_cosmos_all",
                        "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
        "renameOutput": True, "outputKey": "list_cosmos_all"})
    sw_main.append([{"node": "Code List Cosmos All", "type": "main", "index": 0}])

conn = d["connections"]
conn["Code List Cosmos All"] = {"main": [[{"node": "Q: List Cosmos All", "type": "main", "index": 0}]]}
conn["Q: List Cosmos All"] = {"main": [[{"node": "Respond List Cosmos All", "type": "main", "index": 0}]]}

shutil.copyfile(PATH, PATH + ".bak-cosmoslistall")
with io.open(PATH, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print("OK — list_cosmos_all added; rules=%d outputs=%d" % (len(rules), len(sw_main)))
