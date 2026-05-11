-- ============================================================
-- ตาราง รายงานช่างที่ซ่อม-ละเอียด HONDA (UPSERT)
-- จาก CSV DMS: SVR04040
-- ============================================================
CREATE TABLE IF NOT EXISTS honda_repair_jobs (
  id              SERIAL PRIMARY KEY,
  job_no          TEXT NOT NULL,        -- เลขที่ JOB เช่น 69SERV/0001408
  mechanic_code   TEXT,                 -- รหัสช่าง (เช่น 10109)
  mechanic_name   TEXT,                 -- ชื่อช่าง
  open_date       DATE,                 -- วันที่รับ JOB
  close_date      DATE,                 -- วันที่ปิด JOB
  service_type    TEXT,                 -- ประเภทบริการ
  parts_amount    NUMERIC(14,2),        -- ค่าสินค้า
  labor_amount    NUMERIC(14,2),        -- ค่าบริการ
  frt             NUMERIC(14,2),        -- FRT
  discount        NUMERIC(14,2),        -- ส่วนลด
  total_net       NUMERIC(14,2),        -- รวมสุทธิ
  vat             NUMERIC(14,2),        -- VAT
  net_sale        NUMERIC(14,2),        -- ขายสุทธิ
  branch_code     TEXT,                 -- รหัสสาขา (option)
  branch_name     TEXT,                 -- ชื่อสาขา (จาก header)
  uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_hrj_job UNIQUE (job_no)
);
CREATE INDEX IF NOT EXISTS idx_hrj_close       ON honda_repair_jobs(close_date);
CREATE INDEX IF NOT EXISTS idx_hrj_mechanic    ON honda_repair_jobs(mechanic_code);
CREATE INDEX IF NOT EXISTS idx_hrj_service     ON honda_repair_jobs(service_type);
CREATE INDEX IF NOT EXISTS idx_hrj_branch      ON honda_repair_jobs(branch_code);
