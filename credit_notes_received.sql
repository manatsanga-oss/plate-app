-- ตารางใบลดหนี้รับ (Credit Note Received)
-- บันทึกเอกสารใบลดหนี้ที่ได้รับจาก Vendor แทนการจ่ายเงินสด/โอน
-- อ้างอิงไปยังใบจ่ายเงิน (paid_doc_no) และ/หรือใบวางบิล (billing_doc_no)

CREATE TABLE IF NOT EXISTS credit_notes_received (
  cn_id              SERIAL PRIMARY KEY,
  credit_note_no     VARCHAR(50)   NOT NULL UNIQUE,          -- เลขที่ใบลดหนี้ (auto-gen: CN-YYMMDD-XXX)
  credit_note_date   DATE          NOT NULL,                 -- วันที่ใบลดหนี้

  -- อ้างอิงเอกสารที่นำมาตัดหนี้
  paid_doc_no        VARCHAR(50),                            -- เลขที่ใบจ่าย (PAY-xxx) ที่สร้างจากการบันทึก
  billing_doc_nos    TEXT,                                   -- เลขที่ใบวางบิลที่อ้างอิง (คั่นด้วย ,) — เผื่อกรณีหลายใบ

  -- ข้อมูลเงิน
  vendor_name        VARCHAR(200),                           -- ชื่อ Vendor ที่ออกใบลดหนี้
  amount             NUMERIC(12,2) NOT NULL DEFAULT 0,       -- ยอดเงินที่ลดหนี้
  category           VARCHAR(100),                           -- หมวดค่าใช้จ่าย (เช่น ค่าจดทะเบียน)
  note               TEXT,                                   -- หมายเหตุ

  -- audit
  created_by         VARCHAR(100),
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status             VARCHAR(20) DEFAULT 'active'            -- active / cancelled
);

CREATE INDEX IF NOT EXISTS idx_cn_credit_note_no ON credit_notes_received (credit_note_no);
CREATE INDEX IF NOT EXISTS idx_cn_paid_doc_no    ON credit_notes_received (paid_doc_no);
CREATE INDEX IF NOT EXISTS idx_cn_vendor         ON credit_notes_received (vendor_name);
CREATE INDEX IF NOT EXISTS idx_cn_date           ON credit_notes_received (credit_note_date);

COMMENT ON TABLE credit_notes_received IS 'ใบลดหนี้รับจาก Vendor — ใช้ตัดหนี้แทนการจ่ายเงิน';
