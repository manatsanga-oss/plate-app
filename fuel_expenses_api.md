# Fuel Expenses API - รายงานการเบิกค่าน้ำมัน

เพิ่ม action ใหม่ใน n8n workflow `booking-api` เพื่อดึงข้อมูลการเบิกค่าน้ำมัน
จากตาราง `daily_expenses` กรองเฉพาะ `payment_type = '031:ค่าน้ำมัน/แก๊สรถใช้งาน'`

---

## Route Action - เพิ่ม rule

```json
{
  "action": "get_fuel_expenses",
  "outputKey": "get_fuel_expenses"
}
```

---

## Postgres Node - Query Fuel Expenses

**Query** (prefix ด้วย `=`):

```sql
=SELECT
  id,
  payment_no,
  payment_date,
  pay_to,
  payment_type,
  detail,
  cash,
  transfer,
  check_amount,
  withholding_tax,
  credit_note,
  others,
  total_amount,
  prepared_by,
  status,
  note
FROM daily_expenses
WHERE payment_type ILIKE '%031%น้ำมัน%'
  {{ $json.body.from ? `AND payment_date >= '${$json.body.from}'` : '' }}
  {{ $json.body.to ? `AND payment_date <= '${$json.body.to}'` : '' }}
  {{ $json.body.branch_code ? `AND payment_no LIKE '${$json.body.branch_code}-%'` : '' }}
ORDER BY payment_date DESC, payment_no DESC
LIMIT 500
```

**ทางเลือก** (ถ้า expression ใน query ซับซ้อน): ใช้ Code node สร้าง SQL ก่อน แล้วส่งต่อ Postgres:

```javascript
const b = $input.first().json.body || {};
const conds = ["payment_type ILIKE '%031%น้ำมัน%'"];
if (b.from) conds.push(`payment_date >= '${b.from}'`);
if (b.to) conds.push(`payment_date <= '${b.to}'`);
if (b.branch_code) conds.push(`payment_no LIKE '${b.branch_code}-%'`);
const sql = `SELECT * FROM daily_expenses WHERE ${conds.join(' AND ')} ORDER BY payment_date DESC, payment_no DESC LIMIT 500`;
return [{ json: { query: sql } }];
```

แล้วใน Postgres node ใส่ `={{ $json.query }}` เป็น query

---

## Respond to Webhook

```
={{ JSON.stringify($input.all().map(i => i.json)) }}
```

(เพื่อส่งเป็น array ไม่ใช่ object เดียว)

---

## ตัวอย่าง Request

```json
{
  "action": "get_fuel_expenses",
  "from": "2026-03-01",
  "to": "2026-03-31",
  "branch_code": "SCY06"
}
```

ถ้า admin ส่ง `branch_code: null` จะเห็นทุกสาขา
