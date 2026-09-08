import React, { useEffect, useState } from "react";

// ============================================================================
// POP UP ตอนเข้าระบบ: แคมเปญค่าคอมพิเศษ AEROX (STEP COMMISSION) ก.ย.–ต.ค. 2569 — user 2026-09-08
// - STD: ต้องขายได้ "แต่ละเดือน" ≥ 15 คัน (ก.ย. 15 / ต.ค. 15)
// - STU (step ค่าคอม/คัน) คิดจากยอดรวม ก.ย.–ต.ค. ทุกร้าน: 1–9 = 1,000 · 10–14 = 1,500 · 15–19 = 2,000 · 20 ขึ้นไป = 3,000 บาท/คัน
// - แสดงยอดรวมทุกร้าน + ยอดแต่ละร้าน × step ปัจจุบัน
// แหล่งข้อมูล: ใบขายระบบ NEW (retail_sales) ยี่ห้อ YAMAHA รุ่น Aerox ไม่นับใบยกเลิก/ขายส่ง
// ============================================================================
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
export const AEROX_CAMPAIGN = {
  from: "2026-09-01", to: "2026-10-31",
  months: [{ ym: "2026-09", label: "ก.ย.", std: 15 }, { ym: "2026-10", label: "ต.ค.", std: 15 }],
  tiers: [
    { min: 1, max: 9, rate: 1000, label: "1-9 Unit" },
    { min: 10, max: 14, rate: 1500, label: "10-14 Unit" },
    { min: 15, max: 19, rate: 2000, label: "15-19 Unit" },
    { min: 20, max: Infinity, rate: 3000, label: "20 Unit Up" },
  ],
};
export const isAeroxCampaignActive = (iso = new Date().toISOString().slice(0, 10)) => iso >= AEROX_CAMPAIGN.from && iso <= AEROX_CAMPAIGN.to;

const fmt = (n) => Number(n || 0).toLocaleString("th-TH");
const tierOf = (units) => AEROX_CAMPAIGN.tiers.find((t) => units >= t.min && units <= t.max) || null;

export default function AeroxCampaignPopup({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null); // { total, byMonth, branches:[{code,name,units,byMonth}] }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(RETAIL_API, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_retail_sales", date_from: AEROX_CAMPAIGN.from, date_to: AEROX_CAMPAIGN.to, limit: 5000 }) });
        const rows = await res.json().catch(() => []);
        const sales = (Array.isArray(rows) ? rows : []).filter((r) => r && r.invoice_no
          && String(r.brand || "").toUpperCase() === "YAMAHA"
          && /AEROX/i.test(`${r.model_name || ""} ${r.model_code || ""}`)
          && String(r.sale_status || "10") !== "90"
          && String(r.note || "") !== "ขายส่ง");
        const byMonth = {}; const br = {};
        for (const s of sales) {
          const ym = String(s.sale_date || "").slice(0, 7);
          byMonth[ym] = (byMonth[ym] || 0) + 1;
          const code = String(s.branch_code || "").slice(0, 5).toUpperCase() || "-";
          if (!br[code]) br[code] = { code, name: String(s.branch_code || s.branch_name || code), units: 0, byMonth: {} };
          br[code].units += 1; br[code].byMonth[ym] = (br[code].byMonth[ym] || 0) + 1;
        }
        if (alive) setData({ total: sales.length, byMonth, branches: Object.values(br).sort((a, b) => b.units - a.units || a.code.localeCompare(b.code)) });
      } catch (e) { if (alive) setErr("โหลดยอดขายไม่สำเร็จ"); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const total = data?.total || 0;
  const tier = tierOf(total);
  const rate = tier ? tier.rate : 0;
  const stdOk = AEROX_CAMPAIGN.months.map((m) => ({ ...m, units: data?.byMonth?.[m.ym] || 0, ok: (data?.byMonth?.[m.ym] || 0) >= m.std }));
  const allStdOk = stdOk.every((m) => m.ok);
  const commission = total * rate;
  const th = { padding: "6px 8px", fontSize: 12.5, background: "#f1f5f9", border: "1px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap" };
  const td = { padding: "6px 8px", fontSize: 13, border: "1px solid #e2e8f0" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, fontFamily: "Tahoma" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: 720, maxWidth: "96vw", maxHeight: "92vh", overflow: "auto", boxShadow: "0 10px 40px rgba(0,0,0,.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#7c2d12" }}>🏁 แคมเปญค่าคอมพิเศษ AEROX — STEP COMMISSION</div>
          <button onClick={onClose} style={{ border: "none", background: "#e5e7eb", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>✕ ปิด</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 12 }}>ระยะเวลา 1 ก.ย. – 31 ต.ค. 2569 · นับจากใบขายระบบ (YAMAHA Aerox ทุกร้าน ไม่รวมยกเลิก/ขายส่ง) · อัปเดตล่าสุด {new Date().toLocaleString("th-TH")}</div>

        {loading ? <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>⏳ กำลังคำนวณยอด…</div> : err ? <div style={{ color: "#b91c1c" }}>{err}</div> : (
          <>
            {/* สรุปยอดรวม + step ปัจจุบัน */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#1e40af" }}>ยอดขายรวมทุกร้าน (ก.ย.–ต.ค.)</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: "#1e3a8a" }}>{fmt(total)} <span style={{ fontSize: 14 }}>คัน</span></div>
              </div>
              <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#9a3412" }}>STEP ปัจจุบัน</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#c2410c" }}>{tier ? tier.label : "ยังไม่มียอด"}</div>
                <div style={{ fontSize: 13, color: "#9a3412" }}>{tier ? `${fmt(rate)} บาท/คัน` : "—"}</div>
              </div>
              <div style={{ background: allStdOk ? "#f0fdf4" : "#fef2f2", border: `1px solid ${allStdOk ? "#bbf7d0" : "#fecaca"}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: allStdOk ? "#166534" : "#991b1b" }}>ค่าคอม ณ ปัจจุบัน (ยอดรวม × step)</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: allStdOk ? "#15803d" : "#b91c1c" }}>{fmt(commission)} <span style={{ fontSize: 13 }}>บาท</span></div>
                <div style={{ fontSize: 11, color: allStdOk ? "#166534" : "#991b1b" }}>{allStdOk ? "ผ่านเงื่อนไข STD ครบทุกเดือน" : "ยังไม่ผ่านเงื่อนไข STD (ต้องขายเดือนละ ≥ 15 คัน)"}</div>
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
                <div style={{ fontWeight: 700, marginBottom: 6 }}>STU — ค่าคอมต่อคัน (ยอดรวม ก.ย.–ต.ค.)</div>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead><tr><th style={th}>ช่วงยอดขาย</th><th style={{ ...th, textAlign: "right" }}>ค่าคอม/คัน</th></tr></thead>
                  <tbody>
                    {AEROX_CAMPAIGN.tiers.map((t) => {
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
                  {AEROX_CAMPAIGN.months.map((m) => <th key={m.ym} style={{ ...th, textAlign: "right" }}>{m.label}</th>)}
                  <th style={{ ...th, textAlign: "right" }}>รวม (คัน)</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าคอม ณ ปัจจุบัน</th>
                </tr>
              </thead>
              <tbody>
                {data.branches.length === 0 && <tr><td style={{ ...td, textAlign: "center", color: "#9ca3af" }} colSpan={AEROX_CAMPAIGN.months.length + 3}>ยังไม่มียอดขาย Aerox ในช่วงแคมเปญ</td></tr>}
                {data.branches.map((b) => (
                  <tr key={b.code}>
                    <td style={td}>{b.name}</td>
                    {AEROX_CAMPAIGN.months.map((m) => <td key={m.ym} style={{ ...td, textAlign: "right" }}>{fmt(b.byMonth[m.ym] || 0)}</td>)}
                    <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(b.units)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#15803d" }}>{fmt(b.units * rate)}</td>
                  </tr>
                ))}
                {data.branches.length > 0 && (
                  <tr style={{ background: "#fef9c3" }}>
                    <td style={{ ...td, fontWeight: 800 }}>รวมทุกร้าน</td>
                    {AEROX_CAMPAIGN.months.map((m) => <td key={m.ym} style={{ ...td, textAlign: "right", fontWeight: 800 }}>{fmt(data.byMonth[m.ym] || 0)}</td>)}
                    <td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{fmt(total)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#15803d" }}>{fmt(commission)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 10 }}>
              * ค่าคอมต่อคันคิดจาก STEP ของยอดรวมทุกร้าน แล้วคูณยอดของแต่ละร้าน · จะได้รับจริงเมื่อผ่าน STD ครบทั้ง 2 เดือน (เดือนละ ≥ 15 คัน)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
