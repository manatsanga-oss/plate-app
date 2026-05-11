-- ============================================================
-- CC Settlement schema
-- ============================================================

-- 1) วันหยุดธนาคาร
CREATE TABLE IF NOT EXISTS bank_holidays (
  holiday_date DATE PRIMARY KEY,
  name         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  created_by   TEXT
);

-- 2) Override วันที่เงินเข้า รายบัญชี+วัน
CREATE TABLE IF NOT EXISTS cc_settlement_overrides (
  account_id      INTEGER NOT NULL,
  original_date   DATE    NOT NULL,
  settlement_date DATE    NOT NULL,
  note            TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      TEXT,
  PRIMARY KEY (account_id, original_date)
);

-- 3) function: เลื่อนวันถัดไป (ข้ามเฉพาะ bank_holidays — เสาร์/อาทิตย์ปกติเงินเข้า)
CREATE OR REPLACE FUNCTION next_business_day(d DATE) RETURNS DATE AS $$
DECLARE
  r DATE := d + INTERVAL '1 day';
  guard INT := 0;
BEGIN
  WHILE guard < 30 LOOP
    IF EXISTS (SELECT 1 FROM bank_holidays WHERE holiday_date = r) THEN
      r := r + INTERVAL '1 day';
      guard := guard + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN r;
END;
$$ LANGUAGE plpgsql;
