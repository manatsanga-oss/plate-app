import React, { useEffect, useMemo, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/list-tax-invoices";
const LIST_RECEIPTS_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/list-daily-receipts";

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
  const [paymentFilter, setPaymentFilter] = useState(""); // paid_full / paid_partial / unpaid
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  // Receipt detail popup
  const [detailRow, setDetailRow] = useState(null);  // tax invoice row
  const [detailReceipts, setDetailReceipts] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  async function openReceiptDetail(r) {
    setDetailRow(r);
    setDetailReceipts([]);
    setDetailLoading(true);
    try {
      const res = await fetch(LIST_RECEIPTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_daily_receipts",
          sale_invoice_no: r.sale_invoice_no,
        }),
      });
      const data = await res.json();
      setDetailReceipts(Array.isArray(data) ? data : []);
    } catch (e) {
      setDetailReceipts([]);
    }
    setDetailLoading(false);
  }

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
      if (paymentFilter && (r.payment_status || "unpaid") !== paymentFilter) return false;
      if (yearMonth && String(r.invoice_year_month || "") !== yearMonth) return false;
      if (!kw) return true;
      const hay = [
        r.tax_invoice_no, r.customer_name, r.sale_customer_name, r.sale_finance_company,
        r.customer_tax_id, r.chassis_no, r.engine_no, r.model_name, r.plate_number,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(kw);
    });
  }, [rows, kw, statusFilter, paymentFilter, yearMonth]);

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
          <div>
            <label style={lbl}>สถานะการจ่าย</label>
            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} style={{ ...inp, minWidth: 130 }}>
              <option value="">ทั้งหมด</option>
              <option value="paid_full">✅ ชำระครบ</option>
              <option value="paid_partial">⚠️ บางส่วน</option>
              <option value="unpaid">❌ ยังไม่ชำระ</option>
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
          <table className="data-table" style={{ fontSize: 12, width: "100%", whiteSpace: "nowrap" }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>เลขที่ใบกำกับ</th>
                <th>เลขที่ใบขาย</th>
                <th>วันที่</th>
                <th style={{ minWidth: 200 }}>ลูกค้า</th>
                <th>เลขถัง</th>
                <th>เลขเครื่อง</th>
                <th>รุ่น</th>
                <th style={{ textAlign: "right" }}>รวม</th>
                <th style={{ textAlign: "right" }}>รับชำระ</th>
                <th>สถานะจ่าย</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
                  {loading ? "กำลังโหลด..." : "ไม่มีข้อมูล"}
                </td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.tax_invoice_no} style={{ background: r.status === "cancelled" ? "#fef2f2" : undefined }}>
                  <td style={{ textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                  <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{r.tax_invoice_no}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11, color: "#0369a1" }}>{r.sale_invoice_no || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.invoice_date)}</td>
                  <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>
                    {r.status === "cancelled" ? (
                      <em style={{ color: "#dc2626" }}>ยกเลิก</em>
                    ) : r.sale_customer_name ? (
                      <>
                        <div style={{ fontWeight: 600, color: "#072d6b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.sale_customer_name}>{r.sale_customer_name}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.customer_name || r.sale_finance_company || "-"}>📋 {r.customer_name || r.sale_finance_company || "-"}</div>
                      </>
                    ) : (
                      <span title={r.customer_name || r.sale_finance_company || "-"}>{r.customer_name || r.sale_finance_company || "-"}</span>
                    )}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.engine_no || "-"}</td>
                  <td style={{ fontSize: 11, color: "#6b7280" }}>{r.model_name || "-"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{r.total_amount ? fmtN(r.total_amount) : "-"}</td>
                  <td style={{ textAlign: "right" }}>
                    {Number(r.total_paid || 0) > 0 || r.receipt_count > 0 ? (
                      <button
                        onClick={() => openReceiptDetail(r)}
                        title="คลิกดูรายละเอียดใบเสร็จ"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#0369a1",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: 0,
                          textAlign: "right",
                          fontFamily: "inherit",
                          fontSize: "inherit",
                          textDecoration: "underline",
                        }}
                      >
                        {fmtN(r.total_paid)}
                        <div style={{ fontSize: 10, color: "#6b7280" }}>📋 {r.receipt_count} ใบ</div>
                      </button>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>-</span>
                    )}
                  </td>
                  <td>
                    {(() => {
                      const ps = r.payment_status || "unpaid";
                      const cfg = {
                        paid_full: { bg: "#dcfce7", color: "#065f46", label: "✅ ชำระครบ" },
                        paid_partial: { bg: "#fef3c7", color: "#92400e", label: "⚠️ บางส่วน" },
                        unpaid: { bg: "#fee2e2", color: "#991b1b", label: "❌ ยังไม่ชำระ" },
                      }[ps];
                      return (
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </td>
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
                  <td style={{ textAlign: "right", color: "#0369a1" }}>{fmtN(filtered.filter(r => r.status === "active").reduce((s, r) => s + Number(r.total_paid || 0), 0))}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Receipt Detail Modal */}
      {detailRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          onClick={() => setDetailRow(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 1200, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <h3 style={{ margin: 0, color: "#0369a1" }}>📋 รายละเอียดใบเสร็จรับเงิน</h3>
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                ใบกำกับ: <code style={{ color: "#072d6b", fontWeight: 700 }}>{detailRow.tax_invoice_no}</code>
                {detailRow.sale_invoice_no && <> · ใบขาย: <code style={{ color: "#0369a1" }}>{detailRow.sale_invoice_no}</code></>}
              </span>
              <button onClick={() => setDetailRow(null)} style={{ marginLeft: "auto", padding: "6px 14px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>ปิด</button>
            </div>

            {/* Tax invoice summary */}
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 8, marginBottom: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, fontSize: 13 }}>
              <div><span style={{ color: "#6b7280" }}>ลูกค้า:</span> <strong>{detailRow.sale_customer_name || detailRow.customer_name || "-"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>ไฟแนนท์:</span> <strong style={{ color: "#7c3aed" }}>{detailRow.customer_name || detailRow.sale_finance_company || "-"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>เลขเครื่อง:</span> <strong style={{ fontFamily: "monospace" }}>{detailRow.engine_no || "-"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>เลขถัง:</span> <strong style={{ fontFamily: "monospace" }}>{detailRow.chassis_no || "-"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>รุ่น:</span> <strong>{detailRow.model_name || "-"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>ทะเบียน:</span> <strong>{detailRow.plate_number || "-"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>ยอดรวม:</span> <strong style={{ color: "#dc2626" }}>{fmtN(detailRow.total_amount)}</strong></div>
              <div><span style={{ color: "#6b7280" }}>รับชำระ:</span> <strong style={{ color: "#0369a1" }}>{fmtN(detailRow.total_paid)}</strong></div>
              <div><span style={{ color: "#6b7280" }}>คงเหลือ:</span> <strong style={{ color: (detailRow.total_amount - detailRow.total_paid) > 0.01 ? "#dc2626" : "#15803d" }}>{fmtN(Math.max(0, Number(detailRow.total_amount || 0) - Number(detailRow.total_paid || 0)))}</strong></div>
              <div><span style={{ color: "#6b7280" }}>สถานะ:</span> <strong>{detailRow.payment_status === "paid_full" ? "✅ ครบ" : detailRow.payment_status === "paid_partial" ? "⚠️ บางส่วน" : "❌ ยังไม่ชำระ"}</strong></div>
            </div>

            {/* Receipts table */}
            {detailLoading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
            ) : detailReceipts.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
                {detailRow.sale_invoice_no ? "ยังไม่มีใบเสร็จที่อ้างอิงใบขายนี้" : "⚠️ ใบกำกับนี้ไม่มี link กับใบขาย (chassis_no ไม่ตรงกับ moto_sales)"}
              </div>
            ) : (
              <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
                  <thead style={{ background: "#0369a1", color: "#fff" }}>
                    <tr>
                      <th>#</th>
                      <th>เลขที่ใบเสร็จ</th>
                      <th>วันที่</th>
                      <th>ประเภท</th>
                      <th>ลูกค้า</th>
                      <th>พนักงาน</th>
                      <th style={{ textAlign: "right" }}>เงินสด</th>
                      <th style={{ textAlign: "right" }}>เงินโอน</th>
                      <th style={{ textAlign: "right" }}>มัดจำ</th>
                      <th style={{ textAlign: "right" }}>เช็ค</th>
                      <th style={{ textAlign: "right" }}>ประกันรถหายออกแทน</th>
                      <th style={{ textAlign: "right" }}>เงินดาวน์/ค่างวดออกแทน</th>
                      <th style={{ textAlign: "right" }}>WHT</th>
                      <th style={{ textAlign: "right" }}>รวม</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailReceipts.map((r, i) => (
                      <tr key={r.receipt_no} style={{ background: r.status === "ปกติ" ? undefined : "#fef2f2" }}>
                        <td style={{ textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                        <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{r.receipt_no}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.receipt_date)}</td>
                        <td style={{ fontSize: 11 }}>{r.receipt_type || "-"}</td>
                        <td>{r.customer_name || "-"}</td>
                        <td style={{ fontSize: 11 }}>{r.cashier || "-"}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{r.cash > 0 ? fmtN(r.cash) : "-"}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                          {r.transfer > 0 ? (
                            <>
                              {fmtN(r.transfer)}
                              {Array.isArray(r.transfer_breakdown) && r.transfer_breakdown.length > 0 && (
                                <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2, fontFamily: "Tahoma", textAlign: "right" }}>
                                  {r.transfer_breakdown.map((tb, idx) => (
                                    <div key={idx} title={`${tb.bank_name} · ${tb.account_purpose}`}>
                                      → <span style={{ color: "#0369a1", fontFamily: "monospace" }}>{tb.bank_account_no}</span>
                                      <span style={{ color: "#9ca3af" }}> ({fmtN(tb.amount)})</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : "-"}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{r.deposit > 0 ? fmtN(r.deposit) : "-"}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{r.cheque > 0 ? fmtN(r.cheque) : "-"}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace", color: "#7c3aed" }}>{r.credit_note > 0 ? fmtN(r.credit_note) : "-"}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace", color: "#0891b2" }}>{r.coupon > 0 ? fmtN(r.coupon) : "-"}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{r.wht > 0 ? fmtN(r.wht) : "-"}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#15803d" }}>{fmtN(r.total_amount)}</td>
                        <td>
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                            background: r.status === "ปกติ" ? "#dcfce7" : "#fee2e2",
                            color: r.status === "ปกติ" ? "#065f46" : "#991b1b" }}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                      <td colSpan={6} style={{ textAlign: "right" }}>รวม {detailReceipts.length} ใบ</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmtN(detailReceipts.reduce((s, r) => s + Number(r.cash || 0), 0))}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmtN(detailReceipts.reduce((s, r) => s + Number(r.transfer || 0), 0))}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmtN(detailReceipts.reduce((s, r) => s + Number(r.deposit || 0), 0))}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmtN(detailReceipts.reduce((s, r) => s + Number(r.cheque || 0), 0))}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", color: "#7c3aed" }}>{fmtN(detailReceipts.reduce((s, r) => s + Number(r.credit_note || 0), 0))}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", color: "#0891b2" }}>{fmtN(detailReceipts.reduce((s, r) => s + Number(r.coupon || 0), 0))}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{fmtN(detailReceipts.reduce((s, r) => s + Number(r.wht || 0), 0))}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", color: "#15803d" }}>{fmtN(detailReceipts.reduce((s, r) => s + Number(r.total_amount || 0), 0))}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
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
