"""
แก้ Code Income Record (Finance API) ให้รองรับ multi-method:
- รับ payments[] array
- INSERT breakdowns ลง income_payment_breakdowns
- ผูก credit_note_no สำหรับ method='ใบลดหนี้'
"""
import sys, json
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

src = Path(r"C:/Users/manat/OneDrive/New folder/Finance API (3).json")
dst = Path(r"C:/Users/manat/OneDrive/New folder/Finance API (4) - income_multi.json")

wf = json.loads(src.read_text(encoding='utf-8'))
target = next(n for n in wf['nodes'] if n['name'] == 'Code Income Record')
code = target['parameters']['jsCode']

old_block = """else if (op === 'pay' || op === 'save_payment' || op === 'edit_payment') {
  const docNos = Array.isArray(b.income_doc_nos) ? b.income_doc_nos : (b.income_doc_no ? [b.income_doc_no] : []);
  const docIds = Array.isArray(b.income_doc_ids) ? b.income_doc_ids.map(Number).filter(Number.isFinite) : (b.income_doc_id ? [Number(b.income_doc_id)].filter(Number.isFinite) : []);
  if (!docNos.length && !docIds.length) throw new Error('income_doc_ids or income_doc_nos required');
  const whereClause = docIds.length ? `income_doc_id IN (${docIds.join(',')})` : `income_doc_no IN (${docNos.map(d => "'" + String(d).replace(/'/g, "''") + "'").join(',')})`;
  const inList = docNos.map(d => "'" + String(d).replace(/'/g, "''") + "'").join(',');
  const paidDate = datev(b.paid_date);
  const method = esc(b.payment_method);
  const note = esc(b.payment_note);
  const fromBank = numNull(b.from_bank_account_id);
  const paidBy = esc(b.paid_by || 'system');
  query = `
WITH next_seq AS (
  SELECT COALESCE(MAX(CAST(SPLIT_PART(paid_doc_no, '-', 3) AS INT)), 0) + 1 AS n
  FROM income_records
  WHERE paid_doc_no LIKE 'IRC-' || TO_CHAR(${paidDate}, 'YYMMDD') || '-%'
),
gen_code AS (
  SELECT 'IRC-' || TO_CHAR(${paidDate}, 'YYMMDD') || '-' || LPAD(n::text, 3, '0') AS pay_no FROM next_seq
),
upd AS (
  UPDATE income_records SET
    paid_at = ${paidDate}, paid_doc_no = (SELECT pay_no FROM gen_code),
    payment_method = ${method}, note = COALESCE(note, '') || CASE WHEN ${note} = 'NULL' THEN '' ELSE ' | ' || ${note} END,
    from_bank_account_id = ${fromBank}, status = 'paid', updated_at = NOW()
  WHERE ${whereClause} AND status != 'paid'
  RETURNING income_doc_id
)
SELECT (SELECT pay_no FROM gen_code) AS paid_doc_no, (SELECT COUNT(*) FROM upd) AS updated`;
}"""

new_block = """else if (op === 'pay' || op === 'save_payment' || op === 'edit_payment') {
  const docNos = Array.isArray(b.income_doc_nos) ? b.income_doc_nos : (b.income_doc_no ? [b.income_doc_no] : []);
  const docIds = Array.isArray(b.income_doc_ids) ? b.income_doc_ids.map(Number).filter(Number.isFinite) : (b.income_doc_id ? [Number(b.income_doc_id)].filter(Number.isFinite) : []);
  if (!docNos.length && !docIds.length) throw new Error('income_doc_ids or income_doc_nos required');
  const whereClause = docIds.length ? `income_doc_id IN (${docIds.join(',')})` : `income_doc_no IN (${docNos.map(d => "'" + String(d).replace(/'/g, "''") + "'").join(',')})`;
  const paidDate = datev(b.paid_date);
  const method = esc(b.payment_method);
  const note = esc(b.payment_note);
  const fromBank = numNull(b.from_bank_account_id);

  // multi-method payment breakdowns
  const escSql = v => v == null || v === '' ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
  const paymentsArr = Array.isArray(b.payments) ? b.payments : [];
  const pbValues = paymentsArr.map((p, i) => {
    const m = escSql(p.method);
    const amt = Number(p.amount) || 0;
    const ba = p.from_bank_account_id ? Number(p.from_bank_account_id) + '::integer' : 'NULL::integer';
    const cn = p.credit_note_no ? escSql(p.credit_note_no) + '::text' : 'NULL::text';
    return `(${m}::text, ${amt}::numeric, ${ba}, ${cn}, ${i + 1}::integer)`;
  });
  const hasPayments = pbValues.length > 0;

  query = `
WITH next_seq AS (
  SELECT COALESCE(MAX(CAST(SPLIT_PART(paid_doc_no, '-', 3) AS INT)), 0) + 1 AS n
  FROM income_records
  WHERE paid_doc_no LIKE 'IRC-' || TO_CHAR(${paidDate}, 'YYMMDD') || '-%'
),
gen_code AS (
  SELECT 'IRC-' || TO_CHAR(${paidDate}, 'YYMMDD') || '-' || LPAD(n::text, 3, '0') AS pay_no FROM next_seq
),
upd AS (
  UPDATE income_records SET
    paid_at = ${paidDate}, paid_doc_no = (SELECT pay_no FROM gen_code),
    payment_method = ${method}, note = COALESCE(note, '') || CASE WHEN ${note} = 'NULL' THEN '' ELSE ' | ' || ${note} END,
    from_bank_account_id = ${fromBank}, status = 'paid', updated_at = NOW()
  WHERE ${whereClause} AND status != 'paid'
  RETURNING income_doc_id
)${hasPayments ? `,
ins_pb AS (
  INSERT INTO income_payment_breakdowns (paid_doc_no, method, amount, from_bank_account_id, credit_note_no, seq)
  SELECT (SELECT pay_no FROM gen_code), v.method, v.amount, v.from_bank_account_id, v.credit_note_no, v.seq
  FROM (VALUES ${pbValues.join(', ')}) AS v(method, amount, from_bank_account_id, credit_note_no, seq)
  WHERE EXISTS (SELECT 1 FROM upd)
  RETURNING pb_id
)` : ''}
SELECT (SELECT pay_no FROM gen_code) AS paid_doc_no, (SELECT COUNT(*) FROM upd) AS updated${hasPayments ? `, (SELECT COUNT(*) FROM ins_pb) AS payment_breakdown_count` : ''}`;
}"""

if old_block in code:
    code = code.replace(old_block, new_block)
    print("OK: replaced save_payment block with multi-method version")
else:
    print("ERROR: save_payment block not found")
    exit(1)

target['parameters']['jsCode'] = code
dst.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"OK: saved to {dst}")
