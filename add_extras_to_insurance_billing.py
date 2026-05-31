"""
รวม motoinsurance_extra_expenses เข้ากับ insurance billing flow
- Code Insurance Billing List SQL: UNION extras (record_type='extra')
- Code Save Insurance Billing: รับ extra_ids แล้วอัพเดต motoinsurance_extra_expenses
- Code Cancel Insurance Billing: clear billing fields ใน extras ด้วย
- Code Cancel Insurance Billing Batch: clear extras ด้วย
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Registrations API.json")
wf = json.loads(src.read_text(encoding='utf-8'))

# ===== 1) List SQL: ขยายให้ดึง extras ด้วย (UNION) =====
list_node = next(x for x in wf['nodes'] if x.get('name')=='Code Insurance Billing List SQL')
list_code = list_node['parameters']['jsCode']

NEW_LIST = r"""const b = $input.first().json.body || {};
const esc = v => String(v == null ? '' : v).replace(/'/g, "''");
const onlyUnbilled = b.only_unbilled !== false;

// ===== ส่วน insurance records ปกติ =====
const conds = [`r.status = 'active'`];
if (onlyUnbilled) conds.push('r.billing_doc_no IS NULL');
if (b.date_from) conds.push(`r.contract_date >= '${esc(b.date_from)}'::date`);
if (b.date_to) conds.push(`r.contract_date <= '${esc(b.date_to)}'::date`);
const where = 'WHERE ' + conds.join(' AND ');

const insuranceQuery = `SELECT r.*, CASE WHEN jsonb_array_length(COALESCE(r.claimed_items, '[]'::jsonb)) > 0 THEN r.claimed_items ELSE COALESCE(auto.items, '[]'::jsonb) END AS claimed_items, CASE WHEN COALESCE(r.amount_received, 0) > 0 THEN r.amount_received ELSE COALESCE(auto.total, 0) END AS amount_received, (jsonb_array_length(COALESCE(r.claimed_items, '[]'::jsonb)) > 0) AS has_claim, 'insurance'::text AS record_type FROM moto_insurance_records r LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('item_id', i.id, 'description', i.description, 'amount', i.line_amount, 'fee', i.fee, 'total', i.total) ORDER BY i.line_order) AS items, SUM(COALESCE(i.total, i.line_amount, 0)) AS total FROM other_income_items i JOIN other_income oi ON oi.receipt_no = i.receipt_no WHERE oi.receipt_no = r.receipt_no AND i.description ILIKE '%พรบ%') auto ON TRUE ${where} ORDER BY r.record_batch_no DESC NULLS LAST, r.insurance_id DESC`;

// ===== ส่วน extras: ทำให้ schema เข้ากันได้กับ insurance =====
const eConds = [`e.active = TRUE`];
if (onlyUnbilled) eConds.push('e.billing_doc_no IS NULL');
if (b.date_from) eConds.push(`e.created_at::date >= '${esc(b.date_from)}'::date`);
if (b.date_to) eConds.push(`e.created_at::date <= '${esc(b.date_to)}'::date`);
const eWhere = 'WHERE ' + eConds.join(' AND ');

// คอลัมน์ขั้นต่ำที่ frontend ใช้ (จับคู่กับ insurance)
const extraQuery = `SELECT
  e.id AS insurance_id,
  e.payment_receipt_no AS receipt_no,
  e.original_policy_no AS app_no,
  NULL::date AS contract_date,
  NULL::date AS expiry_date,
  NULL::text AS chassis_no,
  NULL::text AS license_plate,
  oi.customer_name AS customer_name,
  oi.branch_code AS branch_code,
  e.expense_amount AS total_premium,
  e.expense_amount AS amount_received,
  e.expense_type AS insurance_type,
  e.note AS note,
  e.billing_doc_no,
  e.billed_at,
  e.record_batch_no,
  e.paid_doc_no,
  e.paid_at,
  e.payment_method,
  e.paid_to_vendor,
  e.from_bank_account_id,
  'active'::text AS status,
  e.created_at,
  '[]'::jsonb AS claimed_items,
  FALSE AS has_claim,
  'extra'::text AS record_type
  FROM motoinsurance_extra_expenses e
  LEFT JOIN other_income oi ON oi.receipt_no = e.payment_receipt_no
  ${eWhere}`;

const query = `(${insuranceQuery}) UNION ALL (${extraQuery}) ORDER BY record_batch_no DESC NULLS LAST, insurance_id DESC LIMIT 5000`;
return [{ json: { query } }];"""

list_node['parameters']['jsCode'] = NEW_LIST
print("OK: updated Code Insurance Billing List SQL (UNION extras)")

# ===== 2) Save SQL: handle insurance_ids + extra_ids =====
save_node = next(x for x in wf['nodes'] if x.get('name')=='Code Save Insurance Billing')
NEW_SAVE = r"""const b = $input.first().json.body || {};
const insIds = (b.insurance_ids || []).map(Number).filter(n => Number.isFinite(n) && n > 0);
const exIds = (b.extra_ids || []).map(Number).filter(n => Number.isFinite(n) && n > 0);
if (insIds.length === 0 && exIds.length === 0) throw new Error('insurance_ids or extra_ids required');
const doc = String(b.billing_doc_no || '').replace(/'/g, "''");
if (!doc) throw new Error('billing_doc_no required');
const by = String(b.billed_by || '').replace(/'/g, "''");
const batch = String(b.record_batch_no || '').replace(/'/g, "''");

const parts = [];
if (insIds.length > 0) {
  parts.push(`UPDATE moto_insurance_records SET billing_doc_no = '${doc}', billed_at = NOW(), billed_by = '${by}', updated_at = NOW() WHERE insurance_id IN (${insIds.join(',')}) AND billing_doc_no IS NULL`);
}
if (exIds.length > 0) {
  parts.push(`UPDATE motoinsurance_extra_expenses SET billing_doc_no = '${doc}', billed_at = NOW(), billed_by = '${by}'${batch ? `, record_batch_no = '${batch}'` : ''} WHERE id IN (${exIds.join(',')}) AND billing_doc_no IS NULL`);
}
parts.push(`SELECT '${doc}' AS billing_doc_no, ${insIds.length} AS insurance_count, ${exIds.length} AS extra_count`);
const query = parts.join('; ');
return [{ json: { query } }];"""
save_node['parameters']['jsCode'] = NEW_SAVE
print("OK: updated Code Save Insurance Billing (insurance_ids + extra_ids)")

# ===== 3) Cancel SQL: clear both tables =====
cancel_node = next(x for x in wf['nodes'] if x.get('name')=='Code Cancel Insurance Billing')
NEW_CANCEL = r"""const b = $input.first().json.body || {};
const doc = String(b.billing_doc_no || '').replace(/'/g, "''");
if (!doc) throw new Error('billing_doc_no required');
const query = `UPDATE moto_insurance_records SET billing_doc_no = NULL, billed_at = NULL, billed_by = NULL, updated_at = NOW() WHERE billing_doc_no = '${doc}'; UPDATE motoinsurance_extra_expenses SET billing_doc_no = NULL, billed_at = NULL, billed_by = NULL, record_batch_no = NULL WHERE billing_doc_no = '${doc}'; SELECT '${doc}' AS billing_doc_no`;
return [{ json: { query } }];"""
cancel_node['parameters']['jsCode'] = NEW_CANCEL
print("OK: updated Code Cancel Insurance Billing")

# ===== 4) Cancel Batch SQL: clear extras too =====
cancel_batch = next((x for x in wf['nodes'] if x.get('name')=='Code Cancel Insurance Billing Batch'), None)
if cancel_batch:
    NEW_CANCEL_BATCH = r"""const b = $input.first().json.body || {};
const batchNo = String(b.record_batch_no || '').replace(/'/g, "''").trim();
if (!batchNo) throw new Error('record_batch_no required');
const query = `
WITH upd AS (
  UPDATE moto_insurance_records
  SET billing_doc_no = NULL, billed_at = NULL, billed_by = NULL,
      paid_at = NULL, paid_doc_no = NULL, payment_method = NULL,
      payment_note = NULL, paid_to_vendor = NULL, wht_rate = NULL,
      wht_amount = NULL, from_bank_account_id = NULL, updated_at = NOW()
  WHERE record_batch_no = '${batchNo}'
    AND (billed_at IS NOT NULL OR billing_doc_no IS NOT NULL)
  RETURNING insurance_id
),
upd_extra AS (
  UPDATE motoinsurance_extra_expenses
  SET billing_doc_no = NULL, billed_at = NULL, billed_by = NULL,
      record_batch_no = NULL,
      paid_doc_no = NULL, paid_at = NULL, payment_method = NULL,
      payment_note = NULL, paid_to_vendor = NULL, from_bank_account_id = NULL
  WHERE record_batch_no = '${batchNo}'
  RETURNING id
)
SELECT (SELECT COUNT(*) FROM upd) AS cancelled_insurance, (SELECT COUNT(*) FROM upd_extra) AS cancelled_extra`;
return [{ json: { query } }];"""
    cancel_batch['parameters']['jsCode'] = NEW_CANCEL_BATCH
    print("OK: updated Code Cancel Insurance Billing Batch")

src.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print("\nOK: saved Registrations API.json")
