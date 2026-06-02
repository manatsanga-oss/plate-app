"""
สร้าง n8n workflow: Advance Expense API (ค่าใช้จ่ายจ่ายล่วงหน้า)
- Webhook POST /advance-expense-api  (รับ JSON { op, ... })
- Code "Build SQL ADV": แปลง op -> SQL (list / save / clear / cancel)
- Postgres "PG ADV": execute query (RETURNING *)
- Respond: ส่งผลลัพธ์เป็น JSON array

รันไฟล์นี้แล้วจะได้ไฟล์ advance_expense_workflow.json -> import เข้า n8n
ตาราง: ใช้ advance_expenses_schema.sql รันสร้างใน Postgres ก่อน
"""
import json
from pathlib import Path

BUILD_JS = r"""// Advance Expense API — แปลง op เป็น SQL
const body = ($input.first().json && $input.first().json.body) || $input.first().json || {};
const op = body.op || 'list';

function esc(v){ if(v===null||v===undefined) return 'NULL'; const s=String(v).trim(); if(s==='') return 'NULL'; return "'"+s.replace(/'/g,"''")+"'"; }
function num(v){ if(v===null||v===undefined||v==='') return '0'; const n=Number(String(v).replace(/[,\s]/g,'')); return isFinite(n)?String(n):'0'; }
function intOrNull(v){ if(v===null||v===undefined||v==='') return null; const n=parseInt(v,10); return isFinite(n)?n:null; }
function dateLit(v){ const s=v?String(v).slice(0,10):''; return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `'${s}'::date` : 'CURRENT_DATE'; }
// payment_methods -> jsonb literal (sanitize: เก็บเฉพาะ method/amount/bank_account_id)
function jsonbLit(arr){
  const clean = Array.isArray(arr) ? arr.map(p => ({
    method: String(p && p.method || '').trim(),
    amount: Number(p && p.amount) || 0,
    bank_account_id: (p && (p.bank_account_id ?? p.from_bank_account_id)) != null && String(p.bank_account_id ?? p.from_bank_account_id) !== '' ? (parseInt(p.bank_account_id ?? p.from_bank_account_id, 10) || null) : null,
  })).filter(p => p.method) : [];
  return "'" + JSON.stringify(clean).replace(/'/g, "''") + "'::jsonb";
}

let query;

if (op === 'list') {
  const wh = [];
  if (body.date_from) wh.push(`doc_date >= ${esc(String(body.date_from).slice(0,10))}`);
  if (body.date_to)   wh.push(`doc_date <= ${esc(String(body.date_to).slice(0,10))}`);
  if (body.status)    wh.push(`status = ${esc(body.status)}`);
  const where = wh.length ? ('WHERE ' + wh.join(' AND ')) : '';
  query = `SELECT * FROM advance_expenses ${where} ORDER BY doc_date DESC, id DESC;`;
}
else if (op === 'save') {
  const id = intOrNull(body.id);
  const vendorId = intOrNull(body.vendor_id);
  const vendorLit = vendorId === null ? 'NULL' : String(vendorId);
  const pmLit = jsonbLit(body.payment_methods);
  if (id) {
    query = `UPDATE advance_expenses SET
        doc_date        = ${dateLit(body.doc_date)},
        vendor_id       = ${vendorLit},
        payee_name      = ${esc(body.payee_name)},
        amount          = ${num(body.amount)},
        payment_methods = ${pmLit},
        description     = ${esc(body.description)},
        note            = ${esc(body.note)},
        updated_at      = NOW()
      WHERE id = ${id} RETURNING *;`;
  } else {
    const d = dateLit(body.doc_date);
    query = `INSERT INTO advance_expenses (doc_no, doc_date, vendor_id, payee_name, amount, payment_methods, description, note, status, created_by)
      VALUES (
        'ADV-' || to_char(${d}, 'YYMMDD') || '-' ||
          lpad((COALESCE((SELECT COUNT(*) FROM advance_expenses WHERE doc_date = ${d}), 0) + 1)::text, 3, '0'),
        ${d}, ${vendorLit}, ${esc(body.payee_name)}, ${num(body.amount)}, ${pmLit}, ${esc(body.description)}, ${esc(body.note)},
        'pending', ${esc(body.created_by)}
      ) RETURNING *;`;
  }
}
else if (op === 'clear') {
  const id = intOrNull(body.id);
  if (!id) return [{ json: { query: "SELECT 'missing id' AS message" } }];
  query = `UPDATE advance_expenses SET status='cleared', cleared_at=NOW(), cleared_by=${esc(body.cleared_by)}, updated_at=NOW()
    WHERE id=${id} AND status='pending' RETURNING *;`;
}
else if (op === 'cancel') {
  const id = intOrNull(body.id);
  if (!id) return [{ json: { query: "SELECT 'missing id' AS message" } }];
  query = `UPDATE advance_expenses SET status='cancelled', updated_at=NOW()
    WHERE id=${id} AND status<>'cancelled' RETURNING *;`;
}
else {
  query = "SELECT 'unknown op' AS message";
}

return [{ json: { query } }];"""

RESPOND_JS = "={{ JSON.stringify($('PG ADV').all().map(i => i.json)) }}"

wf = {
    "name": "Advance Expense API",
    "nodes": [
        {
            "parameters": {
                "httpMethod": "POST",
                "path": "advance-expense-api",
                "responseMode": "responseNode",
                "options": {"allowedOrigins": "*"},
            },
            "id": "adv-webhook-0001",
            "name": "Webhook ADV",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [1328, 368],
            "webhookId": "wh-advance-expense",
        },
        {
            "parameters": {"jsCode": BUILD_JS},
            "id": "adv-code-0002",
            "name": "Build SQL ADV",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [1568, 368],
        },
        {
            "parameters": {
                "operation": "executeQuery",
                "query": "{{ $json.query }}",
                "options": {},
            },
            "id": "adv-pg-0003",
            "name": "PG ADV",
            "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.6,
            "position": [1808, 368],
            "alwaysOutputData": True,
            "credentials": {"postgres": {"id": "JLUeyZRAzUeRqlxu", "name": "Postgres account"}},
        },
        {
            "parameters": {
                "respondWith": "text",
                "responseBody": RESPOND_JS,
                "options": {
                    "responseHeaders": {
                        "entries": [
                            {"name": "Access-Control-Allow-Origin", "value": "*"},
                            {"name": "Content-Type", "value": "application/json"},
                        ]
                    }
                },
            },
            "id": "adv-respond-0004",
            "name": "Respond ADV",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1.5,
            "position": [2048, 368],
        },
    ],
    "pinData": {},
    "connections": {
        "Webhook ADV": {"main": [[{"node": "Build SQL ADV", "type": "main", "index": 0}]]},
        "Build SQL ADV": {"main": [[{"node": "PG ADV", "type": "main", "index": 0}]]},
        "PG ADV": {"main": [[{"node": "Respond ADV", "type": "main", "index": 0}]]},
    },
    "active": False,
    "settings": {"executionOrder": "v1"},
    "tags": [],
}

out = Path(__file__).with_name("advance_expense_workflow.json")
out.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding="utf-8")
print("wrote", out)
