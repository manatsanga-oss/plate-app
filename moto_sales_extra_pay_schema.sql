-- ============================================================
-- ระบบขายรถ — Extra Payment Rules ผูกกับตาราง types ที่มีอยู่แล้ว
-- ============================================================

-- กฎค่าใช้จ่ายพิเศษต่อ type (มี effective_date)
-- payment_type: advance = เงินดาวน์/ค่างวดออกแทน
--               commission = ค่าคอมพิเศษ
CREATE TABLE IF NOT EXISTS moto_extra_payment_rules (
  rule_id        SERIAL PRIMARY KEY,
  type_id        INTEGER NOT NULL,   -- FK ไปตาราง types (master-data-api)
  payment_type   TEXT NOT NULL CHECK (payment_type IN ('advance','commission')),
  amount         NUMERIC(14,2) NOT NULL,
  effective_date DATE NOT NULL,
  end_date       DATE,
  note           TEXT,
  active         BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  created_by     TEXT
);
CREATE INDEX IF NOT EXISTS idx_meprules_type
  ON moto_extra_payment_rules(type_id, payment_type, effective_date DESC);

-- helper: ดึงกฎ active ณ วันที่ระบุ
CREATE OR REPLACE FUNCTION get_active_extra_rule(
  p_type_id INT, p_payment_type TEXT, p_at_date DATE
) RETURNS NUMERIC AS $$
DECLARE amt NUMERIC;
BEGIN
  SELECT amount INTO amt
  FROM moto_extra_payment_rules
  WHERE type_id = p_type_id
    AND payment_type = p_payment_type
    AND active = TRUE
    AND effective_date <= p_at_date
    AND (end_date IS NULL OR end_date >= p_at_date)
  ORDER BY effective_date DESC LIMIT 1;
  RETURN COALESCE(amt, 0);
END;
$$ LANGUAGE plpgsql;
