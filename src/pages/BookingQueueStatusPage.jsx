import React, { useEffect, useState } from "react";

// ============================================================================
// หน้า "สถานะคิวจองรถ" สำหรับลูกค้า — เปิดจากปุ่มในการ์ด LINE ใบเสร็จมัดจำ
// URL: /booking-status?dep=<เลขที่ใบมัดจำ>   (public ไม่ต้อง login — เรียกตรงจาก App.jsx)
// ดึงข้อมูลจาก moto-booking-api (get_moto_bookings + get_stock_summary)
// แล้วคำนวณคิวด้วย logic เดียวกับหน้า "ระบบจองรถจักรยานยนต์" เพื่อให้เลขคิวตรงกัน
// ============================================================================
const BOOKING_API = "https://n8n-new-project-gwf2.onrender.com/webhook/moto-booking-api";

// Normalize ตรงกับ MotoBookingPage / n8n Code node — ห้ามแก้ให้ต่าง ไม่งั้นเลขคิวเพี้ยน
const normModel = (s) => {
  let str = String(s || "").normalize("NFKC")
    .replace(/ /g, " ")
    .replace(/[()（）]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const idx = str.indexOf("th");
  if (idx !== -1) str = str.substring(0, idx + 2);
  return str;
};
const normColor = (s) => String(s || "").normalize("NFKC")
  .replace(/ /g, " ")
  .replace(/[-–—/:：]/g, "")
  .replace(/\s+/g, "")
  .toLowerCase();

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

export default function BookingQueueStatusPage() {
  const [phase, setPhase] = useState("loading"); // loading | ok | notfound | error
  const [info, setInfo] = useState(null);
  const [asOf, setAsOf] = useState(null); // เวลาที่ดึงข้อมูลล่าสุด

  async function load() {
    const dep = new URLSearchParams(window.location.search).get("dep") || "";
    if (!dep.trim()) { setPhase("notfound"); return; }
    setPhase("loading");
    {
      try {
        const [bookings, stock] = await Promise.all([
          postJson({ action: "get_moto_bookings" }),
          postJson({ action: "get_stock_summary" }).catch(() => []),
        ]);
        const all = Array.isArray(bookings) ? bookings : [];
        // หาใบจองของลูกค้าจากเลขที่ใบมัดจำ — ถ้ามีหลายใบ เอาสถานะ "จอง" ก่อน ไม่งั้นใบล่าสุด
        const mine = all.filter((b) => String(b.deposit_no || "").trim() === dep.trim());
        if (mine.length === 0) { setPhase("notfound"); return; }
        const booking = mine.find((b) => b.status === "จอง") || mine[mine.length - 1];

        // ----- คำนวณคิว (logic เดียวกับหน้าระบบจองรถ) -----
        const stockGroups = {};
        (Array.isArray(stock) ? stock : []).forEach((s) => {
          const key = normModel(s.model_code) + "|" + normColor(s.color_name);
          if (!stockGroups[key]) stockGroups[key] = [];
          stockGroups[key].push(s);
        });
        const queueGroups = {};
        all.filter((b) => b.status === "จอง").forEach((b) => {
          const mc = b.new_model_code || b.model_code || "";
          const cn = b.new_color_name || b.color_name || "";
          const key = mc + "|" + cn;
          if (!queueGroups[key]) queueGroups[key] = [];
          queueGroups[key].push(b);
        });
        Object.keys(queueGroups).forEach((key) => {
          queueGroups[key].sort((a, b) => {
            const dtA = new Date(a.booking_date).getTime();
            const dtB = new Date(b.booking_date).getTime();
            if (dtA !== dtB) return dtA - dtB;
            const dA = (a.deposit_no || "").toString();
            const dB = (b.deposit_no || "").toString();
            if (dA && dB) return dA.localeCompare(dB, undefined, { numeric: true });
            return 0;
          });
        });

        let queue = null;
        if (booking.status === "จอง") {
          const mc = booking.new_model_code || booking.model_code || "";
          const cn = booking.new_color_name || booking.color_name || "";
          const grp = queueGroups[mc + "|" + cn] || [];
          const idx = grp.findIndex((b) => b.booking_id === booking.booking_id);
          const cars = stockGroups[normModel(mc) + "|" + normColor(cn)] || [];
          queue = {
            pos: idx + 1,
            total: grp.length,
            stockQty: cars.length,
            arrived: idx >= 0 && idx < cars.length, // มีรถในสต๊อกถึงลำดับคิวเรา = รถถึงคิวแล้ว
            carBranch: (idx >= 0 && cars[idx]) ? (cars[idx].branch_name || "") : "",
          };
        }
        setInfo({ booking, queue });
        setAsOf(new Date());
        setPhase("ok");
      } catch (e) {
        console.warn("load queue failed:", e);
        setPhase("error");
      }
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const b = info?.booking;
  const q = info?.queue;
  const carLine = b ? [b.brand, b.marketing_name, b.new_model_code || b.model_code, b.new_color_name || b.color_name].filter(Boolean).join(" / ") : "";

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.header}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>🏍️ สถานะคิวจองรถ</div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>ตรวจสอบลำดับคิวของรถที่คุณจอง</div>
        </div>

        {phase === "loading" && <div style={S.center}>กำลังตรวจสอบสถานะ…</div>}
        {phase === "notfound" && <div style={S.center}>❌ ไม่พบข้อมูลการจอง<br /><span style={{ fontSize: 13, color: "#888" }}>กรุณาติดต่อพนักงานสาขา</span></div>}
        {phase === "error" && (
          <div style={S.center}>
            ⚠️ ตรวจสอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
            <div><button onClick={load} style={S.refreshBtn}>🔄 ลองใหม่</button></div>
          </div>
        )}

        {phase === "ok" && b && (
          <div style={{ padding: 16 }}>
            {/* สถานะหลัก */}
            {b.status === "จอง" && q && (
              <div style={{ ...S.statusBox, background: q.arrived ? "#ecfdf3" : "#fffaeb", borderColor: q.arrived ? "#12b76a" : "#f59e0b" }}>
                {q.arrived ? (
                  <>
                    <div style={{ fontSize: 34 }}>🔔</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#067647" }}>รถถึงคิวของคุณแล้ว!</div>
                    <div style={{ fontSize: 13, color: "#475467", marginTop: 4 }}>กรุณาติดต่อสาขาเพื่อนัดรับรถ{q.carBranch ? ` (รถอยู่ที่ ${q.carBranch})` : ""}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: "#475467" }}>คุณอยู่คิวที่</div>
                    <div style={{ fontSize: 44, fontWeight: 800, color: "#b54708", lineHeight: 1.1 }}>{q.pos}</div>
                    <div style={{ fontSize: 13, color: "#475467" }}>จากผู้จองรุ่น/สีเดียวกัน {q.total} คิว</div>
                    <div style={{ fontSize: 13, color: "#475467", marginTop: 4 }}>
                      {q.stockQty > 0 ? `ตอนนี้มีรถรุ่นนี้ในสต๊อก ${q.stockQty} คัน` : "รอรถเข้าสต๊อก — ทางร้านจะติดต่อเมื่อรถถึงคิว"}
                    </div>
                  </>
                )}
              </div>
            )}
            {b.status === "ขาย" && (
              <div style={{ ...S.statusBox, background: "#ecfdf3", borderColor: "#12b76a" }}>
                <div style={{ fontSize: 34 }}>✅</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#067647" }}>รับรถเรียบร้อยแล้ว</div>
                <div style={{ fontSize: 13, color: "#475467", marginTop: 4 }}>ขอบคุณที่ใช้บริการครับ 🙏</div>
              </div>
            )}
            {b.status === "ยกเลิก" && (
              <div style={{ ...S.statusBox, background: "#fef3f2", borderColor: "#f04438" }}>
                <div style={{ fontSize: 34 }}>🚫</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#b42318" }}>การจองถูกยกเลิกแล้ว</div>
                <div style={{ fontSize: 13, color: "#475467", marginTop: 4 }}>สอบถามเพิ่มเติมกรุณาติดต่อสาขา</div>
              </div>
            )}

            {/* รายละเอียดการจอง */}
            <div style={S.detail}>
              <Row label="เลขที่ใบมัดจำ" value={b.deposit_no || "-"} mono />
              <Row label="วันที่จอง" value={thaiDate(b.booking_date)} />
              <Row label="ลูกค้า" value={b.customer_name || "-"} />
              <Row label="รถที่จอง" value={carLine || "-"} />
              <Row label="สาขา" value={b.branch || "-"} />
              {b.appointment_date && <Row label="วันนัดรับรถ" value={thaiDate(b.appointment_date)} />}
            </div>

            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={load} style={S.refreshBtn}>🔄 รีเฟรชสถานะ</button>
              <div style={{ marginTop: 8, fontSize: 12, color: "#98a2b3" }}>
                ข้อมูล ณ {(asOf || new Date()).toLocaleString("th-TH")} — ลำดับคิวอาจเปลี่ยนแปลงได้
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid #f2f4f7", fontSize: 14 }}>
      <span style={{ color: "#667085", flex: "0 0 auto" }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right", fontFamily: mono ? "monospace" : undefined, wordBreak: "break-all" }}>{value}</span>
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
  refreshBtn: { marginTop: 10, padding: "10px 24px", fontSize: 15, fontWeight: 700, color: "#fff", background: "#2563eb", border: "none", borderRadius: 8, cursor: "pointer" },
};
