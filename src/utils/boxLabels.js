// ป้ายปิดหน้ากล่อง / ป้ายยาว 15×2 ซม. — ใช้ร่วมกันระหว่างแท็บสต๊อกอะไหล่หมุนเร็ว และแท็บสต๊อกอะไหล่อื่น (2026-09-25)
// sel = แถวที่เลือก [{ part_code, product_name, product_group, brand }] · size = "box" (8 ป้าย/A4) | "strip" (12 ป้าย/A4)
export function printBoxLabels(sel, size) {
  if (!sel || !sel.length) { alert("ติ๊กเลือกรายการที่ต้องการพิมพ์ป้ายก่อน"); return; }
    const esc = (v) => String(v == null ? "" : v).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
    if (size === "strip") { printStripLabels(sel, esc); return; }
    const cells = sel.map((r, i) => {
      return `<div class="lb">
        <div class="grp">${esc(r.product_group || "")}<span class="brand">${esc(r.brand || "")}</span></div>
        <div class="name">${esc(r.product_name || "-")}</div>
        <svg class="bc" data-code="${esc(r.part_code)}"></svg>
        <div class="code">${esc(r.part_code)}</div>
      </div>`;
    }).join("");
    const w = window.open("", "_blank", "width=900,height=1000");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ป้ายปิดหน้ากล่อง ${sel.length} ป้าย</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"></script>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Tahoma, sans-serif; color: #111; }
  .sheet { display: grid; grid-template-columns: repeat(2, 95mm); grid-auto-rows: 60mm; column-gap: 4mm; row-gap: 3mm; justify-content: center; padding: 2mm 0; }
  .lb { width: 95mm; height: 60mm; border: 1px dashed #9ca3af; border-radius: 2mm; padding: 3mm 4mm; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; overflow: hidden; }
  .grp { font-size: 10pt; color: #374151; display: flex; justify-content: space-between; }
  .brand { font-weight: 700; color: #b91c1c; }
  .name { font-size: 12pt; font-weight: 700; line-height: 1.25; max-height: 2.6em; overflow: hidden; }
  .bc { width: 100%; height: 17mm; }
  .code { font-size: 20pt; font-weight: 800; letter-spacing: 1px; text-align: center; font-family: Arial, Tahoma, sans-serif; }
  .loc { font-size: 11pt; text-align: center; color: #1f2937; }
  .muted { color: #9ca3af; }
  .toolbar { position: fixed; top: 6px; right: 10px; z-index: 9; }
  .toolbar button { padding: 8px 16px; font-family: Tahoma; font-size: 14px; cursor: pointer; }
  @media print { .toolbar { display: none; } .lb { border-color: #d1d5db; } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨️ พิมพ์ (${sel.length} ป้าย · ${Math.ceil(sel.length / 8)} แผ่น A4)</button></div>
<div class="sheet">${cells}</div>
<script>
  function render() {
    document.querySelectorAll("svg.bc").forEach(function (el) {
      try { JsBarcode(el, el.getAttribute("data-code"), { format: "CODE128", displayValue: false, height: 60, width: 2, margin: 0 }); } catch (e) {}
    });
  }
  if (window.JsBarcode) render(); else window.addEventListener("load", render);
</script>
</body></html>`);
    w.document.close();
  }

  // ป้ายยาว 15×2 ซม.: บาร์โค้ด Code128 ซ้าย · รหัสตัวใหญ่ + ชื่อ (บรรทัดเดียว) กลาง · กลุ่ม/ยี่ห้อ ขวา — A4 แนวตั้ง 1 คอลัมน์ × 12 แถว มีเส้นประไว้ตัด

export function printStripLabels(sel, esc) {
    const PER = 12;
    const cells = sel.map((r) => `<div class="lb">
        <svg class="bc" data-code="${esc(r.part_code)}"></svg>
        <div class="mid">
          <div class="code">${esc(r.part_code)}</div>
          <div class="name">${esc(r.product_name || "-")}</div>
        </div>
        <div class="side"><div class="brand">${esc(r.brand || "")}</div><div class="grp">${esc(r.product_group || "")}</div></div>
      </div>`).join("");
    const w = window.open("", "_blank", "width=900,height=1000");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ป้าย 15×2 ซม. ${sel.length} ป้าย</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"></script>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Tahoma, sans-serif; color: #111; }
  .sheet { display: grid; grid-template-columns: 150mm; grid-auto-rows: 20mm; row-gap: 3mm; justify-content: center; padding: 2mm 0; }
  .lb { width: 150mm; height: 20mm; border: 1px dashed #9ca3af; border-radius: 1.5mm; padding: 1.5mm 3mm; display: flex; align-items: center; gap: 3mm; page-break-inside: avoid; overflow: hidden; }
  .bc { width: 52mm; height: 15mm; flex: none; }
  .mid { flex: 1; min-width: 0; }
  .code { font-size: 17pt; font-weight: 800; letter-spacing: .5px; font-family: Arial, Tahoma, sans-serif; line-height: 1.1; white-space: nowrap; overflow: hidden; }
  .name { font-size: 9.5pt; font-weight: 700; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .side { flex: none; max-width: 24mm; text-align: right; font-size: 7.5pt; color: #374151; line-height: 1.25; overflow: hidden; }
  .brand { font-weight: 700; color: #b91c1c; font-size: 8.5pt; }
  @media screen { body { padding-top: 46px; } }
  .toolbar { position: fixed; top: 6px; right: 10px; z-index: 9; }
  .toolbar button { padding: 8px 16px; font-family: Tahoma; font-size: 14px; cursor: pointer; }
  @media print { .toolbar { display: none; } .lb { border-color: #d1d5db; } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨️ พิมพ์ (${sel.length} ป้าย · ${Math.ceil(sel.length / PER)} แผ่น A4) — ตั้ง Scale 100%</button></div>
<div class="sheet">${cells}</div>
<script>
  function render() {
    document.querySelectorAll("svg.bc").forEach(function (el) {
      try { JsBarcode(el, el.getAttribute("data-code"), { format: "CODE128", displayValue: false, height: 50, width: 2, margin: 0 }); el.setAttribute("preserveAspectRatio", "none"); } catch (e) {}
    });
  }
  if (window.JsBarcode) render(); else window.addEventListener("load", render);
</script>
</body></html>`);
    w.document.close();
  }
