import React, { useEffect, useState } from "react";

// ============================================================================
// หน้า "บันทึกโอนรถจักรยานยนต์ ระหว่างสาขา" — เมนู Sales
// ----------------------------------------------------------------------------
// ค้นรถด้วยเลขเครื่อง/เลขถัง (get_vehicle) → รู้ยี่ห้อ → ตั้งสาขาต้นทาง default:
//   ยามาฮ่า (YAMAHA) → SCY01 สำนักงานใหญ่ · ฮอนด้า (HONDA) → SCY06 ป.เปา วังน้อย
// บันทึกลง log ตาราง moto_transfers (ไม่ยุ่งสต๊อก) + ดูประวัติ/ยกเลิกได้
// backend: webhook moto-transfer-api (save_transfer / list_transfers / cancel_transfer)
// ============================================================================
const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const TRANSFER_API = `${BASE}/moto-transfer-api`;
const RETAIL_API = `${BASE}/retail-sale-api`; // get_vehicle (ค้นรถจากสต๊อก)

const BRANCHES = [
  { code: "SCY01", label: "SCY01 สำนักงานใหญ่ (สิงห์ชัย)" },
  { code: "SCY04", label: "SCY04 สีขวา (สิงห์ชัย)" },
  { code: "SCY05", label: "SCY05 ป.เปา นครหลวง" },
  { code: "SCY06", label: "SCY06 ป.เปา วังน้อย" },
  { code: "SCY07", label: "SCY07 สิงห์ชัยตลาด" },
];
const defaultFrom = (brand) => (String(brand || "").toUpperCase() === "YAMAHA" ? "SCY01" : "SCY06");

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDateTH(iso) {
  const m = String(iso || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${parseInt(m[1], 10) + 543}` : "-";
}
const brLabel = (c) => (BRANCHES.find((b) => b.code === c)?.label || c || "-");

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return raw.trim() ? JSON.parse(raw) : [];
}
const asArray = (d) => (Array.isArray(d) ? d : d?.data || d?.rows || []);

export default function MotoTransferPage({ currentUser }) {
  const [tab, setTab] = useState("record"); // record | history
  const [message, setMessage] = useState("");

  // ---- record ----
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [vehicle, setVehicle] = useState(null);
  const [form, setForm] = useState({ from_branch: "", to_branch: "", transfer_date: todayISO(), note: "" });
  const [saving, setSaving] = useState(false);

  // ---- history ----
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [hKeyword, setHKeyword] = useState("");
  const [hStatus, setHStatus] = useState("active");

  async function searchVehicle() {
    const kw = keyword.trim();
    if (!kw) { setMessage("❌ กรอกเลขเครื่อง/เลขถัง"); return; }
    setSearching(true); setMessage(""); setVehicle(null);
    try {
      const r = await postJson(RETAIL_API, { action: "get_vehicle", keyword: kw });
      const v = r && r.brand ? r : (Array.isArray(r) ? r[0] : null);
      if (!v || !v.brand) { setMessage("❌ ไม่พบรถคันนี้ในสต๊อก"); setSearching(false); return; }
      setVehicle(v);
      setForm((f) => ({ ...f, from_branch: defaultFrom(v.brand), to_branch: "" }));
    } catch (e) {
      setMessage("❌ ค้นหาไม่สำเร็จ: " + (e.message || e));
    }
    setSearching(false);
  }

  async function save() {
    if (!vehicle) { setMessage("❌ ค้นหารถก่อน"); return; }
    if (!form.from_branch || !form.to_branch) { setMessage("❌ เลือกสาขาต้นทาง/ปลายทาง"); return; }
    if (form.from_branch === form.to_branch) { setMessage("❌ สาขาต้นทางและปลายทางต้องต่างกัน"); return; }
    setSaving(true); setMessage("");
    try {
      const r = await postJson(TRANSFER_API, {
        action: "save_transfer",
        brand: vehicle.brand,
        engine_no: vehicle.engine_no || "",
        chassis_no: vehicle.chassis_no || "",
        model: [vehicle.model_name, vehicle.model_code].filter(Boolean).join(" / ") || vehicle.model_code || "",
        color: vehicle.color_name || vehicle.model_color || "",
        from_branch: form.from_branch,
        to_branch: form.to_branch,
        transfer_date: form.transfer_date,
        note: form.note,
        created_by: currentUser?.username || currentUser?.name || "system",
      });
      const row = Array.isArray(r) ? r[0] : r;
      if (!row || !row.transfer_no) throw new Error("บันทึกไม่สำเร็จ");
      setMessage(`✅ บันทึกโอนรถสำเร็จ — เลขที่ ${row.transfer_no} (${brLabel(form.from_branch)} → ${brLabel(form.to_branch)})`);
      setVehicle(null); setKeyword("");
      setForm({ from_branch: "", to_branch: "", transfer_date: todayISO(), note: "" });
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + (e.message || e));
    }
    setSaving(false);
  }

  async function loadRows() {
    setLoadingRows(true);
    try {
      const d = await postJson(TRANSFER_API, { action: "list_transfers", keyword: hKeyword.trim(), status: hStatus === "all" ? "" : hStatus });
      setRows(asArray(d).filter((x) => x && x.id != null));
    } catch { setRows([]); }
    setLoadingRows(false);
  }

  async function cancelRow(r) {
    if (!window.confirm(`ยกเลิกการโอน ${r.transfer_no}?`)) return;
    try {
      await postJson(TRANSFER_API, { action: "cancel_transfer", id: r.id, cancelled_by: currentUser?.username || currentUser?.name || "system" });
      setMessage(`✅ ยกเลิก ${r.transfer_no} แล้ว`);
      loadRows();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
  }

  useEffect(() => { if (tab === "history") loadRows(); /* eslint-disable-next-line */ }, [tab]);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🔁 บันทึกโอนรถจักรยานยนต์ ระหว่างสาขา</h2>
      </div>

      {message && (
        <div style={{ padding: 10, marginBottom: 10, borderRadius: 6, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>{message}</div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button onClick={() => setTab("record")} style={tabBtn(tab === "record")}>📝 บันทึกโอน</button>
        <button onClick={() => setTab("history")} style={tabBtn(tab === "history")}>📜 ประวัติการโอน</button>
      </div>

      {tab === "record" && (
        <div style={card}>
          {/* ค้นหารถ */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchVehicle()}
              placeholder="พิมพ์เลขเครื่อง หรือ เลขถัง" style={{ ...inp, flex: 1 }} />
            <button onClick={searchVehicle} disabled={searching} style={btnBlue}>{searching ? "..." : "🔍 ค้นหารถ"}</button>
          </div>

          {vehicle && (
            <>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 14 }}>
                  <span>ยี่ห้อ: <b style={{ color: String(vehicle.brand).toUpperCase() === "YAMAHA" ? "#0a4aa8" : "#e10600" }}>{vehicle.brand}</b></span>
                  <span>รุ่น/แบบ: <b>{[vehicle.model_name, vehicle.model_code].filter(Boolean).join(" / ") || "-"}</b></span>
                  <span>type: <b>{vehicle.model_type || "-"}</b></span>
                  <span>สี: <b>{vehicle.color_name || vehicle.model_color || "-"}</b></span>
                </div>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, color: "#475569", marginTop: 6, fontFamily: "monospace" }}>
                  <span>เลขเครื่อง: {vehicle.engine_no || "-"}</span>
                  <span>เลขถัง: {vehicle.chassis_no || "-"}</span>
                </div>
                {vehicle.sold_at && <div style={{ color: "#b45309", fontSize: 12, marginTop: 6 }}>⚠️ รถคันนี้ถูกตัดขายแล้ว (sold_at {fmtDateTH(vehicle.sold_at)}) — โอนได้แต่โปรดตรวจสอบ</div>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <Field label="สาขาต้นทาง *">
                  <select value={form.from_branch} onChange={(e) => setForm({ ...form, from_branch: e.target.value })} style={inp}>
                    <option value="">-- เลือก --</option>
                    {BRANCHES.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
                  </select>
                </Field>
                <Field label="สาขาปลายทาง *">
                  <select value={form.to_branch} onChange={(e) => setForm({ ...form, to_branch: e.target.value })} style={inp}>
                    <option value="">-- เลือก --</option>
                    {BRANCHES.filter((b) => b.code !== form.from_branch).map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
                  </select>
                </Field>
                <Field label="วันที่โอน">
                  <input type="date" value={form.transfer_date} onChange={(e) => setForm({ ...form, transfer_date: e.target.value })} style={inp} />
                </Field>
                <Field label="หมายเหตุ">
                  <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={inp} placeholder="(ไม่บังคับ)" />
                </Field>
              </div>

              <div style={{ marginTop: 14 }}>
                <button onClick={save} disabled={saving} style={btnGreen}>{saving ? "..." : "💾 บันทึกการโอน"}</button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "history" && (
        <div style={card}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <input value={hKeyword} onChange={(e) => setHKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadRows()}
              placeholder="ค้นหา เลขเครื่อง/เลขถัง/รุ่น/เลขที่โอน" style={{ ...inp, maxWidth: 320 }} />
            <select value={hStatus} onChange={(e) => { setHStatus(e.target.value); }} style={{ ...inp, maxWidth: 160 }}>
              <option value="active">ใช้งาน</option>
              <option value="cancelled">ยกเลิกแล้ว</option>
              <option value="all">ทั้งหมด</option>
            </select>
            <button onClick={loadRows} disabled={loadingRows} style={btnBlue}>{loadingRows ? "..." : "🔍 ค้นหา"}</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>เลขที่โอน</th><th style={th}>วันที่</th><th style={th}>ยี่ห้อ</th>
                  <th style={{ ...th, textAlign: "left" }}>รุ่น/แบบ</th><th style={{ ...th, textAlign: "left" }}>เลขเครื่อง</th>
                  <th style={th}>จากสาขา</th><th style={th}>ไปสาขา</th><th style={th}>โดย</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {loadingRows && <tr><td colSpan={9} style={{ padding: 18, textAlign: "center" }}>กำลังโหลด...</td></tr>}
                {!loadingRows && rows.length === 0 && <tr><td colSpan={9} style={{ padding: 18, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb", opacity: r.status === "cancelled" ? 0.55 : 1 }}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>{r.transfer_no}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDateTH(r.transfer_date)}</td>
                    <td style={{ ...td, textAlign: "center" }}>{r.brand}</td>
                    <td style={td}>{r.model || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.engine_no || r.chassis_no || "-"}</td>
                    <td style={{ ...td, textAlign: "center" }}>{r.from_branch}</td>
                    <td style={{ ...td, textAlign: "center", fontWeight: 700, color: "#047857" }}>{r.to_branch}</td>
                    <td style={{ ...td, fontSize: 12 }}>{r.created_by || "-"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {r.status === "cancelled"
                        ? <span style={{ color: "#dc2626", fontSize: 12 }}>ยกเลิกแล้ว</span>
                        : <button onClick={() => cancelRow(r)} style={btnRedSm}>ยกเลิก</button>}
                    </td>
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
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const card = { background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" };
const inp = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const tabBtn = (on) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: on ? "#072d6b" : "#e5e7eb", color: on ? "#fff" : "#374151" });
const btnBlue = { padding: "8px 16px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" };
const btnGreen = { padding: "9px 20px", background: "#2e9e4f", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700 };
const btnRedSm = { padding: "4px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 };
const th = { padding: "8px 10px", textAlign: "center", fontWeight: 600, whiteSpace: "nowrap" };
const td = { padding: "7px 10px", verticalAlign: "top" };
