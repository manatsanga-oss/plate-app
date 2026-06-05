import React, { useState, useMemo } from "react";

const REG_API = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";
const SVC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/service-history-api";

const text = (v) => (v ?? "").toString().trim();
const fmtMoney = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (v) => {
  if (!v) return "-";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${Number(m[1]) + 543}`;
  return String(v);
};
const plateOf = (v) => `${text(v.plate_category)} ${text(v.plate_number)}`.trim() || "-";

const FIELDS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "chassis_no", label: "เลขตัวถัง" },
  { key: "engine_no", label: "เลขเครื่อง" },
  { key: "plate_number", label: "ทะเบียนรถ" },
  { key: "customer_name", label: "ชื่อลูกค้า" },
];

export default function ServiceHistorySearchPage() {
  const [field, setField] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [mymoto, setMymoto] = useState(null); // { checking, registered, notified }
  const [popup, setPopup] = useState({ open: false, type: "success", title: "", message: "" });

  const openPopup = (type, title, message) => setPopup({ open: true, type, title, message });
  const closePopup = () => setPopup((p) => ({ ...p, open: false }));

  const apiPost = async (url, payload) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    if (!raw.trim()) return [];
    const d = JSON.parse(raw);
    return d;
  };

  const norm = (d) => (Array.isArray(d) ? d : d?.data || d?.rows || []);

  async function searchVehicles() {
    if (!text(keyword)) return;
    try {
      setSearching(true); setSelected(null); setHistory([]);
      const d = await apiPost(REG_API, { action: "search_registrations", source: "sale", field, keyword: text(keyword) });
      setVehicles(norm(d));
    } catch {
      setVehicles([]);
      openPopup("error", "ค้นหาไม่สำเร็จ", "ไม่สามารถค้นหารถได้");
    } finally { setSearching(false); }
  }

  function notRegisteredMessage(v) {
    return [
      "🔔 แจ้งเตือน: ลูกค้ายังไม่ลงทะเบียน MyMoto",
      `ลูกค้า: ${text(v.customer_name) || "-"}`,
      `ทะเบียน: ${plateOf(v)}`,
      `เลขถัง: ${text(v.frame_no) || "-"}`,
      `รุ่น: ${text(v.brand)} ${text(v.model)}`.trim(),
      "🙏 กรุณาช่วยลงทะเบียน MyMoto ให้ลูกค้า",
    ].join("\n");
  }

  async function selectVehicle(v) {
    setSelected(v); setHistory([]); setMymoto(null);
    // 1) load service history (on-screen)
    (async () => {
      try {
        setLoadingHist(true);
        const d = await apiPost(SVC_API, {
          action: "service_history",
          chassis: v.frame_no, engine: v.engine_no,
          plate: `${text(v.plate_category)}${text(v.plate_number)}`,
          customer: v.customer_name,
        });
        setHistory(norm(d));
      } catch {
        setHistory([]);
        openPopup("error", "โหลดประวัติไม่สำเร็จ", "ตรวจสอบว่า import workflow Service History API แล้ว");
      } finally { setLoadingHist(false); }
    })();
    // 2) MyMoto = โปรแกรม Honda -> เช็ก/แจ้งเตือนเฉพาะรถ Honda เท่านั้น
    const isHonda = /honda|ฮอนด้า/i.test(text(v.brand));
    if (!isHonda) { setMymoto({ checking: false, skipped: true }); return; }
    try {
      setMymoto({ checking: true });
      const r = await apiPost(SVC_API, { action: "mymoto_status", chassis: v.frame_no });
      const row = Array.isArray(r) ? r[0] : r;
      const registered = row?.registered === true || row?.registered === "true" || row?.registered === "t";
      if (registered) {
        setMymoto({ checking: false, registered: true, notified: false });
      } else {
        // auto-send LINE alert to group
        let notified = false;
        try {
          const n = await apiPost(SVC_API, { action: "notify_line", message: notRegisteredMessage(v) });
          notified = Array.isArray(n) ? !!n[0]?.success : !!n?.success;
        } catch { notified = false; }
        setMymoto({ checking: false, registered: false, notified });
      }
    } catch {
      setMymoto({ checking: false, error: true });
    }
  }

  // group part-level rows -> jobs (with parts list)
  const jobs = useMemo(() => {
    const map = new Map();
    for (const r of history) {
      const key = `${r.brand}|${r.job_no}`;
      if (!map.has(key)) {
        map.set(key, {
          brand: r.brand, job_no: r.job_no, service_date: r.service_date,
          repair_type: r.repair_type, mechanic_name: r.mechanic_name, mileage: r.mileage,
          job_amount: r.job_amount, parts: [], _partsum: 0,
        });
      }
      const g = map.get(key);
      if (text(r.part_code) || text(r.part_name)) {
        g.parts.push({ part_code: r.part_code, part_name: r.part_name, qty: r.qty, part_amount: r.part_amount });
        g._partsum += Number(r.part_amount || 0);
      }
    }
    return [...map.values()].map((g) => ({ ...g, total: g.job_amount != null ? Number(g.job_amount) : g._partsum }));
  }, [history]);

  const td = { padding: "7px 10px", borderBottom: "1px solid #eef2f7", fontSize: 13 };
  const th = { padding: "8px 10px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#374151" };

  return (
    <>
      <div className="page-container">
        <div className="page-topbar">
          <h2 className="page-title">🔧 ค้นหาประวัติงานบริการ</h2>
        </div>

        {/* SEARCH */}
        <div className="form-card">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={field} onChange={(e) => setField(e.target.value)}
              style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}>
              {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchVehicles()}
              placeholder="🔎 ค้นหา: เลขตัวถัง / เลขเครื่อง / ทะเบียน / ชื่อลูกค้า"
              style={{ flex: 1, minWidth: 240, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }} />
            <button className="btn-primary" onClick={searchVehicles} disabled={searching}>
              {searching ? "กำลังค้นหา..." : "🔍 ค้นหา"}
            </button>
          </div>
        </div>

        {/* VEHICLES */}
        {vehicles.length > 0 && (
          <div className="form-card">
            <h3 style={{ margin: "0 0 10px", fontSize: 15, color: "#072d6b" }}>เลือกรถ ({vehicles.length} คัน)</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#f8fafc" }}>
                  <tr>
                    <th style={th}>เลขตัวถัง</th><th style={th}>เลขเครื่อง</th><th style={th}>ทะเบียน</th>
                    <th style={th}>ลูกค้า</th><th style={th}>ยี่ห้อ/รุ่น</th><th style={th}>วันที่ขาย</th><th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v, i) => (
                    <tr key={`${v.frame_no}-${i}`} style={{ background: selected && selected.frame_no === v.frame_no ? "#eff6ff" : "transparent" }}>
                      <td style={{ ...td, fontFamily: "monospace" }}>{text(v.frame_no) || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{text(v.engine_no) || "-"}</td>
                      <td style={td}>{plateOf(v)}</td>
                      <td style={td}>{text(v.customer_name) || "-"}</td>
                      <td style={td}>{text(v.brand)} {text(v.model)}</td>
                      <td style={td}>{v.sale_date ? new Date(v.sale_date).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"}</td>
                      <td style={td}>
                        <button className="btn-primary" style={{ padding: "4px 14px", fontSize: 12 }} onClick={() => selectVehicle(v)}>เลือก</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {selected && (
          <div className="form-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: "#072d6b" }}>
                ประวัติการเข้ารับบริการ — {text(selected.customer_name)} ({plateOf(selected)})
              </h3>
              {/* MyMoto status (auto-check by chassis; auto LINE alert if not registered) */}
              {mymoto?.skipped ? (
                <span style={{ fontSize: 13, color: "#64748b", background: "#f1f5f9", padding: "6px 12px", borderRadius: 8 }}>ℹ️ MyMoto เฉพาะรถ Honda</span>
              ) : mymoto?.checking ? (
                <span style={{ fontSize: 13, color: "#64748b", background: "#f1f5f9", padding: "6px 12px", borderRadius: 8 }}>⏳ ตรวจสอบ MyMoto...</span>
              ) : mymoto?.registered ? (
                <span style={{ fontSize: 13, fontWeight: 700, color: "#065f46", background: "#ecfdf5", border: "1px solid #6ee7b7", padding: "6px 12px", borderRadius: 8 }}>✅ ลงทะเบียน MyMoto แล้ว</span>
              ) : mymoto && !mymoto.error ? (
                <span style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: "6px 12px", borderRadius: 8 }}>
                  ⚠️ ยังไม่ลงทะเบียน MyMoto {mymoto.notified ? "· 📲 แจ้ง LINE กลุ่มแล้ว" : "· (ส่ง LINE ไม่สำเร็จ)"}
                </span>
              ) : null}
            </div>
            {loadingHist ? (
              <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด...</div>
            ) : jobs.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>ไม่พบประวัติงานบริการ</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {jobs.map((j, i) => (
                  <div key={`${j.brand}-${j.job_no}-${i}`} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 12px", background: "#f8fafc" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                        <span style={{ color: j.brand === "HONDA" ? "#e2231a" : "#0a4ea2", fontWeight: 800 }}>{j.brand}</span>
                        <span>📅 {fmtDate(j.service_date)}</span>
                        <span style={{ fontFamily: "monospace", color: "#0369a1", fontWeight: 600 }}>{text(j.job_no)}</span>
                        {text(j.repair_type) && <span>🔧 {text(j.repair_type)}</span>}
                        {text(j.mechanic_name) && <span>👨‍🔧 {text(j.mechanic_name)}</span>}
                        {text(j.mileage) && <span>📏 {text(j.mileage)} กม.</span>}
                      </div>
                      <div style={{ fontWeight: 800, color: "#065f46" }}>{fmtMoney(j.total)} บาท</div>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: "#fbfdff" }}>
                          <th style={{ ...th, fontSize: 11 }}>รหัสอะไหล่</th>
                          <th style={{ ...th, fontSize: 11 }}>ชื่ออะไหล่ที่เปลี่ยน</th>
                          <th style={{ ...th, fontSize: 11, textAlign: "right" }}>จำนวน</th>
                          <th style={{ ...th, fontSize: 11, textAlign: "right" }}>ราคา</th>
                        </tr>
                      </thead>
                      <tbody>
                        {j.parts.length === 0 ? (
                          <tr><td colSpan={4} style={{ ...td, color: "#94a3b8" }}>— ไม่มีรายการอะไหล่ —</td></tr>
                        ) : j.parts.map((p, k) => (
                          <tr key={k}>
                            <td style={{ ...td, fontFamily: "monospace" }}>{text(p.part_code) || "-"}</td>
                            <td style={td}>{text(p.part_name) || "-"}</td>
                            <td style={{ ...td, textAlign: "right" }}>{Number(p.qty || 0).toLocaleString()}</td>
                            <td style={{ ...td, textAlign: "right" }}>{fmtMoney(p.part_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
              Yamaha จับด้วยเลขตัวถัง/เครื่อง/ทะเบียน · Honda จับด้วยชื่อลูกค้า
            </div>
          </div>
        )}
      </div>

      {popup.open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }} onClick={closePopup}>
          <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: popup.type === "success" ? "#10b981" : "#ef4444", color: "#fff", padding: "12px 18px", fontSize: 15, fontWeight: 700, textAlign: "center" }}>
              {popup.type === "success" ? "✔ สำเร็จ" : "✖ เกิดข้อผิดพลาด"}
            </div>
            <div style={{ padding: "18px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{popup.title}</div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{popup.message}</div>
            </div>
            <div style={{ padding: "0 20px 16px", textAlign: "center" }}>
              <button style={{ minWidth: 90, background: popup.type === "success" ? "#10b981" : "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, cursor: "pointer" }} onClick={closePopup}>ตกลง</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
