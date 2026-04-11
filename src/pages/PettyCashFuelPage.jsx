import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/petty-cash-api";

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
          action: "save_fuel_doc", doc_no: docNo, branch_code: currentUser?.branch_code || "",
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

  function toggleSelect(engineNo) {
    setSelected(prev => { const n = new Set(prev); n.has(engineNo) ? n.delete(engineNo) : n.add(engineNo); return n; });
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
<h2>ใบรับรองแทนใบเสร็จรับเงิน</h2>
<h3>ค่าน้ำมันรถใหม่</h3>
<div class="info">
  <div>วันที่เบิก: <b>${thaiDate(doc.doc_date)}</b></div>
  <div>เลขที่ใบจ่าย: <b>${doc.doc_no}</b></div>
</div>
<div class="info">
  <div>บจ./หจก.: <b>${doc.branch_name || ""}</b></div>
  <div>(ผู้ชื่อ/ผู้รับบริการ)</div>
</div>
<table>
  <thead><tr><th>วันที่ขาย</th><th>ชื่อลูกค้า</th><th>รุ่น</th><th>รายการ</th><th>จำนวนเงิน</th></tr></thead>
  <tbody>
    ${items.map(i => `<tr><td>${thaiDate(i.sale_date)}</td><td>${i.customer_name || "-"}</td><td>${i.model_series || "-"}</td><td>${i.engine_no}</td><td>${Number(i.amount).toLocaleString()}</td></tr>`).join("")}
    ${Array.from({ length: Math.max(0, 15 - items.length) }, () => "<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>").join("")}
    <tr><td colspan="2"><b>รวมทั้งสิ้น</b></td><td><b>${Number(doc.total_amount || 0).toLocaleString()}</b></td></tr>
  </tbody>
</table>
<p>ข้าพเจ้า <b>${doc.created_by || "___________"}</b> (ผู้เบิกจ่าย) ตำแหน่ง <b>${doc.position || "___________"}</b></p>
<p style="font-size:13px">ขอรับรองว่า รายจ่ายข้างต้นนี้ไม่อาจเรียกเก็บใบเสร็จรับเงินจากผู้รับได้ และข้าพเจ้าได้จ่ายไปในงานของทาง</p>
<p>${doc.branch_name || "บริษัท/ห้างหุ้นส่วนจำกัด"} โดยแท้ ตั้งแต่วันที่ <b>${thaiDate(doc.period_from)}</b> ถึงวันที่ <b>${thaiDate(doc.period_to)}</b></p>
<div class="footer">
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ${doc.created_by || "___________"} (ผู้เบิกจ่าย)</div>
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ___________ (ผู้อนุมัติ)</div>
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
                    <td>{d.branch_name}</td>
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
    </div>
  );
}
