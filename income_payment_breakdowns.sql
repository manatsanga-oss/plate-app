-- ตารางบันทึกการแบ่งวิธีรับเงินต่อใบรับเงิน (Multi-method income payment breakdown)
-- 1 paid_doc_no (IRC-...) สามารถมีหลายแถว — แต่ละแถวคือ 1 วิธีรับเงินพร้อมจำนวนเงิน

CREATE TABLE IF NOT EXISTS income_payment_breakdowns (
  pb_id                 SERIAL PRIMARY KEY,
  paid_doc_no           VARCHAR(50)   NOT NULL,             -- เลขที่ใบรับเงิน (IRC-...)
  method                VARCHAR(20)   NOT NULL,             -- โอน / เงินสด / เช็ค / ใบลดหนี้
  amount                NUMERIC(12,2) NOT NULL DEFAULT 0,
  from_bank_account_id  INTEGER,                            -- เฉพาะ method=โอน → บัญชีที่รับเงินเข้า
  credit_note_no        VARCHAR(50),                        -- เฉพาะ method=ใบลดหนี้ → ref credit_notes_received
  seq                   INT           NOT NULL DEFAULT 1,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ipb_paid_doc ON income_payment_breakdowns (paid_doc_no);
CREATE INDEX IF NOT EXISTS idx_ipb_method   ON income_payment_breakdowns (method);
CREATE INDEX IF NOT EXISTS idx_ipb_credit_note ON income_payment_breakdowns (credit_note_no);

COMMENT ON TABLE income_payment_breakdowns IS 'แตกย่อยวิธีการรับเงินต่อใบรับเงิน — รองรับการรับผสม (โอน+เงินสด+ใบลดหนี้) ในใบเดียว';
