import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/advance-expense-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

const PAY_METHODS = ["โอน", "เงินสด", "เช็ค"];

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

// สถานะ: pending = รอเคลียร์ · cleared = เคลียร์แล้ว · cancelled = ยกเลิก
const STATUS_LABEL = { pending: "รอเคลียร์", cleared: "เคลียร์แล้ว", cancelled: "ยกเลิก" };
const STATUS_STYLE = {
  pending: { background: "#fef3c7", color: "#78350f" },
  cleared: { background: "#d1fae5", color: "#065f46" },
  cancelled: { background: "#fee2e2", color: "#991b1b" },
};

const emptyForm = () => ({
  id: null,
  doc_no: "",
  doc_date: todayISO(),
  vendor_id: "",
  payee_name: "",
  amount: "",
  description: "",
  note: "",
  payments: [{ method: "โอน", amount: "", from_bank_account_id: "" }],
});

export default function AdvanceExpensePage({ currentUser }) {
  const [docs, setDocs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" = ทั้งหมด
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const now = new Date();
    setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);
    fetchVendors();
    fetchBankAccounts();
    /* eslint-disable-next-line */
  }, []);

  async function fetchVendors() {
    try {
      const res = await fetch(MASTER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_vendors", include_inactive: "false" }),
      });
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : []);
    } catch { setVendors([]); }
  }
  async function fetchBankAccounts() {
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
      });
      const data = await res.json();
      setBankAccounts(Array.isArray(data) ? data : []);
    } catch { setBankAccounts([]); }
  }

  useEffect(() => { if (dateFrom && dateTo) fetchDocs(); /* eslint-disable-next-line */ }, [dateFrom, dateTo]);

  async function fetchDocs() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "list", date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json();
      // n8n Postgres คืน [{}] (item ว่าง) เมื่อไม่มีแถว → กรองทิ้ง
      setDocs(Array.isArray(data) ? data.filter(d => d && d.id) : []);
    } catch { setDocs([]); }
    setLoading(false);
  }

  function openCreate() { setEditTarget(null); setForm(emptyForm()); setShowForm(true); }
  function openEdit(d) {
    setEditTarget(d);
    setForm({
      id: d.id,
      doc_no: d.doc_no || "",
      doc_date: d.doc_date ? String(d.doc_date).slice(0, 10) : todayISO(),
      vendor_id: d.vendor_id ?? "",
      payee_name: d.payee_name || "",
      amount: d.amount ?? "",
      description: d.description || "",
      note: d.note || "",
      payments: Array.isArray(d.payment_methods) && d.payment_methods.length
        ? d.payment_methods.map(p => ({
            method: p.method || "โอน",
            amount: p.amount ?? "",
            from_bank_account_id: p.bank_account_id ?? p.from_bank_account_id ?? "",
          }))
        : [{ method: "โอน", amount: d.amount ?? "", from_bank_account_id: "" }],
    });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditTarget(null); setForm(emptyForm()); }

  // ----- payment rows helpers -----
  function updatePayment(idx, patch) {
    setForm(f => ({ ...f, payments: f.payments.map((p, i) => i === idx ? { ...p, ...patch } : p) }));
  }
  function addPayment() {
    setForm(f => ({ ...f, payments: [...f.payments, { method: "เงินสด", amount: "", from_bank_account_id: "" }] }));
  }
  function removePayment(idx) {
    setForm(f => ({ ...f, payments: f.payments.length === 1 ? f.payments : f.payments.filter((_, i) => i !== idx) }));
  }
  // เปลี่ยนจำนวนเงินรวม → ถ้ามีวิธีจ่ายแถวเดียว sync ยอดให้อัตโนมัติ
  function onAmountChange(val) {
    setForm(f => ({
      ...f,
      amount: val,
      payments: f.payments.length === 1 ? [{ ...f.payments[0], amount: val }] : f.payments,
    }));
  }
  const paymentsSum = form.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const paymentsExact = Math.abs(paymentsSum - (Number(form.amount) || 0)) < 0.01;

  async function handleSave() {
    if (!form.doc_date) { setMessage("❌ กรุณาระบุวันที่"); return; }
    if (!form.payee_name.trim()) { setMessage("❌ กรุณาเลือกชื่อผู้รับเงิน (Supplier)"); return; }
    if (!(Number(form.amount) > 0)) { setMessage("❌ จำนวนเงินต้องมากกว่า 0"); return; }
    // ตรวจวิธีการจ่าย
    for (let i = 0; i < form.payments.length; i++) {
      const p = form.payments[i];
      if (!p.method) { setMessage(`❌ วิธีจ่ายแถวที่ ${i + 1}: เลือกวิธี`); return; }
      if (!(Number(p.amount) > 0)) { setMessage(`❌ วิธีจ่ายแถวที่ ${i + 1}: จำนวนเงินต้องมากกว่า 0`); return; }
      if (p.method === "โอน" && !p.from_bank_account_id) { setMessage(`❌ วิธีจ่ายแถวที่ ${i + 1} (โอน): เลือกบัญชีที่โอน`); return; }
    }
    if (!paymentsExact) { setMessage(`❌ ยอดรวมวิธีจ่าย (${fmt(paymentsSum)}) ต้องเท่ากับจำนวนเงิน (${fmt(form.amount)})`); return; }
    setSaving(true);
    try {
      const body = {
        op: "save",
        id: editTarget?.id || null,
        doc_date: form.doc_date,
        vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
        payee_name: form.payee_name.trim(),
        amount: Number(form.amount) || 0,
        description: form.description,
        note: form.note,
        payment_methods: form.payments.map(p => ({
          method: p.method,
          amount: Number(p.amount) || 0,
          bank_account_id: p.method === "โอน" ? (Number(p.from_bank_account_id) || null) : null,
        })),
        created_by: currentUser?.username || currentUser?.name || "system",
      };
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.id || row?.doc_no) {
        setMessage(editTarget ? "✅ แก้ไขเรียบร้อย" : `✅ บันทึกเรียบร้อย ${row.doc_no || ""}`);
        closeForm();
        fetchDocs();
      } else {
        setMessage("❌ บันทึกไม่สำเร็จ");
      }
    } catch (e) { setMessage("❌ " + e.message); }
    setSaving(false);
  }

  async function handleClear(d) {
    if (!window.confirm(`ยืนยันเคลียร์รายการ ${d.doc_no}?\nผู้รับเงิน: ${d.payee_name}\nจำนวน: ${fmt(d.amount)} บาท`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "clear", id: d.id, cleared_by: currentUser?.username || currentUser?.name || "system" }),
      });
      setMessage("✅ เคลียร์รายการเรียบร้อย");
      fetchDocs();
    } catch { setMessage("❌ เคลียร์ไม่สำเร็จ"); }
  }

  async function handleCancel(d) {
    if (!window.confirm(`ยกเลิกรายการ ${d.doc_no}?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "cancel", id: d.id }),
      });
      setMessage("✅ ยกเลิกเรียบร้อย");
      fetchDocs();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  const kw = search.trim().toLowerCase();
  const filtered = docs.filter(d => {
    if (statusFilter && (d.status || "pending") !== statusFilter) return false;
    if (!kw) return true;
    const hay = [d.doc_no, d.payee_name, d.description, d.note].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const sumAll = filtered.reduce((s, d) => s + Number(d.amount || 0), 0);
  const sumPending = filtered.filter(d => (d.status || "pending") === "pending").reduce((s, d) => s + Number(d.amount || 0), 0);
  const sumCleared = filtered.filter(d => d.status === "cleared").reduce((s, d) => s + Number(d.amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💸 ค่าใช้จ่ายจ่ายล่วงหน้า</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2",
          color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 14 }}>
          {message}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label>วันที่:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 140 }}>
          <option value="">ทุกสถานะ</option>
          <option value="pending">รอเคลียร์</option>
          <option value="cleared">เคลียร์แล้ว</option>
          <option value="cancelled">ยกเลิก</option>
        </select>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 ค้นหา (เลขเอกสาร / ชื่อผู้รับเงิน / รายละเอียด)"
          style={{ ...inp, flex: 1, minWidth: 200 }} />
        <button onClick={fetchDocs} style={btn("#0369a1")}>🔄 รีเฟรช</button>
        <button onClick={openCreate} style={btn("#059669")}>+ เพิ่มรายการ</button>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 14, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <span>📑 รายการ: <strong>{filtered.length}</strong></span>
        <span style={{ color: "#dc2626" }}>💰 ยอดรวม: <strong>{fmt(sumAll)}</strong> บาท</span>
        <span style={{ color: "#b45309" }}>⏳ รอเคลียร์: <strong>{fmt(sumPending)}</strong> บาท</span>
        <span style={{ color: "#059669" }}>✅ เคลียร์แล้ว: <strong>{fmt(sumCleared)}</strong> บาท</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
         filtered.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div> :
         <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>เลขเอกสาร</th>
              <th style={th}>วันที่</th>
              <th style={th}>ชื่อผู้รับเงิน</th>
              <th style={th}>รายละเอียด</th>
              <th style={{ ...th, textAlign: "right" }}>จำนวนเงิน</th>
              <th style={th}>วิธีจ่าย</th>
              <th style={th}>สถานะ</th>
              <th style={th}>เคลียร์เมื่อ</th>
              <th style={{ ...th, width: 200 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const status = String(d.status || "pending");
              return (
                <tr key={d.id} style={{ borderTop: "1px solid #e5e7eb", background: status === "cancelled" ? "#fef2f2" : status === "cleared" ? "#f0fdf4" : "transparent" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{d.doc_no}</td>
                  <td style={td}>{fmtDate(d.doc_date)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{d.payee_name || "-"}</td>
                  <td style={{ ...td, color: "#6b7280", fontSize: 12 }}>{d.description || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmt(d.amount)}</td>
                  <td style={{ ...td, fontSize: 12, color: "#374151" }}>
                    {Array.isArray(d.payment_methods) && d.payment_methods.length
                      ? d.payment_methods.map(p => p.method).join(" + ")
                      : "-"}
                  </td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, ...(STATUS_STYLE[status] || STATUS_STYLE.pending) }}>
                      {STATUS_LABEL[status] || status}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{status === "cleared" ? fmtDate(d.cleared_at) : "-"}</td>
                  <td style={td}>
                    {status === "pending" && (
                      <>
                        <button onClick={() => handleClear(d)} style={{ ...btnSm, background: "#059669" }}>✓ เคลียร์</button>
                        <button onClick={() => openEdit(d)} style={{ ...btnSm, background: "#0369a1" }}>✏️ แก้</button>
                        <button onClick={() => handleCancel(d)} style={{ ...btnSm, background: "#dc2626" }}>✕</button>
                      </>
                    )}
                    {status !== "pending" && <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: 20, overflowY: "auto" }}
          onClick={() => !saving && closeForm()}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 680, maxWidth: "96vw" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>{editTarget ? `✏️ แก้ไขรายการ — ${form.doc_no}` : "💸 เพิ่มค่าใช้จ่ายจ่ายล่วงหน้า"}</h3>
              <button onClick={closeForm} style={{ marginLeft: "auto", padding: "4px 10px", background: "transparent", border: "none", cursor: "pointer", fontSize: 22, color: "#6b7280" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>วันที่ *</label>
                <input type="date" value={form.doc_date} onChange={e => setForm(f => ({ ...f, doc_date: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>จำนวนเงิน (บาท) *</label>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={e => onAmountChange(e.target.value)} placeholder="0.00" style={{ ...inp, textAlign: "right", fontFamily: "monospace" }} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>ชื่อผู้รับเงิน (Supplier) *</label>
                <select value={form.vendor_id}
                  onChange={e => {
                    const v = vendors.find(x => String(x.vendor_id) === String(e.target.value));
                    setForm(f => ({ ...f, vendor_id: e.target.value, payee_name: v ? v.vendor_name : "" }));
                  }}
                  style={inp}>
                  <option value="">-- เลือก Supplier --</option>
                  {vendors.map(v => (
                    <option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}{v.tax_id ? ` (${v.tax_id})` : ""}</option>
                  ))}
                </select>
                {form.payee_name && !form.vendor_id && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "#b45309" }}>เดิม: {form.payee_name} (ไม่พบใน Supplier — เลือกใหม่เพื่ออัปเดต)</div>
                )}
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>รายละเอียด</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} style={inp} />
              </div>
            </div>

            {/* วิธีการจ่าย (หลายวิธี) */}
            <div style={{ marginTop: 14, padding: 12, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>💳 วิธีการจ่ายเงิน</div>
                <button type="button" onClick={addPayment}
                  style={{ padding: "5px 10px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  + เพิ่มวิธี
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {form.payments.map((p, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "120px 130px 1fr 32px", gap: 8, alignItems: "center" }}>
                    <select value={p.method}
                      onChange={e => updatePayment(idx, { method: e.target.value, from_bank_account_id: e.target.value === "โอน" ? p.from_bank_account_id : "" })}
                      style={{ ...inp, padding: "7px 8px" }}>
                      {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input type="number" step="0.01" min="0" value={p.amount}
                      onChange={e => updatePayment(idx, { amount: e.target.value })}
                      placeholder="0.00"
                      style={{ ...inp, padding: "7px 8px", textAlign: "right", fontFamily: "monospace" }} />
                    {p.method === "โอน" ? (
                      <select value={p.from_bank_account_id || ""}
                        onChange={e => updatePayment(idx, { from_bank_account_id: e.target.value })}
                        style={{ ...inp, padding: "7px 8px" }}>
                        <option value="">-- เลือกบัญชีที่โอน --</option>
                        {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
                      </select>
                    ) : (
                      <div style={{ padding: "7px 8px", color: "#9ca3af", fontSize: 12 }}>— ไม่ผูกบัญชีธนาคาร</div>
                    )}
                    <button type="button" onClick={() => removePayment(idx)} disabled={form.payments.length === 1}
                      title="ลบแถวนี้"
                      style={{ padding: "5px 8px", background: form.payments.length === 1 ? "#e5e7eb" : "#fee2e2", color: "#991b1b", border: "none", borderRadius: 6, cursor: form.payments.length === 1 ? "not-allowed" : "pointer", fontSize: 14 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", background: paymentsExact ? "#d1fae5" : "#fef9c3", borderRadius: 6, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                <span>จำนวนเงิน: <strong>฿ {fmt(form.amount)}</strong></span>
                <span>รวมวิธีจ่าย: <strong style={{ color: paymentsExact ? "#065f46" : "#dc2626" }}>฿ {fmt(paymentsSum)}</strong></span>
                <span style={{ fontWeight: 700, color: paymentsExact ? "#065f46" : "#dc2626" }}>
                  {paymentsExact ? "✓ ครบ" : `ต่าง ฿ ${fmt(Math.abs(paymentsSum - (Number(form.amount) || 0)))}`}
                </span>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280" }}>💡 วิธี "โอน" จะแสดงเป็นรายการเงินออก (CR) ในรายงานการเคลื่อนไหวบัญชีธนาคาร</div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={closeForm} disabled={saving} style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
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

const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 };
const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 13, verticalAlign: "middle" };
const btn = (color) => ({ padding: "7px 14px", background: color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 });
const btnSm = { padding: "4px 10px", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600, marginRight: 4 };
