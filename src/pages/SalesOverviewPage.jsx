import { useEffect, useState } from "react";

const REG_API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/mymotor-report";

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(ym, offset) {
  const [y, m] = ym.split("-").map(Number);
  let nm = m + offset;
  let ny = y;
  while (nm < 1) { nm += 12; ny--; }
  while (nm > 12) { nm -= 12; ny++; }
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function monthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const months = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${months[Number(m)]} ${Number(y) + 543}`;
}

function shortMonthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const months = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return months[Number(m)];
}

async function fetchMonth(month) {
  const res = await fetch(REG_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sales_vs_registration", month }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function SalesOverviewPage({ currentUser }) {
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());

  useEffect(() => {
    load3Months(selectedMonth);
  }, []);

  async function load3Months(month) {
    try {
      setLoading(true);
      setError("");
      const months = [shiftMonth(month, -2), shiftMonth(month, -1), month];
      const results = [];
      for (const m of months) {
        const r = await fetchMonth(m);
        results.push(r);
      }
      setChartData({ months, results });
    } catch (e) {
      setError("โหลดข้อมูลไม่สำเร็จ: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleMonthChange(e) {
    setSelectedMonth(e.target.value);
    load3Months(e.target.value);
  }

  // Merge data from 3 months into per-branch structure
  const branchMap = {};
  if (chartData) {
    chartData.results.forEach((res, mi) => {
      const m = chartData.months[mi];
      (res.branches || []).forEach(b => {
        if (!branchMap[b.branch_code]) {
          branchMap[b.branch_code] = { branch_code: b.branch_code, sales_branch: b.sales_branch, months: {} };
        }
        const sales = Number(b.last_month_sales) || 0;
        const reg = Number(b.current_month_reg) || 0;
        const pct = sales > 0 ? (reg / sales) * 100 : 0;
        branchMap[b.branch_code].months[m] = { sales, reg, pct };
      });
    });
  }
  const branches = Object.values(branchMap).sort((a, b) => a.branch_code.localeCompare(b.branch_code));
  const months3 = chartData?.months || [];

  // Calculate totals per month
  const monthTotals = months3.map(m => {
    let sales = 0, reg = 0;
    branches.forEach(b => {
      const d = b.months[m];
      if (d) { sales += d.sales; reg += d.reg; }
    });
    const pct = sales > 0 ? (reg / sales) * 100 : 0;
    return { month: m, sales, reg, pct };
  });

  function barColor(pct) {
    if (pct >= 50) return "#4caf50";
    return "#f44336";
  }

  const BAR_MAX_H = 140;
  const allPcts = branches.flatMap(b => months3.map(m => b.months[m]?.pct || 0));
  const maxPct = Math.max(100, ...allPcts, ...monthTotals.map(t => t.pct));
  const barColors3 = ["#90caf9", "#42a5f5", "#1565C0"];

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Top bar */}
        <div style={S.card}>
          <div style={S.cardBody}>
            <div style={S.topBar}>
              <span style={S.titleText}>สรุปภาพรวม ยอดขาย vs ลงทะเบียน</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ fontSize: 12, color: "#555" }}>เดือน:</label>
                <input type="month" value={selectedMonth} onChange={handleMonthChange} style={S.monthInput} />
              </div>
              <span style={S.monthBadge}>{monthLabel(selectedMonth)}</span>
              <span style={S.userInfo}>
                {currentUser?.name || "-"} | {currentUser?.branch || "-"}
              </span>
            </div>
          </div>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {loading ? (
          <div style={S.loadingBox}>กำลังโหลดข้อมูล...</div>
        ) : branches.length === 0 ? (
          <div style={S.emptyBox}>ยังไม่มีข้อมูล</div>
        ) : (
          <>
            {/* Summary totals - 3 months */}
            <div style={S.card}>
              <div style={{ ...S.cardHeader, color: "#7b1fa2", background: "#f3e5f5" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>ภาพรวมสัดส่วน 3 เดือน</div>
              </div>
              <div style={S.cardBody}>
                <div style={S.statRow3}>
                  {monthTotals.map((mt, i) => (
                    <div key={i} style={{ ...S.statBox, borderTop: `3px solid ${barColor(mt.pct)}` }}>
                      <div style={S.statLabel}>{monthLabel(mt.month)}</div>
                      <div style={{ ...S.statValue, color: barColor(mt.pct) }}>{mt.pct.toFixed(1)}%</div>
                      <div style={S.statUnit}>ขาย {mt.sales} / ลงทะเบียน {mt.reg}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bar chart per branch */}
            <div style={S.card}>
              <div style={{ ...S.cardHeader, color: "#333", background: "#fafafa" }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>กราฟสัดส่วนลงทะเบียน/ขาย แยกสาขา (3 เดือน)</div>
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  {months3.map((m, i) => (
                    <span key={i} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: barColors3[i] }} />
                      {shortMonthLabel(m)}
                    </span>
                  ))}
                  <span style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                    <span style={{ display: "inline-block", width: 12, height: 1, borderTop: "2px dashed #f44336" }} />
                    <span style={{ color: "#f44336" }}>เป้า 50%</span>
                  </span>
                </div>
              </div>
              <div style={S.cardBody}>
                {branches.map((branch, bi) => {
                  const line50 = (50 / maxPct) * BAR_MAX_H;
                  return (
                    <div key={bi} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: bi < branches.length - 1 ? "1px solid #eee" : "none" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                        {branch.sales_branch}
                        <span style={{ fontWeight: 400, fontSize: 11, color: "#999", marginLeft: 6 }}>{branch.branch_code}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, position: "relative", paddingTop: 20 }}>
                        {/* 50% line */}
                        <div style={{
                          position: "absolute", left: 0, right: 0, bottom: line50 + 28,
                          borderTop: "2px dashed #f44336", zIndex: 1,
                        }}>
                          <span style={{ position: "absolute", right: 0, top: -14, fontSize: 9, color: "#f44336" }}>50%</span>
                        </div>
                        {months3.map((m, mi) => {
                          const d = branch.months[m] || { sales: 0, reg: 0, pct: 0 };
                          const h = Math.max((d.pct / maxPct) * BAR_MAX_H, 4);
                          const color = d.pct < 50 ? "#f44336" : barColors3[mi];
                          return (
                            <div key={mi} style={{ flex: 1, textAlign: "center" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: d.pct < 50 ? "#f44336" : "#333", marginBottom: 4 }}>
                                {d.pct.toFixed(0)}%
                              </div>
                              <div style={{
                                width: "60%", maxWidth: 70, margin: "0 auto",
                                height: h, background: color,
                                borderRadius: "4px 4px 0 0",
                                transition: "height 0.5s",
                              }} />
                              <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>{shortMonthLabel(m)}</div>
                              <div style={{ fontSize: 9, color: "#999" }}>{d.reg}/{d.sales}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Total bar */}
                <div style={{ marginTop: 8, paddingTop: 12, borderTop: "2px solid #7b1fa2" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#7b1fa2" }}>รวมทั้งหมด</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 12, position: "relative", paddingTop: 20 }}>
                    <div style={{
                      position: "absolute", left: 0, right: 0, bottom: ((50 / maxPct) * BAR_MAX_H) + 28,
                      borderTop: "2px dashed #f44336", zIndex: 1,
                    }}>
                      <span style={{ position: "absolute", right: 0, top: -14, fontSize: 9, color: "#f44336" }}>50%</span>
                    </div>
                    {monthTotals.map((mt, mi) => {
                      const h = Math.max((mt.pct / maxPct) * BAR_MAX_H, 4);
                      const color = mt.pct < 50 ? "#f44336" : barColors3[mi];
                      return (
                        <div key={mi} style={{ flex: 1, textAlign: "center" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: mt.pct < 50 ? "#f44336" : "#333", marginBottom: 4 }}>
                            {mt.pct.toFixed(0)}%
                          </div>
                          <div style={{
                            width: "60%", maxWidth: 70, margin: "0 auto",
                            height: h, background: color,
                            borderRadius: "4px 4px 0 0",
                            transition: "height 0.5s",
                          }} />
                          <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>{shortMonthLabel(mt.month)}</div>
                          <div style={{ fontSize: 9, color: "#999" }}>{mt.reg}/{mt.sales}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh", background: "#f0f2f5", padding: "16px",
    boxSizing: "border-box", fontFamily: "Tahoma, Arial, sans-serif", fontSize: "13px", color: "#333",
  },
  container: { width: "100%", maxWidth: 1200, margin: "0 auto" },
  card: {
    background: "#fff", border: "1px solid #d9d9d9", borderRadius: "4px", marginBottom: "12px", overflow: "hidden",
  },
  cardHeader: {
    padding: "8px 14px", borderBottom: "1px solid #e8e8e8", fontSize: "13px", fontWeight: "700",
  },
  cardBody: { padding: "12px 14px" },
  topBar: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  titleText: { fontSize: 15, fontWeight: 700, color: "#7b1fa2" },
  monthInput: {
    border: "1px solid #d9d9d9", borderRadius: 3, padding: "4px 8px", fontSize: 13, outline: "none",
  },
  monthBadge: {
    fontSize: 12, color: "#7b1fa2", fontWeight: 700, background: "#f3e5f5",
    border: "1px solid #ce93d8", borderRadius: 3, padding: "2px 8px",
  },
  userInfo: {
    marginLeft: "auto", fontSize: 12, color: "#555", padding: "3px 8px",
    background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 3,
  },
  errorBox: {
    background: "#fff2f0", border: "1px solid #ffccc7", borderRadius: 4,
    padding: "10px 14px", color: "#c62828", fontSize: 13, marginBottom: 12,
  },
  loadingBox: { padding: 40, textAlign: "center", color: "#888", fontSize: 14 },
  emptyBox: {
    border: "1px dashed #ddd", background: "#fafafa", borderRadius: 3,
    padding: "24px", textAlign: "center", color: "#aaa", fontSize: 13,
  },
  statRow3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" },
  statBox: {
    background: "#fafafa", border: "1px solid #e8e8e8", borderRadius: 3, padding: "8px 10px", textAlign: "center",
  },
  statLabel: { fontSize: 11, color: "#888", marginBottom: 2 },
  statValue: { fontSize: 22, fontWeight: 700 },
  statUnit: { fontSize: 11, color: "#888", marginTop: 2 },
};
