import React, { useEffect, useState } from "react";

const HR_API = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";

function fmtN(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

const SOURCE_BADGE = {
  commission: { label: "ค่าคอม", bg: "#dcfce7", color: "#14532d" },
  salary: { label: "เงินเดือน", bg: "#dbeafe", color: "#1e40af" },
};

export default function HrYtdReportPage() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [company, setCompany] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState({}); // key → true

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [year]);

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ytd_report", date_from: `${year}-01-01`, date_to: `${year}-12-31` }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data.filter(r => r && r.employee_name) : []);
    } catch { setMessage("❌ โหลดข้อมูลไม่สำเร็จ (ตรวจว่า re-import HR API แล้วหรือยัง)"); setRows([]); }
    setLoading(false);
  }

  // จัดกลุ่มตาม บริษัท+ชื่อ
  const kw = search.trim().toLowerCase();
  const groups = {};
  rows.forEach(r => {
    if (company && (r.company || "-") !== company) return;
    if (kw) {
      const hay = `${r.employee_name || ""} ${r.employee_code || ""}`.toLowerCase();
      if (!hay.includes(kw)) return;
    }
    const key = `${r.company || "-"}|${r.employee_name}`;
    if (!groups[key]) groups[key] = { company: r.company || "-", name: r.employee_name, code: r.employee_code || "", items: [], income: 0, sso: 0, wht: 0, deduct: 0, net: 0 };
    const g = groups[key];
    if (!g.code && r.employee_code) g.code = r.employee_code;
    g.items.push(r);
    g.income += Number(r.income || 0);
    g.sso += Number(r.sso || 0);
    g.wht += Number(r.wht || 0);
    g.deduct += Number(r.deduct_other || 0);
    g.net += Number(r.net || 0);
  });
  const groupList = Object.values(groups).sort((a, b) =>
    (a.company !== b.company) ? a.company.localeCompare(b.company, "th")
      : String(a.code || "๙๙").localeCompare(String(b.code || "๙๙"), "th"));

  const sumNet = groupList.reduce((s, g) => s + g.net, 0);
  const sumWht = groupList.reduce((s, g) => s + g.wht, 0);
  const sumIncome = groupList.reduce((s, g) => s + g.income, 0);

  const yearOptions = [];
  for (let y = 2026; y <= thisYear + 1; y++) yearOptions.push(y);

  function toggle(key) { setExpanded(p => ({ ...p, [key]: !p[key] })); }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📈 รายงานเงินเดือน/ค่าจ้างสะสม</h2>
      </div>

      {message && <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>{message}</div>}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>ปี:</label>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={inp}>
          {yearOptions.map(y => <option key={y} value={y}>{y} (พ.ศ. {y + 543})</option>)}
        </select>
        <label style={{ fontSize: 13, fontWeight: 600 }}>บริษัท:</label>
        <select value={company} onChange={e => setCompany(e.target.value)} style={inp}>
          <option value="">ทั้งหมด</option>
          <option value="ป.เปา">ป.เปา</option>
          <option value="สิงห์ชัย">สิงห์ชัย</option>
        </select>
        <input type="text" placeholder="🔍 ค้นหาชื่อ / รหัสพนักงาน"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 220 }} />
        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 16px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          🔄 รีเฟรช
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <SummaryCard label="👥 พนักงาน" value={`${groupList.length} คน`} color="#072d6b" />
        <SummaryCard label="💰 รวมเงินได้" value={fmtN(sumIncome)} color="#059669" />
        <SummaryCard label="🧾 ภาษีที่หัก" value={fmtN(sumWht)} color="#dc2626" />
        <SummaryCard label="💵 ยอดจ่ายรวมสุทธิ" value={fmtN(sumNet)} color="#1e40af" />
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        {loading ? <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        : groupList.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล — ตรวจว่ารันไฟล์ HR_YTD_History_Inserts.sql และ re-import HR API แล้ว</div>
        : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: 30 }}></th>
                <th style={th}>บริษัท</th>
                <th style={th}>พนักงาน (รหัส)</th>
                <th style={{ ...th, textAlign: "right" }}>รวมเงินได้</th>
                <th style={{ ...th, textAlign: "right" }}>ประกันสังคม</th>
                <th style={{ ...th, textAlign: "right" }}>หัก ณ ที่จ่าย</th>
                <th style={{ ...th, textAlign: "right" }}>รวมรายการปรับลด</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดจ่ายรวมสุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {groupList.map(g => {
                const key = `${g.company}|${g.name}`;
                const open = !!expanded[key];
                const items = [...g.items].sort((a, b) => String(a.pay_date).localeCompare(String(b.pay_date)));
                return (
                  <React.Fragment key={key}>
                    <tr onClick={() => toggle(key)}
                      style={{ borderTop: "2px solid #e5e7eb", cursor: "pointer", background: open ? "#eff6ff" : undefined }}>
                      <td style={{ ...td, textAlign: "center", color: "#0369a1" }}>{open ? "▾" : "▸"}</td>
                      <td style={{ ...td, fontSize: 12 }}>{g.company}</td>
                      <td style={{ ...td, fontWeight: 700, color: "#0369a1" }}>
                        {g.name}{g.code ? <span style={{ fontWeight: 400, color: "#6b7280" }}> ({g.code})</span> : ""}
                      </td>
                      <td style={tdNum}>{fmtN(g.income)}</td>
                      <td style={tdNum}>{fmtN(g.sso)}</td>
                      <td style={tdNum}>{fmtN(g.wht)}</td>
                      <td style={tdNum}>{fmtN(g.deduct)}</td>
                      <td style={{ ...tdNum, fontWeight: 700, color: "#1e40af" }}>{fmtN(g.net)}</td>
                    </tr>
                    {open && items.map((r, i) => {
                      const badge = SOURCE_BADGE[r.source];
                      return (
                        <tr key={i} style={{ borderTop: "1px solid #f1f5f9", background: "#fafafa" }}>
                          <td style={td}></td>
                          <td style={td}></td>
                          <td style={{ ...td, paddingLeft: 28, fontSize: 12, color: "#374151" }}>
                            {fmtDate(r.pay_date)}
                            {badge && <span style={{ marginLeft: 8, padding: "1px 7px", fontSize: 10, borderRadius: 3, background: badge.bg, color: badge.color }}>{badge.label}</span>}
                          </td>
                          <td style={{ ...tdNum, fontSize: 12 }}>{fmtN(r.income)}</td>
                          <td style={{ ...tdNum, fontSize: 12 }}>{fmtN(r.sso)}</td>
                          <td style={{ ...tdNum, fontSize: 12 }}>{fmtN(r.wht)}</td>
                          <td style={{ ...tdNum, fontSize: 12 }}>{fmtN(r.deduct_other)}</td>
                          <td style={{ ...tdNum, fontSize: 12 }}>{fmtN(r.net)}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
              <tr>
                <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม {groupList.length} คน</td>
                <td style={tdNum}>{fmtN(sumIncome)}</td>
                <td style={tdNum}>{fmtN(groupList.reduce((s, g) => s + g.sso, 0))}</td>
                <td style={tdNum}>{fmtN(sumWht)}</td>
                <td style={tdNum}>{fmtN(groupList.reduce((s, g) => s + g.deduct, 0))}</td>
                <td style={{ ...tdNum, color: "#1e40af" }}>{fmtN(sumNet)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#6b7280" }}>
        💡 ข้อมูล ม.ค. – ต้น ก.ค. 2569 มาจากระบบเดิม (นำเข้า) · ตั้งแต่รอบ ก.ค. 2569 ระบบดึงจากบันทึกเงินเดือน + ค่าคอมมิชั่นอัตโนมัติ
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 160, padding: "12px 16px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 13, whiteSpace: "nowrap" };
const tdNum = { padding: "8px", fontSize: 13, whiteSpace: "nowrap", textAlign: "right", fontFamily: "monospace" };
