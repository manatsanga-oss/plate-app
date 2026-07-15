import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/asset-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api"; // หมวดค่าใช้จ่าย (general_expense) — master เดียวกับหน้าบันทึกค่าใช้จ่าย

const emptyForm = () => ({
  category_name: "",
  useful_life_years: 5,
  asset_account_code: "",
  asset_account_name: "",
  depreciation_account_code: "",
  depreciation_account_name: "",
  accum_depreciation_account_code: "",
  accum_depreciation_account_name: "",
  expense_codes: [],   // หมวดค่าใช้จ่ายที่จับคู่ (หลายหมวดได้) — เก็บ DB เป็น string คั่น comma
  note: "",
  status: "active",
});

const parseCodes = v => String(v || "").split(",").map(s => s.trim()).filter(Boolean);

// ตั้งค่าหมวดหมู่สินทรัพย์ — master หมวดทรัพย์สิน + อายุใช้งาน/บัญชี 3 ตัว (สินทรัพย์ / ค่าเสื่อม / ค่าเสื่อมสะสม)
export default function AssetCategoryPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [message, setMessage] = useState("");
  const [expenseMaster, setExpenseMaster] = useState([]); // หมวดค่าใช้จ่ายจาก master (general_expense)
  const [mergeSource, setMergeSource] = useState(null);   // หมวดต้นทางที่จะยุบรวม (null = ปิด modal)
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging] = useState(false);

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { fetchExpenseMaster(); }, []);

  async function fetchExpenseMaster() {
    try {
      const res = await fetch(MASTER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "general_expense", op: "list" }),
      });
      const data = await res.json();
      setExpenseMaster((Array.isArray(data) ? data : []).filter(g => g && g.expense_code));
    } catch { setExpenseMaster([]); }
  }

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        // โหลดทุกหมวดรวมที่ปิดเสมอ — ต้องเห็นครบเพื่อกันหมวดค่าใช้จ่ายซ้ำข้ามหมวดสินทรัพย์ (แสดง/ซ่อนที่ปิดกรองฝั่ง UI)
        body: JSON.stringify({ action: "list_asset_categories", include_inactive: "true" }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data.filter(r => r && r.category_id) : []);
    } catch { setMessage("❌ โหลดไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.category_name.trim()) { setMessage("❌ กรุณากรอกชื่อหมวดหมู่"); return; }
    const years = Number(form.useful_life_years);
    if (form.useful_life_years === "" || !(years >= 0)) { setMessage("❌ กรุณาระบุอายุการใช้งาน (0 = ไม่คิดค่าเสื่อม เช่น ที่ดิน)"); return; }
    // 1 หมวดค่าใช้จ่าย ผูกได้กับหมวดสินทรัพย์เดียว — กันซ้ำข้ามหมวด
    const dup = (form.expense_codes || []).find(c => codeOwner[c]);
    if (dup) { setMessage(`❌ หมวดค่าใช้จ่าย ${expLabel(dup)} ถูกใช้แล้วในหมวดสินทรัพย์ "${codeOwner[dup]}" — 1 หมวดค่าใช้จ่ายเลือกได้ 1 หมวดสินทรัพย์`); return; }
    setSaving(true); setMessage("");
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editTarget ? "update_asset_category" : "save_asset_category",
          ...(editTarget ? { category_id: editTarget.category_id } : {}),
          ...form,
          expense_codes: (form.expense_codes || []).join(","),
          created_by: currentUser?.username || currentUser?.name || "system",
        }),
      });
      setShowForm(false); setEditTarget(null); setForm(emptyForm());
      setMessage(`✅ ${editTarget ? "แก้ไข" : "เพิ่ม"}หมวดหมู่สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function toggleStatus(r) {
    const newStatus = r.status === "active" ? "inactive" : "active";
    if (!window.confirm(`${newStatus === "active" ? "เปิด" : "ปิด"}ใช้งานหมวด "${r.category_name}"?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_asset_category", category_id: r.category_id, status: newStatus }),
      });
      fetchData();
    } catch { setMessage("❌ ไม่สำเร็จ"); }
  }

  // ยุบรวมหมวด: ย้ายสินทรัพย์ทั้งหมดจากหมวดต้นทางไปหมวดปลายทาง + รวม expense_codes แล้วลบหมวดต้นทาง
  async function handleMerge() {
    const src = mergeSource;
    const tgt = rows.find(r => String(r.category_id) === String(mergeTargetId));
    if (!src || !tgt) { setMessage("❌ กรุณาเลือกหมวดปลายทาง"); return; }
    if (!window.confirm(`ยุบรวมหมวด "${src.category_name}" เข้ากับ "${tgt.category_name}"?\n\nสินทรัพย์ทั้งหมดในหมวด "${src.category_name}" จะย้ายไปหมวด "${tgt.category_name}" และหมวดเดิมจะถูกลบ (ย้อนกลับไม่ได้)`)) return;
    setMerging(true); setMessage("");
    try {
      const mergedCodes = [...new Set([...parseCodes(tgt.expense_codes), ...parseCodes(src.expense_codes)])].join(",");
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge_asset_category",
          source_category_id: src.category_id,
          target_category_id: tgt.category_id,
          expense_codes: mergedCodes,
        }),
      });
      const data = await res.json();
      const err = Array.isArray(data) ? data.find(d => d && d.error) : (data && data.error ? data : null);
      if (err) { setMessage(`❌ ยุบรวมไม่สำเร็จ: ${err.error}`); }
      else {
        setMessage(`✅ ยุบรวม "${src.category_name}" เข้ากับ "${tgt.category_name}" สำเร็จ`);
        setMergeSource(null); setMergeTargetId("");
        fetchData();
      }
    } catch { setMessage("❌ เกิดข้อผิดพลาด"); }
    setMerging(false);
  }

  function openEdit(r) {
    setForm({
      category_name: r.category_name || "",
      useful_life_years: r.useful_life_years || 5,
      asset_account_code: r.asset_account_code || "",
      asset_account_name: r.asset_account_name || "",
      depreciation_account_code: r.depreciation_account_code || "",
      depreciation_account_name: r.depreciation_account_name || "",
      accum_depreciation_account_code: r.accum_depreciation_account_code || "",
      accum_depreciation_account_name: r.accum_depreciation_account_name || "",
      expense_codes: parseCodes(r.expense_codes),
      note: r.note || "",
      status: r.status || "active",
    });
    setEditTarget(r);
    setShowForm(true);
  }
  function openAdd() { setForm(emptyForm()); setEditTarget(null); setShowForm(true); }

  const pctOf = (years) => {
    const y = Number(years);
    if (years === "" || years == null || !(y >= 0)) return "-";
    if (y === 0) return "ไม่คิดค่าเสื่อม";  // เช่น ที่ดิน
    return (100 / y).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  };
  const acct = (code, name) => (code || name) ? `${code || "-"} / ${name || "-"}` : "-";
  // ชื่อหมวดค่าใช้จ่ายจากรหัส (master general_expense) — ไม่พบใน master แสดงรหัสเดิม
  const expLabel = (code) => {
    const g = expenseMaster.find(x => String(x.expense_code) === String(code));
    return g ? `${g.expense_code} — ${g.expense_name}` : String(code);
  };

  // หมวดค่าใช้จ่าย 1 หมวด ผูกได้กับหมวดสินทรัพย์เดียว — map รหัส → ชื่อหมวดสินทรัพย์ที่ใช้อยู่ (ไม่นับหมวดที่กำลังแก้ไข)
  const codeOwner = {};
  rows.forEach(r => {
    if (editTarget && String(r.category_id) === String(editTarget.category_id)) return;
    parseCodes(r.expense_codes).forEach(c => { codeOwner[c] = r.category_name; });
  });

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!includeInactive && r.status !== "active") return false;
    if (!kw) return true;
    const hay = [r.category_name, r.asset_account_code, r.asset_account_name, r.depreciation_account_code, r.depreciation_account_name, r.accum_depreciation_account_code, r.accum_depreciation_account_name, r.expense_codes, ...parseCodes(r.expense_codes).map(expLabel)].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🗂️ ตั้งค่าหมวดหมู่สินทรัพย์</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <input type="text" placeholder="🔍 ค้นหา (ชื่อหมวดหมู่, รหัส/ชื่อบัญชี)"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 260 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          แสดงที่ปิด
        </label>
        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          🔄 รีเฟรช
        </button>
        <button onClick={openAdd}
          style={{ padding: "7px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
          ➕ เพิ่มหมวดหมู่สินทรัพย์
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีหมวดหมู่ — กด "➕ เพิ่มหมวดหมู่สินทรัพย์"</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>ชื่อหมวดหมู่</th>
                <th style={{ ...th, textAlign: "center" }}>อายุใช้งาน (ปี)</th>
                <th style={{ ...th, textAlign: "center" }}>ค่าเสื่อมต่อปี</th>
                <th style={th}>บัญชีสินทรัพย์</th>
                <th style={th}>บัญชีที่ลงค่าเสื่อมราคา</th>
                <th style={th}>บัญชีที่ลงค่าเสื่อมราคาสะสม</th>
                <th style={th}>หมวดค่าใช้จ่าย</th>
                <th style={th}>สถานะ</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.category_id} style={{ borderTop: "1px solid #e5e7eb", opacity: r.status === "inactive" ? 0.5 : 1 }}>
                  <td style={{ ...td, fontWeight: 600, cursor: "pointer", color: "#0369a1" }}
                    title="คลิกดูรายละเอียด" onClick={() => setViewTarget(r)}>
                    {r.category_name}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>{Number(r.useful_life_years) || "-"}</td>
                  <td style={{ ...td, textAlign: "center", color: "#059669", fontWeight: 600 }}>{pctOf(r.useful_life_years)}</td>
                  <td style={td}>{acct(r.asset_account_code, r.asset_account_name)}</td>
                  <td style={td}>{acct(r.depreciation_account_code, r.depreciation_account_name)}</td>
                  <td style={td}>{acct(r.accum_depreciation_account_code, r.accum_depreciation_account_name)}</td>
                  <td style={td}>
                    {parseCodes(r.expense_codes).length === 0 ? "-" : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 220 }}>
                        {parseCodes(r.expense_codes).map(c => (
                          <span key={c} title={expLabel(c)} style={{ padding: "1px 7px", background: "#e0f2fe", color: "#075985", borderRadius: 10, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{c}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: r.status === "active" ? "#d1fae5" : "#fee2e2", color: r.status === "active" ? "#065f46" : "#991b1b" }}>
                      {r.status === "active" ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <button onClick={() => setViewTarget(r)} style={btnView} title="ดูรายละเอียด">👁️</button>
                    <button onClick={() => openEdit(r)} style={btnEdit} title="แก้ไข">✏️</button>
                    <button onClick={() => { setMergeSource(r); setMergeTargetId(""); }} style={btnMerge} title="ยุบรวมเข้าหมวดอื่น">🔀</button>
                    <button onClick={() => toggleStatus(r)} style={r.status === "active" ? btnDel : btnReact}>
                      {r.status === "active" ? "ปิด" : "เปิด"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View modal — ตามแบบ FlowAccount "ดูหมวดหมู่สินทรัพย์" */}
      {viewTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setViewTarget(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 26, borderRadius: 12, width: 560, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 2px", color: "#0284c7" }}>ดูหมวดหมู่สินทรัพย์</h3>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>รายละเอียดหมวดหมู่สินทรัพย์</div>
            <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", rowGap: 12, fontSize: 14 }}>
              <div style={vlbl}>ชื่อหมวดหมู่:</div>
              <div style={{ fontWeight: 700 }}>🏘️ {viewTarget.category_name}</div>
              <div style={vlbl}>อายุการใช้งานทางบัญชี (ปี):</div>
              <div>{Number(viewTarget.useful_life_years) || "-"} ปี</div>
              <div style={vlbl}>คำนวณค่าเสื่อมต่อปี (%):</div>
              <div>{pctOf(viewTarget.useful_life_years)}</div>
              <div style={{ gridColumn: "1 / span 2", borderTop: "1px solid #e5e7eb" }} />
              <div style={vlbl}>บัญชีสินทรัพย์:</div>
              <div>{acct(viewTarget.asset_account_code, viewTarget.asset_account_name)}</div>
              <div style={vlbl}>บัญชีค่าเสื่อมราคา:</div>
              <div>{acct(viewTarget.depreciation_account_code, viewTarget.depreciation_account_name)}</div>
              <div style={vlbl}>บัญชีค่าเสื่อมราคาสะสม:</div>
              <div>{acct(viewTarget.accum_depreciation_account_code, viewTarget.accum_depreciation_account_name)}</div>
              <div style={vlbl}>หมวดหมู่ค่าใช้จ่าย:</div>
              <div>
                {parseCodes(viewTarget.expense_codes).length === 0 ? "-" : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {parseCodes(viewTarget.expense_codes).map(c => <div key={c}>{expLabel(c)}</div>)}
                  </div>
                )}
              </div>
              {viewTarget.note && (<>
                <div style={vlbl}>หมายเหตุ:</div>
                <div style={{ color: "#6b7280" }}>{viewTarget.note}</div>
              </>)}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => { openEdit(viewTarget); setViewTarget(null); }}
                style={{ padding: "8px 16px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>✏️ แก้ไข</button>
              <button onClick={() => setViewTarget(null)}
                style={{ padding: "8px 20px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}

      {/* Merge modal — ยุบรวมหมวดเข้ากับหมวดอื่น */}
      {mergeSource && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !merging && setMergeSource(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 24, borderRadius: 12, width: 520, maxWidth: "95vw" }}>
            <h3 style={{ margin: "0 0 4px", color: "#072d6b" }}>🔀 ยุบรวมหมวดหมู่สินทรัพย์</h3>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>ย้ายสินทรัพย์ทั้งหมดไปหมวดปลายทาง รวมหมวดค่าใช้จ่ายที่ผูกไว้ แล้วลบหมวดต้นทาง</div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>หมวดต้นทาง (จะถูกลบหลังยุบรวม)</label>
              <input value={mergeSource.category_name} readOnly disabled style={{ ...inp, background: "#f3f4f6", fontWeight: 700 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>ยุบรวมเข้ากับหมวด *</label>
              <select value={mergeTargetId} onChange={e => setMergeTargetId(e.target.value)} style={inp}>
                <option value="">-- เลือกหมวดปลายทาง --</option>
                {rows.filter(r => String(r.category_id) !== String(mergeSource.category_id)).map(r => (
                  <option key={r.category_id} value={r.category_id}>
                    {r.category_name}{r.status === "inactive" ? " (ปิดใช้งาน)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#991b1b", marginBottom: 14 }}>
              ⚠️ สินทรัพย์ทุกตัวในหมวด "{mergeSource.category_name}" จะย้ายไปหมวดปลายทาง และหมวดต้นทางจะถูกลบถาวร (อายุการใช้งาน/ผังบัญชีของสินทรัพย์แต่ละตัวไม่เปลี่ยน เพราะเก็บรายตัวอยู่แล้ว)
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setMergeSource(null)} disabled={merging}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleMerge} disabled={merging || !mergeTargetId}
                style={{ padding: "8px 20px", background: (merging || !mergeTargetId) ? "#9ca3af" : "#b45309", color: "#fff", border: "none", borderRadius: 8, cursor: (merging || !mergeTargetId) ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {merging ? "กำลังยุบรวม..." : "🔀 ยุบรวม"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 640, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>{editTarget ? "✏️ แก้ไขหมวดหมู่สินทรัพย์" : "➕ เพิ่มหมวดหมู่สินทรัพย์"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>ชื่อหมวดหมู่ *</label>
                <input value={form.category_name} onChange={e => setForm(f => ({ ...f, category_name: e.target.value }))}
                  placeholder="เช่น คอมพิวเตอร์/อุปกรณ์ไอที" style={inp} />
              </div>
              <div>
                <label style={lbl}>อายุการใช้งานทางบัญชี (ปี) * <span style={{ fontWeight: 400, color: "#9ca3af" }}>(0 = ไม่คิดค่าเสื่อม เช่น ที่ดิน)</span></label>
                <input type="number" min="0" step="0.5" value={form.useful_life_years}
                  onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))}
                  style={{ ...inp, fontFamily: "monospace", textAlign: "right" }} />
              </div>
              <div>
                <label style={lbl}>คำนวณค่าเสื่อมต่อปี (%)</label>
                <input value={pctOf(form.useful_life_years)} readOnly disabled
                  style={{ ...inp, background: "#f3f4f6", textAlign: "right", color: "#059669", fontWeight: 700 }} />
              </div>

              <div style={{ gridColumn: "1 / span 2", borderTop: "1px solid #e5e7eb", paddingTop: 6, fontSize: 12, fontWeight: 700, color: "#0369a1" }}>ผังบัญชีที่เกี่ยวข้อง</div>
              <div>
                <label style={lbl}>รหัสบัญชีสินทรัพย์</label>
                <input value={form.asset_account_code} onChange={e => setForm(f => ({ ...f, asset_account_code: e.target.value }))}
                  placeholder="เช่น 12612" style={{ ...inp, fontFamily: "monospace" }} />
              </div>
              <div>
                <label style={lbl}>ชื่อบัญชีสินทรัพย์</label>
                <input value={form.asset_account_name} onChange={e => setForm(f => ({ ...f, asset_account_name: e.target.value }))}
                  placeholder="เช่น คอมพิวเตอร์" style={inp} />
              </div>
              <div>
                <label style={lbl}>รหัสบัญชีค่าเสื่อมราคา</label>
                <input value={form.depreciation_account_code} onChange={e => setForm(f => ({ ...f, depreciation_account_code: e.target.value }))}
                  placeholder="เช่น 58612" style={{ ...inp, fontFamily: "monospace" }} />
              </div>
              <div>
                <label style={lbl}>ชื่อบัญชีค่าเสื่อมราคา</label>
                <input value={form.depreciation_account_name} onChange={e => setForm(f => ({ ...f, depreciation_account_name: e.target.value }))}
                  placeholder="เช่น ค่าเสื่อมราคา คอมพิวเตอร์" style={inp} />
              </div>
              <div>
                <label style={lbl}>รหัสบัญชีค่าเสื่อมราคาสะสม</label>
                <input value={form.accum_depreciation_account_code} onChange={e => setForm(f => ({ ...f, accum_depreciation_account_code: e.target.value }))}
                  placeholder="เช่น 18612" style={{ ...inp, fontFamily: "monospace" }} />
              </div>
              <div>
                <label style={lbl}>ชื่อบัญชีค่าเสื่อมราคาสะสม</label>
                <input value={form.accum_depreciation_account_name} onChange={e => setForm(f => ({ ...f, accum_depreciation_account_name: e.target.value }))}
                  placeholder="เช่น ค่าเสื่อมราคาสะสม คอมพิวเตอร์" style={inp} />
              </div>

              <div style={{ gridColumn: "1 / span 2", borderTop: "1px solid #e5e7eb", paddingTop: 6, fontSize: 12, fontWeight: 700, color: "#0369a1" }}>หมวดหมู่ค่าใช้จ่ายที่เกี่ยวข้อง</div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมวดหมู่ค่าใช้จ่าย <span style={{ fontWeight: 400, color: "#9ca3af" }}>(หมวดเดียวกับตอนบันทึกค่าใช้จ่าย — เลือกได้หลายหมวด · 1 หมวดค่าใช้จ่ายผูกได้กับหมวดสินทรัพย์เดียว)</span></label>
                <select value="" onChange={e => {
                  const c = e.target.value;
                  if (c) setForm(f => ({ ...f, expense_codes: f.expense_codes.includes(c) ? f.expense_codes : [...f.expense_codes, c] }));
                }} style={inp}>
                  <option value="">-- เลือกหมวดค่าใช้จ่ายเพื่อเพิ่ม --</option>
                  {expenseMaster
                    .filter(g => !form.expense_codes.includes(String(g.expense_code)))
                    .map(g => {
                      const owner = codeOwner[String(g.expense_code)];
                      return (
                        <option key={g.expense_id || g.expense_code} value={g.expense_code} disabled={!!owner}>
                          {g.expense_code} — {g.expense_name}{owner ? ` (ใช้แล้วใน: ${owner})` : ""}
                        </option>
                      );
                    })}
                </select>
                {form.expense_codes.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {form.expense_codes.map(c => (
                      <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "#e0f2fe", color: "#075985", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                        {expLabel(c)}
                        <button type="button" title="เอาออก"
                          onClick={() => setForm(f => ({ ...f, expense_codes: f.expense_codes.filter(x => x !== c) }))}
                          style={{ border: "none", background: "transparent", color: "#075985", cursor: "pointer", fontWeight: 700, padding: 0, lineHeight: 1, fontSize: 13 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical" }} />
              </div>
              <div>
                <label style={lbl}>สถานะ</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                  <option value="active">ใช้งาน</option>
                  <option value="inactive">ปิด</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowForm(false)} disabled={saving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: "8px 20px", background: saving ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3, color: "#374151" };
const vlbl = { fontWeight: 600, color: "#374151" };
const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box", width: "100%" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "10px 8px", fontSize: 13 };
const btnView = { padding: "4px 10px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnEdit = { padding: "4px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnMerge = { padding: "4px 10px", background: "#b45309", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnDel = { padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
const btnReact = { padding: "4px 10px", background: "#059669", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
