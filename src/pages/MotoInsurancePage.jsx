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
  const [searchSource, setSearchSource] = useState(null); // 'sale' | 'receipt' | null
  const [searchField, setSearchField] = useState("chassis_no");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const fileRef = useRef();

  function openSearch(source) {
    setSearchSource(source);
    setSearchField("chassis_no");
    setSearchKeyword(editingRow?.chassis_no || "");
    setSearchResults([]);
  }

  async function doSearch() {
    if (!searchKeyword.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search_registrations", field: searchField, keyword: searchKeyword.trim(), source: searchSource }),
      });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch { setSearchResults([]); }
    setSearchLoading(false);
  }

  function pickSearchResult(r) {
    setEditingRow(prev => ({
      ...prev,
      invoice_no: r.sale_doc_no || "",
      customer_name: r.customer_name || "",
      chassis_no: r.frame_no || prev.chassis_no || "",
      plate_number: r.plate_number || prev.plate_number || "",
      insured_name: prev.insured_name || r.customer_name || "",
      match_source: r.source || (searchSource === 'receipt' ? 'receipt' : 'sale'),
    }));
    setSearchSource(null);
    setSearchKeyword("");
    setSearchResults([]);
  }

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
        ...r, _key: `ocr-${i}`, _selected: true, customer_name: "", invoice_no: "", match_source: "",
      }));
      if (arr.length === 0) {
        setMessage("❌ OCR ไม่พบข้อมูลใน PDF นี้");
      } else {
        // preview match
        await refreshMatch(arr);
        setItems(arr);
        const matchedSale = arr.filter(it => it.match_source === "sale").length;
        const matchedRcpt = arr.filter(it => it.match_source === "receipt").length;
        setMessage(`✅ OCR ${arr.length} รายการ — match การขาย ${matchedSale} / รับเรื่องงานทะเบียน ${matchedRcpt}`);
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
          items: rows.map(r => ({ chassis_no: r.chassis_no, contract_date: r.contract_date })),
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
        r.match_source = m?.match_source || "";
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
            <button onClick={() => {
                const newRow = {
                  _key: `manual-${Date.now()}`,
                  _selected: true,
                  contract_date: new Date().toISOString().slice(0, 10),
                  policy_no: "",
                  insured_name: "",
                  chassis_no: "",
                  plate_number: "",
                  coverage_start: "",
                  coverage_end: "",
                  paid: "",
                  premium: 0,
                  stamp_duty: 0,
                  tax: 0,
                  total_premium: 0,
                  commission: 0,
                  premium_remit: 0,
                  customer_name: "",
                  invoice_no: "",
                  match_source: "",
                };
                setItems([...items, newRow]);
                setEditingRow(newRow);
              }}
              style={{ marginLeft: "auto", padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              ➕ เพิ่มรายการ
            </button>
            <button onClick={() => refreshMatch()}
              style={{ padding: "8px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
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

            {/* Search buttons */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e5e7eb", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => openSearch('sale')}
                style={{ padding: "6px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                🔍 ค้นหาเลขที่ใบขาย
              </button>
              <button onClick={() => openSearch('receipt')}
                style={{ padding: "6px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                🔍 ค้นหาเลขที่รับเรื่อง
              </button>
              {(editingRow.invoice_no || editingRow.customer_name) && (
                <span style={{ fontSize: 12, color: editingRow.match_source === 'receipt' ? "#059669" : "#0369a1", marginLeft: 6 }}>
                  ✓ <strong>{editingRow.invoice_no || "-"}</strong> · {editingRow.customer_name || "-"}
                  {editingRow.match_source && <span style={{ marginLeft: 6, padding: "1px 6px", background: editingRow.match_source === 'receipt' ? "#d1fae5" : "#dbeafe", borderRadius: 4 }}>{editingRow.match_source === 'receipt' ? 'รับเรื่อง' : 'ใบขาย'}</span>}
                </span>
              )}
            </div>

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

      {/* Search popup (nested) */}
      {searchSource && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setSearchSource(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 20, borderRadius: 12, width: 900, maxWidth: "95vw", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <h3 style={{ margin: "0 0 12px", color: searchSource === 'receipt' ? "#059669" : "#0369a1" }}>
              🔍 {searchSource === 'sale' ? 'ค้นหาเลขที่ใบขาย (จาก moto_sales)' : 'ค้นหาเลขที่รับเรื่อง (จาก registration_receipts)'}
            </h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <select value={searchField} onChange={e => setSearchField(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }}>
                <option value="chassis_no">เลขตัวถัง</option>
                <option value="customer_name">ชื่อลูกค้า</option>
                <option value="plate_number">เลขทะเบียน</option>
                <option value="engine_no">เลขเครื่อง</option>
                <option value={searchSource === 'receipt' ? 'receipt_no' : 'invoice_no'}>{searchSource === 'receipt' ? 'เลขที่รับเรื่อง' : 'เลขที่ใบขาย'}</option>
              </select>
              <input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="พิมพ์คำค้นแล้วกด Enter หรือคลิก ค้นหา..."
                style={{ flex: 1, padding: "7px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
              <button onClick={doSearch} disabled={searchLoading}
                style={{ padding: "7px 18px", background: searchSource === 'receipt' ? "#059669" : "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                {searchLoading ? "..." : "ค้นหา"}
              </button>
              <button onClick={() => setSearchSource(null)}
                style={{ padding: "7px 14px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>ปิด</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              {searchLoading ? (
                <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังค้นหา...</div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
                  {searchKeyword ? "ไม่พบข้อมูล" : "พิมพ์คำค้นและกด ค้นหา"}
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: "#f3f4f6", position: "sticky", top: 0 }}>
                    <tr>
                      <th style={thStyle}>{searchSource === 'receipt' ? 'เลขที่รับเรื่อง' : 'เลขที่ใบขาย'}</th>
                      <th style={thStyle}>วันที่</th>
                      <th style={thStyle}>ลูกค้า</th>
                      <th style={thStyle}>ยี่ห้อ/รุ่น</th>
                      <th style={thStyle}>เลขตัวถัง</th>
                      <th style={thStyle}>เลขทะเบียน</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((r, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #e5e7eb", cursor: "pointer" }}
                        onClick={() => pickSearchResult(r)}
                        onMouseEnter={e => e.currentTarget.style.background = "#fef9c3"}
                        onMouseLeave={e => e.currentTarget.style.background = ""}>
                        <td style={tdStyle}><strong>{r.sale_doc_no || "-"}</strong></td>
                        <td style={tdStyle}>{r.sale_date ? String(r.sale_date).slice(0, 10) : "-"}</td>
                        <td style={tdStyle}>{r.customer_name || "-"}</td>
                        <td style={tdStyle}>{r.brand || ""} {r.model || ""}</td>
                        <td style={{ ...tdStyle, fontFamily: "monospace" }}>{r.frame_no || "-"}</td>
                        <td style={tdStyle}>{r.plate_number || "-"}</td>
                        <td style={tdStyle}><span style={{ color: "#0369a1", fontSize: 11 }}>เลือก →</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {searchResults.length > 0 && (
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>พบ {searchResults.length} รายการ — คลิกแถวเพื่อเลือก</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: "8px 10px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" };
const tdStyle = { padding: "7px 10px", fontSize: 12, color: "#1f2937" };

/* ============================================================================
   HISTORY TAB
   ============================================================================ */
function HistoryPanel({ setMessage }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState(null);

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
                <th>เลขที่รับเรื่อง</th>
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
                  <td>
                    {r.invoice_no && <div style={{ color: "#065f46", fontWeight: 600 }}>{r.invoice_no}</div>}
                    {r.customer_name && <div style={{ fontSize: 11, color: "#6b7280", marginTop: r.invoice_no ? 2 : 0 }}>{r.customer_name}</div>}
                    {!r.invoice_no && !r.customer_name && <span style={{ color: "#9ca3af" }}>-</span>}
                  </td>
                  <td style={{ color: r.receipt_no ? "#1e40af" : "#9ca3af", fontWeight: r.receipt_no ? 600 : 400 }}>{r.receipt_no || ""}</td>
                  <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                    <button onClick={() => setEditTarget(r)}
                      style={{ padding: "3px 10px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 }}>✏️ แก้ไข</button>
                    <button onClick={() => deleteOne(r.insurance_id)}
                      style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>🗑️ ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editTarget && (
        <InsuranceEditDialog
          record={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); setMessage("✅ บันทึกสำเร็จ"); fetchList(); }}
        />
      )}
    </div>
  );
}

function InsuranceEditDialog({ record, onClose, onSaved }) {
  const [form, setForm] = useState({
    contract_date: record.contract_date ? String(record.contract_date).slice(0, 10) : "",
    policy_no: record.policy_no || "",
    insured_name: record.insured_name || "",
    chassis_no: record.chassis_no || "",
    plate_number: record.plate_number || "",
    coverage_start: record.coverage_start ? String(record.coverage_start).slice(0, 10) : "",
    coverage_end: record.coverage_end ? String(record.coverage_end).slice(0, 10) : "",
    paid: record.paid || "",
    premium: record.premium || 0,
    stamp_duty: record.stamp_duty || 0,
    tax: record.tax || 0,
    total_premium: record.total_premium || 0,
    commission: record.commission || 0,
    premium_remit: record.premium_remit || 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [matchedReceipt, setMatchedReceipt] = useState(null);
  const [matchedSale, setMatchedSale] = useState(null);

  // Auto-match chassis_no with registration_receipts and moto_sales when chassis changes
  useEffect(() => {
    const chassis = (form.chassis_no || "").trim().toUpperCase();
    if (!chassis) { setMatchedReceipt(null); setMatchedSale(null); return; }
    let cancelled = false;
    (async () => {
      try {
        // Search receipts
        const r1 = await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "search_registrations", source: "receipt", field: "chassis_no", keyword: chassis }),
        });
        const d1 = await r1.json();
        if (cancelled) return;
        const rcpt = Array.isArray(d1) && d1.length > 0 ? d1[0] : null;
        setMatchedReceipt(rcpt);

        // Search sales
        const r2 = await fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "search_registrations", source: "sale", field: "chassis_no", keyword: chassis }),
        });
        const d2 = await r2.json();
        if (cancelled) return;
        const sale = Array.isArray(d2) && d2.length > 0 ? d2[0] : null;
        setMatchedSale(sale);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [form.chassis_no]);

  async function handleSave() {
    setSaving(true); setError("");
    try {
      const body = { action: "update_insurance", insurance_id: record.insurance_id, ...form };
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save fail");
      onSaved();
    } catch (e) { setError("บันทึกไม่สำเร็จ: " + e.message); }
    setSaving(false);
  }

  const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
  const inp = { width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
      onClick={() => !saving && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 720, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 14px", color: "#0891b2" }}>✏️ แก้ไขข้อมูล พรบ.</h3>

        {/* Match info */}
        {(matchedReceipt || matchedSale) && (
          <div style={{ background: "#ecfeff", border: "1px solid #67e8f9", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12 }}>
            {matchedSale && (
              <div>📄 <b>ใบขาย:</b> <code>{matchedSale.sale_doc_no}</code> · {matchedSale.customer_name || "-"}</div>
            )}
            {matchedReceipt && (
              <div>📋 <b>เลขที่รับเรื่อง:</b> <code>{matchedReceipt.sale_doc_no}</code> · {matchedReceipt.customer_name || "-"}</div>
            )}
            {!matchedReceipt && form.chassis_no && (
              <div style={{ color: "#6b7280" }}>ℹ️ ไม่พบเลขถังนี้ในตารางรับเรื่องงานทะเบียน</div>
            )}
          </div>
        )}

        {error && <div style={{ padding: 8, background: "#fee2e2", color: "#991b1b", borderRadius: 6, marginBottom: 10, fontSize: 13 }}>❌ {error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div><label style={lbl}>วันที่ทำสัญญา</label>
            <input type="date" value={form.contract_date} onChange={e => setForm(p => ({ ...p, contract_date: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>เลขกรมธรรม์</label>
            <input value={form.policy_no} onChange={e => setForm(p => ({ ...p, policy_no: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>ชำระ</label>
            <select value={form.paid} onChange={e => setForm(p => ({ ...p, paid: e.target.value }))} style={inp}>
              <option value="">-</option><option value="Y">Y</option><option value="N">N</option>
            </select></div>

          <div style={{ gridColumn: "1 / span 2" }}><label style={lbl}>ผู้เอาประกัน</label>
            <input value={form.insured_name} onChange={e => setForm(p => ({ ...p, insured_name: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>เลขทะเบียน</label>
            <input value={form.plate_number} onChange={e => setForm(p => ({ ...p, plate_number: e.target.value }))} style={inp} /></div>

          <div style={{ gridColumn: "1 / span 3" }}><label style={lbl}>เลขตัวถัง (ค้นหาอัตโนมัติเมื่อกรอก)</label>
            <input value={form.chassis_no} onChange={e => setForm(p => ({ ...p, chassis_no: e.target.value.toUpperCase() }))} style={{ ...inp, fontFamily: "monospace" }} /></div>

          <div><label style={lbl}>เริ่มต้น</label>
            <input type="date" value={form.coverage_start} onChange={e => setForm(p => ({ ...p, coverage_start: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>สิ้นสุด</label>
            <input type="date" value={form.coverage_end} onChange={e => setForm(p => ({ ...p, coverage_end: e.target.value }))} style={inp} /></div>
          <div></div>

          <div><label style={lbl}>เบี้ย</label>
            <input type="number" value={form.premium} onChange={e => setForm(p => ({ ...p, premium: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>อากร</label>
            <input type="number" value={form.stamp_duty} onChange={e => setForm(p => ({ ...p, stamp_duty: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>ภาษี</label>
            <input type="number" value={form.tax} onChange={e => setForm(p => ({ ...p, tax: e.target.value }))} style={inp} /></div>

          <div><label style={lbl}>เบี้ยรวม</label>
            <input type="number" value={form.total_premium} onChange={e => setForm(p => ({ ...p, total_premium: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>ค่าคอม</label>
            <input type="number" value={form.commission} onChange={e => setForm(p => ({ ...p, commission: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>เบี้ยนำส่ง</label>
            <input type="number" value={form.premium_remit} onChange={e => setForm(p => ({ ...p, premium_remit: e.target.value }))} style={inp} /></div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "8px 24px", background: saving ? "#9ca3af" : "#0891b2", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
            {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
