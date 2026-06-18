import React, { useEffect, useState } from "react";

// ============================================================================
// หน้า "เลือกวันรับรถ" สำหรับลูกค้า — เปิดจากปุ่มในการ์ด LINE (แจ้งรถถึงคิว)
// URL: /pickup-confirm?dep=<เลขที่ใบมัดจำ>   (public ไม่ต้อง login — เรียกตรงจาก App.jsx)
// ลูกค้าเลือกวันสะดวกรับรถ → บันทึกลง moto_bookings (action set_appointment)
// ============================================================================
const BOOKING_API = "https://n8n-new-project-gwf2.onrender.com/webhook/moto-booking-api";

const thaiDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
};

async function postJson(body) {
  const res = await fetch(BOOKING_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return raw.trim() ? JSON.parse(raw) : [];
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function PickupConfirmPage() {
  const [phase, setPhase] = useState("loading"); // loading | ok | notfound | error | saving | done
  const [booking, setBooking] = useState(null);
  const [pickupDate, setPickupDate] = useState(tomorrowISO());
  const [note, setNote] = useState("");
  const [savedDate, setSavedDate] = useState(null);

  async function load() {
    const dep = new URLSearchParams(window.location.search).get("dep") || "";
    if (!dep.trim()) { setPhase("notfound"); return; }
    setPhase("loading");
    try {
      const bookings = await postJson({ action: "get_moto_bookings" });
      const all = Array.isArray(bookings) ? bookings : [];
      const mine = all.filter((b) => String(b.deposit_no || "").trim() === dep.trim());
      if (mine.length === 0) { setPhase("notfound"); return; }
      const b = mine.find((x) => x.status === "จอง") || mine[mine.length - 1];
      setBooking(b);
      if (b.appointment_date) {
        setPickupDate(String(b.appointment_date).slice(0, 10));
        setSavedDate(b.appointment_date);
      }
      if (b.status === "ขาย") { setPhase("sold"); return; }
      if (b.status === "ยกเลิก") { setPhase("cancelled"); return; }
      setPhase("ok");
    } catch (e) {
      console.warn("load pickup failed:", e);
      setPhase("error");
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!booking?.booking_id) return;
    if (!pickupDate) { alert("กรุณาเลือกวันที่สะดวกรับรถ"); return; }
    setPhase("saving");
    try {
      await postJson({
        action: "set_appointment",
        booking_id: booking.booking_id,
        appointment_date: pickupDate,
        appointment_note: ["ลูกค้ายืนยันผ่าน LINE", note.trim()].filter(Boolean).join(" — "),
      });
      setSavedDate(pickupDate);
      setPhase("done");
    } catch (e) {
      alert("บันทึกไม่สำเร็จ กรุณาลองใหม่: " + (e.message || e));
      setPhase("ok");
    }
  }

  const b = booking;
  const carLine = b ? [b.brand, b.marketing_name, b.new_model_code || b.model_code, b.new_color_name || b.color_name].filter(Boolean).join(" / ") : "";

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.header}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>🔔 นัดหมายรับรถ</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>รถที่คุณจองถึงคิวรับรถแล้ว</div>
        </div>

        {phase === "loading" && <div style={S.center}>กำลังโหลดข้อมูล…</div>}
        {phase === "notfound" && <div style={S.center}>❌ ไม่พบข้อมูลการจอง<br /><span style={{ fontSize: 13, color: "#888" }}>กรุณาติดต่อพนักงานสาขา</span></div>}
        {phase === "error" && (
          <div style={S.center}>
            ⚠️ โหลดข้อมูลไม่สำเร็จ
            <div><button onClick={load} style={S.btnGhost}>🔄 ลองใหม่</button></div>
          </div>
        )}
        {phase === "sold" && <div style={S.center}>✅ รับรถเรียบร้อยแล้ว<br /><span style={{ fontSize: 13, color: "#888" }}>ขอบคุณที่ใช้บริการครับ 🙏</span></div>}
        {phase === "cancelled" && <div style={S.center}>🚫 การจองนี้ถูกยกเลิกแล้ว<br /><span style={{ fontSize: 13, color: "#888" }}>สอบถามเพิ่มเติมกรุณาติดต่อสาขา</span></div>}

        {(phase === "ok" || phase === "saving") && b && (
          <div style={{ padding: 16 }}>
            <div style={{ ...S.statusBox, background: "#ecfdf3", borderColor: "#12b76a" }}>
              <div style={{ fontSize: 34 }}>🏍️</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#067647" }}>รถถึงคิวรับรถแล้ว!</div>
              <div style={{ fontSize: 13, color: "#475467", marginTop: 4 }}>กรุณาเลือกวันที่คุณสะดวกเข้ามารับรถ</div>
            </div>

            <div style={S.detail}>
              <Row label="ลูกค้า" value={b.customer_name || "-"} />
              <Row label="รถที่จอง" value={carLine || "-"} />
              <Row label="สาขา" value={b.branch || "-"} />
              {savedDate && <Row label="วันนัดล่าสุด" value={thaiDate(savedDate)} />}
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={S.label}>📅 วันที่สะดวกรับรถ</label>
              <input type="date" value={pickupDate} min={tomorrowISO()}
                onChange={(e) => setPickupDate(e.target.value)} style={S.input} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={S.label}>📝 หมายเหตุ (ถ้ามี)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                placeholder="เช่น สะดวกช่วงบ่าย / มากับครอบครัว" style={{ ...S.input, resize: "vertical" }} />
            </div>

            <button onClick={submit} disabled={phase === "saving"} style={{ ...S.btnPrimary, opacity: phase === "saving" ? 0.6 : 1 }}>
              {phase === "saving" ? "กำลังบันทึก…" : "✅ ยืนยันวันรับรถ"}
            </button>
          </div>
        )}

        {phase === "done" && (
          <div style={{ padding: 16 }}>
            <div style={{ ...S.statusBox, background: "#ecfdf3", borderColor: "#12b76a" }}>
              <div style={{ fontSize: 34 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#067647" }}>ยืนยันวันรับรถเรียบร้อย</div>
              <div style={{ fontSize: 15, color: "#067647", marginTop: 6, fontWeight: 700 }}>📅 {thaiDate(savedDate)}</div>
              <div style={{ fontSize: 13, color: "#475467", marginTop: 6 }}>ทางร้านได้รับข้อมูลแล้ว แล้วพบกันที่สาขานะครับ 🙏</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <button onClick={() => setPhase("ok")} style={S.btnGhost}>✏️ แก้ไขวันนัด</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid #f2f4f7", fontSize: 14 }}>
      <span style={{ color: "#667085", flex: "0 0 auto" }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "#f0f4f8", display: "flex", justifyContent: "center", padding: "18px 12px", fontFamily: "Tahoma, sans-serif" },
  card: { width: "100%", maxWidth: 480, background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.08)", height: "fit-content" },
  header: { background: "#072d6b", color: "#fff", padding: "14px 16px" },
  center: { padding: "44px 16px", textAlign: "center", color: "#475467", fontSize: 15, lineHeight: 1.8 },
  statusBox: { border: "1.5px solid", borderRadius: 12, padding: "18px 14px", textAlign: "center", marginBottom: 14 },
  detail: { border: "1px solid #eaecf0", borderRadius: 10, padding: "4px 14px" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 5 },
  input: { width: "100%", padding: "10px 12px", fontSize: 15, border: "1px solid #d0d5dd", borderRadius: 8, boxSizing: "border-box", fontFamily: "Tahoma, sans-serif" },
  btnPrimary: { width: "100%", marginTop: 16, padding: "12px 24px", fontSize: 16, fontWeight: 700, color: "#fff", background: "#12b76a", border: "none", borderRadius: 8, cursor: "pointer" },
  btnGhost: { marginTop: 10, padding: "9px 22px", fontSize: 14, fontWeight: 700, color: "#2563eb", background: "#fff", border: "1px solid #2563eb", borderRadius: 8, cursor: "pointer" },
};
