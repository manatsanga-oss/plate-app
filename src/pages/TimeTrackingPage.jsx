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
  const [editingStatus, setEditingStatus] = useState(null);  // {id, current, employee, date}
  const [statusValue, setStatusValue] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    fetchEmployees();
    // default filter: 21 ของเดือนก่อน → 20 ของเดือนปัจจุบัน
    const now = new Date();
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 21);
    const to = new Date(now.getFullYear(), now.getMonth(), 20);
    setDateFrom(fmt(from));
    setDateTo(fmt(to));
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

  function openStatusEditor(r) {
    setEditingStatus({
      id: r.id,
      employee: r.employee_name,
      date: r.clock_date,
      auto_calc: r.day_status,
      override: r.day_status_override,
    });
    setStatusValue(r.day_status_override || "");
    setStatusNote(r.override_note || "");
  }

  async function saveStatusOverride() {
    if (!editingStatus) return;
    setSavingStatus(true);
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_time_tracking_status",
          id: editingStatus.id,
          day_status_override: statusValue || null,
          override_note: statusNote || "",
          override_by: currentUser?.username || "system",
        }),
      });
      setMessage("✅ บันทึกสถานะเรียบร้อย");
      setEditingStatus(null);
      fetchDetail();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSavingStatus(false);
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
                    const status = r.day_status || (r.absence === "Absence" ? "ขาด" : null);
                    const isAbsent = status === "ขาด";
                    const isWorking = status === "มา";
                    let bg = "transparent", badgeBg = "#f3f4f6", badgeColor = "#6b7280";
                    if (isAbsent) { bg = "#fef2f2"; badgeBg = "#fee2e2"; badgeColor = "#991b1b"; }
                    else if (isWorking) { badgeBg = "#d1fae5"; badgeColor = "#065f46"; }
                    else if (status === "วันหยุดประจำสัปดาห์") { bg = "#eff6ff"; badgeBg = "#dbeafe"; badgeColor = "#1e40af"; }
                    else if (status === "วันหยุดกลางเดือน") { bg = "#f5f3ff"; badgeBg = "#ede9fe"; badgeColor = "#5b21b6"; }
                    else if (status === "ชดเชย" || status === "OT") { bg = "#f0fdf4"; badgeBg = "#bbf7d0"; badgeColor = "#15803d"; }
                    else if (status && status.startsWith("ลา")) { bg = "#fff7ed"; badgeBg = "#fed7aa"; badgeColor = "#9a3412"; }
                    else if (status) {
                      // วันหยุดประจำปี (ใช้ชื่อวันหยุดเป็น status เช่น "วันสงกรานต์", "วันแรงงาน")
                      bg = "#fef9c3"; badgeBg = "#fef3c7"; badgeColor = "#92400e";
                    }
                    return (
                      <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb", background: bg }}>
                        <td style={td}>{fmtDate(r.clock_date)}</td>
                        <td style={td}>{r.day_name || "-"}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{r.employee_name}</td>
                        <td style={td}>{r.team_name || r.affiliation || "-"}</td>
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
                          <button onClick={() => openStatusEditor(r)} title="คลิกเพื่อแก้สถานะ"
                            style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: badgeBg, color: badgeColor, fontWeight: 600, border: r.day_status_override ? "2px dashed #7c3aed" : "1px solid transparent", cursor: "pointer" }}>
                            {status || "-"}
                            {r.day_status_override && <span style={{ marginLeft: 4, fontSize: 9 }}>✏️</span>}
                          </button>
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

      {/* Status Override Editor */}
      {editingStatus && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !savingStatus && setEditingStatus(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 480, maxWidth: "95vw" }}>
            <h3 style={{ margin: "0 0 12px", color: "#072d6b" }}>✏️ แก้ไขสถานะวันทำงาน</h3>

            <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
              <div><strong>พนักงาน:</strong> {editingStatus.employee}</div>
              <div><strong>วันที่:</strong> {fmtDate(editingStatus.date)}</div>
              <div><strong>ระบบคำนวณ:</strong> <span style={{ color: "#0369a1" }}>{editingStatus.auto_calc || "-"}</span></div>
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              ประเภทวันหยุด (override) — เว้นว่าง = ใช้ระบบคำนวณ
            </label>
            <select value={statusValue} onChange={e => setStatusValue(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", marginBottom: 10 }}>
              <option value="">-- ใช้ระบบคำนวณอัตโนมัติ --</option>
              <option value="มา">มา</option>
              <option value="ขาด">ขาด</option>
              <option value="ลากิจ">ลากิจ</option>
              <option value="ลาป่วย">ลาป่วย</option>
              <option value="ลาพักร้อน">ลาพักร้อน</option>
              <option value="ลาคลอดบุตร">ลาคลอดบุตร</option>
              <option value="วันหยุดประจำสัปดาห์">วันหยุดประจำสัปดาห์</option>
              <option value="วันหยุดประจำปี">วันหยุดประจำปี</option>
              <option value="วันหยุดกลางเดือน">วันหยุดกลางเดือน</option>
              <option value="ชดเชย">ชดเชย (วันหยุดชดเชย)</option>
              <option value="OT">OT (ทำงานวันหยุด)</option>
            </select>

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>หมายเหตุ</label>
            <textarea value={statusNote} onChange={e => setStatusNote(e.target.value)} rows={2}
              placeholder="เหตุผลที่เปลี่ยนสถานะ (ถ้ามี)"
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box", resize: "vertical" }} />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setEditingStatus(null)} disabled={savingStatus}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={saveStatusOverride} disabled={savingStatus}
                style={{ padding: "8px 20px", background: savingStatus ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: savingStatus ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {savingStatus ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
