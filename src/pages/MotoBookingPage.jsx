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
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterMarketing, setFilterMarketing] = useState("");
  const [filterModelCode, setFilterModelCode] = useState("");
  const [filterColor, setFilterColor] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [depositAction, setDepositAction] = useState("ยึดเงินมัดจำ");
  const [refundForm, setRefundForm] = useState({ account_no: "", bank: "", amount: "" });
  const [changeTarget, setChangeTarget] = useState(null);
  const [changeForm, setChangeForm] = useState({ model_code: "", color_name: "" });
  const [sellTarget, setSellTarget] = useState(null);
  const [sellInvoiceNo, setSellInvoiceNo] = useState("");

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
  const codesByBrand = (brand) =>
    [...new Map(
      allModels.filter(m => !brand || m.brand === brand)
        .map(m => [m.model_code, m])
    ).values()].sort((a, b) => a.model_code.localeCompare(b.model_code));

  const colorsByCode = (brand, code) =>
    [...new Map(
      allModels.filter(m =>
        (!brand || m.brand === brand) &&
        (!code || m.model_code === code)
      ).map(m => [m.color_name, m])
    ).values()];

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
    if (!sellInvoiceNo.trim()) { alert("กรุณากรอกเลขที่ใบขาย"); return; }
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sell_moto_booking", booking_id: sellTarget.booking_id, invoice_no: sellInvoiceNo.trim() }),
      });
      setSellTarget(null);
      setSellInvoiceNo("");
      fetchBookings();
    } catch { setMessage("เกิดข้อผิดพลาด"); }
    setSaving(false);
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    if (depositAction === "คืนเงินมัดจำ" && (!refundForm.account_no.trim() || !refundForm.bank || !refundForm.amount)) {
      alert("กรุณากรอกข้อมูลคืนเงินมัดจำให้ครบ"); return;
    }
    setSaving(true);
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_moto_booking",
          booking_id: cancelTarget.booking_id,
          cancel_reason: cancelReason,
          deposit_action: depositAction,
          refund_account_no: depositAction === "คืนเงินมัดจำ" ? refundForm.account_no : "",
          refund_bank: depositAction === "คืนเงินมัดจำ" ? refundForm.bank : "",
          refund_amount: depositAction === "คืนเงินมัดจำ" ? refundForm.amount : "",
        }),
      });
      setCancelTarget(null);
      setCancelReason("");
      setDepositAction("ยึดเงินมัดจำ");
      setRefundForm({ account_no: "", bank: "", amount: "" });
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
    if (filterBrand && b.brand !== filterBrand) return false;
    if (filterMarketing && b.marketing_name !== filterMarketing) return false;
    if (filterModelCode && b.model_code !== filterModelCode) return false;
    if (filterColor && b.color_name !== filterColor) return false;
    return true;
  });

  // Dynamic options from loaded bookings (deduplicated)
  const brandOpts = [...new Set(bookings.map(b => b.brand).filter(Boolean))].sort();
  const marketingOpts = [...new Set(bookings.filter(b => !filterBrand || b.brand === filterBrand).map(b => b.marketing_name).filter(Boolean))].sort();
  const modelCodeOpts = [...new Set(bookings.filter(b => (!filterBrand || b.brand === filterBrand) && (!filterMarketing || b.marketing_name === filterMarketing)).map(b => b.model_code).filter(Boolean))].sort();
  const colorOpts = [...new Set(bookings.filter(b => (!filterBrand || b.brand === filterBrand) && (!filterMarketing || b.marketing_name === filterMarketing) && (!filterModelCode || b.model_code === filterModelCode)).map(b => b.color_name).filter(Boolean))].sort();

  /* ── ADD FORM ── */
  if (mode === "add") {
    const codes = codesByBrand(form.brand);
    const colors = colorsByCode(form.brand, form.model_code);

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
              onChange={(e) => setForm({ ...form, brand: e.target.value, model_code: "", color_name: "" })}>
              <option value="">-- เลือกยี่ห้อ --</option>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
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

          {form.model_code && (
            <div className="form-row">
              <label>สี <span style={{ color: "#ef4444" }}>*</span></label>
              <select className="form-input" value={form.color_name}
                onChange={(e) => setForm({ ...form, color_name: e.target.value })}>
                <option value="">-- เลือกสี --</option>
                {colors.map(m => <option key={m.color_code} value={m.color_name}>{m.color_name}</option>)}
              </select>
            </div>
          )}

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
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
        {/* Row 1: dropdowns */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#64748b", whiteSpace: "nowrap" }}>📅</span>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
              style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "Tahoma", background: "#fff" }} />
            {filterDate && (
              <button onClick={() => setFilterDate("")}
                style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "#e2e8f0", cursor: "pointer", fontSize: 12, color: "#475569" }}>✕</button>
            )}
          </div>

          {isAdmin && (
            <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
              style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "Tahoma", background: "#fff" }}>
              <option value="">ทุกสาขา</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}

          <select value={filterBrand} onChange={(e) => { setFilterBrand(e.target.value); setFilterMarketing(""); setFilterModelCode(""); setFilterColor(""); }}
            style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "Tahoma", background: "#fff" }}>
            <option value="">ทุกยี่ห้อ</option>
            {brandOpts.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select value={filterMarketing} onChange={(e) => { setFilterMarketing(e.target.value); setFilterModelCode(""); setFilterColor(""); }}
            style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "Tahoma", background: "#fff" }}>
            <option value="">ทุกรุ่น</option>
            {marketingOpts.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select value={filterModelCode} onChange={(e) => { setFilterModelCode(e.target.value); setFilterColor(""); }}
            style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "Tahoma", background: "#fff" }}>
            <option value="">ทุกแบบ</option>
            {modelCodeOpts.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "Tahoma", background: "#fff" }}>
            <option value="">ทุกสี</option>
            {colorOpts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {(filterDate || filterBranch || filterBrand || filterMarketing || filterModelCode || filterColor) && (
            <button onClick={() => { setFilterDate(""); setFilterBranch(""); setFilterBrand(""); setFilterMarketing(""); setFilterModelCode(""); setFilterColor(""); }}
              style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}>
              🗑 ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* Row 2: status pills */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#94a3b8", marginRight: 2 }}>สถานะ:</span>
          {["all", "จอง", "ขาย", "ยกเลิก"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{
                padding: "4px 16px", borderRadius: 20, border: "none", cursor: "pointer",
                background: filterStatus === s ? "#072d6b" : "#e2e8f0",
                color: filterStatus === s ? "#fff" : "#475569",
                fontFamily: "Tahoma", fontSize: 13, transition: "all 0.15s",
              }}>
              {s === "all" ? "ทั้งหมด" : s}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>
            {filtered.length} รายการ
          </span>
        </div>
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
            <p style={{ margin: "4px 0" }}>เลขมัดจำ: {sellTarget.deposit_no || "-"}</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: 14 }}>เลขที่ใบขาย *</label>
              <input
                value={sellInvoiceNo}
                onChange={e => setSellInvoiceNo(e.target.value)}
                placeholder="กรอกเลขที่ใบขาย"
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 7, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }}
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSell} disabled={saving || !sellInvoiceNo.trim()}
                style={{ flex: 1, padding: "9px 0", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังบันทึก..." : "ยืนยันขาย"}
              </button>
              <button onClick={() => { setSellTarget(null); setSellInvoiceNo(""); }}
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
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0 }}>ยืนยันการยกเลิกการจอง</h3>
            <p style={{ margin: "4px 0 12px" }}><strong>{cancelTarget.customer_name}</strong> — {cancelTarget.model_code} {cancelTarget.color_name}</p>

            {/* deposit action radio */}
            <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
              {["ยึดเงินมัดจำ", "คืนเงินมัดจำ"].map(opt => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: depositAction === opt ? 700 : 400 }}>
                  <input type="radio" name="depositAction" value={opt} checked={depositAction === opt}
                    onChange={() => setDepositAction(opt)} />
                  {opt}
                </label>
              ))}
            </div>

            {/* refund fields */}
            {depositAction === "คืนเงินมัดจำ" && (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>เลขที่บัญชีธนาคาร *</label>
                  <input value={refundForm.account_no} onChange={e => setRefundForm(f => ({ ...f, account_no: e.target.value }))}
                    placeholder="000-0-00000-0" style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>บัญชีธนาคาร *</label>
                  <select value={refundForm.bank} onChange={e => setRefundForm(f => ({ ...f, bank: e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 14 }}>
                    <option value="">-- เลือกธนาคาร --</option>
                    {["กรุงเทพ (BBL)", "กสิกรไทย (KBANK)", "กรุงไทย (KTB)", "ไทยพาณิชย์ (SCB)", "กรุงศรีอยุธยา (BAY)", "ทหารไทยธนชาต (TTB)", "ออมสิน", "ธ.ก.ส."].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>จำนวนเงิน (บาท) *</label>
                  <input type="number" value={refundForm.amount} onChange={e => setRefundForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0" style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>เหตุผลการยกเลิก</label>
              <textarea style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", resize: "vertical", boxSizing: "border-box" }}
                rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="ระบุเหตุผล (ถ้ามี)" />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleCancel} disabled={saving}
                style={{ flex: 1, padding: "9px 0", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}>
                {saving ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
              </button>
              <button onClick={() => { setCancelTarget(null); setDepositAction("ยึดเงินมัดจำ"); setRefundForm({ account_no: "", bank: "", amount: "" }); }}
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
                {codesByBrand(changeTarget.brand).map(m => (
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
                {colorsByCode(changeTarget.brand, changeForm.model_code).map(m => (
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
