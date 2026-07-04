import React, { useEffect, useState, useMemo } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/sales-extra-pay-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const SERVICE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/service-api";
const HR_API = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";
const NOW = new Date();
const CURRENT_YM = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}`;

async function postService(body) {
  const r = await fetch(SERVICE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

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

export default function NormalCommissionReportPage({ currentUser }) {
  const [tab, setTab] = useState("sales"); // 'sales' | 'service'
  // ===== Service tab =====
  const [svcYear, setSvcYear] = useState(NOW.getFullYear());
  const [svcMonth, setSvcMonth] = useState(NOW.getMonth() + 1);
  const [hondaRows, setHondaRows] = useState([]);
  const [yamahaRows, setYamahaRows] = useState([]);
  const [svcCheckFees, setSvcCheckFees] = useState([]);
  const [svcEmployees, setSvcEmployees] = useState([]);
  const [svcLoading, setSvcLoading] = useState(false);

  const TRANSFER_TO_MECHANIC = "ชัยณรงค์ เกิดทรัพย์";

  async function fetchService() {
    setSvcLoading(true);
    try {
      const [honda, yamaha, checkFees, employees] = await Promise.all([
        postService({ action: "list_honda_repair_jobs", year: svcYear, month: svcMonth }),
        postService({ action: "list_yamaha_repair_invoices", year: svcYear, month: svcMonth }),
        postService({ action: "list_yamaha_check_fee", year: svcYear, month: svcMonth }),
        fetch(HR_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_hr_employees", include_inactive: "true" }) }).then(r => r.json()),
      ]);
      setHondaRows(Array.isArray(honda) ? honda.filter(r => r && r.id) : []);
      setYamahaRows(Array.isArray(yamaha) ? yamaha.filter(r => r && r.id) : []);
      setSvcCheckFees(Array.isArray(checkFees) ? checkFees : []);
      setSvcEmployees(Array.isArray(employees) ? employees : []);
    } catch { setHondaRows([]); setYamahaRows([]); setSvcCheckFees([]); setSvcEmployees([]); }
    setSvcLoading(false);
  }
  useEffect(() => { if (tab === "service") fetchService(); /* eslint-disable-next-line */ }, [tab]);

  const serviceMechanics = useMemo(() => {
    // map ชื่อพนักงาน → ตำแหน่ง (เช็คใครเป็นช่าง)
    const positionByName = new Map();
    for (const e of svcEmployees) {
      if (e.employee_name) positionByName.set(String(e.employee_name).trim(), String(e.position || "").trim());
    }
    const isMechanic = (name) => {
      const pos = positionByName.get(String(name || "").trim()) || "";
      return pos.includes("ช่าง");
    };
    // แถวบริษัท ป.เปา มอเตอร์เซอร์วิส (code PMOTOR / ชื่อมี "ป.เปา") = ไม่ใช่ช่าง ไม่คิดค่าคอม
    const isCompanyRow = (g) => String(g?.mechanic_code || "").toUpperCase() === "PMOTOR" || String(g?.mechanic_name || "").includes("ป.เปา");

    const map = new Map();
    // Honda
    for (const r of hondaRows) {
      const name = r.mechanic_name || "(ไม่ระบุ)";
      if (!map.has(name)) map.set(name, { mechanic_name: name, mechanic_code: r.mechanic_code, honda_labor: 0, honda_jobs: 0, yamaha_labor: 0, yamaha_check_fee: 0, yamaha_jobs: 0 });
      const g = map.get(name);
      const isPDI = String(r.service_type || "").toUpperCase().includes("PDI");
      const isPMotor = String(r.mechanic_code || "").toUpperCase() === "PMOTOR" || name.includes("ป.เปา");
      g.honda_labor += isPDI ? (isPMotor ? 0 : 50) : Number(r.labor_amount || 0);
      g.honda_jobs += 1;
    }
    // Yamaha
    const yamahaJobs = new Set();
    for (const r of yamahaRows) {
      const name = r.mechanic_name || "(ไม่ระบุ)";
      if (!map.has(name)) map.set(name, { mechanic_name: name, mechanic_code: null, honda_labor: 0, honda_jobs: 0, yamaha_labor: 0, yamaha_check_fee: 0, yamaha_jobs: 0 });
      const g = map.get(name);
      if (r.item_type === "รายการค่าแรง") g.yamaha_labor += Number(r.labor_total || 0);
      else if (r.item_type === "คูปอง") g.yamaha_labor += 40;
      const jobKey = `${name}|${r.job_no}`;
      if (!yamahaJobs.has(jobKey)) { yamahaJobs.add(jobKey); g.yamaha_jobs += 1; }
    }
    // ค่าเช็ครถ (Yamaha) — ต่อช่าง
    for (const f of svcCheckFees) {
      const name = String(f.mechanic_name || "").trim();
      if (!name) continue;
      if (!map.has(name)) map.set(name, { mechanic_name: name, mechanic_code: null, honda_labor: 0, honda_jobs: 0, yamaha_labor: 0, yamaha_check_fee: 0, yamaha_jobs: 0 });
      const g = map.get(name);
      g.yamaha_check_fee += Number(f.amount || 0);
    }

    // Transfer logic: คนที่ไม่ใช่ "ช่าง" → ย้ายยอด Yamaha (labor + check_fee) ไปที่ TRANSFER_TO
    // (Honda: ไม่ transfer เพราะคำนวณตาม PDI logic — เก็บไว้เหมือนเดิม)
    let list = [...map.values()];
    if (positionByName.size > 0) {
      let transferTo = list.find(g => g.mechanic_name === TRANSFER_TO_MECHANIC);
      if (!transferTo) {
        transferTo = { mechanic_name: TRANSFER_TO_MECHANIC, mechanic_code: null, honda_labor: 0, honda_jobs: 0, yamaha_labor: 0, yamaha_check_fee: 0, yamaha_jobs: 0 };
        list.push(transferTo);
      }
      for (const g of list) {
        if (g === transferTo) continue;
        if (!isMechanic(g.mechanic_name)) {
          // ย้ายยอด Yamaha (labor + check_fee + jobs) ไป
          transferTo.yamaha_labor += g.yamaha_labor;
          transferTo.yamaha_check_fee += g.yamaha_check_fee;
          transferTo.yamaha_jobs += g.yamaha_jobs;
          g.yamaha_labor = 0; g.yamaha_check_fee = 0; g.yamaha_jobs = 0;
        }
      }
      // ลบแถวที่ไม่ใช่ช่าง และยอดเป็น 0 ทั้งหมด
      list = list.filter(g => g === transferTo || isMechanic(g.mechanic_name) || g.honda_labor > 0);
    }

    return list
      .filter(g => !isCompanyRow(g))  // ตัดแถวบริษัท ป.เปา ออกจากค่าคอม (ไม่รวมคำนวณ/ยอดรวม)
      .map(g => ({
        ...g,
        yamaha_total: g.yamaha_labor + g.yamaha_check_fee,
        honda_commission: g.honda_labor * 0.65,
        yamaha_commission: (g.yamaha_labor + g.yamaha_check_fee) * 0.65,
        total_commission: (g.honda_labor + g.yamaha_labor + g.yamaha_check_fee) * 0.65,
      }))
      .sort((a, b) => b.total_commission - a.total_commission);
  }, [hondaRows, yamahaRows, svcCheckFees, svcEmployees]);

  const svcHondaSum = serviceMechanics.reduce((s, g) => s + g.honda_labor, 0);
  const svcYamahaSum = serviceMechanics.reduce((s, g) => s + g.yamaha_labor, 0);
  const svcYamahaCheckSum = serviceMechanics.reduce((s, g) => s + (g.yamaha_check_fee || 0), 0);
  const svcTotalCommission = serviceMechanics.reduce((s, g) => s + g.total_commission, 0);

  // ===== Service snapshot =====
  const [svcSnapshotInfo, setSvcSnapshotInfo] = useState(null);
  const [svcSavingSnap, setSvcSavingSnap] = useState(false);
  const [svcHistoryOpen, setSvcHistoryOpen] = useState(false);
  const [svcHistoryRows, setSvcHistoryRows] = useState([]);
  const [svcHistoryLoading, setSvcHistoryLoading] = useState(false);
  const [svcSnapDetail, setSvcSnapDetail] = useState(null);

  async function checkSvcSnapshot() {
    try {
      const data = await postAPI({ action: "commission_service_snapshot", mode: "check", year: svcYear, month: svcMonth });
      const arr = Array.isArray(data) ? data : [];
      setSvcSnapshotInfo(arr.length > 0 && arr[0]?.save_group ? arr[0] : null);
    } catch { setSvcSnapshotInfo(null); }
  }
  useEffect(() => { if (tab === "service") checkSvcSnapshot(); /* eslint-disable-next-line */ }, [tab, svcYear, svcMonth]);

  async function saveSvcSnapshot() {
    if (serviceMechanics.length === 0) { setMessage("ไม่มีข้อมูลให้บันทึก"); return; }
    let confirmMsg = `ยืนยันบันทึก snapshot ค่าคอมบริการ?\n\nปี: ${svcYear} เดือน: ${svcMonth}\nช่างซ่อม ${serviceMechanics.length} คน · ยอดคอม ${fmt(svcTotalCommission)} บาท`;
    if (svcSnapshotInfo) confirmMsg += "\n\n⚠️ มี snapshot ของเดือนนี้แล้ว — บันทึกใหม่จะ overwrite";
    if (!window.confirm(confirmMsg)) return;
    setSvcSavingSnap(true); setMessage("");
    try {
      await postAPI({
        action: "commission_service_snapshot", mode: "save",
        year: svcYear, month: svcMonth,
        saved_by: currentUser?.username || currentUser?.email || "",
        mechanics: serviceMechanics.map(g => ({
          mechanic_name: g.mechanic_name, mechanic_code: g.mechanic_code,
          honda_jobs: g.honda_jobs, honda_labor: g.honda_labor, honda_commission: g.honda_commission,
          yamaha_jobs: g.yamaha_jobs,
          yamaha_labor: g.yamaha_total || (g.yamaha_labor + (g.yamaha_check_fee || 0)), // รวมค่าเช็ครถ
          yamaha_commission: g.yamaha_commission,
          total_commission: g.total_commission,
        })),
      });
      setMessage(`✅ บันทึก snapshot สำเร็จ ${serviceMechanics.length} คน`);
      checkSvcSnapshot();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSvcSavingSnap(false);
  }

  async function openSvcHistory() {
    setSvcHistoryOpen(true); setSvcHistoryLoading(true);
    try {
      const data = await postAPI({ action: "commission_service_snapshot", mode: "history" });
      setSvcHistoryRows(Array.isArray(data) ? data.filter(r => r && r.save_group) : []);
    } catch { setSvcHistoryRows([]); }
    setSvcHistoryLoading(false);
  }

  async function viewSvcSnapDetail(item) {
    setSvcSnapDetail({ save_group: item.save_group, item, rows: [], loading: true });
    try {
      const data = await postAPI({ action: "commission_service_snapshot", mode: "detail", save_group: item.save_group });
      setSvcSnapDetail({ save_group: item.save_group, item, rows: Array.isArray(data) ? data : [], loading: false });
    } catch { setSvcSnapDetail({ save_group: item.save_group, item, rows: [], loading: false }); }
  }

  async function cancelSvcSnapshot(item) {
    if (!window.confirm(`ยืนยันยกเลิก snapshot?\n\nปี/เดือน: ${item.period_year}/${item.period_month}\nช่าง ${item.mechanic_count} คน`)) return;
    try {
      await postAPI({ action: "commission_service_snapshot", mode: "cancel", save_group: item.save_group });
      setMessage("✅ ยกเลิก snapshot เรียบร้อย");
      await openSvcHistory();
      checkSvcSnapshot();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  // ===== Parts tab (manual entry) =====
  const [partsMonth, setPartsMonth] = useState(CURRENT_YM);
  const [partsRows, setPartsRows] = useState([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [employeeList, setEmployeeList] = useState([]);
  const [partsForm, setPartsForm] = useState({ employee_id: "", employee_name: "", amount: "", note: "" });
  const [partsSaving, setPartsSaving] = useState(false);

  async function fetchParts() {
    setPartsLoading(true);
    try {
      const data = await postAPI({ action: "commission_parts_manual", mode: "list", month_year: partsMonth });
      setPartsRows(Array.isArray(data) ? data.filter(r => r && r.id) : []);
    } catch { setPartsRows([]); }
    setPartsLoading(false);
  }

  async function loadEmployeeList() {
    try {
      const res = await fetch(HR_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_hr_employees" }),
      });
      const data = await res.json();
      setEmployeeList(Array.isArray(data) ? data.filter(e => e && e.employee_id && e.status === "active") : []);
    } catch { setEmployeeList([]); }
  }

  useEffect(() => {
    if (tab === "parts") { fetchParts(); if (employeeList.length === 0) loadEmployeeList(); }
    /* eslint-disable-next-line */
  }, [tab]);

  async function savePartsEntry() {
    if (!partsForm.employee_id) { setMessage("เลือกพนักงานก่อน"); return; }
    if (!partsForm.amount || Number(partsForm.amount) <= 0) { setMessage("กรอกจำนวนค่าคอม"); return; }
    setPartsSaving(true); setMessage("");
    try {
      await postAPI({
        action: "commission_parts_manual", mode: "save",
        employee_id: Number(partsForm.employee_id),
        employee_name: partsForm.employee_name,
        month_year: partsMonth,
        amount: Number(partsForm.amount),
        note: partsForm.note,
        created_by: currentUser?.username || currentUser?.email || "",
      });
      setMessage("✅ บันทึกแล้ว");
      setPartsForm({ employee_id: "", employee_name: "", amount: "", note: "" });
      fetchParts();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setPartsSaving(false);
  }

  async function deletePartsEntry(id) {
    if (!window.confirm("ยืนยันลบรายการนี้?")) return;
    try {
      await postAPI({ action: "commission_parts_manual", mode: "delete", id });
      setMessage("✅ ลบแล้ว");
      fetchParts();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  const partsTotal = partsRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const partsEmpCount = new Set(partsRows.map(r => r.employee_id)).size;
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState(null);
  // ===== Exclusions (checkbox ตัดใบขายออกจากการคำนวณ) =====
  const [excludedSet, setExcludedSet] = useState(new Set());
  const [initialExcludedSet, setInitialExcludedSet] = useState(new Set());
  const [savingExcl, setSavingExcl] = useState(false);
  // ===== Snapshot =====
  const [snapshotInfo, setSnapshotInfo] = useState(null);
  const [savingSnap, setSavingSnap] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [snapDetail, setSnapDetail] = useState(null);
  // ===== Payables =====
  const [payOpen, setPayOpen] = useState(false);
  const [payPreview, setPayPreview] = useState([]);
  const [payDocs, setPayDocs] = useState([]);
  const [payLoading, setPayLoading] = useState(false);
  const [payCreating, setPayCreating] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  // ===== Pay popup =====
  const [bankAccounts, setBankAccounts] = useState([]);
  const [payPopup, setPayPopup] = useState(null);
  const [payDate, setPayDate] = useState(todayISO());
  const [payMethod, setPayMethod] = useState("โอน");
  const [payAccountId, setPayAccountId] = useState("");
  const [payNote, setPayNote] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch(ACC_API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_bank_accounts" }),
    }).then(r => r.json()).then(d => {
      setBankAccounts(Array.isArray(d) ? d.filter(a => a && (a.account_id || a.bank_account_id)) : []);
    }).catch(() => setBankAccounts([]));
  }, []);

  async function checkSnapshot() {
    try {
      const data = await postAPI({ action: "commission_normal_snapshot", mode: "check", date_from: dateFrom, date_to: dateTo });
      const arr = Array.isArray(data) ? data : [];
      setSnapshotInfo(arr.length > 0 && arr[0]?.save_group ? arr[0] : null);
    } catch { setSnapshotInfo(null); }
  }

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const data = await postAPI({ action: "commission_normal_summary", date_from: dateFrom, date_to: dateTo });
      setRows(Array.isArray(data) ? data.filter(r => r && r.employee_id) : []);
      checkSnapshot();
    } catch { setRows([]); setMessage("❌ โหลดไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  async function openDetail(emp) {
    setDetail({ emp, rows: [], loading: true });
    try {
      const data = await postAPI({ action: "commission_normal_detail", date_from: dateFrom, date_to: dateTo, employee_id: emp.employee_id });
      const arr = Array.isArray(data) ? data.filter(r => r && r.sale_id) : [];
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

  // helper: brand ตรงสังกัดหรือไม่ (ป.เปา+Honda, สิงห์ชัย+Yamaha → commission)
  const BRANCH_AFF = { SCY01: "สิงห์ชัย", SCY04: "สิงห์ชัย", SCY07: "สิงห์ชัย", SCY05: "ป.เปา", SCY06: "ป.เปา" };
  function isCommissionRow(branch, brand) {
    const aff = BRANCH_AFF[branch];
    if (!aff) return true;
    if (aff === "ป.เปา" && brand === "ฮอนด้า") return true;
    if (aff === "สิงห์ชัย" && brand === "ยามาฮ่า") return true;
    return false;
  }

  function printDetail() {
    if (!detail || !detail.rows || detail.rows.length === 0) return;
    const safe = (v) => String(v == null ? "" : v).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const empBranch = detail.emp?.branch_code;
    const sumComm = detail.rows.filter(r => !excludedSet.has(Number(r.sale_id)) && isCommissionRow(empBranch, r.brand)).reduce((s, r) => s + Number(r.comm_total || 0), 0);
    const sumBrok = detail.rows.filter(r => !excludedSet.has(Number(r.sale_id)) && !isCommissionRow(empBranch, r.brand)).reduce((s, r) => s + Number(r.comm_total || 0), 0);
    const rowsHtml = detail.rows.map((r, i) => {
      const isExcl = excludedSet.has(Number(r.sale_id));
      const cls = isExcl ? ' class="excluded"' : '';
      const isComm = isCommissionRow(empBranch, r.brand);
      const commCell = !isExcl && isComm ? fmt(r.comm_total) : (isExcl && isComm ? "<s>" + fmt(r.comm_total) + "</s>" : "-");
      const brokCell = !isExcl && !isComm ? fmt(r.comm_total) : (isExcl && !isComm ? "<s>" + fmt(r.comm_total) + "</s>" : "-");
      return `<tr${cls}>
        <td>${i + 1}</td>
        <td>${safe(fmtDate(r.sale_date))}</td>
        <td>${safe(r.invoice_no)}</td>
        <td>${safe(r.invoice_type)}</td>
        <td>${safe(r.customer_name)}</td>
        <td>${safe(r.brand)} · ${safe(r.model_series)}</td>
        <td style="text-align:center">${r.idx}</td>
        <td style="text-align:center">${r.target}</td>
        <td style="text-align:center">÷${r.headcount}</td>
        <td class="num">${fmt(r.comm_main)}</td>
        <td class="num">${fmt(r.comm_finance)}</td>
        <td class="num">${commCell}</td>
        <td class="num">${brokCell}</td>
        <td style="text-align:center">${isExcl ? "ไม่คำนวณ" : "✓"}</td>
      </tr>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ค่าคอมปกติ - ${safe(detail.emp?.employee_name)}</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: 'Tahoma','Arial',sans-serif; font-size: 11pt; }
h1 { text-align: center; margin: 0 0 4px; font-size: 16pt; color: #072d6b; }
.head { text-align: center; margin-bottom: 8px; font-size: 11pt; color: #444; }
.summary { display: flex; gap: 20px; justify-content: center; margin: 10px 0 14px; font-size: 12pt; }
.summary .item { padding: 6px 14px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; }
.summary .item b { color: #059669; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #555; padding: 4px 6px; font-size: 9pt; text-align: left; vertical-align: top; }
th { background: #072d6b; color: #fff; font-weight: 700; white-space: nowrap; }
.num { text-align: right; font-family: monospace; font-weight: 600; }
.totalrow { background: #fef9c3; font-weight: 700; }
.totalrow .num { color: #065f46; font-size: 11pt; }
tr.excluded { color: #9ca3af; background: #f9fafb; }
tr.excluded td { text-decoration: line-through; }
.signature { display: flex; justify-content: space-around; margin-top: 40px; font-size: 11pt; }
.signature .box { text-align: center; min-width: 200px; }
.signature .line { border-top: 1px solid #000; margin-bottom: 5px; padding-top: 6px; }
</style></head><body>
<h1>📋 รายงานค่าคอมปกติ (งานขาย)</h1>
<div class="head">
  พนักงาน: <b>${safe(detail.emp?.employee_name)}</b> · สาขา: ${safe(detail.emp?.branch_code)}<br/>
  ช่วงวันที่: ${safe(fmtDate(dateFrom))} ถึง ${safe(fmtDate(dateTo))}<br/>
  พิมพ์เมื่อ: ${new Date().toLocaleString("th-TH")}
</div>
<div class="summary">
  <div class="item">จำนวนใบขาย: <b>${detail.rows.length}</b></div>
  <div class="item">ค่าคอมฯ: <b>${fmt(sumComm)}</b></div>
  <div class="item">ค่านายหน้า: <b>${fmt(sumBrok)}</b></div>
  <div class="item">รวม: <b>${fmt(sumComm + sumBrok)}</b> บาท</div>
</div>
<table>
  <thead><tr>
    <th>#</th><th>วันที่</th><th>เลขใบขาย</th>
    <th>ประเภท</th><th>ลูกค้า</th><th>รุ่น</th>
    <th>idx</th><th>เป้า</th><th>หาร</th>
    <th class="num">หลัก</th><th class="num">ไฟแนนซ์</th>
    <th class="num">ค่าคอมฯ</th><th class="num">ค่านายหน้า</th>
    <th>สถานะ</th>
  </tr></thead>
  <tbody>${rowsHtml}
    <tr class="totalrow">
      <td colspan="11" style="text-align:right">รวมสุทธิ (เฉพาะใบที่คำนวณ)</td>
      <td class="num">${fmt(sumComm)}</td>
      <td class="num">${fmt(sumBrok)}</td>
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

  async function saveSnapshot() {
    if (rows.length === 0) { setMessage("ไม่มีข้อมูลให้บันทึก"); return; }
    let confirmMsg = `ยืนยันบันทึกค่าคอมปกติ?\n\nช่วง: ${dateFrom} ถึง ${dateTo}\nจำนวน ${rows.length} คน, ยอดรวม ${fmt(total)} บาท`;
    if (snapshotInfo) confirmMsg += "\n\n⚠️ มี snapshot ของช่วงนี้อยู่แล้ว — บันทึกใหม่จะ overwrite ของเดิม";
    if (!window.confirm(confirmMsg)) return;
    setSavingSnap(true); setMessage("");
    try {
      // ดึง detail ของพนักงานทุกคน (ไม่ส่ง employee_id = ดึงทั้งหมด)
      const detailData = await postAPI({
        action: "commission_normal_detail",
        date_from: dateFrom, date_to: dateTo,
      });
      const detailRows = Array.isArray(detailData)
        ? detailData.filter(r => r && r.sale_id).map(r => ({
            sale_id: r.sale_id, sale_date: r.sale_date, invoice_no: r.invoice_no,
            invoice_type: r.invoice_type, customer_name: r.customer_name,
            brand: r.brand, model_series: r.model_series, model_code: r.model_code,
            chassis_no: r.chassis_no, branch_code: r.branch_code,
            idx: r.idx, target: r.target, headcount: r.headcount,
            comm_main: r.comm_main, comm_finance: r.comm_finance, comm_total: r.comm_total,
            employee_id: r.employee_id, employee_name: r.employee_name,
            employee_branch_code: r.branch_code,
          }))
        : [];
      await postAPI({
        action: "commission_normal_snapshot", mode: "save",
        date_from: dateFrom, date_to: dateTo,
        saved_by: currentUser?.username || currentUser?.email || "",
        rows: rows.map(r => ({
          employee_id: r.employee_id, employee_name: r.employee_name,
          branch_code: r.branch_code, sales_count: r.sales_count,
          total_main: r.total_main, total_finance: r.total_finance,
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
      const data = await postAPI({ action: "commission_normal_snapshot", mode: "history" });
      setHistoryRows(Array.isArray(data) ? data.filter(r => r && r.save_group) : []);
    } catch { setHistoryRows([]); }
    setHistoryLoading(false);
  }

  async function viewSnapshotDetail(item) {
    setSnapDetail({ save_group: item.save_group, item, rows: [], sales: [], loading: true });
    try {
      const [empData, salesData] = await Promise.all([
        postAPI({ action: "commission_normal_snapshot", mode: "detail", save_group: item.save_group }),
        postAPI({ action: "commission_normal_snapshot", mode: "detail_sales", save_group: item.save_group }),
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
    if (!window.confirm(`ยืนยันยกเลิกการบันทึก?\n\nช่วง: ${item.period_from} ถึง ${item.period_to}\nจำนวน ${item.employee_count} คน\nยอดรวม ${fmt(item.total)} บาท`)) return;
    try {
      await postAPI({ action: "commission_normal_snapshot", mode: "cancel", save_group: item.save_group });
      setMessage("✅ ยกเลิกการบันทึกเรียบร้อย");
      await openHistory();
      checkSnapshot();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  // ===== Combined employees (รวม sales + service + parts) =====
  const [combinedEmployees, setCombinedEmployees] = useState([]);
  const [combinedLoading, setCombinedLoading] = useState(false);

  async function fetchCombinedEmployees() {
    if (!snapshotInfo?.save_group) { setCombinedEmployees([]); return; }
    setCombinedLoading(true);
    try {
      const baseDate = snapshotInfo?.period_from || dateFrom;
      const dt = baseDate ? new Date(baseDate) : NOW;
      const year = dt.getFullYear();
      const month = dt.getMonth() + 1;
      const monthDate = `${year}-${String(month).padStart(2, "0")}-01`;
      // ดึงข้อมูล 3 sources พร้อมกัน — ใช้ detail_sales เพื่อให้รู้ brand แต่ละใบ
      const [salesSalesData, svcCheck, partsRows] = await Promise.all([
        postAPI({ action: "commission_normal_snapshot", mode: "detail_sales", save_group: snapshotInfo.save_group }),
        postAPI({ action: "commission_service_snapshot", mode: "check", year, month }),
        postAPI({ action: "commission_parts_manual", mode: "list", month_year: monthDate }),
      ]);
      const salesArr = Array.isArray(salesSalesData) ? salesSalesData.filter(r => r && r.sale_id) : [];
      const partsArr = Array.isArray(partsRows) ? partsRows.filter(r => r && r.id) : [];
      // ดึง service detail (ถ้ามี snapshot)
      let svcArr = [];
      const svcSnap = Array.isArray(svcCheck) && svcCheck.length > 0 ? svcCheck[0] : null;
      if (svcSnap?.save_group) {
        const svcDetail = await postAPI({ action: "commission_service_snapshot", mode: "detail", save_group: svcSnap.save_group });
        svcArr = Array.isArray(svcDetail) ? svcDetail.filter(r => r && r.snapshot_id) : [];
      }
      // mapping สาขา → สังกัด
      const branchAff = { SCY01: "สิงห์ชัย", SCY04: "สิงห์ชัย", SCY07: "สิงห์ชัย", SCY05: "ป.เปา", SCY06: "ป.เปา" };
      // ค่าคอมฯ = brand ตรงกับสังกัด, ค่านายหน้า = brand ต่าง
      function isCommission(branch, brand) {
        const aff = branchAff[branch];
        if (!aff) return true; // ถ้าไม่รู้สังกัด ถือเป็น commission
        if (aff === "ป.เปา" && brand === "ฮอนด้า") return true;
        if (aff === "สิงห์ชัย" && brand === "ยามาฮ่า") return true;
        return false;
      }
      const map = new Map();
      // Sales — แยก commission vs brokerage ตาม brand × สังกัด
      // ใช้ comm_total (ไม่ใช่ per_emp_amount) — เป็น field ใน commission_normal_snapshot_sales
      for (const r of salesArr) {
        const key = r.employee_name;
        if (!map.has(key)) map.set(key, { name: r.employee_name, branch_code: r.employee_branch_code, sales_commission: 0, sales_brokerage: 0, service: 0, parts: 0, total: 0 });
        const g = map.get(key);
        const amt = Number(r.comm_total || 0);
        if (isCommission(r.employee_branch_code || r.branch_code, r.brand)) g.sales_commission += amt;
        else g.sales_brokerage += amt;
      }
      // Service (mechanic_name)
      for (const r of svcArr) {
        const key = r.mechanic_name;
        if (!map.has(key)) map.set(key, { name: r.mechanic_name, branch_code: "(ช่างซ่อม)", sales_commission: 0, sales_brokerage: 0, service: 0, parts: 0, total: 0 });
        const g = map.get(key);
        g.service += Number(r.total_commission || 0);
      }
      // Parts
      for (const r of partsArr) {
        const key = r.employee_name;
        if (!map.has(key)) map.set(key, { name: r.employee_name, branch_code: "(อะไหล่)", sales_commission: 0, sales_brokerage: 0, service: 0, parts: 0, total: 0 });
        const g = map.get(key);
        g.parts += Number(r.amount || 0);
      }
      const list = [...map.values()].map(g => ({ ...g, total: g.sales_commission + g.sales_brokerage + g.service + g.parts }));
      list.sort((a, b) => b.total - a.total);
      setCombinedEmployees(list);
    } catch { setCombinedEmployees([]); }
    setCombinedLoading(false);
  }
  useEffect(() => { if (tab === "pay" && snapshotInfo?.save_group) fetchCombinedEmployees(); /* eslint-disable-next-line */ }, [tab, snapshotInfo?.save_group]);

  // ===== Pay history tab =====
  const [payHistoryRows, setPayHistoryRows] = useState([]);
  const [payHistoryLoading, setPayHistoryLoading] = useState(false);
  const [payHistoryFrom, setPayHistoryFrom] = useState(firstOfMonth());
  const [payHistoryTo, setPayHistoryTo] = useState(todayISO());

  async function fetchPayHistory() {
    setPayHistoryLoading(true);
    try {
      const data = await postAPI({
        action: "commission_normal_payables", mode: "list_paid_history",
        date_from: payHistoryFrom, date_to: payHistoryTo,
      });
      setPayHistoryRows(Array.isArray(data) ? data.filter(d => d && d.expense_doc_id) : []);
    } catch { setPayHistoryRows([]); }
    setPayHistoryLoading(false);
  }
  useEffect(() => { if (tab === "history") fetchPayHistory(); /* eslint-disable-next-line */ }, [tab]);
  useEffect(() => {
    if (tab === "pay") openPayables();
    else setPayOpen(false); // ปิด modal เมื่อสลับออกจาก tab pay
    /* eslint-disable-next-line */
  }, [tab, snapshotInfo?.save_group]);

  // ===== Payables (รวม sales + service + parts) =====
  async function getPayablesContext() {
    // derive year/month จาก period_from ของ snapshot หรือ dateFrom
    const baseDate = snapshotInfo?.period_from || dateFrom;
    const dt = baseDate ? new Date(baseDate) : NOW;
    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;
    const month_year = `${year}-${String(month).padStart(2, "0")}-01`;
    // ดึงจาก service snapshot ของเดือน (ไม่ดึง real-time แล้ว — ต้องมี snapshot)
    let svcHondaAmount = 0, svcYamahaAmount = 0;
    try {
      const checkData = await postAPI({ action: "commission_service_snapshot", mode: "check", year, month });
      const snap = Array.isArray(checkData) && checkData.length > 0 ? checkData[0] : null;
      if (snap?.save_group) {
        const detail = await postAPI({ action: "commission_service_snapshot", mode: "detail", save_group: snap.save_group });
        const arr = Array.isArray(detail) ? detail.filter(r => r && r.snapshot_id) : [];
        svcHondaAmount = arr.reduce((s, r) => s + Number(r.honda_commission || 0), 0);
        svcYamahaAmount = arr.reduce((s, r) => s + Number(r.yamaha_commission || 0), 0);
      }
    } catch { /* ignore */ }
    return { month_year, service_honda_amount: svcHondaAmount, service_yamaha_amount: svcYamahaAmount };
  }

  async function openPayables() {
    if (!snapshotInfo?.save_group) { setMessage("ต้องบันทึก snapshot จาก tab 'งานขาย' ก่อน"); return; }
    setPayOpen(true); setPayLoading(true); setPayPreview([]); setPayDocs([]);
    try {
      const ctx = await getPayablesContext();
      const [preview, docs] = await Promise.all([
        postAPI({ action: "commission_normal_payables", mode: "preview", save_group: snapshotInfo.save_group, ...ctx }),
        postAPI({ action: "commission_normal_payables", mode: "list_docs", save_group: snapshotInfo.save_group }),
      ]);
      const previewArr = Array.isArray(preview) ? preview : [];
      setPayPreview(previewArr);
      setPayDocs(Array.isArray(docs) ? docs.filter(d => d && d.expense_doc_id) : []);
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
      const ctx = await getPayablesContext();
      await postAPI({
        action: "commission_normal_payables", mode: "create",
        save_group: snapshotInfo.save_group,
        selected_groups: [...selectedGroups],
        created_by: currentUser?.username || currentUser?.email || "",
        ...ctx,
      });
      setMessage("✅ สร้างเอกสารจ่ายเงินเรียบร้อย");
      await openPayables();
    } catch { setMessage("❌ สร้างไม่สำเร็จ"); }
    setPayCreating(false);
  }

  // สร้างเฉพาะใบที่ขาด — กรณีสร้างรอบแรกตอนข้อมูลยังไม่ครบทุกกลุ่ม (เช่นข้อมูลอีกสังกัดตามมาทีหลัง)
  // backend mode=create มี NOT EXISTS กันซ้ำรายกลุ่มอยู่แล้ว จึงสร้างเฉพาะกลุ่มที่ยังไม่มีเอกสาร
  async function createMissingPayables(groupNos) {
    if (!snapshotInfo?.save_group || !groupNos.length) return;
    if (!window.confirm(`สร้างเอกสารที่ขาด ${groupNos.length} ใบ?\n(ใบที่มีอยู่แล้วจะไม่ถูกสร้างซ้ำ)`)) return;
    setPayCreating(true);
    try {
      const ctx = await getPayablesContext();
      await postAPI({
        action: "commission_normal_payables", mode: "create",
        save_group: snapshotInfo.save_group,
        selected_groups: groupNos,
        created_by: currentUser?.username || currentUser?.email || "",
        ...ctx,
      });
      setMessage("✅ สร้างเอกสารที่ขาดเรียบร้อย");
      await openPayables();
    } catch { setMessage("❌ สร้างไม่สำเร็จ"); }
    setPayCreating(false);
  }

  async function cancelPayables() {
    if (!snapshotInfo?.save_group) return;
    if (!window.confirm("ยืนยันยกเลิกเอกสารจ่ายเงินทั้งหมด?\n\n⚠️ เอกสารที่จ่ายแล้วจะไม่ถูกลบ")) return;
    try {
      const data = await postAPI({ action: "commission_normal_payables", mode: "cancel", save_group: snapshotInfo.save_group });
      const err = Array.isArray(data) && data[0]?.error;
      if (err) { setMessage(`❌ ${err}`); return; }
      setMessage("✅ ยกเลิกเอกสารแล้ว");
      await openPayables();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

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
          action: "expense_record", op: "save_payment",
          expense_doc_ids: [payPopup.doc.expense_doc_id],
          paid_date: payDate, payment_method: payMethod, payment_note: payNote,
          paid_by: currentUser?.name || currentUser?.username || "system",
          from_bank_account_id: payMethod === "โอน" ? Number(payAccountId) : null,
        }),
      });
      const data = await res.json();
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.error_msg) throw new Error(result.error_msg);
      setMessage(`✅ บันทึกจ่ายสำเร็จ — เลขจ่าย: ${result?.paid_doc_no || "-"}`);
      setPayPopup(null);
      await openPayables();
    } catch (e) { alert("❌ บันทึกจ่ายไม่สำเร็จ: " + e.message); }
    setPaying(false);
  }

  const total = rows.reduce((s, r) => s + Number(r.total_commission || 0), 0);
  const totalMain = rows.reduce((s, r) => s + Number(r.total_main || 0), 0);
  const totalFinance = rows.reduce((s, r) => s + Number(r.total_finance || 0), 0);
  const totalSales = rows.reduce((s, r) => s + Number(r.sales_count || 0), 0);
  const uniqueSales = Number(rows[0]?.total_unique_sales || 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💵 รายงานค่าคอมปกติ</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, borderBottom: "2px solid #e5e7eb", flexWrap: "wrap" }}>
        {[
          ["sales", "🚗 งานขาย"],
          ["service", "🔧 งานบริการ"],
          ["parts", "🔩 งานอะไหล่"],
          ["pay", "💵 บันทึกการจ่ายเงิน"],
          ["history", "📜 ประวัติการจ่าย"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{
              padding: "8px 18px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14,
              background: tab === v ? "#072d6b" : "transparent",
              color: tab === v ? "#fff" : "#374151",
              borderRadius: "8px 8px 0 0",
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "pay" ? (
        <div style={{ padding: 30, textAlign: "center", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
          {!snapshotInfo?.save_group ? (
            <>
              <div style={{ fontSize: 50, marginBottom: 12 }}>⚠️</div>
              <h3 style={{ margin: "0 0 8px", color: "#374151" }}>ยังไม่มี snapshot ของช่วงนี้</h3>
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 14 }}>
                กรุณาไปที่ tab "🚗 งานขาย" → กด "💾 บันทึก" snapshot ก่อน<br/>
                ระบบจะดึงข้อมูลจาก งานขาย + งานบริการ + งานอะไหล่ ของเดือนนั้นมาคำนวณ
              </div>
              <button onClick={() => setTab("sales")}
                style={{ padding: "8px 20px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                ไปที่ tab "งานขาย"
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 50, marginBottom: 12 }}>💵</div>
              <div style={{ marginBottom: 12, fontSize: 14, color: "#374151" }}>
                Snapshot ของ {fmtDate(snapshotInfo?.period_from)} – {fmtDate(snapshotInfo?.period_to)} · {snapshotInfo?.row_count} คน · {fmt(snapshotInfo?.total)} บาท
              </div>
              <button onClick={openPayables}
                style={{ padding: "10px 24px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
                💵 เปิด/รีโหลด การจ่ายเงิน
              </button>
            </>
          )}
        </div>
      ) : null}

      {tab === "pay" && snapshotInfo?.save_group && (
        <div style={{ marginTop: 14, background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h4 style={{ margin: 0, color: "#072d6b" }}>👥 รายชื่อพนักงานที่ได้รับค่าคอม ({combinedEmployees.length} คน)</h4>
            <button onClick={fetchCombinedEmployees} disabled={combinedLoading}
              style={{ padding: "5px 12px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12 }}>
              {combinedLoading ? "..." : "🔄 รีเฟรช"}
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f0f4f9" }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>ชื่อ</th>
                  <th style={th}>สาขา/ประเภท</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าคอมฯงานขาย</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่านายหน้างานขาย</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าคอมฯงานบริการ</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าคอมฯงานอะไหล่</th>
                  <th style={{ ...th, textAlign: "right" }}>รวม</th>
                </tr>
              </thead>
              <tbody>
                {combinedLoading && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                {!combinedLoading && combinedEmployees.length === 0 && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                {combinedEmployees.map((g, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{g.name}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{g.branch_code}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{g.sales_commission ? fmt(g.sales_commission) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{g.sales_brokerage ? fmt(g.sales_brokerage) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{g.service ? fmt(g.service) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{g.parts ? fmt(g.parts) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(g.total)}</td>
                  </tr>
                ))}
                {combinedEmployees.length > 0 && (() => {
                  const sumComm = combinedEmployees.reduce((s, g) => s + g.sales_commission, 0);
                  const sumBrok = combinedEmployees.reduce((s, g) => s + g.sales_brokerage, 0);
                  const sumService = combinedEmployees.reduce((s, g) => s + g.service, 0);
                  const sumParts = combinedEmployees.reduce((s, g) => s + g.parts, 0);
                  const sumTotal = sumComm + sumBrok + sumService + sumParts;
                  return (
                    <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                      <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม {combinedEmployees.length} คน</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(sumComm)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(sumBrok)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(sumService)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(sumParts)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#059669" }}>{fmt(sumTotal)}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "history" ? (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
            <span>วันที่จ่าย ตั้งแต่:</span>
            <input type="date" value={payHistoryFrom} onChange={e => setPayHistoryFrom(e.target.value)} style={inp} />
            <span>ถึง:</span>
            <input type="date" value={payHistoryTo} onChange={e => setPayHistoryTo(e.target.value)} style={inp} />
            <button onClick={fetchPayHistory} disabled={payHistoryLoading} style={btnBlue}>{payHistoryLoading ? "..." : "🔄 รีเฟรช"}</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
            <Card label="📄 เอกสารที่จ่ายแล้ว" value={payHistoryRows.length} color="#0369a1" />
            <Card label="💰 ยอดสุทธิรวม" value={fmt(payHistoryRows.reduce((s, r) => s + Number(r.net_to_pay || 0), 0))} color="#059669" highlight />
            <Card label="📉 หัก ณ ที่จ่ายรวม" value={fmt(payHistoryRows.reduce((s, r) => s + Number(r.withholding_amount || 0), 0))} color="#dc2626" />
          </div>

          <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>เลขที่</th>
                  <th style={th}>วันที่จ่าย</th>
                  <th style={th}>เลขที่จ่าย</th>
                  <th style={th}>รายการ</th>
                  <th style={th}>วิธี</th>
                  <th style={th}>บัญชี</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                  <th style={{ ...th, textAlign: "right" }}>หัก ณ ที่จ่าย</th>
                  <th style={{ ...th, textAlign: "right" }}>สุทธิ</th>
                </tr>
              </thead>
              <tbody>
                {payHistoryLoading && <tr><td colSpan={9} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                {!payHistoryLoading && payHistoryRows.length === 0 && <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีประวัติการจ่ายในช่วงนี้</td></tr>}
                {payHistoryRows.map(d => (
                  <tr key={d.expense_doc_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ ...td, fontFamily: "monospace" }}>{d.expense_doc_no}</td>
                    <td style={td}>{d.paid_at ? new Date(d.paid_at).toLocaleString("th-TH") : "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", color: "#065f46", fontWeight: 600 }}>{d.paid_doc_no || "-"}</td>
                    <td style={td}>{d.vendor_name}</td>
                    <td style={td}>{d.payment_method || "-"}</td>
                    <td style={{ ...td, fontSize: 11 }}>{d.bank_name ? `${d.bank_name} · ${d.account_no || ""}` : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(d.subtotal)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{Number(d.withholding_amount) > 0 ? `-${fmt(d.withholding_amount)}` : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(d.net_to_pay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === "parts" ? (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
            <span>เดือน:</span>
            <input type="month" value={partsMonth} onChange={e => setPartsMonth(e.target.value)} style={inp} />
            <button onClick={fetchParts} disabled={partsLoading} style={btnBlue}>{partsLoading ? "..." : "🔄 รีเฟรช"}</button>
          </div>

          {message && <div style={{ padding: 10, marginBottom: 10, color: message.startsWith("✅") ? "#065f46" : "#b91c1c", background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", borderRadius: 6 }}>{message}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
            <Card label="👥 พนักงาน" value={partsEmpCount} color="#1e40af" />
            <Card label="📋 รายการ" value={partsRows.length} color="#0369a1" />
            <Card label="💰 ยอดรวม" value={fmt(partsTotal)} color="#059669" highlight />
          </div>

          <div style={{ padding: 14, marginBottom: 14, background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <h4 style={{ margin: "0 0 10px", color: "#072d6b" }}>➕ เพิ่มรายการ</h4>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr auto", gap: 8, alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>พนักงาน *</label>
                <select value={partsForm.employee_id}
                  onChange={e => {
                    const id = e.target.value;
                    const emp = employeeList.find(x => String(x.employee_id) === String(id));
                    setPartsForm(f => ({ ...f, employee_id: id, employee_name: emp?.employee_name || "" }));
                  }}
                  style={{ ...inp, width: "100%" }}>
                  <option value="">-- เลือกพนักงาน --</option>
                  {employeeList.map(e => (
                    <option key={e.employee_id} value={e.employee_id}>
                      {e.employee_name} ({e.branch_code || "-"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>จำนวนค่าคอม *</label>
                <input type="number" step="0.01" min="0" value={partsForm.amount}
                  onChange={e => setPartsForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  style={{ ...inp, width: "100%", fontFamily: "monospace", textAlign: "right" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>หมายเหตุ</label>
                <input value={partsForm.note}
                  onChange={e => setPartsForm(f => ({ ...f, note: e.target.value }))}
                  style={{ ...inp, width: "100%" }} />
              </div>
              <button onClick={savePartsEntry} disabled={partsSaving}
                style={{ padding: "8px 18px", background: partsSaving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: partsSaving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>
                {partsSaving ? "..." : "💾 บันทึก"}
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>พนักงาน</th>
                  <th style={{ ...th, textAlign: "right" }}>จำนวนค่าคอม</th>
                  <th style={th}>หมายเหตุ</th>
                  <th style={th}>บันทึกเมื่อ</th>
                  <th style={th}>โดย</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {partsLoading && <tr><td colSpan={7} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                {!partsLoading && partsRows.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</td></tr>}
                {partsRows.map((r, i) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.employee_name}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.amount)}</td>
                    <td style={td}>{r.note || "-"}</td>
                    <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>{r.created_at ? new Date(r.created_at).toLocaleString("th-TH") : "-"}</td>
                    <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>{r.created_by || "-"}</td>
                    <td style={td}>
                      <button onClick={() => deletePartsEntry(r.id)}
                        style={{ padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                        🗑 ลบ
                      </button>
                    </td>
                  </tr>
                ))}
                {partsRows.length > 0 && (
                  <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                    <td colSpan={2} style={{ ...td, textAlign: "right" }}>รวม</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(partsTotal)}</td>
                    <td colSpan={4}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === "service" ? (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
            <span>ปี:</span>
            <input type="number" value={svcYear} onChange={e => setSvcYear(e.target.value)} style={{ ...inp, width: 90 }} />
            <span>เดือน:</span>
            <select value={svcMonth} onChange={e => setSvcMonth(e.target.value)} style={{ ...inp, width: 90 }}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={fetchService} disabled={svcLoading} style={btnBlue}>{svcLoading ? "..." : "🔄 ค้นหา"}</button>
            <button onClick={saveSvcSnapshot} disabled={svcSavingSnap || svcLoading || serviceMechanics.length === 0}
              style={{ padding: "7px 14px", background: svcSavingSnap ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: svcSavingSnap || svcLoading ? "not-allowed" : "pointer", fontWeight: 600 }}>
              {svcSavingSnap ? "..." : "💾 บันทึก snapshot"}
            </button>
            <button onClick={openSvcHistory}
              style={{ padding: "7px 14px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
              📋 ประวัติ
            </button>
          </div>

          {svcSnapshotInfo && (
            <div style={{ padding: "8px 12px", marginBottom: 10, background: "#d1fae5", borderRadius: 6, fontSize: 13, color: "#065f46" }}>
              ℹ️ เดือนนี้บันทึกแล้ว — เมื่อ {svcSnapshotInfo.saved_at ? new Date(svcSnapshotInfo.saved_at).toLocaleString("th-TH") : "-"} โดย {svcSnapshotInfo.saved_by || "ผู้ดูแลระบบ"} ({svcSnapshotInfo.row_count} คน, ยอดคอม {fmt(svcSnapshotInfo.total)} บาท)
            </div>
          )}

          {message && <div style={{ padding: 10, marginBottom: 10, color: message.startsWith("✅") ? "#065f46" : "#b91c1c", background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", borderRadius: 6 }}>{message}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
            <Card label="🧑‍🔧 ช่างซ่อม" value={serviceMechanics.length} color="#1e40af" />
            <Card label="🔴 Honda ค่าแรง" value={fmt(svcHondaSum)} color="#dc2626" />
            <Card label="🔵 Yamaha ค่าแรง" value={fmt(svcYamahaSum)} color="#0369a1" />
            <Card label="💰 ค่าคอมรวม (65%)" value={fmt(svcTotalCommission)} color="#059669" highlight />
          </div>

          <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>ช่างซ่อม</th>
                  <th style={{ ...th, textAlign: "right" }}>Honda Jobs</th>
                  <th style={{ ...th, textAlign: "right" }}>Honda ค่าแรง</th>
                  <th style={{ ...th, textAlign: "right", background: "#fecaca", color: "#7f1d1d" }}>Honda คอม (65%)</th>
                  <th style={{ ...th, textAlign: "right" }}>Yamaha Jobs</th>
                  <th style={{ ...th, textAlign: "right" }}>Yamaha ค่าแรง</th>
                  <th style={{ ...th, textAlign: "right" }}>Yamaha เช็ครถ</th>
                  <th style={{ ...th, textAlign: "right" }}>Yamaha รวม</th>
                  <th style={{ ...th, textAlign: "right", background: "#bfdbfe", color: "#1e3a8a" }}>Yamaha คอม (65%)</th>
                  <th style={{ ...th, textAlign: "right", background: "#bbf7d0", color: "#14532d" }}>ค่าคอมรวม</th>
                </tr>
              </thead>
              <tbody>
                {svcLoading && <tr><td colSpan={11} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                {!svcLoading && serviceMechanics.length === 0 && <tr><td colSpan={11} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                {serviceMechanics.map((g, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{g.mechanic_name}</td>
                    <td style={{ ...td, textAlign: "right" }}>{g.honda_jobs || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{g.honda_labor ? fmt(g.honda_labor) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, background: "#fee2e2", color: "#7f1d1d" }}>{g.honda_commission ? fmt(g.honda_commission) : "-"}</td>
                    <td style={{ ...td, textAlign: "right" }}>{g.yamaha_jobs || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{g.yamaha_labor ? fmt(g.yamaha_labor) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#9333ea" }}>{g.yamaha_check_fee ? fmt(g.yamaha_check_fee) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{g.yamaha_total ? fmt(g.yamaha_total) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, background: "#dbeafe", color: "#1e3a8a" }}>{g.yamaha_commission ? fmt(g.yamaha_commission) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: "#dcfce7", color: "#14532d" }}>{fmt(g.total_commission)}</td>
                  </tr>
                ))}
                {serviceMechanics.length > 0 && (
                  <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                    <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(svcHondaSum)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#7f1d1d" }}>{fmt(svcHondaSum * 0.65)}</td>
                    <td></td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(svcYamahaSum)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#9333ea" }}>{fmt(svcYamahaCheckSum)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(svcYamahaSum + svcYamahaCheckSum)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#1e3a8a" }}>{fmt((svcYamahaSum + svcYamahaCheckSum) * 0.65)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#14532d" }}>{fmt(svcTotalCommission)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
      <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
        <button onClick={saveSnapshot} disabled={savingSnap || loading || rows.length === 0}
          style={{ padding: "7px 14px", background: savingSnap ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: savingSnap || loading ? "not-allowed" : "pointer", fontWeight: 600 }}>
          {savingSnap ? "..." : "💾 บันทึก"}
        </button>
        <button onClick={openHistory}
          style={{ padding: "7px 14px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          📋 ประวัติ snapshot
        </button>
      </div>

      {snapshotInfo && (
        <div style={{ padding: "8px 12px", marginBottom: 10, background: "#d1fae5", borderRadius: 6, fontSize: 13, color: "#065f46" }}>
          ℹ️ ช่วงนี้บันทึกแล้ว — เมื่อ {snapshotInfo.saved_at ? new Date(snapshotInfo.saved_at).toLocaleString("th-TH") : "-"} โดย {snapshotInfo.saved_by || "ผู้ดูแลระบบ"} ({snapshotInfo.row_count} คน, ยอดรวม {fmt(snapshotInfo.total)} บาท)
        </div>
      )}

      {message && <div style={{ padding: 10, marginBottom: 10, color: message.startsWith("✅") ? "#065f46" : "#b91c1c", background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", borderRadius: 6 }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        <Card label="👥 พนักงาน" value={rows.length} color="#1e40af" />
        <Card label="🚗 ใบขาย" value={uniqueSales || totalSales} color="#0369a1" />
        <Card label="💰 ค่าคอมรวม" value={fmt(total)} color="#059669" highlight />
      </div>

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>#</th><th style={th}>พนักงาน</th><th style={th}>สาขา</th>
              <th style={{ ...th, textAlign: "right" }}>จำนวนใบขาย</th>
              <th style={{ ...th, textAlign: "right" }}>ค่าคอมหลัก</th>
              <th style={{ ...th, textAlign: "right" }}>ค่าคอมไฟแนนซ์ (05/06)</th>
              <th style={{ ...th, textAlign: "right", background: "#dcfce7", color: "#14532d" }}>ค่าคอมฯ</th>
              <th style={{ ...th, textAlign: "right", background: "#fed7aa", color: "#7c2d12" }}>ค่านายหน้า</th>
              <th style={{ ...th, textAlign: "right" }}>รวม</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.employee_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, fontWeight: 600 }}>{r.employee_name}</td>
                <td style={{ ...td, fontFamily: "monospace" }}>{r.branch_code || "-"}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.sales_count}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.total_main)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.total_finance)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, background: "#f0fdf4", color: "#15803d" }}>{Number(r.total_commission_only) > 0 ? fmt(r.total_commission_only) : "-"}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600, background: "#fff7ed", color: "#c2410c" }}>{Number(r.total_brokerage) > 0 ? fmt(r.total_brokerage) : "-"}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.total_commission)}</td>
                <td style={td}><button onClick={() => openDetail(r)} style={btnSmBlue}>📋 รายละเอียด</button></td>
              </tr>
            ))}
            {rows.length > 0 && (() => {
              const sumComm = rows.reduce((s, r) => s + Number(r.total_commission_only || 0), 0);
              const sumBrok = rows.reduce((s, r) => s + Number(r.total_brokerage || 0), 0);
              return (
                <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                  <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม</td>
                  <td style={{ ...td, textAlign: "right" }}>{totalSales}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(totalMain)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(totalFinance)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#15803d" }}>{fmt(sumComm)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#c2410c" }}>{fmt(sumBrok)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(total)}</td>
                  <td></td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1400, width: "95%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
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
              💡 ติ๊ก "ไม่คำนวณ" เพื่อตัดใบขายออก (กระทบทุกพนักงานที่ขายร่วม) — กด "บันทึก" เมื่อพร้อม
            </div>
            {detail.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f0f4f9" }}>
                  <tr>
                    <th style={{ ...th, textAlign: "center", width: 70 }}>ไม่คำนวณ</th>
                    <th style={th}>#</th><th style={th}>วันที่</th><th style={th}>เลขใบขาย</th>
                    <th style={th}>ประเภท</th><th style={th}>ลูกค้า</th><th style={th}>รุ่น</th>
                    <th style={{ ...th, textAlign: "center" }}>idx</th>
                    <th style={{ ...th, textAlign: "center" }}>เป้า</th>
                    <th style={{ ...th, textAlign: "center" }}>หาร</th>
                    <th style={{ ...th, textAlign: "right" }}>ค่าคอมหลัก</th>
                    <th style={{ ...th, textAlign: "right" }}>ค่าคอมไฟแนนซ์</th>
                    <th style={{ ...th, textAlign: "right", background: "#dcfce7", color: "#14532d" }}>ค่าคอมฯ</th>
                    <th style={{ ...th, textAlign: "right", background: "#fed7aa", color: "#7c2d12" }}>ค่านายหน้า</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.rows.length === 0 && <tr><td colSpan={14} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                  {detail.rows.map((r, i) => {
                    const sid = Number(r.sale_id);
                    const isExcluded = excludedSet.has(sid);
                    const empBranch = detail.emp?.branch_code;
                    const isComm = isCommissionRow(empBranch, r.brand);
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
                        <td style={td}>{r.invoice_type}</td>
                        <td style={td}>{r.customer_name}</td>
                        <td style={td}>{r.brand} · {r.model_series}</td>
                        <td style={{ ...td, textAlign: "center" }}>{r.idx == null ? "-" : r.idx}</td>
                        <td style={{ ...td, textAlign: "center" }}>{r.target}</td>
                        <td style={{ ...td, textAlign: "center" }}>÷{r.headcount}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{isExcluded ? "-" : fmt(r.comm_main)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{isExcluded ? "-" : fmt(r.comm_finance)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: isComm && !isExcluded ? "#f0fdf4" : "transparent", color: isExcluded ? "#9ca3af" : (isComm ? "#15803d" : "#9ca3af") }}>{isExcluded || !isComm ? "-" : fmt(r.comm_total)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, background: !isComm && !isExcluded ? "#fff7ed" : "transparent", color: isExcluded ? "#9ca3af" : (!isComm ? "#c2410c" : "#9ca3af") }}>{isExcluded || isComm ? "-" : fmt(r.comm_total)}</td>
                      </tr>
                    );
                  })}
                  {detail.rows.length > 0 && (() => {
                    const empBranch = detail.emp?.branch_code;
                    const sumComm = detail.rows.filter(r => !excludedSet.has(Number(r.sale_id)) && isCommissionRow(empBranch, r.brand)).reduce((s, r) => s + Number(r.comm_total || 0), 0);
                    const sumBrok = detail.rows.filter(r => !excludedSet.has(Number(r.sale_id)) && !isCommissionRow(empBranch, r.brand)).reduce((s, r) => s + Number(r.comm_total || 0), 0);
                    return (
                      <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                        <td colSpan={12} style={{ ...td, textAlign: "right" }}>รวม (เฉพาะใบที่คำนวณ)</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#15803d" }}>{fmt(sumComm)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#c2410c" }}>{fmt(sumBrok)}</td>
                      </tr>
                    );
                  })()}
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
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1100, width: "94%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 ประวัติการบันทึกค่าคอมปกติ</h3>
              <button onClick={() => { setHistoryOpen(false); setSnapDetail(null); }} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {historyLoading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f0f4f9" }}>
                  <tr>
                    <th style={th}>ช่วง</th><th style={th}>บันทึกเมื่อ</th><th style={th}>โดย</th>
                    <th style={{ ...th, textAlign: "right" }}>คน</th>
                    <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีประวัติ</td></tr>}
                  {historyRows.map((h, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{fmtDate(h.period_from)} – {fmtDate(h.period_to)}</td>
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

      {/* Snapshot detail modal */}
      {snapDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100 }}
             onClick={() => setSnapDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1300, width: "94%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
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
                      <th style={{ ...th, textAlign: "right" }}>ค่าคอมหลัก</th>
                      <th style={{ ...th, textAlign: "right" }}>ค่าคอมไฟแนนซ์</th>
                      <th style={{ ...th, textAlign: "right" }}>รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapDetail.rows.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                    {snapDetail.rows.map((r, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{r.employee_name}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.employee_branch_code || "-"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{r.sales_count}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.total_main)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.total_finance)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.total_commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h4 style={{ margin: "8px 0", color: "#374151" }}>🚗 รายการรถที่ใช้คำนวณ ({snapDetail.sales?.length || 0})</h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: "#f0f4f9" }}>
                    <tr>
                      <th style={th}>#</th><th style={th}>วันที่</th><th style={th}>เลขใบขาย</th>
                      <th style={th}>ประเภท</th><th style={th}>รุ่น</th><th style={th}>พนักงาน</th>
                      <th style={{ ...th, textAlign: "center" }}>idx</th>
                      <th style={{ ...th, textAlign: "center" }}>หาร</th>
                      <th style={{ ...th, textAlign: "right" }}>ค่าคอมหลัก</th>
                      <th style={{ ...th, textAlign: "right" }}>ไฟแนนซ์</th>
                      <th style={{ ...th, textAlign: "right" }}>รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!snapDetail.sales || snapDetail.sales.length === 0) && <tr><td colSpan={11} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูลรถ (snapshot บันทึกก่อน feature นี้)</td></tr>}
                    {(snapDetail.sales || []).map((r, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={td}>{i + 1}</td>
                        <td style={td}>{fmtDate(r.sale_date)}</td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{r.invoice_no}</td>
                        <td style={td}>{r.invoice_type}</td>
                        <td style={td}>{r.brand} · {r.model_series}</td>
                        <td style={td}>{r.employee_name}</td>
                        <td style={{ ...td, textAlign: "center" }}>{r.idx}</td>
                        <td style={{ ...td, textAlign: "center" }}>÷{r.headcount}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.comm_main)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.comm_finance)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.comm_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}

      {/* Service snapshot history modal */}
      {svcHistoryOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => { setSvcHistoryOpen(false); setSvcSnapDetail(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1100, width: "94%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 ประวัติการบันทึก snapshot งานบริการ</h3>
              <button onClick={() => { setSvcHistoryOpen(false); setSvcSnapDetail(null); }} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {svcHistoryLoading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f0f4f9" }}>
                  <tr>
                    <th style={th}>ปี/เดือน</th>
                    <th style={th}>บันทึกเมื่อ</th>
                    <th style={th}>โดย</th>
                    <th style={{ ...th, textAlign: "right" }}>คน</th>
                    <th style={{ ...th, textAlign: "right" }}>Honda ค่าแรง</th>
                    <th style={{ ...th, textAlign: "right" }}>Yamaha ค่าแรง</th>
                    <th style={{ ...th, textAlign: "right" }}>ยอดคอมรวม</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {svcHistoryRows.length === 0 && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีประวัติ</td></tr>}
                  {svcHistoryRows.map((h, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{h.period_year}/{String(h.period_month).padStart(2,"0")}</td>
                      <td style={td}>{h.saved_at ? new Date(h.saved_at).toLocaleString("th-TH") : "-"}</td>
                      <td style={td}>{h.saved_by || "-"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{h.mechanic_count}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(h.total_honda_labor)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(h.total_yamaha_labor)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(h.total)}</td>
                      <td style={td}>
                        <button onClick={() => viewSvcSnapDetail(h)} style={btnSmBlue}>👁️ ดู</button>
                        <button onClick={() => cancelSvcSnapshot(h)} style={{ marginLeft: 4, padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>🗑 ยกเลิก</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Service snapshot detail (nested) */}
      {svcSnapDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100 }}
             onClick={() => setSvcSnapDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1100, width: "94%", maxHeight: "88vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📋 ปี {svcSnapDetail.item?.period_year}/เดือน {svcSnapDetail.item?.period_month} · ยอดคอม {fmt(svcSnapDetail.item?.total)}</h3>
              <button onClick={() => setSvcSnapDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {svcSnapDetail.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f0f4f9" }}>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>ช่างซ่อม</th>
                    <th style={{ ...th, textAlign: "right" }}>Honda Jobs</th>
                    <th style={{ ...th, textAlign: "right" }}>Honda ค่าแรง</th>
                    <th style={{ ...th, textAlign: "right" }}>Honda คอม</th>
                    <th style={{ ...th, textAlign: "right" }}>Yamaha Jobs</th>
                    <th style={{ ...th, textAlign: "right" }}>Yamaha ค่าแรง</th>
                    <th style={{ ...th, textAlign: "right" }}>Yamaha คอม</th>
                    <th style={{ ...th, textAlign: "right" }}>ค่าคอมรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {svcSnapDetail.rows.length === 0 && <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                  {svcSnapDetail.rows.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{r.mechanic_name}</td>
                      <td style={{ ...td, textAlign: "right" }}>{r.honda_jobs || "-"}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{r.honda_labor ? fmt(r.honda_labor) : "-"}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#7f1d1d" }}>{r.honda_commission ? fmt(r.honda_commission) : "-"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{r.yamaha_jobs || "-"}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{r.yamaha_labor ? fmt(r.yamaha_labor) : "-"}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#1e3a8a" }}>{r.yamaha_commission ? fmt(r.yamaha_commission) : "-"}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.total_commission)}</td>
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
              <h3 style={{ margin: 0, color: "#072d6b" }}>💵 บันทึกการจ่ายเงินค่าคอมปกติ</h3>
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
                      const subtotal = Math.round((net + wht) * 100) / 100;
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

      {/* Pay popup */}
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
      </>
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
