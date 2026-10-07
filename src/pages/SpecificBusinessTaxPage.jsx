import React, { useEffect, useMemo, useState } from "react";

// ยื่นภาษีธุรกิจเฉพาะ ภ.ธ.40 — บันทึกแบบที่ยื่นรายเดือน (รายรับ × อัตรา = ภาษี + เงินเพิ่ม/เบี้ยปรับ + ภาษีท้องถิ่น 10%)
// + จ่ายโอนจากบัญชี (ตัดยอดบัญชีในรายงานเคลื่อนไหวบัญชี ผ่าน CTE sbt_movements ใน Accounting API)
// บันทึก/แก้ไข/ยกเลิก/ดูประวัติ · webhook sbt-tax-api (list/save/edit/cancel) + ตาราง sbt_filings — โครงเดียวกับ IncomeTaxFilingPage (user 2026-10-07)
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/sbt-tax-api";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

const AFFILIATIONS = ["ป.เปา", "สิงห์ชัย"];
const FILING_TYPES = ["ยื่นปกติ", "ยื่นเพิ่มเติม"];
const PAY_METHODS = ["โอน", "เงินสด", "เช็ค"];
// ประเภทกิจการตามแบบ ภ.ธ.40 (ข้อ 7 คือเคสของเรา: ดอกเบี้ยเงินให้กู้ยืมกรรมการ/บริษัทในเครือ)
const BUSINESS_TYPES = [
  { code: "7", label: "7. การประกอบกิจการโดยปกติเยี่ยงธนาคารพาณิชย์ — ดอกเบี้ย ส่วนลด ค่าธรรมเนียม", rate: 3.0 },
  { code: "1", label: "1. การธนาคาร — ดอกเบี้ย ส่วนลด ค่าธรรมเนียม", rate: 3.0 },
  { code: "2", label: "2. การประกอบธุรกิจเงินทุน", rate: 3.0 },
  { code: "5", label: "5. การรับประกันชีวิต", rate: 2.5 },
  { code: "6", label: "6. การรับจำนำ", rate: 2.5 },
  { code: "8", label: "8. การขายอสังหาริมทรัพย์เป็นทางค้าหรือหากำไร", rate: 3.0 },
  { code: "10", label: "10. การประกอบธุรกิจแฟ็กเตอริง", rate: 3.0 },
];
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
// "2026-08" → "สิงหาคม 2569"
function fmtTaxMonth(ym) {
  const m = String(ym || "").match(/^(\d{4})-(\d{2})/);
  if (!m) return ym || "-";
  return `${THAI_MONTHS[Number(m[2]) - 1] || m[2]} ${Number(m[1]) + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function prevMonthISO() { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

const EMPTY = () => ({
  affiliation: "ป.เปา", tax_month: prevMonthISO(), filing_type: "ยื่นปกติ", business_type: "7",
  revenue: "", tax_rate: "3.0", surcharge: "", penalty: "",
  receipt_no: "", ref_no: "", filing_date: todayISO(),
  payment_method: "โอน", from_bank_account_id: "", note: "",
});

// คำนวณตามแบบ ภ.ธ.40: 12 ภาษี = รายรับ×อัตรา · 15 รวม = 12+13+14 · 16 ท้องถิ่น = 10% ของ 15 · 17 รวมทั้งสิ้น = 15+16
function calc(f) {
  const revenue = Number(f.revenue) || 0;
  const rate = Number(f.tax_rate) || 0;
  const tax = r2(revenue * rate / 100);
  const surcharge = r2(f.surcharge);
  const penalty = r2(f.penalty);
  const subtotal = r2(tax + surcharge + penalty);
  const local = r2(subtotal * 0.10);
  const total = r2(subtotal + local);
  return { revenue, rate, tax, surcharge, penalty, subtotal, local, total };
}

export default function SpecificBusinessTaxPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY());
  const [editId, setEditId] = useState(null);
  const [filterYear, setFilterYear] = useState("");
  const [filterAff, setFilterAff] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { fetchBankAccounts(); fetchRows(); /* eslint-disable-next-line */ }, []);

  async function fetchBankAccounts() {
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
      });
      const data = await res.json();
      setBankAccounts(Array.isArray(data) ? data : []);
    } catch { setBankAccounts([]); }
  }

  async function fetchRows() {
    setLoading(true); setMsg("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const data = await res.json();
      setRows((Array.isArray(data) ? data : (data?.rows || [])).filter(r => r && r.id));
    } catch (e) {
      setMsg("❌ โหลดข้อมูลไม่สำเร็จ: " + e.message);
      setRows([]);
    }
    setLoading(false);
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const c = calc(form);

  function startEdit(r) {
    setEditId(r.id);
    setForm({
      affiliation: r.affiliation || "ป.เปา", tax_month: String(r.tax_month || "").slice(0, 7) || prevMonthISO(),
      filing_type: r.filing_type || "ยื่นปกติ", business_type: String(r.business_type || "7"),
      revenue: r.revenue != null ? String(r.revenue) : "", tax_rate: r.tax_rate != null ? String(r.tax_rate) : "3.0",
      surcharge: Number(r.surcharge) ? String(r.surcharge) : "", penalty: Number(r.penalty) ? String(r.penalty) : "",
      receipt_no: r.receipt_no || "", ref_no: r.ref_no || "", filing_date: String(r.filing_date || "").slice(0, 10) || todayISO(),
      payment_method: r.payment_method || "โอน", from_bank_account_id: r.from_bank_account_id ? String(r.from_bank_account_id) : "", note: r.note || "",
    });
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function resetForm() { setEditId(null); setForm(EMPTY()); setMsg(""); }

  async function save() {
    if (!form.tax_month) { setMsg("⚠️ เลือกเดือนภาษี"); return; }
    if (!(c.revenue > 0)) { setMsg("⚠️ ใส่จำนวนเงินรายรับ (ฐานภาษี)"); return; }
    if (!(c.total > 0)) { setMsg("⚠️ ยอดภาษีรวมทั้งสิ้นต้องมากกว่า 0"); return; }
    if (form.payment_method === "โอน" && !form.from_bank_account_id) { setMsg("⚠️ เลือกบัญชีที่โอนจ่าย (ตัดยอดบัญชี)"); return; }
    if (!form.filing_date) { setMsg("⚠️ ใส่วันที่ยื่น/จ่าย"); return; }
    // กันยื่นซ้ำเดือนเดียวกัน (ยื่นปกติ) สังกัดเดียวกัน
    const dup = rows.find(r => r.status !== "cancelled" && r.id !== editId && r.affiliation === form.affiliation
      && String(r.tax_month || "").slice(0, 7) === form.tax_month && (r.filing_type || "ยื่นปกติ") === "ยื่นปกติ" && form.filing_type === "ยื่นปกติ");
    if (dup && !window.confirm(`เดือน ${fmtTaxMonth(form.tax_month)} สังกัด ${form.affiliation} มีการยื่นปกติแล้ว (${dup.doc_no})\nบันทึกซ้ำอีกใบ?`)) return;
    setSaving(true); setMsg("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editId ? "edit" : "save",
          id: editId || undefined,
          affiliation: form.affiliation, tax_month: form.tax_month + "-01", filing_type: form.filing_type, business_type: form.business_type,
          revenue: c.revenue, tax_rate: c.rate, tax_amount: c.tax, surcharge: c.surcharge, penalty: c.penalty,
          local_tax: c.local, total_amount: c.total,
          receipt_no: form.receipt_no || null, ref_no: form.ref_no || null, filing_date: form.filing_date,
          payment_method: form.payment_method,
          from_bank_account_id: form.payment_method === "โอน" ? (Number(form.from_bank_account_id) || null) : null,
          note: form.note || null,
          created_by: currentUser?.name || currentUser?.username || "system",
        }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = Array.isArray(data) ? data[0] : data;
      if (ok?.success === false) throw new Error(ok?.error || "บันทึกล้มเหลว");
      if (!ok?.doc_no) throw new Error("workflow ยังไม่รองรับ — import Specific_Business_Tax_API_Workflow.json ก่อน");
      setMsg(`✅ ${editId ? "แก้ไข" : "บันทึก"}การยื่น ภ.ธ.40 เดือน ${fmtTaxMonth(form.tax_month)} ${form.affiliation} แล้ว (${ok.doc_no}) ยอดรวม ${fmt(c.total)} บาท`);
      resetForm();
      fetchRows();
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setSaving(false);
  }

  async function cancelRow(r) {
    if (!window.confirm(`ยกเลิกการยื่น ภ.ธ.40 เดือน ${fmtTaxMonth(r.tax_month)} ${r.affiliation} (${r.doc_no})?\nยอด ${fmt(r.total_amount)} บาท — ยอดที่ตัดจากบัญชีจะถูกคืน`)) return;
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", id: r.id, cancelled_by: currentUser?.name || currentUser?.username || "system" }),
      });
      await res.text();
      setMsg(`✅ ยกเลิก ${r.doc_no} แล้ว`);
      if (editId === r.id) resetForm();
      fetchRows();
    } catch (e) { setMsg("❌ ยกเลิกไม่สำเร็จ: " + e.message); }
  }

  const bankLabel = (id) => {
    const a = bankAccounts.find(b => Number(b.account_id) === Number(id));
    return a ? `${a.bank_name} · ${a.account_no}` : "-";
  };
  const beYearOf = (ym) => { const m = String(ym || "").match(/^(\d{4})/); return m ? String(Number(m[1]) + 543) : ""; };

  const yearOpts = useMemo(() => [...new Set(rows.map(r => beYearOf(r.tax_month)).filter(Boolean))].sort((a, b) => b.localeCompare(a)), [rows]);
  const filtered = useMemo(() => rows.filter(r => {
    if (!showCancelled && r.status === "cancelled") return false;
    if (filterYear && beYearOf(r.tax_month) !== filterYear) return false;
    if (filterAff && r.affiliation !== filterAff) return false;
    return true;
  }), [rows, filterYear, filterAff, showCancelled]);
  const active = filtered.filter(r => r.status !== "cancelled");
  const sumRevenue = active.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const sumTotal = active.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🏦 ยื่นภาษีธุรกิจเฉพาะ ภ.ธ.40</h2>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: msg.startsWith("✅") ? "#d1fae5" : msg.startsWith("❌") ? "#fee2e2" : "#fffbeb",
          color: msg.startsWith("✅") ? "#065f46" : msg.startsWith("❌") ? "#991b1b" : "#92400e", fontSize: 14 }}>{msg}</div>
      )}

      {/* ---- ฟอร์มบันทึก/แก้ไข ---- */}
      <div style={{ background: "#fff", border: `1px solid ${editId ? "#f59e0b" : "#e5e7eb"}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: editId ? "#b45309" : "#072d6b", marginBottom: 12 }}>
          {editId ? "✏️ แก้ไขแบบ ภ.ธ.40" : "➕ บันทึกแบบ ภ.ธ.40 ที่ยื่น"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <Field label="ผู้ประกอบกิจการ (สังกัด) *">
            <select value={form.affiliation} onChange={e => set("affiliation", e.target.value)} style={inp}>
              {AFFILIATIONS.map(a => <option key={a} value={a}>{a === "ป.เปา" ? "บจก.ป.เปา มอเตอร์เซอร์วิส" : "หจก.สิงห์ชัยสยามยนต์"}</option>)}
            </select>
          </Field>
          <Field label="เดือนภาษี *">
            <input type="month" value={form.tax_month} onChange={e => set("tax_month", e.target.value)} style={inp} />
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{fmtTaxMonth(form.tax_month)}</div>
          </Field>
          <Field label="ประเภทการยื่น">
            <select value={form.filing_type} onChange={e => set("filing_type", e.target.value)} style={inp}>
              {FILING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="วันที่ยื่น/จ่าย *">
            <input type="date" value={form.filing_date} onChange={e => set("filing_date", e.target.value)} style={inp} />
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="ประเภทกิจการ / ประเภทรายรับ">
              <select value={form.business_type} onChange={e => { const bt = BUSINESS_TYPES.find(x => x.code === e.target.value); setForm(f => ({ ...f, business_type: e.target.value, tax_rate: bt ? String(bt.rate) : f.tax_rate })); }} style={inp}>
                {BUSINESS_TYPES.map(t => <option key={t.code} value={t.code}>{t.label} (อัตรา {t.rate}%)</option>)}
              </select>
            </Field>
          </div>
          <Field label="จำนวนเงินรายรับ (ฐานภาษี) *">
            <input type="number" step="0.01" value={form.revenue} onChange={e => set("revenue", e.target.value)} style={{ ...inp, textAlign: "right", fontWeight: 700 }} placeholder="0.00" />
          </Field>
          <Field label="อัตราภาษี (ร้อยละ)">
            <input type="number" step="0.01" value={form.tax_rate} onChange={e => set("tax_rate", e.target.value)} style={{ ...inp, textAlign: "right" }} />
          </Field>
          <Field label="13. เงินเพิ่ม (ถ้ามี)">
            <input type="number" step="0.01" value={form.surcharge} onChange={e => set("surcharge", e.target.value)} style={{ ...inp, textAlign: "right" }} placeholder="0.00" />
          </Field>
          <Field label="14. เบี้ยปรับ (ถ้ามี)">
            <input type="number" step="0.01" value={form.penalty} onChange={e => set("penalty", e.target.value)} style={{ ...inp, textAlign: "right" }} placeholder="0.00" />
          </Field>
          <Field label="เลขที่ใบเสร็จสรรพากร">
            <input type="text" value={form.receipt_no} onChange={e => set("receipt_no", e.target.value)} style={inp} placeholder="เช่น 69180697641" />
          </Field>
          <Field label="หมายเลขอ้างอิงแบบ">
            <input type="text" value={form.ref_no} onChange={e => set("ref_no", e.target.value)} style={inp} placeholder="เช่น P400001567436" />
          </Field>
          <Field label="วิธีจ่าย">
            <select value={form.payment_method} onChange={e => set("payment_method", e.target.value)} style={inp}>
              {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          {form.payment_method === "โอน" && (
            <Field label="จ่ายจากบัญชี (ตัดยอด) *">
              <select value={form.from_bank_account_id} onChange={e => set("from_bank_account_id", e.target.value)} style={inp}>
                <option value="">— เลือกบัญชี —</option>
                {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
              </select>
            </Field>
          )}
          <Field label="หมายเหตุ">
            <input type="text" value={form.note} onChange={e => set("note", e.target.value)} style={inp} placeholder="เช่น ดอกเบี้ยเงินให้กู้ยืมกรรมการ" />
          </Field>
        </div>

        {/* สรุปการคำนวณตามแบบ */}
        <div style={{ marginTop: 14, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", maxWidth: 520 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#072d6b", marginBottom: 6 }}>🧮 คำนวณตามแบบ ภ.ธ.40</div>
          <CalcRow label={`12. ภาษีธุรกิจเฉพาะ = รายรับ ${fmt(c.revenue)} × ${c.rate}%`} value={c.tax} />
          <CalcRow label="13. เงินเพิ่ม" value={c.surcharge} muted={!c.surcharge} />
          <CalcRow label="14. เบี้ยปรับ" value={c.penalty} muted={!c.penalty} />
          <CalcRow label="15. รวม (12 + 13 + 14)" value={c.subtotal} bold />
          <CalcRow label="16. รายได้ส่วนท้องถิ่น 10% ของข้อ 15" value={c.local} />
          <CalcRow label="17. รวมภาษีทั้งสิ้น (15 + 16)" value={c.total} bold color="#dc2626" />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          {editId && <button onClick={resetForm} style={{ ...btn("#e5e7eb"), color: "#374151" }}>ยกเลิกแก้ไข</button>}
          <button onClick={save} disabled={saving} style={btn(saving ? "#9ca3af" : "#15803d")}>
            {saving ? "💾 ..." : editId ? "💾 บันทึกแก้ไข" : "💾 บันทึกการยื่น"}
          </button>
        </div>
      </div>

      {/* ---- ประวัติการยื่น ---- */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, color: "#072d6b" }}>📜 ประวัติการยื่น</span>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={inp}>
          <option value="">📅 ทุกปี</option>
          {yearOpts.map(y => <option key={y} value={y}>ปี {y}</option>)}
        </select>
        <select value={filterAff} onChange={e => setFilterAff(e.target.value)} style={inp}>
          <option value="">🏢 ทุกสังกัด</option>
          {AFFILIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} /> แสดงที่ยกเลิก
        </label>
        <button onClick={fetchRows} disabled={loading} style={btn("#0369a1")}>🔄 รีเฟรช</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13 }}>รายรับรวม <strong>{fmt(sumRevenue)}</strong> · ภาษีรวมทั้งสิ้น <strong style={{ color: "#dc2626" }}>{fmt(sumTotal)}</strong> บาท ({active.length} ใบ)</span>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีประวัติการยื่น</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>เลขที่</th>
                <th style={th}>เดือนภาษี</th>
                <th style={th}>สังกัด</th>
                <th style={th}>ประเภท</th>
                <th style={{ ...th, textAlign: "right" }}>รายรับ</th>
                <th style={{ ...th, textAlign: "right" }}>ภาษี</th>
                <th style={{ ...th, textAlign: "right" }}>เพิ่ม/ปรับ</th>
                <th style={{ ...th, textAlign: "right" }}>ท้องถิ่น</th>
                <th style={{ ...th, textAlign: "right" }}>รวมทั้งสิ้น</th>
                <th style={th}>วันที่ยื่น</th>
                <th style={th}>ใบเสร็จ</th>
                <th style={th}>จ่ายจากบัญชี</th>
                <th style={th}>สถานะ</th>
                <th style={{ ...th, width: 120 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const cancelled = r.status === "cancelled";
                const extra = Number(r.surcharge || 0) + Number(r.penalty || 0);
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef2f7", background: cancelled ? "#fef2f2" : editId === r.id ? "#fffbeb" : "transparent", color: cancelled ? "#9ca3af" : "inherit" }}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: cancelled ? "#9ca3af" : "#065f46" }}>{r.doc_no || "-"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtTaxMonth(r.tax_month)}</td>
                    <td style={td}>{r.affiliation || "-"}</td>
                    <td style={{ ...td, fontSize: 12 }}>{r.filing_type || "ยื่นปกติ"}<div style={{ color: "#6b7280", fontSize: 11 }}>ข้อ {r.business_type || "7"} · {fmt(r.tax_rate)}%</div></td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.revenue)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.tax_amount)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: extra ? "#b45309" : "#9ca3af" }}>{extra ? fmt(extra) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.local_tax)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: cancelled ? "#9ca3af" : "#dc2626" }}>{fmt(r.total_amount)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.filing_date)}</td>
                    <td style={{ ...td, fontSize: 12, fontFamily: "monospace" }}>{r.receipt_no || "-"}{r.ref_no ? <div style={{ color: "#6b7280", fontSize: 11 }}>{r.ref_no}</div> : null}</td>
                    <td style={{ ...td, fontSize: 12 }}>{r.payment_method === "โอน" ? bankLabel(r.from_bank_account_id) : (r.payment_method || "-")}</td>
                    <td style={td}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: cancelled ? "#fee2e2" : "#d1fae5", color: cancelled ? "#991b1b" : "#065f46" }}>
                        {cancelled ? "ยกเลิก" : "ยื่นแล้ว"}
                      </span>
                    </td>
                    <td style={td}>
                      {!cancelled && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => startEdit(r)} style={{ ...btnSm, background: "#0369a1" }}>✏️ แก้ไข</button>
                          <button onClick={() => cancelRow(r)} style={{ ...btnSm, background: "#dc2626" }}>✕ ยกเลิก</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ fontSize: 12, color: "#64748b", marginTop: 10, lineHeight: 1.6 }}>
        * ภาษีธุรกิจเฉพาะคิดจาก "รายรับ" ก่อนหักรายจ่าย อัตรา 3% บวกรายได้ส่วนท้องถิ่น 10% ของภาษี (รวม 3.3%) · ยื่น ภ.ธ.40 ภายในวันที่ 15 ของเดือนถัดไป เฉพาะเดือนที่มีรายรับ
        · กรณีของเราคือดอกเบี้ยเงินให้กู้ยืมกรรมการ/บริษัทในเครือ (ข้อ 7 ประกอบกิจการเยี่ยงธนาคารพาณิชย์)
      </div>
    </div>
  );
}

function CalcRow({ label, value, bold, muted, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0", fontSize: 13, fontWeight: bold ? 700 : 400, color: muted ? "#9ca3af" : (color || "#1f2937") }}>
      <span>{label}</span>
      <span style={{ fontFamily: "monospace" }}>{fmt(value)}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const inp = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "9px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 13, verticalAlign: "top" };
const btn = (color) => ({ padding: "8px 16px", background: color, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 });
const btnSm = { padding: "4px 10px", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 };
