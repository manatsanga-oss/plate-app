import React, { useState, useEffect, useMemo } from "react";

const API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-giveaway-report";

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

export default function PartGiveawayReportPage() {
  const [dateFrom, setDateFrom] = useState(firstOfMonthISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [partFilter, setPartFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [showDup, setShowDup] = useState(false);
  const [showGap, setShowGap] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date_from: dateFrom, date_to: dateTo, search }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // "ร้าน" = prefix ของเลขใบขาย (เช่น SCY01-SS260500401 -> SCY01)
  const storeOf = (r) => String(r.sale_doc_no || "").split("-")[0].trim() || "(ไม่ระบุ)";
  const partOf = (r) => (r.part_name || "").trim() || "(ไม่ระบุ)";
  const brandOf = (r) => (r.sale_brand || "").trim() || "(ไม่ระบุ)";

  const partOptions = useMemo(() => [...new Set(rows.map(partOf))].sort((a, b) => a.localeCompare(b, "th")), [rows]);
  const brandOptions = useMemo(() => [...new Set(rows.map(brandOf))].sort((a, b) => a.localeCompare(b, "th")), [rows]);
  const storeOptions = useMemo(() => [...new Set(rows.map(storeOf))].sort((a, b) => a.localeCompare(b, "th")), [rows]);

  const filtered = useMemo(() => rows.filter(r =>
    (!partFilter || partOf(r) === partFilter) &&
    (!brandFilter || brandOf(r) === brandFilter) &&
    (!storeFilter || storeOf(r) === storeFilter)
  ), [rows, partFilter, brandFilter, storeFilter]);

  const summary = useMemo(() => ({
    rows: filtered.length,
    docs: new Set(filtered.filter(r => r.sale_invoice_no).map(r => r.sale_invoice_no)).size,
    qty: filtered.reduce((s, r) => s + (Number(r.qty) || 0), 0),
    cost: filtered.reduce((s, r) => s + (Number(r.unit_cost) * Number(r.qty) || 0), 0),
    matched: filtered.filter(r => r.sale_id).length,
  }), [filtered]);

  // เลขใบขาย (moto_sales) ที่มี "ของแถมซ้ำ" — อะไหล่รหัสเดียวกันถูกแถมมากกว่า 1 ครั้งในใบเดียว
  const dupInvoices = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const inv = String(r.sale_invoice_no || "").trim();
      if (!inv) continue;
      if (!map.has(inv)) map.set(inv, []);
      map.get(inv).push(r);
    }
    const result = [];
    for (const [inv, rs] of map) {
      const partCount = {};
      for (const r of rs) {
        const pc = String(r.part_code || "").trim();
        partCount[pc] = (partCount[pc] || 0) + 1;
      }
      const dupCodes = new Set(Object.entries(partCount).filter(([, n]) => n > 1).map(([pc]) => pc));
      if (dupCodes.size) result.push({ inv, rows: rs, dupCodes });
    }
    return result.sort((a, b) => b.dupCodes.size - a.dupCodes.size);
  }, [filtered]);

  // รายการที่ "วันที่แถม" กับ "วันที่ขายรถ (moto sale)" ต่างกันเกิน 45 วัน
  const GAP_DAYS = 45;
  const gapRows = useMemo(() => {
    const out = [];
    for (const r of filtered) {
      if (!r.sale_date || !r.sale_sale_date) continue;
      const a = new Date(r.sale_date), b = new Date(r.sale_sale_date);
      if (isNaN(a) || isNaN(b)) continue;
      const diff = Math.round((a - b) / 86400000);
      if (Math.abs(diff) > GAP_DAYS) out.push({ ...r, _gap: diff });
    }
    return out.sort((x, y) => Math.abs(y._gap) - Math.abs(x._gap));
  }, [filtered]);

  const brandColor = "#7c3aed";

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🎁 รายงานของแถม</h2>
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
          placeholder="🔎 ค้นหา (เลขใบขาย / รหัสอะไหล่ / ชื่ออะไหล่ / ลูกค้า)"
          style={{ flex: 1, minWidth: 200, padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
        <button onClick={load} disabled={loading}
          style={{ padding: "8px 20px", background: loading ? "#9ca3af" : brandColor, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
          {loading ? "⏳ โหลด..." : "🔍 ค้นหา"}
        </button>

        {/* ตัวกรองในหน้า (client-side) */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", width: "100%" }}>
          <select value={partFilter} onChange={e => setPartFilter(e.target.value)} style={selStyle}>
            <option value="">🧩 ชื่ออะไหล่ (ทั้งหมด)</option>
            {partOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} style={selStyle}>
            <option value="">🏍️ ยี่ห้อรถ (ทั้งหมด)</option>
            {brandOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} style={selStyle}>
            <option value="">🏪 ร้าน (ทั้งหมด)</option>
            {storeOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {(partFilter || brandFilter || storeFilter) && (
            <button onClick={() => { setPartFilter(""); setBrandFilter(""); setStoreFilter(""); }}
              style={{ padding: "7px 14px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              ✕ ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 12 }}>
        <KPI label="📋 ใบขาย" value={fmtInt(summary.docs)} unit="ใบ" color="#0369a1" />
        <KPI label="🎁 รายการ" value={fmtInt(summary.rows)} unit="บรรทัด" color="#7c3aed" />
        <KPI label="🔢 จำนวนชิ้น" value={fmt(summary.qty, 0)} unit="ชิ้น" color="#059669" />
        <KPI label="💰 ต้นทุนรวม" value={fmt(summary.cost, 0)} unit="บาท" color="#dc2626" />
        <KPI label="🔗 จับคู่ใบขายได้" value={`${summary.matched}/${summary.rows}`} unit="รายการ" color="#0891b2" />
        <KPI label="⚠️ ใบขายซ้ำ+ของแถมซ้ำ" value={fmtInt(dupInvoices.length)} unit="ใบ · กดดูรายละเอียด" color="#ea580c"
          onClick={dupInvoices.length ? () => setShowDup(true) : undefined} />
        <KPI label={`📆 แถม-ขายต่างกัน >${GAP_DAYS} วัน`} value={fmtInt(gapRows.length)} unit="รายการ · กดดูรายละเอียด" color="#9333ea"
          onClick={gapRows.length ? () => setShowGap(true) : undefined} />
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: `2px solid ${brandColor}`, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: brandColor, color: "#fff", fontWeight: 700, fontSize: 14 }}>
          🎁 ของแถม — {filtered.length} รายการ{filtered.length !== rows.length ? ` (จากทั้งหมด ${rows.length})` : ""}
        </div>
        <div style={{ overflowX: "auto", maxHeight: "65vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#f9fafb", position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={th}>#</th>
                <th style={th}>วันที่</th>
                <th style={th}>รหัสอะไหล่</th>
                <th style={th}>ชื่ออะไหล่</th>
                <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
                <th style={{ ...th, textAlign: "right" }}>ต้นทุนรวม</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>เลขใบขาย</th>
                <th style={th}>วันที่ขายรถ</th>
                <th style={th}>ยี่ห้อ</th>
                <th style={th}>รุ่นรถ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.id} style={{ borderTop: "1px solid #f3f4f6", background: r.sale_id ? "transparent" : "#fef9e7" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{fmtDate(r.sale_date)}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.part_code}</td>
                  <td style={td}>{(r.part_name || "-").slice(0, 50)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.qty, 0)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{fmt(Number(r.unit_cost) * Number(r.qty))}</td>
                  <td style={{ ...td, fontSize: 11 }}>
                    {r.sale_customer_name || <span style={{ color: "#9ca3af" }}>(no match: {r.gv_customer_name?.slice(0, 20) || "-"})</span>}
                  </td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>
                    {r.sale_invoice_no || <span style={{ color: "#9ca3af" }}>-</span>}
                  </td>
                  <td style={td}>{r.sale_sale_date ? fmtDate(r.sale_sale_date) : <span style={{ color: "#9ca3af" }}>-</span>}</td>
                  <td style={td}>{r.sale_brand || <span style={{ color: "#9ca3af" }}>-</span>}</td>
                  <td style={td}>{r.sale_model_series || <span style={{ color: "#9ca3af" }}>-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: เลขใบขายซ้ำ */}
      {showDup && (
        <div onClick={() => setShowDup(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, width: "min(900px, 96vw)", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ padding: "12px 16px", background: "#ea580c", color: "#fff", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📑 ใบขายซ้ำ + ของแถมซ้ำ (moto sale) — {dupInvoices.length} ใบ</span>
              <button onClick={() => setShowDup(false)}
                style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 6, width: 28, height: 28, fontSize: 16, cursor: "pointer", fontWeight: 700 }}>✕</button>
            </div>
            <div style={{ padding: 14, overflowY: "auto" }}>
              {dupInvoices.map(({ inv, rows: rs, dupCodes }) => (
                <div key={inv} style={{ marginBottom: 14, border: "1px solid #fed7aa", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "#fff7ed", fontWeight: 700, color: "#9a3412", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontFamily: "monospace" }}>🧾 {inv}</span>
                    <span style={{ fontSize: 12, color: "#c2410c" }}>
                      {rs[0].sale_customer_name || rs[0].gv_customer_name || "-"} · ขายรถ {rs[0].sale_sale_date ? fmtDate(rs[0].sale_sale_date) : "-"} · ของแถมซ้ำ {dupCodes.size} รายการ
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead style={{ background: "#f9fafb" }}>
                      <tr>
                        <th style={th}>วันที่แถม</th>
                        <th style={th}>เลขใบขาย</th>
                        <th style={th}>รหัสอะไหล่</th>
                        <th style={th}>ชื่ออะไหล่</th>
                        <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
                        <th style={{ ...th, textAlign: "right" }}>ต้นทุนรวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rs.map((r, j) => {
                        const isDup = dupCodes.has(String(r.part_code || "").trim());
                        return (
                          <tr key={r.id ?? j} style={{ borderTop: "1px solid #f3f4f6", background: isDup ? "#fee2e2" : "transparent" }}>
                            <td style={td}>{fmtDate(r.sale_date)}</td>
                            <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.sale_doc_no || "-"}</td>
                            <td style={{ ...td, fontFamily: "monospace", fontWeight: isDup ? 700 : 400, color: isDup ? "#b91c1c" : "inherit" }}>
                              {isDup ? "⚠️ " : ""}{r.part_code}
                            </td>
                            <td style={td}>{(r.part_name || "-").slice(0, 50)}</td>
                            <td style={{ ...td, textAlign: "right" }}>{fmt(r.qty, 0)}</td>
                            <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{fmt(Number(r.unit_cost) * Number(r.qty))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: วันที่แถม-ขายต่างกันเกิน GAP_DAYS วัน */}
      {showGap && (
        <div onClick={() => setShowGap(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, width: "min(960px, 96vw)", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ padding: "12px 16px", background: "#9333ea", color: "#fff", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📆 วันที่แถม–วันที่ขายรถ ต่างกันเกิน {GAP_DAYS} วัน — {gapRows.length} รายการ</span>
              <button onClick={() => setShowGap(false)}
                style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 6, width: 28, height: 28, fontSize: 16, cursor: "pointer", fontWeight: 700 }}>✕</button>
            </div>
            <div style={{ overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f9fafb", position: "sticky", top: 0 }}>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>วันที่แถม</th>
                    <th style={th}>วันที่ขายรถ</th>
                    <th style={{ ...th, textAlign: "right" }}>ต่างกัน (วัน)</th>
                    <th style={th}>เลขใบขาย</th>
                    <th style={th}>ชื่ออะไหล่</th>
                    <th style={th}>ลูกค้า</th>
                  </tr>
                </thead>
                <tbody>
                  {gapRows.map((r, i) => (
                    <tr key={r.id ?? i} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>{fmtDate(r.sale_date)}</td>
                      <td style={td}>{fmtDate(r.sale_sale_date)}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#9333ea" }}>
                        {r._gap > 0 ? "+" : ""}{fmtInt(r._gap)}
                      </td>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.sale_invoice_no || "-"}</td>
                      <td style={td}>{(r.part_name || "-").slice(0, 40)}</td>
                      <td style={{ ...td, fontSize: 11 }}>{r.sale_customer_name || r.gv_customer_name || "-"}</td>
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

function KPI({ label, value, unit, color, onClick }) {
  return (
    <div onClick={onClick}
      style={{ padding: 10, background: "#fff", borderRadius: 10, border: `2px solid ${color}`, textAlign: "center",
        cursor: onClick ? "pointer" : "default", boxShadow: onClick ? `0 2px 6px ${color}33` : "none", transition: "transform .1s" }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#6b7280" }}>{unit}</div>
    </div>
  );
}

const selStyle = { padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, background: "#fff", maxWidth: 260, cursor: "pointer" };
const th = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#374151", whiteSpace: "nowrap" };
const td = { padding: "6px 10px", fontSize: 12, verticalAlign: "middle" };
