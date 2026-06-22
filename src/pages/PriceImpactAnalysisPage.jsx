import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// วิเคราะห์ผลกระทบ "ปรับราคา / ค่าส่งเสริม / คอมมิชชัน" ต่อยอดขาย — ย้อนหลังหลายเดือน
// reuse: stock-turnover-api (turnover by_model รายเดือน) + master-data-api (ราคา id=5 สิงห์ชัย, โปร, types)
// กฎ: ราคาปรับเฉพาะ "สิงห์ชัย ไฟแนนซ์" (price_type 5) · เงินดาวน์ออกแทน+ค่าคอมพิเศษ ใช้ร่วม ป.เปา/สิงห์ชัย
// ดูอย่างเดียว ไม่บันทึก DB
// ============================================================================
const ST_API = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-turnover-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const PRICE_ADJ = 5; // ราคาขายไฟแนนซ์ สิงห์ชัย = ราคาที่ปรับจริง
const N_MONTHS = 4;

const norm = (v) => String(v == null ? "" : v).replace(/\s+/g, "").toUpperCase();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const baht = (n) => (n == null || !Number.isFinite(Number(n)) ? "-" : Number(n).toLocaleString("th-TH"));

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => null);
  return Array.isArray(d) ? d : (d && d.data) || [];
}
// เดือนย้อนหลัง N เดือน (calendar month) สิ้นสุดเดือนปัจจุบัน
function lastMonths(n) {
  const now = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    let last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    if (last > now) last = now;
    out.push({
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${d.getMonth() + 1}/${String((d.getFullYear() + 543) % 100).padStart(2, "0")}`,
      from: iso(first), to: iso(last),
    });
  }
  return out;
}

// ราคา id=5 ต่อ type_id (server กรอง as_of แล้ว เก็บ effective ล่าสุด)
function buildAdjPrices(rows) {
  const m = {};
  for (const p of (Array.isArray(rows) ? rows : [])) {
    if (Number(p.price_type_id) !== PRICE_ADJ) continue;
    const eff = String(p.effective_date || "").slice(0, 10);
    if (!m[p.type_id] || eff > m[p.type_id].eff) m[p.type_id] = { amount: Number(p.amount), eff };
  }
  return m;
}

// วิเคราะห์ transition ล่าสุดที่มีการเปลี่ยนราคา/โปร → สรุปผลต่อยอดขาย
function analyze(series) {
  // series: [{ym,label,sold,price,promo}] เรียงเก่า→ใหม่
  let last = null;
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1], b = series[i];
    const pc = a.price != null && b.price != null && a.price !== b.price;
    const mc = a.promo != null && b.promo != null && a.promo !== b.promo;
    if (pc || mc) last = { a, b, dPrice: pc ? b.price - a.price : 0, dPromo: mc ? b.promo - a.promo : 0 };
  }
  if (!last) return { has: false, text: "ไม่มีการปรับราคา/โปรในช่วงนี้", tag: "none" };
  const { a, b, dPrice, dPromo } = last;
  const base = a.sold || 0;
  const dSales = (b.sold || 0) - base;
  const pct = base > 0 ? Math.round((dSales / base) * 100) : (dSales > 0 ? 100 : 0);
  const acts = [];
  if (dPrice < 0) acts.push(`ลดราคา ${baht(-dPrice)}`);
  if (dPrice > 0) acts.push(`ขึ้นราคา ${baht(dPrice)}`);
  if (dPromo > 0) acts.push(`เพิ่มโปร ${baht(dPromo)}`);
  if (dPromo < 0) acts.push(`ลดโปร ${baht(-dPromo)}`);
  const boostIntent = dPrice < 0 || dPromo > 0; // ตั้งใจกระตุ้นยอด
  let tag;
  if (boostIntent) tag = dSales > 0 ? "good" : (dSales < 0 ? "bad" : "flat");
  else if (dPrice > 0) tag = dSales >= 0 ? "good" : "bad"; // ขึ้นราคาแล้วยอดไม่ตก = ดี
  else tag = "flat";
  const resTxt = `ยอดขาย ${dSales >= 0 ? "+" : ""}${dSales} คัน (${pct >= 0 ? "+" : ""}${pct}%)`;
  return { has: true, text: `${a.label}→${b.label}: ${acts.join(" + ")} → ${resTxt}`, tag, pct, dSales };
}

const TAG = {
  good: { txt: "ได้ผล", color: "#15803d", bg: "#f0fdf4" },
  bad:  { txt: "ไม่ได้ผล", color: "#b91c1c", bg: "#fef2f2" },
  flat: { txt: "ไม่ขยับ", color: "#92400e", bg: "#fffbeb" },
  none: { txt: "—", color: "#6b7280", bg: "#f9fafb" },
};

export default function PriceImpactAnalysisPage() {
  const MONTHS = useMemo(() => lastMonths(N_MONTHS), []);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [seriesFilter, setSeriesFilter] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);

  const seriesOptions = useMemo(() => {
    const base = brandFilter === "ALL" ? rows : rows.filter((r) => r.brand === brandFilter);
    return [...new Set(base.map((r) => r.series).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "th"));
  }, [rows, brandFilter]);

  async function load() {
    setLoading(true); setMessage("");
    try {
      // ยอดขายรายเดือน = query เดียว (monthly_sales) · ราคา as_of สิ้นเดือน (เบา) · expenses + types ครั้งเดียว
      const rangeFrom = MONTHS[0].from, rangeTo = MONTHS[MONTHS.length - 1].to;
      const [salesRows, priceMonthsArr, expenses, types] = await Promise.all([
        post(ST_API, { action: "monthly_sales", date_from: rangeFrom, date_to: rangeTo }),
        Promise.all(MONTHS.map((m) => post(MASTER_API, { action: "get_moto_prices", as_of: m.to }))),
        post(MASTER_API, { action: "get_sale_expenses" }),
        post(MASTER_API, { action: "get_types" }),
      ]);
      const priceByMonth = priceMonthsArr.map(buildAdjPrices); // [mi] -> {type_id:{amount}}

      const typeByKey = {};
      for (const t of types) typeByKey[norm(t.model_code) + "|" + norm(t.type_name)] = t;

      // โปร (ค่าคอมพิเศษ + เงินดาวน์ออกแทน) ทุกระดับ + eff/end
      const isSalesPromo = (name) => { const n = String(name || ""); return n.includes("คอมพิเศษ") || n.includes("ดาวน์ออกแทน"); };
      const promoType = {}, promoSeries = {}, promoBrand = {};
      for (const e of expenses) {
        if (e.expense_type !== "promotion" || e.status !== "active" || !isSalesPromo(e.expense_name)) continue;
        const item = { amount: Number(e.amount) || 0, eff: String(e.effective_date || "").slice(0, 10), end: String(e.end_date || "").slice(0, 10) };
        if (e.group_by === "type" && e.type_id != null) (promoType[String(e.type_id)] || (promoType[String(e.type_id)] = [])).push(item);
        else if (e.group_by === "series") { const sid = String(e.note || "").split("|")[0]; if (sid) (promoSeries[sid] || (promoSeries[sid] = [])).push(item); }
        else if (e.group_by === "brand" && e.brand_id != null) (promoBrand[String(e.brand_id)] || (promoBrand[String(e.brand_id)] = [])).push(item);
      }
      const promoAt = (t, tid, D) => {
        const pool = [
          ...((tid != null && promoType[String(tid)]) || []),
          ...((t && promoSeries[String(t.series_id)]) || []),
          ...((t && promoBrand[String(t.brand_id)]) || []),
        ];
        return pool.filter((x) => (!x.eff || x.eff <= D) && (!x.end || x.end >= D)).reduce((s, x) => s + x.amount, 0);
      };

      // sold ต่อ (code|type) ต่อเดือน — จาก monthly_sales (query เดียว)
      const ymIndex = {}; MONTHS.forEach((m, i) => { ymIndex[m.ym] = i; });
      const soldByMonth = MONTHS.map(() => ({}));
      const meta = {};
      for (const r of (Array.isArray(salesRows) ? salesRows : [])) {
        const mi = ymIndex[r.ym]; if (mi == null) continue;
        const k = norm(r.code) + "|" + norm(r.type);
        soldByMonth[mi][k] = (soldByMonth[mi][k] || 0) + (Number(r.sold) || 0);
        if (!meta[k]) meta[k] = { brand: r.brand, code: r.code, type: r.type, model: r.model };
      }

      const out = Object.entries(meta).map(([k, mt]) => {
        const t = typeByKey[k];
        const tid = t ? t.type_id : null;
        const series = MONTHS.map((m, mi) => ({
          ym: m.ym, label: m.label,
          sold: soldByMonth[mi][k] || 0,
          price: (tid != null && priceByMonth[mi][tid]) ? priceByMonth[mi][tid].amount : null,
          promo: tid != null || t ? promoAt(t, tid, m.to) : null,
        }));
        const an = analyze(series);
        const totalSold = series.reduce((s, x) => s + x.sold, 0);
        return {
          key: mt.brand + "|" + k, brand: mt.brand, model: mt.model, code: mt.code, type: mt.type,
          series: t ? (t.marketing_name || t.series_name) : mt.model,
          months: series, analysis: an, totalSold,
        };
      });
      out.sort((a, b) => b.totalSold - a.totalSold);
      setRows(out);
      setMessage(`✅ ${out.length} รุ่น/แบบ · ${MONTHS[0].label}–${MONTHS[MONTHS.length - 1].label} · ราคา=สิงห์ชัย ไฟแนนซ์`);
    } catch (e) {
      setMessage("❌ โหลดไม่สำเร็จ: " + (e && e.message ? e.message : String(e)));
      setRows([]);
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const view = useMemo(() => {
    let v = rows;
    if (brandFilter !== "ALL") v = v.filter((r) => r.brand === brandFilter);
    if (seriesFilter) v = v.filter((r) => r.series === seriesFilter);
    if (onlyChanged) v = v.filter((r) => r.analysis.has);
    return v;
  }, [rows, brandFilter, seriesFilter, onlyChanged]);

  const th = { border: "1px solid #1e3a5f", padding: "7px 6px", fontSize: 12, color: "#fff", textAlign: "center", whiteSpace: "nowrap" };
  const td = { border: "1px solid #e5e7eb", padding: "5px 6px", fontSize: 12, verticalAlign: "top" };
  const delta = (cur, prev) => (prev == null || cur == null || cur === prev) ? "" : (cur > prev ? " ▲" : " ▼");

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📈 วิเคราะห์ผลราคา/โปร ต่อยอดขาย</h2>
        <button onClick={load} disabled={loading}
          style={{ padding: "8px 16px", background: loading ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
          {loading ? "กำลังโหลด..." : "🔄 ดึงข้อมูล"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        {["ALL", "HONDA", "YAMAHA"].map((b) => (
          <button key={b} onClick={() => { setBrandFilter(b); setSeriesFilter(""); }}
            className={brandFilter === b ? "btn-primary" : "btn-secondary"}>{b === "ALL" ? "ทั้งหมด" : b}</button>
        ))}
        <select value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}>
          <option value="">รุ่นทั้งหมด ({seriesOptions.length})</option>
          {seriesOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />
          เฉพาะที่มีการปรับราคา/โปร
        </label>
        <span style={{ fontSize: 13, color: "#374151", marginLeft: "auto" }}>แสดง {view.length} รายการ</span>
      </div>

      {message && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: message.startsWith("❌") ? "#fef2f2" : "#f0fdf4", color: message.startsWith("❌") ? "#b91c1c" : "#15803d", fontSize: 13 }}>{message}</div>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
          <thead>
            <tr style={{ background: "#0b2447" }}>
              <th style={{ ...th, textAlign: "left", minWidth: 150 }}>รุ่น / แบบ</th>
              {MONTHS.map((m) => <th key={m.ym} style={th} colSpan={1}>{m.label}<div style={{ fontSize: 9, color: "#9fb3d1", fontWeight: 400 }}>ขาย·ราคา·โปร</div></th>)}
              <th style={{ ...th, minWidth: 220 }}>วิเคราะห์ผลล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={MONTHS.length + 2} style={{ ...td, textAlign: "center", padding: 24 }}>กำลังโหลด...</td></tr>
            ) : view.length === 0 ? (
              <tr><td colSpan={MONTHS.length + 2} style={{ ...td, textAlign: "center", padding: 24, color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>
            ) : view.map((r) => {
              const tg = TAG[r.analysis.tag] || TAG.none;
              return (
                <tr key={r.key}>
                  <td style={{ ...td }}>
                    <div style={{ fontWeight: 700, color: r.brand === "HONDA" ? "#e2231a" : "#0a4ea2" }}>{r.series}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{r.code} {r.type}</div>
                  </td>
                  {r.months.map((mo, mi) => {
                    const prev = mi > 0 ? r.months[mi - 1] : null;
                    return (
                      <td key={mo.ym} style={{ ...td, textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: "#065f46" }}>{mo.sold}</div>
                        <div style={{ fontSize: 11, color: prev && mo.price !== prev.price ? "#dc2626" : "#374151" }}>
                          {baht(mo.price)}{delta(mo.price, prev?.price)}
                        </div>
                        <div style={{ fontSize: 11, color: prev && mo.promo !== prev.promo ? "#7c3aed" : "#9ca3af" }}>
                          โปร {baht(mo.promo)}{delta(mo.promo, prev?.promo)}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ ...td }}>
                    <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: tg.bg, color: tg.color, fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{tg.txt}</div>
                    <div style={{ fontSize: 11, color: "#374151" }}>{r.analysis.text}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
        * ราคา = ไฟแนนซ์ สิงห์ชัย (ราคาที่ปรับจริง) · โปร = ค่าคอมพิเศษ + เงินดาวน์ออกแทน (ใช้ร่วม ป.เปา/สิงห์ชัย) · ▲▼ = เทียบเดือนก่อน
        <br />* "วิเคราะห์ผลล่าสุด" = transition ล่าสุดที่มีการปรับราคา/โปร แล้วยอดขายตอบสนองอย่างไร (ใช้วางแผนเดือนถัดไป)
      </div>
    </div>
  );
}
