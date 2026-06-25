import React, { useEffect, useState, useRef } from "react";

// บันทึกค่าใช้จ่ายจาก FLOW ACC — แสดง/จ่ายเงินค่าใช้จ่ายที่ upload จาก flow (ตาราง flow_expense_documents)
// mirror หน้า "บันทึกค่าใช้จ่าย": 3 แท็บ (รายการ / บันทึกจ่ายเงิน / ประวัติการจ่ายเงิน) + สถานะ + จัดการ
// ไม่มี: ฟอร์มสร้าง/แก้ไข (ข้อมูลมาจาก upload), WHT, ใบลดหนี้
const FLOW_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/upload-accounting-expense";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

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
function payable(d) { return Number(d.net_to_pay || d.total || 0); }

export default function FlowExpenseRecordPage({ currentUser }) {
  const [docs, setDocs] = useState([]);
  const [types, setTypes] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterAff, setFilterAff] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("list"); // list | pay | history
  const [statusFilter, setStatusFilter] = useState({ draft: true, paid: true, cancelled: true });
  const [selected, setSelected] = useState({});
  // payment dialog
  const [payDialog, setPayDialog] = useState(false);
  const [payForm, setPayForm] = useState({ paid_date: todayISO(), payment_note: "" });
  const [payments, setPayments] = useState([{ method: "โอน", amount: 0, from_bank_account_id: "" }]);
  const [editPayDocNo, setEditPayDocNo] = useState(null);
  const [editTotalRequired, setEditTotalRequired] = useState(0);
  const [savingPay, setSavingPay] = useState(false);

  useEffect(() => {
    const now = new Date();
    setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);
    fetchBankAccounts();
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => { if (dateFrom && dateTo) fetchDocs(); /* eslint-disable-next-line */ }, [dateFrom, dateTo, filterAff, filterType]);
  useEffect(() => { fetchTypes(); /* eslint-disable-next-line */ }, [filterAff]);

  async function fetchDocs() {
    setLoading(true);
    try {
      const res = await fetch(FLOW_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_expenses", date_from: dateFrom, date_to: dateTo,
          affiliation: filterAff || undefined, expense_type: filterType || undefined,
        }),
      });
      const data = await res.json();
      setDocs(Array.isArray(data) ? data.filter(r => r && (r.expense_doc_no || r.id)) : []);
    } catch { setDocs([]); }
    setLoading(false);
  }
  async function fetchTypes() {
    try {
      const res = await fetch(FLOW_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_expense_types", affiliation: filterAff || undefined }),
      });
      const data = await res.json();
      setTypes((Array.isArray(data) ? data : []).map(r => r.expense_type).filter(Boolean));
    } catch { setTypes([]); }
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

  async function handleCancel(d) {
    if (!window.confirm(`ยกเลิกเอกสาร ${d.expense_doc_no}?`)) return;
    try {
      await fetch(FLOW_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "flow_cancel", id: d.id }),
      });
      setMessage("✅ ยกเลิกเรียบร้อย"); fetchDocs();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }
  async function handleDelete(d) {
    if (!window.confirm(`ลบเอกสาร ${d.expense_doc_no}?\n⚠️ ลบถาวร กู้คืนไม่ได้`)) return;
    try {
      const res = await fetch(FLOW_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "flow_delete", id: d.id }),
      });
      const data = await res.json();
      const deleted = Number(data?.deleted_count ?? data?.[0]?.deleted_count ?? 0);
      if (deleted > 0) { setMessage("✅ ลบเรียบร้อย"); fetchDocs(); }
      else setMessage("❌ ลบไม่ได้ (เอกสารที่ชำระแล้วต้องยกเลิกใบจ่ายก่อน)");
    } catch (e) { setMessage("❌ ลบไม่สำเร็จ: " + e.message); }
  }
  function handlePrint(d) {
    const w = window.open("", "_blank", "width=820,height=720");
    if (!w) { setMessage("❌ เปิดหน้าต่างพิมพ์ไม่ได้ (ป๊อปอัพถูกบล็อก)"); return; }
    const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(d.expense_doc_no)}</title>
      <style>*{font-family:'Tahoma','Sarabun',sans-serif;box-sizing:border-box}body{margin:24px;color:#111827;font-size:13px}
      h1{font-size:20px;margin:0 0 4px}.muted{color:#6b7280}.row{display:flex;justify-content:space-between;gap:16px;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;margin-top:10px}td{padding:4px 0}.tot{display:flex;justify-content:flex-end;margin-top:10px}.tot table{width:320px}
      @media print{body{margin:0}}</style></head><body>
      <div class="row"><div><h1>ใบบันทึกค่าใช้จ่าย (FLOW ACC)</h1>
        <div class="muted">เลขที่ <b>${esc(d.expense_doc_no)}</b> · วันที่ ${fmtDate(d.doc_date)}</div>
        ${d.affiliation ? `<div class="muted">สังกัด: ${esc(d.affiliation)}</div>` : ""}
        ${d.expense_type ? `<div class="muted">ประเภท: ${esc(d.expense_type)}</div>` : ""}</div>
        <div style="text-align:right"><div><b>${esc(d.vendor_name || "-")}</b></div>
        ${d.vendor_tax_id ? `<div class="muted">เลขผู้เสียภาษี: ${esc(d.vendor_tax_id)}</div>` : ""}
        ${d.reference_no ? `<div class="muted">อ้างอิง: ${esc(d.reference_no)}</div>` : ""}</div></div>
      ${d.description ? `<div class="muted">รายละเอียด: ${esc(d.description)}</div>` : ""}
      <div class="tot"><table>
        <tr><td class="muted">มูลค่า</td><td style="text-align:right">${fmt(d.subtotal)}</td></tr>
        ${Number(d.vat_amount) > 0 ? `<tr><td class="muted">ภาษีมูลค่าเพิ่ม</td><td style="text-align:right">${fmt(d.vat_amount)}</td></tr>` : ""}
        <tr><td><b>ยอดรวมทั้งสิ้น</b></td><td style="text-align:right"><b>${fmt(d.total)}</b></td></tr>
      </table></div>
      <script>window.onload=function(){window.print();}<\/script></body></html>`;
    w.document.write(html); w.document.close();
  }

  // ----- filtering -----
  const kw = search.trim().toLowerCase();
  const filtered = docs.filter(d => {
    if (!kw) return true;
    const hay = [d.expense_doc_no, d.vendor_name, d.reference_no, d.expense_type, d.description].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });
  const statusOf = d => (d.status || "draft");
  const statusFiltered = filtered.filter(d => statusFilter[statusOf(d)]);
  const statusTotal = statusFiltered.reduce((s, d) => s + Number(d.total || 0), 0);

  const draftDocs = filtered.filter(d => statusOf(d) === "draft");
  const paidDocs = filtered.filter(d => d.status === "paid");
  const paidGroups = {};
  paidDocs.forEach(d => {
    const key = d.paid_doc_no || `_${d.id}`;
    if (!paidGroups[key]) paidGroups[key] = { paid_doc_no: d.paid_doc_no, paid_at: d.paid_at, payment_method: d.payment_method, from_bank_account_id: d.from_bank_account_id, items: [], net: 0 };
    paidGroups[key].items.push(d);
    paidGroups[key].net += payable(d);
  });
  const paidGroupsList = Object.values(paidGroups);

  const selectedIds = Object.keys(selected).filter(k => selected[k]).map(Number);
  const selectedRows = draftDocs.filter(d => selectedIds.includes(d.id));
  const selectedNet = selectedRows.reduce((s, d) => s + payable(d), 0);

  function toggleOne(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (draftDocs.length && draftDocs.every(d => selected[d.id])) { setSelected({}); return; }
    const next = {}; draftDocs.forEach(d => { next[d.id] = true; }); setSelected(next);
  }

  // ----- payment dialog -----
  function openPayDialog() {
    if (selectedIds.length === 0) { setMessage("❌ เลือกเอกสารก่อน"); return; }
    setEditPayDocNo(null); setEditTotalRequired(0);
    setPayForm({ paid_date: todayISO(), payment_note: "" });
    setPayments([{ method: "โอน", amount: Number(selectedNet) || 0, from_bank_account_id: "" }]);
    setPayDialog(true);
  }
  function openEditPayDialog(g) {
    if (!g.paid_doc_no) return;
    const total = Number(g.net || 0);
    setEditPayDocNo(g.paid_doc_no); setEditTotalRequired(total);
    const toLocalISO = (v) => {
      if (!v) return todayISO();
      const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    setPayForm({ paid_date: toLocalISO(g.paid_at), payment_note: "" });
    const method = g.payment_method && g.payment_method !== "ผสม" ? g.payment_method : "โอน";
    setPayments([{ method, amount: total, from_bank_account_id: g.from_bank_account_id || "" }]);
    setPayDialog(true);
  }
  function updatePayment(idx, patch) { setPayments(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p)); }
  function addPayment() { setPayments(prev => [...prev, { method: "เงินสด", amount: 0, from_bank_account_id: "" }]); }
  function removePayment(idx) { setPayments(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)); }

  async function savePayment() {
    const totalRequired = editPayDocNo ? Number(editTotalRequired) || 0 : Number(selectedNet) || 0;
    const sum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (Math.abs(sum - totalRequired) > 0.01) {
      setMessage(`❌ ยอดรวมของวิธีการจ่าย (${sum.toFixed(2)}) ต้องเท่ากับยอดที่จะชำระ (${totalRequired.toFixed(2)})`); return;
    }
    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      if (!p.method) { setMessage(`❌ แถวที่ ${i + 1}: เลือกวิธีจ่าย`); return; }
      if (Number(p.amount) <= 0) { setMessage(`❌ แถวที่ ${i + 1}: จำนวนเงินต้องมากกว่า 0`); return; }
      if (p.method === "โอน" && !p.from_bank_account_id) { setMessage(`❌ แถวที่ ${i + 1} (โอน): เลือกบัญชี`); return; }
    }
    setSavingPay(true);
    try {
      const body = {
        action: editPayDocNo ? "flow_edit_payment" : "flow_save_payment",
        paid_doc_no: editPayDocNo || undefined,
        expense_ids: editPayDocNo ? undefined : selectedIds,
        paid_date: payForm.paid_date,
        payment_note: payForm.payment_note,
        paid_by: currentUser?.username || currentUser?.name || "system",
        payments: payments.map(p => ({
          method: p.method, amount: Number(p.amount) || 0,
          from_bank_account_id: p.method === "โอน" ? (Number(p.from_bank_account_id) || null) : null,
        })),
      };
      const res = await fetch(FLOW_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      setMessage(editPayDocNo ? "✅ แก้ไขใบจ่ายเรียบร้อย" : `✅ บันทึกจ่ายเงินเรียบร้อย ${data?.paid_doc_no || data?.[0]?.paid_doc_no || ""}`);
      setPayDialog(false); setEditPayDocNo(null); setSelected({}); fetchDocs();
    } catch (e) { setMessage("❌ " + e.message); }
    setSavingPay(false);
  }
  async function cancelPaymentGroup(g) {
    if (!g.paid_doc_no) return;
    if (!window.confirm(`ยกเลิกใบจ่ายเงิน ${g.paid_doc_no}?\nเอกสาร ${g.items.length} ใบจะกลับเป็น "ร่าง"`)) return;
    try {
      await fetch(FLOW_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "flow_cancel_payment", paid_doc_no: g.paid_doc_no }),
      });
      setMessage("✅ ยกเลิกใบจ่ายเรียบร้อย"); fetchDocs();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  const vatAll = statusFiltered.reduce((s, d) => s + Number(d.vat_amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📒 บันทึกค่าใช้จ่ายจาก FLOW ACC</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2",
          color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 14 }}>{message}</div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, borderBottom: "2px solid #e5e7eb" }}>
        {[["list", "📒 รายการค่าใช้จ่าย"], ["pay", "💵 บันทึกจ่ายเงิน"], ["history", "📋 ประวัติการจ่ายเงิน"]].map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setSelected({}); }}
            style={{ padding: "10px 18px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: tab === k ? "#072d6b" : "#6b7280", borderBottom: tab === k ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label>วันที่:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <select value={filterAff} onChange={e => setFilterAff(e.target.value)} style={inp} title="กรองตามสังกัด">
          <option value="">🏢 สังกัด: ทั้งหมด</option>
          <option value="ป.เปา">ป.เปา</option>
          <option value="สิงห์ชัย">สิงห์ชัย</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inp, maxWidth: 240 }} title="กรองตามประเภทค่าใช้จ่าย">
          <option value="">🏷️ ประเภท: ทั้งหมด</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 ค้นหา (เลขเอกสาร / Vendor / ประเภท / รายละเอียด)" style={{ ...inp, flex: 1, minWidth: 200 }} />
        <button onClick={() => { fetchDocs(); fetchTypes(); }} style={btn("#0369a1")}>🔄 รีเฟรช</button>
      </div>

      {/* TAB: รายการ */}
      {tab === "list" && (
        <>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
            <span>📒 เอกสาร: <strong>{statusFiltered.length}</strong></span>
            <span style={{ color: "#6b7280" }}>VAT: <strong>{fmt(vatAll)}</strong></span>
            <span style={{ color: "#dc2626" }}>💰 ยอดรวม: <strong>{fmt(statusTotal)}</strong> บาท</span>
            <div style={{ flex: 1 }} />
            <span style={{ color: "#6b7280", fontSize: 13 }}>แสดงสถานะ:</span>
            {[{ key: "draft", label: "ร่าง", color: "#78350f" }, { key: "paid", label: "ชำระแล้ว", color: "#065f46" }, { key: "cancelled", label: "ยกเลิก", color: "#991b1b" }].map(s => (
              <label key={s.key} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 13, fontWeight: 600, color: s.color }}>
                <input type="checkbox" checked={statusFilter[s.key]} onChange={e => setStatusFilter(f => ({ ...f, [s.key]: e.target.checked }))} />{s.label}
              </label>
            ))}
          </div>
          <DocsTable docs={statusFiltered} loading={loading} handleCancel={handleCancel} handlePrint={handlePrint} handleDelete={handleDelete} showCheckbox={false} />
        </>
      )}

      {/* TAB: บันทึกจ่ายเงิน */}
      {tab === "pay" && (
        <>
          <div style={{ padding: "10px 14px", background: "#fef9c3", border: "1px solid #fcd34d", borderRadius: 10, marginBottom: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span>เลือก: <strong>{selectedIds.length}</strong> / {draftDocs.length} เอกสาร</span>
            <span style={{ color: "#dc2626" }}>ยอดรวม: <strong>{fmt(selectedNet)}</strong> บาท</span>
            <div style={{ flex: 1 }} />
            <button onClick={openPayDialog} disabled={selectedIds.length === 0}
              style={{ ...btn(selectedIds.length === 0 ? "#9ca3af" : "#059669"), cursor: selectedIds.length === 0 ? "not-allowed" : "pointer" }}>💵 บันทึกจ่ายเงิน</button>
          </div>
          <DocsTable docs={draftDocs} loading={loading} handleCancel={handleCancel} handlePrint={handlePrint} handleDelete={handleDelete} showCheckbox={true} selected={selected} toggleOne={toggleOne} toggleAll={toggleAll} />
        </>
      )}

      {/* TAB: ประวัติการจ่ายเงิน */}
      {tab === "history" && (
        <>
          <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
            <span>💵 ใบจ่ายเงิน: <strong>{paidGroupsList.length}</strong></span>
            <span style={{ marginLeft: 14, color: "#dc2626" }}>ยอดรวม: <strong>{fmt(paidGroupsList.reduce((s, g) => s + g.net, 0))}</strong> บาท</span>
          </div>
          {paidGroupsList.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>ยังไม่มีประวัติ</div>
          ) : paidGroupsList.map(g => {
            const bank = bankAccounts.find(a => Number(a.account_id) === Number(g.from_bank_account_id));
            return (
              <div key={g.paid_doc_no} style={{ marginBottom: 12, background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <strong style={{ fontFamily: "monospace", color: "#065f46", fontSize: 15 }}>{g.paid_doc_no || "-"}</strong>
                  <span style={{ fontSize: 12 }}>📅 {fmtDate(g.paid_at)}</span>
                  <span style={{ fontSize: 12 }}>💳 {g.payment_method || "-"}</span>
                  {bank && <span style={{ fontSize: 12 }}>🏦 {bank.bank_name} · {bank.account_no}</span>}
                  <span style={{ marginLeft: "auto", fontWeight: 700, color: "#065f46" }}>{g.items.length} ใบ · {fmt(g.net)}</span>
                  <button onClick={() => openEditPayDialog(g)} style={{ ...btnSm, background: "#0369a1" }}>✏️ แก้ไข</button>
                  <button onClick={() => cancelPaymentGroup(g)} style={{ ...btnSm, background: "#dc2626" }}>✕ ยกเลิก</button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8, background: "#fff", borderRadius: 6, overflow: "hidden" }}>
                  <thead style={{ background: "#f3f4f6" }}>
                    <tr>
                      <th style={th}>เลขเอกสาร</th><th style={th}>วันที่</th><th style={th}>Vendor</th>
                      <th style={th}>ประเภท</th><th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map(d => (
                      <tr key={d.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{d.expense_doc_no}</td>
                        <td style={td}>{fmtDate(d.doc_date)}</td>
                        <td style={td}>{d.vendor_name || "-"}</td>
                        <td style={{ ...td, color: "#6b7280", fontSize: 12 }}>{d.expense_type || "-"}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#059669" }}>{fmt(d.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}

      {/* Payment Dialog */}
      {payDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !savingPay && setPayDialog(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 760, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: editPayDocNo ? "#7c3aed" : "#072d6b" }}>
              {editPayDocNo ? `✏️ แก้ไขใบจ่ายเงิน — ${editPayDocNo}` : "💵 บันทึกจ่ายเงิน"}
            </h3>
            {!editPayDocNo && (
              <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                <div>📒 เอกสาร: <b>{selectedIds.length}</b> ใบ</div>
                <div>💰 ยอดที่ต้องจ่าย: <b style={{ color: "#dc2626", fontSize: 18 }}>฿ {fmt(selectedNet)}</b></div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>วันที่จ่าย *</label>
                <input type="date" value={payForm.paid_date} onChange={e => setPayForm(p => ({ ...p, paid_date: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={payForm.payment_note} onChange={e => setPayForm(p => ({ ...p, payment_note: e.target.value }))} rows={2} style={inp} />
              </div>
            </div>

            {(() => {
              const totalRequired = editPayDocNo ? Number(editTotalRequired) || 0 : Number(selectedNet) || 0;
              const sum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
              const diff = totalRequired - sum;
              const exact = Math.abs(diff) < 0.01;
              return (
                <div style={{ marginTop: 14, padding: 12, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>💳 วิธีการจ่าย</div>
                    <button type="button" onClick={addPayment} style={{ padding: "5px 10px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ เพิ่มวิธี</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {payments.map((p, idx) => (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "130px 140px 1fr 32px", gap: 10, alignItems: "center" }}>
                        <select value={p.method}
                          onChange={e => updatePayment(idx, { method: e.target.value, from_bank_account_id: e.target.value === "โอน" ? p.from_bank_account_id : "" })}
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }}>
                          <option value="โอน">โอน</option>
                          <option value="เงินสด">เงินสด</option>
                          <option value="เช็ค">เช็ค</option>
                        </select>
                        <input type="number" step="0.01" min="0" value={p.amount}
                          onChange={e => updatePayment(idx, { amount: e.target.value })} placeholder="0.00"
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, textAlign: "right" }} />
                        {p.method === "โอน" ? (
                          <select value={p.from_bank_account_id || ""} onChange={e => updatePayment(idx, { from_bank_account_id: e.target.value })}
                            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }}>
                            <option value="">-- เลือกบัญชีโอนจาก --</option>
                            {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
                          </select>
                        ) : (<div style={{ padding: "7px 10px", color: "#9ca3af", fontSize: 12 }}>—</div>)}
                        <button type="button" onClick={() => removePayment(idx)} disabled={payments.length === 1} title="ลบแถวนี้"
                          style={{ padding: "5px 8px", background: payments.length === 1 ? "#e5e7eb" : "#fee2e2", color: "#991b1b", border: "none", borderRadius: 6, cursor: payments.length === 1 ? "not-allowed" : "pointer", fontSize: 14 }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, padding: "8px 12px", background: exact ? "#d1fae5" : "#fef9c3", borderRadius: 6, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                    <span>ยอดที่ต้องชำระ: <strong>฿ {fmt(totalRequired)}</strong></span>
                    <span>รวมที่ระบุ: <strong style={{ color: exact ? "#065f46" : "#dc2626" }}>฿ {fmt(sum)}</strong></span>
                    <span style={{ fontWeight: 700, color: exact ? "#065f46" : "#dc2626" }}>{exact ? "✓ ครบ" : diff > 0 ? `ขาดอีก ฿ ${fmt(diff)}` : `เกิน ฿ ${fmt(-diff)}`}</span>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => { setPayDialog(false); setEditPayDocNo(null); }} disabled={savingPay}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              {(() => {
                const totalRequired = editPayDocNo ? Number(editTotalRequired) || 0 : Number(selectedNet) || 0;
                const sum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                const exact = Math.abs(sum - totalRequired) < 0.01;
                const disabled = savingPay || !exact;
                return (
                  <button onClick={savePayment} disabled={disabled} title={!exact ? "ยอดรวมต้องเท่ากับยอดที่จะชำระ" : ""}
                    style={{ padding: "8px 20px", background: disabled ? "#9ca3af" : (editPayDocNo ? "#7c3aed" : "#059669"), color: "#fff", border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 700 }}>
                    {savingPay ? "กำลังบันทึก..." : (editPayDocNo ? "💾 บันทึกแก้ไข" : "💾 บันทึกจ่ายเงิน")}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocsTable({ docs, loading, handleCancel, handlePrint, handleDelete, showCheckbox, selected, toggleOne, toggleAll }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
      {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
       docs.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div> :
       <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "#072d6b", color: "#fff" }}>
          <tr>
            {showCheckbox && <th style={{ ...th, width: 40, textAlign: "center" }}>
              <input type="checkbox" checked={docs.length > 0 && docs.every(d => selected?.[d.id])} onChange={toggleAll} />
            </th>}
            <th style={th}>เลขเอกสาร</th>
            <th style={th}>วันที่</th>
            <th style={th}>สังกัด</th>
            <th style={th}>Vendor</th>
            <th style={th}>เลขที่อ้างอิง</th>
            <th style={th}>ประเภทค่าใช้จ่าย</th>
            <th style={{ ...th, textAlign: "right" }}>มูลค่า</th>
            <th style={{ ...th, textAlign: "right" }}>VAT</th>
            <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
            <th style={th}>สถานะ</th>
            <th style={{ ...th, width: 60, textAlign: "center" }}>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {docs.map(d => {
            const status = String(d.status || "draft").toLowerCase();
            return (
              <tr key={d.id} style={{ borderTop: "1px solid #e5e7eb", background: status === "cancelled" ? "#fef2f2" : status === "paid" ? "#f0fdf4" : (selected?.[d.id] ? "#fef3c7" : "transparent") }}>
                {showCheckbox && <td style={{ ...td, textAlign: "center" }}>
                  <input type="checkbox" checked={!!selected?.[d.id]} onChange={() => toggleOne(d.id)} />
                </td>}
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#991b1b" }}>{d.expense_doc_no}</td>
                <td style={td}>{fmtDate(d.doc_date)}</td>
                <td style={td}>{d.affiliation ? <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: d.affiliation === "ป.เปา" ? "#fee2e2" : "#dbeafe", color: d.affiliation === "ป.เปา" ? "#991b1b" : "#1e40af" }}>{d.affiliation}</span> : "-"}</td>
                <td style={td}>{d.vendor_name || "-"}</td>
                <td style={td}>{d.reference_no || "-"}</td>
                <td style={{ ...td, fontSize: 12 }}>{d.expense_type ? <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#ecfeff", color: "#0e7490" }}>{d.expense_type}</span> : "-"}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(d.subtotal)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#6b7280" }}>{Number(d.vat_amount) > 0 ? fmt(d.vat_amount) : "-"}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(d.total)}</td>
                <td style={td}>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: status === "paid" ? "#d1fae5" : status === "cancelled" ? "#fee2e2" : "#fef3c7",
                    color: status === "paid" ? "#065f46" : status === "cancelled" ? "#991b1b" : "#78350f" }}>
                    {status === "paid" ? "ชำระแล้ว" : status === "cancelled" ? "ยกเลิก" : "ร่าง"}
                  </span>
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  <KebabMenu d={d} status={status} handleCancel={handleCancel} handlePrint={handlePrint} handleDelete={handleDelete} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>}
    </div>
  );
}

function KebabMenu({ d, status, handleCancel, handlePrint, handleDelete }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.right - 170 });
    }
    setOpen(o => !o);
  }
  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false); };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const run = fn => () => { setOpen(false); fn(); };
  const Item = ({ icon, label, onClick, color }) => (
    <button onClick={onClick} style={{ ...menuItem, color: color || "#374151" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <span style={{ width: 18, display: "inline-block", textAlign: "center" }}>{icon}</span>{label}
    </button>
  );

  return (
    <>
      <button ref={btnRef} onClick={toggle} title="เมนู"
        style={{ width: 30, height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: open ? "#e2e8f0" : "#fff", cursor: "pointer", fontSize: 18, lineHeight: "14px", color: "#475569" }}>⋯</button>
      {open && (
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: 170, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", zIndex: 2000, padding: 4 }}>
          <Item icon="🖨️" label="พิมพ์" onClick={run(() => handlePrint(d))} />
          {status !== "paid" && <div style={{ height: 1, background: "#e5e7eb", margin: "4px 6px" }} />}
          {status !== "paid" && status !== "cancelled" && <Item icon="🚫" label="ยกเลิก" onClick={run(() => handleCancel(d))} color="#b45309" />}
          {status !== "paid" && <Item icon="🗑️" label="ลบ" onClick={run(() => handleDelete(d))} color="#dc2626" />}
        </div>
      )}
    </>
  );
}

const inp = { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const th = { padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" };
const td = { padding: "8px 12px", verticalAlign: "top" };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 };
const btnSm = { padding: "4px 10px", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 };
const menuItem = { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", background: "transparent", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontSize: 13, fontWeight: 600, textAlign: "left" };
function btn(bg) { return { padding: "8px 16px", background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }; }
