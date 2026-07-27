import React, { useEffect, useRef, useState } from "react";
import catalog from "../data/parts_catalog";
import BIKE_HOTSPOTS from "../data/bike_hotspots";

// ประเมินความเสียหายจากรูปด้วย AI (GPT-4o Vision ผ่าน n8n damage-assess-api)
// flow: เลือกรถ (จากสมุดภาพชุดสี หรือกรอกเอง) → อัปโหลดรูปความเสียหาย → AI ประเมิน → เลือกชิ้น + ราคา → พิมพ์สรุป
const ASSESS_API = "https://n8n-new-project-gwf2.onrender.com/webhook/damage-assess-api";
const PRICE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-price-api";
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api"; // ค้นรถด้วยเลขเครื่อง/เลขตัวถัง

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return null; }
}

// ย่อรูปก่อนส่ง (ประหยัดค่า vision + เร็ว): กว้างสุด 1400px JPEG 0.8 (คงรายละเอียดพอให้ AI เห็นชิ้นเล็ก)
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read fail"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode fail"));
      img.onload = () => {
        const maxW = 1400;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const fmtMoney = (v) => (v == null || isNaN(Number(v)) ? null : Number(v).toLocaleString("th-TH", { minimumFractionDigits: 2 }));

export default function DamageAssessPage({ currentUser } = {}) {
  // ---- ขั้น 1: ระบุรถ ----
  const [modelIdx, setModelIdx] = useState(-1);       // index ใน catalog (-1 = กรอกเอง)
  const [colorPage, setColorPage] = useState("");
  const [manualBrand, setManualBrand] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [vehicleRef, setVehicleRef] = useState("");   // เลขเครื่อง/ตัวถัง/ทะเบียน (ไม่บังคับ)

  const book = modelIdx >= 0 ? catalog[modelIdx] : null;
  const colorList = book ? book.colors : [];
  const curColor = colorList.find((c) => String(c.page) === colorPage) || null;

  // ---- ค้นรถจากเลขเครื่อง/เลขตัวถัง (retail-sale-api get_vehicle) → เด้งรุ่น/สีให้อัตโนมัติ ----
  const [vehSearch, setVehSearch] = useState("");
  const [vehLoading, setVehLoading] = useState(false);
  const [vehMsg, setVehMsg] = useState("");

  async function searchVehicle() {
    const kw = vehSearch.trim().toUpperCase().replace(/\s+/g, "");
    if (!kw) { setVehMsg("พิมพ์เลขเครื่องหรือเลขตัวถังก่อน"); return; }
    setVehLoading(true);
    setVehMsg("🔎 กำลังค้นหารถในระบบ…");
    try {
      const data = await post(RETAIL_API, { action: "get_vehicle", keyword: kw });
      const v = Array.isArray(data) ? data[0] : data;
      if (!v || (!v.engine_no && !v.chassis_no)) { setVehMsg(`❌ ไม่พบรถที่ตรงกับ "${kw}" ในระบบ`); return; }
      setVehicleRef(v.engine_no || v.chassis_no || kw);
      // จับคู่ "รุ่น" — HONDA: model_code เช่น ACF125CAT ขึ้นต้นด้วย series ACF125 · YAMAHA: model_code/ชื่อรุ่น = NMAX เทียบ series N-MAX (ตัดอักขระพิเศษก่อน)
      const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const codePart = norm(v.model_code || v.model_name);
      let bi = -1, bestLen = 0;
      catalog.forEach((b, i) => {
        for (const ser of [norm(b.series), norm(b.model)]) {
          if (ser && (codePart.startsWith(ser) || ser.startsWith(codePart) && codePart.length >= 4) && ser.length > bestLen) { bi = i; bestLen = ser.length; }
        }
      });
      const vehLabel = [v.model_code || v.model_name, v.model_type, v.color_name || v.model_color].filter(Boolean).join(" · ");
      if (bi < 0) {
        // ไม่มีสมุดภาพรุ่นนี้ → เด้งเข้าโหมดกรอกเอง
        setModelIdx(-1);
        setColorPage("");
        setManualBrand(/yamaha/i.test(v.brand || "") ? "YAMAHA" : "HONDA");
        setManualModel([v.model_code || v.model_name, v.model_type].filter(Boolean).join(" "));
        setVehMsg(`⚠️ พบรถ ${vehLabel} — ยังไม่มีสมุดภาพรุ่นนี้ ใช้โหมดกรอกเอง (AI ตอบเป็นชื่อชิ้น)`);
        return;
      }
      setModelIdx(bi);
      // จับคู่ "สี": จำกัดด้วย type/แบบ ก่อน แล้วเทียบรหัสสี (HONDA: GBR = code) → color_code → ชื่อสีไทย (YAMAHA เลขสีคนละระบบกับสมุดภาพ)
      const cols = catalog[bi].colors || [];
      const mtype = norm(v.model_type);
      const mcolor = String(v.model_color || "").toUpperCase().trim();
      const cname = String(v.color_name || "").trim();
      let pool = cols;
      if (mtype) {
        const p = pool.filter((c) => { const t = norm(c.type); return t && (t === mtype || mtype.startsWith(t) || t.startsWith(mtype)); });
        if (p.length) pool = p;
      }
      {
        const p = pool.filter((c) => norm(c.model_code) === codePart);
        if (p.length) pool = p;
      }
      // เทียบชื่อสีแบบเซ็ตส่วนประกอบ: "เทา/น้ำเงิน" ≠ "น้ำเงิน" แต่ "ดำ-เทา" = "ดำ/เทา"
      const colorSet = (s) => String(s || "").split(/[\/\-\s]+/).filter(Boolean).sort().join("|");
      const hit =
        (mcolor && pool.find((c) => String(c.code || "").toUpperCase() === mcolor)) ||
        (mcolor && pool.find((c) => String(c.color_code || "").toUpperCase() === mcolor)) ||
        (cname && pool.find((c) => String(c.name || "").trim() === cname)) ||
        (cname && pool.find((c) => c.name && colorSet(c.name) === colorSet(cname))) ||
        null;
      setColorPage(hit ? String(hit.page) : "");
      setVehMsg(hit
        ? `✅ พบ: ${catalog[bi].model} · ${hit.type || "-"} · สี${hit.name} (${hit.code})`
        : `✅ พบ: ${catalog[bi].model} (${vehLabel}) — เลือกแบบ/สีเองต่อ`);
    } catch (e) {
      setVehMsg("❌ ค้นหาไม่สำเร็จ: " + (e?.message || e));
    } finally { setVehLoading(false); }
  }

  // ---- ขั้น 2: รูป ----
  const [images, setImages] = useState([]); // dataURL[]
  const [imgBusy, setImgBusy] = useState(false);

  async function addFiles(files) {
    setImgBusy(true);
    for (const f of files) {
      try {
        const du = await shrinkImage(f);
        setImages((prev) => (prev.length >= 6 ? prev : [...prev, du]));
      } catch { /* ข้ามไฟล์ที่อ่านไม่ได้ */ }
    }
    setImgBusy(false);
  }

  // ---- กล้องสด: ถ่ายเข้าระบบตรง ไม่มีไฟล์ลงเครื่อง (แบบเดียวกับหน้าจดหมายเข้า) ----
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [capturing, setCapturing] = useState(false);

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }, audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); } }, 50);
    } catch (e) {
      setMessage("❌ เปิดกล้องไม่สำเร็จ: " + String(e?.message || e).slice(0, 120) + " (ต้องเปิดผ่าน https และอนุญาตสิทธิ์กล้อง)");
    }
  }

  function closeCamera() {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraOn(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setCapturing(true);
    try {
      const maxW = 1400;
      const scale = Math.min(1, maxW / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      const du = canvas.toDataURL("image/jpeg", 0.8);
      setImages((prev) => (prev.length >= 6 ? prev : [...prev, du]));
    } finally {
      setCapturing(false);
    }
  }

  // ปิดกล้องเมื่อออกจากหน้า
  useEffect(() => () => { if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()); }, []);

  // ---- ขั้น 3: ประเมิน ----
  const [assessing, setAssessing] = useState(false);
  const [result, setResult] = useState(null);   // ผลจาก AI
  const [message, setMessage] = useState("");
  const [priceMap, setPriceMap] = useState({}); // code → {name, price}
  const [checked, setChecked] = useState({});   // code|name → true (ชิ้นที่ติ๊กเลือก)

  async function runAssess() {
    if (!images.length) { setMessage("⚠️ เพิ่มรูปความเสียหายอย่างน้อย 1 รูปก่อน"); return; }
    setAssessing(true);
    setMessage("");
    setResult(null);
    setReviewImages([]); // ประเมินใหม่ — รูปปัจจุบันโชว์อยู่ในขั้น ② แล้ว
    try {
      // รายการรหัสของรุ่น/สีที่เลือก + ชื่อจากระบบราคา (ให้ AI เลือกได้แม่น)
      let parts = [];
      if (book && curColor) {
        const codes = (book.pages?.[String(curColor.page)] || []).map((p) => p.code);
        const priceRows = codes.length ? await post(PRICE_API, { action: "get_price", codes }) : [];
        const rows = Array.isArray(priceRows) ? priceRows : priceRows?.data || [];
        const nameOf = {};
        rows.forEach((r) => { if (r?.part_code) nameOf[r.part_code] = r.name || ""; });
        // ชื่อจากแผงกดตัวรถ (มีชื่อไทย + ระบุซ้าย/ขวาครบ) — ให้ priority สูงกว่าชื่อจากระบบราคา
        const hs = BIKE_HOTSPOTS[`${book.model}|${curColor.page}`];
        const hsName = {};
        if (hs) for (const h of hs.hotspots) for (const it of h.items)
          hsName[it.code] = (it.name || h.label) + (it.side ? ` ข้าง${it.side}` : "");
        parts = codes.map((c) => ({ code: c, name: hsName[c] || nameOf[c] || "" }));
        setPriceMap((prev) => {
          const nx = { ...prev };
          rows.forEach((r) => { if (r?.part_code) nx[r.part_code] = { name: r.name || "", price: r.price ?? null }; });
          return nx;
        });
      }
      const vehicle = book && curColor
        ? { brand: book.brand || (/yamaha|nmax|aerox|fazzio|filano|xmax|finn/i.test(`${book.file || ""} ${book.model}`) ? "YAMAHA" : "HONDA"), model: book.model, type: curColor.type || "", color: `${curColor.name} (${curColor.code})`, ref: vehicleRef }
        : { brand: manualBrand, model: manualModel, type: "", color: "", ref: vehicleRef };
      const res = await post(ASSESS_API, {
        action: "assess", vehicle, parts, images,
        created_by: (currentUser && (currentUser.name || currentUser.username)) || "",
      });
      if (!res || res.error) { setMessage("❌ ประเมินไม่สำเร็จ: " + (res?.error || "ไม่ได้รับคำตอบ (workflow ยังไม่ active?)")); setAssessing(false); return; }
      setResult(res);
      // ติ๊กชิ้นมั่นใจสูงให้อัตโนมัติ
      const chk = {};
      (res.damaged || []).forEach((d) => { if (d.confidence === "สูง") chk[d.code || d.name] = true; });
      setChecked(chk);
      // เติมราคาชิ้นที่ AI ตอบแต่ยังไม่มีในแคช
      const need = (res.damaged || []).map((d) => d.code).filter((c) => c && !priceMap[c]);
      if (need.length) {
        const pr = await post(PRICE_API, { action: "get_price", codes: need });
        const rows = Array.isArray(pr) ? pr : pr?.data || [];
        setPriceMap((prev) => {
          const nx = { ...prev };
          rows.forEach((r) => { if (r?.part_code) nx[r.part_code] = { name: r.name || "", price: r.price ?? null }; });
          return nx;
        });
      }
    } catch (e) {
      setMessage("❌ เกิดข้อผิดพลาด: " + (e?.message || e));
    }
    setAssessing(false);
  }

  // ---- ประวัติ ----
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  async function loadHistory() {
    const r = await post(ASSESS_API, { action: "list_assessments" });
    setHistory(Array.isArray(r) ? r.filter((x) => x && x.id) : []);
    setShowHistory(true);
  }

  const [reviewImages, setReviewImages] = useState([]); // รูปที่ user ส่งประเมิน (ดึงจาก DB ตอนเปิดดูย้อนหลัง)
  const [bigImg, setBigImg] = useState(null);           // รูปที่กดขยายเต็มจอ

  // เปิดผลประเมินเก่ากลับมาแสดงในหน้าหลัก (พร้อมดึงราคาชิ้นที่พบ + รูปที่ user ส่ง)
  function viewHistory(h) {
    setReviewImages([]);
    post(ASSESS_API, { action: "get_assessment_images", id: h.id }).then((r) => {
      const rows = (Array.isArray(r) ? r : r && r.image_data ? [r] : [])
        .filter((x) => x && String(x.image_data || "").startsWith("data:image"));
      setReviewImages(rows.map((x) => x.image_data));
    }).catch(() => {});
    const r = typeof h.result === "string" ? (() => { try { return JSON.parse(h.result); } catch { return {}; } })() : (h.result || {});
    setResult(r);
    const chk = {};
    (r.damaged || []).forEach((d) => { if (d.confidence === "สูง") chk[d.code || d.name] = true; });
    setChecked(chk);
    // ตั้งบริบทรถจากประวัติ ให้หัวสรุป/ใบพิมพ์ถูกต้อง
    setModelIdx(-1);
    setColorPage("");
    setManualBrand(h.brand || "");
    setManualModel([h.model, h.type_code, h.color].filter(Boolean).join(" "));
    setVehicleRef(h.vehicle_ref || "");
    setMessage("");
    setShowHistory(false);
    const need = (r.damaged || []).map((d) => d.code).filter((c) => c && !priceMap[c]);
    if (need.length) {
      post(PRICE_API, { action: "get_price", codes: need }).then((pr) => {
        const rows = Array.isArray(pr) ? pr : pr?.data || [];
        setPriceMap((prev) => {
          const nx = { ...prev };
          rows.forEach((rr) => { if (rr?.part_code) nx[rr.part_code] = { name: rr.name || "", price: rr.price ?? null }; });
          return nx;
        });
      });
    }
  }

  // ดาวน์โหลดรูป (dataURL) ลงเครื่อง — แปลงเป็น Blob ก่อน (data URL ใหญ่ ๆ โหลดตรง ๆ แล้ว Chrome ค้างเป็น .crdownload)
  function downloadDataUrl(du, name) {
    try {
      const comma = du.indexOf(",");
      const mime = (du.slice(0, comma).match(/data:([^;]+)/) || [])[1] || "image/jpeg";
      const bin = atob(du.slice(comma + 1));
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { /* ข้ามรูปที่อ่านไม่ได้ */ }
  }

  const [dlId, setDlId] = useState(null);
  async function downloadHistoryImages(h) {
    setDlId(h.id);
    try {
      const r = await post(ASSESS_API, { action: "get_assessment_images", id: h.id });
      const rows = (Array.isArray(r) ? r : []).filter((x) => x && typeof x.image_data === "string" && x.image_data.startsWith("data:image"));
      if (!rows.length) { window.alert("รายการนี้ไม่มีรูปเก็บไว้ (ประเมินก่อนเปิดระบบเก็บรูป)"); return; }
      // เว้นจังหวะทีละรูป กัน Chrome บล็อกการโหลดหลายไฟล์พร้อมกัน
      rows.forEach((x, i) => setTimeout(() => downloadDataUrl(x.image_data, `damage_${h.id}_${(x.img_index ?? i) + 1}.jpg`), i * 400));
    } finally { setDlId(null); }
  }

  const [deletingId, setDeletingId] = useState(null);
  async function deleteHistory(h) {
    const label = [h.model, h.color].filter(Boolean).join(" ") || `#${h.id}`;
    if (!window.confirm(`ลบผลประเมิน ${label} วันที่ ${String(h.created_at || "").slice(0, 10)} ออกจากระบบ?\n(รูปที่เก็บไว้จะถูกลบด้วย)`)) return;
    setDeletingId(h.id);
    try {
      const r = await post(ASSESS_API, { action: "delete_assessment", id: h.id });
      if (Array.isArray(r)) setHistory(r.filter((x) => x && x.id));
      else setHistory((prev) => prev.filter((x) => x.id !== h.id));
    } finally { setDeletingId(null); }
  }

  const damagedRows = result?.damaged || [];
  const toCheckRows = result?.to_check || [];
  const pickedTotal = damagedRows
    .filter((d) => checked[d.code || d.name])
    .reduce((s, d) => s + (Number(priceMap[d.code]?.price) || 0), 0);

  function printSummary() {
    const rows = damagedRows.filter((d) => checked[d.code || d.name]);
    if (!rows.length) { setMessage("⚠️ ติ๊กเลือกชิ้นที่จะใส่ในสรุปก่อน"); return; }
    const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const veh = book && curColor ? `${book.model} · ${curColor.type || "-"} · สี${curColor.name}` : `${manualBrand} ${manualModel}`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>สรุปประเมินความเสียหาย</title>
<style>body{font-family:Tahoma,Sarabun,sans-serif;font-size:13px;padding:18px} h2{font-size:17px;margin:0 0 2px}
.sub{color:#555;margin-bottom:12px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #bbb;padding:5px 8px;text-align:left}
th{background:#0b2f6b;color:#fff} td.r{text-align:right} .note{margin-top:10px;color:#555;font-size:12px}</style></head><body>
<h2>สรุปประเมินความเสียหายเบื้องต้น (AI)</h2>
<div class="sub">รถ: ${esc(veh)}${vehicleRef ? " · อ้างอิง: " + esc(vehicleRef) : ""} · วันที่ ${new Date().toLocaleString("th-TH")}</div>
<table><thead><tr><th>#</th><th>รหัส</th><th>รายการ</th><th>เหตุผลที่ประเมิน</th><th style="text-align:right">ราคา</th></tr></thead><tbody>
${rows.map((d, i) => `<tr><td>${i + 1}</td><td>${esc(d.code || "-")}</td><td>${esc(priceMap[d.code]?.name || d.name)}</td><td>${esc(d.reason || "")}</td><td class="r">${fmtMoney(priceMap[d.code]?.price) || "-"}</td></tr>`).join("")}
<tr><td colspan="4" style="text-align:right;font-weight:700">รวม (เฉพาะรายการที่มีราคา)</td><td class="r" style="font-weight:700">${fmtMoney(pickedTotal) || "-"}</td></tr>
</tbody></table>
<div class="note">⚠️ เป็นการประเมินเบื้องต้นจากรูปถ่ายด้วย AI — รายการ/ราคาจริงยืนยันโดยช่างหลังตรวจสภาพรถ · ยังไม่รวมค่าแรงและชิ้นส่วนภายในที่มองไม่เห็นจากรูป</div>
<script>window.onload=function(){window.print();}<\/script></body></html>`);
    w.document.close();
  }

  const box = { border: "1px solid #dbe3ef", borderRadius: 12, padding: 14, marginBottom: 14, background: "#fff" };
  const inp = { padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8 };
  const btn = { padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 8, cursor: "pointer" };
  const confColor = { "สูง": { bg: "#dcfce7", fg: "#15803d" }, "กลาง": { bg: "#fef3c8", fg: "#b45309" } };

  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 className="page-title">🤖 ประเมินความเสียหาย (AI)</h2>
        <button onClick={loadHistory} style={{ ...btn, background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" }}>📋 ประวัติการประเมิน</button>
      </div>

      {/* ขั้น 1: ระบุรถ */}
      <div style={box}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0b2f6b", marginBottom: 8 }}>① ระบุรถ</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <input value={vehSearch} onChange={(e) => setVehSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") searchVehicle(); }}
            placeholder="🔎 เลขเครื่อง / เลขตัวถัง เช่น JK16E-2477581" style={{ ...inp, width: 280 }} />
          <button onClick={searchVehicle} disabled={vehLoading}
            style={{ ...btn, background: vehLoading ? "#9ca3af" : "#0369a1", color: "#fff" }}>
            {vehLoading ? "⏳ กำลังค้น…" : "ค้นหารถ"}
          </button>
          {vehMsg && (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: vehMsg.startsWith("✅") ? "#15803d" : vehMsg.startsWith("❌") ? "#b91c1c" : "#b45309" }}>
              {vehMsg}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={modelIdx} onChange={(e) => { setModelIdx(Number(e.target.value)); setColorPage(""); }} style={{ ...inp, minWidth: 180 }}>
            <option value={-1}>-- รุ่นอื่น (กรอกเอง) --</option>
            {catalog.map((b, i) => <option key={i} value={i}>{b.model}</option>)}
          </select>
          {book ? (
            <select value={colorPage} onChange={(e) => setColorPage(e.target.value)} style={{ ...inp, minWidth: 250 }}>
              <option value="">-- เลือก แบบ/สี --</option>
              {colorList.map((c) => <option key={c.page} value={String(c.page)}>{c.type || "-"} · สี{c.name} ({c.code})</option>)}
            </select>
          ) : (
            <>
              <select value={manualBrand} onChange={(e) => setManualBrand(e.target.value)} style={inp}>
                <option value="">-- ยี่ห้อ --</option>
                <option value="HONDA">HONDA</option>
                <option value="YAMAHA">YAMAHA</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
              <input value={manualModel} onChange={(e) => setManualModel(e.target.value)} placeholder="รุ่น เช่น Wave110i ปี 2019" style={{ ...inp, width: 220 }} />
            </>
          )}
          <input value={vehicleRef} onChange={(e) => setVehicleRef(e.target.value)} placeholder="เลขเครื่อง/ตัวถัง/ทะเบียน (ไม่บังคับ)" style={{ ...inp, width: 240 }} />
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
          💡 เลือกจากรายการ = AI ตอบเป็น<b>รหัสอะไหล่จริงของรุ่น/สีนั้น</b> · กรอกเอง = AI ตอบเป็นชื่อชิ้น (ไม่มีรหัส)
        </div>
      </div>

      {/* ขั้น 2: รูป */}
      <div style={box}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0b2f6b", marginBottom: 8 }}>② รูปความเสียหาย (สูงสุด 6 รูป)</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ ...btn, background: "#0369a1", color: "#fff", display: "inline-block" }}>
            🖼️ เลือกรูปจากเครื่อง
            <input type="file" accept="image/*" multiple style={{ display: "none" }}
              onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) addFiles(fs); }} />
          </label>
          {!cameraOn ? (
            <button onClick={openCamera} style={{ ...btn, background: "#0e7490", color: "#fff" }}>
              📷 ถ่ายด้วยกล้อง (ไม่เก็บไฟล์)
            </button>
          ) : (
            <button onClick={closeCamera} style={{ ...btn, background: "#6b7280", color: "#fff" }}>
              ✕ ปิดกล้อง
            </button>
          )}
          {imgBusy && <span style={{ fontSize: 13, color: "#64748b" }}>กำลังอ่านรูป…</span>}
          <span style={{ fontSize: 12, color: "#64748b" }}>แนะนำ: ถ่ายจุดเสียหายใกล้ ๆ 2-3 มุม + รูปเต็มคัน 1 รูป</span>
        </div>
        {cameraOn && (
          <div style={{ marginTop: 12 }}>
            <video ref={videoRef} playsInline muted style={{ width: "100%", maxWidth: 420, borderRadius: 10, background: "#000", display: "block" }} />
            <button onClick={capturePhoto} disabled={capturing || images.length >= 6}
              style={{ ...btn, marginTop: 8, padding: "10px 22px", background: capturing || images.length >= 6 ? "#9ca3af" : "#16a34a", color: "#fff", fontSize: 15 }}>
              {images.length >= 6 ? "ครบ 6 รูปแล้ว" : capturing ? "กำลังจับภาพ..." : `📸 ถ่ายรูปที่ ${images.length + 1}`}
            </button>
            <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>ถ่ายต่อเนื่องได้จนครบ 6 รูป — รูปไม่ถูกบันทึกลงเครื่อง</div>
          </div>
        )}
        {images.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {images.map((du, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={du} alt={`รูป ${i + 1}`} onClick={() => setBigImg(du)}
                  style={{ width: 110, height: 82, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "zoom-in" }} />
                <button onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 11, lineHeight: "20px", padding: 0 }}>×</button>
                <button onClick={() => downloadDataUrl(du, `damage_${new Date().toISOString().slice(0, 10)}_${i + 1}.jpg`)} title="บันทึกรูปนี้ลงเครื่อง"
                  style={{ position: "absolute", bottom: 4, right: 4, width: 22, height: 22, borderRadius: 6, border: "none", background: "rgba(3,105,161,0.85)", color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: "22px", padding: 0 }}>⬇</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ขั้น 3: ประเมิน */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={runAssess} disabled={assessing || imgBusy}
          style={{ ...btn, background: assessing ? "#9ca3af" : "#0b2f6b", color: "#fff", padding: "10px 26px", fontSize: 14 }}>
          {assessing ? "⏳ AI กำลังประเมิน… (10-30 วิ)" : "🤖 ประเมินความเสียหาย"}
        </button>
        {message && <span style={{ fontSize: 13, color: "#b91c1c" }}>{message}</span>}
      </div>

      {/* ผลประเมิน */}
      {result && (
        <div style={box}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0b2f6b", marginBottom: 4 }}>③ ผลประเมินเบื้องต้น</div>
          {reviewImages.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>📷 รูปที่ส่งประเมิน (กดเพื่อขยาย):</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {reviewImages.map((du, i) => (
                  <img key={i} src={du} alt={`รูปประเมิน ${i + 1}`} onClick={() => setBigImg(du)}
                    style={{ width: 110, height: 82, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "zoom-in" }} />
                ))}
              </div>
            </div>
          )}
          {result.vehicle_check && <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 4 }}>🔎 {result.vehicle_check}</div>}
          {result.inspection && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>🧾 ผลไล่ตรวจ: {result.inspection}</div>}

          {damagedRows.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: 13.5, padding: "8px 0" }}>ไม่พบชิ้นที่ต้องเปลี่ยนชัดเจนจากรูปที่ให้มา</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#0b2f6b", color: "#fff" }}>
                    <th style={{ padding: "7px 8px" }}></th>
                    <th style={{ padding: "7px 8px", textAlign: "left" }}>รหัส</th>
                    <th style={{ padding: "7px 8px", textAlign: "left" }}>รายการ</th>
                    <th style={{ padding: "7px 8px", textAlign: "left" }}>ความมั่นใจ</th>
                    <th style={{ padding: "7px 8px", textAlign: "left" }}>ที่เห็นจากรูป</th>
                    <th style={{ padding: "7px 8px", textAlign: "right" }}>ราคา</th>
                  </tr>
                </thead>
                <tbody>
                  {damagedRows.map((d, i) => {
                    const key = d.code || d.name;
                    const cc = confColor[d.confidence] || { bg: "#f1f5f9", fg: "#475569" };
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", background: checked[key] ? "#f0fdf4" : "#fff" }}>
                        <td style={{ padding: 6, textAlign: "center" }}>
                          <input type="checkbox" checked={!!checked[key]} onChange={() => setChecked((p) => ({ ...p, [key]: !p[key] }))} />
                        </td>
                        <td style={{ padding: 6, fontFamily: "monospace", fontSize: 12.5 }}>{d.code || "-"}</td>
                        <td style={{ padding: 6 }}>{priceMap[d.code]?.name || d.name}</td>
                        <td style={{ padding: 6 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, background: cc.bg, color: cc.fg, borderRadius: 5, padding: "1px 8px" }}>{d.confidence || "-"}</span>
                        </td>
                        <td style={{ padding: 6, fontSize: 12.5, color: "#475569" }}>{d.reason}</td>
                        <td style={{ padding: 6, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(priceMap[d.code]?.price) || "—"}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={5} style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700 }}>รวมที่ติ๊กเลือก (เฉพาะที่มีราคา)</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700 }}>{fmtMoney(pickedTotal) || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {toCheckRows.length > 0 && (
            <div style={{ marginTop: 10, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}>
              <b>⚠️ ต้องให้ช่างตรวจเพิ่ม:</b>
              <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                {toCheckRows.map((t, i) => <li key={i}>{t.name}{t.code ? ` (${t.code})` : ""} — {t.reason}</li>)}
              </ul>
            </div>
          )}
          {result.missing_views && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: "#0369a1" }}>📸 แนะนำถ่ายเพิ่ม: {result.missing_views}</div>
          )}
          {result.notes && <div style={{ marginTop: 6, fontSize: 12.5, color: "#64748b" }}>หมายเหตุ: {result.notes}</div>}

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button onClick={printSummary} style={{ ...btn, background: "#0369a1", color: "#fff" }}>🖨️ พิมพ์สรุปประเมิน</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: "#94a3b8" }}>
            ⚠️ ผล AI เป็นการประเมินเบื้องต้นจากรูปเท่านั้น — รายการจริงยืนยันโดยช่างหลังตรวจรถ
          </div>
        </div>
      )}

      {/* รูปขยายเต็มจอ */}
      {bigImg && (
        <div onClick={() => setBigImg(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, cursor: "zoom-out" }}>
          <img src={bigImg} alt="รูปขยาย" style={{ maxWidth: "95vw", maxHeight: "92vh", borderRadius: 8 }} />
          <button onClick={() => setBigImg(null)}
            style={{ position: "fixed", top: 14, right: 18, width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.9)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
      )}

      {/* ประวัติ */}
      {showHistory && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 18, width: 720, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#0b2f6b" }}>ประวัติการประเมิน (30 รายการล่าสุด)</h3>
              <button onClick={() => setShowHistory(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>
            {history.length === 0 ? <div style={{ color: "#94a3b8", padding: 16, textAlign: "center" }}>ยังไม่มีประวัติ</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr style={{ background: "#f1f5f9" }}>
                  <th style={{ padding: 6, textAlign: "left" }}>วันที่</th><th style={{ padding: 6, textAlign: "left" }}>รถ</th>
                  <th style={{ padding: 6, textAlign: "left" }}>อ้างอิง</th><th style={{ padding: 6, textAlign: "left" }}>ชิ้นที่พบ</th><th style={{ padding: 6, textAlign: "left" }}>ผู้ประเมิน</th>
                  <th style={{ padding: 6 }}></th>
                </tr></thead>
                <tbody>
                  {history.map((h) => {
                    const r = typeof h.result === "string" ? (() => { try { return JSON.parse(h.result); } catch { return {}; } })() : (h.result || {});
                    return (
                      <tr key={h.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: 6, whiteSpace: "nowrap" }}>{String(h.created_at || "").slice(0, 16).replace("T", " ")}</td>
                        <td style={{ padding: 6 }}>{[h.brand, h.model, h.type_code, h.color].filter(Boolean).join(" ")}</td>
                        <td style={{ padding: 6 }}>{h.vehicle_ref || "-"}</td>
                        <td style={{ padding: 6 }}>{(r.damaged || []).map((d) => d.name).slice(0, 4).join(", ") || "-"}</td>
                        <td style={{ padding: 6 }}>{h.created_by || "-"}</td>
                        <td style={{ padding: 6, whiteSpace: "nowrap", textAlign: "right" }}>
                          <button onClick={() => viewHistory(h)}
                            style={{ fontSize: 11.5, fontWeight: 600, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", borderRadius: 6, padding: "2px 10px", cursor: "pointer", marginRight: 4 }}>
                            👁️ ดูผล
                          </button>
                          <button onClick={() => downloadHistoryImages(h)} disabled={dlId === h.id} title="ดาวน์โหลดรูปที่เก็บไว้ลงเครื่อง"
                            style={{ fontSize: 11.5, fontWeight: 600, border: "1px solid #a5b4fc", background: dlId === h.id ? "#f3f4f6" : "#eef2ff", color: "#4338ca", borderRadius: 6, padding: "2px 10px", cursor: dlId === h.id ? "default" : "pointer", marginRight: 4 }}>
                            {dlId === h.id ? "กำลังโหลด…" : "⬇️ รูป"}
                          </button>
                          <button onClick={() => deleteHistory(h)} disabled={deletingId === h.id}
                            style={{ fontSize: 11.5, fontWeight: 600, border: "1px solid #fca5a5", background: deletingId === h.id ? "#f3f4f6" : "#fef2f2", color: "#b91c1c", borderRadius: 6, padding: "2px 10px", cursor: deletingId === h.id ? "default" : "pointer" }}>
                            {deletingId === h.id ? "กำลังลบ…" : "🗑️ ลบ"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
