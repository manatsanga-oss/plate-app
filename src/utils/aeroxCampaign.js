// แคมเปญค่าคอมพิเศษ AEROX (STEP COMMISSION) — config ทุกรอบ + ตัวโหลดยอดขาย + ตัวคำนวณ step + ตัวแบ่งค่าคอมรายใบขาย
// ใช้ร่วม: POP UP ตอนเข้าระบบ (pages/AeroxCampaignPopup.jsx, pages/AeroxResultPopup.jsx) และเมนู HR "ค่าคอมพิเศษเฉพาะรุ่น" (pages/ModelSpecialCommissionPage.jsx)
const RETAIL_API = "https://n8n-new-project-gwf2.onrender.com/webhook/retail-sale-api";
const TIERS = [
  { min: 1, max: 9, rate: 1000, label: "1-9 Unit" },
  { min: 10, max: 14, rate: 1500, label: "10-14 Unit" },
  { min: 15, max: 19, rate: 2000, label: "15-19 Unit" },
  { min: 20, max: Infinity, rate: 3000, label: "20 Unit Up" },
];
// รอบแคมเปญ — เพิ่มรอบใหม่ต่อท้ายได้เลย (หน้า HR และ POP UP อ่านจากรายการนี้)
//   payoutDate: วันที่เงินเข้า (ประกาศแล้ว) → หน้า/ป๊อปอัปแสดงยอดเป็น "กำหนดจ่าย" สีเขียว แม้ STD บางเดือนไม่ผ่าน
export const AEROX_CAMPAIGNS = [
  { // รอบแรก (ภาพจาก Yamaha 2026-09-08) — user 2026-11-12: เงินเข้า 10 ธันวาคม 2569
    key: "aerox-2569-09", label: "AEROX STEP COMMISSION · ก.ย.–ต.ค. 2569", shortLabel: "ก.ย.–ต.ค.", periodLabel: "1 ก.ย. – 31 ต.ค. 2569",
    from: "2026-09-01", to: "2026-10-31", payoutDate: "2026-12-10",
    months: [{ ym: "2026-09", label: "ก.ย.", std: 15 }, { ym: "2026-10", label: "ต.ค.", std: 15 }],
    tiers: TIERS,
  },
  { // ต่อแคมเปญ (ภาพ Promotion Aerox จาก user 2026-11-12): STD พ.ย. 20 / ธ.ค. 20 · STU เท่าเดิม
    key: "aerox-2569-11", label: "AEROX STEP COMMISSION · พ.ย.–ธ.ค. 2569", shortLabel: "พ.ย.–ธ.ค.", periodLabel: "1 พ.ย. – 31 ธ.ค. 2569",
    from: "2026-11-01", to: "2026-12-31", payoutDate: "",
    months: [{ ym: "2026-11", label: "พ.ย.", std: 20 }, { ym: "2026-12", label: "ธ.ค.", std: 20 }],
    tiers: TIERS,
  },
];
export const AEROX_CAMPAIGN = AEROX_CAMPAIGNS[0]; // รอบแรก (ชื่อเดิมที่โค้ดเก่าอ้างถึง)
const todayIso = () => new Date().toLocaleDateString("en-CA"); // วันที่เครื่อง (เวลาไทย) ไม่ใช่ UTC
export const aeroxCampaignByKey = (key) => AEROX_CAMPAIGNS.find((c) => c.key === key) || AEROX_CAMPAIGNS[0];
/** แคมเปญที่กำลังดำเนินอยู่ ณ วันที่ iso (ไม่มี = null) */
export const currentAeroxCampaign = (iso = todayIso()) => AEROX_CAMPAIGNS.find((c) => iso >= c.from && iso <= c.to) || null;
export const isAeroxCampaignActive = (iso = todayIso()) => !!currentAeroxCampaign(iso);
export const tierOf = (units, campaign = AEROX_CAMPAIGN) => campaign.tiers.find((t) => units >= t.min && units <= t.max) || null;
const TH_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
/** "2026-12-10" → "10 ธันวาคม 2569" */
export const thaiLongDate = (iso) => { const [y, m, d] = String(iso || "").slice(0, 10).split("-").map(Number); return y && m && d ? `${d} ${TH_MONTHS_FULL[m - 1]} ${y + 543}` : ""; };

// ดึงยอดขาย Aerox ช่วงแคมเปญ + สรุปรายเดือน/รายร้าน/รายพนักงานขาย — คืน campaign ติดไปด้วยให้ส่วนแสดงผลใช้
export async function loadAeroxCampaign(campaign = AEROX_CAMPAIGN) {
  const res = await fetch(RETAIL_API, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "list_retail_sales", date_from: campaign.from, date_to: campaign.to, limit: 5000 }) });
  const rows = await res.json().catch(() => []);
  const sales = (Array.isArray(rows) ? rows : []).filter((r) => r && r.invoice_no
    && String(r.brand || "").toUpperCase() === "YAMAHA"
    && /AEROX/i.test(`${r.model_name || ""} ${r.model_code || ""}`)
    && String(r.sale_status || "10") !== "90"
    && String(r.note || "") !== "ขายส่ง");
  const byMonth = {}; const br = {}; const sl = {};
  for (const s of sales) {
    const ym = String(s.sale_date || "").slice(0, 7);
    byMonth[ym] = (byMonth[ym] || 0) + 1;
    const code = String(s.branch_code || "").slice(0, 5).toUpperCase() || "-";
    if (!br[code]) br[code] = { code, name: String(s.branch_code || s.branch_name || code), units: 0, byMonth: {} };
    br[code].units += 1; br[code].byMonth[ym] = (br[code].byMonth[ym] || 0) + 1;
    const seller = String(s.seller || "").trim() || "(ไม่ระบุ)";
    if (!sl[seller]) sl[seller] = { seller, units: 0, byMonth: {}, branches: new Set() };
    sl[seller].units += 1; sl[seller].byMonth[ym] = (sl[seller].byMonth[ym] || 0) + 1; sl[seller].branches.add(code);
  }
  return {
    campaign, total: sales.length, byMonth,
    branches: Object.values(br).sort((a, b) => b.units - a.units || a.code.localeCompare(b.code)),
    sellers: Object.values(sl).map((x) => ({ ...x, branches: [...x.branches].sort() })).sort((a, b) => b.units - a.units || a.seller.localeCompare(b.seller)),
    sales: [...sales].sort((a, b) => String(a.sale_date || "").localeCompare(String(b.sale_date || "")) || String(a.invoice_no).localeCompare(String(b.invoice_no))),
  };
}
// step ค่าคอม/คัน ของยอดรวม + ผ่าน STD ครบทุกเดือนหรือไม่ + มีกำหนดจ่ายแล้วหรือยัง — ใช้ร่วมทุกหน้าที่แสดงผลแคมเปญ
//   payable = ผ่าน STD ครบ หรือประกาศวันเงินเข้าแล้ว (payoutDate) → แสดงยอดเป็นสีเขียว
export function aeroxCampaignResult(data) {
  const campaign = data?.campaign || AEROX_CAMPAIGN;
  const total = data?.total || 0;
  const tier = tierOf(total, campaign);
  const rate = tier ? tier.rate : 0;
  const stdOk = campaign.months.map((m) => ({ ...m, units: data?.byMonth?.[m.ym] || 0, ok: (data?.byMonth?.[m.ym] || 0) >= m.std }));
  const allStdOk = stdOk.every((m) => m.ok);
  const payoutDate = campaign.payoutDate || "";
  return { campaign, total, tier, rate, stdOk, allStdOk, payoutDate, payable: allStdOk || !!payoutDate, commission: total * rate };
}

// ---------------------------------------------------------------------------
// แบ่งค่าคอมแคมเปญ "รายใบขาย" เฉลี่ยเท่ากันให้พนักงานมีสิทธิ์ค่าคอมพิเศษที่ "มาทำงานในวันขาย" ของสาขานั้น — ทุกสาขารวม SCY01
// (user 2026-11-12: "SCY01 ให้นับเฉพาะคนที่มาทำงานวันขายด้วย" — ต่างจากรายงานค่าคอมพิเศษปกติที่ SCY01 หารทุกคนที่มีสิทธิ์)
// แหล่งข้อมูล: Sales Extra Pay API action special_commission_attendance → [{ work_date, branch_code, employee_id, employee_name, worked }]
//   นับเฉพาะ "มาทำงานจริง" = worked true (มีสแกนเข้า หรือ override 'มา') — วันหยุดประจำสัปดาห์และวันลาไม่นับ
//   (user 2026-11-12 "ขอแบบมาทำงานเท่านั้น": วรรณเพ็ญ ลาป่วย 2 เดือน ถูกนับทุกวันศุกร์เพราะเป็นวันหยุดประจำสัปดาห์)
//   action รุ่นแรกยังไม่มีคอลัมน์ worked → mode "attendance-dayoff" (ยังนับวันหยุดฯ) หน้าเว็บขึ้นป้ายเตือนให้ re-import
// ถ้า n8n ยังไม่มี action นี้ (ยังไม่ re-import) → ใช้รายชื่อจาก commission_split_detail แทน (mode "legacy": SCY01 = ทุกคนที่มีสิทธิ์) แล้วหน้าเว็บขึ้นป้ายเตือน
// คืน { mode, byInvoice: { invoice_no: [{id,name}] }, employees: [{ id, name, branches, cars, share, amount, byMonth }], unallocated: [invoice_no], unallocatedAmount }
// ---------------------------------------------------------------------------
const SALES_EXTRA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/sales-extra-pay-api";
const postExtra = async (body) => {
  const res = await fetch(SALES_EXTRA_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => []);
  return Array.isArray(d) ? d : [];
};
export async function loadAeroxSplit(data, rate) {
  const campaign = data?.campaign || AEROX_CAMPAIGN;
  const range = { date_from: campaign.from, date_to: campaign.to };
  const byInvoice = {};
  const push = (inv, id, name) => {
    const list = (byInvoice[inv] = byInvoice[inv] || []);
    if (!list.some((e) => String(e.id) === String(id))) list.push({ id, name: name || String(id) });
  };
  let mode = "attendance";
  const att = (await postExtra({ action: "special_commission_attendance", ...range }).catch(() => [])).filter((r) => r && r.work_date && r.employee_id);
  if (att.length) {
    const hasFlag = att.some((r) => typeof r.worked === "boolean");
    if (!hasFlag) mode = "attendance-dayoff";
    const present = hasFlag ? att.filter((r) => r.worked === true) : att;
    const byDayBranch = {};
    for (const r of present) (byDayBranch[`${String(r.work_date).slice(0, 10)}|${String(r.branch_code || "").slice(0, 5).toUpperCase()}`] ||= []).push(r);
    for (const sale of (data?.sales || [])) {
      const key = `${String(sale.sale_date || "").slice(0, 10)}|${String(sale.branch_code || "").slice(0, 5).toUpperCase()}`;
      for (const r of (byDayBranch[key] || [])) push(String(sale.invoice_no), r.employee_id, r.employee_name);
    }
  } else {
    mode = "legacy";
    const rows = await postExtra({ action: "commission_split_detail", ...range, branch_code: "", brand: "" });
    for (const r of rows) { if (r && r.invoice_no && r.employee_id && r.is_excluded !== true) push(String(r.invoice_no), r.employee_id, r.employee_name); }
  }
  const emp = {}; const unallocated = [];
  for (const sale of (data?.sales || [])) {
    const list = byInvoice[String(sale.invoice_no)] || [];
    if (!list.length) { unallocated.push(sale.invoice_no); continue; }
    const ym = String(sale.sale_date || "").slice(0, 7);
    const code = String(sale.branch_code || "").slice(0, 5).toUpperCase() || "-";
    const share = 1 / list.length; const amount = (Number(rate) || 0) / list.length;
    for (const e of list) {
      const k = String(e.id);
      if (!emp[k]) emp[k] = { id: e.id, name: e.name, branches: new Set(), cars: 0, share: 0, amount: 0, byMonth: {} };
      const x = emp[k];
      x.branches.add(code); x.cars += 1; x.share += share; x.amount += amount;
      const m = (x.byMonth[ym] = x.byMonth[ym] || { share: 0, amount: 0 });
      m.share += share; m.amount += amount;
    }
  }
  return {
    mode, byInvoice,
    employees: Object.values(emp).map((x) => ({ ...x, branches: [...x.branches].sort() })).sort((a, b) => b.amount - a.amount || String(a.name).localeCompare(String(b.name), "th")),
    unallocated, unallocatedAmount: unallocated.length * (Number(rate) || 0),
  };
}
