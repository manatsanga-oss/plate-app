-- 1) โครงสร้างตาราง daily_expenses
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'daily_expenses'
ORDER BY ordinal_position;

-- 2) ตัวอย่างข้อมูลค่าน้ำมัน 20 แถวล่าสุด
SELECT payment_no, payment_date, pay_to, detail, total_amount, note
FROM daily_expenses
WHERE payment_type ILIKE '%031%น้ำมัน%'
ORDER BY payment_date DESC
LIMIT 20;

-- 3) ดูประเภทค่าใช้จ่ายทั้งหมด
SELECT payment_type, COUNT(*) AS total
FROM daily_expenses
GROUP BY payment_type
ORDER BY total DESC
LIMIT 30;

-- 4) note ของค่าน้ำมัน (หาเลขทะเบียน)
SELECT payment_no, payment_date, pay_to, note, total_amount
FROM daily_expenses
WHERE payment_type ILIKE '%031%น้ำมัน%'
  AND note IS NOT NULL AND note <> ''
ORDER BY payment_date DESC
LIMIT 20;
