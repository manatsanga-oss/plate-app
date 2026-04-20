-- เพิ่ม column อะไหล่สต๊อก นครหลวง
ALTER TABLE fast_moving_parts
    ADD COLUMN IF NOT EXISTS is_stock_nakhonluang BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_fast_moving_nakhonluang
    ON fast_moving_parts (is_stock_nakhonluang);

-- ตรวจสอบ
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'fast_moving_parts'
  AND column_name = 'is_stock_nakhonluang';
