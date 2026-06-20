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
  const [hidePendingReceipt, setHidePendingReceipt] = useState(false);
  const [filterStoreStock, setFilterStoreStock] = useState("all");
  const [onlyStockNakhonluang, setOnlyStockNakhonluang] = useState(false);
  const [onlyLoan, setOnlyLoan] = useState(false);
  const [tab, setTab] = useState("stock"); // stock | loan
  const [currentPage, setCurrentPage] = useState(1);
  const [jobDetail, setJobDetail] = useState(null); // { item_code, item_name, loading, rows }
  const [loanDetail, setLoanDetail] = useState(null); // { part_code, product_name, loading, rows }

  async function openJobDetail(part_code, product_name) {
    setJobDetail({ part_code, product_name, loading: true, rows: [] });
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_pending_jobs", item_code: part_code }),
      });
      const data = await res.json();
      setJobDetail({ part_code, product_name, loading: false, rows: Array.isArray(data) ? data.filter(r => r) : [] });
    } catch {
      setJobDetail({ part_code, product_name, loading: false, rows: [] });
    }
  }

  async function openLoanDetail(part_code, product_name) {
    setLoanDetail({ part_code, product_name, loading: true, rows: [] });
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_part_loans", item_code: part_code }),
      });
      const data = await res.json();
      setLoanDetail({ part_code, product_name, loading: false, rows: Array.isArray(data) ? data.filter(r => r) : [] });
    } catch {
      setLoanDetail({ part_code, product_name, loading: false, rows: [] });
    }
  }
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
    // ซ่อนอะไหล่ที่ยกเลิกผลิต (is_discontinued)
    if (r.is_discontinued) return false;
    if (filterGroup !== "all" && r.product_group !== filterGroup) return false;
    if (filterBrand !== "all" && r.brand !== filterBrand) return false;
    const qty = Number(r.quantity || 0);
    // "สินค้าหมด" / "มีสต๊อก" เช็คจากร้านหลักตามยี่ห้อ: HONDA = ป.เปา, YAMAHA = ห้าห้อง
    const _s = parseStores(r.stores);
    const _brand = String(r.brand || "").toUpperCase();
    // "สินค้าหมด" / "มีสต๊อก" เช็คตามยี่ห้อ:
    // HONDA  = ป.เปา + สช.ตลาด (รวมกัน) เป็น 0 = หมด
    // YAMAHA = ห้าห้อง เป็น 0 = หมด
    const _toNum = v => (v === "-" || v == null) ? 0 : Number(v) || 0;
    const mainQty = _brand.includes("YAMAHA")
      ? _toNum(_s.haahong)
      : _toNum(_s.ppao) + _toNum(_s.sachtalad);
    if (filterStock === "in" && mainQty <= 0) return false;
    if (filterStock === "out" && mainQty > 0) return false;
    const st = r.stock_type || "สต๊อก";
    if (filterStockType === "stock" && st !== "สต๊อก") return false;
    if (filterStockType === "nostock" && st !== "ไม่สต๊อก") return false;
    if (filterBackorder === "yes" && Number(r.backorder_qty || 0) <= 0) return false;
    if (filterBackorder === "no" && Number(r.backorder_qty || 0) > 0) return false;
    if (filterPendingJob === "yes" && Number(r.pending_job_qty || 0) <= 0) return false;
    if (filterPendingJob === "no" && Number(r.pending_job_qty || 0) > 0) return false;
    // แสดงเฉพาะอะไหล่สต๊อกนครหลวง
    if (onlyStockNakhonluang && !r.is_stock_nakhonluang) return false;
    // แสดงเฉพาะรายการที่มีให้ยืม (ไม่ว่าง)
    if (onlyLoan && Number(r.loan_qty || 0) <= 0) return false;
    // กรองตามร้าน (มีของ/ไม่มีของ)
    if (filterStoreStock !== "all") {
      const s = parseStores(r.stores);
      const [store, mode] = filterStoreStock.split(":");
      const raw = s[store];
      const qty = raw === "-" ? 0 : Number(raw) || 0;
      if (mode === "has" && qty <= 0) return false;
      if (mode === "none" && qty > 0) return false;
    }
    // "ไม่ค้างรับเข้า": ซ่อนรายการที่ค้างรับเข้าสต๊อก
    // (ค้างรับเข้า = สั่งซื้อแล้ว + ไม่ค้างส่ง + วันที่สั่งซื้อ > วันที่รับเข้าล่าสุด หรือยังไม่เคยรับเข้า)
    // เงื่อนไขเพิ่ม: สั่งซื้อก่อน 31/5/2569 (2026-05-31) ถือว่ารับเข้าหมดแล้ว → ไม่นับเป็นค้าง
    if (hidePendingReceipt && r.last_order_date && Number(r.backorder_qty || 0) <= 0) {
      const orderDate = new Date(r.last_order_date);
      const RECEIPT_CUTOFF = new Date("2026-05-31"); // สั่งก่อนวันนี้ = รับเข้าแล้ว
      if (!isNaN(orderDate) && orderDate.getTime() >= RECEIPT_CUTOFF.getTime()) {
        const receiptDate = r.last_receipt_date ? new Date(r.last_receipt_date) : null;
        const received = receiptDate && !isNaN(receiptDate) && receiptDate.getTime() >= orderDate.getTime();
        if (!received) return false; // ค้างรับเข้า (สั่งตั้งแต่ 31/5/2569 แต่ยังไม่รับ) → ซ่อน
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
      onlyLoan ? "มีให้ยืม" : "",
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
        <td class="r">${r.loan_qty || "-"}</td>
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
    <th>#</th><th>กลุ่มสินค้า</th><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>จำนวน</th><th>ป.เปา</th><th>ห้าห้อง</th><th>สช.ตลาด</th><th>นครหลวง</th><th>ให้ยืม</th><th>วันที่สั่งล่าสุด</th><th>จ่ายอะไหล่เฉลี่ย (3ด.)</th><th>ค้างส่ง</th><th>คาดว่าได้รับ</th><th>ค้างปิด JOB</th>
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

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, borderBottom: "2px solid #e5e7eb" }}>
        {[{ k: "stock", l: "📦 สต๊อกอะไหล่หมุนเร็ว" }, { k: "loan", l: "🤝 ใบให้ยืม / รอตัดสต๊อก" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding: "8px 18px", fontSize: 14, fontWeight: 700, border: "none", background: "transparent",
              borderBottom: tab === t.k ? "3px solid #072d6b" : "3px solid transparent",
              color: tab === t.k ? "#072d6b" : "#6b7280", cursor: "pointer", marginBottom: -2 }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === "loan" && <LoanWriteoffTab apiUrl={API_URL} />}

      {tab === "stock" && (<>
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
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#dc2626", fontWeight: 600, cursor: "pointer", padding: "6px 10px", border: "1px solid #fca5a5", borderRadius: 8, background: hidePendingReceipt ? "#fef2f2" : "#fff" }}>
          <input type="checkbox" checked={hidePendingReceipt} onChange={e => { setHidePendingReceipt(e.target.checked); setCurrentPage(1); }} />
          📥 ไม่ค้างรับเข้า
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
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#ea580c", fontWeight: 600, cursor: "pointer", padding: "6px 10px", border: "1px solid #fdba74", borderRadius: 8, background: onlyLoan ? "#fff7ed" : "#fff" }}>
          <input type="checkbox" checked={onlyLoan} onChange={e => { setOnlyLoan(e.target.checked); setCurrentPage(1); }} />
          🤝 มีให้ยืม
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
              <th style={{ ...th, textAlign: "right" }}>ให้ยืม</th>
              <th style={th}>วันที่สั่งล่าสุด</th>
              <th style={{ ...th, textAlign: "right" }}>จ่ายอะไหล่เฉลี่ย (3ด.)</th>
              <th style={{ ...th, textAlign: "right" }}>ค้างส่ง</th>
              <th style={th}>คาดว่าได้รับ</th>
              <th style={{ ...th, textAlign: "right" }}>ค้างปิด JOB</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} style={{ textAlign: "center", padding: 20 }}>กำลังโหลด...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={15} style={{ textAlign: "center", padding: 20 }}>ไม่พบข้อมูล</td></tr>
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
                  <td style={{ ...td, textAlign: "right", color: Number(r.loan_qty || 0) > 0 ? "#ea580c" : undefined, fontWeight: Number(r.loan_qty || 0) > 0 ? 700 : undefined }}>
                    {Number(r.loan_qty || 0) > 0 ? (
                      <span onClick={() => openLoanDetail(r.part_code, r.product_name)}
                        style={{ cursor: "pointer", textDecoration: "underline" }}
                        title="คลิกดูเลขที่ใบให้ยืม">{fmtQty(r.loan_qty)}</span>
                    ) : ""}
                  </td>
                  <td style={td}>{r.last_order_date ? new Date(r.last_order_date).toLocaleDateString("th-TH") : ""}</td>
                  <td style={{ ...td, textAlign: "right" }}>{Number(r.avg_order_qty_3m || 0) > 0 ? Number(r.avg_order_qty_3m).toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : ""}</td>
                  <td style={{ ...td, textAlign: "right", color: Number(r.backorder_qty || 0) > 0 ? "#b91c1c" : undefined, fontWeight: Number(r.backorder_qty || 0) > 0 ? 700 : undefined }}>{Number(r.backorder_qty || 0) > 0 ? fmtQty(r.backorder_qty) : ""}</td>
                  <td style={td}>{r.expected_date ? new Date(r.expected_date).toLocaleDateString("th-TH") : ""}</td>
                  <td style={{ ...td, textAlign: "right", color: Number(r.pending_job_qty || 0) > 0 ? "#7c3aed" : undefined, fontWeight: Number(r.pending_job_qty || 0) > 0 ? 700 : undefined }}>
                    {Number(r.pending_job_qty || 0) > 0 ? (
                      <span onClick={() => openJobDetail(r.part_code, r.product_name)}
                        style={{ cursor: "pointer", textDecoration: "underline" }}
                        title="คลิกดูรายละเอียด JOB">{fmtQty(r.pending_job_qty)}</span>
                    ) : ""}
                  </td>
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

      {jobDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}
             onClick={() => setJobDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1100, width: "95%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#7c3aed" }}>📋 JOB ค้างปิด · {jobDetail.part_code} · {jobDetail.product_name}</h3>
              <button onClick={() => setJobDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {jobDetail.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : jobDetail.rows.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่พบรายการ</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f0f4f9" }}>
                  <tr>
                    <th style={{ padding: 8, textAlign: "left" }}>#</th>
                    <th style={{ padding: 8, textAlign: "left" }}>เลขที่ JOB</th>
                    <th style={{ padding: 8, textAlign: "left" }}>วันที่เปิด JOB</th>
                    <th style={{ padding: 8, textAlign: "left" }}>ลูกค้า</th>
                    <th style={{ padding: 8, textAlign: "left" }}>วันที่เบิก</th>
                    <th style={{ padding: 8, textAlign: "left" }}>ชื่ออะไหล่</th>
                    <th style={{ padding: 8, textAlign: "right" }}>จำนวน</th>
                    <th style={{ padding: 8, textAlign: "right" }}>ราคา/หน่วย</th>
                    <th style={{ padding: 8, textAlign: "right" }}>รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {jobDetail.rows.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 7 }}>{i + 1}</td>
                      <td style={{ padding: 7, fontFamily: "monospace", fontWeight: 600 }}>{r.job_no || "-"}</td>
                      <td style={{ padding: 7 }}>{r.open_date ? new Date(r.open_date).toLocaleDateString("th-TH") : "-"}</td>
                      <td style={{ padding: 7 }}>{r.customer_name || "-"}</td>
                      <td style={{ padding: 7 }}>{r.issue_date ? new Date(r.issue_date).toLocaleDateString("th-TH") : "-"}</td>
                      <td style={{ padding: 7 }}>{r.part_name || "-"}</td>
                      <td style={{ padding: 7, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "#7c3aed" }}>{Number(r.qty || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: 7, textAlign: "right", fontFamily: "monospace" }}>{Number(r.unit_price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: 7, textAlign: "right", fontFamily: "monospace" }}>{Number(r.total_price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#f3e8ff", fontWeight: 700 }}>
                    <td colSpan={6} style={{ padding: 7, textAlign: "right" }}>รวม {jobDetail.rows.length} รายการ</td>
                    <td style={{ padding: 7, textAlign: "right", fontFamily: "monospace", color: "#7c3aed" }}>
                      {jobDetail.rows.reduce((s, r) => s + Number(r.qty || 0), 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                    <td style={{ padding: 7, textAlign: "right", fontFamily: "monospace", color: "#7c3aed" }}>
                      {jobDetail.rows.reduce((s, r) => s + Number(r.total_price || 0), 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {loanDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}
             onClick={() => setLoanDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 900, width: "95%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#ea580c" }}>🤝 ใบให้ยืม · {loanDetail.part_code} · {loanDetail.product_name}</h3>
              <button onClick={() => setLoanDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {loanDetail.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : loanDetail.rows.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่พบใบให้ยืม</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#fff7ed" }}>
                  <tr>
                    <th style={{ padding: 8, textAlign: "left" }}>#</th>
                    <th style={{ padding: 8, textAlign: "left" }}>เลขที่ใบให้ยืม</th>
                    <th style={{ padding: 8, textAlign: "left" }}>วันที่ยืม</th>
                    <th style={{ padding: 8, textAlign: "left" }}>ผู้ยืม</th>
                    <th style={{ padding: 8, textAlign: "left" }}>ชื่ออะไหล่</th>
                    <th style={{ padding: 8, textAlign: "right" }}>จำนวน</th>
                    <th style={{ padding: 8, textAlign: "right" }}>ราคาทุน</th>
                    <th style={{ padding: 8, textAlign: "right" }}>รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {loanDetail.rows.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 7 }}>{i + 1}</td>
                      <td style={{ padding: 7, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.loan_no || "-"}</td>
                      <td style={{ padding: 7 }}>{r.loan_date ? new Date(r.loan_date).toLocaleDateString("th-TH") : "-"}</td>
                      <td style={{ padding: 7 }}>{r.borrower || "-"}</td>
                      <td style={{ padding: 7 }}>{r.part_name || "-"}</td>
                      <td style={{ padding: 7, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "#ea580c" }}>{Number(r.qty || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: 7, textAlign: "right", fontFamily: "monospace" }}>{Number(r.unit_cost || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: 7, textAlign: "right", fontFamily: "monospace" }}>{Number(r.total_amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#fff7ed", fontWeight: 700 }}>
                    <td colSpan={5} style={{ padding: 7, textAlign: "right" }}>รวม {loanDetail.rows.length} ใบ</td>
                    <td style={{ padding: 7, textAlign: "right", fontFamily: "monospace", color: "#ea580c" }}>
                      {loanDetail.rows.reduce((s, r) => s + Number(r.qty || 0), 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                    <td style={{ padding: 7, textAlign: "right", fontFamily: "monospace", color: "#ea580c" }}>
                      {loanDetail.rows.reduce((s, r) => s + Number(r.total_amount || 0), 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}

function LoanWriteoffTab({ apiUrl }) {
  const [active, setActive] = useState([]);
  const [recorded, setRecorded] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null); // { loan_no, loading, rows }

  async function openDetail(loan_no) {
    setDetail({ loan_no, loading: true, rows: [] });
    try { const rows = await post({ action: "loan_detail", loan_no }); setDetail({ loan_no, loading: false, rows: Array.isArray(rows) ? rows.filter(Boolean) : [] }); }
    catch { setDetail({ loan_no, loading: false, rows: [] }); }
  }

  async function post(body) {
    const res = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => []);
    return Array.isArray(d) ? d : (d?.data || []);
  }
  async function load() {
    setLoading(true);
    try {
      const [a, r] = await Promise.all([post({ action: "list_loans" }), post({ action: "list_loan_writeoff" })]);
      setActive(Array.isArray(a) ? a.filter(Boolean) : []);
      setRecorded(Array.isArray(r) ? r.filter(Boolean) : []);
    } catch { setActive([]); setRecorded([]); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save(loan_no) { setBusy(loan_no); try { await post({ action: "save_loan_writeoff", loan_no }); await load(); } catch {} setBusy(""); }
  async function undo(loan_no) { setBusy(loan_no); try { await post({ action: "delete_loan_writeoff", loan_no }); await load(); } catch {} setBusy(""); }

  const fmtN = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtB = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtD = v => v ? new Date(v).toLocaleDateString("th-TH") : "-";
  const q = search.trim().toLowerCase();
  const fActive = active.filter(r => !q || String(r.loan_no).toLowerCase().includes(q) || String(r.borrower || "").toLowerCase().includes(q));

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา เลขใบยืม / ผู้ยืม"
          style={{ padding: "8px 14px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, width: 260 }} />
        <button onClick={load} style={{ padding: "8px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Refresh</button>
      </div>

      <h3 style={{ margin: "6px 0", color: "#ea580c", fontSize: 15 }}>🤝 ใบให้ยืมที่ยังค้าง (ยังไม่รับคืน) — {fActive.length} ใบ</h3>
      <div style={{ overflowX: "auto", marginBottom: 22 }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#072d6b", color: "#fff" }}>
            <th style={th}>เลขที่ใบยืม</th><th style={th}>วันที่ยืม</th><th style={th}>ผู้ยืม</th>
            <th style={{ ...th, textAlign: "right" }}>รายการ</th><th style={{ ...th, textAlign: "right" }}>จำนวน</th><th style={{ ...th, textAlign: "right" }}>มูลค่า</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 16 }}>กำลังโหลด...</td></tr>
              : fActive.length === 0 ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 16, color: "#9ca3af" }}>ไม่มีใบยืมค้าง</td></tr>
                : fActive.map(r => (
                  <tr key={r.loan_no} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={td}><span onClick={() => openDetail(r.loan_no)} title="ดูรายการสินค้าในใบยืม"
                      style={{ fontFamily: "monospace", fontWeight: 600, color: "#0369a1", cursor: "pointer", textDecoration: "underline" }}>{r.loan_no}</span></td>
                    <td style={td}>{fmtD(r.loan_date)}</td>
                    <td style={td}>{r.borrower || "-"}</td>
                    <td style={{ ...td, textAlign: "right" }}>{fmtN(r.item_count)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#ea580c" }}>{fmtN(r.total_qty)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{fmtB(r.total_amount)}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <button disabled={busy === r.loan_no} onClick={() => save(r.loan_no)}
                        style={{ padding: "5px 14px", fontSize: 12, fontWeight: 700, background: busy === r.loan_no ? "#9ca3af" : "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>💾 บันทึก</button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ margin: "6px 0", color: "#7c3aed", fontSize: 15 }}>📋 บันทึกแล้ว — รอตัดสินค้าขาดสต๊อก — {recorded.length} ใบ</h3>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#7c3aed", color: "#fff" }}>
            <th style={th}>เลขที่ใบยืม</th><th style={th}>วันที่ยืม</th><th style={th}>ผู้ยืม</th>
            <th style={{ ...th, textAlign: "right" }}>รายการ</th><th style={{ ...th, textAlign: "right" }}>จำนวน</th><th style={{ ...th, textAlign: "right" }}>มูลค่า</th>
            <th style={th}>บันทึกเมื่อ</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {recorded.length === 0 ? <tr><td colSpan={8} style={{ textAlign: "center", padding: 16, color: "#9ca3af" }}>ยังไม่มีรายการ</td></tr>
              : recorded.map(r => (
                <tr key={r.loan_no} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={td}><span onClick={() => openDetail(r.loan_no)} title="ดูรายการสินค้าในใบยืม"
                    style={{ fontFamily: "monospace", fontWeight: 600, color: "#0369a1", cursor: "pointer", textDecoration: "underline" }}>{r.loan_no}</span></td>
                  <td style={td}>{fmtD(r.loan_date)}</td>
                  <td style={td}>{r.borrower || "-"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmtN(r.item_count)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmtN(r.total_qty)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmtB(r.total_amount)}</td>
                  <td style={td}>{fmtD(r.recorded_at)}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button disabled={busy === r.loan_no} onClick={() => undo(r.loan_no)}
                      style={{ padding: "5px 12px", fontSize: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>↩ ถอนคืน</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}
             onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 800, width: "95%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#0369a1" }}>🤝 รายการในใบยืม · {detail.loan_no}</h3>
              <button onClick={() => setDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {detail.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div>
              : detail.rows.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่พบรายการ</div>
                : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead style={{ background: "#f0f4f9" }}>
                      <tr>
                        <th style={{ padding: 8, textAlign: "left" }}>#</th>
                        <th style={{ padding: 8, textAlign: "left" }}>รหัสอะไหล่</th>
                        <th style={{ padding: 8, textAlign: "left" }}>ชื่ออะไหล่</th>
                        <th style={{ padding: 8, textAlign: "right" }}>จำนวน</th>
                        <th style={{ padding: 8, textAlign: "right" }}>ราคาทุน</th>
                        <th style={{ padding: 8, textAlign: "right" }}>รวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.rows.map((r, i) => (
                        <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={{ padding: 7 }}>{i + 1}</td>
                          <td style={{ padding: 7, fontFamily: "monospace" }}>{r.part_code || "-"}</td>
                          <td style={{ padding: 7 }}>{r.part_name || "-"}</td>
                          <td style={{ padding: 7, textAlign: "right", fontWeight: 600 }}>{Number(r.qty || 0).toLocaleString("th-TH")}</td>
                          <td style={{ padding: 7, textAlign: "right" }}>{Number(r.unit_cost || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style={{ padding: 7, textAlign: "right" }}>{Number(r.total_amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "#eff6ff", fontWeight: 700 }}>
                        <td colSpan={3} style={{ padding: 7, textAlign: "right" }}>รวม {detail.rows.length} รายการ</td>
                        <td style={{ padding: 7, textAlign: "right" }}>{detail.rows.reduce((s, r) => s + Number(r.qty || 0), 0).toLocaleString("th-TH")}</td>
                        <td></td>
                        <td style={{ padding: 7, textAlign: "right", color: "#0369a1" }}>{detail.rows.reduce((s, r) => s + Number(r.total_amount || 0), 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 12 };
const td = { padding: "8px 10px" };
