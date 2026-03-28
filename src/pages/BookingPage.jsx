import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/booking-api";

const STATUS_LABEL = { pending: "จอง", cancelled: "ยกเลิก" };
const STATUS_COLOR = { pending: "#10b981", cancelled: "#6b7280" };

const DELIVERY_TYPES = ["ส่งรถ", "ทำสัญญา", "อื่น ๆ"];

const emptyForm = () => ({
  car_model_id: "",
  driver_id: "",
  booking_date: "",
  booking_time: "",
  delivery_type: "",
  destination: "",
  purpose: "",
});

export default function BookingPage({ currentUser }) {
  const [mode, setMode] = useState("list");
  const [bookings, setBookings] = useState([]);
  const [carModels, setCarModels] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [distanceInfo, setDistanceInfo] = useState(null);
  const [loadingDist, setLoadingDist] = useState(false);

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    fetchBookings();
    fetchCarModels();
    fetchDrivers();
  }, []);

  async function fetchBookings() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_bookings",
          branch: isAdmin ? null : currentUser?.branch,
        }),
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
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_car_models" }),
      });
      const data = await res.json();
      setCarModels(Array.isArray(data) ? data : data.rows || []);
    } catch { /* ignore */ }
  }

  async function fetchDrivers() {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_drivers" }),
      });
      const data = await res.json();
      setDrivers(Array.isArray(data) ? data : data.rows || []);
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
          origin: currentUser?.branch || "",
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
          car_model_id: form.car_model_id || null,
          driver_id: form.driver_id || null,
          distance_text: distanceInfo?.distance_text || null,
          duration_text: distanceInfo?.duration_text || null,
          destination_formatted: distanceInfo?.destination_name || form.destination,
        }),
      });
      const data = await res.json();
      if (data?.success || data?.booking_id) {
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

  const filtered = bookings.filter(
    (b) => filterStatus === "all" || b.status === filterStatus
  );

  const carModelLabel = (id) => {
    const m = carModels.find((c) => String(c.model_id) === String(id));
    return m ? `${m.brand} ${m.marketing_name} ${m.color_name || ""}`.trim() : "-";
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
            <label>รุ่นรถ</label>
            <select className="form-input" value={form.car_model_id} onChange={(e) => setForm({ ...form, car_model_id: e.target.value })}>
              <option value="">-- เลือกรุ่นรถ --</option>
              {carModels.map((m) => (
                <option key={m.model_id} value={m.model_id}>
                  {m.brand} {m.marketing_name} ({m.color_name})
                </option>
              ))}
            </select>
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
            <input type="date" className="form-input" value={form.booking_date} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} />
          </div>

          <div className="form-row">
            <label>จองเวลา <span style={{ color: "#ef4444" }}>*</span></label>
            <input type="time" className="form-input" value={form.booking_time} onChange={(e) => setForm({ ...form, booking_time: e.target.value })} />
          </div>

          <div className="form-row">
            <label>ประเภทการจัดส่ง <span style={{ color: "#ef4444" }}>*</span></label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {DELIVERY_TYPES.map((t) => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: "normal" }}>
                  <input type="radio" name="delivery_type" value={t} checked={form.delivery_type === t} onChange={(e) => setForm({ ...form, delivery_type: e.target.value })} />
                  {t}
                </label>
              ))}
            </div>
          </div>

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

            {distanceInfo && (
              <div style={{ marginTop: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontWeight: 700, color: "#15803d", marginBottom: 4 }}>
                  📍 {distanceInfo.destination_name || form.destination}
                </div>
                <div style={{ color: "#166534", fontSize: 13 }}>
                  🛣️ ระยะทาง: <strong>{distanceInfo.distance_text || "-"}</strong>
                  &nbsp;&nbsp;⏱️ เวลาเดินทาง: <strong>{distanceInfo.duration_text || "-"}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="form-row">
            <label>วัตถุประสงค์</label>
            <textarea className="form-input" rows={3} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="รายละเอียดการเดินทาง" />
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

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
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
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>วันที่จอง</th>
                <th>เวลา</th>
                <th>ผู้จอง</th>
                {isAdmin && <th>สาขา</th>}
                <th>ประเภท</th>
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
                  <td>{b.booker_name || "-"}</td>
                  {isAdmin && <td>{b.branch || "-"}</td>}
                  <td>{b.delivery_type || "-"}</td>
                  <td>{b.driver_id ? driverLabel(b.driver_id) : (b.driver_name || "-")}</td>
                  <td>{b.destination_formatted || b.destination || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{b.distance_text || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{b.duration_text || "-"}</td>
                  <td>
                    <span style={{
                      background: STATUS_COLOR[b.status] || "#d1d5db",
                      color: "#fff", padding: "3px 10px", borderRadius: 12, fontSize: 13, whiteSpace: "nowrap",
                    }}>
                      {STATUS_LABEL[b.status] || b.status}
                    </span>
                  </td>
                  <td>
                    {b.status === "pending" && (
                      <button
                        style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}
                        onClick={() => { setCancelTarget(b); setCancelReason(""); }}
                      >
                        ยกเลิก
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", resize: "vertical" }}
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
