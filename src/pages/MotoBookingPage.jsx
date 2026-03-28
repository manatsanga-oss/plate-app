import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/moto-booking-api";

const BRANCHES = [
  "SCY01 สำนักงานใหญ่",
  "SCY05 ป.เปา นครหลวง",
  "SCY06 ป.เปา วังน้อย",
  "SCY07 สิงห์ชัย ตลาด",
];

const BRANDS = ["ออนด้า", "ยามาฮ่า"];
const PURCHASE_TYPES = ["สด", "ผ่อน"];

const STATUS_LABEL = { จอง: "จอง", ขาย: "ขาย", ยกเลิก: "ยกเลิก" };
const STATUS_COLOR = { จอง: "#f59e0b", ขาย: "#10b981", ยกเลิก: "#6b7280" };

const emptyForm = () => ({
  branch: "",
  brand: "",
  marketing_name: "",
  model_code: "",
  color_name: "",
  customer_name: "",
  customer_phone: "",
  purchase_type: "",
  deposit_no: "",
  finance_company: "",
});

export default function MotoBookingPage({ currentUser }) {
  const [mode, setMode] = useState("list"); // list | add | change
  const [bookings, setBookings] = useState([]);
  const [allModels, setAllModels] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBranch, setFilterBranch] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [changeTarget, setChangeTarget] = useState(null);
  const [changeForm, setChangeForm] = useState({ model_code: "", color_name: "" });
  const [sellTarget, setSellTarget] = useState(null);

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    fetchBookings();
    fetchAllModels();
  }, []);

  async function fetchBookings() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_moto_bookings",
          branch: isAdmin ? null : currentUser?.branch,
        }),
      });
      const data = await res.json();
      setBookings(Array.isArray(data) ? data : []);
    } catch {
      setMessage("โหลดข้อมูลไม่สำเร็จ");
    }
    setLoading(false);
  }

  async function fetchAllModels() {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_moto_models" }),
      });
      const data = await res.json();
      setAllModels(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }

  // cascade filter helpers
  const modelsByBrand = (brand) =>
    [...new Map(
      allModels.filter(m => !brand || m.brand === brand)
        .map(m => [m.marketing_name, m])
    ).values()];

  const codesByBrandModel = (brand, mName) =>
    [...new Map(
      allModels.filter(m => (!brand || m.brand === brand) && (!mName || m.marketing_name === mName))
        .map(m => [m.model_code, m])
    ).values()];

  const colorsByCode = (brand, mName, code) =>
    allModels.filter(m =>
      (!brand || m.brand === brand) &&
      (!mName || m.marketing_name === mName) &&
      (!code || m.model_code === code)
    );

  async function handleSave() {
    if (!form.branch || !form.brand || !form.model_code || !form.color_name || !form.customer_name || !form.customer_phone || !form.purchase_type) {
      setMessage("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_moto_booking", ...form }),
      });
      const data = await res.json();
      if (data?.booking_id || data?.success) {
        setForm(emptyForm());
        setMode("list");
        fetchBookings();
      } else {
        setMessage("บันทึกไม่สำเร็จ: " + (data?.message || ""));
      }
    } catch {
      setMessage("เกิดข้อผิดพลาด");
    }
    setSaving(false);
  }

  async function handleSell() {
    if (!sellTarget) return;
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sell_moto_booking", booking_id: sellTarget.booking_id }),
      });
      setSellTarget(null);
      fetchBookings();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_moto_booking", booking_id: cancelTarget.booking_id, cancel_reason: cancelReason }),
      });
      setCancelTarget(null);
      setCancelReason("");
      fetchBookings();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function handleChangeModel() {
    if (!changeTarget || !changeForm.model_code || !changeForm.color_name) {
      setMessage("กรุณาเลือกแบบและสีใหม่");
      return;
    }
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_moto_model", booking_id: changeTarget.booking_id, ...changeForm }),
      });
      setChangeTarget(null);
      setChangeForm({ model_code: "", color_name: "" });
      fetchBookings();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  const filtered = bookings.filter((b) => {
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (filterBranch && b.branch !== filterBranch) return false;
    if (filterDate && b.booking_date && b.booking_date.slice(0, 10) !== filterDate) return false;
    return true;
  });

  /* ── ADD FORM ── */
  if (mode === "add") {
    const models = modelsByBrand(form.brand);
    const codes = codesByBrandModel(form.brand, form.marketing_name);
    const colors = colorsByCode(form.brand, form.marketing_name, form.model_code);

    return (
      <div className="page-container">
        <div className="page-topbar">
          <h2 className="page-title">🏍️ จองรถจักรยานยนต์</h2>
          <button className="btn-secondary" onClick={() => { setMode("list"); setMessage(""); }}>← กลับ</button>
        </div>
        <div className="form-card" style={{ maxWidth: 600 }}>
          <h3 style={{ marginTop: 0 }}>แบบฟอร์มจองรถ</h3>

          <div className="form-row">
            <label>สาขา <span style={{ color: "#ef4444" }}>*</span></label>
            <select className="form-input" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              <option value="">-- เลือกสาขา --</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="form-row">
            <label>ยี่ห้อ <span style={{ color: "#ef4444" }}>*</span></label>
            <select className="form-input" value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value, marketing_name: "", model_code: "", color_name: "" })}>
              <option value="">-- เลือกยี่ห้อ --</option>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="form-row">
            <label>ชื่อทางการตลาด</label>
            <select className="form-input" value={form.marketing_name}
              onChange={(e) => setForm({ ...form, marketing_name: e.target.value, model_code: "", color_name: "" })}>
              <option value="">-- เลือกชื่อรุ่น --</option>
              {models.map(m => <option key={m.marketing_name} value={m.marketing_name}>{m.marketing_name}</option>)}
            </select>
          </div>

          <div className="form-row">
            <label>แบบ (Model Code) <span style={{ color: "#ef4444" }}>*</span></label>
            <select className="form-input" value={form.model_code}
              onChange={(e) => setForm({ ...form, model_code: e.target.value, color_name: "" })}>
              <option value="">-- เลือกแบบ --</option>
              {codes.map(m => <option key={m.model_code} value={m.model_code}>{m.model_code}</option>)}
            </select>
          </div>

          <div className="form-row">
            <label>สี <span style={{ color: "#ef4444" }}>*</span></label>
            <select className="form-input" value={form.color_name}
              onChange={(e) => setForm({ ...form, color_name: e.target.value })}>
              <option value="">-- เลือกสี --</option>
              {colors.map(m => <option key={m.color_code} value={m.color_name}>{m.color_name}</option>)}
            </select>
          </div>

          <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />

          <div className="form-row">
            <label>ชื่อลูกค้า <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="form-input" value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              placeholder="ชื่อ-นามสกุลลูกค้า" />
          </div>

          <div className="form-row">
            <label>เบอร์โทรศัพท์ <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="form-input" value={form.customer_phone} type="tel"
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              placeholder="0xx-xxx-xxxx" />
          </div>

          <div className="form-row">
            <label>ประเภทการซื้อ <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ display: "flex", gap: 24, marginTop: 4 }}>
              {PURCHASE_TYPES.map(t => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: "normal" }}>
                  <input type="radio" name="purchase_type" value={t}
                    checked={form.purchase_type === t}
                    onChange={(e) => setForm({ ...form, purchase_type: e.target.value })} />
                  {t}
                </label>
              ))}
            </div>
          </div>

          {form.purchase_type === "ผ่อน" && (
            <div className="form-row">
              <label>ไฟแนนท์</label>
              <input className="form-input" value={form.finance_company}
                onChange={(e) => setForm({ ...form, finance_company: e.target.value })}
                placeholder="ชื่อบริษัทไฟแนนท์" />
            </div>
          )}

          <div className="form-row">
            <label>เลขที่ใบมัดจำ</label>
            <input className="form-input" value={form.deposit_no}
              onChange={(e) => setForm({ ...form, deposit_no: e.target.value })}
              placeholder="เลขที่ใบมัดจำ" />
          </div>

          {message && <div className="form-message">{message}</div>}

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "💾 บันทึกการจอง"}
            </button>
            <button className="btn-secondary" onClick={() => { setMode("list"); setMessage(""); }}>ยกเลิก</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── LIST ── */
  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🏍️ ระบบจองรถจักรยานยนต์</h2>
        <button className="btn-primary" onClick={() => { setForm(emptyForm()); setMode("add"); setMessage(""); }}>
          + จองรถ
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 14, color: "#374151", whiteSpace: "nowrap" }}>📅 วันที่จอง</label>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "Tahoma" }} />
          {filterDate && (
            <button onClick={() => setFilterDate("")}
              style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#e5e7eb", cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
              ✕
            </button>
          )}
        </div>

        {isAdmin && (
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "Tahoma" }}>
            <option value="">ทุกสาขา</option>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}

        <div style={{ width: 1, background: "#e5e7eb", height: 28 }} />

        {["all", "จอง", "ขาย", "ยกเลิก"].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{
              padding: "6px 18px", borderRadius: 20, border: "none", cursor: "pointer",
              background: filterStatus === s ? "#072d6b" : "#e5e7eb",
              color: filterStatus === s ? "#fff" : "#374151",
              fontFamily: "Tahoma", fontSize: 14,
            }}>
            {s === "all" ? "ทั้งหมด" : s}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 16px", background: "#fef3c7", borderRadius: 8, marginBottom: 14, color: "#92400e" }}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>ไม่มีรายการ</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>วันที่จอง</th>
                {isAdmin && <th>สาขา</th>}
                <th>ยี่ห้อ</th>
                <th>ชื่อรุ่น</th>
                <th>แบบ</th>
                <th>สี</th>
                <th>ลูกค้า</th>
                <th>โทร</th>
                <th>ประเภท</th>
                <th>เลขมัดจำ</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.booking_id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {b.booking_date ? new Date(b.booking_date).toLocaleDateString("th-TH") : "-"}
                  </td>
                  {isAdmin && <td>{b.branch || "-"}</td>}
                  <td>{b.brand || "-"}</td>
                  <td>{b.marketing_name || "-"}</td>
                  <td>{b.new_model_code || b.model_code || "-"}</td>
                  <td>{b.new_color_name || b.color_name || "-"}</td>
                  <td>{b.customer_name || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{b.customer_phone || "-"}</td>
                  <td>{b.purchase_type || "-"}</td>
                  <td>{b.deposit_no || "-"}</td>
                  <td>
                    <span style={{
                      background: STATUS_COLOR[b.status] || "#d1d5db",
                      color: "#fff", padding: "3px 10px", borderRadius: 12, fontSize: 13, whiteSpace: "nowrap",
                    }}>
                      {STATUS_LABEL[b.status] || b.status}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {b.status === "จอง" && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => setSellTarget(b)}
                          style={{ padding: "3px 8px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                          ขาย
                        </button>
                        <button onClick={() => { setChangeTarget(b); setChangeForm({ model_code: b.model_code, color_name: b.color_name }); }}
                          style={{ padding: "3px 8px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                          เปลี่ยน
                        </button>
                        <button onClick={() => { setCancelTarget(b); setCancelReason(""); }}
                          style={{ padding: "3px 8px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                          ยกเลิก
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sell Modal */}
      {sellTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0, color: "#10b981" }}>✅ บันทึกขายรถจอง</h3>
            <p><strong>{sellTarget.customer_name}</strong> — {sellTarget.model_code} {sellTarget.color_name}</p>
            <p>เลขมัดจำ: {sellTarget.deposit_no || "-"}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSell} disabled={saving}
                style={{ flex: 1, padding: "9px 0", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังบันทึก..." : "ยืนยันขาย"}
              </button>
              <button onClick={() => setSellTarget(null)}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0 }}>ยืนยันการยกเลิกการจอง</h3>
            <p><strong>{cancelTarget.customer_name}</strong> — {cancelTarget.model_code} {cancelTarget.color_name}</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6 }}>เหตุผลการยกเลิก</label>
              <textarea style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", resize: "vertical" }}
                rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="ระบุเหตุผล (ถ้ามี)" />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleCancel} disabled={saving}
                style={{ flex: 1, padding: "9px 0", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
              </button>
              <button onClick={() => setCancelTarget(null)}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Model Modal */}
      {changeTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0, color: "#f59e0b" }}>🔄 เปลี่ยนแบบ + สี</h3>
            <p><strong>{changeTarget.customer_name}</strong></p>
            <p style={{ color: "#6b7280", fontSize: 13 }}>เดิม: {changeTarget.model_code} / {changeTarget.color_name}</p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>แบบใหม่</label>
              <select style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}
                value={changeForm.model_code}
                onChange={(e) => setChangeForm({ ...changeForm, model_code: e.target.value, color_name: "" })}>
                <option value="">-- เลือกแบบ --</option>
                {codesByBrandModel(changeTarget.brand, changeTarget.marketing_name).map(m => (
                  <option key={m.model_code} value={m.model_code}>{m.model_code}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>สีใหม่</label>
              <select style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}
                value={changeForm.color_name}
                onChange={(e) => setChangeForm({ ...changeForm, color_name: e.target.value })}>
                <option value="">-- เลือกสี --</option>
                {colorsByCode(changeTarget.brand, changeTarget.marketing_name, changeForm.model_code).map(m => (
                  <option key={m.color_code} value={m.color_name}>{m.color_name}</option>
                ))}
              </select>
            </div>

            {message && <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}>{message}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleChangeModel} disabled={saving}
                style={{ flex: 1, padding: "9px 0", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังบันทึก..." : "ยืนยันเปลี่ยน"}
              </button>
              <button onClick={() => { setChangeTarget(null); setMessage(""); }}
                style={{ flex: 1, padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
