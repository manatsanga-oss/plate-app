SET client_encoding = 'UTF8';

-- ตารางคนขับรถ
CREATE TABLE IF NOT EXISTS drivers (
  driver_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  license_no VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active'
);

-- ตารางการจองรถ
CREATE TABLE IF NOT EXISTS bookings (
  booking_id SERIAL PRIMARY KEY,
  booker_name VARCHAR(100) NOT NULL,
  branch VARCHAR(100),
  car_model_id INTEGER REFERENCES car_models(model_id),
  driver_id INTEGER REFERENCES drivers(driver_id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  destination VARCHAR(200),
  purpose TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  cancelled_at TIMESTAMP,
  cancel_reason TEXT
);
