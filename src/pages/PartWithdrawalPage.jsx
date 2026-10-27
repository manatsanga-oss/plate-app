import React, { useState, useEffect, useRef } from "react";

const FAST_API = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-stock-api";
const PW_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-withdrawal-api";
const SQ_API = "https://n8n-new-project-gwf2.onrender.com/webhook/service-queue-api"; // สถานะช่องซ่อม (รถในช่อง) จากกล้อง NVR ผ่าน Pi — action list_bays / clear_bay
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
  // รถในช่องซ่อมตอนนี้ (จากกล้อง) — ผู้เบิกเลือกคันที่เบิกให้; รถออกจากช่อง → หายจากรายการและยกเลิกการเลือกอัตโนมัติ (user 2026-10-27)
  const [bays, setBays] = useState([]);
  const [baysLoaded, setBaysLoaded] = useState(false);
  const [selectedBay, setSelectedBay] = useState(null); // {zone_source, zone_name, plate_no, plate_province, event_id}
  const [bayNotice, setBayNotice] = useState("");
  async function loadBays() {
    try {
      const res = await fetch(SQ_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_bays" }) });
      const d = await res.json();
      setBays(Array.isArray(d?.bays) ? d.bays : []);
    } catch { /* คงรายการเดิม */ }
    setBaysLoaded(true);
  }
  useEffect(() => { loadBays(); const t = setInterval(loadBays, BAY_POLL_MS); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!selectedBay) return;
    const cur = bays.find(b => b.zone_source === selectedBay.zone_source);
    if (!cur) { // รถออกจากช่องแล้ว (หรือกล้องเห็นช่องว่าง)
      setSelectedBay(null);
      setBayNotice(`🚪 รถ ${selectedBay.plate_no || "ไม่ทราบทะเบียน"} ออกจาก${selectedBay.zone_name}แล้ว — ยกเลิกการเลือกรถ`);
      setTimeout(() => setBayNotice(""), 8000);
    } else if (cur.plate_no !== selectedBay.plate_no || cur.event_id !== selectedBay.event_id) {
      setSelectedBay(cur); // กล้องอ่านทะเบียนได้ทีหลัง / คันใหม่เข้าช่องเดิม → อัปเดตตาม
    }
  }, [bays]); // eslint-disable-line react-hooks/exhaustive-deps
  async function clearBay(b) {
    if (!window.confirm(`ยืนยันว่ารถ ${b.plate_no || "ไม่ทราบทะเบียน"} ออกจาก${b.zone_name}แล้ว?`)) return;
    try { await fetch(SQ_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear_bay", zone_source: b.zone_source }) }); } catch { /* ignore */ }
    loadBays();
  }
  const bayLabel = (b) => `${b.plate_no || "ไม่ทราบทะเบียน"}${b.plate_province ? " " + b.plate_province : ""}`;

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
      <div className="page-topbar">
        <h2 className="page-title">📦 บันทึกการเบิกอะไหล่</h2>
      </div>

      {/* เลือกรถที่เบิกให้ — จากช่องซ่อมที่กล้องเห็นว่ามีรถ */}
      <div style={{ background: "#fff", border: selectedBay ? "3px solid #f59e0b" : "2px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <strong style={{ fontSize: 16 }}>🏍️ เลือกรถที่เบิกอะไหล่ให้ <span style={{ fontSize: 12, fontWeight: 400, color: "#6b7280" }}>(รถในช่องซ่อมตอนนี้ จากกล้อง · อัปเดตทุก {BAY_POLL_MS / 1000} วิ)</span></strong>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selectedBay && <span style={{ fontSize: 14, fontWeight: 700, color: "#b45309" }}>กำลังเบิกให้: {bayLabel(selectedBay)} · {selectedBay.zone_name}</span>}
            <button onClick={loadBays} style={{ padding: "5px 10px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>🔄</button>
          </div>
        </div>
        {bayNotice && <div style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontWeight: 600 }}>{bayNotice}</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => { setSelectedBay(null); setTimeout(() => inputRef.current?.focus(), 50); }}
            style={{ padding: "14px 18px", borderRadius: 10, cursor: "pointer", fontSize: 16, fontWeight: 700, minWidth: 150,
              border: !selectedBay ? "3px solid #072d6b" : "2px solid #d1d5db", background: !selectedBay ? "#eef2ff" : "#fff", color: "#1f2937" }}>
            📦 เบิกทั่วไป<div style={{ fontSize: 12, fontWeight: 400, color: "#6b7280" }}>ไม่ระบุรถ</div>
          </button>
          {bays.map(b => {
            const sel = selectedBay?.zone_source === b.zone_source;
            return (
              <div key={b.zone_source} style={{ position: "relative" }}>
                <button onClick={() => { setSelectedBay(b); setTimeout(() => inputRef.current?.focus(), 50); }}
                  style={{ padding: "14px 18px", paddingRight: 36, borderRadius: 10, cursor: "pointer", textAlign: "left", minWidth: 220,
                    border: sel ? "3px solid #f59e0b" : "2px solid #d1d5db", background: sel ? "#fffbeb" : "#fff", color: "#1f2937" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: b.plate_no ? "#072d6b" : "#9ca3af" }}>{b.plate_no || "ไม่ทราบทะเบียน"}</div>
                  <div style={{ fontSize: 13, color: "#374151" }}>{b.plate_province || ""}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{b.zone_name} · เข้า {b.since_local || "-"} น. ({b.minutes} นาที)</div>
                </button>
                <button onClick={() => clearBay(b)} title="รถออกจากช่องแล้ว (เคลียร์ด้วยมือ)"
                  style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, border: "1px solid #fca5a5", background: "#fee2e2", color: "#b91c1c", borderRadius: 6, cursor: "pointer", fontSize: 12, lineHeight: "20px", padding: 0 }}>✕</button>
              </div>
            );
          })}
          {baysLoaded && bays.length === 0 && <span style={{ alignSelf: "center", color: "#9ca3af", fontSize: 14 }}>ไม่มีรถในช่องซ่อมตอนนี้</span>}
        </div>
      </div>

      {/* Scan input */}
      <div style={{ background: "#072d6b", padding: 20, borderRadius: 12, marginBottom: 16, color: "#fff" }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
          📷 สแกน / พิมพ์รหัสอะไหล่
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") lookup(); }}
            placeholder={loadingMaster ? "กำลังโหลดข้อมูล..." : ""}
            disabled={loadingMaster}
            autoFocus
            style={{
              flex: 1, padding: "16px 20px", fontSize: 24, fontWeight: 700,
              fontFamily: "monospace", border: "3px solid #fff", borderRadius: 10,
              background: "#fff", color: "#072d6b", letterSpacing: 1,
            }}
          />
          <button onClick={lookup} disabled={loadingMaster || !input.trim()}
            style={{
              padding: "0 28px", background: "#10b981", color: "#fff",
              border: "none", borderRadius: 10, fontSize: 18, fontWeight: 700, cursor: "pointer",
              minWidth: 120,
            }}>
            🔍 ค้นหา
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          กด <strong>Enter</strong> หลังสแกน · มี <strong>{allRows.length}</strong> รายการในระบบ
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
          <div style={{ padding: "10px 16px", background: "#10b981", color: "#fff", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: "#059669", fontFamily: "monospace" }}>{st.qty}</span>
                        {st.loc && <span style={{ fontSize: 13, fontWeight: 700, color: "#072d6b" }}>📍 {st.loc}</span>}
                      </div>
                    );
                  })}
                  {Object.values(s.stores).every(v => !v || v === "-" || Number(v.qty || 0) === 0) && (
                    <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>⚠️ ไม่มีของในทุกร้าน</span>
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

          {/* Big save button */}
          <div style={{ padding: 12, background: "#f0fdf4", borderTop: "2px solid #10b981" }}>
            <button onClick={saveWithdrawal} style={{
              width: "100%", padding: "18px 24px", background: "#10b981", color: "#fff",
              border: "none", borderRadius: 12, fontSize: 22, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(16,185,129,0.4)",
            }}>
              ✅ บันทึกการเบิก ({scanned.length} รายการ){selectedBay ? ` ให้รถ ${selectedBay.plate_no || "ไม่ทราบทะเบียน"}` : " (เบิกทั่วไป)"}
            </button>
          </div>
        </div>
      )}

      {/* Withdrawal log */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <strong>📋 ประวัติการเบิก ({withdrawn.length} รายการ)</strong>
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
        {withdrawn.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีรายการ</div>
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
                  withdrawn.forEach((w, i) => {
                    const prev = i > 0 ? withdrawn[i - 1] : null;
                    const gap = prev ? Math.abs(new Date(prev.withdrawn_at) - new Date(w.withdrawn_at)) : Infinity;
                    const same = !!prev && String(prev.withdrawn_by || "") === String(w.withdrawn_by || "") && (gap <= GROUP_GAP_MS || prev.batch_no === w.batch_no);
                    if (!same) groups.push({ start: i, batches: [], codes: [], keys: [] });
                    const g = groups[groups.length - 1];
                    if (w.batch_no && !g.batches.includes(w.batch_no)) g.batches.push(w.batch_no);
                    if (w.part_code) { g.codes.push(String(w.part_code)); g.keys.push(rowKey(w, i)); }
                    groupOf[i] = g;
                  });
                  return withdrawn.map((w, i) => {
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

const th = { padding: "7px 10px", textAlign: "left", fontWeight: 700, fontSize: 12, color: "#374151" };
const td = { padding: "6px 10px", fontSize: 12 };
