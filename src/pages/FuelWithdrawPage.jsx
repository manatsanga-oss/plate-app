import React, { useEffect, useMemo, useState } from "react";

// บันทึกเบิกค่าน้ำมันรถใช้จ่าย (รถขนส่ง/รถใช้งานร้าน) — แทนการเบิกผ่าน DMS (user 2026-08-29)
// flow: บันทึกเบิกก่อน (วันที่/รถ/ผู้เบิก/ยอด/เลขไมล์) → กลับมาแก้ไขเติมใบกำกับ (เลขที่/วันที่/ชื่อปั้ม) ทีหลัง
// ข้อมูลขึ้นแท็บ "รายงานการเบิกค่าน้ำมัน" ในระบบจองคนขับรถแทนข้อมูล daily_expenses
const API = "https://n8n-new-project-gwf2.onrender.com/webhook/fuel-withdraw-api";
const MASTER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api"; // vendors (ชื่อปั้ม) — ชุดเดียวกับหน้าบันทึกค่าใช้จ่าย

async function post(body) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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

// รถใช้งานที่เบิกบ่อย — เลือกเร็ว (พิมพ์เองได้)
const VEHICLES = ["83-8951", "บย 8304"];

export default function FuelWithdrawPage({ currentUser }) {
  const isAdmin = currentUser?.role === "admin";
  const myBranch = String(currentUser?.branch_code || currentUser?.branch || "").substring(0, 5).toUpperCase();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(todayStr());
  const [form, setForm] = useState({ withdraw_date: todayStr(), vehicle: "", amount: "", mileage: "", note: "" });
  const [edit, setEdit] = useState(null); // แถวที่กำลังแก้ไข (เติมใบกำกับ)
  // ชื่อปั้ม = Vendor จาก master เหมือนหน้าบันทึกค่าใช้จ่าย (user 2026-08-29) — เลือก/พิมพ์ค้นหา + ปุ่มเพิ่ม vendor ใหม่
  const [vendors, setVendors] = useState([]);
  useEffect(() => {
    fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list_vendors", include_inactive: "false" }) })
      .then((r) => r.json()).then((d) => setVendors(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  async function addVendor() {
    const name = window.prompt("ชื่อปั้ม/ผู้จำหน่ายใหม่ (บันทึกเข้า Vendor master):", String(edit?.station_name || "").trim());
    if (name == null || !name.trim()) return;
    try {
      const res = await fetch(MASTER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_vendor", vendor_name: name.trim(), status: "active" }) });
      const d = await res.json();
      const row = Array.isArray(d) ? d[0] : d;
      if (!row?.vendor_id) throw new Error(row?.error || "เพิ่ม vendor ไม่สำเร็จ");
      setVendors((v) => [...v, row]);
      setEdit((p) => ({ ...p, station_name: row.vendor_name }));
      setMessage(`✅ เพิ่ม vendor "${row.vendor_name}" แล้ว`);
    } catch (e) { setMessage("❌ " + (e.message || e)); }
  }

  async function load() {
    setLoading(true);
    try {
      const body = { action: "list_fuel_withdraws", date_from: dateFrom, date_to: dateTo };
      if (!isAdmin) body.branch_code = myBranch;
      setRows(unwrapList(await post(body)));
    } catch { setRows([]); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (saving) return;
    const f = form;
    if (!(num(f.amount) > 0)) { setMessage("❌ กรอกจำนวนเงินที่เบิก"); return; }
    if (!f.vehicle.trim()) { setMessage("❌ กรอกทะเบียนรถที่เบิกน้ำมัน"); return; }
    if (!window.confirm(`เบิกค่าน้ำมัน ${baht(f.amount)} บาท (เงินสด)\nรถ ${f.vehicle.trim()}${f.mileage ? " · เลขไมล์ " + f.mileage : ""} ?`)) return;
    setSaving(true); setMessage("");
    try {
      const r = await post({
        action: "save_fuel_withdraw",
        withdraw_date: f.withdraw_date, branch_code: myBranch || currentUser?.branch || "",
        vehicle: f.vehicle.trim(),
        amount: num(f.amount), mileage: f.mileage === "" ? null : num(f.mileage),
        note: f.note.trim(), created_by: currentUser?.username || currentUser?.name || "system",
      });
      if (!r || !r.doc_no) throw new Error(r?.__error || "บันทึกไม่สำเร็จ (ตรวจว่า import workflow fuel-withdraw-api แล้ว)");
      setMessage(`✅ บันทึกเบิกค่าน้ำมันแล้ว เลขที่ ${r.doc_no} — กลับมาเติมเลขที่ใบกำกับ/ชื่อปั้มได้จากปุ่ม "แก้ไข"`);
      setForm({ withdraw_date: todayStr(), vehicle: "", amount: "", mileage: "", note: "" });
      load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    finally { setSaving(false); }
  }

  async function saveEdit() {
    if (!edit || saving) return;
    setSaving(true); setMessage("");
    try {
      const r = await post({
        action: "save_fuel_withdraw", id: edit.id,
        amount: num(edit.amount), mileage: edit.mileage === "" || edit.mileage == null ? null : num(edit.mileage),
        station_name: String(edit.station_name || "").trim(),
        tax_invoice_no: String(edit.tax_invoice_no || "").trim(),
        tax_invoice_date: String(edit.tax_invoice_date || "").slice(0, 10),
        vehicle: String(edit.vehicle || "").trim(),
        note: String(edit.note || "").trim(),
        updated_by: currentUser?.username || currentUser?.name || "system",
      });
      if (!r || !r.doc_no) throw new Error(r?.__error || "แก้ไขไม่สำเร็จ (ใบอาจถูกยกเลิกแล้ว)");
      setMessage(`✅ บันทึกใบกำกับของ ${r.doc_no} แล้ว`);
      setEdit(null); load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
    finally { setSaving(false); }
  }

  async function cancelRow(r) {
    const sameDay = String(r.withdraw_date || "").slice(0, 10) === todayStr();
    if (!isAdmin && !sameDay) { setMessage("❌ ยกเลิกข้ามวันได้เฉพาะ admin"); return; }
    if (!window.confirm(`ยกเลิกใบเบิก ${r.doc_no} (${baht(r.amount)} บาท)?`)) return;
    try {
      const d = await post({ action: "cancel_fuel_withdraw", id: r.id, cancelled_by: currentUser?.username || currentUser?.name || "system" });
      if (!d || !d.doc_no) throw new Error(d?.__error || "ยกเลิกไม่สำเร็จ");
      setMessage(`✅ ยกเลิก ${r.doc_no} แล้ว`); load();
    } catch (e) { setMessage("❌ " + (e.message || e)); }
  }

  const activeRows = useMemo(() => rows.filter((r) => r && r.doc_no), [rows]);
  const total = useMemo(() => activeRows.filter((r) => r.status !== "ยกเลิก").reduce((s, r) => s + num(r.amount), 0), [activeRows]);
  const noInvoice = useMemo(() => activeRows.filter((r) => r.status !== "ยกเลิก" && !String(r.tax_invoice_no || "").trim()).length, [activeRows]);
  const inp = { padding: "8px 10px", border: "1.5px solid #d1d5db", borderRadius: 8, fontFamily: "Tahoma", fontSize: 14, boxSizing: "border-box" };
  const th = { padding: "8px 6px", fontSize: 12.5, textAlign: "left", whiteSpace: "nowrap", background: "#072d6b", color: "#fff" };
  const td = { padding: "7px 6px", fontSize: 13, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };

  return (
    <div style={{ fontFamily: "Tahoma", padding: 16, maxWidth: 1150 }}>
      <h2 style={{ margin: "0 0 4px", color: "#072d6b", fontSize: 20 }}>⛽ บันทึกเบิกค่าน้ำมันรถใช้จ่าย</h2>
      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 12 }}>
        เบิกเงินสดหน้าร้านเติมน้ำมันรถใช้งาน — บันทึกเบิกก่อน แล้วกลับมากด "แก้ไข" เติมเลขที่ใบกำกับ/วันที่/ชื่อปั้มเมื่อได้บิลจากปั้ม · ข้อมูลขึ้นแท็บ "รายงานการเบิกค่าน้ำมัน" ในระบบจองคนขับรถอัตโนมัติ
      </div>
      {message && <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: message.startsWith("❌") ? "#fef2f2" : "#f0fdf4", border: message.startsWith("❌") ? "1px solid #fecaca" : "1px solid #bbf7d0", fontSize: 14 }}>{message}</div>}

      <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "10px 12px", alignItems: "center", fontSize: 14, maxWidth: 780 }}>
          <label>วันที่เบิก *</label>
          <input type="date" value={form.withdraw_date} onChange={(e) => setForm((f) => ({ ...f, withdraw_date: e.target.value }))} style={inp} />
          <label>ทะเบียนรถ *</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input list="fuel-vehicles" value={form.vehicle} onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))} placeholder="เช่น 83-8951" style={{ ...inp, flex: 1 }} />
            <datalist id="fuel-vehicles">{VEHICLES.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
          <label>จำนวนเงิน (เงินสด) *</label>
          <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" style={{ ...inp, textAlign: "right", fontWeight: 700 }} />
          <label>เลขไมล์</label>
          <input type="number" value={form.mileage} onChange={(e) => setForm((f) => ({ ...f, mileage: e.target.value }))} placeholder="เลขไมล์รถ ณ วันเบิก" style={{ ...inp, textAlign: "right" }} />
          <label>หมายเหตุ</label>
          <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="ไม่บังคับ" style={inp} />
        </div>
        <button onClick={save} disabled={saving} style={{ marginTop: 14, padding: "11px 28px", background: saving ? "#9ca3af" : "#16a34a", color: "#fff", border: "none", borderRadius: 10, fontFamily: "Tahoma", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          {saving ? "กำลังบันทึก..." : "💾 บันทึกเบิกค่าน้ำมัน"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700 }}>รายการเบิก</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inp} />
        <button onClick={load} disabled={loading} style={{ padding: "7px 16px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, fontFamily: "Tahoma", fontWeight: 700, cursor: "pointer" }}>{loading ? "..." : "🔍 แสดง"}</button>
        <span style={{ marginLeft: "auto", fontSize: 13 }}>รวม <b style={{ color: "#166534" }}>{baht(total)}</b> บาท{noInvoice > 0 && <span style={{ color: "#b45309" }}> · ⚠️ ยังไม่มีใบกำกับ {noInvoice} ใบ</span>}</span>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>เลขที่เบิก</th><th style={th}>วันที่</th><th style={th}>สาขา</th><th style={th}>รถ</th>
            <th style={{ ...th, textAlign: "right" }}>เงินสด</th><th style={{ ...th, textAlign: "right" }}>VAT</th><th style={{ ...th, textAlign: "right" }}>เลขไมล์</th>
            <th style={th}>ใบกำกับ (เลขที่ · วันที่ · ปั้ม)</th><th style={th}>สถานะ</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {activeRows.length === 0 && <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: 22 }}>{loading ? "กำลังโหลด..." : "ไม่มีรายการในช่วงวันที่"}</td></tr>}
            {activeRows.map((r) => (
              <tr key={r.id} style={{ opacity: r.status === "ยกเลิก" ? 0.5 : 1 }}>
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 700 }}>{r.doc_no}</td>
                <td style={td}>{thaiDate(r.withdraw_date)}</td>
                <td style={td}>{r.branch_code}</td>
                <td style={td}>{r.vehicle || "-"}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{baht(r.amount)}</td>
                <td style={{ ...td, textAlign: "right", color: "#6b7280", fontSize: 12 }}>{r.vat_amount != null ? baht(r.vat_amount) : baht(num(r.amount) * 7 / 107)}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{r.mileage != null && r.mileage !== "" ? Number(r.mileage).toLocaleString("th-TH") : "-"}</td>
                <td style={td}>{String(r.tax_invoice_no || "").trim()
                  ? <span style={{ color: "#166534" }}>✅ {r.tax_invoice_no}{r.tax_invoice_date ? " · " + thaiDate(r.tax_invoice_date) : ""}{r.station_name ? " · " + r.station_name : ""}</span>
                  : <span style={{ color: "#b45309" }}>⚠️ ยังไม่มีใบกำกับ</span>}</td>
                <td style={td}>{r.status === "ยกเลิก" ? <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 12 }}>ยกเลิก</span> : <span style={{ color: "#166534", fontSize: 12 }}>ปกติ</span>}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  {r.status !== "ยกเลิก" && <>
                    <button onClick={() => setEdit({ ...r, tax_invoice_date: String(r.tax_invoice_date || "").slice(0, 10) })}
                      style={{ padding: "4px 10px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontSize: 12, marginRight: 4 }}>✏️ แก้ไข</button>
                    <button onClick={() => cancelRow(r)}
                      style={{ padding: "4px 10px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "Tahoma", fontSize: 12 }}>ยกเลิก</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div onClick={() => setEdit(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 18, width: 520, maxWidth: "95vw", fontFamily: "Tahoma" }}>
            <h3 style={{ margin: "0 0 12px", color: "#072d6b" }}>✏️ แก้ไข {edit.doc_no} — เติมใบกำกับน้ำมัน</h3>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 12px", alignItems: "center", fontSize: 14 }}>
              <label>เลขที่ใบกำกับ</label>
              <input value={edit.tax_invoice_no || ""} onChange={(e) => setEdit((p) => ({ ...p, tax_invoice_no: e.target.value }))} style={{ ...inp, fontFamily: "monospace" }} />
              <label>วันที่ใบกำกับ</label>
              <input type="date" value={edit.tax_invoice_date || ""} onChange={(e) => setEdit((p) => ({ ...p, tax_invoice_date: e.target.value }))} style={inp} />
              <label>ชื่อปั้ม *</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input list="fuel-vendors" value={edit.station_name || ""} onChange={(e) => setEdit((p) => ({ ...p, station_name: e.target.value }))}
                  placeholder="เลือก / พิมพ์ค้นหา Vendor" style={{ ...inp, flex: 1 }} />
                <datalist id="fuel-vendors">{vendors.map((v) => <option key={v.vendor_id} value={v.vendor_name} />)}</datalist>
                <button onClick={addVendor} title="เพิ่ม vendor ใหม่เข้า master"
                  style={{ padding: "6px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>+</button>
              </div>
              <label>เลขไมล์</label>
              <input type="number" value={edit.mileage ?? ""} onChange={(e) => setEdit((p) => ({ ...p, mileage: e.target.value }))} style={{ ...inp, textAlign: "right" }} />
              <label>จำนวนเงิน</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="number" value={edit.amount} onChange={(e) => setEdit((p) => ({ ...p, amount: e.target.value }))} style={{ ...inp, width: 140, textAlign: "right", fontWeight: 700 }} />
                <span style={{ fontSize: 12, color: "#6b7280" }}>รวม VAT 7% — ภาษี {baht(num(edit.amount) * 7 / 107)}</span>
              </div>
              <label>รถ</label>
              <input value={edit.vehicle || ""} onChange={(e) => setEdit((p) => ({ ...p, vehicle: e.target.value }))} style={inp} />
              <label>หมายเหตุ</label>
              <input value={edit.note || ""} onChange={(e) => setEdit((p) => ({ ...p, note: e.target.value }))} style={inp} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setEdit(null)} style={{ padding: "8px 16px", background: "#e5e7eb", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma" }}>ปิด</button>
              <button onClick={saveEdit} disabled={saving} style={{ padding: "8px 20px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Tahoma", fontWeight: 700 }}>{saving ? "..." : "💾 บันทึก"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
