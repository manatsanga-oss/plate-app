import React, { useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

export default function SearchReceiptWorkPage({ currentUser }) {
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");

  async function search() {
    const kw = keyword.trim();
    if (!kw) { setMessage("กรอกคำค้นหาก่อน"); return; }
    setLoading(true); setSearched(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search_receipt_work", keyword: kw }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      if (!Array.isArray(data) || data.length === 0) {
        setMessage("ไม่พบรายการ");
      }
    } catch {
      setMessage("ค้นหาไม่สำเร็จ");
      setRows([]);
    }
    setLoading(false);
  }

  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
  }

  function statusBadge(s) {
    const map = {
      returned:      { label: "✅ ส่งคืนค่าทะเบียนลูกค้าแล้ว", bg: "#dcfce7", color: "#065f46" },
      received_back: { label: "📥 รับคืนงานทะเบียนจากขนส่ง",   bg: "#dbeafe", color: "#1e40af" },
      submitted:     { label: "🚚 ส่งงานทะเบียนดำเนินการ",       bg: "#fef3c7", color: "#92400e" },
      pending:       { label: "⏳ รอส่งงานทะเบียน",              bg: "#fee2e2", color: "#991b1b" },
    };
    const x = map[s] || { label: s || "-", bg: "#f3f4f6", color: "#374151" };
    return <span style={{ display: "inline-block", padding: "4px 12px", background: x.bg, color: x.color, borderRadius: 12, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{x.label}</span>;
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🔍 ค้นหางานทะเบียนรับเรื่อง</h2>
      </div>

      {/* Search box */}
      <div style={{ padding: "16px 18px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            placeholder="🔍 ค้นหา: ชื่อลูกค้า / เลขเครื่อง / เลขตัวถัง / ทะเบียน / เลขที่รับเรื่อง"
            style={{ flex: 1, minWidth: 280, padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }} />
          <button onClick={search} disabled={loading}
            style={{ padding: "10px 22px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600 }}>
            {loading ? "..." : "🔍 ค้นหา"}
          </button>
        </div>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: "#fef3c7", color: "#92400e", textAlign: "center" }}>
          {message}
        </div>
      )}

      {/* Results */}
      {searched && rows.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", fontSize: 13, fontWeight: 600 }}>
            พบ {rows.length} รายการ
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f3f4f6" }}>
                <tr>
                  <th style={th}>เลขที่รับเรื่อง</th>
                  <th style={th}>วันที่รับเรื่อง</th>
                  <th style={th}>ลูกค้า</th>
                  <th style={th}>เลขถัง</th>
                  <th style={th}>เลขเครื่อง</th>
                  <th style={th}>ทะเบียน</th>
                  <th style={th}>ยี่ห้อ/รุ่น</th>
                  <th style={th}>สาขา</th>
                  <th style={th}>รายการที่ทำ</th>
                  <th style={th}>เลข batch</th>
                  <th style={th}>สถานะงาน</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  let items = [];
                  try { items = Array.isArray(r.work_items) ? r.work_items : (typeof r.work_items === "string" ? JSON.parse(r.work_items) : []); } catch {}
                  return (
                  <tr key={r.receipt_no + "-" + i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#0369a1" }}>{r.receipt_no || "-"}</td>
                    <td style={td}>{fmtDate(r.receive_date)}</td>
                    <td style={td}>{r.customer_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.engine_no || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.plate_number || "-"}</td>
                    <td style={{ ...td, fontSize: 12 }}>
                      {r.brand && <div>{r.brand}</div>}
                      {r.model_series && <div style={{ fontSize: 11, color: "#6b7280" }}>{r.model_series}</div>}
                    </td>
                    <td style={td}>{r.branch_name || r.branch_code || "-"}</td>
                    <td style={{ ...td, fontSize: 11, minWidth: 200 }}>
                      {items.length === 0 ? <span style={{ color: "#9ca3af" }}>-</span> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {items.map((it, idx) => (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                              <span style={{ color: "#374151" }}>• {it.income_name || it.description || it.income_type}</span>
                              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#059669", whiteSpace: "nowrap" }}>{Number(it.net_price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                          {Number(r.work_total || 0) > 0 && (
                            <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 2, paddingTop: 2, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                              <span>รวม</span>
                              <span style={{ fontFamily: "monospace", color: "#dc2626" }}>{Number(r.work_total || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>
                      {r.batch_codes && r.batch_codes.length > 0
                        ? r.batch_codes.map(b => <div key={b} style={{ color: "#7c3aed" }}>{b}</div>)
                        : <span style={{ color: "#9ca3af" }}>-</span>}
                    </td>
                    <td style={td}>{statusBadge(r.work_status)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!searched && (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          กรอกคำค้นหาแล้วกด "ค้นหา"
        </div>
      )}
    </div>
  );
}

const th = { padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 12, color: "#374151" };
const td = { padding: "8px 12px", fontSize: 12, color: "#1f2937" };
