import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";

const emptyForm = (monthYear, employeeName) => ({
  month_year: monthYear || firstOfMonth(new Date()),
  employee_name: employeeName || "",
  bonus: 0,
  ot_holiday: 0,
  other_income: 0,
  tax: 0,
  absence_late: 0,
  other_expense: 0,
  admin_expense: 0,
  lost_items: 0,
  note: "",
});

function firstOfMonth(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function HrMonthlyExtrasPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [month, setMonth] = useState(firstOfMonth(new Date()));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchEmployees();
    /* eslint-disable-next-line */
  }, []);
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [month]);

  async function fetchEmployees() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_hr_employees", include_inactive: "false" }),
      });
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch { setEmployees([]); }
  }

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_monthly_extras", month_year: month }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ โหลดไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.employee_name) { setMessage("❌ เลือกพนักงาน"); return; }
    setSaving(true); setMessage("");
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_monthly_extra",
          ...form,
          created_by: currentUser?.username || "system",
        }),
      });
      setShowForm(false); setForm(emptyForm(month));
      setMessage(`✅ บันทึกสำเร็จ`);
      fetchData();
    } catch { setMessage("❌ เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function handleDelete(r) {
    if (!window.confirm(`ลบรายการของ "${r.employee_name}" เดือน ${monthDisplay(r.month_year)}?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_monthly_extra", id: r.id }),
      });
      setMessage(`✅ ลบแล้ว`);
      fetchData();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  function openEdit(r) {
    setForm({
      month_year: String(r.month_year).slice(0, 10),
      employee_name: r.employee_name,
      bonus: Number(r.bonus || 0),
      ot_holiday: Number(r.ot_holiday || 0),
      other_income: Number(r.other_income || 0),
      tax: Number(r.tax || 0),
      absence_late: Number(r.absence_late || 0),
      other_expense: Number(r.other_expense || 0),
      admin_expense: Number(r.admin_expense || 0),
      lost_items: Number(r.lost_items || 0),
      note: r.note || "",
    });
    setShowForm(true);
  }

  function openAdd() {
    setForm(emptyForm(month));
    setShowForm(true);
  }

  function fmtNum(v) {
    return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function monthDisplay(d) {
    if (!d) return "-";
    const dt = new Date(d);
    if (isNaN(dt)) return String(d).slice(0, 7);
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return `${months[dt.getMonth()]} ${dt.getFullYear() + 543}`;
  }

  // local search
  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!kw) return true;
    return r.employee_name.toLowerCase().includes(kw);
  });

  // totals
  const totalIncome = filtered.reduce((s, r) => s + Number(r.bonus || 0) + Number(r.ot_holiday || 0) + Number(r.other_income || 0), 0);
  const totalExpense = filtered.reduce((s, r) => s + Number(r.tax || 0) + Number(r.absence_late || 0) + Number(r.other_expense || 0) + Number(r.admin_expense || 0) + Number(r.lost_items || 0), 0);

  // employees not yet in list (for quick-add)
  const emptyEmployees = employees.filter(e => !rows.some(r => r.employee_name === e.employee_name));

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📝 กรอกรายเดือน (รายได้/รายจ่ายพิเศษ)</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>เดือน:</label>
        <input type="month" value={month.slice(0, 7)} onChange={e => setMonth(e.target.value + "-01")}
          style={inp} />
        <span style={{ fontSize: 13, color: "#072d6b", fontWeight: 600 }}>{monthDisplay(month)}</span>

        <input type="text" placeholder="🔍 ค้นหาพนักงาน"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 200 }} />

        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          🔄 รีเฟรช
        </button>
        <button onClick={openAdd}
          style={{ padding: "7px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
          ➕ เพิ่ม
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 13 }}>👥 พนักงาน: <strong>{filtered.length}</strong> / ทั้งหมด {employees.length} คน</span>
        <span style={{ fontSize: 13, color: "#059669" }}>💰 รวมรายได้: <strong>{fmtNum(totalIncome)}</strong></span>
        <span style={{ fontSize: 13, color: "#dc2626" }}>📤 รวมรายจ่าย: <strong>{fmtNum(totalExpense)}</strong></span>
        {emptyEmployees.length > 0 && (
          <span style={{ fontSize: 13, color: "#ea580c", marginLeft: "auto" }}>
            ⚠️ ยังไม่มีข้อมูล {emptyEmployees.length} คน
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
            ยังไม่มีข้อมูลเดือน {monthDisplay(month)} — กด "➕ เพิ่ม"
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>พนักงาน</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>โบนัส</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>OT-ปกติ</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>รายได้อื่น</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ภาษี</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ขาด-สาย</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>รายจ่ายอื่น</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ค่าใช้จ่ายผู้บริหาร</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ของหาย</th>
                <th style={th}>หมายเหตุ</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.employee_name}</td>
                  <td style={tdNum}>{fmtNum(r.bonus)}</td>
                  <td style={tdNum}>{fmtNum(r.ot_holiday)}</td>
                  <td style={tdNum}>{fmtNum(r.other_income)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.tax)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.absence_late)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.other_expense)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.admin_expense)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.lost_items)}</td>
                  <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>{r.note || ""}</td>
                  <td style={td}>
                    <button onClick={() => openEdit(r)} style={btnEdit}>✏️</button>
                    <button onClick={() => handleDelete(r)} style={btnDelete}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
              <tr>
                <td style={{ ...td, textAlign: "right" }}>รวม {filtered.length} คน</td>
                <td style={tdNum}>{fmtNum(filtered.reduce((s, r) => s + Number(r.bonus || 0), 0))}</td>
                <td style={tdNum}>{fmtNum(filtered.reduce((s, r) => s + Number(r.ot_holiday || 0), 0))}</td>
                <td style={tdNum}>{fmtNum(filtered.reduce((s, r) => s + Number(r.other_income || 0), 0))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(filtered.reduce((s, r) => s + Number(r.tax || 0), 0))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(filtered.reduce((s, r) => s + Number(r.absence_late || 0), 0))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(filtered.reduce((s, r) => s + Number(r.other_expense || 0), 0))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(filtered.reduce((s, r) => s + Number(r.admin_expense || 0), 0))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(filtered.reduce((s, r) => s + Number(r.lost_items || 0), 0))}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 700, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>📝 กรอกรายการ {monthDisplay(form.month_year)}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={lbl}>เดือน *</label>
                <input type="month" value={form.month_year.slice(0, 7)} onChange={e => setForm(f => ({ ...f, month_year: e.target.value + "-01" }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>พนักงาน *</label>
                <select value={form.employee_name} onChange={e => setForm(f => ({ ...f, employee_name: e.target.value }))} style={inp}>
                  <option value="">-- เลือก --</option>
                  {employees.map(e => (
                    <option key={e.employee_id} value={e.employee_name}>{e.employee_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ padding: 10, border: "1px solid #d1fae5", borderRadius: 8, marginBottom: 10, background: "#f0fdf4" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46", marginBottom: 8 }}>💰 รายได้</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <Field label="โบนัส">
                  <input type="number" step="0.01" value={form.bonus} onChange={e => setForm(f => ({ ...f, bonus: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="OT-ปกติ">
                  <input type="number" step="0.01" value={form.ot_holiday} onChange={e => setForm(f => ({ ...f, ot_holiday: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="รายได้อื่นๆ">
                  <input type="number" step="0.01" value={form.other_income} onChange={e => setForm(f => ({ ...f, other_income: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
              </div>
            </div>

            <div style={{ padding: 10, border: "1px solid #fecaca", borderRadius: 8, marginBottom: 10, background: "#fef2f2" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b", marginBottom: 8 }}>📤 รายจ่าย/หัก</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <Field label="ภาษี">
                  <input type="number" step="0.01" value={form.tax} onChange={e => setForm(f => ({ ...f, tax: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="ขาด-สาย">
                  <input type="number" step="0.01" value={form.absence_late} onChange={e => setForm(f => ({ ...f, absence_late: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="รายจ่ายอื่นๆ">
                  <input type="number" step="0.01" value={form.other_expense} onChange={e => setForm(f => ({ ...f, other_expense: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="ค่าใช้จ่ายผู้บริหาร">
                  <input type="number" step="0.01" value={form.admin_expense} onChange={e => setForm(f => ({ ...f, admin_expense: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
                <Field label="ของหาย">
                  <input type="number" step="0.01" value={form.lost_items} onChange={e => setForm(f => ({ ...f, lost_items: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
              </div>
            </div>

            <div>
              <label style={lbl}>หมายเหตุ</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowForm(false)} disabled={saving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving || !form.employee_name}
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

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 2, color: "#374151" }}>{label}</label>
      {children}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3, color: "#374151" };
const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box", width: "100%" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const tdNum = { padding: "8px", fontSize: 12, textAlign: "right", fontFamily: "monospace" };
const btnEdit = { padding: "4px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnDelete = { padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
