-- ตาราง Master Data สำหรับ "บัญชีเงินกู้ยืม"
-- เก็บข้อมูลรายละเอียดของแต่ละบัญชีเงินกู้ (เจ้าหนี้, ยอดต้น, ดอก, วันครบกำหนด)

CREATE TABLE IF NOT EXISTS loan_accounts (
  loan_id            SERIAL PRIMARY KEY,
  loan_name          VARCHAR(200) NOT NULL,                  -- ชื่อบัญชี เช่น "เงินกู้กสิกร 1"
  lender             VARCHAR(200),                            -- เจ้าหนี้ (บุคคล/ธนาคาร/บริษัท)
  loan_type          VARCHAR(50),                             -- ประเภท: ธนาคาร / บุคคล / นิติบุคคล / อื่นๆ
  account_no         VARCHAR(50),                             -- เลขที่สัญญา/เลขที่บัญชี (ถ้ามี)
  principal          NUMERIC(15,2) NOT NULL DEFAULT 0,        -- ยอดเงินต้น (จำนวนที่กู้)
  current_balance    NUMERIC(15,2) NOT NULL DEFAULT 0,        -- ยอดคงเหลือ (ปรับเองได้)
  interest_rate      NUMERIC(7,4)  NOT NULL DEFAULT 0,        -- อัตราดอกเบี้ย (%)
  interest_period    VARCHAR(20)   NOT NULL DEFAULT 'ปี',     -- เดือน / ปี
  start_date         DATE,                                    -- วันเริ่มต้น
  due_date           DATE,                                    -- วันครบกำหนด
  payment_schedule   VARCHAR(100),                            -- เงื่อนไขผ่อน เช่น "ผ่อน 24 งวด"
  note               TEXT,                                    -- หมายเหตุ
  status             VARCHAR(20)   NOT NULL DEFAULT 'active', -- active / paid / cancelled
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by         VARCHAR(100),
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loan_status   ON loan_accounts (status);
CREATE INDEX IF NOT EXISTS idx_loan_lender   ON loan_accounts (lender);
CREATE INDEX IF NOT EXISTS idx_loan_due_date ON loan_accounts (due_date);

COMMENT ON TABLE loan_accounts IS 'บัญชีเงินกู้ยืม — Master Data รายละเอียดเงินกู้';
