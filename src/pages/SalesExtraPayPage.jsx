import React, { useEffect, useState, useMemo } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/sales-extra-pay-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
const PT_LABEL = { advance: "เงินดาวน์/ค่างวดออกแทน", commission: "ค่าคอมพิเศษ" };
const PT_COLOR = { advance: "#3b82f6", commission: "#f59e0b" };

async function postAPI(body) {
  const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

export default function SalesExtraPayPage({ currentUser }) {
  const isAdmin = currentUser?.role === "admin" || ["admin","WARUT"].includes(currentUser?.username);
  const [message, setMessage] = useState("");
  const [brands, setBrands] = useState([]);
  const [series, setSeries] = useState([]);
  const [models, setModels] = useState([]);
  const [types, setTypes] = useState([]);
  const [allRules, setAllRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // selectors
  const [brandId, setBrandId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [modelId, setModelId] = useState("");
  const [typeId, setTypeId] = useState("");

  // form
  const [rForm, setRForm] = useState({ rule_id: "", payment_type: "advance", amount: "", effective_date: todayISO(), end_date: "", note: "" });
  const [savingR, setSavingR] = useState(false);

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [b, s, m, t, r] = await Promise.all([
        postAPI({ action: "get_brands" }),
        postAPI({ action: "get_series" }),
        postAPI({ action: "get_models" }),
        postAPI({ action: "get_types" }),
        postAPI({ action: "list_moto_extra_rules", include_inactive: "false" }),
      ]);
      // n8n alwaysOutputData อาจคืน [{}] เมื่อไม่มีข้อมูล — กรอง object ว่างออก
      const clean = (x) => (Array.isArray(x) ? x.filter(o => o && Object.keys(o).length > 0) : (x?.rows || []));
      setBrands(clean(b));
      setSeries(clean(s));
      setModels(clean(m));
      setTypes(clean(t));
      setAllRules(clean(r));
    } catch (e) { setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }

  // cascade
  const filteredSeries = useMemo(() => brandId ? series.filter(s => String(s.brand_id) === String(brandId)) : series, [brandId, series]);
  const filteredModels = useMemo(() => seriesId ? models.filter(m => String(m.series_id) === String(seriesId)) : models, [seriesId, models]);
  const filteredTypes = useMemo(() => modelId ? types.filter(t => String(t.model_id) === String(modelId)) : types, [modelId, types]);

  // rules ของ type ที่เลือก
  const typeRules = useMemo(() => {
    if (!typeId) return [];
    return allRules.filter(r => String(r.type_id) === String(typeId));
  }, [typeId, allRules]);

  // กรองกฎตามเดือนที่เลือก: rule active in selected month
  // = effective_date <= monthEnd AND (end_date IS NULL OR end_date >= monthStart)
  const filteredRules = useMemo(() => {
    if (!monthFilter) return allRules;
    const [y, m] = monthFilter.split("-").map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0); // last day of month
    return allRules.filter(r => {
      if (!r.effective_date) return false;
      const eff = new Date(String(r.effective_date).slice(0, 10));
      const end = r.end_date ? new Date(String(r.end_date).slice(0, 10)) : null;
      return eff <= monthEnd && (!end || end >= monthStart);
    });
  }, [allRules, monthFilter]);

  // group by type — สำหรับแสดงสรุปทั้งหมด (ใช้ filteredRules ตามเดือน)
  const byType = useMemo(() => {
    const map = {};
    filteredRules.forEach(r => {
      const k = r.type_id;
      if (!k) return;
      if (!map[k]) map[k] = { type_id: r.type_id, brand_name: r.brand_name, series_name: r.series_name, model_code: r.model_code, type_name: r.type_name, advance: [], commission: [] };
      if (r.payment_type === "advance" || r.payment_type === "commission") {
        map[k][r.payment_type].push(r);
      }
    });
    return Object.values(map).sort((a, b) => `${a.brand_name}${a.series_name}${a.model_code}${a.type_name}`.localeCompare(`${b.brand_name}${b.series_name}${b.model_code}${b.type_name}`));
  }, [allRules]);

  async function saveRule() {
    if (!typeId) { setMessage("❌ เลือก type ก่อน"); return; }
    if (!rForm.amount || Number(rForm.amount) <= 0) { setMessage("❌ กรอกยอด"); return; }
    if (!rForm.effective_date) { setMessage("❌ กรอกวันที่ประกาศใช้"); return; }
    setSavingR(true); setMessage("");
    try {
      await postAPI({ action: "save_moto_extra_rule",
        rule_id: rForm.rule_id, type_id: Number(typeId),
        payment_type: rForm.payment_type, amount: Number(rForm.amount),
        effective_date: rForm.effective_date, end_date: rForm.end_date || "",
        note: rForm.note,
        created_by: currentUser?.username || currentUser?.name || "system" });
      setMessage("✅ บันทึกสำเร็จ");
      setRForm({ rule_id: "", payment_type: "advance", amount: "", effective_date: todayISO(), end_date: "", note: "" });
      loadAll();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSavingR(false);
  }
  function editRule(r) {
    setRForm({ rule_id: r.rule_id, payment_type: r.payment_type, amount: r.amount,
      effective_date: String(r.effective_date || "").slice(0, 10),
      end_date: r.end_date ? String(r.end_date).slice(0, 10) : "", note: r.note || "" });
    // also select cascading
    setTypeId(String(r.type_id));
  }
  async function deleteRule(r) {
    if (!window.confirm(`ลบกฎ ${PT_LABEL[r.payment_type]} ${fmt(r.amount)} ?`)) return;
    try {
      await postAPI({ action: "delete_moto_extra_rule", rule_id: r.rule_id });
      setMessage("✅ ลบสำเร็จ"); loadAll();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  function jumpToType(rule) {
    const t = types.find(x => x.type_id === rule.type_id);
    if (!t) return;
    const m = models.find(x => x.model_id === t.model_id);
    const s = m && series.find(x => x.series_id === m.series_id);
    if (s) { setBrandId(String(s.brand_id)); setSeriesId(String(s.series_id)); }
    if (m) setModelId(String(m.model_id));
    setTypeId(String(t.type_id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🚗 บันทึกเงินออกแทนและค่าคอมพิเศษ</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>
      )}

      {/* Month filter */}
      <div style={{ ...cardSt, marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>📅 เดือน:</label>
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ ...inp, maxWidth: 200 }} />
        <button onClick={() => setMonthFilter("")} style={{ ...btnGray, padding: "6px 12px", fontSize: 12 }}>แสดงทั้งหมด</button>
        <span style={{ fontSize: 12, color: "#6b7280" }}>(แสดงเฉพาะกฎที่ active ในเดือนที่เลือก)</span>
      </div>

      {/* Cascade selector */}
      <div style={cardSt}>
        <h3 style={h3St}>เลือกผลิตภัณฑ์</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
          <Field label="ยี่ห้อ">
            <select value={brandId} onChange={e => { setBrandId(e.target.value); setSeriesId(""); setModelId(""); setTypeId(""); }} style={inp}>
              <option value="">-- ทั้งหมด --</option>
              {brands.filter(b => b.status !== "inactive").map(b => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
            </select>
          </Field>
          <Field label="รุ่น">
            <select value={seriesId} onChange={e => { setSeriesId(e.target.value); setModelId(""); setTypeId(""); }} style={inp} disabled={!brandId}>
              <option value="">-- ทั้งหมด --</option>
              {filteredSeries.map(s => <option key={s.series_id} value={s.series_id}>{s.series_name}{s.marketing_name ? ` (${s.marketing_name})` : ""}</option>)}
            </select>
          </Field>
          <Field label="แบบ (model)">
            <select value={modelId} onChange={e => { setModelId(e.target.value); setTypeId(""); }} style={inp} disabled={!seriesId}>
              <option value="">-- ทั้งหมด --</option>
              {filteredModels.map(m => <option key={m.model_id} value={m.model_id}>{m.model_code}</option>)}
            </select>
          </Field>
          <Field label="TYPE">
            <select value={typeId} onChange={e => setTypeId(e.target.value)} style={inp} disabled={!modelId}>
              <option value="">-- เลือก --</option>
              {filteredTypes.map(t => <option key={t.type_id} value={t.type_id}>{t.type_name}{t.model_detail ? ` · ${t.model_detail}` : ""}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {typeId && isAdmin && (
        <div style={{ ...cardSt, marginTop: 12 }}>
          <h3 style={h3St}>{rForm.rule_id ? "✏️ แก้ไข" : "➕ เพิ่ม"} กฎค่าใช้จ่าย</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            <Field label="ประเภท">
              <select value={rForm.payment_type} onChange={e => setRForm({ ...rForm, payment_type: e.target.value })} style={inp}>
                <option value="advance">เงินดาวน์/ค่างวดออกแทน</option>
                <option value="commission">ค่าคอมพิเศษ</option>
              </select>
            </Field>
            <Field label="ยอด">
              <input type="number" step="0.01" value={rForm.amount} onChange={e => setRForm({ ...rForm, amount: e.target.value })} style={{ ...inp, textAlign: "right" }} />
            </Field>
            <Field label="วันที่ประกาศใช้ *">
              <input type="date" value={rForm.effective_date} onChange={e => setRForm({ ...rForm, effective_date: e.target.value })} style={inp} />
            </Field>
            <Field label="วันสิ้นสุด">
              <input type="date" value={rForm.end_date} onChange={e => setRForm({ ...rForm, end_date: e.target.value })} style={inp} />
            </Field>
          </div>
          <Field label="หมายเหตุ">
            <input value={rForm.note} onChange={e => setRForm({ ...rForm, note: e.target.value })} style={inp} />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {rForm.rule_id && <button onClick={() => setRForm({ rule_id: "", payment_type: "advance", amount: "", effective_date: todayISO(), end_date: "", note: "" })} style={btnGray}>ยกเลิก</button>}
            <button onClick={saveRule} disabled={savingR} style={btnGreen}>{savingR ? "..." : "💾 บันทึก"}</button>
          </div>

          <h4 style={{ margin: "16px 0 6px", color: "#072d6b" }}>กฎที่บันทึกของ TYPE นี้ ({typeRules.length})</h4>
          <RulesTable rules={typeRules} onEdit={editRule} onDelete={deleteRule} canEdit={isAdmin} />
        </div>
      )}

      {/* ถ้าไม่ใช่ admin ให้ดู rules ของ TYPE ที่เลือกได้ (read-only) */}
      {typeId && !isAdmin && (
        <div style={{ ...cardSt, marginTop: 12 }}>
          <h4 style={{ margin: "0 0 6px", color: "#072d6b" }}>กฎที่บันทึกของ TYPE นี้ ({typeRules.length})</h4>
          <RulesTable rules={typeRules} onEdit={() => {}} onDelete={() => {}} canEdit={false} />
        </div>
      )}

      {/* All rules summary — แสดงทุกวันประกาศใช้ */}
      <div style={{ ...cardSt, marginTop: 12 }}>
        <h3 style={h3St}>📋 สรุปทั้งหมด ({byType.length} TYPE · {allRules.length} รายการ)</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={tbl}>
            <thead><tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={th}>ยี่ห้อ</th><th style={th}>รุ่น</th><th style={th}>แบบ</th><th style={th}>TYPE</th>
              <th style={{ ...th, textAlign: "center" }}>เงินดาวน์/ค่างวดออกแทน<br/><span style={{fontSize:10,fontWeight:400}}>(ทุกวันประกาศ)</span></th>
              <th style={{ ...th, textAlign: "center" }}>ค่าคอมพิเศษ<br/><span style={{fontSize:10,fontWeight:400}}>(ทุกวันประกาศ)</span></th>
              <th style={th}></th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
              {!loading && byType.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีกฎ</td></tr>}
              {byType.map(g => (
                <tr key={g.type_id} style={{ borderTop: "1px solid #e5e7eb", verticalAlign: "top" }}>
                  <td style={td}>{g.brand_name}</td>
                  <td style={td}>{g.series_name}</td>
                  <td style={td}>{g.model_code}</td>
                  <td style={td}>{g.type_name}</td>
                  <td style={{ ...td, padding: 4 }}>
                    <RuleHistory items={g.advance} color="#3b82f6" />
                  </td>
                  <td style={{ ...td, padding: 4 }}>
                    <RuleHistory items={g.commission} color="#f59e0b" />
                  </td>
                  <td style={td}>
                    <button onClick={() => jumpToType(g)} style={btnSmBlue}>เปิด</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RuleHistory({ items, color }) {
  if (!items || items.length === 0) return <div style={{ color: "#9ca3af", textAlign: "center", padding: 4 }}>-</div>;
  // sort desc by effective_date (already from query แต่ resort เผื่อ)
  const sorted = [...items].sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <tbody>
        {sorted.map((r, i) => (
          <tr key={r.rule_id} style={{ borderBottom: i < sorted.length - 1 ? "1px dashed #e5e7eb" : "none" }}>
            <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color, whiteSpace: "nowrap" }}>{fmt(r.amount)}</td>
            <td style={{ padding: "3px 6px", color: "#6b7280", whiteSpace: "nowrap" }}>
              {fmtDate(r.effective_date)}{r.end_date ? ` → ${fmtDate(r.end_date)}` : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RulesTable({ rules, onEdit, onDelete, canEdit = true }) {
  if (!rules || rules.length === 0) return <div style={{ padding: 14, color: "#9ca3af", textAlign: "center" }}>ยังไม่มีกฎสำหรับ TYPE นี้</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tbl}>
        <thead><tr style={{ background: "#f0f4f9" }}>
          <th style={th}>#</th><th style={th}>ประเภท</th>
          <th style={{ ...th, textAlign: "right" }}>ยอด</th>
          <th style={th}>ประกาศใช้</th><th style={th}>สิ้นสุด</th><th style={th}>หมายเหตุ</th>
          {canEdit && <th style={th}></th>}
        </tr></thead>
        <tbody>
          {rules.map((r, i) => (
            <tr key={r.rule_id} style={{ borderTop: "1px solid #e5e7eb" }}>
              <td style={td}>{i + 1}</td>
              <td style={{ ...td, color: PT_COLOR[r.payment_type], fontWeight: 600 }}>{PT_LABEL[r.payment_type]}</td>
              <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmt(r.amount)}</td>
              <td style={td}>{fmtDate(r.effective_date)}</td>
              <td style={td}>{r.end_date ? fmtDate(r.end_date) : "-"}</td>
              <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{r.note || ""}</td>
              {canEdit && (
                <td style={td}>
                  <button onClick={() => onEdit(r)} style={btnSmYellow}>✏️</button>
                  <button onClick={() => onDelete(r)} style={btnSmRed}>🗑️</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  );
}

const cardSt = { background: "#fff", padding: 16, borderRadius: 10, border: "1px solid #e5e7eb" };
const h3St = { margin: "0 0 10px", color: "#072d6b" };
const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const tbl = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th = { padding: "8px", textAlign: "left", fontSize: 12, fontWeight: 700 };
const td = { padding: "7px", fontSize: 13 };
const btnGreen = { padding: "8px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 };
const btnGray = { padding: "8px 16px", background: "#9ca3af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const btnSmYellow = { marginRight: 4, padding: "3px 8px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnSmBlue = { padding: "3px 10px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnSmRed = { padding: "3px 8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
