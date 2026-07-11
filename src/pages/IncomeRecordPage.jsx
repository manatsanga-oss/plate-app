import React, { useEffect, useRef, useState } from "react";

const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/finance-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const CUSTOMER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/moto-sales-get-customers";
const ACCOUNTING_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const REPORT_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-report-api";
const MOTO_SALES_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/moto-sales-api";

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

const emptyItem = () => ({ income_code: "", income_name: "", description: "", qty: 1, unit_price: 0, amount: 0, wht_rate: 0 });
const emptyForm = () => ({
  income_doc_no: "",  // generated on save
  doc_date: todayISO(),
  customer_id: "",
  customer_name: "",
  customer_tax_id: "",
  customer_address: "",
  reference_no: "",
  affiliation: "",  // สังกัด: ป.เปา | สิงห์ชัย
  description: "",
  note: "",
  discount_pct: 0,
  vat_pct: 0,
  wht_rate: 0,
  wht_amount: 0,
  payment_method: "",
  paid_at: "",
  paid_doc_no: "",
  from_bank_account_id: "",
  status: "draft",  // draft | paid | cancelled
  items: [emptyItem()],
});

export default function IncomeRecordPage({ currentUser }) {
  const [docs, setDocs] = useState([]);
  const [customers, setCustomers] = useState([]);
  // TF import (รายงานใบกำกับภาษีรายได้อื่นๆ → income_records)
  const [tfImportOpen, setTfImportOpen] = useState(false);
  const [tfList, setTfList] = useState([]);
  const [tfSelected, setTfSelected] = useState({});
  const [tfLoading, setTfLoading] = useState(false);
  const [tfImporting, setTfImporting] = useState(false);
  const [tfBranchFilter, setTfBranchFilter] = useState("");
  const [tfSearch, setTfSearch] = useState("");
  // Finance transfer import (เงินโอนจากไฟแนนท์ที่ยัง pending → ตัดชำระ income_records)
  const [ftImportOpen, setFtImportOpen] = useState(false);
  const [ftList, setFtList] = useState([]);
  const [ftSelected, setFtSelected] = useState({});
  const [ftLoading, setFtLoading] = useState(false);
  const [ftImporting, setFtImporting] = useState(false);
  // Confirm step — เปิดหลัง user เลือกเงินโอนจาก ftImport popup
  const [ftConfirmOpen, setFtConfirmOpen] = useState(false);
  const [ftConfirmTransfers, setFtConfirmTransfers] = useState([]);
  const [incomeCategories, setIncomeCategories] = useState([]); // หมวดจาก master
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [filterAff, setFilterAff] = useState(""); // กรองตามสังกัด (ป.เปา / สิงห์ชัย) — "" = ทั้งหมด
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("draft"); // draft | pay | history | allocation
  // Allocation popup (บันทึกรายละเอียดการรับชำระรายได้อื่น ๆ — แตกย่อยตาม moto_sales)
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocDoc, setAllocDoc] = useState(null);
  const [allocCategory, setAllocCategory] = useState("");
  const [allocSales, setAllocSales] = useState([]);
  const [allocSalesLoading, setAllocSalesLoading] = useState(false);
  const [allocSearch, setAllocSearch] = useState("");
  const allocSearchRef = useRef(null);
  const [allocLines, setAllocLines] = useState([]); // [{ sale_id, invoice_no, amount, note }]
  const [lineEdit, setLineEdit] = useState(null); // { sale, lineIdx, amount, note }
  const [allocSaving, setAllocSaving] = useState(false);
  const [allocShowSelectedOnly, setAllocShowSelectedOnly] = useState(false);
  const [allocUsedInvoices, setAllocUsedInvoices] = useState(new Set());
  const [selected, setSelected] = useState({}); // { income_doc_id: true }
  const [payDialog, setPayDialog] = useState(false);
  const [payForm, setPayForm] = useState({ paid_date: todayISO(), payment_note: "" });
  // payments: array ของวิธีรับเงิน — รองรับการรับผสม
  const [payments, setPayments] = useState([{ method: "โอน", amount: 0, from_bank_account_id: "", credit_note_no: "" }]);
  const [editTotalRequired, setEditTotalRequired] = useState(0);
  const [savingPay, setSavingPay] = useState(false);
  const [editPayDocNo, setEditPayDocNo] = useState(null);
  // ใบลดหนี้ที่ยังไม่ถูกใช้ — โหลดจาก accounting-api เมื่อเปิด popup
  const [availableCreditNotes, setAvailableCreditNotes] = useState([]);
  const [loadingCreditNotes, setLoadingCreditNotes] = useState(false);
  // ใบค่าใช้จ่ายค้างจ่าย (draft) — วิธีรับเงิน "ค่าใช้จ่ายค้างชำระ (หักกลบ)" ดึงมาหักกลบ
  // เงื่อนไข: ชื่อผู้จำหน่ายของใบค่าใช้จ่ายต้องตรงกับชื่อลูกค้าของใบรายได้ที่เลือก
  const [expenseDocs, setExpenseDocs] = useState([]);
  const [payCustomerNames, setPayCustomerNames] = useState([]);

  // ดึงรายการ invoice_no ที่ถูกใช้แล้วในหมวดนี้ (จาก income_allocations อื่น)
  useEffect(() => {
    if (!allocOpen || !allocCategory || !allocDoc) { setAllocUsedInvoices(new Set()); return; }
    fetch(ACCOUNTING_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "list_used_alloc_invoices",
        category: allocCategory,
        exclude_doc_id: allocDoc.income_doc_id,
      }),
    }).then(r => r.json()).then(data => {
      const arr = Array.isArray(data) ? data : [];
      setAllocUsedInvoices(new Set(arr.map(x => String(x?.invoice_no || "")).filter(Boolean)));
    }).catch(() => setAllocUsedInvoices(new Set()));
  }, [allocOpen, allocCategory, allocDoc]);

  // Backfill wht_rate ของ items เมื่อ incomeCategories โหลดเสร็จ (กันกรณีเปิด form ก่อน categories โหลดเสร็จ)
  useEffect(() => {
    if (!showForm || !incomeCategories.length) return;
    setForm(f => {
      const items = f.items.map(it => {
        const wht = Number(it.wht_rate) || 0;
        if (!wht && it.income_code) {
          const ge = incomeCategories.find(g => g.income_code === it.income_code);
          if (ge && Number(ge.wht_rate) > 0) return { ...it, wht_rate: Number(ge.wht_rate) };
        }
        return it;
      });
      return { ...f, items };
    });
    /* eslint-disable-next-line */
  }, [incomeCategories, showForm]);

  useEffect(() => {
    const now = new Date();
    setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);
    fetchCustomers();
    fetchIncomeCategories();
    fetchBankAccounts();
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => { if (dateFrom && dateTo) fetchDocs(); /* eslint-disable-next-line */ }, [dateFrom, dateTo]);

  async function openTfImport() {
    setTfImportOpen(true);
    setTfLoading(true); setTfSelected({});
    setTfBranchFilter(""); setTfSearch("");
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_tf_unimported" }),
      });
      const data = await res.json();
      setTfList(Array.isArray(data) ? data.filter(x => x && x.tax_invoice_no) : []);
    } catch { setTfList([]); }
    setTfLoading(false);
  }
  async function submitTfImport() {
    const invs = Object.keys(tfSelected).filter(k => tfSelected[k]);
    if (invs.length === 0) { alert("เลือกอย่างน้อย 1 รายการ"); return; }
    setTfImporting(true);
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_tf_to_income", invoice_nos: invs, created_by: currentUser?.user_id || currentUser?.name || "" }),
      });
      const data = await res.json();
      const r = Array.isArray(data) ? data[0] : data;
      setMessage(`✅ นำเข้า ${r?.imported ?? 0} รายการ (${invs.length} ที่เลือก)`);
      setTfImportOpen(false); setTfList([]); setTfSelected({});
      fetchDocs();
    } catch (e) { alert("❌ Import ล้มเหลว: " + e.message); }
    setTfImporting(false);
  }

  async function openFtImport() {
    setFtImportOpen(true);
    setFtLoading(true); setFtSelected({});
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_finance_transfers", date_from: dateFrom || null, date_to: dateTo || null }),
      });
      const data = await res.json();
      // กรองเฉพาะรายการที่ match_status เป็น pending (รอตัดชำระ)
      const arr = Array.isArray(data) ? data.filter(r => r && (r.match_status || "pending") === "pending") : [];
      setFtList(arr);
    } catch { setFtList([]); }
    setFtLoading(false);
  }

  // Step 1: หลังเลือกเงินโอน → ปิด popup เลือก → เปิด popup ยืนยัน
  function proceedFtConfirm() {
    const ftIds = Object.keys(ftSelected).filter(k => ftSelected[k]);
    if (ftIds.length === 0) { alert("เลือกอย่างน้อย 1 รายการ"); return; }
    if (selectedIds.length === 0) { alert("กรุณาเลือกรายการรายได้ที่ต้องการตัดชำระจากตารางหลักก่อน"); return; }
    const selectedTransfers = ftList.filter(r => ftSelected[r.ft_id || r.id]);
    setFtConfirmTransfers(selectedTransfers);
    setFtImportOpen(false);
    setFtConfirmOpen(true);
  }

  // Step 2: ยืนยันแล้ว → ส่งจริง (ตรวจยอดตรงก่อน)
  async function submitFtImport() {
    const ftIds = ftConfirmTransfers.map(r => r.ft_id || r.id);
    if (ftIds.length === 0 || selectedIds.length === 0) return;
    const incomeTotal = filtered.filter(d => selected[d.income_doc_id])
      .reduce((s, d) => s + Number(d.net_to_pay || d.total || 0), 0);
    const ftTotal = ftConfirmTransfers.reduce((s, r) => s + Number(r.amount || 0), 0);
    if (Math.abs(incomeTotal - ftTotal) > 0.01) {
      alert(`❌ ยอดไม่ตรงกัน — รายได้ ${incomeTotal.toFixed(2)} ≠ เงินโอน ${ftTotal.toFixed(2)} (ส่วนต่าง ${(incomeTotal - ftTotal).toFixed(2)})`);
      return;
    }
    setFtImporting(true);
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "match_finance_transfers_to_income",
          ft_ids: ftIds.map(Number),
          income_doc_ids: selectedIds.map(Number),
          paid_by: currentUser?.user_id || currentUser?.name || "",
        }),
      });
      const data = await res.json();
      const r = Array.isArray(data) ? data[0] : data;
      setMessage(`✅ ตัดชำระจากไฟแนนท์ ${r?.matched ?? ftIds.length} รายการ`);
      setFtConfirmOpen(false); setFtConfirmTransfers([]);
      setFtList([]); setFtSelected({}); setSelected({});
      fetchDocs();
    } catch (e) { alert("❌ ตัดชำระล้มเหลว: " + e.message); }
    setFtImporting(false);
  }

  // === Allocation (บันทึกรายละเอียดการรับชำระรายได้อื่น ๆ) ===
  function openAllocation(doc) {
    setAllocDoc(doc);
    setAllocCategory("");
    setAllocLines([]);
    setAllocSales([]);
    setAllocSearch("");
    setAllocShowSelectedOnly(false);
    setAllocOpen(true);
    // load existing allocations if any
    fetch(ACCOUNTING_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_income_allocations", income_doc_id: doc.income_doc_id }),
    }).then(r => r.json()).then(data => {
      const arr = Array.isArray(data) ? data.filter(x => x && (x.sale_id || x.invoice_no)) : [];
      if (arr.length) {
        setAllocCategory(arr[0].category || "");
        setAllocLines(arr.map(a => ({ sale_id: a.sale_id, invoice_no: a.invoice_no, customer_name: a.customer_name, model: a.model, amount: Number(a.amount || 0), note: a.note || "" })));
        setAllocShowSelectedOnly(true);
        loadMotoSales();
      }
    }).catch(() => {});
  }
  async function loadMotoSales() {
    setAllocSalesLoading(true);
    try {
      const res = await fetch(REPORT_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        // ส่ง empty string ให้ workflow template ทำงาน (COALESCE จะใช้ default 1900-9999)
        body: JSON.stringify({ action: "list_car_payment_receipts", date_from: "", date_to: "" }),
      });
      // n8n อาจตอบ body ว่างเมื่อไม่มีข้อมูล — อย่าใช้ res.json() ตรง ๆ
      const raw = await res.text();
      const data = raw.trim() ? JSON.parse(raw) : [];
      const arr = Array.isArray(data) ? data : (data?.rows || []);
      const getFc = s => s?.sale_finance_company || s?.finance_company || s?.finance || "";
      // แสดงทั้งหมด — ผู้ใช้ใช้ search box ค้นเอง
      const normalized = arr
        .filter(s => s && (s.invoice_no || s.tax_invoice_no || s.sale_doc_no || s.doc_no || s.id || s.sale_id || s.sale_invoice_no))
        .map(s => ({
          id: s.id || s.sale_id,
          // ใช้เลขใบกำกับภาษีเป็นหลัก (ไม่ใช่เลขใบขาย)
          invoice_no: s.tax_invoice_no || s.sale_invoice_no || s.invoice_no || s.sale_doc_no || s.doc_no || "",
          sale_date: s.invoice_date || s.sale_date || s.doc_date,
          customer_name: s.customer_name || s.sale_customer_name || s.customer || "",
          // ชื่อลูกค้าตามใบกำกับดิบ (ไม่ fallback เป็นชื่อผู้ซื้อ) — ใช้กรองให้ตรงเอกสารรับชำระ
          invoice_customer: s.customer_name || "",
          model_series: s.model_name || s.sale_model_code || s.model_series || s.model || "",
          engine_no: s.engine_no || "",
          chassis_no: s.chassis_no || s.frame_no || "",
          total_amount: s.total_amount || s.sale_price || s.net_amount || s.total || 0,
          finance_company: getFc(s),
          sale_customer_name: s.sale_customer_name || "",
        }));
      console.log("loadMotoSales: loaded", normalized.length, "rows");
      setAllocSales(normalized);
    } catch { setAllocSales([]); }
    setAllocSalesLoading(false);
  }
  function addAllocLine(s) {
    // เทียบโดยใช้ invoice_no เป็นหลัก (id อาจ undefined สำหรับใบกำกับ)
    if (allocLines.some(l => l.invoice_no === s.invoice_no || (s.id && l.sale_id === s.id))) return;
    setAllocLines(arr => [...arr, {
      sale_id: s.id, invoice_no: s.invoice_no,
      customer_name: s.customer_name, model: s.model_series || s.model,
      amount: 0, note: ""
    }]);
  }
  function updateAllocLine(idx, field, val) {
    setAllocLines(arr => arr.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  }
  function removeAllocLine(idx) {
    setAllocLines(arr => arr.filter((_, i) => i !== idx));
  }
  async function saveAllocation(asDraft = false) {
    if (!allocDoc) return;
    if (!allocCategory) { alert("กรุณาเลือกประเภทรายรับ"); return; }
    if (allocLines.length === 0) { alert("เพิ่มอย่างน้อย 1 รายการ"); return; }
    const sum = allocLines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const target = Number(allocDoc.total || allocDoc.net_to_pay || 0);
    if (!asDraft && Math.abs(sum - target) > 0.01) {
      if (!window.confirm(`ยอดรวมที่กระจาย ${sum.toFixed(2)} ไม่ตรงกับยอดรวม VAT ${target.toFixed(2)} (ส่วนต่าง ${(sum - target).toFixed(2)}) — บันทึกต่อหรือไม่?`)) return;
    }
    setAllocSaving(true);
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_income_allocations",
          income_doc_id: allocDoc.income_doc_id,
          income_doc_no: allocDoc.income_doc_no,
          category: allocCategory,
          allocations: allocLines.map(l => ({
            sale_id: l.sale_id || null, invoice_no: l.invoice_no,
            customer_name: l.customer_name, model: l.model,
            amount: Number(l.amount || 0), note: l.note || ""
          })),
          created_by: currentUser?.user_id || currentUser?.name || "system",
        }),
      });
      const data = await res.json();
      const r = Array.isArray(data) ? data[0] : data;
      if (r?.error_msg) throw new Error(r.error_msg);
      setMessage(`✅ บันทึก${asDraft ? "ค้างไว้" : "รายละเอียด"} ${allocLines.length} รายการสำเร็จ${asDraft ? " (แก้ไขต่อได้ภายหลัง)" : ""}`);
      setAllocOpen(false); setAllocDoc(null); setAllocLines([]);
    } catch (e) { alert("❌ บันทึกล้มเหลว: " + e.message); }
    setAllocSaving(false);
  }

  async function fetchDocs() {
    setLoading(true);
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "income_record", op: "list", date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json();
      // กรอง object ว่าง (n8n alwaysOutputData อาจคืน [{}] แทน [] เมื่อ query ไม่มี row)
      const arr = Array.isArray(data) ? data.filter(d => d && d.income_doc_no) : [];
      setDocs(arr);
    } catch { setDocs([]); }
    setLoading(false);
  }
  async function fetchCustomers() {
    try {
      // ใช้ webhook จาก Moto Sales API (ตาราง customers จาก เมนู Sales → บันทึกข้อมูลลูกค้า)
      const res = await fetch(CUSTOMER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch { setCustomers([]); }
  }
  async function fetchIncomeCategories() {
    try {
      const res = await fetch(MASTER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "income_category", op: "list" }),
      });
      const data = await res.json();
      setIncomeCategories(Array.isArray(data) ? data : []);
    } catch { setIncomeCategories([]); }
  }
  async function fetchBankAccounts() {
    try {
      // list_bank_accounts อยู่ใน accounting-api ไม่ใช่ finance-api
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
      });
      const data = await res.json();
      setBankAccounts(Array.isArray(data) ? data : []);
    } catch { setBankAccounts([]); }
  }

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm());
    setShowForm(true);
  }
  function openEdit(d) {
    setEditTarget(d);
    setForm({
      income_doc_no: d.income_doc_no || "",
      doc_date: d.doc_date ? String(d.doc_date).slice(0, 10) : todayISO(),
      customer_id: d.customer_id || "",
      customer_name: d.customer_name || "",
      customer_tax_id: d.customer_tax_id || "",
      customer_address: d.customer_address || "",
      reference_no: d.reference_no || "",
      affiliation: d.affiliation || "",
      description: d.description || "",
      note: d.note || "",
      discount_pct: Number(d.discount_pct) || 0,
      vat_pct: Number(d.vat_pct) || 0,
      wht_rate: Number(d.wht_rate) || 0,
      wht_amount: Number(d.wht_amount) || 0,
      payment_method: d.payment_method || "",
      paid_at: d.paid_at ? String(d.paid_at).slice(0, 10) : "",
      paid_doc_no: d.paid_doc_no || "",
      from_bank_account_id: d.from_bank_account_id || "",
      status: d.status || "draft",
      // เติม wht_rate อัตโนมัติจากหมวดรายได้ ถ้า item มี income_code แต่ยังไม่มี wht_rate
      items: Array.isArray(d.items) && d.items.length
        ? d.items.map(it => {
            const wht = Number(it.wht_rate) || 0;
            if (!wht && it.income_code) {
              const ge = incomeCategories.find(g => g.income_code === it.income_code);
              if (ge) return { ...it, wht_rate: Number(ge.wht_rate) || 0 };
            }
            return it;
          })
        : [emptyItem()],
    });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditTarget(null); setForm(emptyForm()); }

  // ===== เพิ่มลูกค้าใหม่ (popup ย่อ) — บันทึกเข้า customers ผ่าน moto-sales-save-customer =====
  const [custModal, setCustModal] = useState(false);
  const [custSaving, setCustSaving] = useState(false);
  const [custForm, setCustForm] = useState({ title: "", first_name: "", last_name: "", id_number: "", phone: "", address: "" });
  async function saveQuickCustomer() {
    const name = custForm.first_name.trim();
    if (!name) { setMessage("❌ กรอกชื่อลูกค้า/ชื่อบริษัท"); return; }
    setCustSaving(true);
    try {
      // ส่งครบทุก field ตามฟอร์มหน้าบันทึกข้อมูลลูกค้า (กัน backend อ้าง key ที่ไม่มี)
      await fetch("https://n8n-new-project-gwf2.onrender.com/webhook/moto-sales-save-customer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_group: "", customer_level: "", title: custForm.title,
          contact_date: new Date().toISOString().slice(0, 10),
          is_finance: false, is_insurance: false,
          first_name: name, nickname: "", show_on_wholesale: false,
          last_name: custForm.last_name.trim(), gender: "", birth_date: "", age: "",
          nationality: "ไทย", id_type: "", id_number: custForm.id_number.trim(),
          id_expiry_date: "", id_issued_by: "", email: "", contact_address_type: "id_card",
          addr_house_no: custForm.address.trim(), addr_moo: "", addr_village: "", addr_soi: "", addr_road: "",
          addr_subdistrict: "", addr_district: "", addr_province: "", addr_postal_code: "",
          phone: custForm.phone.trim(), fax: "", status: "active",
        }),
      });
      // โหลดรายชื่อใหม่ แล้วเลือกคนที่เพิ่งเพิ่มอัตโนมัติ (หาแบบชื่อ+เลขบัตรตรง เอา id ล่าสุด)
      const res = await fetch(CUSTOMER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setCustomers(arr);
      const hit = arr.filter(c => String(c.first_name || "").trim() === name &&
          (!custForm.id_number.trim() || String(c.id_number || "").trim() === custForm.id_number.trim()))
        .sort((a, b) => Number(b.customer_id) - Number(a.customer_id))[0];
      if (hit) {
        const fullName = [hit.title, hit.first_name, hit.last_name].filter(Boolean).join(" ").trim();
        setForm(f => ({ ...f, customer_id: hit.customer_id, customer_name: fullName, customer_tax_id: hit.id_number || "", customer_address: custForm.address.trim() }));
      }
      setMessage(`✅ เพิ่มลูกค้า "${[custForm.title, name].filter(Boolean).join(" ")}" แล้ว`);
      setCustModal(false);
      setCustForm({ title: "", first_name: "", last_name: "", id_number: "", phone: "", address: "" });
    } catch (e) { setMessage("❌ เพิ่มลูกค้าไม่สำเร็จ: " + e.message); }
    setCustSaving(false);
  }

  function onCustomerChange(customerId) {
    const v = customers.find(x => String(x.customer_id) === String(customerId));
    if (v) {
      const fullName = [v.title, v.first_name, v.last_name].filter(Boolean).join(" ").trim() || v.customer_name || "";
      const fullAddr = [
        v.addr_house_no && `${v.addr_house_no}`,
        v.addr_moo && `หมู่ ${v.addr_moo}`,
        v.addr_village,
        v.addr_soi && `ซ.${v.addr_soi}`,
        v.addr_road && `ถ.${v.addr_road}`,
        v.addr_subdistrict && `ต.${v.addr_subdistrict}`,
        v.addr_district && `อ.${v.addr_district}`,
        v.addr_province && `จ.${v.addr_province}`,
        v.addr_postal_code,
      ].filter(Boolean).join(" ");
      setForm(f => ({
        ...f,
        customer_id: v.customer_id,
        customer_name: fullName,
        customer_tax_id: v.id_number || "",
        customer_address: fullAddr,
      }));
    } else {
      setForm(f => ({ ...f, customer_id: "", customer_name: "", customer_tax_id: "", customer_address: "" }));
    }
  }

  function onItemChange(idx, field, val) {
    setForm(f => {
      const items = f.items.slice();
      items[idx] = { ...items[idx], [field]: val };
      // recalc amount
      if (field === "qty" || field === "unit_price") {
        items[idx].amount = (Number(items[idx].qty) || 0) * (Number(items[idx].unit_price) || 0);
      }
      // ถ้าเลือก income_code → fill income_name + wht_rate (อัตโนมัติจากหมวด)
      if (field === "income_code") {
        const ge = incomeCategories.find(g => g.income_code === val);
        if (ge) {
          items[idx].income_name = ge.income_name;
          items[idx].wht_rate = Number(ge.wht_rate) || 0;
        }
      }
      return { ...f, items };
    });
  }
  function addItem() { setForm(f => ({ ...f, items: [...f.items, emptyItem()] })); }
  function removeItem(idx) { setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) })); }

  // Calculations
  const subtotal = form.items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const discountAmount = subtotal * (Number(form.discount_pct) || 0) / 100;
  const afterDiscount = subtotal - discountAmount;
  const vatAmount = afterDiscount * (Number(form.vat_pct) || 0) / 100;
  const totalIncVat = afterDiscount + vatAmount;
  // WHT คำนวณต่อ item — เฉพาะ items ที่มี wht_rate > 0
  // หาก discount > 0 จะกระจายส่วนลดลงตามสัดส่วน
  const whtAmount = form.items.reduce((s, it) => {
    const rate = Number(it.wht_rate) || 0;
    if (rate <= 0) return s;
    const itemAmt = Number(it.amount) || 0;
    // ส่วนลดเฉลี่ย proportional
    const itemAfterDisc = subtotal > 0 ? itemAmt * (afterDiscount / subtotal) : itemAmt;
    return s + (itemAfterDisc * rate / 100);
  }, 0);
  const whtBase = form.items.reduce((s, it) => {
    const rate = Number(it.wht_rate) || 0;
    if (rate <= 0) return s;
    const itemAmt = Number(it.amount) || 0;
    const itemAfterDisc = subtotal > 0 ? itemAmt * (afterDiscount / subtotal) : itemAmt;
    return s + itemAfterDisc;
  }, 0);
  const netToPay = totalIncVat - whtAmount;

  async function handleSave() {
    if (!form.customer_id && !form.customer_name) { setMessage("❌ กรุณาเลือกลูกค้า"); return; }
    if (!form.items.length || form.items.every(it => !it.income_name && !Number(it.amount))) { setMessage("❌ ต้องมีรายการอย่างน้อย 1 รายการ"); return; }
    setSaving(true);
    try {
      const body = {
        action: "income_record", op: "save",
        income_doc_id: editTarget?.income_doc_id || null,
        doc_date: form.doc_date,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        customer_name: form.customer_name,
        customer_tax_id: form.customer_tax_id,
        customer_address: form.customer_address,
        reference_no: form.reference_no,
        affiliation: form.affiliation || null,
        description: form.description,
        note: form.note,
        discount_pct: Number(form.discount_pct) || 0,
        discount_amount: discountAmount,
        vat_pct: Number(form.vat_pct) || 0,
        vat_amount: vatAmount,
        wht_rate: Number(form.wht_rate) || 0,
        wht_amount: whtAmount,
        wht_base: whtBase,
        subtotal,
        total: totalIncVat,
        net_to_pay: netToPay,
        status: form.status,
        items: form.items.filter(it => it.income_name || Number(it.amount) > 0),
        created_by: currentUser?.username || currentUser?.name || "system",
      };
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data?.income_doc_id || data?.income_doc_no || data?.[0]?.income_doc_id) {
        setMessage(editTarget ? "✅ แก้ไขเรียบร้อย" : `✅ บันทึกเรียบร้อย ${data.income_doc_no || data?.[0]?.income_doc_no || ""}`);
        closeForm();
        fetchDocs();
      } else {
        setMessage("❌ บันทึกไม่สำเร็จ");
      }
    } catch (e) { setMessage("❌ " + e.message); }
    setSaving(false);
  }

  // ล้างยอดรับสะสม (received_amount) — ใช้เมื่อการหักกลบ/รับบางส่วนถูกยกเลิกแล้ว ใบต้องกลับมาค้างเต็มยอด
  async function handleClearReceived(d) {
    const recv = Number(d.received_amount || 0);
    const net = Number(d.net_to_pay || d.total || 0);
    if (!window.confirm(`ล้างยอดรับสะสม ${fmt(recv)} ของ ${d.income_doc_no}?\nใบนี้จะกลับมาค้างเต็มยอด ${fmt(net)}\n\n⚠️ ใช้เฉพาะเมื่อการหักกลบ/รับบางส่วนฝั่งค่าใช้จ่ายถูกยกเลิกแล้วเท่านั้น`)) return;
    try {
      await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "income_record", op: "clear_received", income_doc_id: d.income_doc_id }),
      });
      setMessage("✅ ล้างยอดรับสะสมเรียบร้อย");
      fetchDocs();
    } catch { setMessage("❌ ล้างยอดรับสะสมไม่สำเร็จ"); }
  }

  async function handleCancel(d) {
    if (!window.confirm(`ยกเลิกเอกสาร ${d.income_doc_no}?`)) return;
    try {
      await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "income_record", op: "cancel", income_doc_id: d.income_doc_id }),
      });
      setMessage("✅ ยกเลิกเรียบร้อย");
      fetchDocs();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  // สร้างซ้ำ — เปิดฟอร์มใหม่ (ร่าง) โดยดึงข้อมูลจากเอกสารเดิม แต่เป็นใบใหม่
  function openDuplicate(d) {
    setEditTarget(null);
    setForm({
      income_doc_no: "",
      doc_date: todayISO(),
      customer_id: d.customer_id || "",
      customer_name: d.customer_name || "",
      customer_tax_id: d.customer_tax_id || "",
      customer_address: d.customer_address || "",
      reference_no: "",  // สร้างซ้ำ → ล้างเลขที่อ้างอิง (กรอกใหม่)
      affiliation: d.affiliation || "",
      description: d.description || "",
      note: d.note || "",
      discount_pct: Number(d.discount_pct) || 0,
      vat_pct: Number(d.vat_pct) || 0,
      wht_rate: Number(d.wht_rate) || 0,
      wht_amount: 0,
      payment_method: "",
      paid_at: "",
      paid_doc_no: "",
      from_bank_account_id: "",
      status: "draft",
      items: Array.isArray(d.items) && d.items.length
        ? d.items.map(it => {
            const wht = Number(it.wht_rate) || 0;
            let rate = wht;
            if (!rate && it.income_code) {
              const ge = incomeCategories.find(g => g.income_code === it.income_code);
              if (ge) rate = Number(ge.wht_rate) || 0;
            }
            return {
              income_code: it.income_code || "",
              income_name: it.income_name || "",
              description: it.description || "",
              qty: Number(it.qty) || 1,
              unit_price: Number(it.unit_price) || 0,
              amount: Number(it.amount) || 0,
              wht_rate: rate,
            };
          })
        : [emptyItem()],
    });
    setShowForm(true);
    setMessage("📋 สร้างซ้ำจาก " + (d.income_doc_no || "") + " — ตรวจสอบแล้วกดบันทึก");
  }

  // พิมพ์ — เปิดหน้าต่างใหม่แล้วสั่งพิมพ์ใบรายได้
  function handlePrint(d) {
    const w = window.open("", "_blank", "width=820,height=960");
    if (!w) { setMessage("❌ เปิดหน้าต่างพิมพ์ไม่ได้ (ป๊อปอัพถูกบล็อก)"); return; }
    const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const items = Array.isArray(d.items) ? d.items : [];
    const rows = items.map((it, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${esc(it.income_name)}${it.description ? `<div style="color:#6b7280;font-size:11px">${esc(it.description)}</div>` : ""}</td>
        <td style="text-align:right">${fmt(it.qty)}</td>
        <td style="text-align:right">${fmt(it.unit_price)}</td>
        <td style="text-align:right">${fmt(it.amount)}</td>
      </tr>`).join("");
    const subtotal = Number(d.total_before_discount) || items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
    const discountAmt = Number(d.total_before_discount) && Number(d.total_after_discount)
      ? Number(d.total_before_discount) - Number(d.total_after_discount) : 0;
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(d.income_doc_no)}</title>
      <style>
        *{font-family:'Tahoma','Sarabun',sans-serif;box-sizing:border-box}
        body{margin:24px;color:#111827;font-size:13px}
        h1{font-size:20px;margin:0 0 4px}
        .muted{color:#6b7280}
        .row{display:flex;justify-content:space-between;gap:16px;margin-bottom:12px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #d1d5db;padding:6px 8px}
        th{background:#f3f4f6;text-align:left;font-size:12px}
        .tot{display:flex;justify-content:flex-end;margin-top:10px}
        .tot table{width:320px}
        .tot td{border:none;padding:3px 0}
        @media print{body{margin:0}}
      </style></head><body>
      <div class="row">
        <div>
          <h1>ใบบันทึกรายได้อื่น ๆ</h1>
          <div class="muted">เลขที่ <b>${esc(d.income_doc_no)}</b> · วันที่ ${fmtDate(d.doc_date)}</div>
          ${d.affiliation ? `<div class="muted">สังกัด: ${esc(d.affiliation)}</div>` : ""}
        </div>
        <div style="text-align:right">
          <div><b>${esc(d.customer_name)}</b></div>
          ${d.customer_tax_id ? `<div class="muted">เลขผู้เสียภาษี: ${esc(d.customer_tax_id)}</div>` : ""}
          ${d.customer_address ? `<div class="muted" style="max-width:300px">${esc(d.customer_address)}</div>` : ""}
          ${d.reference_no ? `<div class="muted">อ้างอิง: ${esc(d.reference_no)}</div>` : ""}
        </div>
      </div>
      ${d.description ? `<div class="muted">รายละเอียด: ${esc(d.description)}</div>` : ""}
      <table>
        <thead><tr><th style="width:36px;text-align:center">#</th><th>รายการ</th><th style="text-align:right;width:70px">จำนวน</th><th style="text-align:right;width:110px">ราคา/หน่วย</th><th style="text-align:right;width:120px">รวม</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#9ca3af">ไม่มีรายการ</td></tr>`}</tbody>
      </table>
      <div class="tot"><table>
        <tr><td class="muted">รวมเป็นเงิน</td><td style="text-align:right">${fmt(subtotal)}</td></tr>
        ${discountAmt > 0 ? `<tr><td class="muted">ส่วนลด</td><td style="text-align:right">-${fmt(discountAmt)}</td></tr>` : ""}
        ${Number(d.vat_amount) > 0 ? `<tr><td class="muted">ภาษีมูลค่าเพิ่ม</td><td style="text-align:right">${fmt(d.vat_amount)}</td></tr>` : ""}
        <tr><td><b>จำนวนเงินรวมทั้งสิ้น</b></td><td style="text-align:right"><b>${fmt(d.total)}</b></td></tr>
        ${Number(d.wht_amount) > 0 ? `<tr><td class="muted">หัก ณ ที่จ่าย</td><td style="text-align:right;color:#dc2626">-${fmt(d.wht_amount)}</td></tr>` : ""}
        <tr><td><b>ยอดสุทธิที่ได้รับ</b></td><td style="text-align:right"><b>${fmt(d.net_to_pay || d.total)}</b></td></tr>
      </table></div>
      ${d.note ? `<div class="muted" style="margin-top:14px">หมายเหตุ: ${esc(d.note)}</div>` : ""}
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  }

  // พิมพ์รายละเอียดการรับชำระ (allocation) — หัวเอกสาร + ตารางรายคัน + สรุปยอด
  function handlePrintAllocation() {
    if (!allocDoc) return;
    const w = window.open("", "_blank", "width=980,height=960");
    if (!w) { alert("เปิดหน้าต่างพิมพ์ไม่ได้ (ป๊อปอัพถูกบล็อก)"); return; }
    const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const catName = incomeCategories.find(g => String(g.income_code) === String(allocCategory))?.income_name || "";
    const saleOf = (l) => allocSales.find(s => s.invoice_no === l.invoice_no || (l.sale_id && s.id === l.sale_id)) || {};
    const rows = allocLines.map((l, i) => {
      const s = saleOf(l);
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td style="font-family:monospace">${esc(l.invoice_no)}</td>
        <td style="text-align:center;white-space:nowrap">${s.sale_date ? fmtDate(s.sale_date) : "-"}</td>
        <td>${esc(l.model || s.model_series || "-")}</td>
        <td style="font-family:monospace;font-size:11px">${esc(s.engine_no || "-")}</td>
        <td style="font-family:monospace;font-size:11px">${esc(s.chassis_no || "-")}</td>
        <td>${esc(s.sale_customer_name || l.customer_name || "-")}</td>
        <td style="text-align:right">${fmt(l.amount)}</td>
        <td>${esc(l.note || "")}</td>
      </tr>`;
    }).join("");
    const sum = allocLines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const target = Number(allocDoc.total || allocDoc.net_to_pay || 0);
    const diff = Math.round((sum - target) * 100) / 100;
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายละเอียดการรับชำระ ${esc(allocDoc.income_doc_no)}</title>
      <style>
        *{font-family:'Tahoma','Sarabun',sans-serif;box-sizing:border-box}
        body{margin:20px;color:#111827;font-size:12px}
        h1{font-size:18px;margin:0 0 4px}
        .muted{color:#6b7280}
        .row{display:flex;justify-content:space-between;gap:16px;margin-bottom:10px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #d1d5db;padding:4px 6px;vertical-align:top}
        th{background:#f3f4f6;text-align:left;font-size:11px;white-space:nowrap}
        tfoot td{font-weight:bold;background:#f8fafc}
        @media print{body{margin:0}@page{size:landscape;margin:10mm}}
      </style></head><body>
      <div class="row">
        <div>
          <h1>รายละเอียดการรับชำระรายได้อื่น ๆ</h1>
          <div class="muted">เอกสาร <b>${esc(allocDoc.income_doc_no)}</b> · วันที่ ${fmtDate(allocDoc.doc_date)}${allocDoc.reference_no ? ` · อ้างอิง ${esc(allocDoc.reference_no)}` : ""}</div>
          <div class="muted">ประเภท: ${esc(allocCategory)} — ${esc(catName)}</div>
        </div>
        <div style="text-align:right">
          <div><b>${esc(allocDoc.customer_name)}</b></div>
          <div class="muted">ยอดรวม VAT: <b>${fmt(allocDoc.total)}</b> · ยอดสุทธิ: ${fmt(allocDoc.net_to_pay || allocDoc.total)}</div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th style="width:30px;text-align:center">#</th><th>เลขที่ใบกำกับ/ใบขาย</th><th style="text-align:center">วันที่ขาย</th>
          <th>รุ่น</th><th>เลขเครื่อง</th><th>เลขตัวถัง</th><th>ชื่อลูกค้า (ใบขาย)</th>
          <th style="text-align:right;width:90px">จำนวนรับ</th><th style="width:110px">หมายเหตุ</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="9" style="text-align:center;color:#9ca3af">ไม่มีรายการ</td></tr>`}</tbody>
        <tfoot><tr>
          <td colspan="7" style="text-align:right">รวมที่กระจาย ${allocLines.length} คัน</td>
          <td style="text-align:right">${fmt(sum)}</td>
          <td>${Math.abs(diff) < 0.01 ? "✓ ตรงเป้าหมาย" : `ต่างจากเป้าหมาย ${fmt(diff)}`}</td>
        </tr></tfoot>
      </table>
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  }

  // ลบ — ลบถาวร (เฉพาะเอกสารที่ยังไม่ชำระ)
  async function handleDelete(d) {
    if (!window.confirm(`ลบเอกสาร ${d.income_doc_no}?\n⚠️ ลบถาวร กู้คืนไม่ได้`)) return;
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "income_record", op: "delete", income_doc_id: d.income_doc_id }),
      });
      const data = await res.json();
      const deleted = Number(data?.deleted ?? data?.[0]?.deleted ?? 0);
      if (deleted > 0) { setMessage("✅ ลบเรียบร้อย"); fetchDocs(); }
      else setMessage("❌ ลบไม่ได้ (เอกสารที่ชำระแล้วต้องยกเลิกใบรับเงินก่อน)");
    } catch (e) { setMessage("❌ ลบไม่สำเร็จ: " + e.message); }
  }

  const kw = search.trim().toLowerCase();
  const filtered = docs.filter(d => {
    if (filterAff && String(d.affiliation || "") !== filterAff) return false;
    if (!kw) return true;
    const hay = [d.income_doc_no, d.customer_name, d.reference_no, d.description].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const totalAll = filtered.reduce((s, d) => s + Number(d.total || 0), 0);

  // Tab data
  const draftDocs = filtered.filter(d => (d.status || "draft") === "draft");
  const paidDocs = filtered.filter(d => d.status === "paid");
  // ยอดที่ต้องรับ = ส่วนที่ค้างจริง (ใบที่รับบางส่วนไปแล้ว เช่นหักกลบจากหน้าค่าใช้จ่าย เหลือเท่าไหร่รับเท่านั้น)
  const docRemaining = (d) => d.remaining_amount != null
    ? Number(d.remaining_amount)
    : Math.max(0, Number(d.net_to_pay || d.total || 0) - Number(d.received_amount || 0));
  // Group paid by paid_doc_no
  const paidGroups = {};
  paidDocs.forEach(d => {
    const key = d.paid_doc_no || `_${d.income_doc_id}`;
    if (!paidGroups[key]) paidGroups[key] = {
      paid_doc_no: d.paid_doc_no, paid_at: d.paid_at, payment_method: d.payment_method, from_bank_account_id: d.from_bank_account_id,
      items: [], total: 0, net: 0, wht: 0, expected: 0,
      // ยอดเงินที่รับจริงของใบรับเงินนี้ (รวมจาก income_payment_breakdowns — ใบที่หักกลบบางส่วนมาก่อน จะน้อยกว่ายอดใบ)
      received: Number(d.paid_doc_amount || 0),
      breakdowns: Array.isArray(d.paid_breakdowns) ? d.paid_breakdowns : [],
    };
    paidGroups[key].items.push(d);
    paidGroups[key].total += Number(d.total || 0);
    paidGroups[key].net += Number(d.net_to_pay || d.total || 0);
    paidGroups[key].wht += Number(d.wht_amount || 0);
    paidGroups[key].expected += docRemaining(d);
  });
  const paidGroupsList = Object.values(paidGroups);
  // ยอดที่โชว์ต่อใบรับเงิน: ใช้ยอดรับจริงก่อน → ยอดค้าง ณ ตอนรับ → ยอดสุทธิรวม (ใบเก่าที่ไม่มี breakdown)
  const receiptAmount = (g) => g.received > 0 ? g.received : (g.expected > 0 ? g.expected : g.net);

  const selectedIds = Object.keys(selected).filter(k => selected[k]).map(Number);
  const selectedRows = draftDocs.filter(d => selectedIds.includes(d.income_doc_id));
  const selectedNet = selectedRows.reduce((s, d) => s + docRemaining(d), 0);

  function toggleOne(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (draftDocs.every(d => selected[d.income_doc_id])) { setSelected({}); return; }
    const next = {};
    draftDocs.forEach(d => { next[d.income_doc_id] = true; });
    setSelected(next);
  }
  async function fetchAvailableCreditNotes() {
    setLoadingCreditNotes(true);
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_unused_credit_notes" }),
      });
      const data = await res.json();
      setAvailableCreditNotes(Array.isArray(data) ? data : (data?.rows || []));
    } catch { setAvailableCreditNotes([]); }
    setLoadingCreditNotes(false);
  }
  // ชื่อ normalize สำหรับจับคู่ ลูกค้า(รายได้) ↔ ผู้จำหน่าย(ค่าใช้จ่าย)
  const normName = (s) => String(s || "").replace(/\s+/g, " ").trim();
  // จับคู่ชื่อแบบยืดหยุ่น: ตัดคำนำหน้า/ประเภทนิติบุคคลออกก่อน แล้วเทียบเป็นรายคำ
  // (ข้อมูลจริงสะกดไม่ตรงกันเป๊ะ เช่น "หจก. ไนซ์ เอฟเอ็ม วังน้อย" ↔ "ห้างหุ้นส่วนจำกัด ไนซ์ แอฟเอ็ม วังน้อย")
  const ENTITY_WORDS = ["ห้างหุ้นส่วนจำกัด", "หจก", "บริษัท", "บจก", "บมจ", "จำกัด", "มหาชน", "ร้าน", "นางสาว", "นาง", "นาย", "คุณ"];
  function nameTokens(s) {
    let t = String(s || "").replace(/[().,/\\-]/g, " ");
    ENTITY_WORDS.forEach(w => { t = t.split(w).join(" "); });
    return t.split(/\s+/).filter(x => x.length > 1);
  }
  // ตรงกัน ≥ 2 คำ (ชื่อสั้นคำเดียวต้องตรงทั้งคำ) และพลาดได้ไม่เกิน 1 คำจากชื่อฝั่งที่สั้นกว่า
  function namesMatch(a, b) {
    const ta = nameTokens(a), tb = nameTokens(b);
    if (!ta.length || !tb.length) return false;
    const shared = ta.filter(x => tb.includes(x)).length;
    const minLen = Math.min(ta.length, tb.length);
    return shared >= Math.min(2, minLen) && shared >= minLen - 1;
  }
  const expenseNet = (d) => Number(d.net_to_pay || d.total || 0);
  async function fetchExpenseDocs() {
    try {
      const res = await fetch(ACCOUNTING_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "expense_record", op: "list" }),
      });
      const data = await res.json();
      // เฉพาะใบร่าง (ยังไม่จ่าย) — ฝั่งค่าใช้จ่ายไม่มีจ่ายบางส่วน จึงต้องหักกลบเต็มใบเท่านั้น
      setExpenseDocs((Array.isArray(data) ? data : []).filter(d =>
        d && d.expense_doc_id && (d.status || "draft") === "draft" && expenseNet(d) > 0));
    } catch { setExpenseDocs([]); }
  }
  function openPayDialog() {
    if (selectedIds.length === 0) { setMessage("❌ เลือกเอกสารก่อน"); return; }
    setEditPayDocNo(null);
    setEditTotalRequired(0);
    setPayForm({ paid_date: todayISO(), payment_note: "" });
    setPayments([{ method: "โอน", amount: Number(selectedNet) || 0, from_bank_account_id: "", credit_note_no: "" }]);
    setPayCustomerNames([...new Set(selectedRows.map(d => normName(d.customer_name)).filter(Boolean))]);
    setPayDialog(true);
    fetchAvailableCreditNotes();
    fetchExpenseDocs();
  }
  function openEditPayDialog(g) {
    if (!g.paid_doc_no) return;
    // ยอดที่ต้องรับของใบนี้ = ยอดค้างจริง ณ ตอนรับ (ใบที่หักกลบบางส่วนไปก่อน คิดเฉพาะส่วนที่เหลือ) ไม่ใช่ยอดสุทธิเต็มใบ
    const total = g.expected > 0 ? Number(g.expected) : Number(g.net || g.total || 0);
    setEditPayDocNo(g.paid_doc_no);
    setEditTotalRequired(total);
    setPayForm({
      paid_date: g.paid_at ? String(g.paid_at).slice(0, 10) : todayISO(),
      payment_note: "",
    });
    // prefill จาก breakdown จริงใน DB — ถ้าไม่มี (ใบเก่า) ค่อย fallback เป็นแถวเดียวเท่ายอดที่ต้องรับ
    const bds = (g.breakdowns || []).filter(x => Number(x.amount) > 0);
    if (bds.length > 0) {
      setPayments(bds.map(x => ({
        method: x.method || "โอน",
        amount: Number(x.amount) || 0,
        from_bank_account_id: x.from_bank_account_id || (x.method === "โอน" ? g.from_bank_account_id || "" : ""),
        credit_note_no: x.credit_note_no || "",
      })));
    } else {
      const method = g.payment_method && g.payment_method !== "ผสม" ? g.payment_method : "โอน";
      setPayments([{ method, amount: total, from_bank_account_id: g.from_bank_account_id || "", credit_note_no: "" }]);
    }
    setPayCustomerNames([...new Set((g.items || []).map(d => normName(d.customer_name)).filter(Boolean))]);
    setPayDialog(true);
    fetchAvailableCreditNotes();
    fetchExpenseDocs();
  }
  function updatePayment(idx, patch) {
    setPayments(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  }
  function addPayment() {
    setPayments(prev => [...prev, { method: "เงินสด", amount: 0, from_bank_account_id: "", credit_note_no: "" }]);
  }
  function removePayment(idx) {
    setPayments(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  }
  async function savePayment() {
    const totalRequired = editPayDocNo ? Number(editTotalRequired) || 0 : Number(selectedNet) || 0;
    const sum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (Math.abs(sum - totalRequired) > 0.01) {
      setMessage(`❌ ยอดรวมของวิธีรับเงิน (${sum.toFixed(2)}) ต้องเท่ากับยอดที่จะรับ (${totalRequired.toFixed(2)})`);
      return;
    }
    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      if (!p.method) { setMessage(`❌ แถวที่ ${i + 1}: เลือกวิธีรับเงิน`); return; }
      if (Number(p.amount) <= 0) { setMessage(`❌ แถวที่ ${i + 1}: จำนวนเงินต้องมากกว่า 0`); return; }
      if (p.method === "โอน" && !p.from_bank_account_id) {
        setMessage(`❌ แถวที่ ${i + 1} (โอน): เลือกบัญชี`); return;
      }
      if (p.method === "ใบลดหนี้" && !p.credit_note_no) {
        setMessage(`❌ แถวที่ ${i + 1} (ใบลดหนี้): เลือกเลขใบลดหนี้`); return;
      }
      // โหมดแก้ไข: ใบค่าใช้จ่ายถูกหักกลบ (จ่าย) ไปแล้วตอนสร้าง — ไม่ต้องเลือกซ้ำ/ไม่ยิงจ่ายซ้ำ
      if (p.method === "หักกลบค่าใช้จ่าย" && !editPayDocNo) {
        if (!p.expense_doc_id) { setMessage(`❌ แถวที่ ${i + 1} (ค่าใช้จ่ายค้างชำระ): เลือกใบค่าใช้จ่ายที่จะหักกลบ`); return; }
        const doc = expenseDocs.find(d => String(d.expense_doc_id) === String(p.expense_doc_id));
        // ฝั่งค่าใช้จ่ายไม่มีจ่ายบางส่วน — ยอดหักกลบต้องเท่ายอดใบค่าใช้จ่ายเต็มใบ
        if (doc && Math.abs(Number(p.amount) - expenseNet(doc)) > 0.005) {
          setMessage(`❌ แถวที่ ${i + 1} (ค่าใช้จ่ายค้างชำระ): ยอดต้องเท่ายอดใบ ${p.expense_doc_no} เต็มใบ (${fmt(expenseNet(doc))})`); return;
        }
      }
    }
    setSavingPay(true);
    try {
      const single = payments.length === 1 ? payments[0] : null;
      // หักกลบค่าใช้จ่าย — ต่อเลขใบค่าใช้จ่ายเข้าหมายเหตุ (ไว้ trace)
      const offsetLines = payments.filter(p => p.method === "หักกลบค่าใช้จ่าย" && p.expense_doc_id);
      const offsetNotes = offsetLines.map(p => `หักกลบค่าใช้จ่าย ${p.expense_doc_no || p.expense_doc_id}`);
      const noteWithOffset = [payForm.payment_note, ...offsetNotes].filter(Boolean).join(" · ");
      const body = {
        action: "income_record",
        op: editPayDocNo ? "edit_payment" : "save_payment",
        paid_doc_no: editPayDocNo || undefined,
        income_doc_ids: editPayDocNo ? undefined : selectedIds,
        paid_date: payForm.paid_date,
        payment_method: single ? single.method : "ผสม",
        payment_note: noteWithOffset,
        from_bank_account_id: single && single.method === "โอน" ? (Number(single.from_bank_account_id) || null) : null,
        paid_by: currentUser?.username || currentUser?.name || "system",
        // multi-method breakdown
        payments: payments.map(p => ({
          method: p.method,
          amount: Number(p.amount) || 0,
          from_bank_account_id: p.method === "โอน" ? (Number(p.from_bank_account_id) || null) : null,
          credit_note_no: p.method === "ใบลดหนี้" ? p.credit_note_no : null,
        })),
      };
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const ircNo = data?.paid_doc_no || data?.[0]?.paid_doc_no || "";
      // บันทึกจ่ายฝั่งค่าใช้จ่ายอัตโนมัติ (mark ใบค่าใช้จ่ายเป็นจ่ายแล้ว วิธี "หักกลบรายได้")
      // เฉพาะตอนสร้างใบรับเงินใหม่ กันยิงซ้ำตอนแก้ไข
      let expMsg = "";
      if (!editPayDocNo && offsetLines.length > 0) {
        for (const p of offsetLines) {
          try {
            const r2 = await fetch(ACCOUNTING_URL, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "expense_record", op: "save_payment",
                expense_doc_ids: [Number(p.expense_doc_id)],
                paid_date: payForm.paid_date,
                payment_method: "หักกลบรายได้",
                payment_note: `หักกลบใบรับเงินรายได้ ${ircNo}`,
                from_bank_account_id: null,
                paid_by: currentUser?.username || currentUser?.name || "system",
                payments: [{ method: "หักกลบรายได้", amount: Number(p.amount) || 0, from_bank_account_id: null }],
              }),
            });
            const d2 = await r2.json().catch(() => ({}));
            const row = Array.isArray(d2) ? d2[0] : d2;
            const expPayNo = row?.paid_doc_no || "";
            expMsg += ` · จ่ายค่าใช้จ่าย ${p.expense_doc_no} แล้ว${expPayNo ? ` (${expPayNo})` : ""}`;
          } catch {
            expMsg += ` · ⚠️ หักกลบ ${p.expense_doc_no} ไม่สำเร็จ — ไปบันทึกจ่ายที่เมนูค่าใช้จ่ายเอง`;
          }
        }
      }
      setMessage(editPayDocNo ? "✅ แก้ไขใบจ่ายเรียบร้อย" : `✅ บันทึกรับเงินเรียบร้อย ${ircNo}${expMsg}`);
      setPayDialog(false);
      setEditPayDocNo(null);
      setSelected({});
      fetchDocs();
    } catch (e) { setMessage("❌ " + e.message); }
    setSavingPay(false);
  }
  async function cancelPaymentGroup(g) {
    if (!g.paid_doc_no) return;
    if (!window.confirm(`ยกเลิกใบรับเงิน ${g.paid_doc_no}?\nเอกสาร ${g.items.length} ใบจะกลับเป็น "ร่าง"`)) return;
    try {
      await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "income_record", op: "cancel_payment", paid_doc_no: g.paid_doc_no }),
      });
      setMessage("✅ ยกเลิกใบจ่ายเรียบร้อย");
      fetchDocs();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💵 บันทึกรายได้อื่น ๆ</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2",
          color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 14 }}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["draft", "📑 รายการรายได้"],
          ["pay", "💵 บันทึกรับเงิน"],
          ["allocation", "📝 รายละเอียดการรับชำระ"],
          ["history", "📋 ประวัติการรับเงิน"],
        ].map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setSelected({}); }}
            style={{ padding: "10px 18px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: tab === k ? "#072d6b" : "#6b7280",
              borderBottom: tab === k ? "3px solid #072d6b" : "3px solid transparent",
              marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label>วันที่:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <select value={filterAff} onChange={e => setFilterAff(e.target.value)} style={inp} title="กรองตามสังกัด">
          <option value="">🏢 สังกัด: ทั้งหมด</option>
          <option value="ป.เปา">ป.เปา</option>
          <option value="สิงห์ชัย">สิงห์ชัย</option>
        </select>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 ค้นหา (เลขเอกสาร / Customer / รายละเอียด)"
          style={{ ...inp, flex: 1, minWidth: 200 }} />
        <button onClick={fetchDocs} style={btn("#0369a1")}>🔄 รีเฟรช</button>
        {tab === "draft" && <button onClick={openCreate} style={btn("#059669")}>+ เพิ่มรายได้</button>}
        {tab === "draft" && <button onClick={openTfImport} style={btn("#92400e")}>📥 นำเข้าจากใบกำกับ TF</button>}
      </div>

      {/* TAB: รายการรายได้ (ทั้งหมด) */}
      {tab === "draft" && (
        <>
          <div style={{ display: "flex", gap: 14, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
            <span>📑 เอกสาร: <strong>{filtered.length}</strong></span>
            <span style={{ color: "#dc2626" }}>💰 ยอดรวม: <strong>{fmt(totalAll)}</strong> บาท</span>
          </div>
          <DocsTable docs={filtered} loading={loading} openEdit={openEdit} handleCancel={handleCancel} openDuplicate={openDuplicate} handlePrint={handlePrint} handleDelete={handleDelete} handleClearReceived={handleClearReceived} showCheckbox={false} />
        </>
      )}

      {/* TAB: บันทึกรับเงิน — เฉพาะ draft + checkbox + ปุ่มจ่าย */}
      {tab === "pay" && (
        <>
          <div style={{ padding: "10px 14px", background: "#fef9c3", border: "1px solid #fcd34d", borderRadius: 10, marginBottom: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span>เลือก: <strong>{selectedIds.length}</strong> / {draftDocs.length} เอกสาร</span>
            <span style={{ color: "#dc2626" }}>ยอดรวม: <strong>{fmt(selectedNet)}</strong> บาท</span>
            <div style={{ flex: 1 }} />
            <button onClick={openFtImport} style={btn("#7c3aed")}>
              💰 บันทึกรับชำระจากไฟแนนท์
            </button>
            <button onClick={openPayDialog} disabled={selectedIds.length === 0}
              style={{ ...btn(selectedIds.length === 0 ? "#9ca3af" : "#059669"), cursor: selectedIds.length === 0 ? "not-allowed" : "pointer" }}>
              💵 บันทึกรับเงิน
            </button>
          </div>
          <DocsTable docs={draftDocs} loading={loading} openEdit={openEdit} handleCancel={handleCancel} openDuplicate={openDuplicate} handlePrint={handlePrint} handleDelete={handleDelete} handleClearReceived={handleClearReceived} showCheckbox={true} selected={selected} toggleOne={toggleOne} toggleAll={toggleAll} />
        </>
      )}

      {/* TAB: รายละเอียดการรับชำระ — เลือกรายการ paid → แตกย่อยตาม moto_sales */}
      {tab === "allocation" && (
        <>
          <div style={{ padding: "10px 14px", background: "#ede9fe", border: "1px solid #c4b5fd", borderRadius: 10, marginBottom: 12, fontSize: 13, color: "#5b21b6" }}>
            💡 รายการที่ <strong>ชำระเงินแล้ว</strong> (status = paid) — คลิก "📝 บันทึกรายละเอียด" เพื่อแตกยอดตามรถที่ขายแต่ละคัน
          </div>
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
            {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
             paidDocs.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการที่ชำระแล้ว</div> :
             <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#072d6b", color: "#fff" }}>
                <tr>
                  <th style={th}>เลขเอกสาร</th>
                  <th style={th}>วันที่</th>
                  <th style={th}>Customer</th>
                  <th style={th}>เลขที่อ้างอิง</th>
                  <th style={th}>รายละเอียด</th>
                  <th style={{ ...th, textAlign: "right" }}>ยอดสุทธิ</th>
                  <th style={th}>เลขจ่าย</th>
                  <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {paidDocs.map(d => (
                  <tr key={d.income_doc_id} style={{ borderTop: "1px solid #e5e7eb", background: "#f0fdf4" }}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#072d6b" }}>{d.income_doc_no}</td>
                    <td style={td}>{fmtDate(d.doc_date)}</td>
                    <td style={td}>{d.customer_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#0369a1" }}>{d.reference_no || "-"}</td>
                    <td style={{ ...td, fontSize: 12 }}>{d.description || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#065f46" }}>{fmt(d.net_to_pay || d.total)}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{d.paid_doc_no || "-"}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <button onClick={() => openAllocation(d)} style={btn("#7c3aed")}>📝 รายละเอียด</button>
                    </td>
                  </tr>
                ))}
              </tbody>
             </table>}
          </div>
        </>
      )}

      {/* TAB: ประวัติการรับเงิน */}
      {tab === "history" && (
        <>
          <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
            <span>💵 ใบรับเงิน: <strong>{paidGroupsList.length}</strong></span>
            <span style={{ marginLeft: 14, color: "#dc2626" }}>ยอดรวม: <strong>{fmt(paidGroupsList.reduce((s, g) => s + receiptAmount(g), 0))}</strong> บาท</span>
          </div>
          {paidGroupsList.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>ยังไม่มีประวัติ</div>
          ) : paidGroupsList.map(g => {
            const bank = bankAccounts.find(a => Number(a.account_id) === Number(g.from_bank_account_id));
            return (
              <div key={g.paid_doc_no} style={{ marginBottom: 12, background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <strong style={{ fontFamily: "monospace", color: "#065f46", fontSize: 15 }}>{g.paid_doc_no || "-"}</strong>
                  <span style={{ fontSize: 12 }}>📅 {fmtDate(g.paid_at)}</span>
                  <span style={{ fontSize: 12 }}>💳 {g.payment_method || "-"}</span>
                  {bank && <span style={{ fontSize: 12 }}>🏦 {bank.bank_name} · {bank.account_no}</span>}
                  <span style={{ marginLeft: "auto", fontWeight: 700, color: "#065f46" }}>
                    {g.items.length} ใบ · {fmt(receiptAmount(g))}
                    {receiptAmount(g) < g.net - 0.01 && (
                      <span style={{ fontWeight: 400, fontSize: 11, color: "#6b7280" }}> (ยอดใบรวม {fmt(g.net)} — รับบางส่วนมาก่อนแล้ว)</span>
                    )}
                  </span>
                  <button onClick={() => openEditPayDialog(g)} style={{ ...btnSm, background: "#0369a1" }}>✏️ แก้ไข</button>
                  <button onClick={() => cancelPaymentGroup(g)} style={{ ...btnSm, background: "#dc2626" }}>✕ ยกเลิก</button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 8, background: "#fff", borderRadius: 6, overflow: "hidden" }}>
                  <thead style={{ background: "#f3f4f6" }}>
                    <tr>
                      <th style={th}>เลขเอกสาร</th>
                      <th style={th}>วันที่</th>
                      <th style={th}>Customer</th>
                      <th style={th}>รายละเอียด</th>
                      <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                      <th style={{ ...th, textAlign: "right" }}>WHT</th>
                      <th style={{ ...th, textAlign: "right" }}>ยอดสุทธิ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map(d => (
                      <tr key={d.income_doc_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{d.income_doc_no}</td>
                        <td style={td}>{fmtDate(d.doc_date)}</td>
                        <td style={td}>{d.customer_name || "-"}</td>
                        <td style={{ ...td, color: "#6b7280", fontSize: 12 }}>{d.description || "-"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmt(d.total)}</td>
                        <td style={{ ...td, textAlign: "right", color: "#dc2626" }}>{Number(d.wht_amount) > 0 ? fmt(d.wht_amount) : "-"}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#059669" }}>{fmt(d.net_to_pay || d.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </>
      )}

      {/* Form Modal */}
      {showForm && <FormModal
        form={form} setForm={setForm} editTarget={editTarget}
        customers={customers} incomeCategories={incomeCategories} bankAccounts={bankAccounts}
        onAddCustomer={() => setCustModal(true)}
        onCustomerChange={onCustomerChange}
        onItemChange={onItemChange} addItem={addItem} removeItem={removeItem}
        subtotal={subtotal} discountAmount={discountAmount} vatAmount={vatAmount}
        totalIncVat={totalIncVat} whtBase={whtBase} whtAmount={whtAmount} netToPay={netToPay}
        onClose={closeForm} onSave={handleSave} saving={saving}
      />}

      {/* Quick-add Customer Modal (ซ้อนบน FormModal) */}
      {custModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500 }}
          onClick={() => !custSaving && setCustModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 20, borderRadius: 12, width: 460, maxWidth: "94vw" }}>
            <h3 style={{ margin: "0 0 14px", color: "#15803d" }}>➕ เพิ่มลูกค้าใหม่</h3>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>คำนำหน้า</label>
                <select value={custForm.title} onChange={e => setCustForm(f => ({ ...f, title: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }}>
                  <option value="">—</option>
                  {["นาย", "นาง", "นางสาว", "บจก.", "บมจ.", "หจก.", "บริษัท", "ร้าน", "กองทุนรวม"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>ชื่อ / ชื่อบริษัท *</label>
                <input value={custForm.first_name} onChange={e => setCustForm(f => ({ ...f, first_name: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" }} autoFocus />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>นามสกุล (บุคคล)</label>
                <input value={custForm.last_name} onChange={e => setCustForm(f => ({ ...f, last_name: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>เลขบัตร ปชช. / เลขผู้เสียภาษี</label>
                <input value={custForm.id_number} onChange={e => setCustForm(f => ({ ...f, id_number: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>เบอร์โทร</label>
                <input value={custForm.phone} onChange={e => setCustForm(f => ({ ...f, phone: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>ที่อยู่</label>
                <input value={custForm.address} onChange={e => setCustForm(f => ({ ...f, address: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" }} placeholder="ที่อยู่บรรทัดเดียว" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setCustModal(false)} disabled={custSaving} style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={saveQuickCustomer} disabled={custSaving} style={{ padding: "8px 20px", background: custSaving ? "#9ca3af" : "#15803d", color: "#fff", border: "none", borderRadius: 8, cursor: custSaving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {custSaving ? "💾 ..." : "💾 บันทึกลูกค้า"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      {payDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !savingPay && setPayDialog(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 720, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto", overflowX: "hidden", boxSizing: "border-box" }}>
            <h3 style={{ margin: "0 0 14px", color: editPayDocNo ? "#7c3aed" : "#072d6b" }}>
              {editPayDocNo ? `✏️ แก้ไขใบรับเงิน — ${editPayDocNo}` : "💵 บันทึกรับเงิน"}
            </h3>
            {!editPayDocNo && (
              <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                <div>📑 เอกสาร: <b>{selectedIds.length}</b> ใบ</div>
                <div>💰 ยอดสุทธิ: <b style={{ color: "#dc2626", fontSize: 18 }}>฿ {fmt(selectedNet)}</b></div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>วันที่รับ *</label>
                <input type="date" value={payForm.paid_date} onChange={e => setPayForm(p => ({ ...p, paid_date: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={payForm.payment_note} onChange={e => setPayForm(p => ({ ...p, payment_note: e.target.value }))} rows={2} style={inp} />
              </div>
            </div>

            {/* Multi-method payment table */}
            {(() => {
              const totalRequired = editPayDocNo ? Number(editTotalRequired) || 0 : Number(selectedNet) || 0;
              const sum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
              const diff = totalRequired - sum;
              const exact = Math.abs(diff) < 0.01;
              return (
                <div style={{ marginTop: 14, padding: 12, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>💳 วิธีรับเงิน</div>
                    <button type="button" onClick={addPayment}
                      style={{ padding: "5px 10px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      + เพิ่มวิธี
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {payments.map((p, idx) => {
                      // เลือกใบลดหนี้ — set amount ตามใบที่เลือก
                      const onCnSelect = (cnNo) => {
                        const cn = availableCreditNotes.find(c => c.credit_note_no === cnNo);
                        if (cn) {
                          updatePayment(idx, { credit_note_no: cnNo, amount: Number(cn.amount) || 0 });
                        } else {
                          updatePayment(idx, { credit_note_no: cnNo });
                        }
                      };
                      // exclude credit notes ที่ถูกเลือกในแถวอื่นแล้ว
                      const usedCnInOtherRows = payments.filter((_, i) => i !== idx).map(x => x.credit_note_no).filter(Boolean);
                      // ใบค่าใช้จ่ายค้างจ่ายที่ชื่อผู้จำหน่ายตรงกับลูกค้าของใบรายได้ที่เลือก — exclude ที่ถูกเลือกในแถวอื่น
                      const usedExpInOtherRows = payments.filter((_, i) => i !== idx).map(x => String(x.expense_doc_id || "")).filter(Boolean);
                      const matchedExpenseDocs = expenseDocs.filter(d =>
                        payCustomerNames.some(n => namesMatch(n, d.vendor_name)) && !usedExpInOtherRows.includes(String(d.expense_doc_id)));
                      const onExpSelect = (val) => {
                        const doc = expenseDocs.find(d => String(d.expense_doc_id) === val);
                        updatePayment(idx, { expense_doc_id: val, expense_doc_no: doc?.expense_doc_no || "", amount: doc ? expenseNet(doc) : 0 });
                      };
                      const lockAmount = p.method === "ใบลดหนี้" || p.method === "หักกลบค่าใช้จ่าย";
                      return (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "110px 110px minmax(0, 1fr) 30px", gap: 8, alignItems: "center", minWidth: 0 }}>
                        <select value={p.method}
                          onChange={e => updatePayment(idx, { method: e.target.value, from_bank_account_id: e.target.value === "โอน" ? p.from_bank_account_id : "", credit_note_no: e.target.value === "ใบลดหนี้" ? p.credit_note_no : "", expense_doc_id: e.target.value === "หักกลบค่าใช้จ่าย" ? p.expense_doc_id : "", expense_doc_no: e.target.value === "หักกลบค่าใช้จ่าย" ? p.expense_doc_no : "" })}
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }}>
                          <option value="โอน">เงินโอน</option>
                          <option value="เงินสด">เงินสด</option>
                          <option value="เช็ค">เช็ค</option>
                          <option value="ใบลดหนี้">ใบลดหนี้</option>
                          <option value="หักกลบค่าใช้จ่าย">ค่าใช้จ่ายค้างชำระ (หักกลบ)</option>
                          <option value="ค่าธรรมเนียมรับโอน">ค่าธรรมเนียมรับโอนเงิน</option>
                          {p.method && !["โอน", "เงินสด", "เช็ค", "ใบลดหนี้", "หักกลบค่าใช้จ่าย", "ค่าธรรมเนียมรับโอน"].includes(p.method) && (
                            <option value={p.method}>{p.method}</option>
                          )}
                        </select>
                        <input type="number" step="0.01" min="0" value={p.amount}
                          onChange={e => updatePayment(idx, { amount: e.target.value })}
                          placeholder="0.00"
                          readOnly={lockAmount}
                          title={p.method === "ใบลดหนี้" ? "จำนวนเงินจะถูกตั้งจากใบลดหนี้ที่เลือก" : p.method === "หักกลบค่าใช้จ่าย" ? "จำนวนเงิน = ยอดใบค่าใช้จ่ายเต็มใบ (ฝั่งค่าใช้จ่ายไม่มีจ่ายบางส่วน)" : ""}
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, textAlign: "right", background: lockAmount ? "#f3f4f6" : "#fff" }} />
                        {p.method === "โอน" ? (
                          <select value={p.from_bank_account_id || ""}
                            onChange={e => updatePayment(idx, { from_bank_account_id: e.target.value })}
                            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }}>
                            <option value="">-- เลือกบัญชีรับเข้า --</option>
                            {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
                          </select>
                        ) : p.method === "ใบลดหนี้" ? (
                          <select value={p.credit_note_no || ""}
                            onChange={e => onCnSelect(e.target.value)}
                            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #fb923c", fontFamily: "Tahoma", fontSize: 13, background: "#fff7ed" }}>
                            <option value="">{loadingCreditNotes ? "กำลังโหลด..." : "-- เลือกใบลดหนี้รับ --"}</option>
                            {availableCreditNotes
                              .filter(cn => !usedCnInOtherRows.includes(cn.credit_note_no))
                              .map(cn => (
                                <option key={cn.credit_note_no} value={cn.credit_note_no}
                                  title={`${cn.credit_note_no} | ฿${fmt(cn.amount)} | ${cn.vendor_name || "-"} | ${fmtDate(cn.credit_note_date)}`}>
                                  {cn.credit_note_no} · ฿{fmt(cn.amount)} · {fmtDate(cn.credit_note_date)}
                                </option>
                              ))}
                          </select>
                        ) : p.method === "หักกลบค่าใช้จ่าย" ? (
                          editPayDocNo ? (
                            <div style={{ padding: "7px 10px", fontSize: 12, color: "#0369a1", background: "#f0f9ff", border: "1px dashed #38bdf8", borderRadius: 6 }}>
                              🔗 หักกลบใบค่าใช้จ่ายไปแล้วตอนสร้างใบรับเงิน — แก้ไขไม่กระทบฝั่งค่าใช้จ่าย
                            </div>
                          ) : (
                          <select value={p.expense_doc_id || ""}
                            onChange={e => onExpSelect(e.target.value)}
                            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #38bdf8", fontFamily: "Tahoma", fontSize: 13, background: "#f0f9ff", minWidth: 0 }}>
                            <option value="">{matchedExpenseDocs.length === 0 ? "ไม่มีใบค่าใช้จ่ายค้างจ่ายที่ชื่อตรงกัน" : "-- เลือกใบค่าใช้จ่ายที่จะหักกลบ --"}</option>
                            {matchedExpenseDocs.map(d => (
                              <option key={d.expense_doc_id} value={d.expense_doc_id}
                                title={`${d.expense_doc_no} | ${d.vendor_name || "-"} | ฿${fmt(expenseNet(d))} | ${fmtDate(d.doc_date)}`}>
                                {d.expense_doc_no} · {d.vendor_name || "-"} · ฿{fmt(expenseNet(d))} · {fmtDate(d.doc_date)}
                              </option>
                            ))}
                          </select>
                          )
                        ) : (
                          <div style={{ padding: "7px 10px", color: "#9ca3af", fontSize: 12 }}>—</div>
                        )}
                        <button type="button" onClick={() => removePayment(idx)} disabled={payments.length === 1}
                          title="ลบแถวนี้"
                          style={{ padding: "5px 8px", background: payments.length === 1 ? "#e5e7eb" : "#fee2e2", color: "#991b1b", border: "none", borderRadius: 6, cursor: payments.length === 1 ? "not-allowed" : "pointer", fontSize: 14 }}>
                          ✕
                        </button>
                      </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 10, padding: "8px 12px", background: exact ? "#d1fae5" : Math.abs(diff) > 0 ? "#fef9c3" : "#fff", borderRadius: 6, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                    <span>ยอดที่ต้องรับ: <strong>฿ {fmt(totalRequired)}</strong></span>
                    <span>รวมที่ระบุ: <strong style={{ color: exact ? "#065f46" : "#dc2626" }}>฿ {fmt(sum)}</strong></span>
                    <span style={{ fontWeight: 700, color: exact ? "#065f46" : "#dc2626" }}>
                      {exact ? "✓ ครบ" : diff > 0 ? `ขาดอีก ฿ ${fmt(diff)}` : `เกิน ฿ ${fmt(-diff)}`}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => { setPayDialog(false); setEditPayDocNo(null); }} disabled={savingPay}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              {(() => {
                const totalRequired = editPayDocNo ? Number(editTotalRequired) || 0 : Number(selectedNet) || 0;
                const sum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                const exact = Math.abs(sum - totalRequired) < 0.01;
                const disabled = savingPay || !exact;
                return (
              <button onClick={savePayment} disabled={disabled}
                title={!exact ? "ยอดรวมต้องเท่ากับยอดที่จะรับ" : ""}
                style={{ padding: "8px 20px", background: disabled ? "#9ca3af" : (editPayDocNo ? "#7c3aed" : "#059669"), color: "#fff", border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {savingPay ? "กำลังบันทึก..." : (editPayDocNo ? "💾 บันทึกแก้ไข" : "💾 บันทึกรับเงิน")}
              </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TF Import Modal */}
      {tfImportOpen && (
        <div onClick={() => !tfImporting && setTfImportOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, padding: 20, width: "90%", maxWidth: 900, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: "#92400e" }}>📥 นำเข้าใบกำกับภาษีรายได้อื่นๆ (TF) → income_records</h3>
              <button onClick={() => setTfImportOpen(false)} disabled={tfImporting} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>

            {tfLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
            ) : tfList.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>ไม่มีใบกำกับที่ยังไม่ถูกนำเข้า</div>
            ) : (() => {
              // กรองสาขา + ค้นหา (ชื่อลูกค้า / เลขใบกำกับ / Tax ID)
              const kw = tfSearch.trim().toLowerCase();
              const tfShown = tfList.filter(t =>
                (!tfBranchFilter || String(t.branch || "") === tfBranchFilter) &&
                (!kw || [t.customer_name, t.tax_invoice_no, t.customer_tax_id].filter(Boolean).join(" ").toLowerCase().includes(kw)));
              const tfBranches = [...new Set(tfList.map(t => String(t.branch || "")).filter(Boolean))].sort();
              return (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8, padding: "8px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}>
                  <span style={{ fontSize: 13 }}>สาขา:</span>
                  <select value={tfBranchFilter} onChange={e => setTfBranchFilter(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }}>
                    <option value="">ทั้งหมด</option>
                    {tfBranches.map(b2 => <option key={b2} value={b2}>{b2}</option>)}
                  </select>
                  <input type="text" value={tfSearch} onChange={e => setTfSearch(e.target.value)}
                    placeholder="🔍 ค้นหา: ชื่อลูกค้า, เลขใบกำกับ, Tax ID"
                    style={{ flex: 1, minWidth: 200, padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
                  {(tfBranchFilter || kw) && (
                    <span style={{ fontSize: 12, color: "#92400e" }}>แสดง {tfShown.length} / {tfList.length} รายการ</span>
                  )}
                </div>
                <div style={{ marginBottom: 8, fontSize: 13 }}>
                  <label style={{ cursor: "pointer", fontWeight: 600 }}>
                    <input type="checkbox"
                      checked={tfShown.length > 0 && tfShown.every(t => tfSelected[t.tax_invoice_no])}
                      onChange={e => {
                        // เลือกทั้งหมด = เฉพาะรายการที่ผ่านตัวกรอง (คงการเลือกเดิมของรายการนอกตัวกรองไว้)
                        setTfSelected(prev => {
                          const next = { ...prev };
                          tfShown.forEach(t => { next[t.tax_invoice_no] = e.target.checked; });
                          return next;
                        });
                      }} /> เลือกทั้งหมด ({tfShown.length} รายการ)
                  </label>
                  <span style={{ marginLeft: 12, color: "#6b7280" }}>
                    เลือกแล้ว: <strong>{Object.values(tfSelected).filter(Boolean).length}</strong>
                  </span>
                </div>
                <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead style={{ background: "#fef3c7", position: "sticky", top: 0 }}>
                      <tr>
                        <th style={{ ...th, width: 30 }}></th>
                        <th style={th}>สาขา</th>
                        <th style={th}>เลขใบกำกับ</th>
                        <th style={th}>วันที่</th>
                        <th style={th}>ลูกค้า</th>
                        <th style={th}>Tax ID</th>
                        <th style={{ ...th, textAlign: "right" }}>ก่อน VAT</th>
                        <th style={{ ...th, textAlign: "right" }}>VAT</th>
                        <th style={{ ...th, textAlign: "right" }}>รวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tfShown.length === 0 && <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่พบรายการตามตัวกรอง</td></tr>}
                      {tfShown.map((t, i) => (
                        <tr key={t.tax_invoice_no} style={{ borderTop: "1px solid #f3f4f6", background: tfSelected[t.tax_invoice_no] ? "#fffbeb" : (i % 2 === 0 ? "#fff" : "#f9fafb") }}>
                          <td style={{ ...td, textAlign: "center" }}>
                            <input type="checkbox" checked={!!tfSelected[t.tax_invoice_no]} onChange={e => setTfSelected(prev => ({ ...prev, [t.tax_invoice_no]: e.target.checked }))} />
                          </td>
                          <td style={td}>{t.branch}</td>
                          <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#92400e" }}>{t.tax_invoice_no}</td>
                          <td style={td}>{fmtDate(t.invoice_date)}</td>
                          <td style={td}>{t.customer_name || "-"}</td>
                          <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{t.customer_tax_id || "-"}</td>
                          <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(t.amount_before_vat)}</td>
                          <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(t.vat_amount)}</td>
                          <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmt(t.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
              );
            })()}

            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setTfImportOpen(false)} disabled={tfImporting} style={btn("#6b7280")}>ยกเลิก</button>
              <button onClick={submitTfImport} disabled={tfImporting || Object.values(tfSelected).filter(Boolean).length === 0} style={btn("#92400e")}>
                {tfImporting ? "⏳ กำลังนำเข้า..." : `📥 นำเข้า ${Object.values(tfSelected).filter(Boolean).length} รายการ`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finance Transfer Import — รับชำระจากไฟแนนท์ (status = pending) */}
      {ftImportOpen && (
        <div onClick={() => !ftImporting && setFtImportOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, padding: 20, width: "90%", maxWidth: 900, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: "#7c3aed" }}>💰 บันทึกรับชำระจากไฟแนนท์ (รอตัดชำระ)</h3>
              <button onClick={() => setFtImportOpen(false)} disabled={ftImporting} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>

            <div style={{ padding: 10, background: "#f3e8ff", border: "1px solid #c4b5fd", borderRadius: 8, marginBottom: 10, fontSize: 12, color: "#5b21b6" }}>
              💡 เลือกรายการรายได้ในตารางหลักไว้ก่อน → เปิด popup นี้ → เลือกเงินโอนที่จะใช้ตัดชำระ → กดยืนยัน
            </div>

            {ftLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
            ) : ftList.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>ไม่มีเงินโอนที่รอตัดชำระ</div>
            ) : (
              <>
                <div style={{ marginBottom: 8, fontSize: 13 }}>
                  <label style={{ cursor: "pointer", fontWeight: 600 }}>
                    <input type="checkbox"
                      checked={ftList.length > 0 && ftList.every(r => ftSelected[r.ft_id || r.id])}
                      onChange={e => {
                        const all = {};
                        if (e.target.checked) ftList.forEach(r => { all[r.ft_id || r.id] = true; });
                        setFtSelected(all);
                      }} /> เลือกทั้งหมด ({ftList.length} รายการ)
                  </label>
                  <span style={{ marginLeft: 12, color: "#6b7280" }}>
                    เลือกแล้ว: <strong>{Object.values(ftSelected).filter(Boolean).length}</strong>
                    {" · ยอดรวม: "}
                    <strong style={{ color: "#15803d" }}>
                      {fmt(ftList.filter(r => ftSelected[r.ft_id || r.id]).reduce((s, r) => s + Number(r.amount || 0), 0))}
                    </strong>
                  </span>
                </div>
                <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead style={{ background: "#f3e8ff", position: "sticky", top: 0 }}>
                      <tr>
                        <th style={{ ...th, width: 30 }}></th>
                        <th style={th}>วันที่โอน</th>
                        <th style={th}>ไฟแนนท์</th>
                        <th style={th}>ธนาคารที่รับโอน</th>
                        <th style={{ ...th, textAlign: "right" }}>จำนวนเงิน</th>
                        <th style={th}>หมายเหตุ</th>
                        <th style={th}>ผู้บันทึก</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ftList.map((r, i) => {
                        const id = r.ft_id || r.id;
                        return (
                        <tr key={id} style={{ borderTop: "1px solid #f3f4f6", background: ftSelected[id] ? "#faf5ff" : (i % 2 === 0 ? "#fff" : "#f9fafb") }}>
                          <td style={{ ...td, textAlign: "center" }}>
                            <input type="checkbox" checked={!!ftSelected[id]} onChange={e => setFtSelected(prev => ({ ...prev, [id]: e.target.checked }))} />
                          </td>
                          <td style={td}>{fmtDate(r.transfer_date)}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{r.finance_company || "-"}</td>
                          <td style={td}>
                            {r.bank_name && <strong>{r.bank_name}</strong>}
                            {r.account_no && <div style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{r.account_no}</div>}
                          </td>
                          <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#15803d", fontWeight: 700 }}>{fmt(r.amount)}</td>
                          <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>{r.note || "-"}</td>
                          <td style={{ ...td, fontSize: 11 }}>{r.created_by || "-"}</td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => setFtImportOpen(false)} disabled={ftImporting} style={btn("#6b7280")}>ยกเลิก</button>
              <button onClick={proceedFtConfirm} disabled={ftImporting || Object.values(ftSelected).filter(Boolean).length === 0} style={btn("#7c3aed")}>
                {`➡️ ถัดไป (${Object.values(ftSelected).filter(Boolean).length} รายการ)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm popup — ยืนยันก่อนตัดชำระ (ยอดต้องตรง) */}
      {ftConfirmOpen && (() => {
        const incomeSelected = filtered.filter(d => selected[d.income_doc_id]);
        const incomeTotal = incomeSelected.reduce((s, d) => s + Number(d.net_to_pay || d.total || 0), 0);
        const ftTotal = ftConfirmTransfers.reduce((s, r) => s + Number(r.amount || 0), 0);
        const diff = incomeTotal - ftTotal;
        const matched = Math.abs(diff) <= 0.01;
        return (
        <div onClick={() => !ftImporting && setFtConfirmOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, padding: 20, width: "92%", maxWidth: 1000, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: "#7c3aed" }}>✅ ยืนยันการตัดชำระจากไฟแนนท์</h3>
              <button onClick={() => setFtConfirmOpen(false)} disabled={ftImporting} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ padding: 10, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
                <div style={{ fontWeight: 700, color: "#065f46", marginBottom: 6 }}>📥 รายได้ที่ตัด ({incomeSelected.length})</div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {incomeSelected.map(d => (
                    <div key={d.income_doc_id} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid #d1fae5", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "monospace" }}>{d.income_doc_no}</span>
                      <span style={{ fontWeight: 600, color: "#065f46" }}>{fmt(d.net_to_pay || d.total)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: "2px solid #065f46", display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#065f46" }}>
                  <span>รวม</span><span>{fmt(incomeTotal)}</span>
                </div>
              </div>
              <div style={{ padding: 10, background: "#f3e8ff", border: "1px solid #c4b5fd", borderRadius: 8 }}>
                <div style={{ fontWeight: 700, color: "#5b21b6", marginBottom: 6 }}>💰 เงินโอนที่ใช้ตัด ({ftConfirmTransfers.length})</div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {ftConfirmTransfers.map(r => (
                    <div key={r.ft_id || r.id} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid #ddd6fe", display: "flex", justifyContent: "space-between" }}>
                      <span>{fmtDate(r.transfer_date)} · {r.finance_company}</span>
                      <span style={{ fontWeight: 600, color: "#5b21b6" }}>{fmt(r.amount)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: "2px solid #5b21b6", display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#5b21b6" }}>
                  <span>รวม</span><span>{fmt(ftTotal)}</span>
                </div>
              </div>
            </div>

            <div style={{ padding: 14, background: matched ? "#dcfce7" : "#fee2e2", border: `2px solid ${matched ? "#10b981" : "#dc2626"}`, borderRadius: 8, marginBottom: 14, textAlign: "center", fontSize: 16, fontWeight: 700, color: matched ? "#065f46" : "#991b1b" }}>
              {matched ? (
                <>✅ ยอดตรงกัน {fmt(incomeTotal)}</>
              ) : (
                <>⚠ ยอดไม่ตรงกัน — ส่วนต่าง <strong>{fmt(diff)}</strong> บาท (ไม่สามารถบันทึกได้)</>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setFtConfirmOpen(false); setFtImportOpen(true); }} disabled={ftImporting} style={btn("#6b7280")}>← ย้อนกลับ</button>
              <button onClick={submitFtImport} disabled={ftImporting || !matched}
                style={{ ...btn(matched ? "#7c3aed" : "#9ca3af"), cursor: (ftImporting || !matched) ? "not-allowed" : "pointer" }}>
                {ftImporting ? "⏳ กำลังบันทึก..." : "💾 บันทึกตัดชำระ"}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Allocation popup — แตกย่อยรายได้ตาม moto_sales */}
      {allocOpen && allocDoc && (
        <div onClick={() => !allocSaving && setAllocOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, padding: 20, width: "92%", maxWidth: 1100, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: "#7c3aed" }}>📝 บันทึกรายละเอียดการรับชำระ — {allocDoc.income_doc_no}</h3>
              <button onClick={() => setAllocOpen(false)} disabled={allocSaving} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>

            <div style={{ padding: 10, background: "#f8fafc", borderRadius: 8, marginBottom: 12, fontSize: 13, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              <div><span style={{ color: "#6b7280" }}>Customer:</span> <strong>{allocDoc.customer_name || "-"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>เลขที่อ้างอิง:</span> <strong style={{ fontFamily: "monospace" }}>{allocDoc.reference_no || "-"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>ยอดรวม VAT:</span> <strong style={{ color: "#0369a1", fontSize: 15 }}>{fmt(allocDoc.total)}</strong></div>
              <div><span style={{ color: "#6b7280" }}>ยอดสุทธิ:</span> <strong style={{ color: "#065f46", fontSize: 15 }}>{fmt(allocDoc.net_to_pay || allocDoc.total)}</strong></div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>ประเภทการรับชำระ *</label>
              <select value={allocCategory} onChange={e => {
                  setAllocCategory(e.target.value);
                  if (e.target.value && allocSales.length === 0) loadMotoSales();
                }}
                style={{ ...inp, marginTop: 4 }}>
                <option value="">-- เลือกประเภทการรับชำระ --</option>
                {incomeCategories.map(g => (
                  <option key={g.income_code} value={g.income_code}>{g.income_code} — {g.income_name}</option>
                ))}
              </select>
            </div>

            {allocCategory && (
              <>
                <div style={{ marginBottom: 8, display: "flex", gap: 10, alignItems: "center" }}>
                  <input ref={allocSearchRef} type="text" value={allocSearch} onChange={e => setAllocSearch(e.target.value)}
                    placeholder="🔎 ค้นหา (เลขที่ใบขาย / ลูกค้า / รุ่น)"
                    style={{ ...inp, flex: 1 }} />
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, padding: "6px 10px", border: "1px solid #c4b5fd", borderRadius: 6, background: allocShowSelectedOnly ? "#ede9fe" : "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={allocShowSelectedOnly} onChange={e => setAllocShowSelectedOnly(e.target.checked)} />
                    แสดงเฉพาะที่เลือก ({allocLines.length})
                  </label>
                  <button onClick={loadMotoSales} disabled={allocSalesLoading} style={btn("#0369a1")}>🔄 โหลดข้อมูลรถ</button>
                </div>
                {allocSalesLoading ? (
                  <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>กำลังโหลดข้อมูลรถ...</div>
                ) : (
                  <div style={{ maxHeight: 250, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead style={{ background: "#f3f4f6", position: "sticky", top: 0 }}>
                        <tr>
                          <th style={th}>เลขที่ใบขาย</th>
                          <th style={th}>วันที่</th>
                          <th style={th}>ลูกค้า</th>
                          <th style={th}>รุ่น</th>
                          <th style={{ ...th, fontSize: 11 }}>เลขเครื่อง</th>
                          <th style={{ ...th, fontSize: 11 }}>เลขตัวถัง</th>
                          <th style={th}>ชื่อลูกค้า (ใบขาย)</th>
                          <th style={{ ...th, width: 130, textAlign: "right" }}>จำนวนรับ</th>
                          <th style={th}>หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocSales.filter(s => {
                          const isSel = allocLines.some(l => l.invoice_no === s.invoice_no || (s.id && l.sale_id === s.id));
                          if (allocUsedInvoices.has(s.invoice_no) && !isSel) return false;
                          // กรองเฉพาะที่ตรงกับลูกค้า/ไฟแนนซ์ของใบรับชำระ (เว้นรายการที่เลือกไว้แล้ว ให้คงอยู่)
                          // ตัดคำนำหน้า/ท้ายนิติบุคคลก่อน (บริษัท/บจก./บมจ./หจก./จำกัด/มหาชน) — เอกสารใช้ชื่อย่อ
                          // "บจก. ธนบรรณ" แต่ใบกำกับใช้ชื่อเต็ม "บริษัท ธนบรรณ จำกัด" ต้อง match กัน
                          // แล้วตัดสระ/วรรณยุกต์ไทย + ช่องว่าง — กันสะกดต่าง เช่น "กรุ๊ปลีส" vs "กรุ๊ปลิส"
                          const nz = v => String(v == null ? "" : v)
                            .replace(/บริษัท|บจก\.?|บมจ\.?|หจก\.?|ห้างหุ้นส่วนจำกัด|จำกัด|\(มหาชน\)|มหาชน/g, " ")
                            .replace(/[ัิ-ฺ็-๎\s]/g, "").toLowerCase();
                          const docCust = nz(allocDoc?.customer_name);
                          if (docCust && !isSel) {
                            // เทียบชื่อตามใบกำกับดิบ (invoice_customer = คนที่ถูกเรียกเก็บ) เป็นหลัก — ขายเงินสด
                            // ใบกำกับเป็นชื่อผู้ซื้อ → ไม่ match บริษัทไฟแนนซ์ → ซ่อน (ตามเดิม)
                            // ถ้าใบกำกับไม่มีชื่อ/ยังไม่อัปโหลด → เทียบบริษัทไฟแนนซ์ของใบขายแทน
                            // (ห้ามใช้ s.customer_name เพราะถูก fallback เป็นชื่อผู้ซื้อตอนโหลด)
                            const eqCust = a => { const x = nz(a); return x && (x === docCust || x.includes(docCust) || docCust.includes(x)); };
                            if (!(eqCust(s.invoice_customer) || (!s.invoice_customer && eqCust(s.finance_company)))) return false;
                          }
                          if (allocShowSelectedOnly && !isSel) return false;
                          if (!allocSearch.trim()) return true;
                          const q = allocSearch.toLowerCase();
                          return [s.invoice_no, s.customer_name, s.sale_customer_name, s.model_series, s.model, s.engine_no, s.chassis_no, s.frame_no]
                            .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
                        }).slice(0, 2000).map((s, idx) => {
                          const lineIdx = allocLines.findIndex(l => (l.sale_id && l.sale_id === s.id) || l.invoice_no === s.invoice_no);
                          const selected = lineIdx >= 0;
                          const line = selected ? allocLines[lineIdx] : null;
                          const onRowClick = () => {
                            setLineEdit({
                              sale: s,
                              lineIdx: selected ? lineIdx : -1,
                              amount: selected ? line.amount : "",
                              note: selected ? line.note : "",
                            });
                          };
                          return (
                          <tr key={s.id || s.invoice_no || s.chassis_no || idx}
                              onClick={onRowClick}
                              style={{
                                borderTop: "1px solid #f3f4f6",
                                background: selected ? "#fef9c3" : undefined,
                                cursor: "pointer"
                              }}
                              title="คลิกเพื่อใส่จำนวนเงิน">
                            <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{s.invoice_no}</td>
                            <td style={td}>{fmtDate(s.sale_date)}</td>
                            <td style={td}>{s.customer_name || "-"}</td>
                            <td style={td}>{s.model_series || s.model || "-"}</td>
                            <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{s.engine_no || "-"}</td>
                            <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{s.chassis_no || s.frame_no || "-"}</td>
                            <td style={td}>{s.sale_customer_name || "-"}</td>
                            <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: selected ? 700 : 400, color: selected ? "#7c3aed" : "#d1d5db" }}>
                              {selected ? fmt(line.amount) : "—"}
                            </td>
                            <td style={td}>
                              {selected ? <span>{line.note || "—"}</span> : <span style={{ color: "#d1d5db" }}>—</span>}
                            </td>
                          </tr>
                        );})}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* Summary footer */}
            <div style={{ marginTop: 10, padding: 12, background: "#f3f4f6", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700 }}>
              <span style={{ color: "#7c3aed" }}>เลือกแล้ว: {allocLines.length} รายการ</span>
              <span>รวมที่กระจาย: <span style={{ fontFamily: "monospace", color: "#7c3aed" }}>{fmt(allocLines.reduce((s, l) => s + Number(l.amount || 0), 0))}</span></span>
              <span style={{ fontSize: 13 }}>เป้าหมาย (ยอดรวม VAT): <span style={{ fontFamily: "monospace" }}>{fmt(allocDoc.total || allocDoc.net_to_pay)}</span></span>
              {Math.abs(allocLines.reduce((s, l) => s + Number(l.amount || 0), 0) - Number(allocDoc.total || allocDoc.net_to_pay || 0)) <= 0.01 ?
                <span style={{ color: "#10b981" }}>✓ ตรงกัน</span> :
                <span style={{ color: "#dc2626" }}>⚠ ไม่ตรง ({fmt(allocLines.reduce((s, l) => s + Number(l.amount || 0), 0) - Number(allocDoc.total || allocDoc.net_to_pay || 0))})</span>}
            </div>

            {/* Inline amount popup */}
            {lineEdit && (
              <div onClick={() => setLineEdit(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
                <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, padding: 22, width: 460, maxWidth: "92%", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <h4 style={{ margin: 0, color: "#7c3aed" }}>💵 ใส่จำนวนเงินที่กระจาย</h4>
                    <button onClick={() => setLineEdit(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280" }}>×</button>
                  </div>

                  <div style={{ background: "#f8fafc", borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 13 }}>
                    <div><span style={{ color: "#6b7280" }}>เลขที่ใบขาย:</span> <strong style={{ fontFamily: "monospace", color: "#0369a1" }}>{lineEdit.sale.invoice_no}</strong></div>
                    <div><span style={{ color: "#6b7280" }}>ลูกค้า:</span> <strong>{lineEdit.sale.customer_name || "-"}</strong></div>
                    <div><span style={{ color: "#6b7280" }}>รุ่น:</span> {lineEdit.sale.model_series || lineEdit.sale.model || "-"}</div>
                    <div><span style={{ color: "#6b7280" }}>เลขตัวถัง:</span> <span style={{ fontFamily: "monospace" }}>{lineEdit.sale.chassis_no || lineEdit.sale.frame_no || "-"}</span></div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>จำนวนรับ *</label>
                    <input type="number" step="0.01" autoFocus value={lineEdit.amount}
                      onChange={e => setLineEdit(le => ({ ...le, amount: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const amt = Number(lineEdit.amount) || 0;
                          if (lineEdit.lineIdx >= 0) {
                            if (amt <= 0) removeAllocLine(lineEdit.lineIdx);
                            else {
                              updateAllocLine(lineEdit.lineIdx, "amount", amt);
                              updateAllocLine(lineEdit.lineIdx, "note", lineEdit.note);
                            }
                          } else if (amt > 0) {
                            const s = lineEdit.sale;
                            setAllocLines(arr => [...arr, { sale_id: s.id, invoice_no: s.invoice_no, customer_name: s.customer_name, model: s.model_series || s.model, amount: amt, note: lineEdit.note }]);
                          }
                          setLineEdit(null);
                          setAllocSearch("");
                          setTimeout(() => allocSearchRef.current?.focus(), 50);
                        }
                      }}
                      style={{ ...inp, fontSize: 18, fontWeight: 700, textAlign: "right", fontFamily: "monospace" }} />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>หมายเหตุ</label>
                    <input type="text" value={lineEdit.note}
                      onChange={e => setLineEdit(le => ({ ...le, note: e.target.value }))}
                      style={inp} />
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                    {lineEdit.lineIdx >= 0 ? (
                      <button onClick={() => { removeAllocLine(lineEdit.lineIdx); setLineEdit(null); }}
                        style={btn("#dc2626")}>🗑 ลบ</button>
                    ) : <span />}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setLineEdit(null)} style={btn("#6b7280")}>ยกเลิก</button>
                      <button onClick={() => {
                        const amt = Number(lineEdit.amount) || 0;
                        if (lineEdit.lineIdx >= 0) {
                          if (amt <= 0) {
                            removeAllocLine(lineEdit.lineIdx);
                          } else {
                            updateAllocLine(lineEdit.lineIdx, "amount", amt);
                            updateAllocLine(lineEdit.lineIdx, "note", lineEdit.note);
                          }
                        } else if (amt > 0) {
                          const s = lineEdit.sale;
                          setAllocLines(arr => [...arr, { sale_id: s.id, invoice_no: s.invoice_no, customer_name: s.customer_name, model: s.model_series || s.model, amount: amt, note: lineEdit.note }]);
                        }
                        setLineEdit(null);
                        setAllocSearch("");
                        setTimeout(() => allocSearchRef.current?.focus(), 50);
                      }} style={btn("#7c3aed")}>💾 บันทึก</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={handlePrintAllocation} disabled={allocSaving || allocLines.length === 0}
                style={{ ...btn(allocLines.length === 0 ? "#9ca3af" : "#0369a1"), cursor: allocLines.length === 0 ? "not-allowed" : "pointer", marginRight: "auto" }}
                title="พิมพ์รายละเอียดการรับชำระ (รายการที่เลือกอยู่ตอนนี้)">
                🖨️ พิมพ์
              </button>
              <button onClick={() => setAllocOpen(false)} disabled={allocSaving} style={btn("#6b7280")}>ยกเลิก</button>
              <button onClick={() => saveAllocation(true)} disabled={allocSaving || allocLines.length === 0}
                style={{ ...btn(allocSaving || allocLines.length === 0 ? "#9ca3af" : "#0891b2"), cursor: (allocSaving || allocLines.length === 0) ? "not-allowed" : "pointer" }}
                title="บันทึกค้างไว้แม้ยอดไม่ครบ — กด 📝 รายละเอียด ในตารางเพื่อมาแก้ไขต่อภายหลัง">
                💾 บันทึกค้างไว้ (แก้ต่อภายหลัง)
              </button>
              {(() => {
                const sum = allocLines.reduce((s, l) => s + Number(l.amount || 0), 0);
                const target = Number(allocDoc.total || allocDoc.net_to_pay || 0);
                const exceeded = sum - target > 0.01;
                const disabled = allocSaving || allocLines.length === 0 || exceeded;
                return (
                  <button onClick={() => saveAllocation(false)} disabled={disabled}
                    style={{ ...btn(disabled ? "#9ca3af" : "#7c3aed"), cursor: disabled ? "not-allowed" : "pointer" }}
                    title={exceeded ? "ยอดที่กระจายเกินเป้าหมาย — แก้ก่อนบันทึก" : ""}>
                    {allocSaving ? "⏳ กำลังบันทึก..." : "💾 บันทึกรายละเอียด"}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KebabMenu({ d, status, openEdit, handleCancel, openDuplicate, handlePrint, handleDelete, handleClearReceived }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.right - 170 });
    }
    setOpen(o => !o);
  }
  useEffect(() => {
    if (!open) return;
    const onDown = e => {
      if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const run = fn => () => { setOpen(false); fn(); };
  const Item = ({ icon, label, onClick, color }) => (
    <button onClick={onClick} style={{ ...menuItem, color: color || "#374151" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <span style={{ width: 18, display: "inline-block", textAlign: "center" }}>{icon}</span>{label}
    </button>
  );

  return (
    <>
      <button ref={btnRef} onClick={toggle} title="เมนู"
        style={{ width: 30, height: 28, borderRadius: 6, border: "1px solid #e5e7eb", background: open ? "#e2e8f0" : "#fff", cursor: "pointer", fontSize: 18, lineHeight: "14px", color: "#475569" }}>⋯</button>
      {open && (
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: 170, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", zIndex: 2000, padding: 4 }}>
          <Item icon="✏️" label="แก้ไข" onClick={run(() => openEdit(d))} />
          <Item icon="🖨️" label="พิมพ์" onClick={run(() => handlePrint(d))} />
          <Item icon="📋" label="สร้างซ้ำ" onClick={run(() => openDuplicate(d))} />
          {status !== "paid" && <div style={{ height: 1, background: "#e5e7eb", margin: "4px 6px" }} />}
          {status !== "paid" && status !== "cancelled" && Number(d.received_amount || 0) > 0 && <Item icon="🧹" label="ล้างยอดรับสะสม" onClick={run(() => handleClearReceived(d))} color="#0369a1" />}
          {status !== "paid" && status !== "cancelled" && <Item icon="🚫" label="ยกเลิก" onClick={run(() => handleCancel(d))} color="#b45309" />}
          {status !== "paid" && <Item icon="🗑️" label="ลบ" onClick={run(() => handleDelete(d))} color="#dc2626" />}
        </div>
      )}
    </>
  );
}

function DocsTable({ docs, loading, openEdit, handleCancel, openDuplicate, handlePrint, handleDelete, handleClearReceived, showCheckbox, selected, toggleOne, toggleAll }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
      {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
       docs.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div> :
       <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "#072d6b", color: "#fff" }}>
          <tr>
            {showCheckbox && <th style={{ ...th, width: 40, textAlign: "center" }}>
              <input type="checkbox" checked={docs.length > 0 && docs.every(d => selected?.[d.income_doc_id])} onChange={toggleAll} />
            </th>}
            <th style={th}>เลขเอกสาร</th>
            <th style={th}>วันที่</th>
            <th style={th}>Customer</th>
            <th style={th}>เลขที่อ้างอิง</th>
            <th style={th}>สังกัด</th>
            <th style={th}>รายละเอียด</th>
            <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
            <th style={{ ...th, textAlign: "right" }}>WHT</th>
            <th style={{ ...th, textAlign: "right" }}>ยอดสุทธิ</th>
            <th style={th}>สถานะ</th>
            <th style={{ ...th, width: 70, textAlign: "center" }}>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {docs.map(d => {
            const status = String(d.status || "").toLowerCase();
            return (
              <tr key={d.income_doc_id} style={{ borderTop: "1px solid #e5e7eb", background: status === "cancelled" ? "#fef2f2" : status === "paid" ? "#f0fdf4" : (selected?.[d.income_doc_id] ? "#fef3c7" : "transparent") }}>
                {showCheckbox && <td style={{ ...td, textAlign: "center" }}>
                  <input type="checkbox" checked={!!selected?.[d.income_doc_id]} onChange={() => toggleOne(d.income_doc_id)} />
                </td>}
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{d.income_doc_no}</td>
                <td style={td}>{fmtDate(d.doc_date)}</td>
                <td style={td}>{d.customer_name || "-"}</td>
                <td style={td}>{d.reference_no || "-"}</td>
                <td style={td}>{d.affiliation ? <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: d.affiliation === "ป.เปา" ? "#fee2e2" : "#dbeafe", color: d.affiliation === "ป.เปา" ? "#991b1b" : "#1e40af" }}>{d.affiliation}</span> : "-"}</td>
                <td style={{ ...td, color: "#6b7280", fontSize: 12 }}>{d.description || "-"}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmt(d.total)}</td>
                <td style={{ ...td, textAlign: "right", color: "#dc2626" }}>{Number(d.wht_amount) > 0 ? fmt(d.wht_amount) : "-"}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(d.net_to_pay || d.total)}</td>
                <td style={td}>
                  {(() => {
                    // รับบางส่วนแล้ว (หักกลบจากหน้าค่าใช้จ่าย ฯลฯ) — โชว์ยอดรับแล้ว + ค้าง
                    const received = Number(d.received_amount || 0);
                    const isPartial = status !== "paid" && status !== "cancelled" && received > 0;
                    return (
                      <>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: status === "paid" ? "#d1fae5" : status === "cancelled" ? "#fee2e2" : isPartial ? "#e0e7ff" : "#fef3c7",
                          color: status === "paid" ? "#065f46" : status === "cancelled" ? "#991b1b" : isPartial ? "#3730a3" : "#78350f" }}>
                          {status === "paid" ? "ชำระแล้ว" : status === "cancelled" ? "ยกเลิก" : isPartial ? "รับบางส่วน" : "ร่าง"}
                        </span>
                        {isPartial && (
                          <div style={{ fontSize: 10, marginTop: 2, color: "#3730a3" }}>
                            รับแล้ว {fmt(received)}<br />ค้าง {fmt(d.remaining_amount != null ? d.remaining_amount : Math.max(0, Number(d.net_to_pay || d.total || 0) - received))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  <KebabMenu d={d} status={status} openEdit={openEdit} handleCancel={handleCancel} openDuplicate={openDuplicate} handlePrint={handlePrint} handleDelete={handleDelete} handleClearReceived={handleClearReceived} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>}
    </div>
  );
}

function FormModal({ form, setForm, editTarget, customers, incomeCategories, bankAccounts, onCustomerChange, onAddCustomer, onItemChange, addItem, removeItem, subtotal, discountAmount, vatAmount, totalIncVat, whtBase, whtAmount, netToPay, onClose, onSave, saving }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: 20, overflowY: "auto" }}
      onClick={() => !saving && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 1100, maxWidth: "98vw", maxHeight: "95vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
          <h3 style={{ margin: 0, color: "#072d6b" }}>{editTarget ? `✏️ แก้ไขรายได้ — ${form.income_doc_no}` : "📑 บันทึกรายได้ใหม่"}</h3>
          <button onClick={onClose} style={{ marginLeft: "auto", padding: "4px 10px", background: "transparent", border: "none", cursor: "pointer", fontSize: 22, color: "#6b7280" }}>✕</button>
        </div>

        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={lbl}>วันที่ *</label>
            <input type="date" value={form.doc_date} onChange={e => setForm(f => ({ ...f, doc_date: e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>เลขที่อ้างอิง</label>
            <input type="text" value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} placeholder="เช่น ใบกำกับภาษี" style={inp} />
          </div>
          <div>
            <label style={lbl}>🏢 สังกัด</label>
            <select value={form.affiliation} onChange={e => setForm(f => ({ ...f, affiliation: e.target.value }))} style={inp}>
              <option value="">-- ไม่ระบุ --</option>
              <option value="ป.เปา">ป.เปา</option>
              <option value="สิงห์ชัย">สิงห์ชัย</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / span 2" }}>
            <label style={lbl}>ลูกค้า/ผู้ชำระ *</label>
            <div style={{ display: "flex", gap: 6 }}>
              <select value={form.customer_id} onChange={e => onCustomerChange(e.target.value)} style={{ ...inp, flex: 1 }}>
                <option value="">-- เลือกลูกค้า --</option>
                {customers.map(c => {
                  const name = [c.title, c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.customer_name || "(ไม่มีชื่อ)";
                  return <option key={c.customer_id} value={c.customer_id}>{name}{c.id_number ? ` (${c.id_number})` : ""}</option>;
                })}
              </select>
              {onAddCustomer && (
                <button type="button" onClick={onAddCustomer} title="เพิ่มลูกค้าใหม่"
                  style={{ padding: "0 14px", background: "#15803d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 16, fontWeight: 700, flex: "0 0 auto" }}>
                  +
                </button>
              )}
            </div>
          </div>
          {form.customer_address && (
            <div style={{ gridColumn: "1 / span 2", padding: "6px 10px", background: "#f8fafc", borderRadius: 6, fontSize: 12, color: "#6b7280" }}>
              📍 {form.customer_address} {form.customer_tax_id && <span> · เลขผู้เสียภาษี: <code>{form.customer_tax_id}</code></span>}
            </div>
          )}
          <div style={{ gridColumn: "1 / span 2" }}>
            <label style={lbl}>รายละเอียด</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inp} />
          </div>
        </div>

        {/* Items table */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>รายการ</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={{ ...th, width: 30 }}>#</th>
                <th style={{ ...th, width: 220 }}>หมวด (Master) *</th>
                <th style={th}>ชื่อรายการ</th>
                <th style={th}>รายละเอียด</th>
                <th style={{ ...th, width: 80, textAlign: "right" }}>จำนวน</th>
                <th style={{ ...th, width: 120, textAlign: "right" }}>ราคาต่อหน่วย</th>
                <th style={{ ...th, width: 120, textAlign: "right" }}>รวม</th>
                <th style={{ ...th, width: 80, textAlign: "right" }}>หัก ณ ที่จ่าย %</th>
                <th style={{ ...th, width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                  <td style={td}>
                    <select value={it.income_code} onChange={e => onItemChange(i, "income_code", e.target.value)} style={inp}>
                      <option value="">-- เลือกหมวด --</option>
                      {incomeCategories.map(g => <option key={g.expense_id} value={g.income_code}>{g.income_code} — {g.income_name}</option>)}
                    </select>
                  </td>
                  <td style={td}>
                    <input type="text" value={it.income_name} onChange={e => onItemChange(i, "income_name", e.target.value)} style={inp} />
                  </td>
                  <td style={td}>
                    <input type="text" value={it.description} onChange={e => onItemChange(i, "description", e.target.value)} style={inp} />
                  </td>
                  <td style={td}>
                    <input type="number" step="0.01" value={it.qty} onChange={e => onItemChange(i, "qty", e.target.value)} style={{ ...inp, textAlign: "right" }} />
                  </td>
                  <td style={td}>
                    <input type="number" step="0.01" value={it.unit_price} onChange={e => onItemChange(i, "unit_price", e.target.value)} style={{ ...inp, textAlign: "right" }} />
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmt(it.amount)}</td>
                  <td style={td}>
                    <input type="number" step="0.01" value={it.wht_rate} onChange={e => onItemChange(i, "wht_rate", e.target.value)} style={{ ...inp, textAlign: "right" }} />
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {form.items.length > 1 && <button onClick={() => removeItem(i)} style={{ ...btnSm, background: "#dc2626" }}>✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addItem} style={{ ...btn("#0369a1"), marginTop: 6, fontSize: 12 }}>+ เพิ่มรายการ</button>
        </div>

        {/* Totals + WHT + Bank */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={lbl}>หมายเหตุ</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={4} style={inp} />
            <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280", padding: 8, background: "#f0f9ff", borderRadius: 6 }}>
              💡 บันทึกครั้งแรก = สถานะ "ร่าง" → ไปรับเงินที่ Tab <b>"💵 บันทึกรับเงิน"</b>
            </div>
          </div>
          <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
            <Row label="รวมเป็นเงิน" value={fmt(subtotal)} />
            <RowInput label="ส่วนลด %" value={form.discount_pct} onChange={v => setForm(f => ({ ...f, discount_pct: v }))} suffix={`= ${fmt(discountAmount)}`} />
            <Row label="ราคาหลังหักส่วนลด" value={fmt(subtotal - discountAmount)} />
            <RowInput label="ภาษีมูลค่าเพิ่ม %" value={form.vat_pct} onChange={v => setForm(f => ({ ...f, vat_pct: v }))} suffix={`= ${fmt(vatAmount)}`} />
            <Row label="จำนวนเงินรวมทั้งสิ้น" value={fmt(totalIncVat)} bold />
            <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0" }} />
            <Row label="หัก ณ ที่จ่าย (รวมจากรายการ)" value={fmt(whtAmount)} color="#dc2626" title="คำนวณจากอัตรา WHT % ที่ระบุในแต่ละรายการ" />
            <Row label="ยอดเงินสุทธิที่ได้รับ" value={fmt(netToPay)} bold color="#059669" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} disabled={saving} style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={onSave} disabled={saving} style={{ padding: "8px 24px", background: saving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
            {saving ? "กำลังบันทึก..." : "💾 บันทึกเอกสาร"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ fontFamily: "monospace", fontWeight: bold ? 700 : 500, color: color || "#374151", fontSize: bold ? 15 : 13 }}>{value}</span>
    </div>
  );
}
function RowInput({ label, value, onChange, suffix }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0", fontSize: 13, gap: 8 }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <input type="number" step="0.01" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 80, padding: "4px 8px", borderRadius: 4, border: "1px solid #d1d5db", textAlign: "right", fontFamily: "monospace" }} />
      <span style={{ color: "#9ca3af", fontSize: 11, minWidth: 90, textAlign: "right" }}>{suffix}</span>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 };
const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 13, verticalAlign: "middle" };
const btn = (color) => ({ padding: "7px 14px", background: color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 });
const btnSm = { padding: "4px 10px", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600, marginRight: 4 };
const menuItem = { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", background: "transparent", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontSize: 13, fontWeight: 600, textAlign: "left" };
