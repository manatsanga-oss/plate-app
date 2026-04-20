-- 1) ดูโครงสร้างตาราง fast_moving_parts (หรือตารางที่ใช้สำหรับรายงานอะไหล่หมุนเร็ว)
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'fast_moving_parts'
ORDER BY ordinal_position;

-- 2) ค้นหาทุกตารางที่มีคำว่า fast_moving / fastmoving
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name ILIKE '%fast%' OR table_name ILIKE '%moving%' OR table_name ILIKE '%หมุน%');

-- 3) ค้นหา column ที่มีคำว่า nakhonluang / นครหลวง / branch / source
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name ILIKE '%nakhon%'
    OR column_name ILIKE '%branch%'
    OR column_name ILIKE '%source%'
    OR column_name ILIKE '%store%'
    OR column_name ILIKE '%stock%');

-- 4) ดูข้อมูลตัวอย่าง 5 แถวใน fast_moving_parts (ถ้ามี)
SELECT * FROM fast_moving_parts LIMIT 5;

-- 5) ถ้ายังไม่มี column สำหรับ นครหลวง ให้เพิ่ม:
-- ALTER TABLE fast_moving_parts ADD COLUMN IF NOT EXISTS is_stock_nakhonluang BOOLEAN DEFAULT FALSE;
-- CREATE INDEX IF NOT EXISTS idx_fast_moving_nakhonluang ON fast_moving_parts (is_stock_nakhonluang);
