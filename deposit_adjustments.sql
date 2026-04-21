-- ตารางบันทึกปรับปรุงเงินมัดจำ (ผิดประเภท)
-- ใช้บันทึกใบมัดจำที่รับเงินผิดประเภท (ค่ารถ/ป้ายแดง) ให้ไม่แสดงในสั่งซื้ออะไหล่
CREATE TABLE IF NOT EXISTS deposit_adjustments (
    id SERIAL PRIMARY KEY,
    deposit_doc_no VARCHAR(50) NOT NULL UNIQUE,
    adjust_type VARCHAR(100) NOT NULL,  -- 'มัดจำค่ารถ' | 'มัดจำป้ายแดง' | 'อื่นๆ'
    customer_name VARCHAR(200),
    remark TEXT,
    created_by VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_adjustments_doc_no ON deposit_adjustments (deposit_doc_no);
CREATE INDEX IF NOT EXISTS idx_deposit_adjustments_type ON deposit_adjustments (adjust_type);
