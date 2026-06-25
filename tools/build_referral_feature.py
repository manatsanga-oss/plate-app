# -*- coding: utf-8 -*-
"""สร้าง backend ฟีเจอร์ "ค่าแนะนำ":
- DDL ตาราง referral_fees
- workflow referral-fee-api (list / import+auto-match / link / search เลือกเอง)
ฝั่งซ้าย = daily_expenses (เงินสดย่อย "ค่าแนะนำ" — เลขที่จ่าย SCY..-P...) เหมือน "ค่านำพา"
จับคู่กับ = expense_documents (เอกสารค่าใช้จ่ายที่ upload จาก Excel, รายการบัญชี/description = "ค่าแนะนำ")
auto-match: สังกัด + ยอดเงิน + ชื่อผู้รับ(pay_to)≈ผู้จำหน่าย(vendor_name) ตรงและ unique (วันที่อาจคนละวัน)
affiliation (ป.เปา/สิงห์ชัย) ดึงจาก prefix payment_no: SCY05/06=ป.เปา, SCY01/04/07=สิงห์ชัย
link โดย expense_documents.id (เลี่ยง expense_doc_no ชนข้ามบริษัท)"""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
FOLDER = r"C:\Users\manat\OneDrive\New folder"

# ---------- DDL ----------
# DROP+CREATE: ตารางยังไม่ใช้งานจริง (workflow ยัง active:false) — สร้างใหม่ให้ตรงโครง
DDL = """-- ตารางค่าแนะนำลูกค้า — ฝั่งซ้ายดึงจาก daily_expenses (เงินสดย่อย "ค่าแนะนำ")
-- จับคู่กับ expense_documents (เอกสารค่าใช้จ่าย upload, description = "ค่าแนะนำ")
DROP TABLE IF EXISTS referral_fees;
CREATE TABLE referral_fees (
  id BIGSERIAL PRIMARY KEY,
  source_expense_id BIGINT UNIQUE,     -- daily_expenses.id (ใบจ่ายเงินสดย่อย)
  payment_no TEXT,                     -- เลขที่จ่าย SCY..-P...
  payment_date DATE,
  pay_to TEXT,                         -- นายหน้า/ผู้รับเงิน
  amount NUMERIC(14,2),
  affiliation TEXT,                    -- ป.เปา / สิงห์ชัย (จาก prefix payment_no)
  note TEXT,
  branch TEXT,
  linked_expense_doc_id BIGINT,        -- expense_documents.id ที่จับคู่
  linked_expense_doc_no TEXT,          -- เลขที่เอกสาร (โชว์)
  linked_manual BOOLEAN DEFAULT FALSE,
  linked_at TIMESTAMPTZ,
  linked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_payment_date ON referral_fees(payment_date);
"""
open(os.path.join(FOLDER, "Referral_Fee_DDL.sql"), "w", encoding="utf-8").write(DDL)

# ---------- jsCode ของแต่ละ action ----------
# list: ดึงค่านำพา (034:ค่านำพา) จาก daily_expenses + จับคู่กับ expense_documents
#   คอลัมน์: เลขที่จ่าย=payment_no, วันที่จ่าย=payment_date, ผู้รับ=pay_to,
#   ยอดเงิน=total_amount, ยอดจ่ายจริง=cash, หัก ณ ที่จ่าย=withholding_tax, หมายเหตุ=note
#   จับคู่ expense_documents ด้วย วันที่จ่าย + ผู้รับ(vendor_name) + จำนวนเงิน(total) → แสดง expense_doc_no
REFERRAL_KW = "นำพา"  # หมวดที่ดึง = 034:ค่านำพา (user สั่งให้ใช้ค่านำพา ไม่ใช่ค่าแนะนำ)
JS_LIST = (r'''const b=$input.first().json.body||{};
const df=b.date_from&&/^\d{4}-\d{2}-\d{2}/.test(b.date_from)?`'${b.date_from}'::date`:null;
const dt=b.date_to&&/^\d{4}-\d{2}-\d{2}/.test(b.date_to)?`'${b.date_to}'::date`:null;
const c=["(de.payment_type ILIKE '%KW%' OR de.detail ILIKE '%KW%')"];
if(df)c.push(`de.payment_date>=${df}`);if(dt)c.push(`de.payment_date<=${dt}`);
const where='WHERE '+c.join(' AND ');
const query=`SELECT de.id, de.payment_no, de.payment_date, de.pay_to, de.total_amount, COALESCE(de.cash,0) AS cash_amount, COALESCE(de.withholding_tax,0) AS withholding_tax, de.note, CASE WHEN LEFT(de.payment_no,5) IN ('SCY05','SCY06') THEN 'ป.เปา' WHEN LEFT(de.payment_no,5) IN ('SCY01','SCY04','SCY07') THEN 'สิงห์ชัย' ELSE NULL END AS affiliation, m.expense_doc_no AS matched_doc_no, m.doc_date AS matched_doc_date FROM daily_expenses de LEFT JOIN LATERAL (SELECT ed.expense_doc_no, ed.doc_date FROM expense_documents ed WHERE COALESCE(ed.status,'') <> 'cancelled' AND ed.total = de.total_amount AND UPPER(TRIM(BOTH ' -' FROM COALESCE(ed.vendor_name,''))) = UPPER(TRIM(BOTH ' -' FROM COALESCE(de.pay_to,''))) AND (ed.doc_date = de.payment_date OR ed.paid_at::date = de.payment_date) ORDER BY ed.expense_doc_id LIMIT 1) m ON TRUE ${where} ORDER BY de.payment_date DESC, de.id DESC LIMIT 5000`;
return [{json:{query}}];''').replace("KW", REFERRAL_KW)

# Import จาก daily_expenses (payment_type/detail มี "แนะนำ") + auto-match กับ expense_documents
# เกณฑ์: สังกัด + ยอดเงิน + ชื่อผู้รับ≈ผู้จำหน่าย ตรงและ unique (วันที่อาจคนละวัน)
# ทำ insert+automatch ใน statement เดียว (LATERAL) เลี่ยงปัญหา snapshot ของ data-modifying CTE
JS_IMPORT = r'''const b=$input.first().json.body||{};
const query=`WITH src AS (
  SELECT de.id, de.payment_no, de.payment_date, de.pay_to, de.total_amount, de.note, de.branch, de.uploaded_at,
    CASE WHEN LEFT(de.payment_no,5) IN ('SCY05','SCY06') THEN 'ป.เปา'
         WHEN LEFT(de.payment_no,5) IN ('SCY01','SCY04','SCY07') THEN 'สิงห์ชัย' ELSE NULL END AS aff
  FROM daily_expenses de
  WHERE (de.payment_type ILIKE '%แนะนำ%' OR de.detail ILIKE '%แนะนำ%')
    AND NOT EXISTS (SELECT 1 FROM referral_fees rf WHERE rf.source_expense_id=de.id)
),
ins AS (
  INSERT INTO referral_fees (source_expense_id, payment_no, payment_date, pay_to, amount, affiliation, note, branch, linked_expense_doc_id, linked_expense_doc_no, linked_at, linked_by, created_at)
  SELECT s.id, s.payment_no, s.payment_date, s.pay_to, s.total_amount, s.aff, s.note, s.branch,
    m.eid, m.edno,
    CASE WHEN m.eid IS NOT NULL THEN NOW() END,
    CASE WHEN m.eid IS NOT NULL THEN 'auto-import' END,
    COALESCE(s.uploaded_at, NOW())
  FROM src s
  LEFT JOIN LATERAL (
    SELECT MIN(ed.expense_doc_id) AS eid, MIN(ed.expense_doc_no) AS edno
    FROM expense_documents ed
    WHERE COALESCE(ed.status,'') <> 'cancelled' AND ed.description ILIKE '%แนะนำ%'
      AND COALESCE(ed.affiliation,'')=COALESCE(s.aff,'')
      AND ed.total=s.total_amount
      AND UPPER(TRIM(BOTH ' -' FROM COALESCE(ed.vendor_name,'')))=UPPER(TRIM(BOTH ' -' FROM COALESCE(s.pay_to,'')))
    HAVING COUNT(*)=1
  ) m ON TRUE
  RETURNING (linked_expense_doc_id IS NOT NULL) AS linked
)
SELECT COUNT(*)::int AS imported, COUNT(*) FILTER (WHERE linked)::int AS auto_linked FROM ins`;
return [{json:{query}}];'''

JS_LINK = r'''const b=$input.first().json.body||{};
const id=Number(b.referral_id||b.expense_id)||0;
const docId=Number(b.expense_doc_id)||0;
const by=String(b.linked_by||'system').replace(/'/g,"''");
let query;
if(!docId){ query=`UPDATE referral_fees SET linked_expense_doc_id=NULL, linked_expense_doc_no=NULL, linked_manual=FALSE, linked_at=NULL, linked_by=NULL, updated_at=NOW() WHERE id=${id} RETURNING id`; }
else { query=`UPDATE referral_fees rf SET linked_expense_doc_id=ed.expense_doc_id, linked_expense_doc_no=ed.expense_doc_no, linked_manual=TRUE, linked_at=NOW(), linked_by='${by}', updated_at=NOW() FROM expense_documents ed WHERE ed.expense_doc_id=${docId} AND rf.id=${id} RETURNING rf.id`; }
return [{json:{query}}];'''

# ค้นเอกสารค่าแนะนำ (expense_documents) เพื่อจับคู่เอง — กรองตามสังกัดของใบจ่าย
JS_SEARCH = r'''const b=$input.first().json.body||{};
const esc=v=>String(v||'').replace(/'/g,"''").trim();
const kw=esc(b.search||'');
const aff=esc(b.affiliation||'');
const c=["COALESCE(ed.status,'') <> 'cancelled'","ed.description ILIKE '%แนะนำ%'"];
if(aff)c.push(`COALESCE(ed.affiliation,'')='${aff}'`);
if(kw)c.push(`(ed.expense_doc_no ILIKE '%${kw}%' OR ed.vendor_name ILIKE '%${kw}%' OR CAST(ed.total AS TEXT) ILIKE '%${kw}%')`);
const query=`SELECT ed.expense_doc_id AS id, ed.expense_doc_no, ed.doc_date, ed.vendor_name, ed.total, ed.affiliation, ed.description FROM expense_documents ed WHERE ${c.join(' AND ')} ORDER BY ed.doc_date DESC, ed.expense_doc_id DESC LIMIT 50`;
return [{json:{query}}];'''

def code_node(name, js, y, nid):
    return {"parameters": {"jsCode": js}, "id": nid, "name": name,
            "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [6736, y]}

def rule(action, key, rid):
    return {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{"id": rid, "leftValue": "={{ $json.body.action }}", "rightValue": action,
                            "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
            "renameOutput": True, "outputKey": key}

wf = {
  "name": "referral-fee-api",
  "nodes": [
    {"parameters": {"httpMethod": "POST", "path": "referral-fee-api", "responseMode": "responseNode",
                    "options": {"allowedOrigins": "*"}},
     "id": "rf-webhook", "name": "Webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 2,
     "position": [6256, 288], "webhookId": "referral-fee-api"},
    {"parameters": {"rules": {"values": [
        rule("list_referral_fees", "list", "rf1"),
     ]}, "options": {}},
     "id": "rf-switch", "name": "Switch Action", "type": "n8n-nodes-base.switch", "typeVersion": 3.2,
     "position": [6496, 288]},
    code_node("Code List Referral", JS_LIST, 160, "rf-code-list"),
    {"parameters": {"operation": "executeQuery", "query": "{{ $json.query }}", "options": {}},
     "id": "rf-pg", "name": "PG Execute", "type": "n8n-nodes-base.postgres", "typeVersion": 2.6,
     "position": [7008, 320], "alwaysOutputData": True,
     "credentials": {"postgres": {"id": "JLUeyZRAzUeRqlxu", "name": "Postgres account"}}},
    {"parameters": {"respondWith": "json",
                    "responseBody": "={{ JSON.stringify($input.all().map(i => i.json)) }}",
                    "options": {"responseHeaders": {"entries": [
                        {"name": "Access-Control-Allow-Origin", "value": "*"},
                        {"name": "Access-Control-Allow-Methods", "value": "POST, OPTIONS"},
                        {"name": "Access-Control-Allow-Headers", "value": "Content-Type"}]}}},
     "id": "rf-respond", "name": "Respond", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.5,
     "position": [7248, 320]},
  ],
  "connections": {
    "Webhook": {"main": [[{"node": "Switch Action", "type": "main", "index": 0}]]},
    "Switch Action": {"main": [
        [{"node": "Code List Referral", "type": "main", "index": 0}],
    ]},
    "Code List Referral": {"main": [[{"node": "PG Execute", "type": "main", "index": 0}]]},
    "PG Execute": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]},
  },
  "active": False,
  "settings": {"executionOrder": "v1"},
}
open(os.path.join(FOLDER, "Referral_Fee_Workflow.json"), "w", encoding="utf-8").write(
    json.dumps(wf, ensure_ascii=False, indent=2))
print("OK: เขียน Referral_Fee_DDL.sql + Referral_Fee_Workflow.json")
print("nodes:", len(wf["nodes"]))
