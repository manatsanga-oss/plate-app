import React, { useEffect, useMemo, useState } from "react";
import { loadDailyCashSources, buildDailyCashItems, num, fmt, makeAcctResolver } from "../lib/dailyCash";

// สรุปรับชำระเงินทั่วไป (รายเดือน) — Report Admin (user 2026-10-03)
// แทน pivot ใน Excel "สรุปรับชำระเงินทั่วไป.3.xlsx" แผ่น PRIVOT-สรุปรับชำระเงินทั่วไป ของบัญชี โดยใช้ข้อมูลจากระบบชุดเดียวกับหน้า "สรุปรายวันรับเงิน" (dailyCash.js)
// โครง: กลุ่มรับชำระ → ประเภท → สาขา → วิธีรับเงิน (เงินสด / เงินโอน <บัญชี> / เงินมัดจำ / เช็ค / หัก ณ ที่จ่าย / E-คูปอง / รถเทิร์น)
// ส่วนที่ต่างจาก Excel แสดงไว้ในกล่องท้ายหน้า (Excel แถว "ขายรถจักรยานยนต์" = มูลค่าขาย, "เงินมัดจำรถ SCY10" = ไฟแนนซ์โอน — ไม่ใช่เงินรับหน้าร้าน)
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const pad = (n) => String(n).padStart(2, "0");
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthRange = (ym) => { const [y, m] = ym.split("-").map(Number); const last = new Date(y, m, 0).getDate(); return [`${ym}-01`, `${ym}-${pad(last)}`]; };
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return `${TH_MONTHS[m - 1]} ${y + 543}`; };

const GROUP_ORDER = ["ขายรถจักรยานยนต์ (รับชำระหน้าร้าน)", "เงินมัดจำ", "รับเรื่องทะเบียน-ประกัน-พรบ", "รับชำระอื่นๆ", "อะไหล่และบริการ", "จ่ายออก/คืนเงิน (ไม่มีใน Excel)"];
/** จัดกลุ่ม/ประเภทให้ตรงโครง Excel */
function classify(it) {
  const k = it.kind, cat = String(it.category || "");
  if (num(it.received) < 0 || /จ่ายออก/.test(cat)) return ["จ่ายออก/คืนเงิน (ไม่มีใน Excel)", cat.replace(/\s*\(จ่ายออก\)\s*/, "")];
  if (k === "sale" || k === "deposit_applied") return ["ขายรถจักรยานยนต์ (รับชำระหน้าร้าน)", it.finance ? String(it.finance) : "ขายเงินสด"]; // ชื่อประเภทแบบ Excel: ชื่อบริษัทไฟแนนซ์ / ขายเงินสด
  if (k === "used_moto") return ["ขายรถจักรยานยนต์ (รับชำระหน้าร้าน)", "รถมือสอง"];
  if (k === "deposit") return ["เงินมัดจำ", "เงินมัดจำรถ"];
  if (k === "red_plate") return ["เงินมัดจำ", "เงินมัดจำป้ายแดง (Excel = เงินมัดจำทั่วไป)"];
  if (k === "part_deposit") return ["เงินมัดจำ", "เงินมัดจำอะไหล่"];
  if (k === "receipt") { const m = cat.match(/\((.+)\)/); return ["รับเรื่องทะเบียน-ประกัน-พรบ", m ? m[1] : "งานทะเบียน"]; }
  if (k === "deposit_income") {
    const desc = String(it.income_desc || "");
    if (cat.includes("ค่างวด")) return ["รับชำระอื่นๆ", desc.includes("กรุ๊ปล") ? "ชำระค่างวด กรุ๊ปลีส" : desc.includes("ธนบรรณ") ? "ชำระค่างวด ธนบรรณ" : "ชำระค่างวดรับฝาก (อื่น)"];
    return ["รับชำระอื่นๆ", desc.split(" - ")[0].trim() || "รายได้อื่นๆ"]; // หมวดรายได้ เช่น รายได้ค่าฝากส่งไปรษณีย์ / รายได้อื่นๆ
  }
  if (k === "wht_refund") return ["รับชำระอื่นๆ", "รับคืนหัก ณ ที่จ่าย"];
  if (k === "part_service") return ["อะไหล่และบริการ", /ซ่อม|JOB|บริการ/i.test(String(it.note || "")) ? "งานบริการ" : "ขายปลีก"];
  return ["รับชำระอื่นๆ", cat || "อื่นๆ"];
}
/** แตกวิธีรับเงินของรายการเป็น [label, amount] — เงินโอนแยกตามบัญชี */
function methodRows(it, acctNo) {
  const s = it.split || {}; const out = [];
  if (num(s.cash)) out.push(["เงินสด", num(s.cash)]);
  const tb = s.transfer_by;
  if (tb && Object.keys(tb).length) {
    let sum = 0;
    for (const [lbl, v] of Object.entries(tb)) { out.push([`เงินโอน ${acctNo(lbl)}`, num(v)]); sum += num(v); }
    const rest = Math.round((num(s.transfer) - sum) * 100) / 100;
    if (Math.abs(rest) > 0.004) out.push(["เงินโอน (ไม่ระบุบัญชี)", rest]);
  } else if (num(s.transfer)) out.push(["เงินโอน (ไม่ระบุบัญชี)", num(s.transfer)]);
  if (num(s.card)) out.push(["บัตร/QR", num(s.card)]);
  if (num(s.deposit)) out.push(["เงินมัดจำ (ตัดมัดจำ)", num(s.deposit)]);
  if (num(s.cheque)) out.push(["เช็ค", num(s.cheque)]);
  if (num(s.wht)) out.push(["หัก ณ ที่จ่าย", num(s.wht)]);
  if (num(s.coupon)) out.push(["E-คูปอง", num(s.coupon)]);
  if (num(s.tradein)) out.push(["รถเทิร์น", num(s.tradein)]);
  if (num(s.finance)) out.push(["ไฟแนนซ์", num(s.finance)]);
  if (num(s.other)) out.push(["อื่นๆ", num(s.other)]);
  const sum = out.reduce((a, [, v]) => a + v, 0);
  const diff = Math.round((num(it.received) - sum) * 100) / 100;
  if (Math.abs(diff) > 0.004) out.push(["ไม่ระบุวิธี", diff]);
  return out;
}

const cell = { padding: "5px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 13 };
const numCell = { ...cell, textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" };

export default function GeneralReceiptPivotPage() {
  const [ym, setYm] = useState(thisMonth());
  const [branch, setBranch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [open, setOpen] = useState({}); // key → bool (collapsed when false); default เปิดถึงระดับสาขา
  const [showDetail, setShowDetail] = useState(false);
  const [viewMode, setViewMode] = useState("detail"); // detail = กลุ่ม→ประเภท→สาขา→วิธีรับ · method = กลุ่ม→วิธีรับชำระ (user 2026-10-04: สรุปเป็นวิธีการรับชำระ)
  const [drill, setDrill] = useState(null); // { title, rows } — กดแถววิธีรับเงินเพื่อดูรายการ (user 2026-10-03)

  useEffect(() => {
    fetch(ACC_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "true" }) })
      .then((r) => r.json()).then((d) => setAccounts(Array.isArray(d) ? d.filter((a) => a && a.account_id) : [])).catch(() => {});
  }, []);
  // แปลงฉลากบัญชีของยอดเงินโอน → "เลขที่บัญชี" (ตัวแปลงร่วมใน dailyCash.js ใช้กับหน้าสรุปรายวันรับเงินด้วย)
  const acctNo = useMemo(() => makeAcctResolver(accounts), [accounts]);

  async function load() {
    setLoading(true); setMessage("");
    try {
      const [from, to] = monthRange(ym);
      const src = await loadDailyCashSources(from, to);
      const all = buildDailyCashItems(src, { dateFrom: from, dateTo: to, branch: "", isAdmin: true, myBranch: "" });
      setItems(all);
      if (!all.length) setMessage("ไม่มีข้อมูลในเดือนนี้");
    } catch (e) { setItems([]); setMessage("❌ โหลดข้อมูลไม่สำเร็จ: " + String(e?.message || e).slice(0, 120)); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const branches = useMemo(() => [...new Set(items.map((it) => it.branch_key).filter(Boolean))].sort(), [items]);

  // tree: group → type → branch → method → {amount, count}
  const tree = useMemo(() => {
    const t = {};
    for (const it of items) {
      if (branch && it.branch_key !== branch) continue;
      const [g, ty] = classify(it);
      const b = it.branch_key || "ไม่ระบุสาขา";
      const total = num(it.received);
      // รายการเดียวแตกได้หลายประเภท [ประเภท, ยอด] รวมกันเท่ายอดรับ:
      //   · ใบรับฝากค่างวด = ค่างวด + ค่าบริการ · ใบรับเรื่อง = งานทะเบียน (ต่อภาษี/ทะเบียนรถใหม่) + งานพรบ. + งานประกัน ตามยอดรายบรรทัด (user 2026-10-04)
      let parts = [[ty, total]];
      if (it.kind === "deposit_income" && total > 0) {
        const fee = Math.min(Math.max(num(it.service_fee), 0), total);
        if (fee > 0) parts = [[ty, total - fee], ["ค่าบริการ (รับฝากค่างวด)", fee]];
      } else if (it.kind === "receipt" && total > 0 && it.prb_total != null) {
        const base = num(it.line_total) > 0 ? num(it.line_total) : total;
        const k = total / base; // เผื่อยอดรับชำระต่างจากยอดรายบรรทัด
        const prb = Math.min(Math.round(num(it.prb_total) * k * 100) / 100, total);
        const ins = Math.min(Math.round(num(it.ins_total) * k * 100) / 100, total - prb);
        const reg = Math.round((total - prb - ins) * 100) / 100;
        parts = [["งานทะเบียน (ต่อภาษี/ทะเบียนรถใหม่)", reg], ["งานพรบ.", prb], ["งานประกัน", ins]].filter(([, v]) => Math.abs(v) > 0.004);
        if (!parts.length) parts = [[ty, total]];
      }
      const methods = methodRows(it, acctNo);
      const used = methods.map(() => 0); // ยอดของแต่ละวิธีที่จัดสรรไปแล้ว (ส่วนสุดท้ายรับเศษปัด)
      const G = (t[g] = t[g] || { amount: 0, count: 0, children: {} });
      G.count++;
      parts.forEach(([pty, pamt], pi) => {
        const T = (G.children[pty] = G.children[pty] || { amount: 0, count: 0, children: {} });
        const B = (T.children[b] = T.children[b] || { amount: 0, count: 0, children: {} });
        T.count++; B.count++;
        const ratio = total !== 0 ? pamt / total : 1;
        methods.forEach(([m, v0], mi) => {
          const v = pi === parts.length - 1 ? Math.round((v0 - used[mi]) * 100) / 100 : Math.round(v0 * ratio * 100) / 100;
          used[mi] += v;
          if (Math.abs(v) < 0.005) return;
          G.amount += v; T.amount += v; B.amount += v;
          const M = (B.children[m] = B.children[m] || { amount: 0, count: 0, rows: [] }); M.amount += v; M.count++;
          M.rows.push({ date: String(it.date || "").slice(0, 10), doc_no: it.doc_no || "-", ref_no: it.ref_no || "", customer: it.customer_name || "-", seller: it.seller || "", note: it.note || "", amount: v, kind: it.kind });
        });
      });
    }
    return t;
  }, [items, branch, acctNo]);
  const grand = useMemo(() => Object.values(tree).reduce((s, g) => s + g.amount, 0), [tree]);
  const grandIn = useMemo(() => Object.entries(tree).filter(([g]) => !g.startsWith("จ่ายออก")).reduce((s, [, g]) => s + g.amount, 0), [tree]);

  // สรุปตามวิธีรับชำระ (แบบแผ่น "PRIVOT-สรุปตามการรับชำระ" ของ Excel — user 2026-10-04): วิธีรับเงิน → กลุ่มรับชำระ → ประเภท (รวมทุกสาขา)
  //   กลุ่มจ่ายออก/คืนเงิน (ไม่มีใน Excel) แยกเป็นบล็อกท้ายตาราง ไม่ปนกับยอดรับของแต่ละวิธี
  const OUT_KEY = "จ่ายออก/คืนเงิน (ไม่มีใน Excel)";
  const methodTree = useMemo(() => {
    const mt = {};
    for (const [g, G] of Object.entries(tree)) for (const [ty, T] of Object.entries(G.children)) for (const B of Object.values(T.children)) for (const [m, M] of Object.entries(B.children)) {
      const isOut = g.startsWith("จ่ายออก");
      const top = isOut ? OUT_KEY : m;           // ระดับ 0: วิธีรับเงิน (หรือบล็อกจ่ายออก)
      const mid = isOut ? m : g;                  // ระดับ 1: กลุ่มรับชำระ (จ่ายออก: วิธีจ่าย)
      const X = (mt[top] = mt[top] || { amount: 0, count: 0, children: {} });
      const Y = (X.children[mid] = X.children[mid] || { amount: 0, count: 0, children: {} });
      const Z = (Y.children[ty] = Y.children[ty] || { amount: 0, count: 0, rows: [] });
      X.amount += M.amount; Y.amount += M.amount; Z.amount += M.amount;
      X.count += M.count; Y.count += M.count; Z.count += M.count; Z.rows.push(...M.rows);
    }
    return mt;
  }, [tree]);
  const methodKeys = useMemo(() => Object.keys(methodTree).sort((x, y) => (x === OUT_KEY) - (y === OUT_KEY) || x.localeCompare(y, "th")), [methodTree]);
  const groupRank = (g) => { const i = GROUP_ORDER.indexOf(g); return i < 0 ? 99 : i; };
  const isOpen = (key, depth) => (open[key] === undefined ? depth < 2 : open[key]);
  const toggle = (key) => setOpen((o) => ({ ...o, [key]: !isOpen(key, 9) }));
  const sortedGroups = Object.keys(tree).sort((a, b) => (GROUP_ORDER.indexOf(a) + 100) % 100 - (GROUP_ORDER.indexOf(b) + 100) % 100 || a.localeCompare(b, "th"));

  function rowsFlat() {
    const out = [];
    if (viewMode === "method") {
      for (const m of methodKeys) {
        const X = methodTree[m]; const kX = "M|" + m; out.push({ depth: 0, key: kX, label: m, amount: X.amount, count: X.count });
        if (!isOpen(kX, 0)) continue;
        for (const g of Object.keys(X.children).sort((x, y) => groupRank(x) - groupRank(y) || x.localeCompare(y, "th"))) {
          const Y = X.children[g]; const kY = kX + "|" + g; out.push({ depth: 1, key: kY, label: g, amount: Y.amount, count: Y.count });
          if (!isOpen(kY, 1)) continue;
          for (const ty of Object.keys(Y.children).sort((x, y) => x.localeCompare(y, "th"))) { const Z = Y.children[ty]; out.push({ depth: 2, key: kY + "|" + ty, label: ty, amount: Z.amount, count: Z.count, leaf: true, rows: Z.rows, path: `${m} › ${g}` }); }
        }
      }
      return out;
    }
    for (const g of sortedGroups) {
      const G = tree[g]; out.push({ depth: 0, key: g, label: g, ...G });
      if (!isOpen(g, 0)) continue;
      for (const ty of Object.keys(G.children).sort((a, b) => a.localeCompare(b, "th"))) {
        const T = G.children[ty]; const kT = g + "|" + ty; out.push({ depth: 1, key: kT, label: ty, ...T });
        if (!isOpen(kT, 1)) continue;
        for (const b of Object.keys(T.children).sort()) {
          const B = T.children[b]; const kB = kT + "|" + b; out.push({ depth: 2, key: kB, label: b, ...B });
          if (!isOpen(kB, 2)) continue;
          for (const m of Object.keys(B.children).sort((a, b2) => a.localeCompare(b2, "th"))) { const M = B.children[m]; out.push({ depth: 3, key: kB + "|" + m, label: m, amount: M.amount, count: M.count, leaf: true, rows: M.rows, path: `${g} › ${ty} › ${b}` }); }
        }
      }
    }
    return out;
  }
  const flat = rowsFlat();

  function exportCsv() {
    if (viewMode === "method") {
      const ls = [["วิธีรับเงิน", "กลุ่มรับชำระ", "ประเภท", "จำนวนรายการ", "ยอดเงิน"]];
      for (const m of methodKeys) for (const [g, Y] of Object.entries(methodTree[m].children)) for (const [ty, Z] of Object.entries(Y.children)) ls.push([m, g, ty, Z.count, Z.amount.toFixed(2)]);
      const csv2 = "\uFEFF" + ls.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      const a2 = document.createElement("a"); a2.href = URL.createObjectURL(new Blob([csv2], { type: "text/csv;charset=utf-8" })); a2.download = `สรุปตามการรับชำระ_${ym}${branch ? "_" + branch : ""}.csv`; a2.click();
      return;
    }
    const lines = [["กลุ่มรับชำระ", "ประเภท", "สาขา", "วิธีรับเงิน", "จำนวนรายการ", "ยอดเงิน"]];
    for (const g of sortedGroups) for (const [ty, T] of Object.entries(tree[g].children)) for (const [b, B] of Object.entries(T.children)) for (const [m, M] of Object.entries(B.children)) lines.push([g, ty, b, m, M.count, M.amount.toFixed(2)]);
    const csv = "﻿" + lines.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `สรุปรับชำระเงินทั่วไป_${ym}${branch ? "_" + branch : ""}.csv`; a.click();
  }
  function printReport() {
    const w = window.open("", "_blank"); if (!w) return;
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const rows = [];
    if (viewMode === "method") {
      for (const m of methodKeys) {
        const X = methodTree[m];
        rows.push(`<tr class="g"><td colspan="3">${esc(m)}</td><td class="r">${fmt(X.amount)}</td></tr>`);
        for (const g of Object.keys(X.children).sort((x, y) => groupRank(x) - groupRank(y) || x.localeCompare(y, "th"))) {
          const Y = X.children[g];
          rows.push(`<tr class="t"><td></td><td colspan="2">${esc(g)}</td><td class="r">${fmt(Y.amount)}</td></tr>`);
          for (const [ty, Z] of Object.entries(Y.children).sort()) rows.push(`<tr class="m"><td></td><td></td><td class="in">${esc(ty)}</td><td class="r">${fmt(Z.amount)}</td></tr>`);
        }
      }
    } else
    for (const g of sortedGroups) {
      const G = tree[g]; rows.push(`<tr class="g"><td>${esc(g)}</td><td></td><td></td><td class="r">${fmt(G.amount)}</td></tr>`);
      for (const [ty, T] of Object.entries(G.children).sort()) {
        rows.push(`<tr class="t"><td></td><td>${esc(ty)}</td><td></td><td class="r">${fmt(T.amount)}</td></tr>`);
        for (const [b, B] of Object.entries(T.children).sort()) {
          rows.push(`<tr class="b"><td></td><td></td><td>${esc(b)}</td><td class="r">${fmt(B.amount)}</td></tr>`);
          for (const [m, M] of Object.entries(B.children).sort()) rows.push(`<tr class="m"><td></td><td></td><td class="in">${esc(m)}</td><td class="r">${fmt(M.amount)}</td></tr>`);
        }
      }
    }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>สรุปรับชำระเงินทั่วไป ${esc(thMonth(ym))}</title>
<style>@page{size:A4;margin:12mm} body{font-family:'TH Sarabun New',Tahoma,sans-serif;font-size:13pt;color:#111} h2{margin:0 0 2px} .sub{color:#555;font-size:11pt;margin-bottom:8px}
table{border-collapse:collapse;width:100%} td{padding:2px 6px;border-bottom:1px solid #eee} .r{text-align:right;font-family:monospace} tr.g td{font-weight:800;background:#e2e8f0;border-top:2px solid #94a3b8} tr.t td{font-weight:700} tr.b td{font-weight:600;color:#1e3a8a} tr.m td{color:#444;font-size:12pt} td.in{padding-left:28px}
tr.total td{font-weight:800;border-top:2px solid #111;font-size:14pt} .tb{position:fixed;top:6px;right:8px} @media print{.tb{display:none}}</style></head><body>
<div class="tb"><button onclick="window.print()">🖨️ พิมพ์</button></div>
<h2>สรุปรับชำระเงินทั่วไป — ${esc(thMonth(ym))}${branch ? " · " + esc(branch) : " · ทุกสาขา"}</h2>
<div class="sub">ข้อมูลจากระบบ (ชุดเดียวกับสรุปรายวันรับเงิน) · กลุ่ม → ประเภท → สาขา → วิธีรับเงิน · พิมพ์ ${new Date().toLocaleString("th-TH")}</div>
<table><thead><tr><td><b>กลุ่มรับชำระ</b></td><td><b>ประเภท</b></td><td><b>สาขา / วิธีรับเงิน</b></td><td class="r"><b>ยอดเงิน</b></td></tr></thead><tbody>${rows.join("")}
<tr class="total"><td colspan="3">รวมรับเข้า (ไม่รวมจ่ายออก)</td><td class="r">${fmt(grandIn)}</td></tr>
<tr class="total"><td colspan="3">รวมสุทธิ (หักจ่ายออก/คืนเงิน)</td><td class="r">${fmt(grand)}</td></tr></tbody></table></body></html>`);
    w.document.close();
  }

  const inp = { padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 };
  const btn = (bg) => ({ padding: "7px 14px", background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 });
  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>📊 สรุปรับชำระเงินทั่วไป (รายเดือน)</h2>
      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 12 }}>
        โครงเดียวกับ pivot ของบัญชี: กลุ่มรับชำระ → ประเภท → สาขา → วิธีรับเงิน (เงินโอนแยกตามบัญชี) · ใช้ข้อมูลชุดเดียวกับหน้า "สรุปรายวันรับเงิน" ตามวันที่รับเงินจริง · คลิกแถวเพื่อย่อ/ขยาย
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <div><div style={{ fontSize: 12, color: "#4b5563", fontWeight: 600 }}>เดือน</div><input type="month" value={ym} onChange={(e) => setYm(e.target.value)} style={inp} /></div>
        <div><div style={{ fontSize: 12, color: "#4b5563", fontWeight: 600 }}>สาขา</div>
          <select value={branch} onChange={(e) => setBranch(e.target.value)} style={inp}><option value="">ทุกสาขา</option>{branches.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
        <button onClick={load} disabled={loading} style={btn("#0369a1")}>{loading ? "กำลังโหลด…" : "🔄 แสดง"}</button>
        <div><div style={{ fontSize: 12, color: "#4b5563", fontWeight: 600 }}>มุมมอง</div>
          <select value={viewMode} onChange={(e) => { setViewMode(e.target.value); setOpen({}); }} style={inp}>
            <option value="detail">ละเอียด (ประเภท → สาขา → วิธีรับเงิน)</option>
            <option value="method">สรุปตามการรับชำระ (วิธีรับเงิน → กลุ่ม → ประเภท)</option>
          </select></div>
        <button onClick={() => setOpen({})} style={btn("#6b7280")}>ย่อ/ขยายค่าเริ่มต้น</button>
        <button onClick={() => { const o = {}; for (const r of flat) o[r.key] = true; for (const g of sortedGroups) { o[g] = true; for (const [ty, T] of Object.entries(tree[g].children)) { o[g + "|" + ty] = true; for (const b of Object.keys(T.children)) o[g + "|" + ty + "|" + b] = true; } } setOpen(o); }} style={btn("#6b7280")}>ขยายทั้งหมด</button>
        <button onClick={exportCsv} disabled={!flat.length} style={btn("#16a34a")}>⬇️ CSV</button>
        <button onClick={printReport} disabled={!flat.length} style={btn("#4b5563")}>🖨️ พิมพ์</button>
        <label style={{ fontSize: 12.5, color: "#374151", marginLeft: "auto" }}><input type="checkbox" checked={showDetail} onChange={(e) => setShowDetail(e.target.checked)} /> แสดงจำนวนรายการ</label>
      </div>
      {message && <div style={{ padding: 10, marginBottom: 10, borderRadius: 8, background: message.startsWith("❌") ? "#fee2e2" : "#fef9c3", fontSize: 13 }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 12 }}>
        {sortedGroups.filter((g) => !g.startsWith("จ่ายออก")).map((g) => (
          <div key={g} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{g}</div><div style={{ fontSize: 18, fontWeight: 800, color: "#072d6b" }}>{fmt(tree[g].amount)}</div>
          </div>))}
        <div style={{ background: "#ecfdf5", border: "2px solid #16a34a", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 12, color: "#166534" }}>รวมรับเข้า {thMonth(ym)}</div><div style={{ fontSize: 18, fontWeight: 800, color: "#166534" }}>{fmt(grandIn)}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>สุทธิหลังจ่ายออก/คืนเงิน {fmt(grand)}</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}><tr>
            <th style={{ ...cell, textAlign: "left" }}>{viewMode === "method" ? "วิธีรับเงิน / กลุ่มรับชำระ / ประเภท" : "กลุ่มรับชำระ / ประเภท / สาขา / วิธีรับเงิน"}</th>
            {showDetail && <th style={{ ...numCell }}>รายการ</th>}
            <th style={{ ...numCell }}>ยอดเงิน</th>
          </tr></thead>
          <tbody>
            {flat.map((r) => {
              const bg = r.depth === 0 ? "#e2e8f0" : r.depth === 1 ? "#f8fafc" : "#fff";
              const color = r.depth === 0 ? "#0f172a" : r.depth === 1 ? "#1e3a8a" : r.depth === 2 ? "#334155" : "#64748b";
              const weight = r.depth === 0 ? 800 : r.depth === 1 ? 700 : r.depth === 2 ? 600 : 400;
              return (
                <tr key={r.key} onClick={() => r.leaf ? setDrill({ title: `${r.path} › ${r.label}`, rows: [...r.rows].sort((a, b2) => a.date.localeCompare(b2.date) || String(a.doc_no).localeCompare(String(b2.doc_no))) }) : toggle(r.key)} style={{ background: bg, cursor: "pointer" }} title={r.leaf ? "คลิกดูรายการ" : undefined}>
                  <td style={{ ...cell, paddingLeft: 10 + r.depth * 24, color, fontWeight: weight }}>
                    {!r.leaf && <span style={{ display: "inline-block", width: 14, color: "#94a3b8" }}>{isOpen(r.key, r.depth) ? "▾" : "▸"}</span>}{r.label}{r.leaf && <span style={{ marginLeft: 6, fontSize: 11, color: "#94a3b8" }}>🔍 {r.count} รายการ</span>}
                  </td>
                  {showDetail && <td style={{ ...numCell, color: "#94a3b8" }}>{r.count}</td>}
                  <td style={{ ...numCell, color: r.amount < 0 ? "#b91c1c" : color, fontWeight: weight }}>{fmt(r.amount)}</td>
                </tr>);
            })}
            {!flat.length && <tr><td colSpan={showDetail ? 3 : 2} style={{ ...cell, textAlign: "center", color: "#9ca3af", padding: 20 }}>{loading ? "กำลังโหลด…" : "ไม่มีข้อมูล"}</td></tr>}
          </tbody>
          {flat.length > 0 && (
            <tfoot>
              <tr style={{ background: "#f1f5f9", fontWeight: 800 }}><td style={cell}>รวมรับเข้า (ไม่รวมจ่ายออก)</td>{showDetail && <td style={numCell}></td>}<td style={{ ...numCell, color: "#166534" }}>{fmt(grandIn)}</td></tr>
              <tr style={{ background: "#f1f5f9", fontWeight: 800 }}><td style={cell}>รวมสุทธิ (หักจ่ายออก/คืนเงิน)</td>{showDetail && <td style={numCell}></td>}<td style={numCell}>{fmt(grand)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>

      {drill && (
        <div onClick={() => setDrill(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 900, maxWidth: "96vw", maxHeight: "86vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 700, flex: 1 }}>🔍 {drill.title}</div>
              <div style={{ fontSize: 13, color: "#374151" }}>{drill.rows.length} รายการ · รวม <b>{fmt(drill.rows.reduce((a, r) => a + r.amount, 0))}</b></div>
              <button onClick={() => setDrill(null)} style={{ border: "none", background: "#e5e7eb", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>ปิด</button>
            </div>
            <div style={{ overflow: "auto", padding: "0 0 8px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#f1f5f9", position: "sticky", top: 0 }}><tr>
                  <th style={{ ...cell, textAlign: "left" }}>วันที่</th><th style={{ ...cell, textAlign: "left" }}>เลขที่เอกสาร</th><th style={{ ...cell, textAlign: "left" }}>อ้างอิง</th><th style={{ ...cell, textAlign: "left" }}>ลูกค้า</th><th style={{ ...cell, textAlign: "left" }}>หมายเหตุ</th><th style={numCell}>ยอด</th>
                </tr></thead>
                <tbody>
                  {drill.rows.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 ? "#fafcff" : "#fff" }}>
                      <td style={{ ...cell, whiteSpace: "nowrap" }}>{r.date ? `${r.date.slice(8, 10)}/${r.date.slice(5, 7)}/${Number(r.date.slice(0, 4)) + 543}` : "-"}</td>
                      <td style={{ ...cell, fontFamily: "monospace" }}>{r.doc_no}</td>
                      <td style={{ ...cell, fontFamily: "monospace", color: "#6b7280" }}>{r.ref_no}</td>
                      <td style={cell}>{r.customer}{r.seller ? <div style={{ fontSize: 11, color: "#9ca3af" }}>{r.seller}</div> : null}</td>
                      <td style={{ ...cell, fontSize: 12, color: "#6b7280" }}>{r.note}</td>
                      <td style={{ ...numCell, fontWeight: 600, color: r.amount < 0 ? "#b91c1c" : "#111" }}>{fmt(r.amount)}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </div>
        </div>)}
      <div style={{ marginTop: 14, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#78350f" }}>
        <b>ข้อแตกต่างจาก pivot ใน Excel ของบัญชี</b>
        <ul style={{ margin: "6px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
          <li>Excel แถว "ขายรถจักรยานยนต์" คือมูลค่าขายตามใบกำกับ (รวมส่วนที่ไฟแนนซ์จ่าย) — รายงานนี้แสดงเฉพาะเงินที่รับหน้าร้านจริง</li>
          <li>Excel "เงินมัดจำรถ สาขา SCY10" คือยอดไฟแนนซ์โอนเข้าบัญชี ไม่ใช่เงินรับหน้าร้าน — ไม่อยู่ในรายงานนี้ (ดูที่รายงานรับชำระไฟแนนซ์)</li>
          <li>มัดจำป้ายแดง 200 ระบบแยกเป็นประเภทของตัวเอง — Excel รวมอยู่ใน "เงินมัดจำทั่วไป" ร่วมกับมัดจำจองรถบางใบของระบบเก่า</li>
          <li>งานทะเบียน (ต่อภาษี+ทะเบียนรถใหม่) / งานพรบ. / งานประกัน แยกตามรายการย่อยในใบรับเรื่องเหมือน Excel (ต้อง import Receipt Entry API เวอร์ชันที่คืนยอดแยก ไม่อย่างนั้นจะแยกตามประเภทใบ)</li>
          <li>E-คูปอง และยอดที่ตัดจากเงินมัดจำแสดงเป็นวิธีรับเงินแยก (Excel ไม่นับ E-คูปอง)</li>
          <li>รายการจ่ายออก/คืนเงิน (ค่านำพา เบิกเงินสดย่อย คืนมัดจำ ฯลฯ) ไม่มีใน Excel — แสดงท้ายตารางเป็นกลุ่มแยก ไม่รวมใน "รวมรับเข้า"</li>
        </ul>
      </div>
    </div>
  );
}
