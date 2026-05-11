-- ============================================================
-- ตาราง master ของสาขา + เป้าการขาย
-- ============================================================
CREATE TABLE IF NOT EXISTS branch_master (
  branch_code   TEXT PRIMARY KEY,
  branch_name   TEXT,
  affiliation   TEXT,            -- ป.เปา / สิงห์ชัย
  sales_target  INTEGER,         -- เป้าการขายต่อเดือน
  note          TEXT,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    TEXT
);

-- seed ข้อมูลเริ่มต้นจากที่ hard-code ในระบบ (ปรับได้ภายหลัง)
INSERT INTO branch_master (branch_code, branch_name, affiliation, sales_target) VALUES
('SCY01', 'ศูนย์ยามาฮ่า',    'สิงห์ชัย', 100),
('SCY04', 'สีขวา',           'สิงห์ชัย',  50),
('SCY05', 'ป.เปา นครหลวง',   'ป.เปา',    20),
('SCY06', 'ป.เปา วังน้อย',   'ป.เปา',    40),
('SCY07', 'สิงห์ชัยตลาด',    'สิงห์ชัย',  50)
ON CONFLICT (branch_code) DO NOTHING;
