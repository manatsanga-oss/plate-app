-- ===== นำเข้าวัสดุสำนักงาน สิงห์ชัย (ยอดยกมา) =====
-- 1) เพิ่ม products ใหม่ที่ยังไม่มีในตาราง (match ชื่อ+หน่วย)
-- 2) UPSERT stock สำหรับ singchai

-- ===== Step 1: เพิ่ม products ใหม่ =====
INSERT INTO products (product_id, product_name, unit, unit_price, is_active)
SELECT v.pid, v.pname, v.unit, v.price, true
FROM (VALUES
  ('SCY_SC001', 'ปากกามาร์คเกอร์', 'แท่ง', 17.67),
  ('SCY_SC002', 'กระดาษชำระม้วนใหญ่', 'ม้วน', 1018.69),
  ('SCY_SC003', 'ตัวหนีบ 25มม', 'กล่อง', 15.89),
  ('SCY_SC004', 'ซองน้ำตาลA4', 'แพ็ค', 112.15),
  ('SCY_SC005', 'ลูกแม็ก เบอร์ M8', 'กล่อง', 12.09),
  ('SCY_SC006', 'ลิ้นแฟ้ม', 'กล่อง', 63.24),
  ('SCY_SC007', 'โพสต์อิทเล็ก', 'อัน', 126.17),
  ('SCY_SC008', 'ใบมีดคัตเตอร์ใหญ่', 'กล่อง', 37.20),
  ('SCY_SC009', 'ใบมีดคัตเตอร์เล็ก', 'กล่อง', 23.25),
  ('SCY_SC010', 'แม็ก', 'คร.', 134.85),
  ('SCY_SC011', 'ดินสอ', 'ด้าม', 37.20),
  ('SCY_SC012', 'ยางลบ', 'ก้อน', 5.58),
  ('SCY_SC013', 'กาวแท่ง', 'อัน', 21.39),
  ('SCY_SC014', 'ตัวหนีบ 19มม', 'กล่อง', 21.39),
  ('SCY_SC015', 'หลอดกาแฟ', 'แพ็ค', 13.95)
) AS v(pid, pname, unit, price)
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.product_name = v.pname AND p.unit = v.unit
)
ON CONFLICT (product_id) DO NOTHING;

-- ===== Step 2: UPSERT stock ยอดยกมา singchai =====
-- ใช้ subquery หา product_id จากชื่อ+หน่วย
INSERT INTO stock (product_id, stock_group, qty_in_stock, updated_at)
SELECT p.product_id, 'singchai', v.qty, NOW()
FROM (VALUES
  ('ปากกามาร์คเกอร์',   'แท่ง',    3),
  ('น้ำยาเช็ดกระจก',    'แกลลอน',   2),
  ('กระดาษชำระม้วนใหญ่', 'ม้วน',    1),
  ('ถุงขยะ 18*20',      'แพ็ค',    2),
  ('ตัวหนีบ 25มม',      'กล่อง',   2),
  ('ซองน้ำตาลA4',       'แพ็ค',   10),
  ('ลิควิส',           'อัน',     3),
  ('ลูกแม็ก เบอร์ M8',   'กล่อง',   1),
  ('ลูกแม็ก เบอร์ 35',   'กล่อง',   3),
  ('ลิ้นแฟ้ม',          'กล่อง',   1),
  ('โพสต์อิทเล็ก',      'อัน',     9),
  ('ใบมีดคัตเตอร์ใหญ่',  'กล่อง',   2),
  ('ใบมีดคัตเตอร์เล็ก',  'กล่อง',   1),
  ('แม็ก',             'คร.',     1),
  ('ดินสอ',            'ด้าม',   11),
  ('ยางลบ',            'ก้อน',    2),
  ('กาวแท่ง',          'อัน',     1),
  ('ถุงขยะ 36x45',     'แพ็ค',    5),
  ('ตัวหนีบ 19มม',      'กล่อง',   3),
  ('หลอดกาแฟ',         'แพ็ค',    1),
  ('น้ำยาล้างห้องน้ำ',   'แกลลอน',   3)
) AS v(pname, unit, qty)
JOIN products p ON p.product_name = v.pname AND p.unit = v.unit
ON CONFLICT (product_id, stock_group)
DO UPDATE SET qty_in_stock = EXCLUDED.qty_in_stock, updated_at = NOW();
