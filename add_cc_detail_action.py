"""
เพิ่ม action 'list_credit_card_detail' — รายละเอียดของรายการ "รับชำระบัตรเครดิต" ที่ group ตามวัน
- รับ: receipt_date, account_id
- คืน: รายการ receipt_transfers + daily_receipts สำหรับวันนั้น
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")
dst = src

wf = json.loads(src.read_text(encoding='utf-8'))

# 1. Switch rule
for n in wf['nodes']:
    if n.get('name') == 'Switch Action' and n.get('type') == 'n8n-nodes-base.switch':
        rules = n['parameters']['rules']['values']
        if not any(r.get('outputKey') == 'list_credit_card_detail' for r in rules):
            rules.append({
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                    "conditions": [{
                        "id": "ccdt",
                        "leftValue": "={{ $json.body.action }}",
                        "rightValue": "list_credit_card_detail",
                        "operator": {"type": "string", "operation": "equals"},
                    }],
                    "combinator": "and",
                },
                "renameOutput": True,
                "outputKey": "list_credit_card_detail",
            })
            print("OK: added Switch rule")
        else:
            print("INFO: Switch rule already exists")

postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']
        break

QUERY = (
    "SELECT rt.id, rt.receipt_no, dr.receipt_date, rt.amount, "
    "rt.bank_name, rt.bank_account_no, "
    "dr.note, dr.sale_invoice_no, dr.customer_name, "
    "dr.total_amount AS receipt_total_amount, dr.status "
    "FROM receipt_transfers rt "
    "JOIN daily_receipts dr ON dr.receipt_no = rt.receipt_no "
    "JOIN bank_accounts ba ON ba.account_no = rt.bank_account_no "
    "WHERE ba.account_id = {{ $json.body.account_id }} "
    "  AND dr.receipt_date = '{{ $json.body.receipt_date }}'::date "
    "  AND COALESCE(dr.status,'ปกติ') <> 'ยกเลิก' "
    "  AND rt.receipt_no NOT LIKE 'SCY10%' "
    "ORDER BY rt.amount DESC"
)

existing = {n['name'] for n in wf['nodes']}
base_y = 12000

if 'Q: CC Detail' in existing:
    next(n for n in wf['nodes'] if n['name']=='Q: CC Detail')['parameters']['query'] = QUERY
    print("OK: updated Q: CC Detail")
else:
    pg = {
        "parameters": {"operation": "executeQuery", "query": QUERY, "options": {}},
        "type": "n8n-nodes-base.postgres", "typeVersion": 2.6,
        "position": [3000, base_y],
        "id": str(uuid.uuid4()),
        "name": "Q: CC Detail",
    }
    if postgres_creds: pg["credentials"] = postgres_creds
    wf['nodes'].append(pg)
    print("OK: added Q: CC Detail")

RESP = {"respondWith":"json","responseBody":"={{ JSON.stringify($input.all().map(i => i.json)) }}",
    "options":{"responseHeaders":{"entries":[{"name":"Access-Control-Allow-Origin","value":"*"}]}}}
if 'Respond CC Detail' in existing:
    next(n for n in wf['nodes'] if n['name']=='Respond CC Detail')['parameters'] = RESP
    print("OK: updated Respond")
else:
    wf['nodes'].append({
        "parameters": RESP,
        "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5,
        "position": [3300, base_y],
        "id": str(uuid.uuid4()),
        "name": "Respond CC Detail",
    })
    print("OK: added Respond CC Detail")

conns = wf.setdefault('connections', {})
sw_node = next(n for n in wf['nodes'] if n.get('name')=='Switch Action' and n.get('type')=='n8n-nodes-base.switch')
rules = sw_node['parameters']['rules']['values']
out_idx = next(i for i,r in enumerate(rules) if r['outputKey']=='list_credit_card_detail')
sw_conns = conns.setdefault('Switch Action', {}).setdefault('main', [])
while len(sw_conns) <= out_idx: sw_conns.append([])
if not any(t.get('node')=='Q: CC Detail' for t in sw_conns[out_idx]):
    sw_conns[out_idx].append({"node":"Q: CC Detail","type":"main","index":0})
    print(f"OK: connected Switch[{out_idx}]")
if 'Q: CC Detail' not in conns:
    conns['Q: CC Detail'] = {"main":[[{"node":"Respond CC Detail","type":"main","index":0}]]}

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: saved")
