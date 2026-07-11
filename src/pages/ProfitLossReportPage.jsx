import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// หน้า "งบกำไรขาดทุน" (รายเดือน) — เฟสแรก: ส่วนรายได้ แยกตามสาขา SCY01–SCY07
// ----------------------------------------------------------------------------
// คอลัมน์ = รหัสสาขาจริง (branch_master): SCY01 ศูนย์ยามาฮ่า / SCY04 สีขวา /
//   SCY05 ป.เปา นครหลวง / SCY06 ป.เปา วังน้อย / SCY07 สิงห์ชัยตลาด + "รายได้รวม"
// แหล่งรายได้:
//   1) รายได้จากการขายรถ  — ใบกำกับภาษีขายรถ (list_tax_invoices × 3 บริษัท, ยอดก่อน VAT)
//      → ระบุสาขาจาก branch_codes (SCY0x จาก moto_sales) fallback = prefix ของ sale_invoice_no
//      → นครหลวงทั้งตาราง = SCY05 · ใบกำกับข้ามบริษัทจับสาขาหน้าร้านจริงได้ (เทียบ FLOW ตรง)
//   2) รายได้อะไหล่+งานซ่อม — list_part_service_sales (flow-input-tax-api, ชุดเดียวกับ
//      รายงานภาษีขาย ภ.พ.30) เรียก 2 สังกัด: สิงห์ชัย doc ขึ้นต้น SCYxx → สาขานั้นตรง ๆ,
//      ป.เปา doc 69xxx = วังน้อย (SCY06) / แท็ก "นครหลวง" = SCY05
//      → เฉพาะงานซ่อม+ขายอะไหล่จริง — แถวที่ doc ลงท้าย "· ค่าบริการ" (ค่าบริการรับฝาก
//        ชำระค่างวด/ไปรษณีย์) และ "· ประกันรถหาย" (ล็อคตั้น/คอสมอส) แยกไปหมวด 3
//        (สีขวา SCY04 ไม่มีงานอะไหล่/ซ่อม → ต้องเป็น 0 ในหมวดนี้)
//      → งานซ่อม Honda (69SERV) รวมนครหลวงปนวังน้อย — ปรับด้วยยอด branch_code='Z01'
//        จาก list_honda_repair_jobs (service-api) เป็นรายการย้ายยอด SCY06 → SCY05
//   3) รายได้ค่าบริการรับฝากชำระ + 3b) รายได้ค่าไปรษณีย์ — รายบรรทัดจาก
//      list_other_income_receipts (registrations-api, ตาราง other_income_items มี description)
//      กรอง description ขึ้นต้น ค่าบริการ/รายได้ค่าบริการ/ค่าส่งไปรษณีย์ (เกณฑ์เดียวกับ
//      รายงานภาษีขาย) · มีคำว่า "ไปรษณีย์" = หมวดไปรษณีย์ · ยอดรวม VAT ถอด /1.07
//      (แถว "· ค่าบริการ" จากข้อ 2 ถูกทิ้ง — ใช้รายบรรทัดนี้แทน กันซ้ำ)
//   3c) รายได้ประกันรถหาย — แถว "· ประกันรถหาย" จากข้อ 2: ป.เปา = คอสมอส (COSMOS),
//       สิงห์ชัย = ล็อคตั้น (LOCKTON) — สาขาตามใบรับเรื่องงานทะเบียน (registration_receipt_lines)
//   4) รายได้รับเรื่องงานทะเบียน (พรบ/ต่อภาษี — ไม่มี VAT) — get_receipt_lines
//      (registrations-api) จาก registration_receipt_lines มี branch_code จริง
//      ("00000" = ศูนย์ยามาฮ่า → SCY01) · ตัดบรรทัดประกันรถหาย/ล็อคตั้น/คอสมอส
//      (อยู่หมวด 3 แล้ว กันซ้ำ) · FLOW ลงเป็น "บันทึกรับเรื่องพรบ/ต่อภาษี" รายสาขา
//   5) รายได้ค่าส่งเสริมจากไฟแนนซ์ — ใบกำกับ TF ที่ลูกค้าเป็นบริษัทไฟแนนซ์ (FINANCE_KW)
//      หรือเอกสารที่แตกยอดประเภท 003 (รายได้ค่าส่งเสริมการขาย) — แยกจากรายได้อื่น
//   5b) รายได้อื่น (มีใบกำกับ) — list_other_income_tax_invoices ที่เหลือ มีแค่บริษัท
//   6) รายได้อื่น (บันทึกรายได้เอง) — income_record (finance-api) มีแค่สังกัดบริษัท
//      → กันยอดซ้ำ: ตัดรายการที่ import มาจากใบกำกับรายได้อื่น (reference_no ตรงเลขใบกำกับ)
//   ★ ข้อ 5+6: ถ้าเอกสารถูก "แตกยอดรายละเอียดการรับชำระ" รายคันไว้ (income_allocations —
//     แท็บรายละเอียดการรับชำระในหน้าบันทึกรายได้อื่นๆ เช่น ค่าส่งเสริมจากไฟแนนซ์) จะกระจาย
//     ยอดเข้าสาขาตามรถที่ขาย: จับคู่ allocation.invoice_no → ใบขาย (list_car_payment_receipts
//     ย้อนหลัง 6 เดือน) → SCY จาก prefix ของ sale_invoice_no · ใบกำกับ TF ใช้ allocations ของ
//     income_record คู่แฝด (reference_no = เลขใบกำกับ) · เอกสารที่ยังไม่แตกยอด → "รายได้รวม"
// ทุกแหล่งไม่นับเอกสารสถานะ "ยกเลิก" · ยอดรายได้ = มูลค่าก่อน VAT
// ============================================================================
const TAX_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/list-tax-invoices";
const ACCOUNTING_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const FINANCE_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/finance-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";
const FLOWTAX_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/flow-input-tax-api";
const SERVICE_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/service-api";
const REG_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";
const REPORT_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-report-api";

// ตารางใบกำกับขายรถแยกตามบริษัทผู้ออกใบกำกับ (ขายข้ามหน้าร้านได้ — สาขาจริงดูจาก branch_codes)
const TAX_COMPANIES = ["PAPAO", "NAKORNLUANG", "SINGCHAI"];

// สาขาแสดงผล (label เริ่มต้น — โหลดชื่อจริงจาก branch_master ทับตอนเปิดหน้า)
const DEFAULT_BRANCHES = [
  { key: "SCY01", label: "ศูนย์ยามาฮ่า" },
  { key: "SCY04", label: "สีขวา" },
  { key: "SCY05", label: "ป.เปา นครหลวง" },
  { key: "SCY06", label: "ป.เปา วังน้อย" },
  { key: "SCY07", label: "สิงห์ชัยตลาด" },
];

// หา SCY0x ของใบกำกับขายรถ: branch_codes ก่อน → prefix เลขใบขาย → "" (ไม่ระบุ)
function scyOf(r) {
  const m = String(r.branch_codes || "").match(/SCY\d{2}/);
  if (m) return m[0];
  const p = String(r.sale_invoice_no || "").match(/^SCY\d{2}/);
  return p ? p[0] : "";
}

// ลูกค้าเป็นบริษัทไฟแนนซ์ → ใบกำกับ TF ใบนั้นถือเป็นรายได้ค่าส่งเสริมจากไฟแนนซ์
const FINANCE_KW = /ธนบรรณ|คาเธ่ย์|เน็คซ|แคปปิตอล|เอสจีเอฟ|SGF|กรุ๊ปลิ|กรุ๊ปลี|ลีสซิ่ง|ลิสซิ่ง|สมหวัง/i;

// กระจายแถวรายได้ตาม allocation รายคัน (สัดส่วนของยอดรวม VAT ที่แตกไว้ต่อเอกสาร)
// เศษปัดทศนิยม ≤ 1 บาท ปรับเข้าบรรทัดสุดท้าย · ส่วนที่แตกยอดไม่ครบ → แถว "รายได้รวม"
function distributeByAlloc(base, lines, scyByInvoice) {
  const totalIncl = Number(base.total) || lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  if (!(totalIncl > 0)) return [base];
  const out = [];
  let usedBV = 0, usedVat = 0, usedTot = 0;
  lines.forEach((l) => {
    const ratio = Number(l.amount || 0) / totalIncl;
    const bv = r2(base.beforeVat * ratio), vt = r2(base.vat * ratio), tt = r2(base.total * ratio);
    usedBV = r2(usedBV + bv); usedVat = r2(usedVat + vt); usedTot = r2(usedTot + tt);
    out.push({
      ...base,
      branch: scyByInvoice[String(l.invoice_no)] || "",
      customer: l.customer_name || base.customer,
      detail: ["🏍️ " + l.invoice_no, l.model].filter(Boolean).join(" · "),
      beforeVat: bv, vat: vt, total: tt,
    });
  });
  const remBV = r2(base.beforeVat - usedBV), remVat = r2(base.vat - usedVat), remTot = r2(base.total - usedTot);
  if (Math.abs(remBV) > 1 || Math.abs(remTot) > 1) {
    out.push({ ...base, branch: "", detail: "ส่วนที่ยังไม่แตกยอดรายคัน", beforeVat: remBV, vat: remVat, total: remTot });
  } else if (out.length && (remBV || remVat || remTot)) {
    const last = out[out.length - 1];
    last.beforeVat = r2(last.beforeVat + remBV); last.vat = r2(last.vat + remVat); last.total = r2(last.total + remTot);
  }
  return out;
}

// หา SCY0x ของเอกสารอะไหล่/งานบริการ (list_part_service_sales):
// doc ขึ้นต้น SCYxx → สาขานั้น (ถ้าไม่อยู่ใน 5 สาขา เช่น SCY10 → "" = รายได้รวม)
// ป.เปา: แท็ก "นครหลวง" → SCY05, เอกสาร 69xxx อื่น ๆ → SCY06 วังน้อย
function scyOfPartSvc(doc, affiliation) {
  const d = String(doc || "");
  const m = d.match(/^SCY\d{2}/);
  if (m) return DEFAULT_BRANCHES.some((b) => b.key === m[0]) ? m[0] : "";
  if (affiliation === "ป.เปา") return /นครหลวง/.test(d) ? "SCY05" : "SCY06";
  return "";
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function curYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthRange(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  const start = `${ym}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${ym}-${String(last).padStart(2, "0")}`;
  // list_tax_invoices ใช้ปี พ.ศ. + เดือน เช่น "256905"
  const thYm = `${y + 543}${String(m).padStart(2, "0")}`;
  return { start, end, thYm };
}
function ymLabelTH(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  if (!y || !m) return ym;
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}
function fmtN(n) {
  const v = Number(n || 0);
  return v === 0 ? "-" : v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDateTH(iso) {
  const m = String(iso || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${parseInt(m[1], 10) + 543}` : "-";
}
const r2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return raw.trim() ? JSON.parse(raw) : [];
}
const asArray = (d) => (Array.isArray(d) ? d : d?.data || d?.rows || []);
const isCancelled = (s) => String(s || "").toLowerCase() === "cancelled";

export default function ProfitLossReportPage() {
  const [ym, setYm] = useState(curYM());
  const [loadedYm, setLoadedYm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [branches, setBranches] = useState(DEFAULT_BRANCHES);
  // รายการรายตัวต่อหมวด (สำหรับ popup)
  const [vehicleRows, setVehicleRows] = useState([]);   // ใบกำกับขายรถ { branch, doc, date, customer, beforeVat, vat, total }
  const [partSvcRows, setPartSvcRows] = useState([]);   // อะไหล่+งานซ่อม (รายเอกสาร)
  const [feeRows, setFeeRows] = useState([]);           // ค่าบริการรับฝากชำระ
  const [postRows, setPostRows] = useState([]);         // ค่าไปรษณีย์
  const [theftRows, setTheftRows] = useState([]);       // ประกันรถหาย (คอสมอส/ล็อคตั้น)
  const [regRows, setRegRows] = useState([]);           // รับเรื่องงานทะเบียน (พรบ/ต่อภาษี)
  const [promoRows, setPromoRows] = useState([]);       // ค่าส่งเสริมจากไฟแนนซ์ (ใบกำกับ TF)
  const [otherInvRows, setOtherInvRows] = useState([]); // ใบกำกับรายได้อื่น
  const [manualRows, setManualRows] = useState([]);     // บันทึกรายได้เอง (ไม่ระบุสาขา)
  const [popup, setPopup] = useState(null); // null | "vehicle" | "partsvc" | "fee" | "regwork" | "otherinv" | "manual"

  async function loadReport(targetYm = ym) {
    setLoading(true);
    setMessage("");
    const { start, end, thYm } = monthRange(targetYm);
    const [adYear, adMonth] = String(targetYm).split("-").map(Number);
    try {
      const [taxByBranch, partSvcByAff, hondaJobs, regLines, feeLines, otherInv, incomeDocs] = await Promise.all([
        // 1) ใบกำกับขายรถ — เรียกทีละบริษัท (workflow แยกตารางตาม branch)
        //    สาขาจริงดูจาก branch_codes ของใบขาย (นครหลวงไม่มี code → SCY05 ทั้งตาราง)
        Promise.all(TAX_COMPANIES.map(async (co) => {
          const rows = asArray(await post(TAX_URL, { action: "list_tax_invoices", branch: co, year_month: thYm }));
          return rows.filter((r) => !isCancelled(r.status)).map((r) => ({
            branch: scyOf(r) || (co === "NAKORNLUANG" ? "SCY05" : ""),
            doc: r.tax_invoice_no || "-",
            date: r.invoice_date,
            customer: r.customer_name || "-",
            detail: co === "PAPAO" ? "ใบกำกับ ป.เปา" : co === "NAKORNLUANG" ? "ใบกำกับ นครหลวง" : "ใบกำกับ สิงห์ชัย",
            beforeVat: r2(r.amount_before_vat),
            vat: r2(r.vat_amount),
            total: r2(r.total_amount),
          }));
        })),
        // 2) อะไหล่+งานซ่อม + ค่าบริการรับฝากชำระ/ประกัน — ชุดเดียวกับรายงานภาษีขาย เรียกทีละสังกัด
        Promise.all(["ป.เปา", "สิงห์ชัย"].map(async (aff) => {
          const rows = asArray(await post(FLOWTAX_URL, { action: "list_part_service_sales", affiliation: aff, tax_period: targetYm }).catch(() => []));
          return rows.filter((r) => r && r.doc_no).map((r) => {
            // จำแนกประเภทจากท้าย doc_no: ค่าบริการรับฝากชำระ / ประกันรถหาย / งานซ่อม+อะไหล่
            const kind = /· ค่าบริการ/.test(String(r.doc_no)) ? "fee"
              : /· ประกันรถหาย/.test(String(r.doc_no)) ? "theft" : "partsvc";
            return {
              branch: scyOfPartSvc(r.doc_no, aff),
              kind,
              doc: r.doc_no,
              date: r.invoice_date,
              customer: r.customer_name || "-",
              detail: kind === "theft" ? (aff === "ป.เปา" ? "คอสมอส (ป.เปา)" : "ล็อคตั้น (สิงห์ชัย)")
                : r.side === "yamaha" ? "สิงห์ชัย" : "ป.เปา",
              beforeVat: r2(r.amount_before_vat),
              vat: r2(r.vat_amount),
              total: r2(r.total_amount),
            };
          });
        })),
        // 2.1) งานซ่อม Honda รายสาขาจริง ('000'=วังน้อย, 'Z01'=นครหลวง) — ใช้ปรับยอด SERV นครหลวง
        post(SERVICE_URL, { action: "list_honda_repair_jobs", year: adYear, month: adMonth })
          .then(asArray).catch(() => []),
        // 3) ใบรับเรื่องงานทะเบียน (พรบ/ต่อภาษี — ไม่มี VAT) รายบรรทัด มีสาขาจริง
        post(REG_URL, { action: "get_receipt_lines", date_from: start, date_to: end, include_submitted: true, bypass_insurance_filter: true })
          .then(asArray).catch(() => []),
        // 3b) ใบเสร็จรับชำระอื่นๆ รายบรรทัด (other_income_items มี description) — ค่าบริการ/ไปรษณีย์
        post(REG_URL, { action: "list_other_income_receipts", date_from: start, date_to: end })
          .then(asArray).catch(() => []),
        // 3) ใบกำกับรายได้อื่น (ป.เปา/สิงห์ชัย)
        post(ACCOUNTING_URL, { action: "list_other_income_tax_invoices", date_from: start, date_to: end, branch: "" })
          .then(asArray).catch(() => []),
        // 3) บันทึกรายได้เอง
        post(FINANCE_URL, { action: "income_record", op: "list", date_from: start, date_to: end })
          .then(asArray).catch(() => []),
      ]);

      setVehicleRows(taxByBranch.flat());

      // แยกอะไหล่+งานซ่อมจริง / ประกันรถหาย (คอสมอส/ล็อคตั้น)
      // แถว kind="fee" (· ค่าบริการ) ทิ้ง — ใช้รายบรรทัดจาก list_other_income_receipts แทน
      const psAll = partSvcByAff.flat();
      const ps = psAll.filter((r) => r.kind === "partsvc");
      setTheftRows(psAll.filter((r) => r.kind === "theft"));

      // ค่าบริการรับฝากชำระ / ค่าไปรษณีย์ — รายบรรทัด (เกณฑ์ description เดียวกับรายงานภาษีขาย)
      // ยอด i.total รวม VAT → ถอด /1.07
      const feeAll = feeLines
        .filter((r) => r && r.receipt_no && /^(ค่าบริการ|รายได้ค่าบริการ|ค่าส่งไปรษณีย์)/.test(String(r.description || "")))
        .map((r) => {
          const incl = Number(r.total ?? r.line_amount ?? 0);
          const bc = String(r.branch_code || "").trim();
          return {
            branch: bc === "00000" ? "SCY01" : DEFAULT_BRANCHES.some((b) => b.key === bc) ? bc : "",
            isPost: /ไปรษณีย์/.test(String(r.description || "")),
            doc: r.receipt_no,
            date: r.receipt_date,
            customer: r.customer_name || "-",
            detail: r.description || "",
            beforeVat: r2(incl / 1.07),
            vat: r2(incl - incl / 1.07),
            total: r2(incl),
          };
        })
        .filter((r) => r.total > 0);
      setFeeRows(feeAll.filter((r) => !r.isPost));
      setPostRows(feeAll.filter((r) => r.isPost));

      // รายการปรับปรุงย้ายงานซ่อม Honda นครหลวง (Z01) ออกจากวังน้อย
      // (เอกสาร 69SERV ไม่บอกสาขา — ใช้ยอดจริงจาก honda_repair_jobs ที่มี branch_code)
      const z01 = hondaJobs.filter((j) => j && String(j.branch_code || "").toUpperCase() === "Z01");
      const z01Sale = r2(z01.reduce((s, j) => s + Number(j.net_sale || 0), 0));
      if (z01Sale > 0) {
        const z01Vat = r2(z01.reduce((s, j) => s + Number(j.vat || 0), 0));
        const z01Total = r2(z01.reduce((s, j) => s + Number(j.total_net || 0), 0));
        ps.push(
          { branch: "SCY06", doc: "ปรับปรุง: งานซ่อมนครหลวง", date: end, customer: "-", detail: `ย้ายงานซ่อม Honda นครหลวง (Z01) ${z01.length} งาน ออกจากวังน้อย`, beforeVat: r2(-z01Sale), vat: r2(-z01Vat), total: r2(-z01Total) },
          { branch: "SCY05", doc: "ปรับปรุง: งานซ่อมนครหลวง", date: end, customer: "-", detail: `งานซ่อม Honda นครหลวง (Z01) ${z01.length} งาน`, beforeVat: z01Sale, vat: z01Vat, total: z01Total },
        );
      }
      setPartSvcRows(ps);

      // รับเรื่องงานทะเบียน: ตัดบรรทัดประกันรถหาย (อยู่หมวดค่าบริการ/ประกันแล้ว กันซ้ำ)
      // branch "00000" = ศูนย์ยามาฮ่า → SCY01 · ยอดไม่มี VAT (ก่อน VAT = ยอดเต็ม)
      setRegRows(regLines
        .filter((r) => r && r.receipt_no)
        .filter((r) => !/ล็อคตั้น|LOCKTON|ประกันรถหาย|คอสมอส|COSMOS/i.test(`${r.income_type || ""} ${r.income_name || ""}`))
        .map((r) => {
          const bc = String(r.branch_code || "").trim();
          const branch = bc === "00000" ? "SCY01" : DEFAULT_BRANCHES.some((b) => b.key === bc) ? bc : "";
          return {
            branch,
            doc: r.receipt_no,
            date: r.receive_date,
            customer: r.customer_name || "-",
            detail: [r.income_type, r.income_name].filter(Boolean).join(" · "),
            beforeVat: r2(r.net_price),
            vat: 0,
            total: r2(r.net_price),
          };
        }));

      // ★ แตกยอดรายละเอียดการรับชำระ (income_allocations) — กระจายรายได้เข้าสาขาตามรถที่ขาย
      const validDocs = incomeDocs.filter((d) => d && d.income_doc_no && !isCancelled(d.status));
      const allocPairs = (await Promise.all(validDocs.slice(0, 100).map(async (d) => {
        try {
          const rows = asArray(await post(ACCOUNTING_URL, { action: "list_income_allocations", income_doc_id: d.income_doc_id }));
          const lines = rows.filter((a) => a && a.invoice_no && Number(a.amount) > 0);
          return lines.length ? { doc: d, lines } : null;
        } catch { return null; }
      }))).filter(Boolean);
      const allocByRef = {}, allocById = {};
      allocPairs.forEach(({ doc, lines }) => {
        allocById[doc.income_doc_id] = lines;
        if (doc.reference_no) allocByRef[String(doc.reference_no)] = lines;
      });
      // map เลขใบกำกับรถ → SCY จากใบขาย (ย้อนหลัง 6 เดือนถึงสิ้นเดือนรายงาน)
      const scyByInvoice = {};
      if (allocPairs.length) {
        try {
          const d0 = new Date(adYear, adMonth - 1 - 5, 1);
          const histFrom = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, "0")}-01`;
          const sales = asArray(await post(REPORT_URL, { action: "list_car_payment_receipts", date_from: histFrom, date_to: end }));
          sales.forEach((s) => {
            if (!s || !s.tax_invoice_no) return;
            const m = String(s.sale_invoice_no || "").match(/^SCY\d{2}/);
            scyByInvoice[String(s.tax_invoice_no)] = m ? m[0] : (String(s.branch || "").toUpperCase() === "NAKORNLUANG" ? "SCY05" : "");
          });
        } catch { /* หา map ไม่ได้ → กระจายไม่ออก ตกช่องรายได้รวมตามเดิม */ }
      }

      const oiAll = otherInv.filter((r) => r && r.tax_invoice_no);
      // ระดับบริษัทระบุสาขาไม่ได้ → รายได้รวม เว้นแต่มี allocation รายคัน (ของ income_record คู่แฝด)
      // แยกใบ "ค่าส่งเสริมจากไฟแนนซ์" (ลูกค้าเป็นไฟแนนซ์ หรือแตกยอดประเภท 003) ออกจากรายได้อื่น
      const promoAcc = [], otherAcc = [];
      oiAll.filter((r) => !isCancelled(r.status)).forEach((r) => {
        const base = {
          branch: "",
          doc: r.tax_invoice_no,
          date: r.invoice_date,
          customer: r.customer_name || "-",
          detail: String(r.branch || "").toUpperCase() === "SINGCHAI" ? "บริษัท สิงห์ชัย" : "บริษัท ป.เปา",
          beforeVat: r2(r.amount_before_vat),
          vat: r2(r.vat_amount),
          total: r2(r.total_amount),
        };
        const lines = allocByRef[String(r.tax_invoice_no)];
        const isPromo = FINANCE_KW.test(String(r.customer_name || "")) || (lines || []).some((l) => String(l.category) === "003");
        (isPromo ? promoAcc : otherAcc).push(...(lines ? distributeByAlloc(base, lines, scyByInvoice) : [base]));
      });
      setPromoRows(promoAcc);
      setOtherInvRows(otherAcc);

      // กันยอดซ้ำ: income_records ที่ import จากใบกำกับรายได้อื่น (reference_no = เลขใบกำกับ)
      const oiDocNos = new Set(oiAll.map((r) => String(r.tax_invoice_no)));
      setManualRows(validDocs
        .filter((d) => !oiDocNos.has(String(d.reference_no || "")))
        .filter((d) => !String(d.description || "").startsWith("นำเข้าจากใบกำกับ"))
        .flatMap((d) => {
          const base = {
            // สังกัดบริษัทระบุสาขาไม่ได้ → รายได้รวม เว้นแต่มี allocation รายคัน
            branch: "",
            doc: d.income_doc_no,
            date: d.doc_date,
            customer: d.customer_name || "-",
            detail: [d.affiliation ? `สังกัด ${d.affiliation}` : "", (Array.isArray(d.items) ? d.items : []).map((it) => it.income_name).filter(Boolean).join(", ")].filter(Boolean).join(" · "),
            beforeVat: r2(d.total_after_discount ?? d.total_before_discount),
            vat: r2(d.vat_amount),
            total: r2(d.total),
          };
          const lines = allocById[d.income_doc_id];
          return lines ? distributeByAlloc(base, lines, scyByInvoice) : [base];
        }));

      setLoadedYm(targetYm);
    } catch (e) {
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + (e.message || e));
      setVehicleRows([]); setPartSvcRows([]); setFeeRows([]); setPostRows([]); setTheftRows([]); setRegRows([]); setPromoRows([]); setOtherInvRows([]); setManualRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadReport();
    // โหลดชื่อสาขาจริงจาก branch_master (พลาดได้ — ใช้ label เริ่มต้นแทน)
    post(MASTER_URL, { action: "get_branches", include_inactive: "true" })
      .then(asArray)
      .then((rows) => {
        const byCode = {};
        rows.forEach((b) => { if (b && b.branch_code) byCode[b.branch_code] = b.branch_name || ""; });
        setBranches(DEFAULT_BRANCHES.map((b) => ({ ...b, label: byCode[b.key] || b.label })));
      })
      .catch(() => {});
    /* eslint-disable-next-line */
  }, []);

  // ---------- สรุปรายได้ต่อหมวด × สาขา ----------
  const sumByBranch = (rows) => {
    const o = { unassigned: 0 };
    DEFAULT_BRANCHES.forEach((b) => { o[b.key] = 0; });
    rows.forEach((r) => {
      if (o[r.branch] !== undefined) o[r.branch] = r2(o[r.branch] + r.beforeVat);
      else o.unassigned = r2(o.unassigned + r.beforeVat);
    });
    o.total = r2(DEFAULT_BRANCHES.reduce((s, b) => s + o[b.key], o.unassigned));
    return o;
  };
  const vehicleAgg = useMemo(() => sumByBranch(vehicleRows), [vehicleRows]);
  const partSvcAgg = useMemo(() => sumByBranch(partSvcRows), [partSvcRows]);
  const feeAgg = useMemo(() => sumByBranch(feeRows), [feeRows]);
  const postAgg = useMemo(() => sumByBranch(postRows), [postRows]);
  const theftAgg = useMemo(() => sumByBranch(theftRows), [theftRows]);
  const regAgg = useMemo(() => sumByBranch(regRows), [regRows]);
  const promoAgg = useMemo(() => sumByBranch(promoRows), [promoRows]);
  const otherInvAgg = useMemo(() => sumByBranch(otherInvRows), [otherInvRows]);
  const manualAgg = useMemo(() => sumByBranch(manualRows), [manualRows]);

  const lines = [
    { key: "vehicle", label: "รายได้จากการขายรถ", sub: "ใบกำกับภาษีขายรถ", color: "#1e40af", count: vehicleRows.length, agg: vehicleAgg },
    { key: "partsvc", label: "รายได้อะไหล่+งานซ่อม", sub: "งานซ่อม+ขายอะไหล่จริง (ปรับงานซ่อมนครหลวงตามระบบซ่อม Honda)", color: "#0e7490", count: partSvcRows.length, agg: partSvcAgg },
    { key: "fee", label: "รายได้ค่าบริการรับฝากชำระ", sub: "ค่าบริการรับฝากค่างวดไฟแนนซ์", color: "#7c3aed", count: feeRows.length, agg: feeAgg },
    { key: "post", label: "รายได้ค่าไปรษณีย์", sub: "ค่าบริการส่งไปรษณีย์", color: "#4d7c0f", count: postRows.length, agg: postAgg },
    { key: "theft", label: "รายได้ประกันรถหาย", sub: "ป.เปา = คอสมอส · สิงห์ชัย = ล็อคตั้น — สาขาตามใบรับเรื่องงานทะเบียน", color: "#be185d", count: theftRows.length, agg: theftAgg },
    { key: "regwork", label: "รายได้รับเรื่องงานทะเบียน", sub: "พรบ/ต่อภาษี จากใบรับเรื่อง (ไม่มี VAT)", color: "#b45309", count: regRows.length, agg: regAgg },
    { key: "promo", label: "รายได้ค่าส่งเสริมจากไฟแนนซ์", sub: "ใบกำกับ TF ลูกค้าไฟแนนซ์/แตกยอดประเภท 003 — แตกยอดรายคันแล้วกระจายตามสาขาที่ขายรถ", color: "#0f766e", count: promoRows.length, agg: promoAgg },
    { key: "otherinv", label: "รายได้อื่น (มีใบกำกับ)", sub: "ใบกำกับภาษีรายได้อื่นๆ ที่เหลือ — ระบุสาขาไม่ได้แสดงในรายได้รวม", color: "#065f46", count: otherInvRows.length, agg: otherInvAgg },
    { key: "manual", label: "รายได้อื่น (บันทึกรายได้)", sub: "แตกยอดรายคันแล้วกระจายตามสาขา · ที่เหลือแสดงในรายได้รวม", color: "#92400e", count: manualRows.length, agg: manualAgg },
  ];
  const tot = lines.reduce((o, l) => {
    const n = { unassigned: r2(o.unassigned + l.agg.unassigned), total: r2(o.total + l.agg.total) };
    DEFAULT_BRANCHES.forEach((b) => { n[b.key] = r2(o[b.key] + l.agg[b.key]); });
    return n;
  }, sumByBranch([]));

  const hasData = vehicleRows.length + partSvcRows.length + feeRows.length + postRows.length + theftRows.length + regRows.length + promoRows.length + otherInvRows.length + manualRows.length > 0;

  return (
    <div className="page-container">
      <style>{`
        @media print {
          .no-print, .no-print * { display: none !important; }
          .sidebar, aside.sidebar, .page-topbar { display: none !important; }
          body, html, #root, .page-container { background:#fff !important; margin:0 !important; padding:0 !important; }
          .pnl { font-size:11px !important; } .pnl th, .pnl td { padding:3px 5px !important; }
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>

      <div className="page-topbar">
        <div className="page-title">📈 งบกำไรขาดทุน (รายเดือน)</div>
      </div>

      {/* Filters */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={lbl}>📅 เดือน</label>
            <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} style={{ ...inp, minWidth: 160 }} />
          </div>
          <button onClick={() => loadReport()} disabled={loading}
            style={{ padding: "8px 18px", background: loading ? "#9ca3af" : "#072d6b", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}>
            🔄 {loading ? "กำลังคิดยอด..." : "ดูรายงาน"}
          </button>
          <div style={{ fontSize: 12, color: "#6b7280", maxWidth: 460 }}>
            ยอดรายได้ = มูลค่าก่อน VAT · รายได้ที่ระบุสาขาไม่ได้แสดงเฉพาะช่อง "รายได้รวม" — คลิกที่หมวดเพื่อดูรายละเอียด
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button onClick={() => window.print()} disabled={loading || !hasData}
              style={{ padding: "8px 14px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>🖨️ พิมพ์</button>
          </div>
        </div>
        {message && <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12 }}>{message}</div>}
      </div>

      {/* Report */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 2px 12px rgba(7,45,107,0.10)" }}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#072d6b" }}>งบกำไรขาดทุน</div>
          <div style={{ fontSize: 13, color: "#374151" }}>ส่วนรายได้ — แยกตามสาขา</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>ประจำเดือน {ymLabelTH(loadedYm || ym)}</div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#6b7280" }}>กำลังคิดยอด...</div>
        ) : !hasData ? (
          <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>ไม่มีข้อมูล</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="pnl" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#072d6b", color: "#fff" }}>
                  <th style={{ ...th, width: 34 }}>#</th>
                  <th style={{ ...th, textAlign: "left" }}>รายได้</th>
                  {branches.map((b) => (
                    <th key={b.key} style={{ ...th, borderLeft: "1px solid #2b4a86" }}>
                      {b.key}
                      <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85 }}>{b.label}</div>
                    </th>
                  ))}
                  <th style={{ ...th, borderLeft: "1px solid #2b4a86", background: "#0a3a82" }}>รายได้รวม</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.key}
                    onClick={() => l.count > 0 && setPopup(l.key)}
                    title={l.count > 0 ? "คลิกดูรายละเอียด" : ""}
                    style={{ borderBottom: "1px solid #e5e7eb", cursor: l.count > 0 ? "pointer" : "default" }}
                    onMouseEnter={(e) => l.count > 0 && (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                    <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 700 }}>
                      <span style={{ color: l.color }}>{l.label}</span>
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: "#6b7280" }}>({l.count})</span>
                      {l.count > 0 && <span className="no-print" style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: "#2563eb" }}>🔍</span>}
                      {l.sub && <div style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>{l.sub}</div>}
                    </td>
                    {branches.map((b) => (
                      <td key={b.key} style={tdNum}>{fmtN(l.agg[b.key])}</td>
                    ))}
                    <td style={{ ...tdNum, fontWeight: 700, background: "#f8fafc" }}>{fmtN(l.agg.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f1f5f9", fontWeight: 700, color: "#072d6b", borderTop: "2px solid #072d6b" }}>
                  <td colSpan={2} style={{ ...td, textAlign: "right" }}>รวมรายได้</td>
                  {branches.map((b) => (
                    <td key={b.key} style={tdNum}>{fmtN(tot[b.key])}</td>
                  ))}
                  <td style={{ ...tdNum, fontSize: 13 }}>{fmtN(tot.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="no-print" style={{ marginTop: 12, fontSize: 11, color: "#9ca3af" }}>
          * ยอดรายได้ = มูลค่าก่อน VAT ไม่นับเอกสารยกเลิก · ขายรถระบุสาขาจากรหัส SCY ของใบขาย (ขายข้ามหน้าร้านนับตามสาขาที่ขายจริง) · อะไหล่+งานซ่อมใช้ชุดข้อมูลรายงานภาษีขาย เฉพาะงานซ่อม/ขายอะไหล่จริง (งานซ่อมนครหลวงปรับด้วยยอดจริงจากระบบซ่อม Honda) · ค่าบริการรับฝากชำระ / ค่าไปรษณีย์ / ประกันรถหาย (ป.เปา=คอสมอส, สิงห์ชัย=ล็อคตั้น สาขาตามใบรับเรื่อง) แยกหมวดกัน · รับเรื่องงานทะเบียน (พรบ/ต่อภาษี) ไม่มี VAT ใช้ยอดเต็มจากใบรับเรื่อง · รายได้อื่น/บันทึกรายได้: เอกสารที่ "แตกยอดรายละเอียดการรับชำระ" รายคันไว้จะกระจายเข้าสาขาตามรถที่ขาย ที่ยังไม่แตกยอดแสดงเฉพาะช่องรายได้รวม (ตัดรายการซ้ำจากการนำเข้าใบกำกับแล้ว) — ส่วนต้นทุน/ค่าใช้จ่ายจะทยอยเพิ่มภายหลัง
        </div>
      </div>

      {popup && (
        <DetailModal
          popup={popup}
          ym={ymLabelTH(loadedYm || ym)}
          rows={popup === "vehicle" ? vehicleRows : popup === "partsvc" ? partSvcRows : popup === "fee" ? feeRows : popup === "post" ? postRows : popup === "theft" ? theftRows : popup === "regwork" ? regRows : popup === "promo" ? promoRows : popup === "otherinv" ? otherInvRows : manualRows}
          branches={branches}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}

// ===================== Popup รายละเอียดรายใบ =====================
function DetailModal({ popup, ym, rows, branches, onClose }) {
  const title = popup === "vehicle" ? "🏍️ รายได้จากการขายรถ (ใบกำกับภาษี)"
    : popup === "partsvc" ? "🔧 รายได้อะไหล่+งานซ่อม"
    : popup === "fee" ? "🧰 รายได้ค่าบริการรับฝากชำระ"
    : popup === "post" ? "📮 รายได้ค่าไปรษณีย์"
    : popup === "theft" ? "🛡️ รายได้ประกันรถหาย (คอสมอส/ล็อคตั้น)"
    : popup === "regwork" ? "📋 รายได้รับเรื่องงานทะเบียน (พรบ/ต่อภาษี)"
    : popup === "promo" ? "🤝 รายได้ค่าส่งเสริมจากไฟแนนซ์"
    : popup === "otherinv" ? "🧾 รายได้อื่น (มีใบกำกับ)"
    : "📝 รายได้อื่น (บันทึกรายได้ — ไม่ระบุสาขา)";
  const brLabel = (k) => branches.find((b) => b.key === k)?.label || k;
  const sum = rows.reduce((o, r) => ({ beforeVat: r2(o.beforeVat + r.beforeVat), vat: r2(o.vat + r.vat), total: r2(o.total + r.total) }), { beforeVat: 0, vat: 0, total: 0 });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(960px, 97vw)", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#072d6b" }}>{title}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>ประจำเดือน {ym} · {rows.length} รายการ</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#072d6b", color: "#fff" }}>
                <th style={{ ...th, width: 30 }}>#</th>
                <th style={{ ...th, textAlign: "left" }}>เลขที่เอกสาร</th>
                <th style={{ ...th, textAlign: "center" }}>วันที่</th>
                <th style={{ ...th, textAlign: "left" }}>ลูกค้า</th>
                <th style={{ ...th, textAlign: "center" }}>สาขา</th>
                <th style={{ ...th, textAlign: "right" }}>ก่อน VAT</th>
                <th style={{ ...th, textAlign: "right" }}>VAT</th>
                <th style={{ ...th, textAlign: "right" }}>รวม</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.doc}-${i}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{i + 1}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.doc}</td>
                  <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{fmtDateTH(r.date)}</td>
                  <td style={td}>{r.customer}{r.detail ? <div style={{ fontSize: 11, color: "#6b7280" }}>{r.detail}</div> : null}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {r.branch ? (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#e0e7ff", color: "#3730a3", whiteSpace: "nowrap" }} title={brLabel(r.branch)}>{r.branch} {brLabel(r.branch)}</span>
                    ) : (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#fef3c7", color: "#92400e" }}>รายได้รวม</span>
                    )}
                  </td>
                  <td style={tdNum}>{fmtN(r.beforeVat)}</td>
                  <td style={{ ...tdNum, color: "#6b7280" }}>{fmtN(r.vat)}</td>
                  <td style={{ ...tdNum, fontWeight: 600 }}>{fmtN(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f1f5f9", fontWeight: 700, color: "#072d6b" }}>
                <td colSpan={5} style={{ ...td, textAlign: "right" }}>รวม {rows.length} รายการ</td>
                <td style={tdNum}>{fmtN(sum.beforeVat)}</td>
                <td style={tdNum}>{fmtN(sum.vat)}</td>
                <td style={tdNum}>{fmtN(sum.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 3 };
const inp = { padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
const th = { padding: "7px 9px", textAlign: "center", fontWeight: 600 };
const td = { padding: "6px 9px", verticalAlign: "top" };
const tdNum = { padding: "6px 9px", textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" };
