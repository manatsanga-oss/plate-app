SET client_encoding = 'UTF8';

ALTER TABLE moto_bookings
  ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(50);
