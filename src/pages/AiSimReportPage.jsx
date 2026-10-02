import React, { useEffect, useMemo, useState } from "react";

// รายงานฝึกตอบลูกค้า (AI ลูกค้าจำลอง "น้องเปาเปา") — user 2026-10-02
// แท็บ 1 สรุปการเข้าใช้ + คะแนนเฉลี่ยรายพนักงาน · แท็บ 2 รายละเอียดคำถาม-คำตอบ-คะแนนรายข้อ
// ข้อมูลจาก ai-reception-api action sim_report (ตาราง ai_reception_sim_logs: 1 แถว = 1 คำตอบของพนักงาน) — หน้าเว็บสรุปเอง
const AI_API = "https://n8n-new-project-gwf2.onrender.com/webhook/ai-reception-api";

const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const thaiDate = (s) => { const [y, m, d] = String(s || "").slice(0, 10).split("-"); return y && m && d ? `${Number(d)}/${Number(m)}/${Number(y) + 543}` : "-"; };
const thaiDateTime = (s) => (s ? `${thaiDate(s)} ${String(s).slice(11, 16)}` : "-");
const scoreColor = (v) => (v === null || v === undefined ? "#9e9e9e" : v >= 8 ? "#2e7d32" : v >= 5 ? "#ef6c00" : "#c62828");
const topicOf = (scenario) => { const m = /หัวข้อหลักที่อยากรู้: (.*?) \|/.exec(scenario || ""); return m ? m[1] : "-"; };
const bikeOf = (scenario) => { const m = /รถที่สนใจ: (.*?) \|/.exec(scenario || ""); return m ? m[1] : "-"; };

export default function AiSimReportPage() {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(isoDate(today));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("summary");
  const [staffFilter, setStaffFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  async function load() {
    setLoading(true); setMsg("");
    try {
      const res = await fetch(AI_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sim_report", date_from: dateFrom, date_to: dateTo }) });
      const data = await res.json();
      const list = (Array.isArray(data) ? data : [data]).filter(r => r && r.id);
      setRows(list.map(r => ({ ...r, score: r.score === null || r.score === undefined || r.score === "" ? null : Number(r.score) })));
      if (!list.length) setMsg("ไม่พบข้อมูลในช่วงวันที่ที่เลือก");
    } catch {
      setRows([]); setMsg("โหลดข้อมูลไม่สำเร็จ");
    }
    setLoading(false);
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const branches = useMemo(() => [...new Set(rows.map(r => r.branch_code).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => rows.filter(r => (!branchFilter || r.branch_code === branchFilter) && (!staffFilter || r.staff_name === staffFilter)), [rows, branchFilter, staffFilter]);

  // สรุปรายพนักงาน: วันที่เข้าใช้ / จำนวนลูกค้า (session) / จำนวนคำตอบ / คะแนนเฉลี่ย-ต่ำสุด-สูงสุด / ใช้ล่าสุด
  const summary = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (branchFilter && r.branch_code !== branchFilter) continue;
      const k = r.staff_name || "(ไม่ระบุชื่อ)";
      if (!map.has(k)) map.set(k, { staff: k, branches: new Set(), days: new Set(), sessions: new Set(), answers: 0, scored: 0, sum: 0, min: null, max: null, last: "", voice: 0 });
      const s = map.get(k);
      s.branches.add(r.branch_code); s.days.add(String(r.created_at).slice(0, 10)); s.sessions.add(r.session_id); s.answers++;
      if (r.answer_source === "voice") s.voice++;
      if (r.score !== null) { s.scored++; s.sum += r.score; s.min = s.min === null ? r.score : Math.min(s.min, r.score); s.max = s.max === null ? r.score : Math.max(s.max, r.score); }
      if (String(r.created_at) > s.last) s.last = String(r.created_at);
    }
    return [...map.values()].map(s => ({ ...s, avg: s.scored ? s.sum / s.scored : null })).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.answers - a.answers);
  }, [rows, branchFilter]);

  const total = useMemo(() => {
    const scored = filtered.filter(r => r.score !== null);
    return { answers: filtered.length, sessions: new Set(filtered.map(r => r.session_id)).size, staff: new Set(filtered.map(r => r.staff_name)).size, avg: scored.length ? scored.reduce((a, r) => a + r.score, 0) / scored.length : null };
  }, [filtered]);

  const th = { padding: "8px 10px", background: "#0b2447", color: "#fff", textAlign: "left", whiteSpace: "nowrap", fontSize: 14 };
  const td = { padding: "7px 10px", borderBottom: "1px solid #e0e0e0", fontSize: 14, verticalAlign: "top" };
  const num = { ...td, textAlign: "right", whiteSpace: "nowrap" };
  const tabBtn = (k, label) => (
    <button onClick={() => setTab(k)} style={{ padding: "8px 16px", border: "none", borderBottom: tab === k ? "3px solid #1e4d8f" : "3px solid transparent", background: "none", fontWeight: tab === k ? 700 : 400, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
  );
  const Score = ({ v, digits = 0 }) => <span style={{ display: "inline-block", minWidth: 34, textAlign: "center", padding: "2px 8px", borderRadius: 999, background: scoreColor(v), color: "#fff", fontWeight: 700 }}>{v === null || v === undefined ? "-" : Number(v).toFixed(digits)}</span>;

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: "0 0 12px" }}>📊 รายงานฝึกตอบลูกค้า (AI ลูกค้าจำลอง)</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <label>ตั้งแต่ <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label>ถึง <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        <button onClick={load} disabled={loading} style={{ padding: "6px 16px", cursor: "pointer" }}>{loading ? "กำลังโหลด..." : "ค้นหา"}</button>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">ทุกสาขา</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {msg && <span style={{ color: "#c62828" }}>{msg}</span>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        {[["พนักงานที่เข้าใช้", total.staff + " คน"], ["ลูกค้าจำลองที่รับ", total.sessions + " ราย"], ["คำตอบทั้งหมด", total.answers + " ข้อ"], ["คะแนนเฉลี่ย", total.avg === null ? "-" : total.avg.toFixed(1) + " / 10"]].map(([k, v]) => (
          <div key={k} style={{ background: "#f3f6fb", borderRadius: 10, padding: "10px 16px", minWidth: 150 }}>
            <div style={{ fontSize: 13, opacity: .7 }}>{k}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ borderBottom: "1px solid #cfd8dc", marginBottom: 10 }}>
        {tabBtn("summary", "สรุปรายพนักงาน")}
        {tabBtn("detail", `รายละเอียดคำตอบ${staffFilter ? " — " + staffFilter : ""}`)}
      </div>

      {tab === "summary" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
            <thead><tr>
              <th style={th}>#</th><th style={th}>พนักงาน</th><th style={th}>สาขา</th><th style={{ ...th, textAlign: "right" }}>วันที่เข้าใช้ (วัน)</th><th style={{ ...th, textAlign: "right" }}>ลูกค้าจำลอง (ราย)</th>
              <th style={{ ...th, textAlign: "right" }}>คำตอบ (ข้อ)</th><th style={{ ...th, textAlign: "right" }}>ตอบด้วยเสียง</th><th style={{ ...th, textAlign: "center" }}>คะแนนเฉลี่ย</th><th style={{ ...th, textAlign: "center" }}>ต่ำสุด</th><th style={{ ...th, textAlign: "center" }}>สูงสุด</th><th style={th}>ใช้ล่าสุด</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {summary.map((s, i) => (
                <tr key={s.staff}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{s.staff}</td>
                  <td style={td}>{[...s.branches].filter(Boolean).join(", ") || "-"}</td>
                  <td style={num}>{s.days.size}</td>
                  <td style={num}>{s.sessions.size}</td>
                  <td style={num}>{s.answers}</td>
                  <td style={num}>{s.voice}</td>
                  <td style={{ ...td, textAlign: "center" }}><Score v={s.avg} digits={1} /></td>
                  <td style={{ ...td, textAlign: "center" }}>{s.min ?? "-"}</td>
                  <td style={{ ...td, textAlign: "center" }}>{s.max ?? "-"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDateTime(s.last)}</td>
                  <td style={td}><button onClick={() => { setStaffFilter(s.staff); setTab("detail"); }} style={{ cursor: "pointer" }}>ดูคำตอบ</button></td>
                </tr>
              ))}
              {!summary.length && <tr><td style={{ ...td, textAlign: "center", opacity: .6 }} colSpan={12}>{loading ? "กำลังโหลด..." : "ยังไม่มีข้อมูล"}</td></tr>}
            </tbody>
          </table>
          <div style={{ fontSize: 13, opacity: .7, marginTop: 8 }}>คะแนนให้โดย AI ต่อคำตอบแต่ละข้อ (เต็ม 10): ตอบตรงคำถาม 4 · ข้อมูลครบ/ชัดเจน 3 · สุภาพ 1 · ชวนคุยต่อ/ปิดการขาย 2 — คำตอบที่บันทึกก่อนเปิดระบบให้คะแนนจะไม่มีคะแนน</div>
        </div>
      )}

      {tab === "detail" && (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
            <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
              <option value="">พนักงานทุกคน</option>
              {summary.map(s => <option key={s.staff} value={s.staff === "(ไม่ระบุชื่อ)" ? "" : s.staff}>{s.staff}</option>)}
            </select>
            <span style={{ opacity: .7 }}>{filtered.length} ข้อ</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
              <thead><tr>
                <th style={th}>วันเวลา</th><th style={th}>พนักงาน</th><th style={th}>หัวข้อ / รถที่สนใจ</th><th style={th}>ข้อที่</th><th style={th}>คำถามลูกค้า</th><th style={th}>คำตอบพนักงาน</th><th style={{ ...th, textAlign: "center" }}>คะแนน</th><th style={th}>ความเห็น AI</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDateTime(r.created_at)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{r.staff_name || "-"}<div style={{ fontSize: 12, opacity: .6 }}>{r.branch_code}</div></td>
                    <td style={{ ...td, minWidth: 130 }}>{topicOf(r.scenario)}<div style={{ fontSize: 12, opacity: .6 }}>{bikeOf(r.scenario)}</div></td>
                    <td style={{ ...td, textAlign: "center" }}>{r.turn_no}</td>
                    <td style={{ ...td, minWidth: 200 }}>{r.customer_question}</td>
                    <td style={{ ...td, minWidth: 240 }}>{r.staff_answer}<span style={{ fontSize: 12, opacity: .55 }}> {r.answer_source === "voice" ? "🎤" : r.answer_source === "text" ? "⌨" : ""}</span></td>
                    <td style={{ ...td, textAlign: "center" }}><Score v={r.score} /></td>
                    <td style={{ ...td, minWidth: 180 }}>{r.score_comment || "-"}</td>
                  </tr>
                ))}
                {!filtered.length && <tr><td style={{ ...td, textAlign: "center", opacity: .6 }} colSpan={8}>{loading ? "กำลังโหลด..." : "ยังไม่มีข้อมูล"}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
