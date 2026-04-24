import React, { useEffect, useState, useRef } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";
const OCR_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/ocr-pdf-registration";

export default function ReceiveRegistrationPage({ currentUser }) {
  const [mode, setMode] = useState("ocr"); // ocr | manual
  const [message, setMessage] = useState("");

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📥 รับคืนงานทะเบียน</h2>
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["ocr", "📄 OCR PDF"],
          ["manual", "🖱️ เลือกด้วยมือ"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => { setMode(v); setMessage(""); }}
            style={{ padding: "10px 20px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: mode === v ? "#072d6b" : "#6b7280",
              borderBottom: mode === v ? "3px solid #072d6b" : "3px solid transparent",
              marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : message.startsWith("⚠️") ? "#fef3c7" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : message.startsWith("⚠️") ? "#92400e" : "#991b1b", fontSize: 14 }}>
          {message}
        </div>
      )}

      {mode === "ocr" ? (
        <OcrPanel setMessage={setMessage} currentUser={currentUser} />
      ) : (
        <ManualPanel setMessage={setMessage} currentUser={currentUser} />
      )}
    </div>
  );
}

/* ============================================================================
   OCR TAB
   ============================================================================ */
function OcrPanel({ setMessage, currentUser }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [ocrItems, setOcrItems] = useState([]);   // rows editable after OCR
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [defaultCategory, setDefaultCategory] = useState("");
  const [defaultProvince, setDefaultProvince] = useState("");
  const [editingRow, setEditingRow] = useState(null); // row being edited in popup
  const fileRef = useRef();

  function applyDefaults() {
    if (!defaultCategory && !defaultProvince) {
      setMessage("กรอก default อย่างน้อย 1 ช่อง");
      return;
    }
    setOcrItems(items => items.map(it => ({
      ...it,
      plate_category: defaultCategory || it.plate_category,
      plate_province: defaultProvince || it.plate_province,
    })));
    setMessage(`✅ ใส่ค่า default ให้ ${ocrItems.length} รายการแล้ว`);
  }

  const [refreshing, setRefreshing] = useState(false);
  const [vinSearch, setVinSearch] = useState(null); // { keyword, results, loading }

  async function openVinSearch() {
    setVinSearch({ keyword: "", results: [], loading: true });
    try {
      // โหลด submissions ที่ยังไม่ได้รับทะเบียน (status='submitted') — ไม่ filter brand
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_submissions", status: "submitted" }),
      });
      const data = await res.json();
      const all = Array.isArray(data) ? data : data.rows || [];
      setVinSearch({ keyword: "", results: all, loading: false });
    } catch {
      setVinSearch({ keyword: "", results: [], loading: false });
    }
  }

  function pickVin(chassis) {
    setEditingRow(r => ({ ...r, chassis_no: String(chassis || "").toUpperCase() }));
    setVinSearch(null);
  }
  async function refreshMatch() {
    if (ocrItems.length === 0) return;
    setRefreshing(true);
    setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview_ocr_match",
          items: ocrItems.map(it => ({ chassis_no: it.chassis_no })),
        }),
      });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : data.rows || [];
      const byChassis = {};
      rows.forEach(r => { if (r.chassis) byChassis[r.chassis] = r; });
      setOcrItems(items => items.map(it => {
        const m = byChassis[String(it.chassis_no || "").toUpperCase().trim()];
        return { ...it, invoice_no: m?.invoice_no || "", run_code: m?.run_code || "", customer_name: m?.customer_name || "" };
      }));
      const matched = ocrItems.filter(it => byChassis[String(it.chassis_no || "").toUpperCase().trim()]?.invoice_no).length;
      setMessage(`🔄 Refresh สำเร็จ — จับคู่ใหม่ได้ ${matched} / ${ocrItems.length} รายการ`);
    } catch (e) {
      setMessage("❌ Refresh ไม่สำเร็จ");
    }
    setRefreshing(false);
  }

  async function runOcr() {
    if (!pdfFile) { setMessage("เลือกไฟล์ PDF ก่อน"); return; }
    if (!/\.pdf$/i.test(pdfFile.name)) { setMessage("รับเฉพาะไฟล์ PDF เท่านั้น"); return; }
    setOcrLoading(true);
    setOcrItems([]);
    setMatchResult(null);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("pdf", pdfFile);
      const res = await fetch(OCR_URL, { method: "POST", body: fd });
      const data = await res.json();
      const items = (Array.isArray(data) ? data : data.items || []).map((r, i) => ({
        _key: `ocr-${i}`,
        _selected: true,
        page: r.page || i + 1,
        chassis_no: String(r.chassis_no || "").toUpperCase().trim(),
        plate_category: String(r.plate_category || "").trim(),
        plate_number: String(r.plate_number || "").trim(),
        plate_province: String(r.plate_province || "").trim(),
        register_date: String(r.register_date || "").trim(),
      }));
      if (items.length === 0) {
        setMessage("❌ OCR ไม่พบข้อมูลทะเบียนใน PDF นี้");
      } else {
        // Preview match — lookup invoice_no + run_code (ไม่ update DB)
        try {
          const prevRes = await fetch(API_URL, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "preview_ocr_match",
              items: items.map(it => ({ chassis_no: it.chassis_no })),
            }),
          });
          const prevData = await prevRes.json();
          const prevRows = Array.isArray(prevData) ? prevData : prevData.rows || [];
          // map by chassis
          const byChassis = {};
          prevRows.forEach(r => { if (r.chassis) byChassis[r.chassis] = r; });
          items.forEach(it => {
            const m = byChassis[it.chassis_no];
            it.invoice_no = m?.invoice_no || "";
            it.run_code = m?.run_code || "";
            it.customer_name = m?.customer_name || "";
          });
        } catch { /* ignore preview error, continue without match info */ }
        setOcrItems(items);
        const matched = items.filter(it => it.invoice_no && it.run_code).length;
        const noSale = items.filter(it => !it.invoice_no).length;
        const noSub = items.filter(it => it.invoice_no && !it.run_code).length;
        setMessage(`✅ OCR ${items.length} รายการ — จับคู่ได้ ${matched} / ไม่เจอขาย ${noSale} / ไม่เจอใบส่ง ${noSub}`);
      }
    } catch (e) {
      setMessage("❌ OCR ล้มเหลว: " + String(e).slice(0, 200));
    }
    setOcrLoading(false);
  }

  function updateItem(key, field, value) {
    setOcrItems(items => items.map(it => it._key === key ? { ...it, [field]: value } : it));
  }
  function toggleItem(key) {
    setOcrItems(items => items.map(it => it._key === key ? { ...it, _selected: !it._selected } : it));
  }
  function toggleAll() {
    const allOn = ocrItems.every(it => it._selected);
    setOcrItems(items => items.map(it => ({ ...it, _selected: !allOn })));
  }

  async function saveBatch() {
    const toSave = ocrItems.filter(it => it._selected && it.chassis_no);
    if (!toSave.length) { setMessage("ไม่มีรายการที่เลือก"); return; }
    if (!window.confirm(`บันทึกรับคืน ${toSave.length} รายการ?\nระบบจะ match เลขตัวถังกับตารางการขาย และอัพเดทสถานะทะเบียน`)) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "receive_ocr_batch",
          items: toSave.map(it => ({
            chassis_no: it.chassis_no,
            plate_category: it.plate_category,
            plate_number: it.plate_number,
            plate_province: it.plate_province,
            register_date: it.register_date || null,
          })),
          received_by: currentUser?.name || currentUser?.user_id || "",
        }),
      });
      const data = await res.json();
      const rows = data?.rows || [];
      setMatchResult(rows);
      const ok = rows.filter(r => r.match_status === "ok").length;
      const noSale = rows.filter(r => r.match_status === "no_sale").length;
      const noSub = rows.filter(r => r.match_status === "no_submission").length;
      if (ok === rows.length) {
        setMessage(`✅ บันทึกสำเร็จครบ ${ok} รายการ`);
      } else {
        setMessage(`⚠️ สำเร็จ ${ok} / ไม่เจอขาย ${noSale} / ไม่เจอใบส่ง ${noSub}`);
      }
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + String(e).slice(0, 200));
    }
    setSaving(false);
  }

  const selCount = ocrItems.filter(it => it._selected).length;

  return (
    <div>
      {/* Step 1: upload */}
      <div style={{ padding: "16px 18px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#374151" }}>ขั้นตอนที่ 1 — อัพโหลด PDF สำเนาทะเบียน</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)}
            style={{ fontFamily: "Tahoma", fontSize: 13 }} />
          <button onClick={runOcr} disabled={!pdfFile || ocrLoading}
            style={{ padding: "8px 18px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: (!pdfFile || ocrLoading) ? "not-allowed" : "pointer", opacity: (!pdfFile || ocrLoading) ? 0.5 : 1, fontFamily: "Tahoma", fontSize: 14, fontWeight: 600 }}>
            🔍 {ocrLoading ? "กำลัง OCR..." : "เริ่ม OCR"}
          </button>
          {pdfFile && <span style={{ fontSize: 12, color: "#6b7280" }}>{pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)</span>}
        </div>
      </div>

      {/* Step 2: preview & edit */}
      {ocrItems.length > 0 && (
        <>
          <div style={{ padding: "12px 16px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14, color: "#374151" }}>ขั้นตอนที่ 2 — ตรวจสอบข้อมูล ({selCount}/{ocrItems.length} เลือก)</strong>
            <button onClick={refreshMatch} disabled={refreshing || ocrItems.length === 0}
              style={{ marginLeft: "auto", padding: "8px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.6 : 1, fontFamily: "Tahoma", fontSize: 13, fontWeight: 600 }}
              title="จับคู่เลขที่ใบขาย/ใบส่งจด ใหม่ตาม VIN ล่าสุด (ไม่ต้อง OCR ซ้ำ)">
              🔄 {refreshing ? "กำลังจับคู่..." : "Refresh จับคู่"}
            </button>
            <button onClick={saveBatch} disabled={!selCount || saving}
              style={{ padding: "8px 20px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: (!selCount || saving) ? "not-allowed" : "pointer", opacity: (!selCount || saving) ? 0.5 : 1, fontFamily: "Tahoma", fontSize: 14, fontWeight: 600 }}>
              💾 {saving ? "กำลังบันทึก..." : "บันทึกรับคืน"}
            </button>
          </div>

          {/* Default values applier */}
          <div style={{ padding: "10px 14px", background: "#fefce8", borderRadius: 10, border: "1px solid #fde68a", marginBottom: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13, color: "#854d0e" }}>🔧 ใส่ค่า default ให้ทุกรายการ:</strong>
            <label style={{ fontSize: 12, color: "#6b7280" }}>หมวด:</label>
            <input type="text" value={defaultCategory} onChange={e => setDefaultCategory(e.target.value)}
              placeholder="เช่น 2 กช"
              style={{ width: 100, padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
            <label style={{ fontSize: 12, color: "#6b7280" }}>จังหวัด:</label>
            <input type="text" value={defaultProvince} onChange={e => setDefaultProvince(e.target.value)}
              placeholder="เช่น พระนครศรีอยุธยา"
              style={{ width: 160, padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
            <button onClick={applyDefaults}
              style={{ padding: "6px 14px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              ใส่ทุกรายการ
            </button>
            <span style={{ fontSize: 11, color: "#92400e", fontStyle: "italic" }}>ช่องที่ว่างจะเติมตาม default · ช่องที่มีค่าจะถูกทับ</span>
          </div>

          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}><input type="checkbox" checked={ocrItems.every(it => it._selected)} onChange={toggleAll} /></th>
                  <th style={{ width: 50 }}>หน้า</th>
                  <th>เลขตัวถัง (VIN)</th>
                  <th>หมวด</th>
                  <th>เลขทะเบียน</th>
                  <th>จังหวัด</th>
                  <th>เลขที่ใบขาย</th>
                  <th>เลขที่ใบส่งจด</th>
                  <th style={{ width: 80 }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {ocrItems.map(it => {
                  const noMatch = !it.invoice_no || !it.run_code;
                  return (
                  <tr key={it._key} style={{ background: it._selected ? (noMatch ? "#fef3c7" : "#eff6ff") : (noMatch ? "#fffbeb" : "#fff") }}>
                    <td style={{ textAlign: "center" }}><input type="checkbox" checked={it._selected} onChange={() => toggleItem(it._key)} /></td>
                    <td style={{ textAlign: "center", color: "#6b7280", fontSize: 12 }}>{it.page}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{it.chassis_no || "-"}</td>
                    <td style={{ fontSize: 13 }}>{it.plate_category || "-"}</td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{it.plate_number || "-"}</td>
                    <td style={{ fontSize: 13 }}>{it.plate_province || "-"}</td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "#065f46", fontWeight: 600 }} title={it.customer_name || ""}>
                      {it.invoice_no || ""}
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12, fontFamily: "monospace", color: "#065f46", fontWeight: 600 }}>
                      {it.run_code || ""}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button onClick={() => setEditingRow({ ...it })}
                        style={{ padding: "4px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "Tahoma" }}>
                        ✏️ แก้ไข
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Step 3: result */}
      {matchResult && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>ผลการจับคู่</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>สถานะ</th>
                  <th>เลขตัวถัง</th>
                  <th>ทะเบียน</th>
                  <th>ใบขาย</th>
                  <th>ลูกค้า</th>
                  <th>Run</th>
                </tr>
              </thead>
              <tbody>
                {matchResult.map((r, i) => {
                  const color = r.match_status === "ok" ? "#10b981" : r.match_status === "no_submission" ? "#f59e0b" : "#ef4444";
                  const label = r.match_status === "ok" ? "✅ สำเร็จ" : r.match_status === "no_submission" ? "⚠️ ไม่เจอใบส่ง" : "❌ ไม่เจอการขาย";
                  return (
                    <tr key={i}>
                      <td><span style={{ color, fontWeight: 600, fontSize: 13 }}>{label}</span></td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.chassis}</td>
                      <td>{r.plate_category} {r.plate_number} — {r.plate_province}</td>
                      <td>{r.invoice_no || "-"}</td>
                      <td>{r.customer_name || "-"}</td>
                      <td style={{ fontFamily: "monospace" }}>{r.run_code || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Row Modal */}
      {editingRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setEditingRow(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 520, maxWidth: "95vw", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 6px", color: "#072d6b" }}>✏️ แก้ไขข้อมูล — หน้า {editingRow.page}</h3>
            {editingRow.customer_name && (
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
                {editingRow.invoice_no} • {editingRow.customer_name} {editingRow.run_code ? `• ${editingRow.run_code}` : ""}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>เลขตัวถัง (VIN)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="text" value={editingRow.chassis_no} onChange={e => setEditingRow(r => ({ ...r, chassis_no: e.target.value.toUpperCase() }))}
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, boxSizing: "border-box" }} />
                <button type="button" onClick={openVinSearch}
                  style={{ padding: "8px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}
                  title="ค้นจากรายการส่งจดทะเบียน (ยังไม่ได้รับ)">
                  🔍 ค้นหา
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>หมวด</label>
                <input type="text" value={editingRow.plate_category} onChange={e => setEditingRow(r => ({ ...r, plate_category: e.target.value }))}
                  placeholder="2 กช"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>เลขทะเบียน</label>
                <input type="text" value={editingRow.plate_number} onChange={e => setEditingRow(r => ({ ...r, plate_number: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box", fontWeight: 600 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>จังหวัด</label>
                <input type="text" value={editingRow.plate_province} onChange={e => setEditingRow(r => ({ ...r, plate_province: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>วันที่จดทะเบียน</label>
                <input type="date" value={editingRow.register_date} onChange={e => setEditingRow(r => ({ ...r, register_date: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditingRow(null)}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
                ยกเลิก
              </button>
              <button onClick={() => {
                  setOcrItems(items => items.map(it => it._key === editingRow._key ? { ...it, ...editingRow } : it));
                  setEditingRow(null);
                }}
                style={{ padding: "8px 20px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                💾 บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIN Search Modal */}
      {vinSearch && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          onClick={() => setVinSearch(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, width: 720, maxWidth: "95vw", maxHeight: "85vh", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>🔍 ค้นหาเลขตัวถัง (จากใบส่งจดทะเบียน)</h3>
              <button onClick={() => setVinSearch(null)} style={{ marginLeft: "auto", padding: "4px 10px", background: "transparent", border: "none", cursor: "pointer", fontSize: 20, color: "#6b7280" }}>✕</button>
            </div>

            <input type="text" value={vinSearch.keyword} onChange={e => setVinSearch(v => ({ ...v, keyword: e.target.value }))}
              placeholder="พิมพ์เลขตัวถังบางส่วน (เช่น MLESEK หรือ 51111)"
              autoFocus
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 14, boxSizing: "border-box", marginBottom: 12 }} />

            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              {vinSearch.loading ? "กำลังโหลดรายการ..." : `แสดงผลจากใบส่งจดทะเบียน ${vinSearch.results.length} รายการ (ยังไม่ได้รับทะเบียน)`}
            </div>

            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              <table className="data-table" style={{ fontSize: 13 }}>
                <thead style={{ position: "sticky", top: 0, background: "#072d6b", color: "#fff", zIndex: 1 }}>
                  <tr>
                    <th>Run</th>
                    <th>ใบขาย</th>
                    <th>ลูกค้า</th>
                    <th>รุ่น</th>
                    <th>เลขตัวถัง</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const kw = vinSearch.keyword.trim().toUpperCase();
                    const filtered = vinSearch.results.filter(r => !kw || String(r.chassis_no || "").toUpperCase().includes(kw));
                    if (filtered.length === 0) return (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>{kw ? "ไม่พบ" : "โหลดรายการ..."}</td></tr>
                    );
                    return filtered.slice(0, 100).map(r => (
                      <tr key={r.submission_id} style={{ cursor: "pointer" }} onClick={() => pickVin(r.chassis_no)}
                        onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                        onMouseLeave={e => e.currentTarget.style.background = ""}>
                        <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#072d6b", whiteSpace: "nowrap" }}>{r.run_code}</td>
                        <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{r.invoice_no || "-"}</td>
                        <td>{r.customer_name || "-"}</td>
                        <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{r.model_series || "-"}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.chassis_no || "-"}</td>
                        <td><button style={{ padding: "3px 10px", background: "#10b981", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>✓ เลือก</button></td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>แสดงสูงสุด 100 รายการแรก · คลิกแถวเพื่อใช้ VIN นี้</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   MANUAL TAB
   ============================================================================ */
function ManualPanel({ setMessage, currentUser }) {
  const [brand, setBrand] = useState("ฮอนด้า");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState(null); // { submission_id, chassis_no, ... }
  const [saving, setSaving] = useState(false);

  async function post(body) {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function fetchSubmitted(b = brand) {
    setLoading(true);
    try {
      const data = await post({ action: "get_submissions", brand: b, status: "submitted" });
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchSubmitted(brand); /* eslint-disable-next-line */ }, [brand]);

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!kw) return true;
    const hay = [r.invoice_no, r.customer_name, r.chassis_no, r.engine_no, r.run_code]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  function openEdit(r) {
    setEditTarget({
      submission_id: r.submission_id,
      chassis_no: r.chassis_no || "",
      customer_name: r.customer_name,
      invoice_no: r.invoice_no,
      run_code: r.run_code,
      plate_category: r.plate_category || "",
      plate_number: r.plate_number || "",
      plate_province: r.plate_province || "อยุธยา",
      register_date: r.register_date ? String(r.register_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
  }

  async function saveManual() {
    if (!editTarget) return;
    if (!editTarget.plate_number.trim()) { alert("กรุณากรอกเลขทะเบียน"); return; }
    setSaving(true);
    try {
      // ใช้ receive_ocr_batch ด้วย 1 item เพื่อให้ logic match sales + insert moto_registrations เหมือนกัน
      const data = await post({
        action: "receive_ocr_batch",
        items: [{
          chassis_no: editTarget.chassis_no,
          plate_category: editTarget.plate_category,
          plate_number: editTarget.plate_number,
          plate_province: editTarget.plate_province,
          register_date: editTarget.register_date || null,
        }],
        received_by: currentUser?.name || currentUser?.user_id || "",
      });
      const r = data?.rows?.[0];
      if (r?.match_status === "ok") {
        setMessage(`✅ บันทึกรับคืน ${editTarget.customer_name} สำเร็จ`);
        setEditTarget(null);
        fetchSubmitted(brand);
      } else {
        setMessage(`⚠️ ${r?.match_status === "no_sale" ? "ไม่เจอใน moto_sales" : "ไม่เจอใบส่ง"}`);
      }
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  }

  return (
    <div>
      {/* Brand tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["ฮอนด้า", "ยามาฮ่า"].map(b => (
          <button key={b} onClick={() => setBrand(b)}
            style={{ padding: "8px 22px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              background: brand === b ? "#072d6b" : "#e5e7eb",
              color: brand === b ? "#fff" : "#374151" }}>
            {b}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา: ใบขาย / ลูกค้า / เลขตัวถัง / เลขรัน"
          style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }} />
        <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{filtered.length} / {rows.length} รายการ</span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          ไม่มีรายการที่รอรับคืน ({brand})
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>เลขรัน</th>
                <th>วันส่ง</th>
                <th>ใบขาย</th>
                <th>ลูกค้า</th>
                <th>รุ่น</th>
                <th>เลขตัวถัง</th>
                <th style={{ width: 110 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.submission_id}>
                  <td style={{ textAlign: "center" }}>{i + 1}</td>
                  <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{r.run_code}</td>
                  <td>{fmtDate(r.submit_date)}</td>
                  <td>{r.invoice_no || "-"}</td>
                  <td>{r.customer_name || "-"}</td>
                  <td>{r.model_series || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.chassis_no || "-"}</td>
                  <td style={{ textAlign: "center" }}>
                    <button onClick={() => openEdit(r)}
                      style={{ padding: "4px 12px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "Tahoma" }}>
                      📥 รับคืน
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setEditTarget(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 480, maxWidth: "95vw", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 6px", color: "#072d6b" }}>📥 รับคืน — {editTarget.run_code}</h3>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
              {editTarget.customer_name} • {editTarget.invoice_no}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>เลขตัวถัง (VIN)</label>
              <input type="text" value={editTarget.chassis_no} readOnly
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, boxSizing: "border-box", background: "#f9fafb" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>หมวด</label>
                <input type="text" value={editTarget.plate_category} onChange={e => setEditTarget(t => ({ ...t, plate_category: e.target.value }))}
                  placeholder="1 กข"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>เลขทะเบียน *</label>
                <input type="text" value={editTarget.plate_number} onChange={e => setEditTarget(t => ({ ...t, plate_number: e.target.value }))}
                  placeholder="1234"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box", fontWeight: 600 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>จังหวัด</label>
                <input type="text" value={editTarget.plate_province} onChange={e => setEditTarget(t => ({ ...t, plate_province: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>วันจดทะเบียน</label>
                <input type="date" value={editTarget.register_date} onChange={e => setEditTarget(t => ({ ...t, register_date: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditTarget(null)}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
                ยกเลิก
              </button>
              <button onClick={saveManual} disabled={saving}
                style={{ padding: "8px 20px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontSize: 14, fontWeight: 600 }}>
                💾 {saving ? "กำลังบันทึก..." : "บันทึกรับคืน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const day = String(dt.getDate()).padStart(2, "0");
    const mo = String(dt.getMonth() + 1).padStart(2, "0");
    const yr = dt.getFullYear() + 543;
    return `${day}/${mo}/${String(yr).slice(-2)}`;
  } catch { return String(d); }
}
