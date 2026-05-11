"""
เพิ่ม flow ใหม่ใน "Upload Registration Receipts" workflow:
- Webhook POST /upload-yamaha-repair (รับ multipart file จาก frontend)
- Extract XLSX
- Build SQL UPSERT
- Postgres → Respond
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Upload Registration Receipts.json")
wf = json.loads(src.read_text(encoding='utf-8'))

# get postgres credentials
postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']; break

# Build SQL code
BUILD_SQL_JS = r"""// Build UPSERT SQL for yamaha_repair_invoices (39 columns)
const raw = $input.all().map(i => i.json);
if (!raw.length) return [{ json: { query: "SELECT 'no data' AS message", inserted: 0 } }];

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v).trim();
  if (s === '' || s === '-' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null') return 'NULL';
  return "'" + s.replace(/'/g, "''") + "'";
}
function num(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  const n = Number(String(v).replace(/,/g, ''));
  return isFinite(n) ? String(n) : 'NULL';
}
function intnum(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  const n = parseInt(String(v).replace(/,/g, ''), 10);
  return isFinite(n) ? String(n) : 'NULL';
}
function parseDate(v) {
  if (!v) return 'NULL';
  const s = String(v).trim();
  if (!s || s === '-') return 'NULL';
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    y = Number(y);
    if (y < 100) y += 2000;
    if (y > 2400) y -= 543;
    return `'${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}'`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return "'" + s.slice(0, 10) + "'";
  return 'NULL';
}

// Dedup on (job_no + item_type + repair_type_code + mechanic_code) — last wins
const dedup = new Map();
for (const r of raw) {
  const job = String(r['เลขที่ใบแจ้งซ่อม'] || '').trim();
  if (!job) continue;
  const key = [job, r['ประเภทรายการ']||'', r['รหัสประเภทการซ่อม']||'', r['รหัสช่างซ่อม']||''].join('|');
  dedup.set(key, r);
}
const rows = [...dedup.values()];
if (!rows.length) return [{ json: { query: "SELECT 'no valid rows' AS message", inserted: 0 } }];

const values = rows.map(r => `(${[
  esc(r['BRANCH_CODE']),
  esc(r['BRANCH_NAME']),
  esc(r['เลขที่ใบแจ้งซ่อม']),
  intnum(r['วันที่ซ่อม']),
  intnum(r['เดือนที่ซ่อม']),
  intnum(r['ปีที่ซ่อม']),
  intnum(r['วันที่ปิดงานซ่อม']),
  intnum(r['เดือนที่ปิดงานซ่อม']),
  intnum(r['ปีที่ปิดงานซ่อม']),
  esc(r['สถานะใบแจ้งซ่อม']),
  esc(r['ยี่ห้อ']),
  esc(r['รุ่น']),
  esc(r['แบบ']),
  esc(r['สี']),
  esc(r['หมายเลขเครื่อง']),
  esc(r['หมายเลขตัวถัง']),
  esc(r['เลขทะเบียน']),
  esc(r['CC']),
  esc(r['ชนิด']),
  esc(r['ระยะ']),
  esc(r['ลูกค้า']),
  esc(r['TAXID']),
  esc(r['โทรศัพท์']),
  esc(r['แท่นซ่อม']),
  esc(r['รหัสช่างซ่อม']),
  esc(r['ช่างซ่อม']),
  esc(r['ประเภทรายการ']),
  num(r['รายได้สุทธิ']),
  num(r['ค้างชำระ']),
  esc(r['รหัสประเภทการซ่อม']),
  esc(r['ประเภทการซ่อม']),
  num(r['FlatRate']),
  num(r['ราคาค่าแรง']),
  num(r['ส่วนลดค่าแรง']),
  num(r['ราคาค่าแรงรวม']),
  esc(r['REPORT_NAME']),
  esc(r['REPORT_MC_CC_TYPE']),
  parseDate(r['REPORT_DATE_START']),
  parseDate(r['REPORT_DATE_STOP']),
].join(',')})`);

const cols = ['branch_code','branch_name','job_no','repair_day','repair_month','repair_year','close_day','close_month','close_year','status','brand','series','model_code','color','engine_no','chassis_no','license_plate','cc','vehicle_type','mileage','customer','customer_tax_id','customer_phone','bay_no','mechanic_code','mechanic_name','item_type','net_revenue','outstanding','repair_type_code','repair_type','flat_rate','labor_price','labor_discount','labor_total','report_name','report_mc_cc_type','report_date_start','report_date_stop'];
const updateSet = cols.filter(c => !['job_no','item_type','repair_type_code','mechanic_code'].includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(',');

const query = `INSERT INTO yamaha_repair_invoices(${cols.join(',')}) VALUES ${values.join(',')} ON CONFLICT (job_no, item_type, repair_type_code, mechanic_code) DO UPDATE SET ${updateSet}, uploaded_at = NOW()`;
return [{ json: { query, total: rows.length } }];"""

# Build new nodes
new_nodes = []

WEBHOOK_ID = str(uuid.uuid4())
WEBHOOK_NAME = "Webhook Yamaha Repair"
EXTRACT_NAME = "Extract XLSX Yamaha Repair"
BUILD_NAME = "Build SQL Yamaha Repair"
PG_NAME = "Postgres Insert Yamaha Repair"
RESP_NAME = "Respond Yamaha Repair"

base_x, base_y = 200, 6000

new_nodes.append({
    "parameters": {
        "httpMethod": "POST",
        "path": "upload-yamaha-repair",
        "responseMode": "responseNode",
        "options": {"allowedOrigins": "*", "binaryData": True},
    },
    "type": "n8n-nodes-base.webhook", "typeVersion": 2,
    "position": [base_x, base_y], "id": WEBHOOK_ID, "name": WEBHOOK_NAME,
    "webhookId": str(uuid.uuid4()),
})

new_nodes.append({
    "parameters": {"operation": "xlsx", "options": {}},
    "type": "n8n-nodes-base.extractFromFile", "typeVersion": 1,
    "position": [base_x + 250, base_y], "id": str(uuid.uuid4()), "name": EXTRACT_NAME,
})

new_nodes.append({
    "parameters": {"jsCode": BUILD_SQL_JS},
    "type": "n8n-nodes-base.code", "typeVersion": 2,
    "position": [base_x + 500, base_y], "id": str(uuid.uuid4()), "name": BUILD_NAME,
})

pg_node = {
    "parameters": {"operation": "executeQuery", "query": "={{ $json.query }}", "options": {}},
    "type": "n8n-nodes-base.postgres", "typeVersion": 2.6,
    "position": [base_x + 750, base_y], "id": str(uuid.uuid4()), "name": PG_NAME,
    "alwaysOutputData": True,
}
if postgres_creds: pg_node["credentials"] = postgres_creds
new_nodes.append(pg_node)

new_nodes.append({
    "parameters": {
        "respondWith": "json",
        "responseBody": '={{ JSON.stringify({success: true, total: $("' + BUILD_NAME + '").first().json.total || 0, message: "นำเข้าใบแจ้งซ่อม Yamaha สำเร็จ"}) }}',
        "options": {"responseHeaders": {"entries": [
            {"name": "Access-Control-Allow-Origin", "value": "*"},
            {"name": "Access-Control-Allow-Methods", "value": "POST, OPTIONS"},
        ]}},
    },
    "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5,
    "position": [base_x + 1000, base_y], "id": str(uuid.uuid4()), "name": RESP_NAME,
})

# avoid duplicates
existing_names = {n['name'] for n in wf['nodes']}
added = 0
for nn in new_nodes:
    if nn['name'] not in existing_names:
        wf['nodes'].append(nn); added += 1
        print(f"OK: added {nn['name']}")
    else:
        print(f"INFO: {nn['name']} already exists, skip")

# wire connections
conns = wf.setdefault('connections', {})
def link(src_n, dst_n):
    if src_n not in conns:
        conns[src_n] = {"main": [[]]}
    conns[src_n]["main"][0] = [{"node": dst_n, "type": "main", "index": 0}]
link(WEBHOOK_NAME, EXTRACT_NAME)
link(EXTRACT_NAME, BUILD_NAME)
link(BUILD_NAME, PG_NAME)
link(PG_NAME, RESP_NAME)

src.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: saved (added {added} nodes)")
