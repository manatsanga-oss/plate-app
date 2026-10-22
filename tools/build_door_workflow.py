# สร้าง n8n workflow: door-api — ควบคุมประตูม้วน/อ่านเซนเซอร์ประตูผ่าน Tuya Cloud OpenAPI (Singapore) + พนักงานขอเปิดประตูทาง LINE
# v1.2 (2026-10-22): ประตูม้วนสั่งผ่านฉาก Tap-to-Run (scene_map ใน door_settings, action scenes) + HTTP body raw แก้ sign invalid
# v1.1 (2026-10-22): เลือกบานที่สั่ง (open/stop/close รับ shutter both/1/2; line_open ใช้ door_settings.line_shutter)
# v1 (2026-10-22): actions get_settings/save_settings/list_users/save_user/delete_user/list_log (DB) · status/open/stop/close/functions (Tuya) · line_open (จากบอท LINE พนักงาน: เช็กสิทธิ์+ช่วงเวลา แล้วเปิด)
# ใช้: python build_door_workflow.py → OneDrive\New folder\Door_Control_Workflow.json + Door_Control_DDL.sql
# Access ID/Secret ของ Tuya hardcode ใน node Prepare (user prefer เหมือน LINE token) · ลายเซ็น HMAC-SHA256 คำนวณใน Code node ด้วย JS ล้วน (Crypto node ให้ค่าไม่ตรง 2026-10-22)
import json, os, uuid

OUT_DIR = os.path.join(os.environ["USERPROFILE"], "OneDrive", "New folder")
# ค่าลับ (Tuya Access ID/Secret, LINE token บอทพนักงาน) อยู่นอก repo: OneDrive/New folder/Door_Secrets.json {"tuya_client_id","tuya_secret","staff_line_token"} — ห้ามใส่ในไฟล์นี้ (ขึ้น GitHub)
try:
    SECRETS = json.load(open(os.path.join(OUT_DIR, "Door_Secrets.json"), encoding="utf-8"))
except Exception:
    SECRETS = {}
PG = {"postgres": {"id": "JLUeyZRAzUeRqlxu", "name": "Postgres account"}}
STAFF_LINE_TOKEN = SECRETS.get("staff_line_token", "Bearer __STAFF_LINE_TOKEN__")  # OA บอทพนักงาน (ลงทะเบียน MyMotor) — ใช้ตอบกลับ replyToken

DDL = """CREATE TABLE IF NOT EXISTS door_settings (id INT PRIMARY KEY DEFAULT 1, open_from TEXT NOT NULL DEFAULT '07:30', open_to TEXT NOT NULL DEFAULT '08:00', enabled BOOLEAN NOT NULL DEFAULT true, line_shutter TEXT NOT NULL DEFAULT 'both', scene_map JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ DEFAULT now());
INSERT INTO door_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE door_settings ADD COLUMN IF NOT EXISTS line_shutter TEXT NOT NULL DEFAULT 'both';  -- 2026-10-22 บานที่เปิดผ่าน LINE: both / 1 / 2
ALTER TABLE door_settings ADD COLUMN IF NOT EXISTS scene_map JSONB NOT NULL DEFAULT '{}'::jsonb;  -- 2026-10-22 ผูกฉาก Tap-to-Run ของ Smart Life: {"1_open":scene_id,"1_stop":..,"1_close":..,"2_open":..}
CREATE TABLE IF NOT EXISTS door_access_users (line_user_id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS door_open_log (id BIGSERIAL PRIMARY KEY, ts TIMESTAMPTZ DEFAULT now(), source TEXT, line_user_id TEXT, user_name TEXT, action TEXT, result TEXT, detail TEXT);"""

# ---------- Code: Config + Prepare (parse action, build SQL) ----------
PREPARE = r"""// ---- ค่าคงที่ (แก้ 2 ค่าแรกหลัง import — Access ID / Access Secret จาก iot.tuya.com → โปรเจกต์ plate-app → Overview) ----
const TUYA_CLIENT_ID = '__TUYA_CLIENT_ID__';
const TUYA_SECRET    = '__TUYA_SECRET__';   // iot.tuya.com โปรเจกต์ plate-app (Singapore) — ถ้า reset secret ให้แก้ตรงนี้แล้ว Publish
const TUYA_BASE = 'https://openapi.tuyaus.com';               // Western America Data Center (user ยืนยัน 2026-10-22; SG ใช้ไม่ได้ "data center is suspended")
const DEVICES = {
  shutters: [ { id: 'eba8f147c48ce6b8971dxv', name: 'ประตูม้วน 1' }, { id: 'ebb60e2ce9637f4d85quva', name: 'ประตูม้วน 2' } ],
  sensors:  [ { id: 'eb4e442c2dad986d38e5eu', name: 'ประตูห้อง ฝ่ายขาย' }, { id: 'ebca18f706cd85f01eh0yh', name: 'ประตูห้อง ฝ่ายบริการ' } ],
  bridge: 'eb08218a8cd7cf085afnmm'
};
const HOME_ID = '320909872';   // บ้าน "Por.Paor" ใน Smart Life (GET /v1.0/users/{uid}/homes) — ฉาก Tap-to-Run ที่ผูกปุ่มรีโมทประตูม้วนอยู่ในบ้านนี้
const b = $input.first().json.body || {};
const action = String(b.action || 'status');
const q = (s) => "'" + String(s ?? '').replace(/'/g, "''").slice(0, 2000) + "'";
// เวลาไทย HH:MM
const now = new Date();
const th = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
let query = 'SELECT 1 AS nop;';
if (action === 'get_settings' || action === 'line_open' || action === 'status' || action === 'open' || action === 'close' || action === 'stop' || action === 'functions' || action === 'scenes') {
  query = `SELECT (SELECT row_to_json(s) FROM door_settings s WHERE id = 1)::text AS settings, COALESCE((SELECT json_agg(u ORDER BY u.name) FROM door_access_users u), '[]'::json)::text AS users;`;
} else if (action === 'save_settings') {
  const f = String(b.open_from || '07:30').slice(0, 5), t = String(b.open_to || '08:00').slice(0, 5);
  const ls = ['both', '1', '2'].includes(String(b.line_shutter)) ? String(b.line_shutter) : 'both';   // บานที่เปิดผ่าน LINE
  const sm = {}; const smIn = (b.scene_map && typeof b.scene_map === 'object') ? b.scene_map : {};
  for (const k of ['1_open', '1_stop', '1_close', '2_open', '2_stop', '2_close']) { const v = String(smIn[k] || '').replace(/[^A-Za-z0-9_-]/g, ''); if (v) sm[k] = v; }
  query = `UPDATE door_settings SET open_from = ${q(f)}, open_to = ${q(t)}, enabled = ${b.enabled === false ? 'false' : 'true'}, line_shutter = ${q(ls)}, scene_map = ${q(JSON.stringify(sm))}::jsonb, updated_at = now() WHERE id = 1 RETURNING row_to_json(door_settings)::text AS settings;`;
} else if (action === 'list_users') {
  query = `SELECT COALESCE((SELECT json_agg(u ORDER BY u.name) FROM door_access_users u), '[]'::json)::text AS users,
    COALESCE((SELECT json_agg(x) FROM (SELECT DISTINCT ON (line_user_id) line_user_id, user_name, ts FROM door_open_log WHERE source = 'line' AND line_user_id <> '' AND line_user_id NOT IN (SELECT line_user_id FROM door_access_users) ORDER BY line_user_id, ts DESC) x), '[]'::json)::text AS pending;`;
} else if (action === 'save_user') {
  query = `INSERT INTO door_access_users (line_user_id, name, active) VALUES (${q(b.line_user_id)}, ${q(b.name)}, ${b.active === false ? 'false' : 'true'}) ON CONFLICT (line_user_id) DO UPDATE SET name = EXCLUDED.name, active = EXCLUDED.active RETURNING line_user_id;`;
} else if (action === 'delete_user') {
  query = `DELETE FROM door_access_users WHERE line_user_id = ${q(b.line_user_id)} RETURNING line_user_id;`;
} else if (action === 'list_log') {
  query = `SELECT id, to_char(ts AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') AS ts, source, line_user_id, user_name, action, result, detail FROM door_open_log ORDER BY id DESC LIMIT ${Math.min(500, Number(b.limit) || 200)};`;
}
const lineToken = (typeof b.line_token === 'string' && b.line_token.startsWith('Bearer ')) ? b.line_token : '__STAFF_LINE_TOKEN__';   // OA ที่ส่งคำขอมา (ป.เปา ส่ง token มาด้วย) ไม่ส่ง = บอทพนักงาน MyMotor
return [{ json: { action, body: b, query, nowTh: th, cfg: { clientId: TUYA_CLIENT_ID, secret: TUYA_SECRET, base: TUYA_BASE, devices: DEVICES, homeId: HOME_ID, lineToken } } }];
""".replace("__STAFF_LINE_TOKEN__", STAFF_LINE_TOKEN).replace("__TUYA_CLIENT_ID__", SECRETS.get("tuya_client_id", "__TUYA_CLIENT_ID__")).replace("__TUYA_SECRET__", SECRETS.get("tuya_secret", "__TUYA_SECRET__"))

# ---------- Code: Decide (สิทธิ์/เวลา → แผน Tuya + ตอบกลับ) ----------
DECIDE = r"""const p = $('Prepare').first().json; const row = $input.first().json || {};
const { action, body: b, cfg, nowTh } = p;
let settings = {}, users = [];
try { settings = JSON.parse(row.settings || '{}') || {}; } catch (e) {}
try { users = JSON.parse(row.users || '[]') || []; } catch (e) {}
const out = { action, cfg, calls: [], log: null, reply: '', response: null, lineUserId: '', replyToken: '', needProfile: false, dbRow: row };
// which: 'both' | '1' | '2' — เลือกบานที่สั่ง (ประตูม้วน 1 = shutters[0], ประตูม้วน 2 = shutters[1])
const pickShutters = (which) => { const w = String(which || 'both'); return cfg.devices.shutters.filter((d, i) => w === 'both' || String(i + 1) === w); };
// ประตูม้วนเป็นรีโมทเสมือนของ RF Bridge (category rf_roller_blind) ไม่มี DP ให้สั่งตรง (control → 2008 "command or value not support") → สั่งผ่านฉาก Tap-to-Run ใน Smart Life ที่ผูกปุ่มรีโมทไว้ (settings.scene_map) ; ถ้ายังไม่ผูกฉาก fallback ยิง DP control
const sceneMap = (settings.scene_map && typeof settings.scene_map === 'object') ? settings.scene_map : {};
const cmdCalls = (value, which) => pickShutters(which).map((d) => {
  const idx = cfg.devices.shutters.indexOf(d) + 1; const sid = sceneMap[`${idx}_${value}`];
  if (sid) return { method: 'POST', path: `/v1.0/homes/${cfg.homeId}/scenes/${sid}/trigger`, body: {}, name: d.name, scene: sid };
  return { method: 'POST', path: `/v1.0/iot-03/devices/${d.id}/commands`, body: { commands: [{ code: 'control', value }] }, name: d.name };
});
if (action === 'line_open') {
  const uid = String(b.line_user_id || ''); out.lineUserId = uid; out.replyToken = String(b.reply_token || ''); out.needProfile = true;
  const u = users.find(x => x.line_user_id === uid);
  const inWindow = settings.enabled !== false && nowTh >= String(settings.open_from || '07:30') && nowTh <= String(settings.open_to || '08:00');
  if (!u || u.active === false) {
    out.reply = `ยังไม่ได้รับสิทธิ์เปิดประตูครับ แจ้งผู้ดูแลระบบให้เพิ่มชื่อก่อนนะครับ (รหัส LINE ของคุณถูกบันทึกไว้แล้ว)`;
    out.log = { source: 'line', line_user_id: uid, user_name: '', action: 'open', result: 'denied_user', detail: String(b.text || '').slice(0, 200) };
  } else if (!inWindow) {
    out.reply = `ขอโทษครับ ${u.name} เปิดประตูผ่าน LINE ได้เฉพาะช่วง ${settings.open_from}–${settings.open_to} น. ตอนนี้ ${nowTh} น. กรุณาติดต่อผู้ดูแลครับ`;
    out.log = { source: 'line', line_user_id: uid, user_name: u.name, action: 'open', result: 'denied_time', detail: `now ${nowTh}` };
  } else {
    out.calls = cmdCalls('open', settings.line_shutter); out.userName = u.name;
    out.log = { source: 'line', line_user_id: uid, user_name: u.name, action: 'open', result: 'pending', detail: out.calls.map(c => c.name).join('+') };
    out.reply = `กำลังเปิดประตูให้ ${u.name} ครับ รอสักครู่นะครับ 🚪`;
  }
} else if (action === 'open' || action === 'close' || action === 'stop') {
  out.calls = cmdCalls(action, b.shutter);   // b.shutter: both / 1 / 2 (ไม่ส่ง = ทั้ง 2 บาน)
  out.log = { source: 'web', line_user_id: '', user_name: String(b.user || ''), action, result: 'pending', detail: out.calls.map(c => c.name).join('+') };
} else if (action === 'status') {
  out.calls = [
    ...cfg.devices.sensors.map(d => ({ method: 'GET', path: `/v1.0/iot-03/devices/${d.id}/status`, body: null, name: d.name, kind: 'sensor', id: d.id })),
    ...cfg.devices.shutters.map(d => ({ method: 'GET', path: `/v1.0/iot-03/devices/${d.id}`, body: null, name: d.name, kind: 'shutter', id: d.id })),
    { method: 'GET', path: `/v1.0/iot-03/devices/${cfg.devices.bridge}`, body: null, name: 'RF Bridge', kind: 'bridge', id: cfg.devices.bridge },
  ];
  out.settings = settings;
} else if (action === 'functions') {
  out.calls = cfg.devices.shutters.map(d => ({ method: 'GET', path: `/v1.0/iot-03/devices/${d.id}/functions`, body: null, name: d.name }));
} else if (action === 'scenes') {   // รายการฉาก Tap-to-Run ในบ้าน Por.Paor (ให้หน้าเว็บเลือกผูกกับ บาน/คำสั่ง)
  out.calls = [{ method: 'GET', path: `/v1.0/homes/${cfg.homeId}/scenes`, body: null, name: 'scenes' }];
} else if (action === 'get_settings') {
  out.response = { settings, users };
} else if (action === 'save_settings') {
  out.response = { ok: true, settings }; out.log = { source: 'web', line_user_id: '', user_name: String(b.user || ''), action: 'save_settings', result: 'ok', detail: `${settings.open_from}-${settings.open_to} enabled=${settings.enabled} shutter=${settings.line_shutter || 'both'}` };
} else if (action === 'list_users') {
  let pending = []; try { pending = JSON.parse(row.pending || '[]') || []; } catch (e) {}
  out.response = { users, pending };
} else if (action === 'save_user' || action === 'delete_user') {
  out.response = { ok: !!row.line_user_id };
} else if (action === 'list_log') {
  out.response = { rows: $input.all().map(i => i.json).filter(r => r.id) };
} else {
  out.response = { error: 'unknown action ' + action };
}
return [{ json: out }];
"""

MERGE_PROFILE = r"""// รวมชื่อ LINE (ถ้ามี) เข้ากับแผน — ใช้ทั้งกรณีผ่านและไม่ผ่าน node LINE Profile
const d = $('Decide').first().json; const pr = $input.first().json || {};
const dn = pr.displayName ? String(pr.displayName) : '';
if (d.log && d.log.source === 'line' && !d.log.user_name && dn) d.log.user_name = dn;
if (d.log && d.log.source === 'line' && d.log.result === 'denied_user' && dn) d.log.detail = (d.log.detail ? d.log.detail + ' | ' : '') + 'LINE: ' + dn;
d.displayName = dn;
return [{ json: d }];
"""

HMAC_LIB = r"""
// ---- SHA-256 / HMAC-SHA256 แบบ JS ล้วน (n8n Code node ไม่มี require('crypto') และ Crypto node ให้ลายเซ็นไม่ตรงกับ Tuya 2026-10-22) ----
function utf8(s) { const o = []; for (const ch of String(s)) { let c = ch.codePointAt(0); if (c < 0x80) o.push(c); else if (c < 0x800) o.push(0xc0 | (c >> 6), 0x80 | (c & 63)); else if (c < 0x10000) o.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); else o.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); } return o; }
function sha256Bytes(bytes) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l = bytes.length; const bitLen = l * 8;
  const msg = bytes.slice(); msg.push(0x80); while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 7; i >= 0; i--) msg.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);   // ความยาว 64 บิต (รองรับ < 512MB)
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const W = new Array(64);
  for (let off = 0; off < msg.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = (msg[off + i*4] << 24) | (msg[off + i*4 + 1] << 16) | (msg[off + i*4 + 2] << 8) | msg[off + i*4 + 3];
    for (let i = 16; i < 64; i++) { const s0 = rotr(W[i-15], 7) ^ rotr(W[i-15], 18) ^ (W[i-15] >>> 3); const s1 = rotr(W[i-2], 17) ^ rotr(W[i-2], 19) ^ (W[i-2] >>> 10); W[i] = (W[i-16] + s0 + W[i-7] + s1) | 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25); const ch = (e & f) ^ (~e & g); const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22); const mj = (a & b) ^ (a & c) ^ (b & c); const t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H = H.map((v, i) => (v + [a, b, c, d, e, f, g, h][i]) | 0);
  }
  const out = []; for (const v of H) out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); return out;
}
const hex = (bytes) => bytes.map(b => (b < 16 ? '0' : '') + b.toString(16)).join('');
function sha256Hex(s) { return hex(sha256Bytes(utf8(s))); }
function hmacSha256Hex(key, msg) {
  let k = utf8(key); if (k.length > 64) k = sha256Bytes(k); while (k.length < 64) k.push(0);
  const ipad = k.map(b => b ^ 0x36), opad = k.map(b => b ^ 0x5c);
  return hex(sha256Bytes(opad.concat(sha256Bytes(ipad.concat(utf8(msg))))));
}
"""

TOKEN_SIGN = HMAC_LIB + r"""
// Tuya OpenAPI v2 sign (ขอ token): str = client_id + t + stringToSign ; stringToSign = GET\n<sha256('')>\n\n/v1.0/token?grant_type=1
const d = $input.first().json; const t = String(Date.now());
const url = '/v1.0/token?grant_type=1';
const strToSign = 'GET\n' + sha256Hex('') + '\n\n' + url;
const sign = hmacSha256Hex(d.cfg.secret, d.cfg.clientId + t + strToSign).toUpperCase();
return [{ json: { sign, t, url: d.cfg.base + url, clientId: d.cfg.clientId } }];
"""

CALL_PREP = HMAC_LIB + r"""
// ขยายเป็น 1 item ต่อ 1 คำสั่ง Tuya พร้อม access_token + ลายเซ็น (str = client_id + access_token + t + METHOD\nSHA256(body)\n\npath)
const tok = $input.first().json; const d = $('Merge Profile').first().json;
const access = tok && tok.result && tok.result.access_token;
const mk = (c, i) => { const t = String(Date.now()); const bodyStr = c.body ? JSON.stringify(c.body) : '';
  const strToSign = c.method + '\n' + sha256Hex(bodyStr) + '\n\n' + c.path;
  const sign = hmacSha256Hex(d.cfg.secret, d.cfg.clientId + (access || '') + t + strToSign).toUpperCase();
  return { json: { idx: i, name: c.name, kind: c.kind || '', devId: c.id || '', method: c.method, url: d.cfg.base + c.path, bodyStr, access: access || '', clientId: d.cfg.clientId, t, sign } }; };
if (!access) return [{ json: { tuyaError: 'token failed: ' + JSON.stringify(tok).slice(0, 300), ...mk({ method: 'GET', path: '/v1.0/token?grant_type=1', name: 'token' }, 0).json } }];   // token ไม่ได้: ยิง token ซ้ำแบบไม่เป็นอันตราย แล้ว Finalize อ่าน tuyaError
return d.calls.map(mk);
"""

FINALIZE = r"""// รวมผล Tuya (ถ้ามี) → บันทึก log + ตอบกลับ
const d = $('Merge Profile').first().json;
let items = $input.all().map(i => i.json);
let tokenErr = ''; try { const cp = $('Call Prep').first().json; if (cp && cp.tuyaError) tokenErr = cp.tuyaError; } catch (e) {}
const q = (s) => "'" + String(s ?? '').replace(/'/g, "''").slice(0, 2000) + "'";
let response = d.response; let reply = d.reply; let log = d.log;
if (d.calls.length) {
  if (tokenErr) items = d.calls.map(() => ({}));
  const results = items.map((r, i) => {
    const plan = d.calls[i] || {}; const tuya = tokenErr ? { success: false, msg: tokenErr } : (r.success !== undefined ? r : (r.result !== undefined ? r : { success: false, msg: JSON.stringify(r).slice(0, 200) }));
    return { name: plan.name, kind: plan.kind || '', id: plan.id || '', ok: tuya.success === true, result: tuya.result, msg: tuya.msg || tuya.code || '' };
  });
  if (d.action === 'status') {
    const sensors = results.filter(r => r.kind === 'sensor').map(r => { const st = Array.isArray(r.result) ? r.result : []; const dc = st.find(s => s.code === 'doorcontact_state'); const bat = st.find(s => /battery/.test(s.code)); return { name: r.name, id: r.id, ok: r.ok, open: dc ? !!dc.value : null, battery: bat ? bat.value : null, msg: r.msg }; });
    const shutters = results.filter(r => r.kind === 'shutter' || r.kind === 'bridge').map(r => ({ name: r.name, id: r.id, ok: r.ok, online: r.result ? !!r.result.online : null, msg: r.msg }));
    response = { sensors, shutters, settings: d.settings, nowTh: $('Prepare').first().json.nowTh };
  } else if (d.action === 'functions') {
    response = { functions: results };
  } else if (d.action === 'scenes') {
    const r0 = results[0] || {}; response = { ok: r0.ok, scenes: (Array.isArray(r0.result) ? r0.result : []).map(x => ({ scene_id: String(x.scene_id || x.id || ''), name: x.name || '' })), msg: r0.msg || '' };
  } else {
    const allOk = results.every(r => r.ok);
    response = { ok: allOk, results };
    if (log) { log.result = allOk ? 'opened' : 'error'; if (d.action !== 'open') log.result = allOk ? d.action : 'error'; log.detail = results.map(r => `${r.name}: ${r.ok ? 'ok' : r.msg}`).join(' | '); }
    if (d.action === 'line_open') reply = allOk ? `เปิดประตูแล้วครับ ${d.userName || ''} ✅` : `สั่งเปิดประตูไม่สำเร็จ (${results.filter(r => !r.ok).map(r => r.msg).join(', ')}) กรุณาแจ้งผู้ดูแลครับ`;
  }
}
const logQuery = log ? `INSERT INTO door_open_log (source, line_user_id, user_name, action, result, detail) VALUES (${q(log.source)}, ${q(log.line_user_id)}, ${q(log.user_name)}, ${q(log.action)}, ${q(log.result)}, ${q(log.detail)}) RETURNING id;` : 'SELECT 1 AS id;';
return [{ json: { response, reply, replyToken: d.replyToken, isLine: d.action === 'line_open', logQuery, lineToken: d.cfg.lineToken } }];
"""

def nid(): return str(uuid.uuid4())
CORS = {"responseHeaders": {"entries": [{"name": "Access-Control-Allow-Origin", "value": "*"}, {"name": "Access-Control-Allow-Headers", "value": "Content-Type"}]}}
def code(name, js, x, y): return {"parameters": {"jsCode": js}, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [x, y], "id": nid(), "name": name}
def pg(name, x, y): return {"parameters": {"operation": "executeQuery", "query": "{{ $json.query }}", "options": {}}, "type": "n8n-nodes-base.postgres", "typeVersion": 2.5, "position": [x, y], "id": nid(), "name": name, "alwaysOutputData": True, "credentials": PG, "onError": "continueRegularOutput"}
def if_node(name, left, right, x, y, op="equals", typ="string"):
    return {"parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                                           "conditions": [{"id": nid(), "leftValue": left, "rightValue": right, "operator": {"type": typ, "operation": op}}], "combinator": "and"}, "options": {}},
            "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [x, y], "id": nid(), "name": name}
def crypto_hmac(name, value, secret, prop, x, y):
    return {"parameters": {"action": "hmac", "type": "SHA256", "value": value, "dataPropertyName": prop, "secret": secret, "encoding": "hex"}, "type": "n8n-nodes-base.crypto", "typeVersion": 1, "position": [x, y], "id": nid(), "name": name}
def crypto_hash(name, value, prop, x, y):
    return {"parameters": {"action": "hash", "type": "SHA256", "value": value, "dataPropertyName": prop, "encoding": "hex"}, "type": "n8n-nodes-base.crypto", "typeVersion": 1, "position": [x, y], "id": nid(), "name": name}

tuya_hdr = lambda extra: {"parameters": [{"name": "client_id", "value": "={{ $json.clientId }}"}, {"name": "sign", "value": "={{ $json.sign }}"}, {"name": "t", "value": "={{ $json.t }}"}, {"name": "sign_method", "value": "HMAC-SHA256"}] + extra}

nodes = [
    {"parameters": {"httpMethod": "POST", "path": "door-api", "responseMode": "responseNode", "options": {"allowedOrigins": "*"}}, "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 0], "id": nid(), "name": "Webhook Door", "webhookId": nid()},
    code("Prepare", PREPARE, 220, 0),
    pg("PG Query", 440, 0),
    code("Decide", DECIDE, 660, 0),
    if_node("Need Profile", "={{ $json.needProfile }}", True, 880, 0, op="true", typ="boolean"),
    {"parameters": {"method": "GET", "url": "=https://api.line.me/v2/bot/profile/{{ $json.lineUserId }}", "sendHeaders": True, "headerParameters": {"parameters": [{"name": "Authorization", "value": "={{ $json.cfg.lineToken }}"}]}, "options": {"timeout": 8000}},
     "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1100, -140], "id": nid(), "name": "LINE Profile", "onError": "continueRegularOutput"},
    code("Merge Profile", MERGE_PROFILE, 1320, 0),
    if_node("Has Tuya", "={{ $json.calls.length }}", 0, 1540, 0, op="gt", typ="number"),
    code("Token Sign", TOKEN_SIGN, 1760, -160),
    {"parameters": {"method": "GET", "url": "={{ $json.url }}", "sendHeaders": True, "headerParameters": tuya_hdr([]), "options": {"timeout": 15000}},
     "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1980, -160], "id": nid(), "name": "Tuya Token", "onError": "continueRegularOutput"},
    code("Call Prep", CALL_PREP, 2640, -160),
    {"parameters": {"method": "={{ $json.method }}", "url": "={{ $json.url }}", "sendHeaders": True, "headerParameters": tuya_hdr([{"name": "access_token", "value": "={{ $json.access }}"}]),
                    "sendBody": "={{ $json.method === 'POST' }}", "contentType": "raw", "rawContentType": "application/json", "body": "={{ $json.bodyStr || '{}' }}", "options": {"timeout": 15000}},   # raw = ส่ง body ตรงตัวที่เซ็น (specifyBody json ถูก n8n แปลงใหม่ → Tuya 'sign invalid' 2026-10-22)
     "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [2420, -160], "id": nid(), "name": "Tuya Call", "onError": "continueRegularOutput"},
    code("Finalize", FINALIZE, 3960, 0),
    {"parameters": {"operation": "executeQuery", "query": "{{ $json.logQuery }}", "options": {}}, "type": "n8n-nodes-base.postgres", "typeVersion": 2.5, "position": [2860, 0], "id": nid(), "name": "PG Log", "alwaysOutputData": True, "credentials": PG, "onError": "continueRegularOutput"},
    if_node("From LINE", "={{ $('Finalize').first().json.isLine }}", True, 4400, 0, op="true", typ="boolean"),
    {"parameters": {"method": "POST", "url": "https://api.line.me/v2/bot/message/reply", "sendHeaders": True, "headerParameters": {"parameters": [{"name": "Authorization", "value": "={{ $('Finalize').first().json.lineToken }}"}]},
                    "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify({ replyToken: $('Finalize').first().json.replyToken, messages: [{ type: 'text', text: $('Finalize').first().json.reply }] }) }}", "options": {"timeout": 8000}},
     "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [3300, -140], "id": nid(), "name": "LINE Reply", "onError": "continueRegularOutput"},
    {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify($('Finalize').first().json.response) }}", "options": CORS},
     "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [3520, 0], "id": nid(), "name": "Respond", "executeOnce": True},
]
connections = {}
def link(a, b, out=0):
    m = connections.setdefault(a, {"main": []})["main"]
    while len(m) <= out: m.append([])
    m[out].append({"node": b, "type": "main", "index": 0})
for a, b in [("Webhook Door", "Prepare"), ("Prepare", "PG Query"), ("PG Query", "Decide"), ("Decide", "Need Profile"),
             ("LINE Profile", "Merge Profile"), ("Merge Profile", "Has Tuya"),
             ("Token Sign", "Tuya Token"), ("Tuya Token", "Call Prep"), ("Call Prep", "Tuya Call"),
             ("Tuya Call", "Finalize"), ("Finalize", "PG Log"), ("PG Log", "From LINE"), ("LINE Reply", "Respond")]:
    link(a, b)
link("Need Profile", "LINE Profile", 0); link("Need Profile", "Merge Profile", 1)
link("Has Tuya", "Token Sign", 0); link("Has Tuya", "Finalize", 1)
link("From LINE", "LINE Reply", 0); link("From LINE", "Respond", 1)

wf = {"name": "Door Control API", "nodes": nodes, "connections": connections, "active": False, "settings": {"executionOrder": "v1"}, "pinData": {}}
with open(os.path.join(OUT_DIR, "Door_Control_Workflow.json"), "w", encoding="utf-8") as f: json.dump(wf, f, ensure_ascii=False, indent=2)
with open(os.path.join(OUT_DIR, "Door_Control_DDL.sql"), "w", encoding="utf-8") as f:
    f.write("-- ประตูร้าน (door-api): ช่วงเวลาที่พนักงานขอเปิดทาง LINE ได้ · รายชื่อ LINE ที่มีสิทธิ์ · log การเปิด/ปฏิเสธ\n" + DDL + "\n")
print("written:", os.path.join(OUT_DIR, "Door_Control_Workflow.json"))
