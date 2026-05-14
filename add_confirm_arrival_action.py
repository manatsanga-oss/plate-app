"""
เพิ่ม action `confirm_arrival` ใน n8n workflow ระบบจองคนขับรถ
รับ payload จาก LIFF page → คำนวณ Haversine → INSERT arrival_confirmations
→ UPDATE bookings.arrived_at → push LINE confirm → respond กลับ LIFF

Node chain:
  Switch[confirm_arrival]
    → Code Build Arrival SQL
    → Postgres Save Arrival
    ├→ Respond Confirm Arrival       (ส่งผลกลับ LIFF ทันที)
    └→ Code Build Confirm Message
       → HTTP LINE Push Confirm      (fire & forget)
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

dst = Path(r"C:/Users/manat/OneDrive/New folder/ระบบจองคนขับรถ (PostgreSQL) (6).json")
wf = json.loads(dst.read_text(encoding='utf-8'))

# หา postgres credentials จาก node ที่มีอยู่
postgres_creds = None
for n in wf['nodes']:
    if n['type'] == 'n8n-nodes-base.postgres' and 'credentials' in n:
        postgres_creds = n['credentials']
        break

# ดึง LINE access token + group id จาก HTTP node เดิม (HTTP Request LINE Booking)
line_auth_header = None
line_group_id = "C4a99eff6b6096a29086ec4bad98edc2d"
for n in wf['nodes']:
    if n.get('name') == 'HTTP Request LINE Booking':
        for h in n['parameters'].get('headerParameters', {}).get('parameters', []):
            if h.get('name') == 'Authorization':
                line_auth_header = h['value']

# JS โค้ดสำหรับ build SQL + คำนวณ Haversine
BUILD_SQL_JS = r"""
const b = $input.first().json.body || {};
const toNum = v => (v === null || v === undefined || v === '') ? null : parseFloat(v);
const lat = toNum(b.lat);
const lng = toNum(b.lng);
const destLat = toNum(b.destLat);
const destLng = toNum(b.destLng);
const accuracy = toNum(b.accuracy);
const bookingId = parseInt(b.bookingId);
if (!bookingId || lat === null || lng === null) {
  throw new Error('missing required: bookingId, lat, lng');
}

const RADIUS_M = 200;
function haversine(a, b, c, d) {
  if (a == null || b == null || c == null || d == null) return null;
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(c - a);
  const dLng = toRad(d - b);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const dist = haversine(lat, lng, destLat, destLng);
const within = dist != null ? (dist <= RADIUS_M) : null;

const esc = v => v == null ? null : String(v).replace(/'/g, "''");
const userId = b.userId ? `'${esc(b.userId)}'` : 'NULL';
const driverName = b.displayName ? `'${esc(b.displayName)}'` : 'NULL';
const confirmedAt = b.timestamp ? `'${esc(b.timestamp)}'::timestamptz` : 'NOW()';
const withinSql = within == null ? 'NULL' : (within ? 'TRUE' : 'FALSE');

const sql = `WITH ins AS (
  INSERT INTO arrival_confirmations (
    booking_id, driver_user_id, driver_name,
    lat, lng, accuracy,
    dest_lat, dest_lng, distance_from_dest, is_within_range,
    confirmed_at
  ) VALUES (
    ${bookingId}, ${userId}, ${driverName},
    ${lat}, ${lng}, ${accuracy == null ? 'NULL' : accuracy},
    ${destLat == null ? 'NULL' : destLat}, ${destLng == null ? 'NULL' : destLng},
    ${dist == null ? 'NULL' : dist}, ${withinSql},
    ${confirmedAt}
  ) RETURNING id, booking_id, distance_from_dest, is_within_range
), upd AS (
  UPDATE bookings
     SET arrived_at = NOW(),
         arrived_within_range = ${withinSql}
   WHERE booking_id = ${bookingId}
   RETURNING booking_id, booker_name, destination_formatted, driver_id
)
SELECT i.id, i.booking_id, i.distance_from_dest, i.is_within_range,
       u.booker_name, u.destination_formatted, u.driver_id
FROM ins i CROSS JOIN upd u`;

return [{ json: {
  query: sql,
  driverName: b.displayName || null,
  driverUserId: b.userId || null,
  distance: dist,
  within: within,
} }];
"""

# JS โค้ดสร้างข้อความ confirm
BUILD_MSG_JS = r"""
const sqlRes = $input.first().json;
const meta = $('Code Build Arrival SQL').first().json;
const driver = meta.driverName || 'คนขับ';
const dist = sqlRes.distance_from_dest;
const within = sqlRes.is_within_range;
const distStr = (dist != null) ? `${Math.round(dist)} ม.` : '-';
const status = within === true ? '✅ ถึงที่หมายแล้ว'
              : within === false ? '⚠️ ยืนยันแล้ว (นอกพื้นที่)'
              : '✅ ยืนยันแล้ว';
const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
const text = `${status}\n\n` +
  `งาน #${sqlRes.booking_id}${sqlRes.booker_name ? ' • ' + sqlRes.booker_name : ''}\n` +
  `ปลายทาง: ${sqlRes.destination_formatted || '-'}\n` +
  `คนขับ: ${driver}\n` +
  `ห่างจุดหมาย: ${distStr}\n` +
  `เวลา: ${now}`;
return [{ json: { message: text } }];
"""

# ============== เพิ่ม switch rule ==============
sw = next(n for n in wf['nodes']
          if n.get('name') == 'Switch' and n.get('type') == 'n8n-nodes-base.switch')
rules = sw['parameters']['rules']['values']

KEY = 'confirm_arrival'
if not any(r.get('outputKey') == KEY for r in rules):
    rules.append({
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{
                "id": str(uuid.uuid4()),
                "leftValue": "={{ $json.body.action }}",
                "rightValue": KEY,
                "operator": {"type": "string", "operation": "equals"},
            }],
            "combinator": "and",
        },
        "renameOutput": True,
        "outputKey": KEY,
    })

rule_idx = next(i for i, r in enumerate(rules) if r['outputKey'] == KEY)

# ============== เพิ่ม nodes ==============
existing = {n['name']: n for n in wf['nodes']}
base_x, base_y = 5760, 7700

def upsert_node(name, factory):
    if name in existing:
        return existing[name]
    node = factory()
    wf['nodes'].append(node)
    existing[name] = node
    return node

n_build_sql = upsert_node('Code Build Arrival SQL', lambda: {
    "parameters": {"jsCode": BUILD_SQL_JS},
    "type": "n8n-nodes-base.code", "typeVersion": 2,
    "position": [base_x, base_y],
    "id": str(uuid.uuid4()), "name": "Code Build Arrival SQL",
})
# refresh code (กรณีรันสคริปต์ซ้ำ)
n_build_sql['parameters']['jsCode'] = BUILD_SQL_JS

n_save = upsert_node('Postgres Save Arrival', lambda: {
    "parameters": {"operation": "executeQuery", "query": "{{ $json.query }}", "options": {}},
    "type": "n8n-nodes-base.postgres", "typeVersion": 2.5,
    "position": [base_x + 240, base_y],
    "id": str(uuid.uuid4()), "name": "Postgres Save Arrival",
    **({"credentials": postgres_creds} if postgres_creds else {}),
})

n_respond = upsert_node('Respond Confirm Arrival', lambda: {
    "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($input.first().json) }}",
        "options": {"responseHeaders": {"entries": [
            {"name": "Access-Control-Allow-Origin", "value": "*"},
            {"name": "Access-Control-Allow-Methods", "value": "POST, OPTIONS"},
            {"name": "Access-Control-Allow-Headers", "value": "Content-Type"},
        ]}},
    },
    "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
    "position": [base_x + 480, base_y - 80],
    "id": str(uuid.uuid4()), "name": "Respond Confirm Arrival",
})

n_build_msg = upsert_node('Code Build Confirm Message', lambda: {
    "parameters": {"jsCode": BUILD_MSG_JS},
    "type": "n8n-nodes-base.code", "typeVersion": 2,
    "position": [base_x + 480, base_y + 120],
    "id": str(uuid.uuid4()), "name": "Code Build Confirm Message",
})
n_build_msg['parameters']['jsCode'] = BUILD_MSG_JS

line_body = (
    '={\n'
    f'  "to": "{line_group_id}",\n'
    '  "messages": [{\n'
    '    "type": "text",\n'
    '    "text": "{{ $json.message.replace(/\\n/g, \'\\\\n\') }}"\n'
    '  }]\n'
    '}\n'
)
n_push = upsert_node('HTTP LINE Push Confirm', lambda: {
    "parameters": {
        "method": "POST",
        "url": "https://api.line.me/v2/bot/message/push",
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "Authorization",
             "value": line_auth_header or "Bearer REPLACE_WITH_CHANNEL_ACCESS_TOKEN"},
        ]},
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": line_body,
        "options": {},
    },
    "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
    "position": [base_x + 720, base_y + 120],
    "id": str(uuid.uuid4()), "name": "HTTP LINE Push Confirm",
})

# ============== ต่อ connections ==============
connections = wf.setdefault('connections', {})
sw_conns = connections.setdefault('Switch', {}).setdefault('main', [])
while len(sw_conns) <= rule_idx:
    sw_conns.append([])
if not any(t.get('node') == 'Code Build Arrival SQL' for t in sw_conns[rule_idx]):
    sw_conns[rule_idx].append({"node": "Code Build Arrival SQL", "type": "main", "index": 0})

connections['Code Build Arrival SQL'] = {
    "main": [[{"node": "Postgres Save Arrival", "type": "main", "index": 0}]]
}
# Postgres Save Arrival → fan-out (Respond + Build Message)
connections['Postgres Save Arrival'] = {
    "main": [[
        {"node": "Respond Confirm Arrival", "type": "main", "index": 0},
        {"node": "Code Build Confirm Message", "type": "main", "index": 0},
    ]]
}
connections['Code Build Confirm Message'] = {
    "main": [[{"node": "HTTP LINE Push Confirm", "type": "main", "index": 0}]]
}

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print("OK: confirm_arrival action wired")
print(f"  - switch rule index: {rule_idx}")
print(f"  - nodes added/updated: Code Build Arrival SQL, Postgres Save Arrival,")
print(f"    Respond Confirm Arrival, Code Build Confirm Message, HTTP LINE Push Confirm")
print(f"  - LINE group id: {line_group_id}")
print(f"  - LINE auth header: {'reused from existing node' if line_auth_header else 'PLACEHOLDER — แก้ก่อนใช้'}")
