import React, { useEffect, useMemo, useRef, useState } from "react";
import CustomerFormModal from "./CustomerFormModal";

// ============================================================================
// หน้า "มัดจำจองรถ" — บันทึกเงินมัดจำจองรถ (ตาราง booking_deposits)
// ----------------------------------------------------------------------------
// 1) เลือกลูกค้า 3 ทาง (เหมือนหน้าขายปลีก): ค้นหารวมหลายตาราง / พิมพ์เอง / QR LINE
// 2) ข้อมูลรถที่จอง: ยี่ห้อ → รุ่น → แบบ → type → สี (จาก master get_types/get_colors)
// 3) จำนวนเงินมัดจำ + วิธีรับชำระ (เงินสด/เงินโอน→เลือกบัญชี/อื่นๆ)
// กติกา: บันทึก/แก้ไขได้ แต่ยกเลิกไม่ได้ — ทำได้แค่ "คืนเงินมัดจำ" (เลือกวิธีคืน)
// backend: n8n webhook booking-deposit-api
//   (actions: search_customers / save_deposit / get_deposits / refund_deposit)
// ============================================================================
const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const DEPOSIT_API = `${BASE}/booking-deposit-api`;
const MASTER_API = `${BASE}/master-data-api`;
const ACC_API = `${BASE}/accounting-api`;
const RECEIPT_API = `${BASE}/receipt-requests-api`;
const URL_GET_CUSTOMERS = `${BASE}/moto-sales-get-customers`;
const MOTO_BOOKING_API = `${BASE}/moto-booking-api`; // สร้างใบจองในระบบจองรถอัตโนมัติหลังบันทึกมัดจำ

// QR → LINE LIFF (ลูกค้าสแกนแอดเพื่อน + กรอกข้อมูลเอง) — ตามสาขา เหมือนหน้าขายปลีก
const LIFF_PORPAO = "2010357741-OvPBYFXi";   // ป.เปา (SCY05/06)
const LIFF_SINGCHAI = "2010360709-hznV4KSo"; // สิงห์ชัย (SCY01/04/07)
const isPorpaoBranch = (bc) => { const c = String(bc || "").toUpperCase(); return c.startsWith("SCY05") || c.startsWith("SCY06"); };
const liffUrl = (refNo, branchCode) => { const porpao = isPorpaoBranch(branchCode); return `https://liff.line.me/${porpao ? LIFF_PORPAO : LIFF_SINGCHAI}?ref=${encodeURIComponent(refNo)}${porpao ? "" : "&oa=singchai"}`; };
const qrImageUrl = (data, size = 240) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;

// หัวกระดาษใบเสร็จ (fallback เมื่อยังโหลด branch_master ไม่ได้) — เหมือนใบเสร็จขายรถ
const LETTERHEAD = {
  HONDA: {
    name: "บริษัท ป.เปามอเตอร์เซอร์วิส จำกัด - สำนักงานใหญ่",
    addr: "189-191 ม.7 ต.ลำไทร อ.วังน้อย จ.พระนครศรีอยุธยา 13170",
    tel: "โทรศัพท์ : (035)271146-7   แฟกซ์ : (035) 272613",
    tax: "เลขประจำตัวผู้เสียภาษีอากร : 0145546000707   สำนักงานใหญ่",
  },
  YAMAHA: { name: "หจก. สิงห์ชัย สยามยนต์", addr: "", tel: "", tax: "" },
};
// โลโก้หัวใบเสร็จรายสาขา — SCY01/SCY04/SCY07 = YAMAHA, SCY05/SCY06 = ปีกนก HONDA
const BRANCH_LOGO = { SCY01: "yamaha", SCY04: "yamaha", SCY07: "yamaha", SCY05: "honda", SCY06: "honda" };
const LOGO_FILES = { yamaha: "/logos/yamaha.svg", honda: "/logos/honda-wing.svg" };

const baht = (v) =>
  v === "" || v === null || v === undefined
    ? "-"
    : Number(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thaiDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return raw.trim() ? JSON.parse(raw) : {};
}

const emptyForm = {
  deposit_no: "", deposit_date: todayISO(),
  customer_source: "", customer_code: "", customer_name: "", customer_phone: "",
  customer_address: "", customer_tax_id: "", line_user_id: "",
  brand: "", model_series: "", model_code: "", model_type: "", color_name: "",
  deposit_amount: "", payment_method: "เงินสด", payment_account: "",
  purchase_type: "สด", finance_company: "", note: "",
};

export default function BookingDepositPage({ currentUser }) {
  const [view, setView] = useState("form"); // form | history
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null); // แถวที่กำลังคืนเงิน

  // master data
  const [motoTypes, setMotoTypes] = useState([]);
  const [colors, setColors] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [branchMaster, setBranchMaster] = useState([]); // ข้อมูลสาขา (ชื่อสาขา/ที่อยู่/เบอร์/เลขภาษี) สำหรับหัวใบเสร็จ

  // history
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const branchCode = currentUser?.branch_code || currentUser?.branch || "";
  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, cl, ba, br] = await Promise.all([
          postJson(MASTER_API, { action: "get_types" }).catch(() => []),
          postJson(MASTER_API, { action: "get_colors" }).catch(() => []),
          postJson(ACC_API, { action: "list_bank_accounts", include_inactive: "false" }).catch(() => []),
          postJson(MASTER_API, { action: "get_branches" }).catch(() => []),
        ]);
        if (!alive) return;
        setMotoTypes((Array.isArray(t) ? t : []).filter((m) => m.status === "active" && m.model_status === "active" && m.series_status === "active" && m.brand_status === "active"));
        setColors((Array.isArray(cl) ? cl : []).filter((c) => c.status === "active"));
        setBankAccounts(Array.isArray(ba) ? ba : (ba?.data || []));
        setBranchMaster(Array.isArray(br) ? br.filter((x) => x && x.branch_code) : []);
      } catch { /* silent */ }
    })();
    loadRows();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadRows(kw = keyword, st = statusFilter) {
    setLoadingRows(true);
    try {
      const d = await postJson(DEPOSIT_API, { action: "get_deposits", keyword: kw, status: st });
      setRows(Array.isArray(d) ? d.filter((x) => x && x.deposit_no) : []);
    } catch { setRows([]); }
    setLoadingRows(false);
  }

  // ---------- cascading dropdown: ยี่ห้อ → รุ่น → แบบ → type → สี ----------
  const brands = useMemo(() => [...new Set(motoTypes.map((m) => m.brand_name).filter(Boolean))], [motoTypes]);
  const seriesOpts = useMemo(() => [...new Set(motoTypes.filter((m) => m.brand_name === form.brand).map((m) => m.series_name).filter(Boolean))], [motoTypes, form.brand]);
  const modelOpts = useMemo(() => [...new Set(motoTypes.filter((m) => m.brand_name === form.brand && m.series_name === form.model_series).map((m) => m.model_code).filter(Boolean))], [motoTypes, form.brand, form.model_series]);
  const typeOpts = useMemo(() => motoTypes.filter((m) => m.brand_name === form.brand && m.series_name === form.model_series && m.model_code === form.model_code), [motoTypes, form.brand, form.model_series, form.model_code]);
  const selectedType = typeOpts.find((m) => m.type_name === form.model_type);
  const colorOpts = useMemo(() => {
    if (!selectedType) return [];
    return colors.filter((c) => String(c.type_id) === String(selectedType.type_id));
  }, [colors, selectedType]);

  function pickCustomer(c) {
    setForm((f) => ({
      ...f,
      customer_source: c.source || "",
      customer_code: c.customer_code || c.code || "",
      customer_name: c.customer_name || c.name || "",
      customer_phone: c.customer_phone || c.phone || "",
      customer_address: c.customer_address || c.address || "",
      customer_tax_id: c.customer_tax_id || c.tax_id || "",
      line_user_id: c.line_user_id || "",
    }));
    setShowCustomerPicker(false);
  }

  async function save() {
    if (!form.customer_name.trim()) { setMessage("❌ กรุณาเลือก/กรอกข้อมูลลูกค้า"); return; }
    if (!form.brand) { setMessage("❌ เลือกยี่ห้อรถ"); return; }
    // บังคับเลือก Type เมื่อรุ่นที่เลือกมี type ให้เลือก — ไม่งั้นใบจองที่สร้างจะขาด type จับคิว/สต๊อกไม่ตรง
    if (typeOpts.length > 0 && !form.model_type) { setMessage("❌ เลือก Type ของรถ (เพื่อให้ระบบจองจับคิว/สต๊อกได้ถูก)"); return; }
    if (!(Number(String(form.deposit_amount).replace(/,/g, "")) > 0)) { setMessage("❌ กรอกจำนวนเงินมัดจำ"); return; }
    if (form.payment_method === "เงินโอน" && !form.payment_account) { setMessage("❌ เลือกบัญชีรับเงิน"); return; }
    setSaving(true); setMessage("");
    const isNew = !form.deposit_no; // ใบใหม่เท่านั้นที่สร้างใบจองอัตโนมัติ (กันจองซ้ำตอนแก้ไข)
    try {
      const r = await postJson(DEPOSIT_API, {
        action: "save_deposit",
        ...form,
        branch_code: branchCode,
        branch_name: currentUser?.branch || "",
        created_by: currentUser?.username || currentUser?.name || "system",
      });
      if (r && r.__error) throw new Error(r.__error);
      if (!r || !r.deposit_no) throw new Error(form.deposit_no ? "แก้ไขไม่สำเร็จ (รายการอาจถูกคืนเงินไปแล้ว)" : "ไม่ได้รับเลขที่มัดจำ");
      setForm((f) => ({ ...f, deposit_no: r.deposit_no }));
      loadRows();
      const extras = [];
      // ใบมัดจำใหม่ → สร้างใบจองในระบบจองรถจักรยานยนต์อัตโนมัติ (สถานะ "จอง" อ้างเลขมัดจำ)
      if (isNew) {
        try {
          await postJson(MOTO_BOOKING_API, {
            action: "save_moto_booking",
            branch: currentUser?.branch || branchCode,
            brand: form.brand,
            marketing_name: selectedType?.marketing_name || form.model_series,
            // ระบบจองรถ/สต๊อก (car_models, moto_stock) เก็บ "แบบ" เป็น "<model_code> <type>" (เว้นวรรค)
            // เช่น "AFS125CSBT TH" — ต้องส่ง type ต่อท้ายด้วย ไม่งั้นจับคู่สต๊อก/คิดคิวไม่ตรง (กลายเป็นคิวที่ 1 เสมอ)
            model_code: [form.model_code, form.model_type].filter(Boolean).join(" "),
            color_name: form.color_name,
            customer_name: form.customer_name,
            customer_phone: form.customer_phone,
            purchase_type: form.purchase_type || "สด",
            deposit_no: r.deposit_no,
            finance_company: form.purchase_type === "ผ่อน" ? form.finance_company : "",
          });
          extras.push("สร้างใบจองในระบบจองรถแล้ว 📋");
        } catch {
          extras.push("⚠️ สร้างใบจองอัตโนมัติไม่สำเร็จ (ไปกดจองเองที่ระบบจองรถ)");
        }
        // แจ้งมัดจำใหม่เข้ากลุ่ม LINE ป.เปา (เหมือนระบบจองคนขับรถ)
        try {
          await postJson(DEPOSIT_API, {
            action: "notify_deposit_group",
            deposit_no: r.deposit_no,
            deposit_date: thaiDate(form.deposit_date),
            customer_name: form.customer_name,
            customer_phone: form.customer_phone,
            car: carLabel(form),
            deposit_amount: form.deposit_amount,
            payment_method: form.payment_method,
            branch_name: currentUser?.branch || branchCode,
            created_by: currentUser?.username || currentUser?.name || "",
          });
          extras.push("แจ้งเข้ากลุ่ม LINE แล้ว 🔔");
        } catch {
          extras.push("⚠️ แจ้งกลุ่ม LINE ไม่สำเร็จ");
        }
      }
      // ลูกค้ามี LINE → ส่งใบเสร็จมัดจำเข้า LINE อัตโนมัติ (OA รายสาขา)
      if (form.line_user_id) {
        try {
          await postJson(DEPOSIT_API, {
            action: "send_deposit_flex",
            deposit_no: r.deposit_no,
            deposit_date: thaiDate(form.deposit_date),
            customer_name: form.customer_name,
            line_user_id: form.line_user_id,
            car: carLabel(form),
            deposit_amount: form.deposit_amount,
            payment_method: form.payment_method,
            payment_account: form.payment_account,
            branch_code: branchCode,
            branch_name: currentUser?.branch || "",
          });
          extras.push("ส่งใบเสร็จเข้า LINE ลูกค้าแล้ว 📲");
        } catch {
          extras.push("⚠️ ส่ง LINE ไม่สำเร็จ");
        }
      }
      setMessage(`✅ บันทึกมัดจำสำเร็จ — เลขที่ ${r.deposit_no}${extras.length ? " · " + extras.join(" · ") : ""}`);
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  function startNew() {
    setForm({ ...emptyForm, deposit_date: todayISO() });
    setMessage("");
    setView("form");
  }

  function editRow(r) {
    setForm({
      deposit_no: r.deposit_no, deposit_date: String(r.deposit_date || "").slice(0, 10) || todayISO(),
      customer_source: r.customer_source || "", customer_code: r.customer_code || "",
      customer_name: r.customer_name || "", customer_phone: r.customer_phone || "",
      customer_address: r.customer_address || "", customer_tax_id: r.customer_tax_id || "",
      line_user_id: r.line_user_id || "",
      brand: r.brand || "", model_series: r.model_series || "", model_code: r.model_code || "",
      model_type: r.model_type || "", color_name: r.color_name || "",
      deposit_amount: r.deposit_amount || "", payment_method: r.payment_method || "เงินสด",
      payment_account: r.payment_account || "",
      purchase_type: r.purchase_type || "สด", finance_company: r.finance_company || "",
      note: r.note || "",
    });
    setMessage("");
    setView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function doRefund(payload) {
    try {
      const r = await postJson(DEPOSIT_API, {
        action: "refund_deposit",
        deposit_no: refundTarget.deposit_no,
        ...payload,
        refunded_by: currentUser?.username || currentUser?.name || "system",
      });
      if (!r || !r.deposit_no) throw new Error("คืนเงินไม่สำเร็จ (รายการอาจถูกคืนเงินไปแล้ว)");
      // คืนเงินมัดจำแล้ว → ยกเลิกใบจองในระบบจองรถที่ผูกเลขมัดจำนี้ (ถ้ายังเป็น "จอง")
      let bookingMsg = "";
      try {
        const bks = await postJson(MOTO_BOOKING_API, { action: "get_moto_bookings" }).catch(() => []);
        const linked = (Array.isArray(bks) ? bks : []).find(b => b.deposit_no === r.deposit_no && b.status === "จอง");
        if (linked) {
          await postJson(MOTO_BOOKING_API, {
            action: "cancel_moto_booking",
            booking_id: linked.booking_id,
            cancel_reason: "คืนเงินมัดจำ",
            deposit_action: "คืนเงินมัดจำ",
            refund_account_no: payload.refund_account_no || "",
            refund_bank: payload.refund_bank || "",
            refund_amount: String(payload.refund_amount || r.refund_amount || "").replace(/,/g, ""),
          });
          bookingMsg = " · ยกเลิกใบจองในระบบจองรถแล้ว";
        }
      } catch { bookingMsg = " · ⚠️ ยกเลิกใบจองอัตโนมัติไม่สำเร็จ (ไปกดยกเลิกเองที่ระบบจองรถ)"; }
      setMessage(`✅ คืนเงินมัดจำ ${r.deposit_no} แล้ว (${r.refund_method || "-"} ${baht(r.refund_amount)} บาท)${bookingMsg}`);
      setRefundTarget(null);
      loadRows();
      if (form.deposit_no === r.deposit_no) startNew();
    } catch (e) {
      setMessage("❌ " + (e.message || e));
      setRefundTarget(null);
    }
  }

  const carLabel = (r) => [r.brand, r.model_series, r.model_code, r.model_type, r.color_name].filter(Boolean).join(" / ") || "-";

  // สร้างใบจองในระบบจองรถจากใบมัดจำ (ใช้ย้อนหลัง/กรณีสร้างอัตโนมัติพลาด) — กันสร้างซ้ำด้วย deposit_no
  async function createBookingFor(r) {
    if (!window.confirm(`สร้างใบจองในระบบจองรถจากมัดจำ ${r.deposit_no}?`)) return;
    setMessage("");
    try {
      const existing = await postJson(MOTO_BOOKING_API, { action: "get_moto_bookings" }).catch(() => []);
      if (Array.isArray(existing) && existing.some((b) => b.deposit_no === r.deposit_no && b.status === "จอง")) {
        setMessage(`⚠️ มีใบจองที่อ้างเลขมัดจำ ${r.deposit_no} อยู่แล้ว — ไม่สร้างซ้ำ`);
        return;
      }
      const t = motoTypes.find((m) => m.brand_name === r.brand && m.series_name === r.model_series && m.model_code === r.model_code && m.type_name === r.model_type);
      await postJson(MOTO_BOOKING_API, {
        action: "save_moto_booking",
        branch: r.branch_name || r.branch_code || currentUser?.branch || "",
        brand: r.brand,
        marketing_name: t?.marketing_name || r.model_series,
        // ต้องส่ง "<model_code> <type>" ให้ตรง car_models/moto_stock (ดู comment ใน save())
        model_code: [r.model_code, r.model_type].filter(Boolean).join(" "),
        color_name: r.color_name,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        purchase_type: r.purchase_type || "สด",
        deposit_no: r.deposit_no,
        finance_company: r.finance_company || "",
      });
      setMessage(`✅ สร้างใบจองจากมัดจำ ${r.deposit_no} แล้ว — ดูได้ที่ระบบจองรถจักรยานยนต์`);
    } catch (e) {
      setMessage("❌ สร้างใบจองไม่สำเร็จ: " + (e.message || e));
    }
  }

  // ---------- พิมพ์ใบเสร็จรับเงินมัดจำ (หน้าตาเหมือนใบเสร็จขายรถ) ----------
  // หัวกระดาษตามสาขาของเอกสาร — ชื่อสาขา/ที่อยู่/เบอร์/เลขภาษีจาก branch_master
  // โลโก้ตาม BRANCH_LOGO (SCY01/04/07=YAMAHA, SCY05/06=ปีกนก HONDA) ถ้าไม่รู้สาขาใช้ยี่ห้อรถแทน
  function letterheadFor(r) {
    const bc = String(r?.branch_code || r?.deposit_no || branchCode || "").substring(0, 5).toUpperCase();
    const brandUp = String(r?.brand || "").toUpperCase();
    const brandKey = brandUp.indexOf("YAMAHA") >= 0 || String(r?.brand || "").indexOf("ยามาฮ่า") >= 0 ? "YAMAHA" : "HONDA";
    const base = LETTERHEAD[brandKey] || LETTERHEAD.HONDA;
    const logoKind = BRANCH_LOGO[bc] || (brandKey === "YAMAHA" ? "yamaha" : "honda");
    const logo = (typeof window !== "undefined" ? window.location.origin : "") + LOGO_FILES[logoKind];
    const brandText = logoKind === "yamaha" ? "YAMAHA" : "HONDA";
    const b = branchMaster.find((x) => String(x.branch_code || "").toUpperCase() === bc);
    if (!b) return { ...base, logo, brandText };
    const tel = [b.phone ? `โทรศัพท์ : ${b.phone}` : "", b.mobile ? `มือถือ : ${b.mobile}` : ""].filter(Boolean).join("   ");
    return {
      name: b.branch_display_name || b.branch_name || base.name,
      addr: b.address || base.addr,
      tel: tel || base.tel,
      tax: b.tax_id ? `เลขประจำตัวผู้เสียภาษีอากร : ${b.tax_id}` : base.tax,
      logo, brandText,
    };
  }

  function buildDepositReceiptHtml(r) {
    const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const money = (n) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const lh = letterheadFor(r);
    const logoHtml = lh.logo
      ? `<img src="${esc(lh.logo)}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="ph" style="display:none">${esc(lh.brandText || "")}</div>`
      : `<div class="ph">${esc(lh.brandText || "")}</div>`;
    const carLine = [r.brand, r.model_series, r.model_code, r.model_type].filter(Boolean).join(" / ");
    const payLine = [r.payment_method, r.payment_account].filter(Boolean).join(" · ");
    const refunded = r.status === "refunded";
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ใบเสร็จมัดจำ ${esc(r.deposit_no)}</title>
<style>
*{font-family:"Sarabun","TH Sarabun New",Tahoma,sans-serif;box-sizing:border-box}
body{margin:0;padding:14px;color:#222;font-size:13px;background:#fff}
.wrap{max-width:800px;margin:0 auto}
.hdr{display:flex;align-items:flex-start;gap:12px;margin-bottom:6px}
.hdr .logo{width:120px;text-align:center;flex:none}.hdr .logo img{max-width:120px;max-height:72px}
.hdr .logo .ph{color:#e10600;font-weight:800;font-size:20px;border:2px solid #e10600;border-radius:6px;padding:8px 4px}
.hdr .co{flex:1}.hdr .co .nm{font-weight:700;font-size:15px;color:#111}.hdr .co div{font-size:12px;color:#555;margin-top:1px}
.hdr .ttl{text-align:center;width:160px;flex:none}.hdr .ttl .b{font-size:22px;font-weight:800;line-height:1}.hdr .ttl .o{color:#047857;font-weight:700;margin-top:3px}
table.bx{width:100%;border-collapse:collapse;margin-top:6px}
table.bx>tbody>tr>td{border:1px solid #047857;padding:5px 8px;font-size:12px;vertical-align:top}
.it{width:100%;border-collapse:collapse}.it td{border:1px solid #047857;padding:4px 8px;font-size:12px}
.sec{background:#e7f6ef;color:#0a6e4b;font-weight:700;text-align:center}
.lbl{color:#0a6e4b;font-weight:600}.r{text-align:right}.c{text-align:center}.val{font-weight:600}
.tot{font-size:15px;font-weight:800;color:#047857}
.refund{margin-top:8px;border:2px solid #dc2626;border-radius:6px;padding:6px 10px;color:#b91c1c;font-weight:700}
.foot{display:flex;justify-content:space-between;margin-top:46px;padding:0 30px}
.sg{text-align:center;width:40%;border-top:1px dotted #888;padding-top:4px;color:#666}
@media print{body{padding:0}}
</style></head><body><div class="wrap">

<div class="hdr">
  <div class="logo">${logoHtml}</div>
  <div class="co"><div class="nm">${esc(lh.name)}</div><div>${esc(lh.addr)}</div><div>${esc(lh.tel)}</div><div>${esc(lh.tax)}</div></div>
  <div class="ttl"><div class="b">ใบเสร็จรับเงิน</div><div>เงินมัดจำจองรถ</div><div class="o">(ต้นฉบับ)</div></div>
</div>

<table class="bx"><tr>
  <td style="width:62%"><div class="sec" style="margin:-5px -8px 5px;padding:3px">ชื่อลูกค้า/ที่อยู่</div>
    <div class="val">${esc(r.customer_name)}${r.customer_code ? ` <span style="color:#888;font-weight:400">(รหัส ${esc(r.customer_code)})</span>` : ""}</div>
    <div>${esc(r.customer_address || "")}</div>
    <div>${r.customer_tax_id ? "เลขประจำตัวผู้เสียภาษี : " + esc(r.customer_tax_id) : ""}${r.customer_phone ? `&nbsp;&nbsp;โทร : ${esc(r.customer_phone)}` : ""}</div>
  </td>
  <td style="padding:0"><table class="it" style="border:none">
    <tr><td class="sec">เลขที่ใบมัดจำ</td><td class="sec">วันที่</td></tr>
    <tr><td class="c val">${esc(r.deposit_no) || "-"}</td><td class="c">${esc(thaiDate(r.deposit_date))}</td></tr>
    <tr><td class="sec">สาขา</td><td class="sec">ผู้บันทึก</td></tr>
    <tr><td class="c">${esc(String(r.branch_code || "").substring(0, 5) || "-")}</td><td class="c">${esc(r.created_by || "")}</td></tr>
  </table></td>
</tr></table>

<table class="bx"><tr><td><span class="lbl">รถที่จอง : </span>${esc(carLine) || "-"}${r.color_name ? ` &nbsp; สี ${esc(r.color_name)}` : ""}</td></tr></table>

<table class="bx">
  <tr><td class="sec" style="width:8%">ลำดับ</td><td class="sec">รายละเอียด / ช่องทางรับชำระ</td><td class="sec" style="width:9%">จำนวน</td><td class="sec" style="width:15%">ราคา/หน่วย</td><td class="sec" style="width:15%">จำนวนเงิน</td></tr>
  <tr><td class="c">1</td><td>เงินมัดจำจองรถ${carLine ? " " + esc(carLine) : ""}${payLine ? " · " + esc(payLine) : ""}</td><td class="c">1</td><td class="r">${money(r.deposit_amount)}</td><td class="r">${money(r.deposit_amount)}</td></tr>
  <tr><td colspan="4" class="r tot">รวมรับชำระ</td><td class="r tot">${money(r.deposit_amount)} บาท</td></tr>
</table>
${r.note ? `<div style="margin-top:6px;font-size:12px">หมายเหตุ: ${esc(r.note)}</div>` : ""}
${refunded ? `<div class="refund">⚠ รายการนี้คืนเงินมัดจำแล้ว — ${esc(r.refund_method || "")} ${money(r.refund_amount)} บาท เมื่อ ${esc(thaiDate(r.refunded_at))}${r.refund_from_account ? ` จากบัญชี ${esc(r.refund_from_account)}` : ""}</div>` : ""}
<div class="foot"><div class="sg">ผู้รับเงิน</div><div class="sg">ผู้ชำระเงิน</div></div>
</div></body></html>`;
    return html;
  }

  function printDepositReceipt(r) {
    const html = buildDepositReceiptHtml(r);
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) { setMessage("❌ เปิดหน้าต่างพิมพ์ไม่ได้ (popup ถูกบล็อก)"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 350);
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 มัดจำจองรถ</h2>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, borderRadius: 6, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>}

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button onClick={() => setView("form")} style={tabBtn(view === "form")}>📝 บันทึกมัดจำ</button>
        <button onClick={() => { setView("history"); loadRows(); }} style={tabBtn(view === "history")}>📜 ค้นหา / ประวัติการมัดจำ</button>
      </div>

      {view === "form" && (
        <div style={{ ...cardSt, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ ...h3St, margin: 0 }}>
              {form.deposit_no ? `✏️ แก้ไขมัดจำ ${form.deposit_no}` : "➕ บันทึกมัดจำใหม่"}
            </h3>
            {form.deposit_no && <button onClick={startNew} style={btnGray}>＋ เริ่มรายการใหม่</button>}
          </div>

          {/* ---------- 1) ข้อมูลลูกค้า ---------- */}
          <div style={sectionSt}>
            <div style={sectionHead}>
              <span>👤 ข้อมูลลูกค้า</span>
              <button onClick={() => setShowCustomerPicker(true)} style={btnBlueSm}>🔍 เลือกลูกค้า (ค้นหา / เพิ่มใหม่ / QR LINE)</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <Field label="ชื่อลูกค้า *">
                <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} style={inp} />
              </Field>
              <Field label="เบอร์โทร">
                <input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} style={inp} />
              </Field>
              <Field label="เลขบัตร ปชช. / เลขผู้เสียภาษี">
                <input value={form.customer_tax_id} onChange={(e) => setForm({ ...form, customer_tax_id: e.target.value })} style={{ ...inp, fontFamily: "monospace" }} />
              </Field>
            </div>
            <Field label="ที่อยู่">
              <input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} style={inp} />
            </Field>
            {(form.customer_source || form.line_user_id) && (
              <div style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 12 }}>
                {form.customer_source && <span>ที่มา: <b>{form.customer_source}</b>{form.customer_code ? ` (${form.customer_code})` : ""}</span>}
                {form.line_user_id && <span style={{ color: "#059669" }}>✅ เชื่อม LINE แล้ว</span>}
              </div>
            )}
          </div>

          {/* ---------- 2) ข้อมูลรถที่จอง ---------- */}
          <div style={sectionSt}>
            <div style={sectionHead}><span>🏍️ ข้อมูลรถที่จอง</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              <Field label="ยี่ห้อ *">
                <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value, model_series: "", model_code: "", model_type: "", color_name: "" })} style={inp}>
                  <option value="">-- เลือก --</option>
                  {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="รุ่น">
                <select value={form.model_series} onChange={(e) => setForm({ ...form, model_series: e.target.value, model_code: "", model_type: "", color_name: "" })} style={inp} disabled={!form.brand}>
                  <option value="">-- เลือก --</option>
                  {seriesOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="แบบ">
                <select value={form.model_code} onChange={(e) => setForm({ ...form, model_code: e.target.value, model_type: "", color_name: "" })} style={inp} disabled={!form.model_series}>
                  <option value="">-- เลือก --</option>
                  {modelOpts.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label={`Type${typeOpts.length > 0 ? " *" : ""}`}>
                <select value={form.model_type} onChange={(e) => setForm({ ...form, model_type: e.target.value, color_name: "" })} style={inp} disabled={!form.model_code}>
                  <option value="">-- เลือก --</option>
                  {typeOpts.map((t) => <option key={t.type_id} value={t.type_name}>{t.type_name}</option>)}
                </select>
              </Field>
              <Field label="สี">
                {(typeOpts.length === 0 && colorOpts.length === 0) ? (
                  // รุ่นนี้ไม่มี Type/สีใน master → พิมพ์เอง (เคสหายาก)
                  <input value={form.color_name} onChange={(e) => setForm({ ...form, color_name: e.target.value })} style={inp} placeholder="พิมพ์สี" />
                ) : (
                  // เลือกจาก master เสมอ (กันพิมพ์สีผิด เช่น "ขาวตำ") — ปิดจนกว่าจะเลือก Type
                  <select value={form.color_name} onChange={(e) => setForm({ ...form, color_name: e.target.value })} style={inp} disabled={!selectedType}>
                    <option value="">{!selectedType ? "-- เลือก Type ก่อน --" : (colorOpts.length ? "-- เลือกสี --" : "-- ไม่มีสีใน master --")}</option>
                    {colorOpts.map((c) => <option key={c.color_id} value={c.color_name}>{c.color_name}{c.color_code ? ` (${c.color_code})` : ""}</option>)}
                    {form.color_name && !colorOpts.some((c) => c.color_name === form.color_name) && (
                      <option value={form.color_name}>{form.color_name} (เดิม)</option>
                    )}
                  </select>
                )}
              </Field>
            </div>
          </div>

          {/* ---------- 3) เงินมัดจำ + วิธีรับชำระ ---------- */}
          <div style={sectionSt}>
            <div style={sectionHead}><span>💵 เงินมัดจำ & การรับชำระ</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <Field label="วันที่มัดจำ">
                <input type="date" value={form.deposit_date} onChange={(e) => setForm({ ...form, deposit_date: e.target.value })} style={inp} />
              </Field>
              <Field label="จำนวนเงินมัดจำ (บาท) *">
                <input type="number" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} style={{ ...inp, textAlign: "right", fontWeight: 700 }} />
              </Field>
              <Field label="วิธีรับชำระ *">
                <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value, payment_account: "" })} style={inp}>
                  <option value="เงินสด">เงินสด</option>
                  <option value="เงินโอน">เงินโอน</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </Field>
              {form.payment_method === "เงินโอน" && (
                <Field label="บัญชีรับเงิน *">
                  <select value={form.payment_account} onChange={(e) => setForm({ ...form, payment_account: e.target.value })} style={inp}>
                    <option value="">-- เลือกบัญชี --</option>
                    {bankAccounts.filter((a) => a.account_type !== "เงินสดย่อย" && a.account_type !== "ลูกหนี้").map((a) => (
                      <option key={a.account_id} value={`${a.account_name}${a.account_no && a.account_no !== "-" ? ` · ${a.account_no}` : ""}${a.bank_name && a.bank_name !== "-" ? ` (${a.bank_name})` : ""}`}>
                        {a.account_name}{a.account_no && a.account_no !== "-" ? ` · ${a.account_no}` : ""}{a.bank_name && a.bank_name !== "-" ? ` (${a.bank_name})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="ประเภทการซื้อ *">
                <div style={{ display: "flex", gap: 18, paddingTop: 7 }}>
                  {["สด", "ผ่อน"].map((t) => (
                    <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                      <input type="radio" name="purchase_type" value={t} checked={form.purchase_type === t}
                        onChange={(e) => setForm({ ...form, purchase_type: e.target.value, finance_company: e.target.value === "ผ่อน" ? form.finance_company : "" })} />
                      {t}
                    </label>
                  ))}
                </div>
              </Field>
              {form.purchase_type === "ผ่อน" && (
                <Field label="ไฟแนนท์">
                  <input value={form.finance_company} onChange={(e) => setForm({ ...form, finance_company: e.target.value })} style={inp} placeholder="ชื่อบริษัทไฟแนนท์" />
                </Field>
              )}
            </div>
            <Field label="หมายเหตุ">
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={inp} />
            </Field>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={save} disabled={saving} style={btnGreen}>{saving ? "..." : "💾 บันทึกการมัดจำ"}</button>
            {form.deposit_no && (
              <button onClick={() => printDepositReceipt({ ...form, branch_code: branchCode, created_by: currentUser?.username || currentUser?.name || "" })} style={btnBlueSm}>
                🖨️ พิมพ์ใบเสร็จมัดจำ
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
            * บันทึกแล้วแก้ไขได้ แต่ยกเลิกไม่ได้ — ปิดรายการได้ทางเดียวคือ "คืนเงินมัดจำ" (อยู่ในแท็บประวัติ)
          </div>
        </div>
      )}

      {view === "history" && (
        <div style={cardSt}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadRows()}
              placeholder="ค้นหา เลขที่มัดจำ / ชื่อลูกค้า / เบอร์ / เลขบัตร" style={{ ...inp, maxWidth: 340 }} />
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); loadRows(keyword, e.target.value); }} style={{ ...inp, maxWidth: 170 }}>
              <option value="all">ทุกสถานะ</option>
              <option value="active">ใช้งาน (ยังไม่คืน)</option>
              <option value="refunded">คืนเงินแล้ว</option>
            </select>
            <button onClick={() => loadRows()} disabled={loadingRows} style={btnBlueSm}>{loadingRows ? "..." : "🔍 ค้นหา"}</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>เลขที่มัดจำ</th>
                  <th style={th}>วันที่</th>
                  <th style={th}>ลูกค้า</th>
                  <th style={th}>รถที่จอง</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอดมัดจำ</th>
                  <th style={th}>รับชำระ</th>
                  <th style={th}>สถานะ</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {loadingRows && <tr><td colSpan={9} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                {!loadingRows && rows.length === 0 && <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                {rows.map((r, i) => (
                  <tr key={r.deposit_no} style={{ borderTop: "1px solid #e5e7eb", opacity: r.status === "refunded" ? 0.6 : 1 }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>{r.deposit_no}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(r.deposit_date)}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.customer_name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{r.customer_phone || ""}{r.line_user_id ? " · LINE ✓" : ""}</div>
                    </td>
                    <td style={{ ...td, fontSize: 12 }}>{carLabel(r)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{baht(r.deposit_amount)}</td>
                    <td style={{ ...td, fontSize: 12 }}>{r.payment_method || "-"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {r.status === "refunded"
                        ? <span style={{ color: "#dc2626" }}>คืนเงินแล้ว<div style={{ fontSize: 11, color: "#9ca3af" }}>{r.refund_method || ""} {thaiDate(r.refunded_at)}</div></span>
                        : <span style={{ color: "#059669" }}>ใช้งาน</span>}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <button onClick={() => printDepositReceipt(r)} style={btnSmBlue} title="พิมพ์ใบเสร็จมัดจำ">🖨️</button>
                      {r.status !== "refunded" && (
                        <>
                          <button onClick={() => createBookingFor(r)} style={btnSmGreen} title="สร้างใบจองในระบบจองรถ">📋 สร้างใบจอง</button>
                          {isAdmin && (
                            <>
                              <button onClick={() => editRow(r)} style={btnSmYellow}>✏️ แก้ไข</button>
                              <button onClick={() => setRefundTarget(r)} style={btnSmRed}>↩️ คืนเงิน</button>
                            </>
                          )}
                        </>
                      )}
                      {r.status === "refunded" && (
                        <button onClick={() => editRow({ ...r })} style={btnSmGray} title="เปิดดูอย่างเดียว">👁️ ดู</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCustomerPicker && (
        <DepositCustomerPicker currentUser={currentUser} onSelect={pickCustomer} onClose={() => setShowCustomerPicker(false)} />
      )}
      {refundTarget && (
        <RefundModal row={refundTarget} bankAccounts={bankAccounts} onConfirm={doRefund} onClose={() => setRefundTarget(null)} />
      )}
    </div>
  );
}

// ============================================================================
// Modal เลือกลูกค้า — 3 แท็บ: ค้นหารวมทุกตาราง / เพิ่มลูกค้าใหม่ (ฟอร์มเต็ม) / QR LINE
// (โครงเดียวกับหน้าขายปลีก — เพิ่มลูกค้าใหม่ใช้ CustomerFormModal บันทึกเข้าฐานลูกค้าจริง)
// ============================================================================
function DepositCustomerPicker({ currentUser, onSelect, onClose }) {
  const [tab, setTab] = useState("search");

  // ประกอบที่อยู่จากฟิลด์ addr_* ของฟอร์มลูกค้า
  const composeAddress = (s) => [
    s.addr_house_no,
    s.addr_moo ? `หมู่ ${s.addr_moo}` : "",
    s.addr_village,
    s.addr_soi ? `ซ.${s.addr_soi}` : "",
    s.addr_road ? `ถ.${s.addr_road}` : "",
    s.addr_subdistrict ? `ต.${s.addr_subdistrict}` : "",
    s.addr_district ? `อ.${s.addr_district}` : "",
    s.addr_province ? `จ.${s.addr_province}` : "",
    s.addr_postal_code,
  ].filter(Boolean).join(" ").trim();

  // หลังบันทึกลูกค้าใหม่จากฟอร์มเต็ม → หา customer_id แล้วเลือกเข้าใบมัดจำเลย
  async function handleAddSaved(saved) {
    let code = saved.customer_id != null ? String(saved.customer_id) : "";
    if (!code) {
      try {
        const list = await postJson(URL_GET_CUSTOMERS, {});
        if (Array.isArray(list)) {
          const match = [...list].reverse().find((c) =>
            (saved.id_number && c.id_number === saved.id_number) ||
            (saved.phone && c.phone === saved.phone) ||
            (c.first_name === saved.first_name && c.last_name === saved.last_name)
          );
          if (match && match.customer_id != null) code = String(match.customer_id);
        }
      } catch { /* ignore — ใช้ข้อมูลที่กรอกแทน */ }
    }
    onSelect({
      source: "ฐานลูกค้า",
      customer_code: code,
      customer_name: [saved.title, saved.first_name, saved.last_name].filter(Boolean).join(" ").trim(),
      customer_phone: saved.phone || "",
      customer_address: composeAddress(saved),
      customer_tax_id: saved.id_number || "",
      line_user_id: "",
    });
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>เลือกลูกค้า</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#667085" }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[
            { k: "search", l: "🔍 ค้นหา (รวมทุกตาราง)" },
            { k: "add", l: "＋ เพิ่มลูกค้าใหม่" },
            { k: "qr", l: "📷 QR ให้ลูกค้ากรอกผ่าน LINE" },
          ].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} style={pickerTabBtn(tab === t.k)}>{t.l}</button>
          ))}
        </div>
        {tab === "search" && <CombinedSearchTab onSelect={onSelect} />}
        {tab === "add" && <CustomerFormModal onClose={() => setTab("search")} onSaved={handleAddSaved} />}
        {tab === "qr" && <QrLineTab currentUser={currentUser} onSelect={onSelect} />}
      </div>
    </div>
  );
}

// แท็บ 1: ค้นหาลูกค้ารวมหลายตาราง (customers + QR/LINE + ใบขายปลีก + ประวัติขาย)
function CombinedSearchTab({ onSelect }) {
  const [kw, setKw] = useState("");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [err, setErr] = useState("");

  async function search() {
    const q = kw.trim();
    if (!q) { setErr("กรอกคำค้นหา"); return; }
    setLoading(true); setErr(""); setSearched(true);
    try {
      const d = await postJson(DEPOSIT_API, { action: "search_customers", keyword: q });
      const arr = Array.isArray(d) ? d.filter((x) => x && x.customer_name) : [];
      // dedupe ด้วย ชื่อ+เบอร์ (ตารางต่าง ๆ อาจมีคนเดียวกัน) — เก็บแถวแรก (ใหม่สุด)
      const seen = new Set();
      const out = [];
      for (const c of arr) {
        const key = `${String(c.customer_name).replace(/\s+/g, "")}|${c.customer_phone || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(c);
      }
      setList(out);
    } catch (e) {
      setErr("ค้นหาไม่สำเร็จ: " + (e.message || e));
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <input autoFocus value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="ค้นหา ชื่อ / เบอร์โทร / เลขบัตร — รวมฐานลูกค้า, QR/LINE, ใบขายปลีก, ประวัติขาย" style={{ ...pInp, flex: 1 }} />
        <button onClick={search} disabled={loading} style={pPrimaryBtn}>{loading ? "..." : "🔍 ค้นหา"}</button>
      </div>
      {err && <div style={{ color: "#b42318", marginTop: 8 }}>{err}</div>}
      <div style={{ marginTop: 10, maxHeight: 360, overflowY: "auto", border: "1px solid #eaecf0", borderRadius: 8 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "#98a2b3" }}>กำลังค้นหา…</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#98a2b3" }}>{searched ? "ไม่พบลูกค้า" : "พิมพ์คำค้นหาแล้วกดค้นหา"}</div>
        ) : (
          list.map((c, i) => (
            <div key={i} onClick={() => onSelect(c)} style={rowItem}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 600 }}>{c.customer_name}</div>
                <span style={srcChip}>{c.source}</span>
              </div>
              <div style={{ fontSize: 12, color: "#667085", display: "flex", gap: 14, flexWrap: "wrap" }}>
                {c.customer_phone && <span>📞 {c.customer_phone}</span>}
                {c.customer_tax_id && <span>🪪 {c.customer_tax_id}</span>}
                {c.line_user_id && <span style={{ color: "#059669" }}>LINE ✓</span>}
              </div>
              {c.customer_address && <div style={{ fontSize: 12, color: "#98a2b3", marginTop: 2 }}>{c.customer_address}</div>}
            </div>
          ))
        )}
      </div>
      <div style={{ fontSize: 12, color: "#98a2b3", marginTop: 6 }}>{list.length} รายการ — คลิกเพื่อเลือก</div>
    </div>
  );
}

// พิมพ์ QR ให้ลูกค้าสแกน (กระดาษแผ่นเดียว: หัวเรื่อง + เลขอ้างอิง + QR ใหญ่ + วิธีใช้)
function printQrSheet(refNo, branchCode, branchName) {
  const qr = qrImageUrl(liffUrl(refNo, branchCode), 420);
  const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>QR ${esc(refNo)}</title>
<style>
*{font-family:"Sarabun","TH Sarabun New",Tahoma,sans-serif;box-sizing:border-box}
body{margin:0;padding:30px;text-align:center;color:#222}
h2{margin:0 0 4px}
.ref{font-size:20px;font-weight:800;font-family:monospace;margin:8px 0}
img{width:420px;max-width:90%;border:1px solid #ddd;border-radius:12px;padding:10px}
.hint{margin-top:14px;font-size:15px;color:#444;line-height:1.7}
.branch{margin-top:10px;color:#888;font-size:13px}
@media print{body{padding:10px}}
</style></head><body>
<h2>📷 สแกน QR ด้วยแอป LINE</h2>
<div>แอดเพื่อน + กรอกข้อมูลลูกค้าด้วยตัวเอง</div>
<div class="ref">${esc(refNo)}</div>
<img src="${esc(qr)}" onload="setTimeout(function(){window.print()},150)">
<div class="hint">1. เปิดแอป LINE แล้วสแกน QR นี้<br>2. กดเพิ่มเพื่อน (ถ้ายังไม่ได้เพิ่ม)<br>3. กรอกชื่อ-ที่อยู่-เบอร์โทร แล้วกดส่ง</div>
${branchName ? `<div class="branch">สาขา: ${esc(branchName)}</div>` : ""}
</body></html>`;
  const w = window.open("", "_blank", "width=560,height=760");
  if (!w) return false;
  w.document.write(html); w.document.close(); w.focus();
  return true;
}

// แท็บ 3: QR ให้ลูกค้าสแกนแอดเพื่อน + กรอกข้อมูลผ่าน LINE LIFF (โครงเดียวกับหน้าขายปลีก)
function QrLineTab({ currentUser, onSelect }) {
  const [refNo, setRefNo] = useState("");
  const [refInput, setRefInput] = useState("");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function createRef() {
    setLoading(true); setErr(""); setStatus(""); setRefNo("");
    try {
      const row = await postJson(RECEIPT_API, {
        action: "create_ref",
        created_by: currentUser?.username || currentUser?.name || "system",
        branch_code: currentUser?.branch_code || currentUser?.branch || "",
        branch_name: currentUser?.branch || "",
      });
      const r = Array.isArray(row) ? row[0] : row;
      if (!r || !r.ref_no) throw new Error(r?.error || "ไม่ได้รับเลขอ้างอิง");
      setRefNo(r.ref_no);
      setStatus("⏳ รอลูกค้าสแกน QR แอดเพื่อน + กรอกข้อมูล…");
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => check(r.ref_no, true), 4000);
    } catch (e) {
      setErr("สร้าง QR ไม่สำเร็จ: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function check(ref, silent) {
    try {
      const row = await postJson(RECEIPT_API, { action: "get_request", ref_no: ref || refNo || refInput.trim() });
      const r = Array.isArray(row) ? row[0] : row;
      if (r && (r.status === "filled" || r.status === "issued") && r.customer_name) {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus("✅ ลูกค้ากรอกข้อมูลแล้ว");
        onSelect({
          source: "QR/LINE", customer_code: r.ref_no || "",
          customer_name: r.customer_name, customer_phone: r.phone || "",
          customer_address: r.address || "", customer_tax_id: r.tax_id || "",
          line_user_id: r.line_user_id || "",
        });
      } else if (!silent) {
        setStatus("⏳ ลูกค้ายังไม่ได้กรอกข้อมูล");
      }
    } catch (e) {
      if (!silent) setErr("ตรวจสอบไม่สำเร็จ: " + (e.message || e));
    }
  }

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ textAlign: "left", marginBottom: 12 }}>
        <label style={pLbl}>มีเลขที่อ้างอิงอยู่แล้ว? กรอก/สแกนเพื่อดึงข้อมูลลูกค้า</label>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input value={refInput} onChange={(e) => setRefInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check(refInput.trim(), false)}
            placeholder="เช่น RC-20260610-0001" style={{ ...pInp, flex: 1 }} />
          <button onClick={() => check(refInput.trim(), false)} style={{ ...pPrimaryBtn, background: "#2563eb", whiteSpace: "nowrap" }}>🔍 ค้นหา</button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0", color: "#98a2b3", fontSize: 12 }}>
        <div style={{ flex: 1, height: 1, background: "#eaecf0" }} /> หรือสร้าง QR ใหม่ <div style={{ flex: 1, height: 1, background: "#eaecf0" }} />
      </div>
      {!refNo ? (
        <>
          <p style={{ color: "#667085" }}>กดสร้าง QR แล้วให้ลูกค้าสแกนด้วย LINE — ลูกค้าจะได้แอดเพื่อน OA และกรอกข้อมูลเอง</p>
          <button onClick={createRef} disabled={loading} style={pPrimaryBtn}>{loading ? "สร้าง…" : "📷 สร้าง QR ให้ลูกค้ากรอก"}</button>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{refNo}</div>
          <img src={qrImageUrl(liffUrl(refNo, currentUser?.branch_code || currentUser?.branch))} alt="QR" style={{ width: 240, height: 240, border: "1px solid #eaecf0", borderRadius: 8 }} />
          <div style={{ margin: "10px 0", color: status.startsWith("✅") ? "#067647" : "#b54708" }}>{status}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => check()} style={pSecondaryBtn}>🔄 ตรวจสอบตอนนี้</button>
            <button onClick={() => { if (!printQrSheet(refNo, currentUser?.branch_code || currentUser?.branch, currentUser?.branch || "")) setErr("เปิดหน้าต่างพิมพ์ไม่ได้ (popup ถูกบล็อก)"); }} style={{ ...pPrimaryBtn, background: "#2563eb" }}>🖨️ พิมพ์ QR</button>
          </div>
        </>
      )}
      {err && <div style={{ color: "#b42318", marginTop: 10 }}>{err}</div>}
    </div>
  );
}

// ============================================================================
// Modal คืนเงินมัดจำ — เลือกวิธีคืน (เงินสด / โอนเข้าบัญชี)
// โอน: ต้องเลือก "บัญชีบริษัทที่ใช้โอนคืน" + กรอกธนาคาร/เลขบัญชีของลูกค้า
// ============================================================================
function RefundModal({ row, bankAccounts = [], onConfirm, onClose }) {
  const [f, setF] = useState({
    refund_method: "เงินสด", refund_amount: row.deposit_amount || "",
    refund_from_account: "", refund_bank: "", refund_account_no: "", refund_note: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const accountLabel = (a) => `${a.account_name}${a.account_no && a.account_no !== "-" ? ` · ${a.account_no}` : ""}${a.bank_name && a.bank_name !== "-" ? ` (${a.bank_name})` : ""}`;

  async function confirm() {
    if (!(Number(String(f.refund_amount).replace(/,/g, "")) > 0)) { alert("กรอกจำนวนเงินคืน"); return; }
    if (f.refund_method === "โอนเข้าบัญชี") {
      if (!f.refund_from_account) { alert("เลือกบัญชีบริษัทที่ใช้โอนเงินคืน"); return; }
      if (!f.refund_bank.trim() || !f.refund_account_no.trim()) { alert("กรอกธนาคารและเลขบัญชีของลูกค้าให้ครบ"); return; }
    }
    if (!window.confirm(`ยืนยันคืนเงินมัดจำ ${row.deposit_no} จำนวน ${baht(f.refund_amount)} บาท?\n(คืนแล้วรายการจะปิด แก้ไขไม่ได้อีก)`)) return;
    setBusy(true);
    await onConfirm(f);
    setBusy(false);
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modal, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>↩️ คืนเงินมัดจำ</h3>
        <div style={{ fontSize: 13, color: "#667085", marginBottom: 12 }}>
          {row.deposit_no} — {row.customer_name} (ยอดมัดจำ {baht(row.deposit_amount)} บาท)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, alignItems: "center" }}>
          <label style={pLbl}>วิธีคืนเงิน</label>
          <select value={f.refund_method} onChange={set("refund_method")} style={pInp}>
            <option value="เงินสด">เงินสด</option>
            <option value="โอนเข้าบัญชี">โอนเข้าบัญชี</option>
          </select>
          <label style={pLbl}>จำนวนเงินคืน</label>
          <input type="number" value={f.refund_amount} onChange={set("refund_amount")} style={{ ...pInp, textAlign: "right" }} />
          {f.refund_method === "โอนเข้าบัญชี" && (
            <>
              <label style={pLbl}>บัญชีบริษัท (โอนจาก) *</label>
              <select value={f.refund_from_account} onChange={set("refund_from_account")} style={pInp}>
                <option value="">-- เลือกบัญชีบริษัท --</option>
                {bankAccounts.filter((a) => a.account_type !== "เงินสดย่อย" && a.account_type !== "ลูกหนี้").map((a) => (
                  <option key={a.account_id} value={accountLabel(a)}>{accountLabel(a)}</option>
                ))}
              </select>
              <label style={pLbl}>ธนาคารลูกค้า *</label>
              <input value={f.refund_bank} onChange={set("refund_bank")} style={pInp} placeholder="เช่น กสิกรไทย" />
              <label style={pLbl}>เลขบัญชีลูกค้า *</label>
              <input value={f.refund_account_no} onChange={set("refund_account_no")} style={{ ...pInp, fontFamily: "monospace" }} />
            </>
          )}
          <label style={pLbl}>หมายเหตุ</label>
          <input value={f.refund_note} onChange={set("refund_note")} style={pInp} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={pSecondaryBtn}>ยกเลิก</button>
          <button onClick={confirm} disabled={busy} style={{ ...pPrimaryBtn, background: "#dc2626" }}>{busy ? "..." : "↩️ ยืนยันคืนเงิน"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
const cardSt = { background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e5e7eb" };
const h3St = { margin: "0 0 12px", color: "#072d6b" };
const sectionSt = { border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 12 };
const sectionHead = { display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, color: "#072d6b", marginBottom: 10, flexWrap: "wrap", gap: 8 };
const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700 };
const td = { padding: "8px", fontSize: 13 };
const tabBtn = (active) => ({ padding: "9px 18px", fontSize: 14, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: active ? "none" : "1px solid #d1d5db", background: active ? "#072d6b" : "#fff", color: active ? "#fff" : "#374151" });
const btnGreen = { padding: "9px 20px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 14 };
const btnGray = { padding: "6px 12px", background: "#9ca3af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 };
const btnBlueSm = { padding: "6px 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 };
const btnSmBlue = { marginRight: 4, padding: "4px 10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnSmGreen = { marginRight: 4, padding: "4px 10px", background: "#059669", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnSmYellow = { marginRight: 4, padding: "4px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnSmRed = { padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnSmGray = { padding: "4px 10px", background: "#9ca3af", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
// picker modal styles
const overlay = { position: "fixed", inset: 0, background: "rgba(16,24,40,.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: "60px 16px", overflowY: "auto" };
const modal = { background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 560, boxShadow: "0 20px 40px rgba(0,0,0,.2)" };
const pInp = { width: "100%", padding: "9px 12px", fontSize: 15, border: "1px solid #d0d5dd", borderRadius: 8, boxSizing: "border-box" };
const pLbl = { fontSize: 14, color: "#344054" };
const rowItem = { padding: "10px 14px", borderBottom: "1px solid #f2f4f7", cursor: "pointer" };
const srcChip = { fontSize: 11, fontWeight: 700, color: "#175cd3", background: "#eff8ff", border: "1px solid #b2ddff", borderRadius: 999, padding: "1px 8px", whiteSpace: "nowrap", alignSelf: "flex-start" };
const pickerTabBtn = (active) => ({ flex: 1, padding: "8px 6px", fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: "pointer", border: active ? "none" : "1px solid #d0d5dd", background: active ? "#2563eb" : "#fff", color: active ? "#fff" : "#344054" });
const pPrimaryBtn = { padding: "10px 18px", fontSize: 15, fontWeight: 700, color: "#fff", background: "#2e9e4f", border: "none", borderRadius: 8, cursor: "pointer" };
const pSecondaryBtn = { padding: "8px 16px", fontSize: 14, fontWeight: 600, color: "#344054", background: "#fff", border: "1px solid #d0d5dd", borderRadius: 8, cursor: "pointer" };
