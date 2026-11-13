// รายงานเจ้าหนี้ตามเอกสาร (เมนู Accounting → บัญชี → เจ้าหนี้ตามเอกสาร) — user 2026-11-12 ส่งรายงาน Flow "เจ้าหนี้ตามเอกสาร" ของสิงห์ชัย ณ 30/09/69 เป็นต้นแบบ
// แยกตรรกะไว้ที่ไฟล์นี้ (ไม่มี React) เพื่อให้รันตรวจยอดด้วย node ได้
//
// หลักคิด "ณ วันที่ D": เอกสารลงวันที่ ≤ D ที่ยังไม่จ่าย หรือจ่ายหลังวัน D = ยังเป็นเจ้าหนี้ ณ วันนั้น (ดูย้อนหลังได้ เหมือนงบทดลอง)
// แหล่งข้อมูล (เฟสแรก):
//   1) ค่าใช้จ่าย  — accounting-api expense_record op list (expense_documents): วันที่เอกสาร doc_date · วันจ่าย paid_at (เวลาไทย) · ยอด total (รวม VAT ก่อนหัก ณ ที่จ่าย)
//        ใบของเงินเดือน/ค่าคอม/เงินนำส่ง (payroll_* / commission_*) ไม่ใช่เจ้าหนี้การค้า → ซ่อนไว้ ติ๊กแสดงได้ (งบทดลองมีบรรทัดภาษีหัก ณ ที่จ่าย/เจ้าหนี้สรรพากรแยกอยู่แล้ว)
//   2) ค่ารถ      — goods-payment-api list_invoices payment_type vehicle (HONDA/YAMAHA) + list_payments (วันจ่ายของใบ GP)
//   3) ค่าอะไหล่/สินค้า — goods-payment-api list_invoices payment_type parts (รวมหมวก/เสื้อของแถมที่บันทึกในใบกำกับอะไหล่)
// ยังไม่รวม: งานวางบิล (ทะเบียน/พรบ./COSMOS/รับเรื่อง) ที่ Flow ตั้ง EXP สิ้นเดือน, ค่าใช้จ่ายจาก FLOW ACC (F-EXP), รับวัสดุสำนักงาน, ซื้อระหว่างบริษัท
// สังกัด: ค่าใช้จ่าย = ช่อง affiliation ของใบ · ค่ารถ/อะไหล่ = ตามบัญชีธนาคารที่จ่าย (ถ้าจ่ายแล้ว) ไม่งั้นตามยี่ห้อ HONDA → ป.เปา, YAMAHA → สิงห์ชัย
// วันครบกำหนด: ระบบไม่ได้เก็บเครดิตเทอม → ค่าใช้จ่าย/ค่ารถ = วันที่เอกสาร · ค่าอะไหล่/สินค้า = +30 วัน (ตามที่ Flow ลง RI อะไหล่ YAMAHA/ของแถม)
// เอกสารก่อน 01/09/69 (วันเริ่มใช้ระบบบันทึกจ่าย — กฎเดียวกับหน้าบันทึกชำระค่าสินค้า GP_START) ซ่อนไว้ เพราะจ่ายจริงไปแล้วแต่ไม่มีใบจ่ายในระบบ
//   อะไหล่ HONDA จากไทยฮอนด้า = วันที่ 15 ของเดือนถัดไป
// ตรวจกับ Flow ป.เปา ณ 30/09/69: ไทยฮอนด้า อะไหล่ 136,871.54 (75 ใบ) + บี.ที.เอ็ม.เฮลเม็ท 41,730.00 + บิ๊กเบียร์ 20,330.00 ตรงทุกยอด
//   ส่วนที่ Flow มีแต่ระบบยังไม่มี: นายสมชาย 120,510 (วางบิลงานทะเบียน/โอน) · บ.กลางฯ 101,976.98 (วางบิล พรบ. รวมค้างเก่า มี.ค.69 62,390.63) · สยามคอสมอส 103,019.71 (ประกัน COSMOS) · ราตรี 2,179 (ค้างเก่าปี 68)
// ตรวจกับ Flow สิงห์ชัย ณ 30/09/69: ไทยยามาฮ่า ค่ารถ 1,742,709.00 + อะไหล่ 167,665.61 + ยูเอเอฟ 43,870.00 ตรงทุกยอด
//   ส่วนที่ Flow มีแต่ระบบยังไม่มี: นายสมชาย (วางบิลงานทะเบียน) 98,070 · บ.กลางฯ (วางบิล พรบ.) 23,550.57 · ป.เปา 1,027.20 · ภูพานการ์เมนท์ 13,375 (ระบบลงวันที่ 01/10) · ปิโตรเลียมไทย 500 (ค้างเก่าปี 68)

const N8N = "https://n8n-new-project-gwf2.onrender.com/webhook/";
export const AP_START = "2026-09-01";
export const AP_COMPANIES = ["ป.เปา", "สิงห์ชัย"];
export const AP_COMPANY_FULL = { "ป.เปา": "บริษัท ป.เปา มอเตอร์เซอร์วิส จำกัด", "สิงห์ชัย": "ห้างหุ้นส่วนจำกัด สิงห์ชัยสยามยนต์" };
export const AP_SOURCES = {
  expense: { label: "ค่าใช้จ่าย", term: 0 },
  vehicle: { label: "ค่ารถจักรยานยนต์", term: 0 },
  parts: { label: "ค่าอะไหล่/สินค้า", term: 30 },
};
export const AP_BUCKETS = [
  { key: "current", label: "ยังไม่เกินกำหนด" },
  { key: "d30", label: "1-30 วัน" },
  { key: "d60", label: "31-60 วัน" },
  { key: "d90", label: "61-90 วัน" },
  { key: "over", label: "มากกว่า 90 วัน" },
];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const compOfName = (v) => (/สิงห์ชัย/.test(String(v || "")) ? "สิงห์ชัย" : /เปา/.test(String(v || "")) ? "ป.เปา" : "");
// วันที่แบบเวลาไทย (ค่าจาก API เป็น ISO UTC เช่น 2026-10-01T17:00:00.000Z = 02/10 เวลาไทย)
const bkkDate = (v) => {
  if (!v) return "";
  const s = String(v);
  if (!s.includes("T")) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d) ? s.slice(0, 10) : d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
};
export const addDaysIso = (iso, n) => {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayDiff = (a, b) => Math.round((new Date(a + "T00:00:00Z") - new Date(b + "T00:00:00Z")) / 86400000);
const cleanName = (v) => String(v || "").replace(/\s+/g, " ").trim();

async function post(path, body) {
  const res = await fetch(N8N + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = (await res.text()).trim();
  if (!t) return [];
  let j; try { j = JSON.parse(t); } catch { return []; }
  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.data)) return j.data;
  return j ? [j] : [];
}

/** โหลดเอกสารทุกแหล่งที่ลงวันที่ไม่เกิน asOf (ยังไม่กรองว่าจ่ายแล้วหรือยัง) → แถวรูปแบบเดียวกัน */
export async function loadPayableDocs({ asOf, includeOld = false, onProgress = () => {} }) {
  const from = includeOld ? "2000-01-01" : AP_START;
  const docs = [];

  // ---- 1) ค่าใช้จ่าย ----
  onProgress("ค่าใช้จ่าย…");
  const [exp, accounts] = await Promise.all([
    post("accounting-api", { action: "expense_record", op: "list", date_from: from, date_to: asOf }),
    post("accounting-api", { action: "list_bank_accounts", include_inactive: "true" }),
  ]);
  const accCompany = new Map(accounts.filter((a) => a && a.account_id).map((a) => [String(a.account_id), compOfName(a.account_name)]));
  for (const r of exp) {
    if (!r || !r.expense_doc_no) continue;
    const st = String(r.status || "").toLowerCase();
    if (st === "cancelled" || st === "ยกเลิก") continue;
    const docDate = bkkDate(r.doc_date);
    if (!docDate) continue;
    const items = Array.isArray(r.items) ? r.items : [];
    docs.push({
      key: "exp-" + r.expense_doc_id, source: "expense", company: compOfName(r.affiliation) || String(r.affiliation || ""),
      vendor: cleanName(r.vendor_name) || "(ไม่ระบุผู้จำหน่าย)", doc_no: r.expense_doc_no, doc_date: docDate, due_date: addDaysIso(docDate, AP_SOURCES.expense.term),
      amount: r2(r.total), paid_date: st === "paid" ? (bkkDate(r.paid_at) || "0000-00-00") : "", paid_ref: r.paid_doc_no || "",
      desc: cleanName(r.description) || cleanName(items[0]?.description || items[0]?.item_name || items[0]?.name) || "",
      ref: r.tax_invoice_no || r.reference_no || "",
      employee: !!(r.payroll_save_group || r.payroll_creditor_type || r.commission_save_group || r.commission_normal_save_group),
    });
  }

  // ---- 2) + 3) ค่ารถ / ค่าอะไหล่ (ใบกำกับภาษีซื้อ + ใบจ่าย GP) ----
  onProgress("ใบจ่ายค่าสินค้า…");
  const [payV, payP] = await Promise.all([
    post("goods-payment-api", { action: "list_payments", payment_type: "vehicle" }),
    post("goods-payment-api", { action: "list_payments", payment_type: "parts" }),
  ]);
  const payMap = new Map();
  for (const p of [...payV, ...payP]) {
    if (!p || !p.id) continue;
    const st = String(p.status || "").toLowerCase();
    if (st === "cancelled" || st === "ยกเลิก") continue;
    const m0 = Array.isArray(p.payment_methods) && p.payment_methods.length ? p.payment_methods[0] : null;
    payMap.set(String(p.id), { date: bkkDate(p.payment_date), no: p.payment_no || "", company: accCompany.get(String(p.bank_account_id || m0?.bank_account_id || "")) || "" });
  }
  // ⚠️ ใบกำกับค่ารถ YAMAHA เดือน ต.ค.69 จำนวน 24 ใบ (เลข 21xxxxx รวม 9.96 ล้าน) ถูกนำเข้าในตารางใบกำกับอะไหล่ด้วย และค้างสถานะ "ยังไม่จ่าย" ที่ฝั่งอะไหล่
  //   ทั้งที่จ่ายแล้วในฝั่งค่ารถ → ใบฝั่งอะไหล่ที่เลขตรงกับใบค่ารถยี่ห้อเดียวกัน (ยอดเท่ากัน) ถือเป็นใบซ้ำ ไม่นับ (พบ 2026-11-12)
  const vehicleInv = new Map(); // "BRAND|เลขใบกำกับ" → ยอด
  for (const pt of ["vehicle", "parts"]) {
    onProgress(pt === "vehicle" ? "ใบกำกับค่ารถ…" : "ใบกำกับค่าอะไหล่…");
    const lists = await Promise.all(["HONDA", "YAMAHA"].map((brand) => post("goods-payment-api", { action: "list_invoices", brand, payment_type: pt })));
    lists.forEach((list, bi) => {
      const brand = bi === 0 ? "HONDA" : "YAMAHA";
      for (const r of list) {
        if (!r || !r.invoice_no) continue;
        const invKey = `${brand}|${String(r.invoice_no).trim()}`;
        if (pt === "vehicle") vehicleInv.set(invKey, r2(r.amount));
        else if (vehicleInv.has(invKey) && Math.abs(vehicleInv.get(invKey) - r2(r.amount)) < 1) continue; // ใบค่ารถที่ซ้ำอยู่ในตารางอะไหล่
        const docDate = bkkDate(r.invoice_date);
        if (!docDate || docDate > asOf) continue; // "ยอดยกมา" ไม่มีวันที่ → ข้าม
        const paid = String(r.payment_status || "") === "paid";
        const pay = paid ? payMap.get(String(r.payment_id)) : null;
        docs.push({
          key: `${pt}-${brand}-${r.id}`, source: pt, brand, company: (pay && pay.company) || (brand === "HONDA" ? "ป.เปา" : "สิงห์ชัย"),
          vendor: cleanName(r.vendor_name) || (brand === "HONDA" ? "บริษัท ไทยฮอนด้า จำกัด" : "บริษัท ไทยยามาฮ่ามอเตอร์ จำกัด"),
          doc_no: String(r.invoice_no), doc_date: docDate,
          // อะไหล่ HONDA จากไทยฮอนด้า: ครบกำหนดวันที่ 15 ของเดือนถัดไป (Flow ป.เปา ลง RI รวมสิ้นเดือน 30/09 ครบกำหนด 15/10) · นอกนั้นใช้เครดิตเทอมตามประเภท
          due_date: pt === "parts" && brand === "HONDA" && /ฮอนด้า/.test(String(r.vendor_name || "")) ? addDaysIso(docDate.slice(0, 8) + "01", 32).slice(0, 8) + "15" : addDaysIso(docDate, AP_SOURCES[pt].term),
          amount: r2(r.amount), paid_date: paid ? ((pay && pay.date) || "0000-00-00") : "", paid_ref: (pay && pay.no) || "",
          desc: pt === "vehicle" ? `${brand} · ${Number(r.qty) || 0} คัน${r.model ? " · " + String(r.model).slice(0, 60) : ""}` : `${brand}`,
          ref: "", employee: false,
        });
      }
    });
  }
  return docs;
}

/** เอกสารที่ยังเป็นเจ้าหนี้ ณ วันที่ asOf + ช่องอายุหนี้ */
export function payablesAsOf(docs, asOf, { company = "", source = "", includeOld = false, includeEmployee = false, basis = "due" } = {}) {
  return docs
    .filter((d) => d.doc_date && d.doc_date <= asOf && (!d.paid_date || d.paid_date > asOf))
    .filter((d) => (includeOld || d.doc_date >= AP_START) && (includeEmployee || !d.employee))
    .filter((d) => (!company || d.company === company) && (!source || d.source === source))
    .filter((d) => Math.abs(d.amount) > 0.004)
    .map((d) => {
      const over = dayDiff(asOf, basis === "doc" ? d.doc_date : d.due_date); // จำนวนวันที่เกิน (≤ 0 = ยังไม่เกิน)
      const bucket = over <= 0 ? "current" : over <= 30 ? "d30" : over <= 60 ? "d60" : over <= 90 ? "d90" : "over";
      return { ...d, overdue_days: over, bucket };
    });
}

/** จัดกลุ่ม สังกัด → ผู้จำหน่าย พร้อมยอดรวมรายช่องอายุหนี้ */
export function groupPayables(rows) {
  const sumOf = (list) => {
    const s = { amount: 0, current: 0, d30: 0, d60: 0, d90: 0, over: 0, count: list.length };
    for (const d of list) { s.amount += d.amount; s[d.bucket] += d.amount; }
    for (const k of Object.keys(s)) if (k !== "count") s[k] = r2(s[k]);
    return s;
  };
  const companies = [...new Set(rows.map((d) => d.company || ""))].sort((a, b) => (AP_COMPANIES.indexOf(a) + 99 * (AP_COMPANIES.indexOf(a) < 0)) - (AP_COMPANIES.indexOf(b) + 99 * (AP_COMPANIES.indexOf(b) < 0)) || a.localeCompare(b, "th"));
  return {
    total: sumOf(rows),
    companies: companies.map((c) => {
      const list = rows.filter((d) => (d.company || "") === c);
      const vendors = [...new Set(list.map((d) => d.vendor))].sort((a, b) => a.localeCompare(b, "th"));
      return {
        company: c, total: sumOf(list),
        vendors: vendors.map((v) => {
          const docsOf = list.filter((d) => d.vendor === v).sort((a, b) => a.doc_date.localeCompare(b.doc_date) || a.doc_no.localeCompare(b.doc_no));
          return { vendor: v, total: sumOf(docsOf), docs: docsOf };
        }),
      };
    }),
  };
}
