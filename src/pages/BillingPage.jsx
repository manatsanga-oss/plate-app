import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

export default function BillingPage({ currentUser }) {
  const [brand, setBrand] = useState("ฮอนด้า");
  const [category, setCategory] = useState("ค่าจดทะเบียน");
  const [categoryOpts, setCategoryOpts] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [runFilters, setRunFilters] = useState([]); // array of run_code
  const [showBilled, setShowBilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [detailRow, setDetailRow] = useState(null);
  const [viewMode, setViewMode] = useState("pending");  // 'pending' | 'history'
  const [historyExpanded, setHistoryExpanded] = useState({});
  const [editingDiscount, setEditingDiscount] = useState({ amount: 0, note: "" });
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [selectedBills, setSelectedBills] = useState({});  // {billing_doc_no: true}
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ paid_date: "", payment_method: "โอน", payment_note: "", paid_to_vendor: "", wht_rate: 0, wht_amount: 0, wht_base: 0, from_bank_account_id: "" });
  const [savingPayment, setSavingPayment] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);

  async function post(body) {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function fetchCategories() {
    try {
      const data = await post({ action: "get_expense_categories" });
      const cats = (Array.isArray(data) ? data : []).map(r => r.category).filter(Boolean);
      setCategoryOpts(cats);
      if (cats.length && !cats.includes(category)) setCategory(cats[0]);
    } catch {}
  }

  async function fetchData() {
    if (!brand || !category) return;
    setLoading(true);
    setSelected({});
    try {
      const data = await post({
        action: "get_billing_data",
        brand, category,
        only_unbilled: !showBilled,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [brand, category, showBilled]);
  useEffect(() => {
    // เปลี่ยน tab → set showBilled อัตโนมัติ
    if (viewMode === "history" || viewMode === "paidHistory") {
      setShowBilled(true);
      if (vendors.length === 0) fetchVendors();
      if (viewMode === "paidHistory" && bankAccounts.length === 0) fetchBankAccounts();
    } else {
      setShowBilled(false);
    }
    setSelectedBills({});
    /* eslint-disable-next-line */
  }, [viewMode]);
  useEffect(() => {
    // sync discount state เมื่อเปิด detail
    if (detailRow) {
      setEditingDiscount({
        amount: Number(detailRow.discount_amount || 0),
        note: detailRow.discount_note || "",
      });
    }
  }, [detailRow]);

  async function fetchVendors() {
    try {
      const res = await fetch("https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_vendors", include_inactive: "false" }),
      });
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : []);
    } catch { setVendors([]); }
  }

  async function fetchBankAccounts() {
    try {
      const res = await fetch("https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
      });
      const data = await res.json();
      setBankAccounts(Array.isArray(data) ? data : []);
    } catch { setBankAccounts([]); }
  }

  // คำนวณ base ของ WHT จากค่าบริการจดทะเบียน
  function calcWhtBase() {
    const selectedDocNos = Object.keys(selectedBills).filter(k => selectedBills[k]);
    const selRows = filtered.filter(r => selectedDocNos.includes(r.billing_doc_no));
    let base = 0;
    selRows.forEach(r => {
      let items = [];
      try { items = Array.isArray(r.bill_items) ? r.bill_items : (typeof r.bill_items === "string" ? JSON.parse(r.bill_items) : []); } catch {}
      items.forEach(it => {
        const name = String(it.expense_name || "");
        if (name.includes("ค่าบริการ")) base += Number(it.amount || 0);
      });
    });
    return base;
  }

  function onVendorChange(vendorName) {
    const v = vendors.find(x => x.vendor_name === vendorName);
    const rate = v ? Number(v.wht_rate || 0) : 0;
    const base = calcWhtBase();
    const amount = Math.round((base * rate / 100) * 100) / 100;
    setPaymentForm(p => ({ ...p, paid_to_vendor: vendorName, wht_rate: rate, wht_base: base, wht_amount: amount }));
  }

  function openPaymentDialog() {
    const selectedDocNos = Object.keys(selectedBills).filter(k => selectedBills[k]);
    if (selectedDocNos.length === 0) { setMessage("❌ เลือกใบวางบิลก่อน"); return; }
    if (vendors.length === 0) fetchVendors();
    if (bankAccounts.length === 0) fetchBankAccounts();
    const today = new Date().toISOString().slice(0, 10);
    setPaymentForm({ paid_date: today, payment_method: "โอน", payment_note: "", paid_to_vendor: "", wht_rate: 0, wht_amount: 0, wht_base: calcWhtBase(), from_bank_account_id: "" });
    setPaymentDialog(true);
  }

  async function savePayment() {
    const selectedDocNos = Object.keys(selectedBills).filter(k => selectedBills[k]);
    if (selectedDocNos.length === 0) return;
    if (!paymentForm.paid_to_vendor) { setMessage("❌ กรุณาเลือก Vendor"); return; }
    setSavingPayment(true);
    try {
      const res = await post({
        action: "save_billing_payment",
        billing_doc_nos: selectedDocNos,
        paid_date: paymentForm.paid_date,
        payment_method: paymentForm.payment_method,
        payment_note: paymentForm.payment_note,
        paid_to_vendor: paymentForm.paid_to_vendor,
        wht_rate: Number(paymentForm.wht_rate) || 0,
        wht_amount: Number(paymentForm.wht_amount) || 0,
        from_bank_account_id: Number(paymentForm.from_bank_account_id) || null,
        paid_by: currentUser?.username || "system",
      });
      const payNo = res?.paid_doc_no || res?.[0]?.paid_doc_no || "";
      setMessage(`✅ บันทึกจ่ายเงิน ${payNo} สำเร็จ`);
      setPaymentDialog(false);
      setSelectedBills({});
      fetchData();
    } catch {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSavingPayment(false);
  }

  function reprintGroup(g) {
    // พิมพ์สรุปสำหรับใบเดียว — ใช้ข้อมูลจริงที่บันทึกไว้
    const isPaid = !!g.items[0]?.paid_at;
    const fromBankId = g.items[0]?.from_bank_account_id;
    const fromBank = fromBankId ? bankAccounts.find(b => String(b.account_id) === String(fromBankId)) : null;
    const vendorName = g.items[0]?.paid_to_vendor;
    const toVendor = vendorName ? vendors.find(v => v.vendor_name === vendorName) : null;
    const payDate = g.items[0]?.paid_at ? String(g.items[0].paid_at).slice(0, 10) : "";
    const method = g.items[0]?.payment_method || "";
    const whtRate = Number(g.items[0]?.wht_rate || 0);
    const whtAmount = Number(g.items[0]?.wht_amount || 0);

    // ถ้ายังไม่ได้ fetch vendors/banks → fetch ก่อน
    if (isPaid && (vendors.length === 0 || bankAccounts.length === 0)) {
      Promise.all([fetchVendors(), fetchBankAccounts()]).then(() => {
        // retry หลัง fetch เสร็จ
        setTimeout(() => reprintGroup(g), 300);
      });
      return;
    }

    const html = buildPaymentSummaryHTML({
      docNos: [g.billing_doc_no], rows: g.items,
      vendor: vendorName || "",
      payDate, method, whtRate, whtAmount,
      fromBank, toVendor,
    });
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) { setMessage("popup blocked"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  function printPaymentSummary() {
    const selectedDocNos = Object.keys(selectedBills).filter(k => selectedBills[k]);
    if (selectedDocNos.length === 0) { setMessage("❌ เลือกใบวางบิลก่อนพิมพ์"); return; }
    // collect rows: paidHistory ใช้ paid_doc_no, history ใช้ billing_doc_no
    const selRows = viewMode === "paidHistory"
      ? filtered.filter(r => selectedDocNos.includes(r.paid_doc_no))
      : filtered.filter(r => selectedDocNos.includes(r.billing_doc_no));
    const fromBank = bankAccounts.find(b => String(b.account_id) === String(paymentForm.from_bank_account_id));
    const toVendor = vendors.find(v => v.vendor_name === paymentForm.paid_to_vendor);
    const html = buildPaymentSummaryHTML({
      docNos: selectedDocNos, rows: selRows, vendor: paymentForm.paid_to_vendor,
      payDate: paymentForm.paid_date, method: paymentForm.payment_method,
      whtRate: Number(paymentForm.wht_rate) || 0,
      whtAmount: Number(paymentForm.wht_amount) || 0,
      fromBank, toVendor,
    });
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) { setMessage("popup blocked"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  async function saveDiscount() {
    if (!detailRow) return;
    setSavingDiscount(true);
    try {
      await post({
        action: "save_submission_discount",
        submission_id: detailRow.submission_id,
        discount_amount: Number(editingDiscount.amount) || 0,
        discount_note: editingDiscount.note || "",
      });
      setMessage("✅ บันทึกส่วนลดเรียบร้อย");
      // refresh data
      fetchData();
      // update detailRow ใน UI
      const newDiscount = Number(editingDiscount.amount) || 0;
      const subtotal = Number(detailRow.subtotal_amount || detailRow.bill_amount || 0) + Number(detailRow.discount_amount || 0);
      setDetailRow({ ...detailRow, discount_amount: newDiscount, discount_note: editingDiscount.note, bill_amount: subtotal - newDiscount, subtotal_amount: subtotal });
    } catch {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSavingDiscount(false);
  }

  function fmtBranch(code) {
    if (!code) return "-";
    return /^0+$/.test(String(code).trim()) ? "SCY01" : String(code).trim();
  }

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (branchFilter && fmtBranch(r.branch_code) !== branchFilter) return false;
    if (runFilters.length > 0 && !runFilters.includes(r.run_code)) return false;
    if (!kw) return true;
    const hay = [r.customer_name, r.customer_phone, r.engine_no, r.chassis_no, r.plate_number, r.invoice_no, r.run_code]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  function toggleRun(code) {
    setRunFilters(rs => rs.includes(code) ? rs.filter(x => x !== code) : [...rs, code]);
  }

  const branchOpts = [...new Set(rows.map(r => fmtBranch(r.branch_code)).filter(v => v && v !== "-"))].sort();
  const runOpts = [...new Set(rows.map(r => r.run_code).filter(Boolean))].sort().reverse();
  const selectedRows = filtered.filter(r => selected[r.submission_id]);
  const selCount = selectedRows.length;
  const selTotal = selectedRows.reduce((sum, r) => sum + Number(r.bill_amount || 0), 0);

  function toggleOne(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (filtered.every(r => selected[r.submission_id])) {
      const next = { ...selected };
      filtered.forEach(r => delete next[r.submission_id]);
      setSelected(next);
    } else {
      const next = { ...selected };
      filtered.forEach(r => { next[r.submission_id] = true; });
      setSelected(next);
    }
  }

  async function saveBilling() {
    if (selCount === 0) { setMessage("เลือกรายการก่อน"); return; }
    const now = new Date();
    const docNo = `BILL-${(now.getFullYear() + 543).toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    if (!window.confirm(`บันทึกวางบิล ${selCount} รายการ\nหมวด: ${category}\nยอดรวม: ${selTotal.toLocaleString()} บาท\nเลขที่ใบ: ${docNo}`)) return;
    setSaving(true);
    setMessage("");
    try {
      // groupby brand to compute amount per row (each row's bill_amount)
      // backend stores billing_amount per submission
      await Promise.all(selectedRows.map(r =>
        post({
          action: "save_billing",
          submission_ids: [r.submission_id],
          billing_doc_no: docNo,
          category,
          amount: r.bill_amount || 0,
        })
      ));
      setMessage(`✅ บันทึกใบวางบิล ${docNo} สำเร็จ ${selCount} รายการ`);
      fetchData();
    } catch {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  }

  function printBilling() {
    if (selCount === 0) { setMessage("เลือกรายการก่อนพิมพ์"); return; }
    const html = buildBillingHTML({ rows: selectedRows, brand, category, total: selTotal });
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { setMessage("popup blocked"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 วางบิล</h2>
      </div>

      {/* View mode tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["pending", "📋 รอวางบิล"],
          ["history", "💵 บันทึกจ่ายเงิน"],
          ["paidHistory", "📚 ประวัติการจ่ายเงิน"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => setViewMode(v)}
            style={{ padding: "10px 22px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: viewMode === v ? "#072d6b" : "#6b7280",
              borderBottom: viewMode === v ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Brand tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["ฮอนด้า", "ยามาฮ่า"].map(b => (
          <button key={b} onClick={() => setBrand(b)}
            style={{ padding: "10px 24px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15, fontWeight: 600,
              background: brand === b ? "#072d6b" : "#e5e7eb",
              color: brand === b ? "#fff" : "#374151" }}>
            {b}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 14 }}>
          {message}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>หมวดค่าใช้จ่าย:</label>
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, minWidth: 180 }}>
          {categoryOpts.length === 0 && <option value="">(ยังไม่มีหมวด)</option>}
          {categoryOpts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {viewMode === "pending" && (
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={showBilled} onChange={e => setShowBilled(e.target.checked)} />
            แสดงที่วางบิลแล้ว
          </label>
        )}

        <button onClick={fetchData}
          style={{ padding: "7px 12px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>🔄</button>
      </div>

      {/* Run filter chips — เฉพาะโหมด pending */}
      {viewMode === "pending" && runOpts.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <strong style={{ fontSize: 13, color: "#374151" }}>เลขที่ใบรับทะเบียน:</strong>
          {runOpts.map(r => {
            const active = runFilters.includes(r);
            const count = rows.filter(x => x.run_code === r).length;
            return (
              <button key={r} onClick={() => toggleRun(r)}
                style={{ padding: "5px 12px", border: "1px solid " + (active ? "#072d6b" : "#d1d5db"), background: active ? "#072d6b" : "#fff", color: active ? "#fff" : "#374151", borderRadius: 999, cursor: "pointer", fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>
                {active && "✓ "}{r} <span style={{ opacity: 0.7, fontFamily: "Tahoma", marginLeft: 4 }}>({count})</span>
              </button>
            );
          })}
          {runFilters.length > 0 && (
            <button onClick={() => setRunFilters([])}
              style={{ padding: "5px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>✕ ล้าง</button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
            {runFilters.length > 0 ? `เลือก ${runFilters.length} ใบ` : "(เลือกได้หลายใบ)"}
          </span>
        </div>
      )}

      {/* Action bar — เฉพาะโหมด pending */}
      {viewMode === "pending" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fbbf24" }}>
          <strong style={{ fontSize: 14, color: "#92400e" }}>
            เลือก {selCount} / {filtered.length} รายการ • ยอดรวม <span style={{ fontSize: 18 }}>{selTotal.toLocaleString()}</span> บาท
          </strong>
          <button onClick={printBilling} disabled={selCount === 0}
            style={{ marginLeft: "auto", padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: selCount === 0 ? "not-allowed" : "pointer", opacity: selCount === 0 ? 0.5 : 1, fontFamily: "Tahoma", fontSize: 13, fontWeight: 600 }}>
            🖨️ พิมพ์ใบวางบิล
          </button>
          <button onClick={saveBilling} disabled={selCount === 0 || saving || showBilled}
            style={{ padding: "8px 18px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: (selCount === 0 || saving || showBilled) ? "not-allowed" : "pointer", opacity: (selCount === 0 || saving || showBilled) ? 0.5 : 1, fontFamily: "Tahoma", fontSize: 14, fontWeight: 600 }}>
            💾 {saving ? "กำลังบันทึก..." : "บันทึกวางบิล"}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          {viewMode === "paidHistory" ? "ยังไม่มีประวัติการจ่ายเงิน"
            : viewMode === "history" ? "ยังไม่มีใบวางบิล"
            : "ไม่มีรายการรอวางบิล (ทุกคันถูกวางบิลแล้ว หรือยังไม่มีรับคืนทะเบียน)"}
        </div>
      ) : viewMode === "history" || viewMode === "paidHistory" ? (
        // ประวัติการวางบิล — group by billing_doc_no (history) หรือ paid_doc_no/วันที่จ่าย (paidHistory)
        (() => {
          // กรองก่อน group
          const visibleRows = filtered.filter(r => {
            if (viewMode === "history") return !r.paid_at;
            if (viewMode === "paidHistory") return !!r.paid_at;
            return true;
          });

          const grouped = {};
          visibleRows.forEach(r => {
            // paidHistory: group ด้วย paid_doc_no (หรือ fallback วันที่จ่าย) → รวมทุกบิลที่จ่ายในใบเดียวกัน
            // history: group ด้วย billing_doc_no
            const key = viewMode === "paidHistory"
              ? (r.paid_doc_no || `paid-${(r.paid_at || "").slice(0,10)}`)
              : (r.billing_doc_no || "unknown");
            if (!grouped[key]) {
              grouped[key] = {
                group_key: key,
                billing_doc_no: viewMode === "paidHistory" ? null : key,
                paid_doc_no: viewMode === "paidHistory" ? r.paid_doc_no : null,
                paid_at: r.paid_at,
                paid_to_vendor: r.paid_to_vendor,
                payment_method: r.payment_method,
                billed_at: r.billed_at,
                items: [],
                total: 0,
                billDocNos: new Set(),
              };
            }
            grouped[key].items.push(r);
            grouped[key].total += Number(r.bill_amount || 0);
            if (r.billing_doc_no) grouped[key].billDocNos.add(r.billing_doc_no);
            // เก็บเวลาวางบิลแรกสุดในกลุ่ม (สำหรับ paidHistory จะแสดงช่วงวันที่)
            if (r.billed_at && (!grouped[key].billed_at || new Date(r.billed_at) < new Date(grouped[key].billed_at))) {
              grouped[key].billed_at = r.billed_at;
            }
          });
          let groups = Object.values(grouped).map(g => ({ ...g, billDocCount: g.billDocNos.size }));
          groups.sort((a, b) => {
            // paidHistory เรียงตามวันที่จ่าย, history เรียงตามวันที่วางบิล
            if (viewMode === "paidHistory") {
              const da = a.paid_at ? new Date(a.paid_at).getTime() : 0;
              const db = b.paid_at ? new Date(b.paid_at).getTime() : 0;
              return db - da;
            }
            const da = a.billed_at ? new Date(a.billed_at).getTime() : 0;
            const db = b.billed_at ? new Date(b.billed_at).getTime() : 0;
            return db - da;
          });
          const selectedDocNos = Object.keys(selectedBills).filter(k => selectedBills[k]);
          const selectedGroups = groups.filter(g => selectedBills[g.group_key]);
          const selSum = selectedGroups.reduce((s, g) => s + g.total, 0);
          const totalRowCount = groups.reduce((s, g) => s + g.items.length, 0);
          return (
            <div>
              <div style={{ marginBottom: 10, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", display: "flex", gap: 18, fontSize: 13, alignItems: "center", flexWrap: "wrap" }}>
                <span>{viewMode === "paidHistory" ? "💵 ใบจ่ายเงิน" : "📑 ใบวางบิล"}: <strong>{groups.length}</strong></span>
                <span>📋 รายการรวม: <strong>{totalRowCount}</strong></span>
                <span>💰 ยอดรวม: <strong style={{ color: "#dc2626" }}>{groups.reduce((s, g) => s + g.total, 0).toLocaleString()}</strong></span>
                {selectedDocNos.length > 0 && (
                  <span style={{ padding: "4px 10px", background: "#fef9c3", borderRadius: 6, fontWeight: 600 }}>
                    ✓ เลือก {selectedDocNos.length} ใบ · ฿ {selSum.toLocaleString()}
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={printPaymentSummary} disabled={selectedDocNos.length === 0}
                  style={{ padding: "7px 14px", background: selectedDocNos.length === 0 ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: selectedDocNos.length === 0 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}>
                  🖨️ พิมพ์สรุป
                </button>
                {viewMode === "history" && (
                  <button onClick={openPaymentDialog} disabled={selectedDocNos.length === 0}
                    style={{ padding: "7px 18px", background: selectedDocNos.length === 0 ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: selectedDocNos.length === 0 ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700 }}>
                    💵 บันทึกจ่ายเงิน
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {groups.map(g => {
                  const open = !!historyExpanded[g.group_key];
                  const isPaid = !!g.paid_at;
                  const paidVendor = g.paid_to_vendor;
                  const paidDocNo = g.paid_doc_no;
                  const isPaidView = viewMode === "paidHistory";
                  return (
                    <div key={g.group_key} style={{ background: "#fff", borderRadius: 10, border: selectedBills[g.group_key] ? "2px solid #059669" : "1px solid #e5e7eb", overflow: "hidden" }}>
                      <div onClick={() => setHistoryExpanded(prev => ({ ...prev, [g.group_key]: !prev[g.group_key] }))}
                        style={{ padding: "10px 14px", background: isPaid ? "linear-gradient(90deg,#065f46 0%,#10b981 100%)" : "linear-gradient(90deg,#072d6b 0%,#0e4ba8 100%)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                        <input type="checkbox"
                          checked={!!selectedBills[g.group_key]}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setSelectedBills(prev => ({ ...prev, [g.group_key]: e.target.checked }))}
                          style={{ width: 16, height: 16, cursor: "pointer" }}
                          title={isPaid ? "เลือกเพื่อพิมพ์สรุปซ้ำ" : "เลือกเพื่อบันทึกจ่ายเงิน"} />
                        <span style={{ fontSize: 14 }}>{open ? "▾" : "▸"}</span>
                        {isPaidView ? (
                          <>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{paidDocNo || g.group_key}</span>
                            <span style={{ background: "#fbbf24", color: "#78350f", padding: "3px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700 }} title="วันที่จ่ายเงิน">
                              💵 จ่ายเมื่อ {g.paid_at ? new Date(g.paid_at).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"}
                            </span>
                            <span style={{ fontSize: 12 }}>📑 {g.billDocCount} ใบวางบิล · 📋 {g.items.length} รายการ</span>
                            {paidVendor && (
                              <span style={{ background: "#fff3", padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                👤 {paidVendor}
                              </span>
                            )}
                            {g.payment_method && (
                              <span style={{ background: "#fff3", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>{g.payment_method}</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{g.billing_doc_no}</span>
                            <span style={{ background: "#fff3", padding: "2px 8px", borderRadius: 4, fontSize: 11 }} title="วันที่วางบิล">
                              📅 {g.billed_at ? new Date(g.billed_at).toLocaleString("th-TH") : "-"}
                            </span>
                            <span style={{ fontSize: 13 }}>📋 {g.items.length} รายการ</span>
                            {isPaid && (
                              <span style={{ background: "#fff3", padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                ✓ จ่ายแล้ว · {paidDocNo || ""}{paidVendor ? ` · ${paidVendor}` : ""}
                              </span>
                            )}
                          </>
                        )}
                        <div style={{ flex: 1 }} />
                        <span style={{ fontWeight: 700, fontSize: 15 }}>฿ {g.total.toLocaleString()}</span>
                        <button onClick={e => { e.stopPropagation(); reprintGroup(g); }}
                          title={isPaid ? "พิมพ์สรุปการจ่ายเงินซ้ำ" : "พิมพ์ใบวางบิลซ้ำ"}
                          style={{ padding: "4px 10px", background: "#fff2", color: "#fff", border: "1px solid #fff5", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                          🖨️
                        </button>
                      </div>

                      {open && (
                        <table className="data-table">
                          <thead style={{ background: "#f3f4f6" }}>
                            <tr>
                              <th style={{ width: 40 }}>#</th>
                              {isPaidView && <th>เลขที่ใบวางบิล</th>}
                              <th>เลขที่รับทะเบียน</th>
                              <th>ลูกค้า</th>
                              <th>เลขเครื่อง</th>
                              <th>หมวด</th>
                              <th>เลขทะเบียน</th>
                              <th>รายการค่าใช้จ่าย</th>
                              <th style={{ textAlign: "right" }}>ยอดรวม</th>
                              <th style={{ width: 60 }}>ดู</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.items.map((r, i) => {
                              const items = Array.isArray(r.bill_items) ? r.bill_items : (r.bill_items ? (typeof r.bill_items === "string" ? JSON.parse(r.bill_items) : r.bill_items) : []);
                              return (
                                <tr key={r.submission_id}>
                                  <td style={{ textAlign: "center" }}>{i + 1}</td>
                                  {isPaidView && <td style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, color: "#065f46" }}>{r.billing_doc_no || "-"}</td>}
                                  <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#072d6b" }}>{r.run_code || "-"}</td>
                                  <td>{r.customer_name || "-"}</td>
                                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.engine_no || "-"}</td>
                                  <td>{r.plate_category || "-"}</td>
                                  <td style={{ fontWeight: 600 }}>{r.plate_number || "-"}</td>
                                  <td style={{ fontSize: 11 }}>
                                    {items.length === 0 ? <span style={{ color: "#9ca3af" }}>—</span> : (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                        {items.map((it, idx) => (
                                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                                            <span style={{ color: it.group_by === "finance" ? "#7c3aed" : it.group_by === "province" ? "#0f766e" : it.group_by === "cc" ? "#dc2626" : "#1e3a8a" }}>
                                              {it.group_by === "finance" ? "💼 " : it.group_by === "province" ? "📍 " : it.group_by === "cc" ? "🏍️ " : ""}{it.expense_name}
                                            </span>
                                            <span style={{ fontWeight: 600, color: "#374151" }}>{Number(it.amount).toLocaleString()}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ textAlign: "right", fontWeight: 700, fontSize: 15, color: "#072d6b" }}>
                                    {r.bill_amount ? Number(r.bill_amount).toLocaleString() : "—"}
                                  </td>
                                  <td style={{ textAlign: "center" }}>
                                    <button onClick={() => setDetailRow(r)}
                                      style={{ padding: "4px 10px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                                      👁️
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot style={{ background: "#fef9c3", fontWeight: 700 }}>
                            <tr>
                              <td colSpan={isPaidView ? 8 : 7} style={{ textAlign: "right", padding: "8px 12px" }}>รวม {g.items.length} รายการ</td>
                              <td style={{ textAlign: "right", padding: "8px 12px", color: "#dc2626", fontSize: 15 }}>{g.total.toLocaleString()}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}><input type="checkbox" checked={filtered.length > 0 && filtered.every(r => selected[r.submission_id])} onChange={toggleAll} /></th>
                <th style={{ width: 40 }}>#</th>
                <th>เลขที่รับทะเบียน</th>
                <th>ลูกค้า</th>
                <th>เลขเครื่อง</th>
                <th>หมวด</th>
                <th>เลขทะเบียน</th>
                <th>รายการค่าใช้จ่าย</th>
                <th style={{ textAlign: "right" }}>ยอดรวม</th>
                {showBilled && <th>ใบวางบิล</th>}
                <th style={{ width: 60 }}>ดู</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const items = Array.isArray(r.bill_items) ? r.bill_items : (r.bill_items ? (typeof r.bill_items === "string" ? JSON.parse(r.bill_items) : r.bill_items) : []);
                return (
                <tr key={r.submission_id} style={{ background: selected[r.submission_id] ? "#eff6ff" : (r.billed_at ? "#f9fafb" : undefined), cursor: "pointer" }}
                  onClick={() => !showBilled && toggleOne(r.submission_id)}>
                  <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    {!showBilled && <input type="checkbox" checked={!!selected[r.submission_id]} onChange={() => toggleOne(r.submission_id)} />}
                  </td>
                  <td style={{ textAlign: "center" }}>{i + 1}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#072d6b" }}>{r.run_code || "-"}</td>
                  <td>{r.customer_name || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.engine_no || "-"}</td>
                  <td>{r.plate_category || "-"}</td>
                  <td style={{ fontWeight: 600 }}>{r.plate_number || "-"}</td>
                  <td style={{ fontSize: 11 }}>
                    {items.length === 0 ? <span style={{ color: "#9ca3af" }}>—</span> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {items.map((it, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                            <span style={{ color: it.group_by === "finance" ? "#7c3aed" : it.group_by === "province" ? "#0f766e" : it.group_by === "cc" ? "#dc2626" : "#1e3a8a" }}>
                              {it.group_by === "finance" ? "💼 " : it.group_by === "province" ? "📍 " : it.group_by === "cc" ? "🏍️ " : ""}{it.expense_name}
                            </span>
                            <span style={{ fontWeight: 600, color: "#374151" }}>{Number(it.amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, fontSize: 15, color: r.bill_amount ? "#072d6b" : "#9ca3af" }}>
                    {r.bill_amount ? Number(r.bill_amount).toLocaleString() : "—"}
                  </td>
                  {showBilled && <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.billing_doc_no || "-"}</td>}
                  <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setDetailRow(r)}
                      style={{ padding: "4px 10px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                      👁️
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {detailRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDetailRow(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 700, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #e5e7eb" }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📄 รายละเอียด — {detailRow.run_code}</h3>
              <button onClick={() => setDetailRow(null)}
                style={{ marginLeft: "auto", padding: "4px 10px", background: "transparent", border: "none", cursor: "pointer", fontSize: 22, color: "#6b7280" }}>✕</button>
            </div>

            <DetailSection title="ข้อมูลลูกค้า" items={[
              ["ชื่อลูกค้า", detailRow.customer_name],
              ["เบอร์โทร", detailRow.customer_phone, "mono"],
              ["เลขบัตรประชาชน", detailRow.id_card, "mono"],
              ["ที่อยู่", detailRow.address],
              ["ตำบล", detailRow.sub_district],
              ["อำเภอ", detailRow.district],
              ["จังหวัด", detailRow.customer_province],
              ["รหัสไปรษณีย์", detailRow.postal_code, "mono"],
            ]} />

            <DetailSection title="ข้อมูลรถ" items={[
              ["เลขที่ใบขาย", detailRow.invoice_no, "mono"],
              ["วันที่ขาย", detailRow.sale_date ? String(detailRow.sale_date).slice(0,10) : "-"],
              ["ยี่ห้อ", detailRow.brand],
              ["รุ่น", detailRow.model_series],
              ["CC", detailRow.engine_cc ? `${detailRow.engine_cc} cc` : "-"],
              ["สี", detailRow.color_name],
              ["เลขเครื่อง", detailRow.engine_no, "mono"],
              ["เลขถัง (VIN)", detailRow.chassis_no, "mono"],
              ["ไฟแนนท์", (detailRow.finance_company && detailRow.finance_company !== '-') ? detailRow.finance_company : "เงินสด"],
              ["สาขาที่ขาย", fmtBranch(detailRow.branch_code)],
            ]} />

            <DetailSection title="ข้อมูลทะเบียน" items={[
              ["เลขที่รับทะเบียน", detailRow.run_code, "mono"],
              ["หมวด", detailRow.plate_category],
              ["เลขทะเบียน", detailRow.plate_number, "bold"],
              ["จังหวัดทะเบียน", detailRow.plate_province],
              ["วันจดทะเบียน", detailRow.register_date ? String(detailRow.register_date).slice(0,10) : "-"],
              ["วันรับคืน", detailRow.received_at ? String(detailRow.received_at).slice(0,10) : "-"],
            ]} />

            {/* Bill Items */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: "0 0 8px", color: "#374151", fontSize: 14 }}>💰 รายการค่าใช้จ่าย</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th style={{ padding: "6px 10px", textAlign: "left", border: "1px solid #e5e7eb" }}>รายการ</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", border: "1px solid #e5e7eb", width: 90 }}>กลุ่ม</th>
                    <th style={{ padding: "6px 10px", textAlign: "right", border: "1px solid #e5e7eb", width: 90 }}>ยอด (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let items = [];
                    try { items = Array.isArray(detailRow.bill_items) ? detailRow.bill_items : (typeof detailRow.bill_items === "string" ? JSON.parse(detailRow.bill_items) : []); } catch {}
                    return items.length === 0 ? (
                      <tr><td colSpan={3} style={{ textAlign: "center", padding: 16, color: "#9ca3af" }}>ไม่มีรายการ</td></tr>
                    ) : items.map((it, i) => {
                      const groupColor = it.group_by === "finance" ? "#7c3aed" : it.group_by === "province" ? "#0f766e" : it.group_by === "cc" ? "#dc2626" : "#1e3a8a";
                      const groupLabel = it.group_by === "finance" ? "ไฟแนนท์" : it.group_by === "province" ? "จังหวัด" : it.group_by === "cc" ? "CC" : "ยี่ห้อ";
                      return (
                        <tr key={i}>
                          <td style={{ padding: "6px 10px", border: "1px solid #e5e7eb" }}>{it.expense_name}</td>
                          <td style={{ padding: "6px 10px", textAlign: "center", border: "1px solid #e5e7eb", color: groupColor, fontSize: 11, fontWeight: 600 }}>{groupLabel}</td>
                          <td style={{ padding: "6px 10px", textAlign: "right", border: "1px solid #e5e7eb", fontWeight: 600 }}>{Number(it.amount).toLocaleString()}</td>
                        </tr>
                      );
                    });
                  })()}
                  {(() => {
                    const subtotal = Number(detailRow.subtotal_amount || 0) || (Number(detailRow.bill_amount || 0) + Number(detailRow.discount_amount || 0));
                    const discount = Number(editingDiscount.amount) || 0;
                    const net = subtotal - discount;
                    const isLocked = !!detailRow.billed_at;  // วางบิลแล้ว → ห้ามแก้
                    return (
                      <>
                        <tr style={{ background: "#f3f4f6" }}>
                          <td colSpan={2} style={{ padding: "8px 10px", textAlign: "right", border: "1px solid #d1d5db", fontWeight: 600 }}>รวม</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", border: "1px solid #d1d5db", fontWeight: 600 }}>{subtotal.toLocaleString()}</td>
                        </tr>
                        <tr style={{ background: "#fee2e2" }}>
                          <td colSpan={2} style={{ padding: "8px 10px", textAlign: "right", border: "1px solid #fca5a5", fontWeight: 600, color: "#991b1b" }}>
                            <span style={{ marginRight: 8 }}>ส่วนลด</span>
                            <input type="number" step="0.01" min="0" max={subtotal}
                              value={editingDiscount.amount}
                              onChange={e => setEditingDiscount(p => ({ ...p, amount: e.target.value }))}
                              disabled={isLocked}
                              style={{ width: 100, padding: "3px 6px", textAlign: "right", border: "1px solid #fca5a5", borderRadius: 4, fontFamily: "monospace", background: isLocked ? "#f3f4f6" : "#fff" }}
                            />
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", border: "1px solid #fca5a5", fontWeight: 600, color: "#991b1b" }}>−{discount.toLocaleString()}</td>
                        </tr>
                        <tr style={{ background: "#fef3c7" }}>
                          <td colSpan={2} style={{ padding: "8px 10px", textAlign: "right", border: "1px solid #fbbf24", fontWeight: 700 }}>ยอดสุทธิ</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", border: "1px solid #fbbf24", fontWeight: 700, fontSize: 16, color: "#072d6b" }}>{net.toLocaleString()}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>

              {/* discount note + save button */}
              {!detailRow.billed_at && (
                <div style={{ marginTop: 8, padding: "10px 12px", background: "#fef9c3", borderRadius: 6, border: "1px solid #fbbf24" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>หมายเหตุส่วนลด (ถ้ามี)</label>
                  <input type="text" value={editingDiscount.note}
                    onChange={e => setEditingDiscount(p => ({ ...p, note: e.target.value }))}
                    placeholder="เช่น ลดให้ลูกค้าประจำ, เคสพิเศษ"
                    style={{ width: "100%", padding: "5px 8px", borderRadius: 4, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" }} />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <button onClick={saveDiscount} disabled={savingDiscount || Number(editingDiscount.amount) === Number(detailRow.discount_amount || 0) && editingDiscount.note === (detailRow.discount_note || "")}
                      style={{ padding: "6px 16px", background: savingDiscount ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: savingDiscount ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}>
                      {savingDiscount ? "กำลังบันทึก..." : "💾 บันทึกส่วนลด"}
                    </button>
                  </div>
                </div>
              )}
              {detailRow.billed_at && detailRow.discount_note && (
                <div style={{ marginTop: 8, padding: "8px 12px", background: "#fef9c3", borderRadius: 6, fontSize: 12, color: "#92400e" }}>
                  💬 หมายเหตุส่วนลด: {detailRow.discount_note}
                </div>
              )}
            </div>

            {detailRow.billed_at && (
              <DetailSection title="ข้อมูลการวางบิล" items={[
                ["เลขที่ใบวางบิล", detailRow.billing_doc_no, "mono"],
                ["วันที่วางบิล", detailRow.billed_at ? new Date(detailRow.billed_at).toLocaleString("th-TH") : "-"],
              ]} />
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setDetailRow(null)}
                style={{ padding: "8px 24px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      {paymentDialog && (() => {
        const selectedDocNos = Object.keys(selectedBills).filter(k => selectedBills[k]);
        const selRows = filtered.filter(r => selectedDocNos.includes(r.billing_doc_no));
        const selSum = selRows.reduce((s, r) => s + Number(r.bill_amount || 0), 0);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
            onClick={() => !savingPayment && setPaymentDialog(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
              <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>💵 บันทึกจ่ายเงิน</h3>

              <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                <div><strong>📑 ใบที่จ่าย:</strong> {selectedDocNos.length} ใบ</div>
                <div><strong>📋 รายการรวม:</strong> {selRows.length} รายการ</div>
                <div><strong>💰 ยอดรวม:</strong> <span style={{ color: "#dc2626", fontWeight: 700 }}>฿ {selSum.toLocaleString()}</span></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>วันที่จ่าย *</label>
                  <input type="date" value={paymentForm.paid_date} onChange={e => setPaymentForm(p => ({ ...p, paid_date: e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>วิธีจ่าย</label>
                  <select value={paymentForm.payment_method} onChange={e => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" }}>
                    <option value="โอน">โอน</option>
                    <option value="เงินสด">เงินสด</option>
                    <option value="เช็ค">เช็ค</option>
                    <option value="หักบัญชี">หักบัญชี</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1 / span 2" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>Vendor (จ่ายให้) *</label>
                  <select value={paymentForm.paid_to_vendor} onChange={e => onVendorChange(e.target.value)}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" }}>
                    <option value="">-- เลือก Vendor --</option>
                    {vendors.map(v => (
                      <option key={v.vendor_id} value={v.vendor_name}>{v.vendor_name}{v.wht_rate ? ` (${v.wht_rate}%)` : ""}</option>
                    ))}
                  </select>
                  {vendors.length === 0 && (
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>⚠️ ยังไม่มี Vendor — ไปเพิ่มที่ Master Data → Supplier</div>
                  )}
                </div>
                <div style={{ gridColumn: "1 / span 2" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>หมายเหตุ</label>
                  <textarea value={paymentForm.payment_note} onChange={e => setPaymentForm(p => ({ ...p, payment_note: e.target.value }))} rows={2}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
                </div>
              </div>

              {/* Bank Accounts block */}
              <div style={{ marginTop: 12, padding: 10, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>🏦 บัญชีธนาคาร</div>

                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#1e40af", marginBottom: 2 }}>โอนจาก (บัญชีบริษัท) *</label>
                  <select value={paymentForm.from_bank_account_id} onChange={e => setPaymentForm(p => ({ ...p, from_bank_account_id: e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" }}>
                    <option value="">-- เลือกบัญชีโอนจาก --</option>
                    {bankAccounts.map(b => (
                      <option key={b.account_id} value={b.account_id}>
                        {b.bank_name} · {b.account_no} · {b.account_name}
                      </option>
                    ))}
                  </select>
                  {bankAccounts.length === 0 && (
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>⚠️ ยังไม่มีบัญชีธนาคาร — ไปเพิ่มที่ Accounting → บัญชีธนาคาร</div>
                  )}
                </div>

                {/* TO bank info — auto from selected vendor */}
                {paymentForm.paid_to_vendor && (() => {
                  const v = vendors.find(x => x.vendor_name === paymentForm.paid_to_vendor);
                  if (!v) return null;
                  return (
                    <div style={{ padding: 8, background: "#fff", borderRadius: 6, fontSize: 12 }}>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>โอนเข้าบัญชี (ของ Vendor)</div>
                      {v.bank_name || v.bank_account_no ? (
                        <div>
                          <strong>{v.bank_name || "-"}</strong>
                          {v.bank_branch && <span> · {v.bank_branch}</span>}
                          <div style={{ fontFamily: "monospace", color: "#0369a1", fontWeight: 600, marginTop: 2 }}>
                            {v.bank_account_no || "-"}
                            {v.bank_account_name && <span style={{ fontFamily: "Tahoma", color: "#374151", marginLeft: 8 }}>({v.bank_account_name})</span>}
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: "#dc2626", fontSize: 11 }}>⚠️ Vendor ยังไม่มีข้อมูลบัญชีธนาคาร — ไปเพิ่มที่ Master Data → Supplier</div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* WHT block */}
              <div style={{ marginTop: 12, padding: 10, background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>🧾 หักณที่จ่าย</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, marginBottom: 2 }}>ยอดค่าบริการ (base)</label>
                    <input type="text" value={Number(paymentForm.wht_base || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })} readOnly
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, textAlign: "right", background: "#fff", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, marginBottom: 2 }}>อัตรา %</label>
                    <input type="number" step="0.01" value={paymentForm.wht_rate}
                      onChange={e => {
                        const r = Number(e.target.value) || 0;
                        const amt = Math.round((paymentForm.wht_base * r / 100) * 100) / 100;
                        setPaymentForm(p => ({ ...p, wht_rate: r, wht_amount: amt }));
                      }}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, textAlign: "right", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, marginBottom: 2 }}>หัก ณ ที่จ่าย</label>
                    <input type="number" step="0.01" value={paymentForm.wht_amount}
                      onChange={e => setPaymentForm(p => ({ ...p, wht_amount: Number(e.target.value) || 0 }))}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, textAlign: "right", fontWeight: 700, color: "#dc2626", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ marginTop: 8, padding: "6px 10px", background: "#fff", borderRadius: 6, fontSize: 13 }}>
                  <span>ยอดวางบิล: <strong>{selSum.toLocaleString()}</strong></span>
                  <span style={{ marginLeft: 14, color: "#dc2626" }}>− หัก WHT: <strong>{Number(paymentForm.wht_amount || 0).toLocaleString()}</strong></span>
                  <span style={{ marginLeft: 14, color: "#059669", fontWeight: 700 }}>= ยอดโอนจริง: {(selSum - Number(paymentForm.wht_amount || 0)).toLocaleString()}</span>
                </div>
              </div>

              {/* Preview docs */}
              <div style={{ marginTop: 12, maxHeight: 200, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead style={{ background: "#f3f4f6", position: "sticky", top: 0 }}>
                    <tr>
                      <th style={{ padding: "6px 10px", textAlign: "left" }}>เลขใบวางบิล</th>
                      <th style={{ padding: "6px 10px", textAlign: "left" }}>วันที่</th>
                      <th style={{ padding: "6px 10px", textAlign: "right" }}>ยอด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDocNos.map(no => {
                      const rows = selRows.filter(r => r.billing_doc_no === no);
                      const total = rows.reduce((s, r) => s + Number(r.bill_amount || 0), 0);
                      const date = rows[0]?.billed_at;
                      return (
                        <tr key={no} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: 600 }}>{no}</td>
                          <td style={{ padding: "6px 10px" }}>{date ? new Date(date).toLocaleDateString("th-TH") : "-"}</td>
                          <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{total.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                <button onClick={() => setPaymentDialog(false)} disabled={savingPayment}
                  style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
                <button onClick={savePayment} disabled={savingPayment || !paymentForm.paid_to_vendor || !paymentForm.from_bank_account_id}
                  style={{ padding: "8px 20px", background: savingPayment || !paymentForm.paid_to_vendor || !paymentForm.from_bank_account_id ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: (savingPayment || !paymentForm.paid_to_vendor || !paymentForm.from_bank_account_id) ? "not-allowed" : "pointer", fontWeight: 700 }}>
                  {savingPayment ? "กำลังบันทึก..." : "💾 บันทึกจ่ายเงิน"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function buildPaymentSummaryHTML({ docNos, rows, vendor, payDate, method, whtRate = 0, whtAmount = 0, fromBank = null, toVendor = null }) {
  const safe = s => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const fmtN = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = new Date();
  const pad = n => String(n).padStart(2, "0");
  const dateStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear() + 543} ${pad(today.getHours())}:${pad(today.getMinutes())}:${pad(today.getSeconds())}`;

  // รวมยอดวางบิลทั้งหมด (ก่อนหักส่วนลด)
  const subtotal = rows.reduce((s, r) => s + Number(r.subtotal_amount || r.bill_amount || 0), 0);
  const totalDiscount = rows.reduce((s, r) => s + Number(r.discount_amount || 0), 0);
  const netTotal = rows.reduce((s, r) => s + Number(r.bill_amount || 0), 0);

  // รวมตาม (expense_name, group_by) — flatten bill_items จากทุก row
  const expenseMap = new Map();
  rows.forEach(r => {
    let items = [];
    try { items = Array.isArray(r.bill_items) ? r.bill_items : (typeof r.bill_items === "string" ? JSON.parse(r.bill_items) : []); } catch {}
    items.forEach(it => {
      const key = `${it.group_by || ''}||${it.expense_name || ''}`;
      const cur = expenseMap.get(key) || { expense_name: it.expense_name || '-', group_by: it.group_by || '-', count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(it.amount || 0);
      expenseMap.set(key, cur);
    });
  });
  // sort by group then expense_name
  const expenseRows = [...expenseMap.values()].sort((a, b) => {
    if (a.group_by !== b.group_by) return String(a.group_by).localeCompare(String(b.group_by));
    return String(a.expense_name).localeCompare(String(b.expense_name));
  });

  const groupLabel = g => g === "finance" ? "ไฟแนนท์" : g === "province" ? "จังหวัด" : g === "cc" ? "CC" : g === "brand" ? "ยี่ห้อ" : "-";
  const groupColor = g => g === "finance" ? "#7c3aed" : g === "province" ? "#0f766e" : g === "cc" ? "#dc2626" : "#1e3a8a";

  const expRows = expenseRows.map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td>${safe(r.expense_name)}</td>
    <td class="num">${r.count}</td>
    <td class="num">${fmtN(r.total)}</td>
  </tr>`).join("");

  const docList = docNos.map(no => {
    const docRows = rows.filter(r => r.billing_doc_no === no);
    const docSubtotal = docRows.reduce((s, r) => s + Number(r.subtotal_amount || r.bill_amount || 0), 0);
    const docDiscount = docRows.reduce((s, r) => s + Number(r.discount_amount || 0), 0);
    const docNet = docRows.reduce((s, r) => s + Number(r.bill_amount || 0), 0);
    const date = docRows[0]?.billed_at;
    const dt = date ? new Date(date) : null;
    const dateFmt = dt ? `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear() + 543}` : "-";
    return `<tr>
      <td class="mono">${safe(no)}</td>
      <td>${dateFmt}</td>
      <td class="num">${docRows.length}</td>
      <td class="num">${fmtN(docSubtotal)}</td>
      <td class="num">${fmtN(docDiscount)}</td>
      <td class="num">${fmtN(docNet)}</td>
    </tr>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>สรุปการจ่ายเงิน</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
body { font-family: 'Tahoma','Arial',sans-serif; font-size: 11pt; }
h1 { text-align: center; margin: 0 0 4px; font-size: 16pt; color: #072d6b; }
.head { text-align: center; margin-bottom: 14px; font-size: 10pt; color: #444; }
.info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 12px; padding: 10px; background: #f0f4f9; border-radius: 6px; font-size: 10pt; }
.info strong { color: #072d6b; }
h2 { color: #072d6b; font-size: 12pt; margin: 12px 0 6px; padding-bottom: 4px; border-bottom: 2px solid #072d6b; }
table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
th, td { border: 1px solid #555; padding: 5px 8px; font-size: 10pt; text-align: left; }
th { background: #f0f4f9; }
.num { text-align: right; font-family: monospace; }
.mono { font-family: monospace; }
.total { font-weight: 700; background: #fef9c3; font-size: 11pt; }
.subtotal { background: #f3f4f6; font-weight: 600; }
.discount { background: #fee2e2; color: #991b1b; }
.net { background: #d1fae5; color: #065f46; font-weight: 700; font-size: 12pt; }
.sign-box { display: inline-block; width: 45%; margin-top: 30px; padding: 0 10px; vertical-align: top; }
.sign-line { margin-bottom: 6px; }
</style></head><body>
<h1>สรุปการจ่ายเงิน</h1>
<div class="head">วันที่พิมพ์: ${dateStr}</div>

<div class="info">
  <div><strong>จ่ายให้ (Vendor):</strong> ${safe(vendor)}</div>
  <div><strong>วันที่จ่าย:</strong> ${safe(payDate)}</div>
  <div><strong>วิธีจ่าย:</strong> ${safe(method)}</div>
  <div><strong>จำนวนใบวางบิล:</strong> ${docNos.length} ใบ · ${rows.length} รายการ</div>
</div>

<div class="info" style="grid-template-columns:1fr 1fr;background:#dbeafe">
  <div>
    <div style="font-size:9pt;color:#1e40af;font-weight:700;margin-bottom:3px">โอนจาก (บัญชีบริษัท)</div>
    ${fromBank ? `
      <div><strong>${safe(fromBank.bank_name)}</strong>${fromBank.branch ? ` · ${safe(fromBank.branch)}` : ''}</div>
      <div class="mono" style="color:#0369a1">${safe(fromBank.account_no)}</div>
      <div style="font-size:9pt">${safe(fromBank.account_name)}</div>
    ` : '<div style="color:#999">-</div>'}
  </div>
  <div>
    <div style="font-size:9pt;color:#1e40af;font-weight:700;margin-bottom:3px">โอนเข้า (บัญชี Vendor)</div>
    ${toVendor && (toVendor.bank_name || toVendor.bank_account_no) ? `
      <div><strong>${safe(toVendor.bank_name || '-')}</strong>${toVendor.bank_branch ? ` · ${safe(toVendor.bank_branch)}` : ''}</div>
      <div class="mono" style="color:#0369a1">${safe(toVendor.bank_account_no || '-')}</div>
      <div style="font-size:9pt">${safe(toVendor.bank_account_name || '-')}</div>
    ` : '<div style="color:#999">-</div>'}
  </div>
</div>

<h2>📑 รายการใบวางบิล</h2>
<table>
  <thead><tr>
    <th>เลขที่ใบวางบิล</th><th>วันที่</th><th>จำนวน</th><th>ยอด</th><th>ส่วนลด</th><th>สุทธิ</th>
  </tr></thead>
  <tbody>
    ${docList}
    <tr class="total"><td colspan="3" style="text-align:right">รวม ${docNos.length} ใบ</td>
      <td class="num">${fmtN(subtotal)}</td>
      <td class="num">${fmtN(totalDiscount)}</td>
      <td class="num">${fmtN(netTotal)}</td>
    </tr>
  </tbody>
</table>

<h2>💰 สรุปแยกตามประเภทค่าใช้จ่าย</h2>
<table>
  <thead><tr>
    <th>#</th><th>รายการค่าใช้จ่าย</th><th>จำนวน</th><th>ยอดรวม</th>
  </tr></thead>
  <tbody>
    ${expRows}
    <tr class="subtotal"><td colspan="3" style="text-align:right">รวมก่อนส่วนลด</td><td class="num">${fmtN(subtotal)}</td></tr>
    ${totalDiscount > 0 ? `<tr class="discount"><td colspan="3" style="text-align:right">หักส่วนลด</td><td class="num">−${fmtN(totalDiscount)}</td></tr>` : ''}
    <tr class="subtotal"><td colspan="3" style="text-align:right">ยอดวางบิลสุทธิ</td><td class="num">${fmtN(netTotal)}</td></tr>
    ${whtAmount > 0 ? `<tr class="discount"><td colspan="3" style="text-align:right">หัก ณ ที่จ่าย ${whtRate ? `(${whtRate}%)` : ''}</td><td class="num">−${fmtN(whtAmount)}</td></tr>` : ''}
    <tr class="net"><td colspan="3" style="text-align:right">ยอดโอนจริง</td><td class="num">${fmtN(netTotal - whtAmount)}</td></tr>
  </tbody>
</table>

<div style="margin-top:25px;">
  <div class="sign-box"><div style="height:35px"></div><div class="sign-line">ลงชื่อ ........................................................<br/>ผู้จ่ายเงิน</div></div>
  <div class="sign-box"><div style="height:35px"></div><div class="sign-line">ลงชื่อ ........................................................<br/>ผู้รับเงิน (Vendor)</div></div>
</div>
</body></html>`;
}

function DetailSection({ title, items }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 style={{ margin: "0 0 8px", color: "#374151", fontSize: 14 }}>{title}</h4>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        {items.map(([label, val, type], i) => (
          <div key={i} style={{ display: "flex", gap: 8, fontSize: 13 }}>
            <span style={{ color: "#6b7280", minWidth: 90 }}>{label}:</span>
            <span style={{ color: "#111", fontWeight: type === "bold" ? 700 : 400, fontFamily: type === "mono" ? "monospace" : "Tahoma", fontSize: type === "mono" ? 12 : 13 }}>
              {val || <span style={{ color: "#d1d5db" }}>—</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildBillingHTML({ rows, brand, category, total }) {
  const today = new Date();
  const dstr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear() + 543}`;
  const safe = s => s === null || s === undefined ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tr = rows.map((r, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${safe(r.customer_name)}</td>
      <td>${safe(r.invoice_no)}</td>
      <td class="mono">${safe(r.engine_no)}</td>
      <td class="c">${safe(r.plate_category)} ${safe(r.plate_number)}</td>
      <td class="r b">${Number(r.bill_amount || 0).toLocaleString()}</td>
    </tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>ใบวางบิล ${safe(brand)} - ${safe(category)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: "Sarabun","Tahoma",sans-serif; font-size: 13px; color: #111; margin: 0; }
  .doc { max-width: 297mm; margin: 0 auto; }
  .header { border-bottom: 3px double #1e3a8a; padding-bottom: 8px; margin-bottom: 14px; text-align: center; }
  .header h1 { margin: 0; color: #1e3a8a; font-size: 20px; }
  .header .sub { font-size: 13px; color: #6b7280; margin-top: 3px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 12px; padding: 10px 14px; background: #f8fafc; border-left: 3px solid #1e3a8a; border-radius: 4px; }
  .meta div { font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { background: #1e3a8a; color: #fff; padding: 8px 6px; text-align: center; }
  tbody td { border: 1px solid #cbd5e1; padding: 6px 8px; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tfoot td { border-top: 2px solid #1e3a8a; padding: 10px 8px; font-weight: 700; font-size: 14px; }
  .c { text-align: center; }
  .r { text-align: right; }
  .b { font-weight: 700; }
  .mono { font-family: "Consolas",monospace; font-size: 11px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
  .sign-box { text-align: center; font-size: 13px; }
  .sign-line { border-top: 1px dotted #111; padding-top: 6px; }
</style></head><body>
<div class="doc">
  <div class="header">
    <h1>ใบวางบิลค่าจดทะเบียน — ${safe(brand)}</h1>
    <div class="sub">หมวด: ${safe(category)}</div>
  </div>
  <div class="meta">
    <div><strong>วันที่:</strong> ${dstr}</div>
    <div><strong>จำนวน:</strong> ${rows.length} รายการ</div>
    <div><strong>ยอดรวม:</strong> ${total.toLocaleString()} บาท</div>
  </div>
  <table>
    <thead><tr>
      <th style="width:36px">#</th>
      <th>ชื่อลูกค้า</th>
      <th>เลขที่ใบขาย</th>
      <th>เลขเครื่อง</th>
      <th>เลขทะเบียน</th>
      <th style="width:100px">ยอดเงิน (บาท)</th>
    </tr></thead>
    <tbody>${tr}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right">รวมทั้งสิ้น</td>
        <td style="text-align:right">${total.toLocaleString()} บาท</td>
      </tr>
    </tfoot>
  </table>
  <div class="sign">
    <div class="sign-box"><div class="sign-line">ลงชื่อ ........................................................</div><div>ผู้วางบิล</div></div>
    <div class="sign-box"><div class="sign-line">ลงชื่อ ........................................................</div><div>ผู้รับวางบิล</div></div>
  </div>
</div>
</body></html>`;
}
