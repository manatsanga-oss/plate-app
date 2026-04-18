import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/petty-cash-api";
const COMPANIES = [
  { label: "บริษัท ป.เปา มอเตอร์เซอร์วิส จำกัด" },
  { label: "หจก สิงห์ชัยสยามยนต์" },
];

export default function PettyCashPostagePage({ currentUser }) {
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
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkIdx, setLinkIdx] = useState(null);
  const [availableReceipts, setAvailableReceipts] = useState([]);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState("");

  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const m = now.getMonth() + 1;
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? now.getFullYear() - 1 : now.getFullYear();

  useEffect(() => { fetchDocs(); }, []);

  async function fetchDocs() {
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_postage_docs" }) });
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : []);
    } catch { setDocs([]); }
  }

  function openCreate() {
    setMode("create");
    setEditDoc(null);
    setItems([emptyItem()]);
    setCompany(COMPANIES[0].label);
    setPeriodFrom(`${prevY}-${pad(prevM)}-25`);
    setPeriodTo(`${now.getFullYear()}-${pad(m)}-24`);
    setMessage("");
  }

  function openEdit(doc) {
    setMode("create");
    setEditDoc(doc);
    setCompany(doc.company_name || COMPANIES[0].label);
    setPeriodFrom(doc.period_from ? doc.period_from.slice(0, 10) : "");
    setPeriodTo(doc.period_to ? doc.period_to.slice(0, 10) : "");
    const its = Array.isArray(doc.items) ? doc.items.map(i => ({
      post_date: i.post_date ? i.post_date.slice(0, 10) : "",
      description: i.description || "",
      recipient_name: i.recipient_name || "",
      tracking_no: i.tracking_no || "",
      destination: i.destination || "",
      amount: i.amount || 0,
      receipt_no: i.receipt_no || "",
      receipt_customer: i.receipt_customer || "",
      note: i.note || "",
    })) : [emptyItem()];
    setItems(its);
    setMessage("");
  }

  function emptyItem() {
    return { post_date: "", description: "", recipient_name: "", tracking_no: "", destination: "", amount: 0,
             receipt_no: "", receipt_customer: "", note: "" };
  }

  async function openLinkPopup(idx) {
    setLinkIdx(idx);
    setLinkOpen(true);
    setReceiptSearch("");
    setReceiptLoading(true);
    try {
      const branchCode = (currentUser?.branch || "").split(" ")[0];
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_available_postage_receipts", branch_code: branchCode }) });
      const data = await res.json();
      setAvailableReceipts(Array.isArray(data) ? data : []);
    } catch { setAvailableReceipts([]); }
    setReceiptLoading(false);
  }

  function selectReceipt(r) {
    // ใช้ไม่ได้ถ้ามีในรายการ items อื่นแล้ว
    const usedInThisDoc = items.some((it, i) => i !== linkIdx && it.receipt_no === r.receipt_no);
    if (usedInThisDoc) { alert("ใบรับเงินนี้ถูกเลือกในรายการอื่นของเอกสารนี้แล้ว"); return; }
    setItems(prev => prev.map((it, i) => i === linkIdx ? {
      ...it,
      receipt_no: r.receipt_no,
      receipt_customer: r.customer_name || "",
      recipient_name: it.recipient_name || r.customer_name || "",
    } : it));
    setLinkOpen(false);
  }

  function clearReceipt(idx) {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it, receipt_no: "", receipt_customer: ""
    } : it));
  }

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  async function handleOCR(e) {
    const file = e.target.files[0];
    if (!file) return;
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("https://n8n-new-project-gwf2.onrender.com/webhook/ocr-pdf-spare-parts", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      const ocrItems = Array.isArray(data) ? data : [];
      if (ocrItems.length > 0 && ocrItems[0].type === "postage") {
        const newItems = ocrItems.map(p => ({
          post_date: p.post_date || "", description: `${p.service_type || "EMS"} ${p.tracking_no || ""}`,
          recipient_name: p.recipient_name || "", tracking_no: p.tracking_no || "",
          destination: p.destination || "", amount: Number(p.amount) || 0,
        }));
        setItems(prev => [...prev.filter(it => it.amount > 0 || it.recipient_name), ...newItems]);
        setMessage(`OCR สำเร็จ! อ่านได้ ${newItems.length} รายการ`);
      } else {
        setMessage("OCR ไม่สามารถอ่านข้อมูลไปรษณีย์ได้ กรุณากรอกด้วยมือ");
      }
    } catch {
      setMessage("OCR ไม่สำเร็จ กรุณากรอกด้วยมือ");
    }
    setOcrLoading(false);
    e.target.value = "";
  }

  async function saveDoc() {
    const validItems = items.filter(it => it.amount > 0);
    if (validItems.length === 0) { setMessage("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ"); return; }
    setSaving(true);
    try {
      let docId = editDoc?.id;
      if (!docId) {
        const docNo = `POST${String(now.getFullYear() + 543).slice(-2)}${pad(m)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
        const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save_postage_doc", doc_no: docNo, doc_date: now.toISOString().split("T")[0],
            branch_code: (currentUser?.branch || "").split(" ")[0], branch_name: currentUser?.branch || "",
            company_name: company, created_by: currentUser?.name || "", position: currentUser?.position || "",
            period_from: periodFrom, period_to: periodTo }) });
        const data = await res.json();
        docId = data?.id;
      }
      if (docId) {
        await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save_postage_items", doc_id: docId, items: validItems }) });
      }
      setMode("list");
      fetchDocs();
      setMessage("บันทึกสำเร็จ!");
    } catch { setMessage("บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function approveDoc(id) {
    if (!window.confirm("ยืนยันอนุมัติ? (อนุมัติแล้วแก้ไขไม่ได้)")) return;
    try {
      await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_postage_doc", id }) });
      fetchDocs();
    } catch {}
  }

  async function deleteDoc(id) {
    if (!window.confirm("ยืนยันลบ?")) return;
    try {
      await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_postage_doc", id }) });
      fetchDocs();
    } catch {}
  }

  function printDoc(doc) {
    const its = Array.isArray(doc.items) ? doc.items : [];
    const thaiDate = d => d ? new Date(d).toLocaleDateString("th-TH") : "-";
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบสรุปค่าใช้จ่าย</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'TH Sarabun New','Tahoma',sans-serif; font-size: 13px; padding: 15px; }
  h2 { text-align: center; margin: 0; font-size: 18px; }
  .info { display: flex; justify-content: space-between; margin: 8px 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #333; padding: 3px 5px; font-size: 11px; }
  th { text-align: center; background: #e5e7eb; }
  td { text-align: left; }
  td:last-child { text-align: right; }
  .footer { margin-top: 30px; display: flex; justify-content: space-between; }
  .sig { text-align: center; width: 45%; }
  .sig-line { border-bottom: 1px solid #333; margin: 30px auto 4px; width: 180px; }
  @media print { body { padding: 0; } }
</style></head><body>
<h2>ใบสรุปค่าใช้จ่าย</h2>
<div class="info"><div>บจ./หจก.: <b>${doc.company_name || ""}</b></div><div>(ผู้ชื่อ/ผู้รับบริการ)</div></div>
<table>
  <thead><tr><th>วัน เดือน ปี</th><th>รายละเอียดรายจ่าย</th><th>จำนวนเงิน</th><th>ใบสำคัญจ่าย</th></tr></thead>
  <tbody>
    ${its.map(i => `<tr><td>${thaiDate(i.post_date)}</td><td>${i.description || i.recipient_name || "-"}</td><td style="text-align:right">${Number(i.amount).toLocaleString()}</td><td>/</td></tr>`).join("")}
    ${Array.from({ length: Math.max(0, 12 - its.length) }, () => "<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>").join("")}
    <tr><td colspan="2" style="text-align:center"><b>รวมทั้งสิ้น</b></td><td style="text-align:right"><b>${Number(doc.total_amount || 0).toLocaleString()}</b></td><td></td></tr>
  </tbody>
</table>
<p>ข้าพเจ้า <b>${doc.created_by || "___"}</b> (ผู้เบิกจ่าย) ตำแหน่ง <b>${doc.position || "___"}</b></p>
<p style="font-size:11px">ขอรับรองว่า รายจ่ายข้างต้นนี้ไม่อาจเรียกเก็บใบเสร็จรับเงินจากผู้รับได้ และข้าพเจ้าได้จ่ายไปในงานของทาง</p>
<p>${doc.company_name || ""} โดยแท้ ตั้งแต่วันที่ <b>${thaiDate(doc.period_from)}</b> ถึงวันที่ <b>${thaiDate(doc.period_to)}</b></p>
<div class="footer">
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ${doc.created_by || "___"} (ผู้เบิกจ่าย)</div>
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ___________ (ผู้อนุมัติ)</div>
</div>
</body></html>`);
    w.document.close();
    w.print();
  }

  const fmt = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
  const totalItems = items.reduce((s, i) => s + Number(i.amount || 0), 0);

  if (mode === "create") {
    return (
      <div className="page-container">
        <div className="page-topbar">
          <div className="page-title">{editDoc?.viewOnly ? "ดู" : editDoc ? "แก้ไข" : "สร้าง"}ใบสรุป - ค่าไปรษณีย์</div>
          <button className="btn-secondary" onClick={() => setMode("list")}>← กลับ</button>
        </div>
        {message && <div style={{ padding: "8px 14px", background: "#fef3c7", borderRadius: 8, marginBottom: 10, color: "#92400e" }}>{message}</div>}

        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select value={company} onChange={e => setCompany(e.target.value)}
            style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #072d6b", borderRadius: 8, fontWeight: 600, color: "#072d6b" }}>
            {COMPANIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "#6b7280" }}>ตั้งแต่</span>
          <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }} />
          <span style={{ fontSize: 12, color: "#6b7280" }}>ถึง</span>
          <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }} />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>รายการ ({items.filter(i => i.amount > 0).length}) | รวม {fmt(totalItems)} บาท</span>
          {!editDoc?.viewOnly && (
            <>
              <label style={{ padding: "6px 14px", fontSize: 13, background: "#f59e0b", color: "#fff", borderRadius: 8, cursor: "pointer" }}>
                📷 {ocrLoading ? "กำลังอ่าน..." : "สแกนใบเสร็จ (OCR)"}
                <input type="file" accept="image/*" capture="environment" onChange={handleOCR} style={{ display: "none" }} disabled={ocrLoading} />
              </label>
              <button onClick={() => setItems(prev => [...prev, emptyItem()])}
                style={{ padding: "6px 14px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>+ เพิ่มรายการ</button>
            </>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead><tr>
              <th>#</th><th>วันที่</th><th>ผู้รับ</th><th>รายละเอียด</th><th>ปลายทาง</th><th>จำนวนเงิน</th><th>ใบรับเงิน</th><th>หมายเหตุ</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td><input type="date" value={it.post_date} onChange={e => updateItem(idx, "post_date", e.target.value)} style={{ width: 120, fontSize: 12, padding: 2 }} /></td>
                  <td><input value={it.recipient_name} onChange={e => updateItem(idx, "recipient_name", e.target.value)} placeholder="ผู้รับ" style={{ width: 140, fontSize: 12, padding: 2 }} /></td>
                  <td><input value={it.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="รายละเอียด" style={{ width: 140, fontSize: 12, padding: 2 }} /></td>
                  <td><input value={it.destination} onChange={e => updateItem(idx, "destination", e.target.value)} placeholder="ปลายทาง" style={{ width: 100, fontSize: 12, padding: 2 }} /></td>
                  <td><input type="number" value={it.amount} onChange={e => updateItem(idx, "amount", e.target.value)} style={{ width: 70, fontSize: 12, padding: 2, textAlign: "right" }} /></td>
                  <td>
                    {it.receipt_no ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                        <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }} title={it.receipt_customer}>
                          🔗 {it.receipt_no}
                          {it.receipt_customer && <span style={{ fontWeight: 400, marginLeft: 4 }}>— {it.receipt_customer}</span>}
                        </span>
                        {!editDoc?.viewOnly && (
                          <button onClick={() => clearReceipt(idx)} title="ลบลิงก์" style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                        )}
                      </div>
                    ) : !editDoc?.viewOnly ? (
                      <button onClick={() => openLinkPopup(idx)} style={{ padding: "3px 8px", fontSize: 11, background: "#e0f2fe", color: "#0369a1", border: "1px solid #7dd3fc", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>
                        + เลือก
                      </button>
                    ) : <span style={{ color: "#9ca3af", fontSize: 11 }}>-</span>}
                  </td>
                  <td><input value={it.note || ""} onChange={e => updateItem(idx, "note", e.target.value)} placeholder="หมายเหตุ" style={{ width: 140, fontSize: 12, padding: 2 }} disabled={editDoc?.viewOnly} /></td>
                  <td><button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>×</button></td>
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
            <button onClick={async () => { if (!window.confirm("ยืนยันยกเลิกอนุมัติ?")) return; try { await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unapprove_postage_doc", id: editDoc.id }) }); setMode("list"); fetchDocs(); } catch {} }}
              style={{ padding: "10px 24px", fontSize: 14, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
              ยกเลิกอนุมัติ
            </button>
          </div>
        )}

        {/* Popup: เลือกใบรับเงิน */}
        {linkOpen && (
          <div onClick={() => setLinkOpen(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "#fff", borderRadius: 12, width: "min(720px, 92vw)", maxHeight: "85vh",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              <div style={{ padding: "12px 16px", background: "#072d6b", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>เลือกใบรับเงิน (รายได้ค่าไปรษณีย์) — สาขา {(currentUser?.branch || "").split(" ")[0]}</div>
                <button onClick={() => setLinkOpen(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>×</button>
              </div>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb" }}>
                <input
                  value={receiptSearch}
                  onChange={e => setReceiptSearch(e.target.value)}
                  placeholder="ค้นหา เลขที่ใบรับเงิน / ชื่อลูกค้า"
                  style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }}
                  autoFocus
                />
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
                {receiptLoading ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
                ) : availableReceipts.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>ไม่พบใบรับเงินที่ว่างอยู่</div>
                ) : (
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f3f4f6" }}>
                        <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>เลขที่ใบรับเงิน</th>
                        <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>วันที่</th>
                        <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>ลูกค้า</th>
                        <th style={{ padding: 6, textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>รายละเอียด</th>
                        <th style={{ padding: 6, textAlign: "right", borderBottom: "1px solid #e5e7eb" }}>จำนวนเงิน</th>
                        <th style={{ padding: 6, borderBottom: "1px solid #e5e7eb" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableReceipts
                        .filter(r => !receiptSearch ||
                          (r.receipt_no || "").toLowerCase().includes(receiptSearch.toLowerCase()) ||
                          (r.customer_name || "").toLowerCase().includes(receiptSearch.toLowerCase()))
                        .map((r, i) => {
                          const usedHere = items.some((it, j) => j !== linkIdx && it.receipt_no === r.receipt_no);
                          return (
                            <tr key={i} style={{ background: i % 2 ? "#fafafa" : "#fff", opacity: usedHere ? 0.4 : 1 }}>
                              <td style={{ padding: 6, fontWeight: 600 }}>{r.receipt_no}</td>
                              <td style={{ padding: 6 }}>{r.receipt_date ? new Date(r.receipt_date).toLocaleDateString("th-TH") : "-"}</td>
                              <td style={{ padding: 6 }}>{r.customer_name || "-"}</td>
                              <td style={{ padding: 6 }}>{r.description || "-"}</td>
                              <td style={{ padding: 6, textAlign: "right", fontWeight: 600 }}>{Number(r.amount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                              <td style={{ padding: 6 }}>
                                <button onClick={() => selectReceipt(r)} disabled={usedHere}
                                  style={{ padding: "4px 10px", fontSize: 11, background: usedHere ? "#d1d5db" : "#072d6b", color: "#fff", border: "none", borderRadius: 4, cursor: usedHere ? "not-allowed" : "pointer", fontWeight: 600 }}>
                                  {usedHere ? "ใช้แล้ว" : "เลือก"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const selectedTotal = docs.filter(d => selectedDocs.has(d.id)).reduce((s, d) => s + Number(d.total_amount || 0), 0);

  function printSummary() {
    const selDocs = docs.filter(d => selectedDocs.has(d.id));
    if (selDocs.length === 0) return;
    const total = selDocs.reduce((s, d) => s + Number(d.total_amount || 0), 0);
    const thaiDate = d => d ? new Date(d).toLocaleDateString("th-TH") : "-";
    const companyName = selDocs[0]?.company_name || "";
    const createdBy = selDocs[0]?.created_by || "";
    const position = selDocs[0]?.position || "";
    const allItems = selDocs.flatMap(d => (Array.isArray(d.items) ? d.items : []).map(i => ({ ...i, doc_no: d.doc_no })));
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบสรุปค่าใช้จ่าย</title>
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
<h2>ใบสรุปค่าใช้จ่าย</h2>
<div class="info"><div>บจ./หจก.: <b>${companyName}</b></div><div>(ผู้ชื่อ/ผู้รับบริการ)</div></div>
<table>
  <thead><tr><th>วัน เดือน ปี</th><th>รายละเอียดรายจ่าย</th><th>จำนวนเงิน</th><th>ใบสำคัญจ่าย</th></tr></thead>
  <tbody>
    ${selDocs.map(d => `<tr><td>${thaiDate(d.doc_date)}</td><td>ค่าไปรษณีย์ (${d.doc_no})</td><td style="text-align:right">${Number(d.total_amount).toLocaleString()}</td><td>/</td></tr>`).join("")}
    ${Array.from({ length: Math.max(0, 15 - selDocs.length) }, () => "<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>").join("")}
    <tr><td colspan="2" style="text-align:center"><b>รวมทั้งสิ้น</b></td><td style="text-align:right"><b>${total.toLocaleString()}</b></td><td></td></tr>
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

  async function approveSelected() {
    const ids = [...selectedDocs];
    if (ids.length === 0) return;
    if (!window.confirm(`ยืนยันอนุมัติ ${ids.length} ใบ? (อนุมัติแล้วแก้ไขไม่ได้)`)) return;
    for (const id of ids) {
      try { await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve_postage_doc", id }) }); } catch {}
    }
    setSelectedDocs(new Set());
    fetchDocs();
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">ค่าไปรษณีย์</div>
        <button className="btn-primary" onClick={openCreate}>+ สร้างใบสรุป</button>
      </div>
      {message && <div style={{ padding: "8px 14px", background: "#d1fae5", borderRadius: 8, marginBottom: 10, color: "#065f46" }}>{message}</div>}

      {selectedDocs.size > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#072d6b" }}>เลือก {selectedDocs.size} ใบ | รวม {fmt(selectedTotal)} บาท</span>
          <button onClick={printSummary} style={{ padding: "6px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>🖨️ พิมพ์ใบสรุป</button>
          <button onClick={approveSelected} style={{ padding: "6px 16px", fontSize: 13, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>✅ อนุมัติทั้งหมด</button>
          <button onClick={() => setSelectedDocs(new Set())} style={{ padding: "6px 16px", fontSize: 13, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>ล้างเลือก</button>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ fontSize: 13 }}>
          <thead><tr>
            <th style={{ width: 30 }}><input type="checkbox" checked={docs.filter(d => d.status !== "approved").length > 0 && docs.filter(d => d.status !== "approved").every(d => selectedDocs.has(d.id))}
              onChange={e => { const n = new Set(); if (e.target.checked) docs.filter(d => d.status !== "approved").forEach(d => n.add(d.id)); setSelectedDocs(n); }} /></th>
            <th>#</th><th>เลขที่</th><th>วันที่</th><th>บริษัท</th><th>ผู้เบิก</th><th>ช่วงวันที่</th><th>รายการ</th><th>ยอดรวม</th><th>สถานะ</th><th>จัดการ</th>
          </tr></thead>
          <tbody>
            {docs.length === 0 ? <tr><td colSpan={11} style={{ textAlign: "center", padding: 20 }}>ยังไม่มีใบสรุป</td></tr> :
              docs.map((d, i) => {
                const its = Array.isArray(d.items) ? d.items : [];
                return (
                  <tr key={d.id} style={{ background: selectedDocs.has(d.id) ? "#fef3c7" : undefined }}>
                    <td>{d.status !== "approved" ? <input type="checkbox" checked={selectedDocs.has(d.id)}
                      onChange={() => setSelectedDocs(prev => { const n = new Set(prev); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; })} /> :
                      <button onClick={() => openEdit({ ...d, viewOnly: true })} style={{ padding: "3px 10px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>ดู</button>
                    }</td>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{d.doc_no}</td>
                    <td>{d.doc_date ? new Date(d.doc_date).toLocaleDateString("th-TH") : "-"}</td>
                    <td>{d.company_name}</td>
                    <td>{d.created_by}</td>
                    <td>{d.period_from ? new Date(d.period_from).toLocaleDateString("th-TH") : ""} - {d.period_to ? new Date(d.period_to).toLocaleDateString("th-TH") : ""}</td>
                    <td style={{ textAlign: "center" }}>{its.length}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(d.total_amount)}</td>
                    <td>
                      <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11,
                        background: d.status === "approved" ? "#d1fae5" : "#fef3c7",
                        color: d.status === "approved" ? "#065f46" : "#92400e" }}>
                        {d.status === "approved" ? "อนุมัติแล้ว" : "รออนุมัติ"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {d.status !== "approved" && (
                        <>
                          <button onClick={() => openEdit(d)} style={{ padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, marginRight: 4 }}>แก้ไข</button>
                          <button onClick={() => deleteDoc(d.id)} style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>ลบ</button>
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
