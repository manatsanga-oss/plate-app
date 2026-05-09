"""
เพิ่ม actions สำหรับบัญชีเงินกู้ยืม:
- list_loan_accounts
- save_loan_account
- update_loan_account
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")
dst = src

wf = json.loads(src.read_text(encoding='utf-8'))

# ----- Switch Action: เพิ่ม 3 rules -----
ACTIONS = ["list_loan_accounts", "save_loan_account", "update_loan_account"]
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
                        "id": "ac" + act[:6],
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

# ----- หา postgres credentials -----
postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']
        break

# ----- 1) list_loan_accounts: Postgres + Respond ที่รับ direct (ไม่มี Code) -----
LIST_QUERY = "SELECT * FROM loan_accounts ORDER BY status, due_date NULLS LAST, loan_id DESC LIMIT 1000"
existing = {n['name'] for n in wf['nodes']}
base_y = 4000

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

# 1) List
add_pg("Q: List Loan Accounts", LIST_QUERY, 3000, base_y)
add_resp("Respond List Loan Accounts", RESP_PARAMS, 3300, base_y)

# 2) Save (insert) - Code generates SQL, Postgres runs
SAVE_CODE = r"""const b = $input.first().json.body || {};
const esc = v => v == null || v === '' ? 'NULL' : ("'" + String(v).replace(/'/g, "''") + "'");
const num = v => { if (v == null || v === '') return '0'; const n = Number(v); return isFinite(n) ? String(n) : '0'; };
const datExpr = v => v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? `'${String(v).slice(0,10)}'::date` : 'NULL';
const query = `INSERT INTO loan_accounts (loan_name, lender, loan_type, account_no, principal, current_balance, interest_rate, interest_period, start_date, due_date, payment_schedule, note, status, created_by) VALUES (${esc(b.loan_name)}, ${esc(b.lender)}, ${esc(b.loan_type)}, ${esc(b.account_no)}, ${num(b.principal)}, ${num(b.current_balance)}, ${num(b.interest_rate)}, ${esc(b.interest_period || 'ปี')}, ${datExpr(b.start_date)}, ${datExpr(b.due_date)}, ${esc(b.payment_schedule)}, ${esc(b.note)}, ${esc(b.status || 'active')}, ${esc(b.created_by)}) RETURNING loan_id, loan_name`;
return [{ json: { query } }];"""

add_code("Code Save Loan Account", SAVE_CODE, 2700, base_y + 200)
add_pg("Q: Save Loan Account", "{{ $json.query }}", 3000, base_y + 200)
add_resp("Respond Save Loan Account", RESP_FIRST, 3300, base_y + 200)

# 3) Update
UPDATE_CODE = r"""const b = $input.first().json.body || {};
const id = Number(b.loan_id);
if (!id) return [{ json: { query: "SELECT NULL::int AS loan_id, 'loan_id required' AS error_msg WHERE FALSE" } }];
const esc = v => v == null || v === '' ? 'NULL' : ("'" + String(v).replace(/'/g, "''") + "'");
const num = v => { if (v == null || v === '') return null; const n = Number(v); return isFinite(n) ? String(n) : null; };
const datExpr = v => v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? `'${String(v).slice(0,10)}'::date` : null;
const sets = [];
if (b.loan_name !== undefined) sets.push(`loan_name = ${esc(b.loan_name)}`);
if (b.lender !== undefined) sets.push(`lender = ${esc(b.lender)}`);
if (b.loan_type !== undefined) sets.push(`loan_type = ${esc(b.loan_type)}`);
if (b.account_no !== undefined) sets.push(`account_no = ${esc(b.account_no)}`);
if (b.principal !== undefined) { const v = num(b.principal); if (v !== null) sets.push(`principal = ${v}`); }
if (b.current_balance !== undefined) { const v = num(b.current_balance); if (v !== null) sets.push(`current_balance = ${v}`); }
if (b.interest_rate !== undefined) { const v = num(b.interest_rate); if (v !== null) sets.push(`interest_rate = ${v}`); }
if (b.interest_period !== undefined) sets.push(`interest_period = ${esc(b.interest_period)}`);
if (b.start_date !== undefined) { const v = datExpr(b.start_date); sets.push(`start_date = ${v || 'NULL'}`); }
if (b.due_date !== undefined) { const v = datExpr(b.due_date); sets.push(`due_date = ${v || 'NULL'}`); }
if (b.payment_schedule !== undefined) sets.push(`payment_schedule = ${esc(b.payment_schedule)}`);
if (b.note !== undefined) sets.push(`note = ${esc(b.note)}`);
if (b.status !== undefined) sets.push(`status = ${esc(b.status)}`);
sets.push("updated_at = NOW()");
const query = `UPDATE loan_accounts SET ${sets.join(', ')} WHERE loan_id = ${id} RETURNING loan_id, loan_name, status`;
return [{ json: { query } }];"""

add_code("Code Update Loan Account", UPDATE_CODE, 2700, base_y + 400)
add_pg("Q: Update Loan Account", "{{ $json.query }}", 3000, base_y + 400)
add_resp("Respond Update Loan Account", RESP_FIRST, 3300, base_y + 400)

# ----- Connections -----
conns = wf.setdefault('connections', {})
sw_node = next(n for n in wf['nodes'] if n['name'] == 'Switch Action')
rules = sw_node['parameters']['rules']['values']

def connect(out_key, target_node):
    out_idx = next(i for i, r in enumerate(rules) if r['outputKey'] == out_key)
    sw_conns = conns.setdefault('Switch Action', {}).setdefault('main', [])
    while len(sw_conns) <= out_idx:
        sw_conns.append([])
    if not any(t.get('node') == target_node for t in sw_conns[out_idx]):
        sw_conns[out_idx].append({"node": target_node, "type": "main", "index": 0})
        print(f"OK: connected Switch[{out_idx}] -> {target_node}")

# Switch -> Q (list) / Code (save/update)
connect("list_loan_accounts", "Q: List Loan Accounts")
connect("save_loan_account", "Code Save Loan Account")
connect("update_loan_account", "Code Update Loan Account")

# Code -> Q -> Respond (chain)
def chain(src_name, mid_name, dst_name):
    if src_name not in conns:
        conns[src_name] = {"main": [[{"node": mid_name, "type": "main", "index": 0}]]}
        print(f"OK: connected {src_name} -> {mid_name}")
    if mid_name not in conns:
        conns[mid_name] = {"main": [[{"node": dst_name, "type": "main", "index": 0}]]}
        print(f"OK: connected {mid_name} -> {dst_name}")

# list: Q -> Respond directly
if "Q: List Loan Accounts" not in conns:
    conns["Q: List Loan Accounts"] = {"main": [[{"node": "Respond List Loan Accounts", "type": "main", "index": 0}]]}
    print("OK: connected Q: List Loan Accounts -> Respond")

# save: Code -> Q -> Respond
chain("Code Save Loan Account", "Q: Save Loan Account", "Respond Save Loan Account")
# update: Code -> Q -> Respond
chain("Code Update Loan Account", "Q: Update Loan Account", "Respond Update Loan Account")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved to {dst}")
print(f"Total nodes: {len(wf['nodes'])}")
