import React, { useEffect, useState } from "react";

// รายการสั่งอะไหล่รายวัน — รวม 3 ระบบ: HONDA / YAMAHA / นอกเงินมัดจำ (เลือกวันย้อนหลังได้)
const HONDA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api";
const YAMAHA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/yamaha-spare-api";
const OUTSIDE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/outside-deposit-api";
// ประวัติเบิกอะไหล่แยกตามรุ่นรถ (รายงานรหัสอะไหล่ใช้กับรุ่น) — ใช้ติ๊ก ✓ ว่าอะไหล่ที่สั่งเคยใช้กับแบบรถนี้จริง
const SERVICE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/service-history-api";

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}
function norm(d) {
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.rows)) return d.rows;
  return [];
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// เทียบวันที่แบบเวลาไทย (created_at เป็น UTC timestamp)
function thaiDateOf(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d)) return String(ts).slice(0, 10);
  const t = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
function thaiTimeOf(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  if (isNaN(d)) return "-";
  const t = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
}
function fmtThaiDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
}

const SYSTEMS = [
  { key: "HONDA", label: "HONDA", color: "#dc2626" },
  { key: "YAMAHA", label: "YAMAHA", color: "#2563eb" },
  { key: "OUTSIDE", label: "นอกเงินมัดจำ", color: "#7c3aed" },
];

const strip = (s) => String(s || "").replace(/[-\s]/g, "").toUpperCase();
// จัดรหัสอะไหล่ให้มีขีดแบบ Honda (5-3-ท้าย) — รหัสจากไฟล์ DCS ไม่มีขีด อ่านเทียบกับรหัสที่สั่งยาก
const fmtPartCode = (s) => {
  const c = strip(s);
  return c.length >= 10 ? `${c.slice(0, 5)}-${c.slice(5, 8)}-${c.slice(8)}` : String(s || "");
};

export default function SparePartsDailyOrdersPage({ currentUser }) {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState([]);        // order + system + items
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [filterSystem, setFilterSystem] = useState("all");
  const [usageMap, setUsageMap] = useState(null); // strip(part_code) → [{base, type}] จาก part_model_usage
  const [dcsByOrder, setDcsByOrder] = useState({});   // order_id → รายการอะไหล่จากใบรับสั่งซื้อที่ upload (dcs_spare_orders)
  const [subsOrders, setSubsOrders] = useState(new Set()); // order_id ที่บันทึกอะไหล่ทดแทนแล้ว (part_substitutes)
  const [subsByOrder, setSubsByOrder] = useState({});      // order_id → คู่อะไหล่ทดแทนที่บันทึกแล้ว (ไว้โชว์รหัส)
  const [knownPairs, setKnownPairs] = useState(new Set()); // "เดิม|ทดแทน" ทุกคู่ที่เคยบันทึกจากใบไหนก็ได้ — กันบันทึกซ้ำ
  const [savingSub, setSavingSub] = useState(null);

  useEffect(() => { load(date); /* eslint-disable-next-line */ }, [date]);

  // โหลดประวัติเบิกอะไหล่ตามรุ่นครั้งเดียว — ไว้เทียบกับ รุ่น/แบบ/type ที่บันทึกในใบสั่งซื้อ
  useEffect(() => {
    let alive = true;
    fetch(SERVICE_API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "part_model_usage" }),
    })
      .then(res => res.json())
      .then(d => {
        if (!alive) return;
        const rows = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
        const map = {};
        for (const r of rows) {
          const code = String(r.part_code || "").replace(/[-\s]/g, "").toUpperCase();
          if (!code) continue;
          // model_code เช่น "ACB160CATN (TH)" → base=ACB160CATN, type=TH
          const m = String(r.model_code || "").match(/^(\S+)\s*(?:\(([^)]*)\))?/);
          if (!m || !m[1]) continue;
          (map[code] = map[code] || []).push({ base: m[1].toUpperCase(), type: (m[2] || "").trim().toUpperCase() });
        }
        setUsageMap(map);
      })
      .catch(() => { if (alive) setUsageMap({}); });
    return () => { alive = false; };
  }, []);

  // อะไหล่ตัวนี้เคยเบิกกับแบบรถของใบสั่งซื้อนี้ไหม — ไม่เคย/ไม่มีข้อมูลรถ = ไม่แสดงอะไร
  function partMatchesVehicle(order, item) {
    if (!usageMap || !order.vehicle_variant) return false;
    const code = String(item.part_code || "").replace(/[-\s]/g, "").toUpperCase();
    const list = usageMap[code];
    if (!list) return false;
    const variant = String(order.vehicle_variant).toUpperCase();
    const vtype = String(order.vehicle_type || "").trim().toUpperCase();
    return list.some(u => u.base === variant && (!u.type || !vtype || u.type === vtype));
  }

  async function load(day) {
    setLoading(true);
    setMessage("");
    const out = [];
    // โหลด 3 ระบบพร้อมกัน — ระบบไหนพังไม่ล้มทั้งหน้า
    const [honda, yamaha, outside] = await Promise.all([
      post(HONDA_API, { action: "get_spare_orders" }).then(norm).catch(() => []),
      post(YAMAHA_API, { action: "get_yamaha_orders" }).then(norm).catch(() => []),
      post(OUTSIDE_API, { action: "get_orders" }).then(norm).catch(() => []),
    ]);
    const pick = (list) => list.filter(o => thaiDateOf(o.created_at) === day);
    const hondaDay = pick(honda), yamahaDay = pick(yamaha), outsideDay = pick(outside);
    // ดึงรายการอะไหล่ของใบที่อยู่ในวันนั้น (รายวันมีไม่กี่ใบ)
    const detail = (url, action, o) =>
      post(url, { action, order_id: o.order_id }).then(norm).catch(() => []);
    const [hi, yi, oi] = await Promise.all([
      Promise.all(hondaDay.map(o => detail(HONDA_API, "get_spare_order_detail", o))),
      Promise.all(yamahaDay.map(o => detail(YAMAHA_API, "get_yamaha_order_detail", o))),
      Promise.all(outsideDay.map(o => detail(OUTSIDE_API, "get_order_detail", o))),
    ]);
    hondaDay.forEach((o, i) => out.push({ ...o, system: "HONDA", items: hi[i] }));
    yamahaDay.forEach((o, i) => out.push({ ...o, system: "YAMAHA", items: yi[i] }));
    outsideDay.forEach((o, i) => out.push({ ...o, system: "OUTSIDE", items: oi[i] }));
    out.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
    setRows(out);
    setLoading(false);
    // เทียบกับใบรับสั่งซื้อที่ upload (dcs_spare_orders) — จับคู่ด้วยเลขที่ใบรับสั่งซื้อ (เฉพาะระบบ HONDA)
    const hondaWithPo = out.filter(r => r.system === "HONDA" && r.vendor_po_no);
    Promise.all(hondaWithPo.map(o =>
      post(HONDA_API, { action: "search_dcs_orders", vendor_po_no: o.vendor_po_no }).then(norm).catch(() => [])
    )).then(res => {
      const m = {};
      hondaWithPo.forEach((o, i) => { m[o.order_id] = res[i]; });
      setDcsByOrder(m);
    });
    // ใบที่เคยบันทึกอะไหล่ทดแทนแล้ว — เก็บคู่รหัสไว้แสดงด้วย
    post(HONDA_API, { action: "get_part_substitutes" }).then(norm)
      .then(list => {
        setSubsOrders(new Set(list.map(s => String(s.order_id))));
        const m = {};
        for (const s of list) (m[String(s.order_id)] = m[String(s.order_id)] || []).push(s);
        setSubsByOrder(m);
        setKnownPairs(new Set(list.map(s => `${strip(s.original_code)}|${strip(s.substitute_code)}`)));
      })
      .catch(() => {});
  }

  // สถานะเทียบใบสั่งซื้อ vs อะไหล่ที่ DCS ส่งมาจริง: 'match' ตรงครบ | 'mismatch' มีตัวไม่ตรง | null ไม่มีข้อมูล
  function dcsStatus(r) {
    if (r.system !== "HONDA" || !r.vendor_po_no) return null;
    const dcs = dcsByOrder[r.order_id];
    if (!dcs || dcs.length === 0) return null;
    const orderCodes = (r.items || []).map(it => strip(it.part_code));
    const invalid = dcs.filter(d => !orderCodes.includes(strip(d.part_number)));
    return invalid.length === 0 ? "match" : "mismatch";
  }

  // จับคู่อะไหล่ทดแทน: DCS ที่ไม่ตรง × รายการสั่งที่ยังไม่ match — กลุ่มรหัสเดียวกัน (5 ตัวหน้า เช่น 91212) ก่อน แล้วค่อยเทียบชื่อคล้าย
  function buildSubstitutePairs(r) {
    const dcs = dcsByOrder[r.order_id] || [];
    const orderCodes = (r.items || []).map(it => strip(it.part_code));
    const invalid = dcs.filter(d => !orderCodes.includes(strip(d.part_number)));
    const waiting = (r.items || []).filter(it => !dcs.some(d => strip(d.part_number) === strip(it.part_code)));
    const used = new Set();
    return invalid.map(d => {
      const dc = strip(d.part_number);
      let bestIdx = -1, bestScore = 0;
      waiting.forEach((it, idx) => {
        if (used.has(idx)) return;
        const oc = strip(it.part_code);
        if (dc.slice(0, 5) && dc.slice(0, 5) === oc.slice(0, 5)) { bestScore = 100; bestIdx = idx; return; }
        const dn = String(d.part_description || "").toLowerCase();
        const on = String(it.part_name || "").toLowerCase();
        const score = [...on].filter((c, ci) => dn[ci] === c).length;
        if (score > bestScore) { bestScore = score; bestIdx = idx; }
      });
      if (bestIdx >= 0) used.add(bestIdx);
      const m = bestIdx >= 0 ? waiting[bestIdx] : null;
      return {
        original_code: m?.part_code || "", original_name: m?.part_name || "",
        substitute_code: d.part_number || "", substitute_name: d.part_description || "",
      };
    });
  }

  // คู่นี้เคยบันทึกลงตารางอะไหล่ใช้แทนกันแล้วหรือยัง (จากใบไหนก็ได้)
  const pairKnown = (p) => knownPairs.has(`${strip(p.original_code)}|${strip(p.substitute_code)}`);

  // รหัสทดแทนของอะไหล่ตัวนี้ (ถ้ามี) — ไว้แสดงต่อท้ายบรรทัดอะไหล่ที่ถูกแทน
  function substituteFor(r, it) {
    if (dcsStatus(r) !== "mismatch") return null;
    const pairs = subsOrders.has(String(r.order_id))
      ? (subsByOrder[String(r.order_id)] || [])
      : buildSubstitutePairs(r);
    const p = pairs.find(x => x.original_code && strip(x.original_code) === strip(it.part_code));
    return p ? p.substitute_code : null;
  }

  async function saveSubstitute(r) {
    if (savingSub) return;
    setSavingSub(r.order_id);
    setMessage("");
    try {
      // ตัดคู่ที่เคยบันทึกไว้แล้ว (จากใบไหนก็ได้) — กันข้อมูลซ้ำในตาราง
      const pairs = buildSubstitutePairs(r).filter(p => !pairKnown(p));
      if (!pairs.length) {
        setSubsOrders(prev => new Set([...prev, String(r.order_id)]));
        setMessage("คู่อะไหล่ทดแทนของใบนี้เคยบันทึกไว้แล้ว — ไม่บันทึกซ้ำ");
        setSavingSub(null);
        return;
      }
      await post(HONDA_API, { action: "save_part_substitutes", order_id: r.order_id, pairs, approved_by: currentUser?.name || "" });
      setSubsOrders(prev => new Set([...prev, String(r.order_id)]));
      setSubsByOrder(prev => ({ ...prev, [String(r.order_id)]: pairs }));
      setKnownPairs(prev => new Set([...prev, ...pairs.map(p => `${strip(p.original_code)}|${strip(p.substitute_code)}`)]));
      setMessage(`✅ บันทึกอะไหล่ทดแทนแล้ว ${pairs.length} คู่ (ใบ ${r.vendor_po_no})`);
    } catch { setMessage("❌ บันทึกอะไหล่ทดแทนไม่สำเร็จ"); }
    setSavingSub(null);
  }

  function shiftDay(n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }

  const filtered = rows.filter(r => filterSystem === "all" || r.system === filterSystem);
  const totalItems = filtered.reduce((s, r) => s + (r.items || []).reduce((s2, it) => s2 + (Number(it.quantity) || 0), 0), 0);

  function printReport() {
    const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    let body = "";
    filtered.forEach((r, i) => {
      const sys = SYSTEMS.find(s => s.key === r.system);
      const items = (r.items || []).map((it, k) => {
        const sub = substituteFor(r, it);
        return `<div class="it${k < (r.items || []).length - 1 ? " sep" : ""}">${esc(it.part_code || "-")} · ${esc(it.part_name || "-")} × ${Number(it.quantity) || 0}${partMatchesVehicle(r, it) ? ' <span style="color:#059669;font-weight:800">&#10003;</span>' : ""}${sub ? ` <span style="color:#d97706;font-weight:700">&#8594; ${esc(fmtPartCode(sub))}</span>` : ""}</div>`;
      }).join("");
      body += `<tr>
        <td class="c">${i + 1}</td><td class="c">${thaiTimeOf(r.created_at)}</td>
        <td>${esc(sys?.label || r.system)}</td>
        <td>${esc(r.vendor_po_no || "-")}</td>
        <td>${esc(r.model_name || "-")}${(r.vehicle_series || r.vehicle_variant) ? `<div style="font-size:9px;color:#555">${esc([r.vehicle_series, r.vehicle_variant, r.vehicle_type].filter(Boolean).join(" / "))}${r.vehicle_color ? ` · สี ${esc(r.vehicle_color)}` : ""}</div>` : ""}</td>
        <td class="items">${items || "-"}</td>
        <td class="c">${(() => {
          const st = dcsStatus(r);
          if (st !== "mismatch") return "";
          const allPairs = buildSubstitutePairs(r);
          const done = subsOrders.has(String(r.order_id)) || (allPairs.length > 0 && allPairs.every(pairKnown));
          return done ? "ทดแทนแล้ว" : "มีอะไหล่ทดแทน (ยังไม่บันทึก)";
        })()}</td>
      </tr>`;
    });
    const w = window.open("", "_blank", "width=1200,height=800");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายการสั่งอะไหล่รายวัน</title>
<style>@page{size:A4 landscape;margin:10mm} body{font-family:Tahoma,Sarabun,sans-serif;font-size:11px;padding:12px}
h2{margin:0 0 4px;font-size:16px} .info{color:#555;font-size:12px;margin-bottom:10px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#072d6b;color:#fff;font-size:10px} .c{text-align:center}
.items{padding:0} .it{text-align:left;padding:3px 6px} .sep{border-bottom:1px solid #ddd}
@media print{body{padding:0}}</style></head><body>
<h2>รายการสั่งอะไหล่รายวัน</h2>
<div class="info">วันที่: ${fmtThaiDate(date)} | ระบบ: ${filterSystem === "all" ? "ทั้งหมด" : (SYSTEMS.find(s => s.key === filterSystem)?.label || filterSystem)} | ${filtered.length} ใบ · ${totalItems} ชิ้น | พิมพ์: ${new Date().toLocaleString("th-TH")}</div>
<table><thead><tr><th>#</th><th>เวลา</th><th>ระบบ</th><th>เลขที่ใบรับสั่งซื้อ</th><th>รุ่นรถ</th><th>รายการอะไหล่</th><th>สถานะอะไหล่ทดแทน</th></tr></thead>
<tbody>${body || `<tr><td colspan="7" class="c">ไม่มีรายการ</td></tr>`}</tbody></table>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  const th = { border: "1px solid #1e3a5f", padding: "8px 10px", textAlign: "left", fontSize: 12, whiteSpace: "nowrap" };
  const td = { border: "1px solid #e5e7eb", padding: "6px 10px", fontSize: 13, verticalAlign: "top" };
  const center = { textAlign: "center", padding: 24, color: "#6b7280" };
  const btn = { padding: "8px 14px", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" };

  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 className="page-title">📋 รายการสั่งอะไหล่รายวัน</h2>
      </div>

      {/* เลือกวัน — ย้อนหลังได้ */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => shiftDay(-1)} style={{ ...btn, background: "#e5e7eb", color: "#111" }} title="วันก่อนหน้า">◀</button>
        <input type="date" value={date} max={todayISO()} onChange={e => e.target.value && setDate(e.target.value)}
          style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14 }} />
        <button onClick={() => shiftDay(1)} disabled={date >= todayISO()}
          style={{ ...btn, background: date >= todayISO() ? "#f3f4f6" : "#e5e7eb", color: date >= todayISO() ? "#9ca3af" : "#111", cursor: date >= todayISO() ? "not-allowed" : "pointer" }} title="วันถัดไป">▶</button>
        <button onClick={() => setDate(todayISO())} style={{ ...btn, background: "#072d6b", color: "#fff" }}>วันนี้</button>
        <button onClick={() => load(date)} style={{ ...btn, background: "#0e7490", color: "#fff" }}>รีเฟรช</button>
        <button onClick={printReport} disabled={loading || filtered.length === 0} style={{ ...btn, background: "#6b7280", color: "#fff" }}>พิมพ์</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#072d6b" }}>
          {fmtThaiDate(date)} — {filtered.length} ใบ · {totalItems} ชิ้น
        </span>
      </div>

      {/* filter ระบบ */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => setFilterSystem("all")}
          style={{ ...btn, padding: "5px 12px", fontSize: 12, background: filterSystem === "all" ? "#072d6b" : "#fff", color: filterSystem === "all" ? "#fff" : "#111", border: "1px solid #d1d5db" }}>
          ทั้งหมด ({rows.length})
        </button>
        {SYSTEMS.map(s => (
          <button key={s.key} onClick={() => setFilterSystem(s.key)}
            style={{ ...btn, padding: "5px 12px", fontSize: 12, background: filterSystem === s.key ? s.color : "#fff", color: filterSystem === s.key ? "#fff" : s.color, border: `1px solid ${s.color}` }}>
            {s.label} ({rows.filter(r => r.system === s.key).length})
          </button>
        ))}
      </div>

      {message && <div style={{ marginBottom: 10, color: "#b91c1c", fontSize: 13 }}>{message}</div>}

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={th}>#</th>
              <th style={th}>เวลา</th>
              <th style={th}>ระบบ</th>
              <th style={th}>เลขที่ใบรับสั่งซื้อ</th>
              <th style={th}>รุ่นรถ</th>
              <th style={th}>รายการอะไหล่</th>
              <th style={th}>สถานะอะไหล่ทดแทน</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={center}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={center}>ไม่มีรายการสั่งอะไหล่ในวันนี้</td></tr>
            ) : filtered.map((r, i) => {
              const sys = SYSTEMS.find(s => s.key === r.system);
              return (
                <tr key={`${r.system}-${r.order_id}`} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                  <td style={{ ...td, textAlign: "center" }}>{thaiTimeOf(r.created_at)}</td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "#fff", background: sys?.color || "#6b7280" }}>
                      {sys?.label || r.system}
                    </span>
                  </td>
                  <td style={td}>{r.vendor_po_no || "-"}</td>
                  <td style={td}>
                    <div>{r.model_name || "-"}</div>
                    {/* รุ่น/แบบ/type/สี ที่บันทึกไว้ในใบสั่งซื้อ (ค้นจากเลขตัวถังใบมัดจำ — มีเฉพาะระบบ HONDA) */}
                    {(r.vehicle_series || r.vehicle_variant) && (
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                        {[r.vehicle_series, r.vehicle_variant, r.vehicle_type].filter(Boolean).join(" / ")}
                        {r.vehicle_color ? ` · สี ${r.vehicle_color}` : ""}
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "left", padding: 0 }}>
                    {(r.items || []).length === 0 ? <div style={{ padding: "6px 10px" }}>-</div> : (r.items || []).map((it, k) => (
                      <div key={k} style={{ whiteSpace: "nowrap", textAlign: "left", padding: "6px 10px", borderBottom: k < r.items.length - 1 ? "1px solid #e5e7eb" : "none" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 12 }}>{it.part_code || "-"}</span>
                        {" · "}{it.part_name || "-"}{" × "}<b>{Number(it.quantity) || 0}</b>
                        {partMatchesVehicle(r, it) && (
                          <span title="เคยเบิกอะไหล่ตัวนี้กับแบบรถนี้ในประวัติซ่อม — ตรงรุ่น" style={{ color: "#059669", fontWeight: 800, marginLeft: 6 }}>✓</span>
                        )}
                        {(() => {
                          const sub = substituteFor(r, it);
                          return sub ? (
                            <span title="อะไหล่ทดแทนที่ DCS ส่งมาแทนตัวนี้" style={{ color: "#d97706", fontWeight: 700, marginLeft: 8, fontFamily: "monospace", fontSize: 12 }}>
                              → {fmtPartCode(sub)}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    ))}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {(() => {
                      const st = dcsStatus(r);
                      if (st !== "mismatch") return null; // ตรงกัน/ยังไม่มีข้อมูล upload — ไม่แสดงอะไร
                      // ใบนี้บันทึกแล้ว หรือทุกคู่เคยถูกบันทึกจากใบอื่นแล้ว → ไม่ให้กดซ้ำ
                      const allPairs = buildSubstitutePairs(r);
                      if (subsOrders.has(String(r.order_id)) || (allPairs.length > 0 && allPairs.every(pairKnown))) {
                        return <span style={{ color: "#059669", fontWeight: 700, fontSize: 12 }}>✓ ทดแทนแล้ว</span>;
                      }
                      return (
                        <button onClick={() => saveSubstitute(r)} disabled={savingSub === r.order_id}
                          title="อะไหล่ที่ DCS ส่งมาไม่ตรงกับที่สั่ง — จับคู่เป็นอะไหล่ใช้แทนกัน (กลุ่มรหัสเดียวกัน/ชื่อคล้ายกัน) แล้วบันทึกลงตารางอะไหล่ใช้แทนกัน"
                          style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: savingSub === r.order_id ? "wait" : "pointer", whiteSpace: "nowrap" }}>
                          {savingSub === r.order_id ? "กำลังบันทึก…" : "บันทึกอะไหล่ทดแทน"}
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
