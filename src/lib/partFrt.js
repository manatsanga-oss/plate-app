// เวลาในการบริการ (FRT = Flat Rate Time, ชั่วโมง) จากคู่มือรายการอะไหล่ Honda
// ข้อมูล: src/data/part_frt.json สร้างด้วย tools/build_parts_book_frt.py (อ่านตาราง "หัวข้อการบริการ / เวลาในการบริการ" ของทุกบล็อกใน PDF)
//   books[i] = { s: slug เล่ม, r: [ชื่อรุ่นของระบบ], e: ฉบับ }
//   codes[รหัสไม่มีขีด] = [[i, บล็อก, ชม.], ...]        ← จับคู่ด้วยเลขลำดับในบล็อก (ตรงตัว)
//   jobs[i][ชื่อหัวข้อ(เฉพาะอักษรไทย)] = ชม. | [ต่ำสุด, สูงสุด]  ← ใช้เทียบด้วยชื่อ เมื่อรหัสไม่อยู่ในเล่ม (เช่น แบตฯ/ยาง คนละยี่ห้อ)
// โหลดแบบ lazy (ไฟล์ ~0.9MB) — ใช้เฉพาะหน้าที่ต้องแสดงเวลา

let _promise = null;
export function loadPartFrt() {
  if (!_promise) _promise = import("../data/part_frt.json").then((m) => m.default || m).catch(() => null);
  return _promise;
}

const normCode = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const normRun = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9+]/g, "");
// tag รุ่นที่สะกดต่างจากชื่อรุ่นของเล่ม (tag อัตโนมัติรุ่นเก่าใช้รหัสแบบแทนชื่อรุ่น)
const RUN_ALIAS = { WW150: "PCX150", MOVE: "MOOVE", NFC110: "MOOVE", ACB150: "CLICK150", ANC125: "CLICK125", ACG110: "ZOOMERX", SONIC125: "SONIC", SUPERCUB: "SUPER", DREAM110I: "SUPER" };
const runKey = (s) => { const n = normRun(s); return RUN_ALIAS[n] || n; };

// ต้องตรงกับ thai_key() ใน tools/build_parts_book_frt.py
export function thaiKey(s) {
  const t = String(s || "").replace(/\(.*?\)/g, "").replace(/[^ก-๎]/g, "");
  return t.replace(/เบรค/g, "เบรก").replace(/ใส้/g, "ไส้").replace(/ดิสค์/g, "ดิสก์").replace(/โช๊ค|โช้ค/g, "โช้ก");
}

const fmtH = (h) => Number(h).toFixed(1);
export const frtMinutes = (h) => Math.round(Number(h) * 60);

/**
 * เวลาบริการของอะไหล่ 1 แถว
 * @param data   ผลจาก loadPartFrt()
 * @param row    { part_code, product_name, custom_name, models: [{ sel_run }] }
 * @param filterRun ชื่อรุ่นที่ผู้ใช้กรองอยู่ ("all" = ไม่กรอง) → ถ้ามีข้อมูลของรุ่นนั้น แสดงเฉพาะรุ่นนั้น
 * @returns null | { min, max, approx, label, minutes, title }
 */
export function frtForRow(data, row, filterRun = "all") {
  if (!data || !row) return null;
  const want = filterRun && filterRun !== "all" ? runKey(filterRun) : "";
  const bookHas = (b, k) => (b.r || []).some((r) => runKey(r) === k);
  let items = [];
  let approx = false;

  const exact = data.codes?.[normCode(row.part_code)];
  if (exact && exact.length) {
    items = exact.map(([bi, block, h]) => ({ book: data.books[bi], block, min: h, max: h }));
  } else {
    // รหัสไม่อยู่ในเล่ม → เทียบชื่อสินค้ากับหัวข้อบริการ เฉพาะในเล่มของรุ่นที่ผูกไว้กับสินค้านี้
    const key = thaiKey(row.custom_name || row.product_name);
    const runs = new Set((row.models || []).map((m) => runKey(m.sel_run)).filter(Boolean));
    if (!key || !runs.size) return null;
    data.books.forEach((b, bi) => {
      if (!(b.r || []).some((r) => runs.has(runKey(r)))) return;
      const v = data.jobs?.[bi]?.[key];
      if (v == null) return;
      const [mn, mx] = Array.isArray(v) ? v : [v, v];
      items.push({ book: b, block: "", min: mn, max: mx });
    });
    approx = true;
  }
  if (!items.length) return null;
  if (want) { const only = items.filter((it) => bookHas(it.book, want)); if (only.length) items = only; }

  const min = Math.min(...items.map((i) => i.min));
  const max = Math.max(...items.map((i) => i.max));
  // ชื่อกว้างเกินไป (เช่น "ลูกปืนตลับ" "ซีลกันน้ำมัน" อยู่หลายบล็อก เวลาต่างกันมาก) → ไม่แสดง ดีกว่าแสดงช่วงที่ใช้ไม่ได้
  if (approx && max > min * 3) return null;
  const label = min === max ? fmtH(min) : `${fmtH(min)}–${fmtH(max)}`;
  const minutes = min === max ? `${frtMinutes(min)}` : `${frtMinutes(min)}–${frtMinutes(max)}`;
  // tooltip: รุ่น (ฉบับ) บล็อก: เวลา — รวมรายการที่ซ้ำกัน
  const seen = new Set();
  const lines = [];
  for (const it of items) {
    const hrs = it.min === it.max ? fmtH(it.min) : `${fmtH(it.min)}–${fmtH(it.max)}`;
    const line = `${(it.book.r || []).join("/")}${it.book.e ? ` (ฉบับ ${it.book.e})` : ""}${it.block ? ` บล็อก ${it.block}` : ""}: ${hrs} ชม.`;
    if (!seen.has(line)) { seen.add(line); lines.push(line); }
  }
  const head = approx
    ? "เทียบจากชื่อหัวข้อบริการในคู่มือของรุ่นที่ผูกไว้ (รหัสนี้ไม่มีในเล่ม)"
    : "เวลาในการบริการตามคู่มือรายการอะไหล่ Honda";
  return { min, max, approx, label, minutes, title: `${head}\n${lines.slice(0, 14).join("\n")}${lines.length > 14 ? `\n… อีก ${lines.length - 14} เล่ม` : ""}` };
}
