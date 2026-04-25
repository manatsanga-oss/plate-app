import React, { useEffect, useState, useRef } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";
const OCR_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/ocr-pdf-insurance";

const FIELDS = [
  { key: "contract_date",  label: "วันที่ทำสัญญา", type: "date",   width: 110 },
  { key: "policy_no",      label: "เลขกรมธรรม์",   type: "text",   width: 130 },
  { key: "insured_name",   label: "ผู้เอาประกัน",   type: "text",   width: 180 },
  { key: "chassis_no",     label: "เลขตัวถัง",      type: "text",   width: 160, mono: true },
  { key: "plate_number",   label: "เลขทะเบียน",    type: "text",   width: 90 },
  { key: "coverage_start", label: "เริ่มต้น",        type: "date",   width: 110 },
  { key: "coverage_end",   label: "สิ้นสุด",         type: "date",   width: 110 },
  { key: "paid",           label: "ชำระ",           type: "text",   width: 60 },
  { key: "premium",        label: "เบี้ย",          type: "number", width: 70 },
  { key: "stamp_duty",     label: "อากร",           type: "number", width: 60 },
  { key: "tax",            label: "ภาษี",           type: "number", width: 60 },
  { key: "total_premium",  label: "เบี้ยรวม",       type: "number", width: 80 },
  { key: "commission",     label: "ค่าคอม",         type: "number", width: 70 },
  { key: "premium_remit",  label: "เบี้ยนำส่ง",     type: "number", width: 80 },
];

export default function MotoInsurancePage({ currentUser }) {
  const [mode, setMode] = useState("ocr"); // ocr | history
  const [message, setMessage] = useState("");

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🛡️ บันทึก พรบ.รถใหม่</h2>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["ocr", "📄 OCR PDF"],
          ["history", "📋 ประวัติ"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => { setMode(v); setMessage(""); }}
            style={{ padding: "10px 20px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: mode === v ? "#072d6b" : "#6b7280",
              borderBottom: mode === v ? "3px solid #072d6b" : "3px solid transparent",
              marginBottom: -2 }}>{label}</button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : message.startsWith("⚠️") ? "#fef3c7" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : message.startsWith("⚠️") ? "#92400e" : "#991b1b", fontSize: 14 }}>
          {message}
        </div>
      )}

      {mode === "ocr" ? <OcrPanel setMessage={setMessage} /> : <HistoryPanel setMessage={setMessage} />}
    </div>
  );
}

/* ============================================================================
   OCR TAB
   ============================================================================ */
function OcrPanel({ setMessage }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [items, setItems] = useState([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const fileRef = useRef();

  async function runOcr() {
    if (!pdfFile) { setMessage("เลือกไฟล์ PDF ก่อน"); return; }
    if (!/\.pdf$/i.test(pdfFile.name)) { setMessage("รับเฉพาะ PDF"); return; }
    setOcrLoading(true);
    setItems([]);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("pdf", pdfFile);
      const res = await fetch(OCR_URL, { method: "POST", body: fd });
      const data = await res.json();
      const arr = (Array.isArray(data) ? data : data.items || []).map((r, i) => ({
        ...r, _key: `ocr-${i}`, _selected: true, customer_name: "", invoice_no: "",
      }));
      if (arr.length === 0) {
        setMessage("❌ OCR ไม่พบข้อมูลใน PDF นี้");
      } else {
        // preview match
        await refreshMatch(arr);
        setItems(arr);
        const matched = arr.filter(it => it.invoice_no).length;
        setMessage(`✅ OCR ${arr.length} รายการ — match กับการขายได้ ${matched}`);
      }
    } catch (e) {
      setMessage("❌ OCR ล้มเหลว: " + String(e).slice(0, 200));
    }
    setOcrLoading(false);
  }

  async function refreshMatch(rows = items) {
    if (!rows || rows.length === 0) return;
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview_ocr_match",
          items: rows.map(r => ({ chassis_no: r.chassis_no })),
        }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : data.rows || [];
      const byChassis = {};
      arr.forEach(r => { if (r.chassis) byChassis[r.chassis] = r; });
      rows.forEach(r => {
        const m = byChassis[String(r.chassis_no || "").toUpperCase().trim()];
        r.invoice_no = m?.invoice_no || "";
        r.customer_name = m?.customer_name || "";
      });
      setItems([...rows]);
    } catch {}
  }

  function deleteRow(key) {
    if (!window.confirm("ลบแถวนี้?")) return;
    setItems(items => items.filter(it => it._key !== key));
  }

  function toggleAll() {
    const all = items.every(it => it._selected);
    setItems(items.map(it => ({ ...it, _selected: !all })));
  }

  async function saveBatch() {
    const toSave = items.filter(it => it._selected);
    if (!toSave.length) { setMessage("เลือกรายการก่อน"); return; }
    if (!window.confirm(`บันทึก ${toSave.length} รายการ?`)) return;
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_insurance_batch", items: toSave.map(({ _key, _selected, customer_name, invoice_no, ...rest }) => rest) }),
      });
      const data = await res.json();
      const n = data?.inserted ?? 0;
      const matched = (data?.rows || []).filter(r => r.sale_id).length;
      setMessage(`✅ บันทึกสำเร็จ ${n} รายการ (จับคู่ moto_sales: ${matched})`);
      setItems([]);
      setPdfFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  }

  const selCount = items.filter(it => it._selected).length;
  const summary = items.reduce((s, it) => {
    if (it._selected) {
      s.premium += Number(it.premium || 0);
      s.total += Number(it.total_premium || 0);
      s.commission += Number(it.commission || 0);
      s.remit += Number(it.premium_remit || 0);
    }
    return s;
  }, { premium: 0, total: 0, commission: 0, remit: 0 });

  return (
    <div>
      {/* Upload */}
      <div style={{ padding: "14px 16px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>ขั้นตอนที่ 1 — อัพโหลด PDF พรบ.</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
          <button onClick={runOcr} disabled={!pdfFile || ocrLoading}
            style={{ padding: "8px 18px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: (!pdfFile || ocrLoading) ? "not-allowed" : "pointer", opacity: (!pdfFile || ocrLoading) ? 0.5 : 1, fontFamily: "Tahoma", fontSize: 14, fontWeight: 600 }}>
            🔍 {ocrLoading ? "กำลัง OCR..." : "เริ่ม OCR"}
          </button>
          {pdfFile && <span style={{ fontSize: 12, color: "#6b7280" }}>{pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)</span>}
        </div>
      </div>

      {items.length > 0 && (
        <>
          <div style={{ padding: "12px 16px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>ขั้นตอนที่ 2 — ตรวจสอบ ({selCount}/{items.length} เลือก)</strong>
            <span style={{ fontSize: 12, color: "#6b7280" }}>เบี้ยรวม {summary.total.toLocaleString()} · เบี้ยนำส่ง {summary.remit.toLocaleString()}</span>
            <button onClick={() => refreshMatch()}
              style={{ marginLeft: "auto", padding: "8px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              🔄 Refresh จับคู่
            </button>
            <button onClick={saveBatch} disabled={!selCount || saving}
              style={{ padding: "8px 20px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: (!selCount || saving) ? "not-allowed" : "pointer", opacity: (!selCount || saving) ? 0.5 : 1, fontFamily: "Tahoma", fontSize: 14, fontWeight: 600 }}>
              💾 {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}><input type="checkbox" checked={items.every(it => it._selected)} onChange={toggleAll} /></th>
                  <th style={{ width: 40 }}>#</th>
                  <th>เลขตัวถัง</th>
                  <th>เลขทะเบียน</th>
                  <th>เลขที่กรมธรรม์</th>
                  <th>เบี้ยรวม</th>
                  <th>เลขที่ใบขาย</th>
                  <th>ลูกค้า</th>
                  <th style={{ width: 90 }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const noMatch = !it.invoice_no;
                  return (
                  <tr key={it._key} style={{ background: it._selected ? (noMatch ? "#fef3c7" : "#eff6ff") : (noMatch ? "#fffbeb" : "#fff") }}>
                    <td style={{ textAlign: "center" }}><input type="checkbox" checked={it._selected} onChange={() => setItems(items.map(x => x._key === it._key ? { ...x, _selected: !x._selected } : x))} /></td>
                    <td style={{ textAlign: "center" }}>{i + 1}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{it.chassis_no || "-"}</td>
                    <td>{it.plate_number || "-"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{it.policy_no || "-"}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{Number(it.total_premium || 0).toLocaleString()}</td>
                    <td style={{ color: it.invoice_no ? "#065f46" : "#9ca3af", fontWeight: it.invoice_no ? 600 : 400, fontSize: 11 }}>
                      {it.invoice_no || ""}
                    </td>
                    <td style={{ fontSize: 11 }}>{it.customer_name || ""}</td>
                    <td style={{ textAlign: "center" }}>
                      <button onClick={() => setEditingRow({ ...it })}
                        style={{ padding: "3px 8px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 3 }}>✏️</button>
                      <button onClick={() => deleteRow(it._key)}
                        style={{ padding: "3px 8px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>🗑️</button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editingRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setEditingRow(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 22, width: 700, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>✏️ แก้ไขรายการ พรบ.</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {FIELDS.map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{f.label}</label>
                  <input type={f.type} value={editingRow[f.key] ?? ""} onChange={e => setEditingRow(r => ({ ...r, [f.key]: f.type === "number" ? Number(e.target.value) : (f.key === "chassis_no" ? e.target.value.toUpperCase() : e.target.value) }))}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: f.mono ? "monospace" : "Tahoma", fontSize: 13, boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setEditingRow(null)}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={() => {
                  setItems(items.map(x => x._key === editingRow._key ? { ...x, ...editingRow } : x));
                  setEditingRow(null);
                }}
                style={{ padding: "8px 20px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>💾 บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   HISTORY TAB
   ============================================================================ */
function HistoryPanel({ setMessage }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_insurance_list", search }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }

  async function deleteOne(id) {
    if (!window.confirm("ลบรายการ พรบ. นี้?")) return;
    try {
      await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete_insurance", insurance_id: id }) });
      setMessage("✅ ลบสำเร็จ");
      fetchList();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
  }

  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, []);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") fetchList(); }}
          placeholder="🔍 ค้นหา: เลขตัวถัง / เลขกรมธรรม์ / ชื่อ"
          style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }} />
        <button onClick={fetchList}
          style={{ padding: "8px 18px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600 }}>🔍 ค้นหา</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          ไม่มีข้อมูล
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>วันสัญญา</th>
                <th>เลขกรมธรรม์</th>
                <th>เลขตัวถัง</th>
                <th>ผู้เอาประกัน</th>
                <th>เบี้ยรวม</th>
                <th>ใบขาย</th>
                <th>ลูกค้า</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.insurance_id}>
                  <td style={{ textAlign: "center" }}>{i + 1}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.contract_date ? String(r.contract_date).slice(0, 10) : "-"}</td>
                  <td>{r.policy_no || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                  <td>{r.insured_name || "-"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{Number(r.total_premium || 0).toLocaleString()}</td>
                  <td style={{ color: r.invoice_no ? "#065f46" : "#9ca3af", fontWeight: r.invoice_no ? 600 : 400 }}>{r.invoice_no || ""}</td>
                  <td>{r.customer_name || ""}</td>
                  <td style={{ textAlign: "center" }}>
                    <button onClick={() => deleteOne(r.insurance_id)}
                      style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>🗑️ ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
