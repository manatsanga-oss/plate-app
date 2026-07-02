# -*- coding: utf-8 -*-
# เพิ่ม แก้ไข/ยกเลิก ใบจ่ายเงิน COSMOS ใน registrations-api (Registrations API (18).json)
#  - actions ใหม่: update_cosmos_payment (แก้ header ทั้งใบ อ้าง paid_doc_no) / cancel_cosmos_payment (ล้าง payment fields → กลับเป็นรอจ่าย)
#  - Code List Paid เพิ่ม s.wht_rate, s.wht_base (ให้ frontend prefill ฟอร์มแก้ไข)
import json, io, shutil

PATH = r"C:\Users\manat\OneDrive\New folder\Registrations API (18).json"
d = json.load(io.open(PATH, encoding="utf-8"))
nodes = {n["name"]: n for n in d["nodes"]}

UPDATE_JS = r"""// update_cosmos_payment: แก้ไขรายละเอียดการจ่าย (ทั้งใบ paid_doc_no เดิม — ไม่แตะรายการ/เลขใบ)
const b = $input.first().json.body || {};
const esc = v => String(v == null ? '' : v).replace(/'/g, "''");
const payNo = esc(b.paid_doc_no || '').trim();
if (!payNo) return [{ json: { query: "SELECT 'paid_doc_no required' AS message WHERE FALSE" } }];
const paidDate = esc(b.paid_date || '').trim();
const dateExpr = paidDate && /^\d{4}-\d{2}-\d{2}/.test(paidDate) ? `'${paidDate}'::timestamptz` : 'NOW()';
const method = esc(b.payment_method || '');
const note = esc(b.payment_note || '');
const vendor = esc(b.paid_to_vendor || '');
const whtRate = Number(b.wht_rate);
const whtAmount = Number(b.wht_amount);
const whtBase = Number(b.wht_base);
const fromBankId = Number(b.from_bank_account_id);
const whtRateExpr = isFinite(whtRate) && whtRate > 0 ? whtRate : 'NULL';
const whtAmountExpr = isFinite(whtAmount) && whtAmount > 0 ? whtAmount : 'NULL';
const whtBaseExpr = isFinite(whtBase) && whtBase > 0 ? whtBase : 'NULL';
const fromBankExpr = Number.isFinite(fromBankId) && fromBankId > 0 ? fromBankId : 'NULL';
const query = `UPDATE cosmos_submissions SET paid_at = ${dateExpr}, paid_to_vendor = NULLIF('${vendor}',''), payment_method = '${method}', payment_note = '${note}', wht_rate = ${whtRateExpr}, wht_amount = ${whtAmountExpr}, wht_base = ${whtBaseExpr}, from_bank_account_id = ${fromBankExpr} WHERE paid_doc_no = '${payNo}' RETURNING id`;
return [{ json: { query, paid_doc_no: payNo } }];"""

CANCEL_JS = r"""// cancel_cosmos_payment: ยกเลิกใบจ่าย — ล้าง payment fields ทั้งใบ → batch กลับเป็น "รอจ่าย" (ยังวางบิลอยู่)
const b = $input.first().json.body || {};
const esc = v => String(v == null ? '' : v).replace(/'/g, "''");
const payNo = esc(b.paid_doc_no || '').trim();
if (!payNo) return [{ json: { query: "SELECT 'paid_doc_no required' AS message WHERE FALSE" } }];
const query = `UPDATE cosmos_submissions SET paid_doc_no = NULL, paid_at = NULL, paid_by = NULL, paid_to_vendor = NULL, payment_method = NULL, payment_note = NULL, wht_rate = NULL, wht_amount = NULL, wht_base = NULL, from_bank_account_id = NULL WHERE paid_doc_no = '${payNo}' RETURNING id`;
return [{ json: { query, paid_doc_no: payNo } }];"""

CRED = {"postgres": {"id": "JLUeyZRAzUeRqlxu", "name": "Postgres account"}}
PG_PARAMS = {"operation": "executeQuery", "query": "{{ $json.query }}", "options": {}}
def respond(body_expr):
    return {"respondWith": "json", "responseBody": body_expr,
            "options": {"responseHeaders": {"entries": [
                {"name": "Access-Control-Allow-Origin", "value": "*"},
                {"name": "Content-Type", "value": "application/json; charset=utf-8"}]}}}

new_nodes = [
    {"id": "cosmos-upd-code", "name": "Code Update Cosmos Payment", "type": "n8n-nodes-base.code", "typeVersion": 2,
     "position": [1337584, 408950], "parameters": {"jsCode": UPDATE_JS}},
    {"id": "cosmos-upd-pg", "name": "Q: Update Cosmos Payment", "type": "n8n-nodes-base.postgres", "typeVersion": 2.5,
     "position": [1338080, 408950], "parameters": dict(PG_PARAMS), "credentials": CRED},
    {"id": "cosmos-upd-resp", "name": "Respond Update Cosmos Payment", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
     "position": [1338576, 408950],
     "parameters": respond("={{ JSON.stringify({ success: true, updated_count: $input.all().length }) }}")},
    {"id": "cosmos-cxl-code", "name": "Code Cancel Cosmos Payment", "type": "n8n-nodes-base.code", "typeVersion": 2,
     "position": [1337584, 409150], "parameters": {"jsCode": CANCEL_JS}},
    {"id": "cosmos-cxl-pg", "name": "Q: Cancel Cosmos Payment", "type": "n8n-nodes-base.postgres", "typeVersion": 2.5,
     "position": [1338080, 409150], "parameters": dict(PG_PARAMS), "credentials": CRED},
    {"id": "cosmos-cxl-resp", "name": "Respond Cancel Cosmos Payment", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
     "position": [1338576, 409150],
     "parameters": respond("={{ JSON.stringify({ success: true, cancelled_count: $input.all().length }) }}")},
]
existing = {n["name"] for n in d["nodes"]}
for n in new_nodes:
    if n["name"] not in existing:
        d["nodes"].append(n)

# Switch rules + outputs (append ท้าย — ไม่กระทบ index เดิม)
sw = nodes["Switch Action"]
rules = sw["parameters"]["rules"]["values"]
def mk_rule(rid, action):
    return {"conditions": {"options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
            "conditions": [{"id": rid, "leftValue": "={{ $json.body.action }}", "rightValue": action,
                            "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
            "renameOutput": True, "outputKey": action}
sw_main = d["connections"]["Switch Action"]["main"]
if not any(r.get("outputKey") == "update_cosmos_payment" for r in rules):
    rules.append(mk_rule("cq-upd", "update_cosmos_payment"))
    sw_main.append([{"node": "Code Update Cosmos Payment", "type": "main", "index": 0}])
    rules.append(mk_rule("cq-cxl", "cancel_cosmos_payment"))
    sw_main.append([{"node": "Code Cancel Cosmos Payment", "type": "main", "index": 0}])

conn = d["connections"]
conn["Code Update Cosmos Payment"] = {"main": [[{"node": "Q: Update Cosmos Payment", "type": "main", "index": 0}]]}
conn["Q: Update Cosmos Payment"] = {"main": [[{"node": "Respond Update Cosmos Payment", "type": "main", "index": 0}]]}
conn["Code Cancel Cosmos Payment"] = {"main": [[{"node": "Q: Cancel Cosmos Payment", "type": "main", "index": 0}]]}
conn["Q: Cancel Cosmos Payment"] = {"main": [[{"node": "Respond Cancel Cosmos Payment", "type": "main", "index": 0}]]}

# Code List Paid: เพิ่ม wht_rate + wht_base
lp = nodes["Code List Paid"]
c = lp["parameters"]["jsCode"]
old = "s.wht_amount, s.from_bank_account_id,"
new = "s.wht_amount, s.wht_rate, s.wht_base, s.from_bank_account_id,"
if c.count(old) != 1:
    raise SystemExit("List Paid anchor not found")
lp["parameters"]["jsCode"] = c.replace(old, new)

shutil.copyfile(PATH, PATH + ".bak-cosmospayedit")
with io.open(PATH, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print("OK — cosmos payment update/cancel added, backup .bak-cosmospayedit")
