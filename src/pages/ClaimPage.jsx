import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/claim-api";
const MASTER_API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const USER_API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/office-login";

const emptyItem = () => ({ part_code: "", part_name: "", quantity: 1, remark: "" });

const emptyForm = () => ({
  doc_date: new Date().toISOString().slice(0, 10),
  contact_name: "",
  phone: "",
  brand: "",
  car_model: "",
  engine_chassis_no: "",
  mileage: "",
  technician: "",
  customer_complaint: "",
  mechanic_finding: "",
  note: "",
  status: "pending",
  // tracking
  submitted: false, submit_date: "", submit_claim_no: "",
  parts_received: false, parts_received_date: "",
  appointment_notified: false, appointment_date: "", appointment_note: "",
  job_closed: false, job_closed_date: "", job_no: "",
  scrap_returned: false, scrap_returned_date: "",
  payment_received: false, payment_received_date: "", payment_amount: 0,
});

const TRACKING_STEPS = [
  { key: "submitted", dateKey: "submit_date", label: "1️⃣ ส่งเคลมแล้ว", color: "#3b82f6", extraKey: "submit_claim_no", extraLabel: "เลขที่ใบเคลม (ศูนย์)" },
  { key: "parts_received", dateKey: "parts_received_date", label: "2️⃣ รับอะไหล่เคลม", color: "#8b5cf6" },
  { key: "appointment_notified", dateKey: "appointment_date", label: "3️⃣ แจ้งนัดหมายลูกค้า", color: "#f59e0b", extraKey: "appointment_note", extraLabel: "หมายเหตุนัดหมาย" },
  { key: "job_closed", dateKey: "job_closed_date", label: "4️⃣ ปิด JOB เคลม", color: "#10b981", extraKey: "job_no", extraLabel: "เลขที่ JOB" },
  { key: "scrap_returned", dateKey: "scrap_returned_date", label: "5️⃣ แจ้งคืนซาก", color: "#6b7280" },
  { key: "payment_received", dateKey: "payment_received_date", label: "6️⃣ รับชำระเงินค่าเคลม", color: "#059669", extraKey: "payment_amount", extraLabel: "จำนวนเงิน (บาท)", extraType: "number" },
];

export default function ClaimPage({ currentUser }) {
  const [mode, setMode] = useState("list");
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [items, setItems] = useState([emptyItem()]);
  const [editId, setEditId] = useState(null);
  const [images, setImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [brands, setBrands] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [carSeries, setCarSeries] = useState([]);

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    fetchClaims();
    fetchMasters();
  }, []);

  async function fetchMasters() {
    try {
      const resB = await fetch(MASTER_API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_brands" }) });
      const bs = await resB.json();
      setBrands(Array.isArray(bs) ? bs : bs.rows || []);
    } catch { setBrands([]); }
    try {
      const resU = await fetch(USER_API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_users" }) });
      const us = await resU.json();
      console.log("[Claim] get_users raw:", us);
      // รองรับหลาย response shape
      const arr = Array.isArray(us) ? us : (us.rows || us.items || us.data || us.users || []);
      console.log("[Claim] get_users parsed:", arr.length, "items. Sample:", arr[0]);
      const technicians = arr.filter(u => {
        const pos = (u.position || u.position_name || "").toString().trim();
        return pos.includes("ช่าง");
      });
      console.log("[Claim] Technicians filtered:", technicians.length);
      setDrivers(technicians);
    } catch (e) { console.error("[Claim] get_users error:", e); setDrivers([]); }
    try {
      const resS = await fetch(MASTER_API_URL, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_series" }) });
      const ss = await resS.json();
      setCarSeries(Array.isArray(ss) ? ss : ss.rows || []);
    } catch { setCarSeries([]); }
  }

  async function fetchClaims() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_claims" }),
      });
      const data = await res.json();
      setClaims(Array.isArray(data) ? data : data.rows || []);
    } catch { setClaims([]); }
    setLoading(false);
  }

  async function fetchImages(claimId) {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_claim_images", claim_id: claimId }),
      });
      const data = await res.json();
      setImages(Array.isArray(data) ? data : []);
    } catch { setImages([]); }
  }

  function openCreate() {
    setMode("form");
    setEditId(null);
    setForm(emptyForm());
    setItems([emptyItem()]);
    setImages([]);
    setMessage("");
  }

  function openEdit(claim) {
    setMode("form");
    setEditId(claim.id);
    setForm({
      doc_date: claim.doc_date ? claim.doc_date.slice(0, 10) : "",
      contact_name: claim.contact_name || "",
      phone: claim.phone || "",
      brand: claim.brand || "",
      car_model: claim.car_model || "",
      engine_chassis_no: claim.engine_chassis_no || "",
      mileage: claim.mileage || "",
      technician: claim.technician || "",
      customer_complaint: claim.customer_complaint || "",
      mechanic_finding: claim.mechanic_finding || "",
      note: claim.note || "",
      status: claim.status || "pending",
      submitted: !!claim.submitted,
      submit_date: claim.submit_date ? claim.submit_date.slice(0, 10) : "",
      submit_claim_no: claim.submit_claim_no || "",
      parts_received: !!claim.parts_received,
      parts_received_date: claim.parts_received_date ? claim.parts_received_date.slice(0, 10) : "",
      appointment_notified: !!claim.appointment_notified,
      appointment_date: claim.appointment_date ? claim.appointment_date.slice(0, 10) : "",
      appointment_note: claim.appointment_note || "",
      job_closed: !!claim.job_closed,
      job_closed_date: claim.job_closed_date ? claim.job_closed_date.slice(0, 10) : "",
      job_no: claim.job_no || "",
      scrap_returned: !!claim.scrap_returned,
      scrap_returned_date: claim.scrap_returned_date ? claim.scrap_returned_date.slice(0, 10) : "",
      payment_received: !!claim.payment_received,
      payment_received_date: claim.payment_received_date ? claim.payment_received_date.slice(0, 10) : "",
      payment_amount: claim.payment_amount || 0,
    });
    setItems(Array.isArray(claim.items) && claim.items.length > 0 ? claim.items.map(i => ({
      part_code: i.part_code || "",
      part_name: i.part_name || "",
      quantity: Number(i.quantity) || 1,
      remark: i.remark || "",
    })) : [emptyItem()]);
    fetchImages(claim.id);
    setMessage("");
  }

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  async function handleSave() {
    if (!form.doc_date || !form.contact_name.trim()) {
      setMessage("กรุณากรอก วันที่ และ ชื่อผู้ติดต่อ");
      return;
    }
    const validItems = items.filter(it => it.part_code.trim() || it.part_name.trim());
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editId ? "update_claim" : "save_claim",
          id: editId,
          ...form,
          mileage: Number(form.mileage) || 0,
          branch_code: (currentUser?.branch || "").split(" ")[0],
          branch_name: currentUser?.branch || "",
          created_by: currentUser?.name || "",
          items: validItems,
        }),
      });
      const data = await res.json();
      const newId = data?.id || editId;
      if (!editId && newId) setEditId(newId);
      setMessage("บันทึกสำเร็จ");
      fetchClaims();
    } catch { setMessage("บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("ยืนยันลบใบเคลม?")) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_claim", id }),
      });
      fetchClaims();
    } catch {}
  }

  async function handleImageUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!editId) {
      setMessage("บันทึกใบเคลมก่อนอัปโหลดรูป");
      return;
    }
    setUploadingImage(true);
    let ok = 0, fail = 0;
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { fail++; continue; }
      try {
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload_claim_image",
            claim_id: editId,
            file_name: file.name,
            mime_type: file.type,
            image_data: b64,
            file_size: file.size,
            uploaded_by: currentUser?.name || "",
          }),
        });
        ok++;
      } catch { fail++; }
    }
    fetchImages(editId);
    setMessage(`อัปโหลดสำเร็จ ${ok} รูป${fail > 0 ? ` (ล้มเหลว ${fail})` : ""}`);
    setUploadingImage(false);
    e.target.value = "";
  }

  async function handleImageDelete(imageId) {
    if (!window.confirm("ยืนยันลบรูป?")) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_claim_image", image_id: imageId }),
      });
      fetchImages(editId);
    } catch {}
  }

  function downloadImage(img) {
    const a = document.createElement("a");
    a.href = `data:${img.mime_type};base64,${img.image_data}`;
    a.download = img.file_name || `claim-${img.image_id}.jpg`;
    a.click();
  }

  function printClaim(claim) {
    const its = Array.isArray(claim.items) ? claim.items : items;
    const thaiDate = d => d ? new Date(d).toLocaleDateString("th-TH") : "-";
    const minRows = Math.max(0, 14 - its.length);
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบแจ้งเคลม</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'TH Sarabun New','Tahoma',sans-serif; font-size: 14px; padding: 15px; }
  h2 { text-align: center; margin: 0; font-size: 22px; }
  .info { display: flex; justify-content: space-between; margin-top: 10px; }
  .field { margin: 6px 0; }
  .field label { display: inline-block; min-width: 140px; font-weight: 600; }
  .field .val { border-bottom: 1px solid #000; display: inline-block; min-width: 200px; padding: 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; }
  th { background: #1e3a8a; color: #fff; text-align: center; }
  @media print { body { padding: 0; } }
</style></head><body>
<div style="display:flex; justify-content:space-between; align-items:flex-start;">
  <div style="flex:1"></div>
  <div style="flex:1; text-align:center"><h2>ใบแจ้งเคลม</h2></div>
  <div style="flex:1; text-align:right; font-size:12px">วันที่เอกสาร<br/>${thaiDate(claim.doc_date || form.doc_date)}</div>
</div>
<div class="field"><label>ชื่อผู้ติดต่อ</label> <span class="val">${claim.contact_name || form.contact_name || ""}</span>
  <label style="margin-left:30px">เบอร์โทร</label> <span class="val">${claim.phone || form.phone || ""}</span></div>
<div class="field"><label>รุ่นรถ</label> <span class="val">${claim.car_model || form.car_model || ""}</span>
  <label style="margin-left:30px">เลขเครื่อง/ตัวถัง</label> <span class="val">${claim.engine_chassis_no || form.engine_chassis_no || ""}</span></div>
<div class="field"><label>เลขไมล์</label> <span class="val">${claim.mileage || form.mileage || ""}</span>
  <label style="margin-left:30px">ช่างซ่อม</label> <span class="val">${claim.technician || form.technician || ""}</span></div>
<div class="field"><label>อาการที่ลูกค้าแจ้ง</label> <span class="val" style="min-width:600px">${claim.customer_complaint || form.customer_complaint || ""}</span></div>
<div class="field"><label>ปัญหาที่ช่างแจ้ง</label> <span class="val" style="min-width:600px">${claim.mechanic_finding || form.mechanic_finding || ""}</span></div>
<table>
  <thead><tr><th style="width:10%">ลำดับ</th><th>รหัสอะไหล่</th><th style="width:15%">จำนวน</th></tr></thead>
  <tbody>
    ${its.map((i, idx) => `<tr><td style="text-align:center">${idx + 1}</td><td>${i.part_code || ""} ${i.part_name ? "(" + i.part_name + ")" : ""}</td><td style="text-align:center">${Number(i.quantity) || ""}</td></tr>`).join("")}
    ${Array.from({ length: minRows }, () => `<tr><td>&nbsp;</td><td></td><td></td></tr>`).join("")}
  </tbody>
</table>
</body></html>`);
    w.document.close();
    w.print();
  }

  const filtered = claims.filter(c => {
    if (filterStatus !== "all") {
      if (filterStatus === "not_submitted" && c.submitted) return false;
      if (filterStatus === "submitted" && (!c.submitted || c.parts_received)) return false;
      if (filterStatus === "parts_received" && (!c.parts_received || c.appointment_notified)) return false;
      if (filterStatus === "appointment_notified" && (!c.appointment_notified || c.job_closed)) return false;
      if (filterStatus === "job_closed" && (!c.job_closed || c.scrap_returned)) return false;
      if (filterStatus === "scrap_returned" && (!c.scrap_returned || c.payment_received)) return false;
      if (filterStatus === "payment_received" && !c.payment_received) return false;
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      return (c.claim_no || "").toLowerCase().includes(s) ||
        (c.submit_claim_no || "").toLowerCase().includes(s) ||
        (c.contact_name || "").toLowerCase().includes(s) ||
        (c.car_model || "").toLowerCase().includes(s) ||
        (c.engine_chassis_no || "").toLowerCase().includes(s);
    }
    return true;
  });

  const inputStyle = { padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", width: "100%", boxSizing: "border-box" };

  /* ── FORM ── */
  if (mode === "form") {
    return (
      <div className="page-container">
        <div className="page-topbar">
          <h2 className="page-title">📝 {editId ? "แก้ไข" : "สร้าง"}ใบแจ้งเคลม</h2>
          <button className="btn-secondary" onClick={() => setMode("list")}>← กลับ</button>
        </div>
        {message && <div style={{ padding: "8px 14px", background: message.includes("สำเร็จ") ? "#d1fae5" : "#fef3c7", borderRadius: 8, marginBottom: 10, color: message.includes("สำเร็จ") ? "#065f46" : "#92400e" }}>{message}</div>}

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
            <div><label style={S.label}>วันที่เอกสาร *</label><input type="date" value={form.doc_date} onChange={e => setForm({ ...form, doc_date: e.target.value })} style={inputStyle} /></div>
            <div><label style={S.label}>ชื่อผู้ติดต่อ *</label><input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} style={inputStyle} /></div>
            <div><label style={S.label}>เบอร์โทร</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} /></div>
            <div><label style={S.label}>ยี่ห้อ</label>
              <select value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value, car_model: "" })} style={inputStyle}>
                <option value="">-- เลือกยี่ห้อ --</option>
                {brands.map(b => <option key={b.brand_id || b.brand_name} value={b.brand_name}>{b.brand_name}</option>)}
              </select>
            </div>
            <div><label style={S.label}>รุ่นรถ</label>
              {(() => {
                const seriesOfBrand = carSeries.filter(s => !form.brand || s.brand_name === form.brand);
                return (
                  <>
                    <input list="car-models-list" value={form.car_model} onChange={e => setForm({ ...form, car_model: e.target.value })} style={inputStyle} placeholder={form.brand ? "เลือกหรือพิมพ์รุ่น" : "เลือกยี่ห้อก่อน"} />
                    <datalist id="car-models-list">
                      {seriesOfBrand.map(s => <option key={s.series_id || s.marketing_name} value={s.marketing_name || s.series_name} />)}
                    </datalist>
                  </>
                );
              })()}
            </div>
            <div><label style={S.label}>เลขเครื่อง/ตัวถัง</label><input value={form.engine_chassis_no} onChange={e => setForm({ ...form, engine_chassis_no: e.target.value })} style={inputStyle} /></div>
            <div><label style={S.label}>เลขไมล์</label><input type="number" value={form.mileage} onChange={e => setForm({ ...form, mileage: e.target.value })} style={inputStyle} /></div>
            <div><label style={S.label}>ช่างซ่อม</label>
              <select value={form.technician} onChange={e => setForm({ ...form, technician: e.target.value })} style={inputStyle}>
                <option value="">-- เลือกช่าง --</option>
                {drivers.map(d => {
                  const nm = d.name || d.username;
                  return <option key={d.user_id || d.username || nm} value={nm}>{nm}{d.branch ? ` (${d.branch})` : ""}</option>;
                })}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}><label style={S.label}>อาการที่ลูกค้าแจ้ง</label>
              <textarea value={form.customer_complaint} onChange={e => setForm({ ...form, customer_complaint: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}><label style={S.label}>ปัญหาที่ช่างแจ้ง</label>
              <textarea value={form.mechanic_finding} onChange={e => setForm({ ...form, mechanic_finding: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
          </div>
        </div>

        {/* Items */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: "#072d6b" }}>รายการอะไหล่</h3>
            <button onClick={() => setItems(prev => [...prev, emptyItem()])}
              style={{ padding: "6px 14px", fontSize: 13, background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>+ เพิ่มรายการ</button>
          </div>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead><tr><th>#</th><th>รหัสอะไหล่</th><th>ชื่ออะไหล่</th><th style={{ width: 80 }}>จำนวน</th><th>หมายเหตุ</th><th></th></tr></thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td><input value={it.part_code} onChange={e => updateItem(idx, "part_code", e.target.value)} placeholder="รหัส" style={{ width: 180, fontSize: 12, padding: 2 }} /></td>
                  <td><input value={it.part_name} onChange={e => updateItem(idx, "part_name", e.target.value)} placeholder="ชื่ออะไหล่" style={{ width: 220, fontSize: 12, padding: 2 }} /></td>
                  <td><input type="number" value={it.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} style={{ width: 60, fontSize: 12, padding: 2, textAlign: "right" }} /></td>
                  <td><input value={it.remark} onChange={e => updateItem(idx, "remark", e.target.value)} placeholder="หมายเหตุ" style={{ width: 180, fontSize: 12, padding: 2 }} /></td>
                  <td><button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Images */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: "#072d6b" }}>📷 รูปแนบ ({images.length})</h3>
            <label style={{ padding: "6px 14px", fontSize: 13, background: "#f59e0b", color: "#fff", borderRadius: 8, cursor: editId ? "pointer" : "not-allowed", opacity: editId ? 1 : 0.5 }}>
              {uploadingImage ? "กำลังอัปโหลด..." : "📤 อัปโหลดรูป"}
              <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} style={{ display: "none" }} disabled={!editId || uploadingImage} />
            </label>
          </div>
          {!editId && <div style={{ fontSize: 12, color: "#9ca3af" }}>💡 บันทึกใบเคลมก่อน จึงจะอัปโหลดรูปได้</div>}
          {images.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {images.map((img) => (
                <div key={img.image_id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#fafafa" }}>
                  <img src={`data:${img.mime_type};base64,${img.image_data}`} alt={img.file_name}
                    style={{ width: "100%", height: 140, objectFit: "cover", display: "block", cursor: "pointer" }}
                    onClick={() => window.open(`data:${img.mime_type};base64,${img.image_data}`, "_blank")} />
                  <div style={{ padding: 8, fontSize: 11 }}>
                    <div style={{ color: "#374151", marginBottom: 4, wordBreak: "break-all" }}>{img.file_name}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => downloadImage(img)} style={{ flex: 1, padding: "3px 6px", fontSize: 11, background: "#10b981", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>⬇ ดาวน์โหลด</button>
                      <button onClick={() => handleImageDelete(img.image_id)} style={{ padding: "3px 8px", fontSize: 11, background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tracking Steps (ล่างสุด) */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#072d6b", marginBottom: 12 }}>📋 ขั้นตอนการดำเนินการ</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
            {TRACKING_STEPS.map(step => {
              const checked = !!form[step.key];
              return (
                <div key={step.key} style={{ border: `2px solid ${checked ? step.color : "#e5e7eb"}`, borderRadius: 8, padding: 10, background: checked ? step.color + "15" : "#fafafa" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, color: checked ? step.color : "#374151" }}>
                    <input type="checkbox" checked={checked}
                      onChange={e => {
                        const val = e.target.checked;
                        setForm(prev => ({
                          ...prev,
                          [step.key]: val,
                          [step.dateKey]: val && !prev[step.dateKey] ? new Date().toISOString().slice(0, 10) : prev[step.dateKey],
                        }));
                      }} />
                    {step.label}
                  </label>
                  {checked && (
                    <div style={{ marginTop: 8, paddingLeft: 24 }}>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>วันที่</div>
                        <input type="date" value={form[step.dateKey] || ""}
                          onChange={e => setForm({ ...form, [step.dateKey]: e.target.value })}
                          style={{ width: "100%", padding: "4px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4 }} />
                      </div>
                      {step.extraKey && (
                        <div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>{step.extraLabel}</div>
                          <input type={step.extraType || "text"} value={form[step.extraKey] || ""}
                            onChange={e => setForm({ ...form, [step.extraKey]: e.target.value })}
                            style={{ width: "100%", padding: "4px 8px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4 }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}>
            {(() => {
              const done = TRACKING_STEPS.filter(s => form[s.key]).length;
              const pct = (done / TRACKING_STEPS.length) * 100;
              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                    <span>ความคืบหน้า</span>
                    <span style={{ fontWeight: 700, color: "#072d6b" }}>{done} / {TRACKING_STEPS.length} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div style={{ background: "#e5e7eb", borderRadius: 8, height: 10, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#10b981" : "#072d6b", transition: "width 0.5s" }} />
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {editId && <button onClick={() => printClaim({ ...form, items })}
            style={{ padding: "10px 20px", fontSize: 14, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>🖨 พิมพ์</button>}
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "10px 24px", fontSize: 14, background: saving ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
            {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
          </button>
        </div>
      </div>
    );
  }

  /* ── LIST ── */
  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🛠️ ระบบการเคลม</h2>
        <button className="btn-primary" onClick={openCreate}>+ สร้างใบเคลม</button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหา เลขที่ / ชื่อ / รุ่นรถ / เลขถัง"
          style={{ padding: "7px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, minWidth: 280 }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "7px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 }}>
          <option value="all">ทุกขั้นตอน</option>
          <option value="not_submitted">ยังไม่ส่งเคลม</option>
          <option value="submitted">ส่งเคลมแล้ว (รออะไหล่)</option>
          <option value="parts_received">รับอะไหล่แล้ว (ยังไม่นัด)</option>
          <option value="appointment_notified">นัดหมายแล้ว (ยังไม่ปิด JOB)</option>
          <option value="job_closed">ปิด JOB แล้ว (ยังไม่คืนซาก)</option>
          <option value="scrap_returned">คืนซากแล้ว (ยังไม่ชำระ)</option>
          <option value="payment_received">ชำระเงินแล้ว (เสร็จสิ้น)</option>
        </select>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{filtered.length} รายการ</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr>
            <th>#</th><th>เลขที่เคลม</th><th>วันที่</th><th>ผู้ติดต่อ</th>
            <th>รุ่นรถ</th><th>เลขเครื่อง/ตัวถัง</th><th>ช่าง</th>
            <th style={{ width: 180 }}>ขั้นตอน</th><th>จัดการ</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 20 }}>กำลังโหลด...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 20 }}>ไม่มีรายการ</td></tr>
              : filtered.map((c, i) => {
                const doneSteps = TRACKING_STEPS.filter(s => c[s.key]).length;
                const pct = (doneSteps / TRACKING_STEPS.length) * 100;
                return (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{c.claim_no || "-"}</td>
                  <td>{c.doc_date ? new Date(c.doc_date).toLocaleDateString("th-TH") : "-"}</td>
                  <td>
                    <div>{c.contact_name}</div>
                    <div style={{ fontSize: 10, color: "#999" }}>{c.phone}</div>
                  </td>
                  <td>{c.car_model}</td>
                  <td style={{ fontSize: 11 }}>{c.engine_chassis_no}</td>
                  <td>{c.technician || "-"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                      {TRACKING_STEPS.map(s => (
                        <div key={s.key} title={s.label}
                          style={{ flex: 1, height: 8, background: c[s.key] ? s.color : "#e5e7eb", borderRadius: 2 }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>{doneSteps}/{TRACKING_STEPS.length} ({pct.toFixed(0)}%)</div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => openEdit(c)} style={{ padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, marginRight: 4 }}>แก้ไข</button>
                    <button onClick={() => printClaim(c)} style={{ padding: "3px 10px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, marginRight: 4 }}>🖨</button>
                    <button onClick={() => handleDelete(c.id)} style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>ลบ</button>
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

const S = {
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 },
};
