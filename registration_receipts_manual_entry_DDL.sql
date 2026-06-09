-- Migration: เพิ่ม column entry_source เพื่อแยกข้อมูลที่ user บันทึก manual กับที่ upload Excel
ALTER TABLE registration_receipts
  ADD COLUMN IF NOT EXISTS entry_source TEXT DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS created_by   TEXT;

-- index สำหรับ filter
CREATE INDEX IF NOT EXISTS idx_reg_receipts_entry_source ON registration_receipts (entry_source);
CREATE INDEX IF NOT EXISTS idx_reg_receipts_branch ON registration_receipts (branch_code);
CREATE INDEX IF NOT EXISTS idx_reg_receipts_receive_date ON registration_receipts (receive_date);

-- ค่า default: ข้อมูลเดิมที่ upload มาก่อนหน้านี้ → entry_source='upload'
UPDATE registration_receipts SET entry_source = 'upload'
 WHERE entry_source IS NULL;
