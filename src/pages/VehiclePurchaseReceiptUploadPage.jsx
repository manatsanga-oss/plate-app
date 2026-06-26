import React, { useState } from "react";

const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";

const SOURCES = [
  {
    key: "honda",
    label: "🔴 HONDA — ป.เปา",
    desc: "ไฟล์ XLS รับเข้าจากการซื้อ (DMS HONDA · หมายเลขเครื่อง) · UPSERT (engine_no)",
    table: "vehicle_purchase_receipts_papao",
    url: `${BASE}/upload-vehicle-purchase-honda`,
    accept: ".xls",
    border: "#dc2626",
    // ปุ่มที่ 2: เติมเลขตัวถัง จาก "รายงานการจัดส่ง" โดย match เลขเครื่อง
    extra: {
      key: "honda_chassis",
      title: "🔩 เติมเลขตัวถัง (รายงานการจัดส่ง)",
      desc: "ไฟล์ XLS รายงานการจัดส่ง (DMS HONDA) · เติม chassis_no โดย match เลขเครื่อง",
      url: `${BASE}/upload-honda-chassis-fill`,
      accept: ".xls",
      color: "#7c3aed",
      button: "🔩 เติมเลขตัวถัง",
    },
  },
  {
    key: "yamaha",
    label: "🔵 YAMAHA — สิงห์ชัย",
    desc: "ไฟล์ XLS/XLSX รับเข้าจากการซื้อ (DMS YAMAHA) · UPSERT (chassis_no)",
    table: "vehicle_purchase_receipts_singchai",
    url: `${BASE}/upload-vehicle-purchase-yamaha`,
    accept: ".xls,.xlsx",
    border: "#1e40af",
  },
];

export default function VehiclePurchaseReceiptUploadPage({ currentUser, embeddable } = {}) {
  const [files, setFiles] = useState({});
  const [statuses, setStatuses] = useState({});
  const [messages, setMessages] = useState({});

  async function handleUpload(actionKey, url) {
    const f = files[actionKey];
    if (!f) {
      setMessages(p => ({ ...p, [actionKey]: "⚠️ กรุณาเลือกไฟล์ก่อน" }));
      setStatuses(p => ({ ...p, [actionKey]: "error" }));
      return;
    }
    setStatuses(p => ({ ...p, [actionKey]: "loading" }));
    setMessages(p => ({ ...p, [actionKey]: "" }));
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("uploaded_by", currentUser?.username || "");
      const res = await fetch(url, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setMessages(p => ({ ...p, [actionKey]: data.message || `นำเข้าสำเร็จ ${data.inserted ?? data.count ?? ""} รายการ` }));
      setStatuses(p => ({ ...p, [actionKey]: "ok" }));
    } catch (e) {
      setMessages(p => ({ ...p, [actionKey]: `เกิดข้อผิดพลาด: ${e.message}` }));
      setStatuses(p => ({ ...p, [actionKey]: "error" }));
    }
  }

  // ปุ่ม upload 1 ชุด (input ไฟล์ + ปุ่ม + ข้อความผล) ใช้ซ้ำได้ทั้งปุ่มหลัก/ปุ่มเสริม
  function renderAction(actionKey, url, accept, buttonLabel, color) {
    const st = statuses[actionKey] || "idle";
    const msg = messages[actionKey] || "";
    const file = files[actionKey];
    return (
      <>
        <input
          type="file"
          accept={accept}
          onChange={e => setFiles(p => ({ ...p, [actionKey]: e.target.files?.[0] || null }))}
          style={{ display: "block", fontSize: 12, marginBottom: 8, width: "100%" }}
        />
        {file && (
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
            📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </div>
        )}
        <button
          onClick={() => handleUpload(actionKey, url)}
          disabled={st === "loading" || !file}
          style={{
            width: "100%", padding: "9px 14px", fontSize: 13, fontWeight: 700,
            background: st === "loading" ? "#9ca3af" : color,
            color: "#fff", border: "none", borderRadius: 8,
            cursor: (st === "loading" || !file) ? "not-allowed" : "pointer",
            opacity: !file ? 0.6 : 1,
          }}
        >
          {st === "loading" ? "⏳ กำลังนำเข้า..." : buttonLabel}
        </button>
        {(st === "ok" || st === "error") && (
          <div style={{
            marginTop: 8, fontSize: 12, padding: "6px 10px", borderRadius: 6,
            background: st === "ok" ? "#f0fdf4" : "#fef2f2",
            color: st === "ok" ? "#15803d" : "#b91c1c",
            border: `1px solid ${st === "ok" ? "#86efac" : "#fca5a5"}`,
          }}>
            {st === "ok" ? "✅ " : "❌ "}{msg}
          </div>
        )}
      </>
    );
  }

  const grid = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
      {SOURCES.map(src => (
        <div key={src.key} style={{ border: `2px solid ${src.border}`, borderRadius: 10, padding: 14, background: "#fff" }}>
          <div style={{ fontWeight: 700, color: src.border, fontSize: 15, marginBottom: 4 }}>{src.label}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{src.desc}</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
            📦 Table: <span style={{ fontFamily: "monospace", color: "#6366f1" }}>{src.table}</span>
          </div>

          {renderAction(src.key, src.url, src.accept, "📥 Upload รับเข้าจากการซื้อ", src.border)}

          {src.extra && (
            <>
              <div style={{ borderTop: "1px dashed #e5e7eb", margin: "14px 0 10px" }} />
              <div style={{ fontWeight: 700, color: src.extra.color, fontSize: 13, marginBottom: 3 }}>{src.extra.title}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>{src.extra.desc}</div>
              {renderAction(src.extra.key, src.extra.url, src.extra.accept, src.extra.button, src.extra.color)}
            </>
          )}
        </div>
      ))}
    </div>
  );

  if (embeddable) return grid;

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">📥 Upload รับรถเข้าจากการซื้อ</div>
      </div>
      {grid}
    </div>
  );
}
