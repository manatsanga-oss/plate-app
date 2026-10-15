import React, { useEffect, useMemo, useState } from "react";

// รายงานข้อมูลการจดทะเบียนรถในตลาด (Brand/Category/Model รายเดือน) — Report Manager (user 2026-10-15)
// ข้อมูล: market_registrations ผ่าน webhook market-registration-api — บันทึกเข้าโดย Claude อ่านจากภาพรายงานทุกเดือน (ไฟล์ OneDrive\New folder\market-registrations\YYYY-MM.json)
// แสดง: จัดอันดับรวมทุกยี่ห้อเรียงตามจดทะเบียน (ไม่แยกประเภทรถ) + กรองประเภท/ยี่ห้อ + เทียบเดือนก่อน + ส่วนแบ่งตลาด
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/market-registration-api";
const BRAND_META = {
  HONDA: { label: "HONDA", color: "#dc2626", bg: "#fee2e2" },
  YAMAHA: { label: "YAMAHA", color: "#1d4ed8", bg: "#dbeafe" },
  OTHERS: { label: "อื่นๆ", color: "#374151", bg: "#e5e7eb" },
};
const CAT_LABEL = { AT: "AT (ออโตเมติก)", EV: "EV (ไฟฟ้า)", MP: "MP (ครอบครัว)", SP: "SP (สปอร์ต)" };
const TH_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const periodLabel = (p) => { const m = String(p || "").match(/^(\d{4})-(\d{2})$/); return m ? `${TH_MON[Number(m[2]) - 1]} ${Number(m[1]) + 543}` : p || "-"; };
const prevPeriod = (p) => { const m = String(p || "").match(/^(\d{4})-(\d{2})$/); if (!m) return ""; const d = new Date(Number(m[1]), Number(m[2]) - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const fmt = (n) => Number(n || 0).toLocaleString("th-TH");
const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "-");
const thDate = (v) => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])}/${Number(m[2])}/${Number(m[1]) + 543}` : "-"; };

async function post(body) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  if (!t.trim()) throw new Error("ไม่มีการตอบกลับจาก n8n (ตรวจว่า import Market_Registration_Workflow.json และเปิด Active แล้ว)");
  const d = JSON.parse(t);
  const first = Array.isArray(d) ? d[0] : d;
  if (first && first.__error) throw new Error(first.__error);
  if (first && typeof first.listjson === "string") return JSON.parse(first.listjson);
  return Array.isArray(d) ? d : [];
}

export default function MarketRegistrationReportPage() {
  const [periods, setPeriods] = useState([]);
  const [period, setPeriod] = useState("");
  const [rows, setRows] = useState([]);
  const [prevRows, setPrevRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cat, setCat] = useState("all");
  const [brand, setBrand] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const ps = await post({ action: "list_market_periods" });
        setPeriods(ps);
        if (ps.length) setPeriod(ps[0].period);
        else setError("ยังไม่มีข้อมูลเดือนไหนในระบบ — ส่งภาพรายงานให้ Claude บันทึกเข้าก่อน");
      } catch (e) { setError(e.message || String(e)); }
    })();
  }, []);

  useEffect(() => {
    if (!period) return;
    let alive = true;
    (async () => {
      setLoading(true); setError("");
      try {
        const pp = prevPeriod(period);
        const [cur, prev] = await Promise.all([
          post({ action: "list_market_registrations", period }),
          periods.some((p) => p.period === pp) ? post({ action: "list_market_registrations", period: pp }) : Promise.resolve([]),
        ]);
        if (!alive) return;
        setRows(cur); setPrevRows(prev);
      } catch (e) { if (alive) { setRows([]); setPrevRows([]); setError(e.message || String(e)); } }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [period, periods.length]);

  const dataDate = rows.find((r) => r.data_date)?.data_date;
  const keyOf = (r) => `${r.category}|${r.brand}|${r.model}`;
  const prevMap = useMemo(() => { const m = {}; prevRows.forEach((r) => { m[keyOf(r)] = Number(r.registered) || 0; }); return m; }, [prevRows]);
  const hasPrev = prevRows.length > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (cat === "all" || r.category === cat) && (brand === "all" || r.brand === brand) && (!q || String(r.model).toLowerCase().includes(q)))
      .map((r) => ({ ...r, registered: Number(r.registered) || 0, transferred: Number(r.transferred) || 0, prev: hasPrev ? (prevMap[keyOf(r)] ?? 0) : null }))
      .sort((a, b) => b.registered - a.registered || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  }, [rows, cat, brand, search, prevMap, hasPrev]);

  const total = filtered.reduce((s, r) => s + r.registered, 0);
  const totalAll = rows.reduce((s, r) => s + (Number(r.registered) || 0), 0);
  const prevTotalAll = prevRows.reduce((s, r) => s + (Number(r.registered) || 0), 0);
  const byBrand = useMemo(() => {
    const m = {}; rows.forEach((r) => { m[r.brand] = (m[r.brand] || 0) + (Number(r.registered) || 0); });
    const pm = {}; prevRows.forEach((r) => { pm[r.brand] = (pm[r.brand] || 0) + (Number(r.registered) || 0); });
    return ["HONDA", "YAMAHA", "OTHERS"].map((b) => ({ brand: b, n: m[b] || 0, prev: pm[b] || 0 }));
  }, [rows, prevRows]);
  const byCat = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      const c = r.category; m[c] = m[c] || { total: 0, HONDA: 0, YAMAHA: 0, OTHERS: 0 };
      m[c].total += Number(r.registered) || 0; m[c][r.brand] = (m[c][r.brand] || 0) + (Number(r.registered) || 0);
    });
    return ["AT", "MP", "SP", "EV"].filter((c) => m[c]).map((c) => ({ cat: c, ...m[c] }));
  }, [rows]);

  const diffCell = (cur, prev) => {
    if (prev == null) return <span style={{ color: "#9ca3af" }}>-</span>;
    const d = cur - prev;
    return <span style={{ color: d > 0 ? "#15803d" : d < 0 ? "#b91c1c" : "#6b7280", fontWeight: d ? 700 : 400 }}>{d > 0 ? "+" : ""}{fmt(d)}</span>;
  };

  function printReport() {
    const w = window.open("", "_blank");
    if (!w) return;
    const trs = filtered.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${r.model}</td><td>${BRAND_META[r.brand]?.label || r.brand}</td><td class="c">${r.category}</td><td class="r">${fmt(r.registered)}</td><td class="r">${pct(r.registered, totalAll)}</td><td class="r">${r.prev == null ? "-" : fmt(r.prev)}</td><td class="r">${r.transferred ? fmt(r.transferred) : "-"}</td></tr>`).join("");
    const closeTag = "</" + "script>";
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>จดทะเบียนรถในตลาด ${periodLabel(period)}</title>
<style>body{font-family:Tahoma,sans-serif;font-size:12px;margin:18px}h2{margin:0 0 4px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4px 6px}th{background:#eee}.c{text-align:center}.r{text-align:right}</style></head><body>
<h2>ข้อมูลการจดทะเบียนรถในตลาด — ${periodLabel(period)}</h2>
<div>ข้อมูลถึงวันที่ ${thDate(dataDate)} · ประเภท: ${cat === "all" ? "ทุกประเภท" : cat} · ยี่ห้อ: ${brand === "all" ? "ทุกยี่ห้อ" : BRAND_META[brand]?.label || brand} · รวม ${fmt(total)} คัน (ทั้งตลาด ${fmt(totalAll)})</div>
<table><thead><tr><th>#</th><th>รุ่น</th><th>ยี่ห้อ</th><th>ประเภท</th><th>จดทะเบียน</th><th>ส่วนแบ่ง</th><th>เดือนก่อน</th><th>แจ้งย้าย</th></tr></thead><tbody>${trs}</tbody></table>
<script>window.onload=function(){window.print();}${closeTag}</body></html>`);
    w.document.close();
  }

  const inp = { padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma" };
  const th = { padding: "9px 8px", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff" };
  const td = { padding: "7px 8px", fontSize: 13, borderBottom: "1px solid #e5e7eb" };
  const tdR = { ...td, textAlign: "right", whiteSpace: "nowrap" };
  const card = { background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" };

  return (
    <div className="page-container">
      <div className="page-topbar"><div className="page-title">📈 ข้อมูลการจดทะเบียนรถในตลาด</div></div>
      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 10 }}>
        จัดอันดับรวมทุกยี่ห้อตามจำนวนจดทะเบียน (ไม่แยกประเภทรถ) · ข้อมูลรายเดือนจากรายงาน Brand/Category/Model — ส่งภาพรายงานให้ Claude บันทึกเข้าระบบทุกเดือน
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ fontSize: 13 }}>🗓️ เดือน</label>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ ...inp, minWidth: 150 }}>
          {periods.map((p) => <option key={p.period} value={p.period}>{periodLabel(p.period)} ({fmt(p.registered)} คัน)</option>)}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={inp}>
          <option value="all">ทุกประเภทรถ</option>
          {["AT", "MP", "SP", "EV"].map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
        </select>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} style={inp}>
          <option value="all">ทุกยี่ห้อ</option>
          {Object.entries(BRAND_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหารุ่น" style={{ ...inp, width: 180 }} />
        <button onClick={printReport} disabled={!filtered.length} style={{ padding: "8px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>🖨️ พิมพ์</button>
        {dataDate && <span style={{ fontSize: 12.5, color: "#6b7280", marginLeft: "auto" }}>ข้อมูลถึงวันที่ {thDate(dataDate)}</span>}
      </div>
      {error && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13 }}>❌ {error}</div>}

      {rows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 14 }}>
          <div style={card}>
            <div style={{ fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>ส่วนแบ่งตลาดตามยี่ห้อ — {periodLabel(period)}</div>
            {byBrand.map((b) => (
              <div key={b.brand} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: BRAND_META[b.brand].color }}>{BRAND_META[b.brand].label}</span>
                  <span>{fmt(b.n)} คัน · <b>{pct(b.n, totalAll)}</b>{hasPrev && <span style={{ marginLeft: 6, fontSize: 12 }}>({diffCell(b.n, b.prev)} จากเดือนก่อน)</span>}</span>
                </div>
                <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}><div style={{ width: pct(b.n, totalAll), height: "100%", background: BRAND_META[b.brand].color }} /></div>
              </div>
            ))}
            <div style={{ fontSize: 13, marginTop: 6, borderTop: "1px solid #e5e7eb", paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
              <b>รวมทั้งตลาด</b><span><b>{fmt(totalAll)}</b> คัน{hasPrev && <span style={{ marginLeft: 6, fontSize: 12 }}>({diffCell(totalAll, prevTotalAll)} · เดือนก่อน {fmt(prevTotalAll)})</span>}</span>
            </div>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>แยกประเภทรถ <span style={{ fontWeight: 400, fontSize: 12, color: "#6b7280" }}>(กดแถวเพื่อกรอง)</span></div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>{["ประเภท", "รวม", "HONDA", "YAMAHA", "อื่นๆ"].map((h, i) => <th key={h} style={{ padding: "4px 6px", textAlign: i ? "right" : "left", borderBottom: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280" }}>{h}</th>)}</tr></thead>
              <tbody>
                {byCat.map((c) => (
                  <tr key={c.cat} style={{ cursor: "pointer", background: cat === c.cat ? "#eff6ff" : undefined }} onClick={() => setCat(cat === c.cat ? "all" : c.cat)}>
                    <td style={{ padding: "5px 6px" }}>{c.cat}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700 }}>{fmt(c.total)} <span style={{ fontSize: 11, color: "#6b7280" }}>({pct(c.total, totalAll)})</span></td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: BRAND_META.HONDA.color }}>{fmt(c.HONDA)} <span style={{ fontSize: 11 }}>({pct(c.HONDA, c.total)})</span></td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: BRAND_META.YAMAHA.color }}>{fmt(c.YAMAHA)} <span style={{ fontSize: 11 }}>({pct(c.YAMAHA, c.total)})</span></td>
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>{fmt(c.OTHERS)} <span style={{ fontSize: 11 }}>({pct(c.OTHERS, c.total)})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...th, textAlign: "center", width: 44 }}>อันดับ</th><th style={th}>รุ่น</th><th style={th}>ยี่ห้อ</th><th style={{ ...th, textAlign: "center" }}>ประเภท</th>
            <th style={{ ...th, textAlign: "right" }}>จดทะเบียน (คัน)</th><th style={{ ...th, textAlign: "right" }}>ส่วนแบ่งตลาด</th>
            <th style={{ ...th, textAlign: "right" }}>เดือนก่อน</th><th style={{ ...th, textAlign: "right" }}>เปลี่ยนแปลง</th><th style={{ ...th, textAlign: "right" }}>แจ้งย้าย</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 22 }}>กำลังโหลด...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 22 }}>ไม่มีข้อมูล</td></tr>}
            {!loading && filtered.map((r, i) => {
              const bm = BRAND_META[r.brand] || BRAND_META.OTHERS;
              return (
                <tr key={keyOf(r)} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700, color: i < 3 ? "#b45309" : "#374151" }}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.model}</td>
                  <td style={td}><span style={{ padding: "1px 8px", borderRadius: 10, fontSize: 11.5, fontWeight: 700, background: bm.bg, color: bm.color }}>{bm.label}</span></td>
                  <td style={{ ...td, textAlign: "center", fontSize: 12 }}>{r.category}</td>
                  <td style={{ ...tdR, fontWeight: 700, fontSize: 14 }}>{fmt(r.registered)}</td>
                  <td style={tdR}>{pct(r.registered, totalAll)}</td>
                  <td style={{ ...tdR, color: "#6b7280" }}>{r.prev == null ? "-" : fmt(r.prev)}</td>
                  <td style={tdR}>{diffCell(r.registered, r.prev)}</td>
                  <td style={{ ...tdR, color: "#6b7280" }}>{r.transferred ? fmt(r.transferred) : "-"}</td>
                </tr>
              );
            })}
            {!loading && filtered.length > 0 && (
              <tr style={{ background: "#fef3c7", fontWeight: 700 }}>
                <td style={td} colSpan={4}>รวม {filtered.length} รุ่น{(cat !== "all" || brand !== "all" || search) ? " (ตามตัวกรอง)" : ""}</td>
                <td style={tdR}>{fmt(total)}</td><td style={tdR}>{pct(total, totalAll)}</td>
                <td style={tdR}>{hasPrev ? fmt(filtered.reduce((s, r) => s + (r.prev || 0), 0)) : "-"}</td>
                <td style={tdR}>{hasPrev ? diffCell(total, filtered.reduce((s, r) => s + (r.prev || 0), 0)) : "-"}</td>
                <td style={tdR}>{fmt(filtered.reduce((s, r) => s + r.transferred, 0)) || "-"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
