import React, { useEffect, useState } from "react";

// บันทึกจดหมายเข้า — เลือกหลายรูป → OCR อ่านชื่อผู้ส่ง/ผู้รับอัตโนมัติ → แก้ไข → บันทึกลง DB
// backend: n8n mail-inbox-api (get_mails/save_mail/update_mail/delete_mail/get_mail_image)
//          n8n ocr-mail-image (Mistral OCR + OpenAI extract)
const MAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/mail-inbox-api";
const OCR_API = "https://n8n-new-project-gwf2.onrender.com/webhook/ocr-mail-image";

const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ย่อรูปก่อนส่งเข้า OCR (รูปจากมือถือใหญ่มาก ทำให้ payload หนัก/OCR ช้า/ล้มเหลว)
// คืน data URL (jpeg) ขนาด max ~1600px ด้านยาว
const downscaleImage = (file, maxDim = 1600, quality = 0.82) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(String(r.result)); // fallback ใช้ต้นฉบับ
        }
      };
      img.onerror = () => resolve(String(r.result));
      img.src = String(r.result);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export default function MailInboxPage({ currentUser }) {
  const [mode, setMode] = useState("entry"); // entry | history
  const [message, setMessage] = useState("");

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 12px", color: "#072d6b", fontSize: 20 }}>📬 บันทึกจดหมายเข้า</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          ["entry", "✍️ บันทึกจดหมายเข้า"],
          ["history", "📋 ประวัติจดหมาย"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setMode(k); setMessage(""); }}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid #c7d2fe", cursor: "pointer",
              fontWeight: 600, fontSize: 14,
              background: mode === k ? "#072d6b" : "#fff", color: mode === k ? "#fff" : "#374151",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", fontSize: 13 }}>
          {message}
        </div>
      )}

      {mode === "entry"
        ? <EntryPanel currentUser={currentUser} setMessage={setMessage} />
        : <HistoryPanel setMessage={setMessage} />}
    </div>
  );
}

/* ============== ENTRY TAB ============== */
function EntryPanel({ currentUser, setMessage }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);

  const makeRow = (dataUrl, name) => ({
    _key: `m-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    preview: dataUrl,
    mime_type: "image/jpeg",
    file_name: name,
    received_date: todayStr(),
    sender: "", recipient: "", mail_type: "", tracking_no: "", note: "",
    _ocr: "pending", _ocrErr: "", _selected: true, _saved: false,
  });

  async function addAndOcr(newRows) {
    if (newRows.length === 0) return;
    setRows((rs) => [...rs, ...newRows]);
    setMessage(`เพิ่ม ${newRows.length} รูป — กำลังอ่านข้อมูลอัตโนมัติ...`);
    for (const row of newRows) await runOcr(row._key, row); // OCR ทีละรูป (กัน rate limit)
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    const newRows = [];
    for (const file of files) {
      try { newRows.push(makeRow(await downscaleImage(file), file.name)); } catch { /* skip */ }
    }
    await addAndOcr(newRows);
  }

  // ===== กล้องสด: ถ่ายแล้วเข้าระบบตรง ไม่มีไฟล์ลงเครื่อง =====
  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }, audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      // รอ render video element แล้วค่อยต่อ stream
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); } }, 50);
    } catch (e) {
      setMessage("❌ เปิดกล้องไม่สำเร็จ: " + String(e.message || e).slice(0, 120) + " (ต้องเปิดผ่าน https และอนุญาตสิทธิ์กล้อง)");
    }
  }

  function closeCamera() {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraOn(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setCapturing(true);
    try {
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      const p = (n) => String(n).padStart(2, "0");
      const now = new Date();
      const name = `cam-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.jpg`;
      await addAndOcr([makeRow(dataUrl, name)]);
    } finally {
      setCapturing(false);
    }
  }

  // ปิดกล้องเมื่อออกจากหน้า
  useEffect(() => () => { if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()); }, []);

  async function runOcr(key, rowData) {
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, _ocr: "loading" } : r)));
    const row = rowData || rowsRef.current.find((r) => r._key === key);
    if (!row) return;
    try {
      const res = await fetch(OCR_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: row.preview, mime_type: row.mime_type }),
      });
      const text = await res.text();
      if (!res.ok) {
        const hint = res.status === 404 ? "webhook ยังไม่ active ใน n8n" : `HTTP ${res.status}`;
        throw new Error(`${hint} — ${text.slice(0, 160)}`);
      }
      let data = {};
      try { data = JSON.parse(text); } catch { throw new Error(`ตอบกลับไม่ใช่ JSON: ${text.slice(0, 160)}`); }
      const r = Array.isArray(data) ? data[0] || {} : data || {};
      setRows((rs) => rs.map((x) => x._key === key ? {
        ...x,
        sender: x.sender || r.sender || "",
        recipient: x.recipient || r.recipient || "",
        mail_type: x.mail_type || r.mail_type || "",
        tracking_no: x.tracking_no || r.tracking_no || "",
        _ocr: "done", _ocrErr: "",
      } : x));
    } catch (e) {
      setRows((rs) => rs.map((x) => x._key === key ? { ...x, _ocr: "error", _ocrErr: String(e.message || e).slice(0, 200) } : x));
    }
  }

  // ref ให้ runOcr อ่านค่าล่าสุดได้
  const rowsRef = React.useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  function setField(key, field, value) {
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
  }
  function toggleSel(key) {
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, _selected: !r._selected } : r)));
  }
  function removeRow(key) {
    setRows((rs) => rs.filter((r) => r._key !== key));
  }

  async function saveSelected() {
    const toSave = rows.filter((r) => r._selected && !r._saved);
    if (toSave.length === 0) { setMessage("ไม่มีรายการที่เลือกไว้ให้บันทึก"); return; }
    setSaving(true);
    let ok = 0;
    for (const row of toSave) {
      try {
        const res = await fetch(MAIL_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_mail",
            received_date: row.received_date,
            sender: row.sender, recipient: row.recipient,
            mail_type: row.mail_type, tracking_no: row.tracking_no, note: row.note,
            created_by: currentUser?.username || currentUser?.name || "",
          }),
        });
        const d = await res.json();
        if (d && d.id) { ok++; setRows((rs) => rs.map((x) => x._key === row._key ? { ...x, _saved: true, _selected: false } : x)); }
      } catch {
        /* continue */
      }
    }
    setSaving(false);
    setMessage(`✅ บันทึกจดหมายเข้าแล้ว ${ok} / ${toSave.length} รายการ`);
  }

  const pending = rows.filter((r) => r._selected && !r._saved).length;

  return (
    <div>
      <div style={{ border: "1px dashed #93c5fd", borderRadius: 10, padding: 16, background: "#f8fafc", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
          เลือกรูปจดหมาย หรือถ่ายด้วยกล้องสด (1 รูป = 1 จดหมาย) ระบบจะอ่านชื่อผู้ส่ง/ผู้รับให้อัตโนมัติ
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "inline-block", padding: "8px 16px", background: "#072d6b", color: "#fff", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            🖼️ เลือกรูปจากเครื่อง
            <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
          </label>
          {!cameraOn ? (
            <button onClick={openCamera} style={{ padding: "8px 16px", background: "#0e7490", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              📷 ถ่ายด้วยกล้อง (ไม่เก็บไฟล์)
            </button>
          ) : (
            <button onClick={closeCamera} style={{ padding: "8px 16px", background: "#6b7280", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              ✕ ปิดกล้อง
            </button>
          )}
        </div>

        {cameraOn && (
          <div style={{ marginTop: 12 }}>
            <video ref={videoRef} playsInline muted style={{ width: "100%", maxWidth: 420, borderRadius: 10, background: "#000", display: "block" }} />
            <button onClick={capturePhoto} disabled={capturing}
              style={{ marginTop: 8, padding: "10px 22px", background: capturing ? "#9ca3af" : "#16a34a", color: "#fff", border: "none", borderRadius: 8, cursor: capturing ? "default" : "pointer", fontWeight: 700, fontSize: 15 }}>
              {capturing ? "กำลังจับภาพ..." : "📸 ถ่าย & อ่านข้อมูล"}
            </button>
            <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>ถ่ายได้หลายซองต่อเนื่อง — แต่ละครั้ง = 1 จดหมาย (รูปไม่ถูกบันทึกลงเครื่อง)</div>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: "#6b7280" }}>ทั้งหมด {rows.length} รายการ · รอบันทึก {pending}</div>
            <button onClick={saveSelected} disabled={saving || pending === 0}
              style={{ padding: "8px 18px", background: pending === 0 ? "#9ca3af" : "#16a34a", color: "#fff", border: "none", borderRadius: 8, cursor: pending === 0 ? "default" : "pointer", fontWeight: 700, fontSize: 14 }}>
              {saving ? "กำลังบันทึก..." : `💾 บันทึกที่เลือก (${pending})`}
            </button>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((r) => (
              <MailCard key={r._key} row={r} setField={setField} toggleSel={toggleSel} removeRow={removeRow} reOcr={runOcr} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MailCard({ row, setField, toggleSel, removeRow, reOcr }) {
  const ocrBadge = {
    pending: { t: "รอคิว", c: "#6b7280" },
    loading: { t: "⏳ กำลังอ่าน...", c: "#2563eb" },
    done: { t: "✅ อ่านแล้ว", c: "#16a34a" },
    error: { t: "❌ อ่านไม่สำเร็จ", c: "#dc2626" },
  }[row._ocr] || { t: "", c: "#6b7280" };

  const inp = { width: "100%", padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };
  const lbl = { fontSize: 11, color: "#6b7280", marginBottom: 2, display: "block" };

  return (
    <div style={{ display: "flex", gap: 12, border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: row._saved ? "#f0fdf4" : "#fff" }}>
      <div style={{ flexShrink: 0, width: 140 }}>
        <img src={row.preview} alt={row.file_name} onClick={() => window.open(row.preview, "_blank")}
          style={{ width: 140, height: 180, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb", cursor: "pointer" }} />
        <div style={{ textAlign: "center", marginTop: 4 }}>
          <span style={{ fontSize: 11, color: ocrBadge.c, fontWeight: 600 }}>{ocrBadge.t}</span>
        </div>
        {row._ocr === "error" && (
          <>
            <button onClick={() => reOcr(row._key)} style={{ width: "100%", marginTop: 4, padding: "3px 0", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer" }}>ลองอ่านอีกครั้ง</button>
            {row._ocrErr && <div style={{ marginTop: 4, fontSize: 10, color: "#dc2626", wordBreak: "break-word" }}>{row._ocrErr}</div>}
          </>
        )}
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignContent: "start" }}>
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={row._selected} disabled={row._saved} onChange={() => toggleSel(row._key)} />
            {row._saved ? "บันทึกแล้ว ✓" : "เลือกบันทึก"}
          </label>
          <button onClick={() => removeRow(row._key)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
        <div>
          <label style={lbl}>ผู้ส่ง</label>
          <input style={inp} value={row.sender} disabled={row._saved} onChange={(e) => setField(row._key, "sender", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>ผู้รับ</label>
          <input style={inp} value={row.recipient} disabled={row._saved} onChange={(e) => setField(row._key, "recipient", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>ประเภท/หมวดจดหมาย</label>
          <input style={inp} value={row.mail_type} disabled={row._saved} onChange={(e) => setField(row._key, "mail_type", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>เลขพัสดุ/ลงทะเบียน/EMS</label>
          <input style={inp} value={row.tracking_no} disabled={row._saved} onChange={(e) => setField(row._key, "tracking_no", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>วันที่รับเข้า</label>
          <input type="date" style={inp} value={row.received_date} disabled={row._saved} onChange={(e) => setField(row._key, "received_date", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>หมายเหตุ</label>
          <input style={inp} value={row.note} disabled={row._saved} onChange={(e) => setField(row._key, "note", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

/* ============== HISTORY TAB ============== */
function HistoryPanel({ setMessage }) {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(MAIL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_mails" }),
      });
      const data = await res.json();
      setMails(Array.isArray(data) ? data : []);
    } catch {
      setMessage("❌ โหลดประวัติไม่สำเร็จ");
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function del(mailId) {
    if (!window.confirm("ลบจดหมายรายการนี้?")) return;
    try {
      await fetch(MAIL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_mail", id: mailId }),
      });
      setMails((ms) => ms.filter((m) => m.id !== mailId));
      setMessage("ลบแล้ว");
    } catch {
      setMessage("❌ ลบไม่สำเร็จ");
    }
  }

  const th = { padding: "8px 10px", textAlign: "left", fontSize: 12, color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };

  return (
    <div>
      <button onClick={load} style={{ marginBottom: 10, padding: "6px 14px", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13 }}>
        🔄 รีเฟรช
      </button>
      {loading ? (
        <div style={{ color: "#6b7280", fontSize: 14 }}>กำลังโหลด...</div>
      ) : mails.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: 14 }}>ยังไม่มีรายการจดหมายเข้า</div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
            <thead>
              <tr>
                <th style={th}>เลขที่รับ</th>
                <th style={th}>วันที่รับ</th>
                <th style={th}>ผู้ส่ง</th>
                <th style={th}>ผู้รับ</th>
                <th style={th}>ประเภท</th>
                <th style={th}>เลขพัสดุ/ลงทะเบียน/EMS</th>
                <th style={th}>หมายเหตุ</th>
                <th style={th}>ผู้บันทึก</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {mails.map((m) => (
                <tr key={m.id}>
                  <td style={td}>{m.mail_no}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{String(m.received_date || "").slice(0, 10)}</td>
                  <td style={td}>{m.sender}</td>
                  <td style={td}>{m.recipient}</td>
                  <td style={td}>{m.mail_type}</td>
                  <td style={td}>{m.tracking_no}</td>
                  <td style={td}>{m.note}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{m.created_by}</td>
                  <td style={td}>
                    <button onClick={() => del(m.id)} style={{ padding: "3px 10px", fontSize: 12, border: "none", borderRadius: 6, background: "#ef4444", color: "#fff", cursor: "pointer" }}>ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
