import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

const BANKS = [
  "กสิกรไทย",
  "ไทยพาณิชย์",
  "กรุงเทพ",
  "กรุงไทย",
  "กรุงศรีอยุธยา",
  "ทหารไทยธนชาต (ttb)",
  "ออมสิน",
  "ธ.ก.ส.",
  "ซีไอเอ็มบี ไทย",
  "ยูโอบี",
  "เกียรตินาคิน",
  "แลนด์แอนด์เฮ้าส์",
];

const WHT_TYPES = [
  "ค่าบริการ (3%)",
  "ค่าโฆษณา (2%)",
  "ค่าเช่า (5%)",
  "ค่าวิชาชีพอิสระ (3%)",
  "ค่าขนส่ง (1%)",
  "ดอกเบี้ย (15%)",
  "ค่าเบี้ยประกัน (1%)",
  "อื่นๆ",
];

const emptyForm = () => ({
  vendor_name: "",
  tax_id: "",
  branch_type: "สำนักงานใหญ่",
  address: "",
  sub_district: "",
  district: "",
  province: "",
  postal_code: "",
  contact_name: "",
  phone: "",
  email: "",
  bank_name: "",
  bank_branch: "",
  bank_account_no: "",
  bank_account_name: "",
  wht_type: "",
  wht_rate: "",
  note: "",
  status: "active",
});

export default function SupplierPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [message, setMessage] = useState("");
  const [detailRow, setDetailRow] = useState(null);

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [includeInactive]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_vendors", include_inactive: String(includeInactive) }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); setRows([]); }
    setLoading(false);
  }

  async function handleSave() {
    if (!form.vendor_name.trim()) { setMessage("❌ กรุณากรอกชื่อ Supplier"); return; }
    if (form.tax_id && !/^\d{13}$/.test(form.tax_id.replace(/[\s-]/g, ""))) {
      setMessage("❌ เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก"); return;
    }
    setSaving(true); setMessage("");
    try {
      const payload = {
        action: editTarget ? "update_vendor" : "save_vendor",
        ...(editTarget ? { vendor_id: editTarget.vendor_id } : {}),
        ...form,
        tax_id: form.tax_id.replace(/[\s-]/g, ""),
      };
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setShowForm(false);
      setEditTarget(null);
      setForm(emptyForm());
      setMessage(`✅ ${editTarget ? "แก้ไข" : "เพิ่ม"} Supplier สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function handleDelete(v) {
    if (!window.confirm(`ปิดการใช้งาน Supplier "${v.vendor_name}"?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_vendor", vendor_id: v.vendor_id }),
      });
      setMessage(`✅ ปิดใช้งาน "${v.vendor_name}" แล้ว`);
      fetchData();
    } catch { setMessage("❌ ปิดไม่สำเร็จ"); }
  }

  async function handleReactivate(v) {
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_vendor", vendor_id: v.vendor_id, status: "active" }),
      });
      setMessage(`✅ เปิดใช้งาน "${v.vendor_name}" แล้ว`);
      fetchData();
    } catch { setMessage("❌ เปิดไม่สำเร็จ"); }
  }

  function openEdit(v) {
    setForm({
      vendor_name: v.vendor_name || "",
      tax_id: v.tax_id || "",
      branch_type: v.branch_type || "สำนักงานใหญ่",
      address: v.address || "",
      sub_district: v.sub_district || "",
      district: v.district || "",
      province: v.province || "",
      postal_code: v.postal_code || "",
      contact_name: v.contact_name || "",
      phone: v.phone || "",
      email: v.email || "",
      bank_name: v.bank_name || "",
      bank_branch: v.bank_branch || "",
      bank_account_no: v.bank_account_no || "",
      bank_account_name: v.bank_account_name || "",
      wht_type: v.wht_type || "",
      wht_rate: v.wht_rate || "",
      note: v.note || "",
      status: v.status || "active",
    });
    setEditTarget(v);
    setShowForm(true);
  }

  function openAdd() {
    setForm(emptyForm());
    setEditTarget(null);
    setShowForm(true);
  }

  function fmtTaxId(t) {
    if (!t) return "-";
    const s = String(t).replace(/\D/g, "");
    if (s.length !== 13) return t;
    return `${s.slice(0, 1)}-${s.slice(1, 5)}-${s.slice(5, 10)}-${s.slice(10, 12)}-${s.slice(12)}`;
  }
  function fmtAccount(a) {
    if (!a) return "-";
    const s = String(a).replace(/\D/g, "");
    if (s.length === 10) return `${s.slice(0, 3)}-${s.slice(3, 4)}-${s.slice(4, 9)}-${s.slice(9)}`;
    return a;
  }

  // local filter
  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!kw) return true;
    const hay = [r.vendor_name, r.tax_id, r.contact_name, r.phone, r.bank_account_no, r.province]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🏢 Supplier (ผู้ขาย)</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <input type="text" placeholder="🔍 ค้นหา (ชื่อ, เลขผู้เสียภาษี, ผู้ติดต่อ, เบอร์, เลขบัญชี)"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 280 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          แสดงที่ปิดการใช้งาน
        </label>
        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 16px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          🔄 รีเฟรช
        </button>
        <button onClick={openAdd}
          style={{ padding: "7px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
          ➕ เพิ่ม Supplier
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>ชื่อ Supplier</th>
                <th style={th}>เลขผู้เสียภาษี</th>
                <th style={th}>สาขา</th>
                <th style={th}>ผู้ติดต่อ / เบอร์</th>
                <th style={th}>ธนาคาร / เลขบัญชี</th>
                <th style={th}>หักณที่จ่าย</th>
                <th style={th}>สถานะ</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.vendor_id} style={{ borderTop: "1px solid #e5e7eb", opacity: r.status === "inactive" ? 0.5 : 1 }}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.vendor_name}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{fmtTaxId(r.tax_id)}</td>
                  <td style={td}>{r.branch_type || "-"}</td>
                  <td style={td}>
                    <div>{r.contact_name || "-"}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{r.phone || ""}</div>
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: 12 }}>{r.bank_name || "-"} {r.bank_branch ? `· ${r.bank_branch}` : ""}</div>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#0369a1" }}>{fmtAccount(r.bank_account_no)}</div>
                  </td>
                  <td style={td}>
                    {r.wht_type ? (
                      <div>
                        <div style={{ fontSize: 11 }}>{r.wht_type}</div>
                        <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>{r.wht_rate || "-"}%</div>
                      </div>
                    ) : "-"}
                  </td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: r.status === "active" ? "#d1fae5" : "#fee2e2", color: r.status === "active" ? "#065f46" : "#991b1b" }}>
                      {r.status === "active" ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td style={td}>
                    <button onClick={() => setDetailRow(r)} style={btnView}>ดู</button>
                    <button onClick={() => openEdit(r)} style={btnEdit}>✏️</button>
                    {r.status === "active"
                      ? <button onClick={() => handleDelete(r)} style={btnDelete}>ปิด</button>
                      : <button onClick={() => handleReactivate(r)} style={btnReact}>เปิด</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail popup */}
      {detailRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setDetailRow(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 700, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>📋 {detailRow.vendor_name}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <KV label="เลขผู้เสียภาษี" value={fmtTaxId(detailRow.tax_id)} mono />
              <KV label="สาขา" value={detailRow.branch_type} />
              <KV label="ผู้ติดต่อ" value={detailRow.contact_name} />
              <KV label="เบอร์โทร" value={detailRow.phone} />
              <KV label="อีเมล" value={detailRow.email} />
              <div style={{ gridColumn: "span 2" }}>
                <span style={{ color: "#6b7280", fontSize: 11 }}>ที่อยู่</span>
                <div style={{ fontWeight: 600 }}>{detailRow.address || "-"} {detailRow.sub_district || ""} {detailRow.district || ""} {detailRow.province || ""} {detailRow.postal_code || ""}</div>
              </div>
            </div>

            <h4 style={{ margin: "16px 0 8px", color: "#072d6b" }}>💳 บัญชีธนาคาร</h4>
            <div style={{ background: "#f0f4f9", padding: 10, borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <KV label="ธนาคาร" value={detailRow.bank_name} />
              <KV label="สาขา" value={detailRow.bank_branch} />
              <KV label="ชื่อบัญชี" value={detailRow.bank_account_name} />
              <KV label="เลขที่บัญชี" value={fmtAccount(detailRow.bank_account_no)} mono />
            </div>

            <h4 style={{ margin: "16px 0 8px", color: "#072d6b" }}>🧾 หักณที่จ่าย</h4>
            <div style={{ background: "#fef3c7", padding: 10, borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <KV label="ประเภท" value={detailRow.wht_type} />
              <KV label="อัตรา" value={detailRow.wht_rate ? detailRow.wht_rate + "%" : ""} />
            </div>

            {detailRow.note && (
              <div style={{ marginTop: 12, padding: 10, background: "#f8fafc", borderRadius: 8, fontSize: 13 }}>
                <strong>หมายเหตุ:</strong> {detailRow.note}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setDetailRow(null)} style={{ padding: "8px 16px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 800, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>{editTarget ? "✏️ แก้ไข Supplier" : "➕ เพิ่ม Supplier ใหม่"}</h3>

            <Section title="ข้อมูลผู้ขาย">
              <div style={grid2}>
                <Field label="ชื่อ Supplier" required>
                  <input value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} style={inp} />
                </Field>
                <Field label="เลขประจำตัวผู้เสียภาษี (13 หลัก)">
                  <input value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value.replace(/[^\d]/g, "").slice(0, 13) }))} maxLength={13} style={{ ...inp, fontFamily: "monospace" }} placeholder="0000000000000" />
                </Field>
                <Field label="สำนักงาน/สาขา">
                  <select value={form.branch_type} onChange={e => setForm(f => ({ ...f, branch_type: e.target.value }))} style={inp}>
                    <option value="สำนักงานใหญ่">สำนักงานใหญ่</option>
                    <option value="สาขา">สาขา</option>
                  </select>
                </Field>
                <Field label="ผู้ติดต่อ">
                  <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} style={inp} />
                </Field>
                <Field label="เบอร์โทร">
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={inp} />
                </Field>
                <Field label="อีเมล">
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} />
                </Field>
              </div>
            </Section>

            <Section title="ที่อยู่">
              <Field label="เลขที่ / ถนน / ซอย">
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={inp} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 6 }}>
                <Field label="ตำบล/แขวง">
                  <input value={form.sub_district} onChange={e => setForm(f => ({ ...f, sub_district: e.target.value }))} style={inp} />
                </Field>
                <Field label="อำเภอ/เขต">
                  <input value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} style={inp} />
                </Field>
                <Field label="จังหวัด">
                  <input value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} style={inp} />
                </Field>
                <Field label="รหัสไปรษณีย์">
                  <input value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value.replace(/\D/g, "").slice(0, 5) }))} maxLength={5} style={inp} />
                </Field>
              </div>
            </Section>

            <Section title="💳 บัญชีธนาคาร (สำหรับโอนเงิน)">
              <div style={grid2}>
                <Field label="ธนาคาร">
                  <input list="banks-list" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} style={inp} />
                  <datalist id="banks-list">{BANKS.map(b => <option key={b} value={b} />)}</datalist>
                </Field>
                <Field label="สาขา">
                  <input value={form.bank_branch} onChange={e => setForm(f => ({ ...f, bank_branch: e.target.value }))} style={inp} />
                </Field>
                <Field label="ชื่อบัญชี">
                  <input value={form.bank_account_name} onChange={e => setForm(f => ({ ...f, bank_account_name: e.target.value }))} style={inp} />
                </Field>
                <Field label="เลขที่บัญชี">
                  <input value={form.bank_account_no} onChange={e => setForm(f => ({ ...f, bank_account_no: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                </Field>
              </div>
            </Section>

            <Section title="🧾 หักณที่จ่าย">
              <div style={grid2}>
                <Field label="ประเภทรายได้">
                  <input list="wht-list" value={form.wht_type} onChange={e => setForm(f => ({ ...f, wht_type: e.target.value }))} style={inp} placeholder="เช่น ค่าบริการ, ค่าเช่า..." />
                  <datalist id="wht-list">{WHT_TYPES.map(t => <option key={t} value={t} />)}</datalist>
                </Field>
                <Field label="อัตรา %">
                  <input type="number" step="0.01" min="0" max="100" value={form.wht_rate} onChange={e => setForm(f => ({ ...f, wht_rate: e.target.value }))} style={inp} placeholder="3" />
                </Field>
              </div>
            </Section>

            <Section title="อื่นๆ">
              <Field label="หมายเหตุ">
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical" }} />
              </Field>
              <Field label="สถานะ">
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...inp, marginTop: 4 }}>
                  <option value="active">ใช้งาน</option>
                  <option value="inactive">ปิด</option>
                </select>
              </Field>
            </Section>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setShowForm(false)} disabled={saving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving || !form.vendor_name.trim()}
                style={{ padding: "8px 20px", background: saving ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 12, padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#072d6b", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children, required }) {
  return (
    <div>
      <label style={lbl}>{label}{required ? " *" : ""}</label>
      {children}
    </div>
  );
}

function KV({ label, value, mono }) {
  return (
    <div>
      <div style={{ color: "#6b7280", fontSize: 11 }}>{label}</div>
      <div style={{ fontWeight: 600, fontFamily: mono ? "monospace" : "inherit" }}>{value || "-"}</div>
    </div>
  );
}

const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3, color: "#374151" };
const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box", width: "100%" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "10px 8px", fontSize: 13 };
const btnView = { padding: "4px 10px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnEdit = { padding: "4px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnDelete = { padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
const btnReact = { padding: "4px 10px", background: "#059669", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 };
