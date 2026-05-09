"""
เพิ่ม actions สำหรับ loan_interest_payments:
- list_loan_interest_payments
- save_loan_interest_payment    -> INSERT + UPDATE loan_accounts.current_balance
- cancel_loan_interest_payment  -> mark cancelled + คืน balance
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")
dst = src

wf = json.loads(src.read_text(encoding='utf-8'))

ACTIONS = ["list_loan_interest_payments", "save_loan_interest_payment", "cancel_loan_interest_payment"]
for n in wf['nodes']:
    if n['name'] == 'Switch Action':
        rules = n['parameters']['rules']['values']
        existing_keys = {r.get('outputKey') for r in rules}
        for act in ACTIONS:
            if act in existing_keys:
                continue
            rules.append({
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                    "conditions": [{
                        "id": "ac" + act[:6].replace('_',''),
                        "leftValue": "={{ $json.body.action }}",
                        "rightValue": act,
                        "operator": {"type": "string", "operation": "equals"},
                    }],
                    "combinator": "and",
                },
                "renameOutput": True,
                "outputKey": act,
            })
            print(f"OK: added Switch rule '{act}'")

postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']
        break

existing = {n['name'] for n in wf['nodes']}
base_y = 5000

def add_pg(name, query, x, y):
    if name in existing:
        nd = next(n for n in wf['nodes'] if n['name'] == name)
        nd['parameters']['query'] = query
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

def add_code(name, code, x, y):
    if name in existing:
        nd = next(n for n in wf['nodes'] if n['name'] == name)
        nd['parameters']['jsCode'] = code
        print(f"OK: updated {name}")
        return
    nd = {
        "parameters": {"jsCode": code},
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [x, y],
        "id": str(uuid.uuid4()),
        "name": name,
    }
    wf['nodes'].append(nd)
    print(f"OK: added {name}")

RESP_PARAMS = {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
    "options": {"responseHeaders": {"entries": [{"name": "Access-Control-Allow-Origin", "value": "*"}]}}
}
RESP_FIRST = {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify($input.first().json) }}",
    "options": {"responseHeaders": {"entries": [{"name": "Access-Control-Allow-Origin", "value": "*"}]}}
}

def add_resp(name, params, x, y):
    if name in existing:
        nd = next(n for n in wf['nodes'] if n['name'] == name)
        nd['parameters'] = params
        print(f"OK: updated {name}")
        return
    nd = {
        "parameters": params,
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.5,
        "position": [x, y],
        "id": str(uuid.uuid4()),
        "name": name,
    }
    wf['nodes'].append(nd)
    print(f"OK: added {name}")

# 1) list — Code -> Q -> Respond (filter date_from, date_to, loan_id)
LIST_CODE = r"""const b = $input.first().json.body || {};
const esc = v => v == null || v === '' ? null : String(v).replace(/'/g, "''");
const conds = ["lip.status <> 'never_used'"];
const dateFrom = esc(b.date_from);
if (dateFrom) conds.push("lip.payment_date >= '" + dateFrom + "'::date");
const dateTo = esc(b.date_to);
if (dateTo) conds.push("lip.payment_date <= '" + dateTo + "'::date");
const loanId = Number(b.loan_id);
if (Number.isFinite(loanId) && loanId > 0) conds.push("lip.loan_id = " + loanId);
const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
const query = "SELECT lip.*, la.loan_name, la.lender, la.loan_type, ba.bank_name, ba.account_no, ba.account_name FROM loan_interest_payments lip LEFT JOIN loan_accounts la ON la.loan_id = lip.loan_id LEFT JOIN bank_accounts ba ON ba.account_id = lip.from_bank_account_id " + where + " ORDER BY lip.payment_date DESC, lip.payment_id DESC LIMIT 5000";
return [{ json: { query } }];"""

add_code("Code List Loan Interest Payments", LIST_CODE, 2700, base_y)
add_pg("Q: List Loan Interest Payments", "{{ $json.query }}", 3000, base_y)
add_resp("Respond List Loan Interest Payments", RESP_PARAMS, 3300, base_y)

# 2) save — INSERT + UPDATE balance ใน CTE เดียว
SAVE_CODE = r"""const b = $input.first().json.body || {};
const isOD = b.is_od === true || b.is_od === 'true';
const loanIdNum = Number(b.loan_id);
const loanIdSql = (isOD || !loanIdNum) ? 'NULL' : String(loanIdNum);
if (!isOD && !loanIdNum) return [{ json: { query: "SELECT NULL::int AS payment_id, 'loan_id or is_od required' AS error_msg WHERE FALSE" } }];
const esc = v => v == null || v === '' ? 'NULL' : ("'" + String(v).replace(/'/g, "''") + "'");
const num = v => { if (v == null || v === '') return '0'; const n = Number(v); return isFinite(n) ? String(n) : '0'; };
const datExpr = v => v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? `'${String(v).slice(0,10)}'::date` : 'CURRENT_DATE';
const interest = num(b.interest_amount);
const principal = isOD ? '0' : num(b.principal_amount);
const total = num(b.total_amount || (Number(b.interest_amount || 0) + Number(b.principal_amount || 0)));
const fromBank = b.from_bank_account_id ? Number(b.from_bank_account_id) : 'NULL';
// ถ้าเป็น OD: ไม่ต้อง UPDATE loan_accounts
const updateBlock = isOD ? '' : `, upd AS (
  UPDATE loan_accounts SET current_balance = GREATEST(current_balance - (SELECT principal_amount FROM ins), 0), updated_at = NOW()
  WHERE loan_id = (SELECT loan_id FROM ins) AND (SELECT loan_id FROM ins) IS NOT NULL
  RETURNING loan_id, current_balance
)`;
const finalSelect = isOD
  ? `SELECT (SELECT payment_id FROM ins) AS payment_id, NULL::numeric AS new_balance`
  : `SELECT (SELECT payment_id FROM ins) AS payment_id, (SELECT current_balance FROM upd) AS new_balance`;
const query = `
WITH ins AS (
  INSERT INTO loan_interest_payments (loan_id, payment_date, interest_amount, principal_amount, total_amount, from_bank_account_id, payment_method, note, created_by)
  VALUES (${loanIdSql}, ${datExpr(b.payment_date)}, ${interest}, ${principal}, ${total}, ${fromBank}, ${esc(b.payment_method || 'โอน')}, ${esc(b.note)}, ${esc(b.created_by)})
  RETURNING payment_id, loan_id, principal_amount
)${updateBlock}
${finalSelect}`;
return [{ json: { query } }];"""

add_code("Code Save Loan Interest Payment", SAVE_CODE, 2700, base_y + 200)
add_pg("Q: Save Loan Interest Payment", "{{ $json.query }}", 3000, base_y + 200)
add_resp("Respond Save Loan Interest Payment", RESP_FIRST, 3300, base_y + 200)

# 3) cancel — mark cancelled + คืน principal กลับเข้า balance
CANCEL_CODE = r"""const b = $input.first().json.body || {};
const id = Number(b.payment_id);
if (!id) return [{ json: { query: "SELECT NULL::int AS payment_id, 'payment_id required' AS error_msg WHERE FALSE" } }];
const esc = v => v == null || v === '' ? 'NULL' : ("'" + String(v).replace(/'/g, "''") + "'");
// UPDATE loan_accounts ทำเฉพาะกรณีที่ loan_id ไม่เป็น NULL (ไม่ใช่ OD)
const query = `
WITH cancel AS (
  UPDATE loan_interest_payments SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = ${esc(b.cancelled_by)}
  WHERE payment_id = ${id} AND status = 'active'
  RETURNING loan_id, principal_amount
),
upd AS (
  UPDATE loan_accounts SET current_balance = current_balance + COALESCE((SELECT principal_amount FROM cancel), 0), updated_at = NOW()
  WHERE loan_id = (SELECT loan_id FROM cancel) AND (SELECT loan_id FROM cancel) IS NOT NULL
  RETURNING loan_id, current_balance
)
SELECT ${id} AS payment_id, (SELECT current_balance FROM upd) AS new_balance, (SELECT COUNT(*) FROM cancel) AS cancelled`;
return [{ json: { query } }];"""

add_code("Code Cancel Loan Interest Payment", CANCEL_CODE, 2700, base_y + 400)
add_pg("Q: Cancel Loan Interest Payment", "{{ $json.query }}", 3000, base_y + 400)
add_resp("Respond Cancel Loan Interest Payment", RESP_FIRST, 3300, base_y + 400)

# Connections
conns = wf.setdefault('connections', {})
sw_node = next(n for n in wf['nodes'] if n['name'] == 'Switch Action')
rules = sw_node['parameters']['rules']['values']

def connect_switch(out_key, target_node):
    out_idx = next(i for i, r in enumerate(rules) if r['outputKey'] == out_key)
    sw_conns = conns.setdefault('Switch Action', {}).setdefault('main', [])
    while len(sw_conns) <= out_idx:
        sw_conns.append([])
    if not any(t.get('node') == target_node for t in sw_conns[out_idx]):
        sw_conns[out_idx].append({"node": target_node, "type": "main", "index": 0})
        print(f"OK: connected Switch[{out_idx}] -> {target_node}")

def chain(src_name, mid_name, dst_name):
    if src_name not in conns:
        conns[src_name] = {"main": [[{"node": mid_name, "type": "main", "index": 0}]]}
        print(f"OK: connected {src_name} -> {mid_name}")
    if mid_name not in conns:
        conns[mid_name] = {"main": [[{"node": dst_name, "type": "main", "index": 0}]]}
        print(f"OK: connected {mid_name} -> {dst_name}")

connect_switch("list_loan_interest_payments", "Code List Loan Interest Payments")
connect_switch("save_loan_interest_payment", "Code Save Loan Interest Payment")
connect_switch("cancel_loan_interest_payment", "Code Cancel Loan Interest Payment")

chain("Code List Loan Interest Payments", "Q: List Loan Interest Payments", "Respond List Loan Interest Payments")
chain("Code Save Loan Interest Payment", "Q: Save Loan Interest Payment", "Respond Save Loan Interest Payment")
chain("Code Cancel Loan Interest Payment", "Q: Cancel Loan Interest Payment", "Respond Cancel Loan Interest Payment")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved to {dst}")
print(f"Total nodes: {len(wf['nodes'])}")
