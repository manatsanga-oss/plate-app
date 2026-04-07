CREATE TABLE IF NOT EXISTS part_substitutes (
  id SERIAL PRIMARY KEY,
  original_code VARCHAR(50) NOT NULL,
  substitute_code VARCHAR(50) NOT NULL,
  original_name VARCHAR(200),
  substitute_name VARCHAR(200),
  order_id INTEGER,
  approved_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
