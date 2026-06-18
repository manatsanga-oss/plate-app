import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-api";
const MASTER_API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-master-api";

export default function FastMovingPage() {
  const [rows, setRows] = useState([]);
  const [carModels, setCarModels] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterProductGroup, setFilterProductGroup] = useState("all");
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
  const [iStockType, setIStockType] = useState("สต๊อก");
  const [iStockNakhonluang, setIStockNakhonluang] = useState(false);
  const [iDiscontinued, setIDiscontinued] = useState(false);
  const [filterDiscontinued, setFilterDiscontinued] = useState("active"); // active | discontinued | all
  // ===== Add Part Popup =====
  const [addPopup, setAddPopup] = useState(false);
  const [aBrand, setABrand] = useState("HONDA");
  const [aPartCode, setAPartCode] = useState("");
  const [aRefCode, setARefCode] = useState("");
  const [aCategory, setACategory] = useState("");
  const [aProductGroup, setAProductGroup] = useState("");
  const [aCustomName, setACustomName] = useState("");
  const [aStockType, setAStockType] = useState("สต๊อก");
  const [aStockNakhonluang, setAStockNakhonluang] = useState(false);
  const [aDiscontinued, setADiscontinued] = useState(false);
  const [aSaving, setASaving] = useState(false);
  const [aError, setAError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState({}); // { [part_id]: true }
  const PAGE_SIZE = 30;

  async function syncYamahaModels() {
    if (!window.confirm("เติมรุ่น/แบบ/type ของ Yamaha + Honda จากประวัติเบิกจริง (เฉพาะกลุ่ม PG-001–022, 027, 028, 031)?\nรายการที่เติมอัตโนมัติเดิมจะถูกแทนที่ (ของที่กรอกมือไม่กระทบ)")) return;
    setSyncing(true);
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync_models" }) });
      const data = await res.json().catch(() => []);
      const n = Array.isArray(data) ? (data[0]?.count ?? data.length) : (data?.count || 0);
      alert("✅ เติมรุ่น Yamaha + Honda สำเร็จ " + n + " รายการ");
      await fetchData();
    } catch (e) { alert("❌ ไม่สำเร็จ: " + e.message); }
    setSyncing(false);
  }

  function openAddPopup() {
    setAddPopup(true);
    setABrand("HONDA"); setAPartCode(""); setARefCode("");
    setACategory(""); setAProductGroup(""); setACustomName("");
    setAStockType("สต๊อก"); setAStockNakhonluang(false); setADiscontinued(false);
    setAError("");
  }

  async function saveNewPart() {
    if (!aPartCode.trim()) { setAError("กรุณากรอกรหัสอะไหล่"); return; }
    setASaving(true);
    setAError("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_part",
          brand: aBrand,
          part_code: aPartCode.trim(),
          ref_code: (aRefCode || aPartCode).trim(),
          category: aCategory.trim(),
          product_group: aProductGroup,
          custom_name: aCustomName.trim(),
          stock_type: aStockType,
          is_stock_nakhonluang: aStockNakhonluang,
          is_discontinued: aDiscontinued,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.error || (Array.isArray(data) && data[0]?.error)) {
        setAError(data?.error || data[0]?.error || "บันทึกไม่สำเร็จ");
        setASaving(false);
        return;
      }
      setAddPopup(false);
      fetchData();
    } catch (e) {
      setAError("เกิดข้อผิดพลาด: " + e.message);
    }
    setASaving(false);
  }

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
    if (!id) { alert("⚠️ ไม่มี part_id"); return false; }
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_model", id, sel_brand, sel_run, sel_code, sel_type, sel_vehicle_type, sel_engine_cc }),
      });
      const txt = await res.text();
      console.log("addModel response:", res.status, txt);
      if (!res.ok || !txt) { alert("❌ บันทึกล้มเหลว: status=" + res.status + " body=" + (txt || "EMPTY")); return false; }
      let data; try { data = JSON.parse(txt); } catch { data = null; }
      if (Array.isArray(data) && data.length === 0) { alert("⚠️ ไม่มีการบันทึก (response = [])\nอาจ id ผิด หรือ duplicate"); return false; }
      fetchData();
      return true;
    } catch (e) { alert("❌ Error: " + e.message); return false; }
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
    const ok = await addModel(editPopup.id, eBrand, eRun, eCode, eType, eVehicleType, buildCcValue());
    if (!ok) return;
    // refresh main list (so chip shows in table)
    fetchData();
    // clear form + close popup
    setEBrand(""); setEVehicleType(""); setERun(""); setECode(""); setEType(""); setEEngineCc(""); setECcOp("=");
    setEditPopup(null);
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
    setIStockType(row.stock_type || "สต๊อก");
    setIStockNakhonluang(!!row.is_stock_nakhonluang);
    setIDiscontinued(!!row.is_discontinued);
  }

  async function saveInfo() {
    if (!infoPopup) return;
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_part_info", id: infoPopup.id, category: iCategory, product_group: iProductGroup, custom_name: iCustomName, stock_type: iStockType, is_stock_nakhonluang: iStockNakhonluang, is_discontinued: iDiscontinued }),
      });
      const data = await res.json().catch(() => null);
      // Debug: log response to console
      console.log("update_part_info response:", data);
      if (!data || (Array.isArray(data) && data.length === 0)) {
        alert("⚠️ ไม่ได้รับ response กลับ — workflow อาจไม่ทำงาน หรือ id ไม่พบ");
      }
      await fetchData();
    } catch (e) {
      alert("❌ บันทึกไม่สำเร็จ: " + e.message);
    }
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

  // รุ่น match: ตรงจากชื่อ หรือจาก vehicle_type + cc range
  function runMatches(m) {
    if (m.sel_run === filterRun) return true;
    if (m.sel_vehicle_type && selectedRunVehicleType && m.sel_vehicle_type !== selectedRunVehicleType) return false;
    if (m.sel_engine_cc) {
      if (selectedRunCc === null || !ccRangeMatches(m.sel_engine_cc, selectedRunCc)) return false;
      // ต้องมี vehicle_type ตรงด้วย หรือไม่มีเลย (โผล่เฉพาะ cc)
      return true;
    }
    // ไม่ได้กำหนดอะไรเลยใน model นี้
    return false;
  }

  function rowMatchesScope(r) {
    if (filterBrand === "all" && filterRun === "all" && filterCode === "all") return true;
    const models = Array.isArray(r.models) ? r.models : [];
    if (models.length === 0) return false;

    // ตรวจแต่ละ criterion แยก — ต้องมีอย่างน้อย 1 tag ที่ match ในแต่ละ criterion
    if (filterBrand !== "all") {
      if (!models.some(m => m.sel_brand === filterBrand)) return false;
    }
    if (filterCode !== "all") {
      if (!models.some(m => m.sel_code === filterCode)) return false;
    }
    if (filterRun !== "all") {
      if (!models.some(runMatches)) return false;
    }
    return true;
  }

  const filtered = rows.filter(r => {
    if (filterProductGroup !== "all" && r.product_group !== filterProductGroup) return false;
    if (filterDiscontinued === "active" && r.is_discontinued) return false;
    if (filterDiscontinued === "discontinued" && !r.is_discontinued) return false;
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

  const inStockCount = filtered.filter(r => Number(r.quantity || 0) > 0).length;
  const outStockCount = filtered.filter(r => Number(r.quantity || 0) <= 0).length;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ===== เลือกแถว + พิมพ์ใบปิดหน้ากล่อง =====
  const filteredIds = filtered.map(r => r.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selected[id]);
  const selectedRows = rows.filter(r => selected[r.id]);
  function toggleAll() {
    if (allSelected) setSelected({});
    else { const m = {}; filteredIds.forEach(id => { m[id] = true; }); setSelected(m); }
  }
  function toggleOne(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function runsOf(r) { return [...new Set((r.models || []).map(m => m.sel_run || m.sel_vehicle_type || m.sel_brand).filter(Boolean))]; }

  function printLabels() {
    if (selectedRows.length === 0) { alert("เลือกอะไหล่ก่อน (ติ๊ก checkbox)"); return; }
    const esc = s => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const labels = selectedRows.map(r => {
      const runs = runsOf(r);
      return `<div class="label">
        <div class="code">${esc(r.part_code)}</div>
        <div class="name">${esc(r.product_name) || "-"}</div>
        <div class="runs"><b>รุ่นที่ใช้:</b> ${runs.length ? esc(runs.join(", ")) : "ทั่วไป"}</div>
        <div class="bc">${code39SVG(r.part_code)}</div>
        <div class="bctext">${esc(r.part_code)}</div>
      </div>`;
    }).join("");
    const w = window.open("", "_blank", "width=950,height=720");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบปิดหน้ากล่องอะไหล่</title>
<style>
  body{font-family:'Tahoma',sans-serif;margin:0;padding:8px;}
  .grid{display:flex;flex-wrap:wrap;gap:8px;}
  .label{border:1px solid #000;border-radius:6px;padding:10px 12px;width:340px;box-sizing:border-box;page-break-inside:avoid;}
  .code{font-size:20px;font-weight:800;letter-spacing:.5px;}
  .name{font-size:13px;margin:3px 0;}
  .runs{font-size:11px;color:#333;margin-bottom:6px;line-height:1.35;}
  .bc{width:100%;}
  .bc svg{width:100%;height:46px;display:block;}
  .bctext{font-family:monospace;font-size:12px;text-align:center;letter-spacing:2px;margin-top:2px;}
  @media print{ body{padding:0;} }
</style></head><body><div class="grid">${labels}</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
    w.document.close();
  }

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
        <select value={filterProductGroup} onChange={e => { setFilterProductGroup(e.target.value); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }}>
          <option value="all">ทุกกลุ่มสินค้า</option>
          {[...new Set(rows.map(r => r.product_group).filter(Boolean))].sort().map(g => <option key={g} value={g}>{g}</option>)}
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
        <select value={filterDiscontinued} onChange={e => { setFilterDiscontinued(e.target.value); setCurrentPage(1); }}
          style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #ef4444", borderRadius: 8 }}>
          <option value="active">🟢 ยังผลิต</option>
          <option value="discontinued">🚫 เลิกผลิต</option>
          <option value="all">ทั้งหมด</option>
        </select>
        <button onClick={fetchData} style={{ padding: "8px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Refresh</button>
        <button onClick={openAddPopup} style={{ padding: "8px 16px", fontSize: 13, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>+ เพิ่มอะไหล่</button>
        <button onClick={syncYamahaModels} disabled={syncing} title="เติมรุ่น/แบบ/type ของ Yamaha + Honda จากประวัติเบิก (เฉพาะกลุ่ม PG-001 ถึง PG-022, PG-027, PG-028, PG-031)"
          style={{ padding: "8px 16px", fontSize: 13, background: syncing ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 8, cursor: syncing ? "not-allowed" : "pointer", fontWeight: 700 }}>
          {syncing ? "กำลังเติม..." : "🔄 เติมรุ่น Yamaha+Honda"}
        </button>
        <button onClick={printLabels} disabled={selectedRows.length === 0} title="พิมพ์ใบปิดหน้ากล่องของรายการที่เลือก (รหัส + ชื่อ + รุ่นที่ใช้ + บาร์โค้ด)"
          style={{ padding: "8px 16px", fontSize: 13, background: selectedRows.length === 0 ? "#9ca3af" : "#0369a1", color: "#fff", border: "none", borderRadius: 8, cursor: selectedRows.length === 0 ? "not-allowed" : "pointer", fontWeight: 700 }}>
          🖨️ พิมพ์ใบปิดกล่อง ({selectedRows.length})
        </button>
        <button onClick={() => { setSearch(""); setFilterProductGroup("all"); setFilterBrand("all"); setFilterRun("all"); setFilterCode("all"); setCurrentPage(1); }}
          style={{ padding: "8px 16px", fontSize: 13, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>✕ ล้างกรอง</button>
        <span style={{ fontSize: 13, color: "#374151" }}>
          {filtered.length} รายการ | มีสต๊อก: <b style={{ color: "#10b981" }}>{inStockCount}</b> | ไม่มีสต๊อก: <b style={{ color: "#ef4444" }}>{outStockCount}</b>
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={{ ...th, textAlign: "center" }}><input type="checkbox" checked={allSelected} onChange={toggleAll} title="เลือกทั้งหมด (ตามที่กรอง)" /></th>
              <th style={th}>#</th>
              <th style={th}>กลุ่มสินค้า</th>
              <th style={th}>รหัสอะไหล่</th>
              <th style={th}>ชื่อสินค้า</th>
              <th style={th}>รุ่นที่ใช้</th>
              <th style={{ ...th, textAlign: "right" }}>คงเหลือ</th>
              <th style={{ ...th, textAlign: "right" }}>ราคา</th>
              <th style={th}>หน่วย</th>
              <th style={th}>ร้าน (จำนวน + ที่เก็บ)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} style={{ textAlign: "center", padding: 20 }}>กำลังโหลด...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={13} style={{ textAlign: "center", padding: 20 }}>ไม่พบข้อมูล</td></tr>
            ) : paged.map((r, i) => {
              const qty = Number(r.quantity || 0);
              return (
                <tr key={r.id || i} style={{ borderBottom: "1px solid #e5e7eb", background: selected[r.id] ? "#fef9c3" : qty <= 0 ? "#fef2f2" : i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={!!selected[r.id]} onChange={() => toggleOne(r.id)} /></td>
                  <td style={{ ...td, textAlign: "center" }}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                  <td onClick={() => openInfoEdit(r)} style={{ ...td, cursor: "pointer", color: "#1e40af" }}>{r.product_group || "-"}</td>
                  <td style={td}>{r.part_code}</td>
                  <td onClick={() => openInfoEdit(r)} style={{ ...td, whiteSpace: "normal", maxWidth: 220, cursor: "pointer", color: "#1e40af" }}>
                    {r.product_name || <span style={{ color: "#9ca3af" }}>ไม่พบในสต๊อก</span>}
                    {r.is_discontinued && (
                      <span style={{ marginLeft: 6, color: "#dc2626", fontWeight: 700 }}>
                        (ยกเลิกผลิต)
                      </span>
                    )}
                  </td>
                  <td onClick={() => openEdit(r)} style={{ ...td, whiteSpace: "normal", maxWidth: 220, cursor: "pointer" }} title="คลิกเพื่อดู/แก้ไขรายละเอียด แบบ/type">
                    {Array.isArray(r.models) && r.models.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {[...new Set(r.models.map(m => m.sel_run || m.sel_vehicle_type || m.sel_brand).filter(Boolean))].map((run, idx) => (
                          <span key={idx} style={{ background: "#dbeafe", color: "#1e40af", padding: "1px 6px", borderRadius: 4, fontSize: 10 }}>
                            {run}
                          </span>
                        ))}
                      </div>
                    ) : <span style={{ color: "#9ca3af" }}>ทั่วไป +</span>}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: qty <= 0 ? "#ef4444" : "#065f46" }}>{fmtQty(qty)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.unit_price)}</td>
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

      {/* ===== Popup เพิ่มอะไหล่ใหม่ ===== */}
      {addPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: 460, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#072d6b" }}>➕ เพิ่มอะไหล่หมุนเร็ว</h3>
              <button onClick={() => setAddPopup(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>ยี่ห้อ *</label>
              <select value={aBrand} onChange={e => setABrand(e.target.value)} style={selectStyle}>
                <option value="HONDA">HONDA (ฮอนด้า)</option>
                <option value="YAMAHA">YAMAHA (ยามาฮ่า)</option>
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>รหัสอะไหล่ * <span style={{ color: "#9ca3af", fontWeight: 400 }}>(เช่น 31500-KVB-T02)</span></label>
              <input value={aPartCode} onChange={e => setAPartCode(e.target.value)} placeholder="31500-KVB-T02" style={selectStyle} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>รหัสอ้างอิงคลัง <span style={{ color: "#9ca3af", fontWeight: 400 }}>(ใช้ join สต๊อก, ปกติเหมือนรหัสอะไหล่)</span></label>
              <input value={aRefCode} onChange={e => setARefCode(e.target.value)} placeholder="ใส่ถ้าต่างจากรหัสอะไหล่" style={selectStyle} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>หมวดหมู่</label>
              <input value={aCategory} onChange={e => setACategory(e.target.value)} list="add-cat-list" placeholder="01.1 แบตเตอรี่" style={selectStyle} />
              <datalist id="add-cat-list">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </datalist>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>กลุ่มสินค้า</label>
              <select value={aProductGroup} onChange={e => setAProductGroup(e.target.value)} style={selectStyle}>
                <option value="">-- เลือกกลุ่มสินค้า --</option>
                {productGroups.filter(g => g.status !== "inactive").map(g => (
                  <option key={g.group_code || g.id} value={`${g.group_code} ${g.group_name}`}>
                    {g.group_code} {g.group_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>ชื่อสินค้า <span style={{ color: "#9ca3af", fontWeight: 400 }}>(ถ้าไม่ใส่จะดึงจากคลังอัตโนมัติ)</span></label>
              <input value={aCustomName} onChange={e => setACustomName(e.target.value)} placeholder="แบตเตอรี่ (YTZ4V)(YUASA)" style={selectStyle} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>ประเภทอะไหล่</label>
              <div style={{ display: "flex", gap: 16 }}>
                {["สต๊อก", "ไม่สต๊อก"].map(val => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
                    <input type="radio" name="aStockType" value={val} checked={aStockType === val} onChange={() => setAStockType(val)} />
                    {val === "สต๊อก" ? "อะไหล่สต๊อก" : "อะไหล่ไม่สต๊อก"}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, color: aStockNakhonluang ? "#065f46" : "#374151" }}>
                <input type="checkbox" checked={aStockNakhonluang} onChange={e => setAStockNakhonluang(e.target.checked)} />
                🏪 เป็นอะไหล่สต๊อกนครหลวง
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, color: aDiscontinued ? "#b91c1c" : "#374151" }}>
                <input type="checkbox" checked={aDiscontinued} onChange={e => setADiscontinued(e.target.checked)} />
                🚫 ยกเลิกผลิตแล้ว
              </label>
            </div>

            {aError && <div style={{ marginBottom: 10, padding: "6px 10px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 13 }}>{aError}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveNewPart} disabled={aSaving} style={{ flex: 1, padding: "9px", fontSize: 14, background: aSaving ? "#9ca3af" : "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: aSaving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {aSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => setAddPopup(false)} disabled={aSaving} style={{ padding: "9px 16px", fontSize: 13, background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Popup แก้ไข หมวดหมู่/ชื่อสินค้า ===== */}
      {infoPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
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
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>ประเภทอะไหล่</label>
              <div style={{ display: "flex", gap: 16 }}>
                {["สต๊อก", "ไม่สต๊อก"].map(val => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
                    <input type="radio" name="stockType" value={val} checked={iStockType === val} onChange={() => setIStockType(val)} />
                    {val === "สต๊อก" ? "อะไหล่สต๊อก" : "อะไหล่ไม่สต๊อก"}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, color: iStockNakhonluang ? "#065f46" : "#374151" }}>
                <input type="checkbox" checked={iStockNakhonluang} onChange={e => setIStockNakhonluang(e.target.checked)} />
                🏪 เป็นอะไหล่สต๊อกนครหลวง
              </label>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600, color: iDiscontinued ? "#b91c1c" : "#374151" }}>
                <input type="checkbox" checked={iDiscontinued} onChange={e => setIDiscontinued(e.target.checked)} />
                🚫 ยกเลิกผลิตแล้ว
              </label>
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
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
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

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>แบบ <span style={{ color: "#9ca3af", fontWeight: 400 }}>(ไม่บังคับ)</span></label>
              <select value={eCode} onChange={e => { setECode(e.target.value); setEType(""); }} style={selectStyle} disabled={!eRun}>
                <option value="">-- ทุกแบบ --</option>
                {eCodeOpts.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" }}>type <span style={{ color: "#9ca3af", fontWeight: 400 }}>(ไม่บังคับ)</span></label>
              <input value={eType} onChange={e => setEType(e.target.value)} list="type-list" placeholder="-- ทุก type --" style={selectStyle} disabled={!eRun} />
              <datalist id="type-list">
                {eTypeOpts.map(t => <option key={t} value={t}>{t}</option>)}
              </datalist>
            </div>

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

// ===== CODE39 barcode → SVG (รองรับ 0-9 A-Z - . space $ / + %) =====
const CODE39 = {
  '0': "000110100", '1': "100100001", '2': "001100001", '3': "101100000",
  '4': "000110001", '5': "100110000", '6': "001110000", '7': "000100101",
  '8': "100100100", '9': "001100100", 'A': "100001001", 'B': "001001001",
  'C': "101001000", 'D': "000011001", 'E': "100011000", 'F': "001011000",
  'G': "000001101", 'H': "100001100", 'I': "001001100", 'J': "000011100",
  'K': "100000011", 'L': "001000011", 'M': "101000010", 'N': "000010011",
  'O': "100010010", 'P': "001010010", 'Q': "000000111", 'R': "100000110",
  'S': "001000110", 'T': "000010110", 'U': "110000001", 'V': "011000001",
  'W': "111000000", 'X': "010010001", 'Y': "110010000", 'Z': "011010000",
  '-': "010000101", '.': "110000100", ' ': "011000100", '$': "010101000",
  '/': "010100010", '+': "010001010", '%': "000101010", '*': "010010100",
};
function code39SVG(data) {
  const text = "*" + String(data || "").toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, "") + "*";
  const narrow = 1.6, wide = narrow * 3, h = 46;
  let x = 0; const rects = [];
  for (const ch of text) {
    const pat = CODE39[ch];
    if (!pat) continue;
    for (let i = 0; i < 9; i++) {
      const w = pat[i] === '1' ? wide : narrow;
      if (i % 2 === 0) rects.push(`<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${h}"/>`);
      x += w;
    }
    x += narrow; // inter-character gap
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x.toFixed(0)}" height="${h}" viewBox="0 0 ${x.toFixed(2)} ${h}" preserveAspectRatio="none">${rects.join("")}</svg>`;
}
