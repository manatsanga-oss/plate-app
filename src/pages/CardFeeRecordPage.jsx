import React, { useEffect, useMemo, useState } from "react";

// บันทึกค่าธรรมเนียมรูดบัตรเครดิต — ใบเสร็จรับเงิน/ใบกำกับภาษีค่าธรรมเนียมจากธนาคาร (merchant) 1 ใบ = 1 แถว (user 2026-10-12)
// ธนาคารหักค่าธรรมเนียม + VAT จากยอดรูด แล้วโอนเงินสุทธิเข้าบัญชี · ร้านหัก ณ ที่จ่าย 3% ของค่าธรรมเนียม (ภ.ง.ด.53 ออกหนังสือรับรองให้ธนาคาร)
// จับคู่กับรายการรับชำระที่ลูกค้ารูดบัตร: ใบขาย NEW ที่บวกค่าธรรมเนียมบัตรเข้าราคา (card_fee_amount) + ใบรับชำระอะไหล่/บริการที่ติ๊กบัตรเครดิต
// webhook card-fee-api (list_card_payments / list / save / cancel) + ตาราง credit_card_fee_records · ตัดยอดบัญชีผ่าน CTE cardfee_movements ใน Accounting API
const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/card-fee-api";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

const WHT_RATE = 3;
const BANKS = ["ธนาคารกรุงเทพ", "ธนาคารกสิกรไทย", "ธนาคารไทยพาณิชย์", "ธนาคารกรุงไทย", "ธนาคารกรุงศรีอยุธยา", "อื่น ๆ"];

const fmt = (v) => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const num = (v) => { const n = Number(String(v == null ? "" : v).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
const todayISO = () => new Date().toISOString().slice(0, 10);
const shiftISO = (iso, days) => { const d = new Date((iso || todayISO()) + "T00:00:00"); if (isNaN(d)) return iso; d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(String(v).length <= 10 ? v + "T00:00:00" : v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
const affOfAccount = (acc) => /สิงห์ชัย|SINGCHAI/i.test(String(acc?.account_name || "")) ? "สิงห์ชัย" : "ป.เปา";

const EMPTY = () => ({
  bank_name: "ธนาคารกรุงเทพ", bank_receipt_no: "", bank_receipt_date: todayISO(), merchant_no: "", bank_account_id: "",
  gross_amount: "", fee_amount: "", vat_amount: "", net_amount: "", wht_amount: "", note: "",
});

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  if (!t.trim()) return null;
  try { return JSON.parse(t); } catch { return null; }
}

const inp = { padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, fontFamily: "Tahoma", boxSizing: "border-box", width: "100%" };
const lbl = { display: "block", fontSize: 12, color: "#4b5563", marginBottom: 3, fontWeight: 600 };
const th = { padding: "8px 8px", fontSize: 12.5, textAlign: "left", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
const td = { padding: "7px 8px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const btn = (bg) => ({ padding: "8px 14px", background: bg, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 700, fontFamily: "Tahoma" });
const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 14 };

export default function CardFeeRecordPage({ currentUser }) {
  const userName = currentUser?.username || currentUser?.name || "system";
  const [bankAccounts, setBankAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY());
  const [cands, setCands] = useState([]);          // รายการรับชำระรูดบัตรที่ยังไม่จับคู่
  const [candFrom, setCandFrom] = useState(shiftISO(todayISO(), -14));
  const [candTo, setCandTo] = useState(todayISO());
  const [candLoading, setCandLoading] = useState(false);
  const [sel, setSel] = useState({});              // key → true
  const [rows, setRows] = useState([]);
  const [histFrom, setHistFrom] = useState(shiftISO(todayISO(), -60));
  const [histTo, setHistTo] = useState(todayISO());
  const [showCancelled, setShowCancelled] = useState(false);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { loadBanks(); loadRows(); loadCands(); /* eslint-disable-next-line */ }, []);

  async function loadBanks() {
    try { const d = await post(ACC_URL, { action: "list_bank_accounts", include_inactive: "false" }); setBankAccounts(Array.isArray(d) ? d : []); } catch { setBankAccounts([]); }
  }
  async function loadCands() {
    setCandLoading(true);
    try {
      const d = await post(API_URL, { action: "list_card_payments", date_from: candFrom, date_to: candTo });
      setCands((Array.isArray(d) ? d : []).filter((x) => x && x.doc_no));
    } catch { setCands([]); }
    setCandLoading(false);
  }
  async function loadRows() {
    try {
      const d = await post(API_URL, { action: "list", date_from: histFrom, date_to: histTo });
      setRows((Array.isArray(d) ? d : []).filter((r) => r && r.id));
    } catch { setRows([]); }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  // คำนวณอัตโนมัติ: สุทธิ = ยอดรูด − ค่าธรรมเนียม − VAT · หัก ณ ที่จ่าย = ค่าธรรมเนียม × 3% (แก้ทับได้ตามใบเสร็จจริง)
  const gross = num(form.gross_amount), fee = num(form.fee_amount), vat = num(form.vat_amount);
  const netAuto = r2(gross - fee - vat), whtAuto = r2(fee * WHT_RATE / 100);
  const net = form.net_amount === "" ? netAuto : num(form.net_amount);
  const wht = form.wht_amount === "" ? whtAuto : num(form.wht_amount);
  const feeWithVat = r2(fee + vat);
  const account = bankAccounts.find((a) => String(a.account_id) === String(form.bank_account_id));
  const affiliation = account ? affOfAccount(account) : "";

  const keyOf = (c) => `${c.source}|${c.doc_no}`;
  const selected = useMemo(() => cands.filter((c) => sel[keyOf(c)]), [cands, sel]);
  const selTotal = r2(selected.reduce((s, c) => s + num(c.gross), 0));
  const selFee = r2(selected.reduce((s, c) => s + num(c.card_fee), 0));
  const diff = r2(gross - selTotal);

  async function save() {
    if (!(gross > 0)) { setMsg("⚠️ ใส่จำนวนเงิน (ยอดรูดบัตร) ตามใบเสร็จธนาคาร"); return; }
    if (!form.bank_receipt_date) { setMsg("⚠️ ใส่วันที่ใบเสร็จธนาคาร"); return; }
    if (!form.bank_account_id) { setMsg("⚠️ เลือกบัญชีที่เงินสุทธิเข้า (ตัดค่าธรรมเนียมจากบัญชีนี้)"); return; }
    if (!(fee > 0)) { setMsg("⚠️ ใส่ค่าธรรมเนียม"); return; }
    if (Math.abs(net - netAuto) > 0.009 && !window.confirm(`เงินสุทธิ ${fmt(net)} ไม่เท่ากับ ยอดรูด − ค่าธรรมเนียม − VAT = ${fmt(netAuto)}\nบันทึกตามที่กรอกหรือไม่?`)) return;
    if (selected.length && Math.abs(diff) > 0.009 && !window.confirm(`ยอดรูดตามใบเสร็จ ${fmt(gross)} แต่รายการที่จับคู่รวม ${fmt(selTotal)} (ต่าง ${fmt(diff)})\nบันทึกต่อหรือไม่?`)) return;
    if (!selected.length && !window.confirm("ยังไม่ได้จับคู่รายการรับชำระที่รูดบัตร\nบันทึกเฉพาะใบเสร็จธนาคารหรือไม่?")) return;
    setSaving(true); setMsg("");
    try {
      const d = await post(API_URL, {
        action: "save", affiliation, bank_name: form.bank_name, bank_receipt_no: form.bank_receipt_no.trim(), bank_receipt_date: form.bank_receipt_date,
        merchant_no: form.merchant_no.trim(), bank_account_id: Number(form.bank_account_id),
        gross_amount: gross, fee_amount: fee, vat_amount: vat, net_amount: net, wht_rate: WHT_RATE, wht_amount: wht,
        matched_items: selected.map((c) => ({ source: c.source, doc_no: c.doc_no, receipt_no: c.receipt_no, customer_name: c.customer_name, paid_date: c.paid_date, gross: num(c.gross), card_fee: num(c.card_fee) })),
        note: form.note.trim(), created_by: userName,
      });
      const row = Array.isArray(d) ? d[0] : d;
      if (!row || row.error || !row.doc_no) throw new Error(row?.error || "บันทึกไม่สำเร็จ (ตรวจสอบว่า import workflow card-fee-api แล้ว)");
      setMsg(`✅ บันทึกแล้ว เลขที่ ${row.doc_no} · ค่าธรรมเนียม+VAT ${fmt(feeWithVat)} ตัดจากบัญชี ${account?.account_name || ""} วันที่ ${fmtDate(form.bank_receipt_date)}`);
      setForm(EMPTY()); setSel({});
      loadRows(); loadCands();
    } catch (e) { setMsg("❌ " + (e.message || "บันทึกไม่สำเร็จ")); }
    setSaving(false);
  }

  async function cancel(r) {
    if (!window.confirm(`ยกเลิกรายการ ${r.doc_no} (ใบเสร็จธนาคาร ${r.bank_receipt_no || "-"})?\nรายการรับชำระที่จับคู่ไว้จะกลับมาให้เลือกใหม่`)) return;
    try {
      const d = await post(API_URL, { action: "cancel", id: r.id, cancelled_by: userName });
      const row = Array.isArray(d) ? d[0] : d;
      if (!row || !row.doc_no) throw new Error("ยกเลิกไม่สำเร็จ");
      setMsg(`↩️ ยกเลิก ${r.doc_no} แล้ว`); loadRows(); loadCands();
    } catch (e) { setMsg("❌ " + (e.message || "ยกเลิกไม่สำเร็จ")); }
  }

  const itemsOf = (r) => { let it = r.matched_items; if (typeof it === "string") { try { it = JSON.parse(it); } catch { it = []; } } return Array.isArray(it) ? it : []; };
  const shownRows = rows.filter((r) => showCancelled || r.status === "active");

  return (
    <div style={{ fontFamily: "Tahoma", maxWidth: 1250, margin: "0 auto" }}>
      <h2 style={{ margin: "4px 0 12px" }}>💳 บันทึกค่าธรรมเนียมรูดบัตรเครดิต</h2>
      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 12 }}>
        กรอกตามใบเสร็จรับเงิน/ใบกำกับภาษีค่าธรรมเนียมจากธนาคาร → จับคู่รายการรับชำระที่ลูกค้ารูดบัตร (ใบขาย NEW ที่บวกค่าธรรมเนียม / ใบรับชำระอะไหล่-บริการที่ติ๊กบัตรเครดิต) → บันทึก ·
        ค่าธรรมเนียม + VAT จะถูกตัดออกจากบัญชีที่เงินเข้าในรายงานเคลื่อนไหวบัญชี ณ วันที่ใบเสร็จ (ธนาคารโอนสุทธิ) · หัก ณ ที่จ่าย 3% ของค่าธรรมเนียม ออกหนังสือรับรองให้ธนาคาร (ภ.ง.ด.53)
      </div>
      {msg && <div style={{ padding: "9px 12px", background: msg.startsWith("✅") || msg.startsWith("↩️") ? "#ecfdf5" : "#fef2f2", border: `1px solid ${msg.startsWith("✅") || msg.startsWith("↩️") ? "#6ee7b7" : "#fecaca"}`, borderRadius: 8, marginBottom: 12, fontSize: 13.5 }}>{msg}</div>}

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>1️⃣ ใบเสร็จค่าธรรมเนียมจากธนาคาร</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <div><label style={lbl}>ธนาคารที่ออกใบเสร็จ</label><select value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} style={inp}>{BANKS.map((b) => <option key={b}>{b}</option>)}</select></div>
          <div><label style={lbl}>เลขที่ใบเสร็จ/ใบกำกับภาษี</label><input value={form.bank_receipt_no} onChange={(e) => set("bank_receipt_no", e.target.value)} placeholder="เช่น 26281-01-04099" style={inp} /></div>
          <div><label style={lbl}>วันที่ใบเสร็จ (วันที่เงินสุทธิเข้า) *</label><input type="date" value={form.bank_receipt_date} onChange={(e) => set("bank_receipt_date", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>หมายเลขร้านค้า</label><input value={form.merchant_no} onChange={(e) => set("merchant_no", e.target.value)} placeholder="เช่น 002206718116" style={inp} /></div>
          <div style={{ gridColumn: "span 2" }}><label style={lbl}>บัญชีที่เงินสุทธิเข้า * {affiliation && <span style={{ color: "#2563eb" }}>· สังกัด {affiliation}</span>}</label>
            <select value={form.bank_account_id} onChange={(e) => set("bank_account_id", e.target.value)} style={inp}>
              <option value="">— เลือกบัญชี —</option>
              {bankAccounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name}{a.account_no && a.account_no !== "-" ? ` · ${a.account_no}` : ""}{a.bank_name && a.bank_name !== "-" ? ` (${a.bank_name})` : ""}</option>)}
            </select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 10 }}>
          <div><label style={lbl}>จำนวนเงิน (ยอดรูดบัตร) *</label><input type="number" step="0.01" value={form.gross_amount} onChange={(e) => set("gross_amount", e.target.value)} style={{ ...inp, textAlign: "right", fontWeight: 700 }} placeholder="51,660.00" /></div>
          <div><label style={lbl}>ค่าธรรมเนียม *</label><input type="number" step="0.01" value={form.fee_amount} onChange={(e) => set("fee_amount", e.target.value)} style={{ ...inp, textAlign: "right" }} placeholder="1,136.52" /></div>
          <div><label style={lbl}>ภาษีมูลค่าเพิ่ม (ภาษีซื้อ)</label><input type="number" step="0.01" value={form.vat_amount} onChange={(e) => set("vat_amount", e.target.value)} style={{ ...inp, textAlign: "right" }} placeholder="79.56" /></div>
          <div><label style={lbl}>จำนวนเงินสุทธิเข้าบัญชี <span style={{ color: "#9ca3af", fontWeight: 400 }}>(อัตโนมัติ {fmt(netAuto)})</span></label><input type="number" step="0.01" value={form.net_amount} onChange={(e) => set("net_amount", e.target.value)} style={{ ...inp, textAlign: "right", fontWeight: 700, color: "#166534" }} placeholder={fmt(netAuto)} /></div>
          <div><label style={lbl}>ภาษีหัก ณ ที่จ่าย {WHT_RATE}% <span style={{ color: "#9ca3af", fontWeight: 400 }}>(อัตโนมัติ {fmt(whtAuto)})</span></label><input type="number" step="0.01" value={form.wht_amount} onChange={(e) => set("wht_amount", e.target.value)} style={{ ...inp, textAlign: "right", color: "#b91c1c" }} placeholder={fmt(whtAuto)} /></div>
          <div style={{ gridColumn: "span 2" }}><label style={lbl}>หมายเหตุ</label><input value={form.note} onChange={(e) => set("note", e.target.value)} style={inp} placeholder="เช่น รอบตัดวันที่ 08/10/69" /></div>
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: "#374151", display: "flex", gap: 18, flexWrap: "wrap" }}>
          <span>ค่าธรรมเนียมรวม VAT <b style={{ color: "#b45309" }}>{fmt(feeWithVat)}</b> (ตัดจากบัญชี)</span>
          <span>สุทธิเข้าบัญชี <b style={{ color: "#166534" }}>{fmt(net)}</b></span>
          <span>หัก ณ ที่จ่ายให้ธนาคาร <b style={{ color: "#b91c1c" }}>{fmt(wht)}</b></span>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>2️⃣ จับคู่รายการรับชำระที่ลูกค้ารูดบัตร</div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>วันที่รับชำระ</span>
          <input type="date" value={candFrom} onChange={(e) => setCandFrom(e.target.value)} style={{ ...inp, width: 150 }} />
          <span style={{ fontSize: 12 }}>ถึง</span>
          <input type="date" value={candTo} onChange={(e) => setCandTo(e.target.value)} style={{ ...inp, width: 150 }} />
          <button onClick={loadCands} disabled={candLoading} style={btn("#0369a1")}>{candLoading ? "กำลังโหลด…" : "🔍 ค้นหา"}</button>
          <span style={{ marginLeft: "auto", fontSize: 13 }}>
            เลือก <b>{selected.length}</b> รายการ รวมยอดรูด <b style={{ color: "#1d4ed8" }}>{fmt(selTotal)}</b>
            {gross > 0 && <> / ใบเสร็จ {fmt(gross)} <b style={{ color: Math.abs(diff) < 0.01 ? "#059669" : "#b45309" }}>{Math.abs(diff) < 0.01 ? "✓ ตรง" : `(ต่าง ${fmt(diff)})`}</b></>}
            {selFee > 0 && <span style={{ color: "#6b7280" }}> · ค่าธรรมเนียมที่เก็บลูกค้า {fmt(selFee)}</span>}
          </span>
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}></th><th style={th}>วันที่รับชำระ</th><th style={th}>ประเภท</th><th style={th}>เลขเอกสาร / ใบเสร็จ</th><th style={th}>ลูกค้า</th><th style={th}>สาขา</th><th style={{ ...th, textAlign: "right" }}>ยอดรูด</th><th style={{ ...th, textAlign: "right" }}>ค่าธรรมเนียมที่บวก</th></tr></thead>
            <tbody>
              {cands.map((c) => {
                const k = keyOf(c); const on = !!sel[k];
                return (
                  <tr key={k} onClick={() => setSel((s) => ({ ...s, [k]: !on }))} style={{ background: on ? "#eff6ff" : "#fff", cursor: "pointer" }}>
                    <td style={td}><input type="checkbox" checked={on} onChange={() => setSel((s) => ({ ...s, [k]: !on }))} onClick={(e) => e.stopPropagation()} /></td>
                    <td style={td}>{fmtDate(c.paid_date)}</td>
                    <td style={td}>{c.source === "sale" ? "ขายรถ NEW" : "อะไหล่/บริการ"}</td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{c.doc_no}{c.receipt_no && c.receipt_no !== c.doc_no ? <div style={{ fontSize: 11, color: "#6b7280" }}>{c.receipt_no}</div> : null}{c.source === "part" && c.detail ? <div style={{ fontSize: 11, color: "#6b7280" }}>{c.detail}</div> : null}</td>
                    <td style={td}>{c.customer_name || "-"}{c.source === "sale" && c.detail ? <div style={{ fontSize: 11, color: "#6b7280" }}>{c.detail}</div> : null}</td>
                    <td style={td}>{String(c.branch_code || "").split(" ")[0] || "-"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt(c.gross)}</td>
                    <td style={{ ...td, textAlign: "right", color: "#b45309" }}>{fmt(c.card_fee)}</td>
                  </tr>
                );
              })}
              {cands.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#9ca3af" }}>{candLoading ? "กำลังโหลด…" : "ไม่พบรายการรับชำระที่รูดบัตรในช่วงวันที่ (ที่ยังไม่จับคู่)"}</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={save} disabled={saving} style={btn("#15803d")}>{saving ? "กำลังบันทึก…" : "💾 บันทึกค่าธรรมเนียมรูดบัตร"}</button>
          <button onClick={() => { setForm(EMPTY()); setSel({}); setMsg(""); }} style={btn("#6b7280")}>ล้างฟอร์ม</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>📋 ประวัติที่บันทึก</div>
          <input type="date" value={histFrom} onChange={(e) => setHistFrom(e.target.value)} style={{ ...inp, width: 150 }} />
          <span style={{ fontSize: 12 }}>ถึง</span>
          <input type="date" value={histTo} onChange={(e) => setHistTo(e.target.value)} style={{ ...inp, width: 150 }} />
          <button onClick={loadRows} style={btn("#0369a1")}>แสดง</button>
          <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> แสดงที่ยกเลิก</label>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>เลขที่</th><th style={th}>วันที่ใบเสร็จ</th><th style={th}>ธนาคาร / ใบเสร็จ</th><th style={th}>บัญชีที่เงินเข้า</th><th style={{ ...th, textAlign: "right" }}>ยอดรูด</th><th style={{ ...th, textAlign: "right" }}>ค่าธรรมเนียม</th><th style={{ ...th, textAlign: "right" }}>VAT</th><th style={{ ...th, textAlign: "right" }}>สุทธิเข้า</th><th style={{ ...th, textAlign: "right" }}>หัก ณ ที่จ่าย</th><th style={th}>จับคู่</th><th style={th}></th></tr></thead>
            <tbody>
              {shownRows.map((r) => (
                <tr key={r.id} style={{ color: r.status === "cancelled" ? "#9ca3af" : "#111", textDecoration: r.status === "cancelled" ? "line-through" : "none" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{r.doc_no}<div style={{ fontSize: 11, color: "#6b7280" }}>{r.affiliation || ""}</div></td>
                  <td style={td}>{fmtDate(r.bank_receipt_date)}</td>
                  <td style={td}>{r.bank_name || "-"}<div style={{ fontSize: 11, color: "#6b7280" }}>{r.bank_receipt_no || "-"}{r.merchant_no ? ` · ร้านค้า ${r.merchant_no}` : ""}</div></td>
                  <td style={td}>{r.account_name || "-"}{r.account_no ? <div style={{ fontSize: 11, color: "#6b7280" }}>{r.account_no}</div> : null}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.gross_amount)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.fee_amount)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.vat_amount)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#166534" }}>{fmt(r.net_amount)}</td>
                  <td style={{ ...td, textAlign: "right", color: "#b91c1c" }}>{fmt(r.wht_amount)}</td>
                  <td style={td}><button onClick={() => setDetail(r)} style={{ ...btn("#e0e7ff"), color: "#3730a3", padding: "4px 10px", fontSize: 12 }}>{itemsOf(r).length} รายการ · {fmt(r.matched_total)}</button></td>
                  <td style={td}>{r.status === "active" && <button onClick={() => cancel(r)} style={{ ...btn("#fee2e2"), color: "#b91c1c", padding: "4px 10px", fontSize: 12 }}>ยกเลิก</button>}</td>
                </tr>
              ))}
              {shownRows.length === 0 && <tr><td colSpan={11} style={{ ...td, textAlign: "center", color: "#9ca3af" }}>ยังไม่มีรายการ</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, width: "min(760px, 94vw)", maxHeight: "85vh", overflowY: "auto", fontFamily: "Tahoma" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>รายการที่จับคู่กับ {detail.doc_no} · ใบเสร็จธนาคาร {detail.bank_receipt_no || "-"}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>วันที่รับชำระ</th><th style={th}>ประเภท</th><th style={th}>เลขเอกสาร</th><th style={th}>ลูกค้า</th><th style={{ ...th, textAlign: "right" }}>ยอดรูด</th><th style={{ ...th, textAlign: "right" }}>ค่าธรรมเนียมที่บวก</th></tr></thead>
              <tbody>
                {itemsOf(detail).map((it, i) => (
                  <tr key={i}><td style={td}>{fmtDate(it.paid_date)}</td><td style={td}>{it.source === "sale" ? "ขายรถ NEW" : "อะไหล่/บริการ"}</td><td style={{ ...td, fontFamily: "monospace" }}>{it.doc_no}{it.receipt_no && it.receipt_no !== it.doc_no ? <div style={{ fontSize: 11, color: "#6b7280" }}>{it.receipt_no}</div> : null}</td><td style={td}>{it.customer_name || "-"}</td><td style={{ ...td, textAlign: "right" }}>{fmt(it.gross)}</td><td style={{ ...td, textAlign: "right" }}>{fmt(it.card_fee)}</td></tr>
                ))}
                {itemsOf(detail).length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#9ca3af" }}>ไม่ได้จับคู่รายการ</td></tr>}
              </tbody>
            </table>
            <div style={{ marginTop: 10, fontSize: 13 }}>รวมยอดรูดที่จับคู่ <b>{fmt(detail.matched_total)}</b> · ใบเสร็จธนาคาร {fmt(detail.gross_amount)} · ค่าธรรมเนียม {fmt(detail.fee_amount)} + VAT {fmt(detail.vat_amount)} · สุทธิเข้า {fmt(detail.net_amount)} · หัก ณ ที่จ่าย {fmt(detail.wht_amount)}</div>
            {detail.note && <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 4 }}>หมายเหตุ: {detail.note}</div>}
            <div style={{ textAlign: "right", marginTop: 12 }}><button onClick={() => setDetail(null)} style={btn("#6b7280")}>ปิด</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
