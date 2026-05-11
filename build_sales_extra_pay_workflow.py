"""
สร้าง workflow ใหม่: Sales Extra Pay API.json
- Webhook (POST /sales-extra-pay-api)
- 3 actions: list / save / delete moto_extra_payment_rules
- ใช้ type_id (FK ไปตาราง types ของ master-data-api)
- master data (brand/series/model/type) ใช้ master-data-api เดิม
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

acc = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")
acc_wf = json.loads(acc.read_text(encoding='utf-8'))
postgres_creds = None
for n in acc_wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']; break

WEBHOOK_PATH = "sales-extra-pay-api"

actions = [
    # --- master data (read-only — ใช้ตาราง master เดิม) ---
    ("get_brands",
     "SELECT brand_id, brand_name, status FROM moto_brands "
     "WHERE (NULLIF('{{ $json.body.include_inactive }}','true') IS NOT NULL OR COALESCE(status,'active') = 'active') "
     "ORDER BY brand_name"),
    ("get_series",
     "SELECT series_id, brand_id, vehicle_type_id, series_name, marketing_name, thai_name, engine_cc, status "
     "FROM moto_series "
     "WHERE (NULLIF('{{ $json.body.brand_id }}','')::int IS NULL OR brand_id = NULLIF('{{ $json.body.brand_id }}','')::int) "
     "  AND (NULLIF('{{ $json.body.include_inactive }}','true') IS NOT NULL OR COALESCE(status,'active') = 'active') "
     "ORDER BY series_name"),
    ("get_models",
     "SELECT model_id, series_id, model_code, status FROM moto_models "
     "WHERE (NULLIF('{{ $json.body.series_id }}','')::int IS NULL OR series_id = NULLIF('{{ $json.body.series_id }}','')::int) "
     "  AND (NULLIF('{{ $json.body.include_inactive }}','true') IS NOT NULL OR COALESCE(status,'active') = 'active') "
     "ORDER BY model_code"),
    ("get_types",
     "SELECT type_id, model_id, type_name, model_detail, status FROM moto_types "
     "WHERE (NULLIF('{{ $json.body.model_id }}','')::int IS NULL OR model_id = NULLIF('{{ $json.body.model_id }}','')::int) "
     "  AND (NULLIF('{{ $json.body.include_inactive }}','true') IS NOT NULL OR COALESCE(status,'active') = 'active') "
     "ORDER BY type_name"),

    # --- extra payment rules ---
    ("list_moto_extra_rules",
     "SELECT r.rule_id, r.type_id, r.payment_type, r.amount, r.effective_date, r.end_date, r.note, r.active, "
     "t.type_name, t.model_id, m.model_code, m.series_id, "
     "s.series_name, s.marketing_name, s.thai_name, s.brand_id, "
     "b.brand_name "
     "FROM moto_extra_payment_rules r "
     "LEFT JOIN moto_types t ON t.type_id = r.type_id "
     "LEFT JOIN moto_models m ON m.model_id = t.model_id "
     "LEFT JOIN moto_series s ON s.series_id = m.series_id "
     "LEFT JOIN moto_brands b ON b.brand_id = s.brand_id "
     "WHERE (NULLIF('{{ $json.body.type_id }}','')::int IS NULL OR r.type_id = NULLIF('{{ $json.body.type_id }}','')::int) "
     "  AND (NULLIF('{{ $json.body.series_id }}','')::int IS NULL OR s.series_id = NULLIF('{{ $json.body.series_id }}','')::int) "
     "  AND (NULLIF('{{ $json.body.brand_id }}','')::int IS NULL OR b.brand_id = NULLIF('{{ $json.body.brand_id }}','')::int) "
     "  AND (NULLIF('{{ $json.body.payment_type }}','') IS NULL OR r.payment_type = '{{ $json.body.payment_type }}') "
     "  AND (NULLIF('{{ $json.body.include_inactive }}','true') IS NOT NULL OR r.active = TRUE) "
     "ORDER BY b.brand_name, s.series_name, m.model_code, t.type_name, r.payment_type, r.effective_date DESC"),

    ("save_moto_extra_rule",
     "INSERT INTO moto_extra_payment_rules(rule_id, type_id, payment_type, amount, effective_date, end_date, note, active, created_by) "
     "VALUES ("
     "  CASE WHEN NULLIF('{{ $json.body.rule_id }}','')::int IS NULL THEN nextval('moto_extra_payment_rules_rule_id_seq') ELSE NULLIF('{{ $json.body.rule_id }}','')::int END, "
     "  {{ $json.body.type_id }}, '{{ $json.body.payment_type }}', "
     "  {{ $json.body.amount }}::numeric, "
     "  '{{ $json.body.effective_date }}'::date, "
     "  NULLIF('{{ $json.body.end_date }}','')::date, "
     "  NULLIF('{{ $json.body.note }}','')::text, "
     "  COALESCE(NULLIF('{{ $json.body.active }}','')::boolean, TRUE), "
     "  NULLIF('{{ $json.body.created_by }}','')::text"
     ") "
     "ON CONFLICT (rule_id) DO UPDATE SET "
     "  amount = EXCLUDED.amount, effective_date = EXCLUDED.effective_date, "
     "  end_date = EXCLUDED.end_date, note = EXCLUDED.note, active = EXCLUDED.active "
     "RETURNING rule_id, type_id, payment_type, amount"),

    ("delete_moto_extra_rule",
     "UPDATE moto_extra_payment_rules SET active = FALSE WHERE rule_id = {{ $json.body.rule_id }} RETURNING rule_id"),
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
            "conditions": [{"id": f"sxr{idx}",
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

workflow = {"name": "Sales Extra Pay API", "nodes": nodes, "pinData": {},
    "connections": connections, "active": False,
    "settings": {"executionOrder": "v1"},
    "versionId": str(uuid.uuid4()),
    "meta": {"templateCredsSetupCompleted": True},
    "id": str(uuid.uuid4()), "tags": []}

dst = Path(r"C:/Users/manat/OneDrive/New folder/Sales Extra Pay API.json")
dst.write_text(json.dumps(workflow, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: built {dst}\n     nodes: {len(nodes)}, actions: {len(actions)}")
