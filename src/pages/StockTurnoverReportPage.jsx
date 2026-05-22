import React, { useState, useEffect, useMemo } from "react";

const API = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-turnover-api";

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

async function callApi(body) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json().catch(() => null);
}

export default function StockTurnoverReportPage() {
  const [tab, setTab] = useState("stock");        // stock | turnover
  const [brand, setBrand] = useState("HONDA");

  // Stock tab
  const [asOf, setAsOf] = useState(todayISO());
  const [stockRows, setStockRows] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);

  // Turnover tab
  const [dateFrom, setDateFrom] = useState(firstOfMonthISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [turnoverData, setTurnoverData] = useState({ summary: null, byModel: [] });
  const [turnLoading, setTurnLoading] = useState(false);

  async function loadStock() {
    setStockLoading(true);
    const data = await callApi({ action: "stock_on_hand", brand, as_of: asOf });
    setStockRows(Array.isArray(data) ? data : []);
    setStockLoading(false);
  }
  async function loadTurnover() {
    setTurnLoading(true);
    const data = await callApi({ action: "turnover", brand, date_from: dateFrom, date_to: dateTo });
    if (Array.isArray(data)) {
      const summary = data.find(r => r.kind === "summary")?.data || null;
      const byModel = data.filter(r => r.kind === "by_model").map(r => r.data);
      setTurnoverData({ summary, byModel });
    } else setTurnoverData({ summary: null, byModel: [] });
    setTurnLoading(false);
  }
  useEffect(() => { if (tab === "stock") loadStock(); else loadTurnover(); /* eslint-disable-next-line */ }, [tab, brand]);

  const stockSummary = useMemo(() => {
    const total = stockRows.length;
    const cost = stockRows.reduce((s, r) => s + (Number(r.unit_cost) || 0), 0);
    const byModel = {};
    for (const r of stockRows) {
      const key = r.model || "-";
      if (!byModel[key]) byModel[key] = { qty: 0, cost: 0 };
      byModel[key].qty++;
      byModel[key].cost += Number(r.unit_cost) || 0;
    }
    return { total, cost, byModel: Object.entries(byModel).sort((a, b) => b[1].qty - a[1].qty) };
  }, [stockRows]);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📊 รายงานสินค้าคงเหลือ & อัตราการหมุน</h2>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", marginBottom: 16 }}>
        {[{ k: "stock", l: "📦 สินค้าคงเหลือ ณ วันที่" }, { k: "turnover", l: "🔄 อัตราการหมุน (Turnover)" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding: "10px 22px", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
              background: tab === t.k ? "#072d6b" : "transparent", color: tab === t.k ? "#fff" : "#374151",
              borderRadius: "8px 8px 0 0" }}>{t.l}</button>
        ))}
      </div>

      {/* Brand selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["HONDA", "YAMAHA"].map(b => (
          <button key={b} onClick={() => setBrand(b)}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
              background: brand === b ? (b === "HONDA" ? "#dc2626" : "#1e40af") : "#e5e7eb",
              color: brand === b ? "#fff" : "#374151" }}>
            {b === "HONDA" ? "🔴 HONDA (ป.เปา)" : "🔵 YAMAHA (สิงห์ชัย)"}
          </button>
        ))}
      </div>

      {tab === "stock" ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontWeight: 600 }}>📅 ดูสินค้าคงเหลือ ณ วันที่:</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
              style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
            <button onClick={loadStock} disabled={stockLoading}
              style={{ padding: "8px 20px", background: stockLoading ? "#9ca3af" : (brand === "HONDA" ? "#dc2626" : "#1e40af"), color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
              {stockLoading ? "⏳ โหลด..." : "🔍 ค้นหา"}
            </button>
            <span style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>
              จำนวน: <strong style={{ color: "#072d6b", fontSize: 18 }}>{fmtInt(stockSummary.total)}</strong> คัน ·
              ต้นทุนรวม: <strong style={{ color: "#059669", fontSize: 16 }}>{fmt(stockSummary.cost)}</strong> บาท
            </span>
          </div>

          {/* Summary by model */}
          {stockSummary.byModel.length > 0 && (
            <div style={{ marginBottom: 14, padding: 12, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: "#374151" }}>📊 สรุปตามรุ่น (Top 10)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                {stockSummary.byModel.slice(0, 10).map(([model, info]) => (
                  <div key={model} style={{ padding: 10, background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#072d6b" }}>{model}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{fmtInt(info.qty)} คัน · {fmt(info.cost, 0)} บาท</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ overflowX: "auto", maxHeight: "65vh" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f3f4f6", position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>วันที่รับ</th>
                    <th style={th}>{brand === "HONDA" ? "หมายเลขเครื่อง" : "เลขถัง"}</th>
                    <th style={th}>รุ่น</th>
                    <th style={th}>สี</th>
                    <th style={{ ...th, textAlign: "right" }}>ราคาทุน</th>
                    <th style={{ ...th, textAlign: "right" }}>อายุ (วัน)</th>
                  </tr>
                </thead>
                <tbody>
                  {stockLoading ? (
                    <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
                  ) : stockRows.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีสินค้าคงเหลือ</td></tr>
                  ) : stockRows.map((r, i) => (
                    <tr key={r.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>{fmtDate(r.received_date)}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{brand === "HONDA" ? r.engine_no : r.chassis_no}</td>
                      <td style={td}>{r.model}</td>
                      <td style={td}>{r.color}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt(r.unit_cost)}</td>
                      <td style={{ ...td, textAlign: "right", color: r.age_days > 90 ? "#dc2626" : r.age_days > 60 ? "#d97706" : "#374151", fontWeight: r.age_days > 60 ? 700 : 400 }}>{r.age_days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        // Turnover tab
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontWeight: 600 }}>📅 ช่วงเวลา:</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
            <span>ถึง</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
            <button onClick={loadTurnover} disabled={turnLoading}
              style={{ padding: "8px 20px", background: turnLoading ? "#9ca3af" : (brand === "HONDA" ? "#dc2626" : "#1e40af"), color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
              {turnLoading ? "⏳ โหลด..." : "🔍 ค้นหา"}
            </button>
          </div>

          {/* KPI cards */}
          {turnoverData.summary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 14 }}>
              <KPI label="📦 ขายในช่วง" value={fmtInt(turnoverData.summary.sold_qty)} unit="คัน" color="#059669" />
              <KPI label="📥 รับเข้าในช่วง" value={fmtInt(turnoverData.summary.received_qty)} unit="คัน" color="#0369a1" />
              <KPI label="📊 สต๊อกเฉลี่ย" value={fmt(turnoverData.summary.avg_stock, 1)} unit="คัน" color="#7c3aed" />
              <KPI label="🔄 Turnover Ratio" value={fmt(turnoverData.summary.turnover_ratio, 2)} unit="รอบ" color="#dc2626" />
              <KPI label="⏱️ วันเฉลี่ยที่ขายได้" value={fmt(turnoverData.summary.avg_days_to_sell, 1)} unit="วัน" color="#d97706" />
              <KPI label="💰 COGS" value={fmt(turnoverData.summary.cogs, 0)} unit="บาท" color="#374151" />
            </div>
          )}

          {/* By Model table */}
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>
              📋 ตามรุ่น/สี (เรียงจากหมุนไว → ช้า)
            </div>
            <div style={{ overflowX: "auto", maxHeight: "55vh" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#f9fafb", position: "sticky", top: 0 }}>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>รุ่น</th>
                    <th style={th}>สี</th>
                    <th style={{ ...th, textAlign: "right" }}>ขาย (คัน)</th>
                    <th style={{ ...th, textAlign: "right" }}>วันเฉลี่ย</th>
                    <th style={{ ...th, textAlign: "right" }}>สต๊อกคงเหลือ<br/><span style={{ fontWeight: 400, fontSize: 10, color: "#6b7280" }}>(ณ {fmtDate(dateTo)})</span></th>
                  </tr>
                </thead>
                <tbody>
                  {turnLoading ? (
                    <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
                  ) : turnoverData.byModel.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>
                  ) : turnoverData.byModel.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{r.model || "-"}</td>
                      <td style={td}>{r.color || "-"}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600, color: "#059669" }}>{fmtInt(r.sold_qty)}</td>
                      <td style={{ ...td, textAlign: "right", color: r.avg_days > 90 ? "#dc2626" : r.avg_days > 60 ? "#d97706" : "#374151", fontWeight: 600 }}>{r.avg_days != null ? fmt(r.avg_days, 1) : "-"}</td>
                      <td style={{ ...td, textAlign: "right", color: "#0369a1" }}>{fmtInt(r.stock_end_qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, unit, color }) {
  return (
    <div style={{ padding: 12, background: "#fff", borderRadius: 10, border: `2px solid ${color}`, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{unit}</div>
    </div>
  );
}

const th = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#374151", whiteSpace: "nowrap" };
const td = { padding: "6px 10px", fontSize: 12, verticalAlign: "middle" };
