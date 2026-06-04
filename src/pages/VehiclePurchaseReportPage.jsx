import React, { useState, useEffect, useMemo } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/vehicle-purchase-report";

function fmtMoney(v) {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (!isFinite(n)) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}

export default function VehiclePurchaseReportPage() {
  const [tab, setTab] = useState("HONDA");
  const [hondaRows, setHondaRows] = useState([]);
  const [yamahaRows, setYamahaRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      setHondaRows(Array.isArray(data.honda) ? data.honda : []);
      setYamahaRows(Array.isArray(data.yamaha) ? data.yamaha : []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const rows = tab === "HONDA" ? hondaRows : yamahaRows;

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter(r => {
      if (s) {
        const blob = JSON.stringify(r).toLowerCase();
        if (!blob.includes(s)) return false;
      }
      const d = tab === "HONDA" ? r.gr_date : r.receipt_date;
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      return true;
    });
  }, [rows, search, dateFrom, dateTo, tab]);

  const total = filtered.reduce((s, r) => s + (Number(r.unit_cost) || 0), 0);

  const isHonda = tab === "HONDA";
  const color = isHonda ? "#dc2626" : "#1e40af";

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📋 รายงานรับรถจักรยานยนต์</h2>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {["HONDA", "YAMAHA"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
              background: tab === t ? (t === "HONDA" ? "#dc2626" : "#1e40af") : "#e5e7eb",
              color: tab === t ? "#fff" : "#374151",
            }}>
            {t === "HONDA" ? "🔴 HONDA (ป.เปา)" : "🔵 YAMAHA (สิงห์ชัย)"}
            <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.9 }}>
              ({t === "HONDA" ? hondaRows.length : yamahaRows.length})
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา chassis_no / engine_no / model / invoice..."
          style={{ flex: 1, minWidth: 240, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
        <span style={{ alignSelf: "center", fontSize: 13, color: "#6b7280" }}>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
        <button onClick={load} disabled={loading}
          style={{ padding: "8px 20px", background: loading ? "#9ca3af" : color, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
          {loading ? "⏳ โหลด..." : "🔄 Refresh"}
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: `2px solid ${color}`, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: color, color: "#fff", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between" }}>
          <span>{isHonda ? "🔴 HONDA ป.เปา" : "🔵 YAMAHA สิงห์ชัย"} — {filtered.length} รายการ</span>
          <span>รวมต้นทุน: {fmtMoney(total)} บาท</span>
        </div>
        <div style={{ overflowX: "auto", maxHeight: "70vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#f9fafb", position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={th}>#</th>
                {isHonda ? (
                  <>
                    <th style={th}>เลขที่ GR</th>
                    <th style={th}>วันที่รับ</th>
                    <th style={th}>เลขที่ใบกำกับภาษี</th>
                    <th style={th}>เลขที่ใบรับสินค้า</th>
                    <th style={th}>รุ่น</th>
                    <th style={th}>แบบ</th>
                    <th style={th}>type</th>
                    <th style={th}>สี</th>
                    <th style={th}>เลขเครื่อง</th>
                    <th style={th}>เลขถัง</th>
                    <th style={th}>ประเภท</th>
                    <th style={{ ...th, textAlign: "right" }}>ราคาทุน</th>
                    <th style={th}>สถานที่</th>
                  </>
                ) : (
                  <>
                    <th style={th}>เลขที่รับ</th>
                    <th style={th}>วันที่รับ</th>
                    <th style={th}>รุ่น</th>
                    <th style={th}>แบบ</th>
                    <th style={th}>type</th>
                    <th style={th}>สี</th>
                    <th style={th}>เลขเครื่อง</th>
                    <th style={th}>เลขถัง</th>
                    <th style={{ ...th, textAlign: "right" }}>ราคาทุน</th>
                    <th style={th}>เลขที่ใบกำกับ</th>
                    <th style={th}>ผู้ขาย</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={isHonda ? 14 : 12} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่พบรายการ</td></tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={(r.chassis_no || r.id) + "_" + i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    {isHonda ? (
                      <>
                        <td style={{ ...td, fontFamily: "monospace", color: "#0369a1", fontWeight: 600 }}>{r.gr_no || "-"}</td>
                        <td style={td}>{fmtDate(r.gr_date)}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.invoice_no || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{r.ref_no || "-"}</td>
                        <td style={td}>{r.model_name || "-"}</td>
                        <td style={td}>{r.model_code || "-"}</td>
                        <td style={td}>{r.model_type || "-"}</td>
                        <td style={td}>{r.color_name || r.color_code || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.engine_no || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{r.chassis_no || "-"}</td>
                        <td style={td}>{r.product_type || "-"}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtMoney(r.unit_cost)}</td>
                        <td style={td}>{r.location || "-"}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ ...td, fontFamily: "monospace", color: "#0369a1", fontWeight: 600 }}>{r.receipt_no || "-"}</td>
                        <td style={td}>{fmtDate(r.receipt_date)}</td>
                        <td style={td}>{r.model_name || "-"}</td>
                        <td style={td}>{r.model_code || "-"}</td>
                        <td style={td}>{r.model_type || "-"}</td>
                        <td style={td}>{r.color_name || r.color_code || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.engine_no || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{r.chassis_no || "-"}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtMoney(r.unit_cost)}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.tax_invoice_no || "-"}</td>
                        <td style={td}>{r.vendor || r.vendor_name || "-"}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#374151", whiteSpace: "nowrap" };
const td = { padding: "6px 10px", fontSize: 12, verticalAlign: "middle" };
