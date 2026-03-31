import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

export default function MotoPriceCheckPage({ currentUser }) {
  const [priceTypes, setPriceTypes] = useState([]);
  const [motoTypes, setMotoTypes] = useState([]);
  const [localPrices, setLocalPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [filterBrand, setFilterBrand] = useState("");
  const [filterMarketing, setFilterMarketing] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterType, setFilterType] = useState("");

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
      (Array.isArray(data) ? data : []).forEach(p => {
        const key = `${p.type_id}|${p.price_type_id}`;
        map[key] = String(p.amount ?? "");
      });
      setLocalPrices(map);
    } catch { /* ignore */ }
    setLoading(false);
  }

  const activeTypes = priceTypes.filter(t => t.status === "active");

  // Cascade filter options
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
            <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setFilterMarketing(""); setFilterModel(""); setFilterType(""); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, minWidth: 140 }}>
              <option value="">ยี่ห้อ ทั้งหมด</option>
              {brandOpts.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={filterMarketing} onChange={e => { setFilterMarketing(e.target.value); setFilterModel(""); setFilterType(""); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, minWidth: 140 }}>
              <option value="">รุ่น ทั้งหมด</option>
              {marketingOpts.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filterModel} onChange={e => { setFilterModel(e.target.value); setFilterType(""); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, minWidth: 140 }}>
              <option value="">แบบ ทั้งหมด</option>
              {modelOpts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
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
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5 + activeTypes.length} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                ) : filteredRows.map((row, idx) => (
                  <tr key={row.type_id}>
                    <td style={{ textAlign: "center" }}>{idx + 1}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
