import React, { useState } from "react";

// ============================================================================
// ฟอร์มลูกค้าแบบเต็ม (popup) — ใช้ร่วมกันระหว่างหน้า "ข้อมูลลูกค้า" และ popup เลือกลูกค้า
// props: initial (object สำหรับแก้ไข มี customer_id / null = เพิ่มใหม่), onClose(), onSaved(savedForm)
// ============================================================================
const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const URL_SAVE = `${BASE}/moto-sales-save-customer`;
const URL_UPDATE = `${BASE}/moto-sales-update-customer`;

const emptyForm = () => ({
  customer_group: "", customer_level: "", title: "", contact_date: new Date().toISOString().slice(0, 10),
  is_finance: false, is_insurance: false, first_name: "", nickname: "", show_on_wholesale: false,
  last_name: "", gender: "ชาย", birth_date: "", age: "", nationality: "ไทย", id_type: "", id_number: "",
  id_expiry_date: "", id_issued_by: "", email: "", contact_address_type: "id_card",
  addr_house_no: "", addr_moo: "", addr_village: "", addr_soi: "", addr_road: "", addr_subdistrict: "",
  addr_district: "", addr_province: "", addr_postal_code: "", phone: "", fax: "", status: "active",
});

const TITLE_OPTS = ["นาย", "นาง", "นางสาว", "เด็กชาย", "เด็กหญิง", "บมจ.", "บจก.", "หจก.", "บริษัท", "ห้าง", "อื่นๆ"];
const GROUP_OPTS = ["บุคคลทั่วไป", "บริษัทไฟแนนซ์", "บริษัทประกัน", "ตัวแทนจำหน่าย", "อื่นๆ"];
const LEVEL_OPTS = ["VIP", "ทั่วไป", "ลูกค้าใหม่", "ลูกค้าเก่า"];
const ID_TYPE_OPTS = ["บัตรประชาชน", "Passport", "ใบขับขี่", "บัตรนิติบุคคล", "อื่นๆ"];

function calcAge(birth) {
  if (!birth) return "";
  const m = String(birth).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const today = new Date();
  const b = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  let age = today.getFullYear() - b.getFullYear();
  const md = today.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < b.getDate())) age--;
  return String(age);
}

export default function CustomerFormModal({ initial, onClose, onSaved }) {
  const editTarget = initial && initial.customer_id ? initial : null;
  const [form, setForm] = useState(() =>
    initial ? { ...emptyForm(), ...Object.fromEntries(Object.entries(initial).filter(([, v]) => v !== null)) } : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    if (!form.first_name.trim() && !form.title.trim()) { setMessage("กรุณากรอกชื่อ"); return; }
    setSaving(true); setMessage("");
    try {
      const url = editTarget ? URL_UPDATE : URL_SAVE;
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editTarget ? { customer_id: editTarget.customer_id } : {}), ...form }),
      });
      let saved = form;
      try { const raw = await res.text(); if (raw.trim()) { const j = JSON.parse(raw); saved = { ...form, ...(Array.isArray(j) ? j[0] : j) }; } } catch { /* ignore */ }
      onSaved && onSaved(saved);
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: 16, color: "#072d6b" }}>{editTarget ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มข้อมูลลูกค้า"}</h3>

        <div style={section}>
          <div style={sectionTitle}>≣ ข้อมูลหลัก</div>
          <div style={grid2}>
            <Field label="กลุ่มลูกค้า *"><select value={form.customer_group} onChange={e => setForm({ ...form, customer_group: e.target.value })} style={inp}><option value="">กรุณาเลือก...</option>{GROUP_OPTS.map(g => <option key={g} value={g}>{g}</option>)}</select></Field>
            <Field label="ระดับลูกค้า *"><select value={form.customer_level} onChange={e => setForm({ ...form, customer_level: e.target.value })} style={inp}><option value="">กรุณาเลือก...</option>{LEVEL_OPTS.map(g => <option key={g} value={g}>{g}</option>)}</select></Field>
            <Field label="คำนำหน้าชื่อ *"><select value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inp}><option value="">กรุณาเลือก...</option>{TITLE_OPTS.map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
            <Field label="วันที่ติดต่อ *"><input type="date" value={form.contact_date} onChange={e => setForm({ ...form, contact_date: e.target.value })} style={inp} /></Field>
          </div>
          <div style={{ display: "flex", gap: 24, marginBottom: 8 }}>
            <label style={chk}><input type="checkbox" checked={form.is_finance} onChange={e => setForm({ ...form, is_finance: e.target.checked })} /> เป็นบริษัทไฟแนนซ์</label>
            <label style={chk}><input type="checkbox" checked={form.is_insurance} onChange={e => setForm({ ...form, is_insurance: e.target.checked })} /> เป็นบริษัทประกันภัย</label>
          </div>
          <div style={grid2}>
            <Field label="ชื่อ *"><input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} style={inp} /></Field>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <Field label="ชื่อเล่น" style={{ flex: 1 }}><input value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} style={inp} /></Field>
              <label style={{ ...chk, flex: "0 0 auto", marginBottom: 8 }}><input type="checkbox" checked={form.show_on_wholesale} onChange={e => setForm({ ...form, show_on_wholesale: e.target.checked })} /> แสดงในใบขายส่ง</label>
            </div>
            <Field label="นามสกุล"><input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} style={inp} /></Field>
            <Field label="เพศ"><div style={{ display: "flex", gap: 16, paddingTop: 6 }}>{["ชาย", "หญิง"].map(g => <label key={g} style={chk}><input type="radio" checked={form.gender === g} onChange={() => setForm({ ...form, gender: g })} /> {g}</label>)}</div></Field>
            <Field label="วัน/เดือน/ปี เกิด"><div style={{ display: "flex", gap: 6 }}><input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value, age: calcAge(e.target.value) })} style={{ ...inp, flex: 1 }} /><input value={form.age} readOnly placeholder="อายุ" style={{ ...inp, width: 70, textAlign: "center", background: "#f9fafb" }} /><span style={{ alignSelf: "center", fontSize: 12, color: "#6b7280" }}>ปี/เดือน</span></div></Field>
            <Field label="สัญชาติ"><input value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} style={inp} /></Field>
            <Field label="บัตรแสดงตน *"><select value={form.id_type} onChange={e => setForm({ ...form, id_type: e.target.value })} style={inp}><option value="">กรุณาเลือก...</option>{ID_TYPE_OPTS.map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
            <Field label="เลขที่บัตร *"><input value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value })} style={inp} /></Field>
            <Field label="วันที่หมดอายุ"><input type="date" value={form.id_expiry_date} onChange={e => setForm({ ...form, id_expiry_date: e.target.value })} style={inp} /></Field>
            <Field label="ออกโดย"><input value={form.id_issued_by} onChange={e => setForm({ ...form, id_issued_by: e.target.value })} style={inp} /></Field>
            <Field label="E-mail" full><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inp} /></Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>สถานที่ติดต่อ *</label>
            <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
              {[["id_card", "ที่อยู่ตามบัตร"], ["registered", "ที่อยู่ตามทะเบียนบ้าน"], ["current", "ที่อยู่ปัจจุบัน"], ["work", "ที่ทำงาน"]].map(([val, label]) => (
                <label key={val} style={chk}><input type="radio" checked={form.contact_address_type === val} onChange={() => setForm({ ...form, contact_address_type: val })} /> {label}</label>
              ))}
            </div>
          </div>
        </div>

        <div style={section}>
          <div style={sectionTitle}>≣ ที่อยู่ตามบัตร</div>
          <div style={grid2}>
            <Field label="บ้านเลขที่ *"><input value={form.addr_house_no} onChange={e => setForm({ ...form, addr_house_no: e.target.value })} style={inp} /></Field>
            <Field label="หมู่ที่"><input value={form.addr_moo} onChange={e => setForm({ ...form, addr_moo: e.target.value })} style={inp} /></Field>
            <Field label="หมู่บ้าน/อาคาร"><input value={form.addr_village} onChange={e => setForm({ ...form, addr_village: e.target.value })} style={inp} /></Field>
            <Field label="ซอย"><input value={form.addr_soi} onChange={e => setForm({ ...form, addr_soi: e.target.value })} style={inp} /></Field>
            <Field label="ถนน"><input value={form.addr_road} onChange={e => setForm({ ...form, addr_road: e.target.value })} style={inp} /></Field>
            <Field label="ตำบล/แขวง *"><input value={form.addr_subdistrict} onChange={e => setForm({ ...form, addr_subdistrict: e.target.value })} style={inp} /></Field>
            <Field label="จังหวัด *"><input value={form.addr_province} onChange={e => setForm({ ...form, addr_province: e.target.value })} style={inp} /></Field>
            <Field label="อำเภอ/เขต *"><input value={form.addr_district} onChange={e => setForm({ ...form, addr_district: e.target.value })} style={inp} /></Field>
            <Field label="รหัสไปรษณีย์ *"><input value={form.addr_postal_code} onChange={e => setForm({ ...form, addr_postal_code: e.target.value })} style={inp} /></Field>
            <Field label="โทรศัพท์ *"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inp} /></Field>
            <Field label="โทรสาร"><input value={form.fax} onChange={e => setForm({ ...form, fax: e.target.value })} style={inp} /></Field>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, gap: 16 }}>
          <div style={{ display: "flex", gap: 16 }}>
            {[["active", "ใช้งาน"], ["inactive", "ไม่ใช้งาน"]].map(([val, label]) => (
              <label key={val} style={chk}><input type="radio" checked={form.status === val} onChange={() => setForm({ ...form, status: val })} /> {label}</label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "9px 24px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>ยกเลิก</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: "9px 28px", background: saving ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600 }}>{saving ? "กำลังบันทึก..." : "💾 บันทึก"}</button>
          </div>
        </div>
        {message && <div style={{ color: "#ef4444", marginTop: 10, fontSize: 13 }}>{message}</div>}
      </div>
    </div>
  );
}

function Field({ label, children, full, style }) {
  return (
    <div style={{ marginBottom: 10, gridColumn: full ? "span 2" : undefined, ...style }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1100, padding: "40px 20px", overflowY: "auto" };
const box = { background: "#fff", borderRadius: 12, padding: 22, width: "min(900px, 96vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" };
const inp = { width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px", marginBottom: 8 };
const section = { padding: 14, background: "#f9fafb", borderRadius: 10, marginBottom: 14, border: "1px solid #e5e7eb" };
const sectionTitle = { fontSize: 13, fontWeight: 700, color: "#0891b2", marginBottom: 10 };
const chk = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500 };
