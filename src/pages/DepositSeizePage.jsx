import React, { useState, useEffect } from "react";

const SPARE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api";
const YAMAHA_DEPOSIT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/yamaha-deposit-api";
const YAMAHA_SPARE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/yamaha-spare-api";

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return "-";
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function DepositSeizePage({ currentUser } = {}) {
  const [orders, setOrders] = useState([]);
  const [deposits, setDeposits] = useState({}); // map: "BRAND:doc_no" -> deposit
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeized, setFilterSeized] = useState("all"); // all | seized
  const [orderPopup, setOrderPopup] = useState(null);
  const [seizePopup, setSeizePopup] = useState(null);
  const [seizureMap, setSeizureMap] = useState({}); // "BRAND:doc_no" -> seizure

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const [hOrdRes, yOrdRes, hDepRes, yDepRes, seizeRes] = await Promise.all([
        fetch(SPARE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_spare_orders" }) }),
        fetch(YAMAHA_SPARE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_yamaha_orders", include_seized: true }) }).catch(() => null),
        fetch(SPARE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_honda_deposits" }) }),
        fetch(YAMAHA_DEPOSIT_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }),
        fetch(SPARE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_deposit_seizures" }) }).catch(() => null),
      ]);
      const norm = (data) => Array.isArray(data) ? data : (data?.items || data?.rows || []);
      const hOrders = norm(await hOrdRes.json()).map(o => ({ ...o, brand: "HONDA" }));
      const yOrders = yOrdRes ? norm(await yOrdRes.json()).map(o => ({ ...o, brand: "YAMAHA" })) : [];
      const hDeposits = norm(await hDepRes.json());
      const yDeposits = norm(await yDepRes.json());
      const depMap = {};
      // HONDA ใช้ deposit_doc_no, YAMAHA ใช้ receipt_no — รับทั้งคู่ไว้
      hDeposits.forEach(d => {
        const key = d?.deposit_doc_no || d?.receipt_no;
        if (key) depMap[`HONDA:${key}`] = { ...d, receipt_no: d?.receipt_no || d?.deposit_doc_no, deposit_doc_no: d?.deposit_doc_no || d?.receipt_no };
      });
      yDeposits.forEach(d => {
        const key = d?.receipt_no || d?.deposit_doc_no;
        if (key) depMap[`YAMAHA:${key}`] = { ...d, receipt_no: d?.receipt_no || d?.deposit_doc_no };
      });
      // หา deposit ที่ "ยังไม่ได้สั่งซื้อ" (ไม่มี order อ้างอิงถึง) — สร้าง pseudo-order
      const orderedDocSet = new Set([...hOrders, ...yOrders].map(o => `${o.brand}:${o.deposit_doc_no}`));
      const isSparePartsDeposit = (d) => {
        const t = String(d?.deposit_type || "");
        const rn = String(d?.receipt_no || d?.deposit_doc_no || "");
        // YAMAHA: type "เงินมัดจำอะไหล่" หรือ prefix SCY01
        // HONDA: type มีคำว่า "อะไหล่" หรือ prefix DEPD
        return t.includes("อะไหล่") || rn.startsWith("SCY01") || rn.startsWith("DEPD");
      };
      const pseudoOrders = [];
      Object.entries(depMap).forEach(([key, dep]) => {
        const [brand, docNo] = key.split(":");
        if (orderedDocSet.has(key)) return;
        if (!isSparePartsDeposit(dep)) return;
        pseudoOrders.push({
          brand,
          order_id: `pseudo-${key}`,
          order_no: null,
          order_type: "ไม่มีใบสั่งซื้อ",
          deposit_doc_no: docNo,
          customer_name: dep.customer_name || "",
          customer_code: dep.customer_code || "",
          technician: "",
          license_plate: "",
          model_name: "",
          parking_status: "",
          status: "ไม่ได้สั่งซื้อ",
          vendor_po_no: null,
          created_at: dep.deposit_date,
          __pseudo: true,
        });
      });

      const allOrders = [...hOrders, ...yOrders, ...pseudoOrders]
        .filter(o => o && o.deposit_doc_no)
        .sort((a, b) => {
          const depA = depMap[`${a.brand}:${a.deposit_doc_no}`];
          const depB = depMap[`${b.brand}:${b.deposit_doc_no}`];
          const dateA = depA?.deposit_date ? new Date(depA.deposit_date).getTime() : 0;
          const dateB = depB?.deposit_date ? new Date(depB.deposit_date).getTime() : 0;
          return dateB - dateA;
        });
      setOrders(allOrders);
      setDeposits(depMap);
      // โหลด seizures ที่มีอยู่
      if (seizeRes) {
        try {
          const seizes = norm(await seizeRes.json());
          const sMap = {};
          seizes.forEach(s => { if (s?.brand && s?.deposit_doc_no) sMap[`${s.brand}:${s.deposit_doc_no}`] = s; });
          setSeizureMap(sMap);
        } catch { setSeizureMap({}); }
      }
    } catch (e) {
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + e.message);
      setOrders([]);
    }
    setLoading(false);
  }

  const filtered = orders.filter(o => {
    // ตัดที่ไม่มี deposit ตรงกัน
    const dep = deposits[`${o.brand}:${o.deposit_doc_no}`];
    if (!dep) return false;
    // ตัดสถานะอะไหล่ค้างส่ง (อะไหล่ยังมาไม่ครบ ไม่ควรยึด)
    if (o.status === "อะไหล่ค้างส่ง") return false;
    if (filterBrand !== "all" && o.brand !== filterBrand) return false;
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (filterSeized === "seized" && !seizureMap[`${o.brand}:${o.deposit_doc_no}`]) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [o.customer_name, o.deposit_doc_no, o.technician, o.license_plate, o.model_name]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
  });

  const totalAmount = filtered.reduce((s, o) => {
    const dep = deposits[`${o.brand}:${o.deposit_doc_no}`];
    return s + Number(dep?.deposit_amount || dep?.amount || 0);
  }, 0);

  // ใช้ orders ที่ผ่าน base filter (มี deposit + ไม่ใช่อะไหล่ค้างส่ง) เป็นฐาน count
  const baseOrders = orders.filter(o => deposits[`${o.brand}:${o.deposit_doc_no}`] && o.status !== "อะไหล่ค้างส่ง");
  const statusCounts = {
    all: baseOrders.length,
    "รอดำเนินการ": baseOrders.filter(o => o.status === "รอดำเนินการ").length,
    "สั่งซื้อแล้ว": baseOrders.filter(o => o.status === "สั่งซื้อแล้ว").length,
    "มาครบ": baseOrders.filter(o => o.status === "มาครบ").length,
    "มาไม่ครบ": baseOrders.filter(o => o.status === "มาไม่ครบ").length,
    "เปิดงาน": baseOrders.filter(o => o.status === "เปิดงาน").length,
    "ปิดงานซ่อม": baseOrders.filter(o => o.status === "ปิดงานซ่อม").length,
    "ดีราคาซ่อม": baseOrders.filter(o => o.status === "ดีราคาซ่อม").length,
    "ไม่ได้สั่งซื้อ": baseOrders.filter(o => o.status === "ไม่ได้สั่งซื้อ").length,
  };
  const brandCounts = {
    HONDA: baseOrders.filter(o => o.brand === "HONDA").length,
    YAMAHA: baseOrders.filter(o => o.brand === "YAMAHA").length,
  };
  const seizedCount = baseOrders.filter(o => seizureMap[`${o.brand}:${o.deposit_doc_no}`]).length;

  async function openSeize(o) {
    const dep = deposits[`${o.brand}:${o.deposit_doc_no}`];
    const existing = seizureMap[`${o.brand}:${o.deposit_doc_no}`];
    setSeizePopup({
      order: o, dep, items: existing?.items || [], loading: !o.__pseudo,
      reason: existing?.reason || "", note: existing?.note || "",
      seizure_amount: existing?.seizure_amount || dep?.deposit_amount || dep?.amount || 0,
      saving: false, existing,
    });
    // pseudo-order = ใบมัดจำที่ยังไม่ได้สั่งซื้อ → ไม่มี order_detail ให้โหลด
    if (o.__pseudo) return;
    // โหลด items จาก order_detail
    try {
      const api = o.brand === "HONDA" ? SPARE_API : YAMAHA_SPARE_API;
      const action = o.brand === "HONDA" ? "get_spare_order_detail" : "get_yamaha_order_detail";
      const res = await fetch(api, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, order_id: o.order_id }),
      });
      const data = await res.json();
      const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      const mapped = items.map(it => ({
        order_no: o.order_no, order_type: o.order_type,
        part_code: it.part_code, part_name: it.part_name,
        quantity: it.quantity, unit_price: it.unit_price,
        total_price: it.total_price || (Number(it.quantity || 0) * Number(it.unit_price || 0)),
        status: o.status,
      }));
      setSeizePopup(p => p ? { ...p, items: mapped, loading: false } : null);
    } catch {
      setSeizePopup(p => p ? { ...p, loading: false } : null);
    }
  }

  async function submitSeize() {
    if (!seizePopup) return;
    const { order, dep, items, reason, note, seizure_amount } = seizePopup;
    if (!reason.trim()) { alert("กรุณาระบุเหตุผลการยึด"); return; }
    setSeizePopup(p => ({ ...p, saving: true }));
    try {
      const partsTotal = items.reduce((s, it) => s + Number(it.total_price || 0), 0);
      const res = await fetch(SPARE_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_deposit_seizure",
          brand: order.brand,
          deposit_doc_no: order.deposit_doc_no,
          deposit_date: dep?.deposit_date,
          customer_name: order.customer_name || dep?.customer_name,
          technician: order.technician,
          model_name: order.model_name,
          license_plate: order.license_plate,
          deposit_amount: Number(dep?.deposit_amount || dep?.amount || 0),
          parts_total: partsTotal,
          seizure_amount: Number(seizure_amount || 0),
          reason, note,
          created_by: currentUser?.username || currentUser?.name || "system",
          items,
        }),
      });
      const data = await res.json();
      const r = Array.isArray(data) ? data[0] : data;
      if (r?.error_msg) throw new Error(r.error_msg);
      setMessage(`✅ บันทึกการยึดเงินมัดจำ ${order.deposit_doc_no} สำเร็จ`);
      setSeizePopup(null);
      fetchData();
    } catch (e) {
      alert("❌ บันทึกล้มเหลว: " + e.message);
      setSeizePopup(p => p ? { ...p, saving: false } : null);
    }
  }

  async function cancelSeize(o) {
    const existing = seizureMap[`${o.brand}:${o.deposit_doc_no}`];
    if (!existing) return;
    if (!window.confirm(`ยกเลิกการยึดเงินมัดจำ ${o.deposit_doc_no}?`)) return;
    try {
      const res = await fetch(SPARE_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_deposit_seizure", seizure_id: existing.seizure_id }),
      });
      const data = await res.json();
      const r = Array.isArray(data) ? data[0] : data;
      if (r?.error_msg) throw new Error(r.error_msg);
      setMessage(`✅ ยกเลิกการยึด ${o.deposit_doc_no} สำเร็จ`);
      fetchData();
    } catch (e) {
      alert("❌ ยกเลิกล้มเหลว: " + e.message);
    }
  }

  function printOrderItems() {
    if (!orderPopup) return;
    const o = orderPopup.order;
    const items = orderPopup.items || [];
    const total = items.reduce((s, it) => s + Number(it.total_price || (it.quantity * it.unit_price) || 0), 0);
    const dep = deposits[`${o.brand}:${o.deposit_doc_no}`];
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายการอะไหล่ที่สั่งซื้อ - ${o.deposit_doc_no}</title>
<style>
  body { font-family: 'Tahoma', sans-serif; padding: 20px; font-size: 12px; }
  h2 { margin: 0 0 6px; font-size: 16px; }
  .info { background: #f8fafc; padding: 8px; border-radius: 6px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .info b { color: #072d6b; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #072d6b; color: #fff; padding: 6px; text-align: left; }
  td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
  .r { text-align: right; }
  .c { text-align: center; }
  .mono { font-family: monospace; }
  tfoot td { background: #f3f4f6; font-weight: 700; border-top: 2px solid #072d6b; }
  @media print { @page { size: A4; margin: 12mm; } }
</style></head><body>
<h2>📦 รายการอะไหล่ที่สั่งซื้อ — ${o.deposit_doc_no}</h2>
<div class="info">
  <div><b>ยี่ห้อ:</b> ${o.brand}</div>
  <div><b>วันที่มัดจำ:</b> ${fmtDate(dep?.deposit_date)}</div>
  <div><b>ลูกค้า:</b> ${o.customer_name || dep?.customer_name || "-"}</div>
  <div><b>รุ่นรถ:</b> ${o.model_name || "-"}</div>
  <div><b>ทะเบียน:</b> ${o.license_plate || "-"}</div>
  <div><b>ช่าง:</b> ${(o.technician || "").split(" ")[0] || "-"}</div>
  <div><b>สถานะ:</b> ${o.status || "-"}</div>
  <div><b>ยอดมัดจำ:</b> ${fmt(dep?.deposit_amount || dep?.amount || 0)} บาท</div>
  <div><b>พิมพ์:</b> ${new Date().toLocaleString("th-TH")}</div>
</div>
<table>
  <thead>
    <tr><th>#</th><th>รหัส</th><th>ชื่ออะไหล่</th><th class="r">จำนวน</th><th class="r">ราคา/หน่วย</th><th class="r">รวม</th></tr>
  </thead>
  <tbody>
    ${items.map((it, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td class="mono"><b>${it.part_code || "-"}</b></td>
      <td>${it.part_name || "-"}</td>
      <td class="r">${fmt(it.quantity)}</td>
      <td class="r mono">${fmt(it.unit_price)}</td>
      <td class="r mono"><b>${fmt(it.total_price || (Number(it.quantity || 0) * Number(it.unit_price || 0)))}</b></td>
    </tr>`).join("")}
  </tbody>
  <tfoot>
    <tr><td colSpan="5" class="r">ยอดรวมทั้งสิ้น:</td><td class="r mono">${fmt(total)}</td></tr>
  </tfoot>
</table>
<script>window.onload = () => { window.print(); };</script>
</body></html>`);
    w.document.close();
  }

  async function viewOrderItems(o) {
    setOrderPopup({ order: o, items: [], loading: true });
    try {
      const api = o.brand === "HONDA" ? SPARE_API : YAMAHA_SPARE_API;
      const action = o.brand === "HONDA" ? "get_spare_order_detail" : "get_yamaha_order_detail";
      const res = await fetch(api, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, order_id: o.order_id }),
      });
      const data = await res.json();
      const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      setOrderPopup({ order: o, items, loading: false });
    } catch (e) {
      setOrderPopup({ order: o, items: [], loading: false, error: e.message });
    }
  }

  const STATUS_COLOR = {
    "รอดำเนินการ": "#fbbf24",
    "สั่งซื้อแล้ว": "#10b981",
    "มาครบ": "#3b82f6",
    "มาไม่ครบ": "#f59e0b",
    "เปิดงาน": "#ec4899",
    "ปิดงานซ่อม": "#dc2626",
    "ดีราคาซ่อม": "#a78bfa",
    "ไม่ได้สั่งซื้อ": "#64748b",
  };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🔒 ยึดเงินมัดจำ</h2>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, background: "#fef3c7", borderRadius: 6, color: "#92400e" }}>{message}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb", alignItems: "center", flexWrap: "wrap" }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 ค้นหา (เลขที่มัดจำ / ลูกค้า / ช่าง / ทะเบียน / รุ่น)"
          style={{ ...inp, flex: 1, minWidth: 250 }} />
        <button onClick={fetchData} disabled={loading} style={btn("#0369a1")}>🔄 รีเฟรช</button>
      </div>

      {/* Brand tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <button onClick={() => setFilterBrand("all")} style={tabBtn(filterBrand === "all", "#072d6b")}>ทั้งหมด ({statusCounts.all})</button>
        <button onClick={() => setFilterBrand("HONDA")} style={tabBtn(filterBrand === "HONDA", "#dc2626")}>🔴 HONDA ({brandCounts.HONDA})</button>
        <button onClick={() => setFilterBrand("YAMAHA")} style={tabBtn(filterBrand === "YAMAHA", "#1e40af")}>🔵 YAMAHA ({brandCounts.YAMAHA})</button>
        <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: 13 }}>
          พบ <strong>{filtered.length}</strong> รายการ · ยอดมัดจำรวม <strong style={{ color: "#dc2626" }}>{fmt(totalAmount)}</strong> บาท
        </span>
      </div>

      {/* Status tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => setFilterStatus("all")} style={chip(filterStatus === "all", "#072d6b")}>ทั้งหมด ({statusCounts.all})</button>
        {Object.entries(STATUS_COLOR).map(([st, color]) => (
          <button key={st} onClick={() => setFilterStatus(st)} style={chip(filterStatus === st, color)}>
            {st} ({statusCounts[st] || 0})
          </button>
        ))}
        <span style={{ borderLeft: "1px solid #d1d5db", margin: "0 2px" }} />
        <button onClick={() => setFilterSeized(filterSeized === "seized" ? "all" : "seized")}
          style={chip(filterSeized === "seized", "#16a34a")}>
          🔒 ยึดเงินมัดจำแล้ว ({seizedCount})
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div>
         : filtered.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่พบรายการ</div>
         : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
           <thead style={{ background: "#072d6b", color: "#fff" }}>
             <tr>
               <th style={th}>#</th>
               <th style={th}>ยี่ห้อ</th>
               <th style={th}>ประเภท</th>
               <th style={th}>วันที่มัดจำ</th>
               <th style={th}>เลขที่มัดจำ</th>
               <th style={th}>ลูกค้า</th>
               <th style={th}>ช่าง</th>
               <th style={th}>รุ่นรถ</th>
               <th style={th}>ทะเบียน</th>
               <th style={th}>สถานะจอด</th>
               <th style={th}>สถานะ</th>
               <th style={{ ...th, textAlign: "right" }}>ยอดมัดจำ</th>
               <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
             </tr>
           </thead>
           <tbody>
             {filtered.map((o, i) => {
               const dep = deposits[`${o.brand}:${o.deposit_doc_no}`];
               const statusColor = STATUS_COLOR[o.status] || "#6b7280";
               return (
               <tr key={`${o.brand}-${o.order_id || o.deposit_doc_no}-${i}`} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                 <td style={{ ...td, textAlign: "center", color: "#6b7280" }}>{i + 1}</td>
                 <td style={td}>
                   <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                     background: o.brand === "HONDA" ? "#fee2e2" : "#dbeafe",
                     color: o.brand === "HONDA" ? "#b91c1c" : "#1e40af" }}>{o.brand}</span>
                 </td>
                 <td style={td}>
                   <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                     background: o.order_type === "ปกติ" ? "#dbeafe" : "#fef3c7",
                     color: o.order_type === "ปกติ" ? "#1e40af" : "#92400e" }}>{o.order_type || "-"}</span>
                 </td>
                 <td style={td}>{fmtDate(dep?.deposit_date)}</td>
                 <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{o.deposit_doc_no}</td>
                 <td style={td}>{o.customer_name || dep?.customer_name || "-"}</td>
                 <td style={td}>{(o.technician || "").split(" ")[0] || "-"}</td>
                 <td style={td}>{o.model_name || "-"}</td>
                 <td style={td}>{o.license_plate || "-"}</td>
                 <td style={td}>{o.parking_status || "-"}</td>
                 <td style={td}>
                   <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                     background: statusColor + "33", color: statusColor }}>{o.status || "-"}</span>
                 </td>
                 <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#dc2626" }}>
                   {fmt(dep?.deposit_amount || dep?.amount || 0)}
                 </td>
                 <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                   <button onClick={() => viewOrderItems(o)} style={btnSm("#0369a1")}>👁️ ดูอะไหล่</button>
                   {seizureMap[`${o.brand}:${o.deposit_doc_no}`] ? (
                     <>
                       <button onClick={() => openSeize(o)} style={{ ...btnSm("#10b981"), marginLeft: 4 }}>✓ ยึดแล้ว</button>
                       <button onClick={() => cancelSeize(o)} style={{ ...btnSm("#6b7280"), marginLeft: 4 }}>↶ ยกเลิก</button>
                     </>
                   ) : (
                     <button onClick={() => openSeize(o)} style={{ ...btnSm("#dc2626"), marginLeft: 4 }}>🔒 ยึด</button>
                   )}
                 </td>
               </tr>
             );})}
           </tbody>
         </table>}
      </div>

      {seizePopup && (
        <div onClick={() => !seizePopup.saving && setSeizePopup(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, padding: 20, width: "92%", maxWidth: 1000, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: "#dc2626" }}>🔒 {seizePopup.existing ? "แก้ไขการยึดเงินมัดจำ" : "ยึดเงินมัดจำ"} — {seizePopup.order.deposit_doc_no}</h3>
              <button onClick={() => setSeizePopup(null)} disabled={seizePopup.saving} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>
            <div style={{ padding: 10, background: "#f8fafc", borderRadius: 8, marginBottom: 12, fontSize: 13, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div><span style={{ color: "#6b7280" }}>ยี่ห้อ:</span> <strong style={{ color: seizePopup.order.brand === "HONDA" ? "#b91c1c" : "#1e40af" }}>{seizePopup.order.brand}</strong></div>
              <div><span style={{ color: "#6b7280" }}>ลูกค้า:</span> <strong>{seizePopup.order.customer_name || "-"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>ยอดมัดจำ:</span> <strong style={{ color: "#dc2626" }}>{fmt(seizePopup.dep?.deposit_amount || seizePopup.dep?.amount || 0)}</strong></div>
              <div><span style={{ color: "#6b7280" }}>รุ่นรถ:</span> <strong>{seizePopup.order.model_name || "-"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>ทะเบียน:</span> <strong>{seizePopup.order.license_plate || "-"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>ช่าง:</span> <strong>{(seizePopup.order.technician || "").split(" ")[0] || "-"}</strong></div>
            </div>

            {/* Items table */}
            <div style={{ fontWeight: 600, marginBottom: 6 }}>📦 รายการอะไหล่ที่สั่งซื้อ</div>
            {seizePopup.loading ? (
              <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
            ) : seizePopup.items.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", background: "#f9fafb", borderRadius: 6 }}>ไม่มีรายการ</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
                <thead style={{ background: "#f3f4f6" }}>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>รหัส</th>
                    <th style={th}>ชื่ออะไหล่</th>
                    <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
                    <th style={{ ...th, textAlign: "right" }}>ราคา/หน่วย</th>
                    <th style={{ ...th, textAlign: "right" }}>รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {seizePopup.items.map((it, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ ...td, textAlign: "center", color: "#6b7280" }}>{i + 1}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{it.part_code}</td>
                      <td style={{ ...td, fontSize: 11 }}>{it.part_name || "-"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmt(it.quantity)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(it.unit_price)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmt(it.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{ background: "#f9fafb", fontWeight: 700 }}>
                  <tr>
                    <td colSpan={5} style={{ ...td, textAlign: "right" }}>ยอดอะไหล่รวม:</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>
                      {fmt(seizePopup.items.reduce((s, it) => s + Number(it.total_price || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* Input form */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>เหตุผลการยึด *</label>
                <input type="text" value={seizePopup.reason}
                  onChange={e => setSeizePopup(p => ({ ...p, reason: e.target.value }))}
                  placeholder="เช่น ลูกค้าไม่มารับ, ทิ้งงาน, อื่นๆ"
                  style={{ ...inp, width: "100%", marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>ยอดที่ยึด *</label>
                <input type="number" step="0.01" value={seizePopup.seizure_amount}
                  onChange={e => setSeizePopup(p => ({ ...p, seizure_amount: e.target.value }))}
                  style={{ ...inp, width: "100%", marginTop: 4, textAlign: "right", fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "#dc2626" }} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>หมายเหตุ</label>
              <textarea value={seizePopup.note}
                onChange={e => setSeizePopup(p => ({ ...p, note: e.target.value }))}
                rows={2}
                style={{ ...inp, width: "100%", marginTop: 4, fontFamily: "Tahoma" }} />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setSeizePopup(null)} disabled={seizePopup.saving} style={btn("#6b7280")}>ยกเลิก</button>
              <button onClick={submitSeize} disabled={seizePopup.saving} style={btn(seizePopup.saving ? "#9ca3af" : "#dc2626")}>
                {seizePopup.saving ? "⏳ กำลังบันทึก..." : "💾 บันทึกการยึด"}
              </button>
            </div>
          </div>
        </div>
      )}

      {orderPopup && (
        <div onClick={() => setOrderPopup(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, padding: 20, width: "90%", maxWidth: 900, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: "#0369a1" }}>📦 รายการอะไหล่ที่สั่งซื้อ</h3>
              <button onClick={() => setOrderPopup(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>
            <div style={{ padding: 10, background: "#f8fafc", borderRadius: 8, marginBottom: 12, fontSize: 13, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div><span style={{ color: "#6b7280" }}>ยี่ห้อ:</span> <strong style={{ color: orderPopup.order.brand === "HONDA" ? "#b91c1c" : "#1e40af" }}>{orderPopup.order.brand}</strong></div>
              <div><span style={{ color: "#6b7280" }}>เลขที่มัดจำ:</span> <strong style={{ fontFamily: "monospace" }}>{orderPopup.order.deposit_doc_no}</strong></div>
              <div><span style={{ color: "#6b7280" }}>ลูกค้า:</span> <strong>{orderPopup.order.customer_name || "-"}</strong></div>
            </div>
            {orderPopup.loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
            ) : orderPopup.error ? (
              <div style={{ padding: 12, background: "#fef2f2", color: "#991b1b", borderRadius: 6 }}>❌ {orderPopup.error}</div>
            ) : orderPopup.items.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการสั่งซื้อ</div>
            ) : (
              <>
                <div style={{ marginBottom: 8, fontSize: 13, color: "#6b7280" }}>
                  รวม <strong>{orderPopup.items.length}</strong> รายการ ·
                  ยอดรวม <strong style={{ color: "#dc2626" }}>{fmt(orderPopup.items.reduce((s, it) => s + Number(it.total_price || (it.quantity * it.unit_price) || 0), 0))}</strong> บาท
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ background: "#072d6b", color: "#fff" }}>
                    <tr>
                      <th style={th}>#</th>
                      <th style={th}>รหัส</th>
                      <th style={th}>ชื่ออะไหล่</th>
                      <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
                      <th style={{ ...th, textAlign: "right" }}>ราคา/หน่วย</th>
                      <th style={{ ...th, textAlign: "right" }}>รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderPopup.items.map((it, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                        <td style={{ ...td, textAlign: "center", color: "#6b7280" }}>{i + 1}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{it.part_code}</td>
                        <td style={{ ...td, fontSize: 11 }}>{it.part_name || "-"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmt(it.quantity)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(it.unit_price)}</td>
                        <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                          {fmt(it.total_price || (Number(it.quantity || 0) * Number(it.unit_price || 0)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={printOrderItems} disabled={!orderPopup.items?.length} style={btn(orderPopup.items?.length ? "#0369a1" : "#9ca3af")}>🖨️ พิมพ์</button>
              <button onClick={() => setOrderPopup(null)} style={btn("#6b7280")}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma" };
const btn = (color) => ({ padding: "8px 16px", background: color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontSize: 13, fontWeight: 600 });
const btnSm = (color) => ({ padding: "4px 10px", background: color, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 });
const tabBtn = (active, color) => ({
  padding: "8px 16px", border: `2px solid ${color}`, borderRadius: 8, cursor: "pointer",
  background: active ? color : "#fff", color: active ? "#fff" : color,
  fontFamily: "Tahoma", fontSize: 13, fontWeight: 700,
});
const chip = (active, color) => ({
  padding: "4px 12px", border: `1px solid ${color}`, borderRadius: 20, cursor: "pointer",
  background: active ? color : "#fff", color: active ? "#fff" : color,
  fontFamily: "Tahoma", fontSize: 12, fontWeight: 600,
});
const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12, fontWeight: 700 };
const td = { padding: "8px", verticalAlign: "middle" };
