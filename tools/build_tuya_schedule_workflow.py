# สร้าง n8n workflow "Tuya Schedule" — ตั้งเวลาเปิด/ปิด แอร์/ทีวี รายอุปกรณ์ (ตารางเก็บใน Postgres tuya_device_schedules แก้จากหน้า Smart Office) ผ่าน Tuya IR Control Hub API
# v2 (user 2026-10-30 "ตั้งเวลาเปิดปิดอุปกรณ์แต่ละตัวได้"): Schedule trigger ทุก 1 นาที → อ่านตาราง → ยิงคำสั่งของอุปกรณ์ที่ถึงเวลา (เวลาไทย, วันที่เลือก)
# ใช้โค้ดเซ็น HMAC-SHA256 แบบ JS ล้วน + ค่า client/secret/base เดียวกับ Door_Control_Workflow.json (Code node n8n require('crypto') ไม่ได้)
# โครง: Schedule (ทุกนาที) + Webhook tuya-schedule-api → Prepare → Build Sched SQL → PG Schedules → Token Sign → Tuya Token → List Prep → Tuya List → Command Prep (ยิงคำสั่งเองใน Code node) → Build Fired SQL → PG Fired → Result
# webhook: {action:'list'} → remotes+schedules · {action:'save_schedule', remote_id, on_time, off_time, days:'1234567', enabled} · {action:'cmd', remote_id, power|key} · {action:'run', slot:'on'|'ac'|'tv'} (ปุ่มสั่งทั้งหมด)
# API: GET /v1.0/infrareds/{blaster}/remotes (category_id '5' แอร์ / '2' ทีวี) · แอร์ POST /v1.0/infrareds/{ir}/air-conditioners/{remote}/command {code:'power', value:0|1} · ทีวี POST .../remotes/{remote}/command {key:'Power'} (ปุ่มสลับ)
# ⚠️ POST ต้องส่ง body เป็น object + json:true ใน this.helpers.httpRequest (string body → Tuya "sign invalid")
# output: C:\Users\manat\OneDrive\New folder\Tuya_Schedule_Workflow.json + Tuya_Schedule_DDL.sql
import json, os, re, subprocess, tempfile
D = r"C:\Users\manat\OneDrive\New folder"
DOOR = os.path.join(D, "Door_Control_Workflow.json")
OUT = os.path.join(D, "Tuya_Schedule_Workflow.json")
door = json.load(open(DOOR, encoding="utf-8"))
dn = {n["name"]: n for n in door["nodes"]}
prep_js = dn["Prepare"]["parameters"]["jsCode"]
CLIENT_ID = re.search(r"TUYA_CLIENT_ID = '([^']+)'", prep_js).group(1)
SECRET = re.search(r"TUYA_SECRET\s*= '([^']+)'", prep_js).group(1)
BASE = re.search(r"TUYA_BASE = '([^']+)'", prep_js).group(1)
sign_js = dn["Token Sign"]["parameters"]["jsCode"]
HELPERS = sign_js[:sign_js.index("\nconst d = $input")]   # utf8/sha256/hmac helpers (JS ล้วน)

DDL = """CREATE TABLE IF NOT EXISTS tuya_device_schedules (
  remote_id TEXT PRIMARY KEY,        -- remote_id ของ Tuya (= device id อุปกรณ์เสมือนใต้ IR blaster)
  blaster TEXT, kind TEXT,           -- kind: ac | tv
  name TEXT,
  on_time TEXT, off_time TEXT,       -- 'HH:MM' เวลาไทย หรือ NULL = ไม่ตั้ง
  days TEXT NOT NULL DEFAULT '1234567',   -- วันที่ทำงาน 1=จันทร์ … 7=อาทิตย์
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_fired TEXT,                   -- 'YYYY-MM-DD HH:MM on|off' กันยิงซ้ำในนาทีเดียวกัน
  updated_at TIMESTAMPTZ DEFAULT now()
);"""
SEED = ("INSERT INTO tuya_device_schedules (remote_id, blaster, kind, name, on_time, off_time) VALUES "
        "('ebe6c6996c7797e91f5g3p','eb57949ab6012fb6644pat','ac','Air TCL','08:00','17:10'), "
        "('ebcaecc68ae13e7545wnqh','eb57949ab6012fb6644pat','ac','Air Mitsubishi ตัวกลาง','08:00','17:10'), "
        "('eb827759879924b32aqxzr','eb619bef17ce0d7e9behnb','ac','Air1','08:00','17:10'), "
        "('eb070b3f31c73fee51vth8','eb57949ab6012fb6644pat','tv','TV','08:00','17:00') ON CONFLICT (remote_id) DO NOTHING;")

PREPARE = """// Tuya Schedule v2 — action: tick (จาก Schedule ทุกนาที) · list · save_schedule · cmd · run(slot on/ac/tv)
const cfg = { clientId: '__CID__', secret: '__SEC__', base: '__BASE__' };
const BLASTERS = [
  { id: 'eb57949ab6012fb6644pat', name: 'Smart IR (HMS06WB3S)' },
  { id: 'eb619bef17ce0d7e9behnb', name: 'LCD temp/humidity IR' },
];
const item = $input.first().json || {};
const b = item.body || {};
let action = String(b.action || 'tick').trim();
if (action === 'run' && String(b.slot) === 'list') action = 'list';
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' });
const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
const th = parts.hour + ':' + parts.minute;
const dow = String({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday] || 0);
const today = parts.year + '-' + parts.month + '-' + parts.day;
const cmd = (action === 'cmd' && b.remote_id) ? { remote_id: String(b.remote_id), power: Number(b.power) ? 1 : 0, key: String(b.key || 'Power') } : null;
const hhmm = (v) => { const m = String(v || '').trim().match(/^(\\d{1,2}):(\\d{2})$/); return m ? (m[1].padStart(2, '0') + ':' + m[2]) : null; };
const sched = (action === 'save_schedule' && b.remote_id) ? { remote_id: String(b.remote_id).slice(0, 40), blaster: String(b.blaster || '').slice(0, 40), kind: String(b.kind || '').slice(0, 8), name: String(b.name || '').slice(0, 80),
  on_time: hhmm(b.on_time), off_time: hhmm(b.off_time), days: String(b.days || '1234567').replace(/[^1-7]/g, '') || '1234567', enabled: b.enabled !== false && b.enabled !== 'false' } : null;
return [{ json: { cfg, blasters: BLASTERS, action, slot: String(b.slot || ''), th, dow, today, cmd, sched } }];
""".replace("__CID__", CLIENT_ID).replace("__SEC__", SECRET).replace("__BASE__", BASE)

SCHED_SQL = """// ตารางเวลาต่ออุปกรณ์ใน Postgres: สร้างตาราง + seed ค่าเริ่มต้น (08:00 เปิด · 17:00 ปิดทีวี · 17:10 ปิดแอร์) + บันทึกเมื่อ save_schedule → คืนทุกแถว
const d = $input.first().json;
const esc = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const sTxt = (v) => (v == null || String(v).trim() === '') ? 'NULL' : `'${esc(v)}'`;
let q = `__DDL__\\n__SEED__\\n`;
if (d.sched) {
  const s = d.sched;
  q += `INSERT INTO tuya_device_schedules (remote_id, blaster, kind, name, on_time, off_time, days, enabled, updated_at) VALUES ('${esc(s.remote_id)}', ${sTxt(s.blaster)}, ${sTxt(s.kind)}, ${sTxt(s.name)}, ${sTxt(s.on_time)}, ${sTxt(s.off_time)}, '${esc(s.days)}', ${s.enabled ? 'true' : 'false'}, now())\\n` +
       `ON CONFLICT (remote_id) DO UPDATE SET blaster = COALESCE(EXCLUDED.blaster, tuya_device_schedules.blaster), kind = COALESCE(EXCLUDED.kind, tuya_device_schedules.kind), name = COALESCE(EXCLUDED.name, tuya_device_schedules.name), on_time = EXCLUDED.on_time, off_time = EXCLUDED.off_time, days = EXCLUDED.days, enabled = EXCLUDED.enabled, updated_at = now();\\n`;
}
q += `SELECT remote_id, blaster, kind, name, on_time, off_time, days, enabled, last_fired, to_char(updated_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI') AS updated_local FROM tuya_device_schedules ORDER BY kind, name;`;
return [{ json: { query: q } }];
""".replace("__DDL__", re.sub(r"--[^\n]*", "", DDL).replace("\n", " "))   # ตัด comment -- ก่อนยุบบรรทัด (comment กลืน SQL ที่เหลือ → Error in workflow 2026-10-30).replace("__SEED__", SEED)

TOKEN_SIGN = HELPERS + """
const d = $('Prepare').first().json; const t = String(Date.now());
const url = '/v1.0/token?grant_type=1';
const strToSign = 'GET\\n' + sha256Hex('') + '\\n\\n' + url;
const sign = hmacSha256Hex(d.cfg.secret, d.cfg.clientId + t + strToSign).toUpperCase();
return [{ json: { sign, t, url: d.cfg.base + url, clientId: d.cfg.clientId } }];
"""

LIST_PREP = HELPERS + """
// รายการรีโมท (แอร์/ทีวี) ใต้ IR blaster แต่ละตัว (IR Control Hub API)
const tok = $input.first().json; const d = $('Prepare').first().json;
const access = tok && tok.result && tok.result.access_token;
if (!access) throw new Error('tuya token failed: ' + JSON.stringify(tok).slice(0, 200));
return d.blasters.map((bl) => { const t = String(Date.now()); const path = `/v1.0/infrareds/${bl.id}/remotes`;
  const strToSign = 'GET\\n' + sha256Hex('') + '\\n\\n' + path;
  const sign = hmacSha256Hex(d.cfg.secret, d.cfg.clientId + access + t + strToSign).toUpperCase();
  return { json: { blaster: bl.id, blasterName: bl.name, method: 'GET', url: d.cfg.base + path, bodyStr: '', access, clientId: d.cfg.clientId, t, sign } }; });
"""

CMD_PREP = HELPERS + """
// รวมรีโมท + ตารางเวลา แล้วตัดสินคำสั่งตาม action: tick (ถึงเวลาของอุปกรณ์ไหน → ยิง) · cmd · run(slot) · list/save_schedule (ไม่ยิง)
const d = $('Prepare').first().json; const lists = $('List Prep').all().map((x) => x.json); const res = $input.all().map((x) => x.json);
const schedules = $('PG Schedules').all().map((x) => x.json).filter((r) => r && r.remote_id);
const access = lists[0].access;
const remotes = [];
res.forEach((r, i) => { const bl = lists[i] || {}; (r.result || []).forEach((rm) => remotes.push({ blaster: bl.blaster, blasterName: bl.blasterName, id: rm.remote_id, name: rm.remote_name, category: String(rm.category_id), brand: rm.brand_name })); });
const AC = remotes.filter((r) => r.category === '5');
const TV = remotes.filter((r) => r.category === '2');
const acCmd = (r, on) => ({ kind: 'ac', name: r.name, remote_id: r.id, method: 'POST', path: `/v1.0/infrareds/${r.blaster}/air-conditioners/${r.id}/command`, body: { code: 'power', value: on ? 1 : 0 }, what: on ? 'on' : 'off' });
const tvCmd = (r, what) => ({ kind: 'tv', name: r.name, remote_id: r.id, method: 'POST', path: `/v1.0/infrareds/${r.blaster}/remotes/${r.id}/command`, body: { key: 'Power' }, what: what || 'power' });
const calls = [];
if (d.action === 'cmd' && d.cmd) {   // สั่งเดี่ยวจากหน้า Smart Office
  const r = remotes.find((x) => x.id === d.cmd.remote_id);
  if (!r) return [{ json: { ok: false, action: 'cmd', error: 'remote not found: ' + d.cmd.remote_id, remotes, schedules } }];
  calls.push(r.category === '5' ? acCmd(r, !!d.cmd.power) : tvCmd(r));
}
if (d.action === 'run') {   // ปุ่มสั่งทั้งหมด
  if (d.slot === 'ac') AC.forEach((r) => calls.push(acCmd(r, false)));
  if (d.slot === 'tv') TV.forEach((r) => calls.push(tvCmd(r)));
  if (d.slot === 'on') { AC.forEach((r) => calls.push(acCmd(r, true))); TV.forEach((r) => calls.push(tvCmd(r))); }
}
if (d.action === 'tick') {   // ตารางรายอุปกรณ์: ถึงเวลา (นาทีตรง, วันที่เลือก, เปิดใช้) และยังไม่เคยยิงในนาทีนี้
  for (const s of schedules) {
    if (!s.enabled || !String(s.days || '').includes(d.dow)) continue;
    const r = remotes.find((x) => x.id === s.remote_id); if (!r) continue;
    const what = s.on_time === d.th ? 'on' : (s.off_time === d.th ? 'off' : null); if (!what) continue;
    const stamp = d.today + ' ' + d.th + ' ' + what; if (s.last_fired === stamp) continue;
    calls.push(Object.assign(r.category === '5' ? acCmd(r, what === 'on') : tvCmd(r, what), { stamp }));
  }
}
if (!calls.length) return [{ json: { ok: true, noop: true, action: d.action, slot: d.slot, th: d.th, dow: d.dow, sent: 0, remotes, schedules, saved: !!d.sched } }];
// ยิงเองใน Code node ด้วย body object + json:true (string body ทำให้ hash ไม่ตรง "sign invalid")
const results = [];
for (const c of calls) {
  const t = String(Date.now()); const bodyStr = JSON.stringify(c.body);
  const strToSign = c.method + '\\n' + sha256Hex(bodyStr) + '\\n\\n' + c.path;
  const sign = hmacSha256Hex(d.cfg.secret, d.cfg.clientId + access + t + strToSign).toUpperCase();
  let r = null;
  try {
    r = await this.helpers.httpRequest({ method: c.method, url: d.cfg.base + c.path, body: c.body, json: true, returnFullResponse: false, timeout: 15000,
      headers: { client_id: d.cfg.clientId, sign, t, sign_method: 'HMAC-SHA256', access_token: access, 'Content-Type': 'application/json', Accept: 'application/json' } });
    if (typeof r === 'string') { try { r = JSON.parse(r); } catch { r = { raw: String(r).slice(0, 200) }; } }
  } catch (e) { r = { success: false, msg: String(e && e.message || e).slice(0, 200) }; }
  results.push({ name: c.name, kind: c.kind, remote_id: c.remote_id, what: c.what, stamp: c.stamp || null, success: !!(r && r.success && r.result !== false), msg: r && (r.msg || r.code || '') });
}
return [{ json: { ok: results.every((x) => x.success), action: d.action, slot: d.slot, th: d.th, sent: results.length, results, remotes, schedules } }];
"""

FIRED_SQL = """// บันทึก last_fired ของอุปกรณ์ที่ยิงตามตารางสำเร็จ (กันยิงซ้ำในนาทีเดียวกัน) — ไม่มีอะไรยิง = SELECT 1
const r = $input.first().json || {};
const esc = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const fired = (r.results || []).filter((x) => x.stamp && x.success);
if (!fired.length) return [{ json: { query: 'SELECT 1 AS nop' } }];
const q = fired.map((x) => `UPDATE tuya_device_schedules SET last_fired = '${esc(x.stamp)}' WHERE remote_id = '${esc(x.remote_id)}';`).join('\\n') + '\\nSELECT 1 AS done;';
return [{ json: { query: q } }];
"""

RESULT = "// ส่งผลของ Command Prep กลับให้ webhook (PG Fired คืนแค่ nop/done)\nreturn [{ json: $('Command Prep').first().json }];"

http_hdr = [{"name": "client_id", "value": "={{ $json.clientId }}"}, {"name": "sign", "value": "={{ $json.sign }}"}, {"name": "t", "value": "={{ $json.t }}"}, {"name": "sign_method", "value": "HMAC-SHA256"}]
w = {
    "name": "Tuya Schedule",
    "nodes": [
        {"parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 * * * * *"}]}},
         "id": "ts01", "name": "Schedule", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [200, 200]},
        {"parameters": {"httpMethod": "POST", "path": "tuya-schedule-api", "responseMode": "lastNode", "options": {"allowedOrigins": "*"}},
         "id": "ts02", "name": "Webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [200, 400], "webhookId": "tuya-schedule-api"},
        {"parameters": {"jsCode": PREPARE}, "id": "ts03", "name": "Prepare", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [440, 300]},
        {"parameters": {"jsCode": SCHED_SQL}, "id": "ts11", "name": "Build Sched SQL", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [640, 300]},
        {"parameters": {"operation": "executeQuery", "query": "={{ $json.query }}", "options": {}}, "id": "ts12", "name": "PG Schedules", "type": "n8n-nodes-base.postgres", "typeVersion": 2.5, "position": [840, 300], "credentials": {}, "alwaysOutputData": True},
        {"parameters": {"jsCode": TOKEN_SIGN}, "id": "ts04", "name": "Token Sign", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1040, 300]},
        {"parameters": {"method": "GET", "url": "={{ $json.url }}", "sendHeaders": True, "headerParameters": {"parameters": http_hdr}, "options": {"timeout": 15000}},
         "id": "ts05", "name": "Tuya Token", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1240, 300]},
        {"parameters": {"jsCode": LIST_PREP}, "id": "ts06", "name": "List Prep", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1440, 300]},
        {"parameters": {"method": "GET", "url": "={{ $json.url }}", "sendHeaders": True, "headerParameters": {"parameters": http_hdr + [{"name": "access_token", "value": "={{ $json.access }}"}]}, "options": {"timeout": 15000}},
         "id": "ts07", "name": "Tuya List", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1640, 300], "onError": "continueRegularOutput"},
        {"parameters": {"jsCode": CMD_PREP}, "id": "ts08", "name": "Command Prep", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1840, 300]},
        {"parameters": {"jsCode": FIRED_SQL}, "id": "ts13", "name": "Build Fired SQL", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [2040, 300]},
        {"parameters": {"operation": "executeQuery", "query": "={{ $json.query }}", "options": {}}, "id": "ts14", "name": "PG Fired", "type": "n8n-nodes-base.postgres", "typeVersion": 2.5, "position": [2240, 300], "credentials": {}, "alwaysOutputData": True},
        {"parameters": {"jsCode": RESULT}, "id": "ts15", "name": "Result", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [2440, 300]},
    ],
    "connections": {
        "Schedule": {"main": [[{"node": "Prepare", "type": "main", "index": 0}]]},
        "Webhook": {"main": [[{"node": "Prepare", "type": "main", "index": 0}]]},
        "Prepare": {"main": [[{"node": "Build Sched SQL", "type": "main", "index": 0}]]},
        "Build Sched SQL": {"main": [[{"node": "PG Schedules", "type": "main", "index": 0}]]},
        "PG Schedules": {"main": [[{"node": "Token Sign", "type": "main", "index": 0}]]},
        "Token Sign": {"main": [[{"node": "Tuya Token", "type": "main", "index": 0}]]},
        "Tuya Token": {"main": [[{"node": "List Prep", "type": "main", "index": 0}]]},
        "List Prep": {"main": [[{"node": "Tuya List", "type": "main", "index": 0}]]},
        "Tuya List": {"main": [[{"node": "Command Prep", "type": "main", "index": 0}]]},
        "Command Prep": {"main": [[{"node": "Build Fired SQL", "type": "main", "index": 0}]]},
        "Build Fired SQL": {"main": [[{"node": "PG Fired", "type": "main", "index": 0}]]},
        "PG Fired": {"main": [[{"node": "Result", "type": "main", "index": 0}]]},
    },
    "settings": {"executionOrder": "v1", "timezone": "Asia/Bangkok"},
    "meta": {"instanceId": ""},
}
json.dump(w, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(os.path.join(D, "Tuya_Schedule_DDL.sql"), "w", encoding="utf-8").write("-- ตารางเวลาเปิด/ปิดอุปกรณ์ (Smart Office) — workflow รัน CREATE TABLE + seed เองทุกครั้ง\n" + DDL + "\n" + SEED + "\n")
for name, code in (("PREPARE", PREPARE), ("SCHED_SQL", SCHED_SQL), ("TOKEN_SIGN", TOKEN_SIGN), ("LIST_PREP", LIST_PREP), ("CMD_PREP", CMD_PREP), ("FIRED_SQL", FIRED_SQL), ("RESULT", RESULT)):
    stub = "const $=(x)=>({first:()=>({json:{body:{}}}),all:()=>[]});const $input={first:()=>({json:{body:{}}}),all:()=>[]};\n(async function(){" + code + "\n})();"
    f = os.path.join(tempfile.gettempdir(), "chk_" + name + ".js"); open(f, "w", encoding="utf-8").write(stub)
    r = subprocess.run(["node", "--check", f], capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(name, "=>", "OK" if r.returncode == 0 else r.stderr[-400:])
print("written", OUT)
