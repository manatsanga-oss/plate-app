-- ตารางรายได้อื่นๆ (Other Income)
-- Parent: ใบรับเงิน / Child: รายการย่อย

CREATE TABLE IF NOT EXISTS other_income (
    id SERIAL PRIMARY KEY,
    receipt_no VARCHAR(50) NOT NULL UNIQUE,
    receipt_date DATE,
    customer_name VARCHAR(200),
    oc_no VARCHAR(50),
    branch_code VARCHAR(10),
    -- ยอดตามหมวด (Text17..Text23 จาก CSV template)
    amount_text17 NUMERIC(15, 2) DEFAULT 0,
    amount_text61 NUMERIC(15, 2) DEFAULT 0,
    amount_text16 NUMERIC(15, 2) DEFAULT 0,
    amount_text65 NUMERIC(15, 2) DEFAULT 0,
    amount_text54 NUMERIC(15, 2) DEFAULT 0,
    amount_text60 NUMERIC(15, 2) DEFAULT 0,
    amount_text22 NUMERIC(15, 2) DEFAULT 0,
    amount_text30 NUMERIC(15, 2) DEFAULT 0,
    amount_text66 NUMERIC(15, 2) DEFAULT 0,
    amount_text62 NUMERIC(15, 2) DEFAULT 0,
    amount_text23 NUMERIC(15, 2) DEFAULT 0,
    total_amount NUMERIC(15, 2) DEFAULT 0,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_other_income_date ON other_income (receipt_date);
CREATE INDEX IF NOT EXISTS idx_other_income_branch ON other_income (branch_code);
CREATE INDEX IF NOT EXISTS idx_other_income_oc ON other_income (oc_no);

CREATE TABLE IF NOT EXISTS other_income_items (
    id SERIAL PRIMARY KEY,
    receipt_no VARCHAR(50) NOT NULL,
    line_order INT DEFAULT 0,
    description TEXT,
    line_amount NUMERIC(15, 2) DEFAULT 0,
    fee NUMERIC(15, 2) DEFAULT 0,
    quantity NUMERIC(10, 2) DEFAULT 1,
    total NUMERIC(15, 2) DEFAULT 0,
    CONSTRAINT fk_other_income_items_receipt
        FOREIGN KEY (receipt_no) REFERENCES other_income(receipt_no) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_other_income_items_receipt ON other_income_items (receipt_no);
