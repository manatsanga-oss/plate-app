import React, { useEffect, useMemo, useState } from "react";
import CustomerPickerModal from "./CustomerPickerModal";

// บันทึกส่งเอกสารทางไปรษณีย์ (user 2026-09-30)
//   ผู้ส่ง = พนักงาน + สังกัด (ป.เปา / สิงห์ชัย) ที่อยู่บริษัทจาก branch master · ผู้รับ = ลูกค้า (CustomerPickerModal) / Vendor master / พิมพ์เอง
//   วิธีส่ง ธรรมดา / ลงทะเบียน / EMS · พิมพ์ "ป้ายที่อยู่" ลง A4 มีกรอบเส้นประไว้ตัดแปะซอง 2 ขนาด (ซองขาวยาว DL / ซองน้ำตาล C4)
//   สถานะ: รอส่ง → จัดส่งสำเร็จ อัตโนมัติ (จับคู่รายการค่าไปรษณีย์ในเงินสดย่อยด้วยเลข tracking หรือ ชื่อผู้รับ+วันที่ แล้วบันทึกลง DB เอง) · ยกเลิก
// backend: Mail_Dispatch_API_Workflow.json (webhook mail-dispatch-api) actions save_mail / list_mails / update_mail_status / cancel_mail · ตาราง mail_dispatches
const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const API = `${BASE}/mail-dispatch-api`;
const MASTER_API = `${BASE}/master-data-api`;
const PETTY_API = `${BASE}/petty-cash-api`;
const SEARCH_API = `${BASE}/booking-deposit-api`; // search_customers keyword → ที่อยู่จากหลายแหล่ง

const AFFIL = {
  "ป.เปา": { company: "บริษัท ป.เปา มอเตอร์เซอร์วิส จำกัด", defaultBranch: "SCY06", branches: ["SCY05", "SCY06"] },
  "สิงห์ชัย": { company: "หจก. สิงห์ชัย สยามยนต์", defaultBranch: "SCY01", branches: ["SCY01", "SCY04", "SCY07"] },
};
const METHODS = ["ธรรมดา", "ลงทะเบียน", "EMS"];
const ENVELOPES = [
  // พิมพ์ลง A4 เป็น "ป้ายที่อยู่" มีกรอบเส้นประไว้ตัดแล้วแปะบนซอง (user 2026-09-30) — ขนาดป้ายย่อตามซอง
  { key: "dl", label: "ซองขาวยาว DL — ป้าย 150×80 มม. (3 ป้าย/A4)", w: 150, h: 80, sender: 9.5, recip: 14, pad: 6, perPage: 3 },
  { key: "c4", label: "ซองน้ำตาล A4 (C4) — ป้าย 190×120 มม. (2 ป้าย/A4)", w: 190, h: 120, sender: 12, recip: 20, pad: 9, perPage: 2 },
];
const STATUS_STYLE = {
  "รอส่ง": { bg: "#fef3c7", fg: "#92400e" },
  "จัดส่งสำเร็จ": { bg: "#d1fae5", fg: "#065f46" },
  "ยกเลิก": { bg: "#fee2e2", fg: "#991b1b" },
};
const pad = (n) => String(n).padStart(2, "0");
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const shiftIso = (iso, days) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const thDate = (v) => { if (!v) return "-"; const d = new Date(String(v).slice(0, 10) + "T00:00:00"); return isNaN(d) ? "-" : d.toLocaleDateString("th-TH"); };
const esc = (v) => String(v == null ? "" : v).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
const nn = (s) => String(s || "").replace(/^(บริษัท|บจก\.?|บจ\.?|บ\.|หจก\.?|ห้างหุ้นส่วนจำกัด|นางสาว|น\.ส\.|นาย|นาง|คุณ|MR\.?|MRS\.?|MS\.?)\s*/i, "").replace(/\s*(จำกัด\s*\(มหาชน\)|จำกัด|\(มหาชน\))\s*$/g, "").replace(/[\s\.\-]+/g, "").toUpperCase();
const trk = (s) => String(s || "").replace(/[\s\-]/g, "").toUpperCase();
const wrapWords = (t) => String(t || "").trim().split(/\s+/).filter(Boolean).map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
const vendorAddr = (v) => [v.address, v.sub_district, v.district, v.province, v.postal_code].filter(Boolean).join(" ");

async function postJSON(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text();
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}
async function listJSON(url, body) {
  const d = await postJSON(url, body);
  if (d && typeof d.listjson === "string") { try { return JSON.parse(d.listjson); } catch { return []; } }
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.data)) return d.data;
  return [];
}

const inp = { padding: "7px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, width: "100%", boxSizing: "border-box", fontFamily: "Tahoma" };
const lbl = { fontSize: 12, color: "#374151", fontWeight: 600, marginBottom: 3, display: "block" };
const btn = (bg) => ({ padding: "7px 14px", fontSize: 13, background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" });

// ---------- พิมพ์หน้าซอง ----------
function printEnvelope(rows, envKey) {
  const env = ENVELOPES.find((e) => e.key === envKey) || ENVELOPES[0];
  const list = Array.isArray(rows) ? rows : [rows];
  const w = window.open("", "_blank");
  const cells = list.map((r) => `
<div class="lb">
  <div class="sender">
    <div class="sname">${esc(r.sender_company || "")}</div>
    <div>${wrapWords(r.sender_address)}</div>
    <div>${r.sender_phone ? "โทร. " + esc(r.sender_phone) : ""}</div>
  </div>
  <div class="method">${esc(r.method || "")}${r.tracking_no ? "<br><span class='trk'>" + esc(r.tracking_no) + "</span>" : ""}</div>
  <div class="recip">
    <div class="rlabel">กรุณาส่ง</div>
    ${r.recipient_attn ? `<div class="rattn">${esc(r.recipient_attn)}</div>` : ""}
    <div class="rname">${esc(r.recipient_name || "")}</div>
    <div class="raddr">${wrapWords(r.recipient_address)}</div>
    ${r.recipient_phone ? `<div class="rtel">โทร. ${esc(r.recipient_phone)}</div>` : ""}
    ${String(r.note || "").trim() ? `<div class="rnote">${wrapWords(r.note)}</div>` : ""}
  </div>
  <div class="scissors">✂</div>
</div>`).join("");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ป้ายที่อยู่ ${env.label}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'TH Sarabun New', Tahoma, sans-serif; color: #111; }
  .sheet { display: grid; grid-template-columns: ${env.w}mm; grid-auto-rows: ${env.h}mm; row-gap: 6mm; justify-content: center; }
  .lb { position: relative; width: ${env.w}mm; height: ${env.h}mm; border: 1px dashed #777; padding: ${env.pad}mm; page-break-inside: avoid; overflow: hidden; background: #fff; }
  .sender { position: absolute; top: ${env.pad}mm; left: ${env.pad}mm; width: ${Math.round(env.w * 0.55)}mm; font-size: ${env.sender}pt; line-height: 1.3; }
  .sname { font-weight: 700; }
  .method { position: absolute; top: ${env.pad}mm; right: ${env.pad}mm; font-size: ${env.sender + 2}pt; font-weight: 800; border: 1.5px solid #111; padding: 1.5mm 3mm; text-align: center; }
  .trk { font-weight: 400; font-size: ${env.sender}pt; font-family: monospace; }
  .recip { position: absolute; top: ${Math.round(env.h * 0.42)}mm; left: ${Math.round(env.w * 0.36)}mm; width: ${Math.round(env.w * 0.6)}mm; font-size: ${env.recip}pt; line-height: 1.35; }
  .rlabel { font-size: ${env.sender}pt; color: #333; }
  .rname { font-weight: 800; }
  .rattn { font-weight: 800; }
  .raddr { white-space: normal; }
  .w { display: inline-block; white-space: nowrap; }
  .rtel { font-size: ${env.sender + 1}pt; }
  .rnote { font-size: ${env.sender + 1}pt; margin-top: 1mm; }
  .scissors { position: absolute; top: -3.2mm; left: 4mm; font-size: 9pt; color: #777; background: #fff; padding: 0 1mm; }
  .toolbar { position: fixed; top: 6px; right: 10px; z-index: 9; font-family: Tahoma; }
  .toolbar button { padding: 8px 16px; font-size: 14px; cursor: pointer; }
  @media print { .toolbar { display: none; } .lb { border-color: #999; } }
  @media screen { body { background: #e5e7eb; padding: 40px 10px 10px; } .sheet { background: #fff; width: 190mm; margin: 0 auto; padding: 10mm 0; box-shadow: 0 1px 4px rgba(0,0,0,.2); } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨️ พิมพ์ (${list.length} ป้าย · ${Math.ceil(list.length / env.perPage)} แผ่น A4)</button> <span style="font-size:12px;color:#444">ตัดตามเส้นประแล้วแปะบนซอง · ตั้ง Scale 100%</span></div>
<div class="sheet">${cells}</div>
</body></html>`);
  w.document.close();
}

export default function MailDispatchPage({ currentUser }) {
  const isAdmin = currentUser?.username === "admin" || String(currentUser?.role || "").toLowerCase() === "admin";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [branches, setBranches] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [postItems, setPostItems] = useState([]); // รายการค่าไปรษณีย์จากเงินสดย่อย
  const [filter, setFilter] = useState({ date_from: shiftIso(todayIso(), -30), date_to: todayIso(), status: "", keyword: "" });
  const [sel, setSel] = useState(() => new Set());
  const [envKey, setEnvKey] = useState("dl");

  // ฟอร์ม
  const emptyForm = () => ({
    id: 0, send_date: todayIso(), sender_affiliation: "ป.เปา", sender_branch_code: "SCY06", sender_name: currentUser?.name || "",
    recipient_type: "customer", recipient_code: "", recipient_name: "", recipient_attn: "", recipient_address: "", recipient_phone: "",
    doc_desc: "", method: "EMS", tracking_no: "", envelope: "dl", note: "",
  });
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [addrChoices, setAddrChoices] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recQ, setRecQ] = useState("");            // ค้นหาผู้รับรวม: ลูกค้า/ผู้ซื้อรถ/ใบขายปลีก/QR-LINE + Vendor (user 2026-09-30: ต้องมีรายชื่อลูกค้าที่ซื้อรถด้วย)
  const [recHits, setRecHits] = useState(null);
  const [recSearching, setRecSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function loadMaster() {
    const [b, v] = await Promise.all([
      listJSON(MASTER_API, { action: "get_branches", include_inactive: "true" }).catch(() => []),
      listJSON(MASTER_API, { action: "list_vendors", include_inactive: "false" }).catch(() => []),
    ]);
    setBranches(b); setVendors(v);
  }
  async function loadPostage() {
    try {
      const docs = await listJSON(PETTY_API, { action: "get_postage_docs" });
      const items = [];
      for (const d of docs) {
        if (/cancel|ยกเลิก/i.test(String(d.status || ""))) continue;
        for (const it of (Array.isArray(d.items) ? d.items : [])) items.push({ ...it, doc_no: d.doc_no, doc_status: d.status, branch_name: d.branch_name });
      }
      setPostItems(items);
    } catch { setPostItems([]); }
  }
  async function load() {
    setLoading(true);
    const d = await postJSON(API, { action: "list_mails", ...filter, limit: 1000 }).catch(() => null);
    if (d === null) setMessage("⚠️ โหลดไม่ได้ — n8n ยังไม่มี workflow mail-dispatch-api (ต้อง import Mail_Dispatch_API_Workflow.json + Active)");
    let list = [];
    if (d && typeof d.listjson === "string") { try { list = JSON.parse(d.listjson); } catch { list = []; } }
    setRows(Array.isArray(list) ? list : []);
    setSel(new Set());
    setLoading(false);
  }
  useEffect(() => { loadMaster(); loadPostage(); load(); /* eslint-disable-next-line */ }, []);

  // ที่อยู่ผู้ส่งจาก branch master ตามสังกัด/สาขา
  const senderInfo = useMemo(() => {
    const a = AFFIL[form.sender_affiliation] || AFFIL["ป.เปา"];
    const br = branches.find((x) => x.branch_code === form.sender_branch_code) || branches.find((x) => x.branch_code === a.defaultBranch);
    return { company: a.company, address: br?.address || "", phone: br?.phone || br?.mobile || "", branch_name: br?.branch_name || "" };
  }, [form.sender_affiliation, form.sender_branch_code, branches]);

  // จับคู่กับรายการค่าไปรษณีย์ (เงินสดย่อย): tracking ตรง → ชื่อผู้รับคล้าย + วันที่ส่ง −1..+10 วัน
  const postMatchOf = useMemo(() => {
    const byTrk = new Map();
    postItems.forEach((it) => { const k = trk(it.tracking_no); if (k) byTrk.set(k, it); });
    return (r) => {
      if (!r) return null;
      const k = trk(r.tracking_no);
      if (k && byTrk.has(k)) return byTrk.get(k);
      const rn = nn(r.recipient_name);
      if (!rn) return null;
      const from = shiftIso(String(r.send_date).slice(0, 10), -1), to = shiftIso(String(r.send_date).slice(0, 10), 10);
      const cands = postItems.filter((it) => { const pn = nn(it.recipient_name); const pd = String(it.post_date || "").slice(0, 10); return pn && pd >= from && pd <= to && (pn.includes(rn) || rn.includes(pn)); });
      if (!cands.length) return null;
      cands.sort((a, b) => String(a.post_date).localeCompare(String(b.post_date)));
      return cands[0];
    };
  }, [postItems]);
  const effStatus = (r) => (r.status === "ยกเลิก" || r.status === "จัดส่งสำเร็จ") ? r.status : (postMatchOf(r) ? "จัดส่งสำเร็จ" : r.status);

  // ---------- ผู้รับ ----------
  async function pickCustomer(c) {
    setPickerOpen(false);
    setF("recipient_type", "customer"); setF("recipient_code", c.code || ""); setF("recipient_name", c.name || ""); setF("recipient_phone", c.phone || "");
    // รวมที่อยู่จากทุกแหล่ง (ฐานลูกค้า / QR·LINE / ใบขาย / ประวัติขาย) ให้เลือก
    const opts = [];
    if (c.address) opts.push(c.address);
    try {
      const res = await listJSON(SEARCH_API, { action: "search_customers", keyword: c.name || c.phone || "" });
      const key = nn(c.name);
      for (const x of res) {
        const nm = nn(x.customer_name || [x.title, x.first_name, x.last_name].filter(Boolean).join(" "));
        const addr = String(x.customer_address || x.address || "").trim();
        if (addr && nm && (nm === key || nm.includes(key) || key.includes(nm)) && !opts.includes(addr)) opts.push(addr);
      }
    } catch { /* ไม่มีที่อยู่เพิ่ม */ }
    setAddrChoices(opts);
    setF("recipient_address", opts[0] || "");
  }
  const SRC_LABEL = { "ประวัติขาย": "ผู้ซื้อรถ", "ใบขายปลีก": "ใบขาย NEW", "QR/LINE": "QR/LINE", "ฐานลูกค้า": "ฐานลูกค้า" };
  async function searchRecipients() {
    const q = recQ.trim();
    if (q.length < 2) { setRecHits([]); return; }
    setRecSearching(true);
    let out = [];
    try {
      const res = await listJSON(SEARCH_API, { action: "search_customers", keyword: q });
      // รวมทุกแหล่ง (ฐานลูกค้า / ผู้ซื้อรถ=ประวัติขาย / ใบขายปลีก / QR-LINE) — รวมชื่อเดียวกันเป็น 1 แถว เก็บที่อยู่ทุกแบบไว้ให้เลือก
      const byKey = new Map();
      for (const x of res) {
        if (!x || !x.customer_name) continue;
        const key = nn(x.customer_name) + "|" + String(x.customer_phone || "").replace(/\D/g, "").slice(-9);
        const g = byKey.get(key) || { type: "customer", code: "", name: x.customer_name, phone: x.customer_phone || "", addrs: [], sources: [], last: "" };
        if (!g.code && x.customer_code) g.code = x.customer_code;
        const a = String(x.customer_address || "").trim(); if (a && !g.addrs.includes(a)) g.addrs.push(a);
        const sl = SRC_LABEL[x.source] || x.source || ""; if (sl && !g.sources.includes(sl)) g.sources.push(sl);
        if (String(x.ref_at || "") > g.last) g.last = String(x.ref_at || "");
        byKey.set(key, g);
      }
      out = [...byKey.values()].sort((a, b) => b.last.localeCompare(a.last)).slice(0, 25);
    } catch { out = []; }
    const ql = q.toLowerCase();
    const vs = vendors.filter((v) => String(v.vendor_name || "").toLowerCase().includes(ql)).slice(0, 10)
      .map((v) => ({ type: "vendor", code: String(v.vendor_id || ""), name: v.vendor_name, phone: v.phone || "", addrs: vendorAddr(v) ? [vendorAddr(v)] : [], sources: ["Vendor"], last: "" }));
    setRecHits([...out, ...vs]);
    setRecSearching(false);
  }
  function pickHit(h) {
    setF("recipient_type", h.type); setF("recipient_code", h.code || ""); setF("recipient_name", h.name || ""); setF("recipient_phone", h.phone || "");
    setAddrChoices(h.addrs); setF("recipient_address", h.addrs[0] || ""); setRecHits(null); setRecQ("");
  }

  function openNew() { setForm(emptyForm()); setAddrChoices([]); setFormOpen(true); setMessage(""); }
  function openEdit(r) {
    if (r.status === "จัดส่งสำเร็จ") { alert("รายการที่จัดส่งสำเร็จแล้ว แก้ไขไม่ได้"); return; } // user 2026-09-30
    setForm({ id: r.id, send_date: String(r.send_date || "").slice(0, 10), sender_affiliation: r.sender_affiliation || "ป.เปา", sender_branch_code: r.sender_branch_code || "", sender_name: r.sender_name || "",
      recipient_type: r.recipient_type || "other", recipient_code: r.recipient_code || "", recipient_name: r.recipient_name || "", recipient_attn: r.recipient_attn || "", recipient_address: r.recipient_address || "", recipient_phone: r.recipient_phone || "",
      doc_desc: r.doc_desc || "", method: r.method || "ธรรมดา", tracking_no: r.tracking_no || "", envelope: r.envelope || "dl", note: r.note || "" });
    setAddrChoices(r.recipient_address ? [r.recipient_address] : []); setFormOpen(true); setMessage("");
  }
  async function save(printAfter) {
    const senderName = (form.sender_name || currentUser?.name || currentUser?.username || "").trim();
    if (!senderName) { alert("ไม่พบชื่อผู้ใช้ที่ล็อกอิน"); return; }
    if (!form.recipient_name.trim()) { alert("กรุณาเลือกหรือพิมพ์ชื่อผู้รับ"); return; }
    if (!form.recipient_address.trim()) { alert("กรุณาระบุที่อยู่ผู้รับ"); return; }
    setSaving(true);
    try {
      const body = { action: "save_mail", ...form, sender_name: senderName, sender_company: senderInfo.company, sender_address: senderInfo.address, sender_phone: senderInfo.phone,
        created_by: currentUser?.name || currentUser?.username || "", updated_by: currentUser?.name || currentUser?.username || "" };
      const res = await postJSON(API, body);
      if (!res) throw new Error("n8n ยังไม่มี workflow mail-dispatch-api");
      if (res.__error) throw new Error(res.__error);
      if (!res.doc_no) throw new Error("บันทึกไม่สำเร็จ");
      setMessage(`✅ บันทึก ${res.doc_no} แล้ว (${res.method} → ${res.recipient_name})`);
      setFormOpen(false);
      await load();
      if (printAfter) printEnvelope(res, form.envelope || envKey);
    } catch (e) { alert(`❌ ${e.message || e}`); }
    setSaving(false);
  }
  // จับคู่กับรายการค่าไปรษณีย์ในเงินสดย่อยอัตโนมัติ (user 2026-09-30: ไม่มีปุ่ม "ส่งแล้ว") — พบคู่แล้วบันทึกสถานะ จัดส่งสำเร็จ + tracking + ค่าส่ง ลง DB
  useEffect(() => {
    if (!rows.length || !postItems.length) return;
    const todo = rows.filter((r) => r.status !== "ยกเลิก" && r.status !== "จัดส่งสำเร็จ" && postMatchOf(r));
    if (!todo.length) return;
    let alive = true;
    (async () => {
      let n = 0;
      for (const r of todo) {
        const m = postMatchOf(r);
        const res = await postJSON(API, { action: "update_mail_status", id: r.id, status: "จัดส่งสำเร็จ", tracking_no: r.tracking_no || m.tracking_no || "", sent_at: m.post_date, postage_doc_no: m.doc_no, postage_amount: m.amount, postage_date: m.post_date, updated_by: "auto:เงินสดย่อยค่าไปรษณีย์" }).catch(() => null);
        if (res?.doc_no) n += 1;
      }
      if (alive && n) { setMessage(`✅ จับคู่ค่าไปรษณีย์ในเงินสดย่อยอัตโนมัติ ${n} รายการ → จัดส่งสำเร็จ`); load(); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [rows, postItems]);
  async function cancel(r) {
    const reason = window.prompt(`ยกเลิก ${r.doc_no}? ระบุเหตุผล`, "");
    if (reason === null) return;
    const res = await postJSON(API, { action: "cancel_mail", id: r.id, reason, updated_by: currentUser?.name || "" }).catch(() => null);
    if (res?.doc_no) { setMessage(`ยกเลิก ${r.doc_no} แล้ว`); load(); } else alert("ยกเลิกไม่สำเร็จ");
  }

  const stats = useMemo(() => { const c = {}; rows.forEach((r) => { const s = effStatus(r); c[s] = (c[s] || 0) + 1; }); return c; }, [rows, postItems]);
  const toggleAll = (checked) => setSel(checked ? new Set(rows.filter((r) => r.status !== "ยกเลิก").map((r) => r.id)) : new Set());

  return (
    <div className="page-container">
      <div className="page-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div className="page-title">✉️ บันทึกส่งเอกสารทางไปรษณีย์</div>
        <button className="btn-primary" onClick={openNew}>+ บันทึกส่งเอกสาร</button>
      </div>
      {message && <div style={{ padding: "8px 14px", background: message.startsWith("⚠️") ? "#fef3c7" : "#d1fae5", borderRadius: 8, marginBottom: 10, color: message.startsWith("⚠️") ? "#92400e" : "#065f46" }}>{message}</div>}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <input type="date" value={filter.date_from} onChange={(e) => setFilter({ ...filter, date_from: e.target.value })} style={{ ...inp, width: 150 }} />
        <span style={{ fontSize: 12, color: "#6b7280" }}>ถึง</span>
        <input type="date" value={filter.date_to} onChange={(e) => setFilter({ ...filter, date_to: e.target.value })} style={{ ...inp, width: 150 }} />
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} style={{ ...inp, width: 150 }}>
          <option value="">ทุกสถานะ</option>{Object.keys(STATUS_STYLE).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={filter.keyword} onChange={(e) => setFilter({ ...filter, keyword: e.target.value })} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="ค้นหา เลขที่ / ผู้รับ / ผู้ส่ง / tracking / เอกสาร" style={{ ...inp, width: 300 }} />
        <button onClick={() => { load(); loadPostage(); }} style={btn("#072d6b")}>ค้นหา</button>
        <span style={{ fontSize: 12.5, color: "#374151" }}>
          {rows.length} รายการ · {Object.entries(stats).map(([s, n]) => <span key={s} style={{ marginLeft: 6, padding: "1px 8px", borderRadius: 10, background: STATUS_STYLE[s]?.bg, color: STATUS_STYLE[s]?.fg, fontSize: 11, fontWeight: 700 }}>{s} {n}</span>)}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#072d6b" }}>🖨️ พิมพ์ป้ายที่อยู่ลง A4 (ติ๊ก {sel.size})</span>
        <select value={envKey} onChange={(e) => setEnvKey(e.target.value)} style={{ ...inp, width: 260 }}>{ENVELOPES.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select>
        <button disabled={!sel.size} onClick={() => printEnvelope(rows.filter((r) => sel.has(r.id)), envKey)} style={{ ...btn(sel.size ? "#b45309" : "#d1d5db"), cursor: sel.size ? "pointer" : "default" }}>พิมพ์ป้ายที่อยู่</button>
        <span style={{ fontSize: 11.5, color: "#6b7280" }}>สถานะ "จัดส่งสำเร็จ" บันทึกให้อัตโนมัติเมื่อพบรายการค่าไปรษณีย์ในเงินสดย่อยที่ tracking ตรง หรือชื่อผู้รับตรงในช่วง 10 วันหลังวันส่ง (ไม่ต้องกดอะไร)</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ fontSize: 12.5 }}>
          <thead><tr>
            <th style={{ width: 30 }}><input type="checkbox" checked={rows.length > 0 && rows.filter((r) => r.status !== "ยกเลิก").every((r) => sel.has(r.id))} onChange={(e) => toggleAll(e.target.checked)} /></th>
            <th>เลขที่</th><th>วันที่ส่ง</th><th>ผู้ส่ง</th><th>ผู้รับ</th><th>เอกสาร</th><th>วิธีส่ง / tracking</th><th>สถานะ</th><th>ค่าไปรษณีย์ (เงินสดย่อย)</th><th>จัดการ</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={10} style={{ textAlign: "center", padding: 20 }}>กำลังโหลด…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={10} style={{ textAlign: "center", padding: 20, color: "#9ca3af" }}>ยังไม่มีรายการ</td></tr>
              : rows.map((r) => {
                const st = effStatus(r); const m = postMatchOf(r); const cancelled = r.status === "ยกเลิก";
                return (
                  <tr key={r.id} style={{ opacity: cancelled ? 0.5 : 1 }}>
                    <td>{!cancelled && <input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel((p) => { const n = new Set(p); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} />}</td>
                    <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{r.doc_no}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{thDate(r.send_date)}</td>
                    <td><div>{r.sender_name}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{r.sender_affiliation}{r.sender_branch_code ? ` · ${r.sender_branch_code}` : ""}</div></td>
                    <td style={{ maxWidth: 260 }}><div style={{ fontWeight: 600 }}>{r.recipient_name}</div>{r.recipient_attn && <div style={{ fontSize: 11.5 }}>{r.recipient_attn}</div>}<div style={{ fontSize: 11, color: "#6b7280", whiteSpace: "normal" }}>{r.recipient_address}</div>{r.recipient_phone && <div style={{ fontSize: 11, color: "#6b7280" }}>โทร. {r.recipient_phone}</div>}</td>
                    <td style={{ maxWidth: 200, whiteSpace: "normal" }}>{r.doc_desc || "-"}</td>
                    <td><div style={{ fontWeight: 700 }}>{r.method}</div>{r.tracking_no && <div style={{ fontFamily: "monospace", fontSize: 11 }}>{r.tracking_no}</div>}</td>
                    <td><span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: STATUS_STYLE[st]?.bg, color: STATUS_STYLE[st]?.fg, whiteSpace: "nowrap" }}>{st}</span>{r.sent_at && <div style={{ fontSize: 10.5, color: "#6b7280" }}>ส่ง {thDate(r.sent_at)}</div>}</td>
                    <td style={{ fontSize: 11.5 }}>
                      {m ? <><div>{m.doc_no} · {thDate(m.post_date)}</div><div>{m.description} <b>{Number(m.amount || 0).toLocaleString()} บาท</b></div></>
                        : r.postage_doc_no ? <div>{r.postage_doc_no} · {Number(r.postage_amount || 0).toLocaleString()} บาท</div> : <span style={{ color: "#9ca3af" }}>ยังไม่พบ</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button onClick={() => printEnvelope(r, r.envelope || envKey)} title="พิมพ์ป้ายที่อยู่ (A4 ตัดแปะซอง)" style={{ ...btn("#072d6b"), padding: "3px 9px", fontSize: 11, marginRight: 4 }}>🖨️</button>
                      {!cancelled && r.status !== "จัดส่งสำเร็จ" && <button onClick={() => openEdit(r)} style={{ ...btn("#f59e0b"), padding: "3px 9px", fontSize: 11, marginRight: 4 }}>แก้ไข</button>}
                      {!cancelled && (isAdmin || r.status === "รอส่ง") && <button onClick={() => cancel(r)} style={{ ...btn("#ef4444"), padding: "3px 9px", fontSize: 11 }}>ยกเลิก</button>}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "24px 12px" }} onClick={() => !saving && setFormOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: 860, maxWidth: "100%", fontFamily: "Tahoma" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>{form.id ? `แก้ไข ${rows.find((r) => r.id === form.id)?.doc_no || ""}` : "บันทึกส่งเอกสารทางไปรษณีย์"}</h3>
              <button onClick={() => setFormOpen(false)} style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 8 }}>ผู้ส่ง</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <div><label style={lbl}>วันที่ส่ง</label><input type="date" value={form.send_date} onChange={(e) => setF("send_date", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>สังกัดผู้ส่ง</label>
                  <select value={form.sender_affiliation} onChange={(e) => { setF("sender_affiliation", e.target.value); setF("sender_branch_code", AFFIL[e.target.value].defaultBranch); }} style={inp}>
                    {Object.keys(AFFIL).map((k) => <option key={k} value={k}>{k} — {AFFIL[k].company}</option>)}
                  </select></div>
                <div><label style={lbl}>สาขา (ที่อยู่บนซอง)</label>
                  <select value={form.sender_branch_code} onChange={(e) => setF("sender_branch_code", e.target.value)} style={inp}>
                    {(AFFIL[form.sender_affiliation]?.branches || []).map((bc) => { const b = branches.find((x) => x.branch_code === bc); return <option key={bc} value={bc}>{bc} {b?.branch_name || ""}</option>; })}
                  </select></div>
                <div><label style={lbl}>พนักงานผู้ส่ง (จากผู้ใช้ที่ล็อกอิน)</label>
                  <div style={{ ...inp, background: "#f3f4f6", color: "#374151" }}>{form.sender_name || currentUser?.name || currentUser?.username || "-"}</div></div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#374151", background: "#f8fafc", padding: "6px 10px", borderRadius: 8 }}>
                <b>{senderInfo.company}</b> · {senderInfo.address || <span style={{ color: "#b91c1c" }}>ไม่พบที่อยู่สาขาใน master</span>}{senderInfo.phone ? ` · โทร. ${senderInfo.phone}` : ""}
              </div>
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: "#15803d", marginBottom: 8 }}>ผู้รับ</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                <div style={{ position: "relative", flex: 1, minWidth: 320 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={recQ} onChange={(e) => setRecQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchRecipients()} autoFocus
                      placeholder="🔍 ค้นหาผู้รับ: ชื่อลูกค้า / ผู้ซื้อรถ / เบอร์โทร / บริษัท-Vendor แล้วกด Enter" style={inp} />
                    <button onClick={searchRecipients} disabled={recSearching} style={btn("#0369a1")}>{recSearching ? "กำลังค้น…" : "ค้นหา"}</button>
                  </div>
                  {recHits && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, zIndex: 5, maxHeight: 300, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,.12)" }}>
                      {recHits.length === 0 ? <div style={{ padding: 10, color: "#9ca3af", fontSize: 12.5 }}>ไม่พบ — พิมพ์เองได้ที่ช่องด้านล่าง</div> :
                        recHits.map((h, i) => (
                          <div key={i} onClick={() => pickHit(h)} style={{ padding: "6px 10px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", fontSize: 12.5 }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600 }}>{h.name}</span>
                              {h.phone && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{h.phone}</span>}
                              {h.sources.map((sl) => <span key={sl} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: sl === "Vendor" ? "#ede9fe" : sl === "ผู้ซื้อรถ" ? "#dcfce7" : "#e0f2fe", color: sl === "Vendor" ? "#5b21b6" : sl === "ผู้ซื้อรถ" ? "#166534" : "#075985", fontWeight: 700 }}>{sl}</span>)}
                            </div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>{h.addrs.length ? h.addrs[0] + (h.addrs.length > 1 ? ` (+อีก ${h.addrs.length - 1} ที่อยู่)` : "") : "ไม่มีที่อยู่ — พิมพ์เอง"}</div>
                          </div>))}
                      <div onClick={() => setRecHits(null)} style={{ padding: "5px 10px", textAlign: "right", fontSize: 11, color: "#6b7280", cursor: "pointer" }}>ปิด</div>
                    </div>)}
                </div>
                <button onClick={() => setPickerOpen(true)} style={btn("#6b7280")} title="ตัวเลือกลูกค้าแบบเต็ม (เพิ่มลูกค้าใหม่ / QR)">👤 รายชื่อลูกค้า</button>
                <button onClick={() => { setF("recipient_type", "other"); setF("recipient_code", ""); setAddrChoices([]); }} style={btn("#6b7280")}>✏️ พิมพ์เอง</button>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{form.recipient_type === "customer" ? "ลูกค้า" : form.recipient_type === "vendor" ? "Vendor" : "พิมพ์เอง"}{form.recipient_code ? ` · ${form.recipient_code}` : ""}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 10 }}>
                <div><label style={lbl}>ชื่อผู้รับ (บริษัท/ลูกค้า) *</label><input value={form.recipient_name} onChange={(e) => setF("recipient_name", e.target.value)} style={inp} /></div>
                <div><label style={lbl}>ชื่อบุคคล/แผนกผู้รับ (ถ้ามี)</label><input value={form.recipient_attn} onChange={(e) => setF("recipient_attn", e.target.value)} placeholder="เช่น คุณสมชาย ฝ่ายทะเบียน — เว้นว่างได้" style={inp} /></div>
                <div><label style={lbl}>เบอร์โทรผู้รับ</label><input value={form.recipient_phone} onChange={(e) => setF("recipient_phone", e.target.value)} style={inp} /></div>
              </div>
              {addrChoices.length > 1 && (
                <div style={{ marginTop: 8 }}>
                  <label style={lbl}>พบที่อยู่ {addrChoices.length} แห่ง — เลือก</label>
                  {addrChoices.map((a, i) => (
                    <label key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12.5, padding: "4px 6px", background: form.recipient_address === a ? "#ecfdf5" : "transparent", borderRadius: 6, cursor: "pointer" }}>
                      <input type="radio" name="addr" checked={form.recipient_address === a} onChange={() => setF("recipient_address", a)} /> <span>{a}</span>
                    </label>))}
                </div>)}
              <div style={{ marginTop: 8 }}><label style={lbl}>ที่อยู่ผู้รับ (แก้ไขได้) *</label><textarea value={form.recipient_address} onChange={(e) => setF("recipient_address", e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} /></div>
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: "#b45309", marginBottom: 8 }}>เอกสารและวิธีส่ง</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <div style={{ gridColumn: "span 2" }}><label style={lbl}>เอกสารที่ส่ง</label><input value={form.doc_desc} onChange={(e) => setF("doc_desc", e.target.value)} placeholder="เช่น เล่มทะเบียน / ใบกำกับภาษี / เอกสารประกัน" style={inp} /></div>
                <div><label style={lbl}>วิธีส่ง</label><select value={form.method} onChange={(e) => setF("method", e.target.value)} style={inp}>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
                {form.id > 0 && String(rows.find((r) => r.id === form.id)?.status || "") !== "รอส่ง" && (
                  <div><label style={lbl}>เลขพัสดุ / tracking</label><input value={form.tracking_no} onChange={(e) => setF("tracking_no", e.target.value)} style={{ ...inp, fontFamily: "monospace" }} /></div>
                )}
                <div><label style={lbl}>ขนาดซอง (กำหนดขนาดป้าย)</label><select value={form.envelope} onChange={(e) => setF("envelope", e.target.value)} style={inp}>{ENVELOPES.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select></div>
                <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>หมายเหตุ</label><input value={form.note} onChange={(e) => setF("note", e.target.value)} style={inp} /></div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setFormOpen(false)} disabled={saving} style={{ padding: "8px 18px", border: "1px solid #d1d5db", background: "#fff", borderRadius: 8, cursor: "pointer" }}>ปิด</button>
              <button onClick={() => save(false)} disabled={saving} style={btn(saving ? "#9ca3af" : "#072d6b")}>{saving ? "กำลังบันทึก…" : "บันทึก"}</button>
              <button onClick={() => save(true)} disabled={saving} style={btn(saving ? "#9ca3af" : "#b45309")}>บันทึก + พิมพ์ป้ายที่อยู่</button>
            </div>
          </div>
        </div>
      )}
      {pickerOpen && <CustomerPickerModal currentUser={currentUser} onSelect={pickCustomer} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
