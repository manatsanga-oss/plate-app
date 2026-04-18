-- ตรวจว่ามีรายได้ค่าไปรษณีย์ในฐานข้อมูลไหม
-- 1) ดูทุกแถวที่ description คล้ายกับค่าไปรษณีย์/บริการ
SELECT
  oi.receipt_no,
  oi.receipt_date,
  oi.branch_code,
  oi.customer_name,
  oii.description,
  oii.total AS amount
FROM other_income oi
JOIN other_income_items oii ON oii.receipt_no = oi.receipt_no
WHERE oii.description ILIKE '%ไปรษณีย%'
   OR oii.description ILIKE '%ems%'
   OR oii.description ILIKE '%ค่าส่ง%'
   OR oii.description ILIKE '%ค่าบริการ%'
ORDER BY oi.receipt_date DESC, oi.receipt_no DESC;

-- 2) นับจำนวนรวม
SELECT COUNT(*) AS total_rows
FROM other_income_items
WHERE description ILIKE '%ไปรษณีย%'
   OR description ILIKE '%ems%'
   OR description ILIKE '%ค่าส่ง%'
   OR description ILIKE '%ค่าบริการ%';

-- 3) นับแยกตามสาขา
SELECT
  oi.branch_code,
  COUNT(*) AS total,
  SUM(oii.total) AS total_amount
FROM other_income oi
JOIN other_income_items oii ON oii.receipt_no = oi.receipt_no
WHERE oii.description ILIKE '%ไปรษณีย%'
   OR oii.description ILIKE '%ems%'
   OR oii.description ILIKE '%ค่าส่ง%'
   OR oii.description ILIKE '%ค่าบริการ%'
GROUP BY oi.branch_code
ORDER BY oi.branch_code;

-- 4) ดู description ที่มีอยู่ทั้งหมด (top 50 ที่ถูกใช้บ่อย) — ช่วยหา keyword
SELECT
  description,
  COUNT(*) AS times
FROM other_income_items
GROUP BY description
ORDER BY times DESC
LIMIT 50;
