import React, { useEffect, useMemo, useState } from "react";
import CustomerPickerModal from "./CustomerPickerModal";

// บันทึกขาย NEW — wizard เลือกรถทีละขั้น: ประเภทรถ → ยี่ห้อ → รุ่น → สี (พร้อมรูป) → เลือกคันจากเลขเครื่อง/เลขถัง
// master: master-data-api | รูปสี: get_color_image (moto_color_images) | สต๊อกรายคัน: stock-turnover-api stock_on_hand
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const STOCK_API = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-turnover-api";
const BOOKING_API = "https://n8n-new-project-gwf2.onrender.com/webhook/moto-booking-api";
const DEPOSIT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/booking-deposit-api";
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const GIVEAWAY_API = "https://n8n-new-project-gwf2.onrender.com/webhook/giveaway-rules-api";

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

  // การเลือกแต่ละขั้น
  const [selType, setSelType] = useState(null);     // vehicle_type row
  const [selBrand, setSelBrand] = useState(null);   // brand row
  const [selSeries, setSelSeries] = useState(null); // series row
  const [selColor, setSelColor] = useState(null);   // color group { key, name, codes, rows }
  const [selUnit, setSelUnit] = useState(null);     // stock row
  const [saleType, setSaleType] = useState(null);   // 'cash' | 'finance'
  const [financeCo, setFinanceCo] = useState(null); // finance company row
  const [imgZoom, setImgZoom] = useState(null);     // data URL รูปที่ขยายดู (null = ปิด)

  // ข้อมูลลูกค้า (แบบเดียวกับหน้าบันทึกขายปลีก — เลือกจาก CustomerPickerModal หรือพิมพ์เอง)
  const CUST_DEFAULT = { customer_code: "", customer_name: "", customer_address: "", customer_phone: "", customer_birthdate: "", customer_tax_id: "", customer_province: "", customer_gender: "", customer_line_user_id: "" };
  const [cust, setCust] = useState(CUST_DEFAULT);
  const [showCustomer, setShowCustomer] = useState(false);

  // ราคาขายบวกเพิ่ม (รายการปรับแต่ง — logic เดียวกับบันทึกขายปลีก)
  const [adjOpen, setAdjOpen] = useState(false);          // default ไม่กด
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
  const [payMethod, setPayMethod] = useState(null);   // 'cash' | 'transfer'
  const [payAccountId, setPayAccountId] = useState("");
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
    return () => { alive = false; };
  }, []);

  function resetPostSave() {
    setActFile(null); setCosmosFile(null); setDocFile(null); setDocsSent(false); setDocsSending(false); setLineSaleStatus(null);
    setPayMethod(null); setPayAccountId(""); setPaySending(false); setPaySaved(false);
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
  function buildReceiptDocHtml(sale, receiptNo, pay) {
    const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const money = (n) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const lh = letterheadFor(sale);
    const title = pay.refund ? "ใบเสร็จคืนเงิน" : "ใบเสร็จรับเงิน";
    const carLine = [sale.brand, sale.model_name, sale.engine_no].filter(Boolean).join(" / ");
    const iRows = `<tr><td class="c">1</td><td>${esc((pay.refund ? "คืนเงินมัดจำ · " : "") + pay.methodLabel)}${pay.accountName ? " · " + esc(pay.accountName) : ""}</td><td class="c">1</td><td class="r">${money(pay.amount)}</td><td class="r">${money(pay.amount)}</td></tr>`;

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
</div></body></html>`;
  }

  // บันทึกชำระเงิน / คืนเงินมัดจำ — บันทึกจริงผ่าน save_payment (action เดียวกับหน้าขายปลีก) แล้วส่งใบเสร็จเข้า LINE
  // ยกเว้น: โหมดทดสอบไม่เขียน DB · ยอดติดลบ (คืนเงินมัดจำส่วนเกิน) ยังไม่เขียน DB — ให้ไปบันทึกที่เมนูมัดจำจองรถ
  async function handleSavePayment(receiveAmt) {
    if (!savedSale || paySending || paySaved) return;
    if (!payMethod) { setMessage("❌ เลือกวิธีการรับชำระ (เงินสด/เงินโอน) ก่อน"); return; }
    const acc = payMethod === "transfer" ? bankAccounts.find(a => String(a.account_id) === String(payAccountId)) : null;
    if (payMethod === "transfer" && !acc) { setMessage("❌ เลือกบัญชีรับโอนเงินก่อน"); return; }
    if (savedSale.__test && !custLineUserId) { setMessage("❌ ลูกค้าไม่มี LINE ในระบบ — ส่งใบเสร็จทาง LINE ไม่ได้"); return; }
    const refund = Number(receiveAmt) < 0;
    const pay = {
      refund,
      amount: Math.abs(Number(receiveAmt) || 0),
      methodLabel: payMethod === "cash" ? "เงินสด" : "เงินโอน",
      accountName: acc?.account_name || null,
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
          payments: [{ method: payMethod === "cash" ? "เงินสด" : "โอน", account_id: acc ? Number(acc.account_id) : null, account_name: acc?.account_name || null, amount: pay.amount }],
          paid_amount: pay.amount,
          payment_note: "",
          received_by: currentUser?.username || currentUser?.name || "",
          branch_code: savedSale.branch_code || currentUser?.branch_code || currentUser?.branch || "",
        });
        const updated = row && (row.sale || row);
        if (!updated || !updated.sale_no) throw new Error(row?.__error || row?.error || "บันทึกรับชำระไม่สำเร็จ");
        receiptNo = updated.receipt_no || receiptNo;
        // merge แถวที่อัปเดตกลับเข้า savedSale — คงชื่อรุ่น/สี/ยี่ห้อแบบแสดงผลของ wizard ไว้ใช้ในเอกสาร
        saleForDoc = { ...savedSale, ...updated, brand: savedSale.brand, model_name: savedSale.model_name, color: savedSale.color };
        setSavedSale(saleForDoc);
      }

      // ส่งใบเสร็จเข้า LINE ลูกค้า (ถ้ามี LINE)
      if (custLineUserId) {
        await post(RETAIL_API, {
          action: "send_receipt_flex",
          sale_no: savedSale.sale_no, receipt_no: receiptNo, receipt_date: todayStr(),
          customer_name: savedSale.customer_name,
          paid_amount: pay.amount,
          payment_methods: [{ method: (refund ? "คืนเงินมัดจำ · " : "") + pay.methodLabel, amount: pay.amount, account_name: pay.accountName }],
          branch_name: savedSale.branch_name, branch_code: savedSale.branch_code,
          line_user_id: custLineUserId,
          doc_html: buildReceiptDocHtml(saleForDoc, receiptNo, pay),
          sent_by: currentUser?.name || currentUser?.username || "",
        });
      }
      setPaySaved(true);
      if (savedSale.__test) {
        setMessage("🧪 ยังไม่บันทึกลง DB · ✅ ส่ง" + (refund ? "ใบเสร็จคืนเงินมัดจำ" : "ใบเสร็จรับเงิน") + "เข้า LINE ลูกค้าแล้ว");
      } else if (refund) {
        setMessage("✅ ส่งใบเสร็จคืนเงินมัดจำเข้า LINE แล้ว — ⚠️ ยอดคืนเงินยังไม่บันทึกลงระบบ กรุณาบันทึกคืนเงินที่เมนู \"มัดจำจองรถ\"");
      } else {
        setMessage("✅ รับชำระเงินเรียบร้อย เลขที่ใบเสร็จ " + receiptNo + (custLineUserId ? " · ส่งใบเสร็จเข้า LINE ลูกค้าแล้ว" : " (ลูกค้าไม่มี LINE — ไม่ได้ส่งใบเสร็จ)"));
      }
    } catch (e) {
      setMessage("❌ " + (e.message || "บันทึกรับชำระ/ส่งใบเสร็จไม่สำเร็จ"));
    }
    setPaySending(false);
  }

  // ส่ง "ใบขาย" เข้า LINE ลูกค้าทันทีหลังกดบันทึกขาย — action เดียวกับหน้าขายปลีก
  async function sendSaleFlex(sale) {
    if (!custLineUserId) { setLineSaleStatus("no_line"); return; }
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
        finance_type: sale.finance_type,
        branch_name: sale.branch_name, branch_code: sale.branch_code,
        line_user_id: custLineUserId,
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
      { file: docFile, doc_type: "doc", label: "ประกันรถหาย" },
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
  const [finRate, setFinRate] = useState("1.09");         // อัตราดอกเบี้ย %/เดือน
  const [finN, setFinN] = useState("");                   // จำนวนงวด
  const [finRound5, setFinRound5] = useState(false);      // ปัดเศษค่างวดลงท้าย 0/5
  const [finInstOverride, setFinInstOverride] = useState("");
  const [finInstTouched, setFinInstTouched] = useState(false);
  const [finAdvance, setFinAdvance] = useState("");       // ค่างวดจ่ายล่วงหน้า
  function resetFinanceInputs() {
    setFinDown(""); setFinTheft(""); setFinRate("1.09"); setFinN("");
    setFinRound5(false); setFinInstOverride(""); setFinInstTouched(false); setFinAdvance("");
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
      const cars = stockGroups[qNormModel(mc) + "|" + qNormColor(cn)] || [];
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
    if (!masterRow || !saleType) return [];
    const sel = masterRow; // มี brand_id / series_id / type_id
    const rowCC = selSeries ? Number(selSeries.engine_cc) || null : null;
    const fin = saleType === "finance";
    const finId = fin ? (financeCo?.company_id ?? "") : "";
    return saleExpenses.filter((e) => {
      if (e.group_by === "brand" && String(e.brand_id) === String(sel.brand_id)) return true;
      if (e.group_by === "type" && String(e.type_id) === String(sel.type_id)) {
        const cond = String(e.note || "all").trim().toLowerCase();
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
    });
  }, [masterRow, saleType, financeCo, saleExpenses, selSeries, cust.customer_name, cust.customer_province, financeCos]);

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

  // บันทึกการขาย (เงินสด/ผ่อนไฟแนนท์) — payload เดียวกับหน้าบันทึกขายปลีก (retail-sale-api save_sale)
  async function handleSaveSale() {
    if (saving || savedSale || !selUnit) return;
    const isFin = saleType === "finance";
    const base = announcedPrice(saleType);
    const carPrice = base == null ? null : base + adjustmentsTotal;
    if (carPrice == null) { setMessage("❌ ไม่พบราคาขายของรถคันนี้ — ตรวจสอบเมนูราคารถก่อน"); return; }
    if (!text(cust.customer_name)) { setMessage("❌ กรุณากรอกชื่อลูกค้า"); return; }
    const netCar = Math.max(carPrice - downSubTotal, 0); // หักส่วนลด "เงินดาวน์ออกแทน"
    const fc = financeCalc(netCar);
    if (isFin && !(fc.n > 0)) { setMessage("❌ กรอกจำนวนงวด"); return; }

    // 🧪 โหมดทดสอบ: ไม่บันทึกลง DB — แต่ "ส่งใบขายเข้า LINE ลูกค้าจริง" ทันทีหลังบันทึก
    if (TEST_MODE) {
      const dep = depositAmt;
      const totalPayment = (isFin ? fc.down + fc.advance + fc.theft : netCar) - dep; // ติดลบ = ต้องคืนเงินมัดจำ
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
        car_price: carPrice, discount: downSubTotal, net_car_price: netCar,
        down_payment: isFin ? fc.down : 0,
        booking_deposit: dep, deposit_no: selBooking?.deposit_no || "", booking_date: selBooking?.booking_date || "",
        total_payment: totalPayment,
        advance_installment: isFin ? fc.advance : 0,
        installments: isFin ? fc.n : 0,
        installment_amount: isFin ? fc.inst : 0,
        interest_rate: isFin ? num(finRate) : 0,
        finance_amount: isFin ? fc.financeAmount : 0,
        theft_insurance_amount: isFin ? fc.theft : 0,
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
      // ดึงข้อมูลรถเต็มจากตารางรับสินค้า (ต้องได้ stock_id/stock_table + เช็คว่ายังไม่ถูกขาย)
      const vres = await post(RETAIL_API, { action: "get_vehicle", keyword: selUnit.engine_no });
      const vehicle = Array.isArray(vres) ? vres[0] : vres;
      if (!vehicle || (!vehicle.stock_id && !vehicle.engine_no)) throw new Error("ไม่พบรถคันนี้ในสต๊อก");
      if ((vehicle.sale && vehicle.sale.sale_no) || vehicle.sold_at) throw new Error("รถคันนี้ถูกขายไปแล้ว");

      const dep = depositAmt;
      const totalPayment = (isFin ? fc.down + fc.advance + fc.theft : netCar) - dep; // ติดลบ = ต้องคืนเงินมัดจำ
      const payload = {
        action: "save_sale",
        brand: vehicle.brand, stock_table: vehicle.stock_table, stock_id: vehicle.stock_id,
        unit_cost: vehicle.unit_cost, chassis_no: vehicle.chassis_no, engine_no: vehicle.engine_no,
        model_code: vehicle.model_code, model_year: vehicle.model_year, model_color: vehicle.model_color, model_name: vehicle.model_name,
        sale_date: todayStr(),
        customer_code: cust.customer_code, customer_name: cust.customer_name, customer_address: cust.customer_address,
        customer_tax_id: cust.customer_tax_id, customer_phone: cust.customer_phone, customer_birthdate: cust.customer_birthdate,
        customer_gender: cust.customer_gender, line_user_id: cust.customer_line_user_id || selBooking?.line_user_id || "",
        seller: currentUser?.username || currentUser?.name || "",
        note: "",
        finance_type: isFin ? "moto" : "none",
        car_price: carPrice, net_car_price: netCar, discount: downSubTotal, other_sale: 0,
        down_payment: isFin ? fc.down : 0,
        booking_deposit: dep, deposit_no: selBooking?.deposit_no || "",
        total_payment: totalPayment,
        advance_installment: isFin ? fc.advance : 0,
        theft_insurance_amount: isFin ? fc.theft : 0,
        theft_insurance_source: isFin && fc.theft > 0 ? "finance" : null,
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
      if (custLineUserId) msg += " · กำลังส่งใบขายเข้า LINE ลูกค้า...";
      setMessage(msg);
      sendSaleFlex(saleDoc); // ส่งใบขายเข้า LINE ลูกค้าทันที (ถ้าไม่มี LINE จะขึ้นสถานะแจ้งเอง)
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
      return group.rows.find(r => text(unit.model) === text(r.model_code) && text(unit.model_type) === text(r.type_name) && text(unit.color).toUpperCase() === text(r.color_code).toUpperCase())
        || group.rows.find(r => text(unit.model) === text(r.model_code) && text(unit.color).toUpperCase() === text(r.color_code).toUpperCase())
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
  const branchGroup = useMemo(() => {
    const bc = text(currentUser?.branch_code || currentUser?.branch).slice(0, 5);
    if (bc) return ["SCY05", "SCY06"].includes(bc) ? "ป.เปา" : "สิงห์ชัย";
    return selBrand && brandParam(selBrand) === "HONDA" ? "ป.เปา" : "สิงห์ชัย";
  }, [currentUser, selBrand]);

  function announcedPrice(wantSaleType) {
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
    const row = prices.find(x => String(x.type_id) === String(masterRow.type_id) && String(x.price_type_id) === String(ptId));
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
  const downPayoutCalc = adjOpen && useDownPayout ? Math.ceil((Number(downPayout || 0) * 1.07) / 100) * 100 : 0;
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
    if (saleType === "finance" && !financeCo) { setSaleType(null); return; }   // ออกจากหน้าเลือกไฟแนนท์
    if (savedSale) return; // บันทึกแล้ว — ต้องกด "เริ่มใหม่" เท่านั้น
    if (selUnit) { setSelUnit(null); setSaleType(null); setFinanceCo(null); resetAdjustments(); resetFinanceInputs(); setBookingAsk(null); setSelBooking(null); setSelectedGiveaways({}); return; }
    if (selColor) { setSelColor(null); return; }
    if (selSeries) { setSelSeries(null); return; }
    if (selBrand) { setSelBrand(null); return; }
    if (selType) { setSelType(null); return; }
  }
  function resetAll() {
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
          {step > 1 && <button className="btn-secondary" onClick={goBack}>← ย้อนกลับ</button>}
          {step > 1 && <button className="btn-secondary" onClick={resetAll}>เริ่มใหม่</button>}
        </div>
      </div>

      {/* breadcrumb การเลือก */}
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
        {crumb(saleType ? `การขาย: ${saleType === "cash" ? "เงินสด" : "ผ่อนไฟแนนท์"}${financeCo ? ` (${financeCo.company_name})` : ""}` : "ประเภทการขาย", null)}
      </div>

      <h3 style={{ margin: "4px 0 14px", fontFamily: "Tahoma" }}>ขั้นตอนที่ {step}/7 — {STEP_TITLES[step]}</h3>
      {message && <div style={{ color: "#ef4444", marginBottom: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>{message}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>กำลังโหลดข้อมูลรุ่นรถ...</div>
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
                          {units.map((u, i) => (
                            <tr key={u.engine_no}>
                              <td>{i + 1}</td>
                              <td style={{ fontWeight: 600 }}>{u.engine_no}</td>
                              <td>{u.chassis_no || "-"}</td>
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
                    ) : (
                      <div style={{ padding: "14px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10 }}>
                        <div style={{ fontSize: 13, color: "#166534" }}>{saleType === "cash" ? "ราคาขายเงินสด" : "ราคาขายผ่อนไฟแนนท์"}</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: "#166534", marginTop: 4 }}>
                          {fmtBaht(price == null ? null : price + adjustmentsTotal)}
                        </div>
                        {price != null && adjustmentsTotal > 0 && (
                          <div style={{ fontSize: 12, color: "#166534", marginTop: 2 }}>
                            ราคาประกาศ {fmtBaht(price)} + บวกเพิ่ม {fmtBaht(adjustmentsTotal)}
                          </div>
                        )}
                        {price == null && <div style={{ fontSize: 12, color: "#991b1b", marginTop: 4 }}>ไม่พบราคาประกาศของแบบ/type นี้ในเมนูราคารถ</div>}
                      </div>
                    )}

                    {/* option: ราคาขายบวกเพิ่ม (default ปิด) */}
                    <button onClick={() => { if (adjOpen) resetAdjustments(); else setAdjOpen(true); }}
                      style={{ marginTop: 12, padding: "8px 16px", fontSize: 14, fontWeight: 600, fontFamily: "Tahoma", borderRadius: 8, cursor: "pointer",
                        background: adjOpen ? "#7c3aed" : "#fff", color: adjOpen ? "#fff" : "#7c3aed",
                        border: "1.5px solid #7c3aed" }}>
                      ⚙️ ราคาขายบวกเพิ่ม {adjOpen ? "✓" : ""}
                    </button>
                    {adjOpen && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                        <AdjRow label="ค่านำพา" checked={useDeliveryFee} onCheck={setUseDeliveryFee}
                          value={deliveryFee} onChange={setDeliveryFee}
                          extra={deliveryBonus > 0 ? `(+โบนัส ${Number(deliveryBonus).toLocaleString("th-TH")})` : ""} />
                        <AdjRow label="เงินดาวน์/ค่างวดออกแทน" checked={useDownPayout} onCheck={setUseDownPayout}
                          value={downPayout} onChange={setDownPayout}
                          extra={downPayoutCalc > 0 ? `(× 1.07 = ${Number(downPayoutCalc).toLocaleString("th-TH")})` : ""} />
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

                {/* การ์ดข้อมูลลูกค้า (แบบเดียวกับบันทึกขายปลีก) — ขึ้นหลังเลือกประเภทการขาย + ตอบ จอง/ไม่จอง แล้ว */}
                {saleType && (bookingAsk === "walkin" || (bookingAsk === "booked" && selBooking)) && (() => {
                  const inp = { width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" };
                  const box = { width: "100%", padding: "8px 10px", background: "#e9eef0", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, color: "#374151", minHeight: 19, textAlign: "center", boxSizing: "border-box" };
                  const lbl = { fontWeight: 600, fontSize: 14, fontFamily: "Tahoma", whiteSpace: "nowrap", textAlign: "right" };
                  return (
                    <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma", marginTop: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>ข้อมูลลูกค้า</div>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "12px 10px", alignItems: "center" }}>
                        <div style={lbl}>รหัสลูกค้า</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input value={cust.customer_code} onChange={e => setCust(p => ({ ...p, customer_code: e.target.value }))} placeholder="รหัสลูกค้า" style={{ ...inp, width: 120 }} />
                          <button type="button" onClick={() => setShowCustomer(true)}
                            style={{ padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontFamily: "Tahoma", whiteSpace: "nowrap" }}>
                            🔍 เลือก/เพิ่ม
                          </button>
                        </div>
                        <div style={lbl}>ชื่อลูกค้า <span style={{ color: "#ef4444" }}>*</span></div>
                        <input value={cust.customer_name} onChange={e => setCust(p => ({ ...p, customer_name: e.target.value }))} placeholder="ชื่อ-สกุล ลูกค้า (เลือกจากปุ่ม หรือพิมพ์เอง)" style={inp} />

                        <div style={lbl}>ที่อยู่</div>
                        <div style={{ ...box, gridColumn: "2 / span 3", textAlign: cust.customer_address ? "left" : "center" }}>{cust.customer_address || "—"}</div>

                        <div style={lbl}>เบอร์โทร</div>
                        <div style={box}>{cust.customer_phone || "—"}</div>
                        <div style={lbl}>วันเกิด</div>
                        <div style={box}>{cust.customer_birthdate ? thaiDate(cust.customer_birthdate) : "—"}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* การ์ดของแถม-บริการ (จากบันทึกค่าใช้จ่ายการขาย ประเภทโปรโมชั่น) */}
                {(bookingAsk === "walkin" || (bookingAsk === "booked" && selBooking)) && displayGiveaways.length > 0 && (
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
                    </div>
                    <div style={{ textAlign: "right", marginTop: 10, fontSize: 14 }}>
                      รวมของแถมที่ให้: <span style={{ fontWeight: 800, color: "#dc2626" }}>{Number(giveawaysTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</span>
                    </div>
                  </div>
                )}

                {/* การ์ดของแถม-สินค้า (จาก Master Data → บันทึกของแถม) */}
                {(bookingAsk === "walkin" || (bookingAsk === "booked" && selBooking)) && productGiveaways.length > 0 && (
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
                  const carPrice = base == null ? null : base + adjustmentsTotal;
                  const netCar = carPrice == null ? null : Math.max(carPrice - downSubTotal, 0);
                  const fc = financeCalc(netCar || 0);
                  const dep = depositAmt;
                  // ติดลบ = มัดจำมากกว่ายอดที่ต้องจ่าย → ต้องคืนเงินมัดจำลูกค้า
                  const receive = carPrice == null ? null : (isFin ? fc.down + fc.advance + fc.theft : netCar) - dep;
                  const isRefund = receive != null && receive < 0;
                  const row = (label, val, opts = {}) => (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: opts.big ? 18 : 14, fontWeight: opts.big ? 700 : 400, color: opts.color || "#111827", borderTop: opts.line ? "1px dashed #d1d5db" : "none" }}>
                      <span>{label}</span><span>{val}</span>
                    </div>
                  );
                  const finInp = (value, onChange, opts = {}) => (
                    <input type="number" value={value} disabled={!!savedSale}
                      onChange={e => onChange(e.target.value)} placeholder="0"
                      style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, textAlign: "right", boxSizing: "border-box", ...(opts.style || {}) }} />
                  );
                  const finLbl = { fontWeight: 600, fontSize: 14, fontFamily: "Tahoma", whiteSpace: "nowrap", textAlign: "right" };
                  return (
                    <>
                    <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", fontFamily: "Tahoma", marginTop: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>สรุปยอดขาย {isFin && <span style={{ fontWeight: 400, fontSize: 13, color: "#6b7280" }}>(ผ่อนไฟแนนท์: {financeCo?.company_name || "-"})</span>}</div>

                      {isFin && (
                        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "12px 10px", alignItems: "center", marginBottom: 14, maxWidth: 720 }}>
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
                          <div />
                          <div />
                        </div>
                      )}

                      <div style={{ maxWidth: 420 }}>
                        {row("ราคาขาย", fmtBaht(carPrice))}
                        {downSubTotal > 0 && row("ส่วนลด (เงินดาวน์ออกแทน)", "-" + fmtBaht(downSubTotal), { color: "#b45309" })}
                        {isFin && row("เงินดาวน์", fmtBaht(fc.down))}
                        {isFin && fc.advance > 0 && row("ค่างวดจ่ายล่วงหน้า", fmtBaht(fc.advance))}
                        {isFin && fc.theft > 0 && row("ประกันรถหาย (ไฟแนนซ์หัก)", fmtBaht(fc.theft))}
                        {row("หัก เงินมัดจำ" + (selBooking?.deposit_no ? ` (${selBooking.deposit_no})` : ""), dep > 0 ? "-" + fmtBaht(dep) : "-", { color: "#b45309" })}
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
                          {saving ? "กำลังบันทึก..." : "💾 บันทึกขาย"}
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
                            </div>
                          )}

                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>วิธีการ{isRefund ? "คืนเงิน" : "รับชำระ"}</div>
                          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                            <button onClick={() => { if (!paySaved) { setPayMethod("cash"); setPayAccountId(""); } }}
                              style={{ flex: 1, padding: "12px 0", fontSize: 15, fontWeight: 700, fontFamily: "Tahoma", borderRadius: 8, cursor: paySaved ? "not-allowed" : "pointer",
                                background: payMethod === "cash" ? "#072d6b" : "#fff", color: payMethod === "cash" ? "#fff" : "#072d6b",
                                border: payMethod === "cash" ? "2px solid #072d6b" : "2px solid #d1d5db" }}>
                              💵 เงินสด {payMethod === "cash" ? "✓" : ""}
                            </button>
                            <button onClick={() => { if (!paySaved) setPayMethod("transfer"); }}
                              style={{ flex: 1, padding: "12px 0", fontSize: 15, fontWeight: 700, fontFamily: "Tahoma", borderRadius: 8, cursor: paySaved ? "not-allowed" : "pointer",
                                background: payMethod === "transfer" ? "#072d6b" : "#fff", color: payMethod === "transfer" ? "#fff" : "#072d6b",
                                border: payMethod === "transfer" ? "2px solid #072d6b" : "2px solid #d1d5db" }}>
                              🏦 เงินโอน {payMethod === "transfer" ? "✓" : ""}
                            </button>
                          </div>

                          {payMethod === "transfer" && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>บัญชี{isRefund ? "โอนคืนเงิน" : "รับโอนเงิน"} <span style={{ color: "#ef4444" }}>*</span></div>
                              <select value={payAccountId} disabled={paySaved} onChange={e => setPayAccountId(e.target.value)}
                                style={{ width: "100%", padding: "9px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14 }}>
                                <option value="">-- เลือกบัญชี --</option>
                                {bankAccounts.filter(a => a.account_type !== "เงินสดย่อย" && a.account_type !== "ลูกหนี้").map(a => (
                                  <option key={a.account_id} value={a.account_id}>
                                    {a.account_name}{a.account_no && a.account_no !== "-" ? ` · ${a.account_no}` : ""}{a.bank_name && a.bank_name !== "-" ? ` (${a.bank_name})` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {paySaved ? (
                            <div style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, color: "#166534", fontWeight: 700, fontSize: 14 }}>
                              ✅ {isRefund ? "บันทึกคืนเงินมัดจำแล้ว — ส่งใบเสร็จคืนเงินมัดจำ" : "บันทึกชำระเงินแล้ว — ส่งใบเสร็จรับเงิน"}เข้า LINE ลูกค้าแล้ว{savedSale.__test ? " (ยังไม่บันทึก DB)" : ""}
                            </div>
                          ) : (
                            <button onClick={() => handleSavePayment(receive)}
                              disabled={paySending || !payMethod || (payMethod === "transfer" && !payAccountId)}
                              style={{ width: "100%", padding: "12px 0", background: paySending || !payMethod || (payMethod === "transfer" && !payAccountId) ? "#cbd5e1" : "#16a34a", color: "#fff", border: "none", borderRadius: 10, cursor: paySending ? "wait" : "pointer", fontSize: 16, fontWeight: 700, fontFamily: "Tahoma" }}>
                              {paySending ? "⏳ กำลังส่งใบเสร็จ..." : isRefund ? "💾 บันทึกคืนเงินมัดจำ + ส่งใบเสร็จ" : "💾 บันทึกชำระเงิน + ส่งใบเสร็จ"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* การ์ดอัปโหลดเอกสาร — เลือกไฟล์ให้ครบก่อน แล้วส่งทั้งหมดด้วยปุ่มเดียว */}
                    {savedSale && (
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
                              { file: docFile, label: "ประกันรถหาย" },
                            ].filter(x => x.file);
                            return (
                              <>
                                {pickRow("เอกสาร พ.ร.บ. ลูกค้า", "#faf5ff", "#e9d5ff", "#6b21a8", "#7c3aed", actFile, setActFile)}
                                {pickRow("เอกสาร 3PLUS/RSA/PA", "#eff6ff", "#bfdbfe", "#1e40af", "#0369a1", cosmosFile, setCosmosFile)}
                                {pickRow("เอกสารประกันรถหาย (PDF)", "#f0fdfa", "#99f6e4", "#0f766e", "#0f766e", docFile, setDocFile)}

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
