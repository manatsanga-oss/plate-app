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

export default function SalesByPaymentReportPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [branchFilter, setBranchFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState({});  // { cash: true, transfer: true, ... }
  const [message, setMessage] = useState("");

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_car_payment_receipts", date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : (data?.rows || []));
    } catch (e) {
      setRows([]); setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  // For each sale, sum payment methods from its receipts[]
  function sumByMethod(r) {
    let recs = r.receipts_json || r.receipts || [];
    if (typeof recs === "string") { try { recs = JSON.parse(recs); } catch { recs = []; } }
    if (!Array.isArray(recs)) recs = [];
    let cash = 0, transfer = 0, deposit = 0, cheque = 0, credit_note = 0, coupon = 0;
    recs.forEach(rc => {
      cash += Number(rc.cash || 0);
      transfer += Number(rc.transfer || 0);
      deposit += Number(rc.deposit || 0);
      cheque += Number(rc.cheque || 0);
      credit_note += Number(rc.credit_note || 0);
      coupon += Number(rc.coupon || 0);
    });
    const ft = Number(r.paid_from_amount || 0);
    return { cash, transfer, deposit, cheque, credit_note, coupon, ft, total: cash + transfer + deposit + cheque + credit_note + coupon + ft };
  }

  const kw = search.trim().toLowerCase();
  const activeMethods = Object.keys(methodFilter).filter(k => methodFilter[k]);
  const filtered = rows.filter(r => {
    if (branchFilter !== "all" && r.branch !== branchFilter) return false;
    // method filter: ถ้าเลือก method ใดๆ → ต้องมียอดใน method นั้น > 0
    if (activeMethods.length > 0) {
      const s = sumByMethod(r);
      const hasAny = activeMethods.some(m => Number(s[m] || 0) > 0);
      if (!hasAny) return false;
    }
    if (!kw) return true;
    const hay = [r.tax_invoice_no, r.customer_name, r.sale_customer_name, r.chassis_no, r.engine_no, r.model_name, r.sale_invoice_no]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  // Totals
  const totals = filtered.reduce((acc, r) => {
    const s = sumByMethod(r);
    acc.cash += s.cash; acc.transfer += s.transfer; acc.deposit += s.deposit; acc.cheque += s.cheque;
    acc.credit_note += s.credit_note; acc.coupon += s.coupon; acc.ft += s.ft; acc.total += s.total;
    acc.sale_total += Number(r.total_amount || 0);
    return acc;
  }, { cash: 0, transfer: 0, deposit: 0, cheque: 0, credit_note: 0, coupon: 0, ft: 0, total: 0, sale_total: 0 });

  function exportCSV() {
    const headers = ["#", "สาขา", "เลขใบกำกับ", "วันที่", "ลูกค้า", "เลขถัง", "รุ่น", "ยอดขาย", "เงินสด", "เงินโอน", "มัดจำ", "เช็ค", "ประกันรถหายออกแทน", "เงินดาวน์/ค่างวดออกแทน", "ตัดรับ FT", "รวมรับชำระ"];
    const lines = filtered.map((r, i) => {
      const s = sumByMethod(r);
      return [i + 1, r.branch || "", r.tax_invoice_no || "", r.tax_invoice_date || "", r.customer_name || "", r.chassis_no || "", r.model_name || "", r.total_amount || 0, s.cash, s.transfer, s.deposit, s.cheque, s.credit_note, s.coupon, s.ft, s.total];
    });
    const csv = "﻿" + [headers.map(h => `"${h}"`).join(","), ...lines.map(row => row.map(c => typeof c === "number" ? c : `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `รายงานขายตามการชำระ_${dateFrom}_${dateTo}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💳 รายงานการขายตามการชำระเงิน</h2>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={inp}>
          <option value="all">ทุกสาขา</option>
          <option value="PAPAO">ป.เปา</option>
          <option value="NAKORNLUANG">นครหลวง</option>
          <option value="SINGCHAI">สิงห์ชัย</option>
        </select>
        <input type="text" placeholder="🔍 ค้นหา" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, minWidth: 220 }} />
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
        <button onClick={exportCSV} style={{ ...btnBlue, background: "#059669" }}>📤 Export CSV</button>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: "#b91c1c" }}>{message}</div>}

      <div style={{ marginBottom: 6, fontSize: 12, color: "#6b7280" }}>
        💡 คลิกการ์ดเพื่อกรองเฉพาะใบขายที่มีการชำระด้วยวิธีนั้น (คลิกซ้ำเพื่อยกเลิก)
        {activeMethods.length > 0 && (
          <button onClick={() => setMethodFilter({})} style={{ marginLeft: 10, padding: "2px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>✕ ล้างตัวกรอง ({activeMethods.length})</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 8, marginBottom: 12 }}>
        <Card label="📋 ใบขาย" value={filtered.length} color="#1e40af" />
        <Card label="💰 ยอดขายรวม" value={fmt(totals.sale_total)} color="#7c3aed" />
        <Card label="💵 เงินสด" value={fmt(totals.cash)} color="#059669" active={methodFilter.cash} onClick={() => setMethodFilter(m => ({ ...m, cash: !m.cash }))} />
        <Card label="💳 เงินโอน" value={fmt(totals.transfer)} color="#0369a1" active={methodFilter.transfer} onClick={() => setMethodFilter(m => ({ ...m, transfer: !m.transfer }))} />
        <Card label="🪙 มัดจำ" value={fmt(totals.deposit)} color="#7c3aed" active={methodFilter.deposit} onClick={() => setMethodFilter(m => ({ ...m, deposit: !m.deposit }))} />
        <Card label="📝 เช็ค" value={fmt(totals.cheque)} color="#dc2626" active={methodFilter.cheque} onClick={() => setMethodFilter(m => ({ ...m, cheque: !m.cheque }))} />
        <Card label="🛡️ ประกันออกแทน" value={fmt(totals.credit_note)} color="#92400e" active={methodFilter.credit_note} onClick={() => setMethodFilter(m => ({ ...m, credit_note: !m.credit_note }))} />
        <Card label="💸 ดาวน์/งวดออกแทน" value={fmt(totals.coupon)} color="#9d174d" active={methodFilter.coupon} onClick={() => setMethodFilter(m => ({ ...m, coupon: !m.coupon }))} />
        <Card label="🏦 ตัดรับ FT" value={fmt(totals.ft)} color="#0891b2" active={methodFilter.ft} onClick={() => setMethodFilter(m => ({ ...m, ft: !m.ft }))} />
        <Card label="✅ รวมรับชำระ" value={fmt(totals.total)} color="#059669" highlight />
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
              <th style={th}>เลขถัง</th>
              <th style={th}>รุ่น</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดขาย</th>
              <th style={{ ...th, textAlign: "right", background: "#16a34a" }}>เงินสด</th>
              <th style={{ ...th, textAlign: "right", background: "#0284c7" }}>เงินโอน</th>
              <th style={{ ...th, textAlign: "right", background: "#7c3aed" }}>มัดจำ</th>
              <th style={{ ...th, textAlign: "right", background: "#dc2626" }}>เช็ค</th>
              <th style={{ ...th, textAlign: "right", background: "#a16207" }}>ประกันออกแทน</th>
              <th style={{ ...th, textAlign: "right", background: "#be185d" }}>ดาวน์/งวดออกแทน</th>
              <th style={{ ...th, background: "#f59e0b" }}>วันที่ประกาศ</th>
              <th style={{ ...th, textAlign: "right", background: "#f59e0b" }}>ยอดเงินประกาศ</th>
              <th style={{ ...th, textAlign: "right", background: "#0891b2" }}>ตัดรับ FT</th>
              <th style={{ ...th, textAlign: "right", background: "#fef9c3", color: "#072d6b" }}>รวม</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={18} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={18} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
            {filtered.map((r, i) => {
              const s = sumByMethod(r);
              return (
                <tr key={r.tax_invoice_no || i} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{r.branch || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.tax_invoice_no || "-"}</td>
                  <td style={td}>{fmtDate(r.tax_invoice_date)}</td>
                  <td style={td}>{r.customer_name || r.sale_customer_name || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                  <td style={td}>{r.model_name || "-"}</td>
                  <td style={tdNum}>{fmt(r.total_amount)}</td>
                  <td style={tdNum}>{s.cash > 0 ? fmt(s.cash) : "-"}</td>
                  <td style={tdNum}>{s.transfer > 0 ? fmt(s.transfer) : "-"}</td>
                  <td style={tdNum}>{s.deposit > 0 ? fmt(s.deposit) : "-"}</td>
                  <td style={tdNum}>{s.cheque > 0 ? fmt(s.cheque) : "-"}</td>
                  <td style={tdNum}>{s.credit_note > 0 ? fmt(s.credit_note) : "-"}</td>
                  <td style={tdNum}>{s.coupon > 0 ? fmt(s.coupon) : "-"}</td>
                  <td style={{ ...td, fontSize: 11, color: "#92400e" }}>{r.announced_date ? fmtDate(r.announced_date) : "-"}</td>
                  <td style={{ ...tdNum, color: "#92400e", fontWeight: 600 }}>{r.announced_amount ? fmt(r.announced_amount) : "-"}</td>
                  <td style={{ ...tdNum, color: "#0891b2", fontWeight: 600 }}>{s.ft > 0 ? fmt(s.ft) : "-"}</td>
                  <td style={{ ...tdNum, fontWeight: 700, background: "#fef9c3" }}>{fmt(s.total)}</td>
                </tr>
              );
            })}
            {filtered.length > 0 && (
              <tr style={{ background: "#fde68a", fontWeight: 700 }}>
                <td colSpan={7} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} ใบ</td>
                <td style={tdNum}>{fmt(totals.sale_total)}</td>
                <td style={tdNum}>{fmt(totals.cash)}</td>
                <td style={tdNum}>{fmt(totals.transfer)}</td>
                <td style={tdNum}>{fmt(totals.deposit)}</td>
                <td style={tdNum}>{fmt(totals.cheque)}</td>
                <td style={tdNum}>{fmt(totals.credit_note)}</td>
                <td style={tdNum}>{fmt(totals.coupon)}</td>
                <td></td>
                <td></td>
                <td style={{ ...tdNum, color: "#0891b2" }}>{fmt(totals.ft)}</td>
                <td style={tdNum}>{fmt(totals.total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, color, highlight, active, onClick }) {
  const clickable = !!onClick;
  return (
    <div onClick={onClick}
      style={{
        padding: "10px 12px",
        background: active ? color : "#fff",
        borderRadius: 8,
        border: active ? `3px solid ${color}` : (highlight ? `2px solid ${color}` : "1px solid #e5e7eb"),
        cursor: clickable ? "pointer" : "default",
        userSelect: "none",
        transition: "all 0.15s",
        boxShadow: active ? `0 2px 8px ${color}55` : "none",
      }}>
      <div style={{ fontSize: 11, color: active ? "#fff" : "#6b7280", marginBottom: 3, fontWeight: active ? 700 : 400 }}>{label}{clickable && !active && " 👆"}</div>
      <div style={{ fontSize: highlight ? 18 : 15, fontWeight: 700, color: active ? "#fff" : color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

const inp = { padding: "6px 9px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const th = { padding: "8px 6px", textAlign: "left", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "6px", fontSize: 11 };
const tdNum = { padding: "6px", fontSize: 11, textAlign: "right", fontFamily: "monospace" };
const btnBlue = { padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
