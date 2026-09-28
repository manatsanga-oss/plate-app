import React, { useEffect, useMemo, useState } from "react";

// บันทึกลดหนี้/เพิ่มหนี้ ประกัน COSMOS (user 2026-09-28)
// ปรับปรุงค่าเบี้ยประกันที่วางบิล/จ่ายเงินไปแล้วเพราะเลือกรายการผิด:
//   1) เลือกกรมธรรม์เดิมที่วางบิลแล้ว → ยกเลิก (ลดหนี้เต็มเบี้ยเดิม)
//   2) กรอกกรมธรรม์ใหม่ + เบี้ยใหม่ → บันทึกเป็นรายการใหม่
//   ระบบสร้าง 2 รายการรอวางบิลรอบถัดไป (เบี้ยเดิมติดลบ + เบี้ยใหม่) → ยอดวางบิลสุทธิ = ส่วนต่าง
//   เบี้ยใหม่ < เดิม = ลดหนี้ (CCN-) · เบี้ยใหม่ > เดิม = เพิ่มหนี้ (CDN-) · ใช้ได้ทุกแผน rsa/pa/3plus/theft/theft_renewal
// backend: registrations-api (Registrations API (18).json) actions search_cosmos_for_adjust / list_cosmos_plan_options /
//          save_cosmos_adjustment / list_cosmos_adjustments / cancel_cosmos_adjustment · ตาราง cosmos_adjustments
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

const PLAN_OPTS = [
  { key: "rsa",           label: "RSA (ช่วยเหลือฉุกเฉิน)",   color: "#1565c0" },
  { key: "pa",            label: "PA (อุบัติเหตุส่วนบุคคล)",  color: "#2e7d32" },
  { key: "3plus",         label: "3 PLUS",                     color: "#7b1fa2" },
  { key: "theft",         label: "ประกันรถหาย",              color: "#c62828" },
  { key: "theft_renewal", label: "ประกันรถหายปีต่อ",        color: "#ea580c" },
];
const planOf = (k) => PLAN_OPTS.find(p => p.key === k) || { key: k, label: k || "-", color: "#6b7280" };
const TYPE_LABEL = { credit: "ลดหนี้", debit: "เพิ่มหนี้", same: "เปลี่ยนกรมธรรม์ (เบี้ยเท่าเดิม)" };
const TYPE_COLOR = { credit: "#15803d", debit: "#b91c1c", same: "#6b7280" };

const fmt = (v) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thDate = (v) => { if (!v) return "-"; const d = new Date(String(v).slice(0, 10)); return isNaN(d) ? "-" : d.toLocaleDateString("th-TH"); };
const pad = (n) => String(n).padStart(2, "0");
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const esc = (v) => String(v == null ? "" : v).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

// n8n ตอบ body ว่างเมื่อ query ได้ 0 แถว / workflow ยังไม่มี action → อ่าน text ก่อน
async function postJSON(body) {
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}

function PlanBadge({ plan }) {
  const p = planOf(plan);
  return <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: p.color, color: "#fff", whiteSpace: "nowrap" }}>{p.label}</span>;
}
function PayBadge({ billing, paid }) {
  if (paid) return <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "#d1fae5", color: "#065f46", whiteSpace: "nowrap" }}>จ่ายแล้ว {paid}</span>;
  if (billing) return <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "#dbeafe", color: "#1e40af", whiteSpace: "nowrap" }}>วางบิลแล้ว {billing}</span>;
  return <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "#fef3c7", color: "#92400e", whiteSpace: "nowrap" }}>รอวางบิล</span>;
}

const inputSt = { padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, width: "100%", boxSizing: "border-box", fontFamily: "Tahoma" };
const labelSt = { fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 3, display: "block" };

export default function CosmosAdjustmentPage({ currentUser }) {
  const isAdmin = currentUser?.username === "admin" || String(currentUser?.role || "").toLowerCase() === "admin";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [month, setMonth] = useState("");          // กรองรายการตามเดือน (ว่าง = ทั้งหมด)
  const [typeFilter, setTypeFilter] = useState("all");
  const [showCancelled, setShowCancelled] = useState(false);
  const [search, setSearch] = useState("");

  // ฟอร์ม
  const [formOpen, setFormOpen] = useState(false);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState(null);        // null = ยังไม่ค้น
  const [old, setOld] = useState(null);            // กรมธรรม์เดิมที่เลือก
  const [planOptions, setPlanOptions] = useState([]);
  const [newPlan, setNewPlan] = useState("");
  const [newAppNo, setNewAppNo] = useState("");
  const [newPlanName, setNewPlanName] = useState("");
  const [newPremium, setNewPremium] = useState("");
  const [coverStart, setCoverStart] = useState("");
  const [coverEnd, setCoverEnd] = useState("");
  const [adjDate, setAdjDate] = useState(todayIso());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  async function load() {
    setLoading(true);
    const d = await postJSON({ action: "list_cosmos_adjustments" }).catch(() => null);
    if (d === null) setMessage("⚠️ โหลดไม่ได้ — n8n ยังไม่มี action list_cosmos_adjustments (ต้อง re-import Registrations API (18).json)");
    setRows(Array.isArray(d) ? d : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openForm() {
    setFormOpen(true); setQ(""); setFound(null); setOld(null);
    setNewPlan(""); setNewAppNo(""); setNewPlanName(""); setNewPremium(""); setCoverStart(""); setCoverEnd("");
    setAdjDate(todayIso()); setReason(""); setFormErr("");
    if (!planOptions.length) postJSON({ action: "list_cosmos_plan_options" }).then(d => setPlanOptions(Array.isArray(d) ? d : [])).catch(() => {});
  }

  async function doSearch() {
    const s = q.trim();
    if (s.length < 3) { setFormErr("พิมพ์คำค้นอย่างน้อย 3 ตัวอักษร (เลขกรมธรรม์ / ชื่อลูกค้า / เลขตัวถัง / เลขที่ใบขาย)"); return; }
    setFormErr(""); setSearching(true);
    const d = await postJSON({ action: "search_cosmos_for_adjust", q: s }).catch(() => null);
    setFound(Array.isArray(d) ? d : []);
    setSearching(false);
  }

  function pickOld(r) {
    setOld(r);
    setNewPlan(r.plan || "");
    setNewPlanName(""); setNewPremium(""); setNewAppNo("");
    setCoverStart(r.cover_start ? String(r.cover_start).slice(0, 10) : "");
    setCoverEnd(r.cover_end ? String(r.cover_end).slice(0, 10) : "");
    setFormErr("");
  }

  const planNameChoices = useMemo(() => planOptions.filter(o => o.plan === newPlan), [planOptions, newPlan]);
  const oldPrem = Number(old?.premium || 0);
  const newPrem = Number(String(newPremium).replace(/,/g, ""));
  const hasNewPrem = String(newPremium).trim() !== "" && isFinite(newPrem) && newPrem >= 0;
  const diff = hasNewPrem ? Math.round((newPrem - oldPrem) * 100) / 100 : null;
  const adjType = diff == null ? null : diff < 0 ? "credit" : diff > 0 ? "debit" : "same";

  async function save() {
    if (!old) { setFormErr("กรุณาเลือกกรมธรรม์เดิมที่ต้องการยกเลิก"); return; }
    if (!newPlan) { setFormErr("กรุณาเลือกประเภทประกันของกรมธรรม์ใหม่"); return; }
    if (!newAppNo.trim()) { setFormErr("กรุณากรอกเลขกรมธรรม์ใหม่"); return; }
    if (!hasNewPrem) { setFormErr("กรุณากรอกค่าเบี้ยกรมธรรม์ใหม่"); return; }
    if (newPlan === old.plan && newAppNo.trim() === String(old.app_no || "").trim() && diff === 0) { setFormErr("กรมธรรม์ใหม่เหมือนเดิมทุกอย่าง (แผน/เลขกรมธรรม์/เบี้ย) — ไม่มีอะไรให้ปรับปรุง"); return; }
    if (!reason.trim()) { setFormErr("กรุณาระบุเหตุผลการปรับปรุง"); return; }
    const head = adjType === "credit" ? `ลดหนี้ ${fmt(Math.abs(diff))} บาท` : adjType === "debit" ? `เพิ่มหนี้ ${fmt(diff)} บาท` : "เบี้ยเท่าเดิม (เปลี่ยนกรมธรรม์)";
    if (!window.confirm(`ยืนยันบันทึก${head}?\n\nยกเลิกกรมธรรม์เดิม: ${old.app_no} (${planOf(old.plan).label}) เบี้ย ${fmt(oldPrem)}\nออกกรมธรรม์ใหม่: ${newAppNo.trim()} (${planOf(newPlan).label}) เบี้ย ${fmt(newPrem)}\n\nระบบจะสร้างรายการรอวางบิล 2 รายการ (เบี้ยเดิมติดลบ + เบี้ยใหม่) เข้ารอบวางบิล COSMOS ถัดไป`)) return;
    setSaving(true); setFormErr("");
    try {
      const res = await postJSON({
        action: "save_cosmos_adjustment", old_id: old.id,
        new_plan: newPlan, new_app_no: newAppNo.trim(), new_plan_name: newPlanName.trim(), new_premium: newPrem,
        cover_start: coverStart, cover_end: coverEnd, adj_date: adjDate, reason: reason.trim(),
        created_by: currentUser?.name || currentUser?.username || "",
      });
      if (!res) throw new Error("n8n ยังไม่มี action save_cosmos_adjustment (ต้อง re-import Registrations API (18).json)");
      if (res.success !== true) throw new Error(res.error || "บันทึกไม่สำเร็จ");
      setFormOpen(false);
      setMessage(`✅ บันทึก ${res.adj_no} (${TYPE_LABEL[res.adj_type] || ""}) แล้ว — ส่วนต่าง ${fmt(res.diff_amount)} บาท${res.new_existing ? " · กรมธรรม์ใหม่มีบันทึกอยู่แล้ว ใช้รายการเดิม ไม่สร้างซ้ำ" : ""}`);
      load();
    } catch (e) { setFormErr(`❌ ${e.message || e}`); }
    setSaving(false);
  }

  async function cancelAdj(r) {
    if (!window.confirm(`ยกเลิก ${r.adj_no}?\nรายการลดหนี้/กรมธรรม์ใหม่ที่รอวางบิลจะถูกลบ และกรมธรรม์เดิม ${r.old_app_no} กลับมาใช้งานตามเดิม`)) return;
    const res = await postJSON({ action: "cancel_cosmos_adjustment", id: r.id, cancelled_by: currentUser?.name || currentUser?.username || "" }).catch(() => null);
    if (res?.success === true) { setMessage(`ยกเลิก ${r.adj_no} แล้ว`); load(); }
    else alert(res?.error || "ยกเลิกไม่สำเร็จ");
  }

  function printAdj(r) {
    const title = r.adj_type === "credit" ? "ใบลดหนี้ ประกัน COSMOS" : r.adj_type === "debit" ? "ใบเพิ่มหนี้ ประกัน COSMOS" : "ใบปรับปรุงกรมธรรม์ ประกัน COSMOS";
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(r.adj_no)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: 'TH Sarabun New','Tahoma',sans-serif; font-size: 14px; color: #111; padding: 10px; }
  h2 { text-align: center; margin: 0 0 4px; font-size: 20px; }
  .info { display: flex; justify-content: space-between; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #333; padding: 5px 8px; font-size: 13px; }
  th { background: #e5e7eb; text-align: center; }
  td.num { text-align: right; white-space: nowrap; }
  .total td { font-weight: 700; background: #f3f4f6; }
  .footer { margin-top: 50px; display: flex; justify-content: space-between; }
  .sig { text-align: center; width: 45%; }
  .sig-line { border-bottom: 1px solid #333; margin: 40px auto 4px; width: 200px; }
  @media print { body { padding: 0; } }
</style></head><body>
<h2>${title}</h2>
<div class="info"><div>เลขที่: <b>${esc(r.adj_no)}</b></div><div>วันที่: <b>${thDate(r.adj_date)}</b></div></div>
<div class="info"><div>ลูกค้า: <b>${esc(r.customer_name || "-")}</b></div><div>เลขตัวถัง: <b>${esc(r.chassis_no || "-")}</b></div></div>
<div class="info"><div>เลขที่ใบขาย: <b>${esc(r.invoice_no || "-")}</b></div><div>ผู้บันทึก: <b>${esc(r.created_by || "-")}</b></div></div>
<table>
  <thead><tr><th>รายการ</th><th>ประเภทประกัน</th><th>เลขกรมธรรม์</th><th>แผน</th><th>ค่าเบี้ย (บาท)</th></tr></thead>
  <tbody>
    <tr><td>ยกเลิกกรมธรรม์เดิม${r.old_billing_doc_no ? ` (วางบิล ${esc(r.old_billing_doc_no)})` : ""}</td><td>${esc(planOf(r.old_plan).label)}</td><td>${esc(r.old_app_no || "-")}</td><td>${esc(r.old_plan_name || "-")}</td><td class="num">-${fmt(r.old_premium)}</td></tr>
    <tr><td>ออกกรมธรรม์ใหม่</td><td>${esc(planOf(r.new_plan).label)}</td><td>${esc(r.new_app_no || "-")}</td><td>${esc(r.new_plan_name || "-")}</td><td class="num">${fmt(r.new_premium)}</td></tr>
    <tr class="total"><td colspan="4">${r.adj_type === "credit" ? "ลดหนี้ (COSMOS ต้องคืน/หักกลบรอบถัดไป)" : r.adj_type === "debit" ? "เพิ่มหนี้ (จ่ายเพิ่มรอบถัดไป)" : "ส่วนต่าง"}</td><td class="num">${fmt(r.diff_amount)}</td></tr>
  </tbody>
</table>
<p>เหตุผล: ${esc(r.reason || "-")}</p>
${r.cover_start || r.cover_end ? `<p>ระยะเวลาคุ้มครองกรมธรรม์ใหม่: ${thDate(r.cover_start)} – ${thDate(r.cover_end)}</p>` : ""}
<div class="footer">
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ${esc(r.created_by || "___________")} (ผู้บันทึก)</div>
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ___________ (ผู้อนุมัติ)</div>
</div>
</body></html>`);
    w.document.close();
    w.print();
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter(r => {
      if (!showCancelled && r.status === "cancelled") return false;
      if (month && String(r.adj_date || "").slice(0, 7) !== month) return false;
      if (typeFilter !== "all" && r.adj_type !== typeFilter) return false;
      if (s && ![r.adj_no, r.customer_name, r.chassis_no, r.old_app_no, r.new_app_no, r.invoice_no].some(v => String(v || "").toLowerCase().includes(s))) return false;
      return true;
    });
  }, [rows, month, typeFilter, showCancelled, search]);
  const active = filtered.filter(r => r.status !== "cancelled");
  const sumCredit = active.filter(r => r.adj_type === "credit").reduce((t, r) => t + Math.abs(Number(r.diff_amount || 0)), 0);
  const sumDebit = active.filter(r => r.adj_type === "debit").reduce((t, r) => t + Number(r.diff_amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">บันทึกลดหนี้ / เพิ่มหนี้ ประกัน COSMOS</div>
        <button className="btn-primary" onClick={openForm}>+ บันทึกลดหนี้/เพิ่มหนี้</button>
      </div>
      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 10 }}>
        ใช้ปรับปรุงค่าเบี้ยประกันที่วางบิล/จ่ายเงินไปแล้วเพราะเลือกรายการผิด — ยกเลิกกรมธรรม์เดิม + ออกกรมธรรม์ใหม่ (ทุกประเภทประกัน COSMOS) · ส่วนต่างจะเข้ารอบวางบิล COSMOS ถัดไปอัตโนมัติ
      </div>
      {message && <div style={{ padding: "8px 14px", background: message.startsWith("⚠️") ? "#fef3c7" : "#d1fae5", borderRadius: 8, marginBottom: 10, color: message.startsWith("⚠️") ? "#92400e" : "#065f46" }}>{message}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา เลขที่ / ลูกค้า / เลขถัง / เลขกรมธรรม์" style={{ ...inputSt, width: 280 }} />
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputSt, width: 170 }} title="กรองตามเดือนที่บันทึก (ว่าง = ทั้งหมด)" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inputSt, width: 150 }}>
          <option value="all">ทุกประเภท</option><option value="credit">ลดหนี้</option><option value="debit">เพิ่มหนี้</option><option value="same">เบี้ยเท่าเดิม</option>
        </select>
        <label style={{ fontSize: 12.5, color: "#374151", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} /> แสดงที่ยกเลิก
        </label>
        <button onClick={load} style={{ padding: "7px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Refresh</button>
        <span style={{ fontSize: 13, color: "#374151" }}>
          {active.length} รายการ · ลดหนี้ <b style={{ color: TYPE_COLOR.credit }}>{fmt(sumCredit)}</b> · เพิ่มหนี้ <b style={{ color: TYPE_COLOR.debit }}>{fmt(sumDebit)}</b> · สุทธิ <b>{fmt(sumDebit - sumCredit)}</b>
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ fontSize: 12.5 }}>
          <thead><tr>
            <th>#</th><th>เลขที่</th><th>วันที่</th><th>ประเภท</th><th>ลูกค้า / เลขถัง</th>
            <th>กรมธรรม์เดิม (ยกเลิก)</th><th style={{ textAlign: "right" }}>เบี้ยเดิม</th>
            <th>กรมธรรม์ใหม่</th><th style={{ textAlign: "right" }}>เบี้ยใหม่</th>
            <th style={{ textAlign: "right" }}>ส่วนต่าง</th><th>สถานะวางบิลรอบใหม่</th><th>เหตุผล</th><th>ผู้บันทึก</th><th>จัดการ</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={14} style={{ textAlign: "center", padding: 20 }}>กำลังโหลด…</td></tr> :
              filtered.length === 0 ? <tr><td colSpan={14} style={{ textAlign: "center", padding: 20, color: "#9ca3af" }}>ยังไม่มีรายการ</td></tr> :
              filtered.map((r, i) => {
                const cancelled = r.status === "cancelled";
                const billedAny = r.credit_billing_doc_no || (!r.new_existing && r.new_billing_doc_no);
                return (
                  <tr key={r.id} style={{ opacity: cancelled ? 0.5 : 1 }}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{r.adj_no}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{thDate(r.adj_date)}</td>
                    <td><span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, color: "#fff", background: cancelled ? "#9ca3af" : TYPE_COLOR[r.adj_type] || "#6b7280", whiteSpace: "nowrap" }}>{cancelled ? "ยกเลิกแล้ว" : (r.adj_type === "same" ? "เบี้ยเท่าเดิม" : TYPE_LABEL[r.adj_type])}</span></td>
                    <td><div>{r.customer_name || "-"}</div><div style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{r.chassis_no || ""}</div></td>
                    <td><PlanBadge plan={r.old_plan} /><div style={{ fontFamily: "monospace", fontSize: 11.5, marginTop: 2 }}>{r.old_app_no}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{r.old_plan_name}</div><div style={{ fontSize: 10.5, color: "#6b7280" }}>{r.old_paid_doc_no ? `จ่ายแล้ว ${r.old_paid_doc_no}` : r.old_billing_doc_no ? `วางบิล ${r.old_billing_doc_no}` : ""}</div></td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmt(r.old_premium)}</td>
                    <td><PlanBadge plan={r.new_plan} /><div style={{ fontFamily: "monospace", fontSize: 11.5, marginTop: 2 }}>{r.new_app_no}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{r.new_plan_name}</div></td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmt(r.new_premium)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", color: TYPE_COLOR[r.adj_type] }}>{Number(r.diff_amount) > 0 ? "+" : ""}{fmt(r.diff_amount)}</td>
                    <td style={{ fontSize: 11 }}>
                      {cancelled ? "-" : (<>
                        <div>ลดหนี้เบี้ยเดิม: <PayBadge billing={r.credit_billing_doc_no} paid={r.credit_paid_doc_no} /></div>
                        <div style={{ marginTop: 3 }}>กรมธรรม์ใหม่: <PayBadge billing={r.new_billing_doc_no} paid={r.new_paid_doc_no} /></div>
                      </>)}
                    </td>
                    <td style={{ maxWidth: 200, whiteSpace: "normal", fontSize: 11.5 }}>{r.reason || "-"}</td>
                    <td style={{ fontSize: 11.5 }}>{r.created_by || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button onClick={() => printAdj(r)} style={{ padding: "3px 10px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, marginRight: 4 }}>🖨️</button>
                      {!cancelled && (isAdmin || !billedAny) && (
                        <button onClick={() => cancelAdj(r)} disabled={!!billedAny} title={billedAny ? "วางบิลแล้ว — ต้องยกเลิกใบวางบิลก่อน" : "ยกเลิกรายการนี้"}
                          style={{ padding: "3px 10px", background: billedAny ? "#d1d5db" : "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: billedAny ? "default" : "pointer", fontSize: 11 }}>ยกเลิก</button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "24px 12px" }}
          onClick={() => !saving && setFormOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: 920, maxWidth: "100%", fontFamily: "Tahoma" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>บันทึกลดหนี้ / เพิ่มหนี้ ประกัน COSMOS</h3>
              <button onClick={() => !saving && setFormOpen(false)} style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>

            {/* ขั้นที่ 1 — กรมธรรม์เดิม */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: "#b91c1c", marginBottom: 8 }}>① กรมธรรม์เดิมที่ต้องการยกเลิก (ต้องวางบิลแล้ว)</div>
              {!old ? (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} autoFocus
                      placeholder="ค้นหา เลขกรมธรรม์ / ชื่อลูกค้า / เลขตัวถัง / เลขที่ใบขาย" style={inputSt} />
                    <button onClick={doSearch} disabled={searching} style={{ padding: "7px 18px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>{searching ? "กำลังค้น…" : "🔍 ค้นหา"}</button>
                  </div>
                  {found && (
                    <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 8 }}>
                      <table className="data-table" style={{ fontSize: 12 }}>
                        <thead><tr><th>ประเภท</th><th>เลขกรมธรรม์</th><th>ลูกค้า</th><th>เลขถัง</th><th>แผน</th><th style={{ textAlign: "right" }}>เบี้ย</th><th>สถานะ</th><th></th></tr></thead>
                        <tbody>
                          {found.length === 0 ? <tr><td colSpan={8} style={{ textAlign: "center", padding: 14, color: "#9ca3af" }}>ไม่พบกรมธรรม์</td></tr> :
                            found.map(r => {
                              const done = !!r.adj_cancel_no;
                              const notBilled = r.pay_status === "pending";
                              const blocked = done || notBilled;
                              return (
                                <tr key={r.id} style={{ opacity: blocked ? 0.55 : 1 }}>
                                  <td><PlanBadge plan={r.plan} /></td>
                                  <td style={{ fontFamily: "monospace" }}>{r.app_no}</td>
                                  <td>{r.customer_name || "-"}</td>
                                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                                  <td style={{ maxWidth: 220, whiteSpace: "normal", fontSize: 11 }}>{r.plan_name || "-"}</td>
                                  <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(r.premium)}</td>
                                  <td><PayBadge billing={r.billing_doc_no} paid={r.paid_doc_no} /></td>
                                  <td style={{ whiteSpace: "nowrap" }}>
                                    {done ? <span style={{ fontSize: 11, color: "#b91c1c" }}>ยกเลิกแล้ว {r.adj_cancel_no}</span>
                                      : notBilled ? <span style={{ fontSize: 11, color: "#92400e" }} title="ยังไม่วางบิล — แก้ไขที่หน้าบันทึกประกัน COSMOS ได้โดยตรง">ยังไม่วางบิล</span>
                                      : <button onClick={() => pickOld(r)} style={{ padding: "3px 12px", background: "#b91c1c", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>เลือก</button>}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", background: "#fef2f2", borderRadius: 8, padding: "10px 12px" }}>
                  <PlanBadge plan={old.plan} />
                  <div><div style={{ fontSize: 11, color: "#6b7280" }}>เลขกรมธรรม์</div><div style={{ fontFamily: "monospace", fontWeight: 700 }}>{old.app_no}</div></div>
                  <div><div style={{ fontSize: 11, color: "#6b7280" }}>ลูกค้า</div><div style={{ fontWeight: 600 }}>{old.customer_name || "-"}</div></div>
                  <div><div style={{ fontSize: 11, color: "#6b7280" }}>เลขถัง</div><div style={{ fontFamily: "monospace", fontSize: 12 }}>{old.chassis_no || "-"}</div></div>
                  <div style={{ maxWidth: 240 }}><div style={{ fontSize: 11, color: "#6b7280" }}>แผน</div><div style={{ fontSize: 12 }}>{old.plan_name || "-"}</div></div>
                  <div><div style={{ fontSize: 11, color: "#6b7280" }}>เบี้ยเดิม</div><div style={{ fontWeight: 800, fontSize: 16, color: "#b91c1c" }}>{fmt(oldPrem)}</div></div>
                  <div><PayBadge billing={old.billing_doc_no} paid={old.paid_doc_no} /></div>
                  <button onClick={() => setOld(null)} style={{ marginLeft: "auto", padding: "4px 12px", border: "1px solid #d1d5db", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>เปลี่ยน</button>
                </div>
              )}
            </div>

            {/* ขั้นที่ 2 — กรมธรรม์ใหม่ */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12, opacity: old ? 1 : 0.5, pointerEvents: old ? "auto" : "none" }}>
              <div style={{ fontWeight: 700, color: "#15803d", marginBottom: 8 }}>② กรมธรรม์ใหม่ที่ออกให้ลูกค้า</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                <div>
                  <label style={labelSt}>ประเภทประกัน *</label>
                  <select value={newPlan} onChange={e => { setNewPlan(e.target.value); setNewPlanName(""); }} style={inputSt}>
                    <option value="">-- เลือก --</option>
                    {PLAN_OPTS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>เลขกรมธรรม์ใหม่ *</label>
                  <input value={newAppNo} onChange={e => setNewAppNo(e.target.value)} placeholder="เลขกรมธรรม์ / App No." style={{ ...inputSt, fontFamily: "monospace" }} />
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={labelSt}>แผนประกัน (เลือกจากรายการที่เคยบันทึก หรือพิมพ์เอง)</label>
                  <input value={newPlanName} list="cosmos-adj-plan-names" placeholder="ชื่อแผน"
                    onChange={e => {
                      const v = e.target.value; setNewPlanName(v);
                      const hit = planNameChoices.find(o => o.plan_name === v);
                      if (hit && Number(hit.premium) > 0) setNewPremium(String(Number(hit.premium)));
                    }} style={inputSt} />
                  <datalist id="cosmos-adj-plan-names">
                    {planNameChoices.map((o, i) => <option key={i} value={o.plan_name}>{`เบี้ย ${fmt(o.premium)} · เคยบันทึก ${o.cnt} ราย`}</option>)}
                  </datalist>
                </div>
                <div>
                  <label style={labelSt}>ค่าเบี้ยกรมธรรม์ใหม่ (บาท) *</label>
                  <input value={newPremium} onChange={e => setNewPremium(e.target.value)} inputMode="decimal" placeholder="0.00" style={{ ...inputSt, textAlign: "right", fontWeight: 700 }} />
                </div>
                <div>
                  <label style={labelSt}>เริ่มคุ้มครอง</label>
                  <input type="date" value={coverStart} onChange={e => setCoverStart(e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>สิ้นสุดคุ้มครอง</label>
                  <input type="date" value={coverEnd} onChange={e => setCoverEnd(e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>วันที่บันทึก</label>
                  <input type="date" value={adjDate} onChange={e => setAdjDate(e.target.value)} style={inputSt} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelSt}>เหตุผลการปรับปรุง *</label>
                  <input value={reason} onChange={e => setReason(e.target.value)} placeholder="เช่น เลือกแผนประกันผิด / เลือกทุนประกันผิดรุ่น" style={inputSt} />
                </div>
              </div>
            </div>

            {/* สรุป */}
            <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
              <div><div style={{ fontSize: 11, color: "#6b7280" }}>ยกเลิกเบี้ยเดิม</div><div style={{ fontWeight: 700, color: "#b91c1c" }}>-{fmt(oldPrem)}</div></div>
              <div style={{ fontSize: 18, color: "#9ca3af" }}>+</div>
              <div><div style={{ fontSize: 11, color: "#6b7280" }}>เบี้ยกรมธรรม์ใหม่</div><div style={{ fontWeight: 700, color: "#15803d" }}>{hasNewPrem ? fmt(newPrem) : "-"}</div></div>
              <div style={{ fontSize: 18, color: "#9ca3af" }}>=</div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>ส่วนต่าง (เข้ารอบวางบิลถัดไป)</div>
                {diff == null ? <div style={{ fontWeight: 700 }}>-</div> :
                  <div style={{ fontWeight: 800, fontSize: 18, color: TYPE_COLOR[adjType] }}>{TYPE_LABEL[adjType]} {adjType === "same" ? "" : fmt(Math.abs(diff))}</div>}
              </div>
            </div>
            {formErr && <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b", borderRadius: 8, marginBottom: 10, fontSize: 13 }}>{formErr}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setFormOpen(false)} disabled={saving} style={{ padding: "8px 18px", border: "1px solid #d1d5db", background: "#fff", borderRadius: 8, cursor: "pointer" }}>ปิด</button>
              <button onClick={save} disabled={saving || !old}
                style={{ padding: "8px 24px", background: saving || !old ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: saving || !old ? "default" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
