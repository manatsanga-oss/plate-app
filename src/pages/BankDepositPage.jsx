import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/finance-api";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const RECEIPTS_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/list-daily-receipts";

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtDateShort(v) {
  if (!v) return "-";
  const s = String(v).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543}` : s;
}
function addDays(ymd, n) {
  const d = new Date(ymd + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* จับคู่ยอดเงินสดรายวัน (รับ−จ่าย) กับรายการฝากจริง ต่อสาขา
   รอบแรก: หายอดฝากใบเดียวที่ตรงกัน (±1 บาท เพราะฝากปัดเศษเป็นบาทถ้วน) ภายใน 0-6 วันหลังวันรับเงิน
   รอบสอง: จับคู่ผลรวม 2 ใบฝาก — บางสาขา (เช่น ป.เปา) ฝากแยก 2 รอบ/2 บัญชี
   (เงินสดย่อย + เงินฝากธนาคาร คนละวันได้) รวมกันแล้วตรงยอด
   รอบสาม: วันที่เหลือจับคู่ใบฝากที่ยังว่างตามลำดับวัน (ยอดไม่ตรง → ไฮไลต์) */
function buildRecon(rows, deps, showFrom, showTo) {
  const MS = 86400000;
  const dayDiff = (dep, day) => {
    const dd = new Date(String(dep.deposit_date).slice(0, 10) + "T00:00:00");
    const wd = new Date(String(day.work_date).slice(0, 10) + "T00:00:00");
    return Math.round((dd - wd) / MS);
  };
  const byBranch = {};
  rows.forEach(r => {
    const b = r.branch_code || "?";
    (byBranch[b] = byBranch[b] || { days: [], deps: [] }).days.push(r);
  });
  deps.forEach(d => {
    const b = d.branch_code || "?";
    (byBranch[b] = byBranch[b] || { days: [], deps: [] }).deps.push(d);
  });
  const out = [];
  for (const b of Object.keys(byBranch)) {
    const days = byBranch[b].days
      .sort((a, c) => String(a.work_date).localeCompare(String(c.work_date)))
      .map(r => ({ ...r, branch_code: b, expected: Number(r.cash_in || 0) - Number(r.cash_out || 0), matches: [] }));
    const dl = byBranch[b].deps
      .sort((a, c) => String(a.deposit_date).localeCompare(String(c.deposit_date)) || String(a.deposit_doc_no).localeCompare(String(c.deposit_doc_no)))
      .map(d => ({ ...d, used: false }));
    // รอบแรก: ใบเดียวยอดตรง
    for (const day of days) {
      if (day.expected <= 0) continue;
      const hit = dl.find(d => !d.used && dayDiff(d, day) >= 0 && dayDiff(d, day) <= 6 && Math.abs(Number(d.amount || 0) - day.expected) <= 1);
      if (hit) { hit.used = true; day.matches = [hit]; }
    }
    // รอบสอง: 2 ใบรวมกันยอดตรง (ฝากแยกบัญชี/แยกวัน)
    for (const day of days) {
      if (day.matches.length || day.expected <= 0) continue;
      const cand = dl.filter(d => !d.used && dayDiff(d, day) >= 0 && dayDiff(d, day) <= 6);
      let found = null;
      for (let i = 0; i < cand.length && !found; i++) {
        for (let j = i + 1; j < cand.length; j++) {
          if (Math.abs(Number(cand[i].amount || 0) + Number(cand[j].amount || 0) - day.expected) <= 1) { found = [cand[i], cand[j]]; break; }
        }
      }
      if (found) { found.forEach(d => { d.used = true; }); day.matches = found; }
    }
    // รอบสาม: fallback ใบแรกที่ยังว่าง (ยอดไม่ตรง → ไฮไลต์)
    for (const day of days) {
      if (day.matches.length || day.expected <= 0) continue;
      const hit = dl.find(d => !d.used && dayDiff(d, day) >= 0 && dayDiff(d, day) <= 6);
      if (hit) { hit.used = true; day.matches = [hit]; }
    }
    days.forEach(day => { if (String(day.work_date).slice(0, 10) >= showFrom) out.push(day); });
    // ใบฝากในช่วงที่เลือกที่จับคู่ไม่ได้ (เช่น ใบเสร็จยังไม่ upload หรือคีย์ยอดผิด)
    dl.filter(d => !d.used && String(d.deposit_date).slice(0, 10) >= showFrom && String(d.deposit_date).slice(0, 10) <= showTo)
      .forEach(d => out.push({ work_date: String(d.deposit_date).slice(0, 10), branch_code: b, cash_in: 0, receipt_count: 0, cash_out: 0, expense_count: 0, expected: null, matches: [d], orphan: true }));
  }
  return out.sort((a, c) => String(c.work_date).localeCompare(String(a.work_date)) || String(a.branch_code).localeCompare(String(c.branch_code)));
}

const emptyForm = () => ({
  deposit_date: todayLocal(),
  to_account_id: "",
  amount: 0,
  source: "",
  note: "",
});

export default function BankDepositPage({ currentUser }) {
  const [accounts, setAccounts] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("list");           // list | recon
  const [reconRows, setReconRows] = useState([]);   // ยอดรับ/จ่ายเงินสดรายวันจาก daily_receipts/daily_expenses
  const [reconDeps, setReconDeps] = useState([]);   // รายการฝากช่วงขยาย (+7 วัน) สำหรับจับคู่
  const [reconLoading, setReconLoading] = useState(false);
  const [reconBranch, setReconBranch] = useState("");
  const [reconOnlyProblem, setReconOnlyProblem] = useState(false); // เฉพาะ ไม่ตรง + ฝากโดยไม่พบยอดเงินสด
  const [detailModal, setDetailModal] = useState(null); // { kind: 'in'|'out', date, branch, expect, rows, loading }

  const isAdmin = currentUser?.role === "admin";
  // ดึง branch_code (ส่วนหน้าของ branch e.g., "SCY01 สำนักงานใหญ่" → "SCY01")
  const userBranch = String(currentUser?.branch || "").trim();
  const userBranchCode = userBranch.includes(" ") ? userBranch.split(" ")[0] : userBranch;
  const userBranchName = userBranch.includes(" ") ? userBranch.split(" ").slice(1).join(" ") : userBranch;

  useEffect(() => {
    const now = new Date();
    setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);
    fetchAccounts();
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => { if (dateFrom && dateTo) fetchData(); /* eslint-disable-next-line */ }, [dateFrom, dateTo]);
  useEffect(() => { if (tab === "recon" && dateFrom && dateTo) fetchRecon(); /* eslint-disable-next-line */ }, [tab, dateFrom, dateTo]);

  async function fetchAccounts() {
    try {
      // ใช้ accounting-api เพื่อดึงรายการบัญชีธนาคาร (มีอยู่แล้ว)
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
      });
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch { setAccounts([]); }
  }

  async function fetchData() {
    setLoading(true);
    try {
      const body = {
        action: "list_bank_deposits",
        date_from: dateFrom,
        date_to: dateTo,
        search: search.trim(),
      };
      // user ทั่วไปเห็นเฉพาะร้านตัวเอง · admin เห็นทุกร้าน
      if (!isAdmin && userBranchCode) body.branch_code = userBranchCode;
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setDeposits(Array.isArray(data) ? data : []);
    } catch { setDeposits([]); }
    setLoading(false);
  }

  async function fetchRecon() {
    setReconLoading(true);
    try {
      // ดึงยอดเงินสดย้อนหลังเพิ่ม 4 วัน ให้วันก่อนช่วงที่เลือกจับคู่ใบฝากต้นช่วงก่อน (ฝากเงินของเมื่อวาน)
      // และดึงใบฝากเลยไปอีก 7 วัน เพราะเงินสดปลายช่วงถูกฝากวันถัดไป/ข้ามวันหยุด
      const fetchFrom = addDays(dateFrom, -4);
      const depTo = addDays(dateTo, 7);
      const body = { action: "list_cash_recon", date_from: fetchFrom, date_to: dateTo };
      const depBody = { action: "list_bank_deposits", date_from: fetchFrom, date_to: depTo };
      if (!isAdmin && userBranchCode) { body.branch_code = userBranchCode; depBody.branch_code = userBranchCode; }
      const [r1, r2] = await Promise.all([
        fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
        fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(depBody) }),
      ]);
      const d1 = await r1.json();
      const d2 = await r2.json();
      setReconRows((Array.isArray(d1) ? d1 : []).filter(r => r.work_date));
      setReconDeps(Array.isArray(d2) ? d2 : []);
    } catch { setReconRows([]); setReconDeps([]); }
    setReconLoading(false);
  }

  // popup รายละเอียดใบเสร็จเงินสด (kind='in') / ใบสำคัญจ่ายเงินสด (kind='out') ของวัน+สาขา
  async function openCashDetail(kind, r) {
    const date = String(r.work_date).slice(0, 10);
    const expect = kind === "in" ? Number(r.cash_in || 0) : Number(r.cash_out || 0);
    if (expect <= 0) return;
    setDetailModal({ kind, date, branch: r.branch_code, expect, rows: [], loading: true });
    try {
      let rows = [];
      if (kind === "in") {
        const res = await fetch(RECEIPTS_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_daily_receipts", date_from: date, date_to: date, branch_code: r.branch_code }),
        });
        const data = await res.json();
        rows = (Array.isArray(data) ? data : []).filter(x => (x.status || "ปกติ") !== "ยกเลิก" && Number(x.cash || 0) !== 0);
      } else {
        const res = await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_cash_expense_docs", date, branch_code: r.branch_code }),
        });
        const data = await res.json();
        rows = Array.isArray(data) ? data : [];
      }
      setDetailModal(m => m ? { ...m, rows, loading: false } : m);
    } catch {
      setDetailModal(m => m ? { ...m, rows: [], loading: false } : m);
    }
  }

  function openNew() {
    setForm(emptyForm());
    setEditTarget(null);
    setShowForm(true);
  }

  function openEdit(d) {
    setForm({
      deposit_date: d.deposit_date ? new Date(d.deposit_date).toISOString().slice(0, 16) : todayLocal(),
      to_account_id: d.to_account_id || "",
      amount: d.amount || 0,
      source: d.source || "",
      note: d.note || "",
    });
    setEditTarget(d);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.to_account_id) { setMessage("❌ เลือกบัญชีรับฝาก"); return; }
    if (!Number(form.amount) || Number(form.amount) <= 0) { setMessage("❌ กรอกจำนวนเงิน"); return; }
    setSaving(true); setMessage("");
    try {
      const body = {
        action: editTarget ? "update_bank_deposit" : "save_bank_deposit",
        ...(editTarget ? { deposit_id: editTarget.deposit_id } : {}),
        ...form,
        amount: Number(form.amount),
        to_account_id: Number(form.to_account_id),
        created_by: currentUser?.username || currentUser?.name || "system",
        branch_code: userBranchCode,
        branch_name: userBranchName,
      };
      await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setShowForm(false);
      setEditTarget(null);
      setMessage(`✅ ${editTarget ? "แก้ไข" : "บันทึก"}สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function handleCancel(d) {
    if (!window.confirm(`ยกเลิกรายการฝากเงิน ${d.deposit_doc_no}?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_bank_deposit", deposit_id: d.deposit_id }),
      });
      setMessage("✅ ยกเลิกสำเร็จ");
      fetchData();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  function printSlip(d) {
    const safe = s => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const today = new Date();
    const pad = n => String(n).padStart(2, "0");
    const printDate = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear() + 543} ${pad(today.getHours())}:${pad(today.getMinutes())}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ใบฝากเงิน ${safe(d.deposit_doc_no)}</title>
<style>
@page { size: A5 portrait; margin: 10mm; }
body { font-family: 'Tahoma','Arial',sans-serif; font-size: 11pt; }
h1 { text-align: center; margin: 0 0 4px; font-size: 16pt; color: #059669; }
.head { text-align: center; margin-bottom: 14px; font-size: 10pt; color: #444; }
.info { display: grid; grid-template-columns: 1fr 2fr; gap: 8px 12px; margin-bottom: 16px; padding: 14px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; font-size: 11pt; }
.label { font-weight: 600; color: #374151; }
.value { color: #1f2937; }
.amount { font-size: 22pt; font-weight: 700; color: #059669; text-align: center; padding: 14px; background: #fff; border: 2px solid #059669; border-radius: 8px; margin: 12px 0; }
.sign-box { display: inline-block; width: 45%; margin-top: 30px; padding: 0 10px; vertical-align: top; }
</style></head><body>
<h1>📋 ใบบันทึกฝากเงิน</h1>
<div class="head">เลขที่: <strong>${safe(d.deposit_doc_no)}</strong> · พิมพ์: ${printDate}</div>

<div class="info">
  <div class="label">วันที่ฝาก:</div>
  <div class="value">${fmtDate(d.deposit_date)}</div>

  <div class="label">ร้าน/สาขา:</div>
  <div class="value"><strong>${safe(d.branch_code || "-")}</strong> ${safe(d.branch_name || "")}</div>

  <div class="label">บัญชีที่ฝาก:</div>
  <div class="value">${safe(d.to_account_name || "-")}</div>

  <div class="label">แหล่งที่มา:</div>
  <div class="value">${safe(d.source || "-")}</div>

  <div class="label">หมายเหตุ:</div>
  <div class="value">${safe(d.note || "-")}</div>

  <div class="label">ผู้บันทึก:</div>
  <div class="value">${safe(d.created_by || "-")}</div>
</div>

<div class="amount">
  💰 จำนวนเงิน: ${fmt(d.amount)} บาท
</div>

<div style="margin-top:25px;">
  <div class="sign-box"><div style="height:35px"></div><div style="border-top:1px solid #333;padding-top:4px;text-align:center">ลงชื่อ ........................................................<br/>ผู้ฝาก</div></div>
  <div class="sign-box"><div style="height:35px"></div><div style="border-top:1px solid #333;padding-top:4px;text-align:center">ลงชื่อ ........................................................<br/>ผู้รับ</div></div>
</div>
</body></html>`;
    const w = window.open("", "_blank", "width=700,height=800");
    if (!w) { setMessage("❌ Popup ถูกบล็อก"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  function printList() {
    if (filtered.length === 0) { setMessage("ไม่มีรายการให้พิมพ์"); return; }
    const safe = s => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const today = new Date();
    const pad = n => String(n).padStart(2, "0");
    const printDate = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear() + 543} ${pad(today.getHours())}:${pad(today.getMinutes())}`;
    const trs = filtered.map((d, i) => `<tr>
      <td>${i + 1}</td>
      <td class="mono">${safe(d.deposit_doc_no)}</td>
      <td>${fmtDate(d.deposit_date)}</td>
      <td>${safe(d.branch_code || "")} ${safe(d.branch_name || "")}</td>
      <td>${safe(d.to_account_name || "-")}</td>
      <td>${safe(d.source || "-")}</td>
      <td class="num">${fmt(d.amount)}</td>
    </tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>รายงานฝากเงิน</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: 'Tahoma','Arial',sans-serif; font-size: 10pt; }
h1 { text-align: center; margin: 0 0 4px; font-size: 14pt; color: #059669; }
.head { text-align: center; margin-bottom: 12px; font-size: 9pt; color: #444; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #555; padding: 4px 6px; font-size: 9pt; text-align: left; }
th { background: #f0fdf4; }
.num { text-align: right; font-family: monospace; font-weight: 600; }
.mono { font-family: monospace; }
.total { font-weight: 700; background: #fef9c3; }
</style></head><body>
<h1>📋 รายงานบันทึกฝากเงิน</h1>
<div class="head">ช่วงวันที่: ${dateFrom} - ${dateTo}${filterBranch ? ` · สาขา: ${safe(filterBranch)}` : ""} · พิมพ์: ${printDate}</div>
<table>
  <thead><tr><th>#</th><th>เลขที่</th><th>วันที่</th><th>ร้าน/สาขา</th><th>บัญชีรับฝาก</th><th>แหล่งที่มา</th><th>ยอด</th></tr></thead>
  <tbody>
    ${trs}
    <tr class="total"><td colspan="6" style="text-align:right">รวม ${filtered.length} รายการ</td><td class="num">${fmt(grandTotal)}</td></tr>
  </tbody>
</table>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { setMessage("❌ Popup ถูกบล็อก"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  // รายชื่อสาขาจากข้อมูลที่โหลดมา (สำหรับ dropdown ตัวกรอง)
  const branchOptions = [...new Map(deposits.filter(d => d.branch_code).map(d => [d.branch_code, d.branch_name || ""])).entries()]
    .sort((a, b) => a[0].localeCompare(b[0]));

  const filtered = deposits.filter(d => {
    if (filterBranch && (d.branch_code || "") !== filterBranch) return false;
    if (!search.trim()) return true;
    const kw = search.trim().toLowerCase();
    return [d.deposit_doc_no, d.to_account_name, d.source, d.note].filter(Boolean).join(" ").toLowerCase().includes(kw);
  });

  const grandTotal = filtered.reduce((s, d) => s + Number(d.amount || 0), 0);

  // ===== กระทบยอด (แท็บประวัติการบันทึก) =====
  // ไม่แสดงสาขา SCY10 (ไม่มีเงินสดหน้าร้าน/ไม่ฝากเงิน)
  const reconAll = buildRecon(
    reconRows.filter(r => !String(r.branch_code || "").startsWith("SCY10")),
    reconDeps.filter(d => d.status !== "cancelled" && !String(d.branch_code || "").startsWith("SCY10")),
    dateFrom, dateTo);
  const reconBranches = [...new Set(reconAll.map(r => r.branch_code))].sort();
  const recon = reconBranch ? reconAll.filter(r => r.branch_code === reconBranch) : reconAll;
  // ตัวกรอง "เฉพาะยอดไม่ตรง" — แสดงทั้ง ⚠️ ไม่ตรง และ ⚠️ ฝากโดยไม่พบยอดเงินสด (สรุปด้านบนยังรวมทุกแถว)
  const reconVisible = reconOnlyProblem ? recon.filter(r => ["mismatch", "orphan"].includes(reconStatus(r).key)) : recon;
  const reconSum = recon.reduce((s, r) => {
    s.cash_in += Number(r.cash_in || 0);
    s.cash_out += Number(r.cash_out || 0);
    if (r.expected != null && r.expected > 0) s.expected += r.expected;
    s.actual += matchTotal(r);
    const st = reconStatus(r);
    if (st.key === "mismatch" || st.key === "orphan") s.problems++;
    return s;
  }, { cash_in: 0, cash_out: 0, expected: 0, actual: 0, problems: 0 });

  function matchTotal(r) {
    return (r.matches || []).reduce((s, m) => s + Number(m.amount || 0), 0);
  }

  function reconStatus(r) {
    if (r.orphan) return { key: "orphan", label: "⚠️ ฝากโดยไม่พบยอดเงินสด", bg: "#fef3c7", color: "#92400e" };
    if (r.expected == null || r.expected <= 0) return { key: "none", label: "ไม่มียอดต้องฝาก", bg: "", color: "#9ca3af" };
    if (!r.matches || r.matches.length === 0) return { key: "pending", label: "⏳ ยังไม่พบรายการฝาก", bg: "#fef9c3", color: "#854d0e" };
    const diff = matchTotal(r) - r.expected;
    if (Math.abs(diff) <= 1) return { key: "ok", label: r.matches.length > 1 ? `✅ ตรง (${r.matches.length} ใบ)` : "✅ ตรง", bg: "", color: "#059669" };
    return { key: "mismatch", label: `⚠️ ไม่ตรง (${diff > 0 ? "+" : ""}${fmt(diff)})`, bg: "#fee2e2", color: "#b91c1c", diff };
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 บันทึกรายการฝากเงิน</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["list", "📋 รายการฝากเงิน"], ["recon", "📊 ประวัติการบันทึก (กระทบยอด)"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: "8px 18px", border: "none", borderRadius: "8px 8px 0 0", cursor: "pointer", fontWeight: 700, fontSize: 13,
              background: tab === k ? "#072d6b" : "#e5e7eb", color: tab === k ? "#fff" : "#374151" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>วันที่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        {tab === "list" && <>
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={inp} title="กรองตามสาขา">
            <option value="">🏬 ทุกสาขา</option>
            {branchOptions.map(([code, name]) => <option key={code} value={code}>{code}{name ? ` ${name}` : ""}</option>)}
          </select>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหา (เลขที่, บัญชี, แหล่งที่มา)" style={{ ...inp, flex: 1, minWidth: 220 }} />
          <button onClick={fetchData} disabled={loading} style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            {loading ? "..." : "🔄 รีเฟรช"}
          </button>
          <button onClick={openNew} style={{ padding: "7px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            ➕ บันทึกฝากเงินใหม่
          </button>
          <button onClick={printList} disabled={filtered.length === 0} title="พิมพ์รายงานสรุป"
            style={{ padding: "7px 18px", background: filtered.length === 0 ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: filtered.length === 0 ? "not-allowed" : "pointer", fontWeight: 600 }}>
            🖨️ พิมพ์รายงาน
          </button>
        </>}
        {tab === "recon" && <>
          {isAdmin && (
            <select value={reconBranch} onChange={e => setReconBranch(e.target.value)} style={inp}>
              <option value="">ทุกสาขา</option>
              {reconBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 12px", background: reconOnlyProblem ? "#fee2e2" : "#fff", border: `1px solid ${reconOnlyProblem ? "#fca5a5" : "#d1d5db"}`, borderRadius: 6, color: reconOnlyProblem ? "#b91c1c" : "#374151" }}>
            <input type="checkbox" checked={reconOnlyProblem} onChange={e => setReconOnlyProblem(e.target.checked)} style={{ cursor: "pointer" }} />
            ⚠️ เฉพาะยอดไม่ตรง
          </label>
          <button onClick={fetchRecon} disabled={reconLoading} style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            {reconLoading ? "..." : "🔄 รีเฟรช"}
          </button>
        </>}
      </div>

      {tab === "recon" && (
        <>
          {/* สรุปกระทบยอด */}
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}>
            <span>💵 รายรับเงินสด: <strong style={{ color: "#059669" }}>{fmt(reconSum.cash_in)}</strong></span>
            <span>💸 รายจ่ายเงินสด: <strong style={{ color: "#dc2626" }}>{fmt(reconSum.cash_out)}</strong></span>
            <span>🎯 ยอดที่ต้องฝาก: <strong style={{ color: "#0369a1" }}>{fmt(reconSum.expected)}</strong></span>
            <span>🏦 ฝากจริง (จับคู่ได้): <strong style={{ color: "#059669" }}>{fmt(reconSum.actual)}</strong></span>
            {reconSum.problems > 0 && <span style={{ color: "#b91c1c", fontWeight: 700 }}>⚠️ ไม่ตรง {reconSum.problems} รายการ</span>}
          </div>
          <div style={{ marginBottom: 12, padding: "8px 14px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, fontSize: 12, color: "#0c4a6e" }}>
            💡 รายรับ = เงินสดตามใบเสร็จรายวัน (EX) · รายจ่าย = เงินสดตามใบสำคัญจ่าย (PAYMENT_ALL) · เงินสดของแต่ละวันมักถูกนำฝากวันถัดไป (ระบบจับคู่ให้อัตโนมัติ ±6 วัน) — ต้อง upload ไฟล์ใบเสร็จและค่าใช้จ่ายให้ถึงวันล่าสุดก่อน ยอดจึงครบ
          </div>

          {/* ตารางกระทบยอด */}
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            {reconLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
            ) : reconVisible.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                {reconOnlyProblem && recon.length > 0 ? "🎉 ไม่มีรายการยอดไม่ตรงในช่วงที่เลือก" : "ไม่มีข้อมูลในช่วงที่เลือก — ตรวจว่า upload ใบเสร็จรายวัน (EX) และค่าใช้จ่ายรายวันแล้ว"}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#072d6b", color: "#fff" }}>
                  <tr>
                    <th style={th}>วันที่รับเงิน</th>
                    <th style={th}>สาขา</th>
                    <th style={{ ...th, textAlign: "right" }}>รายรับเงินสด</th>
                    <th style={{ ...th, textAlign: "right" }}>รายจ่ายเงินสด</th>
                    <th style={{ ...th, textAlign: "right" }}>ยอดที่ต้องฝาก</th>
                    <th style={th}>ใบฝาก</th>
                    <th style={{ ...th, textAlign: "right" }}>ยอดที่ฝากจริง</th>
                    <th style={th}>ผล</th>
                  </tr>
                </thead>
                <tbody>
                  {reconVisible.map((r, i) => {
                    const st = reconStatus(r);
                    return (
                      <tr key={`${r.branch_code}-${r.work_date}-${i}`} style={{ borderTop: "1px solid #e5e7eb", background: st.bg || undefined }}>
                        <td style={td}>{r.orphan ? <span style={{ color: "#92400e" }}>({fmtDateShort(r.work_date)})</span> : fmtDateShort(r.work_date)}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.branch_code}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>
                          {r.orphan ? "-" : Number(r.cash_in) > 0 ? (
                            <span onClick={() => openCashDetail("in", r)} title="ดูรายละเอียดใบเสร็จเงินสด"
                              style={{ cursor: "pointer", color: "#0369a1", textDecoration: "underline" }}>{fmt(r.cash_in)}</span>
                          ) : fmt(r.cash_in)}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>
                          {r.orphan ? "-" : Number(r.cash_out) > 0 ? (
                            <span onClick={() => openCashDetail("out", r)} title="ดูรายละเอียดใบสำคัญจ่ายเงินสด"
                              style={{ cursor: "pointer", color: "#dc2626", textDecoration: "underline" }}>-{fmt(r.cash_out)}</span>
                          ) : fmt(0)}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#0369a1" }}>{r.orphan ? "-" : fmt(r.expected)}</td>
                        <td style={{ ...td, fontSize: 12 }}>
                          {r.matches && r.matches.length > 0 ? r.matches.map((m, mi) => (
                            <div key={mi}>
                              <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#059669" }}>{m.deposit_doc_no}</span>
                              <span style={{ color: "#6b7280" }}> · ฝาก {fmtDateShort(m.deposit_date)}</span>
                              {r.matches.length > 1 && <span style={{ color: "#6b7280", fontFamily: "monospace" }}> · {fmt(m.amount)}</span>}
                            </div>
                          )) : <span style={{ color: "#9ca3af" }}>-</span>}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{r.matches && r.matches.length > 0 ? fmt(matchTotal(r)) : "-"}</td>
                        <td style={{ ...td, fontWeight: 600, color: st.color, whiteSpace: "nowrap" }}>{st.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "list" && <>
      {/* Summary */}
      <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}>
        <span>📋 รายการ: <strong>{filtered.length}</strong></span>
        <span>💰 ยอดรวม: <strong style={{ color: "#059669" }}>{fmt(grandTotal)}</strong> บาท</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>เลขที่</th>
                <th style={th}>วันที่</th>
                <th style={th}>ร้าน/สาขา</th>
                <th style={th}>บัญชีรับฝาก</th>
                <th style={th}>แหล่งที่มา</th>
                <th style={th}>หมายเหตุ</th>
                <th style={{ ...th, textAlign: "right" }}>ยอด</th>
                <th style={th}>ผู้บันทึก</th>
                <th style={th}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.deposit_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{d.deposit_doc_no || "-"}</td>
                  <td style={td}>{fmtDate(d.deposit_date)}</td>
                  <td style={td}>
                    {d.branch_code && <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{d.branch_code}</span>}
                    {d.branch_code && d.branch_name && <span> </span>}
                    {d.branch_name && <span style={{ fontSize: 12, color: "#374151" }}>{d.branch_name}</span>}
                    {!d.branch_code && !d.branch_name && <span style={{ color: "#9ca3af" }}>-</span>}
                  </td>
                  <td style={td}>{d.to_account_name || "-"}</td>
                  <td style={td}>{d.source || "-"}</td>
                  <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{d.note || ""}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(d.amount)}</td>
                  <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{d.created_by || "-"}</td>
                  <td style={td}>
                    <button onClick={() => printSlip(d)} title="พิมพ์ใบฝาก" style={btnPrint}>🖨️</button>
                    <button onClick={() => openEdit(d)} style={btnEdit}>✏️</button>
                    <button onClick={() => handleCancel(d)} style={btnDelete}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>}

      {/* Form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 540, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#059669" }}>{editTarget ? "✏️ แก้ไขรายการฝาก" : "💰 บันทึกฝากเงิน"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>ร้าน/สาขา (auto)</label>
                <div style={{ padding: "8px 12px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 6, fontSize: 14, fontWeight: 600, color: "#0369a1" }}>
                  {userBranchCode || "-"} {userBranchName && <span style={{ color: "#374151", fontWeight: 400 }}>· {userBranchName}</span>}
                </div>
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>วันที่/เวลา *</label>
                <input type="datetime-local" value={form.deposit_date} onChange={e => setForm(p => ({ ...p, deposit_date: e.target.value }))} style={inp2} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>บัญชีที่รับฝาก *</label>
                <select value={form.to_account_id} onChange={e => setForm(p => ({ ...p, to_account_id: e.target.value }))} style={inp2}>
                  <option value="">-- เลือกบัญชี --</option>
                  {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>จำนวนเงิน *</label>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={{ ...inp2, fontFamily: "monospace", textAlign: "right", fontSize: 16, fontWeight: 700 }} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>แหล่งที่มา</label>
                <input type="text" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="เช่น ฝากเงินสดประจำวัน, รับเงินลูกค้า, อื่นๆ" style={inp2} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} rows={2} style={{ ...inp2, resize: "vertical" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setShowForm(false)} disabled={saving} style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "8px 24px", background: saving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal — รายละเอียดรายรับ/รายจ่ายเงินสดของวัน+สาขา */}
      {detailModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          onClick={() => setDetailModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 20, borderRadius: 12, width: 720, maxWidth: "95vw", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: detailModal.kind === "in" ? "#0369a1" : "#dc2626" }}>
                {detailModal.kind === "in" ? "💵 รายรับเงินสด" : "💸 รายจ่ายเงินสด"} · {fmtDateShort(detailModal.date)} · {detailModal.branch}
              </h3>
              <button onClick={() => setDetailModal(null)} style={{ padding: "4px 12px", background: "#e5e7eb", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>✕</button>
            </div>
            {detailModal.loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
            ) : detailModal.rows.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่พบรายการ</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f1f5f9" }}>
                  {detailModal.kind === "in" ? (
                    <tr>
                      <th style={thD}>เลขใบเสร็จ</th>
                      <th style={thD}>ประเภท</th>
                      <th style={thD}>ลูกค้า</th>
                      <th style={{ ...thD, textAlign: "right" }}>เงินสด</th>
                      <th style={{ ...thD, textAlign: "right" }}>ยอดใบเสร็จ</th>
                    </tr>
                  ) : (
                    <tr>
                      <th style={thD}>เลขใบสั่งจ่าย</th>
                      <th style={thD}>จ่ายให้</th>
                      <th style={thD}>หมวด/รายละเอียด</th>
                      <th style={{ ...thD, textAlign: "right" }}>เงินสด</th>
                      <th style={{ ...thD, textAlign: "right" }}>ยอดรวมใบ</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {detailModal.rows.map((x, i) => detailModal.kind === "in" ? (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ ...tdD, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{x.receipt_no}</td>
                      <td style={tdD}>{x.receipt_type || "-"}</td>
                      <td style={tdD}>{x.customer_name || "-"}</td>
                      <td style={{ ...tdD, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmt(x.cash)}</td>
                      <td style={{ ...tdD, textAlign: "right", fontFamily: "monospace", color: "#6b7280" }}>{fmt(x.total_amount)}</td>
                    </tr>
                  ) : (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ ...tdD, fontFamily: "monospace", fontWeight: 600, color: "#dc2626" }}>{x.payment_no}</td>
                      <td style={tdD}>{x.pay_to || "-"}</td>
                      <td style={{ ...tdD, color: "#6b7280" }}>{x.payment_types || x.details || "-"}</td>
                      <td style={{ ...tdD, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#dc2626" }}>{fmt(x.cash)}</td>
                      <td style={{ ...tdD, textAlign: "right", fontFamily: "monospace", color: "#6b7280" }}>{fmt(x.total_amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid #94a3b8", background: "#fef9c3", fontWeight: 700 }}>
                    <td style={tdD} colSpan={3}>รวม {detailModal.rows.length} รายการ</td>
                    <td style={{ ...tdD, textAlign: "right", fontFamily: "monospace" }}>
                      {fmt(detailModal.rows.reduce((s, x) => s + Number(x.cash || 0), 0))}
                    </td>
                    <td style={tdD}></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inp = { padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const inp2 = { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 13 };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const th = { padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 12 };
const td = { padding: "8px 12px", fontSize: 12, color: "#1f2937" };
const thD = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 12, color: "#334155" };
const tdD = { padding: "6px 10px", fontSize: 12, color: "#1f2937" };
const btnPrint = { padding: "3px 8px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnEdit = { padding: "3px 8px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnDelete = { padding: "3px 8px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 };
