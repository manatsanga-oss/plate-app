import React, { useEffect, useState } from "react";

// บันทึกรับใบกำกับฯ ประกันรถหาย (ออกแทน)
// ดึงค่าใช้จ่ายรหัส 52071 (ค่าประกันรถหาย-ออกแทน) เฉพาะ vendor ที่มีชื่อ (ตัด "ไม่ระบุผู้จำหน่าย" ออก)
// = บริษัทประกันที่ออกใบกำกับภาษี เช่น เอสจีเอฟ แคปปิตอล, วิริยะประกันภัย
// จากตาราง flow_expense_documents (action list_theft_insurance — bypass exclusion ของ FLOW ACC)
const FLOW_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/upload-accounting-expense";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const AFFILIATIONS = ["ป.เปา", "สิงห์ชัย"];

// สังกัด (flow_expense_documents) → สาขาในรายงานสรุปใบปะหน้า (list_registration_summary)
const AFF_BRANCHES = { "ป.เปา": ["PAPAO", "NAKORNLUANG"], "สิงห์ชัย": ["SINGCHAI"] };
const BRANCH_LABEL = {
  PAPAO: { label: "ป.เปา", bg: "#dbeafe", color: "#1e40af" },
  NAKORNLUANG: { label: "นครหลวง", bg: "#fef3c7", color: "#92400e" },
  SINGCHAI: { label: "สิงห์ชัย", bg: "#fce7f3", color: "#9d174d" },
};

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
// normalize ชื่อบริษัทเพื่อจับคู่ vendor ↔ ไฟแนนท์ (ตัด คำนำหน้า/รูปแบบนิติบุคคล/ช่องว่าง)
function normName(s) {
  return String(s || "")
    .replace(/บริษัท|ห้างหุ้นส่วนจำกัด|ห้างหุ้นส่วน|หจก\.?|จำกัด|\(มหาชน\)|มหาชน|\s/g, "")
    .toLowerCase();
}
// แปลงแถวจาก DB → shape ที่ใช้ในหน้า (ตัวเลขเป็น number)
function normalizeReceipt(r) {
  return {
    branch: r.branch, sale_invoice_no: r.sale_invoice_no, sale_tax_invoice_no: r.sale_tax_invoice_no,
    chassis_no: r.chassis_no, engine_no: r.engine_no, model_name: r.model_name,
    customer_name: r.customer_name, finance_company: r.finance_company,
    credit_note_amount: Number(r.credit_note_amount || 0),
    tax_invoice_no: r.tax_invoice_no, tax_invoice_date: r.tax_invoice_date ? String(r.tax_invoice_date).slice(0, 10) : "",
    subtotal: Number(r.subtotal || 0),
    vat_pct: Number(r.vat_pct || 0), vat_amount: Number(r.vat_amount || 0), total: Number(r.total || 0),
  };
}
function statusBadge(s, row) {
  const map = {
    draft: { t: "ร่าง", c: "#92400e", bg: "#fef3c7" },
    paid: { t: "ชำระแล้ว", c: "#166534", bg: "#dcfce7" },
    cancelled: { t: "ยกเลิก", c: "#991b1b", bg: "#fee2e2" },
    partial: { t: "รับบางส่วน", c: "#9a3412", bg: "#ffedd5" },
    received: { t: "รับครบ", c: "#1e40af", bg: "#dbeafe" },
  };
  let key = s || "draft";
  // สถานะรับใบกำกับฯ คิดจากยอดที่บันทึกรับ (received_total) เทียบยอดเอกสาร — เฉพาะเอกสารที่ยังไม่ชำระ/ยกเลิก
  if (row && key !== "paid" && key !== "cancelled") {
    const recv = Number(row.received_total || 0);
    const total = Number(row.total || 0);
    if (recv > 0) key = recv >= total - 0.01 ? "received" : "partial";
  }
  const m = map[key] || map.draft;
  const recv = row ? Number(row.received_total || 0) : 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: m.c, background: m.bg, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}
      title={key === "partial" ? `รับแล้ว ${fmt(recv)} / ${fmt(row?.total)} บาท` : key === "received" ? `รับครบ ${fmt(recv)} บาท` : undefined}>
      {m.t}{key === "partial" && <span style={{ fontWeight: 400 }}> ({fmt(recv)})</span>}
    </span>
  );
}

export default function TheftInsuranceInvoicePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterAff, setFilterAff] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("docs");              // docs | history
  // ประวัติการบันทึก (ทุกแถวใน theft_insurance_invoice_receipts)
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [histEdit, setHistEdit] = useState(null);      // แถวที่กำลังแก้ไข
  const [histMsg, setHistMsg] = useState("");
  // popup: รถที่ขายที่มีประกันรถหายออกแทน
  const [popupDoc, setPopupDoc] = useState(null);      // เอกสารที่กดเลือก
  const [theftCars, setTheftCars] = useState(null);    // cache รถทั้งหมดที่มี ประกันรถหายออกแทน > 0 (ทุกสาขา/ทุกเวลา)
  const [carsLoading, setCarsLoading] = useState(false);
  // รายการรับใบกำกับฯ (ต่อคัน) ของเอกสารที่เปิดอยู่
  const [receipts, setReceipts] = useState([]);        // [{ sale_invoice_no, ..., tax_invoice_no, subtotal, vat_pct, vat_amount, total }]
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [savingReceipts, setSavingReceipts] = useState(false);
  const [carForm, setCarForm] = useState(null);        // ฟอร์มกรอกใบกำกับภาษีของคันที่เลือก
  const [popupMsg, setPopupMsg] = useState("");
  const [popupSearch, setPopupSearch] = useState("");  // ค้นหารถใน popup

  useEffect(() => {
    const now = new Date();
    setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => { if (dateFrom && dateTo && tab === "docs") fetchRows(); /* eslint-disable-next-line */ }, [dateFrom, dateTo, filterAff, tab]);
  useEffect(() => { if (dateFrom && dateTo && tab === "history") fetchHistory(); /* eslint-disable-next-line */ }, [dateFrom, dateTo, filterAff, tab]);

  async function fetchRows() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(FLOW_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_theft_insurance",
          date_from: dateFrom, date_to: dateTo,
          affiliation: filterAff || undefined,
          // ไม่ส่ง vendor_names → ดึงทุก vendor ที่มีชื่อ (default ตัด "ไม่ระบุผู้จำหน่าย")
        }),
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data.filter(r => r && (r.expense_doc_no || r.id)) : []);
    } catch (e) {
      setRows([]); setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + e.message);
    }
    setLoading(false);
  }

  // ===== ประวัติการบันทึก =====
  async function fetchHistory() {
    setHistoryLoading(true); setHistMsg("");
    try {
      const res = await fetch(FLOW_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "theft_history", date_from: dateFrom, date_to: dateTo,
          affiliation: filterAff || undefined, search: search.trim() || undefined,
        }),
      });
      const data = await res.json();
      setHistory((Array.isArray(data) ? data : (data?.rows || [])).filter(r => r && r.id));
    } catch (e) {
      setHistory([]); setHistMsg("❌ โหลดประวัติไม่สำเร็จ: " + e.message);
    }
    setHistoryLoading(false);
  }
  // เปิดฟอร์มแก้ไขแถวประวัติ (net-based เหมือนฟอร์มกรอก)
  function openHistEdit(r) {
    setHistEdit({
      id: r.id, flow_doc_no: r.flow_doc_no, sale_invoice_no: r.sale_invoice_no,
      customer_name: r.customer_name, model_name: r.model_name,
      tax_invoice_no: r.tax_invoice_no || "",
      tax_invoice_date: r.tax_invoice_date ? String(r.tax_invoice_date).slice(0, 10) : "",
      netStr: String(Number(r.total || 0)), vatPctStr: String(Number(r.vat_pct || 7)),
    });
    setHistMsg("");
  }
  async function saveHistEdit() {
    if (!histEdit) return;
    if (!histEdit.tax_invoice_no.trim()) { setHistMsg("⚠️ กรอกเลขที่ใบกำกับภาษีก่อน"); return; }
    const total = Number(histEdit.netStr) || 0;
    const vatPct = Number(histEdit.vatPctStr) || 0;
    const subtotal = Math.round((total / (1 + vatPct / 100)) * 100) / 100;
    const vat_amount = Math.round((total - subtotal) * 100) / 100;
    try {
      const res = await fetch(FLOW_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "theft_update_receipt", id: histEdit.id,
          tax_invoice_no: histEdit.tax_invoice_no.trim(), tax_invoice_date: histEdit.tax_invoice_date || null,
          subtotal, vat_pct: vatPct, vat_amount, total,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = Array.isArray(data) ? data[0] : data;
      if (ok?.error) throw new Error(ok.error);
      setHistEdit(null); setHistMsg("✅ แก้ไขแล้ว"); fetchHistory();
    } catch (e) { setHistMsg("❌ แก้ไขล้มเหลว: " + e.message); }
  }
  async function deleteHistRow(r) {
    if (!window.confirm(`ยกเลิก/ลบรายการรับใบกำกับฯ\nใบขาย ${r.sale_invoice_no} · เลขที่ใบกำกับ ${r.tax_invoice_no || "-"} ?`)) return;
    try {
      const res = await fetch(FLOW_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "theft_delete_receipt", id: r.id }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = Array.isArray(data) ? data[0] : data;
      if (ok?.error) throw new Error(ok.error);
      setHistMsg("✅ ยกเลิกรายการแล้ว"); fetchHistory();
    } catch (e) { setHistMsg("❌ ยกเลิกล้มเหลว: " + e.message); }
  }

  // โหลดรถที่มีประกันรถหายออกแทน (credit_note_total > 0) ทั้งหมด — cache ไว้ใช้ทุก popup
  async function ensureTheftCars() {
    if (theftCars !== null) return theftCars;
    setCarsLoading(true);
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_registration_summary", date_from: "", date_to: "" }),
      });
      const data = await res.json();
      const arr = (Array.isArray(data) ? data : (data?.rows || []))
        .filter(r => Number(r.credit_note_total) > 0);
      setTheftCars(arr);
      setCarsLoading(false);
      return arr;
    } catch {
      setTheftCars([]); setCarsLoading(false); return [];
    }
  }

  function openPopup(doc) {
    setPopupDoc(doc);
    setCarForm(null);
    setPopupMsg("");
    setPopupSearch("");
    ensureTheftCars();
    loadReceipts(doc);
  }
  function closePopup() {
    setPopupDoc(null); setCarForm(null); setReceipts([]); setPopupMsg(""); setPopupSearch("");
  }

  // โหลดรายการที่บันทึกไว้แล้วของเอกสารนี้
  async function loadReceipts(doc) {
    if (!doc?.id) { setReceipts([]); return; }
    setReceiptsLoading(true);
    try {
      const res = await fetch(FLOW_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "theft_list_receipts", flow_doc_id: doc.id }),
      });
      const data = await res.json();
      const arr = (Array.isArray(data) ? data : (data?.rows || [])).filter(r => r && r.sale_invoice_no);
      setReceipts(arr.map(normalizeReceipt));
    } catch { setReceipts([]); }
    setReceiptsLoading(false);
  }

  // เปิดฟอร์มกรอกใบกำกับภาษีของคันที่เลือก (prefill จากที่บันทึกไว้ถ้ามี)
  // ช่องที่กรอก = "ยอดสุทธิ (รวม VAT)" = ประกันรถหายออกแทน → ถอด VAT ย้อนเป็น มูลค่า+VAT
  function openCarForm(car) {
    const exist = receipts.find(r => r.sale_invoice_no === car.sale_invoice_no);
    const net = exist ? Number(exist.total) : Number(car.credit_note_total || 0);
    const vatPct = exist ? Number(exist.vat_pct) : 7;
    setCarForm({
      branch: car.branch,
      sale_invoice_no: car.sale_invoice_no,
      sale_tax_invoice_no: car.tax_invoice_no || "",
      chassis_no: car.chassis_no, engine_no: car.engine_no, model_name: car.model_name,
      customer_name: car.sale_customer_name || car.customer_name,
      finance_company: car.sale_finance_company,
      credit_note_amount: Number(car.credit_note_total || 0),
      tax_invoice_no: exist ? exist.tax_invoice_no : "",
      tax_invoice_date: exist ? (exist.tax_invoice_date || "") : (popupDoc?.doc_date ? String(popupDoc.doc_date).slice(0, 10) : ""),
      netStr: net ? String(net) : "",
      vatPctStr: String(vatPct),
    });
  }

  // เพิ่ม/แก้ไขรายการ (upsert by sale_invoice_no) → แสดงด้านล่าง (ยังไม่เข้า DB จนกดบันทึกรับเอกสาร)
  function addCarReceipt() {
    if (!carForm) return;
    if (!carForm.tax_invoice_no.trim()) { setPopupMsg("⚠️ กรอกเลขที่ใบกำกับภาษีก่อน"); return; }
    const total = Number(carForm.netStr) || 0;                       // ยอดสุทธิ (รวม VAT) = ที่กรอก
    const vatPct = Number(carForm.vatPctStr) || 0;
    const subtotal = Math.round((total / (1 + vatPct / 100)) * 100) / 100;  // ถอด VAT → มูลค่า
    const vat_amount = Math.round((total - subtotal) * 100) / 100;          // ภาษี
    const rec = {
      branch: carForm.branch, sale_invoice_no: carForm.sale_invoice_no,
      sale_tax_invoice_no: carForm.sale_tax_invoice_no,
      chassis_no: carForm.chassis_no, engine_no: carForm.engine_no, model_name: carForm.model_name,
      customer_name: carForm.customer_name, finance_company: carForm.finance_company,
      credit_note_amount: carForm.credit_note_amount,
      tax_invoice_no: carForm.tax_invoice_no.trim(),
      tax_invoice_date: carForm.tax_invoice_date || null,
      subtotal, vat_pct: vatPct, vat_amount, total,
    };
    setReceipts(prev => {
      const i = prev.findIndex(r => r.sale_invoice_no === rec.sale_invoice_no);
      if (i >= 0) { const cp = [...prev]; cp[i] = rec; return cp; }
      return [...prev, rec];
    });
    setCarForm(null); setPopupMsg("");
  }
  function removeReceipt(saleNo) {
    setReceipts(prev => prev.filter(r => r.sale_invoice_no !== saleNo));
  }

  // บันทึกรับเอกสารเข้า DB (replace-all ของเอกสารนี้)
  async function commitReceipts() {
    if (!popupDoc?.id) return;
    setSavingReceipts(true); setPopupMsg("");
    try {
      const res = await fetch(FLOW_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "theft_save_receipts",
          flow_doc_id: popupDoc.id, flow_doc_no: popupDoc.expense_doc_no,
          affiliation: popupDoc.affiliation, vendor_name: popupDoc.vendor_name,
          records: receipts, created_by: "system",
        }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = Array.isArray(data) ? data[0] : data;
      if (ok?.error) throw new Error(ok.error);
      setPopupMsg(`✅ บันทึกรับเอกสารเข้า DB แล้ว ${receipts.length} รายการ`);
      await loadReceipts(popupDoc);
      fetchRows();  // refresh สถานะรับบางส่วน/รับครบ ในตารางเอกสาร
    } catch (e) {
      setPopupMsg("❌ บันทึกล้มเหลว: " + e.message);
    }
    setSavingReceipts(false);
  }

  // รถใน popup = ประกันรถหายออกแทน > 0 + เฉพาะสาขาที่ตรงกับสังกัดของเอกสาร (ทุกช่วงเวลา)
  // แล้วจับคู่ vendor ของเอกสาร = ไฟแนนท์ (sale_finance_company) ของรถ
  // ถ้า vendor นั้นไม่มีรถไหนใช้เป็นไฟแนนท์ (เช่น วิริยะ = บริษัทประกัน ไม่ใช่ไฟแนนท์) → แสดงทั้งหมดในสาขา
  const popupCalc = (() => {
    if (!popupDoc || theftCars === null) return { cars: [], vendorMatched: false, branchCount: 0 };
    const branches = AFF_BRANCHES[popupDoc.affiliation] || null; // null = ไม่จำกัด
    const inBranch = theftCars.filter(r => !branches || branches.includes(r.branch));
    const vNorm = normName(popupDoc.vendor_name);
    const matched = vNorm.length >= 3
      ? inBranch.filter(r => {
          const fNorm = normName(r.sale_finance_company);
          return fNorm.length >= 3 && (fNorm.includes(vNorm) || vNorm.includes(fNorm));
        })
      : [];
    return matched.length > 0
      ? { cars: matched, vendorMatched: true, branchCount: inBranch.length }
      : { cars: inBranch, vendorMatched: false, branchCount: inBranch.length };
  })();
  const pq = popupSearch.trim().toLowerCase();
  const popupCars = pq
    ? popupCalc.cars.filter(r => [r.sale_customer_name, r.customer_name, r.tax_invoice_no, r.chassis_no, r.engine_no, r.model_name, r.sale_invoice_no]
        .some(v => String(v || "").toLowerCase().includes(pq)))
    : popupCalc.cars;
  const popupCarsTotal = popupCars.reduce((s, r) => s + Number(r.credit_note_total || 0), 0);

  // ยอดรวมของรายการที่บันทึก เทียบกับเอกสารค่าใช้จ่าย
  const recSubtotal = receipts.reduce((s, r) => s + Number(r.subtotal || 0), 0);
  const recVat = receipts.reduce((s, r) => s + Number(r.vat_amount || 0), 0);
  const recNet = receipts.reduce((s, r) => s + Number(r.total || 0), 0);
  const docTotal = Number(popupDoc?.total || 0);
  const netDiff = Math.round((recNet - docTotal) * 100) / 100;
  const netMatched = receipts.length > 0 && Math.abs(netDiff) < 0.01;
  const enteredSaleNos = new Set(receipts.map(r => r.sale_invoice_no));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter(r => [r.expense_doc_no, r.vendor_name, r.reference_no, r.expense_type, r.description]
        .some(v => String(v || "").toLowerCase().includes(q)))
    : rows;

  const sumSub = filtered.reduce((s, r) => s + Number(r.subtotal || 0), 0);
  const sumVat = filtered.reduce((s, r) => s + Number(r.vat_amount || 0), 0);
  const sumTotal = filtered.reduce((s, r) => s + Number(r.total || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📑 บันทึกรับใบกำกับฯ ประกันรถหาย (ออกแทน)</h2>
      </div>

      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
        แสดงเฉพาะรายการรหัส <code style={{ padding: "1px 6px", background: "#eef2ff", borderRadius: 4, color: "#3730a3", fontWeight: 600 }}>52071 / ค่าประกันรถหาย-ออกแทน</code>
        {" "}ของบริษัทประกันที่ออกใบกำกับภาษี (เช่น เอสจีเอฟ แคปปิตอล, วิริยะประกันภัย — ตัด "ไม่ระบุผู้จำหน่าย" ออก) จาก FLOW ACC
        {" "}· 👉 <b>กดที่แถวเอกสาร</b> เพื่อดูรถที่ขายที่มีค่าประกันรถหายออกแทน
      </div>

      {/* แท็บ */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: "2px solid #e5e7eb" }}>
        {[["docs", "📑 รายการเอกสาร"], ["history", "🕘 ประวัติการบันทึก"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "8px 16px",
              color: tab === k ? "#1e3a8a" : "#9ca3af", borderBottom: tab === k ? "3px solid #1e3a8a" : "3px solid transparent", marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ตัวกรอง */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label style={lbl}>วันที่:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span style={{ color: "#6b7280" }}>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <select value={filterAff} onChange={e => setFilterAff(e.target.value)} style={inp}>
          <option value="">🏢 สังกัด: ทั้งหมด</option>
          {AFFILIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="text" placeholder="🔍 ค้นหา (เลขเอกสาร / ใบกำกับ / ลูกค้า)" value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && tab === "history") fetchHistory(); }}
          style={{ ...inp, minWidth: 240 }} />
        <button onClick={() => tab === "docs" ? fetchRows() : fetchHistory()} disabled={loading || historyLoading}
          style={{ ...btn, background: (loading || historyLoading) ? "#9ca3af" : "#2563eb" }}>
          {(loading || historyLoading) ? "⏳ โหลด..." : "🔄 รีเฟรช"}
        </button>
      </div>

      {message && tab === "docs" && <div style={{ fontSize: 13, color: "#b91c1c", marginBottom: 10 }}>{message}</div>}
      {histMsg && tab === "history" && <div style={{ fontSize: 13, marginBottom: 10, fontWeight: 600, color: histMsg.startsWith("✅") ? "#166534" : histMsg.startsWith("❌") ? "#b91c1c" : "#b45309" }}>{histMsg}</div>}

      {tab === "docs" && (<>
      {/* สรุป */}
      <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
        <span>📑 เอกสาร: <b>{filtered.length}</b></span>
        <span>มูลค่า: <b>{fmt(sumSub)}</b></span>
        <span>VAT: <b>{fmt(sumVat)}</b></span>
        <span>💰 ยอดรวม: <b style={{ color: "#b91c1c" }}>{fmt(sumTotal)}</b> บาท</span>
      </div>

      {/* ตาราง */}
      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th>เลขเอกสาร</th><th>วันที่</th><th>สังกัด</th><th>Vendor</th>
              <th>เลขที่อ้างอิง</th><th>ประเภทค่าใช้จ่าย</th>
              <th style={{ textAlign: "right" }}>มูลค่า</th>
              <th style={{ textAlign: "right" }}>VAT</th>
              <th style={{ textAlign: "right" }}>ยอดรวม</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: "center", color: "#9ca3af", padding: 24 }}>
                {loading ? "กำลังโหลด..." : "— ไม่พบรายการ —"}
              </td></tr>
            ) : filtered.map(r => (
              <tr key={r.id || r.expense_doc_no} onClick={() => openPopup(r)}
                style={{ cursor: "pointer" }} title="กดเพื่อดูรถที่ขายที่มีค่าประกันรถหายออกแทน">
                <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#991b1b", textDecoration: "underline" }}>{r.expense_doc_no}</td>
                <td>{fmtDate(r.doc_date)}</td>
                <td>{r.affiliation || "-"}</td>
                <td style={{ maxWidth: 220 }}>{r.vendor_name || "-"}</td>
                <td>{r.reference_no || "-"}</td>
                <td style={{ fontSize: 11, color: "#6b7280" }}>{r.expense_type || "-"}</td>
                <td style={{ textAlign: "right" }}>{fmt(r.subtotal)}</td>
                <td style={{ textAlign: "right" }}>{r.vat_amount ? fmt(r.vat_amount) : "-"}</td>
                <td style={{ textAlign: "right", fontWeight: 600, color: "#166534" }}>{fmt(r.total)}</td>
                <td>{statusBadge(r.status, r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>)}

      {tab === "history" && (<>
      {/* สรุปประวัติ */}
      <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
        <span>🧾 รายการ: <b>{history.length}</b></span>
        <span>มูลค่า: <b>{fmt(history.reduce((s, r) => s + Number(r.subtotal || 0), 0))}</b></span>
        <span>VAT: <b>{fmt(history.reduce((s, r) => s + Number(r.vat_amount || 0), 0))}</b></span>
        <span>💰 สุทธิรวม: <b style={{ color: "#166534" }}>{fmt(history.reduce((s, r) => s + Number(r.total || 0), 0))}</b> บาท</span>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>(กรองช่วงวันที่ตามวันที่ใบกำกับ)</span>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th>เอกสารค่าใช้จ่าย</th><th>สังกัด</th><th>Vendor</th><th>ใบขาย</th><th>ลูกค้า</th><th>รุ่น</th>
              <th>เลขที่ใบกำกับภาษี</th><th>วันที่ใบกำกับ</th>
              <th style={{ textAlign: "right" }}>มูลค่า</th><th style={{ textAlign: "right" }}>VAT</th><th style={{ textAlign: "right" }}>สุทธิ</th>
              <th style={{ textAlign: "center" }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: "center", color: "#9ca3af", padding: 24 }}>
                {historyLoading ? "กำลังโหลด..." : "— ยังไม่มีประวัติการบันทึก —"}
              </td></tr>
            ) : history.map(r => (
              <tr key={r.id}>
                <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#991b1b" }}>{r.flow_doc_no}</td>
                <td>{r.affiliation || "-"}</td>
                <td style={{ maxWidth: 160, fontSize: 11 }}>{r.vendor_name || "-"}</td>
                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.sale_invoice_no || "-"}</td>
                <td>{r.customer_name || "-"}</td>
                <td style={{ fontSize: 11 }}>{r.model_name || "-"}</td>
                <td style={{ fontFamily: "monospace", fontWeight: 700, color: "#1e3a8a" }}>{r.tax_invoice_no || "-"}</td>
                <td>{fmtDate(r.tax_invoice_date)}</td>
                <td style={{ textAlign: "right" }}>{fmt(r.subtotal)}</td>
                <td style={{ textAlign: "right" }}>{fmt(r.vat_amount)}</td>
                <td style={{ textAlign: "right", fontWeight: 600, color: "#166534" }}>{fmt(r.total)}</td>
                <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                  <button onClick={() => openHistEdit(r)}
                    style={{ border: "none", background: "#dbeafe", color: "#1e40af", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, marginRight: 4 }}>✏️ แก้ไข</button>
                  <button onClick={() => deleteHistRow(r)}
                    style={{ border: "none", background: "#fee2e2", color: "#b91c1c", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>🚫 ยกเลิก</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>)}

      {/* POPUP: รถที่ขายที่มีค่าประกันรถหายออกแทน (เฉพาะสาขาตามสังกัดของเอกสาร) */}
      {popupDoc && (
        <div onClick={closePopup}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, width: "min(1100px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            {/* header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#a16207" }}>🚗 รถที่ขายที่มีค่าประกันรถหายออกแทน</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  เอกสาร <b style={{ fontFamily: "monospace", color: "#991b1b" }}>{popupDoc.expense_doc_no}</b>
                  {" · "}{popupDoc.vendor_name}
                  {" · สังกัด "}<b>{popupDoc.affiliation || "-"}</b>
                  {" · ยอดใบกำกับ "}<b>{fmt(popupDoc.total)}</b> บาท
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                  สาขา {(AFF_BRANCHES[popupDoc.affiliation] || []).map(b => BRANCH_LABEL[b]?.label || b).join(" / ") || "ทุกสาขา"} · ทุกช่วงเวลา · ประกันรถหายออกแทน &gt; 0
                  {popupCalc.vendorMatched ? (
                    <span style={{ marginLeft: 6, color: "#166534", fontWeight: 600 }}>✓ จับคู่ไฟแนนท์ = {popupDoc.vendor_name}</span>
                  ) : (
                    <span style={{ marginLeft: 6, color: "#b45309", fontWeight: 600 }}>⚠ ไม่มีรถที่ใช้ {popupDoc.vendor_name} เป็นไฟแนนท์ → แสดงทั้งหมดในสาขา</span>
                  )}
                </div>
              </div>
              <button onClick={closePopup}
                style={{ border: "none", background: "#f3f4f6", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#374151" }}>✕</button>
            </div>

            {/* body */}
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>👉 กดที่แถวรถเพื่อกรอกเลขที่ใบกำกับภาษีที่รับ</div>
                <input type="text" placeholder="🔍 ค้นหา (ลูกค้า / ใบกำกับ / เลขถัง / รุ่น / ใบขาย)" value={popupSearch}
                  onChange={e => setPopupSearch(e.target.value)}
                  style={{ ...inp, minWidth: 280 }} />
              </div>
              {carsLoading ? (
                <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>กำลังโหลดข้อมูลรถ...</div>
              ) : popupCars.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
                  {pq ? "— ไม่พบรถที่ตรงกับคำค้นหา —" : "— ไม่พบรถที่มีค่าประกันรถหายออกแทนในสาขานี้ —"}
                </div>
              ) : (
                <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#072d6b", color: "#fff" }}>
                        <th style={pth}>#</th><th style={pth}>สาขา</th><th style={pth}>เลขที่ใบกำกับ</th>
                        <th style={pth}>ลูกค้า / ไฟแนนท์</th><th style={pth}>เลขถัง</th><th style={pth}>รุ่น</th><th style={pth}>ใบขาย</th>
                        <th style={{ ...pth, textAlign: "right" }}>ประกันรถหายออกแทน</th>
                        <th style={{ ...pth, textAlign: "center" }}>รับใบกำกับฯ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {popupCars.map((r, i) => {
                        const b = BRANCH_LABEL[r.branch] || { label: r.branch || "-", bg: "#e5e7eb", color: "#374151" };
                        const entered = enteredSaleNos.has(r.sale_invoice_no);
                        return (
                          <tr key={`${r.branch}|${r.tax_invoice_no}|${i}`} onClick={() => openCarForm(r)}
                            style={{ background: entered ? "#f0fdf4" : i % 2 ? "#f9fafb" : "#fff", cursor: "pointer" }}
                            title="กดเพื่อกรอกเลขที่ใบกำกับภาษี">
                            <td style={{ ...ptd, textAlign: "center" }}>{i + 1}</td>
                            <td style={{ ...ptd, textAlign: "center" }}>
                              <span style={{ padding: "2px 8px", background: b.bg, color: b.color, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{b.label}</span>
                            </td>
                            <td style={{ ...ptd, fontFamily: "monospace", fontWeight: 700, color: "#072d6b" }}>{r.tax_invoice_no || "-"}</td>
                            <td style={ptd}>
                              <div style={{ fontWeight: 600 }}>{r.sale_customer_name || r.customer_name || "-"}</div>
                              {r.sale_finance_company && <div style={{ fontSize: 11, color: "#6b7280" }}>📋 {r.sale_finance_company}</div>}
                            </td>
                            <td style={{ ...ptd, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                            <td style={ptd}>{r.model_name || "-"}</td>
                            <td style={{ ...ptd, fontFamily: "monospace", fontSize: 11 }}>{r.sale_invoice_no || "-"}</td>
                            <td style={{ ...ptd, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#a16207" }}>{fmt(r.credit_note_total)}</td>
                            <td style={{ ...ptd, textAlign: "center" }}>
                              {entered
                                ? <span style={{ color: "#166534", fontWeight: 700 }}>✓ บันทึก</span>
                                : <span style={{ color: "#2563eb", textDecoration: "underline" }}>+ กรอก</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot style={{ background: "#fef9c3", fontWeight: 700 }}>
                      <tr>
                        <td colSpan={7} style={{ ...ptd, textAlign: "right" }}>รวม {popupCars.length} คัน</td>
                        <td style={{ ...ptd, textAlign: "right", fontFamily: "monospace", color: "#a16207", fontSize: 13 }}>{fmt(popupCarsTotal)}</td>
                        <td style={ptd}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* รายการรับใบกำกับฯ ที่บันทึก (ยังไม่เข้า DB จนกดบันทึกรับเอกสาร) */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                  🧾 รายการใบกำกับภาษีที่รับ {receiptsLoading && <span style={{ fontSize: 11, color: "#9ca3af" }}>(กำลังโหลด...)</span>}
                </div>
                {receipts.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", color: "#9ca3af", border: "1px dashed #d1d5db", borderRadius: 8, fontSize: 13 }}>
                    — ยังไม่มีรายการ — กดที่แถวรถด้านบนเพื่อกรอกเลขที่ใบกำกับภาษี
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#1e3a8a", color: "#fff" }}>
                          <th style={pth}>ใบขาย</th><th style={pth}>ลูกค้า</th><th style={pth}>รุ่น</th>
                          <th style={pth}>เลขที่ใบกำกับภาษี</th><th style={pth}>วันที่ใบกำกับ</th>
                          <th style={{ ...pth, textAlign: "right" }}>มูลค่า</th>
                          <th style={{ ...pth, textAlign: "right" }}>VAT</th>
                          <th style={{ ...pth, textAlign: "right" }}>สุทธิ</th>
                          <th style={{ ...pth, textAlign: "center" }}>จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receipts.map((r) => (
                          <tr key={r.sale_invoice_no} style={{ background: "#fff" }}>
                            <td style={{ ...ptd, fontFamily: "monospace", fontSize: 11 }}>{r.sale_invoice_no}</td>
                            <td style={ptd}>{r.customer_name || "-"}</td>
                            <td style={ptd}>{r.model_name || "-"}</td>
                            <td style={{ ...ptd, fontFamily: "monospace", fontWeight: 700, color: "#1e3a8a" }}>{r.tax_invoice_no}</td>
                            <td style={ptd}>{fmtDate(r.tax_invoice_date)}</td>
                            <td style={{ ...ptd, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.subtotal)}</td>
                            <td style={{ ...ptd, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.vat_amount)} <span style={{ color: "#9ca3af", fontSize: 10 }}>({r.vat_pct}%)</span></td>
                            <td style={{ ...ptd, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#166534" }}>{fmt(r.total)}</td>
                            <td style={{ ...ptd, textAlign: "center" }}>
                              <button onClick={() => removeReceipt(r.sale_invoice_no)}
                                style={{ border: "none", background: "#fee2e2", color: "#b91c1c", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>🗑 ลบ</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot style={{ background: "#f0fdf4", fontWeight: 700 }}>
                        <tr>
                          <td colSpan={5} style={{ ...ptd, textAlign: "right" }}>รวม {receipts.length} รายการ</td>
                          <td style={{ ...ptd, textAlign: "right", fontFamily: "monospace" }}>{fmt(recSubtotal)}</td>
                          <td style={{ ...ptd, textAlign: "right", fontFamily: "monospace" }}>{fmt(recVat)}</td>
                          <td style={{ ...ptd, textAlign: "right", fontFamily: "monospace", color: "#166534", fontSize: 13 }}>{fmt(recNet)}</td>
                          <td style={ptd}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* แถบกระทบยอด + ปุ่มบันทึก */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12, padding: "10px 14px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                  <div style={{ fontSize: 13 }}>
                    <span>ยอดสุทธิรวม: <b style={{ color: "#166534" }}>{fmt(recNet)}</b></span>
                    <span style={{ margin: "0 8px", color: "#9ca3af" }}>เทียบเอกสาร: <b>{fmt(docTotal)}</b></span>
                    {receipts.length > 0 && (netMatched
                      ? <span style={{ color: "#166534", fontWeight: 700 }}>✓ ยอดตรง</span>
                      : <span style={{ color: "#b91c1c", fontWeight: 700 }}>⚠ ต่าง {fmt(Math.abs(netDiff))} ({netDiff > 0 ? "เกิน" : "ขาด"})</span>
                    )}
                  </div>
                  <button onClick={commitReceipts} disabled={savingReceipts || receipts.length === 0}
                    title={netMatched ? "" : "ยอดยังไม่ตรงกับเอกสารค่าใช้จ่าย (บันทึกได้แต่ควรตรวจสอบ)"}
                    style={{ ...btn, background: savingReceipts || receipts.length === 0 ? "#9ca3af" : netMatched ? "#15803d" : "#d97706" }}>
                    {savingReceipts ? "💾 กำลังบันทึก..." : "💾 บันทึกรับเอกสารเข้า DB"}
                  </button>
                </div>
                {popupMsg && <div style={{ fontSize: 13, marginTop: 8, fontWeight: 600, color: popupMsg.startsWith("✅") ? "#166534" : popupMsg.startsWith("❌") ? "#b91c1c" : "#b45309" }}>{popupMsg}</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: ฟอร์มกรอกใบกำกับภาษีของคันที่เลือก */}
      {carForm && (() => {
        const net = Number(carForm.netStr) || 0;                         // ยอดสุทธิ (รวม VAT) = ที่กรอก
        const vatPct = Number(carForm.vatPctStr) || 0;
        const subtotal = Math.round((net / (1 + vatPct / 100)) * 100) / 100;  // ถอด VAT → มูลค่า
        const vatAmount = Math.round((net - subtotal) * 100) / 100;           // ภาษี
        return (
          <div onClick={() => setCarForm(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 12, width: "min(520px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1e3a8a" }}>🧾 กรอกใบกำกับภาษีที่รับ</div>
                <button onClick={() => setCarForm(null)} style={{ border: "none", background: "#f3f4f6", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ fontSize: 12, color: "#6b7280", background: "#f8fafc", borderRadius: 8, padding: "8px 10px", marginBottom: 14, lineHeight: 1.7 }}>
                  <div>🚗 <b>{carForm.model_name || "-"}</b> · ใบขาย <span style={{ fontFamily: "monospace" }}>{carForm.sale_invoice_no}</span></div>
                  <div>ลูกค้า: {carForm.customer_name || "-"} {carForm.finance_company ? `· ไฟแนนท์: ${carForm.finance_company}` : ""}</div>
                  <div>ประกันรถหายออกแทน (อ้างอิง): <b style={{ color: "#a16207" }}>{fmt(carForm.credit_note_amount)}</b></div>
                </div>

                <label style={flabel}>เลขที่ใบกำกับภาษี *</label>
                <input value={carForm.tax_invoice_no} onChange={e => setCarForm({ ...carForm, tax_invoice_no: e.target.value })}
                  placeholder="เช่น IV6805xxxx" style={finp} autoFocus />

                <label style={flabel}>วันที่ตามใบกำกับภาษี</label>
                <input type="date" value={carForm.tax_invoice_date} onChange={e => setCarForm({ ...carForm, tax_invoice_date: e.target.value })}
                  style={finp} />

                <label style={flabel}>จำนวนเงินสุทธิ (รวม VAT) *</label>
                <input type="number" value={carForm.netStr} onChange={e => setCarForm({ ...carForm, netStr: e.target.value })}
                  placeholder="0.00" style={finp} />

                <label style={flabel}>VAT %</label>
                <input type="number" value={carForm.vatPctStr} onChange={e => setCarForm({ ...carForm, vatPctStr: e.target.value })}
                  style={{ ...finp, maxWidth: 120 }} />

                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 10, padding: "10px 12px", background: "#f0fdf4", borderRadius: 8, fontSize: 14 }}>
                  <span>มูลค่า (ก่อน VAT): <b>{fmt(subtotal)}</b></span>
                  <span>ภาษี (VAT): <b>{fmt(vatAmount)}</b></span>
                  <span>สุทธิ: <b style={{ color: "#166534", fontSize: 16 }}>{fmt(net)}</b></span>
                </div>

                {popupMsg && popupMsg.startsWith("⚠️") && <div style={{ fontSize: 12, color: "#b45309", marginTop: 8 }}>{popupMsg}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                  <button onClick={() => setCarForm(null)} style={{ ...btn, background: "#e5e7eb", color: "#374151" }}>ยกเลิก</button>
                  <button onClick={addCarReceipt} style={{ ...btn, background: "#2563eb" }}>➕ บันทึก (เพิ่มในรายการ)</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: แก้ไขแถวประวัติ */}
      {histEdit && (() => {
        const net = Number(histEdit.netStr) || 0;
        const vatPct = Number(histEdit.vatPctStr) || 0;
        const subtotal = Math.round((net / (1 + vatPct / 100)) * 100) / 100;
        const vatAmount = Math.round((net - subtotal) * 100) / 100;
        return (
          <div onClick={() => setHistEdit(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 12, width: "min(520px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1e3a8a" }}>✏️ แก้ไขรายการรับใบกำกับฯ</div>
                <button onClick={() => setHistEdit(null)} style={{ border: "none", background: "#f3f4f6", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ fontSize: 12, color: "#6b7280", background: "#f8fafc", borderRadius: 8, padding: "8px 10px", marginBottom: 14, lineHeight: 1.7 }}>
                  <div>เอกสาร <b style={{ fontFamily: "monospace", color: "#991b1b" }}>{histEdit.flow_doc_no}</b></div>
                  <div>🚗 {histEdit.model_name || "-"} · ใบขาย <span style={{ fontFamily: "monospace" }}>{histEdit.sale_invoice_no}</span> · {histEdit.customer_name || "-"}</div>
                </div>

                <label style={flabel}>เลขที่ใบกำกับภาษี *</label>
                <input value={histEdit.tax_invoice_no} onChange={e => setHistEdit({ ...histEdit, tax_invoice_no: e.target.value })} style={finp} autoFocus />

                <label style={flabel}>วันที่ตามใบกำกับภาษี</label>
                <input type="date" value={histEdit.tax_invoice_date} onChange={e => setHistEdit({ ...histEdit, tax_invoice_date: e.target.value })} style={finp} />

                <label style={flabel}>จำนวนเงินสุทธิ (รวม VAT) *</label>
                <input type="number" value={histEdit.netStr} onChange={e => setHistEdit({ ...histEdit, netStr: e.target.value })} style={finp} />

                <label style={flabel}>VAT %</label>
                <input type="number" value={histEdit.vatPctStr} onChange={e => setHistEdit({ ...histEdit, vatPctStr: e.target.value })} style={{ ...finp, maxWidth: 120 }} />

                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 10, padding: "10px 12px", background: "#f0fdf4", borderRadius: 8, fontSize: 14 }}>
                  <span>มูลค่า (ก่อน VAT): <b>{fmt(subtotal)}</b></span>
                  <span>ภาษี (VAT): <b>{fmt(vatAmount)}</b></span>
                  <span>สุทธิ: <b style={{ color: "#166534", fontSize: 16 }}>{fmt(net)}</b></span>
                </div>

                {histMsg && histMsg.startsWith("⚠️") && <div style={{ fontSize: 12, color: "#b45309", marginTop: 8 }}>{histMsg}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                  <button onClick={() => setHistEdit(null)} style={{ ...btn, background: "#e5e7eb", color: "#374151" }}>ยกเลิก</button>
                  <button onClick={saveHistEdit} style={{ ...btn, background: "#15803d" }}>💾 บันทึกการแก้ไข</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const lbl = { fontSize: 13, fontWeight: 600, color: "#374151" };
const inp = { padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma" };
const btn = { color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, padding: "7px 16px", fontSize: 13 };
const pth = { padding: "8px 10px", textAlign: "left", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" };
const ptd = { padding: "7px 10px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const flabel = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", margin: "10px 0 4px" };
const finp = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
