import React, { useEffect, useState } from "react";

// รายการสั่งอะไหล่รายวัน — รวม 3 ระบบ: HONDA / YAMAHA / นอกเงินมัดจำ (เลือกวันย้อนหลังได้)
// 2026-11-05 ลดโหลด (user: "หน้านี้ใช้ CPU มาก หลัก ๆ คือตรวจสอบรหัสอะไหล่ทดแทนพอ"):
//   เหลือเฉพาะ ใบสั่งซื้อของวัน + รายการในใบ + ใบรับสั่งซื้อ (DCS/B2B) + ตารางอะไหล่ทดแทน
//   ตัดออก: เช็คสต๊อกรายรหัส (search_inventory ×N), รับเข้า (search_part_receipts), เบิกเข้า Job (search_part_dispenses),
//           ประวัติเบิกตามรุ่น (part_model_usage ของ Service History API — หนักสุด), อะไหล่ค้างส่ง (backorders)
//   และยิง n8n ทีละไม่เกิน 3 คำขอ (เดิม Promise.all ยิงพร้อมกันหลายสิบคำขอ → n8n บน Render CPU เต็ม ทุก execution ใช้ 80+ วิแล้ว error)
const HONDA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api";
const YAMAHA_API = "https://n8n-new-project-gwf2.onrender.com/webhook/yamaha-spare-api";
const OUTSIDE_API = "https://n8n-new-project-gwf2.onrender.com/webhook/outside-deposit-api";

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}
function norm(d) {
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.rows)) return d.rows;
  return [];
}
// ยิงคำขอทีละไม่เกิน limit (คืนผลตามลำดับเดิม) — กัน n8n รับงานพร้อมกันเป็นสิบ
async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (i < list.length) { const k = i++; out[k] = await fn(list[k], k); }
  }));
  return out;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// เทียบวันที่แบบเวลาไทย (created_at เป็น UTC timestamp)
function thaiDateOf(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d)) return String(ts).slice(0, 10);
  const t = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
function fmtThaiDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
}

const SYSTEMS = [
  { key: "HONDA", label: "HONDA", color: "#dc2626" },
  { key: "YAMAHA", label: "YAMAHA", color: "#2563eb" },
  { key: "OUTSIDE", label: "นอกเงินมัดจำ", color: "#7c3aed" },
];

const strip = (s) => String(s || "").replace(/[-\s]/g, "").toUpperCase();
// จัดรหัสอะไหล่ให้มีขีดแบบ Honda (5-3-ท้าย) — รหัสจากไฟล์ DCS ไม่มีขีด อ่านเทียบกับรหัสที่สั่งยาก
const fmtPartCode = (s) => {
  const c = strip(s);
  return c.length >= 10 ? `${c.slice(0, 5)}-${c.slice(5, 8)}-${c.slice(8)}` : String(s || "");
};
// รหัส YAMAHA จาก B2B ถูก pad ท้ายด้วย 0 เป็น 12 หลัก — ตัด pad แล้วใส่ขีด: 3 ตัวแรกมีตัวอักษร = 3-5-2, ไม่มี = 5-5
const fmtYamahaCode = (s) => {
  let c = strip(s);
  if (c.length === 12 && c.endsWith("00")) c = c.slice(0, 10);
  if (c.length !== 10) return String(s || "");
  return /[A-Z]/.test(c.slice(0, 3)) ? `${c.slice(0, 3)}-${c.slice(3, 8)}-${c.slice(8)}` : `${c.slice(0, 5)}-${c.slice(5)}`;
};
const fmtCodeFor = (system, s) => system === "YAMAHA" ? fmtYamahaCode(s) : fmtPartCode(s);
// รหัส YAMAHA เทียบกันด้วยรูป pad 12 หลัก
const yamahaPad = (s) => { let c = strip(s); if (c && c.length < 12) c = c.padEnd(12, "0"); return c; };
// รหัสจากไฟล์ B2B ที่อัปโหลดก่อน 30/10/69 ถูก Excel แปลงเป็นเลขยกกำลัง (931022582400 → "9.31023E+11") — เทียบกับรหัสที่สั่ง
// ด้วยความละเอียด 6 หลักเดียวกัน ถ้าตรงใช้รหัสที่สั่งแทน (ไฟล์ที่อัปโหลดหลังแก้ Upload_All อ่าน Raw Data แล้วไม่มีปัญหานี้)
const SCI_RE = /^\d(?:\.\d+)?E[+-]?\d+$/i;
const sciResolve = (code, orderCodes) => {
  const t = String(code || "").trim();
  if (!SCI_RE.test(t)) return code;
  const v = Number(t);
  if (!Number.isFinite(v)) return code;
  const hit = orderCodes.find(oc => /^\d{6,}$/.test(oc) && Number(oc).toPrecision(6) === v.toPrecision(6));
  return hit || code;
};

export default function SparePartsDailyOrdersPage({ currentUser }) {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState([]);        // order + system + items
  const [loading, setLoading] = useState(false);
  const [dcsLoading, setDcsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [filterSystem, setFilterSystem] = useState("all");
  // โหมด "เฉพาะใบที่ยังมีรหัสไม่จับคู่": ดึงใบ HONDA/YAMAHA ที่มีเลขใบรับสั่งซื้อย้อนหลัง N วัน แล้วกรองเฉพาะใบที่ยังมี ✗
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);
  const UNMATCHED_LOOKBACK_DAYS = 30; // user 2026-10-25: 90 วันนานไป
  const [dcsByOrder, setDcsByOrder] = useState({});   // order_id → รายการอะไหล่จากใบรับสั่งซื้อที่ upload (dcs_spare_orders / yamaha_b2b_orders)
  const [subsByOrder, setSubsByOrder] = useState({});      // order_id → คู่อะไหล่ทดแทนที่บันทึกแล้ว (ไว้โชว์รหัส)
  const [knownPairs, setKnownPairs] = useState(new Set()); // "เดิม|ทดแทน" ทุกคู่ที่เคยบันทึกจากใบไหนก็ได้ — กันบันทึกซ้ำ + ใช้จับคู่อัตโนมัติ
  const [savingSub, setSavingSub] = useState(null);
  const [selItem, setSelItem] = useState({});              // orderKey → strip(part_code) ของตัว ✗ ที่ติ๊กเลือกไว้รอจับคู่
  const [pendingPairs, setPendingPairs] = useState({});    // orderKey → [{original_code, original_name, substitute_code, substitute_name}] คู่ที่จับเองแล้วยังไม่บันทึก

  async function load(day) {
    setLoading(true);
    setMessage("");
    setDcsByOrder({});
    const out = [];
    const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - UNMATCHED_LOOKBACK_DAYS); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
    // โหลดรายการใบ: HONDA ใช้ scope active + closed(light) แบบหน้าสั่งซื้อ (เบากว่าดึงทุกใบเต็ม) · YAMAHA/นอกเงินมัดจำ ตามเดิม
    const [hondaActive, hondaClosed, yamaha, outside] = await Promise.all([
      post(HONDA_API, { action: "get_spare_orders", scope: "active" }).then(norm).catch(() => []),
      post(HONDA_API, { action: "get_spare_orders", scope: "closed", light: true }).then(norm).catch(() => []),
      post(YAMAHA_API, { action: "get_yamaha_orders" }).then(norm).catch(() => []),
      unmatchedOnly ? Promise.resolve([]) : post(OUTSIDE_API, { action: "get_orders" }).then(norm).catch(() => []),
    ]);
    const seen = new Set();
    const honda = [...hondaActive, ...hondaClosed].filter(o => { const k = String(o.order_id); if (seen.has(k)) return false; seen.add(k); return true; });
    const pick = (list) => unmatchedOnly
      ? list.filter(o => o.vendor_po_no && String(o.created_at || "").slice(0, 10) >= cutoff) // โหมดไม่จับคู่: ย้อนหลัง N วัน เฉพาะใบที่สั่งเข้า DCS/B2B แล้ว
      : list.filter(o => thaiDateOf(o.created_at) === day);
    const hondaDay = pick(honda), yamahaDay = pick(yamaha), outsideDay = unmatchedOnly ? [] : pick(outside);
    // ดึงรายการอะไหล่ของใบที่อยู่ในวันนั้น — ทีละ 3 ใบ
    const detail = (url, action, o) => post(url, { action, order_id: o.order_id }).then(norm).catch(() => []);
    const hi = await mapLimit(hondaDay, 3, o => detail(HONDA_API, "get_spare_order_detail", o));
    const yi = await mapLimit(yamahaDay, 3, o => detail(YAMAHA_API, "get_yamaha_order_detail", o));
    const oi = await mapLimit(outsideDay, 3, o => detail(OUTSIDE_API, "get_order_detail", o));
    hondaDay.forEach((o, i) => out.push({ ...o, system: "HONDA", items: hi[i] }));
    yamahaDay.forEach((o, i) => out.push({ ...o, system: "YAMAHA", items: yi[i] }));
    // ใบนอกเงินมัดจำเก็บเลขใบสั่งซื้อ DCS ไว้ใน po_no
    outsideDay.forEach((o, i) => out.push({ ...o, system: "OUTSIDE", vendor_po_no: o.vendor_po_no || o.po_no || "", items: oi[i] }));
    out.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
    setRows(out);
    setLoading(false);
    // ใบที่เคยบันทึกอะไหล่ทดแทนแล้ว — เก็บคู่รหัสไว้แสดงและจับคู่อัตโนมัติ
    post(HONDA_API, { action: "get_part_substitutes" }).then(norm)
      .then(list => {
        const m = {};
        for (const s of list) (m[String(s.order_id)] = m[String(s.order_id)] || []).push(s);
        setSubsByOrder(m);
        setKnownPairs(new Set(list.map(s => `${strip(s.original_code)}|${strip(s.substitute_code)}`)));
      })
      .catch(() => {});
    // เทียบกับใบรับสั่งซื้อที่ upload — HONDA/OUTSIDE: dcs_spare_orders · YAMAHA: yamaha_b2b_orders (จับคู่ด้วยเลขที่ใบรับสั่งซื้อ) — ทีละ 3 ใบ
    const withPo = out.filter(r => r.vendor_po_no);
    setDcsLoading(withPo.length > 0);
    const res = await mapLimit(withPo, 3, o =>
      o.system !== "YAMAHA"
        ? post(HONDA_API, { action: "search_dcs_orders", vendor_po_no: o.vendor_po_no }).then(norm).catch(() => [])
        : post(YAMAHA_API, { action: "search_yamaha_b2b_orders", vendor_po_no: o.vendor_po_no }).then(norm).catch(() => [])
    );
    const m = {};
    withPo.forEach((o, i) => {
      // กรอง row ว่าง (n8n ตอบ {} เมื่อไม่มีข้อมูล) — ไม่งั้นนับเป็น "มีข้อมูล upload" ผิด
      let list = (res[i] || []).filter(d => d && (d.part_number || d.received_part_number));
      if (o.system === "YAMAHA") {
        const oc = (o.items || []).map(it => yamahaPad(it.part_code));
        list = list.map(d => ({ ...d, part_number: sciResolve(d.part_number, oc), received_part_number: sciResolve(d.received_part_number, oc) }));
      }
      m[`${o.system}-${o.order_id}`] = list;
    });
    setDcsByOrder(m);
    setDcsLoading(false);
  }

  useEffect(() => { load(date); }, [date, unmatchedOnly]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  // เลขที่ใบรับสั่งซื้อเพิ่มเติม (ใบสั่งตามหลัง) — apc_order_no อื่นที่พบในใบรับสั่งซื้อเดียวกัน
  function extraPoNos(r) {
    if (!r.vendor_po_no) return [];
    const dcs = dcsByOrder[`${r.system}-${r.order_id}`] || [];
    return [...new Set(dcs.map(d => d.apc_order_no).filter(a => a && String(a) !== String(r.vendor_po_no)))];
  }

  // รายการในใบรับสั่งซื้อที่จับคู่กับรหัสในใบสั่งซื้อไม่ได้ — ตัวที่ศูนย์ส่งมาแทน/ส่งเกิน
  function unmatchedDcs(r) {
    if (!r.vendor_po_no) return [];
    const dcs = dcsByOrder[`${r.system}-${r.order_id}`] || [];
    if (r.system === "YAMAHA") {
      const orderCodes = (r.items || []).map(it => yamahaPad(it.part_code));
      const out = dcs.filter(d => !orderCodes.includes(yamahaPad(d.part_number)) && !orderCodes.includes(yamahaPad(d.received_part_number)));
      // B2B ส่งรหัสอื่นมาแทนรหัสที่สั่ง (received_part_number ≠ part_number) → โชว์รหัสที่ส่งมาเป็นรายการให้จับคู่/บันทึกได้
      dcs.forEach(d => {
        const rc = yamahaPad(d.received_part_number);
        if (rc && rc !== yamahaPad(d.part_number) && orderCodes.includes(yamahaPad(d.part_number)) && !orderCodes.includes(rc) && !out.some(x => yamahaPad(x.part_number) === rc)) {
          out.push({ ...d, part_number: d.received_part_number, _recvOf: d.part_number });
        }
      });
      return out;
    }
    const orderCodes = (r.items || []).map(it => strip(it.part_code));
    return dcs.filter(d => !orderCodes.includes(strip(d.part_number)));
  }

  // คู่ที่บันทึก/รู้จักแล้วของ DCS ตัวนี้ — คืนรหัสเดิมในใบสั่งซื้อที่มันมาแทน (จากใบนี้หรือใบไหนก็ได้)
  function savedOriginalOf(r, d) {
    const dc = strip(d.part_number);
    const saved = (subsByOrder[String(r.order_id)] || []).find(p => strip(p.substitute_code) === dc);
    if (saved) return saved.original_code;
    const it = (r.items || []).find(x => knownPairs.has(`${strip(x.part_code)}|${dc}`));
    return it ? it.part_code : null;
  }

  // รายการในใบรับสั่งซื้อที่ยังเหลือให้จับคู่ = ไม่ตรงรหัสในใบสั่ง + ยังไม่บันทึกเป็นอะไหล่ทดแทน + ยังไม่อยู่ในคู่รอบันทึก
  // user 2026-11-12 (PDS-2610-00041): ใบที่รายการไม่ตรงถูกบันทึกครบแล้ว ปุ่มติ๊กหน้า ✗ ยังโผล่ แต่ไม่มีปุ่ม "จับคู่/บันทึก" ให้กด → ซ่อนปุ่มติ๊ก + บอกเหตุผล
  function pairableDcs(r) {
    const pend = pendingPairs[`${r.system}-${r.order_id}`] || [];
    return unmatchedDcs(r).filter(d => !savedOriginalOf(r, d) && !pend.some(p => strip(p.substitute_code) === strip(d.part_number)));
  }

  // คู่นี้เคยบันทึกลงตารางอะไหล่ใช้แทนกันแล้วหรือยัง (จากใบไหนก็ได้)
  const pairKnown = (p) => knownPairs.has(`${strip(p.original_code)}|${strip(p.substitute_code)}`);

  // อะไหล่ตัวนี้ถูกสั่งเข้าใบรับสั่งซื้อแล้วหรือยัง (HONDA=DCS, YAMAHA=B2B): true=สั่งแล้ว, false=ยังไม่พบ, null=ยังไม่โหลด
  function orderedInDcs(r, it) {
    if (!r.vendor_po_no) return false;                 // ยังไม่ระบุเลขใบรับสั่งซื้อ = ยังไม่ได้สั่ง
    const key = `${r.system}-${r.order_id}`;
    if (!(key in dcsByOrder)) return null;             // ยังโหลดใบรับสั่งซื้อไม่เสร็จ
    const dcs = dcsByOrder[key] || [];
    if (!dcs.length) return false;                     // มีเลขแล้วแต่ยังไม่พบในไฟล์ที่ upload
    if (r.system === "YAMAHA") {
      const code = yamahaPad(it.part_code);
      if (dcs.some(d => yamahaPad(d.part_number) === code || yamahaPad(d.received_part_number) === code)) return true;
      return !!substituteFor(r, it);                   // มีอะไหล่ทดแทนส่งมาแทนแล้ว
    }
    if (dcs.some(d => strip(d.part_number) === strip(it.part_code))) return true;
    return !!substituteFor(r, it);
  }

  // รหัสทดแทนของอะไหล่ตัวนี้ (ถ้ามี): คู่ที่บันทึกแล้วของใบนี้ → คู่ที่เคยบันทึกจากใบอื่น (เทียบกับ DCS ใบนี้) → คู่ที่จับเองรอบันทึก
  function substituteFor(r, it) {
    const key = `${r.system}-${r.order_id}`;
    const oc = strip(it.part_code);
    const saved = (subsByOrder[String(r.order_id)] || []).find(p => strip(p.original_code) === oc);
    if (saved) return saved.substitute_code;
    for (const d of unmatchedDcs(r)) {
      if (knownPairs.has(`${oc}|${strip(d.part_number)}`)) return d.part_number;
    }
    const pend = (pendingPairs[key] || []).find(p => strip(p.original_code) === oc);
    return pend ? pend.substitute_code : null;
  }

  // เสนอคู่ทดแทนอัตโนมัติจาก B2B (YAMAHA) — user 2026-10-25:
  //   (A) B2B ส่งรหัสอื่นมาแทนรหัสที่สั่ง (received_part_number ≠ part_number) เช่น 2BL-H2310-00 → B8B-H2310-01
  //   (B) รหัสในใบสั่งที่ไม่พบใน B2B แต่มีรายการ B2B ที่ไม่ตรงใบสั่งซึ่ง "เลขกลาง+ท้าย" เท่ากัน (ยามาฮ่าเปลี่ยนเฉพาะ 3 ตัวแรก)
  //   ใส่เป็นคู่รอบันทึก (พนักงานกด "บันทึกอะไหล่ทดแทน" หรือ × ยกเลิกได้) ไม่ทับคู่ที่จับเอง/บันทึกแล้ว
  const yamahaMid = (c) => { const p = yamahaPad(c); return p.length === 12 ? p.slice(3) : ""; }; // 2BLE35850000 → E35850000
  useEffect(() => {
    const add = {};
    rows.filter(r => r.system === "YAMAHA" && r.vendor_po_no).forEach(r => {
      const key = `${r.system}-${r.order_id}`;
      const dcs = dcsByOrder[key] || [];
      if (!dcs.length) return;
      const orderCodes = (r.items || []).map(it => yamahaPad(it.part_code));
      const savedOrig = new Set((subsByOrder[String(r.order_id)] || []).map(p => strip(p.original_code)));
      const pendOrig = new Set((pendingPairs[key] || []).map(p => strip(p.original_code)));
      const usedSub = new Set([...(pendingPairs[key] || []).map(p => strip(p.substitute_code))]);
      (r.items || []).forEach(it => {
        const oc = strip(it.part_code), pc = yamahaPad(it.part_code);
        if (!oc || savedOrig.has(oc) || pendOrig.has(oc)) return;
        let cand = null;
        const a = dcs.find(d => yamahaPad(d.part_number) === pc && d.received_part_number && yamahaPad(d.received_part_number) !== pc);
        if (a) cand = { code: a.received_part_number, name: a.part_description || "" };
        if (!cand && !dcs.some(d => yamahaPad(d.part_number) === pc || yamahaPad(d.received_part_number) === pc)) {
          const b = dcs.find(d => !orderCodes.includes(yamahaPad(d.part_number)) && !orderCodes.includes(yamahaPad(d.received_part_number)) && yamahaMid(d.part_number) && yamahaMid(d.part_number) === yamahaMid(it.part_code));
          if (b) cand = { code: b.received_part_number || b.part_number, name: b.part_description || "" };
        }
        if (!cand || !cand.code || strip(cand.code) === oc || usedSub.has(strip(cand.code))) return;
        if (knownPairs.has(`${oc}|${strip(cand.code)}`)) return; // เคยบันทึกจากใบอื่นแล้ว — substituteFor จะเห็นเอง
        usedSub.add(strip(cand.code));
        (add[key] = add[key] || []).push({ original_code: it.part_code, original_name: it.part_name || "", substitute_code: cand.code, substitute_name: cand.name, auto: true });
      });
    });
    if (!Object.keys(add).length) return;
    setPendingPairs(prev => { // eslint-disable-line react-hooks/set-state-in-effect
      const next = { ...prev };
      for (const [key, list] of Object.entries(add)) next[key] = [...(prev[key] || []), ...list];
      return next;
    });
    // eslint-disable-next-line
  }, [rows, dcsByOrder, subsByOrder, knownPairs]);

  // ติ๊กปุ่มหน้า ✗ แล้วกด "จับคู่" ที่รายการ DCS → เก็บคู่ไว้รอบันทึก
  function pairWith(r, d) {
    const key = `${r.system}-${r.order_id}`;
    const oc = selItem[key];
    if (!oc) { setMessage("⚠️ ติ๊กปุ่มหน้ารหัสอะไหล่ ✗ ที่ต้องการก่อน แล้วค่อยกดจับคู่"); return; }
    const it = (r.items || []).find(x => strip(x.part_code) === oc);
    if (!it) return;
    setMessage("");
    setPendingPairs(prev => {
      const list = (prev[key] || []).filter(p => strip(p.substitute_code) !== strip(d.part_number) && strip(p.original_code) !== oc);
      return { ...prev, [key]: [...list, { original_code: it.part_code, original_name: it.part_name || "", substitute_code: d.part_number, substitute_name: d.part_description || "" }] };
    });
    setSelItem(prev => ({ ...prev, [key]: null }));
  }

  function unpair(r, d) {
    const key = `${r.system}-${r.order_id}`;
    setPendingPairs(prev => ({ ...prev, [key]: (prev[key] || []).filter(p => strip(p.substitute_code) !== strip(d.part_number)) }));
  }

  async function saveSubstitute(r) {
    if (savingSub) return;
    const key = `${r.system}-${r.order_id}`;
    const all = pendingPairs[key] || [];
    if (!all.length) return;
    setSavingSub(r.order_id);
    setMessage("");
    try {
      // ตัดคู่ที่เคยบันทึกไว้แล้ว (จากใบไหนก็ได้) — กันข้อมูลซ้ำในตาราง
      const pairs = all.filter(p => !pairKnown(p)).map(({ auto, ...p }) => p); // eslint-disable-line no-unused-vars
      if (!pairs.length) {
        setPendingPairs(prev => ({ ...prev, [key]: [] }));
        setMessage("คู่อะไหล่ทดแทนนี้เคยบันทึกไว้แล้ว — ไม่บันทึกซ้ำ");
        setSavingSub(null);
        return;
      }
      await post(HONDA_API, { action: "save_part_substitutes", order_id: r.order_id, pairs, approved_by: currentUser?.name || "" });
      setSubsByOrder(prev => ({ ...prev, [String(r.order_id)]: [...(prev[String(r.order_id)] || []), ...pairs] }));
      setKnownPairs(prev => new Set([...prev, ...pairs.map(p => `${strip(p.original_code)}|${strip(p.substitute_code)}`)]));
      setPendingPairs(prev => ({ ...prev, [key]: [] }));
      setMessage(`✅ บันทึกอะไหล่ทดแทนแล้ว ${pairs.length} คู่ (ใบ ${r.vendor_po_no})`);
    } catch { setMessage("❌ บันทึกอะไหล่ทดแทนไม่สำเร็จ"); }
    setSavingSub(null);
  }

  function shiftDay(n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }

  const hasUnmatched = (r) => {
    const key = `${r.system}-${r.order_id}`;
    if (!(key in dcsByOrder)) return false; // ยังโหลดใบรับสั่งซื้อไม่เสร็จ — รอก่อน
    // คู่ที่จับเองแล้วยังไม่กดบันทึก → ต้องค้างแถวไว้ให้กด "บันทึกอะไหล่ทดแทน" (user 2026-11-13 PDS-2611-00020: กดจับคู่แล้วแถวหายทันที
    //   เพราะคู่รอบันทึกทำให้รหัสนั้นไม่นับเป็น ✗ แล้ว) — พอบันทึกเสร็จคู่รอบันทึกถูกล้าง แถวจึงหายตามปกติ
    if ((pendingPairs[key] || []).some(p => !p.auto)) return true;
    return (r.items || []).some(it => orderedInDcs(r, it) === false);
  };
  const filtered = rows.filter(r => (filterSystem === "all" || r.system === filterSystem) && (!unmatchedOnly || hasUnmatched(r)));
  const totalItems = filtered.reduce((s, r) => s + (r.items || []).reduce((s2, it) => s2 + (Number(it.quantity) || 0), 0), 0);

  function printReport() {
    const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    let body = "";
    filtered.forEach((r, i) => {
      const sys = SYSTEMS.find(s => s.key === r.system);
      const items = (r.items || []).map((it, k) => {
        const sub = substituteFor(r, it);
        const notOrdered = orderedInDcs(r, it) === false;
        return `<div class="it${k < (r.items || []).length - 1 ? " sep" : ""}">${esc(it.part_code || "-")} · ${esc(it.part_name || "-")} × ${Number(it.quantity) || 0}${sub ? ` <span style="color:#d97706;font-weight:700">&#8594; ${esc(fmtCodeFor(r.system, sub))}</span>` : ""}${notOrdered ? ' <span style="color:#dc2626;font-weight:800">&#10007;</span>' : ""}</div>`;
      }).join("");
      const itemStatus = (r.items || []).map((it, k) => {
        const st = orderedInDcs(r, it);
        const txt = st === true ? '<span style="color:#059669;font-weight:800">&#10003;</span>' : st === false ? '<span style="color:#dc2626;font-weight:800">&#10007;</span>' : "-";
        return `<div class="it${k < (r.items || []).length - 1 ? " sep" : ""}">${txt}</div>`;
      }).join("");
      body += `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(sys?.label || r.system)}</td>
        <td>${esc(r.deposit_doc_no || r.doc_no || "-")}${r.status === "ปิดงานซ่อม" ? '<div style="color:#059669;font-size:9px;font-weight:700">ปิด Job</div>' : ""}</td>
        <td>${esc(r.vendor_po_no || "-")}${extraPoNos(r).map(po => `<div style="color:#059669;font-size:9px;font-weight:700">+ ${esc(po)}</div>`).join("")}</td>
        <td>${esc(r.model_name || "-")}${(r.vehicle_series || r.vehicle_variant) ? `<div style="font-size:9px;color:#555">${esc([r.vehicle_series, r.vehicle_variant, r.vehicle_type].filter(Boolean).join(" / "))}${r.vehicle_color ? ` · สี ${esc(r.vehicle_color)}` : ""}</div>` : ""}</td>
        <td class="items">${items || "-"}</td>
        <td class="items">${itemStatus || "-"}</td>
        <td class="items">${(() => {
          const un = unmatchedDcs(r);
          if (!un.length) return "";
          return un.map((d, k) => {
            const orig = savedOriginalOf(r, d);
            return `<div class="it${k < un.length - 1 ? " sep" : ""}">${esc(fmtCodeFor(r.system, d.part_number))}${d.part_description ? ` · ${esc(d.part_description)}` : ""}${orig
              ? ` <span style="color:#059669;font-weight:700">&#10003; แทน ${esc(orig)}</span>`
              : ' <span style="color:#dc2626">(ยังไม่จับคู่)</span>'}</div>`;
          }).join("");
        })()}</td>
      </tr>`;
    });
    const w = window.open("", "_blank", "width=1200,height=800");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายการสั่งอะไหล่รายวัน</title>
<style>@page{size:A4 landscape;margin:10mm} body{font-family:Tahoma,Sarabun,sans-serif;font-size:11px;padding:12px}
h2{margin:0 0 4px;font-size:16px} .info{color:#555;font-size:12px;margin-bottom:10px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#072d6b;color:#fff;font-size:10px} .c{text-align:center}
.items{padding:0} .it{text-align:left;padding:3px 6px} .sep{border-bottom:1px solid #ddd}
@media print{body{padding:0}}</style></head><body>
<h2>รายการสั่งอะไหล่รายวัน</h2>
<div class="info">วันที่: ${fmtThaiDate(date)} | ระบบ: ${filterSystem === "all" ? "ทั้งหมด" : (SYSTEMS.find(s => s.key === filterSystem)?.label || filterSystem)} | ${filtered.length} ใบ · ${totalItems} ชิ้น | พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")}</div>
<div class="info"><span style="color:#d97706;font-weight:700">&#8594; รหัส</span> = อะไหล่ทดแทนที่ส่งมาแทน &nbsp;·&nbsp; <span style="color:#059669;font-weight:800">&#10003;</span> = สั่งเข้าใบรับสั่งซื้อแล้ว &nbsp;·&nbsp; <span style="color:#dc2626;font-weight:800">&#10007;</span> = สั่งซื้อในใบแล้ว แต่ยังไม่พบในใบรับสั่งซื้อ (DCS)</div>
<table><thead><tr><th>#</th><th>ระบบ</th><th>เลขที่ใบมัดจำ</th><th>เลขที่ใบรับสั่งซื้อ</th><th>รุ่นรถ</th><th>รายการอะไหล่</th><th>สถานะ</th><th>สถานะอะไหล่ทดแทน</th></tr></thead>
<tbody>${body || `<tr><td colspan="8" class="c">ไม่มีรายการ</td></tr>`}</tbody></table>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  const th = { border: "1px solid #1e3a5f", padding: "8px 10px", textAlign: "left", fontSize: 12, whiteSpace: "nowrap" };
  const td = { border: "1px solid #e5e7eb", padding: "6px 10px", fontSize: 13, verticalAlign: "top" };
  const center = { textAlign: "center", padding: 24, color: "#6b7280" };
  const btn = { padding: "8px 14px", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" };

  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 className="page-title">📋 รายการสั่งอะไหล่รายวัน</h2>
      </div>

      {/* เลือกวัน — ย้อนหลังได้ */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => shiftDay(-1)} style={{ ...btn, background: "#e5e7eb", color: "#111" }} title="วันก่อนหน้า">◀</button>
        <input type="date" value={date} max={todayISO()} onChange={e => e.target.value && setDate(e.target.value)}
          style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14 }} />
        <button onClick={() => shiftDay(1)} disabled={date >= todayISO()}
          style={{ ...btn, background: date >= todayISO() ? "#f3f4f6" : "#e5e7eb", color: date >= todayISO() ? "#9ca3af" : "#111", cursor: date >= todayISO() ? "not-allowed" : "pointer" }} title="วันถัดไป">▶</button>
        <button onClick={() => setDate(todayISO())} style={{ ...btn, background: "#072d6b", color: "#fff" }}>วันนี้</button>
        <button onClick={() => load(date)} disabled={loading} style={{ ...btn, background: "#0e7490", color: "#fff" }}>รีเฟรช</button>
        <button onClick={printReport} disabled={loading || filtered.length === 0} style={{ ...btn, background: "#6b7280", color: "#fff" }}>พิมพ์</button>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 10px", border: "1px solid #fca5a5", borderRadius: 8, background: unmatchedOnly ? "#fee2e2" : "#fff", cursor: "pointer" }}
          title={`แสดงเฉพาะใบสั่งซื้อ HONDA/YAMAHA ที่ยังมีรหัสอะไหล่ ✗ (สั่งแล้วแต่ไม่พบในใบรับสั่งซื้อ) ย้อนหลัง ${UNMATCHED_LOOKBACK_DAYS} วัน`}>
          <input type="checkbox" checked={unmatchedOnly} onChange={e => setUnmatchedOnly(e.target.checked)} />
          <span style={{ color: "#b91c1c", fontWeight: 700 }}>✗ เฉพาะใบที่ยังมีรหัสไม่จับคู่</span>
          <span style={{ color: "#6b7280" }}>(ย้อนหลัง {UNMATCHED_LOOKBACK_DAYS} วัน)</span>
        </label>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#072d6b" }}>
          {unmatchedOnly ? `ย้อนหลัง ${UNMATCHED_LOOKBACK_DAYS} วัน (ถึง ${fmtThaiDate(todayISO())})` : fmtThaiDate(date)} — {filtered.length} ใบ · {totalItems} ชิ้น
          {dcsLoading ? <span style={{ color: "#6b7280", fontWeight: 400 }}> · กำลังเทียบใบรับสั่งซื้อ…</span> : null}
        </span>
      </div>

      {/* filter ระบบ */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => setFilterSystem("all")}
          style={{ ...btn, padding: "5px 12px", fontSize: 12, background: filterSystem === "all" ? "#072d6b" : "#fff", color: filterSystem === "all" ? "#fff" : "#111", border: "1px solid #d1d5db" }}>
          ทั้งหมด ({rows.length})
        </button>
        {SYSTEMS.map(s => (
          <button key={s.key} onClick={() => setFilterSystem(s.key)}
            style={{ ...btn, padding: "5px 12px", fontSize: 12, background: filterSystem === s.key ? s.color : "#fff", color: filterSystem === s.key ? "#fff" : s.color, border: `1px solid ${s.color}` }}>
            {s.label} ({rows.filter(r => r.system === s.key).length})
          </button>
        ))}
      </div>

      {message && <div style={{ marginBottom: 10, color: "#b91c1c", fontSize: 13 }}>{message}</div>}

      {/* คำอธิบายเครื่องหมาย */}
      <div style={{ display: "flex", gap: 18, fontSize: 12, color: "#475569", marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span><span style={{ color: "#d97706", fontWeight: 700, fontFamily: "monospace" }}>→ รหัส</span> = อะไหล่ทดแทนที่ส่งมาแทน</span>
        <span><span style={{ color: "#059669", fontWeight: 800 }}>✓</span> = สั่งเข้าใบรับสั่งซื้อแล้ว</span>
        <span><span style={{ color: "#dc2626", fontWeight: 800 }}>✗</span> = สั่งซื้อในใบแล้ว แต่ยังไม่พบในใบรับสั่งซื้อ (DCS/B2B)</span>
        <span>ช่องสถานะอะไหล่ทดแทน = รายการในใบรับสั่งซื้อที่ไม่ตรงกับรหัสที่สั่ง — ติ๊กปุ่มหน้ารหัส ✗ แล้วกด "จับคู่" เพื่อเลือกอะไหล่ทดแทนเอง</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={th}>#</th>
              <th style={th}>ระบบ</th>
              <th style={th}>เลขที่ใบมัดจำ</th>
              <th style={th}>เลขที่ใบรับสั่งซื้อ</th>
              <th style={th}>รุ่นรถ</th>
              <th style={th}>รายการอะไหล่</th>
              <th style={th}>สถานะ</th>
              <th style={th}>สถานะอะไหล่ทดแทน</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={center}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={center}>{unmatchedOnly && dcsLoading ? "กำลังเทียบใบรับสั่งซื้อ…" : "ไม่มีรายการสั่งอะไหล่ในวันนี้"}</td></tr>
            ) : filtered.map((r, i) => {
              const sys = SYSTEMS.find(s => s.key === r.system);
              const rowH = { padding: "0 10px", height: 32, display: "flex", alignItems: "center" };
              return (
                <tr key={`${r.system}-${r.order_id}`} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "#fff", background: sys?.color || "#6b7280" }}>
                      {sys?.label || r.system}
                    </span>
                  </td>
                  <td style={td}>
                    {r.deposit_doc_no || r.doc_no || "-"}
                    {r.status === "ปิดงานซ่อม" && (
                      <div title="งานซ่อมของใบนี้ปิดแล้ว (ตรวจพบปิดงานในใบแจ้งซ่อม NID)"
                        style={{ display: "inline-block", marginTop: 3, padding: "1px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "#fff", background: "#059669" }}>
                        ปิด Job
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    {r.vendor_po_no || "-"}
                    {extraPoNos(r).map(po => (
                      <div key={po} title="ใบรับสั่งซื้อเพิ่ม — สั่งตามหลังด้วยเลขสั่งซื้อลูกค้าเดิม"
                        style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 2 }}>
                        + {po}
                      </div>
                    ))}
                  </td>
                  <td style={td}>
                    <div>{r.model_name || "-"}</div>
                    {(r.vehicle_series || r.vehicle_variant) && (
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                        {[r.vehicle_series, r.vehicle_variant, r.vehicle_type].filter(Boolean).join(" / ")}
                        {r.vehicle_color ? ` · สี ${r.vehicle_color}` : ""}
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "left", padding: 0 }}>
                    {(r.items || []).length === 0 ? <div style={{ padding: "6px 10px" }}>-</div> : (r.items || []).map((it, k) => {
                      const st = orderedInDcs(r, it);
                      const sub = substituteFor(r, it);
                      const key = `${r.system}-${r.order_id}`;
                      const oc = strip(it.part_code);
                      return (
                        <div key={k} style={{ ...rowH, borderBottom: k < r.items.length - 1 ? "1px solid #e5e7eb" : "none" }}>
                          <span style={{ whiteSpace: "nowrap" }}>
                            {/* ปุ่มเลือกตัว ✗ ไว้จับคู่กับอะไหล่ทดแทนในช่องขวา (เฉพาะใบที่ยังมีรายการในใบรับสั่งซื้อเหลือให้จับคู่) */}
                            {st === false && pairableDcs(r).length > 0 && (
                              <input type="radio" name={`selsub-${key}`} checked={selItem[key] === oc}
                                onChange={() => {}}
                                onClick={() => setSelItem(prev => ({ ...prev, [key]: prev[key] === oc ? null : oc }))}
                                title="เลือกตัวนี้ แล้วกดปุ่ม 'จับคู่' ที่รายการในช่องสถานะอะไหล่ทดแทน"
                                style={{ marginRight: 6, cursor: "pointer", accentColor: "#d97706" }} />
                            )}
                            <span style={{ fontFamily: "monospace", fontSize: 12 }}>{it.part_code || "-"}</span>
                            {" · "}{it.part_name || "-"}{" × "}<b>{Number(it.quantity) || 0}</b>
                            {sub ? (
                              <span title="อะไหล่ทดแทนที่ใบรับสั่งซื้อส่งมาแทนตัวนี้" style={{ color: "#d97706", fontWeight: 700, marginLeft: 8, fontFamily: "monospace", fontSize: 12 }}>
                                → {fmtCodeFor(r.system, sub)}
                              </span>
                            ) : null}
                            {st === false && (
                              <span title="สั่งซื้อในใบแล้ว แต่ยังไม่พบในใบรับสั่งซื้อ (DCS)" style={{ color: "#dc2626", fontWeight: 800, marginLeft: 6 }}>✗</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </td>
                  {/* คอลัมน์สถานะรายตัว — บรรทัดตรงกับรายการอะไหล่ (สูง 32px เท่ากัน) */}
                  <td style={{ ...td, textAlign: "left", padding: 0 }}>
                    {(r.items || []).length === 0 ? <div style={{ padding: "6px 10px" }}>-</div> : (r.items || []).map((it, k) => {
                      const st = orderedInDcs(r, it);
                      return (
                        <div key={k} style={{ ...rowH, fontSize: 12, borderBottom: k < r.items.length - 1 ? "1px solid #e5e7eb" : "none" }}>
                          {st === true ? <span title="สั่งเข้าใบรับสั่งซื้อแล้ว" style={{ color: "#059669", fontWeight: 800 }}>✓</span>
                            : st === false ? <span title="สั่งซื้อในใบแล้ว แต่ยังไม่พบในใบรับสั่งซื้อ" style={{ color: "#dc2626", fontWeight: 800 }}>✗</span>
                            : <span style={{ color: "#9ca3af" }}>{r.vendor_po_no ? "…" : "-"}</span>}
                        </div>
                      );
                    })}
                  </td>
                  <td style={{ ...td, textAlign: "left", fontSize: 12 }}>
                    {(() => {
                      // รายการในใบรับสั่งซื้อ (DCS) ที่จับคู่กับรหัสในใบสั่งซื้อไม่ได้ — ให้เลือกจับคู่/บันทึก
                      const un = unmatchedDcs(r);
                      const key = `${r.system}-${r.order_id}`;
                      const pend = pendingPairs[key] || [];
                      // รหัส ✗ ที่ไม่มีรายการในใบรับสั่งซื้อเหลือให้จับคู่ = ยังไม่ได้สั่งเข้าใบรับสั่งซื้อเลขนี้ (ไม่ใช่อะไหล่ทดแทน)
                      const notOrdered = (key in dcsByOrder) ? (r.items || []).filter(it => orderedInDcs(r, it) === false).length : 0;
                      const noPairHint = notOrdered > 0 && pairableDcs(r).length === 0 && pend.length === 0 ? (
                        <div style={{ color: "#6b7280", marginTop: un.length ? 4 : 0, whiteSpace: "normal", maxWidth: 360 }}
                          title="ทุกรายการในใบรับสั่งซื้อตรงกับรหัสที่สั่ง หรือบันทึกเป็นอะไหล่ทดแทนครบแล้ว">
                          ไม่มีรายการในใบรับสั่งซื้อเหลือให้จับคู่ — รหัส <b style={{ color: "#dc2626" }}>✗ {notOrdered} ตัว</b> ยังไม่พบใน{r.system === "YAMAHA" ? " B2B" : " DCS"} เลขที่ {r.vendor_po_no} (ยังไม่ได้สั่ง หรือสั่งไว้ในใบอื่น)
                        </div>
                      ) : null;
                      if (!un.length) return noPairHint;
                      return (
                        <div>
                          {un.map((d, k) => {
                            const savedOrig = savedOriginalOf(r, d);
                            const pendPair = pend.find(p => strip(p.substitute_code) === strip(d.part_number));
                            return (
                              <div key={k} style={{ marginBottom: 4, whiteSpace: "nowrap" }}>
                                <span style={{ fontFamily: "monospace" }}>{fmtCodeFor(r.system, d.part_number)}</span>
                                {d.part_description ? <span style={{ color: "#475569" }}> · {d.part_description}</span> : null}
                                {savedOrig ? (
                                  <span style={{ color: "#059669", fontWeight: 700, marginLeft: 6 }} title="บันทึกลงตารางอะไหล่ใช้แทนกันแล้ว">
                                    ✓ แทน {savedOrig}
                                  </span>
                                ) : pendPair ? (
                                  <span style={{ color: "#d97706", fontWeight: 700, marginLeft: 6 }} title={pendPair.auto ? "B2B เสนอให้อัตโนมัติ (รหัสที่ส่งมาแทน / เลขกลาง+ท้ายตรงกัน) — กด × ถ้าไม่ใช่" : "คู่ที่จับเอง รอบันทึก"}>
                                    → แทน {pendPair.original_code}{pendPair.auto ? " (B2B)" : ""}
                                    <button onClick={() => unpair(r, d)} title="ยกเลิกคู่นี้"
                                      style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontWeight: 800, marginLeft: 2 }}>×</button>
                                  </span>
                                ) : (
                                  <button onClick={() => pairWith(r, d)}
                                    title="จับคู่กับรหัส ✗ ที่ติ๊กเลือกไว้ในช่องรายการอะไหล่"
                                    style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", marginLeft: 6 }}>
                                    จับคู่
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {pend.length > 0 && (
                            <button onClick={() => saveSubstitute(r)} disabled={savingSub === r.order_id}
                              title="บันทึกคู่ที่จับไว้ลงตารางอะไหล่ใช้แทนกัน"
                              style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: savingSub === r.order_id ? "wait" : "pointer", whiteSpace: "nowrap", marginTop: 4 }}>
                              {savingSub === r.order_id ? "กำลังบันทึก…" : `บันทึกอะไหล่ทดแทน (${pend.length} คู่)`}
                            </button>
                          )}
                          {noPairHint}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
