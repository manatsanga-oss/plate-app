SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS spare_parts_orders (
  order_id          SERIAL PRIMARY KEY,
  order_type        VARCHAR(20) NOT NULL,
  ref_order_id      INTEGER REFERENCES spare_parts_orders(order_id),
  deposit_doc_no    VARCHAR(30),
  customer_code     VARCHAR(20),
  customer_name     VARCHAR(200),
  vin               VARCHAR(50),
  deposit_amount    NUMERIC(12,2) DEFAULT 0,
  technician        VARCHAR(100),
  model_name        VARCHAR(100),
  parking_status    VARCHAR(20),
  status            VARCHAR(20) DEFAULT 'รอดำเนินการ',
  created_by        VARCHAR(100),
  branch            VARCHAR(100),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spare_parts_items (
  item_id           SERIAL PRIMARY KEY,
  order_id          INTEGER NOT NULL REFERENCES spare_parts_orders(order_id),
  part_name         VARCHAR(200),
  quantity          INTEGER DEFAULT 1,
  unit_price        NUMERIC(12,2) DEFAULT 0,
  total_price       NUMERIC(12,2) DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW()
);
