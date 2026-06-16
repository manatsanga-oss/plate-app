// ตัวสร้าง/พิมพ์ใบประเมินราคา (ใช้ร่วม: หน้าค้นรูปอะไหล่ + หน้า public /quote-view)
export const QUOTE_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/part-quote-api";

export const COMPANY = {
  name: "บริษัท ป.เปามอเตอร์เซอร์วิส จำกัด - สำนักงานใหญ่",
  addr: "189-191 ม.7 ตำบลลำไทร อำเภอวังน้อย จังหวัดพระนครศรีอยุธยา 13170",
  tel: "(035)271146-7",
  fax: "(035)272613",
  taxid: "0145546000707",
};

const _m = (v) => (Number(v) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const _e = (s) => String(s == null ? "" : s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

export async function quoteApi(body) {
  const res = await fetch(QUOTE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const raw = await res.text();
  return raw.trim() ? JSON.parse(raw) : [];
}

export function nowParts(dt) {
  const d = dt || new Date();
  return {
    date: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`,
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

// แปลง record จาก DB (get_quote) -> data object สำหรับ render
export function recordToQuoteData(rec) {
  const created = rec.created_at ? new Date(rec.created_at) : new Date();
  const np = nowParts(created);
  let items = rec.items || [];
  if (typeof items === "string") { try { items = JSON.parse(items); } catch { items = []; } }
  const laborNet = (Number(rec.labor) || 0) - (Number(rec.labor_discount) || 0);
  const partsNet = (Number(rec.parts_total) || 0) - (Number(rec.parts_discount) || 0);
  return {
    quote_no: rec.quote_no || "", date: np.date, time: np.time, created_by: rec.created_by || "",
    customer_name: rec.customer_name, customer_address: rec.customer_address, customer_phone: rec.customer_phone, customer_tax_id: rec.customer_tax_id,
    model: rec.model || "", color: rec.color || "",
    plate_no: rec.plate_no, model_year: rec.model_year, mileage: rec.mileage, vin: rec.vin, engine_no: rec.engine_no, problem: rec.problem,
    items: (items || []).map((it) => ({ code: it.code, name: it.name, amount: it.amount })),
    labor: Number(rec.labor) || 0, labor_discount: Number(rec.labor_discount) || 0, laborNet,
    parts_total: Number(rec.parts_total) || 0, parts_discount: Number(rec.parts_discount) || 0, partsNet,
    subtotal: Number(rec.subtotal) || 0, vat: Number(rec.vat) || 0, grand_total: Number(rec.grand_total) || 0,
  };
}

// สร้าง HTML เอกสารใบประเมินราคาตามฟอร์ม SVE02015
export function quoteDocHTML(d) {
  let rows = "";
  (d.items || []).forEach((it, i) => {
    rows += `<tr><td class=c>${i + 1}</td><td>${_e(it.code)}</td><td>${_e(it.name)}</td><td class=c>1</td><td class=r>${_m(it.amount)}</td><td class=r>${_m(it.amount)}</td></tr>`;
  });
  if ((Number(d.laborNet) || 0) > 0) rows += `<tr><td class=c>${(d.items || []).length + 1}</td><td>001</td><td>ค่าบริการ</td><td class=c>-</td><td class=r>-</td><td class=r>${_m(d.laborNet)}</td></tr>`;
  return `<!doctype html><html><head><meta charset=utf-8><title>ใบประเมินราคา ${_e(d.quote_no)}</title>
  <style>
  *{box-sizing:border-box;font-family:'Tahoma','TH Sarabun New',sans-serif}
  body{margin:0;padding:14px;color:#b21f7a;font-size:12px}
  .box{border:1px solid #b21f7a;border-radius:4px}
  table{width:100%;border-collapse:collapse}
  .hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
  .hd .co{font-size:11px;color:#333}.hd .co b{font-size:14px;color:#b21f7a}
  .title{text-align:right}.title b{font-size:22px}.title div{font-size:13px}
  .row{display:flex;gap:6px;margin-bottom:6px}.pad{padding:6px 8px}
  .grid td{padding:2px 6px;vertical-align:top;color:#333}.grid td.k{color:#b21f7a;white-space:nowrap}
  .items th{border:1px solid #b21f7a;padding:5px;color:#b21f7a;font-size:11px}
  .items td{border:1px solid #e9b8d4;padding:4px 6px;color:#222;height:20px}
  .c{text-align:center}.r{text-align:right}
  .sum td{padding:3px 8px;color:#333}.sum td.k{color:#b21f7a}
  @media print{body{padding:0}.noprint{display:none}}
  </style></head><body>
  <div class=hd>
    <div class=co><b>${_e(COMPANY.name)}</b><br>${_e(COMPANY.addr)}<br>โทร: ${_e(COMPANY.tel)} แฟกซ์: ${_e(COMPANY.fax)}<br>เลขประจำตัวผู้เสียภาษีอากร: ${_e(COMPANY.taxid)}</div>
    <div class=title><b>ใบประเมินราคา</b><div>Estimate Service Job</div></div>
  </div>
  <div class=row>
    <div class="box pad" style=flex:1.4>
      <div style=color:#b21f7a>ชื่อลูกค้า/ที่อยู่</div>
      <div style=color:#222;margin-top:3px>${_e(d.customer_name) || "&nbsp;"}</div>
      <div style=color:#222>${_e(d.customer_address)}</div>
      <div style=color:#222>โทร: ${_e(d.customer_phone)}${d.customer_tax_id ? " &nbsp; เลขผู้เสียภาษี: " + _e(d.customer_tax_id) : ""}</div>
    </div>
    <div class="box pad" style=flex:1>
      <table class=grid>
        <tr><td class=k>เลขที่ประเมิน</td><td>: ${_e(d.quote_no) || "-"}</td></tr>
        <tr><td class=k>วันที่แจ้ง</td><td>: ${_e(d.date)} เวลา ${_e(d.time)}</td></tr>
        <tr><td class=k>ผู้รับแจ้ง</td><td>: ${_e(d.created_by)}</td></tr>
      </table>
    </div>
  </div>
  <div class=row>
    <div class="box pad" style=flex:1.4><div style=color:#b21f7a>ปัญหา/อาการ/รายการที่สั่งซ่อม</div><div style=color:#222;min-height:34px;margin-top:3px>${_e(d.problem)}</div></div>
    <div class="box pad" style=flex:1>
      <table class=grid>
        <tr><td class=k>รุ่น</td><td>: ${_e(d.model)}</td><td class=k>สี</td><td>: ${_e(d.color)}</td></tr>
        <tr><td class=k>ทะเบียนรถ</td><td>: ${_e(d.plate_no)}</td><td class=k>รุ่นปี</td><td>: ${_e(d.model_year)}</td></tr>
        <tr><td class=k>หมายเลขตัวถัง</td><td>: ${_e(d.vin)}</td><td class=k>ระยะทาง</td><td>: ${_e(d.mileage)}</td></tr>
        <tr><td class=k>หมายเลขเครื่อง</td><td colspan=3>: ${_e(d.engine_no)}</td></tr>
      </table>
    </div>
  </div>
  <table class=items><thead><tr><th style=width:6%>ลำดับ</th><th style=width:20%>รหัสสินค้า/บริการ</th><th>รายละเอียด</th><th style=width:8%>จำนวน</th><th style=width:13%>ราคาหน่วย</th><th style=width:13%>เป็นเงิน</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="box pad" style=margin-top:8px>
    <table class=sum>
      <tr><td class=k>ค่าบริการ</td><td class=r>${_m(d.labor)}</td><td class=k>ค่าอะไหล่</td><td class=r>${_m(d.parts_total)}</td><td class=k>มูลค่าสินค้า/บริการ (รวมภาษี)</td><td class=r><b>${_m(d.grand_total)}</b></td></tr>
      <tr><td class=k>ส่วนลดค่าบริการ</td><td class=r>${_m(d.labor_discount)}</td><td class=k>ส่วนลดค่าอะไหล่</td><td class=r>${_m(d.parts_discount)}</td><td class=k>ภาษีมูลค่าเพิ่ม 7%</td><td class=r>${_m(d.vat)}</td></tr>
      <tr><td class=k>ค่าบริการสุทธิ</td><td class=r>${_m(d.laborNet)}</td><td class=k>ค่าอะไหล่สุทธิ</td><td class=r>${_m(d.partsNet)}</td><td class=k>มูลค่าสินค้า/บริการ (ก่อนภาษี)</td><td class=r>${_m(d.subtotal)}</td></tr>
    </table>
  </div>
  <div class=noprint style=margin-top:12px;text-align:center><button onclick=window.print()>🖨️ พิมพ์</button></div>
  </body></html>`;
}

export function openQuotePrint(d) {
  const win = window.open("", "_blank", "width=850,height=1000");
  win.document.write(quoteDocHTML(d) + "<script>setTimeout(function(){window.print()},400)<\/script>");
  win.document.close();
}
