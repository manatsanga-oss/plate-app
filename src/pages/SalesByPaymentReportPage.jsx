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
  const [markups, setMarkups] = useState([]);
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
  async function fetchMarkups() {
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_price_markups" }),
      });
      const data = await res.json();
      setMarkups((Array.isArray(data) ? data : []).filter(m => m.status === "active"));
    } catch { setMarkups([]); }
  }
  useEffect(() => { fetchData(); fetchMarkups(); /* eslint-disable-next-line */ }, []);

  // หา markup ที่เข้าเงื่อนไขกับแถวขายนี้
  function getMarkups(r) {
    // normalize ชื่อบริษัท: lowercase + ตัด whitespace + ตัด punctuation ทั่วไป
    const norm = (s) => String(s || "").toLowerCase().replace(/[\s\(\)\[\]\.\-_]/g, "").trim();
    const finN = norm(r.sale_finance_company);
    const inv = r.sale_invoice_no || r.tax_invoice_no || "";
    const brand = (r.matched_brand || r.brand || "").toLowerCase();
    const modelCode = (r.model_code || "").toLowerCase();
    const branchGroup = (() => {
      const bc = (r.branch_code || (r.sale_invoice_no || "").slice(0, 5) || "").toUpperCase();
      if (["SCY05","SCY06"].includes(bc)) return "papao";
      if (["SCY01","SCY04","SCY07"].includes(bc)) return "singchai";
      return "all";
    })();
    const finMatch = (m) => {
      if (!finN || !m.finance_company) return false;
      const mN = norm(m.finance_company);
      return mN === finN || mN.includes(finN) || finN.includes(mN);
    };
    const branchCode = (r.branch_code || (r.sale_invoice_no || "").slice(0, 5) || "").toUpperCase();
    // ดึง CC จาก model_code / model_name (3-4 หลักในรุ่นรถ เช่น AFS110, CLICK160, PCX160)
    const extractCC = (txt) => {
      if (!txt) return null;
      const matches = String(txt).match(/\d{3,4}/g) || [];
      for (const m of matches) {
        const v = parseInt(m, 10);
        if (v >= 75 && v <= 2500) return v;
      }
      return null;
    };
    const saleCC = extractCC(r.model_code) ?? extractCC(r.model_name) ?? extractCC(r.matched_model_code) ?? extractCC(r.matched_model_series);
    return markups.filter(m => {
      if (m.markup_type === "finance") return finMatch(m);
      if (m.markup_type === "finance_cc") {
        if (!finMatch(m)) return false;
        if (m.branch_group && m.branch_group !== branchCode) return false;
        // CC range
        if (saleCC !== null) {
          if (m.cc_min && saleCC < Number(m.cc_min)) return false;
          if (m.cc_max && saleCC > Number(m.cc_max)) return false;
        }
        return true;
      }
      if (m.markup_type === "installment_bonus") return inv && m.sale_invoice_no === inv;
      if (m.markup_type === "cosmos_insurance") return inv && m.sale_invoice_no === inv;
      if (m.markup_type === "custom") {
        if (m.brand && m.brand.toLowerCase() !== brand) return false;
        if (m.model_code && m.model_code.toLowerCase() !== modelCode) return false;
        if (m.branch_group && m.branch_group !== "all" && m.branch_group !== branchGroup) return false;
        return true;
      }
      return false;
    });
  }

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
    const delivery_fee = Number(r.delivery_fee_amount || 0);
    return { cash, transfer, deposit, cheque, credit_note, coupon, ft, delivery_fee, total: cash + transfer + deposit + cheque + credit_note + coupon + ft };
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

  // mismatch helper — เทียบ ยอดขาย vs (ราคาขายประกาศ + รายการบวกเพิ่ม)
  function markupTotal(r) {
    return getMarkups(r).reduce((s, m) => s + Number(m.markup_amount || 0), 0);
  }
  function isMismatch(r) {
    const sa = Number(r.total_amount || 0);
    const sp = Number(r.sale_price || 0);
    const mk = markupTotal(r);
    return sp > 0 && Math.abs(sa - (sp + mk)) > 0.01;
  }
  const mismatchCount = filtered.filter(isMismatch).length;

  // Totals
  const totals = filtered.reduce((acc, r) => {
    const s = sumByMethod(r);
    acc.cash += s.cash; acc.transfer += s.transfer; acc.deposit += s.deposit; acc.cheque += s.cheque;
    acc.credit_note += s.credit_note; acc.coupon += s.coupon; acc.ft += s.ft; acc.total += s.total;
    acc.delivery_fee += s.delivery_fee;
    acc.sale_total += Number(r.total_amount || 0);
    return acc;
  }, { cash: 0, transfer: 0, deposit: 0, cheque: 0, credit_note: 0, coupon: 0, ft: 0, delivery_fee: 0, total: 0, sale_total: 0 });

  function printReport() {
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear() + 543}`;
    const dfDisp = fmtDate(dateFrom);
    const dtDisp = fmtDate(dateTo);
    const branchTxt = branchFilter === "all" ? "ทุกสาขา" : branchFilter;
    const methodTxt = activeMethods.length > 0 ? ` · กรอง: ${activeMethods.join(", ")}` : "";

    const rows_html = filtered.map((r, i) => {
      const s = sumByMethod(r);
      const sa = Number(r.total_amount || 0);
      const sp = Number(r.sale_price || 0);
      const mk = markupTotal(r);
      const mismatch = sp > 0 && Math.abs(sa - (sp + mk)) > 0.01;
      const typeTxt = (() => {
        const t = r.sale_invoice_type || "";
        if (t.includes("ไฟแนนซ์") || t.includes("ไฟแนนท์")) return "ไฟแนนท์";
        if (t.includes("ส่ง")) return "ขายส่ง";
        if (t.includes("ปลีก") || t.includes("เงินสด") || t.includes("สด")) return "ขายสด";
        return t || "-";
      })();
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${r.branch || "-"}</td>
          <td>${((r.branch_code || (r.sale_invoice_no || "").slice(0, 5) || "-")).toUpperCase()}</td>
          <td>${r.tax_invoice_no || "-"}</td>
          <td>${fmtDate(r.invoice_date || r.tax_invoice_date)}</td>
          <td>${r.customer_name || r.sale_customer_name || "-"}</td>
          <td>${r.model_name || "-"}</td>
          <td>${typeTxt}</td>
          <td>${r.sale_finance_company || "-"}</td>
          <td class="r${mismatch ? " mismatch" : ""}">${fmt(sa)}</td>
          <td>${r.is_booking ? "📌 " : ""}${r.price_date ? fmtDate(r.price_date) : "-"}</td>
          <td class="r${mismatch ? " mismatch" : ""}">${r.is_booking ? "📌 " : ""}${sp > 0 ? fmt(sp) : "-"}</td>
          <td class="r" style="color:#ea580c">${s.delivery_fee > 0 ? fmt(s.delivery_fee) : "-"}</td>
          <td class="r">${s.cash > 0 ? fmt(s.cash) : "-"}</td>
          <td class="r">${s.transfer > 0 ? fmt(s.transfer) : "-"}</td>
          <td class="r">${s.deposit > 0 ? fmt(s.deposit) : "-"}</td>
          <td class="r">${s.cheque > 0 ? fmt(s.cheque) : "-"}</td>
          <td class="r">${s.credit_note > 0 ? fmt(s.credit_note) : "-"}</td>
          <td class="r">${s.coupon > 0 ? fmt(s.coupon) : "-"}</td>
          <td>${r.announced_date ? fmtDate(r.announced_date) : "-"}</td>
          <td class="r">${r.announced_amount ? fmt(r.announced_amount) : "-"}</td>
          <td class="r">${s.ft > 0 ? fmt(s.ft) : "-"}</td>
          <td class="r" style="font-weight:700;background:#fef9c3">${fmt(s.total)}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายงานการขายตามการชำระเงิน</title>
      <style>
        @page { size: A3 landscape; margin: 10mm; }
        body { font-family: "Tahoma", sans-serif; font-size: 10px; margin: 0; padding: 10px; }
        h2 { text-align: center; margin: 0 0 4px; }
        .header { text-align: center; margin-bottom: 10px; font-size: 11px; color: #444; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        th, td { border: 1px solid #999; padding: 3px 4px; text-align: left; vertical-align: top; }
        th { background: #072d6b; color: #fff; font-weight: 700; }
        .r { text-align: right; font-family: monospace; }
        .mismatch { background: #fee2e2; color: #b91c1c; font-weight: 700; }
        tfoot td { background: #fde68a; font-weight: 700; }
        .summary { margin: 8px 0; display: flex; gap: 14px; flex-wrap: wrap; font-size: 11px; }
        .summary span { padding: 4px 10px; background: #f3f4f6; border-radius: 4px; }
      </style></head><body>
      <h2>💳 รายงานการขายตามการชำระเงิน</h2>
      <div class="header">ระหว่างวันที่ ${dfDisp} ถึง ${dtDisp} · ${branchTxt}${methodTxt} · พิมพ์เมื่อ ${dateStr}</div>
      <div class="summary">
        <span>📋 ใบขาย: <strong>${filtered.length}</strong></span>
        <span>💰 ยอดขายรวม: <strong>${fmt(totals.sale_total)}</strong></span>
        <span>💵 เงินสด: <strong>${fmt(totals.cash)}</strong></span>
        <span>💳 เงินโอน: <strong>${fmt(totals.transfer)}</strong></span>
        <span>🪙 มัดจำ: <strong>${fmt(totals.deposit)}</strong></span>
        <span>📝 เช็ค: <strong>${fmt(totals.cheque)}</strong></span>
        <span>🛡️ ประกัน: <strong>${fmt(totals.credit_note)}</strong></span>
        <span>💸 ดาวน์/งวด: <strong>${fmt(totals.coupon)}</strong></span>
        <span>🏦 ตัดรับ FT: <strong>${fmt(totals.ft)}</strong></span>
        <span>✅ รวมรับชำระ: <strong>${fmt(totals.total)}</strong></span>
        ${mismatchCount > 0 ? `<span style="background:#fee2e2;color:#b91c1c">⚠️ ราคาไม่ตรง: <strong>${mismatchCount}/${filtered.length}</strong></span>` : ""}
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>สังกัด</th><th>รหัสสาขา</th><th>เลขใบกำกับ</th><th>วันที่ใบกำกับ</th><th>ลูกค้า</th><th>รุ่น</th>
          <th>ประเภท</th><th>ไฟแนนท์</th><th class="r">ยอดขาย</th><th>วันประกาศราคา</th><th class="r">ราคาประกาศ</th>
          <th class="r">ค่านำพา</th>
          <th class="r">เงินสด</th><th class="r">เงินโอน</th><th class="r">มัดจำ</th><th class="r">เช็ค</th>
          <th class="r">ประกันออกแทน</th><th class="r">ดาวน์/งวดออกแทน</th>
          <th>วันประกาศดาวน์</th><th class="r">ยอดประกาศดาวน์</th>
          <th class="r">ตัดรับ FT</th><th class="r">รวม</th>
        </tr></thead>
        <tbody>${rows_html}</tbody>
        <tfoot><tr>
          <td colspan="9" style="text-align:right">รวม ${filtered.length} ใบ</td>
          <td class="r">${fmt(totals.sale_total)}</td>
          <td></td><td></td>
          <td class="r" style="color:#ea580c">${fmt(totals.delivery_fee)}</td>
          <td class="r">${fmt(totals.cash)}</td>
          <td class="r">${fmt(totals.transfer)}</td>
          <td class="r">${fmt(totals.deposit)}</td>
          <td class="r">${fmt(totals.cheque)}</td>
          <td class="r">${fmt(totals.credit_note)}</td>
          <td class="r">${fmt(totals.coupon)}</td>
          <td></td><td></td>
          <td class="r">${fmt(totals.ft)}</td>
          <td class="r">${fmt(totals.total)}</td>
        </tr></tfoot>
      </table>
      <script>window.onload = () => { window.print(); };</script>
      </body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html); w.document.close();
  }

  function exportCSV() {
    const headers = ["#", "สังกัด", "รหัสสาขา", "เลขใบกำกับ", "วันที่ตามใบกำกับ", "ลูกค้า", "เลขถัง", "รุ่น", "ประเภทการขาย", "ชื่อไฟแนนท์", "ยอดขาย", "ราคาขายประกาศ", "ค่านำพา", "เงินสด", "เงินโอน", "มัดจำ", "เช็ค", "ประกันรถหายออกแทน", "เงินดาวน์/ค่างวดออกแทน", "ตัดรับ FT", "รวมรับชำระ"];
    const lines = filtered.map((r, i) => {
      const s = sumByMethod(r);
      const branchCode = (r.branch_code || (r.sale_invoice_no || "").slice(0, 5) || "").toUpperCase();
      return [i + 1, r.branch || "", branchCode, r.tax_invoice_no || "", r.invoice_date || r.tax_invoice_date || "", r.customer_name || "", r.chassis_no || "", r.model_name || "", r.sale_invoice_type || "", r.sale_finance_company || "", r.total_amount || 0, r.sale_price || 0, s.delivery_fee, s.cash, s.transfer, s.deposit, s.cheque, s.credit_note, s.coupon, s.ft, s.total];
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
        <button onClick={printReport} style={{ ...btnBlue, background: "#7c3aed" }}>🖨️ พิมพ์รายงาน</button>
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
        {mismatchCount > 0 && <Card label="⚠️ ราคาไม่ตรงประกาศ" value={`${mismatchCount}/${filtered.length}`} color="#b91c1c" />}
        <Card label="🚚 ค่านำพา" value={fmt(totals.delivery_fee)} color="#ea580c" active={methodFilter.delivery_fee} onClick={() => setMethodFilter(m => ({ ...m, delivery_fee: !m.delivery_fee }))} />
        <Card label="💵 เงินสด" value={fmt(totals.cash)} color="#059669" active={methodFilter.cash} onClick={() => setMethodFilter(m => ({ ...m, cash: !m.cash }))} />
        <Card label="💳 เงินโอน" value={fmt(totals.transfer)} color="#0369a1" active={methodFilter.transfer} onClick={() => setMethodFilter(m => ({ ...m, transfer: !m.transfer }))} />
        <Card label="🪙 มัดจำ" value={fmt(totals.deposit)} color="#7c3aed" active={methodFilter.deposit} onClick={() => setMethodFilter(m => ({ ...m, deposit: !m.deposit }))} />
        <Card label="📝 เช็ค" value={fmt(totals.cheque)} color="#dc2626" active={methodFilter.cheque} onClick={() => setMethodFilter(m => ({ ...m, cheque: !m.cheque }))} />
        <Card label="🛡️ ประกันออกแทน" value={fmt(totals.credit_note)} color="#92400e" active={methodFilter.credit_note} onClick={() => setMethodFilter(m => ({ ...m, credit_note: !m.credit_note }))} />
        <Card label="💸 ดาวน์/งวดออกแทน" value={fmt(totals.coupon)} color="#9d174d" active={methodFilter.coupon} onClick={() => setMethodFilter(m => ({ ...m, coupon: !m.coupon }))} />
        <Card label="🏦 ตัดรับ FT" value={fmt(totals.ft)} color="#0891b2" active={methodFilter.ft} onClick={() => setMethodFilter(m => ({ ...m, ft: !m.ft }))} />
        <Card label="✅ รวมรับชำระ" value={fmt(totals.total)} color="#059669" highlight />
      </div>

      {/* Column visibility: ถ้าเลือก method ใดๆ → แสดงเฉพาะ method นั้น */}
      {(() => {
        const hasFilter = activeMethods.length > 0;
        const show = {
          delivery_fee: !hasFilter || methodFilter.delivery_fee,
          cash: !hasFilter || methodFilter.cash,
          transfer: !hasFilter || methodFilter.transfer,
          deposit: !hasFilter || methodFilter.deposit,
          cheque: !hasFilter || methodFilter.cheque,
          credit_note: !hasFilter || methodFilter.credit_note,
          coupon: !hasFilter || methodFilter.coupon,
          ft: !hasFilter || methodFilter.ft,
          announced: !hasFilter || methodFilter.coupon,  // วันที่ประกาศ/ยอดประกาศ ขึ้นคู่กับ coupon
        };
        return (
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>#</th>
              <th style={th}>สังกัด</th>
              <th style={th}>รหัสสาขา</th>
              <th style={th}>เลขใบกำกับ</th>
              <th style={th}>วันที่</th>
              <th style={th}>ลูกค้า</th>
              <th style={th}>เลขถัง</th>
              <th style={th}>รุ่น</th>
              <th style={{ ...th, textAlign: "center" }}>ประเภทการขาย</th>
              <th style={th}>ชื่อไฟแนนท์</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดขาย</th>
              <th style={{ ...th, background: "#0d9488" }}>วันที่ประกาศราคา</th>
              <th style={{ ...th, textAlign: "right", background: "#0d9488" }}>ราคาขาย</th>
              {show.delivery_fee && <th style={{ ...th, textAlign: "right", background: "#ea580c" }}>ค่านำพา</th>}
              <th style={{ ...th, textAlign: "right", background: "#10b981" }}>รายการบวกเพิ่ม</th>
              {show.credit_note && <th style={{ ...th, textAlign: "right", background: "#a16207" }}>ประกันออกแทน</th>}
              {show.coupon && <th style={{ ...th, textAlign: "right", background: "#be185d" }}>ดาวน์/งวดออกแทน</th>}
              {show.announced && <th style={{ ...th, background: "#f59e0b" }}>วันที่ประกาศ</th>}
              {show.announced && <th style={{ ...th, textAlign: "right", background: "#f59e0b" }}>ยอดเงินประกาศ</th>}
              <th style={{ ...th, textAlign: "right", background: "#fef9c3", color: "#072d6b" }}>รวม</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={24} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={24} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
            {filtered.map((r, i) => {
              const s = sumByMethod(r);
              return (
                <tr key={r.tax_invoice_no || i} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{r.branch || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#3730a3" }}>{(r.branch_code || (r.sale_invoice_no || "").slice(0, 5) || "-").toUpperCase()}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.tax_invoice_no || "-"}</td>
                  <td style={td}>{fmtDate(r.invoice_date || r.tax_invoice_date)}</td>
                  <td style={td}>{r.customer_name || r.sale_customer_name || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                  <td style={td}>{r.model_name || "-"}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {(() => {
                      const t = r.sale_invoice_type || "";
                      if (t.includes("ไฟแนนซ์") || t.includes("ไฟแนนท์")) return <span style={{ padding: "2px 8px", background: "#dbeafe", color: "#1e40af", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>💳 ไฟแนนท์</span>;
                      if (t.includes("ส่ง")) return <span style={{ padding: "2px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>📦 ขายส่ง</span>;
                      if (t.includes("ปลีก") || t.includes("เงินสด") || t.includes("สด")) return <span style={{ padding: "2px 8px", background: "#d1fae5", color: "#065f46", borderRadius: 8, fontSize: 11, fontWeight: 600 }}>💵 ขายสด</span>;
                      return <span style={{ color: "#9ca3af", fontSize: 11 }}>{t || "-"}</span>;
                    })()}
                  </td>
                  <td style={{ ...td, fontSize: 11, color: r.sale_finance_company ? "#0369a1" : "#9ca3af" }}>{r.sale_finance_company || "-"}</td>
                  {(() => {
                    const sa = Number(r.total_amount || 0);
                    const sp = Number(r.sale_price || 0);
                    const mk = markupTotal(r);
                    const mismatch = sp > 0 && Math.abs(sa - (sp + mk)) > 0.01;
                    return (
                      <>
                        <td style={{ ...tdNum, background: mismatch ? "#fee2e2" : undefined, color: mismatch ? "#b91c1c" : "inherit", fontWeight: mismatch ? 700 : "inherit" }} title={mismatch ? `ยอดขายไม่ตรง (ราคา ${fmt(sp)} + บวกเพิ่ม ${fmt(mk)} = ${fmt(sp + mk)} ต่างกับยอด ${fmt(sa)} = ${fmt(sa - sp - mk)})` : ""}>
                          {fmt(r.total_amount)}{mismatch && " ⚠️"}
                        </td>
                        <td style={{ ...td, fontSize: 11, color: "#0d9488" }} title={r.is_booking ? `รถจอง (จองวันที่ ${fmtDate(r.booking_date)})` : ""}>
                          {r.is_booking && <span style={{ marginRight: 4 }}>📌</span>}
                          {r.price_date ? fmtDate(r.price_date) : "-"}
                        </td>
                        <td style={{ ...tdNum, background: mismatch ? "#fee2e2" : undefined, color: mismatch ? "#b91c1c" : "#0d9488", fontWeight: 700 }} title={r.is_booking ? `รถจอง (จองวันที่ ${fmtDate(r.booking_date)})` : ""}>
                          {r.is_booking && <span style={{ marginRight: 4 }}>📌</span>}
                          {r.sale_price ? fmt(r.sale_price) : "-"}{mismatch && " ⚠️"}
                        </td>
                      </>
                    );
                  })()}
                  {show.delivery_fee && <td style={{ ...tdNum, color: "#ea580c", fontWeight: s.delivery_fee > 0 ? 600 : "inherit" }}>{s.delivery_fee > 0 ? fmt(s.delivery_fee) : "-"}</td>}
                  {(() => {
                    const ms = getMarkups(r);
                    const total = ms.reduce((s, m) => s + Number(m.markup_amount || 0), 0);
                    const tipText = ms.map(m =>
                      `${m.markup_type === "finance" ? m.finance_company
                        : m.markup_type === "finance_cc" ? `${m.finance_company} (${m.cc_min}-${m.cc_max || "∞"}cc)`
                        : m.markup_type === "custom" ? `${m.brand || ""} ${m.model_code || "ทุกรุ่น"}`.trim()
                        : m.markup_type === "installment_bonus" ? `ค่างวด ${m.sale_invoice_no}`
                        : m.markup_type === "cosmos_insurance" ? `COSMOS ${m.sale_invoice_no}${m.policy_no ? ` (${m.policy_no})` : ""}`
                        : "-"}: +${fmt(m.markup_amount)}`
                    ).join("\n");
                    return (
                      <td style={{ ...tdNum, color: "#065f46", fontWeight: total > 0 ? 700 : "inherit" }} title={tipText || ""}>
                        {total > 0 ? `+${fmt(total)}` : "-"}
                      </td>
                    );
                  })()}
                  {show.credit_note && <td style={tdNum}>{s.credit_note > 0 ? fmt(s.credit_note) : "-"}</td>}
                  {show.coupon && <td style={tdNum}>{s.coupon > 0 ? fmt(s.coupon) : "-"}</td>}
                  {show.announced && <td style={{ ...td, fontSize: 11, color: "#92400e" }}>{r.announced_date ? fmtDate(r.announced_date) : "-"}</td>}
                  {show.announced && <td style={{ ...tdNum, color: "#92400e", fontWeight: 600 }}>{r.announced_amount ? fmt(r.announced_amount) : "-"}</td>}
                  <td style={{ ...tdNum, fontWeight: 700, background: "#fef9c3" }}>{fmt(s.total)}</td>
                </tr>
              );
            })}
            {filtered.length > 0 && (
              <tr style={{ background: "#fde68a", fontWeight: 700 }}>
                <td colSpan={10} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} ใบ</td>
                <td style={tdNum}>{fmt(totals.sale_total)}</td>
                <td></td>
                <td></td>
                {show.delivery_fee && <td style={{ ...tdNum, color: "#ea580c" }}>{fmt(totals.delivery_fee)}</td>}
                <td style={{ ...tdNum, color: "#065f46", fontWeight: 700 }}>
                  {(() => {
                    const totalMarkup = filtered.reduce((sum, r) => sum + getMarkups(r).reduce((s, m) => s + Number(m.markup_amount || 0), 0), 0);
                    return totalMarkup > 0 ? `+${fmt(totalMarkup)}` : "-";
                  })()}
                </td>
                {show.credit_note && <td style={tdNum}>{fmt(totals.credit_note)}</td>}
                {show.coupon && <td style={tdNum}>{fmt(totals.coupon)}</td>}
                {show.announced && <td></td>}
                {show.announced && <td></td>}
                <td style={tdNum}>{fmt(totals.total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        );
      })()}
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
