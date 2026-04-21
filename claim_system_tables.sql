-- ตารางระบบเคลม (พร้อม status tracking 7 ขั้นตอน)
CREATE TABLE IF NOT EXISTS claim_reports (
    id SERIAL PRIMARY KEY,
    claim_no VARCHAR(50) NOT NULL UNIQUE,      -- เลขที่ใบเคลมภายใน (ระบบสร้าง)
    doc_date DATE NOT NULL,
    contact_name VARCHAR(200),
    phone VARCHAR(30),
    brand VARCHAR(50),
    car_model VARCHAR(100),
    engine_chassis_no VARCHAR(100),
    mileage NUMERIC(10, 0),
    technician VARCHAR(100),
    customer_complaint TEXT,
    mechanic_finding TEXT,
    branch_code VARCHAR(20),
    branch_name VARCHAR(200),
    created_by VARCHAR(200),

    -- Status tracking (checklist)
    status VARCHAR(30) DEFAULT 'pending',
    -- 1) ส่งเคลมแล้ว
    submitted BOOLEAN DEFAULT FALSE,
    submit_date DATE,
    submit_claim_no VARCHAR(50),               -- เลขที่ใบเคลมของศูนย์ (ภายนอก)
    -- 2) รับอะไหล่เคลม
    parts_received BOOLEAN DEFAULT FALSE,
    parts_received_date DATE,
    -- 3) แจ้งนัดหมายลูกค้า
    appointment_notified BOOLEAN DEFAULT FALSE,
    appointment_date DATE,
    appointment_note TEXT,
    -- 4) ปิด JOB เคลม
    job_closed BOOLEAN DEFAULT FALSE,
    job_closed_date DATE,
    job_no VARCHAR(50),
    -- 5) แจ้งคืนซาก
    scrap_returned BOOLEAN DEFAULT FALSE,
    scrap_returned_date DATE,
    -- 6) รับชำระเงินค่าเคลม
    payment_received BOOLEAN DEFAULT FALSE,
    payment_received_date DATE,
    payment_amount NUMERIC(15, 2) DEFAULT 0,

    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_reports_date ON claim_reports (doc_date);
CREATE INDEX IF NOT EXISTS idx_claim_reports_status ON claim_reports (status);
CREATE INDEX IF NOT EXISTS idx_claim_reports_branch ON claim_reports (branch_code);
CREATE INDEX IF NOT EXISTS idx_claim_reports_submit_no ON claim_reports (submit_claim_no);

-- รายการอะไหล่ในใบเคลม
CREATE TABLE IF NOT EXISTS claim_items (
    item_id SERIAL PRIMARY KEY,
    claim_id INTEGER NOT NULL REFERENCES claim_reports(id) ON DELETE CASCADE,
    line_no INTEGER DEFAULT 1,
    part_code VARCHAR(100),
    part_name VARCHAR(200),
    quantity NUMERIC(10, 2) DEFAULT 1,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_claim_items_claim ON claim_items (claim_id);

-- รูปภาพแนบใบเคลม (เก็บ base64)
CREATE TABLE IF NOT EXISTS claim_images (
    image_id SERIAL PRIMARY KEY,
    claim_id INTEGER NOT NULL REFERENCES claim_reports(id) ON DELETE CASCADE,
    file_name VARCHAR(200),
    mime_type VARCHAR(100),
    image_data TEXT,
    file_size INTEGER,
    image_type VARCHAR(30),                    -- before/after/damage/receipt/other
    uploaded_by VARCHAR(200),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_images_claim ON claim_images (claim_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_claim_reports_updated_at ON claim_reports;
CREATE TRIGGER trg_claim_reports_updated_at
    BEFORE UPDATE ON claim_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ถ้ารันแล้วมีตารางเก่าที่ไม่มี column ใหม่ ให้รัน ALTER TABLE นี้
ALTER TABLE claim_reports
    ADD COLUMN IF NOT EXISTS brand VARCHAR(50),
    ADD COLUMN IF NOT EXISTS submitted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS submit_date DATE,
    ADD COLUMN IF NOT EXISTS submit_claim_no VARCHAR(50),
    ADD COLUMN IF NOT EXISTS parts_received BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS parts_received_date DATE,
    ADD COLUMN IF NOT EXISTS appointment_notified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS appointment_date DATE,
    ADD COLUMN IF NOT EXISTS appointment_note TEXT,
    ADD COLUMN IF NOT EXISTS job_closed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS job_closed_date DATE,
    ADD COLUMN IF NOT EXISTS job_no VARCHAR(50),
    ADD COLUMN IF NOT EXISTS scrap_returned BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS scrap_returned_date DATE,
    ADD COLUMN IF NOT EXISTS payment_received BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS payment_received_date DATE,
    ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(15, 2) DEFAULT 0;
