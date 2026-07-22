import React, { useEffect, useMemo, useState } from "react";
import CustomerPickerModal from "./CustomerPickerModal";

// ระบบมัดจำอะไหล่ — บันทึกรับเงินมัดจำเอง (โครงข้อมูลเดียวกับมัดจำที่ upload จาก NID/DMS)
// แท็บ "มัดจำอะไหล่บริการ" หน้าตาแบบ NID: เลือกรถจากเลขเครื่อง/ตัวถังก่อน → เพิ่มข้อมูล → ชำระโดย → ตกลง
// รองรับ ใบรับมัดจำ / ใบคืนมัดจำ · แท็บ "มัดจำอะไหล่สั่งซื้อ" ฟอร์มย่อ (ไม่ใช้เลขถัง)
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/part-deposit-api";
// popup ค้นหา: เบอร์โทร → ฐานลูกค้า+QR/LINE+ใบขาย (search_customers) · เลขถัง/เลขเครื่อง → ประวัติรถ (search_vehicles)
const CUST_SEARCH_API = "https://n8n-new-project-gwf2.onrender.com/webhook/booking-deposit-api";
const SVC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/service-history-api";

const TABS = [
  { key: "บริการ", label: "🔧 มัดจำอะไหล่บริการ", docPrefix: "PDS" },
  { key: "สั่งซื้อ", label: "🛒 มัดจำอะไหล่สั่งซื้อ", docPrefix: "PDO" },
];

async function post(body) {
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json().catch(() => null);
}
const asArray = (d) => (Array.isArray(d) ? d : d ? [d] : []);
const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(n) ? n : 0; };
const fmt = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = () => new Date().toISOString().slice(0, 10);
const thaiDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? String(iso).slice(0, 10) : d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};

const FORM0 = { deposit_date: todayStr(), customer_code: "", customer_name: "", customer_phone: "", vin: "", brand: "", deposit_amount: "", payment_method: "เงินสด", remark: "" };

export default function PartDepositPage({ currentUser }) {
  const [tab, setTab] = useState("บริการ");
  const [form, setForm] = useState(FORM0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [showCust, setShowCust] = useState(false);        // เลือกลูกค้าจากฐาน (ช่องชื่อ)
  const [searchPop, setSearchPop] = useState(null);       // { mode: 'phone' | 'vin', q } — popup แว่นเบอร์โทร/เลขถัง

  // แท็บบริการ (แบบ NID): ใบรับ/ใบคืนมัดจำ + step ชำระโดย
  const [docKind, setDocKind] = useState("receive");      // receive = ใบรับมัดจำ | refund = ใบคืนมัดจำ
  const [payOpen, setPayOpen] = useState(false);          // ส่วน "ชำระโดย" หลังกดเพิ่มข้อมูล
  const [payConfirmed, setPayConfirmed] = useState(false); // กด "ตกลง" ยืนยันยอดแล้ว → รอกดบันทึกอีกที
  const [payMethod, setPayMethod] = useState("เงินสด");
  const [payAmount, setPayAmount] = useState("");
  const [savedDocNo, setSavedDocNo] = useState("");       // เลขที่ใบรับมัดจำที่เพิ่งบันทึก
  const [refundDoc, setRefundDoc] = useState("");         // เลขที่ใบรับมัดจำที่เลือกคืนเงิน
  const [view, setView] = useState("form");               // form | search | detail (โหมดค้นหาแบบ NID — เฉพาะแท็บบริการ)
  const [searchQ, setSearchQ] = useState("");
  const [fltReceive, setFltReceive] = useState(true);     // filter การ์ด: ใบรับมัดจำ
  const [fltRefund, setFltRefund] = useState(true);       // filter การ์ด: ใบคืนมัดจำ
  const [selDoc, setSelDoc] = useState(null);             // ใบมัดจำที่คลิกเปิดดู (แก้ไขข้อมูล)
  const [detailLine, setDetailLine] = useState(null);     // ลูกค้าใบที่เปิดดูมี LINE ไหม (null = กำลังเช็ค/ไม่รู้)

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  async function load() {
    setLoading(true);
    try {
      const d = await post({ action: "list_deposits", limit: 1000 });
      setRows(asArray(d).filter((r) => r && r.deposit_doc_no));
    } catch { setRows([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // เช็คว่าลูกค้าของใบที่เปิดดูมี LINE ไหม — ค้นฐานลูกค้า+QR/LINE+ใบขายด้วยเบอร์โทร (หรือชื่อ) ตอนเปิดหน้าแก้ไขข้อมูล
  useEffect(() => {
    if (view !== "detail" || !selDoc) { setDetailLine(null); return; }
    const kw = String(selDoc.customer_phone || "").trim() || String(selDoc.customer_name || "").trim();
    if (!kw) { setDetailLine(false); return; }
    let alive = true;
    setDetailLine(null);
    fetch(CUST_SEARCH_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "search_customers", keyword: kw }) })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const rows = Array.isArray(d) ? d : [];
        // เบอร์เดียวอาจมีหลายลูกค้า — ถ้าใบมัดจำมีรหัสลูกค้า ให้เทียบเฉพาะรหัสนั้นก่อน
        const code = String(selDoc.customer_code || "").trim();
        const scoped = code ? rows.filter((x) => String(x.customer_code || "").trim() === code) : rows;
        const pool = scoped.length ? scoped : rows;
        setDetailLine(pool.some((x) => String(x.line_user_id || "").trim() !== ""));
      })
      .catch(() => { if (alive) setDetailLine(false); });
    return () => { alive = false; };
  }, [view, selDoc]);

  function switchTab(t) {
    setTab(t); setMessage(""); setPayOpen(false); setPayConfirmed(false); setSavedDocNo(""); setRefundDoc(""); setDocKind("receive"); setPayAmount("");
    setView("form"); setSelDoc(null); setSearchQ("");
  }
  function switchKind(k) {
    setDocKind(k); setMessage(""); setPayOpen(false); setPayConfirmed(false); setSavedDocNo(""); setRefundDoc(""); setPayAmount("");
  }
  function resetServiceForm() {
    setForm({ ...FORM0, deposit_date: todayStr() });
    setPayOpen(false); setPayConfirmed(false); setPayAmount(""); setRefundDoc("");
  }

  // กด "ตกลง" ในส่วนชำระโดย = ยืนยันยอด (ยังไม่บันทึก DB — รอกดปุ่มบันทึกอีกที)
  function confirmPay() {
    const amt = num(payAmount);
    if (!(amt > 0)) { setMessage("❌ กรอกจำนวนเงินให้ถูกต้อง"); return; }
    if (isRefund && refundSel && amt > num(refundSel.remaining_amount)) {
      setMessage(`❌ ยอดคืนเกินมัดจำคงเหลือ (${fmt(refundSel.remaining_amount)} บาท)`); return;
    }
    setMessage("");
    setPayConfirmed(true);
  }

  // ใบรับมัดจำ (บริการ) ที่ยังมีเงินคงเหลือ — สำหรับ dropdown ใบคืนมัดจำ
  const refundables = useMemo(
    () => rows.filter((r) => r.deposit_type === "บริการ" && r.status === "active" && num(r.remaining_amount) > 0),
    [rows]
  );
  const refundSel = refundables.find((r) => r.deposit_doc_no === refundDoc) || null;

  // การ์ดค้นหาแบบ NID (แท็บบริการ): ใบรับมัดจำ = แถวจริง · ใบคืนมัดจำ = การ์ดจากยอดที่คืนเงินแล้ว
  const searchCards = useMemo(() => {
    const kw = searchQ.trim().toUpperCase();
    const svc = rows.filter((r) => r.deposit_type === "บริการ")
      .filter((r) => !kw || [r.deposit_doc_no, r.customer_name, r.customer_code, r.customer_phone, r.vin].some((v) => String(v || "").toUpperCase().includes(kw)));
    const cards = [];
    for (const r of svc) {
      if (fltReceive) cards.push({ kind: "receive", date: r.deposit_date, amount: num(r.deposit_amount), r });
      if (fltRefund && num(r.refunded_amount) > 0) cards.push({ kind: "refund", date: r.refunded_at || r.updated_at, amount: num(r.refunded_amount), r });
    }
    return cards.sort((a, b) => String(b.r.deposit_doc_no).localeCompare(String(a.r.deposit_doc_no)));
  }, [rows, searchQ, fltReceive, fltRefund]);

  const statusLabel = (r) => (r.status === "cancelled" ? "99 - ยกเลิก"
    : (r.status === "refunded" || num(r.remaining_amount) <= 0) ? "90 - ปิดเอกสาร" : "10 - เปิดเอกสาร");

  // พิมพ์ใบรับเงินมัดจำ
  function printDeposit(r) {
    const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบรับเงินมัดจำ ${esc(r.deposit_doc_no)}</title>
<style>*{font-family:"Sarabun","TH Sarabun New",Tahoma,sans-serif;box-sizing:border-box}body{margin:0;padding:20px;font-size:14px;color:#222}
.wrap{max-width:640px;margin:0 auto}h2{text-align:center;margin:0 0 2px}.sub{text-align:center;color:#555;margin-bottom:14px;font-size:13px}
table{width:100%;border-collapse:collapse}td{border:1px solid #999;padding:6px 10px}td.l{width:32%;background:#f1f5f9;font-weight:700}
.foot{display:flex;justify-content:space-between;margin-top:56px;padding:0 30px}.sg{text-align:center;width:40%;border-top:1px dotted #888;padding-top:4px;color:#555}
@media print{body{padding:0}}</style></head><body><div class="wrap">
<h2>ใบรับเงินมัดจำอะไหล่${esc(r.deposit_type === "บริการ" ? "บริการ" : "สั่งซื้อ")}</h2>
<div class="sub">เลขที่ ${esc(r.deposit_doc_no)} · วันที่ ${esc(thaiDate(r.deposit_date))} · สาขา ${esc(r.branch_code || "-")}</div>
<table>
<tr><td class="l">ลูกค้า</td><td>${esc(r.customer_name)}${r.customer_code ? " (" + esc(r.customer_code) + ")" : ""}</td></tr>
<tr><td class="l">เบอร์โทร</td><td>${esc(r.customer_phone || "-")}</td></tr>
${r.vin ? `<tr><td class="l">หมายเลขตัวถัง</td><td>${esc(r.vin)}</td></tr>` : ""}
<tr><td class="l">ยอดเงินมัดจำ</td><td><b>${fmt(r.deposit_amount)} บาท</b> (${esc(r.payment_method || "-")})</td></tr>
${num(r.refunded_amount) > 0 ? `<tr><td class="l">คืนเงินแล้ว</td><td>${fmt(r.refunded_amount)} บาท${r.refund_method ? " (" + esc(r.refund_method) + ")" : ""}</td></tr>` : ""}
<tr><td class="l">ยอดมัดจำคงเหลือ</td><td><b>${fmt(r.remaining_amount)} บาท</b></td></tr>
<tr><td class="l">หมายเหตุ</td><td>${esc(r.remark || "-")}</td></tr>
<tr><td class="l">ผู้บันทึก</td><td>${esc(r.recorded_by || "-")}</td></tr>
</table>
<div class="foot"><div class="sg">ผู้รับเงิน</div><div class="sg">ลูกค้า</div></div>
</div></body></html>`;
    const w = window.open("", "_blank", "width=760,height=800");
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 300);
  }

  // กด "เพิ่มข้อมูล" → เปิดส่วนชำระโดย (ตรวจข้อมูลก่อน)
  function openPay() {
    setMessage("");
    if (tab === "สั่งซื้อ") {
      // แท็บสั่งซื้อ — ขั้นตอนเดียวกับมัดจำบริการ แต่ไม่ใช้เลขถัง
      if (!String(form.customer_name).trim()) { setMessage("❌ กรุณากรอกชื่อลูกค้า"); return; }
      if (!String(form.customer_phone).trim()) { setMessage("❌ กรุณากรอกหมายเลขโทรศัพท์ลูกค้า"); return; }
      setPayOpen(true);
      return;
    }
    if (docKind === "receive") {
      if (!String(form.vin).trim()) { setMessage("❌ กรุณาระบุหมายเลขตัวถัง (กด 🔎 ค้นจากเลขเครื่อง/เลขถังได้)"); return; }
      if (!String(form.customer_name).trim()) { setMessage("❌ กรุณาระบุชื่อลูกค้า"); return; }
      if (!String(form.customer_phone).trim()) { setMessage("❌ กรุณากรอกหมายเลขโทรศัพท์ลูกค้า"); return; }
    } else {
      if (!refundSel) { setMessage("❌ เลือกเลขที่ใบรับมัดจำที่จะคืนเงินก่อน"); return; }
      setPayAmount(String(num(refundSel.remaining_amount)));
    }
    setPayOpen(true);
  }

  // ตกลง — ใบรับมัดจำ: บันทึกรับเงิน (save_deposit) — ใช้ทั้งแท็บบริการและสั่งซื้อ (flow เดียวกัน)
  async function okReceive() {
    if (saving) return;
    if (!(num(payAmount) > 0)) { setMessage("❌ กรอกจำนวนเงินมัดจำให้ถูกต้อง"); return; }
    setSaving(true); setMessage("");
    try {
      const d = await post({
        action: "save_deposit",
        deposit_type: tab,
        deposit_date: form.deposit_date,
        branch_code: String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5),
        brand: form.brand,
        customer_code: form.customer_code, customer_name: form.customer_name, customer_phone: form.customer_phone,
        vin: tab === "บริการ" ? form.vin : "", // มัดจำสั่งซื้อไม่ใช้เลขถัง
        deposit_amount: num(payAmount),
        payment_method: payMethod,
        remark: form.remark,
        recorded_by: currentUser?.name || currentUser?.username || "",
      });
      const row = asArray(d)[0];
      if (!row || row.error || !row.deposit_doc_no) throw new Error(row?.error || "บันทึกไม่สำเร็จ (ตรวจสอบว่า import workflow part-deposit-api แล้ว)");
      setSavedDocNo(row.deposit_doc_no);
      setMessage(`✅ บันทึกใบรับมัดจำแล้ว เลขที่ ${row.deposit_doc_no} · ${fmt(row.deposit_amount)} บาท (${payMethod})`);
      resetServiceForm();
      load();
    } catch (e) { setMessage("❌ " + (e.message || "บันทึกไม่สำเร็จ")); }
    setSaving(false);
  }

  // ตกลง — ใบคืนมัดจำ: คืนเงินจากใบรับมัดจำที่เลือก (refund_deposit)
  async function okRefund() {
    if (saving || !refundSel) return;
    const amt = num(payAmount);
    if (!(amt > 0)) { setMessage("❌ กรอกจำนวนเงินคืนให้ถูกต้อง"); return; }
    if (amt > num(refundSel.remaining_amount)) { setMessage(`❌ ยอดคืนเกินมัดจำคงเหลือ (${fmt(refundSel.remaining_amount)} บาท)`); return; }
    if (!window.confirm(`ยืนยันคืนเงินมัดจำ ${refundSel.deposit_doc_no}\nลูกค้า ${refundSel.customer_name} จำนวน ${fmt(amt)} บาท (${payMethod})?`)) return;
    setSaving(true); setMessage("");
    try {
      const d = await post({
        action: "refund_deposit",
        deposit_doc_no: refundSel.deposit_doc_no,
        refund_amount: amt,
        refund_method: payMethod,
        refund_note: form.remark,
        refunded_by: currentUser?.name || currentUser?.username || "",
      });
      const row = asArray(d)[0];
      if (!row || row.error || !row.deposit_doc_no) throw new Error(row?.error || "คืนเงินไม่สำเร็จ (ยอดอาจถูกใช้/คืนไปแล้ว)");
      setMessage(`✅ คืนเงินมัดจำ ${row.deposit_doc_no} จำนวน ${fmt(amt)} บาท แล้ว · คงเหลือ ${fmt(row.remaining_amount)} บาท`);
      resetServiceForm();
      load();
    } catch (e) { setMessage("❌ " + (e.message || "คืนเงินไม่สำเร็จ")); }
    setSaving(false);
  }

  async function handleCancel(r) {
    if (!window.confirm(`ยกเลิกใบมัดจำ ${r.deposit_doc_no} (${r.customer_name} · ${fmt(r.deposit_amount)} บาท)?`)) return;
    try {
      const d = await post({ action: "cancel_deposit", deposit_doc_no: r.deposit_doc_no, cancelled_by: currentUser?.name || currentUser?.username || "" });
      const row = asArray(d)[0];
      if (!row || row.error || !row.deposit_doc_no) throw new Error(row?.error || "ยกเลิกไม่สำเร็จ (อาจถูกใช้/คืนเงินไปแล้ว)");
      setMessage(`✅ ยกเลิกใบมัดจำ ${r.deposit_doc_no} แล้ว`);
      load();
    } catch (e) {
      setMessage("❌ " + (e.message || "ยกเลิกไม่สำเร็จ"));
    }
  }

  const items = useMemo(() => {
    const kw = keyword.trim().toUpperCase();
    return rows
      .filter((r) => r.deposit_type === tab)
      .filter((r) => !kw || [r.deposit_doc_no, r.customer_name, r.customer_code, r.customer_phone, r.vin].some((v) => String(v || "").toUpperCase().includes(kw)));
  }, [rows, tab, keyword]);
  const totalRemaining = items.reduce((s, r) => s + num(r.remaining_amount), 0);

  const inp = { width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, background: "#fff", boxSizing: "border-box" };
  const roInp = { ...inp, background: "#eceff1", color: "#334155" };
  const lbl = { fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 4, color: "#334155" };
  const th = { padding: "6px 8px", fontSize: 12, whiteSpace: "nowrap", background: "#e0f2fe", color: "#075985", border: "1px solid #bae6fd" };
  const td = { padding: "5px 8px", fontSize: 13, border: "1px solid #e5e7eb", verticalAlign: "top" };
  const magBtn = { padding: "0 12px", borderRadius: 8, border: "1px solid #1e3a8a", background: "#1e3a8a", color: "#fff", cursor: "pointer" };

  const isService = tab === "บริการ";
  const isRefund = isService && docKind === "refund";

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🪙 ระบบมัดจำอะไหล่</h2>
      </div>

      {/* แท็บประเภทมัดจำ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => switchTab(t.key)}
            style={{ padding: "10px 22px", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer",
              border: tab === t.key ? "2px solid #1e3a8a" : "1.5px solid #cbd5e1",
              background: tab === t.key ? "#1e3a8a" : "#fff", color: tab === t.key ? "#fff" : "#334155" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== แท็บบริการ: ฟอร์มแบบ NID (เลือกรถก่อน → เพิ่มข้อมูล → ชำระโดย → ตกลง) ===== */}
      {isService ? (view === "form" ? (
        <div className="form-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ background: "#5eb3bd", color: "#fff", fontWeight: 700, padding: "10px 16px", fontSize: 15 }}>➕ มัดจำงานบริการ — เพิ่มข้อมูล</div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ flex: "1 1 320px" }}>
                <label style={lbl}>ประเภทใบมัดจำ *</label>
                <div style={{ display: "flex", gap: 18, alignItems: "center", padding: "6px 0" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14, fontWeight: docKind === "receive" ? 700 : 400 }}>
                    <input type="radio" checked={docKind === "receive"} onChange={() => switchKind("receive")} /> ใบรับมัดจำ
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14, fontWeight: docKind === "refund" ? 700 : 400 }}>
                    <input type="radio" checked={docKind === "refund"} onChange={() => switchKind("refund")} /> ใบคืนมัดจำ
                  </label>
                </div>
              </div>
              <div style={{ flex: "1 1 280px" }}>
                <label style={lbl}>เลขที่ใบรับมัดจำ{isRefund ? " *" : ""}</label>
                {isRefund ? (
                  <select value={refundDoc} onChange={(e) => { setRefundDoc(e.target.value); setPayOpen(false); }} style={inp}>
                    <option value="">— เลือกใบรับมัดจำที่จะคืนเงิน —</option>
                    {refundables.map((r) => (
                      <option key={r.deposit_doc_no} value={r.deposit_doc_no}>
                        {r.deposit_doc_no} · {r.customer_name} · คงเหลือ {fmt(r.remaining_amount)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input value={savedDocNo} readOnly placeholder="ออกอัตโนมัติเมื่อบันทึก (PDS-YYMM-XXXXX)" style={roInp} />
                )}
              </div>
            </div>

            {!isRefund ? (
              <>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                  <div style={{ flex: "1 1 320px" }}>
                    <label style={lbl}>หมายเลขตัวถัง * <span style={{ fontWeight: 400, color: "#64748b" }}>(กด 🔎 ค้นจากเลขเครื่อง/เลขถัง)</span></label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input value={form.vin} onChange={(e) => setF("vin", e.target.value)} placeholder="เลขตัวถัง" style={{ ...inp, flex: 1, fontFamily: "monospace" }} />
                      <button onClick={() => setSearchPop({ mode: "vin", q: form.vin })} title="ค้นหารถจากเลขตัวถังหรือเลขเครื่อง" style={magBtn}>🔎</button>
                    </div>
                  </div>
                  <div style={{ flex: "0 1 180px" }}>
                    <label style={lbl}>วันที่มัดจำ *</label>
                    <input type="date" value={form.deposit_date} onChange={(e) => setF("deposit_date", e.target.value)} style={inp} />
                  </div>
                  <div style={{ flex: "0 1 130px" }}>
                    <label style={lbl}>ยี่ห้อ</label>
                    <select value={form.brand} onChange={(e) => setF("brand", e.target.value)} style={inp}>
                      <option value="">— ไม่ระบุ —</option>
                      <option value="HONDA">HONDA</option>
                      <option value="YAMAHA">YAMAHA</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                  <div style={{ flex: "0 1 200px" }}>
                    <label style={lbl}>รหัสลูกค้า</label>
                    <input value={form.customer_code} readOnly placeholder="จากการเลือกลูกค้า/รถ" style={roInp} />
                  </div>
                  <div style={{ flex: "2 1 280px" }}>
                    <label style={lbl}>ชื่อลูกค้า *</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input value={form.customer_name} onChange={(e) => setF("customer_name", e.target.value)} placeholder="ชื่อลูกค้า" style={{ ...inp, flex: 1 }} />
                      <button onClick={() => setShowCust(true)} title="เลือกจากฐานลูกค้า" style={magBtn}>🔎</button>
                    </div>
                  </div>
                  <div style={{ flex: "1 1 170px" }}>
                    <label style={lbl}>เบอร์โทร *</label>
                    <input value={form.customer_phone} onChange={(e) => setF("customer_phone", e.target.value)} placeholder="08x-xxxxxxx" style={inp} />
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ flex: "0 1 200px" }}>
                  <label style={lbl}>รหัสลูกค้า</label>
                  <input value={refundSel?.customer_code || ""} readOnly style={roInp} />
                </div>
                <div style={{ flex: "2 1 280px" }}>
                  <label style={lbl}>ชื่อลูกค้า</label>
                  <input value={refundSel?.customer_name || ""} readOnly style={roInp} />
                </div>
                <div style={{ flex: "0 1 180px" }}>
                  <label style={lbl}>วันที่คืนเงิน</label>
                  <input type="date" value={form.deposit_date} onChange={(e) => setF("deposit_date", e.target.value)} style={inp} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>หมายเหตุ</label>
              <input value={form.remark} onChange={(e) => setF("remark", e.target.value)} placeholder="เช่น เงื่อนไขการคืนเงิน, รายการอะไหล่" style={inp} />
            </div>

            {/* แถวยอดเงินมัดจำ — โผล่หลังกด "เพิ่มข้อมูล" แล้วเท่านั้น */}
            {payOpen && (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ flex: "0 1 220px" }}>
                  <label style={lbl}>รวม ยอดเงินมัดจำ (บาท)</label>
                  <input value={isRefund ? (refundSel ? fmt(refundSel.deposit_amount) : "") : (payAmount ? fmt(payAmount) : "")} readOnly style={{ ...roInp, textAlign: "right", fontWeight: 700 }} />
                </div>
                <div style={{ flex: "0 1 220px" }}>
                  <label style={lbl}>ยอดมัดจำ คงเหลือ (บาท)</label>
                  <input value={isRefund ? (refundSel ? fmt(refundSel.remaining_amount) : "") : (payAmount ? fmt(payAmount) : "")} readOnly style={{ ...roInp, textAlign: "right", fontWeight: 700, color: "#15803d" }} />
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={openPay} disabled={payOpen}
                style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: payOpen ? "#cbd5e1" : "#5eb3bd", color: "#fff", fontWeight: 700, cursor: payOpen ? "default" : "pointer", fontSize: 14 }}>
                ➕ เพิ่มข้อมูล
              </button>
              <button onClick={() => { setView("search"); setMessage(""); setSelDoc(null); }}
                style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#5eb3bd", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                🔍 ค้นหาข้อมูล
              </button>
              <button onClick={resetServiceForm}
                style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#7fb6bd", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                ↩ ปิด
              </button>
            </div>

            {/* ชำระโดย — โผล่หลังกดเพิ่มข้อมูล */}
            {payOpen && (
              <div style={{ marginTop: 16, border: "1px solid #d7dfe2", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ background: "#eef2f3", padding: "8px 14px", fontWeight: 700, fontSize: 14, color: "#334155" }}>
                  ☰ {isRefund ? "คืนเงินโดย" : "ชำระโดย"}
                </div>
                {!payConfirmed ? (
                  <>
                    {/* ขั้นที่ 1: ใส่จำนวนเงิน แล้วกด "ตกลง" (ยังไม่บันทึก) */}
                    <div style={{ padding: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} style={{ ...inp, width: 190 }}>
                        <option value="เงินสด">1 - เงินสด</option>
                        <option value="เงินโอน">2 - เงินโอน</option>
                      </select>
                      <input type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus
                        onKeyDown={(e) => e.key === "Enter" && confirmPay()}
                        placeholder="0.00" style={{ ...inp, width: 170, textAlign: "right", fontWeight: 700 }} />
                      <span style={{ fontSize: 14 }}>บาท</span>
                      {isRefund && refundSel && <span style={{ fontSize: 12.5, color: "#64748b" }}>(คงเหลือคืนได้ {fmt(refundSel.remaining_amount)} บาท)</span>}
                    </div>
                    <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, justifyContent: "center" }}>
                      <button onClick={confirmPay}
                        style={{ padding: "9px 26px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                        ✔ ตกลง
                      </button>
                      <button onClick={() => { setPayOpen(false); setPayConfirmed(false); }}
                        style={{ padding: "9px 26px", borderRadius: 8, border: "none", background: "#7fb6bd", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                        ↩ ปิด
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* ขั้นที่ 2: ยืนยันยอดแล้ว — ตรวจสอบอีกครั้ง แล้วกดบันทึกจริง */}
                    <div style={{ padding: 14 }}>
                      <div style={{ border: "1px solid #9fc9d0", borderRadius: 4, padding: "12px 16px", textAlign: "center", fontSize: 15 }}>
                        {payMethod} : <b>{fmt(payAmount)} บาท</b>
                        <button onClick={() => setPayConfirmed(false)} title="แก้ไขยอด/วิธีชำระ"
                          style={{ marginLeft: 12, padding: "2px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", cursor: "pointer", fontSize: 12.5 }}>
                          ✏️ แก้ไข
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, justifyContent: "center" }}>
                      <button onClick={isRefund ? okRefund : okReceive} disabled={saving}
                        style={{ padding: "9px 26px", borderRadius: 8, border: "none", background: saving ? "#cbd5e1" : "#16a34a", color: "#fff", fontWeight: 700, cursor: saving ? "wait" : "pointer", fontSize: 14 }}>
                        {saving ? "⏳ กำลังบันทึก..." : isRefund ? "💾 บันทึกคืนเงินมัดจำ" : "💾 บันทึกรับเงินมัดจำ"}
                      </button>
                      <button onClick={() => { setPayOpen(false); setPayConfirmed(false); }}
                        style={{ padding: "9px 26px", borderRadius: 8, border: "none", background: "#7fb6bd", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                        ↩ ปิด
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>
              ผู้บันทึก: {currentUser?.name || currentUser?.username || "-"} · สาขา {String(currentUser?.branch_code || currentUser?.branch || "-").substring(0, 5)}
            </div>
            {message && (
              <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: message.startsWith("✅") ? "#15803d" : "#b91c1c" }}>{message}</div>
            )}
          </div>
        </div>
      ) : view === "search" ? (
        /* ===== โหมดค้นหาข้อมูล (แบบ NID): การ์ดใบมัดจำ + filter ใบรับ/ใบคืน ===== */
        <div className="form-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ background: "#5eb3bd", color: "#fff", fontWeight: 700, padding: "10px 16px", fontSize: 15 }}>🔍 มัดจำงานบริการ — ค้นหาข้อมูล</div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <button onClick={() => setView("form")}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#7fb6bd", color: "#fff", fontWeight: 700, cursor: "pointer" }}>↩ ปิด</button>
              <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                placeholder="ค้นหา... เลขที่ใบมัดจำ / ลูกค้า / เลขตัวถัง / เบอร์โทร" style={{ ...inp, flex: "1 1 260px" }} />
              <button onClick={load} disabled={loading} title="โหลดข้อมูลใหม่"
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>{loading ? "⏳" : "🔄"}</button>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13.5, cursor: "pointer" }}>
                <input type="checkbox" checked={fltReceive} onChange={(e) => setFltReceive(e.target.checked)} /> ใบรับมัดจำ
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13.5, cursor: "pointer" }}>
                <input type="checkbox" checked={fltRefund} onChange={(e) => setFltRefund(e.target.checked)} /> ใบคืนมัดจำ
              </label>
            </div>
            {searchCards.length === 0 ? (
              <div style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>⚠️ ไม่พบข้อมูล</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(560px, 100%), 1fr))", gap: 14 }}>
                {searchCards.map((c, i) => {
                  const r = c.r;
                  // บรรทัดแบบ NID: ป้ายชิดขวาความกว้างคงที่ + " : " + ค่าสีน้ำเงิน
                  const line = (l, v) => (
                    <div style={{ display: "flex", fontSize: 13.5, marginBottom: 6 }}>
                      <span style={{ color: "#334155", width: 108, textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>{l}</span>
                      <span style={{ color: "#334155", margin: "0 7px", flexShrink: 0 }}>:</span>
                      <span style={{ fontWeight: 600, color: "#1d6fa5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</span>
                    </div>
                  );
                  // วันที่แบบ NID: DD/MM/ปี พ.ศ.
                  const dmyBE = (iso) => {
                    const d = new Date(iso);
                    return isNaN(d) ? String(iso || "—").slice(0, 10)
                      : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
                  };
                  return (
                    <div key={`${r.deposit_doc_no}-${c.kind}-${i}`} onClick={() => { setSelDoc(r); setView("detail"); setMessage(""); }}
                      title="คลิกเพื่อเปิดดู/แก้ไข"
                      style={{ border: "1.5px solid #7fb6bd", borderRadius: 4, padding: "14px 16px", cursor: "pointer", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                          {line("ประเภทใบมัดจำ", c.kind === "receive" ? "ใบรับมัดจำ" : "ใบคืนมัดจำ")}
                          {line("หมายเลขตัวถัง", r.vin || "-")}
                          {line("ลูกค้า", `${r.customer_code ? r.customer_code + " - " : ""}${r.customer_name}`)}
                          {line("ยอดมัดจำ", fmt(c.amount))}
                        </div>
                        <div style={{ flex: "1 1 210px", minWidth: 0 }}>
                          {line("เลขที่ใบมัดจำ", r.deposit_doc_no)}
                          {line("วันที่มัดจำ", dmyBE(c.date))}
                          {line("สถานะ", statusLabel(r))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ===== โหมดแก้ไขข้อมูล (เปิดจากการ์ดค้นหา): แสดงใบมัดจำ + ชำระโดย + ยกเลิก/พิมพ์/ปิด ===== */
        <div className="form-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ background: "#5eb3bd", color: "#fff", fontWeight: 700, padding: "10px 16px", fontSize: 15 }}>📝 มัดจำงานบริการ — แก้ไขข้อมูล</div>
          {selDoc && (
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ flex: "1 1 260px" }}>
                  <label style={lbl}>ประเภทใบมัดจำ</label>
                  <input value="ใบรับมัดจำ" readOnly style={roInp} />
                </div>
                <div style={{ flex: "1 1 260px" }}>
                  <label style={lbl}>เลขที่ใบรับมัดจำ</label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input value={selDoc.deposit_doc_no} readOnly style={{ ...roInp, flex: 1, fontFamily: "monospace", fontWeight: 700 }} />
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: statusLabel(selDoc).startsWith("10") ? "#15803d" : "#dc2626", whiteSpace: "nowrap" }}>{statusLabel(selDoc)}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ flex: "1 1 300px" }}>
                  <label style={lbl}>หมายเลขตัวถัง</label>
                  <input value={selDoc.vin || "-"} readOnly style={{ ...roInp, fontFamily: "monospace" }} />
                </div>
                <div style={{ flex: "0 1 180px" }}>
                  <label style={lbl}>วันที่มัดจำ</label>
                  <input value={thaiDate(selDoc.deposit_date)} readOnly style={roInp} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ flex: "0 1 200px" }}>
                  <label style={lbl}>รหัสลูกค้า</label>
                  <input value={selDoc.customer_code || "-"} readOnly style={roInp} />
                </div>
                <div style={{ flex: "2 1 300px" }}>
                  <label style={lbl}>
                    ชื่อลูกค้า{detailLine === true && <span style={{ color: "#16a34a", marginLeft: 8, fontWeight: 700 }}>✓ มี LINE</span>}
                  </label>
                  <input value={(detailLine === true ? "✓ " : "") + (selDoc.customer_name || "-")} readOnly
                    style={{ ...roInp, ...(detailLine === true ? { color: "#15803d", fontWeight: 700 } : {}) }} />
                </div>
                <div style={{ flex: "1 1 160px" }}>
                  <label style={lbl}>เบอร์โทร</label>
                  <input value={selDoc.customer_phone || "-"} readOnly style={roInp} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>หมายเหตุ</label>
                <input value={selDoc.remark || "-"} readOnly style={roInp} />
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ flex: "0 1 220px" }}>
                  <label style={lbl}>รวม ยอดเงินมัดจำ (บาท)</label>
                  <input value={fmt(selDoc.deposit_amount)} readOnly style={{ ...roInp, textAlign: "right", fontWeight: 700 }} />
                </div>
                <div style={{ flex: "0 1 220px" }}>
                  <label style={lbl}>ยอดมัดจำ คงเหลือ (บาท)</label>
                  <input value={fmt(selDoc.remaining_amount)} readOnly style={{ ...roInp, textAlign: "right", fontWeight: 700, color: "#15803d" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
                {selDoc.status === "active" && num(selDoc.paid_amount) === 0 && num(selDoc.refunded_amount) === 0 && (
                  <button onClick={async () => { await handleCancel(selDoc); setSelDoc(null); setView("search"); }}
                    style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#e03b3b", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                    ✖ ยกเลิก
                  </button>
                )}
                <button onClick={() => printDeposit(selDoc)}
                  style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#5eb3bd", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                  🖨 พิมพ์
                </button>
                <button onClick={() => { setSelDoc(null); setView("search"); }}
                  style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#7fb6bd", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                  ↩ ปิด
                </button>
              </div>

              {/* ชำระโดย */}
              <div style={{ border: "1px solid #d7dfe2", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ background: "#eef2f3", padding: "8px 14px", fontWeight: 700, fontSize: 14, color: "#334155" }}>☰ ชำระโดย</div>
                <div style={{ padding: 14 }}>
                  <div style={{ border: "1px solid #9fc9d0", borderRadius: 4, padding: "12px 16px", textAlign: "center", fontSize: 15 }}>
                    {selDoc.payment_method || "เงินสด"} : <b>{fmt(selDoc.deposit_amount)} บาท</b>
                  </div>
                  {num(selDoc.refunded_amount) > 0 && (
                    <div style={{ border: "1px solid #f3c6a8", borderRadius: 4, padding: "12px 16px", textAlign: "center", fontSize: 15, marginTop: 8, color: "#c2410c" }}>
                      คืนเงิน{selDoc.refund_method ? ` (${selDoc.refund_method})` : ""} : <b>{fmt(selDoc.refunded_amount)} บาท</b>
                      {selDoc.refunded_at ? <span style={{ fontSize: 12.5, color: "#92400e" }}> · {thaiDate(selDoc.refunded_at)}</span> : null}
                    </div>
                  )}
                </div>
              </div>
              {message && (
                <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: message.startsWith("✅") ? "#15803d" : "#b91c1c" }}>{message}</div>
              )}
            </div>
          )}
        </div>
      )) : (
        /* ===== แท็บสั่งซื้อ: ขั้นตอนบันทึกเดียวกับมัดจำบริการ (เพิ่มข้อมูล → ชำระโดย → ตกลง → บันทึก) แต่ไม่มีเลขถัง ===== */
        <div className="form-card">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>💾 บันทึกรับเงินมัดจำ — มัดจำอะไหล่สั่งซื้อ</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ flex: "0 1 160px" }}>
              <label style={lbl}>วันที่รับเงินมัดจำ</label>
              <input type="date" value={form.deposit_date} onChange={(e) => setF("deposit_date", e.target.value)} style={inp} />
            </div>
            <div style={{ flex: "2 1 240px" }}>
              <label style={lbl}>ชื่อลูกค้า *</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={form.customer_name} onChange={(e) => setF("customer_name", e.target.value)} placeholder="ชื่อลูกค้า" style={{ ...inp, flex: 1 }} />
                <button onClick={() => setShowCust(true)} title="เลือกจากฐานลูกค้า" style={magBtn}>🔎</button>
              </div>
              {form.customer_code && <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>รหัสลูกค้า: {form.customer_code}</div>}
            </div>
            <div style={{ flex: "1 1 170px" }}>
              <label style={lbl}>เบอร์โทร *</label>
              <input value={form.customer_phone} onChange={(e) => setF("customer_phone", e.target.value)} placeholder="08x-xxxxxxx" style={inp} />
            </div>
            <div style={{ flex: "0 1 130px" }}>
              <label style={lbl}>ยี่ห้อ</label>
              <select value={form.brand} onChange={(e) => setF("brand", e.target.value)} style={inp}>
                <option value="">— ไม่ระบุ —</option>
                <option value="HONDA">HONDA</option>
                <option value="YAMAHA">YAMAHA</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>หมายเหตุ / เงื่อนไข</label>
            <input value={form.remark} onChange={(e) => setF("remark", e.target.value)} placeholder="เช่น เงื่อนไขการคืนเงิน, รายการอะไหล่, เบอร์ติดต่อ" style={inp} />
          </div>

          {/* แถวยอดเงินมัดจำ — โผล่หลังกด "เพิ่มข้อมูล" แล้วเท่านั้น (เหมือนแท็บบริการ) */}
          {payOpen && (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ flex: "0 1 220px" }}>
                <label style={lbl}>รวม ยอดเงินมัดจำ (บาท)</label>
                <input value={payAmount ? fmt(payAmount) : ""} readOnly style={{ ...roInp, textAlign: "right", fontWeight: 700 }} />
              </div>
              <div style={{ flex: "0 1 220px" }}>
                <label style={lbl}>ยอดมัดจำ คงเหลือ (บาท)</label>
                <input value={payAmount ? fmt(payAmount) : ""} readOnly style={{ ...roInp, textAlign: "right", fontWeight: 700, color: "#15803d" }} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={openPay} disabled={payOpen}
              style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: payOpen ? "#cbd5e1" : "#5eb3bd", color: "#fff", fontWeight: 700, cursor: payOpen ? "default" : "pointer", fontSize: 14 }}>
              ➕ เพิ่มข้อมูล
            </button>
            <button onClick={resetServiceForm}
              style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#7fb6bd", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              ↩ ปิด
            </button>
          </div>

          {/* ชำระโดย — โผล่หลังกดเพิ่มข้อมูล (2-step เหมือนแท็บบริการ) */}
          {payOpen && (
            <div style={{ marginTop: 16, border: "1px solid #d7dfe2", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ background: "#eef2f3", padding: "8px 14px", fontWeight: 700, fontSize: 14, color: "#334155" }}>☰ ชำระโดย</div>
              {!payConfirmed ? (
                <>
                  <div style={{ padding: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} style={{ ...inp, width: 190 }}>
                      <option value="เงินสด">1 - เงินสด</option>
                      <option value="เงินโอน">2 - เงินโอน</option>
                    </select>
                    <input type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus
                      onKeyDown={(e) => e.key === "Enter" && confirmPay()}
                      placeholder="0.00" style={{ ...inp, width: 170, textAlign: "right", fontWeight: 700 }} />
                    <span style={{ fontSize: 14 }}>บาท</span>
                  </div>
                  <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, justifyContent: "center" }}>
                    <button onClick={confirmPay}
                      style={{ padding: "9px 26px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                      ✔ ตกลง
                    </button>
                    <button onClick={() => { setPayOpen(false); setPayConfirmed(false); }}
                      style={{ padding: "9px 26px", borderRadius: 8, border: "none", background: "#7fb6bd", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                      ↩ ปิด
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: 14 }}>
                    <div style={{ border: "1px solid #9fc9d0", borderRadius: 4, padding: "12px 16px", textAlign: "center", fontSize: 15 }}>
                      {payMethod} : <b>{fmt(payAmount)} บาท</b>
                      <button onClick={() => setPayConfirmed(false)} title="แก้ไขยอด/วิธีชำระ"
                        style={{ marginLeft: 12, padding: "2px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", cursor: "pointer", fontSize: 12.5 }}>
                        ✏️ แก้ไข
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, justifyContent: "center" }}>
                    <button onClick={okReceive} disabled={saving}
                      style={{ padding: "9px 26px", borderRadius: 8, border: "none", background: saving ? "#cbd5e1" : "#16a34a", color: "#fff", fontWeight: 700, cursor: saving ? "wait" : "pointer", fontSize: 14 }}>
                      {saving ? "⏳ กำลังบันทึก..." : "💾 บันทึกรับเงินมัดจำ"}
                    </button>
                    <button onClick={() => { setPayOpen(false); setPayConfirmed(false); }}
                      style={{ padding: "9px 26px", borderRadius: 8, border: "none", background: "#7fb6bd", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                      ↩ ปิด
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
            ผู้บันทึก: {currentUser?.name || currentUser?.username || "-"} · สาขา {String(currentUser?.branch_code || currentUser?.branch || "-").substring(0, 5)} · เลขที่เอกสารออกอัตโนมัติ (PDO-YYMM-XXXXX)
          </div>
          {message && (
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: message.startsWith("✅") ? "#15803d" : "#b91c1c" }}>{message}</div>
          )}
        </div>
      )}

      {/* รายการมัดจำ (เฉพาะแท็บสั่งซื้อ — แท็บบริการใช้ปุ่มค้นหาข้อมูลแบบ NID) */}
      {!isService && (
      <div className="form-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>📋 รายการ{TABS.find((t) => t.key === tab)?.label.replace(/^..\s/, "")} ({items.length}) · มัดจำคงเหลือรวม {fmt(totalRemaining)} บาท</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="ค้นหา เลขที่/ลูกค้า/VIN/เบอร์" style={{ ...inp, width: 230 }} />
            <button onClick={load} disabled={loading} style={{ padding: "0 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>{loading ? "⏳" : "🔄"}</button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>เลขที่เอกสาร</th><th style={th}>วันที่</th><th style={th}>ลูกค้า</th><th style={th}>เบอร์โทร</th>
              <th style={th}>ยี่ห้อ</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดมัดจำ</th><th style={{ ...th, textAlign: "right" }}>ใช้ไป</th>
              <th style={{ ...th, textAlign: "right" }}>คืนเงิน</th><th style={{ ...th, textAlign: "right" }}>คงเหลือ</th>
              <th style={th}>วิธีรับเงิน</th><th style={th}>ผู้บันทึก</th><th style={th}>หมายเหตุ</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {items.map((r, i) => (
                <tr key={r.deposit_doc_no} style={{ background: r.status === "refunded" ? "#fff7ed" : i % 2 ? "#fafcff" : "#fff" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#1e40af", whiteSpace: "nowrap" }}>
                    {r.deposit_doc_no}
                    {r.status === "refunded" && <div style={{ fontSize: 10.5, color: "#c2410c", fontFamily: "Tahoma" }}>คืนเงินครบแล้ว</div>}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(r.deposit_date)}</td>
                  <td style={td}>{r.customer_name}{r.customer_code ? <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.customer_code}</div> : null}</td>
                  <td style={td}>{r.customer_phone || "-"}</td>
                  <td style={td}>{r.brand || "-"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.deposit_amount)}</td>
                  <td style={{ ...td, textAlign: "right", color: "#b45309" }}>{num(r.paid_amount) ? fmt(r.paid_amount) : "-"}</td>
                  <td style={{ ...td, textAlign: "right", color: "#c2410c" }}>{num(r.refunded_amount) ? fmt(r.refunded_amount) : "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#15803d" }}>{fmt(r.remaining_amount)}</td>
                  <td style={td}>{r.payment_method || "-"}</td>
                  <td style={td}>{r.recorded_by || "-"}</td>
                  <td style={{ ...td, fontSize: 12, maxWidth: 240 }}>{r.remark || "-"}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {r.status === "active" && num(r.paid_amount) === 0 && num(r.refunded_amount) === 0 && (
                      <button onClick={() => handleCancel(r)} title="ยกเลิกใบมัดจำ"
                        style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #ef4444", background: "#fff", color: "#b91c1c", cursor: "pointer", fontSize: 12 }}>✖ ยกเลิก</button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr><td colSpan={13} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>— ยังไม่มีรายการมัดจำ{isService ? "อะไหล่บริการ" : "อะไหล่สั่งซื้อ"} —</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
          * โครงข้อมูลเดียวกับมัดจำที่ upload จาก NID/DMS (ลูกค้า/VIN/ยอดมัดจำ/ใช้ไป/คืนเงิน/คงเหลือ/ผู้บันทึก/หมายเหตุ) · ยกเลิกได้เฉพาะใบที่ยังไม่ถูกใช้ตัด/คืนเงิน
        </div>
      </div>
      )}

      {/* เลือกลูกค้าจากฐาน (ช่องชื่อ) */}
      {showCust && (
        <CustomerPickerModal
          currentUser={currentUser}
          onClose={() => setShowCust(false)}
          onSelect={(c) => {
            setForm((p) => ({ ...p, customer_code: c.code || "", customer_name: c.name || p.customer_name, customer_phone: c.phone || p.customer_phone }));
            setShowCust(false);
          }}
        />
      )}

      {/* popup แว่นเบอร์โทร (ค้นจากเบอร์) / แว่นเลขถัง (ค้นจากเลขถังหรือเลขเครื่อง) */}
      {searchPop && (
        <SearchPopup
          mode={searchPop.mode}
          initial={searchPop.q || ""}
          onClose={() => setSearchPop(null)}
          onPick={(patch) => { setForm((p) => ({ ...p, ...patch })); setSearchPop(null); }}
        />
      )}
    </div>
  );
}

// popup ค้นหาเฉพาะทาง — mode 'phone': ค้นลูกค้าจากเบอร์โทร (search_customers)
// mode 'vin': ค้นรถจากเลขตัวถังหรือเลขเครื่อง (search_vehicles ประวัติขาย/บริการ)
function SearchPopup({ mode, initial, onClose, onPick }) {
  const [q, setQ] = useState(initial || "");
  const [searching, setSearching] = useState(false);
  const [custs, setCusts] = useState(null); // null = ยังไม่ได้ค้น
  const [vehs, setVehs] = useState(null);
  const isPhone = mode === "phone";

  const brandOf = (b) => (/ฮอนด้า|honda/i.test(String(b || "")) ? "HONDA" : /ยามาฮ่า|yamaha/i.test(String(b || "")) ? "YAMAHA" : "");
  const doPost = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

  async function run() {
    const kw = q.trim();
    if (!kw || searching) return;
    setSearching(true);
    try {
      if (isPhone) {
        const c = await doPost(CUST_SEARCH_API, { action: "search_customers", keyword: kw }).catch(() => []);
        const seen = new Set(); const cl = [];
        for (const x of (Array.isArray(c) ? c : [])) {
          const k = [x.customer_code, x.customer_name, x.customer_phone].join("|");
          if (!x.customer_name || seen.has(k)) continue;
          seen.add(k); cl.push(x);
        }
        setCusts(cl.slice(0, 30));
      } else {
        const v = await doPost(SVC_API, { action: "search_vehicles", field: "all", keyword: kw }).catch(() => null);
        const vd = Array.isArray(v) ? v : (v && Array.isArray(v.data) ? v.data : []);
        setVehs(vd.slice(0, 30));
      }
    } finally { setSearching(false); }
  }

  const inp = { padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, boxSizing: "border-box" };
  const th = { padding: "5px 8px", fontSize: 12, whiteSpace: "nowrap", background: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0", textAlign: "left" };
  const td = { padding: "5px 8px", fontSize: 13, border: "1px solid #eef2f7", verticalAlign: "top" };
  const pickBtn = { padding: "3px 14px", borderRadius: 6, border: "none", background: "#1e3a8a", color: "#fff", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 760, maxHeight: "85vh", overflow: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{isPhone ? "🔎 ค้นหาลูกค้าจากเบอร์โทร" : "🔎 ค้นหารถจากเลขตัวถัง/เลขเครื่อง"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder={isPhone ? "เบอร์โทรลูกค้า เช่น 0812345678" : "เลขตัวถัง หรือ เลขเครื่อง (ทะเบียนก็ได้)"} autoFocus style={{ ...inp, flex: 1 }} />
          <button onClick={run} disabled={searching || !q.trim()}
            style={{ padding: "0 18px", borderRadius: 8, border: "none", background: searching || !q.trim() ? "#cbd5e1" : "#1e3a8a", color: "#fff", fontWeight: 700, cursor: searching ? "wait" : "pointer" }}>
            {searching ? "⏳..." : "🔍 ค้นหา"}
          </button>
        </div>

        {isPhone && custs !== null && (
          custs.length === 0 ? <div style={{ fontSize: 13, color: "#94a3b8" }}>— ไม่พบลูกค้าจากเบอร์นี้ —</div> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>ชื่อลูกค้า</th><th style={th}>เบอร์โทร</th><th style={th}>ที่มา</th><th style={th}></th></tr></thead>
                <tbody>
                  {custs.map((c, i) => (
                    <tr key={i}>
                      <td style={td}>{c.customer_name}{c.customer_code ? <div style={{ fontSize: 11, color: "#94a3b8" }}>{c.customer_code}</div> : null}</td>
                      <td style={td}>{c.customer_phone || "-"}</td>
                      <td style={{ ...td, fontSize: 12, color: "#64748b" }}>{c.source || "-"}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <button style={pickBtn} onClick={() => onPick({
                          customer_code: c.customer_code || "", customer_name: c.customer_name || "",
                          customer_phone: c.customer_phone || "",
                        })}>เลือก</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {!isPhone && vehs !== null && (
          vehs.length === 0 ? <div style={{ fontSize: 13, color: "#94a3b8" }}>— ไม่พบรถจากเลขนี้ —</div> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>ลูกค้า</th><th style={th}>ยี่ห้อ/รุ่น</th><th style={th}>เลขตัวถัง</th><th style={th}>เลขเครื่อง</th><th style={th}>ทะเบียน</th><th style={th}></th></tr></thead>
                <tbody>
                  {vehs.map((v, i) => (
                    <tr key={i}>
                      <td style={td}>{v.customer_name || "-"}</td>
                      <td style={{ ...td, fontSize: 12 }}>{[v.brand, v.model_series].filter(Boolean).join(" ") || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{v.frame_no || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{v.engine_no || "-"}</td>
                      <td style={td}>{[v.plate_category, v.plate_number].filter(Boolean).join(" ") || "-"}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <button style={pickBtn} onClick={() => onPick({
                          customer_name: v.customer_name || "",
                          vin: v.frame_no || v.engine_no || "",
                          brand: brandOf(v.brand),
                        })}>เลือก</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
