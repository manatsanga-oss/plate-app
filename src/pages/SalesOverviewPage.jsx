import { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/mymotor-report";

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
  const months = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${months[Number(m)]} ${Number(y) + 543}`;
}

function shortMonthLabel(ym) {
  if (!ym) return "";
  const [, m] = ym.split("-");
  const months = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return months[Number(m)];
}

async function fetchRegByBranch(month) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "mymotor_reg_by_branch", month }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Normalize branch name: ลบ zero-width chars, แทน NBSP เป็น space, ยุบ whitespace, trim
function normalizeBranchName(s) {
  if (!s) return "";
  return String(s)
    .replace(/[​-‍﻿]/g, "") // zero-width chars + BOM
    .replace(/ /g, " ")               // NBSP → regular space
    .replace(/\s+/g, " ")                  // collapse all whitespace
    .trim();
}

// Fuzzy key: ตัด Thai combining marks (วรรณยุกต์ + สระบน/ล่าง + การันต์) สำหรับ group ชื่อสะกดต่างเข้าด้วยกัน
// เช่น "สีขวา", "สี่ขวา", "สิีขวา" → ทุกตัวจะ fuzzy = "สขวา"
function fuzzyBranchKey(s) {
  return normalizeBranchName(s)
    .replace(/[ัิ-ฺ็-๎]/g, "")
    .toLowerCase();
}

export default function SalesOverviewPage({ currentUser }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
  const [data, setData] = useState(null); // { months: [m1,m2,m3], byBranch: { branch_name: { m1: cnt, m2: cnt, m3: cnt } } }

  useEffect(() => {
    load3Months(selectedMonth);
    // eslint-disable-next-line
  }, []);

  async function load3Months(month) {
    try {
      setLoading(true);
      setError("");
      // 3 เดือน: 2 เดือนก่อน, 1 เดือนก่อน, เดือนปัจจุบัน
      const months = [shiftMonth(month, -2), shiftMonth(month, -1), month];
      const results = await Promise.all(months.map(m => fetchRegByBranch(m)));

      // เก็บข้อมูลทั้งหมดก่อน แล้ว group ด้วย fuzzy key (ตัดวรรณยุกต์/สระเสริม)
      // เพื่อรวม "สีขวา" / "สี่ขวา" / "สิีขวา" เข้าด้วยกัน
      const groups = {}; // fuzzyKey → { variants: { normName: count_total }, totals: { month: { reg, honda } } }
      results.forEach((r, i) => {
        const m = months[i];
        (r.branches || []).forEach(b => {
          const rawName = b.branch_name || "";
          const norm = normalizeBranchName(rawName);
          if (!norm) return;
          const fk = fuzzyBranchKey(norm);
          if (!fk) return;
          if (!groups[fk]) groups[fk] = { variants: {}, totals: {} };
          const cnt = Number(b.count) || 0;
          const honda = Number(b.honda_prev_count) || 0;
          groups[fk].variants[norm] = (groups[fk].variants[norm] || 0) + cnt;
          if (!groups[fk].totals[m]) groups[fk].totals[m] = { reg: 0, honda: 0 };
          groups[fk].totals[m].reg += cnt;
          groups[fk].totals[m].honda += honda;
        });
      });

      // เลือกชื่อ display = ตัวที่มียอดสูงสุดในกลุ่ม (ถ้าเสมอ → ตัวที่ยาวที่สุด)
      const byBranch = {};
      Object.values(groups).forEach(g => {
        const display = Object.entries(g.variants)
          .sort((a, b) => (b[1] - a[1]) || (b[0].length - a[0].length))[0][0];
        byBranch[display] = g.totals;
      });
      setData({ months, byBranch });
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

  // เตรียมข้อมูลสำหรับแสดง
  const months3 = data?.months || [];
  const HIDDEN_NAMES = new Set(["ไม่ระบุ", "(ไม่ระบุ)", "-", "ไม่ทราบ", "N/A", "na", "NA", ""]);
  const branchNames = data ? Object.keys(data.byBranch)
    .filter(n => !HIDDEN_NAMES.has((n || "").trim()))
    .sort((a, b) => {
      const ta = months3.reduce((s, m) => s + (data.byBranch[a][m]?.reg || 0), 0);
      const tb = months3.reduce((s, m) => s + (data.byBranch[b][m]?.reg || 0), 0);
      return tb - ta;
    }) : [];

  // หา max count เพื่อ scale แท่ง
  const allCounts = data ? branchNames.flatMap(n => months3.map(m => data.byBranch[n][m]?.reg || 0)) : [];
  const maxCount = Math.max(1, ...allCounts);

  // Total per month (รวมทุกร้าน)
  const monthTotals = months3.map(m => {
    let totalReg = 0, totalHonda = 0;
    branchNames.forEach(n => {
      totalReg += data.byBranch[n][m]?.reg || 0;
      totalHonda += data.byBranch[n][m]?.honda || 0;
    });
    return { month: m, total: totalReg, honda: totalHonda };
  });
  const grandTotal = monthTotals.reduce((s, x) => s + x.total, 0);

  const BAR_MAX_H = 150;
  const monthColors = ["#90caf9", "#42a5f5", "#1565c0"]; // light → dark blue

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Top bar */}
        <div style={S.card}>
          <div style={S.cardBody}>
            <div style={S.topBar}>
              <span style={S.titleText}>📊 ยอดลงทะเบียน MyMoto แยกสาขา</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ fontSize: 12, color: "#555" }}>เดือนปัจจุบัน:</label>
                <input type="month" value={selectedMonth} onChange={handleMonthChange} style={S.monthInput} />
              </div>
              <span style={S.monthBadge}>{monthLabel(selectedMonth)}</span>
              <span style={S.userInfo}>
                {currentUser?.name || "-"} | {currentUser?.branch || "-"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
              แสดง 3 เดือน: {months3.map(monthLabel).join(" → ")}
            </div>
          </div>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {loading ? (
          <div style={S.loadingBox}>กำลังโหลดข้อมูล...</div>
        ) : branchNames.length === 0 ? (
          <div style={S.emptyBox}>ยังไม่มีข้อมูล</div>
        ) : (
          <>
            {/* Summary 3 months total */}
            <div style={S.card}>
              <div style={{ ...S.cardHeader, color: "#1565c0", background: "#e3f2fd" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>📈 ภาพรวมยอดลงทะเบียน 3 เดือน (รวมทุกสาขา)</div>
              </div>
              <div style={S.cardBody}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {monthTotals.map((mt, i) => (
                    <div key={i} style={{ ...S.statBox, borderTop: `3px solid ${monthColors[i]}` }}>
                      <div style={S.statLabel}>{monthLabel(mt.month)}</div>
                      <div style={{ ...S.statValue, color: monthColors[i] }}>{mt.total}</div>
                      <div style={S.statUnit}>คัน</div>
                    </div>
                  ))}
                  <div style={{ ...S.statBox, borderTop: `3px solid #7b1fa2`, background: "#f3e5f5" }}>
                    <div style={S.statLabel}>รวม 3 เดือน</div>
                    <div style={{ ...S.statValue, color: "#7b1fa2" }}>{grandTotal}</div>
                    <div style={S.statUnit}>คัน</div>
                  </div>
                </div>
              </div>
            </div>

            {/* รวมทุกร้าน — แสดงด้านบน */}
            <div style={{ ...S.card, borderColor: "#7b1fa2", borderWidth: 2 }}>
              <div style={{ ...S.cardHeader, background: "#f3e5f5", color: "#7b1fa2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>📊 รวมทุกร้าน</div>
                <div style={{ fontSize: 12, color: "#7b1fa2" }}>รวม 3 เดือน <strong>{grandTotal}</strong> คัน</div>
              </div>
              <div style={S.cardBody}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 18, paddingTop: 8, paddingBottom: 4 }}>
                  {monthTotals.map((mt, mi) => {
                    const totalMax = Math.max(1, ...monthTotals.map(x => x.total));
                    const h = Math.max((mt.total / totalMax) * BAR_MAX_H, mt.total > 0 ? 4 : 1);
                    const pct = mt.honda > 0 ? (mt.total / mt.honda) * 100 : null;
                    const barColor = pct == null ? "#9e9e9e" : pct >= 50 ? "#1565c0" : "#c62828";
                    return (
                      <div key={mi} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: barColor, marginBottom: 6 }}>
                          {pct == null ? "—" : `${pct.toFixed(0)}%`}
                        </div>
                        <div style={{ height: BAR_MAX_H, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                          <div style={{
                            width: "70%", maxWidth: 100,
                            height: h, background: barColor,
                            borderRadius: "4px 4px 0 0",
                            transition: "height 0.5s, background 0.3s",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                          }} />
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: barColor, marginTop: 6 }}>{mt.total}</div>
                        <div style={{ fontSize: 12, color: "#555", marginTop: 2, fontWeight: 600 }}>{shortMonthLabel(mt.month)}</div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                          ลง <strong>{mt.total}</strong> / ขาย <strong>{mt.honda}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div style={{ ...S.card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>กราฟแท่งแยกสาขา (3 เดือน)</div>
              {months3.map((m, i) => (
                <span key={i} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ display: "inline-block", width: 14, height: 12, borderRadius: 2, background: monthColors[i] }} />
                  {shortMonthLabel(m)}
                </span>
              ))}
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#888" }}>เรียงตามยอดรวม 3 เดือน (มาก→น้อย)</span>
            </div>

            {/* Per-branch cards — 1 ร้าน / 1 แถว */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              {branchNames.map((name, bi) => {
                const monthData = months3.map(m => data.byBranch[name][m] || { reg: 0, honda: 0 });
                const total = monthData.reduce((s, x) => s + x.reg, 0);
                return (
                  <div key={bi} style={{ ...S.card, marginBottom: 0 }}>
                    <div style={{ ...S.cardHeader, background: "#e8eaf6", color: "#283593", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>🏪 {name}</div>
                      <div style={{ fontSize: 11, color: "#5c6bc0" }}>รวม <strong>{total}</strong> คัน</div>
                    </div>
                    <div style={S.cardBody}>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, paddingTop: 8, paddingBottom: 4 }}>
                        {months3.map((m, mi) => {
                          const { reg, honda } = monthData[mi];
                          const pct = honda > 0 ? (reg / honda) * 100 : null;
                          const barColor = pct == null ? "#9e9e9e" : pct >= 50 ? "#1565c0" : "#c62828";
                          const h = Math.max((reg / maxCount) * BAR_MAX_H, reg > 0 ? 4 : 1);
                          return (
                            <div key={mi} style={{ flex: 1, textAlign: "center" }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: barColor, marginBottom: 6 }}>
                                {pct == null ? "—" : `${pct.toFixed(0)}%`}
                              </div>
                              <div style={{ height: BAR_MAX_H, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                                <div style={{
                                  width: "70%", maxWidth: 60,
                                  height: h, background: barColor,
                                  borderRadius: "4px 4px 0 0",
                                  transition: "height 0.5s, background 0.3s",
                                  boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                                }} />
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: barColor, marginTop: 6 }}>{reg}</div>
                              <div style={{ fontSize: 11, color: "#555", marginTop: 2, fontWeight: 600 }}>{shortMonthLabel(m)}</div>
                              <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                                ลง <strong>{reg}</strong> / ขาย <strong>{honda}</strong>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
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
  container: { width: "100%", maxWidth: 1400, margin: "0 auto" },
  card: {
    background: "#fff", border: "1px solid #d9d9d9", borderRadius: "4px", marginBottom: "12px", overflow: "hidden",
  },
  cardHeader: {
    padding: "8px 14px", borderBottom: "1px solid #e8e8e8", fontSize: "13px", fontWeight: "700",
  },
  cardBody: { padding: "12px 14px" },
  topBar: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  titleText: { fontSize: 15, fontWeight: 700, color: "#1565c0" },
  monthInput: {
    border: "1px solid #d9d9d9", borderRadius: 3, padding: "4px 8px", fontSize: 13, outline: "none",
  },
  monthBadge: {
    fontSize: 12, color: "#1565c0", fontWeight: 700, background: "#e3f2fd",
    border: "1px solid #90caf9", borderRadius: 3, padding: "2px 8px",
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
  statBox: {
    background: "#fafafa", border: "1px solid #e8e8e8", borderRadius: 3, padding: "8px 10px", textAlign: "center",
  },
  statLabel: { fontSize: 11, color: "#888", marginBottom: 2 },
  statValue: { fontSize: 22, fontWeight: 700 },
  statUnit: { fontSize: 11, color: "#888", marginTop: 2 },
};
