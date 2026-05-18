import React, { useState } from "react";

const HONDA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api";
const YAMAHA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/yamaha-spare-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}

const STATUS_COLOR = {
  "มาครบ": "#10b981", "มาไม่ครบ": "#f59e0b", "อะไหล่ค้างส่ง": "#ef4444",
  "เปิดงาน": "#ec4899", "สั่งซื้อแล้ว": "#3b82f6", "ปิดงานซ่อม": "#dc2626",
};

export default function PartStatusInquiryPage() {
  const [partCode, setPartCode] = useState("");
  const [hondaRows, setHondaRows] = useState([]);
  const [yamahaRows, setYamahaRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState("");

  async function doSearch() {
    const code = partCode.trim();
    if (!code) { setMessage("⚠️ กรอกรหัสอะไหล่"); return; }
    setLoading(true); setMessage(""); setSearched(true);
    try {
      const [h, y] = await Promise.all([
        fetch(HONDA_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "inquire_part_status", part_code: code }) }).then(r => r.json()).catch(() => []),
        fetch(YAMAHA_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "inquire_part_status", part_code: code }) }).then(r => r.json()).catch(() => []),
      ]);
      setHondaRows(Array.isArray(h) ? h.filter(r => r && r.order_no) : []);
      setYamahaRows(Array.isArray(y) ? y.filter(r => r && r.order_no) : []);
    } catch (e) { setMessage("❌ ค้นหาล้มเหลว: " + e.message); }
    setLoading(false);
  }

  function Table({ title, rows, color }) {
    return (
      <div style={{ marginBottom: 20, background: "#fff", borderRadius: 10, border: `2px solid ${color}`, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: color, color: "#fff", fontWeight: 700, fontSize: 14 }}>
          {title} <span style={{ marginLeft: 8, opacity: 0.9 }}>({rows.length} รายการ)</span>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>ไม่พบรายการ</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>เลขที่มัดจำ</th>
                  <th style={th}>ลูกค้า</th>
                  <th style={th}>ช่าง</th>
                  <th style={th}>รุ่นรถ</th>
                  <th style={th}>ทะเบียน</th>
                  <th style={th}>สถานะจอด</th>
                  <th style={th}>สถานะ</th>
                  <th style={th}>เลขที่ใบรับสั่งซื้อ</th>
                  <th style={th}>วันที่</th>
                  <th style={th}>รหัส</th>
                  <th style={th}>ชื่ออะไหล่</th>
                  <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.order_id + "_" + i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.deposit_doc_no || "-"}</td>
                    <td style={td}>{r.customer_name || "-"}</td>
                    <td style={td}>{r.technician || "-"}</td>
                    <td style={td}>{r.model_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.license_plate || "-"}</td>
                    <td style={td}>{r.parking_status || "-"}</td>
                    <td style={td}>
                      <span style={{ padding: "2px 8px", borderRadius: 10, background: (STATUS_COLOR[r.status] || "#6b7280") + "33", color: STATUS_COLOR[r.status] || "#374151", fontSize: 11, fontWeight: 600 }}>
                        {r.status || "-"}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: "monospace" }}>
                      {r.po_numbers ? (
                        r.po_numbers.split(",").map((po, k) => (
                          <div key={k} style={{ color: "#1d4ed8", textDecoration: "underline", fontWeight: 600 }}>{po.trim()}</div>
                        ))
                      ) : <span style={{ color: "#9ca3af" }}>-</span>}
                    </td>
                    <td style={td}>{fmtDate(r.created_at)}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{r.part_code}</td>
                    <td style={{ ...td, fontSize: 11, color: "#374151" }}>{r.part_name || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt(r.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🔎 สอบถามสถานะอะไหล่</h2>
      </div>

      <div style={{ padding: 14, background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>รหัสอะไหล่ (พิมพ์มี/ไม่มี - ก็ได้, ตัวเล็ก/ใหญ่ก็ได้)</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={partCode} onChange={e => setPartCode(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="เช่น 17210-K3M-T00 หรือ 17210K3MT00"
            style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, fontFamily: "monospace", minWidth: 300, flex: 1 }} />
          <button onClick={doSearch} disabled={loading}
            style={{ padding: "8px 22px", background: loading ? "#9ca3af" : "#1e40af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
            {loading ? "⏳ กำลังค้น..." : "🔍 ค้นหา"}
          </button>
          {searched && !loading && (
            <span style={{ alignSelf: "center", fontSize: 13, color: "#6b7280" }}>
              พบ: 🔴 Honda <strong>{hondaRows.length}</strong> · 🔵 Yamaha <strong>{yamahaRows.length}</strong> รายการ
            </span>
          )}
        </div>
        {message && <div style={{ padding: 10, marginTop: 8, fontSize: 13, color: "#b91c1c" }}>{message}</div>}
      </div>

      {searched && (
        <>
          <Table title="🔴 HONDA — ระบบสั่งซื้ออะไหล่" rows={hondaRows} color="#dc2626" />
          <Table title="🔵 YAMAHA — ระบบสั่งซื้ออะไหล่" rows={yamahaRows} color="#1e40af" />
        </>
      )}
    </div>
  );
}

const th = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#374151", whiteSpace: "nowrap" };
const td = { padding: "6px 10px", fontSize: 12, verticalAlign: "middle" };
