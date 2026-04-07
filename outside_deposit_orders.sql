-- ตารางระบบสั่งซื้ออะไหล่นอกเงินมัดจำ
-- Header
CREATE TABLE IF NOT EXISTS outside_deposit_orders (
  order_id        SERIAL PRIMARY KEY,
  doc_no          VARCHAR(30) UNIQUE,           -- เลขที่ใบสั่งซื้อ (auto-gen)
  customer_name   VARCHAR(200),                 -- ชื่อลูกค้า
  customer_phone  VARCHAR(30),                  -- เบอร์โทรศัพท์
  job_no          VARCHAR(50),                  -- เลขที่ใบงาน/ใบขาย
  technician      VARCHAR(100),                 -- ช่างซ่อม
  model_name      VARCHAR(100),                 -- รุ่นรถ
  status          VARCHAR(20) DEFAULT 'รอดำเนินการ',
  created_by      VARCHAR(100),
  branch          VARCHAR(100),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Items
CREATE TABLE IF NOT EXISTS outside_deposit_items (
  item_id     SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES outside_deposit_orders(order_id) ON DELETE CASCADE,
  part_code   VARCHAR(50),    -- รหัสสินค้า
  part_name   VARCHAR(200),   -- ชื่ออะไหล่
  quantity    INTEGER DEFAULT 1,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outside_deposit_items_order ON outside_deposit_items(order_id);
CREATE INDEX IF NOT EXISTS idx_outside_deposit_orders_created ON outside_deposit_orders(created_at DESC);
