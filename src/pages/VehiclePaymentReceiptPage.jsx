import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/finance-api";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const emptyForm = () => ({
  receipt_date: todayLocal(),
  customer_name: "",
  invoice_no: "",
  chassis_no: "",
  to_account_id: "",
  payment_method: "โอน",
  amount: 0,
  note: "",
});

export default function VehiclePaymentReceiptPage({ currentUser }) {
  const [accounts, setAccounts] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const isAdmin = currentUser?.role === "admin";
  const userBranch = String(currentUser?.branch || "").trim();
  const userBranchCode = userBranch.includes(" ") ? userBranch.split(" ")[0] : userBranch;
  const userBranchName = userBranch.includes(" ") ? userBranch.split(" ").slice(1).join(" ") : userBranch;

  useEffect(() => {
    const now = new Date();
    setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);
    fetchAccounts();
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => { if (dateFrom && dateTo) fetchData(); /* eslint-disable-next-line */ }, [dateFrom, dateTo]);

  async function fetchAccounts() {
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
      });
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch { setAccounts([]); }
  }

  async function fetchData() {
    setLoading(true);
    try {
      const body = {
        action: "list_vehicle_receipts",
        date_from: dateFrom,
        date_to: dateTo,
        search: search.trim(),
      };
      if (!isAdmin && userBranchCode) body.branch_code = userBranchCode;
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setReceipts(Array.isArray(data) ? data : []);
    } catch { setReceipts([]); }
    setLoading(false);
  }

  function openNew() {
    setForm(emptyForm());
    setEditTarget(null);
    setShowForm(true);
  }

  function openEdit(r) {
    setForm({
      receipt_date: r.receipt_date ? new Date(r.receipt_date).toISOString().slice(0, 16) : todayLocal(),
      customer_name: r.customer_name || "",
      invoice_no: r.invoice_no || "",
      chassis_no: r.chassis_no || "",
      to_account_id: r.to_account_id || "",
      payment_method: r.payment_method || "โอน",
      amount: r.amount || 0,
      note: r.note || "",
    });
    setEditTarget(r);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.to_account_id) { setMessage("❌ เลือกบัญชีรับเงิน"); return; }
    if (!Number(form.amount) || Number(form.amount) <= 0) { setMessage("❌ กรอกจำนวนเงิน"); return; }
    if (!form.customer_name.trim()) { setMessage("❌ กรอกชื่อลูกค้า"); return; }
    setSaving(true); setMessage("");
    try {
      const body = {
        action: editTarget ? "update_vehicle_receipt" : "save_vehicle_receipt",
        ...(editTarget ? { receipt_id: editTarget.receipt_id } : {}),
        ...form,
        amount: Number(form.amount),
        to_account_id: Number(form.to_account_id),
        created_by: currentUser?.username || currentUser?.name || "system",
        branch_code: userBranchCode,
        branch_name: userBranchName,
      };
      await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setShowForm(false);
      setEditTarget(null);
      setMessage(`✅ ${editTarget ? "แก้ไข" : "บันทึก"}สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function handleCancel(r) {
    if (!window.confirm(`ยกเลิกรายการรับชำระ ${r.receipt_doc_no}?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_vehicle_receipt", receipt_id: r.receipt_id }),
      });
      setMessage("✅ ยกเลิกสำเร็จ");
      fetchData();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  const filtered = receipts.filter(r => {
    if (!search.trim()) return true;
    const kw = search.trim().toLowerCase();
    return [r.receipt_doc_no, r.customer_name, r.invoice_no, r.chassis_no, r.to_account_name, r.note].filter(Boolean).join(" ").toLowerCase().includes(kw);
  });

  const grandTotal = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🚗💵 บันทึกรับชำระเงินค่ารถ</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>วันที่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหา (เลขที่, ลูกค้า, ใบขาย, เลขถัง)" style={{ ...inp, flex: 1, minWidth: 220 }} />
        <button onClick={fetchData} disabled={loading} style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>
        <button onClick={openNew} style={{ padding: "7px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          ➕ บันทึกรับชำระใหม่
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}>
        <span>📋 รายการ: <strong>{filtered.length}</strong></span>
        <span>💰 ยอดรวม: <strong style={{ color: "#059669" }}>{fmt(grandTotal)}</strong> บาท</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>เลขที่</th>
                <th style={th}>วันที่</th>
                <th style={th}>ร้าน/สาขา</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>ใบขาย</th>
                <th style={th}>เลขถัง</th>
                <th style={th}>วิธีจ่าย</th>
                <th style={th}>บัญชีรับเงิน</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดรับ</th>
                <th style={th}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.receipt_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{r.receipt_doc_no || "-"}</td>
                  <td style={td}>{fmtDate(r.receipt_date)}</td>
                  <td style={td}>
                    {r.branch_code && <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.branch_code}</span>}
                    {r.branch_code && r.branch_name && " "}
                    {r.branch_name && <span style={{ fontSize: 12 }}>{r.branch_name}</span>}
                  </td>
                  <td style={td}>{r.customer_name || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.invoice_no || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                  <td style={td}>{r.payment_method || "-"}</td>
                  <td style={{ ...td, fontSize: 11 }}>{r.to_account_name || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.amount)}</td>
                  <td style={td}>
                    <button onClick={() => openEdit(r)} style={btnEdit}>✏️</button>
                    <button onClick={() => handleCancel(r)} style={btnDelete}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 600, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#059669" }}>{editTarget ? "✏️ แก้ไขรายการรับชำระ" : "🚗💵 บันทึกรับชำระเงินค่ารถ"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>ร้าน/สาขา (auto)</label>
                <div style={{ padding: "8px 12px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 6, fontSize: 14, fontWeight: 600, color: "#0369a1" }}>
                  {userBranchCode || "-"} {userBranchName && <span style={{ color: "#374151", fontWeight: 400 }}>· {userBranchName}</span>}
                </div>
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>วันที่/เวลา *</label>
                <input type="datetime-local" value={form.receipt_date} onChange={e => setForm(p => ({ ...p, receipt_date: e.target.value }))} style={inp2} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>ชื่อลูกค้า *</label>
                <input type="text" value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="เช่น นายสมชาย ใจดี" style={inp2} />
              </div>
              <div>
                <label style={lbl}>เลขที่ใบขาย</label>
                <input type="text" value={form.invoice_no} onChange={e => setForm(p => ({ ...p, invoice_no: e.target.value }))} placeholder="SCY01-CA..." style={inp2} />
              </div>
              <div>
                <label style={lbl}>เลขถัง (VIN)</label>
                <input type="text" value={form.chassis_no} onChange={e => setForm(p => ({ ...p, chassis_no: e.target.value.toUpperCase() }))} placeholder="MLHJ..." style={{ ...inp2, fontFamily: "monospace" }} />
              </div>
              <div>
                <label style={lbl}>วิธีจ่าย</label>
                <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))} style={inp2}>
                  <option value="โอน">โอน</option>
                  <option value="เงินสด">เงินสด</option>
                  <option value="เช็ค">เช็ค</option>
                  <option value="บัตรเครดิต">บัตรเครดิต</option>
                </select>
              </div>
              <div>
                <label style={lbl}>จำนวนเงิน *</label>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={{ ...inp2, fontFamily: "monospace", textAlign: "right", fontSize: 16, fontWeight: 700 }} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>บัญชีรับเงิน *</label>
                <select value={form.to_account_id} onChange={e => setForm(p => ({ ...p, to_account_id: e.target.value }))} style={inp2}>
                  <option value="">-- เลือกบัญชี --</option>
                  {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} rows={2} style={{ ...inp2, resize: "vertical" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setShowForm(false)} disabled={saving} style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "8px 24px", background: saving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = { padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const inp2 = { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 13 };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const th = { padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 12 };
const td = { padding: "8px 12px", fontSize: 12, color: "#1f2937" };
const btnEdit = { padding: "3px 8px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnDelete = { padding: "3px 8px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 };
