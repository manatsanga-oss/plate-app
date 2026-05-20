import React, { useState } from "react";

const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";

const SOURCES = [
  {
    key: "honda",
    label: "🔴 HONDA — ป.เปา",
    desc: "ไฟล์ XLS รับเข้าจากการซื้อ (DMS HONDA) · UPSERT (chassis_no)",
    table: "vehicle_purchase_receipts_papao",
    url: `${BASE}/upload-vehicle-purchase-honda`,
    accept: ".xls",
    border: "#dc2626",
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

  async function handleUpload(src) {
    const f = files[src.key];
    if (!f) {
      setMessages(p => ({ ...p, [src.key]: "⚠️ กรุณาเลือกไฟล์ก่อน" }));
      setStatuses(p => ({ ...p, [src.key]: "error" }));
      return;
    }
    setStatuses(p => ({ ...p, [src.key]: "loading" }));
    setMessages(p => ({ ...p, [src.key]: "" }));
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("uploaded_by", currentUser?.username || "");
      const res = await fetch(src.url, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setMessages(p => ({ ...p, [src.key]: data.message || `นำเข้าสำเร็จ ${data.inserted ?? data.count ?? ""} รายการ` }));
      setStatuses(p => ({ ...p, [src.key]: "ok" }));
    } catch (e) {
      setMessages(p => ({ ...p, [src.key]: `เกิดข้อผิดพลาด: ${e.message}` }));
      setStatuses(p => ({ ...p, [src.key]: "error" }));
    }
  }

  const grid = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
      {SOURCES.map(src => {
        const st = statuses[src.key] || "idle";
        const msg = messages[src.key] || "";
        const file = files[src.key];
        return (
          <div key={src.key} style={{ border: `2px solid ${src.border}`, borderRadius: 10, padding: 14, background: "#fff" }}>
            <div style={{ fontWeight: 700, color: src.border, fontSize: 15, marginBottom: 4 }}>{src.label}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{src.desc}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
              📦 Table: <span style={{ fontFamily: "monospace", color: "#6366f1" }}>{src.table}</span>
            </div>
            <input
              type="file"
              accept={src.accept}
              onChange={e => setFiles(p => ({ ...p, [src.key]: e.target.files?.[0] || null }))}
              style={{ display: "block", fontSize: 12, marginBottom: 8, width: "100%" }}
            />
            {file && (
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
                📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
            <button
              onClick={() => handleUpload(src)}
              disabled={st === "loading" || !file}
              style={{
                width: "100%", padding: "9px 14px", fontSize: 13, fontWeight: 700,
                background: st === "loading" ? "#9ca3af" : src.border,
                color: "#fff", border: "none", borderRadius: 8,
                cursor: (st === "loading" || !file) ? "not-allowed" : "pointer",
                opacity: !file ? 0.6 : 1,
              }}
            >
              {st === "loading" ? "⏳ กำลังนำเข้า..." : "📥 Upload รับเข้าจากการซื้อ"}
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
          </div>
        );
      })}
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
