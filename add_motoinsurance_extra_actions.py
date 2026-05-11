"""
เพิ่ม actions สำหรับ บันทึกค่าใช้จ่ายเพิ่มเติมงาน พรบ. ใน Registrations API
- list / save / delete motoinsurance_extra_expenses
- list_other_income_receipts (เลือกใบรับชำระจาก other_income)
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Registrations API.json")
wf = json.loads(src.read_text(encoding='utf-8'))

postgres_creds = None
for n in wf['nodes']:
    if n['type']=='n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']; break

actions = [
    ("list_motoinsurance_extra",
     "SELECT id, expense_type, original_policy_no, expense_amount, payment_receipt_no, note, active, created_at "
     "FROM motoinsurance_extra_expenses "
     "WHERE (NULLIF(NULLIF('{{ $json.body.include_inactive }}',''),'undefined') IS NOT NULL OR active = TRUE) "
     "  AND (NULLIF(NULLIF('{{ $json.body.date_from }}',''),'undefined')::date IS NULL "
     "       OR created_at::date >= NULLIF(NULLIF('{{ $json.body.date_from }}',''),'undefined')::date) "
     "  AND (NULLIF(NULLIF('{{ $json.body.date_to }}',''),'undefined')::date IS NULL "
     "       OR created_at::date <= NULLIF(NULLIF('{{ $json.body.date_to }}',''),'undefined')::date) "
     "  AND (NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') IS NULL OR ("
     "       original_policy_no ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' "
     "    OR payment_receipt_no ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' "
     "    OR expense_type ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' )) "
     "ORDER BY created_at DESC LIMIT 1000"),

    ("save_motoinsurance_extra",
     "INSERT INTO motoinsurance_extra_expenses(id, expense_type, original_policy_no, expense_amount, payment_receipt_no, note, active, created_by, created_at) "
     "VALUES ("
     "  CASE WHEN NULLIF('{{ $json.body.id }}','')::int IS NULL THEN nextval('motoinsurance_extra_expenses_id_seq') ELSE NULLIF('{{ $json.body.id }}','')::int END, "
     "  '{{ $json.body.expense_type }}', "
     "  NULLIF(NULLIF('{{ $json.body.original_policy_no }}',''),'undefined')::text, "
     "  {{ $json.body.expense_amount }}::numeric, "
     "  NULLIF(NULLIF('{{ $json.body.payment_receipt_no }}',''),'undefined')::text, "
     "  NULLIF(NULLIF('{{ $json.body.note }}',''),'undefined')::text, "
     "  TRUE, "
     "  NULLIF(NULLIF('{{ $json.body.created_by }}',''),'undefined')::text, NOW()"
     ") "
     "ON CONFLICT (id) DO UPDATE SET "
     "  expense_type = EXCLUDED.expense_type, "
     "  original_policy_no = EXCLUDED.original_policy_no, "
     "  expense_amount = EXCLUDED.expense_amount, "
     "  payment_receipt_no = EXCLUDED.payment_receipt_no, "
     "  note = EXCLUDED.note "
     "RETURNING id, expense_type, expense_amount"),

    ("delete_motoinsurance_extra",
     "UPDATE motoinsurance_extra_expenses SET active = FALSE WHERE id = {{ $json.body.id }} RETURNING id"),

    ("list_other_income_receipts",
     "SELECT receipt_no, receipt_date, customer_name, branch_code, total_amount "
     "FROM other_income "
     "WHERE (NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') IS NULL OR ("
     "       receipt_no ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' "
     "    OR customer_name ILIKE '%' || NULLIF(NULLIF('{{ $json.body.search }}',''),'undefined') || '%' )) "
     "  AND (NULLIF(NULLIF('{{ $json.body.date_from }}',''),'undefined')::date IS NULL "
     "       OR receipt_date >= NULLIF(NULLIF('{{ $json.body.date_from }}',''),'undefined')::date) "
     "  AND (NULLIF(NULLIF('{{ $json.body.date_to }}',''),'undefined')::date IS NULL "
     "       OR receipt_date <= NULLIF(NULLIF('{{ $json.body.date_to }}',''),'undefined')::date) "
     "ORDER BY receipt_date DESC, receipt_no DESC LIMIT 500"),
]

sw = next(n for n in wf['nodes'] if n.get('name')=='Switch Action' and n.get('type')=='n8n-nodes-base.switch')
rules = sw['parameters']['rules']['values']
connections = wf.setdefault('connections', {})
sw_conns = connections.setdefault('Switch Action', {}).setdefault('main', [])

base_y = 20000
for offset, (key, query) in enumerate(actions):
    if not any(r.get('outputKey')==key for r in rules):
        rules.append({
            "conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict","version":2},
                "conditions":[{"id":f"mix{offset}","leftValue":"={{ $json.body.action }}","rightValue":key,
                    "operator":{"type":"string","operation":"equals"}}],"combinator":"and"},
            "renameOutput":True,"outputKey":key,
        })
    idx = next(i for i,r in enumerate(rules) if r['outputKey']==key)
    y = base_y + offset*300
    q_name = f"Q: {key}"; r_name = f"Respond: {key}"
    existing = {n['name'] for n in wf['nodes']}
    if q_name in existing:
        next(n for n in wf['nodes'] if n['name']==q_name)['parameters']['query'] = query
    else:
        pg = {"parameters":{"operation":"executeQuery","query":query,"options":{}},
            "type":"n8n-nodes-base.postgres","typeVersion":2.6,
            "position":[3000,y],"id":str(uuid.uuid4()),"name":q_name,"alwaysOutputData":True}
        if postgres_creds: pg["credentials"] = postgres_creds
        wf['nodes'].append(pg)
    if r_name not in existing:
        wf['nodes'].append({"parameters":{"respondWith":"json",
            "responseBody":"={{ JSON.stringify($input.all().map(i => i.json)) }}",
            "options":{"responseHeaders":{"entries":[
                {"name":"Access-Control-Allow-Origin","value":"*"}]}}},
            "type":"n8n-nodes-base.respondToWebhook","typeVersion":1.5,
            "position":[3300,y],"id":str(uuid.uuid4()),"name":r_name})
    while len(sw_conns) <= idx: sw_conns.append([])
    if not any(t.get('node')==q_name for t in sw_conns[idx]):
        sw_conns[idx].append({"node":q_name,"type":"main","index":0})
    if q_name not in connections:
        connections[q_name] = {"main":[[{"node":r_name,"type":"main","index":0}]]}
    print(f"OK: {key}")

src.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print("OK saved")
