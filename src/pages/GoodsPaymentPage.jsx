import React, { useState, useEffect, useMemo } from "react";

const API = "https://n8n-new-project-gwf2.onrender.com/webhook/goods-payment-api";
const ACCOUNTING_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const FINANCE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/finance-api";

function fmtMoney(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function callApi(body) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json().catch(() => null);
}

export default function GoodsPaymentPage({ currentUser } = {}) {
  const [mainTab, setMainTab] = useState("vehicle");  // vehicle | parts
  const [brandTab, setBrandTab] = useState("HONDA");  // HONDA | YAMAHA
  const [invoices, setInvoices] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bankAccounts, setBankAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [unpaidIncomes, setUnpaidIncomes] = useState([]);  // รายการบันทึกรับเงินที่ยังไม่ชำระ (สำหรับ ใบลดหนี้)
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editPayment, setEditPayment] = useState(null);
  const [view, setView] = useState("invoices"); // invoices | history

  // form state
  const [form, setForm] = useState({
    payment_date: todayISO(),
    notes: "",
    items: [],
    methods: [{ method: "transfer", amount: 0, bank_account_id: "", reference_no: "" }],
  });

  async function loadInvoices() {
    if (mainTab !== "vehicle") return;
    setLoading(true);
    const data = await callApi({ action: "list_invoices", brand: brandTab });
    setInvoices(Array.isArray(data) ? data : []);
    setLoading(false);
    setSelectedIds(new Set());
  }
  async function loadPayments() {
    setLoading(true);
    const data = await callApi({ action: "list_payments", payment_type: "vehicle" });
    setPayments(Array.isArray(data) ? data : []);
    setLoading(false);
  }
  async function loadBanks() {
    const res = await fetch(ACCOUNTING_API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_bank_accounts" }),
    });
    const data = await res.json().catch(() => []);
    setBankAccounts(Array.isArray(data) ? data : (data?.data || []));
  }

  // โหลดรายการบันทึกรับเงินที่ยังไม่ชำระ (status != paid/cancelled)
  async function loadUnpaidIncomes() {
    try {
      const today = new Date();
      const fromY = today.getFullYear() - 2;
      const dateFrom = `${fromY}-01-01`;
      const dateTo = `${today.getFullYear() + 1}-12-31`;
      const res = await fetch(FINANCE_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "income_record", op: "list", date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json().catch(() => []);
      const arr = Array.isArray(data) ? data : (data?.data || data?.rows || []);
      console.log("[GoodsPayment] income_record op=list raw:", arr.length, "rows", arr.slice(0,3));
      const unpaid = arr.filter(r => {
        if (!r || !r.income_doc_no) return false;
        const st = String(r.status || "").toLowerCase().trim();
        return !["paid", "ชำระแล้ว", "cancelled", "ยกเลิก"].includes(st);
      });
      console.log("[GoodsPayment] unpaid count:", unpaid.length);
      setUnpaidIncomes(unpaid);
    } catch (e) {
      console.error("[GoodsPayment] loadUnpaidIncomes error:", e);
      setUnpaidIncomes([]);
    }
  }

  useEffect(() => { loadBanks(); loadUnpaidIncomes(); }, []);
  useEffect(() => { if (view === "invoices") loadInvoices(); else loadPayments(); /* eslint-disable-next-line */ }, [brandTab, mainTab, view]);

  const unpaidInvoices = useMemo(() => invoices.filter(r => r.payment_status !== "paid"), [invoices]);

  function toggleSelect(id) {
    const ns = new Set(selectedIds);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelectedIds(ns);
  }
  function selectAll() {
    if (selectedIds.size === unpaidInvoices.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(unpaidInvoices.map(r => r.id)));
  }

  function openPayForm() {
    const chosen = unpaidInvoices.filter(r => selectedIds.has(r.id));
    if (!chosen.length) return alert("เลือกใบกำกับอย่างน้อย 1 ใบ");
    const sourceTable = brandTab === "YAMAHA" ? "vehicle_purchase_receipts_singchai" : "vehicle_purchase_receipts_papao";
    setEditPayment(null);
    // each invoice_no is now a group of vehicles — expand to per-vehicle items
    const items = [];
    for (const r of chosen) {
      const sourceIds = Array.isArray(r.source_ids) ? r.source_ids : [r.id];
      const engineList = Array.isArray(r.engine_list) ? r.engine_list : [r.engine_no];
      const chassisList = Array.isArray(r.chassis_list) ? r.chassis_list : [r.chassis_no];
      const perAmount = sourceIds.length > 0 ? (Number(r.amount) || 0) / sourceIds.length : 0;
      sourceIds.forEach((sid, k) => {
        items.push({
          source_table: sourceTable,
          source_id: sid,
          invoice_no: r.invoice_no,
          invoice_date: r.invoice_date,
          engine_no: engineList[k] || "",
          chassis_no: chassisList[k] || "",
          model_code: r.model,
          amount: +perAmount.toFixed(2),
          wht_pct: 0,
        });
      });
    }
    const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    setForm({
      payment_date: todayISO(),
      notes: "",
      items,
      methods: [{ method: "transfer", amount: +total.toFixed(2), bank_account_id: "", reference_no: "" }],
    });
    setShowForm(true);
  }
  function openEdit(p) {
    setEditPayment(p);
    const methods = Array.isArray(p.payment_methods) && p.payment_methods.length
      ? p.payment_methods.map(m => ({ ...m, amount: Number(m.amount) || 0 }))
      : [{ method: p.payment_method || "transfer", amount: Number(p.net_amount) || 0, bank_account_id: p.bank_account_id || "", reference_no: "" }];
    setForm({
      payment_date: (p.payment_date || "").slice(0, 10),
      notes: p.notes || "",
      items: (p.items || []).map(it => ({ ...it })),
      methods,
    });
    setShowForm(true);
  }

  function updateItem(idx, field, val) {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: val };
    if (field === "wht_pct" || field === "amount") {
      const a = Number(items[idx].amount) || 0;
      const p = Number(items[idx].wht_pct) || 0;
      items[idx].wht_amount = +(a * p / 100).toFixed(2);
    }
    setForm({ ...form, items });
  }
  function removeItem(idx) {
    const items = form.items.filter((_, i) => i !== idx);
    setForm({ ...form, items });
  }

  const totals = useMemo(() => {
    const sub = form.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    const paid = form.methods.reduce((s, m) => s + (Number(m.amount) || 0), 0);
    return { subtotal: sub, paid, diff: +(sub - paid).toFixed(2) };
  }, [form.items, form.methods]);

  function updateMethod(idx, field, val) {
    const methods = [...form.methods];
    methods[idx] = { ...methods[idx], [field]: val };
    setForm({ ...form, methods });
  }
  function addMethod() {
    setForm({ ...form, methods: [...form.methods, { method: "transfer", amount: 0, bank_account_id: "", reference_no: "" }] });
  }
  function removeMethod(idx) {
    if (form.methods.length === 1) return;
    setForm({ ...form, methods: form.methods.filter((_, i) => i !== idx) });
  }

  async function savePayment() {
    if (!form.items.length) return alert("ต้องมีรายการอย่างน้อย 1 ใบ");
    if (!form.payment_date) return alert("ระบุวันที่");
    if (Math.abs(totals.diff) > 0.01) return alert(`ยอดที่ระบุ (${fmtMoney(totals.paid)}) ไม่เท่ากับยอดที่ต้องชำระ (${fmtMoney(totals.subtotal)})`);
    for (const m of form.methods) {
      if (m.method === "transfer" || m.method === "cheque") {
        if (!m.bank_account_id) return alert("กรุณาเลือกบัญชีให้ครบทุกวิธี (โอน/เช็ค)");
      }
      if (m.method === "credit_note" && !m.reference_no) {
        return alert("กรุณาระบุเลขที่ใบลดหนี้");
      }
      if (!Number(m.amount)) return alert("กรุณาระบุจำนวนเงินให้ครบทุกวิธี");
    }
    setLoading(true);
    const result = await callApi({
      action: "save_payment",
      payment_id: editPayment?.id || null,
      payment_date: form.payment_date,
      payment_type: "vehicle",
      brand: brandTab,
      vendor_name: brandTab === "HONDA" ? "บริษัท ไทยฮอนด้า จำกัด" : (form.items[0]?.vendor_name || ""),
      methods: form.methods.map(m => ({
        method: m.method,
        amount: Number(m.amount) || 0,
        bank_account_id: m.bank_account_id ? Number(m.bank_account_id) : null,
        reference_no: m.reference_no || null,
      })),
      notes: form.notes,
      items: form.items,
      created_by: currentUser?.username || "",
    });
    setLoading(false);
    const payNo = Array.isArray(result) && result[0]?.payment_no;
    alert(payNo ? `บันทึกสำเร็จ: ${payNo}` : "บันทึกสำเร็จ");
    setShowForm(false);
    if (view === "invoices") loadInvoices(); else loadPayments();
  }
  async function cancelPayment(p) {
    if (!confirm(`ยกเลิกการชำระ ${p.payment_no}?`)) return;
    setLoading(true);
    await callApi({ action: "cancel_payment", payment_id: p.id, cancelled_by: currentUser?.username || "" });
    setLoading(false);
    loadPayments();
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💸 บันทึกชำระค่าสินค้า</h2>
      </div>

      {/* Main tabs: vehicle | parts */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", marginBottom: 16 }}>
        {[
          { k: "vehicle", l: "🚗 ชำระค่ารถ" },
          { k: "parts", l: "🔧 ชำระค่าอะไหล่ (เร็วๆ นี้)" },
        ].map(t => (
          <button key={t.k} onClick={() => t.k === "vehicle" && setMainTab(t.k)} disabled={t.k === "parts"}
            style={{
              padding: "10px 22px", border: "none", fontWeight: 700, fontSize: 14,
              background: mainTab === t.k ? "#072d6b" : "transparent",
              color: mainTab === t.k ? "#fff" : (t.k === "parts" ? "#9ca3af" : "#374151"),
              cursor: t.k === "parts" ? "not-allowed" : "pointer",
              borderRadius: "8px 8px 0 0", opacity: t.k === "parts" ? 0.6 : 1,
            }}>{t.l}</button>
        ))}
      </div>

      {mainTab === "vehicle" && (
        <>
          {/* view tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={() => setView("invoices")}
              style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: view === "invoices" ? "#1e40af" : "#fff", color: view === "invoices" ? "#fff" : "#374151", fontWeight: 600, cursor: "pointer" }}>
              📋 ใบกำกับที่ยังไม่ชำระ
            </button>
            <button onClick={() => setView("history")}
              style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: view === "history" ? "#1e40af" : "#fff", color: view === "history" ? "#fff" : "#374151", fontWeight: 600, cursor: "pointer" }}>
              📜 ประวัติการชำระ
            </button>
          </div>

          {view === "invoices" && (
            <>
              {/* brand tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {["HONDA", "YAMAHA"].map(b => (
                  <button key={b} onClick={() => setBrandTab(b)}
                    style={{ padding: "8px 18px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
                      background: brandTab === b ? (b === "HONDA" ? "#dc2626" : "#1e40af") : "#e5e7eb",
                      color: brandTab === b ? "#fff" : "#374151" }}>
                    {b === "HONDA" ? "🔴 HONDA" : "🔵 YAMAHA"}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <button onClick={openPayForm} disabled={!selectedIds.size}
                  style={{ padding: "8px 22px", background: selectedIds.size ? "#059669" : "#9ca3af",
                    color: "#fff", border: "none", borderRadius: 8, fontWeight: 700,
                    cursor: selectedIds.size ? "pointer" : "not-allowed" }}>
                  💳 ชำระเงิน ({selectedIds.size} ใบ)
                </button>
              </div>

              {/* invoice table */}
              <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                <div style={{ overflowX: "auto", maxHeight: "65vh" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead style={{ background: "#f3f4f6", position: "sticky", top: 0 }}>
                      <tr>
                        <th style={th}><input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === unpaidInvoices.length} onChange={selectAll} /></th>
                        <th style={th}>#</th>
                        <th style={th}>เลขที่ใบกำกับ</th>
                        <th style={th}>วันที่</th>
                        <th style={{ ...th, textAlign: "center" }}>จำนวนรถ</th>
                        <th style={{ ...th, textAlign: "right" }}>จำนวนเงินรวม</th>
                        <th style={th}>ผู้ขาย</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
                      ) : unpaidInvoices.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีใบกำกับค้างชำระ</td></tr>
                      ) : unpaidInvoices.map((r, i) => (
                        <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb", background: selectedIds.has(r.id) ? "#f0fdf4" : "#fff" }}>
                          <td style={td}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                          <td style={td}>{i + 1}</td>
                          <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{r.invoice_no}</td>
                          <td style={td}>{fmtDate(r.invoice_date)}</td>
                          <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>{r.qty || 1}</td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtMoney(r.amount)}</td>
                          <td style={td}>{r.vendor_name || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {view === "history" && (
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ overflowX: "auto", maxHeight: "70vh" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead style={{ background: "#f3f4f6", position: "sticky", top: 0 }}>
                    <tr>
                      <th style={th}>#</th>
                      <th style={th}>เลขที่จ่าย</th>
                      <th style={th}>วันที่</th>
                      <th style={th}>ยี่ห้อ</th>
                      <th style={th}>ผู้ขาย</th>
                      <th style={th}>ธนาคาร</th>
                      <th style={th}>จำนวนใบ</th>
                      <th style={{ ...th, textAlign: "right" }}>จ่ายสุทธิ</th>
                      <th style={th}>สถานะ</th>
                      <th style={th}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={10} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
                    ) : payments.length === 0 ? (
                      <tr><td colSpan={10} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีบันทึก</td></tr>
                    ) : payments.map((p, i) => (
                      <tr key={p.id} style={{ borderTop: "1px solid #e5e7eb", background: p.status === "cancelled" ? "#fef2f2" : "#fff" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#0369a1" }}>{p.payment_no}</td>
                        <td style={td}>{fmtDate(p.payment_date)}</td>
                        <td style={td}>{p.brand}</td>
                        <td style={td}>{p.vendor_name}</td>
                        <td style={td}>{(() => {
                          const b = bankAccounts.find(x => Number(x.account_id || x.id) === Number(p.bank_account_id));
                          return b ? `${b.bank_name} ${b.account_no}` : "-";
                        })()}</td>
                        <td style={{ ...td, textAlign: "center" }}>{(p.items || []).length}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmtMoney(p.net_amount)}</td>
                        <td style={td}>
                          <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                            background: p.status === "cancelled" ? "#fee2e2" : "#dcfce7",
                            color: p.status === "cancelled" ? "#991b1b" : "#15803d" }}>
                            {p.status === "cancelled" ? "ยกเลิกแล้ว" : "ชำระแล้ว"}
                          </span>
                        </td>
                        <td style={td}>
                          {p.status !== "cancelled" && (
                            <>
                              <button onClick={() => openEdit(p)} style={btnSm("#1e40af")}>แก้</button>
                              <button onClick={() => cancelPayment(p)} style={{ ...btnSm("#dc2626"), marginLeft: 4 }}>ยกเลิก</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Payment form modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 24, overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 720, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0, textAlign: "center", color: "#072d6b" }}>
              💵 {editPayment ? `แก้ไขจ่ายเงิน — ${editPayment.payment_no}` : "บันทึกจ่ายเงิน"}
            </h3>

            {/* Header summary */}
            <div style={{ background: "#f3f4f6", borderRadius: 8, padding: 16, textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>
                📄 เอกสาร: <strong>{form.items.length}</strong> ใบ
              </div>
              <div style={{ fontSize: 18, color: "#374151" }}>
                💰 ยอดสุทธิ: <strong style={{ color: "#dc2626", fontSize: 22 }}>฿ {fmtMoney(totals.subtotal)}</strong>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>วันที่จ่าย *</label>
              <input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} style={inp} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>หมายเหตุ</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inp, fontFamily: "inherit" }} />
            </div>

            {/* Payment methods */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#072d6b" }}>💳 วิธีการจ่าย</div>
                <button onClick={addMethod} style={{ padding: "5px 12px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>+ เพิ่มวิธี</button>
              </div>

              {form.methods.map((m, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 130px 1fr 32px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select value={m.method} onChange={e => updateMethod(i, "method", e.target.value)} style={inp}>
                    <option value="transfer">โอน</option>
                    <option value="cash">เงินสด</option>
                    <option value="cheque">เช็ค</option>
                    <option value="credit_note">ใบลดหนี้</option>
                  </select>
                  <input type="number" value={m.amount} onChange={e => updateMethod(i, "amount", e.target.value)} placeholder="จำนวนเงิน" style={{ ...inp, textAlign: "right" }} readOnly={m.method === "credit_note"} title={m.method === "credit_note" ? "ยอดจะถูกเซ็ตอัตโนมัติเมื่อเลือกใบรับเงิน" : ""} />
                  {m.method === "credit_note" ? (() => {
                    // กรอง: customer_name ใน income ต้องมี brand keyword (ยามาฮ่า/ฮอนด้า) ตรงกับ brandTab
                    const keywords = brandTab === "HONDA"
                      ? ["ฮอนด้า", "honda", "HONDA"]
                      : ["ยามาฮ่า", "yamaha", "YAMAHA"];
                    const matching = unpaidIncomes.filter(r => {
                      const c = String(r.customer_name || "");
                      const cU = c.toUpperCase();
                      return keywords.some(k => c.includes(k) || cU.includes(k.toUpperCase()));
                    });
                    return (
                      <select value={m.reference_no || ""} onChange={e => {
                        const docNo = e.target.value;
                        const picked = unpaidIncomes.find(r => r.income_doc_no === docNo);
                        const amt = picked ? Number(picked.net_to_pay || picked.total || 0) : 0;
                        // ใช้ setForm รวมการอัปเดต ป้องกัน state ซ้อนกัน
                        setForm(prev => {
                          const methods = [...prev.methods];
                          methods[i] = { ...methods[i], reference_no: docNo, amount: amt };
                          return { ...prev, methods };
                        });
                      }} style={inp}>
                        <option value="">-- เลือกใบรับเงิน ({matching.length}/{unpaidIncomes.length} ใบ) --</option>
                        {matching.map(r => (
                          <option key={r.income_doc_no} value={r.income_doc_no}>
                            {r.income_doc_no} · {fmtMoney(r.net_to_pay || r.total)} บ. · {(r.customer_name || "").slice(0, 25)}
                          </option>
                        ))}
                      </select>
                    );
                  })() : (
                    <select value={m.bank_account_id} onChange={e => updateMethod(i, "bank_account_id", e.target.value)} style={inp} disabled={m.method === "cash"}>
                      <option value="">{m.method === "cash" ? "-- เงินสด --" : "-- เลือกบัญชีโอนจาก --"}</option>
                      {bankAccounts.map(b => (
                        <option key={b.account_id || b.id} value={b.account_id || b.id}>{b.bank_name} {b.account_no} ({b.account_name})</option>
                      ))}
                    </select>
                  )}
                  <button onClick={() => removeMethod(i)} disabled={form.methods.length === 1}
                    style={{ width: 32, height: 32, background: form.methods.length === 1 ? "#e5e7eb" : "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: form.methods.length === 1 ? "not-allowed" : "pointer", fontSize: 16 }}>✕</button>
                </div>
              ))}

              <div style={{
                background: Math.abs(totals.diff) < 0.01 ? "#dcfce7" : "#fef2f2",
                color: Math.abs(totals.diff) < 0.01 ? "#15803d" : "#b91c1c",
                padding: "8px 12px", borderRadius: 6, marginTop: 8, fontSize: 13,
                display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8
              }}>
                <span>ยอดที่ต้องชำระ: <strong>฿ {fmtMoney(totals.subtotal)}</strong></span>
                <span>รวมที่ระบุ: <strong>฿ {fmtMoney(totals.paid)}</strong></span>
                <span style={{ fontWeight: 700 }}>
                  {Math.abs(totals.diff) < 0.01 ? "✓ ครบ" : `ต่าง ${fmtMoney(Math.abs(totals.diff))} ${totals.diff > 0 ? "(ขาด)" : "(เกิน)"}`}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "10px 24px", background: "#9ca3af", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={savePayment} disabled={loading || Math.abs(totals.diff) > 0.01}
                style={{ padding: "10px 32px", background: (loading || Math.abs(totals.diff) > 0.01) ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: (loading || Math.abs(totals.diff) > 0.01) ? "not-allowed" : "pointer" }}>
                {loading ? "⏳ กำลังบันทึก..." : "💾 บันทึกจ่ายเงิน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#374151", whiteSpace: "nowrap" };
const td = { padding: "6px 10px", fontSize: 12, verticalAlign: "middle" };
const inp = { width: "100%", padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const btnSm = (color) => ({ padding: "4px 10px", background: color, color: "#fff", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer" });
