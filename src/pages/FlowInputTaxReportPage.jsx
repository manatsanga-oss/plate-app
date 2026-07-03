import React, { useEffect, useMemo, useState } from "react";

// แสดงรายงานภาษีซื้อ (ภ.พ.30) ที่ upload มาจาก FLOW ACC (FlowAccount) — อ่านอย่างเดียว แยกสังกัด
// ดึงจาก webhook flow-input-tax-api (list_periods + list_input_tax_report) — ตาราง flow_input_tax_reports
// รูปแบบตารางตามรายงานภาษีซื้อของ FlowAccount + หัวรายงาน (ชื่อผู้ประกอบการ/รอบยื่น) + ยอดรวม + พิมพ์ได้
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/flow-input-tax-api";
const INPUT_TAX_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/input-tax-api";
const AFFILIATIONS = ["ป.เปา", "สิงห์ชัย"];
const SRC_LABEL = { vehicle: "รถ", part: "อะไหล่", expense: "ค่าใช้จ่าย", fuel: "ค่าน้ำมัน", theft: "ประกันรถหาย", lockton: "ประกัน LOCKTON", theft_invoice: "ประกันรถหาย (ใบกำกับ)" };
// normalize เลขเอกสารเพื่อจับคู่: ตัดช่องว่าง + ตัวพิมพ์ใหญ่ + prefix F- (flow_expense ใช้ F-, expense_documents ไม่ใช้)
function normDoc(s) { return String(s || "").toUpperCase().replace(/\s+/g, "").replace(/^F-/, ""); }
// คีย์ประจำแถว FLOW สำหรับเก็บคู่ manual — คงที่แม้ re-upload รอบเดิม (id เปลี่ยนเพราะนำเข้าแบบแทนที่ทั้งรอบ)
function flowKeyOf(r) { return normDoc(r.tax_invoice_no) + "|" + normDoc(r.reference_no); }
// รายการเอกสารในคู่ manual (รองรับกลุ่ม app_docs JSONB + แบบเดี่ยวเดิม)
function docsOf(m) {
  let d = m?.app_docs;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = null; } }
  if (Array.isArray(d) && d.length) return d.filter(x => x && x.doc_no);
  return m?.app_doc_no ? [{ source: m.app_source || "", doc_no: m.app_doc_no }] : [];
}

// ===== ความคล้ายสำหรับ popup จับคู่เอง =====
// ชื่อ: ตัดคำนำหน้า/ท้ายนิติบุคคล + ช่องว่าง แล้ววัด bigram overlap (Dice)
function normName(s) {
  return String(s || "").replace(/บริษัท|จำกัด|\(มหาชน\)|มหาชน|ห้างหุ้นส่วนจำกัด|หจก\.?|บจก\.?|บมจ\.?|ร้าน|สาขาที่\s*\d+|\(|\)|\s+/g, "").toLowerCase();
}
function nameSim(a, b) {
  const x = normName(a), y = normName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const big = s => { const o = new Set(); for (let i = 0; i < s.length - 1; i++) o.add(s.slice(i, i + 2)); return o; };
  const A = big(x), B = big(y);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}
// ยอด: เทียบ VAT เป็นหลัก (ต่าง ≤1 บาท = ตรง, ≤5% = ใกล้)
function amtScore(f, a) {
  const fv = Number(f.vat_amount || 0), av = Number(a.vat_amount || 0);
  if (fv <= 0 || av <= 0) return 0;
  const d = Math.abs(fv - av);
  if (d <= 1) return 1;
  const rel = d / Math.max(fv, av);
  if (rel <= 0.05) return 0.7;
  if (rel <= 0.15) return 0.4;
  return 0;
}
function pairScore(flowRow, appRow) {
  return amtScore(flowRow, appRow) * 0.6 + nameSim(flowRow.vendor_name, appRow.vendor_name) * 0.4;
}

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
// "2026-05" → "พ.ค. 2569"
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function periodLabel(p) {
  if (!p) return "-";
  const m = String(p).match(/^(\d{4})-(\d{2})/);
  if (!m) return p;
  return `${TH_MONTH[parseInt(m[2], 10) - 1]} ${parseInt(m[1], 10) + 543}`;
}

export default function FlowInputTaxReportPage({ currentUser }) {
  const [affiliation, setAffiliation] = useState("ป.เปา");
  const [periods, setPeriods] = useState([]); // [{tax_period, cnt, sum_base, sum_vat, company_name}]
  const [period, setPeriod] = useState("");
  const [rows, setRows] = useState([]);
  const [appRows, setAppRows] = useState([]); // จัดการภาษีซื้อ (แอป) รอบเดียวกัน สำหรับจับคู่
  const [partCN, setPartCN] = useState([]);   // ใบลดหนี้อะไหล่ HONDA (ยอดติดลบ — หลุดจาก list_input_tax) ไว้จับคู่
  const [lktRows, setLktRows] = useState([]); // ค่าประกัน LOCKTON งานรับเรื่อง (ถอด VAT — ไม่อยู่ใน list_input_tax) ไว้จับคู่
  const [theftInv, setTheftInv] = useState([]); // ใบกำกับประกันรถหาย (ออกแทน) 52071 — ไม่อยู่ใน list_input_tax ไว้จับคู่
  const [manual, setManual] = useState([]);   // คู่ที่จับเอง (flow_input_tax_manual_matches)
  const [pairing, setPairing] = useState(null); // แถว FLOW ที่กำลังเลือกคู่ (เปิด popup)
  const [pairSaving, setPairSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyUnmatched, setOnlyUnmatched] = useState(false); // แสดงเฉพาะแถวที่จับคู่ไม่ได้
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // โหลดรายการรอบยื่นเมื่อเปลี่ยนสังกัด
  useEffect(() => { loadPeriods(affiliation); /* eslint-disable-next-line */ }, [affiliation]);
  // โหลดข้อมูลเมื่อเปลี่ยนสังกัด/รอบ
  useEffect(() => { if (period) loadRows(); else setRows([]); /* eslint-disable-next-line */ }, [affiliation, period]);

  async function loadPeriods(aff) {
    setMsg("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_periods", affiliation: aff }),
      });
      const data = await res.json();
      const arr = (Array.isArray(data) ? data : (data?.rows || [])).filter(p => p && p.tax_period);
      setPeriods(arr);
      // เลือกรอบล่าสุดอัตโนมัติ (ถ้ารอบเดิมไม่มีในสังกัดใหม่)
      setPeriod(prev => (arr.some(p => p.tax_period === prev) ? prev : (arr[0]?.tax_period || "")));
    } catch (e) {
      setMsg("❌ โหลดรายการรอบยื่นไม่สำเร็จ: " + e.message);
      setPeriods([]); setPeriod("");
    }
  }

  async function loadRows() {
    setLoading(true); setMsg(""); setPairing(null);
    const ym = period ? period.replace("-", "") : "";
    // FLOW ภ.พ.30 รอบหนึ่งมักมีใบข้ามเดือน (ใบออกปลายเดือนก่อน/ถัดไป ยื่นในรอบนี้)
    // → ดึง app 3 เดือน (ก่อน/นี้/ถัดไป) merge เป็น pool จับคู่ ไม่งั้นเอกสารข้ามเดือนจะขึ้น "ไม่พบ"
    const ymAround = (delta) => {
      if (!period) return "";
      const [y, m] = period.split("-").map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    const appMonths = [...new Set([ym, ymAround(-1), ymAround(1)].filter(Boolean))]; // ym ก่อน → dedup เก็บเดือนปัจจุบันเป็นหลัก
    try {
      const [res, appData, mmRes, cnRes, lktRes, tiRes] = await Promise.all([
        fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_input_tax_report", affiliation, tax_period: period }),
        }),
        // จัดการภาษีซื้อ (แอป) เดือนก่อน+นี้+ถัดไป — ไว้จับคู่ (รวม+dedup ด้านล่าง)
        Promise.all(appMonths.map(m =>
          fetch(INPUT_TAX_URL, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "list_input_tax", year_month: m }),
          }).then(r => r.json()).then(rows => (Array.isArray(rows) ? rows : (rows?.rows || [])).map(x => ({ ...x, _ym: m }))).catch(() => [])
        )).then(a => a.flat()).catch(() => []),
        // คู่ที่เคยจับเองในรอบนี้
        fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_manual_matches", affiliation, tax_period: period }),
        }).catch(() => null),
        // ใบลดหนี้อะไหล่ HONDA (เฉพาะ ป.เปา = ฮอนด้า) — ดึงตรง honda_part_tax_invoices ไว้เป็นตัวเลือกจับคู่
        affiliation === "ป.เปา"
          ? fetch(API_URL, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "list_part_credit_notes", affiliation, tax_period: period }),
            }).catch(() => null)
          : Promise.resolve(null),
        // ค่าประกัน LOCKTON งานรับเรื่อง (ถอด VAT) — ไว้เป็นตัวเลือกจับคู่
        fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_lockton_expenses", affiliation, tax_period: period }),
        }).catch(() => null),
        // ใบกำกับประกันรถหาย (ออกแทน) 52071 — ไว้เป็นตัวเลือกจับคู่
        fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_theft_invoices", affiliation, tax_period: period }),
        }).catch(() => null),
      ]);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : (data?.rows || []));
      // กรองเฉพาะสังกัดที่เลือก + dedup (เอกสารเดียวอาจโผล่หลายเดือน) ตาม source|เลขเอกสาร
      let appArr = [];
      try {
        const seen = new Set();
        appArr = (Array.isArray(appData) ? appData : (appData?.rows || []))
          .filter(a => {
            if (String(a.affiliation || "") !== affiliation) return false;
            const k = (a.source || "") + "|" + normDoc(a.doc_no);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
      } catch { appArr = []; }
      setAppRows(appArr);
      // คู่ manual
      try {
        const mmText = mmRes ? await mmRes.text() : "";
        const mmData = mmText ? JSON.parse(mmText) : null;
        const mmArr = (Array.isArray(mmData) ? mmData : (mmData?.rows || [])).filter(m => m && m.flow_key);
        setManual(mmArr);
      } catch { setManual([]); }
      // ใบลดหนี้อะไหล่ HONDA → รูปแบบเดียวกับ appRows (source=part, ยอดติดลบ)
      try {
        const cnText = cnRes ? await cnRes.text() : "";
        const cnData = cnText ? JSON.parse(cnText) : null;
        const cnArr = (Array.isArray(cnData) ? cnData : (cnData?.rows || []))
          .filter(c => c && c.tax_invoice_no)
          .map(c => ({
            source: "part", doc_type: "credit_note",
            doc_no: c.tax_invoice_no, doc_date: c.tax_invoice_date,
            vendor_name: c.vendor_name, vendor_tax_id: c.vendor_tax_id,
            amount_before_vat: Number(c.amount_before_vat || 0), vat_amount: Number(c.vat_amount || 0),
          }));
        setPartCN(cnArr);
      } catch { setPartCN([]); }
      // ค่าประกัน LOCKTON งานรับเรื่อง → ถอด VAT 7% เป็น candidate (source=lockton)
      try {
        const lktText = lktRes ? await lktRes.text() : "";
        const lktData = lktText ? JSON.parse(lktText) : null;
        const lktArr = (Array.isArray(lktData) ? lktData : (lktData?.rows || []))
          .filter(x => x && x.receipt_no && Number(x.amount_incl_vat) > 0)
          .map(x => {
            const amt = Number(x.amount_incl_vat || 0);
            const base = Math.round((amt / 1.07) * 100) / 100;
            return {
              source: "lockton", doc_no: x.receipt_no, doc_date: x.doc_date,
              vendor_name: "LOCKTON", project: [x.customer_name, x.expense_name].filter(Boolean).join(" · "),
              amount_before_vat: base, vat_amount: Math.round((amt - base) * 100) / 100,
            };
          });
        setLktRows(lktArr);
      } catch { setLktRows([]); }
      // ใบกำกับประกันรถหาย (ออกแทน) 52071 → candidate (source=theft_invoice)
      try {
        const tiText = tiRes ? await tiRes.text() : "";
        const tiData = tiText ? JSON.parse(tiText) : null;
        const tiArr = (Array.isArray(tiData) ? tiData : (tiData?.rows || []))
          .filter(x => x && x.doc_no)
          .map(x => ({
            source: "theft_invoice", doc_no: x.doc_no, doc_date: x.doc_date,
            vendor_name: x.vendor_name, vendor_tax_id: x.vendor_tax_id,
            project: x.reference_no || "52071 ประกันรถหาย-ออกแทน",
            amount_before_vat: Number(x.subtotal || 0), vat_amount: Number(x.vat_amount || 0),
          }));
        setTheftInv(tiArr);
      } catch { setTheftInv([]); }
    } catch (e) {
      setMsg("❌ โหลดข้อมูลไม่สำเร็จ: " + e.message);
      setRows([]); setAppRows([]); setManual([]); setPartCN([]); setLktRows([]); setTheftInv([]);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(r => [r.tax_invoice_no, r.reference_no, r.vendor_name, r.vendor_tax_id]
      .filter(Boolean).join(" ").toLowerCase().includes(kw));
  }, [rows, search]);

  // ===== จับคู่กับจัดการภาษีซื้อ (แอป): อัตโนมัติด้วยเลขเอกสาร (ใบกำกับ + อ้างอิง) + คู่ที่จับเอง =====
  const match = useMemo(() => {
    const appByKey = new Map(); // normDoc(doc_no) -> appRow
    for (const a of appRows) { const k = normDoc(a.doc_no); if (k && !appByKey.has(k)) appByKey.set(k, a); }
    const manualByFlow = new Map(); // flow_key -> manual row
    const usedAppKeys = new Set();  // เลขฝั่งแอปที่ถูกคู่ manual ใช้แล้ว (รวมทุกใบในกลุ่ม)
    for (const m of manual) { manualByFlow.set(m.flow_key, m); docsOf(m).forEach(d => usedAppKeys.add(normDoc(d.doc_no))); }
    const flowKeys = new Set();      // เลขทุกตัวฝั่ง FLOW (ไว้หา app-only)
    const flowStatus = new Map();    // key(flow row) -> { matched, manual, appRow }
    rows.forEach((r, i) => {
      const k1 = normDoc(r.tax_invoice_no), k2 = normDoc(r.reference_no);
      if (k1) flowKeys.add(k1);
      if (k2) flowKeys.add(k2);
      const mm = manualByFlow.get(flowKeyOf(r));
      if (mm) {
        const appDocs = docsOf(mm);
        const appRow = appRows.find(a => normDoc(a.doc_no) === normDoc(mm.app_doc_no) && (!mm.app_source || a.source === mm.app_source)) || null;
        flowStatus.set(r.id ?? ("i" + i), { matched: true, manual: true, appRow, appDocs, appDocNo: mm.app_doc_no, appSource: mm.app_source });
      } else {
        const hit = (k1 && appByKey.get(k1)) || (k2 && appByKey.get(k2)) || null;
        flowStatus.set(r.id ?? ("i" + i), { matched: !!hit, manual: false, appRow: hit });
      }
    });
    const curYm = period ? period.replace("-", "") : "";
    const appUnmatched = appRows.filter(a => { const k = normDoc(a.doc_no); return k && !flowKeys.has(k) && !usedAppKeys.has(k); });
    // เตือน "มีในจัดการภาษีซื้อ แต่ไม่มีใน FLOW" = เฉพาะเดือนของรอบนี้ (เดือนข้างเคียงไม่นับว่าขาด — คนละรอบยื่น)
    const appOnly = appUnmatched.filter(a => !curYm || !a._ym || a._ym === curYm);
    // เดือนข้างเคียง (ใบข้ามรอบ) → เข้าเฉพาะ pool จับคู่
    const appAround = appUnmatched.filter(a => curYm && a._ym && a._ym !== curYm);
    // ใบลดหนี้อะไหล่ (ยอดติดลบ) + LOCKTON + ใบกำกับ 52071 — ตัวเลือกจับคู่เพิ่ม (ไม่อยู่ใน list_input_tax) ตัดที่ถูกจับคู่ไปแล้วออก
    const cnOnly = partCN.filter(c => { const k = normDoc(c.doc_no); return k && !usedAppKeys.has(k); });
    const lktOnly = lktRows.filter(c => { const k = normDoc(c.doc_no); return k && !usedAppKeys.has(k); });
    const tiOnly = theftInv.filter(c => { const k = normDoc(c.doc_no); return k && !usedAppKeys.has(k); });
    const pairCandidates = [...appOnly, ...appAround, ...cnOnly, ...lktOnly, ...tiOnly];
    const matchedCount = [...flowStatus.values()].filter(v => v.matched).length;
    return { flowStatus, appOnly, pairCandidates, matchedCount };
  }, [rows, appRows, manual, partCN, lktRows, theftInv, period]);
  const statusOf = (r, i) => match.flowStatus.get(r.id ?? ("i" + i)) || { matched: false, appRow: null };
  // แถวที่แสดงจริง (ใช้ตัวกรอง "เฉพาะไม่พบ" ทับ filtered อีกชั้น)
  const displayRows = onlyUnmatched ? filtered.filter(r => !statusOf(r).matched) : filtered;

  // ===== จับคู่เอง: กด 🔗 → popup แสดงรายการฝั่งแอปเรียงตามความคล้าย (ชื่อ/ยอด) =====
  function startPairing(r) { setPairing(r); }

  async function saveManualMatch(flowRow, appRowsPicked) {
    const picked = Array.isArray(appRowsPicked) ? appRowsPicked : [appRowsPicked];
    if (!picked.length) return;
    setPairSaving(true); setMsg("");
    try {
      const appDocs = picked.map(a => ({ source: a.source || "", doc_no: a.doc_no }));
      const body = {
        action: "save_manual_match", affiliation, tax_period: period,
        flow_key: flowKeyOf(flowRow), app_docs: appDocs,
        app_source: appDocs[0].source, app_doc_no: appDocs[0].doc_no,
        matched_by: currentUser?.name || currentUser?.username || "system",
      };
      // ใบในกลุ่มที่เป็นค่าใช้จ่าย/ค่าน้ำมัน → เขียนเลขใบกำกับจาก FLOW เข้าเอกสารค่าใช้จ่ายด้วย
      const writesInv = flowRow.tax_invoice_no && picked.some(a => a.source === "expense" || a.source === "fuel");
      if (writesInv) {
        body.tax_invoice_no = flowRow.tax_invoice_no;
        body.tax_invoice_date = flowRow.tax_invoice_date || null;
      }
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      const ok = Array.isArray(data) ? data[0] : data;
      if (ok?.success === false) throw new Error(ok?.error || "บันทึกล้มเหลว");
      setManual(prev => [...prev.filter(m => m.flow_key !== body.flow_key),
        { flow_key: body.flow_key, app_source: body.app_source, app_doc_no: body.app_doc_no, app_docs: appDocs }]);
      setPairing(null);
      const label = picked.length > 1 ? `${picked.length} ใบ` : picked[0].doc_no;
      setMsg(`✅ จับคู่ ${flowRow.tax_invoice_no || flowRow.reference_no || ""} ↔ ${label} แล้ว${writesInv ? " · ใส่เลขใบกำกับให้เอกสารค่าใช้จ่ายแล้ว" : ""}`);
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setPairSaving(false);
  }

  async function removeManualMatch(flowRow) {
    const fk = flowKeyOf(flowRow);
    setPairSaving(true); setMsg("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_manual_match", affiliation, tax_period: period, flow_key: fk }),
      });
      await res.text();
      setManual(prev => prev.filter(m => m.flow_key !== fk));
      setMsg("✅ ยกเลิกจับคู่แล้ว");
    } catch (e) {
      setMsg("❌ " + e.message);
    }
    setPairSaving(false);
  }

  // ยอดรวม/พิมพ์ ตามแถวที่แสดงจริง (พอเปิด "เฉพาะไม่พบ" ยอด+พิมพ์จะได้ตรงกับที่เห็น)
  const sumBase = displayRows.reduce((s, r) => s + Number(r.amount_before_vat || 0), 0);
  const sumVat = displayRows.reduce((s, r) => s + Number(r.vat_amount || 0), 0);
  const companyName = rows[0]?.company_name || "";
  const companyTaxId = rows[0]?.company_tax_id || "";

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📊 รายงานภาษีซื้อ ตาม FLOW ACC</h2>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b", fontSize: 14 }}>{msg}</div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>🏢 สังกัด:</label>
        <select value={affiliation} onChange={e => setAffiliation(e.target.value)} style={inp}>
          {AFFILIATIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <label style={{ fontSize: 13, fontWeight: 600 }}>📅 รอบยื่น:</label>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={inp}>
          {periods.length === 0 && <option value="">— ไม่มีข้อมูล —</option>}
          {periods.map(p => (
            <option key={p.tax_period} value={p.tax_period}>{periodLabel(p.tax_period)} ({p.cnt} รายการ)</option>
          ))}
        </select>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 ค้นหา เลขที่ใบกำกับ / ผู้จำหน่าย / เลขผู้เสียภาษี"
          style={{ ...inp, flex: 1, minWidth: 220 }} />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: onlyUnmatched ? "#991b1b" : "#374151", cursor: "pointer", whiteSpace: "nowrap", padding: "6px 10px", borderRadius: 6, border: "1px solid " + (onlyUnmatched ? "#fca5a5" : "#d1d5db"), background: onlyUnmatched ? "#fef2f2" : "#fff" }}>
          <input type="checkbox" checked={onlyUnmatched} onChange={e => setOnlyUnmatched(e.target.checked)} />
          ✗ เฉพาะไม่พบ ({rows.length - match.matchedCount})
        </label>
        <button onClick={loadRows} disabled={loading || !period} style={btn("#0369a1")}>🔄 รีเฟรช</button>
        <button onClick={() => printReport({ affiliation, period, companyName, companyTaxId, rows: displayRows, sumBase, sumVat })}
          disabled={displayRows.length === 0} style={btn("#7c3aed")}>🖨️ พิมพ์</button>
      </div>

      {/* Report header */}
      {companyName && (
        <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#072d6b" }}>รายงานภาษีซื้อ (ภ.พ.30) — {companyName} {companyTaxId ? `(${companyTaxId})` : ""}</div>
          <div style={{ color: "#6b7280" }}>สำหรับงวดภาษี {periodLabel(period)}</div>
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
        <span>{onlyUnmatched ? "แสดง" : "รายการทั้งหมด"} <strong>{displayRows.length}</strong> รายการ{onlyUnmatched ? " (เฉพาะไม่พบ)" : ""}</span>
        {rows.length > 0 && (
          <>
            <span style={{ color: "#065f46" }}>✓ จับคู่ได้ <strong>{match.matchedCount}</strong></span>
            <span style={{ color: "#991b1b" }}>✗ ไม่พบในแอป <strong>{rows.length - match.matchedCount}</strong></span>
          </>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ color: "#374151" }}>มูลค่ารวม: <strong>{fmt(sumBase)}</strong></span>
        <span style={{ color: "#dc2626" }}>ภาษีซื้อรวม: <strong>{fmt(sumVat)}</strong> บาท</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : displayRows.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
            {onlyUnmatched ? "ไม่มีแถวที่จับคู่ไม่ได้ 🎉" : 'ไม่มีข้อมูล — เลือกสังกัด/รอบยื่น หรือ upload ไฟล์ที่หน้า "Upload ข้อมูลทางบัญชี"'}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={{ ...th, textAlign: "center", width: 44 }}>ลำดับ</th>
                <th style={th}>วันที่ใบกำกับ</th>
                <th style={th}>เลขที่ใบกำกับ</th>
                <th style={th}>เลขที่อ้างอิง</th>
                <th style={th}>ชื่อผู้จำหน่าย</th>
                <th style={{ ...th, textAlign: "right" }}>มูลค่า</th>
                <th style={{ ...th, textAlign: "right" }}>ภาษีมูลค่าเพิ่ม</th>
                <th style={{ ...th, textAlign: "center" }}>จับคู่ (จัดการภาษีซื้อ)</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, i) => (
                <tr key={r.id || i} style={{ borderTop: "1px solid #eef2f7" }}>
                  <td style={{ ...td, textAlign: "center", color: "#6b7280" }}>{r.seq ?? i + 1}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.tax_invoice_date)}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#1d4ed8" }}>{r.tax_invoice_no || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", color: "#6b7280" }}>{r.reference_no || "-"}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.vendor_name || "-"}</div>
                    {r.vendor_branch_note && <div style={{ fontSize: 11, color: "#6b7280" }}>{r.vendor_branch_note}</div>}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.amount_before_vat)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(r.vat_amount)}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {(() => {
                      const st = statusOf(r, i);
                      if (!st.matched) {
                        return (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ padding: "2px 8px", borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>✗ ไม่พบ</span>
                            <button onClick={() => startPairing(r)} disabled={pairSaving}
                              title="เปิดหน้าต่างเลือกรายการฝั่งจัดการภาษีซื้อมาจับคู่เอง (เรียงตามชื่อ/ยอดที่คล้าย)"
                              style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8",
                                cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                              🔗 จับคู่
                            </button>
                          </span>
                        );
                      }
                      if (st.manual) {
                        const docs = st.appDocs || [];
                        const docList = docs.map(d => d.doc_no).join(", ");
                        const label = docs.length > 1
                          ? `${docs.length} ใบ${st.appSource ? ` · ${SRC_LABEL[st.appSource] || st.appSource}` : ""}`
                          : (st.appSource ? `${SRC_LABEL[st.appSource] || st.appSource}` : "");
                        return (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span title={`จับคู่เอง · ${docList}`}
                              style={{ padding: "2px 8px", borderRadius: 10, background: "#ede9fe", color: "#6d28d9", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                              ✓ จับคู่เอง{label ? ` · ${label}` : ""}
                            </span>
                            <button onClick={() => removeManualMatch(r)} disabled={pairSaving} title={`ยกเลิกจับคู่กับ ${docList}`}
                              style={{ padding: "1px 6px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 11, color: "#6b7280" }}>
                              ✕
                            </button>
                          </span>
                        );
                      }
                      return (
                        <span title={st.appRow ? `${SRC_LABEL[st.appRow.source] || st.appRow.source} · ${st.appRow.doc_no || ""}` : ""}
                          style={{ padding: "2px 8px", borderRadius: 10, background: "#d1fae5", color: "#065f46", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                          ✓ {st.appRow ? (SRC_LABEL[st.appRow.source] || "") : ""}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #072d6b", background: "#f8fafc", fontWeight: 700 }}>
                <td style={td} colSpan={5}>ยอดรวมทั้งสิ้น</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(sumBase)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{fmt(sumVat)}</td>
                <td style={td}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* มีในจัดการภาษีซื้อ แต่ไม่มีในรายงาน FLOW ACC */}
      {!loading && match.appOnly.length > 0 && (
        <div style={{ marginTop: 14, background: "#fff", border: "1px solid #fecaca", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: "#fef2f2", color: "#991b1b", fontWeight: 700, fontSize: 13 }}>
            ⚠️ มีในจัดการภาษีซื้อ ({affiliation} · {periodLabel(period)}) แต่ไม่มีในรายงาน FLOW ACC — {match.appOnly.length} รายการ
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead style={{ background: "#fee2e2", color: "#7f1d1d" }}>
                <tr>
                  <th style={th}>ประเภท</th>
                  <th style={th}>วันที่</th>
                  <th style={th}>เลขที่เอกสาร</th>
                  <th style={th}>ชื่อผู้จำหน่าย</th>
                  <th style={{ ...th, textAlign: "right" }}>มูลค่า</th>
                  <th style={{ ...th, textAlign: "right" }}>ภาษีมูลค่าเพิ่ม</th>
                </tr>
              </thead>
              <tbody>
                {match.appOnly.map((a, i) => (
                  <tr key={a.doc_no ? a.source + a.doc_no : i} style={{ borderTop: "1px solid #fee2e2" }}>
                    <td style={td}>{SRC_LABEL[a.source] || a.source}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(a.doc_date)}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#1d4ed8" }}>{a.doc_no || "-"}</td>
                    <td style={td}>{a.vendor_name || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(a.amount_before_vat)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(a.vat_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* popup จับคู่เอง — เรียงตามความคล้าย (ชื่อ/ยอด) */}
      {pairing && (
        <PairModal flow={pairing} candidates={match.pairCandidates} saving={pairSaving}
          onPick={a => saveManualMatch(pairing, a)} onClose={() => setPairing(null)} />
      )}
    </div>
  );
}

// ── Popup จับคู่เอง: เรียงตามความคล้าย + ติ๊กเลือกหลายใบ (ใบสรุป = หลายใบรับ) ────
function PairModal({ flow, candidates, saving, onPick, onClose }) {
  const [kw, setKw] = useState("");
  const [sel, setSel] = useState(() => new Set()); // key = source|doc_no
  const keyOf = a => `${a.source || ""}|${a.doc_no || ""}`;

  const scored = useMemo(() => {
    const list = candidates.map(a => ({
      a, score: pairScore(flow, a),
      amt: amtScore(flow, a), name: nameSim(flow.vendor_name, a.vendor_name),
    }));
    const q = kw.trim().toLowerCase();
    const filtered = q
      ? list.filter(({ a }) => [a.doc_no, a.vendor_name, a.project].filter(Boolean).join(" ").toLowerCase().includes(q))
      : list;
    return filtered.sort((x, y) => y.score - x.score);
  }, [flow, candidates, kw]);

  const selRows = candidates.filter(a => sel.has(keyOf(a)));
  const selBase = selRows.reduce((s, a) => s + Number(a.amount_before_vat || 0), 0);
  const selVat = selRows.reduce((s, a) => s + Number(a.vat_amount || 0), 0);
  const diffVat = Number(flow.vat_amount || 0) - selVat;
  const vatOk = selRows.length > 0 && Math.abs(diffVat) <= 1; // ต่างไม่เกิน 1 บาท = ยอดลงตัว

  const toggle = a => setSel(prev => { const n = new Set(prev); const k = keyOf(a); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const selectShown = () => setSel(new Set(scored.map(({ a }) => keyOf(a))));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1100, padding: 20, overflowY: "auto" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 880, maxWidth: "96vw", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "2px solid #e5e7eb" }}>
          <h3 style={{ margin: 0, color: "#b45309", fontSize: 16 }}>🔗 จับคู่ใบกำกับจาก FLOW ACC</h3>
          <span style={{ fontSize: 12, color: "#6b7280" }}>ติ๊กได้หลายใบ — ใบสรุป 1 ใบจับกับใบรับหลายใบได้</span>
          <button onClick={onClose} style={{ marginLeft: "auto", padding: "2px 10px", background: "transparent", border: "none", cursor: "pointer", fontSize: 22, color: "#6b7280" }}>✕</button>
        </div>

        {/* ใบ FLOW ที่กำลังจับคู่ */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", padding: "10px 18px", background: "#fffbeb", borderBottom: "1px solid #fde68a", fontSize: 13 }}>
          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#1d4ed8" }}>{flow.tax_invoice_no || "-"}</span>
          <span style={{ color: "#6b7280" }}>{fmtDate(flow.tax_invoice_date)}</span>
          <span style={{ fontWeight: 600 }}>{flow.vendor_name || "-"}</span>
          <div style={{ flex: 1 }} />
          <span>มูลค่า <strong style={{ fontFamily: "monospace" }}>{fmt(flow.amount_before_vat)}</strong></span>
          <span style={{ color: "#dc2626" }}>VAT <strong style={{ fontFamily: "monospace" }}>{fmt(flow.vat_amount)}</strong></span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 18px" }}>
          <input type="text" value={kw} onChange={e => setKw(e.target.value)} autoFocus
            placeholder="🔎 ค้นหา เลขที่เอกสาร / ผู้จำหน่าย" style={{ ...inp, flex: 1 }} />
          <button onClick={selectShown} disabled={scored.length === 0}
            style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
            ☑️ เลือกทั้งหมดที่แสดง ({scored.length})
          </button>
          <button onClick={() => setSel(new Set())} disabled={sel.size === 0}
            style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
            ล้าง
          </button>
        </div>

        <div style={{ maxHeight: "44vh", overflowY: "auto", padding: "0 18px" }}>
          {scored.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>ไม่มีรายการฝั่งจัดการภาษีซื้อเหลือให้จับคู่ในรอบนี้</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                <tr>
                  <th style={{ ...th, width: 36, color: "#374151" }}></th>
                  <th style={{ ...th, color: "#374151" }}>ความคล้าย</th>
                  <th style={{ ...th, color: "#374151" }}>ประเภท</th>
                  <th style={{ ...th, color: "#374151" }}>วันที่</th>
                  <th style={{ ...th, color: "#374151" }}>เลขที่เอกสาร</th>
                  <th style={{ ...th, color: "#374151" }}>ชื่อผู้จำหน่าย</th>
                  <th style={{ ...th, textAlign: "right", color: "#374151" }}>มูลค่า / VAT</th>
                </tr>
              </thead>
              <tbody>
                {scored.map(({ a, score, amt, name }, i) => {
                  const checked = sel.has(keyOf(a));
                  const isCN = a.doc_type === "credit_note";
                  return (
                    <tr key={a.doc_no ? a.source + a.doc_no : i} onClick={() => toggle(a)}
                      style={{ borderTop: "1px solid #eef2f7", cursor: "pointer",
                        background: checked ? "#fef3c7" : isCN ? "#fef2f2" : score >= 0.5 ? "#f0fdf4" : "transparent" }}>
                      <td style={{ ...td, textAlign: "center" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(a)} onClick={e => e.stopPropagation()} />
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {amt >= 1 && <span style={simBadge("#d1fae5", "#065f46")}>💰 ยอดตรง</span>}
                        {amt >= 0.4 && amt < 1 && <span style={simBadge("#fef3c7", "#92400e")}>💰 ยอดใกล้</span>}
                        {name >= 0.45 && <span style={simBadge("#dbeafe", "#1e40af")}>🏷 ชื่อคล้าย</span>}
                        {amt < 0.4 && name < 0.45 && <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>}
                      </td>
                      <td style={td}>
                        {SRC_LABEL[a.source] || a.source}
                        {isCN && <span style={{ ...simBadge("#fee2e2", "#991b1b"), marginLeft: 4, marginRight: 0 }}>ใบลดหนี้</span>}
                        {a.source === "lockton" && <span style={{ ...simBadge("#ede9fe", "#6d28d9"), marginLeft: 4, marginRight: 0 }}>งานรับเรื่อง</span>}
                        {a.source === "theft_invoice" && <span style={{ ...simBadge("#fce7f3", "#9d174d"), marginLeft: 4, marginRight: 0 }}>52071</span>}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(a.doc_date)}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: isCN ? "#991b1b" : "#1d4ed8" }}>{a.doc_no || "-"}</td>
                      <td style={td}>
                        {a.vendor_name || "-"}
                        {a.project && <div style={{ fontSize: 10, color: "#6b7280" }}>{a.project}</div>}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                        <div style={{ color: isCN ? "#991b1b" : "inherit" }}>{fmt(a.amount_before_vat)}</div>
                        <div style={{ fontSize: 11, color: "#dc2626" }}>{fmt(a.vat_amount)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* แถบสรุปยอดที่เลือก เทียบใบ FLOW */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "12px 18px", borderTop: "2px solid #e5e7eb", background: "#f8fafc" }}>
          <span style={{ fontSize: 13 }}>☑️ เลือก <strong>{selRows.length}</strong> ใบ</span>
          <span style={{ fontSize: 13 }}>รวมมูลค่า <strong style={{ fontFamily: "monospace" }}>{fmt(selBase)}</strong></span>
          <span style={{ fontSize: 13 }}>รวม VAT <strong style={{ fontFamily: "monospace" }}>{fmt(selVat)}</strong></span>
          {selRows.length > 0 && (
            <span style={{ padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700,
              background: vatOk ? "#d1fae5" : "#fee2e2", color: vatOk ? "#065f46" : "#991b1b" }}>
              {vatOk ? "✓ ยอด VAT ลงตัวกับใบ FLOW" : `ต่างจากใบ FLOW ${fmt(Math.abs(diffVat))} บาท`}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>ยกเลิก</button>
          <button onClick={() => onPick(selRows)} disabled={saving || selRows.length === 0}
            style={{ padding: "8px 22px", background: saving || selRows.length === 0 ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: saving || selRows.length === 0 ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700 }}>
            {saving ? "💾 กำลังบันทึก..." : `💾 จับคู่ ${selRows.length || ""} ใบ`}
          </button>
        </div>
      </div>
    </div>
  );
}

const simBadge = (bg, color) => ({ display: "inline-block", padding: "1px 7px", borderRadius: 10, background: bg, color, fontSize: 11, fontWeight: 700, marginRight: 4 });

// ── พิมพ์รายงาน (รูปแบบราชการ) ───────────────────────────────────────────────
function printReport({ affiliation, period, companyName, companyTaxId, rows, sumBase, sumVat }) {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const body = rows.map((r, i) => `<tr>
      <td class="c">${r.seq ?? i + 1}</td>
      <td class="c">${esc(fmtDate(r.tax_invoice_date))}</td>
      <td>${esc(r.tax_invoice_no || "")}</td>
      <td>${esc(r.reference_no || "")}</td>
      <td>${esc(r.vendor_name || "")}</td>
      <td class="c">${esc(r.vendor_tax_id || "")}</td>
      <td class="c">${esc(r.branch_type || "")}</td>
      <td class="r">${fmt(r.amount_before_vat)}</td>
      <td class="r">${fmt(r.vat_amount)}</td>
    </tr>`).join("");
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานภาษีซื้อ ${esc(period)}</title>
    <style>
      *{font-family:'Tahoma','Sarabun',sans-serif;box-sizing:border-box}
      body{margin:22px;color:#111827;font-size:12px}
      h1{font-size:17px;margin:0 0 2px}
      .sub{color:#374151;margin-bottom:2px}
      .muted{color:#6b7280;font-size:11px;margin-bottom:10px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #cbd5e1;padding:4px 6px;vertical-align:top}
      th{background:#e2e8f0;font-size:11px}
      .c{text-align:center}.r{text-align:right;font-family:monospace}
      tfoot td{font-weight:bold;background:#f1f5f9}
      @media print{body{margin:0;padding:14px}}
    </style></head><body>
    <h1>รายงานภาษีซื้อ (ภ.พ.30)</h1>
    <div class="sub">${esc(companyName)} ${companyTaxId ? `เลขประจำตัวผู้เสียภาษี ${esc(companyTaxId)}` : ""}</div>
    <div class="sub">สำหรับงวดภาษี ${esc(periodLabel(period))} · สังกัด ${esc(affiliation)}</div>
    <div class="muted">พิมพ์จากระบบ — ข้อมูลนำเข้าจาก FLOW ACC</div>
    <table>
      <thead><tr>
        <th>ลำดับ</th><th>วันที่ใบกำกับ</th><th>เลขที่ใบกำกับ</th><th>เลขที่อ้างอิง</th>
        <th>ชื่อผู้จำหน่าย</th><th>เลขผู้เสียภาษี</th><th>สนง./สาขา</th><th>มูลค่า</th><th>ภาษีมูลค่าเพิ่ม</th>
      </tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="7">ยอดรวมทั้งสิ้น</td><td class="r">${fmt(sumBase)}</td><td class="r">${fmt(sumVat)}</td></tr></tfoot>
    </table>
  </body></html>`;
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) return;
  w.document.write(html + "<script>window.onload=function(){window.print();}<\/script>");
  w.document.close();
}

const inp = { padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "9px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "7px 8px", fontSize: 12.5, verticalAlign: "top" };
const btn = (color) => ({ padding: "7px 14px", background: color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 });
