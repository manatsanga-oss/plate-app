"""
เพิ่ม action 'list_yamaha_repair_invoices' ใน master-data-api
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/master-data-api.json")
wf = json.loads(src.read_text(encoding='utf-8'))

postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']; break

QUERY = (
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
    "LIMIT 5000"
)

sw = next(n for n in wf['nodes'] if n.get('type')=='n8n-nodes-base.switch')
sw_name = sw.get('name')
rules = sw['parameters']['rules']['values']
key = "list_yamaha_repair_invoices"
if not any(r.get('outputKey')==key for r in rules):
    rules.append({
        "conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict","version":2},
            "conditions":[{"id":"yri","leftValue":"={{ $json.body.action }}","rightValue":key,
                "operator":{"type":"string","operation":"equals"}}],"combinator":"and"},
        "renameOutput":True,"outputKey":key,
    })
    print(f"OK: added Switch '{key}'")
idx = next(i for i,r in enumerate(rules) if r['outputKey']==key)

q_name = f"Q: {key}"
r_name = f"Respond: {key}"
existing = {n['name'] for n in wf['nodes']}
if q_name in existing:
    next(n for n in wf['nodes'] if n['name']==q_name)['parameters']['query'] = QUERY
    print(f"OK: updated {q_name}")
else:
    pg = {"parameters":{"operation":"executeQuery","query":QUERY,"options":{}},
        "type":"n8n-nodes-base.postgres","typeVersion":2.6,
        "position":[1200,11000],"id":str(uuid.uuid4()),"name":q_name,"alwaysOutputData":True}
    if postgres_creds: pg["credentials"] = postgres_creds
    wf['nodes'].append(pg)
    print(f"OK: added {q_name}")

if r_name not in existing:
    wf['nodes'].append({"parameters":{"respondWith":"json",
        "responseBody":"={{ JSON.stringify($input.all().map(i => i.json)) }}",
        "options":{"responseHeaders":{"entries":[
            {"name":"Access-Control-Allow-Origin","value":"*"},
            {"name":"Access-Control-Allow-Methods","value":"POST, OPTIONS"},
            {"name":"Access-Control-Allow-Headers","value":"Content-Type"}]}}},
        "type":"n8n-nodes-base.respondToWebhook","typeVersion":1.5,
        "position":[1500,11000],"id":str(uuid.uuid4()),"name":r_name})

connections = wf.setdefault('connections',{})
sw_conns = connections.setdefault(sw_name,{}).setdefault('main',[])
while len(sw_conns) <= idx: sw_conns.append([])
if not any(t.get('node')==q_name for t in sw_conns[idx]):
    sw_conns[idx].append({"node":q_name,"type":"main","index":0})
if q_name not in connections:
    connections[q_name] = {"main":[[{"node":r_name,"type":"main","index":0}]]}

src.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print("OK: saved")
