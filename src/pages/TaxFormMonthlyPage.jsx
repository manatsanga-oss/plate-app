import React, { useEffect, useMemo, useState } from "react";
import TaxRemittanceRecordPage from "./TaxRemittanceRecordPage";

// เตรียมแบบภาษีรายเดือน — ตารางบันทึกแบบภาษีต่อรอบเดือน (list) + กด "สร้างใหม่"/"แก้ไข" เข้าหน้าเลือกใบกำกับ (form)
// ภาษีซื้อ: ดึงจาก input-tax-api (list_input_tax); บันทึก record: actions list_tax_filings / save_tax_filing / delete_tax_filing
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/input-tax-api";
// คอลัมน์มูลค่าภาษีซื้อใน list: โชว์ยอดตาม "รายงานภาษีซื้อ ตาม FLOW ACC" (flow_input_tax_reports รายรอบ+สังกัด)
const FLOW_TAX_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/flow-input-tax-api";
// ปุ่มชำระเงิน: บันทึกจ่าย ภ.พ.30 ลง tax_remittances (mode ระบุยอดตรง amount_total เหมือนค่าแนะนำ)
// หมายเหตุ: ภาษีซื้อ ภ.พ.36 รวมอยู่ในรายงานภาษีซื้อ FLOW (ภ.พ.30) แล้ว — ไม่หักซ้ำ/ไม่แสดงแยกใน popup
const TAXREMIT_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/tax-remittance-api";
// บัญชีธนาคาร (จ่ายแบบโอน)
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

const SOURCE_META = {
  vehicle: { label: "รถ", color: "#1e40af", bg: "#dbeafe" },
  part: { label: "อะไหล่", color: "#92400e", bg: "#fef3c7" },
  expense: { label: "ค่าใช้จ่าย", color: "#065f46", bg: "#d1fae5" },
  fuel: { label: "ค่าน้ำมัน", color: "#9a3412", bg: "#ffedd5" },
  theft: { label: "ประกันรถหาย", color: "#9d174d", bg: "#fce7f3" },
};
const NO_INVOICE_STATUS = "ยังไม่ได้รับใบกำกับภาษี";
const RECEIVED_STATUS = "รับใบกำกับภาษีแล้ว";
const STATUS_STYLE = {
  [RECEIVED_STATUS]: { bg: "#dbeafe", color: "#1e40af" },
  [NO_INVOICE_STATUS]: { bg: "#ffedd5", color: "#9a3412" },
};
const AFFILIATIONS = ["ป.เปา", "สิงห์ชัย"];
const TAX_FORMS = ["ภ.พ.30", "ภ.พ.36"];
const FILING_TYPES = ["ยื่นปกติ", "ยื่นเพิ่มเติม"];
const FILING_STATUSES = ["ร่าง", "รอชำระ", "ชำระภาษีแล้ว"];
const FSTATUS_STYLE = {
  "ร่าง": { bg: "#f3f4f6", color: "#6b7280" },
  "รอชำระ": { bg: "#fef3c7", color: "#92400e" },
  "ชำระภาษีแล้ว": { bg: "#dcfce7", color: "#166534" },
};

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}
function curMonth() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; }
function monthDisplay(ym) { if (!ym) return "-"; const [y, m] = String(ym).split("-"); return `${m}-${y}`; }
function validityHint(docDateISO, filingYM) {
  const d = new Date(docDateISO);
  if (isNaN(d) || !filingYM) return null;
  const docIdx = d.getFullYear() * 12 + d.getMonth();
  const [fy, fm] = filingYM.split("-").map(Number);
  const filingIdx = fy * 12 + (fm - 1);
  if (filingIdx <= docIdx) return null;
  const validUntil = docIdx + 6;
  if (filingIdx > validUntil) return { t: "หมดอายุแล้ว", c: "#dc2626" };
  const vy = Math.floor(validUntil / 12), vm = (validUntil % 12) + 1;
  return { t: `ใช้ภายใน ${String(vm).padStart(2, "0")}-${vy}`, c: "#b45309" };
}
function parseKeys(v) { if (Array.isArray(v)) return v; if (typeof v === "string") { try { return JSON.parse(v || "[]"); } catch { return []; } } return []; }

export default function TaxFormMonthlyPage({ currentUser }) {
  const [mode, setMode] = useState("list"); // list | form
  // ---- list ----
  const [records, setRecords] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [tab, setTab] = useState("all"); // all | ภ.พ.30 | ภ.พ.36
  const [filterAff, setFilterAff] = useState(""); // ตัวกรองสังกัด (list)
  const [recMsg, setRecMsg] = useState("");
  const [flowVatMap, setFlowVatMap] = useState({}); // { "สังกัด|YYYY-MM": { base, vat } } จากรายงานภาษีซื้อ FLOW ACC
  const [detailRow, setDetailRow] = useState(null); // แถวที่กดดูรายละเอียด (popup)
  // ---- ชำระเงิน ----
  const [payRow, setPayRow] = useState(null);       // แถวที่กำลังบันทึกชำระเงิน
  const [payForm, setPayForm] = useState({ remit_date: "", payment_method: "โอน", from_bank_account_id: "", receipt_no: "", note: "", amountStr: "" });
  const [paySaving, setPaySaving] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  // ---- form ----
  const [editingId, setEditingId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(curMonth());
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [affiliation, setAffiliation] = useState("ป.เปา"); // สังกัดของแบบภาษี (form)
  const [selected, setSelected] = useState({});
  const [pendingKeys, setPendingKeys] = useState(null); // คีย์ที่จะ restore หลังโหลด (ตอนแก้ไข)
  const [salesVatStr, setSalesVatStr] = useState("0");
  const [taxForm, setTaxForm] = useState("ภ.พ.30");
  const [filingType, setFilingType] = useState("ยื่นปกติ");
  const [paymentDate, setPaymentDate] = useState("");
  const [status, setStatus] = useState("ร่าง");
  const [formMsg, setFormMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (mode === "list") { fetchRecords(); fetchFlowVat(); } /* eslint-disable-next-line */ }, [mode]);
  useEffect(() => { if (mode === "form" && month) fetchInvoices(); /* eslint-disable-next-line */ }, [month, mode]);

  // ================= LIST =================
  async function fetchRecords() {
    setRecLoading(true); setRecMsg("");
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_tax_filings" }) });
      const data = await res.json();
      setRecords((Array.isArray(data) ? data : (data?.rows || [])).filter(r => r && r.id));
    } catch (e) { setRecords([]); setRecMsg("❌ โหลดรายการไม่สำเร็จ: " + e.message); }
    setRecLoading(false);
  }
  // ยอดภาษีซื้อตามรายงาน FLOW ACC (list_periods ให้ sum_base/sum_vat ราย สังกัด+รอบ อยู่แล้ว)
  async function fetchFlowVat() {
    try {
      const res = await fetch(FLOW_TAX_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_periods" }) });
      const raw = await res.text();
      const data = raw.trim() ? JSON.parse(raw) : [];
      const map = {};
      (Array.isArray(data) ? data : (data?.rows || [])).forEach(p => {
        if (p && p.tax_period) map[`${p.affiliation || ""}|${p.tax_period}`] = { base: Number(p.sum_base || 0), vat: Number(p.sum_vat || 0) };
      });
      setFlowVatMap(map);
    } catch { setFlowVatMap({}); }
  }
  // ภาษีที่ต้องชำระของแบบ (ตาม popup): ภาษีขาย − ภาษีซื้อ FLOW ภ.พ.30 − ยกมา (ภ.พ.36 รวมใน FLOW แล้ว ไม่หักซ้ำ)
  function payableOf(r) {
    const flow = flowVatMap[`${r.affiliation || ""}|${r.filing_month || ""}`];
    const vat30 = flow ? flow.vat : Number(r.purchase_vat || 0);
    const carry = carryMapOf(records)[r.id] || 0;
    return Math.round((Number(r.sales_vat || 0) - vat30 - carry) * 100) / 100;
  }

  // ---- ชำระเงิน (บันทึกจ่าย ภ.พ.30 → tax_remittances + อัปเดตสถานะแบบ) ----
  async function openPay(r) {
    setDetailRow(null);
    const net = payableOf(r);
    setPayForm({
      remit_date: new Date().toISOString().slice(0, 10),
      payment_method: "โอน", from_bank_account_id: "", receipt_no: "", note: "",
      amountStr: net > 0 ? String(net) : "0",
    });
    setPayRow(r);
    if (bankAccounts.length === 0) {
      try {
        const res = await fetch(ACC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }) });
        const raw = await res.text();
        const data = raw.trim() ? JSON.parse(raw) : [];
        setBankAccounts((Array.isArray(data) ? data : (data?.rows || [])).filter(a => a && a.account_id));
      } catch { setBankAccounts([]); }
    }
  }
  async function savePayment() {
    if (!payRow) return;
    const amount = Number(payForm.amountStr) || 0;
    // ไม่มีภาษีต้องชำระ (ขอคืน/ยกไป) → บันทึกปิดแบบอย่างเดียว ไม่สร้างใบจ่ายสรรพากร
    const recordOnly = amount <= 0;
    if (!recordOnly && payForm.payment_method === "โอน" && !payForm.from_bank_account_id) { setRecMsg("⚠️ เลือกบัญชีที่จ่ายก่อน"); return; }
    if (payRow.status === "ชำระภาษีแล้ว" && !window.confirm("แบบนี้สถานะ \"ชำระภาษีแล้ว\" อยู่แล้ว — ยืนยันบันทึกอีกครั้ง? (ระวังบันทึกซ้ำ)")) return;
    setPaySaving(true); setRecMsg("");
    try {
      let doc = "";
      if (!recordOnly) {
        // 1) บันทึกจ่ายลง tax_remittances (แบบระบุยอดตรง)
        const res = await fetch(TAXREMIT_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_tax_remittance", tax_type: payRow.tax_form || "ภ.พ.30",
            period_month: String(payRow.filing_month || "").replace("-", ""),
            affiliation: payRow.affiliation,
            remit_date: payForm.remit_date,
            payment_method: payForm.payment_method,
            from_bank_account_id: payForm.payment_method === "โอน" ? (Number(payForm.from_bank_account_id) || null) : null,
            receipt_no: payForm.receipt_no, note: payForm.note || `ชำระ ${payRow.tax_form || "ภ.พ.30"} งวด ${monthDisplay(payRow.filing_month)}`,
            amount_total: amount, source_ids: [],
            created_by: currentUser?.username || "system",
          }),
        });
        const raw = await res.text();
        const data = raw.trim() ? JSON.parse(raw) : {};
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.error || row?.error_msg) throw new Error(row.error || row.error_msg);
        doc = row?.remit_doc_no || "";
      }
      // 2) อัปเดตแบบภาษี: วันที่ชำระ + สถานะชำระแล้ว (ส่ง affiliation ครบ กัน field หาย)
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_tax_filing", id: payRow.id, filing_month: payRow.filing_month, affiliation: payRow.affiliation,
          tax_form: payRow.tax_form, filing_type: payRow.filing_type, payment_date: payForm.remit_date,
          sales_vat: payRow.sales_vat, purchase_vat: payRow.purchase_vat, payable: payRow.payable,
          status: "ชำระภาษีแล้ว", selected_keys: parseKeys(payRow.selected_keys), note: payRow.note,
        }),
      });
      setRecMsg(recordOnly
        ? "✅ บันทึกแบบเรียบร้อย — ไม่มีภาษีต้องชำระ (ขอคืน/ยกไปงวดถัดไป)"
        : `✅ บันทึกชำระภาษีเรียบร้อย${doc ? " " + doc : ""} (ดูประวัติได้ในเมนูบันทึกจ่ายภาษีสรรพากร)`);
      setPayRow(null); fetchRecords(); fetchFlowVat();
    } catch (e) { setRecMsg("❌ บันทึกชำระไม่สำเร็จ: " + e.message); }
    setPaySaving(false);
  }
  // ภาษีซื้อยกมา: ไล่คำนวณต่อเนื่องรายเดือนต่อสังกัด — เดือนไหนขอคืน (net ติดลบ) ยกไปเดือนถัดไป
  function carryMapOf(recs) {
    const map = {};   // { record.id: carryIn }
    AFFILIATIONS.forEach(aff => {
      const list = recs
        .filter(r => (r.tax_form || "ภ.พ.30") === "ภ.พ.30" && String(r.affiliation || "") === aff && r.filing_month)
        .sort((a, b) => String(a.filing_month).localeCompare(String(b.filing_month)));
      let carry = 0, prevMonth = null;
      list.forEach(r => {
        // ถ้าเดือนไม่ต่อเนื่อง (ขาดช่วง) ไม่ยกยอดข้ามช่วงให้ — เริ่มนับใหม่
        if (prevMonth) {
          const [py, pm] = prevMonth.split("-").map(Number);
          const next = `${pm === 12 ? py + 1 : py}-${String(pm === 12 ? 1 : pm + 1).padStart(2, "0")}`;
          if (next !== r.filing_month) carry = 0;
        }
        map[r.id] = carry;
        const flow = flowVatMap[`${r.affiliation || ""}|${r.filing_month}`];
        const vat30 = flow ? flow.vat : Number(r.purchase_vat || 0);
        const net = Number(r.sales_vat || 0) - vat30 - carry;
        carry = net < 0 ? -net : 0;
        prevMonth = r.filing_month;
      });
    });
    return map;
  }
  function openCreate() {
    setEditingId(null); setMonth(curMonth()); setSalesVatStr("0"); setSelected({}); setPendingKeys(null);
    setTaxForm("ภ.พ.30"); setFilingType("ยื่นปกติ"); setPaymentDate(""); setStatus("ร่าง"); setFormMsg("");
    setAffiliation(filterAff || "ป.เปา");
    setMode("form");
  }
  function openEdit(r) {
    setEditingId(r.id); setAffiliation(r.affiliation || "ป.เปา"); setTaxForm(r.tax_form || "ภ.พ.30"); setFilingType(r.filing_type || "ยื่นปกติ");
    setPaymentDate(r.payment_date ? String(r.payment_date).slice(0, 10) : ""); setStatus(r.status || "ร่าง");
    setSalesVatStr(String(Number(r.sales_vat) || 0)); setSelected({}); setPendingKeys(parseKeys(r.selected_keys));
    setFormMsg(""); setMonth(r.filing_month || curMonth()); setMode("form");
  }
  async function deleteRecord(r) {
    if (!window.confirm(`ลบแบบภาษีรอบ ${monthDisplay(r.filing_month)} (${r.tax_form})?`)) return;
    try {
      await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_tax_filing", id: r.id }) });
      setRecMsg("✅ ลบแล้ว"); fetchRecords();
    } catch (e) { setRecMsg("❌ ลบไม่สำเร็จ: " + e.message); }
  }

  // ================= FORM (invoices) =================
  async function fetchInvoices() {
    setLoading(true); setFormMsg("");
    try {
      const ym = month ? month.replace("-", "") : null;
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_input_tax", year_month: ym }) });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : (data?.rows || []));
    } catch (e) { setRows([]); setFormMsg("❌ โหลดใบกำกับไม่สำเร็จ: " + e.message); }
    setLoading(false);
  }

  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((r, i) => {
      const gk = `${r.source}|${r.affiliation || ""}|${r.doc_no || ("row" + i)}`;
      let g = map.get(gk);
      if (!g) { g = { key: gk, source: r.source, affiliation: r.affiliation, doc_date: r.doc_date, doc_no: r.doc_no, vendor_name: r.vendor_name, amount_before_vat: 0, vat_amount: 0, count: 0 }; map.set(gk, g); }
      g.amount_before_vat += Number(r.amount_before_vat) || 0;
      g.vat_amount += Number(r.vat_amount) || 0;
      g.count += 1;
    });
    return [...map.values()];
  }, [rows]);

  const statusOf = (g) => (Number(g.amount_before_vat || 0) === 0 ? NO_INVOICE_STATUS : RECEIVED_STATUS);
  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return groups.filter(g => {
      if (statusOf(g) === NO_INVOICE_STATUS) return false;
      if (affiliation && String(g.affiliation || "") !== affiliation) return false; // เฉพาะสังกัดของแบบภาษี
      if (filterSource && g.source !== filterSource) return false;
      if (!kw) return true;
      return [g.doc_no, g.vendor_name].filter(Boolean).join(" ").toLowerCase().includes(kw);
    });
    /* eslint-disable-next-line */
  }, [groups, search, filterSource, affiliation]);

  // restore selection ตอนแก้ไข (หลัง groups พร้อม)
  useEffect(() => {
    if (pendingKeys && groups.length) {
      const set = new Set(pendingKeys);
      const next = {};
      groups.forEach(g => { if (set.has(g.key)) next[g.key] = true; });
      setSelected(next); setPendingKeys(null);
    }
  }, [groups, pendingKeys]);

  const selectedGroups = filtered.filter(g => selected[g.key]);
  const selVat = selectedGroups.reduce((s, g) => s + Number(g.vat_amount || 0), 0);
  const selBase = selectedGroups.reduce((s, g) => s + Number(g.amount_before_vat || 0), 0);
  const salesVat = Number(salesVatStr) || 0;
  const payable = salesVat - selVat;
  const allSelected = filtered.length > 0 && filtered.every(g => selected[g.key]);
  function toggleAll() { if (allSelected) setSelected({}); else { const n = {}; filtered.forEach(g => n[g.key] = true); setSelected(n); } }
  function toggle(key) { setSelected(p => ({ ...p, [key]: !p[key] })); }

  async function saveFiling() {
    setSaving(true); setFormMsg("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_tax_filing", id: editingId || undefined,
          filing_month: month, affiliation, tax_form: taxForm, filing_type: filingType, payment_date: paymentDate || null,
          sales_vat: salesVat, purchase_vat: selVat, payable, status,
          selected_keys: selectedGroups.map(g => g.key),
        }),
      });
      const d = await res.json().catch(() => ({}));
      const ok = Array.isArray(d) ? d[0] : (d?.rows ? d.rows[0] : d);
      if (ok?.error) throw new Error(ok.error);
      setMode("list");
    } catch (e) { setFormMsg("❌ บันทึกไม่สำเร็จ: " + e.message); }
    setSaving(false);
  }

  // ================= RENDER: LIST =================
  if (mode === "list") {
    const recs = records.filter(r => (tab === "all" || r.tax_form === tab) && (!filterAff || String(r.affiliation || "") === filterAff));
    return (
      <div className="page-container">
        <div className="page-topbar" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="page-title" style={{ margin: 0 }}>📄 เตรียมแบบภาษีรายเดือน</h2>
          <div style={{ flex: 1 }} />
          {tab !== "ภ.พ.36" && <button onClick={openCreate} style={{ ...btn, background: "#16a34a" }}>➕ สร้างใหม่</button>}
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          {[["all", "แสดงทั้งหมด"], ["ภ.พ.30", "ภ.พ.30"], ["ภ.พ.36", "ภ.พ.36"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ ...chip, background: tab === k ? "#2563eb" : "#e5e7eb", color: tab === k ? "#fff" : "#374151" }}>{l}</button>
          ))}
          <div style={{ flex: 1 }} />
          {tab !== "ภ.พ.36" && <>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>🏢 สังกัด:</label>
            <select value={filterAff} onChange={e => setFilterAff(e.target.value)} style={inp}>
              <option value="">ทั้งหมด</option>
              {AFFILIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </>}
        </div>
        {recMsg && <div style={{ padding: "8px 12px", marginBottom: 10, borderRadius: 8, fontSize: 13, background: recMsg.startsWith("✅") ? "#f0fdf4" : "#fef2f2", color: recMsg.startsWith("✅") ? "#166534" : "#991b1b" }}>{recMsg}</div>}

        {tab === "ภ.พ.36" ? (
          <TaxRemittanceRecordPage currentUser={currentUser} lockTaxType="ภ.พ.36" />
        ) : (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#2563eb", color: "#fff" }}>
              <tr>
                <th style={th}>วันที่ชำระภาษี</th>
                <th style={th}>สังกัด</th>
                <th style={th}>เดือนที่ยื่นแบบภาษี</th>
                <th style={th}>แบบฟอร์มภาษี</th>
                <th style={{ ...th, textAlign: "right" }}>มูลค่าภาษีขาย</th>
                <th style={{ ...th, textAlign: "right" }}>มูลค่าภาษีซื้อ</th>
                <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
                <th style={{ ...th, width: 90, textAlign: "center" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {recLoading ? (
                <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
              ) : recs.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีแบบภาษี — กด "สร้างใหม่"</td></tr>
              ) : recs.map(r => {
                const flow = flowVatMap[`${r.affiliation || ""}|${r.filing_month || ""}`];
                return (
                  <tr key={r.id} onClick={() => setDetailRow(r)} title="กดเพื่อดูข้อมูลการยื่นแบบภาษี"
                    style={{ borderTop: "1px solid #e5e7eb", cursor: "pointer" }}>
                    <td style={td}>
                      {r.payment_date ? fmtDate(r.payment_date)
                        : <span style={{ color: "#9ca3af" }}>ยังไม่กำหนดวันที่ชำระ</span>}
                    </td>
                    <td style={td}>{r.affiliation || "-"}</td>
                    <td style={td}><b>{monthDisplay(r.filing_month)}</b> <span style={{ color: "#6b7280" }}>({r.filing_type || "ยื่นปกติ"})</span></td>
                    <td style={td}>{r.tax_form || "ภ.พ.30"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.sales_vat)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>
                      {flow === undefined ? fmt(r.purchase_vat) : (<>
                        {fmt(flow.vat)}
                        <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "Tahoma" }}>ตามรายงาน FLOW ACC</div>
                      </>)}
                    </td>
                    <td style={{ ...td, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                      {/* สถานะเปลี่ยนอัตโนมัติทางเดียวผ่านปุ่มชำระเงิน — ห้ามแก้เอง */}
                      <span style={{ display: "inline-block", padding: "5px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                        background: r.status === "ชำระภาษีแล้ว" ? "#dcfce7" : "#fef3c7",
                        color: r.status === "ชำระภาษีแล้ว" ? "#166534" : "#92400e" }}>
                        {r.status === "ชำระภาษีแล้ว" ? "ชำระภาษีแล้ว" : "รอชำระภาษี"}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => openPay(r)} title="ชำระเงิน"
                        style={{ ...miniBtn, background: "#dcfce7", color: "#166534" }}>💵</button>
                      <button onClick={() => openEdit(r)} style={{ ...miniBtn, background: "#dbeafe", color: "#1e40af" }}>✏️</button>
                      <button onClick={() => deleteRecord(r)} style={{ ...miniBtn, background: "#fee2e2", color: "#b91c1c" }}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* Popup ข้อมูลการยื่นแบบภาษีรายเดือน */}
        {detailRow && (() => {
          const r = detailRow;
          const key = `${r.affiliation || ""}|${r.filing_month || ""}`;
          const flow = flowVatMap[key];
          const vat30 = flow ? flow.vat : Number(r.purchase_vat || 0);
          const carry = carryMapOf(records)[r.id] || 0;
          const net = Number(r.sales_vat || 0) - vat30 - carry;
          // ยอดขายในเดือนนี้ — บันทึกไว้ใน note ตอนกด "บันทึกเข้าเตรียมแบบ" จากรายงานภาษีขาย
          const mBase = String(r.note || "").match(/มูลค่า\s*([\d,]+(?:\.\d+)?)/);
          const salesBase = mBase ? Number(mBase[1].replace(/,/g, "")) : null;
          const [fy, fm] = String(r.filing_month || "").split("-").map(Number);
          const TH_FULL = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
          const line = (label, value, opts = {}) => (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 14px", fontSize: 13.5, ...(opts.style || {}) }}>
              <span style={{ fontWeight: opts.bold ? 700 : 600, color: opts.color || "#111827" }}>{label}</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: opts.color || "#111827" }}>{value}</span>
            </div>
          );
          const divider = <div style={{ borderTop: "1px solid #e5e7eb", margin: "4px 0" }} />;
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
              onClick={() => setDetailRow(null)}>
              <div style={{ background: "#fff", borderRadius: 12, width: 520, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}
                onClick={e => e.stopPropagation()}>
                <div style={{ padding: "16px 18px 10px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#0284c7", fontSize: 19 }}>ข้อมูลการยื่นแบบภาษีรายเดือน</h3>
                      <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 3 }}>
                        แบบยื่นภาษีเดือน{TH_FULL[(fm || 1) - 1]} {fy || ""} ({r.filing_type || "ยื่นปกติ"}) · {r.affiliation || "-"} · {r.tax_form || "ภ.พ.30"}
                      </div>
                    </div>
                    <button onClick={() => setDetailRow(null)}
                      style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", fontSize: 22, color: "#9ca3af" }}>✕</button>
                  </div>
                </div>
                <div style={{ margin: "0 18px 14px", border: "1px solid #e5e7eb", borderRadius: 10, padding: "6px 0", background: "#fafafa" }}>
                  {line("ยอดขายในเดือนนี้", salesBase !== null ? fmt(salesBase) : "-")}
                  {line("ภาษีขายตามรายงานภาษีขาย", fmt(r.sales_vat))}
                  {divider}
                  {line("ยอดซื้อที่ใช้สิทธิในเดือนนี้", flow ? fmt(flow.base) : "-")}
                  {line("ภาษีซื้อตามรายงานภาษีซื้อ ภ.พ.30", fmt(vat30))}
                  {divider}
                  {line("ภาษีซื้อที่ยกมา", fmt(carry))}
                  {divider}
                  {line("ภาษีที่ต้องชำระ", fmt(net > 0 ? net : 0), { color: net > 0 ? "#dc2626" : undefined })}
                  {line("ภาษีที่ต้องขอคืน", fmt(net < 0 ? -net : 0), { color: net < 0 ? "#16a34a" : undefined })}
                  {divider}
                  {line("วันที่ชำระภาษี:", r.payment_date ? fmtDate(r.payment_date) : "ยังไม่กำหนดวันที่ชำระ")}
                </div>
                <div style={{ padding: "0 18px 16px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => openPay(r)} style={{ ...btn, background: "#16a34a" }}>💵 ชำระเงิน</button>
                  <button onClick={() => setDetailRow(null)} style={{ ...btn, background: "#0284c7" }}>ปิด</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Dialog ชำระเงิน */}
        {payRow && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}
            onClick={() => !paySaving && setPayRow(null)}>
            <div style={{ background: "#fff", borderRadius: 12, width: 440, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.25)", padding: "18px 20px" }}
              onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: "0 0 4px", color: "#166534" }}>💵 ชำระภาษี {payRow.tax_form || "ภ.พ.30"}</h3>
              <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 12 }}>
                งวด <b>{monthDisplay(payRow.filing_month)}</b> · {payRow.affiliation || "-"} · ภาษีที่ต้องชำระตามแบบ <b style={{ fontFamily: "monospace" }}>{fmt(payableOf(payRow) > 0 ? payableOf(payRow) : 0)}</b> บาท
              </div>
              {(() => {
                const recordOnly = (Number(payForm.amountStr) || 0) <= 0;
                return (<>
              {recordOnly && (
                <div style={{ padding: "8px 12px", marginBottom: 10, borderRadius: 8, background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", fontSize: 13, fontWeight: 600 }}>
                  ✅ ไม่มีภาษีที่ต้องชำระ (ขอคืน/ยกไปงวดถัดไป) — กดบันทึกเพื่อปิดแบบอย่างเดียว ไม่บันทึกการจ่ายเงิน
                </div>
              )}
              <div style={{ display: "grid", gap: 10 }}>
                <div><label style={lbl}>ยอดชำระ (บาท)</label>
                  <input type="number" step="0.01" min="0" value={payForm.amountStr}
                    onChange={e => setPayForm(p => ({ ...p, amountStr: e.target.value }))}
                    style={{ ...inp, width: "100%", textAlign: "right", fontWeight: 700, fontSize: 16 }} /></div>
                <div><label style={lbl}>{recordOnly ? "วันที่บันทึก/ยื่นแบบ *" : "วันที่ชำระ *"}</label>
                  <input type="date" value={payForm.remit_date}
                    onChange={e => setPayForm(p => ({ ...p, remit_date: e.target.value }))} style={{ ...inp, width: "100%" }} /></div>
                {!recordOnly && (<>
                <div><label style={lbl}>วิธีชำระ</label>
                  <select value={payForm.payment_method}
                    onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))} style={{ ...inp, width: "100%" }}>
                    <option value="โอน">โอน</option>
                    <option value="เงินสด">เงินสด</option>
                  </select></div>
                {payForm.payment_method === "โอน" && (
                  <div><label style={lbl}>จ่ายจากบัญชี *</label>
                    <select value={payForm.from_bank_account_id}
                      onChange={e => setPayForm(p => ({ ...p, from_bank_account_id: e.target.value }))} style={{ ...inp, width: "100%" }}>
                      <option value="">— เลือกบัญชี —</option>
                      {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
                    </select></div>
                )}
                <div><label style={lbl}>เลขที่ใบเสร็จสรรพากร (ถ้ามี)</label>
                  <input type="text" value={payForm.receipt_no}
                    onChange={e => setPayForm(p => ({ ...p, receipt_no: e.target.value }))} style={{ ...inp, width: "100%" }} /></div>
                </>)}
                <div><label style={lbl}>หมายเหตุ</label>
                  <input type="text" value={payForm.note}
                    onChange={e => setPayForm(p => ({ ...p, note: e.target.value }))} style={{ ...inp, width: "100%" }} /></div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button onClick={() => setPayRow(null)} disabled={paySaving}
                  style={{ ...btn, background: "#e5e7eb", color: "#374151" }}>ยกเลิก</button>
                <button onClick={savePayment} disabled={paySaving}
                  style={{ ...btn, background: paySaving ? "#9ca3af" : "#16a34a" }}>
                  {paySaving ? "💾 กำลังบันทึก..." : recordOnly ? "💾 บันทึก (ไม่มียอดชำระ)" : "💾 บันทึกชำระเงิน"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 10 }}>
                {recordOnly
                  ? "สถานะแบบจะเปลี่ยนเป็น \"ชำระภาษีแล้ว\" โดยไม่สร้างรายการจ่ายเงิน (ยอดขอคืนยกไปหักงวดถัดไปอัตโนมัติ)"
                  : "บันทึกจ่ายจะเข้าเมนู \"บริหารภาษี → ภาษีหัก ณ ที่จ่าย/จ่ายสรรพากร\" (ยกเลิกได้จากประวัติที่นั่น) และสถานะแบบจะเปลี่ยนเป็น \"ชำระภาษีแล้ว\""}
              </div>
                </>);
              })()}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= RENDER: FORM =================
  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>📄 {editingId ? "แก้ไขแบบยื่น" : "เตรียมแบบยื่น"} {taxForm}</h2>
        <div style={{ flex: 1 }} />
        <button onClick={() => setMode("list")} style={{ ...btn, background: "#e5e7eb", color: "#374151" }}>✕ ปิด</button>
        <button onClick={saveFiling} disabled={saving} style={{ ...btn, background: saving ? "#9ca3af" : "#16a34a" }}>{saving ? "💾 ..." : "💾 บันทึก"}</button>
      </div>

      {/* หัวฟอร์ม */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 12 }}>
        <div><label style={lbl}>📅 รอบเดือนที่ยื่น</label><input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inp} /></div>
        <div><label style={lbl}>🏢 สังกัด</label><select value={affiliation} onChange={e => setAffiliation(e.target.value)} style={inp}>{AFFILIATIONS.map(a => <option key={a}>{a}</option>)}</select></div>
        <div><label style={lbl}>แบบฟอร์มภาษี</label><select value={taxForm} onChange={e => setTaxForm(e.target.value)} style={inp}>{TAX_FORMS.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label style={lbl}>ประเภทยื่น</label><select value={filingType} onChange={e => setFilingType(e.target.value)} style={inp}>{FILING_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label style={lbl}>วันที่ชำระภาษี</label><input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} style={inp} /></div>
        {/* สถานะไม่ให้แก้เอง — เปลี่ยนอัตโนมัติผ่านปุ่มชำระเงินในหน้า list เท่านั้น */}
        <div style={{ flex: 1 }} />
        <div style={kpi}><div style={kpiLbl}>มูลค่าภาษีขาย</div><input type="number" value={salesVatStr} onChange={e => setSalesVatStr(e.target.value)} style={{ ...inp, width: 120, textAlign: "right", fontWeight: 700 }} /></div>
        <div style={kpi}><div style={kpiLbl}>ภาษีซื้อที่เลือก <b>{selectedGroups.length}</b></div><div style={{ ...kpiVal, color: "#1d4ed8" }}>{fmt(selVat)}</div></div>
        <div style={kpi}><div style={kpiLbl}>{payable >= 0 ? "ภาษีที่ต้องชำระ" : "ขอคืน/ยกไป"}</div><div style={{ ...kpiVal, color: payable >= 0 ? "#dc2626" : "#16a34a" }}>{fmt(Math.abs(payable))}</div></div>
      </div>

      {/* ตัวกรองใบกำกับ */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={inp}>
          <option value="">📂 ประเภท: ทั้งหมด</option>
          {Object.entries(SOURCE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔎 เลขที่ / ผู้จำหน่าย" style={{ ...inp, flex: 1, minWidth: 200 }} />
        <button onClick={fetchInvoices} disabled={loading} style={{ ...btn, background: "#0369a1" }}>🔄 รีเฟรช</button>
      </div>
      {formMsg && <div style={{ padding: "8px 12px", marginBottom: 10, borderRadius: 8, fontSize: 13, background: "#fef2f2", color: "#991b1b" }}>{formMsg}</div>}

      {/* ตารางใบกำกับซื้อ */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#2563eb", color: "#fff" }}>
            <tr>
              <th style={{ ...th, width: 36, textAlign: "center" }}><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th style={th}>วันที่ใบกำกับภาษี</th>
              <th style={th}>เลขที่ใบกำกับภาษี</th>
              <th style={th}>ชื่อผู้จำหน่าย</th>
              <th style={{ ...th, textAlign: "right" }}>มูลค่า / ภาษีมูลค่าเพิ่ม</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีใบกำกับภาษีในรอบเดือนนี้</td></tr>
            ) : filtered.map(g => {
              const sm = SOURCE_META[g.source] || { label: g.source, color: "#374151", bg: "#e5e7eb" };
              const hint = validityHint(g.doc_date, month);
              const isSel = !!selected[g.key];
              return (
                <tr key={g.key} style={{ borderTop: "1px solid #e5e7eb", background: isSel ? "#eff6ff" : "transparent" }}>
                  <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={isSel} onChange={() => toggle(g.key)} /></td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(g.doc_date)}{hint && <div style={{ fontSize: 11, color: hint.c, fontWeight: 600 }}>{hint.t}</div>}</td>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sm.color, display: "inline-block" }} />
                      <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#1d4ed8" }}>{g.doc_no || "-"}</span>
                      {g.count > 1 && <span style={{ padding: "1px 7px", borderRadius: 10, background: "#eef2ff", color: "#4338ca", fontSize: 11, fontWeight: 700 }}>รวม {g.count}</span>}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{g.vendor_name || "-"}</div>
                    <div style={{ fontSize: 11 }}><span style={{ padding: "1px 6px", borderRadius: 4, background: sm.bg, color: sm.color, fontWeight: 600, marginRight: 6 }}>{sm.label}</span>{g.affiliation || ""}</div>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ fontFamily: "monospace", fontWeight: 600 }}>{fmt(g.amount_before_vat)}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>{fmt(g.vat_amount)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot style={{ background: "#f9fafb", fontWeight: 700 }}>
              <tr>
                <td style={td}></td>
                <td colSpan={2} style={{ ...td, textAlign: "right" }}>เลือก {selectedGroups.length}/{filtered.length} ใบ</td>
                <td style={{ ...td, textAlign: "right" }}>มูลค่า {fmt(selBase)}</td>
                <td style={{ ...td, textAlign: "right", color: "#1d4ed8", fontSize: 14 }}>VAT {fmt(selVat)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 };
const kpiLbl = { fontSize: 11, color: "#6b7280", marginBottom: 3 };
const kpiVal = { fontSize: 18, fontWeight: 800, textAlign: "right" };
const kpi = { minWidth: 110, padding: "4px 10px", borderLeft: "1px solid #e5e7eb" };
const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const btn = { color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, padding: "8px 16px", fontSize: 13 };
const chip = { border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, padding: "7px 16px", fontSize: 13 };
const miniBtn = { border: "none", borderRadius: 6, cursor: "pointer", padding: "4px 8px", fontSize: 13, margin: "0 2px" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 13, verticalAlign: "top" };
