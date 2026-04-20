import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/petty-cash-api";

const COMPANIES = [
  { label: "บริษัท ป.เปา มอเตอร์เซอร์วิส จำกัด" },
  { label: "หจก สิงห์ชัยสยามยนต์" },
];

const DEFAULT_DESC = "ค่าผลไม้";
const DEFAULT_AMOUNT = 50;

export default function PettyCashOfferingPage({ currentUser }) {
  const [docs, setDocs] = useState([]);
  const [mode, setMode] = useState("list");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [items, setItems] = useState([]);
  const [company, setCompany] = useState(COMPANIES[0].label);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [selectedDocs, setSelectedDocs] = useState(new Set());

  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const m = now.getMonth() + 1;
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? now.getFullYear() - 1 : now.getFullYear();

  useEffect(() => { fetchDocs(); }, []);

  async function fetchDocs() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_offering_docs" }),
      });
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : []);
    } catch { setDocs([]); }
  }

  function emptyItem(date = "") {
    return { offering_date: date, description: DEFAULT_DESC, amount: DEFAULT_AMOUNT, note: "" };
  }

  // สร้างรายการรายวันจาก period_from → period_to (กรอก default ค่าผลไม้ 50)
  function generateDailyItems(from, to) {
    if (!from || !to) return [emptyItem()];
    const result = [];
    const d1 = new Date(from);
    const d2 = new Date(to);
    if (isNaN(d1) || isNaN(d2) || d1 > d2) return [emptyItem()];
    const curr = new Date(d1);
    while (curr <= d2) {
      result.push(emptyItem(curr.toISOString().slice(0, 10)));
      curr.setDate(curr.getDate() + 1);
      if (result.length > 100) break;
    }
    return result;
  }

  function openCreate() {
    setMode("create"); setEditDoc(null);
    setCompany(COMPANIES[0].label);
    const from = `${prevY}-${pad(prevM)}-25`;
    const to = `${now.getFullYear()}-${pad(m)}-24`;
    setPeriodFrom(from);
    setPeriodTo(to);
    setItems(generateDailyItems(from, to));
    setMessage("");
  }

  function openEdit(doc) {
    setMode("create"); setEditDoc(doc);
    setCompany(doc.company_name || COMPANIES[0].label);
    setPeriodFrom(doc.period_from ? doc.period_from.slice(0, 10) : "");
    setPeriodTo(doc.period_to ? doc.period_to.slice(0, 10) : "");
    const its = Array.isArray(doc.items) && doc.items.length > 0
      ? doc.items.map(i => ({
          offering_date: i.offering_date ? i.offering_date.slice(0, 10) : "",
          description: i.description || DEFAULT_DESC,
          amount: Number(i.amount) || 0,
          note: i.note || "",
        }))
      : [emptyItem()];
    setItems(its); setMessage("");
  }

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function regenerateFromPeriod() {
    setItems(generateDailyItems(periodFrom, periodTo));
  }

  async function saveDoc() {
    const validItems = items.filter(it => Number(it.amount) > 0 && it.offering_date);
    if (validItems.length === 0) { setMessage("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ"); return; }
    setSaving(true);
    try {
      let docId = editDoc?.id;
      if (!docId) {
        const docNo = `OFR${String(now.getFullYear() + 543).slice(-2)}${pad(m)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
        const res = await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_offering_doc", doc_no: docNo,
            doc_date: now.toISOString().split("T")[0],
            branch_code: (currentUser?.branch || "").split(" ")[0],
            branch_name: currentUser?.branch || "",
            company_name: company,
            created_by: currentUser?.name || "",
            position: currentUser?.position || "",
            period_from: periodFrom, period_to: periodTo,
          }),
        });
        const data = await res.json();
        docId = data?.id;
      }
      if (docId) {
        await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save_offering_items", doc_id: docId, items: validItems }),
        });
      }
      setMode("list"); fetchDocs(); setMessage("บันทึกสำเร็จ!");
    } catch { setMessage("บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function deleteDoc(id) {
    if (!window.confirm("ยืนยันลบ?")) return;
    try {
      await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_offering_doc", id }) });
      fetchDocs();
    } catch {}
  }

  function printDoc(doc) {
    const its = Array.isArray(doc.items) ? doc.items : [];
    const DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const thaiDate = d => {
      if (!d) return "-";
      const dt = new Date(d);
      return `${DAYS[dt.getDay()]} ${dt.getDate()}-${dt.getMonth() + 1}-${String(dt.getFullYear() + 543).slice(-2)}`;
    };
    const thaiDateFull = d => d ? new Date(d).toLocaleDateString("th-TH") : "-";
    const total = its.reduce((s, i) => s + Number(i.amount || 0), 0);
    const minRows = Math.max(0, 15 - its.length);
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบรับรองแทนใบเสร็จรับเงิน</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'TH Sarabun New','Tahoma',sans-serif; font-size: 14px; padding: 15px; }
  h2 { text-align: center; margin: 0 0 10px; font-size: 20px; }
  .info-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 13px; }
  .info-row b { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #000; padding: 4px 6px; font-size: 13px; }
  th { text-align: center; background: #1e3a8a; color: #fff; }
  td.center { text-align: center; }
  td.right { text-align: right; }
  .total-row td { font-weight: 700; }
  .footer { margin-top: 20px; font-size: 13px; }
  .sign-row { margin-top: 30px; display: flex; justify-content: space-around; }
  .sig { text-align: center; width: 40%; }
  .sig-line { border-bottom: 1px solid #000; margin: 30px auto 4px; width: 200px; }
  @media print { body { padding: 0; } }
</style></head><body>
<h2>ใบรับรองแทนใบเสร็จรับเงิน</h2>
<div class="info-row">
  <div>วันที่เบิก: <u>&nbsp;${thaiDateFull(doc.doc_date)}&nbsp;</u></div>
  <div>เลขที่ใบจ่าย: <u>&nbsp;${doc.doc_no || ''}&nbsp;</u></div>
</div>
<div class="info-row">
  <div>บจ./หจก.: <b>${doc.company_name || ''}</b></div>
  <div>(ผู้ซื้อ/ผู้รับบริการ)</div>
</div>
<table>
  <thead>
    <tr>
      <th style="width:18%">วัน เดือน ปี</th>
      <th>รายละเอียดรายจ่าย</th>
      <th style="width:18%">จำนวนเงิน</th>
      <th style="width:18%">หมายเหตุ</th>
    </tr>
  </thead>
  <tbody>
    ${its.map(i => `<tr>
      <td class="center">${thaiDate(i.offering_date)}</td>
      <td>${i.description || '-'}</td>
      <td class="right">${Number(i.amount || 0).toLocaleString()}</td>
      <td>${i.note || ''}</td>
    </tr>`).join("")}
    ${Array.from({ length: minRows }, () => `<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>`).join("")}
    <tr class="total-row">
      <td colspan="2" class="center"><b>รวมทั้งสิ้น</b></td>
      <td class="right"><b>${total.toLocaleString()}</b> -</td>
      <td></td>
    </tr>
  </tbody>
</table>
<div class="footer">
  <p>ข้าพเจ้า <u>&nbsp;&nbsp;${doc.created_by || '__________'}&nbsp;&nbsp;</u> (ผู้เบิกจ่าย) ตำแหน่ง <u>&nbsp;&nbsp;${doc.position || '______'}&nbsp;&nbsp;</u></p>
  <p style="font-size:12px">ขอรับรองว่า รายจ่ายข้างต้นนี้ไม่อาจเรียกเก็บใบเสร็จรับเงินจากผู้รับได้ และข้าพเจ้าได้จ่ายไปในงานของทาง</p>
  <p>บริษัท/ห้างหุ้นส่วนจำกัด โดยแท้ ตั้งแต่วันที่ <u>&nbsp;${thaiDateFull(doc.period_from)}&nbsp;</u> ถึงวันที่ <u>&nbsp;${thaiDateFull(doc.period_to)}&nbsp;</u></p>
</div>
<div class="sign-row">
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ${doc.created_by || ''} (ผู้เบิกจ่าย)</div>
  <div class="sig"><div class="sig-line"></div>ลงชื่อ ___________ (ผู้อนุมัติ)</div>
</div>
</body></html>`);
    w.document.close();
    w.print();
  }

  const fmt = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
  const DAYS_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const DAY_COLORS = ["#dc2626", "#f59e0b", "#ec4899", "#059669", "#f97316", "#2563eb", "#7c3aed"];
  function getDayLabel(dateStr) {
    if (!dateStr) return { label: "-", color: "#9ca3af" };
    const d = new Date(dateStr);
    if (isNaN(d)) return { label: "-", color: "#9ca3af" };
    const i = d.getDay();
    return { label: DAYS_TH[i], color: DAY_COLORS[i] };
  }
  const totalItems = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const selectedTotal = docs.filter(d => selectedDocs.has(d.id)).reduce((s, d) => s + Number(d.total_amount || 0), 0);

  /* ── CREATE/EDIT ── */
  if (mode === "create") {
    return (
      <div className="page-container">
        <div className="page-topbar">
          <div className="page-title">{editDoc?.viewOnly ? "ดู" : editDoc ? "แก้ไข" : "สร้าง"} - ค่าของไหว้</div>
          <button className="btn-secondary" onClick={() => setMode("list")}>← กลับ</button>
        </div>
        {message && <div style={{ padding: "8px 14px", background: "#fef3c7", borderRadius: 8, marginBottom: 10, color: "#92400e" }}>{message}</div>}

        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select value={company} onChange={e => setCompany(e.target.value)} disabled={editDoc?.viewOnly}
            style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #072d6b", borderRadius: 8, fontWeight: 600, color: "#072d6b" }}>
            {COMPANIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "#6b7280" }}>ตั้งแต่</span>
          <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} disabled={editDoc?.viewOnly}
            style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }} />
          <span style={{ fontSize: 12, color: "#6b7280" }}>ถึง</span>
          <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} disabled={editDoc?.viewOnly}
            style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }} />
          {!editDoc?.viewOnly && !editDoc && (
            <button onClick={regenerateFromPeriod}
              style={{ padding: "6px 14px", fontSize: 12, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
              🔄 สร้างรายการรายวันจากช่วงวันที่
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            รายการ ({items.filter(i => Number(i.amount) > 0).length}) | รวม <span style={{ color: "#dc2626" }}>{fmt(totalItems)}</span> บาท
          </span>
          {!editDoc?.viewOnly && (
            <button onClick={() => setItems(prev => [...prev, emptyItem()])}
              style={{ padding: "6px 14px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>+ เพิ่มรายการ</button>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead><tr>
              <th>#</th><th>วันที่</th><th>วัน</th><th>รายละเอียด</th><th>จำนวนเงิน</th><th>หมายเหตุ</th>{!editDoc?.viewOnly && <th></th>}
            </tr></thead>
            <tbody>
              {items.map((it, idx) => {
                const day = getDayLabel(it.offering_date);
                return (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td><input type="date" value={it.offering_date} onChange={e => updateItem(idx, "offering_date", e.target.value)} disabled={editDoc?.viewOnly} style={{ width: 130, fontSize: 12, padding: 2 }} /></td>
                  <td><span style={{ fontWeight: 600, color: day.color, fontSize: 12 }}>{day.label}</span></td>
                  <td><input value={it.description} onChange={e => updateItem(idx, "description", e.target.value)} disabled={editDoc?.viewOnly} placeholder="ค่าผลไม้" style={{ width: 220, fontSize: 12, padding: 2 }} /></td>
                  <td><input type="number" value={it.amount} onChange={e => updateItem(idx, "amount", e.target.value)} disabled={editDoc?.viewOnly} style={{ width: 80, fontSize: 12, padding: 2, textAlign: "right" }} /></td>
                  <td><input value={it.note} onChange={e => updateItem(idx, "note", e.target.value)} disabled={editDoc?.viewOnly} placeholder="หมายเหตุ" style={{ width: 160, fontSize: 12, padding: 2 }} /></td>
                  {!editDoc?.viewOnly && <td><button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>×</button></td>}
                </tr>
                );
              })}
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
            <button onClick={async () => {
              if (!window.confirm("ยืนยันยกเลิกอนุมัติ?")) return;
              try {
                await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "unapprove_offering_doc", id: editDoc.id }) });
                setMode("list"); fetchDocs();
              } catch {}
            }}
              style={{ padding: "10px 24px", fontSize: 14, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
              ยกเลิกอนุมัติ
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── LIST ── */
  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">🌼 ค่าของไหว้</div>
        <button className="btn-primary" onClick={openCreate}>+ สร้างใบสรุป</button>
      </div>
      {message && <div style={{ padding: "8px 14px", background: "#d1fae5", borderRadius: 8, marginBottom: 10, color: "#065f46" }}>{message}</div>}

      {selectedDocs.size > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#072d6b" }}>เลือก {selectedDocs.size} ใบ | รวม {fmt(selectedTotal)} บาท</span>
          <button onClick={async () => {
            const ids = [...selectedDocs];
            if (!window.confirm(`อนุมัติ ${ids.length} ใบ?`)) return;
            for (const id of ids) {
              try { await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve_offering_doc", id }) }); } catch {}
            }
            setSelectedDocs(new Set()); fetchDocs();
          }} style={{ padding: "6px 16px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
            ✅ อนุมัติ
          </button>
          <button onClick={() => setSelectedDocs(new Set())} style={{ padding: "6px 16px", fontSize: 13, background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
            ล้าง
          </button>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ fontSize: 13 }}>
          <thead><tr>
            <th style={{ width: 30 }}>
              <input type="checkbox"
                checked={docs.filter(d => d.status !== "approved").length > 0 && docs.filter(d => d.status !== "approved").every(d => selectedDocs.has(d.id))}
                onChange={e => {
                  const n = new Set();
                  if (e.target.checked) docs.filter(d => d.status !== "approved").forEach(d => n.add(d.id));
                  setSelectedDocs(n);
                }} />
            </th>
            <th>#</th><th>เลขที่</th><th>วันที่</th><th>บริษัท</th><th>ผู้เบิก</th><th>ตั้งแต่</th><th>ถึง</th><th>ยอดรวม</th><th>สถานะ</th><th>จัดการ</th>
          </tr></thead>
          <tbody>
            {docs.length === 0 ? <tr><td colSpan={11} style={{ textAlign: "center", padding: 20 }}>ยังไม่มีใบสรุป</td></tr> :
              docs.map((d, i) => (
                <tr key={d.id} style={{ background: selectedDocs.has(d.id) ? "#fef3c7" : undefined }}>
                  <td>
                    {d.status !== "approved" ? (
                      <input type="checkbox" checked={selectedDocs.has(d.id)}
                        onChange={() => setSelectedDocs(prev => {
                          const n = new Set(prev);
                          n.has(d.id) ? n.delete(d.id) : n.add(d.id);
                          return n;
                        })} />
                    ) : (
                      <button onClick={() => openEdit({ ...d, viewOnly: true })} style={{ padding: "2px 8px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10 }}>ดู</button>
                    )}
                  </td>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{d.doc_no}</td>
                  <td>{d.doc_date ? new Date(d.doc_date).toLocaleDateString("th-TH") : "-"}</td>
                  <td>{d.company_name}</td>
                  <td>{d.created_by}</td>
                  <td>{d.period_from ? new Date(d.period_from).toLocaleDateString("th-TH") : "-"}</td>
                  <td>{d.period_to ? new Date(d.period_to).toLocaleDateString("th-TH") : "-"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{fmt(d.total_amount)}</td>
                  <td>
                    <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11,
                      background: d.status === "approved" ? "#d1fae5" : "#fef3c7",
                      color: d.status === "approved" ? "#065f46" : "#92400e" }}>
                      {d.status === "approved" ? "อนุมัติแล้ว" : "รออนุมัติ"}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => printDoc(d)} style={{ padding: "3px 10px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, marginRight: 4 }}>🖨 พิมพ์</button>
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
