import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// หน้า "งบทดลอง" (รายเดือน) — เทียบรูปแบบงบทดลองของ FlowAccount (user 2026-11-06)
// ----------------------------------------------------------------------------
// หลักการ: ใส่เฉพาะบัญชีที่ "ตรวจสอบกับ Flow แล้ว" เท่านั้น — เฟสแรก = บัญชีธนาคาร (เริ่มรอบ ก.ย. 2569)
//   รวมทั้ง 2 สังกัด (ป.เปา / สิงห์ชัย) ในรายงานเดียว เลือกสังกัดเป็นตัวกรองได้
// ตัวเลข: ใช้ action list_bank_movements ชุดเดียวกับรายงานการเคลื่อนไหว/ยอดคงเหลือ (เลขตรงกันแน่นอน)
//   ยอดยกมา  = ยอดตั้งต้นบัญชี + ผลรวมรายการก่อนวันแรกของเดือน
//   ยอดประจำงวด = เดบิต (รับเข้า) / เครดิต (จ่ายออก) ภายในเดือน
//   ยอดสะสม  = ยกมา + เดบิต − เครดิต   (ยอดติดลบ = คงเหลือฝั่งเครดิต เช่น บัญชี OD)
// รหัสบัญชีตามผังบัญชี Flow แมปจากเลขบัญชีธนาคาร (FLOW_CODES) — บัญชีที่ยังไม่รู้รหัสแสดง "—"
// ============================================================================

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const START_MONTH = "2026-09"; // เดือนแรกที่ตรวจสอบบัญชีธนาคารกับ Flow ครบ

// รหัสบัญชี Flow ตามเลขบัญชีธนาคาร (ตรวจจาก GL ที่สำนักงานบัญชีส่งมา พ.ย. 2569)
const FLOW_CODES = {
  // บริษัท ป.เปา มอเตอร์เซอร์วิส จำกัด
  "4691003766": "11121.01", // กสิกรไทย กระแสรายวัน
  "7393004545": "11121.02", // ไทยพาณิชย์
  "9898991615": "11121.03", // กรุงไทย
  "2490391139": "11122.01", // กรุงเทพ
  "2081066461": "11122.05", // กสิกรไทย ออมทรัพย์ (user 2026-11-06) — ยอด 31/08/69 ตาม Flow ยังไม่ได้รับ
  // ห้างหุ้นส่วนจำกัด สิงห์ชัยสยามยนต์
  "7393004553": "11121.01", // ไทยพาณิชย์
  "4691006757": "11121.02", // กสิกรไทย กระแสรายวัน
  "1881036188": "11121.05", // ทหารไทยธนชาต (OD)
  "0170342026": "11121.08", // กรุงไทย (OD)
  "2490309131": "11122.01", // กรุงเทพ
  "211-3-80125-8": "11122.06", // กสิกรไทย ออมทรัพย์ (Flow เขียน 2113801258)
};
// ยอดยกมา ณ 31/08/2569 ตามงบทดลอง/GL ของ Flow (สำนักงานบัญชีปิดงบถึง ส.ค. แล้ว) — รอบ ก.ย. เป็นต้นไปใช้ยอดนี้ + รายการในระบบตั้งแต่ 01/09/2569
// (ยอดตั้งต้นบัญชี + รายการ เม.ย.–ส.ค. ในระบบยังไม่ได้กระทบกับ Flow จึงไม่ใช้) · บัญชีที่ไม่มีในตารางนี้ใช้วิธีเดิม = ยอดตั้งต้น + รายการสะสมทั้งหมด
const FLOW_OPENING_0831 = {
  "4691003766": 2080938.74, "7393004545": 217045.78, "9898991615": 1963466.14, "2490391139": 202420.16,
  "7393004553": 33159.70, "4691006757": 1071531.92, "1881036188": -7272232.75, "0170342026": -7799916.08, "2490309131": 535136.90, "211-3-80125-8": 166.23,
};
const FLOW_OPENING_DATE = "2026-09-01";
// ---- เงินสดย่อย (รวมทุกรายการเป็นบรรทัดเดียวต่อสังกัด — user 2026-11-06 "ไม่ต้องแยกรายการ") ----
// ตรวจกับ Flow ก.ย.69 แล้วตรงทุกบัญชี 11149.xx: ฝั่งจ่าย (เครดิต) = ค่าน้ำมันรถใหม่ (EXP ตามวันที่ใบ) + ค่าของไหว้ (OFR ตามวันที่ใบ)
//   + ค่าใช้จ่ายทั่วไป/ค่าไปรษณีย์ ตามวันที่กดเบิก PCW (ไม่ใช่วันที่ใบ) — เกณฑ์เดียวกับสรุปรายวันเงินสด
// ฝั่งเติมเงิน (เดบิต): ระบบไม่มีบันทึกเติมเงินสดย่อย → ถือเป็นระบบวงเงินคงที่ (imprest) เติมเท่าที่เบิก = เดบิต = เครดิต ยอดคงเหลือ = วงเงินตาม Flow 31/08
// ยอดยกมา 31/08/69 = ผลรวมบัญชี 11149.xx ในงบทดลอง Flow (จากภาพที่ user ส่ง 2026-11-06)
const PETTY_API = "https://n8n-new-project-gwf2.onrender.com/webhook/petty-cash-api";
const PETTY_OPENING_0831 = { "สิงห์ชัย": 4230.00, "ป.เปา": 8120.00 }; // สิงห์ชัย: .03 −40 .05 620 .07 530 .08 370 .09 1,500 .10 250 .11 1,000 · ป.เปา: .01 1,070 .06 1,000 .07 3,000 .08 1,640 .10 580 .11 400 .12 430
const PETTY_CODE = "11149.00";
// ---- เงินให้กู้ยืมระหว่างบริษัท 11451 (user 2026-11-06 "เพิ่มส่วนนี้ให้ด้วย") ----
// ระบบไม่มีสมุดบัญชีกู้ยืมระหว่างกันโดยตรง จึงประกอบจาก: (1) โอนเงินข้ามสังกัด (BTR บัญชีธนาคาร ป.เปา ↔ สิงห์ชัย: ป.เปาโอนให้ = ป.เปา เดบิต/สิงห์ชัย เครดิต, โอนคืน = กลับด้าน)
//   (2) ขายส่งอะไหล่ให้สิงห์ชัยที่ตัดผ่านบัญชีเสมือน "เงินให้กู้ยืมระหว่างบริษัท" (account_type กู้ยืมระหว่างบริษัท, WSR วิธีหักบัญชีกู้ยืม) = ป.เปา เดบิต/สิงห์ชัย เครดิต
//   ⚠️ ไม่รวม: เงินสดสาขาสิงห์ชัยที่ฝากเข้าบัญชี ป.เปา และ JV ปิดยอดเงินสด/เงินสดย่อยสิ้นเดือนของ Flow (378,792 / 209,968.32 ก.ย.) → ตัวเลขงวดจะต่างจาก Flow ส่วนนี้
//   คู่รายการโอนผิดบัญชีไป-กลับวันเดียวกันยอดเท่ากัน (เช่น 2,247 05/09) หักกันเอง ไม่แสดง (user: dr กับ cr เท่ากันไม่ต้องแสดง)
// ยอดยกมา 31/08/69 ตาม Flow: ป.เปา 11451 เดบิต 5,687,807.91 · สิงห์ชัย 11451 เครดิต 5,664,715.04 (2 เล่มต่างกัน 23,092.87 — สำนักงานบัญชีต้องไล่เอง)
const INTERCO_CODE = "11451";
// ---- สินค้าคงเหลือ - รถจักรยานยนต์ 11513 (user 2026-11-06 "สินค้าคงเหลือขึ้นเลย") ----
// มูลค่า = สต๊อกรถใหม่ในระบบ (stock-turnover-api stock_on_hand = รับรถ − ขาย, new_only) ณ วันสิ้นงวด × ต้นทุนตามใบกำกับซื้อ ÷ 1.07 (ก่อน VAT เหมือน Flow)
// ป.เปา = HONDA · สิงห์ชัย = YAMAHA · ยกมา = มูลค่าระบบ ณ สิ้นเดือนก่อน · งวด = ผลต่างสุทธิ (เพิ่ม = เดบิต / ลด = เครดิต) แบบเดียวกับ JV ปรับยอดสิ้นเดือนของ Flow
// ⚠️ Flow ก.ย.69 ยกมา 15,054,600 / คงเหลือ 16,968,900 (สิงห์ชัย) ต่างจากระบบ 79,000 / 1,768,200 — รอสำนักงานบัญชีเทียบรายคันจากไฟล์ "สต๊อกรถใหม่ YAMAHA ณ 30-09-2569 (ระบบ).xlsx"
const STOCK_API = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-turnover-api";
// ---- เงินมัดจำ 11921 — เงินมัดจำรับจากลูกค้า ตามระบบ (user 2026-11-06 "เพิ่มเงินมัดจำคงเหลือ ไม่ต้องแยก · เอาจากระบบ ไม่ต้องดูยอดจาก Flow") ----
// รวม 3 ประเภทเป็นบรรทัดเดียวต่อสังกัด: มัดจำจองรถ (booking-deposit-api) + มัดจำป้ายแดง (retail-sale-api) + มัดจำอะไหล่ บริการ/สั่งซื้อ (part-deposit-api)
//   เป็นหนี้สิน (เงินรับล่วงหน้า): เครดิต = รับใหม่ในงวด · เดบิต = ตัดใช้ชำระ + คืนเงิน ในงวด · ยกมา/คงค้าง = ยอดที่ยังไม่ตัด/ไม่คืน ณ วันนั้น (แสดงฝั่งเครดิต)
//   ตัดใช้จองรถ = ใบขาย NEW ที่อ้างใบมัดจำ DEP- ตามวันที่ขาย · ตัดใช้อะไหล่ = มัดจำ − คงเหลือ − คืน ลงวันที่ปรับปรุงใบล่าสุด (ระบบไม่เก็บวันตัด) · ใบยกเลิกไม่นับ
//   สังกัดตามรหัสสาขาของใบ: SCY05/SCY06 = ป.เปา · SCY01/SCY04/SCY07/SCY10 = สิงห์ชัย
const FT_DEPOSIT_CODE = "11921";
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
const companyOfBranch = (b) => { const m = String(b || "").toUpperCase().match(/SCY\d\d/); const c = m ? m[0] : ""; return ["SCY05", "SCY06"].includes(c) ? "ป.เปา" : ["SCY01", "SCY04", "SCY07", "SCY10"].includes(c) ? "สิงห์ชัย" : "อื่น ๆ"; };
async function postAny(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = (await res.text()).trim(); if (!t) return [];
  let d; try { d = JSON.parse(t); } catch { return []; }
  if (!Array.isArray(d)) d = d?.rows || d?.data || [d];
  if (d[0] && typeof d[0].listjson === "string") { try { d = JSON.parse(d[0].listjson); } catch { d = []; } }
  return Array.isArray(d) ? d.filter(Boolean) : [];
}
async function loadCustomerDeposits(to) {
  const [booking, sales, redPlate, parts] = await Promise.all([
    postAny("https://n8n-new-project-gwf2.onrender.com/webhook/booking-deposit-api", { action: "get_deposits", keyword: "", status: "all" }),
    postAny(RETAIL_API, { action: "list_retail_sales", date_from: "2026-01-01", date_to: to, limit: 5000 }),
    postAny(RETAIL_API, { action: "list_red_plate_deposits", status: "all" }),
    postAny("https://n8n-new-project-gwf2.onrender.com/webhook/part-deposit-api", { action: "list_deposits", limit: 5000 }),
  ]);
  return { booking, sales, redPlate, parts };
}
// events = [[date, amount, company]] → {before, inPeriod, upTo}
function sumEvents(events, c, from, to) {
  const o = { before: 0, inPeriod: 0, upTo: 0 };
  events.forEach(([d, a, cc]) => { if (!d || cc !== c) return; const v = Number(a || 0); if (d < from) o.before += v; if (d >= from && d <= to) o.inPeriod += v; if (d <= to) o.upTo += v; });
  return o;
}
function customerDepositRow(c, src, from, to) {
  const d10 = (v) => String(v || "").slice(0, 10); const n = (v) => Number(v || 0);
  const recv = [], used = [], ref = [];
  src.booking.filter(x => x && x.deposit_no).forEach(x => { const cc = companyOfBranch(x.branch_code); recv.push([d10(x.deposit_date), x.deposit_amount, cc]); if (x.status === "refunded" || n(x.refund_amount) > 0) ref.push([d10(x.refunded_at || x.updated_at), n(x.refund_amount) || n(x.deposit_amount), cc]); });
  src.sales.filter(x => x && x.bd_deposit_no && x.sale_status !== "cancelled" && n(x.booking_deposit) > 0).forEach(x => used.push([d10(x.sale_date), x.booking_deposit, companyOfBranch(x.branch_code)]));
  src.redPlate.filter(x => x && x.deposit_no && x.status !== "cancelled").forEach(x => { const cc = companyOfBranch(x.branch_code); recv.push([d10(x.received_date), x.amount, cc]); if (x.status === "refunded" || n(x.refund_amount) > 0) ref.push([d10(x.refund_date || x.updated_at), n(x.refund_amount) || n(x.amount), cc]); });
  src.parts.filter(x => x && x.deposit_doc_no && x.status !== "cancelled" && !x.cancelled_at).forEach(x => { const cc = companyOfBranch(x.branch_code); recv.push([d10(x.deposit_date), x.deposit_amount, cc]);
    if (n(x.refunded_amount) > 0) ref.push([d10(x.refunded_at || x.updated_at), x.refunded_amount, cc]);
    const u = Math.max(n(x.deposit_amount) - n(x.remaining_amount) - n(x.refunded_amount), 0); if (u > 0.004) used.push([d10(x.updated_at || x.deposit_date), u, cc]); });
  const R = sumEvents(recv, c, from, to), U = sumEvents(used, c, from, to), F = sumEvents(ref, c, from, to);
  const bal = (k) => r2(R[k] - U[k] - F[k]);
  const cnt = (ev) => ev.filter(([d, , cc]) => cc === c && d >= from && d <= to).length;
  return { account_id: "custdep-" + c, kind: "ftdeposit", company: c, code: FT_DEPOSIT_CODE, bank_name: "เงินมัดจำรับจากลูกค้า", account_no: "",
    account_name: `จองรถ + ป้ายแดง + อะไหล่ · รับ ${cnt(recv)} ใบ ${fmt(R.inPeriod)} · ตัดใช้ ${cnt(used)} ใบ ${fmt(U.inPeriod)} · คืน ${cnt(ref)} ใบ ${fmt(F.inPeriod)}`,
    account_type: "หนี้สิน (ยอดคงค้างฝั่งเครดิต) · ตามเอกสารมัดจำในระบบ", flowOpening: null,
    opening: -bal("before"), dr: r2(U.inPeriod + F.inPeriod), cr: r2(R.inPeriod), closing: -bal("upTo"), count: cnt(recv) + cnt(used) + cnt(ref) };
}

const INVENTORY_CODE = "11513";
const BRAND_OF_COMPANY = { "ป.เปา": "HONDA", "สิงห์ชัย": "YAMAHA" };
async function stockValueAt(brand, asOf) {
  const res = await fetch(STOCK_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stock_on_hand", brand, as_of: asOf, new_only: true, deduct_sales: true }) });
  const t = await res.text(); let d; try { d = JSON.parse(t); } catch { d = []; }
  if (!Array.isArray(d)) d = d?.rows || [d]; if (d[0] && d[0].listjson) d = JSON.parse(d[0].listjson);
  const rows = d.filter(x => x && x.engine_no);
  const incl = rows.reduce((t2, x) => t2 + Number(x.unit_cost || 0), 0);
  return { units: rows.length, incl: r2(incl), ex: r2(incl / 1.07), noCost: rows.filter(x => !Number(x.unit_cost)).length };
}
const INTERCO_TYPE = "กู้ยืมระหว่างบริษัท";
const INTERCO_OPENING_0831 = { "ป.เปา": 5687807.91, "สิงห์ชัย": -5664715.04 };
const otherCompanyRe = (c) => (c === "ป.เปา" ? /สิงห์ชัย/ : /เปา/);
// จากรายการเคลื่อนไหวของบัญชีธนาคารสังกัด c: คืน {dr, cr} ของบัญชี 11451 มุมมองสังกัด c (หักคู่ไป-กลับวันเดียวกันออกแล้ว)
function intercoFromMovements(rows, c) {
  const other = otherCompanyRe(c);
  const list = rows.filter(m => m && m.movement_date && /โอนระหว่างบัญชี/.test(String(m.movement_type || "")) && other.test(String(m.counterparty || "")) && !/เงินสดย่อย|กู้ยืมกรรม/.test(String(m.counterparty || "")));
  const used = new Set();
  list.forEach((m, i) => {
    if (used.has(i)) return;
    const amt = Math.abs(Number(m.amount || 0)); const d = String(m.movement_date).slice(0, 10);
    const j = list.findIndex((x, k) => k !== i && !used.has(k) && String(x.movement_date).slice(0, 10) === d && Math.abs(Math.abs(Number(x.amount || 0)) - amt) < 0.005 && Math.sign(Number(x.amount)) === -Math.sign(Number(m.amount)));
    if (j >= 0) { used.add(i); used.add(j); }
  });
  let dr = 0, cr = 0;
  list.forEach((m, i) => {
    if (used.has(i)) return;
    const a = Number(m.amount || 0);
    // ป.เปา: โอนออกให้สิงห์ชัย = ให้กู้ (เดบิต), รับเข้าจากสิงห์ชัย = รับคืน (เครดิต) · สิงห์ชัย: รับเข้าจาก ป.เปา = กู้ (เครดิต), โอนออกให้ ป.เปา = คืน (เดบิต)
    if (c === "ป.เปา") { if (a < 0) dr += -a; else cr += a; } else { if (a > 0) cr += a; else dr += -a; }
  });
  return { dr: r2(dr), cr: r2(cr) };
} // รหัสบัญชีรวมเงินสดย่อยตามที่ user ระบุ 2026-11-06
const compOfName = (v) => /สิงห์ชัย/.test(String(v || "")) ? "สิงห์ชัย" : /เปา/.test(String(v || "")) ? "ป.เปา" : "อื่น ๆ";
async function postPetty(body) {
  const res = await fetch(PETTY_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text(); try { const j = JSON.parse(t); return Array.isArray(j) ? j : j ? [j] : []; } catch { return []; }
}
// คืน rows เงินสดย่อยต่อสังกัด สำหรับเดือน [from,to]
async function loadPettyRows(from, to) {
  const inRange = (d) => { const x = String(d || "").slice(0, 10); return x >= from && x <= to; };
  const [fuel, offering, pcw] = await Promise.all([
    postPetty({ action: "get_fuel_docs", limit: 2000 }), postPetty({ action: "get_offering_docs" }), postPetty({ action: "list_petty_withdrawals", limit: 2000 }),
  ]);
  const acc = {};
  const add = (c, k, v) => { if (!acc[c]) acc[c] = { fuel: 0, offering: 0, general: 0, postage: 0, n: 0 }; acc[c][k] += Number(v || 0); acc[c].n++; };
  fuel.forEach(d => { if (d && d.status === "approved" && inRange(d.doc_date)) add(compOfName(d.branch_name || d.company_name), "fuel", d.total_amount); });
  offering.forEach(d => { if (d && d.status === "approved" && inRange(d.doc_date)) add(compOfName(d.company_name), "offering", d.total_amount); });
  pcw.forEach(p => { if (p && p.status === "active" && inRange(p.withdraw_date)) add(compOfName(p.company_name), /ไปรษณีย์/.test(String(p.petty_type || "")) ? "postage" : "general", p.total_amount); });
  return COMPANIES.map(c => {
    const b = acc[c] || { fuel: 0, offering: 0, general: 0, postage: 0, n: 0 };
    const cr = r2(b.fuel + b.offering + b.general + b.postage);
    const opening = Object.prototype.hasOwnProperty.call(PETTY_OPENING_0831, c) ? PETTY_OPENING_0831[c] : 0;
    return { account_id: "petty-" + c, kind: "petty", company: c, code: PETTY_CODE, bank_name: "เงินสดย่อย", account_no: "", account_name: `รวมทุกสาขา · ค่าน้ำมันรถใหม่ ${fmt(b.fuel)} · ของไหว้ ${fmt(b.offering)} · ค่าใช้จ่ายทั่วไป ${fmt(b.general)} · ไปรษณีย์ ${fmt(b.postage)}`,
      account_type: "วงเงินคงที่ (เติมเท่าที่เบิก)", flowOpening: opening, opening, dr: cr, cr, closing: opening, count: b.n, breakdown: b };
  });
}
const flowOpeningOf = (a) => { const k = String(a.account_no || "").trim(); return Object.prototype.hasOwnProperty.call(FLOW_OPENING_0831, k) ? FLOW_OPENING_0831[k] : (Object.prototype.hasOwnProperty.call(FLOW_OPENING_0831, normNo(k)) ? FLOW_OPENING_0831[normNo(k)] : null); };
const COMPANIES = ["ป.เปา", "สิงห์ชัย"];
const COMPANY_FULL = { "ป.เปา": "บริษัท ป.เปา มอเตอร์เซอร์วิส จำกัด", "สิงห์ชัย": "ห้างหุ้นส่วนจำกัด สิงห์ชัยสยามยนต์" };
const companyOf = (a) => /สิงห์ชัย/.test(String(a.account_name || "")) ? "สิงห์ชัย" : /เปา/.test(String(a.account_name || "")) ? "ป.เปา" : "อื่น ๆ";
const isBank = (a) => String(a.bank_name || "").trim() && String(a.bank_name || "").trim() !== "-" && !/เงินสดย่อย|ลูกหนี้/.test(String(a.account_type || ""));
const normNo = (v) => String(v || "").replace(/[^0-9]/g, "");
const flowCodeOf = (a) => FLOW_CODES[String(a.account_no || "").trim()] || FLOW_CODES[normNo(a.account_no)] || "";

const pad = (n) => String(n).padStart(2, "0");
const prevMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; return ym < START_MONTH ? START_MONTH : ym; };
const monthRange = (ym) => { const [y, m] = ym.split("-").map(Number); const last = new Date(y, m, 0).getDate(); return [`${ym}-01`, `${ym}-${pad(last)}`]; };
const prevDayOf = (iso) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const thMonthLong = (ym) => { const [y, m] = ym.split("-").map(Number); return `${TH_MONTHS[m - 1]} ${y + 543}`; };
const thDateLong = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${TH_MONTHS[m - 1]} ${y + 543}`; };
const fmt = (v) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;
// แยกเดบิต/เครดิตจากยอดคงเหลือ: บวก = เดบิต, ลบ = เครดิต
const drcr = (v) => (v >= 0.005 ? [v, 0] : v <= -0.005 ? [0, -v] : [0, 0]);
const cellNum = (v) => (v > 0.004 ? fmt(v) : "-");

async function post(body) {
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text(); try { const j = JSON.parse(t); return Array.isArray(j) ? j : j ? [j] : []; } catch { return []; }
}
// ยิงทีละไม่เกิน 3 บัญชีพร้อมกัน (n8n ล้มเมื่อโดนยิงพร้อมกันมาก ๆ — เหตุ 06/11/69)
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

export default function TrialBalancePage() {
  const [ym, setYm] = useState(prevMonth());
  const [company, setCompany] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]); // รวมบัญชีเสมือน (ใช้หาบัญชีกู้ยืมระหว่างบริษัท)
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [loadedYm, setLoadedYm] = useState("");
  const [loadedCompany, setLoadedCompany] = useState(null); // สังกัดที่โหลดมา (null = ยังไม่เคยโหลด)

  useEffect(() => {
    post({ action: "list_bank_accounts", include_inactive: "false" }).then(arr => { const ok = arr.filter(a => a && a.account_id); setAllAccounts(ok); setAccounts(ok.filter(isBank)); }).catch(() => setAccounts([]));
  }, []);

  async function load() {
    if (!accounts.length) return;
    if (ym < START_MONTH) { setErr(`งบทดลองเริ่มรอบ ${thMonthLong(START_MONTH)} (บัญชีธนาคารตรวจสอบกับ Flow ตั้งแต่เดือนนี้)`); return; }
    setLoading(true); setErr(""); setRows([]);
    const [from, to] = monthRange(ym); const prev = prevDayOf(from);
    // ดึงเฉพาะบัญชีของสังกัดที่เลือก (ทุกสังกัด = ทั้งหมด) — ลดจำนวน request ที่ยิง n8n (user 2026-11-06: เลือกก่อนค่อยดึง)
    const targets = accounts.filter(a => !company || companyOf(a) === company);
    try {
      let done = 0;
      const out = await mapLimit(targets, 3, async (a) => {
        const id = Number(a.account_id);
        const fo = flowOpeningOf(a);
        // มียอด Flow 31/08 → ยกมา = ยอด Flow + รายการตั้งแต่ 01/09 ถึงวันก่อนต้นงวด (รอบ ก.ย. = ยอด Flow ตรง ๆ) · ไม่มี → ยอดตั้งต้นบัญชี + รายการสะสมทั้งหมด
        const prior = (fo !== null && prev < FLOW_OPENING_DATE) ? [] : await post({ action: "list_bank_movements", account_id: id, date_from: fo !== null ? FLOW_OPENING_DATE : "2000-01-01", date_to: prev });
        const cur = await post({ action: "list_bank_movements", account_id: id, date_from: from, date_to: to });
        const sum = (arr, f) => arr.reduce((s, m) => s + (m && m.movement_date ? f(Number(m.amount || 0)) : 0), 0);
        const opening = r2((fo !== null ? fo : Number(a.opening_balance || 0)) + sum(prior, v => v));
        const dr = r2(sum(cur, v => (v > 0 ? v : 0)));
        const cr = r2(sum(cur, v => (v < 0 ? -v : 0)));
        done++; setProgress(`${done}/${targets.length} บัญชี`);
        return { ...a, company: companyOf(a), code: flowCodeOf(a), flowOpening: fo, opening, dr, cr, closing: r2(opening + dr - cr), count: cur.filter(m => m && m.movement_date).length, _prior: prior, _cur: cur };
      });
      setProgress("เงินสดย่อย…");
      let petty = [];
      try { petty = (await loadPettyRows(from, to)).filter(p => !company || p.company === company); } catch { petty = []; }
      // ---- เงินให้กู้ยืมระหว่างบริษัท 11451 ต่อสังกัด ----
      setProgress("เงินกู้ยืมระหว่างบริษัท…");
      let interco = [];
      try {
        const icoAcc = allAccounts.find(a => a.account_type === INTERCO_TYPE);
        const icoPrior = icoAcc && prev >= FLOW_OPENING_DATE ? await post({ action: "list_bank_movements", account_id: Number(icoAcc.account_id), date_from: FLOW_OPENING_DATE, date_to: prev }) : [];
        const icoCur = icoAcc ? await post({ action: "list_bank_movements", account_id: Number(icoAcc.account_id), date_from: from, date_to: to }) : [];
        const sumIn = (arr) => r2(arr.reduce((t, m) => t + (m && m.movement_date && Number(m.amount) > 0 ? Number(m.amount) : 0), 0));
        const sumOut = (arr) => r2(arr.reduce((t, m) => t + (m && m.movement_date && Number(m.amount) < 0 ? -Number(m.amount) : 0), 0));
        interco = COMPANIES.filter(c => !company || c === company).map(c => {
          const mine = out.filter(r => r.company === c);
          const curT = mine.reduce((t, r) => { const x = intercoFromMovements(r._cur || [], c); t.dr += x.dr; t.cr += x.cr; return t; }, { dr: 0, cr: 0 });
          const priT = mine.reduce((t, r) => { const x = intercoFromMovements(r._prior || [], c); t.dr += x.dr; t.cr += x.cr; return t; }, { dr: 0, cr: 0 });
          // ขายส่งตัดบัญชีกู้ยืม (บัญชีเสมือน): รับเข้า = ป.เปา เดบิต / สิงห์ชัย เครดิต, จ่ายออก = กลับด้าน
          const wIn = sumIn(icoCur), wOut = sumOut(icoCur), wInP = sumIn(icoPrior), wOutP = sumOut(icoPrior);
          const wDr = c === "ป.เปา" ? wIn : wOut, wCr = c === "ป.เปา" ? wOut : wIn, wDrP = c === "ป.เปา" ? wInP : wOutP, wCrP = c === "ป.เปา" ? wOutP : wInP;
          const base = Object.prototype.hasOwnProperty.call(INTERCO_OPENING_0831, c) ? INTERCO_OPENING_0831[c] : 0;
          const opening = r2(base + (priT.dr + wDrP) - (priT.cr + wCrP));
          const dr = r2(curT.dr + wDr), cr = r2(curT.cr + wCr);
          const partner = c === "ป.เปา" ? "สิงห์ชัย" : "ป.เปา";
          return { account_id: "interco-" + c, kind: "interco", company: c, code: INTERCO_CODE, bank_name: "เงินให้กู้ยืมระหว่างบริษัท", account_no: "",
            account_name: `${c} ↔ ${partner} · โอนข้ามสังกัด ${fmt(curT.dr)} / ${fmt(curT.cr)} · ขายส่งตัดบัญชี ${fmt(wDr)} / ${fmt(wCr)}`,
            account_type: "ไม่รวมเงินสดสาขาฝากข้ามสังกัด และ JV ปิดยอดเงินสดสิ้นเดือนของ Flow", flowOpening: base, opening, dr, cr, closing: r2(opening + dr - cr), count: 0 };
        });
      } catch { interco = []; }
      out.forEach(r => { delete r._prior; delete r._cur; });
      // ---- สินค้าคงเหลือ รถจักรยานยนต์ 11513 ต่อสังกัด ----
      setProgress("สินค้าคงเหลือรถ…");
      let inventory = [];
      try {
        inventory = await mapLimit(COMPANIES.filter(c => !company || c === company), 1, async (c) => {
          const brand = BRAND_OF_COMPANY[c];
          const open = await stockValueAt(brand, prev), close = await stockValueAt(brand, to);
          const diff = r2(close.ex - open.ex);
          return { account_id: "inv-" + c, kind: "inventory", company: c, code: INVENTORY_CODE, bank_name: "สินค้าคงเหลือ - รถจักรยานยนต์", account_no: "",
            account_name: `${brand} สต๊อกรถใหม่ ${close.units} คัน (ต้นงวด ${open.units} คัน) · ต้นทุนก่อน VAT · รวม VAT ${fmt(close.incl)}${close.noCost ? ` · ⚠ ไม่มีต้นทุน ${close.noCost} คัน` : ""}`,
            account_type: "มูลค่าสต๊อกจากระบบ (รับรถ − ขาย) ÷ 1.07", flowOpening: null, opening: open.ex, dr: diff > 0 ? diff : 0, cr: diff < 0 ? -diff : 0, closing: close.ex, count: close.units };
        });
      } catch { inventory = []; }
      // ---- เงินมัดจำ 11921 (เงินโอนไฟแนนท์รอตัดรับ) ต่อสังกัด ----
      setProgress("เงินมัดจำ…");
      let ftdep = [];
      try { const src = await loadCustomerDeposits(to); ftdep = COMPANIES.filter(c => !company || c === company).map(c => customerDepositRow(c, src, from, to)); } catch { ftdep = []; }
      const all = [...out, ...petty, ...interco, ...inventory, ...ftdep];
      all.sort((x, y) => COMPANIES.indexOf(x.company) - COMPANIES.indexOf(y.company) || (x.code || "zz").localeCompare(y.code || "zz") || String(x.account_no).localeCompare(String(y.account_no)));
      setRows(all); setLoadedYm(ym); setLoadedCompany(company);
    } catch { setErr("❌ โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false); setProgress("");
  }
  // ไม่โหลดอัตโนมัติตอนเปิดหน้า — เลือกเดือน/สังกัดก่อนแล้วกด "แสดงผลรายงาน" (user 2026-11-06)

  // ถ้าเปลี่ยนสังกัดหลังโหลด: กรองจากที่มีได้เฉพาะเมื่อโหลดมาทุกสังกัด ไม่งั้นต้องกดแสดงใหม่
  const shown = useMemo(() => rows.filter(r => !company || r.company === company), [rows, company]);
  const needReload = loadedCompany !== null && (loadedYm !== ym || (loadedCompany && loadedCompany !== company));
  const groups = useMemo(() => [...COMPANIES, "อื่น ๆ"].map(g => ({ g, list: shown.filter(r => r.company === g) })).filter(x => x.list.length), [shown]);
  const sumOf = (list) => {
    const t = { oDr: 0, oCr: 0, dr: 0, cr: 0, cDr: 0, cCr: 0 };
    list.forEach(r => { const [a, b] = drcr(r.opening); const [c, d] = drcr(r.closing); t.oDr += a; t.oCr += b; t.dr += r.dr; t.cr += r.cr; t.cDr += c; t.cCr += d; });
    return t;
  };
  const grand = sumOf(shown);
  const [from, to] = monthRange(loadedYm || ym);
  const title = company ? COMPANY_FULL[company] : "ทุกสังกัด (ป.เปา + สิงห์ชัย)";

  function exportCsv() {
    const head = ["สังกัด", "รหัสบัญชี Flow", "ธนาคาร", "เลขบัญชี", "ชื่อบัญชี", "ยกมา เดบิต", "ยกมา เครดิต", "งวด เดบิต", "งวด เครดิต", "สะสม เดบิต", "สะสม เครดิต"];
    const lines = shown.map(r => { const [a, b] = drcr(r.opening); const [c, d] = drcr(r.closing); return [r.company, r.code || "", r.bank_name, r.account_no, r.account_name, a.toFixed(2), b.toFixed(2), r.dr.toFixed(2), r.cr.toFixed(2), c.toFixed(2), d.toFixed(2)]; });
    const csv = [head, ...lines].map(l => l.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `trial_balance_${loadedYm || ym}${company ? "_" + company : ""}.csv`; a.click();
  }

  function printReport() {
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const row = (r) => { const [a, b] = drcr(r.opening); const [c, d] = drcr(r.closing); return `<tr><td class="code">${esc(r.code || "—")}</td><td>${esc(r.bank_name)} ${esc(r.account_no)}<div class="sub">${esc(r.account_name)}</div></td><td class="r">${cellNum(a)}</td><td class="r">${cellNum(b)}</td><td class="r">${cellNum(r.dr)}</td><td class="r">${cellNum(r.cr)}</td><td class="r">${cellNum(c)}</td><td class="r">${cellNum(d)}</td></tr>`; };
    const tot = (label, t, cls) => `<tr class="${cls}"><td colspan="2">${esc(label)}</td><td class="r">${fmt(t.oDr)}</td><td class="r">${fmt(t.oCr)}</td><td class="r">${fmt(t.dr)}</td><td class="r">${fmt(t.cr)}</td><td class="r">${fmt(t.cDr)}</td><td class="r">${fmt(t.cCr)}</td></tr>`;
    const body = groups.map(({ g, list }) => `<tr class="grp"><td colspan="8">${esc(COMPANY_FULL[g] || g)}</td></tr>${list.map(row).join("")}${groups.length > 1 ? tot(`รวม ${g}`, sumOf(list), "sub") : ""}`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>งบทดลอง ${esc(thMonthLong(loadedYm || ym))}</title>
<style>@page{size:A4 landscape;margin:12mm}body{font-family:Tahoma,sans-serif;font-size:11pt;color:#111}h1{font-size:16pt;margin:0 0 2px}h2{font-size:12pt;margin:0;font-weight:400}.meta{font-size:9.5pt;color:#555;margin:2px 0 10px}
table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:4px 6px;vertical-align:top}th{background:#f1f5f9;font-size:10pt}th.grp{border-bottom:2px solid #94a3b8}td.r,th.r{text-align:right;font-family:Consolas,monospace;white-space:nowrap}td.code{font-family:Consolas,monospace;white-space:nowrap}.sub{font-size:8.5pt;color:#666}
tr.grp td{background:#eef2ff;font-weight:700;padding:6px}tr.sub td{font-weight:700;background:#f8fafc}tr.total td{font-weight:800;border-top:2px solid #111;border-bottom:3px double #111;font-size:11.5pt}.note{margin-top:10px;font-size:9pt;color:#666}</style></head><body>
<h1>งบทดลอง (เฉพาะบัญชีที่ตรวจสอบกับ FlowAccount แล้ว — บัญชีธนาคาร + เงินสดย่อย + เงินกู้ยืมระหว่างบริษัท + สินค้าคงเหลือรถ + เงินมัดจำ)</h1><h2>${esc(title)}</h2>
<div class="meta">รอบ ${esc(thMonthLong(loadedYm || ym))} · สิ้นสุด ณ วันที่ ${esc(thDateLong(to))} · พิมพ์ ${new Date().toLocaleString("th-TH")}</div>
<table><thead><tr><th rowspan="2" style="text-align:left">รหัส</th><th rowspan="2" style="text-align:left">บัญชี</th><th colspan="2" class="grp">ยอดยกมา ${esc(thDateLong(prevDayOf(from)))}</th><th colspan="2" class="grp">ยอดประจำงวด</th><th colspan="2" class="grp">ยอดสะสม ${esc(thDateLong(to))}</th></tr>
<tr><th class="r">เดบิต</th><th class="r">เครดิต</th><th class="r">เดบิต</th><th class="r">เครดิต</th><th class="r">เดบิต</th><th class="r">เครดิต</th></tr></thead>
<tbody>${body}${tot("รวมทั้งสิ้น", grand, "total")}</tbody></table>
<div class="note">ที่มา: รายงานการเคลื่อนไหวบัญชีธนาคารในระบบ (ยอดยกมา = งบทดลอง Flow 31/08/69 + รายการตั้งแต่ 01/09/69 ถึงก่อนต้นงวด) · เงินสดย่อย 11149.00 รวมทุกบัญชีย่อยของสังกัด: เครดิต = ค่าน้ำมันรถใหม่/ของไหว้ตามวันที่ใบ + ค่าใช้จ่ายทั่วไป/ไปรษณีย์ตามวันเบิก PCW, เดบิต = เติมเท่าที่เบิก (วงเงินคงที่) · ยอดคงเหลือฝั่งเครดิต = บัญชีเงินเบิกเกินบัญชี (OD) · รหัสบัญชีตามผังบัญชี FlowAccount</div>
<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open("", "_blank"); if (!w) return; w.document.write(html); w.document.close();
  }

  const th = { padding: "7px 10px", fontSize: 12.5, fontWeight: 700, color: "#334155", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" };
  const td = { padding: "6px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
  const num = { ...td, textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" };
  const btn = (bg) => ({ padding: "8px 14px", borderRadius: 8, border: "none", background: bg, color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "Tahoma", fontSize: 13 });

  return (
    <div style={{ fontFamily: "Tahoma, sans-serif", padding: 20, background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: "#1e3a8a" }}>📒 งบทดลอง</h2>
        <span style={{ fontSize: 12.5, color: "#64748b" }}>เฉพาะบัญชีที่ตรวจสอบกับ FlowAccount แล้ว — ตอนนี้: บัญชีธนาคาร + เงินสดย่อย + เงินกู้ยืมระหว่างบริษัท + สินค้าคงเหลือรถ + เงินมัดจำ (เริ่มรอบ {thMonthLong(START_MONTH)})</span>
        <div style={{ flex: 1 }} />
        <button onClick={exportCsv} disabled={!shown.length} style={{ ...btn("#fff"), color: "#1e3a8a", border: "1px solid #1e3a8a" }}>⬇ Excel/CSV</button>
        <button onClick={printReport} disabled={!shown.length} style={btn("#1e3a8a")}>🖨 พิมพ์รายงาน</button>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 14 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600, display: "grid", gap: 4 }}>รอบระยะเวลารายงาน
          <input type="month" value={ym} min={START_MONTH} onChange={e => setYm(e.target.value)} style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 13 }} /></label>
        <label style={{ fontSize: 12.5, fontWeight: 600, display: "grid", gap: 4 }}>สังกัด
          <select value={company} onChange={e => setCompany(e.target.value)} style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 13, minWidth: 220 }}>
            <option value="">ทุกสังกัด (รวม)</option>
            {COMPANIES.map(c => <option key={c} value={c}>{COMPANY_FULL[c]}</option>)}
          </select></label>
        <button onClick={load} disabled={loading || !accounts.length} style={{ ...btn(loadedCompany === null ? "#059669" : "#0ea5e9"), opacity: loading ? 0.6 : 1, boxShadow: loadedCompany === null && !loading ? "0 0 0 3px #a7f3d0" : "none" }}>{loading ? `กำลังโหลด… ${progress}` : loadedCompany === null ? "▶ แสดงผลรายงาน" : "🔄 แสดงผลรายงาน"}</button>
        {loadedCompany === null && !loading && <span style={{ fontSize: 12.5, color: "#b45309", fontWeight: 600 }}>ยังไม่ได้ดึงข้อมูล — เลือกรอบและสังกัดแล้วกด "แสดงผลรายงาน"</span>}
        {needReload && !loading && <span style={{ fontSize: 12, color: "#b45309" }}>แสดงข้อมูลรอบ {thMonthLong(loadedYm)}{loadedCompany ? ` · ${loadedCompany}` : ""} อยู่ — กด "แสดงผลรายงาน" เพื่อโหลดตามตัวเลือกใหม่</span>}
      </div>
      {err && <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>{err}</div>}

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px 6px" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#0369a1" }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 10 }}>สิ้นสุด ณ วันที่ {thDateLong(to)} · ยอดยกมา ณ {thDateLong(prevDayOf(from))}</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...th, textAlign: "left" }}>รหัส</th>
                <th rowSpan={2} style={{ ...th, textAlign: "left" }}>บัญชี</th>
                <th colSpan={2} style={{ ...th, textAlign: "center", borderBottom: "2px solid #94a3b8" }}>ยอดยกมา</th>
                <th colSpan={2} style={{ ...th, textAlign: "center", borderBottom: "2px solid #22c55e", background: "#f0fdf4" }}>ยอดประจำงวด</th>
                <th colSpan={2} style={{ ...th, textAlign: "center", borderBottom: "2px solid #94a3b8" }}>ยอดสะสม</th>
              </tr>
              <tr>
                {["เดบิต", "เครดิต", "เดบิต", "เครดิต", "เดบิต", "เครดิต"].map((h, i) => <th key={i} style={{ ...th, textAlign: "right", color: i % 2 ? "#0891b2" : "#2563eb", background: i === 2 || i === 3 ? "#f0fdf4" : th.background }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 30 }}>กำลังโหลด {progress}…</td></tr>}
              {!loading && !shown.length && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 30 }}>{loadedCompany === null ? "เลือกรอบระยะเวลาและสังกัด แล้วกด \"แสดงผลรายงาน\"" : "ไม่มีข้อมูล"}</td></tr>}
              {!loading && groups.map(({ g, list }) => {
                const t = sumOf(list);
                return (
                  <React.Fragment key={g}>
                    <tr><td colSpan={8} style={{ ...td, background: "#eef2ff", color: "#3730a3", fontWeight: 700 }}>▾ สินทรัพย์ · {COMPANY_FULL[g] || g} · {list.filter(r => !r.kind).length} บัญชีธนาคาร{list.some(r => r.kind === "petty") ? " + เงินสดย่อย" : ""}{list.some(r => r.kind === "interco") ? " + เงินกู้ยืมระหว่างบริษัท" : ""}{list.some(r => r.kind === "inventory") ? " + สินค้าคงเหลือรถ" : ""}{list.some(r => r.kind === "ftdeposit") ? " + เงินมัดจำ" : ""}</td></tr>
                    {list.map(r => { const [a, b] = drcr(r.opening); const [c, d] = drcr(r.closing); return (
                      <tr key={r.account_id} style={r.kind === "petty" ? { background: "#fffbeb" } : r.kind === "interco" ? { background: "#f0f9ff" } : r.kind === "inventory" ? { background: "#f0fdf4" } : r.kind === "ftdeposit" ? { background: "#fdf4ff" } : undefined} title={r.kind === "ftdeposit" ? `เงินมัดจำรับจากลูกค้าตามเอกสารในระบบ (จองรถ DEP- / ป้ายแดง RPD- / อะไหล่ PDS- PDO-) · เครดิต = รับใหม่ · เดบิต = ตัดใช้ชำระ + คืนเงิน · คงค้าง = ยังไม่ตัด/ไม่คืน` : r.kind === "inventory" ? `สต๊อกรถใหม่ในระบบ ณ สิ้นงวด × ต้นทุนใบกำกับซื้อ ÷ 1.07 · ยกมา = มูลค่า ณ สิ้นเดือนก่อน · งวด = ผลต่างสุทธิ (เพิ่ม=เดบิต ลด=เครดิต)` : r.kind === "interco" ? `ยกมา = Flow 31/08/69 · โอนข้ามสังกัด (BTR) + ขายส่งตัดบัญชีกู้ยืม · ไม่รวมเงินสดสาขาฝากข้ามสังกัดและ JV ปิดยอดสิ้นเดือนของ Flow` : r.kind === "petty" ? `เงินสดย่อยรวมทุกสาขา ${r.count} เอกสาร · ยกมา = วงเงินตาม Flow 31/08/69 · เดบิต (เติมเงิน) ถือว่าเท่ากับที่เบิก (ระบบไม่มีบันทึกเติมเงิน)` : `รายการในงวด ${r.count} รายการ · ${r.flowOpening !== null ? `ยกมาอิงยอด Flow 31/08/69 = ${fmt(r.flowOpening)} + รายการตั้งแต่ 01/09/69` : `ยกมา = ยอดตั้งต้นบัญชี ${fmt(r.opening_balance)} (${r.opening_date ? String(r.opening_date).slice(0, 10) : "-"}) + รายการสะสมทั้งหมด (ยังไม่มียอด Flow 31/08)`}`}>
                        <td style={{ ...td, fontFamily: "monospace", color: r.code ? "#0369a1" : "#9ca3af", fontWeight: 600 }}>{r.code || "—"}{r.flowOpening === null && r.kind !== "inventory" && r.kind !== "ftdeposit" && <span title="ยังไม่มียอดยกมาจาก Flow 31/08/69 — ใช้ยอดตั้งต้นบัญชีในระบบ" style={{ marginLeft: 4, color: "#f59e0b" }}>*</span>}</td>
                        <td style={td}><div style={{ fontWeight: 600 }}>{r.bank_name} <span style={{ fontFamily: "monospace" }}>{r.account_no}</span></div><div style={{ fontSize: 11, color: "#64748b" }}>{r.account_name}{r.account_type ? ` · ${r.account_type}` : ""}</div></td>
                        <td style={num}>{cellNum(a)}</td><td style={{ ...num, color: "#0891b2" }}>{cellNum(b)}</td>
                        <td style={{ ...num, background: "#f7fef9" }}>{cellNum(r.dr)}</td><td style={{ ...num, background: "#f7fef9", color: "#0891b2" }}>{cellNum(r.cr)}</td>
                        <td style={{ ...num, fontWeight: 700, color: "#1d4ed8" }}>{cellNum(c)}</td><td style={{ ...num, fontWeight: 700, color: "#0891b2" }}>{cellNum(d)}</td>
                      </tr>); })}
                    {groups.length > 1 && (
                      <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                        <td colSpan={2} style={td}>รวม {g}</td>
                        <td style={num}>{fmt(t.oDr)}</td><td style={num}>{fmt(t.oCr)}</td><td style={num}>{fmt(t.dr)}</td><td style={num}>{fmt(t.cr)}</td><td style={num}>{fmt(t.cDr)}</td><td style={num}>{fmt(t.cCr)}</td>
                      </tr>)}
                  </React.Fragment>);
              })}
              {!loading && shown.length > 0 && (
                <tr style={{ background: "#fef9c3", fontWeight: 800, borderTop: "2px solid #111" }}>
                  <td colSpan={2} style={td}>รวมทั้งสิ้น</td>
                  <td style={num}>{fmt(grand.oDr)}</td><td style={num}>{fmt(grand.oCr)}</td><td style={num}>{fmt(grand.dr)}</td><td style={num}>{fmt(grand.cr)}</td><td style={num}>{fmt(grand.cDr)}</td><td style={num}>{fmt(grand.cCr)}</td>
                </tr>)}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11.5, color: "#64748b", padding: "10px 0 6px", lineHeight: 1.6 }}>
          ยอดยกมา = ยอดตามงบทดลอง Flow ณ 31/08/69 + รายการในระบบตั้งแต่ 01/09/69 ถึงวันก่อนต้นงวด (บัญชีที่มี * ยังไม่มียอด Flow ใช้ยอดตั้งต้นบัญชีในระบบ) · ยอดประจำงวดจากรายงานการเคลื่อนไหว · เงินสดย่อย (11149.00) รวมทุกบัญชีย่อยของสังกัด: เครดิต = ค่าน้ำมันรถใหม่/ของไหว้ตามวันที่ใบ + ค่าใช้จ่ายทั่วไป/ไปรษณีย์ตามวันเบิก PCW, เดบิต = เติมเท่าที่เบิก (วงเงินคงที่ ระบบไม่มีบันทึกเติมเงิน) · เงินให้กู้ยืมระหว่างบริษัท (11451) = โอนเงินข้ามสังกัด + ขายส่งอะไหล่ที่ตัดผ่านบัญชีกู้ยืม (ยกมา Flow 31/08) ยังไม่รวมเงินสดสาขาที่ฝากข้ามสังกัดและ JV ปิดยอดสิ้นเดือนของ Flow · สินค้าคงเหลือรถ (11513) = สต๊อกรถใหม่ในระบบ ณ สิ้นงวด (รับรถ − ขาย) × ต้นทุนใบกำกับซื้อ ÷ 1.07 ยกมา = มูลค่า ณ สิ้นเดือนก่อน งวด = ผลต่างสุทธิ · เงินมัดจำ (11921) = เงินมัดจำรับจากลูกค้าตามเอกสารในระบบ รวมจองรถ/ป้ายแดง/อะไหล่ (เครดิต = รับใหม่, เดบิต = ตัดใช้ + คืน, คงค้างฝั่งเครดิต) ไม่ได้อิงยอด Flow · ยอดคงเหลือฝั่งเครดิต = บัญชีเงินเบิกเกินบัญชี (OD) · รหัสบัญชีตามผังบัญชี FlowAccount บัญชีที่แสดง "—" ยังไม่ได้ระบุรหัส
        </div>
      </div>
    </div>
  );
}
