"""
เพิ่ม action 'list_registration_summary' ใน Accounting API
- UNION 3 ตาราง tax_invoices_{papao,nakornluang,singchai}
- LATERAL JOIN moto_sales (ตาม chassis_no/engine_no)
- คืน: cost_price, gross_profit, sale info
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
        if not any(r.get('outputKey') == 'list_registration_summary' for r in rules):
            rules.append({
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                    "conditions": [{
                        "id": "acrgs",
                        "leftValue": "={{ $json.body.action }}",
                        "rightValue": "list_registration_summary",
                        "operator": {"type": "string", "operation": "equals"},
                    }],
                    "combinator": "and",
                },
                "renameOutput": True,
                "outputKey": "list_registration_summary",
            })
            print("OK: added Switch rule 'list_registration_summary'")
        else:
            print("INFO: Switch rule already exists")

# 2. postgres credentials
postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']
        break

# 3. Build query: UNION 3 + LATERAL moto_sales
def per_branch(table_name, branch_code):
    return (
        "SELECT '" + branch_code + "' AS branch, t.tax_invoice_no, t.invoice_date, "
        "t.customer_name, t.customer_tax_id, t.chassis_no, t.engine_no, t.model_name, "
        "t.status, "
        "s.id AS sale_id, s.customer_name AS sale_customer_name, s.invoice_no AS sale_invoice_no, "
        "s.sale_date, s.finance_company AS sale_finance_company, "
        "COALESCE(reg.total_registration_fee, 0) AS total_registration_fee, "
        "COALESCE(ins.total_premium, 0) AS total_insurance_premium "
        "FROM " + table_name + " t "
        "LEFT JOIN LATERAL ("
        "  SELECT ms.* FROM moto_sales ms "
        "  WHERE (UPPER(ms.chassis_no) = UPPER(t.chassis_no) "
        "         OR (t.engine_no IS NOT NULL AND t.engine_no <> '' AND UPPER(ms.engine_no) = UPPER(t.engine_no))) "
        "  ORDER BY CASE WHEN UPPER(ms.chassis_no) = UPPER(t.chassis_no) THEN 1 ELSE 2 END LIMIT 1"
        ") s ON TRUE "
        "LEFT JOIN LATERAL ("
        "  SELECT SUM(COALESCE(rs.billing_amount, 0)) AS total_registration_fee "
        "  FROM registration_submissions rs "
        "  WHERE rs.sale_id = s.id AND rs.status <> 'cancelled'"
        ") reg ON TRUE "
        "LEFT JOIN LATERAL ("
        "  SELECT SUM(COALESCE(mi.total_premium, 0)) AS total_premium "
        "  FROM moto_insurance_records mi "
        "  WHERE (mi.sale_id = s.id OR UPPER(mi.chassis_no) = UPPER(t.chassis_no)) AND mi.status = 'active'"
        ") ins ON TRUE "
        "WHERE t.invoice_date >= COALESCE(NULLIF('{{ $json.body.date_from }}','')::date, '1900-01-01'::date) "
        "  AND t.invoice_date <= COALESCE(NULLIF('{{ $json.body.date_to }}','')::date, '9999-12-31'::date) "
        "  AND COALESCE(t.status, 'active') = 'active'"
    )

union_query = (
    per_branch("tax_invoices_papao", "PAPAO") + " UNION ALL " +
    per_branch("tax_invoices_nakornluang", "NAKORNLUANG") + " UNION ALL " +
    per_branch("tax_invoices_singchai", "SINGCHAI") +
    " ORDER BY invoice_date DESC, tax_invoice_no DESC LIMIT 5000"
)

existing = {n['name'] for n in wf['nodes']}
base_y = 7000

if 'Q: List Registration Summary' in existing:
    nd = next(n for n in wf['nodes'] if n['name'] == 'Q: List Registration Summary')
    nd['parameters']['query'] = union_query
    print("OK: updated Q: List Registration Summary")
else:
    pg = {
        "parameters": {"operation": "executeQuery", "query": union_query, "options": {}},
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [3000, base_y],
        "id": str(uuid.uuid4()),
        "name": "Q: List Registration Summary",
    }
    if postgres_creds:
        pg["credentials"] = postgres_creds
    wf['nodes'].append(pg)
    print("OK: added Q: List Registration Summary")

# 4. Respond
RESP = {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
    "options": {"responseHeaders": {"entries": [{"name": "Access-Control-Allow-Origin", "value": "*"}]}}
}
if 'Respond List Registration Summary' in existing:
    nd = next(n for n in wf['nodes'] if n['name'] == 'Respond List Registration Summary')
    nd['parameters'] = RESP
    print("OK: updated Respond")
else:
    wf['nodes'].append({
        "parameters": RESP,
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.5,
        "position": [3300, base_y],
        "id": str(uuid.uuid4()),
        "name": "Respond List Registration Summary",
    })
    print("OK: added Respond")

# 5. Connections
conns = wf.setdefault('connections', {})
sw_node = next(n for n in wf['nodes'] if n['name'] == 'Switch Action')
rules = sw_node['parameters']['rules']['values']
out_idx = next(i for i, r in enumerate(rules) if r['outputKey'] == 'list_registration_summary')
sw_conns = conns.setdefault('Switch Action', {}).setdefault('main', [])
while len(sw_conns) <= out_idx:
    sw_conns.append([])
if not any(t.get('node') == 'Q: List Registration Summary' for t in sw_conns[out_idx]):
    sw_conns[out_idx].append({"node": "Q: List Registration Summary", "type": "main", "index": 0})
    print(f"OK: connected Switch[{out_idx}] -> Q")

if 'Q: List Registration Summary' not in conns:
    conns['Q: List Registration Summary'] = {"main": [[{"node": "Respond List Registration Summary", "type": "main", "index": 0}]]}
    print("OK: connected Q -> Respond")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved to {dst}")
