import React, { useEffect, useMemo, useRef, useState } from "react";

// จัดการภาษีซื้อ — รวมเอกสารภาษีซื้อ 3 แหล่ง (รถ + อะไหล่ + ค่าใช้จ่าย)
// อ่านจาก webhook input-tax-api (UNION vehicle_purchase_receipts_* / *_part_tax_invoices / expense_documents)
// สถานะ + การแก้ไข: เก็บใน state ฝั่งหน้าจอ (เฟสนี้ยังไม่บันทึกลง DB)
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/input-tax-api";

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}
function toISODate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function curMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

const SOURCE_META = {
  vehicle: { label: "รถ", color: "#1e40af", bg: "#dbeafe" },
  part: { label: "อะไหล่", color: "#92400e", bg: "#fef3c7" },
  expense: { label: "ค่าใช้จ่าย", color: "#065f46", bg: "#d1fae5" },
  fuel: { label: "ค่าน้ำมัน", color: "#9a3412", bg: "#ffedd5" },
  theft: { label: "ประกันรถหาย", color: "#9d174d", bg: "#fce7f3" },
};

const DEFAULT_STATUS = "รับใบกำกับภาษีแล้ว";
const NO_INVOICE_STATUS = "ยังไม่ได้รับใบกำกับภาษี"; // รับสินค้าแล้วแต่ยังไม่ได้ upload ใบกำกับ (มูลค่า=0)
const STATUS_STYLE = {
  "รับใบกำกับภาษีแล้ว": { bg: "#dbeafe", color: "#1e40af" },
  "ยังไม่ได้รับใบกำกับภาษี": { bg: "#ffedd5", color: "#9a3412" },
  "เตรียมแบบยื่น ภ.พ.30": { bg: "#d1fae5", color: "#065f46" },
  "ไม่ใช้สิทธิขอคืน": { bg: "#f3f4f6", color: "#6b7280" },
};

export default function TaxManageInputPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(curMonth()); // YYYY-MM
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState(""); // "" | vehicle | part | expense
  const [filterAff, setFilterAff] = useState(""); // "" | ป.เปา | สิงห์ชัย
  const [message, setMessage] = useState("");
  const [statuses, setStatuses] = useState({}); // key -> status
  const [edits, setEdits] = useState({}); // key -> overridden fields
  const [editKey, setEditKey] = useState(null); // row key being edited

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [month]);

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const ym = month ? month.replace("-", "") : null;
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_input_tax", year_month: ym }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data?.rows || []);
      setRows(arr);
    } catch (e) {
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + e.message);
      setRows([]);
    }
    setLoading(false);
  }

  // default: มูลค่าก่อน VAT = 0 → รับสินค้าแล้วแต่ยังไม่ได้ upload ใบกำกับ
  const defaultStatusOf = (g) => (Number(g?.amount_before_vat || 0) === 0 ? NO_INVOICE_STATUS : DEFAULT_STATUS);
  const statusOf = (key, g) => statuses[key] || defaultStatusOf(g);
  // จัดกลุ่มตามเลขที่เอกสารเดียวกัน (เช่น ใบกำกับ MD ใบเดียวมีหลายคัน) — ถ้าไม่มีเลข = แยกบรรทัด
  const groupKeyOf = (r, idx) => `${r.source}|${r.affiliation || ""}|${r.doc_no || ("row" + idx)}`;

  function setStatus(key, action) {
    setStatuses(prev => {
      const next = { ...prev };
      if (action === "รีเซ็ต") delete next[key];
      else next[key] = action;
      return next;
    });
  }
  function saveEdit(key, form) {
    setEdits(prev => ({ ...prev, [key]: { ...form } }));
    setEditKey(null);
    setMessage("✅ แก้ไขใบกำกับภาษีเรียบร้อย (ยังไม่บันทึกถาวร)");
  }

  // กรองสมาชิกก่อน (ตามฟิลด์ดั้งเดิม) แล้วค่อยรวมกลุ่มตามเลขที่เอกสาร
  const filteredMembers = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return rows.map((r, i) => ({ r, i })).filter(({ r }) => {
      if (filterSource && r.source !== filterSource) return false;
      if (filterAff && String(r.affiliation || "") !== filterAff) return false;
      if (!kw) return true;
      const hay = [r.doc_no, r.ref_no, r.vendor_name, r.project].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(kw);
    });
  }, [rows, search, filterSource, filterAff]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const { r, i } of filteredMembers) {
      const gk = groupKeyOf(r, i);
      let g = map.get(gk);
      if (!g) {
        g = { key: gk, source: r.source, brand: r.brand, affiliation: r.affiliation,
          doc_date: r.doc_date, doc_no: r.doc_no, ref_no: r.ref_no,
          vendor_name: r.vendor_name, vendor_tax_id: r.vendor_tax_id, vendor_branch: r.vendor_branch,
          project: r.project, amount_before_vat: 0, vat_amount: 0, total_amount: 0, count: 0 };
        map.set(gk, g);
      }
      g.amount_before_vat += Number(r.amount_before_vat) || 0;
      g.vat_amount += Number(r.vat_amount) || 0;
      g.total_amount += Number(r.total_amount) || 0;
      g.count += 1;
    }
    return [...map.values()];
    /* eslint-disable-next-line */
  }, [filteredMembers]);

  const effGroup = (g) => ({ ...g, ...(edits[g.key] || {}) });
  const sumBase = groups.reduce((s, g) => s + (Number(g.amount_before_vat) || 0), 0);
  const sumVat = groups.reduce((s, g) => s + (Number(g.vat_amount) || 0), 0);

  const editRow = editKey
    ? (() => { const g = groups.find(x => x.key === editKey); return g ? effGroup(g) : null; })()
    : null;

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🧾 จัดการภาษีซื้อ</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2",
          color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 14 }}>
          {message}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>📅 รอบเดือน:</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inp} />
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={inp} title="กรองตามประเภท">
          <option value="">📂 ประเภท: ทั้งหมด</option>
          <option value="vehicle">รถ</option>
          <option value="part">อะไหล่</option>
          <option value="expense">ค่าใช้จ่าย</option>
          <option value="fuel">ค่าน้ำมัน</option>
          <option value="theft">ประกันรถหาย</option>
        </select>
        <select value={filterAff} onChange={e => setFilterAff(e.target.value)} style={inp} title="กรองตามสังกัด">
          <option value="">🏢 สังกัด: ทั้งหมด</option>
          <option value="ป.เปา">ป.เปา</option>
          <option value="สิงห์ชัย">สิงห์ชัย</option>
        </select>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 ค้นหา เลขที่เอกสาร / ผู้จำหน่าย / โปรเจ็ค"
          style={{ ...inp, flex: 1, minWidth: 220 }} />
        <button onClick={fetchData} disabled={loading} style={btn("#0369a1")}>🔄 รีเฟรช</button>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
        <span>รายการทั้งหมด <strong>{groups.length}</strong> รายการ</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: "#374151" }}>มูลค่า: <strong>{fmt(sumBase)}</strong></span>
        <span style={{ color: "#dc2626" }}>ภาษีซื้อ: <strong>{fmt(sumVat)}</strong> บาท</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูลในรอบเดือนนี้</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>วันที่เอกสาร</th>
                <th style={th}>เลขที่เอกสาร</th>
                <th style={th}>ชื่อผู้จำหน่าย / โปรเจ็ค</th>
                <th style={{ ...th, textAlign: "right" }}>มูลค่า / ภาษีมูลค่าเพิ่ม</th>
                <th style={{ ...th, textAlign: "center" }}>สถานะใบกำกับภาษี</th>
                <th style={{ ...th, width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const key = g.key;
                const ef = effGroup(g);
                const sm = SOURCE_META[ef.source] || { label: ef.source, color: "#374151", bg: "#e5e7eb" };
                return (
                  <tr key={key} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(ef.doc_date)}</td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: sm.color, display: "inline-block" }} />
                        <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#1d4ed8" }}>{ef.doc_no || "-"}</span>
                        {g.count > 1 && <span style={{ padding: "1px 7px", borderRadius: 10, background: "#eef2ff", color: "#4338ca", fontSize: 11, fontWeight: 700 }}>รวม {g.count} รายการ</span>}
                      </div>
                      {g.count === 1 && ef.ref_no && <div style={{ fontSize: 11, color: "#6b7280", marginLeft: 14 }}>{ef.ref_no}</div>}
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{ef.vendor_name || "-"}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        <span style={{ padding: "1px 6px", borderRadius: 4, background: sm.bg, color: sm.color, fontWeight: 600, marginRight: 6 }}>{sm.label}</span>
                        {ef.affiliation ? `${ef.affiliation} · ` : ""}{ef.project || ""}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <div style={{ fontFamily: "monospace", fontWeight: 600 }}>{fmt(ef.amount_before_vat)}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>{fmt(ef.vat_amount)}</div>
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <StatusDropdown status={statusOf(key, ef)} onPick={a => setStatus(key, a)} />
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <RowKebab onEdit={() => setEditKey(key)} onPrint={() => printDoc(ef, statusOf(key, ef))} onDownload={() => downloadDoc(ef, statusOf(key, ef))} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editRow && (
        <EditTaxInvoiceModal row={editRow} onClose={() => setEditKey(null)} onSave={form => saveEdit(editKey, form)} />
      )}
    </div>
  );
}

// ── Status dropdown (3 ตัวเลือก) ──────────────────────────────────────────────
function StatusDropdown({ status, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  const sty = STATUS_STYLE[status] || STATUS_STYLE[DEFAULT_STATUS];
  const ACTIONS = ["รับใบกำกับภาษีแล้ว", "ยังไม่ได้รับใบกำกับภาษี", "เตรียมแบบยื่น ภ.พ.30", "ไม่ใช้สิทธิขอคืน", "รีเซ็ต"];
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: sty.bg, color: sty.color }}>
        {status} <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 2px)", right: 0, minWidth: 180, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", zIndex: 60, padding: 4 }}>
          {ACTIONS.map((a, idx) => (
            <React.Fragment key={a}>
              {a === "รีเซ็ต" && <div style={{ height: 1, background: "#e5e7eb", margin: "4px 6px" }} />}
              <button onClick={() => { onPick(a); setOpen(false); }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 13, borderRadius: 6, color: a === "รีเซ็ต" ? "#6b7280" : "#374151" }}>
                {a}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Kebab menu (⋯) ───────────────────────────────────────────────────────────
function RowKebab({ onEdit, onPrint, onDownload }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.right - 180 });
    }
    setOpen(o => !o);
  }
  useEffect(() => {
    if (!open) return;
    const onDown = e => {
      if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("scroll", onScroll, true); };
  }, [open]);
  const Item = ({ icon, label, onClick }) => (
    <button onClick={() => { setOpen(false); onClick(); }}
      onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", background: "transparent", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontSize: 13, fontWeight: 600, textAlign: "left", color: "#374151" }}>
      <span style={{ width: 18, textAlign: "center" }}>{icon}</span>{label}
    </button>
  );
  return (
    <>
      <button ref={btnRef} onClick={toggle} title="เมนู"
        style={{ width: 30, height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: open ? "#e2e8f0" : "#fff", cursor: "pointer", fontSize: 18, lineHeight: "14px", color: "#475569" }}>⋯</button>
      {open && (
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: 180, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", zIndex: 2000, padding: 4 }}>
          <Item icon="✏️" label="แก้ไขใบกำกับภาษี" onClick={onEdit} />
          <Item icon="🖨️" label="พิมพ์เอกสาร" onClick={onPrint} />
          <Item icon="⬇️" label="ดาวน์โหลด" onClick={onDownload} />
        </div>
      )}
    </>
  );
}

// ── Edit modal (ไม่มี upload เอกสาร) ─────────────────────────────────────────
function EditTaxInvoiceModal({ row, onClose, onSave }) {
  const [form, setForm] = useState({
    doc_no: row.doc_no || "",
    doc_date: toISODate(row.doc_date),
    tax_form: row.tax_form || "ภ.พ.30",
    vendor_name: row.vendor_name || "",
    vendor_tax_id: row.vendor_tax_id || "",
    vendor_branch: row.vendor_branch || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1100, padding: 20, overflowY: "auto" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 520, maxWidth: "96vw" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
          <h3 style={{ margin: 0, color: "#7c3aed" }}>แก้ไขข้อมูลใบกำกับภาษีที่ได้รับ</h3>
          <button onClick={onClose} style={{ marginLeft: "auto", padding: "4px 10px", background: "transparent", border: "none", cursor: "pointer", fontSize: 22, color: "#6b7280" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lbl}>เลขที่ใบกำกับภาษี:</label>
            <input type="text" value={form.doc_no} onChange={e => set("doc_no", e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>วันที่ใบกำกับภาษี:</label>
            <input type="date" value={form.doc_date} onChange={e => set("doc_date", e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>แบบฟอร์มภาษี:</label>
            <div style={{ display: "flex", gap: 18, marginTop: 4 }}>
              {["ภ.พ.30", "ภ.พ.36"].map(t => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
                  <input type="radio" name="tax_form" checked={form.tax_form === t} onChange={() => set("tax_form", t)} /> {t}
                </label>
              ))}
            </div>
          </div>
          <div style={{ height: 1, background: "#e5e7eb" }} />
          <div>
            <label style={lbl}>ชื่อผู้จำหน่าย:</label>
            <input type="text" value={form.vendor_name} onChange={e => set("vendor_name", e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>เลขประจำตัวผู้เสียภาษี:</label>
            <input type="text" value={form.vendor_tax_id} onChange={e => set("vendor_tax_id", e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>สำนักงาน/สาขา:</label>
            <input type="text" value={form.vendor_branch} onChange={e => set("vendor_branch", e.target.value)} style={inp} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "#6b7280" }}>มูลค่าก่อนภาษี:</span>
            <strong style={{ fontFamily: "monospace" }}>{fmt(row.amount_before_vat)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span style={{ color: "#6b7280" }}>ภาษีมูลค่าเพิ่ม:</span>
            <strong style={{ fontFamily: "monospace" }}>{fmt(row.vat_amount)}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: "8px 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={() => onSave(form)} style={{ padding: "8px 24px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

// ── พิมพ์ / ดาวน์โหลด ────────────────────────────────────────────────────────
function docHtml(r, status) {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const total = (Number(r.amount_before_vat) || 0) + (Number(r.vat_amount) || 0);
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(r.doc_no)}</title>
    <style>
      *{font-family:'Tahoma','Sarabun',sans-serif;box-sizing:border-box}
      body{margin:30px;color:#111827;font-size:13px}
      h1{font-size:20px;margin:0 0 6px}
      .muted{color:#6b7280}
      table{width:100%;border-collapse:collapse;margin-top:14px}
      td{padding:6px 4px;vertical-align:top}
      .lbl{color:#6b7280;width:160px}
      .tot{border-top:1px solid #d1d5db;margin-top:10px;padding-top:8px}
      @media print{body{margin:0;padding:24px}}
    </style></head><body>
    <h1>ใบกำกับภาษีซื้อ</h1>
    <div class="muted">${esc(r.tax_form || "ภ.พ.30")} · สถานะ: ${esc(status || "")}</div>
    <table>
      <tr><td class="lbl">เลขที่ใบกำกับภาษี</td><td><b>${esc(r.doc_no)}</b></td></tr>
      <tr><td class="lbl">วันที่ใบกำกับภาษี</td><td>${esc(fmtDate(r.doc_date))}</td></tr>
      <tr><td class="lbl">ชื่อผู้จำหน่าย</td><td>${esc(r.vendor_name)}</td></tr>
      <tr><td class="lbl">เลขประจำตัวผู้เสียภาษี</td><td>${esc(r.vendor_tax_id || "-")}</td></tr>
      <tr><td class="lbl">สำนักงาน/สาขา</td><td>${esc(r.vendor_branch || "-")}</td></tr>
      <tr><td class="lbl">สังกัด / โปรเจ็ค</td><td>${esc([r.affiliation, r.project].filter(Boolean).join(" · "))}</td></tr>
    </table>
    <table class="tot">
      <tr><td class="lbl">มูลค่าก่อนภาษี</td><td style="text-align:right">${fmt(r.amount_before_vat)}</td></tr>
      <tr><td class="lbl">ภาษีมูลค่าเพิ่ม</td><td style="text-align:right">${fmt(r.vat_amount)}</td></tr>
      <tr><td class="lbl"><b>รวมทั้งสิ้น</b></td><td style="text-align:right"><b>${fmt(total)}</b></td></tr>
    </table>
  </body></html>`;
}
function printDoc(r, status) {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return;
  w.document.write(docHtml(r, status) + "<script>window.onload=function(){window.print();}<\/script>");
  w.document.close();
}
function downloadDoc(r, status) {
  const blob = new Blob([docHtml(r, status)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(r.doc_no || "tax-invoice").replace(/[^\w.-]+/g, "_")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const inp = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#374151" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 13, verticalAlign: "top" };
const btn = (color) => ({ padding: "7px 14px", background: color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 });
