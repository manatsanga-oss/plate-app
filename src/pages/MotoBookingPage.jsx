import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/moto-booking-api";

const BRANCHES = [
  "SCY01 สำนักงานใหญ่",
  "SCY04 สิงห์ชัย ตลาดสีขวา",
  "SCY05 ป.เปา นครหลวง",
  "SCY06 ป.เปา วังน้อย",
  "SCY07 สิงห์ชัย ตลาด",
];

const BRANDS = ["ออนด้า", "ยามาฮ่า"];
const PURCHASE_TYPES = ["สด", "ผ่อน"];

const STATUS_LABEL = { จอง: "จอง", ขาย: "ขาย", ยกเลิก: "ยกเลิก" };
const STATUS_COLOR = { จอง: "#f59e0b", ขาย: "#10b981", ยกเลิก: "#6b7280" };

const emptyForm = () => ({
  branch: "",
  brand: "",
  marketing_name: "",
  model_code: "",
  color_name: "",
  customer_name: "",
  customer_phone: "",
  purchase_type: "",
  deposit_no: "",
  finance_company: "",
});

export default function MotoBookingPage({ currentUser }) {
  const [mode, setMode] = useState("list"); // list | add | change
  const [bookings, setBookings] = useState([]);
  const [allModels, setAllModels] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterMarketing, setFilterMarketing] = useState("");
  const [filterModelCode, setFilterModelCode] = useState("");
  const [filterColor, setFilterColor] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Reset to page 1 when any filter changes — เลี่ยง slice() ตกขอบจนตารางว่าง
  useEffect(() => {
    setCurrentPage(1);
  }, [filterDate, filterBranch, filterBrand, filterMarketing, filterModelCode, filterColor]);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [depositAction, setDepositAction] = useState("ยึดเงินมัดจำ");
  const [refundForm, setRefundForm] = useState({ account_no: "", bank: "", amount: "" });
  const [changeTarget, setChangeTarget] = useState(null);
  const [changeForm, setChangeForm] = useState({ model_code: "", color_name: "" });
  const [sellTarget, setSellTarget] = useState(null);
  const [sellInvoiceNo, setSellInvoiceNo] = useState("");
  const [editInvoiceTarget, setEditInvoiceTarget] = useState(null);
  const [editInvoiceNo, setEditInvoiceNo] = useState("");
  const [detailTarget, setDetailTarget] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [cancelBlock, setCancelBlock] = useState(null);   // { model_code, color_name }
  const [checkingCancel, setCheckingCancel] = useState(false);
  const [stockSummary, setStockSummary] = useState([]);
  const [appointmentTarget, setAppointmentTarget] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentNote, setAppointmentNote] = useState("");
  const [deposits, setDeposits] = useState([]);
  const [salesMap, setSalesMap] = useState({});
  const [allDeposits, setAllDeposits] = useState([]);

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    fetchBookings();
    fetchAllModels();
    fetchStockSummary();
    fetchDeposits();
    fetchSales();
    fetchAllDeposits();
    if (isAdmin) fetchBankAccounts();
  }, []);

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
  function fetchData() { fetchBookings(); }

  async function fetchBookings() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_moto_bookings" }),
      });
      const data = await res.json();
      console.log("📦 API get_moto_bookings:", Array.isArray(data) ? data.length : 0, "รายการ");
      setBookings(Array.isArray(data) ? data : []);
    } catch {
      setMessage("โหลดข้อมูลไม่สำเร็จ");
    }
    setLoading(false);
  }

  async function fetchStockSummary() {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_stock_summary" }),
      });
      const data = await res.json();
      setStockSummary(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }

  async function fetchDeposits() {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_moto_deposits" }),
      });
      const data = await res.json();
      setDeposits(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }

  async function fetchSales() {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_moto_sales" }),
      });
      const data = await res.json();
      const map = {};
      (Array.isArray(data) ? data : []).forEach(s => {
        if (s.invoice_no) map[s.invoice_no] = { sale_date: s.sale_date, customer_name: s.customer_name };
      });
      setSalesMap(map);
    } catch { /* ignore */ }
  }

  async function fetchAllDeposits() {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_all_deposits" }),
      });
      const data = await res.json();
      setAllDeposits(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }

  async function fetchAllModels() {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_moto_models" }),
      });
      const data = await res.json();
      setAllModels(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }

  // cascade filter helpers
  const codesByBrand = (brand) =>
    [...new Map(
      allModels.filter(m => !brand || m.brand === brand)
        .map(m => [m.model_code, m])
    ).values()].sort((a, b) => a.model_code.localeCompare(b.model_code));

  const colorsByCode = (brand, code) =>
    [...new Map(
      allModels.filter(m =>
        (!brand || m.brand === brand) &&
        (!code || m.model_code === code)
      ).map(m => [m.color_name, m])
    ).values()];

  const marketingByBrand = (brand) =>
    [...new Set(
      allModels.filter(m => !brand || m.brand === brand)
        .map(m => m.marketing_name).filter(Boolean)
    )].sort();

  const codesByMarketing = (brand, marketing) =>
    [...new Map(
      allModels.filter(m =>
        (!brand || m.brand === brand) &&
        (!marketing || m.marketing_name === marketing)
      ).map(m => [m.model_code, m])
    ).values()].sort((a, b) => a.model_code.localeCompare(b.model_code));

  async function handleSave() {
    if (!form.branch || !form.brand || !form.marketing_name || !form.model_code || !form.color_name || !form.customer_name || !form.customer_phone || !form.purchase_type) {
      setMessage("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    // ตรวจสอบเลขที่มัดจำซ้ำ
    if (form.deposit_no && form.deposit_no.trim()) {
      const dup = bookings.find(b => b.deposit_no === form.deposit_no.trim() && b.status === "จอง");
      if (dup) {
        setMessage("เลขที่ใบมัดจำนี้ถูกใช้จองแล้ว (ลำดับ #" + dup.booking_id + ")");
        return;
      }
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_moto_booking", ...form }),
      });
      const data = await res.json();
      if (data?.booking_id || data?.success) {
        setForm(emptyForm());
        setMode("list");
        fetchBookings();
      } else {
        setMessage("บันทึกไม่สำเร็จ: " + (data?.message || ""));
      }
    } catch {
      setMessage("เกิดข้อผิดพลาด");
    }
    setSaving(false);
  }

  async function handleSell() {
    if (!sellTarget) return;
    if (!sellInvoiceNo.trim()) { alert("กรุณากรอกเลขที่ใบขาย"); return; }
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sell_moto_booking", booking_id: sellTarget.booking_id, invoice_no: sellInvoiceNo.trim() }),
      });
      setSellTarget(null);
      setSellInvoiceNo("");
      fetchBookings();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function handleUpdateInvoice() {
    if (!editInvoiceTarget) return;
    if (!editInvoiceNo.trim()) { alert("กรุณากรอกเลขที่ใบขาย"); return; }
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_invoice_no", booking_id: editInvoiceTarget.booking_id, invoice_no: editInvoiceNo.trim() }),
      });
      setEditInvoiceTarget(null);
      setEditInvoiceNo("");
      fetchBookings();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    if (depositAction === "คืนเงินมัดจำ" && (!refundForm.account_no.trim() || !refundForm.bank || !refundForm.amount)) {
      alert("กรุณากรอกข้อมูลคืนเงินมัดจำให้ครบ"); return;
    }
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_moto_booking",
          booking_id: cancelTarget.booking_id,
          cancel_reason: cancelReason,
          deposit_action: depositAction,
          refund_account_no: depositAction === "คืนเงินมัดจำ" ? refundForm.account_no : "",
          refund_bank: depositAction === "คืนเงินมัดจำ" ? refundForm.bank : "",
          refund_amount: depositAction === "คืนเงินมัดจำ" ? refundForm.amount : "",
        }),
      });
      setCancelTarget(null);
      setCancelReason("");
      setDepositAction("ยึดเงินมัดจำ");
      setRefundForm({ account_no: "", bank: "", amount: "" });
      fetchBookings();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  // เช็คเงื่อนไขก่อนยกเลิก: รถอยู่ในสต๊อก + เป็นคิวแรก → ยกเลิกไม่ได้
  async function handleCancelClick(b) {
    const modelCode = b.new_model_code || b.model_code;
    const colorName = b.new_color_name || b.color_name;
    setCheckingCancel(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check_cancel_eligibility",
          booking_id: b.booking_id,
          model_code: modelCode,
          color_name: colorName,
        }),
      });
      const data = await res.json();
      if (data?.blocked) {
        setCancelBlock({ model_code: modelCode, color_name: colorName });
      } else {
        setCancelTarget(b);
        setCancelReason("");
      }
    } catch {
      // fallback: อนุญาตยกเลิกถ้า API ไม่ตอบ
      setCancelTarget(b);
      setCancelReason("");
    }
    setCheckingCancel(false);
  }

  async function handleChangeModel() {
    if (!changeTarget || !changeForm.brand || !changeForm.marketing_name || !changeForm.model_code || !changeForm.color_name) {
      setMessage("กรุณาเลือกยี่ห้อ ชื่อรุ่น แบบ และสีให้ครบ");
      return;
    }
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_moto_model", booking_id: changeTarget.booking_id, ...changeForm }),
      });
      setChangeTarget(null);
      setChangeForm({ model_code: "", color_name: "" });
      fetchBookings();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function handleSaveAppointment() {
    if (!appointmentTarget || !appointmentDate) { alert("กรุณาเลือกวันที่นัดหมาย"); return; }
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_appointment",
          booking_id: appointmentTarget.booking_id,
          appointment_date: appointmentDate,
          appointment_note: appointmentNote,
        }),
      });
      setAppointmentTarget(null);
      setAppointmentDate("");
      setAppointmentNote("");
      fetchBookings();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  // Normalize ตรงกับ n8n Code node
  const normModel = (s) => {
    let str = String(s || "").normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/[()（）]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();
    const idx = str.indexOf("th");
    if (idx !== -1) str = str.substring(0, idx + 2);
    return str;
  };
  const normColor = (s) => String(s || "").normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/[-–—/:：]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

  // Group stock cars by normalized model+color, sorted by receive_age DESC (oldest first)
  const stockGroups = {};
  stockSummary.forEach((s) => {
    const key = normModel(s.model_code) + "|" + normColor(s.color_name);
    if (!stockGroups[key]) stockGroups[key] = [];
    stockGroups[key].push(s);
  });

  // Compute queue position for each 'จอง' booking sorted by booking_date ASC
  const queueGroups = {};
  bookings.filter((b) => b.status === "จอง").forEach((b) => {
    const mc = b.new_model_code || b.model_code || "";
    const cn = b.new_color_name || b.color_name || "";
    const key = mc + "|" + cn;
    if (!queueGroups[key]) queueGroups[key] = [];
    queueGroups[key].push(b);
  });
  Object.keys(queueGroups).forEach((key) => {
    // เรียงคิว: วันที่จองก่อน → ถ้าวันเดียวกัน ใช้เลขที่ใบมัดจำ (deposit_no)
    queueGroups[key].sort((a, b) => {
      const dtA = new Date(a.booking_date).getTime();
      const dtB = new Date(b.booking_date).getTime();
      if (dtA !== dtB) return dtA - dtB;
      const dA = (a.deposit_no || "").toString();
      const dB = (b.deposit_no || "").toString();
      if (dA && dB) return dA.localeCompare(dB, undefined, { numeric: true });
      return 0;
    });
  });
  const queuePosMap = {}; // booking_id -> { pos, qty, engine_no, branch, age }
  Object.keys(queueGroups).forEach((key) => {
    const [mc, cn] = key.split("|");
    const stockKey = normModel(mc) + "|" + normColor(cn);
    const cars = stockGroups[stockKey] || [];
    queueGroups[key].forEach((b, idx) => {
      const car = cars[idx] || null;
      queuePosMap[b.booking_id] = {
        pos: idx + 1,
        qty: cars.length,
        engine_no: car?.engine_no || "",
        branch: car?.branch_name || "",
        age: car ? (Number(car.receive_age) || 0) : 0,
      };
    });
  });

  const isQueueReady = (b) => {
    const q = queuePosMap[b.booking_id];
    return b.status === "จอง" && q && q.qty > 0 && q.pos <= q.qty;
  };

  // deposit warning ปิดใช้งาน: ใช้ "เลขที่มัดจำไม่ถูกต้อง" (line 768) แทน
  const hasDepositWarning = () => false;

  // deposit map for cancelled bookings (from allDeposits - includes all records)
  const depositMap = {};
  allDeposits.forEach((d) => {
    if (d.receipt_no) depositMap[d.receipt_no] = { remaining_amount: Number(d.remaining_amount) || 0 };
  });

  // normalize: TRIM + ยุบทุก whitespace (รวม newline) เป็น space เดียว — กันชื่อ/รหัสที่มี space เกินหรือ newline
  const norm = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();

  const filtered = bookings.filter((b) => {
    // การกรองขาย/ยกเลิกเกิน 1 เดือน ทำที่ backend (n8n) แล้ว
    if (filterStatus === "รถถึงคิว") return isQueueReady(b);
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (filterBranch && b.branch !== filterBranch) return false;
    if (filterDate && b.booking_date && b.booking_date.slice(0, 7) !== filterDate) return false;
    if (filterBrand && norm(b.brand) !== norm(filterBrand)) return false;
    if (filterMarketing && norm(b.marketing_name) !== norm(filterMarketing)) return false;
    // ใช้ new_model_code/new_color_name (ถ้ามี) — ตรงกับที่แสดงในตาราง — กันเคสเปลี่ยนรุ่น/สี
    if (filterModelCode && norm(b.new_model_code || b.model_code) !== norm(filterModelCode)) return false;
    if (filterColor && norm(b.new_color_name || b.color_name) !== norm(filterColor)) return false;
    return true;
  }).sort((a, b) => {
    if (filterStatus === "ขาย") {
      const hasA = a.invoice_no && salesMap[a.invoice_no];
      const hasB = b.invoice_no && salesMap[b.invoice_no];
      if (!hasA && hasB) return -1;
      if (hasA && !hasB) return 1;
      if (!hasA && !hasB) return 0;
      return new Date(salesMap[b.invoice_no].sale_date) - new Date(salesMap[a.invoice_no].sale_date);
    }
    if (filterStatus === "ยกเลิก") {
      const depA = a.deposit_no ? depositMap[a.deposit_no] : null;
      const depB = b.deposit_no ? depositMap[b.deposit_no] : null;
      // 0 = ยังไม่ตัดจ่าย (remaining > 0), 1 = ตัดจ่ายแล้ว, 2 = ไม่มี deposit, 3 = ไม่พบข้อมูล
      const rank = (dep, depositNo) => {
        if (!depositNo) return 2;
        if (!dep) return 3;
        if (dep.remaining_amount > 0) return 0;
        return 1;
      };
      const rA = rank(depA, a.deposit_no);
      const rB = rank(depB, b.deposit_no);
      if (rA !== rB) return rA - rB;
      return new Date(b.booking_date) - new Date(a.booking_date);
    }
    // เรียงตามวันจอง → ถ้าเหมือนกัน เรียงตามเลขที่ใบมัดจำ (deposit_no)
    const dtA = new Date(a.booking_date).getTime();
    const dtB = new Date(b.booking_date).getTime();
    if (dtA !== dtB) return dtA - dtB;
    const dA = (a.deposit_no || "").toString();
    const dB = (b.deposit_no || "").toString();
    if (dA && dB) return dA.localeCompare(dB, undefined, { numeric: true });
    return 0;
  });

  // Dynamic options from loaded bookings (deduplicated + normalized — กันค่าซ้ำที่ต่างกันแค่ space/newline)
  const brandOpts = [...new Set(bookings.map(b => norm(b.brand)).filter(Boolean))].sort();
  const marketingOpts = [...new Set(bookings.filter(b => !filterBrand || norm(b.brand) === norm(filterBrand)).map(b => norm(b.marketing_name)).filter(Boolean))].sort();
  // dropdown ใช้ new_X || X (เดียวกับที่แสดง) เพื่อให้กรองได้ถูกเมื่อ user เลือกค่าจาก dropdown
  const modelCodeOpts = [...new Set(bookings.filter(b => (!filterBrand || norm(b.brand) === norm(filterBrand)) && (!filterMarketing || norm(b.marketing_name) === norm(filterMarketing))).map(b => norm(b.new_model_code || b.model_code)).filter(Boolean))].sort();
  const colorOpts = [...new Set(bookings.filter(b => (!filterBrand || norm(b.brand) === norm(filterBrand)) && (!filterMarketing || norm(b.marketing_name) === norm(filterMarketing)) && (!filterModelCode || norm(b.new_model_code || b.model_code) === norm(filterModelCode))).map(b => norm(b.new_color_name || b.color_name)).filter(Boolean))].sort();

  /* ── ADD FORM ── */
  if (mode === "add") {
    const codes = codesByBrand(form.brand);
    const colors = colorsByCode(form.brand, form.model_code);

    return (
      <div className="page-container">
        <div className="page-topbar">
          <h2 className="page-title">🏍️ จองรถจักรยานยนต์</h2>
          <button className="btn-secondary" onClick={() => { setMode("list"); setMessage(""); }}>← กลับ</button>
        </div>
        <div className="form-card" style={{ maxWidth: 600 }}>
          <h3 style={{ marginTop: 0 }}>แบบฟอร์มจองรถ</h3>

          <div className="form-row">
            <label>สาขา <span style={{ color: "#ef4444" }}>*</span></label>
            <select className="form-input" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              <option value="">-- เลือกสาขา --</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="form-row">
            <label>ยี่ห้อ <span style={{ color: "#ef4444" }}>*</span></label>
            <select className="form-input" value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value, marketing_name: "", model_code: "", color_name: "" })}>
              <option value="">-- เลือกยี่ห้อ --</option>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {form.brand && (
            <div className="form-row">
              <label>รุ่น <span style={{ color: "#ef4444" }}>*</span></label>
              <select className="form-input" value={form.marketing_name}
                onChange={(e) => setForm({ ...form, marketing_name: e.target.value, model_code: "", color_name: "" })}>
                <option value="">-- เลือกรุ่น --</option>
                {marketingByBrand(form.brand).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {form.marketing_name && (
            <div className="form-row">
              <label>แบบ (Model Code) <span style={{ color: "#ef4444" }}>*</span></label>
              <select className="form-input" value={form.model_code}
                onChange={(e) => setForm({ ...form, model_code: e.target.value, color_name: "" })}>
                <option value="">-- เลือกแบบ --</option>
                {codesByMarketing(form.brand, form.marketing_name).map(m => (
                  <option key={m.model_code} value={m.model_code}>{m.model_code}</option>
                ))}
              </select>
            </div>
          )}

          {form.model_code && (
            <div className="form-row">
              <label>สี <span style={{ color: "#ef4444" }}>*</span></label>
              <select className="form-input" value={form.color_name}
                onChange={(e) => setForm({ ...form, color_name: e.target.value })}>
                <option value="">-- เลือกสี --</option>
                {colors.map(m => <option key={m.color_code} value={m.color_name}>{m.color_name}</option>)}
              </select>
            </div>
          )}

          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />

          <div className="form-row">
            <label>ชื่อลูกค้า <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="form-input" value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              placeholder="ชื่อ-นามสกุลลูกค้า" />
          </div>

          <div className="form-row">
            <label>เบอร์โทรศัพท์ <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="form-input" value={form.customer_phone} type="tel"
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              placeholder="0xx-xxx-xxxx" />
          </div>

          <div className="form-row">
            <label>ประเภทการซื้อ <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ display: "flex", gap: 24, marginTop: 4 }}>
              {PURCHASE_TYPES.map(t => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: "normal" }}>
                  <input type="radio" name="purchase_type" value={t}
                    checked={form.purchase_type === t}
                    onChange={(e) => setForm({ ...form, purchase_type: e.target.value })} />
                  {t}
                </label>
              ))}
            </div>
          </div>

          {form.purchase_type === "ผ่อน" && (
            <div className="form-row">
              <label>ไฟแนนท์</label>
              <input className="form-input" value={form.finance_company}
                onChange={(e) => setForm({ ...form, finance_company: e.target.value })}
                placeholder="ชื่อบริษัทไฟแนนท์" />
            </div>
          )}

          <div className="form-row">
            <label>เลขที่ใบมัดจำ</label>
            <input className="form-input" value={form.deposit_no}
              onChange={(e) => setForm({ ...form, deposit_no: e.target.value })}
              placeholder="เลขที่ใบมัดจำ" />
          </div>

          {message && <div className="form-message">{message}</div>}

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "💾 บันทึกการจอง"}
            </button>
            <button className="btn-secondary" onClick={() => { setMode("list"); setMessage(""); }}>ยกเลิก</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── LIST ── */
  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🏍️ ระบบจองรถจักรยานยนต์</h2>
        <button className="btn-primary" onClick={() => { setForm(emptyForm()); setMode("add"); setMessage(""); }}>
          + จองรถ
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
        {/* Row 1: dropdowns */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>📅</span>
            <input type="month" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
              style={{ padding: "5px 10px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "Tahoma", background: "#fff" }} />
            {filterDate && (
              <button onClick={() => setFilterDate("")}
                style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "#e2e8f0", cursor: "pointer", fontSize: 12, color: "#475569" }}>✕</button>
            )}
          </div>

          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "Tahoma", background: "#fff" }}>
            <option value="">ทุกสาขา</option>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select value={filterBrand} onChange={(e) => { setFilterBrand(e.target.value); setFilterMarketing(""); setFilterModelCode(""); setFilterColor(""); }}
            style={{ padding: "5px 10px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "Tahoma", background: "#fff" }}>
            <option value="">ทุกยี่ห้อ</option>
            {brandOpts.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select value={filterMarketing} onChange={(e) => { setFilterMarketing(e.target.value); setFilterModelCode(""); setFilterColor(""); }}
            style={{ padding: "5px 10px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "Tahoma", background: "#fff" }}>
            <option value="">ทุกรุ่น</option>
            {marketingOpts.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select value={filterModelCode} onChange={(e) => { setFilterModelCode(e.target.value); setFilterColor(""); }}
            style={{ padding: "5px 10px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "Tahoma", background: "#fff" }}>
            <option value="">ทุกแบบ</option>
            {modelCodeOpts.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "Tahoma", background: "#fff" }}>
            <option value="">ทุกสี</option>
            {colorOpts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {(filterDate || filterBranch || filterBrand || filterMarketing || filterModelCode || filterColor) && (
            <button onClick={() => { setFilterDate(""); setFilterBranch(""); setFilterBrand(""); setFilterMarketing(""); setFilterModelCode(""); setFilterColor(""); }}
              style={{ padding: "5px 12px", borderRadius: 10, border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
              🗑 ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* Row 2: status pills */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#94a3b8", marginRight: 2 }}>สถานะ:</span>
          {["all", "จอง", "รถถึงคิว", "ขาย", "ยกเลิก"].map((s) => (
            <button key={s} onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
              style={{
                padding: "4px 16px", borderRadius: 20, border: "none", cursor: "pointer",
                background: filterStatus === s ? (s === "รถถึงคิว" ? "#16a34a" : "#072d6b") : (s === "รถถึงคิว" ? "#dcfce7" : "#e2e8f0"),
                color: filterStatus === s ? "#fff" : (s === "รถถึงคิว" ? "#15803d" : "#475569"),
                fontFamily: "Tahoma", fontSize: 13, transition: "all 0.15s", fontWeight: s === "รถถึงคิว" ? 700 : 400,
              }}>
              {s === "all" ? "ทั้งหมด" : s === "รถถึงคิว" ? "🔔 รถถึงคิว" : s}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>
            {filtered.length} รายการ
          </span>
        </div>
      </div>

      {message && (
        <div style={{ padding: "10px 16px", background: "#fef3c7", borderRadius: 8, marginBottom: 14, color: "#92400e" }}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>ไม่มีรายการ</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ลำดับ</th>
                <th>วันที่จอง</th>
                <th>สาขา</th>
                <th>ยี่ห้อ</th>
                <th>ชื่อรุ่น</th>
                <th>แบบ</th>
                <th>สี</th>
                <th>ลูกค้า</th>
                {filterStatus === "ขาย" && <th>วันที่ขาย</th>}
                {filterStatus === "ขาย" && <th>ชื่อผู้ซื้อ</th>}
                {filterStatus === "ยกเลิก" && <th>เลขที่มัดจำ</th>}
                {filterStatus === "ยกเลิก" && <th>เงินมัดจำคงเหลือ</th>}
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((b, idx) => (
                <tr
                  key={b.booking_id}
                  className={hasDepositWarning(b) ? "row-deposit-warning" : ""}
                  style={
                    !hasDepositWarning(b) && isQueueReady(b) ? { background: "#f0fdf4" }
                    : filterStatus === "ขาย" && b.invoice_no && salesMap[b.invoice_no] && b.customer_name && salesMap[b.invoice_no].customer_name && (() => { const strip = (s) => s.toLowerCase().replace(/\s/g, "").replace(/^(นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.|mr\.|mrs\.|ms\.|mr|mrs|ms)/, "").replace(/[^a-zก-๙0-9]/g, ""); const n1 = strip(b.customer_name); const n2 = strip(salesMap[b.invoice_no].customer_name); return !n2.includes(n1) && !n1.includes(n2); })() ? { background: "#fef9c3" }
                    : {}
                  }
                >
                  <td style={{ textAlign: "center" }}>{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {b.booking_date ? new Date(b.booking_date).toLocaleDateString("th-TH") : "-"}
                  </td>
                  <td>{b.branch || "-"}</td>
                  <td>{b.brand || "-"}</td>
                  <td>{b.marketing_name || "-"}</td>
                  <td>{b.new_model_code || b.model_code || "-"}</td>
                  <td>{b.new_color_name || b.color_name || "-"}</td>
                  <td>{b.customer_name || "-"}</td>
                  {filterStatus === "ขาย" && (() => {
                    const sale = b.invoice_no ? salesMap[b.invoice_no] : null;
                    if (!b.invoice_no) return <><td>-</td><td>-</td></>;
                    if (!sale) return <><td colSpan={2} style={{ color: "#ef4444", fontSize: 12 }}>เลขที่ใบขายไม่ถูกต้อง</td></>;
                    return <>
                      <td style={{ whiteSpace: "nowrap" }}>{sale.sale_date ? new Date(sale.sale_date).toLocaleDateString("th-TH") : "-"}</td>
                      <td>{sale.customer_name || "-"}</td>
                    </>;
                  })()}
                  {filterStatus === "ยกเลิก" && (() => {
                    const dep = b.deposit_no ? depositMap[b.deposit_no] : null;
                    if (!b.deposit_no) return <><td style={{ color: "#9ca3af" }}>-</td><td style={{ color: "#9ca3af" }}>-</td></>;
                    if (!dep) return <><td style={{ color: "#9ca3af" }}>{b.deposit_no}</td><td style={{ color: "#9ca3af" }}>ไม่พบข้อมูล</td></>;
                    return <>
                      <td style={{ whiteSpace: "nowrap", color: dep.remaining_amount > 0 ? "#ef4444" : "#10b981", fontWeight: 600 }}>{b.deposit_no}</td>
                      <td style={{ textAlign: "right", color: dep.remaining_amount > 0 ? "#ef4444" : "#10b981", fontWeight: 600 }}>
                        {dep.remaining_amount > 0 ? "ยังไม่ตัดจ่าย " + dep.remaining_amount.toLocaleString() + " ฿" : "ตัดจ่ายแล้ว"}
                      </td>
                    </>;
                  })()}
                  <td>
                    <button onClick={() => setDetailTarget(b)} style={{
                      background: STATUS_COLOR[b.status] || "#d1d5db",
                      color: "#fff", padding: "3px 10px", borderRadius: 12, fontSize: 13, whiteSpace: "nowrap",
                      border: "none", cursor: "pointer", fontFamily: "Tahoma",
                    }}>
                        {STATUS_LABEL[b.status] || b.status}
                    </button>
                    {b.status === "ขาย" && b.invoice_no && (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>ใบขาย: {b.invoice_no}</div>
                    )}
                    {b.status === "จอง" && b.deposit_no && !depositMap[b.deposit_no] && (
                      <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3, fontWeight: 600 }}>เลขที่มัดจำไม่ถูกต้อง</div>
                    )}
                    {isQueueReady(b) && (() => {
                      const q = queuePosMap[b.booking_id];
                      return (
                        <div style={{ marginTop: 4 }}>
                          <span className="queue-ready-badge" style={{ flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                            <span>🔔 คิวที่ {q.pos}</span>
                            {q.engine_no && <span style={{ fontSize: 10 }}>เลขเครื่อง: {q.engine_no}</span>}
                            {q.age > 0 && <span style={{ fontSize: 10 }}>อายุ {q.age} วัน</span>}
                            {q.branch && <span style={{ fontSize: 10 }}>{q.branch}</span>}
                            {b.appointment_date && (
                              <span style={{ fontSize: 10, marginTop: 3, borderTop: "1px solid rgba(255,255,255,0.3)", paddingTop: 3 }}>
                                📅 {new Date(b.appointment_date).toLocaleDateString("th-TH")}
                                {b.appointment_note ? ` · ${b.appointment_note}` : ""}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })()}
                    {hasDepositWarning(b) && (
                      <div style={{ marginTop: 4 }}>
                        <span className="deposit-warn-badge">⚠ มัดจำค้างชำระ</span>
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {/* Refund status badge — only shown when paid (admin only) */}
                    {isAdmin && b.status === "ยกเลิก" && b.deposit_action === "คืนเงินมัดจำ" && Number(b.refund_amount) > 0 && b.refund_paid_at && (
                      <button
                        onClick={() => setDetailTarget(b)}
                        title={`จ่ายคืนแล้วเมื่อ ${new Date(b.refund_paid_at).toLocaleDateString("th-TH")} · ${b.refund_paid_doc_no || ""} (คลิกเพื่อดูรายละเอียด)`}
                        style={{
                          padding: "3px 10px",
                          background: "#16a34a",
                          color: "#fff", border: "none", borderRadius: 12,
                          cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                        }}>
                        ✓ จ่ายแล้ว
                      </button>
                    )}
                    {b.status === "ขาย" && isAdmin && (
                      <button onClick={() => { setEditInvoiceTarget(b); setEditInvoiceNo(b.invoice_no || ""); }}
                        style={{ padding: "3px 8px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                        ✏️ ใบขาย
                      </button>
                    )}
                    {b.status === "จอง" && (
                      <div style={{ display: "flex", gap: 4 }}>
                        {(() => {
                          const sellBlocked = !isAdmin && !isQueueReady(b);
                          return (
                            <button
                              onClick={() => !sellBlocked && setSellTarget(b)}
                              disabled={sellBlocked}
                              title={sellBlocked ? "ยังไม่ถึงคิว — ไม่สามารถลงขายได้" : ""}
                              style={{ padding: "3px 8px", background: sellBlocked ? "#d1d5db" : "#10b981", color: sellBlocked ? "#9ca3af" : "#fff", border: "none", borderRadius: 6, cursor: sellBlocked ? "not-allowed" : "pointer", fontSize: 12 }}>
                              ขาย
                            </button>
                          );
                        })()}
                        {(() => {
                          const blocked = !isAdmin && isQueueReady(b);
                          return (<>
                            <button
                              onClick={() => !blocked && (setChangeTarget(b), setChangeForm({ brand: b.brand || "", marketing_name: b.marketing_name || "", model_code: b.model_code || "", color_name: b.color_name || "" }))}
                              disabled={blocked}
                              style={{ padding: "3px 8px", background: blocked ? "#d1d5db" : "#f59e0b", color: blocked ? "#9ca3af" : "#fff", border: "none", borderRadius: 6, cursor: blocked ? "not-allowed" : "pointer", fontSize: 12 }}>
                              เปลี่ยน
                            </button>
                            <button
                              onClick={() => !blocked && handleCancelClick(b)}
                              disabled={blocked || checkingCancel}
                              style={{ padding: "3px 8px", background: blocked ? "#d1d5db" : "#ef4444", color: blocked ? "#9ca3af" : "#fff", border: "none", borderRadius: 6, cursor: (blocked || checkingCancel) ? "not-allowed" : "pointer", fontSize: 12 }}>
                              {checkingCancel ? "..." : "ยกเลิก"}
                            </button>
                          </>);
                        })()}
                        {isQueueReady(b) && (queuePosMap[b.booking_id]?.age ?? 0) > 3 && (
                          <button
                            onClick={() => { setAppointmentTarget(b); setAppointmentDate(b.appointment_date ? b.appointment_date.slice(0,10) : ""); setAppointmentNote(b.appointment_note || ""); }}
                            style={{ padding: "3px 8px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
                            📅 นัดหมาย{b.appointment_date ? " ✓" : ""}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination */}
          {filtered.length > pageSize && (() => {
            const totalPages = Math.ceil(filtered.length / pageSize);
            return (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, padding: "14px 0", flexWrap: "wrap" }}>
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                  style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: currentPage === 1 ? "#f3f4f6" : "#fff", cursor: currentPage === 1 ? "default" : "pointer", fontSize: 13, fontFamily: "Tahoma", color: "#374151" }}>
                  {"<<"}
                </button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: currentPage === 1 ? "#f3f4f6" : "#fff", cursor: currentPage === 1 ? "default" : "pointer", fontSize: 13, fontFamily: "Tahoma", color: "#374151" }}>
                  {"<"}
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "..." ? <span key={`dot-${i}`} style={{ padding: "4px 6px", fontSize: 13, color: "#9ca3af" }}>...</span> :
                    <button key={p} onClick={() => setCurrentPage(p)}
                      style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: currentPage === p ? "#072d6b" : "#fff", color: currentPage === p ? "#fff" : "#374151", cursor: "pointer", fontSize: 13, fontFamily: "Tahoma", fontWeight: currentPage === p ? 700 : 400 }}>
                      {p}
                    </button>
                  )}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: currentPage === totalPages ? "#f3f4f6" : "#fff", cursor: currentPage === totalPages ? "default" : "pointer", fontSize: 13, fontFamily: "Tahoma", color: "#374151" }}>
                  {">"}
                </button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                  style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: currentPage === totalPages ? "#f3f4f6" : "#fff", cursor: currentPage === totalPages ? "default" : "pointer", fontSize: 13, fontFamily: "Tahoma", color: "#374151" }}>
                  {">>"}
                </button>
                <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
                  หน้า {currentPage}/{totalPages} ({filtered.length} รายการ)
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Appointment Modal */}
      {appointmentTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0, color: "#6366f1" }}>📅 นัดหมายรับรถ</h3>
            <p style={{ margin: "0 0 16px" }}><strong>{appointmentTarget.customer_name}</strong> — {appointmentTarget.new_model_code || appointmentTarget.model_code} {appointmentTarget.new_color_name || appointmentTarget.color_name}</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>วันที่นัดหมาย *</label>
              <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>หมายเหตุ</label>
              <textarea value={appointmentNote} onChange={e => setAppointmentNote(e.target.value)}
                rows={3} placeholder="ระบุหมายเหตุ (ถ้ามี)"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSaveAppointment} disabled={saving || !appointmentDate}
                style={{ flex: 1, padding: "9px 0", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังบันทึก..." : "บันทึกนัดหมาย"}
              </button>
              <button onClick={() => { setAppointmentTarget(null); setAppointmentDate(""); setAppointmentNote(""); }}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {sellTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0, color: "#10b981" }}>✅ บันทึกขายรถจอง</h3>
            <p><strong>{sellTarget.customer_name}</strong> — {sellTarget.model_code} {sellTarget.color_name}</p>
            <p style={{ margin: "4px 0" }}>เลขมัดจำ: {sellTarget.deposit_no || "-"}</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>เลขที่ใบขาย *</label>
              <input
                value={sellInvoiceNo}
                onChange={e => setSellInvoiceNo(e.target.value)}
                placeholder="กรอกเลขที่ใบขาย"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 10, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }}
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSell} disabled={saving || !sellInvoiceNo.trim()}
                style={{ flex: 1, padding: "9px 0", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังบันทึก..." : "ยืนยันขาย"}
              </button>
              <button onClick={() => { setSellTarget(null); setSellInvoiceNo(""); }}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editInvoiceTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0, color: "#6366f1" }}>✏️ แก้ไขเลขที่ใบขาย</h3>
            <p style={{ margin: "4px 0 12px" }}><strong>{editInvoiceTarget.customer_name}</strong> — {editInvoiceTarget.model_code} {editInvoiceTarget.color_name}</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>เลขที่ใบขาย *</label>
              <input
                value={editInvoiceNo}
                onChange={e => setEditInvoiceNo(e.target.value)}
                placeholder="กรอกเลขที่ใบขาย"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 10, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }}
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleUpdateInvoice} disabled={saving || !editInvoiceNo.trim()}
                style={{ flex: 1, padding: "9px 0", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => { setEditInvoiceTarget(null); setEditInvoiceNo(""); }}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0 }}>ยืนยันการยกเลิกการจอง</h3>
            <p style={{ margin: "4px 0 12px" }}><strong>{cancelTarget.customer_name}</strong> — {cancelTarget.model_code} {cancelTarget.color_name}</p>

            {/* deposit action radio */}
            <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
              {["ยึดเงินมัดจำ", "คืนเงินมัดจำ"].map(opt => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: depositAction === opt ? 700 : 400 }}>
                  <input type="radio" name="depositAction" value={opt} checked={depositAction === opt}
                    onChange={() => setDepositAction(opt)} />
                  {opt}
                </label>
              ))}
            </div>

            {/* refund fields */}
            {depositAction === "คืนเงินมัดจำ" && (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>เลขที่บัญชีธนาคาร *</label>
                  <input value={refundForm.account_no} onChange={e => setRefundForm(f => ({ ...f, account_no: e.target.value }))}
                    placeholder="000-0-00000-0" style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>บัญชีธนาคาร *</label>
                  <select value={refundForm.bank} onChange={e => setRefundForm(f => ({ ...f, bank: e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 14 }}>
                    <option value="">-- เลือกธนาคาร --</option>
                    {["กรุงเทพ (BBL)", "กสิกรไทย (KBANK)", "กรุงไทย (KTB)", "ไทยพาณิชย์ (SCB)", "กรุงศรีอยุธยา (BAY)", "ทหารไทยธนชาต (TTB)", "ออมสิน", "ธ.ก.ส."].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>จำนวนเงิน (บาท) *</label>
                  <input type="number" value={refundForm.amount} onChange={e => setRefundForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0" style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>เหตุผลการยกเลิก</label>
              <textarea style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", resize: "vertical", boxSizing: "border-box" }}
                rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="ระบุเหตุผล (ถ้ามี)" />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleCancel} disabled={saving}
                style={{ flex: 1, padding: "9px 0", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
              </button>
              <button onClick={() => { setCancelTarget(null); setDepositAction("ยึดเงินมัดจำ"); setRefundForm({ account_no: "", bank: "", amount: "" }); }}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Model Modal */}
      {changeTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0, color: "#f59e0b" }}>🔄 เปลี่ยนแบบ + สี</h3>
            <p><strong>{changeTarget.customer_name}</strong></p>
            <p style={{ color: "#6b7280", fontSize: 13 }}>เดิม: {changeTarget.brand} {changeTarget.marketing_name} / {changeTarget.model_code} / {changeTarget.color_name}</p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>ยี่ห้อใหม่</label>
              <select style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}
                value={changeForm.brand}
                onChange={(e) => setChangeForm({ ...changeForm, brand: e.target.value, marketing_name: "", model_code: "", color_name: "" })}>
                <option value="">-- เลือกยี่ห้อ --</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>ชื่อรุ่นใหม่</label>
              <select style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}
                value={changeForm.marketing_name}
                onChange={(e) => setChangeForm({ ...changeForm, marketing_name: e.target.value, model_code: "", color_name: "" })}>
                <option value="">-- เลือกชื่อรุ่น --</option>
                {marketingByBrand(changeForm.brand).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>แบบใหม่</label>
              <select style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}
                value={changeForm.model_code}
                onChange={(e) => setChangeForm({ ...changeForm, model_code: e.target.value, color_name: "" })}>
                <option value="">-- เลือกแบบ --</option>
                {codesByMarketing(changeForm.brand, changeForm.marketing_name).map(m => (
                  <option key={m.model_code} value={m.model_code}>{m.model_code}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>สีใหม่</label>
              <select style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}
                value={changeForm.color_name}
                onChange={(e) => setChangeForm({ ...changeForm, color_name: e.target.value })}>
                <option value="">-- เลือกสี --</option>
                {colorsByCode(changeForm.brand, changeForm.model_code).map(m => (
                  <option key={m.color_code} value={m.color_name}>{m.color_name}</option>
                ))}
              </select>
            </div>

            {message && <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}>{message}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleChangeModel} disabled={saving}
                style={{ flex: 1, padding: "9px 0", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังบันทึก..." : "ยืนยันเปลี่ยน"}
              </button>
              <button onClick={() => { setChangeTarget(null); setMessage(""); }}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Detail Modal */}
      {detailTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDetailTarget(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>รายละเอียดการจอง</h3>
              <button onClick={() => setDetailTarget(null)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <tbody>
                {[
                  ["วันที่จอง", detailTarget.booking_date ? new Date(detailTarget.booking_date).toLocaleDateString("th-TH") : "-"],
                  ["สาขา", detailTarget.branch || "-"],
                  ["ยี่ห้อ", detailTarget.brand || "-"],
                  ["ชื่อรุ่น", detailTarget.marketing_name || "-"],
                  ["แบบ", detailTarget.new_model_code || detailTarget.model_code || "-"],
                  ["สี", detailTarget.new_color_name || detailTarget.color_name || "-"],
                  ["ลูกค้า", detailTarget.customer_name || "-"],
                  ["เบอร์โทร", detailTarget.customer_phone || "-"],
                  ["ประเภทการซื้อ", detailTarget.purchase_type || "-"],
                  ["เลขที่ใบมัดจำ", detailTarget.deposit_no || "-"],
                  ["ไฟแนนท์", detailTarget.finance_company || "-"],
                  ["สถานะ", STATUS_LABEL[detailTarget.status] || detailTarget.status || "-"],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ padding: "7px 10px", color: "#6b7280", fontWeight: 600, width: "40%", borderBottom: "1px solid #f3f4f6" }}>{label}</td>
                    <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6" }}>{value}</td>
                  </tr>
                ))}

                {/* ── ข้อมูลการยกเลิก (แสดงเฉพาะสถานะยกเลิก) ── */}
                {detailTarget.status === "ยกเลิก" && (
                  <>
                    <tr>
                      <td colSpan={2} style={{ padding: "10px 10px 4px", background: "#fef2f2", fontSize: 12, fontWeight: 700, color: "#dc2626", borderBottom: "1px solid #fca5a5" }}>
                        🚫 ข้อมูลการยกเลิก
                      </td>
                    </tr>
                    {[
                      ["ประเภทยกเลิก", detailTarget.deposit_action || "-"],
                      ["เหตุผล", detailTarget.cancel_reason || "-"],
                      ...(detailTarget.deposit_action === "คืนเงินมัดจำ" ? [
                        ["เลขที่บัญชี", detailTarget.refund_account_no || "-"],
                        ["ธนาคาร", detailTarget.refund_bank || "-"],
                        ["จำนวนเงิน", detailTarget.refund_amount ? Number(detailTarget.refund_amount).toLocaleString("th-TH") + " บาท" : "-"],
                        ...(detailTarget.refund_paid_at ? [
                          ["━━━ การจ่ายคืน ━━━", ""],
                          ["สถานะการจ่าย", <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ จ่ายคืนแล้ว</span>],
                          ["เลขที่เอกสารจ่าย", detailTarget.refund_paid_doc_no || "-"],
                          ["วันที่จ่าย", new Date(detailTarget.refund_paid_at).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })],
                          ["วิธีจ่าย", detailTarget.refund_payment_method || "-"],
                          ["จากบัญชี", (() => {
                            const acc = bankAccounts.find(a => String(a.account_id) === String(detailTarget.refund_from_bank_account_id));
                            return acc ? `${acc.bank_name} · ${acc.account_no} · ${acc.account_name}` : (detailTarget.refund_from_bank_account_id || "-");
                          })()],
                          ["ผู้บันทึกจ่าย", detailTarget.refund_paid_by || "-"],
                        ] : [
                          ["สถานะการจ่าย", <span style={{ color: "#dc2626", fontWeight: 700 }}>⏳ รอจ่ายคืน</span>],
                        ]),
                      ] : []),
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td style={{ padding: "7px 10px", color: "#6b7280", fontWeight: 600, width: "40%", borderBottom: "1px solid #f3f4f6", background: "#fff8f8" }}>{label}</td>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #f3f4f6", background: "#fff8f8" }}>{value}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>

            {/* ── ปุ่มบันทึกจ่ายคืนเงินมัดจำ (admin only + cancelled with refund) ── */}
            {isAdmin && detailTarget.status === "ยกเลิก" && detailTarget.deposit_action === "คืนเงินมัดจำ" && Number(detailTarget.refund_amount) > 0 && (
              <button onClick={() => setRefundTarget(detailTarget)}
                style={{ marginTop: 12, width: "100%", padding: "10px 0", background: detailTarget.refund_paid_at ? "#0891b2" : "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 700 }}
                title={detailTarget.refund_paid_at ? "แก้ไขข้อมูลการจ่ายคืน" : "บันทึกการจ่ายคืนเงินมัดจำ"}>
                {detailTarget.refund_paid_at ? "✏️ แก้ไขการจ่ายคืนเงินมัดจำ" : "💰 บันทึกจ่ายคืนเงินมัดจำ"}
              </button>
            )}

            <button onClick={() => setDetailTarget(null)}
              style={{ marginTop: 12, width: "100%", padding: "9px 0", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Refund Payment Dialog (admin) */}
      {refundTarget && (
        <RefundPaymentDialog
          booking={refundTarget}
          bankAccounts={bankAccounts}
          currentUser={currentUser}
          onClose={() => setRefundTarget(null)}
          onSaved={() => { setRefundTarget(null); setDetailTarget(null); fetchData(); }}
        />
      )}
      {/* Cancel Blocked Modal */}
      {cancelBlock && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🚫</div>
            <h3 style={{ margin: "0 0 12px", color: "#dc2626", fontSize: 18 }}>ยกเลิกการจองไม่ได้</h3>
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "14px 16px", marginBottom: 20, textAlign: "left" }}>
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: "#6b7280", fontSize: 13 }}>แบบ / สี:</span>{" "}
                <strong>{cancelBlock.model_code} / {cancelBlock.color_name}</strong>
              </div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
                ✅ รถคันนี้ <strong>มีในสต๊อก</strong><br />
                ✅ การจองนี้ <strong>เป็นคิวแรก</strong><br />
                <span style={{ color: "#dc2626", fontWeight: 600 }}>→ ไม่อนุญาตให้ยกเลิก</span>
              </div>
            </div>
            <button
              onClick={() => setCancelBlock(null)}
              style={{ width: "100%", padding: "10px 0", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
              รับทราบ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RefundPaymentDialog({ booking, bankAccounts, currentUser, onClose, onSaved }) {
  const isEdit = !!booking.refund_paid_at;
  const [form, setForm] = useState({
    paid_date: booking.refund_paid_at ? new Date(booking.refund_paid_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    payment_method: booking.refund_payment_method || "โอน",
    from_bank_account_id: booking.refund_from_bank_account_id || "",
    payment_note: booking.refund_payment_note || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refundAmount = Number(booking.refund_amount) || 0;

  async function handleSave() {
    if (!form.from_bank_account_id) { setError("เลือกบัญชีโอนจาก"); return; }
    setSaving(true);
    setError("");
    try {
      const body = {
        action: isEdit ? "edit_refund_payment" : "save_refund_payment",
        booking_id: booking.booking_id,
        deposit_no: booking.deposit_no,
        paid_date: form.paid_date,
        payment_method: form.payment_method,
        from_bank_account_id: Number(form.from_bank_account_id) || null,
        payment_note: form.payment_note,
        refund_amount: refundAmount,
        refund_account_no: booking.refund_account_no,
        refund_bank: booking.refund_bank,
        paid_by: currentUser?.username || currentUser?.name || "system",
      };
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save fail");
      onSaved();
    } catch (e) { setError("บันทึกไม่สำเร็จ: " + e.message); }
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
      onClick={() => !saving && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 540, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 14px", color: "#dc2626" }}>💰 {isEdit ? "แก้ไขการจ่ายคืนเงินมัดจำ" : "บันทึกจ่ายคืนเงินมัดจำ"}</h3>
        {isEdit && booking.refund_paid_doc_no && (
          <div style={{ marginBottom: 10, padding: 8, background: "#dcfce7", border: "1px solid #86efac", borderRadius: 6, fontSize: 13 }}>
            <b>เลขที่เอกสารจ่าย:</b> <code>{booking.refund_paid_doc_no}</code>
          </div>
        )}

        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
          <div><b>เลขที่ใบมัดจำ:</b> <code>{booking.deposit_no || "-"}</code></div>
          <div><b>ลูกค้า:</b> {booking.customer_name || "-"}</div>
          <div><b>โอนเข้าบัญชี:</b> {booking.refund_bank || "-"} · <code>{booking.refund_account_no || "-"}</code></div>
          <div style={{ marginTop: 6, fontSize: 16, color: "#dc2626" }}><b>จำนวนเงิน:</b> {refundAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</div>
        </div>

        {error && <div style={{ padding: 8, background: "#fee2e2", color: "#991b1b", borderRadius: 6, marginBottom: 10, fontSize: 13 }}>❌ {error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>วันที่จ่าย *</label>
            <input type="date" value={form.paid_date}
              onChange={e => setForm(p => ({ ...p, paid_date: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>วิธีจ่าย</label>
            <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))} style={inp}>
              <option value="โอน">โอน</option>
              <option value="เงินสด">เงินสด</option>
              <option value="เช็ค">เช็ค</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / span 2" }}>
            <label style={lbl}>โอนจาก (บัญชีบริษัท) *</label>
            <select value={form.from_bank_account_id} onChange={e => setForm(p => ({ ...p, from_bank_account_id: e.target.value }))} style={inp}>
              <option value="">-- เลือกบัญชี --</option>
              {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / span 2" }}>
            <label style={lbl}>หมายเหตุ</label>
            <textarea value={form.payment_note}
              onChange={e => setForm(p => ({ ...p, payment_note: e.target.value }))} rows={2} style={inp} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving || !form.from_bank_account_id}
            style={{ padding: "8px 24px", background: saving || !form.from_bank_account_id ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: saving || !form.from_bank_account_id ? "not-allowed" : "pointer", fontWeight: 700 }}>
            {saving ? "กำลังบันทึก..." : "💾 บันทึกจ่ายคืน"}
          </button>
        </div>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 };
const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
