import React, { useEffect, useMemo, useState } from "react";

// มัดจำป้ายแดง (ติดป้ายทีหลัง — user 2026-08-24): ลูกค้าซื้อรถไปแล้วยังไม่ติดป้ายแดง กลับมาติดภายหลัง
// เลือกใบขายที่ยังไม่มีป้ายแดง → กรอกทะเบียน (มัดจำ 200) + วิธีชำระ → add_red_plate_deposit (ออกเลข RPD, standalone) + ส่งใบรับมัดจำเข้า LINE
const BASE = "https://n8n-new-project-gwf2.onrender.com/webhook";
const RETAIL_API = `${BASE}/retail-sale-api`;
const ACC_API = `${BASE}/accounting-api`;

const RED_PLATE_DEPOSIT = 200;
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
  return y && m && d ? `${Number(d)}/${Number(m)}/${Number(y) + 543}` : s;
};
const normPlate = (v) => String(v || "").replace(/[^0-9A-Za-zก-๙]/g, "");

export default function RedPlateDepositPage({ currentUser }) {
  const isAdmin = currentUser?.role === "admin";
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const bc5 = (v) => String(v || "").substring(0, 5).toUpperCase();
  const [sales, setSales] = useState([]);
  const [heldPlates, setHeldPlates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [kw, setKw] = useState("");
  const [branch, setBranch] = useState("");
  const [message, setMessage] = useState("");
  const [bankAccounts, setBankAccounts] = useState([]);
  const [modal, setModal] = useState(null); // ใบขายที่เลือก
  const [form, setForm] = useState({ plate_no: "", received_date: todayStr(), method: "เงินสด", account: "", notify: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    post(ACC_API, { action: "list_bank_accounts", include_inactive: "false" })
      .then((d) => setBankAccounts(asArray(d).filter((a) => a.account_type !== "เงินสดย่อย" && a.account_type !== "ลูกหนี้")))
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true); setMessage("");
    try {
      const d0 = new Date(); d0.setDate(d0.getDate() - 120);
      const [s, held] = await Promise.all([
        post(RETAIL_API, { action: "list_retail_sales", date_from: d0.toISOString().slice(0, 10), date_to: todayStr(), limit: 3000 }),
        post(RETAIL_API, { action: "list_red_plate_deposits", status: "held" }),
      ]);
      // เฉพาะใบขายที่ยังไม่ติดป้ายแดง (ไม่เคยมีมัดจำ/เลข RPD) และไม่ถูกยกเลิก
      setSales(asArray(s).filter((r) => r && r.invoice_no && String(r.sale_status || "10") !== "90" && !(num(r.red_plate_deposit) > 0) && !r.red_plate_doc_no));
      setHeldPlates(asArray(held));
    } catch { setMessage("❌ โหลดไม่สำเร็จ (ตรวจว่า re-import retail-sale-api แล้ว)"); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const shown = useMemo(() => {
    const k = kw.trim().toLowerCase();
    if (!k) return []; // ไม่โชว์รายการจนกว่าจะพิมพ์ค้นหา (user 2026-08-24)
    return sales
      .filter((r) => (isAdmin ? (!branch || bc5(r.branch_code) === bc5(branch)) : bc5(r.branch_code) === myBranch))
      .filter((r) => !k || [r.invoice_no, r.customer_name, r.engine_no, r.chassis_no, r.model_name].some((v) => String(v || "").toLowerCase().includes(k)))
      .slice(0, 200);
  }, [sales, kw, branch, isAdmin, myBranch]);

  const branchOpts = useMemo(() => [...new Set(sales.map((r) => bc5(r.branch_code)).filter(Boolean))].sort(), [sales]);

  function openModal(r) {
    setModal(r);
    setForm({ plate_no: "", received_date: todayStr(), method: "เงินสด", account: "", notify: !!r.line_name });
    setMessage("");
  }

  async function save() {
    if (!modal || saving) return;
    const plate = form.plate_no.trim();
    if (!plate) { setMessage("❌ กรอกทะเบียนป้ายแดง"); return; }
    if (form.method === "เงินโอน" && !form.account) { setMessage("❌ เลือกบัญชีรับโอน"); return; }
    // ห้ามเลขป้ายซ้ำกับที่ยังค้างคืน (กติกาเดียวกับหน้าขาย)
    const dup = heldPlates.find((d) => normPlate(d.plate_no) === normPlate(plate));
    if (dup) { setMessage(`❌ ทะเบียนป้ายแดง ${plate} ยังค้างคืนอยู่ (${dup.deposit_no} · ${dup.customer_name || "-"}) — รับป้ายคืนก่อน หรือใช้ป้ายอื่น`); return; }
    if (!window.confirm(`ติดป้ายแดง ${plate} ให้ใบขาย ${modal.invoice_no} (${modal.customer_name})\nรับมัดจำ ${baht(RED_PLATE_DEPOSIT)} บาท (${form.method}) ?`)) return;
    setSaving(true); setMessage("");
    try {
      const r = await post(RETAIL_API, {
        action: "add_red_plate_deposit", sale_no: modal.invoice_no,
        plate_no: plate, amount: RED_PLATE_DEPOSIT,
        received_date: form.received_date,
        payment_method: form.method, payment_account: form.method === "เงินโอน" ? form.account : "",
        received_by: currentUser?.username || currentUser?.name || "system",
      });
      const sale = r && r.sale;
      const rpdNo = r && r.red_plate_doc_no;
      if (!sale || !sale.sale_no) throw new Error(r?.__error || r?.error || "บันทึกไม่สำเร็จ (ใบขายอาจมีป้ายแดงแล้ว)");
      let msg = `✅ บันทึกมัดจำป้ายแดง ${plate} เลขที่ใบรับ ${rpdNo || sale.red_plate_doc_no || "-"} แล้ว`;
      // ส่งใบรับมัดจำเข้า LINE เมื่อชำระเงินแล้ว
      if (form.notify && sale.line_user_id) {
        try {
          await post(RETAIL_API, {
            action: "send_red_plate_receipt_flex", line_user_id: sale.line_user_id,
            deposit_no: rpdNo || sale.red_plate_doc_no, sale_no: sale.sale_no,
            received_date: thaiDate(form.received_date), customer_name: sale.customer_name,
            plate_no: plate, amount: RED_PLATE_DEPOSIT, payment_method: form.method,
            branch_code: sale.branch_code, branch_name: sale.branch_name,
          });
          msg += " · ส่งใบรับมัดจำเข้า LINE ลูกค้าแล้ว";
        } catch { msg += " · ⚠️ ส่ง LINE ไม่สำเร็จ"; }
      } else if (form.notify) msg += " · ลูกค้าไม่มี LINE ในใบขาย";
      setMessage(msg);
      setModal(null);
      load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    finally { setSaving(false); }
  }

  const th = { padding: "8px 6px", fontSize: 13, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff" };
  const td = { padding: "8px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
  const inp = { padding: "7px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14 };

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1100 }}>
      <h2 style={{ margin: "0 0 6px", color: "#072d6b" }}>🔴 มัดจำป้ายแดง (ติดป้ายทีหลัง)</h2>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>ลูกค้าที่ซื้อรถไปแล้วและยังไม่ติดป้ายแดง — เลือกใบขาย กรอกทะเบียน รับมัดจำ {RED_PLATE_DEPOSIT} บาท ระบบออกใบรับมัดจำ (RPD-) และส่งเข้า LINE ลูกค้า · คืนเงินที่เมนู "คืนมัดจำป้ายแดง"</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="ค้นหา ใบขาย / ลูกค้า / เลขเครื่อง / เลขถัง" style={{ ...inp, width: 300 }} />
        {isAdmin && (
          <select value={branch} onChange={(e) => setBranch(e.target.value)} style={inp}>
            <option value="">ทุกสาขา</option>
            {branchOpts.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        <button onClick={load} disabled={loading} style={{ padding: "8px 18px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer" }}>{loading ? "กำลังโหลด..." : "🔄 รีเฟรช"}</button>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>{kw.trim() ? <>พบ <b>{shown.length}</b> รายการ</> : <>ใบขายยังไม่ติดป้ายแดง (120 วัน) ทั้งหมด <b>{sales.length}</b> ใบ — พิมพ์ค้นหาเพื่อแสดง</>}</span>
      </div>
      {message && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: message.startsWith("❌") ? "#fef2f2" : "#f0fdf4", border: message.startsWith("❌") ? "1px solid #fecaca" : "1px solid #bbf7d0", fontSize: 14 }}>{message}</div>}

      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>เลขที่ใบขาย</th><th style={th}>วันที่ขาย</th><th style={th}>ลูกค้า</th><th style={th}>รถ</th><th style={th}>เลขเครื่อง</th><th style={th}>สาขา</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 24 }}>{loading ? "กำลังโหลด..." : !kw.trim() ? "🔍 พิมพ์ค้นหา เลขใบขาย / ชื่อลูกค้า / เลขเครื่อง / เลขถัง เพื่อแสดงรายการ" : "ไม่พบใบขายที่ยังไม่ติดป้ายแดงตามคำค้น"}</td></tr>}
            {shown.map((r) => (
              <tr key={r.invoice_no}>
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#1d4ed8" }}>{r.invoice_no}</td>
                <td style={td}>{thaiDate(r.sale_date)}</td>
                <td style={td}>{r.customer_name}{r.line_name && <span style={{ fontSize: 11, color: "#16a34a" }}> · LINE ✓</span>}</td>
                <td style={td}>{[r.brand, r.model_name || r.model_code, r.model_color].filter(Boolean).join(" ")}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.engine_no || "-"}</td>
                <td style={td}>{bc5(r.branch_code) || "-"}</td>
                <td style={td}>
                  <button onClick={() => openModal(r)} style={{ padding: "6px 14px", background: "#b91c1c", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>🔴 ติดป้ายแดง</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div onClick={() => !saving && setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 20, width: 460, maxWidth: "95vw", fontFamily: "Tahoma" }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#b91c1c", marginBottom: 10 }}>🔴 ติดป้ายแดง + รับมัดจำ</div>
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 14, marginBottom: 12 }}>
              <div>ใบขาย <b>{modal.invoice_no}</b> · {thaiDate(modal.sale_date)}</div>
              <div>ลูกค้า <b>{modal.customer_name}</b>{modal.line_name ? " · LINE ✓" : ""}</div>
              <div style={{ color: "#6b7280" }}>{[modal.brand, modal.model_name, modal.model_color].filter(Boolean).join(" ")} · {modal.engine_no}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 12px", alignItems: "center", fontSize: 14 }}>
              <label>ทะเบียนป้ายแดง *</label>
              <input value={form.plate_no} onChange={(e) => setForm((f) => ({ ...f, plate_no: e.target.value }))} placeholder="เช่น 99-025" style={{ ...inp, fontFamily: "monospace", fontWeight: 700 }} />
              <label>เงินมัดจำ</label>
              <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 8, fontWeight: 700, color: "#b91c1c", width: 120, textAlign: "right" }}>{baht(RED_PLATE_DEPOSIT)} บาท</div>
              <label>วันที่รับเงิน</label>
              <input type="date" value={form.received_date} onChange={(e) => setForm((f) => ({ ...f, received_date: e.target.value }))} style={inp} />
              <label>วิธีชำระ</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["เงินสด", "เงินโอน"].map((m) => (
                  <button key={m} onClick={() => setForm((f) => ({ ...f, method: m }))} style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer", background: form.method === m ? "#072d6b" : "#fff", color: form.method === m ? "#fff" : "#072d6b", border: form.method === m ? "2px solid #072d6b" : "2px solid #d1d5db" }}>{m === "เงินสด" ? "💵 เงินสด" : "🏦 เงินโอน"}</button>
                ))}
              </div>
              {form.method === "เงินโอน" && (<>
                <label>บัญชีรับโอน</label>
                <select value={form.account} onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))} style={inp}>
                  <option value="">— เลือกบัญชี —</option>
                  {bankAccounts.map((a) => <option key={a.account_id} value={a.account_name}>{a.account_name}{a.bank_name ? ` (${a.bank_name})` : ""}</option>)}
                </select>
              </>)}
              <span></span>
              <label style={{ fontSize: 13 }}>
                <input type="checkbox" checked={form.notify} onChange={(e) => setForm((f) => ({ ...f, notify: e.target.checked }))} />
                {" "}ส่งใบรับมัดจำเข้า LINE ลูกค้าเมื่อชำระเงิน
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: "11px 0", background: saving ? "#9ca3af" : "#b91c1c", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{saving ? "กำลังบันทึก..." : "💾 บันทึกรับมัดจำ + ส่ง LINE"}</button>
              <button onClick={() => setModal(null)} disabled={saving} style={{ padding: "11px 18px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, fontFamily: "Tahoma", cursor: "pointer" }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
