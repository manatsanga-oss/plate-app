// รายงานลูกหนี้ตามเอกสาร (เมนู Accounting → บัญชี → ลูกหนี้ตามเอกสาร) — user 2026-11-13 ส่งรายงาน Flow "ลูกหนี้ตามเอกสาร" ณ 30/09/69 ทั้ง 2 สังกัดเป็นต้นแบบ
// แยกตรรกะไว้ที่ไฟล์นี้ (ไม่มี React) เพื่อให้รันตรวจยอดด้วย node ได้ — คู่กับ accountsPayable.js
//
// หลักคิด "ณ วันที่ D": เอกสารลงวันที่ ≤ D ที่ยังไม่ได้รับเงิน หรือรับเงินหลังวัน D = ยังเป็นลูกหนี้ ณ วันนั้น
// แหล่งข้อมูล:
//   1) ลูกหนี้ไฟแนนซ์ (ขายรถจัดไฟแนนซ์) — ใบกำกับภาษีขายรถ (list-tax-invoices: PAPAO / NAKORNLUANG / SINGCHAI รายเดือน) เป็นตัวตั้ง
//        วันที่เอกสาร = วันที่ใบกำกับ (ไม่ใช่วันขาย — Flow ตั้งลูกหนี้ตามเดือนใบกำกับ เช่น ขาย 29/09 ออกใบกำกับ ต.ค. = ลูกหนี้ ต.ค.)
//        ยอดที่ไฟแนนซ์ต้องโอน = ยอดจัดไฟแนนซ์ − ประกันรถหายที่ไฟแนนซ์หักจากยอดโอน (จากใบขาย NEW: finance_amount − theft_insurance_amount)
//        รับเงิน = รายการตัดรับเงินโอนไฟแนนท์ (accounting-api list_finance_transfers → matched_items รายคัน) ใช้ "วันที่โอน" (transfer_date) ไม่ใช่วันที่กดตัดรับ
//        คันที่มีเงินโอนเข้าแล้วถือว่ารับครบ — ส่วนต่างที่เหลือ (ค่าธรรมเนียม/ดอกเบี้ยที่ไฟแนนซ์หัก เช่น ธนบรรณ ~3.85%, SGF) ไม่ใช่ลูกหนี้ · ติ๊ก "แสดงยอดโอนขาด" เพื่อดูได้
//   2) รายได้อื่น — finance-api income_record op list (ค่าส่งเสริม/ค่าเคลม/ค่าโฆษณา ฯลฯ): ยอด total (รวม VAT ก่อนหัก ณ ที่จ่าย) · วันรับ paid_at (เวลาไทย)
// ยังไม่รวม: ขายอะไหล่/บริการเงินเชื่อ · ขายส่งอะไหล่ (69WHSL) · ขายระหว่างบริษัท · ลูกค้าเงินสดค้างชำระ
// สังกัด: ลูกหนี้ไฟแนนซ์ = บริษัทที่ออกใบกำกับ (PAPAO + NAKORNLUANG = ป.เปา · SINGCHAI = สิงห์ชัย) · รายได้อื่น = ช่อง affiliation ของใบ
// วันครบกำหนด = วันที่เอกสาร (เหมือน Flow)
// เริ่มใบกำกับ 01/09/69 (ระบบตัดรับเงินโอนไฟแนนท์ + ใบขาย NEW ใช้ครบตั้งแต่ ก.ย.69) · รายได้อื่นดึงตั้งแต่ 01/01/69 แต่นับเป็นลูกหนี้เฉพาะใบตั้งแต่ 01/06/69 (AR_INCOME_START)
// ตรวจกับ Flow ณ 30/09/69 — ลูกหนี้ไฟแนนซ์ตรงทุกบรรทัด:
//   ป.เปา: คาเธ่ย์ 53,600 · เน็คซ์ SCY01 704,600 / SCY04 169,900 / SCY06 151,400 — สิงห์ชัย: คาเธ่ย์ 70,000 · เน็คซ์ SCY01 845,900 / SCY04 102,600
//   รายได้อื่นตรง: ไทยฮอนด้า 2,185.14 + 9,630 · ไทยยามาฮ่า 481.50 + 3,840 · อยุธยา แคปปิตอล 100
//   ระบบมีเพิ่มจาก Flow (ใบที่ระบบลงวันที่ก่อน Flow / บันทึกย้อนหลัง): ไทยยามาฮ่า 3,395 + 2,440 + 160.50 · อยุธยา 2,478.24
//   Flow มีแต่ระบบไม่มี: หจก.สิงห์ชัย 1,027.20 (ขายระหว่างบริษัท) · เงินสด 180 (ค้างเก่าปี 67)

const N8N = "https://n8n-new-project-gwf2.onrender.com/webhook/";
export const AR_START = "2026-09-01";
// ใบรายได้อื่นลงวันที่ก่อนวันนี้ถือว่ารับเงินครบแล้ว (user 2026-11-13: "เดือน 4-5 น่าจะชำระหมดแล้ว" — ใบ เม.ย.–พ.ค.69 ค้างในระบบเพราะยังไม่ได้บันทึกรับเงิน ไม่ใช่ลูกหนี้จริง) · ติ๊กแสดงได้
export const AR_INCOME_START = "2026-06-01";
export const AR_COMPANIES = ["ป.เปา", "สิงห์ชัย"];
export const AR_COMPANY_FULL = { "ป.เปา": "บริษัท ป.เปา มอเตอร์เซอร์วิส จำกัด", "สิงห์ชัย": "ห้างหุ้นส่วนจำกัด สิงห์ชัยสยามยนต์" };
export const AR_SOURCES = { finance: { label: "ขายรถ (ไฟแนนซ์)" }, income: { label: "รายได้อื่น" } };
export const AR_BUCKETS = [
  { key: "current", label: "ยังไม่เกินกำหนด" },
  { key: "d30", label: "1-30 วัน" },
  { key: "d60", label: "31-60 วัน" },
  { key: "d90", label: "61-90 วัน" },
  { key: "over", label: "มากกว่า 90 วัน" },
];
const TAX_COMPANIES = [["PAPAO", "ป.เปา"], ["NAKORNLUANG", "ป.เปา"], ["SINGCHAI", "สิงห์ชัย"]];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const compOfName = (v) => (/สิงห์ชัย/.test(String(v || "")) ? "สิงห์ชัย" : /เปา/.test(String(v || "")) ? "ป.เปา" : "");
const bkkDate = (v) => {
  if (!v) return "";
  const s = String(v);
  if (!s.includes("T")) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d) ? s.slice(0, 10) : d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
};
const addDaysIso = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((new Date(a + "T00:00:00Z") - new Date(b + "T00:00:00Z")) / 86400000);
const cleanName = (v) => String(v || "").replace(/\s+/g, " ").trim();
const nk = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
// คีย์จัดกลุ่มลูกค้า: ตัดคำนำหน้า/ต่อท้ายนิติบุคคลออก — "บจก. ไทยยามาฮ่ามอเตอร์" กับ "บริษัท ไทยยามาฮ่ามอเตอร์ จำกัด" ต้องรวมเป็นรายเดียว
export const customerKey = (v) => cleanName(v).replace(/^(บริษัท|บจก\.?|บมจ\.?|หจก\.?|ห้างหุ้นส่วนจำกัด)\s*/, "").replace(/\s*(จำกัด\s*\(มหาชน\)|\(มหาชน\)|จำกัด|สำนักงานใหญ่)\s*/g, "").replace(/\s+/g, "");

async function post(path, body) {
  const res = await fetch(N8N + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = (await res.text()).trim();
  if (!t) return [];
  let j; try { j = JSON.parse(t); } catch { return []; }
  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.data)) return j.data;
  return j ? [j] : [];
}

/** โหลดเอกสารลูกหนี้ทุกแหล่งที่ลงวันที่ไม่เกิน asOf (ยังไม่กรองว่ารับเงินแล้วหรือยัง) */
export async function loadReceivableDocs({ asOf, onProgress = () => {} }) {
  const docs = [];
  const info = { financeNoSale: 0 };

  // ---- 1) ลูกหนี้ไฟแนนซ์ ----
  onProgress("ใบขาย…");
  const sales = (await post("retail-sale-api", { action: "list_retail_sales", date_from: addDaysIso(AR_START, -45), date_to: asOf, limit: 6000 }))
    .filter((r) => r && r.invoice_no && String(r.sale_status || "10") !== "90");
  const saleByNo = new Map(sales.map((r) => [String(r.invoice_no).trim(), r]));
  const saleByChassis = new Map(sales.filter((r) => nk(r.chassis_no)).map((r) => [nk(r.chassis_no), r]));

  onProgress("เงินโอนไฟแนนท์…");
  const fts = await post("accounting-api", { action: "list_finance_transfers", match_status: "" });
  const payByInv = new Map(), payByChassis = new Map();
  const push = (m, k, v) => { if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const f of fts) {
    if (!f || String(f.status || "active") !== "active") continue;
    const date = bkkDate(f.transfer_date);
    for (const it of Array.isArray(f.matched_items) ? f.matched_items : []) {
      const p = { date, amount: num(it.vehicle_price != null ? it.vehicle_price : it.amount), ref: f.doc_no || "" };
      push(payByInv, String(it.tax_invoice_no || "").trim(), p);
      push(payByChassis, nk(it.chassis_no), p);
    }
  }

  // ใบกำกับรายเดือน ตั้งแต่เดือนของ AR_START ถึงเดือนของ asOf — ทีละเดือน (3 บริษัทพร้อมกัน) กัน n8n รับคำขอพร้อมกันมากเกิน
  const months = [];
  for (let y = Number(AR_START.slice(0, 4)), m = Number(AR_START.slice(5, 7)); `${y}-${String(m).padStart(2, "0")}` <= asOf.slice(0, 7); m === 12 ? (y++, m = 1) : m++) months.push([y, m]);
  for (const [y, m] of months) {
    onProgress(`ใบกำกับ ${String(m).padStart(2, "0")}/${y + 543}…`);
    const lists = await Promise.all(TAX_COMPANIES.map(([br]) => post("list-tax-invoices", { action: "list_tax_invoices", branch: br, year_month: `${y + 543}${String(m).padStart(2, "0")}` })));
    lists.forEach((list, ci) => {
      const company = TAX_COMPANIES[ci][1];
      for (const t of list) {
        if (!t || !t.tax_invoice_no || String(t.status || "active") !== "active") continue;
        const docDate = bkkDate(t.invoice_date);
        if (!docDate || docDate < AR_START || docDate > asOf) continue;
        const sale = saleByNo.get(String(t.sale_invoice_no || "").trim()) || saleByChassis.get(nk(t.chassis_no));
        const fin = cleanName(t.sale_finance_company || sale?.finance_company_name);
        if (!fin) continue;                                   // ขายสด — ไม่ใช่ลูกหนี้ไฟแนนซ์
        if (!sale) { info.financeNoSale++; continue; }        // ใบกำกับจัดไฟแนนซ์ที่หาใบขาย NEW ไม่เจอ (ขายผ่านระบบเก่า) — ไม่รู้ยอดจัด
        const financeAmt = num(sale.finance_amount), theft = num(sale.theft_insurance_amount);
        if (financeAmt <= 0) continue;
        const invNo = String(t.tax_invoice_no).trim();
        const payments = (payByInv.get(invNo) || payByChassis.get(nk(t.chassis_no)) || []).filter((p) => p.date).sort((a, b) => a.date.localeCompare(b.date));
        docs.push({
          key: `fin-${TAX_COMPANIES[ci][0]}-${t.id || invNo}`, source: "finance", company, customer: fin, doc_no: invNo, doc_date: docDate, due_date: docDate,
          doc_total: r2(t.total_amount), receivable: r2(financeAmt - theft), payments,
          desc: [String(t.branch_codes || sale.branch_code || "").slice(0, 5), sale.invoice_no, cleanName(sale.customer_name), cleanName(sale.model_name)].filter(Boolean).join(" · "),
          note: theft > 0 ? `ยอดจัด ${financeAmt.toLocaleString("th-TH")} − ประกันรถหาย ${theft.toLocaleString("th-TH")}` : `ยอดจัด ${financeAmt.toLocaleString("th-TH")}`,
        });
      }
    });
  }

  // ---- 2) รายได้อื่น ----
  onProgress("รายได้อื่น…");
  const inc = await post("finance-api", { action: "income_record", op: "list", date_from: "2026-01-01", date_to: asOf });
  for (const r of inc) {
    if (!r || !r.income_doc_no) continue;
    const st = String(r.status || "").toLowerCase();
    if (st === "cancelled" || st === "ยกเลิก") continue;
    const docDate = bkkDate(r.doc_date);
    if (!docDate || docDate > asOf) continue;
    const paidDate = st === "paid" ? (bkkDate(r.paid_at) || "0000-00-00") : "";
    docs.push({
      key: "inc-" + r.income_doc_id, source: "income", company: compOfName(r.affiliation) || String(r.affiliation || ""),
      customer: cleanName(r.customer_name) || "(ไม่ระบุลูกค้า)", doc_no: r.income_doc_no, doc_date: docDate, due_date: docDate,
      doc_total: r2(r.total), receivable: r2(r.total),
      payments: paidDate ? [{ date: paidDate, amount: r2(r.total), ref: r.paid_doc_no || "" }] : [],
      desc: cleanName(r.description) || cleanName((Array.isArray(r.items) ? r.items[0]?.income_name : "") || ""),
      note: [r.reference_no ? `อ้างอิง ${r.reference_no}` : "", paidDate && r.payment_method ? `รับด้วย ${r.payment_method}` : ""].filter(Boolean).join(" · "),
    });
  }
  return { docs, info };
}

/** เอกสารที่ยังเป็นลูกหนี้ ณ วันที่ asOf + ช่องอายุหนี้ */
export function receivablesAsOf(docs, asOf, { company = "", source = "", includeShort = false, includeOld = false, basis = "due" } = {}) {
  const out = [];
  for (const d of docs) {
    if (!d.doc_date || d.doc_date > asOf) continue;
    if (!includeOld && d.source === "income" && d.doc_date < AR_INCOME_START) continue; // ใบรายได้อื่นเก่า — ถือว่ารับครบแล้ว
    if ((company && d.company !== company) || (source && d.source !== source)) continue;
    const paidList = d.payments.filter((p) => p.date <= asOf);
    const paid = r2(paidList.reduce((t, p) => t + p.amount, 0));
    let amount, short = false;
    if (!paidList.length) amount = d.receivable;                       // ยังไม่ได้รับเงินเลย
    else {
      amount = r2(d.receivable - paid);
      if (d.source !== "finance" || amount <= 1) continue;             // รับแล้ว (รายได้อื่นถือรับทั้งใบ)
      if (!includeShort) continue;                                     // ไฟแนนซ์โอนขาด — ซ่อนไว้ ติ๊กแสดงได้
      short = true;
    }
    if (Math.abs(amount) <= 0.004) continue;
    const next = d.payments.find((p) => p.date > asOf) || null;        // รับเงินหลังวันที่รายงาน (ไว้แสดง)
    const over = dayDiff(asOf, basis === "doc" ? d.doc_date : d.due_date);
    const bucket = over <= 0 ? "current" : over <= 30 ? "d30" : over <= 60 ? "d60" : over <= 90 ? "d90" : "over";
    out.push({ ...d, amount, collected: r2(d.doc_total - amount), short, paid_as_of: paid, paid_date: next ? next.date : "", paid_ref: next ? next.ref : (paidList[0]?.ref || ""), overdue_days: over, bucket });
  }
  return out;
}

/** จัดกลุ่ม สังกัด → ลูกค้า พร้อมยอดรวมรายช่องอายุหนี้ */
export function groupReceivables(rows) {
  const sumOf = (list) => {
    const s = { doc_total: 0, collected: 0, amount: 0, current: 0, d30: 0, d60: 0, d90: 0, over: 0, count: list.length };
    for (const d of list) { s.doc_total += d.doc_total; s.collected += d.collected; s.amount += d.amount; s[d.bucket] += d.amount; }
    for (const k of Object.keys(s)) if (k !== "count") s[k] = r2(s[k]);
    return s;
  };
  const order = (c) => { const i = AR_COMPANIES.indexOf(c); return i < 0 ? 99 : i; };
  const companies = [...new Set(rows.map((d) => d.company || ""))].sort((a, b) => order(a) - order(b) || a.localeCompare(b, "th"));
  return {
    total: sumOf(rows),
    companies: companies.map((c) => {
      const list = rows.filter((d) => (d.company || "") === c);
      const groups = new Map(); // customerKey → { name (ชื่อยาวสุดที่พบ), docs }
      for (const d of list) {
        const k = customerKey(d.customer) || d.customer;
        if (!groups.has(k)) groups.set(k, { name: d.customer, docs: [] });
        const g = groups.get(k); g.docs.push(d);
        if (d.customer.length > g.name.length) g.name = d.customer;
      }
      const customers = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "th")).map((g) => {
        const docsOf = g.docs.sort((a, b) => a.doc_date.localeCompare(b.doc_date) || a.doc_no.localeCompare(b.doc_no));
        return { customer: g.name, total: sumOf(docsOf), docs: docsOf };
      });
      return { company: c, total: sumOf(list), customers };
    }),
  };
}
