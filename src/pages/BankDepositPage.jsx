import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/finance-api";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const emptyForm = () => ({
  deposit_date: todayLocal(),
  to_account_id: "",
  amount: 0,
  source: "",
  note: "",
});

export default function BankDepositPage({ currentUser }) {
  const [accounts, setAccounts] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const isAdmin = currentUser?.role === "admin";
  // ดึง branch_code (ส่วนหน้าของ branch e.g., "SCY01 สำนักงานใหญ่" → "SCY01")
  const userBranch = String(currentUser?.branch || "").trim();
  const userBranchCode = userBranch.includes(" ") ? userBranch.split(" ")[0] : userBranch;
  const userBranchName = userBranch.includes(" ") ? userBranch.split(" ").slice(1).join(" ") : userBranch;

  useEffect(() => {
    const now = new Date();
    setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);
    fetchAccounts();
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => { if (dateFrom && dateTo) fetchData(); /* eslint-disable-next-line */ }, [dateFrom, dateTo]);

  async function fetchAccounts() {
    try {
      // ใช้ accounting-api เพื่อดึงรายการบัญชีธนาคาร (มีอยู่แล้ว)
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
      });
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch { setAccounts([]); }
  }

  async function fetchData() {
    setLoading(true);
    try {
      const body = {
        action: "list_bank_deposits",
        date_from: dateFrom,
        date_to: dateTo,
        search: search.trim(),
      };
      // user ทั่วไปเห็นเฉพาะร้านตัวเอง · admin เห็นทุกร้าน
      if (!isAdmin && userBranchCode) body.branch_code = userBranchCode;
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setDeposits(Array.isArray(data) ? data : []);
    } catch { setDeposits([]); }
    setLoading(false);
  }

  function openNew() {
    setForm(emptyForm());
    setEditTarget(null);
    setShowForm(true);
  }

  function openEdit(d) {
    setForm({
      deposit_date: d.deposit_date ? new Date(d.deposit_date).toISOString().slice(0, 16) : todayLocal(),
      to_account_id: d.to_account_id || "",
      amount: d.amount || 0,
      source: d.source || "",
      note: d.note || "",
    });
    setEditTarget(d);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.to_account_id) { setMessage("❌ เลือกบัญชีรับฝาก"); return; }
    if (!Number(form.amount) || Number(form.amount) <= 0) { setMessage("❌ กรอกจำนวนเงิน"); return; }
    setSaving(true); setMessage("");
    try {
      const body = {
        action: editTarget ? "update_bank_deposit" : "save_bank_deposit",
        ...(editTarget ? { deposit_id: editTarget.deposit_id } : {}),
        ...form,
        amount: Number(form.amount),
        to_account_id: Number(form.to_account_id),
        created_by: currentUser?.username || currentUser?.name || "system",
        branch_code: userBranchCode,
        branch_name: userBranchName,
      };
      await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setShowForm(false);
      setEditTarget(null);
      setMessage(`✅ ${editTarget ? "แก้ไข" : "บันทึก"}สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function handleCancel(d) {
    if (!window.confirm(`ยกเลิกรายการฝากเงิน ${d.deposit_doc_no}?`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_bank_deposit", deposit_id: d.deposit_id }),
      });
      setMessage("✅ ยกเลิกสำเร็จ");
      fetchData();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  function printSlip(d) {
    const safe = s => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const today = new Date();
    const pad = n => String(n).padStart(2, "0");
    const printDate = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear() + 543} ${pad(today.getHours())}:${pad(today.getMinutes())}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ใบฝากเงิน ${safe(d.deposit_doc_no)}</title>
<style>
@page { size: A5 portrait; margin: 10mm; }
body { font-family: 'Tahoma','Arial',sans-serif; font-size: 11pt; }
h1 { text-align: center; margin: 0 0 4px; font-size: 16pt; color: #059669; }
.head { text-align: center; margin-bottom: 14px; font-size: 10pt; color: #444; }
.info { display: grid; grid-template-columns: 1fr 2fr; gap: 8px 12px; margin-bottom: 16px; padding: 14px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; font-size: 11pt; }
.label { font-weight: 600; color: #374151; }
.value { color: #1f2937; }
.amount { font-size: 22pt; font-weight: 700; color: #059669; text-align: center; padding: 14px; background: #fff; border: 2px solid #059669; border-radius: 8px; margin: 12px 0; }
.sign-box { display: inline-block; width: 45%; margin-top: 30px; padding: 0 10px; vertical-align: top; }
</style></head><body>
<h1>📋 ใบบันทึกฝากเงิน</h1>
<div class="head">เลขที่: <strong>${safe(d.deposit_doc_no)}</strong> · พิมพ์: ${printDate}</div>

<div class="info">
  <div class="label">วันที่ฝาก:</div>
  <div class="value">${fmtDate(d.deposit_date)}</div>

  <div class="label">ร้าน/สาขา:</div>
  <div class="value"><strong>${safe(d.branch_code || "-")}</strong> ${safe(d.branch_name || "")}</div>

  <div class="label">บัญชีที่ฝาก:</div>
  <div class="value">${safe(d.to_account_name || "-")}</div>

  <div class="label">แหล่งที่มา:</div>
  <div class="value">${safe(d.source || "-")}</div>

  <div class="label">หมายเหตุ:</div>
  <div class="value">${safe(d.note || "-")}</div>

  <div class="label">ผู้บันทึก:</div>
  <div class="value">${safe(d.created_by || "-")}</div>
</div>

<div class="amount">
  💰 จำนวนเงิน: ${fmt(d.amount)} บาท
</div>

<div style="margin-top:25px;">
  <div class="sign-box"><div style="height:35px"></div><div style="border-top:1px solid #333;padding-top:4px;text-align:center">ลงชื่อ ........................................................<br/>ผู้ฝาก</div></div>
  <div class="sign-box"><div style="height:35px"></div><div style="border-top:1px solid #333;padding-top:4px;text-align:center">ลงชื่อ ........................................................<br/>ผู้รับ</div></div>
</div>
</body></html>`;
    const w = window.open("", "_blank", "width=700,height=800");
    if (!w) { setMessage("❌ Popup ถูกบล็อก"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  function printList() {
    if (filtered.length === 0) { setMessage("ไม่มีรายการให้พิมพ์"); return; }
    const safe = s => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const today = new Date();
    const pad = n => String(n).padStart(2, "0");
    const printDate = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear() + 543} ${pad(today.getHours())}:${pad(today.getMinutes())}`;
    const trs = filtered.map((d, i) => `<tr>
      <td>${i + 1}</td>
      <td class="mono">${safe(d.deposit_doc_no)}</td>
      <td>${fmtDate(d.deposit_date)}</td>
      <td>${safe(d.branch_code || "")} ${safe(d.branch_name || "")}</td>
      <td>${safe(d.to_account_name || "-")}</td>
      <td>${safe(d.source || "-")}</td>
      <td class="num">${fmt(d.amount)}</td>
    </tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>รายงานฝากเงิน</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: 'Tahoma','Arial',sans-serif; font-size: 10pt; }
h1 { text-align: center; margin: 0 0 4px; font-size: 14pt; color: #059669; }
.head { text-align: center; margin-bottom: 12px; font-size: 9pt; color: #444; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #555; padding: 4px 6px; font-size: 9pt; text-align: left; }
th { background: #f0fdf4; }
.num { text-align: right; font-family: monospace; font-weight: 600; }
.mono { font-family: monospace; }
.total { font-weight: 700; background: #fef9c3; }
</style></head><body>
<h1>📋 รายงานบันทึกฝากเงิน</h1>
<div class="head">ช่วงวันที่: ${dateFrom} - ${dateTo} · พิมพ์: ${printDate}</div>
<table>
  <thead><tr><th>#</th><th>เลขที่</th><th>วันที่</th><th>ร้าน/สาขา</th><th>บัญชีรับฝาก</th><th>แหล่งที่มา</th><th>ยอด</th></tr></thead>
  <tbody>
    ${trs}
    <tr class="total"><td colspan="6" style="text-align:right">รวม ${filtered.length} รายการ</td><td class="num">${fmt(grandTotal)}</td></tr>
  </tbody>
</table>
</body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { setMessage("❌ Popup ถูกบล็อก"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  const filtered = deposits.filter(d => {
    if (!search.trim()) return true;
    const kw = search.trim().toLowerCase();
    return [d.deposit_doc_no, d.to_account_name, d.source, d.note].filter(Boolean).join(" ").toLowerCase().includes(kw);
  });

  const grandTotal = filtered.reduce((s, d) => s + Number(d.amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💰 บันทึกรายการฝากเงิน</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>วันที่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหา (เลขที่, บัญชี, แหล่งที่มา)" style={{ ...inp, flex: 1, minWidth: 220 }} />
        <button onClick={fetchData} disabled={loading} style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>
        <button onClick={openNew} style={{ padding: "7px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          ➕ บันทึกฝากเงินใหม่
        </button>
        <button onClick={printList} disabled={filtered.length === 0} title="พิมพ์รายงานสรุป"
          style={{ padding: "7px 18px", background: filtered.length === 0 ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: filtered.length === 0 ? "not-allowed" : "pointer", fontWeight: 600 }}>
          🖨️ พิมพ์รายงาน
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}>
        <span>📋 รายการ: <strong>{filtered.length}</strong></span>
        <span>💰 ยอดรวม: <strong style={{ color: "#059669" }}>{fmt(grandTotal)}</strong> บาท</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>เลขที่</th>
                <th style={th}>วันที่</th>
                <th style={th}>ร้าน/สาขา</th>
                <th style={th}>บัญชีรับฝาก</th>
                <th style={th}>แหล่งที่มา</th>
                <th style={th}>หมายเหตุ</th>
                <th style={{ ...th, textAlign: "right" }}>ยอด</th>
                <th style={th}>ผู้บันทึก</th>
                <th style={th}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.deposit_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{d.deposit_doc_no || "-"}</td>
                  <td style={td}>{fmtDate(d.deposit_date)}</td>
                  <td style={td}>
                    {d.branch_code && <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{d.branch_code}</span>}
                    {d.branch_code && d.branch_name && <span> </span>}
                    {d.branch_name && <span style={{ fontSize: 12, color: "#374151" }}>{d.branch_name}</span>}
                    {!d.branch_code && !d.branch_name && <span style={{ color: "#9ca3af" }}>-</span>}
                  </td>
                  <td style={td}>{d.to_account_name || "-"}</td>
                  <td style={td}>{d.source || "-"}</td>
                  <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{d.note || ""}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>{fmt(d.amount)}</td>
                  <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{d.created_by || "-"}</td>
                  <td style={td}>
                    <button onClick={() => printSlip(d)} title="พิมพ์ใบฝาก" style={btnPrint}>🖨️</button>
                    <button onClick={() => openEdit(d)} style={btnEdit}>✏️</button>
                    <button onClick={() => handleCancel(d)} style={btnDelete}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 540, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#059669" }}>{editTarget ? "✏️ แก้ไขรายการฝาก" : "💰 บันทึกฝากเงิน"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>ร้าน/สาขา (auto)</label>
                <div style={{ padding: "8px 12px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 6, fontSize: 14, fontWeight: 600, color: "#0369a1" }}>
                  {userBranchCode || "-"} {userBranchName && <span style={{ color: "#374151", fontWeight: 400 }}>· {userBranchName}</span>}
                </div>
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>วันที่/เวลา *</label>
                <input type="datetime-local" value={form.deposit_date} onChange={e => setForm(p => ({ ...p, deposit_date: e.target.value }))} style={inp2} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>บัญชีที่รับฝาก *</label>
                <select value={form.to_account_id} onChange={e => setForm(p => ({ ...p, to_account_id: e.target.value }))} style={inp2}>
                  <option value="">-- เลือกบัญชี --</option>
                  {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>จำนวนเงิน *</label>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={{ ...inp2, fontFamily: "monospace", textAlign: "right", fontSize: 16, fontWeight: 700 }} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>แหล่งที่มา</label>
                <input type="text" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="เช่น ฝากเงินสดประจำวัน, รับเงินลูกค้า, อื่นๆ" style={inp2} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} rows={2} style={{ ...inp2, resize: "vertical" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setShowForm(false)} disabled={saving} style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "8px 24px", background: saving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = { padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const inp2 = { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "Tahoma", fontSize: 13 };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const th = { padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 12 };
const td = { padding: "8px 12px", fontSize: 12, color: "#1f2937" };
const btnPrint = { padding: "3px 8px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnEdit = { padding: "3px 8px", background: "#0891b2", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 };
const btnDelete = { padding: "3px 8px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 };
