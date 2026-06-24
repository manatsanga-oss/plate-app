import React, { useEffect, useState, useRef } from "react";

const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

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

const emptyItem = () => ({ expense_code: "", expense_name: "", description: "", qty: 1, unit_price: 0, amount: 0, wht_pct: 0 });
const emptyForm = () => ({
  expense_doc_no: "",  // generated on save
  doc_date: todayISO(),
  vendor_id: "",
  vendor_name: "",
  vendor_tax_id: "",
  vendor_address: "",
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
  affiliation: "",  // สังกัด: ป.เปา | สิงห์ชัย
  items: [emptyItem()],
});

export default function ExpenseRecordPage({ currentUser }) {
  const [docs, setDocs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [generalExpenses, setGeneralExpenses] = useState([]); // หมวดจาก master
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
  const [statusFilter, setStatusFilter] = useState({ draft: true, paid: true, cancelled: true }); // กรองแสดงตามสถานะ (แท็บรายการค่าใช้จ่าย)
  const [filterAff, setFilterAff] = useState(""); // กรองตามสังกัด (ป.เปา / สิงห์ชัย) — "" = ทั้งหมด
  const [selected, setSelected] = useState({}); // { expense_doc_id: true }
  const [payDialog, setPayDialog] = useState(false);
  const [payForm, setPayForm] = useState({ paid_date: todayISO(), payment_note: "" });
  // payments: array ของวิธีการจ่าย — รองรับการจ่ายผสม
  // each row: { method: "โอน"|"เงินสด"|"ใบลดหนี้", amount: number, from_bank_account_id?: number }
  const [payments, setPayments] = useState([{ method: "โอน", amount: 0, from_bank_account_id: "" }]);
  // ในโหมดแก้ไข ใช้ยอดของใบจ่ายที่กำลังแก้ (ไม่ใช่ selectedNet)
  const [editTotalRequired, setEditTotalRequired] = useState(0);
  const [savingPay, setSavingPay] = useState(false);
  const [editPayDocNo, setEditPayDocNo] = useState(null);

  useEffect(() => {
    const now = new Date();
    setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);
    fetchVendors();
    fetchGeneralExpenses();
    fetchBankAccounts();
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => { if (dateFrom && dateTo) fetchDocs(); /* eslint-disable-next-line */ }, [dateFrom, dateTo]);

  async function fetchDocs() {
    setLoading(true);
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "expense_record", op: "list", date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : []);
    } catch { setDocs([]); }
    setLoading(false);
  }
  async function fetchVendors() {
    try {
      const res = await fetch(MASTER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_vendors", include_inactive: "false" }),
      });
      const data = await res.json();
      setVendors(Array.isArray(data) ? data : []);
    } catch { setVendors([]); }
  }
  async function fetchGeneralExpenses() {
    try {
      const res = await fetch(MASTER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "general_expense", op: "list" }),
      });
      const data = await res.json();
      setGeneralExpenses(Array.isArray(data) ? data : []);
    } catch { setGeneralExpenses([]); }
  }
  async function fetchBankAccounts() {
    try {
      const res = await fetch(ACC_URL, {
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
      expense_doc_no: d.expense_doc_no || "",
      doc_date: d.doc_date ? String(d.doc_date).slice(0, 10) : todayISO(),
      vendor_id: d.vendor_id || "",
      vendor_name: d.vendor_name || "",
      vendor_tax_id: d.vendor_tax_id || "",
      vendor_address: d.vendor_address || "",
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
      affiliation: d.affiliation || "",
      items: Array.isArray(d.items) && d.items.length ? d.items : [emptyItem()],
    });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditTarget(null); setForm(emptyForm()); }

  function onVendorChange(vendorId) {
    const v = vendors.find(x => String(x.vendor_id) === String(vendorId));
    if (v) {
      const defaultWht = Number(v.wht_rate) || 0;
      setForm(f => ({
        ...f,
        vendor_id: v.vendor_id,
        vendor_name: v.vendor_name,
        vendor_tax_id: v.tax_id || "",
        vendor_address: [v.address, v.sub_district, v.district, v.province, v.postal_code].filter(Boolean).join(" "),
        wht_rate: defaultWht,
        // ใส่ wht_pct default ให้แต่ละรายการที่ยังไม่มี
        items: f.items.map(it => ({ ...it, wht_pct: it.wht_pct || defaultWht })),
      }));
    } else {
      setForm(f => ({ ...f, vendor_id: "", vendor_name: "", vendor_tax_id: "", vendor_address: "" }));
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
      // ถ้าเลือก expense_code → fill expense_name
      if (field === "expense_code") {
        const ge = generalExpenses.find(g => g.expense_code === val);
        if (ge) items[idx].expense_name = ge.expense_name;
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
  // WHT แยกตามรายการ — คำนวณจากยอด item.amount (กระจายส่วนลดตามสัดส่วน)
  const discountRatio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 1;
  const whtAmount = form.items.reduce((s, it) => {
    const itemAfterDisc = (Number(it.amount) || 0) * discountRatio;
    return s + itemAfterDisc * (Number(it.wht_pct) || 0) / 100;
  }, 0);
  const whtBase = afterDiscount;
  const netToPay = totalIncVat - whtAmount;

  async function handleSave() {
    if (!form.vendor_id && !form.vendor_name) { setMessage("❌ กรุณาเลือก Vendor"); return; }
    if (!form.items.length || form.items.every(it => !it.expense_name && !Number(it.amount))) { setMessage("❌ ต้องมีรายการอย่างน้อย 1 รายการ"); return; }
    setSaving(true);
    try {
      const body = {
        action: "expense_record", op: "save",
        expense_doc_id: editTarget?.expense_doc_id || null,
        doc_date: form.doc_date,
        vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
        vendor_name: form.vendor_name,
        vendor_tax_id: form.vendor_tax_id,
        vendor_address: form.vendor_address,
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
        affiliation: form.affiliation || null,
        items: form.items.filter(it => it.expense_name || Number(it.amount) > 0),
        created_by: currentUser?.username || currentUser?.name || "system",
      };
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data?.expense_doc_id || data?.expense_doc_no || data?.[0]?.expense_doc_id) {
        setMessage(editTarget ? "✅ แก้ไขเรียบร้อย" : `✅ บันทึกเรียบร้อย ${data.expense_doc_no || data?.[0]?.expense_doc_no || ""}`);
        closeForm();
        fetchDocs();
      } else {
        setMessage("❌ บันทึกไม่สำเร็จ");
      }
    } catch (e) { setMessage("❌ " + e.message); }
    setSaving(false);
  }

  async function handleCancel(d) {
    if (!window.confirm(`ยกเลิกเอกสาร ${d.expense_doc_no}?`)) return;
    try {
      await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "expense_record", op: "cancel", expense_doc_id: d.expense_doc_id }),
      });
      setMessage("✅ ยกเลิกเรียบร้อย");
      fetchDocs();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  // สร้างซ้ำ — เปิดฟอร์มใหม่ (ร่าง) โดยดึงข้อมูลจากเอกสารเดิม แต่เป็นใบใหม่
  function openDuplicate(d) {
    setEditTarget(null);
    setForm({
      expense_doc_no: "",
      doc_date: todayISO(),
      vendor_id: d.vendor_id || "",
      vendor_name: d.vendor_name || "",
      vendor_tax_id: d.vendor_tax_id || "",
      vendor_address: d.vendor_address || "",
      reference_no: d.reference_no || "",
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
      affiliation: d.affiliation || "",
      items: Array.isArray(d.items) && d.items.length
        ? d.items.map(it => ({
            expense_code: it.expense_code || "",
            expense_name: it.expense_name || "",
            description: it.description || "",
            qty: Number(it.qty) || 1,
            unit_price: Number(it.unit_price) || 0,
            amount: Number(it.amount) || 0,
            wht_pct: Number(it.wht_pct) || 0,
          }))
        : [emptyItem()],
    });
    setShowForm(true);
    setMessage("📋 สร้างซ้ำจาก " + (d.expense_doc_no || "") + " — ตรวจสอบแล้วกดบันทึก");
  }

  // พิมพ์ — เปิดหน้าต่างใหม่แล้วสั่งพิมพ์ใบค่าใช้จ่าย
  function handlePrint(d) {
    const w = window.open("", "_blank", "width=820,height=960");
    if (!w) { setMessage("❌ เปิดหน้าต่างพิมพ์ไม่ได้ (ป๊อปอัพถูกบล็อก)"); return; }
    const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const items = Array.isArray(d.items) ? d.items : [];
    const rows = items.map((it, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${esc(it.expense_name)}${it.description ? `<div style="color:#6b7280;font-size:11px">${esc(it.description)}</div>` : ""}</td>
        <td style="text-align:right">${fmt(it.qty)}</td>
        <td style="text-align:right">${fmt(it.unit_price)}</td>
        <td style="text-align:right">${fmt(it.amount)}</td>
      </tr>`).join("");
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(d.expense_doc_no)}</title>
      <style>
        *{font-family:'Tahoma','Sarabun',sans-serif;box-sizing:border-box}
        body{margin:24px;color:#111827;font-size:13px}
        h1{font-size:20px;margin:0 0 4px}
        .muted{color:#6b7280}
        .row{display:flex;justify-content:space-between;gap:16px;margin-bottom:12px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #d1d5db;padding:6px 8px}
        th{background:#f3f4f6;text-align:left;font-size:12px}
        tfoot td{border:none;padding:3px 8px}
        .tot{display:flex;justify-content:flex-end;margin-top:10px}
        .tot table{width:320px}
        .tot td{border:none;padding:3px 0}
        @media print{body{margin:0}}
      </style></head><body>
      <div class="row">
        <div>
          <h1>ใบบันทึกค่าใช้จ่าย</h1>
          <div class="muted">เลขที่ <b>${esc(d.expense_doc_no)}</b> · วันที่ ${fmtDate(d.doc_date)}</div>
          ${d.affiliation ? `<div class="muted">สังกัด: ${esc(d.affiliation)}</div>` : ""}
        </div>
        <div style="text-align:right">
          <div><b>${esc(d.vendor_name)}</b></div>
          ${d.vendor_tax_id ? `<div class="muted">เลขผู้เสียภาษี: ${esc(d.vendor_tax_id)}</div>` : ""}
          ${d.vendor_address ? `<div class="muted" style="max-width:300px">${esc(d.vendor_address)}</div>` : ""}
          ${d.reference_no ? `<div class="muted">อ้างอิง: ${esc(d.reference_no)}</div>` : ""}
        </div>
      </div>
      ${d.description ? `<div class="muted">รายละเอียด: ${esc(d.description)}</div>` : ""}
      <table>
        <thead><tr><th style="width:36px;text-align:center">#</th><th>รายการ</th><th style="text-align:right;width:70px">จำนวน</th><th style="text-align:right;width:110px">ราคา/หน่วย</th><th style="text-align:right;width:120px">รวม</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#9ca3af">ไม่มีรายการ</td></tr>`}</tbody>
      </table>
      <div class="tot"><table>
        <tr><td class="muted">รวมเป็นเงิน</td><td style="text-align:right">${fmt(d.subtotal)}</td></tr>
        ${Number(d.discount_amount) > 0 ? `<tr><td class="muted">ส่วนลด</td><td style="text-align:right">-${fmt(d.discount_amount)}</td></tr>` : ""}
        ${Number(d.vat_amount) > 0 ? `<tr><td class="muted">ภาษีมูลค่าเพิ่ม</td><td style="text-align:right">${fmt(d.vat_amount)}</td></tr>` : ""}
        <tr><td><b>จำนวนเงินรวมทั้งสิ้น</b></td><td style="text-align:right"><b>${fmt(d.total)}</b></td></tr>
        ${Number(d.wht_amount) > 0 ? `<tr><td class="muted">หัก ณ ที่จ่าย</td><td style="text-align:right;color:#dc2626">-${fmt(d.wht_amount)}</td></tr>` : ""}
        <tr><td><b>ยอดสุทธิที่ต้องจ่าย</b></td><td style="text-align:right"><b>${fmt(d.net_to_pay || d.total)}</b></td></tr>
      </table></div>
      ${d.note ? `<div class="muted" style="margin-top:14px">หมายเหตุ: ${esc(d.note)}</div>` : ""}
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  }

  // ลบ — ลบถาวร (เฉพาะเอกสารที่ยังไม่ชำระ)
  async function handleDelete(d) {
    if (!window.confirm(`ลบเอกสาร ${d.expense_doc_no}?\n⚠️ ลบถาวร กู้คืนไม่ได้`)) return;
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "expense_record", op: "delete", expense_doc_id: d.expense_doc_id }),
      });
      const data = await res.json();
      const deleted = Number(data?.deleted_count ?? data?.[0]?.deleted_count ?? 0);
      if (deleted > 0) { setMessage("✅ ลบเรียบร้อย"); fetchDocs(); }
      else setMessage("❌ ลบไม่ได้ (เอกสารที่ชำระแล้วต้องยกเลิกใบจ่ายก่อน)");
    } catch (e) { setMessage("❌ ลบไม่สำเร็จ: " + e.message); }
  }

  const kw = search.trim().toLowerCase();
  const filtered = docs.filter(d => {
    if (filterAff && String(d.affiliation || "") !== filterAff) return false;
    if (!kw) return true;
    const hay = [d.expense_doc_no, d.vendor_name, d.reference_no, d.description].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const totalAll = filtered.reduce((s, d) => s + Number(d.total || 0), 0);

  // กรองตามสถานะ (เฉพาะแท็บ "รายการค่าใช้จ่าย")
  const statusOf = d => (d.status || "draft");
  const statusFiltered = filtered.filter(d => statusFilter[statusOf(d)]);
  const statusTotal = statusFiltered.reduce((s, d) => s + Number(d.total || 0), 0);

  // Tab data
  const draftDocs = filtered.filter(d => (d.status || "draft") === "draft");
  const paidDocs = filtered.filter(d => d.status === "paid");
  // Group paid by paid_doc_no
  const paidGroups = {};
  paidDocs.forEach(d => {
    const key = d.paid_doc_no || `_${d.expense_doc_id}`;
    if (!paidGroups[key]) paidGroups[key] = { paid_doc_no: d.paid_doc_no, paid_at: d.paid_at, payment_method: d.payment_method, from_bank_account_id: d.from_bank_account_id, items: [], total: 0, net: 0, wht: 0 };
    paidGroups[key].items.push(d);
    paidGroups[key].total += Number(d.total || 0);
    paidGroups[key].net += Number(d.net_to_pay || d.total || 0);
    paidGroups[key].wht += Number(d.wht_amount || 0);
  });
  const paidGroupsList = Object.values(paidGroups);

  const selectedIds = Object.keys(selected).filter(k => selected[k]).map(Number);
  const selectedRows = draftDocs.filter(d => selectedIds.includes(d.expense_doc_id));
  const selectedNet = selectedRows.reduce((s, d) => s + Number(d.net_to_pay || d.total || 0), 0);

  function toggleOne(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }
  function toggleAll() {
    if (draftDocs.every(d => selected[d.expense_doc_id])) { setSelected({}); return; }
    const next = {};
    draftDocs.forEach(d => { next[d.expense_doc_id] = true; });
    setSelected(next);
  }
  function openPayDialog() {
    if (selectedIds.length === 0) { setMessage("❌ เลือกเอกสารก่อน"); return; }
    setEditPayDocNo(null);
    setEditTotalRequired(0);
    setPayForm({ paid_date: todayISO(), payment_note: "" });
    // เริ่มต้นด้วย 1 แถว ยอดเต็ม = selectedNet
    setPayments([{ method: "โอน", amount: Number(selectedNet) || 0, from_bank_account_id: "" }]);
    setPayDialog(true);
  }
  function openEditPayDialog(g) {
    if (!g.paid_doc_no) return;
    const total = Number(g.net || g.total || 0);
    setEditPayDocNo(g.paid_doc_no);
    setEditTotalRequired(total);  // ใช้ยอดของใบจ่ายที่กำลังแก้
    // แปลงเป็น YYYY-MM-DD โดยใช้ local timezone (กัน UTC shift)
    const toLocalISO = (v) => {
      if (!v) return todayISO();
      const d = new Date(v);
      if (isNaN(d)) return String(v).slice(0, 10);
      const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${dd}`;
    };
    setPayForm({
      paid_date: toLocalISO(g.paid_at),
      payment_note: "",
    });
    // edit mode: เริ่มต้นด้วย 1 row method เดิม + amount เต็ม (ถ้า payment_method='ผสม' ใช้ 'โอน' default)
    const method = g.payment_method && g.payment_method !== "ผสม" ? g.payment_method : "โอน";
    setPayments([{ method, amount: total, from_bank_account_id: g.from_bank_account_id || "" }]);
    setPayDialog(true);
  }
  // helper สำหรับ payment rows
  function updatePayment(idx, patch) {
    setPayments(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  }
  function addPayment() {
    setPayments(prev => [...prev, { method: "เงินสด", amount: 0, from_bank_account_id: "" }]);
  }
  function removePayment(idx) {
    setPayments(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  }
  async function savePayment() {
    const totalRequired = editPayDocNo ? Number(editTotalRequired) || 0 : Number(selectedNet) || 0;
    const sum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    // validate ยอดรวม
    if (Math.abs(sum - totalRequired) > 0.01) {
      setMessage(`❌ ยอดรวมของวิธีการจ่าย (${sum.toFixed(2)}) ต้องเท่ากับยอดที่จะชำระ (${totalRequired.toFixed(2)})`);
      return;
    }
    // validate แต่ละแถว
    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      if (!p.method) { setMessage(`❌ แถวที่ ${i + 1}: เลือกวิธีจ่าย`); return; }
      if (Number(p.amount) <= 0) { setMessage(`❌ แถวที่ ${i + 1}: จำนวนเงินต้องมากกว่า 0`); return; }
      if (p.method === "โอน" && !p.from_bank_account_id) {
        setMessage(`❌ แถวที่ ${i + 1} (โอน): เลือกบัญชี`); return;
      }
    }
    setSavingPay(true);
    try {
      // ส่งเป็น payments array — backend ใหม่จะ handle multi-method
      // backwards-compat: ถ้ามีวิธีเดียว ส่ง field เก่าด้วย เพื่อให้ workflow เก่ายัง work
      const single = payments.length === 1 ? payments[0] : null;
      const ccPayment = payments.find(p => p.method === "ใบลดหนี้");
      const body = {
        action: "expense_record",
        op: editPayDocNo ? "edit_payment" : "save_payment",
        paid_doc_no: editPayDocNo || undefined,
        expense_doc_ids: editPayDocNo ? undefined : selectedIds,
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
        })),
        // ใบลดหนี้ส่วนของ payment (มีหรือไม่มี)
        is_credit_note: !!ccPayment,
        credit_note_amount: ccPayment ? Number(ccPayment.amount) : null,
      };
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setMessage(editPayDocNo ? "✅ แก้ไขใบจ่ายเรียบร้อย" : `✅ บันทึกจ่ายเงินเรียบร้อย ${data?.paid_doc_no || data?.[0]?.paid_doc_no || ""}`);
      setPayDialog(false);
      setEditPayDocNo(null);
      setSelected({});
      fetchDocs();
    } catch (e) { setMessage("❌ " + e.message); }
    setSavingPay(false);
  }
  async function cancelPaymentGroup(g) {
    if (!g.paid_doc_no) return;
    if (!window.confirm(`ยกเลิกใบจ่ายเงิน ${g.paid_doc_no}?\nเอกสาร ${g.items.length} ใบจะกลับเป็น "ร่าง"`)) return;
    try {
      await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "expense_record", op: "cancel_payment", paid_doc_no: g.paid_doc_no }),
      });
      setMessage("✅ ยกเลิกใบจ่ายเรียบร้อย");
      fetchDocs();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📑 บันทึกค่าใช้จ่าย</h2>
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
          ["draft", "📑 รายการค่าใช้จ่าย"],
          ["pay", "💵 บันทึกจ่ายเงิน"],
          ["history", "📋 ประวัติการจ่ายเงิน"],
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
          placeholder="🔎 ค้นหา (เลขเอกสาร / Vendor / รายละเอียด)"
          style={{ ...inp, flex: 1, minWidth: 200 }} />
        <button onClick={fetchDocs} style={btn("#0369a1")}>🔄 รีเฟรช</button>
        {tab === "draft" && <button onClick={openCreate} style={btn("#059669")}>+ เพิ่มค่าใช้จ่าย</button>}
      </div>

      {/* TAB: รายการค่าใช้จ่าย (ทั้งหมด) */}
      {tab === "draft" && (
        <>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
            <span>📑 เอกสาร: <strong>{statusFiltered.length}</strong></span>
            <span style={{ color: "#dc2626" }}>💰 ยอดรวม: <strong>{fmt(statusTotal)}</strong> บาท</span>
            <div style={{ flex: 1 }} />
            <span style={{ color: "#6b7280", fontSize: 13 }}>แสดงสถานะ:</span>
            {[
              { key: "draft", label: "ร่าง", color: "#78350f" },
              { key: "paid", label: "ชำระแล้ว", color: "#065f46" },
              { key: "cancelled", label: "ยกเลิก", color: "#991b1b" },
            ].map(s => (
              <label key={s.key} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 13, fontWeight: 600, color: s.color }}>
                <input type="checkbox" checked={statusFilter[s.key]} onChange={e => setStatusFilter(f => ({ ...f, [s.key]: e.target.checked }))} />
                {s.label}
              </label>
            ))}
          </div>
          <DocsTable docs={statusFiltered} loading={loading} openEdit={openEdit} handleCancel={handleCancel} openDuplicate={openDuplicate} handlePrint={handlePrint} handleDelete={handleDelete} showCheckbox={false} />
        </>
      )}

      {/* TAB: บันทึกจ่ายเงิน — เฉพาะ draft + checkbox + ปุ่มจ่าย */}
      {tab === "pay" && (
        <>
          <div style={{ padding: "10px 14px", background: "#fef9c3", border: "1px solid #fcd34d", borderRadius: 10, marginBottom: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span>เลือก: <strong>{selectedIds.length}</strong> / {draftDocs.length} เอกสาร</span>
            <span style={{ color: "#dc2626" }}>ยอดรวม: <strong>{fmt(selectedNet)}</strong> บาท</span>
            <div style={{ flex: 1 }} />
            <button onClick={openPayDialog} disabled={selectedIds.length === 0}
              style={{ ...btn(selectedIds.length === 0 ? "#9ca3af" : "#059669"), cursor: selectedIds.length === 0 ? "not-allowed" : "pointer" }}>
              💵 บันทึกจ่ายเงิน
            </button>
          </div>
          <DocsTable docs={draftDocs} loading={loading} openEdit={openEdit} handleCancel={handleCancel} openDuplicate={openDuplicate} handlePrint={handlePrint} handleDelete={handleDelete} showCheckbox={true} selected={selected} toggleOne={toggleOne} toggleAll={toggleAll} />
        </>
      )}

      {/* TAB: ประวัติการจ่ายเงิน */}
      {tab === "history" && (
        <>
          <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
            <span>💵 ใบจ่ายเงิน: <strong>{paidGroupsList.length}</strong></span>
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
                      <th style={th}>Vendor</th>
                      <th style={th}>รายละเอียด</th>
                      <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
                      <th style={{ ...th, textAlign: "right" }}>WHT</th>
                      <th style={{ ...th, textAlign: "right" }}>ยอดสุทธิ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map(d => (
                      <tr key={d.expense_doc_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{d.expense_doc_no}</td>
                        <td style={td}>{fmtDate(d.doc_date)}</td>
                        <td style={td}>{d.vendor_name || "-"}</td>
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
        vendors={vendors} generalExpenses={generalExpenses} bankAccounts={bankAccounts}
        onVendorChange={onVendorChange}
        onItemChange={onItemChange} addItem={addItem} removeItem={removeItem}
        subtotal={subtotal} discountAmount={discountAmount} vatAmount={vatAmount}
        totalIncVat={totalIncVat} whtBase={whtBase} whtAmount={whtAmount} netToPay={netToPay}
        onClose={closeForm} onSave={handleSave} saving={saving}
      />}

      {/* Payment Dialog */}
      {payDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !savingPay && setPayDialog(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 760, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: editPayDocNo ? "#7c3aed" : "#072d6b" }}>
              {editPayDocNo ? `✏️ แก้ไขใบจ่ายเงิน — ${editPayDocNo}` : "💵 บันทึกจ่ายเงิน"}
            </h3>
            {!editPayDocNo && (
              <div style={{ background: "#f8fafc", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                <div>📑 เอกสาร: <b>{selectedIds.length}</b> ใบ</div>
                <div>💰 ยอดสุทธิ: <b style={{ color: "#dc2626", fontSize: 18 }}>฿ {fmt(selectedNet)}</b></div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>วันที่จ่าย *</label>
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
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>💳 วิธีการจ่าย</div>
                    <button type="button" onClick={addPayment}
                      style={{ padding: "5px 10px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      + เพิ่มวิธี
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {payments.map((p, idx) => (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "130px 140px 1fr 32px", gap: 10, alignItems: "center" }}>
                        <select value={p.method}
                          onChange={e => updatePayment(idx, { method: e.target.value, from_bank_account_id: e.target.value === "โอน" ? p.from_bank_account_id : "" })}
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }}>
                          <option value="โอน">โอน</option>
                          <option value="เงินสด">เงินสด</option>
                          <option value="เช็ค">เช็ค</option>
                          <option value="ใบลดหนี้">ใบลดหนี้</option>
                        </select>
                        <input type="number" step="0.01" min="0" value={p.amount}
                          onChange={e => updatePayment(idx, { amount: e.target.value })}
                          placeholder="0.00"
                          style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "monospace", fontSize: 13, textAlign: "right" }} />
                        {p.method === "โอน" ? (
                          <select value={p.from_bank_account_id || ""}
                            onChange={e => updatePayment(idx, { from_bank_account_id: e.target.value })}
                            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }}>
                            <option value="">-- เลือกบัญชีโอนจาก --</option>
                            {bankAccounts.map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
                          </select>
                        ) : p.method === "ใบลดหนี้" ? (
                          <div style={{ padding: "7px 10px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, fontSize: 12, color: "#7c2d12", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            📄 จะสร้างใบลดหนี้รับ <code>CN-YYMMDD-XXX</code> ตามจำนวนนี้
                          </div>
                        ) : (
                          <div style={{ padding: "7px 10px", color: "#9ca3af", fontSize: 12 }}>—</div>
                        )}
                        <button type="button" onClick={() => removePayment(idx)} disabled={payments.length === 1}
                          title="ลบแถวนี้"
                          style={{ padding: "5px 8px", background: payments.length === 1 ? "#e5e7eb" : "#fee2e2", color: "#991b1b", border: "none", borderRadius: 6, cursor: payments.length === 1 ? "not-allowed" : "pointer", fontSize: 14 }}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, padding: "8px 12px", background: exact ? "#d1fae5" : Math.abs(diff) > 0 ? "#fef9c3" : "#fff", borderRadius: 6, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                    <span>ยอดที่ต้องชำระ: <strong>฿ {fmt(totalRequired)}</strong></span>
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
                title={!exact ? "ยอดรวมต้องเท่ากับยอดที่จะชำระ" : ""}
                style={{ padding: "8px 20px", background: disabled ? "#9ca3af" : (editPayDocNo ? "#7c3aed" : "#059669"), color: "#fff", border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {savingPay ? "กำลังบันทึก..." : (editPayDocNo ? "💾 บันทึกแก้ไข" : "💾 บันทึกจ่ายเงิน")}
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

function DocsTable({ docs, loading, openEdit, handleCancel, openDuplicate, handlePrint, handleDelete, showCheckbox, selected, toggleOne, toggleAll }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
      {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
       docs.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div> :
       <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "#072d6b", color: "#fff" }}>
          <tr>
            {showCheckbox && <th style={{ ...th, width: 40, textAlign: "center" }}>
              <input type="checkbox" checked={docs.length > 0 && docs.every(d => selected?.[d.expense_doc_id])} onChange={toggleAll} />
            </th>}
            <th style={th}>เลขเอกสาร</th>
            <th style={th}>วันที่</th>
            <th style={th}>สังกัด</th>
            <th style={th}>Vendor</th>
            <th style={th}>เลขที่อ้างอิง</th>
            <th style={th}>รายละเอียด</th>
            <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
            <th style={{ ...th, textAlign: "right" }}>WHT</th>
            <th style={{ ...th, textAlign: "right" }}>ยอดสุทธิ</th>
            <th style={th}>สถานะ</th>
            <th style={{ ...th, width: 60, textAlign: "center" }}>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {docs.map(d => {
            const status = String(d.status || "").toLowerCase();
            return (
              <tr key={d.expense_doc_id} style={{ borderTop: "1px solid #e5e7eb", background: status === "cancelled" ? "#fef2f2" : status === "paid" ? "#f0fdf4" : (selected?.[d.expense_doc_id] ? "#fef3c7" : "transparent") }}>
                {showCheckbox && <td style={{ ...td, textAlign: "center" }}>
                  <input type="checkbox" checked={!!selected?.[d.expense_doc_id]} onChange={() => toggleOne(d.expense_doc_id)} />
                </td>}
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{d.expense_doc_no}</td>
                <td style={td}>{fmtDate(d.doc_date)}</td>
                <td style={td}>{d.affiliation ? <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: d.affiliation === "ป.เปา" ? "#fee2e2" : "#dbeafe", color: d.affiliation === "ป.เปา" ? "#991b1b" : "#1e40af" }}>{d.affiliation}</span> : "-"}</td>
                <td style={td}>{d.vendor_name || "-"}</td>
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
                <td style={{ ...td, textAlign: "center" }}>
                  <KebabMenu d={d} status={status} openEdit={openEdit} handleCancel={handleCancel} openDuplicate={openDuplicate} handlePrint={handlePrint} handleDelete={handleDelete} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>}
    </div>
  );
}

function KebabMenu({ d, status, openEdit, handleCancel, openDuplicate, handlePrint, handleDelete }) {
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
          {status !== "paid" && status !== "cancelled" && <Item icon="🚫" label="ยกเลิก" onClick={run(() => handleCancel(d))} color="#b45309" />}
          {status !== "paid" && <Item icon="🗑️" label="ลบ" onClick={run(() => handleDelete(d))} color="#dc2626" />}
        </div>
      )}
    </>
  );
}

function FormModal({ form, setForm, editTarget, vendors, generalExpenses, bankAccounts, onVendorChange, onItemChange, addItem, removeItem, subtotal, discountAmount, vatAmount, totalIncVat, whtBase, whtAmount, netToPay, onClose, onSave, saving }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: 20, overflowY: "auto" }}
      onClick={() => !saving && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 1100, maxWidth: "98vw", maxHeight: "95vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
          <h3 style={{ margin: 0, color: "#072d6b" }}>{editTarget ? `✏️ แก้ไขค่าใช้จ่าย — ${form.expense_doc_no}` : "📑 บันทึกค่าใช้จ่ายใหม่"}</h3>
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
            <label style={lbl}>Vendor (ผู้จำหน่าย) *</label>
            <select value={form.vendor_id} onChange={e => onVendorChange(e.target.value)} style={inp}>
              <option value="">-- เลือก Vendor --</option>
              {vendors.map(v => <option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}{v.tax_id ? ` (${v.tax_id})` : ""}</option>)}
            </select>
          </div>
          {form.vendor_address && (
            <div style={{ gridColumn: "1 / span 2", padding: "6px 10px", background: "#f8fafc", borderRadius: 6, fontSize: 12, color: "#6b7280" }}>
              📍 {form.vendor_address} {form.vendor_tax_id && <span> · เลขผู้เสียภาษี: <code>{form.vendor_tax_id}</code></span>}
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
                    <select value={it.expense_code} onChange={e => onItemChange(i, "expense_code", e.target.value)} style={inp}>
                      <option value="">-- เลือกหมวด --</option>
                      {generalExpenses.map(g => <option key={g.expense_id} value={g.expense_code}>{g.expense_code} — {g.expense_name}</option>)}
                    </select>
                  </td>
                  <td style={td}>
                    <input type="text" value={it.expense_name} onChange={e => onItemChange(i, "expense_name", e.target.value)} style={inp} />
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
                    <input type="number" step="0.01" value={it.wht_pct} onChange={e => onItemChange(i, "wht_pct", e.target.value)} style={{ ...inp, textAlign: "right" }} />
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
              💡 บันทึกครั้งแรก = สถานะ "ร่าง" → ไปจ่ายเงินที่ Tab <b>"💵 บันทึกจ่ายเงิน"</b>
            </div>
          </div>
          <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
            <Row label="รวมเป็นเงิน" value={fmt(subtotal)} />
            <RowInput label="ส่วนลด %" value={form.discount_pct} onChange={v => setForm(f => ({ ...f, discount_pct: v }))} suffix={`= ${fmt(discountAmount)}`} />
            <Row label="ราคาหลังหักส่วนลด" value={fmt(subtotal - discountAmount)} />
            <RowInput label="ภาษีมูลค่าเพิ่ม %" value={form.vat_pct} onChange={v => setForm(f => ({ ...f, vat_pct: v }))} suffix={`= ${fmt(vatAmount)}`} />
            <Row label="จำนวนเงินรวมทั้งสิ้น" value={fmt(totalIncVat)} bold />
            <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0" }} />
            <Row label="หัก ณ ที่จ่าย (รวมจากรายการ)" value={fmt(whtAmount)} color="#dc2626" />
            <Row label="ยอดเงินสุทธิที่ต้องจ่าย" value={fmt(netToPay)} bold color="#059669" />
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
