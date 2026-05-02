import React, { useEffect, useState } from "react";

const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const MASTER_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/master-data-api";

function fmt(v) {
  return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyForm = () => ({
  transfer_date: todayLocal(),
  finance_company: "",
  to_account_id: "",
  amount: 0,
  note: "",
});

export default function FinanceTransferPage({ currentUser }) {
  const [accounts, setAccounts] = useState([]);
  const [financeCompanies, setFinanceCompanies] = useState([]);
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
  const [matchFilter, setMatchFilter] = useState(""); // '' / 'pending' / 'matched'

  useEffect(() => {
    const now = new Date();
    setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    setDateTo(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`);
    fetchAccounts();
    fetchFinanceCompanies();
    /* eslint-disable-next-line */
  }, []);

  async function fetchFinanceCompanies() {
    try {
      const res = await fetch(MASTER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_finance_companies" }),
      });
      const data = await res.json();
      setFinanceCompanies(Array.isArray(data) ? data.filter(c => (c.status || "active") === "active") : []);
    } catch { setFinanceCompanies([]); }
  }

  useEffect(() => { if (dateFrom && dateTo) fetchData(); /* eslint-disable-next-line */ }, [dateFrom, dateTo]);

  async function fetchAccounts() {
    try {
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: false }),
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
        body: JSON.stringify({
          action: "list_finance_transfers",
          date_from: dateFrom || null,
          date_to: dateTo || null,
        }),
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
      transfer_date: r.transfer_date ? String(r.transfer_date).slice(0, 10) : todayLocal(),
      finance_company: r.finance_company || "",
      to_account_id: r.to_account_id || "",
      amount: Number(r.amount || 0),
      note: r.note || "",
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.transfer_date) { setMessage("⚠️ ระบุวันที่โอน"); return; }
    if (!form.finance_company) { setMessage("⚠️ ระบุไฟแนนท์"); return; }
    if (!form.to_account_id) { setMessage("⚠️ เลือกธนาคารที่รับโอน"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setMessage("⚠️ ระบุจำนวนเงิน"); return; }
    setSaving(true);
    try {
      const body = editTarget ? {
        action: "update_finance_transfer",
        ft_id: editTarget.ft_id || editTarget.id,
        ...form,
        amount: Number(form.amount),
        to_account_id: Number(form.to_account_id),
      } : {
        action: "save_finance_transfer",
        ...form,
        amount: Number(form.amount),
        to_account_id: Number(form.to_account_id),
        created_by: currentUser?.username || currentUser?.name || "system",
      };
      const res = await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save fail");
      setMessage(editTarget ? "✅ แก้ไขสำเร็จ" : "✅ บันทึกสำเร็จ");
      setShowForm(false);
      setEditTarget(null);
      fetchData();
    } catch (e) {
      setMessage("❌ " + e.message);
    }
    setSaving(false);
  }

  async function toggleMatchStatus(r) {
    const isMatched = r.match_status === "matched";
    const newStatus = isMatched ? "pending" : "matched";
    const action = isMatched ? "ย้อนสถานะกลับเป็น 'รอตัดรับชำระ'" : "ตัดรับชำระแล้ว";
    if (!window.confirm(`${action} — ${r.finance_company} จำนวน ${fmt(r.amount)} ?`)) return;
    try {
      await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_finance_transfer_matched",
          ft_id: r.ft_id || r.id,
          match_status: newStatus,
          matched_by: currentUser?.username || currentUser?.name || "system",
        }),
      });
      setMessage(`✅ ${action}สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ ไม่สำเร็จ"); }
  }

  async function cancel(r) {
    const isMatched = r.match_status === "matched";
    const warn = isMatched ? "\n\n⚠️ รายการนี้ตัดรับชำระแล้ว — การยกเลิกจะลบทั้งรายการรับเงิน + การตัดรับ" : "";
    if (!window.confirm(`ยกเลิกรายการโอน ${fmtDate(r.transfer_date)} จาก ${r.finance_company} จำนวน ${fmt(r.amount)} ?${warn}`)) return;
    try {
      await fetch(ACC_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_finance_transfer", ft_id: r.ft_id || r.id }),
      });
      setMessage(`✅ ยกเลิกสำเร็จ`);
      fetchData();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  const kw = search.trim().toLowerCase();
  const filtered = transfers.filter(r => {
    if (matchFilter && (r.match_status || "pending") !== matchFilter) return false;
    if (!kw) return true;
    const hay = [r.finance_company, r.bank_name, r.account_no, r.note, String(r.amount || "")]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const pendingCount = transfers.filter(r => (r.match_status || "pending") === "pending").length;
  const matchedCount = transfers.filter(r => r.match_status === "matched").length;

  const total = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💸 บันทึกรับเงินโอนไฟแนนท์</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>ช่วง:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา (ไฟแนนท์ / ธนาคาร / หมายเหตุ)"
          style={{ flex: 1, minWidth: 240, padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>
        <button onClick={openCreate}
          style={{ padding: "7px 18px", background: "#15803d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
          ➕ บันทึกรายการใหม่
        </button>
      </div>

      {/* Summary + Status filter (รวมในบรรทัดเดียว) */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14 }}>
        <span>📋 พบ <strong>{filtered.length}</strong> รายการ</span>
        <span>💰 ยอดรวม <strong style={{ color: "#15803d" }}>฿ {fmt(total)}</strong></span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            ["", "📋 ทั้งหมด", transfers.length],
            ["pending", "⏳ รอตัดรับชำระ", pendingCount],
            ["matched", "✅ ตัดรับชำระแล้ว", matchedCount],
          ].map(([v, label, n]) => (
            <button key={v} onClick={() => setMatchFilter(v)}
              style={{ padding: "5px 12px", border: "1px solid " + (matchFilter === v ? "#072d6b" : "#d1d5db"), background: matchFilter === v ? "#072d6b" : "#fff", color: matchFilter === v ? "#fff" : "#374151", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              {label} ({n})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>#</th>
              <th style={th}>วันที่โอน</th>
              <th style={th}>ไฟแนนท์</th>
              <th style={th}>ธนาคารที่รับโอน</th>
              <th style={{ ...th, textAlign: "right" }}>จำนวนเงิน</th>
              <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
              <th style={th}>หมายเหตุ</th>
              <th style={th}>ผู้บันทึก</th>
              <th style={{ ...th, width: 180 }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 30, color: "#6b7280" }}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>ยังไม่มีรายการ</td></tr>
            ) : filtered.map((r, i) => {
              const isMatched = r.match_status === "matched";
              return (
              <tr key={r.ft_id || r.id} style={{ borderTop: "1px solid #e5e7eb", background: isMatched ? "#ecfdf5" : undefined }}>
                <td style={{ ...td, textAlign: "center", color: "#6b7280" }}>{i + 1}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(r.transfer_date)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{r.finance_company || "-"}</td>
                <td style={td}>
                  {r.bank_name && <strong>{r.bank_name}</strong>}
                  {r.account_no && <div style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{r.account_no}</div>}
                  {!r.bank_name && !r.account_no && <span style={{ color: "#9ca3af" }}>-</span>}
                </td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#15803d", fontWeight: 700 }}>{fmt(r.amount)}</td>
                <td style={{ ...td, textAlign: "center" }}>
                  {isMatched ? (
                    <span style={{ display: "inline-block", padding: "2px 10px", background: "#dcfce7", color: "#065f46", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>✅ ตัดรับชำระแล้ว</span>
                  ) : (
                    <span style={{ display: "inline-block", padding: "2px 10px", background: "#fef3c7", color: "#92400e", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>⏳ รอตัดรับชำระ</span>
                  )}
                </td>
                <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{r.note || "-"}</td>
                <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{r.created_by || "-"}</td>
                <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                  <button onClick={() => toggleMatchStatus(r)}
                    title={isMatched ? "ย้อนสถานะ" : "ตัดรับชำระ"}
                    style={{ padding: "3px 10px", background: isMatched ? "#7c3aed" : "#15803d", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 }}>
                    {isMatched ? "↩️ ย้อน" : "✓ ตัดรับ"}
                  </button>
                  <button onClick={() => openEdit(r)}
                    title="แก้ไข"
                    style={{ padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, marginRight: 4 }}>✏️ แก้</button>
                  <button onClick={() => cancel(r)}
                    title="ยกเลิก"
                    style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>🗑️</button>
                </td>
              </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot style={{ background: "#f1f5f9", fontWeight: 700 }}>
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} รายการ</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#15803d" }}>{fmt(total)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          onClick={() => !saving && setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 24, borderRadius: 12, width: 520, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 16px", color: "#15803d" }}>{editTarget ? "✏️ แก้ไขรายการ" : "➕ บันทึกรับเงินโอนไฟแนนท์"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>📅 วันที่โอน *</label>
                <input type="date" value={form.transfer_date}
                  onChange={e => setForm(p => ({ ...p, transfer_date: e.target.value }))}
                  style={inp} />
              </div>
              <div>
                <label style={lbl}>💰 จำนวนเงิน *</label>
                <input type="number" step="0.01" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) || 0 }))}
                  style={{ ...inp, fontFamily: "monospace", textAlign: "right" }} />
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>🏢 ไฟแนนท์ *</label>
                <select value={form.finance_company}
                  onChange={e => setForm(p => ({ ...p, finance_company: e.target.value }))}
                  style={inp}>
                  <option value="">-- เลือกไฟแนนท์ --</option>
                  {financeCompanies.map(c => (
                    <option key={c.id || c.company_name} value={c.company_name}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
                {financeCompanies.length === 0 && (
                  <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>
                    ⚠️ ยังไม่มีบริษัทไฟแนนท์ — ไปเพิ่มที่ Master Data → Finance
                  </div>
                )}
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>🏦 ธนาคารที่รับโอน *</label>
                <select value={form.to_account_id}
                  onChange={e => setForm(p => ({ ...p, to_account_id: e.target.value }))}
                  style={inp}>
                  <option value="">-- เลือกบัญชี --</option>
                  {accounts.map(a => (
                    <option key={a.account_id} value={a.account_id}>
                      {a.bank_name} · {a.account_no} · {a.account_name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / span 2" }}>
                <label style={lbl}>หมายเหตุ</label>
                <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} rows={2}
                  style={{ ...inp, resize: "vertical" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => setShowForm(false)} disabled={saving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={save} disabled={saving}
                style={{ padding: "8px 24px", background: saving ? "#9ca3af" : "#15803d", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 13 };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const inp = { width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontFamily: "Tahoma", boxSizing: "border-box" };
