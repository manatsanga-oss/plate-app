import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";

function firstOfMonth(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function HrPayrollPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState(firstOfMonth(new Date()));
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [message, setMessage] = useState("");
  const [detailRow, setDetailRow] = useState(null);
  // ===== Snapshot states =====
  const [snapshotMode, setSnapshotMode] = useState(null); // {save_group, saved_at, saved_by, month_year} when viewing snapshot
  const [showSaveDialog, setShowSaveDialog] = useState(null); // {existing_count, last_saved_at, last_saved_by}
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // ===== Payable (ตั้งจ่าย) states =====
  const [payablePopup, setPayablePopup] = useState(null); // { breakdown[], loading, error }
  const [payablesCreated, setPayablesCreated] = useState(0); // count of expense_documents already created for this snapshot
  const [creatingPayable, setCreatingPayable] = useState(false);
  const [savingLocked, setSavingLocked] = useState(false);
  const [previewPopup, setPreviewPopup] = useState(null); // { breakdown[] } for confirming บันทึกตั้งจ่าย
  // ===== View snapshot popup =====
  const [viewSnap, setViewSnap] = useState(null); // { item, rows[], loading }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [month]);

  async function fetchData() {
    setLoading(true); setMessage(""); setSnapshotMode(null); setPayablesCreated(0);
    try {
      // คำนวณสดทุกครั้ง (snapshot ดูจาก "ประวัติ" เท่านั้น)
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "calc_payroll", month_year: month }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);

      // เช็ค snapshot — เพื่อ disable ปุ่มบันทึก (แต่ไม่โหลด snapshot data เข้าตาราง)
      const checkRes = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_snapshot", mode: "check", month_year: month }),
      });
      const checkData = await checkRes.json();
      const checkArr = Array.isArray(checkData) ? checkData : [];
      if (checkArr.length > 0 && Number(checkArr[0].row_count || 0) > 0) {
        const sg = checkArr[0].save_group;
        setSnapshotMode({
          save_group: sg,
          saved_at: checkArr[0].saved_at,
          saved_by: checkArr[0].saved_by,
          is_locked: !!checkArr[0].is_locked,
          month_year: month,
        });
        try {
          const docsRes = await fetch(API_URL, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "payroll_payables", mode: "list_docs", save_group: sg }),
          });
          const docsArr = await docsRes.json();
          setPayablesCreated(Array.isArray(docsArr) ? docsArr.length : 0);
        } catch { /* ignore */ }
      }
    } catch { setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  function fmtNum(v) {
    return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function monthDisplay(d) {
    if (!d) return "-";
    const dt = new Date(d);
    if (isNaN(dt)) return String(d).slice(0, 7);
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return `${months[dt.getMonth()]} ${dt.getFullYear() + 543}`;
  }

  // local filter
  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (filterBranch && r.affiliation !== filterBranch) return false;
    if (!kw) return true;
    const hay = [r.employee_name, r.team_name, r.affiliation, r.bank_account_no].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const branches = [...new Set(rows.map(r => r.affiliation).filter(Boolean))].sort();

  // totals
  const sum = (key) => filtered.reduce((s, r) => s + Number(r[key] || 0), 0);

  // ===== Snapshot Functions =====
  async function handleSaveClick() {
    if (filtered.length === 0) { setMessage("ไม่มีข้อมูลให้บันทึก"); return; }
    if (snapshotMode) { setMessage("เดือนนี้บันทึกแล้ว — ยกเลิกก่อนถ้าต้องการแก้"); return; }
    // เนื่องจาก fetchData เช็คแล้ว ถ้าเข้ามาที่ point นี้ = ไม่มี snapshot
    const ok = window.confirm(`ยืนยันบันทึกเงินเดือนเดือน ${monthDisplay(month)}?\n\nจำนวน ${filtered.length} คน\nยอดสุทธิรวม ${fmtNum(sum("net_income"))} บาท\n\n⚠️ บันทึกแล้วเดือนนี้จะถูกล็อก ต้องยกเลิกก่อนถึงคำนวณใหม่ได้`);
    if (!ok) return;
    await doSave(null);
  }

  async function doSave(deleteOldGroup) {
    setSaving(true); setMessage("");
    try {
      // ลบ snapshot เก่าก่อน (ถ้า user เลือก overwrite)
      if (deleteOldGroup) {
        await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "payroll_snapshot", mode: "delete", save_group: deleteOldGroup }),
        });
      }
      const saveGroup = `${month.slice(0, 7)}-${Date.now()}`;
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payroll_snapshot", mode: "save",
          month_year: month,
          save_group: saveGroup,
          saved_by: currentUser?.name || currentUser?.username || "system",
          rows: filtered,
        }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      setMessage(`✅ บันทึกสำเร็จ ${filtered.length} รายการ`);
      setShowSaveDialog(null);
      await fetchData(); // reload — จะเข้าโหมด snapshot read-only อัตโนมัติ
    } catch (e) { setMessage("❌ บันทึกไม่สำเร็จ: " + e.message); }
    setSaving(false);
  }

  async function openHistory() {
    setShowHistory(true); setHistoryLoading(true); setHistoryList([]);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_snapshot", mode: "history" }),
      });
      const data = await res.json();
      setHistoryList(Array.isArray(data) ? data : []);
    } catch (e) { setMessage("❌ โหลดประวัติไม่สำเร็จ"); }
    setHistoryLoading(false);
  }

  async function cancelSnapshot(item) {
    if (item.is_paid || item.has_paid_payment) {
      alert("❌ ไม่สามารถยกเลิกได้ เนื่องจากมีการจ่ายเงินแล้ว");
      return;
    }
    const ok = window.confirm(`ยืนยันยกเลิกการบันทึกของเดือน ${monthDisplay(item.month_year)}?\n\nบันทึกเมื่อ: ${item.saved_at ? new Date(item.saved_at).toLocaleString("th-TH") : "-"}\nจำนวน ${item.employee_count} คน\n\nการยกเลิกไม่สามารถย้อนกลับได้`);
    if (!ok) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_snapshot", mode: "cancel", save_group: item.save_group }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      if (arr[0]?.error) {
        alert("❌ " + arr[0].error);
      } else {
        setMessage(`✅ ยกเลิกการบันทึกเรียบร้อย`);
        await openHistory(); // reload
      }
    } catch (e) { alert("❌ ยกเลิกไม่สำเร็จ: " + e.message); }
    setHistoryLoading(false);
  }

  async function viewSnapshotPopup(item) {
    setShowHistory(false);
    setViewSnap({ item, rows: [], loading: true });
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_snapshot", mode: "detail", save_group: item.save_group }),
      });
      const data = await res.json();
      setViewSnap({ item, rows: Array.isArray(data) ? data : [], loading: false });
    } catch (e) { setViewSnap(null); alert("โหลดไม่สำเร็จ: " + e.message); }
  }

  async function loadSnapshotIntoTable(item) {
    setHistoryLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_snapshot", mode: "detail", save_group: item.save_group }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setRows(arr);
      setSnapshotMode({
        save_group: item.save_group,
        saved_at: item.saved_at,
        saved_by: item.saved_by,
        month_year: item.month_year,
      });
      setShowHistory(false);
    } catch (e) { setMessage("❌ โหลด snapshot ไม่สำเร็จ"); }
    setHistoryLoading(false);
  }

  // คำนวณ breakdown แยกตามสังกัด × ประเภทเจ้าหนี้ (จากข้อมูลในตาราง)
  function computeLocalBreakdown() {
    const map = {};
    filtered.forEach(r => {
      const aff = r.affiliation || "-";
      if (!map[aff]) map[aff] = { affiliation: aff, salary: 0, sso: 0, tax: 0, pf: 0, loan: 0, count: 0 };
      map[aff].count += 1;
      map[aff].salary += Number(r.net_income || 0);
      map[aff].sso += Number(r.sso_amount || 0);
      map[aff].tax += Number(r.tax || 0);
      map[aff].pf += Number(r.pf_amount || 0);
      map[aff].loan += Number(r.study_loan || 0);
    });
    return Object.values(map).sort((a, b) => String(a.affiliation).localeCompare(String(b.affiliation)));
  }

  // ===== บันทึกตั้งจ่าย =====
  function openSaveAndLockPreview() {
    if (filtered.length === 0) { setMessage("ไม่มีข้อมูล"); return; }
    if (payablesCreated > 0) { setMessage("เดือนนี้ตั้งจ่ายแล้ว — ดูที่หน้าบันทึกการจ่าย"); return; }
    setPreviewPopup({ breakdown: computeLocalBreakdown() });
  }

  // - ถ้ายังไม่มี snapshot: save + ตั้งจ่าย
  // - ถ้ามี snapshot อยู่แล้ว: ตั้งจ่ายเฉยๆ
  async function handleSaveAndLock() {
    const isExisting = !!snapshotMode;
    setPreviewPopup(null);
    setSavingLocked(true); setMessage("");
    try {
      let saveGroup = snapshotMode?.save_group;

      // 1) Save snapshot ถ้ายังไม่มี
      if (!isExisting) {
        saveGroup = `${month.slice(0, 7)}-${Date.now()}`;
        const r1 = await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "payroll_snapshot", mode: "save",
            month_year: month, save_group: saveGroup,
            saved_by: currentUser?.name || currentUser?.username || "system",
            rows: filtered,
          }),
        });
        const d1 = await r1.json();
        if (d1?.error) throw new Error(d1.error);
      }

      // 2) Create payables (ถ้ายังไม่มี)
      let docCount = payablesCreated;
      if (docCount === 0) {
        const r2 = await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "payroll_payables", mode: "create",
            save_group: saveGroup,
            doc_date: new Date().toISOString().slice(0, 10),
            created_by: currentUser?.name || currentUser?.username || "system",
          }),
        });
        const d2 = await r2.json();
        docCount = (Array.isArray(d2) ? d2 : []).filter(x => x.expense_doc_id).length;
        if (docCount === 0) throw new Error("ไม่ได้สร้างเอกสารเจ้าหนี้");
      }

      setMessage(`✅ บันทึกตั้งจ่ายสำเร็จ — เอกสารเจ้าหนี้ ${docCount} ใบ • ดูรายคนที่ "ประวัติ" • ดูยอดที่ "บันทึกการจ่าย"`);
      await fetchData();
    } catch (e) { setMessage("❌ บันทึกตั้งจ่ายไม่สำเร็จ: " + e.message); }
    setSavingLocked(false);
  }

  // ===== ตั้งจ่าย =====
  async function openPayablePopup() {
    if (!snapshotMode) return;
    setPayablePopup({ loading: true });
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_payables", mode: "breakdown", save_group: snapshotMode.save_group }),
      });
      const data = await res.json();
      setPayablePopup({ loading: false, breakdown: Array.isArray(data) ? data : [] });
    } catch (e) {
      setPayablePopup({ loading: false, breakdown: [], error: e.message });
    }
  }

  async function doCreatePayables() {
    if (!snapshotMode || !payablePopup) return;
    const noAccount = (payablePopup.breakdown || []).filter(b => !b.bank_account_id);
    if (noAccount.length > 0) {
      const aff = noAccount.map(b => b.affiliation).join(", ");
      if (!window.confirm(`สังกัดต่อไปนี้ยังไม่ได้ตั้งบัญชีจ่าย: ${aff}\n\nเอกสารจะถูกสร้างโดยไม่ระบุบัญชี\n\nดำเนินการต่อหรือไม่?`)) return;
    }
    setCreatingPayable(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payroll_payables", mode: "create",
          save_group: snapshotMode.save_group,
          doc_date: new Date().toISOString().slice(0, 10),
          created_by: currentUser?.name || currentUser?.username || "system",
        }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      const docCount = arr.filter(x => x.expense_doc_id).length;
      if (docCount === 0) throw new Error("ไม่ได้สร้างเอกสาร");
      setMessage(`✅ ตั้งจ่ายสำเร็จ ${docCount} เอกสาร — ไปจัดการที่หน้า "บันทึกการจ่าย"`);
      setPayablePopup(null);
      setPayablesCreated(prev => prev + docCount);
    } catch (e) { setMessage("❌ ตั้งจ่ายไม่สำเร็จ: " + e.message); }
    setCreatingPayable(false);
  }

  // ยกเลิก snapshot ของเดือนปัจจุบัน → กลับมาคำนวณใหม่ได้
  async function cancelCurrentSnapshot() {
    if (!snapshotMode) return;
    const ok = window.confirm(`ยกเลิกการบันทึกเดือน ${monthDisplay(month)}?\n\nบันทึกเมื่อ: ${snapshotMode.saved_at ? new Date(snapshotMode.saved_at).toLocaleString("th-TH") : "-"}\n\n⚠️ ไม่สามารถย้อนกลับได้`);
    if (!ok) return;
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payroll_snapshot", mode: "cancel", save_group: snapshotMode.save_group }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      if (arr[0]?.error) {
        alert("❌ " + arr[0].error);
        return;
      }
      setMessage("✅ ยกเลิกการบันทึก กลับสู่โหมดคำนวณ");
      await fetchData(); // จะ run calc_payroll เพราะไม่มี snapshot แล้ว
    } catch (e) { alert("❌ ยกเลิกไม่สำเร็จ: " + e.message); }
  }

  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = ["สังกัด","ชื่อ","ธนาคาร","เลขที่บัญชี","เงินเดือน","โบนัส","OT-วันทำงาน","OT-ปกติ","ค่าข้าว","ค่าซักเสื้อ","ค่าเบี้ยขยัน","เงินเพิ่มพิเศษ","รายได้อื่นๆ","รวมรายได้","ประกันสังคม","ภาษี","กองทุนสำรองฯ","ค่าใช้จ่ายผู้บริหาร","ของหาย","รายจ่ายอื่นๆ","ขาด-สาย","รวมรายจ่าย","รายได้สุทธิ"];
    const rowsCsv = filtered.map(r => [
      r.affiliation || "", r.employee_name, r.bank_name || "", r.bank_account_no || "",
      r.salary || 0, r.bonus || 0, r.ot_workday || 0, r.ot_holiday || 0,
      r.meal_allowance || 0, r.laundry_allowance || 0, r.diligence_allowance || 0,
      r.extra_bonus || 0, r.other_income || 0, r.total_income || 0,
      r.sso_amount || 0, r.tax || 0, r.pf_amount || 0,
      r.admin_expense || 0, r.lost_items || 0, r.other_expense || 0, r.absence_late || 0,
      r.total_expense || 0, r.net_income || 0,
    ].map(v => typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v).join(","));
    const csv = "﻿" + headers.join(",") + "\n" + rowsCsv.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payroll_${month}.csv`;
    a.click();
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 คำนวณเงินเดือน</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>{message}</div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>เดือน:</label>
        <input type="month" value={month.slice(0, 7)} onChange={e => setMonth(e.target.value + "-01")} style={inp} />
        <span style={{ fontSize: 13, color: "#072d6b", fontWeight: 600 }}>{monthDisplay(month)}</span>

        <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={inp}>
          <option value="">ทุกสังกัด</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <input type="text" placeholder="🔍 ค้นหาพนักงาน"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 200 }} />

        <button onClick={fetchData} disabled={loading || !!snapshotMode}
          style={{ padding: "7px 14px", background: snapshotMode ? "#9ca3af" : "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: snapshotMode ? "not-allowed" : "pointer", fontWeight: 600 }}>
          🔄 คำนวณใหม่
        </button>
        <button onClick={handleSaveClick} disabled={saving || savingLocked || filtered.length === 0 || !!snapshotMode}
          style={{ padding: "7px 14px", background: (saving || savingLocked || !!snapshotMode) ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: (saving || savingLocked || !!snapshotMode) ? "not-allowed" : "pointer", fontWeight: 600 }}>
          {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
        </button>
        <button onClick={openSaveAndLockPreview} disabled={saving || savingLocked || filtered.length === 0 || payablesCreated > 0}
          title={payablesCreated > 0 ? "ตั้งจ่ายแล้ว — ดูที่หน้าบันทึกการจ่าย" : "บันทึก + ตั้งจ่าย"}
          style={{ padding: "7px 14px", background: (saving || savingLocked || payablesCreated > 0) ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: (saving || savingLocked || payablesCreated > 0) ? "not-allowed" : "pointer", fontWeight: 600 }}>
          {savingLocked ? "กำลังบันทึก+ตั้งจ่าย..." : "📝 บันทึกตั้งจ่าย"}
        </button>
        <button onClick={openHistory}
          style={{ padding: "7px 14px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          📜 ประวัติ
        </button>
        <button onClick={exportCSV} disabled={filtered.length === 0}
          style={{ padding: "7px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          📥 Export CSV
        </button>
      </div>

      {/* เดือนนี้บันทึกแล้ว — แค่ indicator (ไม่โหลด snapshot) */}
      {snapshotMode && (
        <div style={{ padding: "8px 14px", marginBottom: 12, borderRadius: 8, background: "#eff6ff", color: "#1e40af", fontSize: 13, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>🛈 <strong>เดือนนี้บันทึกแล้ว</strong> — เมื่อ {snapshotMode.saved_at ? new Date(snapshotMode.saved_at).toLocaleString("th-TH") : "-"} โดย {snapshotMode.saved_by || "-"}</span>
          {snapshotMode.is_locked && <span style={{ padding: "2px 8px", background: "#dc2626", color: "#fff", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>🔒 ล็อก</span>}
          {payablesCreated > 0 && <span style={{ padding: "2px 8px", background: "#10b981", color: "#fff", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>💼 ตั้งจ่าย {payablesCreated} เอกสาร</span>}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>📜 ดูข้อมูลที่บันทึก ที่ปุ่ม "ประวัติ"</span>
        </div>
      )}

      {/* Payable Popup — ตั้งจ่าย */}
      {payablePopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ background: "#fff", padding: 22, borderRadius: 12, width: 920, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 6px", color: "#072d6b" }}>💼 ตั้งจ่าย — {monthDisplay(month)}</h3>
            <div style={{ marginBottom: 14, fontSize: 13, color: "#6b7280" }}>
              สร้างเอกสารเจ้าหนี้ 5 ประเภทต่อสังกัด: <strong>เงินเดือนสุทธิพนักงาน</strong> / ประกันสังคม / สรรพากร / กองทุนฯ / กยศ.
            </div>

            {payablePopup.loading ? <div style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</div>
            : payablePopup.error ? <div style={{ padding: 12, background: "#fee2e2", color: "#991b1b", borderRadius: 6 }}>{payablePopup.error}</div>
            : (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
                  <thead style={{ background: "#f3f4f6" }}>
                    <tr>
                      <th style={th3}>สังกัด</th>
                      <th style={th3}>บัญชีจ่าย</th>
                      <th style={{ ...th3, textAlign: "right", background: "#dbeafe" }}>เงินเดือนสุทธิ</th>
                      <th style={{ ...th3, textAlign: "right" }}>ประกันสังคม</th>
                      <th style={{ ...th3, textAlign: "right" }}>สรรพากร</th>
                      <th style={{ ...th3, textAlign: "right" }}>กองทุนฯ</th>
                      <th style={{ ...th3, textAlign: "right" }}>กยศ.</th>
                      <th style={{ ...th3, textAlign: "right" }}>รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payablePopup.breakdown || []).map(b => {
                      const sum = Number(b.salary_amount||0) + Number(b.sso_amount||0) + Number(b.tax_amount||0) + Number(b.pf_amount||0) + Number(b.loan_amount||0);
                      return (
                        <tr key={b.affiliation} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={{ ...td3, fontWeight: 700 }}>{b.affiliation}</td>
                          <td style={td3}>
                            {b.bank_account_id ? (
                              <span style={{ fontSize: 11 }}>
                                <strong>{b.bank_name}</strong> {b.account_no}<br/>
                                <span style={{ color: "#6b7280" }}>{b.account_name}</span>
                              </span>
                            ) : <span style={{ color: "#dc2626", fontSize: 11 }}>⚠️ ยังไม่ได้ตั้งบัญชี</span>}
                          </td>
                          <td style={{ ...td3, textAlign: "right", background: "#eff6ff", fontWeight: 600 }}>{fmtNum(b.salary_amount)}</td>
                          <td style={{ ...td3, textAlign: "right" }}>{fmtNum(b.sso_amount)}</td>
                          <td style={{ ...td3, textAlign: "right" }}>{fmtNum(b.tax_amount)}</td>
                          <td style={{ ...td3, textAlign: "right" }}>{fmtNum(b.pf_amount)}</td>
                          <td style={{ ...td3, textAlign: "right" }}>{fmtNum(b.loan_amount)}</td>
                          <td style={{ ...td3, textAlign: "right", fontWeight: 700, color: "#7c3aed" }}>{fmtNum(sum)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ padding: "10px 12px", background: "#fef3c7", color: "#92400e", borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
                  💡 ระบบจะสร้างเอกสารเจ้าหนี้ 1 ใบต่อ (สังกัด × ประเภท) — เฉพาะที่มียอด &gt; 0
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={doCreatePayables} disabled={creatingPayable || payablePopup.loading}
                style={{ flex: 1, padding: "9px", background: (creatingPayable || payablePopup.loading) ? "#9ca3af" : "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: (creatingPayable || payablePopup.loading) ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {creatingPayable ? "กำลังสร้างเอกสาร..." : "✅ ยืนยันตั้งจ่าย"}
              </button>
              <button onClick={() => setPayablePopup(null)} disabled={creatingPayable}
                style={{ padding: "9px 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13 }}>👥 พนักงาน: <strong>{filtered.length}</strong></span>
        <span style={{ fontSize: 13, color: "#059669" }}>💰 รวมรายได้: <strong>{fmtNum(sum("total_income"))}</strong></span>
        <span style={{ fontSize: 13, color: "#dc2626" }}>📤 รวมรายจ่าย: <strong>{fmtNum(sum("total_expense"))}</strong></span>
        <span style={{ fontSize: 14, color: "#7c3aed", fontWeight: 700 }}>💵 รวมจ่ายสุทธิ: {fmtNum(sum("net_income"))} บาท</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังคำนวณ...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล — เพิ่มพนักงานในหน้า "ข้อมูลพนักงาน" ก่อน</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead style={{ background: "#072d6b", color: "#fff", position: "sticky", top: 0 }}>
              <tr>
                <th style={th}>สังกัด</th>
                <th style={th}>ชื่อ</th>
                <th style={th}>ธนาคาร / เลขบัญชี</th>
                <th style={{ ...th, textAlign: "right" }}>เงินเดือน</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>โบนัส</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>OT-ปท.</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>OT-นอก</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>ค่าข้าว</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>ซักเสื้อ</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>เบี้ยขยัน</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>พิเศษ</th>
                <th style={{ ...th, textAlign: "right", color: "#86efac" }}>อื่นๆ</th>
                <th style={{ ...th, textAlign: "right", background: "#065f46" }}>รวมรายได้</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>SSO</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ภาษี</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>กองทุนฯ</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>กยศ.</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ผู้บริหาร</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ของหาย</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>อื่นๆ</th>
                <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ขาด-สาย</th>
                <th style={{ ...th, textAlign: "right", background: "#7f1d1d" }}>รวมรายจ่าย</th>
                <th style={{ ...th, textAlign: "right", background: "#581c87" }}>สุทธิ</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.employee_id} style={{ borderTop: "1px solid #e5e7eb", background: r.is_executive ? "#fef3c7" : "transparent" }}>
                  <td style={td}>{r.affiliation || "-"}</td>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {r.employee_name}
                    {r.is_executive && <span style={{ marginLeft: 4, fontSize: 9, padding: "1px 4px", background: "#fde68a", color: "#92400e", borderRadius: 3 }}>ผบ.</span>}
                  </td>
                  <td style={{ ...td, fontSize: 10 }}>
                    <div>{r.bank_name || "-"}</div>
                    <div style={{ fontFamily: "monospace", color: "#0369a1" }}>{r.bank_account_no || "-"}</div>
                  </td>
                  <td style={tdNum}>{fmtNum(r.salary)}</td>
                  <td style={tdNum}>{fmtNum(r.bonus)}</td>
                  <td style={tdNum}>{fmtNum(r.ot_workday)}</td>
                  <td style={tdNum}>{fmtNum(r.ot_holiday)}</td>
                  <td style={tdNum}>{fmtNum(r.meal_allowance)}</td>
                  <td style={tdNum} title={`อัตรา ${fmtNum(r.laundry_rate)} × ${r.work_days_weekday || 0} วัน (จ-ศ)`}>
                    <div>{fmtNum(r.laundry_allowance)}</div>
                    {Number(r.laundry_rate) > 0 && (
                      <div style={{ fontSize: 9, color: "#6b7280", fontWeight: 400 }}>
                        {fmtNum(r.laundry_rate)}×{r.work_days_weekday || 0}
                      </div>
                    )}
                  </td>
                  <td style={tdNum}>{fmtNum(r.diligence_allowance)}</td>
                  <td style={tdNum}>{fmtNum(r.extra_bonus)}</td>
                  <td style={tdNum}>{fmtNum(r.other_income)}</td>
                  <td style={{ ...tdNum, background: "#d1fae5", fontWeight: 700, color: "#065f46" }}>{fmtNum(r.total_income)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.sso_amount)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.tax)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.pf_amount)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.study_loan)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.admin_expense)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.lost_items)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.other_expense)}</td>
                  <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.absence_late)}</td>
                  <td style={{ ...tdNum, background: "#fee2e2", fontWeight: 700, color: "#991b1b" }}>{fmtNum(r.total_expense)}</td>
                  <td style={{ ...tdNum, background: "#ede9fe", fontWeight: 700, color: "#5b21b6", fontSize: 12 }}>{fmtNum(r.net_income)}</td>
                  <td style={td}>
                    <button onClick={() => setDetailRow(r)} style={btnView}>ดู</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: "#f3f4f6", fontWeight: 700, position: "sticky", bottom: 0 }}>
              <tr>
                <td colSpan={3} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} คน</td>
                <td style={tdNum}>{fmtNum(sum("salary"))}</td>
                <td style={tdNum}>{fmtNum(sum("bonus"))}</td>
                <td style={tdNum}>{fmtNum(sum("ot_workday"))}</td>
                <td style={tdNum}>{fmtNum(sum("ot_holiday"))}</td>
                <td style={tdNum}>{fmtNum(sum("meal_allowance"))}</td>
                <td style={tdNum}>{fmtNum(sum("laundry_allowance"))}</td>
                <td style={tdNum}>{fmtNum(sum("diligence_allowance"))}</td>
                <td style={tdNum}>{fmtNum(sum("extra_bonus"))}</td>
                <td style={tdNum}>{fmtNum(sum("other_income"))}</td>
                <td style={{ ...tdNum, background: "#d1fae5", color: "#065f46" }}>{fmtNum(sum("total_income"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("sso_amount"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("tax"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("pf_amount"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("study_loan"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("admin_expense"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("lost_items"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("other_expense"))}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(sum("absence_late"))}</td>
                <td style={{ ...tdNum, background: "#fee2e2", color: "#991b1b" }}>{fmtNum(sum("total_expense"))}</td>
                <td style={{ ...tdNum, background: "#ede9fe", color: "#5b21b6", fontSize: 13 }}>{fmtNum(sum("net_income"))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Preview Popup สำหรับ บันทึกตั้งจ่าย */}
      {previewPopup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div style={{ background: "#fff", padding: 22, borderRadius: 12, width: 920, maxWidth: "94vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 6px", color: "#072d6b" }}>📝 บันทึกตั้งจ่าย — {monthDisplay(month)}</h3>
            <div style={{ marginBottom: 14, fontSize: 13, color: "#6b7280" }}>
              ตรวจสอบยอดสรุปแยกตามสังกัด × 5 ประเภทเจ้าหนี้ ก่อนยืนยัน
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th3}>สังกัด</th>
                  <th style={{ ...th3, textAlign: "right" }}>คน</th>
                  <th style={{ ...th3, textAlign: "right", background: "#1e40af" }}>เงินเดือนสุทธิ</th>
                  <th style={{ ...th3, textAlign: "right" }}>ประกันสังคม</th>
                  <th style={{ ...th3, textAlign: "right" }}>สรรพากร</th>
                  <th style={{ ...th3, textAlign: "right" }}>กองทุนฯ</th>
                  <th style={{ ...th3, textAlign: "right" }}>กยศ.</th>
                  <th style={{ ...th3, textAlign: "right" }}>รวม</th>
                </tr>
              </thead>
              <tbody>
                {previewPopup.breakdown.map(b => {
                  const sumRow = b.salary + b.sso + b.tax + b.pf + b.loan;
                  return (
                    <tr key={b.affiliation} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ ...td3, fontWeight: 700, color: "#072d6b" }}>{b.affiliation}</td>
                      <td style={{ ...td3, textAlign: "right" }}>{b.count}</td>
                      <td style={{ ...td3, textAlign: "right", background: "#eff6ff", fontWeight: 600 }}>{fmtNum(b.salary)}</td>
                      <td style={{ ...td3, textAlign: "right" }}>{fmtNum(b.sso)}</td>
                      <td style={{ ...td3, textAlign: "right" }}>{fmtNum(b.tax)}</td>
                      <td style={{ ...td3, textAlign: "right" }}>{fmtNum(b.pf)}</td>
                      <td style={{ ...td3, textAlign: "right" }}>{fmtNum(b.loan)}</td>
                      <td style={{ ...td3, textAlign: "right", fontWeight: 700, color: "#7c3aed" }}>{fmtNum(sumRow)}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: "#f3f4f6", fontWeight: 700, borderTop: "2px solid #072d6b" }}>
                  <td style={td3}>รวมทุกสังกัด</td>
                  <td style={{ ...td3, textAlign: "right" }}>{previewPopup.breakdown.reduce((s, b) => s + b.count, 0)}</td>
                  <td style={{ ...td3, textAlign: "right", background: "#dbeafe", color: "#1e40af" }}>{fmtNum(previewPopup.breakdown.reduce((s, b) => s + b.salary, 0))}</td>
                  <td style={{ ...td3, textAlign: "right" }}>{fmtNum(previewPopup.breakdown.reduce((s, b) => s + b.sso, 0))}</td>
                  <td style={{ ...td3, textAlign: "right" }}>{fmtNum(previewPopup.breakdown.reduce((s, b) => s + b.tax, 0))}</td>
                  <td style={{ ...td3, textAlign: "right" }}>{fmtNum(previewPopup.breakdown.reduce((s, b) => s + b.pf, 0))}</td>
                  <td style={{ ...td3, textAlign: "right" }}>{fmtNum(previewPopup.breakdown.reduce((s, b) => s + b.loan, 0))}</td>
                  <td style={{ ...td3, textAlign: "right", color: "#7c3aed" }}>{fmtNum(previewPopup.breakdown.reduce((s, b) => s + b.salary + b.sso + b.tax + b.pf + b.loan, 0))}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ padding: "10px 12px", background: "#fef3c7", color: "#92400e", borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
              ⚠️ กดยืนยัน → สร้าง snapshot + เอกสารเจ้าหนี้ ({previewPopup.breakdown.length} สังกัด × 5 ประเภท)<br/>
              <strong>ยกเลิกได้</strong> ตราบที่ยังไม่มีเอกสารใดถูกจ่ายเงิน
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSaveAndLock} disabled={savingLocked}
                style={{ flex: 1, padding: "9px", background: savingLocked ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: savingLocked ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {savingLocked ? "กำลังบันทึก..." : "✅ ยืนยันบันทึกตั้งจ่าย"}
              </button>
              <button onClick={() => setPreviewPopup(null)} disabled={savingLocked}
                style={{ padding: "9px 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Snapshot Popup */}
      {viewSnap && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setViewSnap(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: "96vw", maxHeight: "92vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>📜 ดู snapshot — {monthDisplay(viewSnap.item.month_year)}</h3>
              <button onClick={() => setViewSnap(null)} style={{ padding: "6px 12px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>ปิด</button>
            </div>
            <div style={{ marginBottom: 10, fontSize: 13, color: "#6b7280" }}>
              บันทึกเมื่อ {viewSnap.item.saved_at ? new Date(viewSnap.item.saved_at).toLocaleString("th-TH") : "-"} • โดย {viewSnap.item.saved_by || "-"} • {viewSnap.item.employee_count} คน
            </div>
            {viewSnap.loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div>
            : viewSnap.rows.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</div>
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead style={{ background: "#072d6b", color: "#fff", position: "sticky", top: 0 }}>
                    <tr>
                      <th style={th}>สังกัด</th>
                      <th style={th}>ชื่อ</th>
                      <th style={th}>ธนาคาร/บัญชี</th>
                      <th style={{ ...th, textAlign: "right" }}>เงินเดือน</th>
                      <th style={{ ...th, textAlign: "right", color: "#86efac" }}>OT-ปท</th>
                      <th style={{ ...th, textAlign: "right", color: "#86efac" }}>OT-นอก</th>
                      <th style={{ ...th, textAlign: "right", color: "#86efac" }}>ค่าข้าว</th>
                      <th style={{ ...th, textAlign: "right", color: "#86efac" }}>ซักเสื้อ</th>
                      <th style={{ ...th, textAlign: "right", color: "#86efac" }}>เบี้ยขยัน</th>
                      <th style={{ ...th, textAlign: "right", background: "#065f46" }}>รวมรายได้</th>
                      <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>SSO</th>
                      <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>ภาษี</th>
                      <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>กองทุน</th>
                      <th style={{ ...th, textAlign: "right", color: "#fca5a5" }}>กยศ</th>
                      <th style={{ ...th, textAlign: "right", background: "#7f1d1d" }}>รวมรายจ่าย</th>
                      <th style={{ ...th, textAlign: "right", background: "#581c87" }}>สุทธิ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewSnap.rows.map(r => (
                      <tr key={r.snapshot_id || r.employee_id} style={{ borderTop: "1px solid #e5e7eb", background: r.is_executive ? "#fef3c7" : "transparent" }}>
                        <td style={td}>{r.affiliation || "-"}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{r.employee_name}</td>
                        <td style={{ ...td, fontSize: 10 }}>{r.bank_name || "-"} <span style={{ fontFamily: "monospace", color: "#0369a1" }}>{r.bank_account_no || ""}</span></td>
                        <td style={tdNum}>{fmtNum(r.salary)}</td>
                        <td style={tdNum}>{fmtNum(r.ot_workday)}</td>
                        <td style={tdNum}>{fmtNum(r.ot_holiday)}</td>
                        <td style={tdNum}>{fmtNum(r.meal_allowance)}</td>
                        <td style={tdNum}>{fmtNum(r.laundry_allowance)}</td>
                        <td style={tdNum}>{fmtNum(r.diligence_allowance)}</td>
                        <td style={{ ...tdNum, background: "#d1fae5", fontWeight: 700, color: "#065f46" }}>{fmtNum(r.total_income)}</td>
                        <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.sso_amount)}</td>
                        <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.tax)}</td>
                        <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.pf_amount)}</td>
                        <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(r.study_loan)}</td>
                        <td style={{ ...tdNum, background: "#fee2e2", fontWeight: 700, color: "#991b1b" }}>{fmtNum(r.total_expense)}</td>
                        <td style={{ ...tdNum, background: "#ede9fe", fontWeight: 700, color: "#5b21b6" }}>{fmtNum(r.net_income)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowHistory(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 820, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>📜 ประวัติการบันทึก</h3>
            {historyLoading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
            ) : historyList.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีประวัติ</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#072d6b", color: "#fff" }}>
                  <tr>
                    <th style={{ padding: 8, textAlign: "left" }}>เดือน</th>
                    <th style={{ padding: 8, textAlign: "left" }}>วันที่บันทึก</th>
                    <th style={{ padding: 8, textAlign: "left" }}>ผู้บันทึก</th>
                    <th style={{ padding: 8, textAlign: "right" }}>คน</th>
                    <th style={{ padding: 8, textAlign: "right" }}>ยอดสุทธิรวม</th>
                    <th style={{ padding: 8, textAlign: "center" }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map(it => (
                    <tr key={it.save_group} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 8, fontWeight: 600 }}>{monthDisplay(it.month_year)}</td>
                      <td style={{ padding: 8, fontSize: 12 }}>{it.saved_at ? new Date(it.saved_at).toLocaleString("th-TH") : "-"}</td>
                      <td style={{ padding: 8 }}>{it.saved_by || "-"}</td>
                      <td style={{ padding: 8, textAlign: "right" }}>{it.employee_count}</td>
                      <td style={{ padding: 8, textAlign: "right", color: "#5b21b6", fontWeight: 700 }}>{fmtNum(it.total_net_income)}</td>
                      <td style={{ padding: 8, textAlign: "center" }}>
                        <button onClick={() => viewSnapshotPopup(it)}
                          style={{ padding: "4px 10px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, marginRight: 4 }}>
                          👁️ ดู
                        </button>
                        <button onClick={() => cancelSnapshot(it)} disabled={!!it.is_paid || !!it.has_paid_payment}
                          title={it.is_paid || it.has_paid_payment ? "จ่ายเงินแล้ว ไม่สามารถยกเลิก" : "ยกเลิกการบันทึก"}
                          style={{ padding: "4px 10px", background: (it.is_paid || it.has_paid_payment) ? "#9ca3af" : "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: (it.is_paid || it.has_paid_payment) ? "not-allowed" : "pointer", fontSize: 12 }}>
                          🗑️ ยกเลิก
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setShowHistory(false)} style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail popup (สลิปเงินเดือน) */}
      {detailRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDetailRow(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 6px", color: "#072d6b", textAlign: "center" }}>📄 สลิปเงินเดือน</h3>
            <div style={{ textAlign: "center", marginBottom: 12, fontSize: 13, color: "#6b7280" }}>{monthDisplay(month)}</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14, fontSize: 13 }}>
              <KV label="ชื่อ" value={detailRow.employee_name} />
              <KV label="สังกัด" value={detailRow.affiliation} />
              <KV label="ตำแหน่ง" value={detailRow.position} />
              <KV label="ธนาคาร" value={detailRow.bank_name} />
              <KV label="เลขที่บัญชี" value={detailRow.bank_account_no} mono />
            </div>

            <div style={{ background: "#d1fae5", padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: "#065f46", marginBottom: 6 }}>💰 รายได้</div>
              <RowKV label="เงินเดือน" value={fmtNum(detailRow.salary)} />
              <RowKV label="โบนัส" value={fmtNum(detailRow.bonus)} />
              <RowKV label="OT-วันทำงาน" value={fmtNum(detailRow.ot_workday)} />
              <RowKV label="OT-ปกติ" value={fmtNum(detailRow.ot_holiday)} />
              <RowKV label="ค่าข้าว" value={fmtNum(detailRow.meal_allowance)} />
              <RowKV
                label={`ค่าซักเสื้อ${Number(detailRow.laundry_rate) > 0 ? ` (${fmtNum(detailRow.laundry_rate)} × ${detailRow.work_days_weekday || 0} วัน จ-ศ)` : ""}`}
                value={fmtNum(detailRow.laundry_allowance)}
              />
              <RowKV label="ค่าเบี้ยขยัน" value={fmtNum(detailRow.diligence_allowance)} />
              <RowKV label="เงินเพิ่มพิเศษ" value={fmtNum(detailRow.extra_bonus)} />
              <RowKV label="รายได้อื่นๆ" value={fmtNum(detailRow.other_income)} />
              <RowKV label="รวมรายได้" value={fmtNum(detailRow.total_income)} bold />
            </div>

            <div style={{ background: "#fee2e2", padding: 10, borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>📤 รายจ่าย</div>
              <RowKV label="ประกันสังคม (cap 875)" value={fmtNum(detailRow.sso_amount)} />
              <RowKV label="ภาษี" value={fmtNum(detailRow.tax)} />
              <RowKV label="กองทุนสำรองฯ" value={fmtNum(detailRow.pf_amount)} />
              <RowKV label="กยศ. (เงินกู้การศึกษา)" value={fmtNum(detailRow.study_loan)} />
              <RowKV label="ค่าใช้จ่ายผู้บริหาร" value={fmtNum(detailRow.admin_expense)} />
              <RowKV label="ของหาย" value={fmtNum(detailRow.lost_items)} />
              <RowKV label="รายจ่ายอื่นๆ" value={fmtNum(detailRow.other_expense)} />
              <RowKV label="ขาด-สาย" value={fmtNum(detailRow.absence_late)} />
              <RowKV label="รวมรายจ่าย" value={fmtNum(detailRow.total_expense)} bold />
            </div>

            <div style={{ background: "#ede9fe", padding: 12, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#5b21b6" }}>💵 รายได้สุทธิ</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#5b21b6" }}>{fmtNum(detailRow.net_income)} บาท</div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setDetailRow(null)} style={{ padding: "8px 16px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KV({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div style={{ fontWeight: 600, fontFamily: mono ? "monospace" : "inherit" }}>{value || "-"}</div>
    </div>
  );
}
function RowKV({ label, value, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderTop: bold ? "1px solid rgba(0,0,0,0.1)" : "none", marginTop: bold ? 4 : 0, paddingTop: bold ? 8 : 3 }}>
      <span style={{ fontSize: 12, fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontFamily: "monospace", fontWeight: bold ? 700 : 400, fontSize: 13 }}>{value}</span>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "8px 6px", textAlign: "left", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "6px", fontSize: 11 };
const tdNum = { padding: "6px", fontSize: 11, textAlign: "right", fontFamily: "monospace" };
const th3 = { padding: "8px 6px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", color: "#374151" };
const td3 = { padding: "6px", fontSize: 12, whiteSpace: "nowrap" };
const btnView = { padding: "3px 8px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10 };
