import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";

function firstOfMonth(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function HrPayrollPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState(firstOfMonth(new Date()));
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [message, setMessage] = useState("");
  const [detailRow, setDetailRow] = useState(null);

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [month]);

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "calc_payroll", month_year: month }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ คำนวณไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  function fmtNum(v) {
    return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function monthDisplay(d) {
    if (!d) return "-";
    const dt = new Date(d);
    if (isNaN(dt)) return String(d).slice(0, 7);
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return `${months[dt.getMonth()]} ${dt.getFullYear() + 543}`;
  }

  // local filter
  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (filterBranch && r.affiliation !== filterBranch) return false;
    if (!kw) return true;
    const hay = [r.employee_name, r.team_name, r.affiliation, r.bank_account_no].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const branches = [...new Set(rows.map(r => r.affiliation).filter(Boolean))].sort();

  // totals
  const sum = (key) => filtered.reduce((s, r) => s + Number(r[key] || 0), 0);

  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = ["สังกัด","ชื่อ","ธนาคาร","เลขที่บัญชี","เงินเดือน","โบนัส","OT-วันทำงาน","OT-ปกติ","ค่าข้าว","ค่าซักเสื้อ","ค่าเบี้ยขยัน","เงินเพิ่มพิเศษ","รายได้อื่นๆ","รวมรายได้","ประกันสังคม","ภาษี","กองทุนสำรองฯ","ค่าใช้จ่ายผู้บริหาร","ของหาย","รายจ่ายอื่นๆ","ขาด-สาย","รวมรายจ่าย","รายได้สุทธิ"];
    const rowsCsv = filtered.map(r => [
      r.affiliation || "", r.employee_name, r.bank_name || "", r.bank_account_no || "",
      r.salary || 0, r.bonus || 0, r.ot_workday || 0, r.ot_holiday || 0,
      r.meal_allowance || 0, r.laundry_allowance || 0, r.diligence_allowance || 0,
      r.extra_bonus || 0, r.other_income || 0, r.total_income || 0,
      r.sso_amount || 0, r.tax || 0, r.pf_amount || 0,
      r.admin_expense || 0, r.lost_items || 0, r.other_expense || 0, r.absence_late || 0,
      r.total_expense || 0, r.net_income || 0,
    ].map(v => typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v).join(","));
    const csv = "﻿" + headers.join(",") + "\n" + rowsCsv.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payroll_${month}.csv`;
    a.click();
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 คำนวณเงินเดือน</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>{message}</div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>เดือน:</label>
        <input type="month" value={month.slice(0, 7)} onChange={e => setMonth(e.target.value + "-01")} style={inp} />
        <span style={{ fontSize: 13, color: "#072d6b", fontWeight: 600 }}>{monthDisplay(month)}</span>

        <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={inp}>
          <option value="">ทุกสังกัด</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <input type="text" placeholder="🔍 ค้นหาพนักงาน"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 200 }} />

        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          🔄 คำนวณใหม่
        </button>
        <button onClick={exportCSV} disabled={filtered.length === 0}
          style={{ padding: "7px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          📥 Export CSV
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13 }}>👥 พนักงาน: <strong>{filtered.length}</strong></span>
        <span style={{ fontSize: 13, color: "#059669" }}>💰 รวมรายได้: <strong>{fmtNum(sum("total_income"))}</strong></span>
        <span style={{ fontSize: 13, color: "#dc2626" }}>📤 รวมรายจ่าย: <strong>{fmtNum(sum("total_expense"))}</strong></span>
        <span style={{ fontSize: 14, color: "#7c3aed", fontWeight: 700 }}>💵 รวมจ่ายสุทธิ: {fmtNum(sum("net_income"))} บาท</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังคำนวณ...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล — เพิ่มพนักงานในหน้า "ข้อมูลพนักงาน" ก่อน</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead style={{ background: "#072d6b", color: "#fff", position: "sticky", top: 0 }}>
              <tr>
                <th style={th}>สังกัด</th>
                <th style={th}>ชื่อ</th>
                <th style={th}>ธนาคาร / เลขบัญชี</th>
                <th style={{ ...th, textAlign: "right" }}>เงินเดือน</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>โบนัส</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>OT-ปท.</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>OT-นอก</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>ค่าข้าว</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>ซักเสื้อ</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>เบี้ยขยัน</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>พิเศษ</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>อื่นๆ</th>
                <th style={{ ...th, textAlign: "right", background: "#065f46" }}>รวมรายได้</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>SSO</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ภาษี</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>กองทุนฯ</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ผู้บริหาร</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ของหาย</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>อื่นๆ</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ขาด-สาย</th>
                <th style={{ ...th, textAlign: "right", background: "#7f1d1d" }}>รวมรายจ่าย</th>
                <th style={{ ...th, textAlign: "right", background: "#581c87" }}>สุทธิ</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.employee_id} style={{ borderTop: "1px solid #e5e7eb", background: r.is_executive ? "#fef3c7" : "transparent" }}>
                  <td style={td}>{r.affiliation || "-"}</td>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {r.employee_name}
                    {r.is_executive && <span style={{ marginLeft: 4, fontSize: 9, padding: "1px 4px", background: "#fde68a", color: "#92400e", borderRadius: 3 }}>ผบ.</span>}
                  </td>
                  <td style={{ ...td, fontSize: 10 }}>
                    <div>{r.bank_name || "-"}</div>
                    <div style={{ fontFamily: "monospace", color: "#0369a1" }}>{r.bank_account_no || "-"}</div>
                  </td>
                  <td style={tdNum}>{fmtNum(r.salary)}</td>
                  <td style={tdNum}>{fmtNum(r.bonus)}</td>
                  <td style={tdNum}>{fmtNum(r.ot_workday)}</td>
                  <td style={tdNum}>{fmtNum(r.ot_holiday)}</td>
                  <td style={tdNum}>{fmtNum(r.meal_allowance)}</td>
                  <td style={tdNum}>{fmtNum(r.laundry_allowance)}</td>
                  <td style={tdNum}>{fmtNum(r.diligence_allowance)}</td>
                  <td style={tdNum}>{fmtNum(r.extra_bonus)}</td>
                  <td style={tdNum}>{fmtNum(r.other_income)}</td>
                  <td style={{ ...tdNum, background: "#d1fae5", fontWeight: 700, color: "#065f46" }}>{fmtNum(r.total_income)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.sso_amount)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.tax)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.pf_amount)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.admin_expense)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.lost_items)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.other_expense)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.absence_late)}</td>
                  <td style={{ ...tdNum, background: "#fee2e2", fontWeight: 700, color: "#991b1b" }}>{fmtNum(r.total_expense)}</td>
                  <td style={{ ...tdNum, background: "#ede9fe", fontWeight: 700, color: "#5b21b6", fontSize: 12 }}>{fmtNum(r.net_income)}</td>
                  <td style={td}>
                    <button onClick={() => setDetailRow(r)} style={btnView}>ดู</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: "#f3f4f6", fontWeight: 700, position: "sticky", bottom: 0 }}>
              <tr>
                <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} คน</td>
                <td style={tdNum}>{fmtNum(sum("salary"))}</td>
                <td style={tdNum}>{fmtNum(sum("bonus"))}</td>
                <td style={tdNum}>{fmtNum(sum("ot_workday"))}</td>
                <td style={tdNum}>{fmtNum(sum("ot_holiday"))}</td>
                <td style={tdNum}>{fmtNum(sum("meal_allowance"))}</td>
                <td style={tdNum}>{fmtNum(sum("laundry_allowance"))}</td>
                <td style={tdNum}>{fmtNum(sum("diligence_allowance"))}</td>
                <td style={tdNum}>{fmtNum(sum("extra_bonus"))}</td>
                <td style={tdNum}>{fmtNum(sum("other_income"))}</td>
                <td style={{ ...tdNum, background: "#d1fae5", color: "#065f46" }}>{fmtNum(sum("total_income"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("sso_amount"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("tax"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("pf_amount"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("admin_expense"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("lost_items"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("other_expense"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("absence_late"))}</td>
                <td style={{ ...tdNum, background: "#fee2e2", color: "#991b1b" }}>{fmtNum(sum("total_expense"))}</td>
                <td style={{ ...tdNum, background: "#ede9fe", color: "#5b21b6", fontSize: 13 }}>{fmtNum(sum("net_income"))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Detail popup (สลิปเงินเดือน) */}
      {detailRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDetailRow(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 6px", color: "#072d6b", textAlign: "center" }}>📄 สลิปเงินเดือน</h3>
            <div style={{ textAlign: "center", marginBottom: 12, fontSize: 13, color: "#6b7280" }}>{monthDisplay(month)}</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14, fontSize: 13 }}>
              <KV label="ชื่อ" value={detailRow.employee_name} />
              <KV label="สังกัด" value={detailRow.affiliation} />
              <KV label="ตำแหน่ง" value={detailRow.position} />
              <KV label="ธนาคาร" value={detailRow.bank_name} />
              <KV label="เลขที่บัญชี" value={detailRow.bank_account_no} mono />
            </div>

            <div style={{ background: "#d1fae5", padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: "#065f46", marginBottom: 6 }}>💰 รายได้</div>
              <RowKV label="เงินเดือน" value={fmtNum(detailRow.salary)} />
              <RowKV label="โบนัส" value={fmtNum(detailRow.bonus)} />
              <RowKV label="OT-วันทำงาน" value={fmtNum(detailRow.ot_workday)} />
              <RowKV label="OT-ปกติ" value={fmtNum(detailRow.ot_holiday)} />
              <RowKV label="ค่าข้าว" value={fmtNum(detailRow.meal_allowance)} />
              <RowKV label="ค่าซักเสื้อ" value={fmtNum(detailRow.laundry_allowance)} />
              <RowKV label="ค่าเบี้ยขยัน" value={fmtNum(detailRow.diligence_allowance)} />
              <RowKV label="เงินเพิ่มพิเศษ" value={fmtNum(detailRow.extra_bonus)} />
              <RowKV label="รายได้อื่นๆ" value={fmtNum(detailRow.other_income)} />
              <RowKV label="รวมรายได้" value={fmtNum(detailRow.total_income)} bold />
            </div>

            <div style={{ background: "#fee2e2", padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>📤 รายจ่าย</div>
              <RowKV label="ประกันสังคม (cap 750)" value={fmtNum(detailRow.sso_amount)} />
              <RowKV label="ภาษี" value={fmtNum(detailRow.tax)} />
              <RowKV label="กองทุนสำรองฯ" value={fmtNum(detailRow.pf_amount)} />
              <RowKV label="ค่าใช้จ่ายผู้บริหาร" value={fmtNum(detailRow.admin_expense)} />
              <RowKV label="ของหาย" value={fmtNum(detailRow.lost_items)} />
              <RowKV label="รายจ่ายอื่นๆ" value={fmtNum(detailRow.other_expense)} />
              <RowKV label="ขาด-สาย" value={fmtNum(detailRow.absence_late)} />
              <RowKV label="รวมรายจ่าย" value={fmtNum(detailRow.total_expense)} bold />
            </div>

            <div style={{ background: "#ede9fe", padding: 12, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#5b21b6" }}>💵 รายได้สุทธิ</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#5b21b6" }}>{fmtNum(detailRow.net_income)} บาท</div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setDetailRow(null)} style={{ padding: "8px 16px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 600, fontFamily: mono ? "monospace" : "inherit" }}>{value || "-"}</div>
    </div>
  );
}
function RowKV({ label, value, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderTop: bold ? "1px solid rgba(0,0,0,0.1)" : "none", marginTop: bold ? 4 : 0, paddingTop: bold ? 8 : 3 }}>
      <span style={{ fontSize: 12, fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontFamily: "monospace", fontWeight: bold ? 700 : 400, fontSize: 13 }}>{value}</span>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "8px 6px", textAlign: "left", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "6px", fontSize: 11 };
const tdNum = { padding: "6px", fontSize: 11, textAlign: "right", fontFamily: "monospace" };
const btnView = { padding: "3px 8px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10 };
