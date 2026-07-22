import React, { useEffect, useState } from "react";

// รายการสั่งอะไหล่รายวัน — รวม 3 ระบบ: HONDA / YAMAHA / นอกเงินมัดจำ (เลือกวันย้อนหลังได้)
const HONDA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api";
const YAMAHA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/yamaha-spare-api";
const OUTSIDE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/outside-deposit-api";

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

export default function SparePartsDailyOrdersPage() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState([]);        // order + system + items
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [filterSystem, setFilterSystem] = useState("all");

  useEffect(() => { load(date); /* eslint-disable-next-line */ }, [date]);

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
      const items = (r.items || []).map(it =>
        `<div>${esc(it.part_code || "-")} · ${esc(it.part_name || "-")} × ${Number(it.quantity) || 0}</div>`).join("");
      body += `<tr>
        <td class="c">${i + 1}</td><td class="c">${thaiTimeOf(r.created_at)}</td>
        <td>${esc(sys?.label || r.system)}</td>
        <td>${esc(r.deposit_doc_no || r.order_no || "#" + r.order_id)}</td>
        <td>${esc(r.model_name || "-")}</td>
        <td>${items || "-"}</td>
        <td class="c">${esc(r.status || "-")}</td>
        <td>${esc(r.vendor_po_no || "-")}</td>
      </tr>`;
    });
    const w = window.open("", "_blank", "width=1200,height=800");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายการสั่งอะไหล่รายวัน</title>
<style>@page{size:A4 landscape;margin:10mm} body{font-family:Tahoma,Sarabun,sans-serif;font-size:11px;padding:12px}
h2{margin:0 0 4px;font-size:16px} .info{color:#555;font-size:12px;margin-bottom:10px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#072d6b;color:#fff;font-size:10px} .c{text-align:center}
@media print{body{padding:0}}</style></head><body>
<h2>รายการสั่งอะไหล่รายวัน</h2>
<div class="info">วันที่: ${fmtThaiDate(date)} | ระบบ: ${filterSystem === "all" ? "ทั้งหมด" : (SYSTEMS.find(s => s.key === filterSystem)?.label || filterSystem)} | ${filtered.length} ใบ · ${totalItems} ชิ้น | พิมพ์: ${new Date().toLocaleString("th-TH")}</div>
<table><thead><tr><th>#</th><th>เวลา</th><th>ระบบ</th><th>เลขที่มัดจำ/ใบ</th><th>รุ่นรถ</th><th>รายการอะไหล่</th><th>สถานะ</th><th>เลขที่ใบรับสั่งซื้อ</th></tr></thead>
<tbody>${body || `<tr><td colspan="8" class="c">ไม่มีรายการ</td></tr>`}</tbody></table>
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
              <th style={th}>เลขที่มัดจำ/ใบ</th>
              <th style={th}>รุ่นรถ</th>
              <th style={th}>รายการอะไหล่</th>
              <th style={th}>สถานะ</th>
              <th style={th}>เลขที่ใบรับสั่งซื้อ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={center}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={center}>ไม่มีรายการสั่งอะไหล่ในวันนี้</td></tr>
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
                  <td style={td}>{r.deposit_doc_no || r.order_no || `#${r.order_id}`}</td>
                  <td style={td}>{r.model_name || "-"}</td>
                  <td style={td}>
                    {(r.items || []).length === 0 ? "-" : (r.items || []).map((it, k) => (
                      <div key={k} style={{ whiteSpace: "nowrap" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 12 }}>{it.part_code || "-"}</span>
                        {" · "}{it.part_name || "-"}{" × "}<b>{Number(it.quantity) || 0}</b>
                      </div>
                    ))}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>{r.status || "-"}</td>
                  <td style={td}>{r.vendor_po_no || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
