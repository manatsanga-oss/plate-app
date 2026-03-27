import { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/office-api";

const SINGCHAI_BRANCHES = ["SCY01", "SCY04", "SCY07"];
const PPAO_BRANCHES = ["SCY05", "SCY06"];

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const months = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${months[Number(m)]} ${Number(y) + 543}`;
}

export default function DashboardPage({ currentUser }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());

  useEffect(() => {
    loadDashboard(selectedMonth);
  }, []);

  async function loadDashboard(month) {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_dashboard", month }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setData(result);
    } catch (e) {
      setError("โหลดข้อมูลไม่สำเร็จ: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleMonthChange(e) {
    setSelectedMonth(e.target.value);
  }

  function handleLoad() {
    loadDashboard(selectedMonth);
  }

  function fmt(v, d = 0) {
    const n = Number(v) || 0;
    return n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtMoney(v) { return fmt(v, 2); }

  const singchai = data?.singchai || {};
  const ppao = data?.ppao || {};
  const singchaiBranches = (data?.branch_usage || []).filter(b =>
    SINGCHAI_BRANCHES.some(code => (b.branch || "").startsWith(code))
  );
  const ppaoBranches = (data?.branch_usage || []).filter(b =>
    PPAO_BRANCHES.some(code => (b.branch || "").startsWith(code))
  );

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Top bar */}
        <div style={S.card}>
          <div style={S.cardBody}>
            <div style={S.topBar}>
              <span style={S.titleText}>📊 ภาพรวมวัสดุ</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ fontSize: 12, color: "#555" }}>เดือน:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  style={S.monthInput}
                />
                <button style={S.loadBtn} onClick={handleLoad} disabled={loading}>
                  {loading ? "กำลังโหลด..." : "แสดง"}
                </button>
              </div>
              <span style={S.monthBadge}>{monthLabel(selectedMonth)}</span>
              <span style={S.userInfo}>
                👤 {currentUser?.name || "-"} &nbsp;|&nbsp; 🏢 {currentUser?.branch || "-"}
              </span>
            </div>
          </div>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {loading && !data ? (
          <div style={S.loadingBox}>กำลังโหลดข้อมูล...</div>
        ) : (
          <div style={S.twoCol}>
            <GroupCard
              title="สิงห์ชัยสยามยนต์"
              subtitle="SCY01, SCY04, SCY07"
              color="#1565C0"
              lightBg="#e3f2fd"
              stockData={singchai}
              branchData={singchaiBranches}
              fmt={fmt}
              fmtMoney={fmtMoney}
              monthLabel={monthLabel(selectedMonth)}
            />
            <GroupCard
              title="ป.เปามอเตอร์เซอร์วิส"
              subtitle="SCY05, SCY06"
              color="#2e7d32"
              lightBg="#e8f5e9"
              stockData={ppao}
              branchData={ppaoBranches}
              fmt={fmt}
              fmtMoney={fmtMoney}
              monthLabel={monthLabel(selectedMonth)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function GroupCard({ title, subtitle, color, lightBg, stockData, branchData, fmt, fmtMoney, monthLabel }) {
  const totalIssues = branchData.reduce((s, b) => s + (Number(b.issue_count) || 0), 0);
  const totalQty = branchData.reduce((s, b) => s + (Number(b.total_qty) || 0), 0);
  const totalValue = branchData.reduce((s, b) => s + (Number(b.total_value) || 0), 0);

  return (
    <div style={{ ...S.card, borderTop: `3px solid ${color}` }}>
      {/* Group header */}
      <div style={{ ...S.cardHeader, color, background: lightBg }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#666", fontWeight: 400 }}>{subtitle}</div>
      </div>
      <div style={S.cardBody}>
        {/* Stock remaining */}
        <div style={S.sectionLabel}>วัสดุคงเหลือ</div>
        <div style={S.statRow3}>
          <StatBox label="รายการสินค้า" value={fmt(stockData.item_count || 0)} unit="รายการ" color={color} />
          <StatBox label="จำนวนรวม" value={fmt(stockData.total_qty || 0)} unit="ชิ้น" color={color} />
          <StatBox label="มูลค่ารวม" value={fmtMoney(stockData.total_value || 0)} unit="บาท" color={color} />
        </div>

        {/* Usage this month */}
        <div style={{ ...S.sectionLabel, marginTop: 12 }}>
          การเบิกวัสดุ — {monthLabel}
        </div>
        {branchData.length === 0 ? (
          <div style={S.emptyBox}>ยังไม่มีข้อมูลการเบิก</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr style={{ background: lightBg }}>
                <th style={S.th}>สาขา</th>
                <th style={{ ...S.th, textAlign: "right" }}>ใบเบิก</th>
                <th style={{ ...S.th, textAlign: "right" }}>จำนวน (ชิ้น)</th>
                <th style={{ ...S.th, textAlign: "right" }}>มูลค่า (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {branchData.map((b, i) => (
                <tr key={i} style={i % 2 === 1 ? { background: "#fafafa" } : {}}>
                  <td style={S.td}>{b.branch}</td>
                  <td style={{ ...S.td, textAlign: "right" }}>{fmt(b.issue_count)}</td>
                  <td style={{ ...S.td, textAlign: "right" }}>{fmt(b.total_qty)}</td>
                  <td style={{ ...S.td, textAlign: "right" }}>{fmtMoney(b.total_value)}</td>
                </tr>
              ))}
              {/* Summary row */}
              <tr style={{ background: lightBg, fontWeight: 700 }}>
                <td style={{ ...S.td, fontWeight: 700 }}>รวม</td>
                <td style={{ ...S.td, textAlign: "right", fontWeight: 700 }}>{fmt(totalIssues)}</td>
                <td style={{ ...S.td, textAlign: "right", fontWeight: 700 }}>{fmt(totalQty)}</td>
                <td style={{ ...S.td, textAlign: "right", fontWeight: 700, color }}>{fmtMoney(totalValue)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, unit, color }) {
  return (
    <div style={{ ...S.statBox, borderTop: `2px solid ${color}` }}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, color }}>{value}</div>
      <div style={S.statUnit}>{unit}</div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#f0f2f5",
    padding: "16px",
    boxSizing: "border-box",
    fontFamily: "Tahoma, Arial, sans-serif",
    fontSize: "13px",
    color: "#333",
  },
  container: { width: "100%", maxWidth: 1200, margin: "0 auto" },
  card: {
    background: "#fff",
    border: "1px solid #d9d9d9",
    borderRadius: "4px",
    marginBottom: "12px",
    overflow: "hidden",
  },
  cardHeader: {
    padding: "8px 14px",
    borderBottom: "1px solid #e8e8e8",
    fontSize: "13px",
    fontWeight: "700",
    color: "#1565C0",
    background: "#fafafa",
  },
  cardBody: { padding: "12px 14px" },
  topBar: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  titleText: { fontSize: 15, fontWeight: 700, color: "#1565C0" },
  monthInput: {
    border: "1px solid #d9d9d9",
    borderRadius: 3,
    padding: "4px 8px",
    fontSize: 13,
    outline: "none",
  },
  loadBtn: {
    background: "#1565C0",
    color: "#fff",
    border: "none",
    borderRadius: 3,
    padding: "4px 14px",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 600,
  },
  monthBadge: {
    fontSize: 12,
    color: "#1565C0",
    fontWeight: 700,
    background: "#e3f2fd",
    border: "1px solid #90caf9",
    borderRadius: 3,
    padding: "2px 8px",
  },
  userInfo: {
    marginLeft: "auto",
    fontSize: 12,
    color: "#555",
    padding: "3px 8px",
    background: "#f5f5f5",
    border: "1px solid #e0e0e0",
    borderRadius: 3,
  },
  errorBox: {
    background: "#fff2f0",
    border: "1px solid #ffccc7",
    borderRadius: 4,
    padding: "10px 14px",
    color: "#c62828",
    fontSize: 13,
    marginBottom: 12,
  },
  loadingBox: { padding: 40, textAlign: "center", color: "#888", fontSize: 14 },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 6,
  },
  statRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "8px",
  },
  statRow3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  },
  statBox: {
    background: "#fafafa",
    border: "1px solid #e8e8e8",
    borderRadius: 3,
    padding: "8px 10px",
    textAlign: "center",
  },
  statLabel: { fontSize: 11, color: "#888", marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: 700 },
  statUnit: { fontSize: 11, color: "#888", marginTop: 2 },
  emptyBox: {
    border: "1px dashed #ddd",
    background: "#fafafa",
    borderRadius: 3,
    padding: "12px",
    textAlign: "center",
    color: "#aaa",
    fontSize: 12,
  },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 4 },
  th: {
    fontWeight: 700,
    fontSize: 12,
    padding: "5px 8px",
    borderBottom: "1px solid #e8e8e8",
    textAlign: "left",
    color: "#444",
  },
  td: {
    padding: "5px 8px",
    borderBottom: "1px solid #f0f0f0",
    fontSize: 12,
    color: "#333",
    verticalAlign: "middle",
  },
};
