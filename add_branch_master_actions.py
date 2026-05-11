"""
เพิ่ม actions branch_master CRUD เข้า workflow Sales Extra Pay API
- list_branches / save_branch / delete_branch
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

dst = Path(r"C:/Users/manat/OneDrive/New folder/Sales Extra Pay API.json")
wf = json.loads(dst.read_text(encoding='utf-8'))

postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']; break

actions = [
    ("list_branches",
     "SELECT branch_code, branch_name, affiliation, sales_target, note, active "
     "FROM branch_master "
     "WHERE (NULLIF(NULLIF('{{ $json.body.include_inactive }}',''),'undefined') IS NOT NULL OR active = TRUE) "
     "ORDER BY branch_code"),
    ("save_branch",
     "INSERT INTO branch_master(branch_code, branch_name, affiliation, sales_target, note, active, created_by, updated_at) "
     "VALUES ("
     "  '{{ $json.body.branch_code }}', "
     "  NULLIF(NULLIF('{{ $json.body.branch_name }}',''),'undefined')::text, "
     "  NULLIF(NULLIF('{{ $json.body.affiliation }}',''),'undefined')::text, "
     "  NULLIF(NULLIF('{{ $json.body.sales_target }}',''),'undefined')::int, "
     "  NULLIF(NULLIF('{{ $json.body.note }}',''),'undefined')::text, "
     "  COALESCE(NULLIF(NULLIF('{{ $json.body.active }}',''),'undefined')::boolean, TRUE), "
     "  NULLIF(NULLIF('{{ $json.body.created_by }}',''),'undefined')::text, NOW()"
     ") "
     "ON CONFLICT (branch_code) DO UPDATE SET "
     "  branch_name = EXCLUDED.branch_name, affiliation = EXCLUDED.affiliation, "
     "  sales_target = EXCLUDED.sales_target, note = EXCLUDED.note, "
     "  active = EXCLUDED.active, updated_at = NOW() "
     "RETURNING branch_code, branch_name, sales_target"),
    ("delete_branch",
     "UPDATE branch_master SET active = FALSE, updated_at = NOW() "
     "WHERE branch_code = '{{ $json.body.branch_code }}' RETURNING branch_code"),
]

sw = next(n for n in wf['nodes'] if n.get('name')=='Switch Action' and n.get('type')=='n8n-nodes-base.switch')
rules = sw['parameters']['rules']['values']
connections = wf.setdefault('connections', {})
sw_conns = connections.setdefault('Switch Action', {}).setdefault('main', [])

base_y = 5000
for offset, (key, query) in enumerate(actions):
    if not any(r.get('outputKey')==key for r in rules):
        rules.append({
            "conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict","version":2},
                "conditions":[{"id":f"br{offset}","leftValue":"={{ $json.body.action }}","rightValue":key,
                    "operator":{"type":"string","operation":"equals"}}],"combinator":"and"},
            "renameOutput":True,"outputKey":key,
        })
    idx = next(i for i,r in enumerate(rules) if r['outputKey']==key)
    y = base_y + offset*250
    q_name = f"Q: {key}"
    r_name = f"Respond: {key}"

    existing = {n['name'] for n in wf['nodes']}
    if q_name in existing:
        next(n for n in wf['nodes'] if n['name']==q_name)['parameters']['query'] = query
    else:
        node = {"parameters":{"operation":"executeQuery","query":query,"options":{}},
            "type":"n8n-nodes-base.postgres","typeVersion":2.6,
            "position":[1200,y],"id":str(uuid.uuid4()),"name":q_name,"alwaysOutputData":True}
        if postgres_creds: node["credentials"] = postgres_creds
        wf['nodes'].append(node)
    if r_name not in existing:
        wf['nodes'].append({"parameters":{"respondWith":"json",
            "responseBody":"={{ JSON.stringify($input.all().map(i => i.json)) }}",
            "options":{"responseHeaders":{"entries":[
                {"name":"Access-Control-Allow-Origin","value":"*"},
                {"name":"Access-Control-Allow-Methods","value":"POST, OPTIONS"},
                {"name":"Access-Control-Allow-Headers","value":"Content-Type"}]}}},
            "type":"n8n-nodes-base.respondToWebhook","typeVersion":1.5,
            "position":[1500,y],"id":str(uuid.uuid4()),"name":r_name})

    while len(sw_conns) <= idx: sw_conns.append([])
    if not any(t.get('node')==q_name for t in sw_conns[idx]):
        sw_conns[idx].append({"node":q_name,"type":"main","index":0})
    if q_name not in connections:
        connections[q_name] = {"main":[[{"node":r_name,"type":"main","index":0}]]}
    print(f"OK: {key}")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print("OK: saved")
