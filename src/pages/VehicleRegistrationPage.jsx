import React, { useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

export default function VehicleRegistrationPage({ currentUser }) {
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  async function handleSearch(e) {
    if (e) e.preventDefault();
    const kw = keyword.trim();
    if (!kw) {
      setRows([]);
      setSearched(true);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search_registrations", field: "all", keyword: kw }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : data.rows || []);
      setPage(1);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  function clearSearch() {
    setKeyword("");
    setRows([]);
    setSearched(false);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🚗 ทะเบียนรถ</h2>
      </div>

      <form onSubmit={handleSearch}
        style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16, padding: "14px 16px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="🔍 ค้นหา: ชื่อลูกค้า / เลขเครื่อง / เลขตัวถัง / ทะเบียน / เลขที่ใบขาย"
          style={{ flex: 1, minWidth: 280, padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }} />
        <button type="submit" disabled={loading}
          style={{ padding: "8px 20px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600, opacity: loading ? 0.6 : 1 }}>
          🔍 {loading ? "กำลังค้นหา..." : "ค้นหา"}
        </button>
        {(keyword || searched) && (
          <button type="button" onClick={clearSearch}
            style={{ padding: "8px 14px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 13 }}>
            ✕ ล้าง
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>
          {searched ? `พบ ${rows.length.toLocaleString()} รายการ` : ""}
        </span>
      </form>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : !searched ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          พิมพ์คำค้นหาแล้วกด 🔍 ค้นหา
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          ไม่พบข้อมูลที่ตรงกับคำค้นหา
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>เลขที่ใบขาย</th>
                <th>วันที่</th>
                <th>ลูกค้า</th>
                <th>รุ่น</th>
                <th>สี</th>
                <th>เลขเครื่อง</th>
                <th>เลขถัง (VIN)</th>
                <th>หมวด</th>
                <th>เลขทะเบียน</th>
                <th>จังหวัด</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={r.registration_id}>
                  <td style={{ textAlign: "center" }}>{(page - 1) * pageSize + idx + 1}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.sale_doc_no || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.sale_date)}</td>
                  <td>{r.customer_name || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.model || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.color || "-"}</td>
                  <td style={{ whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 13 }}>{r.engine_no || "-"}</td>
                  <td style={{ whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 13 }}>{r.frame_no || "-"}</td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "center" }}>{r.plate_category || "-"}</td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "center", fontWeight: 600 }}>{r.plate_number || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.plate_province || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "16px 0" }}>
              <button onClick={() => setPage(1)} disabled={page === 1}
                style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: page === 1 ? "#f3f4f6" : "#fff", cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>{"<<"}</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: page === 1 ? "#f3f4f6" : "#fff", cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>{"<"}</button>
              <span style={{ fontSize: 13, color: "#374151", padding: "0 10px" }}>หน้า {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: page === totalPages ? "#f3f4f6" : "#fff", cursor: page === totalPages ? "default" : "pointer", fontSize: 13 }}>{">"}</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: page === totalPages ? "#f3f4f6" : "#fff", cursor: page === totalPages ? "default" : "pointer", fontSize: 13 }}>{">>"}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(d) {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return String(d);
  }
}
