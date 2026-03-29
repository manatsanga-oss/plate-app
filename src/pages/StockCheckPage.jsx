import React, { useState } from "react";

const FORM_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/stock-check";

const TYPE_LABEL = {
  "ไม่ได้จดมา": { color: "#92400e", bg: "#fffbeb", border: "#fde68a", icon: "⚠️" },
  "ไม่เจอในสต๊อก": { color: "#991b1b", bg: "#fef2f2", border: "#fca5a5", icon: "❌" },
  "โอนรถ": { color: "#1e40af", bg: "#eff6ff", border: "#93c5fd", icon: "🔄" },
};

export default function StockCheckPage({ currentUser }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [results, setResults] = useState(null);

  const branch = currentUser?.branch || "";

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
      fd.append("เลือกร้าน", branch);

      const res = await fetch(FORM_URL, { method: "POST", body: fd });
      if (res.ok) {
        setSuccess(true);
        setFile(null);
        try {
          const data = await res.json();
          if (data?.results?.length > 0) {
            setResults(data.results);
            setMessage(`พบรายการที่ต้องตรวจสอบ ${data.results.length} รายการ`);
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
        <h2 className="page-title">📋 ระบบเช็คสต๊อก</h2>
      </div>

      <div className="form-card" style={{ maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>อัปโหลดไฟล์เช็คสต๊อก</h3>
        <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: 14 }}>สังกัด: <strong style={{ color: "#072d6b" }}>{branch || "-"}</strong></p>

        <div className="form-row">
          <label>ไฟล์ Live Form เช็คสต๊อก (.xlsx) <span style={{ color: "#ef4444" }}>*</span></label>
          <input
            type="file"
            accept=".xlsx"
            className="form-input"
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
          {file && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{file.name}</div>}
        </div>

        {message && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, marginBottom: 12,
            background: success ? "#f0fdf4" : "#fef2f2",
            color: success ? "#15803d" : "#dc2626",
            border: `1px solid ${success ? "#86efac" : "#fca5a5"}`,
          }}>
            {message}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: "100%", padding: "10px 0", fontSize: 15 }}
        >
          {loading ? "กำลังส่งข้อมูล..." : "📤 ส่งข้อมูลเช็คสต๊อก"}
        </button>
      </div>

      {grouped && Object.entries(grouped).map(([type, items]) => {
        const style = TYPE_LABEL[type] || { color: "#374151", bg: "#f9fafb", border: "#e5e7eb", icon: "📌" };
        return (
          <div key={type} className="form-card" style={{ maxWidth: 700, marginTop: 16 }}>
            <h4 style={{ margin: "0 0 12px", color: style.color }}>
              {style.icon} {type} ({items.length} รายการ)
            </h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: style.bg, borderBottom: `1px solid ${style.border}` }}>
                  {type === "โอนรถ" ? (
                    <>
                      <th style={thStyle}>เลขเครื่อง</th>
                      <th style={thStyle}>รุ่น</th>
                      <th style={thStyle}>ร้านต้นทาง</th>
                      <th style={thStyle}>ร้านปลายทาง</th>
                    </>
                  ) : type === "ไม่เจอในสต๊อก" ? (
                    <>
                      <th style={thStyle}>เลขเครื่อง</th>
                      <th style={thStyle}>ยี่ห้อ</th>
                      <th style={thStyle}>ร้าน</th>
                    </>
                  ) : (
                    <>
                      <th style={thStyle}>เลขเครื่อง</th>
                      <th style={thStyle}>รุ่น</th>
                      <th style={thStyle}>ร้าน</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    {type === "โอนรถ" ? (
                      <>
                        <td style={tdStyle}>{r.เลขเครื่อง}</td>
                        <td style={tdStyle}>{r.รุ่น}</td>
                        <td style={tdStyle}>{r.ร้านต้นทาง}</td>
                        <td style={tdStyle}>{r.ร้านปลายทาง}</td>
                      </>
                    ) : type === "ไม่เจอในสต๊อก" ? (
                      <>
                        <td style={tdStyle}>{r.เลขเครื่อง}</td>
                        <td style={tdStyle}>{r.ยี่ห้อ}</td>
                        <td style={tdStyle}>{r.ร้าน}</td>
                      </>
                    ) : (
                      <>
                        <td style={tdStyle}>{r.เลขเครื่อง}</td>
                        <td style={tdStyle}>{r.รุ่น}</td>
                        <td style={tdStyle}>{r.ร้าน}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

const thStyle = { padding: "6px 10px", textAlign: "left", fontWeight: 600 };
const tdStyle = { padding: "6px 10px" };
