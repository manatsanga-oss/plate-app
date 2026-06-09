import React, { useEffect, useMemo, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/receipt-entry-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

const RECEIPT_TYPES = ["จดทะเบียนใหม่", "โอน", "พรบ./ประกันภัย", "ต่อทะเบียน", "อื่น ๆ"];

const text = (v) => (v ?? "").toString().trim();
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const baht = (v) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtBE = (v) => { if (!v) return "-"; const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543}` : String(v); };

async function apiPost(payload) {
  const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const raw = await r.text();
  if (!raw.trim()) return [];
  try {
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : (d?.data || [d]);
  } catch { return []; }
}

const blankLine = () => ({ income_type: "", income_code: "", income_name: "", description: "", qty: 1, price_before_discount: 0, discount: 0 });

// ดึงเฉพาะ code (ตัวแรกก่อนเว้นวรรค) — "SCY01 สำนักงานใหญ่" → "SCY01"
const stripBranchCode = (v) => String(v || "").trim().split(/\s+/)[0] || "";

const blankHeader = (currentUser) => ({
  receipt_no: "",
  receive_date: todayISO(),
  receipt_type: "จดทะเบียนใหม่",
  receive_status: "ปกติ",
  receipt_status: "ปกติ",
  note: "",
  vat_rate: 0,
  branch_code: stripBranchCode(currentUser?.branch_code || currentUser?.branch || ""),
  branch_name: currentUser?.branch_name || currentUser?.branch || "",
  staff_recorder: currentUser?.name || currentUser?.username || "",
  customer_name: "", customer_address: "", customer_phone: "", customer_id_card: "",
  contract_no: "", contract_date: "", contract_ref: "", contract_status: "",
  brand: "", model_series: "", model_code: "", product_code: "", color: "",
  engine_no: "", chassis_no: "", plate_number: "", register_date: "", tax_paid_date: "",
});

export default function RegistrationReceiptEntryPage({ currentUser }) {
  const [view, setView] = useState("list"); // list | form
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [onlyManual, setOnlyManual] = useState(true);
  const [message, setMessage] = useState("");
  const [header, setHeader] = useState(blankHeader(currentUser));
  const [lines, setLines] = useState([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [searchModal, setSearchModal] = useState(false);
  const [searchKw, setSearchKw] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  // master รายได้ จากตาราง service_expenses (ใช้แทน hardcode INCOME_TYPES)
  const [serviceExpenses, setServiceExpenses] = useState([]);
  async function loadServiceExpenses() {
    try {
      const r = await fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_service_expenses", group_by: "income_type", include_inactive: "false" }) });
      const data = await r.json();
      setServiceExpenses(Array.isArray(data) ? data : []);
    } catch { setServiceExpenses([]); }
  }
  // จัดรูปแบบเป็น tree: income_type -> [{code, name, amount}] — dedup โดยให้แถวที่มี amount ชนะ
  const incomeTypesMaster = useMemo(() => {
    const map = new Map();
    serviceExpenses.forEach((r) => {
      const t = String(r.income_type || "").trim();
      if (!t) return;
      if (!map.has(t)) map.set(t, []);
      const arr = map.get(t);
      const key = `${r.income_code || ""}|${r.income_name || ""}`;
      const amt = r.income_amount != null && r.income_amount !== "" ? Number(r.income_amount) : null;
      const existing = arr.find((x) => x._key === key);
      if (!existing) {
        arr.push({ _key: key, code: r.income_code || "", name: r.income_name || "", amount: amt });
      } else if (existing.amount == null && amt != null) {
        // อัปเดต amount ถ้าแถวก่อนหน้าเป็น null แต่แถวนี้มีค่า
        existing.amount = amt;
      }
    });
    return Array.from(map.entries()).map(([type, codes]) => ({ type, codes: codes.sort((a,b) => String(a.code).localeCompare(String(b.code))) }));
  }, [serviceExpenses]);

  async function loadList() {
    setLoading(true);
    try {
      const data = await apiPost({
        action: "list_receipts",
        keyword: search.trim(),
        date_from: dateFrom, date_to: dateTo,
        only_manual: onlyManual,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }
  useEffect(() => { loadList(); loadServiceExpenses(); /* eslint-disable-next-line */ }, []);

  async function openNew() {
    setEditMode(false);
    setHeader(blankHeader(currentUser));
    setLines([blankLine()]);
    setMessage("");
    setView("form");
    // ขอ next receipt no (ใช้เฉพาะรหัสสาขา ไม่เอาชื่อร้าน)
    const branchCode = stripBranchCode(currentUser?.branch_code || currentUser?.branch || "SCY01");
    try {
      const data = await apiPost({ action: "get_next_receipt_no", branch_code: branchCode });
      const next = data?.[0]?.next_receipt_no;
      if (next) setHeader((h) => ({ ...h, receipt_no: next, branch_code: branchCode }));
    } catch {}
  }

  async function openEdit(r) {
    setEditMode(true);
    setMessage("");
    try {
      const data = await apiPost({ action: "get_receipt", receipt_no: r.receipt_no });
      const item = data?.[0]?.data || data?.[0] || {};
      const h = item.header || {};
      const ls = item.lines || [];
      setHeader({ ...blankHeader(currentUser), ...h,
        receive_date: h.receive_date ? String(h.receive_date).slice(0,10) : todayISO(),
        contract_date: h.contract_date ? String(h.contract_date).slice(0,10) : "",
        register_date: h.register_date ? String(h.register_date).slice(0,10) : "",
        tax_paid_date: h.tax_paid_date ? String(h.tax_paid_date).slice(0,10) : "",
      });
      setLines(ls.length ? ls.map((l) => ({ ...blankLine(), ...l })) : [blankLine()]);
      setView("form");
    } catch (e) {
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
  }

  function openSearchModal() {
    const seed = text(header.chassis_no) || text(header.engine_no) || text(header.plate_number) || "";
    setSearchKw(seed);
    setSearchResults([]);
    setSearched(false);
    setSearchModal(true);
  }

  async function runSearch() {
    const kw = text(searchKw);
    if (!kw) { setMessage("ใส่คำค้นหาก่อน"); return; }
    setSearching(true);
    setSearched(false);
    try {
      const data = await apiPost({ action: "search_similar", keyword: kw });
      setSearchResults(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch {
      setSearchResults([]);
      setSearched(true);
    }
    setSearching(false);
  }

  function pickResult(s) {
    setHeader((h) => ({ ...h,
      chassis_no: s.chassis_no || h.chassis_no,
      engine_no: s.engine_no || h.engine_no,
      customer_name: s.customer_name || h.customer_name,
      customer_address: s.customer_address || h.customer_address,
      customer_phone: s.customer_phone || h.customer_phone,
      customer_id_card: s.customer_id_card || h.customer_id_card,
      brand: s.brand || h.brand,
      model_series: s.model_series || h.model_series,
      model_code: s.model_code || h.model_code,
      product_code: s.product_code || h.product_code,
      color: s.color || h.color,
      plate_number: s.plate_number || h.plate_number,
      contract_ref: s.contract_ref || h.contract_ref,
    }));
    setSearchModal(false);
    setMessage(`✅ ดึงข้อมูลจาก ${s.source === "sale" ? "moto_sales" : "ประวัติรับเรื่อง"} แล้ว`);
  }

  // legacy: direct lookup ตามเดิม (เผื่อมีโค้ดอื่นเรียก) — แต่ตอนนี้ใช้ openSearchModal แทน
  async function lookupSale() {
    const chassis = text(header.chassis_no);
    const engine = text(header.engine_no);
    if (!chassis && !engine) { setMessage("ใส่เลขถังหรือเลขเครื่องก่อน"); return; }
    setMessage("🔍 กำลังค้นหา...");
    try {
      const data = await apiPost({ action: "lookup_sale", chassis_no: chassis, engine_no: engine });
      const s = data?.[0];
      if (!s || !s.chassis_no) { setMessage("ℹ️ ไม่พบข้อมูลขายที่ตรงกับเลขถัง/เลขเครื่องนี้"); return; }
      setHeader((h) => ({ ...h,
        chassis_no: s.chassis_no || h.chassis_no,
        engine_no: s.engine_no || h.engine_no,
        customer_name: s.customer_name || h.customer_name,
        customer_address: s.customer_address || h.customer_address,
        customer_phone: s.customer_phone || h.customer_phone,
        customer_id_card: s.customer_id_card || h.customer_id_card,
        brand: s.brand || h.brand,
        model_series: s.model_series || h.model_series,
        model_code: s.model_code || h.model_code,
        product_code: s.product_code || h.product_code,
        color: s.color || h.color,
        plate_number: s.plate_number || h.plate_number,
        contract_ref: s.contract_ref || h.contract_ref,
      }));
      setMessage("✅ ดึงข้อมูลจาก moto_sales สำเร็จ");
    } catch (e) {
      setMessage("❌ ค้นหาไม่สำเร็จ: " + String(e.message || e).slice(0, 100));
    }
  }

  function updateLine(i, patch) { setLines((arr) => arr.map((l, idx) => idx === i ? { ...l, ...patch } : l)); }
  function addLine() { setLines((arr) => [...arr, blankLine()]); }
  function removeLine(i) { setLines((arr) => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr); }

  // เลือกรหัส → auto-fill ชื่อ + ราคา (จาก master service_expenses)
  function onSelectIncomeCode(i, codeKey) {
    const t = incomeTypesMaster.find((x) => x.type === lines[i].income_type);
    const c = t?.codes.find((x) => x._key === codeKey);
    updateLine(i, {
      income_code: c?.code || "",
      income_name: c?.name || "",
      price_before_discount: c?.amount != null ? c.amount : (lines[i].price_before_discount || 0),
    });
  }
  // เลือก income_type → reset code/name
  function onSelectIncomeType(i, type) {
    updateLine(i, { income_type: type, income_code: "", income_name: "" });
  }

  const lineTotal = useMemo(() => lines.reduce((s, l) => s + (num(l.qty) * num(l.price_before_discount) - num(l.discount)), 0), [lines]);
  const vatRate = num(header.vat_rate);
  const priceBeforeVat = vatRate > 0 ? lineTotal / (1 + vatRate/100) : lineTotal;
  const vat = lineTotal - priceBeforeVat;

  async function handleSave() {
    if (!text(header.receipt_no)) { setMessage("❌ ไม่มีเลขที่รับเรื่อง"); return; }
    if (!text(header.customer_name)) { setMessage("❌ ใส่ชื่อลูกค้า"); return; }
    if (!text(header.chassis_no)) { setMessage("❌ ใส่เลขถัง"); return; }
    if (lines.length === 0 || lines.every(l => !num(l.price_before_discount))) { setMessage("❌ เพิ่มรายการรายได้อย่างน้อย 1"); return; }
    setSaving(true);
    setMessage("");
    try {
      const data = await apiPost({
        action: "save_receipt",
        header: { ...header, created_by: currentUser?.username || currentUser?.name || "system" },
        lines: lines.filter(l => num(l.price_before_discount) || num(l.qty) > 0),
      });
      if (data?.[0]?.message && /missing|error/i.test(data[0].message)) throw new Error(data[0].message);
      setMessage("✅ บันทึกสำเร็จ");
      await loadList();
      setTimeout(() => setView("list"), 600);
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + String(e.message || e).slice(0, 200));
    }
    setSaving(false);
  }

  async function handleDelete(r) {
    if (!window.confirm(`ยกเลิก ${r.receipt_no}?`)) return;
    try {
      await apiPost({ action: "delete_receipt", receipt_no: r.receipt_no });
      setMessage(`✅ ยกเลิก ${r.receipt_no} แล้ว`);
      await loadList();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  // ===== Styles =====
  const card = { background: "#fff", padding: 16, borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" };
  const inp = { width: "100%", padding: "7px 10px", border: "1.5px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
  const btn = { padding: "8px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600 };
  const btnPri = { ...btn, background: "#2563eb", color: "#fff" };
  const btnGreen = { ...btn, background: "#16a34a", color: "#fff" };
  const btnGray = { ...btn, background: "#e5e7eb", color: "#374151" };
  const btnSm = { padding: "3px 8px", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, color: "#fff", margin: "0 2px" };
  const th = { padding: "8px 10px", background: "#f1f5f9", textAlign: "left", fontWeight: 700, fontSize: 12, color: "#334155", borderBottom: "1px solid #e2e8f0" };
  const td = { padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 13 };
  const sec = { fontSize: 14, fontWeight: 700, color: "#0369a1", marginBottom: 8, paddingBottom: 6, borderBottom: "2px solid #e0f2fe" };

  if (view === "form") {
    return (
      <div style={{ padding: 20, background: "#fbf7f1", minHeight: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, color: "#333" }}>📥 {editMode ? "แก้ไข" : "สร้าง"}รับเรื่องงานทะเบียน</h2>
          <button onClick={() => setView("list")} style={btnGray}>← กลับ</button>
        </div>

        {message && <div style={{ padding: "8px 14px", marginBottom: 12, background: message.startsWith("✅") ? "#dcfce7" : message.startsWith("ℹ️") ? "#dbeafe" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : message.startsWith("ℹ️") ? "#1e40af" : "#991b1b", borderRadius: 6, fontSize: 14 }}>{message}</div>}

        <div style={{ ...card, marginBottom: 14 }}>
          <div style={sec}>📌 ข้อมูลเอกสาร</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            <Field label="เลขที่รับเรื่อง *"><input value={header.receipt_no} onChange={e => setHeader({ ...header, receipt_no: e.target.value })} style={{ ...inp, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }} readOnly={!editMode} /></Field>
            <Field label="วันที่รับเรื่อง *"><input type="date" value={header.receive_date} onChange={e => setHeader({ ...header, receive_date: e.target.value })} style={inp} /></Field>
            <Field label="ประเภท *"><select value={header.receipt_type} onChange={e => setHeader({ ...header, receipt_type: e.target.value })} style={inp}>{RECEIPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
            <Field label="สาขา *"><input value={header.branch_code} onChange={e => setHeader({ ...header, branch_code: stripBranchCode(e.target.value) })} style={inp} placeholder="SCY01" /></Field>
            <Field label="พนักงาน"><input value={header.staff_recorder} onChange={e => setHeader({ ...header, staff_recorder: e.target.value })} style={inp} /></Field>
            <Field label="VAT (%)"><input type="number" value={header.vat_rate} onChange={e => setHeader({ ...header, vat_rate: e.target.value })} style={inp} placeholder="0" /></Field>
          </div>
        </div>

        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={sec}>🏍️ ข้อมูลรถ</div>
            <button onClick={openSearchModal} style={{ ...btn, background: "#0ea5e9", color: "#fff", fontSize: 12, padding: "6px 12px" }}>🔍 ค้นหาข้อมูลรถ/ลูกค้า</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <Field label="เลขถัง *"><input value={header.chassis_no} onChange={e => setHeader({ ...header, chassis_no: e.target.value.toUpperCase() })} style={{ ...inp, fontFamily: "monospace" }} /></Field>
            <Field label="เลขเครื่อง"><input value={header.engine_no} onChange={e => setHeader({ ...header, engine_no: e.target.value.toUpperCase() })} style={{ ...inp, fontFamily: "monospace" }} /></Field>
            <Field label="ทะเบียน"><input value={header.plate_number} onChange={e => setHeader({ ...header, plate_number: e.target.value })} style={inp} /></Field>
            <Field label="ยี่ห้อ"><input value={header.brand} onChange={e => setHeader({ ...header, brand: e.target.value })} style={inp} /></Field>
            <Field label="รุ่น"><input value={header.model_series} onChange={e => setHeader({ ...header, model_series: e.target.value })} style={inp} /></Field>
            <Field label="รหัสรุ่น"><input value={header.model_code} onChange={e => setHeader({ ...header, model_code: e.target.value })} style={inp} /></Field>
            <Field label="แบบ"><input value={header.product_code} onChange={e => setHeader({ ...header, product_code: e.target.value })} style={inp} /></Field>
            <Field label="สี"><input value={header.color} onChange={e => setHeader({ ...header, color: e.target.value })} style={inp} /></Field>
          </div>
        </div>

        <div style={{ ...card, marginBottom: 14 }}>
          <div style={sec}>👤 ข้อมูลลูกค้า</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <Field label="ชื่อลูกค้า *"><input value={header.customer_name} onChange={e => setHeader({ ...header, customer_name: e.target.value })} style={inp} /></Field>
            <Field label="โทร"><input value={header.customer_phone} onChange={e => setHeader({ ...header, customer_phone: e.target.value })} style={inp} /></Field>
            <Field label="เลขบัตรประชาชน"><input value={header.customer_id_card} onChange={e => setHeader({ ...header, customer_id_card: e.target.value })} style={inp} /></Field>
            <Field label="สัญญาเช่าซื้อ/ไฟแนนซ์"><input value={header.contract_ref} onChange={e => setHeader({ ...header, contract_ref: e.target.value })} style={inp} /></Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <Field label="ที่อยู่"><input value={header.customer_address} onChange={e => setHeader({ ...header, customer_address: e.target.value })} style={inp} /></Field>
          </div>
        </div>

        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={sec}>💰 รายการรายได้</div>
            <button onClick={addLine} style={{ ...btn, background: "#16a34a", color: "#fff", fontSize: 12, padding: "6px 12px" }}>➕ เพิ่มรายการ</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>ประเภท</th>
                  <th style={th}>ชื่อรายได้</th>
                  <th style={{ ...th, textAlign: "right" }}>จำนวน</th>
                  <th style={{ ...th, textAlign: "right" }}>ราคา</th>
                  <th style={{ ...th, textAlign: "right" }}>ส่วนลด</th>
                  <th style={{ ...th, textAlign: "right" }}>สุทธิ</th>
                  <th style={{ ...th, textAlign: "center" }}>—</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const net = num(l.qty) * num(l.price_before_discount) - num(l.discount);
                  const incomeTypeObj = incomeTypesMaster.find(x => x.type === l.income_type);
                  // หา selected key เฉพาะเมื่อ income_name ถูกเลือกแล้ว — ไม่ default ไปรายการแรก
                  const selectedKey = l.income_name
                    ? ((incomeTypeObj?.codes || []).find(c => c.code === l.income_code && c.name === l.income_name)?._key
                       || (incomeTypeObj?.codes || []).find(c => c.name === l.income_name)?._key
                       || "")
                    : "";
                  return (
                    <tr key={i}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>
                        <select value={l.income_type} onChange={e => onSelectIncomeType(i, e.target.value)} style={{ ...inp, padding: "5px 8px", fontSize: 12 }}>
                          <option value="">— เลือกประเภท —</option>
                          {incomeTypesMaster.map(t => <option key={t.type} value={t.type}>{t.type}</option>)}
                        </select>
                      </td>
                      <td style={td}>
                        <select value={selectedKey} onChange={e => {
                          const opt = e.target.options[e.target.selectedIndex];
                          const amtStr = opt?.dataset?.amount || "";
                          const amt = amtStr !== "" ? Number(amtStr) : null;
                          updateLine(i, {
                            income_code: opt?.dataset?.code || "",
                            income_name: opt?.dataset?.name || "",
                            price_before_discount: amt != null && !Number.isNaN(amt) ? amt : (l.price_before_discount || 0),
                          });
                        }} style={{ ...inp, padding: "5px 8px", fontSize: 12, minWidth: 220 }} disabled={!l.income_type}>
                          <option value="" data-amount="" data-code="" data-name="">— เลือกชื่อรายได้ —</option>
                          {(incomeTypeObj?.codes || []).map(c => (
                            <option key={c._key} value={c._key} data-amount={c.amount ?? ""} data-code={c.code || ""} data-name={c.name || ""}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={td}><input type="number" value={l.qty} onChange={e => updateLine(i, { qty: e.target.value })} style={{ ...inp, padding: "5px 8px", fontSize: 12, textAlign: "right", maxWidth: 70 }} /></td>
                      <td style={td}><input type="number" value={l.price_before_discount} onChange={e => updateLine(i, { price_before_discount: e.target.value })} style={{ ...inp, padding: "5px 8px", fontSize: 12, textAlign: "right" }} /></td>
                      <td style={td}><input type="number" value={l.discount} onChange={e => updateLine(i, { discount: e.target.value })} style={{ ...inp, padding: "5px 8px", fontSize: 12, textAlign: "right", maxWidth: 80 }} /></td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: net > 0 ? "#dc2626" : "#9ca3af" }}>{baht(net)}</td>
                      <td style={{ ...td, textAlign: "center" }}><button onClick={() => removeLine(i)} style={{ ...btnSm, background: "#ef4444" }}>✕</button></td>
                    </tr>
                  );
                })}
                <tr style={{ background: "#fef3c7" }}>
                  <td colSpan={6} style={{ ...td, textAlign: "right", fontWeight: 700 }}>รวม</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, fontSize: 15, color: "#dc2626" }}>{baht(lineTotal)}</td>
                  <td style={td}></td>
                </tr>
                {vatRate > 0 && <>
                  <tr><td colSpan={6} style={{ ...td, textAlign: "right" }}>ราคาก่อน VAT</td><td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{baht(priceBeforeVat)}</td><td style={td}></td></tr>
                  <tr><td colSpan={6} style={{ ...td, textAlign: "right" }}>VAT {vatRate}%</td><td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{baht(vat)}</td><td style={td}></td></tr>
                </>}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ ...card, marginBottom: 14 }}>
          <Field label="หมายเหตุ"><textarea value={header.note} onChange={e => setHeader({ ...header, note: e.target.value })} style={{ ...inp, minHeight: 60 }} /></Field>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "10px 0" }}>
          <button onClick={() => setView("list")} style={btnGray}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnGreen, opacity: saving ? 0.6 : 1 }}>{saving ? "กำลังบันทึก..." : "💾 บันทึก"}</button>
        </div>

        {searchModal && (
          <div onClick={() => setSearchModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 10, width: "min(960px, 96vw)", maxHeight: "88vh", overflow: "auto", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0ea5e9", color: "#fff" }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>🔍 ค้นหาข้อมูลรถ/ลูกค้า</div>
                <button onClick={() => setSearchModal(false)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <input autoFocus value={searchKw} onChange={(e) => setSearchKw(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runSearch()}
                    placeholder="เลขเครื่อง / เลขถัง / ทะเบียน / ชื่อลูกค้า"
                    style={{ ...inp, fontSize: 14, flex: 1 }} />
                  <button onClick={runSearch} disabled={searching} style={{ ...btnPri, padding: "8px 18px" }}>
                    {searching ? "กำลังค้น..." : "🔍 ค้นหา"}
                  </button>
                </div>

                {searched && searchResults.length === 0 && (
                  <div style={{ padding: 20, background: "#fef3c7", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: "#92400e", marginBottom: 10 }}>ℹ️ ไม่พบข้อมูลที่ตรงกับ <b>"{searchKw}"</b></div>
                    <button onClick={() => { setSearchModal(false); setMessage("กรอกข้อมูลรถ/ลูกค้าด้วยตนเอง"); }} style={{ ...btnGreen, padding: "8px 18px" }}>➕ เพิ่มข้อมูลเอง</button>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={th}>แหล่ง</th>
                          <th style={th}>เลขถัง</th>
                          <th style={th}>เลขเครื่อง</th>
                          <th style={th}>ทะเบียน</th>
                          <th style={th}>ลูกค้า</th>
                          <th style={th}>รถ</th>
                          <th style={th}>วันที่</th>
                          <th style={{ ...th, textAlign: "center" }}>—</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.map((s, i) => (
                          <tr key={i} style={{ background: s.source === "sale" ? "#f0f9ff" : "#fef9c3" }}>
                            <td style={td}>
                              <span style={{ background: s.source === "sale" ? "#dbeafe" : "#fef3c7", color: s.source === "sale" ? "#1e40af" : "#a16207", padding: "2px 8px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                                {s.source === "sale" ? "ขาย" : "รับเรื่อง"}
                              </span>
                            </td>
                            <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{s.chassis_no || "-"}</td>
                            <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{s.engine_no || "-"}</td>
                            <td style={td}>{s.plate_number || "-"}</td>
                            <td style={td}>{s.customer_name || "-"}</td>
                            <td style={td}>{[s.brand, s.model_series, s.model_code].filter(Boolean).join(" · ") || "-"}</td>
                            <td style={td}>{fmtBE(s.ref_date)}</td>
                            <td style={{ ...td, textAlign: "center" }}>
                              <button onClick={() => pickResult(s)} style={{ ...btnSm, background: "#16a34a", padding: "4px 12px" }}>✓ เลือก</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 12, textAlign: "center", padding: 10, background: "#f1f5f9", borderRadius: 6 }}>
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>ไม่ตรงกับที่ต้องการ?</div>
                      <button onClick={() => { setSearchModal(false); setMessage("กรอกข้อมูลรถ/ลูกค้าด้วยตนเอง"); }} style={{ ...btnGreen, padding: "6px 16px", fontSize: 13 }}>➕ เพิ่มข้อมูลเอง</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== List view =====
  return (
    <div style={{ padding: 20, background: "#fbf7f1", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 24, color: "#333" }}>📥 รับเรื่องงานทะเบียน</h2>
        <button onClick={openNew} style={btnPri}>➕ สร้างใหม่</button>
      </div>

      {message && <div style={{ padding: "8px 14px", marginBottom: 12, background: message.startsWith("✅") ? "#dcfce7" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b", borderRadius: 6, fontSize: 14 }}>{message}</div>}

      <div style={{ ...card, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 เลขที่/ลูกค้า/เลขถัง/เครื่อง" style={{ ...inp, maxWidth: 280 }} onKeyDown={e => e.key === "Enter" && loadList()} />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inp, maxWidth: 160 }} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...inp, maxWidth: 160 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={onlyManual} onChange={e => setOnlyManual(e.target.checked)} />
          เฉพาะที่บันทึก manual
        </label>
        <button onClick={loadList} style={btnPri}>ค้นหา</button>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>{rows.length} รายการ</span>
      </div>

      <div style={card}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>เลขที่รับเรื่อง</th>
                <th style={th}>วันที่</th>
                <th style={th}>สาขา</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>เลขถัง</th>
                <th style={th}>รุ่น</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                <th style={th}>สถานะ</th>
                <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด...</td></tr>
                : rows.length === 0 ? <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>ยังไม่มีข้อมูล</td></tr>
                : rows.map(r => (
                  <tr key={r.receipt_no}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{r.receipt_no}</td>
                    <td style={td}>{fmtBE(r.receive_date)}</td>
                    <td style={td}><span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>{r.branch_code || "-"}</span></td>
                    <td style={td}>{r.customer_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                    <td style={td}>{[r.brand, r.model_series, r.model_code].filter(Boolean).join(" · ") || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{baht(r.line_total || r.total)}</td>
                    <td style={td}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: r.receipt_status === "ยกเลิก" ? "#fee2e2" : "#dcfce7", color: r.receipt_status === "ยกเลิก" ? "#991b1b" : "#15803d" }}>{r.receipt_status || "ปกติ"}</span>
                      {r.entry_source === "manual" && <span style={{ marginLeft: 4, fontSize: 10, padding: "1px 5px", background: "#dbeafe", color: "#1e40af", borderRadius: 3, fontWeight: 700 }}>manual</span>}
                    </td>
                    <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                      <button onClick={() => openEdit(r)} style={{ ...btnSm, background: "#f59e0b" }}>✏️</button>
                      <button onClick={() => handleDelete(r)} style={{ ...btnSm, background: "#ef4444" }}>🗑️</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", marginBottom: 3, fontSize: 12, fontWeight: 600, color: "#475569" }}>{label}</label>
      {children}
    </div>
  );
}
