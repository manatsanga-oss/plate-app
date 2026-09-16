import React, { useEffect, useState } from "react";

// รายการรับชำระเงินค่าอะไหล่และบริการ — upload 3 ไฟล์ (user 2026-09-16)
//  1) DMS (YAMAHA สิงห์ชัย): "รายงานสรุปรายวันรับเงิน" xlsx — ใบเสร็จ SCYxx-RP/RSV… ประเภทขายอะไหล่-งานบริการ (48 คอลัมน์) → dms_part_service_receipts
//  2) NIDS ขายอะไหล่ (HONDA ป.เปา): XLS ใบเสร็จ 69SREC (บรรทัดวิธีชำระ 10 ช่อง) + บรรทัดใบขาย 69RTSL → nid_part_sale_receipts + _items
//  3) NIDS งานบริการ (HONDA ป.เปา): XLS ใบเสร็จ SR-… อ้าง 69SERV แยกกลุ่มประเภทบริการ (GR/PM) → nid_service_receipts
// parse ฝั่ง client ด้วย SheetJS → webhook part-service-receipt-upload-api (UPSERT เลขที่ใบเสร็จ อัปโหลดซ้ำได้)
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/part-service-receipt-upload-api";
// NIDS: ไฟล์เดียวมีได้หลายสาขา (แถว "สาขา : …") → แยกสาขาอัตโนมัติจากชื่อสาขาในไฟล์ (user 2026-09-16)
const NID_BRANCH_OF = (name) => {
  const n = String(name || "");
  if (/นครหลวง/.test(n) || /สาขาที่\s*0*1(\D|$)/.test(n)) return "SCY05"; // NIDS เรียกนครหลวงว่า "สาขาที่ 00001"
  if (/สำนักงานใหญ่|วังน้อย|ป\.เปา/.test(n)) return "SCY06";
  return "";
};

const txt = (v) => String(v == null ? "" : v).trim();
const num = (v) => { if (v == null || v === "") return 0; const n = Number(String(v).replace(/,/g, "").trim()); return Number.isFinite(n) ? n : 0; };
const fmt = (n) => Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, "0");
// วันที่: เลข serial ของ Excel (อ่านแบบ raw ไม่ให้ SheetJS แปลงเป็น Date — กันเวลาเลื่อนตาม timezone 1 วัน) / "dd/mm/พ.ศ." (NID) / "2026-09-01 …" → ISO ค.ศ.
let _XLSX = null;
const serialToParts = (n) => (_XLSX && typeof n === "number" && n > 20000) ? _XLSX.SSF.parse_date_code(n) : null;
function toIso(v) {
  if (v == null || v === "") return null;
  const sp = serialToParts(v); if (sp) return `${sp.y}-${pad(sp.m)}-${pad(sp.d)}`;
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const s = txt(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { let y = Number(m[3]); if (y < 100) y += 2000; if (y > 2400) y -= 543; return `${y}-${pad(m[2])}-${pad(m[1])}`; }
  return null;
}
function toTs(v) {
  const sp = serialToParts(v); if (sp) return `${sp.y}-${pad(sp.m)}-${pad(sp.d)} ${pad(sp.H)}:${pad(sp.M)}:${pad(Math.floor(sp.S))}`;
  if (v instanceof Date && !isNaN(v)) return `${toIso(v)} ${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;
  const s = txt(v); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 19) : null;
}
const isDateStr = (s) => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(txt(s));
async function readGrid(file) {
  const XLSX = await import("xlsx"); _XLSX = XLSX;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
}

// ---------- parser 1: DMS ----------
function parseDms(grid) {
  const hi = grid.findIndex(r => txt(r[0]) === "เลขที่ใบเสร็จรับเงิน");
  if (hi < 0) throw new Error('ไม่พบหัวตาราง "เลขที่ใบเสร็จรับเงิน" — ตรวจว่าเป็นรายงานสรุปรายวันรับเงินจาก DMS');
  const H = grid[hi].map(txt);
  const idx = (name) => H.findIndex(h => h.replace(/\s+/g, "") === name.replace(/\s+/g, ""));
  const col = (r, name) => { const i = idx(name); return i >= 0 ? r[i] : ""; };
  const out = [];
  for (let i = hi + 1; i < grid.length; i++) {
    const r = grid[i] || []; const no = txt(r[0]);
    if (!/^[A-Z0-9]+-[A-Z]+\d+/i.test(no)) continue;
    out.push({
      receipt_no: no, branch_code: no.split("-")[0].toUpperCase(),
      receipt_date: toIso(col(r, "วันที่ใบเสร็จรับเงิน")), recorded_at: toTs(col(r, "วันเวลาที่บันทึกใบเสร็จรับเงิน")),
      receipt_type: txt(col(r, "ประเภทใบเสร็จรับเงิน")), vat_rate: num(col(r, "อัตราภาษี")),
      amount_before_vat: num(col(r, "ยอดก่อนภาษี")), vat_amount: num(col(r, "ภาษีมูลค่าเพิ่ม")), total_amount: num(col(r, "รวมยอดชำระ")), status: txt(col(r, "สถานะใบเสร็จรับเงิน")),
      pay_cash: num(col(r, "เงินสด")), pay_transfer: num(col(r, "เงินโอน")), pay_cheque: num(col(r, "เช็ค")), bank_fee: num(col(r, "ค่าธรรมเนียมธนาคาร")), pay_deposit: num(col(r, "เงินมัดจำ")),
      pay_credit_card: num(col(r, "CreditCard")), pay_credit_note: num(col(r, "ใบลดหนี้")), pay_wht: num(col(r, "WHT")), pay_smartpurse: num(col(r, "SmartPurse")), pay_coupon: num(col(r, "คูปอง")),
      round_up: num(col(r, "ปัดเศษขึ้น")), round_down: num(col(r, "ปัดเศษลง")), account_credit: num(col(r, "AccountCredit")), related_account: txt(col(r, "บัญชีที่เกี่ยวข้อง")),
      qr_credit_card: num(col(r, "QR_CreditCard")), qr_cash: num(col(r, "QR_เงินสด")), account_code: txt(col(r, "รหัสบัญชีที่เกี่ยวข้อง")), account_name: txt(col(r, "ชื่อบัญชีที่เกี่ยวข้อง")),
      credit_card_no: txt(col(r, "CreditCardNo")), coupon_no: txt(col(r, "เลขคูปอง")), customer_id_card: txt(col(r, "เลขบัตรประจำตัวประชาชน")), customer_name: txt(col(r, "ชื่อลูกค้า")), cashier: txt(col(r, "พนักงานรับเงิน")),
      ref_doc_no: txt(col(r, "เลขที่เอกสารอ้างอิง")), ref_doc_date: toIso(col(r, "วันที่เอกสารอ้างอิง")), ref_doc_type: txt(col(r, "ประเภทเอกสารอ้างอิง")), ref_doc_status: txt(col(r, "สถานะเอกสารอ้างอิง")),
      tax_invoice_no: txt(col(r, "เลขที่ใบกำกับภาษี")), tax_invoice_date: toIso(col(r, "วันที่ใบกำกับภาษี")), tax_invoice_status: txt(col(r, "สถานะใบกำกับภาษี")), tax_invoice_name: txt(col(r, "ชื่อในใบกำกับภาษี")), tax_id: txt(col(r, "เลขที่ผู้เสียภาษี")),
      receipt_note: txt(col(r, "หมายเหตุใบเสร็จ")), ref_note: txt(col(r, "หมายเหตุเอกสารอ้างอิง")), tax_note: txt(col(r, "หมายเหตุใบกำกับภาษี")),
    });
  }
  if (!out.length) throw new Error("ไม่พบใบเสร็จในไฟล์");
  return out;
}

// NIDS: เลขใบเสร็จเริ่มนับใหม่แยกสาขา → ทุกใบต้องมีรหัสสาขา ไม่งั้นห้าม upload (เคยได้แถวสาขาว่าง 55 ใบ 2026-09-16)
function assertBranch(out) {
  const miss = out.filter(r => !r.branch_code);
  if (miss.length) throw new Error(`ไม่รู้จักสาขา "${[...new Set(miss.map(r => r.branch_name || "(ว่าง)"))].join(", ")}" (${miss.length} ใบ) — ต้องเป็น สำนักงานใหญ่/วังน้อย → SCY06 หรือ สาขาที่ 00001/นครหลวง → SCY05`);
}

// ---------- parser 2: NIDS ขายอะไหล่ ----------
// โครง: แถววันที่ (col0 = dd/mm/พ.ศ.) → คู่ [69SREC… | ลูกค้า | วิธีชำระ 10 ช่อง | รวม] แล้วตาม [69RTSL… | วันที่ใบกำกับ | เลขใบกำกับ | รวมเงิน | ส่วนลด | ภาษี | สุทธิ | ยอดรับชำระ]
// ช่องวิธีชำระที่ยืนยันจากข้อมูล: ช่อง1 = เงินสด, ช่อง4 = เงินโอน, ช่อง7 = มัดจำ, ช่อง10 = อื่น ๆ — ช่องที่เหลือเก็บดิบ (pay_c3, c4, c6, c7, c9, c10)
function parseNidSale(grid) {
  const hi = grid.findIndex(r => txt(r[0]) === "เลขที่ใบขาย");
  if (hi < 0) throw new Error('ไม่พบหัวตาราง "เลขที่ใบขาย" — ตรวจว่าเป็นรายงานรับชำระขายอะไหล่ NIDS');
  let branchName = "", curDate = null, cur = null; const out = [];
  for (let i = hi + 1; i < grid.length; i++) {
    const r = grid[i] || []; const c0 = txt(r[0]);
    if (!c0 && !txt(r[1])) continue;
    if (c0.startsWith("สาขา")) { branchName = txt(r[1]) || c0.replace(/^สาขา\s*:?\s*/, ""); continue; }
    if (isDateStr(c0)) { curDate = toIso(c0); continue; }
    if (c0.startsWith("รวม") || c0.startsWith("ยอดรวม") || c0.includes("จบรายงาน")) continue;
    if (/SREC/i.test(c0)) {
      cur = { receipt_no: c0, branch_name: branchName, branch_code: NID_BRANCH_OF(branchName), receipt_date: curDate, customer_name: txt(r[1]),
        pay_cash: num(r[2]), pay_c3: num(r[3]), pay_c4: num(r[4]), pay_transfer: num(r[5]), pay_c6: num(r[6]), pay_c7: num(r[7]), pay_deposit: num(r[8]), pay_c9: num(r[9]), pay_c10: num(r[10]), pay_other: num(r[11]), total_amount: num(r[12]), items: [] };
      out.push(cur); continue;
    }
    if (cur && c0.includes("/") && isDateStr(r[1])) {
      cur.items.push({ sale_doc_no: c0, tax_invoice_date: toIso(r[1]), tax_invoice_no: txt(r[2]), amount: num(r[3]), discount: num(r[4]), vat_amount: num(r[5]), net_amount: num(r[6]), paid_amount: num(r[7]) });
    }
  }
  if (!out.length) throw new Error("ไม่พบใบเสร็จ SREC ในไฟล์");
  assertBranch(out);
  return out;
}

// ---------- parser 3: NIDS งานบริการ ----------
// โครง: แถวสาขา → แถวประเภทบริการ (GR/PM …) → แถววันที่ (col0) พร้อมใบแรก → ใบถัดไป col0 ว่าง → แถว "ยอดรวมตามวันที่"
function parseNidService(grid) {
  const hi = grid.findIndex(r => txt(r[0]) === "วันที่รับชำระ");
  if (hi < 0) throw new Error('ไม่พบหัวตาราง "วันที่รับชำระ" — ตรวจว่าเป็นรายงานรับชำระงานบริการ NIDS');
  let branchName = "", svcType = "", curDate = null; const out = [];
  for (let i = hi + 1; i < grid.length; i++) {
    const r = grid[i] || []; const c0 = txt(r[0]), c1 = txt(r[1]);
    if (!c0 && !c1) continue;
    if (c0.startsWith("สาขา")) { branchName = c0.replace(/^สาขา\s*:?\s*/, "").trim() || c1; continue; }
    if (c0.startsWith("ยอดรวม") || c0.includes("จบรายงาน")) continue;
    if (isDateStr(c0)) curDate = toIso(c0);
    else if (c0 && !c1) { svcType = c0; continue; }
    if (!/^SR-/i.test(c1)) continue;
    const cm = txt(r[2]).match(/^(\S+)\s+(.*)$/);
    out.push({ receipt_no: c1, branch_name: branchName, branch_code: NID_BRANCH_OF(branchName), receipt_date: curDate, service_type: svcType,
      customer_code: cm ? cm[1] : "", customer_name: cm ? cm[2].trim() : txt(r[2]), ref_job_no: txt(r[3]),
      labor_amount: num(r[4]), parts_amount: num(r[5]), discount: num(r[6]), total_amount: num(r[7]), vat_amount: num(r[8]), amount_before_vat: num(r[9]) });
  }
  if (!out.length) throw new Error("ไม่พบใบเสร็จ SR- ในไฟล์");
  assertBranch(out);
  return out;
}

const fmtTs = (v) => { if (!v) return "—"; const d = new Date(v); return isNaN(d) ? String(v) : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function UploadBlock({ title, desc, table, accept, action, parser, summary, currentUser, last, count, onDone, color }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function handleParse(f) {
    setMsg(""); setRows([]); if (!f) return;
    setBusy(true);
    try { const grid = await readGrid(f); const out = parser(grid); setRows(out); setMsg(`อ่านได้ ${out.length} ใบ · ${summary(out)} — กด Upload เพื่อนำเข้า`); }
    catch (e) { setMsg("❌ อ่านไฟล์ไม่สำเร็จ: " + e.message); }
    setBusy(false);
  }
  async function handleUpload() {
    if (!rows.length) return;
    setBusy(true); setMsg("");
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, rows, uploaded_by: currentUser?.name || currentUser?.username || "ผู้ดูแลระบบ", source_file: file?.name || "" }) });
      const t = (await res.text()).trim(); let d = null; try { d = JSON.parse(t); } catch { /* ว่าง */ }
      const row0 = Array.isArray(d) ? d[0] : d;
      if (row0 && row0.result === "ok") { setMsg(`✅ นำเข้าสำเร็จ ${row0.total} ใบ${row0.items != null ? ` (${row0.items} บรรทัดใบขาย)` : ""}`); setRows([]); setFile(null); onDone && onDone(); }
      else setMsg("❌ นำเข้าไม่สำเร็จ: " + (row0?.error || t || "ไม่มีการตอบกลับจาก n8n (ตรวจว่า import workflow part-service-receipt-upload-api และ Active แล้ว)"));
    } catch (e) { setMsg("❌ นำเข้าไม่สำเร็จ: " + e.message); }
    setBusy(false);
  }
  return (
    <div style={{ border: `2px solid ${color}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{desc}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>📦 Table: <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4, color: "#7c3aed" }}>{table}</code> · 🕒 ล่าสุด: <span style={{ color: last ? "#059669" : "#9ca3af" }}>{fmtTs(last)}</span>{count != null ? <span> · {Number(count).toLocaleString("th-TH")} ใบในระบบ</span> : null}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="file" accept={accept} onChange={e => { const f = e.target.files?.[0] || null; setFile(f); handleParse(f); }} style={{ fontSize: 13 }} />
        <button onClick={handleUpload} disabled={busy || rows.length === 0}
          style={{ padding: "9px 22px", background: rows.length ? "#072d6b" : "#9ca3af", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: rows.length ? "pointer" : "not-allowed" }}>
          {busy ? "กำลังทำงาน..." : "💾 Upload รายการ"}
        </button>
      </div>
      {msg && <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13, background: msg.startsWith("❌") ? "#fee2e2" : msg.startsWith("✅") ? "#dcfce7" : "#fffbeb", color: msg.startsWith("❌") ? "#991b1b" : msg.startsWith("✅") ? "#166534" : "#92400e" }}>{msg}</div>}
      {rows.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
          ตัวอย่าง: {rows.slice(0, 3).map(r => `${r.receipt_no} (${fmt(r.total_amount)})`).join(" · ")}{rows.length > 3 ? ` … อีก ${rows.length - 3} ใบ` : ""}
        </div>
      )}
    </div>
  );
}

export default function PartServiceReceiptUploadCard({ currentUser }) {
  const [last, setLast] = useState({});
  async function loadLast() {
    try {
      const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "last_uploads" }) });
      const t = (await res.text()).trim(); const d = t ? JSON.parse(t) : null; const row0 = Array.isArray(d) ? d[0] : d;
      if (row0 && typeof row0 === "object") setLast(row0);
    } catch { /* workflow ยังไม่ import */ }
  }
  useEffect(() => { loadLast(); }, []);
  const sumTotal = (rows) => `รวม ${fmt(rows.reduce((s, r) => s + num(r.total_amount), 0))} บาท`;
  const dateRange = (rows) => { const ds = rows.map(r => r.receipt_date).filter(Boolean).sort(); return ds.length ? ` · ${ds[0]} ถึง ${ds[ds.length - 1]}` : ""; };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
      <UploadBlock color="#1e40af" title="🔵 1. ขายอะไหล่และบริการ — ระบบ DMS (YAMAHA)" desc="ไฟล์ xlsx รายงานสรุปรายวันรับเงิน จาก DMS (ใบเสร็จ SCYxx-RP…/RSV… ประเภทขายอะไหล่-งานบริการ พร้อมวิธีชำระ เงินสด/โอน/บัตร/มัดจำ) — UPSERT เลขที่ใบเสร็จ สาขาอ่านจากเลขใบเสร็จ"
        table="dms_part_service_receipts" accept=".xlsx,.xls" action="upload_dms" parser={parseDms} currentUser={currentUser}
        summary={(rows) => `${sumTotal(rows)}${dateRange(rows)} · สาขา ${[...new Set(rows.map(r => r.branch_code))].join(", ")}`} last={last.dms_last} count={last.dms_count} onDone={loadLast} />
      <UploadBlock color="#dc2626" title="🔴 2. ขายอะไหล่ — ระบบ NIDS (HONDA)" desc="ไฟล์ XLS รายงานรับชำระเงินขายอะไหล่ (ใบเสร็จ 69SREC + บรรทัดใบขาย 69RTSL) — ไฟล์เดียวมีหลายสาขาได้ แยกสาขาอัตโนมัติจากแถว 'สาขา' ในไฟล์ (สำนักงานใหญ่ → SCY06, นครหลวง → SCY05) · UPSERT สาขา+เลขที่ใบเสร็จ"
        table="nid_part_sale_receipts" accept=".xls,.xlsx" action="upload_nid_sale" parser={parseNidSale} currentUser={currentUser}
        summary={(rows) => `${sumTotal(rows)}${dateRange(rows)} · ${rows.reduce((s, r) => s + r.items.length, 0)} บรรทัดใบขาย · สาขา ${[...new Set(rows.map(r => r.branch_code || r.branch_name || "?"))].join(", ")}`} last={last.nid_sale_last} count={last.nid_sale_count} onDone={loadLast} />
      <UploadBlock color="#b45309" title="🟠 3. งานบริการ — ระบบ NIDS (HONDA)" desc="ไฟล์ XLS รายงานรับชำระเงินงานบริการ (ใบเสร็จ SR-… อ้างใบแจ้งซ่อม 69SERV แยกประเภท GR/PM) — ไฟล์เดียวมีหลายสาขาได้ แยกสาขาอัตโนมัติจากแถว 'สาขา' ในไฟล์ · UPSERT สาขา+เลขที่ใบเสร็จ (เลข SR- เริ่มนับใหม่ทุกสาขา)"
        table="nid_service_receipts" accept=".xls,.xlsx" action="upload_nid_service" parser={parseNidService} currentUser={currentUser}
        summary={(rows) => `${sumTotal(rows)}${dateRange(rows)} · ค่าบริการ ${fmt(rows.reduce((s, r) => s + r.labor_amount, 0))} · ค่าอะไหล่ ${fmt(rows.reduce((s, r) => s + r.parts_amount, 0))} · สาขา ${[...new Set(rows.map(r => r.branch_code || r.branch_name || "?"))].join(", ")}`} last={last.nid_service_last} count={last.nid_service_count} onDone={loadLast} />
    </div>
  );
}
