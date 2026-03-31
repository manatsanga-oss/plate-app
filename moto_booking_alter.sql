-- เพิ่ม columns สำหรับการยกเลิก (deposit/refund)
ALTER TABLE moto_bookings
  ADD COLUMN IF NOT EXISTS deposit_action     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS refund_account_no  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS refund_bank        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS refund_amount      NUMERIC(12,2);

-- ลบแถว pending เก่า (ข้อมูลทดสอบที่ไม่ต้องการ)
DELETE FROM moto_bookings WHERE status = 'pending';
