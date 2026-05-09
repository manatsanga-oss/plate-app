"""
เพิ่ม action 'update_yamaha_po' ใน Yamaha Spare Parts API
- UPDATE เฉพาะ vendor_po_no ไม่กระทบ status
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

# ใช้ไฟล์ล่าสุด
src = Path(r"C:/Users/manat/OneDrive/New folder/Yamaha Spare Parts API (1).json")
dst = Path(r"C:/Users/manat/OneDrive/New folder/Yamaha Spare Parts API (2) - update_po.json")

wf = json.loads(src.read_text(encoding='utf-8'))

# ----- 1. Switch rule (Yamaha = ไม่มี outputKey ใช้ index) -----
sw_rule_added_idx = None
for n in wf['nodes']:
    if n.get('type') == 'n8n-nodes-base.switch':
        rules = n['parameters'].get('rules', {}).get('values', [])
        # ตรวจว่ามีอยู่แล้วไหม โดยดู rightValue ใน conditions
        def get_action(r):
            try:
                return r['conditions']['conditions'][0]['rightValue']
            except (KeyError, IndexError):
                return None
        existing_actions = [get_action(r) for r in rules]
        if 'update_yamaha_po' not in existing_actions:
            new_id = "r" + str(len(rules) + 1).zfill(3)
            rules.append({
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                    "conditions": [{
                        "leftValue": "={{ $json.body.action }}",
                        "rightValue": "update_yamaha_po",
                        "operator": {"type": "string", "operation": "equals"},
                        "id": new_id,
                    }],
                    "combinator": "and",
                },
            })
            sw_rule_added_idx = len(rules) - 1
            print(f"OK: added Switch rule 'update_yamaha_po' (index {sw_rule_added_idx}) to {n['name']}")
        else:
            sw_rule_added_idx = existing_actions.index('update_yamaha_po')
            print(f"INFO: Switch rule already exists at index {sw_rule_added_idx}")
        break

# ----- 2. Postgres credentials -----
postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']
        break

# ----- 3. Add Postgres + Respond -----
existing = {n['name'] for n in wf['nodes']}
base_y = 5000

if 'Update Yamaha PO' not in existing:
    pg = {
        "parameters": {
            "operation": "executeQuery",
            "query": "UPDATE yamaha_spare_orders SET vendor_po_no='{{ $json.body.vendor_po_no }}' WHERE order_id={{ $json.body.order_id }} RETURNING order_id, vendor_po_no",
            "options": {},
        },
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [3000, base_y],
        "id": str(uuid.uuid4()),
        "name": "Update Yamaha PO",
    }
    if postgres_creds:
        pg["credentials"] = postgres_creds
    wf['nodes'].append(pg)
    print("OK: added 'Update Yamaha PO' node")

if 'Respond Update Yamaha PO' not in existing:
    resp = {
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ JSON.stringify($input.first().json) }}",
            "options": {"responseHeaders": {"entries": [{"name": "Access-Control-Allow-Origin", "value": "*"}]}}
        },
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.5,
        "position": [3300, base_y],
        "id": str(uuid.uuid4()),
        "name": "Respond Update Yamaha PO",
    }
    wf['nodes'].append(resp)
    print("OK: added 'Respond Update Yamaha PO' node")

# ----- 4. Connections -----
conns = wf.setdefault('connections', {})
sw_node = next((n for n in wf['nodes'] if n.get('type') == 'n8n-nodes-base.switch'), None)
if sw_node and sw_rule_added_idx is not None:
    sw_name = sw_node['name']
    sw_conns = conns.setdefault(sw_name, {}).setdefault('main', [])
    while len(sw_conns) <= sw_rule_added_idx:
        sw_conns.append([])
    if not any(t.get('node') == 'Update Yamaha PO' for t in sw_conns[sw_rule_added_idx]):
        sw_conns[sw_rule_added_idx].append({"node": "Update Yamaha PO", "type": "main", "index": 0})
        print(f"OK: connected {sw_name}[{sw_rule_added_idx}] -> Update Yamaha PO")

if 'Update Yamaha PO' not in conns:
    conns['Update Yamaha PO'] = {"main": [[{"node": "Respond Update Yamaha PO", "type": "main", "index": 0}]]}
    print("OK: connected Update Yamaha PO -> Respond")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved to {dst}")
