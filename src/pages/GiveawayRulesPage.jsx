import React, { useEffect, useMemo, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/giveaway-rules-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const FAST_MOVING_API = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-api";
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";

const text = (v) => (v ?? "").toString().trim();
const baht = (v) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (v) => {
  if (!v) return "ตลอด";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(v);
  return `${m[3]}/${m[2]}/${Number(m[1]) + 543}`;
};
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

async function apiPost(url, payload) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const raw = await r.text();
  if (!raw.trim()) return [];
  const d = JSON.parse(raw);
  return Array.isArray(d) ? d : (d?.data || [d]);
}

const blank = (currentUser) => ({
  id: null,
  brand_id: "", series_id: "", type_id: "",
  part_code: "", part_name: "", qty: 1,
  effective_date: "", end_date: "", note: "", status: "active",
  created_by: currentUser?.username || currentUser?.name || "system",
});

export default function GiveawayRulesPage({ currentUser }) {
  const [rules, setRules] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(blank(currentUser));
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterPart, setFilterPart] = useState("");
  const [tab, setTab] = useState("rules"); // rules | vehicle

  async function loadRules() {
    setLoading(true);
    try {
      const data = await apiPost(API_URL, { op: "list" });
      setRules(Array.isArray(data) ? data : []);
    } catch { setRules([]); }
    setLoading(false);
  }
  async function loadTypes() {
    try {
      const data = await fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_types" }) }).then(r => r.json());
      setTypes((Array.isArray(data) ? data : []).filter(m => m.status === "active" && m.model_status === "active" && m.series_status === "active" && m.brand_status === "active"));
    } catch { setTypes([]); }
  }
  // โหลดรายการอะไหล่หมุนเร็วเพื่อ lookup ชื่ออัตโนมัติจาก part_code
  const [partsMap, setPartsMap] = useState({}); // { "UPPER(part_code)": "product_name" }
  async function loadPartsMap() {
    try {
      const r = await fetch(FAST_MOVING_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_fast_moving_report" }) });
      const data = await r.json();
      const map = {};
      (Array.isArray(data) ? data : []).forEach(p => {
        const code = String(p.part_code || "").toUpperCase().trim();
        if (code) map[code] = p.product_name || "";
      });
      setPartsMap(map);
    } catch { setPartsMap({}); }
  }
  const lookupPartName = (code) => partsMap[String(code || "").toUpperCase().trim()] || "";
  useEffect(() => { loadRules(); loadTypes(); loadPartsMap(); }, []);

  // cascade dropdowns
  const [brand, setBrand] = useState(""); const [marketing, setMarketing] = useState(""); const [modelCode, setModelCode] = useState("");
  const brandOpts = useMemo(() => [...new Set(types.map(t => t.brand_name).filter(Boolean))].sort(), [types]);
  const marketingOpts = useMemo(() => [...new Set(types.filter(t => !brand || t.brand_name === brand).map(t => t.marketing_name || t.series_name).filter(Boolean))].sort(), [types, brand]);
  const modelOpts = useMemo(() => [...new Set(types.filter(t => (!brand || t.brand_name === brand) && (!marketing || (t.marketing_name || t.series_name) === marketing)).map(t => t.model_code).filter(Boolean))].sort(), [types, brand, marketing]);
  const typeOpts = useMemo(() => types.filter(t => (!brand || t.brand_name === brand) && (!marketing || (t.marketing_name || t.series_name) === marketing) && (!modelCode || t.model_code === modelCode)), [types, brand, marketing, modelCode]);

  function openNew() {
    setForm(blank(currentUser));
    setBrand(""); setMarketing(""); setModelCode("");
    setShowForm(true);
  }
  function openEdit(r) {
    setForm({
      id: r.id, brand_id: r.brand_id || "", series_id: r.series_id || "", type_id: r.type_id || "",
      part_code: r.part_code || "", part_name: r.part_name || "", qty: r.qty || 1,
      effective_date: r.effective_date ? String(r.effective_date).slice(0, 10) : "",
      end_date: r.end_date ? String(r.end_date).slice(0, 10) : "",
      note: r.note || "", status: r.status || "active",
      created_by: r.created_by || "",
    });
    setBrand(r.brand_name || "");
    setMarketing(r.marketing_name || r.series_name || "");
    setModelCode(r.model_code || "");
    setShowForm(true);
  }
  async function handleSave() {
    // ระดับยี่ห้อ (brand เท่านั้น) / ระดับรุ่น (brand+series) / ระดับแบบ (brand+series+type)
    if (!brand) { setMessage("❌ เลือกยี่ห้อ"); return; }
    if (!text(form.part_code)) { setMessage("❌ ใส่รหัสอะไหล่ที่แถม"); return; }
    // หา brand_id / series_id จาก dropdown (ผ่าน types master) — ถ้าเลือก type ใช้ค่าจาก type
    const sel = form.type_id ? types.find(t => String(t.type_id) === String(form.type_id)) : null;
    // brand_id from any matching type with same brand_name
    const brandRow = types.find(t => t.brand_name === brand);
    const brand_id = sel?.brand_id || brandRow?.brand_id || null;
    // series_id from marketing dropdown
    const seriesRow = marketing ? types.find(t => t.brand_name === brand && (t.marketing_name || t.series_name) === marketing) : null;
    const series_id = sel?.series_id || seriesRow?.series_id || null;
    if (!brand_id) { setMessage("❌ หา brand_id ไม่ได้"); return; }
    try {
      await apiPost(API_URL, {
        op: form.id ? "update" : "save",
        ...form,
        brand_id,
        series_id,
        type_id: form.type_id ? Number(form.type_id) : null,
        qty: Number(form.qty || 1),
      });
      setMessage(`✅ ${form.id ? "แก้ไข" : "เพิ่ม"}บันทึกของแถมเรียบร้อย`);
      setShowForm(false);
      await loadRules();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
  }
  async function handleDelete(r) {
    if (!window.confirm(`ลบกฎของแถม "${r.part_code}" สำหรับ ${r.brand_name} ${r.model_code} ${r.type_name}?`)) return;
    try {
      await apiPost(API_URL, { op: "delete", id: r.id });
      setMessage("✅ ลบเรียบร้อย");
      await loadRules();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  const filtered = useMemo(() => rules.filter(r => {
    if (filterType && String(r.type_id) !== String(filterType)) return false;
    if (filterPart) {
      const kw = filterPart.toLowerCase();
      const hay = `${r.part_code} ${r.fmp_product_name || r.part_name || ""}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  }), [rules, filterType, filterPart]);

  return (
    <div style={{ padding: 20, background: "#fbf7f1", minHeight: "100%" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 24, color: "#333" }}>🎁 บันทึกของแถม</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
        {[["rules", "📋 กฎของแถม (ทั่วไป)"], ["vehicle", "🏍️ ของแถมเฉพาะคัน"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 16px", border: "none", background: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, color: tab === k ? "#072d6b" : "#94a3b8", borderBottom: tab === k ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>{l}</button>
        ))}
      </div>

      {tab === "vehicle" && <VehicleGiveawayTab currentUser={currentUser} lookupPartName={lookupPartName} />}

      {tab === "rules" && (<>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={openNew} style={btnGreen}>➕ เพิ่มของแถม</button>
      </div>

      {message && <div style={{ padding: "8px 14px", marginBottom: 12, background: message.startsWith("✅") ? "#dcfce7" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b", borderRadius: 6, fontSize: 14 }}>{message}</div>}

      <div style={{ ...card, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>🔍 ค้นหา:</span>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inp, maxWidth: 280 }}>
          <option value="">— ทุก Type —</option>
          {types.map(t => <option key={t.type_id} value={t.type_id}>{t.brand_name} · {t.model_code} · {t.type_name}</option>)}
        </select>
        <input value={filterPart} onChange={e => setFilterPart(e.target.value)} placeholder="รหัส/ชื่ออะไหล่" style={{ ...inp, maxWidth: 220 }} />
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>{filtered.length} รายการ</span>
      </div>

      <div style={card}>
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead style={thead}>
              <tr>
                <th style={th}>ยี่ห้อ</th><th style={th}>รุ่น</th><th style={th}>แบบ</th>
                <th style={th}>รหัสอะไหล่</th><th style={th}>ชื่ออะไหล่</th>
                <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
                <th style={th}>วันเริ่ม</th><th style={th}>วันสิ้นสุด</th>
                <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
                <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด...</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>ยังไม่มีข้อมูล</td></tr>
                : filtered.map(r => (
                  <tr key={r.id}>
                    <td style={td}>
                      {r.brand_name || "-"}
                      <span style={{ marginLeft: 4, fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 700, background: r.level === "type" ? "#dcfce7" : r.level === "series" ? "#fef3c7" : "#dbeafe", color: r.level === "type" ? "#15803d" : r.level === "series" ? "#a16207" : "#1e40af" }}>
                        {r.level === "type" ? "แบบ" : r.level === "series" ? "รุ่น" : "ยี่ห้อ"}
                      </span>
                    </td>
                    <td style={td}>{r.marketing_name || r.series_name ? `${r.marketing_name || r.series_name}${r.model_code ? " · " + r.model_code : ""}` : <span style={{ color: "#94a3b8", fontStyle: "italic" }}>ทุกรุ่น</span>}</td>
                    <td style={{ ...td, fontWeight: 700, color: "#0369a1" }}>{r.type_name || <span style={{ color: "#94a3b8", fontStyle: "italic", fontWeight: 400 }}>ทุกแบบ</span>}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{r.part_code}</td>
                    <td style={td}>{r.fmp_product_name || lookupPartName(r.part_code) || r.part_name || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>ไม่พบในอะไหล่หมุนเร็ว</span>}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{baht(r.qty)}</td>
                    <td style={td}>{fmtDate(r.effective_date)}</td>
                    <td style={td}>{fmtDate(r.end_date)}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: r.status === "active" ? "#dcfce7" : "#fee2e2", color: r.status === "active" ? "#16a34a" : "#dc2626" }}>{r.status === "active" ? "ใช้งาน" : "ปิด"}</span>
                    </td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                      <button onClick={() => openEdit(r)} style={{ ...btnSm, background: "#f59e0b" }}>✏️</button>
                      <button onClick={() => handleDelete(r)} style={{ ...btnSm, background: "#ef4444" }}>🗑️</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      </>)}

      {tab === "rules" && showForm && (
        <Modal onClose={() => setShowForm(false)} title={form.id ? "✏️ แก้ไขของแถม" : "➕ เพิ่มของแถม"}>
          <Form>
            <Field label="ยี่ห้อ *">
              <select value={brand} onChange={e => { setBrand(e.target.value); setMarketing(""); setModelCode(""); setForm(f => ({ ...f, type_id: "" })); }} style={inp}>
                <option value="">— เลือกยี่ห้อ —</option>
                {brandOpts.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <div style={{ padding: 8, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 12, color: "#1e40af" }}>
              💡 <b>ระดับการกำหนด:</b> ใส่แค่ <b>ยี่ห้อ</b> = ใช้กับทุกรุ่น · ใส่ <b>ยี่ห้อ+รุ่น</b> = ใช้กับทุกแบบของรุ่นนั้น · ใส่ครบถึง <b>แบบ</b> = specific
            </div>
            <Field label="รุ่น (Marketing) — ว่าง=ทุกรุ่น">
              <select value={marketing} onChange={e => { setMarketing(e.target.value); setModelCode(""); setForm(f => ({ ...f, type_id: "" })); }} style={inp} disabled={!brand}>
                <option value="">— ทุกรุ่นในยี่ห้อ —</option>
                {marketingOpts.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Model Code">
              <select value={modelCode} onChange={e => { setModelCode(e.target.value); setForm(f => ({ ...f, type_id: "" })); }} style={inp} disabled={!marketing}>
                <option value="">— ทุก model_code —</option>
                {modelOpts.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="แบบ (Type) — ว่าง=ทุกแบบของรุ่น">
              <select value={form.type_id} onChange={e => setForm(f => ({ ...f, type_id: e.target.value }))} style={inp} disabled={!marketing || typeOpts.length === 0}>
                <option value="">— ทุกแบบ —</option>
                {typeOpts.map(t => <option key={t.type_id} value={t.type_id}>{t.type_name} · {t.model_code}</option>)}
              </select>
            </Field>

            <div style={{ borderTop: "1px solid #e5e7eb", margin: "10px 0", paddingTop: 10 }} />

            <Field label="รหัสอะไหล่ที่แถม *">
              <input value={form.part_code} onChange={e => setForm(f => ({ ...f, part_code: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} placeholder="เช่น P-0111-1" />
              {form.part_code && (
                <div style={{ marginTop: 4, padding: "6px 10px", borderRadius: 4, fontSize: 12, background: lookupPartName(form.part_code) ? "#dcfce7" : "#fee2e2", color: lookupPartName(form.part_code) ? "#15803d" : "#b91c1c" }}>
                  {lookupPartName(form.part_code)
                    ? <>✅ <b>{lookupPartName(form.part_code)}</b> <span style={{ color: "#64748b" }}>(ดึงจากรายการอะไหล่หมุนเร็ว)</span></>
                    : <>⚠️ ไม่พบรหัสนี้ในรายการอะไหล่หมุนเร็ว</>
                  }
                </div>
              )}
            </Field>
            <Field label="จำนวน *">
              <input type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} style={inp} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="วันเริ่มต้น">
                <input type="date" value={form.effective_date} onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))} style={inp} />
              </Field>
              <Field label="วันสิ้นสุด (ว่าง=ตลอด)">
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inp} />
              </Field>
            </div>

            <Field label="หมายเหตุ">
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={{ ...inp, minHeight: 50 }} />
            </Field>
            <Field label="สถานะ">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ปิด</option>
              </select>
            </Field>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setShowForm(false)} style={btnGrey}>ยกเลิก</button>
              <button onClick={handleSave} style={btnGreen}>💾 บันทึก</button>
            </div>
          </Form>
        </Modal>
      )}
    </div>
  );
}

function VehicleGiveawayTab({ currentUser, lookupPartName }) {
  const blankV = () => ({ id: null, chassis_no: "", engine_no: "", brand: "", model_name: "", model_code: "", color_name: "", customer_name: "", given_date: todayISO(), note: "", status: "active", items: [{ part_code: "", part_name: "", qty: 1 }] });
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [kw, setKw] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [looking, setLooking] = useState(false);
  const [form, setForm] = useState(blankV());

  async function load() {
    setLoading(true);
    try { const data = await apiPost(API_URL, { op: "list_vehicle" }); setList(Array.isArray(data) ? data : []); } catch { setList([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setForm(blankV()); setMsg(""); setShowForm(true); }
  function openEdit(r) {
    setForm({
      id: r.id, chassis_no: r.chassis_no || "", engine_no: r.engine_no || "", brand: r.brand || "",
      model_name: r.model_name || "", model_code: r.model_code || "", color_name: r.color_name || "",
      customer_name: r.customer_name || "", given_date: r.given_date ? String(r.given_date).slice(0, 10) : todayISO(),
      note: r.note || "", status: r.status || "active",
      items: Array.isArray(r.items) && r.items.length ? r.items.map(it => ({ part_code: it.part_code || "", part_name: it.part_name || "", qty: it.qty || 1 })) : [{ part_code: "", part_name: "", qty: 1 }],
    });
    setMsg(""); setShowForm(true);
  }

  async function lookupVehicle() {
    const keyword = text(form.chassis_no) || text(form.engine_no);
    if (!keyword) { setMsg("❌ ใส่หมายเลขตัวถัง/เครื่องก่อน"); return; }
    setLooking(true);
    try {
      const rows = await apiPost(RETAIL_API, { action: "get_vehicle", keyword });
      const v = Array.isArray(rows) ? rows[0] : rows;
      if (!v || (!v.chassis_no && !v.engine_no && !v.model_name)) { setMsg("⚠️ ไม่พบรถจากหมายเลขนี้ — กรอกข้อมูลเองได้"); setLooking(false); return; }
      setForm(f => ({ ...f,
        chassis_no: v.chassis_no || f.chassis_no, engine_no: v.engine_no || f.engine_no,
        brand: v.brand || f.brand, model_name: v.model_name || f.model_name, model_code: v.model_code || f.model_code,
        color_name: v.color_name || f.color_name, customer_name: (v.sale && v.sale.customer_name) || f.customer_name,
      }));
      setMsg(`✅ พบรถ: ${[v.brand, v.model_name, v.model_code].filter(Boolean).join(" ")}`);
    } catch { setMsg("❌ ดึงข้อมูลรถไม่สำเร็จ"); }
    setLooking(false);
  }

  const setItem = (i, patch) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) }));
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { part_code: "", part_name: "", qty: 1 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, idx) => idx !== i) : f.items }));

  async function save() {
    if (!text(form.chassis_no) && !text(form.engine_no)) { setMsg("❌ ใส่หมายเลขตัวถังหรือเลขเครื่อง"); return; }
    const items = form.items.filter(it => text(it.part_code)).map(it => ({ part_code: text(it.part_code), part_name: lookupPartName(it.part_code) || text(it.part_name), qty: Number(it.qty) || 1 }));
    if (!items.length) { setMsg("❌ ใส่รหัสของแถมอย่างน้อย 1 รายการ"); return; }
    try {
      await apiPost(API_URL, { op: form.id ? "update_vehicle" : "save_vehicle", ...form, items, created_by: currentUser?.username || currentUser?.name || "system" });
      setMsg(`✅ ${form.id ? "แก้ไข" : "บันทึก"}ของแถมเฉพาะคันเรียบร้อย`);
      setShowForm(false); await load();
    } catch { setMsg("❌ บันทึกไม่สำเร็จ"); }
  }
  async function del(r) {
    if (!window.confirm(`ลบของแถมของรถ ${r.chassis_no || r.engine_no}?`)) return;
    try { await apiPost(API_URL, { op: "delete_vehicle", id: r.id }); setMsg("✅ ลบเรียบร้อย"); await load(); } catch { setMsg("❌ ลบไม่สำเร็จ"); }
  }

  const filtered = list.filter(r => { if (!kw) return true; const h = `${r.chassis_no} ${r.engine_no} ${r.model_name} ${r.customer_name}`.toLowerCase(); return h.includes(kw.toLowerCase()); });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={openNew} style={btnGreen}>➕ เพิ่มของแถมเฉพาะคัน</button>
      </div>
      {msg && <div style={{ padding: "8px 14px", marginBottom: 12, background: msg.startsWith("✅") ? "#dcfce7" : msg.startsWith("⚠️") ? "#fef9c3" : "#fee2e2", color: msg.startsWith("✅") ? "#065f46" : msg.startsWith("⚠️") ? "#92400e" : "#991b1b", borderRadius: 6, fontSize: 14 }}>{msg}</div>}
      <div style={{ ...card, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>🔍 ค้นหา:</span>
        <input value={kw} onChange={e => setKw(e.target.value)} placeholder="ตัวถัง/เลขเครื่อง/รุ่น/ลูกค้า" style={{ ...inp, maxWidth: 280 }} />
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>{filtered.length} คัน</span>
      </div>
      <div style={card}>
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead style={thead}><tr>
              <th style={th}>ตัวถัง</th><th style={th}>เลขเครื่อง</th><th style={th}>รถ</th><th style={th}>ลูกค้า</th>
              <th style={th}>วันที่</th><th style={th}>ของแถม</th><th style={{ ...th, textAlign: "center" }}>สถานะ</th><th style={{ ...th, textAlign: "center" }}>จัดการ</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด...</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>ยังไม่มีข้อมูล</td></tr>
                : filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{r.chassis_no || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.engine_no || "-"}</td>
                    <td style={td}>{[r.brand, r.model_name, r.model_code].filter(Boolean).join(" ") || "-"}</td>
                    <td style={td}>{r.customer_name || "-"}</td>
                    <td style={td}>{fmtDate(r.given_date)}</td>
                    <td style={td}>{Array.isArray(r.items) && r.items.length ? r.items.map((it, i) => <div key={i} style={{ fontSize: 12 }}>{it.part_code}{it.part_name ? ` · ${it.part_name}` : ""} ×{baht(it.qty)}</div>) : "-"}</td>
                    <td style={{ ...td, textAlign: "center" }}><span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: r.status === "active" ? "#dcfce7" : "#fee2e2", color: r.status === "active" ? "#16a34a" : "#dc2626" }}>{r.status === "active" ? "ใช้งาน" : "ปิด"}</span></td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                      <button onClick={() => openEdit(r)} style={{ ...btnSm, background: "#f59e0b" }}>✏️</button>
                      <button onClick={() => del(r)} style={{ ...btnSm, background: "#ef4444" }}>🗑️</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={form.id ? "✏️ แก้ไขของแถมเฉพาะคัน" : "➕ เพิ่มของแถมเฉพาะคัน"}>
          <Form>
            <Field label="หมายเลขตัวถัง / เลขเครื่อง *">
              <div style={{ display: "flex", gap: 8 }}>
                <input value={form.chassis_no} onChange={e => setForm(f => ({ ...f, chassis_no: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} placeholder="หมายเลขตัวถัง" />
                <input value={form.engine_no} onChange={e => setForm(f => ({ ...f, engine_no: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} placeholder="เลขเครื่อง" />
                <button onClick={lookupVehicle} disabled={looking} style={{ ...btnGreen, whiteSpace: "nowrap" }}>{looking ? "..." : "🔍 ดึงรถ"}</button>
              </div>
            </Field>
            {(form.brand || form.model_name) && (
              <div style={{ padding: 8, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 13, color: "#1e40af" }}>
                🏍️ {[form.brand, form.model_name, form.model_code, form.color_name].filter(Boolean).join(" · ")}
              </div>
            )}
            <Field label="ลูกค้า"><input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} style={inp} /></Field>
            <Field label="วันที่ให้ของแถม"><input type="date" value={form.given_date} onChange={e => setForm(f => ({ ...f, given_date: e.target.value }))} style={inp} /></Field>

            <div style={{ borderTop: "1px solid #e5e7eb", margin: "6px 0", paddingTop: 8 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>รายการของแถม *</label>
              {form.items.map((it, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <input value={it.part_code} onChange={e => setItem(i, { part_code: e.target.value })} style={{ ...inp, fontFamily: "monospace" }} placeholder="รหัสของแถม เช่น P-003" />
                    {it.part_code && <div style={{ fontSize: 11, marginTop: 2, color: lookupPartName(it.part_code) ? "#15803d" : "#b91c1c" }}>{lookupPartName(it.part_code) ? "✅ " + lookupPartName(it.part_code) : "⚠️ ไม่พบในอะไหล่หมุนเร็ว"}</div>}
                  </div>
                  <input type="number" min="1" value={it.qty} onChange={e => setItem(i, { qty: e.target.value })} style={{ ...inp, width: 70 }} />
                  <button onClick={() => removeItem(i)} style={{ ...btnSm, background: "#ef4444", padding: "7px 10px" }}>✕</button>
                </div>
              ))}
              <button onClick={addItem} style={{ ...btnGrey, fontSize: 12 }}>➕ เพิ่มของแถม</button>
            </div>

            <Field label="หมายเหตุ"><textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={{ ...inp, minHeight: 44 }} /></Field>
            <Field label="สถานะ"><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inp}><option value="active">ใช้งาน</option><option value="inactive">ปิด</option></select></Field>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setShowForm(false)} style={btnGrey}>ยกเลิก</button>
              <button onClick={save} style={btnGreen}>💾 บันทึก</button>
            </div>
          </Form>
        </Modal>
      )}
    </>
  );
}

const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thead = { background: "#072d6b" };
const th = { padding: "10px 12px", color: "#fff", textAlign: "left", fontSize: 12, fontWeight: 700 };
const td = { padding: "10px 12px", borderBottom: "1px solid #eef2f7" };
const inp = { width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };
const btnGreen = { padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
const btnGrey = { padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" };
const btnSm = { padding: "3px 10px", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, marginRight: 4 };

function Modal({ children, onClose, title }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, padding: 22, width: "min(560px, 96vw)", maxHeight: "92vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
function Form({ children }) { return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>; }
function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
