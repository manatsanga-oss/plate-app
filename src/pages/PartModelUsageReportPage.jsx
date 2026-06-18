import React, { useState, useEffect, useMemo } from "react";

const SVC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/service-history-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

// ===== normalize รุ่น/แบบ/type เทียบ master moto_types (ตรรกะเดียวกับ RegistrationReceiptEntryPage) =====
const upCode = (s) => String(s || "").toUpperCase().replace(/\s+/g, "").trim();
const normBrand = (b) => {
  const s = String(b || "").toLowerCase();
  if (s.includes("honda") || s.includes("ฮอนด้า")) return "honda";
  if (s.includes("yamaha") || s.includes("ยามาฮ่า")) return "yamaha";
  return s;
};
const parseHondaModelCode = (mc) => {
  const raw = String(mc || "").trim();
  const m = raw.match(/^([A-Za-z0-9\-/]+)\s*\(([^)]+)\)/);
  if (m) return { base: m[1].trim(), type: m[2].trim() };
  return { base: raw.split(/\s+/)[0] || "", type: "" };
};
function normalizeVehicleModel(raw, types) {
  const nb = normBrand(raw.brand);
  let series = String(raw.model_series || "").trim();
  let parsedCode = "", parsedType = "";
  if (nb === "yamaha") { parsedType = upCode(raw.model_code); }
  else { const p = parseHondaModelCode(raw.model_code); parsedCode = upCode(p.base); parsedType = upCode(p.type); }

  // Honda ที่ไม่มี series (เช่น honda_repair_intake) — เดารุ่นจาก code: prefix master ก่อน ไม่เจอใช้ regex
  if (!series && nb === "honda" && parsedCode) {
    const cand = (Array.isArray(types) ? types : [])
      .filter((t) => normBrand(t.brand_name) === "honda" && parsedCode.startsWith(upCode(t.series_name)))
      .sort((a, b) => upCode(b.series_name).length - upCode(a.series_name).length);
    if (cand.length) series = cand[0].series_name;
    else { const mm = parsedCode.match(/^[A-Z]+[0-9]+/); if (mm) series = mm[0]; }
  }

  const pool = (Array.isArray(types) ? types : []).filter(
    (t) => normBrand(t.brand_name) === nb && upCode(t.series_name) === upCode(series)
  );
  let hit = null;
  if (parsedType) hit = pool.find((t) => upCode(t.type_name) === parsedType);
  if (!hit && parsedCode) hit = pool.find((t) => upCode(t.model_code) === parsedCode);
  if (!hit && pool.length === 1) hit = pool[0];

  if (hit) return { brand: hit.brand_name || raw.brand || "", model_series: hit.series_name || series, model_code: hit.model_code || "", model_type: hit.type_name || "" };
  return {
    brand: String(raw.brand || "").trim(),
    model_series: series,
    model_code: nb === "yamaha" ? series : parsedCode,
    model_type: parsedType,
  };
}

const text = (v) => (v ?? "").toString().trim();
const fmtInt = (v) => (Number(v) || 0).toLocaleString("th-TH");
const distinct = (arr) => [...new Set(arr.filter((x) => text(x)))].sort((a, b) => String(a).localeCompare(String(b), "th"));

export default function PartModelUsageReportPage() {
  const [types, setTypes] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [fSeries, setFSeries] = useState("");
  const [fModel, setFModel] = useState("");
  const [fType, setFType] = useState("");
  const [search, setSearch] = useState("");

  const apiPost = async (url, payload) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    if (!raw.trim()) return [];
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : d?.data || d?.rows || [];
  };

  async function load() {
    setLoading(true); setErr("");
    try {
      const d = await apiPost(SVC_API, { action: "part_model_usage" });
      setRawRows(d);
    } catch (e) { setRawRows([]); setErr("โหลดข้อมูลไม่สำเร็จ — ตรวจสอบว่า import workflow แล้ว"); }
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      try { setTypes(await apiPost(MASTER_API, { action: "get_types" })); } catch { setTypes([]); }
    })();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // normalize รุ่น/แบบ/type ทุกแถว
  const rows = useMemo(() => rawRows.map((r) => {
    const nm = normalizeVehicleModel({ brand: r.brand, model_series: r.series, model_code: r.model_code }, types);
    return {
      part_code: text(r.part_code),
      part_name: text(r.part_name),
      n_brand: nm.brand || text(r.brand),
      n_series: nm.model_series,
      n_model: nm.model_code,
      n_type: nm.model_type,
      total_qty: Number(r.total_qty) || 0,
      job_count: Number(r.job_count) || 0,
    };
  }), [rawRows, types]);

  // ตัวกรองแบบ cascading
  const brandOpts = useMemo(() => distinct(rows.map((r) => r.n_brand)), [rows]);
  const seriesOpts = useMemo(() => distinct(rows.filter((r) => !fBrand || r.n_brand === fBrand).map((r) => r.n_series)), [rows, fBrand]);
  const modelOpts = useMemo(() => distinct(rows.filter((r) => (!fBrand || r.n_brand === fBrand) && (!fSeries || r.n_series === fSeries)).map((r) => r.n_model)), [rows, fBrand, fSeries]);
  const typeOpts = useMemo(() => distinct(rows.filter((r) => (!fBrand || r.n_brand === fBrand) && (!fSeries || r.n_series === fSeries) && (!fModel || r.n_model === fModel)).map((r) => r.n_type)), [rows, fBrand, fSeries, fModel]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return rows.filter((r) =>
      (!fBrand || r.n_brand === fBrand) &&
      (!fSeries || r.n_series === fSeries) &&
      (!fModel || r.n_model === fModel) &&
      (!fType || r.n_type === fType) &&
      (!kw || r.part_code.toLowerCase().includes(kw) || r.part_name.toLowerCase().includes(kw))
    ).sort((a, b) =>
      a.part_code.localeCompare(b.part_code) ||
      String(a.n_brand).localeCompare(String(b.n_brand), "th") ||
      String(a.n_series).localeCompare(String(b.n_series), "th")
    );
  }, [rows, fBrand, fSeries, fModel, fType, search]);

  const summary = useMemo(() => ({
    parts: new Set(filtered.map((r) => r.part_code)).size,
    combos: filtered.length,
    qty: filtered.reduce((s, r) => s + r.total_qty, 0),
  }), [filtered]);

  function clearFilters() { setFBrand(""); setFSeries(""); setFModel(""); setFType(""); setSearch(""); }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🔩 รายงานรหัสอะไหล่ใช้กับรุ่น</h2>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", flexWrap: "wrap", alignItems: "center" }}>
        <select value={fBrand} onChange={(e) => { setFBrand(e.target.value); setFSeries(""); setFModel(""); setFType(""); }} style={sel}>
          <option value="">-- ยี่ห้อ ทั้งหมด --</option>
          {brandOpts.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={fSeries} onChange={(e) => { setFSeries(e.target.value); setFModel(""); setFType(""); }} style={sel}>
          <option value="">-- รุ่น ทั้งหมด --</option>
          {seriesOpts.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fModel} onChange={(e) => { setFModel(e.target.value); setFType(""); }} style={sel}>
          <option value="">-- แบบ ทั้งหมด --</option>
          {modelOpts.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fType} onChange={(e) => setFType(e.target.value)} style={sel}>
          <option value="">-- type ทั้งหมด --</option>
          {typeOpts.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="🔎 รหัส / ชื่ออะไหล่"
          style={{ flex: 1, minWidth: 180, padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
        <button onClick={clearFilters} style={{ padding: "8px 14px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>ล้าง</button>
        <button onClick={load} disabled={loading} style={{ padding: "8px 16px", background: loading ? "#9ca3af" : "#0891b2", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
          {loading ? "⏳ โหลด..." : "🔄 รีเฟรช"}
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 12 }}>
        <KPI label="🔩 รหัสอะไหล่" value={fmtInt(summary.parts)} unit="รหัส" color="#0369a1" />
        <KPI label="🔗 รหัส × รุ่น" value={fmtInt(summary.combos)} unit="คู่" color="#7c3aed" />
        <KPI label="🔢 จำนวนเบิกรวม" value={fmtInt(summary.qty)} unit="ชิ้น" color="#059669" />
      </div>

      {err && <div style={{ padding: 10, background: "#fef2f2", color: "#991b1b", borderRadius: 8, marginBottom: 10 }}>{err}</div>}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "2px solid #0891b2", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "#0891b2", color: "#fff", fontWeight: 700, fontSize: 14 }}>
          รหัสอะไหล่ที่เบิก แยกตามรุ่นรถ — {fmtInt(summary.combos)} รายการ
        </div>
        <div style={{ overflowX: "auto", maxHeight: "65vh" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead style={{ background: "#f9fafb", position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th style={th}>#</th>
                <th style={th}>รหัสอะไหล่</th>
                <th style={th}>ชื่ออะไหล่</th>
                <th style={th}>ยี่ห้อ</th>
                <th style={th}>รุ่น</th>
                <th style={th}>แบบ</th>
                <th style={th}>type</th>
                <th style={{ ...th, textAlign: "right" }}>จำนวนเบิก</th>
                <th style={{ ...th, textAlign: "right" }}>ครั้ง (ใบซ่อม)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>
              ) : filtered.map((r, i) => {
                const firstOfGroup = i === 0 || filtered[i - 1].part_code !== r.part_code;
                return (
                  <tr key={`${r.part_code}_${r.n_brand}_${r.n_series}_${r.n_model}_${r.n_type}_${i}`}
                    style={{ borderTop: firstOfGroup ? "2px solid #e5e7eb" : "1px solid #f3f4f6", background: firstOfGroup ? "#fff" : "#fcfdfe" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: firstOfGroup ? 700 : 400, color: "#0369a1" }}>{firstOfGroup ? r.part_code : ""}</td>
                    <td style={td}>{firstOfGroup ? r.part_name : ""}</td>
                    <td style={td}>{r.n_brand || "-"}</td>
                    <td style={td}>{r.n_series || "-"}</td>
                    <td style={td}>{r.n_model || "-"}</td>
                    <td style={td}>{r.n_type || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtInt(r.total_qty)}</td>
                    <td style={{ ...td, textAlign: "right", color: "#6b7280" }}>{fmtInt(r.job_count)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
        * อ้างอิงจากระบบจ่ายอะไหล่ซ่อม (yamaha_part_dispense ↔ ใบแจ้งซ่อม) ครอบคลุมรถทุกยี่ห้อที่เข้าซ่อม · รุ่น/แบบ/type เทียบ master
      </div>
    </div>
  );
}

function KPI({ label, value, unit, color }) {
  return (
    <div style={{ padding: 10, background: "#fff", borderRadius: 10, border: `2px solid ${color}`, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#6b7280" }}>{unit}</div>
    </div>
  );
}

const sel = { padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, background: "#fff", minWidth: 130 };
const th = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "#374151", whiteSpace: "nowrap" };
const td = { padding: "6px 10px", fontSize: 12.5, verticalAlign: "middle" };
