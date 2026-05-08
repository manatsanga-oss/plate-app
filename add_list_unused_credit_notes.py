"""
เพิ่ม action 'list_unused_credit_notes' ใน Accounting API
- คืน credit_notes_received ที่ status='active' และไม่อยู่ใน
  expense_payment_breakdowns AND ไม่อยู่ใน income_payment_breakdowns
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")
dst = src

wf = json.loads(src.read_text(encoding='utf-8'))

# 1. เพิ่ม Switch rule
for n in wf['nodes']:
    if n['name'] == 'Switch Action':
        rules = n['parameters']['rules']['values']
        if not any(r.get('outputKey') == 'list_unused_credit_notes' for r in rules):
            rules.append({
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                    "conditions": [{
                        "id": "aclucn",
                        "leftValue": "={{ $json.body.action }}",
                        "rightValue": "list_unused_credit_notes",
                        "operator": {"type": "string", "operation": "equals"},
                    }],
                    "combinator": "and",
                },
                "renameOutput": True,
                "outputKey": "list_unused_credit_notes",
            })
            print("OK: added Switch rule 'list_unused_credit_notes'")
        else:
            print("INFO: Switch rule already exists")

# 2. หา postgres credentials
postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']
        break

# 3. เพิ่ม/อัปเดต Postgres node
PG_QUERY = (
    "SELECT cn.cn_id, cn.credit_note_no, cn.credit_note_date, cn.paid_doc_no, "
    "cn.vendor_name, cn.amount, cn.note "
    "FROM credit_notes_received cn "
    "WHERE cn.status = 'active' "
    "  AND NOT EXISTS (SELECT 1 FROM income_payment_breakdowns ipb WHERE ipb.credit_note_no = cn.credit_note_no) "
    "ORDER BY cn.credit_note_date DESC, cn.cn_id DESC LIMIT 1000"
)
existing_pg = next((n for n in wf['nodes'] if n['name'] == 'Q: List Unused Credit Notes'), None)
if existing_pg:
    existing_pg['parameters']['query'] = PG_QUERY
    print("OK: updated Q: List Unused Credit Notes query")
else:
    pg = {
        "parameters": {
            "operation": "executeQuery",
            "query": PG_QUERY,
            "options": {},
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [3000, 3500],
        "id": str(uuid.uuid4()),
        "name": "Q: List Unused Credit Notes",
    }
    if postgres_creds:
        pg["credentials"] = postgres_creds
    wf['nodes'].append(pg)
    print("OK: added Q: List Unused Credit Notes")

# 4. เพิ่ม Respond node
RESP = {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
    "options": {"responseHeaders": {"entries": [{"name": "Access-Control-Allow-Origin", "value": "*"}]}}
}
existing_resp = next((n for n in wf['nodes'] if n['name'] == 'Respond List Unused Credit Notes'), None)
if existing_resp:
    existing_resp['parameters'] = RESP
    print("OK: updated Respond List Unused Credit Notes parameters")
else:
    wf['nodes'].append({
        "parameters": RESP,
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.5,
        "position": [3300, 3500],
        "id": str(uuid.uuid4()),
        "name": "Respond List Unused Credit Notes",
    })
    print("OK: added Respond List Unused Credit Notes")

# 5. ต่อ connections
conns = wf.setdefault('connections', {})
sw_node = next(n for n in wf['nodes'] if n['name'] == 'Switch Action')
rules = sw_node['parameters']['rules']['values']
out_idx = next(i for i, r in enumerate(rules) if r['outputKey'] == 'list_unused_credit_notes')

sw_conns = conns.setdefault('Switch Action', {}).setdefault('main', [])
while len(sw_conns) <= out_idx:
    sw_conns.append([])
if not any(t.get('node') == 'Q: List Unused Credit Notes' for t in sw_conns[out_idx]):
    sw_conns[out_idx].append({"node": "Q: List Unused Credit Notes", "type": "main", "index": 0})
    print(f"OK: connected Switch[{out_idx}] -> Q: List Unused Credit Notes")

if 'Q: List Unused Credit Notes' not in conns:
    conns['Q: List Unused Credit Notes'] = {"main": [[{"node": "Respond List Unused Credit Notes", "type": "main", "index": 0}]]}
    print("OK: connected Q -> Respond")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved to {dst}")
