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

export default function CarPaymentReportPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [branchFilter, setBranchFilter] = useState("all");
  const [paidFilter, setPaidFilter] = useState("all"); // all / paid / unpaid
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [detailRow, setDetailRow] = useState(null); // popup รายละเอียดใบเสร็จ

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_car_payment_receipts",
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
  const filtered = rows.filter(r => {
    if (branchFilter !== "all" && r.branch !== branchFilter) return false;
    const combined = Number(r.total_paid || 0) + Number(r.paid_from_amount || 0);
    const full = combined >= Number(r.total_amount || 0) - 0.01 && Number(r.total_amount || 0) > 0;
    if (paidFilter === "paid" && !full) return false;
    if (paidFilter === "unpaid" && full) return false;
    if (!kw) return true;
    const hay = [r.tax_invoice_no, r.customer_name, r.sale_customer_name, r.chassis_no, r.engine_no, r.model_name, r.sale_finance_company, r.sale_invoice_no]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  // ยอดรับชำระรวม = daily_receipts + FT (paid_from_amount)
  const combinedPaid = (r) => Number(r.total_paid || 0) + Number(r.paid_from_amount || 0);
  const isFull = (r) => combinedPaid(r) >= Number(r.total_amount || 0) - 0.01 && Number(r.total_amount || 0) > 0;

  const totalAll = filtered.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const totalReceived = filtered.reduce((s, r) => s + combinedPaid(r), 0);
  const countFull = filtered.filter(r => isFull(r)).length;
  const countPartial = filtered.length - countFull;
  const totalRemaining = filtered.reduce((s, r) => s + Math.max(0, Number(r.total_amount || 0) - combinedPaid(r)), 0);

  function exportCSV() {
    if (filtered.length === 0) { setMessage("ไม่มีข้อมูลให้ส่งออก"); return; }
    const header = ["#", "สาขา", "เลขที่ใบกำกับ", "วันที่", "ลูกค้า", "เลขถัง", "เลขเครื่อง", "รุ่น", "ยอดรวม", "รับชำระ(daily)", "ตัดรับ FT", "รวมรับชำระ", "คงเหลือ", "ไฟแนนท์", "ใบขาย", "วันที่ขาย", "เลขใบโอน(FT)", "สถานะ"];
    const lines = [header.join(",")];
    filtered.forEach((r, i) => {
      const dailyPaid = Number(r.total_paid || 0);
      const ftPaid = Number(r.paid_from_amount || 0);
      const combined = dailyPaid + ftPaid;
      const remaining = Number(r.total_amount || 0) - combined;
      const full = combined >= Number(r.total_amount || 0) - 0.01 && Number(r.total_amount || 0) > 0;
      const row = [
        i + 1,
        BRANCH_LABEL[r.branch]?.label || r.branch || "",
        r.tax_invoice_no || "",
        r.invoice_date ? String(r.invoice_date).slice(0, 10) : "",
        (r.customer_name || r.sale_customer_name || "").replace(/,/g, " "),
        r.chassis_no || "",
        r.engine_no || "",
        (r.model_name || "").replace(/,/g, " "),
        Number(r.total_amount || 0).toFixed(2),
        dailyPaid.toFixed(2),
        ftPaid.toFixed(2),
        combined.toFixed(2),
        remaining.toFixed(2),
        (r.sale_finance_company || "").replace(/,/g, " "),
        r.sale_invoice_no || "",
        r.sale_date ? String(r.sale_date).slice(0, 10) : "",
        r.ft_doc_no || (r.paid_from_ft_id ? `FT-${r.paid_from_ft_id}` : ""),
        full ? "ครบ" : "ไม่ครบ",
      ];
      lines.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `รายงานรับชำระเงินรายคัน_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12, background: "#072d6b", color: "#fff" };
  const td = { padding: "8px", borderBottom: "1px solid #e5e7eb", fontSize: 13 };
  const tdNum = { ...td, textAlign: "right", fontFamily: "monospace" };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🧾 รายงานรับชำระเงินรายคัน</h2>
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
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา (เลขกำกับ / ลูกค้า / เลขถัง / เลขเครื่อง / ไฟแนนท์)"
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

      {/* Status filter chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { key: "all", label: "ทั้งหมด", count: filtered.length, bg: "#072d6b" },
          { key: "paid", label: "✅ ครบ", count: countFull, bg: "#10b981" },
          { key: "unpaid", label: "🔴 ไม่ครบ", count: countPartial, bg: "#dc2626" },
        ].map(f => (
          <button key={f.key} onClick={() => setPaidFilter(f.key)}
            style={{ padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
              background: paidFilter === f.key ? f.bg : "#e5e7eb",
              color: paidFilter === f.key ? "#fff" : "#374151" }}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div style={{ padding: "12px 16px", background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "#1e40af" }}>📋 รวม {filtered.length} คัน</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1e3a8a" }}>฿ {fmt(totalAll)}</div>
        </div>
        <div style={{ padding: "12px 16px", background: "#ede9fe", border: "1px solid #c4b5fd", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "#5b21b6" }}>💰 รับชำระแล้ว (รวม FT)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#5b21b6" }}>฿ {fmt(totalReceived)}</div>
        </div>
        <div style={{ padding: "12px 16px", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "#991b1b" }}>🔴 คงเหลือ ({countPartial} คัน)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#991b1b" }}>฿ {fmt(totalRemaining)}</div>
        </div>
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
                <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                <th style={{ ...th, textAlign: "right" }}>รับชำระ</th>
                <th style={th}>เลขใบขาย</th>
                <th style={th}>วันที่ขาย</th>
                <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const b = BRANCH_LABEL[r.branch] || { label: r.branch || "-", bg: "#e5e7eb", color: "#374151" };
                const combined = combinedPaid(r);
                const full = isFull(r);
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
                    <td style={{ ...tdNum, fontWeight: 700, color: "#dc2626" }}>{fmt(r.total_amount)}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: combined > 0 ? "#7c3aed" : "#9ca3af",
                                 cursor: combined > 0 ? "pointer" : "default", textDecoration: combined > 0 ? "underline" : "none" }}
                      onClick={() => combined > 0 && setDetailRow(r)}
                      title={combined > 0 ? `คลิกดูรายละเอียด · daily_receipts: ${fmt(r.total_paid || 0)} + FT: ${fmt(r.paid_from_amount || 0)}` : ""}>
                      {combined > 0 ? fmt(combined) : "-"}
                      {(Number(r.receipt_count) > 0 || r.paid_from_ft_id) && (
                        <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "Tahoma", textDecoration: "none" }}>
                          {Number(r.receipt_count) > 0 && `${r.receipt_count} ใบ`}
                          {r.paid_from_ft_id && (Number(r.receipt_count) > 0 ? " + FT" : "FT")}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.sale_invoice_no || "-"}</td>
                    <td style={td}>{fmtDate(r.sale_date)}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      {full ? (
                        <span style={{ display: "inline-block", padding: "3px 10px", background: "#d1fae5", color: "#065f46", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                          ✅ ครบ
                        </span>
                      ) : (
                        <span style={{ display: "inline-block", padding: "3px 10px", background: "#fee2e2", color: "#991b1b", borderRadius: 12, fontSize: 11, fontWeight: 700 }}
                          title={`คงเหลือ ${fmt(Number(r.total_amount) - combined)}`}>
                          🔴 ไม่ครบ
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "#fef9c3", fontWeight: 700 }}>
              <tr>
                <td colSpan={8} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} คัน</td>
                <td style={{ ...tdNum, color: "#dc2626", fontSize: 15 }}>{fmt(totalAll)}</td>
                <td style={{ ...tdNum, color: "#7c3aed", fontSize: 13 }}>{fmt(totalReceived)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Popup รายละเอียดใบเสร็จ */}
      {detailRow && (() => {
        const receipts = Array.isArray(detailRow.receipts_json) ? detailRow.receipts_json
          : (typeof detailRow.receipts_json === "string" ? (() => { try { return JSON.parse(detailRow.receipts_json); } catch { return []; } })() : []);
        // เพิ่ม FT เป็นแถวพิเศษ ถ้ามีการตัดรับ
        const ftRow = detailRow.paid_from_ft_id ? {
          receipt_no: detailRow.ft_doc_no || `FT-${detailRow.paid_from_ft_id}`,
          receipt_date: detailRow.paid_at || detailRow.ft_transfer_date,
          income_type: "ตัดรับจากเงินโอนไฟแนนท์",
          customer_name: detailRow.sale_finance_company || "-",
          employee_name: detailRow.ft_matched_by || "-",
          ft_paid_amount: Number(detailRow.paid_from_amount || 0),
          total_amount: Number(detailRow.paid_from_amount || 0),
          isFT: true,
        } : null;
        const allRows = ftRow ? [...receipts, ftRow] : receipts;
        const totalDailyPaid = Number(detailRow.total_paid) || 0;
        const totalFtPaid = Number(detailRow.paid_from_amount) || 0;
        const totalCombined = totalDailyPaid + totalFtPaid;
        const remaining = Number(detailRow.total_amount) - totalCombined;
        const isFullPayment = Math.abs(remaining) < 0.01 && Number(detailRow.total_amount) > 0;
        const sumField = (k) => receipts.reduce((s, r) => s + Number(r[k] || 0), 0);
        return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDetailRow(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 1100, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📑 รายละเอียดใบเสร็จรับเงิน
                <span style={{ marginLeft: 12, fontSize: 13, color: "#6b7280" }}>
                  ใบกำกับ: <strong style={{ color: "#072d6b" }}>{detailRow.tax_invoice_no}</strong>
                  <span style={{ margin: "0 6px" }}>·</span>
                  ใบขาย: <strong style={{ color: "#072d6b" }}>{detailRow.sale_invoice_no || "-"}</strong>
                </span>
              </h3>
              <button onClick={() => setDetailRow(null)}
                style={{ padding: "6px 14px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ปิด</button>
            </div>

            {/* Header info */}
            <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: 10, border: "1px solid #cbd5e1", marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, fontSize: 13 }}>
                <div>ลูกค้า: <strong style={{ color: "#072d6b" }}>{detailRow.sale_customer_name || detailRow.customer_name || "-"}</strong></div>
                <div>ไฟแนนท์: <strong style={{ color: "#7c3aed" }}>{detailRow.sale_finance_company || "-"}</strong></div>
                <div>เลขเครื่อง: <strong style={{ fontFamily: "monospace" }}>{detailRow.engine_no || "-"}</strong></div>
                <div>เลขถัง: <strong style={{ fontFamily: "monospace" }}>{detailRow.chassis_no || "-"}</strong></div>
                <div style={{ gridColumn: "1 / span 2" }}>รุ่น: <strong>{detailRow.model_name || "-"}</strong></div>
                <div>ยอดรวม: <strong style={{ color: "#dc2626" }}>{fmt(detailRow.total_amount)}</strong></div>
                <div>รับชำระ: <strong style={{ color: "#7c3aed" }}>{fmt(totalCombined)}</strong>
                  {totalFtPaid > 0 && totalDailyPaid > 0 && (
                    <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 6 }}>
                      ({fmt(totalDailyPaid)} + FT {fmt(totalFtPaid)})
                    </span>
                  )}
                </div>
                <div>คงเหลือ: <strong style={{ color: isFullPayment ? "#10b981" : "#dc2626" }}>{fmt(remaining)}</strong></div>
                <div>สถานะ: <strong style={{ color: isFullPayment ? "#065f46" : "#92400e" }}>{isFullPayment ? "✅ ครบ" : "🔴 ยังไม่ครบ"}</strong></div>
              </div>
            </div>

            {/* Receipts table */}
            {allRows.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีใบเสร็จ</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#072d6b", color: "#fff" }}>
                      <th style={{ ...th, width: 30 }}>#</th>
                      <th style={th}>เลขที่ใบเสร็จ</th>
                      <th style={th}>วันที่</th>
                      <th style={th}>ประเภท</th>
                      <th style={th}>ลูกค้า</th>
                      <th style={th}>พนักงาน</th>
                      <th style={{ ...th, textAlign: "right" }}>เงินสด</th>
                      <th style={{ ...th, textAlign: "right" }}>เงินโอน</th>
                      <th style={{ ...th, textAlign: "right" }}>มัดจำ</th>
                      <th style={{ ...th, textAlign: "right" }}>เช็ค</th>
                      <th style={{ ...th, textAlign: "right" }}>ประกันรถหายออกแทน</th>
                      <th style={{ ...th, textAlign: "right" }}>เงินดาวน์/ค่างวดออกแทน</th>
                      <th style={{ ...th, textAlign: "right" }}>ตัดรับ FT</th>
                      <th style={{ ...th, textAlign: "right" }}>รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map((rc, i) => {
                      const transfers = Array.isArray(rc.transfers) ? rc.transfers : [];
                      const isFTRow = rc.isFT;
                      return (
                        <tr key={rc.receipt_no || i} style={{ background: isFTRow ? "#dbeafe" : (i % 2 === 0 ? "#fff" : "#f9fafb") }}>
                          <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                          <td style={{ ...td, fontWeight: 700, color: isFTRow ? "#0369a1" : "#072d6b", fontFamily: "monospace" }}>{rc.receipt_no || "-"}</td>
                          <td style={td}>{fmtDate(rc.receipt_date)}</td>
                          <td style={td}>{rc.income_type || "-"}</td>
                          <td style={td}>{rc.customer_name || "-"}</td>
                          <td style={td}>{rc.employee_name || "-"}</td>
                          <td style={tdNum}>{Number(rc.cash) > 0 ? fmt(rc.cash) : "-"}</td>
                          <td style={tdNum}>
                            {Number(rc.transfer) > 0 ? (
                              <>
                                <div style={{ color: "#0369a1", fontWeight: 600 }}>{fmt(rc.transfer)}</div>
                                {transfers.map((tr, ti) => (
                                  <div key={ti} style={{ fontSize: 10, color: "#6b7280", fontFamily: "Tahoma" }}>
                                    → {tr.account_no} ({fmt(tr.amount)})
                                  </div>
                                ))}
                              </>
                            ) : "-"}
                          </td>
                          <td style={tdNum}>{Number(rc.deposit) > 0 ? fmt(rc.deposit) : "-"}</td>
                          <td style={tdNum}>{Number(rc.cheque) > 0 ? fmt(rc.cheque) : "-"}</td>
                          <td style={tdNum}>{Number(rc.credit_note) > 0 ? fmt(rc.credit_note) : "-"}</td>
                          <td style={tdNum}>{Number(rc.coupon) > 0 ? fmt(rc.coupon) : "-"}</td>
                          <td style={{ ...tdNum, color: "#0369a1", fontWeight: 600 }}>
                            {isFTRow && Number(rc.ft_paid_amount) > 0 ? fmt(rc.ft_paid_amount) : "-"}
                          </td>
                          <td style={{ ...tdNum, fontWeight: 700, color: isFTRow ? "#0369a1" : "#7c3aed" }}>{fmt(rc.total_amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ background: "#fef9c3", fontWeight: 700 }}>
                    <tr>
                      <td colSpan={6} style={{ ...td, textAlign: "right" }}>รวม {allRows.length} รายการ</td>
                      <td style={tdNum}>{fmt(sumField("cash"))}</td>
                      <td style={tdNum}>{fmt(sumField("transfer"))}</td>
                      <td style={tdNum}>{fmt(sumField("deposit"))}</td>
                      <td style={tdNum}>{fmt(sumField("cheque"))}</td>
                      <td style={tdNum}>{fmt(sumField("credit_note"))}</td>
                      <td style={tdNum}>{fmt(sumField("coupon"))}</td>
                      <td style={{ ...tdNum, color: "#0369a1" }}>{fmt(totalFtPaid)}</td>
                      <td style={{ ...tdNum, color: "#7c3aed", fontSize: 14 }}>{fmt(totalCombined)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
