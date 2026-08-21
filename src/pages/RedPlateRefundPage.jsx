import React, { useEffect, useMemo, useState } from "react";

// คืนมัดจำป้ายแดง (2026-08-21) — รายการป้ายแดงค้างคืนจากใบขาย NEW (retail_sales.red_plate_deposit → red_plate_deposits)
// กดคืนเงิน → refund_red_plate (ออกเลข RPR-) + แจ้งลูกค้าทาง LINE (send_red_plate_refund_flex) + พิมพ์ใบคืนเงินได้
const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const RETAIL_API = `${BASE}/retail-sale-api`;
const ACC_API = `${BASE}/accounting-api`;

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return t; }
}
const asArray = (d) => (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []);
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const baht = (n) => num(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const thaiDate = (iso) => {
  if (!iso) return "-";
  const s = String(iso).slice(0, 10); const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${Number(d)}/${Number(m)}/${Number(y) + 543}`;
};

export default function RedPlateRefundPage({ currentUser }) {
  const [tab, setTab] = useState("held");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [dateFrom, setDateFrom] = useState(() => todayStr().slice(0, 8) + "01");
  const [dateTo, setDateTo] = useState(todayStr());
  const [message, setMessage] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [modal, setModal] = useState(null); // แถวที่กำลังคืนเงิน
  const [form, setForm] = useState({ refund_date: todayStr(), refund_amount: "", method: "cash", account_id: "", note: "", notify: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    post(ACC_API, { action: "list_bank_accounts", include_inactive: "false" })
      .then((d) => setBankAccounts(asArray(d).filter((a) => a.account_type !== "เงินสดย่อย" && a.account_type !== "ลูกหนี้")))
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true); setMessage("");
    try {
      const body = { action: "list_red_plate_deposits", status: tab, keyword: keyword.trim() };
      if (tab === "refunded") { body.date_from = dateFrom; body.date_to = dateTo; }
      const d = await post(RETAIL_API, body);
      setRows(asArray(d));
    } catch (e) { setMessage("❌ โหลดไม่สำเร็จ: " + (e.message || e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const total = useMemo(() => rows.reduce((s, r) => s + num(tab === "refunded" ? r.refund_amount : r.amount), 0), [rows, tab]);

  function openRefund(r) {
    setModal(r);
    setForm({ refund_date: todayStr(), refund_amount: String(num(r.amount)), method: "cash", account_id: "", note: "", notify: !!(r.line_user_id || r.sale_line_user_id) });
  }

  async function confirmRefund() {
    if (!modal || saving) return;
    const amt = num(form.refund_amount);
    if (!(amt > 0)) { setMessage("❌ กรอกยอดคืน"); return; }
    if (amt > num(modal.amount)) { setMessage("❌ ยอดคืนเกินยอดมัดจำ"); return; }
    const acc = form.method === "transfer" ? bankAccounts.find((a) => String(a.account_id) === String(form.account_id)) : null;
    if (form.method === "transfer" && !acc) { setMessage("❌ เลือกบัญชีที่โอนคืน"); return; }
    if (!window.confirm(`ยืนยันคืนเงินมัดจำป้ายแดง ${modal.plate_no || "-"} ให้ ${modal.customer_name || "-"} จำนวน ${baht(amt)} บาท?`)) return;
    setSaving(true); setMessage("");
    try {
      const row = await post(RETAIL_API, {
        action: "refund_red_plate", deposit_no: modal.deposit_no,
        refund_date: form.refund_date, refund_amount: amt,
        refund_method: form.method === "cash" ? "เงินสด" : "เงินโอน",
        refund_account_id: acc ? Number(acc.account_id) : null, refund_account_name: acc?.account_name || null,
        refund_by: currentUser?.username || currentUser?.name || "", refund_note: form.note,
      });
      const dep = row && (row.deposit || row);
      if (!dep || !dep.deposit_no) throw new Error(row?.__error || row?.error || "ไม่พบรายการ หรือคืนไปแล้ว");
      let msg = `✅ คืนเงินมัดจำป้ายแดงแล้ว เลขที่ใบคืน ${dep.refund_doc_no || "-"}`;
      const lid = modal.line_user_id || modal.sale_line_user_id;
      if (form.notify && lid) {
        try {
          await post(RETAIL_API, {
            action: "send_red_plate_refund_flex", line_user_id: lid,
            refund_doc_no: dep.refund_doc_no, deposit_no: dep.deposit_no, refund_date: thaiDate(dep.refund_date),
            customer_name: dep.customer_name, plate_no: dep.plate_no, refund_amount: dep.refund_amount,
            refund_method: dep.refund_method, refund_account_name: dep.refund_account_name, refund_note: dep.refund_note,
            branch_code: dep.branch_code, branch_name: dep.branch_name,
          });
          msg += " · ส่ง LINE แจ้งลูกค้าแล้ว";
        } catch { msg += " · ⚠️ ส่ง LINE ไม่สำเร็จ"; }
      }
      setMessage(msg);
      setModal(null);
      load();
    } catch (e) { setMessage("❌ คืนเงินไม่สำเร็จ: " + (e.message || e)); }
    finally { setSaving(false); }
  }

  function printRefund(r) {
    const esc = (x) => String(x == null ? "" : x).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบคืนเงินมัดจำป้ายแดง ${esc(r.refund_doc_no)}</title>
<style>*{font-family:"Sarabun","TH Sarabun New",Tahoma,sans-serif;box-sizing:border-box}body{margin:0;padding:18px;font-size:13px;color:#222}
.wrap{max-width:760px;margin:0 auto}.h{display:flex;justify-content:space-between;align-items:flex-start}.t{font-size:20px;font-weight:800;color:#0f766e}
table{width:100%;border-collapse:collapse;margin-top:10px}td{border:1px solid #0f766e;padding:6px 8px}.sec{background:#e6f4f1;color:#0f766e;font-weight:700;text-align:center}
.r{text-align:right}.c{text-align:center}.tot{font-size:15px;font-weight:800;color:#0f766e}.foot{display:flex;justify-content:space-between;margin-top:50px;padding:0 30px}
.sg{text-align:center;width:40%;border-top:1px dotted #888;padding-top:4px;color:#666}@media print{body{padding:0}}</style></head><body><div class="wrap">
<div class="h"><div><div style="font-weight:700;font-size:15px">${esc(r.branch_name || "")}</div><div style="color:#666">สาขา ${esc(r.branch_code || "-")}</div></div>
<div style="text-align:right"><div class="t">ใบคืนเงินมัดจำป้ายแดง</div><div>เลขที่ ${esc(r.refund_doc_no || "-")}</div><div>วันที่ ${esc(thaiDate(r.refund_date))}</div></div></div>
<table><tr><td class="sec" style="width:30%">ลูกค้า</td><td>${esc(r.customer_name || "-")}${r.customer_phone ? " · " + esc(r.customer_phone) : ""}</td></tr>
<tr><td class="sec">อ้างอิงใบรับมัดจำ</td><td>${esc(r.deposit_no)} (รับเมื่อ ${esc(thaiDate(r.received_date))})</td></tr>
<tr><td class="sec">อ้างอิงใบขาย</td><td>${esc(r.sale_no || "-")}${r.model_name ? " · " + esc(r.model_name) : ""}${r.model_color ? " " + esc(r.model_color) : ""}${r.engine_no ? " · เครื่อง " + esc(r.engine_no) : ""}</td></tr>
<tr><td class="sec">ทะเบียนป้ายแดง</td><td style="font-weight:700">${esc(r.plate_no || "-")}</td></tr>
<tr><td class="sec">วิธีคืนเงิน</td><td>${esc(r.refund_method || "-")}${r.refund_account_name ? " · " + esc(r.refund_account_name) : ""}</td></tr>
${r.refund_note ? `<tr><td class="sec">หมายเหตุ</td><td>${esc(r.refund_note)}</td></tr>` : ""}
<tr><td class="r tot">รวมคืนเงิน</td><td class="r tot">${baht(r.refund_amount)} บาท</td></tr></table>
<div class="foot"><div class="sg">ผู้จ่ายเงิน (${esc(r.refund_by || "")})</div><div class="sg">ผู้รับเงินคืน / ลูกค้า</div></div>
</div><script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open("", "_blank"); if (!w) return; w.document.write(html); w.document.close();
  }

  const th = { padding: "8px 6px", fontSize: 13, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff" };
  const td = { padding: "8px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
  const inp = { padding: "7px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14 };
  const tabBtn = (k, label) => (
    <button onClick={() => setTab(k)} style={{ padding: "8px 18px", borderRadius: 8, border: tab === k ? "2px solid #072d6b" : "2px solid #d1d5db", background: tab === k ? "#072d6b" : "#fff", color: tab === k ? "#fff" : "#072d6b", fontWeight: 700, fontFamily: "Tahoma", cursor: "pointer" }}>{label}</button>
  );

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1200 }}>
      <h2 style={{ margin: "0 0 12px", color: "#072d6b" }}>🔴 คืนมัดจำป้ายแดง</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {tabBtn("held", "ป้ายค้างคืน")}{tabBtn("refunded", "คืนแล้ว")}
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="ค้นหา ทะเบียน / ชื่อลูกค้า / เบอร์ / เลขใบขาย" style={{ ...inp, width: 300 }} />
        {tab === "refunded" && (<>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inp} />
          <span>ถึง</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inp} />
        </>)}
        <button onClick={load} disabled={loading} style={{ padding: "8px 18px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer" }}>{loading ? "กำลังโหลด..." : "🔍 ค้นหา"}</button>
        <span style={{ marginLeft: "auto", fontSize: 14 }}>{rows.length} รายการ · รวม <b style={{ color: tab === "held" ? "#b91c1c" : "#0f766e" }}>{baht(total)}</b> บาท</span>
      </div>
      {message && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: message.startsWith("❌") ? "#fef2f2" : "#f0fdf4", border: message.startsWith("❌") ? "1px solid #fecaca" : "1px solid #bbf7d0", fontSize: 14 }}>{message}</div>}

      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>เลขที่ใบรับมัดจำ</th><th style={th}>วันที่รับ</th>
            {tab === "held" ? <th style={th}>ค้าง (วัน)</th> : <><th style={th}>เลขที่ใบคืน</th><th style={th}>วันที่คืน</th></>}
            <th style={th}>ทะเบียนป้ายแดง</th><th style={th}>ลูกค้า</th><th style={th}>รถ</th><th style={th}>ใบขาย</th><th style={th}>สาขา</th>
            <th style={{ ...th, textAlign: "right" }}>{tab === "held" ? "มัดจำ" : "ยอดคืน"}</th>
            {tab === "refunded" && <th style={th}>วิธีคืน / ผู้คืน</th>}
            <th style={th}></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={12} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 24 }}>{loading ? "กำลังโหลด..." : tab === "held" ? "ไม่มีป้ายแดงค้างคืน" : "ไม่มีรายการคืนในช่วงนี้"}</td></tr>}
            {rows.map((r) => {
              const days = num(r.days_held);
              const late = tab === "held" && days >= 45;
              return (
                <tr key={r.deposit_no} style={{ background: late ? "#fff7ed" : "#fff" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{r.deposit_no}</td>
                  <td style={td}>{thaiDate(r.received_date)}</td>
                  {tab === "held"
                    ? <td style={{ ...td, fontWeight: 700, color: late ? "#c2410c" : "#374151" }}>{days}{late ? " ⚠️" : ""}</td>
                    : <><td style={{ ...td, fontFamily: "monospace" }}>{r.refund_doc_no || "-"}</td><td style={td}>{thaiDate(r.refund_date)}</td></>}
                  <td style={{ ...td, fontWeight: 700, color: "#b91c1c", fontSize: 15 }}>{r.plate_no || "-"}</td>
                  <td style={td}>{r.customer_name || "-"}{(r.customer_phone || r.sale_phone) && <div style={{ fontSize: 12, color: "#6b7280" }}>{r.customer_phone || r.sale_phone}</div>}{(r.line_user_id || r.sale_line_user_id) && <span style={{ fontSize: 11, color: "#16a34a" }}> LINE ✓</span>}</td>
                  <td style={td}>{[r.brand, r.model_name, r.model_color].filter(Boolean).join(" ")}{r.engine_no && <div style={{ fontSize: 12, color: "#6b7280" }}>เครื่อง {r.engine_no}</div>}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.sale_no}<div style={{ color: "#6b7280" }}>{thaiDate(r.sale_date)}</div></td>
                  <td style={td}>{r.branch_name || r.branch_code || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{baht(tab === "held" ? r.amount : r.refund_amount)}</td>
                  {tab === "refunded" && <td style={td}>{r.refund_method || "-"}{r.refund_account_name ? ` · ${r.refund_account_name}` : ""}<div style={{ fontSize: 12, color: "#6b7280" }}>{r.refund_by || ""}{r.refund_note ? ` · ${r.refund_note}` : ""}</div></td>}
                  <td style={td}>
                    {tab === "held"
                      ? <button onClick={() => openRefund(r)} style={{ padding: "6px 14px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>↩️ คืนเงิน</button>
                      : <button onClick={() => printRefund(r)} style={{ padding: "6px 12px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma" }}>🖨️ ใบคืนเงิน</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>ใบรับมัดจำป้ายแดง (RPD-) ออกอัตโนมัติตอนรับชำระเงินใบขาย NEW ที่กรอกทะเบียนป้ายแดง · แถวสีส้ม = ค้างคืนเกิน 45 วัน</div>

      {modal && (
        <div onClick={() => !saving && setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: 460, maxWidth: "95vw", fontFamily: "Tahoma" }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#0f766e", marginBottom: 10 }}>↩️ คืนเงินมัดจำป้ายแดง</div>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 14, marginBottom: 12 }}>
              <div>ใบรับมัดจำ <b>{modal.deposit_no}</b> · ทะเบียน <b style={{ color: "#b91c1c", fontSize: 16 }}>{modal.plate_no || "-"}</b></div>
              <div>ลูกค้า <b>{modal.customer_name || "-"}</b> · ใบขาย {modal.sale_no}</div>
              <div>มัดจำไว้ <b>{baht(modal.amount)}</b> บาท (รับเมื่อ {thaiDate(modal.received_date)} · ค้าง {num(modal.days_held)} วัน)</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 12px", alignItems: "center", fontSize: 14 }}>
              <label>วันที่คืน</label><input type="date" value={form.refund_date} onChange={(e) => setForm((f) => ({ ...f, refund_date: e.target.value }))} style={inp} />
              <label>ยอดคืน</label><input type="number" value={form.refund_amount} onChange={(e) => setForm((f) => ({ ...f, refund_amount: e.target.value }))} style={{ ...inp, textAlign: "right" }} />
              <label>วิธีคืน</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["cash", "💵 เงินสด"], ["transfer", "🏦 เงินโอน"]].map(([k, l]) => (
                  <button key={k} onClick={() => setForm((f) => ({ ...f, method: k }))} style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer", background: form.method === k ? "#072d6b" : "#fff", color: form.method === k ? "#fff" : "#072d6b", border: form.method === k ? "2px solid #072d6b" : "2px solid #d1d5db" }}>{l}</button>
                ))}
              </div>
              {form.method === "transfer" && (<>
                <label>บัญชีที่โอน</label>
                <select value={form.account_id} onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))} style={inp}>
                  <option value="">— เลือกบัญชี —</option>
                  {bankAccounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name}{a.bank_name ? ` (${a.bank_name})` : ""}</option>)}
                </select>
              </>)}
              <label>หมายเหตุ</label><input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="เช่น ป้ายชำรุด หักค่าเสียหาย" style={inp} />
              <span></span>
              <label style={{ fontSize: 13 }}>
                <input type="checkbox" checked={form.notify} disabled={!(modal.line_user_id || modal.sale_line_user_id)} onChange={(e) => setForm((f) => ({ ...f, notify: e.target.checked }))} />
                {" "}ส่ง LINE แจ้งลูกค้าว่าคืนเงินแล้ว{!(modal.line_user_id || modal.sale_line_user_id) && <span style={{ color: "#9ca3af" }}> (ลูกค้าไม่มี LINE)</span>}
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={confirmRefund} disabled={saving} style={{ flex: 1, padding: "11px 0", background: saving ? "#9ca3af" : "#0f766e", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{saving ? "กำลังบันทึก..." : "✅ ยืนยันคืนเงิน"}</button>
              <button onClick={() => setModal(null)} disabled={saving} style={{ padding: "11px 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, fontFamily: "Tahoma", cursor: "pointer" }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
