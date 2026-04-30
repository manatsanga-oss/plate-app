import React, { useEffect, useState } from "react";

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
  transfer_date: todayLocal(),
  from_account_id: "",
  to_account_id: "",
  amount: 0,
  fee: 0,
  note: "",
});

export default function BankTransferPage({ currentUser }) {
  const [accounts, setAccounts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editTarget, setEditTarget] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

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
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bank_transfer", op: "list", date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json();
      setTransfers(Array.isArray(data) ? data : []);
    } catch { setTransfers([]); }
    setLoading(false);
  }

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm());
    setShowForm(true);
  }
  function openEdit(r) {
    setEditTarget(r);
    setForm({
      transfer_date: r.transfer_date ? String(r.transfer_date).slice(0, 16) : todayLocal(),
      from_account_id: r.from_account_id || "",
      to_account_id: r.to_account_id || "",
      amount: Number(r.amount) || 0,
      fee: Number(r.fee) || 0,
      note: r.note || "",
    });
    setShowForm(true);
  }
  function close() { setShowForm(false); setEditTarget(null); setForm(emptyForm()); }

  async function handleSave() {
    if (!form.from_account_id) { setMessage("❌ เลือกบัญชีต้นทาง"); return; }
    if (!form.to_account_id) { setMessage("❌ เลือกบัญชีปลายทาง"); return; }
    if (Number(form.from_account_id) === Number(form.to_account_id)) { setMessage("❌ บัญชีต้นทางและปลายทางต้องไม่ใช่บัญชีเดียวกัน"); return; }
    if (!Number(form.amount) || Number(form.amount) <= 0) { setMessage("❌ ระบุยอดโอน"); return; }
    setSaving(true);
    try {
      const body = {
        action: "bank_transfer", op: "save",
        transfer_id: editTarget?.transfer_id || null,
        transfer_date: form.transfer_date,
        from_account_id: Number(form.from_account_id),
        to_account_id: Number(form.to_account_id),
        amount: Number(form.amount) || 0,
        fee: Number(form.fee) || 0,
        note: form.note || "",
        created_by: currentUser?.username || currentUser?.name || "system",
      };
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data?.transfer_id || data?.[0]?.transfer_id || data?.transfer_doc_no) {
        setMessage(editTarget ? "✅ แก้ไขเรียบร้อย" : `✅ บันทึกเรียบร้อย ${data?.transfer_doc_no || data?.[0]?.transfer_doc_no || ""}`);
        close();
        fetchData();
      } else { setMessage("❌ บันทึกไม่สำเร็จ"); }
    } catch (e) { setMessage("❌ " + e.message); }
    setSaving(false);
  }
  async function handleCancel(r) {
    if (!window.confirm(`ยกเลิกใบโอน ${r.transfer_doc_no}?`)) return;
    try {
      await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bank_transfer", op: "cancel", transfer_id: r.transfer_id }),
      });
      setMessage("✅ ยกเลิกเรียบร้อย");
      fetchData();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  const kw = search.trim().toLowerCase();
  const filtered = transfers.filter(t => {
    if (!kw) return true;
    const hay = [t.transfer_doc_no, t.from_account_name, t.to_account_name, t.note].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const totalAmount = filtered.reduce((s, t) => s + (Number(t.status === "cancelled" ? 0 : t.amount) || 0), 0);
  const totalFee = filtered.reduce((s, t) => s + (Number(t.status === "cancelled" ? 0 : t.fee) || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🔁 โอนเงินระหว่างบัญชี</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8,
          background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2",
          color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 14 }}>
          {message}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label>วันที่:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔎 ค้นหา (เลขใบ / บัญชี / หมายเหตุ)"
          style={{ ...inp, flex: 1, minWidth: 200 }} />
        <button onClick={fetchData} style={btn("#0369a1")}>🔄 รีเฟรช</button>
        <button onClick={openCreate} style={btn("#059669")}>+ สร้างใบโอน</button>
      </div>

      <div style={{ display: "flex", gap: 14, padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 12 }}>
        <span>📑 ใบโอน: <strong>{filtered.length}</strong></span>
        <span style={{ color: "#7c3aed" }}>💰 ยอดรวม: <strong>{fmt(totalAmount)}</strong> บาท</span>
        {totalFee > 0 && <span style={{ color: "#dc2626" }}>+ ค่าธรรมเนียม: <strong>{fmt(totalFee)}</strong> บาท</span>}
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        {loading ? <div style={{ padding: 30, textAlign: "center" }}>กำลังโหลด...</div> :
         filtered.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการ</div> :
         <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>เลขใบโอน</th>
              <th style={th}>วัน-เวลา</th>
              <th style={th}>จากบัญชี</th>
              <th style={th}>→</th>
              <th style={th}>ไปยังบัญชี</th>
              <th style={{ ...th, textAlign: "right" }}>ยอด</th>
              <th style={{ ...th, textAlign: "right" }}>ค่าธรรมเนียม</th>
              <th style={th}>หมายเหตุ</th>
              <th style={th}>สถานะ</th>
              <th style={{ ...th, width: 130 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const cancelled = t.status === "cancelled";
              return (
                <tr key={t.transfer_id} style={{ borderTop: "1px solid #e5e7eb", background: cancelled ? "#fef2f2" : "transparent" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{t.transfer_doc_no}</td>
                  <td style={td}>{fmtDate(t.transfer_date)}</td>
                  <td style={td}><div style={{ fontSize: 12 }}><b>{t.from_bank_name || "-"}</b></div><div style={{ fontSize: 11, color: "#6b7280" }}>{t.from_account_no || ""} · {t.from_account_name || ""}</div></td>
                  <td style={{ ...td, textAlign: "center", color: "#7c3aed" }}>→</td>
                  <td style={td}><div style={{ fontSize: 12 }}><b>{t.to_bank_name || "-"}</b></div><div style={{ fontSize: 11, color: "#6b7280" }}>{t.to_account_no || ""} · {t.to_account_name || ""}</div></td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: cancelled ? "#9ca3af" : "#059669", textDecoration: cancelled ? "line-through" : "none" }}>{fmt(t.amount)}</td>
                  <td style={{ ...td, textAlign: "right", color: "#dc2626" }}>{Number(t.fee) > 0 ? fmt(t.fee) : "-"}</td>
                  <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{t.note || "-"}</td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: cancelled ? "#fee2e2" : "#d1fae5",
                      color: cancelled ? "#991b1b" : "#065f46" }}>
                      {cancelled ? "ยกเลิก" : "เสร็จสมบูรณ์"}
                    </span>
                  </td>
                  <td style={td}>
                    {!cancelled && <>
                      <button onClick={() => openEdit(t)} style={{ ...btnSm, background: "#0369a1" }}>✏️ แก้</button>
                      <button onClick={() => handleCancel(t)} style={{ ...btnSm, background: "#dc2626" }}>✕</button>
                    </>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !saving && close()}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>{editTarget ? `✏️ แก้ไขใบโอน — ${editTarget.transfer_doc_no}` : "🔁 สร้างใบโอนใหม่"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>วัน-เวลา *</label>
                <input type="datetime-local" value={form.transfer_date}
                  onChange={e => setForm(f => ({ ...f, transfer_date: e.target.value }))} style={inp} />
              </div>
              <div style={{ gridColumn: "1 / span 2", padding: 12, background: "#fef9c3", border: "1px solid #fcd34d", borderRadius: 8 }}>
                <label style={{ ...lbl, color: "#78350f" }}>📤 โอนจากบัญชี (ต้นทาง) *</label>
                <select value={form.from_account_id}
                  onChange={e => setForm(f => ({ ...f, from_account_id: e.target.value }))} style={inp}>
                  <option value="">-- เลือกบัญชีต้นทาง --</option>
                  {accounts.map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / span 2", padding: 12, background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8 }}>
                <label style={{ ...lbl, color: "#166534" }}>📥 โอนเข้าบัญชี (ปลายทาง) *</label>
                <select value={form.to_account_id}
                  onChange={e => setForm(f => ({ ...f, to_account_id: e.target.value }))} style={inp}>
                  <option value="">-- เลือกบัญชีปลายทาง --</option>
                  {accounts.filter(a => Number(a.account_id) !== Number(form.from_account_id)).map(a => <option key={a.account_id} value={a.account_id}>{a.bank_name} · {a.account_no} · {a.account_name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>ยอดโอน (บาท) *</label>
                <input type="number" step="0.01" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ ...inp, textAlign: "right", fontFamily: "monospace", fontSize: 16, fontWeight: 700 }} />
              </div>
              <div>
                <label style={lbl}>ค่าธรรมเนียม (บาท)</label>
                <input type="number" step="0.01" value={form.fee}
                  onChange={e => setForm(f => ({ ...f, fee: e.target.value }))}
                  style={{ ...inp, textAlign: "right", fontFamily: "monospace" }} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} style={inp} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={close} disabled={saving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: "8px 24px", background: saving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : (editTarget ? "💾 บันทึกแก้ไข" : "💾 บันทึกใบโอน")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3 };
const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 13, verticalAlign: "middle" };
const btn = (color) => ({ padding: "7px 14px", background: color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 });
const btnSm = { padding: "4px 10px", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600, marginRight: 4 };
