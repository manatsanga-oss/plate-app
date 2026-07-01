import React, { useEffect, useMemo, useState } from "react";
import TaxRemittanceRecordPage from "./TaxRemittanceRecordPage";

// เตรียมแบบภาษีรายเดือน — ตารางบันทึกแบบภาษีต่อรอบเดือน (list) + กด "สร้างใหม่"/"แก้ไข" เข้าหน้าเลือกใบกำกับ (form)
// ภาษีซื้อ: ดึงจาก input-tax-api (list_input_tax); บันทึก record: actions list_tax_filings / save_tax_filing / delete_tax_filing
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/input-tax-api";

const SOURCE_META = {
  vehicle: { label: "รถ", color: "#1e40af", bg: "#dbeafe" },
  part: { label: "อะไหล่", color: "#92400e", bg: "#fef3c7" },
  expense: { label: "ค่าใช้จ่าย", color: "#065f46", bg: "#d1fae5" },
  fuel: { label: "ค่าน้ำมัน", color: "#9a3412", bg: "#ffedd5" },
  theft: { label: "ประกันรถหาย", color: "#9d174d", bg: "#fce7f3" },
};
const NO_INVOICE_STATUS = "ยังไม่ได้รับใบกำกับภาษี";
const RECEIVED_STATUS = "รับใบกำกับภาษีแล้ว";
const STATUS_STYLE = {
  [RECEIVED_STATUS]: { bg: "#dbeafe", color: "#1e40af" },
  [NO_INVOICE_STATUS]: { bg: "#ffedd5", color: "#9a3412" },
};
const AFFILIATIONS = ["ป.เปา", "สิงห์ชัย"];
const TAX_FORMS = ["ภ.พ.30", "ภ.พ.36"];
const FILING_TYPES = ["ยื่นปกติ", "ยื่นเพิ่มเติม"];
const FILING_STATUSES = ["ร่าง", "รอชำระ", "ชำระภาษีแล้ว"];
const FSTATUS_STYLE = {
  "ร่าง": { bg: "#f3f4f6", color: "#6b7280" },
  "รอชำระ": { bg: "#fef3c7", color: "#92400e" },
  "ชำระภาษีแล้ว": { bg: "#dcfce7", color: "#166534" },
};

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}
function curMonth() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; }
function monthDisplay(ym) { if (!ym) return "-"; const [y, m] = String(ym).split("-"); return `${m}-${y}`; }
function validityHint(docDateISO, filingYM) {
  const d = new Date(docDateISO);
  if (isNaN(d) || !filingYM) return null;
  const docIdx = d.getFullYear() * 12 + d.getMonth();
  const [fy, fm] = filingYM.split("-").map(Number);
  const filingIdx = fy * 12 + (fm - 1);
  if (filingIdx <= docIdx) return null;
  const validUntil = docIdx + 6;
  if (filingIdx > validUntil) return { t: "หมดอายุแล้ว", c: "#dc2626" };
  const vy = Math.floor(validUntil / 12), vm = (validUntil % 12) + 1;
  return { t: `ใช้ภายใน ${String(vm).padStart(2, "0")}-${vy}`, c: "#b45309" };
}
function parseKeys(v) { if (Array.isArray(v)) return v; if (typeof v === "string") { try { return JSON.parse(v || "[]"); } catch { return []; } } return []; }

export default function TaxFormMonthlyPage({ currentUser }) {
  const [mode, setMode] = useState("list"); // list | form
  // ---- list ----
  const [records, setRecords] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [tab, setTab] = useState("all"); // all | ภ.พ.30 | ภ.พ.36
  const [filterAff, setFilterAff] = useState(""); // ตัวกรองสังกัด (list)
  const [recMsg, setRecMsg] = useState("");
  // ---- form ----
  const [editingId, setEditingId] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(curMonth());
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [affiliation, setAffiliation] = useState("ป.เปา"); // สังกัดของแบบภาษี (form)
  const [selected, setSelected] = useState({});
  const [pendingKeys, setPendingKeys] = useState(null); // คีย์ที่จะ restore หลังโหลด (ตอนแก้ไข)
  const [salesVatStr, setSalesVatStr] = useState("0");
  const [taxForm, setTaxForm] = useState("ภ.พ.30");
  const [filingType, setFilingType] = useState("ยื่นปกติ");
  const [paymentDate, setPaymentDate] = useState("");
  const [status, setStatus] = useState("ร่าง");
  const [formMsg, setFormMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (mode === "list") fetchRecords(); /* eslint-disable-next-line */ }, [mode]);
  useEffect(() => { if (mode === "form" && month) fetchInvoices(); /* eslint-disable-next-line */ }, [month, mode]);

  // ================= LIST =================
  async function fetchRecords() {
    setRecLoading(true); setRecMsg("");
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_tax_filings" }) });
      const data = await res.json();
      setRecords((Array.isArray(data) ? data : (data?.rows || [])).filter(r => r && r.id));
    } catch (e) { setRecords([]); setRecMsg("❌ โหลดรายการไม่สำเร็จ: " + e.message); }
    setRecLoading(false);
  }
  function openCreate() {
    setEditingId(null); setMonth(curMonth()); setSalesVatStr("0"); setSelected({}); setPendingKeys(null);
    setTaxForm("ภ.พ.30"); setFilingType("ยื่นปกติ"); setPaymentDate(""); setStatus("ร่าง"); setFormMsg("");
    setAffiliation(filterAff || "ป.เปา");
    setMode("form");
  }
  function openEdit(r) {
    setEditingId(r.id); setAffiliation(r.affiliation || "ป.เปา"); setTaxForm(r.tax_form || "ภ.พ.30"); setFilingType(r.filing_type || "ยื่นปกติ");
    setPaymentDate(r.payment_date ? String(r.payment_date).slice(0, 10) : ""); setStatus(r.status || "ร่าง");
    setSalesVatStr(String(Number(r.sales_vat) || 0)); setSelected({}); setPendingKeys(parseKeys(r.selected_keys));
    setFormMsg(""); setMonth(r.filing_month || curMonth()); setMode("form");
  }
  async function deleteRecord(r) {
    if (!window.confirm(`ลบแบบภาษีรอบ ${monthDisplay(r.filing_month)} (${r.tax_form})?`)) return;
    try {
      await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_tax_filing", id: r.id }) });
      setRecMsg("✅ ลบแล้ว"); fetchRecords();
    } catch (e) { setRecMsg("❌ ลบไม่สำเร็จ: " + e.message); }
  }
  async function changeRecordStatus(r, newStatus) {
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_tax_filing", id: r.id, filing_month: r.filing_month, tax_form: r.tax_form, filing_type: r.filing_type, payment_date: r.payment_date, sales_vat: r.sales_vat, purchase_vat: r.purchase_vat, payable: r.payable, status: newStatus, selected_keys: parseKeys(r.selected_keys), note: r.note }),
      });
      fetchRecords();
    } catch (e) { setRecMsg("❌ อัปเดตสถานะไม่สำเร็จ: " + e.message); }
  }

  // ================= FORM (invoices) =================
  async function fetchInvoices() {
    setLoading(true); setFormMsg("");
    try {
      const ym = month ? month.replace("-", "") : null;
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_input_tax", year_month: ym }) });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : (data?.rows || []));
    } catch (e) { setRows([]); setFormMsg("❌ โหลดใบกำกับไม่สำเร็จ: " + e.message); }
    setLoading(false);
  }

  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((r, i) => {
      const gk = `${r.source}|${r.affiliation || ""}|${r.doc_no || ("row" + i)}`;
      let g = map.get(gk);
      if (!g) { g = { key: gk, source: r.source, affiliation: r.affiliation, doc_date: r.doc_date, doc_no: r.doc_no, vendor_name: r.vendor_name, amount_before_vat: 0, vat_amount: 0, count: 0 }; map.set(gk, g); }
      g.amount_before_vat += Number(r.amount_before_vat) || 0;
      g.vat_amount += Number(r.vat_amount) || 0;
      g.count += 1;
    });
    return [...map.values()];
  }, [rows]);

  const statusOf = (g) => (Number(g.amount_before_vat || 0) === 0 ? NO_INVOICE_STATUS : RECEIVED_STATUS);
  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return groups.filter(g => {
      if (statusOf(g) === NO_INVOICE_STATUS) return false;
      if (affiliation && String(g.affiliation || "") !== affiliation) return false; // เฉพาะสังกัดของแบบภาษี
      if (filterSource && g.source !== filterSource) return false;
      if (!kw) return true;
      return [g.doc_no, g.vendor_name].filter(Boolean).join(" ").toLowerCase().includes(kw);
    });
    /* eslint-disable-next-line */
  }, [groups, search, filterSource, affiliation]);

  // restore selection ตอนแก้ไข (หลัง groups พร้อม)
  useEffect(() => {
    if (pendingKeys && groups.length) {
      const set = new Set(pendingKeys);
      const next = {};
      groups.forEach(g => { if (set.has(g.key)) next[g.key] = true; });
      setSelected(next); setPendingKeys(null);
    }
  }, [groups, pendingKeys]);

  const selectedGroups = filtered.filter(g => selected[g.key]);
  const selVat = selectedGroups.reduce((s, g) => s + Number(g.vat_amount || 0), 0);
  const selBase = selectedGroups.reduce((s, g) => s + Number(g.amount_before_vat || 0), 0);
  const salesVat = Number(salesVatStr) || 0;
  const payable = salesVat - selVat;
  const allSelected = filtered.length > 0 && filtered.every(g => selected[g.key]);
  function toggleAll() { if (allSelected) setSelected({}); else { const n = {}; filtered.forEach(g => n[g.key] = true); setSelected(n); } }
  function toggle(key) { setSelected(p => ({ ...p, [key]: !p[key] })); }

  async function saveFiling() {
    setSaving(true); setFormMsg("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_tax_filing", id: editingId || undefined,
          filing_month: month, affiliation, tax_form: taxForm, filing_type: filingType, payment_date: paymentDate || null,
          sales_vat: salesVat, purchase_vat: selVat, payable, status,
          selected_keys: selectedGroups.map(g => g.key),
        }),
      });
      const d = await res.json().catch(() => ({}));
      const ok = Array.isArray(d) ? d[0] : (d?.rows ? d.rows[0] : d);
      if (ok?.error) throw new Error(ok.error);
      setMode("list");
    } catch (e) { setFormMsg("❌ บันทึกไม่สำเร็จ: " + e.message); }
    setSaving(false);
  }

  // ================= RENDER: LIST =================
  if (mode === "list") {
    const recs = records.filter(r => (tab === "all" || r.tax_form === tab) && (!filterAff || String(r.affiliation || "") === filterAff));
    return (
      <div className="page-container">
        <div className="page-topbar" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="page-title" style={{ margin: 0 }}>📄 เตรียมแบบภาษีรายเดือน</h2>
          <div style={{ flex: 1 }} />
          {tab !== "ภ.พ.36" && <button onClick={openCreate} style={{ ...btn, background: "#16a34a" }}>➕ สร้างใหม่</button>}
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          {[["all", "แสดงทั้งหมด"], ["ภ.พ.30", "ภ.พ.30"], ["ภ.พ.36", "ภ.พ.36"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ ...chip, background: tab === k ? "#2563eb" : "#e5e7eb", color: tab === k ? "#fff" : "#374151" }}>{l}</button>
          ))}
          <div style={{ flex: 1 }} />
          {tab !== "ภ.พ.36" && <>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>🏢 สังกัด:</label>
            <select value={filterAff} onChange={e => setFilterAff(e.target.value)} style={inp}>
              <option value="">ทั้งหมด</option>
              {AFFILIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </>}
        </div>
        {recMsg && <div style={{ padding: "8px 12px", marginBottom: 10, borderRadius: 8, fontSize: 13, background: recMsg.startsWith("✅") ? "#f0fdf4" : "#fef2f2", color: recMsg.startsWith("✅") ? "#166534" : "#991b1b" }}>{recMsg}</div>}

        {tab === "ภ.พ.36" ? (
          <TaxRemittanceRecordPage currentUser={currentUser} lockTaxType="ภ.พ.36" />
        ) : (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#2563eb", color: "#fff" }}>
              <tr>
                <th style={th}>วันที่ชำระภาษี</th>
                <th style={th}>สังกัด</th>
                <th style={th}>เดือนที่ยื่นแบบภาษี</th>
                <th style={th}>แบบฟอร์มภาษี</th>
                <th style={{ ...th, textAlign: "right" }}>มูลค่าภาษีขาย</th>
                <th style={{ ...th, textAlign: "right" }}>มูลค่าภาษีซื้อ</th>
                <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
                <th style={{ ...th, width: 90, textAlign: "center" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {recLoading ? (
                <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
              ) : recs.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีแบบภาษี — กด "สร้างใหม่"</td></tr>
              ) : recs.map(r => {
                const ss = FSTATUS_STYLE[r.status] || FSTATUS_STYLE["ร่าง"];
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{fmtDate(r.payment_date)}</td>
                    <td style={td}>{r.affiliation || "-"}</td>
                    <td style={td}><b>{monthDisplay(r.filing_month)}</b> <span style={{ color: "#6b7280" }}>({r.filing_type || "ยื่นปกติ"})</span></td>
                    <td style={td}>{r.tax_form || "ภ.พ.30"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.sales_vat)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.purchase_vat)}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <select value={r.status || "ร่าง"} onChange={e => changeRecordStatus(r, e.target.value)}
                        style={{ ...inp, padding: "5px 8px", background: ss.bg, color: ss.color, fontWeight: 600, border: "none" }}>
                        {FILING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                      <button onClick={() => openEdit(r)} style={{ ...miniBtn, background: "#dbeafe", color: "#1e40af" }}>✏️</button>
                      <button onClick={() => deleteRecord(r)} style={{ ...miniBtn, background: "#fee2e2", color: "#b91c1c" }}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>
    );
  }

  // ================= RENDER: FORM =================
  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>📄 {editingId ? "แก้ไขแบบยื่น" : "เตรียมแบบยื่น"} {taxForm}</h2>
        <div style={{ flex: 1 }} />
        <button onClick={() => setMode("list")} style={{ ...btn, background: "#e5e7eb", color: "#374151" }}>✕ ปิด</button>
        <button onClick={saveFiling} disabled={saving} style={{ ...btn, background: saving ? "#9ca3af" : "#16a34a" }}>{saving ? "💾 ..." : "💾 บันทึก"}</button>
      </div>

      {/* หัวฟอร์ม */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 12 }}>
        <div><label style={lbl}>📅 รอบเดือนที่ยื่น</label><input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inp} /></div>
        <div><label style={lbl}>🏢 สังกัด</label><select value={affiliation} onChange={e => setAffiliation(e.target.value)} style={inp}>{AFFILIATIONS.map(a => <option key={a}>{a}</option>)}</select></div>
        <div><label style={lbl}>แบบฟอร์มภาษี</label><select value={taxForm} onChange={e => setTaxForm(e.target.value)} style={inp}>{TAX_FORMS.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label style={lbl}>ประเภทยื่น</label><select value={filingType} onChange={e => setFilingType(e.target.value)} style={inp}>{FILING_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label style={lbl}>วันที่ชำระภาษี</label><input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} style={inp} /></div>
        <div><label style={lbl}>สถานะ</label><select value={status} onChange={e => setStatus(e.target.value)} style={inp}>{FILING_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
        <div style={{ flex: 1 }} />
        <div style={kpi}><div style={kpiLbl}>มูลค่าภาษีขาย</div><input type="number" value={salesVatStr} onChange={e => setSalesVatStr(e.target.value)} style={{ ...inp, width: 120, textAlign: "right", fontWeight: 700 }} /></div>
        <div style={kpi}><div style={kpiLbl}>ภาษีซื้อที่เลือก <b>{selectedGroups.length}</b></div><div style={{ ...kpiVal, color: "#1d4ed8" }}>{fmt(selVat)}</div></div>
        <div style={kpi}><div style={kpiLbl}>{payable >= 0 ? "ภาษีที่ต้องชำระ" : "ขอคืน/ยกไป"}</div><div style={{ ...kpiVal, color: payable >= 0 ? "#dc2626" : "#16a34a" }}>{fmt(Math.abs(payable))}</div></div>
      </div>

      {/* ตัวกรองใบกำกับ */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={inp}>
          <option value="">📂 ประเภท: ทั้งหมด</option>
          {Object.entries(SOURCE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔎 เลขที่ / ผู้จำหน่าย" style={{ ...inp, flex: 1, minWidth: 200 }} />
        <button onClick={fetchInvoices} disabled={loading} style={{ ...btn, background: "#0369a1" }}>🔄 รีเฟรช</button>
      </div>
      {formMsg && <div style={{ padding: "8px 12px", marginBottom: 10, borderRadius: 8, fontSize: 13, background: "#fef2f2", color: "#991b1b" }}>{formMsg}</div>}

      {/* ตารางใบกำกับซื้อ */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#2563eb", color: "#fff" }}>
            <tr>
              <th style={{ ...th, width: 36, textAlign: "center" }}><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th style={th}>วันที่ใบกำกับภาษี</th>
              <th style={th}>เลขที่ใบกำกับภาษี</th>
              <th style={th}>ชื่อผู้จำหน่าย</th>
              <th style={{ ...th, textAlign: "right" }}>มูลค่า / ภาษีมูลค่าเพิ่ม</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีใบกำกับภาษีในรอบเดือนนี้</td></tr>
            ) : filtered.map(g => {
              const sm = SOURCE_META[g.source] || { label: g.source, color: "#374151", bg: "#e5e7eb" };
              const hint = validityHint(g.doc_date, month);
              const isSel = !!selected[g.key];
              return (
                <tr key={g.key} style={{ borderTop: "1px solid #e5e7eb", background: isSel ? "#eff6ff" : "transparent" }}>
                  <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={isSel} onChange={() => toggle(g.key)} /></td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(g.doc_date)}{hint && <div style={{ fontSize: 11, color: hint.c, fontWeight: 600 }}>{hint.t}</div>}</td>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sm.color, display: "inline-block" }} />
                      <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#1d4ed8" }}>{g.doc_no || "-"}</span>
                      {g.count > 1 && <span style={{ padding: "1px 7px", borderRadius: 10, background: "#eef2ff", color: "#4338ca", fontSize: 11, fontWeight: 700 }}>รวม {g.count}</span>}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{g.vendor_name || "-"}</div>
                    <div style={{ fontSize: 11 }}><span style={{ padding: "1px 6px", borderRadius: 4, background: sm.bg, color: sm.color, fontWeight: 600, marginRight: 6 }}>{sm.label}</span>{g.affiliation || ""}</div>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ fontFamily: "monospace", fontWeight: 600 }}>{fmt(g.amount_before_vat)}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>{fmt(g.vat_amount)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot style={{ background: "#f9fafb", fontWeight: 700 }}>
              <tr>
                <td style={td}></td>
                <td colSpan={2} style={{ ...td, textAlign: "right" }}>เลือก {selectedGroups.length}/{filtered.length} ใบ</td>
                <td style={{ ...td, textAlign: "right" }}>มูลค่า {fmt(selBase)}</td>
                <td style={{ ...td, textAlign: "right", color: "#1d4ed8", fontSize: 14 }}>VAT {fmt(selVat)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 3 };
const kpiLbl = { fontSize: 11, color: "#6b7280", marginBottom: 3 };
const kpiVal = { fontSize: 18, fontWeight: 800, textAlign: "right" };
const kpi = { minWidth: 110, padding: "4px 10px", borderLeft: "1px solid #e5e7eb" };
const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const btn = { color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, padding: "8px 16px", fontSize: 13 };
const chip = { border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, padding: "7px 16px", fontSize: 13 };
const miniBtn = { border: "none", borderRadius: 6, cursor: "pointer", padding: "4px 8px", fontSize: 13, margin: "0 2px" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 13, verticalAlign: "top" };
