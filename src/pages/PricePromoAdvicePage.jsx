import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// รายงานแนะนำปรับราคา/ค่าส่งเสริม — อิงยอดขาย·อัตราหมุน·เทรนด์·สต๊อก (HONDA+YAMAHA)
// รวมข้อมูลจาก: stock-turnover-api (turnover by_model) + master-data-api (ราคา/โปร/types)
// แนะนำ "ทิศทาง + ระดับ + เหตุผล" — ไม่ฟันธงตัวเลข (ดู+พิมพ์ ไม่บันทึก DB)
// ============================================================================
const ST_API = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-turnover-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const PRICE_FACTORY = 1; // ราคาขายแนะนำ = ราคาประกาศโรงงาน (อ้างอิง ไม่ปรับ)
const PRICE_ADJ = 5;     // ไฟแนนซ์ สิงห์ชัย = ราคาที่ปรับขึ้น-ลงจริง (Honda ปรับเฉพาะตัวนี้ · Yamaha ปรับทุกราคา)

const norm = (v) => String(v == null ? "" : v).replace(/\s+/g, "").toUpperCase();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayISO = () => iso(new Date());
const baht = (n) => (n == null || !Number.isFinite(Number(n)) ? "-" : Number(n).toLocaleString("th-TH"));

// รอบ 21 เดือนก่อน→20 เดือนปัจจุบัน + รอบก่อนหน้า (สำหรับเทรนด์)
function windows() {
  const d = new Date();
  const end = d.getDate() > 20 ? new Date(d.getFullYear(), d.getMonth() + 1, 20) : new Date(d.getFullYear(), d.getMonth(), 20);
  const start = new Date(end.getFullYear(), end.getMonth() - 1, 21);
  const pend = new Date(end.getFullYear(), end.getMonth() - 1, 20);
  const pstart = new Date(end.getFullYear(), end.getMonth() - 2, 21);
  return { from: iso(start), to: iso(end), pfrom: iso(pstart), pto: iso(pend) };
}

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => null);
  return Array.isArray(d) ? d : (d && d.data) || [];
}
const byModel = (rows) => (Array.isArray(rows) ? rows : []).filter((r) => r && r.kind === "by_model").map((r) => r.data);

// ===== ตรรกะแนะนำ =====
// sell% = ขาย/(ขาย+สต๊อก) · mos = เดือนคงคลัง (สต๊อก/ยอดขายต่อเดือน) · เทรนด์ = ขายนี้ vs ก่อน
function advise(sold, prev, stock, promo, received) {
  const tot = sold + stock;
  const sell = tot > 0 ? sold / tot : 0;
  const mos = sold > 0 ? stock / sold : stock > 0 ? 9 : 0;
  const up = prev != null && sold > prev * 1.15;
  const dn = prev != null && sold < prev * 0.7;
  const hasPromo = promo > 0;
  const rationed = received != null && sold >= 3 && received < sold * 0.5; // ดีมานด์มาก แต่รับเข้าน้อย = โดนจำกัดโควตา

  let pr; // promo
  if (rationed) pr = { dir: "cut", level: "มาก", reason: "ขายดีแต่ของเข้าน้อย (โดนจำกัดโควตา) — ตัดโปร เอางบไปรุ่นที่ระบายได้" };
  else if (sell >= 0.8 || (up && mos < 1)) pr = { dir: hasPromo ? "down" : "hold", level: sell >= 0.9 ? "มาก" : "กลาง", reason: "ขายดี/ของขาด — ไม่ต้องกระตุ้น" + (hasPromo ? " ลดโปรประหยัดงบ" : "") };
  else if (sell < 0.4 && mos >= 2) pr = { dir: "up", level: mos >= 4 ? "มาก" : "กลาง", reason: `ของจม ~${mos.toFixed(1)} เดือน — เพิ่มโปรกระตุ้นระบาย` };
  else if (dn) pr = { dir: "up", level: "กลาง", reason: "ยอดขายร่วง — เพิ่มโปรพยุงยอด" };
  else pr = { dir: "hold", level: "-", reason: "สมดุล — คงโปร" };

  let pc; // price
  if (sell >= 0.85 && mos < 0.7 && !dn) pc = { dir: "up", level: "น้อย", reason: "ดีมานด์ล้น ของขาด — ขยับราคาขึ้นได้" };
  else if (sell < 0.35 && mos >= 2.5) pc = { dir: "down", level: mos >= 4 ? "กลาง" : "น้อย", reason: "ของค้างนาน — ลดราคาช่วยระบาย" };
  else pc = { dir: "hold", level: "-", reason: "คงราคา" };

  return { sell, mos, trend: up ? "↑" : dn ? "↓" : "→", promo: pr, price: pc };
}

const DIR = {
  up: { txt: "เพิ่ม", color: "#dc2626", bg: "#fef2f2" },
  down: { txt: "ลด", color: "#0369a1", bg: "#eff6ff" },
  cut: { txt: "ตัด", color: "#7c3aed", bg: "#f5f3ff" },
  hold: { txt: "คง", color: "#6b7280", bg: "#f9fafb" },
};
function AdviceBadge({ a }) {
  const d = DIR[a.dir] || DIR.hold;
  return (
    <div style={{ background: d.bg, border: `1px solid ${d.color}33`, borderRadius: 8, padding: "5px 8px", textAlign: "left" }}>
      <div style={{ fontWeight: 800, color: d.color, fontSize: 13 }}>{d.txt}{a.level !== "-" ? ` · ${a.level}` : ""}</div>
      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}>{a.reason}</div>
    </div>
  );
}

export default function PricePromoAdvicePage() {
  const W = windows();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL"); // ALL | HONDA | YAMAHA
  const [seriesFilter, setSeriesFilter] = useState(""); // "" = ทุกรุ่น
  const [onlyAction, setOnlyAction] = useState(false); // แสดงเฉพาะรุ่นที่มีคำแนะนำให้เปลี่ยน

  // ตัวเลือกรุ่นใน dropdown (เฉพาะยี่ห้อที่เลือก)
  const seriesOptions = useMemo(() => {
    const base = brandFilter === "ALL" ? rows : rows.filter((r) => r.brand === brandFilter);
    return [...new Set(base.map((r) => r.series).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "th"));
  }, [rows, brandFilter]);

  async function load() {
    setLoading(true); setMessage("");
    try {
      const [thCur, tyCur, thPrev, tyPrev, prices, expenses, types] = await Promise.all([
        post(ST_API, { action: "turnover", brand: "HONDA", date_from: W.from, date_to: W.to }),
        post(ST_API, { action: "turnover", brand: "YAMAHA", date_from: W.from, date_to: W.to }),
        post(ST_API, { action: "turnover", brand: "HONDA", date_from: W.pfrom, date_to: W.pto }),
        post(ST_API, { action: "turnover", brand: "YAMAHA", date_from: W.pfrom, date_to: W.pto }),
        post(MASTER_API, { action: "get_moto_prices" }),
        post(MASTER_API, { action: "get_sale_expenses" }),
        post(MASTER_API, { action: "get_types" }),
      ]);

      // type_id lookup จาก (model_code|type_name)
      const typeByKey = {}; const typeById = {};
      for (const t of types) {
        typeByKey[norm(t.model_code) + "|" + norm(t.type_name)] = t;
        typeById[t.type_id] = t;
      }
      // ราคาแนะนำล่าสุดต่อ type_id (effective_date <= วันนี้, เอาล่าสุด)
      const today = todayISO();
      const priceByType = {}; // type_id → {factory:{amount,eff}, adj:{amount,eff}}
      for (const p of prices) {
        const lv = Number(p.price_type_id);
        if (lv !== PRICE_FACTORY && lv !== PRICE_ADJ) continue;
        const eff = String(p.effective_date || "").slice(0, 10);
        if (eff && eff > today) continue;
        const slot = lv === PRICE_FACTORY ? "factory" : "adj";
        const rec = priceByType[p.type_id] || (priceByType[p.type_id] = {});
        if (!rec[slot] || eff > rec[slot].eff) rec[slot] = { amount: Number(p.amount), eff };
      }
      // กรองด้วย "ชื่อโปร" = ค่าคอมพิเศษ / เงินดาวน์ออกแทน (โปรที่มีผลต่อยอดขายจริง)
      // อยู่ได้หลายระดับ (type/series/brand) · ไม่เอาค่าประกัน/อื่น ๆ
      const isSalesPromo = (name) => { const n = String(name || ""); return n.includes("คอมพิเศษ") || n.includes("ดาวน์ออกแทน"); };
      const promoByType = {}, promoBySeries = {}, promoByBrand = {};
      for (const e of expenses) {
        if (e.expense_type !== "promotion" || e.status !== "active") continue;
        if (!isSalesPromo(e.expense_name)) continue;
        const eff = String(e.effective_date || "").slice(0, 10), end = String(e.end_date || "").slice(0, 10);
        if (eff && eff > today) continue;
        if (end && end < today) continue;
        const item = { name: e.expense_name, amount: Number(e.amount) || 0 };
        if (e.group_by === "type" && e.type_id != null) (promoByType[String(e.type_id)] || (promoByType[String(e.type_id)] = [])).push(item);
        else if (e.group_by === "series") { const sid = String(e.note || "").split("|")[0]; if (sid) (promoBySeries[sid] || (promoBySeries[sid] = [])).push(item); }
        else if (e.group_by === "brand" && e.brand_id != null) (promoByBrand[String(e.brand_id)] || (promoByBrand[String(e.brand_id)] = [])).push(item);
      }

      // รวม turnover เป็นระดับ (model_code|type) ต่อยี่ห้อ
      function aggregate(curRows, prevRows, brand) {
        const cur = {}, prev = {};
        for (const r of byModel(curRows)) {
          const k = norm(r.code) + "|" + norm(r.type);
          if (!cur[k]) cur[k] = { code: r.code, type: r.type, model: r.model, sold: 0, stock: 0, received: 0 };
          cur[k].sold += Number(r.sold_qty) || 0; cur[k].stock += Number(r.stock_end_qty) || 0; cur[k].received += Number(r.received_qty) || 0;
        }
        for (const r of byModel(prevRows)) {
          const k = norm(r.code) + "|" + norm(r.type);
          prev[k] = (prev[k] || 0) + (Number(r.sold_qty) || 0);
        }
        return Object.entries(cur).map(([k, v]) => {
          const t = typeByKey[k];
          const tid = t ? t.type_id : null;
          const pinfo = tid != null ? priceByType[tid] : null;
          const priceAdj = pinfo && pinfo.adj && Number.isFinite(pinfo.adj.amount) ? pinfo.adj.amount : null;
          const priceFactory = pinfo && pinfo.factory && Number.isFinite(pinfo.factory.amount) ? pinfo.factory.amount : null;
          // ค่าคอม/เงินดาวน์ออกแทน ที่ใช้กับรุ่นนี้ — รวมทุกระดับ (type + รุ่น/series + ยี่ห้อ/brand)
          const promoItems = [
            ...((tid != null && promoByType[String(tid)]) || []),
            ...((t && promoBySeries[String(t.series_id)]) || []),
            ...((t && promoByBrand[String(t.brand_id)]) || []),
          ];
          const promo = promoItems.reduce((s, x) => s + x.amount, 0);
          const promoTotal = promo;
          const a = advise(v.sold, prev[k] != null ? prev[k] : null, v.stock, promo, v.received);
          return {
            brand, key: brand + "|" + k, model: v.model, code: v.code, type: v.type,
            series: t ? t.marketing_name || t.series_name : v.model,
            sold: v.sold, soldPrev: prev[k] != null ? prev[k] : null, stock: v.stock, received: v.received,
            price: priceAdj, priceFactory, promo, promoTotal, promoItems, ...a,
          };
        });
      }
      const all = [...aggregate(thCur, thPrev, "HONDA"), ...aggregate(tyCur, tyPrev, "YAMAHA")];
      all.sort((a, b) => b.sold - a.sold);
      setRows(all);
      const matchPrice = all.filter((r) => r.price != null).length;
      setMessage(`✅ ${all.length} รุ่น/แบบ · มีราคา ${matchPrice} · ช่วงขาย ${W.from} ถึง ${W.to} (เทียบรอบก่อน ${W.pfrom}–${W.pto})`);
    } catch (e) {
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + (e && e.message ? e.message : String(e)));
      setRows([]);
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const view = useMemo(() => {
    let v = rows;
    if (brandFilter !== "ALL") v = v.filter((r) => r.brand === brandFilter);
    if (seriesFilter) v = v.filter((r) => r.series === seriesFilter);
    if (onlyAction) v = v.filter((r) => r.promo.dir !== "hold" || r.price.dir !== "hold");
    return v;
  }, [rows, brandFilter, seriesFilter, onlyAction]);

  const th = { border: "1px solid #1e3a5f", padding: "8px 6px", fontSize: 12, color: "#fff", textAlign: "center" };
  const td = { border: "1px solid #e5e7eb", padding: "6px 8px", fontSize: 12, textAlign: "center" };

  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 className="page-title">💡 แนะนำปรับราคา / ค่าส่งเสริม (อิงยอดขาย·อัตราหมุน)</h2>
        <button onClick={load} disabled={loading} style={{ padding: "8px 18px", background: loading ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>{loading ? "⏳ โหลด..." : "🔄 ดึงข้อมูล"}</button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "10px 0 12px", padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontWeight: 600 }}>ยี่ห้อ:</span>
        {["ALL", "HONDA", "YAMAHA"].map((b) => (
          <button key={b} onClick={() => { setBrandFilter(b); setSeriesFilter(""); }} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", cursor: "pointer", fontWeight: 700, background: brandFilter === b ? "#1e3a5f" : "#fff", color: brandFilter === b ? "#fff" : "#374151" }}>{b === "ALL" ? "ทั้งหมด" : b}</button>
        ))}
        <select value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)} style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, minWidth: 170, background: "#fff", cursor: "pointer" }}>
          <option value="">🔻 รุ่นทั้งหมด ({seriesOptions.length})</option>
          {seriesOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={onlyAction} onChange={(e) => setOnlyAction(e.target.checked)} /> เฉพาะที่ควรปรับ
        </label>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#374151" }}>แสดง <b>{view.length}</b> รายการ</span>
      </div>
      {message && <div style={{ padding: "8px 12px", background: "#f0fdf4", color: "#166534", borderRadius: 6, marginBottom: 10, fontSize: 13 }}>{message}</div>}

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1050 }}>
          <thead style={{ background: "#1e3a5f" }}>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>รุ่น / แบบ</th>
              <th style={th}>ขาย<br />(30วัน)</th>
              <th style={th}>เทรนด์<br />(vs ก่อน)</th>
              <th style={th}>สต๊อก</th>
              <th style={th}>ขายออก%</th>
              <th style={th}>เดือน<br />คงคลัง</th>
              <th style={th}>ราคาโรงงาน<br /><span style={{ fontSize: 9, fontWeight: 400 }}>(แนะนำ-อ้างอิง)</span></th>
              <th style={th}>ราคาขายปัจจุบัน<br /><span style={{ fontSize: 9, fontWeight: 400 }}>(สิงห์ชัย ไฟแนนซ์)</span></th>
              <th style={th}>โปรปัจจุบัน</th>
              <th style={{ ...th, width: 200 }}>💰 แนะนำค่าส่งเสริม</th>
              <th style={{ ...th, width: 200 }}>🏷️ แนะนำราคา</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
            ) : view.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>
            ) : view.map((r) => (
              <tr key={r.key} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ ...td, textAlign: "left" }}>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{r.brand}</span><br />
                  <b>{r.series}</b> <span style={{ color: "#6b7280" }}>{r.code} ({r.type})</span>
                </td>
                <td style={td}><b>{r.sold}</b></td>
                <td style={{ ...td, color: r.trend === "↑" ? "#059669" : r.trend === "↓" ? "#dc2626" : "#9ca3af", fontWeight: 700 }}>{r.soldPrev != null ? `${r.soldPrev}→${r.sold} ${r.trend}` : "-"}</td>
                <td style={td}>{r.stock}</td>
                <td style={{ ...td, fontWeight: 700, color: r.sell >= 0.8 ? "#059669" : r.sell >= 0.5 ? "#d97706" : "#dc2626" }}>{Math.round(r.sell * 100)}%</td>
                <td style={td}>{r.sold > 0 ? r.mos.toFixed(1) : r.stock > 0 ? "∞" : "-"}</td>
                <td style={{ ...td, textAlign: "right", color: "#6b7280" }}>{baht(r.priceFactory)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{baht(r.price)}</td>
                <td style={{ ...td, textAlign: "left", fontSize: 11 }} title={r.promoItems.map((x) => `${x.name} ${baht(x.amount)}`).join("\n")}>
                  {r.promoItems.length === 0 ? <span style={{ color: "#9ca3af" }}>-</span> : (
                    <>
                      <div style={{ fontWeight: 700, textAlign: "right" }}>{baht(r.promoTotal)}</div>
                      {r.promoItems.slice(0, 3).map((x, i) => <div key={i} style={{ color: "#6b7280", fontSize: 9, whiteSpace: "nowrap" }}>{x.name} {baht(x.amount)}</div>)}
                      {r.promoItems.length > 3 && <div style={{ fontSize: 9, color: "#9ca3af" }}>+{r.promoItems.length - 3} อื่น ๆ</div>}
                    </>
                  )}
                </td>
                <td style={td}><AdviceBadge a={r.promo} /></td>
                <td style={td}>
                  <AdviceBadge a={r.price} />
                  {r.price.dir !== "hold" && <div style={{ fontSize: 9, color: "#7c3aed", marginTop: 2 }}>{r.brand === "HONDA" ? "↳ ปรับเฉพาะ ฟn.สิงห์ชัย" : "↳ ปรับได้ทุกราคา"}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
        💡 เกณฑ์: ขายออก% = ขาย÷(ขาย+สต๊อก) · เดือนคงคลัง = สต๊อก÷ยอดขายต่อเดือน · "ขายดี/ของขาด"→ลดโปร/ขึ้นราคาได้ · "ของจม"→เพิ่มโปร/ลดราคา · "โดนจำกัดโควตา"→ตัดโปรเอางบไปรุ่นอื่น
        <br />🏷️ ราคา: <b>HONDA</b> ปรับเฉพาะ <b>ไฟแนนซ์ สิงห์ชัย</b> (ราคาอื่นคงที่ — ถ้าจะเพิ่มมูลค่าใช้ของแถม เช่น ประกัน = เพิ่มโปรแทน) · <b>YAMAHA</b> ปรับได้ทุกราคา · ราคาโรงงาน(แนะนำ) = ราคาประกาศ ไม่ปรับ
      </div>
    </div>
  );
}
