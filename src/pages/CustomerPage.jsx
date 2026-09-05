import React, { useEffect, useState } from "react";
import ThaiAddressFields from "./ThaiAddressFields";
import BirthDateField from "./BirthDateField";

const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const URL_GET    = `${BASE}/moto-sales-get-customers`;
const URL_SAVE   = `${BASE}/moto-sales-save-customer`;
const URL_UPDATE = `${BASE}/moto-sales-update-customer`;
// ลูกค้าที่ลงทะเบียนเองผ่าน LINE (QR/LINE) — ไม่โชว์ทั้งหมด พิมพ์ชื่อบางส่วนแล้วกดค้นหาจึงขึ้น (user 2026-09-04)
const URL_LINE_SEARCH = `${BASE}/booking-deposit-api`; // action: search_customers (source "QR/LINE")
const URL_LINE_UPDATE = `${BASE}/receipt-requests-api`; // action: update_customer — แก้ข้อมูลลูกค้า LINE ในที่เดิม (receipt_requests) ไม่ต้องนำเข้าฐาน (user 2026-09-04)

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
const ID_TYPE_OPTS = ["บัตรประชาชน", "บัตรชมพู", "Passport", "ใบขับขี่", "บัตรนิติบุคคล", "อื่นๆ"]; // บัตรชมพู = บัตรประจำตัวแรงงานต่างด้าว (13 หลัก ขึ้นต้น 00) — user 2026-09-04

export default function CustomerPage({ currentUser }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [lineHits, setLineHits] = useState([]);      // ผลค้นหาลูกค้าจาก LINE (แสดงต่อท้ายตารางเมื่อกดค้นหา)
  const [lineSearching, setLineSearching] = useState(false);
  const [lineEdit, setLineEdit] = useState(null); // {ref_no, customer_name, phone, id_number, address} — แก้ข้อมูลลูกค้า LINE ในที่เดิม
  const [lineSaving, setLineSaving] = useState(false);
  async function saveLineEdit() {
    if (!lineEdit || lineSaving) return;
    if (!String(lineEdit.customer_name || "").trim()) { setMessage("กรุณากรอกชื่อ"); return; }
    setLineSaving(true); setMessage("");
    try {
      const res = await fetch(URL_LINE_UPDATE, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_customer", ref_no: lineEdit.ref_no, customer_name: String(lineEdit.customer_name).trim(),
          phone: String(lineEdit.phone || "").trim(), tax_id: String(lineEdit.id_number || "").trim(), address: String(lineEdit.address || "").trim() }) });
      const d = await res.json().catch(() => null);
      const row = Array.isArray(d) ? d[0] : d;
      if (!row || row.error || !row.ref_no) throw new Error(row?.error || "บันทึกไม่สำเร็จ (ตรวจว่า re-import Receipt_Requests_Workflow แล้ว)");
      setLineHits(hs => hs.map(h => (h.customer_code === lineEdit.ref_no ? { ...h, customer_name: row.customer_name, phone: row.phone, id_number: row.tax_id, address: row.address } : h)));
      setLineEdit(null);
    } catch (e) { setMessage("❌ " + (e.message || "บันทึกไม่สำเร็จ")); }
    setLineSaving(false);
  }
  const digits = (v) => String(v || "").replace(/\D/g, "");

  // กดค้นหา/Enter → ค้นลูกค้าที่ลงทะเบียนเองผ่าน LINE ด้วยคำค้นเดียวกัน (ตัดคนที่มีในฐานลูกค้าแล้ว เทียบเบอร์/เลขบัตร)
  async function searchLine() {
    const kw = search.trim();
    if (kw.length < 2) { setLineHits([]); return; }
    setLineSearching(true);
    try {
      const res = await fetch(URL_LINE_SEARCH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "search_customers", keyword: kw }) });
      const d = await res.json().catch(() => []);
      const known = new Set(customers.flatMap(c => [digits(c.phone), String(c.id_number || "").trim().toUpperCase()]).filter(Boolean));
      const seen = new Set(); const out = [];
      for (const x of (Array.isArray(d) ? d : [])) {
        if (!x || x.source !== "QR/LINE" || !x.customer_name) continue;
        const ph = digits(x.customer_phone), idn = String(x.customer_tax_id || "").trim().toUpperCase();
        if ((ph && known.has(ph)) || (idn && known.has(idn))) continue;
        const k = ph || idn || x.customer_name;
        if (seen.has(k)) continue;
        seen.add(k);
        const addr = String(x.customer_address || "");
        const prov = x.customer_province || (addr.match(/จ(?:ังหวัด|\.)?\s*([ก-๙]+)/) || [])[1] || "";
        out.push({ _line: true, customer_code: x.customer_code, customer_name: x.customer_name, phone: x.customer_phone || "", id_number: x.customer_tax_id || "",
          address: addr, addr_province: prov, contact_date: x.ref_at, line_user_id: x.line_user_id || "" });
      }
      setLineHits(out);
    } catch { setLineHits([]); }
    setLineSearching(false);
  }

  // แยกที่อยู่ที่ลูกค้าพิมพ์บรรทัดเดียว (เช่น "314 m.2 ต.สามเรือน อ.บางปะอิน จ.พระนครศรีอยุธยา 13160") เป็นช่อง ๆ (user 2026-09-04)
  function parseThaiAddress(addr, provHint) {
    const a = String(addr || "").replace(/\s+/g, " ").trim();
    const pick = (re) => { const m = a.match(re); return m ? m[1].trim() : ""; };
    const postal = pick(/(\d{5})(?!\d)\s*$/) || pick(/(\d{5})/);
    let province = pick(/จ(?:ังหวัด|\.)\s*([ก-๙]+)/);
    if (!province && /กรุงเทพ/.test(a)) province = "กรุงเทพมหานคร";
    const district = pick(/(?:อ(?:ำเภอ|\.)|เขต)\s*([ก-๙]+)/);
    const subdistrict = pick(/(?:ต(?:ำบล|\.)|แขวง)\s*([ก-๙]+)/);
    const moo = pick(/(?:หมู่(?:ที่)?|ม\.|m\.?)\s*(\d+)/i);
    const soi = pick(/ซ(?:อย|\.)\s*(\S+)/);
    const road = pick(/ถ(?:นน|\.)\s*(\S+)/);
    // บ้านเลขที่ = ข้อความก่อนคำว่า หมู่/ม./m./ซอย/ถนน/ต./อ./แขวง/เขต/จ.
    const cut = a.search(/\s(?:หมู่|ม\.|m\.?\d|ซ(?:อย|\.)|ถ(?:นน|\.)|ต(?:ำบล|\.)|แขวง|อ(?:ำเภอ|\.)|เขต|จ(?:ังหวัด|\.))/i);
    let house = cut > 0 ? a.slice(0, cut).trim() : (subdistrict || district || province ? "" : a);
    if (!house && !subdistrict && !district) house = a; // แยกไม่ออก → ใส่ทั้งก้อนไว้ช่องบ้านเลขที่ให้แก้เอง
    return { addr_house_no: house, addr_moo: moo, addr_soi: soi, addr_road: road, addr_subdistrict: subdistrict, addr_district: district,
      addr_province: province || provHint || "", addr_postal_code: postal };
  }

  // นำเข้าลูกค้าจาก LINE เข้าฐานลูกค้า: เปิดฟอร์มเพิ่มลูกค้าพร้อมข้อมูลจากที่ลูกค้ากรอก
  function openImportLine(x) {
    const name = String(x.customer_name || "").trim();
    const title = TITLE_OPTS.find(t => name.startsWith(t + " ") || name.startsWith(t)) || (/^(MR|MRS|MISS|MS)\.?\s/i.test(name) ? "อื่นๆ" : "");
    const rest = title && title !== "อื่นๆ" ? name.slice(title.length).trim() : name.replace(/^(MR|MRS|MISS|MS)\.?\s+/i, "").trim();
    const parts = rest.split(/\s+/);
    const idn = String(x.id_number || "").trim();
    setEditTarget(null);
    setForm({
      ...emptyForm(),
      title, first_name: parts[0] || "", last_name: parts.slice(1).join(" "),
      phone: x.phone || "", id_number: idn,
      id_type: idn ? (/^\d{13}$/.test(idn) ? (idn.startsWith("00") ? "บัตรชมพู" : "บัตรประชาชน") : "Passport") : "",
      nationality: /[ก-๙]/.test(rest) ? "ไทย" : "",
      ...parseThaiAddress(x.address, x.addr_province),
      contact_date: x.contact_date ? String(x.contact_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      customer_group: "บุคคลทั่วไป",
    });
    setShowForm(true); setMessage("");
  }

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
        <input value={search} onChange={e => { setSearch(e.target.value); if (!e.target.value.trim()) setLineHits([]); }}
          onKeyDown={e => { if (e.key === "Enter") searchLine(); }}
          placeholder="🔍 ค้นหา ชื่อ / เลขบัตร / เบอร์ / จังหวัด — พิมพ์บางส่วนแล้วกดค้นหา จะรวมลูกค้าที่ลงทะเบียนเองผ่าน LINE ด้วย"
          style={{ flex: 1, padding: "8px 12px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 14 }} />
        <button onClick={searchLine} disabled={lineSearching} className="btn-primary" style={{ padding: "8px 16px" }}>{lineSearching ? "กำลังค้น…" : "🔍 ค้นหา"}</button>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{filtered.length} / {customers.length} รายการ{lineHits.length ? ` · +${lineHits.length} จาก LINE` : ""}</span>
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
              {filtered.length === 0 && lineHits.length === 0 ? (
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
              {/* ลูกค้าที่ลงทะเบียนเองผ่าน LINE (ยังไม่อยู่ในฐานลูกค้า) — ขึ้นเฉพาะตอนกดค้นหา · กด "นำเข้า" เพื่อบันทึกเข้าฐาน */}
              {lineHits.map((x, i) => (
                <tr key={"line-" + (x.customer_code || i)} style={{ background: "#f0fdf4" }}>
                  <td>{filtered.length + i + 1}</td>
                  <td><span style={{ padding: "2px 8px", background: "#dcfce7", color: "#166534", borderRadius: 4, fontSize: 11 }}>LINE ลงทะเบียนเอง</span></td>
                  <td style={{ fontWeight: 600 }}>{x.customer_name}<div style={{ fontSize: 11, color: "#6b7280", fontWeight: 400 }}>{x.customer_code}{x.address ? " · " + x.address : ""}</div></td>
                  <td>-</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{x.id_number || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{x.phone || "-"}</td>
                  <td>{x.addr_province || "-"}</td>
                  <td>{x.contact_date ? String(x.contact_date).slice(0, 10) : "-"}</td>
                  <td><span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, background: "#dcfce7", color: "#166534" }}>ข้อมูล LINE</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => setLineEdit({ ref_no: x.customer_code, customer_name: x.customer_name, phone: x.phone, id_number: x.id_number, address: x.address })}
                      title="แก้ชื่อ/เบอร์/เลขบัตร/ที่อยู่ ในข้อมูลลงทะเบียน LINE (เก็บที่เดิม)"
                      style={{ padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, marginRight: 4 }}>
                      แก้ไข
                    </button>
                    <button onClick={() => openImportLine(x)} title="คัดลอกเข้าฐานข้อมูลลูกค้าของหน้านี้ (ถ้าต้องการ)"
                      style={{ padding: "3px 10px", background: "#fff", color: "#16a34a", border: "1px solid #86efac", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                      นำเข้าฐาน
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* modal แก้ข้อมูลลูกค้า LINE — บันทึกกลับที่เดิม (receipt_requests) ไม่สร้างลูกค้าใหม่ */}
      {lineEdit && (
        <div onClick={() => !lineSaving && setLineEdit(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: 520, maxWidth: "95vw" }}>
            <h3 style={{ margin: "0 0 4px", color: "#166534" }}>✏️ แก้ข้อมูลลูกค้า (ลงทะเบียน LINE)</h3>
            <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 12 }}>รหัส {lineEdit.ref_no} — บันทึกทับข้อมูลที่ลูกค้ากรอกไว้ ใช้กับใบขาย/มัดจำ/ใบเสร็จที่ดึงจาก LINE ต่อไป</div>
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10, alignItems: "center" }}>
              <label>ชื่อ-นามสกุล *</label>
              <input value={lineEdit.customer_name || ""} onChange={e => setLineEdit(v => ({ ...v, customer_name: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8 }} />
              <label>เบอร์โทร</label>
              <input value={lineEdit.phone || ""} onChange={e => setLineEdit(v => ({ ...v, phone: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontFamily: "monospace" }} />
              <label>เลขบัตร/พาสปอร์ต</label>
              <input value={lineEdit.id_number || ""} onChange={e => setLineEdit(v => ({ ...v, id_number: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontFamily: "monospace" }} placeholder="เช่น 0010211920967 (บัตรชมพู) หรือ MI689586" />
              <label>ที่อยู่</label>
              <textarea value={lineEdit.address || ""} onChange={e => setLineEdit(v => ({ ...v, address: e.target.value }))} rows={2} style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={() => setLineEdit(null)} disabled={lineSaving} style={{ padding: "8px 16px", background: "#e5e7eb", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={saveLineEdit} disabled={lineSaving} style={{ padding: "8px 20px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>{lineSaving ? "กำลังบันทึก…" : "💾 บันทึก"}</button>
            </div>
          </div>
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
                  <BirthDateField form={form} setForm={setForm} inp={inp} />
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
                <ThaiAddressFields form={form} setForm={setForm} Field={Field} inp={inp} />
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
