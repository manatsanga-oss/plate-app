import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/service-rate-api";

const text = (v) => (v ?? "").toString().trim();
const fmtMoney = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ServiceRateSearchPage() {
  const [q, setQ] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState([]);
  const [rows, setRows] = useState(null); // null = ยังไม่ค้น
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [hourlyRate, setHourlyRate] = useState(() => localStorage.getItem("frtHourlyRate") || "");

  const apiPost = async (payload) => {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    if (!raw.trim()) return [];
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : d?.data || [];
  };

  useEffect(() => {
    apiPost({ action: "get_models" }).then(setModels).catch(() => {});
  }, []);

  const changeRate = (v) => {
    setHourlyRate(v);
    localStorage.setItem("frtHourlyRate", v);
  };

  async function search() {
    if (!text(q)) return;
    try {
      setSearching(true); setError("");
      const d = await apiPost({ action: "search_rate", q: text(q), model });
      setRows(d);
    } catch {
      setRows([]);
      setError("ค้นหาไม่สำเร็จ — ตรวจสอบว่า import workflow Service Rate API และเปิด Active แล้ว");
    } finally { setSearching(false); }
  }

  const rate = Number(hourlyRate) || 0;
  const laborOf = (frt) => (frt == null || !rate ? null : Number(frt) * rate);
  const minutesOf = (frt) => (frt == null ? null : Math.round(Number(frt) * 60));

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💲 ค้นหาค่าบริการ (FRT)</h2>
      </div>

      <div className="form-card">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "2 1 260px" }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>รหัสอะไหล่ หรือ ชื่ออะไหล่/งาน</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="เช่น 12010-KZY-700, ผ้าดิสก์เบรค, หัวเทียน"
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>รุ่นรถ</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} style={{ width: "100%" }}>
              <option value="">ทุกรุ่น</option>
              {models.map((m) => (
                <option key={`${m.model}-${m.model_code}`} value={m.model}>
                  {m.model} ({m.model_code})
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>อัตราค่าแรง (บาท/ชม.)</label>
            <input
              type="number"
              min="0"
              value={hourlyRate}
              onChange={(e) => changeRate(e.target.value)}
              placeholder="เช่น 535"
              style={{ width: "100%" }}
            />
          </div>
          <button className="btn-primary" onClick={search} disabled={searching || !text(q)}>
            {searching ? "กำลังค้นหา..." : "🔍 ค้นหา"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
          FRT (Flat Rate Time) = เวลามาตรฐานจากคู่มือรายการอะไหล่ Honda (0.1 ชม. = 6 นาที) · ค่าแรง = FRT × อัตราค่าแรงต่อชั่วโมง
        </div>
      </div>

      {error && (
        <div className="form-card" style={{ color: "#b91c1c" }}>❌ {error}</div>
      )}

      {rows !== null && !error && (
        <div className="form-card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            ผลการค้นหา {rows.length} รายการ{rows.length >= 100 ? " (แสดงสูงสุด 100 — พิมพ์ให้เจาะจงขึ้น)" : ""}
          </div>
          {rows.length === 0 ? (
            <div style={{ color: "#64748b" }}>ไม่พบรายการที่ตรงกับ "{text(q)}"</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>รุ่น</th>
                    <th>หมวด</th>
                    <th>รหัสอะไหล่</th>
                    <th>ชื่ออะไหล่/งาน</th>
                    <th>ชื่ออังกฤษ</th>
                    <th style={{ textAlign: "right" }}>FRT (ชม.)</th>
                    <th style={{ textAlign: "right" }}>เวลา (นาที)</th>
                    <th style={{ textAlign: "right" }}>ค่าแรง (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const labor = laborOf(r.frt_hours);
                    return (
                      <tr key={i}>
                        <td>{text(r.model)}</td>
                        <td title={text(r.section_name_en)}>{text(r.section_code)} {text(r.section_name)}</td>
                        <td style={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>{text(r.part_no) || "-"}</td>
                        <td>{text(r.part_name)}</td>
                        <td style={{ fontSize: 12, color: "#64748b" }}>{text(r.part_name_en)}</td>
                        <td style={{ textAlign: "right" }}>{r.frt_hours == null ? "-" : Number(r.frt_hours).toFixed(1)}</td>
                        <td style={{ textAlign: "right" }}>{minutesOf(r.frt_hours) ?? "-"}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                          {labor == null ? (r.frt_hours != null && !rate ? "ใส่อัตราค่าแรง" : "-") : fmtMoney(labor)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
