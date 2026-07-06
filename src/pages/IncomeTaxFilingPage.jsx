import React, { useEffect, useMemo, useState } from "react";

// ยื่นภาษีเงินได้นิติบุคคล ภ.ง.ด.50 (ทั้งปี) / ภ.ง.ด.51 (ครึ่งปี) — บันทึกการยื่น + จ่ายโอนจากบัญชี (ตัดยอดบัญชี)
// บันทึก/แก้ไข/ยกเลิก/ดูประวัติ · webhook income-tax-api (list/save/edit/cancel) + ตาราง income_tax_filings
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/income-tax-api";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

const AFFILIATIONS = ["ป.เปา", "สิงห์ชัย"];
const TAX_FORMS = ["ภ.ง.ด.50", "ภ.ง.ด.51"];
const PAY_METHODS = ["โอน", "เงินสด", "เช็ค"];

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function curBEYear() { return new Date().getFullYear() + 543; }

const EMPTY = () => ({
  tax_form: "ภ.ง.ด.51", tax_year: String(curBEYear()), affiliation: "ป.เปา",
  filing_date: todayISO(), amount: "", payment_method: "โอน", from_bank_account_id: "", note: "",
});

export default function IncomeTaxFilingPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY());
  const [editId, setEditId] = useState(null);
  const [filterYear, setFilterYear] = useState("");
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

  function startEdit(r) {
    setEditId(r.id);
    setForm({
      tax_form: r.tax_form || "ภ.ง.ด.51", tax_year: String(r.tax_year || curBEYear()),
      affiliation: r.affiliation || "ป.เปา", filing_date: String(r.filing_date || "").slice(0, 10) || todayISO(),
      amount: r.amount != null ? String(r.amount) : "", payment_method: r.payment_method || "โอน",
      from_bank_account_id: r.from_bank_account_id ? String(r.from_bank_account_id) : "", note: r.note || "",
    });
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function resetForm() { setEditId(null); setForm(EMPTY()); setMsg(""); }

  async function save() {
    if (!form.amount || Number(form.amount) <= 0) { setMsg("⚠️ ใส่ยอดภาษีที่จ่าย"); return; }
    if (form.payment_method === "โอน" && !form.from_bank_account_id) { setMsg("⚠️ เลือกบัญชีที่โอนจ่าย (ตัดยอดบัญชี)"); return; }
    if (!form.filing_date) { setMsg("⚠️ ใส่วันที่ยื่น/จ่าย"); return; }
    setSaving(true); setMsg("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editId ? "edit" : "save",
          id: editId || undefined,
          tax_form: form.tax_form, tax_year: Number(form.tax_year) || null, affiliation: form.affiliation,
          filing_date: form.filing_date, amount: Number(form.amount),
          payment_method: form.payment_method,
          from_bank_account_id: form.payment_method === "โอน" ? (Number(form.from_bank_account_id) || null) : null,
          note: form.note || null,
          created_by: currentUser?.name || currentUser?.username || "system",
        }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = Array.isArray(data) ? data[0] : data;
      if (ok?.success === false) throw new Error(ok?.error || "บันทึกล้มเหลว");
      setMsg(`✅ ${editId ? "แก้ไข" : "บันทึก"}การยื่น ${form.tax_form} แล้ว${ok?.doc_no ? ` (${ok.doc_no})` : ""}`);
      resetForm();
      fetchRows();
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setSaving(false);
  }

  async function cancelRow(r) {
    if (!window.confirm(`ยกเลิกการยื่น ${r.tax_form} ปี ${r.tax_year} (${r.doc_no})?\nยอด ${fmt(r.amount)} บาท — ยอดที่ตัดจากบัญชีจะถูกคืน`)) return;
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

  const yearOpts = useMemo(() => [...new Set(rows.map(r => String(r.tax_year)).filter(Boolean))].sort((a, b) => b.localeCompare(a)), [rows]);
  const filtered = useMemo(() => rows.filter(r => {
    if (!showCancelled && r.status === "cancelled") return false;
    if (filterYear && String(r.tax_year) !== filterYear) return false;
    return true;
  }), [rows, filterYear, showCancelled]);
  const sumAmount = filtered.filter(r => r.status !== "cancelled").reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🏛️ ยื่นภาษี ภ.ง.ด.50, 51 (ภาษีเงินได้นิติบุคคล)</h2>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: msg.startsWith("✅") ? "#d1fae5" : msg.startsWith("❌") ? "#fee2e2" : "#fffbeb",
          color: msg.startsWith("✅") ? "#065f46" : msg.startsWith("❌") ? "#991b1b" : "#92400e", fontSize: 14 }}>{msg}</div>
      )}

      {/* ---- ฟอร์มบันทึก/แก้ไข ---- */}
      <div style={{ background: "#fff", border: `1px solid ${editId ? "#f59e0b" : "#e5e7eb"}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: editId ? "#b45309" : "#072d6b", marginBottom: 12 }}>
          {editId ? "✏️ แก้ไขการยื่นภาษี" : "➕ บันทึกการยื่นภาษี"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <Field label="แบบภาษี *">
            <select value={form.tax_form} onChange={e => set("tax_form", e.target.value)} style={inp}>
              {TAX_FORMS.map(t => <option key={t} value={t}>{t}{t === "ภ.ง.ด.50" ? " (ทั้งปี)" : " (ครึ่งปี)"}</option>)}
            </select>
          </Field>
          <Field label="รอบปีภาษี (พ.ศ.) *">
            <input type="number" value={form.tax_year} onChange={e => set("tax_year", e.target.value)} style={inp} placeholder="2568" />
          </Field>
          <Field label="สังกัด *">
            <select value={form.affiliation} onChange={e => set("affiliation", e.target.value)} style={inp}>
              {AFFILIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="วันที่ยื่น/จ่าย *">
            <input type="date" value={form.filing_date} onChange={e => set("filing_date", e.target.value)} style={inp} />
          </Field>
          <Field label="ยอดภาษีที่จ่าย (บาท) *">
            <input type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} style={{ ...inp, textAlign: "right", fontWeight: 700 }} placeholder="0.00" />
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
            <input type="text" value={form.note} onChange={e => set("note", e.target.value)} style={inp} placeholder="เช่น กำไรสุทธิ / เลขอ้างอิงยื่น" />
          </Field>
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
          <option value="">📅 ทุกรอบปี</option>
          {yearOpts.map(y => <option key={y} value={y}>ปี {y}</option>)}
        </select>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} /> แสดงที่ยกเลิก
        </label>
        <button onClick={fetchRows} disabled={loading} style={btn("#0369a1")}>🔄 รีเฟรช</button>
        <div style={{ flex: 1 }} />
        <span>ยอดรวมที่ยื่น: <strong style={{ color: "#dc2626" }}>{fmt(sumAmount)}</strong> บาท</span>
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
                <th style={th}>แบบ</th>
                <th style={th}>รอบปี</th>
                <th style={th}>สังกัด</th>
                <th style={th}>วันที่ยื่น/จ่าย</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดจ่าย</th>
                <th style={th}>จ่ายจากบัญชี</th>
                <th style={th}>สถานะ</th>
                <th style={{ ...th, width: 120 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const cancelled = r.status === "cancelled";
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef2f7", background: cancelled ? "#fef2f2" : editId === r.id ? "#fffbeb" : "transparent", color: cancelled ? "#9ca3af" : "inherit" }}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: cancelled ? "#9ca3af" : "#065f46" }}>{r.doc_no || "-"}</td>
                    <td style={td}>{r.tax_form}</td>
                    <td style={td}>{r.tax_year}</td>
                    <td style={td}>{r.affiliation || "-"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.filing_date)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmt(r.amount)}</td>
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
