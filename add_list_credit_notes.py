"""
เพิ่ม action 'list_credit_notes' ในWorkflow Accounting API
- เพิ่ม Switch rule
- เพิ่ม Postgres node Q: List Credit Notes
- เพิ่ม Respond node
- ต่อ connection
"""
import json
import uuid
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")
dst = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")

wf = json.loads(src.read_text(encoding='utf-8'))

# ----- 1. เพิ่ม rule ใน Switch Action -----
for n in wf['nodes']:
    if n['name'] == 'Switch Action':
        rules = n['parameters']['rules']['values']
        # ตรวจไม่ให้ซ้ำ
        if not any(r.get('outputKey') == 'list_credit_notes' for r in rules):
            new_rule = {
                "conditions": {
                    "options": {
                        "caseSensitive": True,
                        "leftValue": "",
                        "typeValidation": "strict",
                        "version": 2,
                    },
                    "conditions": [
                        {
                            "id": "aclcn",
                            "leftValue": "={{ $json.body.action }}",
                            "rightValue": "list_credit_notes",
                            "operator": {"type": "string", "operation": "equals"},
                        }
                    ],
                    "combinator": "and",
                },
                "renameOutput": True,
                "outputKey": "list_credit_notes",
            }
            rules.append(new_rule)
            print("OK: added Switch rule 'list_credit_notes'")
        else:
            print("INFO: Switch rule already exists")

# ----- 2. หา position ของ Switch Action เพื่อวาง node ใหม่ -----
switch_pos = None
postgres_creds = None
respond_creds = None
for n in wf['nodes']:
    if n['name'] == 'Switch Action':
        switch_pos = n['position']
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']
    if n['type'] == 'n8n-nodes-base.respondToWebhook':
        # ใช้ template จาก node ที่มี
        respond_creds = n.get('credentials')

if not postgres_creds:
    print("WARN: no Postgres credentials found — please set after import")

# ----- 3. เพิ่ม Postgres + Respond nodes (ถ้ายังไม่มี) -----
existing_names = {n['name'] for n in wf['nodes']}

# วางไกลๆ จาก node อื่น
base_y = 3000

if 'Q: List Credit Notes' not in existing_names:
    pg_node = {
        "parameters": {
            "operation": "executeQuery",
            "query": "SELECT cn_id, credit_note_no, credit_note_date, paid_doc_no, billing_doc_nos, vendor_name, amount, category, note, created_by, created_at, status FROM credit_notes_received WHERE status = 'active' AND credit_note_date >= COALESCE(NULLIF('{{ $json.body.date_from }}','')::date, '1900-01-01'::date) AND credit_note_date <= COALESCE(NULLIF('{{ $json.body.date_to }}','')::date, '9999-12-31'::date) ORDER BY credit_note_date DESC, cn_id DESC LIMIT 5000",
            "options": {},
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [3000, base_y],
        "id": str(uuid.uuid4()),
        "name": "Q: List Credit Notes",
    }
    if postgres_creds:
        pg_node["credentials"] = postgres_creds
    wf['nodes'].append(pg_node)
    print("OK: added node 'Q: List Credit Notes'")

RESP_PARAMS = {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
    "options": {
        "responseHeaders": {
            "entries": [
                {"name": "Access-Control-Allow-Origin", "value": "*"}
            ]
        }
    }
}
existing_resp = next((n for n in wf['nodes'] if n['name'] == 'Respond List Credit Notes'), None)
if existing_resp:
    # อัปเดต parameters ให้ตรงกับ Respond node อื่น
    existing_resp['parameters'] = RESP_PARAMS
    print("OK: updated 'Respond List Credit Notes' parameters")
else:
    resp_node = {
        "parameters": RESP_PARAMS,
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.5,
        "position": [3300, base_y],
        "id": str(uuid.uuid4()),
        "name": "Respond List Credit Notes",
    }
    wf['nodes'].append(resp_node)
    print("OK: added node 'Respond List Credit Notes'")

# ----- 4. เพิ่ม connections -----
conns = wf.setdefault('connections', {})

# Switch Action → Q: List Credit Notes (output index = ลำดับของ rule ใหม่)
# หา index ของ outputKey='list_credit_notes'
switch_node = next(n for n in wf['nodes'] if n['name'] == 'Switch Action')
rules = switch_node['parameters']['rules']['values']
out_idx = next(i for i, r in enumerate(rules) if r['outputKey'] == 'list_credit_notes')

sw_conns = conns.setdefault('Switch Action', {}).setdefault('main', [])
# ขยาย array ถ้าจำเป็น
while len(sw_conns) <= out_idx:
    sw_conns.append([])
target_added = any(t.get('node') == 'Q: List Credit Notes' for t in sw_conns[out_idx])
if not target_added:
    sw_conns[out_idx].append({"node": "Q: List Credit Notes", "type": "main", "index": 0})
    print(f"OK: connected Switch[{out_idx}] -> Q: List Credit Notes")

# Q: List Credit Notes → Respond List Credit Notes
if 'Q: List Credit Notes' not in conns:
    conns['Q: List Credit Notes'] = {"main": [[{"node": "Respond List Credit Notes", "type": "main", "index": 0}]]}
    print("OK: connected Q: List Credit Notes -> Respond List Credit Notes")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: Saved to {dst}")
print(f"Total nodes: {len(wf['nodes'])}")
