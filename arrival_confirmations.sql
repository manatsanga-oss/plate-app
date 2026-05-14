-- ตารางเก็บข้อมูลยืนยันถึงที่หมายจากคนขับผ่าน LIFF
CREATE TABLE IF NOT EXISTS arrival_confirmations (
  id              BIGSERIAL PRIMARY KEY,
  booking_id      INTEGER NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  driver_user_id  VARCHAR(64),                      -- LINE userId จาก liff.getProfile()
  driver_name     VARCHAR(255),                     -- displayName จาก profile
  lat             NUMERIC(10, 7) NOT NULL,          -- พิกัดจริงตอนกดยืนยัน
  lng             NUMERIC(10, 7) NOT NULL,
  accuracy        REAL,                             -- ค่าความแม่นยำ GPS (เมตร)
  dest_lat        NUMERIC(10, 7),                   -- พิกัดปลายทาง (snapshot ตอนยืนยัน)
  dest_lng        NUMERIC(10, 7),
  distance_from_dest REAL,                          -- ระยะห่างจุดหมาย (เมตร, คำนวณด้วย Haversine)
  is_within_range BOOLEAN,                          -- true ถ้า distance_from_dest <= รัศมีที่ตั้งไว้ (default 200m)
  photo_url       TEXT,                             -- สำหรับ Phase 2 (รูปยืนยัน)
  client_ip       VARCHAR(64),                      -- IP ตอนกด (audit)
  user_agent      TEXT,                             -- UA ตอนกด (audit)
  confirmed_at    TIMESTAMPTZ NOT NULL,             -- timestamp จาก client (ISO)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arrival_booking
  ON arrival_confirmations (booking_id);

CREATE INDEX IF NOT EXISTS idx_arrival_driver_confirmed
  ON arrival_confirmations (driver_user_id, confirmed_at DESC);

CREATE INDEX IF NOT EXISTS idx_arrival_confirmed_at
  ON arrival_confirmations (confirmed_at DESC);

-- กันยืนยันซ้ำในงานเดิม ภายใน 5 นาที (ป้องกัน rapid double-tap)
-- หมายเหตุ: ใช้ partial unique index แทน — Postgres ไม่รองรับ time-window unique โดยตรง
-- ถ้าต้องการเข้มกว่านี้ ให้เช็คใน application/n8n ก่อน INSERT

-- เพิ่ม column ใน bookings เพื่อ track สถานะถึงที่หมายล่าสุด (denormalized สำหรับ query เร็ว)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrived_within_range BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_bookings_arrived_at
  ON bookings (arrived_at DESC) WHERE arrived_at IS NOT NULL;
