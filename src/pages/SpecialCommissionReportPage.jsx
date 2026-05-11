import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/sales-extra-pay-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

async function postAPI(body) {
  const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

export default function SpecialCommissionReportPage({ currentUser }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [branchFilter, setBranchFilter] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState(null); // {employee, rows, loading}

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const data = await postAPI({ action: "commission_split_summary", date_from: dateFrom, date_to: dateTo, branch_code: branchFilter });
      const arr = Array.isArray(data) ? data.filter(r => r && r.employee_id) : [];
      setRows(arr);
    } catch (e) { setRows([]); setMessage("❌ โหลดไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  async function openDetail(emp) {
    setDetail({ emp, rows: [], loading: true });
    try {
      const data = await postAPI({ action: "commission_split_detail", date_from: dateFrom, date_to: dateTo, branch_code: branchFilter, employee_id: emp.employee_id });
      const arr = Array.isArray(data) ? data.filter(r => r && r.sale_id) : [];
      setDetail({ emp, rows: arr, loading: false });
    } catch { setDetail({ emp, rows: [], loading: false }); }
  }

  const total = rows.reduce((s, r) => s + Number(r.total_commission || 0), 0);
  const totalSales = rows.reduce((s, r) => s + Number(r.sales_count || 0), 0);
  const branches = [...new Set(rows.map(r => r.branch_code).filter(Boolean))];

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 รายงานค่าคอมพิเศษ</h2>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <input type="text" placeholder="รหัสสาขา (เช่น SCY06)" value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ ...inp, minWidth: 150, fontFamily: "monospace" }} />
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: "#b91c1c" }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        <Card label="👥 จำนวนพนักงาน" value={rows.length} color="#1e40af" />
        <Card label="🚗 ใบขายที่จ่ายค่าคอม" value={totalSales} color="#0369a1" />
        <Card label="💰 ยอดค่าคอมรวม" value={fmt(total)} color="#059669" highlight />
      </div>

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>#</th>
              <th style={th}>พนักงาน</th>
              <th style={th}>สาขา</th>
              <th style={{ ...th, textAlign: "right" }}>จำนวนใบขาย</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดค่าคอมรวม</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.employee_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, fontWeight: 600 }}>{r.employee_name}</td>
                <td style={{ ...td, fontFamily: "monospace" }}>{r.branch_code || "-"}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.sales_count}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.total_commission)}</td>
                <td style={td}><button onClick={() => openDetail(r)} style={btnSmBlue}>📋 รายละเอียด</button></td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม</td>
                <td style={{ ...td, textAlign: "right" }}>{totalSales}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(total)}</td>
                <td style={td}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail popup */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1300, width: "94%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 {detail.emp?.employee_name} · {detail.emp?.branch_code} · ยอดรวม {fmt(detail.emp?.total_commission)}</h3>
              <button onClick={() => setDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {detail.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f0f4f9" }}>
                  <tr>
                    <th style={th}>#</th><th style={th}>วันที่</th><th style={th}>เลขใบขาย</th><th style={th}>ลูกค้า</th>
                    <th style={th}>รุ่น/Type</th><th style={th}>เลขถัง</th>
                    <th style={{ ...th, textAlign: "right" }}>ค่าคอมรวม</th>
                    <th style={{ ...th, textAlign: "center" }}>หาร</th>
                    <th style={{ ...th, textAlign: "right" }}>ส่วนแบ่ง</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.rows.length === 0 && <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                  {detail.rows.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>{fmtDate(r.sale_date)}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{r.invoice_no}</td>
                      <td style={td}>{r.customer_name}</td>
                      <td style={td}>{r.brand} · {r.model_series} · {r.type_name || r.model_code}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{r.chassis_no}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.comm_amount)}</td>
                      <td style={{ ...td, textAlign: "center" }}>÷{r.split_count}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.per_emp_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, color, highlight }) {
  return (
    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: highlight ? `2px solid ${color}` : "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: highlight ? 22 : 18, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const btnBlue = { padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
const btnSmBlue = { padding: "4px 10px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
