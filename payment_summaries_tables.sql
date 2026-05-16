-- ============================================================
-- ตารางใบสรุปยอดรับเงิน
-- ใช้รวบยอดรายรับ (เลือกหลาย charge รวมเป็น 1 ใบสรุปสำหรับส่งบัญชี)
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_summaries (
  summary_id     SERIAL PRIMARY KEY,
  summary_no     TEXT UNIQUE NOT NULL,            -- เลขที่ใบสรุป SU{yymmdd}{seq} เช่น SU680516001
  date_from      DATE,                            -- ช่วงวันที่ filter ตอนสรุป
  date_to        DATE,
  group_by       TEXT,                            -- day | month | branch | creator | type
  total_amount   NUMERIC(12, 2) NOT NULL,
  total_count    INTEGER NOT NULL,
  breakdown      JSONB,                           -- breakdown ตาม group: [{key, label, total, count}, ...]
  note           TEXT,
  branch_code    TEXT,
  branch_name    TEXT,
  created_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_summaries_created_at ON payment_summaries(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_summaries_branch_code ON payment_summaries(branch_code);

-- เชื่อม payments → payment_summaries (1 charge อยู่ได้ใน 1 ใบสรุปเท่านั้น)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS summary_id INTEGER REFERENCES payment_summaries(summary_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_summary_id ON payments(summary_id);
