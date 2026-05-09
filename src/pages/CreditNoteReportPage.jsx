import React, { useEffect, useState } from "react";

const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }
function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}

export default function CreditNoteReportPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | available | used | cancelled
  const [message, setMessage] = useState("");

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(ACC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_credit_notes",
          date_from: dateFrom,
          date_to: dateTo,
        }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data?.rows || data?.data || []);
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
    if (statusFilter === "available" && (r.status === "cancelled" || r.used_in_income)) return false;
    if (statusFilter === "used" && !r.used_in_income) return false;
    if (statusFilter === "cancelled" && r.status !== "cancelled") return false;
    if (!kw) return true;
    const hay = [r.credit_note_no, r.paid_doc_no, r.billing_doc_nos, r.vendor_name, r.note]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const totalAmount = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
  // counts by status (จาก rows ทั้งหมด ไม่ใช่ filtered)
  const countAll = rows.length;
  const countAvailable = rows.filter(r => r.status !== "cancelled" && !r.used_in_income).length;
  const countUsed = rows.filter(r => !!r.used_in_income).length;
  const countCancelled = rows.filter(r => r.status === "cancelled").length;

  const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12, background: "#072d6b", color: "#fff" };
  const td = { padding: "8px", borderBottom: "1px solid #e5e7eb", fontSize: 13 };
  const tdNum = { ...td, textAlign: "right", fontFamily: "monospace" };

  function exportCSV() {
    if (filtered.length === 0) { setMessage("ไม่มีข้อมูลให้ส่งออก"); return; }
    const header = ["#", "เลขที่ใบลดหนี้", "วันที่", "ยอดเงิน", "เลขใบจ่ายอ้างอิง", "เลขเอกสารที่อ้างอิง", "Vendor", "หมวด", "หมายเหตุ", "ผู้บันทึก", "บันทึกเมื่อ"];
    const lines = [header.join(",")];
    filtered.forEach((r, i) => {
      const row = [
        i + 1,
        r.credit_note_no || "",
        r.credit_note_date ? String(r.credit_note_date).slice(0, 10) : "",
        Number(r.amount || 0).toFixed(2),
        r.paid_doc_no || "",
        (r.billing_doc_nos || "").replace(/,/g, ";"),
        r.vendor_name || "",
        r.category || "",
        (r.note || "").replace(/[\r\n,]/g, " "),
        r.created_by || "",
        r.created_at ? String(r.created_at).slice(0, 19) : "",
      ];
      lines.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `รายงานใบลดหนี้รับ_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📄 รายงานใบลดหนี้รับ</h2>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>ตั้งแต่:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
        <label style={{ fontSize: 13, fontWeight: 600 }}>ถึง:</label>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา (เลขใบลดหนี้ / Vendor / หมายเหตุ)"
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, minWidth: 280 }} />
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
          { key: "all", label: "ทั้งหมด", count: countAll, bg: "#072d6b" },
          { key: "available", label: "💰 คงเหลือ", count: countAvailable, bg: "#10b981" },
          { key: "used", label: "✓ ใช้แล้ว", count: countUsed, bg: "#3b82f6" },
          { key: "cancelled", label: "❌ ยกเลิก", count: countCancelled, bg: "#ef4444" },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            style={{ padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
              background: statusFilter === f.key ? f.bg : "#e5e7eb",
              color: statusFilter === f.key ? "#fff" : "#374151" }}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 20, marginBottom: 12, padding: "10px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fbbf24", fontSize: 14 }}>
        <span>📋 จำนวนใบลดหนี้: <strong>{filtered.length}</strong></span>
        <span>💰 ยอดรวม: <strong style={{ color: "#dc2626", fontSize: 16 }}>฿ {fmt(totalAmount)}</strong></span>
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
          ไม่พบข้อมูลใบลดหนี้รับในช่วงวันที่ที่เลือก
        </div>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 40 }}>#</th>
                <th style={th}>เลขที่ใบลดหนี้</th>
                <th style={th}>วันที่</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดเงิน</th>
                <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
                <th style={th}>เลขใบจ่ายอ้างอิง</th>
                <th style={th}>เอกสารที่อ้างอิง</th>
                <th style={th}>Vendor</th>
                <th style={th}>หมวด</th>
                <th style={th}>หมายเหตุ</th>
                <th style={th}>ผู้บันทึก</th>
                <th style={th}>บันทึกเมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                // status logic: cancelled > used > available
                const isCancelled = r.status === "cancelled";
                const isUsed = !!r.used_in_income;
                const badge = isCancelled
                  ? { label: "❌ ยกเลิก", bg: "#fee2e2", color: "#991b1b" }
                  : isUsed
                  ? { label: "✓ ใช้แล้ว", bg: "#dbeafe", color: "#1e40af", subtitle: r.used_in_income }
                  : { label: "💰 คงเหลือ", bg: "#d1fae5", color: "#065f46" };
                return (
                <tr key={r.cn_id || i} style={{ background: isCancelled ? "#fef2f2" : i % 2 === 0 ? "#fff" : "#f9fafb", opacity: isCancelled ? 0.7 : 1 }}>
                  <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#7c2d12" }}>{r.credit_note_no || "-"}</td>
                  <td style={td}>{fmtDate(r.credit_note_date)}</td>
                  <td style={{ ...tdNum, fontWeight: 700, color: "#dc2626" }}>{fmt(r.amount)}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 12, background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}
                      title={badge.subtitle ? `ใช้ใน ${badge.subtitle}` : ""}>
                      {badge.label}
                    </span>
                    {badge.subtitle && (
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2, fontFamily: "monospace" }}>{badge.subtitle}</div>
                    )}
                  </td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12, color: "#0369a1" }}>{r.paid_doc_no || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.billing_doc_nos || "-"}</td>
                  <td style={td}>{r.vendor_name || "-"}</td>
                  <td style={td}>{r.category || "-"}</td>
                  <td style={{ ...td, maxWidth: 240, whiteSpace: "normal" }}>{r.note || "-"}</td>
                  <td style={td}>{r.created_by || "-"}</td>
                  <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>{r.created_at ? new Date(r.created_at).toLocaleString("th-TH") : "-"}</td>
                </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "#fef9c3", fontWeight: 700 }}>
              <tr>
                <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} ใบ</td>
                <td style={{ ...tdNum, color: "#dc2626", fontSize: 15 }}>{fmt(totalAmount)}</td>
                <td colSpan={8}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
