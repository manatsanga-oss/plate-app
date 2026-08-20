import { useState, useEffect, useMemo } from "react";

// รับชำระเงินค่าอะไหล่และบริการ — พิมพ์เลขที่ใบขาย/ใบ JOB เอง + รับได้หลายวิธีในใบเดียว + ดึงเงินมัดจำ PDS/PDO มาตัดได้
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-service-payment-api";
const DEPOSIT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-deposit-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const CUST_SEARCH_API = "https://n8n-new-project-gwf2.onrender.com/webhook/booking-deposit-api"; // action: search_customers — ฐานลูกค้า+QR/LINE+ใบขาย
const SPARE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api"; // get_spare_orders — เช็คสถานะปิดงานซ่อม/ปิดงานขายของใบมัดจำ

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

// วิธีรับชำระ — E-คูปอง ต้องกรอกเลขที่คูปอง (user สั่งเอา QR/อื่นๆ ออก 2026-08-19)
const PAY_METHODS = ["เงินสด", "เงินโอน", "มัดจำ", "E-คูปอง"];
const DOC_TYPES = ["ใบแจ้งซ่อม/JOB", "ใบขายอะไหล่", "อื่นๆ"];
// สาขาสังกัด ป.เปา (SCY05/06): เติมตัวนำเลขเอกสารให้ — ใบแจ้งซ่อม = 69SERV/ · ใบขายอะไหล่ = 69RTSL/ (ปี พ.ศ. 2 หลักตามปีปัจจุบัน)
const isPorpaoBranch = (bc) => { const c = String(bc || "").toUpperCase(); return c.startsWith("SCY05") || c.startsWith("SCY06"); };
const beYY = () => String((new Date().getFullYear() + 543) % 100).padStart(2, "0");
const docPrefixOf = (docType, branch) => {
  if (!isPorpaoBranch(branch)) return "";
  if (docType === "ใบแจ้งซ่อม/JOB") return `${beYY()}SERV/`;
  if (docType === "ใบขายอะไหล่") return `${beYY()}RTSL/`;
  return "";
};

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

export default function PartServicePaymentPage({ currentUser }) {
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const isAdmin = currentUser?.role === "admin";
  // แก้ไข/ยกเลิกรับชำระข้ามวัน = admin เท่านั้น (วันเดียวกับวันที่รับเงิน user ทำได้)
  const isSameDay = (d) => String(d || "").slice(0, 10) === new Date().toISOString().slice(0, 10);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // ===== ฟอร์มบันทึก =====
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [docNo, setDocNo] = useState(() => docPrefixOf(DOC_TYPES[0], myBranch));

  // เปลี่ยนประเภทเอกสาร → เปลี่ยนตัวนำให้ (เฉพาะตอนช่องยังว่างหรือยังเป็นตัวนำเดิม ไม่ทับเลขที่พิมพ์ไปแล้ว)
  function changeDocType(t) {
    setDocType(t);
    setDocNo(prev => {
      const p = String(prev || "").trim();
      const isBarePrefix = !p || DOC_TYPES.some(dt => p === docPrefixOf(dt, myBranch) && p !== "");
      return (!p || isBarePrefix) ? docPrefixOf(t, myBranch) : p;
    });
    // ช่องชื่อว่างอยู่ → เติม default "เงินสด" (ลูกค้าหน้าร้านส่วนใหญ่ไม่ระบุชื่อ — แก้ทับ/กดค้นหาได้)
    setCustomerName(prev => String(prev || "").trim() ? prev : "เงินสด");
  }
  // ชื่อลูกค้า default "เงินสด" ทุกประเภทเอกสาร (user สั่ง 2026-08-19)
  const [customerName, setCustomerName] = useState("เงินสด");
  const branchCode = myBranch; // สาขาไม่ต้องเลือก — default ตาม user ที่ login
  const [paidDate, setPaidDate] = useState(todayISO());
  const [billAmount, setBillAmount] = useState(""); // จำนวนเงินที่ต้องชำระทั้งหมด — ใส่ก่อน แล้วค่อยเลือกวิธีรับชำระ
  const [rows, setRows] = useState([{ method: "เงินสด", amount: "", account: "", deposit_doc_no: "", coupon_no: "" }]);
  const [note, setNote] = useState("");

  // ใส่ยอดที่ต้องชำระ → เติมยอดให้วิธีแรกอัตโนมัติ (ถ้ายังมีวิธีเดียวและไม่ใช่มัดจำ)
  function changeBillAmount(v) {
    setBillAmount(v);
    setRows(rs => (rs.length === 1 && rs[0].method !== "มัดจำ") ? [{ ...rs[0], amount: v }] : rs);
  }

  // ===== popup ค้นหาลูกค้า (พิมพ์เองก็ได้) =====
  const [custPop, setCustPop] = useState(false);
  const [custKw, setCustKw] = useState("");
  const [custResults, setCustResults] = useState(null); // null = ยังไม่ได้ค้น
  const [custSearching, setCustSearching] = useState(false);

  async function searchCustomers() {
    const kw = custKw.trim();
    if (!kw || custSearching) return;
    setCustSearching(true);
    try {
      const res = await fetch(CUST_SEARCH_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search_customers", keyword: kw }),
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

  // ===== master: บัญชีรับโอน + ใบมัดจำคงเหลือ =====
  const [bankAccounts, setBankAccounts] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const bankLabelOf = (a) => [a.bank_name, a.account_no, a.account_name].filter(Boolean).join(" · ");
  // เลือกวิธี "เงินโอน" ที่สาขา ป.เปา (SCY05/06) → default บัญชี ธ.กรุงเทพ ป.เปา ให้เลย (เปลี่ยนได้)
  const defaultTransferAccount = () => {
    if (!["SCY05", "SCY06"].includes(myBranch)) return "";
    const a = bankAccounts.find(x => String(x.bank_name || "").includes("กรุงเทพ") && String(x.account_name || "").includes("ป.เปา"));
    return a ? bankLabelOf(a) : "";
  };

  useEffect(() => {
    fetch(ACC_API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
    }).then(r => r.json()).then(d => setBankAccounts(Array.isArray(d) ? d : [])).catch(() => {});
    loadDeposits();
    // eslint-disable-next-line
  }, []);

  // ยอดมัดจำที่ใช้ได้: ใบสั่งซื้อ "ตัดใช้" remaining เป็น 0 ตอนสร้างใบ (งานยังไม่ปิด เงินยังอยู่) → fallback ไปยอดมัดจำเต็ม
  const depositAvail = (dep) => num(dep.remaining_amount) > 0 ? num(dep.remaining_amount) : num(dep.deposit_amount);

  // dropdown มัดจำ: ขึ้นเฉพาะใบที่ชื่อลูกค้าตรงกับชื่อในฟอร์ม (ตัดช่องว่าง/คำนำหน้า เทียบแบบมีส่วนตรงกัน)
  const normName = (s) => String(s || "").replace(/\s+/g, "").replace(/^(นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.|ว่าที่ร\.ต\.|MR\.?|MRS\.?|MS\.?|MISS)/i, "").toUpperCase();
  // ชื่อ default "เงินสด" ไม่ใช่ชื่อลูกค้าจริง — ห้ามใช้จับคู่ใบมัดจำ (มัดจำต้องชื่อตรงกันเท่านั้น)
  const hasRealCustomer = !!customerName.trim() && customerName.trim() !== "เงินสด";
  const matchedDeposits = useMemo(() => {
    if (!hasRealCustomer) return [];
    const kw = normName(customerName);
    if (!kw) return [];
    return deposits.filter(dp => {
      const dn = normName(dp.customer_name);
      return dn && (dn.includes(kw) || kw.includes(dn));
    });
  }, [deposits, customerName]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDeposits() {
    // เงินมัดจำคงเหลือ = ใบมัดจำที่งานยังไม่ปิด (ปิดงานซ่อม/ปิดงานขาย = ตัดออก) และยังไม่ถูกใช้รับชำระในหน้านี้
    try {
      const [dRes, oRes, pRes] = await Promise.all([
        fetch(DEPOSIT_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_deposits", limit: 1000 }),
        }).then(r => r.json()).catch(() => []),
        fetch(SPARE_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_spare_orders" }),
        }).then(r => r.json()).catch(() => []),
        fetch(API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_payments" }),
        }).then(r => r.json()).catch(() => []),
      ]);
      const orders = Array.isArray(oRes) ? oRes : (oRes && Array.isArray(oRes.data) ? oRes.data : []);
      const closedDocs = new Set(
        orders.filter(o => o && o.deposit_doc_no && ["ปิดงานซ่อม", "ปิดการขาย"].includes(String(o.status || "").trim())).map(o => o.deposit_doc_no)
      );
      // ใบมัดจำที่ถูกใช้รับชำระไปแล้ว (รายการ active) — กันเลือกซ้ำ
      const usedDocs = new Set();
      for (const p of (Array.isArray(pRes) ? pRes : [])) {
        if (!p || p.status !== "active" || !p.deposit_doc_no) continue;
        String(p.deposit_doc_no).split(" / ").forEach(x => x.trim() && usedDocs.add(x.trim()));
      }
      setDeposits((Array.isArray(dRes) ? dRes : [])
        .filter(r => r && r.deposit_doc_no && r.status === "active"
          && depositAvail(r) > 0
          && !closedDocs.has(r.deposit_doc_no)
          && !usedDocs.has(r.deposit_doc_no)));
    } catch { setDeposits([]); }
  }

  const setRow = (i, patch) => setRows(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
  const total = rows.reduce((s, r) => s + num(r.amount), 0);

  function pickDeposit(i, docNo2) {
    const dep = deposits.find(d => d.deposit_doc_no === docNo2);
    setRow(i, { deposit_doc_no: docNo2, amount: dep ? depositAvail(dep) : "" });
    // ชื่อลูกค้าขึ้นตรงกับใบมัดจำที่เลือก
    if (dep && String(dep.customer_name || "").trim()) setCustomerName(String(dep.customer_name).trim());
  }

  async function save() {
    const list = rows.filter(r => num(r.amount) > 0);
    if (!docNo.trim() || docNo.trim() === docPrefixOf(docType, myBranch)) { setMessage("❌ พิมพ์เลขที่ใบขาย/ใบ JOB ให้ครบก่อน"); return; }
    if (!num(billAmount)) { setMessage("❌ ใส่จำนวนเงินที่ต้องชำระทั้งหมดก่อน"); return; }
    if (!list.length) { setMessage("❌ ใส่ยอดรับชำระอย่างน้อย 1 วิธี"); return; }
    if (Math.abs(total - num(billAmount)) >= 0.01 &&
        !window.confirm(`รวมรับชำระ ${fmt(total)} ไม่เท่ายอดที่ต้องชำระ ${fmt(billAmount)}\nบันทึกต่อหรือไม่?`)) return;
    if (list.some(r => r.method === "เงินโอน" && !r.account)) { setMessage("❌ เลือกบัญชีรับโอนเงินของรายการเงินโอนก่อน"); return; }
    if (list.some(r => r.method === "E-คูปอง" && !String(r.coupon_no || "").trim())) { setMessage("❌ กรอกเลขที่ E-คูปอง ของรายการ E-คูปอง ก่อน"); return; }
    for (const r of list.filter(r2 => r2.method === "มัดจำ")) {
      if (!r.deposit_doc_no) { setMessage("❌ เลือกใบมัดจำของรายการมัดจำก่อน"); return; }
      if (!matchedDeposits.find(d => d.deposit_doc_no === r.deposit_doc_no)) {
        setMessage(`❌ ใบมัดจำ ${r.deposit_doc_no} ไม่ตรงกับชื่อลูกค้า "${customerName}" — เลือกใหม่`); return;
      }
      const dep = deposits.find(d => d.deposit_doc_no === r.deposit_doc_no);
      if (dep && num(r.amount) > depositAvail(dep)) {
        setMessage(`❌ ยอดมัดจำ ${r.deposit_doc_no} เกินคงเหลือ (${fmt(depositAvail(dep))})`); return;
      }
    }
    setSaving(true); setMessage("");
    try {
      const res = await fetch(API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_payment",
          doc_no: docNo.trim(), doc_type: docType,
          customer_name: customerName, branch_code: branchCode,
          paid_date: paidDate, bill_amount: num(billAmount),
          payments: list.map(r => ({ method: r.method, amount: num(r.amount), account: r.method === "เงินโอน" ? r.account : "", deposit_doc_no: r.method === "มัดจำ" ? r.deposit_doc_no : "", coupon_no: r.method === "E-คูปอง" ? String(r.coupon_no || "").trim() : "" })),
          // แนบเลข E-คูปอง เข้าหมายเหตุด้วย — เห็นในรายการ/รายงานได้ทันทีแม้ workflow เก่ายังไม่เก็บ coupon_no ใน breakdowns
          payment_note: (() => {
            const cps = list.filter(r => r.method === "E-คูปอง" && String(r.coupon_no || "").trim()).map(r => String(r.coupon_no).trim());
            return cps.length ? [note, `E-คูปอง: ${cps.join(", ")}`].filter(Boolean).join(" | ") : note;
          })(),
          received_by: currentUser?.username || currentUser?.name || "",
        }),
      });
      const d = await res.json();
      const row = Array.isArray(d) ? d[0] : d;
      if (!row?.payment_id) throw new Error(row?.error || "workflow ยังไม่รองรับ — import Part_Service_Payment_Workflow.json ก่อน");
      setMessage(`✅ บันทึกรับชำระแล้ว — เลขที่ใบเสร็จ ${row.receipt_no || "-"} · อ้างอิง ${docNo.trim()} · ยอด ${fmt(total)} บาท`);
      setDocNo(docPrefixOf(docType, myBranch)); setCustomerName("เงินสด"); setNote(""); setBillAmount("");
      setRows([{ method: "เงินสด", amount: "", account: "", deposit_doc_no: "", coupon_no: "" }]);
      loadDeposits(); loadPayments();
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + String(e.message || e).slice(0, 160));
    }
    setSaving(false);
  }

  // ===== รายการรับชำระที่บันทึกแล้ว =====
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadPayments() {
    setLoading(true);
    try {
      const res = await fetch(API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_payments", date_from: dateFrom, date_to: dateTo }),
      });
      const d = await res.json();
      setPayments((Array.isArray(d) ? d : []).filter(r => r && r.payment_id));
    } catch { setPayments([]); }
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPayments(); }, []);

  async function cancelPayment(p) {
    if (!window.confirm(`ยกเลิกรับชำระ ${p.doc_no} ยอด ${fmt(p.paid_amount)} บาท?${num(p.deposit_amount) > 0 ? `\n(ยอดมัดจำ ${fmt(p.deposit_amount)} จะคืนกลับเข้าใบมัดจำเดิม)` : ""}`)) return;
    try {
      let bks = [];
      try { bks = JSON.parse(p.payment_breakdowns || "[]"); } catch { bks = []; }
      const restores = (Array.isArray(bks) ? bks : [])
        .filter(b => String(b.method || "").includes("มัดจำ") && b.deposit_doc_no && num(b.amount) > 0)
        .map(b => ({ deposit_doc_no: b.deposit_doc_no, amount: num(b.amount) }));
      const res = await fetch(API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_payment", payment_id: p.payment_id, deposit_restores: restores }),
      });
      const d = await res.json();
      const row = Array.isArray(d) ? d[0] : d;
      if (!row?.payment_id) throw new Error("ยกเลิกไม่สำเร็จ (อาจถูกยกเลิกไปแล้ว)");
      setMessage(`✅ ยกเลิกรับชำระ ${p.doc_no} แล้ว`);
      loadDeposits(); loadPayments();
    } catch (e) {
      setMessage("❌ " + String(e.message || e).slice(0, 160));
    }
  }

  // แก้ไขได้เฉพาะ "เลขที่เอกสารอ้างอิง" ที่พิมพ์เอง (พิมพ์ผิด) — ยอด/วิธีชำระ/มัดจำ ห้ามแก้ (ต้องยกเลิกแล้วบันทึกใหม่)
  async function editDocNo(p) {
    const newDoc = window.prompt(`แก้ไขเลขที่เอกสารอ้างอิงของใบเสร็จ ${p.receipt_no || p.payment_id}\n(แก้ได้เฉพาะเลขที่เอกสาร — ยอดเงินแก้ไม่ได้)`, p.doc_no || "");
    if (newDoc == null) return;
    const doc = String(newDoc).trim();
    if (!doc) { setMessage("❌ เลขที่เอกสารห้ามว่าง"); return; }
    if (doc === String(p.doc_no || "").trim()) return;
    try {
      const res = await fetch(API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_doc_no", payment_id: p.payment_id, doc_no: doc }),
      });
      const d = await res.json();
      const row = Array.isArray(d) ? d[0] : d;
      if (!row?.payment_id) throw new Error(row?.error || "workflow ยังไม่รองรับ — re-import Part_Service_Payment_Workflow.json ก่อน");
      setMessage(`✅ แก้เลขที่เอกสารเป็น ${doc} แล้ว (ใบเสร็จ ${row.receipt_no || "-"})`);
      loadPayments();
    } catch (e) {
      setMessage("❌ " + String(e.message || e).slice(0, 160));
    }
  }

  const activeSum = useMemo(() => payments.filter(p => p.status === "active").reduce((s, p) => s + num(p.paid_amount), 0), [payments]);

  return (
    <div style={{ maxWidth: 1100 }}>
      <h2 style={{ color: "#072d6b", marginTop: 0 }}>💵 รับชำระเงินค่าอะไหล่และบริการ</h2>
      {message && (
        <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 14, background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("✅") ? "#047857" : "#b91c1c", border: `1px solid ${message.startsWith("✅") ? "#a7f3d0" : "#fecaca"}` }}>
          {message}
        </div>
      )}

      {/* ===== ฟอร์มบันทึก ===== */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <Field label="วันที่รับเงิน *">
            <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} style={inp} />
          </Field>
          <Field label="ประเภทเอกสาร * (เลือกก่อน)">
            <select value={docType} onChange={e => changeDocType(e.target.value)} style={{ ...inp, fontWeight: 600 }}>
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="เลขที่เอกสาร * (พิมพ์เอง)">
            <input value={docNo} onChange={e => setDocNo(e.target.value)} style={{ ...inp, fontFamily: "monospace", fontWeight: 700 }}
              placeholder={docType === "ใบขายอะไหล่" ? "เช่น 69RTSL/0000468" : docType === "ใบแจ้งซ่อม/JOB" ? "เลขที่ใบ JOB" : "เลขที่เอกสาร"} />
          </Field>
          <Field label="ชื่อลูกค้า (กดค้นหา หรือพิมพ์เอง)">
            <div style={{ display: "flex", gap: 6 }}>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} style={{ ...inp, flex: 1 }} />
              <button onClick={() => { setCustPop(true); setCustKw(customerName); setCustResults(null); }} title="ค้นหาลูกค้าจากฐานข้อมูล"
                style={{ border: "1px solid #1d4ed8", background: "#eff6ff", color: "#1d4ed8", borderRadius: 7, padding: "0 12px", cursor: "pointer", fontSize: 15, flex: "0 0 auto" }}>🔍</button>
            </div>
          </Field>
        </div>

        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 12px", margin: "6px 0 10px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>จำนวนเงินที่ต้องชำระทั้งหมด (บาท) *</div>
          <input type="number" step="0.01" value={billAmount} onChange={e => changeBillAmount(e.target.value)}
            style={{ ...inp, width: 180, textAlign: "right", fontWeight: 800, fontSize: 17, border: "2px solid #1d4ed8" }} placeholder="0.00" />
          <div style={{ fontSize: 12.5, color: "#64748b" }}>ใส่ยอดนี้ก่อน แล้วค่อยเลือกวิธีรับชำระด้านล่าง</div>
        </div>

        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>วิธีรับชำระ * (เพิ่มได้หลายวิธี — เลือก "มัดจำ" เพื่อตัดเงินมัดจำอะไหล่/บริการ)</div>
          {rows.map((r, i) => (
            <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", marginBottom: 6, background: "#f9fafb" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select value={r.method} onChange={e => setRow(i, { method: e.target.value, account: e.target.value === "เงินโอน" ? defaultTransferAccount() : "", deposit_doc_no: "", coupon_no: "" })} style={{ ...inp, width: 110, flex: "0 0 auto" }}>
                  {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="number" step="0.01" placeholder="ยอด (บาท)" value={r.amount}
                  onChange={e => setRow(i, { amount: e.target.value })}
                  style={{ ...inp, flex: 1, minWidth: 120, textAlign: "right", fontWeight: 700 }} />
                {rows.length > 1 && (
                  <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}
                    style={{ border: "none", background: "#fee2e2", color: "#b91c1c", borderRadius: 6, width: 28, height: 28, cursor: "pointer", flex: "0 0 auto" }}>✕</button>
                )}
              </div>
              {r.method === "เงินโอน" && (
                <div style={{ marginTop: 6 }}>
                  <select value={r.account} onChange={e => setRow(i, { account: e.target.value })}
                    style={{ ...inp, background: r.account ? "#fff" : "#fffbeb" }}>
                    <option value="">— เลือกบัญชีรับโอน —</option>
                    {bankAccounts.map(a => <option key={a.id || bankLabelOf(a)} value={bankLabelOf(a)}>{bankLabelOf(a)}</option>)}
                  </select>
                </div>
              )}
              {r.method === "E-คูปอง" && (
                <div style={{ marginTop: 6 }}>
                  <input value={r.coupon_no || ""} onChange={e => setRow(i, { coupon_no: e.target.value })}
                    placeholder="เลขที่ E-คูปอง * (บังคับกรอก)"
                    style={{ ...inp, fontFamily: "monospace", background: (r.coupon_no || "").trim() ? "#fff" : "#fffbeb" }} />
                </div>
              )}
              {r.method === "มัดจำ" && (
                <div style={{ marginTop: 6 }}>
                  {!hasRealCustomer ? (
                    <div style={{ fontSize: 12.5, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 7, padding: "7px 10px" }}>
                      ⚠ ใส่ชื่อลูกค้าจริงด้านบนก่อน (ไม่ใช่ "เงินสด") — ใบมัดจำต้องชื่อลูกค้าตรงกันเท่านั้น
                    </div>
                  ) : !matchedDeposits.length ? (
                    <div style={{ fontSize: 12.5, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "7px 10px" }}>
                      ไม่พบใบมัดจำคงเหลือของ "{customerName}" (เฉพาะงานที่ยังไม่ปิดซ่อม/ปิดขาย)
                    </div>
                  ) : (
                    <select value={r.deposit_doc_no} onChange={e => pickDeposit(i, e.target.value)}
                      style={{ ...inp, background: r.deposit_doc_no ? "#fff" : "#fffbeb" }}>
                      <option value="">— เลือกใบมัดจำของ {customerName} ({matchedDeposits.length} ใบ) —</option>
                      {matchedDeposits.map(dp => (
                        <option key={dp.deposit_doc_no} value={dp.deposit_doc_no}>
                          {dp.deposit_doc_no} · {dp.customer_name} · คงเหลือ {fmt(depositAvail(dp))}
                        </option>
                      ))}
                    </select>
                  )}
                  {r.deposit_doc_no && (() => {
                    const dp = deposits.find(x => x.deposit_doc_no === r.deposit_doc_no);
                    return dp ? <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 3 }}>มัดจำ{dp.deposit_type} · {dp.customer_name} · คงเหลือ {fmt(depositAvail(dp))} บาท (ตัดได้ไม่เกินนี้)</div> : null;
                  })()}
                </div>
              )}
            </div>
          ))}
          <button onClick={() => setRows(rs => [...rs, { method: "เงินโอน", amount: Math.max(0, Math.round((num(billAmount) - total) * 100) / 100) || "", account: defaultTransferAccount(), deposit_doc_no: "", coupon_no: "" }])}
            style={{ border: "1px dashed #059669", background: "#f0fdf4", color: "#047857", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>
            ＋ เพิ่มวิธีรับชำระ
          </button>
          <span style={{ marginLeft: 14, fontSize: 14 }}>
            รวมรับชำระ: <b style={{ color: num(billAmount) > 0 && Math.abs(total - num(billAmount)) < 0.01 ? "#059669" : "#b45309", fontSize: 16 }}>{fmt(total)}</b>
            {num(billAmount) > 0 && <> / ต้องชำระ {fmt(billAmount)} บาท
              {Math.abs(total - num(billAmount)) >= 0.01 && <b style={{ color: "#b45309" }}> (ขาด/เกิน {fmt(num(billAmount) - total)})</b>}
            </>}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Field label="หมายเหตุ">
              <input value={note} onChange={e => setNote(e.target.value)} style={inp} placeholder="เช่น เลขอ้างอิงโอน" />
            </Field>
          </div>
          <button onClick={save} disabled={saving}
            style={{ padding: "9px 26px", background: saving ? "#93c5fd" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            {saving ? "กำลังบันทึก..." : "💾 บันทึกรับชำระ"}
          </button>
        </div>
      </div>

      {/* ===== รายการรับชำระ ===== */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 10 }}>
          <h3 style={{ margin: 0, color: "#072d6b", flex: 1, minWidth: 200 }}>📋 รายการรับชำระ</h3>
          <div><div style={{ fontSize: 12, fontWeight: 600 }}>ตั้งแต่วันที่</div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} /></div>
          <div><div style={{ fontSize: 12, fontWeight: 600 }}>ถึงวันที่</div>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} /></div>
          <button onClick={loadPayments} disabled={loading}
            style={{ padding: "8px 18px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
            {loading ? "กำลังโหลด..." : "🔍 แสดงรายการ"}
          </button>
        </div>
        <div style={{ fontSize: 13.5, marginBottom: 8 }}>
          รวมรับชำระ (ไม่รวมที่ยกเลิก): <b style={{ color: "#059669" }}>{fmt(activeSum)}</b> บาท · {payments.filter(p => p.status === "active").length} รายการ
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f0f4f9" }}>
              <tr>
                <th style={th}>#</th><th style={th}>วันที่รับเงิน</th><th style={th}>เลขที่ใบเสร็จ</th><th style={th}>เอกสารอ้างอิง</th>
                <th style={th}>ประเภท</th><th style={th}>ลูกค้า</th><th style={th}>สาขา</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดที่ต้องชำระ</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดรับ</th><th style={th}>วิธีรับชำระ</th>
                <th style={{ ...th, textAlign: "right" }}>ตัดมัดจำ</th><th style={th}>ผู้บันทึก</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.payment_id} style={{ borderTop: "1px solid #e5e7eb", background: p.status === "cancelled" ? "#fef2f2" : undefined, color: p.status === "cancelled" ? "#9ca3af" : undefined }}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{thaiDate(p.paid_date)}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: p.status === "cancelled" ? "#9ca3af" : "#1d4ed8", textDecoration: p.status === "cancelled" ? "line-through" : "none" }}>{p.receipt_no || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", textDecoration: p.status === "cancelled" ? "line-through" : "none" }}>{p.doc_no}</td>
                  <td style={td}>{p.doc_type || "-"}</td>
                  <td style={td}>{p.customer_name || "-"}</td>
                  <td style={td}>{p.branch_code || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{num(p.bill_amount) > 0 ? fmt(p.bill_amount) : "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: p.status === "cancelled" ? "#9ca3af" : "#059669" }}>{fmt(p.paid_amount)}</td>
                  <td style={td}>
                    {p.payment_method || "-"}
                    {p.deposit_doc_no ? <div style={{ fontSize: 11.5, color: "#7c3aed" }}>{p.deposit_doc_no}</div> : null}
                    {p.payment_note ? <div style={{ fontSize: 11.5, color: "#64748b" }}>{p.payment_note}</div> : null}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#7c3aed" }}>{num(p.deposit_amount) > 0 ? fmt(p.deposit_amount) : "-"}</td>
                  <td style={td}>{p.received_by || "-"}</td>
                  <td style={td}>
                    {p.status === "cancelled" ? (
                      <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>ยกเลิกแล้ว</span>
                    ) : (isAdmin || isSameDay(p.paid_date)) ? (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <button onClick={() => editDocNo(p)} title="แก้ไขเฉพาะเลขที่เอกสารอ้างอิง"
                          style={{ border: "1px solid #93c5fd", background: "#fff", color: "#1d4ed8", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12 }}>แก้ไข</button>
                        <button onClick={() => cancelPayment(p)}
                          style={{ border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12 }}>ยกเลิก</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: "#9ca3af" }} title="รับชำระข้ามวันแล้ว — แก้ไข/ยกเลิกได้เฉพาะ admin">🔒 admin</span>
                    )}
                  </td>
                </tr>
              ))}
              {!payments.length && (
                <tr><td colSpan={13} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 20 }}>ไม่มีรายการรับชำระในช่วงวันที่ที่เลือก</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== popup ค้นหาลูกค้า ===== */}
      {custPop && (
        <div onClick={() => setCustPop(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
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
              <div style={{ fontSize: 13, color: "#94a3b8" }}>พิมพ์คำค้นแล้วกด Enter — ค้นจากฐานลูกค้า + QR/LINE + ใบขาย</div>
            ) : !custResults.length ? (
              <div style={{ fontSize: 13.5, color: "#b45309" }}>ไม่พบลูกค้า — ปิดหน้าต่างนี้แล้วพิมพ์ชื่อเองได้เลย</div>
            ) : (
              custResults.map((c, i) => (
                <div key={i} onClick={() => { setCustomerName(String(c.customer_name || "").trim()); setCustPop(false); }}
                  style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 6, cursor: "pointer", background: "#f9fafb" }}
                  onMouseOver={e => e.currentTarget.style.background = "#eff6ff"}
                  onMouseOut={e => e.currentTarget.style.background = "#f9fafb"}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.customer_name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {[c.customer_phone, c.customer_code, c.source_label || c.source].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
