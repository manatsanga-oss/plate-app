import React, { useEffect, useMemo, useState } from "react";

// รายงานใบกำกับภาษี — โหมด "อะไหล่/บริการ" (user 2026-09-18)
// ใบกำกับจริงจากไฟล์ DMS "รายงานใบกำกับภาษีขาย" (dms_sales_tax_invoices ใบ SP/SV · upload ที่หน้า Upload ข้อมูลทางบัญชี)
// เทียบกับใบรับชำระ PSR ที่พนักงานบันทึกในระบบ (part_service_payments) จับคู่ด้วย "เอกสารอ้างอิง" ของใบกำกับ (JOB/SS) = เลขเอกสารของ PSR
// ไม่รวม SCY05/SCY06 (ป.เปา — ไม่เกี่ยวกับอะไหล่/บริการของสิงห์ชัย) · ใบกำกับก่อนวันเริ่มใช้ระบบรับชำระของสาขา = ไม่นับเป็นผิด
const DMS_API = "https://n8n-new-project-gwf2.onrender.com/webhook/dms-sales-tax-invoice-api";
const PSR_API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-service-payment-api";
// วันเริ่มรับชำระด้วยระบบ (ชุดเดียวกับหน้า รายงานรับชำระเงินค่าอะไหล่และบริการ)
// user 2026-09-18: "เริ่มใช้ระบบวันที่ 4" → ทุกสาขาเริ่มเทียบตั้งแต่ 04/09/69 · คง SCY07 งาน JOB ไว้ที่ 05/09 ตามที่สั่งตัด 3 ใบ (2–4 ก.ย.) ไว้ก่อนหน้า
const PSR_START_DEFAULT = "2026-09-04";
const PSR_START = { "SCY07|JOB": "2026-09-05" };

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const fmtN = (n) => num(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDate = (s) => { const m = String(s || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${String(Number(m[1]) + 543).slice(-2)}` : "-"; };
const normDoc = (v) => String(v || "").toUpperCase().replace(/\s+/g, "");
const kindOf = (ref) => (/-JOB/i.test(ref) ? "JOB" : /-SS/i.test(ref) ? "SALE" : "ALL");
const beforeStart = (branch, ref, date) => { const st = PSR_START[`${branch}|${kindOf(ref)}`] || PSR_START[`${branch}|ALL`] || PSR_START_DEFAULT; return !!(st && date && date < st); };
const STATUS = { ok: ["✅ ตรง", "#dcfce7", "#065f46"], diff: ["⚠️ ยอดต่าง", "#fef3c7", "#92400e"], missing: ["❌ ไม่พบในระบบ", "#fee2e2", "#991b1b"], prestart: ["– ก่อนเริ่มใช้ระบบ", "#f1f5f9", "#475569"], cancelled: ["ยกเลิก", "#fee2e2", "#991b1b"] };

export default function TaxInvoicePartsCompare({ yearMonth, currentUser }) {
  const [invoices, setInvoices] = useState([]);
  const [psr, setPsr] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fBranch, setFBranch] = useState("");
  const [search, setSearch] = useState("");
  const [showExtra, setShowExtra] = useState(false);

  const period = yearMonth ? `${parseInt(yearMonth.slice(0, 4), 10) - 543}${yearMonth.slice(4, 6)}` : ""; // พ.ศ. → ค.ศ. YYYYMM

  async function load() {
    if (!period) { setInvoices([]); setPsr([]); return; }
    setLoading(true); setMessage(""); setInvoices([]);
    const y = parseInt(period.slice(0, 4), 10), m = parseInt(period.slice(4, 6), 10);
    const from = new Date(y, m - 1, 1); from.setDate(from.getDate() - 35);
    const to = new Date(y, m, 0); to.setDate(to.getDate() + 7);
    const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.text()).then(t => (t.trim() ? JSON.parse(t) : null));
    try {
      const [d, p] = await Promise.all([post(DMS_API, { action: "list", tax_period: period }), post(PSR_API, { action: "list_payments", date_from: iso(from), date_to: iso(to) }).catch(() => [])]);
      const row = Array.isArray(d) ? d[0] : d;
      if (!row || row.error) throw new Error(row?.error || "ไม่มีการตอบกลับ (ยังไม่ได้ import workflow dms-sales-tax-invoice-api?)");
      const list = typeof row.listjson === "string" ? JSON.parse(row.listjson) : (row.listjson || []);
      setInvoices(list.filter(x => x && (x.doc_prefix === "SP" || x.doc_prefix === "SV") && x.branch_code !== "SCY05" && x.branch_code !== "SCY06"));
      setPsr((Array.isArray(p) ? p : []).filter(x => x && x.payment_id && String(x.status || "active") === "active"));
      if (!list.length) setMessage("ยังไม่มีใบกำกับของเดือนนี้ — upload ไฟล์ \"รายงานใบกำกับภาษีขาย\" ที่หน้า Upload ข้อมูลทางบัญชี ก่อน");
    } catch (e) { setMessage("❌ โหลดไม่สำเร็จ: " + (e?.message || "")); setInvoices([]); setPsr([]); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [period]); // eslint-disable-line

  // จับคู่: เอกสารอ้างอิงของใบกำกับ = เลขเอกสารของ PSR (รวมหลายใบ PSR ต่อเอกสารได้)
  const { rows, extraPsr } = useMemo(() => {
    const byDoc = new Map();
    psr.forEach(p => { const k = normDoc(p.doc_no); if (!k) return; (byDoc.get(k) || byDoc.set(k, []).get(k)).push(p); });
    const usedDocs = new Set();
    const out = invoices.map(x => {
      const date = String(x.tax_invoice_date || "").slice(0, 10), ref = x.ref_doc_no || "";
      const hits = byDoc.get(normDoc(ref)) || [];
      if (hits.length) usedDocs.add(normDoc(ref));
      const paid = hits.reduce((a, p) => a + num(p.paid_amount), 0);
      const total = num(x.total_amount);
      let st = "missing";
      if (x.status !== "ปกติ") st = "cancelled";
      else if (hits.length) st = Math.abs(total - paid) < 1 ? "ok" : "diff";
      else if (beforeStart(x.branch_code, ref, date)) st = "prestart";
      return { ...x, date, ref, hits, paid, diff: hits.length ? Math.round((total - paid) * 100) / 100 : 0, st };
    });
    // PSR ของเดือนนี้ (สาขาสิงห์ชัย) ที่ไม่มีใบกำกับในไฟล์
    const ym = period ? `${period.slice(0, 4)}-${period.slice(4, 6)}` : "";
    const extra = psr.filter(p => String(p.paid_date || "").slice(0, 7) === ym && /^SCY0?(1|4|7)|^SCY10/i.test(String(p.branch_code || "")) && String(p.doc_type || "") !== "อื่นๆ" && !usedDocs.has(normDoc(p.doc_no)));
    return { rows: out, extraPsr: extra };
  }, [invoices, psr, period]);

  const branches = useMemo(() => [...new Set(rows.map(r => r.branch_code).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => rows.filter(r => {
    if (fBranch && r.branch_code !== fBranch) return false;
    if (fStatus && r.st !== fStatus) return false;
    if (search.trim()) { const kw = search.trim().toLowerCase(); if (![r.tax_invoice_no, r.ref, r.customer_name, r.customer_tax_id, ...(r.hits || []).map(h => h.receipt_no)].filter(Boolean).join(" ").toLowerCase().includes(kw)) return false; }
    return true;
  }), [rows, fBranch, fStatus, search]);
  const counts = useMemo(() => { const c = { ok: 0, diff: 0, missing: 0, prestart: 0, cancelled: 0, diffAmt: 0 }; rows.forEach(r => { if (fBranch && r.branch_code !== fBranch) return; c[r.st] += 1; if (r.st === "diff") c.diffAmt += r.diff; }); return c; }, [rows, fBranch]);
  const act = filtered.filter(r => r.st !== "cancelled");
  const tot = (k) => act.reduce((a, r) => a + num(r[k]), 0);

  function printReport() {
    if (!filtered.length) return;
    const esc = (v) => String(v == null ? "" : v).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const trs = filtered.map((r, i) => `<tr class="${r.st === "cancelled" ? "off" : ""}"><td class="c">${i + 1}</td><td class="mono">${esc(r.tax_invoice_no)}</td><td class="c">${fmtDate(r.date)}</td><td class="c">${esc(r.branch_code)}</td><td>${esc(r.doc_kind || "")}</td><td class="mono">${esc(r.ref)}</td><td>${esc(r.customer_name || "")}</td><td class="r">${fmtN(r.amount_before_vat)}</td><td class="r">${fmtN(r.vat_amount)}</td><td class="r b">${fmtN(r.total_amount)}</td><td class="mono">${esc((r.hits || []).map(h => h.receipt_no).join(", ") || "-")}</td><td class="r">${r.hits.length ? fmtN(r.paid) : "-"}</td><td class="r">${r.st === "diff" ? fmtN(r.diff) : ""}</td><td>${esc(STATUS[r.st][0])}</td></tr>`).join("");
    const now = new Date();
    const w = window.open("", "_blank", "width=1300,height=850");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบกำกับภาษี อะไหล่/บริการ เทียบระบบ</title>
<style>@page{size:A4 landscape;margin:9mm}body{font-family:Tahoma,sans-serif;font-size:10px}h2{margin:0 0 2px;font-size:15px}.info{color:#555;margin-bottom:6px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:3px 5px;vertical-align:top}th{background:#072d6b;color:#fff}.r{text-align:right}.c{text-align:center}.b{font-weight:700}.mono{font-family:monospace;white-space:nowrap}tr.off td{color:#999;text-decoration:line-through}tfoot td{background:#fde68a;font-weight:700}</style></head><body>
<h2>รายงานใบกำกับภาษี อะไหล่/บริการ (DMS) — เทียบใบรับชำระในระบบ</h2>
<div class="info">เดือนที่ยื่น ${yearMonth.slice(4, 6)}/${yearMonth.slice(0, 4)}${fBranch ? " · " + esc(fBranch) : ""}${fStatus ? " · " + esc(STATUS[fStatus][0]) : ""} · ${filtered.length} ใบ · ตรง ${counts.ok} · ยอดต่าง ${counts.diff} · ไม่พบในระบบ ${counts.missing} · ก่อนเริ่มใช้ระบบ ${counts.prestart} · พิมพ์ ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear() + 543} โดย ${esc(currentUser?.name || currentUser?.username || "-")}</div>
<table><thead><tr><th>#</th><th>เลขที่ใบกำกับ</th><th>วันที่ใบกำกับ</th><th>สาขา</th><th>ประเภท</th><th>อ้างอิง</th><th>ลูกค้า</th><th>ก่อน VAT</th><th>VAT</th><th>รวม</th><th>ใบรับชำระ (ระบบ)</th><th>ยอดรับ</th><th>ต่าง</th><th>ผลเทียบ</th></tr></thead><tbody>${trs}</tbody>
<tfoot><tr><td colspan="7" class="r">รวม (ไม่รวมยกเลิก) ${act.length} ใบ</td><td class="r">${fmtN(tot("amount_before_vat"))}</td><td class="r">${fmtN(tot("vat_amount"))}</td><td class="r">${fmtN(tot("total_amount"))}</td><td></td><td class="r">${fmtN(tot("paid"))}</td><td colspan="2"></td></tr></tfoot></table>
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  const inp = { padding: "7px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "inherit", fontSize: 13, background: "#fff" };
  const card = { background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 2px 12px rgba(7,45,107,0.10)", marginBottom: 14 };
  const chip = (k, label, bg, fg) => (
    <button key={k} onClick={() => setFStatus(fStatus === k ? "" : k)} style={{ padding: "3px 10px", borderRadius: 12, border: fStatus === k ? `2px solid ${fg}` : "2px solid transparent", background: bg, color: fg, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
  );

  if (!yearMonth) return <div style={card}>เลือกเดือน-ปี ก่อน (โหมดอะไหล่/บริการ ดูทีละเดือน)</div>;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        {[["ยอดก่อน VAT", tot("amount_before_vat"), "#dbeafe", "#1e40af"], ["ยอดภาษี", tot("vat_amount"), "#fef3c7", "#92400e"], ["ยอดรวม", tot("total_amount"), "#dcfce7", "#065f46"]].map(([l, v, bg, fg]) => (
          <div key={l} style={{ background: bg, borderRadius: 12, padding: "14px 10px", textAlign: "center" }}><div style={{ fontSize: 12, color: fg, fontWeight: 700 }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: fg }}>{fmtN(v)}</div>{l === "ยอดก่อน VAT" && <div style={{ fontSize: 11, color: fg }}>{act.length} ใบ (ไม่รวมยกเลิก)</div>}</div>
        ))}
      </div>
      <div style={{ ...card, padding: "10px 14px", fontSize: 13 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <b style={{ color: "#072d6b" }}>⚖️ เทียบกับใบรับชำระในระบบ (PSR · จับคู่เอกสารอ้างอิง JOB/SS)</b>
          {chip("ok", `✅ ตรง ${counts.ok}`, "#dcfce7", "#065f46")}
          {chip("diff", `⚠️ ยอดต่าง ${counts.diff}${counts.diff ? ` (${fmtN(counts.diffAmt)})` : ""}`, "#fef3c7", "#92400e")}
          {chip("missing", `❌ ไม่พบในระบบ ${counts.missing}`, "#fee2e2", "#991b1b")}
          {chip("prestart", `– ก่อนเริ่มใช้ระบบ ${counts.prestart}`, "#f1f5f9", "#475569")}
          {counts.cancelled > 0 && chip("cancelled", `ยกเลิก ${counts.cancelled}`, "#fee2e2", "#991b1b")}
          <button onClick={() => setShowExtra(v => !v)} style={{ padding: "3px 10px", borderRadius: 12, border: "2px solid transparent", background: extraPsr.length ? "#ede9fe" : "#f1f5f9", color: extraPsr.length ? "#6d28d9" : "#475569", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            🧾 รับชำระในระบบเดือนนี้ที่ยังไม่มีใบกำกับ {extraPsr.length} ใบ ({fmtN(extraPsr.reduce((a, p) => a + num(p.paid_amount), 0))}) {showExtra ? "▲" : "▼"}
          </button>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={fBranch} onChange={e => setFBranch(e.target.value)} style={inp}><option value="">สาขา: ทั้งหมด</option>{branches.map(b => <option key={b} value={b}>{b}</option>)}</select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา เลขใบกำกับ / JOB / SS / ลูกค้า / PSR" style={{ ...inp, width: 300 }} />
          <button onClick={load} disabled={loading} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#072d6b", color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>🔄 {loading ? "กำลังโหลด..." : "รีเฟรช"}</button>
          <button onClick={printReport} disabled={!filtered.length} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: filtered.length ? "#6b7280" : "#d1d5db", color: "#fff", cursor: filtered.length ? "pointer" : "not-allowed", fontWeight: 600, fontFamily: "inherit" }}>🖨️ พิมพ์</button>
          <span style={{ fontSize: 11.5, color: "#6b7280" }}>เริ่มเทียบตั้งแต่ใบกำกับวันที่ 04/09/69 ทุกสาขา (SCY07 งาน JOB เริ่ม 05/09/69) — ใบก่อนหน้านี้ไม่นับเป็นผิด</span>
        </div>
        {message && <div style={{ marginTop: 8, padding: "6px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12 }}>{message}</div>}
        {showExtra && (
          <div style={{ marginTop: 8, maxHeight: 260, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <table className="data-table" style={{ fontSize: 12, width: "100%", whiteSpace: "nowrap" }}>
              <thead><tr><th>#</th><th>วันที่รับ</th><th>ใบรับชำระ</th><th>สาขา</th><th>เอกสาร</th><th>ประเภท</th><th>ลูกค้า</th><th style={{ textAlign: "right" }}>ยอดรับ</th></tr></thead>
              <tbody>
                {extraPsr.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 14, color: "#15803d" }}>✓ ใบรับชำระในระบบของเดือนนี้มีใบกำกับครบ</td></tr>}
                {extraPsr.map((p, i) => <tr key={p.payment_id}><td>{i + 1}</td><td>{fmtDate(p.paid_date)}</td><td style={{ fontFamily: "monospace", color: "#1d4ed8" }}>{p.receipt_no}</td><td>{p.branch_code}</td><td style={{ fontFamily: "monospace" }}>{p.doc_no}</td><td>{p.doc_type}</td><td>{p.customer_name}</td><td style={{ textAlign: "right", fontWeight: 700 }}>{fmtN(p.paid_amount)}</td></tr>)}
              </tbody>
            </table>
            <div style={{ padding: "6px 10px", fontSize: 11, color: "#6b7280" }}>เป็นได้ทั้ง ใบกำกับออกเดือนถัดไป · ไฟล์ใบกำกับ upload ยังไม่ถึงวันนั้น · หรือพิมพ์เลขเอกสารในใบรับชำระผิด</div>
          </div>
        )}
      </div>
      <div style={card}>
        <div style={{ marginBottom: 8, fontSize: 13, color: "#374151", textAlign: "center" }}>พบ <strong>{filtered.length}</strong> / {rows.length} รายการ</div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ fontSize: 12, width: "100%", whiteSpace: "nowrap" }}>
            <thead><tr><th style={{ width: 40 }}>#</th><th>เลขที่ใบกำกับ</th><th>วันที่ใบกำกับ</th><th>สาขา</th><th>ประเภท</th><th>อ้างอิง (JOB / SS)</th><th style={{ minWidth: 170 }}>ลูกค้า</th><th style={{ textAlign: "right" }}>ก่อน VAT</th><th style={{ textAlign: "right" }}>VAT</th><th style={{ textAlign: "right" }}>รวม</th><th>ใบรับชำระ (ระบบ)</th><th style={{ textAlign: "right" }}>ยอดรับ</th><th>ผลเทียบ</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={13} style={{ textAlign: "center", padding: 30, color: "#6b7280" }}>กำลังโหลด...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={13} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
              {filtered.map((r, i) => {
                const [label, bg, fg] = STATUS[r.st]; const off = r.st === "cancelled";
                return (
                  <tr key={r.tax_invoice_no} style={{ opacity: off ? .55 : 1, textDecoration: off ? "line-through" : "none" }}>
                    <td style={{ color: "#94a3b8" }}>{i + 1}</td>
                    <td style={{ fontFamily: "monospace", fontWeight: 700, color: "#072d6b" }}>{r.tax_invoice_no}</td>
                    <td>{fmtDate(r.date)}</td><td>{r.branch_code}</td><td style={{ fontSize: 11 }}>{r.doc_kind}</td>
                    <td style={{ fontFamily: "monospace", color: "#0369a1" }}>{r.ref || "-"}{r.ref_doc_date && String(r.ref_doc_date).slice(0, 7) !== String(r.date).slice(0, 7) ? <div style={{ fontSize: 10, color: "#b45309" }}>เอกสาร {fmtDate(r.ref_doc_date)}</div> : null}</td>
                    <td style={{ whiteSpace: "normal", fontSize: 11.5 }}>{r.customer_name || "-"}</td>
                    <td style={{ textAlign: "right" }}>{fmtN(r.amount_before_vat)}</td><td style={{ textAlign: "right" }}>{fmtN(r.vat_amount)}</td><td style={{ textAlign: "right", fontWeight: 700 }}>{fmtN(r.total_amount)}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "#1d4ed8" }}>{r.hits.length ? r.hits.map(h => <div key={h.payment_id}>{h.receipt_no} <span style={{ color: "#64748b" }}>{fmtDate(h.paid_date)}</span></div>) : <span style={{ color: "#cbd5e1" }}>-</span>}</td>
                    <td style={{ textAlign: "right" }}>{r.hits.length ? fmtN(r.paid) : <span style={{ color: "#cbd5e1" }}>-</span>}{r.st === "diff" && <div style={{ fontSize: 10, fontWeight: 700, color: "#b91c1c" }}>ต่าง {r.diff > 0 ? "+" : ""}{fmtN(r.diff)}</div>}</td>
                    <td><span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: bg, color: fg, textDecoration: "none", display: "inline-block" }}>{label}</span></td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot><tr style={{ background: "#f1f5f9", fontWeight: 700 }}><td colSpan={7} style={{ textAlign: "right" }}>รวม (ไม่รวมยกเลิก) {act.length} ใบ</td><td style={{ textAlign: "right" }}>{fmtN(tot("amount_before_vat"))}</td><td style={{ textAlign: "right" }}>{fmtN(tot("vat_amount"))}</td><td style={{ textAlign: "right", color: "#072d6b" }}>{fmtN(tot("total_amount"))}</td><td></td><td style={{ textAlign: "right", color: "#0369a1" }}>{fmtN(tot("paid"))}</td><td></td></tr></tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
}
