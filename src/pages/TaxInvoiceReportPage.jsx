import React, { useEffect, useMemo, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/list-tax-invoices";

const BRANCH_OPTS = [
  { value: "PAPAO", label: "ป.เปา", table: "tax_invoices_papao" },
  { value: "NAKORNLUANG", label: "นครหลวง", table: "tax_invoices_nakornluang" },
  { value: "SINGCHAI", label: "สิงห์ชัย", table: "tax_invoices_singchai" },
];

function fmtDate(s) {
  if (!s) return "-";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const yy = (parseInt(m[1], 10) + 543).toString().slice(-2);
  return `${m[3]}/${m[2]}/${yy}`;
}

function fmtN(n) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default function TaxInvoiceReportPage({ currentUser }) {
  const [branch, setBranch] = useState("PAPAO");
  const [yearMonth, setYearMonth] = useState(""); // 256904
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // active / cancelled
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_tax_invoices",
          branch,
          year_month: yearMonth || null,
        }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : data?.rows || [];
      setRows(arr);
    } catch (e) {
      setMessage("❌ โหลดไม่สำเร็จ: " + e.message);
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [branch]);

  const kw = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (yearMonth && String(r.invoice_year_month || "") !== yearMonth) return false;
      if (!kw) return true;
      const hay = [
        r.tax_invoice_no, r.customer_name, r.sale_customer_name, r.customer_tax_id,
        r.chassis_no, r.engine_no, r.model_name, r.plate_number,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(kw);
    });
  }, [rows, kw, statusFilter, yearMonth]);

  // Year-month options derived from data
  const ymOpts = useMemo(() => {
    const set = new Set();
    rows.forEach(r => { if (r.invoice_year_month) set.add(r.invoice_year_month); });
    return [...set].sort().reverse();
  }, [rows]);

  const totals = filtered.reduce((s, r) => {
    if (r.status === "cancelled") return s;
    s.before += Number(r.amount_before_vat || 0);
    s.vat += Number(r.vat_amount || 0);
    s.total += Number(r.total_amount || 0);
    s.profit += Number(r.gross_profit || 0);
    return s;
  }, { before: 0, vat: 0, total: 0, profit: 0 });

  const branchOpt = BRANCH_OPTS.find(b => b.value === branch);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">📊 รายงานใบกำกับภาษี (HONDA)</div>
      </div>

      {/* Filters */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <label style={lbl}>🏢 สาขา</label>
            <select value={branch} onChange={e => setBranch(e.target.value)} style={{ ...inp, minWidth: 160 }}>
              {BRANCH_OPTS.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>📅 เดือน-ปี</label>
            <select value={yearMonth} onChange={e => setYearMonth(e.target.value)} style={{ ...inp, minWidth: 130, fontFamily: "monospace" }}>
              <option value="">ทั้งหมด</option>
              {ymOpts.map(ym => <option key={ym} value={ym}>{ym}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>สถานะ</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, minWidth: 110 }}>
              <option value="">ทั้งหมด</option>
              <option value="active">ใช้งาน</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={lbl}>🔍 ค้นหา</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="เลขที่ / ลูกค้า (ทั้งจริง+ใบกำกับ) / เลขผู้เสียภาษี / เลขถัง / เลขเครื่อง / รุ่น / ทะเบียน"
              style={inp} />
          </div>
          <div>
            <label style={lbl}>&nbsp;</label>
            <button onClick={fetchData} disabled={loading}
              style={{ padding: "8px 16px", background: loading ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
              🔄 {loading ? "โหลด..." : "Refresh"}
            </button>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280" }}>
          📦 Table: <code style={{ color: "#6366f1" }}>{branchOpt?.table}</code>
        </div>
        {message && <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12 }}>{message}</div>}
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <SummaryCard color="#dbeafe" textColor="#1e40af" label="ยอดก่อน VAT" value={totals.before} count={filtered.filter(r => r.status === "active").length} suffix="รายการ" />
        <SummaryCard color="#fef3c7" textColor="#92400e" label="ยอดภาษี" value={totals.vat} />
        <SummaryCard color="#dcfce7" textColor="#065f46" label="ยอดรวม" value={totals.total} />
        <SummaryCard color="#ede9fe" textColor="#5b21b6" label="กำไรขั้นต้น" value={totals.profit} />
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" }}>
        <div style={{ marginBottom: 8, fontSize: 13, color: "#374151" }}>
          พบ <strong>{filtered.length}</strong> / {rows.length} รายการ
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>เลขที่ใบกำกับ</th>
                <th>วันที่</th>
                <th>ลูกค้า</th>
                <th>เลขผู้เสียภาษี</th>
                <th>เลขถัง</th>
                <th>เลขเครื่อง</th>
                <th>รุ่น</th>
                <th style={{ textAlign: "right" }}>ก่อน VAT</th>
                <th style={{ textAlign: "right" }}>VAT</th>
                <th style={{ textAlign: "right" }}>รวม</th>
                <th style={{ textAlign: "right" }}>ทุน</th>
                <th style={{ textAlign: "right" }}>กำไร</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={14} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
                  {loading ? "กำลังโหลด..." : "ไม่มีข้อมูล"}
                </td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.tax_invoice_no} style={{ background: r.status === "cancelled" ? "#fef2f2" : undefined }}>
                  <td style={{ textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                  <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{r.tax_invoice_no}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.invoice_date)}</td>
                  <td>
                    {r.status === "cancelled" ? (
                      <em style={{ color: "#dc2626" }}>ยกเลิก</em>
                    ) : r.sale_customer_name ? (
                      <>
                        <div style={{ fontWeight: 600, color: "#072d6b" }}>{r.sale_customer_name}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af" }}>📋 ใบกำกับ: {r.customer_name}</div>
                      </>
                    ) : (
                      <span>{r.customer_name || "-"}</span>
                    )}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.customer_tax_id || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.engine_no || "-"}</td>
                  <td style={{ fontSize: 11, color: "#6b7280" }}>{r.model_name || "-"}</td>
                  <td style={{ textAlign: "right" }}>{r.amount_before_vat ? fmtN(r.amount_before_vat) : "-"}</td>
                  <td style={{ textAlign: "right" }}>{r.vat_amount ? fmtN(r.vat_amount) : "-"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{r.total_amount ? fmtN(r.total_amount) : "-"}</td>
                  <td style={{ textAlign: "right", color: "#6b7280" }}>{r.cost_price ? fmtN(r.cost_price) : "-"}</td>
                  <td style={{ textAlign: "right", color: "#15803d", fontWeight: 600 }}>{r.gross_profit ? fmtN(r.gross_profit) : "-"}</td>
                  <td>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: r.status === "cancelled" ? "#fee2e2" : "#dcfce7",
                      color: r.status === "cancelled" ? "#991b1b" : "#065f46" }}>
                      {r.status === "cancelled" ? "ยกเลิก" : "ใช้งาน"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                  <td colSpan={8} style={{ textAlign: "right" }}>รวม (เฉพาะใช้งาน)</td>
                  <td style={{ textAlign: "right" }}>{fmtN(totals.before)}</td>
                  <td style={{ textAlign: "right" }}>{fmtN(totals.vat)}</td>
                  <td style={{ textAlign: "right", color: "#072d6b" }}>{fmtN(totals.total)}</td>
                  <td></td>
                  <td style={{ textAlign: "right", color: "#15803d" }}>{fmtN(totals.profit)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ color, textColor, label, value, count, suffix }) {
  return (
    <div style={{ padding: "12px 16px", background: color, borderRadius: 10 }}>
      <div style={{ fontSize: 12, color: textColor, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, color: textColor, fontWeight: 700, marginTop: 4 }}>{fmtN(value)}</div>
      {count != null && <div style={{ fontSize: 11, color: textColor, opacity: 0.8 }}>{count} {suffix || ""}</div>}
    </div>
  );
}

const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 3 };
const inp = { width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
