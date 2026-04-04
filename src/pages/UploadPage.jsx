import React, { useState } from "react";

const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";

const UPLOAD_ITEMS = [
  { key: "stock", label: "สต๊อกสินค้าคงเหลือ", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด", url: `${BASE}/upload-stock` },
  { key: "sales", label: "รายงานการขาย", desc: "เพิ่มรายการใหม่ / อัปเดตรายการที่ซ้ำ", url: `${BASE}/upload-sales` },
  { key: "deposit", label: "เงินมัดจำคงเหลือ", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด", url: `${BASE}/upload-deposit` },
  { key: "honda-deposit", label: "เงินมัดจำคงเหลือ HONDA", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด", url: `${BASE}/upload-honda-deposit` },
  { key: "honda-inventory", label: "สินค้าคงเหลืออะไหล่", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด (HONDA + อื่นๆ)", url: `${BASE}/upload-honda-inventory` },
  { key: "motoprice", label: "ตารางราคารถจักรยานยนต์", desc: "อัปเดตข้อมูลราคารถ", url: `${BASE}/upload-moto-price` },
  { key: "expense", label: "ค่าใช้จ่ายรายวัน", desc: "นำเข้าข้อมูลค่าใช้จ่าย", url: `${BASE}/upload-expenses` },
  { key: "dcs-orders", label: "รายงานการสั่งอะไหล่ DCS", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด", url: `${BASE}/upload-dcs-orders` },
];

export default function UploadPage() {
  const [statuses, setStatuses] = useState({});
  const [messages, setMessages] = useState({});

  async function handleUpload(item) {
    setStatuses(prev => ({ ...prev, [item.key]: "loading" }));
    setMessages(prev => ({ ...prev, [item.key]: "" }));
    try {
      const res = await fetch(item.url, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setMessages(prev => ({ ...prev, [item.key]: data.message || "นำเข้าข้อมูลสำเร็จ" }));
      setStatuses(prev => ({ ...prev, [item.key]: "ok" }));
    } catch (err) {
      setMessages(prev => ({ ...prev, [item.key]: `เกิดข้อผิดพลาด: ${err.message}` }));
      setStatuses(prev => ({ ...prev, [item.key]: "error" }));
    }
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">Upload เข้าฐานข้อมูล</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden" }}>
        {UPLOAD_ITEMS.map((item) => {
          const st = statuses[item.key] || "idle";
          const msg = messages[item.key] || "";
          return (
            <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f3f4f6", gap: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#072d6b" }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{item.desc}</div>
                {(st === "ok" || st === "error") && (
                  <div style={{
                    marginTop: 6, fontSize: 12, padding: "3px 10px", borderRadius: 8, display: "inline-block",
                    background: st === "ok" ? "#f0fdf4" : "#fef2f2",
                    color: st === "ok" ? "#15803d" : "#b91c1c",
                    border: `1px solid ${st === "ok" ? "#86efac" : "#fca5a5"}`,
                  }}>
                    {st === "ok" ? "OK " : "ERROR "}{msg}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleUpload(item)}
                disabled={st === "loading"}
                style={{
                  padding: "8px 20px", fontSize: 13, fontWeight: 700,
                  fontFamily: "Tahoma, Arial, sans-serif",
                  background: st === "loading" ? "#9ca3af" : "#072d6b",
                  color: "#fff", border: "none", borderRadius: 8, whiteSpace: "nowrap",
                  cursor: st === "loading" ? "not-allowed" : "pointer",
                }}
              >
                {st === "loading" ? "กำลังนำเข้า..." : "Upload"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
