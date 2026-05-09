-- ตารางบันทึกการจ่ายดอกเบี้ย/ต้นของบัญชีเงินกู้
-- 1 record = 1 ครั้งของการจ่าย — สามารถมีทั้งดอกเบี้ยและเงินต้นในครั้งเดียวกัน

CREATE TABLE IF NOT EXISTS loan_interest_payments (
  payment_id            SERIAL PRIMARY KEY,
  loan_id               INTEGER NOT NULL,                   -- FK -> loan_accounts.loan_id
  payment_date          DATE    NOT NULL,
  interest_amount       NUMERIC(15,2) NOT NULL DEFAULT 0,   -- ยอดดอกเบี้ย
  principal_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,   -- ยอดเงินต้น (จะหัก current_balance)
  total_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,   -- รวม (interest + principal)
  from_bank_account_id  INTEGER,                            -- FK -> bank_accounts.account_id
  payment_method        VARCHAR(20)   DEFAULT 'โอน',        -- โอน / เงินสด / เช็ค / หักบัญชี
  note                  TEXT,
  status                VARCHAR(20)   NOT NULL DEFAULT 'active',  -- active / cancelled
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by            VARCHAR(100),
  cancelled_at          TIMESTAMP,
  cancelled_by          VARCHAR(100),
  CONSTRAINT fk_lip_loan FOREIGN KEY (loan_id) REFERENCES loan_accounts(loan_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_lip_loan      ON loan_interest_payments (loan_id);
CREATE INDEX IF NOT EXISTS idx_lip_date      ON loan_interest_payments (payment_date);
CREATE INDEX IF NOT EXISTS idx_lip_status    ON loan_interest_payments (status);
CREATE INDEX IF NOT EXISTS idx_lip_bank      ON loan_interest_payments (from_bank_account_id);

COMMENT ON TABLE loan_interest_payments IS 'บันทึกการจ่ายดอกเบี้ย/ต้นของเงินกู้ — ลด current_balance ของ loan_accounts ตามยอดต้นที่จ่าย';
