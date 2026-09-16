import React, { useEffect, useMemo, useState } from "react";

// หัก ณ ที่จ่าย ค่าใช้จ่าย รอรับคืน (user 2026-09-14)
// กรณีจ่ายค่าใช้จ่ายเต็มจำนวนไปก่อน (ยังไม่หัก ณ ที่จ่าย) แล้วผู้ขายส่งเอกสารหัก ณ ที่จ่ายมาทีหลัง → แก้เอกสารใส่ WHT
// → ยอดที่จ่ายเกิน = หัก ณ ที่จ่าย รอผู้ขายโอนคืน / หักจากบิลถัดไป — หน้านี้แสดงรายการรอรับคืน + บันทึกรับคืน
// รับคืนเป็น "เงินโอน" → ขึ้นรายงานเคลื่อนไหวบัญชี (CTE whtref_movements ใน Accounting API); "เงินสด" → แถวรับเงินสดในสรุปรายวันรับเงิน
const WHT_REFUND_API = "https://n8n-new-project-gwf2.onrender.com/webhook/wht-refund-api";
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
const METHODS = ["เงินโอน", "เงินสด", "หักจากบิลถัดไป", "ไม่ต้องคืน"];

export default function WhtRefundPage({ currentUser }) {
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const [pending, setPending] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [modal, setModal] = useState(null); // { doc, form }
  const [saving, setSaving] = useState(false);
  const [affil, setAffil] = useState("");
  // เพิ่มรายการรอรับคืนเอง (ยอดยกมา / เอกสารนอกระบบ) — user 2026-09-16
  const [manual, setManual] = useState(null); // form
  const [search, setSearch] = useState("");

  useEffect(() => {
    post(ACC_API, { action: "list_bank_accounts", include_inactive: "false" })
      .then((d) => setBankAccounts((Array.isArray(d) ? d : []).filter((a) => a && a.account_id && a.account_type !== "เงินสดย่อย" && a.account_type !== "ลูกหนี้")))
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true); setMessage("");
    try {
      const [pd, rf] = await Promise.all([
        post(WHT_REFUND_API, { action: "list_pending" }),
        post(WHT_REFUND_API, { action: "list_refunds" }),
      ]);
      if (pd?.__error || rf?.__error) throw new Error(pd?.__error || rf?.__error);
      // ค่าขนส่ง ไม่เอาเข้ารายการรอรับคืน (user 2026-09-14) — กรองซ้ำฝั่งนี้เผื่อ workflow เก่า
      setPending(unwrapList(pd).filter((r) => r && (r.expense_doc_id || r.manual_id) && !(r.expense_doc_id && String(r.description || "").includes("ค่าขนส่ง"))));
      setRefunds(unwrapList(rf).filter((r) => r && r.id));
    } catch (e) { setMessage("❌ โหลดข้อมูลไม่สำเร็จ (ยัง import workflow wht-refund-api หรือยัง?) " + (e?.message || "")); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  const affils = useMemo(() => [...new Set(pending.map((r) => r.affiliation).filter(Boolean))].sort(), [pending]);
  const shown = useMemo(() => pending.filter((r) => {
    if (affil && r.affiliation !== affil) return false;
    if (search.trim()) {
      const hay = [r.expense_doc_no, r.vendor_name, r.description, r.paid_doc_no, r.reference_no].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  }), [pending, affil, search]);
  const totalPending = shown.reduce((s, r) => s + num(r.refund_due), 0);

  function openRefund(doc) {
    setModal({ doc, form: { refund_date: todayStr(), refund_amount: String(num(doc.refund_due)), method: "เงินโอน", account_id: "", note: "" } });
  }

  async function confirmRefund() {
    if (!modal || saving) return;
    const f = modal.form, d = modal.doc;
    const amt = num(f.refund_amount);
    if (!(amt > 0)) { setMessage("❌ กรอกยอดรับคืน"); return; }
    const acc = f.method === "เงินโอน" ? bankAccounts.find((a) => String(a.account_id) === String(f.account_id)) : null;
    if (f.method === "เงินโอน" && !acc) { setMessage("❌ เลือกบัญชีที่รับโอนคืน"); return; }
    if (!window.confirm(`ยืนยันบันทึกรับคืนหัก ณ ที่จ่าย ${baht(amt)} บาท (${f.method})\n${d.expense_doc_no} · ${d.vendor_name || "-"}?`)) return;
    setSaving(true); setMessage("");
    try {
      const r = await post(WHT_REFUND_API, {
        action: "save_refund", expense_doc_id: d.expense_doc_id, manual_id: d.manual_id || null,
        refund_amount: amt, refund_date: f.refund_date, method: f.method,
        account_id: acc ? acc.account_id : null, account_name: acc ? acc.account_name : "",
        branch_code: myBranch, note: f.note.trim(),
        refund_by: currentUser?.username || currentUser?.name || "system",
      });
      if (!r || !r.id) throw new Error(r?.__error || "บันทึกไม่สำเร็จ (อาจบันทึกไปแล้ว)");
      setMessage(`✅ บันทึกรับคืน ${baht(amt)} บาท (${f.method}) ${d.expense_doc_no} แล้ว${f.method === "เงินโอน" ? " — ขึ้นรายงานเคลื่อนไหวบัญชี " + (acc?.account_name || "") : f.method === "เงินสด" ? " — ขึ้นเป็นแถวรับเงินสดในสรุปรายวันรับเงิน" : ""}`);
      setModal(null); load();
    } catch (err) { setMessage("❌ " + (err.message || err)); }
    setSaving(false);
  }

  async function saveManual() {
    if (!manual || saving) return;
    const amt = num(manual.wht_amount);
    if (!manual.vendor_name.trim()) { setMessage("❌ กรอกชื่อผู้ขาย"); return; }
    if (!(amt > 0)) { setMessage("❌ กรอกยอดหัก ณ ที่จ่าย"); return; }
    setSaving(true); setMessage("");
    try {
      const r = await post(WHT_REFUND_API, { action: "add_manual_pending", vendor_name: manual.vendor_name.trim(), affiliation: manual.affiliation, doc_no: manual.doc_no.trim() || "ยอดยกมา", doc_date: manual.doc_date, wht_amount: amt, note: manual.note.trim(), created_by: currentUser?.username || currentUser?.name || "system" });
      if (!r || !r.id) throw new Error(r?.__error || "บันทึกไม่สำเร็จ (ต้อง re-import WHT_Refund_API_Workflow ก่อน)");
      setMessage(`✅ เพิ่มรายการรอรับคืน ${manual.vendor_name.trim()} ${baht(amt)} บาท แล้ว`); setManual(null); load();
    } catch (err) { setMessage("❌ " + (err.message || err)); }
    setSaving(false);
  }
  async function deleteManual(r) {
    if (!window.confirm(`ลบรายการรอรับคืน ${r.vendor_name} ${baht(r.refund_due)} บาท (${r.expense_doc_no})?`)) return;
    try {
      const d = await post(WHT_REFUND_API, { action: "delete_manual_pending", id: r.manual_id, cancelled_by: currentUser?.username || currentUser?.name || "system" });
      if (!d || !d.id) throw new Error(d?.__error || "ลบไม่สำเร็จ");
      setMessage("✅ ลบรายการแล้ว"); load();
    } catch (err) { setMessage("❌ " + (err.message || err)); }
  }

  async function cancelRefund(r) {
    if (!window.confirm(`ยกเลิกรายการรับคืน ${baht(r.refund_amount)} บาท (${r.expense_doc_no})?\nเอกสารจะกลับมาอยู่ในรายการรอรับคืน`)) return;
    try {
      const d = await post(WHT_REFUND_API, { action: "cancel_refund", id: r.id, cancelled_by: currentUser?.username || currentUser?.name || "system" });
      if (!d || !d.id) throw new Error(d?.__error || "ยกเลิกไม่สำเร็จ");
      setMessage("✅ ยกเลิกรายการรับคืนแล้ว"); load();
    } catch (err) { setMessage("❌ " + (err.message || err)); }
  }

  const inp = { padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" };
  const th = { padding: "8px 6px", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff" };
  const td = { padding: "8px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
  const affilTag = (a) => a ? <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: a === "ป.เปา" ? "#fee2e2" : "#dbeafe", color: a === "ป.เปา" ? "#991b1b" : "#1e40af" }}>{a}</span> : "-";

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1250 }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b" }}>🧾 หัก ณ ที่จ่าย ค่าใช้จ่าย รอรับคืน</h2>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
        เอกสารค่าใช้จ่ายที่<b>จ่ายเต็มจำนวนไปก่อน</b> แล้วมาแก้ใส่หัก ณ ที่จ่ายทีหลัง (ผู้ขายส่งเอกสารช้า) → ยอดหัก ณ ที่จ่ายที่จ่ายเกิน = <b style={{ color: "#b91c1c" }}>รอผู้ขายโอนคืน</b> หรือหักจากบิลถัดไป<br />
        ระบบตรวจจากใบจ่าย (EPAY) ที่ยอดจ่ายจริง ≥ ยอดสุทธิหลังหัก · รับคืน<b>เงินโอน</b>ขึ้นรายงานเคลื่อนไหวบัญชี · รับคืน<b>เงินสด</b>ขึ้นแถวรับเงินสดในสรุปรายวันรับเงิน
      </div>
      {message && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, fontSize: 14, background: message.startsWith("✅") ? "#f0fdf4" : "#fef2f2", border: message.startsWith("✅") ? "1px solid #bbf7d0" : "1px solid #fecaca" }}>{message}</div>}

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>🔴 รอรับคืน ({shown.length}) · รวม {baht(totalPending)} บาท</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={affil} onChange={(e) => setAffil(e.target.value)} style={inp}>
              <option value="">สังกัด: ทั้งหมด</option>
              {affils.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา เลขเอกสาร / Vendor / EPAY" style={{ ...inp, width: 240 }} />
            <button onClick={() => setManual({ vendor_name: "", affiliation: "ป.เปา", doc_no: "ยอดยกมา", doc_date: todayStr(), wht_amount: "", note: "" })}
              style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#1e3a8a", color: "#fff", cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>+ เพิ่มรายการยกมา</button>
            <button onClick={load} disabled={loading} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>{loading ? "⏳" : "🔄"}</button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>เลขเอกสาร</th><th style={th}>วันที่</th><th style={th}>สังกัด</th><th style={th}>Vendor</th><th style={th}>รายละเอียด</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดรวม</th><th style={{ ...th, textAlign: "right" }}>หัก ณ ที่จ่าย</th><th style={{ ...th, textAlign: "right" }}>ยอดสุทธิ</th>
              <th style={th}>ใบจ่าย</th><th style={{ ...th, textAlign: "right" }}>จ่ายจริง</th><th style={{ ...th, textAlign: "right" }}>รอรับคืน</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.manual_id ? `m${r.manual_id}` : r.expense_doc_id}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#072d6b", whiteSpace: "nowrap" }}>{r.expense_doc_no}{r.manual_id ? <div style={{ fontSize: 10, color: "#b45309", fontFamily: "Tahoma" }}>บันทึกเอง</div> : null}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(r.doc_date)}</td>
                  <td style={td}>{affilTag(r.affiliation)}</td>
                  <td style={td}>{r.vendor_name || "-"}</td>
                  <td style={{ ...td, fontSize: 12.5, maxWidth: 260, color: "#475569" }}>{r.description || "-"}{r.reference_no ? <div style={{ fontSize: 11, color: "#94a3b8" }}>อ้างอิง {r.reference_no}</div> : null}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{r.total != null ? baht(r.total) : "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626" }}>{baht(r.wht_amount)}{num(r.wht_rate) > 0 ? <div style={{ fontSize: 10, color: "#94a3b8" }}>{num(r.wht_rate)}%</div> : null}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{r.net_to_pay != null ? baht(r.net_to_pay) : "-"}</td>
                  <td style={{ ...td, fontSize: 12 }}>
                    {r.manual_id ? <span style={{ color: "#94a3b8" }}>—</span> : (<>
                      <div style={{ fontFamily: "monospace" }}>{r.paid_doc_no || "-"}</div>
                      <div style={{ color: "#6b7280", fontSize: 11 }}>จ่าย {thaiDate(r.paid_at)}{r.payment_method ? ` · ${r.payment_method}` : ""}</div>
                    </>)}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }} title={r.manual_id ? "รายการบันทึกเอง" : `ใบจ่ายนี้: จ่ายจริง ${baht(r.paid_sum)} / ยอดสุทธิรวม ${baht(r.net_sum)} → จ่ายเกิน ${baht(r.group_overpaid)}`}>
                    {r.manual_id ? "-" : (<>{baht(r.paid_sum)}<div style={{ fontSize: 10, color: "#b45309" }}>เกิน {baht(r.group_overpaid)}</div></>)}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#b91c1c", fontFamily: "monospace" }}>{baht(r.refund_due)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <button onClick={() => openRefund(r)}
                      style={{ padding: "6px 14px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>💰 บันทึกรับคืน</button>
                    {r.manual_id && <button onClick={() => deleteManual(r)} title="ลบรายการบันทึกเอง" style={{ marginLeft: 6, padding: "6px 8px", background: "#fff", color: "#b91c1c", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>✖</button>}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && !loading && (
                <tr><td colSpan={12} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>— ไม่มีรายการรอรับคืน —</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>📋 ประวัติรับคืน ({refunds.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>วันที่รับคืน</th><th style={th}>เลขเอกสาร</th><th style={th}>ใบจ่าย</th><th style={th}>สังกัด</th><th style={th}>Vendor</th>
              <th style={{ ...th, textAlign: "right" }}>หัก ณ ที่จ่าย</th><th style={{ ...th, textAlign: "right" }}>ยอดรับคืน</th><th style={th}>วิธีรับคืน</th>
              <th style={th}>หมายเหตุ</th><th style={th}>ผู้บันทึก</th><th style={th}>สถานะ</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id} style={{ opacity: r.status === "ยกเลิก" ? 0.55 : 1 }}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{thaiDate(r.refund_date)}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{r.expense_doc_no || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.paid_doc_no || "-"}</td>
                  <td style={td}>{affilTag(r.affiliation)}</td>
                  <td style={td}>{r.vendor_name || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{baht(r.wht_amount)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#0f766e", fontFamily: "monospace" }}>{baht(r.refund_amount)}</td>
                  <td style={td}>{r.method}{r.account_name ? ` · ${r.account_name}` : ""}</td>
                  <td style={{ ...td, fontSize: 12.5, maxWidth: 240 }}>{r.note || "-"}</td>
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
                <tr><td colSpan={12} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>— ยังไม่มีประวัติรับคืน —</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {manual && (
        <div onClick={() => !saving && setManual(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: 460, maxWidth: "95vw", fontFamily: "Tahoma" }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1e3a8a", marginBottom: 10 }}>+ เพิ่มรายการหัก ณ ที่จ่าย รอรับคืน (ยอดยกมา)</div>
            <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 12 }}>สำหรับยอดค้างรับคืนที่เกิดก่อนใช้ระบบ หรือเอกสารที่ไม่ได้บันทึกในระบบค่าใช้จ่าย</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 12px", alignItems: "center", fontSize: 14 }}>
              <label>ผู้ขาย *</label>
              <input value={manual.vendor_name} onChange={(e) => setManual((m) => ({ ...m, vendor_name: e.target.value }))} placeholder="เช่น บริษัท วิริยะประกันภัย จำกัด (มหาชน)" style={inp} />
              <label>สังกัด</label>
              <select value={manual.affiliation} onChange={(e) => setManual((m) => ({ ...m, affiliation: e.target.value }))} style={inp}>
                <option value="ป.เปา">ป.เปา</option><option value="สิงห์ชัย">สิงห์ชัย</option>
              </select>
              <label>เลขเอกสาร</label>
              <input value={manual.doc_no} onChange={(e) => setManual((m) => ({ ...m, doc_no: e.target.value }))} style={inp} />
              <label>วันที่</label>
              <input type="date" value={manual.doc_date} onChange={(e) => setManual((m) => ({ ...m, doc_date: e.target.value }))} style={inp} />
              <label>ยอดหัก ณ ที่จ่าย *</label>
              <input type="number" min="0" step="0.01" value={manual.wht_amount} onChange={(e) => setManual((m) => ({ ...m, wht_amount: e.target.value }))} style={{ ...inp, textAlign: "right", fontWeight: 700 }} />
              <label>หมายเหตุ</label>
              <input value={manual.note} onChange={(e) => setManual((m) => ({ ...m, note: e.target.value }))} style={inp} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={saveManual} disabled={saving} style={{ flex: 1, padding: "11px 0", background: saving ? "#9ca3af" : "#1e3a8a", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{saving ? "กำลังบันทึก..." : "✅ เพิ่มรายการ"}</button>
              <button onClick={() => setManual(null)} disabled={saving} style={{ padding: "11px 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, fontFamily: "Tahoma", cursor: "pointer" }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
      {modal && (
        <div onClick={() => !saving && setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: 480, maxWidth: "95vw", fontFamily: "Tahoma" }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#0f766e", marginBottom: 10 }}>💰 บันทึกรับคืนหัก ณ ที่จ่าย</div>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 13.5, marginBottom: 12, lineHeight: 1.7 }}>
              <b style={{ fontFamily: "monospace" }}>{modal.doc.expense_doc_no}</b> · {modal.doc.vendor_name || "-"} {affilTag(modal.doc.affiliation)}<br />
              ยอดรวม {baht(modal.doc.total)} · หัก ณ ที่จ่าย <b style={{ color: "#dc2626" }}>{baht(modal.doc.wht_amount)}</b> · สุทธิ {baht(modal.doc.net_to_pay)}<br />
              {modal.doc.manual_id ? <>รายการบันทึกเอง ({modal.doc.description || "-"}) → </> : <>ใบจ่าย {modal.doc.paid_doc_no} จ่ายจริง {baht(modal.doc.paid_sum)} → </>}<b style={{ color: "#b91c1c" }}>รอรับคืน {baht(modal.doc.refund_due)}</b> บาท
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 12px", alignItems: "center", fontSize: 14 }}>
              <label>วันที่รับคืน</label>
              <input type="date" value={modal.form.refund_date} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, refund_date: e.target.value } }))} style={inp} />
              <label>ยอดรับคืน (บาท)</label>
              <input type="number" min="0" value={modal.form.refund_amount} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, refund_amount: e.target.value } }))} style={{ ...inp, textAlign: "right", fontWeight: 700 }} />
              <label>วิธีรับคืน</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {METHODS.map((k) => (
                  <button key={k} onClick={() => setModal((m) => ({ ...m, form: { ...m.form, method: k } }))}
                    style={{ padding: "7px 0", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer", fontSize: 13,
                      background: modal.form.method === k ? "#072d6b" : "#fff", color: modal.form.method === k ? "#fff" : "#072d6b",
                      border: modal.form.method === k ? "2px solid #072d6b" : "2px solid #d1d5db" }}>
                    {k === "เงินสด" ? "💵 เงินสด" : k === "เงินโอน" ? "🏦 เงินโอน" : k === "หักจากบิลถัดไป" ? "🧾 หักจากบิลถัดไป" : "🚫 ไม่ต้องคืน"}
                  </button>
                ))}
              </div>
              {modal.form.method === "เงินโอน" && (<>
                <label>บัญชีที่รับโอน</label>
                <select value={modal.form.account_id} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, account_id: e.target.value } }))} style={inp}>
                  <option value="">— เลือกบัญชี —</option>
                  {bankAccounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name}{a.bank_name ? ` (${a.bank_name})` : ""}</option>)}
                </select>
              </>)}
              <label>หมายเหตุ</label>
              <input value={modal.form.note} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, note: e.target.value } }))} placeholder={modal.form.method === "หักจากบิลถัดไป" ? "เช่น หักจากใบแจ้งหนี้เลขที่ ..." : ""} style={inp} />
            </div>
            {modal.form.method === "เงินสด" && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 10px" }}>
                💵 รับคืนเงินสด — จะขึ้นเป็นแถวรับเงินสดในหน้าสรุปรายวันรับเงินของสาขา {myBranch || "-"} วันที่ {thaiDate(modal.form.refund_date)}
              </div>
            )}
            {(modal.form.method === "หักจากบิลถัดไป" || modal.form.method === "ไม่ต้องคืน") && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px" }}>
                ปิดรายการโดยไม่มีเงินเข้า — ไม่ขึ้นรายงานเคลื่อนไหวบัญชี/สรุปรายวัน
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={confirmRefund} disabled={saving}
                style={{ flex: 1, padding: "11px 0", background: saving ? "#9ca3af" : "#0f766e", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                {saving ? "กำลังบันทึก..." : "✅ ยืนยันรับคืน"}
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
