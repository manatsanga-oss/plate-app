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

export default function NormalCommissionReportPage({ currentUser }) {
  const [tab, setTab] = useState("sales"); // 'sales' | 'commission'
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [salesRows, setSalesRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState(null);

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      if (tab === "sales") {
        const data = await postAPI({ action: "list_all_sales", date_from: dateFrom, date_to: dateTo });
        setSalesRows(Array.isArray(data) ? data.filter(r => r && r.sale_id) : []);
      } else {
        const data = await postAPI({ action: "commission_normal_summary", date_from: dateFrom, date_to: dateTo });
        setRows(Array.isArray(data) ? data.filter(r => r && r.employee_id) : []);
      }
    } catch { setRows([]); setSalesRows([]); setMessage("❌ โหลดไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [tab]);

  async function openDetail(emp) {
    setDetail({ emp, rows: [], loading: true });
    try {
      const data = await postAPI({ action: "commission_normal_detail", date_from: dateFrom, date_to: dateTo, employee_id: emp.employee_id });
      const arr = Array.isArray(data) ? data.filter(r => r && r.sale_id) : [];
      setDetail({ emp, rows: arr, loading: false });
    } catch { setDetail({ emp, rows: [], loading: false }); }
  }

  const total = rows.reduce((s, r) => s + Number(r.total_commission || 0), 0);
  const totalSales = rows.reduce((s, r) => s + Number(r.sales_count || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💵 รายงานค่าคอมปกติ</h2>
      </div>

      <div style={{ display: "flex", gap: 0, marginBottom: 0, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["sales", "📋 การขายทั้งหมด"],
          ["commission", "💵 ค่าคอมปกติ"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{
              padding: "10px 18px", border: "none", background: "transparent",
              fontWeight: tab === v ? 700 : 500, fontSize: 14, cursor: "pointer",
              color: tab === v ? "#072d6b" : "#6b7280",
              borderBottom: tab === v ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2,
            }}>{label}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: "#b91c1c" }}>{message}</div>}

      {tab === "sales" && (() => {
        // group by branch_code + invoice_type
        const byBranch = {};
        salesRows.forEach(r => {
          const b = r.branch_code || "(ไม่มีสาขา)";
          if (!byBranch[b]) byBranch[b] = { branch: b, total: 0, retail: 0, finance: 0, other: 0, total_amount: 0 };
          byBranch[b].total += 1;
          byBranch[b].total_amount += Number(r.total_amount || 0);
          if (r.invoice_type === "ขายปลีก") byBranch[b].retail += 1;
          else if (r.invoice_type === "ขายไฟแนนซ์") byBranch[b].finance += 1;
          else byBranch[b].other += 1;
        });
        const branches = Object.values(byBranch).sort((a, b) => a.branch.localeCompare(b.branch));
        const grandTotal = salesRows.length;
        const grandAmount = salesRows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
        return (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
              <Card label="🚗 ใบขายทั้งหมด" value={grandTotal} color="#1e40af" />
              <Card label="📋 ขายปลีก" value={salesRows.filter(r => r.invoice_type === "ขายปลีก").length} color="#0369a1" />
              <Card label="💳 ขายไฟแนนซ์" value={salesRows.filter(r => r.invoice_type === "ขายไฟแนนซ์").length} color="#7c3aed" />
              <Card label="💰 ยอดขายรวม" value={fmt(grandAmount)} color="#059669" highlight />
            </div>
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 12, padding: 12 }}>
              <div style={{ fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>📊 สรุปตามสาขา</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#f0f4f9" }}>
                  <tr>
                    <th style={th}>สาขา</th>
                    <th style={{ ...th, textAlign: "right" }}>ขายปลีก</th>
                    <th style={{ ...th, textAlign: "right" }}>ขายไฟแนนซ์</th>
                    <th style={{ ...th, textAlign: "right" }}>อื่นๆ</th>
                    <th style={{ ...th, textAlign: "right" }}>รวมใบ</th>
                    <th style={{ ...th, textAlign: "right" }}>ยอดเงินรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map(b => (
                    <tr key={b.branch} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{b.branch}</td>
                      <td style={{ ...td, textAlign: "right" }}>{b.retail}</td>
                      <td style={{ ...td, textAlign: "right" }}>{b.finance}</td>
                      <td style={{ ...td, textAlign: "right" }}>{b.other}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{b.total}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{fmt(b.total_amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                    <td style={td}>รวม</td>
                    <td style={{ ...td, textAlign: "right" }}>{branches.reduce((s, b) => s + b.retail, 0)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{branches.reduce((s, b) => s + b.finance, 0)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{branches.reduce((s, b) => s + b.other, 0)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{grandTotal}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(grandAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: 12 }}>
              <div style={{ fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>📄 รายการขาย ({salesRows.length} ใบ — ไม่รวมขายส่ง)</div>
              <div style={{ overflowX: "auto", maxHeight: 500 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: "#072d6b", color: "#fff", position: "sticky", top: 0 }}>
                    <tr>
                      <th style={th}>#</th>
                      <th style={th}>วันที่</th>
                      <th style={th}>เลขใบขาย</th>
                      <th style={th}>ประเภท</th>
                      <th style={th}>ลูกค้า</th>
                      <th style={th}>รุ่น</th>
                      <th style={th}>เลขตัวถัง</th>
                      <th style={th}>สาขา</th>
                      <th style={th}>พนักงานขาย</th>
                      <th style={{ ...th, textAlign: "right" }}>ยอดเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                    {!loading && salesRows.length === 0 && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                    {salesRows.map((r, i) => (
                      <tr key={r.sale_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={td}>{fmtDate(r.sale_date)}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.invoice_no}</td>
                        <td style={td}>{r.invoice_type || "-"}</td>
                        <td style={td}>{r.customer_name || "-"}</td>
                        <td style={td}>{[r.brand, r.model_series].filter(Boolean).join(" · ")}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.branch_code || "-"}</td>
                        <td style={td}>{r.sales_person || "-"}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

      {tab === "commission" && (<>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        <Card label="👥 พนักงาน" value={rows.length} color="#1e40af" />
        <Card label="🚗 ใบขาย" value={totalSales} color="#0369a1" />
        <Card label="💰 ค่าคอมรวม" value={fmt(total)} color="#059669" highlight />
      </div>

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>#</th><th style={th}>พนักงาน</th><th style={th}>สาขา</th>
              <th style={{ ...th, textAlign: "right" }}>จำนวนใบขาย</th>
              <th style={{ ...th, textAlign: "right" }}>ค่าคอมหลัก</th>
              <th style={{ ...th, textAlign: "right" }}>ค่าคอมไฟแนนซ์ (05/06)</th>
              <th style={{ ...th, textAlign: "right" }}>รวม</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.employee_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, fontWeight: 600 }}>{r.employee_name}</td>
                <td style={{ ...td, fontFamily: "monospace" }}>{r.branch_code || "-"}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.sales_count}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.total_main)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.total_finance)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.total_commission)}</td>
                <td style={td}><button onClick={() => openDetail(r)} style={btnSmBlue}>📋 รายละเอียด</button></td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม</td>
                <td style={{ ...td, textAlign: "right" }}>{totalSales}</td>
                <td colSpan={2}></td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(total)}</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </>)}

      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1400, width: "95%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 {detail.emp?.employee_name} · {detail.emp?.branch_code} · ยอดรวม {fmt(detail.emp?.total_commission)}</h3>
              <button onClick={() => setDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {detail.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f0f4f9" }}>
                  <tr>
                    <th style={th}>#</th><th style={th}>วันที่</th><th style={th}>เลขใบขาย</th>
                    <th style={th}>ประเภท</th><th style={th}>ลูกค้า</th><th style={th}>รุ่น</th>
                    <th style={{ ...th, textAlign: "center" }}>idx</th>
                    <th style={{ ...th, textAlign: "center" }}>เป้า</th>
                    <th style={{ ...th, textAlign: "center" }}>หาร</th>
                    <th style={{ ...th, textAlign: "right" }}>ค่าคอมหลัก</th>
                    <th style={{ ...th, textAlign: "right" }}>ค่าคอมไฟแนนซ์</th>
                    <th style={{ ...th, textAlign: "right" }}>รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.rows.length === 0 && <tr><td colSpan={12} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                  {detail.rows.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>{fmtDate(r.sale_date)}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{r.invoice_no}</td>
                      <td style={td}>{r.invoice_type}</td>
                      <td style={td}>{r.customer_name}</td>
                      <td style={td}>{r.brand} · {r.model_series}</td>
                      <td style={{ ...td, textAlign: "center" }}>{r.idx}</td>
                      <td style={{ ...td, textAlign: "center" }}>{r.target}</td>
                      <td style={{ ...td, textAlign: "center" }}>÷{r.headcount}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.comm_main)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.comm_finance)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.comm_total)}</td>
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
