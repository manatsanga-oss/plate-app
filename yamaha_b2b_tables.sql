SET client_encoding = 'UTF8';

-- ลบตารางเก่า (ถ้ามี)
DROP TABLE IF EXISTS yamaha_b2b_orders;
DROP TABLE IF EXISTS yamaha_b2b_backorders;

-- ตารางการสั่งซื้ออะไหล่ Yamaha B2B (UPSERT)
CREATE TABLE yamaha_b2b_orders (
  id                    SERIAL PRIMARY KEY,
  apc_order_no          VARCHAR(100),     -- รหัสผู้จำหน่าย
  customer_order_no     VARCHAR(100),     -- ชื่อคลังสินค้า (เลขที่ใบสั่งซื้อของลูกค้า)
  order_date            DATE,             -- วันที่สั่งซื้อ
  line_no               INTEGER,          -- ลำดับ
  part_number           VARCHAR(100),     -- รหัสอะไหล่ที่สั่งซื้อ
  received_part_number  VARCHAR(100),     -- รหัสอะไหล่ที่ได้รับ
  part_description      VARCHAR(255),     -- ชื่ออะไหล่
  order_qty             NUMERIC(12,2) DEFAULT 0,  -- จำนวนสั่งซื้อ
  net_price             NUMERIC(12,2) DEFAULT 0,  -- รวมราคาขาย
  delivery_date         DATE,                     -- วันที่คาดว่าอะไหล่จะได้รับ
  created_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE(apc_order_no, line_no, part_number)
);

CREATE INDEX idx_yb2b_orders_apc ON yamaha_b2b_orders(apc_order_no);
CREATE INDEX idx_yb2b_orders_part ON yamaha_b2b_orders(part_number);

-- ตารางอะไหล่ค้างส่ง Yamaha B2B (DELETE + INSERT)
CREATE TABLE yamaha_b2b_backorders (
  id                    SERIAL PRIMARY KEY,
  apc_order_no          VARCHAR(100),     -- รหัสผู้จำหน่าย
  customer_order_no     VARCHAR(100),     -- ชื่อคลังสินค้า
  order_date            DATE,             -- วันที่สั่งซื้อ
  line_no               INTEGER,          -- ลำดับ
  part_number           VARCHAR(100),     -- รหัสอะไหล่ที่สั่งซื้อ
  received_part_number  VARCHAR(100),     -- รหัสอะไหล่ที่ได้รับ
  part_description      VARCHAR(255),     -- ชื่ออะไหล่
  order_qty             NUMERIC(12,2) DEFAULT 0,  -- จำนวนสั่งซื้อ
  backorder_qty         NUMERIC(12,2) DEFAULT 0,  -- จำนวนค้างส่ง
  backorder_amount      NUMERIC(12,2) DEFAULT 0,  -- ยอดเงินค้างส่ง
  net_price             NUMERIC(12,2) DEFAULT 0,  -- ราคาสุทธิ/หน่วย
  delivery_date         DATE,                     -- วันที่คาดว่าอะไหล่จะได้รับ
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_yb2b_bo_apc ON yamaha_b2b_backorders(apc_order_no);
CREATE INDEX idx_yb2b_bo_part ON yamaha_b2b_backorders(part_number);
