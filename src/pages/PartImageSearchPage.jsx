import React, { useEffect, useRef, useState } from "react";

// ค้นหาอะไหล่จากรูป (เฉพาะกลุ่มหมวกกันน็อก PG-033)
// ถ่ายรูปด้วยกล้องสด (ไม่บันทึกลงเครื่อง) หรือเลือกไฟล์ → ส่งให้ AI เทียบกับรูปใน DB → บอกรหัส/ชื่ออะไหล่ที่ตรง
const SEARCH_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-image-search-api";
const FM_API = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-api";

export default function PartImageSearchPage() {
  const [queryImg, setQueryImg] = useState(null); // dataUrl รูปที่จะค้น
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);     // { matches, best_id, reason } | { error }
  const [dbImages, setDbImages] = useState({});   // part id → dataUrl (รูปใน DB ของผลลัพธ์)

  // ---- กล้องสด: ถ่ายเข้าระบบตรง ไม่มีไฟล์ลงเครื่อง (ท่าเดียวกับหน้าประเมินความเสียหาย) ----
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [camOn, setCamOn] = useState(false);
  const [message, setMessage] = useState("");

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setCamOn(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); } }, 50);
    } catch (e) {
      setMessage("❌ เปิดกล้องไม่สำเร็จ: " + String(e?.message || e).slice(0, 100) + " (ต้องเปิดผ่าน https และอนุญาตสิทธิ์กล้อง)");
    }
  }
  function closeCamera() {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCamOn(false);
  }
  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const maxW = 900;
    const scale = Math.min(1, maxW / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const du = canvas.toDataURL("image/jpeg", 0.85);
    closeCamera();
    setQueryImg(du);
    setResult(null);
  }
  useEffect(() => () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); }, []);

  function pickFile(f) {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        setQueryImg(canvas.toDataURL("image/jpeg", 0.85));
        setResult(null);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  }

  async function doSearch() {
    if (!queryImg) { setMessage("ถ่ายรูปหรือเลือกรูปก่อนครับ"); return; }
    setSearching(true); setMessage(""); setResult(null); setDbImages({});
    try {
      const res = await fetch(SEARCH_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "search_by_image", image_base64: queryImg }) });
      const data = await res.json();
      setResult(data && typeof data === "object" ? data : { error: "ไม่ได้รับคำตอบ" });
      // โหลดรูปใน DB ของผลลัพธ์ 3 อันดับแรกมาโชว์เทียบ
      const top = (data?.matches || []).slice(0, 3);
      for (const m of top) {
        try {
          const r2 = await fetch(FM_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_part_image", id: m.id }) });
          const d2 = await r2.json();
          const row = Array.isArray(d2) ? d2[0] : d2;
          if (row?.image_data) setDbImages(prev => ({ ...prev, [m.id]: row.image_data }));
        } catch { /* ข้ามรูปที่โหลดไม่ได้ */ }
      }
    } catch (e) {
      setResult({ error: "ค้นหาไม่สำเร็จ: " + (e?.message || e) });
    }
    setSearching(false);
  }

  const confColor = (c) => c >= 75 ? "#065f46" : c >= 50 ? "#b45309" : "#6b7280";

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🔍 ค้นหาอะไหล่จากรูป <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280" }}>(กลุ่มหมวกกันน็อก)</span></h2>
      </div>

      <div style={{ marginBottom: 12, padding: "8px 12px", background: "#eff6ff", borderRadius: 8, fontSize: 13, color: "#1e40af", borderLeft: "3px solid #1e40af" }}>
        ถ่ายรูปหมวกกันน็อกหน้างาน (รูปไม่ถูกบันทึกลงเครื่อง) → AI เทียบกับรูปในระบบ → บอกรหัส/ชื่ออะไหล่ที่ตรงที่สุด
      </div>

      {message && <div style={{ marginBottom: 10, padding: "8px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontSize: 13 }}>{message}</div>}

      {/* พื้นที่ภาพ: กล้องสด / รูปที่ถ่ายไว้ */}
      <div style={{ marginBottom: 12, minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", borderRadius: 10, border: "1px dashed #d1d5db", padding: 8, maxWidth: 640 }}>
        {camOn ? (
          <video ref={videoRef} autoPlay playsInline muted style={{ maxWidth: "100%", maxHeight: 380, borderRadius: 8, background: "#000" }} />
        ) : queryImg ? (
          <img src={queryImg} alt="รูปที่จะค้นหา" style={{ maxWidth: "100%", maxHeight: 380, borderRadius: 8 }} />
        ) : (
          <span style={{ color: "#9ca3af", fontSize: 13 }}>ยังไม่มีรูป — กดเปิดกล้อง หรือเลือกไฟล์</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 20, maxWidth: 640 }}>
        {camOn ? (
          <>
            <button onClick={capturePhoto} style={{ flex: 1, padding: "10px", fontSize: 14, background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>📸 ถ่ายรูป</button>
            <button onClick={closeCamera} style={{ padding: "10px 16px", fontSize: 14, background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>✕ ปิดกล้อง</button>
          </>
        ) : (
          <>
            <button onClick={openCamera} style={{ flex: 1, padding: "10px", fontSize: 14, background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>📷 เปิดกล้องถ่าย</button>
            <label style={{ padding: "10px 16px", fontSize: 14, background: "#e5e7eb", color: "#374151", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
              🖼️ เลือกไฟล์
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; pickFile(f); }} />
            </label>
            <button onClick={doSearch} disabled={!queryImg || searching}
              style={{ flex: 1, padding: "10px", fontSize: 14, background: !queryImg || searching ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: !queryImg || searching ? "not-allowed" : "pointer", fontWeight: 700 }}>
              {searching ? "🤖 AI กำลังเทียบรูป..." : "🔍 ค้นหา"}
            </button>
          </>
        )}
      </div>

      {/* ผลลัพธ์ */}
      {result && (
        result.error ? (
          <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#b91c1c", borderRadius: 10, maxWidth: 640 }}>❌ {result.error}</div>
        ) : (result.matches || []).length === 0 ? (
          <div style={{ padding: "12px 16px", background: "#fffbeb", color: "#92400e", borderRadius: 10, maxWidth: 640 }}>
            ไม่พบหมวกกันน็อกในระบบที่ตรงกับรูปนี้ {result.reason ? `— ${result.reason}` : ""}
          </div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 16, color: "#072d6b" }}>ผลการเทียบ ({result.matches.length} รายการ)</h3>
            {result.reason && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>💬 {result.reason}</div>}
            {result.matches.map((m, i) => (
              <div key={m.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, marginBottom: 10, background: i === 0 ? "#ecfdf5" : "#fff", border: i === 0 ? "2px solid #10b981" : "1px solid #e5e7eb", borderRadius: 10 }}>
                <div style={{ width: 90, height: 90, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", borderRadius: 8, overflow: "hidden" }}>
                  {dbImages[m.id] ? <img src={dbImages[m.id]} alt={m.part_code} style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <span style={{ fontSize: 11, color: "#9ca3af" }}>รูป DB</span>}
                </div>
                <div style={{ flex: 1 }}>
                  {i === 0 && <div style={{ fontSize: 11, color: "#065f46", fontWeight: 700, marginBottom: 2 }}>⭐ ตรงที่สุด</div>}
                  <div style={{ fontWeight: 700, color: "#072d6b", fontSize: 15 }}>{m.part_code}</div>
                  <div style={{ fontSize: 13, color: "#374151" }}>{m.part_name} <span style={{ color: "#9ca3af" }}>({m.brand})</span></div>
                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: confColor(m.confidence) }}>ความมั่นใจ {m.confidence}%</div>
                </div>
                <button onClick={() => { navigator.clipboard?.writeText(m.part_code); setMessage("คัดลอกรหัส " + m.part_code + " แล้ว"); }}
                  style={{ padding: "6px 12px", fontSize: 12, background: "#e5e7eb", border: "none", borderRadius: 6, cursor: "pointer" }}>คัดลอกรหัส</button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
