import React, { useState, useMemo, useRef, useEffect } from "react";

const API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-order-inquiry";

function fmt(v, d = 2) { const n = Number(v) || 0; return n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtInt(v) { return (Number(v) || 0).toLocaleString("th-TH"); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}

export default function PartOrderInquiryPage() {
  const [partCode, setPartCode] = useState("");
  const [rows, setRows] = useState([]);
  const [lastCode, setLastCode] = useState("");        // รหัสล่าสุดที่ scan — แสดงเป็นสีแดง
  const [popupCode, setPopupCode] = useState("");      // รหัสที่ต้อง popup เตือนสแกนใหม่
  const [anchorGroups, setAnchorGroups] = useState(null);  // Set of "doc_no|apc_order_no" — 2 กลุ่มแรกที่ scan
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);

  async function search() {
    const code = partCode.trim().toUpperCase();
    if (!code) return;
    if (code.length < 11) {
      setPartCode("");
      if (inputRef.current) inputRef.current.value = "";
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    setLoading(true); setSearched(true);
    try {
      const res = await fetch(API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part_code: code }),
      });
      const data = await res.json();
      const newRows = Array.isArray(data) ? data : [];
      // ผสมกับ rows เดิม — ไม่ลบของเก่า, dedup โดย key brand+doc_no+line_no+part_code
      setRows(prev => {
        const key = r => `${r.brand}|${r.doc_no}|${r.line_no}|${r.part_code}`;
        const seen = new Set(prev.map(key));
        const merged = [...prev];
        for (const r of newRows) {
          const k = key(r);
          if (!seen.has(k)) { seen.add(k); merged.push(r); }
        }
        return merged;
      });

      // ฟังก์ชันคำนวณ 2 กลุ่มล่าสุดของรหัสนี้ (per brand)
      function compute2Top(rows) {
        const byBrand = {};
        for (const r of rows) {
          const b = r.brand || "OTHER";
          if (!byBrand[b]) byBrand[b] = {};
          const k = `${r.doc_no || ""}|${r.apc_order_no || ""}`;
          if (!byBrand[b][k]) byBrand[b][k] = { key: k, date: r.doc_date };
        }
        const set = new Set();
        for (const b of Object.keys(byBrand)) {
          Object.values(byBrand[b])
            .sort((a, bb) => new Date(bb.date || 0) - new Date(a.date || 0))
            .slice(0, 2)
            .forEach(g => set.add(g.key));
        }
        return set;
      }

      if (newRows.length > 0) {
        if (!anchorGroups) {
          // scan ครั้งแรก → ล็อก 2 กลุ่มล่าสุดเป็น anchor
          setAnchorGroups(compute2Top(newRows));
        } else {
          const hasInAnchor = newRows.some(r =>
            anchorGroups.has(`${r.doc_no || ""}|${r.apc_order_no || ""}`)
          );
          if (!hasInAnchor) {
            // ไม่อยู่ใน anchor
            if (anchorGroups.size >= 2) {
              // anchor ครบ 2 กลุ่มแล้ว → popup ให้ scan ใหม่
              setPopupCode(code);
            } else {
              // ยังไม่ครบ 2 — เพิ่มกลุ่มเข้า anchor (limit 2 total)
              const extra = compute2Top(newRows);
              setAnchorGroups(prev => {
                const merged = new Set(prev);
                for (const k of extra) {
                  if (merged.size >= 2) break;
                  merged.add(k);
                }
                return merged;
              });
            }
          }
        }
      }

      setLastCode(code);
    } catch { /* keep existing rows */ }
    setLoading(false);
    setPartCode("");
    if (inputRef.current) inputRef.current.value = "";
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function clearAll() {
    setRows([]);
    setLastCode("");
    setAnchorGroups(null);   // reset anchor → scan ครั้งใหม่จะตั้ง anchor ใหม่
    setSearched(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function printGroup(brand, g) {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const fmtNum = (v, d = 2) => (Number(v) || 0).toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });
    const fmtIntL = v => (Number(v) || 0).toLocaleString("th-TH");
    const rowsHTML = g.items.map((it, i) => `<tr>
      <td>${it.line_no || i + 1}</td>
      <td class="mono">${it.part_code || ''}</td>
      <td>${it.part_name || ''}</td>
      <td>${it.linked_deposit_no || '-'}</td>
      <td>${it.linked_customer_name || ''}</td>
      <td>${it.linked_status || '-'}</td>
      <td class="right">${fmtNum(it.net_price)}</td>
      <td class="right">${fmtIntL(it.order_qty || 0)}</td>
      <td class="right">${it.confirmed_qty != null ? fmtIntL(it.confirmed_qty) : '-'}</td>
      <td class="right">${it.deliverable_qty != null ? fmtIntL(it.deliverable_qty) : '-'}</td>
      <td class="right">${fmtIntL(it.backorder_qty || 0)}</td>
      <td class="right">${fmtNum(it.order_amount)}</td>
    </tr>`).join("");
    const totalAmount = g.items.reduce((s, it) => s + (Number(it.order_amount) || 0), 0);
    const totalQty = g.items.reduce((s, it) => s + (Number(it.order_qty) || 0), 0);
    const totalBO = g.items.reduce((s, it) => s + (Number(it.backorder_qty) || 0), 0);
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบสั่งซื้อ ${g.doc_no}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: 'Tahoma', 'Sarabun', sans-serif; padding: 16px; font-size: 12px; color: #222; }
  h2 { margin: 0 0 6px; font-size: 18px; color: #${brand === 'HONDA' ? 'dc2626' : '1e40af'}; }
  .info { margin-bottom: 10px; font-size: 12px; color: #555; }
  .info b { color: #000; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 11px; }
  th { background: #${brand === 'HONDA' ? 'dc2626' : '1e40af'}; color: #fff; }
  .mono { font-family: monospace; font-weight: 600; }
  .right { text-align: right; }
  tfoot td { font-weight: 700; background: #f3f4f6; }
  @media print { body { padding: 0; } }
</style></head><body>
<h2>${brand === 'HONDA' ? '🔴 HONDA' : '🔵 YAMAHA'} — ใบสั่งซื้อ ${g.doc_no || '-'}</h2>
<div class="info">
  <b>APC:</b> ${g.apc_order_no || '-'} ·
  <b>วันที่:</b> ${g.doc_date ? new Date(g.doc_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'} ·
  <b>พิมพ์:</b> ${new Date().toLocaleString('th-TH')}
</div>
<table>
  <thead><tr>
    <th>#</th><th>รหัส</th><th>ชื่อ</th><th>เลขที่มัดจำ</th><th>ลูกค้า</th><th>สถานะ</th>
    <th>ราคา</th><th>สั่งซื้อ</th><th>ยืนยัน</th><th>ส่งมอบ</th><th>ค้างส่ง</th><th>ยอดรวม</th>
  </tr></thead>
  <tbody>${rowsHTML}</tbody>
  <tfoot><tr>
    <td colspan="7" class="right">รวม</td>
    <td class="right">${fmtIntL(totalQty)}</td>
    <td colspan="2"></td>
    <td class="right" style="color:#dc2626">${fmtIntL(totalBO)}</td>
    <td class="right">${fmtNum(totalAmount)}</td>
  </tr></tfoot>
</table>
</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  // ลบรหัสอะไหล่ทั้งหมด (ทุก row ที่มี part_code นั้น)
  function removeCode(code) {
    const c = String(code || "").toUpperCase();
    setRows(prev => prev.filter(r => String(r.part_code || "").toUpperCase() !== c));
    if (lastCode === c) setLastCode("");
  }

  // Filter: ถ้ามี row ที่มีสถานะ — แสดงเฉพาะที่มีสถานะ
  //          ถ้าไม่มีสักรายการเลย — แสดงทั้งหมด
  const displayRows = useMemo(() => {
    const anyStatus = rows.some(r => r.linked_status);
    return anyStatus ? rows.filter(r => r.linked_status) : rows;
  }, [rows]);

  // Group rows by (doc_no + apc) — แสดงเฉพาะ anchor groups (2 กลุ่มแรกที่ scan)
  const grouped = useMemo(() => {
    const byBrand = { HONDA: {}, YAMAHA: {} };
    for (const r of displayRows) {
      const docKey = `${r.doc_no || ""}|${r.apc_order_no || ""}`;
      // กรอง: เฉพาะ anchor groups (ถ้ามี anchor)
      if (anchorGroups && !anchorGroups.has(docKey)) continue;
      const brand = r.brand || "OTHER";
      if (!byBrand[brand]) byBrand[brand] = {};
      if (!byBrand[brand][docKey]) {
        byBrand[brand][docKey] = {
          doc_no: r.doc_no, apc_order_no: r.apc_order_no,
          doc_date: r.doc_date, items: [],
        };
      }
      byBrand[brand][docKey].items.push(r);
    }
    const sortAll = obj => Object.values(obj).sort((a, b) => new Date(b.doc_date || 0) - new Date(a.doc_date || 0));
    return { HONDA: sortAll(byBrand.HONDA), YAMAHA: sortAll(byBrand.YAMAHA) };
  }, [displayRows, anchorGroups]);

  const codesNotDisplayed = [];  // no longer limiting display
  const summary = useMemo(() => {
    let total = 0, deliv = 0, bo = 0;
    for (const r of displayRows) {
      total += Number(r.order_qty) || 0;
      deliv += Number(r.deliverable_qty || r.confirmed_qty) || 0;
      bo += Number(r.backorder_qty) || 0;
    }
    return { total_rows: displayRows.length, total_qty: total, deliverable_qty: deliv, backorder_qty: bo };
  }, [displayRows]);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🔍 สอบถามรายการอะไหล่สั่งซื้อ</h2>
      </div>

      {/* Search */}
      <div style={{ background: "#072d6b", padding: 16, borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>🔎 ค้นหารหัสอะไหล่ (HONDA + YAMAHA)</div>
          {(rows.length > 0 || lastCode) && (
            <button onClick={clearAll} style={{ padding: "5px 12px", background: "#fff", color: "#dc2626", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              🗑 ล้างทั้งหมด
            </button>
          )}
        </div>
        {lastCode && (
          <div style={{ color: "#fbbf24", fontSize: 12, marginBottom: 6, fontFamily: "monospace" }}>
            scan ล่าสุด: <strong>{lastCode}</strong> (แสดงเป็นสีแดงในตาราง)
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={inputRef} value={partCode} onChange={e => setPartCode(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            style={{ flex: 1, padding: "12px 16px", fontSize: 18, fontFamily: "monospace", border: "none", borderRadius: 8 }} autoFocus />
          <button onClick={search} disabled={loading || !partCode.trim()}
            style={{ padding: "12px 28px", background: loading ? "#9ca3af" : "#10b981", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
            {loading ? "⏳" : "🔍 ค้นหา"}
          </button>
        </div>
      </div>

      {/* Scanned codes chips */}
      {rows.length > 0 && (() => {
        const codes = [...new Set(rows.map(r => String(r.part_code || "").toUpperCase()))].filter(Boolean);
        if (!codes.length) return null;
        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, padding: 10, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, alignSelf: "center" }}>📋 รหัสที่ scan ({codes.length}):</span>
            {codes.map(c => {
              const isLast = c === lastCode;
              return (
                <span key={c} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 4px 4px 10px", borderRadius: 14,
                  background: isLast ? "#fef2f2" : "#f3f4f6",
                  color: isLast ? "#dc2626" : "#374151",
                  fontWeight: isLast ? 700 : 600, fontSize: 12, fontFamily: "monospace",
                  border: `1px solid ${isLast ? "#fca5a5" : "#d1d5db"}`,
                }}>
                  {c}
                  <button onClick={() => removeCode(c)} title="ลบรหัสนี้ออก"
                    style={{ width: 20, height: 20, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", fontSize: 11, lineHeight: 1, cursor: "pointer" }}>
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        );
      })()}

      {searched && (
        <>
          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
            <KPI label="📋 พบ" value={fmtInt(summary.total_rows)} unit="รายการ" color="#0369a1" />
            <KPI label="📦 สั่งซื้อ" value={fmt(summary.total_qty, 0)} unit="ชิ้น" color="#7c3aed" />
            <KPI label="✅ ส่งมอบได้" value={fmt(summary.deliverable_qty, 0)} unit="ชิ้น" color="#059669" />
            <KPI label="⚠️ ค้างส่ง" value={fmt(summary.backorder_qty, 0)} unit="ชิ้น" color="#dc2626" />
          </div>

          {displayRows.length === 0 ? (
            <div style={{ padding: 30, background: "#fff", borderRadius: 10, textAlign: "center", color: "#9ca3af" }}>
              ไม่พบรหัสอะไหล่ "{partCode}" ในรายการสั่งซื้อ
            </div>
          ) : (
            ["HONDA", "YAMAHA"].map(brand => {
              const groups = grouped[brand] || [];
              if (!groups.length) return null;
              const color = brand === "HONDA" ? "#dc2626" : "#1e40af";
              return (
                <div key={brand} style={{ marginBottom: 16, background: "#fff", borderRadius: 10, border: `2px solid ${color}`, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: color, color: "#fff", fontWeight: 700, fontSize: 14 }}>
                    {brand === "HONDA" ? "🔴 HONDA" : "🔵 YAMAHA"} — {groups.length} ใบสั่งซื้อ
                  </div>
                  {groups.map(g => (
                    <div key={g.doc_no || g.apc_order_no} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <div style={{ padding: "8px 14px", background: "#f9fafb", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color }}>
                          📋 ใบสั่งซื้อ: <span style={{ fontFamily: "monospace" }}>{g.doc_no || "-"}</span>
                          {g.apc_order_no && <> · APC: <span style={{ fontFamily: "monospace", color: "#6b7280" }}>{g.apc_order_no}</span></>}
                        </span>
                        <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                          <span style={{ color: "#6b7280", fontSize: 13 }}>วันที่: {fmtDate(g.doc_date)}</span>
                          <button onClick={() => printGroup(brand, g)} title="พิมพ์ใบสั่งซื้อนี้"
                            style={{ padding: "5px 14px", background: color, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            🖨 พิมพ์
                          </button>
                        </span>
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead style={{ background: "#f3f4f6" }}>
                            <tr>
                              <th style={th}>#</th>
                              <th style={th}>รหัส</th>
                              <th style={th}>ชื่อ</th>
                              <th style={th}>เลขที่มัดจำ / ลูกค้า</th>
                              <th style={th}>สถานะ</th>
                              <th style={{ ...th, textAlign: "right" }}>ราคา</th>
                              <th style={{ ...th, textAlign: "right" }}>สั่งซื้อ</th>
                              <th style={{ ...th, textAlign: "right" }}>ยืนยัน</th>
                              <th style={{ ...th, textAlign: "right" }}>ส่งมอบ</th>
                              <th style={{ ...th, textAlign: "right" }}>ค้างส่ง</th>
                              <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.items.map((it, i) => {
                              const isLast = lastCode && String(it.part_code || "").toUpperCase() === lastCode;
                              const STATUS_COLOR = {
                                "มาครบ": "#10b981", "มาไม่ครบ": "#f59e0b", "อะไหล่ค้างส่ง": "#ef4444",
                                "เปิดงาน": "#ec4899", "สั่งซื้อแล้ว": "#3b82f6", "ปิดงานซ่อม": "#dc2626",
                                "ยึดเงินมัดจำ": "#7c3aed", "รอดำเนินการ": "#9ca3af",
                                "ปิด JOB": "#6b7280", "ตีราคาซ่อม": "#a855f7",
                              };
                              const stColor = STATUS_COLOR[it.linked_status] || "#6b7280";
                              const rowColor = isLast ? "#dc2626" : undefined;
                              const rowBg = isLast ? "#fef2f2" : undefined;
                              return (
                              <tr key={i} style={{ borderTop: "1px solid #f3f4f6", background: rowBg }}>
                                <td style={{ ...td, color: rowColor, fontWeight: isLast ? 700 : 400 }}>{it.line_no || i + 1}</td>
                                <td style={{ ...td, fontFamily: "monospace", fontWeight: isLast ? 800 : 600, color: isLast ? "#dc2626" : "#0369a1" }}>{it.part_code}</td>
                                <td style={{ ...td, color: rowColor, fontWeight: isLast ? 700 : 400 }}>{it.part_name}</td>
                                <td style={td}>
                                  {it.linked_deposit_no ? (
                                    <>
                                      <div style={{ fontFamily: "monospace", fontWeight: 600, color: "#7c3aed" }}>
                                        {it.linked_deposit_no}
                                        {it.match_type === "fuzzy" && <span style={{ fontSize: 9, marginLeft: 4, color: "#d97706" }}>(fuzzy)</span>}
                                      </div>
                                      <div style={{ fontSize: 11, color: "#6b7280" }}>{it.linked_customer_name || ""}{it.linked_plate ? ` · ${it.linked_plate}` : ""}</div>
                                    </>
                                  ) : <span style={{ color: "#d1d5db" }}>—</span>}
                                </td>
                                <td style={td}>
                                  {it.linked_status ? (
                                    <span style={{
                                      padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                                      background: stColor + "33", color: stColor,
                                    }}>{it.linked_status}</span>
                                  ) : <span style={{ color: "#d1d5db" }}>—</span>}
                                </td>
                                <td style={{ ...td, textAlign: "right" }}>{fmt(it.net_price)}</td>
                                <td style={{ ...td, textAlign: "right" }}>{fmt(it.order_qty, 0)}</td>
                                <td style={{ ...td, textAlign: "right" }}>{it.confirmed_qty != null ? fmt(it.confirmed_qty, 0) : "-"}</td>
                                <td style={{ ...td, textAlign: "right", color: "#059669" }}>{it.deliverable_qty != null ? fmt(it.deliverable_qty, 0) : "-"}</td>
                                <td style={{ ...td, textAlign: "right", color: (Number(it.backorder_qty)||0) > 0 ? "#dc2626" : "#374151", fontWeight: (Number(it.backorder_qty)||0) > 0 ? 700 : 400 }}>{fmt(it.backorder_qty, 0)}</td>
                                <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt(it.order_amount)}</td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </>
      )}

      {/* Popup เตือนสแกนใหม่ */}
      {popupCode && (
        <div onClick={() => setPopupCode("")} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 28, maxWidth: 460, width: "92%", textAlign: "center", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#92400e", marginBottom: 8 }}>
              ไม่อยู่ใน 2 ใบสั่งซื้อแรก
            </div>
            <div style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>รหัสอะไหล่:</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#dc2626", fontFamily: "monospace", marginBottom: 16, padding: "10px 14px", background: "#fef2f2", borderRadius: 8, display: "inline-block" }}>
              {popupCode}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
              ไม่พบใน 2 ใบสั่งซื้อแรกที่ scan<br/>
              <strong style={{ color: "#d97706" }}>กรุณา SCAN ใหม่อีกครั้ง</strong>
            </div>
            <button onClick={() => { setPopupCode(""); setTimeout(() => inputRef.current?.focus(), 50); }}
              style={{ padding: "12px 32px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              ตกลง — สแกนใหม่
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, unit, color }) {
  return (
    <div style={{ padding: 10, background: "#fff", borderRadius: 10, border: `2px solid ${color}`, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#6b7280" }}>{unit}</div>
    </div>
  );
}

const th = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#374151", whiteSpace: "nowrap" };
const td = { padding: "6px 10px", fontSize: 12, verticalAlign: "middle" };
