import React, { useEffect, useState } from "react";

const ACCOUNTING_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

export default function OtherIncomeTaxReportPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [branch, setBranch] = useState("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_other_income_tax_invoices",
          date_from: dateFrom, date_to: dateTo,
          branch: branch === "all" ? "" : branch,
        }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : (data?.rows || []));
    } catch (e) {
      setRows([]); setMessage("❌ โหลดไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!kw) return true;
    const hay = [r.tax_invoice_no, r.customer_name, r.customer_tax_id, r.customer_branch]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  // Totals แยกตามสังกัด
  function sumOf(arr) {
    return arr.reduce((acc, r) => {
      acc.count += 1;
      acc.before += Number(r.amount_before_vat || 0);
      acc.vat += Number(r.vat_amount || 0);
      acc.total += Number(r.total_amount || 0);
      return acc;
    }, { count: 0, before: 0, vat: 0, total: 0 });
  }
  const totals = sumOf(filtered);
  const papaoRows = filtered.filter(r => r.branch === "PAPAO");
  const singchaiRows = filtered.filter(r => r.branch === "SINGCHAI");
  const papaoTotal = sumOf(papaoRows);
  const singchaiTotal = sumOf(singchaiRows);

  function exportCSV() {
    const headers = ["#", "สาขา", "เลขใบกำกับ", "วันที่", "ลูกค้า", "เลขผู้เสียภาษี", "สาขา/สำนัก", "ก่อน VAT", "VAT", "รวม", "สถานะ"];
    const lines = filtered.map((r, i) => [
      i + 1, r.branch || "", r.tax_invoice_no || "", r.invoice_date || "",
      r.customer_name || "", r.customer_tax_id || "", r.customer_branch || "",
      r.amount_before_vat || 0, r.vat_amount || 0, r.total_amount || 0, r.status || "",
    ]);
    const csv = "﻿" + [headers.map(h => `"${h}"`).join(","), ...lines.map(row => row.map(c => typeof c === "number" ? c : `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `รายงานใบกำกับรายได้อื่นๆ_${dateFrom}_${dateTo}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 รายงานใบกำกับภาษีรายได้อื่นๆ</h2>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <select value={branch} onChange={e => setBranch(e.target.value)} style={inp}>
          <option value="all">ทั้ง 2 สาขา</option>
          <option value="PAPAO">ป.เปา</option>
          <option value="SINGCHAI">สิงห์ชัย</option>
        </select>
        <input type="text" placeholder="🔍 ค้นหา (เลขใบกำกับ / ลูกค้า / Tax ID)" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, minWidth: 240 }} />
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
        <button onClick={exportCSV} style={{ ...btnBlue, background: "#059669" }}>📤 Export CSV</button>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: "#b91c1c" }}>{message}</div>}

      {/* รวมทั้งหมด */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
        <Card label="📋 ใบกำกับ" value={filtered.length} color="#1e40af" />
        <Card label="💵 ก่อน VAT" value={fmt(totals.before)} color="#0369a1" />
        <Card label="🧾 VAT" value={fmt(totals.vat)} color="#7c3aed" />
        <Card label="💰 รวม" value={fmt(totals.total)} color="#059669" highlight />
      </div>

      {/* แยกตามสังกัด */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px,1fr))", gap: 12, marginBottom: 14 }}>
        <BranchSummary label="🏢 ป.เปา (PAPAO)" stats={papaoTotal} color="#7c3aed" />
        <BranchSummary label="🏢 สิงห์ชัย (SINGCHAI)" stats={singchaiTotal} color="#0d9488" />
      </div>

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>#</th>
              <th style={th}>สาขา</th>
              <th style={th}>เลขใบกำกับ</th>
              <th style={th}>วันที่</th>
              <th style={th}>ลูกค้า</th>
              <th style={th}>Tax ID</th>
              <th style={th}>สาขา/สำนัก</th>
              <th style={{ ...th, textAlign: "right" }}>ก่อน VAT</th>
              <th style={{ ...th, textAlign: "right" }}>VAT</th>
              <th style={{ ...th, textAlign: "right" }}>รวม</th>
              <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={11} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
            {filtered.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={td}>{i + 1}</td>
                <td style={td}>{r.branch}</td>
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.tax_invoice_no}</td>
                <td style={td}>{fmtDate(r.invoice_date)}</td>
                <td style={td}>{r.customer_name || (r.status === "cancelled" ? <em style={{ color: "#dc2626" }}>ยกเลิก</em> : "-")}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.customer_tax_id || "-"}</td>
                <td style={{ ...td, fontSize: 11 }}>{r.customer_branch || "-"}</td>
                <td style={tdNum}>{fmt(r.amount_before_vat)}</td>
                <td style={tdNum}>{fmt(r.vat_amount)}</td>
                <td style={{ ...tdNum, fontWeight: 700 }}>{fmt(r.total_amount)}</td>
                <td style={{ ...td, textAlign: "center" }}>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: r.status === "cancelled" ? "#fee2e2" : "#dcfce7",
                    color: r.status === "cancelled" ? "#991b1b" : "#065f46" }}>{r.status}</span>
                </td>
              </tr>
            ))}
            {filtered.length > 0 && (
              <tr style={{ background: "#fde68a", fontWeight: 700 }}>
                <td colSpan={7} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} ใบ</td>
                <td style={tdNum}>{fmt(totals.before)}</td>
                <td style={tdNum}>{fmt(totals.vat)}</td>
                <td style={tdNum}>{fmt(totals.total)}</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, color, highlight }) {
  return (
    <div style={{ background: highlight ? color : "#fff", color: highlight ? "#fff" : "#072d6b", padding: 12, borderRadius: 10, border: `1px solid ${color}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 11, color: highlight ? "#fff" : "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: highlight ? "#fff" : color }}>{value}</div>
    </div>
  );
}

function BranchSummary({ label, stats, color }) {
  return (
    <div style={{ background: "#fff", padding: 12, borderRadius: 10, border: `2px solid ${color}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${color}33` }}>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{label}</span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{stats.count} ใบ</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 12 }}>
        <div>
          <div style={{ color: "#6b7280", fontSize: 10 }}>ก่อน VAT</div>
          <div style={{ fontWeight: 700, color: "#0369a1", fontFamily: "monospace" }}>{Number(stats.before).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
        </div>
        <div>
          <div style={{ color: "#6b7280", fontSize: 10 }}>VAT</div>
          <div style={{ fontWeight: 700, color: "#7c3aed", fontFamily: "monospace" }}>{Number(stats.vat).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
        </div>
        <div>
          <div style={{ color: "#6b7280", fontSize: 10 }}>รวม</div>
          <div style={{ fontWeight: 700, color, fontFamily: "monospace" }}>{Number(stats.total).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</div>
        </div>
      </div>
    </div>
  );
}

const th = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 12 };
const td = { padding: "6px 10px", fontSize: 12 };
const tdNum = { padding: "6px 10px", fontSize: 12, textAlign: "right", fontFamily: "monospace" };
const inp = { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 };
const btnBlue = { padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
