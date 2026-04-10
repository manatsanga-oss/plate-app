import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-api";
const MASTER_API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-master-api";

export default function FastMovingPage() {
  const [rows, setRows] = useState([]);
  const [carModels, setCarModels] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterRun, setFilterRun] = useState("all");
  const [filterCode, setFilterCode] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [editPopup, setEditPopup] = useState(null); // { id }
  const [eBrand, setEBrand] = useState("");
  const [eVehicleType, setEVehicleType] = useState("");
  const [eRun, setERun] = useState("");
  const [eCode, setECode] = useState("");
  const [eType, setEType] = useState("");
  const [eEngineCc, setEEngineCc] = useState("");
  const [eCcOp, setECcOp] = useState("="); // = | >= | <=
  const [infoPopup, setInfoPopup] = useState(null); // edit category/name
  const [iCategory, setICategory] = useState("");
  const [iProductGroup, setIProductGroup] = useState("");
  const [iCustomName, setICustomName] = useState("");
  const PAGE_SIZE = 30;

  useEffect(() => { fetchData(); fetchCarModels(); fetchProductGroups(); }, []);

  async function fetchProductGroups() {
    try {
      const res = await fetch(MASTER_API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_product_groups" }) });
      const data = await res.json();
      setProductGroups(Array.isArray(data) ? data : (data?.data || []));
    } catch { setProductGroups([]); }
  }

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
      setCarModels(Array.isArray(data) ? data : []);
    } catch { setCarModels([]); }
  }

  async function addModel(id, sel_brand, sel_run, sel_code, sel_type, sel_vehicle_type, sel_engine_cc) {
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_model", id, sel_brand, sel_run, sel_code, sel_type, sel_vehicle_type, sel_engine_cc }),
      });
      fetchData();
    } catch {}
  }

  async function deleteModel(pm_id) {
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_model", delete_pm_id: pm_id }),
      });
      fetchData();
    } catch {}
  }

  function openEdit(row) {
    setEditPopup({ id: row.id, part_code: row.part_code, product_name: row.product_name, models: row.models || [] });
    setEBrand("");
    setEVehicleType("");
    setERun("");
    setECode("");
    setEType("");
    setECcOp("=");
    setEEngineCc("");
  }

  function buildCcValue() {
    if (!eEngineCc) return "";
    return eCcOp === "=" ? eEngineCc : `${eCcOp}${eEngineCc}`;
  }

  async function confirmAdd() {
    if (!editPopup) return;
    await addModel(editPopup.id, eBrand, eRun, eCode, eType, eVehicleType, buildCcValue());
    // refresh popup state with new list
    const fresh = (await (await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_fast_moving_report" }) })).json());
    const updated = fresh.find(r => r.id === editPopup.id);
    if (updated) setEditPopup({ ...editPopup, models: updated.models || [] });
    setEBrand(""); setEVehicleType(""); setERun(""); setECode(""); setEType(""); setEEngineCc(""); setECcOp("=");
  }

  async function removeModel(pm_id) {
    await deleteModel(pm_id);
    setEditPopup(prev => prev ? { ...prev, models: prev.models.filter(m => m.pm_id !== pm_id) } : prev);
  }

  function openInfoEdit(row) {
    setInfoPopup({ id: row.id, part_code: row.part_code });
    setICategory(row.category || "");
    setIProductGroup(row.product_group || "");
    setICustomName(row.product_name || "");
  }

  async function saveInfo() {
    if (!infoPopup) return;
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_part_info", id: infoPopup.id, category: iCategory, product_group: iProductGroup, custom_name: iCustomName }),
      });
      fetchData();
    } catch {}
    setInfoPopup(null);
  }

  const fmt = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtQty = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const categories = [...new Set(rows.map(r => r.category).filter(Boolean))].sort();

  // cascading filter: ยี่ห้อ → รุ่น → แบบ จาก carModels
  const allBrandNames = [...new Set(carModels.map(m => m.brand).filter(Boolean))].sort();
  const filteredByBrand = filterBrand !== "all" ? carModels.filter(m => m.brand === filterBrand) : carModels;
  const runOpts = [...new Set(filteredByBrand.map(m => m.marketing_name).filter(Boolean))].sort();
  const filteredByRun = filterRun !== "all" ? filteredByBrand.filter(m => m.marketing_name === filterRun) : filteredByBrand;
  const codeOpts = [...new Set(filteredByRun.map(m => m.model_code).filter(Boolean))].sort();

  // engine_cc + vehicle_type ของรุ่นที่ผู้ใช้เลือก filter
  const selectedRunModel = filterRun !== "all" ? carModels.find(m => (filterBrand === "all" || m.brand === filterBrand) && m.marketing_name === filterRun) : null;
  const selectedRunCc = selectedRunModel && selectedRunModel.engine_cc ? Number(selectedRunModel.engine_cc) : null;
  const selectedRunVehicleType = selectedRunModel ? (selectedRunModel.vehicle_type_name || "") : "";

  function ccRangeMatches(selEngineCc, targetCc) {
    if (!selEngineCc || targetCc === null) return false;
    const m = String(selEngineCc).match(/^(>=|<=|=)?\s*(.*)$/);
    if (!m) return false;
    const op = m[1] || "=";
    const val = Number(m[2]);
    if (isNaN(val)) return false;
    if (op === ">=") return targetCc >= val;
    if (op === "<=") return targetCc <= val;
    return targetCc === val;
  }

  function modelMatches(m) {
    if (filterBrand !== "all") {
      if (!m.sel_brand || m.sel_brand !== filterBrand) return false;
    }
    if (filterCode !== "all") {
      return m.sel_code === filterCode;
    }
    if (filterRun !== "all") {
      if (m.sel_run === filterRun) return true;
      if (m.sel_vehicle_type && m.sel_vehicle_type !== selectedRunVehicleType) return false;
      if (m.sel_engine_cc) {
        if (selectedRunCc === null || !ccRangeMatches(m.sel_engine_cc, selectedRunCc)) return false;
      }
      if (!m.sel_run && !m.sel_code && !m.sel_engine_cc && !m.sel_vehicle_type && !m.sel_brand) return false;
      return true;
    }
    return true;
  }

  function rowMatchesScope(r) {
    if (filterBrand === "all" && filterRun === "all" && filterCode === "all") return true;
    const models = Array.isArray(r.models) ? r.models : [];
    if (models.length === 0) return false;
    return models.some(modelMatches);
  }

  const filtered = rows.filter(r => {
    if (filterCategory !== "all" && r.category !== filterCategory) return false;
    if (!rowMatchesScope(r)) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (r.part_code || "").toLowerCase().includes(s) ||
        (r.ref_code || "").toLowerCase().includes(s) ||
        (r.product_name || "").toLowerCase().includes(s) ||
        (r.category || "").toLowerCase().includes(s) ||
        (r.sel_brand || "").toLowerCase().includes(s) ||
        (r.sel_run || "").toLowerCase().includes(s) ||
        (r.sel_code || "").toLowerCase().includes(s);
    }
    return true;
  });

  const totalValue = filtered.reduce((sum, r) => sum + Number(r.total_value || 0), 0);
  const inStockCount = filtered.filter(r => Number(r.quantity || 0) > 0).length;
  const outStockCount = filtered.filter(r => Number(r.quantity || 0) <= 0).length;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12 };
  const td = { padding: "8px", whiteSpace: "nowrap", fontSize: 12 };

  // popup data — ยี่ห้อ + ประเภทรถ + CC อิสระ, รุ่น/แบบ/type cascade
  const eAllBrands = [...new Set(carModels.map(m => m.brand).filter(Boolean))].sort();
  const eAllVehicleTypes = [...new Set(carModels.map(m => m.vehicle_type_name).filter(Boolean))].sort();
  // CC distinct จาก carModels ทั้งหมด (จัดกลุ่มจากตารางรุ่น)
  const eAllEngineCc = [...new Set(carModels.map(m => m.engine_cc).filter(v => v !== null && v !== undefined && v !== ""))]
    .sort((a, b) => Number(a) - Number(b));
  let eFiltered = carModels;
  if (eBrand) eFiltered = eFiltered.filter(m => m.brand === eBrand);
  if (eVehicleType) eFiltered = eFiltered.filter(m => m.vehicle_type_name === eVehicleType);
  if (eEngineCc) eFiltered = eFiltered.filter(m => String(m.engine_cc) === String(eEngineCc));
  const eRunOpts = [...new Set(eFiltered.map(m => m.marketing_name).filter(Boolean))].sort();
  const eByRun = eRun ? eFiltered.filter(m => m.marketing_name === eRun) : eFiltered;
  const eCodeOpts = [...new Set(eByRun.map(m => m.model_code).filter(Boolean))].sort();
  const eByCode = eCode ? eByRun.filter(m => m.model_code === eCode) : eByRun;
  const eTypeOpts = [...new Set(eByCode.map(m => m.type_name).filter(Boolean))].sort();

  const selectStyle = { width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, boxSizing: "border-box" };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">รายงานอะไหล่หมุนเร็ว</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="ค้นหา รหัส / ชื่อสินค้า / รุ่น" style={{ padding: "8px 14px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, width: 260 }} />
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
              <th style={th}>หมวดหมู่</th>
              <th style={th}>กลุ่มสินค้า</th>
              <th style={th}>รหัสอะไหล่</th>
              <th style={th}>ชื่อสินค้า</th>
              <th style={th}>รุ่นที่ใช้</th>
              <th style={{ ...th, textAlign: "right" }}>คงเหลือ</th>
              <th style={{ ...th, textAlign: "right" }}>ราคา</th>
              <th style={{ ...th, textAlign: "right" }}>มูลค่า</th>
              <th style={th}>หน่วย</th>
              <th style={th}>ร้าน (จำนวน + ที่เก็บ)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} style={{ textAlign: "center", padding: 20 }}>กำลังโหลด...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: "center", padding: 20 }}>ไม่พบข้อมูล</td></tr>
            ) : paged.map((r, i) => {
              const qty = Number(r.quantity || 0);
              return (
                <tr key={r.id || i} style={{ borderBottom: "1px solid #e5e7eb", background: qty <= 0 ? "#fef2f2" : i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ ...td, textAlign: "center" }}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                  <td onClick={() => openInfoEdit(r)} style={{ ...td, cursor: "pointer", color: "#1e40af" }}>{r.category || "-"}</td>
                  <td onClick={() => openInfoEdit(r)} style={{ ...td, cursor: "pointer", color: "#1e40af" }}>{r.product_group || "-"}</td>
                  <td style={td}>{r.part_code}</td>
                  <td onClick={() => openInfoEdit(r)} style={{ ...td, whiteSpace: "normal", maxWidth: 220, cursor: "pointer", color: "#1e40af" }}>{r.product_name || <span style={{ color: "#9ca3af" }}>ไม่พบในสต๊อก</span>}</td>
                  <td onClick={() => openEdit(r)} style={{ ...td, whiteSpace: "normal", maxWidth: 220, cursor: "pointer" }}>
                    {Array.isArray(r.models) && r.models.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {r.models.map((m, idx) => (
                          <span key={m.pm_id || idx} style={{ background: "#dbeafe", color: "#1e40af", padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>
                            {[m.sel_brand, m.sel_vehicle_type, m.sel_engine_cc && `CC${m.sel_engine_cc}`, m.sel_run, m.sel_code, m.sel_type].filter(Boolean).join("/")}
                          </span>
                        ))}
                      </div>
                    ) : <span style={{ color: "#9ca3af" }}>ทั่วไป +</span>}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: qty <= 0 ? "#ef4444" : "#065f46" }}>{fmtQty(qty)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.unit_price)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.total_value)}</td>
                  <td style={td}>{r.unit}</td>
                  <td style={{ ...td, whiteSpace: "normal", maxWidth: 260, fontSize: 11 }}>{r.stores || r.location}</td>
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

      {/* ===== Popup แก้ไข หมวดหมู่/ชื่อสินค้า ===== */}
      {infoPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#072d6b" }}>แก้ไข หมวดหมู่ / ชื่อสินค้า</h3>
              <button onClick={() => setInfoPopup(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>
            <div style={{ marginBottom: 10, padding: "8px 12px", background: "#eff6ff", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#072d6b" }}>{infoPopup.part_code}</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>หมวดหมู่</label>
              <input value={iCategory} onChange={e => setICategory(e.target.value)} list="cat-list" style={selectStyle} />
              <datalist id="cat-list">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </datalist>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>กลุ่มสินค้า</label>
              <select value={iProductGroup} onChange={e => setIProductGroup(e.target.value)} style={selectStyle}>
                <option value="">-- เลือกกลุ่มสินค้า --</option>
                {productGroups.filter(g => g.status !== "inactive").map(g => (
                  <option key={g.group_code || g.id} value={`${g.group_code} ${g.group_name}`}>
                    {g.group_code} {g.group_name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>ชื่อสินค้า</label>
              <input value={iCustomName} onChange={e => setICustomName(e.target.value)} style={selectStyle} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveInfo} style={{ flex: 1, padding: "9px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>บันทึก</button>
              <button onClick={() => setInfoPopup(null)} style={{ padding: "9px 16px", fontSize: 13, background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Popup เลือก ยี่ห้อ/รุ่น/แบบ/type ===== */}
      {editPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#072d6b" }}>เลือกยี่ห้อ / รุ่น / แบบ / type</h3>
              <button onClick={() => setEditPopup(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>
            <div style={{ marginBottom: 12, padding: "8px 12px", background: "#eff6ff", borderRadius: 8, fontSize: 13, borderLeft: "3px solid #1e40af" }}>
              <div style={{ fontWeight: 700, color: "#072d6b" }}>{editPopup.part_code}</div>
              <div style={{ color: "#374151", marginTop: 2 }}>{editPopup.product_name || "-"}</div>
            </div>

            {Array.isArray(editPopup.models) && editPopup.models.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>รายการที่กำหนดไว้:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {editPopup.models.map(m => (
                    <span key={m.pm_id} style={{ background: "#dbeafe", color: "#1e40af", padding: "3px 8px", borderRadius: 12, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      {[m.sel_brand, m.sel_vehicle_type, m.sel_engine_cc && `CC${m.sel_engine_cc}`, m.sel_run, m.sel_code, m.sel_type].filter(Boolean).join("/")}
                      <button onClick={() => removeModel(m.pm_id)} style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>ยี่ห้อ</label>
              <select value={eBrand} onChange={e => { setEBrand(e.target.value); setERun(""); setECode(""); setEType(""); }} style={selectStyle}>
                <option value="">-- ทุกยี่ห้อ --</option>
                {eAllBrands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>ประเภทรถ</label>
              <select value={eVehicleType} onChange={e => { setEVehicleType(e.target.value); setERun(""); setECode(""); setEType(""); }} style={selectStyle}>
                <option value="">-- ทุกประเภท --</option>
                {eAllVehicleTypes.map(vt => <option key={vt} value={vt}>{vt}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>CC</label>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={eCcOp} onChange={e => setECcOp(e.target.value)} style={{ ...selectStyle, width: 90 }}>
                  <option value="=">=</option>
                  <option value=">=">&ge;</option>
                  <option value="<=">&le;</option>
                </select>
                <select value={eEngineCc} onChange={e => { setEEngineCc(e.target.value); setERun(""); setECode(""); setEType(""); }} style={selectStyle}>
                  <option value="">-- ทุก CC --</option>
                  {eAllEngineCc.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>รุ่น</label>
              <select value={eRun} onChange={e => { setERun(e.target.value); setECode(""); setEType(""); }} style={selectStyle}>
                <option value="">-- ทุกรุ่น --</option>
                {eRunOpts.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>

            {eRun && (
              <>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>แบบ</label>
                <select value={eCode} onChange={e => { setECode(e.target.value); setEType(""); }} style={selectStyle}>
                  <option value="">-- ทุกแบบ --</option>
                  {eCodeOpts.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>type</label>
                <input value={eType} onChange={e => setEType(e.target.value)} list="type-list" placeholder="-- ทุก type --" style={selectStyle} />
                <datalist id="type-list">
                  {eTypeOpts.map(t => <option key={t} value={t}>{t}</option>)}
                </datalist>
              </div>
              </>
            )}

            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, padding: "6px 10px", background: "#f9fafb", borderRadius: 6 }}>
              จะบันทึก: <b style={{ color: "#072d6b" }}>{[eBrand, eVehicleType, buildCcValue() && `CC${buildCcValue()}`, eRun, eCode, eType].filter(Boolean).join(" / ") || "ทั้งหมด"}</b>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmAdd} style={{ flex: 1, padding: "9px", fontSize: 13, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>+ เพิ่ม</button>
              <button onClick={() => setEditPopup(null)} style={{ padding: "9px 16px", fontSize: 13, background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
