import React, { useEffect, useMemo, useRef, useState } from "react";

// ============================================================================
// ส่งรายงาน HONDA — ยอดขาย (ขายจริง moto_sales+retail_sales) + สินค้าคงเหลือ
// แถวมาจาก master รุ่น/แบบ/type/สี (master-data-api get_colors) จัดกลุ่ม รุ่น→แบบ→type→สี
// ช่องค้างส่ง = กรอกเอง · ช่องแผนการขาย = ช่องทึบเทา (disabled) · ดู+พิมพ์ (ไม่บันทึก DB)
// ============================================================================
const ST_API = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-turnover-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const HONDA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/honda-report-api";

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const norm = (v) => String(v == null ? "" : v).replace(/\s+/g, "").toUpperCase();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// ช่วงวางแผนสั่งซื้อตามรอบฮอนด้า: ขายวันที่ 21 เดือนก่อน → 20 เดือนปัจจุบัน (คงเหลือ/ค้างส่ง ณ วันที่ 20)
// ถ้าวันนี้เลยวันที่ 20 ไปแล้ว เลื่อนรอบไปจบวันที่ 20 เดือนถัดไป
const planWindow = () => {
  const d = new Date();
  const end = d.getDate() > 20 ? new Date(d.getFullYear(), d.getMonth() + 1, 20) : new Date(d.getFullYear(), d.getMonth(), 20);
  const start = new Date(end.getFullYear(), end.getMonth() - 1, 21);
  return { from: iso(start), to: iso(end) };
};

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => null);
  return Array.isArray(d) ? d : (d?.data || []);
}

export default function HondaSalesReportPage() {
  const [dateFrom, setDateFrom] = useState(() => planWindow().from);
  const [dateTo, setDateTo] = useState(() => planWindow().to);
  const [colors, setColors] = useState([]);     // master colors (HONDA)
  const [report, setReport] = useState([]);      // {model_code, type, color_code, sold_qty, stock_qty}
  const [backorder, setBackorder] = useState({}); // {key: number} กรอกเอง (ค้างส่ง)
  const [plan, setPlan] = useState({}); // {`${key}#${ci}`: number} แผนการขาย 3 ช่อง กรอกเอง (กล่องขาว)
  const [target, setTarget] = useState(200);  // เป้าขายเดือนนี้ (คัน) → คุมแผนเดือนนี้ (ci=0)
  const [target2, setTarget2] = useState(200); // เป้าขายเดือนหน้า (คัน) → กระจายแผนเดือนหน้า (ci=1)
  const [lockedNext, setLockedNext] = useState({}); // {norm(code)|norm(type):true} รุ่นที่ "ล็อก" คาดการณ์เดือนหน้า
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedPeriods, setSavedPeriods] = useState([]); // [{period,target_this,target_next,saved_at,rows}]
  const [hist, setHist] = useState({});       // {key: [s1,s2]} ยอดขาย 2 เดือนก่อน (s1=ล่าสุด, s2=ก่อนหน้า) สำหรับเทรนด์
  const [histLabels, setHistLabels] = useState([]); // [periodล่าสุด, periodก่อนหน้า] (label)
  const [message, setMessage] = useState("");
  const fileRef = useRef(null);

  async function loadMaster() {
    try {
      const c = await post(MASTER_API, { action: "get_colors" });
      setColors(Array.isArray(c) ? c : []);
    } catch { setColors([]); }
  }
  async function loadReport() {
    setLoading(true); setMessage("");
    try {
      const r = await post(ST_API, { action: "honda_report_data", date_from: dateFrom, date_to: dateTo, as_of: dateTo });
      setReport(Array.isArray(r) ? r : []);
    } catch { setReport([]); setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { loadMaster(); loadReport(); listPeriods(); /* eslint-disable-next-line */ }, []);

  // อัปโหลดแผ่นการสั่งซื้อ (.xls ที่ export จากระบบฮอนด้า = HTML table) → เติมช่อง "ยอดส่งรถค้างส่ง"
  // คอลัมน์: Model, Type, Color, ..., Delivery, Pending(=ค้างส่ง) · key = norm(model)|norm(type)|norm(color)
  async function onUploadPO(e) {
    const file = e.target.files && e.target.files[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setMessage("⏳ กำลังอ่านไฟล์แผ่นสั่งซื้อ...");
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const hi = rows.findIndex((r) => Array.isArray(r) && r.map((x) => String(x).trim().toLowerCase()).includes("pending"));
      if (hi < 0) { setMessage("❌ ไม่พบคอลัมน์ Pending ในไฟล์ (ตรวจว่าเป็นแผ่นการสั่งซื้อ)"); return; }
      const head = rows[hi].map((x) => String(x).trim().toLowerCase());
      const cM = head.indexOf("model"), cT = head.indexOf("type"), cC = head.indexOf("color"), cP = head.indexOf("pending");
      if (cM < 0 || cT < 0 || cC < 0 || cP < 0) { setMessage("❌ ไฟล์ไม่มีคอลัมน์ Model/Type/Color/Pending ครบ"); return; }
      const validKeys = new Set();
      for (const g of groups) for (const c of g.colors) validKeys.add(c.key);
      const next = {}; let total = 0, sum = 0, matched = 0, unmatched = [];
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i]; if (!Array.isArray(r)) continue;
        const m = norm(r[cM]); if (!m) continue;
        const pend = Number(r[cP]) || 0; if (!pend) continue;
        const key = m + "|" + norm(r[cT]) + "|" + norm(r[cC]);
        next[key] = String(pend); total++; sum += pend;
        if (validKeys.has(key)) matched++; else unmatched.push(`${r[cM]}/${r[cT]}/${r[cC]}`);
      }
      // แทนที่ค้างส่งทั้งหมดด้วยชุดใหม่ (snapshot ล่าสุดจากแผ่นสั่งซื้อ = real time)
      setBackorder(next);
      setMessage(`✅ อัปโหลดค้างส่งรวม ${sum} คัน (${total} รายการ · ตรงกับแถวขาย/สต๊อก ${matched}${unmatched.length ? ` · ค้างส่งล้วน(เพิ่มแถว) ${unmatched.length}: ${unmatched.slice(0, 4).join(", ")}${unmatched.length > 4 ? "…" : ""}` : ""})`);
    } catch (err) {
      setMessage("❌ อ่านไฟล์ไม่สำเร็จ: " + (err && err.message ? err.message : String(err)));
    }
  }

  // ===== บันทึก/โหลดฐานข้อมูล (honda-report-api) — period = วันสิ้นรอบ (dateTo, วันที่ 20) =====
  async function listPeriods() {
    try {
      const r = await post(HONDA_API, { action: "list_honda_periods" });
      const arr = Array.isArray(r) ? r : [];
      setSavedPeriods(arr);
      loadHistory(arr);
    } catch { /* เงียบ */ }
  }
  // โหลดยอดขาย 2 รอบล่าสุดที่บันทึกไว้ (ก่อนรอบปัจจุบัน) มาทำเทรนด์ — s1=ล่าสุด, s2=ก่อนหน้า
  async function loadHistory(periodsList) {
    const prior = (periodsList || []).filter((p) => p.period < dateTo).slice(0, 2); // savedPeriods เรียง desc แล้ว
    if (!prior.length) { setHist({}); setHistLabels([]); return; }
    try {
      const datas = await Promise.all(prior.map((p) => post(HONDA_API, { action: "get_honda_report", period: p.period })));
      const h = {};
      datas.forEach((rows, idx) => {
        for (const r of (Array.isArray(rows) ? rows : [])) {
          const key = norm(r.model_code) + "|" + norm(r.type) + "|" + norm(r.color_code);
          if (!h[key]) h[key] = [null, null];
          h[key][idx] = Number(r.sold_qty) || 0;
        }
      });
      setHist(h); setHistLabels(prior.map((p) => p.period));
    } catch { setHist({}); setHistLabels([]); }
  }
  async function saveReport() {
    if (!groups.length) { setMessage("⚠️ ไม่มีข้อมูลให้บันทึก (ดึงข้อมูลก่อน)"); return; }
    setSaving(true); setMessage("⏳ กำลังบันทึก...");
    try {
      const rows = [];
      for (const g of groups) {
        const locked = !!lockedNext[norm(g.code) + "|" + norm(g.type)];
        for (const c of g.colors) rows.push({
          model_code: g.code, type: g.type, color_code: c.color_code,
          sold_qty: c.sold, stock_qty: c.stock, backorder_qty: boOf(c.key),
          plan_this: planOf(c.key, 0), plan_next: planOf(c.key, 1), locked_next: locked,
        });
      }
      const res = await post(HONDA_API, {
        action: "save_honda_report", period: dateTo, target_this: Number(target) || 0, target_next: Number(target2) || 0,
        date_from: dateFrom, date_to: dateTo, rows,
      });
      const saved = (Array.isArray(res) && res[0] && res[0].saved_rows) || rows.length;
      await listPeriods();
      setMessage(`✅ บันทึกรอบ ${dateTo} แล้ว (${saved} แถว)`);
    } catch (err) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + (err && err.message ? err.message : String(err)));
    }
    setSaving(false);
  }
  async function loadSaved(period) {
    if (!period) return;
    setMessage("⏳ กำลังโหลดรอบ " + period + "...");
    try {
      const data = await post(HONDA_API, { action: "get_honda_report", period });
      if (!Array.isArray(data) || !data.length) { setMessage("⚠️ ไม่พบข้อมูลรอบ " + period); return; }
      const bo = {}, pl = {}, lock = {};
      let tThis = null, tNext = null, dFrom = null, dTo = null;
      for (const r of data) {
        const key = norm(r.model_code) + "|" + norm(r.type) + "|" + norm(r.color_code);
        if (Number(r.backorder_qty)) bo[key] = String(r.backorder_qty);
        if (Number(r.plan_this)) pl[`${key}#0`] = String(r.plan_this);
        if (Number(r.plan_next)) pl[`${key}#1`] = String(r.plan_next);
        if (r.locked_next === true || r.locked_next === "true" || r.locked_next === "t") lock[norm(r.model_code) + "|" + norm(r.type)] = true;
        if (tThis == null && r.target_this != null) tThis = r.target_this;
        if (tNext == null && r.target_next != null) tNext = r.target_next;
        if (!dFrom && r.date_from) dFrom = r.date_from;
        if (!dTo && r.date_to) dTo = r.date_to;
      }
      if (tThis != null) setTarget(tThis);
      if (tNext != null) setTarget2(tNext);
      if (dFrom) setDateFrom(dFrom);
      if (dTo) setDateTo(dTo);
      setBackorder(bo); setPlan(pl); setLockedNext(lock);
      setMessage(`✅ โหลดรอบ ${period} แล้ว (${data.length} แถว) — กด "ดึงข้อมูล" เพื่อรีเฟรชยอดขาย/คงเหลือตามช่วงวันที่`);
    } catch (err) {
      setMessage("❌ โหลดไม่สำเร็จ: " + (err && err.message ? err.message : String(err)));
    }
  }

  // เคลียร์ช่องกรอกทั้งหมด (ค้างส่ง/แผน/ล็อก/เป้า) — ยอดขาย/คงเหลือยังอยู่ตามที่ดึง
  function clearForm() {
    if (!window.confirm("เคลียร์ช่องกรอกทั้งหมด? (ค้างส่ง / แผน 2 เดือน / ล็อกเดือนหน้า / เป้า)\nยอดขายและสินค้าคงเหลือยังอยู่")) return;
    setBackorder({}); setPlan({}); setLockedNext({}); setTarget(200); setTarget2(200);
    setMessage("🧹 เคลียร์ช่องกรอกแล้ว (ค้างส่ง/แผน/ล็อก/เป้า กลับค่าเริ่มต้น)");
  }

  // map ข้อมูลขาย/คงเหลือ ตาม (model_code|type|color_code)
  const reportMap = useMemo(() => {
    const m = {};
    for (const r of report) m[norm(r.model_code) + "|" + norm(r.type) + "|" + norm(r.color_code)] = r;
    return m;
  }, [report]);

  // จัดกลุ่ม รุ่น(series) → แบบ(model_code) → type → สี
  // รวมแถวจาก (1) master HONDA active + (2) ข้อมูลขายจริง honda_report_data — เพราะ master เก็บ type ฐาน "TH"
  // แต่ขาย/คงเหลือ/ค้างส่งจริงมี type ย่อย (2TH,3TH,TH1..) ต้องเอาแถว type ย่อยจากข้อมูลจริงมาด้วย ไม่งั้นนับขายขาด
  const groups = useMemo(() => {
    const map = new Map();
    const seen = new Set();
    const seriesByCode = {};   // norm(model_code) → ชื่อรุ่น(series)
    const colorNameByMC = {};  // norm(model_code)|norm(color_code) → ชื่อสี
    const grp = (run, code, type) => {
      const gk = run + "|" + code + "|" + type;
      if (!map.has(gk)) map.set(gk, { run, code, type, colors: [] });
      return map.get(gk);
    };
    // (1) master — ให้ชื่อรุ่น/ชื่อสี และแถวรุ่นที่ยังไม่มีความเคลื่อนไหว
    for (const c of colors) {
      if (!/honda|ฮอนด้า/i.test(String(c.brand_name || ""))) continue;
      if (c.status && c.status !== "active") continue;
      const run = c.series_name || c.marketing_name || "-";
      const code = c.model_code || "-";
      const type = c.type_name || "-";
      seriesByCode[norm(code)] = run;
      colorNameByMC[norm(code) + "|" + norm(c.color_code)] = c.color_name;
      const key = norm(code) + "|" + norm(type) + "|" + norm(c.color_code);
      if (seen.has(key)) continue;
      seen.add(key);
      const dat = reportMap[key] || {};
      grp(run, code, type).colors.push({
        key, color_code: c.color_code, color_name: c.color_name,
        sold: Number(dat.sold_qty) || 0, stock: Number(dat.stock_qty) || 0,
      });
    }
    // (2) ข้อมูลจริง (HONDA-only) — เพิ่มแถว type/สี ที่ master ไม่มี
    for (const r of report) {
      const code = r.model_code || "-";
      const type = r.type || "-";
      const cc = r.color_code || "";
      const key = norm(code) + "|" + norm(type) + "|" + norm(cc);
      if (seen.has(key)) continue;
      seen.add(key);
      grp(seriesByCode[norm(code)] || code, code, type).colors.push({
        key, color_code: cc, color_name: colorNameByMC[norm(code) + "|" + norm(cc)] || "",
        sold: Number(r.sold_qty) || 0, stock: Number(r.stock_qty) || 0,
      });
    }
    // (3) เก็บตกค้างส่งที่อัปโหลด แต่ไม่มีทั้งขาย/สต๊อก/master (รถค้างส่งล้วน) → ให้ยอดรวมค้างส่งตรง
    for (const key of Object.keys(backorder)) {
      if (seen.has(key) || !(Number(backorder[key]) || 0)) continue;
      seen.add(key);
      const [code = "-", type = "-", cc = ""] = key.split("|");
      grp(seriesByCode[norm(code)] || code, code, type).colors.push({
        key, color_code: cc, color_name: colorNameByMC[norm(code) + "|" + norm(cc)] || "",
        sold: 0, stock: 0,
      });
    }
    const arr = [...map.values()];
    for (const g of arr) g.colors.sort((a, b) => String(a.color_code).localeCompare(String(b.color_code), "th"));
    return arr.sort((a, b) => (a.run + a.code + a.type).localeCompare(b.run + b.code + b.type, "th"));
  }, [colors, report, reportMap, backorder]);

  // demand รายสี = ยอดขายเดือนปัจจุบัน + โมเมนตัม (เทรนด์เทียบเดือนก่อน)
  //   demand = max(0, sold + 0.4×(sold − ขายเดือนก่อน))  → รุ่นโตได้เพิ่ม รุ่นร่วงโดนหั่น
  const demandOf = (key, sold) => {
    const h = hist[key];
    const s1 = h && h[0] != null ? h[0] : null;
    if (s1 == null) return sold;
    return Math.max(0, sold + 0.4 * (sold - s1));
  };
  const trendOf = (key, sold) => {
    const h = hist[key]; const s1 = h && h[0] != null ? h[0] : null;
    if (s1 == null || sold === s1) return "→";
    return sold > s1 ? "↑" : "↓";
  };
  // แนะนำสั่งซื้อรายสี — เทรนด์ + คาลิเบรต cover (ลดจาก ×2 เพราะประวัติชี้ว่าสั่งเกิน ~2 เท่า ขายได้ครึ่งเดียว)
  // sell% = ขาย÷(ขาย+คงเหลือ) · ≥80%→cover 1.3× · 50-79%→1.1× · <50%→0 (ระบายของเดิม)
  // แนะนำสั่ง = max(0, demand×cover − คงเหลือ − ค้างส่ง)
  const recoOrder = (key, sold, stock, back) => {
    const tot = sold + stock;
    if (tot <= 0) return 0;
    const sell = sold / tot;
    const cover = sell >= 0.8 ? 1.3 : sell >= 0.5 ? 1.1 : 0;
    if (!cover) return 0;
    return Math.max(0, Math.round(demandOf(key, sold) * cover - stock - (Number(back) || 0)));
  };
  const sellPct = (sold, stock) => (sold + stock > 0 ? Math.round((sold / (sold + stock)) * 100) : null);
  const sellColor = (p) => (p == null ? "#9ca3af" : p >= 80 ? "#059669" : p >= 50 ? "#d97706" : "#dc2626");

  // ดับเบิลคลิกชื่อรุ่น → ล็อก/ปลดล็อก คาดการณ์เดือนหน้าของรุ่นนั้น (พร้อมล้างค่าที่กรอกไว้ของรุ่นนั้น)
  function toggleLockNext(gid, g) {
    setLockedNext((s) => { const n = { ...s }; if (n[gid]) delete n[gid]; else n[gid] = true; return n; });
    setPlan((s) => { const n = { ...s }; for (const c of g.colors) delete n[`${c.key}#1`]; return n; });
  }

  // กระจายเป้า T ตามน้ำหนัก weights แบบ largest-remainder ให้รวม = T พอดี (ข้ามแถวน้ำหนัก 0)
  const allocByWeight = (weights, T) => {
    const totW = weights.reduce((a, b) => a + b, 0);
    if (!totW || !T) return weights.map(() => 0);
    const raw = weights.map((w) => (T * w) / totW);
    const base = raw.map((x) => Math.floor(x));
    let rem = T - base.reduce((a, b) => a + b, 0);
    const order = weights.map((_, i) => i).sort((a, b) => (raw[b] - base[b]) - (raw[a] - base[a]));
    for (const i of order) { if (rem <= 0) break; if (weights[i] <= 0) continue; base[i]++; rem--; }
    return base;
  };

  // ปุ่มแนะนำ: เติม 2 ช่อง — เดือนนี้(ci=0)=แนะนำสั่งซื้อ(velocity cover − สต๊อก − ค้างส่ง, คุมด้วยเป้าเดือนนี้)
  //                        เดือนหน้า(ci=1)=กระจายเป้าเดือนหน้าตามยอดขาย(velocity)
  function autoPlan() {
    const cells = [];
    for (const g of groups) {
      const lockNext = !!lockedNext[norm(g.code) + "|" + norm(g.type)];
      for (const c of g.colors) cells.push({ key: c.key, reco: recoOrder(c.key, c.sold, c.stock, boOf(c.key)), demand: demandOf(c.key, c.sold), lockNext });
    }
    const rawTot = cells.reduce((a, x) => a + x.reco, 0);
    if (!cells.length || (!rawTot && !cells.some((x) => x.demand))) { setMessage("⚠️ ไม่มีข้อมูลสำหรับคำนวณ (ดึงข้อมูลก่อน)"); return; }
    // เดือนนี้ — แนะนำสั่ง (เทรนด์+คาลิเบรต) คุมไม่เกินเป้าเดือนนี้
    const cap = Math.max(0, Math.round(Number(target) || 0));
    let v0 = cells.map((x) => x.reco);
    if (cap && rawTot > cap) v0 = allocByWeight(cells.map((x) => x.reco), cap);
    const sum0 = v0.reduce((a, b) => a + b, 0);
    // เดือนหน้า — กระจายเป้าตาม demand (เทรนด์) · ข้ามรุ่นที่ล็อก
    const T1 = Math.max(0, Math.round(Number(target2) || 0));
    const v1 = allocByWeight(cells.map((x) => (x.lockNext ? 0 : x.demand)), T1);
    const sum1 = v1.reduce((a, b) => a + b, 0);
    setPlan((s) => {
      const next = { ...s };
      cells.forEach((c, i) => {
        next[`${c.key}#0`] = v0[i] ? String(v0[i]) : "";
        if (T1 && !c.lockNext) next[`${c.key}#1`] = v1[i] ? String(v1[i]) : "";
      });
      return next;
    });
    const trendNote = histLabels.length ? ` · ใช้เทรนด์ ${histLabels.length} เดือน` : " · (ยังไม่มีประวัติ ใช้เดือนเดียว)";
    setMessage(`✅ เดือนนี้ ${sum0} คัน (เทรนด์+คาลิเบรต · หักค้างส่ง${cap && rawTot > cap ? ` · คุมเป้า ${cap}` : ""})${T1 ? ` · เดือนหน้า ${sum1} คัน` : ""}${trendNote} — แก้รายแถวได้`);
  }

  const boOf = (k) => Number(backorder[k]) || 0;
  const planOf = (k, ci) => Number(plan[`${k}#${ci}`]) || 0;
  const sumPlan = (cols, ci) => cols.reduce((a, c) => a + planOf(c.key, ci), 0);
  const grand = useMemo(() => {
    let s = 0, st = 0, bo = 0; const p = [0, 0, 0];
    for (const g of groups) for (const c of g.colors) { s += c.sold; st += c.stock; bo += boOf(c.key); for (let ci = 0; ci < 3; ci++) p[ci] += planOf(c.key, ci); }
    return { sold: s, stock: st, bo, p };
  }, [groups, backorder, plan]);

  // หัวคอลัมน์ตามวันที่
  const dF = new Date(dateFrom), dT = new Date(dateTo);
  const saleHdr = `ยอดขายวันที่ ${dF.getDate()}-${dT.getDate()} ${TH_MONTHS[dT.getMonth()]} ${dT.getFullYear() + 543}`;
  const stockHdr = `สินค้าคงเหลือ ณ วันที่ ${dT.getDate()} ${TH_MONTHS[dT.getMonth()]} ${dT.getFullYear() + 543}`;
  const m1 = `${TH_MONTHS[dT.getMonth()]} ${dT.getFullYear() + 543}`;
  const m2d = new Date(dT.getFullYear(), dT.getMonth() + 1, 1);
  const m2 = `${TH_MONTHS[m2d.getMonth()]} ${m2d.getFullYear() + 543}`;

  function printReport() {
    const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    let rows = "", idx = 0;
    for (const g of groups) {
      idx++;
      const lockNext = !!lockedNext[norm(g.code) + "|" + norm(g.type)];
      const gLabel = `${esc(g.run)} [ซีรี่ย์: ${esc(g.run)}]<br>${idx}. ${esc(g.code)} (${esc(g.type)})`;
      g.colors.forEach((c, i) => {
        rows += `<tr>${i === 0 ? `<td rowspan="${g.colors.length + 1}" class="run">${gLabel}</td>` : ""}
          <td>${esc(c.color_code)} (${esc(c.color_name)})</td>
          <td class="c">${c.sold || 0}</td><td class="c">${c.stock || 0}</td><td class="c">${boOf(c.key) || 0}</td>
          <td class="c">${planOf(c.key, 0) || 0}</td>${lockNext ? `<td class="g"></td>` : `<td class="c">${planOf(c.key, 1) || 0}</td>`}<td class="c">${planOf(c.key, 2) || 0}</td></tr>`;
      });
      const gs = g.colors.reduce((a, c) => a + c.sold, 0), gst = g.colors.reduce((a, c) => a + c.stock, 0), gbo = g.colors.reduce((a, c) => a + boOf(c.key), 0);
      rows += `<tr class="sum"><td>รวม</td><td class="c">${gs}</td><td class="c">${gst}</td><td class="c">${gbo}</td><td class="gs">${sumPlan(g.colors, 0) || ""}</td>${lockNext ? `<td class="g"></td>` : `<td class="gs">${sumPlan(g.colors, 1) || ""}</td>`}<td class="gs">${sumPlan(g.colors, 2) || ""}</td></tr>`;
    }
    const w = window.open("", "_blank", "width=1100,height=800"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายงานยอดขาย HONDA</title>
<style>@page{size:A4 portrait;margin:8mm} body{font-family:Tahoma,sans-serif;font-size:11px} h3{text-align:center;margin:4px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #888;padding:3px 5px} th{background:#caa300;color:#000;font-size:10px}
.c{text-align:center} .run{background:#fafafa;font-weight:600} .sum{background:#fde68a;font-weight:700} .g{background:#bbb} .gs{background:#bbb;text-align:right}</style></head><body>
<h3>รายงานยอดขายรถจักรยานยนต์ HONDA</h3>
<table><thead><tr><th>รุ่นรถ</th><th>สี</th><th>${esc(saleHdr)}</th><th>${esc(stockHdr)}</th><th>ยอดส่งรถค้างส่ง</th><th>แผน ${esc(m1)}</th><th>ขายปกติ ${esc(m2)}</th><th>Direct Sales</th></tr></thead>
<tbody>${rows}<tr class="sum"><td colspan="2">รวมสุทธิ</td><td class="c">${grand.sold}</td><td class="c">${grand.stock}</td><td class="c">${grand.bo}</td><td class="gs">${grand.p[0] || ""}</td><td class="gs">${grand.p[1] || ""}</td><td class="gs">${grand.p[2] || ""}</td></tr></tbody></table>
</body></html>`);
    w.document.close(); setTimeout(() => w.print(), 350);
  }

  const yBox = { width: 56, padding: "3px 5px", border: "1px solid #d4af37", background: "#fffbea", textAlign: "right", fontSize: 12, borderRadius: 3 };
  const wBox = { width: 56, padding: "3px 5px", border: "1px solid #cbd5e1", background: "#fff", textAlign: "right", fontSize: 12, borderRadius: 3 };
  const grayBox = { width: 56, height: 22, background: "#b8b8b8", borderRadius: 3, display: "inline-block" };
  const graySum = { width: 56, padding: "3px 5px", background: "#b8b8b8", color: "#1f2937", textAlign: "right", fontSize: 11, borderRadius: 3, display: "inline-block" };
  const tdc = { border: "1px solid #d1d5db", padding: "4px 6px", textAlign: "center", fontSize: 12 };

  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="page-title">📋 ส่งรายงาน HONDA (ยอดขาย/คงเหลือ)</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select value="" onChange={(e) => { loadSaved(e.target.value); e.target.value = ""; }} title="โหลดรอบที่บันทึกไว้" style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
            <option value="">📂 โหลดรอบที่บันทึก ({savedPeriods.length})</option>
            {savedPeriods.map((p) => <option key={p.period} value={p.period}>{p.period} · {p.rows} แถว · เป้า {p.target_this}/{p.target_next}</option>)}
          </select>
          <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv,.htm,.html" onChange={onUploadPO} style={{ display: "none" }} />
          <button onClick={() => fileRef.current && fileRef.current.click()} title="อัปโหลดแผ่นการสั่งซื้อ (.xls จากระบบฮอนด้า) → เติมช่องยอดส่งรถค้างส่งอัตโนมัติ" style={{ padding: "8px 18px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>📤 อัปโหลดค้างส่ง</button>
          <button onClick={saveReport} disabled={saving} title="บันทึกรายงานรอบนี้ลงฐานข้อมูล (period = วันสิ้นรอบ)" style={{ padding: "8px 18px", background: saving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>{saving ? "⏳ บันทึก..." : "💾 บันทึกลงฐานข้อมูล"}</button>
          <button onClick={clearForm} title="เคลียร์ช่องกรอกทั้งหมด (ค้างส่ง/แผน/ล็อก/เป้า) — ยอดขาย/คงเหลือยังอยู่" style={{ padding: "8px 18px", background: "#fff", color: "#b45309", border: "1px solid #f59e0b", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>🧹 เคลียร์</button>
          <button onClick={printReport} style={{ padding: "8px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>🖨️ พิมพ์</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontWeight: 600 }}>📅 ยอดขายช่วง:</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} />
        <span style={{ fontSize: 12, color: "#6b7280" }}>· คงเหลือ ณ วันสิ้นสุด</span>
        <button onClick={loadReport} disabled={loading} style={{ padding: "8px 18px", background: loading ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>{loading ? "⏳ โหลด..." : "🔍 ดึงข้อมูล"}</button>
        <span style={{ width: 1, alignSelf: "stretch", background: "#e5e7eb", margin: "0 2px" }} />
        <span style={{ fontWeight: 600 }}>🎯 เป้าขาย</span>
        <input type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="ไม่จำกัด" title={`เป้าขายเดือนนี้ (${m1}) — คุมยอดแนะนำสั่งซื้อช่องแผนเดือนนี้ · เว้นว่าง=ดันสุด`} style={{ width: 72, padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, textAlign: "right" }} />
        <span style={{ fontSize: 12, color: "#6b7280" }}>เดือนนี้ ({m1})</span>
        <input type="number" min="0" value={target2} onChange={(e) => setTarget2(e.target.value)} placeholder="0" title={`เป้าขายเดือนหน้า (${m2}) — กระจายตามยอดขายลงช่องแผนเดือนหน้า`} style={{ width: 72, padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, textAlign: "right" }} />
        <span style={{ fontSize: 12, color: "#6b7280" }}>เดือนหน้า ({m2})</span>
        <button onClick={autoPlan} title="แนะนำสั่งซื้อตาม sell-through: รถขายดี×2 / ขายดี×1.5 / รถช้า=0 ลบสต๊อก ลบค้างส่ง → เติมช่องแผนเดือนนี้ + เดือนหน้า" style={{ padding: "8px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>📊 แนะนำสั่งซื้อ (เน้นรถวิ่ง)</button>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#374151" }}>รวมขาย <b style={{ color: "#059669" }}>{grand.sold}</b> · คงเหลือ <b style={{ color: "#0369a1" }}>{grand.stock}</b> · แผนนี้ <b style={{ color: "#7c3aed" }}>{grand.p[0]}</b> · แผนหน้า <b style={{ color: "#7c3aed" }}>{grand.p[1]}</b></span>
      </div>
      {message && <div style={{ padding: "8px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, marginBottom: 10 }}>{message}</div>}

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#caa300", color: "#000" }}>
            <tr>
              <th style={{ ...tdc, textAlign: "left" }}>รุ่นรถ</th>
              <th style={tdc}>สี</th>
              <th style={tdc}>{saleHdr}</th>
              <th style={tdc}>{stockHdr}</th>
              <th style={tdc}>ยอดส่งรถค้างส่ง<br /><span style={{ fontSize: 10, fontWeight: 400 }}>(Update Real Time)</span></th>
              <th style={tdc}>แผนการขายทั้งเดือน<br />{m1}</th>
              <th style={tdc}>ขายปกติ<br />{m2}</th>
              <th style={tdc}>Direct Sales</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล (เช็ค master สี HONDA)</td></tr>
            ) : groups.map((g, gi) => {
              const gs = g.colors.reduce((a, c) => a + c.sold, 0), gst = g.colors.reduce((a, c) => a + c.stock, 0), gbo = g.colors.reduce((a, c) => a + boOf(c.key), 0);
              const gid = norm(g.code) + "|" + norm(g.type);
              const lockNext = !!lockedNext[gid];
              return (
                <React.Fragment key={g.run + g.code + g.type}>
                  {g.colors.map((c, i) => (
                    <tr key={c.key} style={{ borderTop: "1px solid #f1f5f9" }}>
                      {i === 0 && (
                        <td rowSpan={g.colors.length + 1} onDoubleClick={() => toggleLockNext(gid, g)} title="ดับเบิลคลิก = ล็อก/ปลดล็อก คาดการณ์เดือนหน้า (รุ่นที่ฮอนด้าล็อกโควตา)" style={{ ...tdc, textAlign: "left", background: lockNext ? "#ede9fe" : "#fafafa", verticalAlign: "top", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                          <div style={{ color: "#9ca3af", fontSize: 11 }}>{g.run} [ซีรี่ย์: {g.run}]</div>
                          <div style={{ fontWeight: 700 }}>{gi + 1}. {g.code} ({g.type})</div>
                          {lockNext && <div style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed" }}>🔒 ล็อกเดือนหน้า</div>}
                        </td>
                      )}
                      <td style={{ ...tdc, textAlign: "left" }}>{c.color_code} ({c.color_name})</td>
                      <td style={tdc}>
                        <span style={{ ...yBox, display: "inline-block" }}>{c.sold || 0}</span>
                        {sellPct(c.sold, c.stock) != null && <div style={{ fontSize: 9, fontWeight: 700, color: sellColor(sellPct(c.sold, c.stock)) }}>ขายออก {sellPct(c.sold, c.stock)}%</div>}
                        {hist[c.key] && hist[c.key][0] != null && (
                          <div style={{ fontSize: 9, color: trendOf(c.key, c.sold) === "↑" ? "#059669" : trendOf(c.key, c.sold) === "↓" ? "#dc2626" : "#9ca3af" }}>
                            {hist[c.key][1] != null ? hist[c.key][1] + "→" : ""}{hist[c.key][0]}→<b>{c.sold}</b> {trendOf(c.key, c.sold)}
                          </div>
                        )}
                      </td>
                      <td style={tdc}><span style={{ ...yBox, display: "inline-block" }}>{c.stock || 0}</span></td>
                      <td style={tdc}>
                        <input type="number" min="0" value={backorder[c.key] ?? ""} onChange={(e) => setBackorder((s) => ({ ...s, [c.key]: e.target.value }))} style={yBox} />
                      </td>
                      {[0, 1, 2].map((ci) => (
                        <td key={ci} style={tdc}>
                          {ci === 1 && lockNext
                            ? <span style={grayBox} title="ล็อก — คาดการณ์เดือนหน้าไม่ได้" />
                            : <input type="number" min="0" value={plan[`${c.key}#${ci}`] ?? ""} onChange={(e) => setPlan((s) => ({ ...s, [`${c.key}#${ci}`]: e.target.value }))} style={wBox} />}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ background: "#fde68a", fontWeight: 700 }}>
                    <td style={{ ...tdc, textAlign: "center" }}>รวม</td>
                    <td style={tdc}>{gs}</td>
                    <td style={tdc}>{gst}</td>
                    <td style={tdc}>{gbo}</td>
                    {[0, 1, 2].map((ci) => (<td key={ci} style={tdc}>{ci === 1 && lockNext ? <span style={grayBox} /> : <span style={graySum}>{sumPlan(g.colors, ci) || ""}</span>}</td>))}
                  </tr>
                </React.Fragment>
              );
            })}
            {groups.length > 0 && (
              <tr style={{ background: "#fbbf24", fontWeight: 800 }}>
                <td style={{ ...tdc, textAlign: "center" }} colSpan={2}>รวมสุทธิ</td>
                <td style={tdc}>{grand.sold}</td>
                <td style={tdc}>{grand.stock}</td>
                <td style={tdc}>{grand.bo}</td>
                {[0, 1, 2].map((ci) => (<td key={ci} style={tdc}><span style={graySum}>{grand.p[ci] || ""}</span></td>))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
