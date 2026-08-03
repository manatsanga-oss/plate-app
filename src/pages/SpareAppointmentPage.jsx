import React, { useEffect, useState } from "react";

// ============================================================================
// หน้า "เลือกวันนัดเข้ารับบริการ" สำหรับลูกค้า — เปิดจากปุ่มในการ์ด LINE
// (แจ้งลูกค้าจากหน้า ระบบสั่งซื้ออะไหล่ — อะไหล่มาถึงแล้ว เชิญนำรถเข้ารับบริการ)
// URL: /spare-appointment?order=<order_id>   (public ไม่ต้อง login — เรียกตรงจาก App.jsx)
// ลูกค้าเลือกวันสะดวก → บันทึกลง spare_parts_orders (action set_spare_appointment, appointment_by='customer')
// ============================================================================
const SPARE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api";

const thaiDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
};

async function postJson(body) {
  const res = await fetch(SPARE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return raw.trim() ? JSON.parse(raw) : [];
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function SpareAppointmentPage() {
  const [phase, setPhase] = useState("loading"); // loading | ok | notfound | closed | error | saving | done
  const [order, setOrder] = useState(null);
  const [apptDate, setApptDate] = useState(tomorrowISO());
  const [savedDate, setSavedDate] = useState(null);

  async function load() {
    const orderId = new URLSearchParams(window.location.search).get("order") || "";
    if (!orderId.trim()) { setPhase("notfound"); return; }
    setPhase("loading");
    try {
      const rows = await postJson({ action: "get_spare_orders" });
      const all = Array.isArray(rows) ? rows : [];
      const o = all.find((x) => String(x.order_id) === orderId.trim());
      if (!o) { setPhase("notfound"); return; }
      setOrder(o);
      if (o.appointment_date) {
        setApptDate(String(o.appointment_date).slice(0, 10));
        setSavedDate(o.appointment_date);
      }
      // นัดหมายได้เฉพาะใบที่ยังเปิดงานอยู่ (ปิดงานซ่อมแล้ว = รถเสร็จแล้ว)
      if (o.status !== "เปิดงาน") { setPhase("closed"); return; }
      setPhase("ok");
    } catch (e) {
      console.warn("load spare order failed:", e);
      setPhase("error");
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!order?.order_id) return;
    if (!apptDate) { alert("กรุณาเลือกวันที่สะดวกนำรถเข้ารับบริการ"); return; }
    setPhase("saving");
    try {
      await postJson({
        action: "set_spare_appointment",
        order_id: order.order_id,
        appointment_date: apptDate,
      });
      setSavedDate(apptDate);
      setPhase("done");
    } catch (e) {
      alert("บันทึกไม่สำเร็จ กรุณาลองใหม่: " + (e.message || e));
      setPhase("ok");
    }
  }

  const o = order;
  const carLine = o ? [o.model_name, o.license_plate].filter(Boolean).join(" / ") : "";

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.header}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>🔧 นัดหมายนำรถเข้ารับบริการ</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>อะไหล่สำหรับรถของคุณมาถึงเรียบร้อยแล้ว</div>
        </div>

        {phase === "loading" && <div style={S.center}>กำลังโหลดข้อมูล…</div>}
        {phase === "notfound" && <div style={S.center}>❌ ไม่พบข้อมูลใบงาน<br /><span style={{ fontSize: 13, color: "#888" }}>กรุณาติดต่อพนักงานสาขา</span></div>}
        {phase === "closed" && <div style={S.center}>✅ งานซ่อมนี้ดำเนินการเรียบร้อยแล้ว<br /><span style={{ fontSize: 13, color: "#888" }}>สอบถามเพิ่มเติมกรุณาติดต่อสาขา 🙏</span></div>}
        {phase === "error" && (
          <div style={S.center}>
            ⚠️ โหลดข้อมูลไม่สำเร็จ
            <div><button onClick={load} style={S.btnGhost}>🔄 ลองใหม่</button></div>
          </div>
        )}

        {(phase === "ok" || phase === "saving") && o && (
          <div style={{ padding: 16 }}>
            <div style={{ ...S.statusBox, background: "#fff7ed", borderColor: "#f59e0b" }}>
              <div style={{ fontSize: 34 }}>🛠️</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#b54708" }}>อะไหล่มาถึงแล้ว!</div>
              <div style={{ fontSize: 13, color: "#475467", marginTop: 4 }}>กรุณาเลือกวันที่คุณสะดวกนำรถเข้ามารับบริการ</div>
            </div>

            <div style={S.detail}>
              <Row label="ลูกค้า" value={o.customer_name || "-"} />
              <Row label="รถ" value={carLine || "-"} />
              {o.job_no && o.job_no !== "null" && <Row label="เลขที่ใบงาน" value={o.job_no} />}
              {o.branch && <Row label="สาขา" value={o.branch} />}
              {savedDate && <Row label="วันนัดล่าสุด" value={thaiDate(savedDate)} />}
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={S.label}>📅 วันที่สะดวกนำรถเข้ารับบริการ</label>
              <input type="date" value={apptDate} min={tomorrowISO()}
                onChange={(e) => setApptDate(e.target.value)} style={S.input} />
            </div>

            <button onClick={submit} disabled={phase === "saving"} style={{ ...S.btnPrimary, opacity: phase === "saving" ? 0.6 : 1 }}>
              {phase === "saving" ? "กำลังบันทึก…" : "✅ ยืนยันวันนัดหมาย"}
            </button>
          </div>
        )}

        {phase === "done" && (
          <div style={{ padding: 16 }}>
            <div style={{ ...S.statusBox, background: "#ecfdf3", borderColor: "#12b76a" }}>
              <div style={{ fontSize: 34 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#067647" }}>ยืนยันวันนัดหมายเรียบร้อย</div>
              <div style={{ fontSize: 15, color: "#067647", marginTop: 6, fontWeight: 700 }}>📅 {thaiDate(savedDate)}</div>
              <div style={{ fontSize: 13, color: "#475467", marginTop: 6 }}>ทางร้านได้รับข้อมูลแล้ว แล้วพบกันที่ศูนย์บริการนะครับ 🙏</div>
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
  header: { background: "#b54708", color: "#fff", padding: "14px 16px" },
  center: { padding: "44px 16px", textAlign: "center", color: "#475467", fontSize: 15, lineHeight: 1.8 },
  statusBox: { border: "1.5px solid", borderRadius: 12, padding: "18px 14px", textAlign: "center", marginBottom: 14 },
  detail: { border: "1px solid #eaecf0", borderRadius: 10, padding: "4px 14px" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 5 },
  input: { width: "100%", padding: "10px 12px", fontSize: 15, border: "1px solid #d0d5dd", borderRadius: 8, boxSizing: "border-box", fontFamily: "Tahoma, sans-serif" },
  btnPrimary: { width: "100%", marginTop: 16, padding: "12px 24px", fontSize: 16, fontWeight: 700, color: "#fff", background: "#12b76a", border: "none", borderRadius: 8, cursor: "pointer" },
  btnGhost: { marginTop: 10, padding: "9px 22px", fontSize: 14, fontWeight: 700, color: "#2563eb", background: "#fff", border: "1px solid #2563eb", borderRadius: 8, cursor: "pointer" },
};
