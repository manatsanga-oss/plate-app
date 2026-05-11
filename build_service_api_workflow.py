"""
สร้าง workflow ใหม่: ระบบงานบริการ.json
- Webhook POST /service-api
- Switch by body.action
- Actions เริ่มต้น: list_yamaha_repair_invoices
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

# get postgres credentials from existing workflow
acc = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")
acc_wf = json.loads(acc.read_text(encoding='utf-8'))
postgres_creds = None
for n in acc_wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']; break

WEBHOOK_PATH = "service-api"

actions = [
    ("list_yamaha_repair_invoices",
     "SELECT * FROM yamaha_repair_invoices "
     "WHERE (NULLIF(NULLIF('{{ $json.body.branch_code }}',''),'undefined') IS NULL "
     "       OR branch_code = NULLIF(NULLIF('{{ $json.body.branch_code }}',''),'undefined')) "
     "  AND (NULLIF(NULLIF('{{ $json.body.year }}',''),'undefined')::int IS NULL "
     "       OR repair_year = NULLIF(NULLIF('{{ $json.body.year }}',''),'undefined')::int) "
     "  AND (NULLIF(NULLIF('{{ $json.body.month }}',''),'undefined')::int IS NULL "
     "       OR repair_month = NULLIF(NULLIF('{{ $json.body.month }}',''),'undefined')::int) "
     "  AND (NULLIF(NULLIF('{{ $json.body.status }}',''),'undefined') IS NULL "
     "       OR status = NULLIF(NULLIF('{{ $json.body.status }}',''),'undefined')) "
     "  AND (NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') IS NULL OR ("
     "       job_no ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' "
     "    OR customer ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' "
     "    OR chassis_no ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' "
     "    OR engine_no ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' "
     "    OR license_plate ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' "
     "    OR mechanic_name ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' )) "
     "ORDER BY repair_year DESC NULLS LAST, repair_month DESC NULLS LAST, repair_day DESC NULLS LAST, job_no DESC "
     "LIMIT 5000"),
]

nodes = []
connections = {}

WEBHOOK_ID = str(uuid.uuid4())
nodes.append({
    "parameters": {"httpMethod": "POST", "path": WEBHOOK_PATH,
        "responseMode": "responseNode", "options": {"allowedOrigins": "*"}},
    "type": "n8n-nodes-base.webhook", "typeVersion": 2,
    "position": [600, 300], "id": WEBHOOK_ID, "name": "Webhook",
    "webhookId": str(uuid.uuid4()),
})

switch_rules = []
for idx, (key, _) in enumerate(actions):
    switch_rules.append({
        "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{"id": f"sv{idx}",
                "leftValue": "={{ $json.body.action }}", "rightValue": key,
                "operator": {"type": "string", "operation": "equals"}}],
            "combinator": "and"},
        "renameOutput": True, "outputKey": key,
    })

nodes.append({
    "parameters": {"rules": {"values": switch_rules}, "options": {}},
    "type": "n8n-nodes-base.switch", "typeVersion": 3.2,
    "position": [900, 300], "id": str(uuid.uuid4()), "name": "Switch Action",
})

connections["Webhook"] = {"main": [[{"node": "Switch Action", "type": "main", "index": 0}]]}
connections["Switch Action"] = {"main": [[] for _ in actions]}

for idx, (key, query) in enumerate(actions):
    y = 100 + idx * 250
    q_name = f"Q: {key}"
    r_name = f"Respond: {key}"
    pg = {"parameters": {"operation": "executeQuery", "query": query, "options": {}},
        "type": "n8n-nodes-base.postgres", "typeVersion": 2.6,
        "position": [1200, y], "id": str(uuid.uuid4()), "name": q_name,
        "alwaysOutputData": True}
    if postgres_creds: pg["credentials"] = postgres_creds
    nodes.append(pg)
    nodes.append({"parameters": {"respondWith": "json",
        "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
        "options": {"responseHeaders": {"entries": [
            {"name": "Access-Control-Allow-Origin", "value": "*"},
            {"name": "Access-Control-Allow-Methods", "value": "POST, OPTIONS"},
            {"name": "Access-Control-Allow-Headers", "value": "Content-Type"}]}}},
        "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5,
        "position": [1500, y], "id": str(uuid.uuid4()), "name": r_name})
    connections["Switch Action"]["main"][idx].append({"node": q_name, "type": "main", "index": 0})
    connections[q_name] = {"main": [[{"node": r_name, "type": "main", "index": 0}]]}

workflow = {"name": "ระบบงานบริการ", "nodes": nodes, "pinData": {},
    "connections": connections, "active": False,
    "settings": {"executionOrder": "v1"},
    "versionId": str(uuid.uuid4()),
    "meta": {"templateCredsSetupCompleted": True},
    "id": str(uuid.uuid4()), "tags": []}

dst = Path(r"C:/Users/manat/OneDrive/New folder/ระบบงานบริการ.json")
dst.write_text(json.dumps(workflow, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: built {dst}")
print(f"     nodes: {len(nodes)}, actions: {len(actions)}")
print(f"     webhook path: /{WEBHOOK_PATH}")
