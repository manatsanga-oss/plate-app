import React, { useState, useEffect, useMemo } from "react";

const API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-receipt-report";

function fmt(v, d = 2) { const n = Number(v) || 0; return n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtInt(v) { return (Number(v) || 0).toLocaleString("th-TH"); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function PartReceiptReportPage() {
  const [brand, setBrand] = useState("HONDA");
  const [dateFrom, setDateFrom] = useState(firstOfMonthISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [brand]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(r => {
      const blob = [r.doc_no, r.vendor_name, r.tax_invoice_no].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(s);
    });
  }, [rows, search]);

  const summary = useMemo(() => {
    const creditNotes = filtered.filter(r => r.doc_type === "credit_note");
    return {
      docs: filtered.length,
      items: filtered.reduce((s, r) => s + (Number(r.items_count) || 0), 0),
      qty: filtered.reduce((s, r) => s + (Number(r.total_qty) || 0), 0),
      cost: filtered.reduce((s, r) => s + (Number(r.total_cost) || 0), 0),
      vat: filtered.reduce((s, r) => s + (Number(r.vat_amount) || 0), 0),
      total: filtered.reduce((s, r) => s + (Number(r.total_incl_vat) || 0), 0),
      credit_count: creditNotes.length,
      credit_total: creditNotes.reduce((s, r) => s + (Number(r.total_incl_vat) || 0), 0),
    };
  }, [filtered]);

  const color = brand === "HONDA" ? "#dc2626" : "#1e40af";
  const isHonda = brand === "HONDA";

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📦 รายงานรับอะไหล่</h2>
      </div>

      {/* Brand tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["HONDA", "YAMAHA"].map(b => (
          <button key={b} onClick={() => setBrand(b)}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
              background: brand === b ? (b === "HONDA" ? "#dc2626" : "#1e40af") : "#e5e7eb",
              color: brand === b ? "#fff" : "#374151" }}>
            {b === "HONDA" ? "🔴 HONDA" : "🔵 YAMAHA"}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontWeight: 600 }}>📅 ช่วงเวลา:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 ค้นหา (เลขที่ใบรับ / ผู้ขาย / ใบกำกับ)"
          style={{ flex: 1, minWidth: 200, padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
        <button onClick={load} disabled={loading}
          style={{ padding: "8px 20px", background: loading ? "#9ca3af" : color, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
          {loading ? "⏳ โหลด..." : "🔍 ค้นหา"}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        <KPI label={isHonda ? "📋 ใบกำกับ" : "📋 ใบรับ"} value={fmtInt(summary.docs)} unit="ใบ" color="#0369a1" />
        {!isHonda && <KPI label="📦 รายการ" value={fmtInt(summary.items)} unit="รายการ" color="#7c3aed" />}
        {!isHonda && <KPI label="🔢 จำนวน" value={fmt(summary.qty, 0)} unit="ชิ้น" color="#059669" />}
        <KPI label="💰 มูลค่าก่อน VAT" value={fmt(summary.cost, 0)} unit="บาท" color="#374151" />
        <KPI label="📑 VAT" value={fmt(summary.vat, 0)} unit="บาท" color="#d97706" />
        <KPI label="✅ รวม" value={fmt(summary.total, 0)} unit="บาท" color={color} />
        {isHonda && (
          <KPI label="📄 ใบลดหนี้" value={fmtInt(summary.credit_count)} unit={`ใบ (${fmt(summary.credit_total, 0)} บาท)`} color="#dc2626" />
        )}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: `2px solid ${color}`, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: color, color: "#fff", fontWeight: 700, fontSize: 14 }}>
          {isHonda ? "🔴 HONDA" : "🔵 YAMAHA"} — {filtered.length} {isHonda ? "ใบกำกับ" : "ใบรับ"}
        </div>
        <div style={{ overflowX: "auto", maxHeight: "65vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#f9fafb", position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={th}>#</th>
                <th style={th}>{isHonda ? "เลขที่ใบกำกับ" : "เลขที่ใบรับ"}</th>
                <th style={th}>วันที่</th>
                <th style={th}>วันที่ใบกำกับ</th>
                {!isHonda && <th style={th}>เลขที่ใบกำกับ</th>}
                <th style={th}>ผู้ขาย</th>
                {!isHonda && <th style={{ ...th, textAlign: "right" }}>รายการ</th>}
                {!isHonda && <th style={{ ...th, textAlign: "right" }}>จำนวน</th>}
                <th style={{ ...th, textAlign: "right" }}>มูลค่า</th>
                <th style={{ ...th, textAlign: "right" }}>VAT</th>
                <th style={{ ...th, textAlign: "right" }}>รวม</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isHonda ? 8 : 11} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={isHonda ? 8 : 11} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>
              ) : filtered.map((r, i) => {
                const isCN = r.doc_type === "credit_note";
                return (
                <tr key={r.doc_no + "_" + i} style={{ borderTop: "1px solid #f3f4f6", background: isCN ? "#fef2f2" : "transparent" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: isCN ? "#dc2626" : "#0369a1" }}>
                    {isCN && <span style={{ marginRight: 4, fontSize: 10, padding: "1px 5px", background: "#dc2626", color: "#fff", borderRadius: 4 }}>ลดหนี้</span>}
                    {r.doc_no}
                  </td>
                  <td style={td}>{fmtDate(r.doc_date)}</td>
                  <td style={td}>{fmtDate(r.tax_invoice_date)}</td>
                  {!isHonda && <td style={{ ...td, fontFamily: "monospace" }}>{r.tax_invoice_no || "-"}</td>}
                  <td style={td}>{(r.vendor_name || "-").slice(0, 50)}</td>
                  {!isHonda && <td style={{ ...td, textAlign: "right" }}>{fmtInt(r.items_count)}</td>}
                  {!isHonda && <td style={{ ...td, textAlign: "right" }}>{fmt(r.total_qty, 0)}</td>}
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.total_cost)}</td>
                  <td style={{ ...td, textAlign: "right", color: "#d97706" }}>{fmt(r.vat_amount)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: isCN ? "#dc2626" : "#059669" }}>{fmt(r.total_incl_vat)}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, unit, color }) {
  return (
    <div style={{ padding: 10, background: "#fff", borderRadius: 10, border: `2px solid ${color}`, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#6b7280" }}>{unit}</div>
    </div>
  );
}

const th = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#374151", whiteSpace: "nowrap" };
const td = { padding: "6px 10px", fontSize: 12, verticalAlign: "middle" };
