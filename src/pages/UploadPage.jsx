import React, { useState } from "react";

const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";

const UPLOAD_GROUPS = [
  {
    title: "UPLOAD ข้อมูลการขาย",
    items: [
      { key: "stock", label: "สต๊อกสินค้าคงเหลือ", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด", db: "stock_items", url: `${BASE}/upload-stock` },
      { key: "sales", label: "รายงานการขาย", desc: "เพิ่มรายการใหม่ / อัปเดตรายการที่ซ้ำ", db: "sales_report", url: `${BASE}/upload-sales` },
      { key: "deposit", label: "เงินมัดจำคงเหลือ", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด", db: "moto_deposit", url: `${BASE}/upload-deposit` },
      { key: "honda-deposit", label: "เงินมัดจำคงเหลือ HONDA", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด", db: "honda_deposits", url: `${BASE}/upload-honda-deposit` },
    ],
  },
  {
    title: "UPLOAD ข้อมูลบริการและอะไหล่",
    items: [
      { key: "honda-inventory", label: "สินค้าคงเหลืออะไหล่", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด (HONDA + อื่นๆ)", db: "honda_inventory", url: `${BASE}/upload-honda-inventory` },
      { key: "dcs-orders", label: "รายงานการสั่งอะไหล่ DCS", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด", db: "dcs_orders", url: `${BASE}/upload-dcs-orders` },
      { key: "dcs-backorders", label: "รายงานอะไหล่ค้างส่ง DCS", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด", db: "dcs_backorders", url: `${BASE}/upload-dcs-backorders` },
      { key: "yamaha-b2b-orders", label: "รายงานการสั่งอะไหล่ YAMAHA B2B", desc: "เพิ่มรายการใหม่ / อัปเดตรายการที่ซ้ำ", db: "yamaha_b2b_orders", url: `${BASE}/upload-yamaha-b2b-orders` },
      { key: "yamaha-b2b-backorders", label: "รายงานอะไหล่ค้างส่ง YAMAHA B2B", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด", db: "yamaha_b2b_backorders", url: `${BASE}/upload-yamaha-b2b-backorders` },
      { key: "pending-job", label: "รายการอะไหล่เบิกค้างปิด JOB", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด", db: "pending_job_parts", url: `${BASE}/upload-pending-job` },
    ],
  },
  {
    title: "อื่น ๆ",
    items: [
      { key: "fast-moving", label: "รหัสอะไหล่หมุนเวียนเร็ว", desc: "ลบข้อมูลเก่า แล้วนำเข้าใหม่ทั้งหมด", db: "fast_moving_parts", url: `${BASE}/upload-fast-moving` },
      { key: "motoprice", label: "ตารางราคารถจักรยานยนต์", desc: "อัปเดตข้อมูลราคารถ", db: "moto_prices", url: `${BASE}/upload-moto-price` },
      { key: "expense", label: "ค่าใช้จ่ายรายวัน", desc: "นำเข้าข้อมูลค่าใช้จ่าย", db: "daily_expenses", url: `${BASE}/upload-expenses` },
    ],
  },
];

function loadLastUploads() {
  try {
    const raw = localStorage.getItem("upload_last_times");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear() + 543;
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

export default function UploadPage() {
  const [statuses, setStatuses] = useState({});
  const [messages, setMessages] = useState({});
  const [lastUploads, setLastUploads] = useState(loadLastUploads);

  async function handleUpload(item) {
    setStatuses(prev => ({ ...prev, [item.key]: "loading" }));
    setMessages(prev => ({ ...prev, [item.key]: "" }));
    try {
      const res = await fetch(item.url, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setMessages(prev => ({ ...prev, [item.key]: data.message || "นำเข้าข้อมูลสำเร็จ" }));
      setStatuses(prev => ({ ...prev, [item.key]: "ok" }));
      const now = new Date().toISOString();
      setLastUploads(prev => {
        const next = { ...prev, [item.key]: now };
        try { localStorage.setItem("upload_last_times", JSON.stringify(next)); } catch {}
        return next;
      });
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

      {UPLOAD_GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", background: "#072d6b", padding: "10px 16px", borderRadius: "10px 10px 0 0", textAlign: "left" }}>
            {group.title}
          </div>
          <div style={{ background: "#fff", borderRadius: "0 0 14px 14px", boxShadow: "0 2px 12px rgba(7,45,107,0.10)", overflow: "hidden" }}>
            {group.items.map((item) => {
              const st = statuses[item.key] || "idle";
              const msg = messages[item.key] || "";
              return (
                <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f3f4f6", gap: 12, textAlign: "left" }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#072d6b" }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{item.desc}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>📦 Table: <span style={{ fontFamily: "monospace", color: "#6366f1" }}>{item.db}</span></div>
                    {lastUploads[item.key] && (
                      <div style={{ fontSize: 11, color: "#059669", marginTop: 2 }}>🕒 ล่าสุด: {fmtDateTime(lastUploads[item.key])}</div>
                    )}
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
      ))}
    </div>
  );
}
