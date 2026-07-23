import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

const PAYMENT_METHODS = ["โอน", "เงินสด", "เช็ค", "หักบัญชี"];

const emptyForm = () => ({
  loan_id: "",
  payment_date: todayISO(),
  interest_amount: 0,
  principal_amount: 0,
  from_bank_account_id: "",
  payment_method: "โอน",
  note: "",
});

export default function LoanInterestPaymentPage({ currentUser }) {
  const [tab, setTab] = useState("new"); // new | history
  const [loans, setLoans] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [message, setMessage] = useState("");
  // history filters
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [filterLoanId, setFilterLoanId] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchLoans();
    fetchBankAccounts();
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => {
    if (tab === "history") fetchHistory();
    /* eslint-disable-next-line */
  }, [tab]);

  async function fetchLoans() {
    setLoadingLoans(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_loan_accounts" }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data?.rows || []);
      setLoans(arr.filter(r => r.status === "active"));
    } catch { setLoans([]); }
    setLoadingLoans(false);
  }

  async function fetchBankAccounts() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
      });
      const data = await res.json();
      setBankAccounts(Array.isArray(data) ? data : []);
    } catch { setBankAccounts([]); }
  }

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_loan_interest_payments",
          date_from: dateFrom,
          date_to: dateTo,
          loan_id: filterLoanId || null,
        }),
      });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : (data?.rows || []));
    } catch { setHistory([]); }
    setLoadingHistory(false);
  }

  async function handleSave() {
    const isOD = form.loan_id === "OD";
    const isFEE = form.loan_id === "FEE";
    if (!form.loan_id) { setMessage("❌ กรุณาเลือกบัญชีเงินกู้ / ดอกเบี้ย OD / ค่าธรรมเนียมธนาคาร"); return; }
    const interest = Number(form.interest_amount) || 0;
    const principal = Number(form.principal_amount) || 0;
    if (isOD || isFEE) {
      if (interest <= 0) { setMessage(`❌ กรุณากรอกยอด${isFEE ? "ค่าธรรมเนียม" : "ดอกเบี้ย"}`); return; }
      if (principal > 0) { setMessage(`❌ ${isFEE ? "ค่าธรรมเนียม" : "ดอกเบี้ย OD"} ไม่มีเงินต้น (ตั้งเป็น 0)`); return; }
    } else {
      if (interest <= 0 && principal <= 0) {
        setMessage("❌ กรุณากรอกยอดดอกเบี้ยหรือเงินต้นอย่างน้อย 1 ช่อง");
        return;
      }
    }
    if (form.payment_method === "โอน" && !form.from_bank_account_id) {
      setMessage("❌ กรุณาเลือกบัญชีโอนจาก"); return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_loan_interest_payment",
          loan_id: (isOD || isFEE) ? null : Number(form.loan_id),
          is_od: isOD,
          is_fee: isFEE,
          payment_date: form.payment_date,
          interest_amount: interest,
          principal_amount: principal,
          total_amount: interest + principal,
          from_bank_account_id: form.from_bank_account_id ? Number(form.from_bank_account_id) : null,
          payment_method: form.payment_method,
          note: isFEE ? `[ค่าธรรมเนียมธนาคาร] ${form.note || ""}`.trim() : (isOD ? `[ดอกเบี้ย OD] ${form.note || ""}`.trim() : form.note),
          created_by: currentUser?.username || currentUser?.name || "system",
        }),
      });
      const data = await res.json();
      if (data?.error_msg) throw new Error(data.error_msg);
      setMessage(`✅ บันทึกสำเร็จ ${data?.payment_id ? `(#${data.payment_id})` : ""}`);
      setForm(emptyForm());
      fetchLoans();
    } catch (e) {
      setMessage("❌ บันทึกไม่สำเร็จ: " + (e.message || ""));
    }
    setSaving(false);
  }

  async function handleCancel(r) {
    if (!window.confirm(`ยกเลิกการจ่าย #${r.payment_id} (${r.loan_name})\nยอดเงินต้นจะถูกบวกกลับเข้าบัญชีกู้`)) return;
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_loan_interest_payment",
          payment_id: r.payment_id,
          cancelled_by: currentUser?.username || currentUser?.name || "system",
        }),
      });
      setMessage(`✅ ยกเลิก #${r.payment_id} เรียบร้อย`);
      fetchHistory();
      fetchLoans();
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  // selected loan info
  const selectedLoan = loans.find(l => String(l.loan_id) === String(form.loan_id));

  // history filters
  const kw = search.trim().toLowerCase();
  const filteredHistory = history.filter(r => {
    if (!kw) return true;
    const hay = [r.loan_name, r.lender, r.note, r.bank_name, r.account_name].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });
  const totalInterest = filteredHistory.filter(r => r.status === "active").reduce((s, r) => s + Number(r.interest_amount || 0), 0);
  const totalPrincipal = filteredHistory.filter(r => r.status === "active").reduce((s, r) => s + Number(r.principal_amount || 0), 0);
  const totalAmount = totalInterest + totalPrincipal;

  const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
  const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3, color: "#374151" };
  const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12, background: "#072d6b", color: "#fff" };
  const td = { padding: "8px", borderBottom: "1px solid #e5e7eb", fontSize: 13 };
  const tdNum = { ...td, textAlign: "right", fontFamily: "monospace" };

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">💸 บันทึกจ่ายดอกเบี้ยธนาคาร</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, borderBottom: "2px solid #e5e7eb" }}>
        {[
          ["new", "📝 บันทึกใหม่"],
          ["history", "📜 ประวัติการจ่าย"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ padding: "10px 22px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "Tahoma", fontSize: 14, fontWeight: 600,
              color: tab === v ? "#072d6b" : "#6b7280",
              borderBottom: tab === v ? "3px solid #072d6b" : "3px solid transparent", marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b", fontSize: 13 }}>
          {message}
        </div>
      )}

      {/* TAB: บันทึกใหม่ */}
      {tab === "new" && (
        <div style={{ background: "#fff", padding: 22, borderRadius: 12, border: "1px solid #e5e7eb", maxWidth: 720 }}>
          <h3 style={{ margin: "0 0 16px", color: "#072d6b" }}>บันทึกการจ่ายเงินกู้</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / span 2" }}>
              <label style={lbl}>บัญชีเงินกู้ *</label>
              <select value={form.loan_id}
                onChange={e => setForm(p => ({ ...p, loan_id: e.target.value, principal_amount: e.target.value === "OD" ? 0 : p.principal_amount }))}
                style={inp}>
                <option value="">{loadingLoans ? "กำลังโหลด..." : "-- เลือกบัญชีเงินกู้ --"}</option>
                <option value="OD">💳 ดอกเบี้ย OD (จ่ายดอกของบัญชี OD ที่เลือก "โอนจาก")</option>
                <option value="FEE">🏦 ค่าธรรมเนียมธนาคาร (จ่ายค่าธรรมเนียมของบัญชีที่เลือก "โอนจาก")</option>
                {loans.length > 0 && <option disabled>──────────</option>}
                {loans.map(l => (
                  <option key={l.loan_id} value={l.loan_id}>
                    {l.loan_name}{l.account_no ? ` · ${l.account_no}` : ""} · {l.lender || "-"} · คงเหลือ ฿{fmt(l.current_balance)}
                  </option>
                ))}
              </select>
              {form.loan_id === "OD" && (
                <div style={{ marginTop: 6, padding: "8px 12px", background: "#dbeafe", border: "1px solid #3b82f6", borderRadius: 6, fontSize: 12, color: "#1e40af" }}>
                  💳 <strong>ดอกเบี้ย OD</strong> — จ่ายดอกเบี้ยของบัญชี OD โดยตรง (เลือกบัญชี OD ในช่อง "โอนจาก" ด้านล่าง)
                  <br />ไม่มีเงินต้น · ไม่กระทบยอดคงเหลือบัญชีกู้
                </div>
              )}
              {form.loan_id === "FEE" && (
                <div style={{ marginTop: 6, padding: "8px 12px", background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, fontSize: 12, color: "#92400e" }}>
                  🏦 <strong>ค่าธรรมเนียมธนาคาร</strong> — บันทึกค่าธรรมเนียมของบัญชีที่เลือก "โอนจาก"
                  <br />กรอกยอดในช่อง "ดอกเบี้ย" · ไม่มีเงินต้น · ไม่กระทบยอดคงเหลือ
                </div>
              )}
              {selectedLoan && (
                <div style={{ marginTop: 6, padding: "8px 12px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 6, fontSize: 12 }}>
                  📋 <strong>{selectedLoan.loan_name}</strong>{selectedLoan.account_no ? ` · เลขที่ ${selectedLoan.account_no}` : ""} · เจ้าหนี้: {selectedLoan.lender || "-"}<br />
                  💰 ยอดต้นเดิม: {fmt(selectedLoan.principal)} · คงเหลือปัจจุบัน: <strong style={{ color: "#dc2626" }}>{fmt(selectedLoan.current_balance)}</strong>
                  {Number(selectedLoan.interest_rate) > 0 && (
                    <> · 📈 ดอก: {fmt(selectedLoan.interest_rate)}% / {selectedLoan.interest_period}</>
                  )}
                </div>
              )}
            </div>

            <div>
              <label style={lbl}>วันที่จ่าย *</label>
              <input type="date" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={lbl}>วิธีจ่าย</label>
              <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))} style={inp}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label style={{ ...lbl, color: "#7c3aed" }}>📈 {form.loan_id === "FEE" ? "ค่าธรรมเนียม" : "ดอกเบี้ย"}</label>
              <input type="number" step="0.01" min="0" value={form.interest_amount}
                onChange={e => setForm(p => ({ ...p, interest_amount: e.target.value }))}
                style={{ ...inp, textAlign: "right", borderColor: "#a78bfa", background: "#f5f3ff" }} />
            </div>
            <div>
              <label style={{ ...lbl, color: "#dc2626" }}>💵 เงินต้น (จะหักจากคงเหลือ)</label>
              <input type="number" step="0.01" min="0" value={form.principal_amount}
                onChange={e => setForm(p => ({ ...p, principal_amount: e.target.value }))}
                disabled={form.loan_id === "OD" || form.loan_id === "FEE"}
                title={(form.loan_id === "OD" || form.loan_id === "FEE") ? "ไม่มีเงินต้น" : ""}
                style={{ ...inp, textAlign: "right", borderColor: "#fca5a5", background: (form.loan_id === "OD" || form.loan_id === "FEE") ? "#f3f4f6" : "#fef2f2", cursor: (form.loan_id === "OD" || form.loan_id === "FEE") ? "not-allowed" : "auto" }} />
            </div>

            <div style={{ gridColumn: "1 / span 2" }}>
              <label style={lbl}>โอนจาก (บัญชีบริษัท) {form.payment_method === "โอน" && "*"}</label>
              <select value={form.from_bank_account_id} onChange={e => setForm(p => ({ ...p, from_bank_account_id: e.target.value }))} style={inp}>
                <option value="">-- เลือกบัญชี --</option>
                {bankAccounts.map(b => (
                  <option key={b.account_id} value={b.account_id}>
                    {b.bank_name} · {b.account_no} · {b.account_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: "1 / span 2" }}>
              <label style={lbl}>หมายเหตุ</label>
              <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} rows={2} style={inp} />
            </div>

            <div style={{ gridColumn: "1 / span 2", padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, fontSize: 13, color: "#065f46" }}>
              💰 รวมทั้งสิ้น: <strong style={{ fontSize: 16 }}>฿ {fmt((Number(form.interest_amount) || 0) + (Number(form.principal_amount) || 0))}</strong>
              {Number(form.principal_amount) > 0 && selectedLoan && (
                <span style={{ marginLeft: 12, color: "#1e40af" }}>
                  → คงเหลือใหม่: <strong>฿ {fmt(Number(selectedLoan.current_balance) - (Number(form.principal_amount) || 0))}</strong>
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button onClick={() => setForm(emptyForm())} disabled={saving}
              style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>
              ✕ ล้าง
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: "8px 24px", background: saving ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer", fontWeight: 700 }}>
              {saving ? "กำลังบันทึก..." : "💾 บันทึกการจ่าย"}
            </button>
          </div>
        </div>
      )}

      {/* TAB: ประวัติการจ่าย */}
      {tab === "history" && (
        <div>
          {/* Filters */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>ตั้งแต่:</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
            <label style={{ fontSize: 13, fontWeight: 600 }}>ถึง:</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }} />
            <select value={filterLoanId} onChange={e => setFilterLoanId(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}>
              <option value="">-- ทุกบัญชีกู้ --</option>
              {loans.map(l => <option key={l.loan_id} value={l.loan_id}>{l.loan_name}{l.account_no ? ` · ${l.account_no}` : ""}</option>)}
            </select>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 ค้นหา"
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, minWidth: 200 }} />
            <button onClick={fetchHistory} disabled={loadingHistory}
              style={{ padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              {loadingHistory ? "..." : "🔍 ค้นหา"}
            </button>
          </div>

          {/* Summary */}
          <div style={{ display: "flex", gap: 18, marginBottom: 12, padding: "10px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fbbf24", fontSize: 14, flexWrap: "wrap" }}>
            <span>📋 จำนวน: <strong>{filteredHistory.length}</strong></span>
            <span>📈 ดอกเบี้ยรวม: <strong style={{ color: "#7c3aed" }}>฿ {fmt(totalInterest)}</strong></span>
            <span>💵 เงินต้นรวม: <strong style={{ color: "#dc2626" }}>฿ {fmt(totalPrincipal)}</strong></span>
            <span>💰 รวมทั้งสิ้น: <strong style={{ color: "#065f46", fontSize: 16 }}>฿ {fmt(totalAmount)}</strong></span>
          </div>

          {/* Table */}
          {loadingHistory ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280", background: "#fff", borderRadius: 10 }}>กำลังโหลด...</div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
              ไม่พบข้อมูล
            </div>
          ) : (
            <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 40 }}>#</th>
                    <th style={th}>วันที่</th>
                    <th style={th}>บัญชีกู้</th>
                    <th style={th}>เจ้าหนี้</th>
                    <th style={{ ...th, textAlign: "right" }}>ดอกเบี้ย</th>
                    <th style={{ ...th, textAlign: "right" }}>เงินต้น</th>
                    <th style={{ ...th, textAlign: "right" }}>รวม</th>
                    <th style={th}>วิธีจ่าย</th>
                    <th style={th}>จากบัญชี</th>
                    <th style={th}>หมายเหตุ</th>
                    <th style={th}>ผู้บันทึก</th>
                    <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
                    <th style={{ ...th, textAlign: "center", width: 70 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((r, i) => {
                    const isCancelled = r.status === "cancelled";
                    return (
                    <tr key={r.payment_id || i} style={{ background: isCancelled ? "#fef2f2" : i % 2 === 0 ? "#fff" : "#f9fafb", opacity: isCancelled ? 0.65 : 1 }}>
                      <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                      <td style={td}>{fmtDate(r.payment_date)}</td>
                      <td style={{ ...td, fontWeight: 600, color: "#072d6b" }}>{r.loan_name || "-"}</td>
                      <td style={td}>{r.lender || "-"}</td>
                      <td style={{ ...tdNum, color: "#7c3aed" }}>{fmt(r.interest_amount)}</td>
                      <td style={{ ...tdNum, color: "#dc2626" }}>{fmt(r.principal_amount)}</td>
                      <td style={{ ...tdNum, fontWeight: 700, color: "#065f46" }}>{fmt(r.total_amount)}</td>
                      <td style={td}>{r.payment_method || "-"}</td>
                      <td style={{ ...td, fontSize: 12 }}>
                        {r.bank_name ? `${r.bank_name} · ${r.account_no || ""}` : "-"}
                      </td>
                      <td style={{ ...td, maxWidth: 200, whiteSpace: "normal", fontSize: 12 }}>{r.note || "-"}</td>
                      <td style={td}>{r.created_by || "-"}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {isCancelled ? (
                          <span style={{ padding: "3px 10px", borderRadius: 12, background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 700 }}>❌ ยกเลิก</span>
                        ) : (
                          <span style={{ padding: "3px 10px", borderRadius: 12, background: "#d1fae5", color: "#065f46", fontSize: 11, fontWeight: 700 }}>✓ ใช้งาน</span>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        {!isCancelled && (
                          <button onClick={() => handleCancel(r)} title="ยกเลิก"
                            style={{ padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot style={{ background: "#fef9c3", fontWeight: 700 }}>
                  <tr>
                    <td colSpan={4} style={{ ...td, textAlign: "right" }}>รวม</td>
                    <td style={{ ...tdNum, color: "#7c3aed" }}>{fmt(totalInterest)}</td>
                    <td style={{ ...tdNum, color: "#dc2626" }}>{fmt(totalPrincipal)}</td>
                    <td style={{ ...tdNum, fontSize: 15, color: "#065f46" }}>{fmt(totalAmount)}</td>
                    <td colSpan={6}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
