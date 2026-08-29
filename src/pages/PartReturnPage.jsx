import React, { useEffect, useMemo, useState } from "react";

// บันทึกคืนสินค้า (อะไหล่) แล้วสั่งสินค้าใหม่ — Order System (user 2026-08-31)
// flow: บันทึกคืน (รหัส/ชื่อ/จำนวน/เหตุผล/เอกสารอ้างอิง) → เมื่อสั่งของทดแทนแล้วกด "สั่งใหม่แล้ว" ใส่เลขที่ใบสั่งซื้อใหม่
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-return-api";
// เลือกจากใบสั่งซื้อที่ยังไม่ปิดซ่อม/ปิดขาย (user 2026-08-31) — 3 ระบบเดียวกับรายการสั่งอะไหล่รายวัน
const HONDA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api";
const YAMAHA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/yamaha-spare-api";
const OUTSIDE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/outside-deposit-api";
async function postTo(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { const d = JSON.parse(t); return Array.isArray(d) ? d : d?.data || []; } catch { return []; }
}

async function post(body) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return {}; }
}
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const thaiDate = (iso) => {
  if (!iso) return "-";
  const s = String(iso).slice(0, 10); const [y, m, d] = s.split("-");
  return y && m && d ? `${Number(d)}/${Number(m)}/${Number(y) + 543}` : s;
};
const unwrapList = (d) => { try { return typeof d?.listjson === "string" ? JSON.parse(d.listjson) : Array.isArray(d) ? d : []; } catch { return []; } };

const REASONS = ["ของเสีย/ชำรุด", "ส่งผิดรหัส", "สั่งผิดรุ่น", "ลูกค้ายกเลิก", "อื่นๆ"];

export default function PartReturnPage({ currentUser }) {
  const isAdmin = currentUser?.role === "admin";
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 2); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(todayStr());
  const [form, setForm] = useState({ return_date: todayStr(), system_brand: "HONDA", part_code: "", part_name: "", qty: 1, reason: REASONS[0], ref_doc: "", note: "", source_system: "", source_order_id: "" });
  const [reorder, setReorder] = useState(null); // แถวที่กำลังใส่เลขสั่งใหม่
  // picker เลือกจากใบสั่งซื้อที่ยังไม่ปิด
  const [picker, setPicker] = useState(null); // {loading, orders, kw, sel(order), items, itemsLoading}
  const CLOSED = ["ปิดงานซ่อม", "ปิดการขาย", "ยกเลิก"];
  async function openPicker() {
    setPicker({ loading: true, orders: [], kw: "", sys: "ทั้งหมด", sel: null, items: [], itemsLoading: false });
    const [honda, yamaha, outside] = await Promise.all([
      postTo(HONDA_API, { action: "get_spare_orders" }).catch(() => []),
      postTo(YAMAHA_API, { action: "get_yamaha_orders" }).catch(() => []),
      postTo(OUTSIDE_API, { action: "get_orders" }).catch(() => []),
    ]);
    const tag = (list, system) => (Array.isArray(list) ? list : []).filter((o) => o && o.order_id && !CLOSED.includes(String(o.status || ""))).map((o) => ({ ...o, __system: system }));
    const orders = [...tag(honda, "HONDA"), ...tag(yamaha, "YAMAHA"), ...tag(outside, "อื่นๆ")]
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    setPicker((pk) => pk ? { ...pk, loading: false, orders } : pk);
  }
  async function pickOrder(o) {
    setPicker((pk) => ({ ...pk, sel: o, items: [], itemsLoading: true }));
    const url = o.__system === "HONDA" ? HONDA_API : o.__system === "YAMAHA" ? YAMAHA_API : OUTSIDE_API;
    const action = o.__system === "HONDA" ? "get_spare_order_detail" : o.__system === "YAMAHA" ? "get_yamaha_order_detail" : "get_order_detail";
    const items = await postTo(url, { action, order_id: o.order_id }).catch(() => []);
    setPicker((pk) => pk ? { ...pk, items: (Array.isArray(items) ? items : []).filter((it) => it && (it.part_code || it.part_name)), itemsLoading: false } : pk);
  }
  function pickItem(it) {
    const o = picker?.sel || {};
    setForm((f) => ({
      ...f,
      system_brand: o.__system || f.system_brand,
      part_code: String(it.part_code || "").trim(),
      part_name: String(it.part_name || "").trim(),
      qty: Number(it.qty ?? it.quantity) > 0 ? Number(it.qty ?? it.quantity) : 1,
      ref_doc: [o.deposit_doc_no, o.vendor_po_no ? "PO " + o.vendor_po_no : "", o.job_no ? "JOB " + o.job_no : ""].filter(Boolean).join(" · "),
      source_system: o.__system || "",
      source_order_id: String(o.order_id || ""),
    }));
    setPicker(null);
    setMessage(`✅ ดึงรายการจากใบ ${o.deposit_doc_no || o.order_id} แล้ว — ตรวจจำนวน/เหตุผลแล้วกดบันทึก`);
  }

  async function load() {
    setLoading(true);
    try {
      const body = { action: "list_part_returns", date_from: dateFrom, date_to: dateTo };
      if (!isAdmin) body.branch_code = myBranch;
      setRows(unwrapList(await post(body)).filter((r) => r && r.doc_no));
    } catch { setRows([]); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (saving) return;
    const f = form;
    if (!f.part_code.trim() && !f.part_name.trim()) { setMessage("❌ กรอกรหัสหรือชื่ออะไหล่"); return; }
    if (!(num(f.qty) > 0)) { setMessage("❌ จำนวนต้องมากกว่า 0"); return; }
    if (!window.confirm(`บันทึกคืนสินค้า ${f.system_brand}\n${[f.part_code, f.part_name].filter(Boolean).join(" · ")} × ${f.qty}\nเหตุผล: ${f.reason} ?`)) return;
    setSaving(true); setMessage("");
    try {
      const r = await post({
        action: "save_part_return",
        return_date: f.return_date, branch_code: myBranch || currentUser?.branch || "",
        system_brand: f.system_brand, part_code: f.part_code.trim(), part_name: f.part_name.trim(),
        qty: num(f.qty), reason: f.reason, ref_doc: f.ref_doc.trim(), note: f.note.trim(),
        source_system: f.source_system || "", source_order_id: f.source_order_id || "",
        created_by: currentUser?.username || currentUser?.name || "system",
      });
      if (!r || !r.doc_no) throw new Error(r?.__error || "บันทึกไม่สำเร็จ (ตรวจว่า import workflow part-return-api แล้ว)");
      setMessage(`✅ บันทึกคืนสินค้าแล้ว เลขที่ ${r.doc_no} — เมื่อสั่งของทดแทนแล้วกดปุ่ม "สั่งใหม่แล้ว" เพื่อบันทึกเลขที่ใบสั่งซื้อ`);
      setForm({ return_date: todayStr(), system_brand: f.system_brand, part_code: "", part_name: "", qty: 1, reason: REASONS[0], ref_doc: "", note: "", source_system: "", source_order_id: "" });
      load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    finally { setSaving(false); }
  }

  // เปิดหน้าต่างสั่งสินค้าใหม่ — ถ้ามีใบสั่งซื้อต้นทาง โหลดหัวเอกสารเก่ามา default (แบบฟอร์มสร้างใบสั่งซื้อ) (user 2026-08-31)
  async function openReorder(r) {
    // คืนเพราะสั่ง/ส่งผิดรหัส → รหัสที่สั่งใหม่เป็นคนละตัวแน่นอน เริ่มช่องว่างให้พิมพ์รหัสที่ถูกต้อง; ของเสีย/อื่นๆ → เติมรหัสเดิม (สั่งตัวเดิมทดแทน)
    const wrongCode = ["ส่งผิดรหัส", "สั่งผิดรุ่น"].includes(String(r.reason || ""));
    const base = { id: r.id, doc_no: r.doc_no, part: [r.part_code, r.part_name].filter(Boolean).join(" · "), reorder_no: "", reorder_date: todayStr(), source_system: r.source_system || "", source_order_id: r.source_order_id || "" };
    // หาใบต้นทาง: (1) จากที่จำไว้ตอนเลือก (2) ใบเก่า — สืบจากเลขมัดจำ PDS/PDO ในช่องอ้างอิง (user 2026-08-31)
    const depInRef = (String(r.ref_doc || "").match(/(PD[SO]-\d{4}-\d{5})/) || [])[1] || "";
    const sysGuess = r.source_system && r.source_system !== "อื่นๆ" ? r.source_system : (["HONDA", "YAMAHA"].includes(String(r.system_brand)) ? r.system_brand : "");
    if ((r.source_order_id || depInRef) && sysGuess) {
      setReorder({ ...base, mode: "loading" });
      const url = sysGuess === "HONDA" ? HONDA_API : YAMAHA_API;
      const listAction = sysGuess === "HONDA" ? "get_spare_orders" : "get_yamaha_orders";
      const orders = await postTo(url, { action: listAction }).catch(() => []);
      const list = Array.isArray(orders) ? orders : [];
      const src = list.find((o) => r.source_order_id && String(o.order_id) === String(r.source_order_id))
        || list.filter((o) => depInRef && String(o.deposit_doc_no || "") === depInRef).sort((a, b) => Number(b.order_id) - Number(a.order_id))[0];
      if (src) {
        base.source_system = sysGuess;
        base.source_order_id = String(src.order_id);
        setReorder({
          ...base, mode: "order", src,
          order_type: "สั่งเพิ่ม",
          deposit_doc_no: src.deposit_doc_no || "",
          customer_name: src.customer_name || "",
          customer_phone: src.customer_phone || "",
          license_plate: src.license_plate || "",
          technician: src.technician || "",
          model_name: src.model_name || "",
          parking_status: src.parking_status || "ไม่จอดร้าน",
          items: [{ part_code: wrongCode ? "" : (r.part_code || ""), part_name: wrongCode ? "" : (r.part_name || ""), quantity: Number(r.qty) || 1 }],
        });
        return;
      }
    }
    // ไม่มีใบต้นทาง → โหมดกรอกเลขใบสั่งซื้อเอง
    setReorder({ ...base, mode: "manual", reorder_part_code: wrongCode ? "" : (r.part_code || ""), reorder_part_name: wrongCode ? "" : (r.part_name || ""), reorder_qty: Number(r.qty) || 1 });
  }
  const setOrdItem = (idx, key, val) => setReorder((p) => ({ ...p, items: p.items.map((it, i) => (i === idx ? { ...it, [key]: val, ...(key === "part_code" ? { stock_qty: undefined, stock_name: undefined } : {}) } : it)) }));
  // เช็คสต๊อกคงเหลือของรหัสในแถว (ตอนพิมพ์รหัสเสร็จ/ออกจากช่อง) — search_inventory เดียวกับฟอร์มสร้างใบสั่งซื้อ
  async function checkOrdStock(idx) {
    const it = reorder?.items?.[idx];
    const code = String(it?.part_code || "").replace(/[^0-9A-Za-z]/g, "");
    if (!code || code.length < 4) return;
    const url = reorder.source_system === "YAMAHA" ? YAMAHA_API : HONDA_API;
    try {
      const sr = await postTo(url, { action: "search_inventory", code, keyword: code });
      const found = (Array.isArray(sr) ? sr : []).filter((f) => f && (f.quantity != null || f.source));
      const qty = found.reduce((t, f) => t + Number(f.quantity || 0), 0);
      const name = found.map((f) => `${f.source || "-"}(${Number(f.quantity || 0)})`).join(", ");
      setReorder((p) => p ? { ...p, items: p.items.map((x, i) => (i === idx ? { ...x, stock_qty: qty, stock_name: name || "-" } : x)) } : p);
    } catch { /* เช็คไม่ได้ไม่บล็อกการสั่ง */ }
  }
  const addOrdItem = () => setReorder((p) => ({ ...p, items: [...p.items, { part_code: "", part_name: "", quantity: 1 }] }));
  const delOrdItem = (idx) => setReorder((p) => ({ ...p, items: p.items.length > 1 ? p.items.filter((_, i) => i !== idx) : p.items }));

  // บันทึกแบบสร้างใบสั่งซื้อจริง (สั่งเพิ่ม/ปกติ บนมัดจำเดิม) → ขึ้นระบบสั่งซื้อสถานะรอดำเนินการ
  async function saveOrderMode() {
    if (!reorder || saving) return;
    const sys = reorder.source_system;
    const items = (reorder.items || []).filter((it) => String(it.part_code || "").trim() || String(it.part_name || "").trim());
    if (!items.length) { setMessage("❌ ใส่รายการอะไหล่อย่างน้อย 1 รายการ"); return; }
    if (!String(reorder.technician || "").trim()) { setMessage("❌ กรอกชื่อช่าง"); return; }
    if (reorder.parking_status === "จอดร้าน" && !String(reorder.license_plate || "").trim()) { setMessage("❌ กรอกทะเบียนรถ (จอดร้าน)"); return; }
    setSaving(true); setMessage("");
    try {
      const src = reorder.src || {};
      const payload = {
        action: sys === "HONDA" ? "save_spare_order" : "save_yamaha_order",
        order_type: reorder.order_type || "สั่งเพิ่ม",
        ref_order_id: reorder.order_type === "สั่งเพิ่ม" ? reorder.source_order_id : "",
        deposit_doc_no: reorder.deposit_doc_no || "",
        customer_code: src.customer_code || "", customer_name: reorder.customer_name || "",
        customer_phone: String(reorder.customer_phone || "").trim(),
        vin: src.vin || "", deposit_amount: 0,
        technician: String(reorder.technician || "").trim(),
        license_plate: String(reorder.license_plate || "").trim(),
        model_name: reorder.model_name || "",
        parking_status: reorder.parking_status || "ไม่จอดร้าน",
        vehicle_series: src.vehicle_series || "", vehicle_variant: src.vehicle_variant || "",
        vehicle_type: src.vehicle_type || "", vehicle_color: src.vehicle_color || "",
        items: items.map((it) => ({ part_code: String(it.part_code || "").trim(), part_name: String(it.part_name || "").trim(), quantity: num(it.quantity) || 1 })),
        note: "สั่งใหม่แทนของคืน " + reorder.doc_no,
        created_by: currentUser?.name || currentUser?.username || "",
        branch: currentUser?.branch || "",
      };
      const url = sys === "HONDA" ? HONDA_API : YAMAHA_API;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r2) => r2.json()).catch(() => null);
      const newId = res?.order_id;
      if (!res || !(res.success || newId)) throw new Error(res?.message || "สร้างใบสั่งซื้อไม่สำเร็จ");
      const first = items[0] || {};
      const r = await post({
        action: "save_part_return", id: reorder.id,
        reorder_no: (reorder.order_type || "สั่งเพิ่ม") + (newId ? " #" + newId : "") + (reorder.deposit_doc_no ? " · " + reorder.deposit_doc_no : ""),
        reorder_date: todayStr(),
        reorder_part_code: String(first.part_code || "").trim(),
        reorder_part_name: String(first.part_name || "").trim(),
        reorder_qty: num(first.quantity) || 1,
        status: "สั่งใหม่แล้ว",
        updated_by: currentUser?.username || currentUser?.name || "system",
      });
      if (!r || !r.doc_no) throw new Error(r?.__error || "สร้างใบสั่งซื้อแล้ว แต่บันทึกสถานะใบคืนไม่สำเร็จ");
      setMessage(`✅ สร้างใบสั่งซื้อ ${sys} (${reorder.order_type}) บนมัดจำ ${reorder.deposit_doc_no || "-"} แล้ว — ขึ้นระบบสั่งซื้อสถานะรอดำเนินการ`);
      setReorder(null); load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    finally { setSaving(false); }
  }

  async function saveReorder() {
    if (!reorder || saving) return;
    if (!String(reorder.reorder_no || "").trim()) { setMessage("❌ กรอกเลขที่ใบสั่งซื้อใหม่"); return; }
    setSaving(true); setMessage("");
    try {
      const r = await post({
        action: "save_part_return", id: reorder.id,
        reorder_no: String(reorder.reorder_no).trim(),
        reorder_date: String(reorder.reorder_date || todayStr()).slice(0, 10),
        reorder_part_code: String(reorder.reorder_part_code || "").trim(),
        reorder_part_name: String(reorder.reorder_part_name || "").trim(),
        reorder_qty: num(reorder.reorder_qty) || 1,
        status: "สั่งใหม่แล้ว",
        updated_by: currentUser?.username || currentUser?.name || "system",
      });
      if (!r || !r.doc_no) throw new Error(r?.__error || "บันทึกไม่สำเร็จ");
      setMessage(`✅ ${r.doc_no} บันทึกสั่งสินค้าใหม่ (${r.reorder_no}) แล้ว`);
      setReorder(null); load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    finally { setSaving(false); }
  }

  async function cancelRow(r) {
    if (!window.confirm(`ยกเลิกใบคืนสินค้า ${r.doc_no}?`)) return;
    try {
      const d = await post({ action: "cancel_part_return", id: r.id, cancelled_by: currentUser?.username || currentUser?.name || "system" });
      if (!d || !d.doc_no) throw new Error(d?.__error || "ยกเลิกไม่สำเร็จ");
      setMessage(`✅ ยกเลิก ${r.doc_no} แล้ว`); load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
  }

  const pending = useMemo(() => rows.filter((r) => r.status === "คืนแล้ว").length, [rows]);
  const inp = { padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" };
  const th = { padding: "8px 6px", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff" };
  const td = { padding: "7px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1200 }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b", fontSize: 20 }}>↩️ บันทึกคืนสินค้า / สั่งสินค้าใหม่</h2>
      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 12 }}>
        บันทึกอะไหล่ที่ส่งคืนศูนย์/ร้านค้า (ของเสีย·ส่งผิด·สั่งผิด) — เมื่อสั่งของทดแทนแล้วกด "สั่งใหม่แล้ว" ใส่เลขที่ใบสั่งซื้อใหม่ไว้ตามงาน
      </div>
      {message && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: message.startsWith("❌") ? "#fef2f2" : "#f0fdf4", border: message.startsWith("❌") ? "1px solid #fecaca" : "1px solid #bbf7d0", fontSize: 14 }}>{message}</div>}

      <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "10px 12px", alignItems: "center", fontSize: 14, maxWidth: 820 }}>
          <label>วันที่คืน *</label>
          <input type="date" value={form.return_date} onChange={(e) => setForm((f) => ({ ...f, return_date: e.target.value }))} style={inp} />
          <label>ระบบ *</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["HONDA", "YAMAHA", "อื่นๆ"].map((b) => (
              <button key={b} onClick={() => setForm((f) => ({ ...f, system_brand: b }))}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer",
                  background: form.system_brand === b ? (b === "HONDA" ? "#dc2626" : b === "YAMAHA" ? "#1e40af" : "#374151") : "#fff",
                  color: form.system_brand === b ? "#fff" : "#374151", border: "2px solid " + (form.system_brand === b ? "transparent" : "#d1d5db") }}>{b}</button>
            ))}
          </div>
          <label>รหัสอะไหล่ *</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={form.part_code} onChange={(e) => setForm((f) => ({ ...f, part_code: e.target.value }))} placeholder="เช่น 06435-K0J-N01" style={{ ...inp, fontFamily: "monospace", flex: 1 }} />
            <button onClick={openPicker} title="เลือกจากใบสั่งซื้อที่ยังไม่ปิดซ่อม/ปิดขาย"
              style={{ padding: "8px 14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", whiteSpace: "nowrap" }}>🔍 จากใบสั่งซื้อ</button>
          </div>
          <label>ชื่ออะไหล่</label>
          <input value={form.part_name} onChange={(e) => setForm((f) => ({ ...f, part_name: e.target.value }))} placeholder="ชื่อรายการ" style={inp} />
          <label>จำนวน *</label>
          <input type="number" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} style={{ ...inp, width: 110, textAlign: "right" }} />
          <label>เหตุผลที่คืน *</label>
          <select value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} style={inp}>
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <label>เอกสารอ้างอิง</label>
          <input value={form.ref_doc} onChange={(e) => setForm((f) => ({ ...f, ref_doc: e.target.value }))} placeholder="ใบมัดจำ PDS/PDO · เลข JOB · ใบสั่งซื้อเดิม" style={inp} />
          <label>หมายเหตุ</label>
          <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="ไม่บังคับ" style={inp} />
        </div>
        <button onClick={save} disabled={saving} style={{ marginTop: 14, padding: "11px 28px", background: saving ? "#9ca3af" : "#16a34a", color: "#fff", border: "none", borderRadius: 10, fontFamily: "Tahoma", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          {saving ? "กำลังบันทึก..." : "💾 บันทึกคืนสินค้า"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700 }}>รายการคืนสินค้า</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inp} />
        <button onClick={load} disabled={loading} style={{ padding: "7px 16px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer" }}>{loading ? "..." : "🔍 แสดง"}</button>
        <span style={{ marginLeft: "auto", fontSize: 13 }}>{rows.length} ใบ{pending > 0 && <span style={{ color: "#b45309" }}> · ⏳ รอสั่งใหม่ {pending} ใบ</span>}</span>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>เลขที่ใบคืน</th><th style={th}>วันที่คืน</th><th style={th}>สาขา</th><th style={th}>ระบบ</th>
            <th style={th}>รหัส / ชื่ออะไหล่</th><th style={{ ...th, textAlign: "right" }}>จำนวน</th><th style={th}>เหตุผล</th>
            <th style={th}>อ้างอิง</th><th style={th}>สั่งสินค้าใหม่</th><th style={th}>สถานะ</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 22 }}>{loading ? "กำลังโหลด..." : "ไม่มีรายการในช่วงวันที่"}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} style={{ opacity: r.status === "ยกเลิก" ? 0.5 : 1 }}>
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{r.doc_no}</td>
                <td style={td}>{thaiDate(r.return_date)}</td>
                <td style={td}>{r.branch_code}</td>
                <td style={td}>{r.system_brand || "-"}</td>
                <td style={td}>{r.part_code && <span style={{ fontFamily: "monospace", color: "#0369a1" }}>{r.part_code}</span>}{r.part_code && r.part_name ? " · " : ""}{r.part_name || ""}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{Number(r.qty || 0)}</td>
                <td style={td}>{r.reason || "-"}{r.note ? <div style={{ fontSize: 11, color: "#6b7280" }}>{r.note}</div> : null}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.ref_doc || "-"}</td>
                <td style={td}>{r.reorder_no
                  ? <span style={{ color: "#166534" }}>🛒 {r.reorder_no}
                      {r.reorder_date ? <div style={{ fontSize: 11, color: "#6b7280" }}>{thaiDate(r.reorder_date)}</div> : null}
                      {(r.reorder_part_code || r.reorder_part_name) && <div style={{ fontSize: 11, color: "#374151" }}><span style={{ fontFamily: "monospace" }}>{r.reorder_part_code || ""}</span>{r.reorder_part_name ? " · " + r.reorder_part_name : ""} × {Number(r.reorder_qty || 0) || "-"}{String(r.reorder_part_code || "").replace(/[^0-9A-Za-z]/g, "") !== String(r.part_code || "").replace(/[^0-9A-Za-z]/g, "") && r.reorder_part_code ? <span style={{ marginLeft: 4, fontSize: 10, color: "#7c3aed", background: "#f3e8ff", padding: "1px 5px", borderRadius: 6 }}>รหัสทดแทน</span> : null}</div>}
                    </span>
                  : <span style={{ color: "#9ca3af" }}>—</span>}</td>
                <td style={td}>
                  <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11.5, fontWeight: 700,
                    background: r.status === "สั่งใหม่แล้ว" ? "#dcfce7" : r.status === "ยกเลิก" ? "#fee2e2" : "#fef3c7",
                    color: r.status === "สั่งใหม่แล้ว" ? "#166534" : r.status === "ยกเลิก" ? "#991b1b" : "#92400e" }}>
                    {r.status}
                  </span>
                </td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  {r.status === "คืนแล้ว" && <>
                    <button onClick={() => openReorder(r)}
                      style={{ padding: "4px 10px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontSize: 12, marginRight: 4 }}>🛒 สั่งใหม่แล้ว</button>
                    <button onClick={() => cancelRow(r)}
                      style={{ padding: "4px 10px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontSize: 12 }}>ยกเลิก</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {picker && (
        <div onClick={() => setPicker(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, width: 760, maxWidth: "96vw", maxHeight: "85vh", overflowY: "auto", fontFamily: "Tahoma" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>🔍 เลือกจากใบสั่งซื้อ (เฉพาะที่ยังไม่ปิดซ่อม/ปิดขาย)</div>
              <button onClick={() => setPicker(null)} style={{ padding: "4px 12px", background: "#e5e7eb", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma" }}>ปิด</button>
            </div>
            {!picker.sel ? (<>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {["ทั้งหมด", "HONDA", "YAMAHA", "อื่นๆ"].map((b) => (
                  <button key={b} onClick={() => setPicker((p2) => ({ ...p2, sys: b }))}
                    style={{ padding: "5px 16px", borderRadius: 16, fontFamily: "Tahoma", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
                      background: picker.sys === b ? (b === "HONDA" ? "#dc2626" : b === "YAMAHA" ? "#1e40af" : "#072d6b") : "#fff",
                      color: picker.sys === b ? "#fff" : "#374151", border: "1px solid " + (picker.sys === b ? "transparent" : "#d1d5db") }}>
                    {b} ({b === "ทั้งหมด" ? picker.orders.length : picker.orders.filter((o) => o.__system === b).length})
                  </button>
                ))}
              </div>
              <input autoFocus value={picker.kw} onChange={(e) => setPicker((p2) => ({ ...p2, kw: e.target.value }))}
                placeholder="ค้นหา ลูกค้า / เลขมัดจำ / เลขใบรับสั่งซื้อ / เลข JOB"
                style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box", marginBottom: 10 }} />
              {picker.loading ? <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>กำลังโหลดใบสั่งซื้อ...</div> : (() => {
                const k = picker.kw.trim().toLowerCase();
                const list = picker.orders
                  .filter((o) => picker.sys === "ทั้งหมด" || o.__system === picker.sys)
                  .filter((o) => !k || [o.customer_name, o.deposit_doc_no, o.vendor_po_no, o.job_no, o.__system].some((v) => String(v || "").toLowerCase().includes(k)))
                  .slice(0, 40);
                if (!list.length) return <div style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 13.5 }}>ไม่พบใบสั่งซื้อที่ยังเปิดอยู่ตามคำค้น</div>;
                return list.map((o) => (
                  <div key={o.__system + o.order_id} onClick={() => pickOrder(o)}
                    style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 6, cursor: "pointer", fontSize: 13.5 }}>
                    <span><b style={{ color: o.__system === "HONDA" ? "#dc2626" : o.__system === "YAMAHA" ? "#1e40af" : "#374151" }}>{o.__system}</b> · <span style={{ fontFamily: "monospace" }}>{o.deposit_doc_no || "-"}</span> · {o.customer_name || "-"}{o.job_no ? <span style={{ color: "#6b7280" }}> · JOB {o.job_no}</span> : null}</span>
                    <span style={{ color: "#6b7280" }}>{o.status || "-"}{o.vendor_po_no ? " · " + o.vendor_po_no : ""}</span>
                  </div>
                ));
              })()}
            </>) : (<>
              <div style={{ marginBottom: 8, fontSize: 13.5 }}>
                <button onClick={() => setPicker((p2) => ({ ...p2, sel: null, items: [] }))} style={{ padding: "3px 10px", background: "#e5e7eb", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", marginRight: 8 }}>← กลับ</button>
                <b>{picker.sel.__system}</b> · {picker.sel.deposit_doc_no || picker.sel.order_id} · {picker.sel.customer_name || "-"} — เลือกรายการสินค้าที่จะคืน
              </div>
              {picker.itemsLoading ? <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>กำลังโหลดรายการ...</div> :
                !picker.items.length ? <div style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 13.5 }}>ใบนี้ไม่มีรายการอะไหล่</div> :
                picker.items.map((it, i) => (
                  <div key={i} onClick={() => pickItem(it)}
                    style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 10px", border: "1px solid #dbeafe", background: "#eff6ff", borderRadius: 8, marginBottom: 6, cursor: "pointer", fontSize: 13.5 }}>
                    <span><span style={{ fontFamily: "monospace", color: "#0369a1" }}>{it.part_code || "-"}</span>{it.part_name ? " · " + it.part_name : ""}</span>
                    <span style={{ color: "#6b7280" }}>× {Number(it.qty || 0)}</span>
                  </div>
                ))}
            </>)}
          </div>
        </div>
      )}

      {reorder && (
        <div onClick={() => setReorder(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, width: 640, maxWidth: "96vw", maxHeight: "88vh", overflowY: "auto", fontFamily: "Tahoma" }}>
            <h3 style={{ margin: "0 0 6px", color: "#072d6b" }}>🛒 สั่งสินค้าใหม่ — {reorder.doc_no}</h3>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>{reorder.part}</div>

            {reorder.mode === "loading" && <div style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>กำลังโหลดข้อมูลใบสั่งซื้อเดิม...</div>}

            {reorder.mode === "order" && (<>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 12px", alignItems: "center", fontSize: 14 }}>
                <label>ประเภท</label>
                <div style={{ display: "flex", gap: 16 }}>
                  {["สั่งเพิ่ม", "ปกติ"].map((t) => (
                    <label key={t} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                      <input type="radio" checked={reorder.order_type === t} onChange={() => setReorder((p) => ({ ...p, order_type: t }))} />
                      {t === "สั่งเพิ่ม" ? "สั่งซื้อสั่งเพิ่ม" : "สั่งซื้อปกติ"}
                    </label>
                  ))}
                </div>
                <label>เลขที่มัดจำ</label>
                <input value={reorder.deposit_doc_no} readOnly style={{ ...inp, background: "#f3f4f6", fontFamily: "monospace" }} title="จากเอกสารเก่า" />
                <label>ลูกค้า</label>
                <input value={reorder.customer_name} readOnly style={{ ...inp, background: "#f3f4f6" }} />
                <label>เบอร์โทร</label>
                <input value={reorder.customer_phone} onChange={(e) => setReorder((p) => ({ ...p, customer_phone: e.target.value }))} style={inp} />
                <label>ทะเบียนรถ</label>
                <input value={reorder.license_plate} onChange={(e) => setReorder((p) => ({ ...p, license_plate: e.target.value }))} style={inp} />
                <label>ช่าง *</label>
                <input value={reorder.technician} onChange={(e) => setReorder((p) => ({ ...p, technician: e.target.value }))} style={inp} />
                <label>รุ่นรถ</label>
                <input value={reorder.model_name} onChange={(e) => setReorder((p) => ({ ...p, model_name: e.target.value }))} style={inp} />
                <label>สถานะ</label>
                <div style={{ display: "flex", gap: 16 }}>
                  {["จอดร้าน", "ไม่จอดร้าน"].map((t) => (
                    <label key={t} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                      <input type="radio" checked={reorder.parking_status === t} onChange={() => setReorder((p) => ({ ...p, parking_status: t }))} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0 6px" }}>
                <b style={{ fontSize: 14 }}>รายการอะไหล่</b>
                <button onClick={addOrdItem} style={{ padding: "5px 14px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontSize: 12.5 }}>+ เพิ่มรายการ</button>
              </div>
              {reorder.items.map((it, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ width: 18, fontSize: 12, color: "#6b7280" }}>{i + 1}</span>
                    <input value={it.part_code} onChange={(e) => setOrdItem(i, "part_code", e.target.value)} onBlur={() => checkOrdStock(i)} placeholder="รหัสอะไหล่ที่ถูกต้อง" style={{ ...inp, width: 170, fontFamily: "monospace" }} />
                    <input value={it.part_name} onChange={(e) => setOrdItem(i, "part_name", e.target.value)} placeholder="ชื่ออะไหล่" style={{ ...inp, flex: 1 }} />
                    <input type="number" value={it.quantity} onChange={(e) => setOrdItem(i, "quantity", e.target.value)} style={{ ...inp, width: 80, textAlign: "right" }} />
                    <button onClick={() => delOrdItem(i)} style={{ padding: "6px 10px", background: "transparent", color: "#dc2626", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>
                  </div>
                  {it.stock_qty !== undefined && (
                    <div style={{ marginLeft: 24, fontSize: 12, color: Number(it.stock_qty) >= (Number(it.quantity) || 1) ? "#166534" : Number(it.stock_qty) > 0 ? "#b45309" : "#dc2626" }}>
                      {Number(it.stock_qty) > 0
                        ? `📦 สต๊อกคงเหลือ ${it.stock_qty} ชิ้น (${it.stock_name})${Number(it.stock_qty) >= (Number(it.quantity) || 1) ? " — มีของในร้าน อาจไม่ต้องสั่ง" : ""}`
                        : "🔴 ไม่มีของในสต๊อก — สั่งจากศูนย์"}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                <button onClick={() => setReorder(null)} style={{ padding: "8px 16px", background: "#e5e7eb", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma" }}>ยกเลิก</button>
                <button onClick={saveOrderMode} disabled={saving} style={{ padding: "8px 20px", background: saving ? "#9ca3af" : "#16a34a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>
                  {saving ? "กำลังบันทึก..." : "💾 บันทึก (ส่งเข้าระบบสั่งซื้อ)"}
                </button>
              </div>
            </>)}

            {reorder.mode === "manual" && (<>
              <div style={{ fontSize: 12.5, color: "#b45309", marginBottom: 10 }}>ใบนี้ไม่มีใบสั่งซื้อต้นทางในระบบ — บันทึกเลขที่ใบสั่งซื้อที่สั่งไปแล้วแทน</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 12px", alignItems: "center", fontSize: 14 }}>
                <label>รหัสอะไหล่ที่สั่งใหม่</label>
                <input value={reorder.reorder_part_code} onChange={(e) => setReorder((p) => ({ ...p, reorder_part_code: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
                <label>ชื่ออะไหล่ที่สั่งใหม่</label>
                <input value={reorder.reorder_part_name} onChange={(e) => setReorder((p) => ({ ...p, reorder_part_name: e.target.value }))} style={inp} />
                <label>จำนวนที่สั่งใหม่</label>
                <input type="number" value={reorder.reorder_qty} onChange={(e) => setReorder((p) => ({ ...p, reorder_qty: e.target.value }))} style={{ ...inp, width: 110, textAlign: "right" }} />
                <label>เลขที่ใบสั่งซื้อใหม่ *</label>
                <input value={reorder.reorder_no} onChange={(e) => setReorder((p) => ({ ...p, reorder_no: e.target.value }))} placeholder="เช่น M32116682xxx / เลข PO" style={{ ...inp, fontFamily: "monospace" }} autoFocus />
                <label>วันที่สั่ง</label>
                <input type="date" value={reorder.reorder_date} onChange={(e) => setReorder((p) => ({ ...p, reorder_date: e.target.value }))} style={inp} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                <button onClick={() => setReorder(null)} style={{ padding: "8px 16px", background: "#e5e7eb", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma" }}>ปิด</button>
                <button onClick={saveReorder} disabled={saving} style={{ padding: "8px 20px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>{saving ? "..." : "💾 บันทึก"}</button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
