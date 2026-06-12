import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/service-rate-api";

const text = (v) => (v ?? "").toString().trim();
const fmtMoney = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const apiPost = async (payload) => {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  if (!raw.trim()) return null;
  return JSON.parse(raw);
};

export default function ServiceRateSearchPage() {
  const [tab, setTab] = useState("part"); // 'part' = ค้นด้วยรหัสอะไหล่, 'model' = ค้นด้วยรุ่น/แบบ

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💲 ค้นหาค่าบริการ (FRT)</h2>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 12, borderBottom: "2px solid #e2e8f0", flexWrap: "wrap" }}>
        <TabButton active={tab === "part"} onClick={() => setTab("part")}>
          🔍 ค้นด้วยรหัสอะไหล่
        </TabButton>
        <TabButton active={tab === "model"} onClick={() => setTab("model")}>
          📋 ค้นด้วยรุ่น/แบบ (จาก VIN)
        </TabButton>
        <TabButton active={tab === "section"} onClick={() => setTab("section")}>
          📂 เลือกตามหมวด
        </TabButton>
      </div>

      {tab === "part" && <PartSearchView onJumpToPart={() => setTab("part")} />}
      {tab === "model" && <ModelLookupView onGoToPartTab={() => setTab("part")} />}
      {tab === "section" && <SectionBrowseView />}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 18px",
        background: active ? "#1e3a8a" : "transparent",
        color: active ? "#fff" : "#475569",
        border: "none",
        borderRadius: "8px 8px 0 0",
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
        borderBottom: active ? "2px solid #1e3a8a" : "2px solid transparent",
        marginBottom: -2,
      }}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────
   Tab 1: ค้นด้วยรหัสอะไหล่ / ชื่ออะไหล่
   ───────────────────────────────────────────── */
function PartSearchView() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(() => {
    const preset = localStorage.getItem("frt_preset_model");
    if (preset) {
      localStorage.removeItem("frt_preset_model");
      return `${preset}|`;
    }
    return "";
  });
  const [model, model_code] = sel.split("|");
  const [models, setModels] = useState([]);
  const [rows, setRows] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [hourlyRate, setHourlyRate] = useState(() => localStorage.getItem("frtHourlyRate") || "");

  useEffect(() => {
    apiPost({ action: "get_models" })
      .then((d) => setModels(Array.isArray(d) ? d : d?.data || []))
      .catch(() => {});
  }, []);

  const changeRate = (v) => {
    setHourlyRate(v);
    localStorage.setItem("frtHourlyRate", v);
  };

  async function search() {
    if (!text(q)) return;
    try {
      setSearching(true); setError("");
      const d = await apiPost({ action: "search_rate", q: text(q), model, model_code });
      const arr = Array.isArray(d) ? d : d?.data || [];
      setRows(arr);
    } catch {
      setRows([]);
      setError("ค้นหาไม่สำเร็จ — ตรวจสอบว่า import workflow Service Rate API และเปิด Active แล้ว");
    } finally { setSearching(false); }
  }

  const rate = Number(hourlyRate) || 0;
  const laborOf = (frt) => (frt == null || !rate ? null : Number(frt) * rate);
  const minutesOf = (frt) => (frt == null ? null : Math.round(Number(frt) * 60));

  return (
    <>
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
            <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ width: "100%" }}>
              <option value="">ทุกรุ่น</option>
              {models.map((m) => (
                <option key={`${m.model}-${m.model_code}`} value={`${m.model}|${m.model_code}`}>
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
    </>
  );
}

/* ─────────────────────────────────────────────
   Tab 2: ค้นด้วยรุ่น/แบบ (model_code) — lookup
   ───────────────────────────────────────────── */
function ModelLookupView({ onGoToPartTab }) {
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
      const data = await apiPost({ action: "lookup_by_vehicle", q: text(q) });
      if (data?.success) setResult(data);
      else setError(data?.error || "ค้นหาไม่สำเร็จ");
    } catch (e) {
      setError("เชื่อมต่อระบบไม่สำเร็จ: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  function goToPartSearch() {
    if (result?.frt_model) {
      localStorage.setItem("frt_preset_model", result.frt_model);
      onGoToPartTab?.();
    }
  }

  return (
    <>
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
              placeholder="เช่น AFS110MCBT, ACF110CBTT, WW160AS"
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
            onClick={goToPartSearch}
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
    </>
  );
}

/* ─────────────────────────────────────────────
   Tab 3: เลือกตามหมวด (section browse)
   ───────────────────────────────────────────── */
function SectionBrowseView() {
  const [sections, setSections] = useState([]);
  const [models, setModels] = useState([]);
  const [sectionCode, setSectionCode] = useState("");
  const [sel, setSel] = useState(""); // model|model_code (optional filter)
  const [model, model_code] = sel.split("|");
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hourlyRate, setHourlyRate] = useState(() => localStorage.getItem("frtHourlyRate") || "");

  useEffect(() => {
    apiPost({ action: "get_sections" })
      .then((d) => setSections(Array.isArray(d) ? d : d?.data || []))
      .catch(() => {});
    apiPost({ action: "get_models" })
      .then((d) => setModels(Array.isArray(d) ? d : d?.data || []))
      .catch(() => {});
  }, []);

  // auto-load หลังเลือก section
  useEffect(() => {
    if (!sectionCode) { setRows(null); return; }
    (async () => {
      try {
        setLoading(true); setError("");
        const d = await apiPost({ action: "search_rate", q: "", section_code: sectionCode, model, model_code });
        setRows(Array.isArray(d) ? d : d?.data || []);
      } catch {
        setError("ค้นหาไม่สำเร็จ — ตรวจสอบ workflow");
        setRows([]);
      } finally { setLoading(false); }
    })();
  }, [sectionCode, sel]);

  const changeRate = (v) => {
    setHourlyRate(v);
    localStorage.setItem("frtHourlyRate", v);
  };
  const rate = Number(hourlyRate) || 0;
  const laborOf = (frt) => (frt == null || !rate ? null : Number(frt) * rate);
  const minutesOf = (frt) => (frt == null ? null : Math.round(Number(frt) * 60));

  return (
    <>
      <div className="form-card">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "2 1 280px" }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>หมวด (section)</label>
            <select value={sectionCode} onChange={(e) => setSectionCode(e.target.value)} style={{ width: "100%" }}>
              <option value="">— เลือกหมวด —</option>
              {sections.map((s) => (
                <option key={s.section_code} value={s.section_code}>
                  {s.section_code} {s.section_name ? "· " + s.section_name : ""} {s.section_name_en ? "(" + s.section_name_en + ")" : ""} — {s.part_count} parts
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 180px" }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>กรองรุ่น (optional)</label>
            <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ width: "100%" }}>
              <option value="">ทุกรุ่น</option>
              {models.map((m) => (
                <option key={`${m.model}-${m.model_code}`} value={`${m.model}|${m.model_code}`}>
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
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
          เลือกหมวด (เช่น E-2 ฝาสูบ) → แสดงรายการอะไหล่ทั้งหมดในหมวดนั้น · กรองรุ่นเพิ่มได้
        </div>
      </div>

      {error && (
        <div className="form-card" style={{ color: "#b91c1c" }}>❌ {error}</div>
      )}

      {loading && <div className="form-card">⏳ กำลังโหลด...</div>}

      {rows !== null && !loading && !error && (
        <div className="form-card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            ผลการค้นหา {rows.length} รายการ{rows.length >= 500 ? " (แสดงสูงสุด 500)" : ""}
          </div>
          {rows.length === 0 ? (
            <div style={{ color: "#64748b" }}>ไม่พบรายการในหมวดที่เลือก</div>
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
                        <td>{text(r.model)} <span style={{ fontSize: 11, color: "#94a3b8" }}>({text(r.model_code)})</span></td>
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
    </>
  );
}
