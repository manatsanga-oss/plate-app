-- เพิ่มฟิลด์ วันเกิด / เพศ / ยินยอม PDPA ให้ตาราง receipt_requests (สำหรับตารางที่สร้างไว้แล้ว)
ALTER TABLE receipt_requests ADD COLUMN IF NOT EXISTS gender     TEXT;
ALTER TABLE receipt_requests ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE receipt_requests ADD COLUMN IF NOT EXISTS consent    BOOLEAN DEFAULT false;
ALTER TABLE receipt_requests ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
