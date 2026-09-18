import React, { useEffect, useMemo, useState } from "react";
import { expectedByRule, markupSum, deliveryFeeBonus } from "../utils/carPaymentStatus";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/list-tax-invoices";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const REPORT_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-report-api";
// เทียบใบกำกับ (upload DMS) กับใบขายจากระบบ "บันทึกขาย NEW" (retail_sales) จับคู่ด้วยเลขตัวถัง — user 2026-09-17
const RETAIL_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
const normChassis = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const BRANCH_OPTS = [
  { value: "ALL", label: "ทั้งหมด", table: "ทุกสาขา" },
  { value: "PAPAO", label: "ป.เปา", table: "tax_invoices_papao" },
  { value: "NAKORNLUANG", label: "นครหลวง", table: "tax_invoices_nakornluang" },
  { value: "SINGCHAI", label: "สิงห์ชัย", table: "tax_invoices_singchai" },
];

function fmtDate(s) {
  if (!s) return "-";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const yy = (parseInt(m[1], 10) + 543).toString().slice(-2);
  return `${m[3]}/${m[2]}/${yy}`;
}

function fmtN(n) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default function TaxInvoiceReportPage({ currentUser }) {
  const [branch, setBranch] = useState("ALL");
  // ค่าเริ่มต้น = เดือนปัจจุบัน (ปี พ.ศ.+เดือน เช่น 256907) — ลดเวลาโหลดครั้งแรก เลือก "ทั้งหมด" ได้จาก dropdown
  const [yearMonth, setYearMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear() + 543}${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // active / cancelled
  const [priceFilter, setPriceFilter] = useState("");     // "" / ok / low / high — สถานะราคาขายเทียบยอดตามกฎ
  const [saleFilter, setSaleFilter] = useState("");       // "" / ok / diff / nosale — เทียบยอดใบกำกับกับใบขายในระบบ
  const [sysSales, setSysSales] = useState([]);           // ใบขายระบบ (retail_sales) ช่วงเดือนที่ดู
  const [showNoInvoice, setShowNoInvoice] = useState(false);
  const [allRows, setAllRows] = useState([]);             // ใบกำกับทั้ง 3 บริษัทของเดือนนี้ (ไม่ขึ้นกับตัวกรองสาขา) — ใช้เช็ค "ใบขายที่ยังไม่มีใบกำกับ"
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ===== สถานะราคาขาย vs ยอดตามกฎ (ประกาศ ณ วันขาย + บวกเพิ่ม + นำพา) — logic เดียวกับหน้ารับชำระเงินค่ารถ =====
  const [markups, setMarkups] = useState([]);          // กฎรายการบวกเพิ่ม (sale_price_markups)
  const [cpMap, setCpMap] = useState({});              // sale_invoice_no → แถวจาก list_car_payment_receipts (มี sale_price/price_date/นำพา/is_booking)
  useEffect(() => {
    fetch(ACC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_price_markups" }) })
      .then(r => r.json())
      .then(d => setMarkups((Array.isArray(d) ? d : (d?.rows || [])).filter(x => x && x.status === "active")))
      .catch(() => setMarkups([]));
  }, []);
  useEffect(() => {
    if (!yearMonth) { setCpMap({}); return; }          // ดู "ทั้งหมด" ไม่คำนวณ (ช่วงกว้างเกิน)
    const y = parseInt(yearMonth.slice(0, 4), 10) - 543;
    const m = parseInt(yearMonth.slice(4, 6), 10);
    // ขยายช่วง ±7 วัน กันใบกำกับ/วันขายคร่อมเดือน
    const from = new Date(y, m - 1, 1); from.setDate(from.getDate() - 7);
    const to = new Date(y, m, 0); to.setDate(to.getDate() + 7);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let alive = true;
    fetch(REPORT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_car_payment_receipts", date_from: iso(from), date_to: iso(to) }) })
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        const arr = Array.isArray(d) ? d : (d?.rows || []);
        const map = {};
        arr.forEach(x => { const k = String(x?.sale_invoice_no || "").toUpperCase().trim(); if (k && !map[k]) map[k] = x; });
        setCpMap(map);
      })
      .catch(() => { if (alive) setCpMap({}); });
    return () => { alive = false; };
  }, [yearMonth]);

  // ใบขายจากระบบ: ดึงย้อน 35 วัน (ขายปลายเดือนก่อน ออกใบกำกับเดือนนี้) ถึงสิ้นเดือน +7 วัน — ข้อมูลระบบเริ่ม ส.ค.69
  useEffect(() => {
    if (!yearMonth) { setSysSales([]); return; }
    const y = parseInt(yearMonth.slice(0, 4), 10) - 543, m = parseInt(yearMonth.slice(4, 6), 10);
    const from = new Date(y, m - 1, 1); from.setDate(from.getDate() - 35);
    const to = new Date(y, m, 0); to.setDate(to.getDate() + 7);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let alive = true;
    fetch(RETAIL_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_retail_sales", date_from: iso(from), date_to: iso(to), limit: 3000 }) })
      .then(r => r.text()).then(t => { if (!alive) return; let d = []; try { d = t.trim() ? JSON.parse(t) : []; } catch { d = []; } setSysSales((Array.isArray(d) ? d : []).filter(x => x && x.invoice_no)); })
      .catch(() => { if (alive) setSysSales([]); });
    return () => { alive = false; };
  }, [yearMonth]);
  const saleByChassis = useMemo(() => {
    const m = {};
    sysSales.forEach(x => { if (String(x.sale_status || "") === "cancelled") return; const k = normChassis(x.chassis_no); if (k && !m[k]) m[k] = x; });
    return m;
  }, [sysSales]);
  // เทียบยอดใบกำกับ ↔ ใบขายระบบ: ตรงราคาขายสุทธิ = ok · ตรงยอดจัดไฟแนนท์ (เงินดาวน์ออกใบ TF แยก เช่น SGF) = okfin · อื่นๆ = diff
  function saleCompareOf(r) {
    if (r.status === "cancelled") return null;
    const sale = saleByChassis[normChassis(r.chassis_no)];
    if (!sale) return { kind: "nosale" };
    const inv = Number(r.total_amount || 0), net = Number(sale.net_car_price || 0), fin = Number(sale.finance_amount || 0);
    if (Math.abs(inv - net) < 1) return { kind: "ok", sale, expected: net, diff: 0 };
    if (fin > 0 && Math.abs(inv - fin) < 1) return { kind: "okfin", sale, expected: fin, diff: 0, down: net - fin };
    return { kind: "diff", sale, expected: net, diff: Math.round((inv - net) * 100) / 100 };
  }

  // คำนวณสถานะราคาต่อใบ: null = ไม่มีข้อมูลเทียบ
  // ฐานเทียบ = max(ยอดใบกำกับ, รับชำระรวม) — ขายไฟแนนซ์แบบแยกใบ (เช่น SGF: ค่ารถถึงไฟแนนซ์ + เงินดาวน์ออกใบ TF แยก)
  // ยอดใบกำกับจะต่ำกว่าราคารถจริง แต่ใบเสร็จรับครบทั้งก้อน → ใช้รับชำระเป็นฐานแทน
  function priceStatusOf(r) {
    if (r.status === "cancelled" || !r.sale_invoice_no) return null;
    const cp = cpMap[String(r.sale_invoice_no).toUpperCase().trim()];
    if (!cp || !(Number(cp.sale_price) > 0)) return null;
    // ขายส่ง (ขายให้ดีลเลอร์) — ราคาตกลงกันเอง ไม่เทียบราคาประกาศขายปลีก
    if (String(cp.sale_invoice_type || "").trim() === "ขายส่ง") return { wholesale: true, cp };
    const expected = expectedByRule(cp, markups);
    // total_paid ของหน้านี้ = ใบเสร็จรายวันทั้งหมดของใบขาย (รวมมัดจำจากไฟแนนซ์แล้ว) — ห้ามบวก FT ซ้ำ
    const actual = Number(r.total_amount || 0); // 2026-09-18 หน้านี้ไม่ตรวจรับชำระแล้ว — เทียบยอดใบกำกับอย่างเดียว
    const diff = Math.round((actual - expected) * 100) / 100;
    const isBooking = cp.is_booking === true || cp.is_booking === "true" || cp.is_booking === "t";
    return { expected, diff, isBooking, cp };
  }


  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      // ถ้าเลือก "ทั้งหมด" → ดึงข้อมูล 3 สาขาพร้อมกัน
      // ดึงครบ 3 บริษัทเสมอ แล้วค่อยกรองสาขาฝั่งจอ — รถ YAMAHA ที่ขายหน้าร้าน ป.เปา (SCY06) ออกใบกำกับในนามสิงห์ชัย (MC01…)
      // ถ้าดึงเฉพาะสาขาที่เลือก จะเห็นเป็น "ยังไม่มีใบกำกับ" ผิด (เคส SCY06-MCSA-2608-00008 ↔ MC016908/0047, user 2026-09-17)
      const branches = ["PAPAO", "NAKORNLUANG", "SINGCHAI"];
      const all = await Promise.all(branches.map(async (br) => {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "list_tax_invoices",
            branch: br,
            year_month: yearMonth || null,
          }),
        });
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data?.rows || [];
        // tag each row with branch source
        return arr.map(r => ({ ...r, _branch: br }));
      }));
      const merged = all.flat();
      setAllRows(merged);
      setRows(branch === "ALL" ? merged : merged.filter(r => r._branch === branch));
    } catch (e) {
      setMessage("❌ โหลดไม่สำเร็จ: " + e.message);
      setRows([]); setAllRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [branch, yearMonth]); // เปลี่ยนสาขา/เดือน → ดึงข้อมูลใหม่จาก server (ไม่ใช่แค่กรองฝั่งจอ)

  const kw = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (yearMonth && String(r.invoice_year_month || "") !== yearMonth) return false;
      if (priceFilter) {
        const ps = priceStatusOf(r);
        if (priceFilter === "none") { if (ps) return false; }
        else if (priceFilter === "wholesale") { if (!(ps && ps.wholesale)) return false; }
        else if (!ps || ps.wholesale) return false;
        else if (priceFilter === "ok" && !(Math.abs(ps.diff) < 1)) return false;
        else if (priceFilter === "low" && !(ps.diff <= -1)) return false;
        else if (priceFilter === "high" && !(ps.diff >= 1)) return false;
      }
      if (saleFilter) {
        const sc = saleCompareOf(r);
        if (!sc) return false;
        if (saleFilter === "ok" && !(sc.kind === "ok" || sc.kind === "okfin")) return false;
        if (saleFilter === "diff" && sc.kind !== "diff") return false;
        if (saleFilter === "nosale" && sc.kind !== "nosale") return false;
      }
      if (!kw) return true;
      const hay = [
        r.tax_invoice_no, r.customer_name, r.sale_customer_name, r.sale_finance_company,
        r.customer_tax_id, r.chassis_no, r.engine_no, r.model_name, r.plate_number,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(kw);
    });
    // eslint-disable-next-line
  }, [rows, kw, statusFilter, yearMonth, priceFilter, cpMap, markups, saleFilter, saleByChassis]);

  // สรุปผลเทียบใบขายระบบ (ทั้งเดือน/สาขาที่เลือก ไม่ขึ้นกับคำค้น) + ใบขายระบบของเดือนนี้ที่ยังไม่มีใบกำกับ
  const saleSummary = useMemo(() => {
    const out = { ok: 0, okfin: 0, diff: 0, diffAmt: 0, nosale: 0 };
    rows.forEach(r => { if (yearMonth && String(r.invoice_year_month || "") !== yearMonth) return; const sc = saleCompareOf(r); if (!sc) return; out[sc.kind] += 1; if (sc.kind === "diff") out.diffAmt += sc.diff; });
    return out;
    // eslint-disable-next-line
  }, [rows, yearMonth, saleByChassis]);
  // บริษัทที่ต้องออกใบกำกับของใบขาย: YAMAHA → สิงห์ชัย (ทุกจุดขาย) · HONDA → ป.เปา (จุดขาย SCY05 = นครหลวง)
  const invoiceTableOf = (x) => String(x.brand || "").toUpperCase().includes("YAMAHA") ? "SINGCHAI" : (String(x.branch_code || "").slice(0, 5).toUpperCase() === "SCY05" ? "NAKORNLUANG" : "PAPAO");
  const noInvoiceSales = useMemo(() => {
    if (!yearMonth) return [];
    const ym = `${parseInt(yearMonth.slice(0, 4), 10) - 543}-${yearMonth.slice(4, 6)}`;
    const have = new Set(allRows.filter(r => r.status !== "cancelled").map(r => normChassis(r.chassis_no)));
    return sysSales.filter(x => String(x.sale_date || "").slice(0, 7) === ym && String(x.sale_status || "") !== "cancelled" && !have.has(normChassis(x.chassis_no))
      && (branch === "ALL" || invoiceTableOf(x) === branch))
      .sort((a, b) => String(a.sale_date).localeCompare(String(b.sale_date)) || String(a.invoice_no).localeCompare(String(b.invoice_no)));
    // eslint-disable-next-line
  }, [sysSales, allRows, yearMonth, branch]);

  // Year-month options: ย้อนหลัง 24 เดือนจากเดือนปัจจุบัน (สร้างเอง — ไม่อิงข้อมูลที่โหลด เพราะโหลดทีละเดือน)
  const ymOpts = useMemo(() => {
    const out = [];
    const n = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(n.getFullYear(), n.getMonth() - i, 1);
      out.push(`${d.getFullYear() + 543}${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, []);

  const totals = filtered.reduce((s, r) => {
    if (r.status === "cancelled") return s;
    s.before += Number(r.amount_before_vat || 0);
    s.vat += Number(r.vat_amount || 0);
    s.total += Number(r.total_amount || 0);
    s.profit += Number(r.gross_profit || 0);
    return s;
  }, { before: 0, vat: 0, total: 0, profit: 0 });

  const branchOpt = BRANCH_OPTS.find(b => b.value === branch);

  // พิมพ์รายการตามตัวกรองปัจจุบัน (A4 แนวนอน) รวมผลเทียบใบขายระบบ — user 2026-09-17
  function printReport() {
    if (!filtered.length) { setMessage("❌ ไม่มีรายการให้พิมพ์"); return; }
    const esc = (v) => String(v == null ? "" : v).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const ymLabel = yearMonth ? `${yearMonth.slice(4, 6)}/${yearMonth.slice(0, 4)}` : "ทั้งหมด";
    const fl = [];
    if (statusFilter) fl.push(statusFilter === "cancelled" ? "สถานะ: ยกเลิก" : "สถานะ: ใช้งาน");
    if (priceFilter) fl.push("ราคาขาย: " + ({ ok: "ถูกต้อง", low: "ต่ำกว่ากฎ", high: "เกินกฎ", wholesale: "ขายส่ง", none: "ไม่มีข้อมูลเทียบ" }[priceFilter] || priceFilter));
    if (saleFilter) fl.push("เทียบใบขายระบบ: " + ({ ok: "ยอดตรง", diff: "ยอดต่าง", nosale: "ไม่พบใบขายระบบ" }[saleFilter] || saleFilter));
    if (search.trim()) fl.push("ค้นหา: " + search.trim());
    let sumSale = 0, sumDiff = 0;
    const trs = filtered.map((r, i) => {
      const off = r.status === "cancelled";
      const sc = saleCompareOf(r), ps = priceStatusOf(r);
      if (sc && sc.sale) { sumSale += sc.expected; sumDiff += sc.diff || 0; }
      const saleTxt = !sc ? "-" : sc.kind === "nosale" ? "ไม่พบใบขาย" : `${fmtN(sc.expected)}<div class="sm ${sc.kind === "diff" ? "red" : "grn"}">${sc.kind === "ok" ? "ตรง" : sc.kind === "okfin" ? "ตรงยอดจัด · ดาวน์ " + fmtN(sc.down) : "ต่าง " + (sc.diff > 0 ? "+" : "") + fmtN(sc.diff)}</div><div class="sm">${esc(sc.sale.invoice_no)}</div>`;
      const priceTxt = !ps ? "-" : ps.wholesale ? "ขายส่ง" : Math.abs(ps.diff) < 1 ? "ถูกต้อง" : (ps.diff < 0 ? "ต่ำกว่ากฎ " + fmtN(-ps.diff) : "เกินกฎ " + fmtN(ps.diff)) + (ps.isBooking ? " · จอง" : "");
      return `<tr class="${off ? "off" : ""}"><td class="c">${i + 1}</td><td class="mono">${esc(r.tax_invoice_no)}</td><td class="sm">${esc(r.sale_invoice_no || "-")}</td><td class="c">${fmtDate(r.invoice_date)}</td>
<td>${esc(r.sale_customer_name || r.customer_name || "-")}${r.sale_customer_name && r.customer_name && r.sale_customer_name !== r.customer_name ? `<div class="sm">ใบกำกับ: ${esc(r.customer_name)}</div>` : ""}</td>
<td class="sm mono">${esc(r.chassis_no || "-")}</td><td class="sm">${esc(r.model_name || "-")}</td>
<td class="r">${fmtN(r.amount_before_vat)}</td><td class="r">${fmtN(r.vat_amount)}</td><td class="r b">${fmtN(r.total_amount)}</td>
<td class="sm">${esc(priceTxt)}</td><td class="r">${saleTxt}</td><td class="c sm">${off ? "ยกเลิก" : "ใช้งาน"}</td></tr>`;
    }).join("");
    const act = filtered.filter(r => r.status !== "cancelled");
    const now = new Date(); const p2 = (n) => String(n).padStart(2, "0");
    const w = window.open("", "_blank", "width=1300,height=850");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายงานใบกำกับภาษี ${ymLabel}</title>
<style>@page{size:A4 landscape;margin:9mm}body{font-family:Tahoma,sans-serif;font-size:10px;color:#111}h2{margin:0 0 2px;font-size:15px}.info{color:#555;margin-bottom:6px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:3px 5px;vertical-align:top}th{background:#072d6b;color:#fff;font-size:10px}
.r{text-align:right}.c{text-align:center}.b{font-weight:700}.mono{font-family:monospace;white-space:nowrap}.sm{font-size:8.5px;color:#555}.red{color:#b91c1c;font-weight:700}.grn{color:#15803d;font-weight:700}
tr.off td{color:#999;text-decoration:line-through}tfoot td{background:#fde68a;font-weight:700}.sumbox{margin:4px 0 8px;font-size:10.5px}</style></head><body>
<h2>รายงานใบกำกับภาษีขายรถ — เทียบใบขายจากระบบ</h2>
<div class="info">เดือนภาษี ${ymLabel} · สาขา ${esc(branchOpt?.label || branch)}${fl.length ? " · " + esc(fl.join(" · ")) : ""} · ${filtered.length} รายการ (ใช้งาน ${act.length}) · พิมพ์ ${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear() + 543} ${p2(now.getHours())}:${p2(now.getMinutes())} โดย ${esc(currentUser?.name || currentUser?.username || "-")}</div>
<div class="sumbox">ผลเทียบใบขายระบบทั้งเดือน: ยอดตรง ${saleSummary.ok + saleSummary.okfin} (ตรงยอดจัด ${saleSummary.okfin}) · ยอดต่าง ${saleSummary.diff} (${fmtN(saleSummary.diffAmt)}) · ไม่พบใบขายระบบ ${saleSummary.nosale} · ใบขายระบบที่ยังไม่มีใบกำกับ ${noInvoiceSales.length} ใบ</div>
<table><thead><tr><th>#</th><th>เลขที่ใบกำกับ</th><th>เลขที่ใบขาย</th><th>วันที่</th><th>ลูกค้า</th><th>เลขถัง</th><th>รุ่น</th><th>ก่อน VAT</th><th>VAT</th><th>รวม</th><th>ราคาขาย</th><th>ใบขายระบบ</th><th>สถานะ</th></tr></thead>
<tbody>${trs}</tbody>
<tfoot><tr><td colspan="7" class="r">รวม (เฉพาะใช้งาน) ${act.length} ใบ</td><td class="r">${fmtN(totals.before)}</td><td class="r">${fmtN(totals.vat)}</td><td class="r">${fmtN(totals.total)}</td><td></td><td class="r">${fmtN(sumSale)}${Math.abs(sumDiff) >= 0.01 ? `<div class="sm red">ต่างรวม ${sumDiff > 0 ? "+" : ""}${fmtN(sumDiff)}</div>` : ""}</td><td></td></tr></tfoot></table>
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">📊 รายงานใบกำกับภาษี</div>
      </div>

      {/* Filters */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <label style={lbl}>🏢 สาขา</label>
            <select value={branch} onChange={e => setBranch(e.target.value)} style={{ ...inp, minWidth: 160 }}>
              {BRANCH_OPTS.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>📅 เดือน-ปี</label>
            <select value={yearMonth} onChange={e => setYearMonth(e.target.value)} style={{ ...inp, minWidth: 130, fontFamily: "monospace" }}>
              <option value="">ทั้งหมด</option>
              {ymOpts.map(ym => <option key={ym} value={ym}>{ym.slice(4)}/{ym.slice(0, 4)}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>สถานะ</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, minWidth: 110 }}>
              <option value="">ทั้งหมด</option>
              <option value="active">ใช้งาน</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>
          <div>
            <label style={lbl} title="เทียบยอดใบกำกับกับยอดตามกฎ (ประกาศ ณ วันขาย + บวกเพิ่ม + นำพา) — คำนวณเฉพาะตอนเลือกเดือน">สถานะราคา</label>
            <select value={priceFilter} onChange={e => setPriceFilter(e.target.value)} style={{ ...inp, minWidth: 130 }}>
              <option value="">ทั้งหมด</option>
              <option value="ok">✅ ถูกต้อง</option>
              <option value="low">▼ ต่ำกว่ากฎ</option>
              <option value="high">▲ เกินกฎ</option>
              <option value="wholesale">🏷️ ขายส่ง</option>
              <option value="none">– ไม่มีข้อมูลเทียบ</option>
            </select>
          </div>
          <div>
            <label style={lbl} title="จับคู่ใบกำกับ (upload) กับใบขายจากระบบบันทึกขาย NEW ด้วยเลขตัวถัง แล้วเทียบยอดใบกำกับกับราคาขายสุทธิ">เทียบใบขายระบบ</label>
            <select value={saleFilter} onChange={e => setSaleFilter(e.target.value)} style={{ ...inp, minWidth: 140 }}>
              <option value="">ทั้งหมด</option>
              <option value="ok">✅ ยอดตรง</option>
              <option value="diff">⚠️ ยอดต่าง</option>
              <option value="nosale">– ไม่พบใบขายระบบ</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={lbl}>🔍 ค้นหา</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="เลขที่ / ลูกค้า (ทั้งจริง+ใบกำกับ) / เลขผู้เสียภาษี / เลขถัง / เลขเครื่อง / รุ่น / ทะเบียน"
              style={inp} />
          </div>
          <div>
            <label style={lbl}>&nbsp;</label>
            <button onClick={fetchData} disabled={loading}
              style={{ padding: "8px 16px", background: loading ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
              🔄 {loading ? "กำลังโหลด..." : "รีเฟรช"}
            </button>
            <button onClick={printReport} disabled={loading || !filtered.length} title="พิมพ์รายการตามตัวกรองที่เลือกอยู่ (A4 แนวนอน)"
              style={{ marginLeft: 6, padding: "8px 16px", background: filtered.length ? "#6b7280" : "#d1d5db", color: "#fff", border: "none", borderRadius: 8, cursor: filtered.length ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600 }}>
              🖨️ พิมพ์
            </button>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280" }}>
          📦 Table: <code style={{ color: "#6366f1" }}>{branchOpt?.table}</code>
        </div>
        {message && <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12 }}>{message}</div>}
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <SummaryCard color="#dbeafe" textColor="#1e40af" label="ยอดก่อน VAT" value={totals.before} count={filtered.filter(r => r.status === "active").length} suffix="รายการ" />
        <SummaryCard color="#fef3c7" textColor="#92400e" label="ยอดภาษี" value={totals.vat} />
        <SummaryCard color="#dcfce7" textColor="#065f46" label="ยอดรวม" value={totals.total} />
        <SummaryCard color="#ede9fe" textColor="#5b21b6" label="กำไรขั้นต้น" value={totals.profit} />
      </div>

      {/* เทียบกับใบขายจากระบบ */}
      {yearMonth && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 14, fontSize: 13 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ color: "#072d6b" }}>⚖️ เทียบกับใบขายจากระบบ (บันทึกขาย NEW · จับคู่เลขตัวถัง)</b>
            {[["ok", `✅ ยอดตรง ${saleSummary.ok + saleSummary.okfin}${saleSummary.okfin ? ` (ตรงยอดจัด ${saleSummary.okfin})` : ""}`, "#dcfce7", "#065f46"],
              ["diff", `⚠️ ยอดต่าง ${saleSummary.diff}${saleSummary.diff ? ` (${fmtN(saleSummary.diffAmt)})` : ""}`, "#fef3c7", "#92400e"],
              ["nosale", `– ไม่พบใบขายระบบ ${saleSummary.nosale}`, "#f1f5f9", "#475569"]].map(([k, l, bg, fg]) => (
              <button key={k} onClick={() => setSaleFilter(saleFilter === k ? "" : k)} style={{ padding: "3px 10px", borderRadius: 12, border: saleFilter === k ? `2px solid ${fg}` : "2px solid transparent", background: bg, color: fg, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
            ))}
            <button onClick={() => setShowNoInvoice(v => !v)} style={{ padding: "3px 10px", borderRadius: 12, border: "2px solid transparent", background: noInvoiceSales.length ? "#fee2e2" : "#f1f5f9", color: noInvoiceSales.length ? "#991b1b" : "#475569", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              🧾 ใบขายระบบเดือนนี้ที่ยังไม่มีใบกำกับ {noInvoiceSales.length} ใบ ({fmtN(noInvoiceSales.reduce((a, x) => a + Number(x.net_car_price || 0), 0))}) {showNoInvoice ? "▲" : "▼"}
            </button>
          </div>
          {showNoInvoice && (
            <div style={{ marginTop: 8, maxHeight: 300, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
              <table className="data-table" style={{ fontSize: 12, width: "100%", whiteSpace: "nowrap" }}>
                <thead><tr><th>#</th><th>วันที่ขาย</th><th>เลขที่ใบขาย</th><th>สาขา</th><th>ลูกค้า</th><th>ไฟแนนท์</th><th>เลขถัง</th><th>รุ่น</th><th style={{ textAlign: "right" }}>ราคาขายสุทธิ</th></tr></thead>
                <tbody>
                  {noInvoiceSales.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 16, color: "#15803d" }}>✓ ใบขายในระบบของเดือนนี้มีใบกำกับครบแล้ว</td></tr>}
                  {noInvoiceSales.map((x, i) => (
                    <tr key={x.invoice_no}><td>{i + 1}</td><td>{fmtDate(x.sale_date)}</td><td style={{ fontFamily: "monospace", color: "#1d4ed8" }}>{x.invoice_no}</td><td>{String(x.branch_code || "").slice(0, 5)}</td><td>{x.customer_name}</td><td style={{ fontSize: 11 }}>{x.finance_company_name || "-"}</td><td style={{ fontFamily: "monospace" }}>{x.chassis_no}</td><td style={{ fontSize: 11 }}>{x.model_name || x.model_code || "-"}</td><td style={{ textAlign: "right", fontWeight: 700 }}>{fmtN(x.net_car_price)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: "6px 10px", fontSize: 11, color: "#6b7280" }}>ใบกำกับภาษีมาจากไฟล์ upload DMS — ใบขายที่เพิ่งขายหลังวัน upload ล่าสุดจะขึ้นในรายการนี้จนกว่าจะ upload รอบใหม่</div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" }}>
        <div style={{ marginBottom: 8, fontSize: 13, color: "#374151" }}>
          พบ <strong>{filtered.length}</strong> / {rows.length} รายการ
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ fontSize: 12, width: "100%", whiteSpace: "nowrap" }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>เลขที่ใบกำกับ</th>
                <th>เลขที่ใบขาย</th>
                <th>วันที่</th>
                <th style={{ minWidth: 200 }}>ลูกค้า</th>
                <th>เลขถัง</th>
                <th>เลขเครื่อง</th>
                <th>รุ่น</th>
                <th style={{ textAlign: "right" }}>รวม</th>
                <th title="เทียบยอดใบกำกับกับยอดตามกฎ = ราคาประกาศ ณ วันขาย + รายการบวกเพิ่ม + บวกเพิ่มค่านำพา">ราคาขาย</th>
                <th title="ราคาขายสุทธิจากใบขายในระบบ (บันทึกขาย NEW) จับคู่ด้วยเลขตัวถัง เทียบกับยอดรวมใบกำกับ" style={{ textAlign: "right" }}>ใบขายระบบ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
                  {loading ? "กำลังโหลด..." : "ไม่มีข้อมูล"}
                </td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.tax_invoice_no} style={{ background: r.status === "cancelled" ? "#fef2f2" : undefined }}>
                  <td style={{ textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                  <td style={{ fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{r.tax_invoice_no}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11, color: "#0369a1" }}>{r.sale_invoice_no || "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(r.invoice_date)}</td>
                  <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>
                    {r.status === "cancelled" ? (
                      <em style={{ color: "#dc2626" }}>ยกเลิก</em>
                    ) : r.sale_customer_name ? (
                      <>
                        <div style={{ fontWeight: 600, color: "#072d6b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.sale_customer_name}>{r.sale_customer_name}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.customer_name || r.sale_finance_company || "-"}>📋 {r.customer_name || r.sale_finance_company || "-"}</div>
                      </>
                    ) : (
                      <span title={r.customer_name || r.sale_finance_company || "-"}>{r.customer_name || r.sale_finance_company || "-"}</span>
                    )}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.chassis_no || "-"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.engine_no || "-"}</td>
                  <td style={{ fontSize: 11, color: "#6b7280" }}>{r.model_name || "-"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{r.total_amount ? fmtN(r.total_amount) : "-"}</td>
                  <td>
                    {(() => {
                      const ps = priceStatusOf(r);
                      if (!ps) return <span style={{ color: "#9ca3af" }}>-</span>;
                      if (ps.wholesale)
                        return <span title="ใบขายประเภทขายส่ง (ขายให้ดีลเลอร์) — ราคาตกลงกันเอง ไม่เทียบราคาประกาศขายปลีก" style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#f3f4f6", color: "#374151", cursor: "help" }}>🏷️ ขายส่ง</span>;
                      const tip = `ยอดตามกฎ ${fmtN(ps.expected)} = ประกาศ ${fmtN(ps.cp.sale_price)}${ps.cp.price_date ? ` (${fmtDate(ps.cp.price_date)})` : ""} + บวกเพิ่ม ${fmtN(markupSum(ps.cp, markups))} + นำพา ${fmtN(deliveryFeeBonus(ps.cp))}${ps.isBooking ? " · มีใบจอง (อาจจองก่อนปรับราคา)" : ""}`;
                      if (Math.abs(ps.diff) < 1)
                        return <span title={tip} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: "#dcfce7", color: "#065f46", cursor: "help" }}>✅ ถูกต้อง</span>;
                      return (
                        <span title={tip} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "help",
                          background: ps.diff < 0 ? "#fee2e2" : "#dbeafe", color: ps.diff < 0 ? "#991b1b" : "#1e40af" }}>
                          {ps.diff < 0 ? `▼ ต่ำกว่ากฎ ${fmtN(-ps.diff)}` : `▲ เกินกฎ ${fmtN(ps.diff)}`}{ps.isBooking ? " · จอง" : ""}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {(() => {
                      const sc = saleCompareOf(r);
                      if (!sc) return <span style={{ color: "#9ca3af" }}>-</span>;
                      if (sc.kind === "nosale") return <span title="ไม่พบเลขตัวถังนี้ในใบขายระบบ (ขายก่อนเริ่มใช้บันทึกขาย NEW ส.ค.69 หรือขายส่ง/ขายนอกระบบ)" style={{ color: "#9ca3af", fontSize: 11 }}>ไม่พบใบขาย</span>;
                      const tip = `ใบขาย ${sc.sale.invoice_no} · ${fmtDate(sc.sale.sale_date)} · ราคาขายสุทธิ ${fmtN(sc.sale.net_car_price)}${Number(sc.sale.finance_amount) > 0 ? ` · ยอดจัด ${fmtN(sc.sale.finance_amount)}` : ""}`;
                      return (
                        <span title={tip} style={{ cursor: "help" }}>
                          {fmtN(sc.expected)}
                          <div style={{ fontSize: 10, fontWeight: 700, color: sc.kind === "diff" ? "#b91c1c" : "#15803d" }}>
                            {sc.kind === "ok" ? "✅ ตรง" : sc.kind === "okfin" ? `✅ ตรงยอดจัด · ดาวน์ ${fmtN(sc.down)} แยกใบ` : `⚠️ ต่าง ${sc.diff > 0 ? "+" : ""}${fmtN(sc.diff)}`}
                          </div>
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: r.status === "cancelled" ? "#fee2e2" : "#dcfce7",
                      color: r.status === "cancelled" ? "#991b1b" : "#065f46" }}>
                      {r.status === "cancelled" ? "ยกเลิก" : "ใช้งาน"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                  <td colSpan={8} style={{ textAlign: "right" }}>รวม (เฉพาะใช้งาน)</td>
                  <td style={{ textAlign: "right" }}>{fmtN(totals.before)}</td>
                  <td style={{ textAlign: "right" }}>{fmtN(totals.vat)}</td>
                  <td style={{ textAlign: "right", color: "#072d6b" }}>{fmtN(totals.total)}</td>
                  <td></td>
                  <td style={{ textAlign: "right", color: "#15803d" }}>{fmtN(totals.profit)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
}

function SummaryCard({ color, textColor, label, value, count, suffix }) {
  return (
    <div style={{ padding: "12px 16px", background: color, borderRadius: 10 }}>
      <div style={{ fontSize: 12, color: textColor, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, color: textColor, fontWeight: 700, marginTop: 4 }}>{fmtN(value)}</div>
      {count != null && <div style={{ fontSize: 11, color: textColor, opacity: 0.8 }}>{count} {suffix || ""}</div>}
    </div>
  );
}

const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 3 };
const inp = { width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
