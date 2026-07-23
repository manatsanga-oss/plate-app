import React, { useState, useMemo, useEffect } from "react";
import CustomerPickerModal from "./CustomerPickerModal";

// ============================================================================
// หน้า "บันทึกขายปลีก"
// ----------------------------------------------------------------------------
// ค้นหารถจาก "สต๊อกที่รับเข้า" (vehicle_purchase_receipts_*) ด้วยหมายเลขเครื่อง
// หรือหมายเลขตัวถัง — แสดงเฉพาะคันที่ยังไม่ขาย (sold_at IS NULL)
//   • ถ้ายังไม่ขาย  -> กรอกใบขาย แล้วบันทึก (mark สต๊อกว่าขายแล้ว -> หายจากสต๊อก)
//   • ถ้าขายแล้ว    -> แสดงใบขายเดิม + ปุ่มยกเลิก (คืนรถเข้าสต๊อก)
//
// backend: n8n webhook retail-sale-api (actions: get_vehicle / save_sale / cancel_sale)
// ============================================================================
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const LINE_LOG_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-line-log";
const BOOKING_API = "https://n8n-new-project-gwf2.onrender.com/webhook/moto-booking-api";
const LINE_AUTO_SEND_DELAY = 10; // วินาทีก่อนส่ง LINE อัตโนมัติ

// หัวกระดาษใบขาย (fallback เมื่อยังโหลด branch_master ไม่ได้) — ปกติหัวกระดาษจริง
// ดึงจากหน้า "บันทึกข้อมูลสาขา" (branch_master: ชื่อสาขา/ที่อยู่/เบอร์/เลขภาษี) ตามสาขาของใบขาย
const LETTERHEAD = {
  HONDA: {
    name: "บริษัท ป.เปามอเตอร์เซอร์วิส จำกัด - สำนักงานใหญ่",
    addr: "189-191 ม.7 ต.ลำไทร อ.วังน้อย จ.พระนครศรีอยุธยา 13170",
    tel: "โทรศัพท์ : (035)271146-7   แฟกซ์ : (035) 272613",
    tax: "เลขประจำตัวผู้เสียภาษีอากร : 0145546000707   สำนักงานใหญ่",
    logo: "",
  },
  YAMAHA: {
    name: "หจก. สิงห์ชัย สยามยนต์",
    addr: "", tel: "", tax: "", logo: "",
  },
};
// โลโก้หัวใบเสร็จรายสาขา — SCY01/SCY04/SCY07 = YAMAHA, SCY05/SCY06 = ปีกนก HONDA
const BRANCH_LOGO = { SCY01: "yamaha", SCY04: "yamaha", SCY07: "yamaha", SCY05: "honda", SCY06: "honda" };
const LOGO_FILES = { yamaha: "/logos/yamaha.svg", honda: "/logos/honda-wing.svg" };
const GIVEAWAY_API = "https://n8n-new-project-gwf2.onrender.com/webhook/giveaway-rules-api";
const STOCK_SEARCH_API = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-search";

const TEAL = "#54b0b8";
const FIELD_BG = "#e9eef0";

const FINANCE_OPTIONS = [
  { value: "none", label: "ไม่จัดไฟแนนซ์" },
  { value: "moto", label: "จัดไฟแนนซ์" },
];
const isFinance = (v) => v === "moto" || v === "moto_kit" || v === "full";

// ของแถมประเภท "เงินดาวน์ออกแทน" — ไม่ใส่ในรายการแถม แต่ไปบวกเป็นส่วนลด
const isDownPaymentSub = (name) => {
  const n = String(name || "").replace(/\s+/g, "");
  return n.includes("เงินดาวน์ออกแทน") || n.includes("ดาวน์ออกแทน");
};

const text = (v) => (v ?? "").toString().trim();
const num = (v) => {
  const n = Number(String(v).replace(/,/g, ""));
  return isFinite(n) ? n : 0;
};
const baht = (v) =>
  v === "" || v === null || v === undefined
    ? "-"
    : Number(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const thaiDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
};

async function apiPost(payload) {
  const res = await fetch(RETAIL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  const data = raw.trim() ? JSON.parse(raw) : {};
  return Array.isArray(data) ? data[0] : data;
}

const blankForm = (currentUser) => ({
  sale_date: todayISO(),
  customer_code: "",
  customer_name: "",
  customer_province: "",
  customer_line_user_id: "",
  customer_address: "",
  customer_tax_id: "",
  customer_phone: "",
  customer_birthdate: "",
  customer_gender: "",
  seller: currentUser?.username || currentUser?.name || "",
  note: "",
  finance_type: "none",
  car_price: "",
  discount: "",
  other_sale: "",
  down_payment: "",
  booking_deposit: "",
  deposit_no: "",
  finance_company_code: "",
  finance_company_name: "",
  interest_rate: "1.09",
  installments: "",
  finance_note: "",
});

export default function RetailSalePage({ currentUser }) {
  const [keyword, setKeyword] = useState("");
  const [suggestions, setSuggestions] = useState([]);   // ผลค้นหาจาก moto_stock (สินค้าคงเหลือ)
  const [showSuggest, setShowSuggest] = useState(false);
  const [searchingStock, setSearchingStock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [vehicle, setVehicle] = useState(null); // ข้อมูลรถจากสต๊อก + sale (ถ้ามี)
  const [mode, setMode] = useState(null); // "new" | "view" | "sold_other"
  const [form, setForm] = useState(blankForm(currentUser));
  const [showCustomer, setShowCustomer] = useState(false);

  // ===== Master data สำหรับค้นหา "ราคาประกาศ" จากรุ่นรถ (เหมือนหน้าคำนวณราคารถ) =====
  const [motoTypes, setMotoTypes] = useState([]);
  const [motoSeries, setMotoSeries] = useState([]);
  const [priceTypes, setPriceTypes] = useState([]);
  const [prices, setPrices] = useState([]);
  const [financeCompanies, setFinanceCompanies] = useState([]);
  const [markups, setMarkups] = useState([]);
  const [saleExpenses, setSaleExpenses] = useState([]);
  const [colors, setColors] = useState([]);
  const [productGiveaways, setProductGiveaways] = useState([]); // จาก giveaway_rules (สินค้าที่แถม)
  const [selectedProductGiveaways, setSelectedProductGiveaways] = useState({}); // {rule_id: true}
  const [reloadingGiveaways, setReloadingGiveaways] = useState(false);

  async function reloadGiveaways() {
    try {
      setReloadingGiveaways(true);
      const se = await fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_sale_expenses" }) }).then((r) => r.json()).catch(() => []);
      setSaleExpenses(Array.isArray(se) ? se.filter((x) => x.expense_type === "promotion" && x.status === "active") : []);
    } finally { setReloadingGiveaways(false); }
  }
  const [selectedGiveaways, setSelectedGiveaways] = useState({}); // {expense_id: true}
  // รับชำระเงิน
  const [bankAccounts, setBankAccounts] = useState([]);
  const [payForm, setPayForm] = useState({ receipt_date: "", note: "" });
  const [payLines, setPayLines] = useState([{ method: "เงินสด", account_id: "", amount: "" }]);
  const [payingSave, setPayingSave] = useState(false);
  const [lineSending, setLineSending] = useState(""); // "" | "sale" | "receipt"
  // ===== Countdown auto-send LINE =====
  // pending = { type, label, seconds, sendFn, timerId, saleNo }
  const [linePending, setLinePending] = useState(null);
  // log status ของแต่ละ type (แสดงในปุ่ม) — { sale: 'sent'|'failed'|'cancelled', act: ..., cosmos: ..., receipt: ... }
  const [lineStatus, setLineStatus] = useState({});

  async function logLineSend(saleNo, type, status, errorMsg) {
    if (!saleNo) return;
    setLineStatus((s) => ({ ...s, [type]: status }));
    try {
      await fetch(LINE_LOG_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sale_no: saleNo, type, status, error: errorMsg || "", by: currentUser?.name || currentUser?.username || "" }),
      });
    } catch {}
  }

  function cancelLinePending() {
    if (linePending?.timerId) clearInterval(linePending.timerId);
    if (linePending) {
      const { type, saleNo } = linePending;
      logLineSend(saleNo, type, "cancelled");
      setMessage(`⚠️ ยกเลิกการส่ง LINE: ${linePending.label}`);
    }
    setLinePending(null);
  }

  function scheduleLineSend(type, label, sendFn, saleNo) {
    // ถ้ามีคิวอยู่แล้ว → ยกเลิกอันเดิมก่อน (ไม่ log เพราะถูก override)
    if (linePending?.timerId) clearInterval(linePending.timerId);
    let s = LINE_AUTO_SEND_DELAY;
    const tick = setInterval(() => {
      s -= 1;
      setLinePending((p) => p ? { ...p, seconds: s } : p);
      if (s <= 0) {
        clearInterval(tick);
        setLinePending(null);
        sendFn()
          .then(() => logLineSend(saleNo, type, "sent"))
          .catch((e) => logLineSend(saleNo, type, "failed", String(e?.message || e).slice(0, 200)));
      }
    }, 1000);
    setLinePending({ type, label, seconds: s, timerId: tick, saleNo });
  }
  // cleanup interval on unmount
  useEffect(() => () => { if (linePending?.timerId) clearInterval(linePending.timerId); }, [linePending?.timerId]);
  const [actFile, setActFile] = useState(null);       // ไฟล์ PDF เอกสาร พ.ร.บ.
  const [actUploading, setActUploading] = useState(false);
  const [cosmosFile, setCosmosFile] = useState(null); // ไฟล์ PDF ใบสมัครฮอนด้าพลัส (COSMOS)
  const [cosmosUploading, setCosmosUploading] = useState(false);
  const [docFile, setDocFile] = useState(null);       // ไฟล์ PDF เอกสารอื่น ๆ ส่งให้ลูกค้า (เช่น ประกันรถหาย)
  const [docUploading, setDocUploading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [allDeposits, setAllDeposits] = useState([]);
  const [showBookingPicker, setShowBookingPicker] = useState(false);
  const [bookingBranchFilter, setBookingBranchFilter] = useState("");
  const [bookingColorFilter, setBookingColorFilter] = useState("");

  // ===== รายการปรับแต่ง (ค่านำพา / เงินดาวน์ออกแทน / ประกันออกแทน) =====
  const [useDeliveryFee, setUseDeliveryFee] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [useDownPayout, setUseDownPayout] = useState(false);
  const [downPayout, setDownPayout] = useState(0);
  // ประกันรถหาย (ลูกค้าจ่าย · ไฟแนนซ์หักเบี้ยจากยอดโอนค่ารถ) — ไม่บวกเข้าราคารถ
  // เป็นประกันที่ไฟแนนซ์ดำเนินการเอง (ไม่ใช่คอสมอส/ล็อคตั้น) → กรอกเบี้ยตรง ๆ ไม่ต้องค้นระบบ
  const [theftInsManual, setTheftInsManual] = useState("");
  const [installmentOverride, setInstallmentOverride] = useState(""); // ยอดผ่อน/งวด แก้เองได้ (ว่าง = ใช้ค่าที่คำนวณ)
  const [installmentRound, setInstallmentRound] = useState(false); // false = ไม่ปัด, true = ปัดขึ้นเป็นทวีคูณของ 5 (ลงท้าย 0/5)
  const [installmentTouched, setInstallmentTouched] = useState(false);
  const [advanceOverride, setAdvanceOverride] = useState(""); // ค่างวดจ่ายล่วงหน้า — กรอกเอง (ไม่ default)
  const [selectedTypeId, setSelectedTypeId] = useState(""); // เผื่อ model_code ตรงหลายแถว
  const [branchMaster, setBranchMaster] = useState([]); // ข้อมูลสาขา (ชื่อสาขา/ที่อยู่/เบอร์/เลขภาษี) สำหรับหัวใบเสร็จ
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, s, pt, p, fc, m, se, cl, br] = await Promise.all([
          fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_types" }) }).then((r) => r.json()).catch(() => []),
          fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_series" }) }).then((r) => r.json()).catch(() => []),
          fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_price_types" }) }).then((r) => r.json()).catch(() => []),
          fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_moto_prices" }) }).then((r) => r.json()).catch(() => []),
          fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_finance_companies" }) }).then((r) => r.json()).catch(() => []),
          fetch(ACC_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_price_markups" }) }).then((r) => r.json()).catch(() => []),
          fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_sale_expenses" }) }).then((r) => r.json()).catch(() => []),
          fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_colors" }) }).then((r) => r.json()).catch(() => []),
          fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_branches" }) }).then((r) => r.json()).catch(() => []),
        ]);
        if (!alive) return;
        setMotoTypes((Array.isArray(t) ? t : []).filter((m) => m.status === "active" && m.model_status === "active" && m.series_status === "active" && m.brand_status === "active"));
        setMotoSeries(Array.isArray(s) ? s : []);
        setPriceTypes(Array.isArray(pt) ? pt.filter((p) => p.status === "active") : []);
        setPrices(Array.isArray(p) ? p : []);
        setFinanceCompanies(Array.isArray(fc) ? fc.filter((x) => x.status === "active") : []);
        setMarkups((Array.isArray(m) ? m : []).filter((x) => x.status === "active"));
        setSaleExpenses(Array.isArray(se) ? se.filter((x) => x.expense_type === "promotion" && x.status === "active") : []);
        setColors(Array.isArray(cl) ? cl.filter((x) => x.status === "active") : []);
        setBranchMaster(Array.isArray(br) ? br.filter((x) => x && x.branch_code) : []);
      } catch { /* silent */ }
    })();
    return () => { alive = false; };
  }, []);

  // โหลดบัญชีธนาคาร (สำหรับเลือกบัญชีรับเงิน)
  useEffect(() => {
    let alive = true;
    fetch(ACC_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }) })
      .then((r) => r.json()).then((d) => { if (alive) setBankAccounts(Array.isArray(d) ? d : (d?.data || [])); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // ดึงรายการจอง + เงินมัดจำ (ใช้ตอนเลือก "เงินจอง")
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [bks, deps] = await Promise.all([
          fetch(BOOKING_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_moto_bookings" }) }).then((r) => r.json()).catch(() => []),
          fetch(BOOKING_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_all_deposits" }) }).then((r) => r.json()).catch(() => []),
        ]);
        if (!alive) return;
        setBookings(Array.isArray(bks) ? bks : []);
        setAllDeposits(Array.isArray(deps) ? deps : []);
      } catch { /* silent */ }
    })();
    return () => { alive = false; };
  }, []);

  // brand ใน stock เก็บเป็น "HONDA"/"YAMAHA" แต่ใน types เก็บเป็น "ฮอนด้า"/"ยามาฮ่า"
  const normBrand = (b) => {
    const s = String(b || "").toLowerCase();
    if (s.includes("honda") || s.includes("ฮอนด้า")) return "honda";
    if (s.includes("yamaha") || s.includes("ยามาฮ่า")) return "yamaha";
    return s;
  };
  // หา base (แบบ) + typeHint (type) สำหรับ match master
  const parsedModel = useMemo(() => {
    if (!vehicle?.model_code) return { base: "", typeHint: "" };
    const raw = String(vehicle.model_code).toUpperCase().trim();
    // ข้อมูล normalize แล้ว: model_code = แบบ เต็ม ๆ, model_type = type ตรง ๆ → ใช้เลย (ไม่ต้องแยก)
    const mt = String(vehicle.model_type || "").toUpperCase().trim();
    if (mt) return { base: raw, typeHint: mt };
    // legacy fallback (ข้อมูลเก่าที่ type ฝังใน model_code):
    // 1) "BASE (TYPE)" — มีวงเล็บ
    const inParen = raw.match(/^(.+?)\s*\((.+)\)\s*$/);
    if (inParen) return { base: inParen[1].trim(), typeHint: inParen[2].trim() };
    // 2) "BASE TYPE" — เว้นวรรค ไม่มีวงเล็บ
    const parts = raw.split(/\s+/);
    if (parts.length > 1) return { base: parts[0], typeHint: parts.slice(1).join(" ").trim() };
    return { base: raw, typeHint: "" };
  }, [vehicle]);

  // type rows ที่ match กับรถปัจจุบัน (brand + model_code base)
  const matchedTypes = useMemo(() => {
    if (!parsedModel.base) return [];
    const vb = normBrand(vehicle?.brand);
    return motoTypes.filter((m) => normBrand(m.brand_name) === vb && String(m.model_code || "").toUpperCase().trim() === parsedModel.base);
  }, [motoTypes, vehicle, parsedModel.base]); // eslint-disable-line react-hooks/exhaustive-deps

  // โหลดของแถม-สินค้า (จาก giveaway_rules) เมื่อ selectedTypeId เปลี่ยน — รวมทั้ง 3 ระดับ (brand/series/type)
  useEffect(() => {
    if (!selectedTypeId) { setProductGiveaways([]); return; }
    let alive = true;
    fetch(GIVEAWAY_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "list_for_type", type_id: Number(selectedTypeId) }) })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const rows = Array.isArray(data) ? data : (data?.data || []);
        setProductGiveaways(rows.filter((r) => r && r.id));
        // auto-tick ทุกรายการ (สมมุติให้ลูกค้าทุกคนได้ ถ้าไม่ต้องการให้ untick)
        setSelectedProductGiveaways(Object.fromEntries(rows.filter(r => r && r.id).map(r => [r.id, true])));
      })
      .catch(() => { if (alive) { setProductGiveaways([]); setSelectedProductGiveaways({}); } });
    return () => { alive = false; };
  }, [selectedTypeId]);

  // เลือก type อัตโนมัติเมื่อ match ได้ — ใช้ typeHint จาก stock ถ้ามี
  useEffect(() => {
    if (matchedTypes.length === 0) { setSelectedTypeId(""); return; }
    const hit = parsedModel.typeHint && matchedTypes.find((m) => String(m.type_name || "").toUpperCase().trim() === parsedModel.typeHint);
    if (hit) setSelectedTypeId(String(hit.type_id));
    else if (!matchedTypes.find((m) => String(m.type_id) === String(selectedTypeId))) setSelectedTypeId(String(matchedTypes[0].type_id));
  }, [matchedTypes, parsedModel.typeHint]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== ราคาประกาศ ณ วันจอง — ลูกค้าจองไว้ก่อนปรับราคา ต้องคิดราคาวันที่จอง ไม่ใช่ราคาปัจจุบัน =====
  // รู้ว่าเป็นลูกค้าจองจากการเลือก "เงินจอง" (form.deposit_no) → หา booking_date → ดึงราคาทั้งตาราง ณ วันนั้น (get_moto_prices รองรับ as_of)
  const selectedBooking = useMemo(
    () => (form.deposit_no ? bookings.find((b) => b.deposit_no === form.deposit_no) || null : null),
    [form.deposit_no, bookings]
  );
  const bookingDateISO = selectedBooking?.booking_date ? String(selectedBooking.booking_date).slice(0, 10) : "";
  const [bookingPrices, setBookingPrices] = useState(null); // ตารางราคา ณ วันจอง (null = ใช้ราคาปัจจุบัน)
  useEffect(() => {
    if (!bookingDateISO) { setBookingPrices(null); return; }
    let alive = true;
    fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_moto_prices", as_of: bookingDateISO }) })
      .then((r) => r.json())
      .then((d) => { if (alive) setBookingPrices(Array.isArray(d) && d.length ? d : null); })
      .catch(() => { if (alive) setBookingPrices(null); });
    return () => { alive = false; };
  }, [bookingDateISO]);

  // หา "ราคาประกาศ" ตาม finance_type + branch
  const branchCode = currentUser?.branch_code || currentUser?.branch || "";
  const branchGroup = ["SCY05", "SCY06"].includes(String(branchCode).substring(0, 5)) ? "ป.เปา" : "สิงห์ชัย";
  const usingBookingPrice = !!(bookingDateISO && bookingPrices);
  const announcedPrice = useMemo(() => {
    const priceRows = usingBookingPrice ? bookingPrices : prices;
    if (!selectedTypeId || !priceTypes.length || !priceRows.length) return null;
    const wantFinance = isFinance(form.finance_type);
    const matchingPt = priceTypes.find((pt) => {
      const name = String(pt.type_name || "").toLowerCase();
      const branchMatch = name.includes(branchGroup.toLowerCase());
      if (!branchMatch) return false;
      if (wantFinance) return name.includes("ไฟแนนท์") || name.includes("ไฟแนนซ์");
      return name.includes("เงินสด");
    });
    if (!matchingPt) return null;
    const ptId = matchingPt.price_type_id || matchingPt.type_id;
    const row = priceRows.find((x) => String(x.type_id) === String(selectedTypeId) && String(x.price_type_id) === String(ptId));
    return row ? Number(row.amount || 0) : null;
  }, [selectedTypeId, priceTypes, prices, bookingPrices, usingBookingPrice, form.finance_type, branchGroup]);

  // series ที่ match ตามรถปัจจุบัน (ใช้แสดงชื่อ marketing + ภาษาไทย + ประเภทรถ + cc)
  const selectedType = useMemo(() => motoTypes.find((m) => String(m.type_id) === String(selectedTypeId)), [selectedTypeId, motoTypes]);
  const selectedSeries = useMemo(() => {
    if (!selectedType) return null;
    return motoSeries.find((x) => String(x.series_id) === String(selectedType.series_id)) || null;
  }, [selectedType, motoSeries]);
  const selectedSeriesCC = useMemo(() => selectedSeries ? Number(selectedSeries.engine_cc) : null, [selectedSeries]);

  // จับคู่ color_code ของรถ → color_name (ไทย) จาก master colors
  const vehicleColorName = useMemo(() => {
    const code = String(vehicle?.model_color || "").trim();
    if (!code) return null;
    // ถ้าตรงกับ color_name อยู่แล้ว (yamaha คืน color_name ตรงๆ) — ใช้ค่าเดิม
    const direct = colors.find((c) => String(c.color_name).trim() === code);
    if (direct) return direct.color_name;
    // ค้นจาก color_code + match brand/series ถ้าได้ (เคสที่ code ซ้ำข้าม brand)
    const vb = normBrand(vehicle?.brand);
    const filtered = colors.filter((c) => String(c.color_code).trim().toUpperCase() === code.toUpperCase());
    const byBrand = filtered.find((c) => normBrand(c.brand_name) === vb);
    if (byBrand) return byBrand.color_name;
    // fallback: ตัวแรกที่ตรง code
    return filtered[0]?.color_name || null;
  }, [vehicle, colors]); // eslint-disable-line react-hooks/exhaustive-deps

  // markups ที่เข้าเงื่อนไขกับรถ + ไฟแนนซ์ที่เลือก
  const applicableMarkups = useMemo(() => {
    if (!selectedTypeId || !isFinance(form.finance_type)) return [];
    const sel = motoTypes.find((m) => String(m.type_id) === String(selectedTypeId));
    if (!sel) return [];
    const finName = financeCompanies.find((f) => String(f.company_id) === String(form.finance_company_code))?.company_name || "";
    const norm = (s) => String(s || "").toLowerCase().replace(/[\s()[\].\-_]/g, "").trim();
    const finN = norm(finName);
    const brand = (sel.brand_name || "").toLowerCase();
    const modelCode = (sel.model_code || "").toLowerCase();
    const branchCodeUp = String(branchCode).substring(0, 5);
    const branchG = ["SCY05", "SCY06"].includes(branchCodeUp) ? "papao" : "singchai";
    const finMatch = (m) => {
      if (!finN || !m.finance_company) return false;
      const mN = norm(m.finance_company);
      return mN === finN || mN.includes(finN) || finN.includes(mN);
    };
    const matched = markups.filter((m) => {
      if (m.markup_type === "finance") return finMatch(m);
      if (m.markup_type === "finance_cc") {
        if (!finMatch(m)) return false;
        if (m.branch_group && m.branch_group !== "all" && m.branch_group !== branchCodeUp && m.branch_group !== branchG) return false;
        if (selectedSeriesCC !== null) {
          if (m.cc_min && selectedSeriesCC < Number(m.cc_min)) return false;
          if (m.cc_max && selectedSeriesCC > Number(m.cc_max)) return false;
        }
        return true;
      }
      if (m.markup_type === "custom") {
        if (m.brand && m.brand.toLowerCase() !== brand) return false;
        if (m.model_code && m.model_code.toLowerCase() !== modelCode) return false;
        if (m.branch_group && m.branch_group !== "all" && m.branch_group !== branchCodeUp && m.branch_group !== branchG) return false;
        return true;
      }
      return false;
    });
    // บวก "ทุกกฎ" ที่เข้าเงื่อนไข (กฎ cc ซ้อนช่วงก็บวกรวม) — พฤติกรรมเดิมของระบบขายปลีก (user ยืนยัน 2026-07-20)
    return matched;
  }, [selectedTypeId, motoTypes, markups, financeCompanies, form.finance_type, form.finance_company_code, selectedSeriesCC, branchCode]);
  const markupsTotal = applicableMarkups.reduce((s, m) => s + Number(m.markup_amount || 0), 0);

  // ค่านำพา bonus (HONDA: 500→2000, YAMAHA: 500→1000)
  const deliveryBonus = useMemo(() => {
    if (!useDeliveryFee || !vehicle?.brand) return 0;
    const fee = Number(deliveryFee || 0);
    if (fee <= 0) return 0;
    const b = String(vehicle.brand).toLowerCase();
    const multiplier = b.includes("honda") || b.includes("ฮอนด้า") ? 2000 : b.includes("yamaha") || b.includes("ยามาฮ่า") ? 1000 : 0;
    return Math.floor(fee / 500) * multiplier;
  }, [useDeliveryFee, deliveryFee, vehicle]);

  // เงินดาวน์ออกแทน: input × 1.07 ปัดขึ้นหลักร้อย
  const downPayoutCalc = useDownPayout ? Math.ceil((Number(downPayout || 0) * 1.07) / 100) * 100 : 0;
  // รวมยอดรายการปรับแต่ง — ค่านำพา "ไม่บวก" ตัวเลขที่กรอก (เป็นต้นทุน) เอาเฉพาะโบนัสเข้าราคา
  // (ประกันรถหายไม่บวกเข้าราคารถ — ลูกค้าจ่ายเบี้ยเอง แยกไปช่อง "ประกันรถหาย" ด้านล่าง)
  const adjustmentsTotal = deliveryBonus + downPayoutCalc;

  // เคลียร์เบี้ยเมื่อเปลี่ยนคันรถ · มีผลเฉพาะจัดไฟแนนซ์ (ไฟแนนซ์หักเบี้ยจากยอดโอน)
  const vehicleChassis = vehicle?.chassis_no || vehicle?.engine_no || "";
  useEffect(() => { setTheftInsManual(""); }, [vehicleChassis]);
  const theftInsFin = isFinance(form.finance_type) ? num(theftInsManual) : 0;

  // ของแถม (promotion) ที่เข้าเงื่อนไขกับรถปัจจุบัน — รองรับ brand/type/cc/finance/province
  const applicableGiveaways = useMemo(() => {
    if (!selectedTypeId) return [];
    const sel = motoTypes.find((m) => String(m.type_id) === String(selectedTypeId));
    if (!sel) return [];
    const rowCC = selectedSeriesCC;
    const finId = form.finance_company_code;
    // โปรต้องมีผล ณ วันอ้างอิง: ลูกค้าจอง = วันจอง (เหมือนราคา ณ วันจอง), ไม่จอง = วันขาย
    const refDate = bookingDateISO || String(form.sale_date || "").slice(0, 10) || todayISO();
    return saleExpenses.filter((e) => {
      const eff = e.effective_date ? String(e.effective_date).slice(0, 10) : "";
      const end = e.end_date ? String(e.end_date).slice(0, 10) : "";
      if ((eff && eff > refDate) || (end && end < refDate)) return false;
      if (e.group_by === "brand" && String(e.brand_id) === String(sel.brand_id)) return true;
      if (e.group_by === "type" && String(e.type_id) === String(sel.type_id)) {
        const cond = String(e.note || "all").trim().toLowerCase();
        const fin = isFinance(form.finance_type);
        if (cond === "finance") return fin;
        if (cond === "cash") return !fin;
        return true;
      }
      if (e.group_by === "cc" && rowCC && Number(e.engine_cc) === rowCC) return true;
      if (e.group_by === "finance" && finId && String(e.company_id) === String(finId)) return true;
      if (e.group_by === "series") {
        const [sid, pc] = String(e.note || "").split("|");
        if (String(sid) !== String(sel.series_id)) return false;
        const cond = pc || "all";
        const fin = isFinance(form.finance_type);
        if (cond === "finance") return fin;
        if (cond === "cash") return !fin;
        return true;
      }
      if (e.group_by === "name_prefix") {
        const pfx = String(e.note || "").replace(/\s+/g, "");
        const cust = String(form.customer_name || "").replace(/\s+/g, "");
        return pfx && cust && cust.startsWith(pfx);
      }
      if (e.group_by === "province") {
        const stripProv = (s) => String(s || "").replace(/^จังหวัด/, "").trim();
        const eprov = stripProv(e.province);
        const mode = String(e.province_mode || "include").toLowerCase();
        const target = String(e.province_target || "customer").toLowerCase();
        // jังหวัดที่จดทะเบียน = สาขาที่ขาย (เมื่อยังไม่มี plate จริง ใช้ branchGroup เป็น proxy)
        const plateProv = String(form.plate_province || "").replace(/^จังหวัด/, "").trim() || "พระนครศรีอยุธยา";
        // หา finance address มี province ไหน
        const finCompany = financeCompanies.find((f) => String(f.company_id) === String(finId));
        const finAddr = String(finCompany?.address || "");
        const finHasProv = eprov && finAddr.includes(eprov);
        const customerProv = stripProv(form.customer_province);
        const hasFinance = isFinance(form.finance_type) && finId;

        if (mode === "cross") {
          // cross = plate ตรงกับ expense จังหวัด AND (ไม่มีไฟแนนซ์ → customer ต่าง / มีไฟแนนซ์ → fin address ไม่มี province นี้)
          if (eprov !== plateProv) return false;
          if (!hasFinance) {
            if (!customerProv) return true; // ยังไม่เลือกลูกค้า — แสดงไว้
            return customerProv !== eprov;
          }
          return !finHasProv;
        }
        if (target === "registered") {
          // ตามจังหวัดจดทะเบียน (plate)
          if (mode === "exclude") return eprov !== plateProv;
          return eprov === plateProv;
        }
        // target=customer (default)
        if (hasFinance) {
          // ใช้จังหวัดของ address ไฟแนนซ์
          if (mode === "exclude") return !finHasProv;
          return finHasProv;
        }
        // ไม่มีไฟแนนซ์ → ใช้ customer's province
        if (!customerProv) return true; // ยังไม่เลือกลูกค้า แสดงไว้ก่อน
        if (mode === "exclude") return eprov !== customerProv;
        return eprov === customerProv;
      }
      return false;
    }).filter((e) => {
      // กรองรายการที่ไม่ใช่ของแถมจริง ๆ ออก เช่น "ค่าคอมพิเศษ" — ไม่ใช่ของที่ลูกค้าได้รับ
      const name = String(e.expense_name || "").toLowerCase().replace(/\s+/g, "");
      if (name.includes("ค่าคอมพิเศษ") || name.includes("commission") || name.includes("คอมพิเศษ")) return false;
      return true;
    });
  }, [selectedTypeId, motoTypes, saleExpenses, selectedSeriesCC, form.finance_company_code, form.customer_province, form.finance_type, form.plate_province, form.customer_name, financeCompanies, bookingDateISO, form.sale_date]); // eslint-disable-line react-hooks/exhaustive-deps
  // auto-set form.discount จาก "เงินดาวน์ออกแทน" — ถ้ามีของแถมประเภทนี้เข้าเงื่อนไข + ติ๊กไว้
  useEffect(() => {
    if (!editable) return; // หลังบันทึกแล้วไม่ override
    let downSub = 0;
    for (const g of applicableGiveaways) {
      const on = !!selectedGiveaways[g.expense_id];
      if (!on) continue;
      if (isDownPaymentSub(g.expense_name)) downSub += Number(g.amount || 0);
    }
    setForm((f) => {
      const cur = Number(f.discount || 0);
      // ถ้าค่าเดิมยังเท่ากับยอด auto ก่อนหน้า (หรือว่าง) → update; ถ้า user แก้เอง (ไม่ตรง) → ไม่แตะ
      if (cur === (f._discount_auto || 0) || cur === 0) {
        return { ...f, discount: downSub > 0 ? String(downSub) : (cur === (f._discount_auto || 0) ? "" : f.discount), _discount_auto: downSub };
      }
      return { ...f, _discount_auto: downSub };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicableGiveaways, selectedGiveaways]);
  // default: ติ๊กเลือกของแถม-บริการที่เข้าเงื่อนไขไว้ก่อน (รายการใหม่ที่โผล่ → ติ๊กอัตโนมัติ, ที่ผู้ใช้เอาออกเองคงไว้)
  useEffect(() => {
    setSelectedGiveaways((prev) => {
      let changed = false; const next = { ...prev };
      for (const g of applicableGiveaways) {
        if (!(g.expense_id in next)) { next[g.expense_id] = true; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [applicableGiveaways]);
  const giveawaysTotal = applicableGiveaways
    .filter((g) => selectedGiveaways[g.expense_id] && !isDownPaymentSub(g.expense_name))
    .reduce((s, g) => s + Number(g.amount || 0), 0);

  // รวมรายการหมวด "ค่าจดทะเบียน" เป็นบรรทัดเดียว ยอดรวม ใช้ชื่อ "ค่าจดทะเบียน"
  // ซ่อน "เงินดาวน์ออกแทน" ออกจากการ์ด (อยู่ในส่วนลดแล้ว)
  const REG_CATEGORY = "ค่าจดทะเบียน";
  const displayGiveaways = useMemo(() => {
    const filtered = applicableGiveaways.filter((g) => !isDownPaymentSub(g.expense_name));
    const reg = filtered.filter((g) => String(g.category || "").trim() === REG_CATEGORY);
    if (reg.length <= 1) return filtered;
    const merged = {
      __merged: true, key: "__reg_merged__",
      expense_name: REG_CATEGORY, category: REG_CATEGORY,
      amount: reg.reduce((s, g) => s + Number(g.amount || 0), 0),
      ids: reg.map((g) => g.expense_id), count: reg.length,
    };
    const out = []; let inserted = false;
    for (const g of filtered) {
      if (String(g.category || "").trim() === REG_CATEGORY) {
        if (!inserted) { out.push(merged); inserted = true; }
      } else out.push(g);
    }
    return out;
  }, [applicableGiveaways]);

  // ราคาประกาศ + บวกเพิ่ม + ปรับแต่ง = ราคารถสุดท้าย (ของแถมไม่บวกเข้า — เป็นต้นทุนของเจ้าของ ไม่ใช่ราคาขาย)
  const finalPrice = announcedPrice == null ? null : announcedPrice + markupsTotal + adjustmentsTotal;

  // จับคู่ booking กับ remaining_amount (deposit_no = receipt_no)
  const depositMap = useMemo(() => {
    const m = {};
    for (const d of allDeposits) if (d.receipt_no) m[d.receipt_no] = Number(d.remaining_amount || 0);
    return m;
  }, [allDeposits]);

  // bookings ที่ match รุ่นรถปัจจุบัน + ยังเป็น "จอง" + มีเงินมัดจำเหลือ
  const normCode = (s) => String(s || "").toUpperCase().replace(/[\s()]/g, "");
  const vehicleModelNorm = useMemo(() => normCode(vehicle?.model_code), [vehicle]);
  // 1) เริ่มจาก match รุ่น + status + มีเงินเหลือ
  const baseMatchingBookings = useMemo(() => {
    if (!vehicleModelNorm) return [];
    return bookings.filter((b) => {
      if (b.status !== "จอง") return false;
      const code = normCode(b.new_model_code || b.model_code);
      return code === vehicleModelNorm || code.startsWith(parsedModel.base) || vehicleModelNorm.startsWith(code);
    }).map((b) => ({ ...b, remaining: b.deposit_no ? (depositMap[b.deposit_no] || 0) : 0 }))
      .filter((b) => b.remaining > 0); // ซ่อนแถวที่ไม่มีเงินเหลือ
  }, [bookings, vehicleModelNorm, parsedModel.base, depositMap]);

  // 2) options สำหรับ dropdown (มาจาก baseMatchingBookings)
  const bookingBranchOpts = useMemo(() => [...new Set(baseMatchingBookings.map((b) => b.branch).filter(Boolean))].sort(), [baseMatchingBookings]);
  const bookingColorOpts = useMemo(() => [...new Set(baseMatchingBookings.map((b) => b.new_color_name || b.color_name).filter(Boolean))].sort(), [baseMatchingBookings]);

  // 3) default สาขา: ใช้ branch ของ user (match prefix SCY##)
  useEffect(() => {
    if (showBookingPicker && !bookingBranchFilter) {
      const myBranch = String(currentUser?.branch || currentUser?.branch_code || "").substring(0, 5).toUpperCase();
      const found = bookingBranchOpts.find((b) => String(b).toUpperCase().startsWith(myBranch));
      if (found) setBookingBranchFilter(found);
    }
  }, [showBookingPicker, bookingBranchOpts, bookingBranchFilter, currentUser]);

  // 4) bookings ที่กรองตาม dropdown
  const matchingBookings = useMemo(() => {
    return baseMatchingBookings.filter((b) => {
      if (bookingBranchFilter && b.branch !== bookingBranchFilter) return false;
      if (bookingColorFilter && (b.new_color_name || b.color_name) !== bookingColorFilter) return false;
      return true;
    });
  }, [baseMatchingBookings, bookingBranchFilter, bookingColorFilter]);

  function pickBooking(b) {
    setForm((f) => ({
      ...f,
      deposit_no: b.deposit_no || "",
      booking_deposit: String(b.remaining || ""),
      customer_name: f.customer_name || b.customer_name || "",
    }));
    setShowBookingPicker(false);
  }

  // ดึงเงินจองอัตโนมัติ (ห้ามเลือกเอง) — จับคู่ด้วย "ชื่อลูกค้า" กับใบจองรุ่นเดียวกันที่มีมัดจำเหลือ
  // เทียบชื่อแบบตัดคำนำหน้า (นาย/นาง/นางสาว/ด.ช./ด.ญ./MR/MRS/MISS) + ตัดช่องว่าง — มัดจำของลูกค้าคนนั้นเท่านั้น
  const autoBookingRef = React.useRef(null);
  useEffect(() => {
    // ⚠️ ใช้ mode ตรง ๆ ห้ามอ้าง editable ตรงนี้ — editable ประกาศทีหลัง (TDZ → crash ทั้งแอป)
    if (mode !== "new" || !vehicleModelNorm || baseMatchingBookings.length === 0) return;
    if (form.deposit_no) return; // ดึงไว้แล้ว
    const cur = num(form.booking_deposit);
    if (cur > 0 && cur !== autoBookingRef.current) return; // user กรอกยอดเองแล้ว — ไม่ทับ
    const normName = (s) => String(s || "")
      .replace(/^(นางสาว|น\.ส\.|นาง|นาย|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|MR\.?|MRS\.?|MISS|MS\.?)\s*/i, "")
      .replace(/\s+/g, "").toUpperCase();
    const custName = normName(form.customer_name);
    if (!custName) return;
    const cand = baseMatchingBookings.find((b) => normName(b.customer_name) === custName);
    if (!cand || !cand.deposit_no || !(cand.remaining > 0)) return;
    autoBookingRef.current = Number(cand.remaining) || 0;
    pickBooking(cand);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [mode, vehicleModelNorm, baseMatchingBookings, form.customer_name, form.deposit_no]);

  // sync ราคารถ = ราคาประกาศ+บวกเพิ่ม+ปรับแต่ง เสมอ (ช่องราคารถถูกล็อก ห้ามแก้เอง)
  // จะพิมพ์เองได้เฉพาะกรณีไม่พบราคาประกาศ (finalPrice == null)
  useEffect(() => {
    if (finalPrice == null) return;
    setForm((f) => (num(f.car_price) === finalPrice ? f : { ...f, car_price: String(finalPrice) }));
  }, [finalPrice]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickCustomer(c) {
    setForm((f) => ({
      ...f,
      customer_code: c.code || f.customer_code,
      customer_name: c.name || f.customer_name,
      customer_province: c.province || f.customer_province,
      customer_line_user_id: c.line_user_id || f.customer_line_user_id,
      customer_address: c.address || f.customer_address,
      customer_tax_id: c.tax_id || f.customer_tax_id,
      customer_phone: c.phone || f.customer_phone,
      customer_birthdate: c.birth_date || f.customer_birthdate,
      customer_gender: c.gender || f.customer_gender,
    }));
    setShowCustomer(false);
  }

  // ---- ยอดเงินที่คำนวณอัตโนมัติ (โหมดกรอกใหม่) ----
  const calc = useMemo(() => {
    const carPrice = num(form.car_price);
    const discount = num(form.discount);
    const otherSale = num(form.other_sale);
    const down = num(form.down_payment);
    const booking = num(form.booking_deposit);
    const netCar = Math.max(carPrice - discount, 0);
    const fin = isFinance(form.finance_type);
    const financeAmount = fin ? Math.max(netCar - down, 0) : 0;
    const r = num(form.interest_rate) / 100;
    const n = num(form.installments);
    const installment = fin && n > 0 ? (financeAmount * (1 + r * n)) / n : 0;
    const totalPayment = (fin ? down : netCar) + otherSale - booking;
    return { netCar, financeAmount, installment, totalPayment, carPrice, discount, otherSale, down, booking };
  }, [form]);

  // ปัดเศษค่างวด: ถ้าติ๊ก = ปัดขึ้นเป็นทวีคูณของ 5 (ลงท้าย 0/5)
  const roundInstallment = (amt) => {
    const n = Number(amt) || 0;
    if (n <= 0) return 0;
    if (installmentRound) return Math.ceil(n / 5) * 5;   // ปัด 5: ปัดขึ้นเป็นทวีคูณของ 5
    return Math.ceil(n);                                  // ปัด 0: ปัดขึ้นเป็นจำนวนเต็มเสมอ (1271.05 → 1272)
  };
  // ยอดผ่อน/งวด: default = ค่าที่คำนวณ (ปัดเศษตาม option) แต่ผู้ใช้พิมพ์แก้เองได้
  useEffect(() => {
    if (!installmentTouched) setInstallmentOverride(calc.installment ? String(roundInstallment(calc.installment)) : "");
  }, [calc.installment, installmentTouched, installmentRound]);
  const effectiveInstallment = (installmentOverride !== "" && installmentOverride != null) ? Number(installmentOverride) : calc.installment;
  // ค่างวดจ่ายล่วงหน้า: กรอกเอง (ไม่มี default) — บวกเข้ารวมยอดชำระ
  const effectiveAdvance = isFinance(form.finance_type)
    ? ((advanceOverride !== "" && advanceOverride != null) ? Number(advanceOverride) : 0)
    : 0;
  // รวมยอดชำระ = ยอดเดิม + ค่างวดล่วงหน้า + เบี้ยประกันรถหายที่ลูกค้าจ่าย
  // (เบี้ยนับเป็นยอดชำระค่ารถ เพราะไฟแนนซ์จะหักเบี้ยออกจากยอดโอนค่ารถ)
  const totalPaymentEff = (calc.totalPayment || 0) + (Number(effectiveAdvance) || 0) + theftInsFin;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function reset() {
    setVehicle(null);
    setMode(null);
    setForm(blankForm(currentUser));
    setInstallmentTouched(false);
    setInstallmentOverride("");
    setAdvanceOverride("");
    setLineStatus({});
    if (linePending?.timerId) clearInterval(linePending.timerId);
    setLinePending(null);
  }

  // typeahead: ค้นหา moto_stock (สินค้าคงเหลือ) ด้วยเลขเครื่อง/เลขถัง (พิมพ์บางส่วน) → popup เลือก
  useEffect(() => {
    const kw = keyword.trim();
    if (vehicle || kw.length < 2) { setSuggestions([]); setShowSuggest(false); return; }
    let alive = true;
    const t = setTimeout(async () => {
      setSearchingStock(true);
      try {
        const res = await fetch(STOCK_SEARCH_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyword: kw }) });
        const data = await res.json().catch(() => []);
        const list = Array.isArray(data) ? data : (data?.results || []);
        if (alive) { setSuggestions(list); setShowSuggest(true); }
      } catch { if (alive) setSuggestions([]); }
      finally { if (alive) setSearchingStock(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [keyword, vehicle]);

  // เลือกรถจาก popup → ใช้เลขเครื่องไปดึงข้อมูลจากตารางรับสินค้า (get_vehicle)
  function pickStock(item) {
    const kw = text(item.engine_no) || text(item.chassis_no);
    setShowSuggest(false);
    setSuggestions([]);
    setKeyword(kw);
    lookup(kw);
  }

  async function lookup(kwOverride) {
    const kw = text(kwOverride != null ? kwOverride : keyword);
    setShowSuggest(false);
    if (!kw) { setMessage("❌ กรอกหมายเลขเครื่อง / หมายเลขตัวถัง"); return; }
    setLoading(true);
    setMessage("");
    reset();
    try {
      const row = await apiPost({ action: "get_vehicle", keyword: kw });
      if (!row || (!row.stock_id && !row.engine_no)) {
        setMessage("ไม่พบรถคันนี้ในสต๊อก (อาจขายไปแล้ว หรือยังไม่ได้รับเข้า)");
        return;
      }
      setVehicle(row);
      const sale = row.sale && typeof row.sale === "object" ? row.sale : null;
      if (sale && text(sale.sale_no)) {
        setMode("view");
        // ไม่อ่าน line_send_log จาก DB — ปล่อย lineStatus ว่างเสมอ
        // → ทุกครั้งที่เรียกใบขายขึ้นมาใหม่ ปุ่มส่ง LINE จะกดได้
        setLineStatus({});
      } else if (row.sold_at) {
        setMode("sold_other");
      } else {
        setMode("new");
        setForm((f) => ({ ...blankForm(currentUser), car_price: row.unit_cost ? "" : "" }));
      }
    } catch (e) {
      setMessage("ค้นหาไม่สำเร็จ: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  // ปิดการบันทึกขายใหม่จากหน้านี้ (2026-07-20) — หน้านี้เหลือ ค้นหา/ดูใบขาย/รับชำระ/ส่งเอกสาร เท่านั้น
  const NEW_SALE_DISABLED = true;

  async function handleSave() {
    if (NEW_SALE_DISABLED) { setMessage("❌ ปิดการบันทึกขายปลีกจากหน้านี้แล้ว — กรุณาบันทึกขายที่เมนู \"บันทึกขาย NEW\""); return; }
    if (!vehicle) return;
    if (!text(form.car_price)) { setMessage("❌ กรอกราคารถ"); return; }
    if (!text(form.customer_name)) { setMessage("❌ กรอกชื่อลูกค้า"); return; }
    if (isFinance(form.finance_type) && !num(form.installments)) { setMessage("❌ กรอกจำนวนงวด"); return; }
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        action: "save_sale",
        brand: vehicle.brand,
        stock_table: vehicle.stock_table,
        stock_id: vehicle.stock_id,
        unit_cost: vehicle.unit_cost,
        chassis_no: vehicle.chassis_no,
        engine_no: vehicle.engine_no,
        model_code: vehicle.model_code,
        model_year: vehicle.model_year,
        model_color: vehicle.model_color,
        model_name: vehicle.model_name,
        sale_date: form.sale_date,
        customer_code: form.customer_code,
        customer_name: form.customer_name,
        customer_address: form.customer_address,
        customer_tax_id: form.customer_tax_id,
        customer_phone: form.customer_phone,
        customer_birthdate: form.customer_birthdate,
        customer_gender: form.customer_gender,
        line_user_id: form.customer_line_user_id,
        seller: form.seller,
        note: form.note,
        finance_type: form.finance_type,
        car_price: calc.carPrice,
        net_car_price: calc.netCar,
        discount: calc.discount,
        other_sale: calc.otherSale,
        down_payment: calc.down,
        booking_deposit: calc.booking,
        deposit_no: form.deposit_no,
        total_payment: totalPaymentEff,
        advance_installment: effectiveAdvance,
        theft_insurance_amount: theftInsFin,
        theft_insurance_source: theftInsFin > 0 ? "finance" : null,
        payment_status: "unpaid",
        tax_invoice_status: "none",
        finance_company_code: form.finance_company_code,
        finance_company_name: form.finance_company_name,
        interest_rate: num(form.interest_rate),
        installments: num(form.installments),
        finance_amount: calc.financeAmount,
        installment_amount: effectiveInstallment,
        finance_note: form.finance_note,
        branch_code: currentUser?.branch_code || currentUser?.branch || "",
        branch_name: currentUser?.branch || "",
        created_by: currentUser?.username || currentUser?.name || "system",
      };
      const row = await apiPost(payload);
      const sale = row && (row.sale || row);
      if (!sale || !sale.sale_no) throw new Error(row?.error || row?.__error || "บันทึกไม่สำเร็จ");
      setVehicle((v) => ({ ...v, sale, sold_at: sale.sale_date, sold_invoice_no: sale.sale_no }));
      setMode("view");
      let msg = "✅ บันทึกใบขายเรียบร้อย เลขที่ " + sale.sale_no + " (ตัดออกจากสต๊อกแล้ว)";
      // ตัดใบจองเป็น "ขาย" อัตโนมัติ เมื่อใบขายผูกเงินจองจากใบจอง (deposit_no) — action เดียวกับปุ่ม "ขาย" ในหน้าระบบจอง
      if (selectedBooking?.booking_id && selectedBooking.status === "จอง") {
        try {
          const r = await fetch(BOOKING_API, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sell_moto_booking", booking_id: selectedBooking.booking_id, invoice_no: sale.sale_no }),
          });
          if (!r.ok) throw new Error();
          setBookings((prev) => prev.map((b) => b.booking_id === selectedBooking.booking_id ? { ...b, status: "ขาย", invoice_no: sale.sale_no } : b));
          msg += " · ตัดใบจองเป็น \"ขาย\" แล้ว";
        } catch {
          msg += " — ⚠️ ตัดใบจองอัตโนมัติไม่สำเร็จ กรุณากดปุ่ม \"ขาย\" ในหน้าระบบจองเอง";
        }
      }
      setMessage(msg);
      // ===== Auto-schedule ส่งใบขาย LINE หลัง 10 วินาที (ถ้ามี line_user_id) =====
      const hasLineUser = sale.line_user_id || form.customer_line_user_id;
      if (hasLineUser) {
        scheduleLineSend("sale", "ใบขาย", () => sendSaleLineNow(sale), sale.sale_no);
      }
    } catch (e) {
      setMessage("บันทึกไม่สำเร็จ: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    const sale = vehicle?.sale;
    if (!sale?.sale_no) return;
    if (!window.confirm(`ยกเลิกใบขาย ${sale.sale_no}? รถจะถูกคืนเข้าสต๊อก`)) return;
    setSaving(true);
    setMessage("");
    try {
      const row = await apiPost({
        action: "cancel_sale",
        sale_no: sale.sale_no,
        brand: vehicle.brand,
        cancelled_by: currentUser?.username || currentUser?.name || "system",
      });
      const c = row && (row.cancelled || row);
      if (!c || (row && (row.error || row.__error))) throw new Error(row?.error || row?.__error || "ยกเลิกไม่สำเร็จ");
      setMessage("✅ ยกเลิกใบขายแล้ว — รถคืนเข้าสต๊อก");
      reset();
      setKeyword("");
    } catch (e) {
      setMessage("ยกเลิกไม่สำเร็จ: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  // หัวกระดาษใบขาย/ใบเสร็จตามสาขาของเอกสาร — ชื่อสาขา/ที่อยู่/เบอร์/เลขภาษีจาก branch_master
  // โลโก้ตาม BRANCH_LOGO (SCY01/04/07=YAMAHA, SCY05/06=ปีกนก HONDA) ถ้าไม่รู้สาขาใช้ยี่ห้อรถแทน
  function letterheadFor(s, v) {
    const bc = String(s?.branch_code || s?.sale_no || branchCode || "").substring(0, 5).toUpperCase();
    const brandKey = String(v?.brand || "").toUpperCase().indexOf("YAMAHA") >= 0 ? "YAMAHA" : "HONDA";
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

  // โลโก้หัวเอกสาร — รูปจาก /logos/ ถ้าโหลดไม่ได้ fallback เป็นกรอบชื่อยี่ห้อ
  function logoHtml(lh, esc) {
    const ph = `<div class="ph">${esc(lh.brandText || "")}</div>`;
    if (!lh.logo) return ph;
    return `<img src="${esc(lh.logo)}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="ph" style="display:none">${esc(lh.brandText || "")}</div>`;
  }

  function buildSaleHtml(saleArg) {
    const s = saleArg || sale || {};
    const v = vehicle || {};
    const money = (n) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const isFin = isFinance(s.finance_type);
    const colorTxt = v.color_name || v.model_color || "-";
    const lh = letterheadFor(s, v);
    const dash = (n) => (Number(n) > 0 ? money(n) : "-");
    const modelLine = [v.model_code, v.model_type,
      (v.model_color ? v.model_color + (colorTxt && colorTxt !== "-" ? "(" + colorTxt + ")" : "") : colorTxt),
      (v.model_series || "")].filter((x) => x && x !== "-").join(" / ");
    // ของแถม (บริการ + สินค้า) พร้อมรหัส
    // เงินดาวน์ออกแทน — แยกออกไป (อยู่ในส่วนลดแล้ว)
    const givItems = [];
    for (const g of displayGiveaways) {
      const on = g.__merged ? g.ids.every((id) => selectedGiveaways[id]) : !!selectedGiveaways[g.expense_id];
      if (!on) continue;
      if (isDownPaymentSub(g.expense_name)) continue; // อยู่ในส่วนลดแล้ว
      givItems.push({ code: g.expense_code || g.code || "", name: g.expense_name, amount: Number(g.amount || 0) });
    }
    const prodItems = (productGiveaways || []).filter((g) => selectedProductGiveaways[g.id])
      .map((g) => ({ code: g.part_code || g.fmp_product_code || "", name: g.fmp_product_name || g.part_name || g.part_code || "-", qty: Number(g.qty || 1) }));
    const givTotal = givItems.reduce((a, b) => a + b.amount, 0);
    const gRow = (code, name, qty) => `<tr><td>${esc(code)}</td><td>${esc(name)}</td><td class="c">${qty}</td></tr>`;
    let gRows = "";
    for (const it of givItems) gRows += gRow(it.code, it.name, 1);
    for (const it of prodItems) gRows += gRow(it.code, it.name, it.qty);

    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ใบขาย ${esc(s.sale_no)}</title>
<style>
*{font-family:"Sarabun","TH Sarabun New",Tahoma,sans-serif;box-sizing:border-box}
body{margin:0;padding:14px;color:#222;font-size:13px;background:#fff}
.wrap{max-width:800px;margin:0 auto}
.hdr{display:flex;align-items:flex-start;gap:12px;margin-bottom:6px}
.hdr .logo{width:120px;text-align:center;flex:none}
.hdr .logo img{max-width:120px;max-height:72px}
.hdr .logo .ph{color:#e10600;font-weight:800;font-size:20px;border:2px solid #e10600;border-radius:6px;padding:8px 4px}
.hdr .co{flex:1}
.hdr .co .nm{font-weight:700;font-size:15px;color:#111}
.hdr .co div{font-size:12px;color:#555;margin-top:1px}
.hdr .ttl{text-align:center;width:150px;flex:none}
.hdr .ttl .b{font-size:24px;font-weight:800;line-height:1}
.hdr .ttl .o{color:#c2185b;font-weight:700;margin-top:3px}
table.bx{width:100%;border-collapse:collapse;margin-top:6px}
table.bx>tbody>tr>td{border:1px solid #c2185b;padding:5px 8px;font-size:12px;vertical-align:top}
.it{width:100%;border-collapse:collapse}.it td{border:1px solid #c2185b;padding:4px 8px;font-size:12px}
.sec{background:#fde7f0;color:#a01049;font-weight:700;text-align:center}
.lbl{color:#a01049;font-weight:600}.r{text-align:right}.c{text-align:center}.val{font-weight:600}
.foot{display:flex;justify-content:space-between;margin-top:46px;padding:0 30px}
.sg{text-align:center;width:40%;border-top:1px dotted #888;padding-top:4px;color:#666}
@media print{body{padding:0}}
</style></head><body><div class="wrap">

<div class="hdr">
  <div class="logo">${logoHtml(lh, esc)}</div>
  <div class="co"><div class="nm">${esc(lh.name)}</div><div>${esc(lh.addr)}</div><div>${esc(lh.tel)}</div><div>${esc(lh.tax)}</div></div>
  <div class="ttl"><div class="b">ใบขาย</div><div>Sales Order</div><div class="o">(ต้นฉบับ)</div></div>
</div>

<table class="bx"><tr>
  <td style="width:62%"><div class="sec" style="margin:-5px -8px 5px;padding:3px">ชื่อลูกค้า/ที่อยู่</div>
    <div class="val">${esc(s.customer_name)}${s.customer_code ? ` <span style="color:#888;font-weight:400">(รหัส ${esc(s.customer_code)})</span>` : ""}</div>
    <div>${esc(s.customer_address || "")}</div>
    <div>${s.customer_tax_id ? "เลขประจำตัวผู้เสียภาษี : " + esc(s.customer_tax_id) : ""}</div>
  </td>
  <td style="padding:0"><table class="it" style="border:none">
    <tr><td class="sec">เลขที่ใบขาย</td><td class="sec">วันที่ขาย</td></tr>
    <tr><td class="c val">${esc(s.sale_no)}</td><td class="c">${esc(thaiDate(s.sale_date))}</td></tr>
    <tr><td class="sec">เลขที่ใบจอง</td><td class="sec">วันที่จอง</td></tr>
    <tr><td class="c">${esc(s.booking_no || "")}</td><td class="c">${s.booking_date ? esc(thaiDate(s.booking_date)) : ""}</td></tr>
  </table></td>
</tr></table>

<table class="bx"><tr>
  <td style="width:62%;padding:0"><table class="it" style="border:none">
    <tr><td class="sec">รุ่นรถ</td></tr>
    <tr><td class="c val">${esc(modelLine)}</td></tr>
    <tr><td class="sec" style="width:50%">หมายเลขตัวถัง</td><td class="sec">หมายเลขเครื่อง</td></tr>
    <tr><td class="c val">${esc(v.chassis_no)}</td><td class="c val">${esc(v.engine_no)}</td></tr>
  </table></td>
  <td style="padding:0"><table class="it" style="border:none">
    <tr><td class="lbl">ราคารถ</td><td class="r val">${money(s.car_price)}</td></tr>
    <tr><td class="lbl">ส่วนลด</td><td class="r">${dash(s.discount)}</td></tr>
    <tr><td class="lbl">ราคารถสุทธิ</td><td class="r val">${money(s.net_car_price || s.car_price)}</td></tr>
    <tr><td class="lbl">เงินจอง</td><td class="r">${dash(s.booking_deposit)}</td></tr>
    ${Number(s.theft_insurance_amount) > 0 ? `<tr><td class="lbl">ประกันรถหาย</td><td class="r val">${money(s.theft_insurance_amount)}</td></tr>` : ""}
  </table></td>
</tr></table>

${isFin ? `<table class="bx">
  <tr><td colspan="5" class="sec">ไฟแนนซ์ : ${esc(s.finance_company_name || "-")}</td></tr>
  <tr><td class="sec">ยอดจัดไฟแนนซ์</td><td class="sec">เงินดาวน์</td><td class="sec">อัตราดอกเบี้ย</td><td class="sec">จำนวนงวด</td><td class="sec">ยอดผ่อน/งวด</td><td class="sec">ค่างวดจ่ายล่วงหน้า</td></tr>
  <tr><td class="r val">${money(s.finance_amount)}</td><td class="r val">${money(s.down_payment)}</td><td class="c">${esc(s.interest_rate || "-")}</td><td class="c">${esc(s.installments || "-")}</td><td class="r val">${money(s.installment_amount)}</td><td class="r val">${money(s.advance_installment)}</td></tr>
</table>` : ""}

<table class="bx">
  <tr><td class="sec" style="width:18%">รหัสสินค้า</td><td class="sec">รายละเอียด</td><td class="sec" style="width:12%">จำนวน</td></tr>
  ${gRows ? `<tr><td colspan="3" class="lbl" style="text-decoration:underline">รายการแถม</td></tr>${gRows}` : `<tr><td colspan="3" class="c" style="color:#999">- ไม่มีของแถม -</td></tr>`}
</table>
${s.note ? `<div style="margin-top:6px;font-size:12px">หมายเหตุ: ${esc(s.note)}</div>` : ""}
<div class="foot"><div class="sg">ผู้ขาย</div><div class="sg">ลูกค้า / ผู้ซื้อ</div></div>
</div></body></html>`;
    return html;
  }

  function handlePrint() {
    const html = buildSaleHtml();
    const w = window.open("", "_blank", "width=820,height=920");
    if (!w) { setMessage("❌ เปิดหน้าต่างพิมพ์ไม่ได้ (popup อาจถูกบล็อก)"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 350);
  }

  const editable = mode === "new";
  const sale = vehicle?.sale || null;
  const isPaid = (sale?.payment_status) === "paid";
  // ส่งซ้ำได้เฉพาะ admin — เช็คจากประวัติส่งใน DB (line_send_log) ว่าใบนี้เคยส่ง type นั้นสำเร็จแล้วหรือยัง
  const isAdmin = currentUser?.role === "admin";
  const lineSentBefore = (type) => Array.isArray(sale?.line_send_log) && sale.line_send_log.some((l) => l && l.type === type && l.status === "sent");

  // prefill ฟอร์มรับชำระเมื่อโหลดใบขาย
  useEffect(() => {
    if (!sale?.sale_no) return;
    const today = new Date().toISOString().slice(0, 10);
    if (isPaid && Array.isArray(sale.payment_methods) && sale.payment_methods.length) {
      setPayLines(sale.payment_methods.map((p) => ({ method: p.method || "เงินสด", account_id: p.account_id || "", amount: p.amount ?? "" })));
      setPayForm({ receipt_date: String(sale.receipt_date || "").slice(0, 10) || today, note: sale.payment_received_note || "" });
    } else {
      // เงินดาวน์/ค่างวดออกแทน = ของแถมหักออกจากยอดที่ต้องเก็บ
      const netCollect = Number(sale.total_payment || 0) - Number(sale.down_payout_amount || 0);
      setPayLines([{ method: "เงินสด", account_id: "", amount: netCollect ? String(netCollect) : "" }]);
      setPayForm({ receipt_date: today, note: "" });
    }
  }, [sale?.sale_no, sale?.payment_status]); // eslint-disable-line react-hooks/exhaustive-deps

  const PAY_METHODS = ["เงินสด", "โอน", "บัตร/QR", "ไฟแนนซ์", "เงินมัดจำ"];
  const payTotal = payLines.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const updatePayLine = (i, patch) => setPayLines((ls) => ls.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const addPayLine = () => setPayLines((ls) => [...ls, { method: "เงินสด", account_id: "", amount: "" }]);
  const removePayLine = (i) => setPayLines((ls) => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls);

  async function savePayment() {
    if (!sale?.sale_no) return;
    const lines = payLines.filter((p) => Number(p.amount) > 0).map((p) => ({
      method: p.method,
      account_id: p.account_id ? Number(p.account_id) : null,
      account_name: bankAccounts.find((a) => String(a.account_id) === String(p.account_id))?.account_name || null,
      amount: Number(p.amount) || 0,
    }));
    if (!lines.length) { setMessage("❌ ใส่ยอดรับชำระอย่างน้อย 1 รายการ"); return; }
    setPayingSave(true); setMessage("");
    try {
      const row = await apiPost({
        action: "save_payment", sale_no: sale.sale_no,
        receipt_date: payForm.receipt_date, payments: lines,
        paid_amount: lines.reduce((s, p) => s + p.amount, 0),
        payment_note: payForm.note,
        received_by: currentUser?.username || currentUser?.name || "",
        branch_code: sale.branch_code || currentUser?.branch_code || currentUser?.branch || "",
      });
      const updated = row && (row.sale || row);
      if (!updated || !updated.sale_no) throw new Error(row?.__error || row?.error || "บันทึกไม่สำเร็จ");
      setVehicle((v) => ({ ...v, sale: updated }));
      setMessage("✅ รับชำระเงินเรียบร้อย เลขที่ใบเสร็จ " + (updated.receipt_no || ""));
      // ส่งใบเสร็จเข้า LINE อัตโนมัติ (เหมือนบันทึกใบขาย) ถ้าลูกค้ามี LINE
      const hasLineUser = updated.line_user_id || sale?.line_user_id || form.customer_line_user_id;
      if (hasLineUser) {
        scheduleLineSend("receipt", "ใบเสร็จ", () => sendReceiptLineNow(updated), updated.sale_no);
      }
    } catch (e) { setMessage("รับชำระไม่สำเร็จ: " + (e.message || e)); }
    finally { setPayingSave(false); }
  }

  async function cancelPayment() {
    if (!sale?.sale_no) return;
    if (!window.confirm(`ยกเลิกการรับชำระของใบขาย ${sale.sale_no}? (ใบเสร็จ ${sale.receipt_no || "-"})`)) return;
    setPayingSave(true); setMessage("");
    try {
      const row = await apiPost({ action: "cancel_payment", sale_no: sale.sale_no });
      const updated = row && (row.sale || row);
      if (!updated || !updated.sale_no) throw new Error(row?.__error || "ยกเลิกไม่สำเร็จ");
      setVehicle((v) => ({ ...v, sale: updated }));
      setMessage("✅ ยกเลิกการรับชำระแล้ว");
    } catch (e) { setMessage("ยกเลิกไม่สำเร็จ: " + (e.message || e)); }
    finally { setPayingSave(false); }
  }

  // ===== ส่งเข้า LINE (Flex) — แยก *Now (ทำจริง) กับ handler ที่ schedule countdown =====
  async function sendSaleLineNow(saleArg) {
    const s = saleArg || sale || {}, v = vehicle || {};
    if (!s.sale_no) throw new Error("no sale_no");
    setLineSending("sale"); setMessage("");
    try {
      await apiPost({
        action: "send_sale_flex",
        sale_no: s.sale_no, sale_date: s.sale_date,
        customer_name: s.customer_name, customer_code: s.customer_code,
        brand: v.brand || s.brand, model_name: v.model_name || s.model_name || s.model_code,
        engine_no: v.engine_no || s.engine_no, chassis_no: v.chassis_no || s.chassis_no,
        color: v.color_name || s.model_color, seller: s.seller,
        car_price: s.car_price, discount: s.discount, total_payment: s.total_payment,
        advance_installment: s.advance_installment, installment_amount: s.installment_amount,
        finance_type: s.finance_type, branch_name: s.branch_name || currentUser?.branch || "", branch_code: s.branch_code || currentUser?.branch_code || currentUser?.branch || "",
        line_user_id: s.line_user_id || form.customer_line_user_id || "",
        doc_html: buildSaleHtml(s),
        sent_by: currentUser?.name || currentUser?.username || "",
      });
      setMessage("✅ ส่งใบขายเข้า LINE แล้ว");
    } finally { setLineSending(""); }
  }
  function sendSaleLine() {
    const s = sale || {};
    if (!s.sale_no) return;
    scheduleLineSend("sale", "ใบขาย", () => sendSaleLineNow(s), s.sale_no);
  }

  async function sendReceiptLineNow(saleArg) {
    const s = saleArg || sale || {};
    if (!s.sale_no || s.payment_status !== "paid") throw new Error("not paid");
    setLineSending("receipt"); setMessage("");
    try {
      await apiPost({
        action: "send_receipt_flex",
        sale_no: s.sale_no, receipt_no: s.receipt_no, receipt_date: s.receipt_date,
        customer_name: s.customer_name, paid_amount: s.paid_amount,
        payment_methods: Array.isArray(s.payment_methods) ? s.payment_methods : [],
        branch_name: s.branch_name || currentUser?.branch || "", branch_code: s.branch_code || currentUser?.branch_code || currentUser?.branch || "",
        line_user_id: s.line_user_id || form.customer_line_user_id || "",
        doc_html: buildReceiptHtml(s),
        sent_by: currentUser?.name || currentUser?.username || "",
      });
      setMessage("✅ ส่งใบเสร็จเข้า LINE แล้ว");
    } finally { setLineSending(""); }
  }
  function sendReceiptLine() {
    const s = sale || {};
    if (!s.sale_no) return;
    scheduleLineSend("receipt", "ใบเสร็จ", sendReceiptLineNow, s.sale_no);
  }

  // อัปโหลด PDF เอกสาร (พ.ร.บ. / COSMOS) → เก็บใน DB → ส่ง Flex แจ้งเข้า LINE
  async function uploadDoc(file, docType, label, clearFile, setUploading) {
    const s = sale || {};
    if (!file || !s.sale_no) return;
    if (file.type !== "application/pdf") { setMessage("❌ ต้องเป็นไฟล์ PDF เท่านั้น"); return; }
    if (file.size > 8 * 1024 * 1024) { setMessage("❌ ไฟล์ใหญ่เกิน 8 MB"); return; }
    setUploading(true); setMessage("");
    try {
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = (e) => resolve(String(e.target.result).split(",")[1] || "");
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      await apiPost({
        action: "upload_act_doc", sale_no: s.sale_no, filename: file.name, doc_type: docType,
        pdf_base64: base64, uploaded_by: currentUser?.name || currentUser?.username || "",
      });
      setMessage("✅ อัปโหลด" + label + " สำเร็จ — กำลังจะส่งเข้า LINE...");
      clearFile(null);
      // schedule send Flex (10s countdown — user สามารถยกเลิกได้)
      const docKey = docType === "act" ? "act" : (docType === "cosmos" ? "cosmos" : docType);
      scheduleLineSend(docKey, label, () => apiPost({
        action: "send_act_flex", sale_no: s.sale_no, doc_type: docType,
        customer_name: s.customer_name, branch_name: s.branch_name || currentUser?.branch || "", branch_code: s.branch_code || currentUser?.branch_code || currentUser?.branch || "",
        line_user_id: s.line_user_id || form.customer_line_user_id || "",
        sent_by: currentUser?.name || currentUser?.username || "",
      }).then(() => setMessage("✅ แจ้ง" + label + " เข้า LINE แล้ว")), s.sale_no);
    } catch (e) {
      setMessage("ส่ง" + label + " ไม่สำเร็จ: " + (e.message || e));
    } finally {
      setUploading(false);
    }
  }

  function buildReceiptHtml(saleArg) {
    const s = saleArg || sale || {}, v = vehicle || {};
    const money = (n) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const lh = letterheadFor(s, v);
    const carLine = [v.model_name || s.model_name, v.model_code || s.model_code, v.engine_no || s.engine_no].filter((x) => x && x !== "-").join(" / ");
    const lines = Array.isArray(s.payment_methods) ? s.payment_methods : [];
    let iRows = "", i = 0;
    for (const p of lines) { i++; iRows += `<tr><td class="c">${i}</td><td>${esc(p.method)}${p.account_name ? " · " + esc(p.account_name) : ""}</td><td class="c">1</td><td class="r">${money(p.amount)}</td><td class="r">${money(p.amount)}</td></tr>`; }
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ใบเสร็จ ${esc(s.receipt_no)}</title>
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
.foot{display:flex;justify-content:space-between;margin-top:46px;padding:0 30px}
.sg{text-align:center;width:40%;border-top:1px dotted #888;padding-top:4px;color:#666}
@media print{body{padding:0}}
</style></head><body><div class="wrap">

<div class="hdr">
  <div class="logo">${logoHtml(lh, esc)}</div>
  <div class="co"><div class="nm">${esc(lh.name)}</div><div>${esc(lh.addr)}</div><div>${esc(lh.tel)}</div><div>${esc(lh.tax)}</div></div>
  <div class="ttl"><div class="b">ใบเสร็จรับเงิน</div><div>Receipt</div><div class="o">(ต้นฉบับ)</div></div>
</div>

<table class="bx"><tr>
  <td style="width:62%"><div class="sec" style="margin:-5px -8px 5px;padding:3px">ชื่อลูกค้า/ที่อยู่</div>
    <div class="val">${esc(s.customer_name)}${s.customer_code ? ` <span style="color:#888;font-weight:400">(รหัส ${esc(s.customer_code)})</span>` : ""}</div>
    <div>${esc(s.customer_address || "")}</div>
    <div>${s.customer_tax_id ? "เลขประจำตัวผู้เสียภาษี : " + esc(s.customer_tax_id) : ""}</div>
  </td>
  <td style="padding:0"><table class="it" style="border:none">
    <tr><td class="sec">เลขที่ใบเสร็จ</td><td class="sec">วันที่</td></tr>
    <tr><td class="c val">${esc(s.receipt_no) || "-"}</td><td class="c">${esc(thaiDate(s.receipt_date))}</td></tr>
    <tr><td class="sec">อ้างอิงใบขาย</td><td class="sec">วันที่ขาย</td></tr>
    <tr><td class="c">${esc(s.sale_no)}</td><td class="c">${esc(thaiDate(s.sale_date))}</td></tr>
  </table></td>
</tr></table>

<table class="bx"><tr><td><span class="lbl">รถ : </span>${esc(carLine)}${(v.chassis_no || s.chassis_no) ? ` &nbsp; เลขถัง ${esc(v.chassis_no || s.chassis_no)}` : ""}</td></tr></table>

<table class="bx">
  <tr><td class="sec" style="width:8%">ลำดับ</td><td class="sec">รายละเอียด / ช่องทางรับชำระ</td><td class="sec" style="width:9%">จำนวน</td><td class="sec" style="width:15%">ราคา/หน่วย</td><td class="sec" style="width:15%">จำนวนเงิน</td></tr>
  ${iRows || `<tr><td colspan="5" class="c" style="color:#999">-</td></tr>`}
  <tr><td colspan="4" class="r tot">รวมรับชำระ</td><td class="r tot">${money(s.paid_amount)} บาท</td></tr>
</table>
${s.payment_received_note ? `<div style="margin-top:6px;font-size:12px">หมายเหตุ: ${esc(s.payment_received_note)}</div>` : ""}
<div class="foot"><div class="sg">ผู้รับเงิน</div><div class="sg">ผู้ชำระเงิน</div></div>
</div></body></html>`;
    return html;
  }

  function handlePrintReceipt() {
    const html = buildReceiptHtml();
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) { setMessage("❌ เปิดหน้าต่างพิมพ์ไม่ได้ (popup ถูกบล็อก)"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 350);
  }

  return (
    <div style={{ padding: 20, background: "#fbf7f1", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 26, color: "#333" }}>ค้นหาใบขาย</h2>
        <div style={{ color: "#9aa0a6", fontSize: 14 }}>ขายรถ &nbsp;&gt;&nbsp; การขาย &nbsp;&gt;&nbsp; ค้นหาใบขาย</div>
      </div>

      {/* ข้อมูลลูกค้าซ่อน สำหรับ userscript ดึงไป autofill หน้า Cosmos ตรวจสอบประวัติลูกค้า */}
      {sale && (
        <div
          id="retail-cosmos"
          style={{ display: "none" }}
          data-fullname={sale.customer_name || ""}
          data-idcard={sale.customer_tax_id || ""}
          data-code={sale.customer_code || ""}
          data-address={sale.customer_address || ""}
          data-phone={sale.customer_phone || ""}
          data-birthdate={sale.customer_birthdate || ""}
          data-gender={sale.customer_gender || ""}
          data-price={sale.net_car_price || sale.car_price || ""}
          data-chassis={sale.chassis_no || ""}
          data-engine={sale.engine_no || ""}
          data-model={sale.model_code || ""}
          data-color={sale.model_color || ""}
        />
      )}

      <div style={{ position: "relative", marginBottom: 14, maxWidth: 620 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            style={{ flex: 1, padding: "10px 12px", fontSize: 15, border: "1px solid #d0d5dd", borderRadius: 8 }}
            placeholder="พิมพ์บางส่วนของเลขเครื่อง/เลขถัง แล้วเลือกจากรายการ"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            onFocus={() => { if (suggestions.length && !vehicle) setShowSuggest(true); }}
            autoComplete="off"
          />
          <button onClick={() => lookup()} disabled={loading} style={btn("#2563eb")}>{loading ? "ค้นหา…" : "🔍 ค้นหา"}</button>
          {vehicle && <button onClick={() => { reset(); setKeyword(""); setMessage(""); setSuggestions([]); setShowSuggest(false); }} style={btn("#8aa0a6")}>ล้าง</button>}
        </div>
        {showSuggest && !vehicle && keyword.trim().length >= 2 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: "1px solid #d0d5dd", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, maxHeight: 320, overflowY: "auto" }}>
            {searchingStock && <div style={{ padding: "10px 12px", color: "#9aa0a6", fontSize: 13 }}>กำลังค้นหาในสินค้าคงเหลือ…</div>}
            {!searchingStock && suggestions.length === 0 && <div style={{ padding: "10px 12px", color: "#9aa0a6", fontSize: 13 }}>ไม่พบในสินค้าคงเหลือ</div>}
            {suggestions.map((it, i) => (
              <div key={(it.engine_no || it.chassis_no || "") + "_" + i}
                onMouseDown={(e) => { e.preventDefault(); pickStock(it); }}
                style={{ padding: "8px 12px", borderTop: i ? "1px solid #f1f5f9" : "none", cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between", gap: 10 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f8ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0369a1" }}>{it.engine_no || "-"}</span>
                  <span style={{ color: "#cbd5e1", margin: "0 6px" }}>|</span>
                  <span style={{ fontFamily: "monospace", color: "#475569" }}>{it.chassis_no || "-"}</span>
                </span>
                <span style={{ color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                  {(it.model_code || it.model_series || "-")}{it.color_name ? ` · ${it.color_name}` : ""}{it.brand ? ` · ${it.brand}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* ===== Countdown banner: กำลังจะส่ง LINE ===== */}
      {linePending && (
        <div style={{ background: "#ecfeff", border: "2px solid #06b6d4", borderRadius: 10, padding: "12px 16px", margin: "10px 0", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 6px rgba(6,182,212,0.2)" }}>
          <span style={{ fontSize: 22 }}>⏰</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#0e7490" }}>กำลังจะส่ง <b>{linePending.label}</b> เข้า LINE ใน <span style={{ fontSize: 18, color: "#dc2626" }}>{linePending.seconds}</span> วินาที</div>
            <div style={{ fontSize: 12, color: "#475569" }}>ใบขาย {linePending.saleNo}</div>
          </div>
          <button onClick={cancelLinePending} style={{ ...btn("#dc2626"), padding: "8px 16px" }}>✕ ยกเลิกการส่ง</button>
        </div>
      )}

      {message && (
        <div style={{ margin: "8px 0", color: message.startsWith("✅") ? "#067647" : "#b42318", fontWeight: 600 }}>{message}</div>
      )}

      {/* ปิดการบันทึกขายปลีกจากหน้านี้ (2026-07-20) — รถที่ยังไม่ขายให้ไปบันทึกที่เมนู "บันทึกขาย NEW" เท่านั้น */}
      {vehicle && editable ? (
        <div style={{ background: "#fef2f2", border: "2px solid #fca5a5", borderRadius: 10, padding: "18px 20px", margin: "10px 0" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#b91c1c", marginBottom: 8 }}>⛔ หน้านี้ปิดการบันทึกขายแล้ว — ใช้ค้นหา/ดูใบขายเดิมเท่านั้น</div>
          <div style={{ fontSize: 14, color: "#7f1d1d", marginBottom: 10 }}>
            รถคันนี้ยังไม่ถูกขาย: <b style={{ fontFamily: "monospace" }}>{vehicle.engine_no || "-"}</b>
            {vehicle.chassis_no ? <> · เลขถัง <b style={{ fontFamily: "monospace" }}>{vehicle.chassis_no}</b></> : null}
            {" "}({vehicle.model_name || vehicle.model_code || ""}{vehicle.color_name ? " สี" + vehicle.color_name : ""})
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#166534" }}>
            👉 กรุณาบันทึกขายที่เมนู <span style={{ background: "#dcfce7", padding: "2px 10px", borderRadius: 6 }}>ขายรถ › บันทึกขาย NEW</span> เท่านั้น
          </div>
        </div>
      ) : vehicle && (
        <>
          <SectionBar icon={"📄"} title={`ใบขาย ${text(sale?.sale_no) || ""}`} />

          {mode === "sold_other" && (
            <div style={{ background: "#fffaeb", color: "#b54708", padding: 14, borderRadius: 8, marginBottom: 14 }}>
              ⚠️ รถคันนี้ถูกตัดออกจากสต๊อกแล้ว (ขายเมื่อ {thaiDate(vehicle.sold_at)}{vehicle.sold_invoice_no ? `, อ้างอิง ${vehicle.sold_invoice_no}` : ""}) — ไม่มีใบขายในระบบนี้
            </div>
          )}

          {/* ===================== ข้อมูลรถ ===================== */}
          <Card>
            <SectionHead title="ข้อมูลรถ" />
            <CardBody>
              <Grid>
                <Field label="เลขที่ใบขาย" value={<Box>{text(sale?.sale_no) || "(ออกอัตโนมัติเมื่อบันทึก)"}</Box>}
                  extra={sale?.sale_status ? <span style={{ color: "#d92d20", fontWeight: 600, marginLeft: 12 }}>{sale.sale_status === "10" ? "10 เปิดเอกสาร" : sale.sale_status}</span> : null} />
                <Field label="วันที่ขาย" required value={editable
                  ? <input type="date" value={form.sale_date} onChange={set("sale_date")} style={inp} />
                  : <Box>{thaiDate(sale?.sale_date)}</Box>} />
                <Field label="ยี่ห้อ" value={<Box>{vehicle.brand}</Box>} />
                <Field label="ราคาทุน" value={<MoneyBox>{baht(vehicle.unit_cost)}</MoneyBox>} />
                <Field label="หมายเลขตัวถัง" value={<Box>{vehicle.chassis_no || "-"}</Box>} />
                <Field label="หมายเลขเครื่อง" value={<Box>{vehicle.engine_no || "-"}</Box>} />
                <Field
                  label="รุ่น/แบบ/type/สี"
                  value={
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
                      {[
                        ["รุ่น", vehicle.model_name, 150],
                        ["แบบ", vehicle.model_code, 150],
                        ["type", vehicle.model_type, 90],
                        ["สี", vehicle.color_name || vehicleColorName || vehicle.model_color, 110],
                      ].filter(([, v]) => v).map(([lab, v, w]) => (
                        <span key={lab} style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>{lab}</span>
                          <Box w={w}>{v}</Box>
                        </span>
                      ))}
                      {/* enriched จาก master series */}
                      {(selectedSeries?.marketing_name || selectedSeriesCC != null) && (
                        <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", paddingBottom: 6 }}>
                          {selectedSeries?.marketing_name && (
                            <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                              {selectedSeries.marketing_name}{selectedSeries.marketing_name_th ? ` (${selectedSeries.marketing_name_th})` : ""}
                            </span>
                          )}
                          {selectedSeriesCC != null && (
                            <span style={{ background: "#fef3c7", color: "#854d0e", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                              {selectedSeriesCC} cc
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  }
                  full
                />
                <Field label="รหัสลูกค้า" value={editable
                  ? <div style={{ display: "flex", gap: 6, alignItems: "center", width: "100%" }}>
                      <input value={form.customer_code} onChange={set("customer_code")} placeholder="รหัสลูกค้า" style={inp} />
                      <button type="button" onClick={() => setShowCustomer(true)} style={btn("#2563eb")}>🔍 เลือก/เพิ่ม</button>
                    </div>
                  : <Box>{sale?.customer_code || "-"}</Box>} />
                <Field label="ชื่อลูกค้า" required value={editable
                  ? <input value={form.customer_name} onChange={set("customer_name")} placeholder="ชื่อ-สกุล ลูกค้า (เลือกจากปุ่ม หรือพิมพ์เอง)" style={inp} />
                  : <Box>{sale?.customer_name || "-"}</Box>} />
                <Field label="ที่อยู่" full value={<Box>{(editable ? form.customer_address : sale?.customer_address) || "—"}</Box>} />
                <Field label="เบอร์โทร" value={<Box>{(editable ? form.customer_phone : sale?.customer_phone) || "—"}</Box>} />
                <Field label="วันเกิด" value={<Box>{(() => { const b = editable ? form.customer_birthdate : sale?.customer_birthdate; return b ? thaiDate(b) : "—"; })()}</Box>} />
                <Field label="ผู้ขาย" required value={editable
                  ? <input value={form.seller} onChange={set("seller")} style={inp} />
                  : <Box>{sale?.seller || "-"}</Box>} />
                <div />
                <Field label="หมายเหตุ" full value={editable
                  ? <textarea value={form.note} onChange={set("note")} style={{ ...inp, minHeight: 60, resize: "vertical" }} />
                  : <TextArea>{sale?.note}</TextArea>} />
              </Grid>
            </CardBody>
          </Card>

          {/* ===================== ค่าใช้จ่าย ===================== */}
          {mode !== "sold_other" && (
            <Card>
              <SectionHead title="ค่าใช้จ่าย" />
              <CardBody>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 28, justifyContent: "center", marginBottom: 22 }}>
                  {FINANCE_OPTIONS.map((o) => (
                    <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, cursor: editable ? "pointer" : "default" }}>
                      <input type="radio" name="finance" disabled={!editable}
                        checked={(editable ? form.finance_type : sale?.finance_type) === o.value}
                        onChange={() => editable && setForm((f) => ({ ...f, finance_type: o.value }))} />
                      {o.label}
                    </label>
                  ))}
                </div>

                {/* ราคาประกาศ + บวกเพิ่ม (auto จากรุ่นรถ + ไฟแนนซ์ที่เลือก + สาขา) */}
                {editable && matchedTypes.length > 0 && (
                  <div style={{ marginBottom: 14, padding: "10px 14px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, fontSize: 14 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: applicableMarkups.length ? 6 : 0 }}>
                      <span style={{ fontWeight: 700, color: "#0369a1" }}>📋 ราคาประกาศ</span>
                      <span style={{ color: "#475569", fontSize: 12 }}>
                        ({isFinance(form.finance_type) ? "ไฟแนนซ์" : "เงินสด"} · {branchGroup})
                      </span>
                      {announcedPrice != null ? (
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#0369a1" }}>{baht(announcedPrice)} บาท</span>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: 13 }}>— ไม่พบราคาในตาราง —</span>
                      )}
                      {usingBookingPrice && (
                        <span title={`ลูกค้าจองไว้วันที่ ${thaiDate(bookingDateISO)} — ใช้ราคาประกาศที่มีผล ณ วันจอง (ไม่ใช่ราคาปัจจุบัน)`}
                          style={{ padding: "1px 8px", borderRadius: 10, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 700, cursor: "help" }}>
                          🔖 ราคา ณ วันจอง {thaiDate(bookingDateISO)}
                        </span>
                      )}
                    </div>

                    {applicableMarkups.length > 0 && (
                      <div style={{ marginLeft: 18, marginTop: 4, fontSize: 13, color: "#7c3aed" }}>
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>+ บวกเพิ่ม</div>
                        {applicableMarkups.map((m, i) => {
                          const label = m.markup_type === "finance" ? `ตามไฟแนนท์: ${m.finance_company || "-"}`
                            : m.markup_type === "finance_cc" ? `ตามไฟแนนท์+CC: ${m.finance_company || "-"} (${m.cc_min || "0"}-${m.cc_max || "∞"} cc)`
                            : m.markup_type === "custom" ? `กำหนดเอง: ${m.brand || ""} ${m.model_code || ""}` : m.markup_type;
                          return <div key={i} style={{ fontSize: 12 }}>• {label}: <strong>+{baht(m.markup_amount)}</strong></div>;
                        })}
                        <div style={{ fontWeight: 700, marginTop: 2 }}>รวมบวกเพิ่ม: +{baht(markupsTotal)}</div>
                      </div>
                    )}

                    {/* รายการปรับแต่ง */}
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed #bae6fd" }}>
                      <div style={{ fontWeight: 700, color: "#7c3aed", marginBottom: 6, fontSize: 13 }}>⚙️ รายการปรับแต่ง</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        <AdjRow label="ค่านำพา" checked={useDeliveryFee} onCheck={setUseDeliveryFee}
                          value={deliveryFee} onChange={setDeliveryFee}
                          extra={deliveryBonus > 0 ? `(+โบนัส ${baht(deliveryBonus)})` : ""} />
                        <AdjRow label="เงินดาวน์/ค่างวดออกแทน" checked={useDownPayout} onCheck={setUseDownPayout}
                          value={downPayout} onChange={setDownPayout}
                          extra={downPayoutCalc > 0 ? `(× 1.07 = ${baht(downPayoutCalc)})` : ""} />
                      </div>
                      {adjustmentsTotal > 0 && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", marginTop: 6 }}>รวมปรับแต่ง: +{baht(adjustmentsTotal)}</div>
                      )}
                    </div>

                  </div>
                )}

                {/* บริษัทไฟแนนซ์ + จำนวนงวด + ดอกเบี้ย (โผล่เมื่อเลือกจัดไฟแนนซ์) */}
                {editable && isFinance(form.finance_type) && (
                  <Grid>
                    <Field label="บริษัทไฟแนนซ์" full value={
                      <select
                        value={form.finance_company_code}
                        onChange={(e) => {
                          const code = e.target.value;
                          const fc = financeCompanies.find((x) => String(x.company_code || x.company_id) === code);
                          setForm((f) => ({ ...f, finance_company_code: code, finance_company_name: fc?.company_name || "" }));
                        }}
                        style={{ ...inp, width: "100%" }}>
                        <option value="">— เลือกบริษัทไฟแนนซ์ —</option>
                        {financeCompanies.map((fc) => (
                          <option key={fc.company_id} value={String(fc.company_code || fc.company_id)}>
                            {fc.company_name}{fc.company_code ? ` (${fc.company_code})` : ""}
                          </option>
                        ))}
                      </select>
                    } />
                    <Field label="อัตราดอกเบี้ย" unitText="% (ต่อเดือน)" value={
                      <input value={form.interest_rate} onChange={set("interest_rate")} style={money} />
                    } />
                    <Field label="จำนวนงวด" required unitText="งวด" value={
                      <input value={form.installments} onChange={set("installments")} style={money} placeholder="0" />
                    } />
                    <Field label="ยอดผ่อน/งวด" unit value={
                      <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
                        <input value={installmentOverride}
                          onChange={(e) => { setInstallmentOverride(e.target.value); setInstallmentTouched(true); }}
                          style={{ ...money, flex: 1 }} placeholder={calc.installment ? baht(calc.installment) : "0"} />
                        <label title="ปัดขึ้นให้ลงท้าย 0 หรือ 5"
                          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#475569", cursor: "pointer", whiteSpace: "nowrap" }}>
                          <input type="checkbox" checked={installmentRound}
                            onChange={(e) => { setInstallmentRound(e.target.checked); setInstallmentTouched(false); }} />
                          ปัดเศษ 0/5
                        </label>
                      </div>
                    } />
                    <Field label="ค่างวดจ่ายล่วงหน้า" unit value={
                      <input value={advanceOverride}
                        onChange={(e) => setAdvanceOverride(e.target.value)}
                        style={money} placeholder="0.00" />
                    } />
                  </Grid>
                )}

                <Grid>
                  <Field label="ราคารถ" required unit value={editable
                    ? (finalPrice != null
                      ? <div title="ล็อกตามราคาประกาศ + บวกเพิ่ม + ปรับแต่ง — แก้ไขเองไม่ได้"><MoneyBox>{baht(calc.carPrice)}</MoneyBox></div>
                      : <input value={form.car_price} onChange={set("car_price")} style={money} placeholder="0.00" />)
                    : <MoneyBox>{baht(sale?.car_price)}</MoneyBox>} />
                  <Field label="ราคารถสุทธิ" unit value={<MoneyBox>{baht(editable ? calc.netCar : sale?.net_car_price)}</MoneyBox>} />
                  <Field label="ส่วนลด" unit value={editable
                    ? (finalPrice != null
                      ? <div title="ส่วนลดเติมอัตโนมัติจากของแถม 'เงินดาวน์ออกแทน' เท่านั้น — แก้ไขเองไม่ได้"><MoneyBox>{baht(calc.discount)}</MoneyBox></div>
                      : <input value={form.discount} onChange={set("discount")} style={money} placeholder="0.00" />)
                    : <MoneyBox>{baht(sale?.discount)}</MoneyBox>} />
                  <Field label="ยอดขายอื่นๆ" unit value={editable
                    ? <input value={form.other_sale} onChange={set("other_sale")} style={money} placeholder="0.00" />
                    : <MoneyBox>{baht(sale?.other_sale)}</MoneyBox>} />
                  <Field label="เงินดาวน์" unit value={editable
                    ? <input value={form.down_payment} onChange={set("down_payment")} style={money} placeholder="0.00" />
                    : <MoneyBox>{baht(sale?.down_payment)}</MoneyBox>} />
                  <Field label="เงินจอง" unit value={editable
                    ? <div style={{ width: "100%" }}>
                        <input value={form.booking_deposit} onChange={set("booking_deposit")} style={{ ...money, width: "100%" }} placeholder="0.00" title="ดึงอัตโนมัติจากใบจอง/มัดจำของลูกค้าชื่อเดียวกัน" />
                        {form.deposit_no && <div style={{ fontSize: 10, color: "#0369a1", fontFamily: "monospace", marginTop: 2 }}>🔗 {form.deposit_no} (ดึงอัตโนมัติ)</div>}
                      </div>
                    : <MoneyBox>{baht(sale?.booking_deposit)}</MoneyBox>} />
                  {/* ประกันรถหายของไฟแนนซ์ (ลูกค้าจ่ายเบี้ย) — ไฟแนนซ์หักเบี้ยจากยอดโอนค่ารถ
                      จึงนับเงินก้อนนี้เป็นยอดชำระค่ารถ · ไม่บวกเข้าราคารถ · กรอกเบี้ยตรง ๆ */}
                  {(editable ? isFinance(form.finance_type) : Number(sale?.theft_insurance_amount) > 0) && (
                    <Field label="ประกันรถหาย (ไฟแนนซ์หัก)" unit value={editable
                      ? <div style={{ width: "100%" }}>
                          <input value={theftInsManual} onChange={(e) => setTheftInsManual(e.target.value)} style={{ ...money, width: "100%" }} placeholder="0.00"
                            title="เบี้ยประกันรถหายของไฟแนนซ์ที่ลูกค้าจ่าย — ไฟแนนซ์จะหักเบี้ยนี้จากยอดโอนค่ารถ" />
                          <div style={{ fontSize: 10, color: "#0f766e", marginTop: 2 }}>เบี้ยที่ลูกค้าจ่าย — นับเป็นยอดชำระค่ารถ</div>
                        </div>
                      : <MoneyBox>{baht(sale?.theft_insurance_amount)}</MoneyBox>} />
                  )}
                  <Field label="รวมยอดชำระ" unit value={
                    <div style={{ width: "100%" }} title={theftInsFin > 0 ? "รวมเบี้ยประกันรถหายที่ลูกค้าจ่าย (นับเป็นยอดชำระค่ารถ — ไฟแนนซ์จะโอนเงินขาดเท่าเบี้ย)" : ""}>
                      <MoneyBox>{baht(editable ? totalPaymentEff : sale?.total_payment)}</MoneyBox>
                      {editable && theftInsFin > 0 && (
                        <div style={{ fontSize: 10, color: "#0f766e", marginTop: 2 }}>รวมเบี้ยประกันรถหาย {baht(theftInsFin)} · ไฟแนนซ์จะโอนขาดเท่าเบี้ยนี้</div>
                      )}
                    </div>} />
                  <div />
                </Grid>

                <div style={{ display: "flex", gap: 24, justifyContent: "flex-end", margin: "18px 6px 4px" }}>
                  <StatusFlag ok={(sale?.payment_status) === "paid"} label={(sale?.payment_status) === "paid" ? "ชำระเงินแล้ว" : "ยังไม่ชำระเงิน"} />
                  <StatusFlag ok={(sale?.tax_invoice_status) === "issued"} label="ใบกำกับภาษีรถ" />
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 10 }}>
                  {editable ? (
                    <button style={btn("#2e9e4f")} disabled={saving} onClick={handleSave}>{saving ? "บันทึก…" : "💾 บันทึกการขาย"}</button>
                  ) : (
                    <>
                      <button style={btn("#0369a1")} onClick={handlePrint}>🖨️ พิมพ์</button>
                      {(() => {
                        const sent = lineStatus.sale === "sent";
                        const pending = linePending?.type === "sale";
                        // เคยส่งสำเร็จแล้ว (จากประวัติใน DB) → ส่งซ้ำได้เฉพาะ admin
                        const resendLocked = !isAdmin && (sent || lineSentBefore("sale"));
                        const disabled = lineSending === "sale" || pending || resendLocked;
                        return (
                          <button style={{ ...btn(resendLocked || sent ? "#94a3b8" : "#06C755"), cursor: disabled ? "not-allowed" : "pointer" }} disabled={disabled} onClick={sendSaleLine}
                            title={resendLocked ? "ใบนี้เคยส่ง LINE แล้ว — ส่งซ้ำได้เฉพาะ admin" : sent ? "ส่งแล้ว" : ""}>
                            {lineSending === "sale" ? "ส่ง…" : pending ? "⏰ กำลังจะส่ง…" : resendLocked ? "✅ ส่ง LINE แล้ว (admin ส่งซ้ำได้)" : sent ? "✅ ส่ง LINE แล้ว" : lineSentBefore("sale") ? "📤 ส่งใบขายซ้ำ (admin)" : "📤 ส่งใบขาย LINE"}
                          </button>
                        );
                      })()}
                      <button style={btn("#e03b3b")} disabled={saving} onClick={handleCancel}>{saving ? "…" : "✖ ยกเลิกใบขาย"}</button>
                    </>
                  )}
                  <button style={btn("#8aa0a6")} onClick={() => { reset(); setKeyword(""); }}>⤺ ปิด</button>
                </div>

                {!editable && sale?.sale_no && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, display: "flex", gap: 10, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#6b21a8" }}>📄 เอกสาร พ.ร.บ. ลูกค้า:</span>
                    <input type="file" accept="application/pdf" onChange={(e) => setActFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                    {(() => {
                      const sent = lineStatus.act === "sent";
                      const pending = linePending?.type === "act";
                      const disabled = !actFile || actUploading || sent || pending;
                      return (
                        <button
                          style={{ ...btn(sent ? "#94a3b8" : "#7c3aed"), opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
                          disabled={disabled}
                          onClick={() => uploadDoc(actFile, "act", "เอกสาร พ.ร.บ.", setActFile, setActUploading)}
                          title={sent ? "ส่งแล้ว — ปิดแล้วเปิดใหม่เพื่อส่งอีกครั้ง" : ""}
                        >
                          {actUploading ? "กำลังส่ง…" : pending ? "⏰ กำลังจะส่ง…" : sent ? "✅ ส่ง พ.ร.บ. แล้ว" : "⬆️ อัปโหลด + แจ้ง พ.ร.บ. (LINE)"}
                        </button>
                      );
                    })()}
                  </div>
                )}

                {!editable && sale?.sale_no && (
                  <div style={{ marginTop: 10, padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, display: "flex", gap: 10, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1e40af" }}>📄 เอกสาร 3PLUS/RSA/PA:</span>
                    <input type="file" accept="application/pdf" onChange={(e) => setCosmosFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                    {(() => {
                      const sent = lineStatus.cosmos === "sent";
                      const pending = linePending?.type === "cosmos";
                      const disabled = !cosmosFile || cosmosUploading || sent || pending;
                      return (
                        <button
                          style={{ ...btn(sent ? "#94a3b8" : "#0369a1"), opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
                          disabled={disabled}
                          onClick={() => uploadDoc(cosmosFile, "cosmos", "เอกสาร 3PLUS/RSA/PA", setCosmosFile, setCosmosUploading)}
                          title={sent ? "ส่งแล้ว — ปิดแล้วเปิดใหม่เพื่อส่งอีกครั้ง" : ""}
                        >
                          {cosmosUploading ? "กำลังส่ง…" : pending ? "⏰ กำลังจะส่ง…" : sent ? "✅ ส่ง 3PLUS/RSA/PA แล้ว" : "⬆️ อัปโหลด + ส่ง 3PLUS/RSA/PA (LINE)"}
                        </button>
                      );
                    })()}
                  </div>
                )}

                {!editable && sale?.sale_no && (
                  <div style={{ marginTop: 10, padding: "10px 14px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 10, display: "flex", gap: 10, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0f766e" }}>📄 ส่งเอกสารประกันรถหาย (PDF):</span>
                    <input type="file" accept="application/pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                    {(() => {
                      const sent = lineStatus.doc === "sent";
                      const pending = linePending?.type === "doc";
                      const disabled = !docFile || docUploading || sent || pending;
                      return (
                        <button
                          style={{ ...btn(sent ? "#94a3b8" : "#0f766e"), opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
                          disabled={disabled}
                          onClick={() => uploadDoc(docFile, "doc", "เอกสารประกันรถหาย", setDocFile, setDocUploading)}
                          title={sent ? "ส่งแล้ว — ปิดแล้วเปิดใหม่เพื่อส่งอีกครั้ง" : ""}
                        >
                          {docUploading ? "กำลังส่ง…" : pending ? "⏰ กำลังจะส่ง…" : sent ? "✅ ส่งประกันรถหายแล้ว" : "⬆️ อัปโหลด + ส่งประกันรถหาย (LINE)"}
                        </button>
                      );
                    })()}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* ===================== จัดไฟแนนซ์ (view mode — แสดงข้อมูลที่บันทึกไว้) ===================== */}
          {mode !== "sold_other" && !editable && isFinance(sale?.finance_type) && (
            <Card>
              <SectionHead title="จัดไฟแนนซ์" />
              <CardBody>
                <Grid>
                  <Field label="บริษัทไฟแนนซ์" full value={
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Box w={200}>{sale?.finance_company_code}</Box>
                      <span style={{ color: "#333", fontWeight: 600 }}>{sale?.finance_company_name}</span>
                    </div>
                  } />
                  <Field label="ราคารถ" unit value={<MoneyBox>{baht(sale?.car_price)}</MoneyBox>} />
                  <Field label="เงินดาวน์" unit value={<MoneyBox>{baht(sale?.down_payment)}</MoneyBox>} />
                  <Field label="อัตราดอกเบี้ย" unitText="% (ต่อเดือน)" value={<MoneyBox>{sale?.interest_rate}</MoneyBox>} />
                  <Field label="ยอดจัดไฟแนนซ์" unit value={<MoneyBox>{baht(sale?.finance_amount)}</MoneyBox>} />
                  <Field label="จำนวนงวด" unitText="งวด" value={<MoneyBox>{sale?.installments}</MoneyBox>} />
                  <Field label="ยอดผ่อน/งวด" unit value={<MoneyBox>{baht(sale?.installment_amount)}</MoneyBox>} />
                  <Field label="ค่างวดจ่ายล่วงหน้า" unit value={<MoneyBox>{baht(sale?.advance_installment)}</MoneyBox>} />
                  <div />
                  <Field label="หมายเหตุ" full value={<TextArea>{sale?.finance_note}</TextArea>} />
                </Grid>
              </CardBody>
            </Card>
          )}

          {/* ===================== ของแถม (จาก ค่าใช้จ่ายการขาย ประเภท=promotion) ===================== */}
          {mode !== "sold_other" && editable && applicableGiveaways.length > 0 && (
            <Card>
              <SectionHead title="🎁 ของแถม-บริการ" />
              <CardBody>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>เลือกของแถมที่ลูกค้าได้รับ — รายการมาจาก "บันทึกค่าใช้จ่ายการขาย" (ประเภท: โปรโมชั่น)</span>
                  <button type="button" onClick={reloadGiveaways} disabled={reloadingGiveaways}
                    title="โหลดรายการของแถมใหม่จากระบบ (กรณีเพิ่ม/แก้รายการ)"
                    style={{ padding: "4px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    {reloadingGiveaways ? "..." : "🔄 รีเฟรช"}
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
                  {displayGiveaways.map((g) => {
                    if (g.__merged) {
                      const checked = g.ids.every((id) => selectedGiveaways[id]);
                      return (
                        <label key={g.key}
                          style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", background: checked ? "#fef9c3" : "#fff", border: `1px solid ${checked ? "#facc15" : "#e2e8f0"}`, borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                          <input type="checkbox" checked={checked}
                            onChange={(e) => setSelectedGiveaways((s) => { const ns = { ...s }; g.ids.forEach((id) => { ns[id] = e.target.checked; }); return ns; })} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: "#1e293b" }}>{g.expense_name}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>
                              <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "1px 6px", borderRadius: 3, marginRight: 4 }}>{g.category}</span>
                              <span>· รวม {g.count} รายการ</span>
                            </div>
                          </div>
                          <span style={{ fontWeight: 700, color: "#dc2626" }}>{baht(g.amount)}</span>
                        </label>
                      );
                    }
                    const checked = !!selectedGiveaways[g.expense_id];
                    return (
                      <label key={g.expense_id}
                        style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", background: checked ? "#fef9c3" : "#fff", border: `1px solid ${checked ? "#facc15" : "#e2e8f0"}`, borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                        <input type="checkbox" checked={checked}
                          onChange={(e) => setSelectedGiveaways((s) => ({ ...s, [g.expense_id]: e.target.checked }))} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: "#1e293b" }}>{g.expense_name}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            {g.category && <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "1px 6px", borderRadius: 3, marginRight: 4 }}>{g.category}</span>}
                            {g.group_by === "brand" && g.brand_name && <span>🏷️ {g.brand_name}</span>}
                            {g.group_by === "type" && <span>🔖 Type: {g.type_name || "-"}{g.brand_name ? ` (${g.brand_name})` : ""}</span>}
                            {g.group_by === "cc" && g.engine_cc && <span>⚙️ {g.engine_cc} cc</span>}
                            {g.group_by === "finance" && g.company_name && <span>💳 {g.company_name}</span>}
                            {g.group_by === "province" && <span>📍 {g.province || g.province_target || "ตามจังหวัด"}</span>}
                            {g.group_by === "series" && <span>🏍️ รุ่น: {motoSeries.find(x => String(x.series_id) === String(String(g.note || "").split("|")[0]))?.series_name || selectedSeries?.series_name || "รุ่นนี้"}</span>}
                            {g.group_by === "name_prefix" && <span>🔤 ขึ้นต้น: {g.note}</span>}
                          </div>
                        </div>
                        <span style={{ fontWeight: 700, color: "#dc2626" }}>{baht(g.amount)}</span>
                      </label>
                    );
                  })}
                </div>
                {giveawaysTotal > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 10, fontSize: 14 }}>
                    <span style={{ color: "#64748b" }}>รวมของแถมที่ให้:</span>
                    <span style={{ fontWeight: 800, color: "#dc2626" }}>{baht(giveawaysTotal)} บาท</span>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* ===================== ของแถม-สินค้า (จาก giveaway_rules) ===================== */}
          {mode !== "sold_other" && editable && productGiveaways.length > 0 && (
            <Card>
              <SectionHead title="🎁 ของแถม-สินค้า" />
              <CardBody>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                  รายการมาจาก "Master Data → บันทึกของแถม" (รวมทั้งระดับยี่ห้อ/รุ่น/แบบ ที่ตรงกับรถคันนี้)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
                  {productGiveaways.map((g) => {
                    const checked = !!selectedProductGiveaways[g.id];
                    return (
                      <label key={g.id}
                        style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", background: checked ? "#fef9c3" : "#fff", border: `1px solid ${checked ? "#facc15" : "#e2e8f0"}`, borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                        <input type="checkbox" checked={checked}
                          onChange={(e) => setSelectedProductGiveaways((s) => ({ ...s, [g.id]: e.target.checked }))} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: "#1e293b" }}>
                            <span style={{ fontFamily: "monospace", color: "#0369a1", marginRight: 6 }}>{g.part_code}</span>
                            {g.fmp_product_name || g.part_name || "-"}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                            <span style={{ background: g.level === "type" ? "#dcfce7" : g.level === "series" ? "#fef3c7" : "#dbeafe", color: g.level === "type" ? "#15803d" : g.level === "series" ? "#a16207" : "#1e40af", padding: "1px 6px", borderRadius: 3, marginRight: 4, fontWeight: 700 }}>
                              {g.level === "type" ? "แบบ" : g.level === "series" ? "รุ่น" : "ยี่ห้อ"}
                            </span>
                            {g.note && <span>· {g.note}</span>}
                          </div>
                        </div>
                        <span style={{ fontWeight: 700, color: "#dc2626" }}>× {Number(g.qty || 1)}</span>
                      </label>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          )}

          {/* ===================== รับชำระเงิน ===================== */}
          {mode !== "sold_other" && !editable && sale && (
            <Card>
              <SectionHead title="💵 รับชำระเงิน" />
              <CardBody>
                {isPaid ? (
                  <div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "baseline", marginBottom: 10 }}>
                      <div><span style={{ color: "#64748b" }}>เลขที่ใบเสร็จ: </span><b style={{ color: "#047857", fontFamily: "monospace" }}>{sale.receipt_no || "-"}</b></div>
                      <div><span style={{ color: "#64748b" }}>วันที่: </span><b>{thaiDate(sale.receipt_date)}</b></div>
                      <div><span style={{ color: "#64748b" }}>รวมรับชำระ: </span><b style={{ color: "#047857" }}>{baht(sale.paid_amount)} บาท</b></div>
                    </div>
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
                      {(Array.isArray(sale.payment_methods) ? sale.payment_methods : []).map((p, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px", borderTop: i ? "1px solid #f1f5f9" : "none", fontSize: 13 }}>
                          <span>{p.method}{p.account_name ? <span style={{ color: "#64748b" }}> · {p.account_name}</span> : null}</span>
                          <b>{baht(p.amount)} บาท</b>
                        </div>
                      ))}
                    </div>
                    {sale.payment_received_note && <div style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>หมายเหตุ: {sale.payment_received_note}</div>}
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
                      <button style={btn("#0369a1")} onClick={handlePrintReceipt}>🖨️ พิมพ์ใบเสร็จ</button>
                      {(() => {
                        const sent = lineStatus.receipt === "sent";
                        const pending = linePending?.type === "receipt";
                        // เคยส่งใบเสร็จสำเร็จแล้ว → ส่งซ้ำได้เฉพาะ admin
                        const resendLocked = !isAdmin && (sent || lineSentBefore("receipt"));
                        const disabled = lineSending === "receipt" || pending || resendLocked;
                        return (
                          <button style={{ ...btn(resendLocked ? "#94a3b8" : "#06C755"), cursor: disabled ? "not-allowed" : "pointer" }} disabled={disabled} onClick={sendReceiptLine}
                            title={resendLocked ? "ใบนี้เคยส่งใบเสร็จแล้ว — ส่งซ้ำได้เฉพาะ admin" : ""}>
                            {lineSending === "receipt" ? "ส่ง…" : pending ? "⏰ กำลังจะส่ง…" : resendLocked ? "✅ ส่งใบเสร็จแล้ว (admin ส่งซ้ำได้)" : lineSentBefore("receipt") || sent ? "🧾 ส่งใบเสร็จซ้ำ (admin)" : "🧾 ส่งใบเสร็จ LINE"}
                          </button>
                        );
                      })()}
                      <button style={btn("#e03b3b")} disabled={payingSave} onClick={cancelPayment}>{payingSave ? "…" : "✖ ยกเลิกรับชำระ"}</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Grid>
                      <Field label="วันที่รับชำระ" required value={<input type="date" value={payForm.receipt_date} onChange={(e) => setPayForm((f) => ({ ...f, receipt_date: e.target.value }))} style={inp} />} />
                      <Field label="รวมยอดต้องชำระ" value={<MoneyBox>{baht(sale.total_payment)}</MoneyBox>} />
                    </Grid>
                    {/* เงินดาวน์/ค่างวดออกแทน — ของแถมที่ร้านออกให้ หักออกจากยอดที่เก็บลูกค้า */}
                    {Number(sale.down_payout_amount) > 0 && (
                      <div style={{ marginTop: 8, padding: "8px 12px", background: "#fef9c3", border: "1px solid #fbbf24", borderRadius: 6, fontSize: 13, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <span>🎁 ของแถม: เงินดาวน์/ค่างวดออกแทน <b style={{ color: "#dc2626" }}>-{baht(sale.down_payout_amount)} บาท</b></span>
                        <span>ยอดต้องเก็บสุทธิ: <b style={{ color: "#047857", fontSize: 15 }}>{baht(Number(sale.total_payment || 0) - Number(sale.down_payout_amount || 0))} บาท</b></span>
                      </div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: "#334155" }}>ชำระโดย</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                      {payLines.map((p, i) => {
                        const needAcc = p.method === "โอน" || p.method === "บัตร/QR";
                        return (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <select value={p.method} onChange={(e) => updatePayLine(i, { method: e.target.value })} style={{ ...inp, width: 130, flex: "none" }}>
                              {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select value={p.account_id} onChange={(e) => updatePayLine(i, { account_id: e.target.value })} disabled={!needAcc} style={{ ...inp, flex: 1, minWidth: 180, opacity: needAcc ? 1 : 0.5 }}>
                              <option value="">{needAcc ? "— เลือกบัญชี —" : "—"}</option>
                              {bankAccounts.filter((a) => a.account_type !== "เงินสดย่อย" && a.account_type !== "ลูกหนี้").map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name}{a.account_no && a.account_no !== "-" ? ` · ${a.account_no}` : ""}{a.bank_name && a.bank_name !== "-" ? ` (${a.bank_name})` : ""}</option>)}
                            </select>
                            <input type="number" value={p.amount} onChange={(e) => updatePayLine(i, { amount: e.target.value })} placeholder="ยอด" style={{ ...inp, width: 120, flex: "none", textAlign: "right" }} />
                            <button type="button" onClick={() => removePayLine(i)} disabled={payLines.length <= 1} style={{ ...btn("#94a3b8"), padding: "6px 10px" }}>✕</button>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                      <button type="button" onClick={addPayLine} style={{ ...btn("#0ea5e9"), padding: "6px 12px" }}>+ เพิ่มช่องทาง</button>
                      <div style={{ fontSize: 14 }}>
                        <span style={{ color: "#64748b" }}>รวมรับชำระ: </span>
                        {(() => {
                          const expect = Number(sale.total_payment || 0) - Number(sale.down_payout_amount || 0);
                          return (<>
                            <b style={{ color: payTotal === expect ? "#047857" : "#d97706" }}>{baht(payTotal)} บาท</b>
                            {payTotal !== expect && <span style={{ color: "#d97706", fontSize: 12, marginLeft: 6 }}>(ต่างจากยอดต้องเก็บสุทธิ)</span>}
                          </>);
                        })()}
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <input value={payForm.note} onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} placeholder="หมายเหตุการรับชำระ (ถ้ามี)" style={{ ...inp, width: "100%" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
                      <button style={btn("#2e9e4f")} disabled={payingSave} onClick={savePayment}>{payingSave ? "บันทึก…" : "💾 บันทึกรับชำระเงิน"}</button>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* ===================== ใบกำกับภาษี ===================== */}
          {mode !== "sold_other" && (
            <Card>
              <SectionHead title="ใบกำกับภาษี" />
              <CardBody>
                <div style={{ color: "#98a2b3", padding: "8px 4px" }}>
                  {(sale?.tax_invoice_status) === "issued" ? "ออกใบกำกับภาษีแล้ว" : "ยังไม่ได้ออกใบกำกับภาษี"}
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}

      {showCustomer && (
        <CustomerPickerModal currentUser={currentUser} onSelect={pickCustomer} onClose={() => setShowCustomer(false)} />
      )}

      {showBookingPicker && (
        <div onClick={() => setShowBookingPicker(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, width: "min(900px, 96vw)", maxHeight: "85vh", overflow: "auto", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#0369a1" }}>🔍 รายการจอง (รุ่น: {parsedModel.base || "-"})</h3>
              <button onClick={() => setShowBookingPicker(false)} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>
            <div style={{ padding: "10px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <span style={{ color: "#475569" }}>สาขา:</span>
                <select value={bookingBranchFilter} onChange={(e) => setBookingBranchFilter(e.target.value)}
                  style={{ padding: "5px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, minWidth: 200 }}>
                  <option value="">ทุกสาขา</option>
                  {bookingBranchOpts.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <span style={{ color: "#475569" }}>สี:</span>
                <select value={bookingColorFilter} onChange={(e) => setBookingColorFilter(e.target.value)}
                  style={{ padding: "5px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, minWidth: 140 }}>
                  <option value="">ทุกสี</option>
                  {bookingColorOpts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 13 }}>{matchingBookings.length} รายการ</span>
            </div>
            <div style={{ padding: 12 }}>
              {matchingBookings.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>ไม่พบรายการจองสำหรับรุ่นนี้</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead style={{ background: "#f8fafc" }}>
                    <tr>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 12 }}>วันจอง</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 12 }}>สาขา</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 12 }}>ลูกค้า</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 12 }}>รุ่น / สี</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 12 }}>เลขที่มัดจำ</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 12 }}>คงเหลือ</th>
                      <th style={{ padding: "8px 10px", textAlign: "center", fontSize: 12 }}>เลือก</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchingBookings.map((b) => (
                      <tr key={b.booking_id} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{thaiDate(b.booking_date)}</td>
                        <td style={{ padding: "7px 10px", fontSize: 12 }}>{b.branch || "-"}</td>
                        <td style={{ padding: "7px 10px" }}>{b.customer_name || "-"}</td>
                        <td style={{ padding: "7px 10px", fontSize: 12 }}>{b.new_model_code || b.model_code} / {b.new_color_name || b.color_name}</td>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: 11, color: "#0369a1" }}>{b.deposit_no || "-"}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: b.remaining > 0 ? "#065f46" : "#9ca3af" }}>{baht(b.remaining)}</td>
                        <td style={{ padding: "7px 10px", textAlign: "center" }}>
                          <button onClick={() => pickBooking(b)} disabled={!b.deposit_no || b.remaining <= 0}
                            style={{ padding: "4px 12px", background: b.deposit_no && b.remaining > 0 ? "#0369a1" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 4, cursor: b.deposit_no && b.remaining > 0 ? "pointer" : "not-allowed", fontSize: 12 }}>เลือก</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ส่วนประกอบย่อย (presentational)
// ============================================================================
function SectionBar({ icon, title }) {
  return (
    <div style={{ background: TEAL, color: "#fff", padding: "12px 18px", borderRadius: 8, fontWeight: 700, fontSize: 17, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,.25)", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{icon}</span>
      {title}
    </div>
  );
}
function Card({ children }) {
  return <div style={{ border: "1px solid #dfe3e6", borderRadius: 10, overflow: "hidden", marginBottom: 16, background: "#eef2f3" }}>{children}</div>;
}
function SectionHead({ title }) {
  return (
    <div style={{ background: TEAL, color: "#fff", padding: "10px 18px", fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ display: "inline-flex", width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,.3)", alignItems: "center", justifyContent: "center", fontSize: 12 }}>－</span>
      {title}
    </div>
  );
}
function CardBody({ children }) {
  return <div style={{ padding: "22px 26px" }}>{children}</div>;
}
function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 40, rowGap: 16, alignItems: "center" }}>{children}</div>;
}
function Field({ label, required, value, full, unit, unitText, extra }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gridColumn: full ? "1 / -1" : "auto" }}>
      <div style={{ width: 130, textAlign: "right", paddingRight: 14, color: "#333", fontSize: 15, flexShrink: 0 }}>
        {label}
        {required && <span style={{ color: "#d92d20" }}> *</span>}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
        {typeof value === "string" || typeof value === "number" ? <Box>{value}</Box> : value}
        {unit && <span style={{ color: "#333" }}>บาท</span>}
        {unitText && <span style={{ color: "#333" }}>{unitText}</span>}
        {extra}
      </div>
    </div>
  );
}
function Box({ children, w }) {
  return (
    <div style={{ minWidth: w || 0, width: w ? w : "100%", background: FIELD_BG, border: "1px solid #d6dcde", borderRadius: 4, padding: "8px 12px", fontSize: 15, color: "#333", minHeight: 20 }}>
      {children || " "}
    </div>
  );
}
function MoneyBox({ children, w }) {
  return (
    <div style={{ width: w || "100%", background: FIELD_BG, border: "1px solid #d6dcde", borderRadius: 4, padding: "8px 12px", fontSize: 15, color: "#1d4ed8", textAlign: "right", fontWeight: 600 }}>
      {children || " "}
    </div>
  );
}
function TextArea({ children }) {
  return (
    <div style={{ width: "100%", background: "#fff", border: "1px solid #d6dcde", borderRadius: 4, padding: "8px 12px", fontSize: 15, color: "#333", minHeight: 64 }}>
      {children || " "}
    </div>
  );
}
function AdjRow({ label, checked, onCheck, value, onChange, extra }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 10px", background: "#fefce8", border: "1px solid #fde047", borderRadius: 6, cursor: "pointer", minWidth: 280 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} />
      <span style={{ flex: 1, color: "#713f12", fontWeight: 600 }}>{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} disabled={!checked}
        style={{ width: 90, padding: "3px 8px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, textAlign: "right", background: checked ? "#fff" : "#f3f4f6" }} />
      {extra && <span style={{ fontSize: 11, color: "#7c3aed" }}>{extra}</span>}
    </label>
  );
}
function StatusFlag({ ok, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, color: ok ? "#067647" : "#d92d20" }}>
      <span style={{ display: "inline-flex", width: 20, height: 20, borderRadius: "50%", background: ok ? "#067647" : "#e03b3b", color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{ok ? "✓" : "✖"}</span>
      {label}
    </span>
  );
}

const btn = (bg) => ({ padding: "9px 16px", fontSize: 15, fontWeight: 700, color: "#fff", background: bg, border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" });
const inp = { width: "100%", background: "#fff", border: "1px solid #b9c2c6", borderRadius: 4, padding: "8px 12px", fontSize: 15, color: "#333", boxSizing: "border-box" };
const money = { ...inp, textAlign: "right", color: "#1d4ed8", fontWeight: 600 };
