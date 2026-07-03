# -*- coding: utf-8 -*-
# จัดการภาษีซื้อ: บันทึกสถานะเอาเข้า/เอาออกเอกสารที่จะยื่นลง DB (เดิมอยู่แค่ state หน้าจอ)
#  - ตารางใหม่ input_tax_doc_status (PK: source+affiliation+doc_no) — self-heal CREATE
#  - actions ใหม่: list_input_tax_status / save_input_tax_status (bulk upsert; สถานะว่าง/รีเซ็ต = DELETE)
#  - แก้ Aggregate ให้ pass-through แถวที่ไม่มีคอลัมน์ source (CRUD ต่าง ๆ เดิมโดนกรองทิ้ง)
import json, io, shutil

PATH = r"C:\Users\manat\OneDrive\New folder\Input_Tax_API.json"
d = json.load(io.open(PATH, encoding="utf-8"))
nodes = {n["name"]: n for n in d["nodes"]}

def repl(s, old, new, n_expected, tag):
    n = s.count(old)
    if n != n_expected:
        raise SystemExit("[%s] EXPECT %d got %d: %r" % (tag, n_expected, n, old[:80]))
    return s.replace(old, new)

STATUS_BRANCH = r"""// ===== สถานะเอกสารภาษีซื้อ (เอาเข้า/เอาออกจากแบบยื่น) — persist ลง DB =====
if (__act === 'list_input_tax_status' || __act === 'save_input_tax_status') {
  const ST_TBL = "CREATE TABLE IF NOT EXISTS input_tax_doc_status (source TEXT NOT NULL, affiliation TEXT NOT NULL DEFAULT '', doc_no TEXT NOT NULL, status TEXT NOT NULL, updated_by TEXT, updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (source, affiliation, doc_no));\n";
  const SE = (v) => "'" + String(v == null ? '' : v).replace(/'/g, "''") + "'";
  if (__act === 'list_input_tax_status') {
    return [{ json: { query: ST_TBL + "SELECT source, affiliation, doc_no, status FROM input_tax_doc_status;" } }];
  }
  const items = (Array.isArray(b.items) ? b.items : []).filter(it => it && it.source && it.doc_no);
  if (!items.length) return [{ json: { query: ST_TBL + "SELECT 0 AS saved;" } }];
  const by = SE(b.updated_by || '');
  const dels = items.filter(it => !it.status || it.status === 'รีเซ็ต');
  const ups = items.filter(it => it.status && it.status !== 'รีเซ็ต');
  let q = ST_TBL;
  for (const it of dels) {
    q += "DELETE FROM input_tax_doc_status WHERE source=" + SE(it.source) + " AND affiliation=" + SE(it.affiliation || '') + " AND doc_no=" + SE(it.doc_no) + ";\n";
  }
  if (ups.length) {
    const vals = ups.map(it => "(" + SE(it.source) + ", " + SE(it.affiliation || '') + ", " + SE(it.doc_no) + ", " + SE(it.status) + ", " + by + ")").join(', ');
    q += "INSERT INTO input_tax_doc_status (source, affiliation, doc_no, status, updated_by) VALUES " + vals + " ON CONFLICT (source, affiliation, doc_no) DO UPDATE SET status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = NOW();\n";
  }
  q += "SELECT " + items.length + " AS saved;";
  return [{ json: { query: q } }];
}
"""

# ---- Build Query: แทรก branch ใหม่หลังบรรทัด __act ----
n = nodes["Build Query"]
c = n["parameters"]["jsCode"]
anchor = "const __act = b.action || 'list_input_tax';\n"
c = repl(c, anchor, anchor + STATUS_BRANCH, 1, "build-branch")
n["parameters"]["jsCode"] = c

# ---- Aggregate: pass-through แถวที่ไม่ใช่ input-tax rows ----
ag = nodes["Aggregate"]
AG_NEW = r"""const all = $input.all().map(i => i.json).filter(r => r && typeof r === 'object' && Object.keys(r).length > 0);
const rows = all.filter(r => r.source);
if (rows.length === 0 && all.length > 0) {
  // ผลจาก action อื่น (สถานะ/tax filings CRUD) — ส่งกลับตรง ๆ
  return [{ json: { rows: all, total: all.length } }];
}
let vat = 0, base = 0;
for (const r of rows) { vat += Number(r.vat_amount) || 0; base += Number(r.amount_before_vat) || 0; }
return [{ json: { rows, total: rows.length, sum_vat: Math.round(vat * 100) / 100, sum_base: Math.round(base * 100) / 100 } }];"""
ag["parameters"]["jsCode"] = AG_NEW

shutil.copyfile(PATH, PATH + ".bak-docstatus")
with io.open(PATH, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print("OK — input_tax doc status actions + Aggregate pass-through, backup .bak-docstatus")
