import React, { useState } from "react";

const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";

/**
 * PartTaxInvoiceUploadCard — กล่อง upload ใบกำกับภาษีซื้ออะไหล่ (HONDA หรือ YAMAHA)
 * ใช้ใน UploadAccountingPage
 */
export default function PartTaxInvoiceUploadCard({ brand, currentUser }) {
  const isHonda = brand === "HONDA";
  const cfg = isHonda
    ? {
        label: "ใบกำกับภาษีซื้อ HONDA (อะไหล่)",
        desc: "ไฟล์ XLS (TIS-620) รายงานใบกำกับภาษีซื้ออะไหล่ · UPSERT (tax_invoice_no)",
        table: "honda_part_tax_invoices",
        url: `${BASE}/upload-honda-purchase-tax-invoice`,
        accept: ".xls,.xlsx",
      }
    : {
        label: "ใบกำกับภาษีซื้อ YAMAHA (อะไหล่)",
        desc: "ไฟล์ XLSX รายงานใบกำกับภาษีซื้ออะไหล่ · UPSERT (tax_invoice_no)",
        table: "yamaha_part_tax_invoices",
        url: `${BASE}/upload-yamaha-purchase-tax-invoice`,
        accept: ".xlsx,.xls",
      };

  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");

  async function handleUpload() {
    if (!file) { setStatus("error"); setMessage("กรุณาเลือกไฟล์ก่อน"); return; }
    setStatus("loading"); setMessage("กำลังอัปโหลด...");
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("uploaded_by", currentUser?.name || currentUser?.username || "system");
      const res = await fetch(cfg.url, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setStatus("success");
      setMessage(data?.message || "นำเข้าสำเร็จ");
      setFile(null);
    } catch (e) {
      setStatus("error");
      setMessage("อัปโหลดไม่สำเร็จ: " + e.message);
    }
  }

  const statusColor = status === "success" ? "#15803d" : status === "error" ? "#b91c1c" : "#6b7280";
  const accentColor = isHonda ? "#dc2626" : "#1e40af";

  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10, textAlign: "center" }}>{cfg.desc}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", marginBottom: 12, fontSize: 12, color: "#6b7280" }}>
        <span>📦 Table:</span>
        <code style={{ fontSize: 12, padding: "2px 8px", background: "#f3f4f6", borderRadius: 4, color: "#374151" }}>{cfg.table}</code>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input type="file" accept={cfg.accept}
          onChange={e => { setFile(e.target.files?.[0] || null); setStatus(""); setMessage(""); }}
          style={{ fontSize: 12, flex: 1 }} />
      </div>
      <button onClick={handleUpload} disabled={!file || status === "loading"}
        style={{
          width: "100%", padding: "10px", fontSize: 14, fontWeight: 700,
          background: (!file || status === "loading") ? (isHonda ? "#fca5a5" : "#a5b4fc") : accentColor,
          color: "#fff", border: "none", borderRadius: 8,
          cursor: (!file || status === "loading") ? "not-allowed" : "pointer",
        }}>
        {status === "loading" ? "⏳ กำลังอัปโหลด..." : "📤 Upload ใบกำกับภาษีซื้อ"}
      </button>
      {message && (
        <div style={{ marginTop: 10, fontSize: 12, color: statusColor, textAlign: "center" }}>
          {status === "success" ? "✅ " : status === "error" ? "❌ " : ""}{message}
        </div>
      )}
    </div>
  );
}
