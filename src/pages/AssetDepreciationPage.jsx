import React, { useEffect, useMemo, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/asset-api";

const AFFILIATIONS = ["ป.เปา", "สิงห์ชัย"];
const TH_STATUS = { active: "ใช้งานอยู่", paused: "พักการใช้งาน", retired: "เลิกใช้แล้ว" };

const fmt = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = v => {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return "-";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;

// คำนวณค่าเสื่อมของสินทรัพย์ 1 ตัว สำหรับงวดปี (1 ม.ค. - 31 ธ.ค.) — วิธีเดียวกับตาราง FlowAccount:
// เส้นตรง (ราคา−ซาก)/ปี ปันตามวันจริงแบบนับรวมวันแรก (inclusive) ÷365 · เพดานรวม = มูลค่าที่คิดค่าเสื่อม
// ยกมา: ต่อยอดจาก accum_bf_amount ณ accum_bf_date · เลิกใช้หยุดที่ retired_date
function depForYear(a, year) {
  const price = r2(a.purchase_price);
  const salvage = r2(a.salvage_value);
  const years = Number(a.useful_life_years) || 0;
  const enabled = !(a.enable_depreciation === false || String(a.enable_depreciation) === "false");
  const depBase = Math.max(0, r2(price - salvage));
  const start = a.start_use_date ? new Date(String(a.start_use_date).slice(0, 10)) : null;
  const bfAmt = r2(a.accum_bf_amount);
  const bfDate = a.accum_bf_date ? new Date(String(a.accum_bf_date).slice(0, 10)) : null;
  const noDep = !enabled || !(years > 0) || !start;
  if (noDep) {
    const accum = Math.min(bfAmt, depBase);
    return { accum_bf: accum, book_bf: r2(price - accum), pct: 0, days: 0, dep: 0, accum_cf: accum, book_cf: r2(price - accum) };
  }
  const annual = depBase / years;
  const base = (bfAmt > 0 && bfDate) ? bfDate : start;
  // ค่าเสื่อมสะสม ณ สิ้นวัน d (นับวันแบบ inclusive ตาม FLOW: 1 ม.ค.→31 ธ.ค. = 365 วัน)
  const accumAt = (d) => {
    const days = Math.floor((d - base) / 86400000) + 1;
    if (days <= 0) return Math.min(bfAmt, depBase);
    return Math.min(depBase, r2(bfAmt + annual * days / 365));
  };
  const accum_bf = accumAt(new Date(year - 1, 11, 31));
  const yStart = new Date(year, 0, 1), yEnd = new Date(year, 11, 31);
  const from = start > yStart ? start : yStart;
  let to = yEnd;
  if (a.status === "retired" && a.retired_date) {
    const rd = new Date(String(a.retired_date).slice(0, 10));
    if (rd < to) to = rd;
  }
  let days = Math.floor((to - from) / 86400000) + 1;
  if (days < 0) days = 0;
  let dep = Math.min(r2(annual * days / 365), Math.max(0, r2(depBase - accum_bf)));
  if (dep <= 0) { dep = 0; if (accum_bf >= depBase - 0.005) days = 0; }
  const accum_cf = r2(accum_bf + dep);
  return { accum_bf, book_bf: r2(price - accum_bf), pct: 100 / years, days, dep: r2(dep), accum_cf, book_cf: r2(price - accum_cf) };
}

// ฟังก์ชันค่าเสื่อมสะสม ณ สิ้นวันใด ๆ ของสินทรัพย์ 1 ตัว (ตรรกะเดียวกับ depForYear) — null = ไม่คิดค่าเสื่อม
function accumFnOf(a) {
  const price = r2(a.purchase_price);
  const salvage = r2(a.salvage_value);
  const years = Number(a.useful_life_years) || 0;
  const enabled = !(a.enable_depreciation === false || String(a.enable_depreciation) === "false");
  const depBase = Math.max(0, r2(price - salvage));
  const start = a.start_use_date ? new Date(String(a.start_use_date).slice(0, 10)) : null;
  const bfAmt = r2(a.accum_bf_amount);
  const bfDate = a.accum_bf_date ? new Date(String(a.accum_bf_date).slice(0, 10)) : null;
  if (!enabled || !(years > 0) || !start) return null;
  const annual = depBase / years;
  const base = (bfAmt > 0 && bfDate) ? bfDate : start;
  const retired = (a.status === "retired" && a.retired_date) ? new Date(String(a.retired_date).slice(0, 10)) : null;
  return (d) => {
    const dd = (retired && retired < d) ? retired : d;
    const days = Math.floor((dd - base) / 86400000) + 1;
    if (days <= 0) return Math.min(bfAmt, depBase);
    return Math.min(depBase, r2(bfAmt + annual * days / 365));
  };
}

// บันทึกค่าเสื่อมราคา — ตารางคำนวณค่าเสื่อมรายปีตามแบบ FlowAccount + แท็บสรุปบัญชีค่าเสื่อม
export default function AssetDepreciationPage({ currentUser }) {
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [filterAff, setFilterAff] = useState("");
  const [tab, setTab] = useState("table");
  const [collapsed, setCollapsed] = useState({});
  const [monthOpen, setMonthOpen] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  async function post(body) {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const [a, c] = await Promise.all([
        post({ action: "list_assets" }),
        post({ action: "list_asset_categories", include_inactive: "true" }),
      ]);
      setAssets((Array.isArray(a) ? a : []).filter(r => r && r.asset_id));
      setCategories((Array.isArray(c) ? c : []).filter(r => r && r.category_id));
    } catch { setMessage("❌ โหลดไม่สำเร็จ"); setAssets([]); setCategories([]); }
    setLoading(false);
  }

  // จัดกลุ่มตามหมวด + คำนวณค่าเสื่อมของปีที่เลือก
  const { groups, totals, months, monthsTotal } = useMemo(() => {
    const list = assets.filter(a => !filterAff || String(a.affiliation || "") === filterAff);
    const byCat = new Map();
    list.forEach(a => {
      const key = a.category_name || "ไม่ระบุหมวดหมู่";
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push({ ...a, calc: depForYear(a, year) });
    });
    // เรียงหมวดตามลำดับใน master (ตามรหัสบัญชี) — หมวดที่ไม่พบ ต่อท้าย
    const order = categories.map(c => c.category_name);
    const keys = [...byCat.keys()].sort((x, y) => {
      const ix = order.indexOf(x), iy = order.indexOf(y);
      return (ix < 0 ? 999 : ix) - (iy < 0 ? 999 : iy);
    });
    const gs = keys.map(k => {
      const items = byCat.get(k);
      const sub = items.reduce((s, it) => ({
        price: r2(s.price + r2(it.purchase_price)),
        accum_bf: r2(s.accum_bf + it.calc.accum_bf),
        book_bf: r2(s.book_bf + it.calc.book_bf),
        dep: r2(s.dep + it.calc.dep),
        accum_cf: r2(s.accum_cf + it.calc.accum_cf),
        book_cf: r2(s.book_cf + it.calc.book_cf),
      }), { price: 0, accum_bf: 0, book_bf: 0, dep: 0, accum_cf: 0, book_cf: 0 });
      return { name: k, items, sub, cat: categories.find(c => c.category_name === k) };
    });
    const tot = gs.reduce((s, g) => ({
      count: s.count + g.items.length,
      price: r2(s.price + g.sub.price),
      accum_bf: r2(s.accum_bf + g.sub.accum_bf),
      book_bf: r2(s.book_bf + g.sub.book_bf),
      dep: r2(s.dep + g.sub.dep),
      accum_cf: r2(s.accum_cf + g.sub.accum_cf),
      book_cf: r2(s.book_cf + g.sub.book_cf),
    }), { count: 0, price: 0, accum_bf: 0, book_bf: 0, dep: 0, accum_cf: 0, book_cf: 0 });
    // รายเดือน (แท็บบันทึกบัญชี): ค่าเสื่อมของเดือน = สะสม ณ สิ้นเดือน − สะสม ณ สิ้นเดือนก่อน
    const fns = list.map(a => ({ a, fn: accumFnOf(a) })).filter(x => x.fn);
    const months = Array.from({ length: 12 }, (_, m) => {
      const end = new Date(year, m + 1, 0);
      const prevEnd = new Date(year, m, 0);
      const byCatM = new Map();
      fns.forEach(({ a, fn }) => {
        const dep = r2(fn(end) - fn(prevEnd));
        if (dep <= 0) return;
        const key = a.category_name || "ไม่ระบุหมวดหมู่";
        byCatM.set(key, r2((byCatM.get(key) || 0) + dep));
      });
      const cats = [...byCatM.entries()]
        .sort((x, y) => {
          const ix = order.indexOf(x[0]), iy = order.indexOf(y[0]);
          return (ix < 0 ? 999 : ix) - (iy < 0 ? 999 : iy);
        })
        .map(([name, dep]) => ({ name, dep, cat: categories.find(c => c.category_name === name) }));
      return { month: m, end, cats, total: r2(cats.reduce((s, c) => s + c.dep, 0)) };
    }).filter(mo => mo.total > 0);
    const monthsTotal = r2(months.reduce((s, mo) => s + mo.total, 0));
    return { groups: gs, totals: tot, months, monthsTotal };
  }, [assets, categories, year, filterAff]);

  async function downloadExcel() {
    try {
      const XLSX = await import("xlsx");
      const aoa = [
        [`ตารางคำนวณค่าเสื่อมราคา ${filterAff || "ทุกสังกัด"} — 1 มกราคม ถึง 31 ธันวาคม ${year}`],
        [],
        ["รหัสสินทรัพย์", "ชื่อสินทรัพย์", "เลขที่อ้างอิง", "สังกัด", "วันที่เริ่มต้นใช้งาน", "ราคาซื้อ", "ค่าเสื่อมราคาสะสมยกมา", "มูลค่าตามบัญชียกมา", "ค่าเสื่อมต่อปี (%)", "อายุการใช้งาน (ปี)", "มูลค่าซาก", "จำนวนวัน", "ค่าเสื่อมราคาของงวด", "ค่าเสื่อมราคาสะสมยกไป", "มูลค่าตามบัญชียกไป", "สถานะ"],
      ];
      groups.forEach(g => {
        aoa.push([`${g.name} (${g.items.length} รายการ)`]);
        g.items.forEach(a => {
          const c = a.calc;
          aoa.push([a.asset_code || "", a.asset_name, a.reference_no || "", a.affiliation || "", fmtDate(a.start_use_date), r2(a.purchase_price), c.accum_bf, c.book_bf, c.pct ? r2(c.pct) / 100 : 0, Number(a.useful_life_years) || 0, r2(a.salvage_value), c.days, c.dep, c.accum_cf, c.book_cf, TH_STATUS[a.status] || a.status || ""]);
        });
        aoa.push(["", "", "", "", "ยอดรวม", g.sub.price, g.sub.accum_bf, g.sub.book_bf, "", "", "", "", g.sub.dep, g.sub.accum_cf, g.sub.book_cf, ""]);
      });
      aoa.push([]);
      aoa.push(["", "", "", "", "รวมทั้งสิ้น", totals.price, totals.accum_bf, totals.book_bf, "", "", "", "", totals.dep, totals.accum_cf, totals.book_cf, ""]);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DepreciationReport");
      XLSX.writeFile(wb, `DepreciationReport_${filterAff || "all"}_${year}.xlsx`);
    } catch { setMessage("❌ ดาวน์โหลด Excel ไม่สำเร็จ"); }
  }

  const yearTH = year + 543;

  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 className="page-title">📉 บันทึกค่าเสื่อมราคา</h2>
        <button onClick={downloadExcel} disabled={loading || totals.count === 0}
          style={{ padding: "7px 16px", background: "#fff", color: "#0284c7", border: "1px solid #0284c7", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          ⬇️ ดาวน์โหลดเป็น Excel
        </button>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 0 }}>
        {[{ key: "table", label: "ตารางคำนวณค่าเสื่อมราคา" }, { key: "journal", label: "บันทึกบัญชีค่าเสื่อมราคา" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "9px 18px", border: "1px solid #e5e7eb", borderBottom: "none", borderRadius: "8px 8px 0 0", cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 700 : 400, background: tab === t.key ? "#fff" : "#f1f5f9", color: tab === t.key ? "#0284c7" : "#6b7280" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "0 10px 10px 10px", padding: "14px 16px" }}>
        {/* Period + summary */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>ช่วงเวลาที่ต้องการคิดค่าเสื่อม</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setYear(y => y - 1)} style={navBtn}>‹</button>
              <span style={{ fontSize: 14, fontWeight: 600 }}>01 มกราคม - 31 ธันวาคม {year} ({yearTH})</span>
              <button onClick={() => setYear(y => y + 1)} style={navBtn}>›</button>
            </div>
          </div>
          <select value={filterAff} onChange={e => setFilterAff(e.target.value)} style={{ ...inp, width: 130, alignSelf: "flex-end" }}>
            <option value="">ทุกสังกัด</option>
            {AFFILIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={fetchData} disabled={loading} style={{ ...navBtn, alignSelf: "flex-end", width: "auto", padding: "6px 14px" }}>🔄 รีเฟรช</button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 26, textAlign: "right" }}>
            <div>
              <div style={sumLbl}>รวมรายการสินทรัพย์</div>
              <div style={{ ...sumVal, color: "#374151" }}>{totals.count} รายการ</div>
            </div>
            <div>
              <div style={sumLbl}>รวมค่าเสื่อมราคาของงวด</div>
              <div style={{ ...sumVal, color: "#0f172a" }}>{fmt(totals.dep)}</div>
            </div>
            <div>
              <div style={sumLbl}>รวมราคาตามบัญชีใหม่</div>
              <div style={{ ...sumVal, color: "#0284c7" }}>{fmt(totals.book_cf)}</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : totals.count === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>ไม่มีสินทรัพย์ — เพิ่มได้ที่เมนู "รายการสินทรัพย์"</div>
        ) : tab === "table" ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 1150 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>รหัสสินทรัพย์</th>
                  <th style={th}>ชื่อสินทรัพย์</th>
                  <th style={th}>วันที่เริ่มใช้งาน</th>
                  <th style={thR}>ราคาซื้อ</th>
                  <th style={thR}>ค่าเสื่อมราคาสะสมยกมา</th>
                  <th style={thR}>ราคาตามบัญชียกมา</th>
                  <th style={thR}>ค่าเสื่อมต่อปี (%)</th>
                  <th style={thR}>มูลค่าซาก</th>
                  <th style={thR}>จำนวนวัน</th>
                  <th style={thR}>ค่าเสื่อมราคาของงวด</th>
                  <th style={thR}>ค่าเสื่อมสะสมยกไป</th>
                  <th style={thR}>ราคาตามบัญชียกไป</th>
                  <th style={th}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <React.Fragment key={g.name}>
                    <tr onClick={() => setCollapsed(c => ({ ...c, [g.name]: !c[g.name] }))}
                      style={{ background: "#c7d7ec", fontWeight: 700, color: "#072d6b", cursor: "pointer", borderTop: "1px solid #94a3b8" }}>
                      <td style={{ ...td, textAlign: "left" }} colSpan={3}>
                        {collapsed[g.name] ? "▸" : "▾"} {g.name} <span style={{ background: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11, marginLeft: 4 }}>{g.items.length}</span>
                      </td>
                      <td style={tdR}>{fmt(g.sub.price)}</td>
                      <td style={tdR}>{fmt(g.sub.accum_bf)}</td>
                      <td style={tdR}>{fmt(g.sub.book_bf)}</td>
                      <td style={tdR}></td>
                      <td style={tdR}></td>
                      <td style={tdR}></td>
                      <td style={{ ...tdR, color: "#b91c1c" }}>{fmt(g.sub.dep)}</td>
                      <td style={tdR}>{fmt(g.sub.accum_cf)}</td>
                      <td style={{ ...tdR, color: "#0284c7" }}>{fmt(g.sub.book_cf)}</td>
                      <td style={td}></td>
                    </tr>
                    {!collapsed[g.name] && g.items.map(a => {
                      const c = a.calc;
                      return (
                        <tr key={a.asset_id} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ ...td, fontFamily: "monospace" }}>{a.asset_code || "-"}</td>
                          <td style={{ ...td, minWidth: 220 }}>
                            {a.asset_name}
                            {a.affiliation && !filterAff && <span style={{ marginLeft: 6, fontSize: 10, color: "#9ca3af" }}>({a.affiliation})</span>}
                          </td>
                          <td style={td}>{fmtDate(a.start_use_date)}</td>
                          <td style={tdR}>{fmt(a.purchase_price)}</td>
                          <td style={tdR}>{fmt(c.accum_bf)}</td>
                          <td style={tdR}>{fmt(c.book_bf)}</td>
                          <td style={tdR}>{c.pct ? fmt(c.pct) + "%" : "ไม่คิดค่าเสื่อม"}</td>
                          <td style={tdR}>{fmt(a.salvage_value)}</td>
                          <td style={tdR}>{c.days ? c.days.toLocaleString("th-TH") : "0"}</td>
                          <td style={{ ...tdR, fontWeight: 600, color: c.dep ? "#b91c1c" : "#9ca3af" }}>{fmt(c.dep)}</td>
                          <td style={tdR}>{fmt(c.accum_cf)}</td>
                          <td style={{ ...tdR, fontWeight: 600, color: "#0284c7" }}>{fmt(c.book_cf)}</td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>{TH_STATUS[a.status] || a.status || "-"}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#bfdbfe", fontWeight: 700, color: "#072d6b", borderTop: "2px solid #072d6b" }}>
                  <td style={{ ...td, textAlign: "left" }} colSpan={3}>รวมทั้งสิ้น {totals.count} รายการ</td>
                  <td style={tdR}>{fmt(totals.price)}</td>
                  <td style={tdR}>{fmt(totals.accum_bf)}</td>
                  <td style={tdR}>{fmt(totals.book_bf)}</td>
                  <td colSpan={3}></td>
                  <td style={{ ...tdR, color: "#b91c1c" }}>{fmt(totals.dep)}</td>
                  <td style={tdR}>{fmt(totals.accum_cf)}</td>
                  <td style={{ ...tdR, color: "#0284c7" }}>{fmt(totals.book_cf)}</td>
                  <td style={td}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* ===== แท็บบันทึกบัญชีค่าเสื่อมราคา — รายการบันทึกรายเดือนแบบ FLOW ===== */
          <div>
            <div style={{ marginBottom: 10, padding: "8px 14px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
              ℹ️ รายการลงบัญชีค่าเสื่อมราคารายเดือน งวด 1 ม.ค. - 31 ธ.ค. {year} — บันทึกทุกสิ้นเดือน เดบิต ค่าเสื่อมราคา (58xxx) / เครดิต ค่าเสื่อมราคาสะสม (18xxx) · คลิกที่แถวเดือนเพื่อดูรายละเอียดแยกตามหมวด (ยังไม่ผูกกับระบบบัญชีอัตโนมัติ ใช้เป็นข้อมูลตั้งรายการในโปรแกรมบัญชี)
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 800 }}>
                <thead style={{ background: "#072d6b", color: "#fff" }}>
                  <tr>
                    <th style={{ ...th, width: 50 }}>ลำดับ</th>
                    <th style={th}>วันที่บันทึก</th>
                    <th style={th}>คำอธิบายรายการ</th>
                    <th style={thR}>ค่าเสื่อมราคาที่บันทึก</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((mo, i) => (
                    <React.Fragment key={mo.month}>
                      <tr onClick={() => setMonthOpen(o => ({ ...o, [mo.month]: !o[mo.month] }))}
                        style={{ borderTop: "1px solid #e5e7eb", cursor: "pointer", background: monthOpen[mo.month] ? "#f0f9ff" : "#fff" }}>
                        <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(mo.end)}</td>
                        <td style={td}>{monthOpen[mo.month] ? "▾" : "▸"} บันทึกรายการค่าเสื่อมสำหรับงวด {String(mo.month + 1).padStart(2, "0")}-{year}</td>
                        <td style={{ ...tdR, fontFamily: "monospace", fontWeight: 700 }}>{fmt(mo.total)}</td>
                      </tr>
                      {monthOpen[mo.month] && (
                        <tr>
                          <td style={{ padding: "0 8px 10px 58px", background: "#f0f9ff" }} colSpan={4}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#fff", border: "1px solid #bae6fd" }}>
                              <thead style={{ background: "#e0f2fe", color: "#075985" }}>
                                <tr>
                                  <th style={th}>หมวดหมู่สินทรัพย์</th>
                                  <th style={th}>เดบิต — บัญชีค่าเสื่อมราคา</th>
                                  <th style={th}>เครดิต — บัญชีค่าเสื่อมราคาสะสม</th>
                                  <th style={thR}>จำนวนเงิน</th>
                                </tr>
                              </thead>
                              <tbody>
                                {mo.cats.map(c => (
                                  <tr key={c.name} style={{ borderTop: "1px solid #f1f5f9" }}>
                                    <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                                    <td style={td}>{c.cat && (c.cat.depreciation_account_code || c.cat.depreciation_account_name) ? `${c.cat.depreciation_account_code || "-"} / ${c.cat.depreciation_account_name || "-"}` : <span style={{ color: "#dc2626" }}>⚠️ ยังไม่ตั้งผังบัญชี</span>}</td>
                                    <td style={td}>{c.cat && (c.cat.accum_depreciation_account_code || c.cat.accum_depreciation_account_name) ? `${c.cat.accum_depreciation_account_code || "-"} / ${c.cat.accum_depreciation_account_name || "-"}` : <span style={{ color: "#dc2626" }}>⚠️ ยังไม่ตั้งผังบัญชี</span>}</td>
                                    <td style={{ ...tdR, fontFamily: "monospace" }}>{fmt(c.dep)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#e0f2fe", fontWeight: 700, borderTop: "2px solid #0284c7" }}>
                    <td style={td} colSpan={3}>รวมค่าเสื่อมราคาที่บันทึกทั้งปี</td>
                    <td style={{ ...tdR, fontFamily: "monospace", fontSize: 14 }}>{fmt(monthsTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>
              * ค่าเสื่อมของเดือน = ค่าเสื่อมสะสม ณ สิ้นเดือน − ณ สิ้นเดือนก่อน (ปันตามวันจริง ÷365 เหมือนตารางคำนวณ) · ตั้งรหัสบัญชีของแต่ละหมวดได้ที่เมนู "ตั้งค่าหมวดหมู่สินทรัพย์" · เดือนที่ค่าเสื่อม = 0 จะไม่แสดง
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 11, color: "#9ca3af" }}>
          * คำนวณแบบเส้นตรง (ราคาซื้อ − มูลค่าซาก) ÷ อายุการใช้งาน ปันส่วนตามจำนวนวันจริงของงวด ÷ 365 (นับรวมวันเริ่ม เหมือนรายงาน FlowAccount) · สินทรัพย์ยกมาคิดต่อจากค่าเสื่อมสะสมยกมา ณ วันที่ยกมา — การดูปีย้อนหลังก่อนปีที่ยกยอดจะไม่สะท้อนตัวเลขจริงของปีนั้น · สถานะเลิกใช้หยุดคิดค่าเสื่อมที่วันที่เลิกใช้
        </div>
      </div>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const navBtn = { width: 30, height: 30, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#374151" };
const sumLbl = { fontSize: 12, fontWeight: 700, color: "#374151" };
const sumVal = { fontSize: 20, fontFamily: "Tahoma", fontWeight: 700, marginTop: 2 };
const th = { padding: "9px 8px", textAlign: "left", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" };
const thR = { padding: "9px 8px", textAlign: "right", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "7px 8px", textAlign: "left" };
const tdR = { padding: "7px 8px", textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" };
