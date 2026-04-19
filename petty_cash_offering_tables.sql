-- ตารางค่าของไหว้ (ใบสรุป + รายการย่อย)
CREATE TABLE IF NOT EXISTS petty_cash_offering (
    id SERIAL PRIMARY KEY,
    doc_no VARCHAR(50) NOT NULL UNIQUE,
    doc_date DATE NOT NULL,
    branch_code VARCHAR(20),
    branch_name VARCHAR(200),
    company_name VARCHAR(200),
    created_by VARCHAR(200),
    position VARCHAR(100),
    period_from DATE,
    period_to DATE,
    total_amount NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_offering_date ON petty_cash_offering (doc_date);
CREATE INDEX IF NOT EXISTS idx_petty_cash_offering_branch ON petty_cash_offering (branch_code);
CREATE INDEX IF NOT EXISTS idx_petty_cash_offering_status ON petty_cash_offering (status);

CREATE TABLE IF NOT EXISTS petty_cash_offering_items (
    item_id SERIAL PRIMARY KEY,
    doc_id INTEGER NOT NULL REFERENCES petty_cash_offering(id) ON DELETE CASCADE,
    offering_date DATE,
    description TEXT,
    amount NUMERIC(15, 2) DEFAULT 0,
    note TEXT
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_offering_items_doc ON petty_cash_offering_items (doc_id);
