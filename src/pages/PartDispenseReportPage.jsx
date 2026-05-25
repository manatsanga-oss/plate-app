import React, { useState, useEffect, useMemo } from "react";

const API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-dispense-report";

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

const BRANDS = [
  { key: "HONDA", label: "🔴 HONDA", color: "#dc2626" },
  { key: "YAMAHA", label: "🔵 YAMAHA", color: "#1e40af" },
];

export default function PartDispenseReportPage() {
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
        body: JSON.stringify({ brand, date_from: dateFrom, date_to: dateTo, search }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [brand]);

  const summary = useMemo(() => ({
    lines: rows.length,
    docs: new Set(rows.map(r => r.doc_no)).size,
    qty: rows.reduce((s, r) => s + (Number(r.qty) || 0), 0),
    amount: rows.reduce((s, r) => s + (Number(r.amount_total) || 0), 0),
    discount: rows.reduce((s, r) => s + (Number(r.discount) || 0), 0),
    net: rows.reduce((s, r) => s + (Number(r.amount_net) || 0), 0),
    cost: rows.reduce((s, r) => s + (Number(r.cost) || 0), 0),
    profit: rows.reduce((s, r) => s + (Number(r.profit) || 0), 0),
  }), [rows]);

  const color = BRANDS.find(b => b.key === brand)?.color || "#6b7280";

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📤 รายงานการจ่ายอะไหล่รายตัว</h2>
      </div>

      {/* Brand tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {BRANDS.map(b => (
          <button key={b.key} onClick={() => setBrand(b.key)}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
              background: brand === b.key ? b.color : "#e5e7eb",
              color: brand === b.key ? "#fff" : "#374151"
            }}>
            {b.label}
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
          onKeyDown={e => e.key === "Enter" && load()}
          placeholder="🔎 ค้นหา (เลขใบจ่าย / รหัสอะไหล่ / ชื่ออะไหล่ / ลูกค้า)"
          style={{ flex: 1, minWidth: 200, padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
        <button onClick={load} disabled={loading}
          style={{ padding: "8px 20px", background: loading ? "#9ca3af" : color, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
          {loading ? "⏳ โหลด..." : "🔍 ค้นหา"}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
        <KPI label="📋 ใบจ่าย" value={fmtInt(summary.docs)} unit="ใบ" color="#0369a1" />
        <KPI label="📦 รายการ" value={fmtInt(summary.lines)} unit="บรรทัด" color="#7c3aed" />
        <KPI label="🔢 จำนวน" value={fmt(summary.qty, 0)} unit="ชิ้น" color="#059669" />
        <KPI label="💰 ยอดขายรวม" value={fmt(summary.amount, 0)} unit="บาท" color="#374151" />
        <KPI label="🏷️ ส่วนลด" value={fmt(summary.discount, 0)} unit="บาท" color="#f59e0b" />
        <KPI label="💵 ยอดสุทธิ" value={fmt(summary.net, 0)} unit="บาท" color="#0891b2" />
        <KPI label="🏭 ต้นทุน" value={fmt(summary.cost, 0)} unit="บาท" color="#6b7280" />
        <KPI label="📈 กำไร" value={fmt(summary.profit, 0)} unit="บาท" color={summary.profit >= 0 ? "#059669" : "#dc2626"} />
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: `2px solid ${color}`, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: color, color: "#fff", fontWeight: 700, fontSize: 14 }}>
          {BRANDS.find(b => b.key === brand)?.label} — {rows.length} บรรทัด
        </div>
        <div style={{ overflowX: "auto", maxHeight: "65vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#f9fafb", position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={th}>#</th>
                <th style={th}>เลขใบจ่าย</th>
                <th style={th}>วันที่</th>
                <th style={th}>รหัสอะไหล่</th>
                <th style={th}>ชื่ออะไหล่</th>
                <th style={th}>ยี่ห้อ</th>
                <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
                <th style={{ ...th, textAlign: "right" }}>ราคารวม</th>
                <th style={{ ...th, textAlign: "right" }}>ส่วนลด</th>
                <th style={{ ...th, textAlign: "right" }}>สุทธิ</th>
                <th style={{ ...th, textAlign: "right" }}>ต้นทุน</th>
                <th style={{ ...th, textAlign: "right" }}>กำไร</th>
                <th style={th}>ลูกค้า/พนง.</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={13} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>
              ) : rows.map((r, i) => (
                <tr key={(r.doc_no || "") + "_" + (r.part_code || "") + "_" + i} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.doc_no}</td>
                  <td style={td}>{fmtDate(r.doc_date)}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.part_code}</td>
                  <td style={td}>{(r.part_name || "-").slice(0, 50)}</td>
                  <td style={td}>{r.brand || "-"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.qty, 0)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.amount_total)}</td>
                  <td style={{ ...td, textAlign: "right", color: "#f59e0b" }}>{fmt(r.discount)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#0891b2" }}>{fmt(r.amount_net)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.cost)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: Number(r.profit) >= 0 ? "#059669" : "#dc2626" }}>{fmt(r.profit)}</td>
                  <td style={{ ...td, fontSize: 11 }}>{(r.customer_name || "-").slice(0, 30)}</td>
                </tr>
              ))}
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
      <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#6b7280" }}>{unit}</div>
    </div>
  );
}

const th = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#374151", whiteSpace: "nowrap" };
const td = { padding: "6px 10px", fontSize: 12, verticalAlign: "middle" };
