import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-stock-api";

export default function FastMovingStockPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 30;

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }

  const fmtQty = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // แยกข้อมูล stores ออกเป็นแต่ละร้าน (แสดงเฉพาะจำนวน)
  function parseStores(storesStr) {
    const result = { ppao: "-", haahong: "-", sachtalad: "-" };
    if (!storesStr || storesStr === "-") return result;
    const parts = String(storesStr).split("|").map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      const m = p.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*\(([^)]+)\)\s*$/);
      if (!m) continue;
      const name = m[1].trim();
      const qty = m[2];
      if (name.includes("ป.เปา") || name.includes("ป เปา")) result.ppao = qty;
      else if (name.includes("ห้าห้อง")) result.haahong = qty;
      else if (name.includes("สช")) result.sachtalad = qty;
    }
    return result;
  }

  const groups = [...new Set(rows.map(r => r.product_group).filter(Boolean))].sort();
  const brands = [...new Set(rows.map(r => r.brand).filter(Boolean))].sort();

  const filtered = rows.filter(r => {
    if (filterGroup !== "all" && r.product_group !== filterGroup) return false;
    if (filterBrand !== "all" && r.brand !== filterBrand) return false;
    const qty = Number(r.quantity || 0);
    if (filterStock === "in" && qty <= 0) return false;
    if (filterStock === "out" && qty > 0) return false;
    if (search) {
      const q = search.toLowerCase();
      const hit = [r.part_code, r.product_name, r.product_group]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">ระบบจัดการสต๊อกอะไหล่หมุนเร็ว</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="ค้นหา รหัส / ชื่อสินค้า / กลุ่มสินค้า"
          style={{ padding: "8px 14px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, width: 280 }} />
        <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }}>
          <option value="all">ทุกกลุ่มสินค้า</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #072d6b", borderRadius: 8, fontWeight: 600 }}>
          <option value="all">ทุกยี่ห้อ</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <button onClick={fetchData} style={{ padding: "8px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Refresh</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterStock} onChange={e => { setFilterStock(e.target.value); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }}>
          <option value="all">ทั้งหมด</option>
          <option value="in">มีสต๊อก</option>
          <option value="out">สินค้าหมด</option>
        </select>
        <span style={{ fontSize: 13, color: "#374151" }}>{filtered.length} รายการ</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={th}>#</th>
              <th style={th}>กลุ่มสินค้า</th>
              <th style={th}>รหัสสินค้า</th>
              <th style={th}>ชื่อสินค้า</th>
              <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
              <th style={{ ...th, textAlign: "right" }}>ป.เปา</th>
              <th style={{ ...th, textAlign: "right" }}>ห้าห้อง</th>
              <th style={{ ...th, textAlign: "right" }}>สช.ตลาด</th>
              <th style={th}>วันที่สั่งล่าสุด</th>
              <th style={{ ...th, textAlign: "right" }}>เฉลี่ยสั่ง/เดือน (3ด.)</th>
              <th style={{ ...th, textAlign: "right" }}>ค้างส่ง</th>
              <th style={th}>คาดว่าได้รับ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} style={{ textAlign: "center", padding: 20 }}>กำลังโหลด...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: "center", padding: 20 }}>ไม่พบข้อมูล</td></tr>
            ) : paged.map((r, i) => {
              const qty = Number(r.quantity || 0);
              const s = parseStores(r.stores);
              return (
                <tr key={r.id || i} style={{ borderBottom: "1px solid #e5e7eb", background: qty <= 0 ? "#fef2f2" : i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ ...td, textAlign: "center" }}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                  <td style={td}>{r.product_group || "-"}</td>
                  <td style={td}>{r.part_code}</td>
                  <td style={{ ...td, whiteSpace: "normal", maxWidth: 240 }}>{r.product_name || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: qty <= 0 ? "#ef4444" : "#065f46" }}>{fmtQty(qty)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{s.ppao}</td>
                  <td style={{ ...td, textAlign: "right" }}>{s.haahong}</td>
                  <td style={{ ...td, textAlign: "right" }}>{s.sachtalad}</td>
                  <td style={td}>{r.last_order_date ? new Date(r.last_order_date).toLocaleDateString("th-TH") : ""}</td>
                  <td style={{ ...td, textAlign: "right" }}>{Number(r.avg_order_qty_3m || 0) > 0 ? Number(r.avg_order_qty_3m).toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : ""}</td>
                  <td style={{ ...td, textAlign: "right", color: Number(r.backorder_qty || 0) > 0 ? "#b91c1c" : undefined, fontWeight: Number(r.backorder_qty || 0) > 0 ? 700 : undefined }}>{Number(r.backorder_qty || 0) > 0 ? fmtQty(r.backorder_qty) : ""}</td>
                  <td style={td}>{r.expected_date ? new Date(r.expected_date).toLocaleDateString("th-TH") : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 12 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
            .map((p, i, arr) => (
              <React.Fragment key={p}>
                {i > 0 && arr[i - 1] !== p - 1 && <span style={{ padding: "4px 8px" }}>...</span>}
                <button onClick={() => setCurrentPage(p)}
                  style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6,
                    border: currentPage === p ? "none" : "1px solid #d1d5db",
                    background: currentPage === p ? "#072d6b" : "#fff",
                    color: currentPage === p ? "#fff" : "#374151", cursor: "pointer" }}>
                  {p}
                </button>
              </React.Fragment>
            ))}
        </div>
      )}
    </div>
  );
}

const th = { padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 12 };
const td = { padding: "8px 10px" };
