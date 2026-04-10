import React, { useState, useEffect } from "react";

const FORM_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-check";
const LOG_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-check-log";

const TYPE_LABEL = {
  "สต๊อกถูกต้อง": { color: "#166534", bg: "#f0fdf4", border: "#86efac", icon: "✅" },
  "ไม่ได้จดมา": { color: "#92400e", bg: "#fffbeb", border: "#fde68a", icon: "⚠️" },
  "ไม่เจอในสต๊อก": { color: "#991b1b", bg: "#fef2f2", border: "#fca5a5", icon: "❌" },
  "โอนรถ": { color: "#1e40af", bg: "#eff6ff", border: "#93c5fd", icon: "🔄" },
};

export default function StockCheckPage({ currentUser }) {
  const [tab, setTab] = useState("check"); // check | history
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [results, setResults] = useState(null);

  // history
  const [logs, setLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const branch = currentUser?.branch || "";
  const branchCode = branch.includes(" ") ? branch.split(" ")[0] : branch;
  const branchName = branch.includes(" ") ? branch.split(" ").slice(1).join(" ") : branch;

  async function handleSubmit() {
    if (!file) { setMessage("กรุณาเลือกไฟล์ .xlsx"); return; }
    if (!branch) { setMessage("ไม่พบข้อมูลสังกัดของผู้ใช้"); return; }

    setLoading(true);
    setMessage("");
    setSuccess(false);
    setResults(null);

    try {
      const fd = new FormData();
      fd.append("เลือกไลฟ์ ฟอร์ม เช็คสต๊อก", file);
      fd.append("เลือกร้าน", branchName);
      fd.append("รหัสสาขา", branchCode);

      const res = await fetch(FORM_URL, { method: "POST", body: fd });
      if (res.ok) {
        setSuccess(true);
        setFile(null);
        try {
          const data = await res.json();
          if (data?.results?.length > 0) {
            setResults(data.results);
            const issues = data.results.filter(r => r.ประเภท !== "สต๊อกถูกต้อง");
            if (issues.length > 0) {
              setMessage(`พบรายการที่ต้องตรวจสอบ ${issues.length} รายการ`);
            } else {
              setMessage("ส่งข้อมูลสำเร็จ สต๊อกถูกต้องทั้งหมด");
            }
            // บันทึก log อัตโนมัติ
            const correct = data.results.filter(r => r.ประเภท === "สต๊อกถูกต้อง");
            const correctCount = correct[0]?.จำนวน || correct.length;
            saveLog(data.results, correctCount, issues.length);
          } else {
            setMessage("ส่งข้อมูลสำเร็จ ไม่พบรายการผิดปกติ");
          }
        } catch {
          setMessage("ส่งข้อมูลสำเร็จ กำลังประมวลผล...");
        }
      } else {
        setSuccess(false);
        setMessage("เกิดข้อผิดพลาด: " + res.status);
      }
    } catch {
      setSuccess(false);
      setMessage("ไม่สามารถเชื่อมต่อ n8n ได้");
    }
    setLoading(false);
  }

  async function saveLog(resultsData, totalCorrect, totalIssues) {
    try {
      await fetch(LOG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_log",
          branch_code: branchCode,
          branch_name: branchName,
          checked_by: currentUser?.name || "",
          total_correct: totalCorrect,
          total_issues: totalIssues,
        }),
      });
    } catch { /* silent */ }
  }

  async function fetchLogs() {
    setLogLoading(true);
    try {
      const res = await fetch(LOG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_logs", date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json();
      setLogs(data?.data || []);
    } catch { setLogs([]); }
    setLogLoading(false);
  }

  useEffect(() => { if (tab === "history") fetchLogs(); }, [tab]);

  const grouped = results
    ? results.reduce((acc, r) => {
        const t = r.ประเภท || "อื่นๆ";
        if (!acc[t]) acc[t] = [];
        acc[t].push(r);
        return acc;
      }, {})
    : null;

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">ระบบเช็คสต๊อก</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("check")} style={{ padding: "8px 20px", fontSize: 14, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", background: tab === "check" ? "#072d6b" : "#e5e7eb", color: tab === "check" ? "#fff" : "#374151" }}>
          เช็คสต๊อก
        </button>
        <button onClick={() => setTab("history")} style={{ padding: "8px 20px", fontSize: 14, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", background: tab === "history" ? "#072d6b" : "#e5e7eb", color: tab === "history" ? "#fff" : "#374151" }}>
          ประวัติการตรวจนับ
        </button>
      </div>

      {/* === TAB เช็คสต๊อก === */}
      {tab === "check" && (
        <>
          <div className="form-card" style={{ maxWidth: 560 }}>
            <h3 style={{ marginTop: 0 }}>อัปโหลดไฟล์เช็คสต๊อก</h3>
            <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: 14 }}>สังกัด: <strong style={{ color: "#072d6b" }}>{branch || "-"}</strong></p>

            <div className="form-row">
              <label>ไฟล์ Live Form เช็คสต๊อก (.xlsx) <span style={{ color: "#ef4444" }}>*</span></label>
              <input type="file" accept=".xlsx" className="form-input" onChange={(e) => setFile(e.target.files[0] || null)} />
              {file && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{file.name}</div>}
            </div>

            {message && (
              <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 12, background: success ? "#f0fdf4" : "#fef2f2", color: success ? "#15803d" : "#dc2626", border: `1px solid ${success ? "#86efac" : "#fca5a5"}` }}>
                {message}
              </div>
            )}

            <button className="btn-primary" onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "10px 0", fontSize: 15 }}>
              {loading ? "กำลังส่งข้อมูล..." : "ส่งข้อมูลเช็คสต๊อก"}
            </button>
          </div>

          {grouped && Object.entries(grouped).map(([type, items]) => {
            const style = TYPE_LABEL[type] || { color: "#374151", bg: "#f9fafb", border: "#e5e7eb", icon: "" };
            if (type === "สต๊อกถูกต้อง") {
              return (
                <div key={type} className="form-card" style={{ maxWidth: 700, marginTop: 16, background: style.bg, border: `1px solid ${style.border}` }}>
                  <h4 style={{ margin: 0, color: style.color, fontSize: 16 }}>
                    {style.icon} สต๊อกถูกต้อง {items[0]?.จำนวน || items.length} รายการ
                  </h4>
                </div>
              );
            }
            return (
              <div key={type} className="form-card" style={{ maxWidth: 700, marginTop: 16 }}>
                <h4 style={{ margin: "0 0 12px", color: style.color }}>{style.icon} {type} ({items.length} รายการ)</h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: style.bg, borderBottom: `1px solid ${style.border}` }}>
                      {type === "โอนรถ" ? (<><th style={thStyle}>เลขเครื่อง</th><th style={thStyle}>รุ่น</th><th style={thStyle}>ร้านต้นทาง</th><th style={thStyle}>ร้านปลายทาง</th></>)
                      : type === "ไม่เจอในสต๊อก" ? (<><th style={thStyle}>เลขเครื่อง</th><th style={thStyle}>ยี่ห้อ</th><th style={thStyle}>ร้าน</th></>)
                      : (<><th style={thStyle}>เลขเครื่อง</th><th style={thStyle}>รุ่น</th><th style={thStyle}>ร้าน</th></>)}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        {type === "โอนรถ" ? (<><td style={tdStyle}>{r.เลขเครื่อง}</td><td style={tdStyle}>{r.รุ่น}</td><td style={tdStyle}>{r.ร้านต้นทาง}</td><td style={tdStyle}>{r.ร้านปลายทาง}</td></>)
                        : type === "ไม่เจอในสต๊อก" ? (<><td style={tdStyle}>{r.เลขเครื่อง}</td><td style={tdStyle}>{r.ยี่ห้อ}</td><td style={tdStyle}>{r.ร้าน}</td></>)
                        : (<><td style={tdStyle}>{r.เลขเครื่อง}</td><td style={tdStyle}>{r.รุ่น}</td><td style={tdStyle}>{r.ร้าน}</td></>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}

      {/* === TAB ประวัติ === */}
      {tab === "history" && (
        <>
          <div className="form-card" style={{ maxWidth: 700 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: 13 }}>จาก:</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }} />
              <label style={{ fontSize: 13 }}>ถึง:</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }} />
              <button onClick={fetchLogs} style={{ padding: "6px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>ค้นหา</button>
              <span style={{ fontSize: 13, color: "#6b7280" }}>{logs.length} รายการ</span>
            </div>
          </div>

          {logLoading ? (
            <p style={{ textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</p>
          ) : logs.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6b7280", marginTop: 16 }}>ไม่พบข้อมูล</p>
          ) : (
            <div className="form-card" style={{ maxWidth: 700, marginTop: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#072d6b", color: "#fff" }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>วันที่</th>
                    <th style={thStyle}>สาขา</th>
                    <th style={thStyle}>ผู้ตรวจ</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>ถูกต้อง</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>ผิดปกติ</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <React.Fragment key={log.id}>
                      <tr style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={tdStyle}>{log.check_date ? new Date(log.check_date).toLocaleString("th-TH") : "-"}</td>
                        <td style={tdStyle}>{log.branch_name || log.branch_code || "-"}</td>
                        <td style={tdStyle}>{log.checked_by || "-"}</td>
                        <td style={{ ...tdStyle, textAlign: "center", color: "#166534", fontWeight: 700 }}>{log.total_correct}</td>
                        <td style={{ ...tdStyle, textAlign: "center", color: Number(log.total_issues) > 0 ? "#dc2626" : "#6b7280", fontWeight: 700 }}>{log.total_issues}</td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const thStyle = { padding: "6px 10px", textAlign: "left", fontWeight: 600 };
const tdStyle = { padding: "6px 10px" };
