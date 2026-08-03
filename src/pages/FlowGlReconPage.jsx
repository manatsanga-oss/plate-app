import React, { useEffect, useMemo, useState } from "react";

// ===== เมนู: ตรวจสอบบันทึกบัญชี FLOW =====
// เทียบข้อมูล DMS (list-tax-invoices ที่มีในระบบ) กับ GL ที่ export จาก FlowAccount แล้ว upload เข้ามา
// GL ที่ใช้: 11311 (ลูกหนี้การค้า) + 11921 (เงินมัดจำ) ของทั้ง 2 บริษัท (ป.เปา / สิงห์ชัย)
// การตรวจ 3 ชั้น:
//  1) เดือน × ไฟแนนซ์ × เล่มบริษัท — ยอดตัดมัดจำใน DMS (เงินโอนจริง) vs RV ตัดมัดจำใน Flow (11921)
//  2) ราย RE — ยอดล้างลูกหนี้ (11311) vs ยอดตัดมัดจำ (11921) ต่อใบ → ใบไฟแนนซ์ที่ล้างหนี้โดยไม่ผ่านมัดจำ
//  3) ราย INV — ใบขายที่ยังไม่มี/รับชำระไม่ครบ
const RECON_API = "https://n8n-new-project-gwf2.onrender.com/webhook/flow-gl-recon-api";
const TAX_API = "https://n8n-new-project-gwf2.onrender.com/webhook/list-tax-invoices";

const COMPANY_LABEL = { PAPAO: "ป.เปา", SINGCHAI: "สิงห์ชัย" };

function fmtN(n) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
}
function cellTxt(v) {
  return String(v == null ? "" : v).trim();
}
function num(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}
// dd/mm/yyyy (ค.ศ. ตามไฟล์ GL export; กัน พ.ศ. ด้วย) → YYYY-MM-DD
function thDateToIso(s) {
  const m = cellTxt(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  let y = parseInt(m[3], 10);
  if (y > 2400) y -= 543;
  return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

// รวมชื่อไฟแนนซ์ให้เป็นกลุ่มเดียวกัน (DMS สะกด "กรุ๊ปลิส" / Flow สะกด "กรุ๊ปลีส" ฯลฯ)
function normFinance(s) {
  const t = cellTxt(s);
  if (!t || t === "-" ) return "เงินสด/ขายปลีก";
  if (t.includes("คาเธ")) return "คาเธ่ย์ ลีสซิ่ง";
  if (t.includes("เน็ค")) return "เน็คซ์ แคปปิตอล";
  if (t.includes("กรุ๊ปล")) return "กรุ๊ปลีส";
  if (t.replace(/\s/g, "").includes("เอสจีเอฟ")) return "เอสจีเอฟ";
  if (t.includes("อยุธยา")) return "อยุธยา แคปปิตอล";
  if (t.replace(/\s/g, "").includes("เอสลีสซิ่ง")) return "เอส ลีสซิ่ง";
  if (t.includes("ธนบรรณ")) return "ธนบรรณ";
  if (t.includes("เงินสด") || t.includes("ขายเงินสด")) return "เงินสด/ขายปลีก";
  return t;
}
const FINANCE_GROUPS = ["คาเธ่ย์ ลีสซิ่ง", "เน็คซ์ แคปปิตอล", "กรุ๊ปลีส", "เอสจีเอฟ", "อยุธยา แคปปิตอล", "เอส ลีสซิ่ง", "ธนบรรณ"];

// ชื่อบัญชีที่เจอบ่อยฝั่ง "เงินขาด/ปรับปรุง" — ไว้โชว์ในหมายเหตุชั้นที่ 2
const ACC_LABEL = {
  "19291": "19291 เงินสดขาด/เกิน",
  "21919.3": "21919.3 ค่าส่งเสริมการขายค้างจ่าย",
  "53211": "53211 ค่าธรรมเนียมธนาคาร",
};

// แปลงรหัสบัญชีให้เป็นข้อความคงรูป (กัน 21919.3 → "21919.3", 11311.0 → "11311")
function acctTxt(v) {
  const s = cellTxt(v);
  if (!s) return "";
  return s.replace(/\.0+$/, "");
}
function makeRow(dateIso, docType, docNo, contact, desc, debit, credit) {
  const invM = String(desc || "").match(/#INV\d+/);
  const reM = String(desc || "").match(/#RE\d+/);
  return {
    entry_date: dateIso,
    year_month: dateIso.slice(0, 7),
    doc_type: docType || null,
    doc_no: docNo || null,
    contact: contact || null,
    description: desc || null,
    inv_ref: invM ? invM[0] : null,
    re_ref: reM ? reM[0] : null,
    debit,
    credit,
  };
}

// ===== parse ไฟล์จาก FlowAccount — รองรับ 2 แบบ =====
// (ก) บัญชีแยกประเภท (GL): หัวรายงานมี "รหัสบัญชี : XXXXX" → หัวตารางคอลัมน์แรก = "รหัสบัญชี"
// (ข) สมุดรายวันรับ: หัวตารางคอลัมน์แรก = "วันที่" และมีคอลัมน์ "รหัสบัญชี" กลางตาราง — ไฟล์เดียวได้ทุกบัญชี
// คืนค่า { company, kind, units: [{ accountCode, rows }] }
async function parseFlowFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });

  // ---- บริษัท จากหัวรายงาน/ชื่อไฟล์ ----
  let company = "";
  for (let i = 0; i < Math.min(grid.length, 8); i++) {
    const line = (grid[i] || []).map(cellTxt).join(" ");
    if (!company && line.includes("สิงห์ชัย")) company = "SINGCHAI";
    if (!company && line.includes("ป.เปา")) company = "PAPAO";
  }
  if (!company) {
    if (String(file.name).includes("สิงห์ชัย")) company = "SINGCHAI";
    else if (String(file.name).includes("ป.เปา")) company = "PAPAO";
  }
  if (!company) throw new Error("ระบุบริษัทไม่ได้ (ไม่พบคำว่า ป.เปา / สิงห์ชัย ในหัวรายงานหรือชื่อไฟล์)");

  const glHdr = grid.findIndex(r => cellTxt(r[0]) === "รหัสบัญชี");
  const jnHdr = grid.findIndex(r => cellTxt(r[0]) === "วันที่" && (r || []).map(cellTxt).includes("รหัสบัญชี"));

  // ---- (ข) สมุดรายวัน (รายวันรับ ฯลฯ): 0 วันที่, 1 สมุดรายวัน, 2 เลขที่เอกสาร, 3 บรรทัด,
  //      4 คำอธิบาย, 5 รหัสบัญชี, 6 ชื่อบัญชี, 7 เดบิต, 8 เครดิต, 9 คำอธิบายย่อย, 10 สถานะ, 11 ผู้ติดต่อ ----
  if (jnHdr >= 0) {
    const hdr = grid[jnHdr].map(cellTxt);
    const ci = name => hdr.findIndex(h => h === name);
    const cDate = ci("วันที่"), cJournal = ci("สมุดรายวัน"), cDoc = ci("เลขที่เอกสาร"),
      cDesc = ci("คำอธิบายรายการ"), cAcct = ci("รหัสบัญชี"), cDr = ci("เดบิต"), cCr = ci("เครดิต"),
      cStatus = ci("สถานะ"), cContact = ci("ผู้ติดต่อ");
    const byAcct = new Map();
    for (let i = jnHdr + 1; i < grid.length; i++) {
      const r = grid[i] || [];
      const iso = thDateToIso(r[cDate]);
      const acct = acctTxt(r[cAcct]);
      if (!iso || !acct) continue;
      if (cStatus >= 0 && cellTxt(r[cStatus]).includes("ยกเลิก")) continue;
      const row = makeRow(iso, cellTxt(r[cJournal]) || "สมุดรายวัน", cellTxt(r[cDoc]) || null,
        cContact >= 0 ? cellTxt(r[cContact]) : null, cellTxt(r[cDesc]), num(r[cDr]), num(r[cCr]));
      if (!byAcct.has(acct)) byAcct.set(acct, []);
      byAcct.get(acct).push(row);
    }
    // ตัดบัญชี 11311 ออกจากสมุดรายวันรับ — ข้อมูลลูกหนี้ให้ใช้จาก GL 11311 (มีทั้งขาขายและขารับ)
    // กันไม่ให้ upload สมุดรายวันรับทับข้อมูลขาขายของ GL 11311 เดือนเดียวกัน
    const units = [...byAcct.entries()].filter(([acct]) => acct !== "11311").map(([accountCode, rows]) => ({ accountCode, rows }));
    if (units.length === 0) throw new Error("ไม่พบรายการในไฟล์สมุดรายวัน");
    return { company, kind: "สมุดรายวัน", units };
  }

  // ---- (ก) GL รายบัญชี: 0 รหัสบัญชี, 1 วันที่, 2 ชุดเอกสาร, 3 เลขที่เอกสาร, 4 ชื่อบัญชี,
  //      5 เลขอ้างอิง, 6 ผู้ติดต่อ, 7 รายละเอียด, 8 เดบิต, 9 เครดิต ----
  if (glHdr >= 0) {
    let accountCode = "";
    for (let i = 0; i < Math.min(grid.length, 8); i++) {
      const line = (grid[i] || []).map(cellTxt).join(" ");
      if (line.includes("รหัสบัญชี")) {
        const m = line.match(/รหัสบัญชี\s*:?\s*(\d{3,}(?:\.\d+)?)/);
        if (m) { accountCode = m[1]; break; }
      }
    }
    const rows = [];
    for (let i = glHdr + 1; i < grid.length; i++) {
      const r = grid[i] || [];
      if (!/^\d{3,}/.test(cellTxt(r[0]))) continue;   // ข้ามแถวว่าง/แถวสรุป
      const iso = thDateToIso(r[1]);
      if (!iso) continue;                              // ข้ามแถวยอดยกมา
      if (!accountCode) accountCode = acctTxt(r[0]);
      rows.push(makeRow(iso, cellTxt(r[2]) || null, cellTxt(r[3]) || null, cellTxt(r[6]) || null, cellTxt(r[7]), num(r[8]), num(r[9])));
    }
    if (!accountCode) {
      const m = String(file.name).match(/GL[_-](\d{3,})/i);
      if (m) accountCode = m[1];
    }
    if (rows.length === 0) throw new Error("ไม่พบรายการในไฟล์ (มีแต่ยอดยกมา?)");
    if (!accountCode) throw new Error("ระบุรหัสบัญชีไม่ได้");
    // รับ GL เฉพาะบัญชีลูกหนี้ 11311 เท่านั้น — บัญชีอื่น (11921/ธนาคาร/รายได้ ฯลฯ) ไม่ต้อง upload
    // เพราะสมุดรายวันรับไฟล์เดียวมีข้อมูลฝั่งรับเงินครบทุกบัญชีอยู่แล้ว
    if (accountCode !== "11311") {
      throw new Error(`GL บัญชี ${accountCode} ไม่ต้อง upload — ใช้แค่ 2 ไฟล์ต่อบริษัท: สมุดรายวันรับ + GL 11311 ลูกหนี้การค้า`);
    }
    return { company, kind: "GL", units: [{ accountCode, rows }] };
  }

  throw new Error("ไม่รู้จักรูปแบบไฟล์ — ต้องเป็นบัญชีแยกประเภท (GL) หรือสมุดรายวัน ที่ export จาก FlowAccount");
}

export default function FlowGlReconPage({ currentUser }) {
  const [summary, setSummary] = useState([]);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]); // [{file, parsed|error}]

  const [month, setMonth] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");
  const [glRows, setGlRows] = useState([]);   // list_entries ทั้งหมด
  const [dmsRows, setDmsRows] = useState([]); // list-tax-invoices 3 สังกัด
  const [showAllRe, setShowAllRe] = useState(false);

  async function callRecon(body) {
    const res = await fetch(RECON_API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : [data];
  }

  async function loadSummary() {
    try {
      const rows = await callRecon({ action: "list_summary" });
      setSummary(rows.filter(r => r && r.year_month));
    } catch { /* เงียบไว้ — โชว์ตอน upload/ตรวจสอบแทน */ }
  }
  useEffect(() => { loadSummary(); }, []);

  async function handleDeleteMonth(s) {
    const label = `${COMPANY_LABEL[s.company] || s.company} · บัญชี ${s.account_code} · เดือน ${s.year_month} (${s.n} รายการ)`;
    if (!window.confirm(`ลบข้อมูล ${label} ออกจากระบบ?`)) return;
    try {
      await callRecon({ action: "delete_month", company: s.company, account_code: s.account_code, year_month: s.year_month });
      setUploadMsg(`🗑️ ลบแล้ว: ${label}`);
      loadSummary();
    } catch (e) {
      setUploadMsg("❌ ลบไม่สำเร็จ: " + e.message);
    }
  }

  // ===== upload =====
  async function handleFiles(fileList) {
    setUploadMsg("");
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const out = [];
    for (const f of files) {
      try {
        const parsed = await parseFlowFile(f);
        out.push({ file: f, parsed });
      } catch (e) {
        out.push({ file: f, error: e.message });
      }
    }
    setPendingFiles(out);
  }

  async function handleUpload() {
    const ok = pendingFiles.filter(p => p.parsed);
    if (ok.length === 0) { setUploadMsg("⚠️ ไม่มีไฟล์ที่อ่านสำเร็จ"); return; }
    setUploading(true); setUploadMsg("");
    const results = [];
    for (const p of ok) {
      for (const u of p.parsed.units) {
        try {
          const res = await callRecon({
            action: "upload_gl",
            company: p.parsed.company,
            account_code: u.accountCode,
            rows: u.rows,
            source_file: p.file.name,
            uploaded_by: currentUser?.name || currentUser?.username || "system",
          });
          const first = res[0] || {};
          if (first.success === false) throw new Error(first.error || "บันทึกล้มเหลว");
          results.push(`${COMPANY_LABEL[p.parsed.company]} ${u.accountCode} (${u.rows.length})`);
        } catch (e) {
          results.push(`❌ ${p.file.name} บัญชี ${u.accountCode}: ${e.message}`);
        }
      }
    }
    setUploadMsg("✅ นำเข้า: " + results.join(" · "));
    setPendingFiles([]);
    setUploading(false);
    loadSummary();
  }

  // ===== ตรวจสอบ =====
  async function runCheck() {
    if (!month) { setCheckMsg("⚠️ เลือกเดือนก่อน"); return; }
    setChecking(true); setCheckMsg("");
    try {
      const gl = await callRecon({ action: "list_entries" });
      setGlRows(gl.filter(r => r && r.account_code));
      const branches = ["PAPAO", "NAKORNLUANG", "SINGCHAI"];
      const all = [];
      for (const br of branches) {
        const res = await fetch(TAX_API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_tax_invoices", branch: br, status: "active" }),
        });
        const data = await res.json().catch(() => []);
        const arr = Array.isArray(data) ? data : data?.rows || [];
        arr.forEach(r => all.push({ ...r, __branch: br }));
      }
      setDmsRows(all);
      if (gl.filter(r => r.year_month === month).length === 0) {
        setCheckMsg(`⚠️ ยังไม่มีข้อมูล GL เดือน ${month} — upload ไฟล์ GL ก่อน`);
      }
    } catch (e) {
      setCheckMsg("❌ ตรวจสอบไม่สำเร็จ: " + e.message);
    }
    setChecking(false);
  }

  // ---- ชั้นที่ 1: เดือน × ไฟแนนซ์ × เล่ม ----
  const check1 = useMemo(() => {
    if (!month || dmsRows.length === 0) return [];
    const map = new Map(); // key = company|finance → { dms, flow }
    const touch = k => { if (!map.has(k)) map.set(k, { dms: 0, flow: 0 }); return map.get(k); };

    dmsRows.forEach(r => {
      if (r.status === "cancelled") return;
      if (typeof r.customer_name === "string" && r.customer_name.includes("ยกเลิก")) return;
      const paid = r.last_receipt_date || r.paid_at;
      if (!paid || String(paid).slice(0, 7) !== month) return;
      const dep = num(r.payment_methods?.deposit);
      if (dep <= 0) return;
      const ledger = r.__branch === "SINGCHAI" ? "SINGCHAI" : "PAPAO";
      touch(ledger + "|" + normFinance(r.sale_finance_company)).dms += dep;
    });

    glRows.forEach(r => {
      if (r.account_code !== "11921" || r.year_month !== month) return;
      if (!String(r.description || "").includes("รับชำระเงิน")) return;
      const d = num(r.debit);
      if (d <= 0) return;
      touch(r.company + "|" + normFinance(r.contact)).flow += d;
    });

    return [...map.entries()].map(([k, v]) => {
      const [company, finance] = k.split("|");
      const diff = v.flow - v.dms;
      let status, color;
      if (Math.abs(diff) < 1) { status = "✅ ตรงกัน"; color = "#15803d"; }
      else if (diff > 0) { status = "ℹ️ Flow สูงกว่า (มักเป็นค่าส่งเสริม/งานบริการรวมใน RV — ปกติ)"; color = "#92400e"; }
      else { status = "⚠️ Flow ตัดขาด " + fmtN(-diff); color = "#b91c1c"; }
      return { company, finance, dms: v.dms, flow: v.flow, diff, status, color };
    }).sort((a, b) => (a.company + a.finance).localeCompare(b.company + b.finance, "th"));
  }, [month, dmsRows, glRows]);

  // ---- ชั้นที่ 2: ราย RE — ล้างลูกหนี้ vs ตัดมัดจำ + เงินเข้าบัญชีอื่นที่ upload ไว้ (ธนาคาร/เงินสด) ----
  const check2 = useMemo(() => {
    if (!month || glRows.length === 0) return [];
    const cutByRe = new Map();   // company|re → เดบิตมัดจำ 11921 (ทุกเดือน กันเคสคร่อมเดือน)
    const otherByRe = new Map(); // company|re → เงินรับจริงผ่านบัญชีอื่น (เงินสด/ธนาคาร/WHT) สุทธิ เดบิต−เครดิต
    const oddByRe = new Map();   // company|re → Map(บัญชีที่ไม่ใช่เงินรับจริง → ยอดสุทธิ) เช่น 19291, 21919.3
    glRows.forEach(r => {
      if (!r.re_ref) return;
      const k = r.company + "|" + r.re_ref;
      const acct = String(r.account_code);
      if (acct === "11921") {
        if (num(r.debit) > 0) cutByRe.set(k, (cutByRe.get(k) || 0) + num(r.debit));
        return;
      }
      if (acct === "11311") return;
      // บัญชีรับเงินจริง: สินทรัพย์เงินสด/ธนาคาร (11xxx) + ภาษีถูกหัก ณ ที่จ่าย (17xxx)
      // ใช้ยอดสุทธิ เดบิต−เครดิต เพื่อให้บัญชีพัก "ใบเสร็จรอเรียกเก็บ" (11319) หักล้างตัวเองเป็นศูนย์
      if (/^11/.test(acct) || /^17/.test(acct)) {
        otherByRe.set(k, (otherByRe.get(k) || 0) + num(r.debit) - num(r.credit));
      } else {
        // บัญชีอื่น (เงินขาด/ค่าส่งเสริม ฯลฯ) — เก็บรายบัญชีไว้โชว์ในหมายเหตุ
        const net = num(r.debit) - num(r.credit);
        if (net !== 0) {
          if (!oddByRe.has(k)) oddByRe.set(k, new Map());
          const m2 = oddByRe.get(k);
          m2.set(acct, (m2.get(acct) || 0) + net);
        }
      }
    });
    const reMap = new Map(); // company|re → { credit, inv, contact }
    glRows.forEach(r => {
      if (r.account_code !== "11311" || r.year_month !== month) return;
      if (r.doc_type !== "รายวันรับ" || num(r.credit) <= 0 || !r.re_ref) return;
      const k = r.company + "|" + r.re_ref;
      if (!reMap.has(k)) reMap.set(k, { credit: 0, inv: r.inv_ref, contact: r.contact });
      reMap.get(k).credit += num(r.credit);
    });
    return [...reMap.entries()].map(([k, v]) => {
      const [company, re] = k.split("|");
      const cut = cutByRe.get(k) || 0;
      const bank = otherByRe.get(k) || 0;
      const nondep = Math.round((v.credit - cut - bank) * 100) / 100;
      const fin = normFinance(v.contact);
      const suspicious = FINANCE_GROUPS.includes(fin);
      const odd = oddByRe.has(k)
        ? [...oddByRe.get(k).entries()].map(([acct, amt]) => ({ acct, amt: Math.round(amt * 100) / 100 }))
        : [];
      return { company, re, inv: v.inv, contact: v.contact, credit: v.credit, cut, bank, nondep, suspicious, odd };
    }).filter(r => r.nondep > 0.5).sort((a, b) => (b.suspicious - a.suspicious) || (b.nondep - a.nondep));
  }, [month, glRows]);

  // ---- ชั้นที่ 3: ราย INV — ขายแล้วยังรับชำระไม่ครบ ----
  const check3 = useMemo(() => {
    if (!month || glRows.length === 0) return [];
    const paidByInv = new Map(); // company|inv → Σ เครดิตล้างลูกหนี้ (ทุกเดือน)
    glRows.forEach(r => {
      if (r.account_code !== "11311" || !r.inv_ref || num(r.credit) <= 0) return;
      const k = r.company + "|" + r.inv_ref;
      paidByInv.set(k, (paidByInv.get(k) || 0) + num(r.credit));
    });
    const invMap = new Map(); // company|inv → { gross, contact }
    glRows.forEach(r => {
      if (r.account_code !== "11311" || r.year_month !== month) return;
      if (r.doc_type !== "รายวันขาย" || num(r.debit) <= 0 || !r.inv_ref) return;
      const k = r.company + "|" + r.inv_ref;
      if (!invMap.has(k)) invMap.set(k, { gross: 0, contact: r.contact });
      invMap.get(k).gross += num(r.debit);
    });
    return [...invMap.entries()].map(([k, v]) => {
      const [company, inv] = k.split("|");
      const paid = paidByInv.get(k) || 0;
      const unpaid = Math.round((v.gross - paid) * 100) / 100;
      return { company, inv, contact: v.contact, gross: v.gross, paid, unpaid };
    }).filter(r => r.unpaid > 0.5).sort((a, b) => b.unpaid - a.unpaid);
  }, [month, glRows]);

  const re2Show = showAllRe ? check2 : check2.filter(r => r.suspicious);
  const hasGlForMonth = glRows.some(r => r.year_month === month);

  return (
    <div>
      <div className="page-title">🔍 ตรวจสอบบันทึกบัญชี FLOW</div>

      {/* ===== ขั้นตอนการตรวจสอบ ===== */}
      <div style={{ ...card, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 13, lineHeight: 1.9 }}>
        <b>ขั้นตอนการตรวจสอบ</b>
        <ol style={{ margin: "4px 0 0 18px", padding: 0 }}>
          <li>ใน FlowAccount export เป็น Excel <b>แค่ 2 ไฟล์ต่อบริษัท</b> (ป.เปา / สิงห์ชัย): <b>① สมุดรายวันรับ</b> (ได้ฝั่งรับเงินครบทุกบัญชี: มัดจำ/เงินสด/ธนาคาร/เงินขาด) + <b>② GL 11311 ลูกหนี้การค้า</b> (ได้ฝั่งใบขาย) — ไฟล์ GL บัญชีอื่นไม่ต้องใช้ ระบบจะไม่รับ</li>
          <li>Upload ไฟล์ทั้งหมดที่การ์ดด้านล่าง (เลือกได้ทีละหลายไฟล์ — ระบบอ่านบริษัท/รหัสบัญชีจากหัวรายงานอัตโนมัติ, upload เดือนเดิมซ้ำ = ทับของเก่า)</li>
          <li>เลือกเดือน แล้วกด <b>ตรวจสอบ</b> — ระบบเทียบกับข้อมูลขาย/รับชำระ DMS ที่มีในระบบนี้ให้ 3 ชั้น</li>
          <li>อ่านผล: <b>ชั้น 1</b> เดือน×ไฟแนนซ์ ยอดตัดมัดจำต้องตรงเป๊ะ (แดง = Flow ตัดขาด → มีเงินโอนค้างในบัญชีมัดจำ) · <b>ชั้น 2</b> ใบ RE ของไฟแนนซ์ที่ล้างหนี้โดยไม่ผ่านมัดจำ (มักเป็น "เงินขาด→ค่าส่งเสริมค้างจ่าย" — ต้องยืนยันว่าไฟแนนซ์หักจริง ไม่ใช่เงินโอนมาแล้ว) · <b>ชั้น 3</b> ใบขายที่ยังรับชำระไม่ครบ</li>
        </ol>
      </div>

      {/* ===== Upload GL ===== */}
      <div style={card}>
        <div style={cardTitle}>📤 1) Upload บัญชีแยกประเภทจาก FlowAccount</div>
        <input type="file" accept=".xlsx,.xls" multiple
          onChange={e => handleFiles(e.target.files)} style={{ fontSize: 12, marginBottom: 8 }} />
        {pendingFiles.length > 0 && (
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            {pendingFiles.map((p, i) => (
              <div key={i} style={{ padding: "4px 8px", borderRadius: 6, marginBottom: 4, background: p.error ? "#fef2f2" : "#f0fdf4", color: p.error ? "#b91c1c" : "#15803d" }}>
                {p.error
                  ? `❌ ${p.file.name} — ${p.error}`
                  : `✅ ${p.file.name} → ${COMPANY_LABEL[p.parsed.company]} · ${p.parsed.kind} · ${p.parsed.units.length} บัญชี (${p.parsed.units.map(u => u.accountCode).join(", ")}) · ${p.parsed.units.reduce((s, u) => s + u.rows.length, 0)} รายการ (${[...new Set(p.parsed.units.flatMap(u => u.rows.map(r => r.year_month)))].sort().join(", ")})`}
              </div>
            ))}
            <button onClick={handleUpload} disabled={uploading} style={{ ...btn, background: uploading ? "#9ca3af" : "#15803d" }}>
              {uploading ? "💾 กำลังนำเข้า..." : "💾 Upload เข้าระบบ"}
            </button>
          </div>
        )}
        {uploadMsg && <div style={{ fontSize: 12, marginBottom: 8 }}>{uploadMsg}</div>}

        {summary.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>ข้อมูล GL ที่มีในระบบ:</div>
            <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
              <thead><tr><th>เดือน</th><th>บริษัท</th><th>บัญชี</th><th style={{ textAlign: "right" }}>รายการ</th><th style={{ textAlign: "right" }}>เดบิต</th><th style={{ textAlign: "right" }}>เครดิต</th><th></th></tr></thead>
              <tbody>
                {summary.map((s, i) => (
                  <tr key={i}>
                    <td>{s.year_month}</td>
                    <td>{COMPANY_LABEL[s.company] || s.company}</td>
                    <td>{s.account_code}</td>
                    <td style={{ textAlign: "right" }}>{s.n}</td>
                    <td style={{ textAlign: "right" }}>{fmtN(s.debit)}</td>
                    <td style={{ textAlign: "right" }}>{fmtN(s.credit)}</td>
                    <td style={{ textAlign: "center" }}>
                      <button onClick={() => handleDeleteMonth(s)} title="ลบข้อมูลเดือนนี้"
                        style={{ border: "1px solid #fca5a5", background: "#fff", color: "#b91c1c", borderRadius: 6, cursor: "pointer", fontSize: 11, padding: "2px 8px" }}>
                        🗑️ ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== เลือกเดือน + ตรวจสอบ ===== */}
      <div style={card}>
        <div style={cardTitle}>🧮 2) ตรวจสอบ</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ fontSize: 13, padding: "6px 8px" }} />
          <button onClick={runCheck} disabled={checking} style={{ ...btn, background: checking ? "#9ca3af" : "#1d4ed8" }}>
            {checking ? "⏳ กำลังตรวจ..." : "🔍 ตรวจสอบ"}
          </button>
          {checkMsg && <span style={{ fontSize: 12, color: "#b91c1c" }}>{checkMsg}</span>}
        </div>
      </div>

      {/* ===== ผลชั้นที่ 1 ===== */}
      {month && hasGlForMonth && check1.length > 0 && (
        <div style={card}>
          <div style={cardTitle}>ชั้นที่ 1 — ยอดตัดมัดจำ เดือน {month}: DMS (เงินโอนจริง) vs Flow (RV บัญชี 11921)</div>
          {check1.every(r => r.dms === 0) && (
            <div style={{ fontSize: 12, padding: "8px 10px", borderRadius: 6, marginBottom: 8, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5" }}>
              ⚠️ ไม่พบข้อมูลรับชำระ DMS ของเดือน {month} ในระบบเลย — ต้อง upload ข้อมูล DMS ของเดือนนี้ก่อน
              (ใบกำกับขายรถ + รายงานรับเงินรายวัน ที่หน้า Upload ปกติ) การเทียบชั้นที่ 1 ของเดือนนี้จึงยังใช้ไม่ได้
            </div>
          )}
          <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
            <thead><tr><th>เล่มบริษัท</th><th>ไฟแนนซ์/กลุ่ม</th><th style={{ textAlign: "right" }}>DMS ตัดมัดจำ</th><th style={{ textAlign: "right" }}>Flow ตัดมัดจำ</th><th style={{ textAlign: "right" }}>ต่าง</th><th>ผล</th></tr></thead>
            <tbody>
              {check1.map((r, i) => (
                <tr key={i} style={{ background: r.diff < -0.5 ? "#fef2f2" : undefined }}>
                  <td>{COMPANY_LABEL[r.company] || r.company}</td>
                  <td>{r.finance}</td>
                  <td style={{ textAlign: "right" }}>{fmtN(r.dms)}</td>
                  <td style={{ textAlign: "right" }}>{fmtN(r.flow)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtN(r.diff)}</td>
                  <td style={{ color: r.color, fontSize: 11 }}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
            * ยอด DMS จัดกลุ่มตามเดือนที่รับชำระล่าสุดของใบกำกับ — ใบที่รับชำระข้ามเดือนอาจคลาดเคลื่อนเล็กน้อย ให้ดูแถวสีแดง (Flow ตัดขาด) เป็นหลัก
          </div>
        </div>
      )}

      {/* ===== ผลชั้นที่ 2 ===== */}
      {month && hasGlForMonth && (
        <div style={card}>
          <div style={cardTitle}>
            ชั้นที่ 2 — ใบ RE ที่ล้างลูกหนี้โดยไม่ผ่านเงินมัดจำ ({check2.filter(r => r.suspicious).length} ใบไฟแนนซ์ / ทั้งหมด {check2.length} ใบ)
            <label style={{ fontSize: 11, fontWeight: 400, marginLeft: 12 }}>
              <input type="checkbox" checked={showAllRe} onChange={e => setShowAllRe(e.target.checked)} /> แสดงใบเงินสด/อื่นด้วย
            </label>
          </div>
          {re2Show.length === 0 ? (
            <div style={{ fontSize: 12, color: "#15803d" }}>✅ ไม่พบใบไฟแนนซ์ที่ล้างหนี้โดยไม่ผ่านมัดจำ</div>
          ) : (
            <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
              <thead><tr><th>เล่ม</th><th>RE</th><th>INV</th><th>คู่ค้า</th><th style={{ textAlign: "right" }}>ล้างลูกหนี้</th><th style={{ textAlign: "right" }}>ตัดมัดจำ</th><th style={{ textAlign: "right" }}>เข้าบัญชีอื่นที่ upload</th><th style={{ textAlign: "right" }}>ไม่ทราบช่องทาง</th><th>หมายเหตุ</th></tr></thead>
              <tbody>
                {re2Show.map((r, i) => (
                  <tr key={i} style={{ background: r.suspicious ? "#fffbeb" : undefined }}>
                    <td>{COMPANY_LABEL[r.company] || r.company}</td>
                    <td style={{ fontFamily: "monospace" }}>{r.re}</td>
                    <td style={{ fontFamily: "monospace" }}>{r.inv || "-"}</td>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.contact || "-"}</td>
                    <td style={{ textAlign: "right" }}>{fmtN(r.credit)}</td>
                    <td style={{ textAlign: "right" }}>{fmtN(r.cut)}</td>
                    <td style={{ textAlign: "right" }}>{fmtN(r.bank)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtN(r.nondep)}</td>
                    <td style={{ fontSize: 11, color: r.suspicious ? "#b45309" : "#6b7280" }}>
                      {r.odd.length > 0
                        ? `⚠️ ลงบัญชี ${r.odd.map(o => `${ACC_LABEL[o.acct] || o.acct} ${fmtN(o.amt)}`).join(" + ")}${r.suspicious ? " — ยืนยันว่าไฟแนนซ์หักจริง ไม่ใช่เงินโอนมาแล้วลงเงินขาดผิด" : ""}`
                        : (r.suspicious ? "⚠️ ไฟแนนซ์ — ไม่พบขารับเงินในข้อมูลที่ upload (ตรวจว่า upload สมุดรายวันรับเดือนนี้ครบ)" : "ปกติ (รับเงินตรง)")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
            * บัญชีลูกหนี้บอกแค่ว่าหนี้ถูกล้าง ไม่บอกช่องทางรับเงิน — ใบที่รับโอนตรงเข้าธนาคารจะติดคอลัมน์ "ไม่ทราบช่องทาง" ไปด้วย
            ถ้าอยากให้ระบบแยกให้เอง ให้ upload GL ของ<b>บัญชีเงินฝากธนาคาร/เงินสด</b>ที่ใช้รับเงิน (เดือนเดียวกัน) เพิ่ม —
            ระบบจะหักส่วนที่เข้าธนาคารออกอัตโนมัติ เหลือธงเฉพาะใบที่ลงบัญชีอื่นจริง ๆ (เงินขาด/ค่าส่งเสริม)
          </div>
        </div>
      )}

      {/* ===== ผลชั้นที่ 3 ===== */}
      {month && hasGlForMonth && (
        <div style={card}>
          <div style={cardTitle}>ชั้นที่ 3 — ใบขายเดือน {month} ที่ยังรับชำระไม่ครบ ({check3.length} ใบ)</div>
          {check3.length === 0 ? (
            <div style={{ fontSize: 12, color: "#15803d" }}>✅ ทุกใบขายของเดือนนี้รับชำระครบแล้ว</div>
          ) : (
            <table className="data-table" style={{ fontSize: 12, width: "100%" }}>
              <thead><tr><th>เล่ม</th><th>INV</th><th>คู่ค้า</th><th style={{ textAlign: "right" }}>ยอดขาย</th><th style={{ textAlign: "right" }}>รับแล้ว</th><th style={{ textAlign: "right" }}>ค้าง</th></tr></thead>
              <tbody>
                {check3.map((r, i) => (
                  <tr key={i} style={{ background: r.unpaid > 100000 ? "#fef2f2" : undefined }}>
                    <td>{COMPANY_LABEL[r.company] || r.company}</td>
                    <td style={{ fontFamily: "monospace" }}>{r.inv}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.contact || "-"}</td>
                    <td style={{ textAlign: "right" }}>{fmtN(r.gross)}</td>
                    <td style={{ textAlign: "right" }}>{fmtN(r.paid)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#b91c1c" }}>{fmtN(r.unpaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
            * "รับแล้ว" นับจากยอดล้างลูกหนี้ทุกเดือนที่ upload ไว้ — ถ้าใบไหนรับชำระเดือนหลังจากที่ยัง upload ไม่ถึง จะยังโชว์ค้าง
          </div>
        </div>
      )}
    </div>
  );
}

const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 14 };
const cardTitle = { fontWeight: 700, fontSize: 14, marginBottom: 10 };
const btn = { color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, padding: "8px 16px", fontSize: 13 };
