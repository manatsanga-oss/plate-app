import React, { useEffect, useMemo, useState } from "react";

// รายงานภาษีขาย (ภ.พ.30) — รวมใบกำกับขายที่ upload เข้าระบบ (อ่านอย่างเดียว)
//   1) ใบกำกับขายรถ  — webhook list-tax-invoices (branch PAPAO/NAKORNLUANG/SINGCHAI, upload จาก DMS)
//   2) ใบกำกับรายรับอื่น ๆ — accounting-api list_other_income_tax_invoices (NID-OTH / MIC-OTH)
//   3) ขายอะไหล่ + ค่าบริการ — flow-input-tax-api list_part_service_sales
//      (ป.เปา = honda_repair_jobs ทั้ง job รวมค่าแรง (net_sale/vat, เดือนตาม close_date) + honda_part_sales เฉพาะใบขายปลีกที่ไม่ใช่ job
//       · สิงห์ชัย = yamaha_repair_invoices รวมต่อ job ถอด VAT 7/107)
// สังกัด: ป.เปา = PAPAO + NAKORNLUANG, สิงห์ชัย = SINGCHAI · ใบยกเลิกไม่รวมยอด (แสดงขีดฆ่า)
const TAXINV_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/list-tax-invoices";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const FLOWTAX_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/flow-input-tax-api";
const INTAX_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/input-tax-api"; // เตรียมแบบภาษีรายเดือน (tax_monthly_filings)

const AFF_BRANCHES = { "ป.เปา": ["PAPAO", "NAKORNLUANG"], "สิงห์ชัย": ["SINGCHAI"] };
const BRANCH_AFF = { PAPAO: "ป.เปา", NAKORNLUANG: "ป.เปา", SINGCHAI: "สิงห์ชัย" };
const COMPANY = {
  "ป.เปา": { name: "บริษัท ป.เปามอเตอร์เซอร์วิส จำกัด", tax_id: "0145546000707" },
  "สิงห์ชัย": { name: "ห้างหุ้นส่วนจำกัด สิงห์ชัยสยามยนต์", tax_id: "0143543001310" },
};
const SRC_LABEL = { vehicle: "ขายรถ", other: "รายรับอื่น", part_service: "อะไหล่/บริการ", fee_insurance: "รายได้ประกัน/ค่าบริการ", debit_note: "ใบเพิ่มหนี้" };
// สาขา/จุดขาย จากเลขเอกสาร (แหล่งข้อมูลแต่ละตัวเก็บสาขาไม่เหมือนกัน)
const BR_LABEL = {
  SCY01: "SCY01 ศูนย์ยามาฮ่า", SCY04: "SCY04 ตลาดสีขวา", SCY05: "SCY05 นครหลวง",
  SCY06: "SCY06 ป.เปาวังน้อย", SCY07: "SCY07 ตลาดวังน้อย", SCY10: "SCY10 ส่งาศรีบุ๊ชเซ็นเตอร์",
  "วังน้อย": "วังน้อย (Honda)", "นครหลวง": "นครหลวง",
  PAPAO: "ป.เปา (ใบกำกับรถ)", NAKORNLUANG: "นครหลวง (ใบกำกับรถ)", SINGCHAI: "สิงห์ชัย (ใบกำกับรถ)",
};
function rowBranch(r) {
  const doc = String(r.tax_invoice_no || "");
  const m = doc.match(/^(SCY\d{2})[-\/]/);
  if (m) return m[1];
  if (doc.indexOf("· นครหลวง") >= 0) return "นครหลวง";
  if (r.source === "vehicle" || r.source === "other" || r.source === "debit_note") return r.branch || "-";
  if (/^69/.test(doc)) return "วังน้อย"; // เอกสาร Honda ป.เปา (69SERV/69RTSL/69WHSL)
  return r.branch || "-";
}

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function curMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function periodLabel(p) {
  const m = String(p || "").match(/^(\d{4})-(\d{2})/);
  if (!m) return p || "-";
  return `${TH_MONTH[parseInt(m[2], 10) - 1]} ${parseInt(m[1], 10) + 543}`;
}
function monthRange(p) {
  const m = String(p || "").match(/^(\d{4})-(\d{2})/);
  if (!m) return { from: null, to: null };
  const y = Number(m[1]), mo = Number(m[2]);
  const last = new Date(y, mo, 0).getDate();
  return { from: `${m[1]}-${m[2]}-01`, to: `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}` };
}

export default function OutputTaxReportPage({ currentUser }) {
  const [affiliation, setAffiliation] = useState("ป.เปา");
  const [month, setMonth] = useState(curMonth()); // YYYY-MM
  const [rows, setRows] = useState([]);           // normalized ทุกแหล่ง
  const [srcFilter, setSrcFilter] = useState(""); // "" | vehicle | other
  const [brFilter, setBrFilter] = useState("");   // กรองสาขา/จุดขาย (จากเลขเอกสาร)
  const [search, setSearch] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [moves, setMoves] = useState([]); // การย้ายงวดใบกำกับ (tax_report_doc_moves) ของสังกัดนี้

  const ymNum = (p) => String(p || "").replace("-", "");                 // '2026-05' → '202605'
  const nextPeriod = (p) => { const [y, m] = String(p).split("-").map(Number); const d = new Date(y, m, 1); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const stripDoc = (v) => String(v || "").replace(/\s*·.*$/, "");        // ตัด tag ' · ค่าบริการ' ฯลฯ ให้เหลือเลขเอกสารจริง
  const fmtPeriod = (p) => { const s = String(p || ""); return s.length === 6 ? `${s.slice(4)}/${Number(s.slice(0, 4)) + 543}` : s; };

  useEffect(() => { loadRows(); /* eslint-disable-next-line */ }, [affiliation, month]);

  async function loadRows() {
    if (!month) return;
    setLoading(true); setMsg("");
    // list_tax_invoices ใช้ invoice_year_month แบบปี พ.ศ. เช่น "256905" (ไม่ใช่ 202605)
    const [yy, mm] = month.split("-");
    const ym = `${Number(yy) + 543}${mm}`;
    const { from, to } = monthRange(month);
    const branches = AFF_BRANCHES[affiliation] || [];
    try {
      const [vehArrs, otherRes, psRes] = await Promise.all([
        // ใบกำกับขายรถ — ดึงรายสาขาของสังกัด
        Promise.all(branches.map(br =>
          fetch(TAXINV_URL, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "list_tax_invoices", branch: br, year_month: ym }),
          }).then(r => r.json()).then(d => (Array.isArray(d) ? d : (d?.rows || [])).map(x => ({ ...x, _branch: br }))).catch(() => [])
        )),
        // ใบกำกับรายรับอื่น ๆ — กรองเดือนด้วยช่วงวันที่
        fetch(ACC_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_other_income_tax_invoices", date_from: from, date_to: to, branch: "" }),
        }).then(r => r.json()).catch(() => []),
        // ขายอะไหล่ + ค่าบริการ — รวมต่อใบ/ต่อ job
        fetch(FLOWTAX_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_part_service_sales", affiliation, tax_period: month }),
        }).then(r => r.json()).catch(() => []),
      ]);
      // ใบเพิ่มหนี้ขายรถ (debit note จาก DMS) — งวดตาม invoice_year_month (ปี พ.ศ.) กรองสาขาตามสังกัด
      const dnRes = await fetch(FLOWTAX_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_debit_notes", year_month: ym }),
      }).then(r => r.json()).catch(() => []);
      // รายการย้ายงวด (ใบที่กดเลื่อนไปงวดถัดไป / ดึงเข้ามา)
      const movesRes = await fetch(FLOWTAX_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_tax_doc_moves", affiliation }),
      }).then(r => r.json()).catch(() => []);
      setMoves(Array.isArray(movesRes) ? movesRes.filter(m2 => m2 && m2.doc_no) : []);

      const veh = vehArrs.flat().map(x => ({
        source: "vehicle", branch: x._branch,
        invoice_date: x.invoice_date, tax_invoice_no: x.tax_invoice_no,
        customer_name: x.customer_name || x.sale_customer_name, customer_tax_id: x.customer_tax_id,
        amount_before_vat: Number(x.amount_before_vat || 0), vat_amount: Number(x.vat_amount || 0),
        total_amount: Number(x.total_amount || 0), cancelled: String(x.status || "") === "cancelled",
      }));
      const others = (Array.isArray(otherRes) ? otherRes : (otherRes?.rows || []))
        .filter(x => BRANCH_AFF[x.branch] === affiliation)
        .map(x => ({
          source: "other", branch: x.branch,
          invoice_date: x.invoice_date, tax_invoice_no: x.tax_invoice_no,
          customer_name: x.customer_name, customer_tax_id: x.customer_tax_id,
          amount_before_vat: Number(x.amount_before_vat || 0), vat_amount: Number(x.vat_amount || 0),
          total_amount: Number(x.total_amount || 0), cancelled: String(x.status || "") === "cancelled",
        }));
      // ขายอะไหล่/บริการ (HONDA ต่อใบ · YAMAHA ต่อ job ถอด VAT 7/107)
      const partSvc = (Array.isArray(psRes) ? psRes : (psRes?.rows || []))
        .filter(x => x && x.doc_no)
        .map(x => ({
          // ประกันรถหาย/ค่าบริการรับชำระ/ไปรษณีย์ แยกหมวดจากอะไหล่/บริการ (ดูจาก tag ท้ายเลขเอกสาร)
          source: /· (ประกันรถหาย|ค่าบริการ)$/.test(String(x.doc_no)) ? "fee_insurance" : "part_service",
          branch: x.side === "yamaha" ? "YAMAHA" : "HONDA",
          invoice_date: x.invoice_date, tax_invoice_no: x.doc_no,
          customer_name: x.customer_name, customer_tax_id: x.customer_tax_id,
          amount_before_vat: Number(x.amount_before_vat || 0), vat_amount: Number(x.vat_amount || 0),
          total_amount: Number(x.total_amount || 0), cancelled: false,
        }));
      const debitNotes = (Array.isArray(dnRes) ? dnRes : (dnRes?.rows || []))
        .filter(x => x && x.debit_note_no && branches.includes(x.branch))
        .map(x => ({
          source: "debit_note", branch: x.branch,
          invoice_date: x.debit_note_date, tax_invoice_no: x.debit_note_no,
          customer_name: (x.customer_name || "") + (x.ref_tax_invoice_no ? ` (อ้างถึง ${x.ref_tax_invoice_no})` : ""),
          customer_tax_id: null,
          amount_before_vat: Number(x.amount_before_vat || 0), vat_amount: Number(x.vat_amount || 0),
          total_amount: Number(x.difference_amount || 0), cancelled: false,
        }));
      // เรียงตามวันที่ + เลขใบกำกับ
      const all = [...veh, ...others, ...partSvc, ...debitNotes].sort((a, b) =>
        String(a.invoice_date || "").localeCompare(String(b.invoice_date || "")) ||
        String(a.tax_invoice_no || "").localeCompare(String(b.tax_invoice_no || "")));
      setRows(all);
      if (all.length === 0) setMsg("ไม่มีข้อมูลใบกำกับขายในเดือนนี้ — ตรวจว่า upload ใบกำกับ (DMS / รายรับอื่น) แล้วหรือยัง");
    } catch (e) {
      setMsg("❌ โหลดข้อมูลไม่สำเร็จ: " + e.message);
      setRows([]);
    }
    setLoading(false);
  }

  // เลื่อนใบออกจากงวดนี้ → ไปขึ้นงวดถัดไป (บันทึกใน tax_report_doc_moves ฝั่ง n8n)
  async function moveDocNext(r) {
    const doc = stripDoc(r.tax_invoice_no);
    const toP = nextPeriod(month);
    if (!window.confirm(`ลบ "${doc}" ออกจากงวด ${periodLabel(month)} → ไปขึ้นงวด ${fmtPeriod(toP)} ?`)) return;
    await fetch(FLOWTAX_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_tax_doc_move", affiliation, doc_no: doc, from_period: ymNum(month), to_period: toP, note: "", created_by: currentUser?.name || "" }),
    }).catch(() => {});
    loadRows();
  }
  async function cancelMove(docNo) {
    if (!window.confirm(`ยกเลิกการย้ายงวดของ "${docNo}" ?`)) return;
    await fetch(FLOWTAX_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_tax_doc_move", affiliation, doc_no: docNo }),
    }).catch(() => {});
    loadRows();
  }
  // บันทึกยอดภาษีขายทั้งเดือน (ทุกแหล่ง ไม่สนตัวกรอง) เข้าหน้า "เตรียมแบบภาษีรายเดือน" ฝั่งมูลค่าภาษีขาย ภ.พ.30
  // — ถ้ามีแบบของ เดือน+สังกัด นั้นแล้ว จะอัปเดตเฉพาะฝั่งขาย (ฝั่งภาษีซื้อ/สถานะ/ใบที่เลือกไว้ คงเดิม)
  async function saveToTaxForm() {
    const outSet = new Set(moves.filter(m2 => m2.from_period === ymNum(month)).map(m2 => m2.doc_no));
    const act = rows.filter(r => !r.cancelled
      && !((r.source === "part_service" || r.source === "fee_insurance") && outSet.has(stripDoc(r.tax_invoice_no))));
    const baseAll = act.reduce((s2, r) => s2 + r.amount_before_vat, 0);
    const vatAll = act.reduce((s2, r) => s2 + r.vat_amount, 0);
    if (!act.length) { setMsg("❌ ไม่มีข้อมูลให้บันทึก"); return; }
    if (!window.confirm(`บันทึกยอดภาษีขาย ${affiliation} งวด ${periodLabel(month)}\nมูลค่า ${fmt(baseAll)} · ภาษีขาย ${fmt(vatAll)} บาท (${act.length} ใบ)\nเข้าหน้าเตรียมแบบภาษี ภ.พ.30 ?`)) return;
    setMsg("");
    try {
      const listRes = await fetch(INTAX_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_tax_filings" }) }).then(r => r.json()).catch(() => []);
      const recs = Array.isArray(listRes) ? listRes : (listRes?.rows || []);
      const exist = recs.find(r => r && String(r.filing_month) === month && String(r.affiliation || "") === affiliation && (r.tax_form || "ภ.พ.30") === "ภ.พ.30");
      let keys = [];
      if (exist && exist.selected_keys) { try { keys = Array.isArray(exist.selected_keys) ? exist.selected_keys : JSON.parse(exist.selected_keys || "[]"); } catch { keys = []; } }
      const purchase = exist ? (Number(exist.purchase_vat) || 0) : 0;
      const body = {
        action: "save_tax_filing", id: exist ? exist.id : undefined,
        filing_month: month, affiliation, tax_form: "ภ.พ.30",
        filing_type: exist ? (exist.filing_type || "ยื่นปกติ") : "ยื่นปกติ",
        payment_date: exist ? (exist.payment_date ? String(exist.payment_date).slice(0, 10) : null) : null,
        sales_vat: Math.round(vatAll * 100) / 100, purchase_vat: purchase,
        payable: Math.round((vatAll - purchase) * 100) / 100,
        status: exist ? (exist.status || "ร่าง") : "ร่าง", selected_keys: keys,
        note: `ยอดขายจากรายงานภาษีขาย ${act.length} ใบ มูลค่า ${fmt(baseAll)}`,
      };
      await fetch(INTAX_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setMsg(`✅ บันทึกเข้าเตรียมแบบ ภ.พ.30 แล้ว (${exist ? "อัปเดตแบบเดิม" : "สร้างแบบใหม่"}: ${affiliation} ${periodLabel(month)} · ภาษีขาย ${fmt(vatAll)})`);
    } catch (e) { setMsg("❌ บันทึกไม่สำเร็จ: " + e.message); }
  }

  const movesOut = moves.filter(m2 => m2.from_period === ymNum(month)); // ใบที่ถูกเลื่อนออกจากงวดนี้
  const movesOutSet = new Set(movesOut.map(m2 => m2.doc_no));
  const movedInSet = new Set(moves.filter(m2 => m2.to_period === ymNum(month)).map(m2 => m2.doc_no)); // ใบที่ถูกดึงเข้ามางวดนี้
  const moveOf = (doc) => moves.find(m2 => m2.doc_no === doc);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return rows.filter(r => {
      if (!showCancelled && r.cancelled) return false;
      if (srcFilter && r.source !== srcFilter) return false;
      if (brFilter && rowBranch(r) !== brFilter) return false;
      // ซ่อนใบที่ถูกเลื่อนออกจากงวดนี้ (SQL ฝั่ง n8n ตัดให้อยู่แล้ว — เผื่อ workflow ยังไม่ update)
      if ((r.source === "part_service" || r.source === "fee_insurance") && movesOutSet.has(stripDoc(r.tax_invoice_no))) return false;
      if (!kw) return true;
      return [r.tax_invoice_no, r.customer_name, r.customer_tax_id].filter(Boolean).join(" ").toLowerCase().includes(kw);
    });
    /* eslint-disable-next-line */
  }, [rows, search, srcFilter, brFilter, showCancelled, moves, month]);

  const active = filtered.filter(r => !r.cancelled);
  const sumBase = active.reduce((s, r) => s + r.amount_before_vat, 0);
  const sumVat = active.reduce((s, r) => s + r.vat_amount, 0);
  const cancelledCount = rows.filter(r => r.cancelled).length;
  const company = COMPANY[affiliation];

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🧾 รายงานภาษีขาย</h2>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: msg.startsWith("❌") ? "#fee2e2" : "#fffbeb", color: msg.startsWith("❌") ? "#991b1b" : "#92400e", fontSize: 14 }}>{msg}</div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>🏢 สังกัด:</label>
        <select value={affiliation} onChange={e => setAffiliation(e.target.value)} style={inp}>
          {Object.keys(AFF_BRANCHES).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <label style={{ fontSize: 13, fontWeight: 600 }}>📅 เดือนภาษี:</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inp} />
        <select value={srcFilter} onChange={e => setSrcFilter(e.target.value)} style={inp}>
          <option value="">📂 แหล่ง: ทั้งหมด</option>
          <option value="vehicle">ขายรถ</option>
          <option value="other">รายรับอื่น</option>
          <option value="part_service">อะไหล่/บริการ</option>
          <option value="fee_insurance">รายได้ประกัน/ค่าบริการ</option>
          <option value="debit_note">ใบเพิ่มหนี้</option>
        </select>
        <select value={brFilter} onChange={e => setBrFilter(e.target.value)} style={inp} title="กรองตามสาขา/จุดขาย">
          <option value="">🏪 สาขา: ทั้งหมด</option>
          {[...new Set(rows.map(rowBranch))].filter(b => b && b !== "-").sort().map(b => (
            <option key={b} value={b}>{BR_LABEL[b] || b}</option>
          ))}
        </select>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} />
          แสดงใบยกเลิก ({cancelledCount})
        </label>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 ค้นหา เลขที่ใบกำกับ / ผู้ซื้อ / เลขผู้เสียภาษี"
          style={{ ...inp, flex: 1, minWidth: 200 }} />
        <button onClick={loadRows} disabled={loading} style={btn("#0369a1")}>🔄 รีเฟรช</button>
        <button onClick={() => printReport({ affiliation, month, company, rows: filtered, sumBase, sumVat })}
          disabled={filtered.length === 0} style={btn("#7c3aed")}>🖨️ พิมพ์</button>
        <button onClick={saveToTaxForm} disabled={loading || rows.length === 0} style={btn("#16a34a")}
          title="บันทึกยอดภาษีขายทั้งเดือนเข้าหน้าเตรียมแบบภาษีรายเดือน (ภ.พ.30)">📄 บันทึกเข้าเตรียมแบบ ภ.พ.30</button>
      </div>

      {/* Report header */}
      <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
        <div style={{ fontWeight: 700, color: "#072d6b" }}>รายงานภาษีขาย (ภ.พ.30) — {company.name} เลขประจำตัวผู้เสียภาษีอากร {company.tax_id}</div>
        <div style={{ color: "#6b7280" }}>สำหรับงวดภาษี {periodLabel(month)} · แหล่งข้อมูล: ใบกำกับขายรถ (DMS) + ใบกำกับรายรับอื่น ๆ ที่ upload</div>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
        <span>ใบกำกับ <strong>{active.length}</strong> ใบ{showCancelled && cancelledCount > 0 ? ` (+ยกเลิก ${filtered.length - active.length})` : ""}</span>
        <span style={{ color: "#6b7280", fontSize: 12 }}>
          ขายรถ {active.filter(r => r.source === "vehicle").length} · รายรับอื่น {active.filter(r => r.source === "other").length} · อะไหล่/บริการ {active.filter(r => r.source === "part_service").length} · ประกัน/ค่าบริการ {active.filter(r => r.source === "fee_insurance").length}{active.some(r => r.source === "debit_note") ? ` · ใบเพิ่มหนี้ ${active.filter(r => r.source === "debit_note").length}` : ""}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: "#374151" }}>มูลค่ารวม: <strong>{fmt(sumBase)}</strong></span>
        <span style={{ color: "#dc2626" }}>ภาษีขายรวม: <strong>{fmt(sumVat)}</strong> บาท</span>
      </div>

      {/* ใบที่ถูกเลื่อนออกจากงวดนี้ */}
      {movesOut.length > 0 && (
        <div style={{ padding: "8px 14px", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10, marginBottom: 12, fontSize: 12.5 }}>
          <b style={{ color: "#c2410c" }}>📄 ใบที่ถูกลบออกจากงวดนี้ (ไปขึ้นงวดถัดไป):</b>
          {movesOut.map(m2 => (
            <span key={m2.doc_no} style={{ marginLeft: 10, whiteSpace: "nowrap" }}>
              <code>{m2.doc_no}</code> → {fmtPeriod(m2.to_period)}
              <button onClick={() => cancelMove(m2.doc_no)}
                style={{ marginLeft: 4, padding: "0 6px", border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>ยกเลิก</button>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={{ ...th, textAlign: "center", width: 44 }}>ลำดับ</th>
                <th style={th}>วันที่ใบกำกับ</th>
                <th style={th}>เลขที่ใบกำกับ</th>
                <th style={th}>แหล่ง</th>
                <th style={th}>ชื่อผู้ซื้อ</th>
                <th style={th}>เลขผู้เสียภาษี</th>
                <th style={{ ...th, textAlign: "right" }}>มูลค่า</th>
                <th style={{ ...th, textAlign: "right" }}>ภาษีมูลค่าเพิ่ม</th>
                <th style={{ ...th, textAlign: "center", width: 60 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={`${r.source}|${r.tax_invoice_no}|${i}`}
                  style={{ borderTop: "1px solid #eef2f7", background: r.cancelled ? "#fef2f2" : "transparent",
                    textDecoration: r.cancelled ? "line-through" : "none", color: r.cancelled ? "#9ca3af" : "inherit" }}>
                  <td style={{ ...td, textAlign: "center", color: "#6b7280" }}>{i + 1}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.invoice_date)}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: r.cancelled ? "#9ca3af" : "#1d4ed8" }}>
                    {r.tax_invoice_no || "-"}
                    {r.cancelled && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: "#fee2e2", color: "#991b1b", fontSize: 10, fontWeight: 700, textDecoration: "none", display: "inline-block" }}>ยกเลิก</span>}
                  </td>
                  <td style={td}>
                    <span style={{ padding: "1px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                      background: r.source === "vehicle" ? "#dbeafe" : r.source === "part_service" ? "#fef3c7" : r.source === "fee_insurance" ? "#ede9fe" : r.source === "debit_note" ? "#fce7f3" : "#d1fae5",
                      color: r.source === "vehicle" ? "#1e40af" : r.source === "part_service" ? "#92400e" : r.source === "fee_insurance" ? "#6d28d9" : r.source === "debit_note" ? "#9d174d" : "#065f46" }}>
                      {SRC_LABEL[r.source]}
                    </span>
                    <span style={{ marginLeft: 4, fontSize: 10, color: "#9ca3af" }}>{rowBranch(r)}</span>
                  </td>
                  <td style={td}>{r.customer_name || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", whiteSpace: "nowrap" }}>{r.customer_tax_id || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.amount_before_vat)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.vat_amount)}</td>
                  <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                    {(r.source === "part_service" || r.source === "fee_insurance") && !r.cancelled && (
                      movedInSet.has(stripDoc(r.tax_invoice_no)) ? (
                        <button onClick={() => cancelMove(stripDoc(r.tax_invoice_no))}
                          title={`ย้ายเข้าจากงวด ${fmtPeriod(moveOf(stripDoc(r.tax_invoice_no))?.from_period)} — กดเพื่อยกเลิกย้าย`}
                          style={{ padding: "2px 8px", border: "1px solid #86efac", background: "#f0fdf4", color: "#15803d", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                          ย้ายเข้า ↩
                        </button>
                      ) : (
                        <button onClick={() => moveDocNext(r)} title="ลบออกจากงวดนี้ → ไปขึ้นงวดถัดไป"
                          style={{ padding: "2px 8px", border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>
                          ✕ งวดถัดไป
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #072d6b", background: "#f8fafc", fontWeight: 700 }}>
                <td style={td} colSpan={6}>ยอดรวมทั้งสิ้น (ไม่รวมใบยกเลิก)</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(sumBase)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{fmt(sumVat)}</td>
                <td style={td}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

// ── พิมพ์รายงาน (รูปแบบราชการ) ───────────────────────────────────────────────
function printReport({ affiliation, month, company, rows, sumBase, sumVat }) {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const body = rows.map((r, i) => `<tr${r.cancelled ? ' style="color:#9ca3af;text-decoration:line-through"' : ""}>
      <td class="c">${i + 1}</td>
      <td class="c">${esc(fmtDate(r.invoice_date))}</td>
      <td>${esc(r.tax_invoice_no || "")}${r.cancelled ? " (ยกเลิก)" : ""}</td>
      <td>${esc(r.customer_name || "")}</td>
      <td class="c">${esc(r.customer_tax_id || "")}</td>
      <td class="r">${fmt(r.amount_before_vat)}</td>
      <td class="r">${fmt(r.vat_amount)}</td>
    </tr>`).join("");
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานภาษีขาย ${esc(month)}</title>
    <style>
      *{font-family:'Tahoma','Sarabun',sans-serif;box-sizing:border-box}
      body{margin:22px;color:#111827;font-size:12px}
      h1{font-size:17px;margin:0 0 2px}
      .sub{color:#374151;margin-bottom:2px}
      .muted{color:#6b7280;font-size:11px;margin-bottom:10px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #cbd5e1;padding:4px 6px;vertical-align:top}
      th{background:#e2e8f0;font-size:11px}
      .c{text-align:center}.r{text-align:right;font-family:monospace}
      tfoot td{font-weight:bold;background:#f1f5f9}
      @media print{body{margin:0;padding:14px}}
    </style></head><body>
    <h1>รายงานภาษีขาย (ภ.พ.30)</h1>
    <div class="sub">${esc(company.name)} เลขประจำตัวผู้เสียภาษีอากร ${esc(company.tax_id)}</div>
    <div class="sub">สำหรับงวดภาษี ${esc(periodLabel(month))} · สังกัด ${esc(affiliation)}</div>
    <div class="muted">พิมพ์จากระบบ — รวมใบกำกับขายรถ (DMS) + ใบกำกับรายรับอื่น ๆ ที่ upload</div>
    <table>
      <thead><tr>
        <th>ลำดับ</th><th>วันที่ใบกำกับ</th><th>เลขที่ใบกำกับ</th>
        <th>ชื่อผู้ซื้อสินค้า/ผู้รับบริการ</th><th>เลขผู้เสียภาษี</th><th>มูลค่า</th><th>ภาษีมูลค่าเพิ่ม</th>
      </tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="5">ยอดรวมทั้งสิ้น (ไม่รวมใบยกเลิก)</td><td class="r">${fmt(sumBase)}</td><td class="r">${fmt(sumVat)}</td></tr></tfoot>
    </table>
  </body></html>`;
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) return;
  w.document.write(html + "<script>window.onload=function(){window.print();}<\/script>");
  w.document.close();
}

const inp = { padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "9px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "7px 8px", fontSize: 12.5, verticalAlign: "top" };
const btn = (color) => ({ padding: "7px 14px", background: color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 });
