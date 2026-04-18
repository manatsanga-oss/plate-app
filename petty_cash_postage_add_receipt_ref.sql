-- เพิ่ม column อ้างอิงใบรับเงินรายได้อื่นๆ + หมายเหตุ
ALTER TABLE petty_cash_postage_items
    ADD COLUMN IF NOT EXISTS receipt_customer VARCHAR(200),
    ADD COLUMN IF NOT EXISTS note TEXT;

CREATE INDEX IF NOT EXISTS idx_petty_cash_postage_items_receipt
    ON petty_cash_postage_items (receipt_no);
