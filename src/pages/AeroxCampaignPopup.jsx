import React, { useEffect, useState } from "react";

// ============================================================================
// POP UP ตอนเข้าระบบ: แคมเปญค่าคอมพิเศษ AEROX (STEP COMMISSION) — user 2026-09-08 (รอบ ก.ย.–ต.ค. 2569)
// - STD: ต้องขายได้ "แต่ละเดือน" ตามเป้า (รอบ ก.ย.–ต.ค. เดือนละ 15 คัน · รอบ พ.ย.–ธ.ค. เดือนละ 20 คัน)
// - STU (step ค่าคอม/คัน) คิดจากยอดรวมทั้งรอบ ทุกร้าน: 1–9 = 1,000 · 10–14 = 1,500 · 15–19 = 2,000 · 20 ขึ้นไป = 3,000 บาท/คัน
// - แสดงยอดรวมทุกร้าน + ยอดแต่ละร้าน × step ปัจจุบัน
// แหล่งข้อมูล: ใบขายระบบ NEW (retail_sales) ยี่ห้อ YAMAHA รุ่น Aerox ไม่นับใบยกเลิก/ขายส่ง
// 2026-11-12: รองรับหลายรอบ (prop campaign — config อยู่ utils/aeroxCampaign.js AEROX_CAMPAIGNS) + ต่อแคมเปญ พ.ย.–ธ.ค. 2569
// ============================================================================
import { AEROX_CAMPAIGN, aeroxCampaignResult, loadAeroxCampaign, thaiLongDate } from "../utils/aeroxCampaign";

const fmt = (n) => Number(n || 0).toLocaleString("th-TH");

// ส่วนแสดงผลแคมเปญ: การ์ดสรุป + ตาราง STD/STU + ยอดรายร้าน — ใช้ทั้งใน POP UP และหน้า HR
export function AeroxCampaignBody({ data }) {
  const { campaign, total, tier, rate, stdOk, allStdOk, payable, payoutDate, commission } = aeroxCampaignResult(data);
  const th = { padding: "6px 8px", fontSize: 12.5, background: "#f1f5f9", border: "1px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap" };
  const td = { padding: "6px 8px", fontSize: 13, border: "1px solid #e2e8f0" };
  if (!data) return null;
  const stdText = campaign.months.map((m) => `${m.label} ${m.std}`).join(" / ");
  return (
    <>
      {/* สรุปยอดรวม + step ปัจจุบัน */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#1e40af" }}>ยอดขายรวมทุกร้าน ({campaign.shortLabel})</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#1e3a8a" }}>{fmt(total)} <span style={{ fontSize: 14 }}>คัน</span></div>
        </div>
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#9a3412" }}>STEP ปัจจุบัน</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#c2410c" }}>{tier ? tier.label : "ยังไม่มียอด"}</div>
          <div style={{ fontSize: 13, color: "#9a3412" }}>{tier ? `${fmt(rate)} บาท/คัน` : "—"}</div>
        </div>
        <div style={{ background: payable ? "#f0fdf4" : "#fef2f2", border: `1px solid ${payable ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: payable ? "#166534" : "#991b1b" }}>{payoutDate ? "ค่าคอมรวม (ยอดรวม × step)" : "ค่าคอม ณ ปัจจุบัน (ยอดรวม × step)"}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: payable ? "#15803d" : "#b91c1c" }}>{fmt(commission)} <span style={{ fontSize: 13 }}>บาท</span></div>
          <div style={{ fontSize: 11, color: payable ? "#166534" : "#991b1b" }}>
            {payoutDate ? `💰 เงินเข้า ${thaiLongDate(payoutDate)}` : allStdOk ? "ผ่านเงื่อนไข STD ครบทุกเดือน" : `ยังไม่ผ่านเงื่อนไข STD (${stdText} คัน)`}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* STD รายเดือน */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>STD — เป้าขั้นต่ำต่อเดือน</div>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th style={th}>เดือน</th><th style={{ ...th, textAlign: "right" }}>เป้า</th><th style={{ ...th, textAlign: "right" }}>ขายแล้ว</th><th style={th}>สถานะ</th></tr></thead>
            <tbody>
              {stdOk.map((m) => (
                <tr key={m.ym}>
                  <td style={td}>{m.label} 2569</td>
                  <td style={{ ...td, textAlign: "right" }}>{m.std}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(m.units)}</td>
                  <td style={{ ...td, color: m.ok ? "#15803d" : "#b91c1c", fontWeight: 700 }}>{m.ok ? "✓ ผ่าน" : `ขาดอีก ${m.std - m.units}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* STU steps */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>STU — ค่าคอมต่อคัน (ยอดรวม {campaign.shortLabel})</div>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th style={th}>ช่วงยอดขาย</th><th style={{ ...th, textAlign: "right" }}>ค่าคอม/คัน</th></tr></thead>
            <tbody>
              {campaign.tiers.map((t) => {
                const cur = tier && tier.min === t.min;
                return (
                  <tr key={t.min} style={{ background: cur ? "#fef3c7" : "#fff" }}>
                    <td style={{ ...td, fontWeight: cur ? 800 : 400 }}>{cur ? "▶ " : ""}{t.label}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: cur ? 800 : 400 }}>{fmt(t.rate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* รายร้าน */}
      <div style={{ fontWeight: 700, marginBottom: 6 }}>ยอดขายแต่ละร้าน × STEP ปัจจุบัน ({tier ? `${fmt(rate)} บาท/คัน` : "—"})</div>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>ร้าน</th>
            {campaign.months.map((m) => <th key={m.ym} style={{ ...th, textAlign: "right" }}>{m.label}</th>)}
            <th style={{ ...th, textAlign: "right" }}>รวม (คัน)</th>
            <th style={{ ...th, textAlign: "right" }}>ค่าคอม ณ ปัจจุบัน</th>
          </tr>
        </thead>
        <tbody>
          {data.branches.length === 0 && <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={campaign.months.length + 3}>ยังไม่มียอดขาย Aerox ในช่วงแคมเปญ</td></tr>}
          {data.branches.map((b) => (
            <tr key={b.code}>
              <td style={td}>{b.name}</td>
              {campaign.months.map((m) => <td key={m.ym} style={{ ...td, textAlign: "right" }}>{fmt(b.byMonth[m.ym] || 0)}</td>)}
              <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(b.units)}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#15803d" }}>{fmt(b.units * rate)}</td>
            </tr>
          ))}
          {data.branches.length > 0 && (
            <tr style={{ background: "#fef9c3" }}>
              <td style={{ ...td, fontWeight: 800 }}>รวมทุกร้าน</td>
              {campaign.months.map((m) => <td key={m.ym} style={{ ...td, textAlign: "right", fontWeight: 800 }}>{fmt(data.byMonth[m.ym] || 0)}</td>)}
              <td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{fmt(total)}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#15803d" }}>{fmt(commission)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 10 }}>
        * ค่าคอมต่อคันคิดจาก STEP ของยอดรวมทุกร้าน แล้วคูณยอดของแต่ละร้าน · {payoutDate ? `กำหนดเงินเข้า ${thaiLongDate(payoutDate)}` : `จะได้รับจริงเมื่อผ่าน STD ครบทั้ง ${campaign.months.length} เดือน (${stdText} คัน)`}
      </div>
    </>
  );
}

// campaign: รอบที่จะแสดง (ไม่ส่ง = รอบแรก) · continued: เป็นรอบ "ต่อแคมเปญ" (หัวข้อบอกว่ากติกาเดิม ต่ออีกรอบ)
export default function AeroxCampaignPopup({ onClose, campaign = AEROX_CAMPAIGN, continued = false }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null); // { campaign, total, byMonth, branches:[{code,name,units,byMonth}] }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await loadAeroxCampaign(campaign);
        if (alive) setData(d);
      } catch { if (alive) setErr("โหลดยอดขายไม่สำเร็จ"); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [campaign]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, fontFamily: "Tahoma" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: 720, maxWidth: "96vw", maxHeight: "92vh", overflow: "auto", boxShadow: "0 10px 40px rgba(0,0,0,.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#7c2d12" }}>🏁 {continued ? "ต่อแคมเปญค่าคอมพิเศษ AEROX" : "แคมเปญค่าคอมพิเศษ AEROX"} — STEP COMMISSION</div>
          <button onClick={onClose} style={{ border: "none", background: "#e5e7eb", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>✕ ปิด</button>
        </div>
        {continued && (
          <div style={{ padding: "8px 12px", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10, fontSize: 13.5, color: "#9a3412", fontWeight: 700, marginBottom: 8 }}>
            📣 แคมเปญ AEROX ต่ออีกรอบ {campaign.shortLabel} 2569 — ค่าคอมต่อคันตาม STEP เดิม · เป้า STD {campaign.months.map((m) => `${m.label} ${m.std} คัน`).join(" / ")}
          </div>
        )}
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 12 }}>ระยะเวลา {campaign.periodLabel} · นับจากใบขายระบบ (YAMAHA Aerox ทุกร้าน ไม่รวมยกเลิก/ขายส่ง) · อัปเดตล่าสุด {new Date().toLocaleString("th-TH")}</div>

        {loading ? <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>⏳ กำลังคำนวณยอด…</div> : err ? <div style={{ color: "#b91c1c" }}>{err}</div> : <AeroxCampaignBody data={data} />}
      </div>
    </div>
  );
}
