"""
เพิ่ม rate limit (window 30 วินาที) ใน flow confirm_arrival
ป้องกันการกดยืนยันซ้ำหรือ replay attack

เทคนิค: ฝัง dup-check ใน Build SQL ผ่าน CTE
  WITH dup AS (SELECT 1 FROM arrival_confirmations WHERE booking_id=X AND created_at > NOW() - 30s)
  ins  AS (INSERT ... WHERE NOT EXISTS (SELECT 1 FROM dup))
ถ้า dup มี → ไม่ INSERT/UPDATE และ flag rate_limited=true

เพิ่ม nodes:
  - IF Not Rate Limited (หลัง Postgres Save Arrival)
      true (ไม่ rate limited) → fan-out เดิม (Respond + Build Message + LINE Push)
      false (rate limited) → Respond Rate Limited (429)

ต้องรัน add_idtoken_verify.py ก่อน
"""
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

dst = Path(r"C:/Users/manat/OneDrive/New folder/ระบบจองคนขับรถ (PostgreSQL) (6).json")
wf = json.loads(dst.read_text(encoding='utf-8'))

RATE_WINDOW_SECONDS = 30

# Build SQL ใหม่ มี dup-check CTE
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
const RATE_WINDOW = __WINDOW__;  // วินาที
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

const verifiedUserId = prev.verifiedUserId || null;
const verifiedName = prev.verifiedName || b.displayName || null;

const esc = v => v == null ? null : String(v).replace(/'/g, "''");
const userIdSql = verifiedUserId ? `'${esc(verifiedUserId)}'` : 'NULL';
const driverNameSql = verifiedName ? `'${esc(verifiedName)}'` : 'NULL';
const confirmedAt = b.timestamp ? `'${esc(b.timestamp)}'::timestamptz` : 'NOW()';
const withinSql = within == null ? 'NULL' : (within ? 'TRUE' : 'FALSE');
const photoUrl = b.photoUrl ? `'${esc(b.photoUrl)}'` : 'NULL';

const sql = `WITH dup AS (
  SELECT 1 FROM arrival_confirmations
  WHERE booking_id = ${bookingId}
    AND created_at > NOW() - INTERVAL '${RATE_WINDOW} seconds'
  LIMIT 1
), ins AS (
  INSERT INTO arrival_confirmations (
    booking_id, driver_user_id, driver_name,
    lat, lng, accuracy,
    dest_lat, dest_lng, distance_from_dest, is_within_range,
    photo_url, confirmed_at
  )
  SELECT ${bookingId}, ${userIdSql}, ${driverNameSql},
         ${lat}, ${lng}, ${accuracy == null ? 'NULL' : accuracy},
         ${destLat == null ? 'NULL' : destLat}, ${destLng == null ? 'NULL' : destLng},
         ${dist == null ? 'NULL' : dist}, ${withinSql},
         ${photoUrl}, ${confirmedAt}
  WHERE NOT EXISTS (SELECT 1 FROM dup)
  RETURNING id, booking_id, distance_from_dest, is_within_range
), upd AS (
  UPDATE bookings
     SET arrived_at = NOW(),
         arrived_within_range = ${withinSql}
   WHERE booking_id = ${bookingId} AND EXISTS (SELECT 1 FROM ins)
   RETURNING booking_id, booker_name, destination_formatted, driver_id
)
SELECT
  EXISTS (SELECT 1 FROM dup) AS rate_limited,
  i.id, i.booking_id, i.distance_from_dest, i.is_within_range,
  u.booker_name, u.destination_formatted, u.driver_id
FROM (SELECT 1) x
LEFT JOIN ins i ON TRUE
LEFT JOIN upd u ON TRUE`;

return [{ json: {
  query: sql,
  driverName: verifiedName,
  driverUserId: verifiedUserId,
  distance: dist,
  within: within,
} }];
""".replace('__WINDOW__', str(RATE_WINDOW_SECONDS))

# ============== หา nodes เดิม ==============
existing = {n['name']: n for n in wf['nodes']}
if 'Code Build Arrival SQL' not in existing:
    print('ERROR: ต้องรัน add_confirm_arrival_action.py + add_idtoken_verify.py ก่อน')
    sys.exit(1)

# อัปเดต Build SQL ให้รวม dup-check + photo_url
existing['Code Build Arrival SQL']['parameters']['jsCode'] = BUILD_SQL_JS

# ============== เพิ่ม IF + Respond 429 ==============
def upsert_node(name, factory):
    if name in existing:
        return existing[name]
    node = factory()
    wf['nodes'].append(node)
    existing[name] = node
    return node

# ตำแหน่งของ Postgres Save Arrival อยู่ที่ ~6120, 7700
n_if = upsert_node('IF Not Rate Limited', lambda: {
    "parameters": {
        "conditions": {
            "options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
            "conditions": [{
                "id": str(uuid.uuid4()),
                "leftValue": "={{ $json.rate_limited }}",
                "rightValue": False,
                "operator": {"type": "boolean", "operation": "false", "singleValue": True},
            }],
            "combinator": "and",
        },
        "options": {},
    },
    "type": "n8n-nodes-base.if", "typeVersion": 2,
    "position": [6280, 7700],
    "id": str(uuid.uuid4()), "name": "IF Not Rate Limited",
})

n_429 = upsert_node('Respond Rate Limited', lambda: {
    "parameters": {
        "respondWith": "json",
        "responseCode": 429,
        "responseBody": (
            '={{ JSON.stringify({ ok: false, error: "rate_limited", '
            f'error_description: "ยืนยันซ้ำเกินไป รอ {RATE_WINDOW_SECONDS} วินาทีแล้วลองใหม่" }}) }}'
        ),
        "options": {"responseHeaders": {"entries": [
            {"name": "Access-Control-Allow-Origin", "value": "*"},
            {"name": "Retry-After", "value": str(RATE_WINDOW_SECONDS)},
        ]}},
    },
    "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
    "position": [6520, 7900],
    "id": str(uuid.uuid4()), "name": "Respond Rate Limited",
})

# เลื่อน node เดิมขวาเพื่อให้มีที่
for name, pos in {
    'Respond Confirm Arrival':    (6720, 7620),
    'Code Build Confirm Message': (6520, 7780),
    'HTTP LINE Push Confirm':     (6720, 7780),
}.items():
    if name in existing:
        existing[name]['position'] = list(pos)

# ============== rewire connections ==============
connections = wf['connections']

# Postgres Save Arrival → IF Not Rate Limited (แทนที่ fan-out เดิม)
connections['Postgres Save Arrival'] = {
    "main": [[{"node": "IF Not Rate Limited", "type": "main", "index": 0}]]
}

# IF Not Rate Limited: true → fan-out, false → Respond 429
connections['IF Not Rate Limited'] = {
    "main": [
        [
            {"node": "Respond Confirm Arrival", "type": "main", "index": 0},
            {"node": "Code Build Confirm Message", "type": "main", "index": 0},
        ],
        [
            {"node": "Respond Rate Limited", "type": "main", "index": 0},
        ],
    ]
}

dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: rate limit ({RATE_WINDOW_SECONDS}s) added")
print("  - Postgres Save Arrival → IF Not Rate Limited")
print("  - [true] → Respond Confirm Arrival + LINE Push (เดิม)")
print("  - [false] → Respond Rate Limited (429)")
print("  - Build SQL ใหม่ใช้ CTE dup-check + รับ photo_url")
