# สร้าง n8n workflow "Tuya Schedule" — เปิดแอร์+ทีวี 08:00 / ปิดทีวี 17:00 / ปิดแอร์ 17:10 ทุกวัน ผ่าน Tuya Cloud API (IR blaster Smart Life) — user 2026-10-29 "แบบ 2"
# ใช้โค้ดเซ็น HMAC-SHA256 แบบ JS ล้วน + ค่า client/secret/base เดียวกับ Door_Control_Workflow.json (Code node n8n require('crypto') ไม่ได้)
# โครง: Schedule (17:00, 17:10 Asia/Bangkok) + Webhook tuya-schedule-api (ทดสอบ {action:'run', slot:'tv'|'ac'|'list'}) → Prepare → Token Sign → Tuya Token
#       → List Prep (GET /v1.0/infrareds/{blaster}/remotes ทุกตัว) → Tuya List → Command Prep (เลือกรีโมทตามชนิด → คำสั่งปิด) → Tuya Cmd → Finalize
# ⚠️ IR Control Hub API ไม่ได้สมัคร (No permissions) → ใช้ "อุปกรณ์เสมือน" ที่ Smart Life สร้างให้แทน: GET /v1.0/iot-03/devices/{blaster}/sub-devices (category infrared_ac / infrared_tv)
#    แอร์: POST /v1.0/iot-03/devices/{id}/commands {commands:[{code:'PowerOff'|'PowerOn', value:'PowerOff'|'PowerOn'}]} (ทดสอบ 2026-10-29 17:12 ปิดได้ 3 ตัว)
#    ทีวี: code 'Power' value 'Power' (ปุ่มสลับ ไม่รู้สถานะ — 08:00 เปิด / 17:00 ปิด ถ้ามีคนกดรีโมทเองระหว่างวันอาจสลับผิด)
# output: C:\Users\manat\OneDrive\New folder\Tuya_Schedule_Workflow.json
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

PREPARE = f"""// Tuya Schedule — ตัดสินว่ารอบนี้ทำอะไร: 17:00 ปิดทีวี · 17:10 ปิดแอร์ (เวลาไทย) หรือสั่งผ่าน webhook {{action:'run', slot:'tv'|'ac'|'list'}}
const cfg = {{ clientId: '{CLIENT_ID}', secret: '{SECRET}', base: '{BASE}' }};
const BLASTERS = [
  {{ id: 'eb57949ab6012fb6644pat', name: 'Smart IR (HMS06WB3S)' }},
  {{ id: 'eb619bef17ce0d7e9behnb', name: 'LCD temp/humidity IR' }},
];
const SLOTS = {{ '08:00': 'on', '17:00': 'tv', '17:10': 'ac' }};   // 08:00 เปิดแอร์+ทีวี · 17:00 ปิดทีวี · 17:10 ปิดแอร์ — แก้เวลาที่นี่ + cron ใน Schedule Trigger
const item = $input.first().json || {{}};
const b = item.body || {{}};
let slot = String(b.slot || '').trim();
const th = new Intl.DateTimeFormat('en-GB', {{ timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }}).format(new Date());
if (!slot) slot = SLOTS[th] || Object.entries(SLOTS).find(([k]) => Math.abs(parseInt(k.slice(0, 2)) * 60 + parseInt(k.slice(3)) - (parseInt(th.slice(0, 2)) * 60 + parseInt(th.slice(3)))) <= 2)?.[1] || 'list';
return [{{ json: {{ cfg, blasters: BLASTERS, slot, th, manual: !!b.action }} }}];
"""

TOKEN_SIGN = HELPERS + """
const d = $input.first().json; const t = String(Date.now());
const url = '/v1.0/token?grant_type=1';
const strToSign = 'GET\\n' + sha256Hex('') + '\\n\\n' + url;
const sign = hmacSha256Hex(d.cfg.secret, d.cfg.clientId + t + strToSign).toUpperCase();
return [{ json: { sign, t, url: d.cfg.base + url, clientId: d.cfg.clientId } }];
"""

LIST_PREP = HELPERS + """
// รายการอุปกรณ์เสมือน (แอร์/ทีวี) ใต้ IR blaster แต่ละตัว
const tok = $input.first().json; const d = $('Prepare').first().json;
const access = tok && tok.result && tok.result.access_token;
if (!access) throw new Error('tuya token failed: ' + JSON.stringify(tok).slice(0, 200));
return d.blasters.map((bl) => { const t = String(Date.now()); const path = `/v1.0/iot-03/devices/${bl.id}/sub-devices`;
  const strToSign = 'GET\\n' + sha256Hex('') + '\\n\\n' + path;
  const sign = hmacSha256Hex(d.cfg.secret, d.cfg.clientId + access + t + strToSign).toUpperCase();
  return { json: { blaster: bl.id, blasterName: bl.name, method: 'GET', url: d.cfg.base + path, bodyStr: '', access, clientId: d.cfg.clientId, t, sign } }; });
"""

CMD_PREP = HELPERS + """
// เลือกรีโมทตาม slot แล้วสร้างคำสั่งปิด (ลงนามทีละคำสั่ง)
const d = $('Prepare').first().json; const lists = $('List Prep').all().map((x) => x.json); const res = $input.all().map((x) => x.json);
const access = lists[0].access;
const remotes = [];
res.forEach((r, i) => { const bl = lists[i] || {}; (r.result || []).forEach((dv) => remotes.push({ blaster: bl.blaster, blasterName: bl.blasterName, id: dv.id, name: dv.name, category: dv.category, online: dv.online })); });
const AC = remotes.filter((r) => r.category === 'infrared_ac');
const TV = remotes.filter((r) => r.category === 'infrared_tv');
const cmd = (r, kind, code) => ({ kind, name: r.name, method: 'POST', path: `/v1.0/iot-03/devices/${r.id}/commands`, body: { commands: [{ code, value: code }] } });
const calls = [];
if (d.slot === 'ac') AC.forEach((r) => calls.push(cmd(r, 'ac', 'PowerOff')));
if (d.slot === 'tv') TV.forEach((r) => calls.push(cmd(r, 'tv', 'Power')));
if (d.slot === 'on') { AC.forEach((r) => calls.push(cmd(r, 'ac', 'PowerOn'))); TV.forEach((r) => calls.push(cmd(r, 'tv', 'Power'))); }   // ทีวี = ปุ่ม power สลับ (ตอน 08:00 ทีวีควรปิดอยู่)
if (!calls.length) return [{ json: { noop: true, slot: d.slot, th: d.th, remotes } }];
return calls.map((c, i) => { const t = String(Date.now()); const bodyStr = JSON.stringify(c.body);
  const strToSign = c.method + '\\n' + sha256Hex(bodyStr) + '\\n\\n' + c.path;
  const sign = hmacSha256Hex(d.cfg.secret, d.cfg.clientId + access + t + strToSign).toUpperCase();
  return { json: { idx: i, kind: c.kind, name: c.name, method: c.method, url: d.cfg.base + c.path, bodyStr, access, clientId: d.cfg.clientId, t, sign, slot: d.slot, th: d.th, remotes } }; });
"""

FINALIZE = """// สรุปผล (ทดสอบผ่าน webhook จะเห็นตรงนี้)
const d = $('Prepare').first().json;
const items = $input.all().map((x) => x.json);
const prep = $('Command Prep').all().map((x) => x.json);
if (prep.length && prep[0].noop) return [{ json: { ok: true, slot: d.slot, th: d.th, sent: 0, remotes: prep[0].remotes } }];
const results = items.map((r, i) => ({ name: prep[i] && prep[i].name, kind: prep[i] && prep[i].kind, success: !!(r && r.success && r.result !== false), msg: r && (r.msg || r.code) }));
return [{ json: { ok: results.every((r) => r.success), slot: d.slot, th: d.th, sent: results.length, results } }];
"""

http_hdr = [{"name": "client_id", "value": "={{ $json.clientId }}"}, {"name": "sign", "value": "={{ $json.sign }}"}, {"name": "t", "value": "={{ $json.t }}"}, {"name": "sign_method", "value": "HMAC-SHA256"}]
w = {
    "name": "Tuya Schedule",
    "nodes": [
        {"parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 0 8 * * *"}, {"field": "cronExpression", "expression": "0 0 17 * * *"}, {"field": "cronExpression", "expression": "0 10 17 * * *"}]}},
         "id": "ts01", "name": "Schedule", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [200, 200]},
        {"parameters": {"httpMethod": "POST", "path": "tuya-schedule-api", "responseMode": "lastNode", "options": {"allowedOrigins": "*"}},
         "id": "ts02", "name": "Webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [200, 400], "webhookId": "tuya-schedule-api"},
        {"parameters": {"jsCode": PREPARE}, "id": "ts03", "name": "Prepare", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [440, 300]},
        {"parameters": {"jsCode": TOKEN_SIGN}, "id": "ts04", "name": "Token Sign", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [660, 300]},
        {"parameters": {"method": "GET", "url": "={{ $json.url }}", "sendHeaders": True, "headerParameters": {"parameters": http_hdr}, "options": {"timeout": 15000}},
         "id": "ts05", "name": "Tuya Token", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [880, 300]},
        {"parameters": {"jsCode": LIST_PREP}, "id": "ts06", "name": "List Prep", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1100, 300]},
        {"parameters": {"method": "GET", "url": "={{ $json.url }}", "sendHeaders": True, "headerParameters": {"parameters": http_hdr + [{"name": "access_token", "value": "={{ $json.access }}"}]}, "options": {"timeout": 15000}},
         "id": "ts07", "name": "Tuya List", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1320, 300], "onError": "continueRegularOutput"},
        {"parameters": {"jsCode": CMD_PREP}, "id": "ts08", "name": "Command Prep", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1540, 300]},
        {"parameters": {"method": "={{ $json.method || 'GET' }}", "url": "={{ $json.url || ($json.noop ? 'https://openapi.tuyaus.com/v1.0/token?grant_type=1' : '') }}", "sendHeaders": True,
                        "headerParameters": {"parameters": http_hdr + [{"name": "access_token", "value": "={{ $json.access }}"}]},
                        "sendBody": "={{ !!$json.bodyStr }}", "contentType": "raw", "rawContentType": "application/json", "body": "={{ $json.bodyStr || '{}' }}", "options": {"timeout": 15000}},
         "id": "ts09", "name": "Tuya Cmd", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1760, 300], "onError": "continueRegularOutput"},
        {"parameters": {"jsCode": FINALIZE}, "id": "ts10", "name": "Finalize", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1980, 300]},
    ],
    "connections": {
        "Schedule": {"main": [[{"node": "Prepare", "type": "main", "index": 0}]]},
        "Webhook": {"main": [[{"node": "Prepare", "type": "main", "index": 0}]]},
        "Prepare": {"main": [[{"node": "Token Sign", "type": "main", "index": 0}]]},
        "Token Sign": {"main": [[{"node": "Tuya Token", "type": "main", "index": 0}]]},
        "Tuya Token": {"main": [[{"node": "List Prep", "type": "main", "index": 0}]]},
        "List Prep": {"main": [[{"node": "Tuya List", "type": "main", "index": 0}]]},
        "Tuya List": {"main": [[{"node": "Command Prep", "type": "main", "index": 0}]]},
        "Command Prep": {"main": [[{"node": "Tuya Cmd", "type": "main", "index": 0}]]},
        "Tuya Cmd": {"main": [[{"node": "Finalize", "type": "main", "index": 0}]]},
    },
    "settings": {"executionOrder": "v1", "timezone": "Asia/Bangkok"},
    "meta": {"instanceId": ""},
}
json.dump(w, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
for name, code in (("PREPARE", PREPARE), ("TOKEN_SIGN", TOKEN_SIGN), ("LIST_PREP", LIST_PREP), ("CMD_PREP", CMD_PREP), ("FINALIZE", FINALIZE)):
    stub = "const $=(x)=>({first:()=>({json:{}}),all:()=>[]});const $input={first:()=>({json:{}}),all:()=>[]};\n(function(){" + code + "\n})();"
    f = os.path.join(tempfile.gettempdir(), "chk_" + name + ".js"); open(f, "w", encoding="utf-8").write(stub)
    r = subprocess.run(["node", "--check", f], capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(name, "=>", "OK" if r.returncode == 0 else r.stderr[-400:])
print("written", OUT)
