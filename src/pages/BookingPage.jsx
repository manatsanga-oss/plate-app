import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/booking-api";
const MASTER_API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

const STATUS_LABEL = { pending: "จอง", cancelled: "ยกเลิก", จอง: "จอง", ยกเลิก: "ยกเลิก" };
const STATUS_COLOR = { pending: "#10b981", cancelled: "#6b7280", จอง: "#10b981", ยกเลิก: "#6b7280" };
const isBooked = (s) => s === "pending" || s === "จอง";
const isCancelled = (s) => s === "cancelled" || s === "ยกเลิก";

const DELIVERY_TYPES = ["ส่งรถ", "ทำสัญญา", "อื่น ๆ"];

const emptyForm = () => ({
  car_model: "",
  driver_id: "",
  booking_date: "",
  booking_time: "",
  delivery_type: "",
  finance_company: "",
  destination: "",
  purpose: "",
});

export default function BookingPage({ currentUser }) {
  const [mode, setMode] = useState("list");
  const [bookings, setBookings] = useState([]);
  const [carModels, setCarModels] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [financeCompanies, setFinanceCompanies] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [distanceInfo, setDistanceInfo] = useState(null);
  const [loadingDist, setLoadingDist] = useState(false);

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    fetchBookings();
    fetchCarModels();
    fetchDrivers();
    fetchFinanceCompanies();
  }, []);

  async function fetchBookings() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_bookings" }),
      });
      const data = await res.json();
      setBookings(Array.isArray(data) ? data : data.rows || []);
    } catch {
      setMessage("โหลดข้อมูลการจองไม่สำเร็จ");
    }
    setLoading(false);
  }

  async function fetchCarModels() {
    try {
      const res = await fetch(MASTER_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_series" }),
      });
      const data = await res.json();
      setCarModels(Array.isArray(data) ? data : data.rows || []);
    } catch { /* ignore */ }
  }

  async function fetchDrivers() {
    try {
      const res = await fetch(MASTER_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_drivers" }),
      });
      const data = await res.json();
      const all = Array.isArray(data) ? data : data.rows || [];
      setDrivers(all.filter(d => d.status === "active"));
    } catch { /* ignore */ }
  }

  async function fetchFinanceCompanies() {
    try {
      const res = await fetch(MASTER_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_finance_companies" }),
      });
      const data = await res.json();
      const all = Array.isArray(data) ? data : data.rows || [];
      setFinanceCompanies(all.filter(c => c.status === "active"));
    } catch { /* ignore */ }
  }

  async function fetchDistance() {
    if (!form.destination.trim()) return;
    setLoadingDist(true);
    setDistanceInfo(null);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_distance",
          origin: "ตลาดวังน้อย",
          destination: form.destination,
        }),
      });
      const data = await res.json();
      setDistanceInfo(data);
    } catch { /* ignore */ }
    setLoadingDist(false);
  }

  async function handleSave() {
    if (!form.booking_date || !form.booking_time || !form.delivery_type || !form.destination) {
      setMessage("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    if (distanceInfo && !distanceInfo._confirmed) {
      setMessage("กรุณากดเลือกปลายทางจากผลการค้นหาก่อน");
      return;
    }
    if (form.delivery_type === "ทำสัญญา" && !form.finance_company) {
      setMessage("กรุณาเลือกไฟแนนท์");
      return;
    }
    if (form.delivery_type === "อื่น ๆ" && !form.purpose.trim()) {
      setMessage("กรุณาระบุวัตถุประสงค์");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_booking",
          booker_name: currentUser?.name,
          branch: currentUser?.branch,
          ...form,
          status: "pending",
          car_model: form.car_model || null,
          driver_id: form.driver_id || null,
          finance_company: form.finance_company || null,
          distance_text: distanceInfo?.distance_text || null,
          duration_text: distanceInfo?.duration_text || null,
          destination_formatted: distanceInfo?.destination_name || form.destination,
        }),
      });
      const data = await res.json();
      if (data?.success || data?.booking_id) {
        // ส่ง LINE notification
        const thaiDate = form.booking_date
          ? (() => {
              const [y, m, d] = form.booking_date.split("-");
              return `${d}/${m}/${Number(y) + 543}`;
            })()
          : "-";
        const driverName = drivers.find(d => String(d.driver_id) === String(form.driver_id))?.name || "-";
        const lineMsg = [
          "🚗 รายการจองคนขับรถ",
          "----------------------------",
          `🏪 ร้านที่จอง: ${currentUser?.branch || "-"}`,
          `📅 วันที่จอง: ${thaiDate}`,
          `⏰ เวลา: ${form.booking_time} น.`,
          `👤 คนขับรถ: ${driverName}`,
          form.car_model ? `💎 รุ่น: ${form.car_model}` : "",
          form.finance_company ? `🏢 ไฟแนนท์: ${form.finance_company}` : "",
          form.delivery_type === "อื่น ๆ" && form.purpose ? `📝 วัตถุประสงค์: ${form.purpose}` : "",
          distanceInfo?.destination_name ? `📍 สถานที่ส่ง: ${form.destination}` : `📍 สถานที่ส่ง: ${form.destination}`,
          distanceInfo?.destination_name ? `📌 ที่อยู่: ${distanceInfo.destination_name}` : "",
          distanceInfo?.distance_text ? `📏 ระยะทาง: ${distanceInfo.distance_text}` : "",
          distanceInfo?.duration_text ? `⏱ เวลาเดินทาง: ${distanceInfo.duration_text}` : "",
        ].filter(Boolean).join("\n");
        fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "notify_line", message: lineMsg }),
        }).catch(() => {});
        setForm(emptyForm());
        setDistanceInfo(null);
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

  async function handleCancel() {
    if (!cancelTarget) return;
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_booking",
          booking_id: cancelTarget.booking_id,
          cancel_reason: cancelReason,
        }),
      });
      const data = await res.json();
      if (data?.success || data?.booking_id) {
        setCancelTarget(null);
        setCancelReason("");
        fetchBookings();
      } else {
        setMessage("ยกเลิกไม่สำเร็จ");
      }
    } catch {
      setMessage("เกิดข้อผิดพลาด");
    }
    setSaving(false);
  }

  const filtered = bookings.filter((b) => {
    if (filterStatus === "pending" && !isBooked(b.status)) return false;
    if (filterStatus === "cancelled" && !isCancelled(b.status)) return false;
    if (filterDate && b.booking_date) {
      const d = b.booking_date.slice(0, 10);
      if (d !== filterDate) return false;
    }
    return true;
  });

  const carModelLabel = (id) => {
    const m = carModels.find((c) => String(c.model_id) === String(id));
    return m ? m.model_code : "-";
  };

  const driverLabel = (id) => {
    const d = drivers.find((dr) => String(dr.driver_id) === String(id));
    return d ? d.name : "-";
  };

  /* ── ADD FORM ── */
  if (mode === "add") {
    return (
      <div className="page-container">
        <div className="page-topbar">
          <h2 className="page-title">🚗 จองรถ / คนขับ</h2>
          <button className="btn-secondary" onClick={() => { setMode("list"); setMessage(""); setDistanceInfo(null); }}>
            ← กลับ
          </button>
        </div>

        <div className="form-card" style={{ maxWidth: 620 }}>
          <h3 style={{ marginTop: 0 }}>แบบฟอร์มจองรถ</h3>

          <div className="form-row">
            <label>ผู้จอง</label>
            <input value={currentUser?.name || ""} disabled className="form-input" />
          </div>

          <div className="form-row">
            <label>สาขา</label>
            <input value={currentUser?.branch || ""} disabled className="form-input" />
          </div>

          <div className="form-row">
            <label>คนขับรถ</label>
            <select className="form-input" value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
              <option value="">-- เลือกคนขับ --</option>
              {drivers.map((d) => (
                <option key={d.driver_id} value={d.driver_id}>
                  {d.name} {d.phone ? `(${d.phone})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>วันที่จอง <span style={{ color: "#ef4444" }}>*</span></label>
            <input type="date" className="form-input" value={form.booking_date} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} onKeyDown={(e) => e.preventDefault()} />
          </div>

          <div className="form-row">
            <label>จองเวลา <span style={{ color: "#ef4444" }}>*</span></label>
            <select className="form-input" value={form.booking_time} onChange={(e) => setForm({ ...form, booking_time: e.target.value })}>
              <option value="">-- เลือกเวลา --</option>
              {Array.from({ length: 10 }, (_, i) => {
                const h = String(i + 8).padStart(2, "0");
                return <option key={h} value={`${h}:00`}>{h}.00 น.</option>;
              })}
            </select>
          </div>

          <div className="form-row">
            <label>ประเภทการจัดส่ง <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {DELIVERY_TYPES.map((t) => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: "normal" }}>
                  <input
                    type="radio" name="delivery_type" value={t}
                    checked={form.delivery_type === t}
                    onChange={(e) => setForm({ ...form, delivery_type: e.target.value, car_model: "", finance_company: "", purpose: "" })}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>

          {/* ส่งรถ: รุ่นรถ */}
          {form.delivery_type === "ส่งรถ" && (
            <div className="form-row">
              <label>รุ่นรถ</label>
              <select className="form-input" value={form.car_model} onChange={(e) => setForm({ ...form, car_model: e.target.value })}>
                <option value="">-- เลือกรุ่นรถ --</option>
                {carModels.map((m) => (
                  <option key={m.series_id} value={m.marketing_name || m.series_name}>
                    {m.marketing_name || m.series_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ทำสัญญา: รุ่นรถ + ไฟแนนท์ */}
          {form.delivery_type === "ทำสัญญา" && (
            <>
              <div className="form-row">
                <label>รุ่นรถ</label>
                <select className="form-input" value={form.car_model} onChange={(e) => setForm({ ...form, car_model: e.target.value })}>
                  <option value="">-- เลือกรุ่นรถ --</option>
                  {carModels.map((m) => (
                    <option key={m.marketing_name} value={m.marketing_name}>
                      {m.marketing_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>ไฟแนนท์ <span style={{ color: "#ef4444" }}>*</span></label>
                <select className="form-input" value={form.finance_company} onChange={(e) => setForm({ ...form, finance_company: e.target.value })}>
                  <option value="">-- เลือกไฟแนนท์ --</option>
                  {financeCompanies.map((f) => (
                    <option key={f.company_id} value={f.company_name}>{f.company_name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* อื่น ๆ: วัตถุประสงค์ */}
          {form.delivery_type === "อื่น ๆ" && (
            <div className="form-row">
              <label>วัตถุประสงค์ <span style={{ color: "#ef4444" }}>*</span></label>
              <textarea
                className="form-input" rows={3}
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="ระบุวัตถุประสงค์"
              />
            </div>
          )}

          <div className="form-row">
            <label>ปลายทาง <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                value={form.destination}
                onChange={(e) => { setForm({ ...form, destination: e.target.value }); setDistanceInfo(null); }}
                placeholder="ระบุจุดหมายปลายทาง"
              />
              <button
                type="button"
                className="btn-primary"
                style={{ whiteSpace: "nowrap", padding: "8px 14px" }}
                onClick={fetchDistance}
                disabled={loadingDist || !form.destination.trim()}
              >
                {loadingDist ? "⏳" : "📍 ค้นหา"}
              </button>
            </div>

            {distanceInfo && !distanceInfo._confirmed && (
              <div style={{ marginTop: 10, border: "1px solid #cbd5e1", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ background: "#f8fafc", padding: "8px 14px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                  ผลการค้นหา — กดเลือกเพื่อยืนยัน
                </div>
                <button
                  type="button"
                  style={{ width: "100%", textAlign: "left", padding: "12px 14px", background: "#fff", border: "none", cursor: "pointer", fontFamily: "Tahoma" }}
                  onClick={() => setDistanceInfo({ ...distanceInfo, _confirmed: true })}
                >
                  <div style={{ fontWeight: 700, color: "#072d6b", marginBottom: 4 }}>
                    📍 {distanceInfo.destination_name || form.destination}
                  </div>
                  <div style={{ color: "#475569", fontSize: 13 }}>
                    🛣️ ระยะทาง: <strong>{distanceInfo.distance_text || "-"}</strong>
                    &nbsp;&nbsp;⏱️ เวลาเดินทาง: <strong>{distanceInfo.duration_text || "-"}</strong>
                  </div>
                </button>
              </div>
            )}

            {distanceInfo?._confirmed && (
              <div style={{ marginTop: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#15803d", marginBottom: 4 }}>
                    ✅ {distanceInfo.destination_name || form.destination}
                  </div>
                  <div style={{ color: "#166534", fontSize: 13 }}>
                    🛣️ {distanceInfo.distance_text || "-"} &nbsp;⏱️ {distanceInfo.duration_text || "-"}
                  </div>
                </div>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}
                  onClick={() => setDistanceInfo(null)}
                >✕</button>
              </div>
            )}
          </div>

          {message && <div className="form-message">{message}</div>}

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "💾 บันทึกการจอง"}
            </button>
            <button className="btn-secondary" onClick={() => { setMode("list"); setMessage(""); setDistanceInfo(null); }}>
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── LIST ── */
  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🚗 ระบบจองคนขับรถ</h2>
        <button className="btn-primary" onClick={() => { setForm(emptyForm()); setDistanceInfo(null); setMode("add"); setMessage(""); }}>
          + จองรถ
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 14, color: "#374151", whiteSpace: "nowrap" }}>📅 วันที่จอง</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "Tahoma" }}
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate("")}
              style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#e5e7eb", cursor: "pointer", fontSize: 13, fontFamily: "Tahoma" }}
            >
              ✕ ล้าง
            </button>
          )}
        </div>

        <div style={{ width: 1, background: "#e5e7eb", height: 28, margin: "0 4px" }} />

        {[
          { key: "all", label: "ทั้งหมด" },
          { key: "pending", label: "จอง" },
          { key: "cancelled", label: "ยกเลิก" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(s.key)}
            style={{
              padding: "6px 20px", borderRadius: 20, border: "none", cursor: "pointer",
              background: filterStatus === s.key ? "#072d6b" : "#e5e7eb",
              color: filterStatus === s.key ? "#fff" : "#374151",
              fontFamily: "Tahoma, sans-serif", fontSize: 14,
            }}
          >
            {s.label}
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
        <>
        {/* Desktop: ตาราง */}
        <div className="booking-desktop" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>วันที่จอง</th>
                <th>เวลา</th>
                {isAdmin && <th>สาขา</th>}
                <th>ประเภท</th>
                <th>รุ่นรถ / ไฟแนนท์</th>
                <th>คนขับ</th>
                <th>ปลายทาง</th>
                <th>ระยะทาง</th>
                <th>เวลาเดินทาง</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.booking_id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {b.booking_date ? new Date(b.booking_date).toLocaleDateString("th-TH") : "-"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{b.booking_time || "-"}</td>
                  {isAdmin && <td>{b.branch || "-"}</td>}
                  <td>{b.delivery_type || "-"}</td>
                  <td>{b.finance_company || b.car_model || b.purpose || "-"}</td>
                  <td>{b.driver_id ? driverLabel(b.driver_id) : (b.driver_name || "-")}</td>
                  <td>{b.destination || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{b.distance_text || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{b.duration_text || "-"}</td>
                  <td>
                    {b.status ? (
                      <span style={{ background: STATUS_COLOR[b.status] || "#d1d5db", color: "#fff", padding: "3px 10px", borderRadius: 12, fontSize: 13, whiteSpace: "nowrap" }}>
                        {STATUS_LABEL[b.status] || b.status}
                      </span>
                    ) : "-"}
                  </td>
                  <td>
                    {isBooked(b.status) && (
                      <button style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}
                        onClick={() => { setCancelTarget(b); setCancelReason(""); }}>ยกเลิก</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: Card */}
        <div className="booking-mobile" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((b) => (
            <div key={b.booking_id} style={{
              background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 8px rgba(7,45,107,0.08)",
              borderLeft: `4px solid ${STATUS_COLOR[b.status] || "#d1d5db"}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#072d6b" }}>
                    {b.booking_date ? new Date(b.booking_date).toLocaleDateString("th-TH") : "-"}
                  </span>
                  <span style={{ fontSize: 14, color: "#374151" }}>{b.booking_time || "-"}</span>
                  {b.status && (
                    <span style={{ background: STATUS_COLOR[b.status] || "#d1d5db", color: "#fff", padding: "2px 10px", borderRadius: 12, fontSize: 12 }}>
                      {STATUS_LABEL[b.status] || b.status}
                    </span>
                  )}
                </div>
                {isBooked(b.status) && (
                  <button onClick={() => { setCancelTarget(b); setCancelReason(""); }}
                    style={{ padding: "4px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                    ยกเลิก
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 13 }}>
                {isAdmin && <div><span style={{ color: "#6b7280" }}>สาขา:</span> <b>{b.branch || "-"}</b></div>}
                <div><span style={{ color: "#6b7280" }}>ประเภท:</span> <b>{b.delivery_type || "-"}</b></div>
                <div><span style={{ color: "#6b7280" }}>รุ่นรถ:</span> <b>{b.car_model || "-"}</b></div>
                <div><span style={{ color: "#6b7280" }}>คนขับ:</span> <b>{b.driver_id ? driverLabel(b.driver_id) : (b.driver_name || "-")}</b></div>
                {b.finance_company && <div><span style={{ color: "#6b7280" }}>ไฟแนนท์:</span> <b>{b.finance_company}</b></div>}
                {b.distance_text && <div><span style={{ color: "#6b7280" }}>ระยะทาง:</span> <b>{b.distance_text}</b></div>}
                {b.duration_text && <div><span style={{ color: "#6b7280" }}>เวลา:</span> <b>{b.duration_text}</b></div>}
              </div>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                <span style={{ color: "#6b7280" }}>ปลายทาง:</span> <b style={{ color: "#072d6b" }}>{b.destination_formatted || b.destination || "-"}</b>
              </div>
              {b.purpose && <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>หมายเหตุ: {b.purpose}</div>}
            </div>
          ))}
        </div>
        </>
      )}

      {/* Cancel Modal */}
      {cancelTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
            <h3 style={{ marginTop: 0 }}>ยืนยันการยกเลิกการจอง</h3>
            <p>ยกเลิกการจองของ <strong>{cancelTarget.booker_name}</strong> ไปยัง {cancelTarget.destination_formatted || cancelTarget.destination}?</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6 }}>เหตุผลการยกเลิก</label>
              <textarea
                style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #d1d5db", fontFamily: "Tahoma", resize: "vertical" }}
                rows={3} value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="ระบุเหตุผล (ถ้ามี)"
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{ flex: 1, padding: "8px 0", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}
                onClick={handleCancel} disabled={saving}
              >
                {saving ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
              </button>
              <button
                style={{ flex: 1, padding: "8px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 15 }}
                onClick={() => setCancelTarget(null)}
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
