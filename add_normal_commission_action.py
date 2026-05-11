"""
เพิ่ม actions รายงานค่าคอมปกติ ใน Sales Extra Pay API
- commission_normal_summary
- commission_normal_detail
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

# common CTE for both summary and detail
COMMON_CTE = (
    "WITH "
    "qualifying_workdays AS ("
    "  SELECT DISTINCT e.employee_id, e.employee_name, e.branch_code, t.clock_date AS work_date "
    "  FROM time_tracking_records t "
    "  JOIN hr_employees e ON (TRIM(e.employee_name)=TRIM(t.employee_name) OR TRIM(e.english_name)=TRIM(t.employee_name)) "
    "  WHERE COALESCE(e.commission_method, FALSE) = TRUE "
    "    AND t.clock_in IS NOT NULL AND t.clock_in <> '-' "
    "    AND t.clock_date >= COALESCE(NULLIF(NULLIF('{{ $json.body.date_from }}',''),'undefined')::date, '1900-01-01'::date) "
    "    AND t.clock_date <= COALESCE(NULLIF(NULLIF('{{ $json.body.date_to }}',''),'undefined')::date, '9999-12-31'::date)"
    "), "
    "sales_norm AS ("
    "  SELECT ms.id AS sale_id, ms.sale_date, ms.invoice_no, ms.invoice_type, ms.customer_name, "
    "         ms.brand, ms.model_series, ms.model_code, ms.chassis_no, "
    "         CASE WHEN ms.branch_code IS NULL OR ms.branch_code IN ('','00000') "
    "              THEN SUBSTRING(ms.invoice_no FROM 1 FOR 5) ELSE ms.branch_code END AS branch_code "
    "  FROM moto_sales ms "
    "  WHERE ms.sale_date >= COALESCE(NULLIF(NULLIF('{{ $json.body.date_from }}',''),'undefined')::date, '1900-01-01'::date) "
    "    AND ms.sale_date <= COALESCE(NULLIF(NULLIF('{{ $json.body.date_to }}',''),'undefined')::date, '9999-12-31'::date)"
    "), "
    "sales_with_emp AS ("
    "  SELECT s.*, we.employee_id, we.employee_name, "
    "         COUNT(*) OVER (PARTITION BY s.sale_id) AS headcount "
    "  FROM sales_norm s "
    "  JOIN qualifying_workdays we ON we.work_date = s.sale_date AND we.branch_code = s.branch_code"
    "), "
    "indexed AS ("
    "  SELECT *, ROW_NUMBER() OVER ("
    "    PARTITION BY employee_id, EXTRACT(YEAR FROM sale_date), EXTRACT(MONTH FROM sale_date) "
    "    ORDER BY invoice_no, sale_id) AS idx "
    "  FROM sales_with_emp"
    "), "
    "with_target AS ("
    "  SELECT i.*, COALESCE(b.sales_target, 100) AS target "
    "  FROM indexed i "
    "  LEFT JOIN branch_master b ON b.branch_code = i.branch_code"
    "), "
    "calc AS ("
    "  SELECT *, "
    "    CASE WHEN branch_code = 'SCY01' THEN "
    "           CASE WHEN invoice_type = 'ขายปลีก' THEN 0 "
    "                WHEN idx > target THEN 300 ELSE 100 END "
    "         WHEN branch_code IN ('SCY04','SCY07') THEN "
    "           CASE WHEN invoice_type = 'ขายปลีก' THEN 0 "
    "                WHEN idx > 50 THEN 300 "
    "                ELSE 300.0 / NULLIF(headcount,0) END "
    "         WHEN branch_code = 'SCY06' THEN "
    "           CASE WHEN idx <= 40 THEN 0 "
    "                ELSE 300 + FLOOR((idx-41)::numeric/10) * 10 END "
    "         WHEN branch_code = 'SCY05' THEN "
    "           CASE WHEN idx <= 20 THEN 0 "
    "                ELSE 300 + FLOOR((idx-41)::numeric/10) * 10 END "
    "         ELSE 0 END AS comm_main, "
    "    CASE WHEN branch_code IN ('SCY05','SCY06') AND invoice_type = 'ขายไฟแนนซ์' "
    "         THEN 300.0 / NULLIF(headcount,0) ELSE 0 END AS comm_finance "
    "  FROM with_target"
    ") "
)

actions = [
    ("commission_normal_summary",
     COMMON_CTE +
     "SELECT employee_id, employee_name, branch_code, "
     "       COUNT(DISTINCT sale_id) AS sales_count, "
     "       SUM(comm_main) AS total_main, "
     "       SUM(comm_finance) AS total_finance, "
     "       SUM(comm_main + comm_finance) AS total_commission "
     "FROM calc "
     "GROUP BY employee_id, employee_name, branch_code "
     "ORDER BY total_commission DESC NULLS LAST"),

    ("commission_normal_detail",
     COMMON_CTE +
     "SELECT sale_id, sale_date, branch_code, invoice_no, invoice_type, customer_name, "
     "       brand, model_series, model_code, chassis_no, "
     "       idx, target, headcount, comm_main, comm_finance, (comm_main + comm_finance) AS comm_total, "
     "       employee_id, employee_name "
     "FROM calc "
     "WHERE (NULLIF(NULLIF('{{ $json.body.employee_id }}',''),'undefined')::int IS NULL "
     "       OR employee_id = NULLIF(NULLIF('{{ $json.body.employee_id }}',''),'undefined')::int) "
     "ORDER BY employee_id, sale_date, idx LIMIT 5000"),
]

sw = next(n for n in wf['nodes'] if n.get('name')=='Switch Action' and n.get('type')=='n8n-nodes-base.switch')
rules = sw['parameters']['rules']['values']
connections = wf.setdefault('connections', {})
sw_conns = connections.setdefault('Switch Action', {}).setdefault('main', [])

base_y = 6500
for offset, (key, query) in enumerate(actions):
    if not any(r.get('outputKey')==key for r in rules):
        rules.append({
            "conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict","version":2},
                "conditions":[{"id":f"nc{offset}","leftValue":"={{ $json.body.action }}","rightValue":key,
                    "operator":{"type":"string","operation":"equals"}}],"combinator":"and"},
            "renameOutput":True,"outputKey":key,
        })
    idx = next(i for i,r in enumerate(rules) if r['outputKey']==key)
    y = base_y + offset*300
    q_name = f"Q: {key}"
    r_name = f"Respond: {key}"
    existing = {n['name'] for n in wf['nodes']}
    if q_name in existing:
        next(n for n in wf['nodes'] if n['name']==q_name)['parameters']['query'] = query
    else:
        node = {"parameters":{"operation":"executeQuery","query":query,"options":{}},
            "type":"n8n-nodes-base.postgres","typeVersion":2.6,
            "position":[1200,y],"id":str(uuid.uuid4()),"name":q_name,"alwaysOutputData":True}
        if postgres_creds: node["credentials"] = postgres_creds
        wf['nodes'].append(node)
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
    print(f"OK: {key}")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print("OK: saved")
