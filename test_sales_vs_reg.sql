SELECT
  CASE WHEN s.branch_code = '00000' THEN 'SCY01' ELSE s.branch_code END AS branch_code,
  CASE WHEN s.branch_code = '00000' THEN 'ศูนย์ยามาฮ่า' ELSE s.branch_name END AS sales_branch,
  s.last_month_sales,
  COALESCE(r.current_month_reg, 0) AS current_month_reg
FROM (
  SELECT branch_code, MAX(branch_name) AS branch_name, COUNT(*) AS last_month_sales
  FROM moto_sales
  WHERE sale_date >= '2026-03-01' AND sale_date < '2026-04-01'
  GROUP BY branch_code
) s
LEFT JOIN (
  SELECT
    CASE branch_name
      WHEN 'ศูนย์ยามาฮ่า' THEN '00000'
      WHEN 'สีขวา' THEN 'SCY04'
      WHEN 'สิีขวา' THEN 'SCY04'
      WHEN 'ป.เปา นครหลวง' THEN 'SCY05'
      WHEN 'ป.เปา วังน้อย' THEN 'SCY06'
      WHEN 'สิงห์ชัยตลาด' THEN 'SCY07'
      WHEN 'สิงห์์ชัยตลาด' THEN 'SCY07'
      WHEN 'สิงห์ชััยตลาด' THEN 'SCY07'
      ELSE 'OTHER'
    END AS branch_code,
    COUNT(*) AS current_month_reg
  FROM vehicle_registrations
  WHERE registered_date >= '2026-04-01' AND registered_date < '2026-05-01'
  GROUP BY branch_code
) r ON s.branch_code = r.branch_code
ORDER BY s.branch_code;
