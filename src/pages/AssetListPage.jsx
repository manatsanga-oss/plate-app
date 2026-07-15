import React, { useEffect, useMemo, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/asset-api";

// สถานะสินทรัพย์ตามแบบ FlowAccount
const STATUS = [
  { key: "active", label: "ใช้งานอยู่", color: "#0369a1", bg: "#e0f2fe" },
  { key: "paused", label: "พักการใช้งาน", color: "#b45309", bg: "#fef3c7" },
  { key: "retired", label: "เลิกใช้แล้ว", color: "#dc2626", bg: "#fee2e2" },
];
const stOf = (k) => STATUS.find(s => s.key === k) || STATUS[0];

const AFFILIATIONS = ["ป.เปา", "สิงห์ชัย"];  // สังกัดบริษัท — ทะเบียนสินทรัพย์แยกบริษัท (ชุดเดียวกับบันทึกค่าใช้จ่าย)

const emptyForm = (mode) => ({
  acquisition_type: mode || "new",   // new = ซื้อสินทรัพย์มาใหม่ | carried = เพิ่มสินทรัพย์ยกมา
  affiliation: "",
  asset_code: "",
  asset_name: "",
  description: "",
  reference_no: "",
  category_id: "",
  quantity: 1,
  unit: "",
  purchase_date: "",
  vendor_name: "",
  serial_no: "",
  warranty_expire_date: "",
  location: "",
  assigned_to: "",
  start_use_date: "",
  purchase_price: 0,
  enable_depreciation: true,
  salvage_value: 1,
  useful_life_years: "",
  has_accum_bf: mode === "carried",
  accum_bf_amount: 0,
  accum_bf_date: "",
  note: "",
  status: "active",
  retired_date: "",
});

const fmt = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = v => v ? new Date(v).toLocaleDateString("th-TH") : "-";

// ค่าเสื่อมสะสม ณ วันนี้ (เส้นตรง ปันตามวันจริง ปีละ 365 วัน — ตามรายงาน FlowAccount)
// ยกมา: เริ่มนับต่อจาก accum_bf_amount ณ accum_bf_date · เพดาน = มูลค่าที่คิดค่าเสื่อม · พื้น book value = มูลค่าซาก
function calcDepreciation(a, asOf = new Date()) {
  const price = Number(a.purchase_price) || 0;
  const enabled = !(a.enable_depreciation === false || String(a.enable_depreciation) === "false");
  const salvage = Number(a.salvage_value) || 0;
  const years = Number(a.useful_life_years) || 0;
  const bfAmt = a.has_accum_bf === false ? 0 : (Number(a.accum_bf_amount) || 0);
  if (!enabled || !(years > 0) || !a.start_use_date) {
    const accum = Math.min(bfAmt, Math.max(0, price - salvage));
    return { annual: 0, accum, book: price - accum };
  }
  const annual = Math.max(0, price - salvage) / years;
  const base = (bfAmt > 0 && a.accum_bf_date) ? new Date(a.accum_bf_date) : new Date(a.start_use_date);
  const end = (a.status === "retired" && a.retired_date) ? new Date(a.retired_date) : asOf;
  const days = Math.max(0, Math.floor((end - base) / 86400000));
  const accum = Math.min(Math.max(0, price - salvage), bfAmt + annual * days / 365);
  return { annual, accum, book: Math.max(salvage, price - accum) };
}

// รายการสินทรัพย์ (จัดการสินทรัพย์) — ตามแบบ FlowAccount: list + เพิ่มสินทรัพย์ 2 แบบ (ซื้อมาใหม่/ยกมา)
export default function AssetListPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm("new"));
  const [editTarget, setEditTarget] = useState(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [statusTab, setStatusTab] = useState("all");
  const [filterAff, setFilterAff] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { fetchData(); fetchCategories(); /* eslint-disable-next-line */ }, []);

  async function post(body) {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const data = await post({ action: "list_assets" });
      setRows(Array.isArray(data) ? data.filter(r => r && r.asset_id) : []);
    } catch { setMessage("❌ โหลดไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  async function fetchCategories() {
    try {
      const data = await post({ action: "list_asset_categories", include_inactive: "false" });
      setCategories((Array.isArray(data) ? data : []).filter(c => c && c.category_id));
    } catch { setCategories([]); }
  }

  function openAdd(mode) {
    setForm(emptyForm(mode)); setEditTarget(null); setAddMenuOpen(false); setShowForm(true);
  }

  function openEdit(r) {
    setForm({
      acquisition_type: r.acquisition_type || "new",
      affiliation: r.affiliation || "",
      asset_code: r.asset_code || "",
      asset_name: r.asset_name || "",
      description: r.description || "",
      reference_no: r.reference_no || "",
      category_id: r.category_id || "",
      quantity: r.quantity ?? 1,
      unit: r.unit || "",
      purchase_date: r.purchase_date ? String(r.purchase_date).slice(0, 10) : "",
      vendor_name: r.vendor_name || "",
      serial_no: r.serial_no || "",
      warranty_expire_date: r.warranty_expire_date ? String(r.warranty_expire_date).slice(0, 10) : "",
      location: r.location || "",
      assigned_to: r.assigned_to || "",
      start_use_date: r.start_use_date ? String(r.start_use_date).slice(0, 10) : "",
      purchase_price: r.purchase_price ?? 0,
      enable_depreciation: !(r.enable_depreciation === false || String(r.enable_depreciation) === "false"),
      salvage_value: r.salvage_value ?? 1,
      useful_life_years: r.useful_life_years ?? "",
      has_accum_bf: Number(r.accum_bf_amount) > 0,
      accum_bf_amount: r.accum_bf_amount ?? 0,
      accum_bf_date: r.accum_bf_date ? String(r.accum_bf_date).slice(0, 10) : "",
      note: r.note || "",
      status: r.status || "active",
      retired_date: r.retired_date ? String(r.retired_date).slice(0, 10) : "",
    });
    setEditTarget(r);
    setShowForm(true);
  }

  // เลือกหมวด → ติดอายุการใช้งานจาก master มาให้อัตโนมัติ (ถ้ายังไม่ได้กรอกเอง)
  function onCategoryChange(cid) {
    const cat = categories.find(c => String(c.category_id) === String(cid));
    setForm(f => ({
      ...f, category_id: cid,
      useful_life_years: (cat && (!f.useful_life_years || Number(f.useful_life_years) <= 0)) ? cat.useful_life_years : f.useful_life_years,
    }));
  }

  async function handleSave() {
    if (!form.asset_name.trim()) { setMessage("❌ กรุณาระบุชื่อสินทรัพย์"); return; }
    if (!form.affiliation) { setMessage("❌ กรุณาเลือกสังกัด (ป.เปา / สิงห์ชัย)"); return; }
    if (!form.category_id) { setMessage("❌ กรุณาเลือกหมวดหมู่สินทรัพย์"); return; }
    if (form.enable_depreciation && !(Number(form.useful_life_years) > 0)) { setMessage("❌ กรุณาระบุอายุการใช้งานทางบัญชี (ปี)"); return; }
    if (form.enable_depreciation && !form.start_use_date) { setMessage("❌ กรุณาระบุวันที่เริ่มต้นใช้งาน"); return; }
    setSaving(true); setMessage("");
    try {
      await post({
        action: editTarget ? "update_asset" : "save_asset",
        ...(editTarget ? { asset_id: editTarget.asset_id } : {}),
        ...form,
        accum_bf_amount: form.has_accum_bf ? form.accum_bf_amount : 0,
        accum_bf_date: form.has_accum_bf ? form.accum_bf_date : "",
        created_by: currentUser?.username || currentUser?.name || "system",
      });
      setShowForm(false); setEditTarget(null);
      setMessage(`✅ ${editTarget ? "แก้ไข" : "บันทึก"}สินทรัพย์สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function changeStatus(r, newStatus) {
    if (newStatus === r.status) return;
    const label = stOf(newStatus).label;
    if (!window.confirm(`เปลี่ยนสถานะ "${r.asset_name}" เป็น "${label}"?`)) { fetchData(); return; }
    try {
      await post({
        action: "update_asset", asset_id: r.asset_id, status: newStatus,
        ...(newStatus === "retired" ? { retired_date: new Date().toISOString().slice(0, 10) } : { retired_date: "" }),
      });
      fetchData();
    } catch { setMessage("❌ ไม่สำเร็จ"); }
  }

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (statusTab !== "all" && (r.status || "active") !== statusTab) return false;
    if (filterAff && String(r.affiliation || "") !== filterAff) return false;
    if (!kw) return true;
    const hay = [r.asset_code, r.asset_name, r.description, r.reference_no, r.category_name, r.serial_no, r.location, r.assigned_to, r.vendor_name].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });
  const countOf = (k) => rows.filter(r => (k === "all" || (r.status || "active") === k) && (!filterAff || String(r.affiliation || "") === filterAff)).length;
  const totals = filtered.reduce((s, r) => {
    const d = calcDepreciation(r);
    return { price: s.price + Number(r.purchase_price || 0), book: s.book + d.book };
  }, { price: 0, book: 0 });

  // ---- คำนวณสดในฟอร์ม ----
  const fCalc = useMemo(() => calcDepreciation(form), [form]);
  const fPct = Number(form.useful_life_years) > 0 ? (100 / Number(form.useful_life_years)) : 0;
  const fDepBase = Math.max(0, (Number(form.purchase_price) || 0) - (Number(form.salvage_value) || 0));

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🏗️ จัดการสินทรัพย์ <span style={{ fontSize: 13, fontWeight: 400, color: "#9ca3af" }}>รายการสินทรัพย์</span></h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {/* Status tabs */}
        <div style={{ display: "flex", gap: 4, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 3 }}>
          {[{ key: "all", label: "แสดงทั้งหมด" }, ...STATUS].map(t => (
            <button key={t.key} onClick={() => setStatusTab(t.key)}
              style={{ padding: "5px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: statusTab === t.key ? 700 : 400, background: statusTab === t.key ? "#072d6b" : "transparent", color: statusTab === t.key ? "#fff" : (t.color || "#374151") }}>
              {t.key !== "all" && <span style={{ marginRight: 4 }}>●</span>}{t.label} ({countOf(t.key)})
            </button>
          ))}
        </div>
        <select value={filterAff} onChange={e => setFilterAff(e.target.value)} style={{ ...inp, width: 130 }}>
          <option value="">ทุกสังกัด</option>
          {AFFILIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="text" placeholder="🔍 ค้นหา (รหัส, ชื่อ, เลขอ้างอิง, ซีเรียล, ที่ตั้ง, ผู้ใช้งาน)"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 240 }} />
        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          🔄 รีเฟรช
        </button>
        {/* เพิ่มสินทรัพย์ dropdown 2 แบบ */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setAddMenuOpen(o => !o)}
            style={{ padding: "8px 20px", background: "#65a30d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
            เพิ่มสินทรัพย์ ▾
          </button>
          {addMenuOpen && (
            <div style={{ position: "absolute", right: 0, top: "110%", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 8px 20px rgba(0,0,0,0.15)", zIndex: 100, minWidth: 210 }}>
              <button onClick={() => openAdd("new")} style={ddItem}>📄 ซื้อสินทรัพย์มาใหม่</button>
              <button onClick={() => openAdd("carried")} style={{ ...ddItem, borderTop: "1px solid #f3f4f6" }}>➕ เพิ่มสินทรัพย์ยกมา</button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีสินทรัพย์ — กด "เพิ่มสินทรัพย์"</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>ชื่อสินทรัพย์/รหัส</th>
                <th style={th}>สังกัด</th>
                <th style={th}>หมวดหมู่สินทรัพย์</th>
                <th style={th}>เลขที่อ้างอิง</th>
                <th style={th}>วันที่เริ่มใช้งาน</th>
                <th style={{ ...th, textAlign: "right" }}>ราคาซื้อ</th>
                <th style={{ ...th, textAlign: "right" }} title="ราคาซื้อ − ค่าเสื่อมสะสมถึงวันนี้ (ต่ำสุด = มูลค่าซาก)">มูลค่าทางบัญชี ℹ️</th>
                <th style={th}>สถานะสินทรัพย์</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const st = stOf(r.status || "active");
                const d = calcDepreciation(r);
                return (
                  <tr key={r.asset_id} style={{ borderTop: "1px solid #e5e7eb", opacity: r.status === "retired" ? 0.6 : 1 }}>
                    <td style={{ ...td, minWidth: 200 }}>
                      <div style={{ fontWeight: 600, color: "#0369a1", cursor: "pointer" }} onClick={() => openEdit(r)} title="คลิกเพื่อดู/แก้ไข">
                        <span style={{ color: st.color, marginRight: 5 }}>●</span>{r.asset_name}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginLeft: 14 }}>{r.asset_code || "-"}{r.acquisition_type === "carried" ? " · ยกมา" : ""}</div>
                    </td>
                    <td style={td}>{r.affiliation ? (
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: r.affiliation === "ป.เปา" ? "#dbeafe" : "#fce7f3", color: r.affiliation === "ป.เปา" ? "#1e40af" : "#9d174d" }}>{r.affiliation}</span>
                    ) : "-"}</td>
                    <td style={td}>{r.category_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.reference_no || "-"}</td>
                    <td style={td}>{fmtDate(r.start_use_date)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.purchase_price)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{fmt(d.book)}</td>
                    <td style={td}>
                      <select value={r.status || "active"} onChange={e => changeStatus(r, e.target.value)}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + st.color, background: st.bg, color: st.color, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                      {r.status === "retired" && r.retired_date && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>เลิกใช้ {fmtDate(r.retired_date)}</div>}
                    </td>
                    <td style={td}><button onClick={() => openEdit(r)} style={btnEdit}>✏️ แก้ไข</button></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
              <tr>
                <td colSpan={5} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} รายการ</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(totals.price)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#0369a1" }}>{fmt(totals.book)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ===== ฟอร์มเพิ่ม/แก้ไขสินทรัพย์ (เต็มหน้าแบบ FlowAccount) ===== */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "#f1f5f9", zIndex: 1000, overflowY: "auto" }}>
          {/* Top bar */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
            <h2 style={{ margin: 0, color: "#0284c7", fontSize: 20 }}>
              {editTarget ? "✏️ แก้ไขสินทรัพย์" : form.acquisition_type === "carried" ? "➕ เพิ่มสินทรัพย์ยกมา" : "📄 เพิ่มสินทรัพย์ (ซื้อมาใหม่)"}
            </h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => !saving && setShowForm(false)} disabled={saving}
                style={{ padding: "8px 18px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>ปิดหน้าต่าง</button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: "8px 22px", background: saving ? "#9ca3af" : "#0284c7", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึกเอกสาร"}
              </button>
            </div>
          </div>

          <div style={{ maxWidth: 1200, margin: "16px auto", padding: "0 16px 40px" }}>
            {/* Header summary */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "16px 20px", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0284c7" }}>{form.asset_name || "ชื่อสินทรัพย์"}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  สถานะสินทรัพย์: <b style={{ color: stOf(form.status).color }}>{stOf(form.status).label}</b>
                  {form.enable_depreciation && Number(form.useful_life_years) > 0 && (
                    <span style={{ marginLeft: 10 }}>(ระยะเวลาที่ใช้งาน: {Math.round(Number(form.useful_life_years) * 12)} เดือน)</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 30, textAlign: "right" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>ราคาซื้อ</div>
                  <div style={{ fontSize: 22, fontFamily: "monospace" }}>{fmt(form.purchase_price)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>มูลค่าทางบัญชี</div>
                  <div style={{ fontSize: 22, fontFamily: "monospace", color: "#0284c7" }}>{fmt(fCalc.book)}</div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
              {/* ซ้าย: ข้อมูลพื้นฐาน + ค่าเสื่อม */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={card}>
                  <div style={cardTitle}>ข้อมูลสินทรัพย์พื้นฐาน</div>
                  <div style={fRow}><label style={fLbl}>สังกัด: *</label>
                    <select value={form.affiliation} onChange={e => setForm(f => ({ ...f, affiliation: e.target.value }))} style={inp}>
                      <option value="">-- เลือกสังกัด --</option>
                      {AFFILIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select></div>
                  <div style={fRow}><label style={fLbl}>รหัสสินทรัพย์:</label>
                    <input value={form.asset_code} onChange={e => setForm(f => ({ ...f, asset_code: e.target.value }))} style={inp} placeholder="เช่น 69-001" /></div>
                  <div style={fRow}><label style={fLbl}>ชื่อสินทรัพย์: *</label>
                    <input value={form.asset_name} onChange={e => setForm(f => ({ ...f, asset_name: e.target.value }))} style={inp} placeholder="กรุณาระบุชื่อสินทรัพย์" /></div>
                  <div style={fRow}><label style={fLbl}>รายละเอียดสินทรัพย์:</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical" }} /></div>
                  <div style={fRow}><label style={fLbl}>เลขที่เอกสารอ้างอิง:</label>
                    <input value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} placeholder="เช่น EXP2026040060" /></div>
                  <div style={fRow}><label style={fLbl}>หมวดหมู่สินทรัพย์: *</label>
                    <select value={form.category_id} onChange={e => onCategoryChange(e.target.value)} style={inp}>
                      <option value="">กรุณาเลือกหมวดหมู่สินทรัพย์</option>
                      {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                    </select></div>
                  <div style={fRow}><label style={fLbl}>จำนวน:</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="number" step="0.01" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} style={{ ...inp, textAlign: "right", flex: 1 }} />
                      <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={{ ...inp, width: 100 }} placeholder="หน่วย" />
                    </div></div>
                  <div style={fRow}><label style={fLbl}>วันที่ซื้อ:</label>
                    <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} style={inp} /></div>
                </div>

                <div style={card}>
                  <div style={cardTitle}>วิธีการคำนวณค่าเสื่อมราคาทางบัญชี</div>
                  <div style={fRow}><label style={fLbl}>วันที่เริ่มต้นใช้งาน: {form.enable_depreciation ? "*" : ""}</label>
                    <input type="date" value={form.start_use_date} onChange={e => setForm(f => ({ ...f, start_use_date: e.target.value }))} style={inp} /></div>
                  <div style={fRow}><label style={fLbl}>ราคาซื้อ:</label>
                    <input type="number" step="0.01" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} style={{ ...inp, textAlign: "right", fontFamily: "monospace" }} /></div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, margin: "2px 0 8px", cursor: "pointer", color: "#374151" }}>
                    <input type="checkbox" checked={form.enable_depreciation} onChange={e => setForm(f => ({ ...f, enable_depreciation: e.target.checked }))} />
                    คิดค่าเสื่อมราคาสินทรัพย์นี้
                  </label>
                  {form.enable_depreciation && (<>
                    <div style={fRow}><label style={fLbl} title="มูลค่าคงเหลือขั้นต่ำเมื่อคิดค่าเสื่อมครบ (ปกติ 1 บาท)">มูลค่าซาก: ℹ️</label>
                      <input type="number" step="0.01" value={form.salvage_value} onChange={e => setForm(f => ({ ...f, salvage_value: e.target.value }))} style={{ ...inp, textAlign: "right", fontFamily: "monospace" }} /></div>
                    <div style={fRow}><label style={fLbl}>มูลค่าที่คิดค่าเสื่อม:</label>
                      <input value={fmt(fDepBase)} readOnly disabled style={{ ...inp, background: "#f3f4f6", textAlign: "right", fontFamily: "monospace" }} /></div>
                    <div style={fRow}><label style={fLbl}>อายุการใช้งานทางบัญชี (ปี): *</label>
                      <input type="number" min="0.5" step="0.5" value={form.useful_life_years} onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))} style={{ ...inp, textAlign: "right" }} /></div>
                    <div style={fRow}><label style={fLbl}>คำนวณค่าเสื่อมต่อปี (%):</label>
                      <input value={fPct ? fPct.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%" : "0.00%"} readOnly disabled style={{ ...inp, background: "#f3f4f6", textAlign: "right" }} /></div>
                    <div style={fRow}><label style={fLbl}>ค่าเสื่อมที่คำนวณได้ต่อปี:</label>
                      <input value={fmt(fCalc.annual)} readOnly disabled style={{ ...inp, background: "#f3f4f6", textAlign: "right", fontFamily: "monospace", color: "#0284c7", fontWeight: 700 }} /></div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, margin: "4px 0", cursor: "pointer", color: "#374151" }}>
                      <input type="checkbox" checked={form.has_accum_bf} onChange={e => setForm(f => ({ ...f, has_accum_bf: e.target.checked }))} />
                      สินทรัพย์นี้มีค่าเสื่อมสะสมยกมา
                    </label>
                    {form.has_accum_bf && (<>
                      <div style={fRow}><label style={fLbl}>ค่าเสื่อมราคาสะสมยกมา:</label>
                        <input type="number" step="0.01" value={form.accum_bf_amount} onChange={e => setForm(f => ({ ...f, accum_bf_amount: e.target.value }))} style={{ ...inp, textAlign: "right", fontFamily: "monospace" }} /></div>
                      <div style={fRow}><label style={fLbl} title="คิดค่าเสื่อมต่อจากยอดยกมา นับจากวันนี้เป็นต้นไป">ยกมา ณ วันที่: ℹ️</label>
                        <input type="date" value={form.accum_bf_date} onChange={e => setForm(f => ({ ...f, accum_bf_date: e.target.value }))} style={inp} /></div>
                      <div style={fRow}><label style={fLbl}>มูลค่าตามบัญชียกมา:</label>
                        <input value={fmt(Math.max(0, (Number(form.purchase_price) || 0) - (Number(form.accum_bf_amount) || 0)))} readOnly disabled style={{ ...inp, background: "#f3f4f6", textAlign: "right", fontFamily: "monospace" }} /></div>
                    </>)}
                  </>)}
                </div>
              </div>

              {/* ขวา: ข้อมูลอื่นๆ + เพิ่มเติม + สถานะ */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={card}>
                  <div style={cardTitle}>ข้อมูลอื่นๆ</div>
                  <div style={fRow}><label style={fLbl}>ชื่อผู้จำหน่าย:</label>
                    <input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} style={inp} /></div>
                  <div style={fRow}><label style={fLbl}>หมายเลขซีเรียล:</label>
                    <input value={form.serial_no} onChange={e => setForm(f => ({ ...f, serial_no: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} /></div>
                  <div style={fRow}><label style={fLbl}>วันหมดอายุประกัน:</label>
                    <input type="date" value={form.warranty_expire_date} onChange={e => setForm(f => ({ ...f, warranty_expire_date: e.target.value }))} style={inp} /></div>
                  <div style={fRow}><label style={fLbl}>ที่ตั้งสินทรัพย์:</label>
                    <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inp} placeholder="เช่น สาขาวังน้อย ชั้น 2" /></div>
                  <div style={fRow}><label style={fLbl}>ผู้ใช้งาน:</label>
                    <input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} style={inp} /></div>
                </div>

                <div style={card}>
                  <div style={cardTitle}>ข้อมูลเพิ่มเติม</div>
                  <div style={fRow}><label style={fLbl}>โน้ต:</label>
                    <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={4} style={{ ...inp, resize: "vertical" }} /></div>
                </div>

                {editTarget && (
                  <div style={card}>
                    <div style={cardTitle}>สถานะสินทรัพย์</div>
                    <div style={fRow}><label style={fLbl}>สถานะ:</label>
                      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                        {STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select></div>
                    {form.status === "retired" && (
                      <div style={fRow}><label style={fLbl}>วันที่เลิกใช้:</label>
                        <input type="date" value={form.retired_date} onChange={e => setForm(f => ({ ...f, retired_date: e.target.value }))} style={inp} /></div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const card = { background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 18px" };
const cardTitle = { fontSize: 14, fontWeight: 700, color: "#0284c7", borderBottom: "1px solid #e5e7eb", paddingBottom: 8, marginBottom: 12 };
const fRow = { display: "grid", gridTemplateColumns: "170px 1fr", gap: 8, alignItems: "center", marginBottom: 8 };
const fLbl = { fontSize: 13, fontWeight: 600, color: "#374151" };
const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box", width: "100%" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "10px 8px", fontSize: 13 };
const btnEdit = { padding: "4px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" };
const ddItem = { display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" };
