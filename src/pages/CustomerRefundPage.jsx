import React, { useEffect, useMemo, useState } from "react";

// บันทึกคืนเงินลูกค้าจากการลดหนี้ / บันทึกรับชำระผิด (Finance — user 2026-09-30)
// ขั้นตอน: 1) เลือกประเภทการรับชำระ (ขายรถ / อะไหล่-บริการ) → 2) เลือกเลขที่ใบเสร็จรับชำระ → 3) ใส่ยอดที่ถูกต้อง → บันทึก (สถานะ รอคืนเงิน)
//          4) กด "คืนเงิน" เลือกวิธีคืน เงินสด / เงินโอน (+บัญชี) → บันทึก (สถานะ คืนเงินแล้ว)
// ใบเสร็จต้นทางไม่ถูกแก้ — ส่วนต่างเก็บเป็นรายการคืนเงินแยก (customer_refunds) · คืนเงินสด → หักในสรุปรายวันรับเงิน (dailyCash) · เงินโอน → รายงานเคลื่อนไหวบัญชี (CTE custrefund_movements)
// backend: customer-refund-api — save_refund / list_refunds / pay_refund / update_refund / cancel_refund
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/customer-refund-api";
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
const PART_SVC_PAY_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-service-payment-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const BRANCH_NAME = { SCY01: "สิงห์ชัย อยุธยา", SCY04: "สิงห์ชัย เสนา", SCY05: "ป.เปา นครหลวง", SCY06: "ป.เปา วังน้อย", SCY07: "สิงห์ชัย ตลาด" };
const SOURCE_LABEL = { vehicle: "ขายรถ", partsvc: "รับชำระอะไหล่/บริการ" };
const REASONS = ["ลดหนี้", "บันทึกรับชำระผิด", "รับชำระเกิน", "คืนส่วนต่างรถเทิร์น"]; // รับชำระเกิน = ลูกค้าจ่ายมามากกว่ายอด (หน้าขาย NEW รับเกินได้ตั้งแต่ 2026-10-09) // คืนส่วนต่างรถเทิร์น = ตีเทิร์นเกินยอดดาวน์ ลูกค้ารับเงินส่วนเกินกลับ (user 2026-10-01)
const STATUS_STYLE = { "รอคืนเงิน": { bg: "#fef3c7", fg: "#92400e" }, "คืนเงินแล้ว": { bg: "#dcfce7", fg: "#166534" }, "ยกเลิก": { bg: "#f3f4f6", fg: "#6b7280" } };

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = (await res.text()).trim();
  try { return t ? JSON.parse(t) : {}; } catch { return {}; }
}
const num = (v) => { const n = Number(String(v ?? "").replace(/,/g, "")); return isFinite(n) ? n : 0; };
const baht = (n) => num(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => fmt(new Date());
const shiftDate = (iso, days) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days); return fmt(d); };
const thaiDate = (iso) => { if (!iso) return "-"; const s = String(iso).slice(0, 10); const [y, m, d] = s.split("-"); return y && m && d ? `${d}/${m}/${Number(y) + 543}` : s; };
const unwrapList = (d) => { try { return typeof d?.listjson === "string" ? JSON.parse(d.listjson) : Array.isArray(d?.listjson) ? d.listjson : Array.isArray(d) ? d : []; } catch { return []; } };
const bc5 = (c) => String(c || "").substring(0, 5).toUpperCase();
const bankLabelOf = (a) => [a.bank_name, a.account_no, a.account_name].filter(Boolean).join(" · ");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const parseJSON = (v) => { try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return null; } };
/** สรุปวิธีชำระของใบเสร็จต้นทางเป็นข้อความสั้น */
function methodsText(r) {
  if (r.payment_methods !== undefined) {
    const pm = parseJSON(r.payment_methods);
    if (Array.isArray(pm)) return pm.map((m) => `${m.method || m.type || "?"} ${baht(m.amount)}`).join(" + ");
  }
  const br = parseJSON(r.payment_breakdowns);
  if (Array.isArray(br) && br.length) return br.map((m) => `${m.method || "?"} ${baht(m.amount)}`).join(" + ");
  return r.payment_method || "-";
}

const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,.05)" };
const inp = { width: "100%", padding: "7px 9px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };
const lbl = { display: "block", fontSize: 12, color: "#4b5563", marginBottom: 3, fontWeight: 600 };
const btn = (bg, extra = {}) => ({ padding: "7px 14px", background: bg, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, ...extra });
const th = { padding: "6px 8px", background: "#f3f4f6", borderBottom: "2px solid #e5e7eb", fontSize: 12, textAlign: "left", whiteSpace: "nowrap" };
const td = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6", fontSize: 12.5, verticalAlign: "top" };

export default function CustomerRefundPage({ currentUser }) {
  const userName = currentUser?.display_name || currentUser?.username || currentUser?.name || "";
  const myBranch = bc5(currentUser?.branch_code || currentUser?.branch);
  const isAdmin = String(currentUser?.role || "").toLowerCase() === "admin";

  // ---------- ขั้นที่ 1–3: เลือกใบเสร็จ + ยอดที่ถูกต้อง ----------
  const [sourceType, setSourceType] = useState("vehicle");
  const [rcFrom, setRcFrom] = useState(shiftDate(todayStr(), -60));
  const [rcTo, setRcTo] = useState(todayStr());
  const [rcKeyword, setRcKeyword] = useState("");
  const [receipts, setReceipts] = useState([]);
  const [rcLoading, setRcLoading] = useState(false);
  const [picked, setPicked] = useState(null); // ใบเสร็จที่เลือก (normalized)
  const [correctAmount, setCorrectAmount] = useState("");
  const [reason, setReason] = useState("ลดหนี้");
  const [reasonNote, setReasonNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // ---------- รายการคืนเงิน ----------
  const [refunds, setRefunds] = useState([]);
  const [rfFrom, setRfFrom] = useState(shiftDate(todayStr(), -90));
  const [rfTo, setRfTo] = useState(todayStr());
  const [rfStatus, setRfStatus] = useState("");
  const [rfKeyword, setRfKeyword] = useState("");
  const [rfLoading, setRfLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [payDlg, setPayDlg] = useState(null); // { row, refund_method, refund_account_id, refund_date, refund_ref }
  const [editDlg, setEditDlg] = useState(null); // { row, correct_amount, reason, reason_note, note }

  useEffect(() => {
    post(ACC_API, { action: "list_bank_accounts", include_inactive: "false" })
      .then((d) => setBankAccounts((Array.isArray(d) ? d : []).filter((a) => a && a.account_id && a.account_type !== "เงินสดย่อย" && a.account_type !== "ลูกหนี้")))
      .catch(() => {});
  }, []);

  async function loadRefunds() {
    setRfLoading(true);
    try {
      const d = await post(API, { action: "list_refunds", date_from: rfFrom, date_to: rfTo, status: rfStatus, keyword: rfKeyword.trim(), limit: 1000 });
      if (d?.__error) throw new Error(d.__error);
      setRefunds(unwrapList(d).filter((r) => r && r.id));
    } catch (e) { setMessage("❌ โหลดรายการคืนเงินไม่สำเร็จ (import workflow customer-refund-api แล้วหรือยัง?) " + (e?.message || "")); setRefunds([]); }
    setRfLoading(false);
  }
  useEffect(() => { loadRefunds(); }, []); // eslint-disable-line

  /** ใบเสร็จที่มีรายการคืนเงินอยู่แล้ว (ยังไม่ยกเลิก) → กันบันทึกซ้ำ */
  const refundedReceiptSet = useMemo(() => new Set(refunds.filter((r) => r.status !== "ยกเลิก").map((r) => `${r.source_type}|${r.receipt_no}`)), [refunds]);

  /** โหลดใบเสร็จรับชำระตามประเภท → normalize เป็นโครงเดียว */
  async function loadReceipts() {
    setRcLoading(true); setMessage("");
    try {
      let rows = [];
      if (sourceType === "vehicle") {
        const [d, sl] = await Promise.all([
          post(RETAIL_API, { action: "list_sale_payments", date_from: rcFrom, date_to: rcTo }),
          post(RETAIL_API, { action: "list_retail_sales", date_from: shiftDate(rcFrom, -120), limit: 5000 }).catch(() => []),
        ]);
        // ยอดที่ลูกค้าต้องชำระจริง = total_payment − เงินดาวน์/ค่างวดออกแทน (สูตรเดียวกับหน้ารับชำระใบขาย)
        const payoutMap = new Map((Array.isArray(sl) ? sl : []).filter((x) => x && x.invoice_no).map((x) => [String(x.invoice_no), num(x.down_payout_amount)]));
        rows = (Array.isArray(d) ? d : []).filter((r) => r && r.receipt_no).map((r) => ({
          source_type: "vehicle", receipt_no: r.receipt_no, ref_doc_no: r.sale_no, receipt_date: String(r.receipt_date || r.sale_date || "").slice(0, 10),
          branch_code: r.branch_code, customer_name: r.customer_name, customer_phone: "", paid_amount: num(r.paid_amount),
          bill_amount: Math.max(0, num(r.total_payment) - (payoutMap.get(String(r.sale_no)) || 0)), methods: methodsText(r), extra: [r.finance_type, r.finance_company_name].filter(Boolean).join(" "),
        }));
      } else {
        const d = await post(PART_SVC_PAY_API, { action: "list_payments", date_from: rcFrom, date_to: rcTo });
        rows = unwrapList(d).filter((r) => r && r.payment_id && r.status === "active").map((r) => ({
          source_type: "partsvc", receipt_no: r.receipt_no || `#${r.payment_id}`, ref_doc_no: r.doc_no, receipt_date: String(r.paid_date || r.paid_at || "").slice(0, 10),
          branch_code: r.branch_code, customer_name: r.customer_name, customer_phone: r.customer_phone || "", paid_amount: num(r.paid_amount),
          bill_amount: num(r.bill_amount), methods: methodsText(r), extra: r.doc_type || "",
        }));
      }
      rows.sort((a, b) => String(b.receipt_date).localeCompare(String(a.receipt_date)) || String(b.receipt_no).localeCompare(String(a.receipt_no)));
      setReceipts(rows);
      if (!rows.length) setMessage("ไม่พบใบเสร็จรับชำระในช่วงวันที่ที่เลือก");
    } catch (e) { setMessage("❌ โหลดใบเสร็จไม่สำเร็จ " + (e?.message || "")); setReceipts([]); }
    setRcLoading(false);
  }
  useEffect(() => { setPicked(null); setReceipts([]); setCorrectAmount(""); }, [sourceType]);

  const shownReceipts = useMemo(() => {
    const kw = rcKeyword.trim().toLowerCase();
    return receipts
      .filter((r) => isAdmin || !myBranch || bc5(r.branch_code) === myBranch)
      .filter((r) => !kw || [r.receipt_no, r.ref_doc_no, r.customer_name, r.customer_phone].filter(Boolean).join(" ").toLowerCase().includes(kw))
      .slice(0, 300);
  }, [receipts, rcKeyword, isAdmin, myBranch]);

  const refundAmount = picked ? Math.round((num(picked.paid_amount) - num(correctAmount)) * 100) / 100 : 0;
  // ยอดที่ต้องชำระตามใบขาย/บิล (0 = ไม่ทราบ) — ยอดที่ถูกต้องต่ำกว่านี้ = คืนเงินเกินกว่าที่ควร → เตือน + ยืนยันอีกชั้น (user 2026-10-01)
  const dueAmount = picked ? num(picked.bill_amount) : 0;
  const belowDue = picked && correctAmount !== "" && dueAmount > 0 && num(correctAmount) < dueAmount - 0.009;
  const aboveDue = picked && correctAmount !== "" && dueAmount > 0 && num(correctAmount) > dueAmount + 0.009;
  const correctValid = picked && correctAmount !== "" && num(correctAmount) >= 0 && refundAmount > 0;

  async function saveRefund() {
    if (!picked) { setMessage("❌ เลือกเลขที่ใบเสร็จรับชำระก่อน"); return; }
    if (!correctValid) { setMessage("❌ ยอดที่ถูกต้องต้องไม่ติดลบ และน้อยกว่ายอดที่รับไว้ (ยอดคืนต้องมากกว่า 0)"); return; }
    if (refundedReceiptSet.has(`${picked.source_type}|${picked.receipt_no}`)) { setMessage(`❌ ใบเสร็จ ${picked.receipt_no} มีรายการคืนเงินอยู่แล้ว (ดูในตารางด้านล่าง)`); return; }
    if (belowDue && !window.confirm(`⚠️ ยอดที่ถูกต้อง ${baht(correctAmount)} ต่ำกว่ายอดที่ต้องชำระตามเอกสาร ${baht(dueAmount)} บาท
จะคืนเงินเกินกว่าที่ควร ${baht(dueAmount - num(correctAmount))} บาท

ตรวจสอบแล้วและต้องการบันทึกต่อ?`)) return;
    if (!window.confirm(`บันทึกคืนเงินใบเสร็จ ${picked.receipt_no}\nลูกค้า ${picked.customer_name || "-"}\nรับไว้ ${baht(picked.paid_amount)} → ยอดที่ถูกต้อง ${baht(correctAmount)}\nยอดคืน ${baht(refundAmount)} บาท (${reason})\n\nยืนยัน?`)) return;
    setSaving(true); setMessage("");
    try {
      const d = await post(API, {
        action: "save_refund", source_type: picked.source_type, receipt_no: picked.receipt_no, ref_doc_no: picked.ref_doc_no, receipt_date: picked.receipt_date,
        branch_code: picked.branch_code, customer_name: picked.customer_name, customer_phone: picked.customer_phone,
        paid_amount: num(picked.paid_amount), correct_amount: num(correctAmount), reason, reason_note: reasonNote.trim(), created_by: userName,
      });
      if (d?.__error) throw new Error(d.__error);
      if (!d?.refund_no) throw new Error("ใบเสร็จนี้มีรายการคืนเงินอยู่แล้ว หรือบันทึกไม่สำเร็จ");
      setMessage(`✅ บันทึกแล้ว ${d.refund_no} ยอดคืน ${baht(d.refund_amount)} บาท — กด "คืนเงิน" ในตารางด้านล่างเมื่อจ่ายเงินคืนลูกค้า`);
      setPicked(null); setCorrectAmount(""); setReasonNote("");
      await loadRefunds();
      setPayDlg({ row: d, refund_method: "เงินสด", refund_account_id: "", refund_date: todayStr(), refund_ref: "" });
    } catch (e) { setMessage("❌ " + (e?.message || "บันทึกไม่สำเร็จ")); }
    setSaving(false);
  }

  async function payRefund() {
    const p = payDlg; if (!p) return;
    if (p.refund_method === "เงินโอน" && !p.refund_account_id) { alert("เลือกบัญชีที่โอนออก"); return; }
    const acc = bankAccounts.find((a) => String(a.account_id) === String(p.refund_account_id));
    setSaving(true);
    try {
      const d = await post(API, {
        action: "pay_refund", id: p.row.id, refund_method: p.refund_method, refund_account_id: p.refund_method === "เงินโอน" ? p.refund_account_id : "",
        refund_account_name: acc ? bankLabelOf(acc) : "", refund_date: p.refund_date, refund_ref: p.refund_ref.trim(), refunded_by: userName,
      });
      if (d?.__error) throw new Error(d.__error);
      if (!d?.id) throw new Error("รายการนี้ไม่อยู่ในสถานะรอคืนเงิน");
      setMessage(`✅ คืนเงิน ${d.refund_no} ${baht(d.refund_amount)} บาท (${d.refund_method}) แล้ว`);
      setPayDlg(null); await loadRefunds();
    } catch (e) { alert("❌ " + (e?.message || "บันทึกไม่สำเร็จ")); }
    setSaving(false);
  }

  async function saveEdit() {
    const e0 = editDlg; if (!e0) return;
    const ra = Math.round((num(e0.row.paid_amount) - num(e0.correct_amount)) * 100) / 100;
    if (e0.correct_amount === "" || num(e0.correct_amount) < 0 || ra <= 0) { alert("ยอดที่ถูกต้องต้องไม่ติดลบ และน้อยกว่ายอดที่รับไว้"); return; }
    setSaving(true);
    try {
      const d = await post(API, { action: "update_refund", id: e0.row.id, correct_amount: num(e0.correct_amount), reason: e0.reason, reason_note: e0.reason_note.trim(), note: e0.note.trim(), updated_by: userName });
      if (d?.__error) throw new Error(d.__error);
      if (!d?.id) throw new Error("แก้ไขได้เฉพาะสถานะรอคืนเงิน");
      setMessage(`✅ แก้ไข ${d.refund_no} ยอดคืน ${baht(d.refund_amount)} บาท แล้ว`);
      setEditDlg(null); await loadRefunds();
    } catch (e) { alert("❌ " + (e?.message || "บันทึกไม่สำเร็จ")); }
    setSaving(false);
  }

  async function cancelRefund(r) {
    const why = window.prompt(`ยกเลิกรายการคืนเงิน ${r.refund_no} (${r.customer_name || "-"} ${baht(r.refund_amount)} บาท)${r.status === "คืนเงินแล้ว" ? "\n⚠️ รายการนี้คืนเงินไปแล้ว การยกเลิกจะเอายอดหักออกจากสรุปรายวัน/เคลื่อนไหวบัญชี" : ""}\nระบุเหตุผล:`);
    if (why == null) return;
    if (!why.trim()) { alert("ต้องระบุเหตุผล"); return; }
    setSaving(true);
    try {
      const d = await post(API, { action: "cancel_refund", id: r.id, reason: why.trim(), cancelled_by: userName });
      if (d?.__error) throw new Error(d.__error);
      setMessage(`✅ ยกเลิก ${r.refund_no} แล้ว`); await loadRefunds();
    } catch (e) { alert("❌ " + (e?.message || "ยกเลิกไม่สำเร็จ")); }
    setSaving(false);
  }

  function printRefund(r) {
    const w = window.open("", "_blank"); if (!w) return;
    const branch = BRANCH_NAME[bc5(r.branch_code)] || r.branch_code || "-";
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบคืนเงิน ${esc(r.refund_no)}</title>
<style>@page{size:A5 landscape;margin:12mm} body{font-family:'TH Sarabun New',Tahoma,sans-serif;font-size:15pt;color:#111;margin:0}
h2{margin:0 0 4px;font-size:20pt} .sub{font-size:12pt;color:#555;margin-bottom:10px} table{border-collapse:collapse;width:100%} td{padding:3px 6px;vertical-align:top}
td.k{width:34%;color:#444} .amt{font-size:18pt;font-weight:700} .sig{display:flex;justify-content:space-between;margin-top:26px;font-size:13pt} .sig div{width:44%;text-align:center;border-top:1px dotted #444;padding-top:4px}
.tb{position:fixed;top:6px;right:8px} @media print{.tb{display:none}}</style></head><body>
<div class="tb"><button onclick="window.print()">🖨️ พิมพ์</button></div>
<h2>ใบคืนเงินลูกค้า (${esc(r.reason || "ลดหนี้")})</h2>
<div class="sub">เลขที่ ${esc(r.refund_no)} · สาขา ${esc(branch)} · วันที่บันทึก ${thaiDate(r.created_at)}</div>
<table>
<tr><td class="k">ลูกค้า</td><td><b>${esc(r.customer_name || "-")}</b>${r.customer_phone ? " โทร. " + esc(r.customer_phone) : ""}</td></tr>
<tr><td class="k">อ้างอิงใบเสร็จรับชำระ (${esc(SOURCE_LABEL[r.source_type] || r.source_type)})</td><td>${esc(r.receipt_no)} ลงวันที่ ${thaiDate(r.receipt_date)}${r.ref_doc_no ? " · เอกสาร " + esc(r.ref_doc_no) : ""}</td></tr>
<tr><td class="k">ยอดที่รับชำระไว้</td><td>${baht(r.paid_amount)} บาท</td></tr>
<tr><td class="k">ยอดที่ถูกต้อง</td><td>${baht(r.correct_amount)} บาท</td></tr>
<tr><td class="k">ยอดเงินคืน</td><td class="amt">${baht(r.refund_amount)} บาท</td></tr>
<tr><td class="k">เหตุผล</td><td>${esc(r.reason || "-")}${r.reason_note ? " — " + esc(r.reason_note) : ""}</td></tr>
<tr><td class="k">วิธีคืนเงิน</td><td>${r.status === "คืนเงินแล้ว" ? esc(r.refund_method || "-") + (r.refund_account_name ? " · " + esc(r.refund_account_name) : "") + " · วันที่ " + thaiDate(r.refund_date) + (r.refund_ref ? " · อ้างอิง " + esc(r.refund_ref) : "") : "(ยังไม่คืนเงิน)"}</td></tr>
</table>
<div class="sig"><div>ผู้จ่ายเงินคืน ${esc(r.refunded_by || r.created_by || "")}</div><div>ผู้รับเงินคืน (ลูกค้า)</div></div>
</body></html>`);
    w.document.close();
  }

  const totals = useMemo(() => {
    const t = { pending: 0, paid: 0 };
    for (const r of refunds) { if (r.status === "รอคืนเงิน") t.pending += num(r.refund_amount); else if (r.status === "คืนเงินแล้ว") t.paid += num(r.refund_amount); }
    return t;
  }, [refunds]);

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 4px" }}>💸 บันทึกคืนเงินลูกค้า (ลดหนี้ / บันทึกรับชำระผิด)</h2>
      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 12 }}>
        เลือกประเภทการรับชำระ → เลือกเลขที่ใบเสร็จรับชำระ → ใส่ยอดที่ถูกต้อง → บันทึก → เลือกวิธีคืนเงิน (เงินสด / เงินโอน) → บันทึก · ใบเสร็จต้นทางไม่ถูกแก้ไข ระบบเก็บส่วนต่างเป็นรายการคืนเงินแยก
        · คืนเงินสดจะหักในสรุปรายวันรับเงิน ณ วันคืนเงิน · เงินโอนเข้ารายงานเคลื่อนไหวบัญชี
      </div>
      {message && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: message.startsWith("❌") ? "#fee2e2" : message.startsWith("✅") ? "#dcfce7" : "#fef9c3", fontSize: 13 }}>{message}</div>}

      {/* ---------- ขั้นที่ 1–3 ---------- */}
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>1️⃣ ประเภทการรับชำระ</div>
        <div style={{ display: "flex", gap: 18, marginBottom: 12, fontSize: 14 }}>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => (
            <label key={k} style={{ cursor: "pointer", padding: "6px 14px", borderRadius: 8, border: sourceType === k ? "2px solid #0369a1" : "1px solid #d1d5db", background: sourceType === k ? "#e0f2fe" : "#fff", fontWeight: sourceType === k ? 700 : 400 }}>
              <input type="radio" name="srcType" checked={sourceType === k} onChange={() => setSourceType(k)} style={{ marginRight: 6 }} />{k === "vehicle" ? "🏍️ " : "🔧 "}{v}
            </label>))}
        </div>

        <div style={{ fontWeight: 700, marginBottom: 8 }}>2️⃣ เลือกเลขที่ใบเสร็จรับชำระ</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 8 }}>
          <div><label style={lbl}>วันที่รับชำระ จาก</label><input type="date" value={rcFrom} onChange={(e) => setRcFrom(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>ถึง</label><input type="date" value={rcTo} onChange={(e) => setRcTo(e.target.value)} style={inp} /></div>
          <button onClick={loadReceipts} disabled={rcLoading} style={btn("#0369a1")}>{rcLoading ? "กำลังโหลด…" : "🔍 ค้นหาใบเสร็จ"}</button>
          <div style={{ flex: 1, minWidth: 240 }}><label style={lbl}>กรอง: เลขที่ใบเสร็จ / เลขเอกสาร / ชื่อลูกค้า</label><input value={rcKeyword} onChange={(e) => setRcKeyword(e.target.value)} placeholder="พิมพ์เพื่อกรองรายการที่โหลดมา" style={inp} /></div>
          {picked && <button onClick={() => { setPicked(null); setCorrectAmount(""); }} style={btn("#6b7280")}>เปลี่ยนใบเสร็จ</button>}
        </div>
        {!picked && receipts.length > 0 && (
          <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}></th><th style={th}>เลขที่ใบเสร็จ</th><th style={th}>วันที่</th><th style={th}>สาขา</th><th style={th}>เอกสาร</th><th style={th}>ลูกค้า</th><th style={{ ...th, textAlign: "right" }}>ยอดรับชำระ</th><th style={th}>วิธีชำระ</th></tr></thead>
              <tbody>
                {shownReceipts.map((r) => {
                  const dup = refundedReceiptSet.has(`${r.source_type}|${r.receipt_no}`);
                  return (
                    <tr key={r.receipt_no + r.ref_doc_no} style={{ background: dup ? "#f9fafb" : "#fff", color: dup ? "#9ca3af" : "#111" }}>
                      <td style={td}>{dup ? <span style={{ fontSize: 11 }}>มีรายการคืนแล้ว</span> : <button onClick={() => { setPicked(r); setCorrectAmount(""); setMessage(""); }} style={btn("#16a34a", { padding: "4px 10px", fontSize: 12 })}>เลือก</button>}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{r.receipt_no}</td>
                      <td style={td}>{thaiDate(r.receipt_date)}</td>
                      <td style={td}>{r.branch_code || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{r.ref_doc_no || "-"}{r.extra ? <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "inherit" }}>{r.extra}</div> : null}</td>
                      <td style={td}>{r.customer_name || "-"}{r.customer_phone ? <div style={{ fontSize: 11, color: "#6b7280" }}>{r.customer_phone}</div> : null}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{baht(r.paid_amount)}</td>
                      <td style={{ ...td, fontSize: 11.5, color: "#4b5563" }}>{r.methods}</td>
                    </tr>);
                })}
                {shownReceipts.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#9ca3af" }}>ไม่พบใบเสร็จตามคำค้น</td></tr>}
              </tbody>
            </table>
            {receipts.length > 300 && <div style={{ fontSize: 11, color: "#6b7280", padding: 6 }}>แสดง 300 รายการแรก — พิมพ์กรองเพื่อหาใบที่ต้องการ</div>}
          </div>)}
        {!picked && receipts.length === 0 && <div style={{ fontSize: 12.5, color: "#9ca3af", padding: 8 }}>กด "ค้นหาใบเสร็จ" เพื่อโหลดใบเสร็จรับชำระ{SOURCE_LABEL[sourceType]}ในช่วงวันที่</div>}

        {picked && (
          <div style={{ border: "1px solid #bae6fd", background: "#f0f9ff", borderRadius: 10, padding: 12, marginTop: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 13, marginBottom: 12 }}>
              <div><div style={lbl}>เลขที่ใบเสร็จ</div><div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{picked.receipt_no}</div></div>
              <div><div style={lbl}>วันที่รับชำระ</div><div>{thaiDate(picked.receipt_date)} · {picked.branch_code}</div></div>
              <div><div style={lbl}>เอกสารอ้างอิง</div><div style={{ fontFamily: "monospace" }}>{picked.ref_doc_no || "-"}</div></div>
              <div><div style={lbl}>ลูกค้า</div><div style={{ fontWeight: 600 }}>{picked.customer_name || "-"}</div></div>
              <div><div style={lbl}>ยอดที่ต้องชำระตามเอกสาร</div><div style={{ fontWeight: 700, color: "#0369a1" }}>{dueAmount > 0 ? baht(dueAmount) : "-"}{dueAmount > 0 && Math.abs(dueAmount - num(picked.paid_amount)) > 0.009 && <button onClick={() => setCorrectAmount(String(dueAmount))} style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", border: "1px solid #0369a1", background: "#fff", color: "#0369a1", borderRadius: 6, cursor: "pointer" }}>ใช้ยอดนี้</button>}</div></div>
              <div><div style={lbl}>วิธีชำระเดิม</div><div style={{ fontSize: 12 }}>{picked.methods}</div></div>
            </div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>3️⃣ ยอดเงินที่ถูกต้อง</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div><label style={lbl}>ยอดที่รับชำระไว้</label><div style={{ ...inp, background: "#f3f4f6", fontWeight: 700, textAlign: "right", width: 150 }}>{baht(picked.paid_amount)}</div></div>
              <div><label style={lbl}>ยอดที่ถูกต้อง (บาท) *</label><input type="number" min="0" step="0.01" value={correctAmount} onChange={(e) => setCorrectAmount(e.target.value)} autoFocus placeholder="0.00" style={{ ...inp, width: 150, textAlign: "right", fontWeight: 700 }} /></div>
              <div><label style={lbl}>ยอดเงินคืนลูกค้า</label><div style={{ ...inp, width: 150, textAlign: "right", fontWeight: 800, fontSize: 15, color: refundAmount > 0 ? "#b91c1c" : "#9ca3af", background: "#fff7ed" }}>{correctAmount === "" ? "-" : baht(refundAmount)}</div></div>
              <div><label style={lbl}>เหตุผล</label><select value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inp, width: 180 }}>{REASONS.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div style={{ flex: 1, minWidth: 220 }}><label style={lbl}>รายละเอียด (ถ้ามี)</label><input value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} placeholder="เช่น ลดค่าบริการ 200 / คีย์ยอดเกิน" style={inp} /></div>
              <button onClick={saveRefund} disabled={saving || !correctValid} style={btn(correctValid ? "#16a34a" : "#9ca3af")}>{saving ? "กำลังบันทึก…" : "💾 บันทึก (รอคืนเงิน)"}</button>
            </div>
            {belowDue && <div style={{ fontSize: 12.5, color: "#b91c1c", fontWeight: 700, marginTop: 6, background: "#fee2e2", padding: "6px 10px", borderRadius: 6 }}>⚠️ ยอดที่ถูกต้องต่ำกว่ายอดที่ต้องชำระตามเอกสาร ({baht(dueAmount)}) — จะคืนเงินเกินกว่าที่ควร {baht(dueAmount - num(correctAmount))} บาท ตรวจสอบก่อนบันทึก</div>}
            {aboveDue && refundAmount > 0 && <div style={{ fontSize: 12, color: "#92400e", marginTop: 6 }}>หมายเหตุ: ยอดที่ถูกต้องสูงกว่ายอดที่ต้องชำระตามเอกสาร ({baht(dueAmount)})</div>}
            {correctAmount !== "" && refundAmount <= 0 && <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 6 }}>ยอดที่ถูกต้องต้องน้อยกว่ายอดที่รับไว้ จึงมียอดคืน</div>}
          </div>)}
      </div>

      {/* ---------- รายการคืนเงิน ---------- */}
      <div style={card}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, marginRight: 8 }}>4️⃣ รายการคืนเงิน</div>
          <div><label style={lbl}>วันที่บันทึก จาก</label><input type="date" value={rfFrom} onChange={(e) => setRfFrom(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>ถึง</label><input type="date" value={rfTo} onChange={(e) => setRfTo(e.target.value)} style={inp} /></div>
          <div><label style={lbl}>สถานะ</label><select value={rfStatus} onChange={(e) => setRfStatus(e.target.value)} style={inp}><option value="">ทั้งหมด</option><option>รอคืนเงิน</option><option>คืนเงินแล้ว</option><option>ยกเลิก</option></select></div>
          <div style={{ minWidth: 200 }}><label style={lbl}>ค้นหา</label><input value={rfKeyword} onChange={(e) => setRfKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadRefunds()} placeholder="เลขที่ / ใบเสร็จ / ลูกค้า" style={inp} /></div>
          <button onClick={loadRefunds} disabled={rfLoading} style={btn("#0369a1")}>{rfLoading ? "กำลังโหลด…" : "🔄 แสดง"}</button>
          <div style={{ marginLeft: "auto", fontSize: 12.5, color: "#374151" }}>
            รอคืนเงิน <b style={{ color: "#92400e" }}>{baht(totals.pending)}</b> · คืนแล้ว <b style={{ color: "#166534" }}>{baht(totals.paid)}</b> บาท
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>เลขที่</th><th style={th}>วันที่บันทึก</th><th style={th}>ประเภท</th><th style={th}>ใบเสร็จ / เอกสาร</th><th style={th}>สาขา</th><th style={th}>ลูกค้า</th>
              <th style={{ ...th, textAlign: "right" }}>รับไว้</th><th style={{ ...th, textAlign: "right" }}>ที่ถูกต้อง</th><th style={{ ...th, textAlign: "right" }}>ยอดคืน</th>
              <th style={th}>เหตุผล</th><th style={th}>สถานะ</th><th style={th}>คืนเงิน</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {refunds.map((r) => {
                const st = STATUS_STYLE[r.status] || STATUS_STYLE["ยกเลิก"];
                return (
                  <tr key={r.id} style={{ opacity: r.status === "ยกเลิก" ? 0.55 : 1 }}>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{r.refund_no}</td>
                    <td style={td}>{thaiDate(r.created_at)}<div style={{ fontSize: 11, color: "#6b7280" }}>{r.created_by || ""}</div></td>
                    <td style={td}>{SOURCE_LABEL[r.source_type] || r.source_type}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{r.receipt_no}<div style={{ fontSize: 11, color: "#6b7280" }}>{r.ref_doc_no || ""} · {thaiDate(r.receipt_date)}</div></td>
                    <td style={td}>{r.branch_code || "-"}</td>
                    <td style={td}>{r.customer_name || "-"}</td>
                    <td style={{ ...td, textAlign: "right" }}>{baht(r.paid_amount)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{baht(r.correct_amount)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>{baht(r.refund_amount)}</td>
                    <td style={{ ...td, fontSize: 12 }}>{r.reason || "-"}{r.reason_note ? <div style={{ fontSize: 11, color: "#6b7280" }}>{r.reason_note}</div> : null}</td>
                    <td style={td}><span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11.5, fontWeight: 700, background: st.bg, color: st.fg }}>{r.status}</span>
                      {r.status === "ยกเลิก" && r.cancel_reason ? <div style={{ fontSize: 11, color: "#6b7280" }}>{r.cancel_reason}</div> : null}</td>
                    <td style={{ ...td, fontSize: 12 }}>
                      {r.status === "คืนเงินแล้ว" ? <>
                        <b>{r.refund_method}</b> {thaiDate(r.refund_date)}
                        {r.refund_account_name ? <div style={{ fontSize: 11, color: "#6b7280" }}>{r.refund_account_name}</div> : null}
                        {r.refund_ref ? <div style={{ fontSize: 11, color: "#6b7280" }}>อ้างอิง {r.refund_ref}</div> : null}
                        <div style={{ fontSize: 11, color: "#6b7280" }}>โดย {r.refunded_by || "-"}</div>
                      </> : r.status === "รอคืนเงิน" ? (
                        <button onClick={() => setPayDlg({ row: r, refund_method: "เงินสด", refund_account_id: "", refund_date: todayStr(), refund_ref: "" })} style={btn("#d97706", { padding: "4px 10px", fontSize: 12 })}>💸 คืนเงิน</button>
                      ) : "-"}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <button onClick={() => printRefund(r)} title="พิมพ์ใบคืนเงิน" style={btn("#4b5563", { padding: "3px 8px", fontSize: 12, marginRight: 4 })}>🖨️</button>
                      {r.status === "รอคืนเงิน" && <button onClick={() => setEditDlg({ row: r, correct_amount: String(num(r.correct_amount)), reason: r.reason || "ลดหนี้", reason_note: r.reason_note || "", note: r.note || "" })} title="แก้ไขยอด" style={btn("#0369a1", { padding: "3px 8px", fontSize: 12, marginRight: 4 })}>✏️</button>}
                      {r.status !== "ยกเลิก" && (r.status === "รอคืนเงิน" || isAdmin) && <button onClick={() => cancelRefund(r)} title="ยกเลิก" style={btn("#dc2626", { padding: "3px 8px", fontSize: 12 })}>ยกเลิก</button>}
                    </td>
                  </tr>);
              })}
              {refunds.length === 0 && <tr><td colSpan={13} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 16 }}>{rfLoading ? "กำลังโหลด…" : "ยังไม่มีรายการคืนเงิน"}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- dialog คืนเงิน ---------- */}
      {payDlg && (
        <div onClick={() => !saving && setPayDlg(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: 460, maxWidth: "94vw", boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>💸 คืนเงินลูกค้า {payDlg.row.refund_no}</div>
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
              {payDlg.row.customer_name || "-"} · ใบเสร็จ {payDlg.row.receipt_no}<br />
              ยอดคืน <b style={{ color: "#b91c1c", fontSize: 16 }}>{baht(payDlg.row.refund_amount)}</b> บาท
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>วิธีการชำระคืน</label>
              <div style={{ display: "flex", gap: 14, fontSize: 14 }}>
                {["เงินสด", "เงินโอน"].map((m) => (
                  <label key={m} style={{ cursor: "pointer", padding: "6px 14px", borderRadius: 8, border: payDlg.refund_method === m ? "2px solid #d97706" : "1px solid #d1d5db", background: payDlg.refund_method === m ? "#fffbeb" : "#fff", fontWeight: payDlg.refund_method === m ? 700 : 400 }}>
                    <input type="radio" name="rfMethod" checked={payDlg.refund_method === m} onChange={() => setPayDlg({ ...payDlg, refund_method: m })} style={{ marginRight: 6 }} />{m === "เงินสด" ? "💵 เงินสด (หักสรุปรายวัน)" : "🏦 เงินโอน (ตัดบัญชี)"}
                  </label>))}
              </div>
            </div>
            {payDlg.refund_method === "เงินโอน" && (
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>บัญชีที่โอนออก *</label>
                <select value={payDlg.refund_account_id} onChange={(e) => setPayDlg({ ...payDlg, refund_account_id: e.target.value })} style={inp}>
                  <option value="">-- เลือกบัญชี --</option>
                  {bankAccounts.map((a) => <option key={a.account_id} value={a.account_id}>{bankLabelOf(a)}</option>)}
                </select>
              </div>)}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div><label style={lbl}>วันที่คืนเงิน</label><input type="date" value={payDlg.refund_date} onChange={(e) => setPayDlg({ ...payDlg, refund_date: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>อ้างอิง (เลขสลิป/หมายเหตุ)</label><input value={payDlg.refund_ref} onChange={(e) => setPayDlg({ ...payDlg, refund_ref: e.target.value })} style={inp} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setPayDlg(null)} disabled={saving} style={btn("#6b7280")}>ยังไม่คืนตอนนี้</button>
              <button onClick={payRefund} disabled={saving} style={btn("#16a34a")}>{saving ? "กำลังบันทึก…" : "💾 บันทึกคืนเงิน"}</button>
            </div>
          </div>
        </div>)}

      {/* ---------- dialog แก้ไขยอด ---------- */}
      {editDlg && (
        <div onClick={() => !saving && setEditDlg(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: 440, maxWidth: "94vw" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>✏️ แก้ไข {editDlg.row.refund_no}</div>
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 10 }}>ใบเสร็จ {editDlg.row.receipt_no} · รับไว้ {baht(editDlg.row.paid_amount)} บาท</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>ยอดที่ถูกต้อง *</label><input type="number" min="0" step="0.01" value={editDlg.correct_amount} onChange={(e) => setEditDlg({ ...editDlg, correct_amount: e.target.value })} style={{ ...inp, textAlign: "right", fontWeight: 700 }} /></div>
              <div><label style={lbl}>ยอดคืน</label><div style={{ ...inp, background: "#fff7ed", textAlign: "right", fontWeight: 800, color: "#b91c1c" }}>{baht(num(editDlg.row.paid_amount) - num(editDlg.correct_amount))}</div></div>
              <div><label style={lbl}>เหตุผล</label><select value={editDlg.reason} onChange={(e) => setEditDlg({ ...editDlg, reason: e.target.value })} style={inp}>{REASONS.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div><label style={lbl}>รายละเอียด</label><input value={editDlg.reason_note} onChange={(e) => setEditDlg({ ...editDlg, reason_note: e.target.value })} style={inp} /></div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>หมายเหตุ</label><input value={editDlg.note} onChange={(e) => setEditDlg({ ...editDlg, note: e.target.value })} style={inp} /></div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditDlg(null)} disabled={saving} style={btn("#6b7280")}>ปิด</button>
              <button onClick={saveEdit} disabled={saving} style={btn("#16a34a")}>{saving ? "กำลังบันทึก…" : "💾 บันทึก"}</button>
            </div>
          </div>
        </div>)}
    </div>
  );
}
