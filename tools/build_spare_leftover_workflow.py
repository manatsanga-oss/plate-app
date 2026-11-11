# สร้าง n8n workflow "Spare Leftover API" (webhook spare-leftover-api) + DDL — รายงาน "อะไหล่สั่งซื้อที่ค้างสต๊อก" รายเดือน (user 2026-11-10)
# ที่มา: ไล่ด้วยมือเดือน ก.ย./ต.ค. 69 พบของที่สั่งมาแล้วยังค้างสต๊อก (เคลม APC ส่งของชดเชย / สั่งซ้ำทั้งที่มีของ / งานปิดโดยไม่ได้ใช้)
# โครง Webhook → Build SQL → PG → Shape → Respond (ลอกจาก Vehicle_Price_Override_API_Workflow.json เหมือน Signage)
# ทำงานฝั่ง DB ใน query เดียว (ไม่ยิง search_inventory ทีละรหัสจากหน้าเว็บ — CPU n8n)
# output: C:\Users\manat\OneDrive\New folder\Spare_Leftover_Workflow.json + Spare_Leftover_DDL.sql
import json, os, re, subprocess, tempfile
D = r"C:\Users\manat\OneDrive\New folder"
TEMPLATE = os.path.join(D, "Vehicle_Price_Override_API_Workflow.json")
OUT = os.path.join(D, "Spare_Leftover_Workflow.json")

DDL_SQL = """CREATE TABLE IF NOT EXISTS spare_leftover_marks (
  id SERIAL PRIMARY KEY,
  brand TEXT NOT NULL,                       -- HONDA | YAMAHA | OUTSIDE (นอกเงินมัดจำ)
  deposit_doc_no TEXT NOT NULL DEFAULT '',   -- ใบมัดจำ/ใบสั่ง (PDS-/PDO-/SCY01-REC…)
  part_key TEXT NOT NULL,                    -- รหัสอะไหล่ตัดขีด/ช่องว่าง ตัวพิมพ์ใหญ่
  mark TEXT NOT NULL DEFAULT '',             -- claim = เคลม (APC/Honda ส่งของชดเชย) | checked = ตรวจแล้ว/ปกติ | '' = ยังไม่ติ๊ก
  note TEXT,
  marked_by TEXT, marked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (brand, deposit_doc_no, part_key)
);"""

# ตารางระบบเคลมอะไหล่ HONDA (upload การ์ด "ระบบเคลมอะไหล่ HONDA" → honda_part_claims, DDL จริงอยู่ Honda_Part_Claims_DDL.sql) — ใส่ CREATE IF NOT EXISTS กัน query พังก่อน user รัน DDL (user 2026-11-11: ติ๊กเคลมอัตโนมัติ)
CLAIM_DDL = """CREATE TABLE IF NOT EXISTS honda_part_claims (
  claim_id SERIAL PRIMARY KEY, claim_no TEXT NOT NULL, claim_date DATE, part_no TEXT NOT NULL DEFAULT '', description TEXT,
  memo_no TEXT, memo_date DATE, memo_approval_date DATE, claim_status TEXT, claim_status_date DATE, cn_dn TEXT,
  original_claim_code TEXT, change_claim_code TEXT, invoice_no TEXT, reorder_status TEXT, reorder_status_date DATE,
  reject_reason_reorder TEXT, reject_reason_reorder_desc TEXT, reorder_no TEXT, reorder_date DATE, claim_type TEXT,
  truck_company TEXT, shipping_no TEXT, lot_no TEXT, claim_request_desc TEXT, reason TEXT,
  invoice_qty NUMERIC(12,2) DEFAULT 0, claim_qty NUMERIC(12,2) DEFAULT 0, claim_amount NUMERIC(14,2) DEFAULT 0, memo_claim TEXT,
  source_file TEXT, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (claim_no, part_no)
);"""

NORM = "UPPER(REPLACE(REPLACE(COALESCE(%s,''),'-',''),' ',''))"

BUILD = r"""// spare-leftover-api: รายงานอะไหล่สั่งซื้อที่ค้างสต๊อก รายเดือน (user 2026-11-10)
// report {month:'YYYY-MM', brand:'ALL'|'HONDA'|'YAMAHA'} → รายการในใบสั่งซื้อ HONDA (spare_parts_orders/items) + YAMAHA (yamaha_spare_orders/items) ของเดือนนั้น
//   ที่ "ตอนนี้ยังมีของในสต๊อก" (honda_inventory ใช้ร่วมทุกยี่ห้อ — เช็คเฉพาะร้านของระบบนั้น user 2026-11-11: HONDA = ป.เปา · YAMAHA = ห้าห้อง (สำนักงานใหญ่ 00000) · นอกมัดจำ = ทั้งสอง · ไม่นับ สช ตลาด/นครหลวง) + กลุ่มหมุนเร็ว (fast_moving_parts ให้หน้าเว็บซ่อน) + วันรับเข้าหลังสั่ง + เครื่องหมายเคลม
//   เคลมอัตโนมัติ (user 2026-11-11): รหัสที่มีในระบบเคลมอะไหล่ HONDA (honda_part_claims สถานะไม่ใช่ยกเลิก วันเคลม -2..+120 วันจากวันสั่ง) → mark 'claim' + note 'เคลม <เลข> <วัน> · <สถานะ>' marked_by 'ระบบเคลม HONDA'
//   ถ้ามีแถวใน spare_leftover_marks (คนติ๊ก/ติ๊กออก) ให้ค่าคนชนะเสมอ — ติ๊กออกแล้ว note ยังอยู่ = แถว mark '' คงไว้เป็น override ไม่ถูกติ๊กกลับ
// save_mark {brand, deposit_doc_no, part_code, mark:'claim'|'checked'|'', note, user} → spare_leftover_marks (ว่างทั้ง mark และ note = ลบ)
const b = $input.first().json.body || {};
const action = String(b.action || '').trim();
const esc = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const DDL = `__DDL__`;
const norm = (col) => `UPPER(REPLACE(REPLACE(COALESCE(${col},''),'-',''),' ',''))`;
const key = (s) => String(s || '').toUpperCase().replace(/[-\s]/g, '').trim();

if (action === 'report') {
  const m = /^\d{4}-\d{2}$/.test(String(b.month || '')) ? String(b.month) : new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7);
  const brand = ['HONDA', 'YAMAHA', 'OUTSIDE'].includes(String(b.brand || '').toUpperCase()) ? String(b.brand).toUpperCase() : 'ALL';   // OUTSIDE = ระบบสั่งซื้อนอกเงินมัดจำ (user 2026-11-10 'รวมด้วย')
  const monthCond = (alias) => `to_char(${alias}.created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM') = '${m}'`;
  const ordCols = (brandLit) => `'${brandLit}' AS brand, o.order_id, o.order_no, o.deposit_doc_no, o.customer_name, COALESCE(o.status,'') AS status, o.created_at, o.technician, o.vendor_po_no, o.branch, o.license_plate, o.model_name, i.part_code, i.part_name, i.quantity`;
  const query = `${DDL}
WITH ord AS (
  SELECT ${ordCols('HONDA')} FROM spare_parts_orders o JOIN spare_parts_items i ON i.order_id = o.order_id WHERE ${monthCond('o')}
  UNION ALL
  SELECT ${ordCols('YAMAHA')} FROM yamaha_spare_orders o JOIN yamaha_spare_items i ON i.order_id = o.order_id WHERE ${monthCond('o')}
  UNION ALL
  SELECT 'OUTSIDE' AS brand, o.order_id, o.doc_no AS order_no, o.doc_no AS deposit_doc_no, o.customer_name, COALESCE(o.status,'') AS status, o.created_at, o.technician, o.po_no AS vendor_po_no, o.branch, o.license_plate, o.model_name, i.part_code, i.part_name, i.quantity
  FROM outside_deposit_orders o JOIN outside_deposit_items i ON i.order_id = o.order_id WHERE ${monthCond('o')}
), n AS (
  SELECT ord.*, ${norm('part_code')} AS k FROM ord WHERE LENGTH(${norm('part_code')}) >= 6 AND ('${brand}' = 'ALL' OR brand = '${brand}')
), n2 AS (
  SELECT n.*, CASE WHEN LENGTH(k) = 10 THEN k || '00' ELSE k END AS k12, CASE WHEN LENGTH(k) = 12 AND RIGHT(k, 2) = '00' THEN LEFT(k, 10) ELSE k END AS k10 FROM n
), inv AS (
  SELECT ${norm("TRIM(LEADING '''' FROM product_code)")} AS k, source, quantity, location FROM honda_inventory WHERE quantity > 0
), fm AS (
  SELECT ${norm('part_code')} AS k, product_group FROM fast_moving_parts WHERE NOT COALESCE(is_discontinued, false)
  UNION
  SELECT ${norm('ref_code')} AS k, product_group FROM fast_moving_parts WHERE NOT COALESCE(is_discontinued, false) AND COALESCE(ref_code, '') <> ''
), cl AS (
  SELECT ${norm('c.part_no')} AS k, c.claim_no, c.claim_date, TRIM(COALESCE(c.claim_status, '')) AS claim_status, c.invoice_no
  FROM honda_part_claims c WHERE COALESCE(c.claim_status, '') NOT LIKE '%ยกเลิก%'
), st AS (
  SELECT n2.brand, n2.order_id, n2.k,
    json_agg(json_build_object('source', inv.source, 'qty', inv.quantity, 'location', inv.location) ORDER BY inv.source) AS stock,
    SUM(inv.quantity) AS stock_qty
  FROM n2 JOIN inv ON inv.k IN (n2.k, n2.k12, n2.k10)
    AND ((n2.brand = 'HONDA' AND TRIM(inv.source) = 'ป.เปา') OR (n2.brand = 'YAMAHA' AND TRIM(inv.source) = 'ห้าห้อง') OR (n2.brand = 'OUTSIDE' AND TRIM(inv.source) IN ('ป.เปา', 'ห้าห้อง')))
  GROUP BY n2.brand, n2.order_id, n2.k
)
SELECT COALESCE(json_agg(row_to_json(q) ORDER BY q.created_at, q.order_id, q.part_code), '[]'::json)::text AS listjson,
  (SELECT COUNT(DISTINCT brand || ':' || order_id) FROM n) AS order_count, (SELECT COUNT(*) FROM n) AS item_count
FROM (
  SELECT n2.brand, n2.order_id, n2.order_no, n2.deposit_doc_no, n2.customer_name, n2.status,
    to_char(n2.created_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS order_date, n2.created_at, n2.technician, n2.vendor_po_no, n2.branch, n2.license_plate, n2.model_name,
    n2.part_code, n2.part_name, n2.quantity, n2.k AS part_key, st.stock, st.stock_qty,
    (SELECT fm.product_group FROM fm WHERE fm.k IN (n2.k, n2.k12, n2.k10) LIMIT 1) AS fast_group,
    CASE WHEN n2.brand IN ('HONDA', 'OUTSIDE') THEN COALESCE((
        SELECT MIN(COALESCE(r.order_date, r.receipt_date))::text FROM honda_part_receipt_items ri JOIN honda_part_receipts r ON ri.pd_no = r.pd_no
        WHERE REPLACE(ri.part_code, '-', '') = n2.k
          AND COALESCE(r.order_date, r.receipt_date) BETWEEN (n2.created_at AT TIME ZONE 'Asia/Bangkok')::date - 2 AND (n2.created_at AT TIME ZONE 'Asia/Bangkok')::date + 60),
        CASE WHEN n2.brand = 'OUTSIDE' THEN (SELECT MIN(y2.receipt_date::date)::text FROM yamaha_part_receipt_items y2 WHERE ${norm('y2.part_code')} IN (n2.k, n2.k12, n2.k10) AND y2.receipt_date IS NOT NULL AND y2.receipt_date::text <> '' AND y2.receipt_date::date BETWEEN (n2.created_at AT TIME ZONE 'Asia/Bangkok')::date - 2 AND (n2.created_at AT TIME ZONE 'Asia/Bangkok')::date + 60) END)
      ELSE (
        SELECT MIN(y.receipt_date::date)::text FROM yamaha_part_receipt_items y
        WHERE (${norm('y.part_code')} IN (n2.k, n2.k12, n2.k10) OR ${norm('y.part_code2')} IN (n2.k, n2.k12, n2.k10))
          AND y.receipt_date IS NOT NULL AND y.receipt_date::text <> ''
          AND y.receipt_date::date BETWEEN (n2.created_at AT TIME ZONE 'Asia/Bangkok')::date - 2 AND (n2.created_at AT TIME ZONE 'Asia/Bangkok')::date + 60)
    END AS received_date,
    c.claim_no, to_char(c.claim_date, 'YYYY-MM-DD') AS claim_date, c.claim_status, c.invoice_no AS claim_invoice_no,
    CASE WHEN mk.id IS NOT NULL THEN COALESCE(mk.mark, '') WHEN c.claim_no IS NOT NULL THEN 'claim' ELSE '' END AS mark,
    CASE WHEN mk.id IS NOT NULL THEN mk.note WHEN c.claim_no IS NOT NULL THEN 'เคลม ' || c.claim_no || ' ' || to_char(c.claim_date, 'DD/MM/') || RIGHT((EXTRACT(YEAR FROM c.claim_date)::int + 543)::text, 2) || ' · ' || c.claim_status ELSE NULL END AS mark_note,
    CASE WHEN mk.id IS NOT NULL THEN mk.marked_by WHEN c.claim_no IS NOT NULL THEN 'ระบบเคลม HONDA' ELSE NULL END AS marked_by,
    to_char(mk.marked_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI') AS marked_at
  FROM n2 JOIN st ON st.brand = n2.brand AND st.order_id = n2.order_id AND st.k = n2.k
  LEFT JOIN spare_leftover_marks mk ON mk.brand = n2.brand AND mk.deposit_doc_no = COALESCE(n2.deposit_doc_no, '') AND mk.part_key = n2.k
  LEFT JOIN LATERAL (
    SELECT cl.claim_no, cl.claim_date, cl.claim_status, cl.invoice_no FROM cl
    WHERE n2.brand IN ('HONDA', 'OUTSIDE') AND cl.k IN (n2.k, n2.k12, n2.k10)
      AND cl.claim_date BETWEEN (n2.created_at AT TIME ZONE 'Asia/Bangkok')::date - 2 AND (n2.created_at AT TIME ZONE 'Asia/Bangkok')::date + 120
    ORDER BY cl.claim_date DESC LIMIT 1
  ) c ON TRUE
) q;`;
  return [{ json: { query } }];
}

if (action === 'save_mark') {
  const brand = ['HONDA', 'YAMAHA', 'OUTSIDE'].includes(String(b.brand || '').toUpperCase()) ? String(b.brand).toUpperCase() : '';
  const pk = key(b.part_code); const doc = esc(String(b.deposit_doc_no || '').trim());
  const mark = ['claim', 'checked'].includes(String(b.mark || '')) ? String(b.mark) : '';
  const note = String(b.note || '').trim().slice(0, 300);
  if (!brand || !pk) return [{ json: { query: "SELECT 'missing brand/part_code' AS error" } }];
  const cols = "id, brand, deposit_doc_no, part_key, mark, note, marked_by, to_char(marked_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI') AS marked_at";
  if (!mark && !note) {
    return [{ json: { query: `${DDL} DELETE FROM spare_leftover_marks WHERE brand = '${brand}' AND deposit_doc_no = '${doc}' AND part_key = '${esc(pk)}' RETURNING id, brand, deposit_doc_no, part_key, '' AS mark, NULL::text AS note, marked_by, NULL::text AS marked_at;` } }];
  }
  return [{ json: { query: `${DDL} INSERT INTO spare_leftover_marks (brand, deposit_doc_no, part_key, mark, note, marked_by)
VALUES ('${brand}', '${doc}', '${esc(pk)}', '${mark}', ${note ? `'${esc(note)}'` : 'NULL'}, '${esc(String(b.user || '').slice(0, 100))}')
ON CONFLICT (brand, deposit_doc_no, part_key) DO UPDATE SET mark = EXCLUDED.mark, note = EXCLUDED.note, marked_by = EXCLUDED.marked_by, marked_at = now()
RETURNING ${cols};` } }];
}

return [{ json: { query: `SELECT 'unknown action ${esc(action)}' AS error` } }];
""".replace("__DDL__", re.sub(r"--[^\n]*", "", DDL_SQL + "\n" + CLAIM_DDL).replace("\n", " "))   # ตัด comment -- ออกก่อนยุบเป็นบรรทัดเดียว (ไม่งั้น -- กลืน SQL ที่เหลือทั้งก้อน)

assert "$" not in DDL_SQL and "$" not in CLAIM_DDL
w = json.load(open(TEMPLATE, encoding="utf-8"))
w["name"] = "Spare Leftover API"
for k in ("id", "versionId", "pinData", "staticData", "tags"):
    w.pop(k, None)
w["meta"] = {"instanceId": ""}
for n in w["nodes"]:
    if n["type"] == "n8n-nodes-base.webhook":
        n["parameters"]["path"] = "spare-leftover-api"
        n["webhookId"] = "spare-leftover-api"
        n["parameters"]["options"] = {"allowedOrigins": "*"}
    if n["name"] == "Build SQL":
        n["parameters"]["jsCode"] = BUILD
    if n["type"] == "n8n-nodes-base.postgres":
        n["credentials"] = {}
        n["alwaysOutputData"] = True
        n["onError"] = "continueRegularOutput"
    n["id"] = "slo" + n["id"][3:] if len(n["id"]) > 3 else "slo_" + n["id"]
json.dump(w, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(os.path.join(D, "Spare_Leftover_DDL.sql"), "w", encoding="utf-8").write(
    "-- รายงานอะไหล่สั่งซื้อที่ค้างสต๊อก (spare-leftover-api) — เครื่องหมายเคลม/ตรวจแล้ว ต่อรายการ (workflow รัน CREATE TABLE IF NOT EXISTS เองด้วย)\n" + DDL_SQL + "\n")

# ---- syntax check + จำลอง SQL ----
stub = "const $=(x)=>({first:()=>({json:{body:{}}}),all:()=>[]});const $input={first:()=>({json:{body:JSON.parse(process.argv[2]||'{}')}})};\n(async()=>{const r=await (async()=>{" + BUILD + "\n})(); console.log(r[0].json.query);})();"
f = os.path.join(tempfile.gettempdir(), "spare_leftover_build.js"); open(f, "w", encoding="utf-8").write(stub)
r = subprocess.run(["node", "--check", f], capture_output=True, text=True, encoding="utf-8", errors="replace")
print("node --check:", "OK" if r.returncode == 0 else r.stderr)
for body in [{"action": "report", "month": "2026-10", "brand": "ALL"}, {"action": "save_mark", "brand": "HONDA", "deposit_doc_no": "PDS-2610-00057", "part_code": "19150-KWN-781", "mark": "claim", "note": "C261012881", "user": "admin"}, {"action": "save_mark", "brand": "HONDA", "deposit_doc_no": "X", "part_code": "19150-KWN-781"}]:
    r = subprocess.run(["node", f, json.dumps(body)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    q = r.stdout or r.stderr
    assert "$" not in q.replace("$input", ""), "พบ $ ใน SQL"
    print("--", body["action"], "\n", q[:3000] if body["action"] == "report" else q.strip())
print("written:", OUT)
