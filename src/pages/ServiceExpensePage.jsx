import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

const emptyForm = () => ({
  expense_name: "",
  expense_type: "fixed",
  group_by: "income_type",
  income_type: "",
  income_code: "",
  income_name: "",
  income_amount: "",
  amount: "",
  match_from_province: "",
  match_double_transfer: false,
  match_to_province: "",
  note: "",
  status: "active",
});

export default function ServiceExpensePage({ currentUser }) {
  const [tab, setTab] = useState("income_type");  // จะเพิ่ม tab อื่นๆ ในอนาคต
  const [rows, setRows] = useState([]);
  const [incomeTypes, setIncomeTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [filterIncomeType, setFilterIncomeType] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchData();
    fetchIncomeTypes();
    /* eslint-disable-next-line */
  }, [tab, includeInactive]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_service_expenses",
          group_by: tab,
          include_inactive: String(includeInactive),
        }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  async function fetchIncomeTypes() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_receipt_income_types" }),
      });
      const data = await res.json();
      setIncomeTypes(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }

  async function handleSave() {
    if (!form.expense_name.trim()) { setMessage("❌ กรุณากรอกชื่อรายการ"); return; }
    // amount required only for "fixed" expense type
    if (form.expense_type === "fixed" && (!form.amount || isNaN(Number(form.amount)))) {
      setMessage("❌ กรุณากรอกจำนวนเงิน (ค่าใช้จ่ายแบบคงที่)"); return;
    }
    setSaving(true); setMessage("");
    try {
      const payload = {
        action: editTarget ? "update_service_expense" : "save_service_expense",
        ...(editTarget ? { expense_id: editTarget.expense_id } : {}),
        ...form,
        group_by: tab,
      };
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setShowForm(false);
      setEditTarget(null);
      setForm(emptyForm());
      setMessage(`✅ ${editTarget ? "แก้ไข" : "เพิ่ม"}สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function toggleStatus(r) {
    const newStatus = r.status === "active" ? "inactive" : "active";
    if (!window.confirm(`${newStatus === "active" ? "เปิด" : "ปิด"}การใช้งาน "${r.expense_name}"?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_service_expense", expense_id: r.expense_id, status: newStatus }),
      });
      setMessage(`✅ ${newStatus === "active" ? "เปิด" : "ปิด"}ใช้งาน "${r.expense_name}"`);
      fetchData();
    } catch { setMessage("❌ ไม่สำเร็จ"); }
  }

  function openEdit(r) {
    setForm({
      expense_name: r.expense_name || "",
      expense_type: r.expense_type || "fixed",
      group_by: r.group_by || "income_type",
      income_type: r.income_type || "",
      income_code: r.income_code || "",
      income_name: r.income_name || "",
      income_amount: r.income_amount ?? "",
      amount: r.amount || "",
      match_from_province: r.match_from_province || "",
      match_double_transfer: !!r.match_double_transfer,
      match_to_province: r.match_to_province || "",
      note: r.note || "",
      status: r.status || "active",
    });
    setEditTarget(r);
    setShowForm(true);
  }
  function openAdd() {
    setForm({ ...emptyForm(), group_by: tab });
    setEditTarget(null);
    setShowForm(true);
  }

  function fmtNum(v) {
    const n = Number(v || 0);
    return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Local search filter
  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (filterIncomeType && r.income_type !== filterIncomeType) return false;
    if (!kw) return true;
    const hay = [r.expense_name, r.income_type, r.income_code, r.income_name, r.note]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const uniqueIncomeTypes = [...new Set(incomeTypes.map(i => i.income_type).filter(Boolean))].sort();

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💸 บันทึกค่าใช้จ่ายงานบริการ</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["income_type", "📋 ตามงานทะเบียนรับเรื่อง"],
          // เพิ่ม tab อื่นๆ ในอนาคตที่นี่
        ].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ padding: "10px 22px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: tab === v ? "#072d6b" : "#6b7280",
              borderBottom: tab === v ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>ประเภทรายได้:</label>
        <select value={filterIncomeType} onChange={e => setFilterIncomeType(e.target.value)} style={{ ...inp, minWidth: 200 }}>
          <option value="">ทุกประเภท</option>
          {uniqueIncomeTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="text" placeholder="🔍 ค้นหา (ชื่อรายการ, หมายเหตุ)"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 240 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          แสดงที่ปิดการใช้งาน
        </label>
        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 16px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          🔄 รีเฟรช
        </button>
        <button onClick={openAdd}
          style={{ padding: "7px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
          ➕ เพิ่มค่าใช้จ่าย
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล — กด "➕ เพิ่มค่าใช้จ่าย" เพื่อเริ่มต้น</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>รหัส</th>
                <th style={th}>ชื่อรายได้</th>
                <th style={th}>ยอดรายได้</th>
                <th style={th}>ชื่อรายการค่าใช้จ่าย</th>
                <th style={th}>ประเภท</th>
                <th style={th}>จำนวนเงิน</th>
                <th style={th}>จังหวัดต้นทาง</th>
                <th style={th}>โอน 2 ต่อ</th>
                <th style={th}>จังหวัดปลายทาง</th>
                <th style={th}>หมายเหตุ</th>
                <th style={th}>สถานะ</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.expense_id} style={{ borderTop: "1px solid #e5e7eb", opacity: r.status === "inactive" ? 0.5 : 1 }}>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.income_code || "-"}</td>
                  <td style={td}>{r.income_name || "(ทุกชื่อ)"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>
                    {r.income_amount != null && r.income_amount !== "" ? Number(r.income_amount).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : <span style={{ color: "#9ca3af" }}>(ทุกจำนวน)</span>}
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.expense_name}</td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: r.expense_type === "variable" ? "#fed7aa" : "#dbeafe", color: r.expense_type === "variable" ? "#9a3412" : "#1e40af" }}>
                      {r.expense_type === "variable" ? "ไม่คงที่" : "คงที่"}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: r.expense_type === "variable" ? "#9ca3af" : "#dc2626" }}>
                    {r.expense_type === "variable" ? "—" : fmtNum(r.amount) + " ฿"}
                  </td>
                  <td style={td}>
                    {r.match_from_province ? <span style={{ color: "#0369a1" }}>{r.match_from_province}</span> : <span style={{ color: "#9ca3af", fontSize: 11 }}>(ทุกจว.)</span>}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {r.match_double_transfer ? <span style={{ padding: "2px 8px", background: "#dcfce7", color: "#065f46", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>✓ โอน 2 ต่อ</span> : <span style={{ color: "#9ca3af" }}>-</span>}
                  </td>
                  <td style={td}>
                    {r.match_to_province ? <span style={{ color: "#0369a1" }}>{r.match_to_province}</span> : <span style={{ color: "#9ca3af", fontSize: 11 }}>(ทุกจว.)</span>}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{r.note || ""}</td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: r.status === "active" ? "#d1fae5" : "#fee2e2", color: r.status === "active" ? "#065f46" : "#991b1b" }}>
                      {r.status === "active" ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td style={td}>
                    <button onClick={() => openEdit(r)} style={btnEdit}>✏️ แก้ไข</button>
                    <button onClick={() => toggleStatus(r)} style={r.status === "active" ? btnDelete : btnReact}>
                      {r.status === "active" ? "ปิด" : "เปิด"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 700, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>{editTarget ? "✏️ แก้ไขค่าใช้จ่าย" : "➕ เพิ่มค่าใช้จ่าย"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>ชื่อรายการค่าใช้จ่าย *</label>
                <input value={form.expense_name} onChange={e => setForm(f => ({ ...f, expense_name: e.target.value }))}
                  placeholder="เช่น ค่าตรวจสภาพรถ, ค่าธรรมเนียมขนส่ง..." style={inp} />
              </div>

              <div>
                <label style={lbl}>เงื่อนไขการ Match: ประเภทรายได้</label>
                <input list="income-types" value={form.income_type}
                  onChange={e => setForm(f => ({ ...f, income_type: e.target.value }))}
                  placeholder="เช่น รายได้งานทะเบียน" style={inp} />
                <datalist id="income-types">
                  {uniqueIncomeTypes.map(t => <option key={t} value={t} />)}
                </datalist>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>เว้นว่าง = match ทุกประเภท</div>
              </div>

              <div>
                <label style={lbl}>ชื่อรายได้ (ตรงเป๊ะ)</label>
                <input value={form.income_name}
                  onChange={e => setForm(f => ({ ...f, income_name: e.target.value }))}
                  placeholder="เช่น ค่าต่อภาษี" style={inp} />
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>เว้นว่าง = match ทุกชื่อ</div>
              </div>

              <div>
                <label style={lbl}>รหัสรายได้</label>
                <input value={form.income_code}
                  onChange={e => setForm(f => ({ ...f, income_code: e.target.value }))}
                  placeholder="เช่น 002" style={{ ...inp, fontFamily: "monospace" }} />
              </div>

              <div>
                <label style={lbl}>จำนวนเงินรายได้ (ตรงเป๊ะ)</label>
                <input type="number" step="0.01" value={form.income_amount}
                  onChange={e => setForm(f => ({ ...f, income_amount: e.target.value }))}
                  placeholder="เช่น 200" style={{ ...inp, fontFamily: "monospace" }} />
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>เว้นว่าง = match ทุกจำนวน</div>
              </div>

              <div>
                <label style={lbl}>ประเภทค่าใช้จ่าย</label>
                <select value={form.expense_type} onChange={e => setForm(f => ({ ...f, expense_type: e.target.value, ...(e.target.value === "variable" ? { amount: "" } : {}) }))} style={inp}>
                  <option value="fixed">คงที่</option>
                  <option value="variable">ไม่คงที่ (กำหนดตอนใช้)</option>
                </select>
              </div>

              <div>
                <label style={lbl}>จำนวนเงิน {form.expense_type === "fixed" ? "*" : ""}</label>
                <input type="number" step="0.01" min="0" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  disabled={form.expense_type === "variable"}
                  placeholder={form.expense_type === "variable" ? "ผู้ใช้กำหนดตอนใช้งาน" : ""}
                  style={{ ...inp, fontFamily: "monospace", background: form.expense_type === "variable" ? "#f3f4f6" : "#fff", color: form.expense_type === "variable" ? "#9ca3af" : "#1f2937" }} />
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                  {form.expense_type === "variable" ? "ไม่ต้องระบุ — ผู้ใช้กรอกตอนใช้จริง" : "ใส่เป็นบาท"}
                </div>
              </div>

              <div>
                <label style={lbl}>สถานะ</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                  <option value="active">ใช้งาน</option>
                  <option value="inactive">ปิด</option>
                </select>
              </div>

              {/* === เงื่อนไข match จังหวัดและการโอน 2 ต่อ === */}
              <div style={{ gridColumn: "1 / span 2", marginTop: 4, padding: "10px 12px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", marginBottom: 8 }}>📍 เงื่อนไขจังหวัด / การโอน (เพิ่มเติม)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={lbl}>จังหวัดที่จดทะเบียน</label>
                    <input type="text" value={form.match_from_province}
                      onChange={e => setForm(f => ({ ...f, match_from_province: e.target.value }))}
                      placeholder="เช่น กรุงเทพ" style={inp} />
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>เว้นว่าง = match ทุกจังหวัด</div>
                  </div>
                  <div>
                    <label style={lbl}>จังหวัดที่จะจดทะเบียนเข้า</label>
                    <input type="text" value={form.match_to_province}
                      onChange={e => setForm(f => ({ ...f, match_to_province: e.target.value }))}
                      placeholder="เช่น อยุธยา" style={inp} />
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>เว้นว่าง = match ทุกจังหวัด</div>
                  </div>
                  <div style={{ gridColumn: "1 / span 2" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 0" }}>
                      <input type="checkbox" checked={form.match_double_transfer}
                        onChange={e => setForm(f => ({ ...f, match_double_transfer: e.target.checked }))}
                        style={{ width: 16, height: 16, cursor: "pointer" }} />
                      🔄 โอน 2 ต่อ
                    </label>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>เลือกถ้าค่าใช้จ่ายนี้ใช้กับการโอน 2 ต่อ</div>
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowForm(false)} disabled={saving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving || !form.expense_name.trim()}
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
const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box", width: "100%" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "10px 8px", fontSize: 13 };
const btnEdit = { padding: "4px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnDelete = { padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
const btnReact = { padding: "4px 10px", background: "#059669", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
