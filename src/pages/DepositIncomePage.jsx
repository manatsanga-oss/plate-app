import React, { useEffect, useMemo, useState } from "react";

// บันทึกรับชำระ รับฝากเงิน/รายได้อื่นๆ (user 2026-08-25) — เปลี่ยนจากการ upload DMS เป็นบันทึกเองจากระบบ
// การ์ด 1: รับฝากชำระค่างวด (กรุ๊ปลีส/ธนบรรณ) → INSERT other_income(+items) รูปแบบ description เดิม → แท็บ "รับฝากค้างโอน" ในเมนูชำระเงินรับฝากเห็นทันที
// การ์ด 2: รายได้อื่นๆ (เช่น ค่ารับฝากส่งไปรษณีย์) — เลือกหมวดจาก master หมวดรายได้ default_amount เติมยอดให้
const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const API = `${BASE}/deposit-income-api`;
const ACC_API = `${BASE}/accounting-api`;
const GLP_API = `${BASE}/grouplease-api`;       // ประวัติรับฝาก (upload+ระบบ) — ค้นชื่อ/สัญญาเดิม
const REG_API = `${BASE}/registrations-api`;    // ตารางการขาย (moto_sales) — ค้นชื่อลูกค้า
const RETAIL_API = `${BASE}/retail-sale-api`;   // ใบขาย NEW — มีช่องค่างวด (installment_amount) เติมยอดให้เลย

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return t; }
}
const asArray = (d) => (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []);
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const baht = (n) => num(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const thaiDate = (iso) => {
  if (!iso) return "-";
  const s = String(iso).slice(0, 10); const [y, m, d] = s.split("-");
  return y && m && d ? `${Number(d)}/${Number(m)}/${Number(y) + 543}` : s;
};

const COMPANIES = ["กรุ๊ปลีส", "ธนบรรณ"];
const DEFAULT_FEE = "15"; // ค่าบริการรับฝากมาตรฐาน 15 บาท รวม VAT (user 2026-08-25) — แก้รายใบได้

export default function DepositIncomePage({ currentUser }) {
  const isAdmin = currentUser?.role === "admin";
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const [card, setCard] = useState(null); // null | 'deposit' | 'other'
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [form, setForm] = useState({
    company: "กรุ๊ปลีส", receipt_date: todayStr(), customer_name: "", contract_no: "", amount: "", fee: DEFAULT_FEE,
    method: "เงินสด", account: "",
  });
  // การ์ดรายได้อื่นๆ: เลือกหมวดจาก master (จำนวนเงิน default เติมให้ ว่าง=กรอกเอง) — user 2026-08-25
  const [oform, setOform] = useState({ receipt_date: todayStr(), customer_name: "", income_code: "", income_name: "", detail: "", amount: "", vat_rate: 0 });
  const [cats, setCats] = useState([]);
  useEffect(() => {
    if (card !== "other" || cats.length) return;
    post(`${BASE}/master-data-api`, { action: "income_category", op: "list" }).then((d) => setCats(asArray(d))).catch(() => {});
    // eslint-disable-next-line
  }, [card]);
  // สังกัดของสาขา (ป.เปา/สิงห์ชัย) จาก master — ใบเสร็จ/ใบกำกับแยกสาขาและสังกัด (user 2026-08-25)
  const [branches, setBranches] = useState([]);
  useEffect(() => {
    post(`${BASE}/master-data-api`, { action: "get_branches" }).then((d) => setBranches(asArray(d))).catch(() => {});
  }, []);
  const myAffiliation = useMemo(() => {
    const b = branches.find((x) => String(x.branch_code || "").toUpperCase() === myBranch);
    return b?.affiliation || (["SCY05", "SCY06"].includes(myBranch) ? "ป.เปา" : "สิงห์ชัย");
  }, [branches, myBranch]);
  // ค้นหาลูกค้า: (1) ประวัติรับฝากเดิม (มีเลขสัญญา+ยอดล่าสุด) → เลือกแล้วเติมให้ครบ (2) ไม่เจอ → ตารางการขาย (ชื่ออย่างเดียว) (3) ไม่เจอ → พิมพ์เอง (user 2026-08-25)
  const [search, setSearch] = useState(null); // {kw, loading, searched, hist:[], sales:[]}
  const extractContract = (desc) => (String(desc || "").match(/(\d{6,})\s*$/) || [])[1] || "";

  // กดค้นหา → เปิด popup ที่มีช่องค้นหาในตัว (พิมพ์ชื่อ/เลขสัญญาใน popup แล้วค้นซ้ำได้) — user 2026-08-25
  function openSearch() {
    const kw = (card === "other" ? oform.customer_name : form.customer_name).trim();
    setSearch({ kw, loading: false, searched: false, hist: [], sales: [] });
    if (kw.length >= 2) runSearch(kw);
  }
  async function runSearch(kwArg) {
    const kw = String(kwArg || "").trim();
    if (kw.length < 2) return;
    setSearch((p) => ({ ...(p || {}), kw, loading: true, searched: true, hist: [], sales: [] }));
    try {
      const d0 = new Date(); d0.setDate(d0.getDate() - 365);
      const d2 = new Date(); d2.setDate(d2.getDate() - 730); // ประวัติรับฝากย้อน 2 ปี (query ไม่รับช่วงว่าง)
      const isOther = card === "other"; // รายได้อื่นๆ: เอาชื่อจากตารางการขายพอ ไม่เกี่ยวสัญญาไฟแนนท์
      const [histRaw, salesRaw, newSalesRaw] = await Promise.all([
        isOther ? Promise.resolve([]) : post(GLP_API, { action: "get_pending_grouplease", company: form.company, date_from: d2.toISOString().slice(0, 10), date_to: todayStr(), branch_code: "", include_paid: "true" }).catch(() => []),
        post(REG_API, { action: "search_registrations", source: "sale", field: "customer", keyword: kw }).catch(() => []),
        post(RETAIL_API, { action: "list_retail_sales", keyword: kw, date_from: d0.toISOString().slice(0, 10), date_to: todayStr(), limit: 500 }).catch(() => []),
      ]);
      const k = kw.replace(/\s+/g, "");
      // ประวัติรับฝาก: กรองชื่อ/สัญญาตรงคำค้น → ยุบเหลือสัญญาละ 1 แถว (ครั้งล่าสุด)
      const histAll = asArray(histRaw).filter((r) => {
        const nm = String(r.customer_name || "").replace(/\s+/g, "");
        return nm.includes(k) || String(r.description || "").includes(kw);
      });
      const byContract = new Map();
      for (const r of histAll) {
        const c = extractContract(r.description);
        const key = c || r.description;
        const prev = byContract.get(key);
        if (!prev || String(r.received_date || "") > String(prev.received_date || "")) byContract.set(key, r);
      }
      const hist = [...byContract.values()].sort((a, b) => String(b.received_date || "").localeCompare(String(a.received_date || ""))).slice(0, 20);
      // ตารางการขาย: ใบขาย NEW (ผ่อนกับบริษัทที่เลือก — มีค่างวดให้เติมเลย) มาก่อน แล้วค่อยใบขาย upload (ชื่ออย่างเดียว) — ยุบชื่อซ้ำ
      const coKey = form.company === "ธนบรรณ" ? "ธนบรรณ" : "กรุ๊ปล";
      const newSales = asArray(newSalesRaw)
        .filter((r) => r && r.invoice_no && String(r.sale_status || "10") !== "90" && (isOther || (r.finance_type === "moto" && String(r.finance_company_name || "").includes(coKey))))
        .map((r) => ({ customer_name: r.customer_name, sale_date: r.sale_date, brand: r.brand, model: r.model_name || r.model_code, invoice_no: r.invoice_no }));
      const seen = new Set();
      const sales = [...newSales, ...asArray(salesRaw)].filter((r) => {
        const nm = String(r.customer_name || "").trim();
        if (!nm || seen.has(nm)) return false;
        seen.add(nm); return true;
      }).slice(0, 20);
      setSearch((p) => ({ ...(p || {}), kw, loading: false, searched: true, hist, sales }));
    } catch { setSearch((p) => ({ ...(p || {}), kw, loading: false, searched: true, hist: [], sales: [] })); }
  }
  function pickHist(r) {
    setForm((f) => ({ ...f, customer_name: r.customer_name || f.customer_name, contract_no: extractContract(r.description) || f.contract_no, amount: String(num(r.line_amount) || "") }));
    setSearch(null);
  }
  async function pickSale(r) {
    if (card === "other") {
      setOform((f) => ({ ...f, customer_name: r.customer_name || f.customer_name }));
      setSearch(null);
      return;
    }
    setForm((f) => ({ ...f, customer_name: r.customer_name || f.customer_name }));
    setSearch(null);
    // ใบขาย NEW: ดึงค่างวด/เดือน (installment_amount) มาเติมช่องยอดค่างวดให้เลย (user 2026-08-25)
    if (r.invoice_no) {
      try {
        const g = await post(RETAIL_API, { action: "get_sale", sale_no: r.invoice_no });
        const sale = g && (g.sale || g);
        const inst = num(sale?.installment_amount);
        if (inst > 0) setForm((f) => ({ ...f, amount: String(inst) }));
      } catch { /* เติมไม่ได้ก็พิมพ์เอง */ }
    }
  }

  async function load() {
    setLoading(true);
    try {
      const body = { action: "list_deposit_income", date_from: dateFrom, date_to: dateTo };
      if (!isAdmin) body.branch_code = myBranch;
      const d = await post(API, body);
      // list ตอบแถวเดียว {listjson: "[...]"} (json_agg ฝั่ง SQL — ใช้เส้นทาง PG Single เดียวกับ save)
      setRows(typeof d?.listjson === "string" ? JSON.parse(d.listjson) : asArray(d));
    } catch { setRows([]); }
    setLoading(false);
  }
  useEffect(() => { if (card) load(); /* eslint-disable-next-line */ }, [card]);

  const isSameDay = (d) => String(d || "").slice(0, 10) === todayStr();

  async function save() {
    if (saving) return;
    const f = form;
    if (!f.customer_name.trim()) { setMessage("❌ กรอกชื่อลูกค้า"); return; }
    if (!f.contract_no.trim()) { setMessage("❌ กรอกเลขที่สัญญา"); return; }
    if (!(num(f.amount) > 0)) { setMessage("❌ กรอกยอดรับชำระ"); return; }
    const totalPay = num(f.amount) + num(f.fee);
    if (!window.confirm(`รับฝากชำระค่างวด ${f.company} (${myAffiliation} · ${myBranch})\nสัญญา ${f.contract_no.trim()} · ${f.customer_name.trim()}\nค่างวด ${baht(f.amount)}${num(f.fee) > 0 ? ` + ค่าบริการ ${baht(f.fee)} (รวม VAT)` : ""} = รับ ${baht(totalPay)} บาท (${f.method})?`)) return;
    setSaving(true); setMessage("");
    try {
      const r = await post(API, {
        action: "save_deposit_income",
        company: f.company, contract_no: f.contract_no.trim(), customer_name: f.customer_name.trim(),
        amount: num(f.amount), fee: num(f.fee), receipt_date: f.receipt_date,
        affiliation: myAffiliation,
        branch_code: myBranch || currentUser?.branch || "",
        payment_method: "เงินสด", payment_account: "",
        received_by: currentUser?.username || currentUser?.name || "system",
      });
      const rc = r && r.receipt;
      if (!rc || !rc.receipt_no) throw new Error(r?.__error || r?.error || "บันทึกไม่สำเร็จ (ตรวจว่า import workflow deposit-income-api แล้ว)");
      setMessage(`✅ บันทึกรับฝากค่างวดแล้ว เลขที่ใบเสร็จ ${rc.receipt_no} — เข้าแท็บ "รับฝากค้างโอน" ของเมนูชำระเงินรับฝากแล้ว`);
      setForm((p) => ({ ...p, customer_name: "", contract_no: "", amount: "", fee: DEFAULT_FEE }));
      load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    finally { setSaving(false); }
  }

  async function saveOther() {
    if (saving) return;
    const f = oform;
    if (!f.income_name.trim()) { setMessage("❌ เลือกหมวดรายได้"); return; }
    if (!(num(f.amount) > 0)) { setMessage("❌ กรอกจำนวนเงิน"); return; }
    if (!window.confirm(`บันทึกรายได้อื่นๆ (${myAffiliation} · ${myBranch})\n${f.income_name}${f.detail.trim() ? " - " + f.detail.trim() : ""}${f.customer_name.trim() ? "\nลูกค้า " + f.customer_name.trim() : ""}\nยอดรับ ${baht(f.amount)} บาท (เงินสด)?`)) return;
    setSaving(true); setMessage("");
    try {
      const r = await post(API, {
        action: "save_deposit_income", income_type: "other",
        income_name: f.income_name.trim(), detail: f.detail.trim(), vat_rate: num(f.vat_rate),
        customer_name: f.customer_name.trim() || "-",
        amount: num(f.amount), fee: 0, receipt_date: f.receipt_date,
        affiliation: myAffiliation,
        branch_code: myBranch || currentUser?.branch || "",
        payment_method: "เงินสด", payment_account: "",
        received_by: currentUser?.username || currentUser?.name || "system",
      });
      const rc = r && r.receipt;
      if (!rc || !rc.receipt_no) throw new Error(r?.__error || r?.error || "บันทึกไม่สำเร็จ (ตรวจว่า import workflow deposit-income-api เวอร์ชันล่าสุดแล้ว)");
      setMessage(`✅ บันทึกรายได้อื่นๆ แล้ว เลขที่ใบเสร็จ ${rc.receipt_no}`);
      setOform({ receipt_date: todayStr(), customer_name: "", income_code: "", income_name: "", detail: "", amount: "" });
      load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    finally { setSaving(false); }
  }

  async function cancelRow(r) {
    if (num(r.already_paid) > 0) { setMessage("❌ ใบนี้สร้างใบโอนให้ไฟแนนท์แล้ว ยกเลิกไม่ได้ — ยกเลิกใบโอนที่เมนูชำระเงินรับฝากก่อน"); return; }
    if (!isAdmin && !isSameDay(r.receipt_date)) { setMessage("❌ ยกเลิกข้ามวันได้เฉพาะ admin"); return; }
    if (!window.confirm(`ยกเลิกใบรับฝาก ${r.receipt_no} (${r.customer_name} · ${baht(r.total_amount)})?`)) return;
    try {
      const d = await post(API, { action: "cancel_deposit_income", receipt_no: r.receipt_no });
      if (!d || !d.cancelled_receipt) throw new Error(d?.__error || "ยกเลิกไม่สำเร็จ (อาจสร้างใบโอนไปแล้ว)");
      setMessage(`✅ ยกเลิก ${r.receipt_no} แล้ว`);
      load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
  }

  const totals = useMemo(() => rows.reduce((t, r) => t + num(r.total_amount), 0), [rows]);
  const inp = { padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" };
  const th = { padding: "8px 6px", fontSize: 13, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff" };
  const td = { padding: "8px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };

  // ===== เลือกการ์ด =====
  if (!card) {
    const cardStyle = { flex: "1 1 260px", maxWidth: 340, border: "2px solid #e5e7eb", borderRadius: 14, padding: "28px 22px", background: "#fff", cursor: "pointer", textAlign: "center", fontFamily: "Tahoma" };
    return (
      <div style={{ fontFamily: "Tahoma", padding: 16 }}>
        <h2 style={{ margin: "0 0 16px", color: "#072d6b" }}>🧾 บันทึกรับชำระ รับฝากเงิน / รายได้อื่นๆ</h2>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ ...cardStyle, borderColor: "#1d4ed8" }} onClick={() => setCard("deposit")}>
            <div style={{ fontSize: 40 }}>🏦</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1d4ed8", marginTop: 8 }}>รับฝากชำระค่างวด</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>กรุ๊ปลีส / ธนบรรณ — บันทึกจากระบบ ไม่ต้อง upload · เข้าแท็บรับฝากค้างโอนอัตโนมัติ</div>
          </div>
          <div style={{ ...cardStyle, borderColor: "#059669" }} onClick={() => setCard("other")}>
            <div style={{ fontSize: 40 }}>💼</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#059669", marginTop: 8 }}>รายได้อื่นๆ</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>ค่ารับฝากส่งไปรษณีย์ ฯลฯ — เลือกหมวดรายได้ ยอดเติมให้อัตโนมัติตามหมวด</div>
          </div>
        </div>
      </div>
    );
  }

  // ===== การ์ดรับฝากชำระค่างวด =====
  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button onClick={() => setCard(null)} style={{ padding: "7px 14px", background: "#e5e7eb", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma" }}>← กลับ</button>
        <h2 style={{ margin: 0, color: "#072d6b", fontSize: 20 }}>{card === "other" ? "💼 รายได้อื่นๆ (หน้าร้าน)" : "🏦 รับฝากชำระค่างวด (กรุ๊ปลีส / ธนบรรณ)"}</h2>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>สาขา <b>{myBranch || "-"}</b> · สังกัด <b>{myAffiliation}</b> (เลขใบเสร็จแยกรายสาขา)</span>
      </div>
      {message && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: message.startsWith("❌") ? "#fef2f2" : "#f0fdf4", border: message.startsWith("❌") ? "1px solid #fecaca" : "1px solid #bbf7d0", fontSize: 14 }}>{message}</div>}

      {card === "deposit" && (
      <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "10px 12px", alignItems: "center", fontSize: 14, maxWidth: 760 }}>
          <label>บริษัท *</label>
          <div style={{ display: "flex", gap: 8 }}>
            {COMPANIES.map((c) => (
              <button key={c} onClick={() => setForm((f) => ({ ...f, company: c }))} style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer", background: form.company === c ? "#072d6b" : "#fff", color: form.company === c ? "#fff" : "#072d6b", border: form.company === c ? "2px solid #072d6b" : "2px solid #d1d5db" }}>{c}</button>
            ))}
          </div>
          <label>วันที่รับเงิน *</label>
          <input type="date" value={form.receipt_date} onChange={(e) => setForm((f) => ({ ...f, receipt_date: e.target.value }))} style={inp} />
          <label>ชื่อลูกค้า *</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && openSearch()}
              placeholder="พิมพ์ชื่อแล้วกดค้นหา (หรือพิมพ์เองทั้งหมด)" style={{ ...inp, flex: 1 }} />
            <button onClick={openSearch} title="ค้นประวัติรับฝาก/ตารางการขาย" style={{ padding: "8px 14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma" }}>🔍 ค้นหา</button>
          </div>
          <label>เลขที่สัญญา *</label>
          <input value={form.contract_no} onChange={(e) => setForm((f) => ({ ...f, contract_no: e.target.value }))} placeholder="เลขที่สัญญา" style={{ ...inp, fontFamily: "monospace" }} />
          <label>ยอดค่างวด *</label>
          <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" style={{ ...inp, textAlign: "right", fontWeight: 700 }} />
          <label>ค่าบริการ <span style={{ fontWeight: 400, fontSize: 12, color: "#6b7280" }}>(รวม VAT 7%)</span></label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="number" value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))} placeholder="0.00" style={{ ...inp, width: 120, textAlign: "right" }} />
            <span style={{ fontSize: 12, color: "#6b7280" }}>VAT {baht(num(form.fee) * 7 / 107)}</span>
            <span style={{ fontSize: 13, color: "#166534", fontWeight: 700 }}>รวมรับ {baht(num(form.amount) + num(form.fee))} บาท</span>
          </div>
          <label>วิธีชำระ</label>
          <div style={{ padding: "8px 14px", borderRadius: 8, fontWeight: 700, background: "#072d6b", color: "#fff", display: "inline-block", justifySelf: "start" }}>💵 เงินสด</div>
        </div>
        <button onClick={save} disabled={saving} style={{ marginTop: 14, padding: "11px 28px", background: saving ? "#9ca3af" : "#16a34a", color: "#fff", border: "none", borderRadius: 10, fontFamily: "Tahoma", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          {saving ? "กำลังบันทึก..." : "💾 บันทึกรับฝากค่างวด"}
        </button>
      </div>
      )}

      {card === "other" && (
      <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "10px 12px", alignItems: "center", fontSize: 14, maxWidth: 760 }}>
          <label>หมวดรายได้ *</label>
          <select value={oform.income_code} onChange={(e) => {
            const ge = cats.find((g) => String(g.income_code) === e.target.value);
            setOform((f) => ({ ...f, income_code: e.target.value, income_name: ge?.income_name || "", vat_rate: num(ge?.vat_rate),
              amount: (ge && num(ge.default_amount) > 0) ? String(num(ge.default_amount)) : f.amount }));
          }} style={inp}>
            <option value="">— เลือกหมวดรายได้ —</option>
            {cats.map((g) => <option key={g.income_code} value={g.income_code}>{g.income_code} — {g.income_name}{num(g.default_amount) > 0 ? ` (${baht(g.default_amount)})` : ""}</option>)}
          </select>
          <label>วันที่รับเงิน *</label>
          <input type="date" value={oform.receipt_date} onChange={(e) => setOform((f) => ({ ...f, receipt_date: e.target.value }))} style={inp} />
          <label>ชื่อลูกค้า</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={oform.customer_name} onChange={(e) => setOform((f) => ({ ...f, customer_name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && openSearch()}
              placeholder="พิมพ์ชื่อแล้วกดค้นหา หรือพิมพ์เอง (ไม่บังคับ)" style={{ ...inp, flex: 1 }} />
            <button onClick={openSearch} title="ค้นชื่อจากตารางการขาย" style={{ padding: "8px 14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma" }}>🔍 ค้นหา</button>
          </div>
          <label>รายละเอียดเพิ่มเติม</label>
          <input value={oform.detail} onChange={(e) => setOform((f) => ({ ...f, detail: e.target.value }))} placeholder="เช่น เลขพัสดุ / หมายเหตุ (ไม่บังคับ)" style={inp} />
          <label>จำนวนเงิน *{oform.vat_rate > 0 ? <span style={{ fontWeight: 400, fontSize: 12, color: "#6b7280" }}> (รวม VAT {num(oform.vat_rate)}%)</span> : null}</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="number" value={oform.amount} onChange={(e) => setOform((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" style={{ ...inp, width: 140, textAlign: "right", fontWeight: 700 }} />
            {oform.vat_rate > 0 && <span style={{ fontSize: 12, color: "#6b7280" }}>VAT {baht(num(oform.amount) * num(oform.vat_rate) / (100 + num(oform.vat_rate)))}</span>}
          </div>
          <label>วิธีชำระ</label>
          <div style={{ padding: "8px 14px", borderRadius: 8, fontWeight: 700, background: "#072d6b", color: "#fff", display: "inline-block", justifySelf: "start" }}>💵 เงินสด</div>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>💡 หมวดที่ตั้ง "จำนวนเงิน" ไว้ในเมนูหมวดรายได้จะเติมยอดให้อัตโนมัติ (แก้ทับได้) · หมวดที่ว่าง = กรอกยอดเอง</div>
        <button onClick={saveOther} disabled={saving} style={{ marginTop: 14, padding: "11px 28px", background: saving ? "#9ca3af" : "#16a34a", color: "#fff", border: "none", borderRadius: 10, fontFamily: "Tahoma", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          {saving ? "กำลังบันทึก..." : "💾 บันทึกรายได้อื่นๆ"}
        </button>
      </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700 }}>รายการที่บันทึกจากระบบ</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inp} />
        <button onClick={load} disabled={loading} style={{ padding: "7px 16px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer" }}>{loading ? "..." : "🔍 แสดง"}</button>
        <span style={{ marginLeft: "auto", fontSize: 13 }}>{rows.length} รายการ · รวม <b style={{ color: "#166534" }}>{baht(totals)}</b> บาท</span>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>เลขที่ใบเสร็จ</th><th style={th}>วันที่</th><th style={th}>ลูกค้า</th><th style={th}>รายการ</th><th style={th}>สาขา</th><th style={{ ...th, textAlign: "right" }}>ยอดรับ</th><th style={th}>วิธีชำระ</th><th style={th}>สถานะโอน</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 22 }}>{loading ? "กำลังโหลด..." : "ไม่มีรายการในช่วงวันที่"}</td></tr>}
            {rows.map((r) => (
              <tr key={r.receipt_no}>
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{r.receipt_no}</td>
                <td style={td}>{thaiDate(r.receipt_date)}</td>
                <td style={td}>{r.customer_name}</td>
                <td style={{ ...td, color: "#6b7280" }}>{r.description}</td>
                <td style={td}>{r.branch_code}{r.affiliation ? <div style={{ fontSize: 11, color: "#6b7280" }}>{r.affiliation}</div> : null}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{baht(r.total_amount)}{num(r.fee) > 0 && <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 400 }}>ค่างวด {baht(r.line_amount)} + บริการ {baht(r.fee)}</div>}</td>
                <td style={td}>{r.payment_method || "-"}{r.payment_account ? <div style={{ fontSize: 11, color: "#6b7280" }}>{r.payment_account}</div> : null}</td>
                <td style={td}>{r.income_kind === "other"
                  ? <span style={{ color: "#9ca3af" }}>—</span>
                  : num(r.already_paid) > 0
                  ? <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 700 }}>สร้างใบโอนแล้ว</span>
                  : <span style={{ padding: "2px 8px", borderRadius: 10, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 700 }}>รอโอนให้ไฟแนนท์</span>}</td>
                <td style={td}>
                  {num(r.already_paid) === 0 && (isAdmin || isSameDay(r.receipt_date)) && (
                    <button onClick={() => cancelRow(r)} style={{ padding: "5px 12px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontSize: 12 }}>ยกเลิก</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
        {card === "other"
          ? "ตารางแสดงทุกใบที่บันทึกจากระบบ (รับฝากค่างวด + รายได้อื่นๆ) · ยกเลิกได้ภายในวัน (ข้ามวัน = admin)"
          : "บันทึกแล้วรายการจะเข้าแท็บ \"รับฝากค้างโอน\" ของเมนูชำระเงินรับฝาก—ค่างวด อัตโนมัติ (รูปแบบเดียวกับข้อมูล upload เดิม) · ยกเลิกได้เฉพาะใบที่ยังไม่สร้างใบโอน (ข้ามวัน = admin)"}
      </div>

      {search && (
        <div onClick={() => setSearch(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, width: 640, maxWidth: "95vw", maxHeight: "80vh", overflowY: "auto", fontFamily: "Tahoma" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{card === "other" ? "🔍 ค้นหาลูกค้า (ตารางการขาย)" : `🔍 ค้นหาลูกค้ารับฝาก (${form.company})`}</div>
              <button onClick={() => setSearch(null)} style={{ padding: "4px 12px", background: "#e5e7eb", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma" }}>ปิด</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input autoFocus value={search.kw || ""} onChange={(e) => setSearch((p) => ({ ...p, kw: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && runSearch(search.kw)}
                placeholder="พิมพ์ชื่อลูกค้า หรือเลขที่สัญญา อย่างน้อย 2 ตัว"
                style={{ flex: 1, padding: "9px 12px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14 }} />
              <button onClick={() => runSearch(search.kw)} style={{ padding: "9px 18px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>ค้นหา</button>
            </div>
            {search.loading ? <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>กำลังค้นหา...</div>
            : !search.searched ? <div style={{ padding: 16, textAlign: "center", color: "#9ca3af", fontSize: 13.5 }}>{card === "other" ? "พิมพ์ชื่อลูกค้าแล้วกด \"ค้นหา\" — ไม่เจอก็พิมพ์เองได้เลย" : "พิมพ์คำค้นแล้วกด \"ค้นหา\" — ระบบจะหาในประวัติรับฝากก่อน ไม่เจอค่อยดูตารางการขาย"}</div>
            : (
              <>
                {card !== "other" && <>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1d4ed8", margin: "4px 0 6px" }}>📒 เคยบันทึกรับฝาก (เลือกแล้วเติมเลขสัญญา+ยอดให้)</div>
                {search.hist.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>— ไม่พบประวัติรับฝากของ {form.company} —</div>}
                </>}
                {search.hist.map((r) => (
                  <div key={(r.item_id || "") + r.receipt_no} onClick={() => pickHist(r)}
                    style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 10px", border: "1px solid #dbeafe", borderRadius: 8, marginBottom: 6, cursor: "pointer", background: "#eff6ff", fontSize: 13.5 }}>
                    <span><b>{r.customer_name || "-"}</b> · สัญญา <span style={{ fontFamily: "monospace" }}>{extractContract(r.description) || "-"}</span></span>
                    <span>ล่าสุด {thaiDate(r.received_date)} · <b>{baht(r.line_amount)}</b></span>
                  </div>
                ))}
                <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", margin: "12px 0 6px" }}>{card === "other" ? "🛵 จากตารางการขาย (เลือกแล้วเติมชื่อให้)" : "🛵 จากตารางการขาย (เติมชื่อ — เลขสัญญาพิมพ์เอง)"}</div>
                {search.sales.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af" }}>— ไม่พบในตารางการขาย — พิมพ์ข้อมูลเองได้เลย</div>}
                {search.sales.map((r, i) => (
                  <div key={i} onClick={() => pickSale(r)}
                    style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 10px", border: r.invoice_no ? "1px solid #bbf7d0" : "1px solid #e5e7eb", background: r.invoice_no ? "#f0fdf4" : "#fff", borderRadius: 8, marginBottom: 6, cursor: "pointer", fontSize: 13.5 }}>
                    <span><b>{r.customer_name}</b>{r.model ? <span style={{ color: "#6b7280" }}> · {r.brand || ""} {r.model}</span> : null}{r.invoice_no ? <span style={{ color: "#15803d", fontSize: 12 }}>{card === "other" ? " · ใบขาย NEW" : " · ใบขาย NEW (เติมค่างวดให้)"}</span> : null}</span>
                    <span style={{ color: "#6b7280" }}>ขาย {thaiDate(r.sale_date)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
