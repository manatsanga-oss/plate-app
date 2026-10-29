# สร้าง n8n workflow "Tuya Schedule" — เปิดแอร์+ทีวี 08:00 / ปิดทีวี 17:00 / ปิดแอร์ 17:10 ทุกวัน ผ่าน Tuya Cloud API (IR blaster Smart Life) — user 2026-10-29 "แบบ 2"
# ใช้โค้ดเซ็น HMAC-SHA256 แบบ JS ล้วน + ค่า client/secret/base เดียวกับ Door_Control_Workflow.json (Code node n8n require('crypto') ไม่ได้)
# โครง: Schedule (08:00, 17:00, 17:10 Asia/Bangkok) + Webhook tuya-schedule-api (ทดสอบ {action:'run', slot:'tv'|'ac'|'list'}) → Prepare → Token Sign → Tuya Token
#       → List Prep (GET /v1.0/infrareds/{blaster}/remotes ทุกตัว) → Tuya List → Command Prep (เลือกรีโมทตามชนิด → ยิงคำสั่งเองใน Code node)
# ใช้ IR Control Hub Open Service (สมัคร Free Trial + Authorize ในโปรเจกต์ 2026-10-29): GET /v1.0/infrareds/{blaster}/remotes (category_id '5'=แอร์, '2'=ทีวี)
#    แอร์: POST /v1.0/infrareds/{ir}/air-conditioners/{remote}/command {code:'power', value:0|1} (ทดสอบ 17:26 ปิดได้ 3 ตัว user ยืนยัน)
#    ทีวี: POST /v1.0/infrareds/{ir}/remotes/{remote}/command {key:'Power'} (รีโมทเรียนรู้เอง key ตาม GET .../keys; ปุ่มสลับไม่รู้สถานะ)
#    ⚠️ เส้นทาง /v1.0/iot-03/devices/{id}/commands ของอุปกรณ์เสมือน ตอบ success แต่ไม่ยิง IR จริง (ทดสอบ 17:12 ไม่ดับ)
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
// เลือกรีโมทตาม slot แล้วสร้างคำสั่งปิด (ลงนามทีละคำสั่ง)
const d = $('Prepare').first().json; const lists = $('List Prep').all().map((x) => x.json); const res = $input.all().map((x) => x.json);
const access = lists[0].access;
const remotes = [];
res.forEach((r, i) => { const bl = lists[i] || {}; (r.result || []).forEach((rm) => remotes.push({ blaster: bl.blaster, blasterName: bl.blasterName, id: rm.remote_id, name: rm.remote_name, category: String(rm.category_id), brand: rm.brand_name })); });
const AC = remotes.filter((r) => r.category === '5');
const TV = remotes.filter((r) => r.category === '2');
const acCmd = (r, on) => ({ kind: 'ac', name: r.name, method: 'POST', path: `/v1.0/infrareds/${r.blaster}/air-conditioners/${r.id}/command`, body: { code: 'power', value: on ? 1 : 0 } });
const tvCmd = (r) => ({ kind: 'tv', name: r.name, method: 'POST', path: `/v1.0/infrareds/${r.blaster}/remotes/${r.id}/command`, body: { key: 'Power' } });
const calls = [];
if (d.slot === 'ac') AC.forEach((r) => calls.push(acCmd(r, false)));
if (d.slot === 'tv') TV.forEach((r) => calls.push(tvCmd(r)));
if (d.slot === 'on') { AC.forEach((r) => calls.push(acCmd(r, true))); TV.forEach((r) => calls.push(tvCmd(r))); }   // ทีวี = ปุ่ม Power สลับ (ตอน 08:00 ทีวีควรปิดอยู่)
if (!calls.length) return [{ json: { ok: true, noop: true, slot: d.slot, th: d.th, sent: 0, remotes } }];
// ยิงเองใน Code node ด้วย body string ตรงตัว (HTTP Request node แปลง body ทำให้ hash ไม่ตรง "sign invalid" 2026-10-29)
const results = [];
for (const c of calls) {
  const t = String(Date.now()); const bodyStr = JSON.stringify(c.body);
  const strToSign = c.method + '\\n' + sha256Hex(bodyStr) + '\\n\\n' + c.path;
  const sign = hmacSha256Hex(d.cfg.secret, d.cfg.clientId + access + t + strToSign).toUpperCase();
  let r = null;
  try {
    r = await this.helpers.httpRequest({ method: c.method, url: d.cfg.base + c.path, body: bodyStr, json: false, returnFullResponse: false, timeout: 15000,
      headers: { client_id: d.cfg.clientId, sign, t, sign_method: 'HMAC-SHA256', access_token: access, 'Content-Type': 'application/json', Accept: 'application/json' } });
    if (typeof r === 'string') { try { r = JSON.parse(r); } catch { r = { raw: String(r).slice(0, 200) }; } }
  } catch (e) { r = { success: false, msg: String(e && e.message || e).slice(0, 200) }; }
  results.push({ name: c.name, kind: c.kind, success: !!(r && r.success && r.result !== false), msg: r && (r.msg || r.code || '') });
}
return [{ json: { ok: results.every((x) => x.success), slot: d.slot, th: d.th, sent: results.length, results } }];
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
    ],
    "connections": {
        "Schedule": {"main": [[{"node": "Prepare", "type": "main", "index": 0}]]},
        "Webhook": {"main": [[{"node": "Prepare", "type": "main", "index": 0}]]},
        "Prepare": {"main": [[{"node": "Token Sign", "type": "main", "index": 0}]]},
        "Token Sign": {"main": [[{"node": "Tuya Token", "type": "main", "index": 0}]]},
        "Tuya Token": {"main": [[{"node": "List Prep", "type": "main", "index": 0}]]},
        "List Prep": {"main": [[{"node": "Tuya List", "type": "main", "index": 0}]]},
        "Tuya List": {"main": [[{"node": "Command Prep", "type": "main", "index": 0}]]},
    },
    "settings": {"executionOrder": "v1", "timezone": "Asia/Bangkok"},
    "meta": {"instanceId": ""},
}
json.dump(w, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
for name, code in (("PREPARE", PREPARE), ("TOKEN_SIGN", TOKEN_SIGN), ("LIST_PREP", LIST_PREP), ("CMD_PREP", CMD_PREP)):
    stub = "const $=(x)=>({first:()=>({json:{}}),all:()=>[]});const $input={first:()=>({json:{}}),all:()=>[]};\n(async function(){" + code + "\n})();"
    f = os.path.join(tempfile.gettempdir(), "chk_" + name + ".js"); open(f, "w", encoding="utf-8").write(stub)
    r = subprocess.run(["node", "--check", f], capture_output=True, text=True, encoding="utf-8", errors="replace")
    print(name, "=>", "OK" if r.returncode == 0 else r.stderr[-400:])
print("written", OUT)
