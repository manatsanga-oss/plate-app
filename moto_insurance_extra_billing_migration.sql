-- เพิ่ม column สำหรับเชื่อมกับใบวางบิล + บันทึกจ่าย
ALTER TABLE motoinsurance_extra_expenses
  ADD COLUMN IF NOT EXISTS billing_doc_no       TEXT,
  ADD COLUMN IF NOT EXISTS billed_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billed_by            TEXT,
  ADD COLUMN IF NOT EXISTS record_batch_no      TEXT,
  ADD COLUMN IF NOT EXISTS paid_doc_no          TEXT,
  ADD COLUMN IF NOT EXISTS paid_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method       TEXT,
  ADD COLUMN IF NOT EXISTS payment_note         TEXT,
  ADD COLUMN IF NOT EXISTS paid_to_vendor       TEXT,
  ADD COLUMN IF NOT EXISTS from_bank_account_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_miee_billing ON motoinsurance_extra_expenses(billing_doc_no);
CREATE INDEX IF NOT EXISTS idx_miee_batch   ON motoinsurance_extra_expenses(record_batch_no);
CREATE INDEX IF NOT EXISTS idx_miee_paid    ON motoinsurance_extra_expenses(paid_doc_no);
