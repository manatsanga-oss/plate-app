# -*- coding: utf-8 -*-
# COSMOS: ยอดเงินโอนคีย์เอง + เงินชำระเกินรอโอนคืน
#  - คอลัมน์ใหม่บน cosmos_submissions: paid_transfer_amount (ยอดโอนที่คีย์), overpaid_amount (ส่วนเกิน),
#    overpaid_refunded_at / overpaid_refund_note (รับเงินคืนแล้ว)
#  - save รับ 2 ฟิลด์ / cancel ล้าง / list คืนครบ / action ใหม่ refund_cosmos_overpaid
#  - bank movements: เงินออกจริง = premium − wht − offset + overpaid (= ยอดที่คีย์)
import json, io, shutil

REG = r"C:\Users\manat\OneDrive\New folder\Registrations API (18).json"
ACC = r"C:\Users\manat\OneDrive\New folder\Accounting API (16).json"

ALT_OLD = ("ALTER TABLE cosmos_submissions ADD COLUMN IF NOT EXISTS income_offset_doc_no TEXT; "
           "ALTER TABLE cosmos_submissions ADD COLUMN IF NOT EXISTS income_offset_amount NUMERIC; ")
ALT_NEW = (ALT_OLD +
           "ALTER TABLE cosmos_submissions ADD COLUMN IF NOT EXISTS paid_transfer_amount NUMERIC; "
           "ALTER TABLE cosmos_submissions ADD COLUMN IF NOT EXISTS overpaid_amount NUMERIC; "
           "ALTER TABLE cosmos_submissions ADD COLUMN IF NOT EXISTS overpaid_refunded_at TIMESTAMPTZ; "
           "ALTER TABLE cosmos_submissions ADD COLUMN IF NOT EXISTS overpaid_refund_note TEXT; ")

def repl(s, old, new, n_expected, tag):
    n = s.count(old)
    if n != n_expected:
        raise SystemExit("[%s] EXPECT %d got %d: %r" % (tag, n_expected, n, old[:90]))
    return s.replace(old, new)

d = json.load(io.open(REG, encoding="utf-8"))
nodes = {n["name"]: n for n in d["nodes"]}

# ---- Save: รับ transfer/overpaid + ขยาย ALTER ----
c = nodes["Code Save Cosmos Payment"]["parameters"]["jsCode"]
c = repl(c, "const offAmtExpr = isFinite(offAmt) && offAmt > 0 ? offAmt : 'NULL';",
            "const offAmtExpr = isFinite(offAmt) && offAmt > 0 ? offAmt : 'NULL';\n"
            "const trAmt = Number(b.transfer_amount);\n"
            "const trAmtExpr = isFinite(trAmt) && trAmt > 0 ? trAmt : 'NULL';\n"
            "const ovAmt = Number(b.overpaid_amount);\n"
            "const ovAmtExpr = isFinite(ovAmt) && ovAmt > 0 ? ovAmt : 'NULL';", 1, "save-vars")
c = repl(c, ALT_OLD, ALT_NEW, 1, "save-alter")
c = repl(c, "income_offset_doc_no = NULLIF('${offDoc}',''), income_offset_amount = ${offAmtExpr} WHERE batch_no",
            "income_offset_doc_no = NULLIF('${offDoc}',''), income_offset_amount = ${offAmtExpr}, paid_transfer_amount = ${trAmtExpr}, overpaid_amount = ${ovAmtExpr} WHERE batch_no", 1, "save-set")
nodes["Code Save Cosmos Payment"]["parameters"]["jsCode"] = c

# ---- Cancel: ล้างทุก field ใหม่ ----
c = nodes["Code Cancel Cosmos Payment"]["parameters"]["jsCode"]
c = repl(c, "income_offset_doc_no = NULL, income_offset_amount = NULL WHERE paid_doc_no",
            "income_offset_doc_no = NULL, income_offset_amount = NULL, paid_transfer_amount = NULL, overpaid_amount = NULL, overpaid_refunded_at = NULL, overpaid_refund_note = NULL WHERE paid_doc_no", 1, "cancel-clear")
nodes["Code Cancel Cosmos Payment"]["parameters"]["jsCode"] = c

# ---- List Paid: คืน field ใหม่ + ขยาย ALTER ----
c = nodes["Code List Paid"]["parameters"]["jsCode"]
c = repl(c, "s.income_offset_doc_no, s.income_offset_amount, s.from_bank_account_id,",
            "s.income_offset_doc_no, s.income_offset_amount, s.paid_transfer_amount, s.overpaid_amount, s.overpaid_refunded_at, s.overpaid_refund_note, s.from_bank_account_id,", 1, "list-cols")
c = repl(c, ALT_OLD, ALT_NEW, 1, "list-alter")
nodes["Code List Paid"]["parameters"]["jsCode"] = c

# ---- action ใหม่: refund_cosmos_overpaid ----
REFUND_JS = r"""// refund_cosmos_overpaid: บันทึกว่าได้รับเงินส่วนที่ชำระเกินคืนจาก COSMOS แล้ว
const b = $input.first().json.body || {};
const esc = v => String(v == null ? '' : v).replace(/'/g, "''");
const payNo = esc(b.paid_doc_no || '').trim();
if (!payNo) return [{ json: { query: "SELECT 'paid_doc_no required' AS message WHERE FALSE" } }];
const rd = esc(b.refunded_date || '').trim();
const dateExpr = rd && /^\d{4}-\d{2}-\d{2}/.test(rd) ? `'${rd}'::timestamptz` : 'NOW()';
const note = esc(b.refund_note || '');
const query = `UPDATE cosmos_submissions SET overpaid_refunded_at = ${dateExpr}, overpaid_refund_note = NULLIF('${note}','') WHERE paid_doc_no = '${payNo}' AND overpaid_amount > 0 RETURNING id`;
return [{ json: { query, paid_doc_no: payNo } }];"""

CRED = {"postgres": {"id": "JLUeyZRAzUeRqlxu", "name": "Postgres account"}}
existing = {n["name"] for n in d["nodes"]}
for node in [
    {"id": "cosmos-rfd-code", "name": "Code Refund Cosmos Overpaid", "type": "n8n-nodes-base.code", "typeVersion": 2,
     "position": [1337584, 409550], "parameters": {"jsCode": REFUND_JS}},
    {"id": "cosmos-rfd-pg", "name": "Q: Refund Cosmos Overpaid", "type": "n8n-nodes-base.postgres", "typeVersion": 2.5,
     "position": [1338080, 409550], "parameters": {"operation": "executeQuery", "query": "{{ $json.query }}", "options": {}}, "credentials": CRED},
    {"id": "cosmos-rfd-resp", "name": "Respond Refund Cosmos Overpaid", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
     "position": [1338576, 409550],
     "parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ success: true, refunded_count: $input.all().length }) }}",
                    "options": {"responseHeaders": {"entries": [
                        {"name": "Access-Control-Allow-Origin", "value": "*"},
                        {"name": "Content-Type", "value": "application/json; charset=utf-8"}]}}}},
]:
    if node["name"] not in existing:
        d["nodes"].append(node)

sw = nodes["Switch Action"]
rules = sw["parameters"]["rules"]["values"]
sw_main = d["connections"]["Switch Action"]["main"]
if not any(r.get("outputKey") == "refund_cosmos_overpaid" for r in rules):
    rules.append({"conditions": {"options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
        "conditions": [{"id": "cq-rfd", "leftValue": "={{ $json.body.action }}", "rightValue": "refund_cosmos_overpaid",
                        "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
        "renameOutput": True, "outputKey": "refund_cosmos_overpaid"})
    sw_main.append([{"node": "Code Refund Cosmos Overpaid", "type": "main", "index": 0}])
conn = d["connections"]
conn["Code Refund Cosmos Overpaid"] = {"main": [[{"node": "Q: Refund Cosmos Overpaid", "type": "main", "index": 0}]]}
conn["Q: Refund Cosmos Overpaid"] = {"main": [[{"node": "Respond Refund Cosmos Overpaid", "type": "main", "index": 0}]]}

shutil.copyfile(REG, REG + ".bak-overpaid")
with io.open(REG, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print("OK — Registrations API patched (overpaid); rules=%d outputs=%d" % (len(rules), len(sw_main)))

# ---- Accounting movements: เงินออกจริงรวมส่วนเกิน + ALTER ครอบคอลัมน์ใหม่ ----
d2 = json.load(io.open(ACC, encoding="utf-8"))
n2 = next(x for x in d2["nodes"] if x["name"] == "Code List Movements")
c2 = n2["parameters"]["jsCode"]
c2 = repl(c2,
    "- COALESCE(cs.wht_amount, 0) - COALESCE(cs.income_offset_amount, 0)) AS amount,",
    "- COALESCE(cs.wht_amount, 0) - COALESCE(cs.income_offset_amount, 0) + COALESCE(cs.overpaid_amount, 0)) AS amount,",
    1, "mov-amount")
c2 = repl(c2,
    "ALTER TABLE cosmos_submissions ADD COLUMN IF NOT EXISTS income_offset_amount NUMERIC;",
    "ALTER TABLE cosmos_submissions ADD COLUMN IF NOT EXISTS income_offset_amount NUMERIC;\nALTER TABLE cosmos_submissions ADD COLUMN IF NOT EXISTS overpaid_amount NUMERIC;",
    1, "mov-alter")
n2["parameters"]["jsCode"] = c2
shutil.copyfile(ACC, ACC + ".bak-overpaidmov")
with io.open(ACC, "w", encoding="utf-8") as f:
    json.dump(d2, f, ensure_ascii=False, indent=2)
print("OK — Accounting movements patched (overpaid)")
