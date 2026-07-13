// สลิปเงินเดือน/ค่าคอม — ตัวสร้าง HTML สลิปแบบฟอร์มมาตรฐาน 3 คอลัมน์ (ใช้ร่วมกันหลายหน้า)
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const HR_API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/hr-api";

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

// สร้าง PDF สลิป 1 คน (A4 แนวนอน) → คืน base64 (ไม่มี data: prefix)
export async function slipPdfBase64(spec) {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-11000px;top:0;width:1100px;background:#fff;z-index:-1;";
  host.innerHTML = `<style>${SLIP_CSS.replace(/body \{/, ".slip-pdf-root {")}</style><div class="slip-pdf-root" style="font-family:'Sarabun',Tahoma,sans-serif;color:#111;">${buildSlipHtml(spec)}</div>`;
  // ปรับความกว้างสลิปให้พอดี container ตอน render เป็นภาพ
  document.body.appendChild(host);
  const slipEl = host.querySelector(".slip");
  slipEl.style.width = "1060px";
  slipEl.style.padding = "24px 28px";
  slipEl.style.pageBreakAfter = "auto";
  try {
    const canvas = await html2canvas(slipEl, { scale: 2, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = 297, pageH = 210, margin = 8;
    const maxW = pageW - margin * 2, maxH = pageH - margin * 2;
    let w = maxW;
    let h = (canvas.height / canvas.width) * w;
    if (h > maxH) { h = maxH; w = (canvas.width / canvas.height) * h; }
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, w, h);
    return pdf.output("datauristring").split(",")[1];
  } finally {
    document.body.removeChild(host);
  }
}

// สร้าง PDF + ส่งอีเมลผ่าน n8n (action send_payslip) — คืน result จาก backend
export async function sendSlipEmail({ spec, email, slipType, periodLabel, saveGroup, sentBy, docLabel = "สลิปเงินเดือน" }) {
  const pdfBase64 = await slipPdfBase64(spec);
  const safeName = String(spec.name || "slip").replace(/[\\/:*?"<>|\s]+/g, "_");
  const res = await fetch(HR_API_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "send_payslip",
      to_email: email,
      employee_name: spec.name,
      subject: `${docLabel} ${periodLabel} — ${spec.company}`,
      body_text: `เรียน คุณ${spec.name}\n\nแนบ${docLabel}งวด ${periodLabel} ของ ${spec.company} มาพร้อมอีเมลนี้\n\nเอกสารนี้เป็นข้อมูลส่วนบุคคล กรุณาอย่าเปิดเผยต่อผู้อื่น`,
      file_name: `slip_${safeName}_${String(periodLabel).replace(/\s+/g, "_")}.pdf`,
      pdf_base64: pdfBase64,
      slip_type: slipType,
      period_label: periodLabel,
      save_group: saveGroup || "",
      sent_by: sentBy || "",
    }),
  });
  const data = await res.json();
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.error || result.status === "error") {
    throw new Error(result?.error || result?.error_msg || "ส่งไม่สำเร็จ");
  }
  return result;
}

// ดึงประวัติการส่งของงวด (action payslip_send_log)
export async function fetchSlipSendLog(slipType, periodLabel) {
  try {
    const res = await fetch(HR_API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "payslip_send_log", slip_type: slipType, period_label: periodLabel }),
    });
    const data = await res.json();
    return Array.isArray(data) ? data.filter(r => r && r.employee_name) : [];
  } catch { return []; }
}

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
