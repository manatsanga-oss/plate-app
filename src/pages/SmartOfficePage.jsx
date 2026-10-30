import React, { useEffect, useState } from "react";

// Smart Office — ควบคุมแอร์/ทีวีในร้าน ป.เปา ผ่าน Tuya IR blaster (webhook tuya-schedule-api ใน Tuya_Schedule_Workflow) — user 2026-10-30
// ตั้งเวลาเปิด/ปิดรายอุปกรณ์ (ตาราง tuya_device_schedules, workflow เช็คทุก 1 นาที เวลาไทย) + สั่งเองทันที
// ⚠️ รีโมท IR ไม่รู้สถานะจริงของเครื่อง: แอร์สั่ง เปิด/ปิด ได้ตรง ๆ, ทีวีมีแต่ปุ่ม Power (สลับ) — เวลาเปิด/ปิดของทีวี = กด Power ตอนนั้น
const TUYA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/tuya-schedule-api";
const SLOT_LABEL = { on: "เปิดแอร์ + ทีวี", tv: "ปิดทีวี", ac: "ปิดแอร์" };
const DAYS = [["1", "จ"], ["2", "อ"], ["3", "พ"], ["4", "พฤ"], ["5", "ศ"], ["6", "ส"], ["7", "อา"]];

async function post(body) {
  const res = await fetch(TUYA_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => null);
  return Array.isArray(d) ? d[0] : d;
}
const hhmm = (v) => (v && /^\d{2}:\d{2}$/.test(v) ? v : "");

function ScheduleEditor({ r, sched, onSaved, busy, setBusy, setMsg }) {
  const [onTime, setOnTime] = useState(hhmm(sched?.on_time));
  const [offTime, setOffTime] = useState(hhmm(sched?.off_time));
  const [days, setDays] = useState(sched?.days || "1234567");
  const [enabled, setEnabled] = useState(sched ? sched.enabled !== false : true);
  useEffect(() => { setOnTime(hhmm(sched?.on_time)); setOffTime(hhmm(sched?.off_time)); setDays(sched?.days || "1234567"); setEnabled(sched ? sched.enabled !== false : true); }, [sched?.on_time, sched?.off_time, sched?.days, sched?.enabled]); // eslint-disable-line
  const dirty = onTime !== hhmm(sched?.on_time) || offTime !== hhmm(sched?.off_time) || days !== (sched?.days || "1234567") || enabled !== (sched ? sched.enabled !== false : true);
  async function save() {
    setBusy("save" + r.id); setMsg("");
    try {
      const d = await post({ action: "save_schedule", remote_id: r.id, blaster: r.blaster, kind: r.category === "5" ? "ac" : "tv", name: r.name, on_time: onTime || null, off_time: offTime || null, days, enabled });
      if (!d || d.ok === false) throw new Error(d?.error || "บันทึกไม่สำเร็จ");
      setMsg(`✅ บันทึกเวลา ${r.name} แล้ว`); onSaved(d.schedules || []);
    } catch (e) { setMsg("❌ " + e.message); }
    setBusy("");
  }
  const inp = { padding: "4px 6px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 };
  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed #e5e7eb", fontSize: 13 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> ⏰ ตั้งเวลา</label>
        <label>เปิด <input type="time" value={onTime} onChange={(e) => setOnTime(e.target.value)} style={inp} /></label>
        <label>ปิด <input type="time" value={offTime} onChange={(e) => setOffTime(e.target.value)} style={inp} /></label>
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
        {DAYS.map(([k, l]) => (
          <button key={k} onClick={() => setDays(days.includes(k) ? days.replace(k, "") : (days + k).split("").sort().join(""))}
            style={{ width: 30, height: 26, borderRadius: 6, border: "1px solid #d1d5db", cursor: "pointer", fontSize: 12, background: days.includes(k) ? "#1d4ed8" : "#fff", color: days.includes(k) ? "#fff" : "#6b7280" }}>{l}</button>
        ))}
        <button onClick={save} disabled={!!busy || !dirty} style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer", background: dirty ? "#059669" : "#e5e7eb", color: dirty ? "#fff" : "#9ca3af" }}>{busy === "save" + r.id ? "…" : "💾 บันทึกเวลา"}</button>
      </div>
      {sched?.last_fired && <div style={{ color: "#9ca3af", marginTop: 4 }}>ยิงล่าสุดตามเวลา: {sched.last_fired}</div>}
    </div>
  );
}

export default function SmartOfficePage() {
  const [remotes, setRemotes] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState([]);

  async function load(initial) {
    if (!initial) setLoading(true);
    try {
      const d = await post({ action: "list" });
      setRemotes(Array.isArray(d?.remotes) ? d.remotes : []);
      setSchedules(Array.isArray(d?.schedules) ? d.schedules : []);
    } catch { setMsg("❌ ติดต่อระบบไม่ได้"); }
    setLoading(false);
  }
  useEffect(() => { load(true); }, []); // eslint-disable-line

  async function send(r, power, key) {
    const label = r.category === "5" ? (power ? "เปิด" : "ปิด") : "กด Power";
    setBusy(r.id + label); setMsg("");
    try {
      const d = await post({ action: "cmd", remote_id: r.id, power, key });
      const ok = d?.ok && (d.results || []).every((x) => x.success);
      setLog((p) => [`${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} ${r.name}: ${label} ${ok ? "✅" : "❌ " + (d?.error || (d?.results || []).map((x) => x.msg).filter(Boolean).join(", ") || "ไม่สำเร็จ")}`, ...p].slice(0, 20));
      setMsg(ok ? `✅ ${r.name} ${label}แล้ว (รอเครื่องตอบ 2–3 วินาที)` : `❌ ${r.name} ${label}ไม่สำเร็จ`);
    } catch (e) { setMsg("❌ " + e.message); }
    setBusy("");
  }
  async function runSlot(slot) {
    if (!window.confirm(`สั่ง "${SLOT_LABEL[slot]}" ทุกเครื่องตอนนี้?`)) return;
    setBusy("slot" + slot); setMsg("");
    try {
      const d = await post({ action: "run", slot });
      const res = (d?.results || []).map((x) => `${x.name} ${x.success ? "✅" : "❌"}`).join(" · ");
      setLog((p) => [`${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} ${SLOT_LABEL[slot]}: ${res || "-"}`, ...p].slice(0, 20));
      setMsg(d?.ok ? `✅ ${SLOT_LABEL[slot]} สำเร็จ` : `⚠️ บางเครื่องไม่สำเร็จ: ${res}`);
    } catch (e) { setMsg("❌ " + e.message); }
    setBusy("");
  }

  const acs = remotes.filter((r) => r.category === "5");
  const tvs = remotes.filter((r) => r.category === "2");
  const schedOf = (r) => schedules.find((s) => s.remote_id === r.id);
  const btn = { padding: "10px 18px", borderRadius: 10, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 15 };
  const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, minWidth: 300, maxWidth: 360 };
  const summary = schedules.filter((s) => s.enabled !== false && (s.on_time || s.off_time)).map((s) => `${s.name}: ${s.on_time ? "เปิด " + s.on_time : ""}${s.on_time && s.off_time ? " / " : ""}${s.off_time ? "ปิด " + s.off_time : ""}`).join(" · ");

  return (
    <div style={{ padding: 20, fontFamily: "Tahoma, sans-serif" }}>
      <h2 style={{ margin: "0 0 4px" }}>🏢 Smart Office — ควบคุมแอร์ / ทีวี</h2>
      <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
        สั่งผ่านตัวยิงรีโมท IR (Smart Life) · ตั้งเวลาเปิด/ปิดได้รายเครื่อง (ระบบเช็คทุก 1 นาที เวลาไทย){summary ? ` · ตอนนี้: ${summary}` : ""}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <button onClick={() => load()} disabled={loading} style={{ ...btn, background: "#e5e7eb" }}>🔄 โหลดรายการ</button>
        <button onClick={() => runSlot("on")} disabled={!!busy} style={{ ...btn, background: "#dcfce7", color: "#166534" }}>▶ เปิดทั้งหมด</button>
        <button onClick={() => runSlot("ac")} disabled={!!busy} style={{ ...btn, background: "#fee2e2", color: "#b91c1c" }}>■ ปิดแอร์ทุกตัว</button>
        {msg && <span style={{ fontSize: 14, color: msg.startsWith("❌") || msg.startsWith("⚠️") ? "#b91c1c" : "#166534" }}>{msg}</span>}
      </div>

      <h3 style={{ margin: "10px 0 6px" }}>❄️ แอร์ ({acs.length})</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {acs.map((r) => (
          <div key={r.id} style={card}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>{r.brand || ""} · ตัวยิง: {r.blasterName}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => send(r, 1)} disabled={!!busy} style={{ ...btn, background: "#16a34a", color: "#fff", flex: 1 }}>{busy === r.id + "เปิด" ? "…" : "เปิด"}</button>
              <button onClick={() => send(r, 0)} disabled={!!busy} style={{ ...btn, background: "#dc2626", color: "#fff", flex: 1 }}>{busy === r.id + "ปิด" ? "…" : "ปิด"}</button>
            </div>
            <ScheduleEditor r={r} sched={schedOf(r)} onSaved={setSchedules} busy={busy} setBusy={setBusy} setMsg={setMsg} />
          </div>
        ))}
        {!loading && acs.length === 0 && <span style={{ color: "#9ca3af" }}>ไม่พบรีโมทแอร์ (เพิ่มในแอป Smart Life ใต้ตัวยิง IR)</span>}
      </div>

      <h3 style={{ margin: "16px 0 6px" }}>📺 ทีวี ({tvs.length})</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {tvs.map((r) => (
          <div key={r.id} style={card}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>ตัวยิง: {r.blasterName} · ปุ่ม Power เป็นสวิตช์สลับ (เปิด↔ปิด) — เวลาเปิด/ปิด = กด Power ตอนนั้น</div>
            <button onClick={() => send(r, 0, "Power")} disabled={!!busy} style={{ ...btn, background: "#1d4ed8", color: "#fff", width: "100%" }}>{busy === r.id + "กด Power" ? "…" : "⏻ Power (เปิด/ปิด)"}</button>
            <ScheduleEditor r={r} sched={schedOf(r)} onSaved={setSchedules} busy={busy} setBusy={setBusy} setMsg={setMsg} />
          </div>
        ))}
        {!loading && tvs.length === 0 && <span style={{ color: "#9ca3af" }}>ไม่พบรีโมททีวี</span>}
      </div>

      {log.length > 0 && (
        <div style={{ marginTop: 18, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>ประวัติการสั่ง (รอบนี้)</div>
          {log.map((l, i) => <div key={i} style={{ color: "#374151" }}>{l}</div>)}
        </div>
      )}
    </div>
  );
}
