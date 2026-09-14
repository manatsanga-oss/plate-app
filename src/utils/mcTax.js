// ===== งานต่อภาษี (เฉพาะมอเตอร์ไซค์) — ภาษีรายปี + เงินเพิ่ม 1%/เดือน + เกณฑ์ตรวจสภาพตามประกาศขนส่งฯ =====
// ใช้ร่วมกัน 2 หน้า: หน้ารับเรื่อง (RegistrationReceiptEntryPage — คิดเหมา ไม่คิดเงินเพิ่ม)
// และหน้าวางบิล (ReceiptBillingPage — คิดเงินเพิ่มจริงจากวันที่ส่งเรื่องขนส่ง) — user 2026-09-14
export const MC_TAX_PER_YEAR = 100; // ภาษี จยย. ส่วนบุคคล (รย.12) ปีละ 100 บาท
export const MC_TRO_FEE = 60;       // ค่าตรวจสภาพ ตรอ. จยย.
export const MC_TRO_AGE = 5;        // จยย. อายุครบ 5 ปีขึ้นไปต้องตรวจสภาพ
export const MC_RENEW_FLAT = 200;   // ยอดเก็บลูกค้าเหมา ต่อภาษี 200 บาท/ปี (ภาษี 100 + ค่าบริการ)
export const MC_TRO_FLAT = 250;     // ยอดเก็บลูกค้าเหมา ตรวจสภาพ 250 (ตรอ. 60 + ค่าบริการ 190)
export const MC_BILL_SERVICE_FEE = 20; // ค่าบริการที่วางบิลคนเดินเรื่องต่อคัน (บวกจากยอดขนส่งเก็บจริง)

// format วันที่แบบ local (ห้ามใช้ toISOString — โซนเวลาไทยจะเลื่อนถอยหลัง 1 วัน)
export const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// วันพฤหัสบดีถัดไปหลังวันที่ระบุ (ร้านส่งขนส่งทุกพฤหัส ภายใน 1 สัปดาห์หลังรับเรื่อง)
export function nextThursday(iso) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 4);
  return localISO(d);
}

// นับเดือนล่าช้าแบบขนส่งฯ: เศษของเดือนนับเป็น 1 เดือน (ยื่นก่อน/ตรงวันสิ้นอายุ = 0)
export function monthsLate(dueISO, payISO) {
  const due = new Date(dueISO + "T00:00:00"), pay = new Date(payISO + "T00:00:00");
  if (isNaN(due) || isNaN(pay) || pay <= due) return 0;
  let m = (pay.getFullYear() - due.getFullYear()) * 12 + (pay.getMonth() - due.getMonth());
  if (pay.getDate() > due.getDate()) m += 1;
  return Math.max(m, 1);
}

// คำนวณภาษีค้าง + เงินเพิ่มรายปี + ธงตรวจสภาพ
// registerISO = วันจดทะเบียน, expireISO = วันสิ้นอายุภาษีเดิม, payISO = วันที่ยื่นขนส่ง (จริง/คาดว่า)
// ไม่มีการเผื่อวัน (เคยเผื่อ 7 วัน → ยกเลิก 2026-09-14): ขนส่งคิดเงินเพิ่มตามวันยื่นจริงเท่านั้น
export function calcMcTax(registerISO, expireISO, payISO) {
  const expire = new Date(expireISO + "T00:00:00");
  const pay = new Date(payISO + "T00:00:00");
  if (isNaN(expire) || isNaN(pay)) return null;
  // ไล่ทีละปีภาษีที่ครบกำหนดแล้วยังไม่จ่าย (due < วันยื่น)
  const years = [];
  let due = new Date(expire);
  while (due < pay) {
    const dueISO2 = localISO(due);
    const m = monthsLate(dueISO2, payISO);
    years.push({ due: dueISO2, months: m, surcharge: MC_TAX_PER_YEAR * 0.01 * m });
    due.setFullYear(due.getFullYear() + 1);
  }
  const lateYears = years.length;                       // จำนวนปีภาษีที่ต้องจ่าย (ค้าง)
  const taxTotal = (lateYears || 1) * MC_TAX_PER_YEAR;  // ไม่ค้างเลย = ต่อล่วงหน้า 1 ปี
  const surcharge = Math.round(years.reduce((s, y) => s + y.surcharge, 0) * 100) / 100;
  if (lateYears === 0) due.setFullYear(due.getFullYear() + 1); // ต่อล่วงหน้า → รอบใหม่ = สิ้นอายุเดิม + 1 ปี
  const newExpire = localISO(due);                      // วันสิ้นอายุภาษีรอบใหม่หลังต่อครบ
  // อายุรถ ณ วันสิ้นอายุภาษีรอบใหม่ (เกณฑ์ ตรอ.)
  let age = null, needTro = false;
  if (registerISO) {
    const reg = new Date(registerISO + "T00:00:00");
    if (!isNaN(reg)) {
      age = new Date(newExpire + "T00:00:00").getFullYear() - reg.getFullYear();
      needTro = age >= MC_TRO_AGE;
    }
  }
  const overYear = lateYears >= 2 || (lateYears === 1 && monthsLate(years[0]?.due, payISO) > 12); // ขาดเกิน 1 ปี
  const suspended = lateYears > 3;                      // ขาดเกิน 3 ปี = ทะเบียนระงับ
  return { lateYears, taxTotal, surcharge, newExpire, age, needTro, overYear, suspended, months: years[0]?.months || 0 };
}
