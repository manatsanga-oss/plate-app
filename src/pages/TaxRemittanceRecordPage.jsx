import React, { useEffect, useState } from "react";

// บันทึกจ่ายเงินภาษีสรรพากร — นำรายการภาษี "รอจ่าย" มาแสดง แล้วบันทึกการนำส่ง + เก็บประวัติ
// ภ.พ.36: จากวิธีจ่ายในหน้า FLOW ACC → tax_remittances (tax-remittance-api)
// ภ.ง.ด. (หัก ณ ที่จ่าย) = รวมหน้าเดียว เลือกข้ามแบบแล้วจ่ายพร้อมกันได้:
//   • ภ.ง.ด.1 เงินเดือน (สรุปเดือน) — hr-api → จ่ายผ่าน expense_record (เจ้าหนี้ "สรรพากร")
//   • ภ.ง.ด.3/53 ค่าแนะนำ (สรุปเดือน) — referral-fee-api → tax_remittances (direct-amount)
//   • ภ.ง.ด.3/53 ค่าใช้จ่ายที่มีหัก ณ ที่จ่าย (รายเอกสาร) — accounting-api expense_record → tax_remittances (itemized)
//   • ภ.ง.ด.3/53 งานทะเบียน (วางบิล/จ่ายเงิน PAY ที่มีหัก ณ ที่จ่าย, รายใบ) — registrations-api → tax_remittances (itemized)
//   • ภ.ง.ด.3 ค่านายหน้า (ค่าคอมปกติ ที่มีหัก ณ ที่จ่าย, รายใบ) — sales-extra-pay-api → tax_remittances (itemized)
//   (ใช้เฉพาะตารางบันทึกค่าใช้จ่าย expense_documents — ไม่ดึงจาก FLOW ACC)
const TAX_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/tax-remittance-api";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const HR_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";
const REFERRAL_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/referral-fee-api";
const REG_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";
const SXP_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/sales-extra-pay-api";
const THEFT_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/upload-accounting-expense"; // ประกันรถหาย ออกแทน (52071)

const TAX_TYPES = [
  { value: "ภ.พ.36", label: "ภ.พ.36 (ภาษีมูลค่าเพิ่มรอนำส่ง)", ready: true },
  { value: "ภ.ง.ด.", label: "ภ.ง.ด. (ภาษีหัก ณ ที่จ่าย — เงินเดือน/ค่าแนะนำ/ค่าใช้จ่าย)", ready: true },
  { value: "ภ.พ.30", label: "ภ.พ.30 (ภาษีขาย−ซื้อ) — เร็ว ๆ นี้", ready: false },
];
const yymm = v => String(v || "").slice(0, 7);            // YYYY-MM
const periodOf = v => yymm(v).replace("-", "");           // YYYYMM
// จำแนก ภ.ง.ด.3 (บุคคลธรรมดา) vs ภ.ง.ด.53 (นิติบุคคล)
const JURISTIC_KW = ["บริษัท", "หจก", "ห้างหุ้นส่วน", "จำกัด", "บมจ", "co.", "ltd", "limited", " inc", "corp"];
const isJuristic = name => { const s = String(name || "").toLowerCase(); return JURISTIC_KW.some(k => s.includes(k)); };
const pndTypeOf = name => isJuristic(name) ? "ภ.ง.ด.53" : "ภ.ง.ด.3";
// ใช้เลขผู้เสียภาษี 13 หลักก่อน (นิติบุคคลขึ้นต้น 0) ไม่งั้น fallback ชื่อ
function pndTypeOfVendor(taxId, name) {
  const tid = String(taxId || "").replace(/[^0-9]/g, "");
  if (tid.length === 13) return tid[0] === "0" ? "ภ.ง.ด.53" : "ภ.ง.ด.3";
  return pndTypeOf(name);
}
// ค่านายหน้า (brokerage): สังกัด "ที่จ่าย" = เจ้าของแบรนด์ที่ขาย (ไม่ใช่สังกัดพนักงาน)
//   HONDA → ป.เปา (ดีลเลอร์ฮอนด้า) · YAMAHA → สิงห์ชัย (ดีลเลอร์ยามาฮ่า)
function payAffOfBrand(brand, fallback) {
  const b = String(brand || "");
  if (/ฮอน|honda/i.test(b)) return "ป.เปา";
  if (/ยามา|yamaha/i.test(b)) return "สิงห์ชัย";
  return fallback || "(ไม่ระบุสังกัด)";
}

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function fmtPeriod(ym) {
  const s = String(ym || "");
  if (s.length !== 6) return ym || "-";
  return `${s.slice(4, 6)}/${Number(s.slice(0, 4)) + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function TaxRemittanceRecordPage({ currentUser, lockTaxType }) {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterAff, setFilterAff] = useState("");
  const [filterForm, setFilterForm] = useState(""); // กรองตามแบบภาษี (ภ.ง.ด.1/3/53) — เฉพาะโหมด ภ.ง.ด.
  const [taxType, setTaxType] = useState(lockTaxType || "ภ.พ.36");
  const [tab, setTab] = useState("pending"); // pending | history
  const [selected, setSelected] = useState({});
  const [expanded, setExpanded] = useState({}); // กางดูรายละเอียดรายแถว (เช่น ภ.ง.ด.3 ค่าแนะนำ)
  const [payDialog, setPayDialog] = useState(false);
  const [payForm, setPayForm] = useState({ remit_date: todayISO(), payment_method: "โอน", from_bank_account_id: "", receipt_no: "", note: "" });
  const [saving, setSaving] = useState(false);

  const isWHT = taxType === "ภ.ง.ด.";           // โหมดรวมภาษีหัก ณ ที่จ่าย
  const whoami = () => currentUser?.username || currentUser?.name || "system";

  useEffect(() => { fetchBankAccounts(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    setSelected({});
    if (tab === "pending") fetchPending(); else fetchHistory();
    /* eslint-disable-next-line */
  }, [tab, taxType, filterAff, filterForm, dateFrom, dateTo]);

  function inRange(v) {
    const m = yymm(v);
    if (dateFrom && m < yymm(dateFrom)) return false;
    if (dateTo && m > yymm(dateTo)) return false;
    return true;
  }
  async function post(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json();
  }
  async function hr(body) { const d = await post(HR_URL, body); return Array.isArray(d) ? d : []; }

  async function fetchPending() {
    if (isWHT) return fetchPendingWHT();
    setLoading(true);
    try {
      const data = await post(TAX_URL, { action: "list_pending_tax", tax_type: taxType, date_from: dateFrom || undefined, date_to: dateTo || undefined, affiliation: filterAff || undefined });
      setPending(Array.isArray(data) ? data.filter(r => r && r.source_id) : []);
    } catch { setPending([]); }
    setLoading(false);
  }
  async function fetchHistory() {
    if (isWHT) return fetchHistoryWHT();
    setLoading(true);
    try {
      const data = await post(TAX_URL, { action: "list_tax_remittances", tax_type: taxType || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined, affiliation: filterAff || undefined });
      setHistory(Array.isArray(data) ? data.filter(r => r && r.remit_doc_no) : []);
    } catch { setHistory([]); }
    setLoading(false);
  }

  // ---------- ภ.ง.ด.1: เงินเดือน (สรุปเดือน × สังกัด) จาก hr-api ----------
  async function loadPayrollRows() {
    const [buckets, pays] = await Promise.all([
      hr({ action: "payroll_payables", mode: "list_by_affiliation" }),
      hr({ action: "payroll_payables", mode: "list_payments" }),
    ]);
    const paidSet = new Set(pays
      .filter(p => (p.payroll_creditor_type === "tax" || p.vendor_name === "สรรพากร") && p.status !== "cancelled")
      .map(p => `${yymm(p.month_year)}|${p.affiliation}`));
    return buckets
      .filter(b => Number(b.total_tax || 0) > 0)
      .filter(b => !paidSet.has(`${yymm(b.month_year)}|${b.affiliation}`))
      .map(b => ({
        source_id: `pnd1|${yymm(b.month_year)}|${b.affiliation}`,
        kind: "payroll", pndType: "ภ.ง.ด.1", sourceLabel: "เงินเดือน",
        save_group: b.save_group, affiliation: b.affiliation,
        paid_at: b.month_year, period_month: periodOf(b.month_year),
        amount: Number(b.total_tax || 0), vendor_name: "สรรพากร (เงินเดือน)",
        doc_refs: "ภ.ง.ด.1 ภาษีเงินเดือน",
      }));
  }
  // ---------- ภ.ง.ด.3/53: ค่าแนะนำ (สรุปเดือน × สังกัด × ประเภทผู้รับ) จาก referral-fee-api ----------
  async function loadReferralRows() {
    const ref = await post(REFERRAL_URL, { action: "list_referral_fees" });
    const rows = Array.isArray(ref) ? ref : [];
    const map = {};
    rows.forEach(r => {
      const wht = Number(r.withholding_tax || 0);
      if (wht <= 0) return;
      const tt = pndTypeOf(r.pay_to);
      const aff = r.affiliation || "(ไม่ระบุสังกัด)";
      const pm = periodOf(r.payment_date);
      const key = `${tt}|${pm}|${aff}`;
      if (!map[key]) map[key] = { source_id: `ref|${key}`, kind: "referral", pndType: tt, sourceLabel: "ค่าแนะนำ", affiliation: aff, paid_at: `${yymm(r.payment_date)}-01`, period_month: pm, amount: 0, count: 0, vendor_name: "ค่าแนะนำ", details: [] };
      map[key].amount += wht; map[key].count += 1;
      map[key].details.push({ payment_no: r.payment_no, payment_date: r.payment_date, pay_to: r.pay_to, total_amount: Number(r.total_amount || 0), withholding_tax: wht });
    });
    return Object.values(map).map(b => ({ ...b, doc_refs: `${b.pndType} ค่าแนะนำ ${b.count} ราย (หัก ณ ที่จ่าย)` }));
  }
  // ---------- ภ.ง.ด.3/53: ค่าใช้จ่าย (รายเอกสาร) ----------
  //   ใช้เฉพาะ "ตารางบันทึกค่าใช้จ่าย" (expense_documents) ผ่าน accounting-api เท่านั้น
  //   ไม่ดึงจาก "บันทึกค่าใช้จ่ายจาก FLOW ACC" (flow_expense_documents)
  async function loadExpenseRows() {
    const from = dateFrom || "2000-01-01", to = dateTo || todayISO();
    const manualRaw = await post(ACC_URL, { action: "expense_record", op: "list", date_from: from, date_to: to }).catch(() => []);
    const keep = d => Number(d.wht_amount || 0) > 0 && String(d.status || "") !== "cancelled";
    return (Array.isArray(manualRaw) ? manualRaw : []).filter(keep).map(d => {
      const tt = pndTypeOfVendor(d.vendor_tax_id, d.vendor_name);
      return {
        source_id: `exp|${d.expense_doc_id}`,
        kind: "expense", pndType: tt, sourceLabel: "ค่าใช้จ่าย",
        source_table: "expense_documents", src_id: d.expense_doc_id, affiliation: d.affiliation || "(ไม่ระบุสังกัด)",
        paid_at: d.doc_date, period_month: periodOf(d.doc_date),
        amount: Number(d.wht_amount || 0), vendor_name: d.vendor_name || "-",
        doc_refs: `${tt} ${d.expense_doc_no || ""} (หัก ณ ที่จ่าย)`,
      };
    });
  }
  // ---------- ภ.ง.ด.3/53: งานทะเบียน (จ่ายเงิน PAY ที่มีหัก ณ ที่จ่าย, รายใบ) จาก registrations-api ----------
  //   หน้า "วางบิลงานทะเบียน" บันทึกจ่าย → registration_submissions (group by paid_doc_no, wht_amount > 0)
  //   สังกัด: ฮอนด้า = ป.เปา, ยามาฮ่า = สิงห์ชัย (จากยี่ห้อ); แยก ภ.ง.ด.3/53 จากเลขผู้เสียภาษีผู้รับ
  async function loadRegistrationRows() {
    const from = dateFrom || "2000-01-01", to = dateTo || todayISO();
    const raw = await post(REG_URL, { action: "list_registration_wht", date_from: from, date_to: to }).catch(() => []);
    return (Array.isArray(raw) ? raw : []).filter(d => Number(d.wht_amount || 0) > 0).map(d => {
      const tt = pndTypeOfVendor(d.vendor_tax_id, d.paid_to_vendor);
      return {
        source_id: `reg|${d.source_id}`,
        kind: "registration", pndType: tt, sourceLabel: "งานทะเบียน",
        source_table: "registration_submissions", src_id: Number(d.source_id), affiliation: d.affiliation || "(ไม่ระบุสังกัด)",
        paid_at: d.paid_at, period_month: periodOf(d.paid_at),
        amount: Number(d.wht_amount || 0), vendor_name: d.paid_to_vendor || "-",
        doc_refs: `${tt} ${d.paid_doc_no || ""} (งานทะเบียน)`,
      };
    });
  }
  // ---------- ภ.ง.ด.3: ค่านายหน้า (ค่าคอมปกติ ที่มีหัก ณ ที่จ่าย, รายใบ) จาก sales-extra-pay-api ----------
  //   หน้า "ค่าคอมปกติ" จ่ายเป็น expense_documents (commission_normal_save_group); WHT อยู่คอลัมน์ withholding_amount
  //   เอาเฉพาะ "ค่านายหน้า" (มี WHT) ไม่เอา "ค่าคอมมิชชั่น" (ไม่มี WHT). สังกัดเก็บใน doc แล้ว (ป.เปา/สิงห์ชัย)
  //   ดึงค่านายหน้า "รายใบ" จาก action ที่ระบุ (commission_normal_payables = ค่าคอมปกติ, commission_payables = ค่าคอมพิเศษ)
  //   ทั้งคู่ลง expense_documents (withholding_amount) โครงเหมือนกัน → รวมเป็นรายการค่านายหน้าเดียวกัน
  async function loadCommissionRowsVia(action) {
    const from = dateFrom || "2000-01-01", to = dateTo || todayISO();
    const raw = await post(SXP_URL, { action, mode: "list_paid_history", date_from: from, date_to: to }).catch(() => []);
    const docs = (Array.isArray(raw) ? raw : [])
      .filter(d => Number(d.withholding_amount || 0) > 0 && d.commission_type !== "commission" && String(d.status || "") !== "cancelled");
    // ดึง breakdown รายคนต่อ save_group (ว่าใครได้ค่านายหน้าเท่าไร → กระจาย WHT รายคน)
    const groups = [...new Set(docs.map(d => d.save_group).filter(Boolean))];
    const personMap = {};
    await Promise.all(groups.map(async sg => {
      const ps = await post(SXP_URL, { action, mode: "wht_persons", save_group: sg }).catch(() => []);
      personMap[sg] = Array.isArray(ps) ? ps : [];
    }));
    return docs.map(d => {
      const tt = pndTypeOfVendor(d.vendor_tax_id, d.vendor_name);
      const subtotal = Number(d.subtotal || 0), wht = Number(d.withholding_amount || 0);
      const pct = subtotal > 0 ? wht / subtotal : 0.03;          // อัตราจริงของใบนี้
      const empAff = d.affiliation;                              // สังกัดพนักงาน (ใช้ match รายคน)
      const payAff = payAffOfBrand(d.brand_filter, d.affiliation); // สังกัด "ที่จ่าย" = เจ้าของแบรนด์ (สำหรับแสดง/ยื่นภาษี)
      const persons = (personMap[d.save_group] || []).filter(p => p.affiliation === empAff && p.brand === d.brand_filter);
      const details = persons.length
        ? persons.map(p => {
            const amt = Number(p.amount || 0);
            return { payment_date: d.paid_at, payment_no: d.paid_doc_no || d.expense_doc_no || "-",
              pay_to: p.employee_name || "-", total_amount: amt, withholding_tax: Math.round(amt * pct * 100) / 100 };
          })
        : [{ payment_date: d.paid_at, payment_no: d.paid_doc_no || d.expense_doc_no || "-",
            pay_to: d.vendor_name || "-", total_amount: subtotal, withholding_tax: wht }];
      return {
        source_id: `comm|${d.expense_doc_id}`,
        kind: "commission", pndType: tt, sourceLabel: "ค่านายหน้า",
        source_table: "expense_documents", src_id: Number(d.expense_doc_id), affiliation: payAff,
        paid_at: d.paid_at, period_month: periodOf(d.paid_at),
        amount: wht, vendor_name: d.vendor_name || "-",
        doc_refs: `${tt} ${d.expense_doc_no || ""} (ค่านายหน้า${persons.length ? ` · ${persons.length} คน` : ""})`,
        details,
      };
    });
  }
  // รวมค่านายหน้าจาก "ค่าคอมปกติ" + "ค่าคอมพิเศษ" เป็นรายการเดียวกัน
  async function loadCommissionRows() {
    const [normal, special] = await Promise.all([
      loadCommissionRowsVia("commission_normal_payables").catch(() => []),
      loadCommissionRowsVia("commission_payables").catch(() => []),
    ]);
    return [...normal, ...special];
  }
  // ---------- ภ.ง.ด.53: ค่าประกันรถหาย (ออกแทน, รายเอกสาร) หัก ณ ที่จ่าย 3% ----------
  //   บริษัทประกัน = นิติบุคคล → ภ.ง.ด.53; WHT = มูลค่าก่อน VAT (subtotal) × 3%
  //   ที่มา: flow_expense_documents รหัส 52071 ผ่าน list_theft_insurance (หน้าบันทึกรับใบกำกับฯ ประกันรถหายออกแทน)
  async function loadTheftInsuranceRows() {
    const from = dateFrom || "2000-01-01", to = dateTo || todayISO();
    const raw = await post(THEFT_URL, { action: "list_theft_insurance", date_from: from, date_to: to }).catch(() => []);
    return (Array.isArray(raw) ? raw : [])
      .filter(d => d && (d.expense_doc_no || d.id) && String(d.status || "") !== "cancelled")
      .map(d => {
        const base = Number(d.subtotal || 0);            // มูลค่าก่อน VAT
        const wht = Math.round(base * 0.03 * 100) / 100; // หัก ณ ที่จ่าย 3%
        return {
          source_id: `theft|${d.id}`,
          kind: "theft", pndType: "ภ.ง.ด.53", sourceLabel: "ประกันรถหาย(ออกแทน)",
          source_table: "flow_expense_documents", src_id: Number(d.id),
          affiliation: d.affiliation || "(ไม่ระบุสังกัด)",
          paid_at: d.doc_date, period_month: periodOf(d.doc_date),
          amount: wht, vendor_name: d.vendor_name || "-",
          doc_refs: `ภ.ง.ด.53 ${d.expense_doc_no || ""} (ประกันรถหายออกแทน · หัก ณ ที่จ่าย 3%)`,
        };
      })
      .filter(r => r.amount > 0);
  }
  async function fetchPendingWHT() {
    setLoading(true);
    try {
      const [payroll, referral, expense, registration, commission, theft, doneRaw] = await Promise.all([
        loadPayrollRows().catch(() => []),
        loadReferralRows().catch(() => []),
        loadExpenseRows().catch(() => []),
        loadRegistrationRows().catch(() => []),
        loadCommissionRows().catch(() => []),
        loadTheftInsuranceRows().catch(() => []),
        post(TAX_URL, { action: "list_tax_remittances" }).catch(() => []),
      ]);
      const done = (Array.isArray(doneRaw) ? doneRaw : []).filter(h => h.status !== "cancelled");
      const itemsOf = h => (Array.isArray(h.items) ? h.items : []);
      // referral bucket = done เฉพาะเมื่อมีใบนำส่งที่ "มาจากค่าแนะนำ" (item source_table='referral') ในงวด/สังกัด/แบบเดียวกัน
      // (กันไม่ให้ใบของค่าใช้จ่าย ภ.ง.ด.3/53 ในงวดเดียวกันมาบังบัคเก็ตค่าแนะนำ)
      const refDone = new Set(done.filter(h => itemsOf(h).some(i => i.source_table === "referral")).map(h => `${h.tax_type}|${h.period_month}|${h.affiliation}`));
      const expDone = new Set(done.flatMap(h => itemsOf(h).map(i => `${i.source_table}|${i.source_id}`)));
      const refRows = referral.filter(b => !refDone.has(`${b.pndType}|${b.period_month}|${b.affiliation}`));
      // ค่าใช้จ่าย + งานทะเบียน + ค่านายหน้า = รายเอกสาร (itemized) — dedup นำส่งแล้ว + กันซ้ำ source เดียวกัน
      const seenItem = new Set();
      const itemRows = [...expense, ...registration, ...commission, ...theft].filter(b => {
        const k = `${b.source_table}|${b.src_id}`;
        if (expDone.has(k) || seenItem.has(k)) return false;
        seenItem.add(k); return true;
      });
      const rows = [...payroll, ...refRows, ...itemRows]
        .filter(r => !filterAff || r.affiliation === filterAff)
        .filter(r => !filterForm || r.pndType === filterForm)
        .filter(r => inRange(r.paid_at))
        .sort((a, b) => String(b.period_month).localeCompare(String(a.period_month)) || String(a.pndType).localeCompare(String(b.pndType)));
      setPending(rows);
    } catch { setPending([]); }
    setLoading(false);
  }
  async function fetchHistoryWHT() {
    setLoading(true);
    try {
      const [pays, trmt] = await Promise.all([
        hr({ action: "payroll_payables", mode: "list_payments" }),
        post(TAX_URL, { action: "list_tax_remittances" }),
      ]);
      const payrollHist = (Array.isArray(pays) ? pays : [])
        .filter(p => (p.payroll_creditor_type === "tax" || p.vendor_name === "สรรพากร") && p.paid_doc_no)
        .filter(p => !filterAff || p.affiliation === filterAff)
        .filter(() => !filterForm || filterForm === "ภ.ง.ด.1")
        .filter(p => inRange(p.paid_at || p.month_year))
        .map(p => ({
          remit_doc_no: p.paid_doc_no, tax_type: "ภ.ง.ด.1", remit_date: p.paid_at,
          period_month: periodOf(p.month_year), affiliation: p.affiliation,
          payment_method: p.payment_method, from_bank_account_id: p.from_bank_account_id,
          receipt_no: p.expense_doc_no || "", amount_total: Number(p.total || 0), note: "",
          status: p.status === "cancelled" ? "cancelled" : "paid",
          items: [{ source_ref: p.expense_doc_no, vendor_name: p.vendor_name || "สรรพากร", doc_date: p.month_year, amount: Number(p.total || 0) }],
          _pnd: true,
        }));
      const trmtHist = (Array.isArray(trmt) ? trmt : [])
        .filter(h => String(h.tax_type || "").startsWith("ภ.ง.ด."))
        .filter(h => !filterAff || h.affiliation === filterAff)
        .filter(h => !filterForm || h.tax_type === filterForm)
        .filter(h => inRange(h.remit_date));
      setHistory([...payrollHist, ...trmtHist].sort((a, b) => String(b.remit_date || "").localeCompare(String(a.remit_date || ""))));
    } catch { setHistory([]); }
    setLoading(false);
  }
  async function fetchBankAccounts() {
    try {
      const data = await post(ACC_URL, { action: "list_bank_accounts", include_inactive: "false" });
      setBankAccounts(Array.isArray(data) ? data : []);
    } catch { setBankAccounts([]); }
  }

  // ----- selection (เทียบเป็น string รองรับ pb_id (ภ.พ.36) และคีย์รวม (ภ.ง.ด.)) -----
  const selectedKeys = Object.keys(selected).filter(k => selected[k]);
  const selectedRows = pending.filter(r => selectedKeys.includes(String(r.source_id)));
  const selectedSum = selectedRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const selectedAffs = [...new Set(selectedRows.map(r => r.affiliation).filter(Boolean))];
  const selectedPeriods = [...new Set(selectedRows.map(r => r.period_month).filter(Boolean))];
  const selectedTypes = [...new Set(selectedRows.map(r => r.pndType).filter(Boolean))];
  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount || 0), 0);

  function toggleExpand(id) { setExpanded(s => ({ ...s, [id]: !s[id] })); }
  function toggleOne(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (pending.length && pending.every(r => selected[r.source_id])) { setSelected({}); return; }
    const next = {}; pending.forEach(r => { next[r.source_id] = true; }); setSelected(next);
  }

  function openPayDialog() {
    if (selectedKeys.length === 0) { setMessage("❌ เลือกรายการภาษีก่อน"); return; }
    if (selectedAffs.length > 1) { setMessage("❌ เลือกได้ทีละสังกัด (ป.เปา/สิงห์ชัย ยื่นแยกบริษัท)"); return; }
    setPayForm({ remit_date: todayISO(), payment_method: "โอน", from_bank_account_id: "", receipt_no: "", note: "" });
    setPayDialog(true);
  }

  async function savePayment() {
    if (payForm.payment_method === "โอน" && !payForm.from_bank_account_id) { setMessage("❌ วิธีจ่าย 'โอน' ต้องเลือกบัญชี"); return; }
    setSaving(true);
    try {
      if (isWHT) {
        await saveWHT();
      } else {
        const data = await post(TAX_URL, {
          action: "save_tax_remittance", tax_type: taxType,
          remit_date: payForm.remit_date, affiliation: selectedAffs[0] || null,
          period_month: selectedPeriods.length === 1 ? selectedPeriods[0] : (selectedPeriods.slice().sort().slice(-1)[0] || null),
          // table-aware: ส่ง source_table ของแต่ละแถว (ภ.พ.36 มาได้ทั้ง FLOW ACC และบันทึกค่าใช้จ่าย)
          sources: selectedRows.map(r => ({ source_table: r.source_table, source_id: Number(r.source_id) })),
          source_ids: selectedRows.map(r => Number(r.source_id)),
          payment_method: payForm.payment_method,
          from_bank_account_id: payForm.payment_method === "โอน" ? (Number(payForm.from_bank_account_id) || null) : null,
          receipt_no: payForm.receipt_no, note: payForm.note, created_by: whoami(),
        });
        const doc = data?.remit_doc_no || data?.[0]?.remit_doc_no || "";
        setMessage(`✅ บันทึกจ่ายภาษีเรียบร้อย ${doc}`);
      }
      setPayDialog(false); setSelected({}); fetchPending();
    } catch (e) { setMessage("❌ " + e.message); }
    setSaving(false);
  }

  // โหมดรวม: แยกจ่ายตามชนิดของแต่ละแถว (ใช้ข้อมูลการจ่ายชุดเดียวกัน)
  async function saveWHT() {
    const bank = payForm.payment_method === "โอน" ? (Number(payForm.from_bank_account_id) || null) : null;
    let okAny = false;
    const payroll = selectedRows.filter(r => r.kind === "payroll");
    const referral = selectedRows.filter(r => r.kind === "referral");
    // ค่าใช้จ่าย + งานทะเบียน + ค่านายหน้า = บันทึกแบบ itemized (แต่ละแถวพก source_table/source_id ของตัวเอง)
    const expense = selectedRows.filter(r => r.kind === "expense" || r.kind === "registration" || r.kind === "commission" || r.kind === "theft");

    if (payroll.length) {
      const ids = [];
      for (const r of payroll) {
        await hr({ action: "payroll_payables", mode: "create", save_group: r.save_group, doc_date: todayISO(), created_by: whoami() });
        const docs = await hr({ action: "payroll_payables", mode: "list_docs", save_group: r.save_group });
        const draft = docs.find(d => d.payroll_creditor_type === "tax" && String(d.description || "").includes(`สังกัด ${r.affiliation}`) && d.status === "draft");
        if (draft) ids.push(draft.expense_doc_id);
      }
      if (ids.length) {
        const res = await post(ACC_URL, { action: "expense_record", op: "save_payment", expense_doc_ids: ids, paid_date: payForm.remit_date, payment_method: payForm.payment_method, payment_note: payForm.note, paid_by: whoami(), from_bank_account_id: bank, override_total: null });
        const row = Array.isArray(res) ? res[0] : res;
        if (row?.error_msg) throw new Error(row.error_msg);
        okAny = true;
      }
    }
    for (const r of referral) {
      const res = await post(TAX_URL, { action: "save_tax_remittance", tax_type: r.pndType, period_month: r.period_month, affiliation: r.affiliation, remit_date: payForm.remit_date, payment_method: payForm.payment_method, from_bank_account_id: bank, receipt_no: payForm.receipt_no, note: payForm.note, amount_total: r.amount, created_by: whoami(), source_ids: [] });
      const row = Array.isArray(res) ? res[0] : res;
      if (Number(row?.updated_count || 0) > 0) okAny = true;
    }
    // ค่าใช้จ่าย: จัดกลุ่ม (ประเภท|งวด|สังกัด) → itemized 1 ใบต่อกลุ่ม
    const groups = {};
    expense.forEach(r => { const k = `${r.pndType}|${r.period_month}|${r.affiliation}`; (groups[k] = groups[k] || []).push(r); });
    for (const k of Object.keys(groups)) {
      const g = groups[k];
      const items = g.map(r => ({ source_table: r.source_table, source_id: r.src_id, amount: r.amount, vendor_name: r.vendor_name, doc_date: r.paid_at, affiliation: r.affiliation }));
      const res = await post(TAX_URL, { action: "save_tax_remittance", mode: "itemized", tax_type: g[0].pndType, period_month: g[0].period_month, affiliation: g[0].affiliation, remit_date: payForm.remit_date, payment_method: payForm.payment_method, from_bank_account_id: bank, receipt_no: payForm.receipt_no, note: payForm.note, items, created_by: whoami() });
      const row = Array.isArray(res) ? res[0] : res;
      if (Number(row?.updated_count || 0) > 0) okAny = true;
    }
    if (!okAny) throw new Error("รายการที่เลือกนำส่งไปแล้ว หรือไม่มียอด");
    setMessage("✅ บันทึกจ่ายภาษีหัก ณ ที่จ่ายเรียบร้อย");
  }

  async function cancelRemittance(g) {
    if (!g.remit_doc_no) return;
    if (!window.confirm(`ยกเลิกการจ่าย ${g.remit_doc_no}?\nรายการจะกลับมาเป็น "รอจ่าย"`)) return;
    try {
      if (g._pnd) {
        await post(ACC_URL, { action: "expense_record", op: "cancel_payment", paid_doc_no: g.remit_doc_no });
      } else {
        await post(TAX_URL, { action: "cancel_tax_remittance", remit_doc_no: g.remit_doc_no, cancelled_by: whoami() });
      }
      setMessage("✅ ยกเลิกเรียบร้อย"); fetchHistory();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  const histTotal = history.filter(h => h.status !== "cancelled").reduce((s, h) => s + Number(h.amount_total || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">{lockTaxType === "ภ.พ.36" ? "🧾 ภ.พ.36 (ภาษีมูลค่าเพิ่มรอนำส่ง)" : lockTaxType === "ภ.ง.ด." ? "🧾 บันทึกจ่ายภาษีหัก ณ ที่จ่าย (ภ.ง.ด.)" : "🧾 บันทึกจ่ายเงินภาษีสรรพากร"}</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2",
          color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 14 }}>{message}</div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, borderBottom: "2px solid #e5e7eb" }}>
        {[["pending", "🧾 ภาษีรอจ่าย"], ["history", "📋 ประวัติการจ่าย"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: "10px 18px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: tab === k ? "#072d6b" : "#6b7280", borderBottom: tab === k ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {!lockTaxType && (
          <select value={taxType} onChange={e => setTaxType(e.target.value)} style={{ ...inp, maxWidth: 340 }} title="ประเภทภาษี">
            {TAX_TYPES.map(t => <option key={t.value} value={t.value} disabled={!t.ready}>{t.label}</option>)}
          </select>
        )}
        <label>วันที่:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <select value={filterAff} onChange={e => setFilterAff(e.target.value)} style={inp} title="กรองตามสังกัด">
          <option value="">🏢 สังกัด: ทั้งหมด</option>
          <option value="ป.เปา">ป.เปา</option>
          <option value="สิงห์ชัย">สิงห์ชัย</option>
        </select>
        {isWHT && (
          <select value={filterForm} onChange={e => setFilterForm(e.target.value)} style={inp} title="กรองตามแบบภาษี">
            <option value="">📋 แบบ: ทั้งหมด</option>
            <option value="ภ.ง.ด.1">ภ.ง.ด.1</option>
            <option value="ภ.ง.ด.3">ภ.ง.ด.3</option>
            <option value="ภ.ง.ด.53">ภ.ง.ด.53</option>
          </select>
        )}
        <button onClick={() => { tab === "pending" ? fetchPending() : fetchHistory(); }} style={btn("#0369a1")}>🔄 รีเฟรช</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "#6b7280" }}>กรองวันที่ว่าง = แสดงทั้งหมด</span>
      </div>

      {/* TAB: รอจ่าย */}
      {tab === "pending" && (
        <>
          <div style={{ padding: "10px 14px", background: "#fef9c3", border: "1px solid #fcd34d", borderRadius: 10, marginBottom: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span>เลือก: <strong>{selectedKeys.length}</strong> / {pending.length} รายการ</span>
            <span style={{ color: "#dc2626" }}>ยอดภาษีที่เลือก: <strong>{fmt(selectedSum)}</strong> บาท</span>
            <span style={{ color: "#6b7280" }}>ยอดรอจ่ายรวม: <strong>{fmt(pendingTotal)}</strong> บาท</span>
            {selectedAffs.length > 1 && <span style={{ color: "#b45309", fontSize: 12 }}>⚠️ เลือกได้ทีละสังกัด</span>}
            <div style={{ flex: 1 }} />
            <button onClick={openPayDialog} disabled={selectedKeys.length === 0}
              style={{ ...btn(selectedKeys.length === 0 ? "#9ca3af" : "#059669"), cursor: selectedKeys.length === 0 ? "not-allowed" : "pointer" }}>💵 บันทึกจ่ายภาษี</button>
          </div>
          {isWHT && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>รวมเงินเดือน (ภ.ง.ด.1) · ค่าแนะนำ (ภ.ง.ด.3/53, สรุปเดือน) · ค่าใช้จ่าย/งานทะเบียน/ค่านายหน้า ที่มีหัก ณ ที่จ่าย (ภ.ง.ด.3/53, รายเอกสาร) — เลือกข้ามแบบแล้วกดจ่ายพร้อมกันได้ (จ่ายทีละสังกัด)</div>}
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
            {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
             pending.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการภาษีรอจ่าย</div> :
             <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={{ ...th, width: 40, textAlign: "center" }}>
                    <input type="checkbox" checked={pending.length > 0 && pending.every(r => selected[r.source_id])} onChange={toggleAll} />
                  </th>
                  <th style={th}>วันที่จ่าย</th>
                  {isWHT && <th style={th}>แบบ / ที่มา</th>}
                  <th style={th}>งวด</th>
                  <th style={th}>สังกัด</th>
                  {!isWHT && <th style={th}>เลขที่จ่าย</th>}
                  <th style={th}>ผู้ขาย</th>
                  <th style={th}>เอกสารอ้างอิง</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอดภาษี</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(r => {
                  const details = Array.isArray(r.details) ? r.details : [];
                  const hasDetails = details.length > 0;
                  const isOpen = !!expanded[r.source_id];
                  return (
                  <React.Fragment key={r.source_id}>
                  <tr style={{ borderTop: "1px solid #e5e7eb", background: selected[r.source_id] ? "#fef3c7" : "transparent" }}>
                    <td style={{ ...td, textAlign: "center" }}>
                      <input type="checkbox" checked={!!selected[r.source_id]} onChange={() => toggleOne(r.source_id)} />
                    </td>
                    <td style={td}>{fmtDate(r.paid_at)}</td>
                    {isWHT && <td style={td}>
                      {hasDetails && (
                        <button onClick={() => toggleExpand(r.source_id)} title={isOpen ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
                          style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, color: "#374151", marginRight: 4, padding: 0 }}>
                          {isOpen ? "▼" : "▶"}
                        </button>
                      )}
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#eef2ff", color: "#3730a3" }}>{r.pndType}</span>
                      <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 6 }}>{r.sourceLabel}</span>
                    </td>}
                    <td style={td}>{fmtPeriod(r.period_month)}</td>
                    <td style={td}>{r.affiliation ? <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: r.affiliation === "ป.เปา" ? "#fee2e2" : "#dbeafe", color: r.affiliation === "ป.เปา" ? "#991b1b" : "#1e40af" }}>{r.affiliation}</span> : "-"}</td>
                    {!isWHT && <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#065f46" }}>{r.paid_doc_no || "-"}</td>}
                    <td style={td}>{r.vendor_name || "-"}</td>
                    <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>
                      {hasDetails
                        ? <button onClick={() => toggleExpand(r.source_id)} style={{ border: "none", background: "transparent", color: "#0369a1", cursor: "pointer", padding: 0, fontSize: 12, textDecoration: "underline" }}>{r.doc_refs || "-"}</button>
                        : (r.doc_refs || "-")}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#dc2626" }}>{fmt(r.amount)}</td>
                  </tr>
                  {hasDetails && isOpen && (
                    <tr>
                      <td colSpan={8} style={{ padding: "0 12px 10px 48px", background: "#f9fafb", borderTop: "none" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6 }}>
                          <thead style={{ background: "#f3f4f6", color: "#374151" }}>
                            <tr>
                              <th style={tdSub}>วันที่จ่าย</th>
                              <th style={tdSub}>เลขที่จ่าย</th>
                              <th style={tdSub}>ผู้รับ</th>
                              <th style={{ ...tdSub, textAlign: "right" }}>ยอดเงิน</th>
                              <th style={{ ...tdSub, textAlign: "right" }}>หัก ณ ที่จ่าย</th>
                            </tr>
                          </thead>
                          <tbody>
                            {details.map((d, i) => (
                              <tr key={i} style={{ borderTop: "1px solid #eef2f7" }}>
                                <td style={tdSub}>{fmtDate(d.payment_date)}</td>
                                <td style={{ ...tdSub, fontFamily: "monospace", color: "#0369a1" }}>{d.payment_no || "-"}</td>
                                <td style={tdSub}>{d.pay_to || "-"}</td>
                                <td style={{ ...tdSub, textAlign: "right", fontFamily: "monospace" }}>{fmt(d.total_amount)}</td>
                                <td style={{ ...tdSub, textAlign: "right", fontFamily: "monospace", color: "#dc2626", fontWeight: 600 }}>{fmt(d.withholding_tax)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>}
          </div>
        </>
      )}

      {/* TAB: ประวัติ */}
      {tab === "history" && (
        <>
          <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
            <span>📋 ใบนำส่งภาษี: <strong>{history.length}</strong></span>
            <span style={{ marginLeft: 14, color: "#dc2626" }}>ยอดรวม (ไม่รวมยกเลิก): <strong>{fmt(histTotal)}</strong> บาท</span>
          </div>
          {loading ? <div style={{ padding: 30, textAlign: "center", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>กำลังโหลด...</div> :
           history.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>ยังไม่มีประวัติ</div>
          ) : history.map(g => {
            const cancelled = g.status === "cancelled";
            const bank = bankAccounts.find(a => Number(a.account_id) === Number(g.from_bank_account_id));
            const items = Array.isArray(g.items) ? g.items : [];
            return (
              <div key={g.remit_doc_no} style={{ marginBottom: 12, background: cancelled ? "#fef2f2" : "#ecfdf5", border: `1px solid ${cancelled ? "#fca5a5" : "#6ee7b7"}`, borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <strong style={{ fontFamily: "monospace", color: cancelled ? "#991b1b" : "#065f46", fontSize: 15 }}>{g.remit_doc_no}</strong>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#ecfeff", color: "#0e7490" }}>{g.tax_type}</span>
                  <span style={{ fontSize: 12 }}>📅 {fmtDate(g.remit_date)}</span>
                  <span style={{ fontSize: 12 }}>🗓️ งวด {fmtPeriod(g.period_month)}</span>
                  {g.affiliation && <span style={{ fontSize: 12 }}>🏢 {g.affiliation}</span>}
                  <span style={{ fontSize: 12 }}>💳 {g.payment_method || "-"}</span>
                  {bank && <span style={{ fontSize: 12 }}>🏦 {bank.bank_name} · {bank.account_no}</span>}
                  {g.receipt_no && <span style={{ fontSize: 12 }}>🧾 {g.receipt_no}</span>}
                  <span style={{ marginLeft: "auto", fontWeight: 700, color: cancelled ? "#991b1b" : "#065f46" }}>
                    {cancelled ? "ยกเลิกแล้ว · " : ""}{items.length} รายการ · {fmt(g.amount_total)}
                  </span>
                  {!cancelled && <button onClick={() => cancelRemittance(g)} style={{ ...btnSm, background: "#dc2626" }}>✕ ยกเลิก</button>}
                </div>
                {items.length > 0 && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8, background: "#fff", borderRadius: 6, overflow: "hidden" }}>
                    <thead style={{ background: "#f3f4f6" }}>
                      <tr>
                        <th style={th}>เอกสารอ้างอิง</th><th style={th}>ผู้ขาย</th>
                        <th style={th}>วันที่</th><th style={{ ...th, textAlign: "right" }}>ยอดภาษี</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{it.source_ref || "-"}</td>
                          <td style={td}>{it.vendor_name || "-"}</td>
                          <td style={td}>{fmtDate(it.doc_date)}</td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#059669" }}>{fmt(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Payment Dialog */}
      {payDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !saving && setPayDialog(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 620, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>💵 บันทึกจ่ายเงินภาษีสรรพากร</h3>
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13, textAlign: "center" }}>
              <div>🏷️ {isWHT ? selectedTypes.join(", ") || "ภ.ง.ด." : taxType} · 🏢 {selectedAffs[0] || "-"} · 🗓️ งวด {selectedPeriods.map(fmtPeriod).join(", ") || "-"}</div>
              <div style={{ marginTop: 6 }}>🧾 รายการ: <b>{selectedKeys.length}</b> รายการ</div>
              <div style={{ marginTop: 2 }}>💰 ยอดภาษีที่ต้องนำส่ง: <b style={{ color: "#dc2626", fontSize: 22 }}>฿ {fmt(selectedSum)}</b></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>วันที่จ่าย *</label>
                <input type="date" value={payForm.remit_date} onChange={e => setPayForm(p => ({ ...p, remit_date: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>วิธีจ่าย</label>
                <select value={payForm.payment_method}
                  onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value, from_bank_account_id: e.target.value === "โอน" ? p.from_bank_account_id : "" }))} style={inp}>
                  <option value="โอน">โอน</option>
                  <option value="เงินสด">เงินสด</option>
                  <option value="เช็ค">เช็ค</option>
                </select>
              </div>
              {payForm.payment_method === "โอน" && (
                <div style={{ gridColumn: "1 / span 2" }}>
                  <label style={lbl}>บัญชีที่โอนจ่าย *</label>
                  <select value={payForm.from_bank_account_id || ""} onChange={e => setPayForm(p => ({ ...p, from_bank_account_id: e.target.value }))} style={inp}>
                    <option value="">-- เลือกบัญชีโอนจาก --</option>
                    {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>เลขที่ใบเสร็จ / อ้างอิงสรรพากร</label>
                <input type="text" value={payForm.receipt_no} onChange={e => setPayForm(p => ({ ...p, receipt_no: e.target.value }))} style={inp} placeholder="เช่น เลขอ้างอิงการยื่น/ใบเสร็จ" />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={payForm.note} onChange={e => setPayForm(p => ({ ...p, note: e.target.value }))} rows={2} style={inp} />
              </div>
            </div>
            {isWHT && selectedTypes.length > 1 && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>* เลือกหลายแบบ — ระบบจะบันทึกแยกใบตามแบบ/งวด แต่ใช้วันที่และบัญชีจ่ายชุดเดียวกัน</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setPayDialog(false)} disabled={saving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={savePayment} disabled={saving}
                style={{ padding: "8px 20px", background: saving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึกจ่ายภาษี"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box", width: "100%" };
const th = { padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" };
const td = { padding: "8px 12px", verticalAlign: "top" };
const tdSub = { padding: "6px 10px", textAlign: "left", fontSize: 12 };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 };
const btnSm = { padding: "4px 10px", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 };
function btn(bg) { return { padding: "8px 16px", background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }; }
