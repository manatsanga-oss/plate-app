import React, { useEffect, useMemo, useState } from "react";

// เมนู Vehicle Registration → วางบิล → "รับใบกำกับภาษี LOCKTON / COSMOS" (user 2026-11-20)
//   ใบกำกับค่าประกันของงานวางบิล LOCKTON / COSMOS ออกโดยบริษัทประกัน (เออร์โก ไทยวิวัฒน์ ฯลฯ) ซึ่งไม่รู้ล่วงหน้าว่าเป็นบริษัทไหน
//   → บันทึกรับใบกำกับที่นี่: บริษัทประกัน (พิมพ์เอง) + เลข/วันที่ใบกำกับ + ยอด แล้วผูกกับรายการงานรับเรื่อง (LOCKTON) หรือรอบส่งงาน (COSMOS)
//   LOCKTON: ใบที่บันทึกขึ้นรายงานภาษีซื้อ (แหล่ง "ประกัน LOCKTON") ตามเดือนของวันที่ใบกำกับ
//   COSMOS : ยอดภาษีซื้อคิดจากรอบส่งงานอัตโนมัติอยู่แล้ว ใบที่บันทึกใช้เติมชื่อบริษัท/เลขใบกำกับจริง — ไม่บวกยอดซ้ำ (user เลือก 2026-11-20)
// n8n insurance-tax-invoice-api (Insurance_Tax_Invoice_Workflow.json) · ตาราง insurance_tax_invoice_receipts
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/insurance-tax-invoice-api";

async function post(body) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { return t.trim() ? JSON.parse(t) : null; } catch { return null; }
}
const parseArr = (v) => { if (Array.isArray(v)) return v; try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
const fmtDate = (iso) => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-"); return y && m && d ? `${d}/${m}/${String(Number(y) + 543).slice(-2)}` : iso; };
const fmtYm = (ym) => (ym && ym.length === 6 ? `${ym.slice(4)}/${Number(ym.slice(0, 4)) + 543}` : ym || "");
const money = (v) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const splitVat = (total) => { const t = round2(total); const base = round2(t / 1.07); return { base, vat: round2(t - base) }; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const CHANNEL = { LOCKTON: { label: "LOCKTON", color: "#6d28d9", bg: "#ede9fe" }, COSMOS: { label: "COSMOS", color: "#0369a1", bg: "#e0f2fe" } };
const COSMOS_PLAN = { "3plus": "ประกัน 3 PLUS", rsa: "ค่าบริการ RSA", theft: "ประกันรถหาย ปีแรก", theft_renewal: "ประกันรถหาย ปีต่อ" };
// บริษัทประกันที่เคยเจอในใบกำกับ — เป็นตัวช่วยเติมเท่านั้น พิมพ์ชื่ออื่นได้เสมอ
const KNOWN_VENDORS = [
  { name: "บมจ. เออร์โกประกันภัย (ประเทศไทย)", tax: "0107554000224" },
  { name: "บมจ. ประกันภัยไทยวิวัฒน์", tax: "0107536001427" },
  { name: "บจก. สยามคอสมอสเซอร์วิส", tax: "0105532100445" },
  { name: "บมจ. วิริยะประกันภัย", tax: "0107555000139" },
];

const th = { padding: "8px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#fff", background: "#072d6b", whiteSpace: "nowrap", position: "sticky", top: 0 };
const td = { padding: "6px 8px", fontSize: 13, verticalAlign: "top", borderBottom: "1px solid #e5e7eb" };
const card = { background: "#fff", borderRadius: 10, padding: "10px 14px", boxShadow: "0 1px 3px rgba(0,0,0,.08)" };
const inp = { padding: "7px 10px", fontSize: 14, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" };
const btn = (bg) => ({ padding: "7px 14px", background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 });
const mini = (bg) => ({ padding: "3px 8px", background: bg, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, marginRight: 4 });
const badge = (c) => ({ display: "inline-block", padding: "1px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: c.color, background: c.bg, whiteSpace: "nowrap" });
const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 3 };

export default function InsuranceTaxInvoicePage({ currentUser }) {
  const me = currentUser?.name || currentUser?.username || "";
  const isAdmin = currentUser?.role === "admin";
  const [tab, setTab] = useState("LOCKTON"); // LOCKTON | COSMOS | history
  const [data, setData] = useState({ receipts: [], lockton: [], cosmos: [] });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);
  const [picked, setPicked] = useState({});     // key → true (รายการที่ติ๊กไว้ของแท็บปัจจุบัน)
  const [form, setForm] = useState(null);       // ฟอร์มบันทึก/แก้ไขใบกำกับ
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setMsg("");
    const r = await post({ action: "load", months: 12 });
    if (!r || r.error) setMsg("❌ โหลดข้อมูลไม่สำเร็จ" + (r?.error ? `: ${r.error}` : " — ตรวจว่า import workflow insurance-tax-invoice-api แล้ว"));
    else setData({ receipts: parseArr(r.receiptsjson), lockton: parseArr(r.locktonjson), cosmos: parseArr(r.cosmosjson) });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { setPicked({}); setSearch(""); }, [tab]);

  const vendors = useMemo(() => {
    const m = new Map(KNOWN_VENDORS.map((v) => [v.name, v]));
    data.receipts.forEach((r) => { if (r.vendor_name && !m.has(r.vendor_name)) m.set(r.vendor_name, { name: r.vendor_name, tax: r.vendor_tax_id || "", branch: r.vendor_branch || "" }); });
    return [...m.values()];
  }, [data.receipts]);

  const kw = search.trim().toLowerCase();
  const hit = (...vals) => !kw || vals.some((v) => String(v || "").toLowerCase().includes(kw));
  const rows = useMemo(() => {
    if (tab === "LOCKTON") return data.lockton.filter((x) => (!onlyPending || !x.invoice_nos) && hit(x.receipt_no, x.customer_name, x.batch_code, x.expense_name, x.invoice_nos));
    if (tab === "COSMOS") return data.cosmos.filter((x) => (!onlyPending || !x.invoice_nos) && hit(x.key, x.customer_name, COSMOS_PLAN[x.plan], fmtYm(x.ym), x.invoice_nos));
    return data.receipts.filter((x) => hit(x.tax_invoice_no, x.vendor_name, x.vendor_tax_id, x.affiliation, x.channel, x.note, ...(x.items || []).map((i) => i.key + " " + i.label)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, data, kw, onlyPending]);

  const itemOf = (x) => tab === "LOCKTON"
    ? { key: x.key, label: [x.customer_name, x.expense_name].filter(Boolean).join(" · "), amount: Number(x.amount || 0) }
    : { key: x.key, label: `${COSMOS_PLAN[x.plan] || x.plan} ${x.customer_name ? "· " + x.customer_name : `รอบ ${fmtYm(x.ym)} (${x.n} รายการ)`}`, amount: Number(x.amount || 0) };
  const pickedRows = rows.filter((x) => picked[x.key]);
  const pickedTotal = round2(pickedRows.reduce((s, x) => s + Number(x.amount || 0), 0));

  function openNew() {
    const items = pickedRows.map(itemOf);
    const affs = [...new Set(pickedRows.map((x) => x.affiliation).filter(Boolean))];
    if (affs.length > 1) { setMsg("❌ รายการที่เลือกมีทั้ง ป.เปา และ สิงห์ชัย — ใบกำกับ 1 ใบต้องเป็นของบริษัทเดียว"); return; }
    const total = pickedTotal || "";
    const s = splitVat(total);
    setMsg("");
    setForm({ id: 0, channel: tab, affiliation: tab === "COSMOS" ? "ป.เปา" : (affs[0] || "สิงห์ชัย"), vendor_name: "", vendor_tax_id: "", vendor_branch: "",
      tax_invoice_no: "", tax_invoice_date: todayISO(), total_amount: total, amount_before_vat: total ? s.base : "", vat_amount: total ? s.vat : "", items, note: "" });
  }
  function openEdit(r) {
    setMsg("");
    setForm({ id: r.id, channel: r.channel, affiliation: r.affiliation, vendor_name: r.vendor_name || "", vendor_tax_id: r.vendor_tax_id || "", vendor_branch: r.vendor_branch || "",
      tax_invoice_no: r.tax_invoice_no || "", tax_invoice_date: r.tax_invoice_date || "", total_amount: r.total_amount, amount_before_vat: r.amount_before_vat, vat_amount: r.vat_amount, items: r.items || [], note: r.note || "" });
  }
  // ผูกรายการที่ติ๊กเข้ากับใบกำกับที่บันทึกไว้แล้ว (เช่น ใบที่บันทึกแบบไม่ผูกรายการ) — เปิดฟอร์มแก้ไขพร้อมรายการที่รวมแล้วให้ตรวจก่อนบันทึก
  function openAttach(id) {
    const r = data.receipts.find((x) => String(x.id) === String(id));
    if (!r) return;
    const affs = [...new Set(pickedRows.map((x) => x.affiliation).filter(Boolean))];
    if (affs.some((a) => a !== r.affiliation)) { setMsg(`❌ รายการที่เลือกเป็นของ ${affs.join(", ")} แต่ใบกำกับ ${r.tax_invoice_no} เป็นของ ${r.affiliation}`); return; }
    const have = new Set((r.items || []).map((i) => i.key));
    openEdit({ ...r, items: [...(r.items || []), ...pickedRows.map(itemOf).filter((i) => !have.has(i.key))] });
  }
  const sameChannelReceipts = data.receipts.filter((r) => r.channel === tab);
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
  const onTotal = (v) => { const s = splitVat(v); setF({ total_amount: v, amount_before_vat: v === "" ? "" : s.base, vat_amount: v === "" ? "" : s.vat }); };
  const onVendor = (name) => { const v = vendors.find((x) => x.name === name); setF(v ? { vendor_name: name, vendor_tax_id: v.tax || form.vendor_tax_id, vendor_branch: v.branch || form.vendor_branch } : { vendor_name: name }); };

  async function save() {
    const f = form;
    const total = Number(f.total_amount);
    if (!f.vendor_name.trim()) return setMsg("❌ กรอกชื่อบริษัทประกันผู้ออกใบกำกับ");
    if (!f.tax_invoice_no.trim()) return setMsg("❌ กรอกเลขที่ใบกำกับภาษี");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.tax_invoice_date)) return setMsg("❌ เลือกวันที่ใบกำกับภาษี");
    if (!(total > 0)) return setMsg("❌ กรอกยอดรวมของใบกำกับ (รวม VAT)");
    if (Math.abs(round2(Number(f.amount_before_vat) + Number(f.vat_amount)) - round2(total)) > 0.011) return setMsg("❌ มูลค่า + ภาษี ไม่เท่ากับยอดรวม");
    setSaving(true);
    const r = await post({ action: "save_receipt", ...f, total_amount: total, amount_before_vat: Number(f.amount_before_vat), vat_amount: Number(f.vat_amount), user: me });
    setSaving(false);
    if (r?.error === "duplicate") return setMsg(`❌ เลขใบกำกับ ${f.tax_invoice_no} ของ ${f.affiliation} มีในระบบแล้ว`);
    if (!r || r.error || !r.id) return setMsg("❌ บันทึกไม่สำเร็จ" + (r?.error ? `: ${r.error}` : ""));
    setForm(null); setPicked({});
    setMsg(`✅ บันทึกใบกำกับ ${f.tax_invoice_no} แล้ว` + (f.channel === "LOCKTON" ? " — ขึ้นรายงานภาษีซื้อตามเดือนของวันที่ใบกำกับ" : " — เติมเลขใบกำกับในแถว COSMOS ของรายงานภาษีซื้อ (ยอดไม่เปลี่ยน)"));
    load();
  }
  async function remove(r) {
    if (!window.confirm(`ลบใบกำกับ ${r.tax_invoice_no} (${r.vendor_name || "-"}) ยอด ${money(r.total_amount)} ?` + (r.channel === "LOCKTON" ? "\nใบนี้จะหายจากรายงานภาษีซื้อด้วย" : ""))) return;
    const x = await post({ action: "delete_receipt", id: r.id });
    if (!x || x.error || !x.deleted) return setMsg("❌ ลบไม่สำเร็จ" + (x?.error ? `: ${x.error}` : ""));
    setMsg(`✅ ลบใบกำกับ ${r.tax_invoice_no} แล้ว`); load();
  }

  const tabBtn = (k, label, n) => (
    <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 16px", border: "none", borderBottom: tab === k ? "3px solid #072d6b" : "3px solid transparent", background: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, color: tab === k ? "#072d6b" : "#64748b" }}>
      {label} <span style={{ fontWeight: 600, fontSize: 12, color: "#94a3b8" }}>({n})</span>
    </button>
  );
  const pendingCount = (list) => list.filter((x) => !x.invoice_nos).length;
  const allPicked = rows.length > 0 && rows.every((x) => picked[x.key]);

  return (
    <div style={{ padding: 16, maxWidth: 1250, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>🧾 รับใบกำกับภาษี LOCKTON / COSMOS</h2>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
        บันทึกใบกำกับภาษีค่าประกันที่ได้รับจากงานวางบิล — บริษัทประกันผู้ออกใบให้กรอกตามใบจริง (แต่ละใบอาจเป็นคนละบริษัท)
      </div>
      <div style={{ ...card, padding: "0 8px", marginBottom: 10, display: "flex", flexWrap: "wrap", alignItems: "center" }}>
        {tabBtn("LOCKTON", "LOCKTON (งานรับเรื่อง)", `ค้างรับ ${pendingCount(data.lockton)}`)}
        {tabBtn("COSMOS", "COSMOS (รอบส่งงาน)", `ค้างรับ ${pendingCount(data.cosmos)}`)}
        {tabBtn("history", "ใบกำกับที่บันทึกแล้ว", data.receipts.length)}
        <span style={{ flex: 1 }} />
        <button onClick={load} disabled={loading} style={{ ...btn("#475569"), margin: 6 }}>{loading ? "กำลังโหลด…" : "🔄 โหลดใหม่"}</button>
      </div>

      {tab !== "history" && (
        <div style={{ ...card, marginBottom: 10, fontSize: 13, background: tab === "LOCKTON" ? "#faf5ff" : "#f0f9ff", color: "#334155" }}>
          {tab === "LOCKTON"
            ? <>ติ๊กรายการงานรับเรื่องที่ใบกำกับใบนี้ครอบคลุม แล้วกด <b>บันทึกรับใบกำกับ</b> — ใบที่บันทึกจะ<b>ขึ้นรายงานภาษีซื้อ</b>ตามเดือนของวันที่ใบกำกับ (หาคู่ไม่เจอก็บันทึกได้โดยไม่ต้องติ๊ก)</>
            : <>ภาษีซื้อของ COSMOS ระบบคิดจากรอบส่งงานให้อัตโนมัติอยู่แล้ว — การบันทึกที่นี่ใช้<b>เติมชื่อบริษัทประกันและเลขใบกำกับจริง</b>ในรายงาน และดูว่ารอบไหนยังไม่ได้ใบ <b>ไม่บวกยอดซ้ำ</b></>}
        </div>
      )}

      <div style={{ ...card, marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา เลขใบรับเรื่อง / ชื่อ / เลขใบกำกับ" style={{ ...inp, width: 300 }} />
        {tab !== "history" && (
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> แสดงเฉพาะที่ยังไม่ได้รับใบกำกับ
          </label>
        )}
        <span style={{ flex: 1 }} />
        {tab !== "history" && (
          <>
            {pickedRows.length > 0 && <span style={{ fontSize: 13, color: "#334155" }}>เลือก <b>{pickedRows.length}</b> รายการ รวม <b>{money(pickedTotal)}</b></span>}
            {pickedRows.length > 0 && sameChannelReceipts.length > 0 && (
              <select value="" onChange={(e) => e.target.value && openAttach(e.target.value)} style={{ ...inp, maxWidth: 260 }} title="ผูกรายการที่ติ๊กเข้ากับใบกำกับที่บันทึกไว้แล้ว">
                <option value="">🔗 ผูกกับใบที่บันทึกแล้ว…</option>
                {sameChannelReceipts.map((r) => <option key={r.id} value={r.id}>{r.tax_invoice_no} · {fmtDate(r.tax_invoice_date)} · {money(r.total_amount)}</option>)}
              </select>
            )}
            <button onClick={openNew} style={btn("#15803d")}>➕ บันทึกรับใบกำกับ{pickedRows.length ? ` (${pickedRows.length} รายการ)` : " (ไม่ผูกรายการ)"}</button>
          </>
        )}
      </div>

      {msg && <div style={{ ...card, marginBottom: 10, fontSize: 14, fontWeight: 600, color: msg.startsWith("✅") ? "#15803d" : "#b91c1c" }}>{msg}</div>}

      <div style={{ ...card, padding: 0, overflow: "auto", maxHeight: "62vh" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          {tab === "LOCKTON" && (
            <>
              <thead><tr>
                <th style={{ ...th, width: 30 }}><input type="checkbox" checked={allPicked} onChange={(e) => setPicked(e.target.checked ? Object.fromEntries(rows.map((x) => [x.key, true])) : {})} /></th>
                <th style={th}>วันที่ส่งงาน</th><th style={th}>ใบส่งงาน</th><th style={th}>เลขใบรับเรื่อง</th><th style={th}>ลูกค้า</th><th style={th}>รายการ</th>
                <th style={th}>สังกัด</th><th style={{ ...th, textAlign: "right" }}>ยอดรวม VAT</th><th style={th}>ใบวางบิล</th><th style={th}>ใบกำกับที่รับแล้ว</th>
              </tr></thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.key} style={{ background: picked[x.key] ? "#f5f3ff" : undefined }}>
                    <td style={td}><input type="checkbox" checked={!!picked[x.key]} onChange={(e) => setPicked((p) => ({ ...p, [x.key]: e.target.checked }))} /></td>
                    <td style={td}>{fmtDate(x.submission_date)}</td><td style={td}>{x.batch_code}</td><td style={{ ...td, fontWeight: 600 }}>{x.receipt_no}</td>
                    <td style={td}>{x.customer_name}</td><td style={td}>{x.expense_name}</td><td style={td}>{x.affiliation}</td>
                    <td style={{ ...td, textAlign: "right" }}>{money(x.amount)}</td>
                    <td style={{ ...td, fontSize: 12 }}>{x.billing_doc_no || <span style={{ color: "#9ca3af" }}>ยังไม่วางบิล</span>}{x.paid_date && <div style={{ color: "#64748b" }}>จ่าย {fmtDate(x.paid_date)}</div>}</td>
                    <td style={td}>{x.invoice_nos ? <span style={badge({ color: "#15803d", bg: "#dcfce7" })}>✓ {x.invoice_nos}</span> : <span style={badge({ color: "#b45309", bg: "#fef3c7" })}>ยังไม่ได้รับ</span>}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
          {tab === "COSMOS" && (
            <>
              <thead><tr>
                <th style={{ ...th, width: 30 }}><input type="checkbox" checked={allPicked} onChange={(e) => setPicked(e.target.checked ? Object.fromEntries(rows.map((x) => [x.key, true])) : {})} /></th>
                <th style={th}>งวดส่งงาน</th><th style={th}>แผน</th><th style={th}>รหัสรอบ / เลข App</th><th style={th}>ลูกค้า / จำนวน</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดรวม VAT</th><th style={th}>ใบกำกับที่รับแล้ว</th>
              </tr></thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.key} style={{ background: picked[x.key] ? "#f0f9ff" : undefined }}>
                    <td style={td}><input type="checkbox" checked={!!picked[x.key]} onChange={(e) => setPicked((p) => ({ ...p, [x.key]: e.target.checked }))} /></td>
                    <td style={td}>{fmtYm(x.ym)}</td><td style={td}>{COSMOS_PLAN[x.plan] || x.plan}</td><td style={{ ...td, fontWeight: 600 }}>{x.key}</td>
                    <td style={td}>{x.customer_name || `${x.n} รายการ`}</td>
                    <td style={{ ...td, textAlign: "right" }}>{money(x.amount)}</td>
                    <td style={td}>{x.invoice_nos ? <span style={badge({ color: "#15803d", bg: "#dcfce7" })}>✓ {x.invoice_nos}</span> : <span style={badge({ color: "#b45309", bg: "#fef3c7" })}>ยังไม่ได้รับ</span>}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
          {tab === "history" && (
            <>
              <thead><tr>
                <th style={th}>วันที่ใบกำกับ</th><th style={th}>งาน</th><th style={th}>สังกัด</th><th style={th}>บริษัทประกัน</th><th style={th}>เลขที่ใบกำกับ</th>
                <th style={{ ...th, textAlign: "right" }}>มูลค่า</th><th style={{ ...th, textAlign: "right" }}>ภาษี</th><th style={{ ...th, textAlign: "right" }}>รวม</th>
                <th style={th}>รายการที่ผูก</th><th style={th}>บันทึกโดย</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={td}>{fmtDate(r.tax_invoice_date)}</td>
                    <td style={td}><span style={badge(CHANNEL[r.channel] || CHANNEL.LOCKTON)}>{r.channel}</span></td>
                    <td style={td}>{r.affiliation}</td>
                    <td style={td}>{r.vendor_name}<div style={{ fontSize: 11.5, color: "#64748b" }}>{r.vendor_tax_id}{r.vendor_branch ? ` · ${r.vendor_branch}` : ""}</div></td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.tax_invoice_no}{r.note && <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 400 }}>{r.note}</div>}</td>
                    <td style={{ ...td, textAlign: "right" }}>{money(r.amount_before_vat)}</td><td style={{ ...td, textAlign: "right" }}>{money(r.vat_amount)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{money(r.total_amount)}</td>
                    <td style={{ ...td, fontSize: 12 }}>{(r.items || []).length ? (r.items || []).slice(0, 3).map((i) => <div key={i.key}>{i.key}</div>) : <span style={{ color: "#9ca3af" }}>ไม่ผูกรายการ</span>}{(r.items || []).length > 3 && <div style={{ color: "#64748b" }}>+ อีก {(r.items || []).length - 3} รายการ</div>}</td>
                    <td style={{ ...td, fontSize: 12 }}>{r.created_by}<div style={{ color: "#64748b" }}>{r.created_at}</div></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <button onClick={() => openEdit(r)} style={mini("#2563eb")}>แก้ไข</button>
                      {isAdmin && <button onClick={() => remove(r)} style={mini("#dc2626")}>ลบ</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
        {!loading && rows.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>{tab === "history" ? "ยังไม่มีใบกำกับที่บันทึก" : onlyPending ? "ไม่มีรายการค้างรับใบกำกับ" : "ไม่มีรายการ"}</div>}
      </div>

      {form && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 12 }} onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setForm(null); }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 18, width: 640, maxWidth: "100%", maxHeight: "92vh", overflow: "auto" }}>
            <h3 style={{ margin: "0 0 12px", color: "#072d6b" }}>{form.id ? "แก้ไขใบกำกับ" : "บันทึกรับใบกำกับ"} <span style={badge(CHANNEL[form.channel] || CHANNEL.LOCKTON)}>{form.channel}</span></h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / 3" }}>
                <label style={lbl}>บริษัทประกันผู้ออกใบกำกับ * <span style={{ fontWeight: 400, color: "#94a3b8" }}>(พิมพ์ตามใบจริง หรือเลือกจากที่เคยบันทึก)</span></label>
                <input list="itv-vendors" value={form.vendor_name} onChange={(e) => onVendor(e.target.value)} style={{ ...inp, width: "100%" }} autoFocus />
                <datalist id="itv-vendors">{vendors.map((v) => <option key={v.name} value={v.name} />)}</datalist>
              </div>
              <div><label style={lbl}>เลขประจำตัวผู้เสียภาษี</label><input value={form.vendor_tax_id} onChange={(e) => setF({ vendor_tax_id: e.target.value.replace(/\D/g, "").slice(0, 13) })} style={{ ...inp, width: "100%" }} /></div>
              <div><label style={lbl}>สาขา</label><input value={form.vendor_branch} onChange={(e) => setF({ vendor_branch: e.target.value })} placeholder="เช่น สำนักงานใหญ่ / 00001" style={{ ...inp, width: "100%" }} /></div>
              <div><label style={lbl}>เลขที่ใบกำกับภาษี *</label><input value={form.tax_invoice_no} onChange={(e) => setF({ tax_invoice_no: e.target.value })} style={{ ...inp, width: "100%" }} /></div>
              <div><label style={lbl}>วันที่ใบกำกับภาษี *</label><input type="date" value={form.tax_invoice_date} onChange={(e) => setF({ tax_invoice_date: e.target.value })} style={{ ...inp, width: "100%" }} /></div>
              <div><label style={lbl}>ยอดรวมทั้งใบ (รวม VAT) *</label><input type="number" step="0.01" value={form.total_amount} onChange={(e) => onTotal(e.target.value)} style={{ ...inp, width: "100%", textAlign: "right" }} /></div>
              <div>
                <label style={lbl}>ใช้ยื่นภาษีซื้อของ</label>
                <select value={form.affiliation} onChange={(e) => setF({ affiliation: e.target.value })} disabled={form.channel === "COSMOS"} style={{ ...inp, width: "100%" }}>
                  <option value="ป.เปา">ป.เปา</option><option value="สิงห์ชัย">สิงห์ชัย</option>
                </select>
              </div>
              <div><label style={lbl}>มูลค่าก่อนภาษี <span style={{ fontWeight: 400, color: "#94a3b8" }}>(ถอด 7% ให้ แก้ได้)</span></label><input type="number" step="0.01" value={form.amount_before_vat} onChange={(e) => setF({ amount_before_vat: e.target.value })} style={{ ...inp, width: "100%", textAlign: "right" }} /></div>
              <div><label style={lbl}>ภาษีมูลค่าเพิ่ม</label><input type="number" step="0.01" value={form.vat_amount} onChange={(e) => setF({ vat_amount: e.target.value })} style={{ ...inp, width: "100%", textAlign: "right" }} /></div>
              <div style={{ gridColumn: "1 / 3" }}><label style={lbl}>หมายเหตุ</label><input value={form.note} onChange={(e) => setF({ note: e.target.value })} style={{ ...inp, width: "100%" }} /></div>
            </div>
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <b>รายการที่ใบนี้ครอบคลุม ({form.items.length})</b>
              {form.items.length === 0 && <span style={{ color: "#94a3b8" }}> — ไม่ผูกกับรายการ</span>}
              <div style={{ maxHeight: 140, overflow: "auto", marginTop: 4 }}>
                {form.items.map((i) => (
                  <div key={i.key} style={{ display: "flex", gap: 8, padding: "3px 0", borderBottom: "1px dashed #e5e7eb" }}>
                    <b style={{ minWidth: 150 }}>{i.key}</b><span style={{ flex: 1, color: "#475569" }}>{i.label}</span><span>{money(i.amount)}</span>
                    <button onClick={() => setF({ items: form.items.filter((z) => z.key !== i.key) })} title="เอารายการนี้ออก" style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer" }}>✕</button>
                  </div>
                ))}
              </div>
              {form.items.length > 0 && Math.abs(round2(form.items.reduce((s, i) => s + Number(i.amount || 0), 0)) - round2(form.total_amount)) > 0.011 && (
                <div style={{ color: "#b45309", marginTop: 4 }}>⚠ ยอดรวมของรายการที่ผูก ({money(form.items.reduce((s, i) => s + Number(i.amount || 0), 0))}) ไม่เท่ากับยอดใบกำกับ — บันทึกได้ แต่ตรวจอีกครั้ง</div>
              )}
            </div>
            {msg && msg.startsWith("❌") && <div style={{ marginTop: 10, color: "#b91c1c", fontWeight: 600, fontSize: 13.5 }}>{msg}</div>}
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setForm(null)} disabled={saving} style={btn("#94a3b8")}>ยกเลิก</button>
              <button onClick={save} disabled={saving} style={btn("#15803d")}>{saving ? "กำลังบันทึก…" : "💾 บันทึก"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
