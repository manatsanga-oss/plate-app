import React, { useEffect, useState } from "react";

// รายงานรถเข้ารับบริการ — เหตุการณ์จากกล้อง AI (reCamera) พร้อมรูป ณ ตอนตรวจจับ
// แหล่งข้อมูล: service-queue-api (list_events / get_event_image เป็น JSON base64)
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/service-queue-api";
const SVC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/service-history-api"; // ประวัติงานบริการ (ตัวเดียวกับหน้าค้นหาประวัติ)

const CAM_LABEL = { "recamera-1": "กล้อง 1", "recamera-2": "กล้อง 2" };
const todayISO = () => new Date().toISOString().slice(0, 10);
// detected_local จาก API เป็น "DD/MM/YYYY HH:MM:SS" (ค.ศ.)
const dateKeyOf = (r) => {
  const m = String(r.detected_local || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

export default function ServiceArrivalReportPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dateFilter, setDateFilter] = useState(todayISO());
  const [camFilter, setCamFilter] = useState("ALL");
  const [showDup, setShowDup] = useState(false);      // โชว์เหตุการณ์ซ้ำ (ระบบกันซ้ำกดเงียบไว้) ด้วยไหม
  const [plateSearch, setPlateSearch] = useState("");  // ค้นหาด้วยเลขทะเบียน
  const [viewer, setViewer] = useState(null);         // { row, image_data|null, loading }
  const [hist, setHist] = useState(null);             // modal ประวัติซ่อม: { plate, stage, vehicles, vehicle, jobs, error }

  // ---- คลิกทะเบียน → ค้นรถ + ดึงประวัติงานบริการ (API ตัวเดียวกับหน้าค้นหาประวัติ) ----
  const t = (v) => String(v ?? "").trim();
  const normPlate = (s) => t(s).replace(/[\s-]/g, "");

  async function openHistory(plateNo) {
    setHist({ plate: plateNo, stage: "searching", vehicles: [], vehicle: null, jobs: [], error: "" });
    try {
      // แยกหมวด/เลข: "2กจ 383" → ค้นด้วยเลข "383" แล้วจับคู่หมวดอีกที
      const m = t(plateNo).match(/^(\S+)\s+(\S+)$/);
      const keyword = m ? m[2] : t(plateNo);
      const res = await fetch(SVC_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "search_vehicles", field: "plate_number", keyword }) });
      const data = await res.json();
      const all = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []); // API ตอบแบบห่อ {success, data}
      const exact = all.filter(v => normPlate(`${v.plate_category}${v.plate_number}`) === normPlate(plateNo));
      const list = exact.length ? exact : all;
      if (!list.length) { setHist(h => ({ ...h, stage: "done", error: "ไม่พบรถทะเบียนนี้ในฐานข้อมูล" })); return; }
      // เปิดอัตโนมัติเฉพาะหมวด+เลขตรงเป๊ะคันเดียว — เลขตรงแต่หมวดไม่ตรง (กล้องอาจอ่านหมวดเพี้ยน) ให้ผู้ใช้เลือกยืนยันเองก่อน
      if (exact.length === 1) { await loadHistory(exact[0], plateNo); return; }
      setHist(h => ({ ...h, stage: "pick", approx: exact.length === 0, vehicles: list.slice(0, 15) }));
    } catch (e) {
      setHist(h => h ? { ...h, stage: "done", error: "ค้นหาไม่สำเร็จ: " + (e?.message || e) } : h);
    }
  }

  async function loadHistory(v, plateNo) {
    setHist({ plate: plateNo, stage: "loading", vehicles: [], vehicle: v, jobs: [], error: "" });
    try {
      const res = await fetch(SVC_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "service_history",
        chassis: v.frame_no, engine: v.engine_no,
        plate: `${t(v.plate_category)}${t(v.plate_number)}`,
        customer: v.customer_name,
      }) });
      const data = await res.json();
      const rows2 = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []); // API ตอบแบบห่อ {success, data}
      // group รายชิ้น → รายใบงาน (logic เดียวกับหน้าค้นหาประวัติ)
      const map = new Map();
      for (const r of rows2) {
        const key = `${r.brand}|${r.job_no}`;
        if (!map.has(key)) map.set(key, { brand: r.brand, job_no: r.job_no, service_date: r.service_date, repair_type: r.repair_type, mechanic_name: r.mechanic_name, mileage: r.mileage, job_amount: r.job_amount, parts: [], _ps: 0 });
        const g = map.get(key);
        if (t(r.part_code) || t(r.part_name)) { g.parts.push({ part_code: r.part_code, part_name: r.part_name, qty: r.qty, part_amount: r.part_amount }); g._ps += Number(r.part_amount || 0); }
      }
      const jobs = [...map.values()].map(g => ({ ...g, total: g.job_amount != null ? Number(g.job_amount) : g._ps }))
        .sort((a, b) => (String(a.service_date) < String(b.service_date) ? 1 : -1));
      setHist(h => h ? { ...h, stage: "done", vehicle: v, jobs } : h);
    } catch (e) {
      setHist(h => h ? { ...h, stage: "done", error: "โหลดประวัติไม่สำเร็จ (เช็คว่า Service History API ยัง Active)" } : h);
    }
  }

  const fmtMoney = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
  const fmtDate = (v) => { const d = new Date(v); return isNaN(d) ? t(v).slice(0, 10) : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`; };
  // ร้านที่ซื้อ: อ่านจาก prefix เลขใบขาย เช่น SCY01-SS250800167 → SCY01
  const BRANCH_NAME = { SCY01: "สิงห์ชัย", SCY04: "สิงห์ชัย (SCY04)", SCY05: "ป.เปา นครหลวง", SCY06: "ป.เปา วังน้อย", SCY07: "สิงห์ชัยตลาด" };
  const buyStoreOf = (v) => { const c = t(v?.sale_doc_no).split("-")[0]; return c ? `${BRANCH_NAME[c] || c}` : ""; };

  async function load() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_events" }) });
      const data = await res.json();
      setRows((Array.isArray(data) ? data : []).filter(r => r && r.id && !String(r.source || "").startsWith("test")));
    } catch (e) { setMessage("โหลดข้อมูลไม่สำเร็จ: " + (e?.message || e)); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function openImage(r) {
    setViewer({ row: r, image_data: null, loading: true });
    try {
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_event_image", event_id: r.id }) });
      const data = await res.json();
      const row = Array.isArray(data) ? data[0] : data;
      const b64 = row?.image_base64;
      setViewer(v => v && v.row.id === r.id ? { ...v, loading: false, image_data: b64 ? "data:image/jpeg;base64," + b64 : null } : v);
    } catch {
      setViewer(v => v && v.row.id === r.id ? { ...v, loading: false, image_data: null } : v);
    }
  }

  const filtered = rows.filter(r =>
    (!dateFilter || dateKeyOf(r) === dateFilter) &&
    (camFilter === "ALL" || r.source === camFilter) &&
    (showDup || r.notified === true) &&
    (!plateSearch.trim() || String(r.plate_no || "").replace(/\s/g, "").includes(plateSearch.trim().replace(/\s/g, "")))
  );
  const arrivals = filtered.filter(r => r.notified === true).length;
  const camOpts = [...new Set(rows.map(r => r.source).filter(Boolean))];

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🛵 รายงานรถเข้ารับบริการ <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280" }}>(จากกล้อง AI)</span></h2>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }} />
        <button onClick={() => setDateFilter("")} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: dateFilter ? "#fff" : "#072d6b", color: dateFilter ? "#374151" : "#fff", cursor: "pointer", fontSize: 13 }}>ทุกวัน</button>
        <select value={camFilter} onChange={e => setCamFilter(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }}>
          <option value="ALL">ทุกกล้อง</option>
          {camOpts.map(s => <option key={s} value={s}>{CAM_LABEL[s] || s}</option>)}
        </select>
        <input value={plateSearch} onChange={e => setPlateSearch(e.target.value)} placeholder="ค้นหาทะเบียน..."
          style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, width: 130 }} />
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
          <input type="checkbox" checked={showDup} onChange={e => setShowDup(e.target.checked)} />
          แสดงเหตุการณ์ซ้ำด้วย
        </label>
        <button onClick={load} disabled={loading} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#072d6b", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          {loading ? "กำลังโหลด..." : "🔄 รีเฟรช"}
        </button>
        <span style={{ fontSize: 13, color: "#374151", marginLeft: "auto" }}>
          รถเข้าใหม่ <b style={{ color: "#065f46" }}>{arrivals}</b> ครั้ง{showDup ? ` · รวมซ้ำ ${filtered.length} เหตุการณ์` : ""}
        </span>
      </div>

      {message && <div style={{ marginBottom: 10, padding: "8px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontSize: 13 }}>{message}</div>}

      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr><th>#</th><th>วัน-เวลา</th><th>กล้อง</th><th>ทะเบียน</th><th>จำนวนรถในภาพ</th><th>สถานะ</th><th>รูป</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "#9ca3af", padding: 28 }}>{loading ? "กำลังโหลด..." : "ไม่มีเหตุการณ์ในช่วงที่เลือก"}</td></tr>
            ) : filtered.map((r, i) => (
              <tr key={r.id} style={{ background: r.notified ? undefined : "#f9fafb" }}>
                <td style={{ textAlign: "center" }}>{i + 1}</td>
                <td style={{ whiteSpace: "nowrap" }}>{r.detected_local}</td>
                <td style={{ textAlign: "center" }}>{CAM_LABEL[r.source] || r.source}</td>
                <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                  {r.plate_no
                    ? <span onClick={() => openHistory(r.plate_no)} title="คลิกดูประวัติการเข้ารับบริการ" style={{ cursor: "pointer" }}>
                        <b style={{ color: "#1d4ed8", textDecoration: "underline" }}>{r.plate_no}</b>
                        {r.plate_province ? <span style={{ display: "block", fontSize: 11, color: "#6b7280" }}>{r.plate_province}</span> : null}
                      </span>
                    : <span style={{ color: "#9ca3af", fontSize: 12 }}>อ่านไม่ได้</span>}
                </td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{r.vehicle_count}</td>
                <td style={{ textAlign: "center" }}>
                  {r.notified
                    ? <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700, background: "#d1fae5", color: "#065f46" }}>รถเข้าใหม่</span>
                    : <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, background: "#f3f4f6", color: "#6b7280" }}>ซ้ำ/คันเดิม</span>}
                </td>
                <td style={{ textAlign: "center" }}>
                  {r.has_image
                    ? <button onClick={() => openImage(r)} style={{ padding: "4px 12px", fontSize: 13, background: "#dbeafe", color: "#1e40af", border: "none", borderRadius: 6, cursor: "pointer" }}>🖼️ ดูรูป</button>
                    : <span style={{ color: "#9ca3af", fontSize: 12 }}>-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal ประวัติการเข้ารับบริการ (คลิกจากทะเบียน) */}
      {hist && (
        <div onClick={() => setHist(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1001, padding: 16, overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, maxWidth: 860, width: "100%", marginTop: 24, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#072d6b" }}>
                🔧 ประวัติการเข้ารับบริการ — ทะเบียน {hist.plate}
                {hist.vehicle ? <span style={{ fontWeight: 400, fontSize: 13, color: "#6b7280" }}> · {t(hist.vehicle.customer_name) || "-"} {t(hist.vehicle.brand)}</span> : null}
              </h3>
              <button onClick={() => setHist(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>

            {/* การ์ดรายละเอียดรถ */}
            {hist.vehicle && hist.stage === "done" && !hist.error && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "6px 16px", padding: "10px 14px", background: "#eff6ff", borderRadius: 10, marginBottom: 12, fontSize: 13, borderLeft: "3px solid #1e40af" }}>
                <div><span style={{ color: "#6b7280" }}>รุ่น:</span> <b>{t(hist.vehicle.model_series) || "-"}</b> {t(hist.vehicle.model_code)} {t(hist.vehicle.color) && `· สี${t(hist.vehicle.color)}`}</div>
                <div><span style={{ color: "#6b7280" }}>เลขเครื่อง:</span> <span style={{ fontFamily: "monospace" }}>{t(hist.vehicle.engine_no) || "-"}</span></div>
                <div><span style={{ color: "#6b7280" }}>เลขถัง:</span> <span style={{ fontFamily: "monospace" }}>{t(hist.vehicle.frame_no) || "-"}</span></div>
                <div><span style={{ color: "#6b7280" }}>วันที่ซื้อ:</span> {hist.vehicle.sale_date ? fmtDate(hist.vehicle.sale_date) : "-"}</div>
                <div><span style={{ color: "#6b7280" }}>ร้านที่ซื้อ:</span> {buyStoreOf(hist.vehicle) || "-"} {t(hist.vehicle.sale_doc_no) && <span style={{ color: "#9ca3af", fontSize: 11 }}>({t(hist.vehicle.sale_doc_no)})</span>}</div>
              </div>
            )}

            {hist.stage === "searching" || hist.stage === "loading" ? (
              <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด...</div>
            ) : hist.error ? (
              <div style={{ padding: "12px 16px", background: "#fffbeb", color: "#92400e", borderRadius: 8 }}>{hist.error}</div>
            ) : hist.stage === "pick" ? (
              <div>
                <div style={{ fontSize: 13, color: hist.approx ? "#b45309" : "#6b7280", marginBottom: 8 }}>
                  {hist.approx
                    ? `⚠ ไม่พบทะเบียน "${hist.plate}" ตรงหมวดในฐานข้อมูล — กล้องอาจอ่านหมวดอักษรเพี้ยน พบรถเลขทะเบียนเดียวกัน เลือกคันที่ใช่:`
                    : "พบรถหลายคันที่เลขทะเบียนตรงกัน — เลือกคันที่ใช่:"}
                </div>
                {hist.vehicles.map((v, i) => (
                  <div key={i} onClick={() => loadHistory(v, hist.plate)} style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 6, cursor: "pointer", display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                    <b style={{ color: "#072d6b" }}>{t(v.plate_category)} {t(v.plate_number)}</b>
                    <span>{t(v.customer_name) || "-"}</span>
                    <span style={{ color: "#6b7280" }}>{t(v.brand)} {t(v.model_name || v.series_name || "")}</span>
                    <span style={{ color: "#9ca3af", fontFamily: "monospace", fontSize: 12 }}>{t(v.frame_no)}</span>
                  </div>
                ))}
              </div>
            ) : hist.jobs.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>ไม่พบประวัติงานบริการของรถคันนี้</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, color: "#374151" }}>เข้ารับบริการทั้งหมด <b>{hist.jobs.length}</b> ครั้ง</div>
                {hist.jobs.map((j, i) => (
                  <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 12px", background: "#f8fafc" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                        <span style={{ color: j.brand === "HONDA" ? "#e2231a" : "#0a4ea2", fontWeight: 800 }}>{j.brand}</span>
                        <span>📅 {fmtDate(j.service_date)}</span>
                        <span style={{ fontFamily: "monospace", color: "#0369a1", fontWeight: 600 }}>{t(j.job_no)}</span>
                        {t(j.repair_type) && <span>🔧 {t(j.repair_type)}</span>}
                        {t(j.mileage) && <span>📏 {t(j.mileage)} กม.</span>}
                      </div>
                      <div style={{ fontWeight: 800, color: "#065f46" }}>{fmtMoney(j.total)} บาท</div>
                    </div>
                    {j.parts.length > 0 && (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <tbody>
                          {j.parts.map((p, k) => (
                            <tr key={k}>
                              <td style={{ padding: "4px 12px", fontFamily: "monospace", color: "#6b7280", width: 150 }}>{t(p.part_code)}</td>
                              <td style={{ padding: "4px 8px" }}>{t(p.part_name)}</td>
                              <td style={{ padding: "4px 8px", textAlign: "right", width: 60 }}>{t(p.qty)}</td>
                              <td style={{ padding: "4px 12px", textAlign: "right", width: 90 }}>{p.part_amount != null ? fmtMoney(p.part_amount) : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal ดูรูป */}
      {viewer && (
        <div onClick={() => setViewer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 16, maxWidth: 900, width: "100%", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, color: "#072d6b" }}>
                {viewer.row.detected_local} · {CAM_LABEL[viewer.row.source] || viewer.row.source} · {viewer.row.vehicle_count} คัน
                {viewer.row.plate_no ? ` · ทะเบียน ${viewer.row.plate_no}${viewer.row.plate_province ? " " + viewer.row.plate_province : ""}` : ""}
                {viewer.row.notified ? "" : " · (เหตุการณ์ซ้ำ)"}
              </div>
              <button onClick={() => setViewer(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>
            <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", borderRadius: 8 }}>
              {viewer.loading ? <span style={{ color: "#6b7280" }}>กำลังโหลดรูป...</span>
                : viewer.image_data ? <img src={viewer.image_data} alt="event" style={{ maxWidth: "100%", borderRadius: 8 }} />
                : <span style={{ color: "#9ca3af" }}>ไม่มีรูป (อาจถูกล้างตามรอบ 30 วัน)</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
