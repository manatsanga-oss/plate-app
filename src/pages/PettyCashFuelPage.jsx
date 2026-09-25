import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/petty-cash-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api"; // สาขา — dropdown สาขาที่สร้างใบ

const COMPANIES = [
  { label: "บริษัท ป.เปา มอเตอร์เซอร์วิส จำกัด", brand: "ฮอนด้า" },
  { label: "หจก สิงห์ชัยสยามยนต์", brand: "ยามาฮ่า" },
];

export default function PettyCashFuelPage({ currentUser }) {
  const [sales, setSales] = useState([]);
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("list"); // list | create
  const [message, setMessage] = useState("");
  const [selCompany, setSelCompany] = useState(COMPANIES[0]);
  // สาขาที่สร้างใบ — default = สาขาของ user ที่ login, เลือกเปลี่ยนได้ (เก็บลง branch_code)
  const [branchSel, setBranchSel] = useState(currentUser?.branch || "");
  const [branchOptions, setBranchOptions] = useState([]);
  // แก้ไขหัวใบ (เลือกสาขา) — เฉพาะ ADMIN
  const isAdmin = currentUser?.username === "admin" || String(currentUser?.role || "").toLowerCase() === "admin";
  const [editBranchDoc, setEditBranchDoc] = useState(null); // ใบที่กำลังแก้สาขา (null = ปิด modal)
  const [editBranchVal, setEditBranchVal] = useState("");
  const [editBranchSaving, setEditBranchSaving] = useState(false);
  // ใบสรุปค่าน้ำมันรถใหม่รายเดือน แยกสาขา (user 2026-09-25) — เลือกเดือน + สาขา แล้วพิมพ์
  const [sumMonth, setSumMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [sumBranch, setSumBranch] = useState("all");
  const [sumPrinting, setSumPrinting] = useState(false);
  useEffect(() => {
    fetch(MASTER_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_branches", include_inactive: "true" }),
    }).then(r => r.json())
      .then(d => setBranchOptions((Array.isArray(d) ? d : []).filter(b => b && b.branch_code)))
      .catch(() => setBranchOptions([]));
  }, []);
  // default: 25 เดือนก่อน ถึง 24 เดือนปัจจุบัน
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const defFrom = `${prevY}-${pad(prevM)}-25`;
  const defTo = `${y}-${pad(m)}-24`;
  const [dateFrom, setDateFrom] = useState(defFrom);
  const [dateTo, setDateTo] = useState(defTo);

  useEffect(() => { fetchDocs(); }, []);

  async function fetchSales(brand, from, to) {
    setLoading(true);
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_sales_for_fuel", branch_code: (currentUser?.branch || "").split(" ")[0] || "00000", min_date: from || dateFrom, max_date: to || dateTo, brand: brand || selCompany.brand }) });
      const data = await res.json();
      setSales(Array.isArray(data) ? data : []);
    } catch { setSales([]); }
    setLoading(false);
  }

  async function fetchDocs() {
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_fuel_docs" }) });
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : []);
    } catch { setDocs([]); }
  }

  function openCreate() {
    setMode("create");
    setSelected(new Set());
    setMessage("");
    fetchSales(selCompany.brand, dateFrom, dateTo);
  }

  async function saveDoc() {
    if (selected.size === 0) { setMessage("กรุณาเลือกรถอย่างน้อย 1 คัน"); return; }
    setSaving(true);
    const items = sales.filter(s => selected.has(s.engine_no)).map(s => ({
      sale_date: s.sale_date, engine_no: s.engine_no, customer_name: s.customer_name, model_series: s.model_series, amount: 40,
    }));
    const now = new Date();
    const docNo = `EXP${String(now.getFullYear() + 543).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    try {
      await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_fuel_doc", doc_no: docNo, branch_code: (branchSel || "").split(" ")[0],
          branch_name: selCompany.label, created_by: currentUser?.name || "",
          position: currentUser?.position || "", period_from: items[0]?.sale_date, period_to: items[items.length - 1]?.sale_date,
          items,
        }) });
      setMode("list");
      fetchDocs();
      setMessage("บันทึกสำเร็จ!");
    } catch { setMessage("บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  // เปิด modal แก้สาขาหัวใบ — preselect จาก branch_code เดิมของใบ
  function openEditBranch(d) {
    const cur = branchOptions.find(b => b.branch_code === d.branch_code);
    setEditBranchVal(cur ? `${cur.branch_code} ${cur.branch_name || ""}`.trim() : "");
    setEditBranchDoc(d);
  }
  async function saveEditBranch() {
    if (!editBranchDoc) return;
    if (!editBranchVal) { setMessage("กรุณาเลือกสาขา"); return; }
    setEditBranchSaving(true);
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_fuel_doc_branch", id: editBranchDoc.id, branch_code: editBranchVal.split(" ")[0] }) });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      // ตอบกลับว่าง = n8n ยังไม่มี action นี้ (workflow ยังไม่ re-import) — อย่ารายงานว่าสำเร็จ
      if (data && (data.success === true || data.id || data?.[0]?.success === true || data?.[0]?.id)) {
        setEditBranchDoc(null);
        setMessage(`บันทึกสาขาของ ${editBranchDoc.doc_no} แล้ว`);
        fetchDocs();
      } else {
        setMessage("❌ บันทึกไม่สำเร็จ — n8n ยังไม่มี action update_fuel_doc_branch (ต้อง re-import Petty_Cash_API)");
      }
    } catch { setMessage("บันทึกสาขาไม่สำเร็จ"); }
    setEditBranchSaving(false);
  }

  function toggleSelect(engineNo) {
    setSelected(prev => { const n = new Set(prev); n.has(engineNo) ? n.delete(engineNo) : n.add(engineNo); return n; });
  }

  const branchLabel = (code) => { const b = branchOptions.find(x => x.branch_code === code); return b ? `${b.branch_code} ${b.branch_name || ""}`.trim() : (code || "ไม่ระบุสาขา"); };
  const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

  // พิมพ์ใบสรุปค่าน้ำมันรถใหม่ประจำเดือน แยกเป็นส่วนตามสาขา (นับตามวันที่เบิก doc_date) — ดึงใบทั้งหมดด้วย limit (workflow ต้อง re-import ถึงจะเกิน 50 ใบ)
  async function printMonthly() {
    if (!sumMonth) return;
    setSumPrinting(true);
    const win = window.open("", "_blank"); // เปิดไว้ก่อน await กัน popup blocker
    let all = docs;
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_fuel_docs", limit: 2000 }) });
      const data = await res.json();
      if (Array.isArray(data) && data.length >= docs.length) all = data;
    } catch { /* ใช้ docs ที่โหลดไว้ */ }
    setSumPrinting(false);
    const [yy, mm] = sumMonth.split("-").map(Number);
    const inMonth = all.filter(d => d && d.doc_date && String(d.doc_date).slice(0, 7) === sumMonth && !/cancel|ยกเลิก/i.test(String(d.status || "")))
      .filter(d => sumBranch === "all" || (d.branch_code || "") === sumBranch);
    if (inMonth.length === 0) { win.close(); setMessage(`ไม่มีใบเบิกค่าน้ำมันรถใหม่เดือน ${THAI_MONTHS[mm - 1]} ${yy + 543}${sumBranch !== "all" ? ` สาขา ${branchLabel(sumBranch)}` : ""}`); return; }
    const thaiDate = d => { if (!d) return "-"; const dt = new Date(d); return isNaN(dt) ? "-" : dt.toLocaleDateString("th-TH"); };
    const money = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
    const esc = v => String(v == null ? "" : v).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    // จัดกลุ่มตามสาขา
    const groups = new Map();
    inMonth.forEach(d => { const k = d.branch_code || ""; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); });
    const keys = [...groups.keys()].sort();
    const monthTitle = `${THAI_MONTHS[mm - 1]} ${yy + 543}`;
    let grandAmt = 0, grandCars = 0, grandDocs = 0;
    const summaryRows = keys.map(k => {
      const ds = groups.get(k).slice().sort((a, b) => String(a.doc_date).localeCompare(String(b.doc_date)) || String(a.doc_no).localeCompare(String(b.doc_no)));
      const cars = ds.reduce((s, d) => s + (Array.isArray(d.items) ? d.items.length : 0), 0);
      const amt = ds.reduce((s, d) => s + Number(d.total_amount || 0), 0);
      grandAmt += amt; grandCars += cars; grandDocs += ds.length;
      return { k, ds, cars, amt };
    });
    // 1 หน้า = 1 สาขา ในรูปแบบใบรับรองแทนใบเสร็จรับเงิน (สรุปทั้งเดือน) — user 2026-09-25
    const lastDay = new Date(yy, mm, 0).getDate();
    const periodText = `${thaiDate(`${sumMonth}-01`)} ถึงวันที่ ${thaiDate(`${sumMonth}-${String(lastDay).padStart(2, "0")}`)}`;
    const pages = summaryRows.map(({ k, ds, cars, amt }, pi) => {
      const rows = ds.flatMap(d => (Array.isArray(d.items) ? d.items : []).map(i => ({ ...i, doc_no: d.doc_no, pending: d.status !== "approved" })))
        .sort((a, b) => String(a.sale_date || "").localeCompare(String(b.sale_date || "")) || String(a.doc_no).localeCompare(String(b.doc_no)));
      // ผู้เบิกจ่าย = คนที่ทำใบเบิกมากที่สุดของสาขานี้ในเดือนนี้ · บจ./หจก. = ชื่อบริษัทในหัวใบ
      const byCount = {}; ds.forEach(d => { const n = d.created_by || ""; byCount[n] = (byCount[n] || 0) + 1; });
      const creator = Object.keys(byCount).sort((a, b) => byCount[b] - byCount[a])[0] || "";
      const position = (ds.find(d => d.created_by === creator && d.position) || {}).position || "";
      const company = (ds.find(d => d.branch_name) || {}).branch_name || "";
      const docNos = [...new Set(ds.map(d => d.doc_no))].join(", ");
      const body = rows.map(r => `<tr><td>${thaiDate(r.sale_date)}</td><td>${esc(r.customer_name || "-")}</td><td>${esc(r.model_series || "-")}</td><td>${esc(r.engine_no || "-")}</td><td class="num">${money(r.amount)}</td></tr>`).join("")
        + Array.from({ length: Math.max(0, 15 - rows.length) }, () => "<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>").join("");
      return `<div class="page${pi < summaryRows.length - 1 ? " brk" : ""}">
<div class="page-num">หน้า ${pi + 1}/${summaryRows.length}</div>
<h2>ใบรับรองแทนใบเสร็จรับเงิน</h2>
<h3>ค่าน้ำมันรถใหม่ — สรุปประจำเดือน ${monthTitle}</h3>
<div class="info"><div>สาขา: <b>${esc(branchLabel(k))}</b></div><div>วันที่: <b>${new Date().toLocaleDateString("th-TH")}</b></div></div>
<div class="info"><div>บจ./หจก.: <b>${esc(company)}</b></div><div>(ผู้ชื่อ/ผู้รับบริการ)</div></div>
<table>
  <thead><tr><th>วันที่ขาย</th><th>ชื่อลูกค้า</th><th>รุ่น</th><th>รายการ</th><th>จำนวนเงิน</th></tr></thead>
  <tbody>${body}<tr class="total"><td colspan="2">รวมทั้งสิ้น (${cars} คัน · ${ds.length} ใบเบิก)</td><td colspan="2"></td><td class="num">${money(amt)}</td></tr></tbody>
</table>
<div class="docs">อ้างอิงใบเบิกเงินสดย่อย: ${esc(docNos)}${ds.some(d => d.status !== "approved") ? ' <span class="pend">(มีใบรออนุมัติ)</span>' : ""}</div>
<p>ข้าพเจ้า <b>${esc(creator || "___________")}</b> (ผู้เบิกจ่าย) ตำแหน่ง <b>${esc(position || "___________")}</b></p>
<p style="font-size:13px">ขอรับรองว่า รายจ่ายข้างต้นนี้ไม่อาจเรียกเก็บใบเสร็จรับเงินจากผู้รับได้ และข้าพเจ้าได้จ่ายไปในงานของทาง</p>
<p>${esc(company || "บริษัท/ห้างหุ้นส่วนจำกัด")} โดยแท้ ตั้งแต่วันที่ <b>${periodText}</b></p>
<div class="footer">
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ${esc(creator || "___________")} (ผู้เบิกจ่าย)</div>
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ___________ (ผู้อนุมัติ)</div>
</div>
</div>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบรับรองแทนใบเสร็จรับเงิน ค่าน้ำมันรถใหม่ ${monthTitle}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'TH Sarabun New', 'Tahoma', sans-serif; font-size: 13px; padding: 10px; color: #111; }
  h2 { text-align: center; margin: 0; font-size: 18px; }
  h3 { text-align: center; margin: 2px 0 10px; font-size: 15px; }
  .info { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #333; padding: 3px 5px; font-size: 11px; white-space: nowrap; }
  th { text-align: center; background: #e5e7eb; }
  td.num { text-align: right; }
  tr.total td { font-weight: 700; }
  .docs { font-size: 10.5px; color: #444; margin: 2px 0 6px; white-space: normal; }
  .pend { color: #b45309; }
  .page-num { text-align: right; font-size: 12px; color: #666; margin-bottom: 8px; }
  .page.brk { page-break-after: always; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; }
  .sig { text-align: center; width: 45%; }
  .sig-line { border-bottom: 1px solid #333; margin: 40px auto 4px; width: 200px; }
  .toolbar { position: fixed; top: 6px; right: 10px; }
  @media print { body { padding: 0; } .toolbar { display: none; } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨️ พิมพ์ (${summaryRows.length} สาขา · ${grandCars} คัน · ${money(grandAmt)} บาท)</button></div>
${pages}
</body></html>`);
    win.document.close();
  }

  function printDoc(doc) {
    const items = Array.isArray(doc.items) ? doc.items : [];
    const thaiDate = d => { if (!d) return "-"; const dt = new Date(d); return dt.toLocaleDateString("th-TH"); };
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบเบิกเงินสดย่อย</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: 'TH Sarabun New', 'Tahoma', sans-serif; font-size: 13px; padding: 15px; }
  h2 { text-align: center; margin: 0; font-size: 18px; }
  h3 { text-align: center; margin: 2px 0 10px; font-size: 15px; }
  .info { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #333; padding: 3px 5px; font-size: 11px; white-space: nowrap; }
  th { text-align: center; }
  td { text-align: left; }
  td:first-child, td:last-child { text-align: center; }
  th { background: #e5e7eb; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; }
  .sig { text-align: center; width: 45%; }
  .sig-line { border-bottom: 1px solid #333; margin: 40px auto 4px; width: 200px; }
  .page-num { text-align: right; font-size: 12px; color: #666; margin-bottom: 8px; }
  @media print { body { padding: 0; } @page { @bottom-center { content: counter(page) " / " counter(pages); } }
</style></head><body>
<div class="page-num">หน้า 1/1</div>
<h2>ใบเบิกเงินสดย่อย</h2>
<h3>ค่าน้ำมันรถใหม่</h3>
<div class="info">
  <div>วันที่เบิก: <b>${thaiDate(doc.doc_date)}</b></div>
  <div>เลขที่ใบเบิก: <b>${doc.doc_no}</b></div>
</div>
<div class="info">
  <div>บจ./หจก.: <b>${doc.branch_name || ""}</b>${doc.branch_code ? ` · สาขา <b>${branchLabel(doc.branch_code)}</b>` : ""}</div>
  <div>ผู้เบิก: <b>${doc.created_by || "-"}</b> · ช่วงวันที่ขาย <b>${thaiDate(doc.period_from)}</b> – <b>${thaiDate(doc.period_to)}</b></div>
</div>
<table>
  <thead><tr><th>วันที่ขาย</th><th>ชื่อลูกค้า</th><th>รุ่น</th><th>รายการ</th><th>จำนวนเงิน</th></tr></thead>
  <tbody>
    ${items.map(i => `<tr><td>${thaiDate(i.sale_date)}</td><td>${i.customer_name || "-"}</td><td>${i.model_series || "-"}</td><td>${i.engine_no}</td><td>${Number(i.amount).toLocaleString()}</td></tr>`).join("")}
    ${Array.from({ length: Math.max(0, 15 - items.length) }, () => "<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>").join("")}
    <tr><td colspan="2"><b>รวมทั้งสิ้น</b></td><td><b>${Number(doc.total_amount || 0).toLocaleString()}</b></td></tr>
  </tbody>
</table>
<p style="font-size:12px;color:#444">ใบเบิกเงินสดย่อยนี้เป็นหลักฐานการเบิกจ่ายค่าน้ำมันรถใหม่ — ใบรับรองแทนใบเสร็จรับเงินจะออกเป็นสรุปรายเดือนแยกสาขา</p>
<div class="footer">
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ${doc.created_by || "___________"} (ผู้เบิก)</div>
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ___________ (ผู้อนุมัติ/ผู้จ่ายเงิน)</div>
</div>
</body></html>`);
    w.document.close();
    w.print();
  }

  async function approveDoc(id) {
    if (!window.confirm("ยืนยันอนุมัติใบเบิกนี้? (อนุมัติแล้วแก้ไขไม่ได้)")) return;
    try {
      await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_fuel_doc", id }) });
      fetchDocs();
    } catch { setMessage("อนุมัติไม่สำเร็จ"); }
  }

  async function deleteDoc(id) {
    if (!window.confirm("ยืนยันลบใบเบิกนี้?")) return;
    try {
      await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_fuel_doc", id }) });
      fetchDocs();
    } catch { setMessage("ลบไม่สำเร็จ"); }
  }

  const fmt = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });

  if (mode === "create") {
    return (
      <div className="page-container">
        <div className="page-topbar">
          <div className="page-title">สร้างใบเบิก - ค่าน้ำมันรถใหม่</div>
          <button className="btn-secondary" onClick={() => setMode("list")}>← กลับ</button>
        </div>
        {message && <div style={{ padding: "8px 14px", background: "#fef3c7", borderRadius: 8, marginBottom: 10, color: "#92400e" }}>{message}</div>}
        <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={selCompany.label} onChange={e => { const c = COMPANIES.find(x => x.label === e.target.value); setSelCompany(c); setSelected(new Set()); fetchSales(c.brand, dateFrom, dateTo); }}
            style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #072d6b", borderRadius: 8, fontWeight: 600, color: "#072d6b" }}>
            {COMPANIES.map(c => <option key={c.label} value={c.label}>{c.label} ({c.brand})</option>)}
          </select>
          <select value={branchSel} onChange={e => setBranchSel(e.target.value)} title="สาขาที่สร้างใบ"
            style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #0369a1", borderRadius: 8, fontWeight: 600, color: "#0369a1" }}>
            <option value="">-- สาขาที่สร้างใบ --</option>
            {branchSel && !branchOptions.some(b => `${b.branch_code} ${b.branch_name || ""}`.trim() === branchSel) && <option value={branchSel}>{branchSel}</option>}
            {branchOptions.map(b => { const v = `${b.branch_code} ${b.branch_name || ""}`.trim(); return <option key={v} value={v}>{v}</option>; })}
          </select>
          <span style={{ fontSize: 12, color: "#6b7280" }}>ขายตั้งแต่</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }} />
          <span style={{ fontSize: 12, color: "#6b7280" }}>ถึง</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }} />
          <button onClick={() => { setSelected(new Set()); fetchSales(selCompany.brand, dateFrom, dateTo); }}
            style={{ padding: "6px 14px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>ค้นหา</button>
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            เลือก {selected.size} คัน | รวม {fmt(selected.size * 40)} บาท
          </span>
        </div>
        {loading ? <div style={{ padding: 40, textAlign: "center" }}>กำลังโหลด...</div> : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead><tr>
                <th style={{ width: 30 }}><input type="checkbox" checked={sales.length > 0 && sales.every(s => selected.has(s.engine_no))}
                  onChange={e => { const n = new Set(); if (e.target.checked) sales.forEach(s => n.add(s.engine_no)); setSelected(n); }} /></th>
                <th>วันที่ขาย</th><th>หมายเลขเครื่อง</th><th>ชื่อลูกค้า</th><th>รุ่น</th><th>จำนวน</th>
              </tr></thead>
              <tbody>
                {sales.length === 0 ? <tr><td colSpan={6} style={{ textAlign: "center", padding: 20 }}>ไม่มีรถที่ยังไม่ได้เบิก</td></tr> :
                  sales.map(s => (
                    <tr key={s.engine_no} style={{ background: selected.has(s.engine_no) ? "#fef3c7" : undefined }}>
                      <td><input type="checkbox" checked={selected.has(s.engine_no)} onChange={() => toggleSelect(s.engine_no)} /></td>
                      <td>{s.sale_date ? new Date(s.sale_date).toLocaleDateString("th-TH") : "-"}</td>
                      <td style={{ fontFamily: "monospace" }}>{s.engine_no}</td>
                      <td>{s.customer_name || "-"}</td>
                      <td>{s.model_series}</td>
                      <td style={{ textAlign: "right" }}>40</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={saveDoc} disabled={saving || selected.size === 0}
            style={{ padding: "10px 24px", fontSize: 14, background: saving ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
            {saving ? "กำลังบันทึก..." : `บันทึกใบเบิก (${selected.size} คัน / ${fmt(selected.size * 40)} บาท)`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">ค่าน้ำมันรถใหม่</div>
        <button className="btn-primary" onClick={openCreate}>+ สร้างใบเบิก</button>
      </div>
      {message && <div style={{ padding: "8px 14px", background: "#d1fae5", borderRadius: 8, marginBottom: 10, color: "#065f46" }}>{message}</div>}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10 }}>
        <span style={{ fontWeight: 700, color: "#072d6b", fontSize: 13 }}>📅 ใบรับรองแทนใบเสร็จรับเงิน สรุปรายเดือน (1 ใบต่อสาขา)</span>
        <input type="month" value={sumMonth} onChange={e => setSumMonth(e.target.value)} style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }} />
        <select value={sumBranch} onChange={e => setSumBranch(e.target.value)} style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }}>
          <option value="all">ทุกสาขา (แยกเป็นส่วน)</option>
          {branchOptions.map(b => <option key={b.branch_code} value={b.branch_code}>{`${b.branch_code} ${b.branch_name || ""}`.trim()}</option>)}
        </select>
        <button onClick={printMonthly} disabled={sumPrinting || !sumMonth} style={{ padding: "6px 16px", fontSize: 13, background: sumPrinting ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: sumPrinting ? "default" : "pointer", fontWeight: 700 }}>
          {sumPrinting ? "กำลังดึงข้อมูล…" : "🖨️ พิมพ์ใบแทนใบเสร็จรับเงิน สรุปรายเดือน"}
        </button>
        <span style={{ fontSize: 11, color: "#6b7280" }}>นับตามวันที่เบิก · รวมใบรออนุมัติ (มีหมายเหตุ) · ปุ่ม 🖨️ รายใบ = ใบเบิกเงินสดย่อย (หลักฐานการเบิก)</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ fontSize: 13 }}>
          <thead><tr>
            <th>#</th><th>เลขที่ใบจ่าย</th><th>วันที่</th><th>สาขา</th><th>ผู้เบิก</th><th>ช่วงวันที่</th><th>จำนวนคัน</th><th>ยอดรวม</th><th>สถานะ</th><th>จัดการ</th>
          </tr></thead>
          <tbody>
            {docs.length === 0 ? <tr><td colSpan={10} style={{ textAlign: "center", padding: 20 }}>ยังไม่มีใบเบิก</td></tr> :
              docs.map((d, i) => {
                const items = Array.isArray(d.items) ? d.items : [];
                return (
                  <tr key={d.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{d.doc_no}</td>
                    <td>{d.doc_date ? new Date(d.doc_date).toLocaleDateString("th-TH") : "-"}</td>
                    <td>
                      {d.branch_name}
                      {d.branch_code && String(d.branch_code).startsWith("SCY") && (
                        <div style={{ fontSize: 11, color: "#0369a1", fontWeight: 700 }}>
                          🏢 {(() => { const b = branchOptions.find(x => x.branch_code === d.branch_code); return b ? `${b.branch_code} ${b.branch_name || ""}`.trim() : d.branch_code; })()}
                        </div>
                      )}
                    </td>
                    <td>{d.created_by}</td>
                    <td>{d.period_from ? new Date(d.period_from).toLocaleDateString("th-TH") : ""} - {d.period_to ? new Date(d.period_to).toLocaleDateString("th-TH") : ""}</td>
                    <td style={{ textAlign: "center" }}>{items.length}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(d.total_amount)}</td>
                    <td>
                      <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11,
                        background: d.status === "approved" ? "#d1fae5" : "#fef3c7",
                        color: d.status === "approved" ? "#065f46" : "#92400e" }}>
                        {d.status === "approved" ? "อนุมัติแล้ว" : "รออนุมัติ"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button onClick={() => printDoc(d)} style={{ padding: "3px 10px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, marginRight: 4 }}>🖨️</button>
                      {isAdmin && (
                        <button onClick={() => openEditBranch(d)} title="แก้ไขสาขาของหัวใบ (เฉพาะ ADMIN)"
                          style={{ padding: "3px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, marginRight: 4 }}>✏️ แก้ไข</button>
                      )}
                      {d.status !== "approved" && (
                        <>
                          <button onClick={() => deleteDoc(d.id)} style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, marginRight: 4 }}>ลบ</button>
                          <button onClick={() => approveDoc(d.id)} style={{ padding: "3px 10px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>อนุมัติ</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Modal แก้ไขหัวใบ — เลือกสาขา (เฉพาะ ADMIN) */}
      {editBranchDoc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !editBranchSaving && setEditBranchDoc(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 420, maxWidth: "95vw" }}>
            <h3 style={{ margin: "0 0 4px", color: "#072d6b" }}>✏️ แก้ไขสาขาของใบเบิก</h3>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>
              {editBranchDoc.doc_no} · {editBranchDoc.branch_name} · ผู้เบิก {editBranchDoc.created_by || "-"}
            </div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#374151" }}>สาขา *</label>
            <select value={editBranchVal} onChange={e => setEditBranchVal(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}>
              <option value="">-- เลือกสาขา --</option>
              {branchOptions.map(b => { const v = `${b.branch_code} ${b.branch_name || ""}`.trim(); return <option key={v} value={v}>{v}</option>; })}
            </select>
            <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>
              * แก้เฉพาะสาขาที่หัวใบ (ใช้แยกสาขาในงบกำไรขาดทุน) — ชื่อบริษัท/รายการรถไม่เปลี่ยน
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setEditBranchDoc(null)} disabled={editBranchSaving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={saveEditBranch} disabled={editBranchSaving || !editBranchVal}
                style={{ padding: "8px 20px", background: (editBranchSaving || !editBranchVal) ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: (editBranchSaving || !editBranchVal) ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {editBranchSaving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
