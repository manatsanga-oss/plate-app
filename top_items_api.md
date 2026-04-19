# Top 10 วัสดุเบิกมากที่สุด - API

เพิ่ม 2 field ใน response ของ action `get_dashboard` (workflow `office-api`):
- `top_items_singchai` — top 10 สังกัด SCY01/SCY04/SCY07
- `top_items_ppao` — top 10 สังกัด SCY05/SCY06

## SQL สำหรับเพิ่มใน node ที่ query dashboard

```sql
-- Top 10 วัสดุเบิกมากที่สุด แยกสังกัด
WITH issue_agg AS (
  SELECT
    ii.item_id,
    si.item_code,
    si.item_name,
    CASE
      WHEN ih.branch_code IN ('SCY01','SCY04','SCY07') THEN 'singchai'
      WHEN ih.branch_code IN ('SCY05','SCY06') THEN 'ppao'
      ELSE 'other'
    END AS grp,
    SUM(ii.qty) AS total_qty,
    SUM(ii.qty * COALESCE(ii.unit_price, si.unit_price, 0)) AS total_value
  FROM office_issue_items ii
  JOIN office_issue_header ih ON ih.issue_id = ii.issue_id
  JOIN office_stock_items si ON si.item_id = ii.item_id
  WHERE ih.issue_date >= date_trunc('month', $1::date)
    AND ih.issue_date < date_trunc('month', $1::date) + interval '1 month'
  GROUP BY ii.item_id, si.item_code, si.item_name, grp
)
SELECT grp, item_code, item_name, total_qty, total_value
FROM (
  SELECT grp, item_code, item_name, total_qty, total_value,
    ROW_NUMBER() OVER (PARTITION BY grp ORDER BY total_qty DESC) AS rn
  FROM issue_agg
) t
WHERE rn <= 10 AND grp IN ('singchai','ppao')
ORDER BY grp, rn
```

> ⚠️ ปรับชื่อ table/column ตามโครงสร้างจริง (office_issue_items, office_issue_header, office_stock_items อาจชื่อไม่ตรงในระบบของคุณ)

## ใน Code node (สรุปรวมกับ dashboard response)

```javascript
const existing = $input.first().json; // ผลเดิมจาก get_dashboard
const topRows = $('Query Top Items').all().map(i => i.json);

const top_items_singchai = topRows.filter(r => r.grp === 'singchai');
const top_items_ppao = topRows.filter(r => r.grp === 'ppao');

return [{ json: { ...existing, top_items_singchai, top_items_ppao } }];
```

## Response ตัวอย่าง

```json
{
  "singchai": { "item_count": 32, "total_qty": 104, "total_value": 7062.38 },
  "ppao": { ... },
  "branch_usage": [ ... ],
  "top_items_singchai": [
    { "item_code": "A001", "item_name": "กระดาษ A4", "total_qty": 50, "total_value": 5000 },
    ...
  ],
  "top_items_ppao": [ ... ]
}
```
