import React, { useEffect, useMemo, useState } from "react";
import { printBoxLabels } from "../utils/boxLabels"; // ป้ายปิดหน้ากล่อง/ป้ายยาว ชุดเดียวกับแท็บหมุนเร็ว (user 2026-09-25)

// แท็บ "สต๊อกอะไหล่อื่น (นอกหมุนเร็ว)" ในหน้าระบบจัดการสต๊อกอะไหล่หมุนเร็ว — user 2026-09-19
// อะไหล่ทุกรหัสที่มียอดคงเหลือในไฟล์สินค้าคงเหลือ (honda_inventory ทุกร้าน) ยกเว้นรหัสที่อยู่ในรายการหมุนเร็ว — แสดงยอดคงเหลือแยกสาขา
// ข้อมูล: fast-moving-stock-api action list_other_stock (ตอบ {listjson} แถวเดียว)
const PAGE_SIZE = 100;
const STORES = [
  { k: "qty_ppao", l: "ป.เปา" },
  { k: "qty_haahong", l: "ห้าห้อง" },
  { k: "qty_sachtalad", l: "สช.ตลาด" },
  { k: "qty_nakhonluang", l: "นครหลวง" },
];
const fmtQty = (v) => { const n = Number(v) || 0; return n === 0 ? "-" : n.toLocaleString("th-TH", { maximumFractionDigits: 2 }); };
const fmtMoney = (v) => (Number(v) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// สีป้ายสถานะใบมัดจำ/สั่งซื้อ — ชุดเดียวกับหน้าสั่งซื้ออะไหล่ (SparePartsOrderPage)
const orderStatusStyle = (st) => {
  const s = String(st || "");
  if (s === "ปิดงานซ่อม") return { background: "#dc2626", color: "#fff" };
  if (s === "อะไหล่ค้างส่ง") return { background: "#f97316", color: "#fff" };
  if (s === "รอยกเลิก DCS") return { background: "#7c2d12", color: "#fff" };
  if (s === "คืนเงินมัดจำ" || s.startsWith("ยกเลิก")) return { background: "#b91c1c", color: "#fff" };
  if (s === "เปิดงาน") return { background: "#ec4899", color: "#fff" };
  if (s === "มาครบ") return { background: "#dbeafe", color: "#1e40af" };
  if (s === "มาไม่ครบ") return { background: "#fee2e2", color: "#b91c1c" };
  if (s === "สั่งซื้อแล้ว") return { background: "#d1fae5", color: "#065f46" };
  return { background: "#fef3c7", color: "#92400e" };
};
const fmtDate = (v) => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])}/${Number(m[2])}/${Number(m[1]) + 543}` : "-"; };

export default function OtherPartStockTab({ apiUrl }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [store, setStore] = useState("all");
  const [onlyReceived, setOnlyReceived] = useState(false); // แสดงเฉพาะรหัสที่มีวันที่รับเข้าล่าสุด (user 2026-09-23)
  const [labelSel, setLabelSel] = useState(() => new Set()); // รหัสที่ติ๊กไว้พิมพ์ป้ายกล่อง
  const [labelSizeOpen, setLabelSizeOpen] = useState(false);
  const toggleLabel = (code) => setLabelSel(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
  const toggleLabelPage = (checked) => setLabelSel(prev => { const n = new Set(prev); paged.forEach(r => checked ? n.add(r.part_code) : n.delete(r.part_code)); return n; });
  // เดายี่ห้อไว้พิมพ์บนป้าย: รูปแบบรหัส Honda 5-3-3/4 → HONDA · มีเฉพาะสต๊อกห้าห้อง (NID) → YAMAHA
  const brandOf = (r) => /^[A-Z0-9]{5}-[A-Z0-9]{3}-[A-Z0-9]{3,4}$/i.test(String(r.part_code || "").trim()) ? "HONDA"
    : (Number(r.qty_haahong) > 0 && !(Number(r.qty_ppao) > 0 || Number(r.qty_sachtalad) > 0 || Number(r.qty_nakhonluang) > 0)) ? "YAMAHA" : "";
  const doPrintLabels = (size) => { setLabelSizeOpen(false); printBoxLabels(rows.filter(r => labelSel.has(r.part_code)).map(r => ({ ...r, brand: r.brand || brandOf(r) })), size); };
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_other_stock" }) });
      const t = await res.text();
      if (!t.trim()) throw new Error("ไม่มีการตอบกลับจาก n8n (ตรวจว่า re-import Fast_Moving_API.json แล้ว)");
      const d = JSON.parse(t);
      const first = Array.isArray(d) ? d[0] : d;
      if (!first || typeof first.listjson !== "string") throw new Error("workflow ยังไม่มี action list_other_stock — re-import Fast_Moving_API.json");
      setRows(JSON.parse(first.listjson));
    } catch (e) { setRows([]); setError(e.message || String(e)); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const groups = useMemo(() => [...new Set(rows.map(r => r.product_group).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qn = q.replace(/-/g, "");
    return rows.filter(r => {
      if (group !== "all" && r.product_group !== group) return false;
      if (store !== "all" && !(Number(r[store]) > 0)) return false;
      if (onlyReceived && !r.last_receipt_date) return false;
      if (q) {
        const code = String(r.part_code || "").toLowerCase();
        if (!(code.includes(q) || code.replace(/-/g, "").includes(qn) || String(r.product_name || "").toLowerCase().includes(q) || String(r.product_group || "").toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [rows, search, group, store, onlyReceived]);
  useEffect(() => { setPage(1); }, [search, group, store]);

  const sums = useMemo(() => filtered.reduce((t, r) => {
    t.quantity += Number(r.quantity) || 0; t.total_value += Number(r.total_value) || 0;
    STORES.forEach(s => { t[s.k] += Number(r[s.k]) || 0; });
    return t;
  }, { quantity: 0, total_value: 0, qty_ppao: 0, qty_haahong: 0, qty_sachtalad: 0, qty_nakhonluang: 0 }), [filtered]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const reportDate = useMemo(() => rows.reduce((m, r) => (String(r.report_date || "") > m ? String(r.report_date) : m), ""), [rows]);

  function exportCsv() {
    const head = ["กลุ่มสินค้า", "รหัสสินค้า", "ชื่อสินค้า", "หน่วย", "รวม", ...STORES.map(s => s.l), "ราคา/หน่วย", "มูลค่ารวม", "รับเข้าล่าสุด", "มัดจำล่าสุด", "สถานะมัดจำ", "ที่เก็บ"];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map(r => [r.product_group, r.part_code, r.product_name, r.unit, r.quantity, ...STORES.map(s => r[s.k]), r.unit_price, r.total_value, r.last_receipt_date ? fmtDate(r.last_receipt_date) : "", r.last_order_doc || "", r.last_order_status || "", r.locations].map(q).join(","));
    const blob = new Blob(["﻿" + [head.map(q).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "สต๊อกอะไหล่นอกหมุนเร็ว.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  const inp = { padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 };
  const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12 };
  const td = { padding: "7px 8px", fontSize: 12.5, borderBottom: "1px solid #e5e7eb" };
  const tdR = { ...td, textAlign: "right", whiteSpace: "nowrap" };

  return (
    <div>
      {labelSizeOpen && (
        <div onClick={() => setLabelSizeOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: 520, maxWidth: "94vw", fontFamily: "Tahoma" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#072d6b", marginBottom: 4 }}>🏷️ เลือกขนาดป้าย — {labelSel.size} รายการ</div>
            <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 14 }}>พิมพ์บนกระดาษสติ๊กเกอร์ A4 มีเส้นประไว้ตัด</div>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { k: "box", t: "10 × 10 ซม. (แบบเดิม)", d: "ป้ายปิดหน้ากล่อง · 8 ป้าย/แผ่น", pv: { width: 84, height: 56 } },
                { k: "strip", t: "15 × 2 ซม.", d: "ป้ายยาวติดขอบชั้น/สันกล่อง · 12 ป้าย/แผ่น", pv: { width: 150, height: 20 } },
              ].map(o => (
                <button key={o.k} onClick={() => doPrintLabels(o.k)}
                  style={{ flex: 1, padding: "14px 10px", border: "2px solid #b45309", borderRadius: 10, background: "#fffbeb", cursor: "pointer", fontFamily: "Tahoma", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ height: 60, display: "flex", alignItems: "center" }}>
                    <div style={{ ...o.pv, border: "1.5px dashed #92400e", borderRadius: 3, background: "#fff" }} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#92400e" }}>{o.t}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{o.d}</div>
                </button>
              ))}
            </div>
            <div style={{ textAlign: "right", marginTop: 12 }}><button onClick={() => setLabelSizeOpen(false)} style={{ padding: "6px 14px", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", cursor: "pointer" }}>ยกเลิก</button></div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา รหัส / ชื่อสินค้า / กลุ่ม" style={{ ...inp, width: 280 }} />
        <select value={group} onChange={e => setGroup(e.target.value)} style={{ ...inp, maxWidth: 300 }}>
          <option value="all">ทุกกลุ่มสินค้า</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={store} onChange={e => setStore(e.target.value)} style={{ ...inp, border: "1px solid #0ea5e9" }}>
          <option value="all">🏬 ทุกร้าน</option>
          {STORES.map(s => <option key={s.k} value={s.k}>มีของที่ {s.l}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1e40af", cursor: "pointer", whiteSpace: "nowrap" }} title="ซ่อนรหัสที่ไม่เคยมีใบรับสินค้าในระบบ (คอลัมน์รับเข้าล่าสุดเป็น -)">
          <input type="checkbox" checked={onlyReceived} onChange={e => { setOnlyReceived(e.target.checked); setPage(1); }} /> เฉพาะที่มีวันที่รับเข้า
        </label>
        <button onClick={load} disabled={loading} style={{ padding: "8px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>{loading ? "กำลังโหลด..." : "Refresh"}</button>
        <button onClick={exportCsv} disabled={!filtered.length} style={{ padding: "8px 16px", fontSize: 13, background: filtered.length ? "#15803d" : "#d1d5db", color: "#fff", border: "none", borderRadius: 8, cursor: filtered.length ? "pointer" : "default", fontWeight: 700 }}>⬇️ Excel (CSV)</button>
        <button onClick={() => setLabelSizeOpen(true)} disabled={labelSel.size === 0} title="ติ๊กเลือกแถวในตาราง แล้วพิมพ์ป้ายบนกระดาษสติ๊กเกอร์ A4 — เลือกขนาดป้ายได้"
          style={{ padding: "8px 16px", fontSize: 13, background: labelSel.size ? "#b45309" : "#d1d5db", color: "#fff", border: "none", borderRadius: 8, cursor: labelSel.size ? "pointer" : "default", fontWeight: 700 }}>
          🏷️ พิมพ์ป้ายกล่อง{labelSel.size ? ` (${labelSel.size})` : ""}
        </button>
        {labelSel.size > 0 && <button onClick={() => setLabelSel(new Set())} style={{ padding: "8px 10px", fontSize: 12, background: "#fff", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer" }}>ล้างที่เลือก</button>}
        <span style={{ fontSize: 13, color: "#374151" }}>{filtered.length.toLocaleString()} รายการ · รวม {fmtQty(sums.quantity)} ชิ้น · มูลค่า {fmtMoney(sums.total_value)} บาท{reportDate ? ` · ข้อมูล ณ ${fmtDate(reportDate)}` : ""}</span>
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>อะไหล่ทุกรหัสที่มียอดคงเหลือในไฟล์สินค้าคงเหลือ ยกเว้นรหัสที่อยู่ในรายการอะไหล่หมุนเร็ว — ยอดตามไฟล์ที่ upload ล่าสุดของแต่ละร้าน</div>
      {error && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13 }}>❌ {error}</div>}

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={{ ...th, textAlign: "center" }} title="เลือกทั้งหน้านี้เพื่อพิมพ์ป้ายกล่อง"><input type="checkbox" checked={paged.length > 0 && paged.every(r => labelSel.has(r.part_code))} onChange={e => toggleLabelPage(e.target.checked)} /></th>
              <th style={th}>#</th><th style={th}>กลุ่มสินค้า</th><th style={th}>รหัสสินค้า</th><th style={th}>ชื่อสินค้า</th>
              <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
              {STORES.map(s => <th key={s.k} style={{ ...th, textAlign: "right" }}>{s.l}</th>)}
              <th style={{ ...th, textAlign: "right" }}>ราคา/หน่วย</th><th style={{ ...th, textAlign: "right" }}>มูลค่ารวม</th><th style={{ ...th, whiteSpace: "nowrap" }} title="วันที่รับอะไหล่ครั้งล่าสุด จากไฟล์รับสินค้า HONDA/YAMAHA ที่ upload (รหัสที่ไม่เคยมีใบรับในระบบจะเป็น -)">รับเข้าล่าสุด</th><th style={{ ...th, whiteSpace: "nowrap" }} title="ใบมัดจำ/ใบสั่งซื้ออะไหล่ล่าสุด (HONDA/YAMAHA) ที่มีรหัสนี้ พร้อมสถานะปัจจุบันของใบ">มัดจำล่าสุด</th><th style={th}>ที่เก็บ</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && <tr><td colSpan={14} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 24 }}>{loading ? "กำลังโหลด..." : "ไม่มีรายการ"}</td></tr>}
            {paged.map((r, i) => (
              <tr key={r.part_code + i} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={labelSel.has(r.part_code)} onChange={() => toggleLabel(r.part_code)} title="เลือกพิมพ์ป้ายกล่อง" /></td>
                <td style={td}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td style={td}>{r.product_group || "-"}</td>
                <td style={{ ...td, fontFamily: "monospace", whiteSpace: "nowrap" }}>{r.part_code}</td>
                <td style={td}>{r.product_name || "-"}</td>
                <td style={{ ...tdR, fontWeight: 700, color: "#166534" }}>{fmtQty(r.quantity)}</td>
                {STORES.map(s => <td key={s.k} style={tdR}>{fmtQty(r[s.k])}</td>)}
                <td style={tdR}>{Number(r.unit_price) > 0 ? fmtMoney(r.unit_price) : "-"}</td>
                <td style={tdR}>{Number(r.total_value) > 0 ? fmtMoney(r.total_value) : "-"}</td>
                <td style={{ ...td, whiteSpace: "nowrap", color: r.last_receipt_date ? "#1e40af" : "#9ca3af" }}>{r.last_receipt_date ? fmtDate(r.last_receipt_date) : "-"}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  {r.last_order_doc ? (
                    <div>
                      <div style={{ fontFamily: "monospace", fontSize: 12 }}>{r.last_order_doc}<span style={{ color: "#6b7280", fontSize: 10.5, marginLeft: 4 }}>{r.last_order_date ? fmtDate(r.last_order_date) : ""}</span></div>
                      <span style={{ display: "inline-block", marginTop: 2, padding: "1px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, ...orderStatusStyle(r.last_order_status) }}>{r.last_order_status || "-"}</span>
                    </div>
                  ) : <span style={{ color: "#9ca3af" }}>-</span>}
                </td>
                <td style={{ ...td, fontSize: 11.5, color: "#6b7280" }}>{r.locations || "-"}</td>
              </tr>
            ))}
            {filtered.length > 0 && page === totalPages && (
              <tr style={{ background: "#fef3c7", fontWeight: 700 }}>
                <td style={td} colSpan={5}>รวมทั้งหมด ({filtered.length.toLocaleString()} รายการ)</td>
                <td style={tdR}>{fmtQty(sums.quantity)}</td>
                {STORES.map(s => <td key={s.k} style={tdR}>{fmtQty(sums[s.k])}</td>)}
                <td style={tdR}></td><td style={tdR}>{fmtMoney(sums.total_value)}</td><td style={td}></td><td style={td}></td><td style={td}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginTop: 12, fontSize: 13 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: page === 1 ? "default" : "pointer" }}>‹ ก่อนหน้า</button>
          <span>หน้า {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: page === totalPages ? "default" : "pointer" }}>ถัดไป ›</button>
        </div>
      )}
    </div>
  );
}
