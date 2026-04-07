SET client_encoding = 'UTF8';

-- ตาราง กลุ่มสินค้า (Product Groups)
CREATE TABLE IF NOT EXISTS product_groups (
  id              SERIAL PRIMARY KEY,
  group_code      VARCHAR(20) UNIQUE NOT NULL,
  group_name      VARCHAR(200) NOT NULL,
  description     VARCHAR(500),
  status          VARCHAR(20) DEFAULT 'active',
  created_by      VARCHAR(100),
  updated_by      VARCHAR(100),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP
);

-- Index สำหรับค้นหาเร็ว
CREATE INDEX IF NOT EXISTS idx_product_groups_code ON product_groups(group_code);
CREATE INDEX IF NOT EXISTS idx_product_groups_status ON product_groups(status);
