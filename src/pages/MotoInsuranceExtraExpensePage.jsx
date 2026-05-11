import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

async function postAPI(body) {
  const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

const EXPENSE_TYPES = ["แก้ไข พรบ.", "ยกเลิก พรบ.", "ค่าธรรมเนียมแก้ไข", "อื่น ๆ"];

const empty = { id: "", expense_type: "แก้ไข พรบ.", original_policy_no: "", expense_amount: "", payment_receipt_no: "", note: "" };

export default function MotoInsuranceExtraExpensePage({ currentUser }) {
  const [tab, setTab] = useState("new");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [search, setSearch] = useState("");

  // receipt picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerRows, setPickerRows] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => { if (tab === "history") fetchHistory(); /* eslint-disable-next-line */ }, [tab]);

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      const d = await postAPI({ action: "list_motoinsurance_extra", search });
      setHistory(Array.isArray(d) ? d.filter(r => r && r.id) : []);
    } catch { setHistory([]); }
    setLoadingHistory(false);
  }

  async function save() {
    if (!form.payment_receipt_no) { setMessage("❌ เลือกเลขที่ใบรับชำระ"); return; }
    if (!form.expense_amount || Number(form.expense_amount) <= 0) { setMessage("❌ กรอกยอด"); return; }
    setSaving(true); setMessage("");
    try {
      await postAPI({
        action: "save_motoinsurance_extra",
        id: form.id || "",
        expense_type: form.expense_type || "แก้ไข พรบ.",
        original_policy_no: form.original_policy_no || "",
        expense_amount: Number(form.expense_amount),
        payment_receipt_no: form.payment_receipt_no,
        note: form.note,
        created_by: currentUser?.username || currentUser?.name || "system",
      });
      setMessage("✅ บันทึกสำเร็จ");
      setForm(empty);
      if (tab === "history") fetchHistory();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  function edit(r) {
    setForm({
      id: r.id,
      expense_type: r.expense_type || "แก้ไข พรบ.",
      original_policy_no: r.original_policy_no || "",
      expense_amount: r.expense_amount || "",
      payment_receipt_no: r.payment_receipt_no || "",
      note: r.note || "",
    });
    setTab("new");
  }

  async function del(r) {
    if (!window.confirm("ลบรายการนี้?")) return;
    try {
      await postAPI({ action: "delete_motoinsurance_extra", id: r.id });
      setMessage("✅ ลบสำเร็จ"); fetchHistory();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  async function openPicker() {
    setPickerOpen(true);
    // default search = "พรบ" เพื่อกรองงานพรบ เป็นหลัก
    const q = pickerSearch || "พรบ";
    setPickerSearch(q);
    setPickerLoading(true);
    try {
      const d = await postAPI({ action: "list_other_income_receipts", search: q });
      setPickerRows(Array.isArray(d) ? d.filter(r => r && r.receipt_no) : []);
    } catch { setPickerRows([]); }
    setPickerLoading(false);
  }
  async function searchPicker() {
    setPickerLoading(true);
    try {
      const d = await postAPI({ action: "list_other_income_receipts", search: pickerSearch });
      setPickerRows(Array.isArray(d) ? d.filter(r => r && r.receipt_no) : []);
    } catch { setPickerRows([]); }
    setPickerLoading(false);
  }
  function pickReceipt(r) {
    setForm(f => ({
      ...f,
      payment_receipt_no: r.receipt_no,
      // pre-fill ยอดถ้ายังไม่กรอก
      expense_amount: f.expense_amount || (r.total || r.line_amount || ""),
      // ดึง description มาช่วย note ถ้ายังไม่มี
      note: f.note || (r.description ? `[${r.description}]` : f.note),
    }));
    setPickerOpen(false);
  }

  const totalAmount = history.reduce((s, r) => s + Number(r.expense_amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📋 บันทึกค่าใช้จ่ายเพิ่มเติมงาน พรบ.</h2>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "2px solid #e5e7eb" }}>
        {[["new","📝 บันทึกใหม่"],["history","📜 ประวัติ"]].map(([v,label]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ padding: "10px 22px", border: "none", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 600,
              color: tab === v ? "#072d6b" : "#6b7280",
              borderBottom: tab === v ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>{label}</button>
        ))}
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, borderRadius: 6, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>}

      {tab === "new" && (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{
            background: "linear-gradient(135deg, #0369a1 0%, #072d6b 100%)",
            color: "#fff", padding: "16px 22px", borderRadius: "12px 12px 0 0",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 22 }}>{form.id ? "✏️" : "➕"}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{form.id ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>บันทึกค่าใช้จ่ายเพิ่มเติมที่เกิดจากการแก้ไข/ยกเลิกกรรมธรรม์ พรบ.</div>
            </div>
          </div>
          <div style={{ background: "#fff", padding: 22, borderRadius: "0 0 12px 12px", border: "1px solid #e5e7eb", borderTop: "none" }}>
            {/* Section 1: ประเภท */}
            <div style={{ marginBottom: 18 }}>
              <div style={sectionHd}>① ประเภทค่าใช้จ่าย</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                {EXPENSE_TYPES.map(t => {
                  const active = form.expense_type === t;
                  return (
                    <button key={t} onClick={() => setForm({ ...form, expense_type: t })}
                      style={{
                        padding: "10px 12px", border: `2px solid ${active ? "#0369a1" : "#e5e7eb"}`,
                        borderRadius: 8, background: active ? "#dbeafe" : "#fff",
                        color: active ? "#072d6b" : "#374151", fontWeight: active ? 700 : 500,
                        cursor: "pointer", fontSize: 13, fontFamily: "Tahoma",
                      }}>
                      {active ? "✓ " : ""}{t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: ใบรับชำระ */}
            <div style={{ marginBottom: 18 }}>
              <div style={sectionHd}>② เลขที่ใบรับชำระ (จากรายได้อื่น ๆ) <span style={req}>*</span></div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={form.payment_receipt_no} onChange={e => setForm({ ...form, payment_receipt_no: e.target.value })}
                       style={{ ...inp, fontFamily: "monospace", fontSize: 14 }} placeholder="REC..." />
                <button onClick={openPicker} style={{ ...btnBlue, whiteSpace: "nowrap" }}>🔍 เลือกจากใบรับ</button>
              </div>
              <div style={hint}>คลิก "เลือกจากใบรับ" เพื่อค้นหาใบรับจากรายได้อื่น ๆ (กรอง "พรบ" อัตโนมัติ)</div>
            </div>

            {/* Section 3: รายละเอียด */}
            <div style={{ marginBottom: 18 }}>
              <div style={sectionHd}>③ รายละเอียด</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="เลขที่กรรมธรรม์ พรบ. ที่แก้ไข">
                  <input value={form.original_policy_no} onChange={e => setForm({ ...form, original_policy_no: e.target.value })}
                         style={{ ...inp, fontFamily: "monospace" }} placeholder="เช่น 01250008175" />
                </Field>
                <Field label={<span>ค่าใช้จ่าย (บาท) <span style={req}>*</span></span>}>
                  <input type="number" step="0.01" value={form.expense_amount} onChange={e => setForm({ ...form, expense_amount: e.target.value })}
                         style={{ ...inp, textAlign: "right", fontSize: 18, fontWeight: 700, color: "#dc2626" }} />
                </Field>
              </div>
              <Field label="หมายเหตุ">
                <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={inp} placeholder="เช่น แก้ไขพรบ. RLHJK..." />
              </Field>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
              {form.id && <button onClick={() => setForm(empty)} style={btnGray}>ยกเลิก</button>}
              <button onClick={save} disabled={saving} style={{ ...btnGreen, padding: "10px 24px", fontSize: 14 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div style={cardSt}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <input placeholder="🔍 ค้นหา (ประเภท/กรรมธรรม์/ใบรับชำระ)" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, minWidth: 280 }} />
            <button onClick={fetchHistory} style={btnBlue}>🔄 รีเฟรช</button>
            <span style={{ marginLeft: "auto", fontWeight: 700, color: "#059669" }}>💰 ยอดรวม: {fmt(totalAmount)} บาท</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>วันที่บันทึก</th>
                  <th style={th}>ประเภท</th>
                  <th style={th}>เลขกรรมธรรม์</th>
                  <th style={{ ...th, textAlign: "right" }}>ค่าใช้จ่าย</th>
                  <th style={th}>เลขที่ใบรับชำระ</th>
                  <th style={th}>หมายเหตุ</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                {!loadingHistory && history.length === 0 && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                {history.map((r, i) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}>{fmtDate(r.created_at)}</td>
                    <td style={td}>{r.expense_type}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.original_policy_no || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#dc2626" }}>{fmt(r.expense_amount)}</td>
                    <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{r.payment_receipt_no || "-"}</td>
                    <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{r.note || ""}</td>
                    <td style={td}>
                      <button onClick={() => edit(r)} style={btnSmYellow}>✏️</button>
                      <button onClick={() => del(r)} style={btnSmRed}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receipt picker popup */}
      {pickerOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => setPickerOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, maxWidth: 1100, width: "92%", maxHeight: "85vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>🔍 เลือกใบรับชำระจากรายได้อื่น ๆ</h3>
              <button onClick={() => setPickerOpen(false)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="🔍 receipt_no / ลูกค้า" style={{ ...inp, flex: 1 }} />
              <button onClick={searchPicker} style={btnBlue}>ค้นหา</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "#f0f4f9" }}>
                <tr>
                  <th style={th}>#</th><th style={th}>วันที่</th><th style={th}>เลขที่ใบรับ</th>
                  <th style={th}>สาขา</th><th style={th}>ลูกค้า</th>
                  <th style={th}>รายการ</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอด</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {pickerLoading && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                {!pickerLoading && pickerRows.length === 0 && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                {pickerRows.map((r, i) => (
                  <tr key={r.item_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}>{fmtDate(r.receipt_date)}</td>
                    <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{r.receipt_no}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.branch_code}</td>
                    <td style={td}>{r.customer_name}</td>
                    <td style={{ ...td, fontSize: 11 }}>{r.description}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.total || r.line_amount)}</td>
                    <td style={td}><button onClick={() => pickReceipt(r)} style={btnSmGreen}>เลือก</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
const h3St = { margin: "0 0 12px", color: "#072d6b" };
const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const btnGreen = { padding: "8px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 };
const btnGray = { padding: "8px 16px", background: "#9ca3af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const btnBlue = { padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
const btnSmYellow = { marginRight: 4, padding: "3px 8px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnSmRed = { padding: "3px 8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const btnSmGreen = { padding: "3px 10px", background: "#059669", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };
const sectionHd = { fontSize: 13, fontWeight: 700, color: "#072d6b", marginBottom: 8, paddingBottom: 4, borderBottom: "2px solid #dbeafe" };
const req = { color: "#dc2626", fontWeight: 700 };
const hint = { fontSize: 11, color: "#6b7280", marginTop: 4, fontStyle: "italic" };
