import React, { useEffect, useMemo, useState } from "react";

// บันทึกรับชำระเงินขายส่งอะไหล่ (Finance — user 2026-09-17)
// เลือกใบขายส่ง HONDA (honda_part_sales เลขใบขาย 69WHSL/…) ที่ค้างชำระ ได้หลายใบต่อการรับ 1 ครั้ง → ออกใบรับชำระ WSR-YYMM-NNNN
// ⚠️ รับได้เฉพาะ "เงินโอน" ห้ามรับเงินสด (บังคับทั้งหน้านี้และ workflow) · เงินเข้ารายงานเคลื่อนไหวบัญชีผ่าน CTE whsl_movements (Accounting API)
// backend: part-wholesale-payment-api — list_outstanding / save_payment / list_payments / cancel_payment
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/part-wholesale-payment-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const BRANCH_NAME = { SCY05: "ป.เปา นครหลวง", SCY06: "ป.เปา วังน้อย" };

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = (await res.text()).trim();
  try { const d = t ? JSON.parse(t) : {}; return Array.isArray(d) && d.length === 1 && !d[0]?.account_id ? d[0] : d; } catch { return {}; }
}
const num = (v) => { const n = Number(String(v ?? "").replace(/,/g, "")); return isFinite(n) ? n : 0; };
const baht = (n) => num(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
const thaiDate = (iso) => { if (!iso) return "-"; const s = String(iso).slice(0, 10); const [y, m, d] = s.split("-"); return y && m && d ? `${d}/${m}/${Number(y) + 543}` : s; };
const unwrapList = (d) => { try { return typeof d?.listjson === "string" ? JSON.parse(d.listjson) : Array.isArray(d?.listjson) ? d.listjson : Array.isArray(d) ? d : []; } catch { return []; } };
const docKey = (r) => `${r.sale_branch || ""}|${r.sale_doc_no}`;
const bankLabelOf = (a) => [a.bank_name, a.account_no, a.account_name].filter(Boolean).join(" · ");

export default function PartWholesalePaymentPage({ currentUser }) {
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const [docs, setDocs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState({}); // docKey → ยอดรับ (string)
  const [form, setForm] = useState({ paid_date: todayStr(), account_id: "", note: "" });
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayStr());
  const [search, setSearch] = useState("");

  useEffect(() => {
    post(ACC_API, { action: "list_bank_accounts", include_inactive: "false" })
      .then((d) => setBankAccounts((Array.isArray(d) ? d : []).filter((a) => a && a.account_id && a.account_type !== "เงินสดย่อย" && a.account_type !== "ลูกหนี้")))
      .catch(() => {});
  }, []);

  async function loadDocs() {
    setLoading(true);
    try {
      const d = await post(API, { action: "list_outstanding" });
      if (d?.error) throw new Error(d.error);
      setDocs(unwrapList(d).filter((r) => r && r.sale_doc_no));
    } catch (e) { setMessage("❌ โหลดใบขายส่งไม่สำเร็จ (import workflow part-wholesale-payment-api แล้วหรือยัง?) " + (e?.message || "")); setDocs([]); }
    setLoading(false);
  }
  async function loadPayments() {
    try {
      const d = await post(API, { action: "list_payments", date_from: dateFrom, date_to: dateTo });
      setPayments(unwrapList(d).filter((r) => r && r.payment_id));
    } catch { setPayments([]); }
  }
  useEffect(() => { loadDocs(); loadPayments(); }, []); // eslint-disable-line

  const shownDocs = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return docs.filter((r) => !kw || [r.sale_doc_no, r.customer_name, r.items_text].filter(Boolean).join(" ").toLowerCase().includes(kw));
  }, [docs, search]);
  const selectedDocs = useMemo(() => docs.filter((r) => selected[docKey(r)] != null), [docs, selected]);
  const selectedCustomer = selectedDocs[0]?.customer_name || "";
  const normCust = (s) => String(s || "").replace(/[\s\-.]+/g, "");
  const totalPay = selectedDocs.reduce((s, r) => s + num(selected[docKey(r)]), 0);

  function toggle(r) {
    setMessage("");
    setSelected((prev) => {
      const k = docKey(r); const next = { ...prev };
      if (next[k] != null) { delete next[k]; return next; }
      // รับชำระ 1 ครั้ง = ลูกค้ารายเดียว (ใบรับชำระออกในชื่อลูกค้ารายนั้น)
      const first = docs.find((x) => prev[docKey(x)] != null);
      if (first && normCust(first.customer_name) !== normCust(r.customer_name)) { setMessage(`❌ เลือกได้ครั้งละลูกค้ารายเดียว — ที่เลือกไว้เป็นของ "${first.customer_name}"`); return prev; }
      next[k] = String(num(r.outstanding).toFixed(2)); return next;
    });
  }

  // พิมพ์ใบขายส่งค้างชำระ (user 2026-09-17): ถ้าติ๊กเลือกไว้ = พิมพ์เฉพาะใบที่เลือก ไม่งั้นพิมพ์ทุกใบที่แสดง (ตามคำค้น) จัดกลุ่มตามลูกค้า + ยอดรวมย่อย
  function printOutstanding() {
    const list = selectedDocs.length ? selectedDocs : shownDocs;
    if (!list.length) { setMessage("❌ ไม่มีใบขายส่งค้างชำระให้พิมพ์"); return; }
    const esc = (v) => String(v == null ? "" : v).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const groups = new Map();
    list.forEach((r) => { const k = normCust(r.customer_name) || "-"; const g = groups.get(k) || { name: r.customer_name || "-", rows: [] }; g.rows.push(r); groups.set(k, g); });
    let n = 0;
    const body = [...groups.values()].map((g) => {
      const sum = (key) => g.rows.reduce((a, r) => a + num(r[key]), 0);
      return `<tr class="grp"><td colspan="8">ลูกค้า: ${esc(g.name)} · ${g.rows.length} ใบ</td></tr>` + g.rows.map((r) => `<tr><td class="c">${++n}</td><td class="c">${thaiDate(r.sale_date)}</td><td class="c">${esc(r.branch_code)}</td><td class="mono">${esc(r.sale_doc_no)}</td><td class="sm">${esc(r.items_text || "")}</td><td class="r">${baht(r.doc_amount)}</td><td class="r">${num(r.paid_amount) ? baht(r.paid_amount) : "-"}</td><td class="r b">${baht(r.outstanding)}</td></tr>`).join("")
        + `<tr class="sub"><td colspan="5" class="r">รวม ${esc(g.name)}</td><td class="r">${baht(sum("doc_amount"))}</td><td class="r">${baht(sum("paid_amount"))}</td><td class="r">${baht(sum("outstanding"))}</td></tr>`;
    }).join("");
    const tot = (key) => list.reduce((a, r) => a + num(r[key]), 0);
    const now = new Date();
    const w = window.open("", "_blank", "width=1000,height=800");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ใบขายส่งอะไหล่ค้างชำระ</title>
<style>@page{size:A4;margin:12mm}body{font-family:Tahoma,sans-serif;font-size:11px;color:#111}h2{margin:0 0 3px;font-size:16px}.info{color:#555;margin-bottom:8px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:4px 6px;vertical-align:top}th{background:#072d6b;color:#fff;font-size:11px}
.r{text-align:right}.c{text-align:center}.b{font-weight:700}.mono{font-family:monospace;font-weight:700;white-space:nowrap}.sm{font-size:10px;color:#444}
.grp td{background:#e0e7ff;font-weight:700}.sub td{background:#f1f5f9;font-weight:700}tfoot td{background:#fde68a;font-weight:700;font-size:12px}
.sign{display:flex;justify-content:space-between;margin-top:36px}.sign div{width:30%;text-align:center;border-top:1px dotted #555;padding-top:4px}</style></head><body>
<h2>รายงานใบขายส่งอะไหล่ค้างชำระ (HONDA · 69WHSL)</h2>
<div class="info">${selectedDocs.length ? "เฉพาะใบที่เลือก" : search.trim() ? "ตามคำค้น: " + esc(search.trim()) : "ทุกใบที่ค้างชำระ"} · ${list.length} ใบ · พิมพ์เมื่อ ${thaiDate(todayStr())} ${pad(now.getHours())}:${pad(now.getMinutes())} โดย ${esc(currentUser?.name || currentUser?.username || "-")}</div>
<table><thead><tr><th>#</th><th>วันที่ขาย</th><th>สาขา</th><th>เลขที่ใบขายส่ง</th><th>รายการ</th><th>ยอดใบขาย</th><th>รับแล้ว</th><th>ค้างชำระ</th></tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td colspan="5" class="r">รวมทั้งสิ้น ${list.length} ใบ</td><td class="r">${baht(tot("doc_amount"))}</td><td class="r">${baht(tot("paid_amount"))}</td><td class="r">${baht(tot("outstanding"))}</td></tr></tfoot></table>
<div class="sign"><div>ผู้จัดทำ</div><div>ผู้ตรวจสอบ</div><div>ผู้รับวางบิล / ลูกค้า</div></div>
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  async function save() {
    if (!selectedDocs.length) { setMessage("❌ ยังไม่ได้เลือกใบขายส่ง"); return; }
    if (!form.paid_date) { setMessage("❌ ระบุวันที่รับเงิน"); return; }
    const acc = bankAccounts.find((a) => String(a.account_id) === String(form.account_id));
    if (!acc) { setMessage("❌ เลือกบัญชีที่รับโอน (รับได้เฉพาะเงินโอน)"); return; }
    for (const r of selectedDocs) {
      const amt = num(selected[docKey(r)]);
      if (!(amt > 0)) { setMessage(`❌ ยอดรับของ ${r.sale_doc_no} ต้องมากกว่า 0`); return; }
      if (amt > num(r.outstanding) + 0.005) { setMessage(`❌ ยอดรับของ ${r.sale_doc_no} เกินยอดค้างชำระ (${baht(r.outstanding)})`); return; }
    }
    if (!window.confirm(`บันทึกรับชำระเงินขายส่งอะไหล่\nลูกค้า: ${selectedCustomer}\n${selectedDocs.length} ใบ รวม ${baht(totalPay)} บาท\nเงินโอนเข้า: ${bankLabelOf(acc)}\nวันที่ ${thaiDate(form.paid_date)}`)) return;
    setSaving(true); setMessage("");
    try {
      const d = await post(API, {
        action: "save_payment", method: "เงินโอน", paid_date: form.paid_date, account_id: acc.account_id, account_name: bankLabelOf(acc),
        customer_name: selectedCustomer, note: form.note, branch_code: myBranch, received_by: currentUser?.name || currentUser?.username || "",
        items: selectedDocs.map((r) => ({ sale_branch: r.sale_branch || "", sale_doc_no: r.sale_doc_no, sale_date: String(r.sale_date || "").slice(0, 10), customer_name: r.customer_name, doc_amount: num(r.doc_amount), paid_amount: num(selected[docKey(r)]) })),
      });
      if (d?.result !== "ok") throw new Error(d?.error || "ไม่มีการตอบกลับจาก n8n");
      setMessage(`✅ บันทึกแล้ว เลขที่ ${d.receipt_no} · ${selectedDocs.length} ใบ รวม ${baht(totalPay)} บาท`);
      setSelected({}); setForm((f) => ({ ...f, note: "" }));
      await Promise.all([loadDocs(), loadPayments()]);
    } catch (e) { setMessage("❌ บันทึกไม่สำเร็จ: " + (e?.message || "")); }
    setSaving(false);
  }

  async function cancelPayment(p) {
    const reason = window.prompt(`ยกเลิกใบรับชำระ ${p.receipt_no} (${baht(p.total_amount)} บาท)\nใบขายส่งจะกลับไปค้างชำระ — ระบุเหตุผล:`);
    if (reason == null) return;
    if (!reason.trim()) { setMessage("❌ ต้องระบุเหตุผลการยกเลิก"); return; }
    try {
      const d = await post(API, { action: "cancel_payment", payment_id: p.payment_id, cancel_reason: reason.trim(), cancelled_by: currentUser?.name || currentUser?.username || "" });
      if (d?.result !== "ok") throw new Error(d?.error || "ยกเลิกไม่สำเร็จ");
      setMessage(`✅ ยกเลิก ${p.receipt_no} แล้ว`);
      await Promise.all([loadDocs(), loadPayments()]);
    } catch (e) { setMessage("❌ " + (e?.message || "")); }
  }

  const inp = { padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, background: "#fff" };
  const th = { padding: "8px 6px", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff" };
  const td = { padding: "7px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
  const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 14 };
  const activePayments = payments.filter((p) => p.status === "active");

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1300 }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>🏦 บันทึกรับชำระเงินขายส่งอะไหล่</h2>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
        เลือกใบขายส่ง HONDA (เลขใบขาย 69WHSL/… จากตารางขายอะไหล่ที่ upload) ที่ยังค้างชำระ เลือกได้หลายใบต่อการรับ 1 ครั้ง · <b style={{ color: "#b91c1c" }}>รับชำระได้เฉพาะเงินโอน — ห้ามบันทึกรับเงินสด</b>
      </div>
      {message && <div style={{ marginBottom: 10, padding: "9px 12px", borderRadius: 8, fontSize: 14, background: message.startsWith("✅") ? "#dcfce7" : "#fef2f2", border: `1px solid ${message.startsWith("✅") ? "#86efac" : "#fecaca"}` }}>{message}</div>}

      {/* ใบขายส่งค้างชำระ */}
      <div style={card}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <b style={{ color: "#072d6b", fontSize: 15 }}>📄 ใบขายส่งค้างชำระ</b>
          <span style={{ fontSize: 13, color: "#64748b" }}>{docs.length} ใบ · รวมค้าง {baht(docs.reduce((s, r) => s + num(r.outstanding), 0))} บาท</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา เลขใบขาย / ลูกค้า / อะไหล่" style={{ ...inp, width: 250, marginLeft: "auto" }} />
          <button onClick={loadDocs} disabled={loading} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontFamily: "Tahoma" }}>{loading ? "⏳" : "🔄 รีเฟรช"}</button>
          <button onClick={printOutstanding} disabled={!shownDocs.length} title="ติ๊กเลือกใบไว้ = พิมพ์เฉพาะใบที่เลือก · ไม่ติ๊ก = พิมพ์ทุกใบที่แสดง" style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#6b7280", color: "#fff", cursor: "pointer", fontFamily: "Tahoma" }}>🖨️ พิมพ์ใบค้างชำระ{selectedDocs.length ? ` (${selectedDocs.length})` : ""}</button>
        </div>
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, maxHeight: "42vh", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...th, position: "sticky", top: 0 }}>เลือก</th><th style={{ ...th, position: "sticky", top: 0 }}>วันที่ขาย</th><th style={{ ...th, position: "sticky", top: 0 }}>สาขา</th><th style={{ ...th, position: "sticky", top: 0 }}>เลขที่ใบขายส่ง</th><th style={{ ...th, position: "sticky", top: 0 }}>ลูกค้า</th><th style={{ ...th, position: "sticky", top: 0 }}>รายการ</th>
              <th style={{ ...th, position: "sticky", top: 0, textAlign: "right" }}>ยอดใบขาย</th><th style={{ ...th, position: "sticky", top: 0, textAlign: "right" }}>รับแล้ว</th><th style={{ ...th, position: "sticky", top: 0, textAlign: "right" }}>ค้างชำระ</th><th style={{ ...th, position: "sticky", top: 0, textAlign: "right" }}>ยอดรับครั้งนี้</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={10} style={{ ...td, textAlign: "center", padding: 22, color: "#6b7280" }}>กำลังโหลด...</td></tr>}
              {!loading && shownDocs.length === 0 && <tr><td colSpan={10} style={{ ...td, textAlign: "center", padding: 22, color: "#9ca3af" }}>— ไม่มีใบขายส่งค้างชำระ —</td></tr>}
              {shownDocs.map((r, i) => {
                const k = docKey(r); const on = selected[k] != null;
                return (
                  <tr key={k} style={{ background: on ? "#eff6ff" : i % 2 ? "#f9fafb" : "#fff", cursor: "pointer" }} onClick={() => toggle(r)}>
                    <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={on} readOnly /></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(r.sale_date)}</td>
                    <td style={{ ...td, fontSize: 12 }} title={BRANCH_NAME[r.branch_code] || ""}>{r.branch_code}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#072d6b", whiteSpace: "nowrap" }}>{r.sale_doc_no}</td>
                    <td style={td}>{r.customer_name || "-"}</td>
                    <td style={{ ...td, fontSize: 12, color: "#475569", maxWidth: 330 }}>{r.items_text || `${r.item_count} รายการ`}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{baht(r.doc_amount)}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: num(r.paid_amount) ? "#15803d" : "#cbd5e1" }} title={r.receipt_nos || ""}>{num(r.paid_amount) ? baht(r.paid_amount) : "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#b91c1c" }}>{baht(r.outstanding)}</td>
                    <td style={{ ...td, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      {on ? <input type="number" step="0.01" value={selected[k]} onChange={(e) => setSelected((p) => ({ ...p, [k]: e.target.value }))} style={{ ...inp, width: 120, textAlign: "right", padding: "5px 8px" }} /> : <span style={{ color: "#cbd5e1" }}>-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ฟอร์มรับชำระ */}
      <div style={{ ...card, border: "2px solid #072d6b" }}>
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "10px 12px", alignItems: "center", maxWidth: 820 }}>
          <label>ลูกค้า</label>
          <div style={{ fontWeight: 700 }}>{selectedCustomer || <span style={{ color: "#9ca3af", fontWeight: 400 }}>— เลือกใบขายส่งด้านบน —</span>}{selectedDocs.length > 0 && <span style={{ fontWeight: 400, color: "#64748b", fontSize: 13 }}> · {selectedDocs.map((r) => r.sale_doc_no).join(", ")}</span>}</div>
          <label>วันที่รับเงิน *</label>
          <input type="date" value={form.paid_date} onChange={(e) => setForm((f) => ({ ...f, paid_date: e.target.value }))} style={{ ...inp, width: 190 }} />
          <label>วิธีรับชำระ</label>
          <div><span style={{ padding: "7px 14px", borderRadius: 8, fontWeight: 700, background: "#072d6b", color: "#fff", display: "inline-block" }}>🏦 เงินโอน</span> <span style={{ fontSize: 12.5, color: "#b91c1c", marginLeft: 8 }}>ขายส่งรับได้เฉพาะเงินโอน ห้ามรับเงินสด</span></div>
          <label>บัญชีที่รับโอน *</label>
          <select value={form.account_id} onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))} style={{ ...inp, background: form.account_id ? "#fff" : "#fffbeb" }}>
            <option value="">— เลือกบัญชีรับโอน —</option>
            {bankAccounts.map((a) => <option key={a.account_id} value={a.account_id}>{bankLabelOf(a)}</option>)}
          </select>
          <label>หมายเหตุ</label>
          <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="เช่น เลขอ้างอิงโอน" style={inp} />
          <label>ยอดรับรวม</label>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#072d6b", fontFamily: "monospace" }}>{baht(totalPay)} <span style={{ fontSize: 13, fontWeight: 400, color: "#64748b", fontFamily: "Tahoma" }}>บาท · {selectedDocs.length} ใบ</span></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={save} disabled={saving || !selectedDocs.length} style={{ padding: "10px 26px", borderRadius: 8, border: "none", background: selectedDocs.length ? "#059669" : "#9ca3af", color: "#fff", fontFamily: "Tahoma", fontWeight: 700, fontSize: 15, cursor: selectedDocs.length ? "pointer" : "not-allowed" }}>{saving ? "กำลังบันทึก..." : "💾 บันทึกรับชำระ"}</button>
        </div>
      </div>

      {/* ประวัติ */}
      <div style={card}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <b style={{ color: "#072d6b", fontSize: 15 }}>📋 รายการรับชำระ</b>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inp} /><span>ถึง</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inp} />
          <button onClick={loadPayments} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer" }}>🔍 แสดง</button>
          <span style={{ marginLeft: "auto", fontSize: 13 }}>รวม (ไม่รวมที่ยกเลิก): <b style={{ color: "#059669" }}>{baht(activePayments.reduce((s, p) => s + num(p.total_amount), 0))}</b> บาท · {activePayments.length} ใบ</span>
        </div>
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>#</th><th style={th}>วันที่รับเงิน</th><th style={th}>เลขที่ใบรับชำระ</th><th style={th}>ลูกค้า</th><th style={th}>ใบขายส่ง</th><th style={th}>บัญชีรับโอน</th><th style={{ ...th, textAlign: "right" }}>ยอดรับ</th><th style={th}>หมายเหตุ</th><th style={th}>ผู้บันทึก</th><th style={th}></th></tr></thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={10} style={{ ...td, textAlign: "center", padding: 20, color: "#9ca3af" }}>— ไม่มีรายการในช่วงวันที่นี้ —</td></tr>}
              {payments.map((p, i) => {
                const off = p.status !== "active"; const items = Array.isArray(p.items) ? p.items : [];
                return (
                  <tr key={p.payment_id} style={{ background: i % 2 ? "#f9fafb" : "#fff", opacity: off ? .5 : 1 }}>
                    <td style={{ ...td, color: "#94a3b8" }}>{i + 1}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(p.paid_date)}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#1d4ed8", whiteSpace: "nowrap" }}>{p.receipt_no}{off && <div style={{ fontSize: 10.5, color: "#b91c1c" }}>ยกเลิก{p.cancel_reason ? ` · ${p.cancel_reason}` : ""}</div>}</td>
                    <td style={td}>{p.customer_name || "-"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{items.map((it) => <div key={it.sale_doc_no}>{it.sale_doc_no} <span style={{ color: "#64748b" }}>({baht(it.paid_amount)})</span></div>)}</td>
                    <td style={{ ...td, fontSize: 12 }}>{p.account_name || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{baht(p.total_amount)}</td>
                    <td style={{ ...td, fontSize: 12 }}>{p.note || "-"}</td>
                    <td style={{ ...td, fontSize: 12 }}>{p.received_by || "-"}</td>
                    <td style={td}>{!off && <button onClick={() => cancelPayment(p)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fff", color: "#b91c1c", cursor: "pointer", fontSize: 12, fontFamily: "Tahoma" }}>ยกเลิก</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
