import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

const emptyForm = () => ({
  income_code: "",
  income_name: "",
  description: "",
  wht_rate: 0,
  status: "active",
});

export default function IncomeCategoryPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [includeInactive]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "income_category", op: "list", include_inactive: String(includeInactive) }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.income_code.trim()) { setMessage("❌ กรอกรหัสรายได้"); return; }
    if (!form.income_name.trim()) { setMessage("❌ กรอกหมวดรายได้"); return; }
    setSaving(true);
    try {
      const body = { action: "income_category", op: "save", ...form };
      if (editTarget) body.income_id = editTarget.income_id;
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save fail");
      setMessage(editTarget ? "✅ แก้ไขเรียบร้อย" : "✅ เพิ่มเรียบร้อย");
      setShowForm(false);
      setEditTarget(null);
      setForm(emptyForm());
      fetchData();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  function openEdit(r) {
    setEditTarget(r);
    setForm({
      income_code: r.income_code || "",
      income_name: r.income_name || "",
      description: r.description || "",
      wht_rate: r.wht_rate || 0,
      status: r.status || "active",
    });
    setShowForm(true);
  }
  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm());
    setShowForm(true);
  }
  async function handleDelete(r) {
    if (!window.confirm(`ลบ ${r.income_code} - ${r.income_name}?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "income_category", op: "delete", income_id: r.income_id }),
      });
      setMessage("✅ ลบเรียบร้อย");
      fetchData();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!kw) return true;
    const hay = [r.income_code, r.income_name, r.description].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💵 หมวดรายได้</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2",
          color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 14 }}>
          {message}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 ค้นหา (รหัส / ชื่อ)"
          style={{ ...inp, flex: 1, minWidth: 200 }} />
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} /> รวมที่ปิดใช้งาน
        </label>
        <button onClick={fetchData} style={{ padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>🔄 รีเฟรช</button>
        <button onClick={openCreate} style={{ padding: "7px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>+ เพิ่มรายการ</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
         filtered.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div> :
         <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>#</th>
              <th style={th}>รหัส</th>
              <th style={th}>หมวดรายได้</th>
              <th style={th}>รายละเอียด</th>
              <th style={{ ...th, textAlign: "right" }}>WHT %</th>
              <th style={th}>สถานะ</th>
              <th style={{ ...th, width: 140 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.income_id} style={{ borderTop: "1px solid #e5e7eb", background: r.status === "inactive" ? "#f9fafb" : "transparent" }}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{r.income_code}</td>
                <td style={td}>{r.income_name}</td>
                <td style={{ ...td, color: "#6b7280", fontSize: 12 }}>{r.description || "-"}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{Number(r.wht_rate || 0) > 0 ? `${Number(r.wht_rate)}%` : "-"}</td>
                <td style={td}>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: r.status === "active" ? "#d1fae5" : "#fee2e2",
                    color: r.status === "active" ? "#065f46" : "#991b1b" }}>
                    {r.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </td>
                <td style={td}>
                  <button onClick={() => openEdit(r)} style={{ padding: "4px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 }}>✏️ แก้</button>
                  <button onClick={() => handleDelete(r)} style={{ padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>🗑 ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 540, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>{editTarget ? "✏️ แก้ไขหมวดรายได้" : "+ เพิ่มหมวดรายได้"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>รหัส *</label>
                <input type="text" value={form.income_code} onChange={e => setForm(p => ({ ...p, income_code: e.target.value }))}
                  placeholder="เช่น IC001" style={inp} />
              </div>
              <div>
                <label style={lbl}>สถานะ</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={inp}>
                  <option value="active">ใช้งาน</option>
                  <option value="inactive">ปิดใช้งาน</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมวดรายได้ *</label>
                <input type="text" value={form.income_name} onChange={e => setForm(p => ({ ...p, income_name: e.target.value }))}
                  placeholder="เช่น ค่าตรวจรถ, ค่าโอน, ดอกเบี้ย" style={inp} />
              </div>
              <div>
                <label style={lbl}>อัตราภาษีหัก ณ ที่จ่าย (%)</label>
                <input type="number" step="0.01" min="0" max="100"
                  value={form.wht_rate}
                  onChange={e => setForm(p => ({ ...p, wht_rate: e.target.value }))}
                  placeholder="0 = ไม่หัก, เช่น 3 = 3%"
                  style={{ ...inp, textAlign: "right" }} />
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>
                  💡 0% = ไม่หักภาษี · 1%, 3%, 5% ตามประเภทรายได้
                </div>
              </div>
              <div></div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>รายละเอียด</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} style={inp} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setShowForm(false)} disabled={saving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: "8px 20px", background: saving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 };
const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 13 };
