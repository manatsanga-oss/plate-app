CREATE TABLE IF NOT EXISTS repair_deposits (
  id SERIAL PRIMARY KEY,
  deposit_doc_no VARCHAR(100) NOT NULL,
  estimate_no VARCHAR(100) NOT NULL,
  customer_name VARCHAR(200),
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
