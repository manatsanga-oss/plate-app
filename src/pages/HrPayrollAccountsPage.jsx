import React, { useEffect, useState } from "react";

const HR_API = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

export default function HrPayrollAccountsPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [affiliations, setAffiliations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // edit form
  const [editingId, setEditingId] = useState(null);
  const [fAffiliation, setFAffiliation] = useState("");
  const [fAccountId, setFAccountId] = useState("");
  const [fNote, setFNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true); setMessage("");
    try {
      const [a, b, c] = await Promise.all([
        fetch(HR_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "payroll_accounts", mode: "list" }) }).then(r => r.json()),
        fetch(ACC_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_bank_accounts" }) }).then(r => r.json()),
        fetch(HR_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_hr_employees" }) }).then(r => r.json()),
      ]);
      setRows(Array.isArray(a) ? a : []);
      setBankAccounts(Array.isArray(b) ? b : []);
      const affs = [...new Set((Array.isArray(c) ? c : []).map(e => e.affiliation).filter(Boolean))].sort();
      setAffiliations(affs);
    } catch (e) { setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + e.message); }
    setLoading(false);
  }

  function startEdit(row) {
    setEditingId(row?.id || "new");
    setFAffiliation(row?.affiliation || "");
    setFAccountId(row?.bank_account_id ? String(row.bank_account_id) : "");
    setFNote(row?.note || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setFAffiliation(""); setFAccountId(""); setFNote("");
  }

  async function save() {
    if (!fAffiliation.trim() || !fAccountId) { setMessage("⚠️ กรอกสังกัดและเลือกบัญชี"); return; }
    setSaving(true); setMessage("");
    try {
      const res = await fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_accounts", mode: "save", affiliation: fAffiliation.trim(), bank_account_id: Number(fAccountId), note: fNote.trim() }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      if (arr[0]?.error) throw new Error(arr[0].error);
      setMessage("✅ บันทึกสำเร็จ");
      cancelEdit();
      fetchAll();
    } catch (e) { setMessage("❌ บันทึกไม่สำเร็จ: " + e.message); }
    setSaving(false);
  }

  async function del(row) {
    if (!window.confirm(`ลบการตั้งค่าของสังกัด "${row.affiliation}"?`)) return;
    try {
      await fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_accounts", mode: "delete", id: row.id }),
      });
      setMessage("✅ ลบเรียบร้อย");
      fetchAll();
    } catch (e) { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">⚙️ ตั้งค่าบัญชีจ่ายเงินเดือน</h2>
      </div>

      {message && <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#dcfce7" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>}

      <div style={{ background: "#fff", padding: 14, borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 14 }}>
        <p style={{ margin: 0, color: "#374151", fontSize: 14 }}>
          🔧 กำหนดบัญชีธนาคารที่ใช้โอนเงินสำหรับแต่ละสังกัด — ใช้ในการตั้งจ่ายประกันสังคม / สรรพากร / กยศ. / กองทุนฯ ของแต่ละสาขา
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "#072d6b" }}>รายการสังกัด ({rows.length})</h3>
        {editingId === null && (
          <button onClick={() => startEdit(null)}
            style={{ padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            + เพิ่มสังกัด
          </button>
        )}
      </div>

      {/* Edit form */}
      {editingId !== null && (
        <div style={{ background: "#eff6ff", padding: 14, borderRadius: 10, border: "1px solid #bfdbfe", marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={lbl}>สังกัด *</label>
              <input value={fAffiliation} onChange={e => setFAffiliation(e.target.value)} list="aff-list" placeholder="ป.เปา / สิงห์ชัย / ..." style={inp} />
              <datalist id="aff-list">
                {affiliations.map(a => <option key={a} value={a} />)}
              </datalist>
            </div>
            <div>
              <label style={lbl}>บัญชีธนาคาร *</label>
              <select value={fAccountId} onChange={e => setFAccountId(e.target.value)} style={inp}>
                <option value="">-- เลือกบัญชี --</option>
                {bankAccounts.map(b => (
                  <option key={b.account_id} value={b.account_id}>
                    {b.bank_name} {b.account_no} - {b.account_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>หมายเหตุ</label>
              <input value={fNote} onChange={e => setFNote(e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving}
              style={{ padding: "7px 18px", background: saving ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontWeight: 600 }}>
              {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
            </button>
            <button onClick={cancelEdit} disabled={saving}
              style={{ padding: "7px 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีการตั้งค่า — กดปุ่ม + เพิ่มสังกัด</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>สังกัด</th>
                <th style={th}>ธนาคาร</th>
                <th style={th}>เลขบัญชี</th>
                <th style={th}>ชื่อบัญชี</th>
                <th style={th}>หมายเหตุ</th>
                <th style={th}>อัปเดต</th>
                <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ ...td, fontWeight: 700, color: "#072d6b" }}>{r.affiliation}</td>
                  <td style={td}>{r.bank_name || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{r.account_no || "-"}</td>
                  <td style={td}>{r.account_name || "-"}</td>
                  <td style={{ ...td, color: "#6b7280" }}>{r.note || "-"}</td>
                  <td style={{ ...td, fontSize: 11, color: "#9ca3af" }}>{r.updated_at ? new Date(r.updated_at).toLocaleString("th-TH") : "-"}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button onClick={() => startEdit(r)}
                      style={{ padding: "4px 10px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, marginRight: 4 }}>
                      ✏️ แก้ไข
                    </button>
                    <button onClick={() => del(r)}
                      style={{ padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                      🗑️ ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const inp = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: "Tahoma" };
const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" };
const td = { padding: "8px", whiteSpace: "nowrap" };
