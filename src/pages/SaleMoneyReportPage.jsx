import React, { useEffect, useMemo, useState } from "react";
import { buildDailyCashItems } from "../lib/dailyCash"; // ตรรกะสร้างแถวรายการ ย้ายไปไว้ที่เดียว ใช้ร่วมกับหน้าบันทึกฝากเงิน (user 2026-09-04)

// สรุปรายวันรับเงิน: ยอดขาย + เงินที่รับ + แหล่งรับชำระ (เงินสด/โอน/บัตร/ไฟแนนซ์/มัดจำ) + รับชำระเงินมัดจำจองรถ
// ข้อมูล: retail-sale-api list_sale_payments (ใบขายที่รับชำระแล้ว) + booking-deposit-api get_deposits (มัดจำจองรถ)
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
const USER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/office-login"; // get_users — แปลง username ผู้ขาย/ผู้รับเงิน → ชื่อ-สกุล (user 2026-09-03)
const DEPOSIT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/booking-deposit-api";
const PART_DEPOSIT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-deposit-api"; // มัดจำอะไหล่/บริการ (PDS/PDO)
const RECEIPT_ENTRY_API = "https://n8n-new-project-gwf2.onrender.com/webhook/receipt-entry-api"; // รับชำระใบรับเรื่องงานทะเบียน
const PART_SVC_PAY_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-service-payment-api"; // รับชำระค่าอะไหล่และบริการ (ใบขาย/ใบ JOB)
const USED_MOTO_API = "https://n8n-new-project-gwf2.onrender.com/webhook/used-moto-api"; // ขายรถมือสอง
const DEPOSIT_INCOME_API = "https://n8n-new-project-gwf2.onrender.com/webhook/deposit-income-api"; // รับฝากค่างวดที่บันทึกจากระบบ (ไม่รวมของ upload)
const FUEL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/fuel-withdraw-api";
const INS_REFUND_API = "https://n8n-new-project-gwf2.onrender.com/webhook/insurance-refund-api"; // คืนเงินค่าเบี้ยประกัน (เงินสด = หักเงินสด) // เบิกค่าน้ำมันรถใช้จ่าย — หักเงินสดหน้าร้าน (user 2026-08-29)

// คอลัมน์วิธีรับชำระ — เอา บัตร/QR กับ อื่นๆ ออก เพิ่ม E-คูปอง (user สั่ง 2026-08-19; เช็คแล้วไม่มีข้อมูลเก่าใช้ 2 วิธีนั้น)
const METHOD_COLS = [
  { key: "cash", label: "เงินสด" },
  { key: "transfer", label: "เงินโอน" },
  { key: "finance", label: "ไฟแนนซ์" },
  { key: "deposit", label: "เงินมัดจำ" },
  { key: "coupon", label: "E-คูปอง" },
  { key: "tradein", label: "รถเทิร์น" },
];
function methodKey(name) {
  const n = String(name || "");
  if (n.includes("มัดจำ")) return "deposit";
  if (n.includes("คูปอง")) return "coupon";
  if (n.includes("เทิร์น") || n.includes("เทิน")) return "tradein";
  if (n.includes("สด")) return "cash";
  // บัตร/QR (เลิกใช้แล้ว) = เงินเข้าบัญชี → รวมกับเงินโอน กันยอดเก่าหล่นหาย
  if (n.includes("โอน") || n.includes("บัตร") || n.toUpperCase().includes("QR")) return "transfer";
  if (n.includes("ไฟแนน")) return "finance";
  // วิธีอื่น (เช่น รถเทิร์น/อื่นๆ เดิม) — ไม่มีคอลัมน์แยก รวมเข้าเงินสดไม่ได้ จึงลงคอลัมน์เงินมัดจำไม่ได้เช่นกัน → คืนค่า key ที่ไม่มีคอลัมน์ (ยอดรวมยังถูกเพราะใช้ paid_amount)
  return "other";
}
const shiftDate = (iso, days) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const fmt = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => (Number(n) ? fmt(n) : "-");
const todayStr = () => new Date().toISOString().slice(0, 10);
const thaiDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? String(iso).slice(0, 10) : d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function SaleMoneyReportPage({ currentUser }) {
  // user ทั่วไปเห็นเฉพาะสาขาตัวเอง — admin เลือกดูได้ทุกสาขา
  const isAdmin = currentUser?.role === "admin";
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [branch, setBranch] = useState("");
  const [rows, setRows] = useState([]);
  const [userMap, setUserMap] = useState({}); // USERNAME → ชื่อ-สกุล จากเมนูกำหนดผู้ใช้ (ช่องผู้ขายเก็บ username เช่น P002)
  useEffect(() => {
    fetch(USER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_users" }) })
      .then((r) => r.json()).then((d) => {
        const list = Array.isArray(d) ? d : (d?.rows || d?.data || []);
        const m = {};
        for (const u of list) if (u && u.username && u.name) m[String(u.username).trim().toUpperCase()] = String(u.name).trim();
        setUserMap(m);
      }).catch(() => {});
  }, []);
  const dispSeller = (v) => { const k = String(v || "").trim(); return k ? (userMap[k.toUpperCase()] || k) : "-"; };
  const [depRows, setDepRows] = useState([]); // มัดจำจองรถ (booking_deposits) — กรองช่วงวันที่ฝั่งหน้าเว็บ
  const [partDepRows, setPartDepRows] = useState([]); // มัดจำอะไหล่/บริการ (part_deposits PDS/PDO)
  const [rcptRows, setRcptRows] = useState([]);       // รับชำระใบรับเรื่องงานทะเบียน (registration_receipts.paid_*)
  const [psRows, setPsRows] = useState([]);           // รับชำระค่าอะไหล่และบริการ (part_service_payments)
  const [umRows, setUmRows] = useState([]);           // ขายรถมือสอง (used_moto_stock)
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [rpRefundRows, setRpRefundRows] = useState([]); // คืนเงินมัดจำป้ายแดง (จ่ายออก) — หักจากเงินสด/โอนของวัน
  const [rpStandaloneRows, setRpStandaloneRows] = useState([]); // มัดจำป้ายแดงติดป้ายทีหลัง (standalone) — เงินรับแยกจากใบเสร็จขายรถ
  const [depIncRows, setDepIncRows] = useState([]); // รับฝากชำระค่างวด กรุ๊ปลีส/ธนบรรณ ที่บันทึกจากระบบ (RECS-)
  const [fuelRows, setFuelRows] = useState([]); // เบิกค่าน้ำมันรถใช้จ่าย (fuel_withdrawals) — แถวหักเงินสด
  const [insRefundRows, setInsRefundRows] = useState([]); // คืนเงินค่าเบี้ยประกัน (insurance_fee_refunds) — เงินสด = แถวหักเงินสด


  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [res, resDep, resPartDep, resRcpt, resPs, resUm, resRp, resRpAll, resDi, resFuel, resZero, resInsRf] = await Promise.all([
        fetch(RETAIL_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_sale_payments", date_from: dateFrom, date_to: dateTo }),
        }),
        fetch(DEPOSIT_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_deposits" }),
        }).catch(() => null),
        fetch(PART_DEPOSIT_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_deposits", limit: 2000 }),
        }).catch(() => null),
        fetch(RECEIPT_ENTRY_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_receipt_payments", date_from: dateFrom, date_to: dateTo }),
        }).catch(() => null),
        fetch(PART_SVC_PAY_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_payments", date_from: dateFrom, date_to: dateTo }),
        }).catch(() => null),
        fetch(USED_MOTO_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_sales", date_from: dateFrom, date_to: dateTo }),
        }).catch(() => null),
        fetch(RETAIL_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_red_plate_deposits", status: "refunded", date_from: dateFrom, date_to: dateTo }),
        }).catch(() => null),
        fetch(RETAIL_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          // ดึงย้อน 90 วันเผื่อใบขายรับเงินก่อนแล้วค่อยติดป้ายทีหลัง — ใช้กันหักมัดจำป้ายแดงซ้ำจากแถวขาย (แถวแสดงผลกรองช่วงวันที่อีกที)
          body: JSON.stringify({ action: "list_red_plate_deposits", status: "all", date_from: shiftDate(dateFrom, -90), date_to: dateTo }),
        }).catch(() => null),
        fetch(DEPOSIT_INCOME_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_deposit_income", date_from: dateFrom, date_to: dateTo }),
        }).catch(() => null),
        fetch(FUEL_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_fuel_withdraws", date_from: dateFrom, date_to: dateTo }),
        }).catch(() => null),
        fetch(RETAIL_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          // ใบขายที่ลูกค้าไม่ต้องชำระเงิน (ไฟแนนท์จ่ายทั้งหมด ยอดชำระ 0) ไม่มีการกดรับเงิน → ดึงมาโชว์เป็นแถวขาย ณ วันขาย (user 2026-08-29)
          body: JSON.stringify({ action: "list_retail_sales", date_from: dateFrom, date_to: dateTo, limit: 2000 }),
        }).catch(() => null),
        fetch(INS_REFUND_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          // คืนเงินค่าเบี้ยประกันลูกค้า (เงินสด) = เงินจ่ายออกจากลิ้นชัก → แถวหักเงินสด (user 2026-09-01)
          body: JSON.stringify({ action: "list_refunds", date_from: dateFrom, date_to: dateTo }),
        }).catch(() => null),
      ]);
      const data = await res.json().catch(() => []);
      // กรองแถวว่างจาก n8n (ตอบ {} เมื่อไม่มีข้อมูล) — กันกลุ่ม "ไม่ระบุสาขา" โผล่
      const paidRows = (Array.isArray(data) ? data : []).filter(r => r && (r.sale_no || r.receipt_no));
      const zeroRaw = resZero ? await resZero.json().catch(() => []) : [];
      const zeroDue = (Array.isArray(zeroRaw) ? zeroRaw : [])
        .filter(r => r && r.invoice_no && String(r.payment_status || "") !== "paid" && num(r.total_payment) === 0)
        .map(r => ({
          ...r, sale_no: r.invoice_no, receipt_no: null, receipt_date: r.sale_date,
          paid_amount: 0, payment_methods: [],
          payment_received_note: "ลูกค้าไม่ต้องชำระเงิน (ยอดชำระ 0)",
        }));
      setRows([...paidRows, ...zeroDue]);
      const dep = resDep ? await resDep.json().catch(() => []) : [];
      setDepRows(Array.isArray(dep) ? dep.filter(d => d && d.deposit_no) : []);
      const pdep = resPartDep ? await resPartDep.json().catch(() => []) : [];
      // ใบยกเลิกไม่นับ (ไม่ได้รับเงินจริง) — ใบคืนเงินแล้วยังนับวันรับเงินเดิม มีป้ายกำกับ
      setPartDepRows(Array.isArray(pdep) ? pdep.filter(d => d && d.deposit_doc_no && d.status !== "cancelled") : []);
      const rc = resRcpt ? await resRcpt.json().catch(() => []) : [];
      // ใบรับเรื่องที่ยกเลิกไม่นับ (query ฝั่ง n8n กรองแล้ว — กันซ้ำเผื่อ workflow เก่า)
      setRcptRows(Array.isArray(rc) ? rc.filter(r2 => r2 && r2.receipt_no && r2.paid_at && r2.receipt_status !== "ยกเลิก") : []);
      const ps = resPs ? await resPs.json().catch(() => []) : [];
      setPsRows(Array.isArray(ps) ? ps.filter(p => p && p.payment_id && p.status === "active") : []);
      const um = resUm ? await resUm.json().catch(() => []) : [];
      setUmRows(Array.isArray(um) ? um.filter(u => u && u.id && u.status === "sold") : []);
      const rp = resRp ? await resRp.json().catch(() => []) : [];
      setRpRefundRows(Array.isArray(rp) ? rp.filter(d => d && d.deposit_no && d.status === "refunded") : []);
      const rpa = resRpAll ? await resRpAll.json().catch(() => []) : [];
      // ใบ legacy (import มัดจำป้ายแดงระบบเก่า) ไม่ใช่เงินรับของวันนั้น — รับเงินไปนานแล้วในระบบเก่า ห้ามขึ้นสรุปรายวัน; ใบยกเลิกก็ไม่นับ
      setRpStandaloneRows(Array.isArray(rpa) ? rpa.filter(d => d && d.deposit_no && d.standalone === true && !d.legacy && d.status !== "cancelled") : []);
      const diRaw = resDi ? await resDi.json().catch(() => []) : [];
      // list_deposit_income ตอบแถวเดียว {listjson: "[...]"} (รวมผ่าน json_agg ฝั่ง SQL)
      const di = Array.isArray(diRaw) ? diRaw : typeof diRaw?.listjson === "string" ? JSON.parse(diRaw.listjson) : [];
      setDepIncRows(Array.isArray(di) ? di.filter(x => x && x.receipt_no) : []);
      const fuelRaw = resFuel ? await resFuel.json().catch(() => ({})) : {};
      let fuel = [];
      try { fuel = typeof fuelRaw?.listjson === "string" ? JSON.parse(fuelRaw.listjson) : Array.isArray(fuelRaw) ? fuelRaw : []; } catch { fuel = []; }
      setFuelRows(fuel.filter(f => f && f.doc_no && f.status !== "ยกเลิก"));
      const irRaw = resInsRf ? await resInsRf.json().catch(() => ({})) : {};
      let ir = [];
      try { ir = typeof irRaw?.listjson === "string" ? JSON.parse(irRaw.listjson) : Array.isArray(irRaw) ? irRaw : []; } catch { ir = []; }
      setInsRefundRows(ir.filter(r => r && r.id));

      if (!Array.isArray(data) || data.length === 0) setMessage("ไม่พบรายการรับเงินในช่วงวันที่ที่เลือก");
    } catch {
      setRows([]);
      setMessage("❌ โหลดข้อมูลไม่สำเร็จ (ตรวจสอบว่า workflow retail-sale-api ถูก re-import แล้ว)");
    }
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // pivot ช่องทางรับชำระของแต่ละใบ — user ทั่วไปกรองเหลือเฉพาะสาขาตัวเองเสมอ
  const items = useMemo(() => {
    return rows
      .filter((r) => (isAdmin ? !branch || String(r.branch_code || "").substring(0, 5).toUpperCase() === String(branch).substring(0, 5).toUpperCase() : String(r.branch_code || "").substring(0, 5).toUpperCase() === myBranch))
      .map((r) => {
        let pms = r.payment_methods;
        if (typeof pms === "string") { try { pms = JSON.parse(pms); } catch { pms = []; } }
        if (!Array.isArray(pms)) pms = [];
        const split = { cash: 0, transfer: 0, card: 0, finance: 0, deposit: 0, coupon: 0, tradein: 0, other: 0 };
        for (const p of pms) split[methodKey(p.method)] += num(p.amount);
        const paid = num(r.paid_amount) || METHOD_COLS.reduce((s, c) => s + split[c.key], 0);
        // เงินจอง (booking_deposit) ที่หักในใบขาย — ไม่ได้อยู่ใน payment_methods ต้องบวกเข้าคอลัมน์เงินมัดจำเอง
        // ยกเว้น: ใบมัดจำที่คืนส่วนเกินไปแล้ว (refund_note อ้างใบขายนี้) — ส่วนที่ใช้ชำระโชว์เป็นแถว "ชำระด้วยเงินมัดจำ" ณ วันคืนแล้ว กันนับซ้ำ
        const refDep = depRows.find((d) => d.refunded_at && String(d.refund_note || "").includes(r.sale_no));
        const depAdd = Math.max(num(r.booking_deposit) - (refDep ? num(refDep.deposit_amount) : 0), 0);
        split.deposit += depAdd;
        const received = paid + depAdd;
        return { ...r, split, received, saleAmount: num(r.net_car_price || r.car_price) };
      });
  }, [rows, depRows, branch, isAdmin, myBranch]);

  // ตัวเลือกสาขารวมจากทุกแหล่ง (ขายรถ+มัดจำจอง+มัดจำอะไหล่+รับเรื่อง) — คีย์ 5 ตัวแรก กันสาขาที่มีแต่รายการรับเรื่อง/มัดจำหายจาก dropdown
  const branchOpts = useMemo(() => {
    const k5 = (v) => String(v || "").substring(0, 5).toUpperCase();
    const map = new Map();
    const add = (code, label) => {
      const k = k5(code);
      if (!k) return;
      const lb = String(label || code || "").trim();
      if (!map.has(k) || lb.length > map.get(k).length) map.set(k, lb);
    };
    rows.forEach((r) => add(r.branch_code, r.branch_name || r.branch_code));
    depRows.forEach((d) => add(d.branch_code, d.branch_name || d.branch_code));
    partDepRows.forEach((d) => add(d.branch_code, d.branch_code));
    rcptRows.forEach((r2) => add(r2.branch_code, r2.branch_code));
    psRows.forEach((p) => add(p.branch_code, p.branch_code));
    umRows.forEach((u) => add(u.branch_code, u.branch_code));
    rpRefundRows.forEach((d) => add(d.branch_code, d.branch_name || d.branch_code));
    return [...map.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.key.localeCompare(b.key));
  }, [rows, depRows, partDepRows, rcptRows, psRows, umRows, rpRefundRows]);

  const sumOf = (list) => {
    const t = { sale: 0, received: 0 };
    METHOD_COLS.forEach((c) => { t[c.key] = 0; });
    for (const it of list) {
      t.sale += it.saleAmount; t.received += it.received;
      METHOD_COLS.forEach((c) => { t[c.key] += it.split[c.key]; });
    }
    return t;
  };
  // ===== รับชำระเงินมัดจำขายรถ (จองรถ) — กรองช่วงวันที่ + สาขา แบบเดียวกับใบขาย =====
  const bc5 = (v) => String(v || "").substring(0, 5).toUpperCase();
  const depItems = useMemo(() => {
    return depRows
      .filter((d) => {
        const dt = String(d.deposit_date || "").slice(0, 10);
        if (!dt || dt < dateFrom || dt > dateTo) return false;
        return isAdmin ? (!branch || bc5(d.branch_code) === bc5(branch)) : bc5(d.branch_code) === myBranch;
      })
      .sort((a, b) => String(a.branch_code || "").localeCompare(String(b.branch_code || "")) || String(a.deposit_no || "").localeCompare(String(b.deposit_no || "")));
  }, [depRows, dateFrom, dateTo, branch, isAdmin, myBranch]);
  const depSum = useMemo(() => {
    const t = { total: 0, cash: 0, transfer: 0, other: 0 };
    for (const d of depItems) {
      const amt = num(d.deposit_amount);
      t.total += amt;
      const m = String(d.payment_method || "");
      if (m.includes("สด")) t.cash += amt;
      else if (m.includes("โอน")) t.transfer += amt;
      else t.other += amt;
    }
    return t;
  }, [depItems]);

  // มัดจำอะไหล่/บริการ (PDS/PDO) ที่รับเงินในช่วงวันที่ + สาขา
  const partDepItems = useMemo(() => {
    return partDepRows
      .filter((d) => {
        const dt = String(d.deposit_date || "").slice(0, 10);
        if (!dt || dt < dateFrom || dt > dateTo) return false;
        return isAdmin ? (!branch || bc5(d.branch_code) === bc5(branch)) : bc5(d.branch_code) === myBranch;
      })
      .sort((a, b) => String(a.deposit_doc_no || "").localeCompare(String(b.deposit_doc_no || "")));
  }, [partDepRows, dateFrom, dateTo, branch, isAdmin, myBranch]);
  const partDepSum = useMemo(() => partDepItems.reduce((s, d) => s + num(d.deposit_amount), 0), [partDepItems]);

  // ===== รวมใบขาย + มัดจำจองรถ + มัดจำอะไหล่/บริการ เป็นตารางเดียว (สไตล์รายงานรับเงิน DMS) — แต่ละแถวติดประเภทรายได้ =====
  // ===== รวมทุกแหล่งเป็นตารางเดียว — ตรรกะอยู่ใน src/lib/dailyCash.js (buildDailyCashItems) ใช้ร่วมกับหน้าบันทึกฝากเงิน =====
  const allItems = useMemo(() => buildDailyCashItems(
    { rows, depRows, partDepRows, rcptRows, psRows, umRows, rpRefundRows, rpStandaloneRows, depIncRows, fuelRows, insRefundRows },
    { dateFrom, dateTo, branch, isAdmin, myBranch },
  ), [rows, depRows, partDepRows, rcptRows, psRows, umRows, rpRefundRows, rpStandaloneRows, depIncRows, fuelRows, insRefundRows, dateFrom, dateTo, branch, isAdmin, myBranch]);

  // group ตามสาขา — ในสาขาเรียงใบขายก่อนแล้วค่อยมัดจำ
  const groups = useMemo(() => {
    const m = new Map();
    for (const it of allItems) {
      const k = it.branch_key || "-";
      if (!m.has(k)) m.set(k, { key: k, name: it.branch_name, rows: [] });
      m.get(k).rows.push(it);
    }
    for (const g of m.values()) g.rows.sort((a, b) => a.kind.localeCompare(b.kind) * -1 || String(a.doc_no).localeCompare(String(b.doc_no)));
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [allItems]);
  const grand = sumOf(allItems);


  // สรุปแยกประเภทตามรายได้
  const catSum = useMemo(() => {
    const m = new Map();
    for (const it of allItems) {
      if (!m.has(it.category)) {
        const z = { category: it.category, count: 0, sale: 0, received: 0 };
        METHOD_COLS.forEach((c) => { z[c.key] = 0; });
        m.set(it.category, z);
      }
      const t = m.get(it.category);
      t.count += 1; t.sale += it.saleAmount; t.received += it.received;
      METHOD_COLS.forEach((c) => { t[c.key] += it.split[c.key]; });
    }
    return [...m.values()];
  }, [allItems]);

  const th = { padding: "6px 8px", fontSize: 12, whiteSpace: "nowrap", background: "#e0f2fe", color: "#075985", border: "1px solid #bae6fd", textAlign: "center" };
  const td = { padding: "5px 8px", fontSize: 12.5, border: "1px solid #e5e7eb", verticalAlign: "top" };
  const tdR = { ...td, textAlign: "right", whiteSpace: "nowrap" };

  function printReport() {
    const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    let body = "";
    let idx = 0;
    for (const g of groups) {
      body += `<tr><td colspan="13" class="grp">สาขา ${esc(g.name)}</td></tr>`;
      for (const it of g.rows) {
        idx++;
        body += `<tr>
<td class="c">${idx}</td><td>${esc(it.doc_no || "-")}</td><td class="c">${esc(thaiDate(it.date))}</td>
<td>${esc(it.ref_no || "-")}</td><td>${esc(it.customer_name || "")}<br><span style="font-size:9.5px;color:#555">${esc(it.category)}${it.refunded ? " · คืนเงินแล้ว" : ""}</span></td><td class="r">${it.saleAmount ? fmt(it.saleAmount) : "-"}</td>
${METHOD_COLS.map((c) => `<td class="r">${it.split[c.key] ? fmt(it.split[c.key]) : "-"}</td>`).join("")}
<td class="r b">${fmt(it.received)}</td></tr>`;
      }
      const t = sumOf(g.rows);
      body += `<tr class="sub"><td colspan="5" class="r">รวมสาขา ${esc(g.name)} (${g.rows.length} รายการ)</td><td class="r">${fmt(t.sale)}</td>${METHOD_COLS.map((c) => `<td class="r">${t[c.key] ? fmt(t[c.key]) : "-"}</td>`).join("")}<td class="r b">${fmt(t.received)}</td></tr>`;
    }
    body += `<tr class="tot"><td colspan="5" class="r">รวมทั้งสิ้น (${allItems.length} รายการ)</td><td class="r">${fmt(grand.sale)}</td>${METHOD_COLS.map((c) => `<td class="r">${grand[c.key] ? fmt(grand[c.key]) : "-"}</td>`).join("")}<td class="r b">${fmt(grand.received)}</td></tr>`;

    // สรุปแยกประเภทตามรายได้ แนบท้ายใบพิมพ์
    let catBody = "";
    for (const t of catSum) {
      catBody += `<tr><td>${esc(t.category)}</td><td class="c">${t.count}</td>${METHOD_COLS.map((c) => `<td class="r">${t[c.key] ? fmt(t[c.key]) : "-"}</td>`).join("")}<td class="r b">${fmt(t.received)}</td></tr>`;
    }
    catBody += `<tr class="tot"><td class="r">รวมทั้งสิ้น</td><td class="c">${allItems.length}</td>${METHOD_COLS.map((c) => `<td class="r">${grand[c.key] ? fmt(grand[c.key]) : "-"}</td>`).join("")}<td class="r b">${fmt(grand.received)}</td></tr>`;
    const depSection = catSum.length ? `
<h3 style="margin:14px 0 4px">สรุปแยกประเภทตามรายได้</h3>
<table><thead><tr><th>ประเภทรายได้</th><th>จำนวน</th>${METHOD_COLS.map((c) => `<th>${c.label}</th>`).join("")}<th>รวมยอดชำระ</th></tr></thead><tbody>${catBody}</tbody></table>` : "";

    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>สรุปรายวันรับเงิน</title>
<style>@page{size:A4 landscape;margin:8mm}
*{font-family:"Sarabun","TH Sarabun New",Tahoma,sans-serif;box-sizing:border-box}
body{margin:0;padding:10px;color:#222;font-size:12px}
h2{text-align:center;margin:0 0 2px;font-size:18px}
.sub-h{text-align:center;color:#555;margin-bottom:10px}
table{width:100%;border-collapse:collapse}
th{background:#eef6fb;border:1px solid #999;padding:4px 6px;font-size:11px}
td{border:1px solid #bbb;padding:3px 6px;font-size:11px}
.c{text-align:center}.r{text-align:right}.b{font-weight:700}
.grp{background:#f1f5f9;font-weight:700}
.sub td{background:#fafaf5;font-weight:700}
.tot td{background:#fde68a;font-weight:800;font-size:12px}
</style></head><body>
<h2>สรุปรายวันรับเงิน</h2>
<div class="sub-h">เลือกระหว่างวันที่ ${esc(thaiDate(dateFrom))} ถึง ${esc(thaiDate(dateTo))}${(isAdmin ? branch : myBranch) ? " · สาขา " + esc(isAdmin ? branch : myBranch) : ""} · พิมพ์เมื่อ ${esc(new Date().toLocaleString("th-TH"))}</div>
<table><thead><tr>
<th>ลำดับ</th><th>เลขที่เอกสาร</th><th>วันที่รับเงิน</th><th>เอกสารอ้างอิง</th><th>ลูกค้า / ประเภทรายได้</th><th>ยอดขาย</th>
${METHOD_COLS.map((c) => `<th>${c.label}</th>`).join("")}<th>รวมยอดชำระ</th>
</tr></thead><tbody>${body}</tbody></table>
${depSection}
</body></html>`;
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) { setMessage("❌ เปิดหน้าต่างพิมพ์ไม่ได้ (popup ถูกบล็อก)"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 350);
  }

  const inp = { padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, background: "#fff" };

  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 className="page-title">💰 สรุปรายวันรับเงิน</h2>
        <button onClick={printReport} disabled={!allItems.length}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: allItems.length ? "#0369a1" : "#cbd5e1", color: "#fff", cursor: allItems.length ? "pointer" : "not-allowed", fontWeight: 600 }}>
          🖨️ พิมพ์รายงาน
        </button>
      </div>

      {/* filters */}
      <div className="form-card" style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>ตั้งแต่วันที่</div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>ถึงวันที่</div>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>สาขา</div>
          {isAdmin ? (
            <select value={branch} onChange={(e) => setBranch(e.target.value)} style={inp}>
              <option value="">ทุกสาขา</option>
              {branchOpts.map((b) => <option key={b.key} value={b.key}>{b.label && b.label !== b.key ? b.label : b.key}</option>)}
            </select>
          ) : (
            <div style={{ ...inp, background: "#f3f4f6", color: "#334155", fontWeight: 600 }} title="เห็นเฉพาะสาขาของตัวเอง">
              {myBranch || "—"}
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={load} disabled={loading}>{loading ? "⏳ กำลังโหลด..." : "🔍 แสดงรายงาน"}</button>
        {message && <span style={{ fontSize: 13, color: message.startsWith("❌") ? "#b91c1c" : "#92400e" }}>{message}</span>}
      </div>

      {/* summary cards */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "10px 0" }}>
        <SummaryCard label="จำนวนรายการ" value={allItems.length.toLocaleString("th-TH")} color="#334155" />
        <SummaryCard label="ยอดขายรวม" value={fmt(grand.sale)} color="#0369a1" />
        <SummaryCard label="เงินรับรวม" value={fmt(grand.received)} color="#15803d" />
        {METHOD_COLS.filter((c) => grand[c.key] > 0).map((c) => (
          <SummaryCard key={c.key} label={c.label} value={fmt(grand[c.key])} color="#7c3aed" />
        ))}
        {depSum.total > 0 && <SummaryCard label="รับมัดจำจองรถ" value={fmt(depSum.total)} color="#b45309" />}
        {partDepSum > 0 && <SummaryCard label="รับมัดจำอะไหล่/บริการ" value={fmt(partDepSum)} color="#9333ea" />}
      </div>

      {/* table */}
      <div className="form-card" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>ลำดับ</th><th style={th}>เลขที่เอกสาร</th><th style={th}>วันที่รับเงิน</th>
            <th style={th}>เอกสารอ้างอิง</th><th style={th}>ลูกค้า / ประเภทรายได้</th><th style={th}>ผู้ขาย</th><th style={th}>ยอดขาย</th>
            {METHOD_COLS.map((c) => <th key={c.key} style={th}>{c.label}</th>)}
            <th style={th}>รวมยอดชำระ</th>
          </tr></thead>
          <tbody>
            {groups.map((g) => {
              const t = sumOf(g.rows);
              return (
                <React.Fragment key={g.key}>
                  <tr><td colSpan={14} style={{ ...td, background: "#f1f5f9", fontWeight: 700, color: "#0f172a" }}>สาขา {g.name}</td></tr>
                  {g.rows.map((it, i) => (
                    // key ต้องไม่ซ้ำ: แถวค่านำพา/จ่ายออกไม่มีเลขเอกสาร (doc_no "-") พอสาขาเดียวมี 2 คันในวันเดียว key ชนกัน → React วาดแถวผีซ้ำ (user 2026-09-03)
                    <tr key={`${g.key}|${it.kind}|${it.doc_no}|${it.ref_no || ""}|${i}`} style={{ background: it.kind === "deposit" ? "#fffdf2" : it.kind === "part_deposit" ? "#fdf9ff" : it.kind === "part_service" ? "#f0fdfa" : it.kind === "used_moto" ? "#fff7ed" : i % 2 ? "#fafcff" : "#fff" }}>
                      <td style={{ ...td, textAlign: "center", color: "#94a3b8" }}>{i + 1}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{it.doc_no}
                        {it.refunded && <div style={{ fontSize: 10.5, color: "#dc2626" }}>คืนเงินแล้ว</div>}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>{thaiDate(it.date)}</td>
                      <td style={{ ...td, fontFamily: "monospace", color: "#1e40af" }}>{it.ref_no || "-"}</td>
                      <td style={td}>{it.customer_name || "-"}
                        <div style={{ fontSize: 10.5, color: it.kind === "deposit" ? "#b45309" : it.kind === "part_deposit" ? "#9333ea" : it.kind === "part_service" ? "#0d9488" : it.kind === "used_moto" ? "#c2410c" : "#0369a1" }}>{it.category}</div>
                        {it.finance && <div style={{ fontSize: 10.5, color: "#7c3aed" }}>ไฟแนนซ์: {it.finance}</div>}
                        {it.note && <div style={{ fontSize: 10.5, color: "#92400e" }}>หมายเหตุ: {it.note}</div>}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>{dispSeller(it.seller)}</td>
                      <td style={tdR}>{it.saleAmount ? fmt(it.saleAmount) : "-"}</td>
                      {METHOD_COLS.map((c) => <td key={c.key} style={tdR}>{fmt0(it.split[c.key])}</td>)}
                      <td style={{ ...tdR, fontWeight: 700, color: "#15803d" }}>{fmt(it.received)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#fefce8", fontWeight: 700 }}>
                    <td colSpan={6} style={{ ...td, textAlign: "right" }}>รวมสาขา {g.name} ({g.rows.length} รายการ)</td>
                    <td style={tdR}>{fmt(t.sale)}</td>
                    {METHOD_COLS.map((c) => <td key={c.key} style={tdR}>{fmt0(t[c.key])}</td>)}
                    <td style={{ ...tdR, color: "#15803d" }}>{fmt(t.received)}</td>
                  </tr>
                </React.Fragment>
              );
            })}
            {allItems.length > 0 && (
              <tr style={{ background: "#fde68a", fontWeight: 800 }}>
                <td colSpan={6} style={{ ...td, textAlign: "right" }}>รวมทั้งสิ้น ({allItems.length} รายการ)</td>
                <td style={tdR}>{fmt(grand.sale)}</td>
                {METHOD_COLS.map((c) => <td key={c.key} style={tdR}>{fmt0(grand[c.key])}</td>)}
                <td style={tdR}>{fmt(grand.received)}</td>
              </tr>
            )}
            {allItems.length === 0 && !loading && (
              <tr><td colSpan={14} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>— ไม่มีรายการรับเงินในช่วงที่เลือก —</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
        * แสดงเฉพาะใบขายที่บันทึกรับชำระเงินแล้ว (อ้างอิงวันที่รับเงิน/ใบเสร็จ) · ยอดขาย = ราคารถสุทธิ · แหล่งรับชำระแยกตามที่บันทึกตอนรับเงิน · เงินมัดจำ = เงินจองที่หักในใบขาย (รับเงินจริงตอนจอง)
      </div>

      {/* ===== สรุปแยกประเภทตามรายได้ ===== */}
      {catSum.length > 0 && (
        <div className="form-card" style={{ overflowX: "auto", marginTop: 14 }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>📊 สรุปแยกประเภทตามรายได้</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>ประเภทรายได้</th><th style={th}>จำนวน</th>
              {METHOD_COLS.map((c) => <th key={c.key} style={th}>{c.label}</th>)}
              <th style={th}>รวมยอดชำระ</th>
            </tr></thead>
            <tbody>
              {catSum.map((t) => (
                <tr key={t.category}>
                  <td style={{ ...td, fontWeight: 600 }}>{t.category}</td>
                  <td style={{ ...td, textAlign: "center" }}>{t.count}</td>
                  {METHOD_COLS.map((c) => <td key={c.key} style={tdR}>{fmt0(t[c.key])}</td>)}
                  <td style={{ ...tdR, fontWeight: 700, color: "#15803d" }}>{fmt(t.received)}</td>
                </tr>
              ))}
              <tr style={{ background: "#fde68a", fontWeight: 800 }}>
                <td style={{ ...td, textAlign: "right" }}>รวมทั้งสิ้น</td>
                <td style={{ ...td, textAlign: "center" }}>{allItems.length}</td>
                {METHOD_COLS.map((c) => <td key={c.key} style={tdR}>{fmt0(grand[c.key])}</td>)}
                <td style={tdR}>{fmt(grand.received)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
            * รายได้เงินมัดจำจองรถ = เงินรับจริง ณ วันจอง (จากระบบมัดจำจองรถ) — ใบที่คืนเงินแล้วมีป้ายกำกับในตารางหลัก
          </div>
        </div>
      )}
      {/* สรุปยอดเงินประจำวัน — ใช้ข้อมูลจากระบบอย่างเดียว (user 2026-08-24: กำลังเปลี่ยนระบบ ไม่ดึงค่าใช้จ่ายจาก upload DMS)
          เงินสดรับสุทธิ = รวมช่องเงินสดทุกแถว (รายการคืนเงินติดลบหักในตัวแล้ว) — ค่าใช้จ่ายเงินสดสาขายังไม่มีเมนูในระบบ ไว้เพิ่มเมื่อมี */}
      {(() => {
        const rowSt = { display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 };
        return (
          <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", padding: 16, maxWidth: 480 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>💰 สรุปยอดเงินประจำวัน (จากระบบ)</div>
            <div style={{ ...rowSt, fontWeight: 700 }}><span>เงินสดรับสุทธิ (หักรายการคืนเงินแล้ว) — นำฝากธนาคาร</span><b style={{ color: grand.cash >= 0 ? "#166534" : "#b91c1c" }}>{fmt(grand.cash)}</b></div>
            <div style={rowSt}><span>เงินโอนเข้าธนาคาร (รวม)</span><b style={{ color: "#1d4ed8" }}>{fmt(grand.transfer)}</b></div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>นับเฉพาะรายการที่บันทึกในระบบ (ขาย NEW / มัดจำ / รับเรื่อง / อะไหล่-บริการ / คืนเงิน) — ไม่รวมค่าใช้จ่ายเงินสดจาก upload DMS</div>
          </div>
        );
      })()}
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ flex: "1 1 130px", minWidth: 130, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
