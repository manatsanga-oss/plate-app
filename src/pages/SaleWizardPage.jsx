import React, { useEffect, useMemo, useState } from "react";
import CustomerPickerModal from "./CustomerPickerModal";
import { fetchPriceBranchGroups, priceGroupOf } from "../utils/priceBranchGroup";

// บันทึกขาย NEW — wizard เลือกรถทีละขั้น: ประเภทรถ → ยี่ห้อ → รุ่น → สี (พร้อมรูป) → เลือกคันจากเลขเครื่อง/เลขถัง
// master: master-data-api | รูปสี: get_color_image (moto_color_images) | สต๊อกรายคัน: stock-turnover-api stock_on_hand
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const STOCK_API = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-turnover-api";
const BOOKING_API = "https://n8n-new-project-gwf2.onrender.com/webhook/moto-booking-api";
const DEPOSIT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/booking-deposit-api";
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
const USED_API = "https://n8n-new-project-gwf2.onrender.com/webhook/used-moto-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const GIVEAWAY_API = "https://n8n-new-project-gwf2.onrender.com/webhook/giveaway-rules-api";

// กฎกลุ่มไฟแนนท์ที่มี note "exclude:CODE1,CODE2,BIGBIKE" → ไม่ใช้กับรุ่น/แบบที่ระบุ (เทียบแบบขึ้นต้นด้วยรหัส เช่น ADV160 ครอบ ADV160AT) · BIGBIKE = ประเภทรถมีคำว่า BIG (2026-08-22)
function excludedByNote(note, codes, vehicleTypeName) {
  const m = String(note || "").match(/^exclude:(.*)$/i);
  if (!m) return false;
  const norm = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const toks = m[1].split(",").map(norm).filter(Boolean);
  const cs = (codes || []).map(norm).filter(Boolean);
  const isBig = /BIG/i.test(String(vehicleTypeName || ""));
  // เทียบทิศเดียว: รหัสรถขึ้นต้นด้วย token เท่านั้น (exclude ADV160 ครอบ ADV160AT) —
  // ห้ามกลับทิศ ไม่งั้น series สั้น ๆ เช่น "WW160" ของ PCX160 ไปชน token "WW160SV" ทำให้ AV โดนตัดผิด (บั๊ก 2026-08-29)
  return toks.some((t) => (t === "BIGBIKE" && isBig) || cs.some((c) => c.startsWith(t)));
}

// หัวกระดาษเอกสาร แยกบริษัท ป.เปา (HONDA) / สิงห์ชัย (YAMAHA) — fallback เมื่อโหลด branch_master ไม่ได้
// ปกติหัวกระดาษจริงดึงจาก branch_master ตามสาขาของใบขาย (เหมือนหน้าบันทึกขายปลีก)
const LETTERHEAD = {
  HONDA: {
    name: "บริษัท ป.เปามอเตอร์เซอร์วิส จำกัด - สำนักงานใหญ่",
    addr: "189-191 ม.7 ต.ลำไทร อ.วังน้อย จ.พระนครศรีอยุธยา 13170",
    tel: "โทรศัพท์ : (035)271146-7   แฟกซ์ : (035) 272613",
    tax: "เลขประจำตัวผู้เสียภาษีอากร : 0145546000707   สำนักงานใหญ่",
  },
  YAMAHA: {
    name: "หจก. สิงห์ชัย สยามยนต์ - สำนักงานใหญ่",
    addr: "34 หมู่ 7 ซอย 10 ต.ลำไทร อ.วังน้อย จ.พระนครศรีอยุธยา 13170",
    tel: "",
    tax: "เลขประจำตัวผู้เสียภาษีอากร : 0143543001310   สำนักงานใหญ่",
  },
};
// โลโก้หัวเอกสารรายสาขา — SCY01/SCY04/SCY07 = YAMAHA (สิงห์ชัย), SCY05/SCY06 = ปีกนก HONDA (ป.เปา)
const BRANCH_LOGO = { SCY01: "yamaha", SCY04: "yamaha", SCY07: "yamaha", SCY05: "honda", SCY06: "honda" };
// โลโก้ชี้เว็บ production ตรง ๆ — เอกสารถูกเปิดจาก LINE (นอกแอป) origin ปัจจุบันใช้ไม่ได้
const LOGO_BASE = "https://plate-app-y1z1.onrender.com";
const LOGO_FILES = { yamaha: "/logos/yamaha.svg", honda: "/logos/honda-wing.svg" };

// โหมดทดสอบ UI: true = กดบันทึกแล้ว "ไม่" เขียนลง DB — แค่แสดงหน้าจอหลังบันทึก + ส่ง LINE
// false = บันทึกจริง (save_sale ตัดสต๊อก + save_payment ออกใบเสร็จ ลง DB เหมือนหน้าขายปลีก)
const TEST_MODE = false;

// ของแถมประเภท "เงินดาวน์ออกแทน" — ไม่ใส่ในรายการแถม แต่ไปเป็นส่วนลดแทน (เหมือนบันทึกขายปลีก)
const isDownPaymentSub = (name) => {
  const n = String(name || "").replace(/\s+/g, "");
  return n.includes("เงินดาวน์ออกแทน") || n.includes("ดาวน์ออกแทน");
};

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json().catch(() => null);
}
const asArray = (d) => (Array.isArray(d) ? d : d ? [d] : []);
const text = (v) => String(v == null ? "" : v).trim();
const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(n) ? n : 0; };
// normalize ชื่อสีไทย: ตัด "สี" นำหน้า + ช่องว่าง/ขีด/ทับ + แก้พิมพ์ผิด น้ำงิน
const normColor = (s) => text(s).replace(/^สี/, "").replace(/น้ำงิน/g, "น้ำเงิน").replace(/[\s\-_/]+/g, "");
// normalize ชื่อรุ่น: ตัวใหญ่ + ตัดอักขระคั่น (NMAX = N-MAX)
const normModel = (s) => text(s).toUpperCase().replace(/[^A-Z0-9ก-๙]/g, "");
// normalize สำหรับคิวจอง — ต้องตรงกับ MotoBookingPage / n8n Code node เป๊ะ
const qNormModel = (s) => {
  let str = String(s || "").normalize("NFKC").replace(/ /g, " ").replace(/[()（）]/g, "").replace(/\s+/g, "").toLowerCase();
  const idx = str.indexOf("th");
  if (idx !== -1) str = str.substring(0, idx + 2);
  return str;
};
const qNormColor = (s) => String(s || "").normalize("NFKC").replace(/ /g, " ").replace(/[-–—/:：]/g, "").replace(/\s+/g, "").toLowerCase();
const todayStr = () => new Date().toISOString().slice(0, 10);

const CARD = {
  border: "1.5px solid #d1d5db", borderRadius: 12, background: "#fff", cursor: "pointer",
  padding: 16, textAlign: "center", fontFamily: "Tahoma", transition: "box-shadow .15s, border-color .15s",
};

// แถวรายการปรับแต่ง (checkbox + จำนวนเงิน) — หน้าตาเดียวกับหน้าบันทึกขายปลีก
function AdjRow({ label, checked, onCheck, value, onChange, extra }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 10px", background: "#fefce8", border: "1px solid #fde047", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} />
      <span style={{ flex: 1, color: "#713f12", fontWeight: 600 }}>{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} disabled={!checked}
        style={{ width: 90, padding: "3px 8px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, textAlign: "right", background: checked ? "#fff" : "#f3f4f6" }} />
      {extra && <span style={{ fontSize: 11, color: "#7c3aed" }}>{extra}</span>}
    </label>
  );
}

export default function SaleWizardPage({ currentUser }) {
  // master data
  const [brands, setBrands] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [series, setSeries] = useState([]);
  const [models, setModels] = useState([]);
  const [types, setTypes] = useState([]);
  const [colors, setColors] = useState([]);
  const [priceTypes, setPriceTypes] = useState([]);
  const [prices, setPrices] = useState([]);
  const [financeCos, setFinanceCos] = useState([]);
  const [saleExpenses, setSaleExpenses] = useState([]);   // ของแถม-บริการ (บันทึกค่าใช้จ่ายการขาย ประเภทโปรโมชั่น)
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // จอแคบ (มือถือ) — กริดสรุปยอดขายฝั่งไฟแนนท์ต้องพับเป็น 2 คอลัมน์ ไม่งั้นช่องกรอกโดนเบียดจนมองไม่เห็นเลข
  const [isNarrow, setIsNarrow] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // การเลือกแต่ละขั้น
  const [selType, setSelType] = useState(null);     // vehicle_type row
  const [selBrand, setSelBrand] = useState(null);   // brand row
  const [selSeries, setSelSeries] = useState(null); // series row
  const [selColor, setSelColor] = useState(null);   // color group { key, name, codes, rows }
  const [selUnit, setSelUnit] = useState(null);     // stock row
  const [saleType, setSaleType] = useState(null);   // 'cash' | 'finance'
  const [financeCo, setFinanceCo] = useState(null); // finance company row
  const [imgZoom, setImgZoom] = useState(null);     // data URL รูปที่ขยายดู (null = ปิด)

  // ===== โหมดขายรถมือสอง (การ์ด USED) — ดึงคันจากสต๊อกมือสอง บันทึกขายผ่าน used-moto-api (sell_used) =====
  const USED_PAY_METHODS = ["เงินสด", "เงินโอน", "QR", "อื่นๆ"];
  const [usedMode, setUsedMode] = useState(false);
  const [usedRows, setUsedRows] = useState(null);          // null = กำลังโหลด
  const [usedSel, setUsedSel] = useState(null);            // คันที่เลือก
  const [usedSale, setUsedSale] = useState(null);          // ฟอร์มขาย
  const [usedDone, setUsedDone] = useState(null);          // ผลบันทึกขายสำเร็จ
  const [usedImgs, setUsedImgs] = useState({});            // used_id -> [dataURL]
  const [showUsedCustomer, setShowUsedCustomer] = useState(false);

  async function enterUsedMode() {
    setUsedMode(true); setUsedSel(null); setUsedSale(null); setUsedDone(null); setUsedRows(null); setMessage("");
    try {
      const d = await post(USED_API, { action: "list_used" });
      setUsedRows(asArray(d).filter(r => r && r.id && r.status === "in_stock"));
    } catch { setUsedRows([]); }
  }
  function pickUsed(r) {
    setUsedSel(r); setUsedDone(null);
    setUsedSale({ sold_date: todayStr(), customer_code: "", customer: "", phone: "", address: "", birthdate: "", price: "", rows: [{ method: "เงินสด", amount: "", account: "" }], note: "", saving: false });
    if (num(r.img_count) > 0 && !usedImgs[r.id]) {
      post(USED_API, { action: "get_images", used_id: r.id })
        .then(d => setUsedImgs(m => ({ ...m, [r.id]: asArray(d).filter(x => x && x.image_id).map(x => x.image_data) })))
        .catch(() => {});
    }
  }
  const setUsedPayRow = (i, patch) => setUsedSale(m => ({ ...m, rows: m.rows.map((r, j) => j === i ? { ...r, ...patch } : r) }));
  const usedPayTotal = (m) => (m?.rows || []).reduce((s, r) => s + num(r.amount), 0);
  const usedBankLabel = (a) => [a.bank_name, a.account_no, a.account_name].filter(Boolean).join(" · ");
  async function saveUsedSale() {
    const m = usedSale;
    const list = m.rows.filter(r => num(r.amount) > 0);
    if (!text(m.customer)) { setMessage("❌ กดปุ่ม 🔍 เลือก/เพิ่ม เพื่อเลือกลูกค้าก่อน"); return; }
    if (!num(m.price)) { setMessage("❌ ใส่ราคาขาย"); return; }
    if (!list.length) { setMessage("❌ ใส่ยอดรับชำระอย่างน้อย 1 วิธี"); return; }
    if (list.some(r => r.method === "เงินโอน" && !r.account)) { setMessage("❌ เลือกบัญชีรับโอนของรายการเงินโอน"); return; }
    if (Math.abs(usedPayTotal(m) - num(m.price)) >= 0.01 &&
        !window.confirm(`รวมรับชำระ ${num(usedPayTotal(m)).toLocaleString("th-TH")} ไม่เท่าราคาขาย ${num(m.price).toLocaleString("th-TH")}\nบันทึกต่อหรือไม่?`)) return;
    setMessage("");
    setUsedSale(x => ({ ...x, saving: true }));
    try {
      const d = await post(USED_API, {
        action: "sell_used", id: usedSel.id,
        sold_date: m.sold_date, sold_customer: text(m.customer), sold_customer_phone: text(m.phone),
        sold_price: num(m.price),
        payments: list.map(r => ({ method: r.method, amount: num(r.amount), account: r.method === "เงินโอน" ? r.account : "" })),
        payment_note: m.note, sold_by: currentUser?.username || currentUser?.name || "",
      });
      if (!d?.[0]?.id) throw new Error(d?.[0]?.error || "บันทึกขายไม่สำเร็จ (คันนี้อาจถูกขาย/ยกเลิกไปแล้ว)");
      setUsedDone({ doc_no: usedSel.doc_no, vehicle: [usedSel.brand, usedSel.model_series].filter(Boolean).join(" "), customer: text(m.customer), price: num(m.price) });
      setUsedSale(null);
    } catch (e) {
      setMessage("❌ " + String(e.message || e).slice(0, 160));
      setUsedSale(x => x ? { ...x, saving: false } : x);
    }
  }

  // ข้อมูลลูกค้า (แบบเดียวกับหน้าบันทึกขายปลีก — เลือกจาก CustomerPickerModal หรือพิมพ์เอง)
  const CUST_DEFAULT = { customer_code: "", customer_name: "", customer_address: "", customer_phone: "", customer_birthdate: "", customer_tax_id: "", customer_province: "", customer_gender: "", customer_line_user_id: "" };
  const [cust, setCust] = useState(CUST_DEFAULT);
  const [showCustomer, setShowCustomer] = useState(false);

  // ราคาขายบวกเพิ่ม (รายการปรับแต่ง — logic เดียวกับบันทึกขายปลีก)
  const [adjOpen, setAdjOpen] = useState(false);          // default ไม่กด
  // ขายส่ง (user 2026-08-22): ประเภทการขายที่ 3 — ไม่มีของแถม/บวกเพิ่ม/ปรับแต่ง, ราคาพิมพ์เอง, ชำระแบบเงินสด
  const [wholesalePrice, setWholesalePrice] = useState("");
  const isWholesale = saleType === "wholesale";
  const [useDeliveryFee, setUseDeliveryFee] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [useDownPayout, setUseDownPayout] = useState(false);
  const [downPayout, setDownPayout] = useState(0);

  // บันทึกการขาย
  const [saving, setSaving] = useState(false);
  const [savedSale, setSavedSale] = useState(null);       // ใบขายที่บันทึกสำเร็จ

  // หลังบันทึก: ใบขาย/ใบเสร็จส่ง LINE ทันที · เอกสารเลือกไฟล์ให้ครบก่อนแล้วส่งด้วยปุ่มเดียว
  const [actFile, setActFile] = useState(null);
  const [cosmosFile, setCosmosFile] = useState(null);
  const [docFile, setDocFile] = useState(null);
  const [docsSent, setDocsSent] = useState(false);
  const [docsSending, setDocsSending] = useState(false);
  const [lineSaleStatus, setLineSaleStatus] = useState(null); // 'sending' | 'sent' | 'no_line' | 'error'

  // การ์ดบันทึกชำระเงิน (หลังบันทึกขาย — ข้ามได้ถ้ายังไม่รับชำระ)
  const [bankAccounts, setBankAccounts] = useState([]);
  const [branchMaster, setBranchMaster] = useState([]); // ข้อมูลสาขา (ชื่อ/ที่อยู่/เบอร์/เลขภาษี) สำหรับหัวเอกสาร
  const [markups, setMarkups] = useState([]);           // เมนู "ราคาขายบวกเพิ่ม" (ตามไฟแนนท์/CC/กำหนดเอง)
  // รับชำระหลายวิธี (user 2026-08-22): array ของ {method:'cash'|'transfer', amount, account_id} — เงินสด+เงินโอน(เลือกบัญชี) รวมกันได้
  const PAY_LINE_DEFAULT = () => [{ method: "cash", amount: "", account_id: "" }];
  const [payLines, setPayLines] = useState(PAY_LINE_DEFAULT());
  const [refundBank, setRefundBank] = useState("");       // คืนเงินแบบโอน: ธนาคารของลูกค้า
  const [refundAcctNo, setRefundAcctNo] = useState("");   // คืนเงินแบบโอน: เลขบัญชีลูกค้า
  const [paySending, setPaySending] = useState(false);
  const [paySaved, setPaySaved] = useState(false);

  useEffect(() => {
    let alive = true;
    post(ACC_API, { action: "list_bank_accounts", include_inactive: "false" })
      .then(d => { if (alive) setBankAccounts(Array.isArray(d) ? d : (d?.data || [])); })
      .catch(() => {});
    post(MASTER_API, { action: "get_branches" })
      .then(d => { if (alive) setBranchMaster(asArray(d)); })
      .catch(() => {});
    post(ACC_API, { action: "list_price_markups" })
      .then(d => { if (alive) setMarkups(asArray(d).filter(x => x && x.status === "active")); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  function resetPostSave() {
    setActFile(null); setCosmosFile(null); setDocFile(null); setDocsSent(false); setDocsSending(false); setLineSaleStatus(null);
    setPayLines(PAY_LINE_DEFAULT()); setRefundBank(""); setRefundAcctNo(""); setPaySending(false); setPaySaved(false);
  }

  // หัวกระดาษตามสาขาของใบขาย — ชื่อ/ที่อยู่/เบอร์/เลขภาษีจาก branch_master
  // แยกบริษัท ป.เปา (SCY05/06) / สิงห์ชัย (SCY01/04/07) — ถ้าไม่รู้สาขาใช้ยี่ห้อรถแทน (เหมือนหน้าบันทึกขายปลีก)
  function letterheadFor(sale) {
    const bc = text(sale?.branch_code || sale?.sale_no).substring(0, 5).toUpperCase();
    const brandKey = /ยามาฮ่า|YAMAHA/i.test(text(sale?.brand)) ? "YAMAHA" : "HONDA";
    const base = LETTERHEAD[brandKey] || LETTERHEAD.HONDA;
    const logoKind = BRANCH_LOGO[bc] || (brandKey === "YAMAHA" ? "yamaha" : "honda");
    const logo = LOGO_BASE + LOGO_FILES[logoKind];
    const brandText = logoKind === "yamaha" ? "YAMAHA" : "HONDA";
    // ฐานหัวกระดาษตามบริษัทของสาขา (SCY05/06 = ป.เปา, SCY01/04/07 = สิงห์ชัย) — ถ้าไม่รู้สาขาใช้ยี่ห้อรถ
    const companyBase = logoKind === "honda" ? LETTERHEAD.HONDA : (BRANCH_LOGO[bc] ? LETTERHEAD.YAMAHA : base);
    const b = branchMaster.find((x) => String(x.branch_code || "").toUpperCase() === bc);
    if (!b) return { ...companyBase, logo, brandText };
    const tel = [b.phone ? `โทรศัพท์ : ${b.phone}` : "", b.mobile ? `มือถือ : ${b.mobile}` : ""].filter(Boolean).join("   ");
    return {
      // ใช้ชื่อบริษัทเป็นหลัก — branch_name ใน branch_master เป็นชื่อสาขาย่อย (เช่น "ศูนย์ยามาฮ่า") ไม่ใช่ชื่อนิติบุคคล
      name: b.branch_display_name || companyBase.name,
      addr: b.address || companyBase.addr,
      tel: tel || companyBase.tel,
      tax: b.tax_id ? `เลขประจำตัวผู้เสียภาษีอากร : ${b.tax_id}` : companyBase.tax,
      logo, brandText,
    };
  }

  // โลโก้หัวเอกสาร — รูปจาก /logos/ ถ้าโหลดไม่ได้ fallback เป็นกรอบชื่อยี่ห้อ
  function logoHtml(lh, esc) {
    const ph = `<div class="ph">${esc(lh.brandText || "")}</div>`;
    if (!lh.logo) return ph;
    return `<img src="${esc(lh.logo)}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="ph" style="display:none">${esc(lh.brandText || "")}</div>`;
  }

  // ใบขาย (Sales Order) — รูปแบบเดียวกับหน้าบันทึกขายปลีก แยกหัวกระดาษ ป.เปา/สิงห์ชัย (ลูกค้ากดเปิดจากปุ่มใน LINE)
  function buildSaleDocHtml(sale) {
    const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const money = (n) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dash = (n) => (Number(n) > 0 ? money(n) : "-");
    const lh = letterheadFor(sale);
    const isFin = sale.finance_type === "moto";
    const modelLine = [sale.model_name, sale.color].filter(Boolean).join(" / ");
    const bookingNo = sale.deposit_no || selBooking?.deposit_no || "";
    const bookingDate = sale.booking_date || selBooking?.booking_date || "";
    // ของแถม (บริการ + สินค้า) พร้อมรหัส — เงินดาวน์ออกแทนไม่ใส่ (อยู่ในส่วนลดแล้ว)
    const gRow = (code, name, qty) => `<tr><td>${esc(code)}</td><td>${esc(name)}</td><td class="c">${qty}</td></tr>`;
    let gRows = "";
    for (const g of displayGiveaways) {
      const on = g.__merged ? g.ids.every((id) => selectedGiveaways[id]) : !!selectedGiveaways[g.expense_id];
      if (!on || isDownPaymentSub(g.expense_name)) continue;
      gRows += gRow(g.expense_code || g.code || "", g.expense_name, 1);
    }
    for (const g of (productGiveaways || []).filter((x) => selectedProductGiveaways[x.id]))
      gRows += gRow(g.part_code || g.fmp_product_code || "", g.fmp_product_name || g.part_name || g.part_code || "-", Number(g.qty || 1));
    // เงินดาวน์/ค่างวดออกแทน — นับเป็นของแถมในใบขายด้วย (ยอดฐานเก็บใน down_payout_amount)
    const dpAmt = Number(sale.down_payout_amount ?? (adjOpen && useDownPayout ? downPayout : 0)) || 0;
    if (dpAmt > 0) gRows += gRow("", `เงินดาวน์/ค่างวดออกแทน ${money(dpAmt)} บาท`, 1);

    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ใบขาย ${esc(sale.sale_no)}</title>
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
    <div class="val">${esc(sale.customer_name)}${(sale.customer_code || cust.customer_code) ? ` <span style="color:#888;font-weight:400">(รหัส ${esc(sale.customer_code || cust.customer_code)})</span>` : ""}</div>
    <div>${esc(sale.customer_address || cust.customer_address || "")}</div>
    <div>${(sale.customer_tax_id || cust.customer_tax_id) ? "เลขประจำตัวผู้เสียภาษี : " + esc(sale.customer_tax_id || cust.customer_tax_id) : ""}</div>
  </td>
  <td style="padding:0"><table class="it" style="border:none">
    <tr><td class="sec">เลขที่ใบขาย</td><td class="sec">วันที่ขาย</td></tr>
    <tr><td class="c val">${esc(sale.sale_no)}</td><td class="c">${esc(thaiDate(sale.sale_date))}</td></tr>
    <tr><td class="sec">เลขที่ใบจอง</td><td class="sec">วันที่จอง</td></tr>
    <tr><td class="c">${esc(bookingNo)}</td><td class="c">${bookingDate ? esc(thaiDate(bookingDate)) : ""}</td></tr>
  </table></td>
</tr></table>

<table class="bx"><tr>
  <td style="width:62%;padding:0"><table class="it" style="border:none">
    <tr><td class="sec">รุ่นรถ</td></tr>
    <tr><td class="c val">${esc(modelLine)}</td></tr>
    <tr><td class="sec" style="width:50%">หมายเลขตัวถัง</td><td class="sec">หมายเลขเครื่อง</td></tr>
    <tr><td class="c val">${esc(sale.chassis_no || "-")}</td><td class="c val">${esc(sale.engine_no || "-")}</td></tr>
  </table></td>
  <td style="padding:0"><table class="it" style="border:none">
    <tr><td class="lbl">ราคารถ</td><td class="r val">${money(sale.car_price)}</td></tr>
    <tr><td class="lbl">ส่วนลด</td><td class="r">${dash(sale.discount)}</td></tr>
    <tr><td class="lbl">ราคารถสุทธิ</td><td class="r val">${money(sale.net_car_price || Math.max(Number(sale.car_price || 0) - Number(sale.discount || 0), 0))}</td></tr>
    <tr><td class="lbl">เงินจอง</td><td class="r">${dash(sale.booking_deposit)}</td></tr>
    ${Number(sale.theft_insurance_amount) > 0 ? `<tr><td class="lbl">ประกันรถหาย</td><td class="r val">${money(sale.theft_insurance_amount)}</td></tr>` : ""}
    ${Number(sale.red_plate_deposit) > 0 ? `<tr><td class="lbl">มัดจำป้ายแดง${sale.red_plate_no ? " (" + esc(sale.red_plate_no) + ")" : ""}</td><td class="r val">${money(sale.red_plate_deposit)}<div style="font-weight:400;color:#888;font-size:10px">คืนเมื่อคืนป้าย</div></td></tr>` : ""}
  </table></td>
</tr></table>

${isFin ? `<table class="bx">
  <tr><td colspan="6" class="sec">ไฟแนนซ์ : ${esc(sale.finance_company_name || "-")}</td></tr>
  <tr><td class="sec">ยอดจัดไฟแนนซ์</td><td class="sec">เงินดาวน์</td><td class="sec">อัตราดอกเบี้ย</td><td class="sec">จำนวนงวด</td><td class="sec">ยอดผ่อน/งวด</td><td class="sec">ค่างวดจ่ายล่วงหน้า</td></tr>
  <tr><td class="r val">${money(sale.finance_amount)}</td><td class="r val">${money(sale.down_payment)}</td><td class="c">${esc(sale.interest_rate || "-")}</td><td class="c">${esc(sale.installments || "-")}</td><td class="r val">${money(sale.installment_amount)}</td><td class="r val">${money(sale.advance_installment)}</td></tr>
</table>` : ""}

<table class="bx">
  <tr><td class="sec" style="width:18%">รหัสสินค้า</td><td class="sec">รายละเอียด</td><td class="sec" style="width:12%">จำนวน</td></tr>
  ${gRows ? `<tr><td colspan="3" class="lbl" style="text-decoration:underline">รายการแถม</td></tr>${gRows}` : `<tr><td colspan="3" class="c" style="color:#999">- ไม่มีของแถม -</td></tr>`}
</table>
<div class="foot"><div class="sg">ผู้ขาย</div><div class="sg">ลูกค้า / ผู้ซื้อ</div></div>
${sale.__test ? '<div style="margin-top:24px;color:#b45309;font-size:13px;text-align:center">⚠️ เอกสารทดสอบระบบ — ไม่ใช่รายการขายจริง</div>' : ""}
</div></body></html>`;
  }

  // ใบเสร็จรับเงิน / ใบเสร็จคืนเงินมัดจำ — รูปแบบเดียวกับหน้าบันทึกขายปลีก แยกหัวกระดาษ ป.เปา/สิงห์ชัย (ลูกค้ากดเปิดจากปุ่มใน LINE)
  function buildReceiptDocHtml(sale, receiptNo, pay, rp) {
    const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const money = (n) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const lh = letterheadFor(sale);
    // ใบรับเงินมัดจำป้ายแดง — แยกเป็นอีกหน้าต่อท้ายใบเสร็จค่ารถ (เงินมัดจำคืนได้ ไม่ใช่รายได้ ไม่รวมในใบเสร็จค่ารถ)
    const rpHtml = rp && Number(rp.amount) > 0 ? `
<div class="wrap" style="page-break-before:always;margin-top:28px;border-top:2px dashed #bbb;padding-top:14px">
<div class="hdr">
  <div class="logo">${logoHtml(lh, esc)}</div>
  <div class="co"><div class="nm">${esc(lh.name)}</div><div>${esc(lh.addr)}</div><div>${esc(lh.tel)}</div><div>${esc(lh.tax)}</div></div>
  <div class="ttl" style="width:190px"><div class="b" style="color:#b91c1c;font-size:18px">ใบรับเงินมัดจำป้ายแดง</div><div>Red Plate Deposit</div><div class="o" style="color:#b91c1c">(ต้นฉบับ)</div></div>
</div>
<table class="bx"><tr>
  <td style="width:62%"><div class="sec" style="margin:-5px -8px 5px;padding:3px">ชื่อลูกค้า</div>
    <div class="val">${esc(sale.customer_name)}</div>
    <div>${esc(sale.customer_address || cust.customer_address || "")}</div>
  </td>
  <td style="padding:0"><table class="it" style="border:none">
    <tr><td class="sec">เลขที่ใบรับมัดจำ</td><td class="sec">วันที่</td></tr>
    <tr><td class="c val">${esc(rp.doc_no || "-")}</td><td class="c">${esc(thaiDate(todayStr()))}</td></tr>
    <tr><td class="sec">อ้างอิงใบขาย</td><td class="sec">อ้างอิงใบเสร็จ</td></tr>
    <tr><td class="c">${esc(sale.sale_no)}</td><td class="c">${esc(receiptNo || "-")}</td></tr>
  </table></td>
</tr></table>
<table class="bx">
  <tr><td class="sec" style="width:8%">ลำดับ</td><td class="sec">รายละเอียด</td><td class="sec" style="width:22%">ทะเบียนป้ายแดง</td><td class="sec" style="width:15%">จำนวนเงิน</td></tr>
  <tr><td class="c">1</td><td>เงินมัดจำป้ายแดง (คืนเต็มจำนวนเมื่อนำป้ายแดงมาคืนร้าน)</td><td class="c val">${esc(rp.plate_no || "-")}</td><td class="r">${money(rp.amount)}</td></tr>
  <tr><td colspan="3" class="r tot" style="color:#b91c1c">รวมเงินมัดจำ</td><td class="r tot" style="color:#b91c1c">${money(rp.amount)} บาท</td></tr>
</table>
<div style="margin-top:8px;font-size:11px;color:#b91c1c">* เงินมัดจำนี้ไม่ใช่ค่าสินค้า/บริการ ร้านจะคืนให้เต็มจำนวนเมื่อลูกค้านำป้ายแดงมาคืนหลังได้รับป้ายทะเบียนจริง กรุณาเก็บใบนี้ไว้แสดงตอนคืนป้าย</div>
<div class="foot"><div class="sg">ผู้รับเงิน</div><div class="sg">ผู้ชำระเงิน</div></div>
</div>` : "";
    const title = pay.refund ? "ใบเสร็จคืนเงิน" : "ใบเสร็จรับเงิน";
    const carLine = [sale.brand, sale.model_name, sale.engine_no].filter(Boolean).join(" / ");
    // หลายวิธีรับชำระ: 1 แถวต่อวิธี + แถวหักมัดจำป้ายแดง (แยกใบ) ถ้ามี — รวม = ยอดค่ารถ (pay.amount)
    const lines = Array.isArray(pay.lines) && pay.lines.length ? pay.lines : [{ methodLabel: pay.methodLabel, accountName: pay.accountName, amount: pay.amount + (Number(rp?.amount) || 0) }];
    let iRows = "", ii = 0;
    for (const l of lines) { ii++; iRows += `<tr><td class="c">${ii}</td><td>${esc((pay.refund ? "คืนเงินมัดจำ · " : "") + l.methodLabel)}${l.accountName ? " · " + esc(l.accountName) : ""}</td><td class="c">1</td><td class="r">${money(l.amount)}</td><td class="r">${money(l.amount)}</td></tr>`; }
    if (rp && Number(rp.amount) > 0) { ii++; iRows += `<tr><td class="c">${ii}</td><td style="color:#b91c1c">หัก มัดจำป้ายแดง — แยกใบรับมัดจำ ${esc(rp.doc_no || "")}</td><td class="c">1</td><td class="r" style="color:#b91c1c">-${money(rp.amount)}</td><td class="r" style="color:#b91c1c">-${money(rp.amount)}</td></tr>`; }

    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} ${esc(receiptNo)}</title>
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
  <div class="ttl"><div class="b">${esc(title)}</div><div>Receipt</div><div class="o">(ต้นฉบับ)</div></div>
</div>

<table class="bx"><tr>
  <td style="width:62%"><div class="sec" style="margin:-5px -8px 5px;padding:3px">ชื่อลูกค้า/ที่อยู่</div>
    <div class="val">${esc(sale.customer_name)}${(sale.customer_code || cust.customer_code) ? ` <span style="color:#888;font-weight:400">(รหัส ${esc(sale.customer_code || cust.customer_code)})</span>` : ""}</div>
    <div>${esc(sale.customer_address || cust.customer_address || "")}</div>
    <div>${(sale.customer_tax_id || cust.customer_tax_id) ? "เลขประจำตัวผู้เสียภาษี : " + esc(sale.customer_tax_id || cust.customer_tax_id) : ""}</div>
  </td>
  <td style="padding:0"><table class="it" style="border:none">
    <tr><td class="sec">เลขที่ใบเสร็จ</td><td class="sec">วันที่</td></tr>
    <tr><td class="c val">${esc(receiptNo) || "-"}</td><td class="c">${esc(thaiDate(todayStr()))}</td></tr>
    <tr><td class="sec">อ้างอิงใบขาย</td><td class="sec">วันที่ขาย</td></tr>
    <tr><td class="c">${esc(sale.sale_no)}</td><td class="c">${esc(thaiDate(sale.sale_date))}</td></tr>
  </table></td>
</tr></table>

<table class="bx"><tr><td><span class="lbl">รถ : </span>${esc(carLine)}${sale.chassis_no ? ` &nbsp; เลขถัง ${esc(sale.chassis_no)}` : ""}</td></tr></table>

<table class="bx">
  <tr><td class="sec" style="width:8%">ลำดับ</td><td class="sec">รายละเอียด / ช่องทาง${pay.refund ? "คืนเงิน" : "รับชำระ"}</td><td class="sec" style="width:9%">จำนวน</td><td class="sec" style="width:15%">ราคา/หน่วย</td><td class="sec" style="width:15%">จำนวนเงิน</td></tr>
  ${iRows}
  <tr><td colspan="4" class="r tot">${pay.refund ? "รวมคืนเงินมัดจำ" : "รวมรับชำระ"}</td><td class="r tot">${money(pay.amount)} บาท</td></tr>
</table>
<div class="foot"><div class="sg">ผู้รับเงิน</div><div class="sg">ผู้ชำระเงิน</div></div>
${sale.__test ? '<div style="margin-top:24px;color:#b45309;font-size:13px;text-align:center">⚠️ เอกสารทดสอบระบบ — ไม่ใช่รายการเงินจริง</div>' : ""}
</div>${rpHtml}</body></html>`;
  }

  // บันทึกชำระเงิน / คืนเงินมัดจำ — บันทึกจริงผ่าน save_payment (action เดียวกับหน้าขายปลีก) แล้วส่งใบเสร็จเข้า LINE
  // ยกเว้น: โหมดทดสอบไม่เขียน DB · ยอดติดลบ (คืนเงินมัดจำส่วนเกิน) ยังไม่เขียน DB — ให้ไปบันทึกที่เมนูมัดจำจองรถ
  async function handleSavePayment(receiveAmt) {
    if (!savedSale || paySending || paySaved) return;
    const target = Math.abs(Number(receiveAmt) || 0);
    // แปลงบรรทัดรับชำระ: ช่องยอดว่าง = ยอดที่เหลือ (กรอกวิธีเดียวไม่ต้องพิมพ์ยอด)
    const filled = payLines.map((l) => ({ ...l, amt: num(l.amount) }));
    const known = filled.filter((l) => l.amount !== "" && l.amt > 0).reduce((s, l) => s + l.amt, 0);
    const blanks = filled.filter((l) => l.amount === "");
    if (blanks.length > 1) { setMessage("❌ กรอกยอดให้ครบ (เว้นว่างได้แค่ 1 บรรทัด = ยอดที่เหลือ)"); return; }
    const lines = filled.map((l) => ({ ...l, amt: l.amount === "" ? Math.max(target - known, 0) : l.amt })).filter((l) => l.amt > 0);
    if (!lines.length) { setMessage("❌ ใส่ยอดรับชำระอย่างน้อย 1 รายการ"); return; }
    for (const l of lines) {
      if (l.method === "transfer" && !bankAccounts.find(a => String(a.account_id) === String(l.account_id))) { setMessage("❌ เลือกบัญชีรับโอนเงินให้ครบทุกบรรทัดเงินโอน"); return; }
    }
    const sum = lines.reduce((s, l) => s + l.amt, 0);
    if (Math.abs(sum - target) > 0.5) { setMessage(`❌ ยอดรวมวิธีรับชำระ ${sum.toLocaleString("th-TH")} ไม่เท่ายอดที่ต้องรับ ${target.toLocaleString("th-TH")}`); return; }
    const payLinesOut = lines.map((l) => {
      const acc = l.method === "transfer" ? bankAccounts.find(a => String(a.account_id) === String(l.account_id)) : null;
      return { method: l.method, methodLabel: l.method === "cash" ? "เงินสด" : "เงินโอน", account_id: acc ? Number(acc.account_id) : null, accountName: acc?.account_name || null, amount: l.amt };
    });
    if (savedSale.__test && !custLineUserId) { setMessage("❌ ลูกค้าไม่มี LINE ในระบบ — ส่งใบเสร็จทาง LINE ไม่ได้"); return; }
    const refund = Number(receiveAmt) < 0;
    // มัดจำป้ายแดงรวมอยู่ในยอดที่เก็บ แต่แยกใบ: ใบเสร็จค่ารถ = ยอดเก็บ − มัดจำ, ใบรับมัดจำป้ายแดง = มัดจำ (เลข RPD ออกจาก save_payment)
    const rpAmt = refund ? 0 : Math.min(Number(savedSale.red_plate_deposit) || 0, Math.abs(Number(receiveAmt) || 0));
    const pay = {
      refund,
      amount: Math.abs(Number(receiveAmt) || 0) - rpAmt,
      methodLabel: payLinesOut.map((l) => l.methodLabel).join("+"),
      accountName: payLinesOut.map((l) => l.accountName).filter(Boolean).join(", ") || null,
      lines: payLinesOut,
    };
    setPaySending(true);
    setMessage("");
    try {
      let receiptNo = (savedSale.__test ? "TEST-RCPT-" : "RCPT-") + String(savedSale.sale_no).replace(/^TEST-/, "");
      let saleForDoc = savedSale;

      // บันทึกรับชำระลง DB (เฉพาะของจริง + ยอดเป็นบวก) — ได้เลขใบเสร็จจริงจาก workflow
      if (!savedSale.__test && !refund) {
        const row = await post(RETAIL_API, {
          action: "save_payment", sale_no: savedSale.sale_no,
          receipt_date: todayStr(),
          payments: payLinesOut.map((l) => ({ method: l.method === "cash" ? "เงินสด" : "โอน", account_id: l.account_id, account_name: l.accountName, amount: l.amount })),
          paid_amount: pay.amount + rpAmt,
          payment_note: "",
          received_by: currentUser?.username || currentUser?.name || "",
          branch_code: savedSale.branch_code || currentUser?.branch_code || currentUser?.branch || "",
        });
        const updated = row && (row.sale || row);
        if (!updated || !updated.sale_no) throw new Error(row?.__error || row?.error || "บันทึกรับชำระไม่สำเร็จ");
        receiptNo = updated.receipt_no || receiptNo;
        // merge แถวที่อัปเดตกลับเข้า savedSale — คงชื่อรุ่น/สี/ยี่ห้อแบบแสดงผลของ wizard ไว้ใช้ในเอกสาร
        saleForDoc = { ...savedSale, ...updated, brand: savedSale.brand, model_name: savedSale.model_name, color: savedSale.color,
          red_plate_doc_no: row.red_plate_doc_no || updated.red_plate_doc_no || null };
        setSavedSale(saleForDoc);
      }

      // คืนเงินมัดจำ: บันทึกลงใบมัดจำจริงเลย (refund_deposit) — จบในหน้าขาย ไม่ต้องไปเมนูมัดจำจองรถ (user 2026-08-24)
      let refundedDepNo = "";
      if (!savedSale.__test && refund) {
        const depNo = savedSale.deposit_no || selBooking?.deposit_no || "";
        if (!depNo) throw new Error("ใบขายนี้ไม่ได้ผูกเลขใบมัดจำ — กรุณาบันทึกคืนเงินที่เมนูมัดจำจองรถ");
        const first = payLinesOut[0];
        const isTr = first.method === "transfer";
        if (isTr && (!refundBank.trim() || !refundAcctNo.trim())) throw new Error("คืนแบบโอน: กรอกธนาคารและเลขบัญชีของลูกค้าก่อน");
        const rres = await post(DEPOSIT_API, {
          action: "refund_deposit", deposit_no: depNo,
          refund_method: isTr ? "โอนเข้าบัญชี" : "เงินสด",
          refund_amount: target,
          refund_from_account: isTr ? (first.accountName || "") : "",
          refund_bank: isTr ? refundBank.trim() : "",
          refund_account_no: isTr ? refundAcctNo.trim() : "",
          refund_note: "คืนส่วนเกินมัดจำจากใบขาย " + savedSale.sale_no,
          refunded_by: currentUser?.username || currentUser?.name || "system",
        });
        const rrow = rres && (rres.deposit || rres);
        if (!rrow || !rrow.deposit_no) throw new Error(rres?.__error || rres?.error || "บันทึกคืนเงินมัดจำไม่สำเร็จ (ใบมัดจำอาจถูกคืนไปแล้ว)");
        refundedDepNo = depNo;
      }

      // ส่งใบเสร็จเข้า LINE ลูกค้า (ถ้ามี LINE)
      if (custLineUserId) {
        await post(RETAIL_API, {
          action: "send_receipt_flex",
          sale_no: savedSale.sale_no, receipt_no: receiptNo, receipt_date: todayStr(),
          customer_name: savedSale.customer_name,
          paid_amount: pay.amount,
          payment_methods: [
            ...payLinesOut.map((l) => ({ method: (refund ? "คืนเงินมัดจำ · " : "") + l.methodLabel, amount: l.amount, account_name: l.accountName })),
            ...(rpAmt > 0 ? [{ method: "หัก มัดจำป้ายแดง (แยกใบรับมัดจำ)", amount: -rpAmt }] : []),
          ],
          red_plate_no: saleForDoc.red_plate_no || "", red_plate_deposit: rpAmt, red_plate_doc_no: saleForDoc.red_plate_doc_no || (savedSale.__test && rpAmt > 0 ? "TEST-RPD" : ""),
          branch_name: savedSale.branch_name, branch_code: savedSale.branch_code,
          line_user_id: custLineUserId,
          doc_html: buildReceiptDocHtml(saleForDoc, receiptNo, pay, rpAmt > 0 ? { doc_no: saleForDoc.red_plate_doc_no || "TEST-RPD", plate_no: saleForDoc.red_plate_no, amount: rpAmt } : null),
          sent_by: currentUser?.name || currentUser?.username || "",
        });
      }
      setPaySaved(true);
      if (savedSale.__test) {
        setMessage("🧪 ยังไม่บันทึกลง DB · ✅ ส่ง" + (refund ? "ใบเสร็จคืนเงินมัดจำ" : "ใบเสร็จรับเงิน") + "เข้า LINE ลูกค้าแล้ว");
      } else if (refund) {
        setMessage(`✅ บันทึกคืนเงินมัดจำ ${refundedDepNo} จำนวน ${Math.abs(Number(receiveAmt)).toLocaleString("th-TH")} บาท แล้ว` + (custLineUserId ? " · ส่งใบเสร็จคืนเงินเข้า LINE แล้ว" : ""));
      } else {
        setMessage("✅ รับชำระเงินเรียบร้อย เลขที่ใบเสร็จ " + receiptNo + (custLineUserId ? " · ส่งใบเสร็จเข้า LINE ลูกค้าแล้ว" : " (ลูกค้าไม่มี LINE — ไม่ได้ส่งใบเสร็จ)"));
      }
    } catch (e) {
      setMessage("❌ " + (e.message || "บันทึกรับชำระ/ส่งใบเสร็จไม่สำเร็จ"));
    }
    setPaySending(false);
  }

  // ลูกค้าไม่มี LINE แต่มีเบอร์โทร → ค้นฐานลูกค้าด้วยเบอร์อัตโนมัติ เจอ LINE ผูกให้เลย
  // (กันเคสพนักงานกด "เพิ่มลูกค้าใหม่" ซ้ำ ทั้งที่ลูกค้าเคยลงทะเบียน QR/LINE แล้ว → ใบขาย/ใบเสร็จส่ง LINE ไม่ได้)
  async function autoLinkLineByPhone() {
    if (text(cust.customer_line_user_id) || text(selBooking?.line_user_id)) return null;
    const phone = text(cust.customer_phone).replace(/[^0-9]/g, "");
    if (phone.length < 9) return null;
    try {
      const res = await post(DEPOSIT_API, { action: "search_customers", keyword: phone });
      const rows = Array.isArray(res) ? res : [];
      const hit = rows.find(r => text(r.line_user_id) && String(r.customer_phone || "").replace(/[^0-9]/g, "").slice(-9) === phone.slice(-9));
      if (!hit) return null;
      const patch = {
        customer_line_user_id: text(hit.line_user_id),
        customer_code: text(cust.customer_code) || text(hit.customer_code),
        customer_address: text(cust.customer_address) || text(hit.customer_address),
        customer_tax_id: text(cust.customer_tax_id) || text(hit.customer_tax_id),
      };
      setCust(p => ({ ...p, ...patch })); // ให้ขั้นถัดไป (ใบเสร็จ/ส่งเอกสาร) เห็น LINE ด้วย
      return patch;
    } catch { return null; }
  }

  // ส่ง "ใบขาย" เข้า LINE ลูกค้าทันทีหลังกดบันทึกขาย — action เดียวกับหน้าขายปลีก
  // lineOverride: LINE ที่เพิ่งผูกจากเบอร์โทรใน handleSaveSale (state ยังไม่ทัน update ใน tick เดียวกัน)
  async function sendSaleFlex(sale, lineOverride) {
    const lid = text(lineOverride) || custLineUserId;
    if (!lid) { setLineSaleStatus("no_line"); return; }
    setLineSaleStatus("sending");
    try {
      await post(RETAIL_API, {
        action: "send_sale_flex",
        sale_no: sale.sale_no, sale_date: sale.sale_date,
        customer_name: sale.customer_name, customer_code: cust.customer_code,
        brand: sale.brand, model_name: sale.model_name,
        engine_no: sale.engine_no, chassis_no: sale.chassis_no,
        color: sale.color, seller: sale.seller,
        car_price: sale.car_price, discount: sale.discount, total_payment: sale.total_payment,
        advance_installment: sale.advance_installment, installment_amount: sale.installment_amount,
        red_plate_no: sale.red_plate_no || "", red_plate_deposit: Number(sale.red_plate_deposit) || 0,
        finance_type: sale.finance_type,
        branch_name: sale.branch_name, branch_code: sale.branch_code,
        line_user_id: lid,
        doc_html: buildSaleDocHtml(sale),
        sent_by: currentUser?.name || currentUser?.username || "",
      });
      setLineSaleStatus("sent");
    } catch {
      setLineSaleStatus("error");
    }
  }

  // ส่งเอกสารทั้งหมดที่เลือกไว้ (พ.ร.บ./คอสมอส/ประกันรถหาย) — upload_act_doc + send_act_flex ต่อไฟล์
  async function sendDocsLine() {
    if (!savedSale || docsSending || docsSent) return;
    const jobs = [
      { file: actFile, doc_type: "act", label: "พ.ร.บ." },
      { file: cosmosFile, doc_type: "cosmos", label: "3PLUS/RSA/PA" },
      { file: docFile, doc_type: "doc", label: "กรมธรรม์ประกันรถหาย COSMOS" },
    ].filter(j => j.file);
    if (!jobs.length) return;
    for (const j of jobs) {
      if (j.file.type !== "application/pdf") { setMessage("❌ " + j.label + ": ต้องเป็นไฟล์ PDF เท่านั้น"); return; }
      if (j.file.size > 8 * 1024 * 1024) { setMessage("❌ " + j.label + ": ไฟล์ใหญ่เกิน 8 MB"); return; }
    }
    if (!custLineUserId) { setMessage("❌ ลูกค้าไม่มี LINE — ส่งเอกสารทาง LINE ไม่ได้"); return; }
    setDocsSending(true);
    setMessage("");
    const ok = [], fail = [];
    for (const j of jobs) {
      try {
        const base64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = (e) => resolve(String(e.target.result).split(",")[1] || "");
          r.onerror = reject;
          r.readAsDataURL(j.file);
        });
        await post(RETAIL_API, {
          action: "upload_act_doc", sale_no: savedSale.sale_no, filename: j.file.name, doc_type: j.doc_type,
          pdf_base64: base64, uploaded_by: currentUser?.name || currentUser?.username || "",
        });
        await post(RETAIL_API, {
          action: "send_act_flex", sale_no: savedSale.sale_no, doc_type: j.doc_type,
          customer_name: cust.customer_name,
          branch_name: currentUser?.branch || "", branch_code: currentUser?.branch_code || currentUser?.branch || "",
          line_user_id: custLineUserId,
          sent_by: currentUser?.name || currentUser?.username || "",
        });
        ok.push(j.label);
      } catch {
        fail.push(j.label);
      }
    }
    setDocsSending(false);
    if (fail.length === 0) { setDocsSent(true); setMessage("✅ ส่งเอกสารเข้า LINE ลูกค้าแล้ว: " + ok.join(" + ")); }
    else setMessage((ok.length ? "✅ ส่งแล้ว: " + ok.join(" + ") + " · " : "") + "❌ ส่งไม่สำเร็จ: " + fail.join(" + "));
  }

  // ช่องกรอกกรณีผ่อนไฟแนนท์ (สูตรเดียวกับบันทึกขายปลีก)
  const [finDown, setFinDown] = useState("");             // เงินดาวน์
  const [finTheft, setFinTheft] = useState("");           // ประกันรถหาย (ไฟแนนซ์หัก)
  const [finRate, setFinRate] = useState("");             // อัตราดอกเบี้ย %/เดือน — default 0 (ช่องว่างโชว์ placeholder 0) ให้พิมพ์เองทุกครั้ง
  const [finN, setFinN] = useState("");                   // จำนวนงวด
  const [finRound5, setFinRound5] = useState(false);      // ปัดเศษค่างวดลงท้าย 0/5
  const [finInstOverride, setFinInstOverride] = useState("");
  const [finInstTouched, setFinInstTouched] = useState(false);
  const [finAdvance, setFinAdvance] = useState("");       // ค่างวดจ่ายล่วงหน้า
  function resetFinanceInputs() {
    setFinDown(""); setFinTheft(""); setFinRate(""); setFinN("");
    setFinRound5(false); setFinInstOverride(""); setFinInstTouched(false); setFinAdvance("");
    setAdvSubsidyInput(""); // แบ่งโปรดาวน์ออกแทนไปช่วยค่างวดล่วงหน้า — เคลียร์พร้อมกัน
    setRedPlateNo(""); // มัดจำป้ายแดง — เคลียร์พร้อมกัน
    setWholesalePrice(""); // ราคาขายส่ง — เคลียร์พร้อมกัน
  }

  // คำนวณยอดฝั่งไฟแนนท์จากราคาขาย (carPrice)
  function financeCalc(carPrice) {
    const down = num(finDown), theft = num(finTheft), rate = num(finRate) / 100, n = num(finN);
    const financeAmount = Math.max((carPrice || 0) - down, 0);
    const instRaw = n > 0 ? (financeAmount * (1 + rate * n)) / n : 0;
    const instRounded = instRaw <= 0 ? 0 : (finRound5 ? Math.ceil(instRaw / 5) * 5 : Math.ceil(instRaw));
    const inst = finInstTouched && finInstOverride !== "" ? num(finInstOverride) : instRounded;
    const advance = num(finAdvance);
    return { down, theft, n, financeAmount, instRounded, inst, advance };
  }

  // รถจอง/ไม่จอง — ลิสต์ลูกค้าจองรุ่นนี้เฉพาะที่ถึงคิวแล้ว
  const [bookingAsk, setBookingAsk] = useState(null);     // null | 'booked' | 'walkin'
  const [selBooking, setSelBooking] = useState(null);     // ใบจองที่เลือก
  const [bookingData, setBookingData] = useState(null);   // { bookings, stock, deposits }
  const [bookingLoading, setBookingLoading] = useState(false);

  // โหลดข้อมูลจอง+สต๊อกคิว ล่วงหน้าตั้งแต่เปิดหน้า (จะได้ไม่ต้องรอตอนกด "รถจอง")
  useEffect(() => {
    let alive = true;
    (async () => {
      setBookingLoading(true);
      try {
        const [bk, ss, dp, bd] = await Promise.all([
          post(BOOKING_API, { action: "get_moto_bookings" }),
          post(BOOKING_API, { action: "get_stock_summary" }),
          post(BOOKING_API, { action: "get_all_deposits" }),            // ใบเสร็จมัดจำแบบเก่า (REC...)
          post(DEPOSIT_API, { action: "get_deposits", status: "all" }), // ระบบมัดจำจองรถ (DEP...)
        ]);
        if (alive) setBookingData({ bookings: asArray(bk), stock: asArray(ss), deposits: asArray(dp), bookingDeposits: asArray(bd) });
      } catch {
        if (alive) setBookingData({ bookings: [], stock: [], deposits: [], bookingDeposits: [] });
      }
      if (alive) setBookingLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  // ลูกค้าจอง "รุ่นนี้ + สีที่เลือก" ที่ถึงคิวแล้ว — คิวคิดเหมือน MotoBookingPage: เรียงวันจอง เทียบจำนวนรถในสต๊อกของรุ่น+สีที่จอง
  const readyBookings = useMemo(() => {
    if (!bookingData || !selSeries || !selColor) return [];
    const wantColor = qNormColor(selColor.name);
    const { bookings: bks, stock: ss, deposits: dps, bookingDeposits: bds } = bookingData;

    const stockGroups = {};
    ss.forEach(s => {
      const k = qNormModel(s.model_code) + "|" + qNormColor(s.color_name);
      (stockGroups[k] = stockGroups[k] || []).push(s);
    });
    const depositMap = {};
    dps.forEach(d => { if (d.receipt_no) depositMap[d.receipt_no] = Number(d.remaining_amount || 0); });
    // ระบบมัดจำจองรถ (DEP...): คงเหลือ = ยอดมัดจำ − ใช้ไป − คืนแล้ว
    (bds || []).forEach(d => {
      if (!d.deposit_no || depositMap[d.deposit_no] !== undefined) return;
      const rem = Number(d.deposit_amount || 0) - Number(d.used_amount || 0) - Number(d.refund_amount || 0);
      depositMap[d.deposit_no] = Math.max(0, rem);
    });

    const queueGroups = {};
    bks.filter(b => b.status === "จอง").forEach(b => {
      const key = (b.new_model_code || b.model_code || "") + "|" + (b.new_color_name || b.color_name || "");
      (queueGroups[key] = queueGroups[key] || []).push(b);
    });

    // รุ่นที่เลือก → คำเทียบ: ชื่อรุ่น/ชื่อการตลาด/รหัสแบบ/รหัส type ทั้งหมดของ series
    const seriesModelCodes = models.filter(m => String(m.series_id) === String(selSeries.series_id)).map(m => m.model_code);
    const seriesTypeNames = types.filter(t => String(t.series_id) === String(selSeries.series_id)).map(t => t.type_name);
    const candidates = [selSeries.series_name, selSeries.marketing_name, ...seriesModelCodes, ...seriesTypeNames]
      .map(qNormModel).filter(Boolean);
    const matchesSeries = (b) => {
      const bk = qNormModel(b.new_model_code || b.model_code);
      if (!bk) return false;
      return candidates.some(c => bk === c || bk.startsWith(c) || c.startsWith(bk));
    };

    const out = [];
    Object.keys(queueGroups).forEach(key => {
      const i = key.lastIndexOf("|");
      const mc = key.slice(0, i), cn = key.slice(i + 1);
      const sorted = queueGroups[key].sort((a, b) => {
        const dtA = new Date(a.booking_date).getTime(), dtB = new Date(b.booking_date).getTime();
        if (dtA !== dtB) return dtA - dtB;
        return String(a.deposit_no || "").localeCompare(String(b.deposit_no || ""), undefined, { numeric: true });
      });
      // จับคู่แบบยืดหยุ่นเหมือน MotoBookingPage: แบบในใบจองเป็นข้อความยาวได้ ("Grand Filano Hybrid BJKC00") แต่สต๊อกยามาฮ่าเก็บรหัส type ("BJKC00")
      const bm = qNormModel(mc), bc = qNormColor(cn);
      let cars = stockGroups[bm + "|" + bc] || [];
      if (cars.length === 0 && bm) {
        Object.keys(stockGroups).forEach(k => {
          const j = k.lastIndexOf("|");
          const sm = k.slice(0, j), sc = k.slice(j + 1);
          if (sc !== bc || !sm || sm.length < 4) return;
          if (bm.includes(sm) || sm.includes(bm)) cars = cars.concat(stockGroups[k]);
        });
      }
      sorted.forEach((b, idx) => {
        if (idx < cars.length && matchesSeries(b) && qNormColor(cn) === wantColor) {
          out.push({ ...b, queuePos: idx + 1, stockQty: cars.length, remaining: b.deposit_no ? (depositMap[b.deposit_no] || 0) : 0 });
        }
      });
    });
    return out.sort((a, b) => String(a.booking_date).localeCompare(String(b.booking_date)));
  }, [bookingData, selSeries, selColor, models, types]);

  function pickBookingCustomer(b) {
    setSelBooking(b);
    setCust(p => ({
      ...p,
      customer_name: b.customer_name || p.customer_name,
      customer_phone: b.customer_phone || b.phone || p.customer_phone,
    }));
  }
  // เงินมัดจำที่ใช้หัก = มัดจำคงเหลือของใบจองที่เลือก (ไม่จอง = 0)
  const depositAmt = bookingAsk === "booked" && selBooking ? Number(selBooking.remaining || 0) : 0;

  // ===== ราคาประกาศ ณ วันจอง — ลูกค้าจองไว้ก่อนปรับราคา ต้องคิดราคาวันที่จอง ไม่ใช่ราคาปัจจุบัน (เหมือนหน้าขายปลีก) =====
  const bookingDateISO = bookingAsk === "booked" && selBooking?.booking_date ? String(selBooking.booking_date).slice(0, 10) : "";
  const [bookingPrices, setBookingPrices] = useState(null); // ตารางราคา ณ วันจอง (null = ใช้ราคาปัจจุบัน)
  useEffect(() => {
    if (!bookingDateISO) { setBookingPrices(null); return; }
    let alive = true;
    post(MASTER_API, { action: "get_moto_prices", as_of: bookingDateISO })
      .then((d) => { if (alive) setBookingPrices(Array.isArray(d) && d.length ? d : null); })
      .catch(() => { if (alive) setBookingPrices(null); });
    return () => { alive = false; };
  }, [bookingDateISO]);
  const usingBookingPrice = !!(bookingDateISO && bookingPrices);
  // LINE ของลูกค้า: จาก customer master (เลือก/เพิ่ม) หรือจากใบจอง (จองผ่าน QR/LINE)
  // ⚠️ ต้องอยู่หลังบรรทัดประกาศ selBooking เท่านั้น (TDZ → จอขาวทั้งแอป)
  const custLineUserId = text(cust.customer_line_user_id) || text(selBooking?.line_user_id);

  // ---- ของแถม-บริการ + ของแถม-สินค้า (logic เดียวกับบันทึกขายปลีก) ----
  const [selectedGiveaways, setSelectedGiveaways] = useState({});               // {expense_id: true}
  const [productGiveaways, setProductGiveaways] = useState([]);                 // จาก giveaway_rules
  const [selectedProductGiveaways, setSelectedProductGiveaways] = useState({}); // {rule_id: true}
  const [reloadingGiveaways, setReloadingGiveaways] = useState(false);

  const masterRow = useMemo(() => (selUnit && selColor ? findMasterRow(selUnit, selColor) : null), [selUnit, selColor]); // eslint-disable-line

  // โหลดของแถม-สินค้า ตาม type ของคันที่เลือก (รวมระดับ ยี่ห้อ/รุ่น/แบบ)
  useEffect(() => {
    if (!masterRow?.type_id) { setProductGiveaways([]); setSelectedProductGiveaways({}); return; }
    let alive = true;
    post(GIVEAWAY_API, { op: "list_for_type", type_id: Number(masterRow.type_id) })
      .then(res => {
        if (!alive) return;
        const rows = asArray(res && res.rows ? res.rows : res).filter(r => r && r.id);
        setProductGiveaways(rows);
        setSelectedProductGiveaways(Object.fromEntries(rows.map(r => [r.id, true])));
      })
      .catch(() => { if (alive) { setProductGiveaways([]); setSelectedProductGiveaways({}); } });
    return () => { alive = false; };
  }, [masterRow?.type_id]); // eslint-disable-line

  async function reloadGiveaways() {
    setReloadingGiveaways(true);
    try {
      const se = await post(MASTER_API, { action: "get_sale_expenses" });
      setSaleExpenses(asArray(se).filter(x => x.expense_type === "promotion" && x.status === "active"));
    } finally { setReloadingGiveaways(false); }
  }

  // ของแถม-บริการที่เข้าเงื่อนไขกับรถ/การขายปัจจุบัน — port จาก RetailSalePage
  const applicableGiveaways = useMemo(() => {
    if (!masterRow || !saleType || saleType === "wholesale") return [];
    const sel = masterRow; // มี brand_id / series_id / type_id
    const rowCC = selSeries ? Number(selSeries.engine_cc) || null : null;
    const fin = saleType === "finance";
    const finId = fin ? (financeCo?.company_id ?? "") : "";
    // โปรต้องมีผล ณ วันอ้างอิง: ลูกค้าจอง = วันจอง (เหมือนราคา ณ วันจอง), ไม่จอง = วันนี้
    const refDate = bookingDateISO || todayStr();
    return saleExpenses.filter((e) => {
      const eff = e.effective_date ? String(e.effective_date).slice(0, 10) : "";
      const end = e.end_date ? String(e.end_date).slice(0, 10) : "";
      if ((eff && eff > refDate) || (end && end < refDate)) return false;
      if (e.group_by === "brand" && String(e.brand_id) === String(sel.brand_id)) return true;
      if (e.group_by === "type" && String(e.type_id) === String(sel.type_id)) {
        const cond = String(e.note || "all").trim().toLowerCase();
        if (cond === "finance") return fin;
        if (cond === "cash") return !fin;
        return true;
      }
      if (e.group_by === "cc" && rowCC && Number(e.engine_cc) === rowCC) return true;
      if (e.group_by === "finance" && finId && String(e.company_id) === String(finId)) return !excludedByNote(e.note, [selUnit?.model, selUnit?.model_code, selSeries?.series_name, selSeries?.marketing_name], selType?.vehicle_type_name);
      if (e.group_by === "series") {
        const [sid, pc] = String(e.note || "").split("|");
        if (String(sid) !== String(sel.series_id)) return false;
        const cond = pc || "all";
        if (cond === "finance") return fin;
        if (cond === "cash") return !fin;
        return true;
      }
      if (e.group_by === "name_prefix") {
        const pfx = String(e.note || "").replace(/\s+/g, "");
        const cn = String(cust.customer_name || "").replace(/\s+/g, "");
        return pfx && cn && cn.startsWith(pfx);
      }
      if (e.group_by === "province") {
        const stripProv = (s) => String(s || "").replace(/^จังหวัด/, "").trim();
        const eprov = stripProv(e.province);
        const mode = String(e.province_mode || "include").toLowerCase();
        const target = String(e.province_target || "customer").toLowerCase();
        const plateProv = "พระนครศรีอยุธยา"; // ยังไม่มีช่องจังหวัดจดทะเบียนใน wizard — ใช้ค่าเริ่มต้นเหมือนหน้าขายปลีก
        const finCompany = financeCos.find((f) => String(f.company_id) === String(finId));
        const finAddr = String(finCompany?.address || "");
        const finHasProv = eprov && finAddr.includes(eprov);
        const customerProv = stripProv(cust.customer_province);
        const hasFinance = fin && finId;
        if (mode === "cross") {
          if (eprov !== plateProv) return false;
          if (!hasFinance) {
            if (!customerProv) return true;
            return customerProv !== eprov;
          }
          return !finHasProv;
        }
        if (target === "registered") {
          if (mode === "exclude") return eprov !== plateProv;
          return eprov === plateProv;
        }
        if (hasFinance) {
          if (mode === "exclude") return !finHasProv;
          return finHasProv;
        }
        if (!customerProv) return true;
        if (mode === "exclude") return eprov !== customerProv;
        return eprov === customerProv;
      }
      return false;
    }).filter((e) => {
      const name = String(e.expense_name || "").toLowerCase().replace(/\s+/g, "");
      return !(name.includes("ค่าคอมพิเศษ") || name.includes("commission") || name.includes("คอมพิเศษ"));
    }).filter((() => {
      // กันโปรตัวเดียวกันเข้าเงื่อนไขหลายระดับพร้อมกัน (เช่น 3PLUS ตั้งไว้ทั้งระดับรุ่นและระดับแบบ) — ชื่อ+ยอดเดียวกันนับครั้งเดียว
      const seen = new Set();
      return (e) => {
        const k = String(e.expense_name || "").replace(/\s+/g, "") + "|" + (Number(e.amount) || 0);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      };
    })());
  }, [masterRow, saleType, financeCo, saleExpenses, selSeries, cust.customer_name, cust.customer_province, financeCos, bookingDateISO]);

  // default: ติ๊กรายการที่เข้าเงื่อนไขไว้ก่อน (รายการใหม่ → ติ๊กอัตโนมัติ, ที่ผู้ใช้เอาออกเองคงไว้)
  useEffect(() => {
    setSelectedGiveaways((prev) => {
      let changed = false; const next = { ...prev };
      for (const g of applicableGiveaways) {
        if (!(g.expense_id in next)) { next[g.expense_id] = true; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [applicableGiveaways]);

  // รวมหมวด "ค่าจดทะเบียน" เป็นการ์ดเดียว + ซ่อน "เงินดาวน์ออกแทน" (ไปเป็นส่วนลด)
  const displayGiveaways = useMemo(() => {
    const filtered = applicableGiveaways.filter((g) => !isDownPaymentSub(g.expense_name));
    const REG = "ค่าจดทะเบียน";
    const reg = filtered.filter((g) => String(g.category || "").trim() === REG);
    if (reg.length <= 1) return filtered;
    const merged = { __merged: true, key: "__reg__", expense_name: REG, category: REG, amount: reg.reduce((s, g) => s + Number(g.amount || 0), 0), ids: reg.map((g) => g.expense_id), count: reg.length };
    const out = []; let ins = false;
    for (const g of filtered) {
      if (String(g.category || "").trim() === REG) { if (!ins) { out.push(merged); ins = true; } }
      else out.push(g);
    }
    return out;
  }, [applicableGiveaways]);

  const giveawaysTotal = applicableGiveaways
    .filter((g) => selectedGiveaways[g.expense_id] && !isDownPaymentSub(g.expense_name))
    .reduce((s, g) => s + Number(g.amount || 0), 0);
  // ส่วนลดจาก "เงินดาวน์ออกแทน" ที่ติ๊กไว้ — หักออกจากยอดที่ลูกค้าจ่าย (เหมือนหน้าขายปลีก)
  const downSubTotal = applicableGiveaways
    .filter((g) => selectedGiveaways[g.expense_id] && isDownPaymentSub(g.expense_name))
    .reduce((s, g) => s + Number(g.amount || 0), 0);
  // แบ่งโปรเงินดาวน์ออกแทน (user กำหนด 2026-08-20): ส่วนหนึ่งช่วยลดค่างวดจ่ายล่วงหน้าได้ (เฉพาะผ่อนไฟแนนท์)
  // ส่วนที่เหลือ = ส่วนลดราคา (ดาวน์ออกแทน) เหมือนเดิม — ยอดจัดไฟแนนซ์จะตรงตามใบอนุมัติ
  const [advSubsidyInput, setAdvSubsidyInput] = useState("");
  // มัดจำป้ายแดง (user กำหนด 2026-08-21): กรอกทะเบียนป้ายแดง → มัดจำ 200 บาท อัตโนมัติ, ไม่กรอก = 0 — บวกเข้ายอดรับชำระ
  const RED_PLATE_DEPOSIT = 200;
  const [redPlateNo, setRedPlateNo] = useState("");
  const redPlateDep = text(redPlateNo) ? RED_PLATE_DEPOSIT : 0;
  const advSub = saleType === "finance" ? Math.min(Math.max(num(advSubsidyInput), 0), downSubTotal) : 0;
  const downSubDiscount = downSubTotal - advSub;

  // ประกันรถหายจากโปรโมชั่นที่ติ๊กไว้ — ร้านออกแทน (ไฟแนนซ์หักจากยอดโอน) ไม่เก็บลูกค้า ไม่บวกเข้ายอดชำระ
  // ใช้เติม theft_insurance_amount อัตโนมัติ พนักงานไม่ต้องกรอกช่อง "ประกันรถหาย" (กรอกเองเฉพาะเคสลูกค้าจ่ายเบี้ยเอง)
  const isTheftName = (name) => /ประกันรถหาย|รถหาย/.test(String(name || "").replace(/\s+/g, ""));
  // นับเฉพาะประกันรถหายที่ไฟแนนท์ออกแทน (หักจากยอดโอน) — กรมธรรม์ COSMOS (ปีต่อ/เงินสด หมวด "ประกัน คอสมอส") เป็นของแถมที่ร้านซื้อเอง ไม่ใช่ยอดไฟแนนท์หัก (2026-08-22)
  const isCosmos = (g) => /COSMOS|คอสมอส/i.test(String(g.expense_name || "") + " " + String(g.category || ""));
  const isFinTheft = (g) => isTheftName(g.expense_name) && !isCosmos(g);
  // ใบขายนี้มีประกันรถหาย COSMOS (ปีต่อ/เงินสด) ที่ติ๊กไว้ → มีกรมธรรม์ให้ส่งลูกค้า (ของไฟแนนท์ออกแทนไม่มีเอกสาร)
  const hasCosmosTheft = applicableGiveaways.some((g) => selectedGiveaways[g.expense_id] && isTheftName(g.expense_name) && isCosmos(g));
  const promoTheft = applicableGiveaways
    .filter((g) => selectedGiveaways[g.expense_id] && isFinTheft(g))
    .reduce((s, g) => s + Number(g.amount || 0), 0);
  // ติ๊ก "ค่าประกันรถหาย" ออกจากของแถม = ลูกค้าจ่ายเบี้ยเอง → บวกเข้ายอดเก็บลูกค้า (user กำหนด 2026-08-20)
  const unpromoTheft = applicableGiveaways
    .filter((g) => !selectedGiveaways[g.expense_id] && isFinTheft(g))
    .reduce((s, g) => s + Number(g.amount || 0), 0);
  // เบี้ยส่วนที่ลูกค้าจ่ายเอง: ช่องกรอกชนะเสมอ ไม่กรอกใช้ยอดโปรที่ติ๊กออก
  const custPaidTheft = num(finTheft) > 0 ? num(finTheft) : unpromoTheft;

  // บันทึกการขาย (เงินสด/ผ่อนไฟแนนท์) — payload เดียวกับหน้าบันทึกขายปลีก (retail-sale-api save_sale)
  async function handleSaveSale() {
    if (saving || savedSale || !selUnit) return;
    const isFin = saleType === "finance";
    const base = announcedPrice(saleType);
    const carPrice = base == null ? null : base + (isWholesale ? 0 : markupsTotal + adjustmentsTotal);
    if (carPrice == null) { setMessage(isWholesale ? "❌ กรอกราคาขายส่งก่อน" : "❌ ไม่พบราคาขายของรถคันนี้ — ตรวจสอบเมนูราคารถก่อน"); return; }
    if (!text(cust.customer_name)) { setMessage("❌ กรุณากรอกชื่อลูกค้า"); return; }
    const netCar = Math.max(carPrice - downSubDiscount, 0); // หักส่วนลด "เงินดาวน์ออกแทน" (เฉพาะส่วนที่ไม่ได้แบ่งไปช่วยค่างวดล่วงหน้า)
    const fc = financeCalc(netCar);
    if (isFin && !(fc.n > 0)) { setMessage("❌ กรอกจำนวนงวด"); return; }

    // 🧪 โหมดทดสอบ: ไม่บันทึกลง DB — แต่ "ส่งใบขายเข้า LINE ลูกค้าจริง" ทันทีหลังบันทึก
    if (TEST_MODE) {
      const dep = depositAmt;
      const totalPayment = (isFin ? fc.down + fc.advance + custPaidTheft - advSub : netCar) - dep + redPlateDep; // ติดลบ = ต้องคืนเงินมัดจำ
      const testSale = {
        __test: true,
        sale_no: "TEST-" + todayStr().replace(/-/g, "") + "-" + String(Date.now()).slice(-4),
        sale_date: todayStr(),
        customer_name: cust.customer_name,
        customer_code: cust.customer_code, customer_address: cust.customer_address, customer_tax_id: cust.customer_tax_id,
        brand: selBrand.brand_name,
        model_name: (selSeries.marketing_name || selSeries.series_name) + " (" + selUnit.model + (selUnit.model_type ? " " + selUnit.model_type : "") + ")",
        engine_no: selUnit.engine_no, chassis_no: selUnit.chassis_no,
        color: selColor.name,
        seller: currentUser?.username || currentUser?.name || "",
        car_price: carPrice, discount: downSubDiscount, net_car_price: netCar,
        down_payment: isFin ? fc.down : 0,
        booking_deposit: dep, deposit_no: selBooking?.deposit_no || "", booking_date: selBooking?.booking_date || "",
        total_payment: totalPayment,
        red_plate_no: text(redPlateNo), red_plate_deposit: redPlateDep,
        advance_installment: isFin ? fc.advance : 0,
        installments: isFin ? fc.n : 0,
        installment_amount: isFin ? fc.inst : 0,
        interest_rate: isFin ? num(finRate) : 0,
        finance_amount: isFin ? fc.financeAmount : 0,
        theft_insurance_amount: isFin ? (custPaidTheft || promoTheft) : 0,
        finance_type: isFin ? "moto" : "none",
        finance_company_name: isFin ? (financeCo?.company_name || "") : "",
        branch_name: currentUser?.branch || "",
        branch_code: currentUser?.branch_code || currentUser?.branch || "",
      };
      setSavedSale(testSale);
      setMessage("🧪 โหมดทดสอบ — ยังไม่บันทึกลงฐานข้อมูล · กำลังส่งใบขายเข้า LINE ลูกค้าจริง...");
      sendSaleFlex(testSale);
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      // ไม่มี LINE → ลองผูกจากเบอร์โทรอัตโนมัติก่อนบันทึก (เจอ = ใบขาย/ใบเสร็จส่ง LINE ได้ตามปกติ)
      const autoLink = await autoLinkLineByPhone();
      // ดึงข้อมูลรถเต็มจากตารางรับสินค้า (ต้องได้ stock_id/stock_table + เช็คว่ายังไม่ถูกขาย)
      const vres = await post(RETAIL_API, { action: "get_vehicle", keyword: selUnit.engine_no });
      const vehicle = Array.isArray(vres) ? vres[0] : vres;
      if (!vehicle || (!vehicle.stock_id && !vehicle.engine_no)) throw new Error("ไม่พบรถคันนี้ในสต๊อก");
      if ((vehicle.sale && vehicle.sale.sale_no) || vehicle.sold_at) throw new Error("รถคันนี้ถูกขายไปแล้ว");
      // มัดจำป้ายแดง: ห้ามใช้เลขป้ายที่ยังค้างคืนอยู่ (มีใบรับมัดจำ held หรือใบขายอื่นที่ยังไม่รับชำระถือป้ายนี้) — user 2026-08-24
      if (redPlateDep > 0) {
        const normPlate = (v) => String(v || "").replace(/[^0-9A-Za-zก-๙]/g, "");
        // ป้ายแดงเลขซ้ำกันได้ข้ามสังกัด (สิงห์ชัย/ป.เปา มีป้ายจริงคนละชุด) — เช็คซ้ำเฉพาะสังกัดเดียวกัน (user 2026-08-28)
        const affOf = (bc) => { const c = String(bc || "").substring(0, 5).toUpperCase(); return (c === "SCY05" || c === "SCY06") ? "ป.เปา" : "สิงห์ชัย"; };
        const myAff = affOf(currentUser?.branch_code || currentUser?.branch);
        const myPlate = normPlate(redPlateNo);
        const held = await post(RETAIL_API, { action: "list_red_plate_deposits", status: "held" }).catch(() => []);
        const dup = (Array.isArray(held) ? held : []).find((d) => normPlate(d.plate_no) === myPlate && affOf(d.branch_code) === myAff);
        if (dup) throw new Error(`ทะเบียนป้ายแดง ${text(redPlateNo)} ยังค้างคืนอยู่ (ใบรับมัดจำ ${dup.deposit_no} · ${dup.customer_name || "-"} · ใบขาย ${dup.sale_no}) — รับป้ายคืนก่อน หรือใช้ป้ายอื่น`);
        const d0 = new Date(); d0.setDate(d0.getDate() - 60);
        const recent = await post(RETAIL_API, { action: "list_retail_sales", date_from: d0.toISOString().slice(0, 10), date_to: todayStr(), limit: 2000 }).catch(() => []);
        const dup2 = (Array.isArray(recent) ? recent : []).find((r) => normPlate(r.red_plate_no) === myPlate && affOf(r.branch_code) === myAff && r.payment_status !== "paid" && String(r.sale_status || "10") !== "90");
        if (dup2) throw new Error(`ทะเบียนป้ายแดง ${text(redPlateNo)} ถูกใช้ในใบขาย ${dup2.invoice_no} (${dup2.customer_name || "-"}) ที่ยังไม่รับชำระ — ใช้ป้ายอื่น`);
      }
      // ขายส่ง: ห้ามขายต่ำกว่าทุน (ราคาทุนจากใบรับรถ unit_cost) — user กำหนด 2026-08-22
      if (isWholesale && num(vehicle.unit_cost) > 0 && carPrice < num(vehicle.unit_cost)) {
        throw new Error(`ราคาขายส่ง ${Number(carPrice).toLocaleString("th-TH")} ต่ำกว่าราคาทุน ${Number(vehicle.unit_cost).toLocaleString("th-TH")} บาท — ห้ามขายต่ำกว่าทุน`);
      }

      const dep = depositAmt;
      const totalPayment = (isFin ? fc.down + fc.advance + custPaidTheft - advSub : netCar) - dep + redPlateDep; // ติดลบ = ต้องคืนเงินมัดจำ
      const payload = {
        action: "save_sale",
        brand: vehicle.brand, stock_table: vehicle.stock_table, stock_id: vehicle.stock_id,
        unit_cost: vehicle.unit_cost, chassis_no: vehicle.chassis_no, engine_no: vehicle.engine_no,
        model_code: vehicle.model_code, model_year: vehicle.model_year, model_color: vehicle.model_color, model_name: vehicle.model_name,
        sale_date: todayStr(),
        customer_code: cust.customer_code || autoLink?.customer_code || "",
        customer_name: cust.customer_name,
        customer_address: cust.customer_address || autoLink?.customer_address || "",
        customer_tax_id: cust.customer_tax_id || autoLink?.customer_tax_id || "",
        customer_phone: cust.customer_phone, customer_birthdate: cust.customer_birthdate,
        customer_gender: cust.customer_gender,
        line_user_id: cust.customer_line_user_id || selBooking?.line_user_id || autoLink?.customer_line_user_id || "",
        seller: currentUser?.username || currentUser?.name || "",
        note: isWholesale ? "ขายส่ง" : "",
        finance_type: isFin ? "moto" : "none",
        car_price: carPrice, net_car_price: netCar, discount: downSubDiscount, other_sale: 0,
        down_payment: isFin ? fc.down : 0,
        booking_deposit: dep, deposit_no: selBooking?.deposit_no || "",
        total_payment: totalPayment,
        red_plate_no: text(redPlateNo), red_plate_deposit: redPlateDep,
        advance_installment: isFin ? fc.advance : 0,
        // เงินดาวน์/ค่างวดออกแทน (ยอดฐานก่อนคูณ 1.07) — ไว้โชว์เป็นของแถมหักตอนรับชำระ
        down_payout_amount: (adjOpen && useDownPayout ? Number(downPayout || 0) : 0) + advSub,
        // ประกันรถหาย: ลูกค้าจ่ายเอง (กรอกช่อง) ชนะ; ไม่กรอก = ใช้ยอดโปรโมชั่นออกแทนอัตโนมัติ (ไม่บวกเข้า total_payment)
        theft_insurance_amount: isFin ? (custPaidTheft || promoTheft) : 0,
        theft_insurance_source: isFin ? (custPaidTheft > 0 ? "finance" : promoTheft > 0 ? "โปรโมชั่นออกแทน" : null) : null,
        finance_company_code: isFin ? String(financeCo?.company_id || "") : "",
        finance_company_name: isFin ? (financeCo?.company_name || "") : "",
        interest_rate: isFin ? num(finRate) : 0,
        installments: isFin ? fc.n : 0,
        finance_amount: isFin ? fc.financeAmount : 0,
        installment_amount: isFin ? fc.inst : 0,
        payment_status: "unpaid", tax_invoice_status: "none",
        branch_code: currentUser?.branch_code || currentUser?.branch || "",
        branch_name: currentUser?.branch || "",
        created_by: currentUser?.username || currentUser?.name || "system",
      };
      const row = await post(RETAIL_API, payload);
      const sale = row && (row.sale || row);
      if (!sale || !sale.sale_no) throw new Error((row && (row.error || row.__error)) || "บันทึกไม่สำเร็จ");

      let msg = "✅ บันทึกใบขายเรียบร้อย เลขที่ " + sale.sale_no + " (ตัดออกจากสต๊อกแล้ว)";
      // ตัดใบจองเป็น "ขาย" อัตโนมัติ — action เดียวกับปุ่ม "ขาย" ในหน้าระบบจอง
      if (selBooking?.booking_id) {
        const r = await post(BOOKING_API, { action: "sell_moto_booking", booking_id: selBooking.booking_id, invoice_no: sale.sale_no });
        msg += r ? ' · ตัดใบจองเป็น "ขาย" แล้ว' : ' — ⚠️ ตัดใบจองอัตโนมัติไม่สำเร็จ กรุณากดปุ่ม "ขาย" ในหน้าระบบจองเอง';
      }
      // เติม field แสดงผลสำหรับเอกสาร/ใบเสร็จ (แถวใน DB เก็บชื่อรุ่น DMS/รหัสสี — ใช้ชื่อสวยจาก wizard แทน)
      const saleDoc = {
        ...sale,
        brand: selBrand.brand_name,
        model_name: (selSeries.marketing_name || selSeries.series_name) + " (" + selUnit.model + (selUnit.model_type ? " " + selUnit.model_type : "") + ")",
        color: selColor.name,
        booking_date: selBooking?.booking_date || "",
      };
      setSavedSale(saleDoc);
      setStock(prev => prev.filter(r => r.engine_no !== selUnit.engine_no)); // เอาคันที่ขายออกจากลิสต์สต๊อก
      if (autoLink?.customer_line_user_id) msg += " · 🔗 ผูก LINE ลูกค้าจากเบอร์โทรให้อัตโนมัติ";
      if (custLineUserId || autoLink?.customer_line_user_id) msg += " · กำลังส่งใบขายเข้า LINE ลูกค้า...";
      setMessage(msg);
      sendSaleFlex(saleDoc, autoLink?.customer_line_user_id); // ส่งใบขายเข้า LINE ลูกค้าทันที (ถ้าไม่มี LINE จะขึ้นสถานะแจ้งเอง)
    } catch (e) {
      setMessage("บันทึกไม่สำเร็จ: " + (e.message || e));
    }
    setSaving(false);
  }

  // รุ่น/สีที่ขายไม่มีคิวจองเลย → ข้ามคำถาม จอง/ไม่จอง อัตโนมัติ (ถือเป็นขายหน้าร้าน)
  useEffect(() => {
    if (!saleType || bookingAsk !== null) return;
    if (bookingLoading || !bookingData) return;
    if (readyBookings.length === 0) setBookingAsk("walkin");
  }, [saleType, bookingAsk, bookingLoading, bookingData, readyBookings]);

  function answerBooking(v) {
    if (v === "walkin" && selBooking) {
      // ล้างชื่อที่เติมมาจากใบจอง (ถ้า user ยังไม่แก้เอง)
      setCust(p => (p.customer_name === selBooking.customer_name ? { ...p, customer_name: "" } : p));
    }
    setBookingAsk(v);
    if (v === "walkin") setSelBooking(null);
  }

  // สต๊อกรายคันของยี่ห้อที่เลือก + รูปสี
  const [stock, setStock] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [imgCache, setImgCache] = useState({}); // color_id -> data URL | "none"

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [b, vt, s, m, t, c, pt, pr, fc, se] = await Promise.all([
          post(MASTER_API, { action: "get_brands" }),
          post(MASTER_API, { action: "get_vehicle_types" }),
          post(MASTER_API, { action: "get_series" }),
          post(MASTER_API, { action: "get_models" }),
          post(MASTER_API, { action: "get_types" }),
          post(MASTER_API, { action: "get_colors" }),
          post(MASTER_API, { action: "get_price_types" }),
          post(MASTER_API, { action: "get_moto_prices" }),
          post(MASTER_API, { action: "get_finance_companies" }),
          post(MASTER_API, { action: "get_sale_expenses" }),
        ]);
        setBrands(asArray(b).filter(x => (x.status || "active") === "active"));
        setVehicleTypes(asArray(vt).filter(x => (x.status || "active") === "active"));
        setSeries(asArray(s).filter(x => (x.status || "active") === "active"));
        setModels(asArray(m));
        setTypes(asArray(t));
        setColors(asArray(c).filter(x => (x.status || "active") === "active"));
        setPriceTypes(asArray(pt).filter(x => (x.status || "active") === "active"));
        setPrices(asArray(pr));
        setFinanceCos(asArray(fc).filter(x => (x.status || "active") === "active"));
        setSaleExpenses(asArray(se).filter(x => x.expense_type === "promotion" && x.status === "active"));
      } catch { setMessage("โหลดข้อมูลรุ่นรถไม่สำเร็จ"); }
      setLoading(false);
    })();
  }, []);

  // function declaration (hoisted) — ถูกเรียกจาก useMemo ที่อยู่ก่อนบรรทัดนี้ ห้ามเป็น const arrow (TDZ → จอขาวทั้งแอป)
  function brandParam(brandRow) {
    const n = text(brandRow?.brand_name);
    return /ยามาฮ่า|YAMAHA/i.test(n) ? "YAMAHA" : "HONDA";
  }

  // โหลดสต๊อกรายคันเมื่อรู้ยี่ห้อ (ใช้ตอนนับจำนวนต่อสี + list คัน)
  useEffect(() => {
    if (!selBrand) { setStock([]); return; }
    let alive = true;
    (async () => {
      setStockLoading(true);
      try {
        const data = asArray(await post(STOCK_API, {
          action: "stock_on_hand", brand: brandParam(selBrand), as_of: todayStr(), new_only: true, deduct_sales: true,
        }));
        if (alive) setStock(data.filter(r => r && r.engine_no));
      } catch { if (alive) setStock([]); }
      if (alive) setStockLoading(false);
    })();
    return () => { alive = false; };
  }, [selBrand]);

  // ---- ขั้นที่ 3: รุ่นของ ประเภท+ยี่ห้อ ----
  const seriesOptions = useMemo(() => {
    if (!selType || !selBrand) return [];
    return series.filter(s => String(s.brand_id) === String(selBrand.brand_id)
      && String(s.vehicle_type_id || "") === String(selType.vehicle_type_id));
  }, [series, selType, selBrand]);

  // ---- ขั้นที่ 4: สีทุกสีของรุ่น (group ตามชื่อสี) ----
  const colorGroups = useMemo(() => {
    if (!selSeries) return [];
    const rows = colors.filter(c => String(c.series_id) === String(selSeries.series_id));
    const map = new Map();
    for (const r of rows) {
      const key = normColor(r.color_name) || text(r.color_code);
      if (!map.has(key)) map.set(key, { key, name: text(r.color_name) || text(r.color_code), codes: [], rows: [] });
      const g = map.get(key);
      g.rows.push(r);
      if (!g.codes.includes(text(r.color_code))) g.codes.push(text(r.color_code));
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [colors, selSeries]);

  // จับคู่ stock row กับ master color rows ของกลุ่มสี
  function unitMatchesGroup(row, group, brandCode) {
    for (const r of group.rows) {
      if (brandCode === "HONDA") {
        // HONDA: model = model_code (ACF125CAT), color = color_code (GBR)
        if (text(row.model) === text(r.model_code) && text(row.color).toUpperCase() === text(r.color_code).toUpperCase()) return true;
      } else {
        // YAMAHA: model_type = รหัส type (BKF600), color = ชื่อสีไทย
        const colorOk = normColor(row.color) === normColor(r.color_name) || text(row.color).toUpperCase() === text(r.color_code).toUpperCase();
        if (!colorOk) continue;
        if (text(row.model_type) && text(row.model_type) === text(r.type_name)) return true;
        const a = normModel(row.model), b = normModel(r.model_code || selSeries?.series_name);
        if (a && b && (a === b || a.includes(b) || b.includes(a))) return true;
      }
    }
    return false;
  }

  const unitsOfGroup = (group) => {
    if (!selBrand || !group) return [];
    const bc = brandParam(selBrand);
    return stock.filter(r => unitMatchesGroup(r, group, bc))
      .sort((a, b) => text(a.received_date).localeCompare(text(b.received_date)) || text(a.engine_no).localeCompare(text(b.engine_no)));
  };

  // รูปของกลุ่มสี: ใช้แถวแรกที่มี has_image
  function ensureImage(group) {
    const row = group.rows.find(r => r.has_image);
    if (!row || imgCache[row.color_id] !== undefined) return;
    setImgCache(p => ({ ...p, [row.color_id]: null })); // loading
    post(MASTER_API, { action: "get_color_image", color_id: row.color_id }).then(res => {
      const rec = Array.isArray(res) ? res[0] : res;
      setImgCache(p => ({ ...p, [row.color_id]: rec?.image_data || "none" }));
    }).catch(() => setImgCache(p => ({ ...p, [row.color_id]: "none" })));
  }
  const groupImage = (group) => {
    const row = group.rows.find(r => r.has_image);
    if (!row) return "none";
    const v = imgCache[row.color_id];
    return v === undefined ? null : v; // null = กำลังโหลด
  };

  useEffect(() => { if (selSeries) colorGroups.forEach(ensureImage); }, [selSeries, colorGroups]); // eslint-disable-line

  // หา master color row ของคันที่เลือก (เอา type_id ไปดูราคาประกาศ)
  function findMasterRow(unit, group) {
    if (!unit || !group) return null;
    const bc = brandParam(selBrand);
    if (bc === "HONDA") {
      const exact = group.rows.find(r => text(unit.model) === text(r.model_code) && text(unit.model_type) === text(r.type_name) && text(unit.color).toUpperCase() === text(r.color_code).toUpperCase());
      if (exact) return exact;
      // ราคาขายต้องตรงตามแบบ+type ของคันจริง — ห้ามข้าม type (เคย fallback ด้วยสีแล้วไปหยิบราคา TH ทั้งที่คันจริงเป็น TH5 ราคาต่างกัน 300)
      if (text(unit.model_type)) {
        const byType = group.rows.find(r => text(unit.model) === text(r.model_code) && text(unit.model_type) === text(r.type_name));
        if (byType) return byType;
      }
      // คันที่สต๊อกไม่มี type เท่านั้นถึงยอมจับด้วยแบบ+สี
      return group.rows.find(r => text(unit.model) === text(r.model_code) && text(unit.color).toUpperCase() === text(r.color_code).toUpperCase())
        || null;
    }
    return group.rows.find(r => text(unit.model_type) && text(unit.model_type) === text(r.type_name))
      || group.rows.find(r => {
        const a = normModel(unit.model), b = normModel(r.model_code || selSeries?.series_name);
        return a && b && (a === b || a.includes(b) || b.includes(a));
      })
      || null;
  }

  // ราคาประกาศ: กลุ่มสาขา (ป.เปา/สิงห์ชัย) ตาม user ถ้าไม่มีก็อิงยี่ห้อ
  // กลุ่มดูจากตาราง branch_price_groups (ตั้งค่าได้ในหน้าบันทึกราคาขาย แท็บ "ร้านที่ใช้ราคา")
  // ลูกค้าจอง → ใช้กลุ่ม ณ วันจอง (สาขาที่เพิ่งสลับกลุ่มหลังวันจอง ต้องคิดราคากลุ่มเดิมของวันที่ลูกค้ามัดจำ)
  const [pbgRows, setPbgRows] = useState([]);
  useEffect(() => { fetchPriceBranchGroups().then(setPbgRows); }, []);
  const branchGroup = useMemo(() => {
    const bc = text(currentUser?.branch_code || currentUser?.branch).slice(0, 5);
    if (bc) return priceGroupOf(bc, pbgRows, bookingDateISO || undefined);
    return selBrand && brandParam(selBrand) === "HONDA" ? "ป.เปา" : "สิงห์ชัย";
  }, [currentUser, selBrand, pbgRows, bookingDateISO]);

  function announcedPrice(wantSaleType) {
    if (wantSaleType === "wholesale") return num(wholesalePrice) > 0 ? num(wholesalePrice) : null;
    const masterRow = findMasterRow(selUnit, selColor);
    if (!masterRow) return null;
    const wantFinance = wantSaleType === "finance";
    const pt = priceTypes.find(p => {
      const n = text(p.type_name);
      if (!n.includes(branchGroup)) return false;
      return wantFinance ? (n.includes("ไฟแนนท์") || n.includes("ไฟแนนซ์")) : n.includes("เงินสด");
    });
    if (!pt) return null;
    const ptId = pt.price_type_id || pt.type_id;
    // ลูกค้าจอง → ใช้ตารางราคา ณ วันจอง (เหมือนหน้าขายปลีก) ไม่ใช่ราคาปัจจุบัน
    const priceRows = usingBookingPrice ? bookingPrices : prices;
    const row = priceRows.find(x => String(x.type_id) === String(masterRow.type_id) && String(x.price_type_id) === String(ptId));
    return row ? Number(row.amount || 0) : null;
  }
  const fmtBaht = (n) => n == null ? "-" : Number(n).toLocaleString("th-TH") + " บาท";

  // ค่านำพา bonus (HONDA: ทุก 500 → +2000, YAMAHA: ทุก 500 → +1000) — ตัวเลขที่กรอกไม่บวกเข้าราคา เอาเฉพาะโบนัส
  const deliveryBonus = useMemo(() => {
    if (!adjOpen || !useDeliveryFee || !selBrand) return 0;
    const fee = Number(deliveryFee || 0);
    if (fee <= 0) return 0;
    const multiplier = brandParam(selBrand) === "HONDA" ? 2000 : 1000;
    return Math.floor(fee / 500) * multiplier;
  }, [adjOpen, useDeliveryFee, deliveryFee, selBrand]); // eslint-disable-line
  // เงินดาวน์/ค่างวดออกแทน: input × 1.07 ปัดขึ้นหลักร้อย
  // บวกเพิ่มอัตโนมัติจากเมนู "ราคาขายบวกเพิ่ม" (ตามไฟแนนท์/ไฟแนนท์+CC/กำหนดเอง) — logic เดียวกับหน้าบันทึกขายปลีก
  const applicableMarkups = useMemo(() => {
    if (saleType !== "finance" || !financeCo || !selUnit || !selColor) return [];
    const masterRow = findMasterRow(selUnit, selColor);
    const norm = (s) => String(s || "").toLowerCase().replace(/[\s()[\].\-_]/g, "").trim();
    const finN = norm(financeCo.company_name);
    const brand = String(masterRow?.brand_name || selBrand?.brand_name || "").toLowerCase();
    const modelCode = String(masterRow?.model_code || selUnit.model || "").toLowerCase();
    const cc = selSeries && selSeries.engine_cc != null ? Number(selSeries.engine_cc) : null;
    const branchCodeUp = text(currentUser?.branch_code || currentUser?.branch).substring(0, 5);
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
        if (cc !== null && isFinite(cc)) {
          if (m.cc_min && cc < Number(m.cc_min)) return false;
          if (m.cc_max && cc > Number(m.cc_max)) return false;
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
    // บวก "ทุกกฎ" ที่เข้าเงื่อนไข (กฎ cc ซ้อนช่วงก็บวกรวม) — ให้ตรงกับระบบขายปลีกเดิม (user ยืนยัน 2026-07-20)
    return matched;
  }, [saleType, financeCo, selUnit, selColor, selBrand, selSeries, markups, currentUser]); // eslint-disable-line
  const markupsTotal = applicableMarkups.reduce((s, m) => s + Number(m.markup_amount || 0), 0);
  // เงินดาวน์/ค่างวดออกแทน: ปกติบวก ceil(ยอด×1.07) ขึ้นหลักร้อย — เฉพาะ SGF ให้ "ราคาขายรวม" ปัดขึ้นหลักพัน (user 2026-08-25 เช่น 68,900+2150×1.07 → 72,000)
  const isSGF = saleType === "finance" && /SGF|เอสจีเอฟ/i.test(String(financeCo?.company_name || ""));
  const downPayoutCalc = (() => {
    if (!(adjOpen && useDownPayout)) return 0;
    const withVat = Number(downPayout || 0) * 1.07;
    if (!isSGF) return Math.ceil(withVat / 100) * 100;
    const base = (announcedPrice(saleType) || 0) + markupsTotal + deliveryBonus;
    if (!base) return Math.ceil(withVat / 1000) * 1000;
    return Math.ceil((base + withVat) / 1000) * 1000 - base;
  })();
  const adjustmentsTotal = deliveryBonus + downPayoutCalc;

  function resetAdjustments() {
    setAdjOpen(false); setUseDeliveryFee(false); setDeliveryFee(0); setUseDownPayout(false); setDownPayout(0);
  }
  const thaiDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? String(iso).slice(0, 10) : d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  };

  function pickCustomer(c) {
    setCust(p => ({
      ...p,
      customer_code: c.code || p.customer_code,
      customer_name: c.name || p.customer_name,
      customer_province: c.province || p.customer_province,
      customer_line_user_id: c.line_user_id || p.customer_line_user_id,
      customer_address: c.address || p.customer_address,
      customer_tax_id: c.tax_id || p.customer_tax_id,
      customer_phone: c.phone || p.customer_phone,
      customer_birthdate: c.birth_date || p.customer_birthdate,
      customer_gender: c.gender || p.customer_gender,
    }));
    setShowCustomer(false);
  }

  // step ปัจจุบัน
  const step = !selType ? 1 : !selBrand ? 2 : !selSeries ? 3 : !selColor ? 4
    : !selUnit ? 5
    : (saleType === "finance" && !financeCo) ? 7 : 6;

  function goBack() {
    setMessage("");
    if (usedMode) {
      if (usedDone) { setUsedDone(null); setUsedSel(null); enterUsedMode(); return; }
      if (usedSel) { setUsedSel(null); setUsedSale(null); return; }
      setUsedMode(false); setUsedRows(null); return;
    }
    if (saleType === "finance" && !financeCo) { setSaleType(null); return; }   // ออกจากหน้าเลือกไฟแนนท์
    if (savedSale) return; // บันทึกแล้ว — ต้องกด "เริ่มใหม่" เท่านั้น
    if (selUnit) { setSelUnit(null); setSaleType(null); setFinanceCo(null); resetAdjustments(); resetFinanceInputs(); setBookingAsk(null); setSelBooking(null); setSelectedGiveaways({}); return; }
    if (selColor) { setSelColor(null); return; }
    if (selSeries) { setSelSeries(null); return; }
    if (selBrand) { setSelBrand(null); return; }
    if (selType) { setSelType(null); return; }
  }
  function resetAll() {
    setUsedMode(false); setUsedRows(null); setUsedSel(null); setUsedSale(null); setUsedDone(null);
    setSelType(null); setSelBrand(null); setSelSeries(null); setSelColor(null); setSelUnit(null);
    setSaleType(null); setFinanceCo(null); setCust(CUST_DEFAULT); resetAdjustments(); resetFinanceInputs(); setBookingAsk(null); setSelBooking(null); setSelectedGiveaways({}); setSavedSale(null); resetPostSave(); setMessage("");
  }
  function pickUnit(u) { setSelUnit(u); setSaleType(null); setFinanceCo(null); resetAdjustments(); resetFinanceInputs(); setBookingAsk(null); setSelBooking(null); setSelectedGiveaways({}); setSavedSale(null); resetPostSave(); }

  const crumb = (label, onClick) => (
    <span onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", color: onClick ? "#2563eb" : "#111827", fontWeight: 600 }}>
      {label}
    </span>
  );

  const STEP_TITLES = { 1: "เลือกประเภทรถ", 2: "เลือกยี่ห้อ", 3: "เลือกรุ่น", 4: "เลือกสี", 5: "เลือกคันที่จะขาย", 6: "เลือกประเภทการขาย", 7: "เลือกไฟแนนท์" };

  const gridStyle = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 14 });

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🛵 บันทึกขาย NEW</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {(step > 1 || usedMode) && <button className="btn-secondary" onClick={goBack}>← ย้อนกลับ</button>}
          {(step > 1 || usedMode) && <button className="btn-secondary" onClick={resetAll}>เริ่มใหม่</button>}
        </div>
      </div>

      {/* breadcrumb การเลือก */}
      {!usedMode && (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, fontSize: 14, fontFamily: "Tahoma" }}>
        {crumb(selType ? `ประเภท: ${selType.vehicle_type_name}` : "ประเภทรถ", selType ? () => { setSelBrand(null); setSelSeries(null); setSelColor(null); setSelUnit(null); setSelType(null); } : null)}
        <span style={{ color: "#9ca3af" }}>›</span>
        {crumb(selBrand ? `ยี่ห้อ: ${selBrand.brand_name}` : "ยี่ห้อ", selBrand ? () => { setSelSeries(null); setSelColor(null); setSelUnit(null); setSelBrand(null); } : null)}
        <span style={{ color: "#9ca3af" }}>›</span>
        {crumb(selSeries ? `รุ่น: ${selSeries.marketing_name || selSeries.series_name}` : "รุ่น", selSeries ? () => { setSelColor(null); setSelUnit(null); setSelSeries(null); } : null)}
        <span style={{ color: "#9ca3af" }}>›</span>
        {crumb(selColor ? `สี: ${selColor.name}` : "สี", selColor ? () => { setSelUnit(null); setSaleType(null); setFinanceCo(null); setSelColor(null); } : null)}
        <span style={{ color: "#9ca3af" }}>›</span>
        {crumb(selUnit ? `คัน: ${selUnit.engine_no}` : "เลือกคัน", selUnit ? () => { setSelUnit(null); setSaleType(null); setFinanceCo(null); } : null)}
        <span style={{ color: "#9ca3af" }}>›</span>
        {crumb(saleType ? `การขาย: ${saleType === "cash" ? "เงินสด" : saleType === "wholesale" ? "ขายส่ง" : "ผ่อนไฟแนนท์"}${financeCo ? ` (${financeCo.company_name})` : ""}` : "ประเภทการขาย", null)}
      </div>
      )}

      <h3 style={{ margin: "4px 0 14px", fontFamily: "Tahoma" }}>
        {usedMode ? (usedDone ? "ขายรถมือสองสำเร็จ (USED)" : usedSel ? "บันทึกขายรถมือสอง (USED)" : "เลือกคันรถมือสอง (USED)") : `ขั้นตอนที่ ${step}/7 — ${STEP_TITLES[step]}`}
      </h3>
      {message && <div style={{ color: "#ef4444", marginBottom: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>{message}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>กำลังโหลดข้อมูลรุ่นรถ...</div>
      ) : usedMode ? (
        /* ===== โหมดขายรถมือสอง (USED) ===== */
        usedRows === null ? (
          <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>กำลังโหลดสต๊อกรถมือสอง...</div>
        ) : usedDone ? (
          <div style={{ maxWidth: 560, border: "1.5px solid #86efac", background: "#f0fdf4", borderRadius: 12, padding: 24, fontFamily: "Tahoma" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#166534" }}>✅ บันทึกขายแล้ว</div>
            <div style={{ marginTop: 10, fontSize: 15 }}>เลขที่รับ <b>{usedDone.doc_no}</b> — {usedDone.vehicle}</div>
            <div style={{ fontSize: 15 }}>ผู้ซื้อ <b>{usedDone.customer}</b> ราคา <b>{usedDone.price.toLocaleString("th-TH")}</b> บาท</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>ยอดรับชำระเข้าสรุปรายวันรับเงินอัตโนมัติ</div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => { setUsedDone(null); enterUsedMode(); }}>ขายคันต่อไป</button>
              <button className="btn-secondary" onClick={resetAll}>กลับหน้าแรก</button>
            </div>
          </div>
        ) : !usedSel ? (
          usedRows.length === 0 ? (
            <div style={{ color: "#9ca3af", padding: 30 }}>ไม่มีรถมือสองในสต๊อก — รับเข้าได้ที่เมนู "รถมือสอง (รับซื้อ/ขาย)"</div>
          ) : (
            <div style={gridStyle(250)}>
              {usedRows.map(r => (
                <div key={r.id} style={CARD}
                  onClick={() => pickUsed(r)}
                  onMouseOver={e => e.currentTarget.style.borderColor = "#b45309"}
                  onMouseOut={e => e.currentTarget.style.borderColor = "#d1d5db"}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#b45309" }}>{[r.brand, r.model_series].filter(Boolean).join(" ") || "ไม่ระบุรุ่น"}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{[r.model_code, r.type_name, r.color_name].filter(Boolean).join(" · ") || "-"}</div>
                  <div style={{ fontSize: 12.5, marginTop: 6, fontFamily: "monospace" }}>{r.engine_no || "-"}</div>
                  {text(r.chassis_no) && <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>{r.chassis_no}</div>}
                  <div style={{ fontSize: 13, marginTop: 6 }}>ทะเบียน: <b>{r.license_plate || "-"}</b> {r.province || ""}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                    รับเข้า {String(r.receive_date || "").slice(0, 10)} · {r.doc_no}{num(r.img_count) > 0 ? ` · 📷 ${r.img_count}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ฟอร์มขายคันที่เลือก — การ์ดรถเต็มแถว (รูปซ้าย ข้อมูลขวา แบบขั้นเลือกประเภทการขายรถใหม่) → ข้อมูลลูกค้า → รับชำระเงิน */
          <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "Tahoma" }}>
            {/* ข้อมูลคัน + รูป */}
            <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 20, background: "#fff", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: 360, maxWidth: "100%", height: 260, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                {(usedImgs[usedSel.id] || [])[0]
                  ? <img src={usedImgs[usedSel.id][0]} alt="รถมือสอง" title="ดับเบิลคลิกเพื่อดูรูปขยาย" onDoubleClick={() => setImgZoom(usedImgs[usedSel.id][0])}
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "zoom-in" }} />
                  : <span style={{ color: "#c4c9d0", fontSize: 13 }}>{num(usedSel.img_count) > 0 ? "กำลังโหลดรูป..." : "ไม่มีรูป"}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 260, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#b45309" }}>
                  {[usedSel.brand, usedSel.model_series].filter(Boolean).join(" ")}
                  <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 400, marginLeft: 8 }}>USED · รถมือสอง</span>
                </div>
                <div style={{ fontSize: 15, marginTop: 10 }}>แบบ/type/สี: <b>{[usedSel.model_code, usedSel.type_name, usedSel.color_name].filter(Boolean).join(" · ") || "-"}</b></div>
                <div style={{ fontSize: 15, marginTop: 6 }}>หมายเลขเครื่อง: <b>{usedSel.engine_no || "-"}</b></div>
                <div style={{ fontSize: 15, marginTop: 6 }}>หมายเลขตัวถัง: <b>{usedSel.chassis_no || "-"}</b></div>
                <div style={{ fontSize: 15, marginTop: 6 }}>ทะเบียน: <b>{usedSel.license_plate || "-"}</b> {usedSel.province || ""}</div>
                <div style={{ fontSize: 15, marginTop: 6 }}>รับเข้า: <b>{String(usedSel.receive_date || "").slice(0, 10)}</b> · เลขที่รับ <b>{usedSel.doc_no}</b></div>
                <button onClick={() => { setUsedSel(null); setUsedSale(null); }}
                  style={{ marginTop: 12, padding: "7px 16px", border: "1px solid #d1d5db", borderRadius: 8, background: "#f3f4f6", cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
                  เปลี่ยนคัน
                </button>
              </div>
            </div>

            {/* ฟอร์มขาย */}
            {usedSale && (
            <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 18, background: "#fff" }}>
              <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap: 12 }}>
                <label style={{ fontSize: 13 }}>วันที่ขาย
                  <input type="date" value={usedSale.sold_date} onChange={e => setUsedSale(m => ({ ...m, sold_date: e.target.value }))}
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 13 }}>ราคาขาย (บาท) *
                  <input type="number" value={usedSale.price} onChange={e => setUsedSale(m => ({ ...m, price: e.target.value, rows: m.rows.length === 1 ? [{ ...m.rows[0], amount: e.target.value }] : m.rows }))}
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, marginTop: 4, textAlign: "right", fontWeight: 700 }} />
                </label>
              </div>

              {/* ข้อมูลลูกค้า — แบบเดียวกับขายรถใหม่: ต้องเลือกจากปุ่ม 🔍 เท่านั้น (พิมพ์เองไม่ได้ กันใบขายไม่มีรหัสลูกค้า)
                  จัดเป็นการ์ดแนวตั้ง label อยู่บนช่อง — พื้นที่ฟอร์มแคบ (อยู่ข้างการ์ดรูปรถ) แบบ 4 คอลัมน์จะบีบจนอ่านไม่ได้ */}
              {(() => {
                const box = { width: "100%", padding: "8px 10px", background: "#e9eef0", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, color: "#374151", minHeight: 19, boxSizing: "border-box" };
                const lbl = { fontWeight: 600, fontSize: 13, fontFamily: "Tahoma", marginBottom: 4, color: "#374151" };
                return (
                  <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#fff", marginTop: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>ข้อมูลลูกค้า</div>

                    <div style={lbl}>รหัสลูกค้า</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
                      <div style={{ ...box, width: 130, textAlign: "center" }}>{usedSale.customer_code || "—"}</div>
                      <button type="button" onClick={() => setShowUsedCustomer(true)}
                        style={{ padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontFamily: "Tahoma", whiteSpace: "nowrap" }}>
                        🔍 เลือก/เพิ่ม
                      </button>
                    </div>

                    <div style={lbl}>ชื่อลูกค้า <span style={{ color: "#ef4444" }}>*</span></div>
                    <div style={{ ...box, marginBottom: 10, textAlign: usedSale.customer ? "left" : "center", color: usedSale.customer ? "#111827" : "#9ca3af" }}>
                      {usedSale.customer || "กดปุ่ม 🔍 เลือก/เพิ่ม เพื่อเลือกลูกค้า"}
                    </div>

                    <div style={lbl}>ที่อยู่</div>
                    <div style={{ ...box, marginBottom: 10, textAlign: usedSale.address ? "left" : "center" }}>{usedSale.address || "—"}</div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={lbl}>เบอร์โทร</div>
                        <div style={{ ...box, textAlign: "center" }}>{usedSale.phone || "—"}</div>
                      </div>
                      <div>
                        <div style={lbl}>วันเกิด</div>
                        <div style={{ ...box, textAlign: "center" }}>{usedSale.birthdate ? thaiDate(usedSale.birthdate) : "—"}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ fontSize: 13, fontWeight: 700, margin: "14px 0 6px" }}>วิธีรับชำระ (เลือกได้หลายวิธี)</div>
              {usedSale.rows.map((r3, i3) => (
                <div key={i3} style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                  <select value={r3.method} onChange={e => setUsedPayRow(i3, { method: e.target.value, account: "" })}
                    style={{ padding: "7px 8px", border: "1px solid #d1d5db", borderRadius: 6 }}>
                    {USED_PAY_METHODS.map(m2 => <option key={m2} value={m2}>{m2}</option>)}
                  </select>
                  <input type="number" value={r3.amount} onChange={e => setUsedPayRow(i3, { amount: e.target.value })} placeholder="จำนวนเงิน"
                    style={{ width: 120, padding: "7px 8px", border: "1px solid #d1d5db", borderRadius: 6, textAlign: "right" }} />
                  {r3.method === "เงินโอน" && (
                    <select value={r3.account} onChange={e => setUsedPayRow(i3, { account: e.target.value })}
                      style={{ flex: 1, minWidth: 180, padding: "7px 8px", border: "1px solid #d1d5db", borderRadius: 6 }}>
                      <option value="">— เลือกบัญชีรับโอน —</option>
                      {bankAccounts.filter(a => a.account_type !== "เงินสดย่อย" && a.account_type !== "ลูกหนี้").map(a => (
                        <option key={a.account_id || usedBankLabel(a)} value={usedBankLabel(a)}>{usedBankLabel(a)}</option>
                      ))}
                    </select>
                  )}
                  {usedSale.rows.length > 1 && (
                    <button onClick={() => setUsedSale(m => ({ ...m, rows: m.rows.filter((_, j) => j !== i3) }))}
                      style={{ border: "1px solid #fca5a5", color: "#b91c1c", background: "#fff", borderRadius: 6, cursor: "pointer", padding: "0 10px" }}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => setUsedSale(m => ({ ...m, rows: [...m.rows, { method: "เงินโอน", amount: Math.max(0, Math.round((num(m.price) - usedPayTotal(m)) * 100) / 100) || "", account: "" }] }))}
                style={{ fontSize: 13, border: "1px dashed #94a3b8", background: "#f8fafc", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>
                + เพิ่มวิธีรับชำระ
              </button>
              <div style={{ fontSize: 13, marginTop: 8, color: Math.abs(usedPayTotal(usedSale) - num(usedSale.price)) < 0.01 ? "#166534" : "#b45309" }}>
                รวมรับชำระ {usedPayTotal(usedSale).toLocaleString("th-TH")} / ราคาขาย {num(usedSale.price).toLocaleString("th-TH")} บาท
              </div>

              <label style={{ fontSize: 13, display: "block", marginTop: 10 }}>หมายเหตุ
                <input value={usedSale.note} onChange={e => setUsedSale(m => ({ ...m, note: e.target.value }))}
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, marginTop: 4 }} />
              </label>

              <button onClick={saveUsedSale} disabled={usedSale.saving}
                style={{ marginTop: 16, width: "100%", padding: "12px", fontSize: 15, fontWeight: 700, color: "#fff", background: usedSale.saving ? "#93c5fd" : "#072d6b", border: "none", borderRadius: 8, cursor: "pointer" }}>
                {usedSale.saving ? "กำลังบันทึก..." : "💾 บันทึกขายรถมือสอง"}
              </button>
            </div>
            )}
          </div>
        )
      ) : (
        <>
          {/* ขั้น 1: ประเภทรถ */}
          {step === 1 && (
            <div style={gridStyle(180)}>
              {vehicleTypes.map(vt => (
                <div key={vt.vehicle_type_id} style={{ ...CARD, padding: "38px 16px" }}
                  onClick={() => setSelType(vt)}
                  onMouseOver={e => e.currentTarget.style.borderColor = "#072d6b"}
                  onMouseOut={e => e.currentTarget.style.borderColor = "#d1d5db"}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#072d6b" }}>{vt.vehicle_type_name}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
                    {series.filter(s => String(s.vehicle_type_id || "") === String(vt.vehicle_type_id)).length} รุ่น
                  </div>
                </div>
              ))}
              {/* การ์ดรถมือสอง — ขายจากสต๊อกมือสอง (used_moto_stock) ไม่ผ่าน master รุ่นรถใหม่ */}
              <div style={{ ...CARD, padding: "38px 16px", borderColor: "#fcd34d", background: "#fffbeb" }}
                onClick={enterUsedMode}
                onMouseOver={e => e.currentTarget.style.borderColor = "#b45309"}
                onMouseOut={e => e.currentTarget.style.borderColor = "#fcd34d"}>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#b45309" }}>USED</div>
                <div style={{ fontSize: 13, color: "#92400e", marginTop: 6 }}>รถมือสอง</div>
              </div>
            </div>
          )}

          {/* ขั้น 2: ยี่ห้อ */}
          {step === 2 && (
            <div style={gridStyle(200)}>
              {brands.filter(b => series.some(s => String(s.brand_id) === String(b.brand_id) && String(s.vehicle_type_id || "") === String(selType.vehicle_type_id))).map(b => (
                <div key={b.brand_id} style={{ ...CARD, padding: "38px 16px" }}
                  onClick={() => setSelBrand(b)}
                  onMouseOver={e => e.currentTarget.style.borderColor = "#072d6b"}
                  onMouseOut={e => e.currentTarget.style.borderColor = "#d1d5db"}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#072d6b" }}>{b.brand_name}</div>
                </div>
              ))}
            </div>
          )}

          {/* ขั้น 3: รุ่น */}
          {step === 3 && (
            seriesOptions.length === 0 ? (
              <div style={{ color: "#9ca3af", padding: 30 }}>ไม่มีรุ่นในประเภทนี้</div>
            ) : (
              <div style={gridStyle(200)}>
                {seriesOptions.map(s => (
                  <div key={s.series_id} style={CARD}
                    onClick={() => setSelSeries(s)}
                    onMouseOver={e => e.currentTarget.style.borderColor = "#072d6b"}
                    onMouseOut={e => e.currentTarget.style.borderColor = "#d1d5db"}>
                    <div style={{ fontSize: 19, fontWeight: 700, color: "#072d6b" }}>{s.marketing_name || s.series_name}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{s.thai_name || ""}{s.engine_cc ? ` · ${s.engine_cc} ซีซี` : ""}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{s.series_name}</div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ขั้น 4: สีทุกสีของรุ่น */}
          {step === 4 && (
            colorGroups.length === 0 ? (
              <div style={{ color: "#9ca3af", padding: 30 }}>รุ่นนี้ยังไม่มีข้อมูลสีใน master</div>
            ) : (
              <div style={gridStyle(220)}>
                {colorGroups.map(g => {
                  const img = groupImage(g);
                  const count = stockLoading ? null : unitsOfGroup(g).length;
                  return (
                    <div key={g.key} style={{ ...CARD, padding: 12 }}
                      onClick={() => { setSelColor(g); setSelUnit(null); }}
                      onMouseOver={e => e.currentTarget.style.borderColor = "#072d6b"}
                      onMouseOut={e => e.currentTarget.style.borderColor = "#d1d5db"}>
                      <div style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", borderRadius: 8, marginBottom: 10, overflow: "hidden" }}>
                        {img && img !== "none"
                          ? <img src={img} alt={g.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                          : <span style={{ color: "#c4c9d0", fontSize: 13 }}>{img === null ? "กำลังโหลดรูป..." : "ไม่มีรูป"}</span>}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>รหัสสี: {g.codes.filter(Boolean).join(", ") || "-"}</div>
                      {/* รหัสแบบ: HONDA = model_code (เช่น AFS110KDFP), YAMAHA = รหัส type (เช่น BJKD00) */}
                      <div style={{ fontSize: 12, color: "#0369a1", marginTop: 2, fontFamily: "monospace" }}>
                        รหัสแบบ: {[...new Set(g.rows.map(r => brandParam(selBrand) === "HONDA" ? text(r.model_code) : text(r.type_name)).filter(Boolean))].join(", ") || "-"}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span style={{ padding: "3px 12px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                          background: count === null ? "#f3f4f6" : count > 0 ? "#d1fae5" : "#fee2e2",
                          color: count === null ? "#9ca3af" : count > 0 ? "#065f46" : "#991b1b" }}>
                          {count === null ? "นับสต๊อก..." : count > 0 ? `มีในสต๊อก ${count} คัน` : "ไม่มีในสต๊อก"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ขั้น 5: เลือกคัน (เลขเครื่อง/เลขถัง) */}
          {step === 5 && (() => {
            const units = unitsOfGroup(selColor);
            const img = groupImage(selColor);
            return (
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                {/* รูป + รุ่น/สี */}
                <div style={{ width: 300, minWidth: 260, border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma" }}>
                  <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
                    {img && img !== "none"
                      ? <img src={img} alt={selColor.name} title="ดับเบิลคลิกเพื่อดูรูปขยาย"
                          onDoubleClick={() => setImgZoom(img)}
                          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "zoom-in" }} />
                      : <span style={{ color: "#c4c9d0", fontSize: 13 }}>{img === null ? "กำลังโหลดรูป..." : "ไม่มีรูป"}</span>}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#072d6b" }}>{selSeries.marketing_name || selSeries.series_name}</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>สี: <strong>{selColor.name}</strong> ({selColor.codes.filter(Boolean).join(", ")})</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{selBrand.brand_name} · {selType.vehicle_type_name}</div>
                </div>

                {/* ตารางคันในสต๊อก */}
                <div style={{ flex: 1, minWidth: 340 }}>
                  {stockLoading ? (
                    <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลดสต๊อก...</div>
                  ) : units.length === 0 ? (
                    <div style={{ color: "#991b1b", background: "#fef2f2", padding: 20, borderRadius: 10 }}>
                      ไม่มีรถสี "{selColor.name}" ของรุ่นนี้ในสต๊อก
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>#</th>
                            <th>หมายเลขเครื่อง</th>
                            <th>หมายเลขตัวถัง</th>
                            <th>รุ่น/แบบ</th>
                            <th>วันที่รับเข้า</th>
                            <th>อายุสต๊อก (วัน)</th>
                            <th style={{ width: 100 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* คลิกที่แถว (เลขเครื่อง/เลขถัง) เลือกคันได้เลย — ไม่ต้องเลื่อนไปกดปุ่มขวาสุด */}
                          {units.map((u, i) => (
                            <tr key={u.engine_no} onClick={() => pickUnit(u)} title="คลิกเพื่อเลือกคันนี้"
                              style={{ cursor: "pointer" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "#eff6ff"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}>
                              <td>{i + 1}</td>
                              <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{u.engine_no}</td>
                              <td style={{ color: "#1d4ed8" }}>{u.chassis_no || "-"}</td>
                              <td>{u.model}{u.model_type ? ` / ${u.model_type}` : ""}</td>
                              <td>{text(u.received_date).slice(0, 10)}</td>
                              <td style={{ textAlign: "center" }}>{u.age_days}</td>
                              <td>
                                <button onClick={() => pickUnit(u)}
                                  style={{ padding: "4px 14px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
                                  เลือกคันนี้
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ขั้น 6: ข้อมูลรถ (ข้อมูลอยู่ข้างรูป) + การ์ดประเภทการขาย/ราคาขาย */}
          {step === 6 && (() => {
            const img = groupImage(selColor);
            const price = saleType ? announcedPrice(saleType) : null;
            const info = (label, value) => (
              <div style={{ fontSize: 14, marginBottom: 6 }}>
                <span style={{ color: "#6b7280" }}>{label}: </span><strong>{value}</strong>
              </div>
            );
            return (
              <div style={{ maxWidth: 860 }}>
                {/* การ์ดข้อมูลรถ: รูปซ้าย + ข้อมูลคันที่เลือกข้างรูป */}
                <div style={{ display: "flex", gap: 20, border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma", flexWrap: "wrap" }}>
                  <div style={{ width: 260, minWidth: 220, height: 190, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", borderRadius: 8, overflow: "hidden" }}>
                    {img && img !== "none"
                      ? <img src={img} alt={selColor.name} title="ดับเบิลคลิกเพื่อดูรูปขยาย"
                          onDoubleClick={() => setImgZoom(img)}
                          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "zoom-in" }} />
                      : <span style={{ color: "#c4c9d0", fontSize: 13 }}>{img === null ? "กำลังโหลดรูป..." : "ไม่มีรูป"}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>
                      {selSeries.marketing_name || selSeries.series_name}
                      <span style={{ fontSize: 14, fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>{selBrand.brand_name} · {selType.vehicle_type_name}</span>
                    </div>
                    {info("สี", `${selColor.name} (${selColor.codes.filter(Boolean).join(", ")})`)}
                    {info("หมายเลขเครื่อง", selUnit.engine_no)}
                    {info("หมายเลขตัวถัง", selUnit.chassis_no || "-")}
                    {info("รุ่น/แบบ", `${selUnit.model}${selUnit.model_type ? " / " + selUnit.model_type : ""}`)}
                    {info("รับเข้า", `${text(selUnit.received_date).slice(0, 10)} (อายุสต๊อก ${selUnit.age_days} วัน)`)}
                    <button onClick={() => { setSelUnit(null); setSaleType(null); setFinanceCo(null); }}
                      style={{ marginTop: 6, padding: "5px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
                      เปลี่ยนคัน
                    </button>
                  </div>
                </div>

                {/* การ์ดประเภทการขาย: ปุ่มซ้าย · ราคาขายขวา */}
                <div style={{ display: "flex", gap: 20, border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma", marginTop: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>ประเภทการขาย</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <button onClick={() => { setSaleType("cash"); setFinanceCo(null); }}
                        style={{ padding: "16px 0", fontSize: 17, fontWeight: 700, fontFamily: "Tahoma", borderRadius: 10, cursor: "pointer",
                          background: saleType === "cash" ? "#072d6b" : "#fff", color: saleType === "cash" ? "#fff" : "#072d6b",
                          border: saleType === "cash" ? "2px solid #072d6b" : "2px solid #d1d5db" }}>
                        💵 เงินสด {saleType === "cash" ? "✓" : ""}
                      </button>
                      <button onClick={() => { setSaleType("finance"); setFinanceCo(null); }}
                        style={{ padding: "16px 0", fontSize: 17, fontWeight: 700, fontFamily: "Tahoma", borderRadius: 10, cursor: "pointer",
                          background: saleType === "finance" ? "#072d6b" : "#fff", color: saleType === "finance" ? "#fff" : "#072d6b",
                          border: saleType === "finance" ? "2px solid #072d6b" : "2px solid #d1d5db" }}>
                        🏦 ผ่อนไฟแนนท์ {saleType === "finance" ? "✓" : ""}
                      </button>
                      <button onClick={() => { setSaleType("wholesale"); setFinanceCo(null); setAdjOpen(false); }}
                        style={{ padding: "16px 0", fontSize: 17, fontWeight: 700, fontFamily: "Tahoma", borderRadius: 10, cursor: "pointer",
                          background: isWholesale ? "#072d6b" : "#fff", color: isWholesale ? "#fff" : "#072d6b",
                          border: isWholesale ? "2px solid #072d6b" : "2px solid #d1d5db" }}>
                        📦 ขายส่ง {isWholesale ? "✓" : ""}
                      </button>
                      {saleType === "finance" && financeCo && (
                        <div style={{ padding: 10, background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe", fontSize: 14 }}>
                          ไฟแนนท์: <strong>{financeCo.company_name}</strong>
                          <button onClick={() => setFinanceCo(null)}
                            style={{ marginLeft: 10, padding: "2px 10px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "Tahoma" }}>
                            เปลี่ยน
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 240, borderLeft: "1px solid #f3f4f6", paddingLeft: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>ราคาขาย <span style={{ fontWeight: 400, fontSize: 12, color: "#9ca3af" }}>(ราคาประกาศ {branchGroup})</span></div>
                    {!saleType ? (
                      <div style={{ color: "#9ca3af", fontSize: 14, padding: "20px 0" }}>← เลือกประเภทการขายก่อน</div>
                    ) : isWholesale ? (
                      <div style={{ padding: "14px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10 }}>
                        <div style={{ fontSize: 13, color: "#92400e" }}>ราคาขายส่ง (พิมพ์เอง — ไม่มีของแถม ไม่บวกเพิ่ม)</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                          <input type="number" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} placeholder="0" disabled={!!savedSale}
                            style={{ width: 180, padding: "10px 12px", border: "1.5px solid #f59e0b", borderRadius: 8, fontFamily: "Tahoma", fontSize: 22, fontWeight: 700, textAlign: "right", color: "#92400e", boxSizing: "border-box" }} />
                          <span style={{ fontSize: 16, color: "#92400e", fontWeight: 700 }}>บาท</span>
                        </div>
                        {!(num(wholesalePrice) > 0) && <div style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>กรอกราคาขายส่งก่อนบันทึก</div>}
                      </div>
                    ) : (
                      <div style={{ padding: "14px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10 }}>
                        <div style={{ fontSize: 13, color: "#166534" }}>{saleType === "cash" ? "ราคาขายเงินสด" : "ราคาขายผ่อนไฟแนนท์"}</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: "#166534", marginTop: 4 }}>
                          {fmtBaht(price == null ? null : price + markupsTotal + adjustmentsTotal)}
                        </div>
                        {price != null && (markupsTotal > 0 || adjustmentsTotal > 0) && (
                          <div style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>
                            ราคาประกาศ {fmtBaht(price)}
                            {markupsTotal > 0 ? ` + บวกเพิ่ม ${Number(markupsTotal).toLocaleString("th-TH")}` : ""}
                            {adjustmentsTotal > 0 ? ` + ปรับแต่ง ${Number(adjustmentsTotal).toLocaleString("th-TH")}` : ""}
                          </div>
                        )}
                        {applicableMarkups.length > 0 && (
                          <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4, textAlign: "left" }}>
                            {applicableMarkups.map((m, i) => {
                              const label = m.markup_type === "finance" ? `ตามไฟแนนท์: ${m.finance_company || "-"}`
                                : m.markup_type === "finance_cc" ? `ตามไฟแนนท์+CC: ${m.finance_company || "-"} (${m.cc_min || "0"}-${m.cc_max || "∞"} cc)`
                                : m.markup_type === "custom" ? `กำหนดเอง: ${m.brand || ""} ${m.model_code || ""}` : m.markup_type;
                              return <div key={i}>• {label}: <strong>+{Number(m.markup_amount).toLocaleString("th-TH")}</strong></div>;
                            })}
                          </div>
                        )}
                        {usingBookingPrice && (
                          <div style={{ marginTop: 6 }}>
                            <span title="ลูกค้าจองไว้ก่อนปรับราคา — ใช้ราคาประกาศที่มีผล ณ วันจอง (ไม่ใช่ราคาปัจจุบัน)"
                              style={{ padding: "2px 10px", borderRadius: 10, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 700, cursor: "help" }}>
                              🔖 ราคา ณ วันจอง {thaiDate(bookingDateISO)}
                            </span>
                          </div>
                        )}
                        {price == null && <div style={{ fontSize: 12, color: "#991b1b", marginTop: 4 }}>ไม่พบราคาประกาศของแบบ/type นี้ในเมนูราคารถ</div>}
                      </div>
                    )}

                    {/* option: ราคาขายบวกเพิ่ม (default ปิด) — ขายส่งไม่มี */}
                    {!isWholesale && <button onClick={() => { if (adjOpen) resetAdjustments(); else setAdjOpen(true); }}
                      style={{ marginTop: 12, padding: "8px 16px", fontSize: 14, fontWeight: 600, fontFamily: "Tahoma", borderRadius: 8, cursor: "pointer",
                        background: adjOpen ? "#7c3aed" : "#fff", color: adjOpen ? "#fff" : "#7c3aed",
                        border: "1.5px solid #7c3aed" }}>
                      ⚙️ ราคาขายบวกเพิ่ม {adjOpen ? "✓" : ""}
                    </button>}
                    {adjOpen && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                        <AdjRow label="ค่านำพา" checked={useDeliveryFee} onCheck={setUseDeliveryFee}
                          value={deliveryFee} onChange={setDeliveryFee}
                          extra={deliveryBonus > 0 ? `(+โบนัส ${Number(deliveryBonus).toLocaleString("th-TH")})` : ""} />
                        <AdjRow label="เงินดาวน์/ค่างวดออกแทน" checked={useDownPayout} onCheck={setUseDownPayout}
                          value={downPayout} onChange={setDownPayout}
                          extra={downPayoutCalc > 0 ? (isSGF ? `(SGF ปัดราคารวมขึ้นหลักพัน = +${Number(downPayoutCalc).toLocaleString("th-TH")})` : `(× 1.07 = ${Number(downPayoutCalc).toLocaleString("th-TH")})`) : ""} />
                        {adjustmentsTotal > 0 && (
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>รวมบวกเพิ่ม: +{Number(adjustmentsTotal).toLocaleString("th-TH")} บาท</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* การ์ดถาม รถจอง/ไม่จอง — ขึ้นหลังเลือกประเภทการขาย และเฉพาะรุ่น/สีที่มีคิวจองเท่านั้น (ไม่มีคิว = ข้ามอัตโนมัติ) */}
                {saleType && readyBookings.length > 0 && (
                <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma", marginTop: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>รถคันนี้เป็นรถจองหรือไม่?</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={() => answerBooking("booked")}
                      style={{ flex: 1, minWidth: 180, padding: "14px 0", fontSize: 16, fontWeight: 700, fontFamily: "Tahoma", borderRadius: 10, cursor: "pointer",
                        background: bookingAsk === "booked" ? "#072d6b" : "#fff", color: bookingAsk === "booked" ? "#fff" : "#072d6b",
                        border: bookingAsk === "booked" ? "2px solid #072d6b" : "2px solid #d1d5db" }}>
                      🔖 รถจอง {bookingAsk === "booked" ? "✓" : ""}
                    </button>
                    <button onClick={() => answerBooking("walkin")}
                      style={{ flex: 1, minWidth: 180, padding: "14px 0", fontSize: 16, fontWeight: 700, fontFamily: "Tahoma", borderRadius: 10, cursor: "pointer",
                        background: bookingAsk === "walkin" ? "#072d6b" : "#fff", color: bookingAsk === "walkin" ? "#fff" : "#072d6b",
                        border: bookingAsk === "walkin" ? "2px solid #072d6b" : "2px solid #d1d5db" }}>
                      🛒 ไม่จอง (ขายหน้าร้าน) {bookingAsk === "walkin" ? "✓" : ""}
                    </button>
                  </div>

                  {/* เลือกลูกค้าจองแล้ว → ซ่อนตาราง เหลือสรุป + ปุ่มเปลี่ยน */}
                  {bookingAsk === "booked" && selBooking && (
                    <div style={{ marginTop: 12, padding: 12, background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 14 }}>
                        ✓ ลูกค้าจอง: <strong>{selBooking.customer_name || "-"}</strong>
                        <span style={{ marginLeft: 10, padding: "2px 10px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 700 }}>
                          🔔 คิวที่ {selBooking.queuePos}/{selBooking.stockQty}
                        </span>
                        <span style={{ marginLeft: 10, color: "#6b7280", fontSize: 13 }}>
                          มัดจำคงเหลือ {selBooking.remaining > 0 ? Number(selBooking.remaining).toLocaleString("th-TH") + " บาท" : "-"}
                        </span>
                      </div>
                      <button onClick={() => setSelBooking(null)}
                        style={{ marginLeft: "auto", padding: "4px 14px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
                        เปลี่ยนคน
                      </button>
                    </div>
                  )}

                  {/* ลิสต์ลูกค้าจองรุ่นนี้ เฉพาะที่ถึงคิวแล้ว (ซ่อนเมื่อเลือกแล้ว) */}
                  {bookingAsk === "booked" && !selBooking && (
                    bookingLoading || !bookingData ? (
                      <div style={{ textAlign: "center", padding: 24, color: "#6b7280" }}>กำลังโหลดข้อมูลใบจอง...</div>
                    ) : readyBookings.length === 0 ? (
                      <div style={{ marginTop: 12, color: "#991b1b", background: "#fef2f2", padding: 14, borderRadius: 8, fontSize: 14 }}>
                        ไม่มีลูกค้าจองรุ่น {selSeries.marketing_name || selSeries.series_name} สี {selColor.name} ที่ถึงคิวแล้ว
                      </div>
                    ) : (
                      <div style={{ marginTop: 12, overflowX: "auto" }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ width: 36 }}>#</th>
                              <th>ลูกค้าที่จอง</th>
                              <th>สีที่จอง</th>
                              <th>วันที่จอง</th>
                              <th>คิว</th>
                              <th>มัดจำคงเหลือ</th>
                              <th style={{ width: 90 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {readyBookings.map((b, i) => {
                              const picked = selBooking && selBooking.booking_id === b.booking_id;
                              const bColor = b.new_color_name || b.color_name || "-";
                              return (
                                <tr key={b.booking_id || i} style={picked ? { background: "#eff6ff" } : undefined}>
                                  <td>{i + 1}</td>
                                  <td style={{ fontWeight: 600 }}>{b.customer_name || "-"}</td>
                                  <td>{bColor}</td>
                                  <td>{thaiDate(b.booking_date)}</td>
                                  <td style={{ textAlign: "center" }}>
                                    <span style={{ padding: "2px 10px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 700 }}>
                                      🔔 คิวที่ {b.queuePos}/{b.stockQty}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: "right" }}>{b.remaining > 0 ? Number(b.remaining).toLocaleString("th-TH") : "-"}</td>
                                  <td>
                                    <button onClick={() => pickBookingCustomer(b)}
                                      style={{ padding: "4px 14px", background: picked ? "#1d4ed8" : "#072d6b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
                                      {picked ? "✓ เลือกแล้ว" : "เลือก"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </div>
                )}

                {/* การ์ดมัดจำป้ายแดง — ก่อนข้อมูลลูกค้า: กรอกทะเบียนป้ายแดง → มัดจำ 200 อัตโนมัติ (ไม่กรอก = 0) บวกเข้ายอดรับชำระ — ขายส่งไม่มี */}
                {saleType && !isWholesale && (bookingAsk === "walkin" || (bookingAsk === "booked" && selBooking)) && (
                  <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma", marginTop: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>🔴 มัดจำป้ายแดง</div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>ทะเบียนป้ายแดง</span>
                        <input value={redPlateNo} disabled={!!savedSale} onChange={e => setRedPlateNo(e.target.value)} placeholder="เช่น ก-1234"
                          style={{ width: 150, padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>จำนวนเงินมัดจำ</span>
                        <div style={{ minWidth: 110, padding: "8px 12px", background: redPlateDep ? "#fef2f2" : "#e9eef0", border: redPlateDep ? "1.5px solid #fecaca" : "1.5px solid transparent", borderRadius: 8, fontSize: 15, fontWeight: 700, color: redPlateDep ? "#b91c1c" : "#6b7280", textAlign: "right", boxSizing: "border-box" }}>
                          {redPlateDep.toLocaleString("th-TH")} บาท
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>ไม่ใช้ป้ายแดง = เว้นว่าง (มัดจำ 0) · กรอกทะเบียนแล้วระบบคิดมัดจำ {RED_PLATE_DEPOSIT} บาทอัตโนมัติ</span>
                    </div>
                  </div>
                )}

                {/* การ์ดข้อมูลลูกค้า (แบบเดียวกับบันทึกขายปลีก) — ขึ้นหลังเลือกประเภทการขาย + ตอบ จอง/ไม่จอง แล้ว */}
                {saleType && (bookingAsk === "walkin" || (bookingAsk === "booked" && selBooking)) && (() => {
                  const inp = { width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" };
                  const box = { width: "100%", padding: "8px 10px", background: "#e9eef0", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, color: "#374151", minHeight: 19, textAlign: "center", boxSizing: "border-box" };
                  const lbl = { fontWeight: 600, fontSize: 14, fontFamily: "Tahoma", whiteSpace: "nowrap", textAlign: isNarrow ? "left" : "right", ...(isNarrow ? { marginTop: 8 } : {}) };
                  return (
                    <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma", marginTop: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>ข้อมูลลูกค้า</div>
                      <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "auto 1fr auto 1fr", gap: isNarrow ? "4px 10px" : "12px 10px", alignItems: "center" }}>
                        {/* พิมพ์ชื่อเองไม่ได้แล้ว — ต้องเลือกจากปุ่ม 🔍 เท่านั้น (กันใบขายไม่มีรหัสลูกค้า/LINE ID ทำให้ส่งเอกสารทาง LINE ไม่ได้) */}
                        <div style={lbl}>รหัสลูกค้า</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <div style={{ ...box, width: 120, textAlign: "center" }}>{cust.customer_code || "—"}</div>
                          <button type="button" onClick={() => setShowCustomer(true)}
                            style={{ padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontFamily: "Tahoma", whiteSpace: "nowrap" }}>
                            🔍 เลือก/เพิ่ม
                          </button>
                        </div>
                        <div style={lbl}>ชื่อลูกค้า <span style={{ color: "#ef4444" }}>*</span></div>
                        <div style={{ ...box, textAlign: cust.customer_name ? "left" : "center" }}>
                          {cust.customer_name || "กดปุ่ม 🔍 เลือก/เพิ่ม เพื่อเลือกลูกค้า"}
                        </div>

                        <div style={lbl}>ที่อยู่</div>
                        <div style={{ ...box, gridColumn: isNarrow ? "auto" : "2 / span 3", textAlign: cust.customer_address ? "left" : "center" }}>{cust.customer_address || "—"}</div>

                        <div style={lbl}>เบอร์โทร</div>
                        <div style={box}>{cust.customer_phone || "—"}</div>
                        <div style={lbl}>วันเกิด</div>
                        <div style={box}>{cust.customer_birthdate ? thaiDate(cust.customer_birthdate) : "—"}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* การ์ดของแถม-บริการ (จากบันทึกค่าใช้จ่ายการขาย ประเภทโปรโมชั่น) */}
                {(bookingAsk === "walkin" || (bookingAsk === "booked" && selBooking)) && (displayGiveaways.length > 0 || (adjOpen && useDownPayout && Number(downPayout) > 0)) && (
                  <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma", marginTop: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>🎁 ของแถม-บริการ</div>
                      <button type="button" onClick={reloadGiveaways} disabled={reloadingGiveaways}
                        style={{ marginLeft: "auto", padding: "4px 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "Tahoma" }}>
                        {reloadingGiveaways ? "..." : "🔄 รีเฟรช"}
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                      เลือกของแถมที่ลูกค้าได้รับ — รายการมาจาก "บันทึกค่าใช้จ่ายการขาย" (ประเภท: โปรโมชั่น)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
                      {displayGiveaways.map((g) => {
                        const checked = g.__merged ? g.ids.every((id) => selectedGiveaways[id]) : !!selectedGiveaways[g.expense_id];
                        const toggle = (on) => setSelectedGiveaways((s) => {
                          if (g.__merged) { const ns = { ...s }; g.ids.forEach((id) => { ns[id] = on; }); return ns; }
                          return { ...s, [g.expense_id]: on };
                        });
                        return (
                          <label key={g.__merged ? g.key : g.expense_id}
                            style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                            <input type="checkbox" checked={checked} disabled={!!savedSale} onChange={(e) => toggle(e.target.checked)} />
                            <div style={{ flex: 1, textAlign: "left" }}>
                              <div style={{ fontWeight: 700 }}>{g.expense_name}</div>
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                {g.category && <span style={{ background: "#dbeafe", color: "#1e40af", padding: "1px 6px", borderRadius: 3, marginRight: 4 }}>{g.category}</span>}
                                {g.__merged ? `· รวม ${g.count} รายการ` : (g.group_by === "cc" && g.engine_cc ? `⚙ ${g.engine_cc} cc` : "")}
                              </div>
                            </div>
                            <span style={{ fontWeight: 800, color: "#dc2626" }}>{Number(g.amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                          </label>
                        );
                      })}
                      {/* เงินดาวน์/ค่างวดออกแทน — มาจากช่อง "ราคาขายบวกเพิ่ม" (ยอดฐานก่อนคูณ 1.07) นับเป็นของแถมด้วย */}
                      {adjOpen && useDownPayout && Number(downPayout) > 0 && (
                        <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", background: "#fefce8", border: "1px solid #fbbf24", borderRadius: 6, cursor: "default", fontSize: 13 }}>
                          <input type="checkbox" checked readOnly disabled />
                          <div style={{ flex: 1, textAlign: "left" }}>
                            <div style={{ fontWeight: 700 }}>เงินดาวน์/ค่างวดออกแทน</div>
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                              <span style={{ background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 3, marginRight: 4 }}>จากราคาขายบวกเพิ่ม</span>
                              ติ๊ก/แก้ยอดได้ที่การ์ดปรับแต่งราคา
                            </div>
                          </div>
                          <span style={{ fontWeight: 800, color: "#dc2626" }}>{Number(downPayout || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                        </label>
                      )}
                    </div>
                    <div style={{ textAlign: "right", marginTop: 10, fontSize: 14 }}>
                      รวมของแถมที่ให้: <span style={{ fontWeight: 800, color: "#dc2626" }}>{Number(giveawaysTotal + (adjOpen && useDownPayout ? Number(downPayout || 0) : 0)).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</span>
                    </div>
                  </div>
                )}

                {/* การ์ดของแถม-สินค้า (จาก Master Data → บันทึกของแถม) */}
                {!isWholesale && (bookingAsk === "walkin" || (bookingAsk === "booked" && selBooking)) && productGiveaways.length > 0 && (
                  <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma", marginTop: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>🎁 ของแถม-สินค้า</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                      รายการมาจาก "Master Data → บันทึกของแถม" (รวมทั้งระดับยี่ห้อ/รุ่น/แบบ ที่ตรงกับรถคันนี้)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
                      {productGiveaways.map((g) => {
                        const checked = !!selectedProductGiveaways[g.id];
                        return (
                          <label key={g.id}
                            style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                            <input type="checkbox" checked={checked} disabled={!!savedSale}
                              onChange={(e) => setSelectedProductGiveaways((s) => ({ ...s, [g.id]: e.target.checked }))} />
                            <div style={{ flex: 1, textAlign: "left" }}>
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
                  </div>
                )}

                {/* การ์ดรับชำระเงิน + ปุ่มบันทึก */}
                {(bookingAsk === "walkin" || (bookingAsk === "booked" && selBooking)) && (() => {
                  const isFin = saleType === "finance";
                  const base = announcedPrice(saleType);
                  const carPrice = base == null ? null : base + (isWholesale ? 0 : markupsTotal + adjustmentsTotal);
                  const netCar = carPrice == null ? null : Math.max(carPrice - downSubDiscount, 0);
                  const fc = financeCalc(netCar || 0);
                  const dep = depositAmt;
                  // ติดลบ = มัดจำมากกว่ายอดที่ต้องจ่าย → ต้องคืนเงินมัดจำลูกค้า
                  const receive = carPrice == null ? null : (isFin ? fc.down + fc.advance + custPaidTheft - advSub : netCar) - dep + redPlateDep;
                  const isRefund = receive != null && receive < 0;
                  const row = (label, val, opts = {}) => (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: opts.big ? 18 : 14, fontWeight: opts.big ? 700 : 400, color: opts.color || "#111827", borderTop: opts.line ? "1px dashed #d1d5db" : "none" }}>
                      <span>{label}</span><span>{val}</span>
                    </div>
                  );
                  const finInp = (value, onChange, opts = {}) => (
                    <input type="number" value={value} disabled={!!savedSale}
                      onChange={e => onChange(e.target.value)} placeholder="0"
                      style={{ width: "100%", minWidth: 72, padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, textAlign: "right", boxSizing: "border-box", ...(opts.style || {}) }} />
                  );
                  const finLbl = { fontWeight: 600, fontSize: 14, fontFamily: "Tahoma", whiteSpace: "nowrap", textAlign: "left", marginTop: 8 };
                  return (
                    <>
                    <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma", marginTop: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>สรุปยอดขาย {isFin && <span style={{ fontWeight: 400, fontSize: 13, color: "#6b7280" }}>(ผ่อนไฟแนนท์: {financeCo?.company_name || "-"})</span>}</div>

                      {isFin && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "4px 10px", alignItems: "center", marginBottom: 14, maxWidth: 420 }}>
                          <div style={finLbl}>เงินดาวน์</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{finInp(finDown, setFinDown)}<span>บาท</span></div>
                          <div style={finLbl}>ยอดจัดไฟแนนซ์</div>
                          <div style={{ padding: "8px 10px", background: "#e9eef0", borderRadius: 8, fontSize: 14, textAlign: "right", fontWeight: 700, color: "#1d4ed8" }}>{Number(fc.financeAmount).toLocaleString("th-TH")}</div>

                          <div style={{ ...finLbl, lineHeight: 1.3 }}>ประกันรถหาย<br /><span style={{ fontWeight: 400, fontSize: 11, color: "#b45309" }}>(ไฟแนนซ์หัก)</span></div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{finInp(finTheft, setFinTheft)}<span>บาท</span></div>
                            <div style={{ fontSize: 11, color: "#b45309", marginTop: 2 }}>เบี้ยที่ลูกค้าจ่าย — นับเป็นยอดชำระค่ารถ</div>
                          </div>
                          <div style={finLbl}>อัตราดอกเบี้ย</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{finInp(finRate, setFinRate)}<span style={{ whiteSpace: "nowrap" }}>% (ต่อเดือน)</span></div>

                          <div style={finLbl}>จำนวนงวด <span style={{ color: "#ef4444" }}>*</span></div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{finInp(finN, setFinN)}<span>งวด</span></div>
                          <div style={finLbl}>ยอดผ่อน/งวด</div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {finInp(finInstTouched ? finInstOverride : (fc.instRounded || ""), (v) => { setFinInstTouched(true); setFinInstOverride(v); })}
                              <span>บาท</span>
                            </div>
                            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#374151", marginTop: 3, cursor: "pointer" }}>
                              <input type="checkbox" checked={finRound5} onChange={e => { setFinRound5(e.target.checked); setFinInstTouched(false); setFinInstOverride(""); }} />
                              ปัดเศษ 0/5
                            </label>
                          </div>

                          <div style={finLbl}>ค่างวดจ่ายล่วงหน้า</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{finInp(finAdvance, setFinAdvance)}<span>บาท</span></div>
                          {downSubTotal > 0 ? (
                            <>
                              <div style={{ ...finLbl, lineHeight: 1.3 }}>ใช้โปรดาวน์ออกแทน<br /><span style={{ fontWeight: 400, fontSize: 11, color: "#b45309" }}>ช่วยลดค่างวดล่วงหน้า (โปรทั้งหมด {Number(downSubTotal).toLocaleString("th-TH")})</span></div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{finInp(advSubsidyInput, setAdvSubsidyInput)}<span>บาท</span></div>
                            </>
                          ) : (<><div /><div /></>)}
                        </div>
                      )}

                      <div style={{ maxWidth: 420 }}>
                        {row("ราคาขาย", fmtBaht(carPrice))}
                        {downSubDiscount > 0 && row("ส่วนลด (เงินดาวน์ออกแทน)", "-" + fmtBaht(downSubDiscount), { color: "#b45309" })}
                        {isFin && row("เงินดาวน์", fmtBaht(fc.down))}
                        {isFin && fc.advance > 0 && row("ค่างวดจ่ายล่วงหน้า", fmtBaht(fc.advance))}
                        {isFin && advSub > 0 && row("โปรช่วยค่างวดล่วงหน้า (ออกแทน)", "-" + fmtBaht(advSub), { color: "#b45309" })}
                        {isFin && custPaidTheft > 0 && row(num(finTheft) > 0 ? "ประกันรถหาย (ไฟแนนซ์หัก)" : "ประกันรถหาย (ลูกค้าจ่ายเอง — เอาติ๊กของแถมออก)", fmtBaht(custPaidTheft))}
                        {row("หัก เงินมัดจำ" + (selBooking?.deposit_no ? ` (${selBooking.deposit_no})` : ""), dep > 0 ? "-" + fmtBaht(dep) : "-", { color: "#b45309" })}
                        {redPlateDep > 0 && row("มัดจำป้ายแดง (" + text(redPlateNo) + ")", "+" + fmtBaht(redPlateDep), { color: "#b91c1c" })}
                        {isRefund
                          ? row("คืนเงินมัดจำลูกค้า", fmtBaht(Math.abs(receive)), { big: true, line: true, color: "#b45309" })
                          : row(isFin ? "รวมยอดชำระ" : "รับชำระเงิน", fmtBaht(receive), { big: true, line: true, color: "#166534" })}
                        {isFin && fc.n > 0 && (
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                            ผ่อน {fc.n} งวด × {Number(fc.inst).toLocaleString("th-TH")} บาท (ดอกเบี้ย {finRate}%/เดือน)
                          </div>
                        )}
                      </div>

                      {savedSale ? (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ padding: 14, background: savedSale.__test ? "#fefce8" : "#f0fdf4", border: savedSale.__test ? "1px solid #fde047" : "1px solid #bbf7d0", borderRadius: 10 }}>
                            <div style={{ fontWeight: 700, color: savedSale.__test ? "#a16207" : "#166534", fontSize: 16 }}>
                              {savedSale.__test ? "🧪 โหมดทดสอบ — ยังไม่บันทึกลงฐานข้อมูล" : "✅ บันทึกใบขายเรียบร้อย"}
                            </div>
                            <div style={{ fontSize: 14, marginTop: 4 }}>
                              เลขที่ใบขาย: <strong style={{ fontFamily: "monospace" }}>{savedSale.sale_no}</strong>
                              {savedSale.__test ? " (ตัวอย่าง)" : " (ตัดออกจากสต๊อกแล้ว)"}
                            </div>
                          </div>

                          {/* ใบขาย — ส่งเข้า LINE ทันทีหลังกดบันทึกขาย */}
                          {(() => {
                            const st = {
                              sending: { bg: "#eff6ff", bd: "#bfdbfe", tx: "#1e40af", msg: "⏳ กำลังส่งใบขายเข้า LINE ลูกค้า..." },
                              sent: { bg: "#f0fdf4", bd: "#bbf7d0", tx: "#166534", msg: "✅ ส่งใบขายเข้า LINE ลูกค้าแล้ว (ส่งจริง)" },
                              no_line: { bg: "#fef2f2", bd: "#fecaca", tx: "#991b1b", msg: "⚠️ ลูกค้าไม่มี LINE ในระบบ — ไม่ได้ส่งใบขายทาง LINE" },
                              error: { bg: "#fef2f2", bd: "#fecaca", tx: "#991b1b", msg: "❌ ส่งใบขายเข้า LINE ไม่สำเร็จ" },
                            }[lineSaleStatus] || { bg: "#f9fafb", bd: "#e5e7eb", tx: "#6b7280", msg: "📤 ใบขาย: ส่งเข้า LINE ลูกค้าทันทีหลังบันทึกขาย" };
                            return (
                              <div style={{ marginTop: 12, padding: "10px 14px", background: st.bg, border: `1px solid ${st.bd}`, borderRadius: 10, textAlign: "left", fontSize: 14, color: st.tx, fontWeight: 600, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                <span>{st.msg}</span>
                                {lineSaleStatus === "error" && (
                                  <button onClick={() => sendSaleFlex(savedSale)}
                                    style={{ padding: "4px 14px", background: "#06C755", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
                                    ลองส่งใหม่
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <button onClick={handleSaveSale} disabled={saving || carPrice == null}
                          style={{ marginTop: 14, width: "100%", maxWidth: 420, padding: "13px 0", background: saving ? "#9ca3af" : "#16a34a", color: "#fff", border: "none", borderRadius: 10, cursor: saving ? "wait" : "pointer", fontSize: 17, fontWeight: 700, fontFamily: "Tahoma" }}>
                          {saving ? "กำลังบันทึก..." : receive == null ? "💾 บันทึกขาย" : isRefund ? `💾 บันทึกขาย — คืนเงินมัดจำ ${fmtBaht(Math.abs(receive))}` : `💾 บันทึกขาย — ${isFin ? "รวมยอดชำระ" : "รับชำระ"} ${fmtBaht(receive)}`}
                        </button>
                      )}
                    </div>

                    {/* การ์ดบันทึกชำระเงิน — ข้ามได้ถ้ายังไม่รับชำระ · ยอดติดลบ = คืนเงินมัดจำ */}
                    {savedSale && (
                      <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma", marginTop: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>💵 บันทึกชำระเงิน</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>ยังไม่รับชำระเงินตอนนี้ก็ได้ — ข้ามการ์ดนี้ไปได้เลย</div>

                        <div style={{ maxWidth: 460 }}>
                          {isRefund ? (
                            <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, color: "#b45309", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
                              ↩️ เงินมัดจำมากกว่ายอดที่ต้องชำระ — ต้องคืนเงินมัดจำลูกค้า {fmtBaht(Math.abs(receive))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 15, marginBottom: 12 }}>
                              ยอดรับชำระ: <strong style={{ color: "#166534", fontSize: 18 }}>{fmtBaht(receive)}</strong>
                              {redPlateDep > 0 && <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>รวมมัดจำป้ายแดง {fmtBaht(redPlateDep)} — ระบบออกใบรับมัดจำแยกจากใบเสร็จค่ารถให้อัตโนมัติ</div>}
                            </div>
                          )}

                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>วิธีการ{isRefund ? "คืนเงิน" : "รับชำระ"} <span style={{ fontWeight: 400, fontSize: 12, color: "#6b7280" }}>(เพิ่มได้หลายวิธี เช่น เงินสด + เงินโอน · เว้นยอดว่าง = ยอดที่เหลือ)</span></div>
                          {(() => {
                            const target = Math.abs(Number(receive) || 0);
                            const known = payLines.reduce((s, l) => s + (l.amount === "" ? 0 : num(l.amount)), 0);
                            const blanks = payLines.filter((l) => l.amount === "").length;
                            const sum = known + (blanks === 1 ? Math.max(target - known, 0) : 0);
                            const ok = blanks <= 1 && Math.abs(sum - target) < 0.5 && payLines.every((l) => l.method !== "transfer" || l.account_id);
                            const setLine = (idx, patch) => setPayLines((ls) => ls.map((l, k) => (k === idx ? { ...l, ...patch } : l)));
                            const sel = { padding: "9px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14 };
                            return (
                              <>
                                {payLines.map((l, idx) => (
                                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                                    <select value={l.method} disabled={paySaved} onChange={(e) => setLine(idx, { method: e.target.value, account_id: "" })} style={{ ...sel, width: 130 }}>
                                      <option value="cash">💵 เงินสด</option>
                                      <option value="transfer">🏦 เงินโอน</option>
                                    </select>
                                    <input type="number" value={l.amount} disabled={paySaved} onChange={(e) => setLine(idx, { amount: e.target.value })}
                                      placeholder={blanks === 1 && l.amount === "" ? String(Math.max(target - known, 0)) : "ยอด"}
                                      style={{ ...sel, width: 130, textAlign: "right" }} />
                                    {l.method === "transfer" && (
                                      <select value={l.account_id} disabled={paySaved} onChange={(e) => setLine(idx, { account_id: e.target.value })} style={{ ...sel, flex: 1, minWidth: 200 }}>
                                        <option value="">-- เลือกบัญชี{isRefund ? "โอนคืน" : "รับโอน"} --</option>
                                        {bankAccounts.filter(a => a.account_type !== "เงินสดย่อย" && a.account_type !== "ลูกหนี้").map(a => (
                                          <option key={a.account_id} value={a.account_id}>
                                            {a.account_name}{a.account_no && a.account_no !== "-" ? ` · ${a.account_no}` : ""}{a.bank_name && a.bank_name !== "-" ? ` (${a.bank_name})` : ""}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                    {payLines.length > 1 && !paySaved && (
                                      <button onClick={() => setPayLines((ls) => ls.filter((_, k) => k !== idx))} style={{ padding: "6px 10px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma" }}>✕</button>
                                    )}
                                  </div>
                                ))}
                                {isRefund && payLines[0]?.method === "transfer" && (
                                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                                    <input value={refundBank} disabled={paySaved} onChange={(e) => setRefundBank(e.target.value)} placeholder="ธนาคารของลูกค้า *" style={{ ...sel, width: 160 }} />
                                    <input value={refundAcctNo} disabled={paySaved} onChange={(e) => setRefundAcctNo(e.target.value)} placeholder="เลขบัญชีลูกค้า *" style={{ ...sel, width: 190, fontFamily: "monospace" }} />
                                  </div>
                                )}
                                {!paySaved && (
                                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                                    <button onClick={() => setPayLines((ls) => [...ls, { method: "transfer", amount: "", account_id: "" }])}
                                      style={{ padding: "6px 14px", background: "#fff", color: "#0369a1", border: "1.5px dashed #0369a1", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 13 }}>+ เพิ่มวิธีรับชำระ</button>
                                    <span style={{ fontSize: 13, color: ok ? "#166534" : "#b45309" }}>รวม {sum.toLocaleString("th-TH")} / {target.toLocaleString("th-TH")} บาท{ok ? " ✓" : blanks > 1 ? " (เว้นว่างได้ 1 บรรทัด)" : Math.abs(sum - target) >= 0.5 ? " (ยอดไม่ครบ)" : " (เลือกบัญชี)"}</span>
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {paySaved ? (
                            <div style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, color: "#166534", fontWeight: 700, fontSize: 14 }}>
                              ✅ {isRefund ? "บันทึกคืนเงินมัดจำแล้ว — ส่งใบเสร็จคืนเงินมัดจำ" : "บันทึกชำระเงินแล้ว — ส่งใบเสร็จรับเงิน"}เข้า LINE ลูกค้าแล้ว{savedSale.__test ? " (ยังไม่บันทึก DB)" : ""}
                            </div>
                          ) : (
                            <button onClick={() => handleSavePayment(receive)}
                              disabled={paySending || payLines.some((l) => l.method === "transfer" && !l.account_id)}
                              style={{ width: "100%", padding: "12px 0", background: paySending || payLines.some((l) => l.method === "transfer" && !l.account_id) ? "#cbd5e1" : "#16a34a", color: "#fff", border: "none", borderRadius: 10, cursor: paySending ? "wait" : "pointer", fontSize: 16, fontWeight: 700, fontFamily: "Tahoma" }}>
                              {paySending ? "⏳ กำลังส่งใบเสร็จ..." : isRefund ? "💾 บันทึกคืนเงินมัดจำ + ส่งใบเสร็จ" : "💾 บันทึกชำระเงิน + ส่งใบเสร็จ"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ขายส่ง: ไม่มีการ์ดเอกสาร → ปุ่มขายคันถัดไปแยกต่างหาก */}
                    {savedSale && isWholesale && (
                      <div style={{ marginTop: 16, textAlign: "center" }}>
                        <button onClick={resetAll}
                          style={{ padding: "13px 32px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 16, fontWeight: 700, fontFamily: "Tahoma" }}>
                          ➡️ บันทึกขายคันถัดไป
                        </button>
                      </div>
                    )}
                    {/* การ์ดอัปโหลดเอกสาร — เลือกไฟล์ให้ครบก่อน แล้วส่งทั้งหมดด้วยปุ่มเดียว (ขายส่งไม่มีเอกสารส่งลูกค้า) */}
                    {savedSale && !isWholesale && (
                      <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma", marginTop: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>📄 ส่งเอกสารให้ลูกค้า</div>
                          {(() => {
                            const pickRow = (label, bg, border, titleTxt, color, file, setFile) => (
                              <div style={{ marginTop: 10, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-start", flexWrap: "wrap" }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: titleTxt, minWidth: 200, textAlign: "left" }}>📄 {label}:</span>
                                <label style={{ padding: "7px 16px", background: docsSent ? "#94a3b8" : color, color: "#fff", borderRadius: 8, cursor: docsSent ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
                                  {file ? "🔁 เปลี่ยนไฟล์" : "📎 เลือกไฟล์"}
                                  <input type="file" accept="application/pdf" style={{ display: "none" }} disabled={docsSent}
                                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setFile(f); }} />
                                </label>
                                <span style={{ fontSize: 12, color: file ? "#166534" : "#9ca3af", fontWeight: file ? 600 : 400 }}>
                                  {file ? "✓ " + file.name : "ยังไม่ได้เลือกไฟล์"}
                                </span>
                              </div>
                            );
                            const files = [
                              { file: actFile, label: "พ.ร.บ." },
                              { file: cosmosFile, label: "3PLUS/RSA/PA" },
                              { file: docFile, label: "กรมธรรม์ประกันรถหาย COSMOS" },
                            ].filter(x => x.file);
                            return (
                              <>
                                {pickRow("เอกสาร พ.ร.บ. ลูกค้า", "#faf5ff", "#e9d5ff", "#6b21a8", "#7c3aed", actFile, setActFile)}
                                {pickRow("เอกสาร 3PLUS/RSA/PA", "#eff6ff", "#bfdbfe", "#1e40af", "#0369a1", cosmosFile, setCosmosFile)}
                                {/* กรมธรรม์ COSMOS: ขึ้นเฉพาะใบขายที่มีประกันรถหาย COSMOS (ปีต่อ/เงินสด) — ประกันรถหายที่ไฟแนนท์ออกแทนไม่มีเอกสาร (2026-08-22) */}
                                {hasCosmosTheft
                                  ? pickRow("กรมธรรม์ประกันรถหาย COSMOS (PDF)", "#f0fdfa", "#99f6e4", "#0f766e", "#0f766e", docFile, setDocFile)
                                  : null}

                                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
                                  {docsSent ? (
                                    <span style={{ padding: "10px 26px", background: "#94a3b8", color: "#fff", borderRadius: 8, fontSize: 15, fontWeight: 700, fontFamily: "Tahoma" }}>
                                      ✅ ส่งเอกสารทาง LINE แล้ว ({files.length} ไฟล์)
                                    </span>
                                  ) : (
                                    <button disabled={files.length === 0 || docsSending}
                                      onClick={sendDocsLine}
                                      style={{ padding: "10px 26px", background: files.length === 0 || docsSending ? "#cbd5e1" : "#06C755", color: "#fff", border: "none", borderRadius: 8, cursor: files.length === 0 || docsSending ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700, fontFamily: "Tahoma" }}>
                                      {docsSending ? "⏳ กำลังส่ง..." : `📤 ส่งเอกสารทาง LINE${files.length > 0 ? ` (${files.length} ไฟล์)` : ""}`}
                                    </button>
                                  )}
                                  <button onClick={resetAll}
                                    style={{ padding: "10px 22px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15, fontFamily: "Tahoma" }}>
                                    ขายคันต่อไป (เริ่มใหม่)
                                  </button>
                                </div>
                                {files.length === 0 && !docsSent && (
                                  <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 6 }}>เลือกไฟล์เอกสารที่ต้องส่งให้ครบก่อน จึงจะกดส่งได้</div>
                                )}
                              </>
                            );
                          })()}
                      </div>
                    )}
                    </>
                  );
                })()}
              </div>
            );
          })()}

          {/* ขั้น 7: เลือกไฟแนนท์ */}
          {step === 7 && (
            financeCos.length === 0 ? (
              <div style={{ color: "#9ca3af", padding: 30 }}>ยังไม่มีข้อมูลบริษัทไฟแนนท์</div>
            ) : (
              <div style={gridStyle(240)}>
                {financeCos.map(fc => (
                  <div key={fc.company_id} style={{ ...CARD, padding: "28px 16px" }}
                    onClick={() => setFinanceCo(fc)}
                    onMouseOver={e => e.currentTarget.style.borderColor = "#072d6b"}
                    onMouseOut={e => e.currentTarget.style.borderColor = "#d1d5db"}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#072d6b" }}>🏦 {fc.company_name}</div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* popup เลือก/เพิ่มลูกค้า */}
      {showCustomer && (
        <CustomerPickerModal currentUser={currentUser} onSelect={pickCustomer} onClose={() => setShowCustomer(false)} />
      )}

      {/* popup เลือกลูกค้า (ขายรถมือสอง) — บันทึกข้อมูลลูกค้าแบบเดียวกับขายรถใหม่ */}
      {showUsedCustomer && (
        <CustomerPickerModal currentUser={currentUser}
          onSelect={(c) => {
            setUsedSale(m => m ? {
              ...m,
              customer_code: text(c.customer_code) || m.customer_code,
              customer: text(c.customer_name) || m.customer,
              phone: text(c.phone) || m.phone,
              address: text(c.address) || m.address,
              birthdate: text(c.birth_date) || m.birthdate,
            } : m);
            setShowUsedCustomer(false);
          }}
          onClose={() => setShowUsedCustomer(false)} />
      )}

      {/* popup รูปขยาย (ดับเบิลคลิกที่รูป) — คลิกที่ไหนก็ได้เพื่อปิด */}
      {imgZoom && (
        <div onClick={() => setImgZoom(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, cursor: "zoom-out" }}>
          <img src={imgZoom} alt="ขยาย"
            style={{ maxWidth: "92vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 12, background: "#fff", padding: 10, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }} />
          <button onClick={() => setImgZoom(null)}
            style={{ position: "fixed", top: 18, right: 22, width: 40, height: 40, borderRadius: 20, border: "none", background: "#fff", color: "#111827", fontSize: 20, cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.35)" }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
