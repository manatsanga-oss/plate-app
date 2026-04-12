import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/petty-cash-api";
const OCR_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/ocr-pdf-spare-parts";
const COMPANIES = [
  { label: "บริษัท ป.เปา มอเตอร์เซอร์วิส จำกัด", match: "ป.เปา" },
  { label: "หจก สิงห์ชัยสยามยนต์", match: "สิงห์ชัย" },
];

function isTaxInvoice(item) {
  return !!(item.tax_invoice_no && item.buyer_name &&
    (item.buyer_name.includes("ป.เปา") || item.buyer_name.includes("สิงห์ชัย")));
}

export default function PettyCashGeneralPage({ currentUser }) {
  const [docs, setDocs] = useState([]);
  const [mode, setMode] = useState("list");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [items, setItems] = useState([]);
  const [company, setCompany] = useState(COMPANIES[0].label);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState(new Set());

  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const m = now.getMonth() + 1;
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? now.getFullYear() - 1 : now.getFullYear();

  useEffect(() => { fetchDocs(); }, []);

  async function fetchDocs() {
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_general_docs" }) });
      setDocs(Array.isArray(await res.json().then(d => d)) ? (await Promise.resolve(docs)) : []);
    } catch { /* retry */ }
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_general_docs" }) });
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : []);
    } catch { setDocs([]); }
  }

  function emptyItem() {
    return { expense_date: "", vendor_name: "", description: "", amount: 0, vat_amount: 0, tax_invoice_no: "", buyer_name: "", is_tax_invoice: false };
  }

  function openCreate() {
    setMode("create"); setEditDoc(null); setItems([emptyItem()]);
    setCompany(COMPANIES[0].label);
    setPeriodFrom(`${prevY}-${pad(prevM)}-25`);
    setPeriodTo(`${now.getFullYear()}-${pad(m)}-24`);
    setMessage("");
  }

  function openEdit(doc) {
    setMode("create"); setEditDoc(doc);
    setCompany(doc.company_name || COMPANIES[0].label);
    setPeriodFrom(doc.period_from ? doc.period_from.slice(0, 10) : "");
    setPeriodTo(doc.period_to ? doc.period_to.slice(0, 10) : "");
    const its = Array.isArray(doc.items) ? doc.items.map(i => ({ ...i, expense_date: i.expense_date ? i.expense_date.slice(0, 10) : "" })) : [emptyItem()];
    setItems(its); setMessage("");
  }

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      updated.is_tax_invoice = isTaxInvoice(updated);
      return updated;
    }));
  }

  async function handleOCR(e) {
    const file = e.target.files[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(OCR_URL, { method: "POST", body: formData });
      const data = await res.json();
      const ocrItems = Array.isArray(data) ? data : [];
      if (ocrItems.length > 0) {
        const newItems = ocrItems.map(p => {
          const it = {
            expense_date: p.expense_date || p.post_date || "",
            vendor_name: p.vendor_name || p.recipient_name || "",
            description: p.description || "",
            amount: Number(p.amount) || 0,
            vat_amount: Number(p.vat_amount) || 0,
            tax_invoice_no: p.tax_invoice_no || "",
            buyer_name: p.buyer_name || "",
            is_tax_invoice: false,
          };
          it.is_tax_invoice = isTaxInvoice(it);
          return it;
        });
        setItems(prev => [...prev.filter(it => it.amount > 0 || it.vendor_name), ...newItems]);
        setMessage(`OCR สำเร็จ! อ่านได้ ${newItems.length} รายการ`);
      } else {
        setMessage("OCR ไม่สามารถอ่านข้อมูลได้ กรุณากรอกด้วยมือ");
      }
    } catch { setMessage("OCR ไม่สำเร็จ กรุณากรอกด้วยมือ"); }
    setOcrLoading(false);
    e.target.value = "";
  }

  async function saveDoc() {
    const validItems = items.filter(it => it.amount > 0);
    if (validItems.length === 0) { setMessage("กรุณาเพิ่มรายการ"); return; }
    setSaving(true);
    try {
      let docId = editDoc?.id;
      if (!docId) {
        const docNo = `GEN${String(now.getFullYear() + 543).slice(-2)}${pad(m)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
        const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save_general_doc", doc_no: docNo, doc_date: now.toISOString().split("T")[0],
            branch_code: (currentUser?.branch || "").split(" ")[0], branch_name: currentUser?.branch || "",
            company_name: company, created_by: currentUser?.name || "", position: currentUser?.position || "",
            period_from: periodFrom, period_to: periodTo }) });
        const data = await res.json();
        docId = data?.id;
      }
      if (docId) {
        await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save_general_items", doc_id: docId, items: validItems }) });
      }
      setMode("list"); fetchDocs(); setMessage("บันทึกสำเร็จ!");
    } catch { setMessage("บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function approveDoc(id) { if (!window.confirm("ยืนยันอนุมัติ?")) return; try { await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve_general_doc", id }) }); fetchDocs(); } catch {} }
  async function deleteDoc(id) { if (!window.confirm("ยืนยันลบ?")) return; try { await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_general_doc", id }) }); fetchDocs(); } catch {} }

  function printSummary(type) {
    const selDocs = docs.filter(d => selectedDocs.has(d.id));
    const allItems = selDocs.flatMap(d => Array.isArray(d.items) ? d.items : []);
    const filtered = type === "tax" ? allItems.filter(i => i.is_tax_invoice) : allItems.filter(i => !i.is_tax_invoice);
    if (filtered.length === 0) { setMessage(type === "tax" ? "ไม่มีรายการใบกำกับภาษี" : "ไม่มีรายการใบแทนใบเสร็จ"); return; }
    const total = filtered.reduce((s, i) => s + Number(i.amount || 0), 0);
    const thaiDate = d => d ? new Date(d).toLocaleDateString("th-TH") : "-";
    const companyName = selDocs[0]?.company_name || "";
    const createdBy = selDocs[0]?.created_by || "";
    const position = selDocs[0]?.position || "";
    const title = type === "tax" ? "ใบสรุปค่าใช้จ่ายเงินสดย่อย (ใบกำกับภาษี)" : "ใบรับรองแทนใบเสร็จรับเงิน";
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'TH Sarabun New','Tahoma',sans-serif; font-size: 13px; padding: 15px; }
  h2 { text-align: center; margin: 0; font-size: 18px; }
  .info { display: flex; justify-content: space-between; margin: 8px 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #333; padding: 3px 5px; font-size: 11px; }
  th { text-align: center; background: #e5e7eb; }
  td { text-align: left; }
  .footer { margin-top: 30px; display: flex; justify-content: space-between; }
  .sig { text-align: center; width: 45%; }
  .sig-line { border-bottom: 1px solid #333; margin: 30px auto 4px; width: 180px; }
  @media print { body { padding: 0; } }
</style></head><body>
<h2>${title}</h2>
<div class="info"><div>บจ./หจก.: <b>${companyName}</b></div><div>(ผู้ชื่อ/ผู้รับบริการ)</div></div>
<table>
  <thead><tr><th>วัน เดือน ปี</th><th>ร้านค้า/ผู้ขาย</th><th>รายละเอียด</th>${type === "tax" ? "<th>เลขที่ใบกำกับ</th>" : ""}<th>จำนวนเงิน</th><th>ใบสำคัญจ่าย</th></tr></thead>
  <tbody>
    ${filtered.map(i => `<tr><td>${thaiDate(i.expense_date)}</td><td>${i.vendor_name || "-"}</td><td>${i.description || "-"}</td>${type === "tax" ? `<td>${i.tax_invoice_no || "-"}</td>` : ""}<td style="text-align:right">${Number(i.amount).toLocaleString()}</td><td>/</td></tr>`).join("")}
    ${Array.from({ length: Math.max(0, 12 - filtered.length) }, () => `<tr><td>&nbsp;</td><td></td><td></td>${type === "tax" ? "<td></td>" : ""}<td></td><td></td></tr>`).join("")}
    <tr><td colspan="${type === "tax" ? 4 : 3}" style="text-align:center"><b>รวมทั้งสิ้น</b></td><td style="text-align:right"><b>${total.toLocaleString()}</b></td><td></td></tr>
  </tbody>
</table>
<p>ข้าพเจ้า <b>${createdBy}</b> (ผู้เบิกจ่าย) ตำแหน่ง <b>${position}</b></p>
<p style="font-size:11px">ขอรับรองว่า รายจ่ายข้างต้นนี้ไม่อาจเรียกเก็บใบเสร็จรับเงินจากผู้รับได้ และข้าพเจ้าได้จ่ายไปในงานของทาง</p>
<p>${companyName} โดยแท้</p>
<div class="footer">
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ${createdBy} (ผู้เบิกจ่าย)</div>
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ___________ (ผู้อนุมัติ)</div>
</div>
</body></html>`);
    w.document.close();
    w.print();
  }

  const fmt = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
  const totalItems = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalTax = items.filter(i => i.is_tax_invoice).reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalReceipt = items.filter(i => !i.is_tax_invoice && Number(i.amount) > 0).reduce((s, i) => s + Number(i.amount || 0), 0);
  const selectedTotal = docs.filter(d => selectedDocs.has(d.id)).reduce((s, d) => s + Number(d.total_amount || 0), 0);

  if (mode === "create") {
    return (
      <div className="page-container">
        <div className="page-topbar">
          <div className="page-title">{editDoc?.viewOnly ? "ดู" : editDoc ? "แก้ไข" : "สร้าง"} - ค่าใช้จ่ายทั่วไป</div>
          <button className="btn-secondary" onClick={() => setMode("list")}>← กลับ</button>
        </div>
        {message && <div style={{ padding: "8px 14px", background: "#fef3c7", borderRadius: 8, marginBottom: 10, color: "#92400e" }}>{message}</div>}

        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select value={company} onChange={e => setCompany(e.target.value)} disabled={editDoc?.viewOnly}
            style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #072d6b", borderRadius: 8, fontWeight: 600, color: "#072d6b" }}>
            {COMPANIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "#6b7280" }}>ตั้งแต่</span>
          <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} disabled={editDoc?.viewOnly} style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }} />
          <span style={{ fontSize: 12, color: "#6b7280" }}>ถึง</span>
          <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} disabled={editDoc?.viewOnly} style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }} />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            รวม {fmt(totalItems)} | <span style={{ color: "#10b981" }}>ใบกำกับภาษี {fmt(totalTax)}</span> | <span style={{ color: "#f59e0b" }}>ใบแทนใบเสร็จ {fmt(totalReceipt)}</span>
          </span>
          {!editDoc?.viewOnly && (
            <>
              <label style={{ padding: "6px 14px", fontSize: 13, background: "#f59e0b", color: "#fff", borderRadius: 8, cursor: "pointer" }}>
                📷 {ocrLoading ? "กำลังอ่าน..." : "สแกน OCR"}
                <input type="file" accept="image/*,application/pdf" capture="environment" onChange={handleOCR} style={{ display: "none" }} disabled={ocrLoading} />
              </label>
              <button onClick={() => setItems(prev => [...prev, emptyItem()])}
                style={{ padding: "6px 14px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>+ เพิ่มรายการ</button>
            </>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ fontSize: 11 }}>
            <thead><tr>
              <th>#</th><th>วันที่</th><th>ร้านค้า/ผู้ขาย</th><th>รายละเอียด</th><th>จำนวนเงิน</th><th>VAT</th><th>เลขที่ใบกำกับ</th><th>ชื่อผู้ซื้อ</th><th>ประเภท</th>{!editDoc?.viewOnly && <th></th>}
            </tr></thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} style={{ background: it.is_tax_invoice ? "#f0fdf4" : undefined }}>
                  <td>{idx + 1}</td>
                  <td><input type="date" value={it.expense_date} onChange={e => updateItem(idx, "expense_date", e.target.value)} disabled={editDoc?.viewOnly} style={{ width: 110, fontSize: 11, padding: 2 }} /></td>
                  <td><input value={it.vendor_name} onChange={e => updateItem(idx, "vendor_name", e.target.value)} disabled={editDoc?.viewOnly} placeholder="ร้านค้า" style={{ width: 120, fontSize: 11, padding: 2 }} /></td>
                  <td><input value={it.description} onChange={e => updateItem(idx, "description", e.target.value)} disabled={editDoc?.viewOnly} placeholder="รายละเอียด" style={{ width: 130, fontSize: 11, padding: 2 }} /></td>
                  <td><input type="number" value={it.amount} onChange={e => updateItem(idx, "amount", e.target.value)} disabled={editDoc?.viewOnly} style={{ width: 70, fontSize: 11, padding: 2, textAlign: "right" }} /></td>
                  <td><input type="number" value={it.vat_amount} onChange={e => updateItem(idx, "vat_amount", e.target.value)} disabled={editDoc?.viewOnly} style={{ width: 55, fontSize: 11, padding: 2, textAlign: "right" }} /></td>
                  <td><input value={it.tax_invoice_no} onChange={e => updateItem(idx, "tax_invoice_no", e.target.value)} disabled={editDoc?.viewOnly} placeholder="เลขที่" style={{ width: 90, fontSize: 11, padding: 2 }} /></td>
                  <td><input value={it.buyer_name} onChange={e => updateItem(idx, "buyer_name", e.target.value)} disabled={editDoc?.viewOnly} placeholder="ชื่อผู้ซื้อ" style={{ width: 100, fontSize: 11, padding: 2 }} /></td>
                  <td>
                    <span style={{ padding: "1px 6px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                      background: it.is_tax_invoice ? "#d1fae5" : "#fef3c7",
                      color: it.is_tax_invoice ? "#065f46" : "#92400e" }}>
                      {it.is_tax_invoice ? "ใบกำกับภาษี" : "ใบแทน"}
                    </span>
                  </td>
                  {!editDoc?.viewOnly && <td><button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>×</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!editDoc?.viewOnly ? (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={saveDoc} disabled={saving}
              style={{ padding: "10px 24px", fontSize: 14, background: saving ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        ) : currentUser?.role === "admin" && (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={async () => { if (!window.confirm("ยืนยันยกเลิกอนุมัติ?")) return; try { await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unapprove_general_doc", id: editDoc.id }) }); setMode("list"); fetchDocs(); } catch {} }}
              style={{ padding: "10px 24px", fontSize: 14, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
              ยกเลิกอนุมัติ
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">ค่าใช้จ่ายทั่วไป</div>
        <button className="btn-primary" onClick={openCreate}>+ สร้างใบสรุป</button>
      </div>
      {message && <div style={{ padding: "8px 14px", background: "#d1fae5", borderRadius: 8, marginBottom: 10, color: "#065f46" }}>{message}</div>}

      {selectedDocs.size > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#072d6b" }}>เลือก {selectedDocs.size} ใบ | รวม {fmt(selectedTotal)} บาท</span>
          <button onClick={() => printSummary("tax")} style={{ padding: "6px 16px", fontSize: 13, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>🖨️ พิมพ์ใบกำกับภาษี</button>
          <button onClick={() => printSummary("receipt")} style={{ padding: "6px 16px", fontSize: 13, background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>🖨️ พิมพ์ใบแทนใบเสร็จ</button>
          <button onClick={async () => { const ids = [...selectedDocs]; if (!window.confirm(`อนุมัติ ${ids.length} ใบ?`)) return; for (const id of ids) { try { await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve_general_doc", id }) }); } catch {} } setSelectedDocs(new Set()); fetchDocs(); }}
            style={{ padding: "6px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>✅ อนุมัติ</button>
          <button onClick={() => setSelectedDocs(new Set())} style={{ padding: "6px 16px", fontSize: 13, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>ล้าง</button>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ fontSize: 13 }}>
          <thead><tr>
            <th style={{ width: 30 }}><input type="checkbox" checked={docs.filter(d => d.status !== "approved").length > 0 && docs.filter(d => d.status !== "approved").every(d => selectedDocs.has(d.id))}
              onChange={e => { const n = new Set(); if (e.target.checked) docs.filter(d => d.status !== "approved").forEach(d => n.add(d.id)); setSelectedDocs(n); }} /></th>
            <th>#</th><th>เลขที่</th><th>วันที่</th><th>บริษัท</th><th>ผู้เบิก</th><th>ใบกำกับภาษี</th><th>ใบแทนใบเสร็จ</th><th>ยอดรวม</th><th>สถานะ</th><th>จัดการ</th>
          </tr></thead>
          <tbody>
            {docs.length === 0 ? <tr><td colSpan={11} style={{ textAlign: "center", padding: 20 }}>ยังไม่มีใบสรุป</td></tr> :
              docs.map((d, i) => (
                <tr key={d.id} style={{ background: selectedDocs.has(d.id) ? "#fef3c7" : undefined }}>
                  <td>{d.status !== "approved" ? <input type="checkbox" checked={selectedDocs.has(d.id)}
                    onChange={() => setSelectedDocs(prev => { const n = new Set(prev); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; })} /> :
                    <button onClick={() => openEdit({ ...d, viewOnly: true })} style={{ padding: "2px 8px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10 }}>ดู</button>
                  }</td>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{d.doc_no}</td>
                  <td>{d.doc_date ? new Date(d.doc_date).toLocaleDateString("th-TH") : "-"}</td>
                  <td>{d.company_name}</td>
                  <td>{d.created_by}</td>
                  <td style={{ textAlign: "right", color: "#10b981", fontWeight: 600 }}>{fmt(d.total_tax_invoice)}</td>
                  <td style={{ textAlign: "right", color: "#f59e0b", fontWeight: 600 }}>{fmt(d.total_receipt)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(d.total_amount)}</td>
                  <td><span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11, background: d.status === "approved" ? "#d1fae5" : "#fef3c7", color: d.status === "approved" ? "#065f46" : "#92400e" }}>{d.status === "approved" ? "อนุมัติแล้ว" : "รออนุมัติ"}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {d.status !== "approved" && (
                      <>
                        <button onClick={() => openEdit(d)} style={{ padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, marginRight: 4 }}>แก้ไข</button>
                        <button onClick={() => deleteDoc(d.id)} style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>ลบ</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
