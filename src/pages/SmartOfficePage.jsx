import React, { useEffect, useState } from "react";

// Smart Office — ควบคุมแอร์/ทีวีในร้าน ป.เปา ผ่าน Tuya IR blaster (webhook tuya-schedule-api ใน Tuya_Schedule_Workflow) — user 2026-10-30
// ตารางอัตโนมัติ (ใน workflow): 08:00 เปิดแอร์+ทีวี · 17:00 ปิดทีวี · 17:10 ปิดแอร์ — หน้านี้ไว้สั่งเองนอกเวลา/ตรวจสถานะ
// ⚠️ รีโมท IR ไม่รู้สถานะจริงของเครื่อง: แอร์สั่ง เปิด/ปิด ได้ตรง ๆ, ทีวีมีแต่ปุ่ม Power (สลับ)
const TUYA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/tuya-schedule-api";
const SLOT_LABEL = { on: "เปิดแอร์ + ทีวี", tv: "ปิดทีวี", ac: "ปิดแอร์" };

async function post(body) {
  const res = await fetch(TUYA_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => null);
  return Array.isArray(d) ? d[0] : d;
}

export default function SmartOfficePage() {
  const [remotes, setRemotes] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState([]);

  async function load(initial) {
    if (!initial) setLoading(true);
    try {
      const d = await post({ action: "run", slot: "list" });
      setRemotes(Array.isArray(d?.remotes) ? d.remotes : []);
      setSchedule(d?.schedule || {});
    } catch { setMsg("❌ ติดต่อระบบไม่ได้"); }
    setLoading(false);
  }
  useEffect(() => { load(true); }, []); // eslint-disable-line

  async function send(r, power, key) {
    const label = r.category === "5" ? (power ? "เปิด" : "ปิด") : "กด Power";
    setBusy(r.id + label); setMsg("");
    try {
      const d = await post({ action: "cmd", kind: r.category === "5" ? "ac" : "tv", remote_id: r.id, power, key });
      const ok = d?.ok && (d.results || []).every((x) => x.success);
      const line = `${new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} ${r.name}: ${label} ${ok ? "✅" : "❌ " + (d?.error || (d?.results || []).map((x) => x.msg).filter(Boolean).join(", ") || "ไม่สำเร็จ")}`;
      setLog((p) => [line, ...p].slice(0, 20));
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
  const btn = { padding: "10px 18px", borderRadius: 10, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 15 };
  const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, minWidth: 260 };

  return (
    <div style={{ padding: 20, fontFamily: "Tahoma, sans-serif" }}>
      <h2 style={{ margin: "0 0 4px" }}>🏢 Smart Office — ควบคุมแอร์ / ทีวี</h2>
      <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
        สั่งผ่านตัวยิงรีโมท IR (Smart Life) · ตารางอัตโนมัติ: {Object.entries(schedule).map(([t, s]) => `${t} ${SLOT_LABEL[s] || s}`).join(" · ") || "08:00 เปิดแอร์+ทีวี · 17:00 ปิดทีวี · 17:10 ปิดแอร์"} (ทุกวัน)
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <button onClick={load} disabled={loading} style={{ ...btn, background: "#e5e7eb" }}>🔄 โหลดรายการ</button>
        <button onClick={() => runSlot("on")} disabled={!!busy} style={{ ...btn, background: "#dcfce7", color: "#166534" }}>▶ เปิดทั้งหมด (เหมือน 08:00)</button>
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
          </div>
        ))}
        {!loading && acs.length === 0 && <span style={{ color: "#9ca3af" }}>ไม่พบรีโมทแอร์ (เพิ่มในแอป Smart Life ใต้ตัวยิง IR)</span>}
      </div>

      <h3 style={{ margin: "16px 0 6px" }}>📺 ทีวี ({tvs.length})</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {tvs.map((r) => (
          <div key={r.id} style={card}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>ตัวยิง: {r.blasterName} · ปุ่ม Power เป็นสวิตช์สลับ (เปิด↔ปิด)</div>
            <button onClick={() => send(r, 0, "Power")} disabled={!!busy} style={{ ...btn, background: "#1d4ed8", color: "#fff", width: "100%" }}>{busy === r.id + "กด Power" ? "…" : "⏻ Power (เปิด/ปิด)"}</button>
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
      <div style={{ marginTop: 14, fontSize: 12, color: "#9ca3af" }}>แก้เวลาตารางอัตโนมัติ: ไฟล์ Tuya_Schedule_Workflow (ค่า SLOTS + cron) แล้ว re-import ใน n8n</div>
    </div>
  );
}
