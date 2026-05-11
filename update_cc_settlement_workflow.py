"""
อัพเดต Accounting API workflow:
1. แก้ block 'รับชำระบัตรเครดิต' ใน Code List Movements ให้ใช้ next_business_day + override
2. แก้ Q: CC Detail ให้รองรับการคลิกจาก movement_date หรือ original_date
3. เพิ่ม action 'save_cc_settlement_override'
4. เพิ่ม action 'list_bank_holidays' / 'save_bank_holiday' / 'delete_bank_holiday'
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")
dst = src
wf = json.loads(src.read_text(encoding='utf-8'))

# helper
def get_pg_creds():
    for n in wf['nodes']:
        if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
            return n['credentials']
    return None
postgres_creds = get_pg_creds()

def add_switch_rule(out_key, id_):
    sw = next(n for n in wf['nodes'] if n.get('name')=='Switch Action' and n.get('type')=='n8n-nodes-base.switch')
    rules = sw['parameters']['rules']['values']
    if not any(r.get('outputKey')==out_key for r in rules):
        rules.append({
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                "conditions": [{
                    "id": id_,
                    "leftValue": "={{ $json.body.action }}",
                    "rightValue": out_key,
                    "operator": {"type": "string", "operation": "equals"},
                }],
                "combinator": "and",
            },
            "renameOutput": True, "outputKey": out_key,
        })
        print(f"OK: added Switch rule '{out_key}'")
    else:
        print(f"INFO: Switch rule '{out_key}' exists")
    return next(i for i,r in enumerate(rules) if r['outputKey']==out_key)

def add_pg_node(name, query, x, y):
    existing = {n['name'] for n in wf['nodes']}
    if name in existing:
        next(n for n in wf['nodes'] if n['name']==name)['parameters']['query'] = query
        print(f"OK: updated {name}")
    else:
        node = {
            "parameters": {"operation": "executeQuery", "query": query, "options": {}},
            "type": "n8n-nodes-base.postgres", "typeVersion": 2.6,
            "position": [x, y], "id": str(uuid.uuid4()), "name": name,
        }
        if postgres_creds: node["credentials"] = postgres_creds
        wf['nodes'].append(node)
        print(f"OK: added {name}")

def add_resp_node(name, x, y):
    RESP = {"respondWith":"json","responseBody":"={{ JSON.stringify($input.all().map(i => i.json)) }}",
        "options":{"responseHeaders":{"entries":[{"name":"Access-Control-Allow-Origin","value":"*"}]}}}
    existing = {n['name'] for n in wf['nodes']}
    if name in existing:
        next(n for n in wf['nodes'] if n['name']==name)['parameters'] = RESP
    else:
        wf['nodes'].append({"parameters": RESP, "type":"n8n-nodes-base.respondToWebhook",
            "typeVersion":1.5, "position":[x, y], "id": str(uuid.uuid4()), "name": name})
    print(f"OK: ensured {name}")

def connect(out_idx, q_name, resp_name):
    conns = wf.setdefault('connections', {})
    sw_conns = conns.setdefault('Switch Action', {}).setdefault('main', [])
    while len(sw_conns) <= out_idx: sw_conns.append([])
    if not any(t.get('node')==q_name for t in sw_conns[out_idx]):
        sw_conns[out_idx].append({"node": q_name, "type":"main", "index":0})
    if q_name not in conns:
        conns[q_name] = {"main":[[{"node": resp_name, "type":"main", "index":0}]]}

# ----- 1) แก้ block credit-card grouped ใน Code List Movements -----
movements_node = next(n for n in wf['nodes'] if n.get('name')=='Code List Movements')
code = movements_node['parameters']['jsCode']

NEW_CC_BLOCK = (
    "SELECT * FROM (\n"
    "SELECT COALESCE((SELECT cso.settlement_date FROM cc_settlement_overrides cso "
    "WHERE cso.account_id = ${accId} AND cso.original_date = dr.receipt_date), "
    "next_business_day(dr.receipt_date)) AS movement_date, "
    "'CC-' || to_char(dr.receipt_date,'YYMMDD') AS doc_no, "
    "'รับชำระบัตรเครดิต' AS movement_type, "
    "NULL::text AS counterparty, 'บัตรเครดิต' AS payment_method, "
    "CASE WHEN EXISTS (SELECT 1 FROM cc_settlement_overrides cso2 WHERE cso2.account_id=${accId} AND cso2.original_date=dr.receipt_date) "
    "THEN '✏️ แก้วันที่' ELSE NULL END AS note, "
    "SUM(COALESCE(rt.amount,0)) AS amount, 'in' AS direction, 0 AS wht_amount "
    "FROM receipt_transfers rt "
    "JOIN daily_receipts dr ON dr.receipt_no = rt.receipt_no "
    "JOIN bank_accounts ba ON ba.account_no = rt.bank_account_no "
    "WHERE ba.account_id = ${accId} "
    "  AND ${accId} = COALESCE((SELECT account_id FROM bank_accounts WHERE account_no = '2490391139' LIMIT 1), -1) "
    "  AND COALESCE(dr.status,'ปกติ') <> 'ยกเลิก' "
    "  AND rt.receipt_no NOT LIKE 'SCY10%' "
    "GROUP BY dr.receipt_date "
    "HAVING SUM(COALESCE(rt.amount,0)) > 0\n"
    ") cc_mv "
    "WHERE TRUE "
    "${dateFrom ? `AND cc_mv.movement_date >= '${dateFrom}'::date` : ''} "
    "${dateTo ? `AND cc_mv.movement_date <= '${dateTo}'::date + interval '1 day'` : ''}"
)

# replace existing credit-card block
import re
# pattern: from "UNION ALL\nSELECT dr.receipt_date AS movement_date" up through "HAVING SUM(COALESCE(rt.amount,0)) > 0"
pat = re.compile(
    r"UNION ALL\nSELECT dr\.receipt_date AS movement_date,\s*'CC-' \|\| to_char\(dr\.receipt_date,'YYMMDD'\) AS doc_no,.*?HAVING SUM\(COALESCE\(rt\.amount,0\)\) > 0\n",
    re.DOTALL)

if pat.search(code):
    code = pat.sub("UNION ALL\n" + NEW_CC_BLOCK + "\n", code)
    movements_node['parameters']['jsCode'] = code
    print("OK: replaced credit-card block with override-aware version")
else:
    # try find the simpler block that I inserted earlier (no original wrapper)
    pat2 = re.compile(
        r"UNION ALL\nSELECT \* FROM \(\nSELECT COALESCE\(\(SELECT cso\.settlement_date.*?\) cc_mv .*?\$\{dateTo \? `AND cc_mv\.movement_date.*?: ''\}",
        re.DOTALL)
    if pat2.search(code):
        print("INFO: override-aware credit-card block already in place")
    else:
        print("WARN: ไม่พบ block credit-card ที่จะแทน — กรุณาตรวจสอบ jsCode")

# ----- 2) แก้ Q: CC Detail ให้ filter ด้วย original_date (กลุ่มเดิม), แต่ accept settlement_date จาก client -----
QUERY_DETAIL = (
    "SELECT rt.id, rt.receipt_no, dr.receipt_date AS original_date, "
    "COALESCE((SELECT cso.settlement_date FROM cc_settlement_overrides cso "
    "WHERE cso.account_id = {{ $json.body.account_id }} AND cso.original_date = dr.receipt_date), "
    "next_business_day(dr.receipt_date)) AS settlement_date, "
    "rt.amount, rt.bank_name, rt.bank_account_no, "
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
# update existing Q: CC Detail
existing = {n['name'] for n in wf['nodes']}
if 'Q: CC Detail' in existing:
    next(n for n in wf['nodes'] if n['name']=='Q: CC Detail')['parameters']['query'] = QUERY_DETAIL
    print("OK: updated Q: CC Detail to include settlement_date")

# ----- 3) save_cc_settlement_override -----
idx_save = add_switch_rule("save_cc_settlement_override", "ccsave")
QUERY_SAVE = (
    "INSERT INTO cc_settlement_overrides(account_id, original_date, settlement_date, note, updated_by, updated_at) "
    "VALUES ({{ $json.body.account_id }}, '{{ $json.body.original_date }}'::date, '{{ $json.body.settlement_date }}'::date, "
    "NULLIF('{{ $json.body.note }}','')::text, NULLIF('{{ $json.body.updated_by }}','')::text, NOW()) "
    "ON CONFLICT (account_id, original_date) DO UPDATE SET "
    "settlement_date = EXCLUDED.settlement_date, note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = NOW() "
    "RETURNING account_id, original_date, settlement_date"
)
add_pg_node("Q: Save CC Settlement", QUERY_SAVE, 3000, 13000)
add_resp_node("Respond Save CC Settlement", 3300, 13000)
connect(idx_save, "Q: Save CC Settlement", "Respond Save CC Settlement")

# ----- 4) bank_holidays CRUD -----
idx_lh = add_switch_rule("list_bank_holidays", "bhlist")
add_pg_node("Q: List Bank Holidays",
    "SELECT holiday_date, name FROM bank_holidays WHERE holiday_date >= COALESCE(NULLIF('{{ $json.body.date_from }}','')::date,'1900-01-01'::date) AND holiday_date <= COALESCE(NULLIF('{{ $json.body.date_to }}','')::date,'9999-12-31'::date) ORDER BY holiday_date",
    3000, 14000)
add_resp_node("Respond List Bank Holidays", 3300, 14000)
connect(idx_lh, "Q: List Bank Holidays", "Respond List Bank Holidays")

idx_sh = add_switch_rule("save_bank_holiday", "bhsave")
add_pg_node("Q: Save Bank Holiday",
    "INSERT INTO bank_holidays(holiday_date, name, created_by) VALUES ('{{ $json.body.holiday_date }}'::date, NULLIF('{{ $json.body.name }}','')::text, NULLIF('{{ $json.body.created_by }}','')::text) ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name RETURNING holiday_date",
    3000, 15000)
add_resp_node("Respond Save Bank Holiday", 3300, 15000)
connect(idx_sh, "Q: Save Bank Holiday", "Respond Save Bank Holiday")

idx_dh = add_switch_rule("delete_bank_holiday", "bhdel")
add_pg_node("Q: Delete Bank Holiday",
    "DELETE FROM bank_holidays WHERE holiday_date = '{{ $json.body.holiday_date }}'::date RETURNING holiday_date",
    3000, 16000)
add_resp_node("Respond Delete Bank Holiday", 3300, 16000)
connect(idx_dh, "Q: Delete Bank Holiday", "Respond Delete Bank Holiday")

# ----- 5) delete_cc_settlement_override -----
idx_dcc = add_switch_rule("delete_cc_settlement_override", "ccdel")
add_pg_node("Q: Delete CC Settlement",
    "DELETE FROM cc_settlement_overrides WHERE account_id = {{ $json.body.account_id }} AND original_date = '{{ $json.body.original_date }}'::date RETURNING account_id, original_date",
    3000, 17000)
add_resp_node("Respond Delete CC Settlement", 3300, 17000)
connect(idx_dcc, "Q: Delete CC Settlement", "Respond Delete CC Settlement")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved to {dst}")
