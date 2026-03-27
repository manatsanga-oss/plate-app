import json

with open('office_api_single.json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

# Remove old OCR nodes (0042, 0043, 0044)
old_ids = {
    'a1b2c3d4-0042-0042-0042-000000000042',
    'a1b2c3d4-0043-0043-0043-000000000043',
    'a1b2c3d4-0044-0044-0044-000000000044',
}
wf['nodes'] = [n for n in wf['nodes'] if n['id'] not in old_ids]

# New OCR pipeline nodes
code_prepare_ocr = {
    "parameters": {
        "jsCode": (
            "const body = $input.first().json.body;\n"
            "const base64 = body.image_base64 || '';\n"
            "const filename = body.filename || 'invoice.jpg';\n"
            "const mimeType = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';\n"
            "return [{ json: { filename, mimeType }, binary: { data: { data: base64, mimeType: mimeType, fileName: filename } } }];"
        )
    },
    "id": "a1b2c3d4-0042-0042-0042-000000000042",
    "name": "Code Prepare OCR",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [720, 1100]
}

http_upload_mistral = {
    "parameters": {
        "method": "POST",
        "url": "https://api.mistral.ai/v1/files",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "mistralCloudApi",
        "sendBody": True,
        "contentType": "multipart-form-data",
        "bodyParameters": {
            "parameters": [
                {"name": "purpose", "value": "ocr"},
                {"parameterType": "formBinaryData", "name": "file", "inputDataFieldName": "data"}
            ]
        },
        "options": {}
    },
    "credentials": {
        "mistralCloudApi": {"id": "o6VWlsFkBOxJYLAZ", "name": "Mistral Cloud account"}
    },
    "id": "a1b2c3d4-0043-0043-0043-000000000043",
    "name": "HTTP Upload Mistral",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [960, 1100]
}

http_get_mistral_url = {
    "parameters": {
        "url": "=https://api.mistral.ai/v1/files/{{ $json.id }}/url",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "mistralCloudApi",
        "sendQuery": True,
        "queryParameters": {
            "parameters": [{"name": "expiry", "value": "24"}]
        },
        "options": {}
    },
    "credentials": {
        "mistralCloudApi": {"id": "o6VWlsFkBOxJYLAZ", "name": "Mistral Cloud account"}
    },
    "id": "a1b2c3d4-0045-0045-0045-000000000045",
    "name": "HTTP Get Mistral URL",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [1200, 1100]
}

http_mistral_ocr = {
    "parameters": {
        "method": "POST",
        "url": "https://api.mistral.ai/v1/ocr",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "mistralCloudApi",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": '={"model": "mistral-ocr-latest", "document": {"type": "image_url", "image_url": "{{ $json.url }}"}, "include_image_base64": false}',
        "options": {"response": {"response": {"responseFormat": "json"}}}
    },
    "credentials": {
        "mistralCloudApi": {"id": "o6VWlsFkBOxJYLAZ", "name": "Mistral Cloud account"}
    },
    "id": "a1b2c3d4-0046-0046-0046-000000000046",
    "name": "HTTP Mistral OCR",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [1440, 1100]
}

system_prompt = (
    "คุณคือผู้ช่วยแปลง OCR จากใบส่งสินค้าภาษาไทยให้เป็น JSON\n"
    "กติกา: ตอบ JSON เท่านั้น ห้าม markdown ห้ามคำอธิบาย ถ้าไม่พบใช้ null "
    "วันที่รูปแบบ YYYY-MM-DD ตัวเลขเป็น number\n"
    'โครงสร้าง JSON: {"seller":{"name_th":null,"name_en":null,"tax_id":null,"address_th":null,"tel":null},'
    '"buyer":{"name":null,"tax_id":null,"branch":null,"address":null},'
    '"ship_to":{"customer_code":null,"name":null,"address":null},'
    '"document":{"doc_no":null,"date":null,"payment_type":null,"credit_term":null,"due_date":null,"so_no":null},'
    '"items":[{"item_no":1,"code":null,"description_raw":null,"description_clean":null,'
    '"quantity":null,"unit":null,"unit_price":null,"net_amount":null,"quantity_inferred":false}]}'
)

code_prepare_openai = {
    "parameters": {
        "jsCode": (
            "const ocr = $input.first().json;\n"
            "const markdown = (ocr.pages && ocr.pages[0] && ocr.pages[0].markdown) ? ocr.pages[0].markdown : 'ไม่พบข้อความ';\n"
            "const systemPrompt = " + json.dumps(system_prompt) + ";\n"
            "return [{ json: { model: 'gpt-4.1-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: markdown }] } }];"
        )
    },
    "id": "a1b2c3d4-0047-0047-0047-000000000047",
    "name": "Code Prepare OpenAI Request",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [1680, 1100]
}

http_openai_parse = {
    "parameters": {
        "method": "POST",
        "url": "https://api.openai.com/v1/chat/completions",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "openAiApi",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify($json) }}",
        "options": {"response": {"response": {"responseFormat": "json"}}}
    },
    "credentials": {
        "openAiApi": {"id": "odRg3D1h42QKDeOx", "name": "OpenAi account"}
    },
    "id": "a1b2c3d4-0048-0048-0048-000000000048",
    "name": "HTTP OpenAI Parse",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [1920, 1100]
}

code_normalize_ocr = {
    "parameters": {
        "jsCode": (
            "const resp = $input.first().json;\n"
            "const content = resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content;\n"
            "if (!content) return [{ json: { success: false, error: 'No response from OpenAI', items: [] } }];\n"
            "let parsed;\n"
            "try {\n"
            "  let clean = content.replace(/```json\\s*/gi, '').replace(/```\\s*/gi, '').trim();\n"
            "  parsed = JSON.parse(clean);\n"
            "} catch(e) {\n"
            "  return [{ json: { success: false, error: 'JSON parse failed', raw: content, items: [] } }];\n"
            "}\n"
            "function T(v) { return (v ?? '').toString().trim(); }\n"
            "function N(v) {\n"
            "  if (v == null || v === '') return null;\n"
            "  const n = Number(String(v).replace(/,/g,'').trim());\n"
            "  return Number.isFinite(n) ? n : null;\n"
            "}\n"
            "const items = Array.isArray(parsed.items) ? parsed.items.map((r, i) => ({\n"
            "  item_no: N(r.item_no) ?? (i + 1),\n"
            "  code: T(r.code) || null,\n"
            "  description_raw: T(r.description_raw) || null,\n"
            "  description_clean: T(r.description_clean) || null,\n"
            "  quantity: N(r.quantity),\n"
            "  unit: T(r.unit) || null,\n"
            "  unit_price: N(r.unit_price),\n"
            "  net_amount: N(r.net_amount),\n"
            "  quantity_inferred: !!r.quantity_inferred\n"
            "})) : [];\n"
            "return [{ json: { success: true, seller: parsed.seller || {}, buyer: parsed.buyer || {}, ship_to: parsed.ship_to || {}, document: parsed.document || {}, items } }];"
        )
    },
    "id": "a1b2c3d4-0049-0049-0049-000000000049",
    "name": "Code Normalize OCR",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [2160, 1100]
}

postgres_get_products = {
    "parameters": {
        "operation": "executeQuery",
        "query": "SELECT product_id, product_name, product_code, unit, product_group, keywords FROM products WHERE is_active = true ORDER BY product_id",
        "options": {}
    },
    "credentials": {
        "postgres": {"id": "REPLACE_POSTGRES_CREDENTIAL_ID", "name": "Postgres account"}
    },
    "id": "a1b2c3d4-0050-0050-0050-000000000050",
    "name": "Postgres Get Products OCR",
    "type": "n8n-nodes-base.postgres",
    "typeVersion": 2,
    "position": [2400, 1100]
}

code_match_products = {
    "parameters": {
        "jsCode": (
            "const ocr = $('Code Normalize OCR').first().json;\n"
            "const rows = $input.all().map(x => x.json);\n"
            "function T(v) { return (v ?? '').toString().trim(); }\n"
            "function N(v) {\n"
            "  if (v == null || v === '') return 0;\n"
            "  const n = Number(String(v).replace(/,/g,'').trim());\n"
            "  return Number.isFinite(n) ? n : 0;\n"
            "}\n"
            "function normCode(s) { return T(s).replace(/[\\s\\-_.\\/]/g,'').toUpperCase(); }\n"
            "function normName(s) {\n"
            "  let x = T(s).toLowerCase();\n"
            "  x = x.replace(/\\(.*?\\)/g,' ').replace(/\\b\\d+(\\.\\d+)?\\b/g,' ');\n"
            "  x = x.replace(/\\u0E19\\u0E34\\u0E49\\u0E27|\\u0E01\\u0E23\\u0E31\\u0E21|\\u0E01\\u0E01\\.?|kg|ml|\\u0E21\\u0E25\\.?|\\u0E25\\u0E34\\u0E15\\u0E23|\\u0E41\\u0E1E\\u0E47\\u0E04|\\u0E01\\u0E25\\u0E48\\u0E2D\\u0E07|\\u0E23\\u0E35\\u0E21|\\u0E2D\\u0E31\\u0E19|\\u0E14\\u0E49\\u0E32\\u0E21|\\u0E16\\u0E38\\u0E07|\\u0E0B\\u0E2D\\u0E07|\\u0E02\\u0E27\\u0E14|\\u0E41\\u0E01\\u0E25\\u0E25\\u0E2D\\u0E19|\\u0E0A\\u0E38\\u0E14|\\u0E41\\u0E1C\\u0E48\\u0E19|\\u0E41\\u0E17\\u0E48\\u0E07|\\u0E04\\u0E39\\u0E48|\\u0E42\\u0E2B\\u0E25/gi,' ');\n"
            "  return x.replace(/\\s+/g,' ').trim();\n"
            "}\n"
            "const products = rows.map(r => ({\n"
            "  product_id: T(r.product_id), product_name: T(r.product_name),\n"
            "  product_code: T(r.product_code), product_code_norm: normCode(r.product_code),\n"
            "  unit: T(r.unit), product_group: T(r.product_group),\n"
            "  norm_name: normName(r.product_name)\n"
            "})).filter(p => p.product_id && p.product_name);\n"
            "const byCode = new Map(products.filter(p => p.product_code_norm).map(p => [p.product_code_norm, p]));\n"
            "const byName = new Map(products.filter(p => p.norm_name).map(p => [p.norm_name, p]));\n"
            "function matchProduct(item) {\n"
            "  const codeNorm = normCode(T(item.code));\n"
            "  const nameNorm = normName(T(item.description_clean || item.description_raw || ''));\n"
            "  const unit = T(item.unit);\n"
            "  if (codeNorm && byCode.has(codeNorm)) { const p = byCode.get(codeNorm); return {...p, match_status:'MATCHED', match_score:1.0, matched_by:'product_code', unit: p.unit || unit}; }\n"
            "  if (nameNorm && byName.has(nameNorm)) { const p = byName.get(nameNorm); return {...p, match_status:'MATCHED', match_score:0.95, matched_by:'name_exact', unit: p.unit || unit}; }\n"
            "  const found = products.find(p => p.norm_name && nameNorm && (nameNorm.includes(p.norm_name) || p.norm_name.includes(nameNorm)));\n"
            "  if (found) return {...found, match_status:'MATCHED', match_score:0.85, matched_by:'name_contains', unit: found.unit || unit};\n"
            "  return {product_id:'', product_name:'', product_group:'', unit, match_status:'UNMATCHED', match_score:0, matched_by:''};\n"
            "}\n"
            "const doc = ocr.document || {};\n"
            "const ocrItems = Array.isArray(ocr.items) ? ocr.items : [];\n"
            "const matchedItems = ocrItems.map((r, idx) => {\n"
            "  const m = matchProduct(r);\n"
            "  const qty = N(r.quantity);\n"
            "  const unitPrice = N(r.unit_price);\n"
            "  const amount = (r.net_amount != null && r.net_amount !== '') ? N(r.net_amount) : qty * unitPrice;\n"
            "  return {\n"
            "    line_no: idx + 1,\n"
            "    product_code: T(r.code),\n"
            "    product_name_from_ocr: T(r.description_clean || r.description_raw || ''),\n"
            "    product_id: m.product_id, product_name: m.product_name, product_group: m.product_group,\n"
            "    qty, unit: m.unit || T(r.unit), unit_price: unitPrice, amount,\n"
            "    quantity_inferred: !!r.quantity_inferred,\n"
            "    match_status: m.match_status, match_score: m.match_score, matched_by: m.matched_by, remark: ''\n"
            "  };\n"
            "});\n"
            "const seller = ocr.seller || {};\n"
            "const buyer = ocr.buyer || {};\n"
            "const ship_to = ocr.ship_to || {};\n"
            "return [{ json: {\n"
            "  success: true,\n"
            "  header: {\n"
            "    receive_no: T(doc.doc_no), receive_date: T(doc.date),\n"
            "    vendor_name: T(seller.name_th || seller.name_en || ''),\n"
            "    vendor_tax_id: T(seller.tax_id || ''),\n"
            "    vendor_address: T(seller.address_th || seller.address_en || ''),\n"
            "    buyer_name: T(buyer.name || ''), buyer_tax_id: T(buyer.tax_id || ''),\n"
            "    buyer_branch: T(buyer.branch || ''), buyer_address: T(buyer.address || ''),\n"
            "    ship_to_code: T(ship_to.customer_code || ''), ship_to_name: T(ship_to.name || ''),\n"
            "    payment_type: T(doc.payment_type || ''), credit_term: N(doc.credit_term),\n"
            "    due_date: T(doc.due_date || ''), so_no: T(doc.so_no || ''),\n"
            "    created_by: '', remark: ''\n"
            "  },\n"
            "  items: matchedItems,\n"
            "  products_master: products,\n"
            "  summary: {\n"
            "    item_count: matchedItems.length,\n"
            "    matched_count: matchedItems.filter(r => r.match_status === 'MATCHED').length,\n"
            "    unmatched_count: matchedItems.filter(r => r.match_status !== 'MATCHED').length,\n"
            "    product_count: products.length\n"
            "  }\n"
            "}}];"
        )
    },
    "id": "a1b2c3d4-0051-0051-0051-000000000051",
    "name": "Code Match Products",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [2640, 1100]
}

respond_ocr = {
    "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($json) }}",
        "options": {}
    },
    "id": "a1b2c3d4-0044-0044-0044-000000000044",
    "name": "Respond OCR",
    "type": "n8n-nodes-base.respondToWebhook",
    "typeVersion": 1,
    "position": [2880, 1100]
}

wf['nodes'].extend([
    code_prepare_ocr,
    http_upload_mistral,
    http_get_mistral_url,
    http_mistral_ocr,
    code_prepare_openai,
    http_openai_parse,
    code_normalize_ocr,
    postgres_get_products,
    code_match_products,
    respond_ocr,
])

# Update connections - remove old OCR connections, add new ones
conn = wf['connections']
if 'Code Prepare OCR' in conn:
    del conn['Code Prepare OCR']
if 'HTTP Request OCR' in conn:
    del conn['HTTP Request OCR']

conn['Code Prepare OCR'] = {"main": [[{"node": "HTTP Upload Mistral", "type": "main", "index": 0}]]}
conn['HTTP Upload Mistral'] = {"main": [[{"node": "HTTP Get Mistral URL", "type": "main", "index": 0}]]}
conn['HTTP Get Mistral URL'] = {"main": [[{"node": "HTTP Mistral OCR", "type": "main", "index": 0}]]}
conn['HTTP Mistral OCR'] = {"main": [[{"node": "Code Prepare OpenAI Request", "type": "main", "index": 0}]]}
conn['Code Prepare OpenAI Request'] = {"main": [[{"node": "HTTP OpenAI Parse", "type": "main", "index": 0}]]}
conn['HTTP OpenAI Parse'] = {"main": [[{"node": "Code Normalize OCR", "type": "main", "index": 0}]]}
conn['Code Normalize OCR'] = {"main": [[{"node": "Postgres Get Products OCR", "type": "main", "index": 0}]]}
conn['Postgres Get Products OCR'] = {"main": [[{"node": "Code Match Products", "type": "main", "index": 0}]]}
conn['Code Match Products'] = {"main": [[{"node": "Respond OCR", "type": "main", "index": 0}]]}

with open('office_api_single.json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

print("Done! Nodes:", len(wf['nodes']), "Connections:", len(wf['connections']))
