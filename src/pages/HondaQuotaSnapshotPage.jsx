import React, { useEffect, useMemo, useRef, useState } from "react";

// ===== โควต้า HONDA (DOSS) — เก็บ snapshot ไฟล์ 32116_YYYYMM.xls ทุกครั้งที่ upload แล้วเทียบว่า Honda ขยับโควต้ารุ่นไหน =====
// ไฟล์จาก DOSS เป็น HTML table ปลอมนามสกุล .xls คอลัมน์: Model, Type, Color, Estimate Quota Week 1-4, Estimate Quota Total,
//   Estimate Quota Total for DirectSales, Current Quota, Adjusted Quota, Delivery, Pending
// - Estimate Quota Total = คาดการณ์ตั้งต้นของเดือน (ชุดที่เราคอนเฟิร์มใน DCS) · Adjusted = Honda ปรับเพิ่ม/ลดระหว่างเดือน
// - Current Quota = โควต้าสุทธิ ณ เวลาที่ออกไฟล์ (ตัวที่ใช้เทียบ) · Delivery = ส่งแล้ว · Pending = ค้างส่ง
// - แผนของเรา = plan_next ในรายงานส่ง HONDA รอบ (เดือนก่อน)-20 · ยอดขายรอบล่าสุด = sold_qty รอบ (เดือนนี้)-20 ถ้ายังไม่มีใช้รอบก่อน
// backend: honda-quota-snapshot-api (save_snapshot / list_snapshots / get_snapshot / delete_snapshot) — user 2026-10-24 แทนการจด memory
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/honda-quota-snapshot-api";
const HONDA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/honda-report-api";

const norm = (v) => String(v == null ? "" : v).replace(/\s+/g, "").toUpperCase();
const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(n) ? n : 0; };
const fmtN = (v) => (Number(v) || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) + "%" : "-");
const fmtDT = (iso) => { if (!iso) return "-"; const d = new Date(iso); return isNaN(d) ? String(iso) : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const pmLabel = (pm) => { const s = String(pm || ""); return s.length === 6 ? `${TH_MONTHS[Number(s.slice(4)) - 1]} ${Number(s.slice(0, 4)) + 543}` : s; };
// รอบรายงานส่ง HONDA: แผน = (เดือนก่อน)-20 · ขายรอบล่าสุด = (เดือนนี้)-20
const planPeriodOf = (pm) => { const y = Number(pm.slice(0, 4)), m = Number(pm.slice(4)); const d = new Date(y, m - 2, 20); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-20`; };
const salesPeriodOf = (pm) => `${pm.slice(0, 4)}-${pm.slice(4)}-20`;
const curPm = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`; };

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => []);
  return d;
}
const asArray = (d) => (Array.isArray(d) ? d : d && Array.isArray(d.rows) ? d.rows : d && Array.isArray(d.data) ? d.data : []);

// อ่านไฟล์ DOSS (HTML table / xls / xlsx) → แถว {model_code, type, color_code, est_w1..4, est_total, est_direct, current_quota, adjusted_quota, delivery, pending}
async function parseDossFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const hi = rows.findIndex((r) => Array.isArray(r) && r.map((x) => String(x).trim().toLowerCase()).includes("current quota"));
  if (hi < 0) throw new Error("ไม่พบคอลัมน์ Current Quota — ตรวจว่าเป็นไฟล์โควต้า DOSS (32116_YYYYMM.xls)");
  const head = rows[hi].map((x) => String(x).trim().toLowerCase());
  const col = (name) => head.indexOf(name.toLowerCase());
  const c = {
    model: col("Model"), type: col("Type"), color: col("Color"),
    w1: col("Estimate Quota Week 1"), w2: col("Estimate Quota Week 2"), w3: col("Estimate Quota Week 3"), w4: col("Estimate Quota Week 4"),
    est: col("Estimate Quota Total"), direct: col("Estimate Quota Total for DirectSales"),
    cur: col("Current Quota"), adj: col("Adjusted Quota"), dl: col("Delivery"), pend: col("Pending"),
  };
  if (c.model < 0 || c.type < 0 || c.color < 0 || c.cur < 0) throw new Error("ไฟล์ไม่มีคอลัมน์ Model/Type/Color/Current Quota ครบ");
  const g = (r, i) => (i >= 0 ? r[i] : "");
  const out = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]; if (!Array.isArray(r)) continue;
    const model = norm(g(r, c.model)); if (!model) continue;
    out.push({
      model_code: model, type: norm(g(r, c.type)), color_code: norm(g(r, c.color)),
      est_w1: num(g(r, c.w1)), est_w2: num(g(r, c.w2)), est_w3: num(g(r, c.w3)), est_w4: num(g(r, c.w4)),
      est_total: num(g(r, c.est)), est_direct: num(g(r, c.direct)),
      current_quota: num(g(r, c.cur)), adjusted_quota: num(g(r, c.adj)), delivery: num(g(r, c.dl)), pending: num(g(r, c.pend)),
    });
  }
  if (!out.length) throw new Error("ไม่พบแถวข้อมูลในไฟล์");
  return out;
}

export default function HondaQuotaSnapshotPage({ currentUser }) {
  const fileRef = useRef(null);
  const [snaps, setSnaps] = useState([]);         // header ทุก snapshot (ล่าสุดก่อน)
  const [pm, setPm] = useState("");               // เดือนที่ดู YYYYMM
  const [curId, setCurId] = useState(null);       // snapshot ที่ดู
  const [baseId, setBaseId] = useState(null);     // snapshot ที่เทียบ (ก่อนหน้า)
  const [curRows, setCurRows] = useState([]);
  const [baseRows, setBaseRows] = useState([]);
  const [plan, setPlan] = useState({});           // key model|type → {plan, lock}
  const [sold, setSold] = useState({});           // key → qty
  const [soldLabel, setSoldLabel] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [pendingUpload, setPendingUpload] = useState(null); // {file, rows, period_month} รอยืนยันเดือน

  async function loadSnaps(selectLatestOf) {
    const d = asArray(await post(API, { action: "list_snapshots" }));
    setSnaps(d);
    const months = [...new Set(d.map((s) => s.period_month))];
    const want = selectLatestOf || pm || months[0] || curPm();
    setPm(want);
    const inMonth = d.filter((s) => s.period_month === want);
    if (inMonth.length) { setCurId(Number(inMonth[0].id)); setBaseId(inMonth[1] ? Number(inMonth[1].id) : null); }
    else { setCurId(null); setBaseId(null); }
  }
  useEffect(() => { loadSnaps(); /* eslint-disable-next-line */ }, []);

  // เปลี่ยนเดือน → เลือก snapshot ล่าสุด/ก่อนหน้าของเดือนนั้น
  function changeMonth(v) {
    setPm(v);
    const inMonth = snaps.filter((s) => s.period_month === v);
    setCurId(inMonth[0] ? Number(inMonth[0].id) : null);
    setBaseId(inMonth[1] ? Number(inMonth[1].id) : null);
  }

  useEffect(() => {
    (async () => {
      setCurRows(curId ? asArray(await post(API, { action: "get_snapshot", id: curId })) : []);
    })();
  }, [curId]);
  useEffect(() => {
    (async () => {
      setBaseRows(baseId ? asArray(await post(API, { action: "get_snapshot", id: baseId })) : []);
    })();
  }, [baseId]);
  // แผน + ยอดขาย จากรายงานส่ง HONDA
  useEffect(() => {
    if (!pm || pm.length !== 6) { setPlan({}); setSold({}); return; }
    (async () => {
      try {
        const [pRows, sRows] = await Promise.all([
          post(HONDA_API, { action: "get_honda_report", period: planPeriodOf(pm) }).then(asArray).catch(() => []),
          post(HONDA_API, { action: "get_honda_report", period: salesPeriodOf(pm) }).then(asArray).catch(() => []),
        ]);
        const p = {};
        for (const r of pRows) {
          if (!r || !r.model_code) continue;
          const k = norm(r.model_code) + "|" + norm(r.type);
          if (!p[k]) p[k] = { plan: 0, lock: false };
          p[k].plan += num(r.plan_next);
          p[k].lock = p[k].lock || r.locked_next === true || r.locked_next === "true" || r.locked_next === "t";
        }
        setPlan(p);
        const src = sRows.length ? sRows : pRows;
        setSoldLabel(sRows.length ? `ขายรอบ 21/${pm.slice(4) === "01" ? "12" : String(Number(pm.slice(4)) - 1).padStart(2, "0")}–20/${pm.slice(4)}` : `ขายรอบก่อน (ถึง 20/${planPeriodOf(pm).slice(5, 7)})`);
        const s = {};
        for (const r of src) { if (!r || !r.model_code) continue; const k = norm(r.model_code) + "|" + norm(r.type); s[k] = (s[k] || 0) + num(r.sold_qty); }
        setSold(s);
      } catch { setPlan({}); setSold({}); }
    })();
  }, [pm]);

  // ===== upload =====
  async function onPick(e) {
    const file = e.target.files && e.target.files[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setMsg("⏳ กำลังอ่านไฟล์…");
    try {
      const rows = await parseDossFile(file);
      const m = String(file.name).match(/_(\d{6})\./);
      const period_month = m ? m[1] : curPm();
      setPendingUpload({ file, rows, period_month });
      setMsg(`อ่านได้ ${rows.length} แถว · รวม Current ${fmtN(rows.reduce((t, r) => t + r.current_quota, 0))} คัน · ส่งแล้ว ${fmtN(rows.reduce((t, r) => t + r.delivery, 0))} · ค้าง ${fmtN(rows.reduce((t, r) => t + r.pending, 0))} — ตรวจเดือนแล้วกดบันทึก`);
    } catch (err) { setMsg("❌ " + (err.message || String(err))); }
  }
  async function saveUpload() {
    if (!pendingUpload) return;
    setBusy(true);
    try {
      const { file, rows, period_month } = pendingUpload;
      const d = await post(API, {
        action: "save_snapshot", period_month, file_name: file.name,
        file_time: new Date(file.lastModified || Date.now()).toISOString(),
        uploaded_by: currentUser?.name || currentUser?.username || "", rows,
      });
      const r = asArray(d)[0] || d;
      if (!r || r.error) throw new Error(r?.error || "บันทึกไม่สำเร็จ (ตรวจว่า import + Publish workflow honda-quota-snapshot-api แล้ว)");
      setMsg(r.duplicate ? `⚠️ ไฟล์นี้เคยบันทึกแล้ว (snapshot #${r.id}) ไม่เพิ่มซ้ำ` : `✅ บันทึก snapshot #${r.id} · ${r.inserted} แถว · Current ${fmtN(r.current_total)} คัน`);
      setPendingUpload(null);
      await loadSnaps(period_month);
    } catch (err) { setMsg("❌ " + (err.message || String(err))); }
    setBusy(false);
  }
  async function delSnap(s) {
    if (!window.confirm(`ลบ snapshot #${s.id} (${fmtDT(s.file_time)} · Current ${fmtN(s.current_total)})?`)) return;
    await post(API, { action: "delete_snapshot", id: s.id });
    await loadSnaps(pm);
  }

  // ===== เทียบ: รวมเป็นรายรุ่น|type =====
  const agg = (rows) => {
    const m = {};
    for (const r of rows) {
      const k = norm(r.model_code) + "|" + norm(r.type);
      if (!m[k]) m[k] = { cur: 0, est: 0, adj: 0, dl: 0, pend: 0, colors: {} };
      m[k].cur += num(r.current_quota); m[k].est += num(r.est_total); m[k].adj += num(r.adjusted_quota); m[k].dl += num(r.delivery); m[k].pend += num(r.pending);
      m[k].colors[norm(r.color_code)] = { cur: num(r.current_quota), dl: num(r.delivery), pend: num(r.pending) };
    }
    return m;
  };
  const curAgg = useMemo(() => agg(curRows), [curRows]);
  const baseAgg = useMemo(() => agg(baseRows), [baseRows]);
  const table = useMemo(() => {
    const keys = new Set([...Object.keys(curAgg), ...Object.keys(baseAgg), ...Object.keys(plan).filter((k) => plan[k].plan > 0)]);
    const out = [...keys].map((k) => {
      const c = curAgg[k] || { cur: 0, est: 0, adj: 0, dl: 0, pend: 0, colors: {} };
      const b = baseAgg[k] || { cur: 0, colors: {} };
      return { key: k, plan: plan[k]?.plan || 0, lock: !!plan[k]?.lock, base: b.cur, cur: c.cur, delta: c.cur - (baseId ? b.cur : c.cur), est: c.est, adj: c.adj, dl: c.dl, pend: c.pend, sold: sold[k] || 0, colors: c.colors, baseColors: b.colors };
    });
    return out.filter((r) => r.cur || r.base || r.plan).sort((a, b) => b.delta - a.delta || b.cur - a.cur || a.key.localeCompare(b.key));
  }, [curAgg, baseAgg, plan, sold, baseId]);
  const tot = useMemo(() => table.reduce((t, r) => ({ plan: t.plan + r.plan, base: t.base + r.base, cur: t.cur + r.cur, delta: t.delta + r.delta, est: t.est + r.est, dl: t.dl + r.dl, pend: t.pend + r.pend, sold: t.sold + r.sold, planUnlocked: t.planUnlocked + (r.lock ? 0 : r.plan), curUnlocked: t.curUnlocked + (r.lock ? 0 : r.cur) }), { plan: 0, base: 0, cur: 0, delta: 0, est: 0, dl: 0, pend: 0, sold: 0, planUnlocked: 0, curUnlocked: 0 }), [table]);
  const shown = onlyChanged ? table.filter((r) => r.delta !== 0) : table;

  const months = [...new Set(snaps.map((s) => s.period_month))];
  const inMonth = snaps.filter((s) => s.period_month === pm);
  const curSnap = snaps.find((s) => Number(s.id) === curId);
  const baseSnap = snaps.find((s) => Number(s.id) === baseId);

  const th = { padding: "7px 8px", fontSize: 12.5, whiteSpace: "nowrap", borderBottom: "2px solid #1e3a8a", background: "#eef2ff", color: "#1e3a8a" };
  const td = { padding: "6px 8px", fontSize: 13, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" };
  const tdn = { ...td, textAlign: "right", fontFamily: "monospace" };
  const btn = (bg) => ({ padding: "7px 14px", borderRadius: 8, border: "none", background: bg, color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "Tahoma", fontSize: 13 });
  const Card = ({ label, value, sub, color }) => (
    <div style={{ flex: "1 1 150px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || "#1e3a8a", fontFamily: "monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#6b7280" }}>{sub}</div>}
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 className="page-title" style={{ margin: 0 }}>🎯 โควต้า HONDA (DOSS)</h2>
        <div style={{ flex: 1 }} />
        <input ref={fileRef} type="file" accept=".xls,.xlsx,.html,.htm" style={{ display: "none" }} onChange={onPick} />
        <button onClick={() => fileRef.current && fileRef.current.click()} style={btn("#1e3a8a")} title="ไฟล์ 32116_YYYYMM.xls จาก DOSS (Estimate/Current Quota/Delivery/Pending)">📥 อัปโหลดไฟล์โควต้า</button>
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 10px" }}>
        อัปโหลดไฟล์ 32116_YYYYMM.xls จาก DOSS ทุกครั้งที่โควต้าขยับ ระบบเก็บเป็น snapshot ตามเวลาไฟล์ แล้วเทียบให้ว่า Honda เพิ่ม/ตัดรุ่นไหน เทียบกับแผนที่ส่ง (plan เดือนหน้าในรายงานส่ง HONDA รอบ 20 ของเดือนก่อน) และยอดขายรอบล่าสุด · รุ่น 🔒 = Honda ล็อกคาดการณ์ (จัดโควต้าเอง) ไม่นับใน fill rate
      </div>
      {msg && <div style={{ padding: "8px 12px", borderRadius: 8, background: msg.startsWith("❌") ? "#fee2e2" : msg.startsWith("⚠️") ? "#fef3c7" : "#ecfdf5", color: "#1f2937", marginBottom: 10, fontSize: 13 }}>{msg}</div>}

      {pendingUpload && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10, marginBottom: 12 }}>
          <b>ไฟล์:</b> {pendingUpload.file.name} · เวลาไฟล์ {fmtDT(new Date(pendingUpload.file.lastModified).toISOString())}
          <label style={{ fontSize: 13 }}>เดือนโควต้า (YYYYMM):</label>
          <input value={pendingUpload.period_month} onChange={(e) => setPendingUpload({ ...pendingUpload, period_month: e.target.value.replace(/[^0-9]/g, "").slice(0, 6) })} style={{ width: 90, padding: "5px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "monospace" }} />
          <span style={{ fontSize: 12, color: "#6b7280" }}>({pmLabel(pendingUpload.period_month)})</span>
          <button onClick={saveUpload} disabled={busy || pendingUpload.period_month.length !== 6} style={btn(busy ? "#9ca3af" : "#16a34a")}>{busy ? "⏳ กำลังบันทึก…" : "💾 บันทึก snapshot"}</button>
          <button onClick={() => { setPendingUpload(null); setMsg(""); }} style={btn("#94a3b8")}>ยกเลิก</button>
        </div>
      )}

      {/* เลือกเดือน / snapshot */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>เดือน:</label>
        <select value={pm} onChange={(e) => changeMonth(e.target.value)} style={{ padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma" }}>
          {!months.includes(pm) && pm && <option value={pm}>{pmLabel(pm)}</option>}
          {months.map((m) => <option key={m} value={m}>{pmLabel(m)} ({snaps.filter((s) => s.period_month === m).length} snapshot)</option>)}
        </select>
        <label style={{ fontSize: 13, fontWeight: 600 }}>ดู:</label>
        <select value={curId || ""} onChange={(e) => setCurId(Number(e.target.value) || null)} style={{ padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma" }}>
          {inMonth.map((s) => <option key={s.id} value={s.id}>#{s.id} · {fmtDT(s.file_time)} · Current {fmtN(s.current_total)}</option>)}
        </select>
        <label style={{ fontSize: 13, fontWeight: 600 }}>เทียบกับ:</label>
        <select value={baseId || ""} onChange={(e) => setBaseId(Number(e.target.value) || null)} style={{ padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma" }}>
          <option value="">— ไม่เทียบ —</option>
          {inMonth.filter((s) => Number(s.id) !== curId).map((s) => <option key={s.id} value={s.id}>#{s.id} · {fmtDT(s.file_time)} · Current {fmtN(s.current_total)}</option>)}
        </select>
        <label style={{ fontSize: 12.5, marginLeft: 8 }}><input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} /> เฉพาะรุ่นที่ขยับ</label>
        <label style={{ fontSize: 12.5 }}><input type="checkbox" checked={showColors} onChange={(e) => setShowColors(e.target.checked)} /> แสดงรายสี</label>
      </div>

      {curSnap && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <Card label={`แผนที่ส่ง (รอบ ${planPeriodOf(pm)})`} value={fmtN(tot.plan)} sub={`ไม่รวมรุ่นล็อก ${fmtN(tot.planUnlocked)}`} />
          <Card label="คาดการณ์ตั้งต้น (Estimate)" value={fmtN(tot.est)} sub={pct(tot.est, tot.plan) + " ของแผน"} color="#6b7280" />
          <Card label={`โควต้าปัจจุบัน (Current) ${fmtDT(curSnap.file_time)}`} value={fmtN(tot.cur)} sub={`${pct(tot.cur, tot.plan)} ของแผน · ไม่รวมล็อก ${fmtN(tot.curUnlocked)} = ${pct(tot.curUnlocked, tot.planUnlocked)}`} color="#15803d" />
          <Card label={baseSnap ? `เปลี่ยนจาก ${fmtDT(baseSnap.file_time)}` : "เปลี่ยนจากครั้งก่อน"} value={baseSnap ? (tot.delta > 0 ? "+" : "") + fmtN(tot.delta) : "-"} sub={baseSnap ? `ก่อน ${fmtN(tot.base)} → ตอนนี้ ${fmtN(tot.cur)}` : "เลือก snapshot ที่จะเทียบ"} color={tot.delta >= 0 ? "#1d4ed8" : "#dc2626"} />
          <Card label="ส่งแล้ว / ค้างส่ง" value={`${fmtN(tot.dl)} / ${fmtN(tot.pend)}`} sub={`ส่งแล้ว ${pct(tot.dl, tot.cur)} ของโควต้า`} color="#b45309" />
          <Card label={soldLabel || "ยอดขายรอบล่าสุด"} value={fmtN(tot.sold)} sub={`โควต้า ${pct(tot.cur, tot.sold)} ของยอดขาย`} color="#7c3aed" />
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...th, textAlign: "left" }}>รุ่น | type</th>
            <th style={{ ...th, textAlign: "right" }}>แผน</th>
            <th style={{ ...th, textAlign: "right" }}>Estimate</th>
            <th style={{ ...th, textAlign: "right" }}>{baseSnap ? "ก่อน" : "-"}</th>
            <th style={{ ...th, textAlign: "right" }}>Current</th>
            <th style={{ ...th, textAlign: "right" }}>เปลี่ยน</th>
            <th style={{ ...th, textAlign: "right" }}>ส่งแล้ว</th>
            <th style={{ ...th, textAlign: "right" }}>ค้างส่ง</th>
            <th style={{ ...th, textAlign: "right" }}>{soldLabel || "ขาย"}</th>
            <th style={{ ...th, textAlign: "right" }}>โควต้า/แผน</th>
          </tr></thead>
          <tbody>
            {!curSnap && <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 24 }}>ยังไม่มี snapshot ของเดือนนี้ — กด "อัปโหลดไฟล์โควต้า"</td></tr>}
            {shown.map((r) => (
              <React.Fragment key={r.key}>
                <tr style={{ background: r.delta > 0 ? "#f0fdf4" : r.delta < 0 ? "#fef2f2" : "#fff" }}>
                  <td style={td}>{r.lock ? "🔒 " : ""}{r.key.replace("|", " · ")}</td>
                  <td style={tdn}>{r.plan ? fmtN(r.plan) : "-"}</td>
                  <td style={{ ...tdn, color: "#6b7280" }}>{r.est ? fmtN(r.est) : "-"}</td>
                  <td style={{ ...tdn, color: "#6b7280" }}>{baseSnap ? fmtN(r.base) : "-"}</td>
                  <td style={{ ...tdn, fontWeight: 700 }}>{fmtN(r.cur)}</td>
                  <td style={{ ...tdn, fontWeight: 700, color: r.delta > 0 ? "#15803d" : r.delta < 0 ? "#dc2626" : "#9ca3af" }}>{baseSnap ? (r.delta > 0 ? "+" : "") + fmtN(r.delta) : "-"}</td>
                  <td style={tdn}>{fmtN(r.dl)}</td>
                  <td style={{ ...tdn, color: r.pend ? "#b45309" : "#9ca3af" }}>{fmtN(r.pend)}</td>
                  <td style={{ ...tdn, color: "#7c3aed" }}>{fmtN(r.sold)}</td>
                  <td style={{ ...tdn, color: r.plan && r.cur < r.plan * 0.7 ? "#dc2626" : "#374151" }}>{r.plan ? pct(r.cur, r.plan) : "-"}</td>
                </tr>
                {showColors && Object.keys(r.colors).sort().map((c) => {
                  const cc = r.colors[c]; const bc = r.baseColors[c] || { cur: 0 }; const d = cc.cur - (baseSnap ? bc.cur : cc.cur);
                  return (
                    <tr key={r.key + c} style={{ background: "#fafafa" }}>
                      <td style={{ ...td, paddingLeft: 28, color: "#6b7280", fontSize: 12 }}>สี {c}</td>
                      <td style={tdn}></td><td style={tdn}></td>
                      <td style={{ ...tdn, color: "#9ca3af", fontSize: 12 }}>{baseSnap ? fmtN(bc.cur) : ""}</td>
                      <td style={{ ...tdn, fontSize: 12 }}>{fmtN(cc.cur)}</td>
                      <td style={{ ...tdn, fontSize: 12, color: d > 0 ? "#15803d" : d < 0 ? "#dc2626" : "#9ca3af" }}>{baseSnap && d ? (d > 0 ? "+" : "") + fmtN(d) : ""}</td>
                      <td style={{ ...tdn, fontSize: 12 }}>{fmtN(cc.dl)}</td>
                      <td style={{ ...tdn, fontSize: 12, color: cc.pend ? "#b45309" : "#9ca3af" }}>{fmtN(cc.pend)}</td>
                      <td style={tdn}></td><td style={tdn}></td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
          {curSnap && (
            <tfoot><tr style={{ background: "#f8fafc", borderTop: "2px solid #1e3a8a", fontWeight: 800 }}>
              <td style={td}>รวม {shown.length} รุ่น</td>
              <td style={tdn}>{fmtN(tot.plan)}</td><td style={tdn}>{fmtN(tot.est)}</td>
              <td style={tdn}>{baseSnap ? fmtN(tot.base) : "-"}</td><td style={tdn}>{fmtN(tot.cur)}</td>
              <td style={{ ...tdn, color: tot.delta > 0 ? "#15803d" : tot.delta < 0 ? "#dc2626" : "#9ca3af" }}>{baseSnap ? (tot.delta > 0 ? "+" : "") + fmtN(tot.delta) : "-"}</td>
              <td style={tdn}>{fmtN(tot.dl)}</td><td style={tdn}>{fmtN(tot.pend)}</td><td style={tdn}>{fmtN(tot.sold)}</td>
              <td style={tdn}>{pct(tot.cur, tot.plan)}</td>
            </tr></tfoot>
          )}
        </table>
      </div>

      {/* ประวัติ snapshot ของเดือน */}
      {inMonth.length > 0 && (
        <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "auto" }}>
          <div style={{ padding: "8px 12px", fontWeight: 700, fontSize: 13.5, color: "#1e3a8a", background: "#eef2ff" }}>ประวัติ snapshot {pmLabel(pm)}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>#</th><th style={{ ...th, textAlign: "left" }}>เวลาไฟล์</th><th style={{ ...th, textAlign: "left" }}>ไฟล์</th>
              <th style={{ ...th, textAlign: "right" }}>Estimate</th><th style={{ ...th, textAlign: "right" }}>Adjusted</th><th style={{ ...th, textAlign: "right" }}>Current</th>
              <th style={{ ...th, textAlign: "right" }}>เปลี่ยน</th><th style={{ ...th, textAlign: "right" }}>ส่งแล้ว</th><th style={{ ...th, textAlign: "right" }}>ค้าง</th>
              <th style={{ ...th, textAlign: "left" }}>อัปโหลดโดย</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {inMonth.map((s, i) => {
                const prev = inMonth[i + 1]; const d = prev ? num(s.current_total) - num(prev.current_total) : 0;
                return (
                  <tr key={s.id} style={{ background: Number(s.id) === curId ? "#fffbeb" : "#fff" }}>
                    <td style={{ ...td, textAlign: "center" }}>{s.id}</td>
                    <td style={td}>{fmtDT(s.file_time)}</td>
                    <td style={{ ...td, color: "#6b7280", fontSize: 12 }}>{s.file_name}</td>
                    <td style={tdn}>{fmtN(s.est_total)}</td><td style={tdn}>{fmtN(s.adjusted_total)}</td>
                    <td style={{ ...tdn, fontWeight: 700 }}>{fmtN(s.current_total)}</td>
                    <td style={{ ...tdn, color: d > 0 ? "#15803d" : d < 0 ? "#dc2626" : "#9ca3af" }}>{prev ? (d > 0 ? "+" : "") + fmtN(d) : "-"}</td>
                    <td style={tdn}>{fmtN(s.delivery_total)}</td><td style={tdn}>{fmtN(s.pending_total)}</td>
                    <td style={{ ...td, fontSize: 12 }}>{s.uploaded_by || "-"} · {fmtDT(s.uploaded_at)}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <button onClick={() => { setCurId(Number(s.id)); setBaseId(prev ? Number(prev.id) : null); }} style={{ ...btn("#1e3a8a"), padding: "3px 8px", fontSize: 12, marginRight: 4 }}>ดู</button>
                      <button onClick={() => delSnap(s)} style={{ ...btn("#dc2626"), padding: "3px 8px", fontSize: 12 }}>ลบ</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
