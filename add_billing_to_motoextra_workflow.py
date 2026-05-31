"""
ย้าย actions วางบิล พรบ. จาก Registrations API → Moto Insurance Extra API
- get_insurance_billing_data (code + postgres)
- save_insurance_billing
- cancel_insurance_billing
- cancel_insurance_billing_batch
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src_reg = Path(r"C:/Users/manat/OneDrive/New folder/Registrations API.json")
src_dst = Path(r"C:/Users/manat/OneDrive/New folder/Moto Insurance Extra API.json")

reg = json.loads(src_reg.read_text(encoding='utf-8'))
dst = json.loads(src_dst.read_text(encoding='utf-8'))

postgres_creds = None
for n in dst['nodes']:
    if n['type']=='n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']; break
if not postgres_creds:
    for n in reg['nodes']:
        if n['type']=='n8n-nodes-base.postgres' and 'credentials' in n:
            postgres_creds = n['credentials']; break

# extract code-based actions from registrations: copy js code into new code nodes in dst
ACTIONS_TO_MOVE = {
    'get_insurance_billing_data': ('Code Insurance Billing List SQL', 'Postgres Insurance Billing List'),
    'save_insurance_billing':     ('Code Save Insurance Billing',      'Postgres Save Insurance Billing'),
    'cancel_insurance_billing':   ('Code Cancel Insurance Billing',    'Postgres Cancel Insurance Billing'),
    'cancel_insurance_billing_batch': ('Code Cancel Insurance Billing Batch', 'Postgres Cancel Insurance Billing Batch'),
}

# get switch in dst
sw = next(n for n in dst['nodes'] if n.get('type')=='n8n-nodes-base.switch')
rules = sw['parameters']['rules']['values']
connections = dst.setdefault('connections', {})
sw_conns = connections.setdefault('Switch Action', {}).setdefault('main', [])

base_x = 1500
base_y = 1500

for offset, (key, (code_name, pg_name)) in enumerate(ACTIONS_TO_MOVE.items()):
    # add Switch rule
    if not any(r.get('outputKey')==key for r in rules):
        rules.append({
            "conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict","version":2},
                "conditions":[{"id":f"ib{offset}","leftValue":"={{ $json.body.action }}","rightValue":key,
                    "operator":{"type":"string","operation":"equals"}}],"combinator":"and"},
            "renameOutput":True,"outputKey":key,
        })
    idx = next(i for i,r in enumerate(rules) if r['outputKey']==key)

    # get jsCode from reg
    code_n = next((x for x in reg['nodes'] if x['name']==code_name), None)
    if not code_n:
        print(f"WARN: {code_name} not found in reg"); continue
    js = code_n['parameters']['jsCode']

    # create new nodes in dst
    y = base_y + offset*350
    new_code_name = f"Code: {key}"
    new_q_name = f"Q: {key}"
    new_r_name = f"Respond: {key}"

    existing = {n['name'] for n in dst['nodes']}
    if new_code_name not in existing:
        dst['nodes'].append({
            "parameters":{"jsCode": js},
            "type":"n8n-nodes-base.code","typeVersion":2,
            "position":[base_x, y],"id":str(uuid.uuid4()),"name":new_code_name,
        })
    else:
        next(n for n in dst['nodes'] if n['name']==new_code_name)['parameters']['jsCode'] = js
    if new_q_name not in existing:
        pg = {"parameters":{"operation":"executeQuery","query":"={{ $json.query }}","options":{}},
            "type":"n8n-nodes-base.postgres","typeVersion":2.6,
            "position":[base_x+300, y],"id":str(uuid.uuid4()),"name":new_q_name,"alwaysOutputData":True}
        if postgres_creds: pg["credentials"] = postgres_creds
        dst['nodes'].append(pg)
    if new_r_name not in existing:
        dst['nodes'].append({"parameters":{"respondWith":"json",
            "responseBody":"={{ JSON.stringify($input.all().map(i => i.json)) }}",
            "options":{"responseHeaders":{"entries":[
                {"name":"Access-Control-Allow-Origin","value":"*"},
                {"name":"Access-Control-Allow-Methods","value":"POST, OPTIONS"},
                {"name":"Access-Control-Allow-Headers","value":"Content-Type"}]}}},
            "type":"n8n-nodes-base.respondToWebhook","typeVersion":1.5,
            "position":[base_x+600, y],"id":str(uuid.uuid4()),"name":new_r_name})

    # connections
    while len(sw_conns) <= idx: sw_conns.append([])
    if not any(t.get('node')==new_code_name for t in sw_conns[idx]):
        sw_conns[idx].append({"node":new_code_name,"type":"main","index":0})
    if new_code_name not in connections:
        connections[new_code_name] = {"main":[[{"node":new_q_name,"type":"main","index":0}]]}
    if new_q_name not in connections:
        connections[new_q_name] = {"main":[[{"node":new_r_name,"type":"main","index":0}]]}
    print(f"OK: {key}")

src_dst.write_text(json.dumps(dst, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved to {src_dst}")
