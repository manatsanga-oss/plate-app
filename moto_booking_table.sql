SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS moto_bookings (
  booking_id    SERIAL PRIMARY KEY,
  booking_date  DATE DEFAULT CURRENT_DATE,
  branch        VARCHAR(100),
  brand         VARCHAR(50),
  marketing_name VARCHAR(100),
  model_code    VARCHAR(50),
  color_name    VARCHAR(50),
  customer_name VARCHAR(100),
  customer_phone VARCHAR(20),
  purchase_type VARCHAR(20),
  deposit_no    VARCHAR(50),
  finance_company VARCHAR(100),
  status        VARCHAR(20) DEFAULT 'จอง',
  sold_date     DATE,
  cancelled_date DATE,
  cancel_reason TEXT,
  new_model_code VARCHAR(50),
  new_color_name VARCHAR(50),
  created_at    TIMESTAMP DEFAULT NOW()
);
