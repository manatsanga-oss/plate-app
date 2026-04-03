SET client_encoding = 'UTF8';

-- ถ้าตารางมีอยู่แล้ว เพิ่มคอลัมน์ source
ALTER TABLE honda_inventory ADD COLUMN IF NOT EXISTS source VARCHAR(20);
ALTER TABLE honda_inventory ADD COLUMN IF NOT EXISTS brand VARCHAR(50);
ALTER TABLE honda_inventory ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- ถ้ายังไม่มีตาราง สร้างใหม่
CREATE TABLE IF NOT EXISTS honda_inventory (
  inv_id            SERIAL PRIMARY KEY,
  item_no           INTEGER,
  product_code      VARCHAR(50),
  product_name      VARCHAR(200),
  brand             VARCHAR(50),
  product_group     VARCHAR(50),
  category          VARCHAR(50),
  location          VARCHAR(50),
  quantity          NUMERIC(12,2) DEFAULT 0,
  unit_price        NUMERIC(12,2) DEFAULT 0,
  total_value       NUMERIC(12,2) DEFAULT 0,
  unit              VARCHAR(20) DEFAULT 'EA',
  source            VARCHAR(20),
  report_date       DATE DEFAULT CURRENT_DATE,
  created_at        TIMESTAMP DEFAULT NOW()
);
