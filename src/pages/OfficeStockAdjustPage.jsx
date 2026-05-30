import React, { useEffect, useMemo, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/office-api";

const text = (v) => (v ?? "").toString().trim();
const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};
const fmt = (v, d = 2) =>
  toNumber(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const newRow = () => ({
  _id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  product_id: "", product_name: "", unit: "", qty_before: null,
  qty_add: "", qty_remove: "", unit_cost: "",
});

export default function OfficeStockAdjustPage({ currentUser } = {}) {
  const [materials, setMaterials] = useState([]);
  const [username, setUsername] = useState("");
  const [branch, setBranch] = useState("");
  const [adjustDate, setAdjustDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [rows, setRows] = useState([newRow()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: "success", title: "", message: "" });
  const [mode, setMode] = useState("form"); // form | history | detail
  const [historyRows, setHistoryRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const fmtDate = (v) => {
    if (!v) return "-";
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${Number(m[1]) + 543}`;
    return String(v);
  };

  const openPopup = (type, title, message) => setPopup({ open: true, type, title, message });
  const closePopup = () => setPopup((p) => ({ ...p, open: false }));

  const normalize = (data) =>
    Array.isArray(data) ? data : data?.items || data?.data || data?.rows || [];

  const apiPost = async (payload) => {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  useEffect(() => {
    if (currentUser) {
      setUsername(text(currentUser.name || currentUser.username || ""));
      setBranch(text(currentUser.branch || ""));
    }
  }, [currentUser]);

  useEffect(() => {
    if (branch) loadMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch]);

  const stockGroup = useMemo(() => {
    const code = (branch || "").substring(0, 5);
    return ["SCY05", "SCY06"].includes(code) ? "ppao" : "singchai";
  }, [branch]);

  async function loadMaterials() {
    try {
      setLoading(true);
      const data = await apiPost({ action: "load_materials", stock_group: stockGroup });
      const list = normalize(data).filter((r) => r.stock_group === stockGroup);
      setMaterials(list);
    } catch {
      setMaterials([]);
      openPopup("error", "โหลดข้อมูลไม่สำเร็จ", "ไม่สามารถโหลดรายการวัสดุได้");
    } finally {
      setLoading(false);
    }
  }

  const matByCode = useMemo(() => {
    const m = new Map();
    for (const it of materials) m.set(text(it.product_id), it);
    return m;
  }, [materials]);

  const setRow = (id, patch) =>
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, ...patch } : r)));

  const pickProduct = (id, productId) => {
    const it = matByCode.get(text(productId));
    setRow(id, {
      product_id: text(productId),
      product_name: it ? text(it.product_name) : "",
      unit: it ? text(it.unit) : "",
      qty_before: it ? toNumber(it.qty_on_hand) : null,
    });
  };

  const rowAmount = (r) => (toNumber(r.qty_add) - toNumber(r.qty_remove)) * toNumber(r.unit_cost);
  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (id) =>
    setRows((prev) => (prev.length <= 1 ? [newRow()] : prev.filter((r) => r._id !== id)));

  const totals = useMemo(() => {
    let add = 0, rem = 0, amt = 0;
    for (const r of rows) { add += toNumber(r.qty_add); rem += toNumber(r.qty_remove); amt += rowAmount(r); }
    return { add, rem, amt };
  }, [rows]);

  const resetForm = () => {
    setNote(""); setAdjustDate(todayStr()); setRows([newRow()]);
  };

  async function handleSave() {
    if (!text(username)) return openPopup("error", "บันทึกไม่สำเร็จ", "ไม่พบข้อมูลผู้บันทึก");
    if (!text(note)) return openPopup("error", "บันทึกไม่สำเร็จ", "กรุณากรอกหมายเหตุ");
    const valid = rows.filter(
      (r) => text(r.product_id) && (toNumber(r.qty_add) > 0 || toNumber(r.qty_remove) > 0)
    );
    if (valid.length === 0)
      return openPopup("error", "บันทึกไม่สำเร็จ", "ต้องมีรายการที่มีเพิ่มเข้า หรือ ลดออก อย่างน้อย 1 รายการ");

    const payload = {
      action: "save_office_adjustment",
      username, branch, adjust_date: adjustDate, note: text(note),
      items: valid.map((r, i) => ({
        line_no: i + 1,
        product_id: r.product_id,
        product_name: r.product_name,
        unit: r.unit,
        qty_before: r.qty_before,
        qty_add: toNumber(r.qty_add),
        qty_remove: toNumber(r.qty_remove),
        unit_cost: toNumber(r.unit_cost),
      })),
    };
    try {
      setSaving(true);
      const raw = await apiPost(payload);
      const data = Array.isArray(raw) ? raw[0] : raw;
      const ok = data?.ok === true || data?.success === true || data?.status === "success";
      if (ok) {
        openPopup("success", "บันทึกสำเร็จ", data?.message || "บันทึกปรับปรุงวัสดุเรียบร้อย");
        resetForm();
        await loadMaterials();
      } else {
        openPopup("error", "บันทึกไม่สำเร็จ", data?.message || "ไม่สามารถบันทึกได้");
      }
    } catch {
      openPopup("error", "บันทึกไม่สำเร็จ", "เชื่อมต่อระบบไม่สำเร็จ — ตรวจสอบว่า import workflow + สร้างตารางแล้ว");
    } finally {
      setSaving(false);
    }
  }

  async function handleHistory() {
    try {
      setBusy(true); setMode("history"); setDetail(null);
      const raw = await apiPost({ action: "get_adjust_history" });
      const data = Array.isArray(raw) ? (raw[0]?.data || raw) : (raw?.data || []);
      setHistoryRows(Array.isArray(data) ? data : []);
    } catch {
      setHistoryRows([]);
      openPopup("error", "ค้นหาไม่สำเร็จ", "ไม่สามารถโหลดประวัติการปรับปรุงได้");
    } finally { setBusy(false); }
  }

  async function handleOpen(adjustNo) {
    try {
      setBusy(true);
      const raw = await apiPost({ action: "open_adjust", adjust_no: adjustNo });
      const data = Array.isArray(raw) ? raw[0] : raw;
      if (!data?.success) throw new Error("not found");
      setDetail({ header: data.header || {}, items: data.items || [] });
      setMode("detail");
    } catch {
      openPopup("error", "เปิดใบปรับปรุงไม่สำเร็จ", "ไม่พบรายละเอียด");
    } finally { setBusy(false); }
  }

  const filteredHistory = historyRows; // (เผื่อต่อยอดค้นหาภายหลัง)

  const cell = { padding: "6px 8px", border: "1px solid #e2e8f0" };
  const numInput = { width: 90, border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 6px", fontSize: 13, textAlign: "right" };

  return (
    <>
      <div className="page-container">
        <div className="page-topbar">
          <h2 className="page-title">🛠️ ปรับปรุงวัสดุคงเหลือ</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className={mode === "form" ? "btn-primary" : "btn-secondary"}
              onClick={() => { setMode("form"); setDetail(null); }}>📋 ปรับปรุงวัสดุ</button>
            <button className={mode === "history" || mode === "detail" ? "btn-primary" : "btn-secondary"}
              onClick={handleHistory} disabled={busy}>{busy && mode !== "detail" ? "กำลังโหลด..." : "🔍 ประวัติการปรับปรุง"}</button>
            <div style={{ fontSize: 13, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 12px" }}>
              👤 {username || "-"} &nbsp;|&nbsp; 🏢 {branch || "-"}
            </div>
          </div>
        </div>

        {mode === "form" && (<>
        {/* HEADER FORM */}
        <div className="form-card">
          <h3 style={{ margin: "0 0 14px 0", fontSize: 16, color: "#072d6b" }}>➕ เพิ่มข้อมูล</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>เลขที่ใบปรับปรุง</label>
              <input className="form-input" style={{ width: "100%", boxSizing: "border-box", background: "#f1f5f9" }}
                value="" readOnly placeholder="ระบบออกเลขให้อัตโนมัติ" />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>วันที่ปรับปรุง <span style={{ color: "#ef4444" }}>*</span></label>
              <input className="form-input" type="date" style={{ width: "100%", boxSizing: "border-box" }}
                value={adjustDate} onChange={(e) => setAdjustDate(e.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>หมายเหตุ <span style={{ color: "#ef4444" }}>*</span></label>
              <input className="form-input" style={{ width: "100%", boxSizing: "border-box" }}
                value={note} onChange={(e) => setNote(e.target.value)} placeholder="เหตุผลการปรับปรุง" />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>ผู้บันทึก <span style={{ color: "#ef4444" }}>*</span></label>
              <input className="form-input" style={{ width: "100%", boxSizing: "border-box", background: "#f1f5f9" }}
                value={username} readOnly />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "center" }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
            </button>
            <button className="btn-secondary" onClick={resetForm} disabled={saving}>↩ ปิด/ล้าง</button>
          </div>
        </div>

        {/* ITEM LIST */}
        <div className="form-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "#072d6b" }}>📋 รายการสินค้า {loading ? "(กำลังโหลด...)" : `(วัสดุ ${materials.length} รายการ)`}</h3>
            <button className="btn-secondary" onClick={addRow}>➕ เพิ่มแถว</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th style={{ textAlign: "left" }}>รหัสสินค้า</th>
                  <th style={{ textAlign: "left" }}>ชื่อสินค้า</th>
                  <th>หน่วย</th>
                  <th>คงเหลือ</th>
                  <th>เพิ่มเข้า</th>
                  <th>ลดออก</th>
                  <th>ราคาทุน</th>
                  <th>เป็นเงิน</th>
                  <th>ลบ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r._id}>
                    <td style={cell}>{i + 1}</td>
                    <td style={cell}>
                      <input list="adj-material-list" value={r.product_id}
                        onChange={(e) => pickProduct(r._id, e.target.value)}
                        placeholder="พิมพ์/เลือกรหัส"
                        style={{ width: 160, border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 6px", fontSize: 13, fontFamily: "monospace" }} />
                    </td>
                    <td style={{ ...cell, textAlign: "left" }}>{r.product_name || <span style={{ color: "#94a3b8" }}>-</span>}</td>
                    <td style={{ ...cell, textAlign: "center" }}>{r.unit || "-"}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{r.qty_before === null ? "-" : fmt(r.qty_before, 0)}</td>
                    <td style={cell}>
                      <input type="number" min="0" value={r.qty_add} style={numInput}
                        onChange={(e) => setRow(r._id, { qty_add: e.target.value })} />
                    </td>
                    <td style={cell}>
                      <input type="number" min="0" value={r.qty_remove} style={numInput}
                        onChange={(e) => setRow(r._id, { qty_remove: e.target.value })} />
                    </td>
                    <td style={cell}>
                      <input type="number" min="0" step="0.01" value={r.unit_cost} style={numInput}
                        onChange={(e) => setRow(r._id, { unit_cost: e.target.value })} />
                    </td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: rowAmount(r) < 0 ? "#dc2626" : "#065f46" }}>
                      {fmt(rowAmount(r))}
                    </td>
                    <td style={{ ...cell, textAlign: "center" }}>
                      <button onClick={() => removeRow(r._id)}
                        style={{ background: "#fff", color: "#ef4444", border: "1px solid #ef4444", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                  <td style={cell} colSpan={5}>ยอดรวม</td>
                  <td style={{ ...cell, textAlign: "right" }}>{fmt(totals.add, 0)}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{fmt(totals.rem, 0)}</td>
                  <td style={cell}></td>
                  <td style={{ ...cell, textAlign: "right", color: totals.amt < 0 ? "#dc2626" : "#065f46" }}>{fmt(totals.amt)}</td>
                  <td style={cell}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <datalist id="adj-material-list">
            {materials.map((m) => (
              <option key={text(m.product_id)} value={text(m.product_id)}>
                {text(m.product_name)} ({text(m.unit)}) · คงเหลือ {fmt(m.qty_on_hand, 0)}
              </option>
            ))}
          </datalist>
        </div>
        </>)}

        {/* HISTORY LIST */}
        {mode === "history" && (
          <div className="form-card">
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16, color: "#072d6b" }}>🔍 ประวัติการปรับปรุงวัสดุ ({filteredHistory.length} ใบ)</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>เลขที่ใบปรับปรุง</th>
                    <th>วันที่</th>
                    <th style={{ textAlign: "left" }}>หมายเหตุ</th>
                    <th>ผู้บันทึก</th>
                    <th>จำนวนรายการ</th>
                    <th>ยอดรวม</th>
                    <th>เปิด</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length > 0 ? filteredHistory.map((h, i) => (
                    <tr key={`${h.adjust_no}-${i}`}>
                      <td>{h.adjust_no || "-"}</td>
                      <td>{fmtDate(h.adjust_date)}</td>
                      <td style={{ textAlign: "left" }}>{h.note || "-"}</td>
                      <td>{h.created_by || "-"}</td>
                      <td>{toNumber(h.item_count)}</td>
                      <td style={{ textAlign: "right" }}>{fmt(h.total_amount)}</td>
                      <td>
                        <button className="btn-primary" style={{ padding: "4px 12px", fontSize: 12 }}
                          onClick={() => handleOpen(h.adjust_no)} disabled={busy}>เปิด</button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7}>{busy ? "กำลังโหลด..." : "ไม่พบประวัติ"}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DETAIL */}
        {mode === "detail" && detail && (
          <div className="form-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#072d6b" }}>📄 รายละเอียดใบปรับปรุง</h3>
              <button className="btn-secondary" onClick={handleHistory}>← กลับไปประวัติ</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
              {[
                ["เลขที่ใบปรับปรุง", detail.header.adjust_no],
                ["วันที่ปรับปรุง", fmtDate(detail.header.adjust_date)],
                ["ผู้บันทึก", detail.header.created_by],
                ["ยอดรวม", fmt(detail.header.total_amount)],
                ["หมายเหตุ", detail.header.note || "-"],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 700 }}>{value || "-"}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ minWidth: 800 }}>
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th style={{ textAlign: "left" }}>รหัสสินค้า</th>
                    <th style={{ textAlign: "left" }}>ชื่อสินค้า</th>
                    <th>หน่วย</th>
                    <th>คงเหลือเดิม</th>
                    <th>เพิ่มเข้า</th>
                    <th>ลดออก</th>
                    <th>ราคาทุน</th>
                    <th>เป็นเงิน</th>
                    <th>คงเหลือใหม่</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.length > 0 ? detail.items.map((it, i) => (
                    <tr key={`${it.product_id}-${i}`}>
                      <td>{it.line_no ?? i + 1}</td>
                      <td style={{ textAlign: "left", fontFamily: "monospace" }}>{it.product_id || "-"}</td>
                      <td style={{ textAlign: "left" }}>{it.product_name || "-"}</td>
                      <td>{it.unit || "-"}</td>
                      <td style={{ textAlign: "right" }}>{it.qty_before == null ? "-" : fmt(it.qty_before, 0)}</td>
                      <td style={{ textAlign: "right" }}>{fmt(it.qty_add, 0)}</td>
                      <td style={{ textAlign: "right" }}>{fmt(it.qty_remove, 0)}</td>
                      <td style={{ textAlign: "right" }}>{fmt(it.unit_cost)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: toNumber(it.amount) < 0 ? "#dc2626" : "#065f46" }}>{fmt(it.amount)}</td>
                      <td style={{ textAlign: "right" }}>{it.qty_after == null ? "-" : fmt(it.qty_after, 0)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={10}>ไม่พบรายการ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* POPUP */}
      {popup.open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }} onClick={closePopup}>
          <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: popup.type === "success" ? "#10b981" : popup.type === "error" ? "#ef4444" : "#072d6b", color: "#fff", padding: "12px 18px", fontSize: 15, fontWeight: 700, textAlign: "center" }}>
              {popup.type === "success" ? "✔ สำเร็จ" : popup.type === "error" ? "✖ เกิดข้อผิดพลาด" : "ℹ แจ้งเตือน"}
            </div>
            <div style={{ padding: "18px 20px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#222", marginBottom: 6 }}>{popup.title}</div>
              <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{popup.message}</div>
            </div>
            <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "center" }}>
              <button style={{ minWidth: 90, background: popup.type === "success" ? "#10b981" : popup.type === "error" ? "#ef4444" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }} onClick={closePopup}>ตกลง</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
