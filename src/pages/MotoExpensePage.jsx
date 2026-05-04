import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

function fmtThaiDate(s) {
  if (!s) return "-";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${(parseInt(m[1], 10) + 543).toString().slice(-2)}`;
}

const emptyForm = () => ({
  expense_name: "",
  expense_type: "fixed",
  group_by: "cc",
  engine_cc: "",
  company_id: "",
  brand_id: "",
  type_id: "",
  amount: "",
  note: "",
  status: "active",
  category: "",
  province: "",
  province_mode: "include",
  province_target: "customer",
  effective_date: "",
});

export default function MotoExpensePage({ currentUser }) {
  const [tab, setTab] = useState("cc");
  const [expenses, setExpenses] = useState([]);
  const [brands, setBrands] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [ccOptions, setCcOptions] = useState([]);
  const [motoTypes, setMotoTypes] = useState([]);
  const [motoSeries, setMotoSeries] = useState([]);
  const [motoModels, setMotoModels] = useState([]);
  const [typeBrand, setTypeBrand] = useState("");
  const [typeSeries, setTypeSeries] = useState("");
  const [typeModel, setTypeModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [message, setMessage] = useState("");
  const [historyTarget, setHistoryTarget] = useState(null); // { expense_id, name }
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function openHistory(e) {
    setHistoryTarget(e);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_expense_history", expense_id: e.expense_id }),
      });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch { setHistory([]); }
    setHistoryLoading(false);
  }

  useEffect(() => {
    fetchExpenses();
    fetchBrands();
    fetchCompanies();
    fetchCcOptions();
    fetchMotoTypes();
    fetchMotoSeries();
    fetchMotoModels();
  }, []);

  async function fetchExpenses() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_sale_expenses" }),
      });
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch { setMessage("โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }

  async function fetchBrands() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_brands" }),
      });
      const data = await res.json();
      setBrands(Array.isArray(data) ? data.filter(b => b.status === "active") : []);
    } catch { /* ignore */ }
  }

  async function fetchCompanies() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_finance_companies" }),
      });
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data.filter(c => c.status === "active") : []);
    } catch { /* ignore */ }
  }

  async function fetchCcOptions() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_engine_cc_options" }),
      });
      const data = await res.json();
      setCcOptions(Array.isArray(data) ? data.map(d => d.engine_cc).filter(Boolean).sort((a, b) => a - b) : []);
    } catch { /* ignore */ }
  }

  async function fetchMotoTypes() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_types" }),
      });
      const data = await res.json();
      setMotoTypes(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }

  async function fetchMotoSeries() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_series" }),
      });
      const data = await res.json();
      setMotoSeries(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }

  async function fetchMotoModels() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_models" }),
      });
      const data = await res.json();
      setMotoModels(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }

  async function handleSave() {
    if (!form.expense_name.trim()) { setMessage("กรุณากรอกชื่อรายการ"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setMessage("กรุณากรอกจำนวนเงิน"); return; }
    if (form.group_by === "cc" && !form.engine_cc) { setMessage("กรุณาเลือก CC"); return; }
    if (form.group_by === "finance" && !form.company_id) { setMessage("กรุณาเลือกบริษัทไฟแนนท์"); return; }
    if (form.group_by === "brand" && !form.brand_id) { setMessage("กรุณาเลือกยี่ห้อ"); return; }
    if (form.group_by === "type" && !form.type_id) { setMessage("กรุณาเลือก Type"); return; }
    if (form.group_by === "province" && !form.province?.trim()) { setMessage("กรุณากรอกชื่อจังหวัด"); return; }
    setSaving(true);
    setMessage("");
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editTarget ? "update_sale_expense" : "save_sale_expense",
          ...(editTarget ? { expense_id: editTarget.expense_id } : {}),
          expense_name: form.expense_name,
          expense_type: form.expense_type,
          group_by: form.group_by,
          category: form.category || null,
          province: form.group_by === "province" ? (form.province || null) : null,
          province_mode: form.group_by === "province" ? (form.province_mode || "include") : null,
          province_target: form.group_by === "province" ? (form.province_target || "customer") : null,
          engine_cc: form.group_by === "cc" ? Number(form.engine_cc) : null,
          company_id: form.group_by === "finance" ? Number(form.company_id) : null,
          brand_id: form.group_by === "brand" ? Number(form.brand_id) : null,
          type_id: form.group_by === "type" ? Number(form.type_id) : null,
          amount: Number(form.amount),
          note: form.note,
          status: form.status,
          effective_date: form.effective_date || null,
          updated_by: currentUser?.user_id || currentUser?.name || null,
        }),
      });
      setShowForm(false);
      setEditTarget(null);
      setForm(emptyForm());
      fetchExpenses();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  function openAdd() {
    setEditTarget(null);
    // tab register_province → group_by='province' + province_target='registered'
    const isRegisterProv = tab === "register_province";
    setForm({
      ...emptyForm(),
      group_by: isRegisterProv ? "province" : tab,
      province_target: isRegisterProv ? "registered" : "customer",
    });
    setShowForm(true);
    setMessage("");
  }

  function openEdit(e) {
    setEditTarget(e);
    setForm({
      expense_name: e.expense_name || "",
      expense_type: e.expense_type || "fixed",
      group_by: e.group_by || tab,
      engine_cc: e.engine_cc ? String(e.engine_cc) : "",
      company_id: e.company_id ? String(e.company_id) : "",
      brand_id: e.brand_id ? String(e.brand_id) : "",
      type_id: e.type_id ? String(e.type_id) : "",
      amount: e.amount ? String(e.amount) : "",
      note: e.note || "",
      status: e.status || "active",
      category: e.category || "",
      province: e.province || "",
      province_mode: e.province_mode || "include",
      province_target: e.province_target || "customer",
      effective_date: e.effective_date ? String(e.effective_date).slice(0, 10) : "",
    });
    if (e.group_by === "type" && e.type_id) {
      const t = motoTypes.find(t => String(t.type_id) === String(e.type_id));
      if (t) {
        setTypeBrand(String(t.brand_id || ""));
        setTypeSeries(String(t.series_id || ""));
        setTypeModel(String(t.model_id || ""));
      }
    } else {
      setTypeBrand(""); setTypeSeries(""); setTypeModel("");
    }
    setShowForm(true);
    setMessage("");
  }

  const filtered = expenses.filter(e => {
    if (tab === "province")          return e.group_by === "province" && (e.province_target || "customer") === "customer";
    if (tab === "register_province") return e.group_by === "province" && e.province_target === "registered";
    return e.group_by === tab;
  }).slice().sort((a, b) => {
    // เรียงแบบลำดับชั้น Type: ยี่ห้อ → รุ่น (series + model) → type → ชื่อรายการ
    const ta = a.type_id ? motoTypes.find(x => String(x.type_id) === String(a.type_id)) : null;
    const tb = b.type_id ? motoTypes.find(x => String(x.type_id) === String(b.type_id)) : null;

    const brandA = String(a.brand_name || ta?.brand_name || "").toLowerCase();
    const brandB = String(b.brand_name || tb?.brand_name || "").toLowerCase();
    if (brandA !== brandB) return brandA < brandB ? -1 : 1;

    const seriesA = String(ta?.marketing_name || ta?.series_name || "").toLowerCase();
    const seriesB = String(tb?.marketing_name || tb?.series_name || "").toLowerCase();
    if (seriesA !== seriesB) return seriesA < seriesB ? -1 : 1;

    const modelA = String(ta?.model_name || "").toLowerCase();
    const modelB = String(tb?.model_name || "").toLowerCase();
    if (modelA !== modelB) return modelA < modelB ? -1 : 1;

    const typeA = String(a.type_name || ta?.type_name || "").toLowerCase();
    const typeB = String(b.type_name || tb?.type_name || "").toLowerCase();
    if (typeA !== typeB) return typeA < typeB ? -1 : 1;

    return String(a.expense_name || "").localeCompare(String(b.expense_name || ""), "th");
  });

  const tabLabel = { cc: "CC", finance: "ไฟแนนท์", brand: "ยี่ห้อ", type: "Type", province: "จังหวัดลูกค้า", register_province: "จังหวัดจดทะเบียน" };
  const groupLabel = (e) => {
    if (e.group_by === "cc") return e.engine_cc ? e.engine_cc + " cc" : "-";
    if (e.group_by === "finance") return e.company_name || "-";
    if (e.group_by === "brand") return e.brand_name || "-";
    if (e.group_by === "type") return e.type_name || "-";
    if (e.group_by === "province") return e.province || "-";
    return "-";
  };

  // ดึงชื่อยี่ห้อ + รุ่น จากการ lookup motoTypes (ผูก type_id)
  const lookupTypeInfo = (e) => {
    const t = e.type_id ? motoTypes.find(x => String(x.type_id) === String(e.type_id)) : null;
    const brand = e.brand_name || t?.brand_name || (e.group_by === "brand" ? e.brand_name : "");
    const series = t?.marketing_name || t?.series_name || e.series_name || "";
    const model = t?.model_name || e.model_name || "";
    const modelLabel = [series, model].filter(Boolean).join(" ");
    return { brand: brand || "-", model: modelLabel || "-" };
  };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💸 บันทึกค่าใช้จ่ายการขาย</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {[["cc", "ตาม CC"], ["finance", "ตามไฟแนนท์"], ["brand", "ตามยี่ห้อ"], ["type", "ตาม Type"], ["province", "ตามจังหวัดลูกค้า"], ["register_province", "ตามจังหวัดจดทะเบียน"]].map(([key, label]) => (
            <button key={key} className={tab === key ? "btn-primary" : "btn-secondary"} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
          <button className="btn-primary" onClick={openAdd} style={{ marginLeft: 12 }}>+ เพิ่มค่าใช้จ่าย</button>
        </div>
      </div>

      {message && <div style={{ color: "#ef4444", marginBottom: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>{message}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>ชื่อรายการ</th>
                <th>หมวด</th>
                <th>ประเภท</th>
                <th>{tabLabel[tab]}</th>
                <th>ยี่ห้อ</th>
                <th>รุ่น</th>
                <th>จำนวนเงิน</th>
                <th>วันที่ประกาศใช้</th>
                <th>หมายเหตุ</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>ยังไม่มีข้อมูลค่าใช้จ่าย</td></tr>
              ) : filtered.map((e, i) => (
                <tr key={e.expense_id || i}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{e.expense_name || "-"}</td>
                  <td>{e.category ? <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#dbeafe", color: "#1e40af", fontWeight: 600 }}>{e.category}</span> : <span style={{ color: "#9ca3af", fontSize: 12 }}>-</span>}</td>
                  <td>
                    <span style={{
                      padding: "2px 10px", borderRadius: 12, fontSize: 12,
                      background: e.expense_type === "fixed" ? "#dbeafe" : "#fae8ff",
                      color: e.expense_type === "fixed" ? "#1e40af" : "#86198f",
                    }}>
                      {e.expense_type === "fixed" ? "คงที่" : "โปรโมชั่น"}
                    </span>
                  </td>
                  <td>{groupLabel(e)}</td>
                  {(() => {
                    const info = lookupTypeInfo(e);
                    return (
                      <>
                        <td style={{ fontSize: 12 }}>{info.brand}</td>
                        <td style={{ fontSize: 12 }}>{info.model}</td>
                      </>
                    );
                  })()}
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {Number(e.amount).toLocaleString()} บาท
                  </td>
                  <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "#374151" }}>
                    {e.effective_date ? fmtThaiDate(e.effective_date) : <span style={{ color: "#9ca3af" }}>-</span>}
                  </td>
                  <td>{e.note || "-"}</td>
                  <td>
                    <span style={{
                      padding: "2px 10px", borderRadius: 12, fontSize: 12,
                      background: e.status === "active" ? "#d1fae5" : "#f3f4f6",
                      color: e.status === "active" ? "#065f46" : "#6b7280",
                    }}>
                      {e.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => openEdit(e)}
                      style={{ padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, marginRight: 4 }}>
                      แก้ไข
                    </button>
                    <button onClick={() => openHistory(e)}
                      title="ดูประวัติการแก้ไข"
                      style={{ padding: "3px 10px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                      ประวัติ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ marginTop: 0 }}>{editTarget ? "แก้ไขค่าใช้จ่าย" : "เพิ่มค่าใช้จ่าย"}</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>ชื่อรายการ *</label>
              <input value={form.expense_name} onChange={e => setForm({ ...form, expense_name: e.target.value })}
                placeholder="เช่น ค่าจดทะเบียน, ค่าโปรโมชั่นดาวน์"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>หมวด (สำหรับวางบิล)</label>
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder="เช่น ค่าจดทะเบียน, ประกัน, ค่าน้ำมัน (พิมพ์เองได้)"
                list="expense-category-suggestions"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
              <datalist id="expense-category-suggestions">
                {[...new Set(expenses.map(x => x.category).filter(Boolean))].sort().map(c => <option key={c} value={c} />)}
              </datalist>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>หมวดที่ใช้บ่อยจะ auto-suggest · เว้นว่างได้ถ้ายังไม่กำหนด</div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>ประเภทค่าใช้จ่าย *</label>
              <div style={{ display: "flex", gap: 16 }}>
                {[["fixed", "คงที่ (เรียกเก็บลูกค้า)"], ["promotion", "โปรโมชั่น (จ่ายแทนลูกค้า)"]].map(([val, label]) => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: "normal", fontSize: 13 }}>
                    <input type="radio" name="expenseType" value={val} checked={form.expense_type === val}
                      onChange={() => setForm({ ...form, expense_type: val })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>


            {form.group_by === "cc" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>CC *</label>
                <select value={form.engine_cc} onChange={e => setForm({ ...form, engine_cc: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }}>
                  <option value="">-- เลือก CC --</option>
                  {ccOptions.map(cc => <option key={cc} value={cc}>{cc} cc</option>)}
                </select>
              </div>
            )}

            {form.group_by === "finance" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>บริษัทไฟแนนท์ *</label>
                <select value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }}>
                  <option value="">-- เลือกบริษัท --</option>
                  {companies.map(c => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
                </select>
              </div>
            )}

            {form.group_by === "brand" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>ยี่ห้อ *</label>
                <select value={form.brand_id} onChange={e => setForm({ ...form, brand_id: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }}>
                  <option value="">-- เลือกยี่ห้อ --</option>
                  {brands.map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
                </select>
              </div>
            )}

            {form.group_by === "type" && (() => {
              const brandOpts = [...new Set(motoSeries.map(s => s.brand_id))].map(id => brands.find(b => b.brand_id === id) || brands.find(b => String(b.brand_id) === String(id))).filter(Boolean);
              const seriesOpts = motoSeries.filter(s => typeBrand && String(s.brand_id) === String(typeBrand));
              const modelOpts = motoModels.filter(m => typeSeries && String(m.series_id) === String(typeSeries));
              const typeOpts = motoTypes.filter(t => typeModel && String(t.model_id) === String(typeModel));
              const selectStyle = { width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" };
              return <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>ยี่ห้อ *</label>
                  <select value={typeBrand} onChange={e => { setTypeBrand(e.target.value); setTypeSeries(""); setTypeModel(""); setForm({ ...form, type_id: "" }); }} style={selectStyle}>
                    <option value="">-- เลือกยี่ห้อ --</option>
                    {brandOpts.map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
                  </select>
                </div>
                {typeBrand && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>รุ่น *</label>
                    <select value={typeSeries} onChange={e => { setTypeSeries(e.target.value); setTypeModel(""); setForm({ ...form, type_id: "" }); }} style={selectStyle}>
                      <option value="">-- เลือกรุ่น --</option>
                      {seriesOpts.map(s => <option key={s.series_id} value={s.series_id}>{s.marketing_name || s.series_name}</option>)}
                    </select>
                  </div>
                )}
                {typeSeries && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>แบบ *</label>
                    <select value={typeModel} onChange={e => { setTypeModel(e.target.value); setForm({ ...form, type_id: "" }); }} style={selectStyle}>
                      <option value="">-- เลือกแบบ --</option>
                      {modelOpts.map(m => <option key={m.model_id} value={m.model_id}>{m.model_code}</option>)}
                    </select>
                  </div>
                )}
                {typeModel && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>Type *</label>
                    <select value={form.type_id} onChange={e => setForm({ ...form, type_id: e.target.value })} style={selectStyle}>
                      <option value="">-- เลือก Type --</option>
                      {typeOpts.map(t => <option key={t.type_id} value={t.type_id}>{t.type_name}</option>)}
                    </select>
                  </div>
                )}
              </>;
            })()}

            {form.group_by === "province" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>จังหวัด *</label>
                  <input value={form.province} onChange={e => setForm({ ...form, province: e.target.value })}
                    placeholder="เช่น พระนครศรีอยุธยา, กรุงเทพมหานคร"
                    list="province-suggestions"
                    style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
                  <datalist id="province-suggestions">
                    {[...new Set(expenses.map(x => x.province).filter(Boolean))].sort().map(p => <option key={p} value={p} />)}
                    <option value="พระนครศรีอยุธยา" />
                    <option value="กรุงเทพมหานคร" />
                    <option value="อยุธยา" />
                    <option value="สระบุรี" />
                    <option value="ปทุมธานี" />
                  </datalist>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>
                    {form.province_mode === "exclude"
                      ? "💡 ขึ้นสำหรับลูกค้าทุกจังหวัด ยกเว้นจังหวัดที่ระบุ"
                      : form.province_mode === "cross"
                        ? "💡 จดทะเบียน = จังหวัดนี้ + ลูกค้า/ไฟแนนท์ ไม่ได้อยู่จังหวัดนี้ → คิดค่าใช้จ่าย (ขอใช้ข้ามจังหวัด)"
                        : "💡 ขึ้นเฉพาะลูกค้าที่อยู่ในจังหวัดที่ระบุ"}
                  </div>
                </div>
                <div style={{ marginBottom: 12, padding: "8px 10px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox"
                      checked={form.province_mode === "cross"}
                      onChange={e => setForm({ ...form, province_mode: e.target.checked ? "cross" : "include" })}
                      style={{ width: 16, height: 16, cursor: "pointer" }} />
                    🌐 ขอใช้ข้ามจังหวัด
                  </label>
                  {form.province_mode !== "cross" && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, marginTop: 6, color: "#6b7280" }}>
                      <input type="checkbox"
                        checked={form.province_mode === "exclude"}
                        onChange={e => setForm({ ...form, province_mode: e.target.checked ? "exclude" : "include" })}
                        style={{ width: 14, height: 14, cursor: "pointer" }} />
                      ✕ ยกเว้นจังหวัดนี้ (กรณีพิเศษ)
                    </label>
                  )}
                </div>
              </>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>จำนวนเงิน (บาท) *</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box", textAlign: "right" }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>📅 วันที่ประกาศใช้</label>
              <input type="date" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>
                วันที่อัตรานี้เริ่มมีผลบังคับใช้ — เว้นว่างไว้หากยังไม่ระบุ
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>หมายเหตุ</label>
              <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="หมายเหตุ (ถ้ามี)"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>สถานะ</label>
              <div style={{ display: "flex", gap: 20 }}>
                {[["active", "ใช้งาน"], ["inactive", "ไม่ใช้งาน"]].map(([val, label]) => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: "normal" }}>
                    <input type="radio" name="expStatus" value={val} checked={form.status === val}
                      onChange={() => setForm({ ...form, status: val })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

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

      {/* Popup: ประวัติการแก้ไข */}
      {historyTarget && (
        <div onClick={() => setHistoryTarget(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(800px, 96vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#072d6b" }}>
                  📜 ประวัติการแก้ไข — {historyTarget.expense_name}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  ID: {historyTarget.expense_id} · ปัจจุบัน {Number(historyTarget.amount).toLocaleString()} บาท
                </div>
              </div>
              <button onClick={() => setHistoryTarget(null)}
                style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>×</button>
            </div>

            {historyLoading ? (
              <div style={{ textAlign: "center", padding: 30, color: "#6b7280" }}>กำลังโหลด...</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>ไม่มีประวัติการแก้ไข</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#072d6b", color: "#fff" }}>
                      <th style={{ padding: "8px 10px", textAlign: "center", width: 40 }}>#</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>เปลี่ยนเมื่อ</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>โดย</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>จำนวนเงิน</th>
                      <th style={{ padding: "8px 10px", textAlign: "center" }}>วันที่ประกาศใช้</th>
                      <th style={{ padding: "8px 10px", textAlign: "center" }}>สถานะ</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "6px 10px", textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                        <td style={{ padding: "6px 10px", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 11 }}>
                          {h.changed_at ? String(h.changed_at).slice(0, 19).replace("T", " ") : "-"}
                        </td>
                        <td style={{ padding: "6px 10px" }}>{h.changed_by || "-"}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>{Number(h.amount || 0).toLocaleString()}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center", whiteSpace: "nowrap" }}>{fmtThaiDate(h.effective_date)}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <span style={{ padding: "1px 8px", borderRadius: 4, fontSize: 11, background: h.status === "active" ? "#d1fae5" : "#f3f4f6", color: h.status === "active" ? "#065f46" : "#6b7280" }}>
                            {h.status === "active" ? "ใช้งาน" : "ไม่ใช้"}
                          </span>
                        </td>
                        <td style={{ padding: "6px 10px", color: "#6b7280" }}>{h.note || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
