import React, { useEffect, useState, useRef } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";
const OCR_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/ocr-pdf-registration";

export default function ReceiveRegistrationPage({ currentUser }) {
  const [mode, setMode] = useState("ocr"); // ocr | manual | history
  const [message, setMessage] = useState("");

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📥 รับคืน / ส่งคืนทะเบียน</h2>
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["ocr", "📄 OCR PDF"],
          ["manual", "🖱️ เลือกด้วยมือ"],
          ["history", "📋 ประวัติรับคืน"],
          ["notify", "🖨️ ใบนำส่งป้าย"],
          ["finance", "🏦 รอส่งเล่มไฟแนนท์"],
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
      ) : mode === "manual" ? (
        <ManualPanel setMessage={setMessage} currentUser={currentUser} />
      ) : mode === "history" ? (
        <HistoryPanel setMessage={setMessage} currentUser={currentUser} />
      ) : mode === "notify" ? (
        <NotifyPanel setMessage={setMessage} currentUser={currentUser} />
      ) : (
        <FinancePanel setMessage={setMessage} currentUser={currentUser} />
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
  const lastRefreshKeyRef = useRef(""); // track last set of chassis_no we refreshed for, to avoid loops

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
  async function refreshMatch(silent = false) {
    if (ocrItems.length === 0) return;
    setRefreshing(true);
    if (!silent) setMessage("");
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
      if (!silent) setMessage(`🔄 Refresh สำเร็จ — จับคู่ใหม่ได้ ${matched} / ${ocrItems.length} รายการ`);
    } catch (e) {
      if (!silent) setMessage("❌ Refresh ไม่สำเร็จ");
    }
    setRefreshing(false);
  }

  // Auto-refresh จับคู่ เมื่อ chassis_no ใน ocrItems เปลี่ยน (debounce 600ms)
  useEffect(() => {
    if (ocrItems.length === 0) return;
    const key = ocrItems.map(it => String(it.chassis_no || "").toUpperCase().trim()).join("|");
    if (key === lastRefreshKeyRef.current) return;
    if (!key.replace(/\|/g, "")) return; // ทุกตัวเป็น empty → skip
    const t = setTimeout(() => {
      lastRefreshKeyRef.current = key;
      refreshMatch(true); // silent — ไม่ขึ้น message รบกวน
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocrItems.map(it => it.chassis_no).join("|")]);

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
            {refreshing && (
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#6366f1", fontStyle: "italic" }}>🔄 กำลังจับคู่อัตโนมัติ...</span>
            )}
            <button onClick={saveBatch} disabled={!selCount || saving}
              style={{ marginLeft: refreshing ? 0 : "auto", padding: "8px 20px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: (!selCount || saving) ? "not-allowed" : "pointer", opacity: (!selCount || saving) ? 0.5 : 1, fontFamily: "Tahoma", fontSize: 14, fontWeight: 600 }}>
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
              <h3 style={{ margin: 0, color: "#072d6b" }}>🔍 ค้นหา (จากใบส่งจดทะเบียน)</h3>
              <button onClick={() => setVinSearch(null)} style={{ marginLeft: "auto", padding: "4px 10px", background: "transparent", border: "none", cursor: "pointer", fontSize: 20, color: "#6b7280" }}>✕</button>
            </div>

            <input type="text" value={vinSearch.keyword} onChange={e => setVinSearch(v => ({ ...v, keyword: e.target.value }))}
              placeholder="พิมพ์ส่วนใดของ: เลขตัวถัง / ใบขาย / Run / ลูกค้า / รุ่น / เลขเครื่อง"
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
                    const filtered = vinSearch.results.filter(r => {
                      if (!kw) return true;
                      const hay = [
                        r.chassis_no, r.invoice_no, r.run_code,
                        r.customer_name, r.model_series, r.engine_no,
                      ].filter(Boolean).join(" ").toUpperCase();
                      return hay.includes(kw);
                    });
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

/* ============================================================================
   HISTORY TAB — View + edit received submissions
   ============================================================================ */
function HistoryPanel({ setMessage, currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedRun, setExpandedRun] = useState(null);

  async function fetchHistory() {
    setLoading(true);
    try {
      // ดึงทั้ง status "received" (รับคืน) และ "returned" (ส่งคืน) พร้อมกัน
      const [rRecv, rRet] = await Promise.all([
        fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_submissions", status: "received" }),
        }).then(r => r.json()).catch(() => []),
        fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_submissions", status: "returned" }),
        }).then(r => r.json()).catch(() => []),
      ]);
      const all = [
        ...(Array.isArray(rRecv) ? rRecv : []),
        ...(Array.isArray(rRet) ? rRet : []),
      ];
      setRows(all);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchHistory(); }, []);

  // Group by run_code
  const grouped = React.useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = r.run_code || `_${r.submission_id}`;
      if (!map.has(key)) {
        map.set(key, {
          run_code: r.run_code,
          submit_date: r.submit_date,
          received_at: r.received_at,
          brand: r.brand,
          items: [],
        });
      }
      const g = map.get(key);
      // Track the latest received_at within this run (for sorting + display)
      if (r.received_at && (!g.received_at || r.received_at > g.received_at)) {
        g.received_at = r.received_at;
      }
      g.items.push(r);
    });
    // Sort by received_at desc (latest received first), fallback to run_code
    return Array.from(map.values()).sort((a, b) => {
      const av = a.received_at || "";
      const bv = b.received_at || "";
      if (av && bv) return bv.localeCompare(av);
      if (av) return -1;
      if (bv) return 1;
      return (b.run_code || "").localeCompare(a.run_code || "");
    });
  }, [rows]);

  const kw = search.trim().toLowerCase();
  const filteredGroups = grouped.map(g => ({
    ...g,
    items: g.items.filter(it => {
      if (!kw) return true;
      const hay = [it.chassis_no, it.plate_number, it.plate_category, it.customer_name, it.invoice_no, it.run_code]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(kw);
    }),
  })).filter(g => g.items.length > 0);

  function openEdit(it) {
    setEditTarget({
      submission_id: it.submission_id,
      run_code: it.run_code,
      chassis_no: it.chassis_no,
      customer_name: it.customer_name,
      invoice_no: it.invoice_no,
      plate_category: it.plate_category || "",
      plate_number: it.plate_number || "",
      plate_province: it.plate_province || "",
      register_date: it.register_date ? String(it.register_date).slice(0, 10) : "",
    });
  }

  async function saveEdit() {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_submission",
          submission_id: editTarget.submission_id,
          plate_category: editTarget.plate_category,
          plate_number: editTarget.plate_number,
          plate_province: editTarget.plate_province,
          register_date: editTarget.register_date || null,
        }),
      });
      await res.json();
      setMessage(`✅ แก้ไข ${editTarget.run_code} สำเร็จ (sync → moto_registrations)`);
      setEditTarget(null);
      fetchHistory();
    } catch {
      setMessage("❌ แก้ไขไม่สำเร็จ");
    }
    setSaving(false);
  }

  async function revertToSubmitted(submissionId, runCode) {
    if (!window.confirm(`เปลี่ยนสถานะกลับเป็น "ส่งจด" (ถือว่ายังไม่ได้รับทะเบียน)?\n${runCode}`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_submission", submission_id: submissionId, status: "submitted" }),
      }).then(r => r.json());
      setMessage(`✅ ย้อนสถานะ ${runCode} กลับเป็น "ส่งจด"`);
      fetchHistory();
    } catch { setMessage("❌ ไม่สำเร็จ"); }
  }

  async function cancelEntireRun(runCode, count) {
    if (!window.confirm(`ยกเลิกการรับคืน run ${runCode}?\n• เปลี่ยน ${count} รายการกลับเป็น "ส่งจด" (ยังไม่รับ)\n• เคลียร์ข้อมูลทะเบียน + วันส่งสาขา\n• เพื่อทำการรับคืนใหม่ได้`)) return;
    try {
      // ใช้ update_run เพื่อ revert ทั้ง run พร้อมล้าง plate fields
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_run", run_code: runCode, status: "submitted",
          plate_category: "", plate_number: "", plate_province: "", register_date: null,
        }),
      }).then(r => r.json());
      setMessage(`✅ ยกเลิกการรับคืน ${runCode} สำเร็จ — กลับไปอยู่ใน "รอรับคืน"`);
      fetchHistory();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา: VIN / เลขทะเบียน / ลูกค้า / run / ใบขาย"
          style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14 }} />
        <button onClick={fetchHistory}
          style={{ padding: "8px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>🔄 Refresh</button>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          รับคืน {rows.filter(r => r.status === 'received').length} · ส่งคืน {rows.filter(r => r.status === 'returned').length} · รวม {rows.length} รายการ
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : filteredGroups.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          {rows.length === 0 ? "ยังไม่มีประวัติรับคืน" : "ไม่พบรายการตามที่ค้นหา"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredGroups.map(g => {
            const isOpen = expandedRun === g.run_code;
            return (
              <div key={g.run_code} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", background: isOpen ? "#f0f9ff" : "#fff" }}
                  onClick={() => setExpandedRun(isOpen ? null : g.run_code)}>
                  <span style={{ fontSize: 14, color: "#6b7280" }}>{isOpen ? "▾" : "▸"}</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: "#072d6b" }}>{g.run_code}</span>
                  {(() => {
                    const recvCount = g.items.filter(it => it.status === 'received').length;
                    const retCount = g.items.filter(it => it.status === 'returned').length;
                    if (retCount === g.items.length) {
                      return <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, background: "#ede9fe", color: "#5b21b6", fontWeight: 600 }}>ส่งคืนแล้ว</span>;
                    }
                    if (recvCount === g.items.length) {
                      return <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, background: "#10b98122", color: "#065f46", fontWeight: 600 }}>รับคืน</span>;
                    }
                    return (
                      <>
                        <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, background: "#10b98122", color: "#065f46", fontWeight: 600 }}>รับคืน {recvCount}</span>
                        <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, background: "#ede9fe", color: "#5b21b6", fontWeight: 600 }}>ส่งคืน {retCount}</span>
                      </>
                    );
                  })()}
                  <span style={{ fontSize: 13, color: "#374151" }} title={g.submit_date ? `ส่งจด: ${fmtDate(g.submit_date)}` : ""}>
                    📥 {fmtDate(g.received_at || g.submit_date)}
                  </span>
                  <span style={{ fontSize: 13, color: "#6b7280" }}>{g.brand}</span>
                  <span style={{ marginLeft: "auto", fontSize: 13, color: "#111", fontWeight: 600 }}>{g.items.length} คัน</span>
                  {(() => {
                    const billedCount = g.items.filter(it => it.billed_at).length;
                    const returnedCount = g.items.filter(it => it.status === 'returned').length;
                    if (returnedCount > 0) {
                      return (
                        <span style={{ padding: "5px 12px", background: "#ede9fe", color: "#5b21b6", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "1px solid #c4b5fd" }}
                          title={`มี ${returnedCount} รายการส่งคืนแล้ว — ยกเลิกการรับคืนไม่ได้`}>
                          📤 ส่งคืนแล้ว ({returnedCount})
                        </span>
                      );
                    }
                    if (billedCount > 0) {
                      return (
                        <span style={{ padding: "5px 12px", background: "#fef3c7", color: "#92400e", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "1px solid #fbbf24" }}
                          title={`มี ${billedCount} รายการวางบิลแล้ว — ต้องยกเลิกใบวางบิลก่อนถึงจะยกเลิกรับคืนได้`}>
                          💰 วางบิลแล้ว ({billedCount})
                        </span>
                      );
                    }
                    return (
                      <button onClick={e => { e.stopPropagation(); cancelEntireRun(g.run_code, g.items.length); }}
                        style={{ padding: "5px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        ✕ ยกเลิกการรับคืน
                      </button>
                    );
                  })()}
                </div>
                {isOpen && (
                  <div style={{ padding: "0 0 10px 0", borderTop: "1px solid #e5e7eb", overflowX: "auto" }}>
                    <table className="data-table" style={{ fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>#</th>
                          <th>ลูกค้า</th>
                          <th>VIN</th>
                          <th>หมวด</th>
                          <th>เลขทะเบียน</th>
                          <th>จังหวัด</th>
                          <th>วันจด</th>
                          <th>วันส่งสาขา</th>
                          <th style={{ width: 90 }}>สถานะ</th>
                          <th style={{ width: 150 }}>จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((it, i) => {
                          const isReturned = it.status === 'returned';
                          return (
                          <tr key={it.submission_id} style={{ background: isReturned ? "#faf5ff" : it.sent_to_branch_at ? "#ecfdf5" : undefined }}>
                            <td style={{ textAlign: "center" }}>{i + 1}</td>
                            <td>{it.customer_name || "-"}</td>
                            <td style={{ fontFamily: "monospace", fontSize: 12 }}>{it.chassis_no || "-"}</td>
                            <td>{it.plate_category || "-"}</td>
                            <td style={{ fontWeight: 600 }}>{it.plate_number || "-"}</td>
                            <td>{it.plate_province || "-"}</td>
                            <td>{fmtDate(it.register_date)}</td>
                            <td style={{ color: it.sent_to_branch_at ? "#065f46" : "#9ca3af", fontWeight: it.sent_to_branch_at ? 600 : 400 }}>
                              {it.sent_to_branch_at ? fmtDate(it.sent_to_branch_at) : "—"}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {isReturned ? (
                                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#ede9fe", color: "#5b21b6", fontWeight: 600 }}>ส่งคืน</span>
                              ) : (
                                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#10b98122", color: "#065f46", fontWeight: 600 }}>รับคืน</span>
                              )}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button onClick={() => openEdit(it)} disabled={isReturned}
                                title={isReturned ? "ส่งคืนแล้ว — แก้ไม่ได้" : "แก้ไข"}
                                style={{ padding: "3px 10px", background: isReturned ? "#d1d5db" : "#f59e0b", color: isReturned ? "#9ca3af" : "#fff", border: "none", borderRadius: 4, cursor: isReturned ? "not-allowed" : "pointer", fontSize: 11, marginRight: 4 }}>✏️ แก้</button>
                              <button onClick={() => revertToSubmitted(it.submission_id, it.run_code)} disabled={isReturned}
                                title={isReturned ? "ส่งคืนแล้ว — ย้อนไม่ได้" : "ย้อนกลับเป็น 'ส่งจด'"}
                                style={{ padding: "3px 10px", background: isReturned ? "#d1d5db" : "#ef4444", color: isReturned ? "#9ca3af" : "#fff", border: "none", borderRadius: 4, cursor: isReturned ? "not-allowed" : "pointer", fontSize: 11 }}>↩️ ย้อน</button>
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
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setEditTarget(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 520, maxWidth: "95vw", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 6px", color: "#072d6b" }}>✏️ แก้ไขข้อมูลทะเบียน — {editTarget.run_code}</h3>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
              {editTarget.invoice_no} • {editTarget.customer_name} • VIN: <code>{editTarget.chassis_no}</code>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>หมวด</label>
                <input type="text" value={editTarget.plate_category} onChange={e => setEditTarget(t => ({ ...t, plate_category: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>เลขทะเบียน</label>
                <input type="text" value={editTarget.plate_number} onChange={e => setEditTarget(t => ({ ...t, plate_number: e.target.value }))}
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
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>ยกเลิก</button>
              <button onClick={saveEdit} disabled={saving}
                style={{ padding: "8px 20px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontSize: 14, fontWeight: 600 }}>
                💾 {saving ? "กำลังบันทึก..." : "บันทึกแก้ไข"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   NOTIFY TAB — พิมพ์ใบแจ้งลูกค้ามารับทะเบียน
   ============================================================================ */
function NotifyPanel({ setMessage, currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState({});
  const [branchFilter, setBranchFilter] = useState("");
  const [runFilter, setRunFilter] = useState("");
  const [receiveDateFilter, setReceiveDateFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [sentDate, setSentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [savingSent, setSavingSent] = useState(false);
  const [viewMode, setViewMode] = useState("pending"); // pending | sent | all

  async function fetchReceived() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_submissions", status: "received" }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }

  useEffect(() => { fetchReceived(); }, []);

  // แยกตาม sent_to_branch_at
  const pendingRows = viewMode === "pending" ? rows.filter(r => !r.sent_to_branch_at)
                    : viewMode === "sent" ? rows.filter(r => r.sent_to_branch_at)
                    : rows;

  const kw = search.trim().toLowerCase();
  const filtered = pendingRows.filter(r => {
    if (branchFilter && fmtBranch(r.branch_code) !== branchFilter) return false;
    if (runFilter && r.run_code !== runFilter) return false;
    if (brandFilter && r.brand !== brandFilter) return false;
    if (receiveDateFilter) {
      const rd = r.received_at ? String(r.received_at).slice(0, 10) : "";
      if (rd !== receiveDateFilter) return false;
    }
    if (!kw) return true;
    const hay = [r.customer_name, r.customer_phone, r.engine_no, r.plate_number, r.run_code]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const branchOpts = [...new Set(pendingRows.map(r => fmtBranch(r.branch_code)).filter(v => v && v !== "-"))].sort();
  const runOpts = [...new Set(pendingRows.map(r => r.run_code).filter(Boolean))].sort().reverse();
  const brandOpts = [...new Set(pendingRows.map(r => r.brand).filter(Boolean))].sort();
  const receiveDateOpts = [...new Set(pendingRows.map(r => r.received_at ? String(r.received_at).slice(0, 10) : "").filter(Boolean))].sort().reverse();

  function clearFilters() { setSearch(""); setBranchFilter(""); setRunFilter(""); setReceiveDateFilter(""); setBrandFilter(""); }
  const selectedRows = filtered.filter(r => selected[r.submission_id]);
  const selCount = selectedRows.length;

  function toggleOne(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (filtered.every(r => selected[r.submission_id])) {
      const next = { ...selected };
      filtered.forEach(r => delete next[r.submission_id]);
      setSelected(next);
    } else {
      const next = { ...selected };
      filtered.forEach(r => { next[r.submission_id] = true; });
      setSelected(next);
    }
  }

  function printNotifyList() {
    const rowsToPrint = selCount > 0 ? selectedRows : filtered;
    if (rowsToPrint.length === 0) { setMessage("ไม่มีรายการให้พิมพ์"); return; }
    const branchLabel = branchFilter || fmtBranch(rowsToPrint[0]?.branch_code);
    const html = buildNotifyHTML({ rows: rowsToPrint, branch: branchLabel });
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { setMessage("popup blocked"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  async function saveSentToBranch() {
    if (selCount === 0) { setMessage("เลือกรายการก่อนบันทึก"); return; }
    if (!sentDate) { setMessage("กรอกวันที่ส่งคืนสาขา"); return; }
    if (!window.confirm(`บันทึกวันที่ส่งคืนสาขา ${fmtDate(sentDate)} สำหรับ ${selCount} รายการ?`)) return;
    setSavingSent(true);
    try {
      // อัพเดททีละรายการ (ใช้ update_submission ที่มีอยู่)
      await Promise.all(selectedRows.map(r =>
        fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update_submission", submission_id: r.submission_id, sent_to_branch_at: sentDate }),
        }).then(x => x.json())
      ));
      setMessage(`✅ บันทึกวันส่งคืนสาขา ${selCount} รายการสำเร็จ`);
      setSelected({});
      fetchReceived();
    } catch {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSavingSent(false);
  }

  async function markReturned(id, runCode) {
    if (!window.confirm(`เปลี่ยนสถานะเป็น "ส่งคืนลูกค้าแล้ว"?\n${runCode}`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_submission", submission_id: id, status: "returned" }),
      }).then(r => r.json());
      setMessage(`✅ ส่งคืนลูกค้าแล้ว — ${runCode}`);
      fetchReceived();
    } catch { setMessage("❌ ไม่สำเร็จ"); }
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[
          ["pending", "📮 รอส่งสาขา", rows.filter(r => !r.sent_to_branch_at).length],
          ["sent", "✅ ส่งสาขาแล้ว", rows.filter(r => r.sent_to_branch_at).length],
          ["all", "📋 ทั้งหมด", rows.length],
        ].map(([v, label, n]) => (
          <button key={v} onClick={() => setViewMode(v)}
            style={{ padding: "6px 14px", border: "1px solid " + (viewMode === v ? "#072d6b" : "#d1d5db"), background: viewMode === v ? "#072d6b" : "#fff", color: viewMode === v ? "#fff" : "#374151", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {label} ({n})
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <select value={runFilter} onChange={e => setRunFilter(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, minWidth: 150 }}>
          <option value="">เลขที่ใบรับทะเบียน (ทั้งหมด)</option>
          {runOpts.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={receiveDateFilter} onChange={e => setReceiveDateFilter(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, minWidth: 140 }}>
          <option value="">วันที่รับทะเบียน (ทั้งหมด)</option>
          {receiveDateOpts.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
        </select>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, minWidth: 120 }}>
          <option value="">ยี่ห้อ (ทั้งหมด)</option>
          {brandOpts.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, minWidth: 130 }}>
          <option value="">ร้านที่ขาย (ทั้งหมด)</option>
          {branchOpts.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {(search || branchFilter || runFilter || receiveDateFilter || brandFilter) && (
          <button onClick={clearFilters}
            style={{ padding: "6px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
            ✕ ล้าง
          </button>
        )}
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ลูกค้า / เบอร์ / เครื่อง / ทะเบียน"
          style={{ flex: 1, minWidth: 180, padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
        <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{selCount > 0 ? `เลือก ${selCount}/` : ""}{filtered.length} / {rows.length} รายการ</span>
        <button onClick={printNotifyList} disabled={filtered.length === 0}
          style={{ padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          🖨️ พิมพ์ใบนำส่งป้าย {selCount > 0 ? `(${selCount})` : "ทั้งหมด"}
        </button>
        <button onClick={fetchReceived}
          style={{ padding: "8px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>🔄</button>
      </div>

      {/* Save sent-to-branch date — แสดงเฉพาะ view "รอส่ง" */}
      {viewMode === "pending" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#ecfdf5", borderRadius: 10, border: "1px solid #a7f3d0" }}>
          <strong style={{ fontSize: 13, color: "#065f46" }}>📦 บันทึกวันที่ส่งคืนสาขา:</strong>
          <input type="date" value={sentDate} onChange={e => setSentDate(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
          <button onClick={saveSentToBranch} disabled={selCount === 0 || savingSent}
            style={{ padding: "7px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: (selCount === 0 || savingSent) ? "not-allowed" : "pointer", opacity: (selCount === 0 || savingSent) ? 0.5 : 1, fontSize: 13, fontWeight: 600 }}>
            💾 {savingSent ? "กำลังบันทึก..." : `บันทึกวันส่ง (${selCount})`}
          </button>
          <span style={{ fontSize: 11, color: "#047857", fontStyle: "italic" }}>เลือกรายการในตารางก่อน แล้วกดบันทึก · ค่าจะเก็บในฟิลด์ sent_to_branch_at</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          {rows.length === 0 ? "ยังไม่มีรายการที่รับคืนทะเบียนแล้ว" : "ไม่พบรายการตามที่ค้นหา"}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}><input type="checkbox" checked={filtered.length > 0 && filtered.every(r => selected[r.submission_id])} onChange={toggleAll} /></th>
                <th style={{ width: 40 }}>#</th>
                <th>ลูกค้า</th>
                <th>เบอร์โทร</th>
                <th>เลขเครื่อง</th>
                <th>หมวด</th>
                <th>เลขทะเบียน</th>
                <th>run</th>
                <th>สาขา</th>
                <th>วันส่งสาขา</th>
                <th style={{ width: 110 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.submission_id} style={{ background: selected[r.submission_id] ? "#eff6ff" : undefined, cursor: "pointer" }}
                  onClick={() => toggleOne(r.submission_id)}>
                  <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={!!selected[r.submission_id]} onChange={() => toggleOne(r.submission_id)} />
                  </td>
                  <td style={{ textAlign: "center" }}>{i + 1}</td>
                  <td>{r.customer_name || "-"}</td>
                  <td style={{ fontFamily: "monospace" }}>{r.customer_phone || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.engine_no || "-"}</td>
                  <td>{r.plate_category || "-"}</td>
                  <td style={{ fontWeight: 600 }}>{r.plate_number || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.run_code}</td>
                  <td>{fmtBranch(r.branch_code)}</td>
                  <td style={{ fontSize: 12, color: r.sent_to_branch_at ? "#065f46" : "#9ca3af", fontWeight: r.sent_to_branch_at ? 600 : 400 }}>
                    {r.sent_to_branch_at ? fmtDate(r.sent_to_branch_at) : "—"}
                  </td>
                  <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => markReturned(r.submission_id, r.run_code)}
                      style={{ padding: "4px 10px", background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
                      ✓ ส่งคืนแล้ว
                    </button>
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

/* ============================================================================
   FINANCE DISPATCH TAB — รอส่งเล่มไฟแนนท์
   ============================================================================ */
function FinancePanel({ setMessage, currentUser }) {
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);   // dispatch history
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState({});
  const [financeFilter, setFinanceFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [runFilter, setRunFilter] = useState("");
  const [dispatchedAt, setDispatchedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [savingDispatch, setSavingDispatch] = useState(false);
  const [viewMode, setViewMode] = useState("pending"); // pending | sent | all | history

  async function fetchReceived() {
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_submissions", status: "received" }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }

  async function fetchHistory() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_finance_dispatch", limit: 500 }),
      });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch { setHistory([]); }
  }

  useEffect(() => { fetchReceived(); fetchHistory(); }, []);

  // เฉพาะที่มี finance_company (คือเป็น "ผ่อน")
  const eligibleRows = rows.filter(r => r.finance_company && String(r.finance_company).trim() !== "");

  const pendingRows = viewMode === "pending" ? eligibleRows.filter(r => !r.sent_to_finance_at)
                    : viewMode === "sent" ? eligibleRows.filter(r => r.sent_to_finance_at)
                    : eligibleRows;

  const kw = search.trim().toLowerCase();
  const filtered = pendingRows.filter(r => {
    if (financeFilter && r.finance_company !== financeFilter) return false;
    if (brandFilter && r.brand !== brandFilter) return false;
    if (runFilter && r.run_code !== runFilter) return false;
    if (!kw) return true;
    const hay = [r.customer_name, r.customer_phone, r.engine_no, r.plate_number, r.run_code, r.finance_company]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const financeOpts = [...new Set(eligibleRows.map(r => r.finance_company).filter(Boolean))].sort();
  const brandOpts = [...new Set(pendingRows.map(r => r.brand).filter(Boolean))].sort();
  const runOpts = [...new Set(pendingRows.map(r => r.run_code).filter(Boolean))].sort().reverse();

  function clearFilters() { setSearch(""); setFinanceFilter(""); setBrandFilter(""); setRunFilter(""); }
  // เลือกทั้งหมดที่เคย tick — ไม่ขึ้นกับ filter ปัจจุบัน (ค้นหา/กรองใหม่ ยังจำที่เลือกไว้)
  const selectedRows = pendingRows.filter(r => selected[r.submission_id]);
  const selCount = selectedRows.length;
  const selCountInView = filtered.filter(r => selected[r.submission_id]).length;

  function toggleOne(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (filtered.every(r => selected[r.submission_id])) {
      const next = { ...selected };
      filtered.forEach(r => delete next[r.submission_id]);
      setSelected(next);
    } else {
      const next = { ...selected };
      filtered.forEach(r => { next[r.submission_id] = true; });
      setSelected(next);
    }
  }

  // group selected rows by finance_company — 1 ใบนำส่งต่อ 1 ไฟแนนท์
  function groupByFinance(rs) {
    const map = {};
    rs.forEach(r => {
      const key = r.finance_company || "(ไม่ระบุ)";
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }

  function printDispatch() {
    const rowsToPrint = selCount > 0 ? selectedRows : filtered;
    if (rowsToPrint.length === 0) { setMessage("ไม่มีรายการให้พิมพ์"); return; }
    const groups = groupByFinance(rowsToPrint);
    const html = buildFinanceDispatchHTML({ groups });
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { setMessage("popup blocked"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  async function saveDispatch() {
    if (selCount === 0) { setMessage("เลือกรายการก่อนบันทึก"); return; }
    if (!dispatchedAt) { setMessage("กรอกวันที่นำส่ง"); return; }
    const groups = groupByFinance(selectedRows);
    const finCount = Object.keys(groups).length;
    if (!window.confirm(`บันทึกการนำส่งวันที่ ${fmtDate(dispatchedAt)}\nไฟแนนท์ ${finCount} แห่ง · ${selCount} รายการ\n\nระบบจะสร้าง 1 ใบนำส่งต่อ 1 ไฟแนนท์`)) return;
    setSavingDispatch(true);
    try {
      // 1 batch ต่อ 1 ไฟแนนท์
      const results = await Promise.all(Object.entries(groups).map(([finCo, items]) =>
        fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_finance_dispatch",
            finance_company: finCo,
            dispatched_at: dispatchedAt,
            dispatched_by: currentUser?.username || "system",
            submission_ids: items.map(r => r.submission_id),
          }),
        }).then(x => x.json())
      ));
      const docs = results.flatMap(r => Array.isArray(r) ? r : [r]).map(r => r.dispatch_no).filter(Boolean);
      setMessage(`✅ บันทึกการนำส่ง ${docs.length} ใบ — ${docs.join(", ")}`);
      setSelected({});
      fetchReceived(); fetchHistory();
    } catch {
      setMessage("❌ บันทึกไม่สำเร็จ");
    }
    setSavingDispatch(false);
  }

  async function cancelDispatch(doc) {
    if (!doc) return;
    if (!window.confirm(`ยกเลิกใบนำส่ง ${doc}?\n\nรายการในใบจะถูกย้อนกลับไปสถานะ "รอส่ง" ทันที`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_finance_dispatch", dispatch_no: doc }),
      });
      setMessage(`✅ ยกเลิกใบ ${doc} แล้ว`);
      fetchReceived(); fetchHistory();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[
          ["pending", "📮 รอส่งเล่มไฟแนนท์", eligibleRows.filter(r => !r.sent_to_finance_at).length],
          ["sent", "✅ ส่งแล้ว", eligibleRows.filter(r => r.sent_to_finance_at).length],
          ["all", "📋 ทั้งหมด", eligibleRows.length],
          ["history", "🗂️ ประวัติใบนำส่ง", history.length],
        ].map(([v, label, n]) => (
          <button key={v} onClick={() => setViewMode(v)}
            style={{ padding: "6px 14px", border: "1px solid " + (viewMode === v ? "#072d6b" : "#d1d5db"), background: viewMode === v ? "#072d6b" : "#fff", color: viewMode === v ? "#fff" : "#374151", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {label} ({n})
          </button>
        ))}
      </div>

      {viewMode === "history" ? (
        <FinanceDispatchHistory history={history} rows={eligibleRows} onCancel={cancelDispatch} />
      ) : (
        <>
          {/* Filter bar */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <select value={financeFilter} onChange={e => setFinanceFilter(e.target.value)}
              style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, minWidth: 180 }}>
              <option value="">ไฟแนนท์ (ทั้งหมด)</option>
              {financeOpts.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
              style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, minWidth: 120 }}>
              <option value="">ยี่ห้อ (ทั้งหมด)</option>
              {brandOpts.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={runFilter} onChange={e => setRunFilter(e.target.value)}
              style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, minWidth: 140 }}>
              <option value="">เลข run (ทั้งหมด)</option>
              {runOpts.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {(search || financeFilter || brandFilter || runFilter) && (
              <button onClick={clearFilters}
                style={{ padding: "6px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                ✕ ล้าง
              </button>
            )}
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 ลูกค้า / เบอร์ / เครื่อง / ทะเบียน / ไฟแนนท์"
              style={{ flex: 1, minWidth: 200, padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
            <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
              {selCount > 0 && <span style={{ color: "#7c3aed", fontWeight: 600 }}>เลือก {selCount}{selCount !== selCountInView ? ` (${selCountInView} ในมุมมอง)` : ""} • </span>}
              {filtered.length} / {eligibleRows.length} รายการ
            </span>
            {selCount > 0 && (
              <button onClick={() => setSelected({})}
                style={{ padding: "5px 10px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>
                ล้างที่เลือก ({selCount})
              </button>
            )}
            <button onClick={printDispatch} disabled={filtered.length === 0}
              style={{ padding: "8px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              🖨️ พิมพ์ใบนำส่งเล่มทะเบียน {selCount > 0 ? `(${selCount})` : "ทั้งหมด"}
            </button>
            <button onClick={() => { fetchReceived(); fetchHistory(); }}
              style={{ padding: "8px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>🔄</button>
          </div>

          {/* Save dispatch — แสดงเฉพาะ view รอส่ง */}
          {viewMode === "pending" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fbbf24" }}>
              <strong style={{ fontSize: 13, color: "#92400e" }}>🏦 บันทึกวันที่นำส่งเล่มทะเบียน:</strong>
              <input type="date" value={dispatchedAt} onChange={e => setDispatchedAt(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
              <button onClick={saveDispatch} disabled={selCount === 0 || savingDispatch}
                style={{ padding: "7px 16px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: (selCount === 0 || savingDispatch) ? "not-allowed" : "pointer", opacity: (selCount === 0 || savingDispatch) ? 0.5 : 1, fontSize: 13, fontWeight: 600 }}>
                💾 {savingDispatch ? "กำลังบันทึก..." : `บันทึก (${selCount})`}
              </button>
              <span style={{ fontSize: 11, color: "#78350f", fontStyle: "italic" }}>
                เลือกรายการก่อนบันทึก · ระบบจะสร้าง 1 ใบนำส่งต่อ 1 ไฟแนนท์ (เลข FNDP-YYMMDD-####)
              </span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
              {eligibleRows.length === 0 ? "ยังไม่มีรายการที่ผ่อนกับไฟแนนท์รับคืนทะเบียนแล้ว" : "ไม่พบรายการตามที่ค้นหา"}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={filtered.length > 0 && filtered.every(r => selected[r.submission_id])} onChange={toggleAll} /></th>
                    <th style={{ width: 40 }}>#</th>
                    <th>ไฟแนนท์</th>
                    <th>ลูกค้า</th>
                    <th>เลขเครื่อง</th>
                    <th>หมวด</th>
                    <th>เลขทะเบียน</th>
                    <th>สี</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.submission_id} style={{ background: selected[r.submission_id] ? "#eff6ff" : (r.sent_to_finance_at ? "#ecfdf5" : undefined), cursor: "pointer" }}
                      onClick={() => toggleOne(r.submission_id)}>
                      <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={!!selected[r.submission_id]} onChange={() => toggleOne(r.submission_id)} />
                      </td>
                      <td style={{ textAlign: "center" }}>{i + 1}</td>
                      <td style={{ fontWeight: 600, color: "#92400e" }}>{r.finance_company || "-"}</td>
                      <td>{r.customer_name || "-"}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.engine_no || "-"}</td>
                      <td style={{ textAlign: "center" }}>{r.plate_category || "-"}</td>
                      <td style={{ fontWeight: 600 }}>{r.plate_number || "-"}</td>
                      <td>{r.color_name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FinanceDispatchHistory({ history, rows = [], onCancel }) {
  if (!history.length) {
    return <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
      ยังไม่มีประวัติการนำส่ง
    </div>;
  }

  function reprintDispatch(h) {
    // ดึง submission_ids จาก source_submission_ids (jsonb array)
    let ids = [];
    try {
      ids = Array.isArray(h.source_submission_ids) ? h.source_submission_ids
          : typeof h.source_submission_ids === "string" ? JSON.parse(h.source_submission_ids)
          : [];
    } catch { ids = []; }
    const items = rows.filter(r => ids.includes(r.submission_id));
    if (items.length === 0) {
      alert("ไม่พบรายการในใบนำส่งนี้ — อาจถูกยกเลิก/ลบ");
      return;
    }
    const finCo = h.finance_company || "(ไม่ระบุ)";
    const groups = { [finCo]: items };
    const html = buildFinanceDispatchHTML({ groups });
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { alert("popup blocked"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>วันที่ส่ง</th>
            <th>ชื่อไฟแนนท์</th>
            <th style={{ textAlign: "right" }}>จำนวนที่ส่ง</th>
            <th style={{ width: 180, textAlign: "center" }}>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {history.map(h => (
            <tr key={h.dispatch_id}>
              <td>{fmtDate(h.dispatched_at)}</td>
              <td style={{ fontWeight: 600 }}>{h.finance_company || "-"}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{h.total_count}</td>
              <td style={{ textAlign: "center" }}>
                <button onClick={() => reprintDispatch(h)}
                  style={{ padding: "4px 10px", background: "#10b981", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 }}>
                  🖨️ พิมพ์
                </button>
                <button onClick={() => onCancel(h.dispatch_no)}
                  style={{ padding: "4px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
                  ✕ ยกเลิก
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildFinanceDispatchHTML({ groups }) {
  const today = new Date();
  const dstr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear() + 543}`;
  const safe = s => s === null || s === undefined ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sections = Object.entries(groups).map(([finCo, rows]) => {
    const tr = rows.map((r, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${safe(r.customer_name)}</td>
        <td class="mono">${safe(r.engine_no)}</td>
        <td class="mono">${safe(r.chassis_no)}</td>
        <td class="c">${safe(r.plate_category)}</td>
        <td class="c b">${safe(r.plate_number)}</td>
        <td class="c">${safe(r.color_name)}</td>
      </tr>`).join("");
    return `
    <div class="section">
      <div class="header">
        <h1>ใบนำส่งเล่มทะเบียนรถ</h1>
        <div class="meta">
          <strong>ส่งถึง:</strong> ${safe(finCo)}
          &nbsp;&nbsp; <strong>วันที่พิมพ์:</strong> ${dstr}
          &nbsp;&nbsp; <strong>จำนวน:</strong> ${rows.length} ราย
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:36px">#</th>
            <th>ชื่อลูกค้า</th>
            <th style="width:110px">เลขเครื่อง</th>
            <th style="width:110px">เลขตัวถัง</th>
            <th style="width:50px">หมวด</th>
            <th style="width:70px">เลขทะเบียน</th>
            <th style="width:80px">สี</th>
          </tr>
        </thead>
        <tbody>${tr}</tbody>
      </table>
      <div class="footer">
        <div>ผู้นำส่ง: ____________________________</div>
        <div>ผู้รับ: ____________________________</div>
      </div>
    </div>
    <div class="page-break"></div>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>ใบนำส่งเล่มทะเบียนรถ</title>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Sarabun","Tahoma",sans-serif; font-size: 13px; color: #111; margin: 0; }
  .section { max-width: 297mm; margin: 0 auto 15px; }
  .header { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
  .header h1 { margin: 0; font-size: 18px; }
  .header .meta { font-size: 13px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th,td { border: 1px solid #333; padding: 5px 6px; vertical-align: middle; }
  th { background: #fef3c7; text-align: center; font-weight: 600; }
  .c { text-align: center; }
  .mono { font-family: "Consolas",monospace; font-size: 11px; }
  .b { font-weight: 700; }
  tbody tr { min-height: 32px; }
  .footer { display: flex; justify-content: space-between; margin-top: 30px; padding: 0 30px; font-size: 12px; }
  .page-break { page-break-after: always; }
  .page-break:last-child { page-break-after: auto; }
</style></head><body>
${sections}
</body></html>`;
}

function buildNotifyHTML({ rows, branch }) {
  const today = new Date();
  const dstr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear() + 543}`;
  const safe = s => s === null || s === undefined ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tr = rows.map((r, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${safe(r.customer_name)}</td>
      <td class="mono">${safe(r.customer_phone)}</td>
      <td class="mono">${safe(r.engine_no)}</td>
      <td class="c">${safe(r.plate_category)}</td>
      <td class="c b">${safe(r.plate_number)}</td>
      <td class="sig"></td>
      <td></td>
      <td></td>
    </tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>ใบนำส่งป้ายทะเบียน</title>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Sarabun","Tahoma",sans-serif; font-size: 13px; color: #111; margin: 0; }
  .doc { max-width: 297mm; margin: 0 auto; }
  .header { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
  .header h1 { margin: 0; font-size: 18px; }
  .header .meta { font-size: 13px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th,td { border: 1px solid #333; padding: 5px 6px; vertical-align: middle; }
  th { background: #e5e7eb; text-align: center; font-weight: 600; }
  .c { text-align: center; }
  .mono { font-family: "Consolas",monospace; font-size: 11px; }
  .b { font-weight: 700; }
  tbody tr { min-height: 32px; }
  .sign { margin-top: 24px; font-size: 12px; text-align: right; }
</style></head><body>
<div class="doc">
  <div class="header">
    <h1>ใบนำส่งป้ายทะเบียนรถ</h1>
    <div class="meta"><strong>สาขา:</strong> ${safe(branch)}   <strong>วันที่พิมพ์:</strong> ${dstr}   <strong>จำนวน:</strong> ${rows.length} ราย</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>ชื่อลูกค้า</th>
        <th style="width:90px">เบอร์โทร</th>
        <th style="width:110px">เลขเครื่อง</th>
        <th style="width:50px">หมวด</th>
        <th style="width:70px">เลขทะเบียน</th>
        <th style="width:120px">ลายเซ็นลูกค้า</th>
        <th style="width:80px">วันที่รับ</th>
        <th style="width:90px">ผู้จ่าย</th>
      </tr>
    </thead>
    <tbody>${tr}</tbody>
  </table>
  <div class="sign">พิมพ์จากระบบ Management · ${new Date().toLocaleString("th-TH")}</div>
</div>
</body></html>`;
}

function fmtBranch(code) {
  if (!code) return "-";
  const s = String(code).trim();
  // 0, 0000, 00000 → SCY01 (สำนักงานใหญ่)
  if (/^0+$/.test(s)) return "SCY01";
  return s;
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
