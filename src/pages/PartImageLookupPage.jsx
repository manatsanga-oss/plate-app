import React, { useMemo, useState } from "react";
import catalog from "../data/adv160_color_parts.json";

/*
  ค้นรูปอะไหล่ (ชุดสี) — v1 โชว์รหัสอย่างเดียว (ยังไม่มีราคา)
  กดรหัส → เปิด PDF ไปหน้าที่มีรหัสนั้น (#page=N) ดูรูป/สีได้บนมือถือผ่าน LINE
  ข้อมูลรหัส→หน้า สกัดจากเล่ม PDF (text layer) เก็บใน src/data/adv160_color_parts.json
*/

export default function PartImageLookupPage() {
  const [q, setQ] = useState("");

  const parts = catalog.parts || [];
  const filtered = useMemo(() => {
    const k = q.trim().toUpperCase();
    if (!k) return parts;
    return parts.filter((p) => p.code.toUpperCase().includes(k));
  }, [q, parts]);

  const openPdf = (page) => {
    const url = `${catalog.pdf_url}#page=${page}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🖼️ ค้นรูปอะไหล่ (ชุดสี)</h2>
      </div>

      <div className="form-card">
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{catalog.title}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
          พิมพ์รหัสอะไหล่เพื่อค้นหา แล้วกดที่รหัส → เปิดรูป/สีจากสมุดภาพ (รหัสที่ระบุสีจะพาไปหน้าสีนั้นโดยตรง)
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="เช่น 64501, K0W, 88210-K0W-T01"
          style={{ width: "100%" }}
          autoFocus
        />
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
          พบ {filtered.length} / {parts.length} รหัส
        </div>
      </div>

      <div className="form-card">
        {filtered.length === 0 ? (
          <div style={{ color: "#64748b" }}>ไม่พบรหัสที่ตรงกับ "{q}"</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {filtered.map((p) => (
              <button
                key={p.code}
                onClick={() => openPdf(p.pages[0])}
                title={`ดูรูป — หน้า ${p.pages.join(", ")}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  background: "#fff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "monospace",
                  fontSize: 14,
                  color: "#1e3a8a",
                  fontWeight: 600,
                }}
              >
                {p.code}
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  🔍 หน้า {p.pages.join(",")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
