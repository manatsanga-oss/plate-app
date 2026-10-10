// หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) สำหรับ "ค่านำพา" ที่จ่ายผู้แนะนำ/ผู้นำพา — หัก 3% (user 2026-10-10)
// ใช้ร่วม 2 หน้า: บันทึกขาย NEW (SaleWizardPage) และบันทึกขายปลีก (RetailSalePage) — ข้อมูลผู้รับเงินเก็บใน retail_sales.delivery_payee_*
export const DELIVERY_WHT_RATE = 3; // % ค่านายหน้า/ค่านำพา ตามมาตรา 40(2) — ตรง DeliveryFeePage (user 2026-08-29)

// บริษัทผู้จ่าย (ผู้มีหน้าที่หักภาษี) ตามสาขา: SCY05/06 = ป.เปา, อื่น ๆ (SCY01/04/07) = สิงห์ชัย
export function companyForBranch(branchCode) {
  const bc = String(branchCode || "").trim().toUpperCase().slice(0, 5);
  if (bc === "SCY05" || bc === "SCY06") {
    return { name: "บริษัท ป.เปามอเตอร์เซอร์วิส จำกัด", branch: "สำนักงานใหญ่", taxId: "0145546000707", addr: "189-191 ม.7 ต.ลำไทร อ.วังน้อย จ.พระนครศรีอยุธยา 13170" };
  }
  return { name: "หจก. สิงห์ชัย สยามยนต์", branch: "สำนักงานใหญ่", taxId: "0143543001310", addr: "295-299 หมู่ 7 ต.ลำไทร อ.วังน้อย จ.พระนครศรีอยุธยา 13170" }; // ที่อยู่ สนญ. ใหม่ ตาม branch_master SCY01 (user 2026-10-10)
}

export const whtOfDelivery = (amount) => Math.round((Number(amount) || 0) * DELIVERY_WHT_RATE) / 100;

// จำนวนเงินเป็นตัวอักษรไทย
export function bahtText(n) {
  const num = Math.round((Number(n) || 0) * 100) / 100;
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  const readInt = (s) => {
    let out = "";
    const len = s.length;
    for (let i = 0; i < len; i++) {
      const d = Number(s[i]); const pos = len - i - 1;
      if (d === 0) continue;
      if (pos % 6 === 1 && d === 1) out += "สิบ";
      else if (pos % 6 === 1 && d === 2) out += "ยี่สิบ";
      else if (pos % 6 === 0 && d === 1 && len > 1 && i > 0) out += "เอ็ด";
      else out += digits[d] + units[pos % 6];
      if (pos % 6 === 0 && pos > 0) out += "ล้าน";
    }
    return out;
  };
  const intPart = Math.floor(num); const satang = Math.round((num - intPart) * 100);
  let t = intPart === 0 ? (satang === 0 ? "ศูนย์บาท" : "") : readInt(String(intPart)) + "บาท";
  if (satang === 0) t += intPart === 0 ? "ถ้วน" : "ถ้วน";
  else t += readInt(String(satang)) + "สตางค์";
  return t;
}

const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
const money = (n) => (Number(n) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thaiDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(String(iso).length <= 10 ? iso + "T00:00:00" : iso);
  return isNaN(d) ? String(iso).slice(0, 10) : d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
};
const taxBoxes = (id) => {
  const s = String(id || "").replace(/\D/g, "").slice(0, 13).padEnd(13, " ");
  return `<span class="tb">${[...s].map((c) => `<i>${c.trim() ? esc(c) : "&nbsp;"}</i>`).join("")}</span>`;
};

// sale: แถว retail_sales (ต้องมี sale_no, sale_date, branch_code, delivery_fee_amount, delivery_payee_name/tax_id/address)
// ถ้อยคำ/ลำดับรายการตามแบบหนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ ของกรมสรรพากรทุกบรรทัด (user 2026-10-10)
export function buildDeliveryWhtCertHtml(sale, opts = {}) {
  const co = companyForBranch(sale.branch_code || sale.sale_no);
  const amount = Number(sale.delivery_fee_amount) || 0;
  const wht = whtOfDelivery(amount);
  const payee = {
    name: sale.delivery_payee_name || "-", taxId: sale.delivery_payee_tax_id || "", addr: sale.delivery_payee_address || "", phone: sale.delivery_payee_phone || "",
  };
  const docNo = opts.docNo || `WHT-${sale.sale_no}`;
  const date = sale.sale_date || sale.created_at;
  const payeeDigits = String(payee.taxId || "").replace(/\D/g, "");
  const isCompanyPayee = payeeDigits.length === 13 && /^0/.test(payeeDigits);
  const pnd = isCompanyPayee ? "ภ.ง.ด.53" : "ภ.ง.ด.3";
  const chk = (on) => `<span class="chk">${on ? "✓" : ""}</span>`;
  const dots = (n = 10) => ".".repeat(n);
  // แถวรายการ: no (ลำดับ) อาจว่างสำหรับข้อย่อย
  const row = (no, label, dateTxt = "", amt = "", tax = "", cls = "") =>
    `<tr class="${cls}"><td class="c">${no}</td><td>${label}</td><td class="c">${esc(dateTxt)}</td><td class="r">${amt}</td><td class="r">${tax}</td></tr>`;
  const sub = (label) => row("", `<span class="sub">${label}</span>`);
  const sub2 = (label) => row("", `<span class="sub2">${label}</span>`);
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>หนังสือรับรองการหักภาษี ณ ที่จ่าย ${esc(docNo)}</title>
<style>
  @page { size: A4; margin: 10mm 12mm; }
  body { font-family: Tahoma, sans-serif; font-size: 12px; color: #111; margin: 0; }
  .sheet { width: 186mm; margin: 0 auto; }
  h1 { font-size: 17px; text-align: center; margin: 2px 0 0; }
  .subttl { text-align: center; font-size: 12px; color: #333; margin-bottom: 6px; }
  .box { border: 1px solid #000; padding: 5px 8px; margin-top: -1px; }
  .box .ttl { font-weight: 700; }
  .box .line { margin: 2px 0; }
  .hint { font-size: 10px; color: #444; }
  .tb { display: inline-flex; gap: 1px; vertical-align: middle; margin-left: 6px; }
  .tb i { font-style: normal; display: inline-block; width: 13px; height: 17px; border: 1px solid #000; text-align: center; font-size: 12px; line-height: 17px; }
  .hd { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
  .hd .no { border: 1px solid #000; padding: 4px 8px; font-size: 12px; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; margin-top: -1px; }
  th, td { border: 1px solid #000; padding: 2px 5px; font-size: 11.5px; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 700; text-align: center; }
  td.c { text-align: center; } td.r { text-align: right; }
  tr.main td { padding-top: 3px; padding-bottom: 3px; }
  .sub { display: block; padding-left: 14px; font-size: 11px; }
  .sub2 { display: block; padding-left: 34px; font-size: 10.5px; color: #222; }
  .chk { display: inline-block; width: 11px; height: 11px; border: 1px solid #000; vertical-align: middle; margin-right: 3px; text-align: center; line-height: 11px; font-size: 10px; }
  .foot { margin-top: 6px; display: flex; justify-content: space-between; gap: 16px; }
  .sign { text-align: center; width: 50%; }
  .sign .ln { border-bottom: 1px dotted #000; height: 26px; margin: 10px 20px 4px; }
  .small { font-size: 10.5px; color: #333; }
  .note { font-size: 10px; color: #333; margin-top: 6px; border-top: 1px solid #999; padding-top: 3px; }
  @media print { .noprint { display: none; } }
</style></head><body><div class="sheet">
  <div class="hd">
    <div class="small">ฉบับที่ 1 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)<br>ฉบับที่ 2 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน)</div>
    <div class="no">เล่มที่ ${dots(8)} &nbsp; เลขที่ <b>${esc(docNo)}</b></div>
  </div>
  <h1>หนังสือรับรองการหักภาษี ณ ที่จ่าย</h1>
  <div class="subttl">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>

  <div class="box">
    <div class="ttl">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :-</div>
    <div class="line">ชื่อ <b>${esc(co.name)}</b> &nbsp;(${esc(co.branch)}) <span class="hint">(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</span></div>
    <div class="line">ที่อยู่ ${esc(co.addr)} <span class="hint">(ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</span></div>
    <div class="line">เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)* ${taxBoxes(co.taxId)}</div>
  </div>
  <div class="box">
    <div class="ttl">ผู้ถูกหักภาษี ณ ที่จ่าย :-</div>
    <div class="line">ชื่อ <b>${esc(payee.name)}</b> <span class="hint">(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</span></div>
    <div class="line">ที่อยู่ ${esc(payee.addr || "-")}${payee.phone ? ` &nbsp; โทร. ${esc(payee.phone)}` : ""} <span class="hint">(ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</span></div>
    <div class="line">เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)* ${taxBoxes(payee.taxId)}</div>
    <div class="line">ลำดับที่ ${dots(10)} ในแบบ &nbsp;
      ${chk(false)}(1) ภ.ง.ด.1ก &nbsp; ${chk(false)}(2) ภ.ง.ด.1ก พิเศษ &nbsp; ${chk(false)}(3) ภ.ง.ด.2 &nbsp; ${chk(pnd === "ภ.ง.ด.3")}(4) ภ.ง.ด.3<br>
      ${chk(false)}(5) ภ.ง.ด.2ก &nbsp; ${chk(false)}(6) ภ.ง.ด.3ก &nbsp; ${chk(pnd === "ภ.ง.ด.53")}(7) ภ.ง.ด.53
      <span class="hint">(ให้สามารถอ้างอิงหรือสอบยันกันได้ระหว่างลำดับที่ตามหนังสือรับรองฯ กับแบบยื่นรายการภาษีหักที่จ่าย)</span></div>
  </div>

  <table>
    <thead><tr><th style="width:4%"></th><th>ประเภทเงินได้พึงประเมินที่จ่าย</th><th style="width:17%">วัน เดือน<br>หรือปีภาษี ที่จ่าย</th><th style="width:14%">จำนวนเงินที่จ่าย</th><th style="width:14%">ภาษีที่หัก<br>และนำส่งไว้</th></tr></thead>
    <tbody>
      ${row("1.", "เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)", "", "", "", "main")}
      ${row("2.", `ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)<br><span class="hint">ค่านำพา รถ ${esc(sale.model_name || sale.model_code || "")}${sale.engine_no ? " เลขเครื่อง " + esc(sale.engine_no) : ""} ใบขาย ${esc(sale.sale_no)} (หัก ${DELIVERY_WHT_RATE}%)</span>`, thaiDate(date), money(amount), money(wht), "main")}
      ${row("3.", "ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)", "", "", "", "main")}
      ${row("4.", "(ก) ค่าดอกเบี้ย ฯลฯ ตามมาตรา 40 (4) (ก)", "", "", "", "main")}
      ${row("", "(ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4) (ข)")}
      ${sub("(1) กรณีผู้ได้รับเงินปันผลได้รับเครดิตภาษี โดยจ่ายจาก กำไรสุทธิของกิจการที่ต้องเสียภาษีเงินได้นิติบุคคลในอัตราดังนี้")}
      ${sub2("(1.1) อัตราร้อยละ 30 ของกำไรสุทธิ")}
      ${sub2("(1.2) อัตราร้อยละ 25 ของกำไรสุทธิ")}
      ${sub2("(1.3) อัตราร้อยละ 20 ของกำไรสุทธิ")}
      ${sub2("(1.4) อัตราอื่น ๆ (ระบุ) " + dots(12) + " ของกำไรสุทธิ")}
      ${sub("(2) กรณีผู้ได้รับเงินปันผลไม่ได้รับเครดิตภาษี เนื่องจากจ่ายจาก")}
      ${sub2("(2.1) กำไรสุทธิของกิจการที่ได้รับยกเว้นภาษีเงินได้นิติบุคคล")}
      ${sub2("(2.2) เงินปันผลหรือเงินส่วนแบ่งของกำไรที่ได้รับยกเว้นไม่ต้องนำมารวมคำนวณเป็นรายได้เพื่อเสียภาษีเงินได้นิติบุคคล")}
      ${sub2("(2.3) กำไรสุทธิส่วนที่ได้หักผลขาดทุนสุทธิยกมาไม่เกิน 5 ปี ก่อนรอบระยะเวลาบัญชีปีปัจจุบัน")}
      ${sub2("(2.4) กำไรที่รับรู้ทางบัญชีโดยวิธีส่วนได้เสีย (equity method)")}
      ${sub2("(2.5) อื่น ๆ (ระบุ) " + dots(30))}
      ${row("5.", "การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา 3 เตรส เช่น รางวัล ส่วนลดหรือประโยชน์ใด ๆ เนื่องจากการส่งเสริมการขาย รางวัลในการประกวด การแข่งขัน การชิงโชค ค่าแสดงของนักแสดงสาธารณะ ค่าจ้างทำของ ค่าโฆษณา ค่าเช่า ค่าขนส่ง ค่าบริการ ค่าเบี้ยประกันวินาศภัย ฯลฯ", "", "", "", "main")}
      ${row("6.", "อื่น ๆ (ระบุ) " + dots(40), "", "", "", "main")}
      <tr><td colspan="3" class="r"><b>รวมเงินที่จ่ายและภาษีที่หักนำส่ง</b></td><td class="r"><b>${money(amount)}</b></td><td class="r"><b>${money(wht)}</b></td></tr>
      <tr><td colspan="5">รวมเงินภาษีที่หักนำส่ง (ตัวอักษร) &nbsp; <b>${esc(bahtText(wht))}</b></td></tr>
    </tbody>
  </table>

  <div class="box">
    <div class="line">เงินที่จ่ายเข้า &nbsp; ${chk(false)}กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน ${dots(8)} บาท &nbsp; ${chk(false)}กองทุนประกันสังคม ${dots(8)} บาท &nbsp; ${chk(false)}กองทุนสำรองเลี้ยงชีพ ${dots(8)} บาท</div>
    <div class="line">ผู้จ่ายเงิน &nbsp; ${chk(true)}(1) หัก ณ ที่จ่าย &nbsp; ${chk(false)}(2) ออกให้ตลอดไป &nbsp; ${chk(false)}(3) ออกให้ครั้งเดียว &nbsp; ${chk(false)}(4) อื่น ๆ (ระบุ) ${dots(14)}</div>
  </div>

  <div class="foot">
    <div class="small" style="width:48%">
      <b>คำเตือน</b> ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร<br><br>
      จ่ายสุทธิให้ผู้รับ ${money(amount - wht)} บาท (ค่านำพา ${money(amount)} − ภาษีหัก ณ ที่จ่าย ${money(wht)})
    </div>
    <div class="sign">
      <div>ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</div>
      <div class="ln"></div>
      <div>ลงชื่อ ${dots(24)} ผู้จ่ายเงิน</div>
      <div class="small">${esc(thaiDate(date))} &nbsp; (วัน เดือน ปี ที่ออกหนังสือรับรอง)</div>
      <div class="small">ประทับตรานิติบุคคล (ถ้ามี)</div>
    </div>
  </div>
  <div class="note"><b>หมายเหตุ</b> เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)* หมายถึง 1. กรณีบุคคลธรรมดาไทย ให้ใช้เลขประจำตัวประชาชนของกรมการปกครอง 2. กรณีนิติบุคคล ให้ใช้เลขทะเบียนนิติบุคคลของกรมพัฒนาธุรกิจการค้า 3. กรณีอื่น ๆ นอกเหนือจาก 1. และ 2. ให้ใช้เลขประจำตัวผู้เสียภาษีอากร (13 หลัก) ของกรมสรรพากร</div>
  <div class="noprint" style="text-align:center;margin-top:12px"><button onclick="window.print()" style="padding:8px 18px;font-size:14px">🖨️ พิมพ์</button></div>
</div></body></html>`;
}

export function openPrintHtml(html, onBlocked) {
  const w = window.open("", "_blank", "width=860,height=960");
  if (!w) { if (onBlocked) onBlocked(); return false; }
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 350);
  return true;
}
