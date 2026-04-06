import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-api";

export default function FastMovingPage() {
  const [rows, setRows] = useState([]);
  const [carModels, setCarModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterRun, setFilterRun] = useState("all");
  const [filterCode, setFilterCode] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [modelPopup, setModelPopup] = useState(null); // { id, field, brand }
  const [selectedVehicleType, setSelectedVehicleType] = useState("");
  const [selectedRun, setSelectedRun] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const PAGE_SIZE = 30;

  useEffect(() => { fetchData(); fetchCarModels(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_fast_moving_report" }) });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }

  async function fetchCarModels() {
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_car_models" }) });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      console.log("CarModels brands:", [...new Set(list.map(m => m.brand))]);
      setCarModels(list);
    } catch { setCarModels([]); }
  }

  async function saveModel(id, field, value) {
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_model", id, field, value }),
      });
      setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    } catch {}
  }

  function openModelPopup(id, field) {
    // match brand ที่มีคำว่า ออนด้า/ฮอนด้า/honda หรือ ยามาฮ่า/yamaha
    const allBrands = [...new Set(carModels.map(m => m.brand).filter(Boolean))];
    const brand = field === "honda_model"
      ? allBrands.find(b => /ออนด|ฮอนด|honda/i.test(b)) || ""
      : allBrands.find(b => /ยามาฮ|yamaha/i.test(b)) || "";
    setModelPopup({ id, field, brand });
    setSelectedVehicleType("");
    setSelectedRun("");
    setSelectedCode("");
  }

  function confirmSelect() {
    if (!modelPopup) return;
    // ไม่เลือกรุ่น ไม่เลือกแบบ = ทุกรุ่น
    // เลือกรุ่น ไม่เลือกแบบ = ทุกแบบในรุ่นนั้น
    // เลือกรุ่น + เลือกแบบ = เฉพาะแบบนั้น
    const value = selectedCode || selectedRun || "ทุกรุ่น";
    saveModel(modelPopup.id, modelPopup.field, value);
    setModelPopup(null);
  }

  const fmt = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtQty = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const brands = [...new Set(rows.map(r => r.brand).filter(Boolean))].sort();
  const categories = [...new Set(rows.map(r => r.category).filter(Boolean))].sort();

  // cascading: ยี่ห้อ → รุ่น → แบบ จาก carModels
  const allBrandNames = [...new Set(carModels.map(m => m.brand).filter(Boolean))].sort();
  const filteredByBrand = filterBrand !== "all" ? carModels.filter(m => m.brand === filterBrand) : carModels;
  const runOpts = [...new Set(filteredByBrand.map(m => m.marketing_name).filter(Boolean))].sort();
  const filteredByRun = filterRun !== "all" ? filteredByBrand.filter(m => m.marketing_name === filterRun) : filteredByBrand;
  const codeOpts = [...new Set(filteredByRun.map(m => m.model_code).filter(Boolean))].sort();

  const filtered = rows.filter(r => {
    if (filterCategory !== "all" && r.category !== filterCategory) return false;
    if (filterCode !== "all") {
      return (r.honda_model || "") === filterCode || (r.yamaha_model || "") === filterCode;
    }
    if (filterRun !== "all") {
      const codesInRun = filteredByRun.map(m => m.model_code);
      return (r.honda_model || "") === filterRun || (r.yamaha_model || "") === filterRun ||
        codesInRun.includes(r.honda_model) || codesInRun.includes(r.yamaha_model);
    }
    if (filterBrand !== "all") {
      const brandField = /ออนด|ฮอนด|honda/i.test(filterBrand) ? "honda_model" : "yamaha_model";
      return !!(r[brandField]);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      return (r.part_code || "").toLowerCase().includes(s) ||
        (r.ref_code || "").toLowerCase().includes(s) ||
        (r.product_name || "").toLowerCase().includes(s) ||
        (r.category || "").toLowerCase().includes(s) ||
        (r.honda_model || "").toLowerCase().includes(s) ||
        (r.yamaha_model || "").toLowerCase().includes(s);
    }
    return true;
  });

  const totalValue = filtered.reduce((sum, r) => sum + Number(r.total_value || 0), 0);
  const inStockCount = filtered.filter(r => Number(r.quantity || 0) > 0).length;
  const outStockCount = filtered.filter(r => Number(r.quantity || 0) <= 0).length;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12 };
  const td = { padding: "8px", whiteSpace: "nowrap" };

  // popup data
  const popupModels = modelPopup ? carModels.filter(m => m.brand === modelPopup.brand) : [];
  const popupVehicleTypes = [...new Set(popupModels.map(m => m.vehicle_type_name).filter(Boolean))].sort();
  const popupByType = selectedVehicleType ? popupModels.filter(m => m.vehicle_type_name === selectedVehicleType) : popupModels;
  const popupRuns = [...new Set(popupByType.map(m => m.marketing_name).filter(Boolean))].sort();
  const popupCodes = selectedRun
    ? [...new Set(popupByType.filter(m => m.marketing_name === selectedRun).map(m => m.model_code).filter(Boolean))].sort()
    : [];

  function renderModelCell(r, field, bgColor) {
    const val = r[field] || "";
    return (
      <span onClick={() => openModelPopup(r.id, field)}
        style={{ cursor: "pointer", display: "inline-block", minWidth: 70, minHeight: 20, padding: "2px 6px", borderRadius: 4, fontSize: 11,
          background: val ? bgColor : "#f3f4f6", color: val ? "#1e3a5f" : "#9ca3af",
          border: "1px dashed #d1d5db" }}>
        {val || "+"}
      </span>
    );
  }

  const selectStyle = { width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, boxSizing: "border-box" };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">รายงานอะไหล่หมุนเร็ว</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="ค้นหา รหัส / ชื่อสินค้า / รุ่น" style={{ padding: "8px 14px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, width: 280 }} />
        <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }}>
          <option value="all">ทุกหมวดหมู่</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setFilterRun("all"); setFilterCode("all"); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #072d6b", borderRadius: 8, fontWeight: 600 }}>
          <option value="all">ทุกยี่ห้อ</option>
          {allBrandNames.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterRun} onChange={e => { setFilterRun(e.target.value); setFilterCode("all"); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #3b82f6", borderRadius: 8 }}>
          <option value="all">ทุกรุ่น</option>
          {runOpts.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterCode} onChange={e => { setFilterCode(e.target.value); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #10b981", borderRadius: 8 }}>
          <option value="all">ทุกแบบ</option>
          {codeOpts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={fetchData} style={{ padding: "8px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Refresh</button>
        <span style={{ fontSize: 13, color: "#374151" }}>
          {filtered.length} รายการ | มีสต๊อก: <b style={{ color: "#10b981" }}>{inStockCount}</b> | ไม่มีสต๊อก: <b style={{ color: "#ef4444" }}>{outStockCount}</b> | มูลค่ารวม: <b style={{ color: "#072d6b" }}>{fmt(totalValue)}</b>
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={th}>#</th>
              <th style={{ ...th, background: "#1e40af" }}>HONDA</th>
              <th style={{ ...th, background: "#92400e" }}>YAMAHA</th>
              <th style={th}>รหัสอะไหล่</th>
              <th style={th}>ชื่อสินค้า</th>
              <th style={th}>หมวดหมู่</th>
              <th style={{ ...th, textAlign: "right" }}>คงเหลือ</th>
              <th style={{ ...th, textAlign: "right" }}>ราคา</th>
              <th style={{ ...th, textAlign: "right" }}>มูลค่า</th>
              <th style={th}>หน่วย</th>
              <th style={th}>ที่เก็บ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ textAlign: "center", padding: 20 }}>กำลังโหลด...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: "center", padding: 20 }}>ไม่พบข้อมูล</td></tr>
            ) : paged.map((r, i) => {
              const qty = Number(r.quantity || 0);
              return (
                <tr key={r.id || i} style={{ borderBottom: "1px solid #e5e7eb", background: qty <= 0 ? "#fef2f2" : i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ ...td, textAlign: "center" }}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                  <td style={td}>{renderModelCell(r, "honda_model", "#dbeafe")}</td>
                  <td style={td}>{renderModelCell(r, "yamaha_model", "#fef3c7")}</td>
                  <td style={td}>{r.part_code}</td>
                  <td style={{ ...td, whiteSpace: "normal", maxWidth: 250 }}>{r.product_name || <span style={{ color: "#9ca3af" }}>ไม่พบในสต๊อก</span>}</td>
                  <td style={td}>{r.category}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: qty <= 0 ? "#ef4444" : "#065f46" }}>{fmtQty(qty)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.unit_price)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.total_value)}</td>
                  <td style={td}>{r.unit}</td>
                  <td style={td}>{r.location}</td>
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

      {/* ===== Popup เลือกรุ่น/แบบ ===== */}
      {modelPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#072d6b" }}>
                เลือกรุ่น/แบบ {modelPopup.field === "honda_model" ? "HONDA" : "YAMAHA"}
              </h3>
              <button onClick={() => setModelPopup(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>ประเภทรถ</label>
              <select value={selectedVehicleType} onChange={e => { setSelectedVehicleType(e.target.value); setSelectedRun(""); setSelectedCode(""); }} style={selectStyle}>
                <option value="">-- ทุกประเภท --</option>
                {popupVehicleTypes.map(vt => <option key={vt} value={vt}>{vt}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>รุ่น (เลือกรุ่น = ใช้ได้ทุกแบบ)</label>
              <select value={selectedRun} onChange={e => { setSelectedRun(e.target.value); setSelectedCode(""); }} style={selectStyle}>
                <option value="">-- เลือกรุ่น --</option>
                {popupRuns.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>

            {selectedRun && popupCodes.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>แบบ (เลือกแบบ = เฉพาะแบบนี้)</label>
                <select value={selectedCode} onChange={e => setSelectedCode(e.target.value)} style={selectStyle}>
                  <option value="">-- ทุกแบบ (ใช้ชื่อรุ่น) --</option>
                  {popupCodes.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              </div>
            )}

            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12, minHeight: 20 }}>
              <span>จะบันทึก: <b style={{ color: "#072d6b" }}>{selectedCode || selectedRun || "ทุกรุ่น"}</b></span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmSelect}
                style={{ flex: 1, padding: "9px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
                ยืนยัน
              </button>
              <button onClick={() => { if (modelPopup) saveModel(modelPopup.id, modelPopup.field, ""); setModelPopup(null); }}
                style={{ padding: "9px 16px", fontSize: 13, background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 8, cursor: "pointer" }}>
                ลบค่า
              </button>
              <button onClick={() => setModelPopup(null)}
                style={{ padding: "9px 16px", fontSize: 13, background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
