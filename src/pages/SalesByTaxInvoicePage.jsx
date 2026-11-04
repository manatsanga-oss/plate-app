import React, { useEffect, useMemo, useRef, useState } from "react";

// รายงานการขายตามวันที่ใบกำกับภาษี — Report for FlowAcc (user 2026-11-04)
// ใช้บันทึกยอดขายรถใน FlowAccount: กรองเป็นเดือน (ตามวันที่ใบกำกับ) → แยกสังกัด → แยกร้าน (รหัสสาขา) → แยกประเภทการขาย
// เงินสด / ไฟแนนท์ (แยกตามบริษัทไฟแนนท์) · ข้อมูลจาก list-tax-invoices (ไฟล์ภาษีขายที่ upload) join ใบขาย NEW เพื่อรู้บริษัทไฟแนนท์/สาขา
const TAXINV_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/list-tax-invoices";
const USED_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/used-moto-api"; // รถมือสองที่ขายแล้ว (used_moto_stock) — ใบกำกับที่ไม่มีใบขาย NEW แต่เลขถัง/เลขเครื่องตรง = ขายรถมือสอง (user 2026-11-04 เคส 69MC/0001523, 69MC/0001454)
const COMPANIES = ["PAPAO", "NAKORNLUANG", "SINGCHAI"];
// สังกัดตามบริษัทผู้ออกใบกำกับ (ป.เปา = PAPAO + นครหลวง สาขา 00001)
const AFFIL = {
  PAPAO: { key: "PAPAO", label: "บจ. ป.เปา มอเตอร์เซอร์วิส", order: 1 },
  NAKORNLUANG: { key: "PAPAO", label: "บจ. ป.เปา มอเตอร์เซอร์วิส", order: 1 },
  SINGCHAI: { key: "SINGCHAI", label: "หจก. สิงห์ชัยสยามยนต์", order: 2 },
};
const BR_LABEL = { SCY01: "SCY01 สำนักงานใหญ่", SCY04: "SCY04 ตลาดสีขวา", SCY05: "SCY05 นครหลวง", SCY06: "SCY06 ป.เปาวังน้อย", SCY07: "SCY07 ตลาดวังน้อย", SCY10: "SCY10 สง่าศรีบุ๊ชเซ็นเตอร์" };
const CASH = "เงินสด";
const USED = "รถมือสอง";
const normKey = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const pad = (n) => String(n).padStart(2, "0");
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return `${TH_MONTHS[m - 1]} ${y + 543}`; };
const num = (v) => { const n = Number(String(v ?? "").replace(/,/g, "")); return isFinite(n) ? n : 0; };
const fmt = (v) => num(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (v) => { if (!v) return "-"; const s = String(v).slice(0, 10); const [y, m, d] = s.split("-"); return y && m && d ? `${d}/${m}/${Number(y) + 543}` : s; };
const shortFin = (name) => String(name || "").replace(/^บริษัท\s+/, "").replace(/\s*จำกัด\s*\(มหาชน\)\s*$/, "").replace(/\s*จำกัด\s*$/, "").trim();

/** ประเภทการขายของใบกำกับ: เงินสด / ชื่อบริษัทไฟแนนท์ / ไม่ทราบประเภท
 *  รถมือสอง (เลขถัง-เลขเครื่องตรงกับรถมือสองที่ขายแล้ว) ไม่แยกประเภท → นับเป็น "เงินสด" เหมือนรถใหม่ แล้วโชว์หมายเหตุในรายใบแทน (user 2026-11-04) */
function usedOf(r, usedMap) { return usedMap ? (usedMap.get(normKey(r.chassis_no)) || usedMap.get(normKey(r.engine_no))) : null; }
function saleTypeOf(r, usedMap) {
  if (usedOf(r, usedMap)) return CASH;
  const f = String(r.sale_finance_company || "").trim();
  if (!f) return r.sale_invoice_no ? CASH : "ไม่ทราบประเภท (ไม่พบใบขายในระบบ)";
  if (f === CASH || f === "none" || /เงินสด/.test(f)) return CASH;
  return f;
}
const isFinance = (t) => t !== CASH && t !== USED && !t.startsWith("ไม่ทราบ");

export default function SalesByTaxInvoicePage({ currentUser }) {
  const [month, setMonth] = useState(thisMonth());
  const [rows, setRows] = useState([]);
  const [usedMap, setUsedMap] = useState(new Map()); // normKey(เลขถัง/เลขเครื่อง) → แถวรถมือสองที่ขายแล้ว
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [detail, setDetail] = useState(null); // { A, B, T } → popup รายใบของประเภทที่กด (user 2026-11-04 เปลี่ยนจากกางในตาราง)
  const [affilFilter, setAffilFilter] = useState("ALL");
  const reqRef = useRef(0); // กันผลลัพธ์เดือนเก่าที่ตอบช้ามาทับเดือนที่เลือกล่าสุด

  async function load() {
    if (!month) return;
    const reqId = ++reqRef.current;
    setLoading(true); setMsg("");
    const [yy, mm] = month.split("-");
    const ym = `${Number(yy) + 543}${mm}`; // list_tax_invoices ใช้ปี พ.ศ.
    try {
      // รถมือสองที่ขายแล้วทั้งหมด (โหลดคู่กัน ถ้าพังให้รายงานยังใช้ได้)
      const usedP = fetch(USED_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_sales", date_from: "2026-01-01", date_to: "2099-12-31" }) })
        .then((r) => r.text()).then((t) => { let d = JSON.parse(t); if (!Array.isArray(d)) d = [d]; if (d[0] && d[0].listjson) d = JSON.parse(d[0].listjson); return d.filter((u) => u && u.status === "sold"); }).catch(() => []);
      const all = await Promise.all(COMPANIES.map(async (br) => {
        const res = await fetch(TAXINV_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_tax_invoices", branch: br, year_month: ym }) });
        const t = await res.text();
        let d = []; try { const j = JSON.parse(t); d = Array.isArray(j) ? j : (j?.rows || []); } catch { d = []; }
        return d.map((x) => ({ ...x, _company: br }));
      }));
      const usedRows = await usedP;
      if (reqId !== reqRef.current) return; // มีการเปลี่ยนเดือนระหว่างรอ → ทิ้งผลชุดนี้
      const um = new Map();
      usedRows.forEach((u) => { if (normKey(u.chassis_no)) um.set(normKey(u.chassis_no), u); if (normKey(u.engine_no)) um.set(normKey(u.engine_no), u); });
      setUsedMap(um);
      const merged = all.flat().filter((r) => String(r.invoice_year_month || "") === ym || String(r.invoice_date || "").slice(0, 7) === month);
      setRows(merged);
      if (!merged.length) setMsg("ไม่พบใบกำกับภาษีในเดือนนี้ (ตรวจว่า upload ไฟล์ภาษีขายของเดือนนี้แล้ว)");
    } catch (e) {
      if (reqId !== reqRef.current) return;
      setRows([]); setMsg("❌ โหลดไม่สำเร็จ: " + String(e.message || e).slice(0, 120));
    }
    if (reqId === reqRef.current) setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);

  // ===== จัดกลุ่ม สังกัด → ร้าน → ประเภท =====
  const data = useMemo(() => {
    const active = rows.filter((r) => showCancelled || r.status !== "cancelled");
    const tree = {}; // affilKey → { label, branches: { br → { types: { type → { rows, cnt, base, vat, total } } } } }
    const typeSet = new Set();
    for (const r of active) {
      const a = AFFIL[r._company] || { key: r._company, label: r._company, order: 9 };
      if (affilFilter !== "ALL" && a.key !== affilFilter) continue;
      const u = usedOf(r, usedMap);
      const br = String(r.branch_codes || (u && u.branch_code) || "").slice(0, 5) || "ไม่ระบุสาขา"; // รถมือสองไม่มีใบขาย NEW → ใช้สาขาจากเมนูรถมือสอง
      const type = saleTypeOf(r, usedMap);
      typeSet.add(type);
      const A = (tree[a.key] = tree[a.key] || { key: a.key, label: a.label, order: a.order, branches: {} });
      const B = (A.branches[br] = A.branches[br] || { br, types: {} });
      const T = (B.types[type] = B.types[type] || { type, rows: [], cnt: 0, base: 0, vat: 0, total: 0 });
      T.rows.push(r);
      const cancelled = r.status === "cancelled";
      if (!cancelled) { T.cnt += 1; T.base += num(r.amount_before_vat); T.vat += num(r.vat_amount); T.total += num(r.total_amount); }
    }
    const sum = (list) => list.reduce((s, x) => ({ cnt: s.cnt + x.cnt, base: s.base + x.base, vat: s.vat + x.vat, total: s.total + x.total }), { cnt: 0, base: 0, vat: 0, total: 0 });
    const typeOrder = (t) => (t === CASH ? "0" : isFinance(t) ? "1" + t : t === USED ? "2" : "9");
    const affils = Object.values(tree).sort((a, b) => a.order - b.order).map((A) => {
      const branches = Object.values(A.branches).sort((a, b) => a.br.localeCompare(b.br)).map((B) => {
        const types = Object.values(B.types).sort((a, b) => typeOrder(a.type).localeCompare(typeOrder(b.type), "th"));
        return { ...B, types, ...sum(types) };
      });
      // สรุปตามประเภทรวมทุกร้านในสังกัด (สำหรับบันทึก FlowAccount รายบริษัท)
      const byType = {};
      branches.forEach((B) => B.types.forEach((T) => { const x = (byType[T.type] = byType[T.type] || { type: T.type, cnt: 0, base: 0, vat: 0, total: 0 }); x.cnt += T.cnt; x.base += T.base; x.vat += T.vat; x.total += T.total; }));
      const typesAll = Object.values(byType).sort((a, b) => typeOrder(a.type).localeCompare(typeOrder(b.type), "th"));
      return { ...A, branches, typesAll, ...sum(branches) };
    });
    const grand = sum(affils);
    const cancelledCnt = rows.filter((r) => r.status === "cancelled").length;
    const types = [...typeSet].sort((a, b) => typeOrder(a).localeCompare(typeOrder(b), "th"));
    return { affils, grand, cancelledCnt, types };
  }, [rows, usedMap, showCancelled, affilFilter]);

  useEffect(() => { if (!detail) return; const onKey = (e) => { if (e.key === "Escape") setDetail(null); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [detail]);

  // ===== Export CSV (รายใบ) =====
  function exportCsv() {
    const head = ["สังกัด", "ร้าน", "ประเภทการขาย", "เลขที่ใบกำกับ", "วันที่ใบกำกับ", "ลูกค้า", "รุ่น", "เลขถัง", "ใบขาย", "ก่อน VAT", "VAT", "รวม", "สถานะ", "หมายเหตุ"];
    const lines = [head.join(",")];
    data.affils.forEach((A) => A.branches.forEach((B) => B.types.forEach((T) => T.rows.forEach((r) => {
      const u = usedOf(r, usedMap);
      lines.push([A.label, BR_LABEL[B.br] || B.br, T.type, r.tax_invoice_no, fmtDate(r.invoice_date), r.customer_name, r.model_name, r.chassis_no, r.sale_invoice_no || (u ? u.doc_no : ""), num(r.amount_before_vat).toFixed(2), num(r.vat_amount).toFixed(2), num(r.total_amount).toFixed(2), r.status === "cancelled" ? "ยกเลิก" : "ปกติ", u ? `รถมือสอง (${u.source_type || ""} ${u.doc_no})` : ""]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    }))));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `การขายตามใบกำกับ_${month}.csv`; a.click();
  }

  // ===== พิมพ์ (สรุปเท่านั้น) =====
  function printReport() {
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const row = (cls, name, x, indent = 0) => `<tr class="${cls}"><td style="padding-left:${8 + indent * 18}px">${esc(name)}</td><td class="r">${x.cnt}</td><td class="r">${fmt(x.base)}</td><td class="r">${fmt(x.vat)}</td><td class="r">${fmt(x.total)}</td></tr>`;
    let body = "";
    data.affils.forEach((A) => {
      body += row("aff", A.label, A);
      A.typesAll.forEach((T) => body += row("typeall", `รวม${isFinance(T.type) ? "ไฟแนนท์ " + shortFin(T.type) : T.type === USED ? "ขายรถมือสอง" : T.type}`, T, 1));
      A.branches.forEach((B) => {
        body += row("br", BR_LABEL[B.br] || B.br, B, 1);
        B.types.forEach((T) => body += row("ty", isFinance(T.type) ? "ไฟแนนท์ · " + shortFin(T.type) : T.type === USED ? "ขายรถมือสอง" : T.type, T, 2));
      });
    });
    body += row("grand", "รวมทั้งหมด", data.grand);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>การขายตามใบกำกับ ${esc(thMonth(month))}</title>
<style>body{font-family:Tahoma,sans-serif;font-size:12px;margin:14px}h2{margin:0 0 2px;font-size:16px}table{border-collapse:collapse;width:100%;margin-top:8px}th,td{border:1px solid #cbd5e1;padding:3px 6px}th{background:#e2e8f0}.r{text-align:right;white-space:nowrap}
tr.aff td{background:#dbeafe;font-weight:700}tr.typeall td{background:#eff6ff;color:#1e3a8a}tr.br td{background:#f1f5f9;font-weight:700}tr.grand td{background:#fef3c7;font-weight:700}@page{size:A4 portrait;margin:10mm}</style></head><body>
<h2>รายงานการขายตามวันที่ใบกำกับภาษี — ${esc(thMonth(month))}</h2><div style="color:#64748b">แยกสังกัด → ร้าน → ประเภทการขาย (เงินสด / ไฟแนนท์แยกบริษัท) · ไม่รวมใบยกเลิก · พิมพ์ ${new Date().toLocaleString("th-TH")}</div>
<table><thead><tr><th>รายการ</th><th class="r">จำนวนคัน</th><th class="r">มูลค่าก่อน VAT</th><th class="r">VAT</th><th class="r">รวมสุทธิ</th></tr></thead><tbody>${body}</tbody></table></body></html>`;
    const w = window.open("", "_blank"); if (!w) return; w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300);
  }

  // ===== UI =====
  const th = { padding: "8px 10px", background: "#0b2447", color: "#fff", fontSize: 13, whiteSpace: "nowrap" };
  const tdR = { padding: "6px 10px", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const TypeLabel = ({ t, full }) => isFinance(t)
    ? <><span style={{ background: "#dbeafe", color: "#1e40af", borderRadius: 6, padding: "1px 6px", fontSize: 11, marginRight: 6 }}>ไฟแนนท์</span>{full ? t : shortFin(t)}</>
    : t === CASH ? <><span style={{ background: "#dcfce7", color: "#166534", borderRadius: 6, padding: "1px 6px", fontSize: 11, marginRight: 6 }}>เงินสด</span>ขายเงินสด</>
    : t === USED ? <><span style={{ background: "#ffedd5", color: "#9a3412", borderRadius: 6, padding: "1px 6px", fontSize: 11, marginRight: 6 }}>มือสอง</span>ขายรถมือสอง</>
    : <span style={{ color: "#b45309" }}>⚠️ {t}</span>;
  const NumCells = ({ x, bold }) => (<>
    <td style={{ ...tdR, fontWeight: bold ? 700 : 400 }}>{x.cnt.toLocaleString("th-TH")}</td>
    <td style={{ ...tdR, fontWeight: bold ? 700 : 400 }}>{fmt(x.base)}</td>
    <td style={{ ...tdR, fontWeight: bold ? 700 : 400 }}>{fmt(x.vat)}</td>
    <td style={{ ...tdR, fontWeight: 700, color: "#0f766e" }}>{fmt(x.total)}</td>
  </>);
  const DetailTable = ({ list }) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
      <thead><tr style={{ color: "#475569", background: "#f8fafc", position: "sticky", top: 0 }}>
        {["#", "เลขที่ใบกำกับ", "วันที่", "ลูกค้า", "รุ่น", "เลขถัง", "ใบขาย", "ก่อน VAT", "VAT", "รวม", "หมายเหตุ"].map((h, i) => <th key={h} style={{ textAlign: i >= 7 && i <= 9 ? "right" : "left", padding: "6px 8px", borderBottom: "2px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}
      </tr></thead>
      <tbody>{list.map((r, i) => { const u = usedOf(r, usedMap); const cancelled = r.status === "cancelled"; return (
        <tr key={r.id || r.tax_invoice_no} style={{ borderBottom: "1px solid #f1f5f9", color: cancelled ? "#b91c1c" : "#0f172a", textDecoration: cancelled ? "line-through" : "none", background: i % 2 ? "#fcfcfd" : "#fff" }}>
          <td style={{ padding: "5px 8px", color: "#94a3b8" }}>{i + 1}</td>
          <td style={{ padding: "5px 8px", fontWeight: 700, whiteSpace: "nowrap" }}>{r.tax_invoice_no}</td>
          <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{fmtDate(r.invoice_date)}</td>
          <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{r.customer_name || r.sale_customer_name || "-"}</td>
          <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{r.model_name || "-"}</td>
          <td style={{ padding: "5px 8px", fontFamily: "monospace", whiteSpace: "nowrap" }}>{r.chassis_no || "-"}</td>
          <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{r.sale_invoice_no || (u && u.doc_no) || "-"}</td>
          <td style={{ ...tdR, padding: "5px 8px" }}>{fmt(r.amount_before_vat)}</td>
          <td style={{ ...tdR, padding: "5px 8px" }}>{fmt(r.vat_amount)}</td>
          <td style={{ ...tdR, padding: "5px 8px", fontWeight: 700 }}>{fmt(r.total_amount)}</td>
          <td style={{ padding: "5px 8px" }}>{u ? <span style={{ background: "#ffedd5", color: "#9a3412", borderRadius: 6, padding: "1px 6px", fontSize: 11, whiteSpace: "nowrap" }}>🏍️ รถมือสอง · {u.source_type || ""} {u.doc_no}</span> : cancelled ? <span style={{ fontSize: 11 }}>ยกเลิก</span> : ""}</td>
        </tr>); })}
      </tbody>
    </table>
  );

  return (
    <div style={{ padding: 20, fontFamily: "Tahoma, sans-serif" }}>
      <h2 style={{ marginTop: 0, color: "#0b2447" }}>🧾 รายงานการขายตามวันที่ใบกำกับภาษี <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 400 }}>— สำหรับบันทึก FlowAccount · แยกสังกัด → ร้าน → เงินสด / ไฟแนนท์ (แยกบริษัท)</span></h2>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <label style={{ fontWeight: 700 }}>เดือน (วันที่ใบกำกับ):</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6 }} />
        <select value={affilFilter} onChange={(e) => setAffilFilter(e.target.value)} style={{ padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6 }}>
          <option value="ALL">ทุกสังกัด</option>
          <option value="PAPAO">บจ. ป.เปา มอเตอร์เซอร์วิส</option>
          <option value="SINGCHAI">หจก. สิงห์ชัยสยามยนต์</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> แสดงใบยกเลิก ({data.cancelledCnt})
        </label>
        <button onClick={load} disabled={loading} style={{ padding: "7px 14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>{loading ? "กำลังโหลด…" : "🔄 รีเฟรช"}</button>
        <button onClick={exportCsv} disabled={!rows.length} style={{ padding: "7px 14px", background: "#15803d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>📥 Export CSV (รายใบ)</button>
        <button onClick={printReport} disabled={!rows.length} style={{ padding: "7px 14px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>🖨️ พิมพ์สรุป</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: "#334155" }}>
          {thMonth(month)} · <b>{data.grand.cnt}</b> คัน · ก่อน VAT <b>{fmt(data.grand.base)}</b> · VAT <b>{fmt(data.grand.vat)}</b> · รวม <b style={{ color: "#0f766e" }}>{fmt(data.grand.total)}</b>
        </div>
      </div>

      {msg && <div style={{ padding: 10, background: "#fef3c7", color: "#92400e", borderRadius: 8, marginBottom: 10 }}>{msg}</div>}

      {/* การ์ดสรุปรายสังกัด×ประเภท เอาออกตาม user 2026-11-04 (ยอดรวมต่อประเภททั้งสังกัดยังอยู่ในใบพิมพ์สรุป) */}
      {/* ตารางหลัก สังกัด → ร้าน → ประเภท (คลิกแถวประเภทเพื่อดูรายใบ) */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>สังกัด / ร้าน / ประเภทการขาย</th><th style={{ ...th, textAlign: "right" }}>จำนวนคัน</th><th style={{ ...th, textAlign: "right" }}>มูลค่าก่อน VAT</th><th style={{ ...th, textAlign: "right" }}>VAT</th><th style={{ ...th, textAlign: "right" }}>รวมสุทธิ</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>⏳ กำลังโหลด…</td></tr>}
            {!loading && !data.affils.length && <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>ไม่มีข้อมูล</td></tr>}
            {data.affils.map((A) => (
              <React.Fragment key={A.key}>
                <tr style={{ background: "#dbeafe" }}><td style={{ padding: "8px 10px", fontWeight: 700, color: "#0b2447", textAlign: "left" }}>🏢 {A.label}</td><NumCells x={A} bold /></tr>
                {A.branches.map((B) => (
                  <React.Fragment key={B.br}>
                    <tr style={{ background: "#f1f5f9" }}><td style={{ padding: "6px 10px 6px 32px", fontWeight: 700, textAlign: "left" }}>🏪 {BR_LABEL[B.br] || B.br}</td><NumCells x={B} bold /></tr>
                    {B.types.map((T) => {
                      const k = `${A.key}|${B.br}|${T.type}`;
                      return (
                        <React.Fragment key={k}>
                          <tr onClick={() => setDetail({ A, B, T })} style={{ cursor: "pointer", borderBottom: "1px solid #f1f5f9" }} title="คลิกเพื่อดูรายใบ"
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                            <td style={{ padding: "5px 10px 5px 56px", textAlign: "left" }}>
                              <TypeLabel t={T.type} full /> <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: 6 }}>🔍 ดูรายใบ</span>
                            </td>
                            <NumCells x={T} />
                          </tr>
                        </React.Fragment>);
                    })}
                  </React.Fragment>))}
              </React.Fragment>))}
            {data.affils.length > 0 && <tr style={{ background: "#fef3c7" }}><td style={{ padding: "8px 10px", fontWeight: 700, textAlign: "left" }}>รวมทั้งหมด</td><NumCells x={data.grand} bold /></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
        ที่มา: ไฟล์ภาษีขาย (ใบกำกับรถ) ของ ป.เปา / นครหลวง / สิงห์ชัย ที่ upload ในระบบ · ประเภทการขายและร้านมาจากใบขาย NEW ที่จับคู่กับใบกำกับ (เลขถัง) · เลขถัง/เลขเครื่องที่ตรงกับรถมือสองที่ขายแล้ว (เมนูรถมือสอง) = นับรวมในเงินสด (มีหมายเหตุ "รถมือสอง" ในรายใบ) · ใบที่ไม่พบทั้งสองทางขึ้น "ไม่ทราบประเภท" ให้ตรวจเอง · ยอดไม่รวมใบยกเลิก
      </div>

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "min(1400px, 100%)", maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.35)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #e5e7eb", background: "#0b2447", color: "#fff" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{detail.A.label} · {BR_LABEL[detail.B.br] || detail.B.br}</div>
                <div style={{ fontSize: 13, opacity: .9, marginTop: 2 }}>
                  {isFinance(detail.T.type) ? "ไฟแนนท์ · " + detail.T.type : detail.T.type === CASH ? "ขายเงินสด" : detail.T.type} · {thMonth(month)} · <b>{detail.T.cnt}</b> คัน · ก่อน VAT <b>{fmt(detail.T.base)}</b> · VAT <b>{fmt(detail.T.vat)}</b> · รวม <b>{fmt(detail.T.total)}</b>
                </div>
              </div>
              <button onClick={() => setDetail(null)} style={{ border: "none", background: "rgba(255,255,255,.15)", color: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>✕ ปิด</button>
            </div>
            <div style={{ overflow: "auto", padding: "0 8px 8px" }}>
              <DetailTable list={detail.T.rows} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
