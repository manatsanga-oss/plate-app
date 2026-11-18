# สร้าง n8n workflow "Part Substitute API" (webhook part-substitute-api) + DDL — เมนู Spare Inventory → "รายการอะไหล่ทดแทน" (user 2026-11-18)
#   แท็บ 1 รายการอะไหล่ทดแทน: ตาราง part_substitutes เดิม (คู่รหัสที่สั่ง ↔ รหัสที่ส่งมาแทน บันทึกจากหน้ารายการสั่งอะไหล่รายวัน/ระบบสั่งซื้อ) + สต๊อกของทั้งสองรหัส + เพิ่ม/แก้/ลบเองได้
#   แท็บ 2 รายการอะไหล่ที่ยกเลิกการผลิต: รวมธง fast_moving_parts.is_discontinued (ติ๊กในรายงานอะไหล่หมุนเร็ว) กับตารางใหม่ part_discontinued (รหัสนอกหมุนเร็ว + หมายเหตุ/วันที่ประกาศ)
#     + รหัสทดแทน (จาก part_substitutes) + สต๊อกคงเหลือ
# โครง Webhook → Build SQL → PG → Shape → Respond (ลอกจาก Vehicle_Price_Override_API_Workflow.json เหมือน Spare Leftover)
# ⚠️ ไม่มี ALTER TABLE · ไม่มี $ ใน SQL · คอลัมน์ PK ของ part_substitutes ในฐานจริงชื่อ id (DDL ในไฟล์เขียน substitute_id) → อ้างผ่าน to_jsonb ให้ใช้ได้ทั้งสองแบบ
# output: C:\Users\manat\OneDrive\New folder\Part_Substitute_Workflow.json + Part_Discontinued_DDL.sql
import json, os, re, subprocess, tempfile
D = r"C:\Users\manat\OneDrive\New folder"
TEMPLATE = os.path.join(D, "Vehicle_Price_Override_API_Workflow.json")
OUT = os.path.join(D, "Part_Substitute_Workflow.json")

DDL_SQL = """CREATE TABLE IF NOT EXISTS part_discontinued (
  id SERIAL PRIMARY KEY,
  brand TEXT,                         -- HONDA | YAMAHA | อื่น ๆ
  part_code TEXT NOT NULL,            -- รหัสตามที่พิมพ์
  part_key TEXT NOT NULL UNIQUE,      -- รหัสตัดขีด/ช่องว่าง ตัวพิมพ์ใหญ่ (กันซ้ำ)
  part_name TEXT,
  note TEXT,                          -- หมายเหตุ เช่น เลขที่ประกาศ / ใช้รหัสอะไรแทน
  announced_date DATE,                -- วันที่ประกาศยกเลิก (ถ้ามี)
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);"""
SUBS_DDL = "CREATE TABLE IF NOT EXISTS part_substitutes (substitute_id SERIAL PRIMARY KEY, order_id INTEGER, original_code TEXT, substitute_code TEXT, original_name TEXT, substitute_name TEXT, approved_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());"

BUILD = r"""// part-substitute-api: รายการอะไหล่ทดแทน + อะไหล่ที่ยกเลิกการผลิต (เมนู Spare Inventory, user 2026-11-18)
// list_substitutes → {listjson} คู่รหัสทั้งหมด + สต๊อกของรหัสเดิม/รหัสทดแทน (honda_inventory ใช้ร่วมทุกยี่ห้อ) + ธงว่ารหัสเดิมยกเลิกผลิต
// save_substitute {id?, original_code, substitute_code, original_name, substitute_name, user} · delete_substitute {id}
// list_discontinued → {listjson} รหัสที่ยกเลิกผลิต (part_discontinued ∪ fast_moving_parts.is_discontinued) + รหัสทดแทน + สต๊อก
// save_discontinued {brand, part_code, part_name, note, announced_date, user} (upsert ตามรหัส + ติ๊กธงในรายงานหมุนเร็วถ้ามีรหัสนั้น)
// delete_discontinued {part_code} (ลบแถว + เอาธงในรายงานหมุนเร็วออก)
const b = $input.first().json.body || {};
const action = String(b.action || '').trim();
const esc = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const DDL = `__DDL__`;
const norm = (col) => `UPPER(REPLACE(REPLACE(COALESCE(${col},''),'-',''),' ',''))`;
const key = (s) => String(s || '').toUpperCase().replace(/[-\s]/g, '').trim();
const txt = (v, n) => { const s = String(v == null ? '' : v).trim().slice(0, n || 200); return s ? `'${esc(s)}'` : 'NULL'; };
// YAMAHA: ใบสั่งใช้รหัส 10 ตัว สต๊อก 12 ตัว (…00) → เทียบทั้ง 3 รูป
const k12 = (k) => `CASE WHEN LENGTH(${k}) = 10 THEN ${k} || '00' ELSE ${k} END`;
const k10 = (k) => `CASE WHEN LENGTH(${k}) = 12 AND RIGHT(${k}, 2) = '00' THEN LEFT(${k}, 10) ELSE ${k} END`;
const keys3 = (k) => `(${k}, ${k12(k)}, ${k10(k)})`;
const INV = `inv AS (SELECT ${norm("TRIM(LEADING '''' FROM product_code)")} AS k, TRIM(source) AS source, SUM(quantity) AS qty FROM honda_inventory WHERE quantity > 0 GROUP BY 1, 2),
invn AS (SELECT ${norm("TRIM(LEADING '''' FROM product_code)")} AS k, MAX(product_name) AS name FROM honda_inventory GROUP BY 1)`;
const stock = (k) => `(SELECT COALESCE(json_agg(json_build_object('source', z.source, 'qty', z.qty) ORDER BY z.source), '[]'::json) FROM (SELECT inv.source, SUM(inv.qty) AS qty FROM inv WHERE inv.k IN ${keys3(k)} GROUP BY inv.source) z)`;
const invName = (k) => `(SELECT MAX(invn.name) FROM invn WHERE invn.k IN ${keys3(k)})`;
const pk = (alias) => `COALESCE(to_jsonb(${alias})->>'id', to_jsonb(${alias})->>'substitute_id')`;   // PK ของ part_substitutes (ฐานจริงชื่อ id)
const DISK = `disk AS (SELECT part_key AS k FROM part_discontinued UNION SELECT ${norm('part_code')} FROM fast_moving_parts WHERE COALESCE(is_discontinued, false))`;

if (action === 'list_substitutes') {
  const query = `${DDL}
WITH ${INV}, ${DISK},
s AS (SELECT ps.*, ${pk('ps')} AS pkid, ${norm('ps.original_code')} AS ok, ${norm('ps.substitute_code')} AS sk FROM part_substitutes ps WHERE COALESCE(ps.original_code, '') <> '' AND COALESCE(ps.substitute_code, '') <> '')
SELECT COALESCE(json_agg(row_to_json(q) ORDER BY q.created_at DESC NULLS LAST, q.id DESC), '[]'::json)::text AS listjson
FROM (
  SELECT s.pkid::int AS id, s.original_code, s.substitute_code,
    COALESCE(NULLIF(TRIM(s.original_name), ''), ${invName('s.ok')}) AS original_name, COALESCE(NULLIF(TRIM(s.substitute_name), ''), ${invName('s.sk')}) AS substitute_name,
    s.order_id, s.approved_by, to_char(s.created_at::timestamptz AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS created_date, s.created_at,   /* created_at ในฐานจริงเป็น timestamp ไม่มีโซน (UTC) → cast ก่อนแปลงโซน */
    ${stock('s.ok')} AS stock_original, ${stock('s.sk')} AS stock_substitute,
    EXISTS (SELECT 1 FROM disk WHERE disk.k IN ${keys3('s.ok')}) AS original_discontinued
  FROM s
) q;`;
  return [{ json: { query } }];
}

if (action === 'save_substitute') {
  const oc = String(b.original_code || '').trim().toUpperCase().slice(0, 40), sc = String(b.substitute_code || '').trim().toUpperCase().slice(0, 40);
  if (key(oc).length < 5 || key(sc).length < 5) return [{ json: { query: "SELECT 'กรอกรหัสเดิมและรหัสทดแทนให้ครบ' AS error" } }];
  if (key(oc) === key(sc)) return [{ json: { query: "SELECT 'รหัสเดิมกับรหัสทดแทนเป็นรหัสเดียวกัน' AS error" } }];
  const id = Number(b.id) > 0 ? Math.floor(Number(b.id)) : 0;
  const who = txt(b.user, 100);
  const dupe = `EXISTS (SELECT 1 FROM part_substitutes x WHERE ${norm('x.original_code')} = '${esc(key(oc))}' AND ${norm('x.substitute_code')} = '${esc(key(sc))}'${id ? ` AND ${pk('x')} <> '${id}'` : ''})`;
  if (id) {
    return [{ json: { query: `${DDL}
WITH u AS (UPDATE part_substitutes ps SET original_code = '${esc(oc)}', substitute_code = '${esc(sc)}', original_name = ${txt(b.original_name)}, substitute_name = ${txt(b.substitute_name)}
  WHERE ${pk('ps')} = '${id}' AND NOT ${dupe} RETURNING 1)
SELECT (SELECT COUNT(*) FROM u)::int AS saved, CASE WHEN (SELECT COUNT(*) FROM u) = 0 THEN 'บันทึกไม่ได้ — ไม่พบรายการ หรือคู่นี้มีอยู่แล้ว' END AS error;` } }];
  }
  return [{ json: { query: `${DDL}
WITH i AS (INSERT INTO part_substitutes (order_id, original_code, substitute_code, original_name, substitute_name, approved_by)
  SELECT NULL, '${esc(oc)}', '${esc(sc)}', ${txt(b.original_name)}, ${txt(b.substitute_name)}, ${who} WHERE NOT ${dupe} RETURNING 1)
SELECT (SELECT COUNT(*) FROM i)::int AS saved, CASE WHEN (SELECT COUNT(*) FROM i) = 0 THEN 'คู่อะไหล่ทดแทนนี้มีอยู่แล้ว' END AS error;` } }];
}

if (action === 'delete_substitute') {
  const id = Number(b.id) > 0 ? Math.floor(Number(b.id)) : 0;
  if (!id) return [{ json: { query: "SELECT 'missing id' AS error" } }];
  return [{ json: { query: `${DDL}
WITH d AS (DELETE FROM part_substitutes ps WHERE ${pk('ps')} = '${id}' RETURNING 1) SELECT (SELECT COUNT(*) FROM d)::int AS deleted;` } }];
}

if (action === 'list_discontinued') {
  const query = `${DDL}
WITH ${INV},
subs AS (SELECT ${norm('original_code')} AS ok, substitute_code, substitute_name, ${norm('substitute_code')} AS sk FROM part_substitutes WHERE COALESCE(original_code, '') <> '' AND COALESCE(substitute_code, '') <> ''),
fk AS (SELECT DISTINCT ON (${norm('part_code')}) ${norm('part_code')} AS k, part_code, brand, custom_name, product_group FROM fast_moving_parts WHERE COALESCE(is_discontinued, false) AND COALESCE(part_code, '') <> '' ORDER BY ${norm('part_code')}, id),
d AS (
  SELECT COALESCE(pd.part_key, fk.k) AS k, COALESCE(pd.part_code, fk.part_code) AS part_code, COALESCE(NULLIF(pd.brand, ''), fk.brand) AS brand,
    COALESCE(NULLIF(pd.part_name, ''), NULLIF(fk.custom_name, '')) AS part_name, pd.note, to_char(pd.announced_date, 'YYYY-MM-DD') AS announced_date,
    pd.created_by, to_char(pd.created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS created_date, fk.product_group, (fk.k IS NOT NULL) AS in_fast, (pd.id IS NOT NULL) AS in_manual
  FROM part_discontinued pd FULL JOIN fk ON fk.k = pd.part_key
)
SELECT COALESCE(json_agg(row_to_json(q) ORDER BY q.brand NULLS LAST, q.part_code), '[]'::json)::text AS listjson
FROM (
  SELECT d.k AS part_key, d.part_code, d.brand, COALESCE(d.part_name, ${invName('d.k')}) AS part_name, d.note, d.announced_date, d.created_by, d.created_date, d.product_group, d.in_fast, d.in_manual,
    ${stock('d.k')} AS stock,
    (SELECT COALESCE(json_agg(json_build_object('code', s.substitute_code, 'name', COALESCE(NULLIF(TRIM(s.substitute_name), ''), ${invName('s.sk')}), 'stock', ${stock('s.sk')}) ORDER BY s.substitute_code), '[]'::json)
       FROM subs s WHERE s.ok IN ${keys3('d.k')}) AS replacements
  FROM d
) q;`;
  return [{ json: { query } }];
}

if (action === 'save_discontinued') {
  const code = String(b.part_code || '').trim().toUpperCase().slice(0, 40); const k = key(code);
  if (k.length < 5) return [{ json: { query: "SELECT 'กรอกรหัสอะไหล่' AS error" } }];
  const ad = /^\d{4}-\d{2}-\d{2}$/.test(String(b.announced_date || '')) ? `'${b.announced_date}'::date` : 'NULL';
  const brand = txt(String(b.brand || '').toUpperCase(), 20);
  return [{ json: { query: `${DDL}
WITH up AS (INSERT INTO part_discontinued (brand, part_code, part_key, part_name, note, announced_date, created_by)
  VALUES (${brand}, '${esc(code)}', '${esc(k)}', ${txt(b.part_name)}, ${txt(b.note, 300)}, ${ad}, ${txt(b.user, 100)})
  ON CONFLICT (part_key) DO UPDATE SET brand = COALESCE(EXCLUDED.brand, part_discontinued.brand), part_code = EXCLUDED.part_code, part_name = EXCLUDED.part_name, note = EXCLUDED.note, announced_date = EXCLUDED.announced_date, updated_at = now()
  RETURNING id),
fu AS (UPDATE fast_moving_parts f SET is_discontinued = true WHERE ${norm('f.part_code')} IN ${keys3(`'${esc(k)}'`)} AND NOT COALESCE(f.is_discontinued, false) RETURNING 1)
SELECT (SELECT id FROM up) AS id, (SELECT COUNT(*) FROM fu)::int AS fast_flagged;` } }];
}

if (action === 'delete_discontinued') {
  const k = key(b.part_code);
  if (k.length < 5) return [{ json: { query: "SELECT 'missing part_code' AS error" } }];
  return [{ json: { query: `${DDL}
WITH d AS (DELETE FROM part_discontinued WHERE part_key = '${esc(k)}' RETURNING 1),
fu AS (UPDATE fast_moving_parts f SET is_discontinued = false WHERE ${norm('f.part_code')} = '${esc(k)}' AND COALESCE(f.is_discontinued, false) RETURNING 1)
SELECT (SELECT COUNT(*) FROM d)::int AS deleted, (SELECT COUNT(*) FROM fu)::int AS fast_unflagged;` } }];
}

return [{ json: { query: `SELECT 'unknown action ${esc(action)}' AS error` } }];
""".replace("__DDL__", re.sub(r"--[^\n]*", "", DDL_SQL + "\n" + SUBS_DDL).replace("\n", " "))   # ตัด comment -- ออกก่อนยุบเป็นบรรทัดเดียว (ไม่งั้น -- กลืน SQL ที่เหลือ)

assert "$" not in DDL_SQL and "ALTER" not in BUILD.upper().replace("ALTERNAT", "")
w = json.load(open(TEMPLATE, encoding="utf-8"))
w["name"] = "Part Substitute API"
for k in ("id", "versionId", "pinData", "staticData", "tags"):
    w.pop(k, None)
w["meta"] = {"instanceId": ""}
for n in w["nodes"]:
    if n["type"] == "n8n-nodes-base.webhook":
        n["parameters"]["path"] = "part-substitute-api"
        n["webhookId"] = "part-substitute-api"
        n["parameters"]["options"] = {"allowedOrigins": "*"}
    if n["name"] == "Build SQL":
        n["parameters"]["jsCode"] = BUILD
    if n["type"] == "n8n-nodes-base.postgres":
        n["credentials"] = {}
        n["alwaysOutputData"] = True
        n["onError"] = "continueRegularOutput"
    n["id"] = "psb" + n["id"][3:] if len(n["id"]) > 3 else "psb_" + n["id"]
json.dump(w, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(os.path.join(D, "Part_Discontinued_DDL.sql"), "w", encoding="utf-8").write(
    "-- รายการอะไหล่ที่ยกเลิกการผลิต (part-substitute-api, เมนู Spare Inventory → รายการอะไหล่ทดแทน) — workflow รัน CREATE TABLE IF NOT EXISTS เองด้วย\n"
    "-- ใช้คู่กับธง fast_moving_parts.is_discontinued (รายงานอะไหล่หมุนเร็ว) และตาราง part_substitutes (Part_Substitutes_DDL.sql)\n" + DDL_SQL + "\n")

# ---- syntax check + จำลอง SQL ----
stub = "const $=(x)=>({first:()=>({json:{body:{}}}),all:()=>[]});const $input={first:()=>({json:{body:JSON.parse(process.argv[2]||'{}')}})};\n(async()=>{const r=await (async()=>{" + BUILD + "\n})(); console.log(r[0].json.query);})();"
f = os.path.join(tempfile.gettempdir(), "part_substitute_build.js"); open(f, "w", encoding="utf-8").write(stub)
r = subprocess.run(["node", "--check", f], capture_output=True, text=True, encoding="utf-8", errors="replace")
print("node --check:", "OK" if r.returncode == 0 else r.stderr)
os.makedirs(os.path.join(tempfile.gettempdir(), "psb_sql"), exist_ok=True)
for i, body in enumerate([
    {"action": "list_substitutes"}, {"action": "list_discontinued"},
    {"action": "save_substitute", "original_code": "4rt-f3411-10", "substitute_code": "50P-F3411-00", "original_name": "ถ้วยคอ", "substitute_name": "ถ้วยคอ NMAX", "user": "admin"},
    {"action": "save_substitute", "id": 163, "original_code": "90110-06187", "substitute_code": "913120601200", "original_name": "โบลท์หกเหลี่ยม", "substitute_name": "โบ๊ลท์ (L)"},
    {"action": "save_substitute", "original_code": "ABC", "substitute_code": ""}, {"action": "delete_substitute", "id": 163},
    {"action": "save_discontinued", "brand": "honda", "part_code": "34906-447-711", "part_name": "หลอดไฟท้าย", "note": "ประกาศ 11/2569 o'k", "announced_date": "2026-11-01", "user": "admin"},
    {"action": "delete_discontinued", "part_code": "34906-447-711"}, {"action": "zzz"}]):
    r = subprocess.run(["node", f, json.dumps(body)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    q = r.stdout or r.stderr
    assert "$" not in q, "พบ $ ใน SQL: " + body["action"]
    bal = q.count("(") - q.count(")")
    open(os.path.join(tempfile.gettempdir(), "psb_sql", f"{i}_{body['action']}.sql"), "w", encoding="utf-8").write(q)
    print("--", body["action"], "| len", len(q), "| parens", bal, "| ", re.sub(r"CREATE TABLE IF NOT EXISTS [^;]+;\s*", "", q).strip().replace("\n", " ")[:260])
print("written:", OUT)
