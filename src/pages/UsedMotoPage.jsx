import { useState, useEffect, useMemo } from "react";

// รถมือสอง — รับซื้อ/รับเทิร์น → สต๊อก → ขาย (รับเงินหลายวิธี) → เข้าสรุปรายวันรับเงิน
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/used-moto-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const CUST_SEARCH_API = "https://n8n-new-project-gwf2.onrender.com/webhook/booking-deposit-api"; // search_customers
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api"; // get_types — ยี่ห้อ/รุ่น/แบบ/type
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api"; // list_retail_sales — เลือกใบขายรถใหม่ที่รับเทิร์น

const num = (v) => Number(v) || 0;
const fmt = (v) => num(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const thaiDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(String(iso).slice(0, 10));
  return isNaN(d) ? String(iso).slice(0, 10) : d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
};
async function post(body) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  if (!t.trim()) return [];
  const d = JSON.parse(t);
  return Array.isArray(d) ? d : (d?.rows || []);
}

const PAY_METHODS = ["เงินสด", "เงินโอน", "QR", "อื่นๆ"];
const inp = { width: "100%", padding: "7px 9px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 14, boxSizing: "border-box" };
const th = { padding: "7px 8px", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap" };
const td = { padding: "6px 8px", fontSize: 13 };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3, color: "#334155" }}>{label}</div>
      {children}
    </div>
  );
}

const EMPTY_FORM = {
  receive_date: todayISO(), source_type: "รับซื้อ", ref_sale_no: "",
  brand: "ฮอนด้า", model_series: "", model_code: "", type_name: "", color_name: "",
  engine_no: "", chassis_no: "", license_plate: "", province: "", registration_year: "",
  cost_amount: "", extra_cost: "", seller_name: "", seller_phone: "", note: "",
};

export default function UsedMotoPage({ currentUser }) {
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const [tab, setTab] = useState("stock"); // stock | sold
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [kw, setKw] = useState("");

  async function load() {
    setLoading(true);
    try {
      const d = await post({ action: "list_used" });
      setRows(d.filter(r => r && r.id));
    } catch (e) { setMessage("❌ โหลดไม่สำเร็จ: " + String(e.message || e).slice(0, 120)); }
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // master ยี่ห้อ/รุ่น/แบบ/type — รวมรุ่นเก่า (inactive) เพราะรถมือสองส่วนใหญ่เป็นรุ่นเลิกผลิต
  const [motoTypes, setMotoTypes] = useState([]);
  useEffect(() => {
    fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_types" }) })
      .then(r => r.json()).then(d => setMotoTypes(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  const seriesNameOf = (m) => String(m.marketing_name || m.series_name || "").trim();
  const brandOpts = useMemo(() => [...new Set(motoTypes.map(m => m.brand_name).filter(Boolean))].sort(), [motoTypes]);
  const seriesOpts = (brand) => [...new Set(motoTypes.filter(m => !brand || m.brand_name === brand).map(seriesNameOf).filter(Boolean))].sort();
  const modelOpts = (brand, series) => [...new Set(motoTypes
    .filter(m => (!brand || m.brand_name === brand) && (!series || seriesNameOf(m) === series))
    .map(m => m.model_code).filter(Boolean))].sort();
  const typeOpts = (brand, series, model) => [...new Set(motoTypes
    .filter(m => (!brand || m.brand_name === brand) && (!series || seriesNameOf(m) === series) && (!model || m.model_code === model))
    .map(m => m.type_name).filter(Boolean))].sort();

  const kwU = kw.trim().toUpperCase();
  const match = (r) => !kwU || [r.doc_no, r.engine_no, r.chassis_no, r.license_plate, r.model_series, r.seller_name, r.sold_customer]
    .some(v => String(v || "").toUpperCase().includes(kwU));
  const stockRows = rows.filter(r => r.status === "in_stock" && match(r));
  const soldRows = rows.filter(r => r.status === "sold" && match(r));

  // ===== ฟอร์มรับเข้า / แก้ไข =====
  const [form, setForm] = useState(null); // null = ปิด, {id?} = แก้ไข
  const setF = (patch) => setForm(f => ({ ...f, ...patch }));

  // ใบขายรถใหม่ย้อนหลัง 120 วัน — ให้เลือกเป็น "ใบขายที่เทิร์น" (โหลดครั้งแรกที่เปิดฟอร์ม)
  const [tradeSales, setTradeSales] = useState(null);
  useEffect(() => {
    if (!form || tradeSales !== null) return;
    const from = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
    fetch(RETAIL_API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_retail_sales", date_from: from, limit: 500 }),
    }).then(r => r.json())
      .then(d => setTradeSales((Array.isArray(d) ? d : []).filter(s => s && s.invoice_no)))
      .catch(() => setTradeSales([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!form]);

  async function saveForm() {
    if (!form.model_series.trim() && !form.engine_no.trim()) { setMessage("❌ ใส่รุ่นรถหรือเลขเครื่องอย่างน้อย 1 อย่าง"); return; }
    if (!num(form.cost_amount)) { setMessage("❌ ใส่ราคารับซื้อ/ตีเทิร์น"); return; }
    try {
      const body = form.id
        ? { action: "update_used", ...form }
        : { action: "save_used", ...form, branch_code: myBranch, created_by: currentUser?.username || currentUser?.name || "" };
      const d = await post(body);
      const row = d[0];
      if (!row?.id) throw new Error(row?.error || (form.id ? "แก้ไขไม่สำเร็จ" : "เลขเครื่องนี้มีอยู่ในสต๊อกแล้ว หรือ workflow ยังไม่ import"));
      setMessage(`✅ ${form.id ? "แก้ไขแล้ว" : `รับเข้าแล้ว เลขที่ ${row.doc_no}`}`);
      setForm(null); load();
    } catch (e) { setMessage("❌ " + String(e.message || e).slice(0, 160)); }
  }

  async function cancelUsed(r) {
    if (!window.confirm(`ยกเลิกทะเบียนรับเข้า ${r.doc_no} (${r.model_series || r.engine_no})?`)) return;
    try {
      const d = await post({ action: "cancel_used", id: r.id });
      if (!d[0]?.id) throw new Error("ยกเลิกไม่สำเร็จ");
      setMessage("✅ ยกเลิกแล้ว"); load();
    } catch (e) { setMessage("❌ " + String(e.message || e).slice(0, 120)); }
  }

  // ===== ขาย =====
  const [sellModal, setSellModal] = useState(null); // {row, sold_date, customer, phone, price, rows[], note, saving}
  const [bankAccounts, setBankAccounts] = useState([]);
  const bankLabelOf = (a) => [a.bank_name, a.account_no, a.account_name].filter(Boolean).join(" · ");

  function openSell(r) {
    setSellModal({
      row: r, sold_date: todayISO(), customer: "", phone: "",
      price: "", rows: [{ method: "เงินสด", amount: "", account: "" }], note: "", saving: false,
    });
    if (!bankAccounts.length) {
      fetch(ACC_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
      }).then(r2 => r2.json()).then(d => setBankAccounts(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }
  const setSellRow = (i, patch) => setSellModal(m => ({ ...m, rows: m.rows.map((r, j) => j === i ? { ...r, ...patch } : r) }));
  const sellTotal = (m) => (m?.rows || []).reduce((s, r) => s + num(r.amount), 0);
  function changeSellPrice(v) {
    setSellModal(m => ({
      ...m, price: v,
      rows: (m.rows.length === 1) ? [{ ...m.rows[0], amount: v }] : m.rows,
    }));
  }

  // ค้นหาลูกค้า
  const [custPop, setCustPop] = useState(false);
  const [custKw, setCustKw] = useState("");
  const [custResults, setCustResults] = useState(null);
  const [custSearching, setCustSearching] = useState(false);
  async function searchCustomers() {
    const q = custKw.trim();
    if (!q || custSearching) return;
    setCustSearching(true);
    try {
      const res = await fetch(CUST_SEARCH_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search_customers", keyword: q }),
      });
      const d = await res.json();
      const seen = new Set(); const list = [];
      for (const x of (Array.isArray(d) ? d : [])) {
        const k = [x.customer_code, x.customer_name, x.customer_phone].join("|");
        if (!x.customer_name || seen.has(k)) continue;
        seen.add(k); list.push(x);
      }
      setCustResults(list.slice(0, 30));
    } catch { setCustResults([]); }
    setCustSearching(false);
  }

  async function saveSell() {
    const m = sellModal;
    const list = m.rows.filter(r => num(r.amount) > 0);
    if (!m.customer.trim()) { setMessage("❌ ใส่ชื่อผู้ซื้อ"); return; }
    if (!num(m.price)) { setMessage("❌ ใส่ราคาขาย"); return; }
    if (!list.length) { setMessage("❌ ใส่ยอดรับชำระอย่างน้อย 1 วิธี"); return; }
    if (list.some(r => r.method === "เงินโอน" && !r.account)) { setMessage("❌ เลือกบัญชีรับโอนของรายการเงินโอน"); return; }
    if (Math.abs(sellTotal(m) - num(m.price)) >= 0.01 &&
        !window.confirm(`รวมรับชำระ ${fmt(sellTotal(m))} ไม่เท่าราคาขาย ${fmt(m.price)}\nบันทึกต่อหรือไม่?`)) return;
    setSellModal(x => ({ ...x, saving: true }));
    try {
      const d = await post({
        action: "sell_used", id: m.row.id,
        sold_date: m.sold_date, sold_customer: m.customer, sold_customer_phone: m.phone,
        sold_price: num(m.price),
        payments: list.map(r => ({ method: r.method, amount: num(r.amount), account: r.method === "เงินโอน" ? r.account : "" })),
        payment_note: m.note, sold_by: currentUser?.username || currentUser?.name || "",
      });
      if (!d[0]?.id) throw new Error(d[0]?.error || "บันทึกขายไม่สำเร็จ (คันนี้อาจถูกขาย/ยกเลิกไปแล้ว)");
      setMessage(`✅ ขาย ${m.row.model_series || m.row.engine_no} ให้ ${m.customer} ราคา ${fmt(m.price)} แล้ว — เข้าสรุปรายวันรับเงินอัตโนมัติ`);
      setSellModal(null); load();
    } catch (e) {
      setMessage("❌ " + String(e.message || e).slice(0, 160));
      setSellModal(x => x ? { ...x, saving: false } : x);
    }
  }

  async function cancelSale(r) {
    if (!window.confirm(`ยกเลิกการขาย ${r.doc_no} (${r.sold_customer} · ${fmt(r.sold_price)})?\nรถจะกลับเข้าสต๊อกมือสอง`)) return;
    try {
      const d = await post({ action: "cancel_sale", id: r.id });
      if (!d[0]?.id) throw new Error("ยกเลิกไม่สำเร็จ");
      setMessage("✅ ยกเลิกการขายแล้ว รถกลับเข้าสต๊อก"); load();
    } catch (e) { setMessage("❌ " + String(e.message || e).slice(0, 120)); }
  }

  // ===== รูปรถ (สูงสุด 4 รูป/คัน) =====
  const [photoModal, setPhotoModal] = useState(null); // { row, images: null|[], uploading: slot|null }
  const [photoView, setPhotoView] = useState(null);   // dataURL รูปใหญ่

  async function openPhotos(r) {
    setPhotoModal({ row: r, images: null, uploading: null });
    try {
      const d = await post({ action: "get_images", used_id: r.id });
      setPhotoModal(m => m && m.row.id === r.id ? { ...m, images: d.filter(x => x && x.image_id) } : m);
    } catch { setPhotoModal(m => m && m.row.id === r.id ? { ...m, images: [] } : m); }
  }

  // ย่อรูปก่อนบันทึก (ยาวสุด ~1200px, JPEG) กัน payload บวม
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function uploadPhoto(slot, file) {
    if (!file || !photoModal) return;
    setPhotoModal(m => ({ ...m, uploading: slot }));
    try {
      const dataUrl = await resizeImage(file);
      const d = await post({ action: "save_image", used_id: photoModal.row.id, slot, image_data: dataUrl, mime_type: "image/jpeg" });
      if (!d[0]?.image_id) throw new Error("บันทึกรูปไม่สำเร็จ — re-import Used_Moto_Workflow.json ก่อน");
      await openPhotos(photoModal.row);
      load();
    } catch (e) {
      setMessage("❌ " + String(e.message || e).slice(0, 140));
      setPhotoModal(m => m ? { ...m, uploading: null } : m);
    }
  }

  async function deletePhoto(img) {
    if (!window.confirm("ลบรูปนี้?")) return;
    try {
      await post({ action: "delete_image", image_id: img.image_id });
      await openPhotos(photoModal.row);
      load();
    } catch { setMessage("❌ ลบรูปไม่สำเร็จ"); }
  }

  const stockCost = useMemo(() => stockRows.reduce((s, r) => s + num(r.cost_amount) + num(r.extra_cost), 0), [stockRows]);
  const soldSum = useMemo(() => soldRows.reduce((s, r) => s + num(r.sold_price), 0), [soldRows]);
  const soldProfit = useMemo(() => soldRows.reduce((s, r) => s + num(r.sold_price) - num(r.cost_amount) - num(r.extra_cost), 0), [soldRows]);

  const tabBtn = (key, label) => (
    <button onClick={() => setTab(key)}
      style={{ padding: "8px 18px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700,
        background: tab === key ? "#072d6b" : "#e2e8f0", color: tab === key ? "#fff" : "#334155" }}>
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <h2 style={{ color: "#072d6b", marginTop: 0 }}>🏍️ รถมือสอง (รับซื้อ/รับเทิร์น)</h2>
      {message && (
        <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 14, background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("✅") ? "#047857" : "#b91c1c", border: `1px solid ${message.startsWith("✅") ? "#a7f3d0" : "#fecaca"}` }}>
          {message}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        {tabBtn("stock", `📦 สต๊อกมือสอง (${stockRows.length})`)}
        {tabBtn("sold", `✅ ขายแล้ว (${soldRows.length})`)}
        <input value={kw} onChange={e => setKw(e.target.value)} placeholder="🔍 ค้นหา เลขเครื่อง/ทะเบียน/รุ่น/ชื่อ" style={{ ...inp, width: 260, flex: "0 0 auto" }} />
        <button onClick={load} disabled={loading} style={{ padding: "8px 14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          {loading ? "..." : "รีเฟรช"}
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => setForm({ ...EMPTY_FORM })}
          style={{ padding: "8px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
          ＋ รับเข้ารถมือสอง
        </button>
      </div>

      {tab === "stock" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 13.5, marginBottom: 8 }}>คงเหลือ <b>{stockRows.length}</b> คัน · ทุนรวม <b style={{ color: "#b45309" }}>{fmt(stockCost)}</b> บาท</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f0f4f9" }}>
                <tr>
                  <th style={th}>#</th><th style={th}>เลขที่รับ</th><th style={th}>วันที่รับ</th><th style={th}>ที่มา</th>
                  <th style={th}>ยี่ห้อ/รุ่น</th><th style={th}>สี</th><th style={th}>เลขเครื่อง</th><th style={th}>ทะเบียน</th>
                  <th style={{ ...th, textAlign: "right" }}>ทุนรับซื้อ</th><th style={{ ...th, textAlign: "right" }}>ค่าปรับสภาพ</th>
                  <th style={th}>เจ้าของเดิม</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((r, i) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{r.doc_no}</td>
                    <td style={td}>{thaiDate(r.receive_date)}</td>
                    <td style={td}>{r.source_type}{r.ref_sale_no ? <div style={{ fontSize: 11, color: "#64748b" }}>{r.ref_sale_no}</div> : null}</td>
                    <td style={td}>{[r.brand, r.model_series, r.model_code, r.type_name].filter(Boolean).join(" ")}</td>
                    <td style={td}>{r.color_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.engine_no || "-"}</td>
                    <td style={td}>{r.license_plate || "-"}{r.province ? <div style={{ fontSize: 11, color: "#64748b" }}>{r.province}</div> : null}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.cost_amount)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{num(r.extra_cost) ? fmt(r.extra_cost) : "-"}</td>
                    <td style={td}>{r.seller_name || "-"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <button onClick={() => openPhotos(r)} title="รูปรถ (สูงสุด 4 รูป)"
                        style={{ padding: "4px 10px", background: num(r.img_count) ? "#dbeafe" : "#f3f4f6", color: "#1e40af", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                        📷{num(r.img_count) ? ` ${r.img_count}` : ""}
                      </button>{" "}
                      <button onClick={() => openSell(r)} style={{ padding: "4px 12px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>ขาย</button>{" "}
                      <button onClick={() => setForm({ ...EMPTY_FORM, ...r, cost_amount: String(r.cost_amount ?? ""), extra_cost: String(r.extra_cost ?? ""), receive_date: String(r.receive_date || "").slice(0, 10) })}
                        style={{ padding: "4px 10px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #93c5fd", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>แก้ไข</button>{" "}
                      <button onClick={() => cancelUsed(r)} style={{ padding: "4px 10px", background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>ยกเลิก</button>
                    </td>
                  </tr>
                ))}
                {!stockRows.length && <tr><td colSpan={12} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 20 }}>ไม่มีรถมือสองในสต๊อก — กด "＋ รับเข้ารถมือสอง"</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "sold" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 13.5, marginBottom: 8 }}>
            ขายแล้ว <b>{soldRows.length}</b> คัน · ยอดขายรวม <b style={{ color: "#059669" }}>{fmt(soldSum)}</b> บาท · กำไรเบื้องต้น <b style={{ color: soldProfit >= 0 ? "#059669" : "#dc2626" }}>{fmt(soldProfit)}</b> บาท
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f0f4f9" }}>
                <tr>
                  <th style={th}>#</th><th style={th}>วันที่ขาย</th><th style={th}>เลขที่รับ</th><th style={th}>ยี่ห้อ/รุ่น</th>
                  <th style={th}>เลขเครื่อง</th><th style={th}>ผู้ซื้อ</th>
                  <th style={{ ...th, textAlign: "right" }}>ทุนรวม</th><th style={{ ...th, textAlign: "right" }}>ราคาขาย</th>
                  <th style={{ ...th, textAlign: "right" }}>กำไร</th><th style={th}>วิธีรับเงิน</th><th style={th}>ผู้ขาย</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {soldRows.map((r, i) => {
                  const cost = num(r.cost_amount) + num(r.extra_cost);
                  const profit = num(r.sold_price) - cost;
                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>{thaiDate(r.sold_date)}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{r.doc_no}</td>
                      <td style={td}>{[r.brand, r.model_series].filter(Boolean).join(" ")}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{r.engine_no || "-"}</td>
                      <td style={td}>{r.sold_customer}{r.sold_customer_phone ? <div style={{ fontSize: 11, color: "#64748b" }}>{r.sold_customer_phone}</div> : null}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(cost)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(r.sold_price)}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: profit >= 0 ? "#059669" : "#dc2626" }}>{fmt(profit)}</td>
                      <td style={td}>{r.payment_method || "-"}{r.payment_note ? <div style={{ fontSize: 11, color: "#64748b" }}>{r.payment_note}</div> : null}</td>
                      <td style={td}>{r.sold_by || "-"}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <button onClick={() => openPhotos(r)} title="รูปรถ"
                          style={{ padding: "3px 9px", background: num(r.img_count) ? "#dbeafe" : "#f3f4f6", color: "#1e40af", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                          📷{num(r.img_count) ? ` ${r.img_count}` : ""}
                        </button>{" "}
                        <button onClick={() => cancelSale(r)} style={{ padding: "3px 10px", background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>ยกเลิกขาย</button>
                      </td>
                    </tr>
                  );
                })}
                {!soldRows.length && <tr><td colSpan={12} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 20 }}>ยังไม่มีรายการขาย</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== ฟอร์มรับเข้า/แก้ไข ===== */}
      {form && (
        <div onClick={() => setForm(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 720 }}>
            <h3 style={{ margin: "0 0 12px", color: "#072d6b" }}>{form.id ? `✏️ แก้ไข ${form.doc_no}` : "📥 รับเข้ารถมือสอง"}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              <Field label="วันที่รับ *"><input type="date" value={form.receive_date} onChange={e => setF({ receive_date: e.target.value })} style={inp} /></Field>
              <Field label="ที่มา *">
                <select value={form.source_type} onChange={e => setF({ source_type: e.target.value })} style={inp}>
                  <option>รับซื้อ</option><option>รับเทิร์น</option>
                </select>
              </Field>
              <Field label="ใบขายที่เทิร์น (ถ้ามี)">
                <input list="um-trade-sale" value={form.ref_sale_no}
                  onChange={e => {
                    const v = e.target.value;
                    // เลือกใบขายจากรายการ → เติมเจ้าของเดิม/เบอร์จากลูกค้าใบขายให้อัตโนมัติ (ถ้ายังว่าง)
                    const hit = (tradeSales || []).find(s => s.invoice_no === v.trim());
                    setF(hit
                      ? { ref_sale_no: v, seller_name: form.seller_name || hit.customer_name || "", seller_phone: form.seller_phone || hit.customer_phone || "" }
                      : { ref_sale_no: v });
                  }}
                  style={{ ...inp, fontFamily: "monospace" }}
                  placeholder={tradeSales === null ? "กำลังโหลดใบขาย..." : "เลือก/พิมพ์ เช่น SCY06-MCSA-..."} />
                <datalist id="um-trade-sale">
                  {(tradeSales || []).map(s => (
                    <option key={s.invoice_no} value={s.invoice_no}>
                      {`${String(s.sale_date || "").slice(0, 10)} · ${s.customer_name || ""}${s.model_code ? ` · ${s.model_code}` : ""}`}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field label="ยี่ห้อ">
                <select value={form.brand} onChange={e => setF({ brand: e.target.value, model_series: "", model_code: "", type_name: "" })} style={inp}>
                  {[...new Set([...brandOpts, "ฮอนด้า", "ยามาฮ่า", "อื่นๆ"])].map(b => <option key={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="รุ่นรถ * (เลือกจากรายการ หรือพิมพ์เอง)">
                <input list="um-series" value={form.model_series}
                  onChange={e => setF({ model_series: e.target.value, model_code: "", type_name: "" })}
                  style={inp} placeholder="เช่น PCX160, FINN" />
                <datalist id="um-series">{seriesOpts(form.brand).map(s => <option key={s} value={s} />)}</datalist>
              </Field>
              <Field label="แบบ">
                <input list="um-model" value={form.model_code}
                  onChange={e => setF({ model_code: e.target.value, type_name: "" })} style={inp} />
                <datalist id="um-model">{modelOpts(form.brand, form.model_series).map(s => <option key={s} value={s} />)}</datalist>
              </Field>
              <Field label="type">
                <input list="um-type" value={form.type_name} onChange={e => setF({ type_name: e.target.value })} style={{ ...inp, fontFamily: "monospace" }} />
                <datalist id="um-type">{typeOpts(form.brand, form.model_series, form.model_code).map(s => <option key={s} value={s} />)}</datalist>
              </Field>
              <Field label="สี"><input value={form.color_name} onChange={e => setF({ color_name: e.target.value })} style={inp} /></Field>
              <Field label="เลขเครื่อง"><input value={form.engine_no} onChange={e => setF({ engine_no: e.target.value.toUpperCase() })} style={{ ...inp, fontFamily: "monospace" }} /></Field>
              <Field label="เลขตัวถัง"><input value={form.chassis_no} onChange={e => setF({ chassis_no: e.target.value.toUpperCase() })} style={{ ...inp, fontFamily: "monospace" }} /></Field>
              <Field label="ทะเบียน"><input value={form.license_plate} onChange={e => setF({ license_plate: e.target.value })} style={inp} placeholder="เช่น 2กข 6314" /></Field>
              <Field label="จังหวัด"><input value={form.province} onChange={e => setF({ province: e.target.value })} style={inp} /></Field>
              <Field label="ปีจดทะเบียน"><input value={form.registration_year} onChange={e => setF({ registration_year: e.target.value })} style={inp} placeholder="เช่น 2565" /></Field>
              <Field label="ราคารับซื้อ/ตีเทิร์น (บาท) *"><input type="number" step="0.01" value={form.cost_amount} onChange={e => setF({ cost_amount: e.target.value })} style={{ ...inp, textAlign: "right", fontWeight: 700 }} /></Field>
              <Field label="ค่าซ่อมปรับสภาพ (บาท)"><input type="number" step="0.01" value={form.extra_cost} onChange={e => setF({ extra_cost: e.target.value })} style={{ ...inp, textAlign: "right" }} /></Field>
              <Field label="เจ้าของเดิม/ผู้ขาย"><input value={form.seller_name} onChange={e => setF({ seller_name: e.target.value })} style={inp} /></Field>
              <Field label="เบอร์โทร"><input value={form.seller_phone} onChange={e => setF({ seller_phone: e.target.value })} style={inp} /></Field>
            </div>
            <Field label="หมายเหตุ"><input value={form.note} onChange={e => setF({ note: e.target.value })} style={inp} /></Field>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={saveForm} style={{ flex: 1, padding: "10px 0", background: "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 700 }}>
                💾 {form.id ? "บันทึกการแก้ไข" : "บันทึกรับเข้า"}
              </button>
              <button onClick={() => setForm(null)} style={{ flex: 1, padding: "10px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15 }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== modal ขาย ===== */}
      {sellModal && (
        <div onClick={() => !sellModal.saving && setSellModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 560 }}>
            <h3 style={{ margin: "0 0 8px", color: "#047857" }}>💵 ขายรถมือสอง — {sellModal.row.doc_no}</h3>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 12px", fontSize: 13.5, marginBottom: 12 }}>
              {[sellModal.row.brand, sellModal.row.model_series, sellModal.row.color_name].filter(Boolean).join(" · ")} · เครื่อง <b style={{ fontFamily: "monospace" }}>{sellModal.row.engine_no || "-"}</b>
              {" "}· ทุนรวม <b>{fmt(num(sellModal.row.cost_amount) + num(sellModal.row.extra_cost))}</b>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="วันที่ขาย *"><input type="date" value={sellModal.sold_date} onChange={e => setSellModal(m => ({ ...m, sold_date: e.target.value }))} style={inp} /></Field>
              <Field label="ราคาขาย (บาท) *">
                <input type="number" step="0.01" value={sellModal.price} onChange={e => changeSellPrice(e.target.value)} style={{ ...inp, textAlign: "right", fontWeight: 800, fontSize: 16, border: "2px solid #059669" }} />
              </Field>
            </div>
            <Field label="ผู้ซื้อ * (กดค้นหา หรือพิมพ์เอง)">
              <div style={{ display: "flex", gap: 6 }}>
                <input value={sellModal.customer} onChange={e => setSellModal(m => ({ ...m, customer: e.target.value }))} style={{ ...inp, flex: 1 }} />
                <button onClick={() => { setCustPop(true); setCustKw(sellModal.customer); setCustResults(null); }}
                  style={{ border: "1px solid #1d4ed8", background: "#eff6ff", color: "#1d4ed8", borderRadius: 7, padding: "0 12px", cursor: "pointer", fontSize: 15, flex: "0 0 auto" }}>🔍</button>
              </div>
            </Field>
            <Field label="เบอร์โทรผู้ซื้อ"><input value={sellModal.phone} onChange={e => setSellModal(m => ({ ...m, phone: e.target.value }))} style={inp} /></Field>

            <div style={{ fontSize: 13, fontWeight: 600, margin: "8px 0 6px" }}>วิธีรับชำระ * (เพิ่มได้หลายวิธี)</div>
            {sellModal.rows.map((r3, i3) => (
              <div key={i3} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", marginBottom: 6, background: "#f9fafb" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select value={r3.method} onChange={e => setSellRow(i3, { method: e.target.value, account: "" })} style={{ ...inp, width: 110, flex: "0 0 auto" }}>
                    {PAY_METHODS.map(m2 => <option key={m2} value={m2}>{m2}</option>)}
                  </select>
                  <input type="number" step="0.01" placeholder="ยอด (บาท)" value={r3.amount}
                    onChange={e => setSellRow(i3, { amount: e.target.value })}
                    style={{ ...inp, flex: 1, textAlign: "right", fontWeight: 700 }} />
                  {sellModal.rows.length > 1 && (
                    <button onClick={() => setSellModal(m => ({ ...m, rows: m.rows.filter((_, j) => j !== i3) }))}
                      style={{ border: "none", background: "#fee2e2", color: "#b91c1c", borderRadius: 6, width: 28, height: 28, cursor: "pointer", flex: "0 0 auto" }}>✕</button>
                  )}
                </div>
                {r3.method === "เงินโอน" && (
                  <select value={r3.account} onChange={e => setSellRow(i3, { account: e.target.value })}
                    style={{ ...inp, marginTop: 6, background: r3.account ? "#fff" : "#fffbeb" }}>
                    <option value="">— เลือกบัญชีรับโอน —</option>
                    {bankAccounts.map(a => <option key={a.id || bankLabelOf(a)} value={bankLabelOf(a)}>{bankLabelOf(a)}</option>)}
                  </select>
                )}
              </div>
            ))}
            <button onClick={() => setSellModal(m => ({ ...m, rows: [...m.rows, { method: "เงินโอน", amount: Math.max(0, Math.round((num(m.price) - sellTotal(m)) * 100) / 100) || "", account: "" }] }))}
              style={{ border: "1px dashed #059669", background: "#f0fdf4", color: "#047857", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>
              ＋ เพิ่มวิธีรับชำระ
            </button>
            <span style={{ marginLeft: 12, fontSize: 14 }}>
              รวมรับ: <b style={{ color: num(sellModal.price) > 0 && Math.abs(sellTotal(sellModal) - num(sellModal.price)) < 0.01 ? "#059669" : "#b45309" }}>{fmt(sellTotal(sellModal))}</b>
              {num(sellModal.price) > 0 && <> / ราคาขาย {fmt(sellModal.price)}</>}
            </span>
            <div style={{ marginTop: 10 }}>
              <Field label="หมายเหตุ"><input value={sellModal.note} onChange={e => setSellModal(m => ({ ...m, note: e.target.value }))} style={inp} placeholder="เช่น เลขอ้างอิงโอน" /></Field>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={saveSell} disabled={sellModal.saving}
                style={{ flex: 1, padding: "10px 0", background: sellModal.saving ? "#93c5fd" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 700 }}>
                {sellModal.saving ? "กำลังบันทึก..." : "✓ บันทึกขาย"}
              </button>
              <button onClick={() => setSellModal(null)} disabled={sellModal.saving}
                style={{ flex: 1, padding: "10px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15 }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== modal รูปรถ (4 ช่อง) ===== */}
      {photoModal && (
        <div onClick={() => setPhotoModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: 18, width: "100%", maxWidth: 640 }}>
            <h3 style={{ margin: "0 0 4px", color: "#072d6b" }}>📷 รูปรถ — {photoModal.row.doc_no}</h3>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
              {[photoModal.row.brand, photoModal.row.model_series, photoModal.row.color_name].filter(Boolean).join(" · ")} · สูงสุด 4 รูป (กดช่องว่างเพื่อเพิ่ม / กดรูปเพื่อดูใหญ่)
            </div>
            {photoModal.images === null ? (
              <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>กำลังโหลดรูป...</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[1, 2, 3, 4].map(slot => {
                  const img = (photoModal.images || []).find(x => Number(x.slot) === slot);
                  const busy = photoModal.uploading === slot;
                  return (
                    <div key={slot} style={{ border: "1px dashed #cbd5e1", borderRadius: 10, height: 170, position: "relative", overflow: "hidden", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {img ? (
                        <>
                          <img src={img.image_data} alt={`รูป ${slot}`} onClick={() => setPhotoView(img.image_data)}
                            style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }} />
                          <button onClick={() => deletePhoto(img)}
                            style={{ position: "absolute", top: 6, right: 6, background: "rgba(220,38,38,0.9)", color: "#fff", border: "none", borderRadius: 6, width: 26, height: 26, cursor: "pointer" }}>✕</button>
                          <label style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(29,78,216,0.9)", color: "#fff", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>
                            เปลี่ยน<input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { uploadPhoto(slot, e.target.files?.[0]); e.target.value = ""; }} />
                          </label>
                        </>
                      ) : (
                        <label style={{ cursor: "pointer", textAlign: "center", color: "#64748b", fontSize: 13, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          {busy ? "กำลังอัปโหลด..." : <><span style={{ fontSize: 26 }}>＋</span>เพิ่มรูปที่ {slot}</>}
                          <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={busy}
                            onChange={e => { uploadPhoto(slot, e.target.files?.[0]); e.target.value = ""; }} />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => setPhotoModal(null)}
              style={{ marginTop: 14, width: "100%", padding: "9px 0", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>ปิด</button>
          </div>
        </div>
      )}

      {/* ดูรูปใหญ่ */}
      {photoView && (
        <div onClick={() => setPhotoView(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <img src={photoView} alt="รูปรถ" style={{ maxWidth: "95%", maxHeight: "92%", borderRadius: 10 }} />
        </div>
      )}

      {/* ===== popup ค้นหาลูกค้า ===== */}
      {custPop && (
        <div onClick={() => setCustPop(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: 18, width: "100%", maxWidth: 520, maxHeight: "80vh", overflow: "auto" }}>
            <h3 style={{ margin: "0 0 10px", color: "#072d6b" }}>🔍 ค้นหาลูกค้า</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={custKw} onChange={e => setCustKw(e.target.value)} autoFocus
                onKeyDown={e => e.key === "Enter" && searchCustomers()}
                style={{ ...inp, flex: 1 }} placeholder="ชื่อ / เบอร์โทร / รหัสลูกค้า" />
              <button onClick={searchCustomers} disabled={custSearching}
                style={{ padding: "8px 16px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, flex: "0 0 auto" }}>
                {custSearching ? "..." : "ค้นหา"}
              </button>
            </div>
            {custResults === null ? (
              <div style={{ fontSize: 13, color: "#94a3b8" }}>พิมพ์คำค้นแล้วกด Enter</div>
            ) : !custResults.length ? (
              <div style={{ fontSize: 13.5, color: "#b45309" }}>ไม่พบลูกค้า — ปิดแล้วพิมพ์ชื่อเองได้เลย</div>
            ) : (
              custResults.map((c, i) => (
                <div key={i} onClick={() => { setSellModal(m => m ? { ...m, customer: String(c.customer_name || "").trim(), phone: String(c.customer_phone || "").trim() } : m); setCustPop(false); }}
                  style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 6, cursor: "pointer", background: "#f9fafb" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.customer_name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{[c.customer_phone, c.customer_code].filter(Boolean).join(" · ")}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
