import React, { useEffect, useMemo, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/receipt-entry-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const REG_API = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api"; // lookup วันจดทะเบียนจากงานส่งจด (OCR สำเนาทะเบียน)

// ประเภทงาน (wizard ขั้นแรก) — defaultIncome = ประเภทรายได้ที่ prefill ให้บรรทัดแรกอัตโนมัติ
const JOB_TYPES = [
  { label: "งานทะเบียนรถใหม่", icon: "🏍️", desc: "จดทะเบียนรถใหม่ป้ายแดง", defaultIncome: "รายได้งานทะเบียน" },
  { label: "งานต่อภาษีและพรบ.", icon: "📅", desc: "ต่อภาษีประจำปี + พรบ.", defaultIncome: "รายได้ พรบ." },
  { label: "งานโอนทะเบียน", icon: "🔁", desc: "โอนกรรมสิทธิ์ / ย้ายทะเบียน", defaultIncome: "รายได้งานทะเบียน" },
  { label: "งานประกัน", icon: "🛡️", desc: "ประกันภัยภาคสมัครใจ", defaultIncome: "รายได้ประกัน" },
  // "อื่นๆ" เอาออกจากตัวเลือก (user 2026-08-25) — รายได้อื่นๆ ให้ใช้เมนูรับฝากเงิน/รายได้อื่นๆ แทน; เอกสารเก่าประเภทอื่นๆ ยังเปิดแก้ได้ (option เสริมใน dropdown)
];
const JOB_TYPE_LABELS = JOB_TYPES.map((t) => t.label);
// เอกสารเก่าก่อนเปลี่ยนเป็น wizard เก็บประเภทชุดเดิม — map ให้ตรงประเภทใหม่ตอนเปิดแก้ไข
const normalizeReceiptType = (t) => {
  const s = String(t || "").trim();
  if (!s || JOB_TYPE_LABELS.includes(s)) return s;
  if (s === "จดทะเบียนใหม่") return "งานทะเบียนรถใหม่";
  if (s === "โอน") return "งานโอนทะเบียน";
  if (s === "ต่อทะเบียน") return "งานต่อภาษีและพรบ.";
  if (s === "พรบ./ประกันภัย") return "งานประกัน";
  if (s.replace(/\s/g, "") === "อื่นๆ") return "อื่นๆ";
  return s;
};

// ประเภทรายได้คงที่ 3 อย่าง — 1&2 ดึงชื่อรายได้จาก master service_expenses, 3 (พรบ.) ดึงอัตโนมัติจากค่าใช้จ่ายการขายตาม CC
const TYPE_REGISTER = "รายได้งานทะเบียน";
const TYPE_INSURANCE = "รายได้ประกัน";
const TYPE_PRB = "รายได้ พรบ.";
// "ทั้งหมด" = ค่าตั้งต้น รวมชื่อรายได้ทุกประเภทในลิสต์เดียว — ตอนเลือกชื่อจะ stamp ประเภทจริงของรายการนั้นลง income_type ให้เอง
const TYPE_ALL = "ทั้งหมด";
// รับฝากค่างวด — บริษัท (กรุ๊ปลีส/ธนบรรณ) ดูจากไฟแนนซ์ของรถที่เลือก ไม่ต้องเลือกเอง; เลขสัญญาพิมพ์ในช่องหมายเหตุ
const TYPE_DEPOSIT = "รายได้รับฝากเงิน";
const FIXED_INCOME_TYPES = [TYPE_ALL, TYPE_REGISTER, TYPE_INSURANCE, TYPE_PRB, TYPE_DEPOSIT];
const stripDots = (s) => String(s || "").replace(/[.\s]/g, "");
const containsPrb = (s) => stripDots(s).includes("พรบ");
const normName = (s) => String(s || "").toLowerCase().replace(/\s+/g, "").trim();
// แปลงประเภทเดิม (ก่อนแยก 3 อย่าง) ให้ match dropdown ใหม่ เวลาเปิดแก้ไขเอกสารเก่า
const normalizeIncomeType = (t) => {
  const s = String(t || "").trim();
  if (!s || FIXED_INCOME_TYPES.includes(s)) return s;
  if (containsPrb(s) && !s.includes("ประกัน")) return TYPE_PRB;
  if (s.includes("ประกัน")) return TYPE_INSURANCE;
  if (s.includes("ทะเบียน")) return TYPE_REGISTER;
  return s;
};

// ===== normalize รุ่น/แบบ/type จาก moto_sales ให้ตรง master (รูปแบบต่างกันฮอนด้า/ยามาฮ่า) =====
const normBrand = (b) => {
  const s = String(b || "").toLowerCase();
  if (s.includes("honda") || s.includes("ฮอนด้า")) return "honda";
  if (s.includes("yamaha") || s.includes("ยามาฮ่า")) return "yamaha";
  return s;
};
const upCode = (s) => String(s || "").toUpperCase().replace(/\s+/g, "").trim();
// ฮอนด้า: model_code = "ACB160CATR (TH) CLICK 160..." → base="ACB160CATR", type="TH"
const parseHondaModelCode = (mc) => {
  const raw = String(mc || "").trim();
  const m = raw.match(/^([A-Za-z0-9\-/]+)\s*\(([^)]+)\)/);
  if (m) return { base: m[1].trim(), type: m[2].trim() };
  return { base: raw.split(/\s+/)[0] || "", type: "" };
};
// คืน { brand, model_series(รุ่น), model_code(แบบ), model_type(type) } โดย validate กับ master types
function normalizeVehicleModel(raw, types) {
  const nb = normBrand(raw.brand);
  const series = String(raw.model_series || "").trim();
  const already = String(raw.model_type || "").trim(); // มี = normalize แล้ว (ข้อมูลที่บันทึกภายหลัง)
  let parsedCode = "", parsedType = "";
  if (already) { parsedType = upCode(already); parsedCode = upCode(raw.model_code); }
  else if (nb === "yamaha") { parsedType = upCode(raw.model_code); }       // ยามาฮ่า: model_code = type code (เช่น DT0300)
  else { const p = parseHondaModelCode(raw.model_code); parsedCode = upCode(p.base); parsedType = upCode(p.type); }

  const pool = (Array.isArray(types) ? types : []).filter(
    (t) => normBrand(t.brand_name) === nb && upCode(t.series_name) === upCode(series)
  );
  let hit = null;
  if (parsedType) hit = pool.find((t) => upCode(t.type_name) === parsedType);
  if (!hit && parsedCode) hit = pool.find((t) => upCode(t.model_code) === parsedCode);
  if (!hit && pool.length === 1) hit = pool[0];

  if (hit) return { brand: hit.brand_name || raw.brand || "", model_series: hit.series_name || series, model_code: hit.model_code || "", model_type: hit.type_name || "" };
  // fallback: ไม่เจอใน master → ใช้ค่าที่ parse ได้ (ยามาฮ่า แบบ มัก = ชื่อรุ่น)
  return {
    brand: String(raw.brand || "").trim(),
    model_series: series,
    model_code: already ? String(raw.model_code || "").trim() : (nb === "yamaha" ? series : parsedCode),
    model_type: parsedType,
  };
}

const text = (v) => (v ?? "").toString().trim();
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const baht = (v) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtBE = (v) => { if (!v) return "-"; const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543}` : String(v); };

// ช่องวันที่แบบ พ.ศ. — พิมพ์ วว/ดด/ปปปป เป็น พ.ศ. ตรง ๆ (รับ ค.ศ. ด้วย, ปี 2 หลัก = 25xx) เก็บค่าภายในเป็น ISO ค.ศ.
// ใช้แทน <input type="date"> ในส่วนคำนวณภาษี — เบราว์เซอร์บังคับแสดง พ.ศ. ไม่ได้ (user ขอ 2026-08-19)
function BEDateInput({ value, onChange, style, title, placeholder }) {
  const toBE = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543}` : ""; };
  const [txt, setTxt] = useState(toBE(value));
  useEffect(() => { setTxt(toBE(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    const t = String(txt || "").trim();
    if (!t) { onChange(""); return; }
    const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (!m) { setTxt(toBE(value)); return; }
    let yy = Number(m[3]);
    if (m[3].length <= 2) yy += 2500;   // 69 → 2569
    if (yy > 2400) yy -= 543;           // พ.ศ. → ค.ศ.
    const iso = `${yy}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
    if (isNaN(new Date(iso).getTime())) { setTxt(toBE(value)); return; }
    onChange(iso);
    setTxt(toBE(iso));
  };
  return (
    <input value={txt} onChange={e => setTxt(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
      placeholder={placeholder || "วว/ดด/ปปปป (พ.ศ.)"} style={style} title={title} inputMode="numeric" />
  );
}

// ===== งานต่อภาษี (เฉพาะมอเตอร์ไซค์) — เงินเพิ่ม 1%/เดือน + เกณฑ์ตรวจสภาพตามประกาศขนส่งฯ =====
const MC_TAX_PER_YEAR = 100; // ภาษี จยย. ส่วนบุคคล (รย.12) ปีละ 100 บาท
const MC_TRO_FEE = 60;       // ค่าตรวจสภาพ ตรอ. จยย.
const MC_TRO_AGE = 5;        // จยย. อายุครบ 5 ปีขึ้นไปต้องตรวจสภาพ
// format วันที่แบบ local (ห้ามใช้ toISOString — โซนเวลาไทยจะเลื่อนถอยหลัง 1 วัน)
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// วันพฤหัสบดีถัดไปหลังวันที่ระบุ (ร้านส่งขนส่งทุกพฤหัส ภายใน 1 สัปดาห์หลังรับเรื่อง)
function nextThursday(iso) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 4);
  return localISO(d);
}
// นับเดือนล่าช้าแบบขนส่งฯ: เศษของเดือนนับเป็น 1 เดือน
function monthsLate(dueISO, payISO) {
  const due = new Date(dueISO + "T00:00:00"), pay = new Date(payISO + "T00:00:00");
  if (isNaN(due) || isNaN(pay) || pay <= due) return 0;
  let m = (pay.getFullYear() - due.getFullYear()) * 12 + (pay.getMonth() - due.getMonth());
  if (pay.getDate() > due.getDate()) m += 1;
  return Math.max(m, 1);
}
// คำนวณภาษีค้าง + เงินเพิ่มรายปี + ธงตรวจสภาพ — registerISO=วันจดทะเบียน, expireISO=วันสิ้นอายุภาษีเดิม, payISO=วันที่คาดว่าจะยื่น
const MC_LATE_GRACE_DAYS = 7; // ยื่นใกล้วันสิ้นอายุ (ห่างไม่เกิน 7 วัน หรือวันเดียวกัน) → เผื่อเงินเพิ่ม 1 เดือนไว้ก่อน กันยื่นจริงเลื่อนไปพฤหัสถัดไปแล้วโดน 1% (user เลือก 2026-08-22)
function calcMcTax(registerISO, expireISO, payISO) {
  const expire = new Date(expireISO + "T00:00:00");
  let pay = new Date(payISO + "T00:00:00");
  if (isNaN(expire) || isNaN(pay)) return null;
  const daysToExpire = Math.round((expire - pay) / 86400000);
  if (daysToExpire >= 0 && daysToExpire <= MC_LATE_GRACE_DAYS) {
    pay = new Date(expire); pay.setDate(pay.getDate() + 1);
    payISO = localISO(pay);
  }
  // ไล่ทีละปีภาษีที่ครบกำหนดแล้วยังไม่จ่าย (due < วันยื่น)
  const years = [];
  let due = new Date(expire);
  while (due < pay) {
    const dueISO2 = localISO(due);
    years.push({ due: dueISO2, months: monthsLate(dueISO2, payISO), surcharge: MC_TAX_PER_YEAR * 0.01 * monthsLate(dueISO2, payISO) });
    due.setFullYear(due.getFullYear() + 1);
  }
  const lateYears = years.length;                       // จำนวนปีภาษีที่ต้องจ่าย (ค้าง)
  const taxTotal = (lateYears || 1) * MC_TAX_PER_YEAR;  // ไม่ค้างเลย = ต่อล่วงหน้า 1 ปี
  const surcharge = Math.round(years.reduce((s, y) => s + y.surcharge, 0) * 100) / 100;
  if (lateYears === 0) due.setFullYear(due.getFullYear() + 1); // ต่อล่วงหน้า → รอบใหม่ = สิ้นอายุเดิม + 1 ปี
  const newExpire = localISO(due);                      // วันสิ้นอายุภาษีรอบใหม่หลังต่อครบ
  // อายุรถ ณ วันสิ้นอายุภาษีรอบใหม่ (เกณฑ์ ตรอ.)
  let age = null, needTro = false;
  if (registerISO) {
    const reg = new Date(registerISO + "T00:00:00");
    if (!isNaN(reg)) {
      age = new Date(newExpire + "T00:00:00").getFullYear() - reg.getFullYear();
      needTro = age >= MC_TRO_AGE;
    }
  }
  const overYear = lateYears >= 2 || (lateYears === 1 && monthsLate(years[0]?.due, payISO) > 12); // ขาดเกิน 1 ปี
  const suspended = lateYears > 3;                      // ขาดเกิน 3 ปี = ทะเบียนระงับ
  return { lateYears, taxTotal, surcharge, newExpire, age, needTro, overYear, suspended, months: years[0]?.months || 0 };
}

async function apiPost(payload) {
  const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const raw = await r.text();
  if (!raw.trim()) return [];
  try {
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : (d?.data || [d]);
  } catch { return []; }
}

// service_fee = ช่องค่าบริการต่อบรรทัด (UI) — ตอนบันทึกจะแตกเป็นบรรทัด "ค่าบริการ..." แยกใน DB (รวม VAT ในตัว) เพื่อให้วางบิลคิดฐาน WHT ถูก
const blankLine = () => ({ income_type: TYPE_ALL, income_code: "", income_name: "", description: "", qty: 1, price_before_discount: 0, discount: 0, service_fee: 0 });

// ดึงเฉพาะ code (ตัวแรกก่อนเว้นวรรค) — "SCY01 สำนักงานใหญ่" → "SCY01"
const stripBranchCode = (v) => String(v || "").trim().split(/\s+/)[0] || "";

const blankHeader = (currentUser) => ({
  receipt_no: "",
  receive_date: todayISO(),
  receipt_type: "",
  receive_status: "ปกติ",
  receipt_status: "ปกติ",
  note: "",
  vat_rate: 0,
  branch_code: stripBranchCode(currentUser?.branch_code || currentUser?.branch || ""),
  branch_name: currentUser?.branch_name || currentUser?.branch || "",
  staff_recorder: currentUser?.name || currentUser?.username || "",
  customer_name: "", customer_address: "", customer_phone: "", customer_id_card: "",
  contract_no: "", contract_date: "", contract_ref: "", contract_status: "",
  brand: "", model_series: "", model_code: "", model_type: "", product_code: "", color: "",
  engine_no: "", chassis_no: "", plate_category: "", plate_number: "", register_date: "", tax_paid_date: "",
});

export default function RegistrationReceiptEntryPage({ currentUser }) {
  const [view, setView] = useState("list"); // list | form
  const [step, setStep] = useState(1);      // wizard: 1 ประเภทงาน/เอกสาร → 2 ข้อมูลรถ → 3 ลูกค้า → 4 รายได้+บันทึก
  // งานต่อภาษี: วันที่คาดว่าจะยื่นขนส่ง — default พฤหัสบดีถัดไปหลังวันรับเรื่อง (ร้านส่งทุกพฤหัส) แก้เองได้
  const [taxSubmitDate, setTaxSubmitDate] = useState("");
  const [regDateSource, setRegDateSource] = useState(""); // บอกที่มาวันจดทะเบียนที่ดึงอัตโนมัติ
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [onlyManual, setOnlyManual] = useState(true);
  const [message, setMessage] = useState("");
  const [header, setHeader] = useState(blankHeader(currentUser));
  const [lines, setLines] = useState([blankLine()]);

  // เดา "วันสิ้นอายุภาษีเดิม" จากวันครบรอบวันจดทะเบียน — ปีที่ครบล่าสุด/กำลังจะครบ (ต่อล่วงหน้าได้ไม่เกิน 90 วัน) แก้ทับได้
  useEffect(() => {
    if (header.receipt_type !== "งานต่อภาษีและพรบ." || !header.register_date || header.tax_paid_date) return;
    const reg = new Date(header.register_date + "T00:00:00");
    if (isNaN(reg)) return;
    const sub = new Date((taxSubmitDate || nextThursday(header.receive_date || todayISO())) + "T00:00:00");
    const cand = new Date(reg);
    cand.setFullYear(sub.getFullYear());
    const limit = new Date(sub);
    limit.setDate(limit.getDate() + 90);
    if (cand > limit) cand.setFullYear(cand.getFullYear() - 1);
    if (cand <= reg) return; // จดปีนี้ ยังไม่ถึงรอบต่อภาษีแรก — ไม่เดา
    setHeader(h => h.tax_paid_date ? h : { ...h, tax_paid_date: localISO(cand) });
    // eslint-disable-next-line
  }, [header.register_date, header.receipt_type]);

  // แยกบรรทัดของงานต่อภาษี: "ค่าต่อภาษี" (ไม่ใช่ตรวจสภาพ) vs "ตรวจสภาพ..."
  // ⚠ ต้องไม่จับบรรทัด "ค่าบริการ..." (บรรทัดแตกจากช่องค่าบริการตอนบันทึก) — ไม่งั้น auto-fill ทับแล้วบันทึกซ้ำจะเบิ้ลรายการ
  const isTaxLine = (l) => { const n = String(l.income_name || ""); return n.includes("ต่อภาษี") && !n.includes("ตรวจ") && !n.startsWith("ค่าบริการ"); };
  const isTroLine = (l) => { const n = String(l.income_name || ""); return n.includes("ตรวจสภาพ") && !n.startsWith("ค่าบริการ"); };

  // งานต่อภาษี: เติมราคาอัตโนมัติ (ทับทุกครั้งที่เข้าขั้นสรุป/วันที่เปลี่ยน/เลือกชื่อรายได้)
  // - "ค่าต่อภาษี": ยอดเก็บลูกค้าเหมา 200 บาท/ปี (1 ปี = 200, 2 ปี = 400, ...) — ราคา = ยอดที่กรมขนส่งเก็บจริง
  //   (ภาษี+เงินเพิ่ม), ค่าบริการ = คำนวณกลับ (200×ปี − ราคา; ขนส่งเก็บเกินเหมา → ค่าบริการ 0)
  // - "ตรวจสภาพ...": ราคา = ค่าตรวจ ตรอ. 60, ค่าบริการ = 190 → รวม 250
  const MC_RENEW_FLAT = 200; // ต่อปี
  const MC_TRO_FLAT = 250;
  const taxLineKey = lines.map(l => (isTaxLine(l) ? "1" : isTroLine(l) ? "2" : "0")).join("");
  useEffect(() => {
    if (step !== 3 || header.receipt_type !== "งานต่อภาษีและพรบ." || !header.tax_paid_date || !/[12]/.test(taxLineKey)) return;
    const r = calcMcTax(header.register_date, header.tax_paid_date, taxSubmitDate || nextThursday(header.receive_date || todayISO()));
    if (!r || r.suspended) return;
    const dltAmount = Math.round((r.taxTotal + r.surcharge) * 100) / 100;
    const flatTotal = MC_RENEW_FLAT * (r.lateYears || 1); // เหมา 200 บาท/ปี ตามจำนวนปีที่ต่อ/ค้าง
    const serviceFee = Math.max(0, Math.round((flatTotal - dltAmount) * 100) / 100);
    setLines(prev => prev.map(l =>
      isTaxLine(l) ? { ...l, price_before_discount: dltAmount, service_fee: serviceFee }
      : isTroLine(l) ? { ...l, price_before_discount: MC_TRO_FEE, service_fee: Math.round((MC_TRO_FLAT - MC_TRO_FEE) * 100) / 100 }
      : l
    ));
    // eslint-disable-next-line
  }, [step, header.receipt_type, header.tax_paid_date, header.register_date, taxSubmitDate, taxLineKey]);

  // งานต่อภาษี: ดึงวันจดทะเบียนอัตโนมัติจากงานส่งจดทะเบียน (registration_submissions — OCR สำเนาทะเบียนหน้ารับคืน/ส่งคืน)
  useEffect(() => {
    const ch = text(header.chassis_no);
    if (header.receipt_type !== "งานต่อภาษีและพรบ." || !ch || header.register_date) { setRegDateSource(""); return; }
    let alive = true;
    const postReg = (body) => fetch(REG_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(r => r.text()).then(t => (t.trim() ? JSON.parse(t) : []));
    const fill = (dateISO, source) => setHeader(h => {
      if (h.register_date || text(h.chassis_no) !== ch) return h;
      setRegDateSource(source);
      return { ...h, register_date: dateISO };
    });
    // 1) วันจดจริงจากงานส่งจดทะเบียน (OCR สำเนาทะเบียน) → 2) fallback ฐานทะเบียนเก่า/ใบขาย ใช้วันขายเป็นค่าประมาณ
    postReg({ action: "get_submissions", chassis_no: ch })
      .then(d => {
        if (!alive || !Array.isArray(d)) return null;
        // เช็คเลขถังซ้ำฝั่งนี้ด้วย — กัน backend เวอร์ชันเก่าที่ยังไม่กรอง chassis_no คืนงานคันอื่นมา
        const hit = d
          .filter(x => x && x.register_date && String(x.chassis_no || "").toUpperCase().trim() === ch.toUpperCase())
          .sort((a, b) => String(b.register_date).localeCompare(String(a.register_date)))[0];
        if (hit) { fill(String(hit.register_date).slice(0, 10), "จากงานส่งจดทะเบียน (OCR สำเนาทะเบียน)"); return true; }
        return null;
      })
      .then(found => {
        if (found || !alive) return;
        return postReg({ action: "search_registrations", field: "chassis_no", keyword: ch }).then(d => {
          if (!alive || !Array.isArray(d)) return;
          // ใช้เฉพาะวันจดจริงจากฐานทะเบียนเก่า (นำเข้าจาก Export ขนส่ง/DMS) — ไม่ประมาณจากวันขาย
          const hit = d.find(x => x && x.register_date && String(x.frame_no || "").toUpperCase().trim() === ch.toUpperCase());
          if (hit) fill(String(hit.register_date).slice(0, 10), "จากฐานทะเบียนเก่า (วันจดจริงจากขนส่ง)");
        });
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [header.chassis_no, header.receipt_type]);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false); // บันทึกสำเร็จแล้ว — ค้างหน้าเดิมให้กดพิมพ์ได้
  // รับชำระเงินใบรับเรื่อง — modal เลือกประเภทการรับชำระ แล้วไปโชว์ในสรุปรายวันรับเงิน (ตามประเภทรับเรื่อง)
  const [payModal, setPayModal] = useState(null); // { date, rows: [{method, amount, account}], note, saving }
  const [bankAccounts, setBankAccounts] = useState([]); // บัญชีรับโอน (โหลดครั้งแรกที่เปิด modal)
  const bankLabelOf = (a) => [a.bank_name, a.account_no, a.account_name].filter(Boolean).join(" · ");
  const PAY_METHODS = ["เงินสด", "เงินโอน", "QR", "อื่นๆ"];

  const linesTotal = () => lines.reduce((s, l) => s + num(l.qty) * num(l.price_before_discount) - num(l.discount) + num(l.service_fee), 0);

  function openPayModal() {
    setPayModal({ date: todayISO(), rows: [{ method: "เงินสด", amount: Math.round(linesTotal() * 100) / 100, account: "" }], note: "", saving: false });
    if (!bankAccounts.length) {
      fetch("https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
      }).then(r => r.json()).then(d => setBankAccounts(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }
  const payTotal = (m) => (m?.rows || []).reduce((s, r) => s + num(r.amount), 0);
  const setPayRow = (i, patch) => setPayModal(m => ({ ...m, rows: m.rows.map((r, j) => j === i ? { ...r, ...patch } : r) }));
  async function saveReceiptPayment() {
    const rows = (payModal?.rows || []).filter(r => num(r.amount) > 0);
    if (!rows.length) { setMessage("❌ ใส่ยอดรับชำระ"); return; }
    if (rows.some(r => r.method === "เงินโอน" && !r.account)) { setMessage("❌ เลือกบัญชีรับโอนเงินของรายการเงินโอนก่อน"); return; }
    const total = rows.reduce((s, r) => s + num(r.amount), 0);
    const methodSum = rows.map(r => r.method).join("+");
    setPayModal(m => ({ ...m, saving: true }));
    try {
      const r = await apiPost({
        action: "save_receipt_payment", receipt_no: header.receipt_no,
        paid_date: payModal.date,
        payments: rows.map(r2 => ({ method: r2.method, amount: num(r2.amount), account: r2.method === "เงินโอน" ? r2.account : "" })),
        payment_note: payModal.note,
        received_by: currentUser?.username || currentUser?.name || "",
      });
      if (!r?.[0]?.receipt_no) throw new Error("workflow ยังไม่รองรับ — re-import Receipt Entry API ก่อน");
      setHeader(h => ({ ...h, paid_at: new Date().toISOString(), paid_date: payModal.date, payment_method: methodSum, paid_amount: total }));
      setPayModal(null);
      setMessage(`✅ รับชำระเงิน ${baht(total)} (${methodSum}) แล้ว — เข้ารายงานสรุปรายวันรับเงินอัตโนมัติ`);
    } catch (e) {
      setMessage("❌ รับชำระไม่สำเร็จ: " + String(e.message || e).slice(0, 150));
      setPayModal(m => m ? { ...m, saving: false } : m);
    }
  }
  async function cancelReceiptPayment() {
    if (!window.confirm(`ยกเลิกการรับชำระของใบ ${header.receipt_no}?`)) return;
    try {
      await apiPost({ action: "cancel_receipt_payment", receipt_no: header.receipt_no });
      setHeader(h => ({ ...h, paid_at: "", paid_date: "", payment_method: "", paid_amount: 0 }));
      setMessage("✅ ยกเลิกการรับชำระแล้ว");
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }
  const [editMode, setEditMode] = useState(false);
  const [searchModal, setSearchModal] = useState(false);
  const [searchKw, setSearchKw] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  // master รายได้ จากตาราง service_expenses (ใช้แทน hardcode INCOME_TYPES)
  const [serviceExpenses, setServiceExpenses] = useState([]);
  async function loadServiceExpenses() {
    try {
      const r = await fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_service_expenses", group_by: "income_type", include_inactive: "false" }) });
      const data = await r.json();
      setServiceExpenses(Array.isArray(data) ? data : []);
    } catch { setServiceExpenses([]); }
  }
  // รายการค่าใช้จ่ายการขาย (ใช้ดึง พรบ. ตาม CC) + ข้อมูลรุ่นรถ (ใช้หา engine_cc จากรุ่น)
  const [saleExpenses, setSaleExpenses] = useState([]);
  const [motoSeries, setMotoSeries] = useState([]);
  async function loadSaleExpenses() {
    try {
      const r = await fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_sale_expenses" }) });
      const data = await r.json();
      setSaleExpenses(Array.isArray(data) ? data : []);
    } catch { setSaleExpenses([]); }
  }
  async function loadMotoSeries() {
    try {
      const r = await fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_series" }) });
      const data = await r.json();
      setMotoSeries(Array.isArray(data) ? data : []);
    } catch { setMotoSeries([]); }
  }
  const [motoTypes, setMotoTypes] = useState([]);
  async function loadMotoTypes() {
    try {
      const r = await fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_types" }) });
      const data = await r.json();
      setMotoTypes(Array.isArray(data) ? data : []);
    } catch { setMotoTypes([]); }
  }
  // จัดรูปแบบเป็น tree: income_type -> [{code, name, amount}] — dedup โดยให้แถวที่มี amount ชนะ
  const incomeTypesMaster = useMemo(() => {
    const map = new Map();
    serviceExpenses.forEach((r) => {
      const t = String(r.income_type || "").trim();
      if (!t) return;
      if (!map.has(t)) map.set(t, []);
      const arr = map.get(t);
      const key = `${r.income_code || ""}|${r.income_name || ""}`;
      const amt = r.income_amount != null && r.income_amount !== "" ? Number(r.income_amount) : null;
      const existing = arr.find((x) => x._key === key);
      if (!existing) {
        arr.push({ _key: key, code: r.income_code || "", name: r.income_name || "", amount: amt });
      } else if (existing.amount == null && amt != null) {
        // อัปเดต amount ถ้าแถวก่อนหน้าเป็น null แต่แถวนี้มีค่า
        existing.amount = amt;
      }
    });
    return Array.from(map.entries()).map(([type, codes]) => ({ type, codes: codes.sort((a,b) => String(a.code).localeCompare(String(b.code))) }));
  }, [serviceExpenses]);

  // หา CC ของรถจาก "รุ่น" (model_series) เทียบกับข้อมูลรุ่นรถ (moto_series.engine_cc)
  const vehicleCC = useMemo(() => {
    const target = normName(header.model_series);
    if (!target) return null;
    const hits = motoSeries.filter((s) => normName(s.series_name) === target || normName(s.marketing_name) === target);
    if (hits.length === 0) return null;
    const tb = normName(header.brand);
    const hit = (tb && hits.find((s) => normName(s.brand_name) === tb)) || hits[0];
    return hit && hit.engine_cc != null && hit.engine_cc !== "" ? Number(hit.engine_cc) : null;
  }, [header.model_series, header.brand, motoSeries]);

  // รายการ พรบ. = ค่าใช้จ่ายการขายแบบ group_by=cc ที่ CC ตรง + ชื่อ/หมวดมีคำว่า "พรบ" + ยังใช้งาน (ในช่วงวันที่)
  const prbCodes = useMemo(() => {
    if (vehicleCC == null) return [];
    const today = todayISO();
    const activeOn = (e) => {
      if (e.status && e.status !== "active") return false;
      const eff = e.effective_date ? String(e.effective_date).slice(0, 10) : null;
      const end = e.end_date ? String(e.end_date).slice(0, 10) : null;
      if (eff && eff > today) return false;
      if (end && end < today) return false;
      return true;
    };
    return saleExpenses
      .filter((e) => e.group_by === "cc" && Number(e.engine_cc) === Number(vehicleCC) && activeOn(e) && (containsPrb(e.expense_name) || containsPrb(e.category)))
      // ราคา = เบี้ย พรบ. จ่ายจริง (amount 323.14) + ค่าบริการ = ส่วนต่างจากราคาเก็บลูกค้า (income_amount 400 → fee 76.86)
      .map((e) => {
        const paid = e.amount != null && e.amount !== "" ? Number(e.amount) : null;
        const collect = e.income_amount != null && e.income_amount !== "" ? Number(e.income_amount) : null;
        const fee = paid != null && collect != null && collect > paid ? Math.round((collect - paid) * 100) / 100 : 0;
        return { _key: `prb-${e.expense_id}`, code: "", name: e.expense_name || "", amount: paid != null ? paid : collect, fee };
      });
  }, [saleExpenses, vehicleCC]);

  // งานต่อภาษี: บรรทัดประเภท "รายได้ พรบ." ที่ยังไม่เลือกชื่อ → เลือกรายการ พรบ. ตาม CC ให้อัตโนมัติ (ราคา+ค่าบริการตามมาสเตอร์)
  const emptyPrbKey = lines.map(l => (l.income_type === TYPE_PRB && !text(l.income_name) ? "1" : "0")).join("");
  useEffect(() => {
    if (step !== 3 || header.receipt_type !== "งานต่อภาษีและพรบ.") return;
    if (!emptyPrbKey.includes("1") || prbCodes.length === 0) return;
    const c = prbCodes[0];
    setLines(prev => prev.map(l =>
      (l.income_type === TYPE_PRB && !text(l.income_name))
        ? { ...l, income_code: c.code || "", income_name: c.name || "", price_before_discount: c.amount ?? 0, service_fee: c.fee ?? 0 }
        : l
    ));
    // eslint-disable-next-line
  }, [step, header.receipt_type, emptyPrbKey, prbCodes]);

  // งานต่อภาษี: เพิ่มบรรทัดอัตโนมัติ — "ค่าต่อภาษี" เสมอ + "ตรวจสภาพ" เมื่อรถเข้าเกณฑ์ ตรอ. (อายุ ≥ 5 ปี)
  useEffect(() => {
    if (step !== 3 || header.receipt_type !== "งานต่อภาษีและพรบ.") return;
    const regCodes = getCodesForType(TYPE_REGISTER);
    const adds = [];
    if (!lines.some(isTaxLine)) {
      const opt = regCodes.find(c => { const n = String(c.name || ""); return n.includes("ต่อภาษี") && !n.includes("ตรวจ"); });
      if (opt) adds.push({ ...blankLine(), income_type: TYPE_REGISTER, income_code: opt.code || "", income_name: opt.name });
    }
    // รถต้องตรวจสภาพ → เพิ่มบรรทัดตรวจสภาพให้ด้วย: เข้าเกณฑ์อายุ (ตรอ.) หรือขาดต่อเกิน 1 ปี (ตรวจที่ขนส่ง)
    // ยกเว้นขาดเกิน 3 ปี (ทะเบียนระงับ) — ต้องเปลี่ยนประเภทงานอยู่แล้ว ไม่เพิ่มให้
    const r = header.tax_paid_date ? calcMcTax(header.register_date, header.tax_paid_date, taxSubmitDate || nextThursday(header.receive_date || todayISO())) : null;
    if ((r?.needTro || (r?.overYear && !r?.suspended)) && !lines.some(isTroLine)) {
      const opt = regCodes.find(c => String(c.name || "").includes("ตรวจสภาพ"));
      if (opt) adds.push({ ...blankLine(), income_type: TYPE_REGISTER, income_code: opt.code || "", income_name: opt.name });
    }
    if (!adds.length) return;
    setLines(prev => [...prev, ...adds.filter(a => !prev.some(l => l.income_name === a.income_name))]);
    // eslint-disable-next-line
  }, [step, header.receipt_type, lines, serviceExpenses, header.tax_paid_date, header.register_date, taxSubmitDate]);

  // รับฝากค่างวด: ชื่อบริษัทดูจากไฟแนนซ์ของรถที่เลือก (contract_ref) — DB สะกด "กรุ๊ปลิส" ก็มี จับทั้ง 2 แบบ
  const depositCodes = useMemo(() => {
    const s = String(header.contract_ref || "");
    const company = /กรุ๊ปล/.test(s) ? "กรุ๊ปลีส" : s.includes("ธนบรรณ") ? "ธนบรรณ" : "";
    return [
      { _key: "dep-inst", code: "", name: company ? `รับฝากค่างวด ${company}` : "รับฝากค่างวด", amount: null },
      // ค่าบริการ: ราคารวม VAT 7% ในตัว (เช่น 15 = ฐาน 14.02 + VAT 0.98) — VAT คิดเฉพาะบรรทัดค่าบริการ ไม่รวมยอดค่างวด
      { _key: "dep-fee", code: "", name: "ค่าบริการ", amount: 15, vatIncluded: true },
      { _key: "dep-close", code: "", name: "ค่าบริการปิดบัญชี", amount: 250, vatIncluded: true },
    ];
  }, [header.contract_ref]);

  // คืน list ชื่อรายได้ตามประเภทที่เลือก — พรบ. ดึงอัตโนมัติตาม CC, อีก 2 ประเภทดึงจาก master
  // ทุกรายการติด rtype = ประเภทจริง เพื่อให้โหมด "ทั้งหมด" stamp ประเภทลง income_type ตอนเลือกชื่อ
  function getCodesForType(label) {
    if (label === TYPE_PRB) return prbCodes.map((c) => ({ ...c, rtype: TYPE_PRB }));
    if (label === TYPE_DEPOSIT) return depositCodes.map((c) => ({ ...c, rtype: TYPE_DEPOSIT }));
    const typeOf = (t) => t.includes("ทะเบียน") ? TYPE_REGISTER : t.includes("ประกัน") ? TYPE_INSURANCE : normalizeIncomeType(t);
    if (label === TYPE_ALL) {
      const out = [];
      incomeTypesMaster.forEach(({ type, codes }) => { codes.forEach((c) => out.push({ ...c, rtype: typeOf(type) })); });
      prbCodes.forEach((c) => out.push({ ...c, rtype: TYPE_PRB }));
      depositCodes.forEach((c) => out.push({ ...c, rtype: TYPE_DEPOSIT }));
      return out;
    }
    const pred = label === TYPE_REGISTER ? (t) => t.includes("ทะเบียน")
              : label === TYPE_INSURANCE ? (t) => t.includes("ประกัน")
              : null;
    if (!pred) return [];
    const out = [];
    incomeTypesMaster.forEach(({ type, codes }) => { if (pred(type)) codes.forEach((c) => out.push({ ...c, rtype: label })); });
    return out;
  }

  async function loadList() {
    setLoading(true);
    try {
      const data = await apiPost({
        action: "list_receipts",
        keyword: search.trim(),
        date_from: dateFrom, date_to: dateTo,
        only_manual: onlyManual,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }
  useEffect(() => { loadList(); loadServiceExpenses(); loadSaleExpenses(); loadMotoSeries(); loadMotoTypes(); /* eslint-disable-next-line */ }, []);

  // เลือกประเภทงานจาก dropdown — prefill ประเภทรายได้บรรทัดแรกถ้ายังไม่เคยกรอกชื่อ/ราคา
  function onJobTypeChange(label) {
    setHeader((h) => ({ ...h, receipt_type: label }));
    const t = JOB_TYPES.find((x) => x.label === label);
    setLines((cur) => {
      const untouched = cur.length === 1 && !cur[0].income_name && !num(cur[0].price_before_discount);
      if (untouched) return [{ ...blankLine(), income_type: t?.defaultIncome || TYPE_ALL }];
      return cur;
    });
  }

  async function openNew() {
    setEditMode(false);
    setHeader(blankHeader(currentUser));
    setLines([blankLine()]);
    setMessage("");
    setJustSaved(false);
    setStep(1);
    setView("form");
    // ขอ next receipt no (ใช้เฉพาะรหัสสาขา ไม่เอาชื่อร้าน)
    const branchCode = stripBranchCode(currentUser?.branch_code || currentUser?.branch || "SCY01");
    try {
      const data = await apiPost({ action: "get_next_receipt_no", branch_code: branchCode });
      const next = data?.[0]?.next_receipt_no;
      if (next) setHeader((h) => ({ ...h, receipt_no: next, branch_code: branchCode }));
    } catch {}
  }

  async function openEdit(r) {
    setEditMode(true);
    setMessage("");
    try {
      const data = await apiPost({ action: "get_receipt", receipt_no: r.receipt_no });
      const item = data?.[0]?.data || data?.[0] || {};
      const h = item.header || {};
      const ls = item.lines || [];
      const nv = normalizeVehicleModel(h, motoTypes);
      setHeader({ ...blankHeader(currentUser), ...h,
        receipt_type: normalizeReceiptType(h.receipt_type),
        brand: nv.brand || h.brand || "",
        model_series: nv.model_series || h.model_series || "",
        model_code: nv.model_code || h.model_code || "",
        model_type: nv.model_type || h.model_type || "",
        receive_date: h.receive_date ? String(h.receive_date).slice(0,10) : todayISO(),
        contract_date: h.contract_date ? String(h.contract_date).slice(0,10) : "",
        register_date: h.register_date ? String(h.register_date).slice(0,10) : "",
        tax_paid_date: h.tax_paid_date ? String(h.tax_paid_date).slice(0,10) : "",
      });
      // ยุบบรรทัด "ค่าบริการX" (ที่ระบบแตกไว้ตอนบันทึก) กลับเข้าช่องค่าบริการของบรรทัดแม่ X
      // — กันเปิดแก้ไขแล้วบันทึกซ้ำทำให้บรรทัดเบิ้ล (เช่น ค่าบริการต่อภาษี โดน auto-fill กลายเป็นบรรทัดใหม่)
      const mergedLines = (() => {
        const src = ls.map((l) => ({ ...blankLine(), ...l, income_type: normalizeIncomeType(l.income_type), vat_included: String(l.description || "").includes("รวม VAT") }));
        const out = [];
        const feeUsed = new Set();
        for (let i = 0; i < src.length; i++) {
          const l = src[i];
          if (feeUsed.has(i)) continue;
          const nm = String(l.income_name || "");
          if (nm.startsWith("ค่าบริการ")) { out.push(l); continue; }
          // หา "ค่าบริการ<ชื่อบรรทัดนี้ตัดคำว่า ค่า>" ที่ยังไม่ถูกใช้ → ดึงมาเป็นค่าบริการของบรรทัดนี้
          const feeName = `ค่าบริการ${nm.replace(/^ค่า/, "").trim()}`;
          const j = src.findIndex((f, k) => k > i && !feeUsed.has(k) && String(f.income_name || "") === feeName && String(f.description || "").includes("รวม VAT"));
          if (j >= 0) {
            feeUsed.add(j);
            out.push({ ...l, service_fee: num(src[j].price_before_discount) * num(src[j].qty || 1) });
          } else {
            out.push(l);
          }
        }
        return out;
      })();
      setLines(mergedLines.length ? mergedLines : [blankLine()]);
      setJustSaved(false);
      setStep(1);
      setView("form");
    } catch (e) {
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
  }

  function openSearchModal() {
    const seed = text(header.chassis_no) || text(header.engine_no) || text(header.plate_number) || "";
    setSearchKw(seed);
    setSearchResults([]);
    setSearched(false);
    setSearchModal(true);
  }

  async function runSearch() {
    const kw = text(searchKw);
    if (!kw) { setMessage("ใส่คำค้นหาก่อน"); return; }
    setSearching(true);
    setSearched(false);
    try {
      const data = await apiPost({ action: "search_similar", keyword: kw });
      // n8n คืน item ว่าง {} เมื่อไม่พบข้อมูล — กรองทิ้งกันแถวขีดว่างโผล่ในตาราง
      const list = (Array.isArray(data) ? data : []).filter((r) => r && (r.chassis_no || r.engine_no || r.customer_name || r.ref_no));
      // ซ้ำ = เลขถัง + เลขเครื่อง ตรงกันทั้งคู่ → แสดงแหล่งเดียว เรียงความสำคัญ: ขายปลีก (ระบบใหม่) > ใบขาย moto_sales > รับเรื่อง
      const PRIORITY = { retail: 3, sale: 2, receipt: 1 };
      const best = new Map();
      const noKey = [];
      list.forEach((r) => {
        const ch = String(r.chassis_no || "").trim().toUpperCase();
        const en = String(r.engine_no || "").trim().toUpperCase();
        if (!ch && !en) { noKey.push(r); return; }
        const key = ch + "|" + en;
        const cur = best.get(key);
        const p = PRIORITY[r.source] || 0;
        const cp = cur ? (PRIORITY[cur.source] || 0) : -1;
        if (!cur || p > cp || (p === cp && String(r.ref_date || "") > String(cur.ref_date || ""))) best.set(key, r);
      });
      setSearchResults([...best.values(), ...noKey]);
      setSearched(true);
    } catch {
      setSearchResults([]);
      setSearched(true);
    }
    setSearching(false);
  }

  function pickResult(s) {
    const nv = normalizeVehicleModel(s, motoTypes);
    setHeader((h) => ({ ...h,
      chassis_no: s.chassis_no || h.chassis_no,
      engine_no: s.engine_no || h.engine_no,
      customer_name: s.customer_name || h.customer_name,
      customer_address: s.customer_address || h.customer_address,
      customer_phone: s.customer_phone || h.customer_phone,
      customer_id_card: s.customer_id_card || h.customer_id_card,
      brand: nv.brand || s.brand || h.brand,
      model_series: nv.model_series || s.model_series || h.model_series,
      model_code: nv.model_code || s.model_code || h.model_code,
      model_type: nv.model_type || s.model_type || h.model_type,
      product_code: s.product_code || h.product_code,
      color: s.color_name || s.color || h.color,
      plate_category: s.plate_category || h.plate_category,
      plate_number: s.plate_number || h.plate_number,
      contract_ref: s.contract_ref || h.contract_ref,
      // จากระบบขายใหม่ (retail_sales) มีข้อมูลผ่อนมาด้วย — เก็บไว้โชว์ในสรุป
      installment_amount: s.installment_amount ?? h.installment_amount,
      installments: s.installments ?? h.installments,
    }));
    setSearchModal(false);
    setMessage(`✅ ดึงข้อมูลจาก ${s.source === "sale" ? "moto_sales" : s.source === "retail" ? "ใบขายปลีก" : "ประวัติรับเรื่อง"} แล้ว`);
  }

  // legacy: direct lookup ตามเดิม (เผื่อมีโค้ดอื่นเรียก) — แต่ตอนนี้ใช้ openSearchModal แทน
  async function lookupSale() {
    const chassis = text(header.chassis_no);
    const engine = text(header.engine_no);
    if (!chassis && !engine) { setMessage("ใส่เลขถังหรือเลขเครื่องก่อน"); return; }
    setMessage("🔍 กำลังค้นหา...");
    try {
      const data = await apiPost({ action: "lookup_sale", chassis_no: chassis, engine_no: engine });
      const s = data?.[0];
      if (!s || !s.chassis_no) { setMessage("ℹ️ ไม่พบข้อมูลขายที่ตรงกับเลขถัง/เลขเครื่องนี้"); return; }
      const nv = normalizeVehicleModel(s, motoTypes);
      setHeader((h) => ({ ...h,
        chassis_no: s.chassis_no || h.chassis_no,
        engine_no: s.engine_no || h.engine_no,
        customer_name: s.customer_name || h.customer_name,
        customer_address: s.customer_address || h.customer_address,
        customer_phone: s.customer_phone || h.customer_phone,
        customer_id_card: s.customer_id_card || h.customer_id_card,
        brand: nv.brand || s.brand || h.brand,
        model_series: nv.model_series || s.model_series || h.model_series,
        model_code: nv.model_code || s.model_code || h.model_code,
        model_type: nv.model_type || s.model_type || h.model_type,
        product_code: s.product_code || h.product_code,
        color: s.color_name || s.color || h.color,
        plate_category: s.plate_category || h.plate_category,
        plate_number: s.plate_number || h.plate_number,
        contract_ref: s.contract_ref || h.contract_ref,
      }));
      setMessage("✅ ดึงข้อมูลจาก moto_sales สำเร็จ");
    } catch (e) {
      setMessage("❌ ค้นหาไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
  }

  function updateLine(i, patch) { setLines((arr) => arr.map((l, idx) => idx === i ? { ...l, ...patch } : l)); }
  function addLine() { setLines((arr) => [...arr, blankLine()]); }
  function removeLine(i) { setLines((arr) => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr); }

  // เลือกรหัส → auto-fill ชื่อ + ราคา (จาก master service_expenses)
  function onSelectIncomeCode(i, codeKey) {
    const t = incomeTypesMaster.find((x) => x.type === lines[i].income_type);
    const c = t?.codes.find((x) => x._key === codeKey);
    updateLine(i, {
      income_code: c?.code || "",
      income_name: c?.name || "",
      price_before_discount: c?.amount != null ? c.amount : (lines[i].price_before_discount || 0),
    });
  }
  // เลือก income_type → reset code/name
  function onSelectIncomeType(i, type) {
    updateLine(i, { income_type: type, income_code: "", income_name: "" });
  }

  const lineTotal = useMemo(() => lines.reduce((s, l) => s + (num(l.qty) * num(l.price_before_discount) - num(l.discount) + num(l.service_fee)), 0), [lines]);
  // VAT ที่รวมอยู่ในค่าบริการ (ช่องค่าบริการต่อบรรทัด + บรรทัดที่ติดธงรวม VAT ในตัว) — โชว์เป็นข้อมูล ไม่บวกเพิ่มในยอดรวม
  const vatInFees = useMemo(() => lines.reduce((s, l) => {
    const fee = num(l.service_fee);
    let v = fee > 0 ? fee - fee / 1.07 : 0;
    if (l.vat_included) {
      const net = num(l.qty) * num(l.price_before_discount) - num(l.discount);
      v += net - net / 1.07;
    }
    return s + v;
  }, 0), [lines]);
  const vatRate = num(header.vat_rate);
  const priceBeforeVat = vatRate > 0 ? lineTotal / (1 + vatRate/100) : lineTotal;
  const vat = lineTotal - priceBeforeVat;

  async function handleSave() {
    if (!text(header.receipt_no)) { setMessage("❌ ไม่มีเลขที่รับเรื่อง"); return; }
    if (!text(header.customer_name)) { setMessage("❌ ใส่ชื่อลูกค้า"); return; }
    if (!text(header.chassis_no)) { setMessage("❌ ใส่เลขถัง"); return; }
    if (lines.length === 0 || lines.every(l => !num(l.price_before_discount) && !num(l.service_fee))) { setMessage("❌ เพิ่มรายการรายได้อย่างน้อย 1"); return; }
    // แตกช่องค่าบริการเป็นบรรทัดแยกใน DB — ชื่อขึ้นต้น "ค่าบริการ" (ฐาน WHT ตอนวางบิล) + รวม VAT 7% ในตัว
    const expandedLines = [];
    lines.filter(l => num(l.price_before_discount) || num(l.service_fee)).forEach(l => {
      const { service_fee, ...rest } = l;
      if (num(l.price_before_discount)) expandedLines.push(rest);
      const fee = num(service_fee);
      if (fee > 0) {
        const parent = String(l.income_name || "").replace(/^ค่า/, "").trim();
        expandedLines.push({
          income_type: l.income_type, income_code: "",
          income_name: parent ? `ค่าบริการ${parent}` : "ค่าบริการ",
          description: "รวม VAT 7%", qty: 1, price_before_discount: fee, discount: 0,
        });
      }
    });
    // ไม่บังคับเลือกประเภทงาน — ถ้าไม่ได้เลือก เดาจากประเภทรายได้ในรายการให้อัตโนมัติ
    let receiptType = text(header.receipt_type);
    if (!receiptType) {
      const ts = new Set(lines.filter(l => l.income_name || num(l.price_before_discount)).map(l => l.income_type));
      receiptType = ts.has(TYPE_PRB) ? "งานต่อภาษีและพรบ."
                  : ts.has(TYPE_INSURANCE) ? "งานประกัน"
                  : ts.has(TYPE_REGISTER) ? (text(header.plate_number) ? "งานโอนทะเบียน" : "งานทะเบียนรถใหม่")
                  : "อื่นๆ";
    }
    setSaving(true);
    setMessage("");
    try {
      const data = await apiPost({
        action: "save_receipt",
        header: { ...header, receipt_type: receiptType, created_by: currentUser?.username || currentUser?.name || "system" },
        lines: expandedLines,
      });
      if (data?.[0]?.message && /missing|error/i.test(data[0].message)) throw new Error(data[0].message);
      // ค้างหน้าเดิมหลังบันทึก — ให้กดพิมพ์ได้ กด "← กลับ" เองเมื่อเสร็จ
      setHeader((h) => ({ ...h, receipt_type: receiptType }));
      setJustSaved(true);
      setMessage("✅ บันทึกสำเร็จ — กดพิมพ์ได้เลย หรือกด ← กลับ เพื่อไปหน้ารายการ");
      await loadList();
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + String(e.message || e).slice(0, 200));
    }
    setSaving(false);
  }

  // พิมพ์ใบรับเรื่อง — เปิดหน้าต่างใหม่แล้วสั่ง print
  function printReceipt() {
    const rows = lines.filter((l) => l.income_name || num(l.price_before_discount) || num(l.service_fee));
    const rowsHtml = rows.map((l, i) => {
      const net = num(l.qty) * num(l.price_before_discount) - num(l.discount) + num(l.service_fee);
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${l.income_name || "-"}${l.description ? ` <span style="color:#666;font-size:11px">(${l.description})</span>` : ""}</td>
        <td style="text-align:right">${num(l.qty)}</td>
        <td style="text-align:right">${baht(num(l.price_before_discount))}</td>
        <td style="text-align:right">${num(l.service_fee) > 0 ? baht(num(l.service_fee)) : "-"}</td>
        <td style="text-align:right;font-weight:bold">${baht(net)}</td>
      </tr>`;
    }).join("");
    const vatRow = vatInFees > 0 ? `<tr><td colspan="5" style="text-align:right;color:#666;font-size:11px;border:none">ภาษีมูลค่าเพิ่มรวมในค่าบริการ (7% — รวมในยอดแล้ว)</td><td style="text-align:right;color:#666;font-size:11px;border:none">${baht(vatInFees)}</td></tr>` : "";
    const w = window.open("", "_blank");
    if (!w) { setMessage("❌ เปิดหน้าต่างพิมพ์ไม่ได้ — อนุญาต popup ก่อน"); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบรับเรื่อง ${header.receipt_no}</title>
      <style>
        body { font-family: Tahoma, sans-serif; font-size: 13px; margin: 24px; color: #111; }
        h2 { margin: 0 0 2px; font-size: 18px; }
        .muted { color: #555; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 20px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #999; padding: 5px 8px; font-size: 12px; }
        th { background: #eee; }
        .total td { font-weight: bold; background: #f7f7f7; }
        .sign { display: flex; justify-content: space-around; margin-top: 44px; text-align: center; font-size: 12px; }
        @media print { body { margin: 10mm; } }
      </style></head><body>
      <h2>📥 ใบรับเรื่องงานทะเบียน</h2>
      <div class="muted">เลขที่ <b>${header.receipt_no || "-"}</b> · วันที่ ${fmtBE(header.receive_date) || "-"} · สาขา ${header.branch_code || "-"} · ประเภทงาน ${header.receipt_type || "-"}</div>
      <div class="grid">
        <div><span class="muted">ลูกค้า:</span> <b>${header.customer_name || "-"}</b> ${header.customer_phone ? `(${header.customer_phone})` : ""}</div>
        <div><span class="muted">รถ:</span> <b>${[header.brand, header.model_series, header.color].filter(Boolean).join(" · ") || "-"}</b></div>
        <div><span class="muted">เลขถัง:</span> ${header.chassis_no || "-"} · <span class="muted">เลขเครื่อง:</span> ${header.engine_no || "-"}</div>
        <div><span class="muted">ทะเบียน:</span> ${[header.plate_category, header.plate_number].filter(Boolean).join(" ") || "-"}</div>
        ${header.contract_ref ? `<div><span class="muted">ไฟแนนซ์:</span> ${header.contract_ref}${num(header.installment_amount) > 0 ? ` · ค่างวด ${baht(num(header.installment_amount))}${num(header.installments) > 0 ? ` × ${num(header.installments)} งวด` : ""}` : ""}</div>` : ""}
      </div>
      <table>
        <thead><tr><th style="width:34px">#</th><th>รายการ</th><th style="width:60px">จำนวน</th><th style="width:90px">ราคา</th><th style="width:80px">ค่าบริการ</th><th style="width:100px">สุทธิ</th></tr></thead>
        <tbody>${rowsHtml}
          <tr class="total"><td colspan="5" style="text-align:right">รวมทั้งสิ้น</td><td style="text-align:right;font-size:14px">${baht(lineTotal)}</td></tr>
          ${vatRow}
        </tbody>
      </table>
      ${header.note ? `<div style="margin-top:8px"><span class="muted">หมายเหตุ:</span> ${header.note}</div>` : ""}
      <div class="sign">
        <div>ลงชื่อ ______________________ ผู้รับเรื่อง<br/>(${header.staff_recorder || "&nbsp;"})</div>
        <div>ลงชื่อ ______________________ ลูกค้า<br/>&nbsp;</div>
      </div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  async function handleDelete(r) {
    if (!window.confirm(`ยกเลิก ${r.receipt_no}?`)) return;
    try {
      await apiPost({ action: "delete_receipt", receipt_no: r.receipt_no });
      setMessage(`✅ ยกเลิก ${r.receipt_no} แล้ว`);
      await loadList();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  // ===== Styles =====
  const card = { background: "#fff", padding: 16, borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" };
  const inp = { width: "100%", padding: "7px 10px", border: "1.5px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
  const btn = { padding: "8px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600 };
  const btnPri = { ...btn, background: "#2563eb", color: "#fff" };
  const btnGreen = { ...btn, background: "#16a34a", color: "#fff" };
  const btnGray = { ...btn, background: "#e5e7eb", color: "#374151" };
  const btnSm = { padding: "3px 8px", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, color: "#fff", margin: "0 2px" };
  const th = { padding: "8px 10px", background: "#f1f5f9", textAlign: "left", fontWeight: 700, fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0" };
  const td = { padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 13 };
  const sec = { fontSize: 14, fontWeight: 700, color: "#0369a1", marginBottom: 8, paddingBottom: 6, borderBottom: "2px solid #e0f2fe" };

  if (view === "form") {
    const STEP_NAMES = ["ข้อมูลรถ", "ข้อมูลลูกค้า", "รายได้/สรุป"];
    const jobType = JOB_TYPES.find((t) => t.label === header.receipt_type) || null;
    // เดินหน้าได้ต่อเมื่อขั้นปัจจุบันผ่านเงื่อนไข
    // ประเภทงานไม่บังคับตอนกดถัดไป (เลือกทีหลังได้ — handleSave ยังเช็คก่อนบันทึกอยู่)
    const canNext = step === 1 ? !!text(header.chassis_no)
                  : step === 2 ? !!text(header.customer_name)
                  : false;
    const nextHint = step === 1 ? "ใส่เลขถังก่อน" : step === 2 ? "ใส่ชื่อลูกค้าก่อน" : "";
    return (
      <div style={{ padding: 20, background: "#fbf7f1", minHeight: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0, color: "#333" }}>📥 {editMode ? "แก้ไข" : "สร้าง"}รับเรื่องงานทะเบียน</h2>
          <button onClick={() => setView("list")} style={btnGray}>← กลับ</button>
        </div>

        {/* แถบขั้นตอน — ขั้นที่ผ่านแล้วกดย้อนได้ */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          {STEP_NAMES.map((name, i) => {
            const n = i + 1;
            const active = n === step, done = n < step;
            return (
              <React.Fragment key={n}>
                {i > 0 && <span style={{ color: "#9ca3af" }}>›</span>}
                <button onClick={() => done && setStep(n)}
                  style={{ border: "none", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontFamily: "Tahoma",
                    cursor: done ? "pointer" : "default", fontWeight: active ? 700 : 500,
                    background: active ? "#2563eb" : done ? "#dbeafe" : "#e5e7eb",
                    color: active ? "#fff" : done ? "#1e40af" : "#6b7280" }}>
                  {done ? "✓ " : `${n}. `}{name}
                </button>
              </React.Fragment>
            );
          })}
          {jobType && step > 1 && (
            <span style={{ marginLeft: "auto", fontSize: 13, background: "#fef3c7", color: "#92400e", padding: "5px 12px", borderRadius: 999, fontWeight: 700 }}>
              {jobType.icon} {jobType.label}
            </span>
          )}
        </div>

        {message && <div style={{ padding: "8px 14px", marginBottom: 12, background: message.startsWith("✅") ? "#dcfce7" : message.startsWith("ℹ️") ? "#dbeafe" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : message.startsWith("ℹ️") ? "#1e40af" : "#991b1b", borderRadius: 6, fontSize: 14 }}>{message}</div>}

        {/* ===== ขั้น 1a: การ์ดเลือกประเภทงานก่อน — เลือกแล้วค่อยเปิดฟอร์มค้นหา/กรอกข้อมูลรถ ===== */}
        {step === 1 && !header.receipt_type && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ ...sec, textAlign: "center" }}>📌 เลือกประเภทงานรับเรื่อง</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 12 }}>
            {JOB_TYPES.map(t => (
              <div key={t.label} onClick={() => onJobTypeChange(t.label)}
                onMouseOver={e => { e.currentTarget.style.borderColor = "#072d6b"; e.currentTarget.style.background = "#f0f6ff"; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.background = "#fff"; }}
                style={{ border: "1.5px solid #d1d5db", borderRadius: 12, padding: "22px 14px", textAlign: "center", cursor: "pointer", background: "#fff", transition: "all .15s" }}>
                <div style={{ fontSize: 34 }}>{t.icon}</div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* ===== ขั้น 1b: ข้อมูลเอกสาร (เปลี่ยนประเภทได้จาก dropdown) + ข้อมูลรถ ===== */}
        {step === 1 && header.receipt_type && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={sec}>📌 ข้อมูลเอกสาร</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
            <Field label="เลขที่รับเรื่อง *"><input value={header.receipt_no} onChange={e => setHeader({ ...header, receipt_no: e.target.value })} style={{ ...inp, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }} readOnly={!editMode} /></Field>
            <Field label="วันที่รับเรื่อง *"><input type="date" value={header.receive_date} onChange={e => setHeader({ ...header, receive_date: e.target.value })} style={inp} /></Field>
            <Field label="ประเภทงาน *">
              <select value={header.receipt_type} onChange={e => onJobTypeChange(e.target.value)} style={inp}>
                <option value="">— เลือกประเภทงาน —</option>
                {JOB_TYPES.map(t => <option key={t.label} value={t.label}>{t.icon} {t.label}</option>)}
                {header.receipt_type === "อื่นๆ" && <option value="อื่นๆ">📄 อื่นๆ (เอกสารเก่า)</option>}
              </select>
            </Field>
            <Field label="สาขา *"><input value={header.branch_code} onChange={e => setHeader({ ...header, branch_code: stripBranchCode(e.target.value) })} style={inp} placeholder="SCY01" /></Field>
            <Field label="พนักงาน"><input value={header.staff_recorder} onChange={e => setHeader({ ...header, staff_recorder: e.target.value })} style={inp} /></Field>
            <Field label="VAT (%)"><input type="number" value={header.vat_rate} onChange={e => setHeader({ ...header, vat_rate: e.target.value })} style={inp} placeholder="0" /></Field>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <div style={sec}>🏍️ ข้อมูลรถ</div>
            <button onClick={openSearchModal} style={{ ...btn, background: "#0ea5e9", color: "#fff", fontSize: 12, padding: "6px 12px" }}>🔍 ค้นหาข้อมูลรถ/ลูกค้า</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <Field label="เลขถัง *"><input value={header.chassis_no} onChange={e => setHeader({ ...header, chassis_no: e.target.value.toUpperCase() })} style={{ ...inp, fontFamily: "monospace" }} /></Field>
            <Field label="เลขเครื่อง"><input value={header.engine_no} onChange={e => setHeader({ ...header, engine_no: e.target.value.toUpperCase() })} style={{ ...inp, fontFamily: "monospace" }} /></Field>
            <Field label={header.receipt_type === "งานทะเบียนรถใหม่" ? "ทะเบียน (เว้นได้ — รถใหม่ยังไม่มีป้าย)" : "ทะเบียน (หมวด + เลข)"}>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={header.plate_category} onChange={e => setHeader({ ...header, plate_category: e.target.value })} style={{ ...inp, flex: "0 0 90px" }} placeholder="หมวด" title="หมวด เช่น 2 กช" />
                <input value={header.plate_number} onChange={e => setHeader({ ...header, plate_number: e.target.value })} style={{ ...inp, flex: 1 }} placeholder="เลขทะเบียน" title="เลขทะเบียน เช่น 5205" />
              </div>
            </Field>
            <Field label="ยี่ห้อ"><input value={header.brand} onChange={e => setHeader({ ...header, brand: e.target.value })} style={inp} /></Field>
            <Field label="รุ่น"><input value={header.model_series} onChange={e => setHeader({ ...header, model_series: e.target.value })} style={inp} /></Field>
            <Field label="แบบ"><input value={header.model_code} onChange={e => setHeader({ ...header, model_code: e.target.value })} style={inp} /></Field>
            <Field label="type"><input value={header.model_type} onChange={e => setHeader({ ...header, model_type: e.target.value })} style={inp} /></Field>
            <Field label="สี"><input value={header.color} onChange={e => setHeader({ ...header, color: e.target.value })} style={inp} /></Field>
          </div>

          {/* ===== งานต่อภาษี: คำนวณเงินเพิ่ม + เกณฑ์ตรวจสภาพ (เฉพาะมอเตอร์ไซค์) — โชว์เมื่อเลือกรถแล้ว ===== */}
          {header.receipt_type === "งานต่อภาษีและพรบ." && text(header.chassis_no) && (() => {
            const submitDate = taxSubmitDate || nextThursday(header.receive_date || todayISO());
            const r = header.tax_paid_date ? calcMcTax(header.register_date, header.tax_paid_date, submitDate) : null;
            return (
              <div style={{ marginTop: 14, padding: 12, background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 10 }}>
                <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 10 }}>🧾 คำนวณภาษี/เงินเพิ่ม (มอเตอร์ไซค์ · ภาษีปีละ {MC_TAX_PER_YEAR} บาท)</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                  <Field label={`วันจดทะเบียน${regDateSource && header.register_date ? " ✓ ดึงอัตโนมัติ" : " (จากเล่ม)"}`}>
                    <BEDateInput value={header.register_date} onChange={v => { setRegDateSource(""); setHeader(h => ({ ...h, register_date: v })); }}
                      style={{ ...inp, ...(regDateSource && header.register_date ? { borderColor: "#10b981", background: "#f0fdf4" } : {}) }}
                      title={regDateSource || "กรอกจากเล่มทะเบียน (พ.ศ.) ถ้าระบบหาไม่เจอ"} />
                    {header.register_date && <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>พ.ศ. {fmtBE(header.register_date)}</div>}
                  </Field>
                  <Field label="วันสิ้นอายุภาษีเดิม * (พ.ศ.)">
                    <BEDateInput value={header.tax_paid_date} onChange={v => setHeader(h => ({ ...h, tax_paid_date: v }))} style={inp} />
                    {header.tax_paid_date && <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>พ.ศ. {fmtBE(header.tax_paid_date)}</div>}
                  </Field>
                  <Field label="วันที่คาดว่าจะยื่นขนส่ง (พฤหัสถัดไป · พ.ศ.)">
                    <BEDateInput value={submitDate} onChange={v => setTaxSubmitDate(v)} style={inp} />
                    {submitDate && <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>พ.ศ. {fmtBE(submitDate)}</div>}
                  </Field>
                </div>
                {r && (
                  <div style={{ marginTop: 10, padding: 10, background: "#fff", borderRadius: 8, fontSize: 13, lineHeight: 1.9 }}>
                    {r.suspended ? (
                      <div style={{ color: "#dc2626", fontWeight: 700 }}>
                        🚫 ขาดต่อภาษีเกิน 3 ปี — ทะเบียนถูกระงับแล้ว ต้องคืนป้าย+จดทะเบียนใหม่ (เปลี่ยนประเภทงาน) · ภาษีค้าง+เงินเพิ่มยังต้องชำระสูงสุด 3 ปี
                      </div>
                    ) : (
                      <>
                        <div>
                          💰 ภาษี {r.lateYears || 1} ปี = <b>{baht(r.taxTotal)}</b> บาท
                          {r.surcharge > 0 && <> · เงินเพิ่ม (1%/เดือน) = <b style={{ color: "#dc2626" }}>{baht(r.surcharge)}</b> บาท{r.lateYears === 1 ? ` (ล่าช้า ${r.months} เดือน)` : ` (ค้าง ${r.lateYears} ปี)`}</>}
                          {r.needTro && <> · ค่าตรวจ ตรอ. = <b>{baht(MC_TRO_FEE)}</b> บาท</>}
                          <span style={{ marginLeft: 8, fontWeight: 700, color: "#065f46" }}>
                            รวมประมาณ {baht(r.taxTotal + r.surcharge + (r.needTro ? MC_TRO_FEE : 0))} บาท (ยังไม่รวม พ.ร.บ. + ค่าบริการ)
                          </span>
                        </div>
                        <div>
                          {r.age != null && <>🏍️ อายุรถ ~{r.age} ปี → {r.needTro ? <b style={{ color: "#b45309" }}>ต้องตรวจสภาพ ตรอ. (อายุ ≥ {MC_TRO_AGE} ปี)</b> : "ไม่ต้องตรวจสภาพ"}</>}
                          {r.age == null && <span style={{ color: "#9ca3af" }}>กรอกวันจดทะเบียนเพื่อเช็คเกณฑ์ตรวจสภาพ (อายุ ≥ {MC_TRO_AGE} ปี)</span>}
                          {r.overYear && !r.suspended && <b style={{ color: "#dc2626", marginLeft: 8 }}>⚠️ ขาดต่อเกิน 1 ปี — ต้องตรวจสภาพที่สำนักงานขนส่ง (ตรอ. ไม่ได้)</b>}
                        </div>
                        <div style={{ color: "#6b7280", fontSize: 11 }}>สิ้นอายุภาษีรอบใหม่: {fmtBE(r.newExpire)} · คำนวณ ณ วันยื่น {fmtBE(submitDate)} (เศษของเดือนนับเป็น 1 เดือน)</div>
                      </>
                    )}
                  </div>
                )}
                {!r && <div style={{ marginTop: 8, fontSize: 12, color: "#92400e" }}>กรอก "วันสิ้นอายุภาษีเดิม" เพื่อคำนวณเงินเพิ่มอัตโนมัติ</div>}
              </div>
            );
          })()}
        </div>
        )}

        {/* ===== ขั้น 2: ข้อมูลลูกค้า ===== */}
        {step === 2 && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={sec}>👤 ข้อมูลลูกค้า</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <Field label="ชื่อลูกค้า *"><input value={header.customer_name} onChange={e => setHeader({ ...header, customer_name: e.target.value })} style={inp} /></Field>
            <Field label="โทร"><input value={header.customer_phone} onChange={e => setHeader({ ...header, customer_phone: e.target.value })} style={inp} /></Field>
            <Field label="เลขบัตรประชาชน"><input value={header.customer_id_card} onChange={e => setHeader({ ...header, customer_id_card: e.target.value })} style={inp} /></Field>
            <Field label="สัญญาเช่าซื้อ/ไฟแนนซ์"><input value={header.contract_ref} onChange={e => setHeader({ ...header, contract_ref: e.target.value })} style={inp} /></Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <Field label="ที่อยู่"><input value={header.customer_address} onChange={e => setHeader({ ...header, customer_address: e.target.value })} style={inp} /></Field>
          </div>
        </div>
        )}

        {/* ===== ขั้น 3: รายการรายได้ + สรุป ===== */}
        {step === 3 && (<>
        <div style={{ ...card, marginBottom: 14, background: "#f8fafc" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "4px 16px", fontSize: 13 }}>
            <div><span style={{ color: "#6b7280" }}>เลขที่:</span> <b style={{ fontFamily: "monospace", color: "#0369a1" }}>{header.receipt_no || "-"}</b></div>
            <div><span style={{ color: "#6b7280" }}>ประเภท:</span> <b>{jobType ? `${jobType.icon} ${jobType.label}` : "-"}</b></div>
            <div><span style={{ color: "#6b7280" }}>รถ:</span> <b>{[header.brand, header.model_series, header.color].filter(Boolean).join(" · ") || "-"}</b> <span style={{ fontFamily: "monospace", fontSize: 11 }}>{header.chassis_no}</span></div>
            <div><span style={{ color: "#6b7280" }}>ลูกค้า:</span> <b>{header.customer_name || "-"}</b> {header.customer_phone && <span style={{ color: "#6b7280" }}>({header.customer_phone})</span>}</div>
            <div>
              <span style={{ color: "#6b7280" }}>ไฟแนนซ์:</span> <b style={{ color: header.contract_ref ? "#7c3aed" : "#9ca3af" }}>{header.contract_ref || "— เงินสด/ไม่มีข้อมูล —"}</b>
              {num(header.installment_amount) > 0 && (
                <span style={{ marginLeft: 8, color: "#b91c1c", fontWeight: 700 }}>
                  ค่างวด {baht(num(header.installment_amount))}{num(header.installments) > 0 ? ` × ${num(header.installments)} งวด` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={sec}>💰 รายการรายได้</div>
            <button onClick={addLine} style={{ ...btn, background: "#16a34a", color: "#fff", fontSize: 12, padding: "6px 12px" }}>➕ เพิ่มรายการ</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>ประเภท</th>
                  <th style={th}>ชื่อรายได้</th>
                  <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
                  <th style={{ ...th, textAlign: "right" }}>ราคา</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าบริการ</th>
                  <th style={{ ...th, textAlign: "right" }}>สุทธิ</th>
                  <th style={{ ...th, textAlign: "center" }}>—</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  // สุทธิ = จำนวน×ราคา + ค่าบริการ (− ส่วนลดเดิมถ้าเป็นเอกสารเก่า)
                  const net = num(l.qty) * num(l.price_before_discount) - num(l.discount) + num(l.service_fee);
                  const codes = getCodesForType(l.income_type);
                  // หา selected key เฉพาะเมื่อ income_name ถูกเลือกแล้ว — ไม่ default ไปรายการแรก
                  const selectedKey = l.income_name
                    ? (codes.find(c => c.code === l.income_code && c.name === l.income_name)?._key
                       || codes.find(c => c.name === l.income_name)?._key
                       || "")
                    : "";
                  return (
                    <tr key={i}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>
                        <select value={l.income_type} onChange={e => onSelectIncomeType(i, e.target.value)} style={{ ...inp, padding: "5px 8px", fontSize: 12 }}>
                          <option value="">— เลือกประเภท —</option>
                          {FIXED_INCOME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td style={td}>
                        <select value={selectedKey} onChange={e => {
                          const opt = e.target.options[e.target.selectedIndex];
                          const amtStr = opt?.dataset?.amount || "";
                          const amt = amtStr !== "" ? Number(amtStr) : null;
                          const vatInc = opt?.dataset?.vatinc === "1";
                          const feeStr = opt?.dataset?.fee || "";
                          const fee = feeStr !== "" ? Number(feeStr) : null;
                          updateLine(i, {
                            income_code: opt?.dataset?.code || "",
                            income_name: opt?.dataset?.name || "",
                            // โหมด "ทั้งหมด": stamp ประเภทจริงของรายการที่เลือกลง income_type (รายงาน/บันทึกใช้ประเภทจริง)
                            ...(opt?.dataset?.type ? { income_type: opt.dataset.type } : {}),
                            price_before_discount: amt != null && !Number.isNaN(amt) ? amt : (l.price_before_discount || 0),
                            // ค่าบริการ default ของรายการ (เช่น พรบ. = ราคาเก็บ − เบี้ยจริง) — เปลี่ยนรายการแล้ว reset ตาม default ใหม่
                            service_fee: fee != null && !Number.isNaN(fee) ? fee : 0,
                            // ค่าบริการรับฝาก: ราคารวม VAT ในตัว — ติดธง + note ลง description ให้ติดไปกับใบเสร็จ
                            vat_included: vatInc,
                            description: vatInc ? "รวม VAT 7%" : (l.description === "รวม VAT 7%" ? "" : l.description),
                          });
                        }} style={{ ...inp, padding: "5px 8px", fontSize: 12, minWidth: 220 }} disabled={!l.income_type}>
                          <option value="" data-amount="" data-code="" data-name="" data-type="" data-vatinc="" data-fee="">— เลือกชื่อรายได้ —</option>
                          {codes.map(c => (
                            <option key={c._key} value={c._key} data-amount={c.amount ?? ""} data-code={c.code || ""} data-name={c.name || ""} data-type={c.rtype || ""} data-vatinc={c.vatIncluded ? "1" : ""} data-fee={c.fee ?? ""}>{l.income_type === TYPE_ALL && c.rtype ? `${c.name} (${c.rtype.replace("รายได้", "").trim() || c.rtype})` : c.name}</option>
                          ))}
                        </select>
                        {l.income_type === TYPE_PRB && vehicleCC == null && (
                          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>⚠️ ไม่พบ CC ของรุ่น "{header.model_series || "-"}" — เลือก/แก้รุ่นรถก่อน</div>
                        )}
                        {l.income_type === TYPE_PRB && vehicleCC != null && codes.length === 0 && (
                          <div style={{ fontSize: 11, color: "#b45309", marginTop: 3 }}>ไม่มีรายการ พรบ. สำหรับ {vehicleCC} cc</div>
                        )}
                      </td>
                      <td style={td}><input type="number" value={l.qty} onChange={e => updateLine(i, { qty: e.target.value })} style={{ ...inp, padding: "5px 8px", fontSize: 12, textAlign: "right", maxWidth: 70 }} /></td>
                      <td style={td}><input type="number" value={l.price_before_discount} onChange={e => updateLine(i, { price_before_discount: e.target.value })} style={{ ...inp, padding: "5px 8px", fontSize: 12, textAlign: "right" }} /></td>
                      <td style={td}><input type="number" value={l.service_fee} onChange={e => updateLine(i, { service_fee: e.target.value })} style={{ ...inp, padding: "5px 8px", fontSize: 12, textAlign: "right", maxWidth: 80 }} title="ค่าบริการ (รวม VAT ในตัว) — ตอนบันทึกแยกเป็นบรรทัดค่าบริการให้อัตโนมัติ" /></td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: net > 0 ? "#dc2626" : "#9ca3af" }}>{baht(net)}</td>
                      <td style={{ ...td, textAlign: "center" }}><button onClick={() => removeLine(i)} style={{ ...btnSm, background: "#ef4444" }}>✕</button></td>
                    </tr>
                  );
                })}
                <tr style={{ background: "#fef3c7" }}>
                  <td colSpan={6} style={{ ...td, textAlign: "right", fontWeight: 700 }}>รวม</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, fontSize: 15, color: "#dc2626" }}>{baht(lineTotal)}</td>
                  <td style={td}></td>
                </tr>
                {vatInFees > 0 && (
                  <tr>
                    <td colSpan={6} style={{ ...td, textAlign: "right", color: "#6b7280", fontSize: 12 }}>ภาษีมูลค่าเพิ่มรวมในค่าบริการ (7% — รวมในยอดแล้ว)</td>
                    <td style={{ ...td, textAlign: "right", color: "#6b7280", fontSize: 12 }}>{baht(vatInFees)}</td>
                    <td style={td}></td>
                  </tr>
                )}
                {vatRate > 0 && <>
                  <tr><td colSpan={6} style={{ ...td, textAlign: "right" }}>ราคาก่อน VAT</td><td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{baht(priceBeforeVat)}</td><td style={td}></td></tr>
                  <tr><td colSpan={6} style={{ ...td, textAlign: "right" }}>VAT {vatRate}%</td><td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{baht(vat)}</td><td style={td}></td></tr>
                </>}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ ...card, marginBottom: 14 }}>
          <Field label="หมายเหตุ"><textarea value={header.note} onChange={e => setHeader({ ...header, note: e.target.value })} style={{ ...inp, minHeight: 60 }} /></Field>
        </div>
        </>)}

        {/* ปุ่มนำทาง wizard */}
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", padding: "10px 0", flexWrap: "wrap" }}>
          <div>
            {step > 1 && <button onClick={() => setStep(step - 1)} style={btnGray}>← ย้อนกลับ</button>}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setView("list")} style={{ ...btn, background: "transparent", color: "#6b7280" }}>ยกเลิก</button>
            {step < 3 && (
              <button onClick={() => canNext && setStep(step + 1)} disabled={!canNext} title={canNext ? "" : nextHint}
                style={{ ...btnPri, opacity: canNext ? 1 : 0.45, cursor: canNext ? "pointer" : "not-allowed" }}>
                ถัดไป →
              </button>
            )}
            {step === 3 && (justSaved || editMode) && (
              <button onClick={printReceipt} style={{ ...btn, background: "#7c3aed", color: "#fff" }}>🖨️ พิมพ์</button>
            )}
            {step === 3 && (justSaved || editMode) && (
              header.paid_at ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "#d1fae5", color: "#065f46", fontSize: 13, fontWeight: 600 }}>
                  ✓ รับชำระแล้ว {baht(num(header.paid_amount))} ({header.payment_method || "-"} · {fmtBE(header.paid_date)})
                  <button onClick={cancelReceiptPayment} title="ยกเลิกการรับชำระ (คีย์ผิด)"
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>✕</button>
                </span>
              ) : (
                <button onClick={openPayModal} style={{ ...btn, background: "#059669", color: "#fff" }}>💵 รับชำระเงิน</button>
              )
            )}
            {step === 3 && (
              <button onClick={handleSave} disabled={saving} style={{ ...btnGreen, opacity: saving ? 0.6 : 1 }}>{saving ? "กำลังบันทึก..." : "💾 บันทึก"}</button>
            )}
          </div>
        </div>

        {/* modal รับชำระเงินใบรับเรื่อง */}
        {payModal && (
          <div onClick={() => !payModal.saving && setPayModal(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 22, width: 420, maxWidth: "92vw" }}>
              <h3 style={{ margin: "0 0 12px", color: "#059669" }}>💵 รับชำระเงิน — {header.receipt_no}</h3>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 }}>
                ประเภทงาน: <b>{header.receipt_type || "-"}</b> · ลูกค้า: <b>{header.customer_name || "-"}</b> · ยอดตามใบ: <b>{baht(linesTotal())}</b>
              </div>
              <Field label="วันที่รับเงิน *">
                <input type="date" value={payModal.date} onChange={e => setPayModal(m => ({ ...m, date: e.target.value }))} style={inp} />
              </Field>
              <div style={{ margin: "10px 0" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>วิธีรับชำระ * (เพิ่มได้หลายวิธี)</div>
                {payModal.rows.map((r3, i3) => (
                  <div key={i3} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", marginBottom: 6, background: "#f9fafb" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select value={r3.method} onChange={e => setPayRow(i3, { method: e.target.value, account: "" })} style={{ ...inp, width: 110, flex: "0 0 auto" }}>
                        {PAY_METHODS.map(m2 => <option key={m2} value={m2}>{m2}</option>)}
                      </select>
                      <input type="number" step="0.01" placeholder="ยอด (บาท)" value={r3.amount}
                        onChange={e => setPayRow(i3, { amount: e.target.value })}
                        style={{ ...inp, flex: 1, textAlign: "right", fontWeight: 700 }} />
                      {payModal.rows.length > 1 && (
                        <button onClick={() => setPayModal(m => ({ ...m, rows: m.rows.filter((_, j) => j !== i3) }))}
                          style={{ border: "none", background: "#fee2e2", color: "#b91c1c", borderRadius: 6, width: 28, height: 28, cursor: "pointer", flex: "0 0 auto" }}>✕</button>
                      )}
                    </div>
                    {r3.method === "เงินโอน" && (
                      <div style={{ marginTop: 6 }}>
                        <select value={r3.account} onChange={e => setPayRow(i3, { account: e.target.value })}
                          style={{ ...inp, background: r3.account ? "#fff" : "#fffbeb" }}>
                          <option value="">— เลือกบัญชีรับโอน —</option>
                          {bankAccounts.map(a => (
                            <option key={a.id || bankLabelOf(a)} value={bankLabelOf(a)}>{bankLabelOf(a)}</option>
                          ))}
                        </select>
                        {!bankAccounts.length && <div style={{ fontSize: 12, color: "#92400e", marginTop: 3 }}>กำลังโหลดรายชื่อบัญชี...</div>}
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={() => setPayModal(m => ({ ...m, rows: [...m.rows, { method: "เงินโอน", amount: Math.max(0, Math.round((linesTotal() - payTotal(m)) * 100) / 100), account: "" }] }))}
                  style={{ border: "1px dashed #059669", background: "#f0fdf4", color: "#047857", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>
                  ＋ เพิ่มวิธีรับชำระ
                </button>
                <div style={{ textAlign: "right", marginTop: 8, fontSize: 14 }}>
                  รวมรับชำระ: <b style={{ color: Math.abs(payTotal(payModal) - linesTotal()) < 0.01 ? "#059669" : "#b45309" }}>{baht(payTotal(payModal))}</b>
                  {" "}/ ยอดตามใบ {baht(linesTotal())}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <Field label="หมายเหตุ">
                  <input value={payModal.note} onChange={e => setPayModal(m => ({ ...m, note: e.target.value }))} style={inp} placeholder="เช่น เลขอ้างอิงโอน" />
                </Field>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={saveReceiptPayment} disabled={payModal.saving}
                  style={{ flex: 1, padding: "9px 0", background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15 }}>
                  {payModal.saving ? "กำลังบันทึก..." : "✓ บันทึกรับชำระ"}
                </button>
                <button onClick={() => setPayModal(null)} disabled={payModal.saving}
                  style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15 }}>
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}

        {searchModal && (
          <div onClick={() => setSearchModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 10, width: "min(960px, 96vw)", maxHeight: "88vh", overflow: "auto", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0ea5e9", color: "#fff" }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>🔍 ค้นหาข้อมูลรถ/ลูกค้า</div>
                <button onClick={() => setSearchModal(false)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <input autoFocus value={searchKw} onChange={(e) => setSearchKw(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runSearch()}
                    placeholder="เลขเครื่อง / เลขถัง / ทะเบียน / ชื่อลูกค้า"
                    style={{ ...inp, fontSize: 14, flex: 1 }} />
                  <button onClick={runSearch} disabled={searching} style={{ ...btnPri, padding: "8px 18px" }}>
                    {searching ? "กำลังค้น..." : "🔍 ค้นหา"}
                  </button>
                </div>

                {searched && searchResults.length === 0 && (
                  <div style={{ padding: 20, background: "#fef3c7", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: "#92400e", marginBottom: 10 }}>ℹ️ ไม่พบข้อมูลที่ตรงกับ <b>"{searchKw}"</b></div>
                    <button onClick={() => { setSearchModal(false); setMessage("กรอกข้อมูลรถ/ลูกค้าด้วยตนเอง"); }} style={{ ...btnGreen, padding: "8px 18px" }}>➕ เพิ่มข้อมูลเอง</button>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={th}>แหล่ง</th>
                          <th style={th}>เลขถัง</th>
                          <th style={th}>เลขเครื่อง</th>
                          <th style={th}>ทะเบียน</th>
                          <th style={th}>ลูกค้า</th>
                          <th style={th}>รถ</th>
                          <th style={th}>วันที่</th>
                          <th style={{ ...th, textAlign: "center" }}>—</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.map((s, i) => (
                          <tr key={i} style={{ background: s.source === "sale" ? "#f0f9ff" : s.source === "retail" ? "#f5f3ff" : "#fef9c3" }}>
                            <td style={td}>
                              <span style={{ background: s.source === "sale" ? "#dbeafe" : s.source === "retail" ? "#ede9fe" : "#fef3c7", color: s.source === "sale" ? "#1e40af" : s.source === "retail" ? "#6d28d9" : "#a16207", padding: "2px 8px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                                {s.source === "sale" ? "ขาย" : s.source === "retail" ? "ขายปลีก" : "รับเรื่อง"}
                              </span>
                            </td>
                            <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{s.chassis_no || "-"}</td>
                            <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{s.engine_no || "-"}</td>
                            <td style={td}>{[s.plate_category, s.plate_number].filter(Boolean).join(" ") || "-"}</td>
                            <td style={td}>{s.customer_name || "-"}</td>
                            <td style={td}>{[s.brand, s.model_series, s.model_code].filter(Boolean).join(" · ") || "-"}</td>
                            <td style={td}>{fmtBE(s.ref_date)}</td>
                            <td style={{ ...td, textAlign: "center" }}>
                              <button onClick={() => pickResult(s)} style={{ ...btnSm, background: "#16a34a", padding: "4px 12px" }}>✓ เลือก</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 12, textAlign: "center", padding: 10, background: "#f1f5f9", borderRadius: 6 }}>
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>ไม่ตรงกับที่ต้องการ?</div>
                      <button onClick={() => { setSearchModal(false); setMessage("กรอกข้อมูลรถ/ลูกค้าด้วยตนเอง"); }} style={{ ...btnGreen, padding: "6px 16px", fontSize: 13 }}>➕ เพิ่มข้อมูลเอง</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== List view =====
  return (
    <div style={{ padding: 20, background: "#fbf7f1", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 24, color: "#333" }}>📥 รับเรื่องงานทะเบียน</h2>
        <button onClick={openNew} style={btnPri}>➕ สร้างใหม่</button>
      </div>

      {message && <div style={{ padding: "8px 14px", marginBottom: 12, background: message.startsWith("✅") ? "#dcfce7" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b", borderRadius: 6, fontSize: 14 }}>{message}</div>}

      <div style={{ ...card, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 เลขที่/ลูกค้า/เลขถัง/เครื่อง" style={{ ...inp, maxWidth: 280 }} onKeyDown={e => e.key === "Enter" && loadList()} />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inp, maxWidth: 160 }} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inp, maxWidth: 160 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={onlyManual} onChange={e => setOnlyManual(e.target.checked)} />
          เฉพาะที่บันทึก manual
        </label>
        <button onClick={loadList} style={btnPri}>ค้นหา</button>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>{rows.length} รายการ</span>
      </div>

      <div style={card}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>เลขที่รับเรื่อง</th>
                <th style={th}>วันที่</th>
                <th style={th}>สาขา</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>เลขถัง</th>
                <th style={th}>รุ่น</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                <th style={th}>สถานะ</th>
                <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด...</td></tr>
                : rows.length === 0 ? <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>ยังไม่มีข้อมูล</td></tr>
                : rows.map(r => (
                  <tr key={r.receipt_no}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.receipt_no}</td>
                    <td style={td}>{fmtBE(r.receive_date)}</td>
                    <td style={td}><span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>{r.branch_code || "-"}</span></td>
                    <td style={td}>{r.customer_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                    <td style={td}>{[r.brand, r.model_series, r.model_code].filter(Boolean).join(" · ") || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{baht(r.line_total || r.total)}</td>
                    <td style={td}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: r.receipt_status === "ยกเลิก" ? "#fee2e2" : "#dcfce7", color: r.receipt_status === "ยกเลิก" ? "#991b1b" : "#15803d" }}>{r.receipt_status || "ปกติ"}</span>
                      {r.entry_source === "manual" && <span style={{ marginLeft: 4, fontSize: 10, padding: "1px 5px", background: "#dbeafe", color: "#1e40af", borderRadius: 3, fontWeight: 700 }}>manual</span>}
                    </td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                      <button onClick={() => openEdit(r)} style={{ ...btnSm, background: "#f59e0b" }}>✏️</button>
                      <button onClick={() => handleDelete(r)} style={{ ...btnSm, background: "#ef4444" }}>🗑️</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", marginBottom: 3, fontSize: 12, fontWeight: 600, color: "#475569" }}>{label}</label>
      {children}
    </div>
  );
}
