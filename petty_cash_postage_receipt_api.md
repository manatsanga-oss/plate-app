# Petty Cash Postage - ลิงก์ใบรับเงิน (รายได้อื่นๆ)

อ้างอิงเฉพาะ **เลขที่ใบรับเงิน** + **ชื่อลูกค้า**

## ขั้นตอนใช้งาน

1. Run SQL: `petty_cash_postage_add_receipt_ref.sql`
2. แก้ n8n workflow `petty-cash-api` ตามด้านล่าง
3. Deploy frontend (`PettyCashPostagePage.jsx` แก้ไขแล้ว)

---

## n8n `petty-cash-api` — เพิ่ม / แก้ action

### 1) เพิ่ม action ใหม่: `get_available_postage_receipts`

**Input:**
```json
{ "action": "get_available_postage_receipts", "branch_code": "SCY06" }
```

**SQL (Postgres node – Execute Query):**
```sql
SELECT
  oi.receipt_no,
  oi.receipt_date,
  oi.customer_name,
  oii.description,
  oii.total AS amount
FROM other_income oi
JOIN other_income_items oii ON oii.receipt_no = oi.receipt_no
WHERE oi.branch_code = '{{ $json.body.branch_code }}'
  AND (
    oii.description ILIKE '%ไปรษณีย%'
    OR oii.description ILIKE '%ems%'
    OR oii.description ILIKE '%ค่าส่ง%'
    OR oii.description ILIKE '%ค่าบริการ%'
  )
  AND oi.receipt_no NOT IN (
    SELECT DISTINCT receipt_no
    FROM petty_cash_postage_items
    WHERE receipt_no IS NOT NULL AND receipt_no <> ''
  )
ORDER BY oi.receipt_date DESC, oi.receipt_no DESC
```

---

### 2) แก้ action `save_postage_items`

เพิ่ม 2 columns: `receipt_no`, `receipt_customer`

**Code node:**
```javascript
const docId = $input.first().json.body.doc_id;
const items = $input.first().json.body.items || [];
function s(v) { if (v == null || String(v).trim() === '') return 'NULL'; return "'" + String(v).replace(/'/g, "''") + "'"; }
function n(v) { const x = Number(v); return isNaN(x) ? '0' : String(x); }

const values = items.map(it =>
  '(' + [
    docId, s(it.post_date), s(it.description), s(it.recipient_name),
    s(it.tracking_no), s(it.destination), n(it.amount),
    s(it.receipt_no), s(it.receipt_customer)
  ].join(', ') + ')'
).join(', ');

return [{ json: {
  sql: `DELETE FROM petty_cash_postage_items WHERE doc_id = ${docId};
        INSERT INTO petty_cash_postage_items
          (doc_id, post_date, description, recipient_name, tracking_no, destination, amount, receipt_no, receipt_customer)
        VALUES ${values};
        UPDATE petty_cash_postage SET total_amount = (
          SELECT COALESCE(SUM(amount), 0) FROM petty_cash_postage_items WHERE doc_id = ${docId}
        ) WHERE id = ${docId};`
}}];
```

---

### 3) แก้ action `get_postage_docs`

SELECT items เพิ่ม `receipt_no`, `receipt_customer`:
```sql
SELECT
  id, post_date, description, recipient_name, tracking_no, destination, amount,
  receipt_no, receipt_customer
FROM petty_cash_postage_items
WHERE doc_id = $1
ORDER BY id
```
