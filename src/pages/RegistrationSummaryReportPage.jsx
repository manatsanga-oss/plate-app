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
function lastDayOfMonth(ym) {
  // ym = "YYYY-MM" → last day of that month "YYYY-MM-DD"
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 0); // day 0 of next month = last day of this month
  return `${y}-${String(m).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtMonthLabel(ym) {
  // "2026-05" → "พ.ค. 2569"
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  const names = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${names[m-1]} ${y+543}`;
}

const BRANCH_LABEL = {
  PAPAO: { label: "ป.เปา", bg: "#dbeafe", color: "#1e40af" },
  NAKORNLUANG: { label: "นครหลวง", bg: "#fef3c7", color: "#92400e" },
  SINGCHAI: { label: "สิงห์ชัย", bg: "#fce7f3", color: "#9d174d" },
};

export default function RegistrationSummaryReportPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoiceMonth, setInvoiceMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [branchFilter, setBranchFilter] = useState("all");
  const [regPaidMonth, setRegPaidMonth] = useState("");  // YYYY-MM
  const [insPaidMonth, setInsPaidMonth] = useState("");  // YYYY-MM
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  // กรอกยอดเองเมื่อคอลัมน์ว่าง (ใช้แสดง/พิมพ์เท่านั้น ไม่บันทึกลง DB) — { "branch|เลขใบกำกับ": { op: "", rc: "" } }
  const [manualFees, setManualFees] = useState({});

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_registration_summary",
          date_from: invoiceMonth ? `${invoiceMonth}-01` : "",
          date_to:   invoiceMonth ? lastDayOfMonth(invoiceMonth) : "",
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

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [invoiceMonth]);

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

  // แยกยอด: ค่าดำเนินการ-จดทะเบียน / ค่าจดทะเบียนตามใบเสร็จ (ค่าจดทะเบียน+ขอใช้-ค่าจดทะเบียน)
  // ถ้าค่าจาก DB ว่าง ใช้ค่าที่กรอกเอง (manualFees) แทน — สำหรับแสดง/พิมพ์เท่านั้น
  const rowKey = (r) => `${r.branch}|${r.tax_invoice_no}`;
  const effOp = (r) => { const v = Number(r.reg_fee_operation || 0); return v !== 0 ? v : Number(manualFees[rowKey(r)]?.op || 0); };
  const effRc = (r) => { const v = Number(r.reg_fee_receipt || 0); return v > 0 ? v : Number(manualFees[rowKey(r)]?.rc || 0); };
  const setManual = (r, field, value) => setManualFees(p => ({ ...p, [rowKey(r)]: { ...p[rowKey(r)], [field]: value } }));
  const totalRegOperation = filtered.reduce((s, r) => s + effOp(r), 0);
  const totalRegReceipt = filtered.reduce((s, r) => s + effRc(r), 0);
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
    const header = ["#", "สาขา", "เลขที่ใบกำกับ", "วันที่", "ลูกค้า", "ไฟแนนท์", "เลขถัง", "เลขเครื่อง", "รุ่น", "ใบขาย", "วันที่ขาย", "ค่าดำเนินการ-จดทะเบียน", "ค่าจดทะเบียนตามใบเสร็จ", "ค่า พรบ."];
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
        effOp(r).toFixed(2),
        effRc(r).toFixed(2),
        Number(r.total_insurance_premium || 0).toFixed(2),
      ];
      lines.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `รายงานสรุปใบปะหน้า คชจ. ขายรถ_${invoiceMonth || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    if (filtered.length === 0) { setMessage("ไม่มีข้อมูลให้พิมพ์"); return; }
    const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const branchLabel = filtered.length && branchFilter !== "all" ? (BRANCH_LABEL[branchFilter]?.label || branchFilter) : "ทุกสาขา";
    const body = filtered.map((r, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td class="c">${esc(BRANCH_LABEL[r.branch]?.label || r.branch || "-")}</td>
        <td class="m">${esc(r.tax_invoice_no || "-")}</td>
        <td class="c">${esc(fmtDate(r.invoice_date))}</td>
        <td>${esc(r.sale_customer_name || r.customer_name || "-")}${r.sale_finance_company ? `<div class="sub">${esc(r.sale_finance_company)}</div>` : ""}</td>
        <td class="m">${esc(r.chassis_no || "-")}</td>
        <td class="m">${esc(r.engine_no || "-")}</td>
        <td>${esc(r.model_name || "-")}</td>
        <td class="m">${esc(r.sale_invoice_no || "-")}</td>
        <td class="c">${esc(fmtDate(r.sale_date))}</td>
        <td class="r">${effOp(r) !== 0 ? fmt(effOp(r)) + (Number(r.reg_fee_operation || 0) === 0 ? " *" : "") : "-"}${r.reg_paid_at ? `<div class="sub">จ่าย: ${esc(fmtDate(r.reg_paid_at))}</div>` : ""}</td>
        <td class="r">${effRc(r) > 0 ? fmt(effRc(r)) + (Number(r.reg_fee_receipt || 0) <= 0 ? " *" : "") : "-"}</td>
        <td class="r">${Number(r.total_insurance_premium) > 0 ? fmt(r.total_insurance_premium) : "-"}${r.ins_paid_at ? `<div class="sub">จ่าย: ${esc(fmtDate(r.ins_paid_at))}</div>` : ""}</td>
        <td class="r">${Number(r.credit_note_total) > 0 ? fmt(r.credit_note_total) : "-"}</td>
        <td class="r">${Number(r.coupon_total) > 0 ? fmt(r.coupon_total) : "-"}</td>
      </tr>`).join("");
    const totalCredit = filtered.reduce((s, r) => s + Number(r.credit_note_total || 0), 0);
    const totalCoupon = filtered.reduce((s, r) => s + Number(r.coupon_total || 0), 0);
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานสรุปใบปะหน้า คชจ. ขายรถ ${esc(invoiceMonth || "")}</title>
      <style>
        *{font-family:'Tahoma','Sarabun',sans-serif;box-sizing:border-box}
        body{margin:18px;color:#111827;font-size:11px}
        h1{font-size:16px;margin:0 0 2px}
        .sub2{color:#374151;margin-bottom:10px;font-size:12px}
        .totals{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:8px;font-size:12px}
        .totals b{font-family:monospace}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #cbd5e1;padding:3px 5px;vertical-align:top}
        th{background:#e2e8f0;font-size:10px;white-space:nowrap}
        .c{text-align:center}.r{text-align:right;font-family:monospace;white-space:nowrap}
        .m{font-family:monospace;font-size:10px}
        .sub{color:#6b7280;font-size:9px}
        tfoot td{font-weight:bold;background:#f1f5f9}
        @page{size:A4 landscape;margin:10mm}
        @media print{body{margin:0}}
      </style></head><body>
      <h1>📋 รายงานสรุปใบปะหน้า คชจ. ขายรถ</h1>
      <div class="sub2">เดือนใบกำกับ: ${esc(invoiceMonth ? fmtMonthLabel(invoiceMonth) : "ทั้งหมด")} · สาขา: ${esc(branchLabel)}${regPaidMonth ? ` · จ่ายทะเบียน: ${esc(fmtMonth(regPaidMonth))}` : ""}${insPaidMonth ? ` · จ่าย พรบ.: ${esc(fmtMonth(insPaidMonth))}` : ""}</div>
      <div class="totals">
        <span>จำนวน <b>${filtered.length}</b> ใบ</span>
        <span>ค่าดำเนินการ-จดทะเบียนรวม <b>${fmt(totalRegOperation)}</b></span>
        <span>ค่าจดทะเบียนตามใบเสร็จรวม <b>${fmt(totalRegReceipt)}</b></span>
        <span>ค่า พรบ. รวม <b>${fmt(totalInsPremium)}</b></span>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>สาขา</th><th>เลขที่ใบกำกับ</th><th>วันที่</th><th>ลูกค้า / ไฟแนนท์</th>
          <th>เลขถัง</th><th>เลขเครื่อง</th><th>รุ่น</th><th>ใบขาย</th><th>วันที่ขาย</th>
          <th>ค่าดำเนินการ-จดทะเบียน</th><th>ค่าจดทะเบียนตามใบเสร็จ</th><th>ค่า พรบ.</th>
          <th>ประกันรถหายออกแทน</th><th>ดาวน์/งวดออกแทน</th>
        </tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr>
          <td colspan="10" class="r">รวม ${filtered.length} ใบ</td>
          <td class="r">${fmt(totalRegOperation)}</td>
          <td class="r">${fmt(totalRegReceipt)}</td>
          <td class="r">${fmt(totalInsPremium)}</td>
          <td class="r">${fmt(totalCredit)}</td>
          <td class="r">${fmt(totalCoupon)}</td>
        </tr></tfoot>
      </table>
      ${filtered.some(r => (Number(r.reg_fee_operation || 0) === 0 && effOp(r) !== 0) || (Number(r.reg_fee_receipt || 0) <= 0 && effRc(r) > 0))
        ? '<div class="sub" style="margin-top:6px;font-size:10px">* ยอดที่กรอกเองหน้ารายงาน (ไม่ได้บันทึกในระบบ)</div>' : ""}
    </body></html>`;
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) { setMessage("❌ เปิดหน้าต่างพิมพ์ไม่ได้ (popup ถูกบล็อก)"); return; }
    w.document.write(html + "<script>window.onload=function(){window.print();}<\/script>");
    w.document.close();
  }

  const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12, background: "#072d6b", color: "#fff" };
  const td = { padding: "8px", borderBottom: "1px solid #e5e7eb", fontSize: 13 };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📋 รายงานสรุปใบปะหน้า คชจ. ขายรถ</h2>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>📅 เดือนใบกำกับ:</label>
        <input type="month" value={invoiceMonth} onChange={e => setInvoiceMonth(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, minWidth: 140 }} />
        <span style={{ fontSize: 11, color: "#6b7280" }}>{invoiceMonth ? fmtMonthLabel(invoiceMonth) : ""}</span>
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
        <button onClick={printReport} disabled={filtered.length === 0}
          style={{ padding: "7px 14px", background: filtered.length === 0 ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: filtered.length === 0 ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13 }}>
          🖨️ พิมพ์
        </button>
      </div>

      {/* Summary — count + ยอดจดทะเบียน */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ padding: "10px 18px", background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "#1e40af" }}>📋 จำนวนใบกำกับทั้งหมด</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1e3a8a" }}>{filtered.length} ใบ</div>
        </div>
        <div style={{ padding: "10px 18px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "#92400e" }}>💰 ค่าดำเนินการ-จดทะเบียนรวม</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#92400e" }}>฿ {fmt(totalRegOperation)}</div>
        </div>
        <div style={{ padding: "10px 18px", background: "#ede9fe", border: "1px solid #c4b5fd", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "#5b21b6" }}>🧾 ค่าจดทะเบียนตามใบเสร็จรวม</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#5b21b6" }}>฿ {fmt(totalRegReceipt)}</div>
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
                <th style={{ ...th, textAlign: "right" }}>ค่าดำเนินการ-จดทะเบียน</th>
                <th style={{ ...th, textAlign: "right", background: "#4c1d95" }}>ค่าจดทะเบียนตามใบเสร็จ</th>
                <th style={{ ...th, textAlign: "right" }}>ค่า พรบ.</th>
                <th style={{ ...th, textAlign: "right", background: "#a16207", color: "#fff" }}>ประกันรถหายออกแทน</th>
                <th style={{ ...th, textAlign: "right", background: "#be185d", color: "#fff" }}>ดาวน์/งวดออกแทน</th>
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
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: Number(r.reg_fee_operation) > 0 ? "#92400e" : "#9ca3af" }}>
                      {Number(r.reg_fee_operation) !== 0 ? fmt(r.reg_fee_operation) : (
                        <input type="number" step="0.01" value={manualFees[rowKey(r)]?.op ?? ""}
                          onChange={e => setManual(r, "op", e.target.value)}
                          placeholder="-" title="กรอกเองสำหรับพิมพ์ (ไม่บันทึก)"
                          style={{ width: 80, padding: "3px 5px", textAlign: "right", fontFamily: "monospace", fontSize: 12, border: "1px dashed #fbbf24", borderRadius: 4, background: "#fffbeb", color: "#92400e" }} />
                      )}
                      {r.reg_paid_at && (
                        <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "Tahoma", fontWeight: 400 }}>
                          จ่าย: {fmtDate(r.reg_paid_at)}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: Number(r.reg_fee_receipt) > 0 ? "#5b21b6" : "#9ca3af" }}>
                      {Number(r.reg_fee_receipt) > 0 ? fmt(r.reg_fee_receipt) : (
                        <input type="number" step="0.01" value={manualFees[rowKey(r)]?.rc ?? ""}
                          onChange={e => setManual(r, "rc", e.target.value)}
                          placeholder="-" title="กรอกเองสำหรับพิมพ์ (ไม่บันทึก)"
                          style={{ width: 80, padding: "3px 5px", textAlign: "right", fontFamily: "monospace", fontSize: 12, border: "1px dashed #c4b5fd", borderRadius: 4, background: "#f5f3ff", color: "#5b21b6" }} />
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
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: Number(r.credit_note_total) > 0 ? "#a16207" : "#9ca3af" }}>
                      {Number(r.credit_note_total) > 0 ? fmt(r.credit_note_total) : "-"}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: Number(r.coupon_total) > 0 ? "#be185d" : "#9ca3af" }}>
                      {Number(r.coupon_total) > 0 ? fmt(r.coupon_total) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "#fef9c3", fontWeight: 700 }}>
              <tr>
                <td colSpan={10} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} ใบ</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#92400e", fontSize: 14 }}>{fmt(totalRegOperation)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#5b21b6", fontSize: 14 }}>{fmt(totalRegReceipt)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#065f46", fontSize: 14 }}>{fmt(totalInsPremium)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#a16207", fontSize: 14 }}>
                  {fmt(filtered.reduce((s, r) => s + Number(r.credit_note_total || 0), 0))}
                </td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#be185d", fontSize: 14 }}>
                  {fmt(filtered.reduce((s, r) => s + Number(r.coupon_total || 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
