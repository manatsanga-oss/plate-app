import React, { useEffect, useState } from "react";

// ประตูร้าน (user 2026-10-22): สั่งประตูม้วน เปิด/หยุด/ปิด ผ่าน Tuya Cloud (door-api) + ดูเซนเซอร์ประตูห้อง
// พนักงานพิมพ์ "เปิดประตู" ใน LINE บอทพนักงาน → door-api เช็กสิทธิ์ (door_access_users) + ช่วงเวลา (door_settings) แล้วเปิดให้
// หน้านี้: สถานะ · ปุ่มสั่งเอง · ตั้งช่วงเวลา · รายชื่อ LINE ที่มีสิทธิ์ (อนุมัติจากคนที่เคยขอแล้วถูกปฏิเสธ) · ประวัติ
const DOOR_API = "https://n8n-new-project-gwf2.onrender.com/webhook/door-api";

async function post(body) {
  const res = await fetch(DOOR_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return { error: t.slice(0, 200) }; }
}
const thaiDT = (s) => { if (!s) return "-"; const [d, t] = String(s).split(" "); const [y, m, dd] = d.split("-"); return `${Number(dd)}/${Number(m)}/${Number(y) + 543} ${t || ""}`; };
const RESULT_LABEL = { opened: "เปิดแล้ว", close: "ปิดแล้ว", stop: "หยุด", denied_user: "ไม่มีสิทธิ์", denied_time: "นอกเวลา", error: "ผิดพลาด", ok: "บันทึก", pending: "กำลังทำ" };
const RESULT_COLOR = { opened: "#2e7d32", close: "#1565c0", stop: "#6d4c41", denied_user: "#c62828", denied_time: "#ef6c00", error: "#c62828", ok: "#555", pending: "#999" };

export default function DoorControlPage({ currentUser }) {
  const me = currentUser?.name || currentUser?.username || "";
  const [status, setStatus] = useState(null);
  const [settings, setSettings] = useState({ open_from: "07:30", open_to: "08:00", enabled: true, line_shutter: "both" });
  const [shutter, setShutter] = useState("both"); // บานที่สั่งจากปุ่มหน้าเว็บ: both / 1 / 2
  const [scenes, setScenes] = useState(null); // ฉาก Tap-to-Run จาก Smart Life (action scenes)
  const SCENE_KEYS = [["1_open", "ประตูม้วน 1 ▲ เปิด"], ["1_stop", "ประตูม้วน 1 ■ หยุด"], ["1_close", "ประตูม้วน 1 ▼ ปิด"], ["2_open", "ประตูม้วน 2 ▲ เปิด"], ["2_stop", "ประตูม้วน 2 ■ หยุด"], ["2_close", "ประตูม้วน 2 ▼ ปิด"]];
  async function loadScenes() { setBusy("scenes"); const r = await post({ action: "scenes" }); setScenes(r?.scenes || []); if (r && !r.ok) setMsg(`❌ โหลดฉากไม่สำเร็จ: ${r.msg || ""}`); setBusy(""); }
  const setScene = (k, v) => setSettings(st => ({ ...st, scene_map: { ...(st.scene_map || {}), [k]: v } }));
  const SHUTTER_LABEL = { both: "ทั้ง 2 บาน", 1: "ประตูม้วน 1", 2: "ประตูม้วน 2" };
  const [users, setUsers] = useState([]);
  const [pending, setPending] = useState([]);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState({});

  async function loadStatus() { setBusy("status"); const r = await post({ action: "status" }); setStatus(r); if (r?.settings) setSettings(s => ({ ...s, ...r.settings })); setBusy(""); }
  async function loadUsers() { const r = await post({ action: "list_users" }); setUsers(r?.users || []); setPending(r?.pending || []); }
  async function loadLog() { const r = await post({ action: "list_log", limit: 200 }); setLog(r?.rows || []); }
  useEffect(() => { const t = setTimeout(() => { loadStatus(); loadUsers(); loadLog(); }, 0); return () => clearTimeout(t); }, []);

  async function command(action) {
    const label = { open: "เปิด", stop: "หยุด", close: "ปิด" }[action];
    if (!window.confirm(`${label}${SHUTTER_LABEL[shutter]} ตอนนี้?`)) return;
    setBusy(action); setMsg("");
    const r = await post({ action, shutter, user: me });
    setMsg(r?.ok ? `✅ สั่ง${label}ประตูแล้ว` : `❌ ไม่สำเร็จ: ${(r?.results || []).filter(x => !x.ok).map(x => `${x.name} ${x.msg}`).join(", ") || r?.error || ""}`);
    setBusy(""); loadLog(); setTimeout(loadStatus, 1500);
  }
  async function saveSettings() {
    setBusy("settings"); const r = await post({ action: "save_settings", ...settings, user: me });
    setMsg(r?.ok ? "✅ บันทึกการตั้งค่าแล้ว" : "❌ บันทึกไม่สำเร็จ"); setBusy(""); loadLog();
  }
  async function saveUser(line_user_id, name, active) {
    if (!name?.trim()) { setMsg("กรุณาใส่ชื่อพนักงาน"); return; }
    setBusy("user"); await post({ action: "save_user", line_user_id, name: name.trim(), active }); setBusy(""); loadUsers();
  }
  async function deleteUser(u) { if (!window.confirm(`ลบสิทธิ์ของ ${u.name}?`)) return; await post({ action: "delete_user", line_user_id: u.line_user_id }); loadUsers(); }

  const card = { background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.08)", marginBottom: 14 };
  const th = { padding: "8px 10px", background: "#0b2447", color: "#fff", textAlign: "left", fontSize: 14, whiteSpace: "nowrap" };
  const td = { padding: "7px 10px", borderBottom: "1px solid #e0e0e0", fontSize: 14, verticalAlign: "top" };
  const btn = (bg) => ({ border: "none", borderRadius: 10, padding: "14px 22px", fontSize: 18, fontWeight: 700, color: "#fff", background: bg, cursor: "pointer", fontFamily: "inherit", minWidth: 120, opacity: busy ? .6 : 1 });
  const dot = (ok, on) => <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 6, background: !ok ? "#9e9e9e" : on ? "#2e7d32" : "#c62828", marginRight: 6 }} />;

  return (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <h2 style={{ margin: "0 0 12px" }}>🚪 ประตูร้าน</h2>
      {msg && <div style={{ marginBottom: 10, color: msg.startsWith("✅") ? "#2e7d32" : "#c62828", fontWeight: 600 }}>{msg}</div>}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <b>สถานะ</b>
          <span style={{ fontSize: 13, opacity: .7 }}>เวลาระบบ {status?.nowTh || "-"} น. <button onClick={loadStatus} disabled={!!busy} style={{ marginLeft: 8, cursor: "pointer" }}>รีเฟรช</button></span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 10 }}>
          {(status?.sensors || []).map(s => (
            <div key={s.id}>{dot(s.ok, s.open === false)}<b>{s.name}</b>: {!s.ok ? `อ่านไม่ได้ (${s.msg || "offline"})` : s.open ? "เปิดอยู่" : "ปิด"}{s.battery != null ? ` · แบต ${s.battery}` : ""}</div>
          ))}
          {(status?.shutters || []).map(s => (
            <div key={s.id}>{dot(s.ok, s.online)}<b>{s.name}</b>: {!s.ok ? `อ่านไม่ได้ (${s.msg || ""})` : s.online ? "ออนไลน์" : "ออฟไลน์"}</div>
          ))}
          {!status && <span style={{ opacity: .6 }}>กำลังโหลด...</span>}
          {status?.error && <span style={{ color: "#c62828" }}>{status.error}</span>}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <button style={btn("#2e7d32")} disabled={!!busy} onClick={() => command("open")}>▲ เปิด</button>
          <button style={btn("#6d4c41")} disabled={!!busy} onClick={() => command("stop")}>■ หยุด</button>
          <button style={btn("#1565c0")} disabled={!!busy} onClick={() => command("close")}>▼ ปิด</button>
          <select value={shutter} onChange={e => setShutter(e.target.value)} style={{ padding: "6px 10px", fontSize: 15 }}>
            {Object.entries(SHUTTER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <span style={{ alignSelf: "center", fontSize: 13, opacity: .7 }}>เลือกบานที่จะสั่ง (RF Bridge ต้องออนไลน์)</span>
        </div>
      </div>

      <div style={card}>
        <b>พนักงานขอเปิดผ่าน LINE</b>
        <div style={{ fontSize: 14, opacity: .8, margin: "6px 0 10px" }}>พนักงานพิมพ์ข้อความที่มีคำว่า <b>"ประตู"</b> (เช่น "ถึงร้านแล้ว เปิดประตูให้หน่อย") ในไลน์บอทพนักงาน ระบบจะเปิดให้เฉพาะคนที่มีสิทธิ์ และเฉพาะช่วงเวลานี้</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label><input type="checkbox" checked={settings.enabled !== false} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} /> เปิดใช้งาน</label>
          <label>ตั้งแต่ <input type="time" value={settings.open_from || ""} onChange={e => setSettings({ ...settings, open_from: e.target.value })} /></label>
          <label>ถึง <input type="time" value={settings.open_to || ""} onChange={e => setSettings({ ...settings, open_to: e.target.value })} /></label>
          <label>บานที่เปิด <select value={settings.line_shutter || "both"} onChange={e => setSettings({ ...settings, line_shutter: e.target.value })}>
            {Object.entries(SHUTTER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
          <button onClick={saveSettings} disabled={!!busy} style={{ padding: "6px 16px", cursor: "pointer" }}>บันทึก</button>
        </div>
      </div>

      <div style={card}>
        <b>ผูกฉาก Tap-to-Run (Smart Life)</b>
        <div style={{ fontSize: 14, opacity: .8, margin: "6px 0 10px" }}>
          ประตูม้วนเป็นรีโมทที่คัดลอกไว้ใน RF Bridge สั่งตรงไม่ได้ ต้องสร้างฉาก <b>Tap-to-Run</b> ในแอป Smart Life (ฉาก → + → Tap-to-Run → เพิ่มการทำงาน → Roller Shutters → ปุ่ม ▲/■/▼) แล้วเลือกผูกที่นี่ กด <b>บันทึก</b> ด้านบน
        </div>
        <button onClick={loadScenes} disabled={!!busy} style={{ padding: "6px 14px", cursor: "pointer", marginBottom: 10 }}>{busy === "scenes" ? "กำลังโหลด..." : "โหลดรายการฉากจาก Smart Life"}</button>
        {scenes && scenes.length === 0 && <div style={{ color: "#c62828", fontSize: 14 }}>ยังไม่มีฉาก Tap-to-Run ในบ้าน Por.Paor — สร้างในแอป Smart Life ก่อน</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 8 }}>
          {SCENE_KEYS.map(([k, label]) => (
            <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
              <span style={{ minWidth: 150 }}>{label}</span>
              <select value={settings.scene_map?.[k] || ""} onChange={e => setScene(k, e.target.value)} style={{ flex: 1, padding: 4 }}>
                <option value="">— ไม่ผูก —</option>
                {(scenes || []).map(sc => <option key={sc.scene_id} value={sc.scene_id}>{sc.name}</option>)}
                {!scenes && settings.scene_map?.[k] && <option value={settings.scene_map[k]}>{settings.scene_map[k]}</option>}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div style={card}>
        <b>รายชื่อ LINE ที่มีสิทธิ์เปิดประตู</b>
        <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 8 }}>
          <thead><tr><th style={th}>ชื่อพนักงาน</th><th style={th}>LINE ID</th><th style={th}>ใช้งาน</th><th style={th}></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.line_user_id}>
                <td style={td}>{u.name}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{u.line_user_id}</td>
                <td style={td}><input type="checkbox" checked={u.active !== false} onChange={e => saveUser(u.line_user_id, u.name, e.target.checked)} /></td>
                <td style={td}><button onClick={() => deleteUser(u)} style={{ cursor: "pointer", color: "#c62828" }}>ลบ</button></td>
              </tr>
            ))}
            {!users.length && <tr><td style={{ ...td, opacity: .6 }} colSpan={4}>ยังไม่มีรายชื่อ — ให้พนักงานพิมพ์ "เปิดประตู" ในไลน์บอท 1 ครั้ง แล้วอนุมัติจากรายการด้านล่าง</td></tr>}
          </tbody>
        </table>
        {pending.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <b style={{ color: "#ef6c00" }}>รอการอนุมัติ (เคยขอแต่ยังไม่มีสิทธิ์)</b>
            <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 6 }}>
              <thead><tr><th style={th}>ชื่อใน LINE</th><th style={th}>LINE ID</th><th style={th}>ขอล่าสุด</th><th style={th}>ชื่อพนักงาน</th><th style={th}></th></tr></thead>
              <tbody>
                {pending.map(p => (
                  <tr key={p.line_user_id}>
                    <td style={td}>{p.user_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{p.line_user_id}</td>
                    <td style={td}>{thaiDT(String(p.ts || "").replace("T", " ").slice(0, 19))}</td>
                    <td style={td}><input value={newName[p.line_user_id] ?? (p.user_name || "")} onChange={e => setNewName({ ...newName, [p.line_user_id]: e.target.value })} placeholder="ชื่อพนักงาน" /></td>
                    <td style={td}><button onClick={() => saveUser(p.line_user_id, newName[p.line_user_id] ?? p.user_name, true)} style={{ cursor: "pointer", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px" }}>อนุมัติ</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><b>ประวัติ</b><button onClick={loadLog} style={{ cursor: "pointer" }}>รีเฟรช</button></div>
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th style={th}>เวลา</th><th style={th}>ทาง</th><th style={th}>ผู้ขอ</th><th style={th}>คำสั่ง</th><th style={th}>ผล</th><th style={th}>รายละเอียด</th></tr></thead>
            <tbody>
              {log.map(r => (
                <tr key={r.id}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDT(r.ts)}</td>
                  <td style={td}>{r.source === "line" ? "LINE" : "ระบบ"}</td>
                  <td style={td}>{r.user_name || r.line_user_id || "-"}</td>
                  <td style={td}>{r.action}</td>
                  <td style={{ ...td, color: RESULT_COLOR[r.result] || "#333", fontWeight: 600 }}>{RESULT_LABEL[r.result] || r.result}</td>
                  <td style={{ ...td, fontSize: 12, opacity: .8 }}>{r.detail}</td>
                </tr>
              ))}
              {!log.length && <tr><td style={{ ...td, opacity: .6 }} colSpan={6}>ยังไม่มีประวัติ</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
