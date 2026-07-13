// สลิปเงินเดือน/ค่าคอม — ตัวสร้าง HTML สลิปแบบฟอร์มมาตรฐาน 3 คอลัมน์ (ใช้ร่วมกันหลายหน้า)
export const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export const SLIP_COMPANY = {
  "ป.เปา": "บริษัท ป.เปา มอเตอร์เซอร์วิส จำกัด",
  "สิงห์ชัย": "ห้างหุ้นส่วนจำกัด สิงห์ชัยสยามยนต์",
};

export function fmtMoney(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function slipDateLabel(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt)) return String(d).slice(0, 10);
  return `${dt.getDate()} ${TH_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

// spec = { company, name, code, position, periodLabel, paidLabel, bankAccount, year,
//          earnings: [[label, en, amt], ...], deductions: [...], ytd: [...], totals: [...] }
export function buildSlipHtml(s) {
  const cell = ([label, en, amt]) => `
    <tr><td class="lb">${label}<div class="en">${en}</div></td><td class="amt">${fmtMoney(amt)}</td></tr>`;
  return `
  <div class="slip">
    <div class="head">
      <div class="co">${s.company}</div>
      <div class="title">สลิปเงินเดือน / Pay Slip</div>
    </div>
    <table class="meta"><tbody>
      <tr>
        <td class="lb">ชื่อนามสกุล(รหัส)<div class="en">Emp. name (Code)</div></td>
        <td><b>${s.name || "-"}</b>${s.code ? ` (${s.code})` : ""}</td>
        <td class="lb">รอบเงินเดือน<div class="en">Payroll Period</div></td>
        <td>${s.periodLabel || "-"}</td>
      </tr>
      <tr>
        <td class="lb">ตำแหน่ง<div class="en">Position</div></td>
        <td>${s.position || "-"}</td>
        <td class="lb">วันที่ชำระ<div class="en">Payment Date</div></td>
        <td>${s.paidLabel || "-"}</td>
      </tr>
      <tr>
        <td class="lb"></td><td></td>
        <td class="lb">เลขที่บัญชี<div class="en">Bank Account</div></td>
        <td>${s.bankAccount || "-"}</td>
      </tr>
    </tbody></table>
    <table class="body"><tbody>
      <tr class="colhead">
        <td>เงินได้<div class="en">Earnings</div></td>
        <td>รายการหัก<div class="en">Deductions</div></td>
        <td>ปี<div class="en">${s.year}</div></td>
      </tr>
      <tr>
        <td><table class="inner"><tbody>${s.earnings.map(cell).join("")}</tbody></table></td>
        <td><table class="inner"><tbody>${s.deductions.map(cell).join("")}</tbody></table></td>
        <td><table class="inner"><tbody>
          ${s.ytd.map(cell).join("")}
          <tr class="sep"><td colspan="2"></td></tr>
          ${s.totals.map(cell).join("")}
        </tbody></table></td>
      </tr>
    </tbody></table>
    <table class="foot"><tbody><tr>
      <td class="lb">หมายเหตุ:<div class="en">Remarks</div></td>
      <td class="sign">ลายเซ็นผู้จ่ายเงิน: <span class="line"></span><div class="en">Employer's Signature</div></td>
    </tr></tbody></table>
    <div class="conf">ข้อมูลเงินเดือนและค่าจ้างเป็นข้อมูลส่วนบุคคล ห้ามเปิดเผยโดยเด็ดขาด เอกสารนี้จะสมบูรณ์เมื่อมีลายเซ็นผู้มีอำนาจลงนามและตราประทับเท่านั้น<br/>
    Salary and wages are confidential information. Disclosure is strictly prohibited. This document is only valid with an authorized signature and company stamp.</div>
  </div>`;
}

export const SLIP_CSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Sarabun', Tahoma, sans-serif; margin: 0; padding: 0; color: #111; }
  .slip { width: 270mm; padding: 10mm 12mm; page-break-after: always; }
  .head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6mm; }
  .co { font-size: 17px; font-weight: 700; }
  .title { font-size: 20px; font-weight: 600; }
  .en { font-size: 9px; color: #555; font-weight: 400; }
  .meta { width: 100%; border-collapse: collapse; margin-bottom: 5mm; font-size: 13px; }
  .meta td { padding: 2px 6px; vertical-align: top; }
  .meta td.lb { width: 16%; }
  .body { width: 100%; border-collapse: collapse; font-size: 13px; }
  .body > tbody > tr > td { border: 1px solid #444; vertical-align: top; width: 33.33%; padding: 0; }
  .colhead td { text-align: center !important; padding: 3px !important; font-weight: 600; }
  .inner { width: 100%; border-collapse: collapse; }
  .inner td { padding: 4px 8px; }
  .inner td.lb { text-align: left; }
  .inner td.amt { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .inner tr.sep td { border-top: 1px solid #444; padding: 0; height: 2px; }
  .lb { font-weight: 600; }
  .foot { width: 100%; margin-top: 6mm; font-size: 13px; }
  .foot td { vertical-align: top; padding: 2px 6px; }
  .sign { text-align: right; }
  .sign .line { display: inline-block; width: 60mm; border-bottom: 1px solid #333; }
  .conf { margin-top: 8mm; padding-top: 3mm; border-top: 1px solid #ccc; text-align: center; font-size: 9px; color: #555; }
  @media print { .slip { width: auto; } }
`;

// specs = array ของ spec ข้างบน — เปิดหน้าต่างพิมพ์ (Save as PDF ได้)
export function printSlips(specs, title) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>${SLIP_CSS}</style></head><body>
    ${specs.map(buildSlipHtml).join("\n")}
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("เบราว์เซอร์บล็อก popup — กรุณาอนุญาต popup สำหรับเว็บนี้"); return; }
  w.document.write(html);
  w.document.close();
}
