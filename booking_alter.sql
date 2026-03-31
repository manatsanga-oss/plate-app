SET client_encoding = 'UTF8';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_date     DATE,
  ADD COLUMN IF NOT EXISTS booking_time     VARCHAR(10),
  ADD COLUMN IF NOT EXISTS delivery_type    VARCHAR(30),
  ADD COLUMN IF NOT EXISTS car_model        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS finance_company  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS distance_text    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS distance_meters  INTEGER,
  ADD COLUMN IF NOT EXISTS destination_formatted TEXT;

-- migrate start_date → booking_date for existing rows
UPDATE bookings SET booking_date = start_date WHERE booking_date IS NULL AND start_date IS NOT NULL;
