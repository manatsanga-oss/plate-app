import React, { useEffect, useMemo, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/list-tax-invoices";

const BRANCH_OPTS = [
  { value: "PAPAO", label: "ป.เปา" },
  { value: "NAKORNLUANG", label: "นครหลวง" },
  { value: "SINGCHAI", label: "สิงห์ชัย" },
];

function fmtN(n) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

// ถ้า branch_code เป็น 00000 / ว่าง → ดึงจาก prefix ของเลขใบขาย (เช่น SCY01-... → SCY01)
function deriveBranchCode(branchCode, saleInvoiceNo) {
  const bc = String(branchCode || "").trim();
  if (bc && bc !== "00000") return bc;
  const inv = String(saleInvoiceNo || "");
  const m = inv.match(/^([A-Z]+\d+)-/);
  return m ? m[1] : (bc || "-");
}

function fmtDate(s) {
  if (!s) return "-";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${(parseInt(m[1], 10) + 543).toString().slice(-2)}`;
}

const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function fmtMonthYearTH(s) {
  if (!s) return "-";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})/);
  if (!m) return s;
  const monIdx = parseInt(m[2], 10) - 1;
  const yBE = parseInt(m[1], 10) + 543;
  return `${TH_MONTHS[monIdx] || m[2]} ${yBE}`;
}

function paidYearMonth(d) {
  if (!d) return "ยังไม่ได้รับชำระ";
  return String(d).slice(0, 7); // YYYY-MM
}

// ใช้วันรับเงินจริงจาก daily_receipts (last_receipt_date) ก่อน — ถ้าไม่มี ใช้ paid_at
function pickPaidDate(r) {
  return r.last_receipt_date || r.paid_at || null;
}

// คืนรายการประเภทรับชำระที่มียอด > 0 จาก payment_methods
function activePaymentTypes(pm) {
  if (!pm || typeof pm !== "object") return [];
  const labels = {
    cash: "เงินสด", transfer: "เงินโอน", cheque: "เช็ค", deposit: "เงินมัดจำ",
    credit_card: "บัตรเครดิต", wht: "หักภาษี ณ ที่จ่าย", qr: "QR",
    credit_note: "ประกันรถหายออกแทน", coupon: "เงินดาวน์/ค่างวดออกแทน",
  };
  return Object.entries(pm)
    .filter(([, v]) => Number(v) > 0)
    .map(([k, v]) => ({ key: k, label: labels[k] || k, amount: Number(v) }));
}

export default function ReportAdminPage({ currentUser }) {
  const [branch, setBranch] = useState("PAPAO");
  const [yearMonth, setYearMonth] = useState("");
  const [financeFilter, setFinanceFilter] = useState("");
  const [branchCodeFilter, setBranchCodeFilter] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("");
  const [paidYmFilter, setPaidYmFilter] = useState(""); // YYYY-MM (CE)
  const [groupBy, setGroupBy] = useState("month"); // month | finance | branchcode | none
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [detailFinance, setDetailFinance] = useState(null); // { row, sources } popup

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
          // ไม่ส่ง year_month เพื่อโหลดข้อมูลทั้งหมด แล้วค่อย filter ตาม "เดือนรับชำระ" บนหน้า
          status: "active",
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

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [branch]);

  // Flatten: 1 ใบกำกับ → N rows (1 ต่อประเภทรับชำระ)
  const flatRows = useMemo(() => {
    const out = [];
    rows.forEach(r => {
      // ข้ามใบกำกับที่ยกเลิก
      if (r.status === "cancelled") return;
      if (typeof r.customer_name === "string" && r.customer_name.includes("ยกเลิก")) return;

      const paidDate = pickPaidDate(r);
      const types = activePaymentTypes(r.payment_methods);
      // ถ้าไม่มีไฟแนนท์ ถือว่าเป็น "ขายเงินสด"
      const finance = (r.sale_finance_company && String(r.sale_finance_company).trim() && r.sale_finance_company !== "-")
        ? r.sale_finance_company
        : "ขายเงินสด";

      if (types.length === 0) {
        out.push({
          tax_invoice_no: r.tax_invoice_no,
          sale_invoice_no: r.sale_invoice_no,
          customer_name: r.sale_customer_name || r.customer_name,
          invoice_date: r.invoice_date,
          finance_company: finance,
          paid_at: paidDate,
          paid_ym: paidYearMonth(paidDate),
          branch_codes: deriveBranchCode(r.branch_codes, r.sale_invoice_no),
          payment_type: "ยังไม่ได้รับชำระ",
          payment_amount: 0,
          total_amount: r.total_amount,
          accounts: null,
        });
        return;
      }
      types.forEach(t => {
        // ถ้าเป็นเงินโอนและมีหลายบัญชี → แยกเป็นหลาย row (ประเภท = "เงินโอน + เลขบัญชี")
        if (t.key === "transfer" && Array.isArray(r.transfer_accounts) && r.transfer_accounts.length > 0) {
          r.transfer_accounts.forEach(a => {
            out.push({
              tax_invoice_no: r.tax_invoice_no,
              sale_invoice_no: r.sale_invoice_no,
              customer_name: r.sale_customer_name || r.customer_name,
              invoice_date: r.invoice_date,                  // ← เพิ่มที่หายไป
              finance_company: finance,
              paid_at: paidDate,
              paid_ym: paidYearMonth(paidDate),
              branch_codes: deriveBranchCode(r.branch_codes, r.sale_invoice_no),
              payment_type: `เงินโอน ${a.account_no || ""}`.trim(),
              payment_type_key: `transfer_${a.account_no || "?"}`,
              payment_amount: Number(a.amount || 0),
              total_amount: r.total_amount,
              accounts: [a],
            });
          });
          return;
        }

        out.push({
          tax_invoice_no: r.tax_invoice_no,
          sale_invoice_no: r.sale_invoice_no,
          customer_name: r.sale_customer_name || r.customer_name,
          invoice_date: r.invoice_date,
          finance_company: finance,
          paid_at: paidDate,
          paid_ym: paidYearMonth(paidDate),
          branch_codes: deriveBranchCode(r.branch_codes, r.sale_invoice_no),
          payment_type: t.label,
          payment_type_key: t.key,
          payment_amount: t.amount,
          total_amount: r.total_amount,
          accounts: null,
        });
      });
    });
    return out;
  }, [rows]);

  // Filter
  const filtered = useMemo(() => {
    return flatRows.filter(r =>
      (!financeFilter || r.finance_company === financeFilter) &&
      (!branchCodeFilter || (r.branch_codes || "").includes(branchCodeFilter)) &&
      (!paymentTypeFilter || r.payment_type === paymentTypeFilter) &&
      (!paidYmFilter || r.paid_ym === paidYmFilter)
    );
  }, [flatRows, financeFilter, branchCodeFilter, paymentTypeFilter, paidYmFilter]);

  // เดือนรับชำระ (YYYY-MM CE) → label "เม.ย. 2569"
  const paidYmOpts = useMemo(() => {
    const s = new Set();
    flatRows.forEach(r => { if (r.paid_ym && r.paid_ym !== "ยังไม่ได้รับชำระ") s.add(r.paid_ym); });
    return [...s].sort().reverse().map(ym => {
      const [y, m] = ym.split("-");
      const monIdx = parseInt(m, 10) - 1;
      return { value: ym, label: `${TH_MONTHS[monIdx] || m} ${parseInt(y, 10) + 543}` };
    });
  }, [flatRows]);

  // เดือนใบกำกับ (BE YYYYMM e.g. "256904") → label "เม.ย. 2569"
  const invoiceYmOpts = useMemo(() => {
    const s = new Set();
    rows.forEach(r => { if (r.invoice_year_month) s.add(r.invoice_year_month); });
    return [...s].sort().reverse().map(ym => {
      // BE format: YYYYMM e.g. "256904"
      const yBE = ym.slice(0, 4);
      const m = ym.slice(4, 6);
      const monIdx = parseInt(m, 10) - 1;
      return { value: ym, label: `${TH_MONTHS[monIdx] || m} ${yBE}` };
    });
  }, [rows]);

  // Filter options
  const financeOpts = useMemo(() => [...new Set(flatRows.map(r => r.finance_company).filter(x => x && x !== "-"))].sort(), [flatRows]);
  const branchCodeOpts = useMemo(() => {
    const s = new Set();
    flatRows.forEach(r => String(r.branch_codes || "").split(",").map(x => x.trim()).filter(x => x && x !== "-").forEach(x => s.add(x)));
    return [...s].sort();
  }, [flatRows]);
  const paymentTypeOpts = useMemo(() => [...new Set(flatRows.map(r => r.payment_type))].sort(), [flatRows]);

  // Group rows
  // เมื่อจัดกลุ่มตามเลขที่บัญชี → แยก row ที่มีหลายบัญชีออกเป็นหลาย row
  function expandByAccount(rs) {
    const out = [];
    rs.forEach(r => {
      if (Array.isArray(r.accounts) && r.accounts.length > 0) {
        r.accounts.forEach(a => {
          out.push({
            ...r,
            payment_amount: Number(a.amount || 0),
            accounts: [a],
            _account_key: a.account_no || "?",
            _account_bank: a.bank_name || "",
          });
        });
      } else {
        out.push({
          ...r,
          _account_key: "ไม่ใช่เงินโอน",
          _account_bank: "",
        });
      }
    });
    return out;
  }

  // Aggregate rows that share (finance + paid_ym + branch + payment_type) into one merged row
  function aggregateRows(rs) {
    if (groupBy === "none") return rs; // no aggregation in flat mode
    const m = new Map();
    rs.forEach(r => {
      // เดือนใบกำกับ (BE YYYYMM) — ใช้แยกแถวที่ใบกำกับคนละเดือน ไม่ให้รวมกัน
      const invoiceYm = r.invoice_date ? String(r.invoice_date).slice(0, 7) : "-";
      const key = [
        r.finance_company || "-",
        r.paid_ym || "-",
        invoiceYm,                  // ← เพิ่มเดือนใบกำกับเป็นส่วนหนึ่งของคีย์
        r.branch_codes || "-",
        r.payment_type_key || r.payment_type || "-",
        // ในโหมด account ต้องแยก aggregate ตามบัญชีด้วย
        groupBy === "account" ? (r._account_key || "-") : "",
      ].join("|");
      if (!m.has(key)) {
        m.set(key, {
          finance_company: r.finance_company,
          paid_at: r.paid_at,
          paid_ym: r.paid_ym,
          invoice_date: r.invoice_date, // วันที่ออกใบกำกับ (จะเก็บค่า MAX)
          branch_codes: r.branch_codes,
          payment_type: r.payment_type,
          payment_type_key: r.payment_type_key,
          payment_amount: 0,
          accounts: [],
          count: 0,
          source_rows: [], // ใบกำกับ + ใบขายที่อยู่ในกลุ่ม
        });
      }
      const a = m.get(key);
      a.payment_amount += Number(r.payment_amount || 0);
      a.count += 1;
      // pick most recent paid_at
      if (r.paid_at && (!a.paid_at || r.paid_at > a.paid_at)) a.paid_at = r.paid_at;
      // pick most recent invoice_date
      if (r.invoice_date && (!a.invoice_date || r.invoice_date > a.invoice_date)) a.invoice_date = r.invoice_date;
      // accumulate transfer accounts
      if (Array.isArray(r.accounts)) a.accounts.push(...r.accounts);
      // accumulate source rows (tax/sale invoice info)
      a.source_rows.push({
        tax_invoice_no: r.tax_invoice_no,
        sale_invoice_no: r.sale_invoice_no,
        customer_name: r.customer_name,
        invoice_date: r.invoice_date,
        paid_at: r.paid_at,
        amount: Number(r.payment_amount || 0),
      });
    });
    // collapse duplicate accounts by account_no, sum amounts
    return [...m.values()].map(a => {
      if (a.accounts && a.accounts.length > 0) {
        const am = new Map();
        a.accounts.forEach(x => {
          const k = x.account_no || "?";
          if (!am.has(k)) am.set(k, { ...x, amount: 0 });
          am.get(k).amount += Number(x.amount || 0);
        });
        a.accounts = [...am.values()].sort((x, y) => y.amount - x.amount);
      } else {
        a.accounts = null;
      }
      // de-dup source_rows by tax_invoice_no (1 ใบกำกับ อาจมีหลาย payment type ที่ split เป็นหลาย row)
      const seen = new Map();
      a.source_rows.forEach(s => {
        const k = s.tax_invoice_no || `${s.sale_invoice_no}|${s.customer_name}`;
        if (!seen.has(k)) seen.set(k, s);
      });
      a.source_rows = [...seen.values()].sort((x, y) => (x.tax_invoice_no || "") < (y.tax_invoice_no || "") ? 1 : -1);
      return a;
    });
  }

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "ทั้งหมด", rows: filtered }];
    // ในโหมด account ต้อง expand row ที่มีหลายบัญชีก่อน
    const baseRows = groupBy === "account" ? expandByAccount(filtered) : filtered;
    const map = new Map();
    const keyFn = r => {
      if (groupBy === "month") return r.paid_ym;
      if (groupBy === "finance") return r.finance_company;
      if (groupBy === "branchcode") return r.branch_codes || "-";
      if (groupBy === "account") {
        const acc = r._account_key || "ไม่ใช่เงินโอน";
        const bank = r._account_bank;
        return bank ? `${acc} | ${bank}` : acc;
      }
      return "ทั้งหมด";
    };
    baseRows.forEach(r => {
      const k = keyFn(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return [...map.entries()].sort((a, b) => (a[0] > b[0] ? -1 : 1)).map(([key, rs]) => {
      const aggr = aggregateRows(rs);
      // เรียงในแต่ละกลุ่ม: ตามชื่อไฟแนนท์ → สังกัด → ประเภทรับชำระ → เดือนใบกำกับ
      aggr.sort((x, y) => {
        const f = String(x.finance_company || "").localeCompare(String(y.finance_company || ""), "th");
        if (f !== 0) return f;
        const b = String(x.branch_codes || "").localeCompare(String(y.branch_codes || ""), "th");
        if (b !== 0) return b;
        const p = String(x.payment_type || "").localeCompare(String(y.payment_type || ""), "th");
        if (p !== 0) return p;
        return String(y.invoice_date || "").localeCompare(String(x.invoice_date || "")); // เดือนใหม่ขึ้นก่อน
      });
      return { key, rows: aggr };
    });
  }, [filtered, groupBy]);

  const totalAmount = filtered.reduce((s, r) => s + Number(r.payment_amount || 0), 0);
  const branchOpt = BRANCH_OPTS.find(b => b.value === branch);

  return (
    <div className="page-container">
      <style>{`
        @media print {
          .no-print, .no-print * { display: none !important; }
          .sidebar, aside.sidebar, .page-topbar { display: none !important; }
          body, html, #root, .page-container { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .data-table { font-size: 11px !important; width: 100% !important; }
          .data-table th, .data-table td { padding: 4px 6px !important; }
          .data-table th { background: #072d6b !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>

      <div className="page-topbar">
        <div className="page-title">📊 รายงานสรุปขายรถบันทึก FLOW ACC</div>
      </div>

      {/* Filters */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={lbl}>🏢 สาขา</label>
            <select value={branch} onChange={e => setBranch(e.target.value)} style={{ ...inp, minWidth: 140 }}>
              {BRANCH_OPTS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>📅 เดือนรับชำระ</label>
            <select value={paidYmFilter} onChange={e => setPaidYmFilter(e.target.value)} style={{ ...inp, minWidth: 130 }}>
              <option value="">ทั้งหมด</option>
              {paidYmOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>🏷️ สังกัด</label>
            <select value={branchCodeFilter} onChange={e => setBranchCodeFilter(e.target.value)} style={{ ...inp, minWidth: 110 }}>
              <option value="">ทั้งหมด</option>
              {branchCodeOpts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>💳 ประเภทรับชำระ</label>
            <select value={paymentTypeFilter} onChange={e => setPaymentTypeFilter(e.target.value)} style={{ ...inp, minWidth: 130 }}>
              <option value="">ทั้งหมด</option>
              {paymentTypeOpts.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>📂 จัดกลุ่มตาม</label>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={{ ...inp, minWidth: 140 }}>
              <option value="month">เดือนรับชำระ</option>
              <option value="finance">ไฟแนนท์</option>
              <option value="branchcode">สังกัด</option>
              <option value="account">เลขที่บัญชี</option>
              <option value="none">ไม่จัดกลุ่ม</option>
            </select>
          </div>
          <div>
            <button onClick={fetchData} disabled={loading}
              style={{ padding: "8px 16px", background: loading ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
              🔄 {loading ? "โหลด..." : "Refresh"}
            </button>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button onClick={() => window.print()}
              style={{ padding: "8px 14px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
              🖨️ พิมพ์
            </button>
          </div>
        </div>
        {message && <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12 }}>{message}</div>}
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        <SummaryCard color="#dbeafe" textColor="#1e40af" label="จำนวนรายการ" value={filtered.length} suffix="รายการ" raw />
        <SummaryCard color="#dcfce7" textColor="#065f46" label="ยอดรับชำระรวม" value={totalAmount} />
        <SummaryCard color="#fef3c7" textColor="#92400e" label={`สาขา`} value={branchOpt?.label || branch} raw text />
      </div>

      {/* Table — grouped */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#6b7280" }}>กำลังโหลด...</div>
        ) : grouped.length === 0 || filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>ไม่มีข้อมูล</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  {groupBy === "none" && <th>เลขที่ใบกำกับ</th>}
                  {groupBy === "none" && <th>เลขที่ใบขาย</th>}
                  {groupBy === "none" && <th>ลูกค้า</th>}
                  <th>ไฟแนนท์</th>
                  <th>เดือนใบกำกับ</th>
                  <th>สังกัด</th>
                  <th>ประเภทรับชำระ</th>
                  <th style={{ textAlign: "right" }}>ยอด</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(g => {
                  const subtotal = g.rows.reduce((s, r) => s + Number(r.payment_amount || 0), 0);
                  return (
                    <React.Fragment key={g.key}>
                      <tr style={{ background: "#eff6ff" }}>
                        <td colSpan={groupBy === "none" ? 9 : 6} style={{ padding: "6px 10px", fontWeight: 700, color: "#1e40af" }}>
                          📂 {groupByLabel(groupBy)}: <span style={{ color: "#072d6b", fontFamily: groupBy === "account" ? "monospace" : undefined }}>{groupBy === "month" ? ymToBE(g.key) : g.key}</span>
                          <span style={{ marginLeft: 14, fontSize: 12, color: "#6b7280" }}>
                            ({g.rows.length} รายการ · ยอด {fmtN(subtotal)})
                          </span>
                        </td>
                      </tr>
                      {g.rows.map((r, i) => (
                        <tr key={`${r.finance_company}-${r.paid_ym}-${r.branch_codes}-${r.payment_type_key}-${i}`}>
                          <td style={{ textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                          {groupBy === "none" && <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{r.tax_invoice_no}</td>}
                          {groupBy === "none" && <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.sale_invoice_no || "-"}</td>}
                          {groupBy === "none" && <td>{r.customer_name || "-"}</td>}
                          <td style={{ textAlign: "left" }}>
                            {groupBy !== "none" && r.source_rows && r.source_rows.length > 0 ? (
                              <button
                                onClick={() => setDetailFinance(r)}
                                title="คลิกดูรายการใบกำกับ/ใบขาย"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#0369a1",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  padding: 0,
                                  fontFamily: "inherit",
                                  fontSize: "inherit",
                                  textDecoration: "underline",
                                  textAlign: "left",
                                }}
                              >
                                {r.finance_company}
                              </button>
                            ) : (
                              <span>{r.finance_company}</span>
                            )}
                            {groupBy !== "none" && r.count > 1 && <span style={{ marginLeft: 6, fontSize: 10, color: "#6b7280" }}>({r.count} ใบ)</span>}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>{fmtMonthYearTH(r.invoice_date)}</td>
                          <td><span style={{ padding: "2px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 4, fontSize: 11 }}>{r.branch_codes}</span></td>
                          <td style={{ whiteSpace: "nowrap" }}><span style={{ padding: "2px 8px", background: pmColor(r.payment_type_key), color: "#fff", borderRadius: 4, fontSize: 11, whiteSpace: "nowrap", display: "inline-block" }}>{r.payment_type}</span></td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{r.payment_amount > 0 ? fmtN(r.payment_amount) : "-"}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                  <td colSpan={groupBy === "none" ? 8 : 5} style={{ textAlign: "right" }}>รวมทั้งสิ้น</td>
                  <td style={{ textAlign: "right", color: "#072d6b" }}>{fmtN(totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Popup: รายละเอียดใบกำกับ/ใบขาย เมื่อคลิกชื่อไฟแนนท์ */}
      {detailFinance && (
        <div
          onClick={() => setDetailFinance(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 12, padding: 18, width: "min(900px, 96vw)",
              maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#072d6b" }}>
                  📋 รายการใบกำกับ — {detailFinance.finance_company}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  {ymToBE(detailFinance.paid_ym)} · สังกัด {detailFinance.branch_codes} ·
                  <span style={{ marginLeft: 6, padding: "1px 8px", background: pmColor(detailFinance.payment_type_key), color: "#fff", borderRadius: 4, fontSize: 11 }}>
                    {detailFinance.payment_type}
                  </span>
                  <span style={{ marginLeft: 8, fontWeight: 600, color: "#15803d" }}>
                    ยอดรวม {fmtN(detailFinance.payment_amount)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDetailFinance(null)}
                style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}
              >×</button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#072d6b", color: "#fff" }}>
                    <th style={{ padding: "8px 10px", textAlign: "center", width: 40 }}>#</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>เลขที่ใบกำกับ</th>
                    <th style={{ padding: "8px 10px", textAlign: "center" }}>วันที่ออกใบกำกับ</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>เลขที่ใบขาย</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>ลูกค้า</th>
                    <th style={{ padding: "8px 10px", textAlign: "center" }}>วันรับชำระ</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>ยอด</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailFinance.source_rows || []).map((s, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "6px 10px", textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{s.tax_invoice_no || "-"}</td>
                      <td style={{ padding: "6px 10px", textAlign: "center", whiteSpace: "nowrap" }}>{fmtDate(s.invoice_date)}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", fontSize: 11, color: "#0369a1" }}>{s.sale_invoice_no || "-"}</td>
                      <td style={{ padding: "6px 10px" }}>{s.customer_name || "-"}</td>
                      <td style={{ padding: "6px 10px", textAlign: "center", whiteSpace: "nowrap" }}>{fmtDate(s.paid_at)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>{s.amount > 0 ? fmtN(s.amount) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                    <td colSpan={6} style={{ padding: "8px 10px", textAlign: "right" }}>รวม {detailFinance.source_rows?.length || 0} ใบ</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#072d6b" }}>{fmtN(detailFinance.payment_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function groupByLabel(g) {
  return { month: "เดือนรับชำระ", finance: "ไฟแนนท์", branchcode: "สังกัด", account: "เลขที่บัญชี" }[g] || "";
}

function ymToBE(ym) {
  if (!ym || ym === "ยังไม่ได้รับชำระ") return ym;
  const [y, m] = String(ym).split("-");
  if (!y || !m) return ym;
  return `${m}/${parseInt(y, 10) + 543}`;
}

function pmColor(key) {
  if (typeof key === "string" && key.startsWith("transfer_")) return "#0ea5e9";
  return {
    cash: "#10b981", transfer: "#0ea5e9", cheque: "#8b5cf6",
    credit_card: "#f59e0b", deposit: "#6366f1", qr: "#06b6d4",
    wht: "#ef4444", credit_note: "#a855f7", coupon: "#84cc16",
  }[key] || "#6b7280";
}

function SummaryCard({ color, textColor, label, value, suffix, raw, text }) {
  return (
    <div style={{ padding: "12px 16px", background: color, borderRadius: 10 }}>
      <div style={{ fontSize: 12, color: textColor, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: text ? 18 : 22, color: textColor, fontWeight: 700, marginTop: 4 }}>
        {raw && !text ? Number(value).toLocaleString("th-TH") : raw && text ? value : fmtN(value)}
        {suffix && <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 6 }}>{suffix}</span>}
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 3 };
const inp = { padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
