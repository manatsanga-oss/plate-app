import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// รายงานค่าส่งเสริมรายคัน (Report Admin) — user 2026-09-09
// แถว = รถที่ขายทุกคัน (ใบกำกับรถ tax_invoices_* ทุกสาขา ในช่วงวันที่) ไม่มีค่าส่งเสริมก็แสดง
// คอลัมน์ = ค่าส่งเสริมไฟแนนท์ / ค่าส่งเสริมผู้ผลิต (/ อื่น ๆ ถ้ามี) จาก "รายละเอียดการรับชำระ" รายได้อื่น ๆ (income_allocations)
// จัดกลุ่มตามผู้จ่ายในเอกสารรายได้ — backend: accounting-api action list_promo_income_by_vehicle (Accounting API (18).json)
// ============================================================================
const ACCOUNTING_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(n) ? n : 0; };
const baht = (v) => num(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthStartISO = () => todayISO().slice(0, 8) + "01";

// กลุ่มคอลัมน์ตามผู้จ่าย: ไฟแนนท์ / ผู้ผลิต / อื่น ๆ
const FINANCE_RE = /คาเธ่ย์|คาเธ่|cathay|ธนบรรณ|เน็คซ์|next capital|เอสจีเอฟ|sgf|กรุ๊ปลิส|group lease|อยุธยา แคปปิตอล|krungsri|กรุงศรี|ลีสซิ่ง|แคปปิตอล|leasing|capital/i;
const MAKER_RE = /ยามาฮ่า|yamaha|ฮอนด้า|honda/i;
const COL_FIN = "ค่าส่งเสริมไฟแนนท์";
const COL_MAKER = "ค่าส่งเสริมผู้ผลิต";
const COL_OTHER = "รายได้อื่น ๆ";
const COLS_ALL = [COL_FIN, COL_MAKER, COL_OTHER];
const groupOf = (payer) => {
  const s = String(payer || "");
  if (FINANCE_RE.test(s)) return COL_FIN;
  if (MAKER_RE.test(s)) return COL_MAKER;
  return COL_OTHER;
};
// ชื่อผู้จ่ายแบบสั้นไว้โชว์ใต้ยอด
const shortPayer = (name) => String(name || "").replace(/^\s*(บริษัท|บจก\.?|บมจ\.?|หจก\.?)\s*/, "").replace(/\s*จำกัด\s*(\(มหาชน\))?\s*$/, "").replace(/\s*(ลีสซิ่ง|แคปปิตอล|มอเตอร์)\s*$/, "").trim() || "-";
// ชื่อไฟแนนซ์มาตรฐานสำหรับตัวกรอง — ใบขายสะกดต่างกัน (เอสจีเอฟ / เอส จี เอฟ / SGF ...) รวมเป็นชื่อเดียว (user 2026-09-10)
const FINANCE_CANON = [
  [/คาเธ่ย์|คาเธ่|cathay/i, "คาเธ่ย์"],
  [/ธนบรรณ/i, "ธนบรรณ"],
  [/เน็คซ์|เน็กซ์|next/i, "เน็คซ์"],
  [/เอสจีเอฟ|sgf/i, "เอสจีเอฟ"],
  [/กรุ๊ปลิส|กรุ๊ปลีส|grouplease/i, "กรุ๊ปลิส"],
  [/อยุธยาแคปปิตอล|krungsri|กรุงศรี/i, "อยุธยา แคปปิตอล"],
];
const financeLabelOf = (name) => {
  const raw = String(name || "").trim();
  if (!raw || raw === "-" || /^เงินสด/.test(raw)) return "เงินสด";
  const compact = raw.replace(/\s+/g, "");
  for (const [re, label] of FINANCE_CANON) if (re.test(compact)) return label;
  return shortPayer(raw);
};
const branchLabel = (r) => {
  const sb = String(r.sale_branch || "").trim();
  if (sb) return sb.split(" ")[0];
  const ib = String(r.invoice_branch || "");
  return ib === "PAPAO" ? "ป.เปา" : ib === "SINGCHAI" ? "สิงห์ชัย" : ib === "NAKORNLUANG" ? "นครหลวง" : "-";
};
// ชื่อรุ่นสำหรับตัวกรอง: Yamaha ใบกำกับเขียน "ยามาฮ่า รุ่น BJKD00(Grand Filano Hybrid) แบบ - สี ..." → ในวงเล็บ; Honda "NHX125AT (TH) GRY - LEAD125" → หลัง " - " ท้ายสุด; ไม่เข้าแบบ → รหัสรุ่นใบขาย
const modelLabelOf = (r) => {
  const inv = String(r.invoice_model || "").trim();
  let m = inv.match(/รุ่น\s*[A-Z0-9-]+\s*\(([^)]+)\)/i);
  if (m) return m[1].replace(/\s*:\s*$/, "").replace(/^[ัิ-ฺ็-๎]+/, "").trim(); // ตัดสระ/วรรณยุกต์ลอยหน้าชื่อ (ข้อมูล DMS พิมพ์ผิด เช่น "ืNMAX")
  m = inv.match(/\s-\s([A-Za-z0-9+ .]+)\s*$/);
  if (m && !/^สี/.test(m[1])) return m[1].trim();
  const code = String(r.sale_model_code || "").trim();
  if (code) return code.split(" ")[0];
  return inv ? inv.split(" ")[0] : "-";
};
const parseAlloc = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim()) { try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; } }
  return [];
};

export default function PromoIncomeByVehiclePage() {
  const [dateFrom, setDateFrom] = useState(monthStartISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [affil, setAffil] = useState("");
  const [brand, setBrand] = useState("");
  const [modelF, setModelF] = useState(""); // ตัวกรองรุ่น (user 2026-09-10)
  const [financeF, setFinanceF] = useState(""); // ตัวกรองไฟแนนท์ ("เงินสด" = ไม่มีไฟแนนซ์)
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [kw, setKw] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState(null); // { vehicle, col, lines }

  async function load() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_promo_income_by_vehicle", date_from: dateFrom, date_to: dateTo }),
      });
      const raw = await res.text();
      const data = raw.trim() ? JSON.parse(raw) : [];
      const arr = (Array.isArray(data) ? data : (data?.rows || [])).filter((r) => r && r.invoice_no);
      setRows(arr);
      if (!arr.length) setMessage("ไม่พบใบกำกับรถในช่วงวันที่นี้");
    } catch (e) {
      setRows([]); setMessage("❌ โหลดไม่สำเร็จ: " + e.message);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  // แปลงเป็นรถ 1 คัน/แถว + ยอดตามกลุ่มคอลัมน์
  const vehicles = useMemo(() => rows
    .filter((r) => !/cancel|ยกเลิก|void/i.test(String(r.invoice_status || "")))
    .map((r) => {
      const lines = parseAlloc(r.alloc_json).map((l) => ({ ...l, col: groupOf(l.payer_name) }));
      const cells = {}; const payers = {};
      for (const l of lines) {
        cells[l.col] = (cells[l.col] || 0) + num(l.amount);
        (payers[l.col] = payers[l.col] || new Set()).add(shortPayer(l.payer_name));
      }
      return {
        invoice_no: r.invoice_no, invoice_date: r.invoice_date, sale_date: r.sale_date, sale_invoice_no: r.sale_invoice_no,
        branch: branchLabel(r), invoice_branch: r.invoice_branch, brand: r.brand || "", sale_invoice_type: r.sale_invoice_type || "",
        customer: r.sale_customer || r.invoice_customer || "-",
        model: r.sale_model_code ? `${r.sale_model_code}${r.color_name ? " สี " + r.color_name : ""}` : (r.invoice_model || "-"),
        model_label: modelLabelOf(r),
        finance_label: financeLabelOf(r.finance_company),
        engine_no: r.engine_no || "-", chassis_no: r.chassis_no || "-", finance: r.finance_company || "",
        invoice_total: num(r.invoice_total),
        // ประกันรถหายออกแทน (ร้านจ่ายเบี้ยเป็นโปรโมชั่น / ไฟแนนซ์หักจากยอดโอน) จากใบขายระบบ NEW — ลูกค้าจ่ายเอง (finance) ไม่นับ
        // ระบบเก่า (DMS): อยู่ในใบเสร็จรับชำระเป็นวิธี "ใบลดหนี้" (daily_receipts.credit_note) — ใช้เมื่อใบขายระบบ NEW ไม่มี
        theft_promo: /โปรโมชั่นออกแทน|ไฟแนนซ์หัก/.test(String(r.theft_insurance_source || "")) ? num(r.theft_insurance_amount) : num(r.dms_credit_note),
        theft_src: /โปรโมชั่นออกแทน|ไฟแนนซ์หัก/.test(String(r.theft_insurance_source || "")) ? "ใบขาย NEW" : (num(r.dms_credit_note) > 0 ? `ใบลดหนี้ ${r.credit_note_receipts || ""}`.trim() : ""),
        down_payout: num(r.down_payout_amount),
        cells, payers: Object.fromEntries(Object.entries(payers).map(([k, v]) => [k, [...v]])), lines,
        total: lines.reduce((s, l) => s + num(l.amount), 0),
      };
    }), [rows]);

  const affilOpts = useMemo(() => [...new Set(vehicles.map((v) => v.branch).filter((x) => x && x !== "-"))].sort(), [vehicles]);
  const brandOpts = useMemo(() => [...new Set(vehicles.map((v) => v.brand).filter(Boolean))].sort(), [vehicles]);
  // รายการรุ่น (ตามยี่ห้อที่เลือก) พร้อมจำนวนคัน
  const modelOpts = useMemo(() => {
    const cnt = {};
    for (const v of vehicles) { if (brand && v.brand !== brand) continue; const k = v.model_label || "-"; cnt[k] = (cnt[k] || 0) + 1; }
    return Object.keys(cnt).sort((a, b) => a.localeCompare(b, "th")).map((k) => ({ k, n: cnt[k] }));
  }, [vehicles, brand]);
  useEffect(() => { if (modelF && !modelOpts.some((o) => o.k === modelF)) setModelF(""); }, [modelOpts, modelF]);
  // รายการไฟแนนท์ (ชื่อย่อ) พร้อมจำนวนคัน — ตามยี่ห้อ/รุ่นที่เลือก
  const financeOpts = useMemo(() => {
    const cnt = {};
    for (const v of vehicles) { if (brand && v.brand !== brand) continue; if (modelF && v.model_label !== modelF) continue; cnt[v.finance_label] = (cnt[v.finance_label] || 0) + 1; }
    return Object.keys(cnt).sort((a, b) => (a === "เงินสด") - (b === "เงินสด") || a.localeCompare(b, "th")).map((k) => ({ k, n: cnt[k] }));
  }, [vehicles, brand, modelF]);
  useEffect(() => { if (financeF && !financeOpts.some((o) => o.k === financeF)) setFinanceF(""); }, [financeOpts, financeF]);

  const filtered = useMemo(() => {
    const q = kw.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (affil && v.branch !== affil) return false;
      if (brand && v.brand !== brand) return false;
      if (modelF && v.model_label !== modelF) return false;
      if (financeF && v.finance_label !== financeF) return false;
      if (onlyPromo && !(v.total > 0)) return false;
      if (!q) return true;
      const hay = [v.invoice_no, v.sale_invoice_no, v.customer, v.chassis_no, v.engine_no, v.model, v.finance, ...v.lines.map((l) => `${l.income_doc_no} ${l.payer_name} ${l.reference_no}`)]
        .map((x) => String(x || "").toLowerCase()).join(" | ");
      return hay.includes(q);
    });
  }, [vehicles, affil, brand, modelF, financeF, onlyPromo, kw]);

  const colTotals = useMemo(() => {
    const t = {}; for (const v of filtered) for (const c of COLS_ALL) t[c] = (t[c] || 0) + (v.cells[c] || 0);
    return t;
  }, [filtered]);
  // คอลัมน์ "อื่น ๆ" โชว์เฉพาะเมื่อมียอด
  const cols = useMemo(() => COLS_ALL.filter((c) => c !== COL_OTHER || colTotals[c] > 0), [colTotals]);
  const grand = cols.reduce((s, c) => s + (colTotals[c] || 0), 0);
  const theftTotal = filtered.reduce((s, v) => s + v.theft_promo, 0);
  const theftCount = filtered.filter((v) => v.theft_promo > 0).length;
  const promoCount = filtered.filter((v) => v.total > 0).length;

  function exportCsv() {
    const head = ["สาขา", "ใบกำกับรถ", "วันที่ใบกำกับ", "ใบขาย", "ลูกค้า", "ไฟแนนซ์", "รุ่น/สี", "เลขเครื่อง", "เลขถัง", "ยอดใบกำกับ", "ประกันรถหายออกแทน", ...cols, "รวมค่าส่งเสริม"];
    const lines = filtered.map((v) => [v.branch, v.invoice_no, thDate(v.invoice_date), v.sale_invoice_no || "", v.customer, v.finance, v.model, v.engine_no, v.chassis_no, v.invoice_total.toFixed(2), v.theft_promo.toFixed(2), ...cols.map((c) => (v.cells[c] || 0).toFixed(2)), v.total.toFixed(2)]);
    lines.push(["รวม", "", "", "", "", "", "", "", "", filtered.reduce((s, v) => s + v.invoice_total, 0).toFixed(2), theftTotal.toFixed(2), ...cols.map((c) => (colTotals[c] || 0).toFixed(2)), grand.toFixed(2)]);
    const csv = "﻿" + [head, ...lines].map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `promo_income_by_vehicle_${dateFrom}_${dateTo}.csv`; a.click();
  }

  const inp = { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 13 };
  const btn = { padding: "8px 14px", borderRadius: 8, border: "none", fontFamily: "Tahoma", fontSize: 13, cursor: "pointer", fontWeight: 600 };
  const colBg = { [COL_FIN]: "#4c1d95", [COL_MAKER]: "#9a3412", [COL_OTHER]: "#374151" };
  const colFg = { [COL_FIN]: "#4c1d95", [COL_MAKER]: "#9a3412", [COL_OTHER]: "#374151" };

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1600 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>🎁 รายงานค่าส่งเสริมรายคัน
        <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 400 }}> — รถที่ขายทุกคัน (ตามใบกำกับรถ) + ค่าส่งเสริมที่ได้รับแยก ไฟแนนท์ / ผู้ผลิต จากรายละเอียดการรับชำระรายได้อื่น ๆ</span>
      </h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "12px 0" }}>
        <label style={{ fontSize: 13 }}>ใบกำกับตั้งแต่ <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inp} /></label>
        <label style={{ fontSize: 13 }}>ถึง <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inp} /></label>
        <button onClick={load} disabled={loading} style={{ ...btn, background: "#2563eb", color: "#fff" }}>{loading ? "⏳ กำลังโหลด..." : "🔍 ค้นหา"}</button>
        <select value={affil} onChange={(e) => setAffil(e.target.value)} style={inp}>
          <option value="">สาขา: ทั้งหมด</option>
          {affilOpts.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} style={inp}>
          <option value="">ยี่ห้อ: ทั้งหมด</option>
          {brandOpts.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={modelF} onChange={(e) => setModelF(e.target.value)} style={{ ...inp, maxWidth: 220 }} title="กรองตามรุ่น (ชื่อรุ่นจากใบกำกับรถ)">
          <option value="">รุ่น: ทั้งหมด</option>
          {modelOpts.map((o) => <option key={o.k} value={o.k}>{o.k} ({o.n})</option>)}
        </select>
        <select value={financeF} onChange={(e) => setFinanceF(e.target.value)} style={{ ...inp, maxWidth: 220 }} title="กรองตามบริษัทไฟแนนซ์ของใบขาย (เงินสด = ไม่ผ่านไฟแนนซ์)">
          <option value="">ไฟแนนท์: ทั้งหมด</option>
          {financeOpts.map((o) => <option key={o.k} value={o.k}>{o.k} ({o.n})</option>)}
        </select>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 8, background: onlyPromo ? "#ede9fe" : "#fff" }}>
          <input type="checkbox" checked={onlyPromo} onChange={(e) => setOnlyPromo(e.target.checked)} /> เฉพาะคันที่มีค่าส่งเสริม
        </label>
        <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="ค้นหา (ใบกำกับ / ใบขาย / ลูกค้า / เลขเครื่อง / เลขถัง / เอกสารรายได้)" style={{ ...inp, minWidth: 320, flex: 1 }} />
        <button onClick={exportCsv} disabled={!filtered.length} style={{ ...btn, background: "#16a34a", color: "#fff" }}>📥 Export CSV</button>
      </div>

      {message && <div style={{ padding: 10, background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8, fontSize: 13, marginBottom: 10 }}>{message}</div>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 170, padding: 12, background: "#eff6ff", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#1d4ed8" }}>🏍️ รถที่ขาย</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1d4ed8" }}>{filtered.length.toLocaleString("th-TH")} คัน</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>มีค่าส่งเสริม {promoCount.toLocaleString("th-TH")} คัน</div>
        </div>
        {cols.map((c) => (
          <div key={c} style={{ flex: 1, minWidth: 170, padding: 12, background: "#f5f3ff", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: colFg[c] }}>{c}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colFg[c] }}>฿ {baht(colTotals[c])}</div>
          </div>
        ))}
        <div style={{ flex: 1, minWidth: 170, padding: 12, background: "#fff1f2", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#be123c" }}>🛡️ ประกันรถหายออกแทน</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#be123c" }}>฿ {baht(theftTotal)}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{theftCount.toLocaleString("th-TH")} คัน</div>
        </div>
        <div style={{ flex: 1, minWidth: 170, padding: 12, background: "#f0fdf4", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#15803d" }}>💰 รวมค่าส่งเสริม</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#15803d" }}>฿ {baht(grand)}</div>
        </div>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1e3a8a", color: "#fff" }}>
              <th style={th}>#</th>
              <th style={th}>สาขา</th>
              <th style={th}>ใบกำกับรถ</th>
              <th style={th}>วันที่ใบกำกับ</th>
              <th style={th}>ลูกค้า / ไฟแนนซ์</th>
              <th style={th}>รุ่น / สี</th>
              <th style={th}>เลขเครื่อง / เลขถัง</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดใบกำกับ</th>
              <th style={{ ...th, textAlign: "right", background: "#9f1239" }}>ประกันรถหายออกแทน</th>
              {cols.map((c) => <th key={c} style={{ ...th, textAlign: "right", background: colBg[c] }}>{c}</th>)}
              <th style={{ ...th, textAlign: "right", background: "#14532d" }}>รวมค่าส่งเสริม</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => (
              <tr key={v.invoice_no + i} style={{ borderTop: "1px solid #f1f5f9", background: i % 2 ? "#fafafa" : "#fff" }}>
                <td style={td}>{i + 1}</td>
                <td style={td}>{v.branch}{v.sale_invoice_type === "ขายส่ง" && <div style={{ fontSize: 11, color: "#b45309" }}>ขายส่ง</div>}</td>
                <td style={{ ...td, fontFamily: "monospace", whiteSpace: "nowrap" }}>{v.invoice_no}
                  {v.sale_invoice_no && <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "Tahoma" }}>{v.sale_invoice_no}</div>}
                </td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{thDate(v.invoice_date)}
                  {v.sale_date && thDate(v.sale_date) !== thDate(v.invoice_date) && <div style={{ fontSize: 11, color: "#6b7280" }}>ขาย {thDate(v.sale_date)}</div>}
                </td>
                <td style={td}>{v.customer}
                  {v.finance ? <div style={{ fontSize: 11, color: "#7c3aed" }}>🏦 {v.finance}</div> : <div style={{ fontSize: 11, color: "#059669" }}>เงินสด</div>}
                </td>
                <td style={td}>{v.model_label && v.model_label !== "-" && !v.model.includes(v.model_label) ? <div style={{ fontWeight: 600 }}>{v.model_label}</div> : null}{v.model}{v.brand && <div style={{ fontSize: 11, color: "#6b7280" }}>{v.brand}</div>}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{v.engine_no}<div style={{ color: "#6b7280" }}>{v.chassis_no}</div></td>
                <td style={{ ...td, textAlign: "right" }}>{baht(v.invoice_total)}</td>
                <td style={{ ...td, textAlign: "right", color: v.theft_promo ? "#be123c" : "#d1d5db", fontWeight: v.theft_promo ? 600 : 400 }} title={v.theft_src}>{v.theft_promo ? baht(v.theft_promo) : "-"}
                  {v.theft_promo > 0 && v.theft_src.startsWith("ใบลดหนี้") && <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400 }}>ใบลดหนี้ (DMS)</div>}
                </td>
                {cols.map((c) => {
                  const amt = v.cells[c] || 0;
                  return (
                    <td key={c} style={{ ...td, textAlign: "right", color: amt ? colFg[c] : "#d1d5db", cursor: amt ? "pointer" : "default", fontWeight: amt ? 600 : 400 }}
                      title={amt ? v.lines.filter((l) => l.col === c).map((l) => `${l.income_doc_no}${l.campaign ? " · " + l.campaign : ""} ${baht(l.amount)}`).join("\n") : ""}
                      onClick={() => amt && setDetail({ vehicle: v, col: c, lines: v.lines.filter((l) => l.col === c) })}>
                      {amt ? baht(amt) : "-"}
                      {amt > 0 && <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400 }}>{(v.payers[c] || []).join(", ")}</div>}
                    </td>
                  );
                })}
                <td style={{ ...td, textAlign: "right", fontWeight: 700, color: v.total ? "#14532d" : "#d1d5db" }}>{v.total ? baht(v.total) : "-"}</td>
              </tr>
            ))}
            {!filtered.length && !loading && (
              <tr><td colSpan={10 + cols.length} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ background: "#fefce8", fontWeight: 700 }}>
                <td colSpan={7} style={{ ...td, textAlign: "right" }}>รวม {filtered.length.toLocaleString("th-TH")} คัน (มีค่าส่งเสริม {promoCount.toLocaleString("th-TH")} คัน)</td>
                <td style={{ ...td, textAlign: "right" }}>{baht(filtered.reduce((s, v) => s + v.invoice_total, 0))}</td>
                <td style={{ ...td, textAlign: "right", color: "#be123c" }}>{baht(theftTotal)}</td>
                {cols.map((c) => <td key={c} style={{ ...td, textAlign: "right", color: colFg[c] }}>{baht(colTotals[c])}</td>)}
                <td style={{ ...td, textAlign: "right", color: "#14532d" }}>{baht(grand)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, minWidth: 520, maxWidth: 780, maxHeight: "80vh", overflow: "auto", fontFamily: "Tahoma" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{detail.col} — {detail.vehicle.invoice_no}</div>
              <button onClick={() => setDetail(null)} style={{ ...btn, background: "#e5e7eb" }}>ปิด</button>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>{detail.vehicle.customer} · {detail.vehicle.model} · {detail.vehicle.engine_no}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "#f3f4f6" }}>
                <th style={{ ...th, color: "#111827" }}>เอกสารรายได้</th><th style={{ ...th, color: "#111827" }}>วันที่</th><th style={{ ...th, color: "#111827" }}>ผู้จ่าย / อ้างอิง</th><th style={{ ...th, color: "#111827" }}>หมายเหตุ</th><th style={{ ...th, color: "#111827", textAlign: "right" }}>จำนวนเงิน</th>
              </tr></thead>
              <tbody>
                {detail.lines.map((l) => (
                  <tr key={l.allocation_id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ ...td, fontFamily: "monospace" }}>{l.income_doc_no}</td>
                    <td style={td}>{thDate(l.doc_date)}</td>
                    <td style={td}>{l.payer_name || "-"}{l.reference_no && <div style={{ fontSize: 11, color: "#6b7280" }}>อ้างอิง {l.reference_no}</div>}{l.campaign && <div style={{ fontSize: 11, color: "#9a3412" }}>🏭 {l.campaign}</div>}{l.doc_description && <div style={{ fontSize: 11, color: "#6b7280" }}>{l.doc_description}</div>}</td>
                    <td style={td}>{l.note || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{baht(l.amount)}</td>
                  </tr>
                ))}
                <tr style={{ background: "#fefce8", fontWeight: 700 }}>
                  <td colSpan={4} style={{ ...td, textAlign: "right" }}>รวม</td>
                  <td style={{ ...td, textAlign: "right" }}>{baht(detail.lines.reduce((s, l) => s + num(l.amount), 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: "9px 10px", fontSize: 12.5, whiteSpace: "nowrap", textAlign: "left" };
const td = { padding: "8px 10px", verticalAlign: "top" };
