// สรุปรายวันรับเงิน (จากระบบ) — โหลดแหล่งข้อมูล + สร้างแถวรายการ ใช้ร่วมกันระหว่าง
//   • SaleMoneyReportPage (รายงานสรุปรายวันรับเงิน)
//   • BankDepositPage (บันทึกฝากเงิน: dropdown วันที่ → ยอดเงินสดรับสุทธิ "นำฝากธนาคาร" อัตโนมัติ) — user 2026-09-04
// ⚠️ ตรรกะย้ายมาจาก SaleMoneyReportPage แบบเดิมทุกบรรทัด — แก้กฎที่ไฟล์นี้ที่เดียว ทั้ง 2 หน้าจะตรงกันเสมอ

const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
const DEPOSIT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/booking-deposit-api";
const PART_DEPOSIT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-deposit-api";
const RECEIPT_ENTRY_API = "https://n8n-new-project-gwf2.onrender.com/webhook/receipt-entry-api";
const PART_SVC_PAY_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-service-payment-api";
const USED_MOTO_API = "https://n8n-new-project-gwf2.onrender.com/webhook/used-moto-api";
const DEPOSIT_INCOME_API = "https://n8n-new-project-gwf2.onrender.com/webhook/deposit-income-api";
const FUEL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/fuel-withdraw-api";
const INS_REFUND_API = "https://n8n-new-project-gwf2.onrender.com/webhook/insurance-refund-api";
const PETTY_API = "https://n8n-new-project-gwf2.onrender.com/webhook/petty-cash-api"; // เบิกเงินสดย่อย 4 ประเภท → หักเงินสดในสรุปรายวัน (user 2026-09-07)

export const METHOD_COLS = [
  { key: "cash", label: "เงินสด" },
  { key: "transfer", label: "เงินโอน" },
  { key: "finance", label: "ไฟแนนซ์" },
  { key: "deposit", label: "เงินมัดจำ" },
  { key: "coupon", label: "E-คูปอง" },
  { key: "tradein", label: "รถเทิร์น" },
];
export function methodKey(name) {
  const n = String(name || "");
  if (n.includes("มัดจำ")) return "deposit";
  if (n.includes("คูปอง")) return "coupon";
  if (n.includes("เทิร์น") || n.includes("เทิน")) return "tradein";
  if (n.includes("สด")) return "cash";
  if (n.includes("โอน") || n.includes("บัตร") || n.toUpperCase().includes("QR")) return "transfer";
  if (n.includes("ไฟแนน")) return "finance";
  return "other";
}
export const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
export const fmt = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const shiftDate = (iso, days) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const bc5 = (v) => String(v || "").substring(0, 5).toUpperCase();
const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** เบิกเงินสดย่อย 4 ประเภท (petty-cash-api คืนทุกใบ ไม่กรองวันที่) → แถวมาตรฐาน {petty_type, doc_no, doc_date, branch_code, total_amount, status, ...}
 *  ตัดใบยกเลิก/ลบ — สาขา: fuel มี branch_code, ที่เหลือใช้ 5 ตัวแรกของ branch_name (เช่น "SCY06 ป.เปา วังน้อย") — user 2026-09-07 */
export async function loadPettyRows() {
  const parsePetty = async (r, label) => {
    if (!r) return [];
    let raw = await r.json().catch(() => []);
    if (raw && typeof raw.listjson === "string") { try { raw = JSON.parse(raw.listjson); } catch { raw = []; } }
    return (Array.isArray(raw) ? raw : []).filter((d) => d && d.doc_no && !/cancel|delete|reject|ยกเลิก/i.test(String(d.status || ""))).map((d) => ({
      petty_type: label, doc_no: d.doc_no, doc_date: String(d.doc_date || "").slice(0, 10),
      branch_code: d.branch_code || String(d.branch_name || "").slice(0, 5), branch_name: d.branch_name || "",
      total_amount: num(d.total_amount), status: String(d.status || ""), created_by: d.created_by || "",
      period_from: String(d.period_from || "").slice(0, 10), period_to: String(d.period_to || "").slice(0, 10),
    }));
  };
  // user 2026-09-07: หักในสรุปรายวันเฉพาะ "ค่าน้ำมันรถใหม่" เท่านั้น (ค่าไปรษณีย์/ค่าใช้จ่ายทั่วไป/ค่าของไหว้ ไม่หักเงินสดหน้าร้าน)
  const f = await post(PETTY_API, { action: "get_fuel_docs" }).catch(() => null);
  return await parsePetty(f, "ค่าน้ำมันรถใหม่");
}

/** ยกยอดวันติดลบไปหักวันถัดไป (user 2026-09-07: วันไหนเงินสดสุทธิติดลบ ไม่ต้องขึ้นเป็นวันฝาก ให้ไปหักยอดนำฝากวันถัดไปที่เป็นบวก)
 *  รับ days ของสาขาเดียว → คืน days ใหม่เรียงเก่า→ใหม่: วันบวกที่รับยอดยกมาจะมี cash = ยอดหลังหัก, carried = [{date, cash}] ของวันติดลบที่รวมเข้ามา
 *  วันติดลบท้ายสุดที่ยังไม่มีวันบวกมารับ จะไม่ขึ้น (รอวันถัดไป) */
export function carryNegativeDays(days) {
  const sorted = [...days].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const out = [];
  let carry = 0, carried = [];
  for (const d of sorted) {
    const amt = Math.round((num(d.cash) + carry) * 100) / 100;
    if (amt <= 0.005) { carry = amt; carried = [...carried, { date: d.date, cash: num(d.cash) }]; continue; }
    out.push({ ...d, cash: amt, rawCash: num(d.cash), carried });
    carry = 0; carried = [];
  }
  return out;
}

/** วันที่ "ฝากแล้ว" — จับคู่ใบฝาก (bank_deposits) กับวันสรุปเงิน (user 2026-09-07: วันที่ 3 ฝาก 2 ยอด 230,000 (3/9) + 7,103 (4/9) ทำให้วันที่ 4 หายจาก dropdown)
 *  1) ใบฝากที่แหล่งที่มาระบุ "ฝากเงินสดประจำวัน YYYY-MM-DD" → วันนั้นฝากแล้ว
 *  2) ใบฝากไม่ระบุวัน: ไล่วันจากเก่าไปใหม่ หา "ชุดใบฝากที่ลงวันที่ D หรือ D+1 และยังไม่ถูกใช้" ที่ยอดรวมเท่าเงินสดสุทธิของวัน (±2 บาท) → ใช้ชุดนั้นแล้วถือว่าวันนั้นฝากแล้ว
 *  คืน Set ของวันที่ฝากแล้ว */
export function depositedDaySet(days, depList, addDays) {
  const tagged = (x) => (String(x.source || "").match(/ฝากเงินสดประจำวัน (\d{4}-\d{2}-\d{2})/) || [])[1] || "";
  const done = new Set();
  const used = new Set();
  for (const x of depList) { const t = tagged(x); if (t) done.add(t); }
  const untagged = depList.map((x, i) => ({ i, date: String(x.deposit_date || "").slice(0, 10), amt: num(x.amount) })).filter((x) => x.date && !tagged(depList[x.i]));
  const sorted = [...days].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  for (const d of sorted) {
    if (done.has(d.date)) continue;
    const cands = untagged.filter((x) => !used.has(x.i) && (x.date === d.date || x.date === addDays(d.date, 1)));
    if (!cands.length) continue;
    const target = num(d.cash);
    // subset-sum ขนาดเล็ก (ใบฝากต่อวันไม่กี่ใบ) — เลือกชุดที่รวมใกล้ยอดที่สุดภายใน ±2 บาท
    let best = null;
    const n = Math.min(cands.length, 8);
    for (let mask = 1; mask < (1 << n); mask++) {
      let sum = 0; for (let k = 0; k < n; k++) if (mask & (1 << k)) sum += cands[k].amt;
      const diff = Math.abs(sum - target);
      if (diff <= 2 && (!best || diff < best.diff)) best = { mask, diff };
    }
    if (best) { for (let k = 0; k < n; k++) if (best.mask & (1 << k)) used.add(cands[k].i); done.add(d.date); }
  }
  // 3) วันที่ยังไม่จับคู่ด้วยยอด (ใบฝากทำมือก่อนมี dropdown ยอดอาจต่างจากระบบ เช่น มีใบเสร็จบันทึกเพิ่มทีหลัง — user 2026-09-07 SCY01 วันที่ 3):
  //    ถ้ายังมีใบฝากไม่ระบุวันที่ "ยังไม่ถูกใช้" ลงวันที่ D หรือ D+1 → ถือว่าวันนั้นฝากแล้ว (ใช้ใบที่ยอดใกล้ที่สุด 1 ใบ)
  for (const d of sorted) {
    if (done.has(d.date)) continue;
    const cands = untagged.filter((x) => !used.has(x.i) && (x.date === d.date || x.date === addDays(d.date, 1)));
    if (!cands.length) continue;
    const target = num(d.cash);
    const pick = cands.reduce((b, x) => (!b || Math.abs(x.amt - target) < Math.abs(b.amt - target) ? x : b), null);
    used.add(pick.i); done.add(d.date);
  }
  return done;
}

/** โหลดข้อมูลดิบทุกแหล่งของช่วงวันที่ (เหมือน load() ของ SaleMoneyReportPage) */
export async function loadDailyCashSources(dateFrom, dateTo) {
  const [res, resDep, resPartDep, resRcpt, resPs, resUm, resRp, resRpAll, resDi, resFuel, resZero, resInsRf, pettyRows] = await Promise.all([
    post(RETAIL_API, { action: "list_sale_payments", date_from: dateFrom, date_to: dateTo }),
    post(DEPOSIT_API, { action: "get_deposits" }).catch(() => null),
    post(PART_DEPOSIT_API, { action: "list_deposits", limit: 2000 }).catch(() => null),
    post(RECEIPT_ENTRY_API, { action: "list_receipt_payments", date_from: dateFrom, date_to: dateTo }).catch(() => null),
    post(PART_SVC_PAY_API, { action: "list_payments", date_from: dateFrom, date_to: dateTo }).catch(() => null),
    post(USED_MOTO_API, { action: "list_sales", date_from: dateFrom, date_to: dateTo }).catch(() => null),
    post(RETAIL_API, { action: "list_red_plate_deposits", status: "refunded", date_from: dateFrom, date_to: dateTo }).catch(() => null),
    post(RETAIL_API, { action: "list_red_plate_deposits", status: "all", date_from: shiftDate(dateFrom, -90), date_to: dateTo }).catch(() => null),
    post(DEPOSIT_INCOME_API, { action: "list_deposit_income", date_from: dateFrom, date_to: dateTo }).catch(() => null),
    post(FUEL_API, { action: "list_fuel_withdraws", date_from: dateFrom, date_to: dateTo }).catch(() => null),
    post(RETAIL_API, { action: "list_retail_sales", date_from: dateFrom, date_to: dateTo, limit: 2000 }).catch(() => null),
    post(INS_REFUND_API, { action: "list_refunds", date_from: dateFrom, date_to: dateTo }).catch(() => null),
    loadPettyRows(),
  ]);
  const data = await res.json().catch(() => []);
  const paidRows = (Array.isArray(data) ? data : []).filter(r => r && (r.sale_no || r.receipt_no));
  const zeroRaw = resZero ? await resZero.json().catch(() => []) : [];
  const zeroDue = (Array.isArray(zeroRaw) ? zeroRaw : [])
    .filter(r => r && r.invoice_no && String(r.payment_status || "") !== "paid" && num(r.total_payment) === 0)
    .map(r => ({ ...r, sale_no: r.invoice_no, receipt_no: null, receipt_date: r.sale_date, paid_amount: 0, payment_methods: [], payment_received_note: "ลูกค้าไม่ต้องชำระเงิน (ยอดชำระ 0)" }));
  const dep = resDep ? await resDep.json().catch(() => []) : [];
  const pdep = resPartDep ? await resPartDep.json().catch(() => []) : [];
  const rc = resRcpt ? await resRcpt.json().catch(() => []) : [];
  const ps = resPs ? await resPs.json().catch(() => []) : [];
  const um = resUm ? await resUm.json().catch(() => []) : [];
  const rp = resRp ? await resRp.json().catch(() => []) : [];
  const rpa = resRpAll ? await resRpAll.json().catch(() => []) : [];
  const diRaw = resDi ? await resDi.json().catch(() => []) : [];
  const di = Array.isArray(diRaw) ? diRaw : typeof diRaw?.listjson === "string" ? JSON.parse(diRaw.listjson) : [];
  const fuelRaw = resFuel ? await resFuel.json().catch(() => ({})) : {};
  let fuel = [];
  try { fuel = typeof fuelRaw?.listjson === "string" ? JSON.parse(fuelRaw.listjson) : Array.isArray(fuelRaw) ? fuelRaw : []; } catch { fuel = []; }
  const irRaw = resInsRf ? await resInsRf.json().catch(() => ({})) : {};
  let ir = [];
  try { ir = typeof irRaw?.listjson === "string" ? JSON.parse(irRaw.listjson) : Array.isArray(irRaw) ? irRaw : []; } catch { ir = []; }
  return {
    pettyRows,
    hasData: Array.isArray(data) && data.length > 0,
    rows: [...paidRows, ...zeroDue],
    depRows: Array.isArray(dep) ? dep.filter(d => d && d.deposit_no) : [],
    partDepRows: Array.isArray(pdep) ? pdep.filter(d => d && d.deposit_doc_no && d.status !== "cancelled") : [],
    rcptRows: Array.isArray(rc) ? rc.filter(r2 => r2 && r2.receipt_no && r2.paid_at && r2.receipt_status !== "ยกเลิก") : [],
    psRows: Array.isArray(ps) ? ps.filter(p => p && p.payment_id && p.status === "active") : [],
    umRows: Array.isArray(um) ? um.filter(u => u && u.id && u.status === "sold") : [],
    rpRefundRows: Array.isArray(rp) ? rp.filter(d => d && d.deposit_no && d.status === "refunded") : [],
    rpStandaloneRows: Array.isArray(rpa) ? rpa.filter(d => d && d.deposit_no && d.standalone === true && !d.legacy && d.status !== "cancelled") : [],
    depIncRows: Array.isArray(di) ? di.filter(x => x && x.receipt_no) : [],
    fuelRows: fuel.filter(f => f && f.doc_no && f.status !== "ยกเลิก"),
    insRefundRows: ir.filter(r => r && r.id),
  };
}

const inBranch = (code, { branch, isAdmin, myBranch }) => (isAdmin ? (!branch || bc5(code) === bc5(branch)) : bc5(code) === myBranch);

/** pivot ใบขาย (rows) → items พร้อม split/received (เหมือน useMemo items) */
export function buildSaleItems(rows, depRows, ctx) {
  return rows
    .filter((r) => inBranch(r.branch_code, ctx))
    .map((r) => {
      let pms = r.payment_methods;
      if (typeof pms === "string") { try { pms = JSON.parse(pms); } catch { pms = []; } }
      if (!Array.isArray(pms)) pms = [];
      const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
      for (const p of pms) split[methodKey(p.method)] += num(p.amount);
      const paid = num(r.paid_amount) || METHOD_COLS.reduce((s, c) => s + split[c.key], 0);
      const refDep = depRows.find((d) => d.refunded_at && String(d.refund_note || "").includes(r.sale_no));
      const depAdd = Math.max(num(r.booking_deposit) - (refDep ? num(refDep.deposit_amount) : 0), 0);
      split.deposit += depAdd;
      const received = paid + depAdd;
      return { ...r, split, received, saleAmount: num(r.net_car_price || r.car_price) };
    });
}
export function buildDepItems(depRows, ctx) {
  const { dateFrom, dateTo } = ctx;
  return depRows
    .filter((d) => { const dt = String(d.deposit_date || "").slice(0, 10); if (!dt || dt < dateFrom || dt > dateTo) return false; return inBranch(d.branch_code, ctx); })
    .sort((a, b) => String(a.branch_code || "").localeCompare(String(b.branch_code || "")) || String(a.deposit_no || "").localeCompare(String(b.deposit_no || "")));
}
/** แถวคืนเงินมัดจำระบบเก่า (DEPD-/REC) ที่บันทึกผ่าน refund_legacy_deposit — รายรับอยู่ระบบเก่า จึงไม่นับเป็นรายรับ นับแต่ "จ่ายออก" */
export const isLegacyRefundRow = (d) => String(d?.remark || "").startsWith("[คืนมัดจำระบบเก่า]");

export function buildPartDepItems(partDepRows, ctx) {
  const { dateFrom, dateTo } = ctx;
  return partDepRows
    .filter((d) => !isLegacyRefundRow(d))
    .filter((d) => { const dt = String(d.deposit_date || "").slice(0, 10); if (!dt || dt < dateFrom || dt > dateTo) return false; return inBranch(d.branch_code, ctx); })
    .sort((a, b) => String(a.deposit_doc_no || "").localeCompare(String(b.deposit_doc_no || "")));
}

/** สร้างแถวรายการทั้งหมด (allItems) — ctx = { dateFrom, dateTo, branch, isAdmin, myBranch } */
export function buildDailyCashItems(src, ctx) {
  const { dateFrom, dateTo } = ctx;
  const { depRows = [], partDepRows = [], rcptRows = [], psRows = [], umRows = [], rpRefundRows = [], rpStandaloneRows = [], depIncRows = [], fuelRows = [], insRefundRows = [], pettyRows = [] } = src;
  const items = buildSaleItems(src.rows || [], depRows, ctx);
  const depItems = buildDepItems(depRows, ctx);
  const partDepItems = buildPartDepItems(partDepRows, ctx);
  const sales = []; const rpItems = [];
  const standaloneRpDocs = new Set(rpStandaloneRows.map((d) => String(d.deposit_no)));
  for (const it of items) {
    const rpStandaloneAttached = standaloneRpDocs.has(String(it.red_plate_doc_no || ""));
    const rp = rpStandaloneAttached ? 0 : Math.min(num(it.red_plate_deposit), num(it.paid_amount));
    let split = it.split, received = it.received;
    if (rp > 0) {
      split = { ...split };
      let pmsRaw = it.payment_methods;
      if (typeof pmsRaw === "string") { try { pmsRaw = JSON.parse(pmsRaw); } catch { pmsRaw = []; } }
      const exactLine = (Array.isArray(pmsRaw) ? pmsRaw : []).find((p) => Math.abs(num(p.amount) - rp) < 0.01);
      const exactKey = exactLine ? methodKey(exactLine.method) : null;
      const rpSplit = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
      if (exactKey && (exactKey === "cash" || exactKey === "transfer") && split[exactKey] >= rp) {
        split[exactKey] -= rp; rpSplit[exactKey] = rp;
      } else {
        const fromCash = Math.min(split.cash, rp);
        split.cash -= fromCash;
        split.transfer -= Math.min(split.transfer, rp - fromCash);
        rpSplit.cash = fromCash; rpSplit.transfer = rp - fromCash;
      }
      received -= rp;
      rpItems.push({
        kind: "red_plate", category: "เงินมัดจำป้ายแดง (รับฝาก)",
        doc_no: it.red_plate_doc_no || "RPD-" + (it.sale_no || ""), date: it.receipt_date || it.sale_date, ref_no: it.sale_no,
        customer_name: it.customer_name, seller: it.seller, saleAmount: 0,
        split: rpSplit, received: rp,
        branch_key: bc5(it.branch_code), branch_name: it.branch_name || it.branch_code || "ไม่ระบุสาขา",
        note: "ทะเบียนป้ายแดง " + (it.red_plate_no || "-") + " · คืนเมื่อคืนป้าย",
      });
    }
    sales.push({
      kind: "sale", category: "รายได้จากการขายรถ",
      doc_no: it.receipt_no || "-", date: it.receipt_date || it.sale_date, ref_no: it.sale_no,
      customer_name: it.customer_name, seller: it.seller, saleAmount: it.saleAmount,
      split, received,
      branch_key: bc5(it.branch_code), branch_name: it.branch_name || it.branch_code || "ไม่ระบุสาขา",
      note: it.payment_received_note || "", finance: it.finance_type === "moto" ? it.finance_company_name : "",
    });
  }
  const deps = depItems.map((d) => {
    const amt = num(d.deposit_amount);
    const m = String(d.payment_method || "");
    const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
    if (m.includes("สด")) split.cash = amt; else if (m.includes("โอน")) split.transfer = amt; else split.other = amt;
    return {
      kind: "deposit", category: "รายได้เงินมัดจำจองรถ",
      doc_no: d.deposit_no, date: d.deposit_date, ref_no: "",
      customer_name: d.customer_name, seller: "", saleAmount: 0,
      split, received: amt,
      branch_key: bc5(d.branch_code), branch_name: d.branch_name || d.branch_code || "ไม่ระบุสาขา",
      note: [[d.brand, d.model_series, d.color_name].filter(Boolean).join(" "), d.payment_account].filter(Boolean).join(" · "),
      refunded: !!d.refunded_at,
    };
  });
  const rcpts = rcptRows.filter((r2) => inBranch(r2.branch_code, ctx)).map((r2) => {
    const amt = num(r2.paid_amount) || num(r2.line_total);
    const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
    let bks = [];
    try { bks = JSON.parse(r2.payment_breakdowns || "[]"); } catch { bks = []; }
    if (!Array.isArray(bks) || !bks.length) bks = [{ method: String(r2.payment_method || ""), amount: amt }];
    for (const b of bks) split[methodKey(b.method)] += num(b.amount);
    return {
      kind: "receipt", category: `รายได้รับเรื่อง (${r2.receipt_type || "งานทะเบียน"})`,
      doc_no: r2.receipt_no, date: r2.paid_date || r2.paid_at, ref_no: "",
      customer_name: r2.customer_name, seller: r2.payment_received_by || "", saleAmount: 0,
      split, received: amt,
      branch_key: bc5(r2.branch_code), branch_name: r2.branch_code || "ไม่ระบุสาขา",
      note: [r2.payment_account, r2.payment_note].filter(Boolean).join(" · "),
    };
  });
  const partSvcs = psRows.filter((p) => inBranch(p.branch_code, ctx)).map((p) => {
    const amt = num(p.paid_amount);
    const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
    let bks = [];
    try { bks = JSON.parse(p.payment_breakdowns || "[]"); } catch { bks = []; }
    if (!Array.isArray(bks) || !bks.length) bks = [{ method: String(p.payment_method || ""), amount: amt }];
    for (const b of bks) split[methodKey(b.method)] += num(b.amount);
    return {
      kind: "part_service", category: "รายได้ค่าอะไหล่/บริการ",
      doc_no: p.receipt_no || p.doc_no, date: p.paid_date, ref_no: p.doc_no,
      customer_name: p.customer_name, seller: p.received_by || "", saleAmount: 0,
      split, received: amt,
      branch_key: bc5(p.branch_code), branch_name: p.branch_code || "ไม่ระบุสาขา",
      note: [p.doc_type, p.deposit_doc_no ? `ตัดมัดจำ ${p.deposit_doc_no}` : "", p.payment_note].filter(Boolean).join(" · "),
    };
  });
  const usedMotos = umRows.filter((u) => inBranch(u.branch_code, ctx)).map((u) => {
    const amt = num(u.sold_price);
    const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
    let bks = [];
    try { bks = JSON.parse(u.payment_breakdowns || "[]"); } catch { bks = []; }
    if (!Array.isArray(bks) || !bks.length) bks = [{ method: String(u.payment_method || ""), amount: amt }];
    for (const b of bks) split[methodKey(b.method)] += num(b.amount);
    return {
      kind: "used_moto", category: "รายได้ขายรถมือสอง",
      doc_no: u.doc_no, date: u.sold_date, ref_no: u.sold_invoice_no || "",
      customer_name: u.sold_customer, seller: u.sold_by || "", saleAmount: amt,
      split, received: amt,
      branch_key: bc5(u.branch_code), branch_name: u.branch_code || "ไม่ระบุสาขา",
      note: [[u.brand, u.model_series, u.color_name].filter(Boolean).join(" "), u.license_plate, u.payment_note].filter(Boolean).join(" · "),
    };
  });
  const partDeps = partDepItems.map((d) => {
    const amt = num(d.deposit_amount);
    const m = String(d.payment_method || "");
    const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
    if (m.includes("สด")) split.cash = amt; else if (m.includes("โอน")) split.transfer = amt; else split.other = amt;
    return {
      kind: "part_deposit", category: "รายได้เงินมัดจำอะไหล่/บริการ",
      doc_no: d.deposit_doc_no, date: d.deposit_date, ref_no: "",
      customer_name: d.customer_name, seller: d.recorded_by || "", saleAmount: 0,
      split, received: amt,
      branch_key: bc5(d.branch_code), branch_name: d.branch_code || "ไม่ระบุสาขา",
      note: [d.deposit_type ? `มัดจำ${d.deposit_type}` : "", d.brand].filter(Boolean).join(" · "),
      refunded: d.status === "refunded" || !!d.refunded_at,
    };
  });
  const depIncs = depIncRows.filter((r) => inBranch(r.branch_code, ctx)).map((r) => {
    const amt = num(r.total_amount);
    const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
    split[methodKey(r.payment_method || "เงินสด")] += amt;
    return {
      kind: "deposit_income", category: r.income_kind === "other" ? "รายได้อื่นๆ (หน้าร้าน)" : "รายได้รับฝากชำระค่างวด",
      doc_no: r.receipt_no, date: String(r.receipt_date || "").slice(0, 10), ref_no: "",
      customer_name: r.customer_name, seller: r.received_by || "", saleAmount: 0,
      split, received: amt,
      branch_key: bc5(r.branch_code), branch_name: r.branch_code || "ไม่ระบุสาขา",
      note: [r.description, r.payment_account].filter(Boolean).join(" · "),
    };
  });
  const deliveryFees = items.filter((it) => num(it.delivery_fee_amount) > 0).map((it) => {
    const gross = num(it.delivery_fee_amount);
    const wht = Math.round(gross * 3) / 100;
    const amt = -(gross - wht);
    const split = { cash: amt, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
    return {
      kind: "delivery_fee", category: "ค่านำพา (จ่ายออก)",
      doc_no: it.receipt_no || "-", date: it.receipt_date || it.sale_date, ref_no: it.sale_no,
      customer_name: it.customer_name, seller: it.seller, saleAmount: 0,
      split, received: amt,
      branch_key: bc5(it.branch_code), branch_name: it.branch_name || it.branch_code || "ไม่ระบุสาขา",
      note: `จ่ายค่านำพา ${gross.toLocaleString("th-TH", { minimumFractionDigits: 2 })} หัก ณ ที่จ่าย 3% = ${wht.toLocaleString("th-TH", { minimumFractionDigits: 2 })} — หักเงินสดหน้าร้าน`,
    };
  });
  const fuelOuts = fuelRows.filter((f) => inBranch(f.branch_code, ctx)).map((f) => {
    const amt = -num(f.amount);
    const split = { cash: amt, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
    return {
      kind: "fuel_withdraw", category: "เบิกค่าน้ำมันรถใช้จ่าย (จ่ายออก)",
      doc_no: f.doc_no, date: String(f.withdraw_date || "").slice(0, 10), ref_no: f.vehicle || "",
      customer_name: [f.vehicle, f.mileage != null && f.mileage !== "" ? "ไมล์ " + Number(f.mileage).toLocaleString("th-TH") : ""].filter(Boolean).join(" · ") || "-",
      seller: f.created_by || "", saleAmount: 0,
      split, received: amt,
      branch_key: bc5(f.branch_code), branch_name: f.branch_code || "ไม่ระบุสาขา",
      note: ["เบิกเติมน้ำมันรถใช้งาน", f.station_name, f.tax_invoice_no ? "ใบกำกับ " + f.tax_invoice_no : ""].filter(Boolean).join(" · "),
    };
  });
  const insRefundOuts = insRefundRows.filter((r) => r.method === "เงินสด" && r.status === "ปกติ").filter((r) => inBranch(r.branch_code, ctx)).map((r) => {
    const amt = -num(r.refund_amount);
    const split = { cash: amt, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
    return {
      kind: "ins_refund", category: "คืนเงินค่าเบี้ยประกัน (จ่ายออก)",
      doc_no: r.policy_no || "-", date: String(r.refund_date || "").slice(0, 10), ref_no: r.policy_no || "",
      customer_name: r.customer_name || "-", seller: r.refund_by || "", saleAmount: 0,
      split, received: amt,
      branch_key: bc5(r.branch_code), branch_name: r.branch_code || "ไม่ระบุสาขา",
      note: ["คืนเงินเบี้ยประกันลูกค้า — หักเงินสดหน้าร้าน", r.note].filter(Boolean).join(" · "),
    };
  });
  const rpStandalones = rpStandaloneRows
    .filter((d) => { const dt = String(d.received_date || "").slice(0, 10); return dt >= dateFrom && dt <= dateTo; })
    .filter((d) => inBranch(d.branch_code, ctx))
    .map((d) => {
      const amt = num(d.amount);
      const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
      split[methodKey(d.payment_method || "เงินสด")] += amt;
      return {
        kind: "red_plate", category: "เงินมัดจำป้ายแดง (รับฝาก)",
        doc_no: d.deposit_no, date: String(d.received_date || "").slice(0, 10), ref_no: d.sale_no,
        customer_name: d.customer_name, seller: d.received_by || "", saleAmount: 0,
        split, received: amt,
        branch_key: bc5(d.branch_code), branch_name: d.branch_name || d.branch_code || "ไม่ระบุสาขา",
        note: "ทะเบียนป้ายแดง " + (d.plate_no || "-") + " · ติดป้ายทีหลัง" + (d.payment_account ? " · " + d.payment_account : ""),
      };
    });
  const depRefunds = depRows
    .filter((d) => d.refunded_at && String(d.refunded_at).slice(0, 10) >= dateFrom && String(d.refunded_at).slice(0, 10) <= dateTo)
    .filter((d) => inBranch(d.branch_code, ctx))
    .flatMap((d) => {
      const amt = -num(d.refund_amount || d.deposit_amount);
      const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
      split[methodKey(d.refund_method || "เงินสด")] += amt;
      const saleNo = (String(d.refund_note || "").match(/ใบขาย\s*(\S+)/) || [])[1] || "";
      const out = [{
        kind: "dep_refund", category: "คืนเงินมัดจำจองรถ (จ่ายออก)",
        doc_no: d.deposit_no, date: String(d.refunded_at).slice(0, 10), ref_no: saleNo,
        customer_name: d.customer_name, seller: d.refunded_by || "", saleAmount: 0,
        split, received: amt,
        branch_key: bc5(d.branch_code), branch_name: d.branch_name || d.branch_code || "ไม่ระบุสาขา",
        note: ["คืนเงินมัดจำ", d.refund_from_account || d.refund_bank, d.refund_note].filter(Boolean).join(" · "),
      }];
      const used = num(d.deposit_amount) - num(d.refund_amount || d.deposit_amount);
      if (used > 0 && saleNo) {
        const sp2 = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: used, coupon: 0, tradein: 0, other: 0 };
        out.push({
          kind: "deposit_applied", category: "รายได้จากการขายรถ",
          doc_no: saleNo, date: String(d.refunded_at).slice(0, 10), ref_no: d.deposit_no,
          customer_name: d.customer_name, seller: d.refunded_by || "", saleAmount: 0,
          split: sp2, received: used,
          branch_key: bc5(d.branch_code), branch_name: d.branch_name || d.branch_code || "ไม่ระบุสาขา",
          note: `ชำระค่ารถด้วยเงินมัดจำ (มัดจำ ${fmt(d.deposit_amount)} − คืน ${fmt(num(d.refund_amount || 0))})`,
        });
      }
      return out;
    });
  const rpRefunds = rpRefundRows.filter((d) => inBranch(d.branch_code, ctx)).map((d) => {
    const amt = -num(d.refund_amount);
    const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
    split[methodKey(d.refund_method || "เงินสด")] += amt;
    return {
      kind: "red_plate_refund", category: "คืนเงินมัดจำป้ายแดง (จ่ายออก)",
      doc_no: d.refund_doc_no || d.deposit_no, date: d.refund_date, ref_no: d.sale_no || "",
      customer_name: d.customer_name, seller: d.refund_by || "", saleAmount: 0,
      split, received: amt,
      branch_key: bc5(d.branch_code), branch_name: d.branch_name || d.branch_code || "ไม่ระบุสาขา",
      note: ["ป้ายแดง " + (d.plate_no || "-"), "อ้างอิง " + d.deposit_no, d.refund_account_name, d.refund_note].filter(Boolean).join(" · "),
    };
  });
  // คืนเงินมัดจำอะไหล่ "ระบบเก่า" (ใบสั่งซื้ออะไหล่ค้างส่ง → ↩ คืนเงิน) — หักเงินสด/เงินโอน ณ วันคืน (user 2026-09-05: เฉพาะรายการนี้)
  const legacyRefunds = partDepRows
    .filter((d) => isLegacyRefundRow(d) && d.refunded_at && num(d.refunded_amount) > 0)
    .filter((d) => { const dt = String(d.refunded_at).slice(0, 10); return dt >= dateFrom && dt <= dateTo; })
    .filter((d) => inBranch(d.branch_code, ctx))
    .map((d) => {
      const amt = -num(d.refunded_amount);
      const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
      split[methodKey(d.refund_method || "เงินสด")] += amt;
      const orderNo = (String(d.remark || "").match(/ใบสั่งซื้อ\s*(\S+)/) || [])[1] || "";
      return {
        kind: "part_dep_refund", category: "คืนเงินมัดจำอะไหล่ (จ่ายออก)",
        doc_no: d.deposit_doc_no, date: String(d.refunded_at).slice(0, 10), ref_no: orderNo,
        customer_name: d.customer_name, seller: d.refunded_by || "", saleAmount: 0,
        split, received: amt,
        branch_key: bc5(d.branch_code), branch_name: d.branch_code || "ไม่ระบุสาขา",
        note: ["คืนเงินมัดจำระบบเก่า " + (d.brand || ""), String(d.remark || "").replace("[คืนมัดจำระบบเก่า]", "").trim()].filter(Boolean).join(" · "),
      };
    });
  // เบิกเงินสดย่อย "ค่าน้ำมันรถใหม่" เท่านั้น — หักเงินสด ณ วันที่ใบเบิก ทั้งที่รออนุมัติและอนุมัติแล้ว (เงินออกจากลิ้นชักตอนเบิก) (user 2026-09-07)
  const pettyOuts = pettyRows
    .filter((d) => d.petty_type === "ค่าน้ำมันรถใหม่" && d.doc_date && d.doc_date >= dateFrom && d.doc_date <= dateTo && d.total_amount > 0)
    .filter((d) => inBranch(d.branch_code, ctx))
    .map((d) => {
      const amt = -d.total_amount;
      const split = { cash: amt, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
      const pending = !/approved|อนุมัติ/.test(d.status) || /รอ/.test(d.status);
      const period = d.period_from && d.period_to ? ` · ช่วง ${d.period_from.slice(8, 10)}/${d.period_from.slice(5, 7)}–${d.period_to.slice(8, 10)}/${d.period_to.slice(5, 7)}` : "";
      return {
        kind: "petty_cash", category: `เบิกเงินสดย่อย — ${d.petty_type} (จ่ายออก)`,
        doc_no: d.doc_no, date: d.doc_date, ref_no: "",
        customer_name: d.petty_type, seller: d.created_by || "", saleAmount: 0,
        split, received: amt,
        branch_key: bc5(d.branch_code), branch_name: d.branch_name || d.branch_code || "ไม่ระบุสาขา",
        note: `หักเงินสดหน้าร้าน${period}${pending ? " · รออนุมัติ" : ""}`,
      };
    });
  return [...sales, ...rpItems, ...deliveryFees, ...fuelOuts, ...insRefundOuts, ...rpStandalones, ...depIncs, ...usedMotos, ...deps, ...partDeps, ...rcpts, ...partSvcs, ...rpRefunds, ...depRefunds, ...legacyRefunds, ...pettyOuts];
}

/** ยอดเงินสดรับสุทธิ (นำฝากธนาคาร) แยกตามวัน+สาขา — ใช้ในหน้าบันทึกฝากเงิน */
export function dailyCashByDate(allItems) {
  const m = new Map(); // "YYYY-MM-DD|SCYxx" → { date, branch, cash, count }
  for (const it of allItems) {
    const dt = String(it.date || "").slice(0, 10);
    if (!dt) continue;
    const k = `${dt}|${it.branch_key || "-"}`;
    if (!m.has(k)) m.set(k, { date: dt, branch: it.branch_key || "-", cash: 0, count: 0 });
    const g = m.get(k); g.cash += num(it.split?.cash); g.count += 1;
  }
  return [...m.values()].map((g) => ({ ...g, cash: Math.round(g.cash * 100) / 100 })).sort((a, b) => b.date.localeCompare(a.date));
}
