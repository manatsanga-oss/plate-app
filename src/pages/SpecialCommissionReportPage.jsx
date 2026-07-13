import React, { useEffect, useState } from "react";
import { TH_MONTHS, SLIP_COMPANY, slipDateLabel, printSlips, sendSlipEmail, fetchSlipSendLog } from "../lib/payslip";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/sales-extra-pay-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const HR_API = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

async function postAPI(body) {
  const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

export default function SpecialCommissionReportPage({ currentUser }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [branchFilter, setBranchFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState(null); // {employee, rows, loading}
  const [excludedSet, setExcludedSet] = useState(new Set()); // sale_ids ที่ user มี draft ติ๊กไว้
  const [initialExcludedSet, setInitialExcludedSet] = useState(new Set()); // snapshot ตอน load detail
  const [savingExcl, setSavingExcl] = useState(false);
  // ===== Snapshot (บันทึกรอบจ่าย) =====
  const [snapshotInfo, setSnapshotInfo] = useState(null); // {save_group, saved_at, saved_by, row_count}
  const [savingSnap, setSavingSnap] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [snapDetail, setSnapDetail] = useState(null); // {save_group, rows, loading}
  // ===== Payables (บันทึกการจ่ายเงิน — สร้าง expense_documents 4 ใบ) =====
  const [payOpen, setPayOpen] = useState(false); // modal
  const [payPreview, setPayPreview] = useState([]);
  const [payDocs, setPayDocs] = useState([]);
  const [payLoading, setPayLoading] = useState(false);
  const [payCreating, setPayCreating] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState(new Set()); // group_no ที่ติ๊ก
  // ===== Pay (บันทึกการจ่ายเงินจริง = mark expense_doc as paid) =====
  const [bankAccounts, setBankAccounts] = useState([]);
  const [payPopup, setPayPopup] = useState(null); // {doc}
  const [payDate, setPayDate] = useState(todayISO());
  const [payMethod, setPayMethod] = useState("โอน");
  const [payAccountId, setPayAccountId] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    // โหลด bank accounts ครั้งเดียว
    fetch(ACC_API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_bank_accounts" }),
    }).then(r => r.json()).then(d => {
      setBankAccounts(Array.isArray(d) ? d.filter(a => a && (a.account_id || a.bank_account_id)) : []);
    }).catch(() => setBankAccounts([]));
  }, []);

  async function checkSnapshot() {
    try {
      const data = await postAPI({ action: "commission_snapshot", mode: "check", date_from: dateFrom, date_to: dateTo, branch_code: branchFilter, brand: brandFilter });
      const arr = Array.isArray(data) ? data : [];
      setSnapshotInfo(arr.length > 0 && arr[0]?.save_group ? arr[0] : null);
    } catch { setSnapshotInfo(null); }
  }

  // ===== แก้ไขยอดรายคน (คลิกที่ตัวเลข ค่าคอมมิชชั่น/ค่านายหน้า) =====
  const [adjustments, setAdjustments] = useState([]); // รายการปรับยอดของ snapshot ปัจจุบัน
  const [editCell, setEditCell] = useState(null); // { employee_id, col }
  const [editValue, setEditValue] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);

  async function fetchAdjustments(saveGroup) {
    if (!saveGroup) { setAdjustments([]); return; }
    try {
      const data = await postAPI({ action: "commission_payables", mode: "list_adjustments", save_group: saveGroup });
      setAdjustments(Array.isArray(data) ? data.filter(a => a && a.adjustment_id) : []);
    } catch { setAdjustments([]); }
  }
  useEffect(() => { fetchAdjustments(snapshotInfo?.save_group); /* eslint-disable-next-line */ }, [snapshotInfo?.save_group]);

  // แผนที่กลุ่มเอกสารจ่าย (ต้องตรง MAP ใน workflow commission_payables)
  const ADJ_GROUP_NO = { "ป.เปา|ฮอนด้า": 1, "ป.เปา|ยามาฮ่า": 2, "สิงห์ชัย|ฮอนด้า": 3, "สิงห์ชัย|ยามาฮ่า": 4 };
  const ADJ_BRANCH_AFF = { SCY01: "สิงห์ชัย", SCY04: "สิงห์ชัย", SCY07: "สิงห์ชัย", SCY05: "ป.เปา", SCY06: "ป.เปา" };
  const ADJ_OWN_BRAND = { "ป.เปา": "ฮอนด้า", "สิงห์ชัย": "ยามาฮ่า" };

  function resolveAdjTarget(r, colKey) {
    const affiliation = ADJ_BRANCH_AFF[r.branch_code];
    if (!affiliation) return null;
    const own = ADJ_OWN_BRAND[affiliation];
    const brand = colKey === "commission" ? own : (own === "ฮอนด้า" ? "ยามาฮ่า" : "ฮอนด้า");
    return { affiliation, brand, group_no: ADJ_GROUP_NO[`${affiliation}|${brand}`] };
  }

  // overlay ปรับยอดลงบนแถว (key = employee_name เหมือน backend)
  const adjByEmp = {};
  for (const a of adjustments) (adjByEmp[a.employee_name] = adjByEmp[a.employee_name] || {})[a.col_key] = a;
  const effOf = (r, colKey) => {
    const a = adjByEmp[r.employee_name]?.[colKey];
    const base = Number(colKey === "commission" ? r.commission_amount : r.brokerage_amount) || 0;
    return a ? Number(a.new_amount) : base;
  };

  // ===== สลิปค่าคอมพิเศษ (เฉพาะค่าคอมมิชชั่น ไม่รวมค่านายหน้า) =====
  const [commSlip, setCommSlip] = useState(null); // { loading, rows, paidAt, periodLabel, year, sentLog, error }
  const [slipSending, setSlipSending] = useState({}); // ชื่อ → 'sending' | 'sent' | 'error:...'
  const slipNorm = s => String(s || "").trim().replace(/\s+/g, " ");

  function slipPeriodLabel(from, to) {
    const f = new Date(from), t = new Date(to);
    if (isNaN(f) || isNaN(t)) return `${from || "-"} - ${to || "-"}`;
    const dd = d => String(d.getDate()).padStart(2, "0");
    if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) {
      return `${dd(f)}-${dd(t)} ${TH_MONTHS[t.getMonth()]} ${t.getFullYear()}`;
    }
    return `${dd(f)} ${TH_MONTHS[f.getMonth()]} - ${dd(t)} ${TH_MONTHS[t.getMonth()]} ${t.getFullYear()}`;
  }

  async function openCommSlipPopup() {
    setCommSlip({ loading: true, rows: [] });
    try {
      const postHR = body => fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json());

      const target = new Date(dateFrom);
      const year = target.getFullYear();
      const startMonth = year === 2026 ? 6 : 0; // ปี 2026 เริ่มนับหลังยอดยกมา (ก.ค.); ปีอื่นนับจาก ม.ค.
      const periodMonthFirst = new Date(year, target.getMonth(), 1);
      const ytdFrom = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
      const ytdTo = `${year}-${String(target.getMonth() + 1).padStart(2, "0")}-01`;

      // 1) รายชื่อ + ยอดค่าคอมมิชชั่นรอบนี้ (รวมยอดที่แก้ ✏️ แล้ว)
      const rowsBase = rows
        .map(r => ({ name: r.employee_name, branch_code: r.branch_code, commission: effOf(r, "commission") }))
        .filter(r => r.commission > 0);

      // 2) ข้อมูลพนักงาน (email, รหัส, แผนก, บัญชี, ยอดยกมา)
      const hrArr = await postHR({ action: "list_hr_employees", include_inactive: "true" });
      const hrMap = {};
      (Array.isArray(hrArr) ? hrArr : []).forEach(h => { hrMap[slipNorm(h.employee_name)] = h; });

      // 3) เงินเดือนสะสมปีนี้ (snapshot เงินเดือนตั้งแต่จุดเริ่ม YTD ถึงเดือนงวดนี้)
      const salYtd = {};
      const addSal = arr => (Array.isArray(arr) ? arr : []).forEach(e => {
        const k = slipNorm(e.employee_name);
        if (!salYtd[k]) salYtd[k] = { income: 0, tax: 0, sso: 0 };
        salYtd[k].income += Number(e.total_income || 0);
        salYtd[k].tax += Number(e.tax || 0);
        salYtd[k].sso += Number(e.sso_amount || 0);
      });
      const payrollGroups = await postHR({ action: "payroll_payables", mode: "list_by_affiliation" });
      const inRange = (Array.isArray(payrollGroups) ? payrollGroups : []).filter(g2 => {
        const d = new Date(g2.month_year);
        return !isNaN(d) && d.getFullYear() === year && d.getMonth() >= startMonth && d <= periodMonthFirst;
      });
      for (const g2 of inRange) {
        addSal(await postHR({ action: "payroll_snapshot", mode: "detail", save_group: g2.save_group }));
      }

      // 4) ค่าคอมสะสมปีนี้ (ปกติ+พิเศษ รวมงวดนี้) จาก action ytd_commission
      const commYtd = {};
      try {
        const c = await postAPI({ action: "commission_normal_payables", mode: "ytd_commission", date_from: ytdFrom, date_to: ytdTo });
        (Array.isArray(c) ? c : []).forEach(r => {
          if (r && r.employee_name) commYtd[slipNorm(r.employee_name)] = Number(r.commission_ytd || 0);
        });
      } catch { /* workflow ยังไม่ re-import → 0 */ }

      // 5) วันที่จ่าย: เอกสารค่าคอมมิชชั่น (พิเศษ) ที่จ่ายแล้ว
      let paidAt = null;
      if (snapshotInfo?.save_group) {
        try {
          const docs = await postAPI({ action: "commission_payables", mode: "list_docs", save_group: snapshotInfo.save_group });
          (Array.isArray(docs) ? docs : []).forEach(d => {
            if (d?.commission_type === "commission" && d.status === "paid" && d.paid_at) {
              if (!paidAt || new Date(d.paid_at) > new Date(paidAt)) paidAt = d.paid_at;
            }
          });
        } catch { /* ignore */ }
      }

      const useBf = year === 2026;
      const slipRows = rowsBase.map(({ name, branch_code, commission }) => {
        const k = slipNorm(name);
        const hr = hrMap[k] || {};
        const sal = salYtd[k] || { income: 0, tax: 0, sso: 0 };
        return {
          g: { name, branch_code }, hr, commission,
          ytdIncome: (useBf ? Number(hr.income_bf || 0) : 0) + sal.income + (commYtd[k] || 0),
          ytdTax:    (useBf ? Number(hr.wht_bf || 0) : 0) + sal.tax,
          ytdSso:    (useBf ? Number(hr.sso_bf || 0) : 0) + sal.sso,
        };
      }).sort((a, b) => String(a.hr.employee_code || "๙๙").localeCompare(String(b.hr.employee_code || "๙๙"), "th"));

      // ประวัติการส่งอีเมลของงวดนี้
      const periodLabel = slipPeriodLabel(dateFrom, dateTo);
      const log = await fetchSlipSendLog("commission_special", periodLabel);
      const sentLog = {};
      log.forEach(l => { if (l.status === "sent") sentLog[slipNorm(l.employee_name)] = l; });

      setSlipSending({});
      setCommSlip({ loading: false, rows: slipRows, paidAt, periodLabel, year, sentLog });
    } catch (e) {
      setCommSlip({ loading: false, rows: [], error: e.message });
    }
  }

  async function sendCommSlipOne(r) {
    if (!r.hr.email || !commSlip) return;
    const key = slipNorm(r.g.name);
    setSlipSending(p => ({ ...p, [key]: "sending" }));
    try {
      await sendSlipEmail({
        spec: commSlipSpec(r, commSlip),
        email: r.hr.email,
        slipType: "commission_special",
        periodLabel: commSlip.periodLabel,
        saveGroup: snapshotInfo?.save_group || "",
        sentBy: currentUser?.username || currentUser?.name || "",
        docLabel: "สลิปค่าคอมมิชชั่น",
      });
      setSlipSending(p => ({ ...p, [key]: "sent" }));
    } catch (e) {
      setSlipSending(p => ({ ...p, [key]: "error:" + e.message }));
    }
  }

  async function sendCommSlipAll() {
    if (!commSlip) return;
    for (const r of commSlip.rows) {
      if (r.hr.email) await sendCommSlipOne(r); // ส่งทีละคน
    }
  }

  // spec สลิป 1 คน — ทุกช่องเป็น 0 ยกเว้นบรรทัด "ค่านายหน้า/Commission"
  function commSlipSpec(r, meta) {
    const hr = r.hr || {};
    const aff = ADJ_BRANCH_AFF[r.g.branch_code] || hr.affiliation || "";
    const dept = hr.department || "-";
    const pos = hr.position || "-";
    return {
      company: SLIP_COMPANY[aff] || aff || "-",
      name: r.g.name,
      code: hr.employee_code || "",
      position: `${dept}/${pos}`,
      periodLabel: meta.periodLabel,
      paidLabel: slipDateLabel(meta.paidAt),
      bankAccount: hr.bank_account_no || "-",
      year: meta.year,
      earnings: [
        ["เงินเดือน/ค่าจ้าง", "Salary/Wage", 0],
        ["ค่าล่วงเวลา", "Overtime", 0],
        ["ค่านายหน้า", "Commission", r.commission],
        ["ค่าเบี้ยเลี้ยง/ค่าครองชีพ", "Allowances/Cost of livings", 0],
        ["โบนัส", "Bonus", 0],
        ["เงินได้อื่นๆ", "Others", 0],
      ],
      deductions: [
        ["ประกันสังคม", "Social Security Fund", 0],
        ["ภาษีหัก ณ ที่จ่าย", "Withholding tax", 0],
        ["เงินกู้ยืม กยศ./กรอ.", "Student Loan Fund", 0],
        ["เงินประกัน", "Deposit", 0],
        ["ขาด/ลา/มาสาย", "Absent/Leave/Late", 0],
        ["รายการหักอื่นๆ", "Others", 0],
      ],
      ytd: [
        ["เงินได้สะสม", "YTD earnings", r.ytdIncome],
        ["ภาษีหัก ณ ที่จ่ายสะสม", "YTD Withholding tax", r.ytdTax],
        ["เงินประกันสังคมสะสม", "Accumulated SSF", r.ytdSso],
      ],
      totals: [
        ["รวมเงินได้", "Total earnings", r.commission],
        ["รวมรายการหัก", "Total deductions", 0],
        ["เงินได้สุทธิ", "Net pay", r.commission],
      ],
    };
  }

  function printCommSlips(slipRows, meta) {
    printSlips(slipRows.map(r => commSlipSpec(r, meta)), `สลิปค่าคอมพิเศษ ${meta.periodLabel}`);
  }

  async function saveAdjustment(r, colKey) {
    if (!snapshotInfo?.save_group) { alert("ต้องกด 💾 บันทึก (snapshot) ก่อน ถึงจะแก้ไขยอดได้"); return; }
    const base = Number(colKey === "commission" ? r.commission_amount : r.brokerage_amount) || 0;
    const raw = String(editValue).replace(/,/g, "").trim();
    const newAmt = raw === "" ? base : Number(raw);
    if (!isFinite(newAmt) || newAmt < 0) { alert("กรุณากรอกตัวเลขให้ถูกต้อง"); return; }
    const target = resolveAdjTarget(r, colKey);
    if (!target) { alert("ไม่ทราบสังกัดของสาขานี้ — แก้ไขยอดไม่ได้"); return; }
    setAdjSaving(true);
    try {
      const data = await postAPI({
        action: "commission_payables", mode: "save_adjustment",
        save_group: snapshotInfo.save_group,
        employee_name: r.employee_name, employee_id: r.employee_id || null,
        col_key: colKey, ...target,
        original_amount: base, new_amount: newAmt,
        adjusted_by: currentUser?.username || currentUser?.name || "",
      });
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.error) throw new Error(result.error);
      if (!result?.result) throw new Error("workflow ยังไม่รองรับ save_adjustment — ต้อง re-import Sales Extra Pay API ใน n8n ก่อน");
      setEditCell(null);
      setMessage(Math.abs(newAmt - base) < 0.005
        ? "✅ รีเซ็ตยอดกลับเป็นค่าคำนวณแล้ว"
        : `✅ แก้ไขยอดของ ${r.employee_name} แล้ว — ⚠️ ถ้าสร้างเอกสารจ่ายไว้ก่อนหน้านี้ ให้ยกเลิกเอกสารแล้วสร้างใหม่เพื่อให้ยอดตรง`);
      await fetchAdjustments(snapshotInfo.save_group);
    } catch (e) { alert("❌ บันทึกการแก้ไขยอดไม่สำเร็จ: " + e.message); }
    setAdjSaving(false);
  }

  function renderAdjCell(r, colKey, color) {
    const a = adjByEmp[r.employee_name]?.[colKey];
    const base = Number(colKey === "commission" ? r.commission_amount : r.brokerage_amount) || 0;
    const val = a ? Number(a.new_amount) : base;
    const editing = editCell && editCell.employee_id === r.employee_id && editCell.col === colKey;
    if (editing) {
      return (
        <td style={{ ...td, textAlign: "right" }}>
          <input autoFocus value={editValue} disabled={adjSaving}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") saveAdjustment(r, colKey);
              if (e.key === "Escape") setEditCell(null);
            }}
            onBlur={() => { if (!adjSaving) setEditCell(null); }}
            style={{ width: 90, padding: "3px 6px", border: "2px solid #f59e0b", borderRadius: 4, textAlign: "right", fontFamily: "monospace", fontSize: 12 }} />
          <div style={{ fontSize: 9, color: "#92400e", whiteSpace: "nowrap" }}>Enter=บันทึก · Esc=ยกเลิก</div>
        </td>
      );
    }
    const stale = a && Math.abs(Number(a.original_amount) - base) > 0.005;
    return (
      <td title={snapshotInfo?.save_group ? "คลิกเพื่อแก้ไขยอด" : "ต้องกด 💾 บันทึก (snapshot) ก่อน ถึงจะแก้ไขยอดได้"}
        onClick={() => {
          if (!snapshotInfo?.save_group) { alert("ต้องกด 💾 บันทึก (snapshot) ก่อน ถึงจะแก้ไขยอดได้"); return; }
          setEditCell({ employee_id: r.employee_id, col: colKey }); setEditValue(val ? String(val) : "");
        }}
        style={{ ...td, textAlign: "right", fontFamily: "monospace", cursor: "pointer", color, ...(a ? { background: "#fff7ed", color: "#c2410c", fontWeight: 700 } : {}) }}>
        {val ? fmt(val) : "-"}{a ? " ✏️" : ""}
        {a && <div style={{ fontSize: 10, color: "#9ca3af", textDecoration: "line-through", fontWeight: 400 }}>{fmt(a.original_amount)}</div>}
        {stale && <div style={{ fontSize: 9, color: "#dc2626", fontWeight: 400 }}>⚠️ ยอดคำนวณเปลี่ยนเป็น {fmt(base)}</div>}
      </td>
    );
  }

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const data = await postAPI({ action: "commission_split_summary", date_from: dateFrom, date_to: dateTo, branch_code: branchFilter, brand: brandFilter });
      const arr = Array.isArray(data) ? data.filter(r => r && r.employee_id) : [];
      setRows(arr);
      checkSnapshot(); // เช็คว่ามี snapshot ของ filter นี้หรือยัง
    } catch (e) { setRows([]); setMessage("❌ โหลดไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  async function saveSnapshot() {
    if (rows.length === 0) { setMessage("ไม่มีข้อมูลให้บันทึก"); return; }
    let confirmMsg = `ยืนยันบันทึกค่าคอมพิเศษ?\n\nช่วง: ${dateFrom} ถึง ${dateTo}\n${brandFilter ? `ยี่ห้อ: ${brandFilter}\n` : ""}${branchFilter ? `สาขา: ${branchFilter}\n` : ""}จำนวน ${rows.length} คน, ยอดรวม ${fmt(total)} บาท`;
    if (snapshotInfo) confirmMsg += "\n\n⚠️ มี snapshot ของช่วงนี้อยู่แล้ว — บันทึกใหม่จะ overwrite ของเดิม";
    if (!window.confirm(confirmMsg)) return;
    setSavingSnap(true); setMessage("");
    try {
      // ดึง detail (ใบขายทั้งหมด — ทุกพนักงาน) เพื่อเก็บประวัติด้วย
      const detailData = await postAPI({
        action: "commission_split_detail",
        date_from: dateFrom, date_to: dateTo, branch_code: branchFilter, brand: brandFilter,
      });
      const detailRows = Array.isArray(detailData)
        ? detailData.filter(r => r && r.sale_id && !r.is_excluded).map(r => ({
            sale_id: r.sale_id, sale_date: r.sale_date, invoice_no: r.invoice_no,
            customer_name: r.customer_name, brand: r.brand, model_series: r.model_series,
            model_code: r.model_code, type_name: r.type_name, chassis_no: r.chassis_no,
            comm_amount: r.comm_amount, split_count: r.split_count, per_emp_amount: r.per_emp_amount,
            employee_id: r.employee_id, employee_name: r.employee_name,
            employee_branch_code: r.branch_code,
          }))
        : [];
      await postAPI({
        action: "commission_snapshot", mode: "save",
        date_from: dateFrom, date_to: dateTo, branch_code: branchFilter, brand: brandFilter,
        saved_by: currentUser?.username || currentUser?.email || "",
        rows: rows.map(r => ({
          employee_id: r.employee_id, employee_name: r.employee_name,
          branch_code: r.branch_code, sales_count: r.sales_count,
          total_commission: r.total_commission,
        })),
        detail_rows: detailRows,
      });
      setMessage(`✅ บันทึกสำเร็จ ${rows.length} คน, ${detailRows.length} รายการรถ`);
      checkSnapshot();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSavingSnap(false);
  }

  async function openHistory() {
    setHistoryOpen(true); setHistoryLoading(true);
    try {
      const data = await postAPI({ action: "commission_snapshot", mode: "history" });
      setHistoryRows(Array.isArray(data) ? data.filter(r => r && r.save_group) : []);
    } catch { setHistoryRows([]); }
    setHistoryLoading(false);
  }

  async function viewSnapshotDetail(item) {
    setSnapDetail({ save_group: item.save_group, item, rows: [], sales: [], loading: true });
    try {
      const [empData, salesData] = await Promise.all([
        postAPI({ action: "commission_snapshot", mode: "detail", save_group: item.save_group }),
        postAPI({ action: "commission_snapshot", mode: "detail_sales", save_group: item.save_group }),
      ]);
      setSnapDetail({
        save_group: item.save_group, item,
        rows: Array.isArray(empData) ? empData : [],
        sales: Array.isArray(salesData) ? salesData : [],
        loading: false,
      });
    } catch { setSnapDetail({ save_group: item.save_group, item, rows: [], sales: [], loading: false }); }
  }

  async function cancelSnapshot(item) {
    if (!window.confirm(`ยืนยันยกเลิกการบันทึก?\n\nช่วง: ${item.period_from} ถึง ${item.period_to}\nจำนวน ${item.employee_count} คน\nยอดรวม ${fmt(item.total)} บาท\n\nการยกเลิกไม่สามารถย้อนกลับได้`)) return;
    try {
      await postAPI({ action: "commission_snapshot", mode: "cancel", save_group: item.save_group });
      setMessage("✅ ยกเลิกการบันทึกเรียบร้อย");
      await openHistory();
      checkSnapshot();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  // ===== Payables (สร้าง expense_documents 4 ใบ) =====
  async function openPayables() {
    if (!snapshotInfo?.save_group) { setMessage("ต้องบันทึกค่าคอม snapshot ก่อน"); return; }
    setPayOpen(true); setPayLoading(true); setPayPreview([]); setPayDocs([]);
    try {
      // ดึง preview + list docs ที่อาจมีอยู่แล้ว
      const [preview, docs] = await Promise.all([
        postAPI({ action: "commission_payables", mode: "preview", save_group: snapshotInfo.save_group }),
        postAPI({ action: "commission_payables", mode: "list_docs", save_group: snapshotInfo.save_group }),
      ]);
      const previewArr = Array.isArray(preview) ? preview : [];
      setPayPreview(previewArr);
      setPayDocs(Array.isArray(docs) ? docs.filter(d => d && d.expense_doc_id) : []);
      // default ติ๊กทุกแถวที่มียอด > 0
      setSelectedGroups(new Set(previewArr.filter(p => Number(p.subtotal) > 0).map(p => Number(p.group_no))));
    } catch { setMessage("❌ โหลดไม่สำเร็จ"); }
    setPayLoading(false);
  }

  function toggleGroup(group_no) {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      const n = Number(group_no);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  }

  async function createPayables() {
    if (!snapshotInfo?.save_group) return;
    if (selectedGroups.size === 0) { setMessage("กรุณาเลือกอย่างน้อย 1 รายการ"); return; }
    if (!window.confirm(`ยืนยันสร้างเอกสารจ่ายเงิน ${selectedGroups.size} ใบ?`)) return;
    setPayCreating(true);
    try {
      await postAPI({
        action: "commission_payables", mode: "create",
        save_group: snapshotInfo.save_group,
        selected_groups: [...selectedGroups],
        created_by: currentUser?.username || currentUser?.email || "",
      });
      setMessage("✅ สร้างเอกสารจ่ายเงินเรียบร้อย");
      await openPayables(); // reload
    } catch { setMessage("❌ สร้างไม่สำเร็จ"); }
    setPayCreating(false);
  }

  // สร้างเฉพาะใบที่ขาด — กรณีสร้างรอบแรกตอนข้อมูลยังไม่ครบทุกกลุ่ม (backend มี NOT EXISTS กันซ้ำรายกลุ่ม)
  async function createMissingPayables(groupNos) {
    if (!snapshotInfo?.save_group || !groupNos.length) return;
    if (!window.confirm(`สร้างเอกสารที่ขาด ${groupNos.length} ใบ?\n(ใบที่มีอยู่แล้วจะไม่ถูกสร้างซ้ำ)`)) return;
    setPayCreating(true);
    try {
      await postAPI({
        action: "commission_payables", mode: "create",
        save_group: snapshotInfo.save_group,
        selected_groups: groupNos,
        created_by: currentUser?.username || currentUser?.email || "",
      });
      setMessage("✅ สร้างเอกสารที่ขาดเรียบร้อย");
      await openPayables();
    } catch { setMessage("❌ สร้างไม่สำเร็จ"); }
    setPayCreating(false);
  }

  // ===== Pay popup (mark expense_doc as paid) =====
  function openPayPopup(doc) {
    setPayPopup({ doc });
    setPayDate(todayISO());
    setPayMethod("โอน");
    setPayAccountId("");
    setPayNote("");
  }

  async function doPay() {
    if (!payPopup?.doc) return;
    if (!payDate) { alert("กรุณากรอกวันที่จ่าย"); return; }
    if (payMethod === "โอน" && !payAccountId) { alert("กรุณาเลือกบัญชีต้นทาง"); return; }
    setPaying(true);
    try {
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
        }),
      });
      const data = await res.json();
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.error_msg) throw new Error(result.error_msg);
      setMessage(`✅ บันทึกจ่ายสำเร็จ — เลขจ่าย: ${result?.paid_doc_no || "-"}`);
      setPayPopup(null);
      await openPayables(); // refresh
    } catch (e) { alert("❌ บันทึกจ่ายไม่สำเร็จ: " + e.message); }
    setPaying(false);
  }

  async function cancelPayables() {
    if (!snapshotInfo?.save_group) return;
    if (!window.confirm("ยืนยันยกเลิกเอกสารจ่ายเงินทั้งหมดของรอบนี้?\n\n⚠️ เอกสารที่จ่ายแล้วจะไม่ถูกลบ")) return;
    try {
      const data = await postAPI({ action: "commission_payables", mode: "cancel", save_group: snapshotInfo.save_group });
      const err = Array.isArray(data) && data[0]?.error;
      if (err) { setMessage(`❌ ${err}`); return; }
      setMessage("✅ ยกเลิกเอกสารแล้ว");
      await openPayables();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  async function openDetail(emp) {
    setDetail({ emp, rows: [], loading: true });
    try {
      const data = await postAPI({ action: "commission_split_detail", date_from: dateFrom, date_to: dateTo, branch_code: branchFilter, brand: brandFilter, employee_id: emp.employee_id });
      const arr = Array.isArray(data) ? data.filter(r => r && r.sale_id) : [];
      // เก็บ snapshot ของรายการที่ถูก exclude อยู่แล้ว (จาก is_excluded ใน response)
      const excIds = arr.filter(r => r.is_excluded).map(r => Number(r.sale_id));
      setExcludedSet(new Set(excIds));
      setInitialExcludedSet(new Set(excIds));
      setDetail({ emp, rows: arr, loading: false });
    } catch { setDetail({ emp, rows: [], loading: false }); }
  }

  function toggleExclusion(sale_id) {
    setExcludedSet(prev => {
      const next = new Set(prev);
      const id = Number(sale_id);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function saveExclusions() {
    const toExclude = [...excludedSet].filter(id => !initialExcludedSet.has(id));
    const toUnexclude = [...initialExcludedSet].filter(id => !excludedSet.has(id));
    if (toExclude.length === 0 && toUnexclude.length === 0) return;
    setSavingExcl(true); setMessage("");
    try {
      await postAPI({
        action: "set_sale_exclusions",
        to_exclude: toExclude,
        to_unexclude: toUnexclude,
        excluded_by: currentUser?.username || currentUser?.email || "",
      });
      setMessage(`✅ บันทึกแล้ว (เพิ่ม ${toExclude.length}, ยกเลิก ${toUnexclude.length})`);
      // รีเฟรช summary + reload detail ใหม่
      const empSnapshot = detail?.emp;
      await fetchData();
      if (empSnapshot) await openDetail(empSnapshot);
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSavingExcl(false);
  }

  const hasChanges = (() => {
    if (excludedSet.size !== initialExcludedSet.size) return true;
    for (const id of excludedSet) if (!initialExcludedSet.has(id)) return true;
    return false;
  })();

  const totalSales = rows.reduce((s, r) => s + Number(r.sales_count || 0), 0);
  // workflow เก่าที่ยังไม่ส่ง 2 คอลัมน์แยก → ซ่อนคอลัมน์แยกไว้ก่อน
  const hasSplit = rows.some(r => r.commission_amount !== undefined && r.commission_amount !== null);
  // แยก ค่าคอม (แบรนด์ตรงสังกัดสาขา) / ค่านายหน้า (แบรนด์ต่างสังกัด) — รวมยอดที่แก้ไขเอง (adjustments) แล้ว
  const totalComm = rows.reduce((s, r) => s + effOf(r, "commission"), 0);
  const totalBrok = rows.reduce((s, r) => s + effOf(r, "brokerage"), 0);
  const rowTotal = (r) => (hasSplit ? effOf(r, "commission") + effOf(r, "brokerage") : Number(r.total_commission || 0));
  const total = hasSplit ? totalComm + totalBrok : rows.reduce((s, r) => s + Number(r.total_commission || 0), 0);
  const branches = [...new Set(rows.map(r => r.branch_code).filter(Boolean))];

  function printDetail() {
    if (!detail || !detail.rows || detail.rows.length === 0) return;
    const safe = (v) => String(v == null ? "" : v).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const sumComm = detail.rows.reduce((s, r) => s + Number(r.per_emp_amount || 0), 0);
    const sumActive = detail.rows.filter(r => !excludedSet.has(Number(r.sale_id))).reduce((s, r) => s + Number(r.per_emp_amount || 0), 0);
    const rowsHtml = detail.rows.map((r, i) => {
      const isExcl = excludedSet.has(Number(r.sale_id));
      const cls = isExcl ? ' class="excluded"' : '';
      return `<tr${cls}>
        <td>${i + 1}</td>
        <td>${safe(fmtDate(r.sale_date))}</td>
        <td>${safe(r.invoice_no)}</td>
        <td>${safe(r.customer_name)}</td>
        <td>${safe(r.brand)} · ${safe(r.model_series)} · ${safe(r.type_name || r.model_code)}</td>
        <td>${safe(r.chassis_no)}</td>
        <td class="num">${fmt(r.comm_amount)}</td>
        <td style="text-align:center">÷${r.split_count}</td>
        <td class="num">${isExcl ? "<s>" + fmt(r.per_emp_amount) + "</s>" : fmt(r.per_emp_amount)}</td>
        <td style="text-align:center">${isExcl ? "ไม่คำนวณ" : "✓"}</td>
      </tr>`;
    }).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ค่าคอมพิเศษ - ${safe(detail.emp?.employee_name)}</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: 'Tahoma','Arial',sans-serif; font-size: 11pt; }
h1 { text-align: center; margin: 0 0 4px; font-size: 16pt; color: #072d6b; }
.head { text-align: center; margin-bottom: 8px; font-size: 11pt; color: #444; }
.summary { display: flex; gap: 30px; justify-content: center; margin: 10px 0 14px; font-size: 12pt; }
.summary .item { padding: 6px 14px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; }
.summary .item b { color: #059669; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #555; padding: 4px 6px; font-size: 10pt; text-align: left; vertical-align: top; }
th { background: #072d6b; color: #fff; font-weight: 700; white-space: nowrap; }
.num { text-align: right; font-family: monospace; font-weight: 600; color: #059669; }
.totalrow { background: #fef9c3; font-weight: 700; }
.totalrow .num { color: #065f46; font-size: 12pt; }
tr.excluded { color: #9ca3af; background: #f9fafb; }
tr.excluded td { text-decoration: line-through; }
.signature { display: flex; justify-content: space-around; margin-top: 50px; font-size: 11pt; }
.signature .box { text-align: center; min-width: 200px; }
.signature .line { border-top: 1px solid #000; margin-bottom: 5px; padding-top: 6px; }
</style></head><body>
<h1>📋 รายงานค่าคอมพิเศษ</h1>
<div class="head">
  พนักงาน: <b>${safe(detail.emp?.employee_name)}</b> · สาขา: ${safe(detail.emp?.branch_code)}<br/>
  ช่วงวันที่: ${safe(fmtDate(dateFrom))} ถึง ${safe(fmtDate(dateTo))}${brandFilter ? ` · ยี่ห้อ: ${safe(brandFilter)}` : ""}<br/>
  พิมพ์เมื่อ: ${new Date().toLocaleString("th-TH")}
</div>
<div class="summary">
  <div class="item">จำนวนใบขาย: <b>${detail.rows.length}</b> ใบ</div>
  <div class="item">ค่าคอมรวม: <b>${fmt(sumActive)}</b> บาท</div>
</div>
<table>
  <thead><tr>
    <th>#</th><th>วันที่</th><th>เลขใบขาย</th><th>ลูกค้า</th>
    <th>รุ่น/Type</th><th>เลขถัง</th>
    <th style="text-align:right">ค่าคอมรวม</th>
    <th style="text-align:center">หาร</th>
    <th style="text-align:right">ส่วนแบ่ง</th>
    <th style="text-align:center">สถานะ</th>
  </tr></thead>
  <tbody>
    ${rowsHtml}
    <tr class="totalrow">
      <td colspan="8" style="text-align:right">รวมสุทธิ (เฉพาะใบที่คำนวณ)</td>
      <td class="num">${fmt(sumActive)}</td>
      <td></td>
    </tr>
  </tbody>
</table>
<div class="signature">
  <div class="box"><div class="line">ผู้รับเงิน</div>(................................)<br/>วันที่: ........../........../..........</div>
  <div class="box"><div class="line">ผู้จ่ายเงิน</div>(................................)<br/>วันที่: ........../........../..........</div>
  <div class="box"><div class="line">ผู้อนุมัติ</div>(................................)<br/>วันที่: ........../........../..........</div>
</div>
</body></html>`;
    const w = window.open("", "_blank", "width=1200,height=900");
    if (!w) { setMessage("popup ถูกบล็อก"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 รายงานค่าคอมพิเศษ</h2>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <input type="text" placeholder="รหัสสาขา (เช่น SCY06)" value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ ...inp, minWidth: 150, fontFamily: "monospace" }} />
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} style={{ ...inp, minWidth: 130 }}>
          <option value="">ทุกยี่ห้อ</option>
          <option value="ฮอนด้า">ฮอนด้า</option>
          <option value="ยามาฮ่า">ยามาฮ่า</option>
        </select>
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
        <button onClick={saveSnapshot} disabled={savingSnap || loading || rows.length === 0}
          style={{ padding: "7px 14px", background: savingSnap ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: savingSnap || loading ? "not-allowed" : "pointer", fontWeight: 600 }}>
          {savingSnap ? "..." : "💾 บันทึก"}
        </button>
        <button onClick={openHistory}
          style={{ padding: "7px 14px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          📋 ประวัติ
        </button>
        <button onClick={openPayables} disabled={!snapshotInfo}
          style={{ padding: "7px 14px", background: snapshotInfo ? "#dc2626" : "#9ca3af", color: "#fff", border: "none", borderRadius: 6, cursor: snapshotInfo ? "pointer" : "not-allowed", fontWeight: 600 }}
          title={snapshotInfo ? "" : "ต้องบันทึก snapshot ก่อน"}>
          💵 บันทึกการจ่ายเงิน
        </button>
        <button onClick={openCommSlipPopup} disabled={loading || rows.length === 0}
          style={{ padding: "7px 14px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          🧾 สลิปค่าคอม
        </button>
      </div>

      {snapshotInfo && (
        <div style={{ padding: "8px 12px", marginBottom: 10, background: "#d1fae5", borderRadius: 6, fontSize: 13, color: "#065f46" }}>
          ℹ️ ช่วงนี้บันทึกแล้ว — เมื่อ {snapshotInfo.saved_at ? new Date(snapshotInfo.saved_at).toLocaleString("th-TH") : "-"} โดย {snapshotInfo.saved_by || "ผู้ดูแลระบบ"} ({snapshotInfo.row_count} คน, ยอดรวม {fmt(snapshotInfo.total)} บาท)
        </div>
      )}

      {message && <div style={{ padding: 10, marginBottom: 10, color: message.startsWith("✅") ? "#065f46" : "#b91c1c", background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", borderRadius: 6 }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        <Card label="👥 จำนวนพนักงาน" value={rows.length} color="#1e40af" />
        <Card label="🚗 ใบขายที่จ่ายค่าคอม" value={totalSales} color="#0369a1" />
        {hasSplit && <Card label="💵 ค่าคอมมิชชั่น" value={fmt(totalComm)} color="#0d9488" />}
        {hasSplit && <Card label="🤝 ค่านายหน้า" value={fmt(totalBrok)} color="#b45309" />}
        <Card label="💰 ยอดค่าคอมรวม" value={fmt(total)} color="#059669" highlight />
      </div>

      {hasSplit && (
        <div style={{ fontSize: 12, color: "#b45309", marginBottom: 6 }}>
          ✏️ คลิกที่ตัวเลข ค่าคอมมิชชั่น/ค่านายหน้า เพื่อแก้ไขยอดได้ — ยอดที่แก้จะถูกใช้ในเอกสารจ่ายเงิน (กรอกเท่ายอดเดิมเพื่อรีเซ็ต){!snapshotInfo?.save_group && " · ต้องกด 💾 บันทึก (snapshot) ก่อน"}
        </div>
      )}

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>#</th>
              <th style={th}>พนักงาน</th>
              <th style={th}>สาขา</th>
              <th style={{ ...th, textAlign: "right" }}>จำนวนใบขาย</th>
              {hasSplit && <th style={{ ...th, textAlign: "right" }}>ค่าคอมมิชชั่น</th>}
              {hasSplit && <th style={{ ...th, textAlign: "right" }}>ค่านายหน้า</th>}
              <th style={{ ...th, textAlign: "right" }}>ยอดค่าคอมรวม</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={hasSplit ? 8 : 6} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={hasSplit ? 8 : 6} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.employee_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, fontWeight: 600 }}>{r.employee_name}</td>
                <td style={{ ...td, fontFamily: "monospace" }}>{r.branch_code || "-"}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.sales_count}</td>
                {hasSplit && renderAdjCell(r, "commission", "#0d9488")}
                {hasSplit && renderAdjCell(r, "brokerage", "#b45309")}
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(rowTotal(r))}</td>
                <td style={td}><button onClick={() => openDetail(r)} style={btnSmBlue}>📋 รายละเอียด</button></td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม</td>
                <td style={{ ...td, textAlign: "right" }}>{totalSales}</td>
                {hasSplit && <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#0d9488" }}>{fmt(totalComm)}</td>}
                {hasSplit && <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#b45309" }}>{fmt(totalBrok)}</td>}
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(total)}</td>
                <td style={td}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail popup */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1300, width: "94%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 {detail.emp?.employee_name} · {detail.emp?.branch_code} · ยอดรวม {fmt(detail.emp?.total_commission)}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveExclusions} disabled={!hasChanges || savingExcl}
                  style={{ padding: "5px 14px", background: hasChanges && !savingExcl ? "#059669" : "#9ca3af", color: "#fff", border: "none", borderRadius: 6, cursor: hasChanges && !savingExcl ? "pointer" : "not-allowed", fontWeight: 600 }}>
                  {savingExcl ? "กำลังบันทึก..." : "💾 บันทึกการเปลี่ยนแปลง"}
                </button>
                <button onClick={printDetail} disabled={!detail.rows || detail.rows.length === 0}
                  style={{ padding: "5px 14px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                  🖨️ พิมพ์
                </button>
                <button onClick={() => setDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
              </div>
            </div>
            <div style={{ padding: "8px 10px", marginBottom: 8, background: "#fef3c7", borderRadius: 6, fontSize: 12, color: "#78350f" }}>
              💡 ติ๊ก "ไม่คำนวณ" เพื่อตัดใบขายออกจากค่าคอมพิเศษ (กระทบทุกพนักงานที่ได้รับส่วนแบ่งใบนั้น) — กด "บันทึก" เมื่อพร้อม
            </div>
            {detail.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f0f4f9" }}>
                  <tr>
                    <th style={{ ...th, textAlign: "center", width: 70 }}>ไม่คำนวณ</th>
                    <th style={th}>#</th><th style={th}>วันที่</th><th style={th}>เลขใบขาย</th><th style={th}>ลูกค้า</th>
                    <th style={th}>รุ่น/Type</th><th style={th}>เลขถัง</th>
                    <th style={{ ...th, textAlign: "right" }}>ค่าคอมรวม</th>
                    <th style={{ ...th, textAlign: "center" }}>หาร</th>
                    <th style={{ ...th, textAlign: "right" }}>ส่วนแบ่ง</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.rows.length === 0 && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                  {detail.rows.map((r, i) => {
                    const sid = Number(r.sale_id);
                    const isExcluded = excludedSet.has(sid);
                    const rowStyle = isExcluded ? { borderTop: "1px solid #e5e7eb", background: "#f3f4f6", color: "#9ca3af", textDecoration: "line-through" } : { borderTop: "1px solid #e5e7eb" };
                    return (
                      <tr key={i} style={rowStyle}>
                        <td style={{ ...td, textAlign: "center" }}>
                          <input type="checkbox" checked={isExcluded} onChange={() => toggleExclusion(sid)}
                            style={{ width: 16, height: 16, cursor: "pointer", textDecoration: "none" }} />
                        </td>
                        <td style={td}>{i + 1}</td>
                        <td style={td}>{fmtDate(r.sale_date)}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.invoice_no}</td>
                        <td style={td}>{r.customer_name}</td>
                        <td style={td}>{r.brand} · {r.model_series} · {r.type_name || r.model_code}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.chassis_no}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.comm_amount)}</td>
                        <td style={{ ...td, textAlign: "center" }}>÷{r.split_count}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: isExcluded ? "#9ca3af" : "#059669" }}>{fmt(r.per_emp_amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* History modal */}
      {historyOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => { setHistoryOpen(false); setSnapDetail(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1200, width: "94%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 ประวัติการบันทึกค่าคอมพิเศษ</h3>
              <button onClick={() => { setHistoryOpen(false); setSnapDetail(null); }} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {historyLoading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f0f4f9" }}>
                  <tr>
                    <th style={th}>ช่วง</th><th style={th}>ยี่ห้อ</th><th style={th}>สาขา</th>
                    <th style={th}>บันทึกเมื่อ</th><th style={th}>โดย</th>
                    <th style={{ ...th, textAlign: "right" }}>คน</th>
                    <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.length === 0 && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีประวัติ</td></tr>}
                  {historyRows.map((h, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{fmtDate(h.period_from)} – {fmtDate(h.period_to)}</td>
                      <td style={td}>{h.brand || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{h.branch_code || "ทั้งหมด"}</td>
                      <td style={td}>{h.saved_at ? new Date(h.saved_at).toLocaleString("th-TH") : "-"}</td>
                      <td style={td}>{h.saved_by || "-"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{h.employee_count}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(h.total)}</td>
                      <td style={td}>
                        <button onClick={() => viewSnapshotDetail(h)} style={btnSmBlue}>👁️ ดู</button>
                        <button onClick={() => cancelSnapshot(h)} style={{ marginLeft: 4, padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>🗑 ยกเลิก</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Payables modal */}
      {payOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1050 }}
             onClick={() => setPayOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1100, width: "94%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>💵 บันทึกการจ่ายเงินค่าคอมพิเศษ</h3>
              <button onClick={() => setPayOpen(false)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {payLoading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : (
              <>
                <div style={{ padding: "8px 10px", marginBottom: 10, background: "#fef3c7", borderRadius: 6, fontSize: 12, color: "#78350f" }}>
                  💡 ระบบจะสร้างเอกสาร 4 ใบ ตามสังกัด × แบรนด์ — ใบที่ "ค่านายหน้า" จะมีหัก ณ ที่จ่าย 3%
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 14 }}>
                  <thead style={{ background: "#f0f4f9" }}>
                    <tr>
                      {payDocs.length === 0 && <th style={{ ...th, textAlign: "center", width: 60 }}>เลือก</th>}
                      <th style={th}>#</th><th style={th}>สังกัด</th><th style={th}>ขายแบรนด์</th>
                      <th style={th}>ประเภท</th><th style={{ ...th, textAlign: "right" }}>คน</th>
                      <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                      <th style={{ ...th, textAlign: "right" }}>หัก ณ ที่จ่าย</th>
                      <th style={{ ...th, textAlign: "right" }}>สุทธิจ่าย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payPreview.length === 0 && <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                    {payPreview.map((p, i) => {
                      const net = Number(p.subtotal || 0); // ยอดที่คำนวณ = ยอดที่ vendor ได้รับ
                      const rate = Number(p.wht_pct || 0);
                      const wht = rate > 0 ? Math.round((net * rate / (1 - rate)) * 100) / 100 : 0; // gross-up (ภาษีออกแทน)
                      const subtotal = Math.round((net + wht) * 100) / 100; // gross (ยอดรวมในใบจ่าย)
                      const gn = Number(p.group_no);
                      const checked = selectedGroups.has(gn);
                      return (
                        <tr key={i} style={{ borderTop: "1px solid #e5e7eb", opacity: subtotal === 0 ? 0.5 : 1 }}>
                          {payDocs.length === 0 && (
                            <td style={{ ...td, textAlign: "center" }}>
                              <input type="checkbox" checked={checked} disabled={subtotal === 0}
                                onChange={() => toggleGroup(gn)}
                                style={{ width: 18, height: 18, cursor: subtotal === 0 ? "not-allowed" : "pointer" }} />
                            </td>
                          )}
                          <td style={td}>{p.group_no}</td>
                          <td style={td}>{p.affiliation}</td>
                          <td style={td}>{p.brand}</td>
                          <td style={td}>{p.commission_type === "commission" ? "ค่าคอมมิชชั่น" : "ค่านายหน้า"}</td>
                          <td style={{ ...td, textAlign: "right" }}>{p.employee_count}</td>
                          <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(subtotal)}</td>
                          <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{wht > 0 ? `-${fmt(wht)}` : "-"}</td>
                          <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(net)}</td>
                        </tr>
                      );
                    })}
                    {payPreview.length > 0 && (() => {
                      const selectedRows = payDocs.length === 0
                        ? payPreview.filter(p => selectedGroups.has(Number(p.group_no)))
                        : payPreview;
                      const netSum = selectedRows.reduce((s, p) => s + Number(p.subtotal || 0), 0);
                      const whtSum = selectedRows.reduce((s, p) => {
                        const r = Number(p.wht_pct || 0);
                        return s + (r > 0 ? Number(p.subtotal || 0) * r / (1 - r) : 0);
                      }, 0);
                      const grossSum = netSum + whtSum;
                      return (
                        <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                          <td colSpan={payDocs.length === 0 ? 6 : 5} style={{ ...td, textAlign: "right" }}>รวม{payDocs.length === 0 ? " (เฉพาะที่เลือก)" : ""}</td>
                          <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(grossSum)}</td>
                          <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{whtSum > 0 ? `-${fmt(whtSum)}` : "-"}</td>
                          <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{fmt(netSum)}</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>

                {payDocs.length > 0 ? (
                  <>
                    <h4 style={{ margin: "8px 0", color: "#374151" }}>📄 เอกสารที่สร้างแล้ว ({payDocs.length})</h4>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
                      <thead style={{ background: "#f0f4f9" }}>
                        <tr>
                          <th style={th}>เลขที่</th><th style={th}>วันที่</th><th style={th}>รายการ</th>
                          <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                          <th style={{ ...th, textAlign: "right" }}>หัก</th>
                          <th style={{ ...th, textAlign: "right" }}>สุทธิ</th>
                          <th style={th}>สถานะ</th>
                          <th style={th}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {payDocs.map(d => (
                          <tr key={d.expense_doc_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                            <td style={{ ...td, fontFamily: "monospace" }}>{d.expense_doc_no}</td>
                            <td style={td}>{fmtDate(d.doc_date)}</td>
                            <td style={td}>{d.vendor_name}</td>
                            <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(d.subtotal)}</td>
                            <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{Number(d.withholding_amount) > 0 ? `-${fmt(d.withholding_amount)}` : "-"}</td>
                            <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(d.net_to_pay)}</td>
                            <td style={td}>
                              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: d.status === "paid" ? "#d1fae5" : "#fef3c7", color: d.status === "paid" ? "#065f46" : "#92400e" }}>
                                {d.status === "paid" ? "✓ จ่ายแล้ว" : "📝 ร่าง"}
                              </span>
                              {d.status === "paid" && d.paid_at && <div style={{ fontSize: 10, color: "#065f46", marginTop: 2 }}>จ่าย {fmtDate(d.paid_at)}</div>}
                            </td>
                            <td style={td}>
                              {d.status === "paid" ? (
                                <span style={{ fontSize: 11, color: "#065f46" }}>{d.paid_doc_no || ""}</span>
                              ) : (
                                <button onClick={() => openPayPopup(d)}
                                  style={{ padding: "4px 10px", background: "#059669", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                                  💸 บันทึกจ่าย
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(() => {
                      // กลุ่มใน preview (subtotal > 0) ที่ยังไม่มีเอกสาร — เทียบด้วย สังกัด|แบรนด์|ประเภท
                      const have = new Set(payDocs.map(d => `${d.affiliation}|${d.brand_filter || ""}|${d.commission_type}`));
                      const missing = payPreview.filter(p => Number(p.subtotal) > 0 && !have.has(`${p.affiliation}|${p.brand}|${p.commission_type}`));
                      return (
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
                          {missing.length > 0 && (
                            <>
                              <span style={{ fontSize: 12, color: "#b45309", marginRight: "auto" }}>
                                ⚠️ มี {missing.length} กลุ่มที่ยังไม่ได้สร้างเอกสาร: {missing.map(p => `${p.affiliation} ${p.brand}`).join(", ")}
                              </span>
                              <button onClick={() => createMissingPayables(missing.map(p => Number(p.group_no)))} disabled={payCreating}
                                style={{ padding: "7px 14px", background: payCreating ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: payCreating ? "not-allowed" : "pointer", fontWeight: 600 }}>
                                {payCreating ? "กำลังสร้าง..." : `💾 สร้างเอกสารที่ขาด (${missing.length} ใบ)`}
                              </button>
                            </>
                          )}
                          <button onClick={cancelPayables}
                            style={{ padding: "7px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                            🗑 ยกเลิกเอกสาร (เฉพาะที่ยังไม่จ่าย)
                          </button>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                    <button onClick={createPayables} disabled={payCreating || selectedGroups.size === 0}
                      style={{ padding: "8px 18px", background: payCreating || selectedGroups.size === 0 ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: payCreating || selectedGroups.size === 0 ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14 }}>
                      {payCreating ? "กำลังสร้าง..." : `💾 ยืนยันสร้างเอกสาร ${selectedGroups.size} ใบ`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Pay popup (mark expense_doc paid) */}
      {payPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200 }}
             onClick={() => !paying && setPayPopup(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 480, width: "92%", padding: 20 }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b", textAlign: "center" }}>💸 บันทึกจ่ายเงิน</h3>
            <div style={{ padding: 12, marginBottom: 14, background: "#f0f9ff", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>{payPopup.doc.vendor_name}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#059669", fontFamily: "monospace" }}>฿{fmt(payPopup.doc.net_to_pay)}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>📄 เอกสาร: <strong>{payPopup.doc.expense_doc_no}</strong></div>
              {Number(payPopup.doc.withholding_amount) > 0 && (
                <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>หัก ณ ที่จ่าย: -{fmt(payPopup.doc.withholding_amount)} (ยอดก่อนหัก {fmt(payPopup.doc.subtotal)})</div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>วันที่จ่าย *</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={{ ...inp, width: "100%" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>วิธีจ่าย</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={{ ...inp, width: "100%" }}>
                  <option value="โอน">โอน</option>
                  <option value="เงินสด">เงินสด</option>
                  <option value="เช็ค">เช็ค</option>
                </select>
              </div>
            </div>
            {payMethod === "โอน" && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>โอนจาก (บัญชีบริษัท) *</label>
                <select value={payAccountId} onChange={e => setPayAccountId(e.target.value)} style={{ ...inp, width: "100%" }}>
                  <option value="">-- เลือกบัญชี --</option>
                  {bankAccounts.map(a => {
                    const id = a.account_id || a.bank_account_id;
                    const label = `${a.bank_name || ""} · ${a.account_no || ""}${a.account_name ? ` · ${a.account_name}` : ""}`;
                    return <option key={id} value={id}>{label}</option>;
                  })}
                </select>
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>หมายเหตุ</label>
              <textarea value={payNote} onChange={e => setPayNote(e.target.value)} rows={2} style={{ ...inp, width: "100%", fontFamily: "Tahoma", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setPayPopup(null)} disabled={paying}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={doPay} disabled={paying}
                style={{ padding: "8px 18px", background: paying ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 6, cursor: paying ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {paying ? "กำลังบันทึก..." : "💾 บันทึกจ่ายเงิน"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot detail modal (nested) */}
      {snapDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100 }}
             onClick={() => setSnapDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1200, width: "94%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 {fmtDate(snapDetail.item?.period_from)} – {fmtDate(snapDetail.item?.period_to)} · ยอดรวม {fmt(snapDetail.item?.total)}</h3>
              <button onClick={() => setSnapDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {snapDetail.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : (
              <>
                <h4 style={{ margin: "8px 0", color: "#374151" }}>👥 รายชื่อพนักงาน</h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 18 }}>
                  <thead style={{ background: "#f0f4f9" }}>
                    <tr>
                      <th style={th}>#</th><th style={th}>พนักงาน</th><th style={th}>สาขา</th>
                      <th style={{ ...th, textAlign: "right" }}>ใบขาย</th>
                      <th style={{ ...th, textAlign: "right" }}>ยอดค่าคอม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapDetail.rows.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                    {snapDetail.rows.map((r, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{r.employee_name}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.employee_branch_code || "-"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{r.sales_count}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.total_commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h4 style={{ margin: "8px 0", color: "#374151" }}>🚗 รายการรถที่ใช้คำนวณ ({snapDetail.sales?.length || 0})</h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: "#f0f4f9" }}>
                    <tr>
                      <th style={th}>#</th><th style={th}>วันที่</th><th style={th}>เลขใบขาย</th><th style={th}>ลูกค้า</th>
                      <th style={th}>รุ่น/Type</th><th style={th}>เลขถัง</th><th style={th}>พนักงาน</th>
                      <th style={{ ...th, textAlign: "right" }}>ค่าคอมรวม</th>
                      <th style={{ ...th, textAlign: "center" }}>หาร</th>
                      <th style={{ ...th, textAlign: "right" }}>ส่วนแบ่ง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!snapDetail.sales || snapDetail.sales.length === 0) && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูลรถ (snapshot นี้บันทึกก่อนที่ feature นี้จะเปิด)</td></tr>}
                    {(snapDetail.sales || []).map((r, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={td}>{fmtDate(r.sale_date)}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.invoice_no}</td>
                        <td style={td}>{r.customer_name}</td>
                        <td style={td}>{r.brand} · {r.model_series} · {r.type_name || r.model_code}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.chassis_no}</td>
                        <td style={td}>{r.employee_name}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.comm_amount)}</td>
                        <td style={{ ...td, textAlign: "center" }}>÷{r.split_count}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.per_emp_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}

      {/* COMMISSION SLIP POPUP */}
      {commSlip && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          onClick={() => setCommSlip(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 780, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>🧾 สลิปค่าคอมพิเศษ — งวด {commSlip.periodLabel || ""}</h3>
              <button onClick={() => setCommSlip(null)} style={{ padding: "5px 12px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>ปิด</button>
            </div>
            <div style={{ marginBottom: 12, fontSize: 12, color: "#6b7280" }}>
              เฉพาะค่าคอมมิชชั่นของพนักงาน — ไม่รวมค่านายหน้า · วันที่ชำระ {slipDateLabel(commSlip.paidAt)}
            </div>
            {commSlip.loading ? <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด (รวมยอดสะสมเงินเดือน+ค่าคอม)...</div>
            : commSlip.error ? <div style={{ padding: 12, background: "#fef2f2", color: "#991b1b", borderRadius: 6 }}>❌ {commSlip.error}</div>
            : commSlip.rows.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีพนักงานที่ได้ค่าคอมมิชชั่นในงวดนี้</div>
            : (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button onClick={() => printCommSlips(commSlip.rows, commSlip)}
                    style={{ padding: "8px 18px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    🖨️ พิมพ์สลิปทั้งหมด ({commSlip.rows.length} คน)
                  </button>
                  <button onClick={sendCommSlipAll}
                    disabled={Object.values(slipSending).some(v => v === "sending")}
                    style={{ padding: "8px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    📧 ส่งอีเมลทั้งหมด ({commSlip.rows.filter(r => r.hr.email).length} คนที่มีอีเมล)
                  </button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: "#072d6b", color: "#fff" }}>
                    <tr>
                      <th style={{ ...th, width: 34, color: "#fff" }}>#</th>
                      <th style={{ ...th, color: "#fff" }}>รหัส</th>
                      <th style={{ ...th, color: "#fff" }}>พนักงาน</th>
                      <th style={{ ...th, color: "#fff" }}>อีเมล</th>
                      <th style={{ ...th, textAlign: "right", color: "#fff" }}>ค่าคอมงวดนี้</th>
                      <th style={{ ...th, textAlign: "right", color: "#fff" }}>เงินได้สะสม</th>
                      <th style={{ ...th, width: 90, color: "#fff" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {commSlip.rows.map((r, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.hr.employee_code || "-"}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{r.g.name}</td>
                        <td style={{ ...td, fontSize: 11 }}>
                          {r.hr.email
                            ? <span style={{ color: "#0369a1" }}>{r.hr.email}</span>
                            : <span style={{ color: "#dc2626" }}>— ไม่มีอีเมล —</span>}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#059669", fontFamily: "monospace" }}>{fmt(r.commission)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.ytdIncome)}</td>
                        <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                          <button onClick={() => printCommSlips([r], commSlip)}
                            style={{ padding: "4px 10px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600, marginRight: 4 }}>
                            🖨️
                          </button>
                          {(() => {
                            const key = slipNorm(r.g.name);
                            const st = slipSending[key];
                            const prev = commSlip.sentLog?.[key];
                            return st === "sending" ? <span style={{ fontSize: 11, color: "#92400e" }}>⏳ กำลังส่ง...</span>
                              : st === "sent" ? <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>✅ ส่งแล้ว</span>
                              : st && st.startsWith("error:") ? (
                                <button onClick={() => sendCommSlipOne(r)} title={st.slice(6)}
                                  style={{ padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                                  ❌ ส่งซ้ำ
                                </button>
                              ) : r.hr.email ? (
                                <>
                                  <button onClick={() => sendCommSlipOne(r)}
                                    style={{ padding: "4px 10px", background: "#059669", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                                    📧 ส่ง
                                  </button>
                                  {prev && <div style={{ fontSize: 9, color: "#059669" }}>เคยส่ง {new Date(prev.sent_at).toLocaleDateString("th-TH")}</div>}
                                </>
                              ) : <span style={{ fontSize: 11, color: "#9ca3af" }}>—</span>;
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
                    <tr>
                      <td colSpan={4} style={{ ...td, textAlign: "right" }}>รวม {commSlip.rows.length} คน</td>
                      <td style={{ ...td, textAlign: "right", color: "#059669", fontFamily: "monospace" }}>{fmt(commSlip.rows.reduce((s, r) => s + r.commission, 0))}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, color, highlight }) {
  return (
    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: highlight ? `2px solid ${color}` : "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: highlight ? 22 : 18, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const btnBlue = { padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
const btnSmBlue = { padding: "4px 10px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
