import React, { useEffect, useState } from "react";

const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/finance-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const CUSTOMER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/moto-sales-get-customers";
const ACCOUNTING_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

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
  // Finance transfer import (เงินโอนจากไฟแนนท์ที่ยัง pending → ตัดชำระ income_records)
  const [ftImportOpen, setFtImportOpen] = useState(false);
  const [ftList, setFtList] = useState([]);
  const [ftSelected, setFtSelected] = useState({});
  const [ftLoading, setFtLoading] = useState(false);
  const [ftImporting, setFtImporting] = useState(false);
  const [incomeCategories, setIncomeCategories] = useState([]); // หมวดจาก master
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("draft"); // draft | pay | history
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

  async function submitFtImport() {
    const ftIds = Object.keys(ftSelected).filter(k => ftSelected[k]);
    if (ftIds.length === 0) { alert("เลือกอย่างน้อย 1 รายการ"); return; }
    if (selectedIds.length === 0) { alert("กรุณาเลือกรายการรายได้ที่ต้องการตัดชำระจากตารางหลักก่อน"); return; }
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
      setFtImportOpen(false); setFtList([]); setFtSelected({}); setSelected({});
      fetchDocs();
    } catch (e) { alert("❌ ตัดชำระล้มเหลว: " + e.message); }
    setFtImporting(false);
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

  const kw = search.trim().toLowerCase();
  const filtered = docs.filter(d => {
    if (!kw) return true;
    const hay = [d.income_doc_no, d.customer_name, d.reference_no, d.description].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const totalAll = filtered.reduce((s, d) => s + Number(d.total || 0), 0);

  // Tab data
  const draftDocs = filtered.filter(d => (d.status || "draft") === "draft");
  const paidDocs = filtered.filter(d => d.status === "paid");
  // Group paid by paid_doc_no
  const paidGroups = {};
  paidDocs.forEach(d => {
    const key = d.paid_doc_no || `_${d.income_doc_id}`;
    if (!paidGroups[key]) paidGroups[key] = { paid_doc_no: d.paid_doc_no, paid_at: d.paid_at, payment_method: d.payment_method, from_bank_account_id: d.from_bank_account_id, items: [], total: 0, net: 0, wht: 0 };
    paidGroups[key].items.push(d);
    paidGroups[key].total += Number(d.total || 0);
    paidGroups[key].net += Number(d.net_to_pay || d.total || 0);
    paidGroups[key].wht += Number(d.wht_amount || 0);
  });
  const paidGroupsList = Object.values(paidGroups);

  const selectedIds = Object.keys(selected).filter(k => selected[k]).map(Number);
  const selectedRows = draftDocs.filter(d => selectedIds.includes(d.income_doc_id));
  const selectedNet = selectedRows.reduce((s, d) => s + Number(d.net_to_pay || d.total || 0), 0);

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
  function openPayDialog() {
    if (selectedIds.length === 0) { setMessage("❌ เลือกเอกสารก่อน"); return; }
    setEditPayDocNo(null);
    setEditTotalRequired(0);
    setPayForm({ paid_date: todayISO(), payment_note: "" });
    setPayments([{ method: "โอน", amount: Number(selectedNet) || 0, from_bank_account_id: "", credit_note_no: "" }]);
    setPayDialog(true);
    fetchAvailableCreditNotes();
  }
  function openEditPayDialog(g) {
    if (!g.paid_doc_no) return;
    const total = Number(g.net || g.total || 0);
    setEditPayDocNo(g.paid_doc_no);
    setEditTotalRequired(total);
    setPayForm({
      paid_date: g.paid_at ? String(g.paid_at).slice(0, 10) : todayISO(),
      payment_note: "",
    });
    const method = g.payment_method && g.payment_method !== "ผสม" ? g.payment_method : "โอน";
    setPayments([{ method, amount: total, from_bank_account_id: g.from_bank_account_id || "", credit_note_no: "" }]);
    setPayDialog(true);
    fetchAvailableCreditNotes();
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
    }
    setSavingPay(true);
    try {
      const single = payments.length === 1 ? payments[0] : null;
      const body = {
        action: "income_record",
        op: editPayDocNo ? "edit_payment" : "save_payment",
        paid_doc_no: editPayDocNo || undefined,
        income_doc_ids: editPayDocNo ? undefined : selectedIds,
        paid_date: payForm.paid_date,
        payment_method: single ? single.method : "ผสม",
        payment_note: payForm.payment_note,
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
      setMessage(editPayDocNo ? "✅ แก้ไขใบจ่ายเรียบร้อย" : `✅ บันทึกรับเงินเรียบร้อย ${data?.paid_doc_no || data?.[0]?.paid_doc_no || ""}`);
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
          <DocsTable docs={filtered} loading={loading} openEdit={openEdit} handleCancel={handleCancel} showCheckbox={false} />
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
          <DocsTable docs={draftDocs} loading={loading} openEdit={openEdit} handleCancel={handleCancel} showCheckbox={true} selected={selected} toggleOne={toggleOne} toggleAll={toggleAll} />
        </>
      )}

      {/* TAB: ประวัติการรับเงิน */}
      {tab === "history" && (
        <>
          <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
            <span>💵 ใบรับเงิน: <strong>{paidGroupsList.length}</strong></span>
            <span style={{ marginLeft: 14, color: "#dc2626" }}>ยอดรวม: <strong>{fmt(paidGroupsList.reduce((s, g) => s + g.net, 0))}</strong> บาท</span>
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
                  <span style={{ marginLeft: "auto", fontWeight: 700, color: "#065f46" }}>{g.items.length} ใบ · {fmt(g.net)}</span>
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
        onCustomerChange={onCustomerChange}
        onItemChange={onItemChange} addItem={addItem} removeItem={removeItem}
        subtotal={subtotal} discountAmount={discountAmount} vatAmount={vatAmount}
        totalIncVat={totalIncVat} whtBase={whtBase} whtAmount={whtAmount} netToPay={netToPay}
        onClose={closeForm} onSave={handleSave} saving={saving}
      />}

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
                      return (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "110px 110px minmax(0, 1fr) 30px", gap: 8, alignItems: "center", minWidth: 0 }}>
                        <select value={p.method}
                          onChange={e => updatePayment(idx, { method: e.target.value, from_bank_account_id: e.target.value === "โอน" ? p.from_bank_account_id : "", credit_note_no: e.target.value === "ใบลดหนี้" ? p.credit_note_no : "" })}
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }}>
                          <option value="โอน">เงินโอน</option>
                          <option value="เงินสด">เงินสด</option>
                          <option value="เช็ค">เช็ค</option>
                          <option value="ใบลดหนี้">ใบลดหนี้</option>
                        </select>
                        <input type="number" step="0.01" min="0" value={p.amount}
                          onChange={e => updatePayment(idx, { amount: e.target.value })}
                          placeholder="0.00"
                          readOnly={p.method === "ใบลดหนี้"}
                          title={p.method === "ใบลดหนี้" ? "จำนวนเงินจะถูกตั้งจากใบลดหนี้ที่เลือก" : ""}
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, textAlign: "right", background: p.method === "ใบลดหนี้" ? "#f3f4f6" : "#fff" }} />
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
            ) : (
              <>
                <div style={{ marginBottom: 8, fontSize: 13 }}>
                  <label style={{ cursor: "pointer", fontWeight: 600 }}>
                    <input type="checkbox"
                      checked={tfList.length > 0 && tfList.every(t => tfSelected[t.tax_invoice_no])}
                      onChange={e => {
                        const all = {};
                        if (e.target.checked) tfList.forEach(t => { all[t.tax_invoice_no] = true; });
                        setTfSelected(all);
                      }} /> เลือกทั้งหมด ({tfList.length} รายการ)
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
                      {tfList.map((t, i) => (
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
            )}

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
              <button onClick={submitFtImport} disabled={ftImporting || Object.values(ftSelected).filter(Boolean).length === 0} style={btn("#7c3aed")}>
                {ftImporting ? "⏳ กำลังบันทึก..." : `💰 ตัดชำระ ${Object.values(ftSelected).filter(Boolean).length} รายการ`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocsTable({ docs, loading, openEdit, handleCancel, showCheckbox, selected, toggleOne, toggleAll }) {
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
            <th style={th}>รายละเอียด</th>
            <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
            <th style={{ ...th, textAlign: "right" }}>WHT</th>
            <th style={{ ...th, textAlign: "right" }}>ยอดสุทธิ</th>
            <th style={th}>สถานะ</th>
            <th style={{ ...th, width: 160 }}>จัดการ</th>
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
                <td style={{ ...td, color: "#6b7280", fontSize: 12 }}>{d.description || "-"}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmt(d.total)}</td>
                <td style={{ ...td, textAlign: "right", color: "#dc2626" }}>{Number(d.wht_amount) > 0 ? fmt(d.wht_amount) : "-"}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(d.net_to_pay || d.total)}</td>
                <td style={td}>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: status === "paid" ? "#d1fae5" : status === "cancelled" ? "#fee2e2" : "#fef3c7",
                    color: status === "paid" ? "#065f46" : status === "cancelled" ? "#991b1b" : "#78350f" }}>
                    {status === "paid" ? "ชำระแล้ว" : status === "cancelled" ? "ยกเลิก" : "ร่าง"}
                  </span>
                </td>
                <td style={td}>
                  <button onClick={() => openEdit(d)} style={{ ...btnSm, background: "#0369a1" }}>✏️ แก้</button>
                  {status !== "cancelled" && status !== "paid" && <button onClick={() => handleCancel(d)} style={{ ...btnSm, background: "#dc2626" }}>✕</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>}
    </div>
  );
}

function FormModal({ form, setForm, editTarget, customers, incomeCategories, bankAccounts, onCustomerChange, onItemChange, addItem, removeItem, subtotal, discountAmount, vatAmount, totalIncVat, whtBase, whtAmount, netToPay, onClose, onSave, saving }) {
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
          <div style={{ gridColumn: "1 / span 2" }}>
            <label style={lbl}>ลูกค้า/ผู้ชำระ *</label>
            <select value={form.customer_id} onChange={e => onCustomerChange(e.target.value)} style={inp}>
              <option value="">-- เลือกลูกค้า --</option>
              {customers.map(c => {
                const name = [c.title, c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.customer_name || "(ไม่มีชื่อ)";
                return <option key={c.customer_id} value={c.customer_id}>{name}{c.id_number ? ` (${c.id_number})` : ""}</option>;
              })}
            </select>
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
