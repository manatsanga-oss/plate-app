-- Backfill cleared_by_payment_no สำหรับ advance_expenses ที่เคลียร์ไปแล้วก่อน migration
-- (ก่อนหน้านี้ระบบ clear แค่ status='cleared' แต่ไม่ได้บันทึก payment_no)
--
-- วิธีรัน: แก้ค่า doc_no + payment_no ให้ตรงเคสจริงของคุณ แล้วรันทีละบรรทัด

-- ตัวอย่าง: ADV-260528-002 ถูกเคลียร์ด้วย PAY-260603-001
UPDATE advance_expenses
   SET cleared_by_payment_no = 'PAY-260603-001'
 WHERE doc_no = 'ADV-260528-002'
   AND status = 'cleared'
   AND cleared_by_payment_no IS NULL;

-- ดูรายการที่ยังต้อง backfill:
-- SELECT doc_no, payee_name, amount, cleared_at, cleared_by, cleared_by_payment_no
--   FROM advance_expenses
--  WHERE status = 'cleared' AND cleared_by_payment_no IS NULL
--  ORDER BY cleared_at DESC;
