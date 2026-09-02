import React, { useEffect, useMemo, useState } from "react";

// บันทึกคืนเงินค่าเบี้ยประกัน (user 2026-09-01) — ดึงรายการ "บันทึกค่าใช้จ่ายเพิ่มเติมงาน พรบ."
// เฉพาะยอดติดลบ (ยกเลิก พรบ. ฯลฯ = เงินต้องคืนลูกค้า) มาบันทึกคืนเงิน เงินสด/เงินโอน
// คืนเงินสด → ขึ้นแถวหักเงินสดในหน้าสรุปรายวันรับเงิน
const REG_API = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";
const REFUND_API = "https://n8n-new-project-gwf2.onrender.com/webhook/insurance-refund-api";
const ACC_API = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return {}; }
}
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const baht = (n) => num(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const thaiDate = (iso) => {
  if (!iso) return "-";
  const s = String(iso).slice(0, 10); const [y, m, d] = s.split("-");
  return y && m && d ? `${Number(d)}/${Number(m)}/${Number(y) + 543}` : s;
};
const unwrapList = (d) => { try { return typeof d?.listjson === "string" ? JSON.parse(d.listjson) : Array.isArray(d) ? d : []; } catch { return []; } };

export default function InsuranceRefundPage({ currentUser }) {
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const [extras, setExtras] = useState([]);     // รายการค่าใช้จ่ายเพิ่มเติม (เฉพาะติดลบ)
  const [refunds, setRefunds] = useState([]);   // ประวัติคืนเงิน
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [modal, setModal] = useState(null); // {extra, form}
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    post(ACC_API, { action: "list_bank_accounts", include_inactive: "false" })
      .then((d) => setBankAccounts((Array.isArray(d) ? d : []).filter((a) => a && a.account_id && a.account_type !== "เงินสดย่อย" && a.account_type !== "ลูกหนี้")))
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true); setMessage("");
    try {
      const [ex, rf] = await Promise.all([
        post(REG_API, { action: "list_motoinsurance_extra" }),
        post(REFUND_API, { action: "list_refunds" }),
      ]);
      // รายการเก่าก่อน ส.ค. 69 ไม่ต้องขึ้นเลย (เคลียร์นอกระบบไปแล้ว — user 2026-09-01) เอาเฉพาะยุคระบบ NEW
      setExtras((Array.isArray(ex) ? ex : []).filter((r) => r && r.id && r.active !== false && num(r.expense_amount) < 0 && String(r.created_at || "").slice(0, 10) >= "2026-08-01"));
      setRefunds(unwrapList(rf).filter((r) => r && r.id));
    } catch { setMessage("❌ โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  const refundOf = (extraId) => refunds.find((r) => Number(r.extra_id) === Number(extraId) && r.status === "ปกติ");
  const pending = useMemo(() => extras.filter((e) => !refundOf(e.id)), [extras, refunds]); // eslint-disable-line
  const totalPending = pending.reduce((s, e) => s + Math.abs(num(e.expense_amount)), 0);

  async function openRefund(e) {
    const form = {
      refund_date: todayStr(),
      refund_amount: String(Math.abs(num(e.expense_amount))),
      method: "เงินสด", account_id: "",
      customer_name: "", note: e.note || "",
    };
    setModal({ extra: e, form });
    // เติมชื่อลูกค้าจากผู้เอาประกันของกรมธรรม์ — เลขตรงเป๊ะก่อน ไม่เจอค่อยค้นด้วยเลขต้น (เผื่อคีย์เลขท้ายผิด เช่น …6084 แทน …6080)
    const policy = String(e.original_policy_no || "").trim();
    if (policy) {
      try {
        let hit = null;
        const d = await post(REG_API, { action: "get_insurance_list", search: policy });
        hit = (Array.isArray(d) ? d : []).find((x) => x && x.policy_no === policy);
        if (!hit && policy.length >= 10) {
          const prefix = policy.slice(0, policy.length - 3);
          const d2 = await post(REG_API, { action: "get_insurance_list", search: prefix });
          hit = (Array.isArray(d2) ? d2 : []).find((x) => x && String(x.policy_no || "").startsWith(prefix) && x.insured_name);
        }
        if (hit?.insured_name) {
          const nearMiss = hit.policy_no !== policy;
          setModal((m) => (m && m.extra.id === e.id ? {
            ...m,
            form: { ...m.form, customer_name: m.form.customer_name || hit.insured_name,
              note: nearMiss && !String(m.form.note || "").includes(hit.policy_no) ? [m.form.note, `กรมธรรม์ในระบบ ${hit.policy_no}`].filter(Boolean).join(" · ") : m.form.note },
          } : m));
        }
      } catch { /* ไม่เจอก็พิมพ์เอง */ }
    }
  }

  async function confirmRefund() {
    if (!modal || saving) return;
    const f = modal.form, e = modal.extra;
    const amt = num(f.refund_amount);
    if (!(amt > 0)) { setMessage("❌ กรอกยอดเงินคืน"); return; }
    const acc = f.method === "เงินโอน" ? bankAccounts.find((a) => String(a.account_id) === String(f.account_id)) : null;
    if (f.method === "เงินโอน" && !acc) { setMessage("❌ เลือกบัญชีที่โอนคืน"); return; }
    if (!window.confirm(`ยืนยันคืนเงินค่าเบี้ยประกัน ${baht(amt)} บาท (${f.method})\nกรมธรรม์ ${e.original_policy_no || "-"} · ${f.customer_name || "-"}?`)) return;
    setSaving(true); setMessage("");
    try {
      const r = await post(REFUND_API, {
        action: "save_refund", extra_id: e.id,
        policy_no: e.original_policy_no || "", customer_name: f.customer_name.trim(),
        refund_amount: amt, refund_date: f.refund_date,
        method: f.method, account_name: acc ? acc.account_name : "",
        branch_code: myBranch, note: f.note.trim(),
        refund_by: currentUser?.username || currentUser?.name || "system",
      });
      if (!r || !r.id) throw new Error(r?.__error || "บันทึกไม่สำเร็จ (อาจคืนไปแล้ว หรือยัง import workflow insurance-refund-api)");
      setMessage(`✅ บันทึกคืนเงิน ${baht(amt)} บาท (${f.method}) แล้ว${f.method === "เงินสด" ? " — ขึ้นเป็นยอดหักเงินสดในสรุปรายวันรับเงิน" : ""}`);
      setModal(null); load();
    } catch (err) { setMessage("❌ " + (err.message || err)); }
    setSaving(false);
  }

  // ปิดรายการโดยไม่คืนเงิน (เช่น เคลียร์กับลูกค้าไปแล้ว/รายการเก่าไม่ต้องคืน) — บันทึกลงประวัติ method "ไม่ต้องคืน" ไม่หักเงินสด
  async function markNoRefund(e) {
    const reason = window.prompt(`ปิดรายการ ${e.original_policy_no || "-"} (${baht(Math.abs(num(e.expense_amount)))} บาท) โดยไม่คืนเงิน\nเหตุผล:`, "รายการเก่า ไม่ต้องคืนลูกค้า");
    if (reason == null) return;
    try {
      const r = await post(REFUND_API, {
        action: "save_refund", extra_id: e.id,
        policy_no: e.original_policy_no || "", customer_name: "",
        refund_amount: Math.abs(num(e.expense_amount)), refund_date: todayStr(),
        method: "ไม่ต้องคืน", account_name: "", branch_code: myBranch,
        note: reason.trim(), refund_by: currentUser?.username || currentUser?.name || "system",
      });
      if (!r || !r.id) throw new Error(r?.__error || "บันทึกไม่สำเร็จ");
      setMessage(`✅ ปิดรายการ ${e.original_policy_no || "-"} แบบไม่คืนเงินแล้ว`); load();
    } catch (err) { setMessage("❌ " + (err.message || err)); }
  }

  async function cancelRefund(r) {
    if (!window.confirm(`ยกเลิกรายการคืนเงิน ${baht(r.refund_amount)} บาท (กรมธรรม์ ${r.policy_no || "-"})?`)) return;
    try {
      const d = await post(REFUND_API, { action: "cancel_refund", id: r.id, cancelled_by: currentUser?.username || currentUser?.name || "system" });
      if (!d || !d.id) throw new Error(d?.__error || "ยกเลิกไม่สำเร็จ");
      setMessage("✅ ยกเลิกรายการคืนเงินแล้ว — รายการกลับมารอคืนอีกครั้ง"); load();
    } catch (err) { setMessage("❌ " + (err.message || err)); }
  }

  const inp = { padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" };
  const th = { padding: "8px 6px", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff" };
  const td = { padding: "8px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1150 }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>💸 บันทึกคืนเงินค่าเบี้ยประกัน</h2>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
        รายการจาก "บันทึกค่าใช้จ่ายเพิ่มเติมงาน พรบ." เฉพาะยอด<b style={{ color: "#b91c1c" }}>ติดลบ</b> (เงินต้องคืนลูกค้า) ·
        คืน<b>เงินสด</b>จะขึ้นเป็นยอดหักเงินสดในหน้าสรุปรายวันรับเงินอัตโนมัติ
      </div>
      {message && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, fontSize: 14, background: message.startsWith("✅") ? "#f0fdf4" : "#fef2f2", border: message.startsWith("✅") ? "1px solid #bbf7d0" : "1px solid #fecaca" }}>{message}</div>}

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>🔴 รอคืนเงิน ({pending.length}) · รวม {baht(totalPending)} บาท</div>
          <button onClick={load} disabled={loading} style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>{loading ? "⏳" : "🔄"}</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>วันที่บันทึก</th><th style={th}>ประเภท</th><th style={th}>เลขกรมธรรม์</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดต้องคืน</th><th style={th}>หมายเหตุ</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {pending.map((e) => (
                <tr key={e.id}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(e.created_at)}</td>
                  <td style={td}>{e.expense_type || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{e.original_policy_no || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>{baht(Math.abs(num(e.expense_amount)))}</td>
                  <td style={{ ...td, fontSize: 12.5, maxWidth: 320 }}>{e.note || "-"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <button onClick={() => openRefund(e)}
                      style={{ padding: "6px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>↩️ คืนเงิน</button>
                    <button onClick={() => markNoRefund(e)} title="ปิดรายการโดยไม่คืนเงิน (เช่น เคลียร์ไปแล้ว/ไม่มีลูกค้ามารับ)"
                      style={{ marginLeft: 6, padding: "6px 12px", background: "#fff", color: "#6b7280", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontSize: 12.5 }}>ไม่ต้องคืน</button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && !loading && (
                <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>— ไม่มีรายการรอคืนเงิน —</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>📋 ประวัติคืนเงิน ({refunds.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>วันที่คืน</th><th style={th}>เลขกรมธรรม์</th><th style={th}>ลูกค้า</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดคืน</th><th style={th}>วิธีคืน</th><th style={th}>สาขา</th>
              <th style={th}>หมายเหตุ</th><th style={th}>ผู้บันทึก</th><th style={th}>สถานะ</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id} style={{ opacity: r.status === "ยกเลิก" ? 0.55 : 1 }}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(r.refund_date)}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.policy_no || "-"}</td>
                  <td style={td}>{r.customer_name || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#c2410c" }}>{baht(r.refund_amount)}</td>
                  <td style={td}>{r.method}{r.account_name ? ` · ${r.account_name}` : ""}</td>
                  <td style={td}>{r.branch_code || "-"}</td>
                  <td style={{ ...td, fontSize: 12.5, maxWidth: 260 }}>{r.note || "-"}</td>
                  <td style={td}>{r.refund_by || "-"}</td>
                  <td style={td}>{r.status}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {r.status === "ปกติ" && (
                      <button onClick={() => cancelRefund(r)}
                        style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #ef4444", background: "#fff", color: "#b91c1c", cursor: "pointer", fontSize: 12 }}>✖ ยกเลิก</button>
                    )}
                  </td>
                </tr>
              ))}
              {refunds.length === 0 && !loading && (
                <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>— ยังไม่มีประวัติคืนเงิน —</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div onClick={() => !saving && setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: 460, maxWidth: "95vw", fontFamily: "Tahoma" }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#0f766e", marginBottom: 10 }}>↩️ คืนเงินค่าเบี้ยประกัน</div>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 13.5, marginBottom: 12 }}>
              {modal.extra.expense_type || "-"} · กรมธรรม์ <b style={{ fontFamily: "monospace" }}>{modal.extra.original_policy_no || "-"}</b><br />
              ยอดต้องคืน <b style={{ color: "#b91c1c" }}>{baht(Math.abs(num(modal.extra.expense_amount)))}</b> บาท
              {modal.extra.note ? <div style={{ color: "#6b7280", fontSize: 12.5 }}>{modal.extra.note}</div> : null}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 12px", alignItems: "center", fontSize: 14 }}>
              <label>วันที่คืน</label>
              <input type="date" value={modal.form.refund_date} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, refund_date: e.target.value } }))} style={inp} />
              <label>ยอดคืน (บาท)</label>
              <input type="number" min="0" value={modal.form.refund_amount} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, refund_amount: e.target.value } }))} style={{ ...inp, textAlign: "right", fontWeight: 700 }} />
              <label>ชื่อลูกค้า</label>
              <input value={modal.form.customer_name} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, customer_name: e.target.value } }))} placeholder="เติมให้จากผู้เอาประกัน (แก้ได้)" style={inp} />
              <label>วิธีคืนเงิน</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["เงินสด", "เงินโอน"].map((k) => (
                  <button key={k} onClick={() => setModal((m) => ({ ...m, form: { ...m.form, method: k } }))}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer",
                      background: modal.form.method === k ? "#072d6b" : "#fff", color: modal.form.method === k ? "#fff" : "#072d6b",
                      border: modal.form.method === k ? "2px solid #072d6b" : "2px solid #d1d5db" }}>
                    {k === "เงินสด" ? "💵 เงินสด" : "🏦 เงินโอน"}
                  </button>
                ))}
              </div>
              {modal.form.method === "เงินโอน" && (<>
                <label>บัญชีที่โอน</label>
                <select value={modal.form.account_id} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, account_id: e.target.value } }))} style={inp}>
                  <option value="">— เลือกบัญชี —</option>
                  {bankAccounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name}{a.bank_name ? ` (${a.bank_name})` : ""}</option>)}
                </select>
              </>)}
              <label>หมายเหตุ</label>
              <input value={modal.form.note} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, note: e.target.value } }))} style={inp} />
            </div>
            {modal.form.method === "เงินสด" && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 10px" }}>
                💵 คืนเงินสด — จะขึ้นเป็นแถวหักเงินสดในหน้าสรุปรายวันรับเงินของสาขา {myBranch || "-"} วันที่คืน
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={confirmRefund} disabled={saving}
                style={{ flex: 1, padding: "11px 0", background: saving ? "#9ca3af" : "#0f766e", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                {saving ? "กำลังบันทึก..." : "✅ ยืนยันคืนเงิน"}
              </button>
              <button onClick={() => setModal(null)} disabled={saving}
                style={{ padding: "11px 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, fontFamily: "Tahoma", cursor: "pointer" }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
