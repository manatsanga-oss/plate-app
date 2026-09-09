import React, { useEffect, useMemo, useState } from "react";

// นับสต๊อก RFID (UHF) — เครื่องอ่าน SW6909A + บอร์ด ESP32 ส่งแท็กที่เห็นเข้า rfid-stock-api ทุก 1 นาที
// แท็ก (EPC) ผูกกับรหัสอะไหล่ (เริ่มที่ยาง PG-022) → หน้านี้บอกว่าแต่ละรหัสผูกกี่ใบ เห็นกี่ใบ หายกี่ใบ
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/rfid-stock-api";
const FAST_MOVING_API = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-api";
const BRANCHES = ["SCY01", "SCY02", "SCY03", "SCY04", "SCY05", "SCY06", "SCY07"];
const DEFAULT_GROUP = "PG-022"; // ยางนอก

async function api(payload) {
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (data?.__error) throw new Error(data.__error);
  if (typeof data?.listjson === "string") { try { return JSON.parse(data.listjson); } catch { return []; } }
  return data;
}
const fmtTime = (v) => {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v);
  return d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
};
const ago = (v) => {
  if (!v) return "ไม่เคยเห็น";
  const s = Math.max(0, Math.round((Date.now() - new Date(v).getTime()) / 1000));
  if (s < 60) return `${s} วิที่แล้ว`;
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
  return `${Math.floor(s / 86400)} วันที่แล้ว`;
};
const shortEpc = (epc) => String(epc || "").replace(/0+$/, "") || String(epc || "");

const th = { padding: "8px 10px", background: "#0f2a5c", color: "#fff", fontSize: 13, textAlign: "left", whiteSpace: "nowrap" };
const td = { padding: "7px 10px", borderBottom: "1px solid #e5e7eb", fontSize: 13, verticalAlign: "top" };
const btn = { padding: "6px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 13 };
const btnPrimary = { ...btn, background: "#1d4ed8", color: "#fff", border: "1px solid #1d4ed8" };
const badge = (ok, textOk, textNo) => (
  <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: ok ? "#dcfce7" : "#fee2e2", color: ok ? "#166534" : "#991b1b" }}>{ok ? textOk : textNo}</span>
);

export default function RfidStockPage({ currentUser }) {
  const [tab, setTab] = useState("status"); // status | seen | tags | readers
  const [branch, setBranch] = useState("SCY01");
  const [minutes, setMinutes] = useState(10);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState([]);
  const [seen, setSeen] = useState([]);
  const [tags, setTags] = useState([]);
  const [readers, setReaders] = useState([]);
  const [lastLoad, setLastLoad] = useState(null);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [expanded, setExpanded] = useState({}); // { part_code: true }
  // รอบนับ (กดปุ่ม "นับสต๊อกตอนนี้" → บอร์ดมารับคำสั่งภายใน 15 วิ → อ่าน N วิ → ส่งผล)
  const [counts, setCounts] = useState([]);
  const [countSecs, setCountSecs] = useState(60);
  const [requesting, setRequesting] = useState(false);
  const latestCount = counts[0] || null;
  const countActive = latestCount && (latestCount.status === "pending" || latestCount.status === "running");

  // รายการอะไหล่หมุนเร็ว (ไว้เลือกตอนผูกแท็ก)
  const [parts, setParts] = useState([]);
  const [partGroup, setPartGroup] = useState(DEFAULT_GROUP);
  const [partSearch, setPartSearch] = useState("");

  // modal ผูกแท็ก
  const [mapModal, setMapModal] = useState(null); // { epc, part_code, part_name, note }
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [st, sn, tg, rd, ct] = await Promise.all([
        api({ action: "stock_status", branch_code: branch, minutes }),
        api({ action: "list_seen", branch_code: branch, minutes }),
        api({ action: "list_tags", branch_code: branch, minutes }),
        api({ action: "list_readers" }),
        api({ action: "list_counts", branch_code: branch, limit: 10 }),
      ]);
      setStatus(Array.isArray(st) ? st : []);
      setSeen(Array.isArray(sn) ? sn : []);
      setTags(Array.isArray(tg) ? tg : []);
      setReaders(Array.isArray(rd) ? rd : []);
      setCounts(Array.isArray(ct) ? ct : []);
      setLastLoad(new Date());
      setMsg("");
    } catch (e) { setMsg("โหลดไม่สำเร็จ: " + e.message); }
    setLoading(false);
  }
  async function loadParts() {
    try {
      const res = await fetch(FAST_MOVING_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_fast_moving_report" }) });
      const data = await res.json();
      setParts(Array.isArray(data) ? data : []);
    } catch { setParts([]); }
  }
  useEffect(() => { loadAll(); }, [branch, minutes]); // eslint-disable-line
  useEffect(() => { loadParts(); }, []);
  // ระหว่างรอบนับ เช็คสถานะทุก 5 วิ พอเสร็จโหลดผลทั้งหมด
  useEffect(() => {
    if (!countActive) return;
    const t = setInterval(async () => {
      try {
        const ct = await api({ action: "list_counts", branch_code: branch, limit: 10 });
        const list = Array.isArray(ct) ? ct : [];
        setCounts(list);
        const c = list[0];
        if (c && c.status !== "pending" && c.status !== "running") loadAll();
      } catch { /* ลองใหม่รอบหน้า */ }
    }, 5000);
    return () => clearInterval(t);
  }, [countActive, branch]); // eslint-disable-line
  async function requestCount() {
    if (branch === "all") { alert("เลือกสาขาก่อน"); return; }
    setRequesting(true);
    try {
      const r = await api({ action: "request_count", branch_code: branch, requested_by: currentUser?.username || "", seconds: countSecs });
      setCounts(prev => [...(Array.isArray(r) ? r : []), ...prev.filter(c => !(Array.isArray(r) && r.some(x => x.id === c.id)))]);
    } catch (e) { alert("สั่งนับไม่สำเร็จ: " + e.message); }
    setRequesting(false);
  }
  async function cancelCount() {
    if (!latestCount || !window.confirm("ยกเลิกคำสั่งนับรอบนี้?")) return;
    try { await api({ action: "cancel_count", id: latestCount.id }); await loadAll(); } catch (e) { alert("ยกเลิกไม่สำเร็จ: " + e.message); }
  }
  const countStatusText = (c) => {
    if (!c) return "ยังไม่เคยนับ";
    if (c.status === "pending") return `รอบอร์ดมารับคำสั่ง (สั่งเมื่อ ${ago(c.requested_at)})`;
    if (c.status === "running") return `กำลังอ่าน ${c.seconds} วิ… (เริ่ม ${ago(c.started_at)})`;
    if (c.status === "done") return `นับเสร็จ ${fmtTime(c.finished_at)} เจอ ${c.tags_found ?? 0} ใบ`;
    if (c.status === "cancelled") return `ยกเลิกแล้ว ${fmtTime(c.finished_at)}`;
    if (c.status === "expired") return `คำสั่งหมดอายุ (บอร์ดไม่มารับ) ${fmtTime(c.requested_at)}`;
    return c.status;
  };
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(loadAll, 30000);
    return () => clearInterval(t);
  }, [autoRefresh, branch, minutes]); // eslint-disable-line

  const partGroups = useMemo(() => [...new Set(parts.map(p => p.product_group).filter(Boolean))].sort(), [parts]);
  const partOptions = useMemo(() => {
    const q = partSearch.trim().toLowerCase();
    return parts
      .filter(p => partGroup === "all" || p.product_group === partGroup)
      .filter(p => !q || String(p.part_code || "").toLowerCase().includes(q) || String(p.product_name || "").toLowerCase().includes(q))
      .slice(0, 200);
  }, [parts, partGroup, partSearch]);

  const summary = useMemo(() => {
    const tagged = status.reduce((s, r) => s + (Number(r.tagged) || 0), 0);
    const present = status.reduce((s, r) => s + (Number(r.present) || 0), 0);
    const unmapped = seen.filter(r => !r.part_code && r.present).length;
    const online = readers.filter(r => r.online && (branch === "all" || r.branch_code === branch)).length;
    return { tagged, present, missing: tagged - present, unmapped, online, parts: status.length, partsMissing: status.filter(r => Number(r.present) < Number(r.tagged)).length };
  }, [status, seen, readers, branch]);

  const filteredStatus = useMemo(() => {
    const q = search.trim().toLowerCase();
    return status.filter(r => (!q || String(r.part_code || "").toLowerCase().includes(q) || String(r.part_name || "").toLowerCase().includes(q)))
      .filter(r => !onlyMissing || Number(r.present) < Number(r.tagged));
  }, [status, search, onlyMissing]);

  function openMap(row) {
    setMapModal({ epc: row.epc, part_code: row.part_code || "", part_name: row.part_name || "", note: row.note || "" });
    setPartSearch("");
  }
  function pickPart(p) {
    setMapModal(m => ({ ...m, part_code: p.part_code || "", part_name: p.product_name || "" }));
  }
  async function saveMap() {
    if (!mapModal?.part_code.trim()) { alert("กรุณาเลือกรหัสอะไหล่"); return; }
    setSaving(true);
    try {
      await api({ action: "save_tag", epc: mapModal.epc, branch_code: branch === "all" ? "SCY01" : branch, part_code: mapModal.part_code.trim(), part_name: mapModal.part_name, note: mapModal.note, created_by: currentUser?.username || "" });
      setMapModal(null);
      await loadAll();
    } catch (e) { alert("บันทึกไม่สำเร็จ: " + e.message); }
    setSaving(false);
  }
  async function unmap(epc) {
    if (!window.confirm(`ยกเลิกการผูกแท็ก ${epc}?`)) return;
    try { await api({ action: "delete_tag", epc }); await loadAll(); } catch (e) { alert("ไม่สำเร็จ: " + e.message); }
  }

  const cards = [
    { l: "รหัสที่ผูกแท็ก", v: summary.parts, c: "#1e40af" },
    { l: "แท็กทั้งหมด", v: summary.tagged, c: "#0f172a" },
    { l: `เห็นใน ${minutes} นาที`, v: summary.present, c: "#166534" },
    { l: "หาย/ไม่เห็น", v: summary.missing, c: summary.missing ? "#b91c1c" : "#166534" },
    { l: "แท็กใหม่ยังไม่ผูก", v: summary.unmapped, c: summary.unmapped ? "#b45309" : "#0f172a" },
    { l: "เครื่องอ่านออนไลน์", v: summary.online, c: summary.online ? "#166534" : "#b91c1c" },
  ];

  return (
    <div style={{ padding: 16, maxWidth: 1200 }}>
      <div className="page-title">📡 นับสต๊อก RFID</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "10px 0" }}>
        <select value={branch} onChange={e => setBranch(e.target.value)} style={{ padding: 6, borderRadius: 8 }}>
          {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          <option value="all">ทุกสาขา</option>
        </select>
        <button style={{ ...btnPrimary, background: countActive ? "#b45309" : "#15803d", border: "none", fontWeight: 700 }} onClick={requestCount} disabled={requesting || countActive}>
          {countActive ? "⏳ กำลังนับ…" : "📡 นับสต๊อกตอนนี้"}
        </button>
        <select value={countSecs} onChange={e => setCountSecs(Number(e.target.value))} style={{ padding: 6, borderRadius: 8 }} disabled={countActive}>
          {[30, 60, 120, 180].map(s => <option key={s} value={s}>อ่าน {s} วิ</option>)}
        </select>
        <span style={{ fontSize: 13, color: countActive ? "#b45309" : "#475569", fontWeight: countActive ? 600 : 400 }}>{countStatusText(latestCount)}</span>
        {countActive && <button style={{ ...btn, color: "#b91c1c" }} onClick={cancelCount}>ยกเลิก</button>}
        <label style={{ fontSize: 13 }}>ถ้ายังไม่เคยนับ ถือว่า "อยู่" ถ้าเห็นภายใน
          <select value={minutes} onChange={e => setMinutes(Number(e.target.value))} style={{ marginLeft: 6, padding: 5, borderRadius: 8 }}>
            {[3, 5, 10, 30, 60, 180, 1440].map(m => <option key={m} value={m}>{m >= 60 ? `${m / 60} ชม.` : `${m} นาที`}</option>)}
          </select>
        </label>
        <button style={btn} onClick={loadAll} disabled={loading}>{loading ? "กำลังโหลด..." : "🔄 Refresh"}</button>
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /> รีเฟรชอัตโนมัติทุก 30 วิ</label>
        <span style={{ fontSize: 12, color: "#64748b" }}>{lastLoad ? `อัปเดต ${fmtTime(lastLoad)}` : ""}</span>
        {msg && <span style={{ color: "#b91c1c", fontSize: 13 }}>{msg}</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        {cards.map(c => (
          <div key={c.l} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>{c.l}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: c.c }}>{c.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {[["status", "📦 สถานะสต๊อกตามรหัส"], ["seen", `👀 แท็กที่เครื่องเห็น (${seen.length})`], ["tags", `🔗 แท็กที่ผูกแล้ว (${tags.length})`], ["readers", "📡 เครื่องอ่าน"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...btn, background: tab === k ? "#0f2a5c" : "#fff", color: tab === k ? "#fff" : "#0f172a", fontWeight: tab === k ? 700 : 400 }}>{l}</button>
        ))}
      </div>

      {tab === "status" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 10, padding: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหารหัส / ชื่ออะไหล่" style={{ padding: 6, borderRadius: 8, border: "1px solid #cbd5e1", minWidth: 240 }} />
            <label style={{ fontSize: 13 }}><input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} /> เฉพาะที่มีแท็กหาย</label>
            <span style={{ fontSize: 12, color: "#64748b" }}>{filteredStatus.length} รหัส · {summary.partsMissing} รหัสมีแท็กหาย</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>รหัสอะไหล่</th><th style={th}>ชื่อสินค้า</th><th style={{ ...th, textAlign: "right" }}>ผูกแท็ก</th><th style={{ ...th, textAlign: "right" }}>เห็น</th><th style={{ ...th, textAlign: "right" }}>หาย</th><th style={th}>สถานะ</th><th style={th}>เห็นล่าสุด</th><th style={th}></th></tr></thead>
              <tbody>
                {filteredStatus.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>{status.length === 0 ? "ยังไม่มีแท็กที่ผูกกับอะไหล่ — ไปที่แท็บ \"แท็กที่เครื่องเห็น\" แล้วกดผูก" : "ไม่พบรายการ"}</td></tr>}
                {filteredStatus.map(r => {
                  const missing = Number(r.tagged) - Number(r.present);
                  const open = !!expanded[r.part_code];
                  return (
                    <React.Fragment key={r.part_code}>
                      <tr style={{ background: missing ? "#fff7f7" : "#fff" }}>
                        <td style={{ ...td, fontWeight: 600 }}>{r.part_code}</td>
                        <td style={td}>{r.part_name || "-"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{r.tagged}</td>
                        <td style={{ ...td, textAlign: "right", color: "#166534", fontWeight: 600 }}>{r.present}</td>
                        <td style={{ ...td, textAlign: "right", color: missing ? "#b91c1c" : "#94a3b8", fontWeight: 600 }}>{missing}</td>
                        <td style={td}>{badge(!missing, "ครบ", `หาย ${missing} ใบ`)}</td>
                        <td style={td} title={fmtTime(r.last_seen_at)}>{ago(r.last_seen_at)}</td>
                        <td style={td}><button style={btn} onClick={() => setExpanded(x => ({ ...x, [r.part_code]: !open }))}>{open ? "ซ่อน" : "ดูแท็ก"}</button></td>
                      </tr>
                      {open && (
                        <tr><td colSpan={8} style={{ ...td, background: "#f8fafc" }}>
                          <table style={{ borderCollapse: "collapse" }}>
                            <tbody>
                              {(Array.isArray(r.tags) ? r.tags : []).map(t => (
                                <tr key={t.epc}>
                                  <td style={{ ...td, fontFamily: "monospace" }}>{t.epc}</td>
                                  <td style={td}>{badge(!!t.present, "อยู่", "ไม่เห็น")}</td>
                                  <td style={td} title={fmtTime(t.last_seen_at)}>{ago(t.last_seen_at)}</td>
                                  <td style={td}>rssi {t.rssi ?? "-"}</td>
                                  <td style={td}>{t.note || ""}</td>
                                  <td style={td}><button style={btn} onClick={() => openMap({ epc: t.epc, part_code: r.part_code, part_name: r.part_name, note: t.note })}>แก้ไข</button> <button style={{ ...btn, color: "#b91c1c" }} onClick={() => unmap(t.epc)}>ยกเลิกผูก</button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "seen" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 10, fontSize: 13, color: "#475569" }}>แท็กทุกใบที่เครื่องอ่านเคยเห็น เรียงจากล่าสุด — แท็กใหม่ที่ยังไม่ผูก กด <b>ผูกกับอะไหล่</b> (ติดสติกเกอร์บนยางแล้วจ่อหน้าเครื่อง จะโผล่ที่นี่ภายใน 1 นาที)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>EPC</th><th style={th}>สถานะ</th><th style={th}>เห็นล่าสุด</th><th style={th}>เห็นครั้งแรก</th><th style={{ ...th, textAlign: "right" }}>rssi</th><th style={{ ...th, textAlign: "right" }}>อ่านสะสม</th><th style={th}>ผูกกับ</th><th style={th}>เครื่องอ่าน</th><th style={th}></th></tr></thead>
              <tbody>
                {seen.length === 0 && <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>ยังไม่มีข้อมูลจากเครื่องอ่าน</td></tr>}
                {seen.map(r => (
                  <tr key={r.epc} style={{ background: !r.part_code && r.present ? "#fffbeb" : "#fff" }}>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.epc}</td>
                    <td style={td}>{badge(!!r.present, "อยู่", "ไม่เห็น")}</td>
                    <td style={td} title={fmtTime(r.last_seen_at)}>{ago(r.last_seen_at)}</td>
                    <td style={td}>{fmtTime(r.first_seen_at)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{r.last_rssi ?? "-"}</td>
                    <td style={{ ...td, textAlign: "right" }}>{r.total_reads ?? "-"}</td>
                    <td style={td}>{r.part_code ? <><b>{r.part_code}</b><div style={{ fontSize: 12, color: "#475569" }}>{r.part_name}</div></> : <span style={{ color: "#b45309" }}>ยังไม่ผูก</span>}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.reader_sn}</td>
                    <td style={td}><button style={r.part_code ? btn : btnPrimary} onClick={() => openMap(r)}>{r.part_code ? "แก้ไข" : "ผูกกับอะไหล่"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "tags" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>รหัสอะไหล่</th><th style={th}>ชื่อสินค้า</th><th style={th}>EPC</th><th style={th}>สถานะ</th><th style={th}>เห็นล่าสุด</th><th style={th}>หมายเหตุ</th><th style={th}>ผูกโดย</th><th style={th}></th></tr></thead>
              <tbody>
                {tags.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>ยังไม่มีแท็กที่ผูก</td></tr>}
                {tags.map(r => (
                  <tr key={r.epc}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.part_code}</td>
                    <td style={td}>{r.part_name}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.epc}</td>
                    <td style={td}>{badge(!!r.present, "อยู่", "ไม่เห็น")}</td>
                    <td style={td} title={fmtTime(r.last_seen_at)}>{ago(r.last_seen_at)}</td>
                    <td style={td}>{r.note}</td>
                    <td style={td}>{r.created_by}<div style={{ fontSize: 11, color: "#94a3b8" }}>{fmtTime(r.created_at)}</div></td>
                    <td style={td}><button style={btn} onClick={() => openMap(r)}>แก้ไข</button> <button style={{ ...btn, color: "#b91c1c" }} onClick={() => unmap(r.epc)}>ยกเลิกผูก</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "readers" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>เครื่องอ่าน (SN)</th><th style={th}>สาขา</th><th style={th}>สถานะ</th><th style={th}>ส่งข้อมูลล่าสุด</th><th style={th}>IP</th><th style={{ ...th, textAlign: "right" }}>แท็กที่เห็นใน 10 นาที</th></tr></thead>
            <tbody>
              {readers.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>ยังไม่มีเครื่องอ่านส่งข้อมูลเข้ามา</td></tr>}
              {readers.map(r => (
                <tr key={r.reader_sn}>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.reader_sn}</td>
                  <td style={td}>{r.branch_code}</td>
                  <td style={td}>{badge(!!r.online, "ออนไลน์", "ขาดการติดต่อ")}</td>
                  <td style={td} title={fmtTime(r.last_seen_at)}>{ago(r.last_seen_at)}</td>
                  <td style={td}>{r.ip}{r.rssi != null && <span style={{ marginLeft: 8, fontSize: 12, color: r.rssi > -65 ? "#166534" : r.rssi > -72 ? "#b45309" : "#b91c1c" }}>WiFi {r.rssi} dBm {r.rssi > -65 ? "ดี" : r.rssi > -72 ? "พอใช้" : "อ่อน ควรย้ายบอร์ดใกล้ router"}</span>}</td>
                  <td style={{ ...td, textAlign: "right" }}>{r.tags_10m}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: 10, fontSize: 12, color: "#64748b" }}>บอร์ดส่งข้อมูลทุก 1 นาที · ถ้าไม่ส่งเกิน 3 นาทีจะขึ้น "ขาดการติดต่อ" (เช็คไฟ 12V เครื่องอ่าน, สาย USB/ไฟบอร์ด, WiFi)</div>
        </div>
      )}

      {mapModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => !saving && setMapModal(null)}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 18, width: "min(720px, 95vw)", maxHeight: "90vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px", color: "#0f2a5c" }}>🔗 ผูกแท็กกับอะไหล่</h3>
            <div style={{ fontFamily: "monospace", fontSize: 14, marginBottom: 10 }}>EPC: <b>{mapModal.epc}</b></div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <select value={partGroup} onChange={e => setPartGroup(e.target.value)} style={{ padding: 6, borderRadius: 8 }}>
                <option value="all">ทุกกลุ่ม</option>
                {partGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input autoFocus value={partSearch} onChange={e => setPartSearch(e.target.value)} placeholder="ค้นหารหัส / ชื่อ (เช่น 70/90-14)" style={{ padding: 6, borderRadius: 8, border: "1px solid #cbd5e1", flex: 1, minWidth: 220 }} />
            </div>
            <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 10 }}>
              {partOptions.length === 0 && <div style={{ padding: 12, color: "#94a3b8", fontSize: 13 }}>ไม่พบรายการ</div>}
              {partOptions.map(p => {
                const sel = mapModal.part_code === p.part_code;
                return (
                  <div key={p.id || p.part_code} onClick={() => pickPart(p)} style={{ padding: "6px 10px", cursor: "pointer", background: sel ? "#dbeafe" : "#fff", borderBottom: "1px solid #f1f5f9", fontSize: 13, display: "flex", gap: 10 }}>
                    <b style={{ minWidth: 120 }}>{p.part_code}</b><span>{p.product_name}</span><span style={{ marginLeft: "auto", color: "#64748b" }}>{p.product_group}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, alignItems: "center", fontSize: 13 }}>
              <label>รหัสอะไหล่</label>
              <input value={mapModal.part_code} onChange={e => setMapModal(m => ({ ...m, part_code: e.target.value }))} style={{ padding: 6, borderRadius: 8, border: "1px solid #cbd5e1" }} />
              <label>ชื่อสินค้า</label>
              <input value={mapModal.part_name} onChange={e => setMapModal(m => ({ ...m, part_name: e.target.value }))} style={{ padding: 6, borderRadius: 8, border: "1px solid #cbd5e1" }} />
              <label>หมายเหตุ (เช่น เส้นที่ 1, ล็อต)</label>
              <input value={mapModal.note} onChange={e => setMapModal(m => ({ ...m, note: e.target.value }))} style={{ padding: 6, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button style={btn} onClick={() => setMapModal(null)} disabled={saving}>ยกเลิก</button>
              <button style={btnPrimary} onClick={saveMap} disabled={saving}>{saving ? "กำลังบันทึก..." : "💾 บันทึก"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
