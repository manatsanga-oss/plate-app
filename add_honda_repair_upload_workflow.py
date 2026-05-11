"""
เพิ่ม flow upload-honda-repair ใน Upload Registration Receipts workflow
- รับ CSV (cp874) multipart
- parse rows (col 21..32)
- dedup by job_no
- UPSERT honda_repair_jobs
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Upload Registration Receipts.json")
wf = json.loads(src.read_text(encoding='utf-8'))

postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']; break

# Build SQL JS (parse rows from CSV: col 21 mechanic, 22 open, 23 close, 24 service_type, 25 job_no, 26 parts, 27 labor, 28 frt, 29 disc, 30 total_net, 31 vat, 32 net_sale)
BUILD_JS = r"""// HONDA repair upload — col 21..32 of each row from DMS CSV
const raw = $input.all();
const allRows = [];
for (const it of raw) {
  // Extract From File outputs rows as { _0, _1, ... } when no header, or object keys = original col names
  // We will look for the row's structured data assuming CSV header row may be first row
  const o = it.json;
  // Get values by index — try both styles
  const get = (i) => {
    // Try common key patterns
    if (o[String(i)] !== undefined) return o[String(i)];
    const ks = Object.keys(o);
    if (ks.length > i) return o[ks[i]];
    return null;
  };
  allRows.push(o);
}

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v).trim();
  if (s === '' || s === '-' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null') return 'NULL';
  return "'" + s.replace(/'/g, "''") + "'";
}
function num(v) {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v).replace(/[,\s]/g, '').replace(/^-$/, '');
  if (s === '' || s === '-') return 'NULL';
  const n = Number(s);
  return isFinite(n) ? String(n) : 'NULL';
}
function parseDate(v) {
  if (!v) return 'NULL';
  const s = String(v).trim();
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
function splitMech(v) {
  if (!v) return { code: null, name: null };
  const s = String(v).trim();
  const m = s.match(/^(\S+)\s*-\s*(.+)$/);
  if (m) return { code: m[1], name: m[2].trim() };
  return { code: null, name: s };
}

// Get value by column index from row (different keys possible)
function colVal(row, idx) {
  const ks = Object.keys(row);
  // try numeric key as fallback
  if (row[`Column${idx}`] !== undefined) return row[`Column${idx}`];
  if (row[`${idx}`] !== undefined) return row[`${idx}`];
  if (idx < ks.length) return row[ks[idx]];
  return null;
}

const dedup = new Map();
let branchName = null;
for (const row of allRows) {
  const job = String(colVal(row, 25) || '').trim();
  // skip if no job or "เลขที่ JOB" header
  if (!job || job.startsWith('เลขที่') || job.startsWith('-')) continue;
  // must look like 69SERV/...
  if (!/SERV\//i.test(job)) continue;
  const mech = splitMech(colVal(row, 21));
  const item = {
    job_no: job,
    mechanic_code: mech.code,
    mechanic_name: mech.name,
    open_date: colVal(row, 22),
    close_date: colVal(row, 23),
    service_type: colVal(row, 24),
    parts_amount: colVal(row, 26),
    labor_amount: colVal(row, 27),
    frt: colVal(row, 28),
    discount: colVal(row, 29),
    total_net: colVal(row, 30),
    vat: colVal(row, 31),
    net_sale: colVal(row, 32),
  };
  if (!branchName) branchName = colVal(row, 0);
  dedup.set(job, item);
}

const rows = [...dedup.values()];
if (!rows.length) return [{ json: { query: "SELECT 'no valid rows' AS message", total: 0 } }];

const values = rows.map(r => `(${[
  esc(r.job_no),
  esc(r.mechanic_code),
  esc(r.mechanic_name),
  parseDate(r.open_date),
  parseDate(r.close_date),
  esc(r.service_type),
  num(r.parts_amount),
  num(r.labor_amount),
  num(r.frt),
  num(r.discount),
  num(r.total_net),
  num(r.vat),
  num(r.net_sale),
  esc(branchName),
].join(',')})`);

const cols = ['job_no','mechanic_code','mechanic_name','open_date','close_date','service_type','parts_amount','labor_amount','frt','discount','total_net','vat','net_sale','branch_name'];
const updateSet = cols.filter(c => c !== 'job_no').map(c => `${c} = EXCLUDED.${c}`).join(',');

const query = `INSERT INTO honda_repair_jobs(${cols.join(',')}) VALUES ${values.join(',')} ON CONFLICT (job_no) DO UPDATE SET ${updateSet}, uploaded_at = NOW()`;
return [{ json: { query, total: rows.length } }];"""

base_x, base_y = 97296, 59576

new_nodes = [
    {
        "parameters": {"httpMethod": "POST", "path": "upload-honda-repair",
            "responseMode": "responseNode", "options": {"allowedOrigins": "*", "binaryData": True}},
        "type": "n8n-nodes-base.webhook", "typeVersion": 2,
        "position": [base_x, base_y], "id": str(uuid.uuid4()), "name": "Webhook Honda Repair",
        "webhookId": str(uuid.uuid4()),
    },
    {
        "parameters": {"operation": "csv", "options": {"encoding": "cp874", "headerRow": False}, "binaryPropertyName": "file"},
        "type": "n8n-nodes-base.extractFromFile", "typeVersion": 1,
        "position": [base_x + 250, base_y], "id": str(uuid.uuid4()), "name": "Extract CSV Honda Repair",
    },
    {
        "parameters": {"jsCode": BUILD_JS},
        "type": "n8n-nodes-base.code", "typeVersion": 2,
        "position": [base_x + 500, base_y], "id": str(uuid.uuid4()), "name": "Build SQL Honda Repair",
    },
]
pg_node = {
    "parameters": {"operation": "executeQuery", "query": "={{ $json.query }}", "options": {}},
    "type": "n8n-nodes-base.postgres", "typeVersion": 2.6,
    "position": [base_x + 750, base_y], "id": str(uuid.uuid4()), "name": "Postgres Insert Honda Repair",
    "alwaysOutputData": True,
}
if postgres_creds: pg_node["credentials"] = postgres_creds
new_nodes.append(pg_node)

new_nodes.append({
    "parameters": {
        "respondWith": "json",
        "responseBody": '={{ (() => { const t = $("Build SQL Honda Repair").first().json.total || 0; return JSON.stringify({success: true, total: t, message: "นำเข้า HONDA repair สำเร็จ " + t + " รายการ"}); })() }}',
        "options": {"responseHeaders": {"entries": [
            {"name": "Access-Control-Allow-Origin", "value": "*"},
        ]}},
    },
    "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5,
    "position": [base_x + 1000, base_y], "id": str(uuid.uuid4()), "name": "Respond Honda Repair",
})

existing_names = {n['name'] for n in wf['nodes']}
added = 0
for nn in new_nodes:
    if nn['name'] not in existing_names:
        wf['nodes'].append(nn); added += 1
        print(f"OK: added {nn['name']}")

conns = wf.setdefault('connections', {})
def link(src_n, dst_n):
    if src_n not in conns: conns[src_n] = {"main": [[]]}
    conns[src_n]["main"][0] = [{"node": dst_n, "type": "main", "index": 0}]
link("Webhook Honda Repair", "Extract CSV Honda Repair")
link("Extract CSV Honda Repair", "Build SQL Honda Repair")
link("Build SQL Honda Repair", "Postgres Insert Honda Repair")
link("Postgres Insert Honda Repair", "Respond Honda Repair")

src.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: saved ({added} nodes added)")
