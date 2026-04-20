import React, { useEffect, useState, useRef } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/moto-booking-api";

export default function MotoStockPage() {
  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterSeries, setFilterSeries] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterBranch2, setFilterBranch2] = useState("all");
  const [filterBranch3, setFilterBranch3] = useState("all");
  const [filterQty, setFilterQty] = useState([]);
  const [filterQty2, setFilterQty2] = useState([]);
  const [showQtyDropdown, setShowQtyDropdown] = useState(false);
  const [showQtyDropdown2, setShowQtyDropdown2] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 30;
  const qtyRef = useRef(null);
  const qtyRef2 = useRef(null);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    function handleClick(e) {
      setTimeout(() => {
        if (qtyRef.current && !qtyRef.current.contains(e.target)) setShowQtyDropdown(false);
        if (qtyRef2.current && !qtyRef2.current.contains(e.target)) setShowQtyDropdown2(false);
      }, 0);
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_moto_stock_summary" }) });
      const data = await res.json();
      setRawRows(Array.isArray(data) ? data : []);
    } catch { setRawRows([]); }
    setLoading(false);
  }

  // ดึง branches จากข้อมูลจริง
  const branches = [...new Set(rawRows.map(r => r.branch_code).filter(Boolean))].sort()
    .map(code => ({ code, name: (rawRows.find(r => r.branch_code === code) || {}).branch_name || code }));

  // pivot: group by brand/series/model/color → branch columns
  const pivotMap = {};
  rawRows.forEach(r => {
    const key = `${r.brand}|${r.model_series}|${r.model_code}|${r.color_name}`;
    if (!pivotMap[key]) pivotMap[key] = { brand: r.brand, model_series: r.model_series, model_code: r.model_code, color_name: r.color_name };
    pivotMap[key][`qty_${r.branch_code}`] = Number(r.qty || 0);
    pivotMap[key][`age_${r.branch_code}`] = r.age;
  });
  const rows = Object.values(pivotMap);

  function toggleSelect(key) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function sendLine() {
    if (selectedRows.size === 0 || filterBranch === "all") return;
    setSending(true);
    const fromBranch = branches.find(b => b.code === filterBranch)?.name || filterBranch;
    const toBranch = filterBranch2 !== "all" ? (branches.find(b => b.code === filterBranch2)?.name || filterBranch2) : "";
    const selectedList = rows.filter(r => selectedRows.has(`${r.brand}|${r.model_series}|${r.model_code}|${r.color_name}`));
    const today = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });

    let msg = `🚗 แจ้งจัดรถส่ง\n`;
    msg += `วันที่: ${today}\n`;
    msg += `จาก: ${fromBranch}\n`;
    if (toBranch) msg += `ไป: ${toBranch}\n`;
    msg += `จำนวน: ${selectedList.length} คัน\n`;
    msg += `─────────────\n`;
    selectedList.forEach((r, i) => {
      msg += `${i + 1}. ${r.model_series} ${r.model_code} ${r.color_name} (1 คัน)\n`;
    });
    msg += `─────────────\n`;
    msg += `รวม ${selectedList.length} คัน`;

    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "notify_line_stock", message: msg }),
      });
      alert("ส่ง LINE สำเร็จ!");
      setSelectedRows(new Set());
      setShowOnlySelected(false);
    } catch {
      alert("ส่ง LINE ไม่สำเร็จ");
    }
    setSending(false);
  }

  const brands = [...new Set(rows.map(r => r.brand).filter(Boolean))].sort();
  const seriesOpts = [...new Set(rows.filter(r => filterBrand === "all" || r.brand === filterBrand).map(r => r.model_series).filter(Boolean))].sort();

  const filtered = rows.filter(r => {
    if (showOnlySelected) {
      const key = `${r.brand}|${r.model_series}|${r.model_code}|${r.color_name}`;
      if (!selectedRows.has(key)) return false;
    }
    if (filterBrand !== "all" && r.brand !== filterBrand) return false;
    if (filterSeries !== "all" && r.model_series !== filterSeries) return false;
    if (filterBranch !== "all") {
      const qty = Number(r[`qty_${filterBranch}`] || 0);
      if (filterQty.length > 0 && !filterQty.includes(qty)) return false;
      if (filterQty.length === 0 && qty <= 0) return false;
    }
    if (filterBranch2 !== "all") {
      const qty2 = Number(r[`qty_${filterBranch2}`] || 0);
      if (filterQty2.length > 0 && !filterQty2.includes(qty2)) return false;
      if (filterQty2.length === 0 && qty2 <= 0) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return [r.brand, r.model_series, r.model_code, r.color_name].filter(Boolean).some(v => v.toLowerCase().includes(s));
    }
    return true;
  });

  // แสดงเฉพาะสาขาที่เลือก ถ้าไม่เลือกเลย → แสดงทั้งหมด
  const selectedBranchCodes = [filterBranch, filterBranch2, filterBranch3].filter(v => v !== "all");
  const displayBranches = selectedBranchCodes.length > 0
    ? selectedBranchCodes.map(code => branches.find(b => b.code === code)).filter(Boolean)
    : branches;

  const totalStock = filtered.reduce((sum, r) => sum + displayBranches.reduce((s, b) => s + Number(r[`qty_${b.code}`] || 0), 0), 0);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const th = { padding: "8px 6px", textAlign: "center", whiteSpace: "nowrap", fontSize: 11 };
  const td = { padding: "6px", whiteSpace: "nowrap", fontSize: 12 };

  // qty options for selected branch
  const qtyValues = filterBranch !== "all" ? [0, ...new Set(rows.filter(r => Number(r[`qty_${filterBranch}`] || 0) > 0).map(r => Number(r[`qty_${filterBranch}`])))].sort((a, b) => a - b) : [];
  const qtyValues2 = filterBranch2 !== "all" ? [0, ...new Set(rows.filter(r => Number(r[`qty_${filterBranch2}`] || 0) > 0).map(r => Number(r[`qty_${filterBranch2}`])))].sort((a, b) => a - b) : [];

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">ระบบจัดการ Stock รถ</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }}>
          <option value="all">ทุกยี่ห้อ</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterBranch} onChange={e => { setFilterBranch(e.target.value); setFilterQty([]); setShowQtyDropdown(false); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #1e40af", borderRadius: 8, color: "#1e40af", fontWeight: 600 }}>
          <option value="all">สาขา 1</option>
          {branches.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
        {filterBranch !== "all" && qtyValues.length > 0 && (
          <div ref={qtyRef} style={{ position: "relative" }}>
            <button onClick={() => setShowQtyDropdown(v => !v)}
              style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #1e40af", borderRadius: 8, color: "#1e40af", fontWeight: 600, background: "#fff", cursor: "pointer" }}>
              {filterQty.length === 0 ? "ทุกจำนวน สาขา 1 ▾" : `${filterQty.join(", ")} คัน ▾`}
            </button>
            {showQtyDropdown && (
              <div style={{ position: "absolute", top: "100%", left: 0, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 100, minWidth: 140, padding: 6, marginTop: 4 }}>
                <div onClick={() => { setFilterQty([]); setCurrentPage(1); }}
                  style={{ padding: "4px 8px", fontSize: 12, cursor: "pointer", color: "#6b7280", borderBottom: "1px solid #f3f4f6", marginBottom: 4 }}>
                  ทั้งหมด
                </div>
                {qtyValues.map(q => (
                  <label key={q} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={filterQty.includes(q)}
                      onChange={() => {
                        setFilterQty(prev => prev.includes(q) ? prev.filter(v => v !== q) : [...prev, q].sort((a, b) => a - b));
                        setCurrentPage(1);
                      }} />
                    {q} คัน
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        <select value={filterBranch2} onChange={e => { setFilterBranch2(e.target.value); setFilterQty2([]); setShowQtyDropdown2(false); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #7c3aed", borderRadius: 8, color: "#7c3aed", fontWeight: 600 }}>
          <option value="all">สาขา 2</option>
          {branches.filter(b => b.code !== filterBranch).map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
        {filterBranch2 !== "all" && qtyValues2.length > 0 && (
          <div ref={qtyRef2} style={{ position: "relative" }}>
            <button onClick={() => setShowQtyDropdown2(v => !v)}
              style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #7c3aed", borderRadius: 8, color: "#7c3aed", fontWeight: 600, background: "#fff", cursor: "pointer" }}>
              {filterQty2.length === 0 ? "ทุกจำนวน สาขา 2 ▾" : `${filterQty2.join(", ")} คัน ▾`}
            </button>
            {showQtyDropdown2 && (
              <div style={{ position: "absolute", top: "100%", left: 0, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 100, minWidth: 140, padding: 6, marginTop: 4 }}>
                <div onClick={() => { setFilterQty2([]); setCurrentPage(1); }}
                  style={{ padding: "4px 8px", fontSize: 12, cursor: "pointer", color: "#6b7280", borderBottom: "1px solid #f3f4f6", marginBottom: 4 }}>
                  ทั้งหมด
                </div>
                {qtyValues2.map(q => (
                  <label key={q} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={filterQty2.includes(q)}
                      onChange={() => {
                        setFilterQty2(prev => prev.includes(q) ? prev.filter(v => v !== q) : [...prev, q].sort((a, b) => a - b));
                        setCurrentPage(1);
                      }} />
                    {q} คัน
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        <select value={filterBranch3} onChange={e => { setFilterBranch3(e.target.value); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #059669", borderRadius: 8, color: "#059669", fontWeight: 600 }}>
          <option value="all">สาขา 3</option>
          {branches.filter(b => b.code !== filterBranch && b.code !== filterBranch2).map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
        <button onClick={fetchData} style={{ padding: "8px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Refresh</button>
        {selectedRows.size > 0 && (
          <>
            <button onClick={() => setShowOnlySelected(v => !v)}
              style={{ padding: "8px 16px", fontSize: 13, background: showOnlySelected ? "#f59e0b" : "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
              {showOnlySelected ? `กลับแสดงทั้งหมด` : `จัดส่ง (${selectedRows.size})`}
            </button>
            <button onClick={sendLine} disabled={sending}
              style={{ padding: "8px 16px", fontSize: 13, background: "#06c755", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
              📩 ส่ง LINE + จองรถ
            </button>
            <button onClick={() => { setSelectedRows(new Set()); setShowOnlySelected(false); }}
              style={{ padding: "8px 16px", fontSize: 13, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
              ล้างเลือก
            </button>
          </>
        )}
        <span style={{ fontSize: 13, color: "#374151" }}>{filtered.length} รายการ | รวม <b style={{ color: "#072d6b" }}>{totalStock}</b> คัน{selectedRows.size > 0 && ` | เลือก ${selectedRows.size} รายการ`}</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={{ ...th, width: 30 }}>
                <input type="checkbox" checked={paged.length > 0 && paged.every(r => selectedRows.has(`${r.brand}|${r.model_series}|${r.model_code}|${r.color_name}`))}
                  onChange={e => {
                    const next = new Set(selectedRows);
                    paged.forEach(r => { const k = `${r.brand}|${r.model_series}|${r.model_code}|${r.color_name}`; e.target.checked ? next.add(k) : next.delete(k); });
                    setSelectedRows(next);
                  }} />
              </th>
              <th style={th}>#</th>
              <th style={th}>ยี่ห้อ</th>
              <th style={th}>รุ่น</th>
              <th style={th}>แบบ</th>
              <th style={th}>สี</th>
              {displayBranches.map(b => (
                <React.Fragment key={b.code}>
                  <th style={{ ...th, background: "#1e40af" }}>{b.name}</th>
                  <th style={{ ...th, background: "#f59e0b", color: "#000", fontSize: 10 }}>อายุ</th>
                </React.Fragment>
              ))}
              <th style={{ ...th, background: "#10b981" }}>รวม</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7 + displayBranches.length * 2} style={{ textAlign: "center", padding: 20 }}>กำลังโหลด...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={7 + displayBranches.length * 2} style={{ textAlign: "center", padding: 20 }}>ไม่พบข้อมูล</td></tr>
            ) : paged.map((r, i) => {
              const total = displayBranches.reduce((sum, b) => sum + Number(r[`qty_${b.code}`] || 0), 0);
              const rowKey = `${r.brand}|${r.model_series}|${r.model_code}|${r.color_name}`;
              const isSelected = selectedRows.has(rowKey);
              return (
                <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", background: isSelected ? "#fef3c7" : i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ ...td, textAlign: "center" }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(rowKey)} />
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                  <td style={td}>{r.brand}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.model_series}</td>
                  <td style={td}>{r.model_code}</td>
                  <td style={td}>{r.color_name}</td>
                  {displayBranches.map(b => (
                    <React.Fragment key={b.code}>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700,
                          color: Number(r[`qty_${b.code}`] || 0) > 0 ? "#065f46" : "#9ca3af" }}>
                        {Number(r[`qty_${b.code}`] || 0) || "-"}
                      </td>
                      <td style={{ ...td, textAlign: "center", fontSize: 10, color: Number(r[`age_${b.code}`] || 0) > 90 ? "#ef4444" : "#6b7280" }}>
                        {r[`age_${b.code}`] || "-"}
                      </td>
                    </React.Fragment>
                  ))}
                  <td style={{ ...td, textAlign: "center", fontWeight: 700, background: "#f0fdf4", color: "#065f46" }}>{total || "-"}</td>
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
