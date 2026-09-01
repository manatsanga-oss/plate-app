import React, { useEffect, useMemo, useState } from "react";
import { fetchPriceBranchGroups, priceGroupOf } from "../utils/priceBranchGroup";

// บันทึกแก้ไขราคาขายเฉพาะคัน (user 2026-09-01) — บันทึก "ก่อน" ขาย เพื่อให้หน้าบันทึกขาย NEW
// ใช้ราคานี้เป็นฐานแทนราคาประกาศ (ยังไม่รวมกฎบวกเพิ่มต่าง ๆ) · แดง = ต่ำกว่าประกาศ, ฟ้า = สูงกว่าประกาศ
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/vehicle-price-override-api";
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return {}; }
}
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const baht = (n) => num(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const text = (v) => String(v == null ? "" : v).trim();
const thaiDate = (iso) => {
  if (!iso) return "-";
  const s = String(iso).slice(0, 10); const [y, m, d] = s.split("-");
  return y && m && d ? `${Number(d)}/${Number(m)}/${Number(y) + 543}` : s;
};
const unwrapList = (d) => { try { return typeof d?.listjson === "string" ? JSON.parse(d.listjson) : Array.isArray(d) ? d : []; } catch { return []; } };
// สีเทียบราคาประกาศ: ต่ำกว่า = แดง, สูงกว่า = ฟ้า, เท่ากัน/ไม่ทราบ = ปกติ
const cmpColor = (newP, ann) => {
  if (!(num(ann) > 0)) return "#334155";
  if (num(newP) < num(ann)) return "#dc2626";
  if (num(newP) > num(ann)) return "#0284c7";
  return "#334155";
};

export default function VehiclePriceOverridePage({ currentUser }) {
  const isAdmin = currentUser?.role === "admin";
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // master ราคา — ใช้เทียบราคาประกาศแบบเดียวกับหน้าบันทึกขาย NEW (type_id + price_type ตามกลุ่มสาขา)
  const [types, setTypes] = useState([]);
  const [prices, setPrices] = useState([]);
  const [priceTypes, setPriceTypes] = useState([]);
  const [pbgRows, setPbgRows] = useState([]);
  useEffect(() => {
    post(MASTER_API, { action: "get_types" }).then((d) => setTypes(Array.isArray(d) ? d.filter(Boolean) : [])).catch(() => {});
    post(MASTER_API, { action: "get_moto_prices" }).then((d) => setPrices(Array.isArray(d) ? d.filter(Boolean) : [])).catch(() => {});
    post(MASTER_API, { action: "get_price_types" }).then((d) => setPriceTypes(Array.isArray(d) ? d.filter(Boolean) : [])).catch(() => {});
    fetchPriceBranchGroups().then(setPbgRows).catch(() => {});
  }, []);
  const branchGroup = useMemo(() => (myBranch ? priceGroupOf(myBranch, pbgRows) : "สิงห์ชัย"), [myBranch, pbgRows]);

  // ค้นหารถจากสต๊อก (เลขเครื่อง/เลขถัง)
  const [kw, setKw] = useState("");
  const [veh, setVeh] = useState(null);
  const [searching, setSearching] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [note, setNote] = useState("");

  // หา type_id ของคัน: จับ type ตรง (HONDA ต้องตรงทั้งแบบ+type — logic เดียวกับหน้าบันทึกขาย)
  function masterRowOf(v) {
    if (!v) return null;
    const mt = text(v.model_type), mc = text(v.model_code);
    const exact = types.find((t) => mc && text(t.model_code) === mc && mt && text(t.type_name) === mt);
    if (exact) return exact;
    const byType = types.filter((t) => mt && text(t.type_name) === mt);
    if (byType.length === 1) return byType[0];
    return null;
  }
  // ราคาประกาศตามกลุ่มสาขาผู้บันทึก: ไฟแนนท์ → เงินสด → ราคาขายแนะนำ (ปกติสองตัวแรกเท่ากัน)
  function announcedOf(v) {
    const mr = masterRowOf(v);
    if (!mr) return null;
    const pick = (test) => {
      const pt = priceTypes.find((p) => p.status !== "inactive" && test(text(p.type_name)));
      if (!pt) return null;
      const ptId = pt.price_type_id || pt.type_id;
      const row = prices.find((x) => String(x.type_id) === String(mr.type_id) && String(x.price_type_id) === String(ptId));
      return row ? Number(row.amount || 0) : null;
    };
    return pick((n) => n.includes(branchGroup) && (n.includes("ไฟแนนท์") || n.includes("ไฟแนนซ์")))
      ?? pick((n) => n.includes(branchGroup) && n.includes("เงินสด"))
      ?? pick((n) => n.includes("แนะนำ"));
  }

  async function searchVehicle() {
    const q = kw.trim();
    if (!q || searching) return;
    setSearching(true); setMessage(""); setVeh(null);
    try {
      const d = await post(RETAIL_API, { action: "get_vehicle", keyword: q });
      const v = Array.isArray(d) ? d[0] : d;
      if (!v || !v.engine_no) throw new Error("ไม่พบรถคันนี้ในสต๊อก (ค้นด้วยเลขเครื่องหรือเลขถัง)");
      if (v.sold_at) throw new Error(`รถคันนี้ขายแล้ว (${v.sold_invoice_no || ""} · ${thaiDate(v.sold_at)}) — แก้ราคาได้เฉพาะคันที่ยังไม่ขาย`);
      setVeh(v); setNewPrice(""); setNote("");
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    setSearching(false);
  }

  const annPrice = useMemo(() => (veh ? announcedOf(veh) : null), [veh, types, prices, priceTypes, branchGroup]); // eslint-disable-line

  async function load() {
    setLoading(true);
    try { setRows(unwrapList(await post(API, { action: "list_overrides" })).filter((r) => r && r.id)); }
    catch { setRows([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function save() {
    if (saving || !veh) return;
    const p = num(newPrice);
    if (!(p > 0)) { setMessage("❌ กรอกราคาขายใหม่"); return; }
    if (!note.trim()) { setMessage("❌ กรอกหมายเหตุ (เหตุผลที่แก้ราคา)"); return; }
    const diff = annPrice != null ? p - num(annPrice) : null;
    const diffTxt = diff == null ? "ไม่พบราคาประกาศเทียบ" : diff === 0 ? "เท่าราคาประกาศ" : diff < 0 ? `ต่ำกว่าประกาศ ${baht(-diff)} บาท` : `สูงกว่าประกาศ ${baht(diff)} บาท`;
    if (!window.confirm(`บันทึกแก้ไขราคาขายเฉพาะคัน\n${veh.brand} ${veh.model_name || veh.model_code} · ${veh.engine_no}\nราคาใหม่ ${baht(p)} บาท (${diffTxt})\nใช้แทนราคาประกาศเป็นฐานก่อนบวกกฎในหน้าบันทึกขาย NEW ?`)) return;
    setSaving(true); setMessage("");
    try {
      const r = await post(API, {
        action: "save_override",
        engine_no: veh.engine_no, chassis_no: veh.chassis_no || "",
        brand: veh.brand || "", model_label: [veh.model_name || veh.model_code, veh.model_type, veh.color_name].filter(Boolean).join(" "),
        announced_price: annPrice, new_price: p, note: note.trim(),
        branch_code: myBranch, created_by: currentUser?.username || currentUser?.name || "system",
      });
      if (!r || !r.id) throw new Error(r?.__error || "บันทึกไม่สำเร็จ (ตรวจว่า import workflow vehicle-price-override-api แล้ว)");
      setMessage(`✅ บันทึกราคาเฉพาะคัน ${veh.engine_no} = ${baht(p)} บาท แล้ว — หน้าบันทึกขาย NEW จะใช้ราคานี้เป็นฐานอัตโนมัติ`);
      setVeh(null); setKw(""); setNewPrice(""); setNote("");
      load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    finally { setSaving(false); }
  }

  async function cancelRow(r) {
    if (!window.confirm(`ยกเลิกราคาเฉพาะคันของ ${r.engine_no} (${baht(r.new_price)} บาท)?`)) return;
    try {
      const d = await post(API, { action: "cancel_override", id: r.id, cancelled_by: currentUser?.username || currentUser?.name || "system" });
      if (!d || !d.id) throw new Error(d?.__error || "ยกเลิกไม่สำเร็จ (อาจถูกใช้ขายไปแล้ว)");
      setMessage(`✅ ยกเลิกราคาเฉพาะคัน ${r.engine_no} แล้ว`); load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
  }

  const visRows = useMemo(() => rows.filter((r) => isAdmin || String(r.branch_code || "").toUpperCase() === myBranch), [rows, isAdmin, myBranch]);
  const inp = { padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" };
  const lbl = { fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4, color: "#334155" };
  const th = { padding: "8px 6px", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff" };
  const td = { padding: "7px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
  const STATUS_TH = { active: "รอใช้ขาย", used: "ใช้ขายแล้ว", cancelled: "ยกเลิก", replaced: "ถูกแทนที่" };

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1150 }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>🏷️ บันทึกแก้ไขราคาขายเฉพาะคัน</h2>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
        บันทึก<b>ก่อน</b>ขาย — หน้าบันทึกขาย NEW จะใช้ราคานี้เป็นฐานแทนราคาประกาศ (ยังไม่รวมกฎบวกเพิ่มต่าง ๆ) ·
        <span style={{ color: "#dc2626", fontWeight: 700 }}> แดง = ต่ำกว่าประกาศ</span> · <span style={{ color: "#0284c7", fontWeight: 700 }}>ฟ้า = สูงกว่าประกาศ</span>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px" }}>
            <label style={lbl}>ค้นหารถจากสต๊อก (เลขเครื่อง / เลขถัง)</label>
            <input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchVehicle()}
              placeholder="เช่น E35NE-016333" style={{ ...inp, width: "100%", fontFamily: "monospace" }} />
          </div>
          <button onClick={searchVehicle} disabled={searching}
            style={{ padding: "9px 20px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>
            {searching ? "⏳..." : "🔍 ค้นหา"}
          </button>
        </div>

        {veh && (
          <div style={{ marginTop: 12 }}>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 13.5, marginBottom: 10 }}>
              <b>{veh.brand}</b> {veh.model_name || veh.model_code}{veh.model_type ? ` · ${veh.model_type}` : ""}{veh.color_name ? ` · สี${veh.color_name}` : ""}<br />
              เลขเครื่อง <span style={{ fontFamily: "monospace" }}>{veh.engine_no}</span> · เลขถัง <span style={{ fontFamily: "monospace" }}>{veh.chassis_no || "-"}</span>
              {veh.received_date ? ` · รับเข้า ${thaiDate(veh.received_date)}` : ""}
              <div style={{ marginTop: 4 }}>
                ราคาประกาศ (กลุ่ม{branchGroup}): {annPrice != null
                  ? <b style={{ color: "#072d6b" }}>{baht(annPrice)} บาท</b>
                  : <span style={{ color: "#b45309" }}>ไม่พบในตารางราคา — บันทึกได้แต่ไม่มีสีเทียบ</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "0 1 220px" }}>
                <label style={lbl}>ราคาขายใหม่ (ยังไม่รวมกฎ) *</label>
                <input type="number" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
                  style={{ ...inp, width: "100%", textAlign: "right", fontWeight: 700, fontSize: 16, color: cmpColor(newPrice, annPrice) }} />
                {num(newPrice) > 0 && annPrice != null && num(newPrice) !== num(annPrice) && (
                  <div style={{ fontSize: 12, marginTop: 3, fontWeight: 700, color: cmpColor(newPrice, annPrice) }}>
                    {num(newPrice) < num(annPrice) ? `▼ ต่ำกว่าประกาศ ${baht(num(annPrice) - num(newPrice))}` : `▲ สูงกว่าประกาศ ${baht(num(newPrice) - num(annPrice))}`}
                  </div>
                )}
              </div>
              <div style={{ flex: "2 1 320px" }}>
                <label style={lbl}>หมายเหตุ (เหตุผลที่แก้ราคา) *</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ลูกค้าต่อรอง / รถค้างสต๊อกนาน / เคาะราคาพิเศษผู้จัดการ" style={{ ...inp, width: "100%" }} />
              </div>
              <button onClick={save} disabled={saving}
                style={{ padding: "10px 24px", background: saving ? "#cbd5e1" : "#16a34a", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "wait" : "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>
                {saving ? "⏳ กำลังบันทึก..." : "💾 บันทึกราคาเฉพาะคัน"}
              </button>
            </div>
          </div>
        )}
        {message && (
          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: message.startsWith("✅") ? "#15803d" : "#b91c1c" }}>{message}</div>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>📋 รายการราคาเฉพาะคัน ({visRows.length})</div>
          <button onClick={load} disabled={loading} style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>{loading ? "⏳" : "🔄"}</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>วันที่บันทึก</th><th style={th}>สาขา</th><th style={th}>รถ</th><th style={th}>เลขเครื่อง</th>
              <th style={{ ...th, textAlign: "right" }}>ราคาประกาศ</th><th style={{ ...th, textAlign: "right" }}>ราคาใหม่</th>
              <th style={{ ...th, textAlign: "right" }}>ส่วนต่าง</th>
              <th style={th}>หมายเหตุ</th><th style={th}>สถานะ</th><th style={th}>ผู้บันทึก</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {visRows.map((r, i) => {
                const col = cmpColor(r.new_price, r.announced_price);
                const diff = num(r.announced_price) > 0 ? num(r.new_price) - num(r.announced_price) : null;
                return (
                  <tr key={r.id} style={{ background: r.status === "active" ? (i % 2 ? "#fafcff" : "#fff") : "#f8fafc", opacity: ["cancelled", "replaced"].includes(r.status) ? 0.55 : 1 }}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(r.created_at)}</td>
                    <td style={td}>{r.branch_code || "-"}</td>
                    <td style={td}>{r.brand} {r.model_label || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.engine_no}</td>
                    <td style={{ ...td, textAlign: "right" }}>{num(r.announced_price) > 0 ? baht(r.announced_price) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: col }}>{baht(r.new_price)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: col }}>
                      {diff == null ? "-" : diff === 0 ? "0.00" : (diff > 0 ? "+" : "−") + baht(Math.abs(diff))}
                    </td>
                    <td style={{ ...td, fontSize: 12.5, maxWidth: 260 }}>{r.note || "-"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {STATUS_TH[r.status] || r.status}
                      {r.status === "used" && r.used_sale_no ? <div style={{ fontSize: 10.5, color: "#15803d", fontFamily: "monospace" }}>{r.used_sale_no}</div> : null}
                    </td>
                    <td style={td}>{r.created_by || "-"}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      {r.status === "active" && (
                        <button onClick={() => cancelRow(r)} title="ยกเลิกราคาเฉพาะคัน"
                          style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #ef4444", background: "#fff", color: "#b91c1c", cursor: "pointer", fontSize: 12 }}>✖ ยกเลิก</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visRows.length === 0 && !loading && (
                <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>— ยังไม่มีรายการแก้ไขราคาเฉพาะคัน —</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
