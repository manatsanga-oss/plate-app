"""
เพิ่ม action 'get_receipt_transfer_summary' ใน Accounting API
- รับ receipt_nos[] แล้วคืน aggregated transfer ต่อบัญชี
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")
dst = src

wf = json.loads(src.read_text(encoding='utf-8'))

# 1. Switch rule
for n in wf['nodes']:
    if n['name'] == 'Switch Action':
        rules = n['parameters']['rules']['values']
        if not any(r.get('outputKey') == 'get_receipt_transfer_summary' for r in rules):
            rules.append({
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                    "conditions": [{
                        "id": "acrxts",
                        "leftValue": "={{ $json.body.action }}",
                        "rightValue": "get_receipt_transfer_summary",
                        "operator": {"type": "string", "operation": "equals"},
                    }],
                    "combinator": "and",
                },
                "renameOutput": True,
                "outputKey": "get_receipt_transfer_summary",
            })
            print("OK: added Switch rule")

# 2. credentials
postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']
        break

# 3. Code node — generate query from receipt_nos
CODE = r"""const b = $input.first().json.body || {};
const arr = Array.isArray(b.receipt_nos) ? b.receipt_nos : [];
if (!arr.length) return [{ json: { query: "SELECT NULL::text AS account_no, NULL::text AS bank_name, 0::numeric AS total_amount, 0::int AS receipt_count WHERE FALSE" } }];
const escList = arr.map(v => "'" + String(v).replace(/'/g, "''") + "'").join(',');
// Chain: receipt_no(items) -> chassis_no(items) -> moto_sales.chassis_no -> moto_sales.invoice_no -> daily_receipts.sale_invoice_no -> receipt_transfers
const query = `
SELECT rt.bank_account_no AS account_no, MAX(rt.bank_name) AS bank_name, SUM(rt.amount) AS total_amount, COUNT(DISTINCT dr.receipt_no) AS receipt_count
FROM receipt_transfers rt
JOIN daily_receipts dr ON dr.receipt_no = rt.receipt_no
WHERE dr.status = 'ปกติ'
  AND dr.sale_invoice_no IN (
    SELECT DISTINCT ms.invoice_no
    FROM moto_sales ms
    WHERE UPPER(ms.chassis_no) IN (
      SELECT DISTINCT UPPER(chassis_no)
      FROM registration_submission_items
      WHERE receipt_no IN (${escList}) AND chassis_no IS NOT NULL AND chassis_no <> ''
    )
  )
GROUP BY rt.bank_account_no
ORDER BY total_amount DESC`;
return [{ json: { query } }];"""

existing = {n['name'] for n in wf['nodes']}
base_y = 8000

def set_or_add_code(name, code, x, y):
    if name in existing:
        next(n for n in wf['nodes'] if n['name'] == name)['parameters']['jsCode'] = code
        print(f"OK: updated {name}")
        return
    wf['nodes'].append({
        "parameters": {"jsCode": code},
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [x, y],
        "id": str(uuid.uuid4()),
        "name": name,
    })
    print(f"OK: added {name}")

def set_or_add_pg(name, query, x, y):
    if name in existing:
        next(n for n in wf['nodes'] if n['name'] == name)['parameters']['query'] = query
        print(f"OK: updated {name}")
        return
    nd = {
        "parameters": {"operation": "executeQuery", "query": query, "options": {}},
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [x, y],
        "id": str(uuid.uuid4()),
        "name": name,
    }
    if postgres_creds:
        nd["credentials"] = postgres_creds
    wf['nodes'].append(nd)
    print(f"OK: added {name}")

def set_or_add_resp(name, x, y):
    params = {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
        "options": {"responseHeaders": {"entries": [{"name": "Access-Control-Allow-Origin", "value": "*"}]}}
    }
    if name in existing:
        next(n for n in wf['nodes'] if n['name'] == name)['parameters'] = params
        print(f"OK: updated {name}")
        return
    wf['nodes'].append({
        "parameters": params,
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.5,
        "position": [x, y],
        "id": str(uuid.uuid4()),
        "name": name,
    })
    print(f"OK: added {name}")

set_or_add_code("Code Receipt Transfer Summary", CODE, 2700, base_y)
set_or_add_pg("Q: Receipt Transfer Summary", "{{ $json.query }}", 3000, base_y)
set_or_add_resp("Respond Receipt Transfer Summary", 3300, base_y)

# Connections
conns = wf.setdefault('connections', {})
sw_node = next(n for n in wf['nodes'] if n['name'] == 'Switch Action')
rules = sw_node['parameters']['rules']['values']
out_idx = next(i for i, r in enumerate(rules) if r['outputKey'] == 'get_receipt_transfer_summary')
sw_conns = conns.setdefault('Switch Action', {}).setdefault('main', [])
while len(sw_conns) <= out_idx:
    sw_conns.append([])
if not any(t.get('node') == 'Code Receipt Transfer Summary' for t in sw_conns[out_idx]):
    sw_conns[out_idx].append({"node": "Code Receipt Transfer Summary", "type": "main", "index": 0})
    print(f"OK: connected Switch[{out_idx}]")

if 'Code Receipt Transfer Summary' not in conns:
    conns['Code Receipt Transfer Summary'] = {"main": [[{"node": "Q: Receipt Transfer Summary", "type": "main", "index": 0}]]}
if 'Q: Receipt Transfer Summary' not in conns:
    conns['Q: Receipt Transfer Summary'] = {"main": [[{"node": "Respond Receipt Transfer Summary", "type": "main", "index": 0}]]}

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved")
