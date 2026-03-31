import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

export default function MotoPricePage({ currentUser }) {
  const [tab, setTab] = useState("price"); // price | types
  const [priceTypes, setPriceTypes] = useState([]);
  const [motoTypes, setMotoTypes] = useState([]); // moto_types with hierarchy
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  // localPrices: { "type_id|price_type_id": value_string }
  const [localPrices, setLocalPrices] = useState({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState({});
  const [savingRow, setSavingRow] = useState(null); // type_id being saved
  const [editingRow, setEditingRow] = useState(null); // type_id in edit mode
  const [editRowPrices, setEditRowPrices] = useState({});
  const [filterBrand, setFilterBrand] = useState("");
  const [filterMarketing, setFilterMarketing] = useState("");
  const [filterModel, setFilterModel] = useState("");

  // price type form
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeForm, setTypeForm] = useState({ type_name: "", sort_order: 0, status: "active" });
  const [editTypeTarget, setEditTypeTarget] = useState(null);

  useEffect(() => {
    fetchPriceTypes();
    fetchMotoTypes();
  }, []);

  useEffect(() => {
    if (motoTypes.length > 0 && priceTypes.length > 0) fetchPrices();
  }, [motoTypes, priceTypes]);

  async function fetchPriceTypes() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_price_types" }),
      });
      const data = await res.json();
      setPriceTypes(Array.isArray(data) ? data : []);
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

  async function fetchPrices() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_moto_prices" }),
      });
      const data = await res.json();
      const map = {};
      const dateMap = {};
      (Array.isArray(data) ? data : []).forEach(p => {
        const key = `${p.type_id}|${p.price_type_id}`;
        map[key] = String(p.amount ?? "");
        if (p.updated_at) dateMap[key] = p.updated_at;
      });
      setLocalPrices(map);
      setPriceUpdatedAt(dateMap);
    } catch { setMessage("โหลดข้อมูลราคาไม่สำเร็จ"); }
    setLoading(false);
  }

  function handleStartEdit(row) {
    const snapshot = {};
    activeTypes.forEach(t => {
      const key = `${row.type_id}|${t.type_id}`;
      snapshot[key] = localPrices[key] ?? "";
    });
    setEditRowPrices(snapshot);
    setEditingRow(row.type_id);
    setMessage("");
  }

  function handleCancelEdit() {
    setEditingRow(null);
    setEditRowPrices({});
  }

  async function handleSaveRow(row) {
    setSavingRow(row.type_id);
    setMessage("");
    try {
      await Promise.all(activeTypes.map(async t => {
        const key = `${row.type_id}|${t.type_id}`;
        const value = editRowPrices[key] ?? "";
        const res = await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_moto_price",
            type_id: row.type_id,
            price_type_id: t.type_id,
            amount: value === "" ? 0 : Number(value),
          }),
        });
        const saved = await res.json().catch(() => ({}));
        const now = saved.updated_at || new Date().toISOString();
        setLocalPrices(prev => ({ ...prev, [key]: value }));
        setPriceUpdatedAt(prev => ({ ...prev, [key]: now }));
      }));
      setEditingRow(null);
      setEditRowPrices({});
    } catch { setMessage("บันทึกไม่สำเร็จ"); }
    setSavingRow(null);
  }

  function getTypeUpdatedAt(type_id) {
    const dates = activeTypes
      .map(t => priceUpdatedAt[`${type_id}|${t.type_id}`])
      .filter(Boolean);
    if (!dates.length) return null;
    return dates.reduce((a, b) => (a > b ? a : b));
  }

  async function handleSaveType() {
    if (!typeForm.type_name.trim()) { setMessage("กรุณากรอกชื่อระดับราคา"); return; }
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editTypeTarget ? "update_price_type" : "save_price_type",
          ...(editTypeTarget ? { type_id: editTypeTarget.type_id } : {}),
          ...typeForm,
        }),
      });
      setShowTypeForm(false);
      setEditTypeTarget(null);
      setTypeForm({ type_name: "", sort_order: 0, status: "active" });
      fetchPriceTypes();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  function openEditType(t) {
    setEditTypeTarget(t);
    setTypeForm({ type_name: t.type_name, sort_order: t.sort_order || 0, status: t.status || "active" });
    setShowTypeForm(true);
    setMessage("");
  }

  const activeTypes = priceTypes.filter(t => t.status === "active");

  const brandOpts = [...new Set(motoTypes.map(m => m.brand_name).filter(Boolean))].sort();
  const marketingOpts = [...new Set(
    motoTypes.filter(m => !filterBrand || m.brand_name === filterBrand)
      .map(m => m.marketing_name || m.series_name).filter(Boolean)
  )].sort();
  const modelOpts = [...new Set(
    motoTypes
      .filter(m => (!filterBrand || m.brand_name === filterBrand) && (!filterMarketing || (m.marketing_name || m.series_name) === filterMarketing))
      .map(m => m.model_code).filter(Boolean)
  )].sort();

  const filteredRows = motoTypes.filter(m =>
    (!filterBrand || m.brand_name === filterBrand) &&
    (!filterMarketing || (m.marketing_name || m.series_name) === filterMarketing) &&
    (!filterModel || m.model_code === filterModel)
  );

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 บันทึกราคาขาย</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={tab === "price" ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab("price")}
          >ตารางราคา</button>
          <button
            className={tab === "types" ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab("types")}
          >ระดับราคา</button>
        </div>
      </div>

      {message && (
        <div style={{ color: "#ef4444", marginBottom: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>{message}</div>
      )}

      {/* TAB: ระดับราคา */}
      {tab === "types" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn-primary" onClick={() => { setEditTypeTarget(null); setTypeForm({ type_name: "", sort_order: 0, status: "active" }); setShowTypeForm(true); setMessage(""); }}>
              + เพิ่มระดับราคา
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>ชื่อระดับราคา</th><th>ลำดับ</th><th>สถานะ</th><th>จัดการ</th></tr>
              </thead>
              <tbody>
                {priceTypes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>ยังไม่มีระดับราคา</td></tr>
                ) : priceTypes.map((t, i) => (
                  <tr key={t.type_id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{t.type_name}</td>
                    <td>{t.sort_order}</td>
                    <td>
                      <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12,
                        background: t.status === "active" ? "#d1fae5" : "#f3f4f6",
                        color: t.status === "active" ? "#065f46" : "#6b7280" }}>
                        {t.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => openEditType(t)}
                        style={{ padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
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

      {/* TAB: ตารางราคา */}
      {tab === "price" && (
        <div>
          {activeTypes.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
              ยังไม่มีระดับราคา กรุณาเพิ่มระดับราคาก่อน (แท็บ "ระดับราคา")
            </div>
          ) : loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setFilterMarketing(""); setFilterModel(""); }}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}>
                  <option value="">-- ยี่ห้อ ทั้งหมด --</option>
                  {brandOpts.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={filterMarketing} onChange={e => { setFilterMarketing(e.target.value); setFilterModel(""); }}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}>
                  <option value="">-- รุ่น ทั้งหมด --</option>
                  {marketingOpts.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={filterModel} onChange={e => setFilterModel(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}>
                  <option value="">-- แบบ ทั้งหมด --</option>
                  {modelOpts.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {(filterBrand || filterMarketing || filterModel) && (
                  <button onClick={() => { setFilterBrand(""); setFilterMarketing(""); setFilterModel(""); }}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#e5e7eb", cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
                    ✕ ล้าง
                  </button>
                )}
                <span style={{ fontSize: 12, color: "#6b7280", marginLeft: "auto" }}>
                  💡 กดปุ่ม แก้ไข เพื่อแก้ไขราคา แล้วกด บันทึก
                </span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ยี่ห้อ</th>
                    <th>รุ่น</th>
                    <th>แบบ</th>
                    <th>type</th>
                    {activeTypes.map(t => <th key={t.type_id} style={{ whiteSpace: "nowrap" }}>{t.type_name}</th>)}
                    <th style={{ whiteSpace: "nowrap" }}>วันที่แก้ไข</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr><td colSpan={6 + activeTypes.length} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>ไม่พบข้อมูล</td></tr>
                  ) : filteredRows.map(row => {
                    const isSavingRow = savingRow === row.type_id;
                    const isEditing = editingRow === row.type_id;
                    const latestDate = getTypeUpdatedAt(row.type_id);
                    const dateLabel = latestDate
                      ? new Date(latestDate).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
                      : "-";
                    return (
                      <tr key={row.type_id} style={{ background: isEditing ? "#fffbeb" : isSavingRow ? "#f0f0ff" : undefined }}>
                        <td style={{ whiteSpace: "nowrap" }}>{row.brand_name || "-"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{row.marketing_name || row.series_name || "-"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{row.model_code || "-"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{row.type_name || "-"}</td>
                        {activeTypes.map(t => {
                          const key = `${row.type_id}|${t.type_id}`;
                          const displayVal = localPrices[key] ? Number(localPrices[key]).toLocaleString() : "-";
                          return (
                            <td key={t.type_id} style={{ padding: "4px 8px", textAlign: "right" }}>
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editRowPrices[key] ?? ""}
                                  onChange={e => setEditRowPrices(prev => ({ ...prev, [key]: e.target.value }))}
                                  style={{
                                    width: 110, padding: "4px 8px",
                                    border: "1.5px solid #f59e0b",
                                    borderRadius: 6, fontFamily: "Tahoma", fontSize: 13,
                                    textAlign: "right", background: "#fff",
                                  }}
                                  placeholder="0"
                                  disabled={isSavingRow}
                                  autoFocus={t === activeTypes[0]}
                                />
                              ) : (
                                <span style={{ fontSize: 13, color: localPrices[key] && Number(localPrices[key]) > 0 ? "#111827" : "#9ca3af" }}>
                                  {displayVal}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "#6b7280", textAlign: "center" }}>
                          {dateLabel}
                        </td>
                        <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => handleSaveRow(row)}
                                disabled={isSavingRow}
                                style={{
                                  padding: "4px 12px", background: isSavingRow ? "#9ca3af" : "#072d6b",
                                  color: "#fff", border: "none", borderRadius: 6,
                                  cursor: isSavingRow ? "not-allowed" : "pointer",
                                  fontFamily: "Tahoma", fontSize: 13,
                                }}>
                                {isSavingRow ? "..." : "บันทึก"}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSavingRow}
                                style={{
                                  padding: "4px 10px", background: "#e5e7eb",
                                  color: "#374151", border: "none", borderRadius: 6,
                                  cursor: "pointer", fontFamily: "Tahoma", fontSize: 13,
                                }}>
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(row)}
                              disabled={!!editingRow}
                              style={{
                                padding: "4px 12px", background: editingRow ? "#e5e7eb" : "#f59e0b",
                                color: editingRow ? "#9ca3af" : "#fff", border: "none", borderRadius: 6,
                                cursor: editingRow ? "not-allowed" : "pointer",
                                fontFamily: "Tahoma", fontSize: 13,
                              }}>
                              แก้ไข
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Price Type Form Modal */}
      {showTypeForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0 }}>{editTypeTarget ? "แก้ไขระดับราคา" : "เพิ่มระดับราคา"}</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>ชื่อระดับราคา *</label>
              <input value={typeForm.type_name} onChange={e => setTypeForm({ ...typeForm, type_name: e.target.value })}
                placeholder="เช่น ราคาเงินสด, ราคาไฟแนนท์ 1"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>ลำดับ</label>
              <input type="number" value={typeForm.sort_order} onChange={e => setTypeForm({ ...typeForm, sort_order: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>สถานะ</label>
              <div style={{ display: "flex", gap: 20 }}>
                {[["active", "ใช้งาน"], ["inactive", "ไม่ใช้งาน"]].map(([val, label]) => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: "normal" }}>
                    <input type="radio" name="typeStatus" value={val} checked={typeForm.status === val}
                      onChange={() => setTypeForm({ ...typeForm, status: val })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {message && <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}>{message}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSaveType} disabled={saving}
                style={{ flex: 1, padding: "9px 0", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button onClick={() => { setShowTypeForm(false); setMessage(""); }}
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
