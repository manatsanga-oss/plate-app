import json
import uuid

with open(r'C:/Users/manat/plate-app/office_api_single.json', encoding='utf-8') as f:
    data = json.load(f)

nodes = data['nodes']
connections = data['connections']

# 1. Update Init DB node to add unit_conversions table
init_node = next(n for n in nodes if n['name'] == 'Init DB')
new_table_sql = "\nCREATE TABLE IF NOT EXISTS unit_conversions (conversion_id SERIAL PRIMARY KEY, conversion_no VARCHAR(50) UNIQUE, conversion_date DATE NOT NULL, source_product_id VARCHAR(50), source_product_name VARCHAR(255), source_unit VARCHAR(50), source_qty NUMERIC(10,2), source_cost_per_unit NUMERIC(12,4), target_product_id VARCHAR(50), target_product_name VARCHAR(255), target_unit VARCHAR(50), target_qty NUMERIC(10,2), target_cost_per_unit NUMERIC(12,4), note TEXT, created_by VARCHAR(100), created_at TIMESTAMP DEFAULT NOW());"
init_node['parameters']['query'] += new_table_sql

# 2. Add Switch cases (output 15, 16, 17)
sw = next(n for n in nodes if n['type'].endswith('switch'))
rules = sw['parameters']['rules']['rules']
rules.append({"value2": "get_convert_data", "output": 15})
rules.append({"value2": "save_conversion", "output": 16})
rules.append({"value2": "get_conversion_history", "output": 17})

# 3. Define new nodes
new_nodes = [
    # === get_convert_data (output 15) ===
    {
        "parameters": {
            "operation": "executeQuery",
            "query": "SELECT p.product_id, p.product_name, p.unit, COALESCE(s.qty_on_hand, 0) AS qty_on_hand, COALESCE((SELECT ROUND(SUM(ri.amount)::numeric / NULLIF(SUM(ri.qty)::numeric, 0), 4) FROM receive_items ri WHERE ri.product_id = p.product_id), 0) AS avg_cost_per_unit FROM products p LEFT JOIN stock s ON p.product_id = s.product_id WHERE p.is_active = true ORDER BY p.product_name",
            "options": {}
        },
        "credentials": {"postgres": {"id": "REPLACE_POSTGRES_CREDENTIAL_ID", "name": "Postgres account"}},
        "id": "a1b2c3d4-1500-1500-1500-000000001500",
        "name": "Postgres Get Convert Data",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2,
        "position": [720, 1200]
    },
    {
        "parameters": {
            "jsCode": "const rows = $input.all().map(i => i.json);\nreturn [{ json: { success: true, data: rows } }];"
        },
        "id": "a1b2c3d4-1501-1501-1501-000000001501",
        "name": "Code Convert Data List",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [960, 1200]
    },
    {
        "parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify($json) }}", "options": {}},
        "id": "a1b2c3d4-1502-1502-1502-000000001502",
        "name": "Respond Get Convert Data",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [1200, 1200]
    },

    # === save_conversion (output 16) ===
    {
        "parameters": {
            "jsCode": "const body = $input.first().json.body;\nconst convNo = 'CNV-' + Date.now();\nconst convDate = body.conversion_date || new Date().toISOString().split('T')[0];\nconst srcId = (body.source_product_id || '').replace(/'/g, \"''\");\nconst srcName = (body.source_product_name || '').replace(/'/g, \"''\");\nconst srcUnit = (body.source_unit || '').replace(/'/g, \"''\");\nconst srcQty = parseFloat(body.source_qty) || 0;\nconst srcCost = parseFloat(body.source_cost_per_unit) || 0;\nconst tgtId = (body.target_product_id || '').replace(/'/g, \"''\");\nconst tgtName = (body.target_product_name || '').replace(/'/g, \"''\");\nconst tgtUnit = (body.target_unit || '').replace(/'/g, \"''\");\nconst tgtQty = parseFloat(body.target_qty) || 0;\nconst tgtCost = srcQty > 0 && tgtQty > 0 ? Math.round((srcCost * srcQty / tgtQty) * 10000) / 10000 : 0;\nconst note = (body.note || '').replace(/'/g, \"''\");\nconst createdBy = (body.created_by || '').replace(/'/g, \"''\");\n\nconst sql = `INSERT INTO unit_conversions (conversion_no, conversion_date, source_product_id, source_product_name, source_unit, source_qty, source_cost_per_unit, target_product_id, target_product_name, target_unit, target_qty, target_cost_per_unit, note, created_by) VALUES ('${convNo}', '${convDate}', '${srcId}', '${srcName}', '${srcUnit}', ${srcQty}, ${srcCost}, '${tgtId}', '${tgtName}', '${tgtUnit}', ${tgtQty}, ${tgtCost}, '${note}', '${createdBy}');\nUPDATE stock SET qty_on_hand = qty_on_hand - ${srcQty}, updated_at = NOW() WHERE product_id = '${srcId}';\nINSERT INTO stock (product_id, qty_on_hand) VALUES ('${tgtId}', ${tgtQty}) ON CONFLICT (product_id) DO UPDATE SET qty_on_hand = stock.qty_on_hand + ${tgtQty}, updated_at = NOW();`;\n\nreturn [{ json: { sql, conversion_no: convNo } }];"
        },
        "id": "a1b2c3d4-1600-1600-1600-000000001600",
        "name": "Code Prepare Save Conversion",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [720, 1300]
    },
    {
        "parameters": {
            "operation": "executeQuery",
            "query": "={{ $json.sql }}",
            "options": {}
        },
        "credentials": {"postgres": {"id": "REPLACE_POSTGRES_CREDENTIAL_ID", "name": "Postgres account"}},
        "id": "a1b2c3d4-1601-1601-1601-000000001601",
        "name": "Postgres Save Conversion",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2,
        "position": [960, 1300]
    },
    {
        "parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ success: true, conversion_no: $('Code Prepare Save Conversion').first().json.conversion_no }) }}", "options": {}},
        "id": "a1b2c3d4-1602-1602-1602-000000001602",
        "name": "Respond Save Conversion",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [1200, 1300]
    },

    # === get_conversion_history (output 17) ===
    {
        "parameters": {
            "operation": "executeQuery",
            "query": "SELECT conversion_id, conversion_no, conversion_date, source_product_name, source_unit, source_qty, source_cost_per_unit, target_product_name, target_unit, target_qty, target_cost_per_unit, note, created_by, created_at FROM unit_conversions ORDER BY conversion_date DESC, conversion_id DESC LIMIT 100",
            "options": {}
        },
        "credentials": {"postgres": {"id": "REPLACE_POSTGRES_CREDENTIAL_ID", "name": "Postgres account"}},
        "id": "a1b2c3d4-1700-1700-1700-000000001700",
        "name": "Postgres Get Conversion History",
        "type": "n8n-nodes-base.postgres",
        "typeVersion": 2,
        "position": [720, 1400]
    },
    {
        "parameters": {
            "jsCode": "const rows = $input.all().map(i => i.json);\nreturn [{ json: { success: true, data: rows } }];"
        },
        "id": "a1b2c3d4-1701-1701-1701-000000001701",
        "name": "Code Conversion History List",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [960, 1400]
    },
    {
        "parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify($json) }}", "options": {}},
        "id": "a1b2c3d4-1702-1702-1702-000000001702",
        "name": "Respond Get Conversion History",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [1200, 1400]
    },
]

nodes.extend(new_nodes)

# 4. Add connections
sw_name = sw['name']
sw_conns = connections[sw_name]['main']

# Add 3 new outputs (15, 16, 17)
sw_conns.append([{"node": "Postgres Get Convert Data", "type": "main", "index": 0}])
sw_conns.append([{"node": "Code Prepare Save Conversion", "type": "main", "index": 0}])
sw_conns.append([{"node": "Postgres Get Conversion History", "type": "main", "index": 0}])

# get_convert_data chain
connections["Postgres Get Convert Data"] = {"main": [[{"node": "Code Convert Data List", "type": "main", "index": 0}]]}
connections["Code Convert Data List"] = {"main": [[{"node": "Respond Get Convert Data", "type": "main", "index": 0}]]}

# save_conversion chain
connections["Code Prepare Save Conversion"] = {"main": [[{"node": "Postgres Save Conversion", "type": "main", "index": 0}]]}
connections["Postgres Save Conversion"] = {"main": [[{"node": "Respond Save Conversion", "type": "main", "index": 0}]]}

# get_conversion_history chain
connections["Postgres Get Conversion History"] = {"main": [[{"node": "Code Conversion History List", "type": "main", "index": 0}]]}
connections["Code Conversion History List"] = {"main": [[{"node": "Respond Get Conversion History", "type": "main", "index": 0}]]}

with open(r'C:/Users/manat/plate-app/office_api_single.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Done! Added 9 nodes and 3 switch cases for unit conversion.")
print("New actions: get_convert_data, save_conversion, get_conversion_history")
