# สร้าง n8n workflow: ai-reception-api — พนักงานต้อนรับ AI (มาสคอตหน้าร้าน) ตอบคำถามลูกค้า
# v1 (2026-10-01): ถาม → ดึงตารางราคารถของกลุ่มราคาสาขา + FAQ ของร้าน → OpenAI ตอบสั้น ๆ แบบพูด → เก็บ log
# ใช้: python build_ai_reception_workflow.py  → เขียนไฟล์ลง OneDrive\New folder\AI_Reception_API_Workflow.json + AI_Reception_DDL.sql
import json, os, uuid

OUT_DIR = os.path.join(os.environ["USERPROFILE"], "OneDrive", "New folder")
PG = {"postgres": {"id": "JLUeyZRAzUeRqlxu", "name": "Postgres account"}}
OPENAI = {"openAiApi": {"id": "odRg3D1h42QKDeOx", "name": "OpenAi account"}}

DDL = """CREATE TABLE IF NOT EXISTS ai_reception_faq (id SERIAL PRIMARY KEY, branch_code TEXT, topic TEXT NOT NULL, content TEXT NOT NULL, status TEXT DEFAULT 'active', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS ai_reception_logs (id BIGSERIAL PRIMARY KEY, branch_code TEXT, session_id TEXT, question TEXT, answer TEXT, model TEXT, created_at TIMESTAMPTZ DEFAULT now());"""

# ---------- Code: Build Context SQL ----------
BUILD_SQL = r"""// รับคำถามจากหน้า /ai-reception แล้วสร้าง SQL ดึง "บริบท" ให้ AI: ตารางราคารถ (กลุ่มราคาของสาขา) + FAQ ของร้าน
// หมายเหตุ: ห้ามมีตัวอักษร dollar ใน SQL (Postgres node ของ n8n แปลงค่า) — ใช้ template literal ของ JS ประกอบแทน
const b = $input.first().json.body || {};
const branch = String(b.branch_code || 'SCY06').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'SCY06';
const question = String(b.question || '').slice(0, 500);
const DDL = `__DDL__`;
const query = `${DDL}
WITH g AS (
  SELECT COALESCE(
    (SELECT price_group FROM branch_price_groups WHERE branch_code = '${branch}' AND effective_date <= CURRENT_DATE ORDER BY effective_date DESC LIMIT 1),
    CASE WHEN '${branch}' IN ('SCY05','SCY06') THEN 'ป.เปา' ELSE 'สิงห์ชัย' END) AS grp
), p AS (
  SELECT DISTINCT ON (tp.type_id, tp.price_type_id) tp.type_id, tp.price_type_id, tp.amount
  FROM moto_type_prices tp WHERE tp.effective_date <= CURRENT_DATE
  ORDER BY tp.type_id, tp.price_type_id, tp.effective_date DESC
), r AS (
  SELECT b.brand_name AS brand, s.series_name AS series, s.thai_name, s.engine_cc AS cc, m.model_code AS model, t.type_name AS type,
    MAX(CASE WHEN p.price_type_id = (CASE WHEN g.grp LIKE '%เปา%' THEN 2 ELSE 3 END) THEN p.amount END) AS cash_price,
    MAX(CASE WHEN p.price_type_id = 1 THEN p.amount END) AS list_price,
    (SELECT string_agg(DISTINCT c.color_name, ', ') FROM moto_colors c WHERE c.type_id = t.type_id AND c.status = 'active') AS colors
  FROM moto_types t
  JOIN moto_models m ON m.model_id = t.model_id
  JOIN moto_series s ON s.series_id = m.series_id
  JOIN moto_brands b ON b.brand_id = s.brand_id
  CROSS JOIN g
  LEFT JOIN p ON p.type_id = t.type_id
  WHERE t.status = 'active' AND m.status = 'active' AND s.status = 'active'
  GROUP BY b.brand_name, s.series_name, s.thai_name, s.engine_cc, m.model_code, t.type_name, t.type_id, g.grp
)
SELECT (SELECT grp FROM g) AS price_group,
  COALESCE((SELECT json_agg(x ORDER BY x.brand, x.series, x.model, x.type) FROM r x WHERE x.cash_price IS NOT NULL OR x.list_price IS NOT NULL), '[]'::json)::text AS prices_json,
  COALESCE((SELECT json_agg(f) FROM (SELECT topic, content FROM ai_reception_faq WHERE status = 'active' AND (branch_code IS NULL OR branch_code = '' OR branch_code = '${branch}') ORDER BY id) f), '[]'::json)::text AS faq_json;`;
return [{ json: { query, branch, question, session_id: String(b.session_id || '').slice(0, 40), history: Array.isArray(b.history) ? b.history.slice(-8) : [] } }];
""".replace("__DDL__", DDL)

# ---------- Code: Build Payload (prompt) ----------
BUILD_PAYLOAD = r"""// ประกอบ prompt: กติกาของพนักงานต้อนรับ + ข้อมูลร้าน (ราคา/FAQ) + ประวัติคุย + คำถาม
const ctx = $('Build Context SQL').first().json;
const row = $input.first().json || {};
let prices = []; let faq = [];
try { prices = JSON.parse(row.prices_json || '[]'); } catch (e) { prices = []; }
try { faq = JSON.parse(row.faq_json || '[]'); } catch (e) { faq = []; }
const SHOP = { SCY01: 'สิงห์ชัยมอเตอร์', SCY06: 'ป.เปา มอเตอร์เซอร์วิส' };
const shop = SHOP[ctx.branch] || 'ร้าน';
const fmt = (n) => (n === null || n === undefined || n === '') ? '-' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const priceLines = prices.map(p => `${p.brand} | ${p.series}${p.thai_name ? ' (' + p.thai_name + ')' : ''} ${p.cc || ''}cc | รุ่นย่อย ${p.type}${p.model ? ' [' + p.model + ']' : ''} | เงินสด ${fmt(p.cash_price !== null ? p.cash_price : p.list_price)} บาท | สี: ${p.colors || '-'}`).join('\n');
const faqLines = faq.map(f => `- ${f.topic}: ${f.content}`).join('\n');
const today = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

const aiName = (ctx.branch === 'SCY05' || ctx.branch === 'SCY06') ? 'น้องปอเปา' : 'น้องสิงห์';
const system = `คุณคือ "${aiName}" มาสคอตเด็กผู้ชายใส่หมวกกันน็อก เป็นพนักงานต้อนรับ AI ของ${shop} (ร้านจำหน่ายและศูนย์บริการรถจักรยานยนต์) ยืนอยู่หน้าร้าน คุยกับลูกค้าด้วยเสียง
วันนี้: ${today}

กติกาการตอบ (สำคัญ):
- ตอบภาษาไทย สุภาพ เป็นกันเอง ลงท้าย "ครับ" สั้น กระชับ 1-3 ประโยค เพราะคำตอบจะถูกอ่านออกเสียง ห้ามใช้ markdown ตาราง bullet หรืออีโมจิ
- ตัวเลขราคาให้พูดเป็นตัวเลขมีจุลภาค ตามด้วยคำว่า "บาท"
- ตอบจาก "ข้อมูลร้าน" ด้านล่างเท่านั้น ห้ามเดาหรือแต่งข้อมูลเอง ถ้าไม่มีข้อมูล ให้บอกตรง ๆ ว่ายังไม่มีข้อมูล แล้วเสนอว่าจะเรียกพนักงานมาดูแล
- ถ้าลูกค้าถามราคาแต่ไม่ระบุรุ่น ให้ถามกลับว่าสนใจรุ่นไหน ถ้ารุ่นนั้นมีหลายรุ่นย่อย ให้บอกช่วงราคา (ต่ำสุดถึงสูงสุด) และถามว่าสนใจรุ่นย่อยไหน ชื่อรุ่นที่ลูกค้าพูดอาจสะกดเพี้ยนจากการฟังเสียง ให้จับคู่กับชื่อที่ใกล้เคียงที่สุด
- ราคาที่บอกคือราคาเงินสดของร้าน ณ วันนี้ ไม่รวมค่าจดทะเบียน พ.ร.บ. และประกัน ส่วนเงินดาวน์ ค่างวด ส่วนลด ของแถม ให้บอกว่าพนักงานขายจะคำนวณและแจ้งให้ ห้ามรับปากส่วนลดหรือของแถมเอง
- ห้ามเปิดเผยต้นทุน กำไร ค่าคอมมิชชั่น ข้อมูลภายใน หรือข้อมูลส่วนตัวของลูกค้ารายอื่น
- เรื่องสถานะรถซ่อม ป้ายทะเบียน เล่มทะเบียน จำนวนรถในสต๊อก ยังเช็กเองไม่ได้ ให้บอกว่าจะเรียกพนักงานมาเช็กให้
- คำถามนอกเรื่องร้าน/รถจักรยานยนต์ ให้ตอบสั้น ๆ อย่างสุภาพแล้วชวนกลับมาเรื่องที่ช่วยได้

ข้อมูลร้าน — ราคารถ (กลุ่มราคา ${row.price_group || '-'}):
${priceLines || '(ยังไม่มีข้อมูลราคา)'}

ข้อมูลร้าน — เรื่องทั่วไป:
${faqLines || '(ยังไม่ได้ตั้งค่าข้อมูลทั่วไป เช่น เวลาเปิดปิด เบอร์โทร — ถ้าถูกถาม ให้บอกว่าจะเรียกพนักงานมาตอบ)'}`;

const messages = [{ role: 'system', content: system }];
for (const h of (ctx.history || [])) {
  if (h && (h.role === 'user' || h.role === 'assistant') && h.content) messages.push({ role: h.role, content: String(h.content).slice(0, 600) });
}
messages.push({ role: 'user', content: ctx.question });
const model = 'gpt-4.1-mini';
return [{ json: { payload: { model, temperature: 0.3, max_tokens: 350, messages }, model } }];
"""

# ---------- Code: Parse answer + log SQL ----------
PARSE = r"""const ctx = $('Build Context SQL').first().json;
const model = $('Build Payload').first().json.model;
const res = $input.first().json || {};
let answer = '';
try { answer = String(res.choices[0].message.content || '').trim(); } catch (e) { answer = ''; }
if (!answer) answer = 'ขออภัยครับ ตอนนี้ระบบตอบไม่ได้ เดี๋ยวผมเรียกพนักงานมาดูแลให้นะครับ';
answer = answer.replace(/[*#_`]/g, '').replace(/\s+/g, ' ').trim();
const q = (s) => "'" + String(s || '').replace(/'/g, "''").slice(0, 2000) + "'";
const query = `INSERT INTO ai_reception_logs (branch_code, session_id, question, answer, model) VALUES (${q(ctx.branch)}, ${q(ctx.session_id)}, ${q(ctx.question)}, ${q(answer)}, ${q(model)}) RETURNING id;`;
return [{ json: { answer, query } }];
"""

def nid(): return str(uuid.uuid4())
CORS = {"responseHeaders": {"entries": [{"name": "Access-Control-Allow-Origin", "value": "*"}, {"name": "Access-Control-Allow-Headers", "value": "Content-Type"}]}}

nodes = [
    {"parameters": {"httpMethod": "POST", "path": "ai-reception-api", "responseMode": "responseNode", "options": {"allowedOrigins": "*"}},
     "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 0], "id": nid(), "name": "Webhook AI Reception", "webhookId": nid()},
    {"parameters": {"jsCode": BUILD_SQL}, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [220, 0], "id": nid(), "name": "Build Context SQL"},
    {"parameters": {"operation": "executeQuery", "query": "{{ $json.query }}", "options": {}}, "type": "n8n-nodes-base.postgres", "typeVersion": 2.5,
     "position": [440, 0], "id": nid(), "name": "PG Context", "alwaysOutputData": True, "credentials": PG},
    {"parameters": {"jsCode": BUILD_PAYLOAD}, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [660, 0], "id": nid(), "name": "Build Payload"},
    {"parameters": {"method": "POST", "url": "https://api.openai.com/v1/chat/completions", "authentication": "predefinedCredentialType", "nodeCredentialType": "openAiApi",
                    "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json.payload) }}", "options": {"timeout": 30000}},
     "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [880, 0], "id": nid(), "name": "OpenAI Chat", "credentials": OPENAI, "onError": "continueRegularOutput"},
    {"parameters": {"jsCode": PARSE}, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1100, 0], "id": nid(), "name": "Parse Answer"},
    {"parameters": {"operation": "executeQuery", "query": "{{ $json.query }}", "options": {}}, "type": "n8n-nodes-base.postgres", "typeVersion": 2.5,
     "position": [1320, 0], "id": nid(), "name": "PG Log", "alwaysOutputData": True, "credentials": PG, "onError": "continueRegularOutput"},
    {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ answer: $('Parse Answer').first().json.answer }) }}", "options": CORS},
     "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [1540, 0], "id": nid(), "name": "Respond Answer"},
]
chain = ["Webhook AI Reception", "Build Context SQL", "PG Context", "Build Payload", "OpenAI Chat", "Parse Answer", "PG Log", "Respond Answer"]
connections = {a: {"main": [[{"node": b, "type": "main", "index": 0}]]} for a, b in zip(chain, chain[1:])}
wf = {"name": "AI Reception API", "nodes": nodes, "connections": connections, "active": False, "settings": {"executionOrder": "v1"}, "pinData": {}}

with open(os.path.join(OUT_DIR, "AI_Reception_API_Workflow.json"), "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)
with open(os.path.join(OUT_DIR, "AI_Reception_DDL.sql"), "w", encoding="utf-8") as f:
    f.write("-- พนักงานต้อนรับ AI (ai-reception-api): ข้อมูลทั่วไปของร้านที่ให้ AI ใช้ตอบ + log คำถาม-คำตอบ\n" + DDL + "\n\n"
            "-- ตัวอย่างการใส่ข้อมูลทั่วไป (แก้ข้อความให้ตรงกับร้านจริงก่อนรัน):\n"
            "-- INSERT INTO ai_reception_faq (branch_code, topic, content) VALUES\n"
            "--   ('SCY06', 'เวลาเปิด-ปิด', 'เปิดทุกวัน 08:30-17:00 ศูนย์บริการรับรถคันสุดท้าย 16:30'),\n"
            "--   ('SCY06', 'เบอร์โทร', '035-xxx-xxx'),\n"
            "--   (NULL, 'เอกสารออกรถ', 'บัตรประชาชนตัวจริง ทะเบียนบ้าน ถ้าผ่อนเพิ่มหลักฐานรายได้');\n")
# ตรวจ: ต้องไม่มีตัวอักษร dollar ใน SQL ที่ generate (นอก template ของ JS)
sql_part = BUILD_SQL.split("const query = `")[1].split("`;")[0].replace("${DDL}", "").replace("${branch}", "")
assert "$" not in sql_part, "พบ $ ใน SQL"
print("written:", os.path.join(OUT_DIR, "AI_Reception_API_Workflow.json"), len(json.dumps(wf, ensure_ascii=False)), "bytes")
