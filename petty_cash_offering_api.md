# Petty Cash Offering (ค่าของไหว้) - API

เพิ่ม actions ใน n8n workflow `petty-cash-api` (ใช้ pattern เดียวกับ general)

## 1. Run SQL

```
petty_cash_offering_tables.sql
```

## 2. เพิ่ม 6 routes ใน Route Action

| action | outputKey |
|---|---|
| `get_offering_docs` | `get_offering_docs` |
| `save_offering_doc` | `save_offering_doc` |
| `save_offering_items` | `save_offering_items` |
| `approve_offering_doc` | `approve_offering_doc` |
| `delete_offering_doc` | `delete_offering_doc` |
| `unapprove_offering_doc` | `unapprove_offering_doc` |

## 3. Queries / Code

### Query Offering Docs
```sql
SELECT d.id, d.doc_no, d.doc_date, d.branch_name, d.company_name,
  d.created_by, d.position, d.period_from, d.period_to,
  d.total_amount, d.status, d.created_at,
  COALESCE((
    SELECT json_agg(json_build_object(
      'item_id', i.item_id,
      'offering_date', i.offering_date,
      'description', i.description,
      'amount', i.amount,
      'note', i.note
    ) ORDER BY i.offering_date, i.item_id)
    FROM petty_cash_offering_items i WHERE i.doc_id = d.id
  ), '[]'::json) AS items
FROM petty_cash_offering d
ORDER BY d.created_at DESC
LIMIT 100
```

### Build Save Offering Doc (Code)
```javascript
const b = $input.first().json.body || $input.first().json;
const s = v => String(v || '').replace(/'/g, "''").trim();
const sql = `INSERT INTO petty_cash_offering (doc_no, doc_date, branch_code, branch_name, company_name, created_by, position, period_from, period_to)
VALUES ('${s(b.doc_no)}', '${s(b.doc_date)}', '${s(b.branch_code)}', '${s(b.branch_name)}', '${s(b.company_name)}', '${s(b.created_by)}', '${s(b.position)}', '${s(b.period_from)}', '${s(b.period_to)}')
RETURNING id`;
return [{ json: { query: sql } }];
```

### Build Save Offering Items (Code)
```javascript
const b = $input.first().json.body || $input.first().json;
const esc = v => String(v || '').replace(/'/g, "''").trim();
const items = Array.isArray(b.items) ? b.items : [];
if (items.length === 0) return [{ json: { query: `SELECT 'no items'` } }];
const vals = items.map(i => `(${Number(b.doc_id)}, ${i.offering_date ? "'" + esc(i.offering_date) + "'" : 'NULL'}, '${esc(i.description)}', ${Number(i.amount) || 0}, '${esc(i.note)}')`).join(',\n');
const sql = `DELETE FROM petty_cash_offering_items WHERE doc_id=${Number(b.doc_id)};
INSERT INTO petty_cash_offering_items (doc_id, offering_date, description, amount, note) VALUES ${vals};
UPDATE petty_cash_offering SET total_amount=(SELECT COALESCE(SUM(amount),0) FROM petty_cash_offering_items WHERE doc_id=${Number(b.doc_id)}) WHERE id=${Number(b.doc_id)}
RETURNING id, total_amount`;
return [{ json: { query: sql } }];
```

### Approve / Unapprove / Delete (Postgres)
```sql
-- approve
UPDATE petty_cash_offering SET status='approved', approved_at=NOW() WHERE id={{ $json.body.id }}

-- unapprove
UPDATE petty_cash_offering SET status='pending', approved_at=NULL WHERE id={{ $json.body.id }}

-- delete
DELETE FROM petty_cash_offering WHERE id={{ $json.body.id }}
```

### Respond (ทุก action)
```
={{ JSON.stringify($input.all().map(i => i.json)) }}
```
หรือสำหรับ single: `={{ JSON.stringify($json) }}`

## Flow pattern

```
Switch (ตาม action)
  ├─ get_offering_docs → Query Docs → Respond
  ├─ save_offering_doc → Build SQL → Postgres → Respond (คืน id)
  ├─ save_offering_items → Build SQL → Postgres → Respond (คืน total)
  ├─ approve_offering_doc → UPDATE → Respond
  ├─ delete_offering_doc → DELETE → Respond
  └─ unapprove_offering_doc → UPDATE → Respond
```
