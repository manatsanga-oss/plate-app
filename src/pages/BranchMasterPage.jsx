import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

async function postAPI(body) {
  const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

const empty = { branch_code: "", branch_name: "", affiliation: "", sales_target: "", note: "" };

export default function BranchMasterPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const d = await postAPI({ action: "get_branches", include_inactive: "true" });
      setRows(Array.isArray(d) ? d.filter(r => r && r.branch_code) : []);
    } catch { setRows([]); }
    setLoading(false);
  }

  async function save() {
    if (!form.branch_code) { setMessage("❌ กรอกรหัสร้าน"); return; }
    if (!form.branch_name) { setMessage("❌ กรอกชื่อร้าน"); return; }
    setSaving(true); setMessage("");
    try {
      await postAPI({
        action: "save_branch",
        branch_code: form.branch_code, branch_name: form.branch_name,
        affiliation: form.affiliation, sales_target: form.sales_target,
        note: form.note,
        created_by: currentUser?.username || currentUser?.name || "system",
      });
      setMessage("✅ บันทึกสำเร็จ");
      setForm(empty); setEditing(false);
      load();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  function edit(r) {
    setForm({
      branch_code: r.branch_code, branch_name: r.branch_name || "",
      affiliation: r.affiliation || "", sales_target: r.sales_target || "",
      note: r.note || "",
    });
    setEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(r) {
    if (!window.confirm(`ลบสาขา ${r.branch_code} - ${r.branch_name} ?`)) return;
    try {
      await postAPI({ action: "delete_branch", branch_code: r.branch_code });
      setMessage("✅ ลบสำเร็จ"); load();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🏪 บันทึกข้อมูลสาขา</h2>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, borderRadius: 6, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>}

      <div style={{ ...cardSt, marginBottom: 16 }}>
        <h3 style={h3St}>{editing ? "✏️ แก้ไข" : "➕ เพิ่ม"} สาขา</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <Field label="รหัสร้าน *">
            <input value={form.branch_code} onChange={e => setForm({ ...form, branch_code: e.target.value.toUpperCase() })}
                   style={{ ...inp, fontFamily: "monospace" }} placeholder="เช่น SCY01" disabled={editing} />
          </Field>
          <Field label="ชื่อร้าน *">
            <input value={form.branch_name} onChange={e => setForm({ ...form, branch_name: e.target.value })} style={inp} />
          </Field>
          <Field label="สังกัด">
            <select value={form.affiliation} onChange={e => setForm({ ...form, affiliation: e.target.value })} style={inp}>
              <option value="">-- เลือก --</option>
              <option value="ป.เปา">ป.เปา</option>
              <option value="สิงห์ชัย">สิงห์ชัย</option>
            </select>
          </Field>
          <Field label="เป้าการขาย (คัน/เดือน)">
            <input type="number" value={form.sales_target} onChange={e => setForm({ ...form, sales_target: e.target.value })}
                   style={{ ...inp, textAlign: "right" }} />
          </Field>
        </div>
        <Field label="หมายเหตุ">
          <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={inp} />
        </Field>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {editing && <button onClick={() => { setForm(empty); setEditing(false); }} style={btnGray}>ยกเลิก</button>}
          <button onClick={save} disabled={saving} style={btnGreen}>{saving ? "..." : "💾 บันทึก"}</button>
        </div>
      </div>

      <div style={cardSt}>
        <h3 style={h3St}>รายการสาขา ({rows.length})</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>#</th>
                <th style={th}>รหัสร้าน</th>
                <th style={th}>ชื่อร้าน</th>
                <th style={th}>สังกัด</th>
                <th style={{ ...th, textAlign: "right" }}>เป้าการขาย</th>
                <th style={th}>หมายเหตุ</th>
                <th style={th}>สถานะ</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
              {rows.map((r, i) => (
                <tr key={r.branch_code} style={{ borderTop: "1px solid #e5e7eb", opacity: r.active === false ? 0.5 : 1 }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{r.branch_code}</td>
                  <td style={td}>{r.branch_name}</td>
                  <td style={td}>{r.affiliation || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{r.sales_target || "-"}</td>
                  <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{r.note || ""}</td>
                  <td style={td}>{r.active === false ? <span style={{ color: "#dc2626" }}>ปิด</span> : <span style={{ color: "#059669" }}>ใช้งาน</span>}</td>
                  <td style={td}>
                    <button onClick={() => edit(r)} style={btnSmYellow}>✏️</button>
                    <button onClick={() => del(r)} style={btnSmRed}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  );
}

const cardSt = { background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e5e7eb" };
const h3St = { margin: "0 0 12px", color: "#072d6b" };
const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700 };
const td = { padding: "8px", fontSize: 13 };
const btnGreen = { padding: "8px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 };
const btnGray = { padding: "8px 16px", background: "#9ca3af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const btnSmYellow = { marginRight: 4, padding: "3px 8px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnSmRed = { padding: "3px 8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
