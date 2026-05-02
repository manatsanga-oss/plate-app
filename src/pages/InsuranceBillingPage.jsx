import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

export default function InsuranceBillingPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState("");
  // viewTab: 'pending' = รอวางบิล, 'billed' = บันทึกวางบิลแล้ว (ยังไม่จ่าย), 'paid' = จ่ายแล้ว
  const [viewTab, setViewTab] = useState("pending");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [detailRow, setDetailRow] = useState(null);
  const [claimDialog, setClaimDialog] = useState(null); // { insurance_id, receipt_no, ... }
  // Derive previous flags for backward compat in the render code below
  const showBilled = viewTab !== "pending";
  const viewMode = viewTab === "pending" ? "detail" : "summary";

  // Bill-level selection (สำหรับ tab "billed" → บันทึกจ่าย)
  const [selectedBills, setSelectedBills] = useState({}); // { billing_doc_no: true }
  // Batch-level selection (สำหรับ tab "pending" → เลือก batch ทั้งใบเพื่อวางบิล)
  const [selectedBatches, setSelectedBatches] = useState({}); // { record_batch_no: true }
  const [openBatchDetail, setOpenBatchDetail] = useState(null); // batch group ที่กำลังดูรายละเอียด
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paid_date: "", payment_method: "โอน", payment_note: "",
    paid_to_vendor: "", wht_rate: 0, wht_amount: 0, wht_base: 0,
    from_bank_account_id: "",
  });
  const [vendors, setVendors] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [savingPayment, setSavingPayment] = useState(false);

  async function post(body) {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function fetchData() {
    setLoading(true);
    setSelected({});
    try {
      const data = await post({
        action: "get_insurance_billing_data",
        only_unbilled: false,  // ดึงทั้งหมด — แล้ว filter ใน frontend
        date_from: dateFrom || null,
        date_to: dateTo || null,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); setSelected({}); setSelectedBills({}); setSelectedBatches({}); /* eslint-disable-next-line */ }, [viewTab]);
  useEffect(() => { fetchVendors(); fetchBankAccounts(); /* eslint-disable-next-line */ }, []);

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

  function calcCommissionBase() {
    // base = ค่าคอม (WHT คิดจากค่าคอมประกัน) จากใบวางบิลที่เลือก
    return rows
      .filter(r => r.billing_doc_no && selectedBills[r.billing_doc_no])
      .reduce((s, r) => s + Number(r.commission || 0), 0);
  }

  function onVendorChange(vendorName) {
    const v = vendors.find(x => x.vendor_name === vendorName);
    const rate = v ? Number(v.wht_rate || 0) : 0;
    const base = calcCommissionBase();
    const amount = Math.round((base * rate / 100) * 100) / 100;
    setPaymentForm(p => ({ ...p, paid_to_vendor: vendorName, wht_rate: rate, wht_base: base, wht_amount: amount }));
  }

  function openPaymentDialog() {
    const docNos = Object.keys(selectedBills).filter(k => selectedBills[k]);
    if (docNos.length === 0) { setMessage("❌ เลือกใบวางบิลก่อน"); return; }
    if (vendors.length === 0) fetchVendors();
    if (bankAccounts.length === 0) fetchBankAccounts();
    const today = new Date().toISOString().slice(0, 10);
    setPaymentForm({
      paid_date: today, payment_method: "โอน", payment_note: "",
      paid_to_vendor: "", wht_rate: 0, wht_amount: 0,
      wht_base: calcCommissionBase(), from_bank_account_id: "",
    });
    setPaymentDialog(true);
  }

  async function savePayment() {
    const docNos = Object.keys(selectedBills).filter(k => selectedBills[k]);
    if (docNos.length === 0) return;
    if (!paymentForm.paid_to_vendor) { setMessage("❌ กรุณาเลือก Vendor"); return; }
    if (!paymentForm.from_bank_account_id) { setMessage("❌ กรุณาเลือกบัญชีโอนจาก"); return; }
    setSavingPayment(true);
    try {
      const res = await post({
        action: "save_insurance_payment",
        billing_doc_nos: docNos,
        paid_date: paymentForm.paid_date,
        payment_method: paymentForm.payment_method,
        payment_note: paymentForm.payment_note,
        paid_to_vendor: paymentForm.paid_to_vendor,
        wht_rate: Number(paymentForm.wht_rate) || 0,
        wht_amount: Number(paymentForm.wht_amount) || 0,
        from_bank_account_id: Number(paymentForm.from_bank_account_id) || null,
        paid_by: currentUser?.username || currentUser?.name || "system",
      });
      const payNo = res?.paid_doc_no || res?.[0]?.paid_doc_no || "";
      setMessage(`✅ บันทึกจ่ายเงิน ${payNo} สำเร็จ ${docNos.length} ใบ`);
      setPaymentDialog(false);
      setSelectedBills({});
      fetchData();
    } catch {
      setMessage("❌ บันทึกจ่ายไม่สำเร็จ");
    }
    setSavingPayment(false);
  }

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    // tab "pending" → เฉพาะที่ยังไม่วางบิล
    if (viewTab === "pending" && r.billing_doc_no) return false;
    if (!kw) return true;
    const hay = [r.policy_no, r.insured_name, r.chassis_no, r.plate_number, r.billing_doc_no]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  // Group by record_batch_no (INSREC-...) — แสดงทุก batch
  const groupedByBatch = React.useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = r.record_batch_no || `_no_batch_${r.insurance_id}`;
      if (!map.has(key)) {
        map.set(key, {
          batch_no: r.record_batch_no,
          first_created: r.created_at,
          created_by: r.created_by,
          count: 0,
          unbilled_count: 0,
          billed_count: 0,
          premium: 0,
          total_premium: 0,
          commission: 0,
          premium_remit: 0,
          rows: [],
        });
      }
      const g = map.get(key);
      g.count += 1;
      if (r.billing_doc_no) g.billed_count += 1;
      else g.unbilled_count += 1;
      g.premium += Number(r.premium || 0);
      g.total_premium += Number(r.total_premium || 0);
      g.commission += Number(r.commission || 0);
      g.premium_remit += Number(r.premium_remit || 0);
      g.rows.push(r);
      if (!g.first_created || (r.created_at && r.created_at > g.first_created)) g.first_created = r.created_at;
    });
    // sort by batch_no DESC (ใหม่อยู่บน)
    return Array.from(map.values()).sort((a, b) => (b.batch_no || "").localeCompare(a.batch_no || ""));
  }, [rows]);

  // Group by billing_doc_no for summary view
  const groupedByBill = React.useMemo(() => {
    const map = new Map();
    filtered.forEach(r => {
      if (!r.billing_doc_no) return;
      // viewTab "billed" → unpaid only / "paid" → paid only
      if (viewTab === "billed" && r.paid_at) return;
      if (viewTab === "paid" && !r.paid_at) return;
      const key = r.billing_doc_no;
      if (!map.has(key)) {
        map.set(key, {
          billing_doc_no: r.billing_doc_no,
          billed_at: r.billed_at,
          billed_by: r.billed_by,
          paid_at: r.paid_at,
          paid_doc_no: r.paid_doc_no,
          paid_to_vendor: r.paid_to_vendor,
          count: 0,
          premium: 0,
          total_premium: 0,
          commission: 0,
          premium_remit: 0,
          rows: [],
        });
      }
      const g = map.get(key);
      g.count += 1;
      g.premium += Number(r.premium || 0);
      g.total_premium += Number(r.total_premium || 0);
      g.commission += Number(r.commission || 0);
      g.premium_remit += Number(r.premium_remit || 0);
      g.rows.push(r);
    });
    return Array.from(map.values()).sort((a, b) => {
      // เรียงตาม billing_doc_no DESC (ใหม่อยู่บน)
      return (b.billing_doc_no || "").localeCompare(a.billing_doc_no || "");
    });
  }, [filtered, viewTab]);

  const selectedRows = filtered.filter(r => selected[r.insurance_id]);
  const selCount = selectedRows.length;
  const selPremium = selectedRows.reduce((s, r) => s + Number(r.premium || 0), 0);
  const selTotalPremium = selectedRows.reduce((s, r) => s + Number(r.total_premium || 0), 0);
  const selCommission = selectedRows.reduce((s, r) => s + Number(r.commission || 0), 0);
  const selRemit = selectedRows.reduce((s, r) => s + Number(r.premium_remit || 0), 0);

  function toggleOne(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (filtered.every(r => selected[r.insurance_id])) {
      const next = { ...selected };
      filtered.forEach(r => delete next[r.insurance_id]);
      setSelected(next);
    } else {
      const next = { ...selected };
      filtered.forEach(r => { next[r.insurance_id] = true; });
      setSelected(next);
    }
  }

  // คลิก "บันทึกการจ่ายเงิน" จาก batch view: สร้าง INSB billing → เปิด Payment Dialog
  async function billAndPayFromBatches() {
    const selBatchNos = Object.keys(selectedBatches).filter(k => selectedBatches[k]);
    if (selBatchNos.length === 0) { setMessage("เลือก batch ก่อน"); return; }
    const ids = [];
    let totalRemit = 0;
    let totalPremium = 0;
    let totalCommission = 0;
    groupedByBatch
      .filter(g => selBatchNos.includes(g.batch_no))
      .forEach(g => {
        g.rows.forEach(r => {
          if (!r.billing_doc_no) {
            ids.push(r.insurance_id);
            totalPremium += Number(r.total_premium || 0);
            totalRemit += Number(r.premium_remit || 0);
            totalCommission += Number(r.commission || 0);
          }
        });
      });
    if (ids.length === 0) { setMessage("ใน batch ที่เลือกไม่มีรายการที่ยังไม่ได้วางบิล"); return; }
    const now = new Date();
    const docNo = `INSB-${(now.getFullYear() + 543).toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    setSaving(true);
    setMessage("");
    try {
      await post({
        action: "save_insurance_billing",
        insurance_ids: ids,
        billing_doc_no: docNo,
        billed_by: currentUser?.username || currentUser?.name || "system",
      });
      // pre-select ใบที่เพิ่งสร้าง + เตรียม form
      setSelectedBills({ [docNo]: true });
      setSelectedBatches({});
      const today = new Date().toISOString().slice(0, 10);
      setPaymentForm({
        paid_date: today, payment_method: "โอน", payment_note: "",
        paid_to_vendor: "", wht_rate: 0, wht_amount: 0,
        wht_base: totalCommission, from_bank_account_id: "",
      });
      await fetchData();
      // เปิด Payment Dialog ทันที (ไม่ confirm)
      setPaymentDialog(true);
    } catch {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  }

  async function saveBilling() {
    if (selCount === 0) { setMessage("เลือกรายการก่อน"); return; }
    const now = new Date();
    const docNo = `INSB-${(now.getFullYear() + 543).toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    if (!window.confirm(`บันทึกใบวางบิลพรบ. ${selCount} รายการ\nเบี้ยรวม: ${selTotalPremium.toLocaleString()} บาท\nค่าคอม: ${selCommission.toLocaleString()} บาท\nเลขที่ใบ: ${docNo}`)) return;
    setSaving(true);
    setMessage("");
    try {
      await post({
        action: "save_insurance_billing",
        insurance_ids: selectedRows.map(r => r.insurance_id),
        billing_doc_no: docNo,
        billed_by: currentUser?.username || currentUser?.name || "system",
      });
      setMessage(`✅ บันทึกใบวางบิล ${docNo} สำเร็จ ${selCount} รายการ`);
      fetchData();
    } catch {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  }

  async function cancelBilling(billingDocNo) {
    if (!billingDocNo) return;
    if (!window.confirm(`ยกเลิกใบวางบิล ${billingDocNo}?\nรายการในใบนี้จะกลับเป็น "ยังไม่วางบิล"`)) return;
    try {
      await post({ action: "cancel_insurance_billing", billing_doc_no: billingDocNo });
      setMessage(`✅ ยกเลิกใบวางบิล ${billingDocNo} แล้ว`);
      fetchData();
    } catch {
      setMessage("❌ ยกเลิกไม่สำเร็จ");
    }
  }

  function printBilling() {
    if (selCount === 0) { setMessage("เลือกรายการก่อนพิมพ์"); return; }
    const html = buildBillingHTML({ rows: selectedRows, totalPremium: selTotalPremium, commission: selCommission, remit: selRemit });
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { setMessage("popup blocked"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  function fmtNum(v) {
    const n = Number(v || 0);
    return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🛡️ วางบิล งานพรบ.</h2>
      </div>

      {/* Main tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["pending", "📋 รอวางบิล"],
          ["billed", "📝 บันทึกวางบิล พรบ."],
          ["paid", "📜 ประวัติการจ่ายเงิน"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => setViewTab(v)}
            style={{ padding: "10px 22px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: viewTab === v ? "#072d6b" : "#6b7280",
              borderBottom: viewTab === v ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>วันที่ทำสัญญา:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />

        <input type="text" placeholder="🔍 ค้นหา (กรมธรรม์, ผู้เอาประกัน, เลขถัง, ใบวางบิล)"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 260, padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />

        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>
      </div>

      {/* Summary + Action — แสดงเฉพาะ tab "รอวางบิล" */}
      {viewTab === "pending" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 13 }}>
            <strong>เลือก {selCount} รายการ</strong> · เบี้ย {fmtNum(selPremium)} · เบี้ยรวม <span style={{ color: "#dc2626", fontWeight: 700 }}>{fmtNum(selTotalPremium)}</span> · ค่าคอม {fmtNum(selCommission)} · เบี้ยนำส่ง <span style={{ color: "#0369a1", fontWeight: 700 }}>{fmtNum(selRemit)}</span>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={printBilling} disabled={selCount === 0}
            style={{ padding: "8px 18px", background: selCount === 0 ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 8, cursor: selCount === 0 ? "not-allowed" : "pointer", fontWeight: 600 }}>
            🖨️ พิมพ์ใบวางบิล
          </button>
          <button onClick={saveBilling} disabled={selCount === 0 || saving}
            style={{ padding: "8px 18px", background: selCount === 0 ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: (selCount === 0 || saving) ? "not-allowed" : "pointer", fontWeight: 600 }}>
            💾 {saving ? "กำลังบันทึก..." : "บันทึกวางบิล"}
          </button>
        </div>
      )}

      {/* Summary box สำหรับ tab billed (group by INSREC) */}
      {viewTab === "billed" && (() => {
        const selBatchNos = Object.keys(selectedBatches).filter(k => selectedBatches[k]);
        const selBatches = groupedByBatch.filter(g => selectedBatches[g.batch_no]);
        const selUnbilledCount = selBatches.reduce((s, g) => s + g.unbilled_count, 0);
        return (
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}>
            <span>📦 Batch: <strong>{groupedByBatch.length}</strong></span>
            <span>📋 รายการรวม: <strong>{groupedByBatch.reduce((s, g) => s + g.count, 0)}</strong></span>
            <span>💰 เบี้ยรวม: <strong style={{ color: "#dc2626" }}>{fmtNum(groupedByBatch.reduce((s, g) => s + g.total_premium, 0))}</strong></span>
            {selBatchNos.length > 0 && (
              <>
                <span style={{ padding: "4px 10px", background: "#fef9c3", borderRadius: 6, fontWeight: 600 }}>
                  ✓ เลือก {selBatchNos.length} batch · {selUnbilledCount} รายการรอวางบิล
                </span>
                <button onClick={billAndPayFromBatches} disabled={saving || selUnbilledCount === 0}
                  style={{ marginLeft: "auto", padding: "8px 18px", background: saving || selUnbilledCount === 0 ? "#9ca3af" : "#15803d", color: "#fff", border: "none", borderRadius: 8, cursor: saving || selUnbilledCount === 0 ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700 }}>
                  💰 {saving ? "กำลังบันทึก..." : `บันทึกการจ่ายเงิน (${selUnbilledCount})`}
                </button>
              </>
            )}
          </div>
        );
      })()}

      {/* Summary box สำหรับ tab paid (group by INSB billing_doc_no) */}
      {viewTab === "paid" && (() => {
        const selDocNos = Object.keys(selectedBills).filter(k => selectedBills[k]);
        const selSum = groupedByBill.filter(g => selectedBills[g.billing_doc_no]).reduce((s, g) => s + g.premium_remit, 0);
        return (
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}>
            <span>📑 ใบวางบิล: <strong>{groupedByBill.length}</strong></span>
            <span>📋 รายการ: <strong>{groupedByBill.reduce((s, g) => s + g.count, 0)}</strong></span>
            <span>💰 เบี้ยรวม: <strong style={{ color: "#dc2626" }}>{fmtNum(groupedByBill.reduce((s, g) => s + g.total_premium, 0))}</strong></span>
            <span>📤 เบี้ยนำส่ง: <strong style={{ color: "#0369a1" }}>{fmtNum(groupedByBill.reduce((s, g) => s + g.premium_remit, 0))}</strong></span>
          </div>
        );
      })()}

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : viewTab === "billed" && groupedByBatch.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีรายการ พรบ. ที่บันทึก</div>
        ) : viewTab === "paid" && groupedByBill.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีประวัติการจ่ายเงิน</div>
        ) : viewTab === "pending" && filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ พรบ. รอวางบิล</div>
        ) : viewTab === "billed" ? (
          // === Tab "บันทึกวางบิล พรบ." — Group by INSREC batch ===
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: 36 }}>
                  <input type="checkbox"
                    checked={groupedByBatch.length > 0 && groupedByBatch.filter(g => g.unbilled_count > 0).every(g => selectedBatches[g.batch_no])}
                    onChange={e => {
                      const checked = e.target.checked;
                      const next = { ...selectedBatches };
                      groupedByBatch.forEach(g => { if (g.batch_no && g.unbilled_count > 0) next[g.batch_no] = checked; });
                      setSelectedBatches(next);
                    }} />
                </th>
                <th style={th}>เลขที่ใบบันทึก</th>
                <th style={{ ...th, textAlign: "center" }}>ประเภท</th>
                <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
                <th style={{ ...th, textAlign: "right" }}>เบี้ยรวม</th>
                <th style={th}>วันที่บันทึก</th>
                <th style={th}>ผู้บันทึก</th>
                <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
                <th style={{ ...th, textAlign: "center" }}>ดู</th>
              </tr>
            </thead>
            <tbody>
              {groupedByBatch.map(g => {
                const fullyBilled = g.billed_count === g.count;
                const partial = g.billed_count > 0 && g.unbilled_count > 0;
                return (
                  <tr key={g.batch_no || "x"} style={{ borderTop: "1px solid #e5e7eb", background: selectedBatches[g.batch_no] ? "#eff6ff" : undefined }}>
                    <td style={{ ...td, textAlign: "center" }}>
                      <input type="checkbox"
                        disabled={g.unbilled_count === 0}
                        checked={!!selectedBatches[g.batch_no]}
                        onChange={e => setSelectedBatches(s => ({ ...s, [g.batch_no]: e.target.checked }))} />
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#0369a1" }}>{g.batch_no || "-"}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <span style={{ display: "inline-block", padding: "2px 10px", background: "#e0f2fe", color: "#0369a1", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>พรบ.</span>
                    </td>
                    <td style={{ ...tdNum, fontWeight: 700 }}>{g.count}</td>
                    <td style={{ ...tdNum, color: "#dc2626", fontWeight: 700 }}>{fmtNum(g.total_premium)}</td>
                    <td style={td}>{g.first_created ? new Date(g.first_created).toLocaleString("th-TH", { day: "numeric", month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                    <td style={td}>{g.created_by || "system"}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      {fullyBilled ? (
                        <span style={{ padding: "2px 8px", background: "#dcfce7", color: "#065f46", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>🔒 วางบิลแล้ว</span>
                      ) : partial ? (
                        <span style={{ padding: "2px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>⚠️ {g.billed_count}/{g.count}</span>
                      ) : (
                        <span style={{ padding: "2px 8px", background: "#e0e7ff", color: "#3730a3", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>⏳ รอวางบิล</span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <button onClick={() => setOpenBatchDetail(g)}
                        style={{ padding: "5px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        📁 ดู
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid #072d6b", background: "#f1f5f9", fontWeight: 700 }}>
                <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม {groupedByBatch.length} batch</td>
                <td style={tdNum}>{groupedByBatch.reduce((s, g) => s + g.count, 0)}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(groupedByBatch.reduce((s, g) => s + g.total_premium, 0))}</td>
                <td colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        ) : viewTab === "paid" ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>เลขที่ใบวางบิล</th>
                <th style={th}>วันที่วางบิล</th>
                <th style={th}>ผู้บันทึก</th>
                <th style={th}>จำนวน</th>
                <th style={th}>เบี้ย</th>
                <th style={th}>เบี้ยรวม</th>
                <th style={th}>ค่าคอม</th>
                <th style={th}>เบี้ยนำส่ง</th>
                <th style={th}>เลขที่จ่าย</th>
                <th style={th}>วันที่จ่าย</th>
                <th style={th}>จ่ายให้</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {groupedByBill.map(g => (
                <tr key={g.billing_doc_no || "x"} style={{ borderTop: "1px solid #e5e7eb", background: "#ecfdf5" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#072d6b" }}>{g.billing_doc_no || "-"}</td>
                  <td style={td}>{fmtDate(g.billed_at)}</td>
                  <td style={td}>{g.billed_by || "-"}</td>
                  <td style={{ ...tdNum, fontWeight: 600 }}>{g.count}</td>
                  <td style={tdNum}>{fmtNum(g.premium)}</td>
                  <td style={{ ...tdNum, color: "#dc2626", fontWeight: 700 }}>{fmtNum(g.total_premium)}</td>
                  <td style={tdNum}>{fmtNum(g.commission)}</td>
                  <td style={{ ...tdNum, color: "#0369a1", fontWeight: 700 }}>{fmtNum(g.premium_remit)}</td>
                  {viewTab === "paid" && <td style={{ ...td, fontFamily: "monospace", color: "#065f46", fontWeight: 600 }}>{g.paid_doc_no || "-"}</td>}
                  {viewTab === "paid" && <td style={td}>{fmtDate(g.paid_at)}</td>}
                  {viewTab === "paid" && <td style={td}>{g.paid_to_vendor || "-"}</td>}
                  <td style={td}>
                    {g.billing_doc_no && (
                      <button onClick={() => setDetailRow(g)} title="ดูรายการในใบนี้"
                        style={{ padding: "3px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>📋 ดู</button>
                    )}
                  </td>
                </tr>
              ))}
              {/* Grand total */}
              <tr style={{ borderTop: "2px solid #072d6b", background: "#f1f5f9", fontWeight: 700 }}>
                <td style={{ ...td, fontWeight: 700 }} colSpan={3}>รวม {groupedByBill.length} ใบ</td>
                <td style={tdNum}>{groupedByBill.reduce((s, g) => s + g.count, 0)}</td>
                <td style={tdNum}>{fmtNum(groupedByBill.reduce((s, g) => s + g.premium, 0))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(groupedByBill.reduce((s, g) => s + g.total_premium, 0))}</td>
                <td style={tdNum}>{fmtNum(groupedByBill.reduce((s, g) => s + g.commission, 0))}</td>
                <td style={{ ...tdNum, color: "#0369a1" }}>{fmtNum(groupedByBill.reduce((s, g) => s + g.premium_remit, 0))}</td>
                <td colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}><input type="checkbox" checked={filtered.length > 0 && filtered.every(r => selected[r.insurance_id])} onChange={toggleAll} /></th>
                <th style={th}>วันที่ทำสัญญา</th>
                <th style={th}>เลขกรมธรรม์</th>
                <th style={th}>ผู้เอาประกัน</th>
                <th style={th}>เลขตัวถัง</th>
                <th style={th}>เลขทะเบียน</th>
                <th style={th}>เลขที่ใบขาย</th>
                <th style={th}>เลขที่รับเรื่อง</th>
                <th style={th}>รายการเบิก</th>
                <th style={{ ...th, textAlign: "right" }}>รับชำระ</th>
                <th style={th}>ค่าเบี้ย</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                // Highlight เหลืองถ้ามี receipt_no แต่ยังไม่มีรายการเบิก (ต้องตรวจ/เลือกรายการ)
                let claimed = [];
                try { claimed = Array.isArray(r.claimed_items) ? r.claimed_items : (typeof r.claimed_items === "string" ? JSON.parse(r.claimed_items) : []); } catch {}
                const needAttention = r.receipt_no && claimed.length === 0;
                const rowBg = selected[r.insurance_id] ? "#fef9c3"
                  : needAttention ? "#fef3c7"
                  : "transparent";
                return (
                <tr key={r.insurance_id} style={{ borderTop: "1px solid #e5e7eb", background: rowBg }}>
                  <td style={td}><input type="checkbox" checked={!!selected[r.insurance_id]} onChange={() => toggleOne(r.insurance_id)} /></td>
                  <td style={td}>{fmtDate(r.contract_date)}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.policy_no || "-"}</td>
                  <td style={td}>{r.insured_name || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.chassis_no || "-"}</td>
                  <td style={td}>{r.plate_number || "-"}</td>
                  <td style={{ ...td, color: r.invoice_no ? "#065f46" : "#9ca3af", fontWeight: r.invoice_no ? 600 : 400 }}>{r.invoice_no || "-"}</td>
                  <td style={td}>
                    {r.receipt_no ? (
                      <button onClick={() => setClaimDialog(r)}
                        title="เลือกรายการเบิกจากใบรับเรื่อง"
                        style={{ padding: "2px 8px", background: "transparent", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
                        {r.receipt_no} ▼
                      </button>
                    ) : <span style={{ color: "#9ca3af" }}>-</span>}
                  </td>
                  <td style={{ ...td, fontSize: 11 }}>
                    {(() => {
                      let claimed = [];
                      try { claimed = Array.isArray(r.claimed_items) ? r.claimed_items : (typeof r.claimed_items === "string" ? JSON.parse(r.claimed_items) : []); } catch {}
                      if (!claimed.length) return <span style={{ color: "#9ca3af" }}>-</span>;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {r.auto_matched && (
                            <span style={{ display: "inline-block", padding: "1px 6px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 9, fontWeight: 600, alignSelf: "flex-start" }}>🔗 Auto</span>
                          )}
                          {claimed.map((c, i) => <span key={i} style={{ color: "#374151" }}>• {c.income_name || c.description}</span>)}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ ...tdNum, color: "#0369a1", fontWeight: 700 }}>{r.amount_received ? fmtNum(r.amount_received) : "-"}</td>
                  <td style={{ ...tdNum, color: "#dc2626", fontWeight: 600 }}>{fmtNum(r.total_premium)}</td>
                  <td style={td}>
                    <button onClick={() => setDetailRow(r)}
                      style={{ padding: "3px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                      ดู
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
              <tr>
                <td colSpan={9} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} รายการ</td>
                <td style={{ ...tdNum, color: "#0369a1" }}>{fmtNum(filtered.reduce((s, r) => s + Number(r.amount_received || 0), 0))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(filtered.reduce((s, r) => s + Number(r.total_premium || 0), 0))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Detail popup */}
      {detailRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDetailRow(null)}>
          {Array.isArray(detailRow.rows) ? (
            // === Group view (รายละเอียดใบวางบิล — แสดงทุก record) ===
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 1200, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0, color: "#072d6b" }}>📋 รายละเอียดใบวางบิล: <code>{detailRow.billing_doc_no}</code></h3>
                <span style={{ fontSize: 13, color: "#6b7280" }}>
                  {detailRow.count} รายการ · เบี้ยรวม {fmtNum(detailRow.total_premium)} · ค่าคอม {fmtNum(detailRow.commission)} · เบี้ยนำส่ง {fmtNum(detailRow.premium_remit)}
                </span>
                {detailRow.paid_at && (
                  <span style={{ padding: "3px 10px", background: "#dcfce7", color: "#065f46", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                    💰 จ่ายแล้ว · {detailRow.paid_doc_no || ""}{detailRow.paid_to_vendor ? ` · ${detailRow.paid_to_vendor}` : ""}
                  </span>
                )}
                <button onClick={() => setDetailRow(null)} style={{ marginLeft: "auto", padding: "6px 14px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>ปิด</button>
              </div>
              <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
                  <thead style={{ background: "#072d6b", color: "#fff", position: "sticky", top: 0 }}>
                    <tr>
                      <th style={th}>#</th>
                      <th style={th}>วันสัญญา</th>
                      <th style={th}>เลขกรมธรรม์</th>
                      <th style={th}>เลขตัวถัง</th>
                      <th style={th}>ผู้เอาประกัน</th>
                      <th style={{ ...th, textAlign: "right" }}>เบี้ยรวม</th>
                      <th style={{ ...th, textAlign: "right" }}>ค่าคอม</th>
                      <th style={{ ...th, textAlign: "right" }}>เบี้ยนำส่ง</th>
                      <th style={th}>ใบขาย / ลูกค้า</th>
                      <th style={th}>เลขที่รับเรื่อง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRow.rows.map((r, i) => (
                      <tr key={r.insurance_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.contract_date)}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.policy_no || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                        <td style={td}>{r.insured_name || "-"}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626", fontWeight: 600 }}>{fmtNum(r.total_premium)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmtNum(r.commission)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#0369a1", fontWeight: 600 }}>{fmtNum(r.premium_remit)}</td>
                        <td style={td}>
                          {r.invoice_no && <div style={{ color: "#065f46", fontWeight: 600 }}>{r.invoice_no}</div>}
                          {r.customer_name && <div style={{ fontSize: 11, color: "#6b7280" }}>{r.customer_name}</div>}
                          {!r.invoice_no && !r.customer_name && <span style={{ color: "#9ca3af" }}>-</span>}
                        </td>
                        <td style={{ ...td, color: r.receipt_no ? "#1e40af" : "#9ca3af", fontWeight: r.receipt_no ? 600 : 400 }}>{r.receipt_no || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot style={{ background: "#fef9c3", fontWeight: 700 }}>
                    <tr>
                      <td colSpan={5} style={{ ...td, textAlign: "right" }}>รวม {detailRow.count} รายการ</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{fmtNum(detailRow.total_premium)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmtNum(detailRow.commission)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#0369a1" }}>{fmtNum(detailRow.premium_remit)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            // === Single record view ===
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
              <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>📋 รายละเอียด พรบ.</h3>
              <table style={{ width: "100%", fontSize: 13 }}>
                <tbody>
                  {[
                    ["วันที่ทำสัญญา", fmtDate(detailRow.contract_date)],
                    ["เลขกรมธรรม์", detailRow.policy_no],
                    ["ผู้เอาประกัน", detailRow.insured_name],
                    ["เลขตัวถัง", detailRow.chassis_no],
                    ["เลขทะเบียน", detailRow.plate_number],
                    ["เริ่ม–สิ้นสุด", `${fmtDate(detailRow.coverage_start)} → ${fmtDate(detailRow.coverage_end)}`],
                    ["ชำระ", detailRow.paid],
                    ["เบี้ย", fmtNum(detailRow.premium)],
                    ["อากร", fmtNum(detailRow.stamp_duty)],
                    ["ภาษี", fmtNum(detailRow.tax)],
                    ["เบี้ยรวม", fmtNum(detailRow.total_premium)],
                    ["ค่าคอม", fmtNum(detailRow.commission)],
                    ["เบี้ยนำส่ง", fmtNum(detailRow.premium_remit)],
                    ["ใบวางบิล", detailRow.billing_doc_no || "-"],
                    ["วันที่วางบิล", detailRow.billed_at ? new Date(detailRow.billed_at).toLocaleString("th-TH") : "-"],
                  ].map(([k, v]) => (
                    <tr key={k}><td style={{ padding: "5px 8px", color: "#6b7280", width: 130 }}>{k}</td><td style={{ padding: "5px 8px", fontWeight: 600 }}>{v || "-"}</td></tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button onClick={() => setDetailRow(null)} style={{ padding: "8px 16px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>ปิด</button>
              </div>
            </div>
          )}
        </div>
      )}

      {claimDialog && (
        <ClaimItemsDialog
          insurance={claimDialog}
          onClose={() => setClaimDialog(null)}
          onSaved={() => { setClaimDialog(null); setMessage("✅ บันทึกรายการเบิกสำเร็จ"); fetchData(); }}
        />
      )}

      {/* Batch Detail Dialog */}
      {openBatchDetail && (() => {
        const g = openBatchDetail;
        // group rows by billing_doc_no within this batch
        const insbMap = new Map();
        g.rows.forEach(r => {
          const key = r.billing_doc_no || "(ยังไม่วางบิล)";
          if (!insbMap.has(key)) {
            insbMap.set(key, {
              billing_doc_no: r.billing_doc_no,
              billed_at: r.billed_at,
              paid_at: r.paid_at,
              paid_doc_no: r.paid_doc_no,
              paid_to_vendor: r.paid_to_vendor,
              count: 0,
              premium_remit: 0,
              total_premium: 0,
              commission: 0,
              rows: [],
            });
          }
          const ins = insbMap.get(key);
          ins.count += 1;
          ins.premium_remit += Number(r.premium_remit || 0);
          ins.total_premium += Number(r.total_premium || 0);
          ins.commission += Number(r.commission || 0);
          ins.rows.push(r);
        });
        const insbGroups = Array.from(insbMap.values());
        const selDocsInBatch = insbGroups.filter(b => b.billing_doc_no && !b.paid_at && selectedBills[b.billing_doc_no]);
        const selRemit = selDocsInBatch.reduce((s, b) => s + b.premium_remit, 0);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1050 }}
            onClick={() => setOpenBatchDetail(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 1100, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0, color: "#0369a1" }}>📁 รายละเอียด Batch: <code>{g.batch_no}</code></h3>
                <span style={{ fontSize: 13, color: "#6b7280" }}>
                  {g.count} รายการ · เบี้ยรวม {fmtNum(g.total_premium)} · เบี้ยนำส่ง {fmtNum(g.premium_remit)}
                </span>
                {selDocsInBatch.length > 0 && (
                  <button onClick={() => setPaymentDialog(true)}
                    style={{ marginLeft: "auto", padding: "8px 16px", background: "#15803d", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                    💰 บันทึกการจ่ายเงิน ({selDocsInBatch.length})
                  </button>
                )}
                <button onClick={() => setOpenBatchDetail(null)} style={{ padding: "6px 14px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>ปิด</button>
              </div>

              {/* INSB groups inside batch */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {insbGroups.map((b, i) => {
                  const isPaid = !!b.paid_at;
                  const hasInsb = !!b.billing_doc_no;
                  return (
                    <div key={b.billing_doc_no || `_no_insb_${i}`} style={{ background: isPaid ? "#ecfdf5" : "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, background: isPaid ? "linear-gradient(90deg,#065f46 0%,#10b981 100%)" : hasInsb ? "linear-gradient(90deg,#072d6b 0%,#0e4ba8 100%)" : "#9ca3af", color: "#fff" }}>
                        {hasInsb && !isPaid && (
                          <input type="checkbox"
                            checked={!!selectedBills[b.billing_doc_no]}
                            onChange={e => setSelectedBills(s => ({ ...s, [b.billing_doc_no]: e.target.checked }))}
                            style={{ width: 16, height: 16, cursor: "pointer" }} />
                        )}
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>
                          {b.billing_doc_no || "ยังไม่วางบิล"}
                        </span>
                        <span style={{ fontSize: 12 }}>{b.count} รายการ</span>
                        {isPaid && (
                          <span style={{ background: "#fff3", padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                            ✓ จ่ายแล้ว · {b.paid_doc_no || ""}{b.paid_to_vendor ? ` · ${b.paid_to_vendor}` : ""}
                          </span>
                        )}
                        <div style={{ flex: 1 }} />
                        <span style={{ fontWeight: 700 }}>เบี้ยรวม {fmtNum(b.total_premium)} · นำส่ง {fmtNum(b.premium_remit)}</span>
                      </div>
                      <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
                        <thead style={{ background: "#f3f4f6" }}>
                          <tr>
                            <th style={th}>#</th>
                            <th style={th}>วันสัญญา</th>
                            <th style={th}>เลขกรมธรรม์</th>
                            <th style={th}>เลขถัง</th>
                            <th style={th}>ผู้เอาประกัน</th>
                            <th style={{ ...th, textAlign: "right" }}>เบี้ยรวม</th>
                            <th style={{ ...th, textAlign: "right" }}>เบี้ยนำส่ง</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.rows.map((r, j) => (
                            <tr key={r.insurance_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                              <td style={{ ...td, textAlign: "center" }}>{j + 1}</td>
                              <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.contract_date)}</td>
                              <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.policy_no || "-"}</td>
                              <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                              <td style={td}>{r.insured_name || "-"}</td>
                              <td style={{ ...tdNum, color: "#dc2626", fontWeight: 600 }}>{fmtNum(r.total_premium)}</td>
                              <td style={{ ...tdNum, color: "#0369a1", fontWeight: 600 }}>{fmtNum(r.premium_remit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payment Dialog */}
      {paymentDialog && (() => {
        const selectedDocNos = Object.keys(selectedBills).filter(k => selectedBills[k]);
        const selGroups = groupedByBill.filter(g => selectedBills[g.billing_doc_no]);
        const selRemit = selGroups.reduce((s, g) => s + Number(g.premium_remit || 0), 0);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
            onClick={() => !savingPayment && setPaymentDialog(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 24, borderRadius: 12, width: 640, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
              <h3 style={{ margin: "0 0 16px", color: "#15803d", textAlign: "center", fontSize: 18 }}>📊 บันทึกจ่ายเงิน</h3>

              <div style={{ background: "#f8fafc", padding: 14, borderRadius: 10, marginBottom: 16, fontSize: 14, textAlign: "center" }}>
                <div>📑 ใบที่จ่าย: <strong>{selectedDocNos.length}</strong> ใบ</div>
                <div>📋 รายการรวม: <strong>{selGroups.reduce((s, g) => s + g.count, 0)}</strong> รายการ</div>
                <div>💰 ยอดรวม: <span style={{ color: "#dc2626", fontWeight: 700 }}>฿ {fmtNum(selRemit)}</span></div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={dlblC}>วันที่จ่าย *</label>
                  <input type="date" value={paymentForm.paid_date} onChange={e => setPaymentForm(p => ({ ...p, paid_date: e.target.value }))}
                    style={{ ...inpStyle, width: "100%" }} />
                </div>
                <div>
                  <label style={dlblC}>วิธีจ่าย</label>
                  <select value={paymentForm.payment_method} onChange={e => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))}
                    style={{ ...inpStyle, width: "100%" }}>
                    <option value="โอน">โอน</option>
                    <option value="เงินสด">เงินสด</option>
                    <option value="เช็ค">เช็ค</option>
                    <option value="หักบัญชี">หักบัญชี</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1 / span 2" }}>
                  <label style={dlblC}>Vendor (จ่ายให้) *</label>
                  <select value={paymentForm.paid_to_vendor} onChange={e => onVendorChange(e.target.value)}
                    style={{ ...inpStyle, width: "100%" }}>
                    <option value="">-- เลือก Vendor --</option>
                    {vendors.map(v => (
                      <option key={v.vendor_id} value={v.vendor_name}>{v.vendor_name}{v.wht_rate ? ` (${v.wht_rate}%)` : ""}</option>
                    ))}
                  </select>
                  {vendors.length === 0 && (
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2, textAlign: "center" }}>⚠️ ยังไม่มี Vendor — ไปเพิ่มที่ Master Data → Supplier</div>
                  )}
                </div>
                <div style={{ gridColumn: "1 / span 2" }}>
                  <label style={dlblC}>หมายเหตุ</label>
                  <textarea value={paymentForm.payment_note} onChange={e => setPaymentForm(p => ({ ...p, payment_note: e.target.value }))} rows={2}
                    style={{ ...inpStyle, width: "100%", resize: "vertical" }} />
                </div>
              </div>

              {/* Bank Accounts */}
              <div style={{ marginTop: 14, padding: 12, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af", marginBottom: 10, textAlign: "center" }}>🏦 บัญชีธนาคาร</div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ ...dlblC, color: "#1e40af" }}>โอนจาก (บัญชีบริษัท) *</label>
                  <select value={paymentForm.from_bank_account_id} onChange={e => setPaymentForm(p => ({ ...p, from_bank_account_id: e.target.value }))}
                    style={{ ...inpStyle, width: "100%" }}>
                    <option value="">-- เลือกบัญชีโอนจาก --</option>
                    {bankAccounts.map(b => (
                      <option key={b.account_id} value={b.account_id}>
                        {b.bank_name} · {b.account_no} · {b.account_name}
                      </option>
                    ))}
                  </select>
                </div>
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
                        <div style={{ color: "#dc2626", fontSize: 11 }}>⚠️ Vendor ยังไม่มีข้อมูลบัญชีธนาคาร</div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* WHT (คิดจากค่าคอม) */}
              <div style={{ marginTop: 14, padding: 12, background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 10, textAlign: "center" }}>🧾 หักณที่จ่าย</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
                  <div>
                    <label style={{ ...dlblC, fontSize: 12 }}>ยอดค่าบริการ (base)</label>
                    <input type="text" value={Number(paymentForm.wht_base || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })} readOnly
                      style={{ ...inpStyle, width: "100%", fontFamily: "monospace", textAlign: "right", background: "#fff" }} />
                  </div>
                  <div>
                    <label style={{ ...dlblC, fontSize: 12 }}>อัตรา %</label>
                    <input type="number" step="0.01" value={paymentForm.wht_rate}
                      onChange={e => {
                        const r = Number(e.target.value) || 0;
                        const amt = Math.round((paymentForm.wht_base * r / 100) * 100) / 100;
                        setPaymentForm(p => ({ ...p, wht_rate: r, wht_amount: amt }));
                      }}
                      style={{ ...inpStyle, width: "100%", fontFamily: "monospace", textAlign: "right" }} />
                  </div>
                  <div>
                    <label style={{ ...dlblC, fontSize: 12 }}>หัก ณ ที่จ่าย</label>
                    <input type="number" step="0.01" value={paymentForm.wht_amount}
                      onChange={e => setPaymentForm(p => ({ ...p, wht_amount: Number(e.target.value) || 0 }))}
                      style={{ ...inpStyle, width: "100%", fontFamily: "monospace", textAlign: "right", fontWeight: 700, color: "#dc2626" }} />
                  </div>
                </div>
                <div style={{ marginTop: 10, padding: "8px 12px", background: "#fff", borderRadius: 6, fontSize: 13, textAlign: "center" }}>
                  <span>ยอดวางบิล: <strong>{fmtNum(selRemit)}</strong></span>
                  <span style={{ marginLeft: 14, color: "#dc2626" }}>− หัก WHT: <strong>{fmtNum(paymentForm.wht_amount || 0)}</strong></span>
                  <span style={{ marginLeft: 14, color: "#059669", fontWeight: 700 }}>= ยอดโอนจริง: {fmtNum(selRemit - Number(paymentForm.wht_amount || 0))}</span>
                </div>
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

const dlbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const dlblC = { display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, textAlign: "center" };
const inpStyle = { padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };

function ClaimItemsDialog({ insurance, onClose, onSaved }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_receipt_lines", keyword: insurance.receipt_no, include_submitted: true, bypass_insurance_filter: true }),
        });
        const data = await res.json();
        if (cancelled) return;
        // กรองเฉพาะรายการ พรบ./ประกัน ของใบรับเรื่องนี้เท่านั้น
        const isInsurance = (l) => {
          const t = String(l.income_type || "").toLowerCase();
          const n = String(l.income_name || "").toLowerCase();
          return t.includes("ประกัน") || t.includes("พรบ") || t.includes("พ.ร.บ") ||
                 n.includes("ประกัน") || n.includes("พรบ") || n.includes("พ.ร.บ");
        };
        const lines = (Array.isArray(data) ? data : [])
          .filter(l => l.receipt_no === insurance.receipt_no)
          .filter(isInsurance);
        setItems(lines);

        // pre-select existing claimed
        let claimed = [];
        try { claimed = Array.isArray(insurance.claimed_items) ? insurance.claimed_items : (typeof insurance.claimed_items === "string" ? JSON.parse(insurance.claimed_items) : []); } catch {}
        const sel = {};
        claimed.forEach(c => { if (c.line_id) sel[c.line_id] = true; });
        setSelected(sel);
      } catch (e) { setError("โหลดรายการไม่สำเร็จ"); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [insurance.receipt_no]);

  const fmtNum = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const selectedItems = items.filter(it => selected[it.line_id]);
  const selTotal = selectedItems.reduce((s, x) => s + Number(x.net_price || 0), 0);

  function toggle(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (items.every(it => selected[it.line_id])) {
      setSelected({});
    } else {
      const next = {};
      items.forEach(it => { next[it.line_id] = true; });
      setSelected(next);
    }
  }

  async function handleSave() {
    setSaving(true); setError("");
    try {
      const claimed = selectedItems.map(it => ({
        line_id: it.line_id,
        receipt_no: it.receipt_no,
        income_type: it.income_type,
        income_name: it.income_name,
        description: it.description,
        net_price: Number(it.net_price || 0),
      }));
      const res = await fetch("https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_insurance_claim",
          insurance_id: insurance.insurance_id,
          claimed_items: claimed,
          amount_received: selTotal,  // ใช้ยอดรวมจากรายการที่เลือกอัตโนมัติ
        }),
      });
      if (!res.ok) throw new Error("save fail");
      onSaved();
    } catch (e) { setError("บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
      onClick={() => !saving && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 800, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 12px", color: "#0891b2" }}>📋 เลือกรายการเบิก: <code>{insurance.receipt_no}</code></h3>
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          กรมธรรม์: <code>{insurance.policy_no}</code> · ผู้เอาประกัน: {insurance.insured_name} · เบี้ย: <strong style={{ color: "#dc2626" }}>{fmtNum(insurance.total_premium)}</strong>
        </div>

        {error && <div style={{ padding: 8, background: "#fee2e2", color: "#991b1b", borderRadius: 6, marginBottom: 10 }}>{error}</div>}

        {loading ? <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div> : items.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่พบรายการสำหรับใบรับเรื่องนี้</div>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f3f4f6" }}>
                <tr>
                  <th style={{ width: 30, padding: "6px 8px" }}>
                    <input type="checkbox" checked={items.length > 0 && items.every(it => selected[it.line_id])} onChange={toggleAll} />
                  </th>
                  <th style={{ padding: "6px 10px", textAlign: "left" }}>ประเภทรายได้</th>
                  <th style={{ padding: "6px 10px", textAlign: "left" }}>ชื่อรายได้</th>
                  <th style={{ padding: "6px 10px", textAlign: "left" }}>รายละเอียด</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>ยอด</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.line_id} style={{ borderTop: "1px solid #e5e7eb", background: selected[it.line_id] ? "#fef9c3" : "transparent", cursor: "pointer" }} onClick={() => toggle(it.line_id)}>
                    <td style={{ padding: "6px 8px" }}><input type="checkbox" checked={!!selected[it.line_id]} onChange={() => toggle(it.line_id)} /></td>
                    <td style={{ padding: "6px 10px" }}>{it.income_type || "-"}</td>
                    <td style={{ padding: "6px 10px" }}>{it.income_name || "-"}</td>
                    <td style={{ padding: "6px 10px", fontSize: 11, color: "#6b7280" }}>{it.description || "-"}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmtNum(it.net_price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: "#fef3c7", fontWeight: 700 }}>
                <tr>
                  <td colSpan={4} style={{ padding: "8px 10px", textAlign: "right" }}>เลือก {selectedItems.length} รายการ · รวม</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#dc2626" }}>{fmtNum(selTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div style={{ marginTop: 14, padding: "10px 14px", background: "#dcfce7", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#065f46" }}>
          💰 จำนวนเงินที่รับชำระ: <span style={{ fontSize: 16, fontWeight: 700 }}>{fmtNum(selTotal)}</span> บาท
          <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 10, fontWeight: 400 }}>(คำนวณอัตโนมัติจากรายการที่เลือก)</span>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "8px 24px", background: saving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
            {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const tdNum = { padding: "8px", fontSize: 12, textAlign: "right", fontFamily: "monospace" };

function buildBillingHTML({ rows, totalPremium, commission, remit }) {
  const safe = s => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const fmtNum = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = v => { if (!v) return "-"; const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`; };
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear() + 543}`;
  const trs = rows.map((r, i) => `<tr><td>${i + 1}</td><td>${fmtDate(r.contract_date)}</td><td>${safe(r.policy_no)}</td><td>${safe(r.insured_name)}</td><td class="mono">${safe(r.chassis_no)}</td><td>${safe(r.plate_number)}</td><td class="num">${fmtNum(r.total_premium)}</td><td class="num">${fmtNum(r.commission)}</td><td class="num">${fmtNum(r.premium_remit)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>ใบวางบิลพรบ.</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
body { font-family: 'Tahoma','Arial',sans-serif; font-size: 11pt; }
h1 { text-align: center; margin: 0 0 4px; font-size: 16pt; }
.head { text-align: center; margin-bottom: 14px; font-size: 10pt; color: #444; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #333; padding: 4px 6px; font-size: 10pt; }
th { background: #f0f4f9; }
.num { text-align: right; font-family: monospace; }
.mono { font-family: monospace; }
.total { font-weight: 700; background: #fef9c3; }
.sign-box { display: inline-block; width: 45%; margin-top: 40px; padding: 0 10px; vertical-align: top; }
.sign-line { margin-bottom: 6px; }
</style></head><body>
<h1>ใบวางบิล พรบ. รถใหม่</h1>
<div class="head">วันที่: ${dateStr} · จำนวน ${rows.length} รายการ</div>
<table>
<thead><tr><th>#</th><th>วันที่ทำสัญญา</th><th>กรมธรรม์</th><th>ผู้เอาประกัน</th><th>เลขตัวถัง</th><th>ทะเบียน</th><th>เบี้ยรวม</th><th>ค่าคอม</th><th>เบี้ยนำส่ง</th></tr></thead>
<tbody>${trs}
<tr class="total"><td colspan="6" style="text-align:right">รวมทั้งสิ้น</td><td class="num">${fmtNum(totalPremium)}</td><td class="num">${fmtNum(commission)}</td><td class="num">${fmtNum(remit)}</td></tr>
</tbody></table>
<div style="margin-top: 30px;">
  <div class="sign-box"><div class="sign-line">ลงชื่อ ........................................................</div><div>ผู้วางบิล</div></div>
  <div class="sign-box"><div class="sign-line">ลงชื่อ ........................................................</div><div>ผู้รับวางบิล</div></div>
</div>
</body></html>`;
}
