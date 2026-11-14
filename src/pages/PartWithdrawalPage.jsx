import React, { useState, useEffect, useRef } from "react";

const FAST_API = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-stock-api";
const PW_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-withdrawal-api";
const SQ_API = "https://n8n-new-project-gwf2.onrender.com/webhook/service-queue-api"; // สถานะช่องซ่อม (รถในช่อง) จากกล้อง NVR ผ่าน Pi — action list_bays / clear_bay
const SVC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/service-history-api"; // รายละเอียดรถ + ประวัติงานบริการ (user 2026-10-31: กดเลือกรถที่คีออสแล้วดูประวัติบริการล่าสุด)

const txt = (v) => (v == null ? "" : String(v).trim());
const fmtDateTH = (d) => { const t = txt(d).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t || "-"; const [y, m, dd] = t.split("-"); return `${dd}/${m}/${Number(y) + 543}`; };
const fmtMoney = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// แผงรายละเอียดรถ + ประวัติเข้ารับบริการล่าสุด ของรถที่เลือกในคีออส
// ขั้น 1 search_vehicles ด้วยทะเบียน (หมวด+เลข ไม่มีช่องว่าง) → ได้เลขถัง/เลขเครื่อง/ลูกค้า/รุ่น · ขั้น 2 service_history ด้วยเลขถัง/เลขเครื่อง (API จับคู่ด้วยเลขถัง/เครื่องเท่านั้น ทะเบียนอย่างเดียวไม่ได้)
function VehicleServicePanel({ plate, province, maxJobs = 5 }) {
  const [st, setSt] = useState({ stage: "idle" });
  useEffect(() => {
    const key = txt(plate).replace(/\s+/g, "");
    if (!key) return;   // ไม่มีทะเบียน → หน้าจอโชว์ข้อความ "เลือกรถ" จากค่า plate ตรง ๆ
    let alive = true;
    (async () => {
      setSt({ stage: "loading" }); // eslint-disable-line react-hooks/set-state-in-effect
      try {
        // ค้นด้วย "เลข" ทะเบียนอย่างเดียว (หมวดในฐานมีทั้ง "2กฉ" และ "2 กฉ" ค้นทั้งป้ายไม่เจอ) แล้วค่อยเทียบหมวดเอง
        const num = (key.match(/\d+$/) || [key])[0];
        const r1 = await fetch(SVC_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "search_vehicles", field: "plate_number", keyword: num }) });
        const d1 = await r1.json();
        const cands = (Array.isArray(d1) ? d1 : (Array.isArray(d1?.data) ? d1.data : [])).filter(v => txt(v.plate_number).replace(/\s+/g, "") === num);
        const pk = (v) => `${txt(v.plate_category)}${txt(v.plate_number)}`.replace(/\s+/g, "");
        const diff = (x, y) => x.length === y.length ? [...x].filter((c, i) => c !== y[i]).length : 99;
        const exact = cands.filter(v => pk(v) === key);
        const near = cands.filter(v => diff(pk(v), key) === 1);   // กล้องอ่านอักษรหมวดเพี้ยน 1 ตัว (ช/ข/ฉ/ณ) — ยอมรับเมื่อเลขตรงและต่างแค่ตัวเดียว
        const nearPlates = [...new Set(near.map(pk))];
        const v = (exact.length ? exact : nearPlates.length === 1 ? near : [])[0] || null;   // ใกล้เคียงต้องมีป้ายเดียว (เลข 956 มี 1กฬ/1กส/1กภ ต่าง 1 ตัวทั้งหมด → ไม่เดา); API เรียงใบขายก่อนทะเบียน Excel/ใบซ่อม
        if (!alive) return;
        if (!v) { setSt({ stage: "done", vehicle: null, jobs: [], cands }); return; }
        const r2 = await fetch(SVC_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "service_history", chassis: v.frame_no, engine: v.engine_no, plate: pk(v), customer: v.customer_name }) });
        const d2 = await r2.json();
        const rows = Array.isArray(d2) ? d2 : (Array.isArray(d2?.data) ? d2.data : []);
        const map = new Map();   // รายชิ้น → รายใบงาน (logic เดียวกับหน้าค้นหาประวัติ)
        for (const r of rows) {
          const k = `${r.brand}|${r.job_no}`;
          if (!map.has(k)) map.set(k, { brand: r.brand, job_no: r.job_no, service_date: r.service_date, repair_type: r.repair_type, mechanic_name: r.mechanic_name, mileage: r.mileage, job_amount: r.job_amount, parts: [], _ps: 0 });
          const g = map.get(k);
          if (txt(r.part_code) || txt(r.part_name)) { g.parts.push({ part_code: r.part_code, part_name: r.part_name, qty: r.qty, part_amount: r.part_amount }); g._ps += Number(r.part_amount || 0); }
        }
        const jobs = [...map.values()].map(g => ({ ...g, total: g.job_amount != null ? Number(g.job_amount) : g._ps }))
          .sort((x, y) => (String(x.service_date) < String(y.service_date) ? 1 : -1));
        if (alive) setSt({ stage: "done", vehicle: v, jobs, total: jobs.length });
      } catch {
        if (alive) setSt({ stage: "error" });
      }
    })();
    return () => { alive = false; };
  }, [plate]);

  const box = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" };
  if (!txt(plate)) return <div style={{ ...box, color: "#9ca3af", textAlign: "center" }}>เลือกรถด้านบน (ที่อ่านทะเบียนได้) เพื่อดูรายละเอียดรถและประวัติบริการ</div>;
  if (st.stage === "loading") return <div style={{ ...box, color: "#6b7280", textAlign: "center" }}>⏳ กำลังค้นหารถ {plate} …</div>;
  if (st.stage === "error") return <div style={{ ...box, color: "#b91c1c" }}>โหลดประวัติไม่สำเร็จ (เช็กว่า Service History API ยัง Active)</div>;
  if (st.stage !== "done") return null;
  const v = st.vehicle;
  if (!v) return <div style={{ ...box, color: "#92400e", background: "#fffbeb" }}>ไม่พบรถทะเบียน <b>{plate}{province ? " " + province : ""}</b> ในระบบ (ใบขาย/ทะเบียน Excel/ใบซ่อม) — อาจเป็นรถที่ไม่ได้ซื้อจากร้าน หรือกล้องอ่านทะเบียนผิด{st.cands?.length ? <div style={{ fontSize: 13, marginTop: 4 }}>เลข {txt(plate).match(/\d+$/)?.[0]} ในระบบมี: {st.cands.map(c => `${txt(c.plate_category)} ${txt(c.plate_number)}`.trim()).filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 6).join(", ")}</div> : null}</div>;
  const model = [txt(v.brand), txt(v.model_series), txt(v.model_code) || txt(v.model_text), txt(v.vehicle_type)].filter(Boolean).join(" ");
  const jobs = st.jobs.slice(0, maxJobs);
  const cell = { padding: "3px 10px 3px 0", fontSize: 14, verticalAlign: "top" };
  const lab = { ...cell, color: "#6b7280", whiteSpace: "nowrap" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={box}>
        <div style={{ fontWeight: 800, color: "#072d6b", fontSize: 15, marginBottom: 6 }}>🏍️ รายละเอียดรถ {plate}{province ? " " + province : ""}</div>
        <table style={{ borderCollapse: "collapse" }}><tbody>
          <tr><td style={lab}>รุ่น</td><td style={cell}><b>{model || "-"}</b>{txt(v.color) ? ` · สี${txt(v.color)}` : ""}</td></tr>
          <tr><td style={lab}>ลูกค้า</td><td style={cell}>{txt(v.customer_name) || "-"}{txt(v.customer_phone) ? ` · ${txt(v.customer_phone)}` : ""}</td></tr>
          <tr><td style={lab}>ซื้อเมื่อ</td><td style={cell}>{fmtDateTH(v.sale_date)}{txt(v.sale_doc_no) ? ` · ใบขาย ${txt(v.sale_doc_no)}` : ""}{txt(v.source) ? ` · ที่มา: ${{ sale: "ใบขาย", registry: "ทะเบียน Excel", repair: "ใบซ่อม" }[txt(v.source)] || txt(v.source)}` : ""}</td></tr>
          <tr><td style={lab}>เลขถัง / เครื่อง</td><td style={{ ...cell, fontFamily: "monospace" }}>{txt(v.frame_no) || "-"} / {txt(v.engine_no) || "-"}</td></tr>
        </tbody></table>
      </div>
      <div style={{ ...box, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>🔧 ประวัติเข้ารับบริการล่าสุด {st.total ? `(${Math.min(st.total, maxJobs)} จาก ${st.total} ครั้ง)` : ""}</div>
        {jobs.length === 0 ? <div style={{ padding: 16, color: "#9ca3af", textAlign: "center" }}>ยังไม่มีประวัติงานบริการของรถคันนี้ในระบบ</div> : jobs.map((j, i) => (
          <div key={`${j.brand}-${j.job_no}-${i}`} style={{ borderBottom: i < jobs.length - 1 ? "1px solid #f1f5f9" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 14px", background: i === 0 ? "#fffbeb" : "#fff" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 13.5 }}>
                {i === 0 && <span style={{ background: "#f59e0b", color: "#fff", borderRadius: 6, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>ล่าสุด</span>}
                <span style={{ color: j.brand === "HONDA" ? "#e2231a" : "#0a4ea2", fontWeight: 800 }}>{j.brand}</span>
                <span>📅 {fmtDateTH(j.service_date)}</span>
                <span style={{ fontFamily: "monospace", color: "#0369a1", fontWeight: 600 }}>{txt(j.job_no)}</span>
                {txt(j.repair_type) && <span>🔧 {txt(j.repair_type)}</span>}
                {txt(j.mechanic_name) && <span>👨‍🔧 {txt(j.mechanic_name)}</span>}
                {txt(j.mileage) && <span>📏 {txt(j.mileage)} กม.</span>}
              </div>
              <div style={{ fontWeight: 800, color: "#065f46" }}>{fmtMoney(j.total)} บาท</div>
            </div>
            {j.parts.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <tbody>
                  {j.parts.map((pt, k) => (
                    <tr key={k} style={{ borderTop: "1px solid #f8fafc" }}>
                      <td style={{ padding: "3px 14px", fontFamily: "monospace", width: 150 }}>{txt(pt.part_code) || "-"}</td>
                      <td style={{ padding: "3px 6px" }}>{txt(pt.part_name) || "-"}</td>
                      <td style={{ padding: "3px 6px", textAlign: "right", width: 60 }}>{Number(pt.qty || 0).toLocaleString()}</td>
                      <td style={{ padding: "3px 14px", textAlign: "right", width: 110 }}>{fmtMoney(pt.part_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
const BAY_POLL_MS = 10000;

function parseStores(storesStr) {
  const out = { ppao: "-", haahong: "-", sachtalad: "-", nakhonluang: "-" };
  if (!storesStr || storesStr === "-") return out;
  const parts = String(storesStr).split("|").map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    const m = p.match(/^(.+?)\s+(\d+(?:\.\d+)?)(?:\s*\(([^)]*)\))?\s*$/);
    if (!m) continue;
    const name = m[1].trim();
    const qty = m[2];
    const loc = (m[3] || "").trim();
    if (name.includes("นครหลวง"))    out.nakhonluang = { qty, loc };
    else if (name.includes("ป.เปา")) out.ppao = { qty, loc };
    else if (name.includes("ห้าห้อง")) out.haahong = { qty, loc };
    else if (name.includes("สช") || name.includes("ศช")) out.sachtalad = { qty, loc };
  }
  return out;
}

export default function PartWithdrawalPage({ currentUser } = {}) {
  const [allRows, setAllRows] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [input, setInput] = useState("");
  const [scanned, setScanned] = useState([]);  // [{ row, stores, ts }]
  const [notFound, setNotFound] = useState("");  // เก็บ code ที่ไม่พบล่าสุด (แสดงชั่วคราว)
  const [withdrawn, setWithdrawn] = useState([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  // รถล่าสุดสูงสุด 5 คัน (จากกล้อง, list_bays → vehicles): รถที่ยังอยู่ในช่องมาก่อนเสมอ + รถที่อ่านทะเบียนได้ใน 24 ชม. "ขึ้นค้าง" ไม่หายเองเมื่อออกจากช่อง; ครบ 5 ตัดคันเก่าสุดที่ไม่ได้อยู่ในช่อง; ✕ = เอาออกจากรายการ (user 2026-10-30)
  const [bays, setBays] = useState([]);
  const [baysLoaded, setBaysLoaded] = useState(false);
  const [selectedBay, setSelectedBay] = useState(null); // {zone_source, zone_name, plate_no, plate_province, event_id}
  const [tab, setTab] = useState("day");   // แท็บใต้ช่องยิง: log = ประวัติการเบิก · svc = รถ & ประวัติบริการ (เลือกรถที่อ่านทะเบียนได้ → เด้งไป svc เอง)
  // เลือกรถ: หน้าปกติเปิดแท็บรถ & ประวัติบริการ · คีออสไม่มีแท็บนั้น → เปิดประวัติการเบิกของคันนั้น · ไม่เลือกรถ = สรุปรถทั้งวัน
  useEffect(() => { const kiosk = /^kiosk-/.test(String(currentUser?.username || "")); setTab(selectedBay && selectedBay.plate_no ? (kiosk ? "log" : "svc") : "day"); }, [selectedBay && selectedBay.plate_no]); // eslint-disable-line
  const [bayNotice, setBayNotice] = useState("");
  async function loadBays() {
    try {
      const res = await fetch(SQ_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_bays" }) });
      const d = await res.json();
      setBays(Array.isArray(d?.vehicles) ? d.vehicles : Array.isArray(d?.bays) ? d.bays : []);
    } catch { /* คงรายการเดิม */ }
    setBaysLoaded(true);
  }
  useEffect(() => { loadBays(); const t = setInterval(loadBays, BAY_POLL_MS); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!selectedBay) return;
    const cur = bays.find(b => b.event_id === selectedBay.event_id) || bays.find(b => selectedBay.plate_no && b.plate_no === selectedBay.plate_no) || (!selectedBay.plate_no ? bays.find(b => b.in_bay && b.zone_source === selectedBay.zone_source) : null);
    if (!cur) { setSelectedBay(null); setBayNotice(`รถ ${selectedBay.plate_no || "ไม่ทราบทะเบียน"} ถูกเอาออกจากรายการแล้ว — ยกเลิกการเลือกรถ`); setTimeout(() => setBayNotice(""), 8000); }
    else if (cur !== selectedBay) setSelectedBay(cur); // กล้องอ่านทะเบียนได้ทีหลัง / สถานะในช่องเปลี่ยน → อัปเดตตาม
  }, [bays]); // eslint-disable-line react-hooks/exhaustive-deps
  async function clearBay(b) {
    if (!window.confirm(`เอารถ ${b.plate_no || "ไม่ทราบทะเบียน"} ออกจากรายการ?${b.in_bay ? ` (และถือว่าออกจาก${b.zone_name}แล้ว)` : ""}`)) return;
    try { await fetch(SQ_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear_bay", zone_source: b.in_bay ? b.zone_source : undefined, event_id: b.event_id || undefined }) }); } catch { /* ignore */ }
    loadBays();
  }
  const bayLabel = (b) => `${b.plate_no || "ไม่ทราบทะเบียน"}${b.plate_province ? " " + b.plate_province : ""}`;
  // กดเลือกรถ → ประวัติเบิกโชว์เฉพาะคันนั้น (จับคู่ด้วย event ของกล้อง หรือทะเบียน) — user 2026-10-30
  const shown = selectedBay ? withdrawn.filter(w => (selectedBay.event_id && w.bay_event_id === selectedBay.event_id) || (selectedBay.plate_no && w.vehicle_plate === selectedBay.plate_no)) : withdrawn;
  // รายการที่เบิกให้รถคันนั้นแล้ววันนี้ (user 2026-11-12: กดเลือกรถแล้วอยากเห็นว่าเบิกอะไรไปแล้วบ้าง) — 1 แถว = 1 ชิ้น (qty ล็อค 1) จึงนับแถวต่อรหัส
  const withdrawnFor = (b) => withdrawn.filter(w => (b.event_id && w.bay_event_id === b.event_id) || (b.plate_no && w.vehicle_plate === b.plate_no));
  const summarizeParts = (rows) => { const m = new Map(); rows.forEach(w => { const k = String(w.part_code || "").trim() || "-"; const g = m.get(k) || { code: k, name: w.product_name || "", n: 0, last: "" }; g.n += 1; if (!g.name && w.product_name) g.name = w.product_name; if (!g.last || (w.withdrawn_at && w.withdrawn_at > g.last)) g.last = w.withdrawn_at || g.last; m.set(k, g); }); return [...m.values()]; };
  const selParts = selectedBay ? summarizeParts(shown) : [];
  // ไม่ได้เลือกรถ → สรุป "รถทั้งหมดของวัน" ที่มีการเบิก (user 2026-11-12) รวมคันที่ออกจากช่องซ่อมไปแล้ว (การ์ดด้านล่างโชว์เฉพาะคันที่ยังอยู่)
  const dayVehicles = (() => { const m = new Map(); withdrawn.forEach(w => { const k = w.vehicle_plate ? `${w.vehicle_plate}|${w.vehicle_province || ""}` : (w.bay_event_id ? `ev|${w.bay_event_id}` : "general"); const g = m.get(k) || { key: k, plate: w.vehicle_plate || "", province: w.vehicle_province || "", zone: w.vehicle_zone || "", rows: [], first: w.withdrawn_at }; g.rows.push(w); if (w.withdrawn_at && (!g.first || w.withdrawn_at < g.first)) g.first = w.withdrawn_at; m.set(k, g); });
    // รถที่กล้องเห็นวันนี้แต่ยังไม่เบิก (user 2026-11-12 'ไม่เบิกก็ขึ้น') — ใช้รายการเดียวกับการ์ด (list_bays) เติมเข้าไปเป็น 0 ชิ้น
    bays.forEach(b => { if (!b.plate_no) return; const k = `${b.plate_no}|${b.plate_province || ""}`; const hit = m.get(k) || [...m.values()].find(g => g.plate === b.plate_no); if (hit) { if (!hit.zone) hit.zone = b.zone_name || ""; return; } m.set(k, { key: k, plate: b.plate_no, province: b.plate_province || "", zone: b.zone_name || "", rows: [], first: "", since: b.since_local || "" }); });
    return [...m.values()].sort((a, b) => String(a.first || "").localeCompare(String(b.first || ""))); })();
  // สกรีนเซฟเวอร์คีออส (user 2026-10-28): ไม่แตะ/ไม่ยิงบาร์โค้ด idle วิ → ซ้อนทับด้วยจอประชาสัมพันธ์ (/signage สไลด์เดียวกับจอหน้าร้าน)
  // แตะจอ/กดคีย์/ยิงบาร์โค้ด → ซ่อนทันที (ช่องสแกนยังโฟกัสอยู่ รหัสที่ยิงไม่หาย) — เฉพาะผู้ใช้ kiosk-*; ปรับเวลาได้ด้วย ?idle=วินาที (0 = ปิด)
  const isKiosk = /^kiosk-/.test(String(currentUser?.username || ""));
  const kioskParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const idleSec = isKiosk ? Math.max(0, Number(kioskParams?.get("idle") ?? 120)) : 0;
  const saverBranch = (kioskParams?.get("branch") || "SCY06").toUpperCase();
  const saverMode = (kioskParams?.get("saver") || "logo").toLowerCase();   // logo (ค่าเริ่มต้น 2026-11-14) | signage
  const [saverOn, setSaverOn] = useState(false);
  useEffect(() => {
    if (!idleSec) return;
    let t = null;
    const arm = () => { clearTimeout(t); t = setTimeout(() => setSaverOn(true), idleSec * 1000); };
    const wake = () => { setSaverOn((on) => { if (on) setTimeout(() => inputRef.current?.focus(), 0); return false; }); arm(); };
    ["touchstart", "mousedown", "keydown", "pointerdown"].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    arm();
    return () => { clearTimeout(t); ["touchstart", "mousedown", "keydown", "pointerdown"].forEach((ev) => window.removeEventListener(ev, wake)); };
  }, [idleSec]);

  // วันที่กรอง — default = วันนี้
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [historyDate, setHistoryDate] = useState(todayISO());
  // คัดลอกรหัสอะไหล่ไปวางในระบบอื่น (NIDS/DMS) — user 2026-10-12
  const [copied, setCopied] = useState(""); // ข้อความที่เพิ่งคัดลอก (โชว์สั้น ๆ)
  const [copiedRows, setCopiedRows] = useState(new Set()); // key แถวที่คัดลอกแล้ว (ไฮไลต์ค้างไว้จนรีเฟรช) — user 2026-10-12
  const [lastCopiedRow, setLastCopiedRow] = useState(null);
  const rowKey = (w, i) => String(w.id || `${w.batch_no}|${w.part_code}|${i}`);
  const markCopied = (keys) => { setCopiedRows(prev => { const n = new Set(prev); keys.forEach(k => n.add(k)); return n; }); setLastCopiedRow(keys.length === 1 ? keys[0] : null); };
  async function copyText(txt, label) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(txt);
      else { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
      setCopied(label || txt); setTimeout(() => setCopied(""), 1800);
    } catch { setCopied("❌ คัดลอกไม่สำเร็จ"); setTimeout(() => setCopied(""), 2500); }
  }
  const copyBtn = (txt, title, label, onDone, done) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); copyText(txt, label); if (onDone) onDone(); }} title={title || "คัดลอก"}
      style={{ marginLeft: 6, padding: "1px 6px", fontSize: 11, border: done ? "1px solid #16a34a" : "1px solid #cbd5e1", borderRadius: 4, background: done ? "#dcfce7" : "#fff", cursor: "pointer", color: done ? "#166534" : "#334155" }}>{done ? "✅" : "📋"}</button>
  );

  async function loadHistory() {
    try {
      const res = await fetch(PW_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_part_withdrawals",
          limit: 1000,
          date_from: historyDate,
          date_to: historyDate,
        }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setWithdrawn(arr);
    } catch { setWithdrawn([]); }
  }
  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, [historyDate]);

  // Load fast-moving-stock master data once
  useEffect(() => {
    (async () => {
      setLoadingMaster(true);
      try {
        const res = await fetch(FAST_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        const data = await res.json();
        setAllRows(Array.isArray(data) ? data : []);
      } catch { setAllRows([]); }
      setLoadingMaster(false);
    })();
  }, []);

  // Auto-focus input on mount + after each save
  useEffect(() => { inputRef.current?.focus(); }, []);
  // ช่องสแกนต้อง "พร้อมยิง" ตลอด (คีออส SCY06 2026-10-31: กดเลือกรถแล้วต้องแตะช่องอีกที):
  //  - ตอนเปิดหน้า ช่องยัง disabled (โหลด master) focus ไม่ติด → focus อีกทีเมื่อโหลดเสร็จ
  //  - โฟกัสหลุดไปที่ปุ่ม/พื้นหลัง (แตะการ์ดรถ, ปิด confirm) → กลับมาเองใน 100 ms (ไม่แย่งจากช่องกรอกอื่น เช่น วันที่)
  //  - สแกนเนอร์ USB ยิงตอนโฟกัสอยู่ที่อื่น → ดักปุ่มระดับเอกสาร ย้ายโฟกัสเข้าช่องก่อนตัวอักษรแรกลง
  useEffect(() => { if (!loadingMaster) inputRef.current?.focus({ preventScroll: true }); }, [loadingMaster]);
  useEffect(() => {
    const isEditable = (el) => !!el && el !== inputRef.current && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    const refocus = () => { if (!isEditable(document.activeElement) && inputRef.current && !inputRef.current.disabled) inputRef.current.focus({ preventScroll: true }); };
    const onKey = (e) => {
      if (e.target === inputRef.current || isEditable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 || e.key === "Enter") refocus();
    };
    const onBlur = () => setTimeout(refocus, 100);
    const el = inputRef.current;
    document.addEventListener("keydown", onKey, true);
    el?.addEventListener("blur", onBlur);
    window.addEventListener("focus", refocus);
    return () => { document.removeEventListener("keydown", onKey, true); el?.removeEventListener("blur", onBlur); window.removeEventListener("focus", refocus); };
  }, []);

  function lookup() {
    const raw = input.trim().toUpperCase();
    if (!raw) return;
    // แตก codes ออก — กรณี scanner ยิงเร็วเกิน เคลีย์ไม่ทัน → text รวมกันมา
    // 1) ถ้ามี whitespace/comma → split
    // 2) ถ้าไม่มี → ใช้ regex match part_code patterns (พยายามจับรูปแบบ XXXXX-XXX-XXX, XXXXX-XXX, etc.)
    let codes = [];
    if (/[\s,;]/.test(raw)) {
      codes = raw.split(/[\s,;]+/).filter(Boolean);
    } else {
      // ลองดึงรหัสที่ตรงกับ part_code ใน allRows (greedy left-to-right)
      const allCodes = allRows.map(r => String(r.part_code || "").trim().toUpperCase()).filter(Boolean);
      const sortedByLen = [...new Set(allCodes)].sort((a, b) => b.length - a.length);
      let rest = raw;
      let safety = 0;
      while (rest && safety++ < 50) {
        let matched = null;
        for (const c of sortedByLen) {
          if (rest.startsWith(c)) { matched = c; break; }
        }
        if (!matched) {
          // ไม่ตรง — ลองตัดออก 1 char แล้วลองต่อ
          codes.push(rest); break;
        }
        codes.push(matched);
        rest = rest.slice(matched.length);
      }
      if (codes.length === 0) codes = [raw];
    }

    const notFoundCodes = [];
    let addedCount = 0;
    setScanned(prev => {
      const list = [...prev];
      for (const code of codes) {
        const norm = (v) => String(v || "").toUpperCase().replace(/[-\s_./]/g, "");
        let row = allRows.find(r => String(r.part_code || "").trim().toUpperCase() === code) || allRows.find(r => norm(r.part_code) === norm(code));
        if (!row && norm(code).length >= 8) { // บาร์โค้ดยามาฮ่าบางชิ้นไม่มีเลขท้าย "00" (90793AT829 → 90793AT82900): ใช้ได้เมื่อมีรหัสที่ขึ้นต้นแบบนี้เพียงรหัสเดียว (user 2026-10-27)
          const k = norm(code);
          const cands = allRows.filter(r => { const c = norm(r.part_code); return c.length > k.length && c.length - k.length <= 2 && c.startsWith(k); });
          if (cands.length === 1) row = cands[0];
        }
        if (!row) { notFoundCodes.push(code); continue; }
        if (list.some(s => s.row.part_code === row.part_code)) continue;  // skip duplicate in scanned list
        list.push({ row, stores: parseStores(row.stores), ts: Date.now() + addedCount });
        addedCount++;
      }
      return list;
    });
    if (notFoundCodes.length) {
      const msg = notFoundCodes.join(", ");
      setNotFound(msg);
      setTimeout(() => setNotFound(prev => prev === msg ? "" : prev), 4000);
    } else {
      setNotFound("");
    }
    // เคลียร์ text + focus
    setInput("");
    if (inputRef.current) inputRef.current.value = "";
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function removeScanned(idx) {
    setScanned(prev => prev.filter((_, i) => i !== idx));
  }
  function clearScanned() {
    setScanned([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function saveWithdrawal() {
    if (!scanned.length || saving) return;
    setSaving(true);
    try {
      const items = scanned.map(s => ({
        part_code: s.row.part_code,
        product_name: s.row.product_name,
        product_group: s.row.product_group,
        brand: s.row.brand,
        qty: 1,
      }));
      const res = await fetch(PW_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_part_withdrawal_batch",
          items,
          withdrawn_by: currentUser?.username || currentUser?.name || "system",
          vehicle_plate: selectedBay?.plate_no || null,
          vehicle_province: selectedBay?.plate_province || null,
          vehicle_zone: selectedBay ? selectedBay.zone_name : null,
          bay_event_id: selectedBay?.event_id || null,
        }),
      });
      await res.json().catch(() => null);
      setScanned([]);
      await loadHistory();
    } catch (e) {
      // เงียบไว้ — ถ้าผิดพลาดดูได้ที่ประวัติ
      console.error("[PartWithdrawal] save error:", e);
    }
    setSaving(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const STORE_LABELS = {
    ppao: "🟢 ป.เปา",
    haahong: "🔵 ห้าห้อง",
    sachtalad: "🟠 สช.ตลาด",
    nakhonluang: "🟣 นครหลวง",
  };

  return (
    <div className="page-container">
      {saverOn && (
        saverMode === "signage" ? (
        <div onPointerDown={() => setSaverOn(false)} onTouchStart={() => setSaverOn(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000" }}>
          <iframe title="screensaver" src={`/signage?branch=${encodeURIComponent(saverBranch)}&screen=kiosk`}
            style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "4vh", left: 0, right: 0, textAlign: "center", color: "#fff", fontSize: "2.4vh", opacity: .85, textShadow: "0 1px 6px #000" }}>
            แตะหน้าจอหรือยิงบาร์โค้ด เพื่อเริ่มเบิกอะไหล่
          </div>
        </div>
        ) : (
        /* สกรีนเซฟเวอร์โลโก้ปีกนก HONDA พื้นขาว (user 2026-11-14 คีออส ป.เปา) — โลโก้ลอยช้า ๆ กันจอค้างภาพ · ?saver=signage = กลับไปใช้จอประชาสัมพันธ์แบบเดิม */
        <div onPointerDown={() => setSaverOn(false)} onTouchStart={() => setSaverOn(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <style>{`@keyframes kioskLogoFloat { 0% { transform: translate(-3vw, -2vh) scale(1); } 25% { transform: translate(3vw, -1vh) scale(1.03); } 50% { transform: translate(2vw, 2vh) scale(1); } 75% { transform: translate(-2vw, 1.5vh) scale(0.98); } 100% { transform: translate(-3vw, -2vh) scale(1); } }`}</style>
          <img src="/logos/honda-wing-kiosk.svg" alt="HONDA" draggable={false}
            style={{ width: "min(62vw, 78vh)", maxHeight: "72vh", objectFit: "contain", animation: "kioskLogoFloat 40s ease-in-out infinite", pointerEvents: "none", userSelect: "none" }} />
          <div style={{ position: "absolute", bottom: "4vh", left: 0, right: 0, textAlign: "center", color: "#6b7280", fontSize: "2.4vh" }}>
            แตะหน้าจอหรือยิงบาร์โค้ด เพื่อเริ่มเบิกอะไหล่
          </div>
        </div>
        )
      )}
      <div className="page-topbar">
        <h2 className="page-title">📦 บันทึกการเบิกอะไหล่</h2>
      </div>

      {/* เลือกรถที่เบิกให้ — จากช่องซ่อมที่กล้องเห็นว่ามีรถ */}
      <div style={{ background: "#fff", border: selectedBay ? "3px solid #f59e0b" : "2px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <strong style={{ fontSize: 18 }}>🏍️ เลือกรถที่เบิกอะไหล่ให้ <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280" }}>(รถในช่องซ่อมตอนนี้ จากกล้อง · อัปเดตทุก {BAY_POLL_MS / 1000} วิ)</span></strong>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selectedBay && <span style={{ fontSize: 17, fontWeight: 700, color: "#b45309" }}>กำลังเบิกให้: {bayLabel(selectedBay)} · {selectedBay.zone_name}</span>}
            <button onClick={loadBays} style={{ padding: "5px 10px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>🔄</button>
          </div>
        </div>
        {bayNotice && <div style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontWeight: 600 }}>{bayNotice}</div>}
        {selectedBay && (
          <div style={{ background: selParts.length ? "#eff6ff" : "#f9fafb", border: `1px solid ${selParts.length ? "#93c5fd" : "#e5e7eb"}`, borderRadius: 8, padding: "8px 12px", marginBottom: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15, color: "#1e40af", whiteSpace: "nowrap" }}>🔩 เบิกให้คันนี้แล้ววันนี้: {shown.length ? `${shown.length} ชิ้น` : "ยังไม่มี"}</strong>
            {selParts.map(g => (
              <span key={g.code} title={g.last ? `ล่าสุด ${new Date(g.last).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.` : ""}
                style={{ fontSize: 14, background: "#fff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "3px 10px" }}>
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#072d6b" }}>{g.code}</span>{g.name ? <span style={{ color: "#374151" }}> {g.name}</span> : null}{g.n > 1 ? <b style={{ color: "#b45309" }}> ×{g.n}</b> : null}
              </span>
            ))}
            {shown.length > 0 && tab !== "log" && <button onClick={() => { setTab("log"); setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50); }} style={{ marginLeft: "auto", padding: "4px 12px", fontSize: 13, background: "#fff", border: "1px solid #93c5fd", color: "#1e40af", borderRadius: 6, cursor: "pointer" }}>ดูเวลา/ผู้เบิก ›</button>}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => { setSelectedBay(null); inputRef.current?.focus({ preventScroll: true }); setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50); }}
            style={{ padding: "14px 18px", borderRadius: 10, cursor: "pointer", fontSize: 16, fontWeight: 700, minWidth: 150,
              border: !selectedBay ? "3px solid #072d6b" : "2px solid #d1d5db", background: !selectedBay ? "#eef2ff" : "#fff", color: "#1f2937" }}>
            📦 เบิกทั่วไป<div style={{ fontSize: 14, fontWeight: 400, color: "#6b7280" }}>ไม่ระบุรถ</div>
          </button>
          {bays.map(b => {
            const sel = selectedBay && (selectedBay.event_id === b.event_id || (selectedBay.plate_no && selectedBay.plate_no === b.plate_no));
            return (
              <div key={b.event_id || b.zone_source} style={{ position: "relative" }}>
                <button onClick={() => { setSelectedBay(b); inputRef.current?.focus({ preventScroll: true }); setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50); }}
                  style={{ padding: "14px 18px", paddingRight: 36, borderRadius: 10, cursor: "pointer", textAlign: "left", minWidth: 220,
                    border: sel ? "3px solid #f59e0b" : "2px solid #d1d5db", background: sel ? "#fffbeb" : "#fff", color: "#1f2937" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", color: b.plate_no ? "#072d6b" : "#9ca3af" }}>{b.plate_no || "ไม่ทราบทะเบียน"}</div>
                  <div style={{ fontSize: 16, color: "#374151" }}>{b.plate_province || ""}</div>
                  {(() => { const n = withdrawnFor(b).length; return n > 0 ? <div style={{ position: "absolute", top: 6, right: 36, fontSize: 12, fontWeight: 700, color: "#1e40af", background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 999, padding: "1px 8px" }}>🔩 เบิกแล้ว {n}</div> : null; })()}
                  <div style={{ fontSize: 14, color: b.in_bay ? "#166534" : "#6b7280" }}>{b.in_bay ? `🟢 อยู่ใน${b.zone_name || "ช่องซ่อม"}` : `เข้ามา${b.zone_name ? " " + b.zone_name : ""}`} · {b.since_local || "-"} น. ({b.minutes} นาที)</div>
                </button>
                <button onClick={() => clearBay(b)} title="เอารถออกจากรายการ"
                  style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, border: "1px solid #fca5a5", background: "#fee2e2", color: "#b91c1c", borderRadius: 6, cursor: "pointer", fontSize: 12, lineHeight: "20px", padding: 0 }}>✕</button>
              </div>
            );
          })}
          {baysLoaded && bays.length === 0 && <span style={{ alignSelf: "center", color: "#9ca3af", fontSize: 14 }}>ยังไม่มีรถเข้าช่องซ่อมวันนี้</span>}
        </div>
      </div>

      {/* Scan input */}
      {/* คีออส (user 2026-11-05): กล่องเตี้ยลง + ปุ่มบันทึกอยู่ข้างช่องยิง กดได้ทันทีไม่ต้องเลื่อนลงล่าง */}
      <div style={{ background: "#072d6b", padding: "10px 14px", borderRadius: 12, marginBottom: 12, color: "#fff" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          <label style={{ display: "flex", alignItems: "center", fontSize: 16, fontWeight: 700, whiteSpace: "nowrap" }}>📷 สแกน</label>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") lookup(); }}
            placeholder={loadingMaster ? "กำลังโหลดข้อมูล..." : "ยิงบาร์โค้ด / พิมพ์รหัส"}
            disabled={loadingMaster}
            autoFocus
            style={{
              flex: 1, minWidth: 0, padding: "8px 14px", fontSize: 24, fontWeight: 700,
              fontFamily: "monospace", border: "3px solid #fff", borderRadius: 10,
              background: "#fff", color: "#072d6b", letterSpacing: 1,
            }}
          />
          <button onClick={lookup} disabled={loadingMaster || !input.trim()}
            style={{
              padding: "0 18px", background: "#10b981", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 18, fontWeight: 700, cursor: "pointer",
            }}>
            🔍 ค้นหา
          </button>
          <button onClick={saveWithdrawal} disabled={scanned.length === 0}
            title={scanned.length ? `บันทึกการเบิก ${scanned.length} รายการ${selectedBay ? ` ให้รถ ${selectedBay.plate_no || "ไม่ทราบทะเบียน"}` : " (เบิกทั่วไป)"}` : "ยิงรหัสอะไหล่ก่อน"}
            style={{
              padding: "0 22px", background: scanned.length ? "#f59e0b" : "#475569", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 20, fontWeight: 800, cursor: scanned.length ? "pointer" : "not-allowed",
              boxShadow: scanned.length ? "0 3px 10px rgba(245,158,11,0.5)" : "none", whiteSpace: "nowrap",
            }}>
            ✅ บันทึกเบิก{scanned.length ? ` (${scanned.length})` : ""}
          </button>
        </div>
      </div>

      {/* Not found — แสดงชั่วคราว 4 วินาที */}
      {notFound && (
        <div style={{ background: "#fef2f2", border: "2px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>❌</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#991b1b" }}>ไม่พบรหัสอะไหล่: {notFound}</div>
            <div style={{ fontSize: 12, color: "#7f1d1d" }}>ตรวจสอบรหัสและสแกนใหม่</div>
          </div>
          <button onClick={() => setNotFound("")} style={{ padding: "5px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>×</button>
        </div>
      )}

      {/* Scanned list */}
      {scanned.length > 0 && (
        <div style={{ background: "#f0fdf4", border: "3px solid #10b981", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ padding: "8px 16px", background: "#10b981", color: "#fff", fontWeight: 700, fontSize: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>📋 รายการที่สแกนแล้ว ({scanned.length} รายการ)</span>
            <button onClick={clearScanned} style={{ padding: "5px 12px", background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid #fff", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
              🗑 ล้างทั้งหมด
            </button>
          </div>

          {scanned.map((s, idx) => (
            <div key={s.ts} style={{
              padding: 16, borderTop: idx > 0 ? "1px solid #d1fae5" : "none",
              display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center",
              background: "#fff",
            }}>
              <div>
                {/* รหัส + ชื่อ */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "#072d6b", fontFamily: "monospace", letterSpacing: 1 }}>
                    {s.row.part_code}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 600, color: "#1f2937" }}>
                    {s.row.product_name || "-"}
                  </span>
                  {s.row.brand && <span style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 10 }}>{s.row.brand}</span>}
                </div>
                {/* ที่เก็บ + qty 4 ร้าน แบบ inline */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(STORE_LABELS).map(([key, label]) => {
                    const st = s.stores[key];
                    const hasStock = st && st !== "-" && Number(st.qty) > 0;
                    if (!hasStock) return null;
                    return (
                      <div key={key} style={{
                        padding: "6px 12px", borderRadius: 8,
                        background: "#dcfce7", border: "1px solid #10b981",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>{label}</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: "#059669", fontFamily: "monospace" }}>{st.qty}</span>
                        {st.loc && <span style={{ fontSize: 15, fontWeight: 700, color: "#072d6b" }}>📍 {st.loc}</span>}
                      </div>
                    );
                  })}
                  {Object.values(s.stores).every(v => !v || v === "-" || Number(v.qty || 0) === 0) && (
                    <span style={{ fontSize: 15, color: "#dc2626", fontWeight: 600 }}>⚠️ ไม่มีของในทุกร้าน</span>
                  )}
                </div>
              </div>
              <button onClick={() => removeScanned(idx)} title="ลบออกจากรายการ" style={{
                width: 40, height: 40, background: "#fee2e2", color: "#dc2626",
                border: "1px solid #fca5a5", borderRadius: 8, cursor: "pointer",
                fontSize: 18, fontWeight: 700,
              }}>✕</button>
            </div>
          ))}

        </div>
      )}

      {/* แท็บใต้ช่องยิง (user 2026-10-31): ประวัติการเบิก | รถ & ประวัติบริการ */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {[["day", `🔩 รถวันนี้ (${dayVehicles.filter(v => v.plate).length})`], ["log", "📋 ประวัติการเบิก"], ...(isKiosk ? [] : [["svc", `🏍️ รถ & ประวัติบริการ${selectedBay?.plate_no ? ` · ${selectedBay.plate_no}` : ""}`]])].map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50); }}
            style={{ padding: "10px 18px", borderRadius: "10px 10px 0 0", border: "1px solid #e5e7eb", borderBottom: tab === k ? "1px solid #fff" : "1px solid #e5e7eb", background: tab === k ? "#fff" : "#f3f4f6", color: tab === k ? "#072d6b" : "#6b7280", fontWeight: 700, fontSize: 17, cursor: "pointer", marginBottom: -9 }}>
            {label}
          </button>
        ))}
      </div>
      {/* สรุปรถทั้งวัน: ย้ายจากด้านบนมาเป็นแท็บใต้ช่องสแกน (2026-11-14) — ตอนอยู่บนสุดมันดันช่องสแกน/ปุ่มบันทึกตกขอบล่างจอคีออส 1280x800 */}
      {tab === "day" && (dayVehicles.length > 0 ? (
          <div style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
            <strong style={{ fontSize: 15, color: "#1e40af" }}>🔩 รถวันนี้ {dayVehicles.filter(v => v.plate).length} คัน · เบิกแล้ว {dayVehicles.filter(v => v.plate && v.rows.length).length} คัน {withdrawn.length} ชิ้น</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 6, marginTop: 6 }}>
              {dayVehicles.map(v => (
                <div key={v.key} style={{ background: v.rows.length ? "#fff" : "#f8fafc", border: `1px solid ${v.rows.length ? "#bfdbfe" : "#e5e7eb"}`, borderRadius: 8, padding: "6px 10px", display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 18, color: v.plate ? "#072d6b" : "#9ca3af", whiteSpace: "nowrap" }}>{v.plate || (v.key === "general" ? "เบิกทั่วไป" : "ไม่ทราบทะเบียน")}</span>
                  {v.province && <span style={{ fontSize: 12, color: "#6b7280" }}>{v.province}</span>}
                  {v.first ? <span style={{ fontSize: 12, color: "#9ca3af" }}>เบิกแรก {new Date(v.first).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</span> : (v.since ? <span style={{ fontSize: 12, color: "#9ca3af" }}>เข้ามา {v.since} น.{v.zone ? ` · ${v.zone}` : ""}</span> : null)}
                  {v.rows.length > 0 ? (
                    <span style={{ fontSize: 13, color: "#374151", flexBasis: "100%" }}>
                      {summarizeParts(v.rows).map(g => `${g.code}${g.name ? " " + g.name : ""}${g.n > 1 ? " ×" + g.n : ""}`).join(" · ")}
                    </span>
                  ) : <span style={{ fontSize: 13, color: "#9ca3af", flexBasis: "100%" }}>ยังไม่เบิกอะไหล่</span>}
                </div>
              ))}
            </div>
          </div>
        ) : <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีรถเข้าช่องซ่อมหรือการเบิกวันนี้</div>)}
      {tab === "svc" && !isKiosk && <VehicleServicePanel plate={selectedBay?.plate_no || ""} province={selectedBay?.plate_province || ""} />}

      {/* Withdrawal log */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", display: tab === "log" ? "block" : "none" }}>
        <div style={{ padding: "10px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <strong>📋 ประวัติการเบิก ({shown.length} รายการ{selectedBay ? ` · เฉพาะรถ ${selectedBay.plate_no || "ไม่ทราบทะเบียน"}` : ""})</strong>
              {copied && <span style={{ marginLeft: 10, fontSize: 12.5, color: "#065f46", background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 6, padding: "3px 10px" }}>✅ {copied}</span>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => {
              const d = new Date(historyDate); d.setDate(d.getDate() - 1);
              setHistoryDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
            }} style={{ padding: "5px 10px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>◀ วันก่อน</button>
            <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}
              style={{ padding: "5px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
            <button onClick={() => {
              const d = new Date(historyDate); d.setDate(d.getDate() + 1);
              setHistoryDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
            }} style={{ padding: "5px 10px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>วันถัดไป ▶</button>
            <button onClick={() => setHistoryDate(todayISO())} style={{ padding: "5px 10px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>วันนี้</button>
            <button onClick={loadHistory} style={{ padding: "5px 10px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>🔄 รีเฟรช</button>
          </div>
        </div>
        {shown.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>{selectedBay ? "รถคันนี้ยังไม่มีการเบิกในวันที่เลือก" : "ยังไม่มีรายการ"}</div>
        ) : (
          <div style={{ maxHeight: 500, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f3f4f6", position: "sticky", top: 0, zIndex: 1 }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>เวลา</th>
                  <th style={th}>รหัสอะไหล่</th>
                  <th style={th}>ชื่อ</th>
                  <th style={th}>รถ</th>
                  <th style={th}>ผู้เบิก</th>
                  <th style={th}>Batch</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // จัดกลุ่ม: ผู้เบิกคนเดิม สแกนห่างจากรายการก่อนหน้าไม่เกิน 60 วินาที = กลุ่มเดียวกัน แม้คนละ Batch (คีออสเคยออกเลขใหม่ทุกสแกน) — user 2026-10-12
                  const GROUP_GAP_MS = 60 * 1000;
                  const groups = []; const groupOf = [];
                  shown.forEach((w, i) => {
                    const prev = i > 0 ? shown[i - 1] : null;
                    const gap = prev ? Math.abs(new Date(prev.withdrawn_at) - new Date(w.withdrawn_at)) : Infinity;
                    const same = !!prev && String(prev.withdrawn_by || "") === String(w.withdrawn_by || "") && (gap <= GROUP_GAP_MS || prev.batch_no === w.batch_no);
                    if (!same) groups.push({ start: i, batches: [], codes: [], keys: [] });
                    const g = groups[groups.length - 1];
                    if (w.batch_no && !g.batches.includes(w.batch_no)) g.batches.push(w.batch_no);
                    if (w.part_code) { g.codes.push(String(w.part_code)); g.keys.push(rowKey(w, i)); }
                    groupOf[i] = g;
                  });
                  return shown.map((w, i) => {
                  const g = groupOf[i];
                  const isNewBatch = g.start === i;
                  const batchLabel = g.batches.length > 1 ? `${g.batches[g.batches.length - 1]} – ${g.batches[0]} (${g.batches.length} ชุด)` : (g.batches[0] || "-");
                  return (
                    <React.Fragment key={w.id || i}>
                      {isNewBatch && (
                        <tr>
                          <td colSpan={7} style={{ background: "#eef2ff", color: "#3730a3", fontSize: 12, fontWeight: 700, padding: "6px 10px", borderTop: i > 0 ? "3px solid #6366f1" : "none" }}>
                            ━━━ Batch <span style={{ fontFamily: "monospace", color: "#1e40af" }}>{batchLabel}</span> · {new Date(w.withdrawn_at).toLocaleString("th-TH")} · ผู้เบิก: {w.withdrawn_by || "-"} ━━━
                            {g.codes.length > 0 && copyBtn(g.codes.join("\n"), `คัดลอกรหัสทั้งกลุ่ม ${g.codes.length} รหัส (บรรทัดละรหัส)`, `คัดลอก ${g.codes.length} รหัสแล้ว`, () => markCopied(g.keys), g.keys.length > 0 && g.keys.every(k => copiedRows.has(k)))}
                          </td>
                        </tr>
                      )}
                      <tr style={{ borderTop: "1px solid #f3f4f6", background: lastCopiedRow === rowKey(w, i) ? "#fef08a" : copiedRows.has(rowKey(w, i)) ? "#f0fdf4" : "transparent", transition: "background .3s" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={td}>{w.withdrawn_at ? new Date(w.withdrawn_at).toLocaleTimeString("th-TH") : "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#0369a1", whiteSpace: "nowrap" }}>{w.part_code}{w.part_code ? copyBtn(String(w.part_code), "คัดลอกรหัสนี้", `คัดลอก ${w.part_code} แล้ว`, () => markCopied([rowKey(w, i)]), copiedRows.has(rowKey(w, i))) : null}</td>
                        <td style={td}>{w.product_name}</td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>{w.vehicle_plate ? <span title={w.vehicle_zone || ""}><b style={{ fontFamily: "monospace", color: "#b45309" }}>{w.vehicle_plate}</b>{w.vehicle_province ? ` ${w.vehicle_province}` : ""}</span> : (w.vehicle_zone ? <span style={{ color: "#9ca3af" }}>{w.vehicle_zone}</span> : <span style={{ color: "#d1d5db" }}>-</span>)}</td>
                        <td style={td}>{w.withdrawn_by}</td>
                        <td style={{ ...td, fontFamily: "monospace", color: "#6366f1" }}>{w.batch_no}</td>
                      </tr>
                    </React.Fragment>
                  );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const th = { padding: "7px 10px", textAlign: "left", fontWeight: 700, fontSize: 14, color: "#374151" };
const td = { padding: "6px 10px", fontSize: 14 };
