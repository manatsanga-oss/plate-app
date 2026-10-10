// หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) สำหรับ "ค่านำพา" ที่จ่ายผู้แนะนำ/ผู้นำพา — หัก 3% (user 2026-10-10)
// ใช้ร่วม 2 หน้า: บันทึกขาย NEW (SaleWizardPage) และบันทึกขายปลีก (RetailSalePage) — ข้อมูลผู้รับเงินเก็บใน retail_sales.delivery_payee_*
export const DELIVERY_WHT_RATE = 3; // % ค่านายหน้า/ค่านำพา ตามมาตรา 40(2) — ตรง DeliveryFeePage (user 2026-08-29)

// บริษัทผู้จ่าย (ผู้มีหน้าที่หักภาษี) ตามสาขา: SCY05/06 = ป.เปา, อื่น ๆ (SCY01/04/07) = สิงห์ชัย
export function companyForBranch(branchCode) {
  const bc = String(branchCode || "").trim().toUpperCase().slice(0, 5);
  if (bc === "SCY05" || bc === "SCY06") {
    return { name: "บริษัท ป.เปามอเตอร์เซอร์วิส จำกัด", branch: "สำนักงานใหญ่", taxId: "0145546000707", addr: "189-191 ม.7 ต.ลำไทร อ.วังน้อย จ.พระนครศรีอยุธยา 13170" };
  }
  return { name: "หจก. สิงห์ชัย สยามยนต์", branch: "สำนักงานใหญ่", taxId: "0143543001310", addr: "34 หมู่ 7 ซอย 10 ต.ลำไทร อ.วังน้อย จ.พระนครศรีอยุธยา 13170" };
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
export function buildDeliveryWhtCertHtml(sale, opts = {}) {
  const co = companyForBranch(sale.branch_code || sale.sale_no);
  const amount = Number(sale.delivery_fee_amount) || 0;
  const wht = whtOfDelivery(amount);
  const payee = {
    name: sale.delivery_payee_name || "-", taxId: sale.delivery_payee_tax_id || "", addr: sale.delivery_payee_address || "", phone: sale.delivery_payee_phone || "",
  };
  const docNo = opts.docNo || `WHT-${sale.sale_no}`;
  const date = sale.sale_date || sale.created_at;
  const isCompanyPayee = /^0/.test(String(payee.taxId || "").replace(/\D/g, "")) && String(payee.taxId || "").replace(/\D/g, "").length === 13;
  const pnd = isCompanyPayee ? "ภ.ง.ด.53" : "ภ.ง.ด.3";
  const row = (no, label, dateTxt, amt, tax) => `<tr><td class="c">${no}</td><td>${label}</td><td class="c">${esc(dateTxt)}</td><td class="r">${amt}</td><td class="r">${tax}</td></tr>`;
  const blank = (no, label) => row(no, label, "", "", "");
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>หนังสือรับรองการหักภาษี ณ ที่จ่าย ${esc(docNo)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: Tahoma, sans-serif; font-size: 12.5px; color: #111; margin: 0; }
  .sheet { width: 186mm; margin: 0 auto; }
  h1 { font-size: 17px; text-align: center; margin: 2px 0 0; }
  .sub { text-align: center; font-size: 12px; color: #333; margin-bottom: 8px; }
  .box { border: 1px solid #000; padding: 6px 8px; margin-top: -1px; }
  .box .ttl { font-weight: 700; }
  .box .line { margin: 3px 0; }
  .tb { display: inline-flex; gap: 1px; vertical-align: middle; margin-left: 6px; }
  .tb i { font-style: normal; display: inline-block; width: 13px; height: 17px; border: 1px solid #000; text-align: center; font-size: 12px; line-height: 17px; }
  .hd { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
  .hd .no { border: 1px solid #000; padding: 4px 8px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: -1px; }
  th, td { border: 1px solid #000; padding: 4px 6px; font-size: 12px; }
  th { background: #f3f4f6; font-weight: 700; }
  td.c { text-align: center; } td.r { text-align: right; }
  .chk { display: inline-block; width: 11px; height: 11px; border: 1px solid #000; vertical-align: middle; margin-right: 4px; text-align: center; line-height: 11px; font-size: 10px; }
  .foot { margin-top: 8px; display: flex; justify-content: space-between; gap: 16px; }
  .sign { text-align: center; width: 48%; margin-top: 18px; }
  .sign .ln { border-bottom: 1px dotted #000; height: 30px; margin: 0 20px 4px; }
  .small { font-size: 11px; color: #333; }
  @media print { .noprint { display: none; } }
</style></head><body><div class="sheet">
  <div class="hd">
    <div class="small">ฉบับที่ 1 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)<br>ฉบับที่ 2 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน)</div>
    <div class="no">เล่มที่ ........ &nbsp; เลขที่ <b>${esc(docNo)}</b></div>
  </div>
  <h1>หนังสือรับรองการหักภาษี ณ ที่จ่าย</h1>
  <div class="sub">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>

  <div class="box">
    <div class="ttl">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :</div>
    <div class="line">ชื่อ <b>${esc(co.name)}</b> &nbsp; (${esc(co.branch)}) &nbsp;&nbsp; เลขประจำตัวผู้เสียภาษีอากร ${taxBoxes(co.taxId)}</div>
    <div class="line">ที่อยู่ ${esc(co.addr)}</div>
  </div>
  <div class="box">
    <div class="ttl">ผู้ถูกหักภาษี ณ ที่จ่าย :</div>
    <div class="line">ชื่อ <b>${esc(payee.name)}</b> &nbsp;&nbsp; เลขประจำตัวผู้เสียภาษีอากร / เลขบัตรประชาชน ${taxBoxes(payee.taxId)}</div>
    <div class="line">ที่อยู่ ${esc(payee.addr || "-")}${payee.phone ? ` &nbsp; โทร. ${esc(payee.phone)}` : ""}</div>
    <div class="line small">ลำดับที่ .......... ในแบบ &nbsp;
      <span class="chk">${pnd === "ภ.ง.ด.3" ? "✓" : ""}</span>ภ.ง.ด.3 &nbsp;
      <span class="chk">${pnd === "ภ.ง.ด.53" ? "✓" : ""}</span>ภ.ง.ด.53 &nbsp;
      <span class="chk"></span>ภ.ง.ด.1ก &nbsp; <span class="chk"></span>ภ.ง.ด.2 &nbsp; <span class="chk"></span>ภ.ง.ด.2ก</div>
  </div>

  <table>
    <thead><tr><th style="width:5%">ลำดับ</th><th>ประเภทเงินได้พึงประเมินที่จ่าย</th><th style="width:19%">วัน เดือน ปี ที่จ่าย</th><th style="width:15%">จำนวนเงินที่จ่าย</th><th style="width:14%">ภาษีที่หักและนำส่งไว้</th></tr></thead>
    <tbody>
      ${blank(1, "เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40(1)")}
      ${row(2, `ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40(2) <span class="small">— ค่านำพา รถ ${esc(sale.model_name || sale.model_code || "")} ${esc(sale.engine_no ? "เลขเครื่อง " + sale.engine_no : "")} ใบขาย ${esc(sale.sale_no)} (หัก ${DELIVERY_WHT_RATE}%)</span>`, thaiDate(date), money(amount), money(wht))}
      ${blank(3, "ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40(3)")}
      ${blank(4, "ดอกเบี้ย เงินปันผล ฯลฯ ตามมาตรา 40(4)")}
      ${blank(5, "การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากร (ค่าบริการ ค่าจ้างทำของ ค่าโฆษณา ค่าขนส่ง ฯลฯ)")}
      ${blank(6, "อื่น ๆ")}
      <tr><td colspan="3" class="r"><b>รวมเงินที่จ่ายและภาษีที่หักนำส่ง</b></td><td class="r"><b>${money(amount)}</b></td><td class="r"><b>${money(wht)}</b></td></tr>
      <tr><td colspan="5">รวมเงินภาษีที่หักนำส่ง (ตัวอักษร) &nbsp; <b>${esc(bahtText(wht))}</b></td></tr>
    </tbody>
  </table>

  <div class="box">
    <div class="line">เงินที่จ่ายเข้า &nbsp; <span class="chk"></span>กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน ........ บาท &nbsp; <span class="chk"></span>กองทุนประกันสังคม ........ บาท &nbsp; <span class="chk"></span>กองทุนสำรองเลี้ยงชีพ ........ บาท</div>
    <div class="line">ผู้จ่ายเงิน &nbsp; <span class="chk">✓</span>(1) หัก ณ ที่จ่าย &nbsp; <span class="chk"></span>(2) ออกให้ตลอดไป &nbsp; <span class="chk"></span>(3) ออกให้ครั้งเดียว &nbsp; <span class="chk"></span>(4) อื่น ๆ</div>
  </div>

  <div class="foot">
    <div class="small" style="width:50%">
      <b>คำเตือน</b> ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร<br><br>
      จ่ายสุทธิให้ผู้รับ ${money(amount - wht)} บาท (ค่านำพา ${money(amount)} − ภาษีหัก ณ ที่จ่าย ${money(wht)})
    </div>
    <div class="sign">
      <div>ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</div>
      <div class="ln"></div>
      <div>ลงชื่อ ผู้จ่ายเงิน</div>
      <div class="small">${esc(thaiDate(date))} &nbsp; (วัน เดือน ปี ที่ออกหนังสือรับรอง)</div>
      <div class="small">ประทับตรานิติบุคคล (ถ้ามี)</div>
    </div>
  </div>
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
