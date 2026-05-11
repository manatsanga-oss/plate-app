"""
เพิ่ม actions สำหรับระบบ "บันทึกเงินออกแทนและค่าคอมพิเศษ" ใน Accounting API
- list_moto_products: ดึง master ทั้งหมด (filter by brand/active)
- save_moto_product: insert/update master
- delete_moto_product: soft-delete (active=false)
- list_moto_extra_rules: ดึง rules ของ product
- save_moto_extra_rule: insert rule ใหม่ (effective_date)
- delete_moto_extra_rule: soft-delete (active=false)
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")
dst = src
wf = json.loads(src.read_text(encoding='utf-8'))

postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']; break

def add_switch_rule(out_key, id_):
    sw = next(n for n in wf['nodes'] if n.get('name')=='Switch Action' and n.get('type')=='n8n-nodes-base.switch')
    rules = sw['parameters']['rules']['values']
    if not any(r.get('outputKey')==out_key for r in rules):
        rules.append({
            "conditions": {"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict","version":2},
                "conditions":[{"id":id_,"leftValue":"={{ $json.body.action }}","rightValue":out_key,
                    "operator":{"type":"string","operation":"equals"}}],"combinator":"and"},
            "renameOutput":True,"outputKey":out_key,
        })
        print(f"OK: Switch '{out_key}'")
    return next(i for i,r in enumerate(rules) if r['outputKey']==out_key)

def add_pg(name, query, x, y):
    existing = {n['name'] for n in wf['nodes']}
    if name in existing:
        next(n for n in wf['nodes'] if n['name']==name)['parameters']['query'] = query
        print(f"OK: updated {name}")
    else:
        node = {"parameters":{"operation":"executeQuery","query":query,"options":{}},
            "type":"n8n-nodes-base.postgres","typeVersion":2.6,
            "position":[x,y],"id":str(uuid.uuid4()),"name":name}
        if postgres_creds: node["credentials"] = postgres_creds
        wf['nodes'].append(node)
        print(f"OK: added {name}")

def add_resp(name, x, y):
    RESP = {"respondWith":"json","responseBody":"={{ JSON.stringify($input.all().map(i => i.json)) }}",
        "options":{"responseHeaders":{"entries":[{"name":"Access-Control-Allow-Origin","value":"*"}]}}}
    existing = {n['name'] for n in wf['nodes']}
    if name in existing:
        next(n for n in wf['nodes'] if n['name']==name)['parameters'] = RESP
    else:
        wf['nodes'].append({"parameters":RESP,"type":"n8n-nodes-base.respondToWebhook",
            "typeVersion":1.5,"position":[x,y],"id":str(uuid.uuid4()),"name":name})

def conn(out_idx, q_name, resp_name):
    conns = wf.setdefault('connections',{})
    sw_conns = conns.setdefault('Switch Action',{}).setdefault('main',[])
    while len(sw_conns) <= out_idx: sw_conns.append([])
    if not any(t.get('node')==q_name for t in sw_conns[out_idx]):
        sw_conns[out_idx].append({"node":q_name,"type":"main","index":0})
    if q_name not in conns:
        conns[q_name] = {"main":[[{"node":resp_name,"type":"main","index":0}]]}

base_y = 18000

# ----- list_moto_products -----
i = add_switch_rule("list_moto_products","mplist")
add_pg("Q: List Moto Products",
    "SELECT product_id, brand, model_name, variant, type_code, note, active "
    "FROM moto_products "
    "WHERE (NULLIF('{{ $json.body.brand }}','') IS NULL OR brand = '{{ $json.body.brand }}') "
    "  AND (NULLIF('{{ $json.body.include_inactive }}','true') IS NOT NULL OR active = TRUE) "
    "ORDER BY brand, model_name, variant NULLS FIRST, type_code NULLS FIRST",
    3000, base_y)
add_resp("Respond List Moto Products", 3300, base_y)
conn(i, "Q: List Moto Products", "Respond List Moto Products")

# ----- save_moto_product -----
i = add_switch_rule("save_moto_product","mpsave")
add_pg("Q: Save Moto Product",
    "INSERT INTO moto_products(product_id, brand, model_name, variant, type_code, note, active, created_by, updated_at) "
    "VALUES ("
    "  CASE WHEN NULLIF('{{ $json.body.product_id }}','')::int IS NULL THEN nextval('moto_products_product_id_seq') ELSE NULLIF('{{ $json.body.product_id }}','')::int END, "
    "  '{{ $json.body.brand }}', '{{ $json.body.model_name }}', "
    "  NULLIF('{{ $json.body.variant }}','')::text, NULLIF('{{ $json.body.type_code }}','')::text, "
    "  NULLIF('{{ $json.body.note }}','')::text, "
    "  COALESCE(NULLIF('{{ $json.body.active }}','')::boolean, TRUE), "
    "  NULLIF('{{ $json.body.created_by }}','')::text, NOW()"
    ") "
    "ON CONFLICT (product_id) DO UPDATE SET "
    "  brand = EXCLUDED.brand, model_name = EXCLUDED.model_name, "
    "  variant = EXCLUDED.variant, type_code = EXCLUDED.type_code, "
    "  note = EXCLUDED.note, active = EXCLUDED.active, updated_at = NOW() "
    "RETURNING product_id, brand, model_name, variant, type_code",
    3000, base_y+1000)
add_resp("Respond Save Moto Product", 3300, base_y+1000)
conn(i, "Q: Save Moto Product", "Respond Save Moto Product")

# ----- delete_moto_product (soft) -----
i = add_switch_rule("delete_moto_product","mpdel")
add_pg("Q: Delete Moto Product",
    "UPDATE moto_products SET active = FALSE, updated_at = NOW() "
    "WHERE product_id = {{ $json.body.product_id }} RETURNING product_id",
    3000, base_y+2000)
add_resp("Respond Delete Moto Product", 3300, base_y+2000)
conn(i, "Q: Delete Moto Product", "Respond Delete Moto Product")

# ----- list_moto_extra_rules -----
i = add_switch_rule("list_moto_extra_rules","mrlist")
add_pg("Q: List Extra Rules",
    "SELECT r.rule_id, r.product_id, r.payment_type, r.amount, r.effective_date, r.end_date, r.note, r.active, "
    "p.brand, p.model_name, p.variant, p.type_code "
    "FROM moto_extra_payment_rules r "
    "JOIN moto_products p ON p.product_id = r.product_id "
    "WHERE (NULLIF('{{ $json.body.product_id }}','')::int IS NULL OR r.product_id = NULLIF('{{ $json.body.product_id }}','')::int) "
    "  AND (NULLIF('{{ $json.body.payment_type }}','') IS NULL OR r.payment_type = '{{ $json.body.payment_type }}') "
    "  AND (NULLIF('{{ $json.body.include_inactive }}','true') IS NOT NULL OR r.active = TRUE) "
    "ORDER BY p.brand, p.model_name, r.payment_type, r.effective_date DESC",
    3000, base_y+3000)
add_resp("Respond List Extra Rules", 3300, base_y+3000)
conn(i, "Q: List Extra Rules", "Respond List Extra Rules")

# ----- save_moto_extra_rule -----
i = add_switch_rule("save_moto_extra_rule","mrsave")
add_pg("Q: Save Extra Rule",
    "INSERT INTO moto_extra_payment_rules(rule_id, product_id, payment_type, amount, effective_date, end_date, note, active, created_by) "
    "VALUES ("
    "  CASE WHEN NULLIF('{{ $json.body.rule_id }}','')::int IS NULL THEN nextval('moto_extra_payment_rules_rule_id_seq') ELSE NULLIF('{{ $json.body.rule_id }}','')::int END, "
    "  {{ $json.body.product_id }}, '{{ $json.body.payment_type }}', "
    "  {{ $json.body.amount }}::numeric, "
    "  '{{ $json.body.effective_date }}'::date, "
    "  NULLIF('{{ $json.body.end_date }}','')::date, "
    "  NULLIF('{{ $json.body.note }}','')::text, "
    "  COALESCE(NULLIF('{{ $json.body.active }}','')::boolean, TRUE), "
    "  NULLIF('{{ $json.body.created_by }}','')::text"
    ") "
    "ON CONFLICT (rule_id) DO UPDATE SET "
    "  amount = EXCLUDED.amount, effective_date = EXCLUDED.effective_date, "
    "  end_date = EXCLUDED.end_date, note = EXCLUDED.note, active = EXCLUDED.active "
    "RETURNING rule_id, product_id, payment_type, amount",
    3000, base_y+4000)
add_resp("Respond Save Extra Rule", 3300, base_y+4000)
conn(i, "Q: Save Extra Rule", "Respond Save Extra Rule")

# ----- delete_moto_extra_rule (soft) -----
i = add_switch_rule("delete_moto_extra_rule","mrdel")
add_pg("Q: Delete Extra Rule",
    "UPDATE moto_extra_payment_rules SET active = FALSE WHERE rule_id = {{ $json.body.rule_id }} RETURNING rule_id",
    3000, base_y+5000)
add_resp("Respond Delete Extra Rule", 3300, base_y+5000)
conn(i, "Q: Delete Extra Rule", "Respond Delete Extra Rule")

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved to {dst}")
