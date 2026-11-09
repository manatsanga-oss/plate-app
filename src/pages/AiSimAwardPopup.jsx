import React, { useEffect, useState } from "react";

// POP UP ตอนเข้าระบบ: ประกาศผลรางวัลฝึกตอบลูกค้า (AI ลูกค้าจำลอง) — user 2026-10-31, ปรับเป็นรอบอัตโนมัติ 2026-11-09
// กติกา (user 2026-11-09): แข่งเป็นรอบ ๆ ละสัปดาห์ในเดือน 1–7, 8–14, 15–21, 22–สิ้นเดือน (เศษท้ายเดือนก็นับเป็นรอบ ประกาศเลย)
//   ช่วงประกาศ = สัปดาห์ถัดไป: ผล 1–7 ขึ้น 8–14 · ผล 8–14 ขึ้น 15–21 · ผล 15–21 ขึ้น 22–สิ้นเดือน · ผล 22–สิ้นเดือน + "สรุปทั้งเดือน" ขึ้น 1–7 ของเดือนถัดไป
//   อันดับใช้ "คะแนนถ่วงน้ำหนักตามจำนวนข้อ" สูตรเดียวกับ AiSimReportPage (Bayesian K=10) เท่ากันดูเฉลี่ย แล้วดูจำนวนข้อ · ไม่นับบัญชีระบบ
//   รอบใหม่ขึ้นเองทุกสัปดาห์ ไม่ต้องตั้งค่าเพิ่ม — เงินรางวัลแก้ที่ AI_SIM_AWARD.prizes (รอบสัปดาห์) / monthlyPrizes (สรุปเดือน)
const AI_API = "https://n8n-new-project-gwf2.onrender.com/webhook/ai-reception-api";
const WEIGHT_K = 10; // เท่ากับ AiSimReportPage
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const AI_SIM_AWARD = {
  prizes: [ // รอบสัปดาห์
    { medal: "🥇", label: "รางวัลที่ 1", amount: 1000, bg: "#fef9c3", border: "#eab308", color: "#854d0e" },
    { medal: "🥈", label: "รางวัลที่ 2", amount: 500, bg: "#f1f5f9", border: "#94a3b8", color: "#334155" },
    { medal: "🥉", label: "รางวัลที่ 3", amount: 200, bg: "#ffedd5", border: "#f97316", color: "#9a3412" },
  ],
  monthlyPrizes: [ // สรุปทั้งเดือน (ตั้งเท่ารอบสัปดาห์ไว้ก่อน — user ยังไม่ระบุ)
    { medal: "🏆", label: "ยอดเยี่ยมประจำเดือน", amount: 1000, bg: "#fef9c3", border: "#eab308", color: "#854d0e" },
    { medal: "🥈", label: "รองอันดับ 1", amount: 500, bg: "#f1f5f9", border: "#94a3b8", color: "#334155" },
    { medal: "🥉", label: "รองอันดับ 2", amount: 200, bg: "#ffedd5", border: "#f97316", color: "#9a3412" },
  ],
  excludeStaff: ["ผู้ดูแลระบบ", "ทดสอบระบบ"], // บัญชีระบบ ไม่ใช่พนักงาน
  startIso: "2026-11-01", // เริ่มนับรอบสัปดาห์ตั้งแต่ พ.ย. 69 (ต.ค. ประกาศแบบทั้งเดือนไปแล้ว 1–7 พ.ย.)
};
const pad = (n) => String(n).padStart(2, "0");
const todayIso = () => new Date().toLocaleDateString("en-CA");
const lastDay = (y, m) => new Date(y, m, 0).getDate(); // m = 1..12
const thM = (y, m) => `${TH_MONTHS[m - 1]} ${y + 543}`;

/** รอบที่ต้องประกาศ ณ วันที่ iso (อาจมี 2 รอบช่วง 1–7: เศษท้ายเดือนก่อน + สรุปทั้งเดือนก่อน) */
export function aiSimRoundsFor(iso = todayIso()) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return [];
  const week = (yy, mm, a, b) => ({ kind: "week", from: `${yy}-${pad(mm)}-${pad(a)}`, to: `${yy}-${pad(mm)}-${pad(b)}`, label: `รอบ ${a}–${b} ${thM(yy, mm)}` });
  const out = [];
  if (d <= 7) {
    const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1, ld = lastDay(py, pm);
    out.push(week(py, pm, 22, ld));
    out.push({ kind: "month", from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(ld)}`, label: `สรุปทั้งเดือน ${thM(py, pm)}` });
  } else if (d <= 14) out.push(week(y, m, 1, 7));
  else if (d <= 21) out.push(week(y, m, 8, 14));
  else out.push(week(y, m, 15, 21));
  return out.filter((r) => r.to >= AI_SIM_AWARD.startIso);
}
export const isAiSimAwardActive = (iso = todayIso()) => aiSimRoundsFor(iso).length > 0;

/** รอบรางวัลทั้งหมดของเดือน y/m (ใช้รวมยอดรางวัลเข้ารายงานค่าคอมปกติ — user 2026-11-09 "ค่าคอมปกติ เพิ่มรางวัลพิเศษตอบคำถาม AI ประจำเดือน")
 *  ก่อน พ.ย. 69 (ต.ค.) = ประกาศทั้งเดือนรอบเดียว จัดอันดับเฉลี่ยธรรมดา รางวัล prizes · ตั้งแต่ พ.ย. 69 = 4 รอบสัปดาห์ (prizes) + สรุปทั้งเดือน (monthlyPrizes) ถ่วงน้ำหนัก */
export function aiSimMonthRounds(y, m) {
  const ld = lastDay(y, m);
  const mk = (a, b, kind, label) => ({ kind, from: `${y}-${pad(m)}-${pad(a)}`, to: `${y}-${pad(m)}-${pad(b)}`, label });
  if (`${y}-${pad(m)}-01` < AI_SIM_AWARD.startIso) {
    return [{ ...mk(1, ld, "month", `ประจำเดือน ${thM(y, m)}`), prizes: AI_SIM_AWARD.prizes, weighted: false }];
  }
  return [
    ...[[1, 7], [8, 14], [15, 21], [22, ld]].map(([a, b]) => ({ ...mk(a, b, "week", `รอบ ${a}–${b} ${thM(y, m)}`), prizes: AI_SIM_AWARD.prizes, weighted: true })),
    { ...mk(1, ld, "month", `สรุปทั้งเดือน ${thM(y, m)}`), prizes: AI_SIM_AWARD.monthlyPrizes, weighted: true },
  ];
}

export function rankStaff(rows, { weighted = true } = {}) {
  const map = new Map();
  for (const r of rows) {
    const name = String(r?.staff_name || "").trim();
    if (!name || AI_SIM_AWARD.excludeStaff.includes(name)) continue;
    if (r.score === null || r.score === undefined || r.score === "") continue;
    if (!map.has(name)) map.set(name, { name, branch: r.branch_code || "", scored: 0, sum: 0 });
    const s = map.get(name);
    s.scored += 1; s.sum += Number(r.score);
  }
  const all = [...map.values()];
  const totScored = all.reduce((t, s) => t + s.scored, 0), totSum = all.reduce((t, s) => t + s.sum, 0);
  const C = totScored ? totSum / totScored : 0; // ค่าเฉลี่ยรวมทุกคนในรอบ
  const ranked = all.map((s) => ({ ...s, avg: s.sum / s.scored, wavg: (s.sum + WEIGHT_K * C) / (s.scored + WEIGHT_K) }));
  if (!weighted) return ranked.sort((a, b) => b.avg - a.avg || b.scored - a.scored); // รอบ ต.ค. 69 (ก่อนเปลี่ยนกติกา) ใช้เฉลี่ยธรรมดา
  return ranked.sort((a, b) => b.wavg - a.wavg || b.avg - a.avg || b.scored - a.scored);
}

export default function AiSimAwardPopup({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sections, setSections] = useState([]); // [{ round, winners }]
  const rounds = aiSimRoundsFor();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const out = [];
        for (const round of rounds) { // ทีละรอบ (n8n 1 CPU)
          const res = await fetch(AI_API, { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sim_report", date_from: round.from, date_to: round.to }) });
          const data = await res.json();
          const prizes = round.kind === "month" ? AI_SIM_AWARD.monthlyPrizes : AI_SIM_AWARD.prizes;
          out.push({ round, prizes, winners: rankStaff(Array.isArray(data) ? data : [data]).slice(0, prizes.length) });
        }
        if (alive) setSections(out);
      } catch { if (alive) setErr("โหลดผลรางวัลไม่สำเร็จ"); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line
  }, []);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, fontFamily: "Tahoma", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: 720, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 10px 40px rgba(0,0,0,.35)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0b2447" }}>🏆 ประกาศผลรางวัลฝึกตอบลูกค้า (AI ลูกค้าจำลอง)</div>
          <button onClick={onClose} style={{ border: "none", background: "#e5e7eb", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>✕ ปิด</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 14 }}>จัดอันดับด้วยคะแนนถ่วงน้ำหนักตามจำนวนข้อ (ตอบมากข้อและคะแนนดีจึงจะขึ้นอันดับ) · แข่งรอบละสัปดาห์ 1–7 / 8–14 / 15–21 / 22–สิ้นเดือน และสรุปทั้งเดือน</div>

        {loading ? <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>⏳ กำลังโหลดผลรางวัล…</div>
          : err ? <div style={{ padding: 20, textAlign: "center", color: "#b91c1c" }}>{err}</div>
          : sections.map(({ round, prizes, winners }) => (
            <div key={round.from + round.kind} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: round.kind === "month" ? "#7c2d12" : "#0b2447", margin: "6px 0 10px", padding: "6px 10px", background: round.kind === "month" ? "#fff7ed" : "#eff6ff", borderRadius: 8 }}>
                {round.kind === "month" ? "🏅 " : "📅 "}{round.label}
              </div>
              {winners.length === 0 ? <div style={{ padding: 14, textAlign: "center", color: "#64748b" }}>ไม่มีข้อมูลคะแนนในรอบนี้</div> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                  {winners.map((w, i) => {
                    const p = prizes[i];
                    return (
                      <div key={w.name} style={{ background: p.bg, border: `2px solid ${p.border}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
                        <div style={{ fontSize: 40, lineHeight: 1.1 }}>{p.medal}</div>
                        <div style={{ fontWeight: 700, color: p.color, marginTop: 4 }}>{p.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: "8px 0 2px" }}>{w.name}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>สาขา {w.branch || "-"}</div>
                        <div style={{ fontSize: 13, color: "#334155", marginTop: 8 }}>ถ่วงน้ำหนัก <b>{w.wavg.toFixed(2)}</b> · เฉลี่ย {w.avg.toFixed(1)} / 10 · {w.scored} ข้อ</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "#15803d", marginTop: 8 }}>{p.amount.toLocaleString("th-TH")} <span style={{ fontSize: 14 }}>บาท</span></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
