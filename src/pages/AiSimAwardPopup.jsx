import React, { useEffect, useState } from "react";

// POP UP ตอนเข้าระบบ: ประกาศผลรางวัลฝึกตอบลูกค้า (AI ลูกค้าจำลอง) รอบ ต.ค. 2569 — user 2026-10-31
// อันดับใช้สูตรเดียวกับ AiSimReportPage: คะแนนเฉลี่ยจากคำตอบที่มีคะแนน มากไปน้อย · เท่ากันให้คนที่มีคำตอบมากกว่าได้อันดับดีกว่า
const AI_API = "https://n8n-new-project-gwf2.onrender.com/webhook/ai-reception-api";
export const AI_SIM_AWARD = {
  from: "2026-10-01", to: "2026-10-31", // รอบคะแนน
  showFrom: "2026-11-01", showTo: "2026-11-07", // ช่วงที่ขึ้น POP UP
  prizes: [
    { medal: "🥇", label: "รางวัลที่ 1", amount: 1000, bg: "#fef9c3", border: "#eab308", color: "#854d0e" },
    { medal: "🥈", label: "รางวัลที่ 2", amount: 500, bg: "#f1f5f9", border: "#94a3b8", color: "#334155" },
    { medal: "🥉", label: "รางวัลที่ 3", amount: 200, bg: "#ffedd5", border: "#f97316", color: "#9a3412" },
  ],
  excludeStaff: ["ผู้ดูแลระบบ", "ทดสอบระบบ"], // บัญชีระบบ ไม่ใช่พนักงาน
};
export const isAiSimAwardActive = (iso = new Date().toLocaleDateString("en-CA")) => iso >= AI_SIM_AWARD.showFrom && iso <= AI_SIM_AWARD.showTo;

function rankStaff(rows) {
  const map = new Map();
  for (const r of rows) {
    const name = String(r?.staff_name || "").trim();
    if (!name || AI_SIM_AWARD.excludeStaff.includes(name)) continue;
    if (r.score === null || r.score === undefined || r.score === "") continue;
    if (!map.has(name)) map.set(name, { name, branch: r.branch_code || "", scored: 0, sum: 0 });
    const s = map.get(name);
    s.scored += 1; s.sum += Number(r.score);
  }
  return [...map.values()].map((s) => ({ ...s, avg: s.sum / s.scored })).sort((a, b) => b.avg - a.avg || b.scored - a.scored);
}

export default function AiSimAwardPopup({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [winners, setWinners] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(AI_API, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sim_report", date_from: AI_SIM_AWARD.from, date_to: AI_SIM_AWARD.to }) });
        const data = await res.json();
        if (alive) setWinners(rankStaff(Array.isArray(data) ? data : [data]).slice(0, AI_SIM_AWARD.prizes.length));
      } catch { if (alive) setErr("โหลดผลรางวัลไม่สำเร็จ"); }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, fontFamily: "Tahoma", padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: 720, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 10px 40px rgba(0,0,0,.35)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0b2447" }}>🏆 ประกาศผลรางวัลฝึกตอบลูกค้า (AI ลูกค้าจำลอง)</div>
          <button onClick={onClose} style={{ border: "none", background: "#e5e7eb", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>✕ ปิด</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 14 }}>พนักงานที่ทำคะแนนเฉลี่ยสูงสุด รอบ 1–31 ต.ค. 2569</div>

        {loading ? <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>⏳ กำลังโหลดผลรางวัล…</div>
          : err ? <div style={{ padding: 20, textAlign: "center", color: "#b91c1c" }}>{err}</div>
          : winners.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "#64748b" }}>ไม่มีข้อมูลคะแนนในรอบนี้</div>
          : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
              {winners.map((w, i) => {
                const p = AI_SIM_AWARD.prizes[i];
                return (
                  <div key={w.name} style={{ background: p.bg, border: `2px solid ${p.border}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 40, lineHeight: 1.1 }}>{p.medal}</div>
                    <div style={{ fontWeight: 700, color: p.color, marginTop: 4 }}>{p.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: "8px 0 2px" }}>{w.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>สาขา {w.branch || "-"}</div>
                    <div style={{ fontSize: 13, color: "#334155", marginTop: 8 }}>คะแนนเฉลี่ย <b>{w.avg.toFixed(1)}</b> / 10 · {w.scored} ข้อ</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#15803d", marginTop: 8 }}>{p.amount.toLocaleString("th-TH")} <span style={{ fontSize: 14 }}>บาท</span></div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
