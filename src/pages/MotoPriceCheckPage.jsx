import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

export default function MotoPriceCheckPage({ currentUser }) {
  const [priceTypes, setPriceTypes] = useState([]);
  const [motoTypes, setMotoTypes] = useState([]);
  const [localPrices, setLocalPrices] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterBrand, setFilterBrand] = useState("");
  const [filterVehicleType, setFilterVehicleType] = useState("");
  const [filterMarketing, setFilterMarketing] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterType, setFilterType] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const [motoSeries, setMotoSeries] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);

  useEffect(() => {
    fetchPriceTypes();
    fetchMotoTypes();
    fetchExpenses();
    fetchMotoSeries();
    fetchVehicleTypes();
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
      const list = Array.isArray(data) ? data.filter(m =>
        m.status === "active" &&
        m.model_status === "active" &&
        m.series_status === "active" &&
        m.brand_status === "active"
      ) : [];
      setMotoTypes(list);
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
      (Array.isArray(data) ? data : []).forEach(p => {
        const key = `${p.type_id}|${p.price_type_id}`;
        map[key] = String(p.amount ?? "");
      });
      setLocalPrices(map);
    } catch { /* ignore */ }
    setLoading(false);
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

  async function fetchVehicleTypes() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_vehicle_types" }),
      });
      const data = await res.json();
      setVehicleTypes(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }

  async function fetchExpenses() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_sale_expenses" }),
      });
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data.filter(e => e.status === "active") : []);
    } catch { /* ignore */ }
  }

  function getRowCC(row) {
    const series = motoSeries.find(s => String(s.series_id) === String(row.series_id));
    return series ? Number(series.engine_cc) : null;
  }

  function getRelatedExpenses(row) {
    if (!row) return [];
    const rowCC = getRowCC(row);
    return expenses.filter(e => {
      if (e.group_by === "cc" && rowCC && Number(e.engine_cc) === rowCC) return true;
      if (e.group_by === "brand" && row.brand_id && String(e.brand_id) === String(row.brand_id)) return true;
      if (e.group_by === "type" && row.type_id && String(e.type_id) === String(row.type_id)) return true;
      return false;
    });
  }

  const activeTypes = priceTypes.filter(t => t.status === "active");

  // lookup vehicle_type_name จาก series
  function getVehicleTypeName(m) {
    const s = motoSeries.find(s => s.series_id === m.series_id);
    if (!s || !s.vehicle_type_id) return "";
    const vt = vehicleTypes.find(v => v.vehicle_type_id === s.vehicle_type_id);
    return vt ? vt.vehicle_type_name : "";
  }

  const brandOpts = [...new Set(motoTypes.map(m => m.brand_name).filter(Boolean))].sort();
  const vehicleTypeOpts = [...new Set(vehicleTypes.map(v => v.vehicle_type_name).filter(Boolean))].sort();
  const marketingOpts = [...new Set(
    motoTypes.filter(m => !filterBrand || m.brand_name === filterBrand)
      .filter(m => !filterVehicleType || getVehicleTypeName(m) === filterVehicleType)
      .map(m => m.marketing_name || m.series_name).filter(Boolean)
  )].sort();
  const modelOpts = [...new Set(
    motoTypes
      .filter(m => (!filterBrand || m.brand_name === filterBrand) && (!filterMarketing || (m.marketing_name || m.series_name) === filterMarketing))
      .map(m => m.model_code).filter(Boolean)
  )].sort();
  const typeOpts = [...new Set(
    motoTypes
      .filter(m =>
        (!filterBrand || m.brand_name === filterBrand) &&
        (!filterMarketing || (m.marketing_name || m.series_name) === filterMarketing) &&
        (!filterModel || m.model_code === filterModel)
      )
      .map(m => m.type_name).filter(Boolean)
  )].sort();

  const filteredRows = motoTypes.filter(m =>
    (!filterBrand || m.brand_name === filterBrand) &&
    (!filterVehicleType || getVehicleTypeName(m) === filterVehicleType) &&
    (!filterMarketing || (m.marketing_name || m.series_name) === filterMarketing) &&
    (!filterModel || m.model_code === filterModel) &&
    (!filterType || m.type_name === filterType)
  );

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💲 ตรวจสอบราคารถ</h2>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : activeTypes.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>ยังไม่มีข้อมูลราคา</div>
      ) : (
        <div>
          {/* Cascade Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setFilterVehicleType(""); setFilterMarketing(""); setFilterModel(""); setFilterType(""); setCurrentPage(1); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, minWidth: 140 }}>
              <option value="">ยี่ห้อ ทั้งหมด</option>
              {brandOpts.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={filterVehicleType} onChange={e => { setFilterVehicleType(e.target.value); setFilterMarketing(""); setFilterModel(""); setFilterType(""); setCurrentPage(1); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, minWidth: 140 }}>
              <option value="">ประเภทรถ ทั้งหมด</option>
              {vehicleTypeOpts.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={filterMarketing} onChange={e => { setFilterMarketing(e.target.value); setFilterModel(""); setFilterType(""); setCurrentPage(1); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, minWidth: 140 }}>
              <option value="">รุ่น ทั้งหมด</option>
              {marketingOpts.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filterModel} onChange={e => { setFilterModel(e.target.value); setFilterType(""); setCurrentPage(1); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, minWidth: 140 }}>
              <option value="">แบบ ทั้งหมด</option>
              {modelOpts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, minWidth: 140 }}>
              <option value="">type ทั้งหมด</option>
              {typeOpts.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(filterBrand || filterMarketing || filterModel || filterType) && (
              <button onClick={() => { setFilterBrand(""); setFilterMarketing(""); setFilterModel(""); setFilterType(""); }}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
                ✕ ล้างตัวกรอง
              </button>
            )}
            <span style={{ fontSize: 13, color: "#6b7280", marginLeft: "auto" }}>
              {filteredRows.length} รายการ
            </span>
          </div>

          {/* Price Table */}
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>ยี่ห้อ</th>
                  <th>รุ่น</th>
                  <th>แบบ</th>
                  <th>type</th>
                  {activeTypes.map(t => (
                    <th key={t.type_id} style={{ whiteSpace: "nowrap", textAlign: "right" }}>{t.type_name}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6 + activeTypes.length} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                ) : filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, idx) => (
                  <tr key={row.type_id}
                    style={{ cursor: "pointer", background: selectedRow?.type_id === row.type_id ? "#eff6ff" : undefined }}
                    onClick={() => setSelectedRow(selectedRow?.type_id === row.type_id ? null : row)}>
                    <td style={{ textAlign: "center" }}>{(currentPage - 1) * pageSize + idx + 1}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.brand_name || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.marketing_name || row.series_name || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.model_code || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.type_name || "-"}</td>
                    {activeTypes.map(t => {
                      const key = `${row.type_id}|${t.type_id}`;
                      const val = localPrices[key] ? Number(localPrices[key]) : 0;
                      return (
                        <td key={t.type_id} style={{ textAlign: "right", padding: "6px 10px", fontWeight: val > 0 ? 600 : 400 }}>
                          <span style={{ color: val > 0 ? "#111827" : "#d1d5db" }}>
                            {val > 0 ? val.toLocaleString() : "-"}
                          </span>
                        </td>
                      );
                    })}
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedRow(selectedRow?.type_id === row.type_id ? null : row); }}
                        style={{ padding: "3px 10px", background: selectedRow?.type_id === row.type_id ? "#072d6b" : "#e2e8f0", color: selectedRow?.type_id === row.type_id ? "#fff" : "#475569", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "Tahoma" }}>
                        {selectedRow?.type_id === row.type_id ? "ปิด" : "ดูค่าใช้จ่าย"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRows.length > pageSize && (() => {
              const totalPages = Math.ceil(filteredRows.length / pageSize);
              return (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, padding: "14px 0", flexWrap: "wrap" }}>
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                    style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: currentPage === 1 ? "#f3f4f6" : "#fff", cursor: currentPage === 1 ? "default" : "pointer", fontSize: 13, fontFamily: "Tahoma", color: "#374151" }}>{"<<"}</button>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: currentPage === 1 ? "#f3f4f6" : "#fff", cursor: currentPage === 1 ? "default" : "pointer", fontSize: 13, fontFamily: "Tahoma", color: "#374151" }}>{"<"}</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                    .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
                    .map((p, i) =>
                      p === "..." ? <span key={`dot-${i}`} style={{ padding: "4px 6px", fontSize: 13, color: "#9ca3af" }}>...</span> :
                      <button key={p} onClick={() => setCurrentPage(p)}
                        style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: currentPage === p ? "#072d6b" : "#fff", color: currentPage === p ? "#fff" : "#374151", cursor: "pointer", fontSize: 13, fontFamily: "Tahoma", fontWeight: currentPage === p ? 700 : 400 }}>{p}</button>
                    )}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: currentPage === totalPages ? "#f3f4f6" : "#fff", cursor: currentPage === totalPages ? "default" : "pointer", fontSize: 13, fontFamily: "Tahoma", color: "#374151" }}>{">"}</button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                    style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: currentPage === totalPages ? "#f3f4f6" : "#fff", cursor: currentPage === totalPages ? "default" : "pointer", fontSize: 13, fontFamily: "Tahoma", color: "#374151" }}>{">>"}</button>
                  <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>หน้า {currentPage}/{totalPages} ({filteredRows.length} รายการ)</span>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Expense Popup */}
      {selectedRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setSelectedRow(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 600, maxWidth: "95vw", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: "#072d6b" }}>
              ค่าใช้จ่ายที่เกี่ยวข้อง
            </h3>
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, fontSize: 14 }}>
              <strong>{selectedRow.brand_name}</strong> — {selectedRow.marketing_name || selectedRow.series_name} — {selectedRow.model_code} — {selectedRow.type_name}
            </div>

            {/* ค่าใช้จ่ายคงที่ */}
            {(() => {
              const related = getRelatedExpenses(selectedRow);
              const fixedExpenses = related.filter(e => e.expense_type === "fixed");
              const promoExpenses = related.filter(e => e.expense_type === "promotion");
              return <>
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ margin: "0 0 8px", color: "#1e40af", fontSize: 14 }}>📋 ค่าใช้จ่ายคงที่ (เรียกเก็บลูกค้า)</h4>
                  {fixedExpenses.length === 0 ? (
                    <div style={{ color: "#9ca3af", fontSize: 13, padding: 8 }}>ไม่มีค่าใช้จ่ายคงที่</div>
                  ) : (
                    <table className="data-table" style={{ fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>รายการ</th>
                          <th>กลุ่ม</th>
                          <th style={{ textAlign: "right" }}>จำนวนเงิน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fixedExpenses.map(e => (
                          <tr key={e.expense_id}>
                            <td>{e.expense_name}</td>
                            <td style={{ fontSize: 12, color: "#6b7280" }}>
                              {e.group_by === "cc" ? "CC " + e.engine_cc : e.group_by === "brand" ? e.brand_name : e.group_by === "type" ? e.type_name : "-"}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>{Number(e.amount).toLocaleString()} บาท</td>
                          </tr>
                        ))}
                        <tr style={{ background: "#f0f9ff" }}>
                          <td colSpan={2} style={{ fontWeight: 700, textAlign: "right" }}>รวมค่าใช้จ่ายคงที่</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#1e40af" }}>
                            {fixedExpenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString()} บาท
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ margin: "0 0 8px", color: "#86198f", fontSize: 14 }}>🎁 ค่าใช้จ่ายโปรโมชั่น (จ่ายแทนลูกค้า)</h4>
                  {promoExpenses.length === 0 ? (
                    <div style={{ color: "#9ca3af", fontSize: 13, padding: 8 }}>ไม่มีค่าใช้จ่ายโปรโมชั่น</div>
                  ) : (
                    <table className="data-table" style={{ fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>รายการ</th>
                          <th>กลุ่ม</th>
                          <th style={{ textAlign: "right" }}>จำนวนเงิน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promoExpenses.map(e => (
                          <tr key={e.expense_id}>
                            <td>{e.expense_name}</td>
                            <td style={{ fontSize: 12, color: "#6b7280" }}>
                              {e.group_by === "cc" ? "CC " + e.engine_cc : e.group_by === "brand" ? e.brand_name : e.group_by === "type" ? e.type_name : "-"}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>{Number(e.amount).toLocaleString()} บาท</td>
                          </tr>
                        ))}
                        <tr style={{ background: "#fdf4ff" }}>
                          <td colSpan={2} style={{ fontWeight: 700, textAlign: "right" }}>รวมค่าใช้จ่ายโปรโมชั่น</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#86198f" }}>
                            {promoExpenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString()} บาท
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              </>;
            })()}

            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button onClick={() => setSelectedRow(null)}
                style={{ padding: "8px 24px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 14 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
