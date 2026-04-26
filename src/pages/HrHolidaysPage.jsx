import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";

const emptyForm = () => ({
  holiday_date: "",
  holiday_name: "",
  note: "",
  is_active: true,
});

export default function HrHolidaysPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [year]);

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_annual_holidays", year: String(year) }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ โหลดไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.holiday_date || !form.holiday_name.trim()) {
      setMessage("❌ กรุณาเลือกวันที่และกรอกชื่อ"); return;
    }
    setSaving(true); setMessage("");
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_annual_holiday",
          ...(editTarget ? { holiday_id: editTarget.holiday_id } : {}),
          ...form,
        }),
      });
      setShowForm(false); setEditTarget(null); setForm(emptyForm());
      setMessage(`✅ ${editTarget ? "แก้ไข" : "เพิ่ม"}สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function handleDelete(r) {
    if (!window.confirm(`ลบวันหยุด "${r.holiday_name}" (${r.holiday_date})?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_annual_holiday", holiday_id: r.holiday_id }),
      });
      setMessage(`✅ ลบ "${r.holiday_name}" แล้ว`);
      fetchData();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  function openEdit(r) {
    setForm({
      holiday_date: r.holiday_date ? String(r.holiday_date).slice(0, 10) : "",
      holiday_name: r.holiday_name || "",
      note: r.note || "",
      is_active: r.is_active !== false,
    });
    setEditTarget(r);
    setShowForm(true);
  }
  function openAdd() {
    setForm(emptyForm()); setEditTarget(null); setShowForm(true);
  }

  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสฯ", "ศุกร์", "เสาร์"];
    return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
  }

  // Group by month
  const byMonth = {};
  rows.forEach(r => {
    if (!r.holiday_date) return;
    const m = String(r.holiday_date).slice(5, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(r);
  });

  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const yearOpts = [];
  for (let y = new Date().getFullYear() - 1; y <= new Date().getFullYear() + 2; y++) yearOpts.push(y);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📅 ปฏิทินวันหยุดประจำปี</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>ปี:</label>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={inp}>
          {yearOpts.map(y => <option key={y} value={y}>{y} (พ.ศ. {y + 543})</option>)}
        </select>
        <span style={{ fontSize: 13, color: "#6b7280" }}>· ทั้งหมด <strong>{rows.length}</strong> วัน</span>
        <div style={{ flex: 1 }} />
        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          🔄 รีเฟรช
        </button>
        <button onClick={openAdd}
          style={{ padding: "7px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
          ➕ เพิ่มวันหยุด
        </button>
      </div>

      {/* Calendar grid by month */}
      {loading ? (
        <div style={{ padding: 30, textAlign: "center", color: "#6b7280", background: "#fff", borderRadius: 10 }}>กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: "#9ca3af", background: "#fff", borderRadius: 10 }}>
          ยังไม่มีวันหยุดปี {year} — กด "➕ เพิ่มวันหยุด"
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {months.map((mName, idx) => {
            const m = String(idx + 1).padStart(2, "0");
            const items = byMonth[m] || [];
            if (items.length === 0) return null;
            return (
              <div key={m} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: "#072d6b", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                  {mName} {year} — {items.length} วัน
                </div>
                <div>
                  {items.map(r => (
                    <div key={r.holiday_id} style={{ padding: "10px 12px", borderTop: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10, opacity: r.is_active === false ? 0.4 : 1 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{fmtDate(r.holiday_date)}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#dc2626" }}>{r.holiday_name}</div>
                        {r.note && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{r.note}</div>}
                      </div>
                      <button onClick={() => openEdit(r)} style={btnEdit}>✏️</button>
                      <button onClick={() => handleDelete(r)} style={btnDelete}>🗑️</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 500, maxWidth: "95vw" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>{editTarget ? "✏️ แก้ไขวันหยุด" : "➕ เพิ่มวันหยุด"}</h3>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label style={lbl}>วันที่ *</label>
                <input type="date" value={form.holiday_date} onChange={e => setForm(f => ({ ...f, holiday_date: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>ชื่อวันหยุด *</label>
                <input value={form.holiday_name} onChange={e => setForm(f => ({ ...f, holiday_name: e.target.value }))}
                  placeholder="เช่น วันสงกรานต์, วันแรงงาน" style={inp} />
              </div>
              <div>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical" }} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                เปิดใช้งาน
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowForm(false)} disabled={saving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving || !form.holiday_date || !form.holiday_name.trim()}
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
const btnEdit = { padding: "4px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
const btnDelete = { padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
