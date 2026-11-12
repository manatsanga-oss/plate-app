import React, { useEffect, useState } from "react";
import AeroxSplitTable from "./AeroxSplitTable";
import { aeroxCampaignResult, loadAeroxCampaign, loadAeroxSplit, thaiLongDate } from "../utils/aeroxCampaign";

// ============================================================================
// POP UP ตอนเข้าระบบ: ประกาศผลค่าคอมพิเศษเฉพาะรุ่น (AEROX) ของรอบที่จบแล้ว + แจ้งวันเงินเข้า — user 2026-11-12
//   "เพิ่มรายงานค่าคอมพิเศษเฉพาะรุ่น หน้า pop up วันนี้ แจ้งว่าเงินเข้า 10 ธันวาคม 2569"
// เนื้อหา: สรุปยอดรวม/STEP/ค่าคอมรวม + ตารางแบ่งรายคน (ชุดเดียวกับเมนู HR → ค่าคอมพิเศษเฉพาะรุ่น: เฉลี่ยรายใบขายให้คนมีสิทธิ์ที่มาทำงานจริงวันขาย)
// ขึ้นสลับวันกับ POP UP ต่อแคมเปญ และผลแข่งขัน AI (utils/loginPopups.js) จนถึงวันเงินเข้า (campaign.payoutDate)
// ============================================================================
const fmt = (n) => Number(n || 0).toLocaleString("th-TH");

export default function AeroxResultPopup({ onClose, campaign }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [split, setSplit] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await loadAeroxCampaign(campaign);
        let s = null;
        try { s = await loadAeroxSplit(d, aeroxCampaignResult(d).rate); } catch { s = null; }
        if (alive) { setData(d); setSplit(s); }
      } catch { if (alive) setErr("โหลดยอดขายไม่สำเร็จ"); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [campaign]);

  const { total, tier, rate, commission, payoutDate } = aeroxCampaignResult(data);
  const box = { borderRadius: 10, padding: 10, textAlign: "center" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, fontFamily: "Tahoma" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: 860, maxWidth: "96vw", maxHeight: "92vh", overflow: "auto", boxShadow: "0 10px 40px rgba(0,0,0,.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#7c2d12" }}>🏁 ผลค่าคอมพิเศษเฉพาะรุ่น AEROX — รอบ {campaign.shortLabel} 2569</div>
          <button onClick={onClose} style={{ border: "none", background: "#e5e7eb", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>✕ ปิด</button>
        </div>
        {campaign.payoutDate && (
          <div style={{ padding: "12px 14px", background: "#f0fdf4", border: "2px solid #22c55e", borderRadius: 12, marginBottom: 12, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#166534" }}>💰 กำหนดจ่ายค่าคอมพิเศษ AEROX รอบ {campaign.shortLabel} 2569</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#15803d" }}>เงินเข้าวันที่ {thaiLongDate(campaign.payoutDate)}</div>
          </div>
        )}
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 10 }}>ระยะเวลาแคมเปญ {campaign.periodLabel} · นับจากใบขายระบบ (YAMAHA Aerox ทุกร้าน ไม่รวมยกเลิก/ขายส่ง)</div>

        {loading ? <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>⏳ กำลังคำนวณยอด…</div> : err ? <div style={{ color: "#b91c1c" }}>{err}</div> : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
              <div style={{ ...box, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: 12, color: "#1e40af" }}>ยอดขายรวมทุกร้าน</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#1e3a8a" }}>{fmt(total)} <span style={{ fontSize: 13 }}>คัน</span></div>
                <div style={{ fontSize: 11.5, color: "#1e40af" }}>{campaign.months.map((m) => `${m.label} ${fmt(data?.byMonth?.[m.ym] || 0)}`).join(" · ")}</div>
              </div>
              <div style={{ ...box, background: "#fff7ed", border: "1px solid #fed7aa" }}>
                <div style={{ fontSize: 12, color: "#9a3412" }}>STEP ที่ได้</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#c2410c" }}>{tier ? tier.label : "—"}</div>
                <div style={{ fontSize: 12.5, color: "#9a3412" }}>{tier ? `${fmt(rate)} บาท/คัน` : "—"}</div>
              </div>
              <div style={{ ...box, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: 12, color: "#166534" }}>ค่าคอมรวม (ยอดรวม × step)</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#15803d" }}>{fmt(commission)} <span style={{ fontSize: 13 }}>บาท</span></div>
                <div style={{ fontSize: 11.5, color: "#166534" }}>{payoutDate ? `เงินเข้า ${thaiLongDate(payoutDate)}` : ""}</div>
              </div>
            </div>
            <AeroxSplitTable data={data} split={split} hrNote={false} />
          </>
        )}
      </div>
    </div>
  );
}
