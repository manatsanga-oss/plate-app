import React, { useEffect, useState, useMemo } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/service-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}

async function postAPI(body) {
  const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

const NOW = new Date();

export default function HondaRepairReportPage() {
  const [year, setYear] = useState(NOW.getFullYear());
  const [month, setMonth] = useState(NOW.getMonth() + 1);
  const [serviceType, setServiceType] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [serviceDetail, setServiceDetail] = useState(null);

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const data = await postAPI({ action: "list_honda_repair_jobs", year: year || "", month: month || "", service_type: serviceType, search });
      setRows(Array.isArray(data) ? data.filter(r => r && r.id) : []);
    } catch { setRows([]); setMessage("❌ โหลดไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const totalJobs = rows.length;
  const totalParts = rows.reduce((s, r) => s + Number(r.parts_amount || 0), 0);
  const totalLabor = rows.reduce((s, r) => s + Number(r.labor_amount || 0), 0);
  const totalNet = rows.reduce((s, r) => s + Number(r.net_sale || 0), 0);

  // pivot: mechanic × service_type (count + labor) — PDI ใช้ count × 40
  const mechanicPivot = useMemo(() => {
    const types = [...new Set(rows.map(r => r.service_type).filter(Boolean))].sort();
    const isPDIType = (t) => t && t.toUpperCase().includes("PDI");
    const map = new Map();
    for (const r of rows) {
      const name = r.mechanic_name || "(ไม่ระบุ)";
      if (!map.has(name)) {
        const entry = { mechanic_code: r.mechanic_code, mechanic_name: name, total_jobs: 0, total_labor: 0, total_net: 0 };
        for (const t of types) entry[t] = { count: 0, labor: 0 };
        map.set(name, entry);
      }
      const g = map.get(name);
      const t = r.service_type;
      if (t && g[t]) {
        g[t].count += 1;
        g[t].labor += Number(r.labor_amount || 0);
      }
      g.total_jobs += 1;
      // total_labor: PDI ใช้ ×40 อื่น ๆ ใช้ labor_amount
      g.total_labor += isPDIType(t) ? 40 : Number(r.labor_amount || 0);
      g.total_net += Number(r.net_sale || 0);
    }
    return { types, data: [...map.values()].sort((a, b) => b.total_labor - a.total_labor) };
  }, [rows]);

  // by service_type summary
  const byService = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const k = r.service_type || "(ไม่ระบุ)";
      if (!map.has(k)) map.set(k, { service_type: k, count: 0, parts: 0, labor: 0, net: 0 });
      const g = map.get(k);
      g.count += 1;
      g.parts += Number(r.parts_amount || 0);
      g.labor += Number(r.labor_amount || 0);
      g.net += Number(r.net_sale || 0);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [rows]);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🔧 รายงานใบแจ้งซ่อม HONDA</h2>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ปี:</span>
        <input type="number" value={year} onChange={e => setYear(e.target.value)} style={{ ...inp, width: 90 }} />
        <span>เดือน:</span>
        <select value={month} onChange={e => setMonth(e.target.value)} style={{ ...inp, width: 100 }}>
          <option value="">ทั้งปี</option>
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="text" placeholder="ประเภทบริการ" value={serviceType} onChange={e => setServiceType(e.target.value)} style={{ ...inp, minWidth: 200 }} />
        <input type="text" placeholder="🔍 ค้นหา (JOB/ช่าง/บริการ)" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, minWidth: 240 }} />
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 ค้นหา"}</button>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: "#b91c1c" }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
        <Card label="📋 Jobs" value={totalJobs} color="#1e40af" />
        <Card label="🧰 ค่าสินค้ารวม" value={fmt(totalParts)} color="#7c3aed" />
        <Card label="🛠️ ค่าบริการรวม" value={fmt(totalLabor)} color="#0369a1" />
        <Card label="💰 ขายสุทธิรวม" value={fmt(totalNet)} color="#059669" highlight />
      </div>

      {/* Pivot: ช่างซ่อม × ประเภทบริการ */}
      {mechanicPivot.data.length > 0 && (
        <div style={{ marginBottom: 12, padding: 12, background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 700, color: "#072d6b", marginBottom: 6 }}>🛠️ สรุปยอด/จำนวน ของช่างซ่อม แยกตามประเภทบริการ</div>
          <div style={{ overflowX: "auto", maxHeight: 500 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f0f4f9", position: "sticky", top: 0 }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>ช่างซ่อม</th>
                  {mechanicPivot.types.map(t => <th key={t} style={{ ...th, textAlign: "right" }}>{t}</th>)}
                  <th style={{ ...th, textAlign: "right", background: "#fef9c3" }}>รวม Jobs</th>
                  <th style={{ ...th, textAlign: "right", background: "#fef9c3" }}>ค่าบริการรวม</th>
                </tr>
              </thead>
              <tbody>
                {mechanicPivot.data.map((g, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{g.mechanic_name}</td>
                    {mechanicPivot.types.map(t => {
                      const isPDI = t && t.toUpperCase().includes("PDI");
                      const displayValue = isPDI ? (g[t]?.count || 0) * 40 : (g[t]?.labor || 0);
                      return (
                        <td key={t} style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>
                          {g[t]?.count > 0 ? (
                            <>
                              <div style={isPDI ? { color: "#f59e0b", fontWeight: 600 } : {}}>{fmt(displayValue)}</div>
                              <div style={{ fontSize: 10, color: "#6b7280" }}>({g[t].count} jobs{isPDI ? " ×40" : ""})</div>
                            </>
                          ) : "-"}
                        </td>
                      );
                    })}
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: "#fef9c3" }}>{g.total_jobs}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: "#fef9c3", color: "#059669" }}>{fmt(g.total_labor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* สรุปประเภทบริการ */}
      {byService.length > 0 && (
        <div style={{ marginBottom: 12, padding: 12, background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <div style={{ fontWeight: 700, color: "#072d6b", marginBottom: 6 }}>📊 สรุปประเภทบริการ</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f0f4f9" }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>ประเภทบริการ</th>
                  <th style={{ ...th, textAlign: "right" }}>Jobs</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าสินค้า</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าบริการ</th>
                  <th style={{ ...th, textAlign: "right" }}>ขายสุทธิ</th>
                </tr>
              </thead>
              <tbody>
                {byService.map((g, i) => {
                  const filteredRows = rows.filter(r => (r.service_type || "(ไม่ระบุ)") === g.service_type);
                  const openDetail = () => setServiceDetail({ service_type: g.service_type, rows: filteredRows });
                  return (
                    <tr key={g.service_type} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 600 }}>
                        <span style={{ cursor: "pointer", color: "#0369a1", textDecoration: "underline" }} onClick={openDetail}>{g.service_type}</span>
                      </td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{g.count}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(g.parts)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(g.labor)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{fmt(g.net)}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                  <td colSpan={2} style={{ ...td, textAlign: "right" }}>รวม</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{byService.reduce((s,g)=>s+g.count,0)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(byService.reduce((s,g)=>s+g.parts,0))}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(byService.reduce((s,g)=>s+g.labor,0))}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{fmt(byService.reduce((s,g)=>s+g.net,0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail popup */}
      {serviceDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => setServiceDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1400, width: "95%", maxHeight: "90vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 {serviceDetail.service_type} ({serviceDetail.rows.length} jobs)</h3>
              <button onClick={() => setServiceDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f0f4f9" }}>
                <tr>
                  <th style={th}>#</th><th style={th}>เลขที่ JOB</th>
                  <th style={th}>วันที่รับ</th><th style={th}>วันที่ปิด</th><th style={th}>ช่างซ่อม</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าสินค้า</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าบริการ</th>
                  <th style={{ ...th, textAlign: "right" }}>รวมสุทธิ</th>
                  <th style={{ ...th, textAlign: "right" }}>VAT</th>
                  <th style={{ ...th, textAlign: "right" }}>ขายสุทธิ</th>
                </tr>
              </thead>
              <tbody>
                {serviceDetail.rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.job_no}</td>
                    <td style={td}>{fmtDate(r.open_date)}</td>
                    <td style={td}>{fmtDate(r.close_date)}</td>
                    <td style={td}>{r.mechanic_name}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.parts_amount)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.labor_amount)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.total_net)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.vat)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{fmt(r.net_sale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, color, highlight }) {
  return (
    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: highlight ? `2px solid ${color}` : "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: highlight ? 22 : 18, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const btnBlue = { padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
