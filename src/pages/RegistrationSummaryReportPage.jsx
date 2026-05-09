import React, { useEffect, useState } from "react";

const ACCOUNTING_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

const BRANCH_LABEL = {
  PAPAO: { label: "ป.เปา", bg: "#dbeafe", color: "#1e40af" },
  NAKORNLUANG: { label: "นครหลวง", bg: "#fef3c7", color: "#92400e" },
  SINGCHAI: { label: "สิงห์ชัย", bg: "#fce7f3", color: "#9d174d" },
};

export default function RegistrationSummaryReportPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [branchFilter, setBranchFilter] = useState("all");
  const [regPaidMonth, setRegPaidMonth] = useState("");  // YYYY-MM
  const [insPaidMonth, setInsPaidMonth] = useState("");  // YYYY-MM
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_registration_summary",
          date_from: dateFrom,
          date_to: dateTo,
        }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data?.rows || []);
      setRows(arr);
    } catch (e) {
      setRows([]);
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const kw = search.trim().toLowerCase();
  const monthOf = (v) => v ? String(v).slice(0, 7) : "";  // YYYY-MM
  const filtered = rows.filter(r => {
    if (branchFilter !== "all" && r.branch !== branchFilter) return false;
    if (regPaidMonth && monthOf(r.reg_paid_at) !== regPaidMonth) return false;
    if (insPaidMonth && monthOf(r.ins_paid_at) !== insPaidMonth) return false;
    if (!kw) return true;
    const hay = [r.tax_invoice_no, r.customer_name, r.sale_customer_name, r.chassis_no, r.engine_no, r.model_name, r.sale_finance_company, r.sale_invoice_no]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  // คำนวณ list ของเดือนที่มีในข้อมูล
  const regPaidMonthOpts = [...new Set(rows.map(r => monthOf(r.reg_paid_at)).filter(Boolean))].sort().reverse();
  const insPaidMonthOpts = [...new Set(rows.map(r => monthOf(r.ins_paid_at)).filter(Boolean))].sort().reverse();
  const fmtMonth = (ym) => {
    if (!ym) return "";
    const [y, m] = ym.split("-");
    const months = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return `${months[Number(m)] || m} ${(Number(y) + 543).toString().slice(-2)}`;
  };

  // ยอดจดทะเบียนรวม + ค่า พรบ. รวม
  const totalRegFee = filtered.reduce((s, r) => s + Number(r.total_registration_fee || 0), 0);
  const totalInsPremium = filtered.reduce((s, r) => s + Number(r.total_insurance_premium || 0), 0);

  // Summary by branch (count + reg fee + insurance)
  const branchSummary = ["PAPAO", "NAKORNLUANG", "SINGCHAI"].map(b => {
    const list = filtered.filter(r => r.branch === b);
    return {
      key: b,
      label: BRANCH_LABEL[b]?.label || b,
      count: list.length,
      regFee: list.reduce((s, r) => s + Number(r.total_registration_fee || 0), 0),
      insPremium: list.reduce((s, r) => s + Number(r.total_insurance_premium || 0), 0),
      bg: BRANCH_LABEL[b]?.bg,
      color: BRANCH_LABEL[b]?.color,
    };
  }).filter(s => s.count > 0);

  function exportCSV() {
    if (filtered.length === 0) { setMessage("ไม่มีข้อมูลให้ส่งออก"); return; }
    const header = ["#", "สาขา", "เลขที่ใบกำกับ", "วันที่", "ลูกค้า", "ไฟแนนท์", "เลขถัง", "เลขเครื่อง", "รุ่น", "ใบขาย", "วันที่ขาย", "ยอดจดทะเบียน", "ค่า พรบ."];
    const lines = [header.join(",")];
    filtered.forEach((r, i) => {
      const row = [
        i + 1,
        BRANCH_LABEL[r.branch]?.label || r.branch || "",
        r.tax_invoice_no || "",
        r.invoice_date ? String(r.invoice_date).slice(0, 10) : "",
        (r.sale_customer_name || r.customer_name || "").replace(/,/g, " "),
        (r.sale_finance_company || "").replace(/,/g, " "),
        r.chassis_no || "",
        r.engine_no || "",
        (r.model_name || "").replace(/,/g, " "),
        r.sale_invoice_no || "",
        r.sale_date ? String(r.sale_date).slice(0, 10) : "",
        Number(r.total_registration_fee || 0).toFixed(2),
        Number(r.total_insurance_premium || 0).toFixed(2),
      ];
      lines.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `รายงานสรุปงานทะเบียน_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12, background: "#072d6b", color: "#fff" };
  const td = { padding: "8px", borderBottom: "1px solid #e5e7eb", fontSize: 13 };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📋 รายงานสรุปงานทะเบียน</h2>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>ตั้งแต่:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
        <label style={{ fontSize: 13, fontWeight: 600 }}>ถึง:</label>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}>
          <option value="all">ทุกสาขา</option>
          <option value="PAPAO">ป.เปา</option>
          <option value="NAKORNLUANG">นครหลวง</option>
          <option value="SINGCHAI">สิงห์ชัย</option>
        </select>
        <select value={regPaidMonth} onChange={e => setRegPaidMonth(e.target.value)}
          title="กรองเดือนที่จ่ายค่าจดทะเบียน"
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #fbbf24", fontSize: 13, color: "#92400e", background: "#fef3c7" }}>
          <option value="">📅 จ่ายทะเบียน: ทุกเดือน</option>
          {regPaidMonthOpts.map(m => <option key={m} value={m}>📅 ทะเบียน · {fmtMonth(m)}</option>)}
        </select>
        <select value={insPaidMonth} onChange={e => setInsPaidMonth(e.target.value)}
          title="กรองเดือนที่จ่ายค่า พรบ."
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #86efac", fontSize: 13, color: "#065f46", background: "#dcfce7" }}>
          <option value="">🛡️ จ่าย พรบ.: ทุกเดือน</option>
          {insPaidMonthOpts.map(m => <option key={m} value={m}>🛡️ พรบ. · {fmtMonth(m)}</option>)}
        </select>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา (เลขกำกับ / ลูกค้า / เลขถัง / เลขเครื่อง / รุ่น / ไฟแนนท์)"
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, minWidth: 320 }} />
        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          {loading ? "..." : "🔍 ค้นหา"}
        </button>
        <button onClick={exportCSV} disabled={filtered.length === 0}
          style={{ padding: "7px 14px", background: filtered.length === 0 ? "#9ca3af" : "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: filtered.length === 0 ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13 }}>
          📥 Export CSV
        </button>
      </div>

      {/* Summary — count + ยอดจดทะเบียน */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ padding: "10px 18px", background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "#1e40af" }}>📋 จำนวนใบกำกับทั้งหมด</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1e3a8a" }}>{filtered.length} ใบ</div>
        </div>
        <div style={{ padding: "10px 18px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "#92400e" }}>💰 ยอดจดทะเบียนรวม</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#92400e" }}>฿ {fmt(totalRegFee)}</div>
        </div>
        <div style={{ padding: "10px 18px", background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "#065f46" }}>🛡️ ค่า พรบ. รวม</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#065f46" }}>฿ {fmt(totalInsPremium)}</div>
        </div>
        {branchSummary.map(s => (
          <div key={s.key} style={{ padding: "10px 18px", background: s.bg, border: `1px solid ${s.color}40`, borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: s.color }}>🏢 {s.label} <span style={{ fontWeight: 400, opacity: 0.7 }}>({s.count} ใบ)</span></div>
            <div style={{ fontSize: 13, color: "#92400e" }}>จดทะเบียน: <strong>฿ {fmt(s.regFee)}</strong></div>
            <div style={{ fontSize: 13, color: "#065f46" }}>พรบ.: <strong>฿ {fmt(s.insPremium)}</strong></div>
          </div>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 13 }}>
          {message}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280", background: "#fff", borderRadius: 10 }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          ไม่พบข้อมูล
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 40 }}>#</th>
                <th style={th}>สาขา</th>
                <th style={th}>เลขที่ใบกำกับ</th>
                <th style={th}>วันที่</th>
                <th style={th}>ลูกค้า / ไฟแนนท์</th>
                <th style={th}>เลขถัง</th>
                <th style={th}>เลขเครื่อง</th>
                <th style={th}>รุ่น</th>
                <th style={th}>ใบขาย</th>
                <th style={th}>วันที่ขาย</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดจดทะเบียน</th>
                <th style={{ ...th, textAlign: "right" }}>ค่า พรบ.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const b = BRANCH_LABEL[r.branch] || { label: r.branch || "-", bg: "#e5e7eb", color: "#374151" };
                return (
                  <tr key={`${r.branch}|${r.tax_invoice_no}|${i}`} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                    <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <span style={{ display: "inline-block", padding: "2px 10px", background: b.bg, color: b.color, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                        {b.label}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#072d6b" }}>{r.tax_invoice_no || "-"}</td>
                    <td style={td}>{fmtDate(r.invoice_date)}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.sale_customer_name || r.customer_name || "-"}</div>
                      {r.sale_finance_company && (
                        <div style={{ fontSize: 11, color: "#6b7280" }}>📋 {r.sale_finance_company}</div>
                      )}
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.engine_no || "-"}</td>
                    <td style={{ ...td, fontSize: 12 }}>{r.model_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.sale_invoice_no || "-"}</td>
                    <td style={td}>{fmtDate(r.sale_date)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: Number(r.total_registration_fee) > 0 ? "#92400e" : "#9ca3af" }}>
                      {Number(r.total_registration_fee) > 0 ? fmt(r.total_registration_fee) : "-"}
                      {r.reg_paid_at && (
                        <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "Tahoma", fontWeight: 400 }}>
                          จ่าย: {fmtDate(r.reg_paid_at)}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: Number(r.total_insurance_premium) > 0 ? "#065f46" : "#9ca3af" }}>
                      {Number(r.total_insurance_premium) > 0 ? fmt(r.total_insurance_premium) : "-"}
                      {r.ins_paid_at && (
                        <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "Tahoma", fontWeight: 400 }}>
                          จ่าย: {fmtDate(r.ins_paid_at)}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "#fef9c3", fontWeight: 700 }}>
              <tr>
                <td colSpan={10} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} ใบ</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#92400e", fontSize: 14 }}>{fmt(totalRegFee)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#065f46", fontSize: 14 }}>{fmt(totalInsPremium)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
