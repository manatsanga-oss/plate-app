import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// รายงานแนะนำปรับราคา/ค่าส่งเสริม — อิงยอดขาย·อัตราหมุน·เทรนด์·สต๊อก (HONDA+YAMAHA)
// รวมข้อมูลจาก: stock-turnover-api (turnover by_model) + master-data-api (ราคา/โปร/types)
// แนะนำ "ทิศทาง + ระดับ + เหตุผล" — ไม่ฟันธงตัวเลข (ดู+พิมพ์ ไม่บันทึก DB)
// ============================================================================
const ST_API = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-turnover-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const OVERRIDE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/price-promo-override-api"; // ราคา/โปรใหม่ที่พิมพ์เอง (มีประวัติ)
const HONDA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/honda-report-api"; // โควต้าที่ HONDA จัดสรร (บันทึกจากหน้าส่งรายงาน)
const BOOKING_API = "https://n8n-new-project-gwf2.onrender.com/webhook/moto-booking-api"; // คิวจองรถ — คอลัมน์ "รถจอง" นับใบสถานะจองค้างอยู่
const PRICE_FACTORY = 1; // ราคาขายแนะนำ = ราคาประกาศโรงงาน (อ้างอิง ไม่ปรับ)
const PRICE_ADJ = 5;     // ไฟแนนซ์ สิงห์ชัย = ราคาที่ปรับขึ้น-ลงจริง (Honda ปรับเฉพาะตัวนี้ · Yamaha ปรับทุกราคา)

const norm = (v) => String(v == null ? "" : v).replace(/\s+/g, "").toUpperCase();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayISO = () => iso(new Date());
const baht = (n) => (n == null || !Number.isFinite(Number(n)) ? "-" : Number(n).toLocaleString("th-TH"));

// รอบ 21 เดือนก่อน→20 เดือนปัจจุบัน + รอบก่อนหน้า (สำหรับเทรนด์)
function windows() {
  const d = new Date();
  const end = d.getDate() > 20 ? new Date(d.getFullYear(), d.getMonth(), 20) : new Date(d.getFullYear(), d.getMonth() - 1, 20);
  const start = new Date(end.getFullYear(), end.getMonth() - 1, 21);
  const pend = new Date(end.getFullYear(), end.getMonth() - 1, 20);
  const pstart = new Date(end.getFullYear(), end.getMonth() - 2, 21);
  return { from: iso(start), to: iso(end), pfrom: iso(pstart), pto: iso(pend) };
}

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => null);
  return Array.isArray(d) ? d : (d && d.data) || [];
}
const byModel = (rows) => (Array.isArray(rows) ? rows : []).filter((r) => r && r.kind === "by_model").map((r) => r.data);

// กติกาเดียวกับหน้าส่งรายงาน HONDA (HondaSalesReportPage — user สั่ง 2026-08-25):
// (1) แบบสืบทอด: ยอดรหัสเก่ายุบเข้ารหัสใหม่ ไม่แตกแถว (คู่ยืนยัน 2026-08-21) — เพิ่มคู่ใหม่ที่นี่และหน้าส่งรายงานพร้อมกันเมื่อ Honda เปลี่ยนแบบ
// (2) type สีพิเศษ TH1..TH8 ยุบเข้า type TH หลัก (สั่งซื้อ/วางแผน/ตั้งราคาแยกไม่ได้)
const SUCCESSOR = { ACB160CATV: "ACB160CATR", WW160AV: "WW160AS", WW160SV: "WW160SS", ACF110CBTT: "ACF110CBTS" };
const OLD2NEW = {}; for (const [nw, old] of Object.entries(SUCCESSOR)) OLD2NEW[norm(old)] = nw;
const isSpecialTHType = (t) => /^TH\d+$/.test(norm(t)) || /\(TH\d+\)$/.test(norm(t));
const foldKey = (brand, code, type) => {
  if (brand !== "HONDA") return { code, type };
  const nw = OLD2NEW[norm(code)];
  return { code: nw || code, type: nw || isSpecialTHType(type) ? "TH" : type };
};

// ===== ตรรกะแนะนำ =====
// sell% = ขาย/(ขาย+สต๊อก) · mos = เดือนคงคลัง (สต๊อก/ยอดขายต่อเดือน) · เทรนด์ = ขายนี้ vs ก่อน
function advise(sold, prev, stock, promo, received, quota) {
  const tot = sold + stock;
  const sell = tot > 0 ? sold / tot : 0;
  const mos = sold > 0 ? stock / sold : stock > 0 ? 9 : 0;
  const up = prev != null && sold > prev * 1.15;
  const dn = prev != null && sold < prev * 0.7;
  const hasPromo = promo > 0;
  const rationed = received != null && sold >= 3 && received < sold * 0.5; // ดีมานด์มาก แต่รับเข้าน้อย = โดนจำกัดโควตา
  // โควต้าเดือนหน้าที่ HONDA จัดสรรจริง (จากปุ่มโควต้า/เทียบแผนในหน้าส่งรายงาน) — null = ไม่มีข้อมูล/ไม่ใช่ HONDA
  const goodSale = sold >= 3 && sell >= 0.6;
  const quotaShort = quota != null && goodSale && quota < sold * 0.6;  // ขายดีแต่ได้รถไม่ถึง 60% ของยอดขาย
  const quotaOk = quota != null && goodSale && quota >= sold * 0.8;    // ขายดีและแนวโน้มได้รถพอ

  let pr; // promo
  // สต๊อกหมด = ไม่มีของให้ขาย — ไม่ต้องทำโปร/ค่าคอม (ถ้ามีโปรค้างอยู่ให้ตัดออกประหยัดงบ)
  if (stock === 0) pr = hasPromo
    ? { dir: "cut", level: "มาก", reason: "สต๊อกหมด — ไม่ต้องทำโปร ตัดโปรที่มีอยู่ประหยัดงบ" }
    : { dir: "hold", level: "-", reason: "สต๊อกหมด — ไม่ต้องทำโปร" };
  else if (rationed) pr = { dir: "cut", level: "มาก", reason: "ขายดีแต่ของเข้าน้อย (โดนจำกัดโควตา) — ตัดโปร เอางบไปรุ่นที่ระบายได้" };
  else if (sell >= 0.8 || (up && mos < 1)) pr = { dir: hasPromo ? "down" : "hold", level: sell >= 0.9 ? "มาก" : "กลาง", reason: "ขายดี/ของขาด — ไม่ต้องกระตุ้น" + (hasPromo ? " ลดโปรประหยัดงบ" : "") };
  else if (sell < 0.4 && mos >= 2) pr = { dir: "up", level: mos >= 4 ? "มาก" : "กลาง", reason: `ของจม ~${mos.toFixed(1)} เดือน — เพิ่มโปรกระตุ้นระบาย` };
  else if (dn) pr = { dir: "up", level: "กลาง", reason: "ยอดขายร่วง — เพิ่มโปรพยุงยอด" };
  else pr = { dir: "hold", level: "-", reason: "สมดุล — คงโปร" };

  let pc; // price
  if (stock === 0 && !quotaShort) pc = { dir: "hold", level: "-", reason: "สต๊อกหมด — ไม่ต้องปรับราคา รอของเข้าก่อน" };
  // ขายดี + โควต้าเดือนหน้าได้น้อย = ของจะขาดแน่ → แนะนำขึ้นราคา (คำสั่ง 2026-07-25)
  else if (quotaShort) pc = { dir: "up", level: quota < sold * 0.3 ? "กลาง" : "น้อย", reason: `ขายดี ${sold} คัน/เดือน แต่โควต้าเดือนหน้าได้ ${quota} คัน — ของจะขาด ขึ้นราคาได้` };
  // ขายดี + แนวโน้มได้รถพอ → ไม่ต้องปรับอะไร
  else if (quotaOk) pc = { dir: "hold", level: "-", reason: `ขายดีและโควต้าเดือนหน้าพอ (${quota} คัน) — คงราคา` };
  else if (sell >= 0.85 && mos < 0.7 && !dn) pc = { dir: "up", level: "น้อย", reason: "ดีมานด์ล้น ของขาด — ขยับราคาขึ้นได้" };
  else if (sell < 0.35 && mos >= 2.5) pc = { dir: "down", level: mos >= 4 ? "กลาง" : "น้อย", reason: "ของค้างนาน — ลดราคาช่วยระบาย" };
  else pc = { dir: "hold", level: "-", reason: "คงราคา" };

  return { sell, mos, trend: up ? "↑" : dn ? "↓" : "→", promo: pr, price: pc, quota };
}

const DIR = {
  up: { txt: "เพิ่ม", color: "#dc2626", bg: "#fef2f2" },
  down: { txt: "ลด", color: "#0369a1", bg: "#eff6ff" },
  cut: { txt: "ตัด", color: "#7c3aed", bg: "#f5f3ff" },
  hold: { txt: "คง", color: "#6b7280", bg: "#f9fafb" },
};
function AdviceBadge({ a }) {
  const d = DIR[a.dir] || DIR.hold;
  return (
    <div style={{ background: d.bg, border: `1px solid ${d.color}33`, borderRadius: 8, padding: "5px 8px", textAlign: "left" }}>
      <div style={{ fontWeight: 800, color: d.color, fontSize: 13 }}>{d.txt}{a.level !== "-" ? ` · ${a.level}` : ""}</div>
    </div>
  );
}

export default function PricePromoAdvicePage({ currentUser } = {}) {
  const W = windows();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL"); // ALL | HONDA | YAMAHA
  const [seriesFilter, setSeriesFilter] = useState(""); // "" = ทุกรุ่น
  const [onlyAction, setOnlyAction] = useState(false); // แสดงเฉพาะรุ่นที่มีคำแนะนำให้เปลี่ยน
  const [edits, setEdits] = useState({}); // ราคา/โปรใหม่ที่พิมพ์เอง keyed by row.key (prefill จาก DB ค่าล่าสุด)
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null); // null = ปิด modal, array = เปิด
  const [histMonth, setHistMonth] = useState("ALL"); // กรองเดือนในประวัติ: "YYYY-MM" หรือ "ALL"

  const setEdit = (key, field, val) => setEdits((e) => ({ ...e, [key]: { ...e[key], [field]: val } }));

  // บันทึกราคา/โปรใหม่ลง DB (append เป็นประวัติ — ดูย้อนหลังได้)
  async function saveEdits() {
    const items = rows
      .filter((r) => { const e = edits[r.key]; return e && (e.price !== "" && e.price != null || e.down !== "" && e.down != null || e.comm !== "" && e.comm != null); })
      .map((r) => { const e = edits[r.key] || {}; return {
        brand: r.brand, model_code: r.code, type_code: r.type, series: r.series,
        new_price: e.price === "" ? null : e.price, new_down: e.down === "" ? null : e.down, new_comm: e.comm === "" ? null : e.comm,
      }; });
    if (!items.length) { setMessage("⚠️ ยังไม่มีราคา/โปรใหม่ให้บันทึก"); return; }
    setSaving(true); setMessage("");
    try {
      const res = await post(OVERRIDE_API, { action: "save_overrides", items, saved_at: new Date().toISOString(), created_by: (currentUser && (currentUser.name || currentUser.email)) || "" });
      const err = Array.isArray(res) ? res.find((x) => x && x.__error) : null;
      if (err) throw new Error(err.__error);
      setMessage(`💾 บันทึกราคา/โปรใหม่ ${items.length} รายการแล้ว (ดูย้อนหลังได้)`);
    } catch (e) { setMessage("❌ บันทึกไม่สำเร็จ: " + (e && e.message ? e.message : String(e))); }
    setSaving(false);
  }
  // เปิดดูประวัติการบันทึกทั้งหมด
  async function openHistory() {
    setHistory([]); setMessage("");
    try {
      const res = await post(OVERRIDE_API, { action: "list_overrides", ...(brandFilter !== "ALL" ? { brand: brandFilter } : {}) });
      const list = Array.isArray(res) ? res : [];
      setHistory(list);
      // เริ่มต้นที่เดือนล่าสุดที่มีข้อมูล — เลือก "ทั้งหมด" เองได้จาก dropdown
      const months = [...new Set(list.map((h) => String(h.saved_at || "").slice(0, 7)).filter(Boolean))].sort();
      setHistMonth(months.length ? months[months.length - 1] : "ALL");
    } catch (e) { setMessage("❌ โหลดประวัติไม่สำเร็จ: " + (e && e.message ? e.message : String(e))); setHistory([]); }
  }
  const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const histMonthLabel = (ym) => { const [y, m] = ym.split("-").map(Number); return `${TH_MONTHS[(m || 1) - 1]} ${y + 543}`; };
  const histMonths = Array.isArray(history) ? [...new Set(history.map((h) => String(h.saved_at || "").slice(0, 7)).filter(Boolean))].sort().reverse() : [];
  const histList = Array.isArray(history) ? (histMonth === "ALL" ? history : history.filter((h) => String(h.saved_at || "").slice(0, 7) === histMonth)) : [];
  // พิมพ์เฉพาะตารางประวัติ — เปิดหน้าต่างใหม่ที่มีแค่ตารางนี้ (ข้ามหลายหน้าได้ ไม่กระทบหน้าหลัก)
  function printHistory() {
    const list = histList;
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const rowsHtml = list.map((h) => `<tr>` +
      `<td>${h.saved_at ? esc(new Date(h.saved_at).toLocaleString("th-TH")) : "-"}</td>` +
      `<td>${esc(h.brand)}</td>` +
      `<td class="l"><b>${esc(h.series)}</b> ${esc(h.model_code)} (${esc(h.type_code)})</td>` +
      `<td class="r">${baht(h.new_price)}</td>` +
      `<td class="r">${baht(h.new_down)}</td>` +
      `<td class="r">${baht(h.new_comm)}</td>` +
      `<td>${esc(h.created_by) || "-"}</td></tr>`).join("");
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ประวัติราคา/โปรใหม่ที่บันทึก</title>` +
      `<style>body{font-family:'Sarabun',Tahoma,'Segoe UI',sans-serif;padding:16px;color:#111}` +
      `h3{margin:0 0 12px}table{width:100%;border-collapse:collapse;font-size:13px}` +
      `th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:center}` +
      `thead th{background:#1e3a5f;color:#fff}td.l{text-align:left}td.r{text-align:right}` +
      `@page{size:landscape;margin:10mm}</style></head><body>` +
      `<h3>🕘 ประวัติราคา/โปรใหม่ที่บันทึก (${list.length}) — ${histMonth === "ALL" ? "ทั้งหมด" : histMonthLabel(histMonth)}</h3>` +
      `<table><thead><tr><th>วันที่บันทึก</th><th>ยี่ห้อ</th><th class="l">รุ่น / แบบ</th>` +
      `<th>ราคาใหม่</th><th>เงินดาวน์ออกแทน</th><th>ค่าคอมพิเศษ</th><th>โดย</th></tr></thead>` +
      `<tbody>${rowsHtml || '<tr><td colspan="7">ยังไม่มีประวัติ</td></tr>'}</tbody></table></body></html>`;
    const w = window.open("", "_blank", "width=1100,height=760");
    if (!w) { setMessage("⚠️ เบราว์เซอร์บล็อก popup — อนุญาต popup ของเว็บนี้แล้วลองใหม่"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 300);
  }

  // ตัวเลือกรุ่นใน dropdown (เฉพาะยี่ห้อที่เลือก)
  const seriesOptions = useMemo(() => {
    const base = brandFilter === "ALL" ? rows : rows.filter((r) => r.brand === brandFilter);
    return [...new Set(base.map((r) => r.series).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "th"));
  }, [rows, brandFilter]);

  async function load() {
    setLoading(true); setMessage("");
    try {
      const [thCur, tyCur, thPrev, tyPrev, pricesNow, pricesPrev, expenses, types, overrides] = await Promise.all([
        post(ST_API, { action: "turnover", brand: "HONDA", date_from: W.from, date_to: W.to }),
        post(ST_API, { action: "turnover", brand: "YAMAHA", date_from: W.from, date_to: W.to }),
        post(ST_API, { action: "turnover", brand: "HONDA", date_from: W.pfrom, date_to: W.pto }),
        post(ST_API, { action: "turnover", brand: "YAMAHA", date_from: W.pfrom, date_to: W.pto }),
        post(MASTER_API, { action: "get_moto_prices", as_of: W.from }),  // ราคา ณ ต้นรอบนี้ (= ราคาเดือนนี้)
        post(MASTER_API, { action: "get_moto_prices", as_of: W.pfrom }), // ราคา ณ ต้นรอบก่อน (= ราคาเดือนก่อน)
        post(MASTER_API, { action: "get_sale_expenses" }),
        post(MASTER_API, { action: "get_types" }),
        post(OVERRIDE_API, { action: "get_overrides" }).catch(() => []), // ราคา/โปรใหม่ล่าสุดที่เคยบันทึก (อาจยังไม่ได้ deploy → ว่าง)
      ]);
      const bookings = await post(BOOKING_API, { action: "get_moto_bookings" }).catch(() => []);

      // รถจองค้าง (สถานะ "จอง") นับต่อ (ยี่ห้อ|แบบ|type) — ใช้รุ่นล่าสุดถ้ามีการเปลี่ยนรุ่น (user 2026-08-25)
      // รูปแบบ model_code ในใบจอง: HONDA "ACF125CAT TH8" (รหัสแบบ + type) · YAMAHA "Grand Filano Hybrid BJKC00" (ชื่อรุ่น + รหัส type)
      // → token สุดท้าย = type, ที่เหลือ = code (ตรงกับ code/type ของ turnover ทั้ง 2 ยี่ห้อ) · มี token เดียว = จับคู่ด้วย type อย่างเดียว
      const bookedMap = {}, bookedTypeOnly = {};
      for (const bk of (Array.isArray(bookings) ? bookings : [])) {
        if (!bk || bk.status !== "จอง") continue;
        const bn = String(bk.brand || "");
        const bBrand = /ยามา|YAMAHA/i.test(bn) ? "YAMAHA" : "HONDA"; // "ฮอนด้า"/"ออนด้า"(สะกดผิดใน DB) = HONDA
        const eff = String(bk.new_model_code || bk.model_code || "").trim();
        if (!eff) continue;
        const toks = eff.split(/\s+/);
        if (toks.length >= 2) {
          const f = foldKey(bBrand, toks.slice(0, -1).join(" "), toks[toks.length - 1]);
          const k = bBrand + "|" + norm(f.code) + "|" + norm(f.type);
          bookedMap[k] = (bookedMap[k] || 0) + 1;
        } else {
          const k = bBrand + "|" + norm(toks[0]);
          bookedTypeOnly[k] = (bookedTypeOnly[k] || 0) + 1;
        }
      }

      // type_id lookup จาก (model_code|type_name)
      const typeByKey = {}; const typeById = {};
      for (const t of types) {
        typeByKey[norm(t.model_code) + "|" + norm(t.type_name)] = t;
        typeById[t.type_id] = t;
      }
      // ราคา id=1(โรงงาน)/id=5(สิงห์ชัย ไฟแนนซ์) ต่อ type_id — แยกรอบนี้/รอบก่อน (server กรอง as_of แล้ว)
      const buildPrices = (rows) => {
        const m = {};
        for (const p of (Array.isArray(rows) ? rows : [])) {
          const lv = Number(p.price_type_id);
          if (lv !== PRICE_FACTORY && lv !== PRICE_ADJ) continue;
          const eff = String(p.effective_date || "").slice(0, 10);
          const slot = lv === PRICE_FACTORY ? "factory" : "adj";
          const rec = m[p.type_id] || (m[p.type_id] = {});
          if (!rec[slot] || eff > rec[slot].eff) rec[slot] = { amount: Number(p.amount), eff };
        }
        return m;
      };
      const priceByType = buildPrices(pricesNow);
      const priceByTypePrev = buildPrices(pricesPrev);

      // โปร ค่าคอมพิเศษ/เงินดาวน์ออกแทน ทุกระดับ (type/series/brand) — เก็บ eff/end ไว้คำนวณ active ณ วันที่
      const isSalesPromo = (name) => { const n = String(name || ""); return n.includes("คอมพิเศษ") || n.includes("ดาวน์ออกแทน"); };
      // ประกัน 3PLUS ("ค่าประกัน 3PLUS" ใน master โปรโมชั่น) — คอลัมน์อ้างอิงต่อจากราคาโรงงาน (user 2026-08-25)
      const is3Plus = (name) => String(name || "").toUpperCase().replace(/\s+/g, "").includes("3PLUS");
      const promoType = {}, promoSeries = {}, promoBrand = {};
      const tpType = {}, tpSeries = {};
      for (const e of expenses) {
        if (e.expense_type !== "promotion" || e.status !== "active") continue;
        const item = { name: e.expense_name, amount: Number(e.amount) || 0, eff: String(e.effective_date || "").slice(0, 10), end: String(e.end_date || "").slice(0, 10) };
        if (is3Plus(e.expense_name)) {
          if (e.group_by === "type" && e.type_id != null) (tpType[String(e.type_id)] || (tpType[String(e.type_id)] = [])).push(item);
          else if (e.group_by === "series") { const sid = String(e.note || "").split("|")[0]; if (sid) (tpSeries[sid] || (tpSeries[sid] = [])).push(item); }
          continue;
        }
        if (!isSalesPromo(e.expense_name)) continue;
        if (e.group_by === "type" && e.type_id != null) (promoType[String(e.type_id)] || (promoType[String(e.type_id)] = [])).push(item);
        else if (e.group_by === "series") { const sid = String(e.note || "").split("|")[0]; if (sid) (promoSeries[sid] || (promoSeries[sid] = [])).push(item); }
        else if (e.group_by === "brand" && e.brand_id != null) (promoBrand[String(e.brand_id)] || (promoBrand[String(e.brand_id)] = [])).push(item);
      }
      const activeAt = (items, D) => items.filter((x) => (!x.eff || x.eff <= D) && (!x.end || x.end >= D));

      // โควต้า HONDA เดือนหน้า (รอบล่าสุดที่มีโควต้าบันทึกไว้) — ขายดี+ได้รถน้อย → แนะนำขึ้นราคา / ได้รถพอ → คงราคา
      // planSet = รุ่นที่อยู่ในแผนสั่งซื้อรอบนั้น: วางแผนแล้วโควต้า 0 = โดนตัดจริง · ไม่อยู่ในแผนเลย = ไม่มีข้อมูล (ใช้กติกาเดิม)
      let quotaMap = null;
      const planSet = new Set();
      try {
        const periods = await post(HONDA_API, { action: "list_honda_periods" });
        const qp = (Array.isArray(periods) ? periods : []).find((p) => Number(p.quota_total) > 0); // เรียง desc แล้ว
        if (qp) {
          const [qrows, prows] = await Promise.all([
            post(HONDA_API, { action: "get_honda_quota", period: qp.period }),
            post(HONDA_API, { action: "get_honda_report", period: qp.period }),
          ]);
          quotaMap = {};
          for (const r of (Array.isArray(qrows) ? qrows : [])) {
            if (!r || !r.model_code) continue;
            const qk = norm(r.model_code) + "|" + norm(r.type);
            quotaMap[qk] = (quotaMap[qk] || 0) + (Number(r.quota_qty) || 0);
          }
          for (const r of (Array.isArray(prows) ? prows : [])) {
            if (r && r.model_code && Number(r.plan_next) > 0) planSet.add(norm(r.model_code) + "|" + norm(r.type));
          }
        }
      } catch { quotaMap = null; }

      // รวม turnover เป็นระดับ (model_code|type) ต่อยี่ห้อ
      function aggregate(curRows, prevRows, brand) {
        const cur = {}, prev = {};
        for (const r of byModel(curRows)) {
          const f = foldKey(brand, r.code, r.type);
          const k = norm(f.code) + "|" + norm(f.type);
          if (!cur[k]) cur[k] = { code: f.code, type: f.type, model: r.model, sold: 0, stock: 0, received: 0 };
          cur[k].sold += Number(r.sold_qty) || 0; cur[k].stock += Number(r.stock_end_qty) || 0; cur[k].received += Number(r.received_qty) || 0;
        }
        for (const r of byModel(prevRows)) {
          const f = foldKey(brand, r.code, r.type);
          const k = norm(f.code) + "|" + norm(f.type);
          prev[k] = (prev[k] || 0) + (Number(r.sold_qty) || 0);
        }
        return Object.entries(cur).map(([k, v]) => {
          const t = typeByKey[k];
          const tid = t ? t.type_id : null;
          const amt = (rec, slot) => (rec && rec[slot] && Number.isFinite(rec[slot].amount) ? rec[slot].amount : null);
          const pinfo = tid != null ? priceByType[tid] : null;
          const pinfoPrev = tid != null ? priceByTypePrev[tid] : null;
          const priceAdj = amt(pinfo, "adj");          // ราคา id=5 รอบนี้
          const priceAdjPrev = amt(pinfoPrev, "adj");  // ราคา id=5 รอบก่อน
          const priceFactory = amt(pinfo, "factory");
          // ประกัน 3PLUS: ระดับ type มาก่อน ไม่มีค่อยใช้ระดับรุ่น — ถ้ามีหลายแถว (master ตั้งซ้ำ) เอาตัวที่มีผลล่าสุดตัวเดียว ไม่บวกซ้อน
          const tpPool = (tid != null && tpType[String(tid)]) && activeAt(tpType[String(tid)], W.to).length
            ? activeAt(tpType[String(tid)], W.to)
            : activeAt((t && tpSeries[String(t.series_id)]) || [], W.to);
          const threePlus = tpPool.length ? tpPool.reduce((b2, x) => (!b2 || x.eff > b2.eff ? x : b2), null).amount : null;
          const priceChanged = priceAdj !== priceAdjPrev; // เปลี่ยน → โชว์สีแดง+ค่าก่อน
          // ค่าคอม/เงินดาวน์ออกแทน ทุกระดับ (type + series + brand) แล้วกรอง active ณ สิ้นรอบนี้/รอบก่อน
          const poolItems = [
            ...((tid != null && promoType[String(tid)]) || []),
            ...((t && promoSeries[String(t.series_id)]) || []),
            ...((t && promoBrand[String(t.brand_id)]) || []),
          ];
          const promoItems = activeAt(poolItems, W.to);
          const promoPrevItems = activeAt(poolItems, W.pto);
          const promoTotal = promoItems.reduce((s, x) => s + x.amount, 0);
          const promoPrevTotal = promoPrevItems.reduce((s, x) => s + x.amount, 0);
          const promoChanged = promoTotal !== promoPrevTotal;
          // แยกโปรเป็น 2 หมวด: เงินดาวน์ออกแทน / ค่าคอมพิเศษ
          const isDown = (n) => String(n || "").includes("ดาวน์ออกแทน");
          const isComm = (n) => String(n || "").includes("คอมพิเศษ");
          const sum = (items) => items.reduce((s, x) => s + x.amount, 0);
          const downItems = promoItems.filter((x) => isDown(x.name));
          const commItems = promoItems.filter((x) => isComm(x.name));
          const downTotal = sum(downItems), commTotal = sum(commItems);
          const downPrevTotal = sum(promoPrevItems.filter((x) => isDown(x.name)));
          const commPrevTotal = sum(promoPrevItems.filter((x) => isComm(x.name)));
          const downChanged = downTotal !== downPrevTotal, commChanged = commTotal !== commPrevTotal;
          // โควต้า: เฉพาะ HONDA — มีโควต้า = ใช้ตัวเลขจริง · วางแผนแล้วไม่ได้ = 0 (โดนตัด) · ไม่อยู่ในรอบสั่งซื้อ = null
          const quota = brand === "HONDA" && quotaMap ? (quotaMap[k] != null ? quotaMap[k] : planSet.has(k) ? 0 : null) : null;
          const a = advise(v.sold, prev[k] != null ? prev[k] : null, v.stock, promoTotal, v.received, quota);
          return {
            brand, key: brand + "|" + k, model: v.model, code: v.code, type: v.type,
            series: t ? t.marketing_name || t.series_name : v.model,
            sold: v.sold, soldPrev: prev[k] != null ? prev[k] : null, stock: v.stock, received: v.received,
            booked: (bookedMap[brand + "|" + k] || 0) + (bookedTypeOnly[brand + "|" + norm(v.type)] || 0),
            priceAdj, priceAdjPrev, priceChanged, priceFactory, threePlus,
            promoTotal, promoPrevTotal, promoChanged, promoItems,
            downItems, downTotal, downPrevTotal, downChanged,
            commItems, commTotal, commPrevTotal, commChanged, ...a,
          };
        });
      }
      const all = [...aggregate(thCur, thPrev, "HONDA"), ...aggregate(tyCur, tyPrev, "YAMAHA")];
      all.sort((a, b) =>
        String(a.code || "").localeCompare(String(b.code || ""), "th", { numeric: true }) ||
        String(a.type || "").localeCompare(String(b.type || ""), "th", { numeric: true }));
      setRows(all);
      // prefill ช่องราคา/โปรใหม่จากค่าล่าสุดที่บันทึกไว้ (match ด้วย key เดียวกับ row.key)
      // ยกเว้นรุ่นที่สต๊อกหมด — ไม่เติมโปรเดิมค้างไว้ กันบันทึกโปรซ้ำทั้งที่ไม่มีของขาย
      const stockByKey = {};
      for (const r of all) stockByKey[r.key] = r.stock;
      const ed = {};
      for (const o of (Array.isArray(overrides) ? overrides : [])) {
        if (!o || o.__error) continue;
        const key = o.brand + "|" + norm(o.model_code) + "|" + norm(o.type_code);
        const outOfStock = stockByKey[key] === 0;
        ed[key] = {
          price: o.new_price == null ? "" : String(o.new_price),
          down: outOfStock || o.new_down == null ? "" : String(o.new_down),
          comm: outOfStock || o.new_comm == null ? "" : String(o.new_comm),
        };
      }
      setEdits(ed);
      const matchPrice = all.filter((r) => r.priceAdj != null).length;
      setMessage(`✅ ${all.length} รุ่น/แบบ · มีราคา ${matchPrice} · ช่วงขาย ${W.from} ถึง ${W.to} (เทียบรอบก่อน ${W.pfrom}–${W.pto})`);
    } catch (e) {
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + (e && e.message ? e.message : String(e)));
      setRows([]);
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const view = useMemo(() => {
    let v = rows;
    if (brandFilter !== "ALL") v = v.filter((r) => r.brand === brandFilter);
    if (seriesFilter) v = v.filter((r) => r.series === seriesFilter);
    if (onlyAction) v = v.filter((r) => r.promo.dir !== "hold" || r.price.dir !== "hold");
    return v;
  }, [rows, brandFilter, seriesFilter, onlyAction]);

  const th = { border: "1px solid #1e3a5f", padding: "8px 6px", fontSize: 12, color: "#fff", textAlign: "center" };
  const td = { border: "1px solid #e5e7eb", padding: "6px 8px", fontSize: 12, textAlign: "center" };

  // เซลล์โปรแยกหมวด (เงินดาวน์ออกแทน / ค่าคอมพิเศษ) — โชว์ยอด + ค่าเดือนก่อนเมื่อมีการเปลี่ยน
  const promoCell = (items, total, prevTotal, changed) => (
    <td style={{ ...td, textAlign: "right", fontSize: 12 }} title={items.map((x) => `${x.name} ${baht(x.amount)}`).join("\n")}>
      {items.length === 0 && !changed ? <span style={{ color: "#9ca3af" }}>-</span> : (
        <>
          <div style={{ fontWeight: 700, color: changed ? "#dc2626" : "#111827" }}>{items.length === 0 ? "0" : baht(total)}</div>
          {changed && <div style={{ fontSize: 9, color: "#9ca3af" }}>เดือนก่อน {baht(prevTotal)}</div>}
        </>
      )}
    </td>
  );

  // เซลล์กรอกราคา/โปรใหม่ (พิมพ์เอง) — บันทึกลง DB เมื่อกดปุ่มบันทึก
  const editCell = (key, field) => (
    <td style={td}>
      <input type="number" value={(edits[key] && edits[key][field]) ?? ""} onChange={(e) => setEdit(key, field, e.target.value)} placeholder="-"
        style={{ width: "92%", padding: "5px 6px", border: "1px solid #93c5fd", borderRadius: 6, fontSize: 12, textAlign: "right", background: "#f8fbff" }} />
    </td>
  );

  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 className="page-title">💡 แนะนำปรับราคา / ค่าส่งเสริม (อิงยอดขาย·อัตราหมุน)</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={saveEdits} disabled={saving} style={{ padding: "8px 18px", background: saving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>{saving ? "⏳ บันทึก..." : "💾 บันทึก"}</button>
          <button onClick={openHistory} style={{ padding: "8px 18px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>🕘 ดูย้อนหลัง</button>
          <button onClick={load} disabled={loading} style={{ padding: "8px 18px", background: loading ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>{loading ? "⏳ โหลด..." : "🔄 ดึงข้อมูล"}</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "10px 0 12px", padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontWeight: 600 }}>ยี่ห้อ:</span>
        {["ALL", "HONDA", "YAMAHA"].map((b) => (
          <button key={b} onClick={() => { setBrandFilter(b); setSeriesFilter(""); }} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", cursor: "pointer", fontWeight: 700, background: brandFilter === b ? "#1e3a5f" : "#fff", color: brandFilter === b ? "#fff" : "#374151" }}>{b === "ALL" ? "ทั้งหมด" : b}</button>
        ))}
        <select value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)} style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, minWidth: 170, background: "#fff", cursor: "pointer" }}>
          <option value="">🔻 รุ่นทั้งหมด ({seriesOptions.length})</option>
          {seriesOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={onlyAction} onChange={(e) => setOnlyAction(e.target.checked)} /> เฉพาะที่ควรปรับ
        </label>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#374151" }}>แสดง <b>{view.length}</b> รายการ</span>
      </div>
      {message && <div style={{ padding: "8px 12px", background: "#f0fdf4", color: "#166534", borderRadius: 6, marginBottom: 10, fontSize: 13 }}>{message}</div>}

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1430 }}>
          <thead style={{ background: "#1e3a5f" }}>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>รุ่น / แบบ</th>
              <th style={th}>ขาย<br />(30วัน)</th>
              <th style={th}>เทรนด์<br />(vs ก่อน)</th>
              <th style={th}>สต๊อก</th>
              <th style={th}>รถจอง</th>
              <th style={th}>ขายออก%</th>
              <th style={th}>เดือน<br />คงคลัง</th>
              <th style={th}>ราคาโรงงาน<br /><span style={{ fontSize: 9, fontWeight: 400 }}>(แนะนำ-อ้างอิง)</span></th>
              <th style={th}>ประกัน<br />3PLUS</th>
              <th style={th}>ราคาขายปัจจุบัน<br /><span style={{ fontSize: 9, fontWeight: 400 }}>(สิงห์ชัย ไฟแนนซ์)</span></th>
              <th style={th}>เงินดาวน์<br />ออกแทน</th>
              <th style={th}>ค่าคอม<br />พิเศษ</th>
              <th style={{ ...th, width: 110, background: "#0f5132" }}>✏️ ราคาใหม่<br /><span style={{ fontSize: 9, fontWeight: 400 }}>(พิมพ์เอง)</span></th>
              <th style={{ ...th, width: 110, background: "#0f5132" }}>✏️ เงินดาวน์<br />ออกแทนใหม่</th>
              <th style={{ ...th, width: 110, background: "#0f5132" }}>✏️ ค่าคอม<br />พิเศษใหม่</th>
              <th style={{ ...th, width: 200 }}>🏷️ แนะนำราคา</th>
              <th style={{ ...th, width: 200 }}>💰 แนะนำค่าส่งเสริม</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={17} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
            ) : view.length === 0 ? (
              <tr><td colSpan={17} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>
            ) : view.map((r) => (
              <tr key={r.key} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ ...td, textAlign: "left" }}>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{r.brand}</span><br />
                  <b>{r.series}</b> <span style={{ color: "#6b7280" }}>{r.code} ({r.type})</span>
                </td>
                <td style={td}><b>{r.sold}</b></td>
                <td style={{ ...td, color: r.trend === "↑" ? "#059669" : r.trend === "↓" ? "#dc2626" : "#9ca3af", fontWeight: 700 }}>{r.soldPrev != null ? `${r.soldPrev}→${r.sold} ${r.trend}` : "-"}</td>
                <td style={td}>{r.stock}</td>
                <td style={{ ...td, fontWeight: r.booked > 0 ? 700 : 400, color: r.booked > 0 ? "#7c3aed" : "#9ca3af" }}>{r.booked > 0 ? r.booked : "-"}</td>
                <td style={{ ...td, fontWeight: 700, color: r.sell >= 0.8 ? "#059669" : r.sell >= 0.5 ? "#d97706" : "#dc2626" }}>{Math.round(r.sell * 100)}%</td>
                <td style={td}>{r.sold > 0 ? r.mos.toFixed(1) : r.stock > 0 ? "∞" : "-"}</td>
                <td style={{ ...td, textAlign: "right", color: "#6b7280" }}>{baht(r.priceFactory)}</td>
                <td style={{ ...td, textAlign: "right", color: r.threePlus != null ? "#0369a1" : "#9ca3af" }}>{r.threePlus != null ? baht(r.threePlus) : "-"}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <span style={{ fontWeight: 700, color: r.priceChanged ? "#dc2626" : "#111827" }}>{baht(r.priceAdj)}</span>
                  {r.priceChanged && <div style={{ fontSize: 9, color: "#9ca3af" }}>เดือนก่อน {baht(r.priceAdjPrev)}</div>}
                </td>
                {promoCell(r.downItems, r.downTotal, r.downPrevTotal, r.downChanged)}
                {promoCell(r.commItems, r.commTotal, r.commPrevTotal, r.commChanged)}
                {editCell(r.key, "price")}
                {editCell(r.key, "down")}
                {editCell(r.key, "comm")}
                <td style={td}>
                  <AdviceBadge a={r.price} />
                  {r.price.dir !== "hold" && <div style={{ fontSize: 9, color: "#7c3aed", marginTop: 2 }}>{r.brand === "HONDA" ? "↳ ปรับเฉพาะ ฟn.สิงห์ชัย" : "↳ ปรับได้ทุกราคา"}</div>}
                </td>
                <td style={td}><AdviceBadge a={r.promo} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
        💡 เกณฑ์: ขายออก% = ขาย÷(ขาย+สต๊อก) · เดือนคงคลัง = สต๊อก÷ยอดขายต่อเดือน · "ขายดี/ของขาด"→ลดโปร/ขึ้นราคาได้ · "ของจม"→เพิ่มโปร/ลดราคา · "โดนจำกัดโควตา"→ตัดโปรเอางบไปรุ่นอื่น · <b>สต๊อก 0 → ไม่ต้องทำโปร/ค่าคอม</b> (มีโปรค้างอยู่ = แนะนำตัด)
        <br />🏷️ ราคา: <b>HONDA</b> ปรับเฉพาะ <b>ไฟแนนซ์ สิงห์ชัย</b> (ราคาอื่นคงที่ — ถ้าจะเพิ่มมูลค่าใช้ของแถม เช่น ประกัน = เพิ่มโปรแทน) · <b>YAMAHA</b> ปรับได้ทุกราคา · ราคาโรงงาน(แนะนำ) = ราคาประกาศ ไม่ปรับ
        <br />✏️ ช่อง "ราคาใหม่/เงินดาวน์ออกแทนใหม่/ค่าคอมพิเศษใหม่" = พิมพ์เอง กด <b>💾 บันทึก</b> เก็บลงระบบ (มีประวัติ ดูย้อนหลังได้) · <b>🖨️ พิมพ์</b> สั่งพิมพ์ตารางนี้
      </div>

      {/* Modal ดูย้อนหลังประวัติราคา/โปรใหม่ */}
      {history !== null && (
        <div onClick={() => setHistory(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: 20, overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, maxWidth: 1000, width: "100%", marginTop: 24, boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>🕘 ประวัติราคา/โปรใหม่ที่บันทึก ({histList.length})</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={histMonth} onChange={(e) => setHistMonth(e.target.value)} style={{ padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                  {histMonths.map((ym) => <option key={ym} value={ym}>{histMonthLabel(ym)}</option>)}
                  <option value="ALL">ทั้งหมดทุกเดือน</option>
                </select>
                <button onClick={printHistory} style={{ padding: "6px 14px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>🖨️ พิมพ์</button>
                <button onClick={() => setHistory(null)} style={{ padding: "6px 14px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>✕ ปิด</button>
              </div>
            </div>
            <div style={{ overflowX: "auto", maxHeight: "70vh", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead style={{ background: "#1e3a5f", position: "sticky", top: 0 }}>
                  <tr>
                    <th style={th}>วันที่บันทึก</th>
                    <th style={th}>ยี่ห้อ</th>
                    <th style={{ ...th, textAlign: "left" }}>รุ่น / แบบ</th>
                    <th style={th}>ราคาใหม่</th>
                    <th style={th}>เงินดาวน์ออกแทน</th>
                    <th style={th}>ค่าคอมพิเศษ</th>
                    <th style={th}>โดย</th>
                  </tr>
                </thead>
                <tbody>
                  {histList.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีประวัติ</td></tr>
                  ) : histList.map((h) => (
                    <tr key={h.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{h.saved_at ? new Date(h.saved_at).toLocaleString("th-TH") : "-"}</td>
                      <td style={td}>{h.brand}</td>
                      <td style={{ ...td, textAlign: "left" }}><b>{h.series}</b> <span style={{ color: "#6b7280" }}>{h.model_code} ({h.type_code})</span></td>
                      <td style={{ ...td, textAlign: "right" }}>{baht(h.new_price)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{baht(h.new_down)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{baht(h.new_comm)}</td>
                      <td style={td}>{h.created_by || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
