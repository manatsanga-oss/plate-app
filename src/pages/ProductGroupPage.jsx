import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-master-api";

async function post(body) {
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json().catch(() => ({}));
}

function StatusBadge({ status }) {
  const active = status === "active";
  return (
    <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12,
      background: active ? "#d1fae5" : "#fee2e2",
      color: active ? "#065f46" : "#991b1b" }}>
      {active ? "ใช้งาน" : "ยกเลิก"}
    </span>
  );
}

export default function ProductGroupPage({ currentUser }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ group_code: "", group_name: "", description: "", status: "active" });

  useEffect(() => { fetchGroups(); }, []);

  async function fetchGroups() {
    setLoading(true);
    try {
      const data = await post({ action: "get_product_groups" });
      setGroups(Array.isArray(data) ? data : []);
    } catch { setMessage("โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }

  function generateNextCode() {
    const codes = groups.map(g => g.group_code || "").filter(c => /^PG-\d+$/.test(c));
    const nums = codes.map(c => parseInt(c.replace("PG-", ""), 10));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `PG-${String(next).padStart(3, "0")}`;
  }

  async function handleSave() {
    setMessage("");
    if (!form.group_name.trim()) { setMessage("กรุณากรอกชื่อกลุ่มสินค้า"); return; }
    setSaving(true);
    try {
      const action = editTarget ? "update_product_group" : "create_product_group";
      const payload = { action, ...form };
      if (editTarget) payload.id = editTarget.id;
      const result = await post(payload);
      if (result.error) { setMessage(result.error); }
      else {
        setShowForm(false);
        setEditTarget(null);
        setForm({ group_code: "", group_name: "", description: "", status: "active" });
        fetchGroups();
      }
    } catch { setMessage("บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  function openAdd() {
    setEditTarget(null);
    setForm({ group_code: generateNextCode(), group_name: "", description: "", status: "active" });
    setShowForm(true);
    setMessage("");
  }

  function openEdit(row) {
    setEditTarget(row);
    setForm({ group_code: row.group_code || "", group_name: row.group_name || "", description: row.description || "", status: row.status || "active" });
    setShowForm(true);
    setMessage("");
  }

  const inp = (field, label, placeholder, required = false, readOnly = false) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>{label}{required ? " *" : ""}</label>
      <input value={form[field]} readOnly={readOnly}
        onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box", background: readOnly ? "#f3f4f6" : "#fff" }} />
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">กลุ่มสินค้า</h2>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
            <button className="btn-primary" onClick={openAdd} style={{ marginLeft: "auto" }}>
              + เพิ่มกลุ่มสินค้า
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>รหัสกลุ่ม</th>
                  <th>ชื่อกลุ่มสินค้า</th>
                  <th>รายละเอียด</th>
                  <th>สถานะ</th>
                  <th style={{ width: 80 }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>ยังไม่มีข้อมูล</td></tr>
                ) : groups.map((g, i) => (
                  <tr key={g.id || i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{g.group_code}</td>
                    <td>{g.group_name}</td>
                    <td>{g.description || "-"}</td>
                    <td><StatusBadge status={g.status || "active"} /></td>
                    <td>
                      <button onClick={() => openEdit(g)}
                        style={{ padding: "3px 12px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0 }}>{editTarget ? "แก้ไข" : "เพิ่ม"}กลุ่มสินค้า</h3>

            {inp("group_code", "รหัสกลุ่ม", "PG-001", true, !editTarget)}
            {inp("group_name", "ชื่อกลุ่มสินค้า", "เช่น อะไหล่เครื่องยนต์", true)}
            {inp("description", "รายละเอียด", "รายละเอียดเพิ่มเติม")}

            {editTarget && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>สถานะ</label>
                <div style={{ display: "flex", gap: 20 }}>
                  {[["active", "ใช้งาน"], ["inactive", "ยกเลิก"]].map(([val, label]) => (
                    <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: "normal", fontSize: 14 }}>
                      <input type="radio" name="rowStatus" value={val} checked={form.status === val}
                        onChange={() => setForm(p => ({ ...p, status: val }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {message && <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}>{message}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: "9px 0", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => { setShowForm(false); setMessage(""); }}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
