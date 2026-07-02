# -*- coding: utf-8 -*-
# เพิ่มฟีเจอร์ "บันทึกโควต้าที่ได้รับ + เทียบแผน vs โควต้า" ใน honda-report-api
#  - ตารางใหม่ honda_quota_allocations (self-heal CREATE ในทุก action ที่แตะ)
#  - actions ใหม่: save_honda_quota (replace-all ต่อ period) / get_honda_quota
#  - list_honda_periods เพิ่ม plan_next_total + quota_total (ไว้ทำประวัติ fill rate)
import json, io, shutil

PATH = r"C:\Users\manat\OneDrive\New folder\Honda_Sales_Report_Workflow.json"
d = json.load(io.open(PATH, encoding="utf-8"))
nodes = {n["name"]: n for n in d["nodes"]}

MIG = ("CREATE TABLE IF NOT EXISTS honda_quota_allocations ("
       "period DATE NOT NULL, model_code TEXT NOT NULL, type TEXT NOT NULL DEFAULT '', "
       "color_code TEXT NOT NULL DEFAULT '', quota_qty INT NOT NULL DEFAULT 0, "
       "updated_at TIMESTAMPTZ DEFAULT now(), "
       "PRIMARY KEY (period, model_code, type, color_code)); ")

SAVE_QUOTA_JS = r"""// save_honda_quota: แทนที่โควต้าทั้งรอบ (period) — โควต้าที่ Honda จัดให้จริง
const b = $input.first().json.body || {};
const esc = v => (v===null||v===undefined||v==='') ? "''" : "'" + String(v).replace(/'/g,"''") + "'";
const num = v => { const n = Number(v); return Number.isFinite(n) ? String(Math.round(n)) : '0'; };
const period = String(b.period||'').slice(0,10);
if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(period)) return [{ json: { query: "SELECT 'missing period' AS __error" } }];
const pLit = "'" + period + "'::date";
const rows = (Array.isArray(b.rows) ? b.rows : []).filter(r => r && r.model_code && Number(r.quota_qty) > 0);
const vals = rows.map(r => "(" + pLit + ", " + esc(r.model_code) + ", " + esc(r.type||'') + ", " + esc(r.color_code||'') + ", " + num(r.quota_qty) + ", now())");
let q = "__MIG__";
q += "DELETE FROM honda_quota_allocations WHERE period = " + pLit + "; ";
if (vals.length) q += "INSERT INTO honda_quota_allocations(period,model_code,type,color_code,quota_qty,updated_at) VALUES " + vals.join(', ') + "; ";
q += "SELECT to_char(" + pLit + ",'YYYY-MM-DD') AS period, (SELECT count(*) FROM honda_quota_allocations WHERE period = " + pLit + ")::int AS saved_rows, (SELECT COALESCE(SUM(quota_qty),0) FROM honda_quota_allocations WHERE period = " + pLit + ")::int AS quota_total;";
return [{ json: { query: q } }];""".replace("__MIG__", MIG)

GET_QUOTA_JS = r"""// get_honda_quota: คืนโควต้าทั้งรอบ
const b = $input.first().json.body || {};
const period = String(b.period||'').slice(0,10);
if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(period)) return [{ json: { query: "SELECT 'missing period' AS __error" } }];
const pLit = "'" + period + "'::date";
const q = "__MIG__" + "SELECT model_code, type, color_code, quota_qty, to_char(period,'YYYY-MM-DD') AS period FROM honda_quota_allocations WHERE period = " + pLit + " ORDER BY model_code, type, color_code;";
return [{ json: { query: q } }];""".replace("__MIG__", MIG)

# ---- เพิ่ม 2 code nodes ----
d["nodes"].append({"id": "cd-quota-save", "name": "Build save quota SQL", "type": "n8n-nodes-base.code",
                   "typeVersion": 2, "position": [700, 560], "parameters": {"jsCode": SAVE_QUOTA_JS}})
d["nodes"].append({"id": "cd-quota-get", "name": "Build get quota SQL", "type": "n8n-nodes-base.code",
                   "typeVersion": 2, "position": [700, 640], "parameters": {"jsCode": GET_QUOTA_JS}})

# ---- Switch: เพิ่ม 2 rules ----
sw = nodes["Switch Action"]
rules = sw["parameters"]["rules"]["values"]
def mk_rule(rid, action):
    return {"conditions": {"options": {"caseSensitive": True, "typeValidation": "strict", "version": 2},
            "conditions": [{"id": rid, "leftValue": "={{ $json.body.action }}", "rightValue": action,
                            "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
            "renameOutput": True, "outputKey": action}
if not any(r.get("outputKey") == "save_honda_quota" for r in rules):
    rules.append(mk_rule("hr4", "save_honda_quota"))
    rules.append(mk_rule("hr5", "get_honda_quota"))

# ---- connections: switch outputs 3,4 → nodes ใหม่ → PG: Execute ----
conn = d["connections"]
sw_main = conn["Switch Action"]["main"]
while len(sw_main) < 5:
    sw_main.append([])
sw_main[3] = [{"node": "Build save quota SQL", "type": "main", "index": 0}]
sw_main[4] = [{"node": "Build get quota SQL", "type": "main", "index": 0}]
conn["Build save quota SQL"] = {"main": [[{"node": "PG: Execute", "type": "main", "index": 0}]]}
conn["Build get quota SQL"] = {"main": [[{"node": "PG: Execute", "type": "main", "index": 0}]]}

# ---- list_honda_periods: เพิ่ม plan_next_total + quota_total ----
ln = nodes["Build list SQL"]
c = ln["parameters"]["jsCode"]
old = "(SELECT count(*) FROM honda_sales_reports r WHERE r.period = m.period)::int AS rows FROM honda_sales_report_meta m"
new = ("(SELECT count(*) FROM honda_sales_reports r WHERE r.period = m.period)::int AS rows, "
       "(SELECT COALESCE(SUM(r.plan_next),0) FROM honda_sales_reports r WHERE r.period = m.period)::int AS plan_next_total, "
       "(SELECT COALESCE(SUM(q.quota_qty),0) FROM honda_quota_allocations q WHERE q.period = m.period)::int AS quota_total "
       "FROM honda_sales_report_meta m")
if c.count(old) != 1:
    raise SystemExit("list SQL anchor not found")
c = c.replace(old, new)
c = c.replace('const q = "SELECT', 'const q = "' + MIG + 'SELECT', 1)
ln["parameters"]["jsCode"] = c

shutil.copyfile(PATH, PATH + ".bak-quota")
with io.open(PATH, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print("OK — honda quota actions added, backup .bak-quota")
