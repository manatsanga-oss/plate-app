"""
เพิ่ม action 'list_car_payment_receipts' ใน Accounting API
- UNION ALL 3 ตาราง tax_invoices_{papao,nakornluang,singchai}
- LATERAL JOIN moto_sales (จับด้วย chassis_no/engine_no)
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
        if not any(r.get('outputKey') == 'list_car_payment_receipts' for r in rules):
            rules.append({
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                    "conditions": [{
                        "id": "accpr",
                        "leftValue": "={{ $json.body.action }}",
                        "rightValue": "list_car_payment_receipts",
                        "operator": {"type": "string", "operation": "equals"},
                    }],
                    "combinator": "and",
                },
                "renameOutput": True,
                "outputKey": "list_car_payment_receipts",
            })
            print("OK: added Switch rule 'list_car_payment_receipts'")
        else:
            print("INFO: Switch rule already exists")

# 2. หา postgres credentials
postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']
        break

# 3. Build query: UNION 3 tables + LATERAL JOIN moto_sales
def per_branch(table_name, branch_code):
    return (
        "SELECT '" + branch_code + "' AS branch, t.tax_invoice_no, t.invoice_date, t.customer_name, "
        "t.chassis_no, t.engine_no, t.model_name, t.total_amount, t.paid_from_ft_id, t.paid_from_amount, t.paid_at, t.status, "
        "s.customer_name AS sale_customer_name, s.invoice_no AS sale_invoice_no, "
        "s.sale_date, s.finance_company AS sale_finance_company, "
        "ft.doc_no AS ft_doc_no, ft.transfer_date AS ft_transfer_date, "
        "ft.amount AS ft_amount, ft.match_status AS ft_match_status, "
        "ft.matched_at AS ft_matched_at, ft.matched_by AS ft_matched_by, "
        "COALESCE(dr_sum.total_paid, 0) AS total_paid, "
        "COALESCE(dr_sum.receipt_count, 0)::int AS receipt_count, "
        "dr_sum.receipts_json "
        "FROM " + table_name + " t "
        "LEFT JOIN LATERAL ("
        "  SELECT ms.* FROM moto_sales ms "
        "  WHERE (UPPER(ms.chassis_no) = UPPER(t.chassis_no) "
        "         OR (t.engine_no IS NOT NULL AND t.engine_no <> '' AND UPPER(ms.engine_no) = UPPER(t.engine_no))) "
        "  ORDER BY CASE WHEN UPPER(ms.chassis_no) = UPPER(t.chassis_no) THEN 1 ELSE 2 END LIMIT 1"
        ") s ON TRUE "
        "LEFT JOIN finance_transfers ft ON ft.ft_id = t.paid_from_ft_id "
        "LEFT JOIN LATERAL ("
        "  SELECT SUM(dr.total_amount) AS total_paid, COUNT(*) AS receipt_count, "
        "    jsonb_agg(to_jsonb(dr) || jsonb_build_object("
        "      'transfers', (SELECT jsonb_agg(jsonb_build_object('account_no', rt.bank_account_no, 'bank_name', rt.bank_name, 'amount', rt.amount) ORDER BY rt.amount DESC) FROM receipt_transfers rt WHERE rt.receipt_no = dr.receipt_no)"
        "    ) ORDER BY dr.receipt_date DESC) AS receipts_json "
        "  FROM daily_receipts dr "
        "  WHERE dr.sale_invoice_no = s.invoice_no "
        "    AND dr.status = 'ปกติ' "
        "    AND dr.receipt_no NOT ILIKE 'SCY10%' "  # ไม่นับ SCY10
        ") dr_sum ON TRUE "
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
base_y = 6000

if 'Q: List Car Payment Receipts' in existing:
    nd = next(n for n in wf['nodes'] if n['name'] == 'Q: List Car Payment Receipts')
    nd['parameters']['query'] = union_query
    print("OK: updated Q: List Car Payment Receipts")
else:
    pg = {
        "parameters": {"operation": "executeQuery", "query": union_query, "options": {}},
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2.6,
        "position": [3000, base_y],
        "id": str(uuid.uuid4()),
        "name": "Q: List Car Payment Receipts",
    }
    if postgres_creds:
        pg["credentials"] = postgres_creds
    wf['nodes'].append(pg)
    print("OK: added Q: List Car Payment Receipts")

# 4. Respond
RESP = {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
    "options": {"responseHeaders": {"entries": [{"name": "Access-Control-Allow-Origin", "value": "*"}]}}
}
if 'Respond List Car Payment Receipts' in existing:
    nd = next(n for n in wf['nodes'] if n['name'] == 'Respond List Car Payment Receipts')
    nd['parameters'] = RESP
    print("OK: updated Respond")
else:
    wf['nodes'].append({
        "parameters": RESP,
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.5,
        "position": [3300, base_y],
        "id": str(uuid.uuid4()),
        "name": "Respond List Car Payment Receipts",
    })
    print("OK: added Respond")

# 5. Connections
conns = wf.setdefault('connections', {})
sw_node = next(n for n in wf['nodes'] if n['name'] == 'Switch Action')
rules = sw_node['parameters']['rules']['values']
out_idx = next(i for i, r in enumerate(rules) if r['outputKey'] == 'list_car_payment_receipts')
sw_conns = conns.setdefault('Switch Action', {}).setdefault('main', [])
while len(sw_conns) <= out_idx:
    sw_conns.append([])
if not any(t.get('node') == 'Q: List Car Payment Receipts' for t in sw_conns[out_idx]):
    sw_conns[out_idx].append({"node": "Q: List Car Payment Receipts", "type": "main", "index": 0})
    print(f"OK: connected Switch[{out_idx}] -> Q")

if 'Q: List Car Payment Receipts' not in conns:
    conns['Q: List Car Payment Receipts'] = {"main": [[{"node": "Respond List Car Payment Receipts", "type": "main", "index": 0}]]}
    print("OK: connected Q -> Respond")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved to {dst}")
