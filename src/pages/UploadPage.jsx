import React, { useState } from "react";

const WEBHOOK_URL =
  "https://n8n-new-project-gwf2.onrender.com/webhook/f9283764-c11d-4f06-90bb-d1db708684fd";

const MOTO_PRICE_WEBHOOK_URL =
  "https://n8n-new-project-gwf2.onrender.com/webhook/upload-moto-price";

const EXPENSE_WEBHOOK_URL =
  "https://n8n-new-project-gwf2.onrender.com/webhook/upload-expenses";

const UPLOAD_TYPES = [
  { icon: "📦", title: "สต๊อกสินค้าคงเหลือ", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด" },
  { icon: "📊", title: "รายงานการขาย", desc: "เพิ่มรายการใหม่ / อัปเดตรายการที่ซ้ำ" },
  { icon: "💰", title: "เงินมัดจำคงเหลือ", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด" },
];

export default function UploadPage() {
  const [status, setStatus] = useState("idle"); // idle | loading | ok | error
  const [message, setMessage] = useState("");
  const [motoStatus, setMotoStatus] = useState("idle");
  const [motoMessage, setMotoMessage] = useState("");
  const [expenseStatus, setExpenseStatus] = useState("idle");
  const [expenseMessage, setExpenseMessage] = useState("");

  async function handleMotoUpload() {
    setMotoStatus("loading");
    setMotoMessage("");
    try {
      const res = await fetch(MOTO_PRICE_WEBHOOK_URL, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setMotoMessage(data.message || "นำเข้าตารางราคารถจักรยานยนต์สำเร็จ");
      setMotoStatus("ok");
    } catch (err) {
      setMotoMessage(`เกิดข้อผิดพลาด: ${err.message}`);
      setMotoStatus("error");
    }
  }

  async function handleExpenseUpload() {
    setExpenseStatus("loading");
    setExpenseMessage("");
    try {
      const res = await fetch(EXPENSE_WEBHOOK_URL, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setExpenseMessage(data.message || "นำเข้าข้อมูลค่าใช้จ่ายสำเร็จ");
      setExpenseStatus("ok");
    } catch (err) {
      setExpenseMessage(`เกิดข้อผิดพลาด: ${err.message}`);
      setExpenseStatus("error");
    }
  }

  async function handleUpload() {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch(WEBHOOK_URL, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setMessage(data.message || "นำเข้าข้อมูลทั้งหมดสำเร็จ");
      setStatus("ok");
    } catch (err) {
      setMessage(`เกิดข้อผิดพลาด: ${err.message}`);
      setStatus("error");
    }
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">⬆ ระบบ Upload เข้าฐานข้อมูล</div>
      </div>

      {/* Info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
        {UPLOAD_TYPES.map((t) => (
          <div key={t.title} style={{
            background: "#fff",
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: "0 1px 6px rgba(7,45,107,0.09)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}>
            <span style={{ fontSize: 26 }}>{t.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#072d6b" }}>{t.title}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{t.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Single trigger button */}
      <div style={{
        background: "#fff",
        borderRadius: 14,
        boxShadow: "0 2px 12px rgba(7,45,107,0.10)",
        padding: "32px 28px",
        textAlign: "center",
      }}>
        <button
          onClick={handleUpload}
          disabled={status === "loading"}
          style={{
            padding: "14px 48px",
            fontSize: 17,
            fontWeight: 700,
            fontFamily: "Tahoma, Arial, sans-serif",
            background: status === "loading" ? "#9ca3af" : "#072d6b",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: status === "loading" ? "not-allowed" : "pointer",
            transition: "background 0.2s",
            letterSpacing: 0.5,
          }}
        >
          {status === "loading" ? "⏳ กำลังนำเข้าข้อมูล..." : "⬆ Upload ทั้งหมด"}
        </button>

        {/* Result */}
        {(status === "ok" || status === "error") && (
          <div style={{
            marginTop: 20,
            padding: "12px 18px",
            borderRadius: 9,
            background: status === "ok" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${status === "ok" ? "#86efac" : "#fca5a5"}`,
            color: status === "ok" ? "#15803d" : "#b91c1c",
            fontSize: 15,
            fontWeight: 500,
            display: "inline-block",
          }}>
            {status === "ok" ? "✅ " : "❌ "}{message}
          </div>
        )}
      </div>
      {/* Individual Upload List */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginTop: 24, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", background: "#f8fafc", fontWeight: 700, fontSize: 14, color: "#374151" }}>
          Upload รายการ
        </div>
        {[
          { icon: "🏍️", label: "ตารางราคารถจักรยานยนต์", status: motoStatus, message: motoMessage, onUpload: handleMotoUpload },
          { icon: "💸", label: "ค่าใช้จ่ายรายวัน", status: expenseStatus, message: expenseMessage, onUpload: handleExpenseUpload },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #f3f4f6", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#072d6b" }}>{item.label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {(item.status === "ok" || item.status === "error") && (
                <span style={{
                  fontSize: 12, padding: "3px 10px", borderRadius: 8,
                  background: item.status === "ok" ? "#f0fdf4" : "#fef2f2",
                  color: item.status === "ok" ? "#15803d" : "#b91c1c",
                  border: `1px solid ${item.status === "ok" ? "#86efac" : "#fca5a5"}`,
                }}>
                  {item.status === "ok" ? "✅ " : "❌ "}{item.message}
                </span>
              )}
              <button
                onClick={item.onUpload}
                disabled={item.status === "loading"}
                style={{
                  padding: "7px 18px", fontSize: 13, fontWeight: 700,
                  fontFamily: "Tahoma, Arial, sans-serif",
                  background: item.status === "loading" ? "#9ca3af" : "#072d6b",
                  color: "#fff", border: "none", borderRadius: 8, whiteSpace: "nowrap",
                  cursor: item.status === "loading" ? "not-allowed" : "pointer",
                }}
              >
                {item.status === "loading" ? "⏳ กำลังนำเข้า..." : "⬆ Upload"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
