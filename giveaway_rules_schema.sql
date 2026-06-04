-- ตารางบันทึกของแถม (giveaway rules) — รองรับ 3 ระดับ
-- ระดับยี่ห้อ : brand_id only  → ใช้กับทุกรุ่น/แบบในยี่ห้อนั้น
-- ระดับรุ่น   : brand_id + series_id → ใช้กับทุกแบบของรุ่นนั้น
-- ระดับแบบ   : brand_id + series_id + type_id → specific
-- ไม่ใส่ effective_date/end_date = แถมตลอด
CREATE TABLE IF NOT EXISTS giveaway_rules (
  id              SERIAL PRIMARY KEY,
  brand_id        INTEGER NOT NULL,         -- moto_brands.brand_id (required: บังคับให้ระบุยี่ห้อ)
  series_id       INTEGER,                  -- moto_series.series_id (NULL = ทุกรุ่นในยี่ห้อ)
  type_id         INTEGER,                  -- moto_types.type_id (NULL = ทุกแบบของรุ่น)
  part_code       TEXT NOT NULL,            -- รหัสอะไหล่ที่แถม
  part_name       TEXT,                     -- ชื่ออะไหล่ (snapshot)
  qty             NUMERIC(10,2) NOT NULL DEFAULT 1,
  effective_date  DATE,                     -- วันเริ่มต้น (NULL = ทันที)
  end_date        DATE,                     -- วันสิ้นสุด (NULL = ตลอดไป)
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_giveaway_rules_brand ON giveaway_rules (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_giveaway_rules_series ON giveaway_rules (series_id, status);
CREATE INDEX IF NOT EXISTS idx_giveaway_rules_type ON giveaway_rules (type_id, status);
CREATE INDEX IF NOT EXISTS idx_giveaway_rules_part ON giveaway_rules (part_code);

-- migration: ทำให้ type_id nullable + ทำให้ brand_id required (idempotent)
ALTER TABLE giveaway_rules ALTER COLUMN type_id DROP NOT NULL;
ALTER TABLE giveaway_rules ALTER COLUMN brand_id SET NOT NULL;
