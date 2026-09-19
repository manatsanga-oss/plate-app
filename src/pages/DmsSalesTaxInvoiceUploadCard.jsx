import React, { useEffect, useState } from "react";

// Upload "รายงานใบกำกับภาษีขาย" ของ DMS ยามาฮ่า (xlsx ทุกสาขา) → dms_sales_tax_invoices (user 2026-09-18)
// เป็นแหล่งจริงของภาษีขาย อะไหล่/บริการ สิงห์ชัย — อ้างอิงเลขที่ใบกำกับ (SP/SV) วันที่ใบกำกับ และเดือนที่ยื่น (= เดือนของวันที่ใบกำกับ)
// ไฟล์มีคอลัมน์ วัน/เดือน/ปี แยกกัน · BRANCH_CODE 00000 = SCY01 · parse ฝั่ง client (SheetJS) → webhook dms-sales-tax-invoice-api (UPSERT เลขที่ใบกำกับ)
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/dms-sales-tax-invoice-api";

const txt = (v) => String(v == null ? "" : v).trim();
const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/,/g, "").trim()); return Number.isFinite(n) ? n : 0; };
const pad = (n) => String(n).padStart(2, "0");
const fmt = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ymd = (d, m, y) => { const dd = parseInt(d, 10), mm = parseInt(m, 10); let yy = parseInt(y, 10); if (!dd || !mm || !yy) return null; if (yy > 2400) yy -= 543; return `${yy}-${pad(mm)}-${pad(dd)}`; };
const periodLabel = (p) => { const s = txt(p); return s.length === 6 ? `${s.slice(4)}/${Number(s.slice(0, 4)) + 543}` : s; };
const fmtTs = (v) => { if (!v) return "—"; const d = new Date(v); return isNaN(d) ? String(v) : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// เลขใบกำกับ "SCY01-SV260900139" → SV · "MC016908/0141" → MC
const prefixOf = (no) => { const s = txt(no).toUpperCase(); const tail = s.includes("-") ? s.split("-").pop() : s; const m = tail.match(/^[A-Z]+/); return m ? m[0].slice(0, 2) : ""; };

async function parseFile(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
  const hi = grid.findIndex((r) => (r || []).some((c) => txt(c) === "เลขที่ใบกำกับภาษี"));
  if (hi < 0) throw new Error('ไม่พบหัวคอลัมน์ "เลขที่ใบกำกับภาษี" — ตรวจว่าเป็นไฟล์ รายงานใบกำกับภาษีขาย ของ DMS');
  const H = grid[hi].map(txt); const col = (r, name) => r[H.indexOf(name)];
  const out = [];
  for (let i = hi + 1; i < grid.length; i++) {
    const r = grid[i] || []; const no = txt(col(r, "เลขที่ใบกำกับภาษี")); if (!no) continue;
    const date = ymd(col(r, "วันที่ใบกำกับภาษี"), col(r, "เดือนใบกำกับภาษี"), col(r, "ปีใบกำกับภาษี"));
    const br = txt(col(r, "BRANCH_CODE"));
    out.push({
      tax_invoice_no: no, doc_prefix: prefixOf(no), branch_code: br === "00000" || br === "0" ? "SCY01" : br, branch_name: txt(col(r, "BRANCH_NAME")),
      doc_kind: txt(col(r, "ประเภทเอกสาร")), product_kind: txt(col(r, "ประเภทสินค้า")),
      tax_invoice_date: date, tax_period: date ? date.slice(0, 4) + date.slice(5, 7) : "", status: txt(col(r, "สถานะใบกำกับภาษี")) || "ปกติ",
      customer_name: txt(col(r, "ชื่อในใบกำกับภาษี")), customer_address: txt(col(r, "ที่อยู่ในใบกำกับภาษี")), customer_tax_id: txt(col(r, "เลขผู้เสียภาษี")), customer_branch: txt(col(r, "สาขา")),
      vat_rate: num(col(r, "อัตราภาษี")), amount_before_vat: num(col(r, "มูลค่าก่อนภาษี")), vat_amount: num(col(r, "ภาษีมูลค่าเพิ่ม")), total_amount: num(col(r, "รวมทั้งสิ้น")),
      ref_doc_no: txt(col(r, "เอกสารอ้างอิง")), ref_doc_date: ymd(col(r, "วันที่เอกสารอ้างอิง"), col(r, "เดือนเอกสารอ้างอิง"), col(r, "ปีเอกสารอ้างอิง")),
      ref_doc_type: txt(col(r, "ประเภทเอกสารอ้างอิง")), ref_doc_status: txt(col(r, "สถานะเอกสารอ้างอิง")),
    });
  }
  if (!out.length) throw new Error("ไม่พบใบกำกับในไฟล์");
  const noDate = out.filter((x) => !x.tax_invoice_date).length;
  if (noDate) throw new Error(`มี ${noDate} ใบที่อ่านวันที่ใบกำกับไม่ได้ — ไม่ upload เพื่อกันเดือนที่ยื่นผิด`);
  return out;
}
const isPS = (x) => x.status === "ปกติ" && (x.doc_prefix === "SP" || x.doc_prefix === "SV") && x.branch_code !== "SCY05" && x.branch_code !== "SCY06";

export default function DmsSalesTaxInvoiceUploadCard({ currentUser }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [last, setLast] = useState(null);

  async function loadLast() {
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "last_upload" }) });
      const t = (await res.text()).trim(); const d = t ? JSON.parse(t) : null; const row = Array.isArray(d) ? d[0] : d;
      if (row) setLast({ ...row, periods: typeof row.periods === "string" ? JSON.parse(row.periods) : (row.periods || []) });
    } catch { /* ยังไม่ import workflow */ }
  }
  useEffect(() => { loadLast(); }, []);

  async function handleParse(f) {
    setMsg(""); setRows([]); if (!f) return;
    setBusy(true);
    try { setRows(await parseFile(f)); } catch (e) { setMsg("❌ อ่านไฟล์ไม่สำเร็จ: " + e.message); }
    setBusy(false);
  }
  async function handleUpload() {
    if (!rows.length) return;
    setBusy(true); setMsg("");
    try {
      // ส่งเป็นก้อนละ 400 ใบ กัน payload ใหญ่เกิน
      let total = 0;
      for (let i = 0; i < rows.length; i += 400) {
        const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upload", rows: rows.slice(i, i + 400), source_file: file?.name || "", uploaded_by: currentUser?.name || currentUser?.username || "" }) });
        const t = (await res.text()).trim(); let d = null; try { d = JSON.parse(t); } catch { /* ว่าง */ }
        const row0 = Array.isArray(d) ? d[0] : d;
        if (!(row0 && row0.result === "ok")) throw new Error(row0?.error || t || "ไม่มีการตอบกลับจาก n8n (ตรวจว่า import workflow dms-sales-tax-invoice-api และ Active แล้ว)");
        total += Number(row0.total || 0);
      }
      setMsg(`✅ นำเข้าสำเร็จ ${total} ใบ`); setRows([]); setFile(null); loadLast();
    } catch (e) { setMsg("❌ นำเข้าไม่สำเร็จ: " + e.message); }
    setBusy(false);
  }

  // สรุปไฟล์ที่อ่านได้ แยกเดือนที่ยื่น
  const byPeriod = {};
  rows.forEach((x) => { const g = byPeriod[x.tax_period] || (byPeriod[x.tax_period] = { docs: 0, cancelled: 0, ps: 0, base: 0, vat: 0 }); g.docs += 1; if (x.status !== "ปกติ") g.cancelled += 1; if (isPS(x)) { g.ps += 1; g.base += x.amount_before_vat; g.vat += x.vat_amount; } });
  const th = { padding: "5px 8px", fontSize: 12, textAlign: "right", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" };
  const td = { padding: "5px 8px", fontSize: 12.5, textAlign: "right", borderBottom: "1px solid #f1f5f9", fontFamily: "monospace" };

  return (
    <div style={{ border: "2px solid #7c3aed", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#7c3aed", marginBottom: 4 }}>🟣 รายงานใบกำกับภาษีขาย — ระบบ DMS (YAMAHA สิงห์ชัย)</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
        ไฟล์ XLSX "รายงานใบกำกับภาษีขาย" ทุกสาขา (เลือกช่วงวันที่ทั้งเดือน) — ใช้เป็นยอด<b>ภาษีขาย อะไหล่/บริการ สิงห์ชัย</b> ตามเลขที่ใบกำกับ (SP/SV) วันที่ใบกำกับ และเดือนที่ยื่น · ใบยกเลิกไม่นับ · ไม่รวม SCY05/SCY06 · UPSERT เลขที่ใบกำกับ (upload ซ้ำได้)
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>📦 Table: <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4, color: "#7c3aed" }}>dms_sales_tax_invoices</code> · 🕒 ล่าสุด: <span style={{ color: last?.last_uploaded ? "#059669" : "#9ca3af" }}>{fmtTs(last?.last_uploaded)}</span>{last?.total != null ? <span> · {Number(last.total).toLocaleString("th-TH")} ใบในระบบ</span> : null}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="file" accept=".xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0] || null; setFile(f); handleParse(f); }} style={{ fontSize: 13 }} />
        <button onClick={handleUpload} disabled={busy || rows.length === 0}
          style={{ padding: "9px 22px", background: rows.length ? "#072d6b" : "#9ca3af", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: rows.length ? "pointer" : "not-allowed" }}>
          {busy ? "กำลังทำงาน..." : "💾 Upload รายการ"}
        </button>
      </div>
      {msg && <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13, background: msg.startsWith("✅") ? "#dcfce7" : "#fee2e2", color: msg.startsWith("✅") ? "#065f46" : "#991b1b" }}>{msg}</div>}
      {rows.length > 0 && (
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <div style={{ fontSize: 12.5, marginBottom: 4 }}>อ่านได้ <b>{rows.length}</b> ใบ — สรุปตามเดือนที่ยื่น (กด Upload เพื่อนำเข้า)</div>
          <table style={{ borderCollapse: "collapse", minWidth: 520 }}>
            <thead><tr><th style={{ ...th, textAlign: "left" }}>เดือนที่ยื่น</th><th style={th}>ใบทั้งหมด</th><th style={th}>ยกเลิก</th><th style={th}>อะไหล่+บริการ (SP/SV)</th><th style={th}>มูลค่า</th><th style={th}>VAT</th></tr></thead>
            <tbody>{Object.keys(byPeriod).sort().map((p) => (<tr key={p}><td style={{ ...td, textAlign: "left", fontFamily: "Tahoma" }}>{periodLabel(p)}</td><td style={td}>{byPeriod[p].docs}</td><td style={td}>{byPeriod[p].cancelled}</td><td style={td}>{byPeriod[p].ps}</td><td style={td}>{fmt(byPeriod[p].base)}</td><td style={td}>{fmt(byPeriod[p].vat)}</td></tr>))}</tbody>
          </table>
        </div>
      )}
      {rows.length === 0 && (last?.periods || []).length > 0 && (
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>ข้อมูลในระบบ (อะไหล่+บริการ สิงห์ชัย ตามเดือนที่ยื่น){last?.date_max ? ` · ใบกำกับล่าสุด ${String(last.date_max).slice(0, 10).split("-").reverse().join("/")}` : ""}</div>
          <table style={{ borderCollapse: "collapse", minWidth: 460 }}>
            <thead><tr><th style={{ ...th, textAlign: "left" }}>เดือนที่ยื่น</th><th style={th}>ใบทั้งหมด</th><th style={th}>SP/SV ปกติ</th><th style={th}>มูลค่า</th><th style={th}>VAT</th></tr></thead>
            <tbody>{last.periods.map((g) => (<tr key={g.tax_period}><td style={{ ...td, textAlign: "left", fontFamily: "Tahoma" }}>{periodLabel(g.tax_period)}</td><td style={td}>{g.docs}</td><td style={td}>{g.part_service_docs}</td><td style={td}>{fmt(g.part_service_base)}</td><td style={td}>{fmt(g.part_service_vat)}</td></tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
