import React, { useEffect, useState } from "react";

const ACCOUNTING_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}

const TYPES = [
  { key: "finance",     label: "ตามไฟแนนท์",        emoji: "💳", color: "#1e40af", desc: "บวกเพิ่มตามชื่อบริษัทไฟแนนท์" },
  { key: "finance_cc",  label: "ตามไฟแนนท์ + CC",   emoji: "🏍️", color: "#7c3aed", desc: "บวกเพิ่มตามไฟแนนท์ + ช่วง CC ของรถ" },
  { key: "custom",      label: "กำหนดเอง",          emoji: "✏️", color: "#ea580c", desc: "บวกเพิ่มเฉพาะรุ่น/ยี่ห้อ/สาขา" },
];

const EMPTY_ROW = {
  id: null, markup_type: "finance", finance_company: "", cc_min: "", cc_max: "",
  model_code: "", brand: "", branch_group: "all", markup_amount: "",
  effective_date: "", end_date: "", status: "active", notes: "",
};

export default function SalePriceMarkupPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [financeCos, setFinanceCos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [edit, setEdit] = useState(null);  // editing row or null

  async function fetchFinance() {
    try {
      const res = await fetch(MASTER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_finance_companies" }),
      });
      const data = await res.json();
      setFinanceCos(Array.isArray(data) ? data.filter(c => c.status !== "inactive") : []);
    } catch (e) { /* ignore */ }
  }
  useEffect(() => { fetchFinance(); }, []);

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_price_markups" }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : (data?.rows || []));
    } catch (e) {
      setRows([]); setMessage("❌ โหลดไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (!edit) return;
    if (!edit.markup_amount || Number(edit.markup_amount) === 0) { alert("กรอกยอดบวกเพิ่ม"); return; }
    if (edit.markup_type === "finance" && !edit.finance_company) { alert("เลือก/กรอกบริษัทไฟแนนท์"); return; }
    if (edit.markup_type === "finance_cc" && (!edit.finance_company || !edit.cc_min)) { alert("กรอกไฟแนนท์ + CC"); return; }

    setMessage("⏳ กำลังบันทึก...");
    try {
      const body = { action: "save_price_markup", ...edit, created_by: currentUser?.username || "system" };
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      const ok = (Array.isArray(data) ? data[0] : data)?.id || (Array.isArray(data) ? data[0] : data)?.updated;
      if (!ok) throw new Error("save fail");
      setMessage("✅ บันทึกแล้ว"); setEdit(null); fetchData();
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
  }

  async function del(id) {
    if (!confirm("ลบเงื่อนไขนี้?")) return;
    try {
      await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_price_markup", id }),
      });
      fetchData();
    } catch (e) { alert("ลบไม่สำเร็จ"); }
  }

  const byType = TYPES.map(t => ({ ...t, items: rows.filter(r => r.markup_type === t.key) }));

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💵 เงื่อนไขราคาขายบวกเพิ่ม</h2>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: message.startsWith("❌") ? "#b91c1c" : "#065f46" }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px,1fr))", gap: 16 }}>
        {byType.map(t => (
          <div key={t.key} style={{ background: "#fff", borderRadius: 10, border: `2px solid ${t.color}`, overflow: "hidden" }}>
            <div style={{ background: t.color, color: "#fff", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t.emoji} {t.label}</div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>{t.desc}</div>
              </div>
              <button onClick={() => setEdit({ ...EMPTY_ROW, markup_type: t.key })}
                style={{ padding: "6px 12px", background: "#fff", color: t.color, border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>+ เพิ่ม</button>
            </div>
            <div style={{ padding: 8, maxHeight: 500, overflowY: "auto" }}>
              {t.items.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>ยังไม่มีข้อมูล</div>}
              {t.items.map(r => (
                <div key={r.id} style={{ borderBottom: "1px solid #e5e7eb", padding: "8px 6px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, fontSize: 12 }}>
                    {t.key === "finance" && <div style={{ fontWeight: 600 }}>{r.finance_company || "-"}</div>}
                    {t.key === "finance_cc" && (
                      <>
                        <div style={{ fontWeight: 600 }}>{r.finance_company || "-"}</div>
                        <div style={{ color: "#6b7280" }}>CC: {r.cc_min || 0} – {r.cc_max || "∞"}</div>
                      </>
                    )}
                    {t.key === "custom" && (
                      <>
                        <div style={{ fontWeight: 600 }}>{r.brand || ""} {r.model_code || "ทุกรุ่น"}</div>
                        <div style={{ color: "#6b7280" }}>สาขา: {r.branch_group || "all"}</div>
                      </>
                    )}
                    {r.effective_date && <div style={{ color: "#6b7280", fontSize: 10 }}>มีผล: {fmtDate(r.effective_date)}{r.end_date ? ` ถึง ${fmtDate(r.end_date)}` : ""}</div>}
                    {r.notes && <div style={{ color: "#9ca3af", fontSize: 10, fontStyle: "italic" }}>{r.notes}</div>}
                  </div>
                  <div style={{ textAlign: "right", minWidth: 90 }}>
                    <div style={{ fontWeight: 700, color: t.color, fontSize: 15 }}>+{fmt(r.markup_amount)}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 4, justifyContent: "flex-end" }}>
                      <button onClick={() => setEdit(r)} style={{ ...btnMini, background: "#f59e0b" }}>✏️</button>
                      <button onClick={() => del(r.id)} style={{ ...btnMini, background: "#dc2626" }}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {edit && (
        <div onClick={() => setEdit(null)} style={modalOv}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 560 }}>
            <h3 style={{ margin: "0 0 12px" }}>
              {edit.id ? "✏️ แก้ไข" : "+ เพิ่ม"} เงื่อนไขราคา · {TYPES.find(t => t.key === edit.markup_type)?.label}
            </h3>

            {/* Finance company (for finance + finance_cc) */}
            {(edit.markup_type === "finance" || edit.markup_type === "finance_cc") && (
              <Field label="บริษัทไฟแนนท์ *">
                <select value={edit.finance_company || ""} onChange={e => setEdit({ ...edit, finance_company: e.target.value })} style={inp}>
                  <option value="">-- เลือกบริษัทไฟแนนท์ --</option>
                  {financeCos.map(c => (
                    <option key={c.id || c.company_name} value={c.company_name}>{c.company_name}</option>
                  ))}
                </select>
              </Field>
            )}

            {/* CC range (for finance_cc) */}
            {edit.markup_type === "finance_cc" && (
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="CC ต่ำสุด">
                  <input type="number" value={edit.cc_min || ""} onChange={e => setEdit({ ...edit, cc_min: e.target.value })} style={inp} placeholder="เช่น 110" />
                </Field>
                <Field label="CC สูงสุด">
                  <input type="number" value={edit.cc_max || ""} onChange={e => setEdit({ ...edit, cc_max: e.target.value })} style={inp} placeholder="เช่น 125 (ว่าง = ไม่จำกัด)" />
                </Field>
              </div>
            )}

            {/* Custom: brand + model + branch */}
            {edit.markup_type === "custom" && (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <Field label="ยี่ห้อ">
                    <input value={edit.brand || ""} onChange={e => setEdit({ ...edit, brand: e.target.value })} style={inp} placeholder="เช่น Honda / Yamaha" />
                  </Field>
                  <Field label="รหัสรุ่น">
                    <input value={edit.model_code || ""} onChange={e => setEdit({ ...edit, model_code: e.target.value })} style={inp} placeholder="เช่น ACF125CAT (ว่าง = ทุกรุ่น)" />
                  </Field>
                </div>
                <Field label="กลุ่มสาขา">
                  <select value={edit.branch_group || "all"} onChange={e => setEdit({ ...edit, branch_group: e.target.value })} style={inp}>
                    <option value="all">ทั้งหมด</option>
                    <option value="singchai">สิงห์ชัย (SCY01/04/07)</option>
                    <option value="papao">ป.เปา (SCY05/06)</option>
                  </select>
                </Field>
              </>
            )}

            <Field label="ยอดบวกเพิ่ม (บาท) *">
              <input type="number" value={edit.markup_amount || ""} onChange={e => setEdit({ ...edit, markup_amount: e.target.value })} style={{ ...inp, fontWeight: 700, fontSize: 16 }} placeholder="เช่น 1000" />
            </Field>

            <div style={{ display: "flex", gap: 8 }}>
              <Field label="วันที่เริ่มมีผล">
                <input type="date" value={edit.effective_date || ""} onChange={e => setEdit({ ...edit, effective_date: e.target.value })} style={inp} />
              </Field>
              <Field label="วันที่สิ้นสุด">
                <input type="date" value={edit.end_date || ""} onChange={e => setEdit({ ...edit, end_date: e.target.value })} style={inp} />
              </Field>
            </div>

            <Field label="สถานะ">
              <select value={edit.status || "active"} onChange={e => setEdit({ ...edit, status: e.target.value })} style={inp}>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ไม่ใช้งาน</option>
              </select>
            </Field>

            <Field label="หมายเหตุ">
              <textarea value={edit.notes || ""} onChange={e => setEdit({ ...edit, notes: e.target.value })} style={{ ...inp, minHeight: 60 }} />
            </Field>

            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setEdit(null)} style={{ ...btnBlue, background: "#6b7280" }}>ยกเลิก</button>
              <button onClick={save} style={{ ...btnBlue, background: "#059669" }}>💾 บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10, flex: 1 }}>
      <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

const inp = { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, width: "100%", boxSizing: "border-box" };
const btnBlue = { padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
const btnMini = { padding: "2px 6px", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 };
const modalOv = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalBox = { background: "#fff", padding: 20, borderRadius: 10, width: "92%", maxHeight: "90vh", overflowY: "auto" };
