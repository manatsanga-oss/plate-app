SET client_encoding = 'UTF8';

ALTER TABLE moto_bookings
  ADD COLUMN IF NOT EXISTS deposit_action    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS refund_account_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS refund_bank       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS refund_amount     NUMERIC(12, 2);
