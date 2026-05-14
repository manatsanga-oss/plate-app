"""
เพิ่ม LIFF ID Token verification หน้า Code Build Arrival SQL
ยิง token ไป https://api.line.me/oauth2/v2.1/verify เพื่อพิสูจน์ว่ามาจาก LINE จริง

Flow ใหม่:
  Switch[confirm_arrival]
    → HTTP Verify ID Token        (POST verify, ไม่ throw แม้จะ 400)
    → Code Check Verify           (validate sub/aud/exp/userId, set ok=true/false)
    → IF Verify Pass
        ├ true  → Code Build Arrival SQL → Postgres Save Arrival → ... (เดิม)
        └ false → Respond Verify Fail (401)

ต้องรัน add_confirm_arrival_action.py ก่อน
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

dst = Path(r"C:/Users/manat/OneDrive/New folder/ระบบจองคนขับรถ (PostgreSQL) (6).json")
wf = json.loads(dst.read_text(encoding='utf-8'))

# LINE Login Channel ID — LIFF ID prefix ก่อนเครื่องหมาย -
# (LIFF ID 2010078995-AXJ1tdUa → channel id = 2010078995)
LINE_LOGIN_CHANNEL_ID = '2010078995'

# ----- JS: ตรวจผลจาก verify endpoint -----
CHECK_VERIFY_JS = r"""
const verifyResp = $input.first().json || {};
const body = $('Webhook').first().json.body || {};
const EXPECTED_AUD = '__CHANNEL_ID__';

function fail(error, desc) {
  return [{ json: { ok: false, status: 401, error, error_description: desc } }];
}

// LINE คืน { error, error_description } เมื่อ token ผิด
if (verifyResp.error || !verifyResp.sub) {
  return fail(verifyResp.error || 'invalid_token',
              verifyResp.error_description || 'ID token verification failed');
}

// aud ต้องตรงกับ LINE Login Channel ID
if (verifyResp.aud && verifyResp.aud !== EXPECTED_AUD) {
  return fail('audience_mismatch', `aud=${verifyResp.aud}, expected ${EXPECTED_AUD}`);
}

// userId ที่ client ส่งมาต้องตรงกับ sub ใน token
if (body.userId && body.userId !== verifyResp.sub) {
  return fail('user_mismatch', 'userId in payload does not match ID token');
}

// exp ต้องไม่หมดอายุ
const nowSec = Math.floor(Date.now() / 1000);
if (verifyResp.exp && verifyResp.exp < nowSec) {
  return fail('token_expired', 'ID token has expired');
}

return [{ json: {
  ok: true,
  verifiedUserId: verifyResp.sub,
  verifiedName: verifyResp.name || null,
  body: body,
}}];
""".replace('__CHANNEL_ID__', LINE_LOGIN_CHANNEL_ID)

# ----- JS: Build SQL (ใช้ verifiedUserId แทน body.userId เพื่อความปลอดภัย) -----
BUILD_SQL_JS = r"""
const prev = $input.first().json;
if (!prev.ok) {
  throw new Error('verify_failed');
}
const b = prev.body || {};
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

// ใช้ verifiedUserId/Name (จาก ID token) ลงฐานข้อมูล — ไม่เชื่อค่าจาก client
const verifiedUserId = prev.verifiedUserId || null;
const verifiedName = prev.verifiedName || b.displayName || null;

const esc = v => v == null ? null : String(v).replace(/'/g, "''");
const userIdSql = verifiedUserId ? `'${esc(verifiedUserId)}'` : 'NULL';
const driverNameSql = verifiedName ? `'${esc(verifiedName)}'` : 'NULL';
const confirmedAt = b.timestamp ? `'${esc(b.timestamp)}'::timestamptz` : 'NOW()';
const withinSql = within == null ? 'NULL' : (within ? 'TRUE' : 'FALSE');

const sql = `WITH ins AS (
  INSERT INTO arrival_confirmations (
    booking_id, driver_user_id, driver_name,
    lat, lng, accuracy,
    dest_lat, dest_lng, distance_from_dest, is_within_range,
    confirmed_at
  ) VALUES (
    ${bookingId}, ${userIdSql}, ${driverNameSql},
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
  driverName: verifiedName,
  driverUserId: verifiedUserId,
  distance: dist,
  within: within,
} }];
"""

# ============== หา/ตรวจ nodes เดิม ==============
sw = next(n for n in wf['nodes'] if n.get('name') == 'Switch')
rules = sw['parameters']['rules']['values']
try:
    rule_idx = next(i for i, r in enumerate(rules) if r['outputKey'] == 'confirm_arrival')
except StopIteration:
    print('ERROR: switch ไม่มี output confirm_arrival — รัน add_confirm_arrival_action.py ก่อน')
    sys.exit(1)

existing = {n['name']: n for n in wf['nodes']}
if 'Code Build Arrival SQL' not in existing:
    print('ERROR: Code Build Arrival SQL ไม่พบ — รัน add_confirm_arrival_action.py ก่อน')
    sys.exit(1)

# อัปเดต JS ของ Build SQL ให้รับ input จาก Code Check Verify
existing['Code Build Arrival SQL']['parameters']['jsCode'] = BUILD_SQL_JS

# ============== เพิ่ม nodes ใหม่ ==============
def upsert_node(name, factory):
    if name in existing:
        return existing[name]
    node = factory()
    wf['nodes'].append(node)
    existing[name] = node
    return node

base_y = 7700

n_verify = upsert_node('HTTP Verify ID Token', lambda: {
    "parameters": {
        "method": "POST",
        "url": "https://api.line.me/oauth2/v2.1/verify",
        "sendBody": True,
        "contentType": "form-urlencoded",
        "bodyParameters": {"parameters": [
            {"name": "id_token", "value": "={{ $json.body.idToken }}"},
            {"name": "client_id", "value": LINE_LOGIN_CHANNEL_ID},
        ]},
        "options": {
            "response": {"response": {"neverError": True, "fullResponse": False}},
            "timeout": 10000,
        },
    },
    "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
    "position": [5300, base_y],
    "id": str(uuid.uuid4()), "name": "HTTP Verify ID Token",
    "onError": "continueRegularOutput",
})

n_check = upsert_node('Code Check Verify', lambda: {
    "parameters": {"jsCode": CHECK_VERIFY_JS},
    "type": "n8n-nodes-base.code", "typeVersion": 2,
    "position": [5520, base_y],
    "id": str(uuid.uuid4()), "name": "Code Check Verify",
})
# refresh code กรณีรันซ้ำ
n_check['parameters']['jsCode'] = CHECK_VERIFY_JS

n_if = upsert_node('IF Verify Pass', lambda: {
    "parameters": {
        "conditions": {
            "options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
            "conditions": [{
                "id": str(uuid.uuid4()),
                "leftValue": "={{ $json.ok }}",
                "rightValue": True,
                "operator": {"type": "boolean", "operation": "true", "singleValue": True},
            }],
            "combinator": "and",
        },
        "options": {},
    },
    "type": "n8n-nodes-base.if", "typeVersion": 2,
    "position": [5680, base_y],
    "id": str(uuid.uuid4()), "name": "IF Verify Pass",
})

n_fail = upsert_node('Respond Verify Fail', lambda: {
    "parameters": {
        "respondWith": "json",
        "responseCode": 401,
        "responseBody": '={{ JSON.stringify({ ok: false, error: $json.error, error_description: $json.error_description }) }}',
        "options": {"responseHeaders": {"entries": [
            {"name": "Access-Control-Allow-Origin", "value": "*"},
            {"name": "Access-Control-Allow-Methods", "value": "POST, OPTIONS"},
            {"name": "Access-Control-Allow-Headers", "value": "Content-Type"},
        ]}},
    },
    "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
    "position": [5920, base_y + 200],
    "id": str(uuid.uuid4()), "name": "Respond Verify Fail",
})

# เลื่อน node เดิมไปด้านขวาเพื่อให้มีที่ว่างแสดงผลใน UI
shifts = {
    'Code Build Arrival SQL':     (5920, base_y),
    'Postgres Save Arrival':      (6120, base_y),
    'Respond Confirm Arrival':    (6360, base_y - 80),
    'Code Build Confirm Message': (6360, base_y + 120),
    'HTTP LINE Push Confirm':     (6600, base_y + 120),
}
for name, pos in shifts.items():
    if name in existing:
        existing[name]['position'] = list(pos)

# ============== rewire connections ==============
connections = wf.setdefault('connections', {})

# Switch[confirm_arrival] → HTTP Verify ID Token (แทนที่ของเดิม)
sw_conns = connections.setdefault('Switch', {}).setdefault('main', [])
while len(sw_conns) <= rule_idx:
    sw_conns.append([])
sw_conns[rule_idx] = [{"node": "HTTP Verify ID Token", "type": "main", "index": 0}]

# HTTP Verify → Code Check Verify
connections['HTTP Verify ID Token'] = {
    "main": [[{"node": "Code Check Verify", "type": "main", "index": 0}]]
}

# Code Check Verify → IF Verify Pass
connections['Code Check Verify'] = {
    "main": [[{"node": "IF Verify Pass", "type": "main", "index": 0}]]
}

# IF Verify Pass: true → Build SQL, false → Respond Verify Fail
connections['IF Verify Pass'] = {
    "main": [
        [{"node": "Code Build Arrival SQL", "type": "main", "index": 0}],
        [{"node": "Respond Verify Fail", "type": "main", "index": 0}],
    ]
}

# (ส่วนหลัง Build SQL → Postgres → Respond/Push คงเดิม)

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')

print("OK: LIFF ID token verification wired")
print(f"  - LINE Login channel id: {LINE_LOGIN_CHANNEL_ID}")
print(f"  - Switch[{rule_idx}=confirm_arrival] → HTTP Verify → Code Check → IF → [Build SQL | Respond 401]")
print(f"  - nodes added: HTTP Verify ID Token, Code Check Verify, IF Verify Pass, Respond Verify Fail")
print(f"  - existing nodes shifted right to make room")
