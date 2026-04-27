import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

const BANKS = [
  "กสิกรไทย", "ไทยพาณิชย์", "กรุงเทพ", "กรุงไทย", "กรุงศรีอยุธยา",
  "ทหารไทยธนชาต (ttb)", "ออมสิน", "ธ.ก.ส.", "ซีไอเอ็มบี ไทย", "ยูโอบี",
  "เกียรตินาคิน", "แลนด์แอนด์เฮ้าส์",
];

const ACCOUNT_TYPES = ["ออมทรัพย์", "กระแสรายวัน", "ฝากประจำ"];

const emptyForm = () => ({
  account_name: "",
  bank_name: "",
  branch: "",
  account_no: "",
  account_type: "ออมทรัพย์",
  opening_balance: 0,
  opening_date: new Date().toISOString().slice(0, 10),
  note: "",
  status: "active",
});

export default function BankAccountsPage({ currentUser }) {
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
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: String(includeInactive) }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ โหลดไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.account_name.trim() || !form.bank_name.trim() || !form.account_no.trim()) {
      setMessage("❌ กรุณากรอกชื่อบัญชี, ธนาคาร, เลขบัญชี"); return;
    }
    setSaving(true); setMessage("");
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editTarget ? "update_bank_account" : "save_bank_account",
          ...(editTarget ? { account_id: editTarget.account_id } : {}),
          ...form,
        }),
      });
      setShowForm(false); setEditTarget(null); setForm(emptyForm());
      setMessage(`✅ ${editTarget ? "แก้ไข" : "เพิ่ม"}สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function toggleStatus(r) {
    const newStatus = r.status === "active" ? "inactive" : "active";
    if (!window.confirm(`${newStatus === "active" ? "เปิด" : "ปิด"}ใช้งาน "${r.account_name}"?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_bank_account", account_id: r.account_id, status: newStatus }),
      });
      fetchData();
    } catch { setMessage("❌ ไม่สำเร็จ"); }
  }

  function openEdit(r) {
    setForm({
      account_name: r.account_name || "",
      bank_name: r.bank_name || "",
      branch: r.branch || "",
      account_no: r.account_no || "",
      account_type: r.account_type || "ออมทรัพย์",
      opening_balance: r.opening_balance || 0,
      opening_date: r.opening_date ? String(r.opening_date).slice(0, 10) : "",
      note: r.note || "",
      status: r.status || "active",
    });
    setEditTarget(r);
    setShowForm(true);
  }
  function openAdd() { setForm(emptyForm()); setEditTarget(null); setShowForm(true); }

  function fmtNum(v) {
    return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtAccount(a) {
    if (!a) return "-";
    const s = String(a).replace(/\D/g, "");
    if (s.length === 10) return `${s.slice(0, 3)}-${s.slice(3, 4)}-${s.slice(4, 9)}-${s.slice(9)}`;
    return a;
  }

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!kw) return true;
    const hay = [r.account_name, r.bank_name, r.branch, r.account_no].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const totalBalance = filtered.reduce((s, r) => s + Number(r.opening_balance || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🏦 บัญชีธนาคาร</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <input type="text" placeholder="🔍 ค้นหา (ชื่อบัญชี, ธนาคาร, เลขบัญชี)"
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
          ➕ เพิ่มบัญชี
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 13 }}>🏦 บัญชี: <strong>{filtered.length}</strong></span>
        <span style={{ fontSize: 13, color: "#059669" }}>💰 ยอดยกมารวม: <strong>{fmtNum(totalBalance)}</strong> บาท</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีบัญชี — กด "➕ เพิ่มบัญชี"</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>ชื่อบัญชี</th>
                <th style={th}>ธนาคาร / สาขา</th>
                <th style={th}>เลขที่บัญชี</th>
                <th style={th}>ประเภท</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดยกมา</th>
                <th style={th}>วันที่ยกมา</th>
                <th style={th}>หมายเหตุ</th>
                <th style={th}>สถานะ</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.account_id} style={{ borderTop: "1px solid #e5e7eb", opacity: r.status === "inactive" ? 0.5 : 1 }}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.account_name}</td>
                  <td style={td}>
                    <div>{r.bank_name}</div>
                    {r.branch && <div style={{ fontSize: 11, color: "#6b7280" }}>{r.branch}</div>}
                  </td>
                  <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{fmtAccount(r.account_no)}</td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#dbeafe", color: "#1e40af" }}>
                      {r.account_type || "-"}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "#059669" }}>
                    {fmtNum(r.opening_balance)}
                  </td>
                  <td style={{ ...td, fontSize: 12 }}>
                    {r.opening_date ? new Date(r.opening_date).toLocaleDateString("th-TH") : "-"}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{r.note || ""}</td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: r.status === "active" ? "#d1fae5" : "#fee2e2", color: r.status === "active" ? "#065f46" : "#991b1b" }}>
                      {r.status === "active" ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td style={td}>
                    <button onClick={() => openEdit(r)} style={btnEdit}>✏️</button>
                    <button onClick={() => toggleStatus(r)} style={r.status === "active" ? btnDel : btnReact}>
                      {r.status === "active" ? "ปิด" : "เปิด"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} บัญชี</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669", fontSize: 14 }}>{fmtNum(totalBalance)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 600, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>{editTarget ? "✏️ แก้ไขบัญชี" : "➕ เพิ่มบัญชีใหม่"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>ชื่อบัญชี *</label>
                <input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))}
                  placeholder="เช่น บริษัท สิงห์ชัยลิสซิ่ง จำกัด" style={inp} />
              </div>
              <div>
                <label style={lbl}>ธนาคาร *</label>
                <input list="bank-list" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} style={inp} />
                <datalist id="bank-list">{BANKS.map(b => <option key={b} value={b} />)}</datalist>
              </div>
              <div>
                <label style={lbl}>สาขา</label>
                <input value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>เลขที่บัญชี *</label>
                <input value={form.account_no} onChange={e => setForm(f => ({ ...f, account_no: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
              </div>
              <div>
                <label style={lbl}>ประเภท</label>
                <select value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))} style={inp}>
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>ยอดยกมา</label>
                <input type="number" step="0.01" value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} style={{ ...inp, fontFamily: "monospace", textAlign: "right" }} />
              </div>
              <div>
                <label style={lbl}>วันที่ยกมา</label>
                <input type="date" value={form.opening_date} onChange={e => setForm(f => ({ ...f, opening_date: e.target.value }))} style={inp} />
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
const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box", width: "100%" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "10px 8px", fontSize: 13 };
const btnEdit = { padding: "4px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnDel = { padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
const btnReact = { padding: "4px 10px", background: "#059669", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
