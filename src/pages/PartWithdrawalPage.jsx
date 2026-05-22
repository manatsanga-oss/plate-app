import React, { useState, useEffect, useRef } from "react";

const FAST_API = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-stock-api";
const PW_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-withdrawal-api";

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

  // วันที่กรอง — default = วันนี้
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [historyDate, setHistoryDate] = useState(todayISO());

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
        const row = allRows.find(r => String(r.part_code || "").trim().toUpperCase() === code);
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
              ✅ บันทึกการเบิก ({scanned.length} รายการ)
            </button>
          </div>
        </div>
      )}

      {/* Withdrawal log */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <strong>📋 ประวัติการเบิก ({withdrawn.length} รายการ)</strong>
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
                  <th style={th}>ผู้เบิก</th>
                  <th style={th}>Batch</th>
                </tr>
              </thead>
              <tbody>
                {withdrawn.map((w, i) => {
                  const prev = i > 0 ? withdrawn[i - 1] : null;
                  const isNewBatch = !prev || prev.batch_no !== w.batch_no;
                  return (
                    <React.Fragment key={w.id || i}>
                      {isNewBatch && (
                        <tr>
                          <td colSpan={6} style={{ background: "#eef2ff", color: "#3730a3", fontSize: 12, fontWeight: 700, padding: "6px 10px", borderTop: i > 0 ? "3px solid #6366f1" : "none" }}>
                            ━━━ Batch <span style={{ fontFamily: "monospace", color: "#1e40af" }}>{w.batch_no}</span> · {new Date(w.withdrawn_at).toLocaleString("th-TH")} · ผู้เบิก: {w.withdrawn_by || "-"} ━━━
                          </td>
                        </tr>
                      )}
                      <tr style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={td}>{w.withdrawn_at ? new Date(w.withdrawn_at).toLocaleTimeString("th-TH") : "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#0369a1" }}>{w.part_code}</td>
                        <td style={td}>{w.product_name}</td>
                        <td style={td}>{w.withdrawn_by}</td>
                        <td style={{ ...td, fontFamily: "monospace", color: "#6366f1" }}>{w.batch_no}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
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
