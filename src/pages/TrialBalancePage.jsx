import React, { useEffect, useMemo, useState } from "react";
import { AP_START, loadPayableDocs, payablesAsOf } from "../lib/accountsPayable";
import { AR_INCOME_START, loadReceivableDocs, receivablesAsOf } from "../lib/accountsReceivable";

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
  "2081066461": "11122.05", // กสิกรไทย ออมทรัพย์ (user 2026-11-06) — ยอด 31/08/69 ตาม Flow 5,859.52 (ไฟล์งบทดลอง ป.เปา 12/11/69)
  // ห้างหุ้นส่วนจำกัด สิงห์ชัยสยามยนต์
  "7393004553": "11121.01", // ไทยพาณิชย์
  "4691006757": "11121.02", // กสิกรไทย กระแสรายวัน
  "1881036188": "11121.05", // ทหารไทยธนชาต (OD)
  "0170342026": "11121.08", // กรุงไทย (OD)
  "2490309131": "11122.01", // กรุงเทพ
  "211-3-80125-8": "11122.06", // กสิกรไทย ออมทรัพย์ (Flow เขียน 2113801258)
  // บัญชีไม่เคลื่อนไหวตามงบทดลอง Flow ก.ย.69 — ใช้เมื่อเพิ่มเป็นบัญชีสถานะ "ใช้งานแต่ไม่เคลื่อนไหว" ในระบบ (แถวคงที่ FLOW_STATIC_BANKS จะหายเอง)
  "9821910769": "11122.02", "0022207526": "11122.04",                                              // ป.เปา: กรุงไทย · ไทยเครดิต
  "9821902111": "11121.06", "4692180734": "11122.03", "0022207441": "11122.04", "7392867592": "11122.05", // สิงห์ชัย: กรุงไทย · กสิกรไทย · ไทยเครดิต · ไทยพาณิชย์
  // user 2026-11-12 เพิ่ม 5 บัญชีสิงห์ชัยเป็น "ใช้งานแต่ไม่เคลื่อนไหว" ในระบบ (account_id 19–23) — กรุงศรีอยุธยา Flow ไม่ได้เขียนเลขบัญชี · ไทยพาณิชย์ user แจ้ง 739-256-759-2 (ไฟล์ Flow เขียน 7392867592 ต่างกัน 1 หลัก) ใส่ไว้ทั้งสองเลข
  "0561355331": "11121.03", "7392567592": "11122.05",
};
// ยอดยกมา ณ 31/08/2569 ตามงบทดลอง/GL ของ Flow (สำนักงานบัญชีปิดงบถึง ส.ค. แล้ว) — รอบ ก.ย. เป็นต้นไปใช้ยอดนี้ + รายการในระบบตั้งแต่ 01/09/2569
// (ยอดตั้งต้นบัญชี + รายการ เม.ย.–ส.ค. ในระบบยังไม่ได้กระทบกับ Flow จึงไม่ใช้) · บัญชีที่ไม่มีในตารางนี้ใช้วิธีเดิม = ยอดตั้งต้น + รายการสะสมทั้งหมด
const FLOW_OPENING_0831 = {
  "4691003766": 2080938.74, "7393004545": 217045.78, "9898991615": 1963466.14, "2490391139": 202420.16, "2081066461": 5859.52,
  "7393004553": 33159.70, "4691006757": 1071531.92, "1881036188": -7272232.75, "0170342026": -7799916.08, "2490309131": 535136.90, "211-3-80125-8": 166.23,
  "9821910769": 7955.31, "0022207526": 7102.60, "9821902111": 10000.00, "4692180734": 19644.86, "0022207441": 137893.73, "7392867592": 202425.92, // บัญชีไม่เคลื่อนไหว
  "0561355331": 6934.19, "7392567592": 202425.92, // สิงห์ชัย กรุงศรีอยุธยา · ไทยพาณิชย์ (เลขตามที่ user แจ้ง)
};
const FLOW_OPENING_DATE = "2026-09-01";
// บัญชีธนาคารที่อยู่ในงบทดลอง Flow แต่ไม่ได้ตั้งเป็นบัญชีในระบบ (ไม่มีความเคลื่อนไหว) — user 2026-11-12 ส่งไฟล์งบทดลอง ป.เปา ก.ย.69 "เพิ่มเลขที่บัญชีให้ด้วย"
//   แสดงยอดคงที่ตาม Flow (ยกมา = คงเหลือ) · ถ้าภายหลังเพิ่มบัญชีเลขนี้ในระบบ แถวคงที่จะหายเอง (ใช้ข้อมูลระบบแทน)
const FLOW_STATIC_BANKS = [
  { company: "ป.เปา", code: "11122.02", bank_name: "กรุงไทย", account_no: "9821910769", balance: 7955.31 },
  { company: "ป.เปา", code: "11122.04", bank_name: "ไทยเครดิต เพื่อรายย่อย", account_no: "0022207526", balance: 7102.60 },
  // สิงห์ชัย (ไฟล์งบทดลอง สิงห์ชัย ก.ย.69)
  { company: "สิงห์ชัย", code: "11121.03", bank_name: "กรุงศรีอยุธยา", account_no: "0561355331", balance: 6934.19 },
  { company: "สิงห์ชัย", code: "11121.06", bank_name: "กรุงไทย", account_no: "9821902111", balance: 10000.00 },
  { company: "สิงห์ชัย", code: "11122.03", bank_name: "กสิกรไทย", account_no: "4692180734", balance: 19644.86 },
  { company: "สิงห์ชัย", code: "11122.04", bank_name: "ไทยเครดิต เพื่อรายย่อย", account_no: "0022207441", balance: 137893.73 },
  { company: "สิงห์ชัย", code: "11122.05", bank_name: "ไทยพาณิชย์", account_no: "7392567592", balance: 202425.92 },
];
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
  src.booking.filter(x => x && x.deposit_no).forEach(x => { const cc = companyOfBranch(x.branch_code); recv.push([d10(x.deposit_date), x.deposit_amount, cc]); if (x.status === "refunded" || n(x.refund_amount) > 0) ref.push([d10(x.refunded_at || x.updated_at), n(x.refund_amount) || n(x.deposit_amount), cc]);
    // ยึดเงินมัดจำจองรถ (ยกเลิกใบจองแบบยึด → booking_deposits.status 'seized' 2026-11-07) → เดบิตตามวันยึด (หนี้สินลด กลายเป็นรายได้) นับรวมฝั่งตัดใช้
    if (x.status === "seized") used.push([d10(x.seized_at || x.updated_at), x.deposit_amount, cc]);
    // ตัดชำระค่ารถใน DMS ก่อนเริ่มระบบขาย NEW (status 'used' ปิดด้วย SQL ตามรายงาน DMS 2026-11-07) → ตัดใช้ตามวันขาย DMS
    if (x.status === "used") used.push([d10(x.used_at || x.updated_at), x.deposit_amount, cc]); });
  src.sales.filter(x => x && x.bd_deposit_no && x.sale_status !== "cancelled" && n(x.booking_deposit) > 0).forEach(x => used.push([d10(x.sale_date), x.booking_deposit, companyOfBranch(x.branch_code)]));
  src.redPlate.filter(x => x && x.deposit_no && x.status !== "cancelled").forEach(x => { const cc = companyOfBranch(x.branch_code); recv.push([d10(x.received_date), x.amount, cc]); if (x.status === "refunded" || n(x.refund_amount) > 0) ref.push([d10(x.refund_date || x.updated_at), n(x.refund_amount) || n(x.amount), cc]);
    if (x.status === "seized") used.push([d10(x.seized_at || x.updated_at), x.amount, cc]); /* ยึดมัดจำป้ายแดง 2026-11-07 → เดบิตวันยึด */ });
  src.parts.filter(x => x && x.deposit_doc_no && x.status !== "cancelled" && !x.cancelled_at).forEach(x => { const cc = companyOfBranch(x.branch_code); recv.push([d10(x.deposit_date), x.deposit_amount, cc]);
    if (n(x.refunded_amount) > 0) ref.push([d10(x.refunded_at || x.updated_at), x.refunded_amount, cc]);
    // ยึดมัดจำ (seized_amount จากเมนูยึดเงินมัดจำ ตัด remaining ตอนยึด 2026-11-07) → เดบิตตามวันที่ยึด (หนี้สินลด กลายเป็นรายได้) นับรวมในฝั่งตัดใช้
    if (n(x.seized_amount) > 0) used.push([d10(x.seized_at || x.updated_at), x.seized_amount, cc]);
    const u = Math.max(n(x.deposit_amount) - n(x.remaining_amount) - n(x.refunded_amount) - n(x.seized_amount), 0); if (u > 0.004) used.push([d10(x.updated_at || x.deposit_date), u, cc]); });
  const R = sumEvents(recv, c, from, to), U = sumEvents(used, c, from, to), F = sumEvents(ref, c, from, to);
  const bal = (k) => r2(R[k] - U[k] - F[k]);
  const cnt = (ev) => ev.filter(([d, , cc]) => cc === c && d >= from && d <= to).length;
  return { account_id: "custdep-" + c, kind: "ftdeposit", company: c, code: FT_DEPOSIT_CODE, bank_name: "เงินมัดจำรับจากลูกค้า", account_no: "",
    account_name: `จองรถ + ป้ายแดง + อะไหล่ · รับ ${cnt(recv)} ใบ ${fmt(R.inPeriod)} · ตัดใช้ ${cnt(used)} ใบ ${fmt(U.inPeriod)} · คืน ${cnt(ref)} ใบ ${fmt(F.inPeriod)}`,
    account_type: "หนี้สิน (ยอดคงค้างฝั่งเครดิต) · ตามเอกสารมัดจำในระบบ", flowOpening: null,
    opening: -bal("before"), dr: r2(U.inPeriod + F.inPeriod), cr: r2(R.inPeriod), closing: -bal("upTo"), count: cnt(recv) + cnt(used) + cnt(ref) };
}

// ---- เงินสดในมือ 11111 (user 2026-11-12 "แสดงยอดเงินสดในมือ ณ สิ้นงวด = เงินที่รับชำระแล้วยังไม่ได้นำฝากธนาคาร ดูจากเงินที่ยังไม่ได้นำฝาก") ----
// แหล่งข้อมูล: ใบฝากเงิน (finance-api list_bank_deposits) — แต่ละใบมีป้าย "ฝากเงินสดประจำวัน YYYY-MM-DD" = วันที่รับเงิน (เงินสดรับสุทธิของสาขา) และวันที่ฝากจริง
//   ใบเก่าก่อนมีป้าย (ก่อน 04/09/69) ถือว่าเป็นเงินของวันก่อนวันฝาก 1 วัน (หลักการเดียวกับแท็บกระทบยอดฝากเงิน)
//   เดบิต = เงินสดรับสุทธิของวันในงวด (ตามวันที่รับเงิน) · เครดิต = นำฝากธนาคารในงวด (ตามวันที่ฝาก)
//   ยกมา = เงินของวันก่อนต้นงวดที่ฝากตั้งแต่ต้นงวด · คงเหลือ = เงินของวันถึงสิ้นงวดที่ฝากหลังสิ้นงวด (เช่น เงินรับ 30/09 ฝาก 01/10)
//   สังกัดตาม "บัญชีที่นำฝาก" (to_account_name) — เงินสดทุกสาขาฝากเข้าบัญชี ป.เปา ทั้งหมด งบทดลอง Flow จึงลง 11111 ไว้ในเล่ม ป.เปา เล่มเดียว
//   (เวอร์ชันแรกแยกตามสาขาที่รับเงิน: ป.เปา 5,790.00 → 7,288.11 · สิงห์ชัย 32,248.00 → 25,020.00 — แก้ 2026-11-12 หลังได้ไฟล์งบทดลอง ป.เปา)
// ตรวจ ก.ย.69 กับงบทดลอง Flow ป.เปา (11111): ยกมา 38,038.00 / คงเหลือ 32,308.11 ตรงกันทั้งสองยอด
//   ยอดประจำงวดของระบบสูงกว่า Flow เท่ากันทั้งเดบิต/เครดิต (สุทธิเท่ากัน): ก.ย. 229,998.65 · ต.ค. 100,000.00 = ใบฝากเงินสดเข้า "เงินสดย่อยทั่วไป" (ก.ย. 230,000 · ต.ค. 100,000)
//   ซึ่ง Flow ลงเติมเงินสดย่อยจากบัญชี 11112 เงินสดคงเหลือโดยตรง ไม่ผ่าน 11111 (ตรวจกับ GL 11111/11112 ต.ค.69 เมื่อ 2026-11-12: ยกมา 32,308.11 / คงเหลือ 182,644.34 ตรง Flow)
// ⚠️ เงินสดที่ยังไม่มีใบฝากเลย (ยังไม่ได้บันทึกฝาก) จะยังไม่ขึ้นเป็นคงเหลือ จนกว่าจะบันทึกใบฝากของวันนั้น
const CASH_CODE = "11111";
const FINANCE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/finance-api";
const bkkDate = (v) => { const d = new Date(v); return isNaN(d) ? String(v || "").slice(0, 10) : d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); };
const addDaysIso = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
async function loadCashOnHandRows(from, to, companies) {
  // ใบฝากที่ฝากตั้งแต่ต้นงวดถึงหลังสิ้นงวด 62 วัน (เผื่อเงินปลายงวดที่ฝากช้า) — ใบที่ฝากก่อนต้นงวดไม่เกี่ยวกับงวดนี้แล้ว
  const list = (await postAny(FINANCE_API, { action: "list_bank_deposits", date_from: from, date_to: addDaysIso(to, 62) }))
    .filter(d => d && d.deposit_id && !/cancel|ยกเลิก/i.test(String(d.status || "")));
  const ev = list.map(d => {
    const dep = bkkDate(d.deposit_date);
    const m = String(d.source || "").match(/ฝากเงินสดประจำวัน (\d{4}-\d{2}-\d{2})/);
    return { work: m ? m[1] : addDaysIso(dep, -1), dep, amt: Number(d.amount || 0), company: (compOfName(d.to_account_name) !== "อื่น ๆ" ? compOfName(d.to_account_name) : companyOfBranch(d.branch_code || d.branch_name)), branch: String(d.branch_code || "").slice(0, 5) };
  }).filter(e => e.dep >= from);
  return companies.map(c => {
    const E = ev.filter(e => e.company === c);
    const sum = (f) => r2(E.filter(f).reduce((t, e) => t + e.amt, 0));
    const opening = sum(e => e.work < from);                     // เงินก่อนต้นงวด ที่นำฝากตั้งแต่ต้นงวด
    const dr = sum(e => e.work >= from && e.work <= to);          // เงินสดรับสุทธิของวันในงวด
    const cr = sum(e => e.dep <= to);                             // นำฝากในงวด
    const held = E.filter(e => e.work <= to && e.dep > to);       // ค้างในมือ ณ สิ้นงวด
    const closing = r2(held.reduce((t, e) => t + e.amt, 0));
    const days = [...new Set(held.map(e => e.work))].sort();
    return { account_id: "cash-" + c, kind: "cash", company: c, code: CASH_CODE, bank_name: "เงินสดในมือ", account_no: "",
      account_name: held.length ? `ยังไม่ได้นำฝาก ณ สิ้นงวด ${held.length} ใบ (เงินรับวันที่ ${days.map(d => d.slice(8, 10) + "/" + d.slice(5, 7)).join(", ")}) · ${held.map(e => `${e.branch} ${fmt(e.amt)}`).join(" · ")}` : "ไม่มีเงินสดค้างนำฝาก ณ สิ้นงวด",
      account_type: "เงินสดรับสุทธิของทุกสาขาที่ยังไม่ได้นำฝากธนาคาร (จากใบฝากเงิน · สังกัดตามบัญชีที่นำฝาก)", flowOpening: null, opening, dr, cr, closing, count: E.length, held };
  }).filter(r => r.count > 0 || Math.abs(r.opening) > 0.004 || Math.abs(r.closing) > 0.004);
}

// ---- หนี้สิน: เงินกู้ยืมธนาคาร 224xx (user 2026-11-12 "ฝั่งหนี้สิน เพิ่มบัญชีเงินกู้ยืมธนาคาร") ----
// แหล่งข้อมูล: เมนูบัญชีเงินกู้ (accounting-api list_loan_accounts — current_balance = ยอดคงค้างล่าสุด ระบบลดให้ทุกครั้งที่บันทึกจ่าย)
//   + บันทึกจ่ายดอกเบี้ย/เงินต้น (list_loan_interest_payments: principal_amount / interest_amount ต่อครั้ง)
// ยอดคงค้าง ณ วันที่ D = current_balance + เงินต้นที่จ่ายหลังวัน D (ย้อนจากยอดปัจจุบัน) · ก่อนวันเบิกเงินกู้ (start_date ของบัญชีที่มี principal) = 0
//   เดบิต = เงินต้นที่จ่ายในงวด · เครดิต = เงินกู้เบิกใหม่ในงวด (principal ของบัญชีที่ start_date อยู่ในงวด) · ยกมา/คงเหลือแสดงฝั่งเครดิต · ดอกเบี้ยไม่เข้าบัญชีนี้ (เป็นค่าใช้จ่าย)
// ตรวจ ก.ย.69 กับงบทดลอง Flow (ป.เปา): 22497 ไทยเครดิต 4,221,986.81 − 57,688.26 = 4,164,298.55 · 22498 กสิกร 2,202,422.87 − 50,964.27 = 2,151,458.60 · 22499 กสิกร 1,535,197.70 − 33,783.68 = 1,501,414.02 ตรงทั้ง 3 บัญชี
// ตรวจ ก.ย.69 กับงบทดลอง Flow (สิงห์ชัย — ไฟล์ 12/11/69): 22494 กสิกร 100074706988 3,839,421.16 − 84,355.09 = 3,755,066.07 และ 22495 กสิกร 100079990331 2,862,754.46 − 47,064.68 = 2,815,689.78 ตรงทั้งคู่
//   ⚠️ 22461 ทหารไทย 188-5-72110-8: จ่ายเงินต้น 16,884.77 ตรง แต่ยอดคงค้างระบบ 2,810,959.81 สูงกว่า Flow 2,803,966.35 อยู่ 6,993.46 (ยอดตั้งต้นในบัญชีเงินกู้ของระบบกับ Flow ไม่เท่ากัน — รอ user ตรวจกับ statement เงินกู้)
// รหัสบัญชี Flow แมปจากเลขบัญชีเงินกู้ (ตัวเลขล้วน)
const FLOW_LOAN_CODES = {
  "0901024199435": "22497", "100073886982": "22498", "100074706783": "22499",   // ป.เปา
  "1885721108001": "22461", "100074706988": "22494", "100079990331": "22495",    // สิงห์ชัย (22461 = ทหารไทย 188-5-72110-8 001)
};
async function loadLoanRows(from, to, companies) {
  const prev = prevDayOf(from);
  const [loans, pays] = await Promise.all([
    post({ action: "list_loan_accounts" }),
    post({ action: "list_loan_interest_payments", date_from: from, date_to: "2099-12-31" }), // ต้องใช้ทุกรายการตั้งแต่ต้นงวดถึงปัจจุบัน เพื่อย้อนยอดคงค้าง
  ]);
  const P = pays.filter(p => p && p.payment_id && p.loan_id && String(p.status || "active") === "active").map(p => ({ loan_id: String(p.loan_id), d: String(p.payment_date || "").slice(0, 10), principal: Number(p.principal_amount || 0), interest: Number(p.interest_amount || 0), acct: p.account_name || "" }));
  return loans.filter(l => l && l.loan_id && String(l.status || "active") !== "cancelled" && String(l.loan_type || "ธนาคาร") === "ธนาคาร").map(l => {
    const mine = P.filter(p => p.loan_id === String(l.loan_id));
    let c = compOfName(l.loan_name); if (c === "อื่น ๆ") c = compOfName(l.deposit_account); if (c === "อื่น ๆ") c = compOfName((mine.find(p => p.acct) || {}).acct);
    const cur = Number(l.current_balance || 0), principal = Number(l.principal || 0), start = String(l.start_date || "").slice(0, 10);
    const drawn = principal > 0 && start; // บัญชีที่ระบบรู้วันเบิกเงินกู้ (บัญชียกยอดมา principal = 0 ถือว่ามีหนี้มาก่อนแล้ว)
    const balAt = (D) => (drawn && D < start ? 0 : r2(cur + mine.filter(p => p.d > D).reduce((t, p) => t + p.principal, 0)));
    const inP = mine.filter(p => p.d >= from && p.d <= to);
    const dr = r2(inP.reduce((t, p) => t + p.principal, 0));
    const interest = r2(inP.reduce((t, p) => t + p.interest, 0));
    const cr = drawn && start >= from && start <= to ? r2(principal) : 0;
    const opening = balAt(prev), closing = balAt(to);
    const lender = String(l.lender || l.loan_name || "").replace(/^บมจ\.?\s*/, "").trim();
    return { account_id: "loan-" + l.loan_id, kind: "loan", company: c, code: FLOW_LOAN_CODES[normNo(l.account_no)] || "", bank_name: `เงินกู้ยืม-${/^ธนาคาร/.test(lender) ? lender : "ธนาคาร" + lender}`, account_no: String(l.account_no || "").trim(),
      account_name: `${String(l.loan_name || "").trim()} · จ่ายเงินต้นในงวด ${fmt(dr)} (${inP.length} ครั้ง) · ดอกเบี้ย ${fmt(interest)}${Number(l.interest_rate) > 0 ? ` · อัตรา ${Number(l.interest_rate)}%` : ""}`,
      account_type: "หนี้สิน (ยอดคงค้างฝั่งเครดิต) · จากบัญชีเงินกู้ + บันทึกจ่ายเงินต้น/ดอกเบี้ย", flowOpening: null, opening: -opening, dr, cr, closing: -closing, count: inP.length };
  }).filter(r => companies.includes(r.company) && (Math.abs(r.opening) > 0.004 || Math.abs(r.closing) > 0.004 || r.dr > 0.004 || r.cr > 0.004));
}

// ---- หนี้สิน: ภาษีหัก ณ ที่จ่ายค้างจ่าย 27121 / 27123 / 27124 (user 2026-11-12 "เพิ่มบัญชีภาษีค้างจ่ายเหล่านี้") ----
// แหล่งข้อมูล: ใบนำส่งภาษี (tax-remittance-api list_tax_remittances) ประเภท ภ.ง.ด.1 / ภ.ง.ด.3 / ภ.ง.ด.53 — แต่ละใบมี งวดภาษี (period_month YYYYMM = เดือนที่หักไว้) และวันที่นำส่ง (remit_date)
//   เครดิต = ภาษีที่หักไว้ของงวดเดือนนั้น · เดบิต = นำส่งสรรพากรในงวด (ปกติคือยอดของเดือนก่อน) · ยกมา/คงค้าง = หักไว้แล้วแต่นำส่งหลังวันตัดงวด (แสดงฝั่งเครดิต)
//   หลักเดียวกับเงินสดในมือ (ใบฝาก): ใช้เอกสารจ่ายจริงย้อนหางวด — ⚠️ งวดที่ยังไม่ได้บันทึกนำส่งจะยังไม่ขึ้นเป็นยอดคงค้าง
// ตรวจ ก.ย.69 กับงบทดลอง Flow: ป.เปา 27121 14,079.18/14,079.18 · 27123 5,959.82/10,886.43 · 27124 6,837.94/22,295.49 — สิงห์ชัย 27121 9,870.53/9,870.53 · 27123 6,301.09/5,701.19 · 27124 2,346.02/2,922.82
//   ตรงกับ Flow ทุกบัญชี ต่างเฉพาะเศษสตางค์ (ภ.ง.ด.3 ±0.01 · ยอดยกมา ภ.ง.ด.1 ของ Flow ต่ำกว่า 0.26 / 1.31 จากการปัดเศษสะสมเดือนก่อน ๆ)
const TAX_REMIT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/tax-remittance-api";
const WHT_ACCOUNTS = [
  { tax_type: "ภ.ง.ด.1", code: "27121", name: "ภาษีหัก ณ ที่จ่าย - ภ.ง.ด. 1" },
  { tax_type: "ภ.ง.ด.3", code: "27123", name: "ภาษีหัก ณ ที่จ่าย - ภ.ง.ด. 3" },
  { tax_type: "ภ.ง.ด.53", code: "27124", name: "ภาษีหัก ณ ที่จ่าย - ภ.ง.ด. 53" },
];
async function loadWhtRows(from, to, companies) {
  const ymKey = from.slice(0, 7).replace("-", ""); // YYYYMM ของงวดรายงาน
  const list = (await postAny(TAX_REMIT_API, { action: "list_tax_remittances" }))
    .filter(r => r && r.remit_doc_no && !/cancel|ยกเลิก/i.test(String(r.status || "")) && WHT_ACCOUNTS.some(a => a.tax_type === String(r.tax_type || "").trim()))
    .map(r => ({ type: String(r.tax_type).trim(), company: compOfName(r.affiliation), period: String(r.period_month || "").replace(/[^0-9]/g, "").slice(0, 6), paid: String(r.remit_date || "").slice(0, 10), amt: Number(r.amount_total || 0) }))
    .filter(e => e.period.length === 6 && e.paid);
  const out = [];
  companies.forEach(c => WHT_ACCOUNTS.forEach(a => {
    const E = list.filter(e => e.company === c && e.type === a.tax_type);
    const sum = (f) => r2(E.filter(f).reduce((t, e) => t + e.amt, 0));
    const opening = sum(e => e.period < ymKey && e.paid >= from);   // หักไว้ก่อนงวด นำส่งตั้งแต่ต้นงวด
    const cr = sum(e => e.period === ymKey);                         // หักไว้ในงวดนี้
    const dr = sum(e => e.paid >= from && e.paid <= to);             // นำส่งในงวด
    const closing = sum(e => e.period <= ymKey && e.paid > to);      // คงค้าง ณ สิ้นงวด
    if (!E.length || (opening < 0.005 && closing < 0.005 && dr < 0.005 && cr < 0.005)) return;
    const paidN = E.filter(e => e.paid >= from && e.paid <= to).length;
    out.push({ account_id: `wht-${c}-${a.code}`, kind: "wht", company: c, code: a.code, bank_name: a.name, account_no: "",
      account_name: `หักไว้งวด ${from.slice(5, 7)}/${Number(from.slice(0, 4)) + 543} ${fmt(cr)} · นำส่งในงวด ${fmt(dr)} (${paidN} ใบ)${cr < 0.005 ? " · งวดนี้ยังไม่มีใบนำส่ง (ยังไม่บันทึกนำส่ง หรือไม่มีภาษีหัก)" : ""}`,
      account_type: "หนี้สิน (ยอดคงค้างฝั่งเครดิต) · จากใบนำส่งภาษี ภ.ง.ด.", flowOpening: null, opening: -opening, dr, cr, closing: -closing, count: paidN });
  }));
  return out;
}

// ---- สินทรัพย์ภาษี: 17120 ภาษีถูกหัก ณ ที่จ่าย + 17130 ภาษีนิติบุคคลจ่ายล่วงหน้า (ภ.ง.ด.51 ยื่นกลางปี) — user 2026-11-12 ----
// แหล่งข้อมูล: (ก) ใบบันทึกรายได้ (finance-api income_record list — wht_amount ของใบที่รับเงินแล้ว ตามวันที่รับเงิน paid_at) = ภาษีที่ลูกค้าหักเราไว้
//             (ข) เมนูยื่นภาษี ภ.ง.ด.50/51 (income-tax-api list): amount = เงินที่จ่าย · wht_credit_amount = ภาษีถูกหักที่นำมาเครดิต → ภาษีตามแบบ = amount + wht_credit_amount
// 17130: เดบิต = ภาษีตามแบบ ภ.ง.ด.51 ณ วันยื่น · เครดิต = ล้างออกเมื่อยื่น ภ.ง.ด.50 ของรอบปีเดียวกัน · คงเหลือ = ภ.ง.ด.51 ที่ยังไม่ได้ล้าง
// 17120: ยกมา = ยอด Flow 31/08/69 (สะสมตั้งแต่ต้นปี ระบบมีใบรายได้ไม่ครบปี) + รายการตั้งแต่ 01/09 · เดบิต = ภาษีถูกหักจากใบรายได้ที่รับเงินในงวด · เครดิต = เครดิตที่ใช้ตอนยื่น ภ.ง.ด.50/51 ในงวด
// ตรวจ ก.ย.69 กับงบทดลอง Flow: 17130 ป.เปา 560,000.00 / สิงห์ชัย 205,500.00 (= เงินจ่าย 475,923.34 / 104,938.68 + เครดิต 84,076.66 / 100,561.32) · 17120 เครดิต 84,076.66 / 100,561.32 ตรง
//   17120 เดบิต ระบบ 11,954.04 / 23,399.04 เทียบ Flow 11,996.04 / 23,363.94 — สิงห์ชัยต่าง 35.10 จาก 2 ใบเล็กของไทยยามาฮ่าที่ลงคนละเดือน (39.60 กับ 4.50) · ป.เปา ต่าง 42.00 ยังไม่พบที่มา
// ⚠️ ถ้ายังไม่ได้รัน Income_Tax_WHT_Credit_DDL.sql / ยังไม่กรอกเครดิตในใบยื่น: 17130 จะแสดงเฉพาะเงินที่จ่าย และ 17120 ไม่มีเครดิต (หน้าจะเขียนกำกับ)
const INCOME_TAX_API = "https://n8n-new-project-gwf2.onrender.com/webhook/income-tax-api";
const WHT_RECV_CODE = "17120", CIT_PREPAID_CODE = "17130";
const WHT_RECV_OPENING_0831 = { "ป.เปา": 146047.26, "สิงห์ชัย": 400915.43 }; // งบทดลอง Flow 31/08/69
async function loadTaxAssetRows(from, to, companies) {
  const prev = prevDayOf(from);
  const [filingsRaw, docsRaw] = await Promise.all([
    postAny(INCOME_TAX_API, { action: "list", status: "active" }),
    postAny(FINANCE_API, { action: "income_record", op: "list", date_from: "2026-01-01", date_to: "2099-12-31" }),
  ]);
  const filings = filingsRaw.filter(f => f && f.id && String(f.status || "active") === "active").map(f => ({ form: String(f.tax_form || "").trim(), year: Number(f.tax_year) || 0, company: compOfName(f.affiliation), d: String(f.filing_date || "").slice(0, 10), paid: Number(f.amount || 0), credit: Number(f.wht_credit_amount || 0), doc: f.doc_no }));
  const wht = docsRaw.filter(d => d && d.income_doc_no && String(d.status || "") !== "cancelled" && Number(d.wht_amount) > 0.004 && d.paid_at)
    .map(d => ({ company: compOfName(d.affiliation), d: bkkDate(d.paid_at), amt: Number(d.wht_amount || 0) }));
  const out = [];
  companies.forEach(c => {
    // ---- 17130 ภาษีนิติบุคคลจ่ายล่วงหน้า ----
    const f51 = filings.filter(f => f.company === c && f.form === "ภ.ง.ด.51" && f.d);
    const f50 = filings.filter(f => f.company === c && f.form === "ภ.ง.ด.50" && f.d);
    const ev = []; // [date, +เดบิต/−เครดิต]
    f51.forEach(f => { const gross = r2(f.paid + f.credit); ev.push([f.d, gross]); const clr = f50.find(x => x.year === f.year && x.d >= f.d); if (clr) ev.push([clr.d, -gross]); });
    const citOpen = r2(ev.filter(([d]) => d <= prev).reduce((t, [, v]) => t + v, 0));
    const citDr = r2(ev.filter(([d, v]) => d >= from && d <= to && v > 0).reduce((t, [, v]) => t + v, 0));
    const citCr = r2(ev.filter(([d, v]) => d >= from && d <= to && v < 0).reduce((t, [, v]) => t - v, 0));
    const inP51 = f51.filter(f => f.d >= from && f.d <= to);
    if (Math.abs(citOpen) > 0.004 || citDr > 0.004 || citCr > 0.004) {
      const noCredit = inP51.some(f => f.credit < 0.005);
      out.push({ account_id: "cit-" + c, kind: "citprepaid", company: c, code: CIT_PREPAID_CODE, bank_name: "ภาษีนิติบุคคลจ่ายล่วงหน้า", account_no: "",
        account_name: inP51.length ? inP51.map(f => `ภ.ง.ด.51 ปี ${f.year} (${f.doc}) เงินจ่าย ${fmt(f.paid)} + เครดิตภาษีถูกหัก ${fmt(f.credit)}`).join(" · ") + (noCredit ? " · ⚠ ยังไม่ได้กรอกเครดิตภาษีถูกหัก ณ ที่จ่ายในใบยื่น — ยอดนี้เป็นเฉพาะเงินที่จ่าย" : "") : "ภ.ง.ด.51 ที่ยื่นแล้ว รอล้างเมื่อยื่น ภ.ง.ด.50 ของรอบปีเดียวกัน",
        account_type: "ภาษีตามแบบ ภ.ง.ด.51 (เงินจ่าย + เครดิตภาษีถูกหัก) · จากเมนูยื่นภาษี", flowOpening: null, opening: citOpen, dr: citDr, cr: citCr, closing: r2(citOpen + citDr - citCr), count: inP51.length });
    }
    // ---- 17120 ภาษีถูกหัก ณ ที่จ่าย ----
    const W = wht.filter(e => e.company === c && e.d >= FLOW_OPENING_DATE);
    const C = filings.filter(f => f.company === c && f.credit > 0.004 && f.d >= FLOW_OPENING_DATE);
    const base = Object.prototype.hasOwnProperty.call(WHT_RECV_OPENING_0831, c) ? WHT_RECV_OPENING_0831[c] : 0;
    const sumW = (f) => r2(W.filter(f).reduce((t, e) => t + e.amt, 0)), sumC = (f) => r2(C.filter(f).reduce((t, e) => t + e.credit, 0));
    const opening = r2(base + sumW(e => e.d <= prev) - sumC(f => f.d <= prev));
    const dr = sumW(e => e.d >= from && e.d <= to), cr = sumC(f => f.d >= from && f.d <= to);
    const nDoc = W.filter(e => e.d >= from && e.d <= to).length;
    const filedNoCredit = filings.some(f => f.company === c && f.d >= from && f.d <= to && f.credit < 0.005 && f.paid > 0);
    out.push({ account_id: "whtrecv-" + c, kind: "whtrecv", company: c, code: WHT_RECV_CODE, bank_name: "ภาษีถูกหัก ณ ที่จ่าย", account_no: "",
      account_name: `ถูกหักในงวด ${fmt(dr)} (ใบรายได้ ${nDoc} ใบ ตามวันรับเงิน) · ใช้เครดิตตอนยื่นภาษีในงวด ${fmt(cr)}${filedNoCredit ? " · ⚠ มีการยื่นภาษีในงวดแต่ยังไม่ได้กรอกเครดิตภาษีถูกหัก" : ""}`,
      account_type: "ยกมา = Flow 31/08/69 + รายการตั้งแต่ 01/09/69", flowOpening: base, opening, dr, cr, closing: r2(opening + dr - cr), count: nDoc });
  });
  return out;
}

// ---- หนี้สิน: 27140 เจ้าหนี้สรรพากร (user 2026-11-12 ส่งไฟล์ GL 27140 ก.ย.69 ทั้ง 2 เล่ม) ----
// ในเล่ม Flow บัญชีนี้มี 2 เรื่อง: (1) ภ.พ.30 ค้างจ่าย — ตั้งสิ้นเดือนจากใบปรับ "สร้างแบบยื่น ภ.พ.30" จ่ายราววันที่ 21–23 เดือนถัดไป
//   (2) เงิน กยศ. ที่หักจากเงินเดือน — ตั้งพร้อมเงินเดือนค้างจ่าย (วันที่ 20) นำส่งต้นเดือนถัดไป
// แหล่งข้อมูลระบบ: (1) ใบนำส่งภาษี ภ.พ.30 (tax-remittance-api: period_month = งวดภาษี, remit_date = วันจ่าย, amount_total)
//   (2) hr-api payroll_payables: list_by_affiliation (total_loan ต่อเดือน×สังกัด = ยอดหัก กยศ.) + list_payments (payroll_creditor_type 'loan' — เดือน/สังกัดอ่านจาก description เพราะช่อง affiliation เชื่อไม่ได้)
// วิธีคิดเหมือนภาษีหัก ณ ที่จ่ายค้างจ่าย: เครดิต = ยอดของงวดเดือนนั้น · เดบิต = จ่ายในงวด · ยกมา/คงค้าง = ของงวดที่ผ่านมาแต่จ่ายหลังวันตัด (กยศ. ที่ยังไม่จ่ายก็นับค้าง · ภ.พ.30 งวดที่ยังไม่บันทึกนำส่งยังไม่ขึ้น)
// ยอดค้างเดิมในเล่ม Flow ก่อน ก.ย.69 (ไม่ทราบที่มา — ยอดยกมา Flow 31/08 ต่ำกว่ายอด ภ.พ.30 ส.ค. + กยศ. ส.ค.): ป.เปา −2,051.19 · สิงห์ชัย −251.75 → บวกเป็นค่าคงที่ให้ยกมาตรง Flow
// ตรวจ ก.ย.69 กับ GL Flow: ป.เปา ยกมา 107,148.30 · เดบิต 109,199.49 (Flow 109,199.63) · เครดิต 173,528.68 (Flow 173,529.04) · คงค้าง 171,477.49 (Flow 171,477.71)
//   สิงห์ชัย ยกมา 101,164.72 · เดบิต 101,416.47 (Flow 101,416.57) · เครดิต 866.00 · คงค้าง 614.25 (Flow 614.15) — ต่างเฉพาะเศษสตางค์ของยอด ภ.พ.30 ที่จ่ายจริง
const HR_API = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";
const REV_PAYABLE_CODE = "27140";
const REV_PAYABLE_ADJ_0831 = { "ป.เปา": -2051.19, "สิงห์ชัย": -251.75 }; // ยอดค้างเดิมในเล่ม Flow (ฝั่งเดบิต) ณ 31/08/69
async function loadRevenuePayableRows(from, to, companies) {
  const ymKey = from.slice(0, 7).replace("-", "");
  const [remits, byAff, pays] = await Promise.all([
    postAny(TAX_REMIT_API, { action: "list_tax_remittances", tax_type: "ภ.พ.30" }),
    postAny(HR_API, { action: "payroll_payables", mode: "list_by_affiliation" }),
    postAny(HR_API, { action: "payroll_payables", mode: "list_payments" }),
  ]);
  // (1) ภ.พ.30
  const vat = remits.filter(r => r && r.remit_doc_no && String(r.tax_type || "").trim() === "ภ.พ.30" && !/cancel|ยกเลิก/i.test(String(r.status || "")))
    .map(r => ({ kind: "vat", company: compOfName(r.affiliation), period: String(r.period_month || "").replace(/[^0-9]/g, "").slice(0, 6), paid: String(r.remit_date || "").slice(0, 10), amt: Number(r.amount_total || 0) }))
    .filter(e => e.period.length === 6 && e.period >= "202608");
  // (2) กยศ. — ยอดหักต่อเดือน×สังกัด (เอาชุดที่บันทึกล่าสุดของเดือนนั้น) + วันจ่ายจากเอกสารจ่าย
  const latest = {};
  byAff.filter(r => r && r.month_year && COMPANIES.includes(String(r.affiliation || ""))).forEach(r => {
    const k = String(r.month_year).slice(0, 7) + "|" + r.affiliation;
    if (!latest[k] || String(r.saved_at || "") > String(latest[k].saved_at || "")) latest[k] = r;
  });
  const loanPays = pays.filter(p => p && String(p.payroll_creditor_type || "") === "loan" && String(p.status || "") === "paid" && p.paid_at);
  const kosor = Object.values(latest).filter(r => Number(r.total_loan) > 0.004).map(r => {
    const ym = String(r.month_year).slice(0, 7), c = String(r.affiliation);
    const tag = `เดือน ${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
    const p = loanPays.find(x => String(x.description || "").includes(`(สังกัด ${c})`) && String(x.description || "").includes(tag));
    return { kind: "kosor", company: c, period: ym.replace("-", ""), paid: p ? bkkDate(p.paid_at) : "", amt: Number(r.total_loan || 0) };
  }).filter(e => e.period >= "202608");
  const items = [...vat, ...kosor];
  return companies.map(c => {
    const E = items.filter(e => e.company === c);
    const adj = Object.prototype.hasOwnProperty.call(REV_PAYABLE_ADJ_0831, c) ? REV_PAYABLE_ADJ_0831[c] : 0;
    const sum = (f) => r2(E.filter(f).reduce((t, e) => t + e.amt, 0));
    const unpaidAfter = (D) => (e) => !e.paid || e.paid > D;
    const prev = prevDayOf(from);
    const opening = r2(sum(e => e.period < ymKey && unpaidAfter(prev)(e)) + adj);
    const cr = sum(e => e.period === ymKey);
    const dr = sum(e => e.paid && e.paid >= from && e.paid <= to);
    const closing = r2(sum(e => e.period <= ymKey && unpaidAfter(to)(e)) + adj);
    const part = (k, f) => r2(E.filter(e => e.kind === k && f(e)).reduce((t, e) => t + e.amt, 0));
    return { account_id: "revpay-" + c, kind: "revpay", company: c, code: REV_PAYABLE_CODE, bank_name: "เจ้าหนี้สรรพากร", account_no: "",
      account_name: `ภ.พ.30: ตั้งงวดนี้ ${fmt(part("vat", e => e.period === ymKey))} · จ่ายในงวด ${fmt(part("vat", e => e.paid >= from && e.paid <= to))} — กยศ.: หักงวดนี้ ${fmt(part("kosor", e => e.period === ymKey))} · นำส่งในงวด ${fmt(part("kosor", e => e.paid && e.paid >= from && e.paid <= to))}${Math.abs(adj) > 0.004 ? ` · ยอดค้างเดิมในเล่ม Flow ${fmt(adj)}` : ""}`,
      account_type: "หนี้สิน · ภ.พ.30 ค้างจ่าย (ใบนำส่งภาษี) + กยศ. หักจากเงินเดือน (เงินเดือน)", flowOpening: null, opening: -opening, dr, cr, closing: -closing, count: E.length };
  }).filter(r => Math.abs(r.opening) > 0.004 || Math.abs(r.closing) > 0.004 || r.dr > 0.004 || r.cr > 0.004);
}

// ---- ลูกหนี้การค้า 11311 (สินทรัพย์) / เจ้าหนี้การค้า 21311 (หนี้สิน) — user 2026-11-13 "แสดงรายงาน เจ้าหนี้ และ ลูกหนี้ ในงบทดลองด้วย" ----
// ใช้ชุดข้อมูล/ตรรกะเดียวกับเมนู Accounting → บัญชี → ลูกหนี้ตามเอกสาร / เจ้าหนี้ตามเอกสาร (src/lib/accountsReceivable.js · accountsPayable.js) จึงเท่ากับยอดในรายงานทั้งสองเสมอ
//   ยกมา = ยอดค้าง ณ วันก่อนต้นงวด · คงเหลือ = ยอดค้าง ณ สิ้นงวด
//   ลูกหนี้: เดบิต = เอกสารที่ตั้งในงวด (ยอดที่ต้องรับ) · เครดิต = ยกมา + เดบิต − คงเหลือ (รับเงินในงวด รวมส่วนที่ไฟแนนซ์โอนขาดซึ่งไม่นับเป็นลูกหนี้)
//   เจ้าหนี้: เครดิต = เอกสารที่ตั้งในงวด · เดบิต = ยกมา + เครดิต − คงค้าง (จ่ายในงวด) · ยอดแสดงฝั่งเครดิต
// ⚠️ ไม่ตรงกับบัญชี 11311 / 21311 ในงบทดลอง Flow ก.ย.69 (ป.เปา 11311 เป็นยอดเครดิต 1,117,237.91 · สิงห์ชัย 446,060.95 / 21311 ป.เปา 384,025.68 · สิงห์ชัย 1,990,330.99)
//   เพราะสมุดบัญชี Flow เองก็ไม่เท่ากับรายงานลูกหนี้/เจ้าหนี้ตามเอกสารของ Flow (ป.เปา ลูกหนี้ 1,092,522.34 · สิงห์ชัย 1,022,921.50 / เจ้าหนี้ 526,617.23 · 2,090,767.38) — ระบบยึดตามรายงานตามเอกสาร
//   เอกสารที่ระบบยังไม่รวม (งานวางบิลทะเบียน/พรบ./COSMOS, ขายอะไหล่เงินเชื่อ, ระหว่างบริษัท) ดูหมายเหตุในไฟล์ lib ทั้งสอง
const AR_CODE = "11311", AP_CODE = "21311";
async function loadArApRows(from, to, companies, onProgress) {
  const prev = prevDayOf(from);
  const sum = (list, f) => r2(list.reduce((t, d) => t + f(d), 0));
  const out = [];
  onProgress("ลูกหนี้ตามเอกสาร…");
  const { docs: arDocs } = await loadReceivableDocs({ asOf: to, onProgress: (p) => onProgress("ลูกหนี้ · " + p) });
  for (const c of companies) {
    const open = receivablesAsOf(arDocs, prev, { company: c }), close = receivablesAsOf(arDocs, to, { company: c });
    const opening = sum(open, d => d.amount), closing = sum(close, d => d.amount);
    const dr = sum(arDocs.filter(d => d.company === c && d.doc_date >= from && d.doc_date <= to && !(d.source === "income" && d.doc_date < AR_INCOME_START)), d => d.receivable);
    if (!open.length && !close.length && dr < 0.005) continue;
    const part = (k) => sum(close.filter(d => d.source === k), d => d.amount);
    out.push({ account_id: "ar-" + c, kind: "ar", company: c, code: AR_CODE, bank_name: "ลูกหนี้การค้า", account_no: "",
      account_name: `ค้างรับ ณ สิ้นงวด ${close.length} เอกสาร — ขายรถ (ไฟแนนซ์) ${fmt(part("finance"))} · รายได้อื่น ${fmt(part("income"))}`,
      account_type: "จากรายงานลูกหนี้ตามเอกสาร", flowOpening: null, opening, dr, cr: r2(opening + dr - closing), closing, count: close.length });
  }
  onProgress("เจ้าหนี้ตามเอกสาร…");
  const apDocs = await loadPayableDocs({ asOf: to, includeOld: false, onProgress: (p) => onProgress("เจ้าหนี้ · " + p) });
  for (const c of companies) {
    const open = payablesAsOf(apDocs, prev, { company: c }), close = payablesAsOf(apDocs, to, { company: c });
    const opening = sum(open, d => d.amount), closing = sum(close, d => d.amount);
    const cr = sum(apDocs.filter(d => d.company === c && !d.employee && d.doc_date >= AP_START && d.doc_date >= from && d.doc_date <= to), d => d.amount);
    if (!open.length && !close.length && Math.abs(cr) < 0.005) continue;
    const part = (k) => sum(close.filter(d => d.source === k), d => d.amount);
    out.push({ account_id: "ap-" + c, kind: "ap", company: c, code: AP_CODE, bank_name: "เจ้าหนี้การค้า", account_no: "",
      account_name: `ค้างจ่าย ณ สิ้นงวด ${close.length} เอกสาร — ค่ารถ ${fmt(part("vehicle"))} · ค่าอะไหล่/สินค้า ${fmt(part("parts"))} · ค่าใช้จ่าย ${fmt(part("expense"))}`,
      account_type: "หนี้สิน · จากรายงานเจ้าหนี้ตามเอกสาร", flowOpening: null, opening: -opening, dr: r2(opening + cr - closing), cr, closing: -closing, count: close.length });
  }
  return out;
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
const isLiab = (r) => r.kind === "loan" || r.kind === "wht" || r.kind === "revpay" || r.kind === "ap"; // แถวหมวดหนี้สิน (แสดงท้ายสังกัด มีหัวข้อคั่น)
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
  // ยอดยกมาบัญชีธนาคาร: "system" = ยอดตั้งต้นบัญชี + รายการสะสมทั้งหมดในระบบ (เท่ากับรายงานเคลื่อนไหวบัญชี/statement) · "flow" = งบทดลอง Flow 31/08/69 + รายการตั้งแต่ 01/09
  //   user 2026-11-09 "งบทดลองยอดยกมายกไป ทำไมไม่เท่า statement" → ค่าเริ่มต้นใช้ระบบ (SCB สิงห์ชัย ก.ย.: ระบบ 33,797.82 / Flow 33,159.70 ต่าง 638.12 เป็นส่วนต่างก่อน ก.ย. ฝั่ง Flow)
  const [openingMode, setOpeningMode] = useState("system");
  const [accounts, setAccounts] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]); // รวมบัญชีเสมือน (ใช้หาบัญชีกู้ยืมระหว่างบริษัท)
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [loadedYm, setLoadedYm] = useState("");
  const [loadedCompany, setLoadedCompany] = useState(null); // สังกัดที่โหลดมา (null = ยังไม่เคยโหลด)

  useEffect(() => {
    // ดึงทุกสถานะแล้วตัดเฉพาะบัญชีปิด (inactive) — บัญชี "ใช้งานแต่ไม่เคลื่อนไหว" (status dormant, user 2026-11-12) ไม่ขึ้นในตัวเลือกรับ/จ่ายเงิน แต่ต้องแสดงยอดในงบทดลอง
    post({ action: "list_bank_accounts", include_inactive: "true" }).then(arr => { const ok = arr.filter(a => a && a.account_id && String(a.status || "active") !== "inactive"); setAllAccounts(ok); setAccounts(ok.filter(isBank)); }).catch(() => setAccounts([]));
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
        // ดึงรายการสะสมทั้งหมดก่อนต้นงวด แล้วคำนวณยอดยกมา 2 แบบ: ระบบ (ยอดตั้งต้น + ทุกรายการ = statement) และ Flow (ยอด Flow 31/08 + รายการตั้งแต่ 01/09)
        const prior = await post({ action: "list_bank_movements", account_id: id, date_from: "2000-01-01", date_to: prev });
        const cur = await post({ action: "list_bank_movements", account_id: id, date_from: from, date_to: to });
        const sum = (arr, f) => arr.reduce((s, m) => s + (m && m.movement_date ? f(Number(m.amount || 0)) : 0), 0);
        const openingSystem = r2(Number(a.opening_balance || 0) + sum(prior, v => v));
        const sinceFlow = prior.filter(m => m && m.movement_date && String(m.movement_date).slice(0, 10) >= FLOW_OPENING_DATE);
        const openingFlow = fo !== null ? r2(fo + sum(sinceFlow, v => v)) : null;
        const opening = openingMode === "flow" && openingFlow !== null ? openingFlow : openingSystem;
        const dr = r2(sum(cur, v => (v > 0 ? v : 0)));
        const cr = r2(sum(cur, v => (v < 0 ? -v : 0)));
        done++; setProgress(`${done}/${targets.length} บัญชี`);
        return { ...a, company: companyOf(a), code: flowCodeOf(a), flowOpening: fo, openingSystem, openingFlow, opening, dr, cr, closing: r2(opening + dr - cr), count: cur.filter(m => m && m.movement_date).length, _prior: prior, _cur: cur };
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
          // ยกมา = ยอด Flow 31/08 + โอนข้ามสังกัดตั้งแต่ 01/09 ถึงก่อนต้นงวดเท่านั้น — _prior เก็บรายการทั้งหมดตั้งแต่เปิดบัญชี (ใช้คำนวณยกมาตามระบบของบัญชีธนาคาร ตั้งแต่ 2026-11-09)
          //   ถ้าไม่กรอง ยอดยกมา 11451 จะบวกรายการก่อน ก.ย. ซ้ำกับยอด Flow (พบ 2026-11-12 ตอนเทียบไฟล์งบทดลอง: ป.เปา ยกมาเพี้ยน 2,974,567.92)
          const priT = mine.reduce((t, r) => { const x = intercoFromMovements((r._prior || []).filter(m => m && String(m.movement_date || "").slice(0, 10) >= FLOW_OPENING_DATE), c); t.dr += x.dr; t.cr += x.cr; return t; }, { dr: 0, cr: 0 });
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
      // ---- เงินสดในมือ 11111 ต่อสังกัด (เงินสดรับแล้วยังไม่ได้นำฝาก — จากใบฝากเงิน) ----
      setProgress("เงินสดในมือ…");
      let cash = [];
      try { cash = await loadCashOnHandRows(from, to, COMPANIES.filter(c => !company || c === company)); } catch { cash = []; }
      // ---- หนี้สิน: เงินกู้ยืมธนาคาร ต่อบัญชีเงินกู้ ----
      setProgress("เงินกู้ยืมธนาคาร…");
      let loanRows = [];
      try { loanRows = await loadLoanRows(from, to, COMPANIES.filter(c => !company || c === company)); } catch { loanRows = []; }
      // บัญชีธนาคารที่มีเฉพาะในงบทดลอง Flow (ไม่มีในระบบ ไม่เคลื่อนไหว) — ยอดคงที่ตาม Flow
      const sysNos = new Set(allAccounts.map(a => normNo(a.account_no)));
      const statics = FLOW_STATIC_BANKS.filter(b => (!company || b.company === company) && !(normNo(b.account_no) && sysNos.has(normNo(b.account_no)))).map(b => ({
        account_id: "static-" + b.company + "-" + b.code, kind: "static", company: b.company, code: b.code, bank_name: b.bank_name, account_no: b.account_no,
        account_name: `${COMPANY_FULL[b.company] || b.company} · ไม่ได้ตั้งเป็นบัญชีในระบบ — ยอดตามงบทดลอง Flow (ไม่มีความเคลื่อนไหว)`, account_type: "", flowOpening: b.balance, opening: b.balance, dr: 0, cr: 0, closing: b.balance, count: 0 }));
      // ---- หนี้สิน: ภาษีหัก ณ ที่จ่ายค้างจ่าย (ภ.ง.ด.1 / 3 / 53) ----
      setProgress("ภาษีหัก ณ ที่จ่าย…");
      let whtRows = [];
      try { whtRows = await loadWhtRows(from, to, COMPANIES.filter(c => !company || c === company)); } catch { whtRows = []; }
      // ---- สินทรัพย์ภาษี: 17120 ภาษีถูกหัก ณ ที่จ่าย + 17130 ภาษีนิติบุคคลจ่ายล่วงหน้า ----
      setProgress("ภาษีถูกหัก / ภาษีนิติบุคคลจ่ายล่วงหน้า…");
      let taxAssets = [];
      try { taxAssets = await loadTaxAssetRows(from, to, COMPANIES.filter(c => !company || c === company)); } catch { taxAssets = []; }
      // ---- หนี้สิน: 27140 เจ้าหนี้สรรพากร (ภ.พ.30 ค้างจ่าย + กยศ. หักจากเงินเดือน) ----
      setProgress("เจ้าหนี้สรรพากร…");
      let revPay = [];
      try { revPay = await loadRevenuePayableRows(from, to, COMPANIES.filter(c => !company || c === company)); } catch { revPay = []; }
      // ---- 11311 ลูกหนี้การค้า + 21311 เจ้าหนี้การค้า (จากรายงานลูกหนี้/เจ้าหนี้ตามเอกสาร) ----
      let arap = [];
      try { arap = await loadArApRows(from, to, COMPANIES.filter(c => !company || c === company), setProgress); } catch { arap = []; }
      const all = [...cash, ...out, ...statics, ...petty, ...interco, ...inventory, ...ftdep, ...taxAssets, ...loanRows, ...whtRows, ...revPay, ...arap];
      all.sort((x, y) => COMPANIES.indexOf(x.company) - COMPANIES.indexOf(y.company) || (isLiab(x) ? 1 : 0) - (isLiab(y) ? 1 : 0) || (x.code || "zz").localeCompare(y.code || "zz") || String(x.account_no).localeCompare(String(y.account_no)));
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
    const body = groups.map(({ g, list }) => `<tr class="grp"><td colspan="8">${esc(COMPANY_FULL[g] || g)}</td></tr>${list.map((r, i) => (isLiab(r) && (i === 0 || !isLiab(list[i - 1])) ? `<tr class="grp"><td colspan="8" style="background:#fef2f2">หนี้สิน</td></tr>` : "") + row(r)).join("")}${groups.length > 1 ? tot(`รวม ${g}`, sumOf(list), "sub") : ""}`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>งบทดลอง ${esc(thMonthLong(loadedYm || ym))}</title>
<style>@page{size:A4 landscape;margin:12mm}body{font-family:Tahoma,sans-serif;font-size:11pt;color:#111}h1{font-size:16pt;margin:0 0 2px}h2{font-size:12pt;margin:0;font-weight:400}.meta{font-size:9.5pt;color:#555;margin:2px 0 10px}
table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:4px 6px;vertical-align:top}th{background:#f1f5f9;font-size:10pt}th.grp{border-bottom:2px solid #94a3b8}td.r,th.r{text-align:right;font-family:Consolas,monospace;white-space:nowrap}td.code{font-family:Consolas,monospace;white-space:nowrap}.sub{font-size:8.5pt;color:#666}
tr.grp td{background:#eef2ff;font-weight:700;padding:6px}tr.sub td{font-weight:700;background:#f8fafc}tr.total td{font-weight:800;border-top:2px solid #111;border-bottom:3px double #111;font-size:11.5pt}.note{margin-top:10px;font-size:9pt;color:#666}</style></head><body>
<h1>งบทดลอง (เฉพาะบัญชีที่ตรวจสอบกับ FlowAccount แล้ว — เงินสดในมือ + บัญชีธนาคาร + เงินสดย่อย + เงินกู้ยืมระหว่างบริษัท + สินค้าคงเหลือรถ + เงินมัดจำ + เงินกู้ยืมธนาคาร + ภาษีหัก ณ ที่จ่ายค้างจ่าย)</h1><h2>${esc(title)}</h2>
<div class="meta">รอบ ${esc(thMonthLong(loadedYm || ym))} · สิ้นสุด ณ วันที่ ${esc(thDateLong(to))} · พิมพ์ ${new Date().toLocaleString("th-TH")}</div>
<table><thead><tr><th rowspan="2" style="text-align:left">รหัส</th><th rowspan="2" style="text-align:left">บัญชี</th><th colspan="2" class="grp">ยอดยกมา ${esc(thDateLong(prevDayOf(from)))}</th><th colspan="2" class="grp">ยอดประจำงวด</th><th colspan="2" class="grp">ยอดสะสม ${esc(thDateLong(to))}</th></tr>
<tr><th class="r">เดบิต</th><th class="r">เครดิต</th><th class="r">เดบิต</th><th class="r">เครดิต</th><th class="r">เดบิต</th><th class="r">เครดิต</th></tr></thead>
<tbody>${body}${tot("รวมทั้งสิ้น", grand, "total")}</tbody></table>
<div class="note">ที่มา: รายงานการเคลื่อนไหวบัญชีธนาคารในระบบ (ยอดยกมา = ${openingMode === "flow" ? "งบทดลอง Flow 31/08/69 + รายการตั้งแต่ 01/09/69 ถึงก่อนต้นงวด" : "ยอดตั้งต้นบัญชี + รายการสะสมทั้งหมดในระบบ = statement"}) · เงินสดในมือ 11111 = เงินสดรับสุทธิของสาขาที่ยังไม่ได้นำฝากธนาคาร ณ วันตัดงวด (จากใบฝากเงิน: เดบิต = เงินรับของวันในงวด, เครดิต = นำฝากในงวด) · เงินสดย่อย 11149.00 รวมทุกบัญชีย่อยของสังกัด: เครดิต = ค่าน้ำมันรถใหม่/ของไหว้ตามวันที่ใบ + ค่าใช้จ่ายทั่วไป/ไปรษณีย์ตามวันเบิก PCW, เดบิต = เติมเท่าที่เบิก (วงเงินคงที่) · ลูกหนี้การค้า (11311) / เจ้าหนี้การค้า (21311) = ยอดค้างตามรายงานลูกหนี้/เจ้าหนี้ตามเอกสาร (เมนู Accounting → บัญชี) ณ วันก่อนต้นงวดและสิ้นงวด — ยึดตามเอกสาร จึงไม่เท่ากับยอดบัญชีเดียวกันในสมุดบัญชี Flow · ยอดคงเหลือฝั่งเครดิต = บัญชีเงินเบิกเกินบัญชี (OD) · รหัสบัญชีตามผังบัญชี FlowAccount</div>
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
        <span style={{ fontSize: 12.5, color: "#64748b" }}>เฉพาะบัญชีที่ตรวจสอบกับ FlowAccount แล้ว — ตอนนี้: เงินสดในมือ + บัญชีธนาคาร + เงินสดย่อย + เงินกู้ยืมระหว่างบริษัท + สินค้าคงเหลือรถ + เงินมัดจำ + ภาษีถูกหัก ณ ที่จ่าย + ภาษีนิติบุคคลจ่ายล่วงหน้า + ลูกหนี้การค้า + หนี้สิน: เงินกู้ยืมธนาคาร + ภาษีหัก ณ ที่จ่ายค้างจ่าย + เจ้าหนี้สรรพากร + เจ้าหนี้การค้า (เริ่มรอบ {thMonthLong(START_MONTH)})</span>
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
        <label style={{ fontSize: 12.5, fontWeight: 600, display: "grid", gap: 4 }} title="ระบบ = ยอดตั้งต้นบัญชี + รายการสะสมทั้งหมด (เท่ารายงานเคลื่อนไหวบัญชี/statement) · Flow = งบทดลอง Flow 31/08/69 + รายการตั้งแต่ 01/09/69">ยอดยกมาธนาคาร
          <select value={openingMode} onChange={e => setOpeningMode(e.target.value)} style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 13 }}>
            <option value="system">ตามระบบ (= statement)</option>
            <option value="flow">ตาม Flow 31/08/69</option>
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
                    <tr><td colSpan={8} style={{ ...td, background: "#eef2ff", color: "#3730a3", fontWeight: 700 }}>▾ สินทรัพย์ · {COMPANY_FULL[g] || g} · {list.some(r => r.kind === "cash") ? "เงินสดในมือ + " : ""}{list.filter(r => !r.kind || r.kind === "static").length} บัญชีธนาคาร{list.some(r => r.kind === "petty") ? " + เงินสดย่อย" : ""}{list.some(r => r.kind === "interco") ? " + เงินกู้ยืมระหว่างบริษัท" : ""}{list.some(r => r.kind === "inventory") ? " + สินค้าคงเหลือรถ" : ""}{list.some(r => r.kind === "ftdeposit") ? " + เงินมัดจำ" : ""}{list.some(r => r.kind === "whtrecv" || r.kind === "citprepaid") ? " + ภาษีถูกหัก/ภาษีนิติบุคคลจ่ายล่วงหน้า" : ""}{list.some(r => r.kind === "ar") ? " + ลูกหนี้การค้า" : ""}</td></tr>
                    {list.map((r, idx) => { const [a, b] = drcr(r.opening); const [c, d] = drcr(r.closing); const firstLoan = isLiab(r) && (idx === 0 || !isLiab(list[idx - 1])); return (
                      <React.Fragment key={r.account_id}>
                      {firstLoan && <tr><td colSpan={8} style={{ ...td, background: "#fef2f2", color: "#991b1b", fontWeight: 700 }}>▾ หนี้สิน · {COMPANY_FULL[g] || g}{list.some(x => x.kind === "loan") ? ` · เงินกู้ยืมธนาคาร ${list.filter(x => x.kind === "loan").length} บัญชี` : ""}{list.some(x => x.kind === "wht") ? " · ภาษีหัก ณ ที่จ่ายค้างจ่าย" : ""}{list.some(x => x.kind === "revpay") ? " · เจ้าหนี้สรรพากร" : ""}{list.some(x => x.kind === "ap") ? " · เจ้าหนี้การค้า" : ""}</td></tr>}
                      <tr style={r.kind === "whtrecv" || r.kind === "citprepaid" ? { background: "#f5f3ff" } : r.kind === "static" ? { background: "#f8fafc", color: "#475569" } : r.kind === "loan" ? { background: "#fff7f7" } : r.kind === "wht" || r.kind === "revpay" || r.kind === "ap" ? { background: "#fffaf0" } : r.kind === "ar" ? { background: "#ecfeff" } : r.kind === "cash" ? { background: "#fefce8" } : r.kind === "petty" ? { background: "#fffbeb" } : r.kind === "interco" ? { background: "#f0f9ff" } : r.kind === "inventory" ? { background: "#f0fdf4" } : r.kind === "ftdeposit" ? { background: "#fdf4ff" } : undefined} title={r.kind === "ar" ? `ลูกหนี้การค้า = ยอดค้างรับตามรายงานลูกหนี้ตามเอกสาร (ขายรถจัดไฟแนนซ์ตามใบกำกับ + รายได้อื่น) · เดบิต = เอกสารที่ตั้งในงวด · เครดิต = รับเงินในงวด · ไม่ตรงกับบัญชี 11311 ในสมุดบัญชี Flow (สมุด Flow ไม่เท่ารายงานลูกหนี้ตามเอกสารของ Flow เอง)` : r.kind === "ap" ? `เจ้าหนี้การค้า = ยอดค้างจ่ายตามรายงานเจ้าหนี้ตามเอกสาร (ค่ารถ + ค่าอะไหล่/สินค้า + ค่าใช้จ่าย) · เครดิต = เอกสารที่ตั้งในงวด · เดบิต = จ่ายในงวด · ยังไม่รวมงานวางบิลทะเบียน/พรบ./COSMOS` : r.kind === "revpay" ? `เจ้าหนี้สรรพากร = ภ.พ.30 ค้างจ่าย (จากใบนำส่งภาษี ภ.พ.30: ตั้งตามงวดภาษี จ่ายเดือนถัดไป) + เงิน กยศ. ที่หักจากเงินเดือน (ตั้งตามเดือนเงินเดือน นำส่งต้นเดือนถัดไป) + ยอดค้างเดิมในเล่ม Flow ก่อน ก.ย.69 · ภ.พ.30 งวดที่ยังไม่บันทึกนำส่งยังไม่ขึ้น` : r.kind === "citprepaid" ? `ภาษีนิติบุคคลจ่ายล่วงหน้า = ภาษีตามแบบ ภ.ง.ด.51 (เงินที่จ่าย + ภาษีถูกหัก ณ ที่จ่ายที่ใช้เครดิต) จากเมนูยื่นภาษี · ล้างออกเมื่อยื่น ภ.ง.ด.50 ของรอบปีเดียวกัน` : r.kind === "whtrecv" ? `ภาษีถูกหัก ณ ที่จ่าย · ยกมา = Flow 31/08/69 (${fmt(r.flowOpening)}) + รายการตั้งแต่ 01/09/69 · เดบิต = ภาษีที่ลูกค้าหักไว้ตามใบบันทึกรายได้ (วันที่รับเงิน) · เครดิต = เครดิตที่ใช้ตอนยื่น ภ.ง.ด.50/51` : r.kind === "wht" ? `ภาษีหัก ณ ที่จ่ายค้างจ่าย (หนี้สิน) จากใบนำส่งภาษี · เครดิต = ภาษีที่หักไว้ของงวดนี้ · เดบิต = นำส่งสรรพากรในงวด · คงค้าง = หักไว้แล้วแต่นำส่งหลังวันตัดงวด (งวดที่ยังไม่บันทึกนำส่งจะยังไม่ขึ้น)` : r.kind === "static" ? `บัญชีนี้มีในงบทดลอง Flow แต่ไม่ได้ตั้งเป็นบัญชีธนาคารในระบบ — แสดงยอดคงที่ตาม Flow ${fmt(r.opening)} (ไม่มีความเคลื่อนไหว)` : r.kind === "loan" ? `เงินกู้ยืมธนาคาร (หนี้สิน) · ยอดคงค้าง = ยอดคงค้างปัจจุบันในบัญชีเงินกู้ + เงินต้นที่จ่ายหลังวันตัดงวด · เดบิต = จ่ายเงินต้นในงวด (${r.count} ครั้ง) · เครดิต = เงินกู้เบิกใหม่ · ดอกเบี้ยไม่รวมในบัญชีนี้` : r.kind === "cash" ? `เงินสดในมือ = เงินสดรับสุทธิของสาขาที่ยังไม่ได้นำฝากธนาคาร (จากใบฝากเงิน ${r.count} ใบ) · เดบิต = เงินรับของวันในงวด · เครดิต = นำฝากในงวด · ยกมา/คงเหลือ = เงินที่รับแล้วแต่ฝากหลังวันตัดงวด` : r.kind === "ftdeposit" ? `เงินมัดจำรับจากลูกค้าตามเอกสารในระบบ (จองรถ DEP- / ป้ายแดง RPD- / อะไหล่ PDS- PDO-) · เครดิต = รับใหม่ · เดบิต = ตัดใช้ชำระ + คืนเงิน · คงค้าง = ยังไม่ตัด/ไม่คืน` : r.kind === "inventory" ? `สต๊อกรถใหม่ในระบบ ณ สิ้นงวด × ต้นทุนใบกำกับซื้อ ÷ 1.07 · ยกมา = มูลค่า ณ สิ้นเดือนก่อน · งวด = ผลต่างสุทธิ (เพิ่ม=เดบิต ลด=เครดิต)` : r.kind === "interco" ? `ยกมา = Flow 31/08/69 · โอนข้ามสังกัด (BTR) + ขายส่งตัดบัญชีกู้ยืม · ไม่รวมเงินสดสาขาฝากข้ามสังกัดและ JV ปิดยอดสิ้นเดือนของ Flow` : r.kind === "petty" ? `เงินสดย่อยรวมทุกสาขา ${r.count} เอกสาร · ยกมา = วงเงินตาม Flow 31/08/69 · เดบิต (เติมเงิน) ถือว่าเท่ากับที่เบิก (ระบบไม่มีบันทึกเติมเงิน)` : `รายการในงวด ${r.count} รายการ · ยกมาตามระบบ (statement) = ${fmt(r.openingSystem)}${r.openingFlow !== null && r.openingFlow !== undefined ? ` · ยกมาตาม Flow 31/08/69 = ${fmt(r.openingFlow)} · ต่าง ${fmt(r2(r.openingSystem - r.openingFlow))} (ส่วนต่างก่อน ก.ย.69 ระหว่างระบบกับ Flow)` : " · ยังไม่มียอด Flow 31/08"} · กำลังใช้: ${openingMode === "flow" && r.openingFlow !== null && r.openingFlow !== undefined ? "Flow" : "ระบบ"}`}>
                        <td style={{ ...td, fontFamily: "monospace", color: r.code ? "#0369a1" : "#9ca3af", fontWeight: 600 }}>{r.code || "—"}{openingMode === "flow" && r.flowOpening === null && r.kind !== "inventory" && r.kind !== "ftdeposit" && r.kind !== "cash" && r.kind !== "loan" && r.kind !== "wht" && r.kind !== "static" && r.kind !== "whtrecv" && r.kind !== "citprepaid" && r.kind !== "revpay" && r.kind !== "ar" && r.kind !== "ap" && <span title="ยังไม่มียอดยกมาจาก Flow 31/08/69 — ใช้ยอดตั้งต้นบัญชีในระบบ" style={{ marginLeft: 4, color: "#f59e0b" }}>*</span>}</td>
                        <td style={td}><div style={{ fontWeight: 600 }}>{r.bank_name} <span style={{ fontFamily: "monospace" }}>{r.account_no}</span></div><div style={{ fontSize: 11, color: "#64748b" }}>{r.account_name}{r.account_type ? ` · ${r.account_type}` : ""}{r.status === "dormant" ? <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: "#fef3c7", color: "#92400e" }}>ใช้งานแต่ไม่เคลื่อนไหว</span> : null}</div></td>
                        <td style={num}>{cellNum(a)}</td><td style={{ ...num, color: "#0891b2" }}>{cellNum(b)}</td>
                        <td style={{ ...num, background: "#f7fef9" }}>{cellNum(r.dr)}</td><td style={{ ...num, background: "#f7fef9", color: "#0891b2" }}>{cellNum(r.cr)}</td>
                        <td style={{ ...num, fontWeight: 700, color: "#1d4ed8" }}>{cellNum(c)}</td><td style={{ ...num, fontWeight: 700, color: "#0891b2" }}>{cellNum(d)}</td>
                      </tr>
                      </React.Fragment>); })}
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
          ยอดยกมาบัญชีธนาคาร = {openingMode === "flow" ? "ยอดตามงบทดลอง Flow ณ 31/08/69 + รายการในระบบตั้งแต่ 01/09/69 ถึงวันก่อนต้นงวด (บัญชีที่มี * ยังไม่มียอด Flow ใช้ยอดตั้งต้นบัญชีในระบบ)" : "ยอดตั้งต้นบัญชี + รายการสะสมทั้งหมดในระบบ (เท่ากับรายงานการเคลื่อนไหวบัญชี/statement) — ชี้ที่รหัสบัญชีเพื่อดูยอดตาม Flow และส่วนต่าง"} · ยอดประจำงวดจากรายงานการเคลื่อนไหว · เงินสดในมือ (11111) = เงินสดรับสุทธิของทุกสาขาที่ยังไม่ได้นำฝากธนาคาร ณ วันตัดงวด (ลงในสังกัดของบัญชีที่นำฝาก — ปัจจุบันทุกสาขาฝากเข้าบัญชี ป.เปา) อ่านจากใบฝากเงิน (ป้าย "ฝากเงินสดประจำวัน" = วันที่รับเงิน): เดบิต = เงินรับของวันในงวด, เครดิต = นำฝากในงวด, คงเหลือ = เงินที่ฝากหลังสิ้นงวด (เช่น เงินรับ 30/09 ฝาก 01/10) — เงินที่ยังไม่ได้บันทึกใบฝากจะยังไม่ขึ้น · เงินสดย่อย (11149.00) รวมทุกบัญชีย่อยของสังกัด: เครดิต = ค่าน้ำมันรถใหม่/ของไหว้ตามวันที่ใบ + ค่าใช้จ่ายทั่วไป/ไปรษณีย์ตามวันเบิก PCW, เดบิต = เติมเท่าที่เบิก (วงเงินคงที่ ระบบไม่มีบันทึกเติมเงิน) · เงินให้กู้ยืมระหว่างบริษัท (11451) = โอนเงินข้ามสังกัด + ขายส่งอะไหล่ที่ตัดผ่านบัญชีกู้ยืม (ยกมา Flow 31/08) ยังไม่รวมเงินสดสาขาที่ฝากข้ามสังกัดและ JV ปิดยอดสิ้นเดือนของ Flow · สินค้าคงเหลือรถ (11513) = สต๊อกรถใหม่ในระบบ ณ สิ้นงวด (รับรถ − ขาย) × ต้นทุนใบกำกับซื้อ ÷ 1.07 ยกมา = มูลค่า ณ สิ้นเดือนก่อน งวด = ผลต่างสุทธิ · เงินมัดจำ (11921) = เงินมัดจำรับจากลูกค้าตามเอกสารในระบบ รวมจองรถ/ป้ายแดง/อะไหล่ (เครดิต = รับใหม่, เดบิต = ตัดใช้ + คืน, คงค้างฝั่งเครดิต) ไม่ได้อิงยอด Flow · ภาษีถูกหัก ณ ที่จ่าย (17120) = ยกมา Flow 31/08/69 + ภาษีที่ลูกค้าหักไว้ตามใบบันทึกรายได้ (วันที่รับเงิน) − เครดิตที่ใช้ตอนยื่น ภ.ง.ด.50/51 · ภาษีนิติบุคคลจ่ายล่วงหน้า (17130) = ภาษีตามแบบ ภ.ง.ด.51 (เงินจ่าย + เครดิตภาษีถูกหัก) จากเมนูยื่นภาษี ล้างเมื่อยื่น ภ.ง.ด.50 · เงินกู้ยืมธนาคาร (หนี้สิน 224xx) = ยอดคงค้างตามบัญชีเงินกู้ในระบบ ย้อนจากยอดปัจจุบันด้วยเงินต้นที่จ่ายหลังวันตัดงวด (เดบิต = จ่ายเงินต้นในงวด, เครดิต = เบิกเงินกู้ใหม่, ดอกเบี้ยไม่รวม) · ภาษีหัก ณ ที่จ่ายค้างจ่าย (27121 ภ.ง.ด.1 / 27123 ภ.ง.ด.3 / 27124 ภ.ง.ด.53) = จากใบนำส่งภาษี: เครดิต = ภาษีที่หักไว้ของงวด, เดบิต = นำส่งในงวด, คงค้าง = หักไว้แล้วแต่นำส่งหลังวันตัดงวด (งวดที่ยังไม่บันทึกนำส่งยังไม่ขึ้น) · เจ้าหนี้สรรพากร (27140) = ภ.พ.30 ค้างจ่ายจากใบนำส่งภาษี + เงิน กยศ. ที่หักจากเงินเดือนรอนำส่ง + ยอดค้างเดิมในเล่ม Flow ก่อน ก.ย.69 · ลูกหนี้การค้า (11311) / เจ้าหนี้การค้า (21311) = ยอดค้างตามรายงานลูกหนี้/เจ้าหนี้ตามเอกสาร (เมนู Accounting → บัญชี) ณ วันก่อนต้นงวดและสิ้นงวด — ยึดตามเอกสาร จึงไม่เท่ากับยอดบัญชีเดียวกันในสมุดบัญชี Flow · ยอดคงเหลือฝั่งเครดิต = บัญชีเงินเบิกเกินบัญชี (OD) · รหัสบัญชีตามผังบัญชี FlowAccount บัญชีที่แสดง "—" ยังไม่ได้ระบุรหัส
        </div>
      </div>
    </div>
  );
}
