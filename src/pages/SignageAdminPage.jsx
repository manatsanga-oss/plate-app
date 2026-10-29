import React, { useEffect, useMemo, useState } from "react";

// จัดการจอประชาสัมพันธ์หน้าร้าน (Android signage 49" แนวตั้ง ป.เปา 2 จอ — user 2026-10-28)
// สไลด์เก็บใน signage_items ผ่าน signage-api · จอเปิด /signage?branch=SCY06 ดึงรายการใหม่ทุก 1 นาที
// ชนิดสไลด์: image (อัปโหลดรูป ย่อเป็นแนวตั้ง 1080x1920 ก่อนเก็บ) · video (MP4 สั้น ≤10 MB ในระบบ หรือลิงก์ภายนอก payload.url) · vehicle (รุ่น/สีจาก master + ราคาเงินสดสด) · text · queue (คิวศูนย์บริการ+รถในช่องซ่อม) · line (QR OA)
const SIGNAGE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/signage-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const DISPLAY_BASE = "https://plate-app-y1z1.onrender.com";
const KINDS = { image: "🖼️ รูปภาพ/โปรโมชั่น", video: "🎬 วิดีโอ", vehicle: "🏍️ รถแนะนำ + ราคา", text: "📢 ประกาศข้อความ", queue: "🎫 คิวศูนย์บริการ", line: "💚 QR LINE OA" };
// ร้านมีจอ 2 ขนาด — สไลด์เลือกได้ว่าโชว์ทุกจอหรือเฉพาะจอ 1/2; แต่ละจอเปิด /signage?branch=..&screen=1|2 (user 2026-10-28)
const SCREENS = { all: "ทุกจอ", 1: "จอ 1 (32\" หน้าร้าน)", 2: "จอ 2 (49\")" };
// จอที่แบ่ง 3 ส่วน (จอ 2 เปิด /signage?...&split=3): สไลด์เลือก "ส่วน" ที่จะโชว์ — 1 สไลด์หลักด้านบน (75%) / 2 รูปเล็กมุมขวาบน (เฉพาะรูป) / 3 ข้อความด้านล่าง (25%) — จอเต็มไม่สนค่านี้
const ZONES = { 1: "ส่วนหลัก (บน)", 2: "รูปเล็กมุมขวาบน", 3: "ข้อความด้านล่าง" };
const MAX_W = 1080, MAX_H = 1920;
// วิดีโอ: อัปโหลด MP4/MOV/WebM เข้าระบบ (เก็บ base64 ผ่าน n8n — จำกัด 10 MB เพราะ n8n บน Render รับ body ~16 MB; ไฟล์ใหญ่กว่านั้นย่อในเบราว์เซอร์เป็น WebM) หรือใส่ลิงก์ไฟล์ตรงภายนอก — user 2026-10-29
const MAX_VIDEO_MB = 10;
// ⚠️ ลิงก์ Google Drive ใช้ฝังเล่นในหน้าเว็บอื่นไม่ได้ — Google ตอบ 403 เมื่อเบราว์เซอร์ส่ง Sec-Fetch-Site: cross-site (ทดสอบ 2026-10-29 ทั้ง Chrome และ WebView ส่งหัวนี้) จึงรับเฉพาะลิงก์ไฟล์ .mp4/.webm ตรง
const isGoogleDrive = (u) => /(^|\/\/)(drive|docs)\.google\.com\//i.test(String(u || "").trim()) || /drive\.usercontent\.google\.com/i.test(String(u || ""));

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json().catch(() => null);
}
const asArray = (d) => (Array.isArray(d) ? d : d ? [d] : []);
const text = (v) => String(v == null ? "" : v).trim();
const parseList = (d) => { try { return typeof d?.listjson === "string" ? JSON.parse(d.listjson) : Array.isArray(d) ? d : []; } catch { return []; } };

// ย่อรูปให้พอดีจอแนวตั้ง (ไม่เกิน 1080x1920) เป็น JPEG — คืน base64 (ไม่มี prefix)
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const f = Math.min(1, MAX_W / img.width, MAX_H / img.height);
      const w = Math.round(img.width * f), h = Math.round(img.height * f);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ b64: c.toDataURL("image/jpeg", 0.86).split(",")[1], w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("อ่านรูปไม่ได้")); };
    img.src = url;
  });
}

// อ่าน metadata ของไฟล์วิดีโอ (ความยาว/ขนาดภาพ)
function videoMeta(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video"); v.preload = "metadata"; v.muted = true;
    v.onloadedmetadata = () => { const m = { sec: v.duration, w: v.videoWidth, h: v.videoHeight }; URL.revokeObjectURL(url); resolve(m); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad video")); };
    v.src = url;
  });
}
// ย่อคลิปในเบราว์เซอร์ด้วย MediaRecorder (เล่นคลิปจริงแล้วอัดใหม่เป็น WebM VP9/Opus — ป้าย Android เล่น WebM ได้) ใช้เวลาเท่าความยาวคลิป
// บิตเรตคำนวณจากความยาวให้ได้ ≈ 8.5 MB; ย่อภาพให้ด้านสั้นไม่เกิน 720 px ผ่าน canvas; เสียงผ่าน AudioContext (ไม่ดังออกลำโพงตอนอัด)
function compressVideo(file, meta, onProgress) {
  return new Promise((resolve, reject) => {
    if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) return reject(new Error("เบราว์เซอร์นี้ย่อวิดีโอไม่ได้"));
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) return reject(new Error("เบราว์เซอร์นี้ไม่รองรับ WebM"));
    const targetBytes = 8.5 * 1048576;
    const vbps = Math.max(800000, Math.min(4000000, Math.floor((targetBytes * 8) / Math.max(1, meta.sec)) - 96000));
    const f = Math.min(1, 720 / Math.min(meta.w, meta.h));
    const W = Math.round(meta.w * f / 2) * 2, H = Math.round(meta.h * f / 2) * 2;
    const url = URL.createObjectURL(file);
    const v = document.createElement("video"); v.src = url; v.playsInline = true; v.preload = "auto";
    const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d");
    const stream = c.captureStream(30);
    let ac = null;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); const src = ac.createMediaElementSource(v); const dest = ac.createMediaStreamDestination(); src.connect(dest); dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t)); } catch { /* ไม่มีเสียงก็อัดต่อ */ }
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: vbps, audioBitsPerSecond: 96000 });
    const chunks = []; rec.ondataavailable = (ev) => { if (ev.data?.size) chunks.push(ev.data); };
    // วาดเฟรมด้วย setInterval ไม่ใช้ requestAnimationFrame (แท็บถูกซ่อน rAF หยุดเดิน → ได้ไฟล์ว่าง); ผู้ใช้ต้องเปิดแท็บนี้ค้างไว้จนย่อเสร็จ
    let timer = 0;
    const draw = () => { ctx.drawImage(v, 0, 0, W, H); onProgress && onProgress(Math.min(99, Math.round((v.currentTime / meta.sec) * 100))); };
    const finish = () => { clearInterval(timer); if (rec.state !== "inactive") rec.stop(); };
    rec.onstop = () => { URL.revokeObjectURL(url); ac && ac.close().catch(() => {}); const blob = new Blob(chunks, { type: "video/webm" }); resolve(new File([blob], file.name.replace(/\.\w+$/, "") + ".webm", { type: "video/webm" })); };
    rec.onerror = (ev) => { finish(); reject(ev.error || new Error("record error")); };
    v.onended = finish;
    v.onerror = () => { finish(); reject(new Error("เล่นไฟล์ไม่ได้")); };
    v.oncanplay = () => { if (rec.state !== "inactive") return; ac && ac.resume().catch(() => {}); rec.start(1000); v.play().then(() => { draw(); timer = setInterval(draw, 1000 / 30); }).catch((e) => { finish(); reject(e); }); };
  });
}

export default function SignageAdminPage({ currentUser }) {
  const [branch, setBranch] = useState("SCY06");
  const [branches, setBranches] = useState([]);
  const [items, setItems] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("image");
  const [form, setForm] = useState({ title: "", duration_sec: 10, start_date: "", end_date: "", promo: "", note: "", text: "", screen: "all", zone: 1 });
  const [imgFile, setImgFile] = useState(null);   // {b64, w, h, preview}
  const [vidFile, setVidFile] = useState(null);   // {b64, mime, sizeMb, sec, preview}
  const [vidUrl, setVidUrl] = useState("");
  // master สำหรับรถแนะนำ
  const [brands, setBrands] = useState([]); const [series, setSeries] = useState([]); const [colors, setColors] = useState([]);
  const [selBrand, setSelBrand] = useState(""); const [selSeries, setSelSeries] = useState(""); const [selColor, setSelColor] = useState("");
  const [colorPreview, setColorPreview] = useState(null);

  const by = currentUser?.username || currentUser?.name || "system";

  async function load() {
    const d = parseList(await post(SIGNAGE_API, { action: "list_items", branch_code: branch }).catch(() => null));
    setItems(Array.isArray(d) ? d : []);
  }
  useEffect(() => { load(); }, [branch]); // eslint-disable-line
  useEffect(() => {
    post(MASTER_API, { action: "get_branches" }).then((d) => setBranches(asArray(d))).catch(() => {});
    Promise.all([post(MASTER_API, { action: "get_brands" }), post(MASTER_API, { action: "get_series" }), post(MASTER_API, { action: "get_colors" })])
      .then(([b, s, c]) => { setBrands(asArray(b).filter((x) => (x.status || "active") === "active")); setSeries(asArray(s).filter((x) => (x.status || "active") === "active")); setColors(asArray(c).filter((x) => (x.status || "active") === "active")); })
      .catch(() => {});
  }, []);
  // thumbnail ของสไลด์รูป (โหลดเมื่อแสดงรายการ)
  useEffect(() => {
    items.filter((it) => it.kind === "image" && it.has_image).forEach((it) => {
      const key = `${it.id}@${it.updated_at}`;
      if (thumbs[key] !== undefined) return;
      setThumbs((p) => ({ ...p, [key]: null }));
      post(SIGNAGE_API, { action: "get_image", id: it.id }).then((r) => { const rec = Array.isArray(r) ? r[0] : r; setThumbs((p) => ({ ...p, [key]: rec?.image_base64 ? "data:image/jpeg;base64," + rec.image_base64 : "none" })); }).catch(() => setThumbs((p) => ({ ...p, [key]: "none" })));
    });
  }, [items]); // eslint-disable-line

  const seriesOpts = useMemo(() => series.filter((s) => String(s.brand_id) === String(selBrand)), [series, selBrand]);
  const colorOpts = useMemo(() => {
    const rows = colors.filter((c) => String(c.series_id) === String(selSeries));
    const seen = new Set();
    return rows.filter((r) => { const k = text(r.color_name) + "|" + text(r.type_name); if (seen.has(k)) return false; seen.add(k); return true; });
  }, [colors, selSeries]);
  useEffect(() => {
    setColorPreview(null);
    if (!selColor) return;
    post(MASTER_API, { action: "get_color_image", color_id: selColor }).then((res) => { const rec = Array.isArray(res) ? res[0] : res; setColorPreview(rec?.image_data || "none"); }).catch(() => setColorPreview("none"));
  }, [selColor]);

  async function onPickFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try { const r = await resizeImage(f); setImgFile({ ...r, preview: "data:image/jpeg;base64," + r.b64 }); setMsg(`รูป ${r.w}×${r.h} px (${Math.round(r.b64.length * 0.75 / 1024)} KB)`); }
    catch (err) { setMsg("❌ " + err.message); }
  }

  // อ่านไฟล์วิดีโอเป็น base64 + ความยาวคลิป (ตั้งวินาทีสไลด์ให้อัตโนมัติ); ไฟล์เกิน MAX_VIDEO_MB → ย่อในเบราว์เซอร์ (compressVideo)
  async function onPickVideo(e) {
    let f = e.target.files?.[0]; if (!f) return;
    if (!/^video\/(mp4|webm|quicktime)$/i.test(f.type)) return setMsg("❌ รองรับเฉพาะไฟล์ MP4 / MOV / WebM");
    const meta = await videoMeta(f).catch(() => null);
    if (!meta) return setMsg("❌ เล่นไฟล์นี้ไม่ได้ (ต้องเป็น MP4 H.264 / WebM)");
    let sizeMb = f.size / 1048576, note = "";
    if (sizeMb > MAX_VIDEO_MB) {
      if (meta.sec > 90) return setMsg(`❌ คลิปยาว ${Math.round(meta.sec)} วินาที — ตัดให้สั้นกว่า 90 วินาทีก่อน`);
      try {
        setBusy(true);
        const out = await compressVideo(f, meta, (pct) => setMsg(`⏳ กำลังย่อคลิป ${sizeMb.toFixed(1)} MB → ไม่เกิน ${MAX_VIDEO_MB} MB … ${pct}% (ใช้เวลาเท่าความยาวคลิป — อย่าสลับแท็บ/ย่อหน้าต่างระหว่างนี้)`));
        setBusy(false);
        const outMb = out.size / 1048576;
        if (outMb > MAX_VIDEO_MB) return setMsg(`❌ ย่อแล้วยังได้ ${outMb.toFixed(1)} MB — ตัดคลิปให้สั้นลงก่อน`);
        note = ` (ย่อจาก ${sizeMb.toFixed(1)} MB)`; f = out; sizeMb = outMb;
      } catch (err) { setBusy(false); return setMsg("❌ ย่อคลิปไม่สำเร็จ: " + (err?.message || err) + " — ย่อด้วยแอปอื่นให้ไม่เกิน " + MAX_VIDEO_MB + " MB แล้วลองใหม่"); }
    }
    const sec = Math.max(3, Math.ceil(meta.sec || 0)) || 10;
    const rd = new FileReader();
    rd.onload = () => { setVidFile({ b64: String(rd.result).split(",")[1], mime: f.type.toLowerCase() === "video/webm" ? "video/webm" : "video/mp4", sizeMb, sec, preview: URL.createObjectURL(f) }); setForm((p) => ({ ...p, duration_sec: sec })); setMsg(`วิดีโอ ${sizeMb.toFixed(1)} MB · ${sec} วินาที${note}`); };
    rd.onerror = () => setMsg("❌ อ่านไฟล์ไม่ได้");
    rd.readAsDataURL(f);
  }

  async function addItem() {
    const body = { action: "save_item", branch_code: branch, kind, title: form.title, duration_sec: Number(form.duration_sec) || 10, start_date: form.start_date || null, end_date: form.end_date || null, screen: form.screen || "all", zone: Number(form.zone) || 1, created_by: by, payload: {} };
    if (kind === "image") { if (!imgFile) return setMsg("❌ เลือกรูปก่อน"); body.image_base64 = imgFile.b64; }
    if (kind === "video") {
      const u = vidUrl.trim();
      if (isGoogleDrive(u)) return setMsg("❌ ลิงก์ Google Drive เล่นบนจอไม่ได้ (Google บล็อกการฝังจากเว็บอื่น) — ให้อัปโหลดไฟล์เข้าระบบแทน (ระบบย่อให้เองถ้าไฟล์ใหญ่)");
      if (vidFile) { body.image_base64 = vidFile.b64; body.media_mime = vidFile.mime; }
      else if (/^https?:\/\/\S+$/i.test(u)) body.payload = { url: u };
      else return setMsg("❌ เลือกไฟล์วิดีโอ หรือใส่ลิงก์วิดีโอ (ขึ้นต้น https://)");
    }
    if (kind === "vehicle") {
      const row = colors.find((c) => String(c.color_id) === String(selColor)); if (!row) return setMsg("❌ เลือกรุ่นและสี");
      const br = brands.find((b) => String(b.brand_id) === String(selBrand)); const se = series.find((s) => String(s.series_id) === String(selSeries));
      body.color_id = Number(selColor); body.series_name = text(se?.series_name); body.brand_name = text(br?.brand_name);
      body.payload = { promo: form.promo, note: form.note, type_name: text(row.type_name) };
      if (!body.title) body.title = [text(br?.brand_name), text(se?.series_name)].filter(Boolean).join(" ");
    }
    if (kind === "text") { if (!form.text && !form.title) return setMsg("❌ ใส่ข้อความ"); body.payload = { text: form.text }; }
    if (kind === "queue" && !body.title) body.title = "คิวรับบริการวันนี้";
    setBusy(true);
    try {
      const r = await post(SIGNAGE_API, body);
      if (r?.__error) throw new Error(r.__error);
      setMsg("✅ เพิ่มสไลด์แล้ว — จอจะเปลี่ยนภายใน 1 นาที");
      setImgFile(null); setVidFile(null); setVidUrl(""); setForm((f) => ({ ...f, title: "", promo: "", note: "", text: "" }));
      await load();
    } catch (err) { setMsg("❌ บันทึกไม่สำเร็จ: " + err.message); }
    setBusy(false);
  }
  async function patch(it, fields) {
    setBusy(true);
    try { await post(SIGNAGE_API, { action: "save_item", id: it.id, ...fields }); await load(); } catch { setMsg("❌ บันทึกไม่สำเร็จ"); }
    setBusy(false);
  }
  async function remove(it) {
    if (!window.confirm(`ลบสไลด์ "${it.title || KINDS[it.kind]}"?`)) return;
    setBusy(true); await post(SIGNAGE_API, { action: "delete_item", id: it.id }).catch(() => {}); await load(); setBusy(false);
  }
  async function move(i, dir) {
    const j = i + dir; if (j < 0 || j >= items.length) return;
    const ids = items.map((x) => x.id); [ids[i], ids[j]] = [ids[j], ids[i]];
    setBusy(true); await post(SIGNAGE_API, { action: "reorder", ids }).catch(() => {}); await load(); setBusy(false);
  }

  const inp = { padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 };
  const btn = { padding: "8px 14px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer" };
  const th = { padding: "8px 6px", borderBottom: "2px solid #e5e7eb", fontSize: 13, textAlign: "left", background: "#f9fafb" };
  const td = { padding: "6px", borderBottom: "1px solid #f1f5f9", fontSize: 14, verticalAlign: "middle" };
  const displayUrl = `${DISPLAY_BASE}/signage?branch=${branch}`;

  return (
    <div style={{ padding: 20, fontFamily: "Tahoma, sans-serif" }}>
      <h2 style={{ margin: "0 0 4px" }}>📺 จอประชาสัมพันธ์หน้าร้าน</h2>
      <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 12 }}>
        สไลด์หมุนบนจอ Android — เปิดบนเครื่องป้ายแต่ละจอ (ไม่ต้อง login): จอ 1 <a href={`${displayUrl}&screen=1`} target="_blank" rel="noreferrer">{displayUrl}&screen=1</a> · จอ 2 <a href={`${displayUrl}&screen=2`} target="_blank" rel="noreferrer">{displayUrl}&screen=2</a> · แก้ที่นี่แล้วจอเปลี่ยนเองภายใน 1 นาที (สไลด์ "ทุกจอ" ขึ้นทั้ง 2 จอ)
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <label>สาขา <select value={branch} onChange={(e) => setBranch(e.target.value)} style={inp}>
          {(branches.length ? branches : [{ branch_code: "SCY06", branch_name: "ป.เปา" }]).map((b) => <option key={b.branch_code} value={b.branch_code}>{b.branch_code} {b.branch_name || ""}</option>)}
        </select></label>
        <button onClick={() => window.open(`/signage?branch=${branch}&screen=1`, "_blank")} style={{ ...btn, background: "#1d4ed8", color: "#fff" }}>▶ ดูตัวอย่างจอ 1</button>
        <button onClick={() => window.open(`/signage?branch=${branch}&screen=2&split=3`, "_blank")} style={{ ...btn, background: "#7c3aed", color: "#fff" }}>▶ ดูตัวอย่างจอ 2 (แบ่ง 3 ส่วน)</button>
        <button onClick={load} style={{ ...btn, background: "#e5e7eb" }}>🔄</button>
        {msg && <span style={{ fontSize: 14, color: msg.startsWith("❌") ? "#b91c1c" : "#166534" }}>{msg}</span>}
      </div>

      {/* รายการสไลด์ */}
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", marginBottom: 20 }}>
        <thead><tr><th style={th}>ลำดับ</th><th style={th}>ชนิด</th><th style={th}>ตัวอย่าง</th><th style={th}>หัวข้อ</th><th style={th}>จอ</th><th style={th}>วินาที</th><th style={th}>แสดงตั้งแต่–ถึง</th><th style={th}>เปิด</th><th style={th}></th></tr></thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 20 }}>ยังไม่มีสไลด์ — เพิ่มด้านล่าง</td></tr>}
          {items.map((it, i) => {
            const thumb = it.kind === "image" ? thumbs[`${it.id}@${it.updated_at}`] : null;
            return (
              <tr key={it.id} style={{ opacity: it.active ? 1 : .5 }}>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  <button onClick={() => move(i, -1)} disabled={busy || i === 0} style={{ ...btn, padding: "2px 8px", background: "#f3f4f6" }}>▲</button>
                  <button onClick={() => move(i, 1)} disabled={busy || i === items.length - 1} style={{ ...btn, padding: "2px 8px", background: "#f3f4f6", marginLeft: 4 }}>▼</button>
                  <span style={{ marginLeft: 8, color: "#6b7280" }}>{i + 1}</span>
                </td>
                <td style={td}>{KINDS[it.kind] || it.kind}</td>
                <td style={td}>
                  {it.kind === "image" && (thumb && thumb !== "none" ? <img src={thumb} alt="" style={{ height: 70, borderRadius: 4, border: "1px solid #e5e7eb" }} /> : <span style={{ color: "#9ca3af" }}>{thumb === "none" ? "ไม่มีรูป" : "…"}</span>)}
                  {it.kind === "video" && <span style={{ fontSize: 13, color: "#374151" }}>🎬 {it.has_image ? `ไฟล์ในระบบ ${(Number(it.media_len || 0) * 0.75 / 1048576).toFixed(1)} MB` : it.payload?.url ? <a href={it.payload.url} target="_blank" rel="noreferrer">{String(it.payload.url).slice(0, 50)}…</a> : "ไม่มีวิดีโอ"}</span>}
                  {it.kind === "vehicle" && <span style={{ fontSize: 13, color: "#374151" }}>{it.brand_name} {it.series_name}{it.payload?.promo ? ` · 🔥 ${it.payload.promo}` : ""}</span>}
                  {it.kind === "text" && <span style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}>{String(it.payload?.text || "").slice(0, 80)}</span>}
                </td>
                <td style={td}><input defaultValue={it.title || ""} onBlur={(e) => { if (e.target.value !== (it.title || "")) patch(it, { title: e.target.value }); }} style={{ ...inp, width: 200 }} /></td>
                <td style={td}><select value={it.screen || "all"} onChange={(e) => patch(it, { screen: e.target.value })} style={inp}>
                  {Object.entries(SCREENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <select value={Number(it.zone) || 1} onChange={(e) => patch(it, { zone: Number(e.target.value) })} style={{ ...inp, marginLeft: 4 }} title="ส่วนของจอที่แบ่ง 3 (จอ 2)">
                  {Object.entries(ZONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                <td style={td}><input type="number" min={3} defaultValue={it.duration_sec} onBlur={(e) => { const v = Number(e.target.value) || 10; if (v !== it.duration_sec) patch(it, { duration_sec: v }); }} style={{ ...inp, width: 64 }} /></td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  <input type="date" defaultValue={it.start_date ? String(it.start_date).slice(0, 10) : ""} onBlur={(e) => patch(it, { start_date: e.target.value || null })} style={inp} /> –{" "}
                  <input type="date" defaultValue={it.end_date ? String(it.end_date).slice(0, 10) : ""} onBlur={(e) => patch(it, { end_date: e.target.value || null })} style={inp} />
                </td>
                <td style={td}><input type="checkbox" checked={!!it.active} onChange={(e) => patch(it, { active: e.target.checked })} /></td>
                <td style={td}><button onClick={() => remove(it)} disabled={busy} style={{ ...btn, background: "#fee2e2", color: "#b91c1c" }}>ลบ</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* เพิ่มสไลด์ */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>➕ เพิ่มสไลด์</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.entries(KINDS).map(([k, label]) => (
            <button key={k} onClick={() => setKind(k)} style={{ ...btn, background: kind === k ? "#072d6b" : "#f3f4f6", color: kind === k ? "#fff" : "#111" }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 900 }}>
          <label>หัวข้อ (ไม่บังคับ)<br /><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ ...inp, width: "100%" }} placeholder={kind === "vehicle" ? "ว่าง = ยี่ห้อ + รุ่น" : kind === "line" ? "ว่าง = เพิ่มเพื่อน LINE ป.เปามอเตอร์เซอร์วิส" : ""} /></label>
          <label>แสดงบนจอ / กี่วินาที<br />
            <select value={form.screen} onChange={(e) => setForm({ ...form, screen: e.target.value })} style={inp}>{Object.entries(SCREENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>{" "}
            <select value={form.zone} onChange={(e) => setForm({ ...form, zone: Number(e.target.value) })} style={inp} title="จอ 2 แบ่ง 3 ส่วน: สไลด์หลักด้านบน / รูปเล็กมุมขวาบน / ข้อความด้านล่าง">{Object.entries(ZONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>{" "}
            <input type="number" min={3} value={form.duration_sec} onChange={(e) => setForm({ ...form, duration_sec: e.target.value })} style={{ ...inp, width: 80 }} /> วินาที</label>
          <label>แสดงตั้งแต่วันที่ (ไม่บังคับ)<br /><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} style={inp} /></label>
          <label>ถึงวันที่ (ไม่บังคับ)<br /><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} style={inp} /></label>

          {kind === "image" && (
            <div style={{ gridColumn: "1 / -1" }}>
              <input type="file" accept="image/*" onChange={onPickFile} />
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>แนะนำรูปแนวตั้ง 1080×1920 (ระบบย่อให้อัตโนมัติ) — รูปแนวนอนจะแสดงแบบมีขอบดำบน-ล่าง</div>
              {imgFile && <img src={imgFile.preview} alt="" style={{ height: 240, marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 6 }} />}
            </div>
          )}
          {kind === "video" && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ marginBottom: 6 }}>อัปโหลดคลิป (MP4/MOV/WebM — เกิน {MAX_VIDEO_MB} MB ระบบย่อให้เอง ใช้เวลาเท่าความยาวคลิป) <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onPickVideo} disabled={busy} /></div>
              <div style={{ marginBottom: 6 }}>หรือใส่ลิงก์วิดีโอ (ไฟล์ .mp4 ที่ฝากไว้ที่อื่น เช่น Cloudflare R2 — Google Drive ใช้ไม่ได้) <input value={vidUrl} onChange={(e) => setVidUrl(e.target.value)} style={{ ...inp, width: 420 }} placeholder="https://.../promo.mp4 (ลิงก์ไฟล์ตรง เช่น Cloudflare R2)" disabled={!!vidFile} /></div>
              {isGoogleDrive(vidUrl) && <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 6 }}>⚠️ ลิงก์ Google Drive เล่นบนจอไม่ได้ (Google บล็อกการฝังจากเว็บอื่น) — ดาวน์โหลดไฟล์แล้วอัปโหลดเข้าระบบแทน</div>}
              <div style={{ fontSize: 12, color: "#6b7280" }}>แนะนำคลิปแนวตั้ง 1080×1920 ยาว 15–30 วินาที (ความละเอียด 720p ก็พอ) — จอจะเล่นจนจบคลิปแล้วไปสไลด์ถัดไป ปิดเสียงเป็นค่าเริ่มต้น (เปิดเสียงที่จอด้วย &sound=1)</div>
              {vidFile && <video src={vidFile.preview} controls muted style={{ height: 240, marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 6, background: "#000" }} />}
            </div>
          )}
          {kind === "vehicle" && (
            <>
              <label>ยี่ห้อ<br /><select value={selBrand} onChange={(e) => { setSelBrand(e.target.value); setSelSeries(""); setSelColor(""); }} style={{ ...inp, width: "100%" }}>
                <option value="">-- เลือก --</option>{brands.map((b) => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}</select></label>
              <label>รุ่น<br /><select value={selSeries} onChange={(e) => { setSelSeries(e.target.value); setSelColor(""); }} style={{ ...inp, width: "100%" }}>
                <option value="">-- เลือก --</option>{seriesOpts.map((s) => <option key={s.series_id} value={s.series_id}>{s.series_name}</option>)}</select></label>
              <label>สี / แบบ<br /><select value={selColor} onChange={(e) => setSelColor(e.target.value)} style={{ ...inp, width: "100%" }}>
                <option value="">-- เลือก --</option>{colorOpts.map((c) => <option key={c.color_id} value={c.color_id}>{c.color_name}{c.type_name ? ` (${c.type_name})` : ""}{c.has_image ? " 📷" : ""}</option>)}</select></label>
              <label>ป้ายโปรโมชั่น (ไม่บังคับ)<br /><input value={form.promo} onChange={(e) => setForm({ ...form, promo: e.target.value })} style={{ ...inp, width: "100%" }} placeholder="เช่น ดาวน์ 0 บาท ผ่อนสบาย" /></label>
              <label style={{ gridColumn: "1 / -1" }}>หมายเหตุใต้ราคา (ไม่บังคับ)<br /><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ ...inp, width: "100%" }} placeholder="เช่น ราคาไม่รวมจดทะเบียน/พรบ." /></label>
              <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "#374151" }}>
                ราคาที่โชว์ = ราคาเงินสดประกาศของกลุ่ม ป.เปา จากตารางราคา (เปลี่ยนราคาในระบบ จอเปลี่ยนเอง)
                {colorPreview && colorPreview !== "none" && <div><img src={colorPreview} alt="" style={{ height: 160, marginTop: 6 }} /></div>}
                {colorPreview === "none" && <div style={{ color: "#b45309" }}>สีนี้ยังไม่มีรูปในระบบ (เพิ่มได้ที่เมนูรูปสีรถ)</div>}
              </div>
            </>
          )}
          {kind === "text" && <label style={{ gridColumn: "1 / -1" }}>ข้อความ<br /><textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} rows={4} style={{ ...inp, width: "100%" }} placeholder="เช่น วันที่ 1-3 พ.ย. ร้านปิดปรับปรุง" /></label>}
          {kind === "queue" && <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "#374151" }}>แสดงบัตรคิวที่รอ/กำลังบริการของสาขานี้ + รถที่อยู่ในช่องซ่อม (จากกล้อง) อัปเดตทุก 20 วินาที</div>}
          {kind === "line" && <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "#374151" }}>QR เพิ่มเพื่อน LINE OA ป.เปามอเตอร์เซอร์วิส (@975ltwhp)</div>}
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={addItem} disabled={busy} style={{ ...btn, background: "#059669", color: "#fff", fontSize: 15 }}>💾 เพิ่มสไลด์</button>
        </div>
      </div>
    </div>
  );
}
