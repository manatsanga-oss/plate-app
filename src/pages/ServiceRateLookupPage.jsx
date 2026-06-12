import React, { useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/service-rate-api";

const text = (v) => (v ?? "").toString().trim();

export default function ServiceRateLookupPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function lookup() {
    if (!text(q)) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup_by_vehicle", q: text(q) }),
      });
      const data = await res.json();
      if (data?.success) {
        setResult(data);
      } else {
        setError(data?.error || "ค้นหาไม่สำเร็จ");
      }
    } catch (e) {
      setError("เชื่อมต่อระบบไม่สำเร็จ: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  function goToFrtSearch() {
    if (result?.frt_model) {
      localStorage.setItem("frt_preset_model", result.frt_model);
      window.dispatchEvent(new CustomEvent("nav-to-page", { detail: "servicerate" }));
    }
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🔍 ค้นหา FRT จากรุ่น/แบบ</h2>
      </div>

      <div className="form-card">
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
          กรอกรหัสรุ่น/แบบจากเอกสารรถ (เช่น <code>AFS110MCBT</code>, <code>ACF110CBTT</code>) ระบบจะหา PDF Parts List ที่ตรงกัน
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px" }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>รหัสรุ่น/แบบ (model_code)</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="เช่น AFS110MCBT, ACF110CBTT"
              style={{ width: "100%" }}
              autoFocus
            />
          </div>
          <button className="btn-primary" onClick={lookup} disabled={loading || !text(q)}>
            {loading ? "กำลังค้นหา..." : "🔍 ค้นหา"}
          </button>
        </div>
      </div>

      {error && (
        <div className="form-card" style={{ color: "#b91c1c" }}>
          ❌ {error}
        </div>
      )}

      {result && result.has_frt && (
        <div className="form-card" style={{ background: "#f0fdf4", borderColor: "#86efac" }}>
          <div style={{ fontWeight: 700, color: "#15803d", fontSize: 16, marginBottom: 10 }}>
            ✅ พบ FRT สำหรับรุ่นนี้
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <div>📋 รหัสรุ่น/แบบ: <strong>{result.model_code}</strong></div>
            {result.model_name && <div>🏷️ ชื่อรุ่น: {result.model_name}</div>}
            <div style={{ marginTop: 8, padding: 10, background: "#fff", borderRadius: 6 }}>
              💲 FRT model: <strong style={{ color: "#0369a1" }}>{result.frt_model}</strong> ({result.frt_model_code})
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={goToFrtSearch}
            style={{ marginTop: 12 }}
          >
            ดู FRT ทั้งหมดของรุ่นนี้ →
          </button>
        </div>
      )}

      {result && !result.has_frt && (
        <div className="form-card" style={{ background: "#fef3c7", borderColor: "#fcd34d" }}>
          <div style={{ fontWeight: 700, color: "#a16207", fontSize: 16, marginBottom: 10 }}>
            ⚠️ พบรุ่น แต่ยังไม่มี FRT
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>
            <div>📋 รหัสรุ่น/แบบ: <strong>{result.model_code}</strong></div>
            {result.model_name && <div>🏷️ ชื่อรุ่น: {result.model_name}</div>}
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: "#92400e" }}>
            รุ่นนี้อยู่ใน master data แล้วแต่ยังไม่มี FRT mapping<br />
            → admin ต้อง <strong>import PDF Parts List ของรุ่นนี้</strong> ผ่านหน้า "📤 นำเข้า FRT" และ <strong>UPDATE moto_models.frt_model</strong>
          </div>
        </div>
      )}

      <div className="form-card" style={{ background: "#f8fafc", fontSize: 12 }}>
        <strong>วิธีหารหัสรุ่น/แบบจากเอกสารรถ:</strong>
        <ul style={{ margin: "4px 0", paddingLeft: 18, color: "#475569" }}>
          <li>ดูในหน้าใบเสร็จรับรถ / เอกสาร MyMoto — field "รุ่น/แบบ" หรือ "MODEL NAME"</li>
          <li>ตัวอย่าง: <code>AFS110MCBT</code> (Wave 110i), <code>ACF110CBTT</code> (Scoopy), <code>WW160AS</code> (PCX160)</li>
          <li>ถ้ารหัสมี suffix เช่น <code>AFS110MCBT TH</code> — กรอกแค่ <code>AFS110MCBT</code> (ตัด TH/2TH ออก)</li>
        </ul>
      </div>
    </div>
  );
}
