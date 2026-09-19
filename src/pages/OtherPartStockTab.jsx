import React, { useEffect, useMemo, useState } from "react";

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
const fmtDate = (v) => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])}/${Number(m[2])}/${Number(m[1]) + 543}` : "-"; };

export default function OtherPartStockTab({ apiUrl }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [store, setStore] = useState("all");
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
      if (q) {
        const code = String(r.part_code || "").toLowerCase();
        if (!(code.includes(q) || code.replace(/-/g, "").includes(qn) || String(r.product_name || "").toLowerCase().includes(q) || String(r.product_group || "").toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [rows, search, group, store]);
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
    const head = ["กลุ่มสินค้า", "รหัสสินค้า", "ชื่อสินค้า", "หน่วย", "รวม", ...STORES.map(s => s.l), "ราคา/หน่วย", "มูลค่ารวม", "ที่เก็บ"];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map(r => [r.product_group, r.part_code, r.product_name, r.unit, r.quantity, ...STORES.map(s => r[s.k]), r.unit_price, r.total_value, r.locations].map(q).join(","));
    const blob = new Blob(["﻿" + [head.map(q).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "สต๊อกอะไหล่นอกหมุนเร็ว.csv"; a.click(); URL.revokeObjectURL(a.href);
  }

  const inp = { padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 };
  const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12 };
  const td = { padding: "7px 8px", fontSize: 12.5, borderBottom: "1px solid #e5e7eb" };
  const tdR = { ...td, textAlign: "right", whiteSpace: "nowrap" };

  return (
    <div>
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
        <button onClick={load} disabled={loading} style={{ padding: "8px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>{loading ? "กำลังโหลด..." : "Refresh"}</button>
        <button onClick={exportCsv} disabled={!filtered.length} style={{ padding: "8px 16px", fontSize: 13, background: filtered.length ? "#15803d" : "#d1d5db", color: "#fff", border: "none", borderRadius: 8, cursor: filtered.length ? "pointer" : "default", fontWeight: 700 }}>⬇️ Excel (CSV)</button>
        <span style={{ fontSize: 13, color: "#374151" }}>{filtered.length.toLocaleString()} รายการ · รวม {fmtQty(sums.quantity)} ชิ้น · มูลค่า {fmtMoney(sums.total_value)} บาท{reportDate ? ` · ข้อมูล ณ ${fmtDate(reportDate)}` : ""}</span>
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>อะไหล่ทุกรหัสที่มียอดคงเหลือในไฟล์สินค้าคงเหลือ ยกเว้นรหัสที่อยู่ในรายการอะไหล่หมุนเร็ว — ยอดตามไฟล์ที่ upload ล่าสุดของแต่ละร้าน</div>
      {error && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13 }}>❌ {error}</div>}

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={th}>#</th><th style={th}>กลุ่มสินค้า</th><th style={th}>รหัสสินค้า</th><th style={th}>ชื่อสินค้า</th>
              <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
              {STORES.map(s => <th key={s.k} style={{ ...th, textAlign: "right" }}>{s.l}</th>)}
              <th style={{ ...th, textAlign: "right" }}>ราคา/หน่วย</th><th style={{ ...th, textAlign: "right" }}>มูลค่ารวม</th><th style={th}>ที่เก็บ</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 24 }}>{loading ? "กำลังโหลด..." : "ไม่มีรายการ"}</td></tr>}
            {paged.map((r, i) => (
              <tr key={r.part_code + i} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={td}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td style={td}>{r.product_group || "-"}</td>
                <td style={{ ...td, fontFamily: "monospace", whiteSpace: "nowrap" }}>{r.part_code}</td>
                <td style={td}>{r.product_name || "-"}</td>
                <td style={{ ...tdR, fontWeight: 700, color: "#166534" }}>{fmtQty(r.quantity)}</td>
                {STORES.map(s => <td key={s.k} style={tdR}>{fmtQty(r[s.k])}</td>)}
                <td style={tdR}>{Number(r.unit_price) > 0 ? fmtMoney(r.unit_price) : "-"}</td>
                <td style={tdR}>{Number(r.total_value) > 0 ? fmtMoney(r.total_value) : "-"}</td>
                <td style={{ ...td, fontSize: 11.5, color: "#6b7280" }}>{r.locations || "-"}</td>
              </tr>
            ))}
            {filtered.length > 0 && page === totalPages && (
              <tr style={{ background: "#fef3c7", fontWeight: 700 }}>
                <td style={td} colSpan={4}>รวมทั้งหมด ({filtered.length.toLocaleString()} รายการ)</td>
                <td style={tdR}>{fmtQty(sums.quantity)}</td>
                {STORES.map(s => <td key={s.k} style={tdR}>{fmtQty(sums[s.k])}</td>)}
                <td style={tdR}></td><td style={tdR}>{fmtMoney(sums.total_value)}</td><td style={td}></td>
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
