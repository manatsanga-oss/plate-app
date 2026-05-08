-- ตารางบันทึกการแบ่งวิธีจ่ายต่อใบจ่าย (Multi-method payment breakdown)
-- 1 paid_doc_no สามารถมีหลายแถว — แต่ละแถวคือ 1 วิธีจ่ายพร้อมจำนวนเงิน

CREATE TABLE IF NOT EXISTS expense_payment_breakdowns (
  pb_id                 SERIAL PRIMARY KEY,
  paid_doc_no           VARCHAR(50)   NOT NULL,             -- เลขที่ใบจ่าย (EPAY-...)
  method                VARCHAR(20)   NOT NULL,             -- โอน / เงินสด / เช็ค / ใบลดหนี้
  amount                NUMERIC(12,2) NOT NULL DEFAULT 0,
  from_bank_account_id  INTEGER,                            -- เฉพาะ method=โอน
  credit_note_no        VARCHAR(50),                        -- เฉพาะ method=ใบลดหนี้ → reference cn
  seq                   INT           NOT NULL DEFAULT 1,   -- ลำดับใน paid_doc_no
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pb_credit_note FOREIGN KEY (credit_note_no)
    REFERENCES credit_notes_received(credit_note_no) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pb_paid_doc ON expense_payment_breakdowns (paid_doc_no);
CREATE INDEX IF NOT EXISTS idx_pb_method   ON expense_payment_breakdowns (method);
CREATE INDEX IF NOT EXISTS idx_pb_bank     ON expense_payment_breakdowns (from_bank_account_id);

COMMENT ON TABLE expense_payment_breakdowns IS 'แตกย่อยวิธีการจ่ายต่อใบจ่าย — รองรับการจ่ายผสม (โอน+เงินสด+ใบลดหนี้) ในใบจ่ายเดียว';
