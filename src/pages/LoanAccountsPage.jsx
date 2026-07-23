import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

const LOAN_TYPES = ["ธนาคาร", "นิติบุคคล", "บุคคล", "อื่นๆ"];
const INTEREST_PERIODS = ["ปี", "เดือน"];

const emptyForm = () => ({
  loan_name: "",
  lender: "",
  loan_type: "ธนาคาร",
  account_no: "",
  deposit_account: "",
  deposit_account_id: "",
  principal: 0,
  current_balance: 0,
  interest_rate: 0,
  interest_period: "ปี",
  start_date: new Date().toISOString().slice(0, 10),
  due_date: "",
  payment_schedule: "",
  note: "",
  status: "active",
});

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}

export default function LoanAccountsPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all/active/paid/cancelled
  const [message, setMessage] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]); // บัญชีธนาคารบริษัท — ไว้เลือก "บัญชีที่โอนเงินเข้า"

  useEffect(() => { fetchData(); fetchBankAccounts(); /* eslint-disable-next-line */ }, []);

  async function fetchBankAccounts() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
      });
      const data = await res.json();
      setBankAccounts(Array.isArray(data) ? data : []);
    } catch { setBankAccounts([]); }
  }

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_loan_accounts" }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : (data?.rows || []));
    } catch { setMessage("❌ โหลดไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.loan_name.trim()) { setMessage("❌ กรุณากรอกชื่อบัญชี"); return; }
    setSaving(true); setMessage("");
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editTarget ? "update_loan_account" : "save_loan_account",
          ...(editTarget ? { loan_id: editTarget.loan_id } : {}),
          ...form,
          principal: Number(form.principal) || 0,
          current_balance: Number(form.current_balance) || 0,
          interest_rate: Number(form.interest_rate) || 0,
          created_by: currentUser?.username || currentUser?.name || "system",
        }),
      });
      setShowForm(false); setEditTarget(null); setForm(emptyForm());
      setMessage(`✅ ${editTarget ? "แก้ไข" : "เพิ่ม"}สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function changeStatus(r, newStatus) {
    const labels = { active: "เปิดใช้งาน", paid: "ทำเครื่องหมาย 'จ่ายครบแล้ว'", cancelled: "ยกเลิก" };
    if (!window.confirm(`${labels[newStatus]} "${r.loan_name}"?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_loan_account", loan_id: r.loan_id, status: newStatus }),
      });
      fetchData();
    } catch { setMessage("❌ ไม่สำเร็จ"); }
  }

  function openEdit(r) {
    setForm({
      loan_name: r.loan_name || "",
      lender: r.lender || "",
      loan_type: r.loan_type || "ธนาคาร",
      account_no: r.account_no || "",
      deposit_account: r.deposit_account || "",
      // ข้อมูลเก่าที่บันทึกก่อนมี deposit_account_id — เทียบชื่อบัญชีหา id ให้อัตโนมัติ
      deposit_account_id: r.deposit_account_id
        || (bankAccounts.find(b => `${b.bank_name || ""} ${b.account_no || ""} ${b.account_name || ""}`.trim() === (r.deposit_account || ""))?.account_id ?? ""),
      principal: r.principal || 0,
      current_balance: r.current_balance || 0,
      interest_rate: r.interest_rate || 0,
      interest_period: r.interest_period || "ปี",
      start_date: r.start_date ? String(r.start_date).slice(0, 10) : "",
      due_date: r.due_date ? String(r.due_date).slice(0, 10) : "",
      payment_schedule: r.payment_schedule || "",
      note: r.note || "",
      status: r.status || "active",
    });
    setEditTarget(r);
    setShowForm(true);
  }
  function openAdd() { setForm(emptyForm()); setEditTarget(null); setShowForm(true); }

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!kw) return true;
    const hay = [r.loan_name, r.lender, r.account_no, r.deposit_account, r.note].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const countAll = rows.length;
  const countActive = rows.filter(r => r.status === "active").length;
  const countPaid = rows.filter(r => r.status === "paid").length;
  const countCancelled = rows.filter(r => r.status === "cancelled").length;
  const totalBalance = filtered.filter(r => r.status === "active").reduce((s, r) => s + Number(r.current_balance || 0), 0);

  const inputStyle = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3, color: "#374151" };
  const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12, background: "#072d6b", color: "#fff" };
  const td = { padding: "8px", borderBottom: "1px solid #e5e7eb", fontSize: 13 };
  const tdNum = { ...td, textAlign: "right", fontFamily: "monospace" };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🏦 บัญชีเงินกู้ยืม</h2>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา (ชื่อบัญชี / เจ้าหนี้ / เลขที่สัญญา)"
          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, minWidth: 280 }} />
        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={openAdd}
          style={{ padding: "7px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          + เพิ่มบัญชีเงินกู้
        </button>
      </div>

      {/* Status filter chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { key: "all", label: "ทั้งหมด", count: countAll, bg: "#072d6b" },
          { key: "active", label: "🔴 ค้างชำระ", count: countActive, bg: "#dc2626" },
          { key: "paid", label: "✅ จ่ายครบแล้ว", count: countPaid, bg: "#10b981" },
          { key: "cancelled", label: "❌ ยกเลิก", count: countCancelled, bg: "#6b7280" },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            style={{ padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
              background: statusFilter === f.key ? f.bg : "#e5e7eb",
              color: statusFilter === f.key ? "#fff" : "#374151" }}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 20, marginBottom: 12, padding: "10px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fbbf24", fontSize: 14 }}>
        <span>📋 จำนวน: <strong>{filtered.length}</strong></span>
        <span>💰 ยอดคงเหลือรวม (active): <strong style={{ color: "#dc2626", fontSize: 16 }}>฿ {fmt(totalBalance)}</strong></span>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 13 }}>
          {message}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280", background: "#fff", borderRadius: 10 }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          ไม่มีข้อมูลบัญชีเงินกู้ยืม
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 40 }}>#</th>
                <th style={th}>ชื่อบัญชี</th>
                <th style={th}>ประเภท</th>
                <th style={th}>เจ้าหนี้</th>
                <th style={th}>เลขที่สัญญา</th>
                <th style={th}>บัญชีที่โอนเงินเข้า</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดต้น</th>
                <th style={{ ...th, textAlign: "right" }}>คงเหลือ</th>
                <th style={{ ...th, textAlign: "right" }}>อัตรา %</th>
                <th style={th}>วันที่เริ่ม</th>
                <th style={th}>วันครบกำหนด</th>
                <th style={th}>หมายเหตุ</th>
                <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
                <th style={{ ...th, textAlign: "center", width: 140 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const statusBadge = r.status === "paid"
                  ? { label: "✅ จ่ายครบ", bg: "#d1fae5", color: "#065f46" }
                  : r.status === "cancelled"
                  ? { label: "❌ ยกเลิก", bg: "#fee2e2", color: "#991b1b" }
                  : { label: "🔴 ค้างชำระ", bg: "#fef3c7", color: "#92400e" };
                return (
                  <tr key={r.loan_id || i} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb", opacity: r.status === "cancelled" ? 0.65 : 1 }}>
                    <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 700, color: "#072d6b" }}>{r.loan_name}</td>
                    <td style={td}>{r.loan_type || "-"}</td>
                    <td style={td}>{r.lender || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.account_no || "-"}</td>
                    <td style={{ ...td, fontSize: 12, maxWidth: 180, whiteSpace: "normal" }}>{r.deposit_account || "-"}</td>
                    <td style={{ ...tdNum, fontWeight: 600 }}>{fmt(r.principal)}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: "#dc2626" }}>{fmt(r.current_balance)}</td>
                    <td style={tdNum}>{fmt(r.interest_rate)} <span style={{ fontSize: 10, color: "#6b7280" }}>/{r.interest_period}</span></td>
                    <td style={td}>{fmtDate(r.start_date)}</td>
                    <td style={td}>{fmtDate(r.due_date)}</td>
                    <td style={{ ...td, maxWidth: 200, whiteSpace: "normal", fontSize: 12, color: "#6b7280" }}>{r.note || "-"}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 12, background: statusBadge.bg, color: statusBadge.color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                      <button onClick={() => openEdit(r)} title="แก้ไข"
                        style={{ padding: "4px 10px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, marginRight: 4 }}>
                        ✏️ แก้
                      </button>
                      {r.status === "active" && (
                        <button onClick={() => changeStatus(r, "paid")} title="ทำเครื่องหมายว่าจ่ายครบ"
                          style={{ padding: "4px 8px", background: "#10b981", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, marginRight: 4 }}>
                          ✓
                        </button>
                      )}
                      {r.status !== "cancelled" && (
                        <button onClick={() => changeStatus(r, "cancelled")} title="ยกเลิก"
                          style={{ padding: "4px 8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                          ✕
                        </button>
                      )}
                      {r.status !== "active" && (
                        <button onClick={() => changeStatus(r, "active")} title="กลับมาใช้งาน"
                          style={{ padding: "4px 8px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                          🔄
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit dialog */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 720, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: editTarget ? "#7c3aed" : "#072d6b" }}>
              {editTarget ? `✏️ แก้ไขบัญชีเงินกู้ — ${editTarget.loan_name}` : "🏦 เพิ่มบัญชีเงินกู้ยืม"}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={labelStyle}>ชื่อบัญชี *</label>
                <input value={form.loan_name} onChange={e => setForm(p => ({ ...p, loan_name: e.target.value }))} style={inputStyle} placeholder="เช่น เงินกู้กสิกร 1" />
              </div>
              <div>
                <label style={labelStyle}>ประเภท</label>
                <select value={form.loan_type} onChange={e => setForm(p => ({ ...p, loan_type: e.target.value }))} style={inputStyle}>
                  {LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>เจ้าหนี้</label>
                <input value={form.lender} onChange={e => setForm(p => ({ ...p, lender: e.target.value }))} style={inputStyle} placeholder="ชื่อผู้ให้กู้" />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={labelStyle}>เลขที่สัญญา / เลขที่บัญชี</label>
                <input value={form.account_no} onChange={e => setForm(p => ({ ...p, account_no: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={labelStyle}>บัญชีที่โอนเงินเข้า <span style={{ color: "#9ca3af", fontWeight: 400 }}>(บัญชีบริษัทที่รับเงินกู้เข้า — แสดงในรายงานการเคลื่อนไหวบัญชีธนาคาร ณ วันที่เริ่ม ด้วยยอดต้น)</span></label>
                <select value={String(form.deposit_account_id || "")}
                  onChange={e => {
                    const id = e.target.value;
                    const b = bankAccounts.find(x => String(x.account_id) === id);
                    setForm(p => ({ ...p, deposit_account_id: id, deposit_account: b ? `${b.bank_name || ""} ${b.account_no || ""} ${b.account_name || ""}`.trim() : "" }));
                  }} style={inputStyle}>
                  <option value="">-- ไม่ระบุ --</option>
                  {bankAccounts.map(b => {
                    const label = `${b.bank_name || ""} ${b.account_no || ""} ${b.account_name || ""}`.trim();
                    return <option key={b.account_id} value={String(b.account_id)}>{label}</option>;
                  })}
                </select>
                {/* ค่าเดิมที่บันทึกเป็นข้อความแต่จับคู่บัญชีไม่ได้ (ถูกปิดใช้งาน) */}
                {form.deposit_account && !form.deposit_account_id && (
                  <div style={{ fontSize: 11, color: "#d97706", marginTop: 3 }}>ค่าที่บันทึกไว้เดิม: {form.deposit_account} (เลือกบัญชีใหม่จากรายการเพื่อให้ขึ้นรายงานเคลื่อนไหว)</div>
                )}
              </div>
              <div>
                <label style={labelStyle}>ยอดต้น (ที่กู้)</label>
                <input type="number" step="0.01" value={form.principal} onChange={e => setForm(p => ({ ...p, principal: e.target.value }))} style={{ ...inputStyle, textAlign: "right" }} />
              </div>
              <div>
                <label style={labelStyle}>ยอดคงเหลือ</label>
                <input type="number" step="0.01" value={form.current_balance} onChange={e => setForm(p => ({ ...p, current_balance: e.target.value }))} style={{ ...inputStyle, textAlign: "right" }} />
              </div>
              <div>
                <label style={labelStyle}>อัตราดอกเบี้ย (%)</label>
                <input type="number" step="0.01" value={form.interest_rate} onChange={e => setForm(p => ({ ...p, interest_rate: e.target.value }))} style={{ ...inputStyle, textAlign: "right" }} />
              </div>
              <div>
                <label style={labelStyle}>ต่อ</label>
                <select value={form.interest_period} onChange={e => setForm(p => ({ ...p, interest_period: e.target.value }))} style={inputStyle}>
                  {INTEREST_PERIODS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>วันที่เริ่ม</label>
                <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>วันครบกำหนด</label>
                <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={labelStyle}>เงื่อนไขผ่อน</label>
                <input value={form.payment_schedule} onChange={e => setForm(p => ({ ...p, payment_schedule: e.target.value }))} style={inputStyle} placeholder="เช่น ผ่อน 24 งวด งวดละ 5,000" />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={labelStyle}>หมายเหตุ</label>
                <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} rows={2} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setShowForm(false)} disabled={saving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: "8px 20px", background: saving ? "#9ca3af" : (editTarget ? "#7c3aed" : "#059669"), color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
