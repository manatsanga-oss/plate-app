import React, { useEffect, useState } from "react";

const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const URL_GET    = `${BASE}/moto-sales-get-customers`;
const URL_SAVE   = `${BASE}/moto-sales-save-customer`;
const URL_UPDATE = `${BASE}/moto-sales-update-customer`;

const emptyForm = () => ({
  // ข้อมูลหลัก
  customer_group: "",
  customer_level: "",
  title: "",
  contact_date: new Date().toISOString().slice(0, 10),
  is_finance: false,
  is_insurance: false,
  first_name: "",
  nickname: "",
  show_on_wholesale: false,
  last_name: "",
  gender: "ชาย",
  birth_date: "",
  age: "",
  nationality: "ไทย",
  id_type: "",
  id_number: "",
  id_expiry_date: "",
  id_issued_by: "",
  email: "",
  contact_address_type: "id_card",
  // ที่อยู่ตามบัตร
  addr_house_no: "",
  addr_moo: "",
  addr_village: "",
  addr_soi: "",
  addr_road: "",
  addr_subdistrict: "",
  addr_district: "",
  addr_province: "",
  addr_postal_code: "",
  phone: "",
  fax: "",
  status: "active",
});

const TITLE_OPTS = ["นาย", "นาง", "นางสาว", "เด็กชาย", "เด็กหญิง", "บมจ.", "บจก.", "หจก.", "บริษัท", "ห้าง", "อื่นๆ"];
const GROUP_OPTS = ["บุคคลทั่วไป", "บริษัทไฟแนนซ์", "บริษัทประกัน", "ตัวแทนจำหน่าย", "อื่นๆ"];
const LEVEL_OPTS = ["VIP", "ทั่วไป", "ลูกค้าใหม่", "ลูกค้าเก่า"];
const ID_TYPE_OPTS = ["บัตรประชาชน", "Passport", "ใบขับขี่", "บัตรนิติบุคคล", "อื่นๆ"];

export default function CustomerPage({ currentUser }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => { fetchCustomers(); }, []);

  async function fetchCustomers() {
    setLoading(true);
    try {
      const res = await fetch(URL_GET, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch { setMessage("โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.first_name.trim() && !form.title.trim()) {
      setMessage("กรุณากรอกชื่อ"); return;
    }
    setSaving(true); setMessage("");
    try {
      const url = editTarget ? URL_UPDATE : URL_SAVE;
      await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editTarget ? { customer_id: editTarget.customer_id } : {}),
          ...form,
        }),
      });
      setShowForm(false); setEditTarget(null); setForm(emptyForm());
      fetchCustomers();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  function openAdd() {
    setEditTarget(null); setForm(emptyForm()); setShowForm(true); setMessage("");
  }

  function openEdit(c) {
    setEditTarget(c);
    setForm({ ...emptyForm(), ...Object.fromEntries(Object.entries(c).filter(([k, v]) => v !== null)) });
    setShowForm(true); setMessage("");
  }

  // คำนวณอายุจากวันเกิด
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

  const kw = search.trim().toLowerCase();
  const filtered = customers.filter(c => {
    if (!kw) return true;
    const hay = [c.first_name, c.last_name, c.nickname, c.id_number, c.phone, c.email,
      c.customer_group, c.addr_province, c.addr_district].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  function fullName(c) {
    return [c.title, c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "-";
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">👤 ข้อมูลลูกค้า</h2>
        <button className="btn-primary" onClick={openAdd}>+ เพิ่มลูกค้า</button>
      </div>

      <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา ชื่อ / เลขบัตร / เบอร์ / จังหวัด"
          style={{ flex: 1, padding: "8px 12px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 14 }} />
        <span style={{ fontSize: 12, color: "#6b7280" }}>{filtered.length} / {customers.length} รายการ</span>
      </div>

      {message && <div style={{ color: "#ef4444", marginBottom: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>{message}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px rgba(7,45,107,0.08)" }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>#</th>
                <th>กลุ่มลูกค้า</th>
                <th>ชื่อ-นามสกุล</th>
                <th>ชื่อเล่น</th>
                <th>เลขบัตร</th>
                <th>โทรศัพท์</th>
                <th>จังหวัด</th>
                <th>วันที่ติดต่อ</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>ยังไม่มีข้อมูลลูกค้า</td></tr>
              ) : filtered.map((c, i) => (
                <tr key={c.customer_id || i}>
                  <td>{i + 1}</td>
                  <td>{c.customer_group ? <span style={{ padding: "2px 8px", background: "#dbeafe", color: "#1e40af", borderRadius: 4, fontSize: 11 }}>{c.customer_group}</span> : "-"}</td>
                  <td style={{ fontWeight: 600 }}>{fullName(c)}</td>
                  <td>{c.nickname || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.id_number || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.phone || "-"}</td>
                  <td>{c.addr_province || "-"}</td>
                  <td>{c.contact_date ? String(c.contact_date).slice(0, 10) : "-"}</td>
                  <td>
                    <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12,
                      background: c.status === "active" ? "#d1fae5" : "#f3f4f6",
                      color: c.status === "active" ? "#065f46" : "#6b7280" }}>
                      {c.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => openEdit(c)}
                      style={{ padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 22, width: "min(900px, 96vw)", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: "#072d6b" }}>{editTarget ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มข้อมูลลูกค้า"}</h3>

            {/* ── ข้อมูลหลัก ── */}
            <div style={section}>
              <div style={sectionTitle}>≣ ข้อมูลหลัก</div>
              <div style={grid2}>
                <Field label="กลุ่มลูกค้า *" required>
                  <select value={form.customer_group} onChange={e => setForm({ ...form, customer_group: e.target.value })} style={inp}>
                    <option value="">กรุณาเลือก...</option>
                    {GROUP_OPTS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="ระดับลูกค้า *">
                  <select value={form.customer_level} onChange={e => setForm({ ...form, customer_level: e.target.value })} style={inp}>
                    <option value="">กรุณาเลือก...</option>
                    {LEVEL_OPTS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="คำนำหน้าชื่อ *">
                  <select value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inp}>
                    <option value="">กรุณาเลือก...</option>
                    {TITLE_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="วันที่ติดต่อ *">
                  <input type="date" value={form.contact_date} onChange={e => setForm({ ...form, contact_date: e.target.value })} style={inp} />
                </Field>
              </div>
              <div style={{ display: "flex", gap: 24, marginBottom: 8 }}>
                <label style={chk}>
                  <input type="checkbox" checked={form.is_finance} onChange={e => setForm({ ...form, is_finance: e.target.checked })} />
                  เป็นบริษัทไฟแนนซ์
                </label>
                <label style={chk}>
                  <input type="checkbox" checked={form.is_insurance} onChange={e => setForm({ ...form, is_insurance: e.target.checked })} />
                  เป็นบริษัทประกันภัย
                </label>
              </div>
              <div style={grid2}>
                <Field label="ชื่อ *" required>
                  <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} style={inp} />
                </Field>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <Field label="ชื่อเล่น" style={{ flex: 1 }}>
                    <input value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} style={inp} />
                  </Field>
                  <label style={{ ...chk, flex: "0 0 auto", marginBottom: 8 }}>
                    <input type="checkbox" checked={form.show_on_wholesale} onChange={e => setForm({ ...form, show_on_wholesale: e.target.checked })} />
                    แสดงในใบขายส่ง
                  </label>
                </div>
                <Field label="นามสกุล">
                  <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} style={inp} />
                </Field>
                <Field label="เพศ">
                  <div style={{ display: "flex", gap: 16, paddingTop: 6 }}>
                    {["ชาย", "หญิง"].map(g => (
                      <label key={g} style={chk}>
                        <input type="radio" checked={form.gender === g} onChange={() => setForm({ ...form, gender: g })} /> {g}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="วัน/เดือน/ปี เกิด">
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="date" value={form.birth_date}
                      onChange={e => setForm({ ...form, birth_date: e.target.value, age: calcAge(e.target.value) })}
                      style={{ ...inp, flex: 1 }} />
                    <input value={form.age} readOnly placeholder="อายุ" style={{ ...inp, width: 70, textAlign: "center", background: "#f9fafb" }} />
                    <span style={{ alignSelf: "center", fontSize: 12, color: "#6b7280" }}>ปี/เดือน</span>
                  </div>
                </Field>
                <Field label="สัญชาติ">
                  <input value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} style={inp} />
                </Field>
                <Field label="บัตรแสดงตน *">
                  <select value={form.id_type} onChange={e => setForm({ ...form, id_type: e.target.value })} style={inp}>
                    <option value="">กรุณาเลือก...</option>
                    {ID_TYPE_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="เลขที่บัตร *">
                  <input value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value })} style={inp} />
                </Field>
                <Field label="วันที่หมดอายุ">
                  <input type="date" value={form.id_expiry_date} onChange={e => setForm({ ...form, id_expiry_date: e.target.value })} style={inp} />
                </Field>
                <Field label="ออกโดย">
                  <input value={form.id_issued_by} onChange={e => setForm({ ...form, id_issued_by: e.target.value })} style={inp} />
                </Field>
                <Field label="E-mail" full>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inp} />
                </Field>
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>สถานที่ติดต่อ *</label>
                <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
                  {[
                    ["id_card", "ที่อยู่ตามบัตร"],
                    ["registered", "ที่อยู่ตามทะเบียนบ้าน"],
                    ["current", "ที่อยู่ปัจจุบัน"],
                    ["work", "ที่ทำงาน"],
                  ].map(([val, label]) => (
                    <label key={val} style={chk}>
                      <input type="radio" checked={form.contact_address_type === val} onChange={() => setForm({ ...form, contact_address_type: val })} /> {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* ── ที่อยู่ตามบัตร ── */}
            <div style={section}>
              <div style={sectionTitle}>≣ ที่อยู่ตามบัตร</div>
              <div style={grid2}>
                <Field label="บ้านเลขที่ *" required>
                  <input value={form.addr_house_no} onChange={e => setForm({ ...form, addr_house_no: e.target.value })} style={inp} />
                </Field>
                <Field label="หมู่ที่">
                  <input value={form.addr_moo} onChange={e => setForm({ ...form, addr_moo: e.target.value })} style={inp} />
                </Field>
                <Field label="หมู่บ้าน/อาคาร">
                  <input value={form.addr_village} onChange={e => setForm({ ...form, addr_village: e.target.value })} style={inp} />
                </Field>
                <Field label="ซอย">
                  <input value={form.addr_soi} onChange={e => setForm({ ...form, addr_soi: e.target.value })} style={inp} />
                </Field>
                <Field label="ถนน">
                  <input value={form.addr_road} onChange={e => setForm({ ...form, addr_road: e.target.value })} style={inp} />
                </Field>
                <Field label="ตำบล/แขวง *">
                  <input value={form.addr_subdistrict} onChange={e => setForm({ ...form, addr_subdistrict: e.target.value })} style={inp} />
                </Field>
                <Field label="จังหวัด *">
                  <input value={form.addr_province} onChange={e => setForm({ ...form, addr_province: e.target.value })} style={inp} />
                </Field>
                <Field label="อำเภอ/เขต *">
                  <input value={form.addr_district} onChange={e => setForm({ ...form, addr_district: e.target.value })} style={inp} />
                </Field>
                <Field label="รหัสไปรษณีย์ *">
                  <input value={form.addr_postal_code} onChange={e => setForm({ ...form, addr_postal_code: e.target.value })} style={inp} />
                </Field>
                <Field label="โทรศัพท์ *">
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inp} />
                </Field>
                <Field label="โทรสาร">
                  <input value={form.fax} onChange={e => setForm({ ...form, fax: e.target.value })} style={inp} />
                </Field>
              </div>
            </div>

            {/* ── สถานะ + ปุ่ม ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, gap: 16 }}>
              <div style={{ display: "flex", gap: 16 }}>
                {[["active", "ใช้งาน"], ["inactive", "ไม่ใช้งาน"]].map(([val, label]) => (
                  <label key={val} style={chk}>
                    <input type="radio" checked={form.status === val} onChange={() => setForm({ ...form, status: val })} /> {label}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setShowForm(false); setMessage(""); }}
                  style={{ padding: "9px 24px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
                  ยกเลิก
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: "9px 28px", background: saving ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600 }}>
                  {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
                </button>
              </div>
            </div>

            {message && <div style={{ color: "#ef4444", marginTop: 10, fontSize: 13 }}>{message}</div>}
          </div>
        </div>
      )}
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

const inp = { width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px", marginBottom: 8 };
const section = { padding: 14, background: "#f9fafb", borderRadius: 10, marginBottom: 14, border: "1px solid #e5e7eb" };
const sectionTitle = { fontSize: 13, fontWeight: 700, color: "#0891b2", marginBottom: 10 };
const chk = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500 };
