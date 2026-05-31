"""
นำการเปลี่ยนแปลงไป apply กับ Registrations API (8).json
- ไม่แก้ position
- แก้แค่ jsCode ของ 4 nodes:
  1. Code Insurance Billing List SQL (UNION extras + JOIN moto_sales/registration_submission_items)
  2. Code Save Insurance Billing (รับ insurance_ids + extra_ids)
  3. Code Cancel Insurance Billing (clear ทั้ง 2 tables)
  4. Code Cancel Insurance Billing Batch (clear ทั้ง 2 tables)
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Registrations API (8).json")
wf = json.loads(src.read_text(encoding='utf-8'))

# ===== 1) Code Insurance Billing List SQL =====
NEW_LIST = r"""const b = $input.first().json.body || {};
const esc = v => String(v == null ? '' : v).replace(/'/g, "''");
const onlyUnbilled = b.only_unbilled !== false;

const conds = [`r.status = 'active'`];
if (onlyUnbilled) conds.push('r.billing_doc_no IS NULL');
if (b.date_from) conds.push(`r.contract_date >= '${esc(b.date_from)}'::date`);
if (b.date_to) conds.push(`r.contract_date <= '${esc(b.date_to)}'::date`);
const where = 'WHERE ' + conds.join(' AND ');

const eConds = [`e.active = TRUE`];
if (onlyUnbilled) eConds.push('e.billing_doc_no IS NULL');
if (b.date_from) eConds.push(`e.created_at::date >= '${esc(b.date_from)}'::date`);
if (b.date_to) eConds.push(`e.created_at::date <= '${esc(b.date_to)}'::date`);
const eWhere = 'WHERE ' + eConds.join(' AND ');

const query = `
SELECT * FROM (
  SELECT
    r.insurance_id,
    COALESCE(r.receipt_no, rsi.receipt_no) AS receipt_no,
    r.policy_no, r.insured_name,
    r.chassis_no, r.plate_number,
    r.contract_date, r.coverage_start, r.coverage_end,
    COALESCE(r.customer_name, s.customer_name) AS customer_name,
    COALESCE(r.invoice_no, s.invoice_no) AS invoice_no,
    COALESCE(r.sale_id, s.id) AS sale_id,
    r.match_source,
    r.premium, r.stamp_duty, r.tax, r.total_premium, r.commission, r.premium_remit,
    CASE WHEN COALESCE(r.amount_received, 0) > 0 THEN r.amount_received ELSE COALESCE(auto.total, 0) END AS amount_received,
    r.billing_doc_no, r.billed_at, r.billed_by, r.record_batch_no,
    r.paid_doc_no, r.paid_at, r.payment_method, r.payment_note, r.paid_to_vendor, r.wht_rate, r.wht_amount, r.from_bank_account_id, r.paid_by,
    r.status, r.paid::text AS paid, r.created_at, r.updated_at,
    CASE WHEN jsonb_array_length(COALESCE(r.claimed_items, '[]'::jsonb)) > 0 THEN r.claimed_items ELSE COALESCE(auto.items, '[]'::jsonb) END AS claimed_items,
    (jsonb_array_length(COALESCE(r.claimed_items, '[]'::jsonb)) > 0) AS has_claim,
    'insurance'::text AS record_type
  FROM moto_insurance_records r
  LEFT JOIN LATERAL (
    SELECT id, invoice_no, customer_name FROM moto_sales
    WHERE r.chassis_no IS NOT NULL AND UPPER(chassis_no) = UPPER(r.chassis_no) LIMIT 1
  ) s ON TRUE
  LEFT JOIN LATERAL (
    SELECT receipt_no FROM registration_submission_items
    WHERE r.chassis_no IS NOT NULL AND UPPER(chassis_no) = UPPER(r.chassis_no)
      AND receipt_no IS NOT NULL ORDER BY id DESC LIMIT 1
  ) rsi ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('item_id', i.id, 'description', i.description, 'amount', i.line_amount, 'fee', i.fee, 'total', i.total) ORDER BY i.line_order) AS items,
           SUM(COALESCE(i.total, i.line_amount, 0)) AS total
    FROM other_income_items i
    JOIN other_income oi ON oi.receipt_no = i.receipt_no
    WHERE oi.receipt_no = r.receipt_no AND i.description ILIKE '%พรบ%'
  ) auto ON TRUE
  ${where}
  UNION ALL
  SELECT
    e.id AS insurance_id, e.payment_receipt_no AS receipt_no, e.original_policy_no AS policy_no, oi.customer_name AS insured_name,
    NULL::text AS chassis_no, NULL::text AS plate_number,
    NULL::date AS contract_date, NULL::date AS coverage_start, NULL::date AS coverage_end,
    oi.customer_name AS customer_name, NULL::text AS invoice_no, NULL::int AS sale_id, NULL::text AS match_source,
    NULL::numeric AS premium, NULL::numeric AS stamp_duty, NULL::numeric AS tax,
    e.expense_amount AS total_premium, NULL::numeric AS commission, e.expense_amount AS premium_remit,
    e.expense_amount AS amount_received,
    e.billing_doc_no, e.billed_at, e.billed_by, e.record_batch_no,
    e.paid_doc_no, e.paid_at, e.payment_method, e.payment_note, e.paid_to_vendor,
    NULL::numeric AS wht_rate, NULL::numeric AS wht_amount, e.from_bank_account_id,
    NULL::text AS paid_by,
    'active'::text AS status, 'false'::text AS paid, e.created_at, e.created_at AS updated_at,
    '[]'::jsonb AS claimed_items,
    FALSE AS has_claim,
    'extra'::text AS record_type
  FROM motoinsurance_extra_expenses e
  LEFT JOIN other_income oi ON oi.receipt_no = e.payment_receipt_no
  ${eWhere}
) merged
ORDER BY record_batch_no DESC NULLS LAST, insurance_id DESC
LIMIT 5000`;
return [{ json: { query } }];"""

# ===== 2) Code Save Insurance Billing =====
NEW_SAVE = r"""const b = $input.first().json.body || {};
const insIds = (b.insurance_ids || []).map(Number).filter(n => Number.isFinite(n) && n > 0);
const exIds = (b.extra_ids || []).map(Number).filter(Number.isFinite).filter(n => n > 0);
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

# ===== 3) Code Cancel Insurance Billing =====
NEW_CANCEL = r"""const b = $input.first().json.body || {};
const doc = String(b.billing_doc_no || '').replace(/'/g, "''");
if (!doc) throw new Error('billing_doc_no required');
const query = `UPDATE moto_insurance_records SET billing_doc_no = NULL, billed_at = NULL, billed_by = NULL, updated_at = NOW() WHERE billing_doc_no = '${doc}'; UPDATE motoinsurance_extra_expenses SET billing_doc_no = NULL, billed_at = NULL, billed_by = NULL, record_batch_no = NULL WHERE billing_doc_no = '${doc}'; SELECT '${doc}' AS billing_doc_no`;
return [{ json: { query } }];"""

# ===== 4) Code Cancel Insurance Billing Batch =====
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

CHANGES = {
    'Code Insurance Billing List SQL': NEW_LIST,
    'Code Save Insurance Billing': NEW_SAVE,
    'Code Cancel Insurance Billing': NEW_CANCEL,
    'Code Cancel Insurance Billing Batch': NEW_CANCEL_BATCH,
}

count = 0
for name, new_js in CHANGES.items():
    n = next((x for x in wf['nodes'] if x['name']==name), None)
    if n:
        # save the position
        n['parameters']['jsCode'] = new_js
        count += 1
        print(f"OK: {name}")
    else:
        print(f"WARN: {name} not found")

src.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nOK: updated {count} nodes in {src.name} (positions preserved)")
