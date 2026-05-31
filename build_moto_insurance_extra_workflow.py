"""
สร้าง workflow ใหม่: Moto Insurance Extra API.json
- Webhook POST /moto-insurance-extra-api
- 4 actions: list / save / delete motoinsurance_extra + list_other_income_receipts
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

# postgres credentials จาก Registrations API
ref = Path(r"C:/Users/manat/OneDrive/New folder/Registrations API.json")
ref_wf = json.loads(ref.read_text(encoding='utf-8'))
postgres_creds = None
for n in ref_wf['nodes']:
    if n['type']=='n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']; break

WEBHOOK_PATH = "moto-insurance-extra-api"

actions = [
    ("list_motoinsurance_extra",
     "SELECT id, expense_type, original_policy_no, expense_amount, payment_receipt_no, note, active, "
     "billing_doc_no, billed_at, paid_doc_no, paid_at, created_at "
     "FROM motoinsurance_extra_expenses "
     "WHERE (NULLIF(NULLIF('{{ $json.body.include_inactive }}',''),'undefined') IS NOT NULL OR active = TRUE) "
     "  AND (NULLIF(NULLIF('{{ $json.body.date_from }}',''),'undefined')::date IS NULL "
     "       OR created_at::date >= NULLIF(NULLIF('{{ $json.body.date_from }}',''),'undefined')::date) "
     "  AND (NULLIF(NULLIF('{{ $json.body.date_to }}',''),'undefined')::date IS NULL "
     "       OR created_at::date <= NULLIF(NULLIF('{{ $json.body.date_to }}',''),'undefined')::date) "
     "  AND (NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') IS NULL OR ("
     "       original_policy_no ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' "
     "    OR payment_receipt_no ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' "
     "    OR expense_type ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' )) "
     "ORDER BY created_at DESC LIMIT 1000"),

    ("save_motoinsurance_extra",
     "INSERT INTO motoinsurance_extra_expenses(id, expense_type, original_policy_no, expense_amount, payment_receipt_no, note, active, created_by, created_at) "
     "VALUES ("
     "  CASE WHEN NULLIF('{{ $json.body.id }}','')::int IS NULL THEN nextval('motoinsurance_extra_expenses_id_seq') ELSE NULLIF('{{ $json.body.id }}','')::int END, "
     "  '{{ $json.body.expense_type }}', "
     "  NULLIF(NULLIF('{{ $json.body.original_policy_no }}',''),'undefined')::text, "
     "  {{ $json.body.expense_amount }}::numeric, "
     "  NULLIF(NULLIF('{{ $json.body.payment_receipt_no }}',''),'undefined')::text, "
     "  NULLIF(NULLIF('{{ $json.body.note }}',''),'undefined')::text, "
     "  TRUE, "
     "  NULLIF(NULLIF('{{ $json.body.created_by }}',''),'undefined')::text, NOW()"
     ") "
     "ON CONFLICT (id) DO UPDATE SET "
     "  expense_type = EXCLUDED.expense_type, "
     "  original_policy_no = EXCLUDED.original_policy_no, "
     "  expense_amount = EXCLUDED.expense_amount, "
     "  payment_receipt_no = EXCLUDED.payment_receipt_no, "
     "  note = EXCLUDED.note "
     "RETURNING id, expense_type, expense_amount"),

    ("delete_motoinsurance_extra",
     "UPDATE motoinsurance_extra_expenses SET active = FALSE WHERE id = {{ $json.body.id }} RETURNING id"),

    ("list_other_income_receipts",
     "SELECT i.id AS item_id, i.receipt_no, i.line_order, i.description, i.line_amount, i.fee, i.total, "
     "       r.receipt_date, r.customer_name, r.branch_code "
     "FROM other_income_items i "
     "LEFT JOIN other_income r ON r.receipt_no = i.receipt_no "
     "WHERE (NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') IS NULL OR ("
     "       i.receipt_no ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' "
     "    OR i.description ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' "
     "    OR r.customer_name ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' )) "
     "  AND (NULLIF(NULLIF('{{ $json.body.date_from }}',''),'undefined')::date IS NULL "
     "       OR r.receipt_date >= NULLIF(NULLIF('{{ $json.body.date_from }}',''),'undefined')::date) "
     "  AND (NULLIF(NULLIF('{{ $json.body.date_to }}',''),'undefined')::date IS NULL "
     "       OR r.receipt_date <= NULLIF(NULLIF('{{ $json.body.date_to }}',''),'undefined')::date) "
     "ORDER BY r.receipt_date DESC NULLS LAST, i.receipt_no DESC, i.line_order LIMIT 500"),
]

nodes = []
connections = {}

nodes.append({
    "parameters": {"httpMethod": "POST", "path": WEBHOOK_PATH,
        "responseMode": "responseNode", "options": {"allowedOrigins": "*"}},
    "type": "n8n-nodes-base.webhook", "typeVersion": 2,
    "position": [600, 300], "id": str(uuid.uuid4()), "name": "Webhook",
    "webhookId": str(uuid.uuid4()),
})

switch_rules = []
for idx, (key, _) in enumerate(actions):
    switch_rules.append({
        "conditions": {"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict","version":2},
            "conditions":[{"id":f"miex{idx}","leftValue":"={{ $json.body.action }}","rightValue":key,
                "operator":{"type":"string","operation":"equals"}}],"combinator":"and"},
        "renameOutput":True,"outputKey":key,
    })

nodes.append({
    "parameters": {"rules":{"values":switch_rules},"options":{}},
    "type":"n8n-nodes-base.switch","typeVersion":3.2,
    "position":[900,300],"id":str(uuid.uuid4()),"name":"Switch Action",
})

connections["Webhook"] = {"main":[[{"node":"Switch Action","type":"main","index":0}]]}
connections["Switch Action"] = {"main":[[] for _ in actions]}

for idx, (key, query) in enumerate(actions):
    y = 100 + idx*250
    q_name = f"Q: {key}"; r_name = f"Respond: {key}"
    pg = {"parameters":{"operation":"executeQuery","query":query,"options":{}},
        "type":"n8n-nodes-base.postgres","typeVersion":2.6,
        "position":[1200,y],"id":str(uuid.uuid4()),"name":q_name,
        "alwaysOutputData":True}
    if postgres_creds: pg["credentials"] = postgres_creds
    nodes.append(pg)
    nodes.append({"parameters":{"respondWith":"json",
        "responseBody":"={{ JSON.stringify($input.all().map(i => i.json)) }}",
        "options":{"responseHeaders":{"entries":[
            {"name":"Access-Control-Allow-Origin","value":"*"},
            {"name":"Access-Control-Allow-Methods","value":"POST, OPTIONS"},
            {"name":"Access-Control-Allow-Headers","value":"Content-Type"}]}}},
        "type":"n8n-nodes-base.respondToWebhook","typeVersion":1.5,
        "position":[1500,y],"id":str(uuid.uuid4()),"name":r_name})
    connections["Switch Action"]["main"][idx].append({"node":q_name,"type":"main","index":0})
    connections[q_name] = {"main":[[{"node":r_name,"type":"main","index":0}]]}

workflow = {"name":"Moto Insurance Extra API","nodes":nodes,"pinData":{},
    "connections":connections,"active":False,
    "settings":{"executionOrder":"v1"},
    "versionId":str(uuid.uuid4()),
    "meta":{"templateCredsSetupCompleted":True},
    "id":str(uuid.uuid4()),"tags":[]}

dst = Path(r"C:/Users/manat/OneDrive/New folder/Moto Insurance Extra API.json")
dst.write_text(json.dumps(workflow, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: built {dst}")
print(f"     webhook: /{WEBHOOK_PATH}")
print(f"     actions: {len(actions)}")
