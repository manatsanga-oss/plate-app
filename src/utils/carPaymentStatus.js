// Logic สถานะรับชำระเงินรายคัน — ใช้ร่วมกันระหว่าง CarPaymentReportPage และ PayDepositPage (tab โอนเงินเกิน)
// ข้อมูลแถว r มาจาก action list_car_payment_receipts (accounting-report-api)

// ยอดตัดรับ FT เข้าใบกำกับ = เฉพาะค่ารถ (paid_vehicle_price) ถ้ามี breakdown — ค่าส่งเสริมไม่นับเป็นค่าสินค้า
export const ftPaid = (r) => r.paid_vehicle_price != null ? Number(r.paid_vehicle_price) : Number(r.paid_from_amount || 0);
// ยอดรับชำระรวม = daily_receipts + FT (เฉพาะส่วนค่ารถ)
export const combinedPaid = (r) => Number(r.total_paid || 0) + ftPaid(r);

// รถที่ขายก่อน 1 พ.ค. 2569 (2026-05-01) = ข้อมูลเก่า/ยกมา → ถือว่าชำระครบแล้วเสมอ (ไม่นับเป็นค้างชำระ)
export const PAID_CUTOFF_ISO = "2026-05-01";
export const isPreCutoff = (r) => {
  const d = String(r.sale_date || r.invoice_date || "").slice(0, 10);
  return d !== "" && d < PAID_CUTOFF_ISO;
};

// จำแนกยี่ห้อ (เหมือน SalesByPaymentReportPage): sale_brand → chassis prefix → model_code → model name
export const detectBrand = (r) => {
  const brand = (r.sale_brand || "").toLowerCase();
  if (brand.includes("honda") || brand.includes("ฮอนด้า")) return "honda";
  if (brand.includes("yamaha") || brand.includes("ยามาฮ่า")) return "yamaha";
  const chassis = String(r.chassis_no || "").toUpperCase();
  if (chassis.startsWith("MLHJ") || chassis.startsWith("LALHJ")) return "honda";
  if (chassis.startsWith("MLE") || chassis.startsWith("MH3")) return "yamaha";
  const mc = String(r.sale_model_code || "").toUpperCase();
  if (/^(AC|AF|AN|JC|JF|KF|KC|WW)/.test(mc)) return "honda";
  if (/^(BK|BJ|BG|BD|BF|DT|GW)/.test(mc)) return "yamaha";
  const mn = String(r.model_name || "").toLowerCase();
  if (/(wave|click|scoopy|pcx|cbr|crf|adv|forza|cb150|nice|monkey|msx|grom|giorno|lead|super cub)/i.test(mn)) return "honda";
  if (/(fino|fazzio|aerox|finn|grand filano|exciter|nmax|m-slaz|tricity|jupiter|yzf|wr)/i.test(mn)) return "yamaha";
  return null;
};

// กฎบวกเพิ่มค่านำพา: Honda ทุก 500 บาท → +2,000 | Yamaha ทุก 500 บาท → +1,000
export const deliveryFeeBonus = (r) => {
  const fee = Number(r.delivery_fee_amount || 0);
  if (fee <= 0) return 0;
  const brand = detectBrand(r);
  const multiplier = brand === "honda" ? 2000 : brand === "yamaha" ? 1000 : 0;
  return Math.floor(fee / 500) * multiplier;
};

// หา markup ที่เข้าเงื่อนไขกับแถวขายนี้ (กฎเดียวกับหน้ารายงานการขายตามการชำระเงิน)
export function getMarkups(r, markups) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[\s\(\)\[\]\.\-_]/g, "").trim();
  const finN = norm(r.sale_finance_company);
  const inv = r.sale_invoice_no || r.tax_invoice_no || "";
  const brand = (r.sale_brand || r.matched_brand || r.brand || "").toLowerCase();
  const modelCode = (r.sale_model_code || r.model_code || "").toLowerCase();
  const branchGroup = (() => {
    const bc = (r.branch_code || (r.sale_invoice_no || "").slice(0, 5) || "").toUpperCase();
    if (["SCY05", "SCY06"].includes(bc)) return "papao";
    if (["SCY01", "SCY04", "SCY07"].includes(bc)) return "singchai";
    return "all";
  })();
  const finMatch = (m) => {
    if (!finN || !m.finance_company) return false;
    const mN = norm(m.finance_company);
    return mN === finN || mN.includes(finN) || finN.includes(mN);
  };
  const branchCode = (r.branch_code || (r.sale_invoice_no || "").slice(0, 5) || "").toUpperCase();
  const extractCC = (txt) => {
    if (!txt) return null;
    const matches = String(txt).match(/\d{3,4}/g) || [];
    for (const m of matches) {
      const v = parseInt(m, 10);
      if (v >= 75 && v <= 2500) return v;
    }
    return null;
  };
  const saleCC = Number(r.sale_engine_cc) || extractCC(r.sale_model_code) || extractCC(r.model_code) || extractCC(r.model_name) || null;
  return (markups || []).filter(m => {
    if (m.markup_type === "finance") return finMatch(m);
    if (m.markup_type === "finance_cc") {
      if (!finMatch(m)) return false;
      if (m.branch_group && m.branch_group !== branchCode) return false;
      if (saleCC !== null) {
        if (m.cc_min && saleCC < Number(m.cc_min)) return false;
        if (m.cc_max && saleCC > Number(m.cc_max)) return false;
      }
      return true;
    }
    if (m.markup_type === "installment_bonus") return inv && m.sale_invoice_no === inv;
    if (m.markup_type === "cosmos_insurance") return inv && m.sale_invoice_no === inv;
    if (m.markup_type === "other_income") return inv && m.sale_invoice_no === inv;
    if (m.markup_type === "custom") {
      if (m.brand && m.brand.toLowerCase() !== brand) return false;
      if (m.model_code && m.model_code.toLowerCase() !== modelCode) return false;
      if (m.branch_group && m.branch_group !== "all" && m.branch_group !== branchGroup) return false;
      return true;
    }
    return false;
  });
}

// ผลรวมรายการบวกเพิ่ม (other_income หักออก) — ไม่รวมค่านำพา
export const markupSum = (r, markups) => getMarkups(r, markups).reduce((s, m) => {
  const amt = Number(m.markup_amount || 0);
  return m.markup_type === "other_income" ? s - amt : s + amt;
}, 0);

// ยอดที่ควรเก็บตามกฎ = ราคาประกาศ + รายการบวกเพิ่ม + บวกเพิ่มค่านำพา (มีเมื่อรู้ราคาประกาศ)
export const expectedByRule = (r, markups) => {
  const sp = Number(r.sale_price || 0);
  if (sp <= 0) return null;
  return sp + markupSum(r, markups) + deliveryFeeBonus(r);
};

// สถานะ: paid = ครบพอดี / paid_delivery = ส่วนเกิน = บวกเพิ่มค่านำพาพอดี /
//         paid_rule = รับชำระตรงกับ ราคาประกาศ+บวกเพิ่ม+ค่านำพา / over = ชำระเกิน / unpaid = ยังไม่ครบ
export const statusOf = (r, markups) => {
  if (isPreCutoff(r)) return "paid"; // ขายก่อน 1 พ.ค. 2569 → ชำระครบเสมอ
  const total = Number(r.total_amount || 0);
  if (total <= 0) return "unpaid";
  const combined = combinedPaid(r);
  const diff = total - combined;
  // ต่างกันไม่ถึง 0.99 บาท (เศษสตางค์/ปัดเศษ) ถือว่าครบ
  if (diff >= 0.99) return "unpaid";
  if (diff > -0.99) return "paid";
  const bonus = deliveryFeeBonus(r);
  if (bonus > 0 && Math.abs(-diff - bonus) <= 0.01) return "paid_delivery";
  const exp = expectedByRule(r, markups);
  if (exp != null && Math.abs(combined - exp) <= 0.01) return "paid_rule";
  return "over";
};

// ยอดชำระเกิน (เงินรับฝากไว้รอโอนคืนไฟแนนท์) = รับชำระรวม − ยอดใบกำกับ
export const overAmount = (r) => combinedPaid(r) - Number(r.total_amount || 0);
