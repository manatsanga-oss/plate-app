"""
เพิ่ม actions สำหรับรายงานค่าคอมพิเศษ ใน Sales Extra Pay API:
- commission_split_summary: สรุปต่อพนักงาน
- commission_split_detail: รายการ sale ของพนักงาน 1 คน
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

dst = Path(r"C:/Users/manat/OneDrive/New folder/Sales Extra Pay API.json")
wf = json.loads(dst.read_text(encoding='utf-8'))

postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']; break

# CTE common
COMMON_CTE = (
    "WITH sales_with_type AS ("
    "  SELECT ms.id AS sale_id, ms.sale_date, ms.branch_code, ms.invoice_no, ms.customer_name, "
    "         ms.brand, ms.model_series, ms.model_code, ms.color_code, ms.color_name, ms.chassis_no, ms.engine_no, "
    "         t.type_id, t.type_name "
    "  FROM moto_sales ms "
    "  LEFT JOIN moto_types t ON t.type_name = ms.model_code "
    "  WHERE ms.sale_date >= COALESCE(NULLIF(NULLIF('{{ $json.body.date_from }}',''),'undefined')::date, '1900-01-01'::date) "
    "    AND ms.sale_date <= COALESCE(NULLIF(NULLIF('{{ $json.body.date_to }}',''),'undefined')::date, '9999-12-31'::date) "
    "    AND (NULLIF(NULLIF('{{ $json.body.branch_code }}',''),'undefined') IS NULL OR ms.branch_code = NULLIF(NULLIF('{{ $json.body.branch_code }}',''),'undefined')) "
    "), "
    "sales_with_comm AS ("
    "  SELECT s.*, get_active_extra_rule(s.type_id, 'commission', s.sale_date) AS comm_amount "
    "  FROM sales_with_type s WHERE s.type_id IS NOT NULL"
    "), "
    "working_employees AS ("
    "  SELECT DISTINCT e.employee_id, e.employee_name, e.branch_code, t.clock_date AS work_date "
    "  FROM time_tracking_records t "
    "  JOIN hr_employees e ON (TRIM(e.employee_name) = TRIM(t.employee_name) OR TRIM(e.english_name) = TRIM(t.employee_name)) "
    "  WHERE COALESCE(e.special_commission, FALSE) = TRUE "
    "    AND t.clock_in IS NOT NULL AND t.clock_in <> '-' "
    "    AND t.clock_date >= COALESCE(NULLIF(NULLIF('{{ $json.body.date_from }}',''),'undefined')::date, '1900-01-01'::date) "
    "    AND t.clock_date <= COALESCE(NULLIF(NULLIF('{{ $json.body.date_to }}',''),'undefined')::date, '9999-12-31'::date)"
    "), "
    "allocations AS ("
    "  SELECT s.sale_id, s.sale_date, s.branch_code, s.invoice_no, s.customer_name, "
    "         s.brand, s.model_series, s.model_code, s.color_name, s.chassis_no, s.type_name, "
    "         s.comm_amount, we.employee_id, we.employee_name, "
    "         (s.comm_amount / NULLIF(COUNT(*) OVER (PARTITION BY s.sale_id), 0)) AS per_emp_amount, "
    "         COUNT(*) OVER (PARTITION BY s.sale_id) AS split_count "
    "  FROM sales_with_comm s "
    "  JOIN working_employees we ON we.work_date = s.sale_date AND we.branch_code = s.branch_code "
    "  WHERE s.comm_amount > 0"
    ") "
)

actions = [
    ("commission_split_summary",
     COMMON_CTE +
     "SELECT employee_id, employee_name, branch_code, "
     "       COUNT(DISTINCT sale_id) AS sales_count, "
     "       SUM(per_emp_amount) AS total_commission "
     "FROM allocations "
     "GROUP BY employee_id, employee_name, branch_code "
     "ORDER BY total_commission DESC NULLS LAST"),

    ("commission_split_detail",
     COMMON_CTE +
     "SELECT sale_id, sale_date, branch_code, invoice_no, customer_name, brand, model_series, model_code, color_name, chassis_no, type_name, "
     "       comm_amount, per_emp_amount, split_count, employee_id, employee_name "
     "FROM allocations "
     "WHERE (NULLIF(NULLIF('{{ $json.body.employee_id }}',''),'undefined')::int IS NULL OR employee_id = NULLIF(NULLIF('{{ $json.body.employee_id }}',''),'undefined')::int) "
     "ORDER BY sale_date DESC, sale_id DESC LIMIT 5000"),
]

# add Switch rules
sw = next(n for n in wf['nodes'] if n.get('name')=='Switch Action' and n.get('type')=='n8n-nodes-base.switch')
rules = sw['parameters']['rules']['values']

def ensure_rule(out_key, id_):
    if not any(r.get('outputKey')==out_key for r in rules):
        rules.append({
            "conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict","version":2},
                "conditions":[{"id":id_,"leftValue":"={{ $json.body.action }}","rightValue":out_key,
                    "operator":{"type":"string","operation":"equals"}}],"combinator":"and"},
            "renameOutput":True,"outputKey":out_key,
        })
        print(f"OK: Switch '{out_key}'")
    return next(i for i,r in enumerate(rules) if r['outputKey']==out_key)

connections = wf.setdefault('connections', {})
sw_conns = connections.setdefault('Switch Action', {}).setdefault('main', [])

base_y = 2000
for offset, (key, query) in enumerate(actions):
    idx = ensure_rule(key, f"comm{offset}")
    y = base_y + offset * 300

    q_name = f"Q: {key}"
    r_name = f"Respond: {key}"

    existing = {n['name'] for n in wf['nodes']}
    if q_name in existing:
        next(n for n in wf['nodes'] if n['name']==q_name)['parameters']['query'] = query
        print(f"OK: updated {q_name}")
    else:
        node = {"parameters":{"operation":"executeQuery","query":query,"options":{}},
            "type":"n8n-nodes-base.postgres","typeVersion":2.6,
            "position":[1200,y],"id":str(uuid.uuid4()),"name":q_name,
            "alwaysOutputData":True}
        if postgres_creds: node["credentials"] = postgres_creds
        wf['nodes'].append(node)
        print(f"OK: added {q_name}")

    if r_name not in existing:
        wf['nodes'].append({"parameters":{"respondWith":"json",
            "responseBody":"={{ JSON.stringify($input.all().map(i => i.json)) }}",
            "options":{"responseHeaders":{"entries":[
                {"name":"Access-Control-Allow-Origin","value":"*"},
                {"name":"Access-Control-Allow-Methods","value":"POST, OPTIONS"},
                {"name":"Access-Control-Allow-Headers","value":"Content-Type"}]}}},
            "type":"n8n-nodes-base.respondToWebhook","typeVersion":1.5,
            "position":[1500,y],"id":str(uuid.uuid4()),"name":r_name})

    while len(sw_conns) <= idx: sw_conns.append([])
    if not any(t.get('node')==q_name for t in sw_conns[idx]):
        sw_conns[idx].append({"node":q_name,"type":"main","index":0})
    if q_name not in connections:
        connections[q_name] = {"main":[[{"node":r_name,"type":"main","index":0}]]}

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved")
