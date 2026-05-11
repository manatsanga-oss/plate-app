-- ============================================================
-- ตาราง upload ใบแจ้งซ่อม Yamaha (UPSERT)
-- 39 columns ตามไฟล์ Excel ต้นฉบับ
-- ============================================================
CREATE TABLE IF NOT EXISTS yamaha_repair_invoices (
  id                   SERIAL PRIMARY KEY,
  branch_code          TEXT,
  branch_name          TEXT,
  job_no               TEXT NOT NULL,        -- เลขที่ใบแจ้งซ่อม
  repair_day           INTEGER,
  repair_month         INTEGER,
  repair_year          INTEGER,
  close_day            INTEGER,
  close_month          INTEGER,
  close_year           INTEGER,
  status               TEXT,                 -- สถานะใบแจ้งซ่อม
  brand                TEXT,
  series               TEXT,                 -- รุ่น
  model_code           TEXT,                 -- แบบ
  color                TEXT,
  engine_no            TEXT,
  chassis_no           TEXT,
  license_plate        TEXT,
  cc                   TEXT,
  vehicle_type         TEXT,                 -- ชนิด
  mileage              TEXT,                 -- ระยะ
  customer             TEXT,
  customer_tax_id      TEXT,
  customer_phone       TEXT,
  bay_no               TEXT,                 -- แท่นซ่อม
  mechanic_code        TEXT,
  mechanic_name        TEXT,
  item_type            TEXT,                 -- ประเภทรายการ
  net_revenue          NUMERIC(14,2),
  outstanding          NUMERIC(14,2),
  repair_type_code     TEXT,
  repair_type          TEXT,
  flat_rate            NUMERIC(14,2),
  labor_price          NUMERIC(14,2),
  labor_discount       NUMERIC(14,2),
  labor_total          NUMERIC(14,2),
  report_name          TEXT,
  report_mc_cc_type    TEXT,
  report_date_start    DATE,
  report_date_stop     DATE,
  uploaded_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_yri_job_item UNIQUE (job_no, item_type, repair_type_code, mechanic_code)
);

CREATE INDEX IF NOT EXISTS idx_yri_job        ON yamaha_repair_invoices(job_no);
CREATE INDEX IF NOT EXISTS idx_yri_branch     ON yamaha_repair_invoices(branch_code);
CREATE INDEX IF NOT EXISTS idx_yri_repair_y_m ON yamaha_repair_invoices(repair_year, repair_month);
CREATE INDEX IF NOT EXISTS idx_yri_close_y_m  ON yamaha_repair_invoices(close_year, close_month);
CREATE INDEX IF NOT EXISTS idx_yri_chassis    ON yamaha_repair_invoices(chassis_no);
CREATE INDEX IF NOT EXISTS idx_yri_mechanic   ON yamaha_repair_invoices(mechanic_code);
