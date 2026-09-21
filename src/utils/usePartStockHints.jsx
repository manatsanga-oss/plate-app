import React, { useCallback, useEffect, useRef, useState } from "react";

// เช็คสต๊อก + อะไหล่ทดแทน "ก่อน" บันทึกใบสั่งซื้ออะไหล่ (ใช้ร่วมหน้าสั่งซื้อ HONDA / YAMAHA) — user 2026-09-21
// เคส PDS-2609-00057: สั่งถ้วยคอ 4RT-F3411-10 ทั้งที่รหัสทดแทน 50P-F3411-00 มีของ 2 ชิ้นที่ห้าห้อง — ตอนสั่งไม่มีอะไรเตือน
// - สต๊อก: action search_inventory ของ API ฝั่งนั้น (รหัสไม่มีขีด · YAMAHA เติม "00" ให้ครบ 12 ตัว)
// - คู่ทดแทน: part_substitutes (spare-parts-api get_part_substitutes — ตารางเดียวใช้ทั้ง 2 ยี่ห้อ) ดูทั้ง 2 ทิศ (เดิม→ทดแทน และ ทดแทน→เดิม)
const SUBS_API = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api";
// HONDA: อะไหล่ในใบให้ยืม DCS ที่ยังไม่รับคืน/ตัดสต๊อก (คอลัมน์ "ให้ยืม" หน้าสต๊อกหมุนเร็ว) = ของอยู่ที่ สช.ตลาด
// ไฟล์สินค้าคงเหลือไม่นับยอดนี้ → แสดงเป็นสต๊อก "สช.ตลาด (ให้ยืม)" แยกบรรทัด (user 2026-09-21)
const LOAN_API = "https://n8n-new-project-gwf2.onrender.com/webhook/fast-moving-stock-api";
export const LOAN_STORE = "สช.ตลาด (ให้ยืม)";
export async function fetchLoanStock(code) {
  const c = String(code || "").trim();
  if (!c) return null;
  const rows = (await postJson(LOAN_API, { action: "list_part_loans", item_code: c })).filter((r) => r && r.loan_no);
  const qty = rows.reduce((t, r) => t + Number(r.qty || 0), 0);
  return qty > 0 ? { source: LOAN_STORE, qty, location: [...new Set(rows.map((r) => r.loan_no))].join(", "), loan: true } : null;
}
const strip = (s) => String(s || "").replace(/[-\s]/g, "").toUpperCase().trim();
// YAMAHA: รหัสในใบสั่งมักเป็น 10 ตัว (1KL-F3412-10) แต่สต๊อกเก็บ 12 ตัว (…00) → เทียบแบบตัด "00" ท้าย
const baseKey = (s) => { const t = strip(s); return t.length === 12 && t.endsWith("00") ? t.slice(0, 10) : t; };

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { const d = JSON.parse(t); return Array.isArray(d) ? d : d?.data || []; } catch { return []; }
}

let _subsCache = null; // โหลดครั้งเดียวต่อการเปิดแอป
async function loadSubs() {
  if (_subsCache) return _subsCache;
  const rows = (await postJson(SUBS_API, { action: "get_part_substitutes" })).filter((r) => r && r.original_code && r.substitute_code);
  _subsCache = rows;
  return rows;
}

export default function usePartStockHints(apiUrl, system) {
  const [hints, setHints] = useState({}); // baseKey → { loading, direct:[{source,qty,location}], subs:[{code,name,rel,stock:[…]}] }
  const pending = useRef({});

  const searchStock = useCallback(async (code) => {
    let c = strip(code);
    if (!c) return [];
    if (system === "YAMAHA" && c.length < 12) c = c + "00";
    const [rows, loan] = await Promise.all([
      postJson(apiUrl, { action: "search_inventory", code: c }),
      system === "HONDA" ? fetchLoanStock(c).catch(() => null) : Promise.resolve(null),
    ]);
    const out = rows.filter((r) => r && Number(r.quantity || 0) > 0).map((r) => ({ source: r.source || "-", qty: Number(r.quantity || 0), location: r.location || "" }));
    if (loan) out.push(loan);
    return out;
  }, [apiUrl, system]);

  const ensure = useCallback((code) => {
    const key = baseKey(code);
    if (!key || key.length < 8) return Promise.resolve(null);
    if (pending.current[key]) return pending.current[key];
    const p = (async () => {
      setHints((h) => ({ ...h, [key]: { ...(h[key] || {}), loading: true } }));
      let result = { loading: false, direct: [], subs: [] };
      try {
        const [direct, subsRows] = await Promise.all([searchStock(code), loadSubs()]);
        const related = [];
        const seen = new Set([key]);
        for (const r of subsRows) {
          const o = baseKey(r.original_code), s = baseKey(r.substitute_code);
          if (o === key && !seen.has(s)) { seen.add(s); related.push({ code: r.substitute_code, name: r.substitute_name || "", rel: "ทดแทน" }); }
          else if (s === key && !seen.has(o)) { seen.add(o); related.push({ code: r.original_code, name: r.original_name || "", rel: "รหัสเดิม" }); }
        }
        const subs = await Promise.all(related.map(async (x) => ({ ...x, stock: await searchStock(x.code).catch(() => []) })));
        result = { loading: false, direct, subs };
      } catch { /* เช็คไม่ได้ = ไม่เตือน */ }
      setHints((h) => ({ ...h, [key]: result }));
      return result;
    })();
    pending.current[key] = p;
    return p;
  }, [searchStock]);

  // เช็คทุกบรรทัด (ใช้ตอนกดบันทึก) → คืนรายการที่ร้านมีของอยู่ (รหัสตรง/รหัสทดแทน)
  const checkAll = useCallback(async (items) => {
    const out = [];
    for (const it of items) {
      const r = await ensure(it.part_code);
      if (!r) continue;
      const sum = (arr) => arr.reduce((s, x) => s + x.qty, 0);
      const where = (arr) => arr.map((x) => `${x.source} ${x.qty}`).join(", ");
      if (r.direct.length) out.push(`• ${it.part_code} ${it.part_name || ""} — มีของ ${sum(r.direct)} ชิ้น (${where(r.direct)})`);
      r.subs.filter((s) => s.stock.length).forEach((s) => out.push(`• ${it.part_code} ${it.part_name || ""} — ${s.rel} ${s.code} มีของ ${sum(s.stock)} ชิ้น (${where(s.stock)})`));
    }
    return out;
  }, [ensure]);

  const hintOf = useCallback((code) => hints[baseKey(code)] || null, [hints]);
  // ล้างผลเช็คเดิมเมื่อเปิดฟอร์มใหม่ — ยอดสต๊อกเปลี่ยนได้ระหว่างวัน
  const reset = useCallback(() => { pending.current = {}; setHints({}); }, []);
  return { ensure, checkAll, hintOf, reset };
}

// เช็คอัตโนมัติเมื่อรายการในฟอร์มเปลี่ยน (พิมพ์เอง / OCR / ดึงจากใบมัดจำ) — หน่วง 700ms กันยิงทุกตัวอักษร
export function useAutoStockCheck(active, items, ensure, reset) {
  const codesKey = (items || []).map((it) => strip(it.part_code)).join("|");
  useEffect(() => { if (active && reset) reset(); /* eslint-disable-next-line */ }, [active]);
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => { (items || []).forEach((it) => { if (strip(it.part_code).length >= 8) ensure(it.part_code); }); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [active, codesKey]);
}

// บรรทัดแจ้งเตือนใต้แถวรายการในฟอร์มสั่งซื้อ
export function PartStockHintRow({ hint, colSpan }) {
  if (!hint || hint.loading) return null;
  const subsWith = (hint.subs || []).filter((s) => s.stock.length);
  const subsNo = (hint.subs || []).filter((s) => !s.stock.length);
  if (!hint.direct.length && !hint.subs.length) return null;
  const where = (arr) => arr.map((x) => `${x.source} ${x.qty}${x.location ? ` (${x.location})` : ""}`).join(" · ");
  return (
    <tr>
      <td></td>
      <td colSpan={colSpan - 1} style={{ padding: "0 4px 6px", fontSize: 11.5, lineHeight: 1.5 }}>
        {hint.direct.length > 0 && <div style={{ color: "#166534", fontWeight: 700 }}>📦 รหัสนี้มีของในร้าน: {where(hint.direct)} — อาจไม่ต้องสั่ง</div>}
        {subsWith.map((s) => <div key={s.code} style={{ color: "#b45309", fontWeight: 700 }}>🔁 {s.rel} {s.code}{s.name ? ` ${s.name}` : ""} มีของในร้าน: {where(s.stock)} — ใช้ตัวนี้แทนได้</div>)}
        {subsNo.map((s) => <div key={s.code} style={{ color: "#6b7280" }}>🔁 มี{s.rel} {s.code}{s.name ? ` ${s.name}` : ""} (ไม่มีของในสต๊อก)</div>)}
      </td>
    </tr>
  );
}
