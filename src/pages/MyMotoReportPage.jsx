import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/mymotor-report";

// default = ช่วงเดือนปัจจุบัน (วันที่ 1 ถึงวันสิ้นเดือน)
function getMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(first), to: fmt(last) };
}

export default function MyMotoReportPage({ currentUser }) {
  const _mr = getMonthRange();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(_mr.from);
  const [dateTo, setDateTo] = useState(_mr.to);
  const [regType, setRegType] = useState("mymotor");
  const [branch, setBranch] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_vehicle_registrations_report",
          date_from: dateFrom || null,
          date_to: dateTo || null,
          registration_type: regType || null,
          branch_name: branch || null,
          keyword: search.trim() || null,
        }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ โหลดไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  async function handleDelete(r) {
    if (!window.confirm(`ลบแถวนี้?\n\nเลขถัง: ${r.chassis_number}\nวันที่: ${r.registered_date || '-'}\nสาขา: ${r.branch_name || '-'}`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_vehicle_registration", id: r.id }),
      });
      setMessage(`✅ ลบแถว id ${r.id} แล้ว`);
      fetchData();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
  }

  // collect unique values for filters
  const regTypeOpts = [...new Set(rows.map(r => r.registration_type).filter(Boolean))].sort();
  const branchOpts = [...new Set(rows.map(r => r.branch_name).filter(Boolean))].sort();

  // local search
  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!kw) return true;
    const hay = [r.chassis_number, r.customer_name, r.model_series, r.reg_model_name, r.branch_name, r.invoice_no]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  // counts
  const matchedCount = filtered.filter(r => r.sale_id).length;
  const unmatchedCount = filtered.filter(r => !r.sale_id).length;
  const mymotoYesCount = filtered.filter(r => r.honda_mymoto_registered === true).length;
  const mymotoNoCount  = filtered.filter(r => r.honda_warrantee_code && r.honda_mymoto_registered === false).length;

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📊 รายงานลงทะเบียน MyMoto</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>วันที่ลงทะเบียน:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />

        <select value={regType} onChange={e => setRegType(e.target.value)} style={inp}>
          <option value="">ทุกประเภท</option>
          {regTypeOpts.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={branch} onChange={e => setBranch(e.target.value)} style={inp}>
          <option value="">ทุกสาขา (Branch)</option>
          {branchOpts.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <input type="text" placeholder="🔍 ค้นหา (เลขถัง, ลูกค้า, รุ่น)"
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchData()}
          style={{ ...inp, flex: 1, minWidth: 240 }} />

        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 16px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔍 ค้นหา"}
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13 }}>📋 รายการรวม: <strong>{filtered.length}</strong></span>
        <span style={{ fontSize: 13, color: "#059669" }}>✓ จับคู่กับการขาย: <strong>{matchedCount}</strong></span>
        <span style={{ fontSize: 13, color: "#dc2626" }}>✗ ไม่พบในการขาย: <strong>{unmatchedCount}</strong></span>
        <span style={{ fontSize: 13, color: "#1565c0", marginLeft: "auto" }}>📱 MyMoto Honda: ลงแล้ว <strong>{mymotoYesCount}</strong> / ยังไม่ลง <strong>{mymotoNoCount}</strong></span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>#</th>
                <th style={th}>วันที่ลงทะเบียน</th>
                <th style={th}>ประเภท</th>
                <th style={th}>Branch Name</th>
                <th style={th}>เลขตัวถัง (VIN)</th>
                <th style={th}>ยี่ห้อ / รุ่น</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>เลขที่ใบขาย</th>
                <th style={th}>วันที่ขาย</th>
                <th style={th}>สถานะ</th>
                <th style={th}>MyMoto Honda</th>
                <th style={th}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const matched = !!r.sale_id;
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb", background: matched ? "transparent" : "#fef9c3" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}>{fmtDate(r.registered_date)}</td>
                    <td style={td}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#dbeafe", color: "#1e40af" }}>
                        {r.registration_type || "-"}
                      </span>
                    </td>
                    <td style={td}>{r.branch_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.chassis_number}</td>
                    <td style={td}>
                      {matched ? (
                        <>
                          <div style={{ fontSize: 12 }}>{r.brand || ""} {r.model_series || ""}</div>
                          {r.color_name && <div style={{ fontSize: 11, color: "#6b7280" }}>{r.color_name}</div>}
                        </>
                      ) : r.reg_model_name ? (
                        <span style={{ color: "#92400e", fontSize: 11 }}>{r.reg_model_name}</span>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...td, fontWeight: matched ? 600 : 400, color: matched ? "#1f2937" : "#9ca3af" }}>
                      {r.customer_name || "—"}
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.invoice_no || "-"}</td>
                    <td style={td}>{r.sale_date ? fmtDate(r.sale_date) : "-"}</td>
                    <td style={td}>
                      {matched ? (
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#d1fae5", color: "#065f46" }}>✓ จับคู่ได้</span>
                      ) : (
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#fee2e2", color: "#991b1b" }}>✗ ไม่พบ</span>
                      )}
                    </td>
                    <td style={td}>
                      {r.honda_warrantee_code ? (
                        r.honda_mymoto_registered ? (
                          <span title={`Warrantee: ${r.honda_warrantee_code}`} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#dbeafe", color: "#1e40af", fontWeight: 600 }}>
                            ✓ ลงแล้ว
                          </span>
                        ) : (
                          <span title={`Warrantee: ${r.honda_warrantee_code} (ไม่ได้ลง MyMoto)`} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#fef3c7", color: "#92400e" }}>
                            ✗ ยังไม่ลง
                          </span>
                        )
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={td}>
                      <button onClick={() => handleDelete(r)}
                        title="ลบแถวนี้"
                        style={{ padding: "3px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                        🗑️ ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
