"""
แก้ Accounting API workflow JSON เพื่อเพิ่ม logic ใบลดหนี้ใน op=save_payment
- INSERT ลง credit_notes_received เมื่อ is_credit_note = true
"""
import json
import sys
from pathlib import Path

NEW_JS_CODE = r'''const b = $input.first().json.body || {};
const op = String(b.op || '').toLowerCase().trim();
const esc = v => v == null || v === '' ? 'NULL' : ("'" + String(v).replace(/'/g, "''") + "'");
const num = v => { if (v == null || v === '') return '0'; const n = Number(v); return isFinite(n) ? String(n) : '0'; };
const datExpr = v => v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? `'${String(v).slice(0,10)}'::date` : 'NULL';
const tsExpr = v => v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? `'${String(v).slice(0,10)} 00:00:00+07:00'::timestamptz` : 'NULL';
let query;
if (op === 'list') {
  const df = b.date_from && /^\d{4}-\d{2}-\d{2}/.test(b.date_from) ? `'${b.date_from}'::date` : null;
  const dt = b.date_to && /^\d{4}-\d{2}-\d{2}/.test(b.date_to) ? `'${b.date_to}'::date` : null;
  const conds = [];
  if (df) conds.push(`d.doc_date >= ${df}`);
  if (dt) conds.push(`d.doc_date <= ${dt}`);
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  query = `SELECT d.*, COALESCE((SELECT json_agg(json_build_object('item_id', i.item_id, 'expense_code', i.expense_code, 'expense_name', i.expense_name, 'description', i.description, 'qty', i.qty, 'unit_price', i.unit_price, 'amount', i.amount) ORDER BY i.item_id) FROM expense_document_items i WHERE i.expense_doc_id = d.expense_doc_id), '[]'::json) AS items FROM expense_documents d ${where} ORDER BY d.doc_date DESC, d.expense_doc_id DESC LIMIT 1000`;
  return [{ json: { query } }];
}
if (op === 'cancel') {
  const id = Number(b.expense_doc_id);
  if (!id) return [{ json: { query: "SELECT NULL::int AS expense_doc_id, 'id required' AS error_msg WHERE FALSE" } }];
  query = `UPDATE expense_documents SET status='cancelled', updated_at=NOW() WHERE expense_doc_id=${id} RETURNING expense_doc_id, expense_doc_no`;
  return [{ json: { query } }];
}
if (op === 'save_payment') {
  const ids = Array.isArray(b.expense_doc_ids) ? b.expense_doc_ids.map(Number).filter(n => n > 0) : [];
  if (!ids.length) return [{ json: { query: "SELECT NULL::text AS paid_doc_no, 'no docs' AS error_msg WHERE FALSE" } }];
  const dateExpr = datExpr(b.paid_date) === 'NULL' ? 'CURRENT_DATE' : datExpr(b.paid_date);
  const tsForPaid = tsExpr(b.paid_date) === 'NULL' ? 'NOW()' : tsExpr(b.paid_date);
  const method = esc(b.payment_method); const note = esc(b.payment_note); const paidBy = esc(b.paid_by);
  const fromBank = b.from_bank_account_id ? Number(b.from_bank_account_id) : 'NULL';
  // multi-method payment breakdown
  const paymentsArr = Array.isArray(b.payments) ? b.payments : [];
  // ใบลดหนี้ — ใช้วันที่จ่ายเป็นวันที่ใบลดหนี้ + auto-generate เลขที่ (CN-YYMMDD-XXX)
  const isCN = b.is_credit_note === true || b.is_credit_note === 'true';
  const cnDateExpr = dateExpr;  // ใช้ paid_date
  const cnAmount = num(b.credit_note_amount);
  // Step 1: UPDATE expense + RETURN paid_doc_no, updated_count
  const stepUpdate = `
WITH prefix AS (SELECT ('EPAY-' || TO_CHAR(${dateExpr}, 'YYMMDD')) AS p),
next_seq AS (
  SELECT COALESCE(MAX(CAST(SPLIT_PART(paid_doc_no, '-', 3) AS INT)), 0) + 1 AS n
  FROM expense_documents, prefix WHERE paid_doc_no LIKE (prefix.p || '-%')
),
gen AS (SELECT (prefix.p || '-' || LPAD(n::text, 3, '0')) AS pay_no FROM next_seq, prefix),
upd AS (
  UPDATE expense_documents
  SET status='paid', paid_at=${tsForPaid}, paid_doc_no=(SELECT pay_no FROM gen), payment_method=${method}, from_bank_account_id=${fromBank}, note=COALESCE(note,'') || CASE WHEN ${note}::text IS NOT NULL AND ${note}::text != '' THEN E'\n[จ่าย] ' || ${note} ELSE '' END, updated_at=NOW()
  WHERE expense_doc_id IN (${ids.join(',')}) AND status='draft'
  RETURNING expense_doc_id, expense_doc_no
)
SELECT (SELECT pay_no FROM gen) AS paid_doc_no, (SELECT COUNT(*) FROM upd) AS updated_count, (SELECT string_agg(DISTINCT expense_doc_no, ',') FROM upd) AS exp_doc_nos`;

  // สร้าง VALUES list สำหรับ expense_payment_breakdowns
  // ส่วนใบลดหนี้ — credit_note_no จะ link หลัง INSERT cn (ใส่ผ่าน update ทีหลังถ้าจำเป็น)
  const pbValuesArr = paymentsArr.map((p, i) => {
    const m = esc(p.method || '');
    const amt = num(p.amount);
    const ba = p.from_bank_account_id ? Number(p.from_bank_account_id) : 'NULL';
    return `(${m}, ${amt}, ${ba}, ${i + 1})`;
  });
  const hasPayments = pbValuesArr.length > 0;

  if (!isCN && !hasPayments) {
    query = stepUpdate;
  } else {
    // Step 2: INSERT credit_notes_received อีก statement หลัง UPDATE commit แล้ว
    // ใช้ multi-statement: UPDATE; INSERT; SELECT
    query = `
WITH prefix AS (SELECT ('EPAY-' || TO_CHAR(${dateExpr}, 'YYMMDD')) AS p),
next_seq AS (
  SELECT COALESCE(MAX(CAST(SPLIT_PART(paid_doc_no, '-', 3) AS INT)), 0) + 1 AS n
  FROM expense_documents, prefix WHERE paid_doc_no LIKE (prefix.p || '-%')
),
gen AS (SELECT (prefix.p || '-' || LPAD(n::text, 3, '0')) AS pay_no FROM next_seq, prefix),
upd AS (
  UPDATE expense_documents
  SET status='paid', paid_at=${tsForPaid}, paid_doc_no=(SELECT pay_no FROM gen), payment_method=${method}, from_bank_account_id=${fromBank}, note=COALESCE(note,'') || CASE WHEN ${note}::text IS NOT NULL AND ${note}::text != '' THEN E'\n[จ่าย] ' || ${note} ELSE '' END, updated_at=NOW()
  WHERE expense_doc_id IN (${ids.join(',')}) AND status='draft'
  RETURNING expense_doc_id, expense_doc_no, vendor_name
),
cn_prefix AS (SELECT ('CN-' || TO_CHAR(${cnDateExpr}, 'YYMMDD')) AS p),
cn_seq AS (
  SELECT COALESCE(MAX(CAST(SPLIT_PART(credit_note_no, '-', 3) AS INT)), 0) + 1 AS n
  FROM credit_notes_received, cn_prefix WHERE credit_note_no LIKE (cn_prefix.p || '-%')
),
cn_gen AS (SELECT (cn_prefix.p || '-' || LPAD(n::text, 3, '0')) AS cn_no FROM cn_seq, cn_prefix),
upd_collected AS (
  SELECT string_agg(DISTINCT expense_doc_no, ',') AS doc_nos,
         string_agg(DISTINCT NULLIF(vendor_name, ''), ', ') AS vendors,
         COUNT(*) AS n
  FROM upd
)${isCN ? `,
ins_cn AS (
  INSERT INTO credit_notes_received (
    credit_note_no, credit_note_date, paid_doc_no, billing_doc_nos,
    vendor_name, amount, category, note, created_by
  )
  SELECT (SELECT cn_no FROM cn_gen),
         ${cnDateExpr},
         (SELECT pay_no FROM gen),
         (SELECT doc_nos FROM upd_collected),
         (SELECT vendors FROM upd_collected),
         ${cnAmount},
         NULL,
         ${note},
         ${paidBy}
  FROM upd_collected
  WHERE n > 0
  RETURNING cn_id, credit_note_no
)` : ''}${hasPayments ? `,
ins_pb AS (
  INSERT INTO expense_payment_breakdowns (paid_doc_no, method, amount, from_bank_account_id, credit_note_no, seq)
  SELECT (SELECT pay_no FROM gen),
         v.method, v.amount, v.from_bank_account_id,
         CASE WHEN v.method = 'ใบลดหนี้' THEN (SELECT cn_no FROM cn_gen) ELSE NULL END,
         v.seq
  FROM (VALUES ${pbValuesArr.join(', ')}) AS v(method, amount, from_bank_account_id, seq)
  WHERE EXISTS (SELECT 1 FROM upd)
  RETURNING pb_id
)` : ''}
SELECT (SELECT pay_no FROM gen) AS paid_doc_no,
       (SELECT n FROM upd_collected) AS updated_count${isCN ? `,
       (SELECT credit_note_no FROM ins_cn) AS credit_note_no` : ''}${hasPayments ? `,
       (SELECT COUNT(*) FROM ins_pb) AS payment_breakdown_count` : ''}`;
  }
  return [{ json: { query } }];
}
if (op === 'edit_payment') {
  const docNo = (b.paid_doc_no || '').trim();
  if (!docNo) return [{ json: { query: "SELECT NULL::text AS paid_doc_no, 'paid_doc_no required' AS error_msg WHERE FALSE" } }];
  const tsForPaid = tsExpr(b.paid_date) === 'NULL' ? 'NOW()' : tsExpr(b.paid_date);
  const method = esc(b.payment_method);
  const fromBank = b.from_bank_account_id ? Number(b.from_bank_account_id) : 'NULL';
  query = `UPDATE expense_documents SET paid_at=${tsForPaid}, payment_method=${method}, from_bank_account_id=${fromBank}, updated_at=NOW() WHERE paid_doc_no=${esc(docNo)} RETURNING paid_doc_no, COUNT(*) OVER () AS updated_count`;
  return [{ json: { query } }];
}
if (op === 'cancel_payment') {
  const docNo = (b.paid_doc_no || '').trim();
  if (!docNo) return [{ json: { query: "SELECT NULL::text AS paid_doc_no, 'paid_doc_no required' AS error_msg WHERE FALSE" } }];
  // ยกเลิกใบจ่าย + ยกเลิกใบลดหนี้ที่อ้างอิง paid_doc_no นี้ด้วย
  query = `
WITH cancel_cn AS (
  UPDATE credit_notes_received SET status='cancelled' WHERE paid_doc_no=${esc(docNo)} AND status='active'
  RETURNING cn_id
),
cancel_pay AS (
  UPDATE expense_documents SET status='draft', paid_at=NULL, paid_doc_no=NULL, payment_method=NULL, from_bank_account_id=NULL, updated_at=NOW()
  WHERE paid_doc_no=${esc(docNo)}
  RETURNING expense_doc_id
)
SELECT (SELECT COUNT(*) FROM cancel_pay) AS cancelled_expenses, (SELECT COUNT(*) FROM cancel_cn) AS cancelled_credit_notes`;
  return [{ json: { query } }];
}
if (op === 'save') {
  const id = Number(b.expense_doc_id);
  const items = Array.isArray(b.items) ? b.items : [];
  const itemSql = items.map(it => `(${esc(it.expense_code)}, ${esc(it.expense_name)}, ${esc(it.description)}, ${num(it.qty)}, ${num(it.unit_price)}, ${num(it.amount)})`).join(', ');
  const setClause = `
    doc_date=${datExpr(b.doc_date)},
    vendor_id=${b.vendor_id ? Number(b.vendor_id) : 'NULL'},
    vendor_name=${esc(b.vendor_name)},
    vendor_tax_id=${esc(b.vendor_tax_id)},
    vendor_address=${esc(b.vendor_address)},
    reference_no=${esc(b.reference_no)},
    description=${esc(b.description)},
    note=${esc(b.note)},
    subtotal=${num(b.subtotal)},
    discount_pct=${num(b.discount_pct)},
    discount_amount=${num(b.discount_amount)},
    vat_pct=${num(b.vat_pct)},
    vat_amount=${num(b.vat_amount)},
    total=${num(b.total)},
    wht_rate=${num(b.wht_rate)},
    wht_amount=${num(b.wht_amount)},
    wht_base=${num(b.wht_base)},
    net_to_pay=${num(b.net_to_pay)},
    payment_method=${esc(b.payment_method)},
    paid_at=${b.status === 'paid' && b.doc_date ? tsExpr(b.doc_date) : 'NULL'},
    from_bank_account_id=${b.from_bank_account_id ? Number(b.from_bank_account_id) : 'NULL'},
    status=${esc(b.status || 'draft')},
    updated_at=NOW()`;
  if (id > 0) {
    let q = `UPDATE expense_documents SET ${setClause} WHERE expense_doc_id=${id};\nDELETE FROM expense_document_items WHERE expense_doc_id=${id};`;
    if (items.length) q += `\nINSERT INTO expense_document_items (expense_doc_id, expense_code, expense_name, description, qty, unit_price, amount) SELECT ${id}, v.* FROM (VALUES ${itemSql}) AS v(expense_code, expense_name, description, qty, unit_price, amount);`;
    q += `\nSELECT ${id} AS expense_doc_id, (SELECT expense_doc_no FROM expense_documents WHERE expense_doc_id=${id}) AS expense_doc_no`;
    return [{ json: { query: q } }];
  } else {
    const dateExpr = datExpr(b.doc_date) === 'NULL' ? 'CURRENT_DATE' : datExpr(b.doc_date);
    const q = `
WITH prefix AS (SELECT ('EXP' || TO_CHAR(${dateExpr}, 'YYYYMM')) AS p),
next_seq AS (
  SELECT COALESCE(MAX(CAST(RIGHT(expense_doc_no, 4) AS INT)), 0) + 1 AS n
  FROM expense_documents, prefix
  WHERE expense_doc_no LIKE (prefix.p || '____')
),
gen AS (
  SELECT (prefix.p || LPAD(n::text, 4, '0')) AS doc_no FROM next_seq, prefix
),
ins AS (
  INSERT INTO expense_documents (expense_doc_no, doc_date, vendor_id, vendor_name, vendor_tax_id, vendor_address, reference_no, description, note, subtotal, discount_pct, discount_amount, vat_pct, vat_amount, total, wht_rate, wht_amount, wht_base, net_to_pay, payment_method, paid_at, from_bank_account_id, status, created_by)
  SELECT (SELECT doc_no FROM gen), ${datExpr(b.doc_date)}, ${b.vendor_id ? Number(b.vendor_id) : 'NULL'}, ${esc(b.vendor_name)}, ${esc(b.vendor_tax_id)}, ${esc(b.vendor_address)}, ${esc(b.reference_no)}, ${esc(b.description)}, ${esc(b.note)}, ${num(b.subtotal)}, ${num(b.discount_pct)}, ${num(b.discount_amount)}, ${num(b.vat_pct)}, ${num(b.vat_amount)}, ${num(b.total)}, ${num(b.wht_rate)}, ${num(b.wht_amount)}, ${num(b.wht_base)}, ${num(b.net_to_pay)}, ${esc(b.payment_method)}, ${b.status === 'paid' && b.doc_date ? datExpr(b.doc_date) : 'NULL'}, ${b.from_bank_account_id ? Number(b.from_bank_account_id) : 'NULL'}, ${esc(b.status || 'draft')}, ${esc(b.created_by)}
  RETURNING expense_doc_id, expense_doc_no
)${items.length ? `,
ins_items AS (
  INSERT INTO expense_document_items (expense_doc_id, expense_code, expense_name, description, qty, unit_price, amount)
  SELECT ins.expense_doc_id, v.* FROM ins, (VALUES ${itemSql}) AS v(expense_code, expense_name, description, qty, unit_price, amount)
  RETURNING item_id
)` : ''}
SELECT expense_doc_id, expense_doc_no FROM ins`;
    return [{ json: { query: q } }];
  }
}
return [{ json: { query: "SELECT NULL::int AS expense_doc_id, 'invalid op' AS error_msg WHERE FALSE" } }];'''


def main():
    src = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (4).json")
    dst = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (5) - credit_note.json")

    wf = json.loads(src.read_text(encoding='utf-8'))

    found = False
    for n in wf['nodes']:
        if n['name'] == 'Code Expense Record':
            n['parameters']['jsCode'] = NEW_JS_CODE
            found = True
            print(f"OK: Updated 'Code Expense Record' node")
            break

    if not found:
        print("ERROR: 'Code Expense Record' node not found", file=sys.stderr)
        sys.exit(1)

    dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"OK: Saved to {dst}")

if __name__ == "__main__":
    main()
