-- ลบข้อมูลทั้งหมดในตารางระบบสั่งซื้ออะไหล่นอกเงินมัดจำ
-- (รีเซ็ต order_id กลับเป็น 1)
TRUNCATE TABLE outside_deposit_items, outside_deposit_orders RESTART IDENTITY CASCADE;
