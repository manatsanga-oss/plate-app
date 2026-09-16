import React, { useEffect, useMemo, useState } from "react";

// รายงานขายอะไหล่และบริการ (user 2026-09-16) — รายเอกสารจากไฟล์ที่ upload แยกสาขา แยก ขาย/บริการ
// HONDA: ใบแจ้งซ่อม (honda_repair_jobs) = บริการ · บิลจ่ายอะไหล่ที่ไม่ใช่ job (honda_part_sales) = ขาย
// YAMAHA: ใบแจ้งซ่อม (yamaha_repair_invoices รวมต่อ job) = บริการ · จ่ายเพื่อขาย/โปรฯ ขายปลีก (yamaha_part_dispense รวมต่อใบ) = ขาย
// backend: part-service-sales-api action list_docs {date_from, date_to} → {listjson}
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-service-sales-api";

const BRANCH_NAME = { SCY01: "สิงห์ชัย วังน้อย", SCY04: "สิงห์ชัย สาขา 4", SCY05: "ป.เปา นครหลวง", SCY06: "ป.เปา วังน้อย", SCY07: "สิงห์ชัย ตลาด", SCY10: "สิงห์ชัย สาขา 10" };
const branchLabel = (c) => (BRANCH_NAME[c] ? `${c} ${BRANCH_NAME[c]}` : c || "-");
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const baht = (n) => num(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thaiDate = (iso) => { if (!iso) return "-"; const s = String(iso).slice(0, 10); const [y, m, d] = s.split("-"); return y && m && d ? `${d}/${m}/${Number(y) + 543}` : s; };
const pad = (n) => String(n).padStart(2, "0");
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

async function post(body) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return {}; }
}
const unwrapList = (d) => { try { return typeof d?.listjson === "string" ? JSON.parse(d.listjson) : Array.isArray(d) ? d : []; } catch { return []; } };

export default function PartServiceSalesReportPage() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [fBranch, setFBranch] = useState("");
  const [fKind, setFKind] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true); setMessage("");
    try {
      const d = await post({ action: "list_docs", date_from: dateFrom, date_to: dateTo });
      if (d?.__error) throw new Error(d.__error);
      setRows(unwrapList(d).filter(r => r && r.doc_no));
    } catch (e) { setMessage("❌ โหลดไม่สำเร็จ (ยัง import workflow part-service-sales-api หรือยัง?) " + (e?.message || "")); setRows([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  const branches = useMemo(() => [...new Set(rows.map(r => r.branch).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => rows.filter(r => {
    if (fBranch && r.branch !== fBranch) return false;
    if (fKind && r.kind !== fKind) return false;
    if (fBrand && r.brand !== fBrand) return false;
    if (search.trim()) {
      const kw = search.trim().toLowerCase();
      if (![r.job_no, r.doc_no, r.customer_name, r.note].filter(Boolean).join(" ").toLowerCase().includes(kw)) return false;
    }
    return true;
  }), [rows, fBranch, fKind, fBrand, search]);

  // สรุปต่อสาขา × ประเภท
  const summary = useMemo(() => {
    const m = new Map();
    rows.filter(r => (!fBrand || r.brand === fBrand)).forEach(r => {
      const k = `${r.branch}|${r.kind}`;
      const s = m.get(k) || { branch: r.branch, kind: r.kind, brand: r.brand, count: 0, total: 0 };
      s.count += 1; s.total += num(r.total_amount); m.set(k, s);
    });
    return [...m.values()].sort((a, b) => a.branch.localeCompare(b.branch) || a.kind.localeCompare(b.kind, "th"));
  }, [rows, fBrand]);
  const grandTotal = filtered.reduce((s, r) => s + num(r.total_amount), 0);

  function exportCsv() {
    const head = ["วันที่", "ยี่ห้อ", "สาขา", "ประเภท", "เลขที่ JOB", "เลขที่ใบขาย", "ลูกค้า", "หมายเหตุ", "จำนวนเงินรวม"];
    const lines = filtered.map(r => [thaiDate(r.doc_date), r.brand, branchLabel(r.branch), r.kind, r.job_no || "", r.doc_no || "", r.customer_name || "", r.note || "", num(r.total_amount).toFixed(2)]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = "﻿" + [head.join(","), ...lines].join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `รายงานขายอะไหล่และบริการ_${dateFrom}_${dateTo}.csv`; a.click();
  }
  function printReport() {
    const w = window.open("", "_blank", "width=1100,height=800");
    const esc = (v) => String(v == null ? "" : v).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const trs = filtered.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${thaiDate(r.doc_date)}</td><td>${esc(r.brand)}</td><td>${esc(branchLabel(r.branch))}</td><td>${esc(r.kind)}</td><td>${esc(r.job_no || "-")}</td><td>${esc(r.doc_no || "-")}</td><td>${esc(r.customer_name || "")}</td><td class="r">${baht(r.total_amount)}</td></tr>`).join("");
    const sums = summary.map(s => `<tr><td>${esc(branchLabel(s.branch))}</td><td>${esc(s.kind)}</td><td class="r">${s.count}</td><td class="r">${baht(s.total)}</td></tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายงานขายอะไหล่และบริการ</title>
<style>body{font-family:Tahoma,sans-serif;font-size:11px;padding:14px}h2{margin:0 0 4px;font-size:15px}.info{color:#555;margin-bottom:8px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1px solid #ccc;padding:3px 5px}th{background:#072d6b;color:#fff}.r{text-align:right}.c{text-align:center}tfoot td{font-weight:700;background:#f1f5f9}</style></head><body>
<h2>รายงานขายอะไหล่และบริการ</h2><div class="info">ช่วงวันที่ ${thaiDate(dateFrom)} – ${thaiDate(dateTo)}${fBranch ? " · สาขา " + esc(branchLabel(fBranch)) : ""}${fKind ? " · " + esc(fKind) : ""}${fBrand ? " · " + esc(fBrand) : ""} · ${filtered.length} ใบ</div>
<table><thead><tr><th>สาขา</th><th>ประเภท</th><th class="r">จำนวนใบ</th><th class="r">รวม (บาท)</th></tr></thead><tbody>${sums}</tbody></table>
<table><thead><tr><th>#</th><th>วันที่</th><th>ยี่ห้อ</th><th>สาขา</th><th>ประเภท</th><th>เลขที่ JOB</th><th>เลขที่ใบขาย</th><th>ลูกค้า</th><th class="r">จำนวนเงินรวม</th></tr></thead><tbody>${trs}</tbody>
<tfoot><tr><td colspan="8" class="r">รวมทั้งสิ้น</td><td class="r">${baht(grandTotal)}</td></tr></tfoot></table>
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  const inp = { padding: "7px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 13.5, background: "#fff" };
  const th = { padding: "8px 6px", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff", position: "sticky", top: 0 };
  const td = { padding: "7px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
  const tag = (t, bg, fg) => <span style={{ padding: "1px 8px", borderRadius: 10, fontSize: 11, background: bg, color: fg, whiteSpace: "nowrap", fontWeight: 700 }}>{t}</span>;
  const kindTag = (k) => k === "บริการ" ? tag("บริการ", "#dcfce7", "#15803d") : tag("ขาย", "#fef3c7", "#92400e");
  const brandTag = (b) => tag(b, b === "YAMAHA" ? "#dbeafe" : "#fee2e2", b === "YAMAHA" ? "#1e40af" : "#991b1b");

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1300 }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>🧾 รายงานขายอะไหล่และบริการ</h2>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
        รายเอกสารจากไฟล์ที่ upload — <b>บริการ</b> = ใบแจ้งซ่อม (ทั้ง job รวมค่าแรง+อะไหล่) · <b>ขาย</b> = บิลขายอะไหล่หน้าร้าน (ไม่รวมอะไหล่ที่จ่ายเข้างานซ่อม กันนับซ้ำ) · ยอดรวม VAT
      </div>
      {message && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, fontSize: 14, background: "#fef2f2", border: "1px solid #fecaca" }}>{message}</div>}

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <button onClick={load} disabled={loading} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer" }}>{loading ? "⏳ กำลังโหลด..." : "🔍 แสดง"}</button>
        <select value={fBranch} onChange={e => setFBranch(e.target.value)} style={inp}>
          <option value="">สาขา: ทั้งหมด</option>
          {branches.map(b => <option key={b} value={b}>{branchLabel(b)}</option>)}
        </select>
        <select value={fKind} onChange={e => setFKind(e.target.value)} style={inp}>
          <option value="">ประเภท: ทั้งหมด</option><option value="ขาย">ขาย</option><option value="บริการ">บริการ</option>
        </select>
        <select value={fBrand} onChange={e => setFBrand(e.target.value)} style={inp}>
          <option value="">ยี่ห้อ: ทั้งหมด</option><option value="HONDA">HONDA</option><option value="YAMAHA">YAMAHA</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา เลข JOB / ใบขาย / ลูกค้า" style={{ ...inp, width: 220 }} />
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={exportCsv} disabled={!filtered.length} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontFamily: "Tahoma" }}>⬇ Excel/CSV</button>
          <button onClick={printReport} disabled={!filtered.length} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#6b7280", color: "#fff", cursor: "pointer", fontFamily: "Tahoma" }}>🖨️ พิมพ์</button>
        </span>
      </div>

      {/* สรุปต่อสาขา × ประเภท */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10, marginBottom: 12 }}>
        {summary.map(s => (
          <div key={s.branch + s.kind} onClick={() => { setFBranch(s.branch); setFKind(s.kind); }} title="คลิกเพื่อกรอง"
            style={{ background: "#fff", border: `1px solid ${fBranch === s.branch && fKind === s.kind ? "#1e3a8a" : "#e5e7eb"}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
            <div style={{ fontSize: 12, color: "#64748b", display: "flex", justifyContent: "space-between" }}><span>{branchLabel(s.branch)}</span>{brandTag(s.brand)}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
              <span>{kindTag(s.kind)} <span style={{ fontSize: 12, color: "#94a3b8" }}>{s.count} ใบ</span></span>
              <b style={{ fontSize: 17, color: "#072d6b" }}>{baht(s.total)}</b>
            </div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", maxHeight: "62vh", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>#</th><th style={th}>วันที่</th><th style={th}>ยี่ห้อ</th><th style={th}>สาขา</th><th style={th}>ประเภท</th>
            <th style={th}>เลขที่ JOB</th><th style={th}>เลขที่ใบขาย</th><th style={th}>ลูกค้า / หมายเหตุ</th><th style={{ ...th, textAlign: "right" }}>จำนวนเงินรวม</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ ...td, textAlign: "center", padding: 24, color: "#6b7280" }}>กำลังโหลด...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={9} style={{ ...td, textAlign: "center", padding: 24, color: "#9ca3af" }}>— ไม่มีรายการในช่วงวันที่/ตัวกรองนี้ —</td></tr>}
            {filtered.map((r, i) => (
              <tr key={`${r.brand}|${r.branch}|${r.kind}|${r.doc_no}|${i}`} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
                <td style={{ ...td, color: "#94a3b8" }}>{i + 1}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(r.doc_date)}</td>
                <td style={td}>{brandTag(r.brand)}</td>
                <td style={{ ...td, fontSize: 12 }}>{branchLabel(r.branch)}</td>
                <td style={td}>{kindTag(r.kind)}</td>
                <td style={{ ...td, fontFamily: "monospace" }}>{r.job_no || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#072d6b" }}>{r.doc_no}</td>
                <td style={{ ...td, fontSize: 12, color: "#475569" }}>{r.customer_name || ""}{r.note ? <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.note}</div> : null}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{baht(r.total_amount)}</td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot><tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
              <td colSpan={8} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} ใบ</td>
              <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#072d6b", fontSize: 15 }}>{baht(grandTotal)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
