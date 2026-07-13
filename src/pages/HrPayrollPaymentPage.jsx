import React, { useEffect, useState } from "react";
import { TH_MONTHS, SLIP_COMPANY, slipDateLabel, printSlips, sendSlipEmail, fetchSlipSendLog } from "../lib/payslip";

const HR_API = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const SALES_EXTRA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/sales-extra-pay-api";

function fmtN(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function monthDisplay(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d).slice(0, 7);
  return `${TH_MONTHS[dt.getMonth()]} ${dt.getFullYear() + 543}`;
}

// ---------- สลิปเงินเดือน ----------
const normName = s => String(s || "").trim().replace(/\s+/g, " ");

// รอบเงินเดือน 21 เดือนก่อน - 20 เดือนที่จ่าย (ทั้ง 2 บริษัท)
function slipPeriodLabel(monthYear) {
  const dt = new Date(monthYear);
  if (isNaN(dt)) return "-";
  const prev = new Date(dt.getFullYear(), dt.getMonth() - 1, 1);
  return `21 ${TH_MONTHS[prev.getMonth()]} - 20 ${TH_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

// แปลงข้อมูล 1 คน → spec สลิปสำหรับ printSlips (lib/payslip)
function salarySlipSpec(row, item, paidAt) {
  const e = row.snap, hr = row.hr || {};
  const ot = Number(e.ot_workday || 0) + Number(e.ot_holiday || 0);
  const allowance = Number(e.meal_allowance || 0) + Number(e.laundry_allowance || 0) + Number(e.diligence_allowance || 0);
  const bonus = Number(e.bonus || 0);
  const otherIncome = Number(e.other_income || 0) + Number(e.extra_bonus || 0); // "พิเศษ" (เงินเพิ่มพิเศษ) นับเป็นเงินได้อื่นๆ ไม่ใช่โบนัส
  const otherDeduct = Number(e.other_expense || 0) + Number(e.admin_expense || 0) + Number(e.lost_items || 0);
  const dept = hr.department || e.position || "-";
  const pos = e.position || hr.position || "-";
  return {
    company: SLIP_COMPANY[item.affiliation] || item.affiliation,
    name: e.employee_name,
    code: hr.employee_code || "",
    position: `${dept}/${pos}`,
    periodLabel: slipPeriodLabel(item.month_year),
    paidLabel: slipDateLabel(paidAt),
    bankAccount: e.bank_account_no || hr.bank_account_no || "-",
    year: new Date(item.month_year).getFullYear(),
    earnings: [
      ["เงินเดือน/ค่าจ้าง", "Salary/Wage", e.salary],
      ["ค่าล่วงเวลา", "Overtime", ot],
      ["ค่าเบี้ยเลี้ยง/ค่าครองชีพ", "Allowances/Cost of livings", allowance],
      ["โบนัส", "Bonus", bonus],
      ["เงินได้อื่นๆ", "Others", otherIncome],
    ],
    deductions: [
      ["ประกันสังคม", "Social Security Fund", e.sso_amount],
      ["ภาษีหัก ณ ที่จ่าย", "Withholding tax", e.tax],
      ["กองทุนสำรองเลี้ยงชีพ", "Provident Fund", e.pf_amount],
      ["เงินกู้ยืม กยศ./กรอ.", "Student Loan Fund", e.study_loan],
      ["เงินประกัน", "Deposit", 0],
      ["ขาด/ลา/มาสาย", "Absent/Leave/Late", e.absence_late],
      ["รายการหักอื่นๆ", "Others", otherDeduct],
    ],
    ytd: [
      ["เงินได้สะสม", "YTD earnings", row.ytdIncome],
      ["ภาษีหัก ณ ที่จ่ายสะสม", "YTD Withholding tax", row.ytdTax],
      ["เงินประกันสังคมสะสม", "Accumulated SSF", row.ytdSso],
    ],
    totals: [
      ["รวมเงินได้", "Total earnings", e.total_income],
      ["รวมรายการหัก", "Total deductions", e.total_expense],
      ["เงินได้สุทธิ", "Net pay", e.net_income],
    ],
  };
}

function printSalarySlips(rows, item, paidAt) {
  printSlips(rows.map(r => salarySlipSpec(r, item, paidAt)),
    `สลิปเงินเดือน ${monthDisplay(item.month_year)} ${item.affiliation}`);
}

export default function HrPayrollPaymentPage({ currentUser }) {
  const [tab, setTab] = useState("summary"); // summary | payment | history
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [docsCache, setDocsCache] = useState({}); // { save_group: docs[] }
  const [created, setCreated] = useState([]);
  const [monthFilter, setMonthFilter] = useState(""); // YYYY-MM
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // detail popup
  const [detail, setDetail] = useState(null); // { item, docs[] }
  // per-row item detail popup (employee breakdown for one creditor type)
  const [itemDetail, setItemDetail] = useState(null); // { item, row, employees[], loading, edits: { snapshot_id: value } }
  const [savingEdits, setSavingEdits] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  // payslip popup
  const [slipPopup, setSlipPopup] = useState(null); // { item, loading, rows, paidAt, sentLog, error }
  const [slipSending, setSlipSending] = useState({}); // ชื่อ → 'sending' | 'sent' | 'error:...'

  // pay popup
  const [payPopup, setPayPopup] = useState(null); // { item, row, doc, loading, error }
  const [bankAccounts, setBankAccounts] = useState([]);
  const [paying, setPaying] = useState(false);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("โอน");
  const [payAccountId, setPayAccountId] = useState("");
  const [payNote, setPayNote] = useState("");

  // prefetch docs for payment + summary tabs
  useEffect(() => {
    if ((tab !== "payment" && tab !== "summary") || created.length === 0) return;
    const sgs = [...new Set(created.map(c => c.save_group))];
    Promise.all(sgs.map(sg =>
      fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_payables", mode: "list_docs", save_group: sg }),
      }).then(r => r.json()).then(d => [sg, Array.isArray(d) ? d : []]).catch(() => [sg, []])
    )).then(pairs => {
      const cache = {};
      pairs.forEach(([sg, docs]) => { cache[sg] = docs; });
      setDocsCache(cache);
    });
  }, [tab, created]);

  function getDocStatus(save_group, affiliation, creditorType) {
    const docs = docsCache[save_group] || [];
    const matching = docs.filter(d =>
      d.payroll_creditor_type === creditorType
      && (d.description || "").includes(`สังกัด ${affiliation}`)
    );
    const paid = matching.find(d => d.status === "paid");
    const draft = matching.find(d => d.status === "draft");
    if (paid) return { status: "paid", doc: paid };
    if (draft) return { status: "draft", doc: draft };
    return { status: null, doc: null };
  }

  // load bank accounts (for dropdown)
  useEffect(() => {
    fetch(ACC_API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_bank_accounts" }),
    }).then(r => r.json()).then(d => setBankAccounts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [monthFilter, tab]);

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      if (tab === "history") {
        const body = { action: "payroll_payables", mode: "list_payments" };
        if (monthFilter) body.month_year = monthFilter + "-01";
        const res = await fetch(HR_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setPaymentHistory(Array.isArray(data) ? data : []);
      } else {
        const body = { action: "payroll_payables", mode: "list_by_affiliation" };
        if (monthFilter) body.month_year = monthFilter + "-01";
        const res = await fetch(HR_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setCreated(Array.isArray(data) ? data : []);
      }
    } catch (e) { setMessage("❌ โหลดไม่สำเร็จ: " + e.message); }
    setLoading(false);
  }

  async function cancelPayment(item) {
    if (!window.confirm(`ยกเลิกการจ่าย ${item.paid_doc_no}?\n\nรายการ: ${item.vendor_name}\nยอด: ${fmtN(item.total)}\n\nสถานะจะกลับเป็น draft (รอจ่ายใหม่)`)) return;
    try {
      const res = await fetch(ACC_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "expense_record",
          op: "cancel_payment",
          paid_doc_no: item.paid_doc_no,
        }),
      });
      const data = await res.json();
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.error_msg) throw new Error(result.error_msg);
      setMessage(`✅ ยกเลิกการจ่าย ${item.paid_doc_no} เรียบร้อย`);
      fetchData();
    } catch (e) { alert("❌ ยกเลิกไม่สำเร็จ: " + e.message); }
  }

  // fieldMap: row.key → snapshot field
  const fieldMap = {
    salary: "net_income",
    tax: "tax",
    sso: "sso_amount",
    pf: "pf_amount",
    loan: "study_loan",
    admin: "admin_expense",
    lost: "lost_items",
    other: "other_expense",
  };

  async function openItemDetail(item, row) {
    setItemDetail({ item, row, employees: [], loading: true });
    try {
      const res = await fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_snapshot", mode: "detail", save_group: item.save_group }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      const field = fieldMap[row.key];
      // กรองเฉพาะสังกัดนี้ + เฉพาะคนที่มียอดในช่อง field > 0
      const filtered = arr.filter(e =>
        (e.affiliation || "-") === item.affiliation
        && Number(e[field] || 0) > 0
      ).sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0));
      setItemDetail({ item, row, field, employees: filtered, loading: false, edits: {} });
    } catch (e) {
      setItemDetail({ item, row, employees: [], loading: false, error: e.message, edits: {} });
    }
  }

  // Check if this row's creditor is paid (block editing)
  function isCreditorPaid(item, row) {
    const { status } = getDocStatus(item.save_group, item.affiliation, row.key);
    return status === "paid";
  }

  function startEditRow(snapshotId, currentValue) {
    setEditingId(snapshotId);
    setEditingValue(String(currentValue ?? ""));
  }
  function cancelEditRow() {
    setEditingId(null);
    setEditingValue("");
  }
  async function saveEditRow() {
    if (!itemDetail || !itemDetail.field || !editingId) return;
    setSavingEdits(true);
    try {
      const res = await fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payroll_snapshot", mode: "update_amounts",
          save_group: itemDetail.item.save_group,
          field: itemDetail.field,
          updates: [{ snapshot_id: editingId, value: Number(editingValue) || 0 }],
        }),
      });
      const data = await res.json();
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.error) throw new Error(result.error);
      setMessage(`✅ แก้ไขสำเร็จ`);
      cancelEditRow();
      // refresh: snapshot detail + summary + docs cache
      await openItemDetail(itemDetail.item, itemDetail.row);
      fetchData();
      try {
        const sg = itemDetail.item.save_group;
        const r = await fetch(HR_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "payroll_payables", mode: "list_docs", save_group: sg }),
        });
        const d = await r.json();
        setDocsCache(prev => ({ ...prev, [sg]: Array.isArray(d) ? d : [] }));
      } catch { /* ignore */ }
    } catch (e) { alert("❌ แก้ไขไม่สำเร็จ: " + e.message); }
    setSavingEdits(false);
  }

  async function saveItemEdits() {
    if (!itemDetail || !itemDetail.field) return;
    const edits = itemDetail.edits || {};
    const updates = Object.entries(edits)
      .filter(([id, v]) => v !== "" && v != null)
      .map(([id, v]) => ({ snapshot_id: Number(id), value: Number(v) }));
    if (updates.length === 0) { alert("ไม่มีการแก้ไข"); return; }
    setSavingEdits(true);
    try {
      const res = await fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payroll_snapshot", mode: "update_amounts",
          save_group: itemDetail.item.save_group,
          field: itemDetail.field,
          updates,
        }),
      });
      const data = await res.json();
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.error) throw new Error(result.error);
      setMessage(`✅ แก้ไข ${result?.updated_snapshots || 0} รายการ + อัปเดตเอกสาร ${result?.updated_docs || 0} ใบ`);
      // refresh: snapshot detail + summary + docs cache
      await openItemDetail(itemDetail.item, itemDetail.row);
      fetchData();
      // refresh docs cache
      try {
        const sg = itemDetail.item.save_group;
        const r = await fetch(HR_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "payroll_payables", mode: "list_docs", save_group: sg }),
        });
        const d = await r.json();
        setDocsCache(prev => ({ ...prev, [sg]: Array.isArray(d) ? d : [] }));
      } catch { /* ignore */ }
    } catch (e) { alert("❌ บันทึกแก้ไขไม่สำเร็จ: " + e.message); }
    setSavingEdits(false);
  }

  // เปิด popup สลิปเงินเดือนของรอบนี้ (item = แถวเดือน+สังกัด)
  async function openSlipPopup(item) {
    setSlipPopup({ item, loading: true, rows: [] });
    setSlipSending({});
    try {
      const post = body => fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json());

      // 1) snapshot รอบนี้ (รายคน)
      const snaps = await post({ action: "payroll_snapshot", mode: "detail", save_group: item.save_group });
      const mine = (Array.isArray(snaps) ? snaps : []).filter(e => (e.affiliation || "-") === item.affiliation);

      // 2) ข้อมูลพนักงาน: email, รหัส, แผนก, ยอดยกมา (BF)
      const hrArr = await post({ action: "list_hr_employees", include_inactive: "true" });
      const hrMap = {};
      (Array.isArray(hrArr) ? hrArr : []).forEach(h => { hrMap[normName(h.employee_name)] = h; });

      // 3) ยอดสะสมปีนี้จาก snapshot เดือนอื่น
      //    ปี 2026: ยอดยกมา (BF) ครอบคลุมถึง มิ.ย. แล้ว → นับ snapshot เฉพาะ ก.ค. 2026 เป็นต้นไป
      //    ปีถัดไป: นับ snapshot ตั้งแต่ ม.ค. ของปีนั้น (ไม่บวก BF)
      const target = new Date(item.month_year);
      const year = target.getFullYear();
      const startMonth = year === 2026 ? 6 : 0; // 6 = ก.ค.
      const inYtdRange = d => d.getFullYear() === year && d.getMonth() >= startMonth;
      const ytd = {}; // ชื่อ → { income, tax, sso }
      const addYtd = arr => (Array.isArray(arr) ? arr : []).forEach(e => {
        if ((e.affiliation || "-") !== item.affiliation) return;
        const k = normName(e.employee_name);
        if (!ytd[k]) ytd[k] = { income: 0, tax: 0, sso: 0 };
        ytd[k].income += Number(e.total_income || 0);
        ytd[k].tax += Number(e.tax || 0);
        ytd[k].sso += Number(e.sso_amount || 0);
      });
      if (inYtdRange(target)) addYtd(mine); // เดือนนี้นับรวมใน YTD เฉพาะเมื่อพ้นช่วง BF แล้ว
      const allGroups = await post({ action: "payroll_payables", mode: "list_by_affiliation" });
      const others = (Array.isArray(allGroups) ? allGroups : []).filter(g => {
        if (g.affiliation !== item.affiliation || g.save_group === item.save_group) return false;
        const d = new Date(g.month_year);
        return !isNaN(d) && inYtdRange(d) && d < target;
      });
      for (const g of others) {
        addYtd(await post({ action: "payroll_snapshot", mode: "detail", save_group: g.save_group }));
      }

      // 3.5) ค่าคอมมิชั่นสะสม (ไม่รวมค่านายหน้า) — นับงวดค่าคอมถึง "เดือนก่อนหน้า"
      //      เพราะค่าคอมของเดือน M จ่ายต้นเดือน M+1 (หลังเงินเดือนที่จ่าย 25/M)
      //      ปี 2026: BF รวมค่าคอมงวด มิ.ย. (จ่าย 03-07) แล้ว → เริ่มนับงวด ก.ค. เป็นต้นไป
      const commYtd = {};
      const prevMonth = new Date(target.getFullYear(), target.getMonth() - 1, 1);
      const commFrom = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
      const commTo = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`;
      if (prevMonth.getFullYear() === year && prevMonth.getMonth() >= startMonth) {
        try {
          const c = await fetch(SALES_EXTRA_API, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "commission_normal_payables", mode: "ytd_commission", date_from: commFrom, date_to: commTo }),
          }).then(r => r.json());
          (Array.isArray(c) ? c : []).forEach(r => {
            if (r && r.employee_name) commYtd[normName(r.employee_name)] = Number(r.commission_ytd || 0);
          });
        } catch { /* workflow ยังไม่มี mode นี้ → ค่าคอมสะสม = 0 ไปก่อน */ }
      }

      // 4) วันที่จ่ายจริงจากเอกสารเงินเดือนที่จ่ายแล้ว
      const { doc } = getDocStatus(item.save_group, item.affiliation, "salary");
      const paidAt = doc?.paid_at || doc?.paid_date || null;

      const useBf = year === 2026;
      const rows = mine.map(e => {
        const k = normName(e.employee_name);
        const hr = hrMap[k] || {};
        const y = ytd[k] || { income: 0, tax: 0, sso: 0 };
        return {
          snap: e, hr,
          ytdIncome: (useBf ? Number(hr.income_bf || 0) : 0) + y.income + (commYtd[k] || 0),
          ytdTax:    (useBf ? Number(hr.wht_bf || 0) : 0) + y.tax,
          ytdSso:    (useBf ? Number(hr.sso_bf || 0) : 0) + y.sso,
        };
      }).sort((a, b) => String(a.hr.employee_code || "๙๙").localeCompare(String(b.hr.employee_code || "๙๙"), "th"));

      // ประวัติการส่งอีเมลของงวดนี้ (โชว์ ✅ เคยส่งแล้ว)
      const log = await fetchSlipSendLog("salary", slipPeriodLabel(item.month_year));
      const sentLog = {};
      log.forEach(l => { if (l.status === "sent") sentLog[normName(l.employee_name)] = l; });

      setSlipPopup({ item, loading: false, rows, paidAt, sentLog });
    } catch (e) {
      setSlipPopup({ item, loading: false, rows: [], error: e.message });
    }
  }

  async function sendSalarySlipOne(r) {
    if (!r.hr.email || !slipPopup) return;
    const key = normName(r.snap.employee_name);
    setSlipSending(p => ({ ...p, [key]: "sending" }));
    try {
      await sendSlipEmail({
        spec: salarySlipSpec(r, slipPopup.item, slipPopup.paidAt),
        email: r.hr.email,
        slipType: "salary",
        periodLabel: slipPeriodLabel(slipPopup.item.month_year),
        saveGroup: slipPopup.item.save_group,
        sentBy: currentUser?.username || currentUser?.name || "",
        docLabel: "สลิปเงินเดือน",
      });
      setSlipSending(p => ({ ...p, [key]: "sent" }));
    } catch (e) {
      setSlipSending(p => ({ ...p, [key]: "error:" + e.message }));
    }
  }

  async function sendSalarySlipAll() {
    if (!slipPopup) return;
    for (const r of slipPopup.rows) {
      if (r.hr.email) await sendSalarySlipOne(r); // ส่งทีละคน กัน n8n/Gmail โดน rate limit
    }
  }

  async function findDocs(save_group, affiliation, creditorType) {
    const res = await fetch(HR_API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "payroll_payables", mode: "list_docs", save_group }),
    });
    const docs = await res.json();
    const arr = Array.isArray(docs) ? docs : [];
    // คืนทุก document ที่ตรง creditor_type + affiliation (ไม่กรอง status)
    return arr.filter(d =>
      d.payroll_creditor_type === creditorType
      && (d.description || "").includes(`สังกัด ${affiliation}`)
    );
  }

  async function openPayPopup(item, row) {
    setPayPopup({ item, row, doc: null, loading: true, error: null });
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayMethod("โอน");
    setPayAccountId("");
    setPayNote("");
    try {
      const targetType = row.key;
      // 1) หาเอกสารทุกสถานะ
      let docs = await findDocs(item.save_group, item.affiliation, targetType);

      // 2) ถ้าไม่มีเอกสารเลย → สร้าง (idempotent ใน backend แล้ว)
      if (docs.length === 0) {
        const r2 = await fetch(HR_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "payroll_payables", mode: "create",
            save_group: item.save_group,
            doc_date: new Date().toISOString().slice(0, 10),
            created_by: currentUser?.name || currentUser?.username || "system",
          }),
        });
        await r2.json().catch(() => null);
        docs = await findDocs(item.save_group, item.affiliation, targetType);
      }

      // 3) เช็คสถานะ
      const draft = docs.find(d => d.status === "draft");
      const paid = docs.find(d => d.status === "paid");

      if (paid && !draft) {
        setPayPopup({ item, row, doc: null, loading: false, error: `จ่ายไปแล้ว — เลขจ่าย: ${paid.paid_doc_no || "-"}` });
        return;
      }

      if (!draft) {
        setPayPopup({ item, row, doc: null, loading: false, error: "ไม่พบเอกสาร draft — อาจยอด = 0 หรือ error" });
        return;
      }

      setPayPopup({ item, row, doc: draft, loading: false, error: null });
    } catch (e) {
      setPayPopup({ item, row, doc: null, loading: false, error: e.message });
    }
  }

  async function doPay() {
    if (!payPopup?.doc) return;
    if (!payDate) { alert("กรุณากรอกวันที่จ่าย"); return; }
    if (payMethod === "โอน" && !payAccountId) { alert("กรุณาเลือกบัญชีต้นทาง"); return; }
    setPaying(true);
    try {
      // PF/SSO: override_total = ยอดรวม สมทบ + สะสม (2x ของ expense_document ปกติ)
      // เพื่อให้ bank movement สะท้อนยอดโอนจริง (สมทบ+สะสมรวมกัน)
      const overrideTotal = (payPopup.row?.key === "pf" || payPopup.row?.key === "sso")
        ? Number(payPopup.row.amt || 0)  // amt = total × 2 อยู่แล้ว
        : null;
      const res = await fetch(ACC_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "expense_record",
          op: "save_payment",
          expense_doc_ids: [payPopup.doc.expense_doc_id],
          paid_date: payDate,
          payment_method: payMethod,
          payment_note: payNote,
          paid_by: currentUser?.name || currentUser?.username || "system",
          from_bank_account_id: payMethod === "โอน" ? Number(payAccountId) : null,
          override_total: overrideTotal,
        }),
      });
      const data = await res.json();
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.error_msg) throw new Error(result.error_msg);
      const paidDocNo = result?.paid_doc_no || "";

      // ถ้าเป็นแถว PF (กองทุนๆ) — บันทึกค่าใช้จ่ายเงินสมทบบริษัทเพิ่มเข้าตาราง pf_company_contributions
      if (payPopup.row?.key === "pf" && paidDocNo) {
        const empAmt = Number(payPopup.item.total_pf || 0);
        const compAmt = empAmt;  // บริษัทสมทบเท่ากับพนักงาน
        const totalAmt = empAmt + compAmt;
        try {
          await fetch(ACC_API, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "save_pf_company_contribution",
              month_year: payPopup.item.month_year,
              affiliation: payPopup.item.affiliation,
              employee_amount: empAmt,
              company_amount: compAmt,
              total_amount: totalAmt,
              paid_doc_no: paidDocNo,
              paid_date: payDate,
              paid_by: currentUser?.name || currentUser?.username || "system",
              payment_method: payMethod,
              from_bank_account_id: payMethod === "โอน" ? Number(payAccountId) : null,
              note: `เงินสมทบกองทุนสำรองเลี้ยงชีพ (ส่วนบริษัท) ${payPopup.item.affiliation}`,
            }),
          });
        } catch (e) { console.error("save_pf_company_contribution failed:", e); }
      }

      setMessage(`✅ บันทึกจ่ายสำเร็จ — เลขจ่าย: ${paidDocNo || "-"}`);
      setPayPopup(null);
      // refresh docs cache for this save_group
      try {
        const sg = payPopup.item.save_group;
        const r = await fetch(HR_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "payroll_payables", mode: "list_docs", save_group: sg }),
        });
        const docs = await r.json();
        setDocsCache(prev => ({ ...prev, [sg]: Array.isArray(docs) ? docs : [] }));
      } catch { /* ignore */ }
      fetchData();
    } catch (e) { alert("❌ บันทึกจ่ายไม่สำเร็จ: " + e.message); }
    setPaying(false);
  }

  async function openDetail(item) {
    setDetail({ item, docs: [], loading: true });
    try {
      const res = await fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_payables", mode: "list_docs", save_group: item.save_group }),
      });
      const data = await res.json();
      setDetail({ item, docs: Array.isArray(data) ? data : [], loading: false });
    } catch (e) {
      setDetail({ item, docs: [], loading: false, error: e.message });
    }
  }

  async function cancelAll(item) {
    if (!window.confirm(`ยกเลิกการตั้งจ่ายทั้งหมดของเดือน ${monthDisplay(item.month_year)}?\n\n⚠️ จะลบเอกสารที่ยังเป็น draft/cancelled ทั้งหมด\nเอกสารที่จ่ายแล้ว (paid) จะคงอยู่ — ถ้ามี การยกเลิกจะล้มเหลว`)) return;
    try {
      const res = await fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_payables", mode: "cancel_all", save_group: item.save_group }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      if (arr[0]?.error) { alert("❌ " + arr[0].error); return; }
      setMessage(`✅ ยกเลิกแล้ว ${arr[0]?.deleted_count || 0} เอกสาร`);
      setDetail(null);
      fetchData();
    } catch (e) { alert("❌ " + e.message); }
  }

  const creditorLabel = { salary: "เงินเดือนพนักงาน", sso: "ประกันสังคม", tax: "สรรพากร", pf: "กองทุนสำรองฯ", loan: "กยศ." };
  const statusLabel = { draft: "🟡 รอจ่าย", paid: "🟢 จ่ายแล้ว", cancelled: "🔴 ยกเลิก" };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📊 สรุปรายการเงินเดือน</h2>
      </div>

      {message && <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#dcfce7" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: "2px solid #e5e7eb" }}>
        {[["summary", "📊 สรุปรายการเงินเดือน"], ["payment", "💸 บันทึกจ่าย"], ["history", "📜 ประวัติการจ่าย"]].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ padding: "10px 22px", border: "none", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 600,
              color: tab === v ? "#072d6b" : "#6b7280",
              borderBottom: tab === v ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <div style={{ color: "#072d6b", fontSize: 14, fontWeight: 700 }}>
          {tab === "summary" ? "📊 สรุปรายการเงินเดือน — แยกตามสังกัด"
           : tab === "payment" ? "💸 บันทึกจ่าย"
           : "📜 ประวัติการจ่าย"}
        </div>
        <span style={{ marginLeft: 14, fontSize: 13, fontWeight: 600 }}>กรองเดือน:</span>
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
          style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }} />
        {monthFilter && (
          <button onClick={() => setMonthFilter("")} style={{ padding: "5px 10px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
            ✕ ล้าง
          </button>
        )}
        <div style={{ marginLeft: "auto" }}>
          <button onClick={fetchData} disabled={loading}
            style={{ padding: "6px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* SUMMARY TAB */}
      {tab === "summary" && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
          {loading ? <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
          : created.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีการตั้งจ่าย</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>เดือน</th>
                  <th style={th}>สังกัด</th>
                  <th style={th}>รายการ</th>
                  <th style={{ ...th, textAlign: "right" }}>คน</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอด</th>
                  <th style={{ ...th, textAlign: "center" }}>สถานะจ่าย</th>
                  <th style={{ ...th, textAlign: "center" }}>ดู</th>
                </tr>
              </thead>
              <tbody>
                {created.flatMap((it, i) => {
                  const items = [
                    { key: "salary", label: "เงินเดือนสุทธิ", amt: it.total_net_income, color: "#1e40af" },
                    { key: "tax", label: "ภงด.1 (ภาษี)", amt: it.total_tax, color: "#dc2626" },
                    { key: "sso", label: "ประกันสังคม", amt: Number(it.total_sso || 0) * 2, color: "#dc2626" },
                    { key: "pf", label: "กองทุนฯ", amt: Number(it.total_pf || 0) * 2, color: "#dc2626" },
                    { key: "loan", label: "กยศ.", amt: it.total_loan, color: "#dc2626" },
                    { key: "admin", label: "ผู้บริหาร", amt: it.total_admin, color: "#dc2626" },
                    { key: "lost", label: "ของหาย", amt: it.total_lost, color: "#dc2626" },
                    { key: "other", label: "อื่นๆ", amt: it.total_other, color: "#dc2626" },
                  ].filter(x => Number(x.amt || 0) > 0);
                  return items.map((row, j) => {
                    const { status, doc } = getDocStatus(it.save_group, it.affiliation, row.key);
                    return (
                      <tr key={`${it.save_group}-${it.affiliation}-${row.key}`}
                        style={{ borderTop: j === 0 ? "2px solid #072d6b" : "1px solid #e5e7eb", background: status === "paid" ? "#ecfdf5" : undefined }}>
                        {j === 0 && (
                          <>
                            <td rowSpan={items.length} style={{ ...td, fontWeight: 700, color: "#072d6b", verticalAlign: "top" }}>{monthDisplay(it.month_year)}</td>
                            <td rowSpan={items.length} style={{ ...td, fontWeight: 700, verticalAlign: "top" }}>{it.affiliation}</td>
                          </>
                        )}
                        <td style={{ ...td, fontWeight: row.key === "salary" ? 700 : 500, color: "#111", textAlign: "left" }}>
                          <span style={{ cursor: "pointer" }} onClick={() => openItemDetail(it, row)} title="ดูรายละเอียดรายคน">{row.label}</span>
                        </td>
                        {j === 0 && (
                          <td rowSpan={items.length} style={{ ...td, textAlign: "right", verticalAlign: "top" }}>{it.employee_count}</td>
                        )}
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: row.color }}>{fmtN(row.amt)}</td>
                        <td style={{ ...td, textAlign: "center", fontSize: 11 }}>
                          {status === "paid" ? (
                            <div>
                              <span style={{ padding: "2px 8px", background: "#10b981", color: "#fff", borderRadius: 8, fontWeight: 600 }}>🟢 จ่ายแล้ว</span>
                              {doc?.paid_doc_no && <div style={{ marginTop: 2, color: "#065f46", fontFamily: "monospace", fontSize: 10 }}>{doc.paid_doc_no}</div>}
                            </div>
                          ) : status === "draft" ? (
                            <span style={{ color: "#f59e0b", fontWeight: 600 }}>🟡 รอจ่าย</span>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>—</span>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <button onClick={() => openItemDetail(it, row)}
                            style={{ padding: "4px 10px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
                            👁️ ดู
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* PAYMENT TAB */}
      {tab === "payment" && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
          {loading ? <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
          : created.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีรายการที่ต้องจ่าย</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>เดือน</th>
                  <th style={th}>สังกัด</th>
                  <th style={th}>รายการ</th>
                  <th style={{ ...th, textAlign: "right" }}>คน</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอด</th>
                  <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
                  <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {created.flatMap((it, i) => {
                  const items = [
                    { key: "salary", label: "เงินเดือนสุทธิ", amt: it.total_net_income, color: "#1e40af" },
                    { key: "tax", label: "ภงด.1 (ภาษี)", amt: it.total_tax, color: "#dc2626" },
                    { key: "sso", label: "ประกันสังคม", amt: Number(it.total_sso || 0) * 2, color: "#dc2626" },
                    { key: "pf", label: "กองทุนฯ", amt: Number(it.total_pf || 0) * 2, color: "#dc2626" },
                    { key: "loan", label: "กยศ.", amt: it.total_loan, color: "#dc2626" },
                    { key: "admin", label: "ผู้บริหาร", amt: it.total_admin, color: "#dc2626" },
                    { key: "lost", label: "ของหาย", amt: it.total_lost, color: "#dc2626" },
                    { key: "other", label: "อื่นๆ", amt: it.total_other, color: "#dc2626" },
                  ].filter(x => Number(x.amt || 0) > 0);
                  return items.map((row, j) => {
                    const { status, doc } = getDocStatus(it.save_group, it.affiliation, row.key);
                    return (
                      <tr key={`pay-${it.save_group}-${it.affiliation}-${row.key}`}
                        style={{ borderTop: j === 0 ? "2px solid #072d6b" : "1px solid #e5e7eb", background: status === "paid" ? "#ecfdf5" : undefined }}>
                        {j === 0 && (
                          <>
                            <td rowSpan={items.length} style={{ ...td, fontWeight: 700, color: "#072d6b", verticalAlign: "top" }}>{monthDisplay(it.month_year)}</td>
                            <td rowSpan={items.length} style={{ ...td, fontWeight: 700, verticalAlign: "top" }}>{it.affiliation}</td>
                          </>
                        )}
                        <td style={{ ...td, fontWeight: row.key === "salary" ? 700 : 500, color: "#111", textAlign: "left" }}>{row.label}</td>
                        {j === 0 && (
                          <td rowSpan={items.length} style={{ ...td, textAlign: "right", verticalAlign: "top" }}>{it.employee_count}</td>
                        )}
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: row.color }}>{fmtN(row.amt)}</td>
                        <td style={{ ...td, textAlign: "center", fontSize: 11 }}>
                          {status === "paid" ? (
                            <span style={{ padding: "2px 8px", background: "#10b981", color: "#fff", borderRadius: 8, fontWeight: 600 }}>🟢 จ่ายแล้ว</span>
                          ) : (
                            <span style={{ color: "#f59e0b", fontWeight: 600 }}>🟡 รอจ่าย</span>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          {status === "paid" ? (
                            row.key === "salary" ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
                                <span style={{ fontSize: 11, color: "#065f46", fontFamily: "monospace" }}>{doc?.paid_doc_no || "-"}</span>
                                <button onClick={() => openSlipPopup(it)}
                                  style={{ padding: "4px 12px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                                  🧾 สลิปเงินเดือน
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: "#065f46", fontFamily: "monospace" }}>{doc?.paid_doc_no || "-"}</span>
                            )
                          ) : row.key === "tax" ? (
                            <span title="ภงด.1 ย้ายไปจ่ายที่เมนู 'บันทึกจ่ายเงินภาษีสรรพากร' → ภ.ง.ด.1"
                              style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>→ จ่ายที่เมนูภาษีสรรพากร</span>
                          ) : (
                            <button onClick={() => openPayPopup(it, row)}
                              style={{ padding: "5px 14px", background: "#10b981", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                              💸 บันทึกจ่าย
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ITEM DETAIL POPUP — แสดงรายชื่อพนักงาน + แก้ไขยอด (เฉพาะก่อนจ่าย) */}
      {itemDetail && (() => {
        const isPaid = isCreditorPaid(itemDetail.item, itemDetail.row);
        const editedTotal = itemDetail.employees.reduce((s, e) => {
          const id = e.snapshot_id || e.employee_id;
          const editVal = itemDetail.edits?.[id];
          const v = editVal !== undefined && editVal !== "" ? Number(editVal) : Number(e[itemDetail.field] || 0);
          return s + v;
        }, 0);
        const hasChanges = Object.keys(itemDetail.edits || {}).length > 0;
        return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          onClick={() => !savingEdits && setItemDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 760, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>👁️ {itemDetail.row.label} — รายคน {isPaid && <span style={{ marginLeft: 8, padding: "2px 8px", background: "#10b981", color: "#fff", borderRadius: 8, fontSize: 12 }}>🔒 จ่ายแล้ว</span>}</h3>
              <button onClick={() => setItemDetail(null)} disabled={savingEdits} style={{ padding: "5px 12px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>ปิด</button>
            </div>
            <div style={{ marginBottom: 14, fontSize: 13, color: "#6b7280" }}>
              เดือน {monthDisplay(itemDetail.item.month_year)} • สังกัด <strong>{itemDetail.item.affiliation}</strong>
              {!isPaid && <span style={{ marginLeft: 12, color: "#0369a1" }}>✏️ แก้ไขยอดได้</span>}
            </div>

            {itemDetail.loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div>
            : itemDetail.error ? <div style={{ padding: 12, background: "#fef2f2", color: "#991b1b", borderRadius: 6 }}>{itemDetail.error}</div>
            : itemDetail.employees.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีพนักงานที่{itemDetail.row.key === "salary" ? "ได้รับ" : "ถูกหัก"}รายการนี้</div>
            : (
              <>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#072d6b", color: "#fff" }}>
                  <tr>
                    <th style={{ ...th, width: 40 }}>#</th>
                    <th style={th}>พนักงาน</th>
                    <th style={th}>ตำแหน่ง</th>
                    <th style={{ ...th, textAlign: "right" }}>ยอดพนักงาน</th>
                    {(itemDetail.row.key === "pf" || itemDetail.row.key === "sso") && <th style={{ ...th, textAlign: "right", background: "#065f46" }}>เงินสมทบบริษัท</th>}
                    {!isPaid && <th style={{ ...th, textAlign: "center", width: 140 }}>จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {itemDetail.employees.map((e, i) => {
                    const id = e.snapshot_id || e.employee_id;
                    const orig = Number(e[itemDetail.field] || 0);
                    const isEditing = editingId === id;
                    return (
                      <tr key={id || i} style={{ borderTop: "1px solid #e5e7eb", background: isEditing ? "#fef9c3" : undefined }}>
                        <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{e.employee_name}</td>
                        <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{e.position || "-"}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {isEditing ? (
                            <input type="number" value={editingValue} step="0.01" autoFocus
                              onChange={ev => setEditingValue(ev.target.value)}
                              onKeyDown={ev => { if (ev.key === "Enter") saveEditRow(); if (ev.key === "Escape") cancelEditRow(); }}
                              style={{ width: 130, padding: "4px 8px", border: "2px solid #f59e0b", borderRadius: 4, textAlign: "right", fontSize: 13, fontFamily: "monospace", color: itemDetail.row.color, fontWeight: 700, background: "#fff" }} />
                          ) : (
                            <span style={{ fontWeight: 700, color: itemDetail.row.color }}>{fmtN(orig)}</span>
                          )}
                        </td>
                        {(itemDetail.row.key === "pf" || itemDetail.row.key === "sso") && (
                          <td style={{ ...td, textAlign: "right", background: "#ecfdf5" }}>
                            <span style={{ fontWeight: 700, color: "#065f46" }}>{fmtN(orig)}</span>
                          </td>
                        )}
                        {!isPaid && (
                          <td style={{ ...td, textAlign: "center" }}>
                            {isEditing ? (
                              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                <button onClick={saveEditRow} disabled={savingEdits}
                                  style={{ padding: "4px 10px", background: savingEdits ? "#9ca3af" : "#10b981", color: "#fff", border: "none", borderRadius: 4, cursor: savingEdits ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 600 }}>
                                  {savingEdits ? "..." : "💾 บันทึก"}
                                </button>
                                <button onClick={cancelEditRow} disabled={savingEdits}
                                  style={{ padding: "4px 10px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
                                  ยกเลิก
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => startEditRow(id, orig)} disabled={editingId !== null}
                                style={{ padding: "4px 12px", background: editingId !== null ? "#e5e7eb" : "#0891b2", color: editingId !== null ? "#9ca3af" : "#fff", border: "none", borderRadius: 4, cursor: editingId !== null ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 600 }}>
                                ✏️ แก้
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
                  <tr>
                    <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม {itemDetail.employees.length} คน</td>
                    <td style={{ ...td, textAlign: "right", color: itemDetail.row.color }}>
                      {fmtN(itemDetail.employees.reduce((s, e) => s + Number(e[itemDetail.field] || 0), 0))}
                    </td>
                    {(itemDetail.row.key === "pf" || itemDetail.row.key === "sso") && (
                      <td style={{ ...td, textAlign: "right", background: "#d1fae5", color: "#065f46" }}>
                        {fmtN(itemDetail.employees.reduce((s, e) => s + Number(e[itemDetail.field] || 0), 0))}
                      </td>
                    )}
                    {!isPaid && <td></td>}
                  </tr>
                  {(itemDetail.row.key === "pf" || itemDetail.row.key === "sso") && (
                    <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                      <td colSpan={3} style={{ ...td, textAlign: "right", color: "#92400e" }}>💰 ยอดสมทบรวมทั้งบริษัท (พนักงาน + บริษัท)</td>
                      <td colSpan={2} style={{ ...td, textAlign: "right", color: "#92400e", fontSize: 15 }}>
                        {fmtN(itemDetail.employees.reduce((s, e) => s + Number(e[itemDetail.field] || 0), 0) * 2)}
                      </td>
                      {!isPaid && <td></td>}
                    </tr>
                  )}
                </tfoot>
              </table>
              </>
            )}
          </div>
        </div>
        );
      })()}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
          {loading ? <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
          : paymentHistory.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีประวัติการจ่าย</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>วันที่จ่าย</th>
                  <th style={th}>เลขจ่าย</th>
                  <th style={th}>เลขเอกสาร</th>
                  <th style={th}>เดือน</th>
                  <th style={th}>สังกัด</th>
                  <th style={th}>ประเภท</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอด</th>
                  <th style={th}>วิธีจ่าย</th>
                  <th style={th}>บัญชีต้นทาง</th>
                  <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map(p => (
                  <tr key={p.expense_doc_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{p.paid_at ? new Date(p.paid_at).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#10b981" }}>{p.paid_doc_no}</td>
                    <td style={{ ...td, fontFamily: "monospace", color: "#072d6b" }}>{p.expense_doc_no}</td>
                    <td style={{ ...td, fontWeight: 600, color: "#072d6b" }}>{monthDisplay(p.month_year)}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{p.affiliation || "-"}</td>
                    <td style={td}>{p.vendor_name}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{fmtN(p.total)}</td>
                    <td style={{ ...td, fontSize: 12 }}>{p.payment_method || "-"}</td>
                    <td style={{ ...td, fontSize: 11 }}>
                      {p.from_bank_account_id ? <><strong>{p.bank_name}</strong> {p.account_no}</> : "-"}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <button onClick={() => cancelPayment(p)}
                        style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        ✕ ยกเลิก
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: "right" }}>รวม {paymentHistory.length} รายการ</td>
                  <td style={{ ...td, textAlign: "right", color: "#dc2626" }}>{fmtN(paymentHistory.reduce((s, p) => s + Number(p.total || 0), 0))}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* PAYSLIP POPUP */}
      {slipPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          onClick={() => setSlipPopup(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 780, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>🧾 สลิปเงินเดือน — {monthDisplay(slipPopup.item.month_year)} · {slipPopup.item.affiliation}</h3>
              <button onClick={() => setSlipPopup(null)} style={{ padding: "5px 12px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>ปิด</button>
            </div>
            <div style={{ marginBottom: 12, fontSize: 12, color: "#6b7280" }}>
              รอบ {slipPeriodLabel(slipPopup.item.month_year)} · วันที่ชำระ {slipDateLabel(slipPopup.paidAt)}
            </div>

            {slipPopup.loading ? <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลดข้อมูลสลิป (รวมยอดสะสม)...</div>
            : slipPopup.error ? <div style={{ padding: 12, background: "#fef2f2", color: "#991b1b", borderRadius: 6 }}>❌ {slipPopup.error}</div>
            : slipPopup.rows.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่พบข้อมูลพนักงานในรอบนี้</div>
            : (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button onClick={() => printSalarySlips(slipPopup.rows, slipPopup.item, slipPopup.paidAt)}
                    style={{ padding: "8px 18px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    🖨️ พิมพ์สลิปทั้งหมด ({slipPopup.rows.length} คน)
                  </button>
                  <button onClick={sendSalarySlipAll}
                    disabled={Object.values(slipSending).some(v => v === "sending")}
                    style={{ padding: "8px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    📧 ส่งอีเมลทั้งหมด ({slipPopup.rows.filter(r => r.hr.email).length} คนที่มีอีเมล)
                  </button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: "#072d6b", color: "#fff" }}>
                    <tr>
                      <th style={{ ...th, width: 34 }}>#</th>
                      <th style={th}>รหัส</th>
                      <th style={th}>พนักงาน</th>
                      <th style={th}>อีเมล</th>
                      <th style={{ ...th, textAlign: "right" }}>สุทธิ</th>
                      <th style={{ ...th, textAlign: "right" }}>เงินได้สะสม</th>
                      <th style={{ ...th, textAlign: "center", width: 170 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {slipPopup.rows.map((r, i) => {
                      const key = normName(r.snap.employee_name);
                      const st = slipSending[key];
                      const prev = slipPopup.sentLog?.[key];
                      return (
                      <tr key={r.snap.snapshot_id || i} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.hr.employee_code || "-"}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{r.snap.employee_name}</td>
                        <td style={{ ...td, fontSize: 11 }}>
                          {r.hr.email
                            ? <span style={{ color: "#0369a1" }}>{r.hr.email}</span>
                            : <span style={{ color: "#dc2626" }}>— ไม่มีอีเมล —</span>}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#1e40af" }}>{fmtN(r.snap.net_income)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmtN(r.ytdIncome)}</td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <button onClick={() => printSalarySlips([r], slipPopup.item, slipPopup.paidAt)}
                            style={{ padding: "4px 10px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600, marginRight: 4 }}>
                            🖨️
                          </button>
                          {st === "sending" ? (
                            <span style={{ fontSize: 11, color: "#92400e" }}>⏳ กำลังส่ง...</span>
                          ) : st === "sent" ? (
                            <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>✅ ส่งแล้ว</span>
                          ) : st && st.startsWith("error:") ? (
                            <button onClick={() => sendSalarySlipOne(r)} title={st.slice(6)}
                              style={{ padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                              ❌ ส่งซ้ำ
                            </button>
                          ) : r.hr.email ? (
                            <button onClick={() => sendSalarySlipOne(r)}
                              style={{ padding: "4px 10px", background: "#059669", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                              📧 ส่ง
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>—</span>
                          )}
                          {prev && !st && (
                            <div style={{ fontSize: 9, color: "#059669" }}>เคยส่ง {new Date(prev.sent_at).toLocaleDateString("th-TH")}</div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
                    <tr>
                      <td colSpan={4} style={{ ...td, textAlign: "right" }}>รวม {slipPopup.rows.length} คน</td>
                      <td style={{ ...td, textAlign: "right", color: "#1e40af" }}>{fmtN(slipPopup.rows.reduce((s, r) => s + Number(r.snap.net_income || 0), 0))}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </div>
        </div>
      )}

      {/* PAY POPUP */}
      {payPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ background: "#fff", padding: 22, borderRadius: 12, width: 520, maxWidth: "94vw" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b", textAlign: "center" }}>💸 บันทึกจ่ายเงิน</h3>

            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
              <div style={{ marginBottom: 4 }}>📋 <strong>{payPopup.row.label}</strong></div>
              <div style={{ color: "#6b7280", marginBottom: 4 }}>เดือน {monthDisplay(payPopup.item.month_year)} · สังกัด <strong>{payPopup.item.affiliation}</strong></div>
              <div style={{ textAlign: "center", marginTop: 8, fontSize: 18, color: "#dc2626", fontWeight: 700 }}>
                💰 ยอดสุทธิ: ฿{fmtN(payPopup.row.amt)}
              </div>
            </div>

            {payPopup.loading ? (
              <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>กำลังโหลดเอกสาร...</div>
            ) : payPopup.error ? (
              <div style={{ padding: 12, background: "#fef2f2", color: "#991b1b", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>❌ {payPopup.error}</div>
            ) : (
              <>
                <div style={{ marginBottom: 10, padding: "6px 10px", background: "#eff6ff", borderRadius: 6, fontSize: 12, color: "#1e40af" }}>
                  📄 เอกสาร: <strong>{payPopup.doc.expense_doc_no}</strong>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>วันที่จ่าย *</label>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>วิธีจ่าย</label>
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={inp}>
                      <option value="โอน">โอน</option>
                      <option value="เงินสด">เงินสด</option>
                      <option value="เช็ค">เช็ค</option>
                    </select>
                  </div>
                </div>

                {payMethod === "โอน" && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={lbl}>โอนจาก (บัญชีบริษัท) *</label>
                    <select value={payAccountId} onChange={e => setPayAccountId(e.target.value)} style={inp}>
                      <option value="">-- เลือกบัญชี --</option>
                      {bankAccounts.map(b => (
                        <option key={b.account_id} value={b.account_id}>
                          {b.bank_name} {b.account_no} — {b.account_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>หมายเหตุ</label>
                  <textarea value={payNote} onChange={e => setPayNote(e.target.value)} rows={2}
                    style={{ ...inp, resize: "vertical" }} />
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setPayPopup(null)} disabled={paying}
                style={{ padding: "9px 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>
                ยกเลิก
              </button>
              <button onClick={doPay} disabled={paying || !payPopup.doc || !!payPopup.error}
                style={{ padding: "9px 18px", background: (paying || !payPopup.doc) ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 6, cursor: (paying || !payPopup.doc) ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700 }}>
                {paying ? "กำลังบันทึก..." : "💾 บันทึกจ่ายเงิน"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL POPUP */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 900, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 รายการเอกสารเจ้าหนี้ {monthDisplay(detail.item.month_year)}</h3>
              <button onClick={() => cancelAll(detail.item)} disabled={detail.item.paid_count > 0 || detail.item.is_locked}
                title={detail.item.is_locked ? "snapshot ถูกล็อก ยกเลิกไม่ได้" : detail.item.paid_count > 0 ? "มีเอกสารที่จ่ายแล้ว ยกเลิกทั้งหมดไม่ได้" : "ยกเลิกการตั้งจ่ายทั้งหมด"}
                style={{ padding: "6px 14px", background: (detail.item.paid_count > 0 || detail.item.is_locked) ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: (detail.item.paid_count > 0 || detail.item.is_locked) ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}>
                🗑️ ยกเลิกทั้งหมด
              </button>
            </div>
            {detail.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div>
            : detail.docs.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีเอกสาร</div>
            : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 12 }}>
                <thead style={{ background: "#f3f4f6" }}>
                  <tr>
                    <th style={th2}>เลขที่</th>
                    <th style={th2}>ประเภท</th>
                    <th style={th2}>เจ้าหนี้</th>
                    <th style={th2}>รายละเอียด</th>
                    <th style={{ ...th2, textAlign: "right" }}>ยอด</th>
                    <th style={th2}>บัญชีจ่าย</th>
                    <th style={th2}>สถานะ</th>
                    <th style={th2}>เลขจ่าย</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.docs.map(d => (
                    <tr key={d.expense_doc_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ ...td2, fontFamily: "monospace", fontWeight: 700, color: "#072d6b" }}>{d.expense_doc_no}</td>
                      <td style={td2}>{creditorLabel[d.payroll_creditor_type] || d.payroll_creditor_type}</td>
                      <td style={td2}>{d.vendor_name}</td>
                      <td style={{ ...td2, fontSize: 11, color: "#6b7280" }}>{d.description}</td>
                      <td style={{ ...td2, textAlign: "right", fontWeight: 700 }}>{fmtN(d.total)}</td>
                      <td style={{ ...td2, fontSize: 11 }}>
                        {d.from_bank_account_id ? <><strong>{d.bank_name}</strong> {d.account_no}</> : <span style={{ color: "#dc2626" }}>—</span>}
                      </td>
                      <td style={td2}>{statusLabel[d.status] || d.status}</td>
                      <td style={{ ...td2, fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{d.paid_doc_no || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: 14, padding: "8px 12px", background: "#eff6ff", color: "#1e40af", borderRadius: 6, fontSize: 12 }}>
              💡 บันทึกตัดบัญชี (จ่ายเงินจริง) ทำที่หน้า <strong>"บันทึกค่าใช้จ่าย"</strong> (กลุ่ม Accounting) — เอกสารเหล่านี้จะอยู่ในรายการ status = draft
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setDetail(null)} style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const inp = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const td = { padding: "8px", whiteSpace: "nowrap" };
const th2 = { padding: "8px 6px", textAlign: "left", whiteSpace: "nowrap", fontWeight: 700, color: "#374151" };
const td2 = { padding: "6px 6px", whiteSpace: "nowrap" };
