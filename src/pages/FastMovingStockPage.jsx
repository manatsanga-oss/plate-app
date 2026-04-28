import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-stock-api";

export default function FastMovingStockPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [filterStockType, setFilterStockType] = useState("all");
  const [filterBackorder, setFilterBackorder] = useState("all");
  const [filterPendingJob, setFilterPendingJob] = useState("all");
  const [hideRecentOrdered, setHideRecentOrdered] = useState(false);
  const [filterStoreStock, setFilterStoreStock] = useState("all");
  const [onlyStockNakhonluang, setOnlyStockNakhonluang] = useState(false);
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
    const result = { ppao: "-", haahong: "-", sachtalad: "-", nakhonluang: "-" };
    if (!storesStr || storesStr === "-") return result;
    const parts = String(storesStr).split("|").map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      // อนุญาตให้ไม่มี (location) หรือมี () ว่างก็ได้
      const m = p.match(/^(.+?)\s+(\d+(?:\.\d+)?)(?:\s*\(([^)]*)\))?\s*$/);
      if (!m) continue;
      const name = m[1].trim();
      const qty = m[2];
      if (name.includes("นครหลวง")) result.nakhonluang = qty;
      else if (name.includes("ป.เปา") || name.includes("ป เปา")) result.ppao = qty;
      else if (name.includes("ห้าห้อง") || name.includes("ห้าน้อง")) result.haahong = qty;
      else if (name.includes("สช") || name.includes("ศช")) result.sachtalad = qty;
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
    const st = r.stock_type || "สต๊อก";
    if (filterStockType === "stock" && st !== "สต๊อก") return false;
    if (filterStockType === "nostock" && st !== "ไม่สต๊อก") return false;
    if (filterBackorder === "yes" && Number(r.backorder_qty || 0) <= 0) return false;
    if (filterBackorder === "no" && Number(r.backorder_qty || 0) > 0) return false;
    if (filterPendingJob === "yes" && Number(r.pending_job_qty || 0) <= 0) return false;
    if (filterPendingJob === "no" && Number(r.pending_job_qty || 0) > 0) return false;
    // แสดงเฉพาะอะไหล่สต๊อกนครหลวง
    if (onlyStockNakhonluang && !r.is_stock_nakhonluang) return false;
    // กรองตามร้าน (มีของ/ไม่มีของ)
    if (filterStoreStock !== "all") {
      const s = parseStores(r.stores);
      const [store, mode] = filterStoreStock.split(":");
      const raw = s[store];
      const qty = raw === "-" ? 0 : Number(raw) || 0;
      if (mode === "has" && qty <= 0) return false;
      if (mode === "none" && qty > 0) return false;
    }
    // ซ่อนรายการที่หมดสต๊อก + สั่งซื้อภายใน 7 วันที่ผ่านมา
    if (hideRecentOrdered && Number(r.quantity || 0) <= 0 && r.last_order_date) {
      const orderDate = new Date(r.last_order_date);
      if (!isNaN(orderDate)) {
        const diffDays = (Date.now() - orderDate.getTime()) / 86400000;
        if (diffDays >= 0 && diffDays <= 7) return false;
      }
    }
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

  function printReport() {
    const w = window.open("", "_blank", "width=1200,height=800");
    const filterLabel = [
      filterGroup !== "all" ? `กลุ่ม: ${filterGroup}` : "",
      filterBrand !== "all" ? `ยี่ห้อ: ${filterBrand}` : "",
      filterStock !== "all" ? (filterStock === "in" ? "มีสต๊อก" : "สินค้าหมด") : "",
      filterBackorder !== "all" ? (filterBackorder === "yes" ? "มีค้างส่ง" : "ไม่มีค้างส่ง") : "",
      filterPendingJob !== "all" ? (filterPendingJob === "yes" ? "มีค้างปิด JOB" : "ไม่มีค้างปิด JOB") : "",
    ].filter(Boolean).join(" | ") || "ทั้งหมด";
    const fmtD = d => { if (!d) return "-"; const dt = new Date(d); if (isNaN(dt)) return d; return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()+543}`; };
    const rows = filtered.map((r, i) => {
      const s = parseStores(r.stores);
      return `<tr>
        <td class="c">${i + 1}</td>
        <td>${r.product_group || "-"}</td>
        <td>${r.part_code}</td>
        <td>${r.product_name || "-"}</td>
        <td class="r">${Number(r.quantity || 0)}</td>
        <td class="r">${s.ppao}</td>
        <td class="r">${s.haahong}</td>
        <td class="r">${s.sachtalad}</td>
        <td class="r">${s.nakhonluang}</td>
        <td>${fmtD(r.last_order_date)}</td>
        <td class="r">${Number(r.avg_order_qty_3m || 0) > 0 ? Number(r.avg_order_qty_3m).toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "-"}</td>
        <td class="r">${r.backorder_qty || "-"}</td>
        <td>${fmtD(r.backorder_eta)}</td>
        <td class="r">${r.pending_job_qty || "-"}</td>
      </tr>`;
    }).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายงานสต๊อกอะไหล่หมุนเร็ว</title>
<style>
  body { font-family: 'Tahoma', sans-serif; padding: 16px; font-size: 10px; }
  h2 { margin: 0 0 4px; font-size: 15px; }
  .info { font-size: 11px; color: #555; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 3px 5px; }
  th { background: #072d6b; color: #fff; font-size: 9px; }
  .c { text-align: center; }
  .r { text-align: right; }
  @media print { body { padding: 0; } }
</style></head><body>
<h2>รายงานสต๊อกอะไหล่หมุนเร็ว</h2>
<div class="info">ตัวกรอง: ${filterLabel} | จำนวน: ${filtered.length} รายการ | พิมพ์: ${new Date().toLocaleString("th-TH")}</div>
<table>
  <thead><tr>
    <th>#</th><th>กลุ่มสินค้า</th><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>จำนวน</th><th>ป.เปา</th><th>ห้าห้อง</th><th>สช.ตลาด</th><th>นครหลวง</th><th>วันที่สั่งล่าสุด</th><th>เฉลี่ยสั่ง/เดือน</th><th>ค้างส่ง</th><th>คาดว่าได้รับ</th><th>ค้างปิด JOB</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`);
    w.document.close();
    w.print();
  }

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
        <button onClick={printReport} style={{ padding: "8px 16px", fontSize: 13, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>พิมพ์</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterStock} onChange={e => { setFilterStock(e.target.value); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }}>
          <option value="all">ทั้งหมด</option>
          <option value="in">มีสต๊อก</option>
          <option value="out">สินค้าหมด</option>
        </select>
        <select value={filterStockType} onChange={e => { setFilterStockType(e.target.value); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #072d6b", borderRadius: 8, color: "#072d6b" }}>
          <option value="all">ประเภทอะไหล่ ทั้งหมด</option>
          <option value="stock">อะไหล่สต๊อก</option>
          <option value="nostock">อะไหล่ไม่สต๊อก</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#065f46", fontWeight: 600, cursor: "pointer", padding: "6px 10px", border: "1px solid #6ee7b7", borderRadius: 8, background: filterBackorder === "no" ? "#ecfdf5" : "#fff" }}>
          <input type="checkbox" checked={filterBackorder === "no"} onChange={e => { setFilterBackorder(e.target.checked ? "no" : "all"); setCurrentPage(1); }} />
          ไม่ค้างส่ง
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#065f46", fontWeight: 600, cursor: "pointer", padding: "6px 10px", border: "1px solid #6ee7b7", borderRadius: 8, background: filterPendingJob === "no" ? "#ecfdf5" : "#fff" }}>
          <input type="checkbox" checked={filterPendingJob === "no"} onChange={e => { setFilterPendingJob(e.target.checked ? "no" : "all"); setCurrentPage(1); }} />
          ไม่ค้างปิด JOB
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#dc2626", fontWeight: 600, cursor: "pointer", padding: "6px 10px", border: "1px solid #fca5a5", borderRadius: 8, background: hideRecentOrdered ? "#fef2f2" : "#fff" }}>
          <input type="checkbox" checked={hideRecentOrdered} onChange={e => { setHideRecentOrdered(e.target.checked); setCurrentPage(1); }} />
          สั่งซื้อ 7 วัน
        </label>
        <select value={filterStoreStock} onChange={e => { setFilterStoreStock(e.target.value); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #0ea5e9", borderRadius: 8, color: "#0369a1", fontWeight: 600 }}>
          <option value="all">🏪 ทุกร้าน</option>
          <option value="ppao:none">ป.เปา ไม่มีของ</option>
          <option value="haahong:none">ห้าห้อง ไม่มีของ</option>
          <option value="sachtalad:none">สช.ตลาด ไม่มีของ</option>
          <option value="nakhonluang:none">นครหลวง ไม่มีของ</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#0369a1", fontWeight: 600, cursor: "pointer", padding: "6px 10px", border: "1px solid #7dd3fc", borderRadius: 8, background: onlyStockNakhonluang ? "#e0f2fe" : "#fff" }}>
          <input type="checkbox" checked={onlyStockNakhonluang} onChange={e => { setOnlyStockNakhonluang(e.target.checked); setCurrentPage(1); }} />
          🏪 สต๊อกนครหลวง
        </label>
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
              <th style={{ ...th, textAlign: "right" }}>นครหลวง</th>
              <th style={th}>วันที่สั่งล่าสุด</th>
              <th style={{ ...th, textAlign: "right" }}>เฉลี่ยสั่ง/เดือน (3ด.)</th>
              <th style={{ ...th, textAlign: "right" }}>ค้างส่ง</th>
              <th style={th}>คาดว่าได้รับ</th>
              <th style={{ ...th, textAlign: "right" }}>ค้างปิด JOB</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} style={{ textAlign: "center", padding: 20 }}>กำลังโหลด...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={14} style={{ textAlign: "center", padding: 20 }}>ไม่พบข้อมูล</td></tr>
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
                  <td style={{ ...td, textAlign: "right" }}>{s.nakhonluang}</td>
                  <td style={td}>{r.last_order_date ? new Date(r.last_order_date).toLocaleDateString("th-TH") : ""}</td>
                  <td style={{ ...td, textAlign: "right" }}>{Number(r.avg_order_qty_3m || 0) > 0 ? Number(r.avg_order_qty_3m).toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : ""}</td>
                  <td style={{ ...td, textAlign: "right", color: Number(r.backorder_qty || 0) > 0 ? "#b91c1c" : undefined, fontWeight: Number(r.backorder_qty || 0) > 0 ? 700 : undefined }}>{Number(r.backorder_qty || 0) > 0 ? fmtQty(r.backorder_qty) : ""}</td>
                  <td style={td}>{r.expected_date ? new Date(r.expected_date).toLocaleDateString("th-TH") : ""}</td>
                  <td style={{ ...td, textAlign: "right", color: Number(r.pending_job_qty || 0) > 0 ? "#7c3aed" : undefined, fontWeight: Number(r.pending_job_qty || 0) > 0 ? 700 : undefined }}>{Number(r.pending_job_qty || 0) > 0 ? fmtQty(r.pending_job_qty) : ""}</td>
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
