import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

const emptyForm = () => ({
  position_name: "",
  department: "",
  note: "",
  status: "active",
});

export default function PositionPage({ currentUser }) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => { fetchPositions(); }, []);

  async function fetchPositions() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_positions" }),
      });
      const data = await res.json();
      setPositions(Array.isArray(data) ? data : []);
    } catch { setMessage("โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.position_name.trim()) {
      setMessage("กรุณากรอกชื่อตำแหน่ง"); return;
    }
    setSaving(true);
    setMessage("");
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editTarget ? "update_position" : "save_position",
          ...(editTarget ? { position_id: editTarget.position_id } : {}),
          ...form,
        }),
      });
      setShowForm(false);
      setEditTarget(null);
      setForm(emptyForm());
      fetchPositions();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  function openEdit(d) {
    setEditTarget(d);
    setForm({
      position_name: d.position_name || "",
      department: d.department || "",
      note: d.note || "",
      status: d.status || "active",
    });
    setShowForm(true);
    setMessage("");
  }

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm());
    setShowForm(true);
    setMessage("");
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📋 กำหนดตำแหน่ง</h2>
        <button className="btn-primary" onClick={openAdd}>+ เพิ่มตำแหน่ง</button>
      </div>

      {message && <div style={{ color: "#ef4444", marginBottom: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>{message}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>ชื่อตำแหน่ง</th>
                <th>แผนก</th>
                <th>หมายเหตุ</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>ยังไม่มีข้อมูลตำแหน่ง</td></tr>
              ) : positions.map((d, i) => (
                <tr key={d.position_id || i}>
                  <td>{i + 1}</td>
                  <td>{d.position_name || "-"}</td>
                  <td>{d.department || "-"}</td>
                  <td>{d.note || "-"}</td>
                  <td>
                    <span style={{
                      padding: "2px 10px", borderRadius: 12, fontSize: 12,
                      background: d.status === "active" ? "#d1fae5" : "#f3f4f6",
                      color: d.status === "active" ? "#065f46" : "#6b7280",
                    }}>
                      {d.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => openEdit(d)}
                      style={{ padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0 }}>{editTarget ? "แก้ไขตำแหน่ง" : "เพิ่มตำแหน่ง"}</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>ชื่อตำแหน่ง *</label>
              <input value={form.position_name} onChange={e => setForm({ ...form, position_name: e.target.value })}
                placeholder="ชื่อตำแหน่ง"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>แผนก</label>
              <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                placeholder="แผนก (ถ้ามี)"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>หมายเหตุ</label>
              <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="หมายเหตุ (ถ้ามี)"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>สถานะ</label>
              <div style={{ display: "flex", gap: 20 }}>
                {[["active", "ใช้งาน"], ["inactive", "ไม่ใช้งาน"]].map(([val, label]) => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: "normal" }}>
                    <input type="radio" name="positionStatus" value={val} checked={form.status === val} onChange={() => setForm({ ...form, status: val })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {message && <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}>{message}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: "9px 0", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => { setShowForm(false); setMessage(""); }}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
