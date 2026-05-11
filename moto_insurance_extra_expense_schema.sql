-- ============================================================
-- ค่าใช้จ่ายเพิ่มเติมงาน พรบ. (แก้ไข/ยกเลิก พรบ. และอื่น ๆ)
-- ============================================================
CREATE TABLE IF NOT EXISTS motoinsurance_extra_expenses (
  id                  SERIAL PRIMARY KEY,
  expense_type        TEXT NOT NULL,        -- แก้ไข พรบ., ยกเลิก พรบ., อื่น ๆ
  original_policy_no  TEXT,                 -- กรรมธรรม์ที่แก้ไข
  expense_amount      NUMERIC(14,2) NOT NULL,
  payment_receipt_no  TEXT,                 -- เลขที่ใบรับชำระ (เชื่อมกับ other_income.receipt_no)
  note                TEXT,
  active              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          TEXT
);
CREATE INDEX IF NOT EXISTS idx_miee_type    ON motoinsurance_extra_expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_miee_policy  ON motoinsurance_extra_expenses(original_policy_no);
CREATE INDEX IF NOT EXISTS idx_miee_receipt ON motoinsurance_extra_expenses(payment_receipt_no);
CREATE INDEX IF NOT EXISTS idx_miee_created ON motoinsurance_extra_expenses(created_at DESC);
