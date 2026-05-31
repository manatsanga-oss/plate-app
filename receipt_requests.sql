-- ตารางคำขอออกใบเสร็จผ่าน QR + LINE LIFF
-- พนักงานสร้าง ref_no -> พิมพ์ QR -> ลูกค้าสแกนเข้า LIFF กรอกข้อมูล -> พนักงานออกใบเสร็จจาก ref_no

CREATE TABLE IF NOT EXISTS receipt_requests (
  id            BIGSERIAL PRIMARY KEY,
  ref_no        TEXT NOT NULL UNIQUE,            -- เลขที่ QR เช่น RC-20260531-0001
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | filled | issued | cancelled

  -- ข้อมูลที่ลูกค้ากรอกผ่าน LIFF
  customer_name TEXT,
  address       TEXT,
  phone         TEXT,
  tax_id        TEXT,                            -- เลขผู้เสียภาษี (ถ้ามี/นิติบุคคล)

  -- ข้อมูลจาก LINE (ได้จาก liff.getProfile())
  line_user_id      TEXT,
  line_display_name TEXT,

  -- ตอนออกใบเสร็จ
  invoice_no    TEXT,                            -- เลขใบเสร็จที่ออกจริง
  issued_by     TEXT,
  issued_at     TIMESTAMPTZ,

  -- เมตา
  branch_code   TEXT,
  branch_name   TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  filled_at     TIMESTAMPTZ,
  note          TEXT
);

CREATE INDEX IF NOT EXISTS idx_receipt_requests_status     ON receipt_requests (status);
CREATE INDEX IF NOT EXISTS idx_receipt_requests_created_at ON receipt_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_requests_phone      ON receipt_requests (phone);
