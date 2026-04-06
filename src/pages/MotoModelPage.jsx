import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const FORM_DEFAULT = {
  brand_name: "", series_name: "", marketing_name: "", thai_name: "", engine_cc: "",
  model_code: "", model_detail: "", type_name: "", color_code: "", color_name: "",
  brand_id: "", series_id: "", model_id: "", type_id: "", status: "active",
  vehicle_type_name: "", vehicle_type_id: "",
};

async function post(body) {
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json().catch(() => ({}));
}

function StatusBadge({ status }) {
  const active = status === "active";
  return (
    <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12,
      background: active ? "#d1fae5" : "#fee2e2",
      color: active ? "#065f46" : "#991b1b" }}>
      {active ? "ใช้งาน" : "ยกเลิก"}
    </span>
  );
}

const TABS = [["brands", "ยี่ห้อ"], ["vehicle_types", "ประเภทรถ"], ["series", "รุ่น"], ["models", "แบบ"], ["types", "type"], ["colors", "สี"]];

export default function MotoModelPage({ currentUser }) {
  const [tab, setTab] = useState("brands");
  const [brands, setBrands] = useState([]);
  const [series, setSeries] = useState([]);
  const [models, setModels] = useState([]);
  const [types, setTypes] = useState([]);
  const [colors, setColors] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [filterBrand, setFilterBrand] = useState("");
  const [filterSeries, setFilterSeries] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterType, setFilterType] = useState("");

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [b, s, m, t, c, vt] = await Promise.all([
        post({ action: "get_brands" }),
        post({ action: "get_series" }),
        post({ action: "get_models" }),
        post({ action: "get_types" }),
        post({ action: "get_colors" }),
        post({ action: "get_vehicle_types" }),
      ]);
      setBrands(Array.isArray(b) ? b : []);
      setSeries(Array.isArray(s) ? s : []);
      setModels(Array.isArray(m) ? m : []);
      setTypes(Array.isArray(t) ? t : []);
      setColors(Array.isArray(c) ? c : []);
      setVehicleTypes(Array.isArray(vt) ? vt : []);
    } catch { setMessage("โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }

  async function handleSave() {
    setMessage("");
    if (tab === "brands" && !form.brand_name.trim()) { setMessage("กรุณากรอกชื่อยี่ห้อ"); return; }
    if (tab === "vehicle_types" && !form.vehicle_type_name.trim()) { setMessage("กรุณากรอกชื่อประเภทรถ"); return; }
    if (tab === "series" && (!form.series_name.trim() || !form.brand_id)) { setMessage("กรุณาเลือกยี่ห้อและกรอกชื่อรุ่น"); return; }
    if (tab === "models" && (!form.model_code.trim() || !form.series_id)) { setMessage("กรุณาเลือกรุ่นและกรอกรหัสแบบ"); return; }
    if (tab === "types" && (!form.type_name.trim() || !form.model_id)) { setMessage("กรุณาเลือกแบบและกรอกชื่อ type"); return; }
    if (tab === "colors" && (!form.color_code.trim() || !form.type_id)) { setMessage("กรุณาเลือก type และกรอกรหัสสี"); return; }
    setSaving(true);
    try {
      const isEdit = !!editTarget;
      let body;
      if (tab === "brands") {
        body = { action: isEdit ? "update_brand" : "save_brand", brand_id: editTarget?.brand_id, brand_name: form.brand_name, status: form.status };
      } else if (tab === "vehicle_types") {
        body = { action: isEdit ? "update_vehicle_type" : "save_vehicle_type", vehicle_type_id: editTarget?.vehicle_type_id, vehicle_type_name: form.vehicle_type_name, status: form.status };
      } else if (tab === "series") {
        body = { action: isEdit ? "update_series" : "save_series", series_id: editTarget?.series_id, brand_id: Number(form.brand_id), vehicle_type_id: form.vehicle_type_id ? Number(form.vehicle_type_id) : null, series_name: form.series_name, marketing_name: form.marketing_name, thai_name: form.thai_name, engine_cc: form.engine_cc, status: form.status };
      } else if (tab === "models") {
        body = { action: isEdit ? "update_model" : "save_model", model_id: editTarget?.model_id, series_id: Number(form.series_id), model_code: form.model_code, status: form.status };
      } else if (tab === "types") {
        body = { action: isEdit ? "update_type" : "save_type", type_id: editTarget?.type_id, model_id: Number(form.model_id), type_name: form.type_name, model_detail: form.model_detail, status: form.status };
      } else {
        body = { action: isEdit ? "update_color" : "save_color", color_id: editTarget?.color_id, type_id: Number(form.type_id), color_code: form.color_code, color_name: form.color_name, status: form.status };
      }
      await post(body);
      setShowForm(false);
      setEditTarget(null);
      setForm(FORM_DEFAULT);
      fetchAll();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  function openAdd() {
    setEditTarget(null);
    setForm({ ...FORM_DEFAULT, brand_id: filterBrand || "", series_id: filterSeries || "", model_id: filterModel || "", type_id: filterType || "" });
    setShowForm(true);
    setMessage("");
  }

  function openEdit(row) {
    setEditTarget(row);
    if (tab === "brands") {
      setForm({ ...FORM_DEFAULT, brand_name: row.brand_name, status: row.status || "active" });
    } else if (tab === "vehicle_types") {
      setForm({ ...FORM_DEFAULT, vehicle_type_name: row.vehicle_type_name, status: row.status || "active" });
    } else if (tab === "series") {
      setForm({ ...FORM_DEFAULT, brand_id: String(row.brand_id), vehicle_type_id: row.vehicle_type_id ? String(row.vehicle_type_id) : "", series_name: row.series_name, marketing_name: row.marketing_name || "", thai_name: row.thai_name || "", engine_cc: row.engine_cc || "", status: row.status || "active" });
    } else if (tab === "models") {
      setForm({ ...FORM_DEFAULT, series_id: String(row.series_id), model_code: row.model_code, status: row.status || "active" });
    } else if (tab === "types") {
      setForm({ ...FORM_DEFAULT, model_id: String(row.model_id), type_name: row.type_name, model_detail: row.model_detail || "", status: row.status || "active" });
    } else {
      setForm({ ...FORM_DEFAULT, type_id: String(row.type_id), color_code: row.color_code, color_name: row.color_name || "", status: row.status || "active" });
    }
    setShowForm(true);
    setMessage("");
  }

  // Computed filters
  const filteredSeries = series.filter(s => !filterBrand || String(s.brand_id) === filterBrand);
  const filteredModels = models.filter(m => {
    if (filterSeries) return String(m.series_id) === filterSeries;
    if (filterBrand) return String(m.brand_id) === filterBrand;
    return true;
  });
  const filteredTypes = types.filter(t => {
    if (filterModel) return String(t.model_id) === filterModel;
    if (filterSeries) return String(t.series_id) === filterSeries;
    if (filterBrand) return String(t.brand_id) === filterBrand;
    return true;
  });
  const filteredColors = colors.filter(c => {
    if (filterType) return String(c.type_id) === filterType;
    if (filterModel) return String(c.model_id) === filterModel;
    if (filterSeries) return String(c.series_id) === filterSeries;
    if (filterBrand) return String(c.brand_id) === filterBrand;
    return true;
  });

  // Form cascading selects
  const formSeriesOpts = series.filter(s => !form.brand_id || String(s.brand_id) === form.brand_id);
  const formModelOpts = models.filter(m => !form.series_id || String(m.series_id) === form.series_id);
  const formTypeOpts = types.filter(t => !form.model_id || String(t.model_id) === form.model_id);

  const tabLabel = TABS.find(t => t[0] === tab)?.[1] || "";
  const currentRows = tab === "brands" ? brands : tab === "vehicle_types" ? vehicleTypes : tab === "series" ? filteredSeries : tab === "models" ? filteredModels : tab === "types" ? filteredTypes : filteredColors;

  const inp = (field, label, placeholder, required = false) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>{label}{required ? " *" : ""}</label>
      <input value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );

  const sel = (field, label, opts, placeholder, onChange) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>{label} *</label>
      <select value={form[field]} onChange={onChange || (e => setForm(p => ({ ...p, [field]: e.target.value })))}
        style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14 }}>
        <option value="">{placeholder}</option>
        {opts}
      </select>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📋 ข้อมูลรุ่นรถจักรยานยนต์</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {TABS.map(([t, label]) => (
            <button key={t}
              className={tab === t ? "btn-primary" : "btn-secondary"}
              onClick={() => { setTab(t); setFilterBrand(""); setFilterSeries(""); setFilterModel(""); setFilterType(""); }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div style={{ color: "#ef4444", marginBottom: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>{message}</div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : (
        <div>
          {/* Filters + Add */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            {(tab === "series" || tab === "models" || tab === "types" || tab === "colors") && (
              <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setFilterSeries(""); setFilterModel(""); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}>
                <option value="">-- ยี่ห้อ ทั้งหมด --</option>
                {brands.map(b => <option key={b.brand_id} value={String(b.brand_id)}>{b.brand_name}</option>)}
              </select>
            )}
            {(tab === "models" || tab === "types" || tab === "colors") && (
              <select value={filterSeries} onChange={e => { setFilterSeries(e.target.value); setFilterModel(""); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}>
                <option value="">-- รุ่น ทั้งหมด --</option>
                {filteredSeries.map(s => <option key={s.series_id} value={String(s.series_id)}>{s.series_name}</option>)}
              </select>
            )}
            {(tab === "types" || tab === "colors") && (
              <select value={filterModel} onChange={e => { setFilterModel(e.target.value); setFilterType(""); }}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}>
                <option value="">-- แบบ ทั้งหมด --</option>
                {filteredModels.map(m => <option key={m.model_id} value={String(m.model_id)}>{m.model_code}</option>)}
              </select>
            )}
            {tab === "colors" && (
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}>
                <option value="">-- type ทั้งหมด --</option>
                {filteredTypes.map(t => <option key={t.type_id} value={String(t.type_id)}>{t.type_name}</option>)}
              </select>
            )}
            <button className="btn-primary" onClick={openAdd} style={{ marginLeft: "auto" }}>
              + เพิ่ม{tabLabel}
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  {tab !== "brands" && tab !== "vehicle_types" && <th>ยี่ห้อ</th>}
                  {tab === "brands" && <th>ชื่อยี่ห้อ</th>}
                  {tab === "vehicle_types" && <th>ชื่อประเภทรถ</th>}
                  {tab === "series" && <><th>ชื่อรุ่น</th><th>ชื่อทางการตลาด</th><th>ชื่อภาษาไทยทางการตลาด</th><th>ประเภทรถ</th><th>ซีซีรถ</th></>}
                  {tab === "models" && <><th>รุ่น</th><th>แบบ</th></>}
                  {tab === "types" && <><th>รุ่น</th><th>แบบ</th><th>type</th><th>รายละเอียดรุ่น</th></>}
                  {tab === "colors" && <><th>รุ่น</th><th>แบบ</th><th>type</th><th>รหัสสี</th><th>สี</th></>}
                  <th>สถานะ</th>
                  <th style={{ width: 80 }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>ยังไม่มีข้อมูล</td></tr>
                ) : currentRows.map((row, i) => (
                  <tr key={row.color_id ?? row.type_id ?? row.model_id ?? row.series_id ?? row.vehicle_type_id ?? row.brand_id}>
                    <td>{i + 1}</td>
                    {tab !== "brands" && tab !== "vehicle_types" && <td>{row.brand_name || "-"}</td>}
                    {tab === "brands" && <td style={{ fontWeight: 600 }}>{row.brand_name}</td>}
                    {tab === "vehicle_types" && <td style={{ fontWeight: 600 }}>{row.vehicle_type_name}</td>}
                    {tab === "series" && (<><td style={{ fontWeight: 600 }}>{row.series_name}</td><td>{row.marketing_name || "-"}</td><td>{row.thai_name || "-"}</td><td>{(vehicleTypes.find(v => v.vehicle_type_id === row.vehicle_type_id) || {}).vehicle_type_name || "-"}</td><td>{row.engine_cc || "-"}</td></>)}
                    {tab === "models" && (<><td>{row.series_name || "-"}</td><td style={{ fontWeight: 600 }}>{row.model_code}</td></>)}
                    {tab === "types" && (<><td>{row.series_name || "-"}</td><td>{row.model_code || "-"}</td><td style={{ fontWeight: 600 }}>{row.type_name}</td><td>{row.model_detail || "-"}</td></>)}
                    {tab === "colors" && (<><td>{row.series_name || "-"}</td><td>{row.model_code || "-"}</td><td>{row.type_name || "-"}</td><td style={{ fontWeight: 600 }}>{row.color_code}</td><td>{row.color_name || "-"}</td></>)}
                    <td><StatusBadge status={row.status || "active"} /></td>
                    <td>
                      <button onClick={() => openEdit(row)}
                        style={{ padding: "3px 12px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0 }}>{editTarget ? "แก้ไข" : "เพิ่ม"}{tabLabel}</h3>

            {/* BRANDS */}
            {tab === "brands" && inp("brand_name", "ชื่อยี่ห้อ", "เช่น ฮอนด้า", true)}

            {/* VEHICLE TYPES */}
            {tab === "vehicle_types" && inp("vehicle_type_name", "ชื่อประเภทรถ", "เช่น AT, MT, Cub", true)}

            {/* SERIES */}
            {tab === "series" && (<>
              {!editTarget && sel("brand_id", "ยี่ห้อ", brands.map(b => <option key={b.brand_id} value={String(b.brand_id)}>{b.brand_name}</option>), "-- เลือกยี่ห้อ --")}
              {sel("vehicle_type_id", "ประเภทรถ", vehicleTypes.filter(v => v.status === "active").map(v => <option key={v.vehicle_type_id} value={String(v.vehicle_type_id)}>{v.vehicle_type_name}</option>), "-- เลือกประเภทรถ --")}
              {inp("series_name", "ชื่อรุ่น", "เช่น ADV160", true)}
              {inp("marketing_name", "ชื่อทางการตลาด", "เช่น ADV160")}
              {inp("thai_name", "ชื่อภาษาไทยทางการตลาด", "เช่น เอดีวี160")}
              {inp("engine_cc", "ซีซีรถ", "เช่น 160, 125")}
            </>)}

            {/* MODELS */}
            {tab === "models" && (<>
              {!editTarget && (<>
                {sel("brand_id", "ยี่ห้อ", brands.map(b => <option key={b.brand_id} value={String(b.brand_id)}>{b.brand_name}</option>), "-- เลือกยี่ห้อ --",
                  e => setForm(p => ({ ...p, brand_id: e.target.value, series_id: "" })))}
                {sel("series_id", "รุ่น", formSeriesOpts.map(s => <option key={s.series_id} value={String(s.series_id)}>{s.series_name}</option>), "-- เลือกรุ่น --")}
              </>)}
              {inp("model_code", "แบบ (รหัส)", "เช่น ADV160AS TH", true)}
            </>)}

            {/* TYPES */}
            {tab === "types" && (<>
              {!editTarget && (<>
                {sel("brand_id", "ยี่ห้อ", brands.map(b => <option key={b.brand_id} value={String(b.brand_id)}>{b.brand_name}</option>), "-- เลือกยี่ห้อ --",
                  e => setForm(p => ({ ...p, brand_id: e.target.value, series_id: "", model_id: "" })))}
                {sel("series_id", "รุ่น", formSeriesOpts.map(s => <option key={s.series_id} value={String(s.series_id)}>{s.series_name}</option>), "-- เลือกรุ่น --",
                  e => setForm(p => ({ ...p, series_id: e.target.value, model_id: "" })))}
                {sel("model_id", "แบบ", formModelOpts.map(m => <option key={m.model_id} value={String(m.model_id)}>{m.model_code}</option>), "-- เลือกแบบ --")}
              </>)}
              {editTarget && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#f9fafb", borderRadius: 8, fontSize: 13, color: "#6b7280" }}>
                แบบ: <strong>{editTarget.model_code}</strong>
              </div>}
              {inp("type_name", "type", "เช่น Standard, ABS, CBS", true)}
              {inp("model_detail", "รายละเอียดรุ่น", "เช่น GL300 (กระปุก บีบ ดิสก์ ABS)")}
            </>)}

            {/* COLORS */}
            {tab === "colors" && (<>
              {!editTarget && (<>
                {sel("brand_id", "ยี่ห้อ", brands.map(b => <option key={b.brand_id} value={String(b.brand_id)}>{b.brand_name}</option>), "-- เลือกยี่ห้อ --",
                  e => setForm(p => ({ ...p, brand_id: e.target.value, series_id: "", model_id: "", type_id: "" })))}
                {sel("series_id", "รุ่น", formSeriesOpts.map(s => <option key={s.series_id} value={String(s.series_id)}>{s.series_name}</option>), "-- เลือกรุ่น --",
                  e => setForm(p => ({ ...p, series_id: e.target.value, model_id: "", type_id: "" })))}
                {sel("model_id", "แบบ", formModelOpts.map(m => <option key={m.model_id} value={String(m.model_id)}>{m.model_code}</option>), "-- เลือกแบบ --",
                  e => setForm(p => ({ ...p, model_id: e.target.value, type_id: "" })))}
                {sel("type_id", "type", formTypeOpts.map(t => <option key={t.type_id} value={String(t.type_id)}>{t.type_name}</option>), "-- เลือก type --")}
              </>)}
              {editTarget && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#f9fafb", borderRadius: 8, fontSize: 13, color: "#6b7280" }}>
                type: <strong>{editTarget.type_name}</strong>
              </div>}
              {inp("color_code", "รหัสสี", "เช่น O-B", true)}
              {inp("color_name", "สี", "เช่น ส้มดำ")}
            </>)}

            {/* Status (edit only) */}
            {editTarget && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>สถานะ</label>
                <div style={{ display: "flex", gap: 20 }}>
                  {[["active", "ใช้งาน"], ["inactive", "ยกเลิก"]].map(([val, label]) => (
                    <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: "normal", fontSize: 14 }}>
                      <input type="radio" name="rowStatus" value={val} checked={form.status === val}
                        onChange={() => setForm(p => ({ ...p, status: val }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {message && <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}>{message}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: "9px 0", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => { setShowForm(false); setMessage(""); }}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
