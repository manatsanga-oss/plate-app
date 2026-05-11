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

export default function ReceiptTransferReportPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [bankFilter, setBankFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_receipt_transfer_report", date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : (data?.rows || []));
    } catch (e) {
      setRows([]); setMessage("❌ โหลดไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const banks = [...new Set(rows.map(r => r.bank_account_no).filter(Boolean))];
  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (bankFilter !== "all" && r.bank_account_no !== bankFilter) return false;
    if (!kw) return true;
    const hay = [r.receipt_no, r.customer_name, r.sale_invoice_no, r.bank_name, r.bank_account_no, r.note]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const totalAmount = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
  // group by bank
  const byBank = {};
  filtered.forEach(r => {
    const k = `${r.bank_name || "-"}|${r.bank_account_no || "-"}`;
    if (!byBank[k]) byBank[k] = { bank_name: r.bank_name, account_no: r.bank_account_no, total: 0, count: 0 };
    byBank[k].total += Number(r.amount || 0);
    byBank[k].count += 1;
  });
  const bankSummary = Object.values(byBank).sort((a, b) => b.total - a.total);

  function exportCSV() {
    const header = ["วันที่โอน","เลขที่ใบเสร็จ","ลูกค้า","ยอดเงิน","ธนาคาร","เลขที่บัญชี","หมายเหตุ","เลขใบขาย"];
    const lines = [header.join(",")];
    filtered.forEach(r => {
      lines.push([fmtDate(r.transfer_date), r.receipt_no, r.customer_name, Number(r.amount||0), r.bank_name, r.bank_account_no, r.note, r.sale_invoice_no]
        .map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `receipt_transfer_${dateFrom}_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 18, maxWidth: 1500, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 14px", color: "#072d6b" }}>📊 รายงานสรุปรับชำระเงิน (เงินโอน)</h2>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: 10, background: "#f1f5f9", borderRadius: 8, marginBottom: 12 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: 6, borderRadius: 4, border: "1px solid #ccc" }} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: 6, borderRadius: 4, border: "1px solid #ccc" }} />
        <select value={bankFilter} onChange={e => setBankFilter(e.target.value)} style={{ padding: 6, borderRadius: 4, border: "1px solid #ccc" }}>
          <option value="all">ทุกบัญชี</option>
          {banks.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <input type="text" placeholder="🔍 ค้นหา…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: 6, borderRadius: 4, border: "1px solid #ccc", minWidth: 220 }} />
        <button onClick={fetchData} disabled={loading} style={{ padding: "6px 14px", background: "#2563eb", color: "white", borderRadius: 4, border: "none", cursor: "pointer" }}>
          {loading ? "กำลังโหลด…" : "🔍 ค้นหา"}
        </button>
        <button onClick={exportCSV} style={{ padding: "6px 14px", background: "#10b981", color: "white", borderRadius: 4, border: "none", cursor: "pointer" }}>
          📁 Export CSV
        </button>
      </div>

      {message && <div style={{ padding: 8, marginBottom: 8, color: "#b91c1c" }}>{message}</div>}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        <div style={cardStyle("#dbeafe","#1e40af")}>
          <div style={{fontSize:11}}>🧾 จำนวนรายการ</div>
          <div style={{fontSize:22, fontWeight:700}}>{filtered.length}</div>
        </div>
        <div style={cardStyle("#dcfce7","#166534")}>
          <div style={{fontSize:11}}>💰 ยอดเงินโอนรวม</div>
          <div style={{fontSize:22, fontWeight:700}}>{fmt(totalAmount)}</div>
        </div>
        <div style={cardStyle("#fef9c3","#854d0e")}>
          <div style={{fontSize:11}}>🏦 จำนวนบัญชี</div>
          <div style={{fontSize:22, fontWeight:700}}>{bankSummary.length}</div>
        </div>
      </div>

      {/* Bank summary */}
      {bankSummary.length > 0 && (
        <div style={{ marginBottom: 14, padding: 10, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: "#072d6b" }}>สรุปยอดเงินโอนแยกตามบัญชี</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: "#f0f4f9" }}>
              <th style={th}>#</th><th style={th}>ธนาคาร</th><th style={th}>เลขที่บัญชี</th>
              <th style={{...th, textAlign:"right"}}>จำนวนรายการ</th><th style={{...th, textAlign:"right"}}>ยอดรวม</th>
            </tr></thead>
            <tbody>
              {bankSummary.map((b, i) => (
                <tr key={i}>
                  <td style={td}>{i+1}</td>
                  <td style={td}>{b.bank_name || "-"}</td>
                  <td style={{...td, fontFamily:"monospace"}}>{b.account_no || "-"}</td>
                  <td style={{...td, textAlign:"right"}}>{b.count}</td>
                  <td style={{...td, textAlign:"right", fontWeight:700}}>{fmt(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail table */}
      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#f0f4f9" }}>
            <th style={th}>#</th><th style={th}>วันที่โอน</th><th style={th}>เลขที่ใบเสร็จ</th>
            <th style={th}>ลูกค้า</th><th style={th}>เลขใบขาย</th>
            <th style={th}>ธนาคาร</th><th style={th}>เลขที่บัญชี</th>
            <th style={{...th, textAlign:"right"}}>ยอดเงิน</th><th style={th}>หมายเหตุ</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} style={{padding:20, textAlign:"center", color:"#9ca3af"}}>{loading ? "กำลังโหลด..." : "ไม่มีข้อมูล"}</td></tr>}
            {filtered.map((r, i) => (
              <tr key={i}>
                <td style={td}>{i+1}</td>
                <td style={td}>{fmtDate(r.transfer_date)}</td>
                <td style={{...td, fontFamily:"monospace"}}>{r.receipt_no || "-"}</td>
                <td style={td}>{r.customer_name || "-"}</td>
                <td style={{...td, fontFamily:"monospace"}}>{r.sale_invoice_no || "-"}</td>
                <td style={td}>{r.bank_name || "-"}</td>
                <td style={{...td, fontFamily:"monospace"}}>{r.bank_account_no || "-"}</td>
                <td style={{...td, textAlign:"right"}}>{fmt(r.amount)}</td>
                <td style={td}>{r.note || "-"}</td>
              </tr>
            ))}
            {filtered.length > 0 && (
              <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                <td colSpan={7} style={{...td, textAlign:"right"}}>รวมทั้งสิ้น</td>
                <td style={{...td, textAlign:"right"}}>{fmt(totalAmount)}</td>
                <td style={td}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { border: "1px solid #ddd", padding: "6px 8px", textAlign: "left", fontWeight: 600 };
const td = { border: "1px solid #ddd", padding: "5px 8px" };
function cardStyle(bg, color) {
  return { padding: 10, background: bg, color, borderRadius: 6 };
}
