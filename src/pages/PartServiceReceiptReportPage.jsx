import React, { useEffect, useMemo, useState } from "react";

// รายงานรับชำระเงินค่าอะไหล่และบริการ ระบบ DMS และ NIDS (Report Admin — user 2026-09-16)
// ข้อมูลจากไฟล์ที่ upload ในหน้า Upload ข้อมูลทางบัญชี: dms_part_service_receipts (YAMAHA) · nid_part_sale_receipts (HONDA ขายอะไหล่) · nid_service_receipts (HONDA งานบริการ)
// backend: part-service-receipt-upload-api action list_receipts {date_from, date_to} → {listjson}
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-service-receipt-upload-api";
// โหมดเทียบ (user 2026-09-16): ใบเสร็จจากไฟล์ upload ↔ ใบรับชำระ PSR ที่พนักงานบันทึกในระบบ (part_service_payments) จับคู่ฝั่ง client ไม่ต้องแก้ n8n
const PSR_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-service-payment-api";
const BRANCH_NAME = { SCY01: "สิงห์ชัย วังน้อย", SCY04: "สิงห์ชัย สาขา 4", SCY05: "ป.เปา นครหลวง", SCY06: "ป.เปา วังน้อย", SCY07: "สิงห์ชัย ตลาด", SCY10: "สิงห์ชัย สาขา 10" };
const branchLabel = (c) => (BRANCH_NAME[c] ? `${c} ${BRANCH_NAME[c]}` : c || "-");
const SOURCES = ["DMS", "NIDS ขายอะไหล่", "NIDS งานบริการ"];
const PAY_COLS = [["pay_cash", "เงินสด"], ["pay_transfer", "เงินโอน"], ["pay_card", "บัตรเครดิต"], ["pay_deposit", "มัดจำ"], ["pay_other", "อื่นๆ"]];

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const baht = (n) => num(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thaiDate = (iso) => { if (!iso) return "-"; const s = String(iso).slice(0, 10); const [y, m, d] = s.split("-"); return y && m && d ? `${d}/${m}/${Number(y) + 543}` : s; };
const pad = (n) => String(n).padStart(2, "0");
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
async function post(body) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text(); try { return JSON.parse(t); } catch { return {}; }
}
const unwrapList = (d) => { try { return typeof d?.listjson === "string" ? JSON.parse(d.listjson) : Array.isArray(d) ? d : []; } catch { return []; } };

// ---------- จับคู่ใบเสร็จไฟล์ upload ↔ ใบ PSR ----------
// กุญแจ: DMS ref_doc_no = doc_no ของ PSR ตรงตัว (SCY01-JOB2609…/SCY01-SS2609…) · NIDS: ref 69SERV/0003633 (บริการ) / 69RTSL/0000549 (ขาย, หลายใบขายต่อใบเสร็จได้)
// ลำดับ: 1) เลขอ้างอิงตรง (สาขาเดียวกัน) 2) เลขท้ายตรง + ยอดเท่า (พนักงานพิมพ์ prefix ผิด เช่น 69SERV แทน 69RTSL) 3) สาขา+วัน+ยอดเท่า (ยังไม่ถูกจับคู่)
const normDoc = (v) => String(v || "").toUpperCase().replace(/\s+/g, "");
const tailKey = (v) => { const m = String(v || "").match(/(\d+)\D*$/); return m ? String(Number(m[1])) : ""; };
const refsOf = (r) => String(r.ref_no || "").split(/[,;]\s*/).map(x => x.trim()).filter(Boolean);
const eq = (a, b) => Math.abs(num(a) - num(b)) < 0.005;
function reconcile(uploadRows, psrRows) {
  const ups = uploadRows.filter(r => !r.status || r.status === "ปกติ");
  const psr = psrRows.filter(p => String(p.status || "active") === "active");
  const byDoc = new Map(), byTail = new Map(), byDayAmt = new Map();
  psr.forEach(p => {
    const br = p.branch_code || "", d = String(p.paid_date || "").slice(0, 10);
    const k1 = `${br}|${normDoc(p.doc_no)}`; (byDoc.get(k1) || byDoc.set(k1, []).get(k1)).push(p);
    const k2 = `${br}|${tailKey(p.doc_no)}`; if (tailKey(p.doc_no)) (byTail.get(k2) || byTail.set(k2, []).get(k2)).push(p);
    const k3 = `${br}|${d}|${num(p.paid_amount).toFixed(2)}`; (byDayAmt.get(k3) || byDayAmt.set(k3, []).get(k3)).push(p);
  });
  const used = new Set();
  const take = (arr, pred) => { const x = (arr || []).find(p => !used.has(p.payment_id) && (!pred || pred(p))); if (x) used.add(x.payment_id); return x || null; };
  const out = ups.map(r => {
    const br = r.branch_code || "", refs = refsOf(r), d = String(r.receipt_date || "").slice(0, 10);
    let p = null, how = "";
    for (const ref of refs) { p = take(byDoc.get(`${br}|${normDoc(ref)}`)); if (p) { how = "เลขอ้างอิง"; break; } }
    if (!p) for (const ref of refs) { const t = tailKey(ref); if (!t) continue; p = take(byTail.get(`${br}|${t}`), x => eq(x.paid_amount, r.total_amount)); if (p) { how = "เลขท้าย+ยอด"; break; } }
    if (!p) { p = take(byDayAmt.get(`${br}|${d}|${num(r.total_amount).toFixed(2)}`)); if (p) how = "วัน+ยอด"; }
    const diff = p ? num(r.total_amount) - num(p.paid_amount) : num(r.total_amount);
    const status = !p ? "ไม่พบในระบบ" : eq(diff, 0) ? "ตรง" : "ยอดต่าง";
    return { kind: "upload", key: `U|${r.source}|${br}|${r.receipt_no}`, date: d, branch: br, source: r.source, receipt_no: r.receipt_no, ref: refs.join(", "), customer: r.customer_name || "", amount: num(r.total_amount), method_file: methodOfUpload(r),
      psr: p, how, diff, status };
  });
  psr.filter(p => !used.has(p.payment_id)).forEach(p => out.push({ kind: "psr", key: `P|${p.payment_id}`, date: String(p.paid_date || "").slice(0, 10), branch: p.branch_code || "", source: "", receipt_no: "", ref: "", customer: "", amount: 0, method_file: "",
    psr: p, how: "", diff: -num(p.paid_amount), status: "ไม่มีในไฟล์" }));
  out.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.branch).localeCompare(String(b.branch)) || String(a.receipt_no || a.psr?.receipt_no).localeCompare(String(b.receipt_no || b.psr?.receipt_no)));
  return out;
}
const methodOfUpload = (r) => r.source === "NIDS งานบริการ" ? "" : PAY_COLS.filter(([k]) => num(r[k]) > 0).map(([, l]) => l).join("+");
const RECON_STATUS = { "ตรง": ["#dcfce7", "#15803d"], "ยอดต่าง": ["#fef3c7", "#b45309"], "ไม่พบในระบบ": ["#fee2e2", "#b91c1c"], "ไม่มีในไฟล์": ["#ede9fe", "#6d28d9"] };

export default function PartServiceReceiptReportPage() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [fSource, setFSource] = useState("");
  const [fBranch, setFBranch] = useState("");
  const [fPay, setFPay] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("list"); // list | recon
  const [psrRows, setPsrRows] = useState([]);
  const [reconOnlyDiff, setReconOnlyDiff] = useState(true);

  async function loadPsr(from, to) {
    try {
      const res = await fetch(PSR_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_payments", date_from: from, date_to: to }) });
      const t = await res.text(); let d = []; try { d = JSON.parse(t); } catch { d = []; }
      const arr = Array.isArray(d) ? d : Array.isArray(d?.rows) ? d.rows : unwrapList(d);
      setPsrRows(arr.filter(p => p && p.payment_id));
    } catch { setPsrRows([]); }
  }

  async function load() {
    setLoading(true); setMessage("");
    try {
      const d = await post({ action: "list_receipts", date_from: dateFrom, date_to: dateTo });
      const first = Array.isArray(d) ? d[0] : d;
      if (first?.error) throw new Error(first.error);
      setRows(unwrapList(first).filter(r => r && r.receipt_no));
      await loadPsr(dateFrom, dateTo);
    } catch (e) { setMessage("❌ โหลดไม่สำเร็จ (ยัง import workflow part-service-receipt-upload-api เวอร์ชันล่าสุด?) " + (e?.message || "")); setRows([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  const branches = useMemo(() => [...new Set(rows.map(r => r.branch_code).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => rows.filter(r => {
    if (fSource && r.source !== fSource) return false;
    if (fBranch && r.branch_code !== fBranch) return false;
    if (fPay && !(num(r[fPay]) > 0)) return false;
    if (search.trim()) {
      const kw = search.trim().toLowerCase();
      if (![r.receipt_no, r.ref_no, r.customer_name, r.doc_type].filter(Boolean).join(" ").toLowerCase().includes(kw)) return false;
    }
    return true;
  }), [rows, fSource, fBranch, fPay, search]);

  // สรุปต่อระบบ × สาขา (จำนวนใบ ยอดรวม แยกวิธีชำระ)
  const summary = useMemo(() => {
    const m = new Map();
    rows.filter(r => (!fSource || r.source === fSource) && (!fBranch || r.branch_code === fBranch)).forEach(r => {
      const k = `${r.source}|${r.branch_code}`;
      const s = m.get(k) || { source: r.source, branch: r.branch_code, count: 0, total: 0, pay_cash: 0, pay_transfer: 0, pay_card: 0, pay_deposit: 0, pay_other: 0 };
      s.count += 1; s.total += num(r.total_amount); PAY_COLS.forEach(([c]) => { s[c] += num(r[c]); }); m.set(k, s);
    });
    return [...m.values()].sort((a, b) => SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source) || String(a.branch).localeCompare(String(b.branch)));
  }, [rows, fSource, fBranch]);
  const tot = (key) => filtered.reduce((s, r) => s + num(r[key]), 0);

  // ---------- โหมดเทียบกับรับชำระในระบบ ----------
  const recon = useMemo(() => reconcile(rows, psrRows), [rows, psrRows]);
  const reconFiltered = useMemo(() => recon.filter(x => {
    if (fBranch && x.branch !== fBranch) return false;
    if (fSource && x.kind === "upload" && x.source !== fSource) return false;
    if (reconOnlyDiff && x.status === "ตรง") return false;
    if (search.trim()) {
      const kw = search.trim().toLowerCase();
      if (![x.receipt_no, x.ref, x.customer, x.psr?.receipt_no, x.psr?.doc_no, x.psr?.customer_name].filter(Boolean).join(" ").toLowerCase().includes(kw)) return false;
    }
    return true;
  }), [recon, fBranch, fSource, reconOnlyDiff, search]);
  const reconSummary = useMemo(() => {
    const m = new Map();
    recon.filter(x => !fBranch || x.branch === fBranch).forEach(x => {
      const g = m.get(x.branch) || { branch: x.branch, up_count: 0, up_total: 0, psr_count: 0, psr_total: 0, match: 0, diff: 0, missing: 0, extra: 0 };
      if (x.kind === "upload") { g.up_count += 1; g.up_total += x.amount; }
      if (x.psr) { g.psr_count += 1; g.psr_total += num(x.psr.paid_amount); }
      if (x.status === "ตรง") g.match += 1; else if (x.status === "ยอดต่าง") g.diff += 1; else if (x.status === "ไม่พบในระบบ") g.missing += 1; else g.extra += 1;
      m.set(x.branch, g);
    });
    return [...m.values()].sort((a, b) => String(a.branch).localeCompare(String(b.branch)));
  }, [recon, fBranch]);
  function exportReconCsv() {
    const head = ["วันที่", "สาขา", "ระบบ", "เลขใบเสร็จ (ไฟล์)", "อ้างอิง", "ลูกค้า (ไฟล์)", "ยอดไฟล์", "วิธี (ไฟล์)", "ใบเสร็จ PSR", "เอกสาร PSR", "วันที่ PSR", "ลูกค้า PSR", "ยอด PSR", "วิธี PSR", "ผลต่าง", "จับคู่ด้วย", "สถานะ"];
    const lines = reconFiltered.map(x => [thaiDate(x.date), branchLabel(x.branch), x.source, x.receipt_no, x.ref, x.customer, x.kind === "upload" ? x.amount.toFixed(2) : "", x.method_file,
      x.psr?.receipt_no || "", x.psr?.doc_no || "", x.psr ? thaiDate(x.psr.paid_date) : "", x.psr?.customer_name || "", x.psr ? num(x.psr.paid_amount).toFixed(2) : "", x.psr?.payment_method || "", x.diff.toFixed(2), x.how, x.status]
      .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = "\ufeff" + [head.join(","), ...lines].join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `เทียบรับชำระอะไหล่บริการ_${dateFrom}_${dateTo}.csv`; a.click();
  }

  function exportCsv() {
    const head = ["วันที่รับเงิน", "ระบบ", "สาขา", "เลขที่ใบเสร็จ", "ประเภท", "ลูกค้า", "เอกสารอ้างอิง", "ยอดรวม", "เงินสด", "เงินโอน", "บัตรเครดิต", "มัดจำ", "อื่นๆ", "สถานะ"];
    const lines = filtered.map(r => [thaiDate(r.receipt_date), r.source, branchLabel(r.branch_code), r.receipt_no, r.doc_type || "", r.customer_name || "", r.ref_no || "", num(r.total_amount).toFixed(2), num(r.pay_cash).toFixed(2), num(r.pay_transfer).toFixed(2), num(r.pay_card).toFixed(2), num(r.pay_deposit).toFixed(2), num(r.pay_other).toFixed(2), r.status || ""]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = "﻿" + [head.join(","), ...lines].join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `รับชำระค่าอะไหล่และบริการ_${dateFrom}_${dateTo}.csv`; a.click();
  }
  function printReport() {
    const w = window.open("", "_blank", "width=1150,height=800");
    const esc = (v) => String(v == null ? "" : v).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const sums = summary.map(s => `<tr><td>${esc(s.source)}</td><td>${esc(branchLabel(s.branch))}</td><td class="r">${s.count}</td><td class="r">${baht(s.pay_cash)}</td><td class="r">${baht(s.pay_transfer)}</td><td class="r">${baht(s.pay_card)}</td><td class="r">${baht(s.pay_deposit)}</td><td class="r">${baht(s.pay_other)}</td><td class="r"><b>${baht(s.total)}</b></td></tr>`).join("");
    const trs = filtered.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${thaiDate(r.receipt_date)}</td><td>${esc(r.source)}</td><td>${esc(r.branch_code)}</td><td>${esc(r.receipt_no)}</td><td>${esc(r.doc_type || "")}</td><td>${esc(r.customer_name || "")}</td><td>${esc(r.ref_no || "")}</td><td class="r">${baht(r.pay_cash)}</td><td class="r">${baht(r.pay_transfer)}</td><td class="r">${baht(r.pay_card)}</td><td class="r">${baht(r.pay_deposit)}</td><td class="r">${baht(r.pay_other)}</td><td class="r"><b>${baht(r.total_amount)}</b></td></tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>รายงานรับชำระเงินค่าอะไหล่และบริการ</title>
<style>body{font-family:Tahoma,sans-serif;font-size:10.5px;padding:12px}h2{margin:0 0 4px;font-size:15px}.info{color:#555;margin-bottom:8px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1px solid #ccc;padding:3px 5px}th{background:#072d6b;color:#fff}.r{text-align:right}.c{text-align:center}tfoot td{font-weight:700;background:#f1f5f9}</style></head><body>
<h2>รายงานรับชำระเงินค่าอะไหล่และบริการ (DMS · NIDS)</h2><div class="info">ช่วงวันที่ ${thaiDate(dateFrom)} – ${thaiDate(dateTo)}${fSource ? " · " + esc(fSource) : ""}${fBranch ? " · " + esc(branchLabel(fBranch)) : ""} · ${filtered.length} ใบ</div>
<table><thead><tr><th>ระบบ</th><th>สาขา</th><th class="r">ใบ</th><th class="r">เงินสด</th><th class="r">เงินโอน</th><th class="r">บัตร</th><th class="r">มัดจำ</th><th class="r">อื่นๆ</th><th class="r">รวม</th></tr></thead><tbody>${sums}</tbody></table>
<table><thead><tr><th>#</th><th>วันที่</th><th>ระบบ</th><th>สาขา</th><th>เลขที่ใบเสร็จ</th><th>ประเภท</th><th>ลูกค้า</th><th>อ้างอิง</th><th class="r">เงินสด</th><th class="r">เงินโอน</th><th class="r">บัตร</th><th class="r">มัดจำ</th><th class="r">อื่นๆ</th><th class="r">รวม</th></tr></thead><tbody>${trs}</tbody>
<tfoot><tr><td colspan="8" class="r">รวม ${filtered.length} ใบ</td><td class="r">${baht(tot("pay_cash"))}</td><td class="r">${baht(tot("pay_transfer"))}</td><td class="r">${baht(tot("pay_card"))}</td><td class="r">${baht(tot("pay_deposit"))}</td><td class="r">${baht(tot("pay_other"))}</td><td class="r">${baht(tot("total_amount"))}</td></tr></tfoot></table>
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  const inp = { padding: "7px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 13.5, background: "#fff" };
  const th = { padding: "8px 6px", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff", position: "sticky", top: 0 };
  const td = { padding: "7px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
  const tag = (t, bg, fg) => <span style={{ padding: "1px 8px", borderRadius: 10, fontSize: 11, background: bg, color: fg, whiteSpace: "nowrap", fontWeight: 700 }}>{t}</span>;
  const srcTag = (s) => s === "DMS" ? tag("DMS", "#dbeafe", "#1e40af") : s === "NIDS ขายอะไหล่" ? tag("NIDS ขาย", "#fef3c7", "#92400e") : tag("NIDS บริการ", "#dcfce7", "#15803d");
  const money = (v) => num(v) ? baht(v) : <span style={{ color: "#cbd5e1" }}>-</span>;

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1450 }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>💵 รายงานรับชำระเงินค่าอะไหล่และบริการ (DMS · NIDS)</h2>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
        ใบเสร็จรับเงินจากไฟล์ที่ upload — <b>DMS</b> (YAMAHA สิงห์ชัย ขาย+บริการ) · <b>NIDS ขายอะไหล่</b> (HONDA ใบเสร็จ SREC) · <b>NIDS งานบริการ</b> (HONDA ใบเสร็จ SR) แยกวิธีชำระ เงินสด/โอน/บัตร/มัดจำ/อื่นๆ
      </div>
      {message && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, fontSize: 14, background: "#fef2f2", border: "1px solid #fecaca" }}>{message}</div>}

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <button onClick={load} disabled={loading} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer" }}>{loading ? "⏳ กำลังโหลด..." : "🔍 แสดง"}</button>
        <span style={{ display: "inline-flex", border: "1.5px solid #cbd5e1", borderRadius: 8, overflow: "hidden" }}>
          {[["list", "📋 รายการ"], ["recon", "⚖️ เทียบกับรับชำระในระบบ"]].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700, fontSize: 13, background: mode === k ? "#072d6b" : "#fff", color: mode === k ? "#fff" : "#072d6b" }}>{l}</button>
          ))}
        </span>
        <select value={fSource} onChange={e => setFSource(e.target.value)} style={inp}>
          <option value="">ระบบ: ทั้งหมด</option>{SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fBranch} onChange={e => setFBranch(e.target.value)} style={inp}>
          <option value="">สาขา: ทั้งหมด</option>{branches.map(b => <option key={b} value={b}>{branchLabel(b)}</option>)}
        </select>
        {mode === "list" && <select value={fPay} onChange={e => setFPay(e.target.value)} style={inp}>
          <option value="">วิธีชำระ: ทั้งหมด</option>{PAY_COLS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>}
        {mode === "recon" && <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={reconOnlyDiff} onChange={e => setReconOnlyDiff(e.target.checked)} /> เฉพาะที่ไม่ตรง</label>}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา เลขใบเสร็จ / ลูกค้า / อ้างอิง" style={{ ...inp, width: 230 }} />
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {mode === "list" ? <>
            <button onClick={exportCsv} disabled={!filtered.length} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontFamily: "Tahoma" }}>⬇ Excel/CSV</button>
            <button onClick={printReport} disabled={!filtered.length} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#6b7280", color: "#fff", cursor: "pointer", fontFamily: "Tahoma" }}>🖨️ พิมพ์</button>
          </> : <button onClick={exportReconCsv} disabled={!reconFiltered.length} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontFamily: "Tahoma" }}>⬇ Excel/CSV</button>}
        </span>
      </div>

      {mode === "recon" && (
        <>
          <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 8, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            เทียบใบเสร็จจากไฟล์ upload (DMS/NIDS) กับใบรับชำระ <b>PSR</b> ที่พนักงานบันทึกในหน้า "รับชำระเงินค่าอะไหล่และบริการ" ช่วงวันที่เดียวกัน · จับคู่ด้วย <b>เลขอ้างอิง</b> (JOB/ใบขาย) → <b>เลขท้าย+ยอด</b> (พิมพ์ prefix ผิด) → <b>วัน+ยอด</b> · ไม่นับใบยกเลิกทั้ง 2 ฝั่ง
            {psrRows.length === 0 && !loading && <span style={{ color: "#b91c1c", marginLeft: 8 }}>⚠ ยังไม่ได้ข้อมูล PSR ในช่วงนี้ (กด แสดง อีกครั้ง)</span>}
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>สาขา</th><th style={{ ...th, textAlign: "right" }}>ใบจากไฟล์</th><th style={{ ...th, textAlign: "right" }}>ยอดไฟล์</th><th style={{ ...th, textAlign: "right" }}>ใบ PSR ในระบบ</th><th style={{ ...th, textAlign: "right" }}>ยอด PSR</th><th style={{ ...th, textAlign: "right" }}>ผลต่างยอด</th>
                <th style={{ ...th, textAlign: "right", background: "#15803d" }}>ตรง</th><th style={{ ...th, textAlign: "right", background: "#b45309" }}>ยอดต่าง</th><th style={{ ...th, textAlign: "right", background: "#b91c1c" }}>ไม่พบในระบบ</th><th style={{ ...th, textAlign: "right", background: "#6d28d9" }}>ไม่มีในไฟล์</th>
              </tr></thead>
              <tbody>
                {reconSummary.length === 0 && <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 18 }}>— ไม่มีข้อมูลในช่วงวันที่นี้ —</td></tr>}
                {reconSummary.map(g => (
                  <tr key={g.branch} onClick={() => setFBranch(fBranch === g.branch ? "" : g.branch)} style={{ cursor: "pointer", background: fBranch === g.branch ? "#eff6ff" : "#fff" }} title="คลิกเพื่อกรองสาขา">
                    <td style={{ ...td, fontSize: 12.5, fontWeight: 700 }}>{branchLabel(g.branch)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{g.up_count}</td><td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{baht(g.up_total)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{g.psr_count}</td><td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{baht(g.psr_total)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: eq(g.up_total, g.psr_total) ? "#15803d" : "#b91c1c" }}>{eq(g.up_total, g.psr_total) ? "0.00 ✓" : baht(g.up_total - g.psr_total)}</td>
                    <td style={{ ...td, textAlign: "right", color: "#15803d", fontWeight: 700 }}>{g.match}</td>
                    <td style={{ ...td, textAlign: "right", color: g.diff ? "#b45309" : "#cbd5e1", fontWeight: 700 }}>{g.diff}</td>
                    <td style={{ ...td, textAlign: "right", color: g.missing ? "#b91c1c" : "#cbd5e1", fontWeight: 700 }}>{g.missing}</td>
                    <td style={{ ...td, textAlign: "right", color: g.extra ? "#6d28d9" : "#cbd5e1", fontWeight: 700 }}>{g.extra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", maxHeight: "60vh", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>#</th><th style={th}>วันที่</th><th style={th}>สาขา</th><th style={th}>ไฟล์</th><th style={th}>เลขใบเสร็จ (ไฟล์)</th><th style={th}>อ้างอิง (ไฟล์)</th><th style={th}>ลูกค้า (ไฟล์)</th><th style={{ ...th, textAlign: "right" }}>ยอดไฟล์</th>
                <th style={{ ...th, background: "#1e3a8a" }}>ใบเสร็จ PSR</th><th style={{ ...th, background: "#1e3a8a" }}>เอกสาร PSR</th><th style={{ ...th, background: "#1e3a8a" }}>ลูกค้า PSR</th><th style={{ ...th, background: "#1e3a8a" }}>วิธี PSR</th><th style={{ ...th, textAlign: "right", background: "#1e3a8a" }}>ยอด PSR</th>
                <th style={{ ...th, textAlign: "right" }}>ผลต่าง</th><th style={th}>จับคู่ด้วย</th><th style={th}>สถานะ</th>
              </tr></thead>
              <tbody>
                {loading && <tr><td colSpan={16} style={{ ...td, textAlign: "center", padding: 24, color: "#6b7280" }}>กำลังโหลด...</td></tr>}
                {!loading && reconFiltered.length === 0 && <tr><td colSpan={16} style={{ ...td, textAlign: "center", padding: 24, color: "#15803d", fontWeight: 700 }}>{recon.length ? "✓ ทุกใบตรงกัน (ติ๊ก 'เฉพาะที่ไม่ตรง' ออกเพื่อดูทั้งหมด)" : "— ไม่มีข้อมูล —"}</td></tr>}
                {reconFiltered.map((x, i) => {
                  const [bg, fg] = RECON_STATUS[x.status] || ["#f1f5f9", "#334155"]; const p = x.psr;
                  const methodDiff = p && x.method_file && p.payment_method && x.method_file.replace(/บัตรเครดิต/g, "บัตร") !== String(p.payment_method).replace(/บัตรเครดิต/g, "บัตร") && x.status === "ตรง";
                  return (
                    <tr key={x.key} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
                      <td style={{ ...td, color: "#94a3b8" }}>{i + 1}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(x.date)}</td>
                      <td style={{ ...td, fontSize: 12 }}>{x.branch}</td>
                      <td style={td}>{x.source ? srcTag(x.source) : <span style={{ color: "#cbd5e1" }}>-</span>}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#072d6b", whiteSpace: "nowrap" }}>{x.receipt_no || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{x.ref || "-"}</td>
                      <td style={{ ...td, fontSize: 12 }}>{x.customer || "-"}{x.method_file ? <div style={{ fontSize: 10.5, color: "#64748b" }}>{x.method_file}</div> : null}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{x.kind === "upload" ? baht(x.amount) : <span style={{ color: "#cbd5e1" }}>-</span>}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#1e3a8a", whiteSpace: "nowrap" }}>{p?.receipt_no || <span style={{ color: "#cbd5e1" }}>-</span>}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{p ? <>{p.doc_no}{String(p.paid_date || "").slice(0, 10) !== x.date && x.kind === "upload" ? <div style={{ fontSize: 10.5, color: "#b45309" }}>วันที่ PSR {thaiDate(p.paid_date)}</div> : null}</> : "-"}</td>
                      <td style={{ ...td, fontSize: 12 }}>{p?.customer_name || "-"}</td>
                      <td style={{ ...td, fontSize: 11.5, color: methodDiff ? "#b45309" : "#475569" }}>{p?.payment_method || "-"}{methodDiff ? <div style={{ fontSize: 10.5 }}>⚠ วิธีต่างจากไฟล์</div> : null}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#1e3a8a" }}>{p ? baht(p.paid_amount) : <span style={{ color: "#cbd5e1" }}>-</span>}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: eq(x.diff, 0) ? "#15803d" : "#b91c1c" }}>{eq(x.diff, 0) ? "0.00" : baht(x.diff)}</td>
                      <td style={{ ...td, fontSize: 11.5, color: x.how === "เลขอ้างอิง" ? "#64748b" : "#b45309" }}>{x.how || "-"}</td>
                      <td style={td}>{tag(x.status, bg, fg)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {reconFiltered.length > 0 && (
                <tfoot><tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                  <td colSpan={7} style={{ ...td, textAlign: "right" }}>รวม {reconFiltered.length} รายการ</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{baht(reconFiltered.reduce((a, x) => a + (x.kind === "upload" ? x.amount : 0), 0))}</td>
                  <td colSpan={4} style={td}></td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{baht(reconFiltered.reduce((a, x) => a + (x.psr ? num(x.psr.paid_amount) : 0), 0))}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>{baht(reconFiltered.reduce((a, x) => a + x.diff, 0))}</td>
                  <td colSpan={2} style={td}></td>
                </tr></tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* สรุปต่อระบบ × สาขา */}
      {mode === "list" && summary.length > 0 && (
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>ระบบ</th><th style={th}>สาขา</th><th style={{ ...th, textAlign: "right" }}>จำนวนใบ</th>
              {PAY_COLS.map(([k, l]) => <th key={k} style={{ ...th, textAlign: "right" }}>{l}</th>)}<th style={{ ...th, textAlign: "right" }}>รวม</th>
            </tr></thead>
            <tbody>
              {summary.map(s => (
                <tr key={s.source + s.branch} onClick={() => { setFSource(s.source); setFBranch(s.branch); }} style={{ cursor: "pointer", background: fSource === s.source && fBranch === s.branch ? "#eff6ff" : "#fff" }} title="คลิกเพื่อกรอง">
                  <td style={td}>{srcTag(s.source)}</td><td style={{ ...td, fontSize: 12 }}>{branchLabel(s.branch)}</td><td style={{ ...td, textAlign: "right" }}>{s.count}</td>
                  {PAY_COLS.map(([k]) => <td key={k} style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{money(s[k])}</td>)}
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#072d6b" }}>{baht(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === "list" && <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", maxHeight: "60vh", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>#</th><th style={th}>วันที่รับเงิน</th><th style={th}>ระบบ</th><th style={th}>สาขา</th><th style={th}>เลขที่ใบเสร็จ</th><th style={th}>ประเภท</th><th style={th}>ลูกค้า</th><th style={th}>อ้างอิง (ใบขาย / JOB)</th>
            {PAY_COLS.map(([k, l]) => <th key={k} style={{ ...th, textAlign: "right" }}>{l}</th>)}<th style={{ ...th, textAlign: "right" }}>ยอดรวม</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={14} style={{ ...td, textAlign: "center", padding: 24, color: "#6b7280" }}>กำลังโหลด...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={14} style={{ ...td, textAlign: "center", padding: 24, color: "#9ca3af" }}>— ไม่มีรายการในช่วงวันที่/ตัวกรองนี้ (อัปโหลดไฟล์ในหน้า Upload ข้อมูลทางบัญชีก่อน) —</td></tr>}
            {filtered.map((r, i) => (
              <tr key={`${r.source}|${r.branch_code}|${r.receipt_no}`} style={{ background: i % 2 ? "#f9fafb" : "#fff", opacity: r.status && r.status !== "ปกติ" ? .55 : 1 }}>
                <td style={{ ...td, color: "#94a3b8" }}>{i + 1}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(r.receipt_date)}</td>
                <td style={td}>{srcTag(r.source)}</td>
                <td style={{ ...td, fontSize: 12 }}>{r.branch_code}</td>
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#072d6b", whiteSpace: "nowrap" }}>{r.receipt_no}{r.status && r.status !== "ปกติ" ? <div style={{ fontSize: 10, color: "#b91c1c" }}>{r.status}</div> : null}</td>
                <td style={{ ...td, fontSize: 12, color: "#475569" }}>{r.doc_type || "-"}</td>
                <td style={{ ...td, fontSize: 12 }}>{r.customer_name || "-"}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.ref_no || "-"}</td>
                {PAY_COLS.map(([k]) => <td key={k} style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{money(r[k])}</td>)}
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{baht(r.total_amount)}</td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot><tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
              <td colSpan={8} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} ใบ</td>
              {PAY_COLS.map(([k]) => <td key={k} style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{baht(tot(k))}</td>)}
              <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#072d6b", fontSize: 15 }}>{baht(tot("total_amount"))}</td>
            </tr></tfoot>
          )}
        </table>
      </div>}
    </div>
  );
}
