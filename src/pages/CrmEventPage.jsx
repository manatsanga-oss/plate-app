import React, { useEffect, useMemo, useState } from "react";
import { THAI_PROVINCES } from "../data/thai_provinces";

// CRM → ประชาสัมพันธ์กิจกรรม (user 2026-09-16, เฟส 1 = แสดงรายชื่อลูกค้าที่มี LINE)
// ข้อมูลจาก crm-api list_line_customers: รวม line_user_id จาก QR/LINE ใบเสร็จ + ขายปลีก NEW + จองรถ
// เติมเพศ/วันเกิด/จังหวัด/อำเภอ จากฐานลูกค้า + ประวัติขาย (จับคู่เบอร์ 9 หลักท้าย / เลขบัตร)
// เลือกกลุ่มเป้าหมายด้วยตัวเลือก 4 กลุ่มพร้อมกัน (AND): รถ (ยี่ห้อ/รุ่น) · ที่อยู่ (จังหวัด/อำเภอ) · บุคคล (เพศ/ช่วงอายุ) · สาขา
// เฟส 2 (2026-09-16): ติ๊กเลือกผู้รับ → แนบรูป/PDF (crm_files เสิร์ฟผ่าน GET crm-file) → ส่ง Flex ทาง LINE ทีละคน (send_to_recipient)
// การ์ดมีปุ่ม สนใจ/ไม่สนใจ → หน้า /crm-reply (CrmReplyPage) บันทึกคำตอบ+เบอร์ → แท็บประวัติการส่ง/ตอบกลับ
const CRM_API = "https://n8n-new-project-gwf2.onrender.com/webhook/crm-api";

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return {}; }
}
const unwrapList = (d) => { try { return typeof d?.listjson === "string" ? JSON.parse(d.listjson) : Array.isArray(d) ? d : []; } catch { return []; } };
const thaiDate = (iso) => {
  if (!iso) return "-";
  const s = String(iso).slice(0, 10); const [y, m, d] = s.split("-");
  return y && m && d ? `${Number(d)}/${Number(m)}/${Number(y) + 543}` : s;
};
// ยี่ห้อ: DCS/ระบบเก็บทั้ง HONDA/ฮอนด้า, YAMAHA/ยามาฮ่า → รวมเป็นชื่อเดียว
const normBrand = (b) => {
  const s = String(b || "").trim().toUpperCase();
  if (!s) return "";
  if (s.includes("HONDA") || s.includes("ฮอนด้า")) return "HONDA";
  if (s.includes("YAMAHA") || s.includes("ยามาฮ่า") || s.includes("ยามาฮา")) return "YAMAHA";
  return s;
};
const normModel = (m) => String(m || "").replace(/\s+/g, " ").trim().toUpperCase();
// เพศ: จากฟอร์ม LINE/ฐานลูกค้าก่อน ไม่มีค่อยเดาจากคำนำหน้าชื่อ
const genderOf = (r) => {
  const g = String(r.gender || "").trim().toLowerCase();
  if (["ชาย", "male", "m"].includes(g)) return "ชาย";
  if (["หญิง", "female", "f"].includes(g)) return "หญิง";
  const t = String(r.title || r.customer_name || "").trim();
  if (/^(นางสาว|นาง|น\.ส\.|MRS\.?|MS\.?|MISS)/i.test(t)) return "หญิง";
  if (/^(นาย|MR\.?)/i.test(t)) return "ชาย";
  return "";
};
// วันเกิด: ISO ค.ศ. หรือ dd/mm/พ.ศ. → อายุ (ปี)
const ageOf = (birth) => {
  const s = String(birth || "").trim();
  if (!s) return null;
  let d = null;
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) { let y = Number(m1[1]); if (y > 2400) y -= 543; d = new Date(y, Number(m1[2]) - 1, Number(m1[3])); }
  else if (m2) { let y = Number(m2[3]); if (y > 2400) y -= 543; d = new Date(y, Number(m2[2]) - 1, Number(m2[1])); }
  if (!d || isNaN(d)) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
};
const AGE_BANDS = [["<20", 0, 19], ["20-29", 20, 29], ["30-39", 30, 39], ["40-49", 40, 49], ["50-59", 50, 59], ["60+", 60, 200]];
const ageBandOf = (age) => { if (age == null) return ""; const b = AGE_BANDS.find(([, lo, hi]) => age >= lo && age <= hi); return b ? b[0] : ""; };
// จังหวัด/อำเภอ: จากฐานลูกค้า/ประวัติขายก่อน ไม่มีค่อยหาในข้อความที่อยู่
const stripPrefix = (s) => String(s || "").replace(/^(จังหวัด|จ\.|อำเภอ|อ\.|เขต)\s*/, "").trim();
const provinceOf = (r) => {
  const p = stripPrefix(r.province);
  if (p) return p;
  const addr = String(r.address || "");
  const m = addr.match(/(?:จังหวัด|จ\.)\s*([^\s,]+)/);
  if (m) { const hit = THAI_PROVINCES.find(x => m[1].startsWith(x) || x.startsWith(m[1])); if (hit) return hit; }
  // ชื่อจังหวัดยาวก่อน (กัน "นคร" ชนกันหลายจังหวัด)
  const found = [...THAI_PROVINCES].sort((a, b) => b.length - a.length).find(x => addr.includes(x));
  return found || "";
};
// สาขา: "SCY06 ป.เปา วังน้อย" / "SCY06" → รหัส 5 ตัว + ชื่อ
const branchOf = (r) => {
  const b = String(r.branch || "").trim();
  if (!b) return "";
  const m = b.match(/^(SCY\d{2})\s*(.*)$/i);
  return m ? `${m[1].toUpperCase()}${m[2] ? " " + m[2].trim() : ""}` : b;
};
const districtOf = (r) => {
  const d = stripPrefix(r.district);
  if (d) return d;
  const m = String(r.address || "").match(/(?:อำเภอ|อ\.|เขต)\s*([^\s,]+)/);
  return m ? m[1] : "";
};

const FILE_URL = (id) => `https://n8n-new-project-gwf2.onrender.com/webhook/crm-file?id=${id}`;
const MAX_FILE_MB = 5;
const readAsBase64 = (file) => new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result || "")); fr.onerror = no; fr.readAsDataURL(file); });
// รูปที่โชว์ในการ์ด LINE ต้องเป็น JPG/PNG https — PDF แปลงหน้าแรกเป็นรูปในเบราว์เซอร์ด้วย pdf.js (โหลดจาก cdnjs ตอนใช้), รูปใหญ่ย่อให้กว้างไม่เกิน 1040px
const MAX_IMG_W = 1040;
let _pdfjsP = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsP) return _pdfjsP;
  _pdfjsP = new Promise((ok, no) => {
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    sc.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; ok(window.pdfjsLib); } catch (e) { no(e); } };
    sc.onerror = () => no(new Error("โหลด pdf.js ไม่ได้"));
    document.head.appendChild(sc);
  });
  return _pdfjsP;
}
const canvasToJpeg = (canvas) => canvas.toDataURL("image/jpeg", 0.88);
async function pdfFirstPageToImage(file) {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const page = await doc.getPage(1);
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(2, MAX_IMG_W / vp1.width);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas"); canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return { dataUrl: canvasToJpeg(canvas), width: canvas.width, height: canvas.height };
}
async function imageToJpeg(dataUrl) {
  const img = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = dataUrl; });
  const scale = Math.min(1, MAX_IMG_W / img.naturalWidth);
  const canvas = document.createElement("canvas"); canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvasToJpeg(canvas), width: canvas.width, height: canvas.height };
}
// อัตราส่วนภาพสำหรับ Flex hero (LINE: "W:H" สูงได้ไม่เกิน 3 เท่าของกว้าง)
const aspectOf = (w, h) => { if (!w || !h) return "1:1"; const r = Math.min(3, Math.max(0.2, h / w)); return `100:${Math.round(r * 100)}`; };
const dataUrlBytes = (u) => Math.round((String(u).split(",")[1] || "").length * 3 / 4);
const thaiDateTime = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso); if (isNaN(d)) return String(iso).slice(0, 16);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function CrmEventPage({ currentUser }) {
  const [tab, setTab] = useState("target"); // target | history
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const EMPTY = { brand: "", model: "", province: "", district: "", gender: "", age: "", branch: "" };
  const [f, setF] = useState(EMPTY);
  const setFk = (k, v) => setF(prev => ({ ...prev, [k]: v, ...(k === "brand" ? { model: "" } : {}), ...(k === "province" ? { district: "" } : {}) }));
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  // เลือกผู้รับ (checkbox) — เก็บ line_user_id
  const [sel, setSel] = useState(() => new Set());
  // แผงส่งข่าว
  const [camp, setCamp] = useState({ title: "", message: "" });
  const [file, setFile] = useState(null); // { name, mime, size, dataUrl }
  const [sending, setSending] = useState(null); // { total, done, sent, failed, campaign_id }
  // ประวัติ
  const [camps, setCamps] = useState([]);
  const [campOpen, setCampOpen] = useState(null); // campaign_id
  const [recips, setRecips] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  async function load() {
    setLoading(true); setMessage("");
    try {
      const d = await post(CRM_API, { action: "list_line_customers" });
      if (d?.__error) throw new Error(d.__error);
      const list = unwrapList(d).filter(r => r && r.line_user_id).map(r => {
        const vs = [...(Array.isArray(r.vehicles) ? r.vehicles : []), ...(Array.isArray(r.history_vehicles) ? r.history_vehicles : [])]
          .map(v => ({ ...v, brand: normBrand(v.brand), model: normModel(v.model) })).filter(v => v.brand || v.model);
        const seen = new Set(); const vehicles = [];
        for (const v of vs) { const k = `${v.brand}|${v.model}`; if (seen.has(k)) continue; seen.add(k); vehicles.push(v); }
        const age = ageOf(r.birth_date);
        return { ...r, _vehicles: vehicles, _gender: genderOf(r), _age: age, _ageBand: ageBandOf(age), _province: provinceOf(r), _district: districtOf(r), _branch: branchOf(r) };
      });
      setRows(list);
    } catch (e) { setMessage("❌ โหลดไม่สำเร็จ (ยัง import workflow crm-api หรือยัง?) " + (e?.message || "")); setRows([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function loadHistory(openId) {
    setHistLoading(true);
    try {
      const d = await post(CRM_API, { action: "list_campaigns" });
      setCamps(unwrapList(d).filter(c => c && c.id));
      if (openId) { const r = await post(CRM_API, { action: "list_campaign_recipients", campaign_id: openId }); setRecips(unwrapList(r)); setCampOpen(openId); }
    } catch { setCamps([]); }
    setHistLoading(false);
  }
  useEffect(() => { if (tab === "history") loadHistory(campOpen); }, [tab]); // eslint-disable-line
  async function openCamp(id) {
    if (campOpen === id) { setCampOpen(null); return; }
    setHistLoading(true);
    try { const r = await post(CRM_API, { action: "list_campaign_recipients", campaign_id: id }); setRecips(unwrapList(r)); setCampOpen(id); } catch { setRecips([]); }
    setHistLoading(false);
  }

  // ตัวเลือก 4 กลุ่มใช้ร่วมกัน (AND) — ตัวเลข () ใน dropdown นับจากลูกค้าที่ผ่านตัวเลือกกลุ่มอื่นแล้ว
  const passes = (r, skip) => {
    if (skip !== "brand" && f.brand && !r._vehicles.some(v => v.brand === f.brand)) return false;
    if (skip !== "model" && f.model && !r._vehicles.some(v => (!f.brand || v.brand === f.brand) && v.model === f.model)) return false;
    if (skip !== "province" && f.province && r._province !== f.province) return false;
    if (skip !== "district" && f.district && r._district !== f.district) return false;
    if (skip !== "gender" && f.gender && r._gender !== f.gender) return false;
    if (skip !== "age" && f.age && r._ageBand !== f.age) return false;
    if (skip !== "branch" && f.branch && r._branch !== f.branch) return false;
    return true;
  };
  const countBy = (skip, fn) => {
    const m = new Map();
    rows.filter(r => passes(r, skip)).forEach(r => { const vals = fn(r); [...new Set((Array.isArray(vals) ? vals : [vals]).filter(Boolean))].forEach(v => m.set(v, (m.get(v) || 0) + 1)); });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "th"));
  };
  const opts = useMemo(() => ({
    brand: countBy("brand", r => r._vehicles.map(v => v.brand)),
    model: countBy("model", r => r._vehicles.filter(v => !f.brand || v.brand === f.brand).map(v => v.model)),
    province: countBy("province", r => r._province),
    district: countBy("district", r => (!f.province || r._province === f.province) ? r._district : ""),
    gender: countBy("gender", r => r._gender),
    age: (() => { const c = countBy("age", r => r._ageBand); return AGE_BANDS.map(([b]) => [b, (c.find(x => x[0] === b) || [b, 0])[1]]).filter(x => x[1] > 0); })(),
    branch: countBy("branch", r => r._branch),
  }), [rows, f]); // eslint-disable-line

  const filtered = useMemo(() => rows.filter(r => passes(r, null)).filter(r => {
    if (!search.trim()) return true;
    const kw = search.trim().toLowerCase();
    const hay = [r.customer_name, r.line_display_name, r.phone, r.address, r._province, r._district, r._branch, ...r._vehicles.map(v => `${v.brand} ${v.model}`)].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  }), [rows, f, search]); // eslint-disable-line
  const shown = showAll ? filtered : filtered.slice(0, 300);
  const activeCount = Object.values(f).filter(Boolean).length;
  const criteria = [f.brand && `ยี่ห้อ ${f.brand}`, f.model && `รุ่น ${f.model}`, f.province && `จังหวัด${f.province}`, f.district && `อ.${f.district}`, f.gender && `เพศ${f.gender}`, f.age && `อายุ ${f.age} ปี`, f.branch && `สาขา ${f.branch}`].filter(Boolean);
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => sel.has(r.line_user_id));
  const toggleOne = (id) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllFiltered = () => setSel(prev => { const n = new Set(prev); if (allFilteredSelected) filtered.forEach(r => n.delete(r.line_user_id)); else filtered.forEach(r => n.add(r.line_user_id)); return n; });
  const selectedRows = rows.filter(r => sel.has(r.line_user_id));

  async function pickFile(e) {
    const fl = e.target.files?.[0]; e.target.value = "";
    if (!fl) return;
    const okType = fl.type.startsWith("image/") || fl.type === "application/pdf";
    if (!okType) { setMessage("❌ รองรับเฉพาะรูปภาพ (JPG/PNG) หรือ PDF"); return; }
    if (fl.size > MAX_FILE_MB * 1024 * 1024) { setMessage(`❌ ไฟล์ใหญ่เกิน ${MAX_FILE_MB} MB`); return; }
    setMessage("");
    try {
      const dataUrl = await readAsBase64(fl);
      // รูปสำหรับการ์ด LINE: รูป → ย่อเป็น JPG · PDF → รูปหน้าแรก (ต้นฉบับยังเก็บให้กดเปิดจากรูป)
      const prev = fl.type === "application/pdf" ? await pdfFirstPageToImage(fl) : await imageToJpeg(dataUrl);
      setFile({ name: fl.name, mime: fl.type, size: fl.size, dataUrl, preview: prev });
    } catch (e) { setMessage("❌ อ่านไฟล์ไม่สำเร็จ: " + (e?.message || e)); }
  }

  async function sendCampaign() {
    if (sending) return;
    const targets = selectedRows;
    if (!camp.title.trim()) { setMessage("❌ กรอกหัวข้อกิจกรรม"); return; }
    if (!targets.length) { setMessage("❌ ติ๊กเลือกลูกค้าที่จะส่งก่อน"); return; }
    if (!window.confirm(`ส่งข่าวกิจกรรม "${camp.title.trim()}" ทาง LINE ถึงลูกค้า ${targets.length} ราย${file ? `\nแนบไฟล์ ${file.name}` : ""}\nเกณฑ์: ${criteria.join(" · ") || "เลือกเอง"}\n\nยืนยัน?`)) return;
    setMessage("");
    setSending({ total: targets.length, done: 0, sent: 0, failed: 0, campaign_id: null });
    try {
      // 1) ไฟล์ต้นฉบับ + รูปสำหรับการ์ด (PDF = รูปหน้าแรก)
      let fileId = null, previewId = null;
      if (file) {
        const by = currentUser?.username || currentUser?.name || "";
        const fr = await post(CRM_API, { action: "save_file", name: file.name, mime: file.mime, size: file.size, data_base64: file.dataUrl, created_by: by });
        const row = Array.isArray(fr) ? fr[0] : fr;
        if (!row?.id) throw new Error(row?.__error || "อัปโหลดไฟล์ไม่สำเร็จ");
        fileId = row.id;
        if (file.preview?.dataUrl) {
          const pr = await post(CRM_API, { action: "save_file", name: file.name.replace(/\.[^.]+$/, "") + "_card.jpg", mime: "image/jpeg", size: dataUrlBytes(file.preview.dataUrl), data_base64: file.preview.dataUrl, created_by: by });
          const prow = Array.isArray(pr) ? pr[0] : pr;
          if (prow?.id) previewId = prow.id;
        }
      }
      // 2) แคมเปญ + ผู้รับ
      const cr = await post(CRM_API, {
        action: "create_campaign", title: camp.title.trim(), message: camp.message.trim(),
        file_id: fileId, file_name: file?.name || "", file_mime: file?.mime || "", preview_file_id: previewId, criteria: criteria.join(" · "),
        recipients: targets.map(r => ({ line_user_id: r.line_user_id, customer_name: r.customer_name || r.line_display_name || "", phone: r.phone || "", branch: r._branch || "" })),
        created_by: currentUser?.username || currentUser?.name || "",
      });
      const crow = Array.isArray(cr) ? cr[0] : cr;
      const campaignId = Number(crow?.campaign_id) || 0;
      if (!campaignId) throw new Error(crow?.__error || "สร้างแคมเปญไม่สำเร็จ");
      const recMap = new Map((unwrapList(crow) || []).map(x => [x.line_user_id, x.id]));
      setSending(s => ({ ...s, campaign_id: campaignId }));
      // 3) ส่งทีละคน (2 คนพร้อมกัน) แสดง progress
      const queue = targets.filter(r => recMap.has(r.line_user_id));
      let idx = 0;
      const worker = async () => {
        while (idx < queue.length) {
          const r = queue[idx++];
          let ok = false;
          try {
            const res = await post(CRM_API, {
              action: "send_to_recipient", campaign_id: campaignId, recipient_id: recMap.get(r.line_user_id), line_user_id: r.line_user_id, branch: r._branch || "",
              title: camp.title.trim(), message: camp.message.trim(), file_url: fileId ? FILE_URL(fileId) : "", file_mime: file?.mime || "",
              image_url: previewId ? FILE_URL(previewId) : "", aspect: aspectOf(file?.preview?.width, file?.preview?.height),
            });
            const row = Array.isArray(res) ? res[0] : res;
            ok = row?.status === "sent";
          } catch { ok = false; }
          setSending(s => s ? ({ ...s, done: s.done + 1, sent: s.sent + (ok ? 1 : 0), failed: s.failed + (ok ? 0 : 1) }) : s);
        }
      };
      await Promise.all([worker(), worker()]);
      setMessage(`✅ ส่งข่าวกิจกรรม "${camp.title.trim()}" แล้ว — ดูผลที่แท็บประวัติการส่ง`);
      setCamp({ title: "", message: "" }); setFile(null); setSel(new Set());
      setTab("history"); await loadHistory(campaignId);
    } catch (e) { setMessage("❌ " + (e?.message || e)); }
    setSending(null);
  }

  const inp = { padding: "7px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 13.5, boxSizing: "border-box", background: "#fff", minWidth: 150 };
  const th = { padding: "8px 6px", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff", position: "sticky", top: 0 };
  const td = { padding: "7px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
  const tag = (t, bg, fg) => <span style={{ padding: "1px 7px", borderRadius: 10, fontSize: 11, background: bg, color: fg, whiteSpace: "nowrap" }}>{t}</span>;
  const selBox = (k, label, options, unit) => (
    <select value={f[k]} onChange={e => setFk(k, e.target.value)} style={{ ...inp, borderColor: f[k] ? "#1e3a8a" : "#d1d5db", background: f[k] ? "#eff6ff" : "#fff", fontWeight: f[k] ? 700 : 400 }}>
      <option value="">{label}: ทั้งหมด</option>
      {options.map(([v, n]) => <option key={v} value={v}>{v}{unit || ""} ({n})</option>)}
    </select>
  );
  const grp = (icon, title, children) => (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{icon} {title}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
  const tabBtn = (k, label) => (
    <button key={k} onClick={() => setTab(k)} style={{ padding: "9px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Tahoma", border: tab === k ? "2px solid #1e3a8a" : "1.5px solid #cbd5e1", background: tab === k ? "#1e3a8a" : "#fff", color: tab === k ? "#fff" : "#334155" }}>{label}</button>
  );
  const respTag = (r) => r.response === "สนใจ" ? tag("✅ สนใจ", "#dcfce7", "#15803d") : r.response === "ไม่สนใจ" ? tag("❌ ไม่สนใจ", "#fee2e2", "#991b1b") : <span style={{ color: "#cbd5e1" }}>—</span>;
  const statusTag = (s) => s === "sent" ? tag("ส่งแล้ว", "#dbeafe", "#1e40af") : s === "failed" ? tag("ส่งไม่สำเร็จ", "#fee2e2", "#991b1b") : tag("รอส่ง", "#f1f5f9", "#64748b");

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1400 }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>📣 CRM — ประชาสัมพันธ์กิจกรรม</h2>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
        เลือกกลุ่มเป้าหมายจากลูกค้าที่มี LINE ผูกกับร้าน → ติ๊กเลือกผู้รับ → แนบรูป/PDF + ข้อความ → ส่งทาง LINE ลูกค้ากด "สนใจ" แล้วใส่เบอร์โทร ระบบเก็บประวัติการตอบกลับ
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>{tabBtn("target", "🎯 เลือกกลุ่มเป้าหมาย / ส่งข่าว")}{tabBtn("history", "📋 ประวัติการส่ง / ตอบกลับ")}</div>
      {message && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, fontSize: 14, background: message.startsWith("✅") ? "#f0fdf4" : "#fef2f2", border: message.startsWith("✅") ? "1px solid #bbf7d0" : "1px solid #fecaca" }}>{message}</div>}

      {tab === "target" && (<>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10 }}>
            {grp("🏍️", "กลุ่มรถจักรยานยนต์", <>{selBox("brand", "ยี่ห้อ", opts.brand)}{selBox("model", "รุ่น", opts.model)}</>)}
            {grp("📍", "กลุ่มที่อยู่", <>{selBox("province", "จังหวัด", opts.province)}{selBox("district", "อำเภอ", opts.district)}</>)}
            {grp("👤", "กลุ่มบุคคล", <>{selBox("gender", "เพศ", opts.gender)}{selBox("age", "อายุ", opts.age, " ปี")}</>)}
            {grp("🏢", "กลุ่มสาขา", selBox("branch", "สาขา", opts.branch))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ชื่อ / LINE / เบอร์ / ที่อยู่ / รุ่นรถ" style={{ ...inp, width: 280 }} />
            <button onClick={load} disabled={loading} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>{loading ? "⏳" : "🔄"}</button>
            {activeCount > 0 && <button onClick={() => setF(EMPTY)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", color: "#b91c1c", cursor: "pointer", fontFamily: "Tahoma", fontSize: 12.5 }}>✖ ล้างตัวเลือก ({activeCount})</button>}
            <button onClick={toggleAllFiltered} disabled={!filtered.length} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #1e3a8a", background: "#fff", color: "#1e3a8a", cursor: "pointer", fontFamily: "Tahoma", fontSize: 12.5, fontWeight: 700 }}>
              {allFilteredSelected ? "☐ เอาออกทั้งหมดที่แสดง" : `☑ เลือกทั้งหมดที่แสดง (${filtered.length})`}
            </button>
            <span style={{ marginLeft: "auto", fontSize: 13, color: "#334155", textAlign: "right" }}>
              กลุ่มเป้าหมาย <b style={{ color: "#1e3a8a", fontSize: 18 }}>{filtered.length}</b> / {rows.length} ราย · เลือกส่ง <b style={{ color: "#b45309", fontSize: 18 }}>{sel.size}</b> ราย
              {criteria.length > 0 && <div style={{ fontSize: 12, color: "#1e3a8a" }}>{criteria.join(" · ")}</div>}
            </span>
          </div>
        </div>

        {/* แผงส่งข่าวกิจกรรม */}
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8 }}>📨 ส่งข่าวกิจกรรมทาง LINE ถึงลูกค้าที่เลือก ({sel.size} ราย)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={camp.title} onChange={e => setCamp(c => ({ ...c, title: e.target.value }))} placeholder="หัวข้อกิจกรรม * เช่น โปรโมชั่นเช็คระยะฟรี ต.ค. 69" style={{ ...inp, fontWeight: 700 }} maxLength={120} />
              <textarea value={camp.message} onChange={e => setCamp(c => ({ ...c, message: e.target.value }))} rows={4} placeholder="รายละเอียดกิจกรรม / วันเวลา / สถานที่ / เงื่อนไข" style={{ ...inp, resize: "vertical", minWidth: 0 }} maxLength={1800} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ padding: "7px 12px", border: "1px dashed #b45309", borderRadius: 8, cursor: "pointer", color: "#92400e", fontWeight: 700 }}>📎 เลือกไฟล์ประชาสัมพันธ์ (รูป / PDF ≤ {MAX_FILE_MB} MB)</span>
                <input type="file" accept="image/*,application/pdf" onChange={pickFile} style={{ display: "none" }} />
                {file && <span style={{ color: "#334155" }}>{file.name} ({(file.size / 1024).toFixed(0)} KB) <button onClick={() => setFile(null)} style={{ marginLeft: 6, border: "none", background: "none", color: "#b91c1c", cursor: "pointer" }}>✖</button></span>}
              </label>
              {file?.preview?.dataUrl && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <img src={file.preview.dataUrl} alt="" style={{ maxHeight: 150, maxWidth: 220, borderRadius: 8, border: "1px solid #e5e7eb", objectFit: "contain", background: "#fff" }} />
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    ตัวอย่างรูปในการ์ด LINE ({file.preview.width}×{file.preview.height})
                    {file.mime === "application/pdf" && <div>📄 PDF: โชว์หน้าแรกเป็นรูป กดรูปเปิดไฟล์ PDF ต้นฉบับ</div>}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 12, color: "#64748b" }}>การ์ด LINE: รูปเต็มใบ + หัวข้อ/ข้อความ + ปุ่ม <b>✅ สนใจกิจกรรม</b> (ใส่เบอร์โทรติดต่อกลับ) / <b>❌ ไม่สนใจ</b> ซ้าย-ขวาด้านล่าง</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: "auto" }}>
                <button onClick={sendCampaign} disabled={!!sending || sel.size === 0 || !camp.title.trim()}
                  style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: (!sending && sel.size && camp.title.trim()) ? "#0f766e" : "#d1d5db", color: "#fff", fontWeight: 700, fontFamily: "Tahoma", fontSize: 15, cursor: (!sending && sel.size && camp.title.trim()) ? "pointer" : "default" }}>
                  {sending ? `กำลังส่ง ${sending.done}/${sending.total} …` : `📤 ส่งถึง ${sel.size} ราย`}
                </button>
                {sending && <span style={{ fontSize: 12.5, color: "#334155" }}>สำเร็จ {sending.sent} · ล้มเหลว {sending.failed}</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", maxHeight: "60vh", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...th, textAlign: "center" }}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} title="เลือกทั้งหมดที่แสดง" /></th>
              <th style={th}>#</th><th style={th}>ลูกค้า</th><th style={th}>LINE</th><th style={th}>เบอร์โทร</th>
              <th style={th}>เพศ</th><th style={th}>อายุ</th><th style={th}>จังหวัด / อำเภอ</th><th style={th}>รถ</th>
              <th style={th}>สาขา / ที่มา LINE</th><th style={th}>ล่าสุด</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={11} style={{ ...td, textAlign: "center", padding: 24, color: "#6b7280" }}>กำลังโหลด...</td></tr>}
              {!loading && shown.length === 0 && <tr><td colSpan={11} style={{ ...td, textAlign: "center", padding: 24, color: "#9ca3af" }}>— ไม่มีรายชื่อตามกลุ่มที่เลือก —</td></tr>}
              {shown.map((r, i) => {
                const on = sel.has(r.line_user_id);
                return (
                  <tr key={r.line_user_id} onClick={() => toggleOne(r.line_user_id)} style={{ background: on ? "#fef3c7" : i % 2 ? "#f9fafb" : "#fff", cursor: "pointer" }}>
                    <td style={{ ...td, textAlign: "center" }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={on} onChange={() => toggleOne(r.line_user_id)} /></td>
                    <td style={{ ...td, color: "#94a3b8" }}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{r.customer_name || "-"}{r.address ? <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, maxWidth: 260, whiteSpace: "normal" }}>{r.address}</div> : null}</td>
                    <td style={{ ...td, color: "#047857" }}>{r.line_display_name || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.phone || "-"}</td>
                    <td style={td}>{r._gender ? tag(r._gender, r._gender === "ชาย" ? "#dbeafe" : "#fce7f3", r._gender === "ชาย" ? "#1e40af" : "#9d174d") : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                    <td style={td}>{r._age != null ? `${r._age} ปี` : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                    <td style={td}>{r._province || <span style={{ color: "#cbd5e1" }}>—</span>}{r._district ? <div style={{ fontSize: 11, color: "#6b7280" }}>อ.{r._district}</div> : null}</td>
                    <td style={{ ...td, whiteSpace: "normal", maxWidth: 260 }}>
                      {r._vehicles.length === 0 ? <span style={{ color: "#cbd5e1" }}>—</span> : r._vehicles.slice(0, 4).map((v, j) => (
                        <div key={j} style={{ fontSize: 12 }}>{tag(v.brand || "-", v.brand === "YAMAHA" ? "#dbeafe" : "#fee2e2", v.brand === "YAMAHA" ? "#1e40af" : "#991b1b")} {v.model || "-"}<span style={{ color: "#94a3b8", fontSize: 10 }}> {thaiDate(v.date)}</span></div>
                      ))}
                      {r._vehicles.length > 4 && <div style={{ fontSize: 11, color: "#94a3b8" }}>+{r._vehicles.length - 4} คัน</div>}
                    </td>
                    <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>{r._branch || "-"}<div style={{ color: "#94a3b8" }}>{r.sources}</div></td>
                    <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12 }}>{thaiDate(r.last_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!showAll && filtered.length > shown.length && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button onClick={() => setShowAll(true)} style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontFamily: "Tahoma" }}>แสดงทั้งหมด {filtered.length} ราย</button>
          </div>
        )}
      </>)}

      {tab === "history" && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>📋 ประวัติการส่งข่าวกิจกรรม ({camps.length})</div>
            <button onClick={() => loadHistory(campOpen)} disabled={histLoading} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>{histLoading ? "⏳" : "🔄"}</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>วันที่ส่ง</th><th style={th}>หัวข้อ</th><th style={th}>เกณฑ์กลุ่ม</th><th style={th}>ไฟล์</th>
                <th style={{ ...th, textAlign: "right" }}>ผู้รับ</th><th style={{ ...th, textAlign: "right" }}>ส่งแล้ว</th><th style={{ ...th, textAlign: "right" }}>ล้มเหลว</th>
                <th style={{ ...th, textAlign: "right" }}>✅ สนใจ</th><th style={{ ...th, textAlign: "right" }}>❌ ไม่สนใจ</th><th style={th}>ผู้ส่ง</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {camps.length === 0 && !histLoading && <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 22 }}>— ยังไม่มีการส่ง —</td></tr>}
                {camps.map(c => (
                  <React.Fragment key={c.id}>
                    <tr onClick={() => openCamp(c.id)} style={{ cursor: "pointer", background: campOpen === c.id ? "#eff6ff" : "#fff" }}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDateTime(c.sent_at || c.created_at)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{c.title}{c.message ? <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, maxWidth: 320, whiteSpace: "normal" }}>{String(c.message).slice(0, 120)}</div> : null}</td>
                      <td style={{ ...td, fontSize: 12, color: "#1e3a8a", whiteSpace: "normal", maxWidth: 220 }}>{c.criteria || "เลือกเอง"}</td>
                      <td style={{ ...td, fontSize: 12 }}>{c.file_id ? <a href={FILE_URL(c.file_id)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#1e3a8a" }}>{String(c.file_mime || "").includes("pdf") ? "📄" : "🖼️"} {c.file_name || "ไฟล์"}</a> : <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                      <td style={{ ...td, textAlign: "right" }}>{c.n_total}</td>
                      <td style={{ ...td, textAlign: "right", color: "#1e40af", fontWeight: 700 }}>{c.n_sent}</td>
                      <td style={{ ...td, textAlign: "right", color: Number(c.n_failed) > 0 ? "#b91c1c" : "#94a3b8" }}>{c.n_failed}</td>
                      <td style={{ ...td, textAlign: "right", color: "#15803d", fontWeight: 700 }}>{c.n_interest}</td>
                      <td style={{ ...td, textAlign: "right", color: "#991b1b" }}>{c.n_no}</td>
                      <td style={{ ...td, fontSize: 12 }}>{c.created_by || "-"}</td>
                      <td style={{ ...td, fontSize: 12, color: "#1e3a8a" }}>{campOpen === c.id ? "▾ ซ่อน" : "▸ ดูรายชื่อ"}</td>
                    </tr>
                    {campOpen === c.id && (
                      <tr><td colSpan={11} style={{ padding: "6px 10px 14px 28px", background: "#f8fafc" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
                          <thead><tr>
                            <th style={{ ...th, position: "static", background: "#334155" }}>#</th><th style={{ ...th, position: "static", background: "#334155" }}>ลูกค้า</th><th style={{ ...th, position: "static", background: "#334155" }}>เบอร์</th><th style={{ ...th, position: "static", background: "#334155" }}>สาขา</th>
                            <th style={{ ...th, position: "static", background: "#334155" }}>สถานะส่ง</th><th style={{ ...th, position: "static", background: "#334155" }}>เวลาส่ง</th>
                            <th style={{ ...th, position: "static", background: "#334155" }}>ตอบกลับ</th><th style={{ ...th, position: "static", background: "#334155" }}>เบอร์ติดต่อกลับ</th><th style={{ ...th, position: "static", background: "#334155" }}>ข้อความ</th><th style={{ ...th, position: "static", background: "#334155" }}>เวลาตอบ</th>
                          </tr></thead>
                          <tbody>
                            {recips.length === 0 && <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#9ca3af" }}>—</td></tr>}
                            {recips.map((r, i) => (
                              <tr key={r.id} style={{ background: r.response === "สนใจ" ? "#f0fdf4" : "#fff" }}>
                                <td style={{ ...td, color: "#94a3b8" }}>{i + 1}</td>
                                <td style={{ ...td, fontWeight: 700 }}>{r.customer_name || r.line_user_id}</td>
                                <td style={{ ...td, fontFamily: "monospace" }}>{r.phone || "-"}</td>
                                <td style={{ ...td, fontSize: 12 }}>{r.branch || "-"}</td>
                                <td style={td}>{statusTag(r.status)}{r.error ? <div style={{ fontSize: 10, color: "#b91c1c", maxWidth: 220, whiteSpace: "normal" }}>{r.error}</div> : null}</td>
                                <td style={{ ...td, fontSize: 12, whiteSpace: "nowrap" }}>{thaiDateTime(r.sent_at)}</td>
                                <td style={td}>{respTag(r)}</td>
                                <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#15803d" }}>{r.response_phone || (r.response === "สนใจ" ? "-" : "")}</td>
                                <td style={{ ...td, fontSize: 12, whiteSpace: "normal", maxWidth: 240 }}>{r.response_note || ""}</td>
                                <td style={{ ...td, fontSize: 12, whiteSpace: "nowrap" }}>{r.responded_at ? thaiDateTime(r.responded_at) : ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
