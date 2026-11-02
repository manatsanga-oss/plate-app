import React, { useEffect, useMemo, useState } from "react";

// บันทึกรับฝากรถยึดไฟแนนซ์ (user 2026-11-02)
//   แท็บ 1 "รับฝาก": **ลูกค้า (ผู้เช่าซื้อ) นำรถมาฝากร้าน** เพื่อให้ร้านส่งมอบให้ไฟแนนซ์ (คืนรถ/ยอมให้ยึดโดยสมัครใจ) → บันทึกผู้นำฝาก/ไฟแนนซ์/รถ/สภาพ/อุปกรณ์ → พิมพ์ "ใบรับฝากรถเพื่อส่งมอบไฟแนนซ์" (ต้นฉบับ+สำเนา)
//   แท็บ 2 "คืนรถรับฝาก": ไฟแนนซ์ส่งเจ้าหน้าที่มารับรถ → เลือกใบรับฝาก → บันทึกผู้รับรถ/เอกสารอ้างอิง/สภาพตอนส่งมอบ → พิมพ์ "ใบส่งมอบรถรับฝากให้ไฟแนนซ์"
// backend: Finance_Custody_API_Workflow.json (webhook finance-custody-api) actions save_custody / list_custodies / return_custody / cancel_custody · ตาราง finance_custodies
const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const API = `${BASE}/finance-custody-api`;
const MASTER_API = `${BASE}/master-data-api`;
// ค้นรถจาก "การขายรถ" เท่านั้น (user 2026-11-02): receipt-entry-api search_similar แล้วกรอง source sale (moto_sales) / retail (ใบขาย NEW) / registry (ทะเบียนรถลูกค้าจากงานขายปี 54-69) — ตัด source receipt (ใบรับเรื่อง) ทิ้ง
const SALE_SEARCH_API = `${BASE}/receipt-entry-api`;
const SALE_SOURCES = { sale: "ใบขาย", retail: "ใบขาย NEW", registry: "ทะเบียนรถลูกค้า" };

const AFFIL_OF = (bc) => (bc === "SCY05" || bc === "SCY06" ? "ป.เปา" : "สิงห์ชัย");
const COMPANY = {
  "ป.เปา": "บริษัท ป.เปา มอเตอร์เซอร์วิส จำกัด",
  "สิงห์ชัย": "หจก. สิงห์ชัย สยามยนต์",
};
const BRANCHES = ["SCY01", "SCY04", "SCY05", "SCY06", "SCY07"];
const FINANCES = ["กรุ๊ปลีส", "ธนบรรณ", "คาเธ่ย์ ลีสซิ่ง", "เน็คซ์ แคปปิตอล", "เอสจีเอฟ", "อยุธยา แคปปิตอล", "เอส ลีสซิ่ง", "ซัมมิท แคปปิตอล", "อื่นๆ (ระบุ)"];
const FUEL_LEVELS = ["ว่าง", "1/4", "1/2", "3/4", "เต็ม"];
const STATUS_STYLE = {
  "รับฝาก": { bg: "#fef3c7", fg: "#92400e" },
  "คืนแล้ว": { bg: "#d1fae5", fg: "#065f46" },
  "ยกเลิก": { bg: "#fee2e2", fg: "#991b1b" },
};
const pad = (n) => String(n).padStart(2, "0");
const nowLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const todayIso = () => nowLocal().slice(0, 10);
const shiftIso = (iso, days) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const thDateTime = (v) => { if (!v) return "-"; const d = new Date(v); return isNaN(d) ? "-" : d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " น."; };
const thDate = (v) => { if (!v) return "-"; const d = new Date(v); return isNaN(d) ? "-" : d.toLocaleDateString("th-TH", { day: "2-digit", month: "long", year: "numeric" }); };
const toLocalInput = (v) => { if (!v) return ""; const d = new Date(v); return isNaN(d) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const esc = (v) => String(v == null ? "" : v).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
const num = (v) => { const n = Number(String(v ?? "").replace(/,/g, "")); return isFinite(n) ? n : 0; };
const baht = (v) => num(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const yn = (v) => v === true || v === "true" || v === 1 || v === "1";

async function postJSON(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text();
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}
async function listJSON(url, body) {
  const d = await postJSON(url, body);
  if (d && typeof d.listjson === "string") { try { return JSON.parse(d.listjson); } catch { return []; } }
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.data)) return d.data;
  return [];
}

const inp = { padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, width: "100%", boxSizing: "border-box", fontFamily: "Tahoma" };
const lbl = { fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 3, display: "block" };
const btn = (bg) => ({ padding: "7px 14px", fontSize: 13, background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap", fontFamily: "Tahoma" });
const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 14 };
const sec = { fontWeight: 800, color: "#1e3a8a", fontSize: 14, margin: "4px 0 10px", paddingBottom: 6, borderBottom: "2px solid #dbeafe" };
const th = { padding: "8px 10px", fontSize: 12, background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", textAlign: "left", whiteSpace: "nowrap" };
const td = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const Field = ({ label, children, span }) => (<div style={span ? { gridColumn: `span ${span}` } : undefined}><label style={lbl}>{label}</label>{children}</div>);
const Chk = ({ label, checked, onChange }) => (
  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 8, background: checked ? "#eff6ff" : "#fff", cursor: "pointer" }}>
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} /> {label}
  </label>
);

// ---------- พิมพ์เอกสาร (A4, ต้นฉบับ + สำเนา) ----------
const DOC_CSS = `
  @page { size: A4 portrait; margin: 9mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'TH Sarabun New', Tahoma, sans-serif; color: #111; font-size: 12.5pt; line-height: 1.25; }
  /* 1 สำเนา = 1 หน้า A4 พอดี (user 2026-11-02: เดิมล้นเป็น 4 แผ่น) — ไม่ตั้ง min-height ตอนพิมพ์ ให้ page-break คุมอย่างเดียว */
  .page { page-break-after: always; break-after: page; position: relative; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 6mm; border-bottom: 1.5px solid #1e3a8a; padding-bottom: 2mm; margin-bottom: 2mm; }
  .hr { flex: 0 0 auto; text-align: right; font-size: 11pt; white-space: nowrap; }
  .copy { display: inline-block; font-size: 9pt; border: 1px solid #555; padding: 0.3mm 2.5mm; color: #555; margin-bottom: 1mm; }
  .co { flex: 1 1 auto; min-width: 0; font-size: 14.5pt; font-weight: 800; color: #1e3a8a; }
  .co small { display: block; font-size: 10pt; font-weight: 400; color: #333; }
  .title { text-align: center; margin: 1mm 0 2mm; }
  .title h1 { margin: 0; font-size: 17pt; letter-spacing: .3px; }
  .title .sub { font-size: 10pt; color: #444; }
  .box { border: 1px solid #999; border-radius: 1.5mm; padding: 1.8mm 3mm; margin-bottom: 2mm; break-inside: avoid; page-break-inside: avoid; }
  .box h3 { margin: 0 0 1mm; font-size: 11.5pt; color: #1e3a8a; border-bottom: 1px dashed #bbb; padding-bottom: 0.6mm; }
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5mm 5mm; }
  .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5mm 5mm; }
  .kv b { display: inline-block; min-width: 27mm; color: #333; font-weight: 600; }
  .chk { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5mm 3mm; font-size: 11.5pt; }
  .cb { display: inline-block; width: 3.6mm; height: 3.6mm; border: 1.1px solid #222; vertical-align: -0.5mm; margin-right: 1.2mm; text-align: center; line-height: 3.1mm; font-size: 9.5pt; }
  .note { min-height: 7mm; white-space: pre-wrap; }
  .terms { font-size: 9.8pt; color: #222; line-height: 1.25; }
  .terms ol { margin: 0.5mm 0 0; padding-left: 5mm; }
  .sign { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5mm; margin-top: 5mm; text-align: center; font-size: 11pt; break-inside: avoid; page-break-inside: avoid; }
  .sign .line { border-bottom: 1px dotted #333; height: 9mm; margin-bottom: 1mm; }
  .sign small { display: block; color: #444; font-size: 9.5pt; }
  .foot { font-size: 8.5pt; color: #666; display: flex; justify-content: space-between; border-top: 1px solid #ccc; padding-top: 0.8mm; margin-top: 3mm; }
  .toolbar { position: fixed; top: 6px; right: 10px; z-index: 9; font-family: Tahoma; }
  .toolbar button { padding: 8px 16px; font-size: 14px; cursor: pointer; }
  @media print { .toolbar { display: none; } }
  @media screen { body { background: #e5e7eb; padding: 40px 10px 10px; } .page { background: #fff; width: 210mm; min-height: 297mm; margin: 0 auto 14px; padding: 9mm 12mm; box-shadow: 0 1px 4px rgba(0,0,0,.2); } }
`;
const cb = (v) => `<span class="cb">${yn(v) ? "✓" : ""}</span>`;
const vehicleLine = (r) => [r.brand, r.model, r.color].filter(Boolean).join(" · ") || "-";
const plateLine = (r) => [r.plate_no, r.plate_province].filter(Boolean).join(" ") || "-";

function headHtml(r, docNo, docDate, title, subtitle, copyLabel) {
  const aff = r.affiliation || AFFIL_OF(r.branch_code);
  // ป้ายต้นฉบับ/สำเนา อยู่ในบล็อกขวาเหนือเลขที่ (ไม่ absolute — เดิมพิมพ์ทับเลขที่เอกสาร user 2026-11-02) + เลขที่ไม่ตัดบรรทัด
  return `
  <div class="head">
    <div class="co">${esc(COMPANY[aff] || aff)}<small>สาขา ${esc(r.branch_code || "-")} ${esc(r.branch_name || "")}${r.branch_address ? " · " + esc(r.branch_address) : ""}${r.branch_phone ? " · โทร. " + esc(r.branch_phone) : ""}</small></div>
    <div class="hr"><div class="copy">${copyLabel}</div><div>เลขที่ <b style="font-size:13pt">${esc(docNo || "-")}</b></div><div>วันที่ ${esc(thDateTime(docDate))}</div></div>
  </div>
  <div class="title"><h1>${title}</h1><div class="sub">${subtitle}</div></div>`;
}

function custodyPageHtml(r, copyLabel) {
  return `<div class="page">
  ${headHtml(r, r.doc_no, r.received_at, "ใบรับฝากรถเพื่อส่งมอบไฟแนนซ์", "Vehicle Custody Receipt — for delivery to finance company", copyLabel)}
  <div class="box"><h3>1. ผู้นำรถมาฝาก (ลูกค้า / ผู้เช่าซื้อ)</h3>
    <div class="g2 kv">
      <div><b>ชื่อ-สกุล</b> ${esc(r.customer_name || "-")}</div>
      <div><b>เลขบัตรประชาชน</b> ${esc(r.customer_id_card || "-")}</div>
      <div><b>โทรศัพท์</b> ${esc(r.customer_phone || "-")}</div>
      <div><b>ที่อยู่</b> ${esc(r.customer_address || "-")}</div>
      <div><b>ส่งมอบให้ไฟแนนซ์</b> <b style="min-width:0">${esc(r.finance_company || "-")}</b></div>
      <div><b>เลขที่สัญญาเช่าซื้อ</b> ${esc(r.contract_no || "-")}</div>
    </div>
  </div>
  <div class="box"><h3>2. รายละเอียดรถ</h3>
    <div class="g2 kv">
      <div><b>ยี่ห้อ/รุ่น/สี</b> ${esc(vehicleLine(r))}</div>
      <div><b>ทะเบียน</b> ${esc(plateLine(r))}</div>
      <div><b>เลขตัวถัง</b> <span style="font-family:monospace">${esc(r.chassis_no || "-")}</span></div>
      <div><b>เลขเครื่อง</b> <span style="font-family:monospace">${esc(r.engine_no || "-")}</span></div>
      <div><b>เลขไมล์</b> ${r.mileage != null && r.mileage !== "" ? num(r.mileage).toLocaleString("th-TH") + " กม." : "-"}</div>
      <div><b>ที่จอดเก็บ</b> ${esc(r.storage_location || "-")}</div>
    </div>
  </div>
  <div class="box"><h3>3. สภาพรถและอุปกรณ์ที่รับฝาก</h3>
    <div class="chk">
      <div>${cb(r.has_key)} กุญแจ ${yn(r.has_key) && num(r.key_count) > 0 ? num(r.key_count) + " ดอก" : ""}</div>
      <div>${cb(r.has_regbook)} เล่มทะเบียน/สำเนา</div>
      <div>${cb(r.has_helmet)} หมวกกันน็อก</div>
      <div>${cb(r.has_battery)} แบตเตอรี่</div>
      <div>${cb(r.mirror_left)} กระจกมองข้าง ซ้าย</div>
      <div>${cb(r.mirror_right)} กระจกมองข้าง ขวา</div>
      <div>${cb(r.can_start)} สตาร์ทติด</div>
      <div><span style="display:inline-block;min-width:18mm">น้ำมัน:</span> ${esc(r.fuel_level || "-")}</div>
    </div>
    <div style="margin-top:2mm"><b style="color:#333">อุปกรณ์อื่น/ของในรถ:</b> ${esc(r.accessories_note || "-")}</div>
    <div style="margin-top:1mm"><b style="color:#333">ความเสียหาย/ตำหนิที่พบ ณ วันรับฝาก:</b><div class="note">${esc(r.damage_note || "- ไม่พบ -")}</div></div>
  </div>
  <div class="box terms"><h3>4. เงื่อนไขการรับฝาก</h3>
    <ol>
      <li>ผู้นำฝาก (ผู้เช่าซื้อ) นำรถคันนี้มาฝากไว้กับร้าน <u>ด้วยความสมัครใจ</u> เพื่อให้ร้านส่งมอบต่อให้บริษัทไฟแนนซ์ตามสัญญาเช่าซื้อข้างต้น ร้านเป็นเพียง "ผู้รับฝากทรัพย์" ไม่ใช่ตัวแทนของบริษัทไฟแนนซ์ การรับฝากนี้ <u>ไม่ถือเป็นการชำระหนี้หรือปลดภาระ</u> ตามสัญญาเช่าซื้อ ผู้เช่าซื้อต้องติดต่อบริษัทไฟแนนซ์เพื่อสรุปยอดหนี้ด้วยตนเอง</li>
      <li>สภาพรถ อุปกรณ์ และตำหนิเป็นไปตามที่ตรวจสอบร่วมกันในข้อ 3 ร้านไม่รับผิดชอบความเสียหายหรือความบกพร่องที่มีอยู่ก่อนรับฝาก ความเสื่อมสภาพตามปกติระหว่างจอดเก็บ และทรัพย์สินส่วนตัวที่ไม่ได้ระบุไว้ในข้อ 3</li>
      <li>ร้านจะส่งมอบรถให้เฉพาะเจ้าหน้าที่ของบริษัทไฟแนนซ์ที่แสดงบัตรประจำตัวและหนังสือมอบอำนาจ/หนังสือนำรถออก และจะออก "ใบส่งมอบรถรับฝากให้ไฟแนนซ์" ไว้เป็นหลักฐาน · ร้านจะ <u>ไม่คืนรถให้ผู้นำฝาก</u> เว้นแต่บริษัทไฟแนนซ์แจ้งยินยอมเป็นลายลักษณ์อักษร</li>
      <li>${num(r.storage_fee_per_day) > 0 ? `ค่าฝากรถ <b>${baht(r.storage_fee_per_day)} บาท/วัน</b> นับตั้งแต่วันรับฝากจนถึงวันส่งมอบให้ไฟแนนซ์` : "ค่าฝากรถ: ไม่คิด (เว้นแต่ตกลงเป็นอย่างอื่น)"}${r.note ? ` · หมายเหตุ: ${esc(r.note)}` : ""}</li>
    </ol>
  </div>
  <div class="sign">
    <div><div class="line"></div>ผู้นำฝาก (ลูกค้า/ผู้เช่าซื้อ)<small>(${esc(r.customer_name || "......................................")})</small><small>${r.customer_id_card ? "บัตร ปชช. " + esc(r.customer_id_card) : "&nbsp;"}</small></div>
    <div><div class="line"></div>ผู้รับฝาก<small>(${esc(r.received_by || "......................................")})</small><small>${esc(COMPANY[r.affiliation || AFFIL_OF(r.branch_code)] || "")} สาขา ${esc(r.branch_code || "")}</small></div>
    <div><div class="line"></div>พยาน<small>(......................................)</small><small>&nbsp;</small></div>
  </div>
  <div class="foot"><span>เอกสารออกจากระบบ · ${esc(r.doc_no || "")} · บันทึกโดย ${esc(r.created_by || r.received_by || "-")}</span><span>${copyLabel}</span></div>
</div>`;
}

function returnPageHtml(r, copyLabel) {
  const days = num(r.return_days);
  const fee = num(r.return_fee_total);
  return `<div class="page">
  ${headHtml(r, r.return_doc_no, r.returned_at, "ใบส่งมอบรถรับฝากให้ไฟแนนซ์", "Vehicle Release Note — delivered to finance company", copyLabel)}
  <div class="box"><h3>1. อ้างอิงใบรับฝาก</h3>
    <div class="g3 kv">
      <div><b>เลขที่ใบรับฝาก</b> <b style="min-width:0">${esc(r.doc_no || "-")}</b></div>
      <div><b>วันที่รับฝาก</b> ${esc(thDateTime(r.received_at))}</div>
      <div><b>ระยะเวลาฝาก</b> ${days > 0 ? days + " วัน" : "-"}</div>
      <div><b>ผู้นำฝาก (ลูกค้า)</b> ${esc(r.customer_name || "-")}</div>
      <div><b>บริษัทไฟแนนซ์</b> ${esc(r.finance_company || "-")}</div>
      <div><b>เลขที่สัญญา</b> ${esc(r.contract_no || "-")}</div>
    </div>
  </div>
  <div class="box"><h3>2. รถที่ส่งมอบคืน</h3>
    <div class="g2 kv">
      <div><b>ยี่ห้อ/รุ่น/สี</b> ${esc(vehicleLine(r))}</div>
      <div><b>ทะเบียน</b> ${esc(plateLine(r))}</div>
      <div><b>เลขตัวถัง</b> <span style="font-family:monospace">${esc(r.chassis_no || "-")}</span></div>
      <div><b>เลขเครื่อง</b> <span style="font-family:monospace">${esc(r.engine_no || "-")}</span></div>
    </div>
    <div style="margin-top:1.5mm"><b style="color:#333">อุปกรณ์ที่ส่งมอบคืนพร้อมรถ:</b>
      <span style="margin-left:2mm">${cb(r.has_key)} กุญแจ${yn(r.has_key) && num(r.key_count) > 0 ? " " + num(r.key_count) + " ดอก" : ""}</span>
      <span style="margin-left:4mm">${cb(r.has_regbook)} เล่มทะเบียน/สำเนา</span>
      <span style="margin-left:4mm">${cb(r.has_helmet)} หมวกกันน็อก</span>
      <span style="margin-left:4mm">${cb(r.has_battery)} แบตเตอรี่</span>
    </div>
    <div style="margin-top:1mm"><b style="color:#333">สภาพรถ ณ วันส่งมอบคืน:</b><div class="note">${esc(r.return_condition_note || "สภาพเดิมตามใบรับฝาก ไม่มีความเสียหายเพิ่มเติม")}</div></div>
  </div>
  <div class="box"><h3>3. ผู้รับรถคืน (เจ้าหน้าที่ไฟแนนซ์)</h3>
    <div class="g2 kv">
      <div><b>ชื่อ-สกุล</b> ${esc(r.return_officer_name || "-")}</div>
      <div><b>เลขบัตรประชาชน</b> ${esc(r.return_officer_id || "-")}</div>
      <div><b>โทรศัพท์</b> ${esc(r.return_officer_phone || "-")}</div>
      <div><b>เอกสารอ้างอิง</b> ${esc(r.return_ref_doc || "-")}</div>
      ${num(r.storage_fee_per_day) > 0 ? `<div><b>ค่าฝากรถ</b> ${baht(r.storage_fee_per_day)} บาท/วัน × ${days} วัน</div><div><b>รวมค่าฝาก</b> <b style="min-width:0;font-size:16pt">${baht(fee)}</b> บาท</div>` : ""}
    </div>
  </div>
  <div class="box terms">
    ข้าพเจ้าเจ้าหน้าที่ของบริษัทไฟแนนซ์ผู้รับรถ ได้ตรวจสอบรถและอุปกรณ์ตามรายการข้างต้นครบถ้วน และรับรถคันนี้ซึ่งผู้เช่าซื้อนำมาฝากไว้กับร้าน ออกจากสถานที่รับฝากแล้วในวันเวลาดังกล่าว
    ร้านผู้รับฝากพ้นจากความรับผิดชอบในการดูแลรักษารถคันนี้นับแต่เวลาส่งมอบ ส่วนภาระหนี้ตามสัญญาเช่าซื้อเป็นเรื่องระหว่างบริษัทไฟแนนซ์กับผู้เช่าซื้อ
  </div>
  <div class="sign">
    <div><div class="line"></div>ผู้รับรถ (เจ้าหน้าที่ไฟแนนซ์)<small>(${esc(r.return_officer_name || "......................................")})</small><small>${esc(r.finance_company || "")}</small></div>
    <div><div class="line"></div>ผู้ส่งมอบ<small>(${esc(r.returned_by || "......................................")})</small><small>${esc(COMPANY[r.affiliation || AFFIL_OF(r.branch_code)] || "")} สาขา ${esc(r.branch_code || "")}</small></div>
    <div><div class="line"></div>พยาน<small>(......................................)</small><small>&nbsp;</small></div>
  </div>
  <div class="foot"><span>เอกสารออกจากระบบ · ${esc(r.return_doc_no || "")} อ้างอิง ${esc(r.doc_no || "")}</span><span>${copyLabel}</span></div>
</div>`;
}

function printDoc(r, kind) {
  const w = window.open("", "_blank");
  if (!w) { alert("เปิดหน้าต่างพิมพ์ไม่ได้ — อนุญาต popup ก่อน"); return; }
  const pages = kind === "return"
    ? returnPageHtml(r, "ต้นฉบับ — ไฟแนนซ์") + returnPageHtml(r, "สำเนา — ร้าน")
    : custodyPageHtml(r, "ต้นฉบับ — ไฟแนนซ์") + custodyPageHtml(r, "สำเนา — ร้าน");
  const title = kind === "return" ? `ใบส่งมอบรถรับฝากให้ไฟแนนซ์ ${r.return_doc_no || ""}` : `ใบรับฝากรถเพื่อส่งมอบไฟแนนซ์ ${r.doc_no || ""}`;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${DOC_CSS}</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨️ พิมพ์ (2 แผ่น: ต้นฉบับ + สำเนา)</button></div>
${pages}</body></html>`);
  w.document.close();
}

// ---------- หน้าเมนู ----------
export default function FinanceCustodyPage({ currentUser }) {
  const isAdmin = currentUser?.username === "admin" || String(currentUser?.role || "").toLowerCase() === "admin";
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").trim().split(/\s+/)[0] || "SCY06";
  const staffName = currentUser?.name || currentUser?.username || "";
  const [tab, setTab] = useState("receive"); // receive | return
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [branches, setBranches] = useState([]);
  const [filter, setFilter] = useState({ date_from: shiftIso(todayIso(), -90), date_to: todayIso(), status: "", keyword: "" });
  const [saving, setSaving] = useState(false);

  const emptyForm = () => ({
    id: 0, received_at: nowLocal(), branch_code: BRANCHES.includes(myBranch) ? myBranch : "SCY06", received_by: staffName,
    finance_company: "กรุ๊ปลีส", finance_other: "", contract_no: "", customer_name: "", customer_phone: "", customer_id_card: "", customer_address: "",
    brand: "", model: "", color: "", plate_no: "", plate_province: "", chassis_no: "", engine_no: "", mileage: "",
    has_key: true, key_count: 1, has_regbook: false, has_helmet: false, has_battery: true, mirror_left: true, mirror_right: true, can_start: true, fuel_level: "1/4",
    accessories_note: "", damage_note: "", storage_location: "", storage_fee_per_day: "", note: "",
  });
  const [form, setForm] = useState(emptyForm);
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const [vehQ, setVehQ] = useState("");
  const [vehHits, setVehHits] = useState(null);
  const [vehSearching, setVehSearching] = useState(false);

  // คืนรถ
  const [retTarget, setRetTarget] = useState(null);
  const emptyRet = () => ({ returned_at: nowLocal(), returned_by: staffName, return_officer_name: "", return_officer_phone: "", return_officer_id: "", return_ref_doc: "หนังสือมอบอำนาจ + สำเนาบัตรประชาชน", return_condition_note: "" });
  const [ret, setRet] = useState(emptyRet);
  const setR = (k, v) => setRet((f) => ({ ...f, [k]: v }));
  const [retQ, setRetQ] = useState("");

  useEffect(() => { listJSON(MASTER_API, { action: "get_branches" }).then(setBranches).catch(() => {}); }, []);
  useEffect(() => { load(); }, []); // eslint-disable-line

  const branchInfo = (bc) => {
    const b = branches.find((x) => x.branch_code === bc) || {};
    return { branch_name: b.branch_name || "", branch_address: b.address || "", branch_phone: b.phone || b.mobile || "", affiliation: AFFIL_OF(bc) };
  };

  async function load() {
    setLoading(true);
    try {
      const body = { action: "list_custodies", date_from: filter.date_from, date_to: filter.date_to, status: filter.status, keyword: filter.keyword.trim(), limit: 1000 };
      if (!isAdmin) body.branch_code = myBranch;
      setRows(await listJSON(API, body));
    } catch { setRows([]); setMessage("❌ โหลดรายการไม่สำเร็จ (ตรวจว่า import workflow finance-custody-api แล้ว)"); }
    setLoading(false);
  }

  async function searchVehicle() {
    const kw = vehQ.trim();
    if (kw.length < 3) { setMessage("❌ พิมพ์อย่างน้อย 3 ตัวอักษร (ทะเบียน / เลขถัง / เลขเครื่อง / ชื่อลูกค้า / เลขใบขาย)"); return; }
    setVehSearching(true); setVehHits(null);
    try {
      const v = await postJSON(SALE_SEARCH_API, { action: "search_similar", keyword: kw });
      const vd = (Array.isArray(v) ? v : (v && Array.isArray(v.data) ? v.data : [])).filter((x) => x && SALE_SOURCES[x.source]);
      setVehHits(vd.slice(0, 30));
    } catch { setVehHits([]); }
    setVehSearching(false);
  }
  function pickVehicle(v) {
    const fin = String(v.contract_ref || "").trim(); // ไฟแนนซ์จากใบขาย
    const finMatch = fin ? FINANCES.find((f) => f !== "อื่นๆ (ระบุ)" && (fin.includes(f.split(" ")[0]) || f.includes(fin))) : "";
    setForm((f) => ({
      ...f,
      customer_name: v.customer_name || f.customer_name, customer_phone: v.customer_phone || f.customer_phone,
      finance_company: finMatch || (fin ? "อื่นๆ (ระบุ)" : f.finance_company), finance_other: finMatch ? "" : (fin || f.finance_other),
      brand: v.brand || f.brand, model: v.model_series || v.model_code || f.model, color: v.color || f.color, // ทะเบียนรถลูกค้า: model_code เป็นคำบรรยายยาว ใช้รุ่นอย่างเดียว
      plate_no: [v.plate_category, v.plate_number].filter(Boolean).join(" ") || f.plate_no, plate_province: v.plate_province || f.plate_province,
      chassis_no: v.chassis_no || f.chassis_no, engine_no: v.engine_no || f.engine_no,
    }));
    setVehHits(null);
  }

  function openEdit(r) {
    setTab("receive");
    setForm({
      ...emptyForm(), ...r, id: r.id, received_at: toLocalInput(r.received_at) || nowLocal(),
      finance_company: FINANCES.includes(r.finance_company) ? r.finance_company : "อื่นๆ (ระบุ)", finance_other: FINANCES.includes(r.finance_company) ? "" : (r.finance_company || ""),
      has_key: yn(r.has_key), has_regbook: yn(r.has_regbook), has_helmet: yn(r.has_helmet), has_battery: yn(r.has_battery), mirror_left: yn(r.mirror_left), mirror_right: yn(r.mirror_right), can_start: yn(r.can_start),
      mileage: r.mileage ?? "", storage_fee_per_day: r.storage_fee_per_day ?? "", key_count: r.key_count ?? 1,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (saving) return;
    const f = form;
    const finance = f.finance_company === "อื่นๆ (ระบุ)" ? f.finance_other.trim() : f.finance_company;
    if (!finance) { setMessage("❌ ระบุบริษัทไฟแนนซ์ที่จะส่งมอบรถ"); return; }
    if (!f.customer_name.trim()) { setMessage("❌ กรอกชื่อลูกค้าผู้นำรถมาฝาก"); return; }
    if (!f.plate_no.trim() && !f.chassis_no.trim()) { setMessage("❌ กรอกทะเบียนหรือเลขตัวถังอย่างน้อย 1 อย่าง"); return; }
    if (!f.brand.trim()) { setMessage("❌ กรอกยี่ห้อรถ"); return; }
    if (!f.received_by.trim()) { setMessage("❌ กรอกชื่อผู้รับฝาก"); return; }
    const bi = branchInfo(f.branch_code);
    if (!window.confirm(`${f.id ? "แก้ไข" : "บันทึก"}รับฝากรถเพื่อส่งมอบไฟแนนซ์\nผู้นำฝาก ${f.customer_name.trim()} → ส่งมอบ ${finance}\n${[f.brand, f.model, f.color].filter(Boolean).join(" ")} · ทะเบียน ${f.plate_no || "-"}\nสาขา ${f.branch_code} · ผู้รับฝาก ${f.received_by}?`)) return;
    setSaving(true); setMessage("");
    try {
      const body = {
        action: "save_custody", ...f, finance_company: finance, affiliation: bi.affiliation,
        mileage: f.mileage === "" ? null : num(f.mileage), key_count: f.has_key ? num(f.key_count) : 0, storage_fee_per_day: f.storage_fee_per_day === "" ? null : num(f.storage_fee_per_day),
        created_by: currentUser?.username || staffName, updated_by: currentUser?.username || staffName,
      };
      delete body.finance_other;
      const d = await postJSON(API, body);
      if (!d || d.__error || !d.doc_no) throw new Error(d?.__error || "บันทึกไม่สำเร็จ (ตรวจว่า import workflow finance-custody-api แล้ว)");
      setMessage(`✅ บันทึกใบรับฝาก ${d.doc_no} แล้ว — กำลังเปิดหน้าพิมพ์`);
      printDoc({ ...d, ...bi }, "custody");
      setForm(emptyForm());
      load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    setSaving(false);
  }

  async function cancelRow(r) {
    const reason = window.prompt(`ยกเลิกใบรับฝาก ${r.doc_no} (${r.finance_company} · ${plateLine(r)})\nเหตุผล:`);
    if (reason == null) return;
    try {
      const d = await postJSON(API, { action: "cancel_custody", id: r.id, reason, updated_by: currentUser?.username || staffName });
      if (!d || d.__error) throw new Error(d?.__error || "ยกเลิกไม่สำเร็จ");
      setMessage(`✅ ยกเลิก ${r.doc_no} แล้ว`); load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
  }

  function openReturn(r) { setRetTarget(r); setRet(emptyRet()); setMessage(""); }
  async function saveReturn() {
    if (saving || !retTarget) return;
    if (!ret.return_officer_name.trim()) { setMessage("❌ กรอกชื่อเจ้าหน้าที่ไฟแนนซ์ผู้รับรถคืน"); return; }
    if (!ret.returned_by.trim()) { setMessage("❌ กรอกชื่อผู้ส่งมอบ"); return; }
    if (!window.confirm(`ส่งมอบรถคืน ${retTarget.doc_no}\n${retTarget.finance_company} · ${vehicleLine(retTarget)} · ทะเบียน ${plateLine(retTarget)}\nผู้รับรถ ${ret.return_officer_name}?`)) return;
    setSaving(true); setMessage("");
    try {
      const d = await postJSON(API, { action: "return_custody", id: retTarget.id, ...ret, updated_by: currentUser?.username || staffName });
      if (!d || d.__error || !d.return_doc_no) throw new Error(d?.__error || "บันทึกคืนรถไม่สำเร็จ");
      setMessage(`✅ บันทึกส่งมอบรถคืน ${d.return_doc_no} แล้ว — กำลังเปิดหน้าพิมพ์`);
      printDoc({ ...d, ...branchInfo(d.branch_code) }, "return");
      setRetTarget(null);
      load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    setSaving(false);
  }

  const openRows = useMemo(() => {
    const q = retQ.trim().toLowerCase();
    return rows.filter((r) => r.status === "รับฝาก").filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, retQ]);
  const counts = useMemo(() => rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {}), [rows]);

  const StatusChip = ({ s }) => { const st = STATUS_STYLE[s] || { bg: "#e5e7eb", fg: "#374151" }; return <span style={{ padding: "2px 8px", borderRadius: 10, background: st.bg, color: st.fg, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{s}</span>; };
  const tabBtn = (k, label) => (
    <button onClick={() => setTab(k)} style={{ padding: "9px 18px", borderRadius: 10, border: tab === k ? "2px solid #1e3a8a" : "2px solid #d1d5db", background: tab === k ? "#1e3a8a" : "#fff", color: tab === k ? "#fff" : "#1e3a8a", fontWeight: 800, cursor: "pointer", fontFamily: "Tahoma", fontSize: 14 }}>{label}</button>
  );

  return (
    <div style={{ fontFamily: "Tahoma", maxWidth: 1180, margin: "0 auto" }}>
      <h2 className="page-title">🏍️ บันทึกรับฝากรถยึดไฟแนนซ์</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {tabBtn("receive", "📥 รับฝาก")}
        {tabBtn("return", `📤 คืนรถรับฝาก${counts["รับฝาก"] ? ` (${counts["รับฝาก"]} คันค้างอยู่)` : ""}`)}
      </div>
      {message && <div style={{ padding: "8px 12px", borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b", marginBottom: 10, fontSize: 13 }}>{message}</div>}

      {tab === "receive" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={sec}>{form.id ? `✏️ แก้ไขใบรับฝาก ${form.doc_no}` : "📥 บันทึกรับฝากรถยึด"}</div>
            {form.id ? <button onClick={() => setForm(emptyForm())} style={btn("#6b7280")}>ยกเลิกการแก้ไข</button> : null}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 12 }}>
            <Field label="วันที่-เวลารับฝาก *"><input type="datetime-local" value={form.received_at} onChange={(e) => setF("received_at", e.target.value)} style={inp} /></Field>
            <Field label="สาขาที่รับฝาก *">
              <select value={form.branch_code} onChange={(e) => setF("branch_code", e.target.value)} style={inp} disabled={!isAdmin && BRANCHES.includes(myBranch)}>
                {BRANCHES.map((bc) => <option key={bc} value={bc}>{bc} {branches.find((x) => x.branch_code === bc)?.branch_name || ""}</option>)}
              </select>
            </Field>
            <Field label="ผู้รับฝาก (พนักงาน) *"><input value={form.received_by} onChange={(e) => setF("received_by", e.target.value)} style={inp} /></Field>
            <Field label="ที่จอดเก็บ"><input value={form.storage_location} onChange={(e) => setF("storage_location", e.target.value)} placeholder="เช่น โกดังหลังร้าน แถว B" style={inp} /></Field>
          </div>

          <div style={sec}>👤 ผู้นำรถมาฝาก (ลูกค้า / ผู้เช่าซื้อ) → ส่งมอบให้ไฟแนนซ์</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 12 }}>
            <Field label="ชื่อลูกค้าผู้นำฝาก *"><input value={form.customer_name} onChange={(e) => setF("customer_name", e.target.value)} placeholder="ใช้ปุ่ม 🔍 ค้นหารถ ด้านล่างเติมอัตโนมัติได้" style={inp} /></Field>
            <Field label="โทร.ลูกค้า"><input value={form.customer_phone} onChange={(e) => setF("customer_phone", e.target.value)} style={inp} /></Field>
            <Field label="เลขบัตร ปชช. ลูกค้า"><input value={form.customer_id_card} onChange={(e) => setF("customer_id_card", e.target.value)} style={inp} /></Field>
            <Field label="ที่อยู่ลูกค้า" span={2}><input value={form.customer_address} onChange={(e) => setF("customer_address", e.target.value)} style={inp} /></Field>
            <Field label="ไฟแนนซ์ที่จะส่งมอบรถ *">
              <select value={form.finance_company} onChange={(e) => setF("finance_company", e.target.value)} style={inp}>{FINANCES.map((f) => <option key={f}>{f}</option>)}</select>
            </Field>
            {form.finance_company === "อื่นๆ (ระบุ)" && <Field label="ระบุชื่อไฟแนนซ์ *"><input value={form.finance_other} onChange={(e) => setF("finance_other", e.target.value)} style={inp} /></Field>}
            <Field label="เลขที่สัญญาเช่าซื้อ"><input value={form.contract_no} onChange={(e) => setF("contract_no", e.target.value)} style={{ ...inp, fontFamily: "monospace" }} /></Field>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={sec}>🏍️ ข้อมูลรถ</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
              <input value={vehQ} onChange={(e) => setVehQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchVehicle()} placeholder="ค้นจากการขายรถ (รวมย้อนหลัง): ทะเบียน / เลขถัง / เลขเครื่อง / ชื่อลูกค้า" style={{ ...inp, width: 330 }} />
              <button onClick={searchVehicle} disabled={vehSearching} style={btn("#0ea5e9")}>{vehSearching ? "..." : "🔍 ค้นหารถ"}</button>
            </div>
          </div>
          {vehHits && (
            <div style={{ border: "1px solid #bae6fd", background: "#f0f9ff", borderRadius: 10, padding: 8, marginBottom: 10, maxHeight: 220, overflow: "auto" }}>
              {vehHits.length === 0 ? <div style={{ fontSize: 13, color: "#64748b" }}>ไม่พบในประวัติการขายรถ — กรอกเองได้</div> : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>ใบขาย / วันที่</th><th style={th}>ลูกค้า</th><th style={th}>รถ</th><th style={th}>ทะเบียน</th><th style={th}>เลขถัง</th><th style={th}>ไฟแนนซ์</th><th style={th}></th></tr></thead>
                  <tbody>{vehHits.map((v, i) => (
                    <tr key={i}>
                      <td style={{ ...td, fontSize: 12 }}><span style={{ fontFamily: "monospace" }}>{v.ref_no || "-"}</span><div style={{ color: "#6b7280", fontSize: 11 }}>{v.ref_date ? thDate(v.ref_date) : ""} · {SALE_SOURCES[v.source]}</div></td>
                      <td style={td}>{v.customer_name || "-"}<div style={{ color: "#6b7280", fontSize: 11 }}>{v.customer_phone || ""}</div></td>
                      <td style={td}>{[v.brand, v.model_series, v.color].filter(Boolean).join(" ") || "-"}</td>
                      <td style={td}>{[v.plate_category, v.plate_number, v.plate_province].filter(Boolean).join(" ") || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{v.chassis_no || "-"}<div style={{ color: "#6b7280", fontSize: 11 }}>{v.engine_no || ""}</div></td>
                      <td style={{ ...td, fontSize: 12 }}>{v.contract_ref || "-"}</td>
                      <td style={td}><button onClick={() => pickVehicle(v)} style={btn("#16a34a")}>เลือก</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
              <div style={{ textAlign: "right", marginTop: 4 }}><button onClick={() => setVehHits(null)} style={{ ...btn("#9ca3af"), padding: "4px 10px", fontSize: 12 }}>ปิด</button></div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
            <Field label="ยี่ห้อ *"><input value={form.brand} onChange={(e) => setF("brand", e.target.value)} placeholder="HONDA / YAMAHA" style={inp} /></Field>
            <Field label="รุ่น"><input value={form.model} onChange={(e) => setF("model", e.target.value)} style={inp} /></Field>
            <Field label="สี"><input value={form.color} onChange={(e) => setF("color", e.target.value)} style={inp} /></Field>
            <Field label="ทะเบียน *"><input value={form.plate_no} onChange={(e) => setF("plate_no", e.target.value)} placeholder="เช่น 1กข 1234" style={inp} /></Field>
            <Field label="จังหวัดทะเบียน"><input value={form.plate_province} onChange={(e) => setF("plate_province", e.target.value)} style={inp} /></Field>
            <Field label="เลขตัวถัง"><input value={form.chassis_no} onChange={(e) => setF("chassis_no", e.target.value.toUpperCase())} style={{ ...inp, fontFamily: "monospace" }} /></Field>
            <Field label="เลขเครื่อง"><input value={form.engine_no} onChange={(e) => setF("engine_no", e.target.value.toUpperCase())} style={{ ...inp, fontFamily: "monospace" }} /></Field>
            <Field label="เลขไมล์ (กม.)"><input type="number" value={form.mileage} onChange={(e) => setF("mileage", e.target.value)} style={{ ...inp, textAlign: "right" }} /></Field>
          </div>

          <div style={sec}>🔧 สภาพรถและอุปกรณ์ที่รับฝาก</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10, alignItems: "center" }}>
            <Chk label="กุญแจ" checked={form.has_key} onChange={(v) => setF("has_key", v)} />
            {form.has_key && <input type="number" min={0} value={form.key_count} onChange={(e) => setF("key_count", e.target.value)} style={{ ...inp, width: 70, textAlign: "center" }} title="จำนวนดอก" />}
            <Chk label="เล่มทะเบียน/สำเนา" checked={form.has_regbook} onChange={(v) => setF("has_regbook", v)} />
            <Chk label="หมวกกันน็อก" checked={form.has_helmet} onChange={(v) => setF("has_helmet", v)} />
            <Chk label="แบตเตอรี่" checked={form.has_battery} onChange={(v) => setF("has_battery", v)} />
            <Chk label="กระจกซ้าย" checked={form.mirror_left} onChange={(v) => setF("mirror_left", v)} />
            <Chk label="กระจกขวา" checked={form.mirror_right} onChange={(v) => setF("mirror_right", v)} />
            <Chk label="สตาร์ทติด" checked={form.can_start} onChange={(v) => setF("can_start", v)} />
            <span style={{ fontSize: 13, marginLeft: 6 }}>น้ำมัน</span>
            <select value={form.fuel_level} onChange={(e) => setF("fuel_level", e.target.value)} style={{ ...inp, width: 90 }}>{FUEL_LEVELS.map((f) => <option key={f}>{f}</option>)}</select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, marginBottom: 12 }}>
            <Field label="อุปกรณ์อื่น / ของในรถ"><input value={form.accessories_note} onChange={(e) => setF("accessories_note", e.target.value)} placeholder="เช่น กล่องท้าย, เสื้อกันฝน" style={inp} /></Field>
            <Field label="ความเสียหาย / ตำหนิที่พบ"><textarea value={form.damage_note} onChange={(e) => setF("damage_note", e.target.value)} rows={2} placeholder="เช่น บังโคลนหน้าแตก, รอยขีดข่วนด้านขวา" style={{ ...inp, resize: "vertical" }} /></Field>
            <Field label="ค่าฝากรถ (บาท/วัน) — เว้นว่างถ้าไม่คิด"><input type="number" value={form.storage_fee_per_day} onChange={(e) => setF("storage_fee_per_day", e.target.value)} style={{ ...inp, textAlign: "right" }} /></Field>
            <Field label="หมายเหตุ"><input value={form.note} onChange={(e) => setF("note", e.target.value)} style={inp} /></Field>
          </div>
          <button onClick={save} disabled={saving} style={{ ...btn(saving ? "#9ca3af" : "#16a34a"), padding: "11px 26px", fontSize: 15 }}>{saving ? "กำลังบันทึก..." : form.id ? "💾 บันทึกการแก้ไข + พิมพ์ใบรับฝาก" : "💾 บันทึกรับฝาก + พิมพ์ใบรับฝาก"}</button>
        </div>
      )}

      {tab === "return" && (
        <div style={card}>
          <div style={sec}>📤 คืนรถรับฝากให้เจ้าหน้าที่ไฟแนนซ์</div>
          {!retTarget ? (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <input value={retQ} onChange={(e) => setRetQ(e.target.value)} placeholder="ค้นหารถที่ค้างฝาก: ทะเบียน / ไฟแนนซ์ / ลูกค้า / เลขที่ใบ" style={{ ...inp, maxWidth: 380 }} />
                <span style={{ fontSize: 13, color: "#6b7280" }}>{openRows.length} คันค้างอยู่</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={th}>เลขที่ใบรับฝาก</th><th style={th}>วันที่รับฝาก</th><th style={th}>ไฟแนนซ์</th><th style={th}>รถ</th><th style={th}>ทะเบียน</th><th style={th}>ผู้นำฝาก (ลูกค้า)</th><th style={th}>สาขา</th><th style={th}>ฝากมาแล้ว</th><th style={th}></th></tr></thead>
                  <tbody>
                    {openRows.length === 0 && <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 22 }}>{loading ? "กำลังโหลด..." : "ไม่มีรถค้างฝากในช่วงที่เลือก (ปรับช่วงวันที่ด้านล่าง)"}</td></tr>}
                    {openRows.map((r) => (
                      <tr key={r.id}>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{r.doc_no}</td>
                        <td style={td}>{thDateTime(r.received_at)}</td>
                        <td style={td}>{r.finance_company}</td>
                        <td style={td}>{vehicleLine(r)}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{plateLine(r)}</td>
                        <td style={td}>{r.customer_name || "-"}</td>
                        <td style={td}>{r.branch_code}</td>
                        <td style={td}>{Math.max(1, Math.ceil((Date.now() - new Date(r.received_at).getTime()) / 86400000))} วัน</td>
                        <td style={td}><button onClick={() => openReturn(r)} style={btn("#1d4ed8")}>📤 คืนรถ</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 6 }}>
                <div><b>ใบรับฝาก:</b> <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{retTarget.doc_no}</span> · {thDateTime(retTarget.received_at)}</div>
                <div><b>ไฟแนนซ์:</b> {retTarget.finance_company} {retTarget.contract_no ? `· สัญญา ${retTarget.contract_no}` : ""}</div>
                <div><b>รถ:</b> {vehicleLine(retTarget)} · ทะเบียน <b>{plateLine(retTarget)}</b></div>
                <div><b>เลขถัง/เครื่อง:</b> <span style={{ fontFamily: "monospace" }}>{retTarget.chassis_no || "-"} / {retTarget.engine_no || "-"}</span></div>
                <div><b>ผู้นำฝาก (ลูกค้า):</b> {retTarget.customer_name || "-"}{retTarget.customer_phone ? ` · ${retTarget.customer_phone}` : ""}</div>
                <div><b>ที่จอดเก็บ:</b> {retTarget.storage_location || "-"}{num(retTarget.storage_fee_per_day) > 0 ? ` · ค่าฝาก ${baht(retTarget.storage_fee_per_day)} บาท/วัน` : ""}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 12 }}>
                <Field label="วันที่-เวลาส่งมอบคืน *"><input type="datetime-local" value={ret.returned_at} onChange={(e) => setR("returned_at", e.target.value)} style={inp} /></Field>
                <Field label="ผู้ส่งมอบ (พนักงาน) *"><input value={ret.returned_by} onChange={(e) => setR("returned_by", e.target.value)} style={inp} /></Field>
                <Field label="เจ้าหน้าที่ไฟแนนซ์ผู้รับรถ *"><input value={ret.return_officer_name} onChange={(e) => setR("return_officer_name", e.target.value)} style={inp} /></Field>
                <Field label="เลขบัตร ปชช. ผู้รับรถ"><input value={ret.return_officer_id} onChange={(e) => setR("return_officer_id", e.target.value)} style={inp} /></Field>
                <Field label="โทร.ผู้รับรถ"><input value={ret.return_officer_phone} onChange={(e) => setR("return_officer_phone", e.target.value)} style={inp} /></Field>
                <Field label="เอกสารอ้างอิงที่แสดง"><input value={ret.return_ref_doc} onChange={(e) => setR("return_ref_doc", e.target.value)} style={inp} /></Field>
                <Field label="สภาพรถ ณ วันส่งมอบคืน" span={2}><textarea value={ret.return_condition_note} onChange={(e) => setR("return_condition_note", e.target.value)} rows={2} placeholder="เว้นว่าง = สภาพเดิมตามใบรับฝาก ไม่มีความเสียหายเพิ่มเติม" style={{ ...inp, resize: "vertical" }} /></Field>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveReturn} disabled={saving} style={{ ...btn(saving ? "#9ca3af" : "#16a34a"), padding: "11px 26px", fontSize: 15 }}>{saving ? "กำลังบันทึก..." : "💾 บันทึกส่งมอบคืน + พิมพ์ใบส่งมอบ"}</button>
                <button onClick={() => setRetTarget(null)} style={btn("#6b7280")}>← กลับ</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* รายการทั้งหมด */}
      <div style={card}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontWeight: 800, color: "#1e3a8a" }}>รายการรับฝาก</span>
          <input type="date" value={filter.date_from} onChange={(e) => setFilter((f) => ({ ...f, date_from: e.target.value }))} style={{ ...inp, width: 150 }} />
          <span>ถึง</span>
          <input type="date" value={filter.date_to} onChange={(e) => setFilter((f) => ({ ...f, date_to: e.target.value }))} style={{ ...inp, width: 150 }} />
          <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} style={{ ...inp, width: 130 }}>
            <option value="">ทุกสถานะ</option>{Object.keys(STATUS_STYLE).map((s) => <option key={s}>{s}</option>)}
          </select>
          <input value={filter.keyword} onChange={(e) => setFilter((f) => ({ ...f, keyword: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="ค้นหา ทะเบียน / ไฟแนนซ์ / ลูกค้า / เลขที่" style={{ ...inp, width: 240 }} />
          <button onClick={load} disabled={loading} style={btn("#1d4ed8")}>{loading ? "..." : "🔍 แสดง"}</button>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>{rows.length} รายการ · รับฝาก {counts["รับฝาก"] || 0} · คืนแล้ว {counts["คืนแล้ว"] || 0}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>เลขที่</th><th style={th}>รับฝาก</th><th style={th}>ผู้นำฝาก (ลูกค้า)</th><th style={th}>รถ</th><th style={th}>ทะเบียน</th><th style={th}>ส่งมอบให้ไฟแนนซ์</th><th style={th}>สาขา</th><th style={th}>สถานะ</th><th style={th}>ส่งมอบแล้ว</th><th style={th}></th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 22 }}>{loading ? "กำลังโหลด..." : "ไม่มีรายการ"}</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} style={r.status === "ยกเลิก" ? { opacity: 0.55 } : undefined}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{r.doc_no}</td>
                  <td style={td}>{thDateTime(r.received_at)}<div style={{ fontSize: 11, color: "#6b7280" }}>{r.received_by}</div></td>
                  <td style={td}>{r.customer_name || "-"}<div style={{ fontSize: 11, color: "#6b7280" }}>{r.customer_phone || ""}</div></td>
                  <td style={td}>{vehicleLine(r)}<div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{r.chassis_no || ""}</div></td>
                  <td style={{ ...td, fontWeight: 700 }}>{plateLine(r)}</td>
                  <td style={td}>{r.finance_company}<div style={{ fontSize: 11, color: "#6b7280" }}>{r.contract_no || ""}</div></td>
                  <td style={td}>{r.branch_code}</td>
                  <td style={td}><StatusChip s={r.status} /></td>
                  <td style={td}>{r.returned_at ? <>{thDateTime(r.returned_at)}<div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{r.return_doc_no}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{r.return_officer_name}</div></> : "-"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <button onClick={() => printDoc({ ...r, ...branchInfo(r.branch_code) }, "custody")} style={{ ...btn("#0ea5e9"), padding: "4px 9px", fontSize: 12 }} title="พิมพ์ใบรับฝาก">🖨️ รับฝาก</button>{" "}
                    {r.status === "คืนแล้ว" && <button onClick={() => printDoc({ ...r, ...branchInfo(r.branch_code) }, "return")} style={{ ...btn("#059669"), padding: "4px 9px", fontSize: 12 }} title="พิมพ์ใบส่งมอบคืน">🖨️ ส่งมอบคืน</button>}{" "}
                    {r.status === "รับฝาก" && <button onClick={() => openEdit(r)} style={{ ...btn("#f59e0b"), padding: "4px 9px", fontSize: 12 }}>✏️</button>}{" "}
                    {r.status === "รับฝาก" && <button onClick={() => { setTab("return"); openReturn(r); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ ...btn("#1d4ed8"), padding: "4px 9px", fontSize: 12 }}>📤 คืนรถ</button>}{" "}
                    {r.status === "รับฝาก" && isAdmin && <button onClick={() => cancelRow(r)} style={{ ...btn("#dc2626"), padding: "4px 9px", fontSize: 12 }}>ยกเลิก</button>}
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
