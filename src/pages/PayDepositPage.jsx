import React, { useEffect, useState, useMemo } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/grouplease-api";

const BRANCHES = [
  { code: "", name: "ทุกสาขา" },
  { code: "SCY01", name: "SCY01 สำนักงานใหญ่" },
  { code: "SCY04", name: "SCY04 สิงห์ชัยตลาดสีขวา" },
  { code: "SCY05", name: "SCY05 ป.เปานครหลวง" },
  { code: "SCY06", name: "SCY06 ป.เปาวังน้อย" },
  { code: "SCY07", name: "SCY07 สิงห์ชัยตลาด" },
];

// ดึงเลขที่สัญญาอัตโนมัติจาก description (หาเลข 8-14 หลักในข้อความ)
function extractContract(desc) {
  if (!desc) return "";
  const m = desc.match(/\b(\d{8,14})\b/);
  return m ? m[1] : "";
}

function fmt(n) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PayDepositPage({ currentUser }) {
  const [tab, setTab] = useState("pending");

  // ---- Tab Pending ----
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const [dateFrom, setDateFrom] = useState(`${ym}-01`);
  const [dateTo, setDateTo] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  const [branchFilter, setBranchFilter] = useState("");
  const [selected, setSelected] = useState({}); // { item_id: { contract_no, paid_amount } }

  // ---- Transfer modal ----
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: "โอน",
    paid_to_vendor: "",
    note: "",
    slip_image: "",
    slip_mime: "",
    transaction_id: "",
    fee: 0,
    from_bank_account_id: "",
    wht_rate: 0,
    wht_amount: 0,
    wht_base: 0,
  });
  const [vendors, setVendors] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // โหลด vendors + bank accounts ตอนเปิด page
  useEffect(() => {
    fetchVendors();
    fetchBankAccounts();
  }, []);

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

  function onVendorChange(vendorName) {
    const v = vendors.find(x => x.vendor_name === vendorName);
    const rate = v ? Number(v.wht_rate || 0) : 0;
    const base = transferForm.wht_base || 0;
    const amount = rate > 0 ? Math.round((base * rate / 100) * 100) / 100 : 0;
    setTransferForm(p => ({ ...p, paid_to_vendor: vendorName, wht_rate: rate, wht_amount: amount }));
  }

  // ---- Tab History ----
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [historyFrom, setHistoryFrom] = useState(`${now.getFullYear()}-01-01`);
  const [historyTo, setHistoryTo] = useState(`${now.getFullYear()}-12-31`);
  const [detailPayment, setDetailPayment] = useState(null);
  const [editingPaymentId, setEditingPaymentId] = useState(null); // null = create new, else = edit existing

  // ---- Tab Report ----
  const [report, setReport] = useState([]);
  const [reportYear, setReportYear] = useState(String(now.getFullYear()));
  const [reportSearch, setReportSearch] = useState("");
  const [reportDateFrom, setReportDateFrom] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
  const [reportDateTo, setReportDateTo] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  const [reportPage, setReportPage] = useState(1);
  const REPORT_PAGE_SIZE = 15;

  useEffect(() => {
    if (tab === "pending") fetchPending();
    if (tab === "history") fetchPayments();
    if (tab === "report") fetchReport();
  }, [tab]);

  async function fetchPending() {
    setPendingLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_pending_grouplease",
          date_from: dateFrom, date_to: dateTo, branch_code: branchFilter, include_paid: "false",
        }),
      });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : (data?.rows || data?.data || []);
      setPendingItems(rows);
      // reset selection, pre-fill contract_no from description
      const s = {};
      rows.forEach(r => {
        s[r.item_id] = {
          contract_no: extractContract(r.description),
          paid_amount: Number(r.line_amount) || 0,
          checked: false,
        };
      });
      setSelected(s);
    } catch (e) {
      setPendingItems([]);
    }
    setPendingLoading(false);
  }

  async function fetchPayments() {
    setPaymentsLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_glp_payments", date_from: historyFrom, date_to: historyTo }),
      });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : (data?.rows || data?.data || []);
      setPayments(rows);
    } catch { setPayments([]); }
    setPaymentsLoading(false);
  }

  async function fetchReport() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_glp_payments", date_from: reportDateFrom, date_to: reportDateTo }),
      });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : (data?.rows || data?.data || []);
      // flatten payments → items with parent payment info
      const flat = [];
      rows.forEach(p => {
        (p.items || []).forEach(it => {
          flat.push({
            payment_id: p.id,
            payment_no: p.payment_no,
            payment_date: p.payment_date,
            transaction_id: p.transaction_id,
            contract_no: it.contract_no,
            customer_name: it.customer_name,
            branch_code: it.branch_code,
            received_date: it.received_date,
            received_amount: it.received_amount,
            paid_amount: it.paid_amount,
          });
        });
      });
      setReport(flat);
    } catch { setReport([]); }
  }

  const selectedList = useMemo(() =>
    pendingItems.filter(r => selected[r.item_id]?.checked),
    [pendingItems, selected]
  );
  const totalSelected = selectedList.reduce(
    (sum, r) => sum + (Number(selected[r.item_id]?.paid_amount) || 0), 0
  );

  function toggleAll(check) {
    const s = { ...selected };
    pendingItems.forEach(r => { s[r.item_id] = { ...s[r.item_id], checked: !!check }; });
    setSelected(s);
  }

  function updateSelected(itemId, field, value) {
    setSelected({ ...selected, [itemId]: { ...selected[itemId], [field]: value } });
  }

  async function handleSlipUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("ไฟล์ใหญ่เกิน 5MB"); return; }
    const b64 = await new Promise(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(",")[1]);
      r.readAsDataURL(file);
    });
    setTransferForm({ ...transferForm, slip_image: b64, slip_mime: file.type });
  }

  function openTransfer() {
    if (selectedList.length === 0) { alert("เลือกรายการก่อน"); return; }
    const missing = selectedList.filter(r => !(selected[r.item_id]?.contract_no || "").trim());
    if (missing.length > 0) { alert(`มี ${missing.length} รายการยังไม่ได้กรอกเลขที่สัญญา`); return; }
    if (vendors.length === 0) fetchVendors();
    if (bankAccounts.length === 0) fetchBankAccounts();
    setEditingPaymentId(null);
    setTransferForm({
      ...transferForm,
      payment_date: new Date().toISOString().slice(0, 10),
      wht_base: totalSelected,
      wht_rate: 0,
      wht_amount: 0,
      paid_to_vendor: "",
      from_bank_account_id: "",
    });
    setShowTransfer(true);
  }

  function openEditPayment(p) {
    if (!p?.id) return;
    if (vendors.length === 0) fetchVendors();
    if (bankAccounts.length === 0) fetchBankAccounts();
    setEditingPaymentId(p.id);
    setTransferForm({
      payment_date: p.payment_date ? String(p.payment_date).slice(0, 10) : "",
      transaction_id: p.transaction_id || "",
      from_bank: p.from_bank || "",
      from_account: p.from_account || "",
      to_bank: p.to_bank || "กสิกรไทย",
      to_account: p.to_account || "",
      to_name: p.to_name || "GROUP LEASE PUBLIC CO.,LTD.",
      transfer_amount: Number(p.transfer_amount) || 0,
      fee: Number(p.fee) || 0,
      note: p.note || "",
      slip_image: "",
      slip_mime: "",
      paid_to_vendor: p.paid_to_vendor || "",
      payment_method: p.payment_method || "โอน",
      wht_rate: Number(p.wht_rate) || 0,
      wht_amount: Number(p.wht_amount) || 0,
      wht_base: Number(p.wht_base) || Number(p.transfer_amount) || 0,
      from_bank_account_id: p.from_bank_account_id || "",
    });
    setShowTransfer(true);
  }

  async function submitTransfer() {
    if (!transferForm.payment_date) { alert("กรอกวันที่จ่าย"); return; }
    if (!transferForm.paid_to_vendor) { alert("กรุณาเลือก Vendor"); return; }
    if (!transferForm.from_bank_account_id) { alert("กรุณาเลือกบัญชีโอนจาก"); return; }
    setSaving(true);
    setMessage("");
    try {
      const isEdit = !!editingPaymentId;
      const fromBank = bankAccounts.find(b => b.account_id === Number(transferForm.from_bank_account_id));
      const toVendor = vendors.find(v => v.vendor_name === transferForm.paid_to_vendor);

      let body;
      if (isEdit) {
        // Edit mode — ไม่แก้ items, แก้แค่ header
        body = {
          action: "update_glp_payment",
          id: editingPaymentId,
          payment_date: transferForm.payment_date,
          transaction_id: transferForm.transaction_id || "",
          from_bank: fromBank?.bank_name || transferForm.from_bank || "",
          from_account: fromBank?.account_no || transferForm.from_account || "",
          to_bank: toVendor?.bank_name || transferForm.to_bank || "กสิกรไทย",
          to_account: toVendor?.bank_account_no || transferForm.to_account || "",
          to_name: toVendor?.bank_account_name || transferForm.paid_to_vendor || transferForm.to_name || "",
          transfer_amount: Number(transferForm.transfer_amount) || 0,
          fee: Number(transferForm.fee) || 0,
          note: transferForm.note || "",
          status: "transferred",
          paid_to_vendor: transferForm.paid_to_vendor || "",
          payment_method: transferForm.payment_method || "โอน",
          wht_rate: Number(transferForm.wht_rate) || 0,
          wht_amount: Number(transferForm.wht_amount) || 0,
          wht_base: Number(transferForm.wht_base) || 0,
          from_bank_account_id: Number(transferForm.from_bank_account_id) || null,
          items: [], // ไม่แก้ items ในโหมด edit (จะไม่ถูก replace)
          skip_items_replace: true,
        };
      } else {
        const items = selectedList.map(r => ({
          source_item_id: r.item_id,
          source_receipt_no: r.receipt_no,
          contract_no: selected[r.item_id]?.contract_no || "",
          received_date: r.received_date ? r.received_date.slice(0, 10) : null,
          received_amount: Number(r.line_amount) || 0,
          paid_amount: Number(selected[r.item_id]?.paid_amount) || 0,
          customer_name: r.customer_name || "",
          branch_code: r.branch_code || "",
          remark: "",
        }));
        body = {
          action: "save_glp_payment",
          ...transferForm,
          transfer_amount: totalSelected,
          status: "transferred",
          created_by: currentUser?.name || "",
          items,
          from_bank_account_id: Number(transferForm.from_bank_account_id) || null,
          from_bank: fromBank?.bank_name || transferForm.from_bank || "",
          from_account: fromBank?.account_no || "",
          to_bank: toVendor?.bank_name || "กสิกรไทย",
          to_account: toVendor?.bank_account_no || transferForm.to_account || "",
          to_name: toVendor?.bank_account_name || transferForm.paid_to_vendor || "",
          wht_rate: Number(transferForm.wht_rate) || 0,
          wht_amount: Number(transferForm.wht_amount) || 0,
          wht_base: Number(transferForm.wht_base) || 0,
        };
      }
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data?.payment_no || data?.id) {
        setMessage(isEdit ? `✅ แก้ไขเรียบร้อย` : `✅ บันทึกแล้ว ${data.payment_no || ""}`);
        setShowTransfer(false);
        setEditingPaymentId(null);
        setTransferForm({ ...transferForm, transaction_id: "", slip_image: "", slip_mime: "", note: "" });
        if (isEdit) {
          fetchPayments();
        } else {
          const printObj = { payment_no: data.payment_no, payment_date: body.payment_date, items: body.items };
          if (window.confirm("บันทึกสำเร็จ — ต้องการพิมพ์ใบโอนหรือไม่?")) printPayment(printObj);
          fetchPending();
        }
      } else {
        setMessage("❌ บันทึกไม่สำเร็จ");
      }
    } catch (e) {
      setMessage("❌ " + e.message);
    }
    setSaving(false);
  }

  function printPayment(payment) {
    const items = Array.isArray(payment.items) ? payment.items : [];
    if (items.length === 0) { alert("ไม่มีรายการในใบโอนนี้"); return; }

    const MIN_ROWS = 25; // จำนวนแถวขั้นต่ำในตาราง (เพื่อให้เส้นตารางดูเต็มหน้า)
    const thMonths = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    const d = payment.payment_date ? new Date(payment.payment_date) : new Date();
    const thDate = `${d.getDate()} ${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`;

    const shopName = "ป.เปา มอเตอร์เซอร์วิส";

    const rows = items.map((i, idx) => `<tr>
      <td class="c">${idx + 1}</td>
      <td>${i.contract_no || ""}</td>
      <td>${i.customer_name || ""}</td>
      <td class="r">${fmt(i.paid_amount)}</td>
      <td>${i.remark || ""}</td>
    </tr>`).join("");

    let empty = "";
    for (let i = items.length; i < MIN_ROWS; i++) {
      empty += `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`;
    }

    const total = items.reduce((s, i) => s + (Number(i.paid_amount) || 0), 0);

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ใบชำระค่างวดกรุ๊ปลีส ${payment.payment_no || ""}</title>
      <style>
        body { font-family: "Sarabun", "Tahoma", sans-serif; padding: 20px; font-size: 14px; }
        .head { margin-bottom: 12px; line-height: 1.5; }
        .head b { font-size: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 4px 8px; font-size: 13px; }
        th { background: #f3f4f6; font-weight: bold; text-align: center; }
        td.c { text-align: center; }
        td.r { text-align: right; }
        tfoot td { font-weight: bold; background: #fef08a; }
        @media print { body { padding: 10px; } button { display: none; } }
      </style>
    </head><body>
      <div class="head">
        <div><b>บริษัท กรุ๊ปลีส จำกัด (มหาชน)</b></div>
        <div>ติดต่อเบอร์ Fax 0-2580-9278 โทร. 0-2580-7555 ต่อ 4405</div>
        <div>ธนาคารกสิกรไทย เลขที่บัญชี 7371019078 สาขาประชานิเวศน์ กระแสรายวัน</div>
        <div>ธนาคารไทยพาณิชย์ เลขที่บัญชี 0852062096 สาขาประชานิเวศน์ 1 ออมทรัพย์</div>
        <div>ธนาคารกรุงเทพ เลขที่บัญชี 1930380306 สาขาถนนประชาชื่น ออมทรัพย์</div>
        <div style="margin-top:6px">วันที่ &nbsp;&nbsp; ${thDate}</div>
        <div>ร้าน &nbsp;&nbsp;&nbsp;&nbsp; ${shopName}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:45px">ลำดับ</th>
            <th style="width:150px">เลขที่สัญญา</th>
            <th>ชื่อ-สกุล</th>
            <th style="width:95px">จำนวนเงิน</th>
            <th style="width:95px">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>${rows}${empty}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="r">รวมเงินทั้งหมด</td>
            <td class="r">${fmt(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <button onclick="window.print()" style="margin-top:20px;padding:10px 20px;background:#1e40af;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨️ พิมพ์</button>
    </body></html>`;

    const w = window.open("", "_blank", "width=900,height=800");
    w.document.write(html);
    w.document.close();
  }

  // พิมพ์จากรายการที่เลือก (ยังไม่บันทึก)
  function printSelected() {
    if (selectedList.length === 0) { alert("เลือกรายการก่อน"); return; }
    const items = selectedList.map(r => ({
      contract_no: selected[r.item_id]?.contract_no || "",
      customer_name: r.customer_name || "",
      paid_amount: Number(selected[r.item_id]?.paid_amount) || 0,
      remark: "",
    }));
    printPayment({
      payment_no: "",
      payment_date: new Date().toISOString().slice(0, 10),
      items,
    });
  }

  async function deletePayment(id) {
    if (!window.confirm("ลบรายการนี้?")) return;
    await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_glp_payment", id }),
    });
    fetchPayments();
  }

  // ====== RENDER ======
  return (
    <div className="pay-deposit" style={{ padding: 20 }}>
      <h2>ชำระเงินรับฝาก — ค่างวดกรุ๊ปลีส</h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid #ccc" }}>
        {[
          ["pending", "📥 รับฝากค้างโอน"],
          ["history", "📋 ประวัติการจ่ายเงิน"],
          ["report", "📊 รายงาน"],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding: "8px 16px", border: "none", cursor: "pointer",
              background: tab === k ? "#1e40af" : "#e5e7eb",
              color: tab === k ? "#fff" : "#111",
              borderRadius: "4px 4px 0 0", fontWeight: "bold",
            }}>{label}</button>
        ))}
      </div>

      {message && (
        <div style={{ padding: 10, marginBottom: 10, background: "#dbeafe", borderRadius: 4 }}>{message}</div>
      )}

      {/* ============ TAB 1: PENDING ============ */}
      {tab === "pending" && (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <label>วันที่: </label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span>ถึง</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
              {BRANCHES.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
            <button onClick={fetchPending} style={btnPrimary}>🔍 ค้นหา</button>
            <div style={{ flex: 1 }}></div>
            <div style={{ fontWeight: "bold" }}>
              เลือก: {selectedList.length} รายการ | รวม: {fmt(totalSelected)} บาท
            </div>
            <button onClick={printSelected} style={btnPrint} disabled={selectedList.length === 0}>🖨️ พิมพ์รายการ</button>
            <button onClick={openTransfer} style={btnSuccess} disabled={selectedList.length === 0}>💰 สร้างใบโอน</button>
          </div>

          {pendingLoading ? <p>กำลังโหลด...</p> : pendingItems.length === 0 ? (
            <p style={{ color: "#666" }}>ไม่มีรายการค้างโอน</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#1e40af", color: "#fff" }}>
                    <th><input type="checkbox" onChange={e => toggleAll(e.target.checked)} /></th>
                    <th>วันที่รับ</th>
                    <th>เลขใบเสร็จ</th>
                    <th>สาขา</th>
                    <th>ลูกค้า</th>
                    <th>รายการ</th>
                    <th style={{ textAlign: "right" }}>ยอดรับ</th>
                    <th>เลขที่สัญญา *</th>
                    <th style={{ textAlign: "right" }}>ยอดโอนจริง *</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map(r => {
                    const s = selected[r.item_id] || {};
                    return (
                      <tr key={r.item_id} style={s.checked ? { background: "#fef3c7" } : {}}>
                        <td><input type="checkbox" checked={!!s.checked}
                          onChange={e => updateSelected(r.item_id, "checked", e.target.checked)} /></td>
                        <td>{r.received_date ? r.received_date.slice(0, 10) : "-"}</td>
                        <td>{r.receipt_no}</td>
                        <td>{r.branch_code}</td>
                        <td>{r.customer_name || "-"}</td>
                        <td style={{ maxWidth: 280 }}>{r.description}</td>
                        <td style={{ textAlign: "right" }}>{fmt(r.line_amount)}</td>
                        <td><input type="text" value={s.contract_no || ""}
                          onChange={e => updateSelected(r.item_id, "contract_no", e.target.value)}
                          style={{ width: 140 }} /></td>
                        <td><input type="number" step="0.01" value={s.paid_amount || 0}
                          onChange={e => updateSelected(r.item_id, "paid_amount", e.target.value)}
                          style={{ width: 110, textAlign: "right" }} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ TAB 2: HISTORY ============ */}
      {tab === "history" && (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <label>วันที่โอน: </label>
            <input type="date" value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} />
            <span>ถึง</span>
            <input type="date" value={historyTo} onChange={e => setHistoryTo(e.target.value)} />
            <button onClick={fetchPayments} style={btnPrimary}>🔍 ค้นหา</button>
          </div>
          {paymentsLoading ? <p>กำลังโหลด...</p> : payments.length === 0 ? (
            <p style={{ color: "#666" }}>ไม่มีประวัติการจ่ายเงิน</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: "#1e40af", color: "#fff" }}>
                  <th>วันที่โอน</th>
                  <th>เลขใบ</th>
                  <th style={{ textAlign: "right" }}>จำนวนสัญญา</th>
                  <th style={{ textAlign: "right" }}>ยอดรวม</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.payment_date ? p.payment_date.slice(0, 10) : "-"}</td>
                    <td>{p.payment_no}</td>
                    <td style={{ textAlign: "right" }}>{(p.items || []).length}</td>
                    <td style={{ textAlign: "right" }}>{fmt(p.transfer_amount)}</td>
                    <td>
                      <button onClick={() => setDetailPayment(p)} style={btnSmall}>ดูรายละเอียด</button>
                      <button onClick={() => printPayment(p)} style={{ ...btnSmall, background: "#7c3aed", color: "#fff" }}>🖨️ พิมพ์</button>
                      <button onClick={() => openEditPayment(p)} style={{ ...btnSmall, background: "#0369a1", color: "#fff" }}>✏️ แก้ไข</button>
                      <button onClick={() => deletePayment(p.id)} style={{ ...btnSmall, background: "#dc2626", color: "#fff" }}>✕ ยกเลิก</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ============ TAB 3: REPORT — ค้นหาการจ่ายเงิน ============ */}
      {tab === "report" && (() => {
        const filtered = report.filter(r => {
          if (!reportSearch.trim()) return true;
          const s = reportSearch.toLowerCase().trim();
          return (
            (r.customer_name || "").toLowerCase().includes(s) ||
            (r.contract_no || "").toLowerCase().includes(s)
          );
        });
        const totalPaid = filtered.reduce((sum, r) => sum + (Number(r.paid_amount) || 0), 0);
        const totalPages = Math.max(1, Math.ceil(filtered.length / REPORT_PAGE_SIZE));
        const page = Math.min(reportPage, totalPages);
        const pageData = filtered.slice((page - 1) * REPORT_PAGE_SIZE, page * REPORT_PAGE_SIZE);
        return (
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <label>วันที่โอน: </label>
              <input type="date" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)} />
              <span>ถึง</span>
              <input type="date" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)} />
              <input type="text" placeholder="🔎 ค้นหาชื่อลูกค้า / เลขสัญญา"
                value={reportSearch}
                onChange={e => { setReportSearch(e.target.value); setReportPage(1); }}
                style={{ padding: 6, minWidth: 220, border: "1px solid #ccc", borderRadius: 4 }} />
              <button onClick={() => { fetchReport(); setReportPage(1); }} style={btnPrimary}>🔍 ค้นหา</button>
              <div style={{ flex: 1 }}></div>
              <div style={{ fontWeight: "bold" }}>
                พบ: {filtered.length} รายการ | รวม: {fmt(totalPaid)} บาท
              </div>
            </div>
            {filtered.length === 0 ? (
              <p style={{ color: "#666" }}>ไม่พบข้อมูล</p>
            ) : (
              <>
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ background: "#1e40af", color: "#fff" }}>
                      <th>วันที่โอน</th>
                      <th>เลขใบโอน</th>
                      <th>เลขที่สัญญา</th>
                      <th>ลูกค้า</th>
                      <th>สาขา</th>
                      <th>วันที่รับ</th>
                      <th style={{ textAlign: "right" }}>ยอดรับ</th>
                      <th style={{ textAlign: "right" }}>ยอดโอน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((r, i) => (
                      <tr key={i}>
                        <td>{r.payment_date ? r.payment_date.slice(0, 10) : "-"}</td>
                        <td>{r.payment_no}</td>
                        <td>{r.contract_no || "-"}</td>
                        <td>{r.customer_name || "-"}</td>
                        <td>{r.branch_code || "-"}</td>
                        <td>{r.received_date ? r.received_date.slice(0, 10) : "-"}</td>
                        <td style={{ textAlign: "right" }}>{fmt(r.received_amount)}</td>
                        <td style={{ textAlign: "right", fontWeight: "bold" }}>{fmt(r.paid_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Pagination */}
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={() => setReportPage(1)} disabled={page === 1} style={pageBtn(page === 1)}>«</button>
                  <button onClick={() => setReportPage(page - 1)} disabled={page === 1} style={pageBtn(page === 1)}>‹</button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const p = idx + 1;
                    // show only nearby pages
                    if (totalPages > 10 && Math.abs(p - page) > 2 && p !== 1 && p !== totalPages) {
                      if (p === 2 || p === totalPages - 1) return <span key={p} style={{ padding: "4px 8px" }}>…</span>;
                      return null;
                    }
                    return (
                      <button key={p} onClick={() => setReportPage(p)}
                        style={{ ...pageBtn(false), background: p === page ? "#1e40af" : "#e5e7eb", color: p === page ? "#fff" : "#111", fontWeight: p === page ? "bold" : "normal" }}>
                        {p}
                      </button>
                    );
                  })}
                  <button onClick={() => setReportPage(page + 1)} disabled={page === totalPages} style={pageBtn(page === totalPages)}>›</button>
                  <button onClick={() => setReportPage(totalPages)} disabled={page === totalPages} style={pageBtn(page === totalPages)}>»</button>
                  <span style={{ padding: "4px 10px", color: "#666" }}>หน้า {page} / {totalPages}</span>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ============ TRANSFER MODAL ============ */}
      {showTransfer && (
        <Modal onClose={() => { setShowTransfer(false); setEditingPaymentId(null); }}>
          <h3 style={{ margin: "0 0 14px", color: editingPaymentId ? "#7c3aed" : "#072d6b" }}>
            {editingPaymentId ? "✏️ แก้ไขการจ่ายเงิน" : "💵 บันทึกจ่ายเงิน"}
          </h3>

          {editingPaymentId ? (
            <div style={{ background: "#fef3c7", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13, color: "#78350f" }}>
              ⚠️ <b>โหมดแก้ไข</b> — เปลี่ยน vendor / ธนาคาร / วิธีจ่าย / wht ได้ (ไม่แก้ไขรายการรับฝาก)
            </div>
          ) : (
            <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13, textAlign: "center" }}>
              <div>📋 รายการรวม: <b>{selectedList.length}</b> รายการ</div>
              <div>💰 ยอดรวม: <b style={{ color: "#dc2626", fontSize: 20 }}>฿ {fmt(totalSelected)}</b></div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>วันที่จ่าย *</label>
              <input type="date" value={transferForm.payment_date}
                onChange={e => setTransferForm(p => ({ ...p, payment_date: e.target.value }))}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>วิธีจ่าย</label>
              <select value={transferForm.payment_method}
                onChange={e => setTransferForm(p => ({ ...p, payment_method: e.target.value }))}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" }}>
                <option value="โอน">โอน</option>
                <option value="เงินสด">เงินสด</option>
                <option value="เช็ค">เช็ค</option>
                <option value="หักบัญชี">หักบัญชี</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / span 2" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>Vendor (จ่ายให้) *</label>
              <select value={transferForm.paid_to_vendor} onChange={e => onVendorChange(e.target.value)}
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
              <textarea value={transferForm.note} onChange={e => setTransferForm(p => ({ ...p, note: e.target.value }))} rows={2}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
            </div>
          </div>

          {/* Bank account block */}
          <div style={{ marginTop: 12, padding: 10, background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 6, textAlign: "center" }}>🏦 บัญชีธนาคาร</div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#1e40af", marginBottom: 2 }}>โอนจาก (บัญชีบริษัท) *</label>
              <select value={transferForm.from_bank_account_id} onChange={e => setTransferForm(p => ({ ...p, from_bank_account_id: e.target.value }))}
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
            {transferForm.paid_to_vendor && (() => {
              const v = vendors.find(x => x.vendor_name === transferForm.paid_to_vendor);
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

          {/* WHT block */}
          <div style={{ marginTop: 12, padding: 10, background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 6, textAlign: "center" }}>🧾 หักณที่จ่าย</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: 11, marginBottom: 2 }}>ยอดค่าบริการ (base)</label>
                <input type="text" value={Number(transferForm.wht_base || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })} readOnly
                  style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, textAlign: "right", background: "#fff", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, marginBottom: 2 }}>อัตรา %</label>
                <input type="number" step="0.01" value={transferForm.wht_rate}
                  onChange={e => {
                    const r = Number(e.target.value) || 0;
                    const amt = Math.round((transferForm.wht_base * r / 100) * 100) / 100;
                    setTransferForm(p => ({ ...p, wht_rate: r, wht_amount: amt }));
                  }}
                  style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, textAlign: "right", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, marginBottom: 2 }}>หัก ณ ที่จ่าย</label>
                <input type="number" step="0.01" value={transferForm.wht_amount}
                  onChange={e => setTransferForm(p => ({ ...p, wht_amount: Number(e.target.value) || 0 }))}
                  style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, textAlign: "right", fontWeight: 700, color: "#dc2626", boxSizing: "border-box" }} />
              </div>
            </div>
            {(() => {
              const displayTotal = editingPaymentId ? (Number(transferForm.wht_base) || Number(transferForm.transfer_amount) || 0) : totalSelected;
              return (
                <div style={{ marginTop: 8, padding: "6px 10px", background: "#fff", borderRadius: 6, fontSize: 13, textAlign: "center" }}>
                  <span>ยอดวางบิล: <strong>{fmt(displayTotal)}</strong></span>
                  <span style={{ marginLeft: 14, color: "#dc2626" }}>− หัก WHT: <strong>{fmt(transferForm.wht_amount)}</strong></span>
                  <span style={{ marginLeft: 14, color: "#059669", fontWeight: 700 }}>= ยอดโอนจริง: {fmt(displayTotal - Number(transferForm.wht_amount || 0))}</span>
                </div>
              );
            })()}
          </div>

          <div style={{ marginTop: 18, textAlign: "right" }}>
            <button onClick={() => { setShowTransfer(false); setEditingPaymentId(null); }} style={{ ...btnSmall, marginRight: 8 }}>ยกเลิก</button>
            <button onClick={submitTransfer} disabled={saving} style={editingPaymentId ? { ...btnSuccess, background: "#7c3aed" } : btnSuccess}>
              {saving ? "กำลังบันทึก..." : (editingPaymentId ? "💾 บันทึกแก้ไข" : "💾 บันทึกจ่ายเงิน")}
            </button>
          </div>
        </Modal>
      )}

      {/* ============ DETAIL MODAL ============ */}
      {detailPayment && (
        <Modal onClose={() => setDetailPayment(null)}>
          <h3>รายละเอียดใบโอน {detailPayment.payment_no}</h3>
          <div style={{ marginBottom: 10 }}>
            <div>วันที่โอน: <b>{detailPayment.payment_date?.slice(0, 10)}</b></div>
            <div>Transaction ID: <code>{detailPayment.transaction_id || "-"}</code></div>
            <div>ยอดรวม: <b>{fmt(detailPayment.transfer_amount)}</b> บาท</div>
            <div>ค่าธรรมเนียม: {fmt(detailPayment.fee)}</div>
            {detailPayment.note && <div>หมายเหตุ: {detailPayment.note}</div>}
          </div>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "#e5e7eb" }}>
                <th>เลขที่สัญญา</th>
                <th>ลูกค้า</th>
                <th>สาขา</th>
                <th>วันที่รับ</th>
                <th style={{ textAlign: "right" }}>ยอดรับ</th>
                <th style={{ textAlign: "right" }}>ยอดโอน</th>
              </tr>
            </thead>
            <tbody>
              {(detailPayment.items || []).map(i => (
                <tr key={i.item_id}>
                  <td>{i.contract_no}</td>
                  <td>{i.customer_name || "-"}</td>
                  <td>{i.branch_code}</td>
                  <td>{i.received_date?.slice(0, 10) || "-"}</td>
                  <td style={{ textAlign: "right" }}>{fmt(i.received_amount)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(i.paid_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {detailPayment.slip_image && (
            <div style={{ marginTop: 10 }}>
              <h4>Slip โอน</h4>
              <img src={`data:${detailPayment.slip_mime || "image/jpeg"};base64,${detailPayment.slip_image}`}
                style={{ maxWidth: "100%", maxHeight: 500, border: "1px solid #ccc" }} />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// --- Shared small components ---
function Modal({ children, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", padding: 20, borderRadius: 8, maxWidth: 900,
          width: "90%", maxHeight: "90vh", overflowY: "auto",
        }}>{children}</div>
    </div>
  );
}

const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const btnPrimary = { padding: "6px 14px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" };
const btnSuccess = { padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" };
const btnPrint = { padding: "8px 16px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" };
const pageBtn = (disabled) => ({ padding: "4px 10px", background: "#e5e7eb", color: disabled ? "#9ca3af" : "#111", border: "none", borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, minWidth: 32 });
const btnSmall = { padding: "4px 10px", background: "#e5e7eb", border: "none", borderRadius: 4, cursor: "pointer", marginRight: 4, fontSize: 12 };
const inputStyle = { width: "100%", padding: 6, border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" };

// style th/td global — inline via CSS-in-JS? Use a small <style> block:
const _styleOnce = (() => {
  if (typeof document !== "undefined" && !document.getElementById("paydeposit-style")) {
    const st = document.createElement("style");
    st.id = "paydeposit-style";
    st.textContent = `
      .pay-deposit table th, .pay-deposit table td { padding: 6px 8px; border: 1px solid #ddd; }
    `;
    document.head.appendChild(st);
  }
})();
