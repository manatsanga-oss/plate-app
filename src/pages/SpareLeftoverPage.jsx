import React, { useEffect, useMemo, useState } from "react";

// รายงาน "อะไหล่สั่งซื้อที่ค้างสต๊อก" รายเดือน (user 2026-11-10)
// ที่มา: ไล่ด้วยมือเดือน ก.ย./ต.ค. 69 — รายการในใบสั่งซื้อ HONDA/YAMAHA ที่ "ตอนนี้ยังมีของในสต๊อก" มี 3 แบบ:
//   (1) อะไหล่เคลม: ใส่ของที่สั่งให้ลูกค้าแล้ว ชิ้นเสียส่งเคลม APC/Honda ส่งของชดเชยมาเข้าสต๊อก (ปกติ) → ติ๊ก "เคลม"
//   (2) สั่งซ้ำทั้งที่มีของอยู่แล้ว (เช่น เสื้อสูบ 2BM-E1311-30 สต๊อกมี 1 แต่สั่งเพิ่ม 28/9) → ของค้างชั้น "รอขาย"
//   (3) งานปิดไปโดยไม่ได้ใช้ของที่สั่ง
// n8n spare-leftover-api action report ทำทุกอย่างใน query เดียว (ใบ+รายการ+สต๊อก honda_inventory+กลุ่มหมุนเร็ว+รับเข้าหลังสั่ง+เครื่องหมาย) — ไม่ยิงทีละรหัส
// อะไหล่หมุนเร็ว (fast_moving_parts) ซ่อนเป็นค่าเริ่มต้นเพราะมีสต๊อกประจำอยู่แล้ว ไม่ใช่ของค้าง
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-leftover-api";

async function post(body) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json().catch(() => null);
}
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthOptions(n = 12) {
  const out = []; const d = new Date(); d.setDate(1);
  for (let i = 0; i < n; i++) { const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; out.push({ v, label: `${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}` }); d.setMonth(d.getMonth() - 1); }
  return out;
}
const fmtDate = (iso) => { if (!iso) return "-"; const [y, m, d] = String(iso).slice(0, 10).split("-"); return y && m && d ? `${d}/${m}/${String(Number(y) + 543).slice(-2)}` : iso; };
const num = (v) => { const n = Number(v); return isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : "-"; };
const STATUS_COLOR = { "ปิดงานซ่อม": "#6b7280", "มาครบ": "#2563eb", "มาไม่ครบ": "#dc2626", "อะไหล่ค้างส่ง": "#ea580c", "สั่งซื้อแล้ว": "#0891b2", "เปิดงาน": "#db2777", "รอดำเนินการ": "#ca8a04", "ยกเลิก (คืนเงิน)": "#9ca3af" };

export default function SpareLeftoverPage({ currentUser }) {
  const me = currentUser?.name || currentUser?.username || "";
  const [month, setMonth] = useState(thisMonth());
  const [brand, setBrand] = useState("ALL");
  const [hideFast, setHideFast] = useState(true);
  const [hideMarked, setHideMarked] = useState(false);
  // ค่าเริ่มต้นดูเฉพาะใบที่ปิดแล้ว: ใบที่ยังเปิด (มาครบ/มาไม่ครบ/อะไหล่ค้างส่ง) ของอยู่ชั้น "รอขาย" รอลูกค้าเป็นเรื่องปกติ ไม่ใช่ของค้าง (ทดสอบ ต.ค.69: ใบธีรพงษ์ 30 รายการโผล่ทั้งใบ)
  const [onlyClosed, setOnlyClosed] = useState(true);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ order_count: 0, item_count: 0 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState({});
  const [noteDraft, setNoteDraft] = useState({});

  async function load() {
    setLoading(true); setErr("");
    try {
      const r = await post({ action: "report", month, brand });
      if (!r || r.error) { setErr(r?.error || "โหลดไม่สำเร็จ"); setRows([]); return; }
      let list = [];
      try { list = JSON.parse(r.listjson || "[]"); } catch { list = []; }
      setRows(list.map((x) => ({ ...x, stock: Array.isArray(x.stock) ? x.stock : (() => { try { return JSON.parse(x.stock || "[]"); } catch { return []; } })() })));
      setMeta({ order_count: Number(r.order_count || 0), item_count: Number(r.item_count || 0) });
      setNoteDraft({});
    } catch (e) { setErr(String(e?.message || e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [month, brand]); // eslint-disable-line

  const rowKey = (r) => `${r.brand}|${r.deposit_doc_no || ""}|${r.part_key}`;
  async function saveMark(r, patch) {
    const k = rowKey(r);
    const next = { mark: patch.mark !== undefined ? patch.mark : r.mark, note: patch.note !== undefined ? patch.note : (r.mark_note || "") };
    setSaving((s) => ({ ...s, [k]: true }));
    try {
      const res = await post({ action: "save_mark", brand: r.brand, deposit_doc_no: r.deposit_doc_no || "", part_code: r.part_code, mark: next.mark, note: next.note, user: me });
      const saved = res && !res.error ? res : null;
      // ล้าง (mark ว่าง + note ว่าง) = n8n ลบแถวแล้ว RETURNING ค่าเก่า → ห้ามเอาค่าที่ตอบกลับมาใช้
      const cleared = !next.mark && !next.note;
      setRows((rs) => rs.map((x) => rowKey(x) !== k ? x : cleared ? { ...x, mark: "", mark_note: "", marked_by: "", marked_at: "" } : { ...x, mark: saved?.mark ?? next.mark ?? "", mark_note: saved ? (saved.note || "") : next.note, marked_by: saved?.marked_by || me, marked_at: saved?.marked_at || "" }));
      if (res?.error) alert("บันทึกไม่สำเร็จ: " + res.error);
    } finally { setSaving((s) => ({ ...s, [k]: false })); }
  }

  const CLOSED = ["ปิดงานซ่อม", "ปิดการขาย", "ยกเลิก (คืนเงิน)"];
  // ใบนอกเงินมัดจำไม่มีสถานะปิดงาน (ค้าง "บันทึกใบสั่งซื้อแล้ว" ตลอด) → นับรวมเสมอ
  const base = useMemo(() => rows.filter((r) => !onlyClosed || r.brand === "OUTSIDE" || CLOSED.includes(r.status)), [rows, onlyClosed]); // eslint-disable-line
  const visible = useMemo(() => base.filter((r) => (!hideFast || !r.fast_group) && (!hideMarked || !r.mark)), [base, hideFast, hideMarked]);
  const stats = useMemo(() => {
    const fast = base.filter((r) => r.fast_group).length;
    const claim = base.filter((r) => r.mark === "claim").length;
    const checked = base.filter((r) => r.mark === "checked").length;
    return { stock: base.length, fast, nonFast: base.length - fast, claim, checked, openHidden: rows.length - base.length, orders: new Set(visible.map((r) => `${r.brand}:${r.order_id}`)).size };
  }, [rows, base, visible]);

  const th = { padding: "8px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#fff", background: "#072d6b", whiteSpace: "nowrap", position: "sticky", top: 0 };
  const td = { padding: "6px 8px", fontSize: 13, verticalAlign: "top", borderBottom: "1px solid #e5e7eb" };
  const card = { background: "#fff", borderRadius: 10, padding: "10px 14px", boxShadow: "0 1px 3px rgba(0,0,0,.08)" };

  return (
    <div style={{ padding: 16, maxWidth: 1500 }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>📦 อะไหล่สั่งซื้อที่ค้างสต๊อก</h2>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
        รายการในใบสั่งซื้อ HONDA / YAMAHA / นอกเงินมัดจำ ของเดือนที่เลือก ที่ <b>ตอนนี้ยังมีของอยู่ในสต๊อก</b> (ไฟล์สินค้าคงเหลือรอบล่าสุด · HONDA เช็คเฉพาะร้าน ป.เปา · YAMAHA เช็คเฉพาะสำนักงานใหญ่/ห้าห้อง · ไม่นับ สช ตลาด) — ปกติของที่สั่งให้ลูกค้าควรถูกใช้หมด
        ถ้ายังอยู่ = เคลมส่งของชดเชย / สั่งซ้ำทั้งที่มีของ / งานปิดโดยไม่ได้ใช้ · อะไหล่หมุนเร็วมีสต๊อกประจำอยู่แล้วจึงซ่อนไว้
        · ช่อง "เคลม" <b>ติ๊กให้อัตโนมัติ</b> เมื่อรหัสนั้นมีรายการในระบบเคลมอะไหล่ HONDA (upload การ์ด "ระบบเคลมอะไหล่ HONDA") หลังวันสั่งไม่เกิน 120 วัน — ติ๊กออกได้ ระบบจำค่าที่แก้
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: "7px 10px", fontSize: 14, borderRadius: 8, border: "1px solid #cbd5e1" }}>
          {monthOptions(18).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} style={{ padding: "7px 10px", fontSize: 14, borderRadius: 8, border: "1px solid #cbd5e1" }}>
          <option value="ALL">ทุกระบบ</option><option value="HONDA">HONDA</option><option value="YAMAHA">YAMAHA</option><option value="OUTSIDE">นอกเงินมัดจำ</option>
        </select>
        <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }} title="ใบที่ยังเปิด (มาครบ/มาไม่ครบ/อะไหล่ค้างส่ง) ของอยู่ชั้นรอขายรอลูกค้า ไม่นับเป็นของค้าง"><input type="checkbox" checked={onlyClosed} onChange={(e) => setOnlyClosed(e.target.checked)} /> เฉพาะใบที่ปิดงานแล้ว{stats.openHidden ? ` (ซ่อนใบเปิด ${stats.openHidden})` : ""}</label>
        <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={hideFast} onChange={(e) => setHideFast(e.target.checked)} /> ซ่อนอะไหล่หมุนเร็ว ({stats.fast})</label>
        <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={hideMarked} onChange={(e) => setHideMarked(e.target.checked)} /> ซ่อนที่ติ๊กแล้ว</label>
        <button onClick={load} disabled={loading} style={{ padding: "7px 14px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>{loading ? "กำลังโหลด…" : "Refresh"}</button>
        <button onClick={() => window.print()} style={{ padding: "7px 14px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>🖨️ พิมพ์</button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {[["ใบสั่งซื้อในเดือน", meta.order_count, "#374151"], ["รายการที่สั่ง", meta.item_count, "#374151"], ["ยังมีของในสต๊อก", stats.stock, "#b45309"], ["เป็นหมุนเร็ว", stats.fast, "#6b7280"], ["ค้างจริง (ไม่ใช่หมุนเร็ว)", stats.nonFast, "#dc2626"], ["ติ๊กเคลมแล้ว", stats.claim, "#2563eb"], ["ตรวจแล้ว", stats.checked, "#16a34a"]].map(([l, v, c]) => (
          <div key={l} style={{ ...card, minWidth: 120 }}><div style={{ fontSize: 11, color: "#6b7280" }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div></div>
        ))}
      </div>

      {err && <div style={{ color: "#dc2626", marginBottom: 10 }}>❌ {err}</div>}

      <div style={{ ...card, padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>ยี่ห้อ</th><th style={th}>วันที่สั่ง</th><th style={th}>ใบมัดจำ / สถานะ</th><th style={th}>ลูกค้า / รถ</th>
              <th style={th}>รหัสอะไหล่</th><th style={th}>ชื่อ</th><th style={{ ...th, textAlign: "right" }}>สั่ง</th>
              <th style={th}>สต๊อกตอนนี้</th><th style={th}>รับเข้าหลังสั่ง</th><th style={th}>เคลม</th><th style={th}>ตรวจแล้ว</th><th style={th}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && !loading && (
              <tr><td colSpan={12} style={{ ...td, textAlign: "center", color: "#6b7280", padding: 24 }}>ไม่มีรายการค้างสต๊อกในเดือนนี้{hideFast ? " (นอกจากอะไหล่หมุนเร็วที่ซ่อนไว้)" : ""}</td></tr>
            )}
            {visible.map((r, i) => {
              const k = rowKey(r); const prev = visible[i - 1]; const sameOrder = prev && prev.brand === r.brand && prev.order_id === r.order_id;
              const bg = r.mark === "claim" ? "#eff6ff" : r.mark === "checked" ? "#f0fdf4" : (i % 2 ? "#fafafa" : "#fff");
              return (
                <tr key={k} style={{ background: bg }}>
                  <td style={td}>{sameOrder ? "" : <span style={{ fontWeight: 700, color: r.brand === "HONDA" ? "#dc2626" : r.brand === "OUTSIDE" ? "#7c3aed" : "#2563eb" }}>{r.brand === "OUTSIDE" ? "นอกมัดจำ" : r.brand}</span>}</td>
                  <td style={td}>{sameOrder ? "" : fmtDate(r.order_date)}</td>
                  <td style={td}>{sameOrder ? "" : <>
                    <div style={{ fontWeight: 700, fontFamily: "monospace" }}>{r.deposit_doc_no || r.order_no}</div>
                    <div style={{ fontSize: 11, color: STATUS_COLOR[r.status] || "#374151" }}>{r.status || "-"}{r.vendor_po_no ? ` · PO ${r.vendor_po_no}` : ""}</div>
                  </>}</td>
                  <td style={td}>{sameOrder ? "" : <>
                    <div>{r.customer_name || "-"}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{[r.model_name, r.license_plate, r.technician].filter(Boolean).join(" · ")}</div>
                  </>}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>{r.part_code}{r.fast_group && <div style={{ fontSize: 10, color: "#b45309", fontFamily: "inherit", fontWeight: 600 }}>หมุนเร็ว {r.fast_group}</div>}</td>
                  <td style={td}>{r.part_name || "-"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{num(r.quantity)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {(r.stock || []).map((s, j) => <div key={j}><b style={{ color: "#b45309" }}>{num(s.qty)}</b> {s.source}{s.location && s.location !== "-" ? <span style={{ color: "#6b7280" }}> ({s.location})</span> : ""}</div>)}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap", color: r.received_date ? "#374151" : "#dc2626" }} title={r.received_date ? "วันรับเข้าแรกหลังวันสั่ง (ภายใน 60 วัน)" : "ไม่พบรับเข้ารหัสนี้ภายใน 60 วันหลังสั่ง — อาจใช้ของในสต๊อก/รหัสทดแทน"}>
                    {r.received_date ? fmtDate(r.received_date) : "ไม่พบ"}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <input type="checkbox" checked={r.mark === "claim"} disabled={!!saving[k]} onChange={(e) => saveMark(r, { mark: e.target.checked ? "claim" : "" })} title={r.claim_no ? `พบในระบบเคลมอะไหล่ HONDA: ${r.claim_no} ${fmtDate(r.claim_date)} · ${r.claim_status || ""}${r.claim_invoice_no ? ` · ใบ ${r.claim_invoice_no}` : ""} — ติ๊กให้อัตโนมัติ (ติ๊กออกได้)` : "อะไหล่เคลม: ของชดเชยจากบริษัทเข้าสต๊อก"} />
                    {/* เคลมอัตโนมัติจากตาราง honda_part_claims (upload การ์ด "ระบบเคลมอะไหล่ HONDA") — user 2026-11-11 */}
                    {r.claim_no && <div style={{ fontSize: 10, color: "#2563eb", lineHeight: 1.3, whiteSpace: "nowrap" }} title={r.claim_status || ""}>{r.claim_no}<br />{fmtDate(r.claim_date)}</div>}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={r.mark === "checked"} disabled={!!saving[k]} onChange={(e) => saveMark(r, { mark: e.target.checked ? "checked" : "" })} title="ตรวจแล้ว/จัดการแล้ว" /></td>
                  <td style={{ ...td, minWidth: 160 }}>
                    <input value={noteDraft[k] !== undefined ? noteDraft[k] : (r.mark_note || "")} placeholder="เช่น เลขเคลม / เหตุผล"
                      onChange={(e) => setNoteDraft((d) => ({ ...d, [k]: e.target.value }))}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (r.mark_note || "")) saveMark(r, { note: v }); }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                      style={{ width: "100%", padding: "4px 6px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6 }} />
                    {r.marked_by && <div style={{ fontSize: 10, color: "#9ca3af" }}>{r.marked_by} {r.marked_at}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
        แสดง {visible.length} รายการ จาก {stats.orders} ใบ · "รับเข้าหลังสั่ง" เทียบรายงานรับอะไหล่ (HONDA: honda_part_receipts · YAMAHA: yamaha_part_receipt_items) ภายใน 60 วันหลังวันสั่ง ถ้ารับเป็นรหัสทดแทน/รหัสใหม่จะขึ้น "ไม่พบ"
      </div>
    </div>
  );
}
