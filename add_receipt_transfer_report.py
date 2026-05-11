"""
เพิ่ม action 'list_receipt_transfer_report' ใน Accounting API
- daily_receipts JOIN receipt_transfers
- กรองช่วงวันที่ + เฉพาะรายการเงินโอน (มี record ใน receipt_transfers)
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
        if not any(r.get('outputKey') == 'list_receipt_transfer_report' for r in rules):
            rules.append({
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                    "conditions": [{
                        "id": "rtrep",
                        "leftValue": "={{ $json.body.action }}",
                        "rightValue": "list_receipt_transfer_report",
                        "operator": {"type": "string", "operation": "equals"},
                    }],
                    "combinator": "and",
                },
                "renameOutput": True,
                "outputKey": "list_receipt_transfer_report",
            })
            print("OK: added Switch rule")
        else:
            print("INFO: Switch rule already exists")

# 2. credentials
postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']
        break

# 3. Build query
QUERY = (
    "SELECT rt.id, rt.receipt_no, "
    "dr.receipt_date AS transfer_date, rt.amount, "
    "rt.bank_name, rt.bank_account_no, "
    "dr.note, dr.sale_invoice_no, dr.customer_name, "
    "dr.total_amount AS receipt_total_amount, dr.status, dr.receipt_date "
    "FROM receipt_transfers rt "
    "JOIN daily_receipts dr ON dr.receipt_no = rt.receipt_no "
    "WHERE dr.receipt_date >= COALESCE(NULLIF('{{ $json.body.date_from }}','')::date, '1900-01-01'::date) "
    "  AND dr.receipt_date <= COALESCE(NULLIF('{{ $json.body.date_to }}','')::date, '9999-12-31'::date) "
    "  AND COALESCE(dr.status, 'ปกติ') <> 'ยกเลิก' "
    "  AND rt.receipt_no NOT LIKE 'SCY10%' "
    "ORDER BY dr.receipt_date DESC, rt.id DESC "
    "LIMIT 5000"
)

existing = {n['name'] for n in wf['nodes']}
base_y = 11000

if 'Q: Receipt Transfer Report' in existing:
    nd = next(n for n in wf['nodes'] if n['name'] == 'Q: Receipt Transfer Report')
    nd['parameters']['query'] = QUERY
    print("OK: updated Q node")
else:
    pg = {
        "parameters": {"operation": "executeQuery", "query": QUERY, "options": {}},
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [3000, base_y],
        "id": str(uuid.uuid4()),
        "name": "Q: Receipt Transfer Report",
    }
    if postgres_creds:
        pg["credentials"] = postgres_creds
    wf['nodes'].append(pg)
    print("OK: added Q node")

# 4. Respond
RESP = {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
    "options": {"responseHeaders": {"entries": [{"name": "Access-Control-Allow-Origin", "value": "*"}]}}
}
if 'Respond Receipt Transfer Report' in existing:
    nd = next(n for n in wf['nodes'] if n['name'] == 'Respond Receipt Transfer Report')
    nd['parameters'] = RESP
    print("OK: updated Respond")
else:
    wf['nodes'].append({
        "parameters": RESP,
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.5,
        "position": [3300, base_y],
        "id": str(uuid.uuid4()),
        "name": "Respond Receipt Transfer Report",
    })
    print("OK: added Respond")

# 5. Connections
conns = wf.setdefault('connections', {})
sw_node = next(n for n in wf['nodes'] if n.get('name') == 'Switch Action' and n.get('type') == 'n8n-nodes-base.switch')
rules = sw_node['parameters']['rules']['values']
out_idx = next(i for i, r in enumerate(rules) if r['outputKey'] == 'list_receipt_transfer_report')
sw_conns = conns.setdefault('Switch Action', {}).setdefault('main', [])
while len(sw_conns) <= out_idx:
    sw_conns.append([])
if not any(t.get('node') == 'Q: Receipt Transfer Report' for t in sw_conns[out_idx]):
    sw_conns[out_idx].append({"node": "Q: Receipt Transfer Report", "type": "main", "index": 0})
    print(f"OK: connected Switch[{out_idx}] -> Q")

if 'Q: Receipt Transfer Report' not in conns:
    conns['Q: Receipt Transfer Report'] = {"main": [[{"node": "Respond Receipt Transfer Report", "type": "main", "index": 0}]]}
    print("OK: connected Q -> Respond")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved to {dst}")
