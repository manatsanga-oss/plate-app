import React, { useEffect, useState, useMemo } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/service-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const TH_MONTHS_P = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
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
  const [partsDetail, setPartsDetail] = useState(null);

  // popup สรุปมูลค่าสินค้า + ค่าบริการ รายใบแจ้งซ่อม — mechanicName = null คือทั้งหมด
  // ค่าบริการคิดกฎเดียวกับตารางสรุป: PDI = 50/ใบ (ป.เปา ไม่คิด PDI)
  function laborOf(r) {
    const isPDI = r.service_type && r.service_type.toUpperCase().includes("PDI");
    if (!isPDI) return Number(r.labor_amount || 0);
    const isPMotor = String(r.mechanic_code || "").toUpperCase() === "PMOTOR" || String(r.mechanic_name || "").includes("ป.เปา");
    return isPMotor ? 0 : 50;
  }
  function openPartsDetail(mechanicName) {
    const list = rows
      .filter(r => (Number(r.parts_value || 0) > 0 || laborOf(r) > 0) && (!mechanicName || (r.mechanic_name || "(ไม่ระบุ)") === mechanicName))
      .sort((a, b) => Number(b.parts_value || 0) - Number(a.parts_value || 0));
    setPartsDetail({ title: mechanicName || "ทุกช่าง", rows: list });
  }

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
  const totalPartsValue = rows.reduce((s, r) => s + Number(r.parts_value || 0), 0);

  // pivot: mechanic × service_type (count + labor) — PDI ใช้ count × 50
  const mechanicPivot = useMemo(() => {
    const types = [...new Set(rows.map(r => r.service_type).filter(Boolean))].sort();
    const isPDIType = (t) => t && t.toUpperCase().includes("PDI");
    // ป.เปา (PMOTOR) ไม่คิดค่า PDI
    const isPMotor = (code, name) => String(code || "").toUpperCase() === "PMOTOR" || String(name || "").includes("ป.เปา");
    const map = new Map();
    for (const r of rows) {
      const name = r.mechanic_name || "(ไม่ระบุ)";
      if (!map.has(name)) {
        const entry = { mechanic_code: r.mechanic_code, mechanic_name: name, total_jobs: 0, total_labor: 0, total_net: 0, total_parts_value: 0, is_pmotor: isPMotor(r.mechanic_code, name) };
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
      // total_labor: PDI ใช้ ×50 อื่น ๆ ใช้ labor_amount — ยกเว้น ป.เปา ไม่คิด PDI
      g.total_labor += (isPDIType(t) ? (g.is_pmotor ? 0 : 50) : Number(r.labor_amount || 0));
      g.total_net += Number(r.net_sale || 0);
      g.total_parts_value += Number(r.parts_value || 0);
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

  // พิมพ์รายงาน (user 2026-11-10): สรุปตัวเลข + ตารางช่างซ่อม × ประเภทบริการ + สรุปประเภทบริการ เปิดหน้าต่างใหม่แล้วสั่งพิมพ์ แนวนอน A4
  function printReport() {
    if (!rows.length) { setMessage("ไม่มีข้อมูลให้พิมพ์ — กดค้นหาก่อน"); return; }
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const r = (v, extra = "") => `<td style="text-align:right;font-family:monospace;${extra}">${v}</td>`;
    const period = month ? `${TH_MONTHS_P[Number(month) - 1]} ${Number(year) + 543}` : `ปี ${Number(year) + 543}`;
    const filters = [serviceType && `ประเภทบริการ: ${serviceType}`, search && `ค้นหา: ${search}`].filter(Boolean).join(" · ");
    const sumLabor = mechanicPivot.data.reduce((a, g) => a + g.total_labor, 0);
    const cards = [
      ["Jobs", totalJobs], ["ค่าสินค้ารวม", fmt(totalParts)], ["ค่าบริการรวม (รวม PDI×50)", fmt(sumLabor)],
      ["ขายสุทธิรวม", fmt(totalNet)], ["ค่าคอมมิชชั่นรวม (65%)", fmt(sumLabor * 0.65)], ["มูลค่าสินค้า (honda_part_sales)", fmt(totalPartsValue)],
    ].map(([l, v]) => `<div class="card"><div>${esc(l)}</div><b>${v}</b></div>`).join("");
    const pivotHead = mechanicPivot.types.map(t => `<th style="text-align:right">${esc(t)}</th>`).join("");
    const pivotRows = mechanicPivot.data.map((g, i) => {
      const cells = mechanicPivot.types.map(t => {
        const isPDI = t && t.toUpperCase().includes("PDI");
        if (isPDI && g.is_pmotor) return r("-");
        const c = g[t]?.count || 0;
        if (!c) return r("-");
        const v = isPDI ? c * 50 : (g[t]?.labor || 0);
        return r(`${fmt(v)}<div class="sub">(${c} jobs${isPDI ? " ×50" : ""})</div>`);
      }).join("");
      return `<tr><td>${i + 1}</td><td><b>${esc(g.mechanic_name)}</b></td>${cells}${r(g.total_jobs, "background:#fef9c3;font-weight:700")}${r(fmt(g.total_labor), "background:#fef9c3;font-weight:700")}${r(fmt(g.total_labor * 0.65), "background:#dcfce7;font-weight:700")}${r(fmt(g.total_parts_value), "background:#cffafe")}</tr>`;
    }).join("");
    const pivotTot = `<tr class="tot"><td colspan="2">รวม ${mechanicPivot.data.length} คน</td>${mechanicPivot.types.map(t => {
      const isPDI = t && t.toUpperCase().includes("PDI");
      const v = mechanicPivot.data.reduce((a, g) => a + (isPDI ? (g.is_pmotor ? 0 : (g[t]?.count || 0) * 50) : (g[t]?.labor || 0)), 0);
      const c = mechanicPivot.data.reduce((a, g) => a + (g[t]?.count || 0), 0);
      return r(`${fmt(v)}<div class="sub">(${c} jobs)</div>`);
    }).join("")}${r(totalJobs)}${r(fmt(sumLabor))}${r(fmt(sumLabor * 0.65))}${r(fmt(totalPartsValue))}</tr>`;
    const svcRows = byService.map((g, i) => `<tr><td>${i + 1}</td><td>${esc(g.service_type)}</td>${r(g.count)}${r(fmt(g.parts))}${r(fmt(g.labor))}${r(fmt(g.net))}</tr>`).join("");
    const svcTot = `<tr class="tot"><td colspan="2">รวม</td>${r(byService.reduce((a, g) => a + g.count, 0))}${r(fmt(byService.reduce((a, g) => a + g.parts, 0)))}${r(fmt(byService.reduce((a, g) => a + g.labor, 0)))}${r(fmt(byService.reduce((a, g) => a + g.net, 0)))}</tr>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>รายงานใบแจ้งซ่อม HONDA ${esc(period)}</title><style>
*{font-family:"Sarabun","TH Sarabun New",Tahoma,sans-serif;box-sizing:border-box}
@page{size:A4 landscape;margin:10mm}
body{margin:0;padding:8px;color:#111;font-size:12px}
h1{font-size:18px;margin:0 0 2px;color:#072d6b}
.meta{color:#555;font-size:11px;margin-bottom:8px}
.cards{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.card{border:1px solid #cbd5e1;border-radius:6px;padding:6px 10px;min-width:140px;font-size:11px;color:#555}
.card b{display:block;font-size:15px;color:#111;font-family:monospace;margin-top:2px}
h2{font-size:14px;margin:12px 0 4px;color:#072d6b}
table{width:100%;border-collapse:collapse;font-size:11px;page-break-inside:auto}
th,td{border:1px solid #cbd5e1;padding:3px 5px;vertical-align:top}
th{background:#f0f4f9;text-align:left}
tr{page-break-inside:avoid}
.sub{font-size:9px;color:#6b7280;font-weight:400}
.tot td{background:#fef9c3;font-weight:700}
.foot{margin-top:10px;font-size:10px;color:#777}
@media print{.noprint{display:none}}
</style></head><body>
<div class="noprint" style="text-align:right;margin-bottom:6px"><button onclick="window.print()" style="padding:6px 16px;font-size:13px;cursor:pointer">🖨️ พิมพ์</button></div>
<h1>🔧 รายงานใบแจ้งซ่อม HONDA — ${esc(period)}</h1>
<div class="meta">${esc(filters || "ทุกประเภทบริการ")} · ${rows.length} ใบ · พิมพ์ ${new Date().toLocaleString("th-TH")}</div>
<div class="cards">${cards}</div>
<h2>สรุปยอด/จำนวน ของช่างซ่อม แยกตามประเภทบริการ</h2>
<table><thead><tr><th>#</th><th>ช่างซ่อม</th>${pivotHead}<th style="text-align:right;background:#fef9c3">รวม Jobs</th><th style="text-align:right;background:#fef9c3">ค่าบริการรวม</th><th style="text-align:right;background:#dcfce7">ค่าคอมมิชชั่น (65%)</th><th style="text-align:right;background:#cffafe">มูลค่าสินค้า</th></tr></thead>
<tbody>${pivotRows}${pivotTot}</tbody></table>
<h2>สรุปประเภทบริการ</h2>
<table style="width:auto;min-width:60%"><thead><tr><th>#</th><th>ประเภทบริการ</th><th style="text-align:right">Jobs</th><th style="text-align:right">ค่าสินค้า</th><th style="text-align:right">ค่าบริการ</th><th style="text-align:right">ขายสุทธิ</th></tr></thead>
<tbody>${svcRows}${svcTot}</tbody></table>
<div class="foot">PDI คิด 50 บาท/ใบ (ช่างสังกัด ป.เปา ไม่คิด PDI) · ค่าคอมมิชชั่น = ค่าบริการรวม × 65% · มูลค่าสินค้าจาก honda_part_sales</div>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`;
    const w = window.open("", "_blank", "width=1100,height=750");
    if (!w) { setMessage("เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาต pop-up แล้วลองอีกครั้ง"); return; }
    w.document.write(html); w.document.close(); w.focus();
  }

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
        <button onClick={printReport} disabled={loading || rows.length === 0} title="พิมพ์สรุปช่างซ่อม + ประเภทบริการ (A4 แนวนอน)"
          style={{ ...btnBlue, background: rows.length ? "#374151" : "#9ca3af" }}>🖨️ พิมพ์</button>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: "#b91c1c" }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
        <Card label="📋 Jobs" value={totalJobs} color="#1e40af" />
        <Card label="🧰 ค่าสินค้ารวม" value={fmt(totalParts)} color="#7c3aed" />
        <Card label="🛠️ ค่าบริการรวม (รวม PDI×50)" value={fmt(mechanicPivot.data.reduce((s, g) => s + g.total_labor, 0))} color="#0369a1" />
        <Card label="💰 ขายสุทธิรวม" value={fmt(totalNet)} color="#059669" />
        <Card label="💵 ค่าคอมมิชชั่นรวม (65%)" value={fmt(mechanicPivot.data.reduce((s, g) => s + g.total_labor, 0) * 0.65)} color="#15803d" highlight />
        <Card label="📦 มูลค่าสินค้า (จาก honda_part_sales) — คลิกดูรายใบ" value={fmt(totalPartsValue)} color="#0891b2" onClick={() => openPartsDetail(null)} />
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
                  <th style={{ ...th, textAlign: "right", background: "#dcfce7" }}>ค่าคอมมิชชั่น (65%)</th>
                  <th style={{ ...th, textAlign: "right", background: "#cffafe" }}>มูลค่าสินค้า</th>
                </tr>
              </thead>
              <tbody>
                {mechanicPivot.data.map((g, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{g.mechanic_name}</td>
                    {mechanicPivot.types.map(t => {
                      const isPDI = t && t.toUpperCase().includes("PDI");
                      const skipPDI = isPDI && g.is_pmotor;  // ป.เปา ไม่คิด PDI
                      const displayValue = isPDI ? (g[t]?.count || 0) * 50 : (g[t]?.labor || 0);
                      return (
                        <td key={t} style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>
                          {skipPDI ? (
                            <span style={{ color: "#9ca3af" }}>-</span>
                          ) : g[t]?.count > 0 ? (
                            <>
                              <div style={isPDI ? { color: "#f59e0b", fontWeight: 600 } : {}}>{fmt(displayValue)}</div>
                              <div style={{ fontSize: 10, color: "#6b7280" }}>({g[t].count} jobs{isPDI ? " ×50" : ""})</div>
                            </>
                          ) : "-"}
                        </td>
                      );
                    })}
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: "#fef9c3" }}>{g.total_jobs}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: "#fef9c3", color: "#059669" }}>{fmt(g.total_labor)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: "#dcfce7", color: "#15803d" }}>{fmt(g.total_labor * 0.65)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: "#cffafe" }}>
                      {g.total_parts_value > 0 ? (
                        <span style={{ color: "#0891b2", cursor: "pointer", textDecoration: "underline" }} onClick={() => openPartsDetail(g.mechanic_name)}>{fmt(g.total_parts_value)}</span>
                      ) : (
                        <span style={{ color: "#0891b2" }}>{fmt(g.total_parts_value)}</span>
                      )}
                    </td>
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

      {/* Parts value popup — มูลค่าสินค้ารายใบแจ้งซ่อม */}
      {partsDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => setPartsDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 900, width: "95%", maxHeight: "90vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📦 มูลค่าสินค้ารายใบแจ้งซ่อม — {partsDetail.title} ({partsDetail.rows.length} ใบ)</h3>
              <button onClick={() => setPartsDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>มูลค่าสินค้าจาก honda_part_sales จับคู่เลขที่ JOB · ค่าบริการคิดกฎเดียวกับตารางสรุป (PDI = 50/ใบ, ป.เปา ไม่คิด PDI) · แสดงเฉพาะใบที่มียอด</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f0f4f9", position: "sticky", top: 0 }}>
                <tr>
                  <th style={th}>#</th><th style={th}>เลขที่ JOB</th>
                  <th style={th}>วันที่ปิด</th><th style={th}>ช่างซ่อม</th><th style={th}>ประเภทบริการ</th>
                  <th style={{ ...th, textAlign: "right", background: "#fef9c3" }}>ค่าบริการ</th>
                  <th style={{ ...th, textAlign: "right", background: "#cffafe" }}>มูลค่าสินค้า</th>
                </tr>
              </thead>
              <tbody>
                {partsDetail.rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.job_no}</td>
                    <td style={td}>{fmtDate(r.close_date)}</td>
                    <td style={td}>{r.mechanic_name}</td>
                    <td style={td}>{r.service_type || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669", fontWeight: 600 }}>{fmt(laborOf(r))}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#0891b2", fontWeight: 600 }}>{fmt(r.parts_value)}</td>
                  </tr>
                ))}
                <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                  <td colSpan={5} style={{ ...td, textAlign: "right" }}>รวม</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{fmt(partsDetail.rows.reduce((s, r) => s + laborOf(r), 0))}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#0891b2", background: "#cffafe" }}>{fmt(partsDetail.rows.reduce((s, r) => s + Number(r.parts_value || 0), 0))}</td>
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

function Card({ label, value, color, highlight, onClick }) {
  return (
    <div onClick={onClick} style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: highlight ? `2px solid ${color}` : "1px solid #e5e7eb", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: highlight ? 22 : 18, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const btnBlue = { padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
