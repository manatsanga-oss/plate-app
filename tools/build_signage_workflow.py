# สร้าง n8n workflow "Signage API" (webhook signage-api) + DDL — จอประชาสัมพันธ์หน้าร้าน (user 2026-10-28)
# โครง Webhook → Build SQL → PG → Shape → Respond (ลอกจาก Vehicle_Price_Override_API_Workflow.json)
# output: C:\Users\manat\OneDrive\New folder\Signage_API_Workflow.json + Signage_DDL.sql
import json, os, subprocess, tempfile
D = r"C:\Users\manat\OneDrive\New folder"
TEMPLATE = os.path.join(D, "Vehicle_Price_Override_API_Workflow.json")
OUT = os.path.join(D, "Signage_API_Workflow.json")

DDL_SQL = """CREATE TABLE IF NOT EXISTS signage_items (
  id SERIAL PRIMARY KEY,
  branch_code TEXT NOT NULL DEFAULT 'SCY06',
  kind TEXT NOT NULL,                 -- image | video | vehicle | text | queue | line
  title TEXT,
  image_base64 TEXT,                  -- รูปสไลด์ (JPEG ย่อแล้ว ไม่มี prefix) / วิดีโอ MP4 สั้น (kind=video, ดู media_mime)
  media_mime TEXT,                    -- NULL=image/jpeg · video/mp4 · video/webm (ไฟล์ใน image_base64)
  color_id INT,                       -- vehicle: master color (moto_color_images / ราคา type_id)
  series_name TEXT, brand_name TEXT,
  payload JSONB,                      -- vehicle: promo/note/type_name · text: text · line: line_id · video: url (ลิงก์ภายนอกแทนไฟล์)
  duration_sec INT NOT NULL DEFAULT 10,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE, end_date DATE,
  screen TEXT NOT NULL DEFAULT 'all',   -- all | 1 | 2 (ร้านมีจอ 2 ขนาด เลือกสไลด์แยกจอได้)
  zone INT NOT NULL DEFAULT 1,         -- ส่วนของจอที่แบ่ง 3 (?split=3): 1 บน 40% / 2 กลาง 35% / 3 ล่าง 25%
  created_by TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE signage_items ADD COLUMN IF NOT EXISTS screen TEXT NOT NULL DEFAULT 'all';
ALTER TABLE signage_items ADD COLUMN IF NOT EXISTS zone INT NOT NULL DEFAULT 1;
ALTER TABLE signage_items ADD COLUMN IF NOT EXISTS media_mime TEXT;"""

BUILD = r"""// signage-api: สไลด์จอประชาสัมพันธ์หน้าร้าน (signage_items) — user 2026-10-28
// list_items (ไม่ส่งรูป) · get_image · save_item (insert/update) · delete_item · reorder — เส้นตรง Webhook→Code→PG→Shape→Respond
const b = $input.first().json.body || {};
const action = String(b.action || '').trim();
const esc = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const sTxt = (v) => (v == null || String(v).trim() === '') ? 'NULL' : `'${esc(v)}'`;
const sNum = (v) => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) && String(v ?? '').trim() !== '' ? String(n) : 'NULL'; };
const sBool = (v) => (v === true || v === 'true' || v === 1 || v === '1') ? 'true' : 'false';
const sJson = (v) => (v && typeof v === 'object') ? `'${esc(JSON.stringify(v))}'::jsonb` : (typeof v === 'string' && v.trim() ? `'${esc(v)}'::jsonb` : 'NULL');
const DDL = `__DDL__`;
const COLS = "id, branch_code, kind, title, color_id, series_name, brand_name, payload, duration_sec, sort_order, active, start_date, end_date, screen, zone, media_mime, created_by, created_at, updated_at, (image_base64 IS NOT NULL) AS has_image, COALESCE(length(image_base64), 0) AS media_len";
const sMime = (v) => { const t = String(v || '').trim().toLowerCase(); return ['video/mp4', 'video/webm'].includes(t) ? t : null; };
const sZone = (v) => { const n = parseInt(v); return [1, 2, 3].includes(n) ? n : 1; };
const sScreen = (v) => { const t = String(v == null ? 'all' : v).trim(); return ['1', '2', '3', '4'].includes(t) ? t : 'all'; };

if (action === 'list_items') {
  const wh = ["1=1"];
  if (b.branch_code) wh.push(`branch_code = '${esc(String(b.branch_code).toUpperCase().slice(0, 5))}'`);
  if (b.for_display) wh.push("active AND (start_date IS NULL OR start_date <= CURRENT_DATE) AND (end_date IS NULL OR end_date >= CURRENT_DATE)");
  if (b.screen) wh.push(`(screen = 'all' OR screen = '${sScreen(b.screen)}')`);   // จอที่เปิดอยู่: เอาสไลด์ของทุกจอ + ของจอนั้น
  return [{ json: { query: `${DDL}
SELECT COALESCE(json_agg(row_to_json(q) ORDER BY q.sort_order, q.id), '[]'::json)::text AS listjson FROM (
  SELECT ${COLS} FROM signage_items WHERE ${wh.join(' AND ')} LIMIT 500
) q;` } }];
}

if (action === 'get_image') {
  const id = Number(b.id) || 0;
  if (!id) return [{ json: { query: "SELECT 'missing id' AS __error" } }];
  return [{ json: { query: `${DDL}
SELECT id, image_base64 FROM signage_items WHERE id = ${id};` } }];
}

if (action === 'save_item') {
  const id = Number(b.id) || 0;
  let img = (typeof b.image_base64 === 'string' && b.image_base64.length > 100) ? b.image_base64.replace(/^data:[^,]+,/, '').replace(/[\r\n]/g, '') : null;
  if (img && !/^[A-Za-z0-9+/=]+$/.test(img)) img = null;
  if (id) {   // แก้เฉพาะฟิลด์ที่ส่งมา
    const sets = [];
    if ('title' in b) sets.push(`title = ${sTxt(b.title)}`);
    if ('duration_sec' in b) sets.push(`duration_sec = ${sNum(b.duration_sec) === 'NULL' ? 10 : Math.max(3, Number(b.duration_sec))}`);
    if ('active' in b) sets.push(`active = ${sBool(b.active)}`);
    if ('start_date' in b) sets.push(`start_date = ${sTxt(b.start_date)}`);
    if ('end_date' in b) sets.push(`end_date = ${sTxt(b.end_date)}`);
    if ('payload' in b) sets.push(`payload = ${sJson(b.payload)}`);
    if ('color_id' in b) sets.push(`color_id = ${sNum(b.color_id)}`);
    if ('series_name' in b) sets.push(`series_name = ${sTxt(b.series_name)}`);
    if ('brand_name' in b) sets.push(`brand_name = ${sTxt(b.brand_name)}`);
    if ('screen' in b) sets.push(`screen = '${sScreen(b.screen)}'`);
    if ('zone' in b) sets.push(`zone = ${sZone(b.zone)}`);
    if (img) { sets.push(`image_base64 = '${img}'`); sets.push(`media_mime = ${sMime(b.media_mime) ? `'${sMime(b.media_mime)}'` : 'NULL'}`); }
    if (!sets.length) return [{ json: { query: "SELECT 'nothing to update' AS __error" } }];
    sets.push('updated_at = now()');
    return [{ json: { query: `${DDL}
UPDATE signage_items SET ${sets.join(', ')} WHERE id = ${id} RETURNING ${COLS};` } }];
  }
  const kind = String(b.kind || '').trim();
  if (!['image', 'video', 'vehicle', 'text', 'queue', 'line'].includes(kind)) return [{ json: { query: "SELECT 'bad kind' AS __error" } }];
  if (kind === 'image' && !img) return [{ json: { query: "SELECT 'missing image' AS __error" } }];
  const vurl = (b.payload && typeof b.payload === 'object') ? String(b.payload.url || '').trim() : '';
  if (kind === 'video' && !img && !/^https?:\/\//i.test(vurl)) return [{ json: { query: "SELECT 'missing video' AS __error" } }];
  const mime = kind === 'video' && img ? (sMime(b.media_mime) || 'video/mp4') : null;
  const br = String(b.branch_code || 'SCY06').toUpperCase().slice(0, 5);
  return [{ json: { query: `${DDL}
INSERT INTO signage_items (branch_code, kind, title, image_base64, media_mime, color_id, series_name, brand_name, payload, duration_sec, sort_order, active, start_date, end_date, screen, zone, created_by)
VALUES ('${esc(br)}', '${esc(kind)}', ${sTxt(b.title)}, ${img ? `'${img}'` : 'NULL'}, ${mime ? `'${mime}'` : 'NULL'}, ${sNum(b.color_id)}, ${sTxt(b.series_name)}, ${sTxt(b.brand_name)}, ${sJson(b.payload)},
  ${Math.max(3, Number(b.duration_sec) || 10)}, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM signage_items WHERE branch_code = '${esc(br)}'), true, ${sTxt(b.start_date)}, ${sTxt(b.end_date)}, '${sScreen(b.screen)}', ${sZone(b.zone)}, ${sTxt(b.created_by)})
RETURNING ${COLS};` } }];
}

if (action === 'delete_item') {
  const id = Number(b.id) || 0;
  if (!id) return [{ json: { query: "SELECT 'missing id' AS __error" } }];
  return [{ json: { query: `${DDL}
DELETE FROM signage_items WHERE id = ${id} RETURNING id;` } }];
}

if (action === 'reorder') {
  const ids = Array.isArray(b.ids) ? b.ids.map((x) => Number(x) || 0).filter(Boolean) : [];
  if (!ids.length) return [{ json: { query: "SELECT 'missing ids' AS __error" } }];
  const vals = ids.map((id, i) => `(${id}, ${i + 1})`).join(', ');
  return [{ json: { query: `${DDL}
UPDATE signage_items s SET sort_order = v.ord, updated_at = now() FROM (VALUES ${vals}) AS v(id, ord) WHERE s.id = v.id RETURNING s.id, s.sort_order;` } }];
}

return [{ json: { query: "SELECT 'unknown action' AS __error" } }];
""".replace("__DDL__", DDL_SQL)

w = json.load(open(TEMPLATE, encoding="utf-8"))
w["name"] = "Signage API"
for k in ("id", "versionId", "pinData", "staticData", "tags"):
    w.pop(k, None)
w["meta"] = {"instanceId": ""}
for n in w["nodes"]:
    if n["type"] == "n8n-nodes-base.webhook":
        n["parameters"]["path"] = "signage-api"
        n["webhookId"] = "signage-api"
        n["parameters"]["options"] = {"allowedOrigins": "*"}
    if n["name"] == "Build SQL":
        n["parameters"]["jsCode"] = BUILD
    n["id"] = "sg" + n["id"][2:] if len(n["id"]) > 2 else "sg_" + n["id"]
    if n["type"] == "n8n-nodes-base.postgres":
        n["credentials"] = {}

# ---- webhook รูป: GET /webhook/signage-image?id=N → JPEG binary (ให้ <img src> บนจอป้ายโหลดตรง ไม่ฝัง base64 ในหน้า) ----
GETIMG = r"""// เสิร์ฟรูปสไลด์ให้จอป้าย (GET ?id=N) — WebView ของป้าย Android ล่มเมื่อฝัง base64 ใหญ่ในหน้า จึงให้โหลดเป็น JPEG ปกติ
const q = $input.first().json.query || {};
let id = parseInt(q.id);
if (!Number.isFinite(id) || id < 1) id = 0;
return [{ json: { query: "SELECT image_base64, media_mime FROM signage_items WHERE id = " + id + " LIMIT 1" } }];
"""
TOBIN = r"""// แปลง base64 เป็น JPEG binary (ต้องใช้ prepareBinaryData ไม่งั้นได้ 0 bytes)
const row = $input.first().json || {};
let b64 = String(row.image_base64 || '').replace(/^data:[^,]+,/, '');
let mime = 'image/jpeg', fname = 'slide.jpg';
if (row.media_mime === 'video/mp4') { mime = 'video/mp4'; fname = 'slide.mp4'; }
else if (row.media_mime === 'video/webm') { mime = 'video/webm'; fname = 'slide.webm'; }
if (!b64) { b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; mime = 'image/png'; fname = 'blank.png'; }
const buffer = Buffer.from(b64, 'base64');
const binaryData = await this.helpers.prepareBinaryData(buffer, fname, mime);
return [{ json: { mime }, binary: { data: binaryData } }];
"""
pg_tpl = next(n for n in w["nodes"] if n["type"] == "n8n-nodes-base.postgres")
w["nodes"] += [
    {"parameters": {"httpMethod": "GET", "path": "signage-image", "responseMode": "responseNode", "options": {}},
     "id": "sgimg01", "name": "Webhook Image", "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [200, 560], "webhookId": "signage-image"},
    {"parameters": {"jsCode": GETIMG}, "id": "sgimg02", "name": "Build get_image SQL", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [420, 560]},
    {"parameters": {"operation": "executeQuery", "query": "={{ $json.query }}", "options": {}}, "id": "sgimg03", "name": "PG Image", "type": "n8n-nodes-base.postgres", "typeVersion": pg_tpl["typeVersion"], "position": [640, 560], "credentials": {}},
    {"parameters": {"jsCode": TOBIN}, "id": "sgimg04", "name": "Image To Binary", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [860, 560]},
    {"parameters": {"respondWith": "binary", "options": {"responseHeaders": {"entries": [{"name": "Content-Type", "value": "={{ $json.mime || 'image/jpeg' }}"}, {"name": "Accept-Ranges", "value": "none"}, {"name": "Cache-Control", "value": "public, max-age=300"}, {"name": "Access-Control-Allow-Origin", "value": "*"}]}}},
     "id": "sgimg05", "name": "Respond Image", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5, "position": [1080, 560]},
]
w["connections"].update({
    "Webhook Image": {"main": [[{"node": "Build get_image SQL", "type": "main", "index": 0}]]},
    "Build get_image SQL": {"main": [[{"node": "PG Image", "type": "main", "index": 0}]]},
    "PG Image": {"main": [[{"node": "Image To Binary", "type": "main", "index": 0}]]},
    "Image To Binary": {"main": [[{"node": "Respond Image", "type": "main", "index": 0}]]},
})
json.dump(w, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(os.path.join(D, "Signage_DDL.sql"), "w", encoding="utf-8").write("-- จอประชาสัมพันธ์หน้าร้าน (signage-api) — workflow รัน CREATE TABLE IF NOT EXISTS เองทุกครั้ง\n" + DDL_SQL + "\n")
stub = "const $=(x)=>({first:()=>({json:{body:{}}}),all:()=>[]});const $input={first:()=>({json:{body:{}}}),all:()=>[]};\n(async()=>{" + BUILD + "\n})();"
f = os.path.join(tempfile.gettempdir(), "chk.js"); open(f, "w", encoding="utf-8").write(stub)
r = subprocess.run(["node", "--check", f], capture_output=True, text=True, encoding="utf-8", errors="replace")
print("Build SQL =>", "OK" if r.returncode == 0 else r.stderr[-400:])
print("written", OUT)
