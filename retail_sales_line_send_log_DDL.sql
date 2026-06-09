-- Track LINE send history per retail sale (auto-send หลังบันทึกขาย/อัปโหลดเอกสาร)
ALTER TABLE retail_sales
  ADD COLUMN IF NOT EXISTS line_send_log JSONB DEFAULT '[]'::jsonb;

-- index สำหรับ query
CREATE INDEX IF NOT EXISTS idx_retail_sales_line_send_log
  ON retail_sales USING GIN (line_send_log);

COMMENT ON COLUMN retail_sales.line_send_log IS
  'Array ของ {type, status, at, by, error} - type: sale|receipt|act|cosmos, status: sent|failed|cancelled';
