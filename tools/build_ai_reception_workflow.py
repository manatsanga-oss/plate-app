# สร้าง n8n workflow: ai-reception-api — พนักงานต้อนรับ AI (มาสคอตหน้าร้าน) ตอบคำถามลูกค้า
# v1 (2026-10-01): ถาม → ดึงตารางราคารถของกลุ่มราคาสาขา + FAQ ของร้าน → OpenAI ตอบสั้น ๆ แบบพูด → เก็บ log
# v2 (2026-10-01): ตอบเป็น JSON {answer, show:[type_id]} → ส่ง items (รุ่นย่อย+ราคา+color_id ที่มีรูป) ให้หน้าเว็บโชว์ภาพรุ่นย่อย
# v3 (2026-10-02): action sim_next — น้องเปาเปาสวมบท "ลูกค้า" ถามพนักงานขาย (แนวคำถามจากข้อความลูกค้าจริง AI_Reception_Customer_Samples.json) แล้วเก็บคำตอบพนักงานลง ai_reception_sim_logs
# ใช้: python build_ai_reception_workflow.py  → เขียนไฟล์ลง OneDrive\New folder\AI_Reception_API_Workflow.json + AI_Reception_DDL.sql
import json, os, uuid

OUT_DIR = os.path.join(os.environ["USERPROFILE"], "OneDrive", "New folder")
PG = {"postgres": {"id": "JLUeyZRAzUeRqlxu", "name": "Postgres account"}}
OPENAI = {"openAiApi": {"id": "odRg3D1h42QKDeOx", "name": "OpenAi account"}}

DDL = """CREATE TABLE IF NOT EXISTS ai_reception_faq (id SERIAL PRIMARY KEY, branch_code TEXT, topic TEXT NOT NULL, content TEXT NOT NULL, status TEXT DEFAULT 'active', updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS ai_reception_logs (id BIGSERIAL PRIMARY KEY, branch_code TEXT, session_id TEXT, question TEXT, answer TEXT, model TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS ai_reception_sim_logs (id BIGSERIAL PRIMARY KEY, branch_code TEXT, session_id TEXT, staff_name TEXT, scenario TEXT, turn_no INT, customer_question TEXT, staff_answer TEXT, answer_source TEXT, created_at TIMESTAMPTZ DEFAULT now());"""

# ตัวอย่างคำถามลูกค้าจริง แยกหัวข้อ (สร้างด้วย tools/extract_ai_customer_samples.py — เก็บนอก repo)
SAMPLES_PATH = os.path.join(OUT_DIR, "AI_Reception_Customer_Samples.json")
SAMPLES = json.load(open(SAMPLES_PATH, encoding="utf-8")) if os.path.exists(SAMPLES_PATH) else {}

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
  SELECT t.type_id, (SELECT c.color_id FROM moto_colors c JOIN moto_color_images i ON i.color_id = c.color_id WHERE c.type_id = t.type_id AND c.status = 'active' ORDER BY c.color_id LIMIT 1) AS img_color_id,
    b.brand_name AS brand, s.series_name AS series, s.thai_name, s.engine_cc AS cc, m.model_code AS model, t.type_name AS type,
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
const action = String(b.action || 'ask');
return [{ json: { query, action, branch, question, session_id: String(b.session_id || '').slice(0, 40), history: Array.isArray(b.history) ? b.history.slice(action === 'sim_next' ? -20 : -8) : [],
  staff_name: String(b.staff_name || '').slice(0, 80), scenario: String(b.scenario || '').slice(0, 600),
  last_question: String(b.last_question || '').slice(0, 1000), staff_answer: String(b.staff_answer || '').slice(0, 3000), answer_source: String(b.answer_source || '').slice(0, 10) } }];
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
const priceLines = prices.map(p => `#${p.type_id} | ${p.brand} | ${p.series}${p.thai_name ? ' (' + p.thai_name + ')' : ''} ${p.cc || ''}cc | รุ่นย่อย ${p.type}${p.model ? ' [' + p.model + ']' : ''} | เงินสด ${fmt(p.cash_price !== null ? p.cash_price : p.list_price)} บาท | สี: ${p.colors || '-'}`).join('\n');
const faqLines = faq.map(f => `- ${f.topic}: ${f.content}`).join('\n');
const today = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

const aiName = (ctx.branch === 'SCY05' || ctx.branch === 'SCY06') ? 'น้องเปาเปา' : 'น้องสิงห์';

// ---------- โหมดลูกค้าจำลอง (sim_next): AI เป็น "ลูกค้า" ถามพนักงานขาย ทีละคำถาม ----------
if (ctx.action === 'sim_next') {
  const SAMPLES = __SAMPLES__;
  const NL = String.fromCharCode(10);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
  let scenario = ctx.scenario;
  if (!scenario) {
    const topics = Object.keys(SAMPLES);
    const topic = topics.length ? pick(topics) : 'ราคา';
    const seriesList = [...new Set(prices.map(p => `${p.brand} ${p.series}${p.thai_name ? ' (' + p.thai_name + ')' : ''}`))];
    const bike = seriesList.length ? pick(seriesList) : 'รถจักรยานยนต์';
    const persona = pick(['พนักงานโรงงาน เงินเดือนประมาณ 12,000 บาท มีสลิปเงินเดือน', 'อาชีพอิสระ ขายของ ไม่มีสลิปเงินเดือน', 'คนงานก่อสร้าง รายได้ประมาณ 15,000 บาท', 'อายุ 18 ปี เพิ่งเริ่มทำงาน จะให้พ่อแม่ช่วยค้ำ', 'ผู้ปกครองจะออกรถให้ลูกไปเรียน', 'พนักงานบริษัท เครดิตดี อยากซื้อเงินสด', 'เคยมีประวัติค้างชำระ ไม่แน่ใจว่าเครดิตผ่านไหม', 'ลูกค้าเก่าที่เคยออกรถกับร้านนี้', 'มีเงินดาวน์น้อย ประมาณ 3,000 บาท', 'งบจำกัด อยากได้ค่างวดไม่เกิน 2,500 บาทต่อเดือน']);
    scenario = `หัวข้อหลักที่อยากรู้: ${topic} | รถที่สนใจ: ${bike} | ลักษณะลูกค้า: ${persona}`;
  }
  const topicKey = Object.keys(SAMPLES).find(k => scenario.includes('หัวข้อหลักที่อยากรู้: ' + k + ' |')) || '';
  const main = shuffle(SAMPLES[topicKey] || []).slice(0, 14);
  const others = shuffle(Object.keys(SAMPLES).filter(k => k !== topicKey).flatMap(k => shuffle(SAMPLES[k]).slice(0, 2))).slice(0, 14);
  const turn = (ctx.history || []).filter(h => h && h.role === 'customer').length;
  const simSystem = `นี่คือแบบฝึกหัดของร้าน${shop} (ร้านจำหน่ายและศูนย์บริการรถจักรยานยนต์) คุณสวมบทเป็น "ลูกค้า" ที่เดินเข้ามาในร้าน คุยด้วยเสียงกับ "พนักงานขาย" ของร้าน (ข้อความฝั่ง user คือคำตอบของพนักงาน) เป้าหมายคือให้พนักงานได้ตอบคำถามแบบที่ลูกค้าจริงถาม เพื่อเก็บคำตอบของพนักงานไว้
สถานการณ์ของคุณ: ${scenario}

กติกา (สำคัญ):
- พูดเป็นลูกค้าเท่านั้น ถามครั้งละ 1 คำถาม สั้น ๆ แบบภาษาพูด 1-2 ประโยค ลงท้าย "ครับ" ห้ามใช้ markdown หรืออีโมจิ
- ใช้แนวคำถามและสำนวนแบบลูกค้าจริงตามตัวอย่างด้านล่าง (ปรับให้เข้ากับสถานการณ์ของคุณ ไม่ต้องลอกทั้งประโยค) ห้ามเอ่ยชื่อบุคคล เบอร์โทร หรือเลขทะเบียนที่อยู่ในตัวอย่าง
- ประโยคแรกของการสนทนา: ทักทายและแนะนำตัวว่าเป็นลูกค้าสั้น ๆ ตามลักษณะลูกค้าในสถานการณ์ (เช่น "สวัสดีครับ ผมเป็นลูกค้าครับ ทำงานโรงงานแถวนี้ สนใจ...") แล้วถามคำถามแรกต่อเลยในคราวเดียว ครั้งต่อ ๆ ไปไม่ต้องแนะนำตัวซ้ำ
- เริ่มจากหัวข้อหลัก แล้วถามต่อยอดจากคำตอบของพนักงาน ถ้าพนักงานตอบไม่ชัด ไม่ครบ หรือเลี่ยง ให้ถามซ้ำให้ชัดขึ้นแบบลูกค้าที่อยากรู้จริง แล้วค่อยขยับไปเรื่องใกล้เคียงที่ลูกค้ามักถามต่อ เช่น เงินดาวน์ ค่างวด เอกสาร ของแถม สี มีรถพร้อมส่งไหม วันรับรถ ป้ายทะเบียน
- ถ้าพนักงานถามกลับ (เช่น อาชีพ รายได้ งบประมาณ) ให้ตอบสั้น ๆ ตามลักษณะลูกค้าในสถานการณ์ แล้วถามคำถามถัดไปในประโยคเดียวกัน
- ห้ามตอบคำถามแทนพนักงาน ห้ามให้ข้อมูลร้าน ห้ามสอน ชม ติ หรือให้คะแนนพนักงาน ห้ามออกนอกบทลูกค้า
- ตอนนี้ถามไปแล้ว ${turn} คำถาม: เมื่อถามครบประมาณ 5-6 คำถาม หรือได้ข้อมูลพอแล้ว ให้กล่าวขอบคุณปิดการสนทนาแบบลูกค้า (เช่น ขอกลับไปคิดดูก่อน หรือเดี๋ยวเข้ามาใหม่) แล้วตั้ง done เป็น true${turn >= 7 ? ' — ครั้งนี้ต้องปิดการสนทนาเลย' : ''}
- ตอบกลับเป็น JSON เท่านั้น รูปแบบ {"say": "ประโยคที่ลูกค้าพูด", "done": false}

ตัวอย่างคำถามจากลูกค้าจริง — หัวข้อหลัก (${topicKey || '-'}):
${main.map(m => '- ' + m).join(NL) || '-'}

ตัวอย่างคำถามจากลูกค้าจริง — เรื่องอื่นที่มักถามต่อ:
${others.map(m => '- ' + m).join(NL) || '-'}`;
  const msgs = [{ role: 'system', content: simSystem }, { role: 'user', content: 'สวัสดีครับ ยินดีต้อนรับครับ สนใจรถรุ่นไหน สอบถามได้เลยครับ' }];
  for (const h of (ctx.history || [])) {
    if (!h || !h.content) continue;
    if (h.role === 'customer') msgs.push({ role: 'assistant', content: JSON.stringify({ say: String(h.content).slice(0, 600), done: false }) });
    else if (h.role === 'staff') msgs.push({ role: 'user', content: String(h.content).slice(0, 2000) });
  }
  const simModel = 'gpt-4.1-mini';
  return [{ json: { payload: { model: simModel, temperature: 0.9, max_tokens: 250, response_format: { type: 'json_object' }, messages: msgs }, model: simModel, scenario, turn } }];
}
const system = `คุณคือ "${aiName}" มาสคอตเด็กผู้ชายใส่หมวกกันน็อก เป็นพนักงานต้อนรับ AI ของ${shop} (ร้านจำหน่ายและศูนย์บริการรถจักรยานยนต์) ยืนอยู่หน้าร้าน คุยกับลูกค้าด้วยเสียง
วันนี้: ${today}

กติกาการตอบ (สำคัญ):
- ตอบกลับเป็น JSON เท่านั้น รูปแบบ {"answer": "ข้อความที่จะพูด", "show": [เลข # ของรุ่นย่อยที่ควรโชว์ภาพ]}
- show: เมื่อคำตอบพูดถึงรุ่นรถรุ่นใดรุ่นหนึ่ง ให้ใส่เลข # ของรุ่นย่อยทุกตัวของรุ่นนั้นที่กำลังพูดถึง (ไม่เกิน 8 ตัว เรียงราคาน้อยไปมาก) เพื่อให้จอแสดงภาพรุ่นย่อยให้ลูกค้าเลือก ถ้าลูกค้าเจาะจงรุ่นย่อยแล้วให้ใส่เฉพาะตัวนั้น ถ้าไม่ได้พูดถึงรุ่นรถให้ใส่ [] ห้ามพูดเลข # ใน answer
- answer: ตอบภาษาไทย สุภาพ เป็นกันเอง ลงท้าย "ครับ" สั้น กระชับ 1-3 ประโยค เพราะคำตอบจะถูกอ่านออกเสียง ห้ามใช้ markdown ตาราง bullet หรืออีโมจิ
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
return [{ json: { payload: { model, temperature: 0.3, max_tokens: 450, response_format: { type: 'json_object' }, messages }, model } }];
"""

# ---------- Code: Parse answer + log SQL ----------
PARSE = r"""const ctx = $('Build Context SQL').first().json;
const model = $('Build Payload').first().json.model;
const res = $input.first().json || {};
const q = (s) => "'" + String(s || '').split(String.fromCharCode(36)).join('').replace(/'/g, "''").slice(0, 3000) + "'";

// ---------- โหมดลูกค้าจำลอง: คืนคำถามถัดไป + บันทึกคำตอบพนักงานของคำถามก่อนหน้า ----------
if (ctx.action === 'sim_next') {
  const bp = $('Build Payload').first().json;
  let say = ''; let done = false;
  try { const j = JSON.parse(String(res.choices[0].message.content || '').trim()); say = String(j.say || '').trim(); done = j.done === true || j.done === 'true'; } catch (e) { say = ''; }
  say = say.replace(/[*#_`]/g, '').split(' ').filter(Boolean).join(' ');
  const error = !say;
  if (bp.turn >= 8) done = true;
  const query = ctx.staff_answer
    ? `INSERT INTO ai_reception_sim_logs (branch_code, session_id, staff_name, scenario, turn_no, customer_question, staff_answer, answer_source) VALUES (${q(ctx.branch)}, ${q(ctx.session_id)}, ${q(ctx.staff_name)}, ${q(bp.scenario)}, ${Math.max(1, Math.floor(bp.turn))}, ${q(ctx.last_question)}, ${q(ctx.staff_answer)}, ${q(ctx.answer_source)}) RETURNING id;`
    : 'SELECT 1 AS id;';
  return [{ json: { out: { say, done, scenario: bp.scenario, error }, query } }];
}
let answer = ''; let show = [];
try {
  const raw = String(res.choices[0].message.content || '').trim();
  try { const j = JSON.parse(raw); answer = String(j.answer || '').trim(); show = Array.isArray(j.show) ? j.show : []; } catch (e) { answer = raw; }
} catch (e) { answer = ''; }
// รุ่นย่อยที่ให้จอโชว์ภาพ: จับคู่เลข type_id กับตารางราคาที่ส่งให้ AI
let prices = [];
try { prices = JSON.parse($('PG Context').first().json.prices_json || '[]'); } catch (e) { prices = []; }
const byId = new Map(prices.map(p => [Number(p.type_id), p]));
const seen = new Set(); const items = [];
for (const id of show) {
  const p = byId.get(Number(id)); if (!p || seen.has(Number(id))) continue; seen.add(Number(id));
  items.push({ type_id: p.type_id, brand: p.brand, series: p.series, thai_name: p.thai_name || '', model: p.model || '', type: p.type, price: p.cash_price !== null ? p.cash_price : p.list_price, colors: p.colors || '', color_id: p.img_color_id || null });
  if (items.length >= 8) break;
}
if (!answer) answer = 'ขออภัยครับ ตอนนี้ระบบตอบไม่ได้ เดี๋ยวผมเรียกพนักงานมาดูแลให้นะครับ';
answer = answer.replace(/[*#_`]/g, '').replace(/\s+/g, ' ').trim();
const query = `INSERT INTO ai_reception_logs (branch_code, session_id, question, answer, model) VALUES (${q(ctx.branch)}, ${q(ctx.session_id)}, ${q(ctx.question)}, ${q(answer)}, ${q(model)}) RETURNING id;`;
return [{ json: { out: { answer, items }, query } }];
"""
BUILD_PAYLOAD = BUILD_PAYLOAD.replace("__SAMPLES__", json.dumps(SAMPLES, ensure_ascii=False))

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
    {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify($('Parse Answer').first().json.out) }}", "options": CORS},
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
