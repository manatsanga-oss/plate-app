import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";

export default function TimeTrackingPage({ currentUser }) {
  const [tab, setTab] = useState("detail");  // 'detail' | 'summary'
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [empFilter, setEmpFilter] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchEmployees();
    // default filter: เดือนนี้
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateFrom(first.toISOString().slice(0, 10));
    setDateTo(last.toISOString().slice(0, 10));
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => {
    if (dateFrom && dateTo) {
      if (tab === "detail") fetchDetail();
      else fetchSummary();
    }
    /* eslint-disable-next-line */
  }, [tab, dateFrom, dateTo, empFilter]);

  async function fetchEmployees() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_employees" }),
      });
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }

  async function fetchDetail() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_time_tracking",
          date_from: dateFrom, date_to: dateTo,
          employee_name: empFilter,
          keyword: search.trim(),
        }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  async function fetchSummary() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "summary_time_tracking",
          date_from: dateFrom, date_to: dateTo,
        }),
      });
      const data = await res.json();
      setSummary(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); setSummary([]); }
    setLoading(false);
  }

  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
  }
  function isZero(v) {
    if (!v) return true;
    const s = String(v).trim();
    return s === "-" || s === "" || s === "0h 0 m" || s === "0 h 0 m" || s === "0h 0m" || s === "0";
  }

  const kw = search.trim().toLowerCase();
  const filteredDetail = rows.filter(r => {
    if (!kw) return true;
    const hay = [r.employee_name, r.team_name, r.position_name].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">⏱️ แสดงเวลาทำงานของพนักงาน</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["detail", "📋 รายละเอียดรายวัน"],
          ["summary", "📊 สรุปรายพนักงาน"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ padding: "10px 22px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: tab === v ? "#072d6b" : "#6b7280",
              borderBottom: tab === v ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>ช่วงวันที่:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />

        {tab === "detail" && (
          <select value={empFilter} onChange={e => setEmpFilter(e.target.value)} style={{ ...inp, minWidth: 200 }}>
            <option value="">ทุกพนักงาน ({employees.length} คน)</option>
            {employees.map(e => (
              <option key={e.employee_name} value={e.employee_name}>{e.employee_name}</option>
            ))}
          </select>
        )}

        {tab === "detail" && (
          <input type="text" placeholder="🔍 ค้นหา (ชื่อ, ทีม, ตำแหน่ง)"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inp, flex: 1, minWidth: 200 }} />
        )}

        <button onClick={tab === "detail" ? fetchDetail : fetchSummary} disabled={loading}
          style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>
      </div>

      {/* Detail Tab */}
      {tab === "detail" && (
        <>
          <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 13 }}>📋 รายการ: <strong>{filteredDetail.length}</strong></span>
            <span style={{ fontSize: 13 }}>👥 พนักงาน: <strong>{new Set(filteredDetail.map(r => r.employee_name)).size}</strong></span>
            <span style={{ fontSize: 13, color: "#dc2626" }}>❌ ขาด: <strong>{filteredDetail.filter(r => r.absence === "Absence").length}</strong></span>
            <span style={{ fontSize: 13, color: "#ea580c" }}>⏰ มาสาย: <strong>{filteredDetail.filter(r => !isZero(r.clock_late)).length}</strong></span>
            <span style={{ fontSize: 13, color: "#7c3aed" }}>⏱️ OT: <strong>{filteredDetail.filter(r => !isZero(r.over_time)).length}</strong></span>
          </div>

          <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
            ) : filteredDetail.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#072d6b", color: "#fff" }}>
                  <tr>
                    <th style={th}>วันที่</th>
                    <th style={th}>วัน</th>
                    <th style={th}>พนักงาน</th>
                    <th style={th}>ทีม</th>
                    <th style={th}>ตำแหน่ง</th>
                    <th style={th}>เข้า</th>
                    <th style={th}>ออก</th>
                    <th style={th}>เวลาทำงาน</th>
                    <th style={th}>มาสาย</th>
                    <th style={th}>กลับก่อน</th>
                    <th style={th}>OT</th>
                    <th style={th}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDetail.map(r => {
                    const isAbsent = r.absence === "Absence";
                    return (
                      <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb", background: isAbsent ? "#fef2f2" : "transparent" }}>
                        <td style={td}>{fmtDate(r.clock_date)}</td>
                        <td style={td}>{r.day_name || "-"}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{r.employee_name}</td>
                        <td style={td}>{r.team_name || "-"}</td>
                        <td style={td}>{r.position_name || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.clock_in || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.clock_out || "-"}</td>
                        <td style={td}>{r.work_hour || "-"}</td>
                        <td style={{ ...td, color: isZero(r.clock_late) ? "#9ca3af" : "#ea580c", fontWeight: isZero(r.clock_late) ? 400 : 600 }}>
                          {r.clock_late || "-"}
                        </td>
                        <td style={{ ...td, color: isZero(r.leave_early) ? "#9ca3af" : "#dc2626", fontWeight: isZero(r.leave_early) ? 400 : 600 }}>
                          {r.leave_early || "-"}
                        </td>
                        <td style={{ ...td, color: isZero(r.over_time) ? "#9ca3af" : "#7c3aed", fontWeight: isZero(r.over_time) ? 400 : 600 }}>
                          {r.over_time || "-"}
                        </td>
                        <td style={td}>
                          {isAbsent ? (
                            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#fee2e2", color: "#991b1b" }}>ขาด</span>
                          ) : r.leave_text && r.leave_text !== "-" ? (
                            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#fef3c7", color: "#92400e" }}>ลา</span>
                          ) : r.clock_in && r.clock_in !== "-" ? (
                            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#d1fae5", color: "#065f46" }}>มา</span>
                          ) : (
                            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#f3f4f6", color: "#6b7280" }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Summary Tab */}
      {tab === "summary" && (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
          ) : summary.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>พนักงาน</th>
                  <th style={th}>ทีม</th>
                  <th style={th}>ตำแหน่ง</th>
                  <th style={{ ...th, textAlign: "right" }}>วันรวม</th>
                  <th style={{ ...th, textAlign: "right", color: "#86efac" }}>มา</th>
                  <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ขาด</th>
                  <th style={{ ...th, textAlign: "right", color: "#fdba74" }}>สาย</th>
                  <th style={{ ...th, textAlign: "right", color: "#fde047" }}>กลับก่อน</th>
                  <th style={{ ...th, textAlign: "right", color: "#d8b4fe" }}>OT</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ ...td, fontWeight: 600 }}>{s.employee_name}</td>
                    <td style={td}>{s.team_name || "-"}</td>
                    <td style={td}>{s.position_name || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{s.total_days}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#065f46", fontWeight: 600 }}>{s.present_days}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: Number(s.absence_days) > 0 ? "#dc2626" : "#9ca3af", fontWeight: Number(s.absence_days) > 0 ? 600 : 400 }}>{s.absence_days}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: Number(s.late_days) > 0 ? "#ea580c" : "#9ca3af", fontWeight: Number(s.late_days) > 0 ? 600 : 400 }}>{s.late_days}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: Number(s.early_leave_days) > 0 ? "#dc2626" : "#9ca3af", fontWeight: Number(s.early_leave_days) > 0 ? 600 : 400 }}>{s.early_leave_days}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: Number(s.ot_days) > 0 ? "#7c3aed" : "#9ca3af", fontWeight: Number(s.ot_days) > 0 ? 600 : 400 }}>{s.ot_days}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
                <tr>
                  <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม {summary.length} คน</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{summary.reduce((s, x) => s + Number(x.total_days || 0), 0)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#065f46" }}>{summary.reduce((s, x) => s + Number(x.present_days || 0), 0)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{summary.reduce((s, x) => s + Number(x.absence_days || 0), 0)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#ea580c" }}>{summary.reduce((s, x) => s + Number(x.late_days || 0), 0)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{summary.reduce((s, x) => s + Number(x.early_leave_days || 0), 0)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#7c3aed" }}>{summary.reduce((s, x) => s + Number(x.ot_days || 0), 0)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
