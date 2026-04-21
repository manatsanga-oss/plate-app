# Claim System API (ระบบการเคลม)

สร้าง n8n workflow ใหม่ชื่อ **Claim API** — webhook path: `claim-api`

## 7 Actions ที่ต้องมี

| action | ทำอะไร |
|---|---|
| `get_claims` | ดึงรายการใบเคลมทั้งหมด + items |
| `save_claim` | สร้างใบเคลมใหม่ + items |
| `update_claim` | แก้ไขใบเคลม + items |
| `delete_claim` | ลบใบเคลม (CASCADE) |
| `upload_claim_image` | อัปโหลดรูป (base64) |
| `get_claim_images` | ดึงรูปของใบเคลม |
| `delete_claim_image` | ลบรูป |

## Flow

```
Webhook (POST /claim-api)
  → Switch ตาม body.action
    ├─ get_claims → Query + Respond
    ├─ save_claim → Code (Build SQL) → Execute → Respond id
    ├─ update_claim → Code → Execute → Respond
    ├─ delete_claim → DELETE → Respond
    ├─ upload_claim_image → INSERT → Respond
    ├─ get_claim_images → SELECT → Respond
    └─ delete_claim_image → DELETE → Respond
```

## SQL Queries

### get_claims
```sql
SELECT c.*,
  COALESCE((
    SELECT json_agg(json_build_object(
      'item_id', i.item_id,
      'part_code', i.part_code,
      'part_name', i.part_name,
      'quantity', i.quantity,
      'remark', i.remark
    ) ORDER BY i.line_no, i.item_id)
    FROM claim_items i WHERE i.claim_id = c.id
  ), '[]'::json) AS items,
  (SELECT COUNT(*) FROM claim_images WHERE claim_id = c.id) AS image_count
FROM claim_reports c
ORDER BY c.created_at DESC
LIMIT 200
```

> หมายเหตุ: columns เพิ่มเติมสำหรับ tracking 6 ขั้นตอน (ส่งเคลม/รับอะไหล่/นัดหมาย/ปิดJOB/คืนซาก/ชำระเงิน) ต้องใส่ใน UPDATE/INSERT ด้วย — ดู SQL ใน `claim_system_tables.sql`

### save_claim (Code node)
```javascript
const b = $input.first().json.body;
const esc = v => String(v || '').replace(/'/g, "''");
const pad = n => String(n).padStart(2, '0');
const now = new Date();
const claimNo = `CLM${(now.getFullYear() + 543).toString().slice(-2)}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

const items = Array.isArray(b.items) ? b.items : [];
const itemValues = items.map((i, idx) =>
  `(${idx + 1}, '${esc(i.part_code)}', '${esc(i.part_name)}', ${Number(i.quantity) || 1}, '${esc(i.remark)}')`
).join(',');

const sql = `
WITH inserted AS (
  INSERT INTO claim_reports
    (claim_no, doc_date, contact_name, phone, car_model, engine_chassis_no, mileage,
     technician, customer_complaint, mechanic_finding, branch_code, branch_name, created_by, status, note)
  VALUES
    ('${claimNo}', '${b.doc_date}', '${esc(b.contact_name)}', '${esc(b.phone)}',
     '${esc(b.car_model)}', '${esc(b.engine_chassis_no)}', ${Number(b.mileage) || 0},
     '${esc(b.technician)}', '${esc(b.customer_complaint)}', '${esc(b.mechanic_finding)}',
     '${esc(b.branch_code)}', '${esc(b.branch_name)}', '${esc(b.created_by)}',
     '${esc(b.status || 'pending')}', '${esc(b.note)}')
  RETURNING id
)
${items.length > 0 ? `, items AS (
  INSERT INTO claim_items (claim_id, line_no, part_code, part_name, quantity, remark)
  SELECT id, v.line_no, v.part_code, v.part_name, v.quantity, v.remark
  FROM inserted, (VALUES ${itemValues.replace(/\(/g, '(').replace(/'/g, "'")}) AS v(line_no, part_code, part_name, quantity, remark)
  RETURNING claim_id
)` : ''}
SELECT id, '${claimNo}' AS claim_no FROM inserted`;
return [{ json: { query: sql, claim_no: claimNo } }];
```

### update_claim (Code node)
```javascript
const b = $input.first().json.body;
const esc = v => String(v || '').replace(/'/g, "''");
const id = Number(b.id);
const items = Array.isArray(b.items) ? b.items : [];
const itemValues = items.map((i, idx) =>
  `(${id}, ${idx + 1}, '${esc(i.part_code)}', '${esc(i.part_name)}', ${Number(i.quantity) || 1}, '${esc(i.remark)}')`
).join(',');

let sql = `UPDATE claim_reports SET
  doc_date='${b.doc_date}', contact_name='${esc(b.contact_name)}', phone='${esc(b.phone)}',
  car_model='${esc(b.car_model)}', engine_chassis_no='${esc(b.engine_chassis_no)}',
  mileage=${Number(b.mileage) || 0}, technician='${esc(b.technician)}',
  customer_complaint='${esc(b.customer_complaint)}', mechanic_finding='${esc(b.mechanic_finding)}',
  status='${esc(b.status || 'pending')}', note='${esc(b.note)}'
WHERE id=${id};
DELETE FROM claim_items WHERE claim_id=${id};`;
if (items.length > 0) {
  sql += ` INSERT INTO claim_items (claim_id, line_no, part_code, part_name, quantity, remark) VALUES ${itemValues};`;
}
sql += ` SELECT ${id} AS id`;
return [{ json: { query: sql, id } }];
```

### delete_claim
```sql
DELETE FROM claim_reports WHERE id = {{ $json.body.id }} RETURNING id
```

### upload_claim_image
```sql
INSERT INTO claim_images (claim_id, file_name, mime_type, image_data, file_size, uploaded_by)
VALUES ({{ $json.body.claim_id }}, '{{ $json.body.file_name }}', '{{ $json.body.mime_type }}',
  '{{ $json.body.image_data }}', {{ $json.body.file_size }}, '{{ $json.body.uploaded_by }}')
RETURNING image_id
```

### get_claim_images
```sql
SELECT image_id, file_name, mime_type, image_data, file_size, uploaded_by, uploaded_at
FROM claim_images
WHERE claim_id = {{ $json.body.claim_id }}
ORDER BY uploaded_at DESC
```

### delete_claim_image
```sql
DELETE FROM claim_images WHERE image_id = {{ $json.body.image_id }} RETURNING image_id
```

## Respond to Webhook

- สำหรับ array (get_claims, get_claim_images): 
  ```
  ={{ JSON.stringify($input.all().map(i => i.json)) }}
  ```
- สำหรับ single (save/update/delete):
  ```
  ={{ JSON.stringify($json) }}
  ```

## CORS Headers
```
Access-Control-Allow-Origin: *
```

## ขั้นตอนใช้งาน
1. Run `claim_system_tables.sql` ใน PG
2. สร้าง workflow ใหม่ใน n8n ตามโครงที่อธิบาย
3. Activate
4. รีเฟรชหน้าเว็บ เข้า Spare Parts → Claim System → ระบบการเคลม
