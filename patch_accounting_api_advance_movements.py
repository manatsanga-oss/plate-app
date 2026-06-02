"""
Patch Accounting API workflow: เพิ่ม CTE adv_movements ใน node "Code List Movements"
ให้ค่าใช้จ่ายจ่ายล่วงหน้า (advance_expenses) ที่จ่ายด้วยวิธี "โอน" แสดงเป็นเงินออก (CR)
ในรายงานการเคลื่อนไหวบัญชีธนาคาร

input : Accounting API (13).json  (ไฟล์ที่ export มาจาก n8n)
output: Accounting API (advance-patched).json  -> import ทับใน n8n
"""
import json
from pathlib import Path

SRC = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (13).json")
OUT = Path(r"C:/Users/manat/OneDrive/New folder/Accounting API (advance-patched).json")

wf = json.loads(SRC.read_text(encoding="utf-8"))

ADV_CTE = (
    "),\n"
    "adv_movements AS (\n"
    "  SELECT\n"
    "    ae.doc_date::timestamptz AS movement_date,\n"
    "    ae.doc_no AS doc_no,\n"
    "    'จ่ายล่วงหน้า' AS movement_type,\n"
    "    ae.payee_name AS counterparty,\n"
    "    COALESCE(m->>'method','โอน') AS payment_method,\n"
    "    ae.note,\n"
    "    -(COALESCE((m->>'amount')::numeric, 0)) AS amount,\n"
    "    'out' AS direction,\n"
    "    0 AS wht_amount\n"
    "  FROM advance_expenses ae\n"
    "  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(ae.payment_methods, '[]'::jsonb)) AS m ON TRUE\n"
    "  WHERE ae.status <> 'cancelled'\n"
    "    AND (m->>'method') = 'โอน'\n"
    "    AND (m->>'bank_account_id')::int = ${accId}\n"
    "    ${dateFrom ? `AND ae.doc_date >= '${dateFrom}'::date` : ''}\n"
    "    ${dateTo ? `AND ae.doc_date <= '${dateTo}'::date` : ''}\n"
    ")\n"
    "SELECT * FROM lip_movements\n"
    "UNION ALL\n"
    "SELECT * FROM adv_movements\n"
    "UNION ALL\n"
    "SELECT * FROM rs_movements"
)

ANCHOR = ")\nSELECT * FROM lip_movements\nUNION ALL\nSELECT * FROM rs_movements"

node = next((n for n in wf["nodes"] if n["name"] == "Code List Movements"), None)
if node is None:
    raise SystemExit("ไม่พบ node 'Code List Movements'")

code = node["parameters"]["jsCode"]

if "adv_movements" in code:
    raise SystemExit("ดูเหมือน patch ไปแล้ว (มี adv_movements อยู่แล้ว)")

count = code.count(ANCHOR)
if count != 1:
    raise SystemExit(f"anchor ไม่ตรง: พบ {count} จุด (ต้องเป็น 1)")

node["parameters"]["jsCode"] = code.replace(ANCHOR, ADV_CTE)

OUT.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding="utf-8")
print("patched OK ->", OUT)
print("jsCode length:", len(node["parameters"]["jsCode"]))
