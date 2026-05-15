-- ============================================================
-- ตารางรับชำระเงิน QR PromptPay (เชื่อมกับ Omise / Opn Payments)
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
  payment_id      SERIAL PRIMARY KEY,
  charge_id       TEXT UNIQUE NOT NULL,            -- omise charge id (chrg_xxx)
  source_id       TEXT,                            -- omise source id (src_xxx)
  payment_type    TEXT NOT NULL,                   -- 'general' | 'repair'
  ref_no          TEXT,                            -- เลขใบงาน/ใบซ่อมที่อ้างอิง
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT,
  description     TEXT,
  amount          NUMERIC(12, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'THB',
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed | expired | cancelled
  qr_image        TEXT,                            -- URL ของ QR PromptPay (จาก Omise)
  expires_at      TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT,
  branch_code     TEXT,
  branch_name     TEXT,
  raw_omise       JSONB                            -- เก็บ payload ดิบจาก Omise สำหรับ audit
);

CREATE INDEX IF NOT EXISTS idx_payments_status        ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at    ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_branch_code   ON payments(branch_code);
CREATE INDEX IF NOT EXISTS idx_payments_ref_no        ON payments(ref_no);

-- trigger update updated_at
CREATE OR REPLACE FUNCTION trg_payments_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION trg_payments_updated_at();
