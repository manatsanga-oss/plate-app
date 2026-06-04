-- ตารางค่าใช้จ่ายจ่ายล่วงหน้า (advance / prepaid expenses)
-- สถานะ: pending = รอเคลียร์ · cleared = เคลียร์แล้ว · cancelled = ยกเลิก
CREATE TABLE IF NOT EXISTS advance_expenses (
  id           SERIAL PRIMARY KEY,
  doc_no       TEXT UNIQUE NOT NULL,          -- ADV-YYMMDD-XXX (gen ตอน insert)
  doc_date     DATE NOT NULL,                 -- วันที่จ่ายล่วงหน้า
  vendor_id    INTEGER,                       -- อ้างอิง Supplier (vendor_id) ที่เลือก
  payee_name   TEXT NOT NULL,                 -- ชื่อผู้รับเงิน (= ชื่อ Supplier ที่เลือก)
  amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ method, amount, bank_account_id }] · method='โอน' มีผลกับการเคลื่อนไหวบัญชี
  description  TEXT,
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','cleared','cancelled')),
  cleared_at   TIMESTAMPTZ,                   -- เวลาเคลียร์
  cleared_by   TEXT,
  cleared_by_payment_no TEXT,                 -- เลขที่ใบจ่ายเงินที่เคลียร์ใบนี้ (link กับ registration_submissions.paid_doc_no)
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advance_expenses_date   ON advance_expenses (doc_date);
CREATE INDEX IF NOT EXISTS idx_advance_expenses_status ON advance_expenses (status);
CREATE INDEX IF NOT EXISTS idx_advance_expenses_payee  ON advance_expenses (payee_name);
CREATE INDEX IF NOT EXISTS idx_advance_expenses_payment ON advance_expenses (cleared_by_payment_no);

-- migration: เพิ่มคอลัมน์ใหม่ใน DB เดิม
ALTER TABLE advance_expenses ADD COLUMN IF NOT EXISTS cleared_by_payment_no TEXT;
