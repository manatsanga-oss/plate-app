import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

export default function BankMovementsPage({ currentUser }) {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchAccounts();
    // default = เดือนปัจจุบัน
    const now = new Date();
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setDateFrom(fmt(new Date(now.getFullYear(), now.getMonth(), 1)));
    setDateTo(fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => {
    if (accountId && dateFrom && dateTo) fetchMovements();
    /* eslint-disable-next-line */
  }, [accountId, dateFrom, dateTo]);

  async function fetchAccounts() {
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setAccounts(arr);
      if (arr.length && !accountId) setAccountId(String(arr[0].account_id));
    } catch { setAccounts([]); }
  }

  async function fetchMovements() {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_bank_movements",
          account_id: Number(accountId),
          date_from: dateFrom,
          date_to: dateTo,
        }),
      });
      const data = await res.json();
      setMovements(Array.isArray(data) ? data : []);
    } catch { setMessage("❌ โหลดไม่สำเร็จ"); setMovements([]); }
    setLoading(false);
  }

  const acc = accounts.find(a => String(a.account_id) === String(accountId));

  function fmtNum(v) {
    return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // Calculate balances (amount เป็น NET หลังหัก WHT แล้ว — out = ติดลบ, in = บวก)
  const opening = Number(acc?.opening_balance || 0);
  const totalIn = movements.filter(m => m.direction === "in").reduce((s, m) => s + Number(m.amount || 0), 0);
  const totalOut = movements.filter(m => m.direction === "out").reduce((s, m) => s + Math.abs(Number(m.amount || 0)), 0);
  const currentBalance = opening + totalIn - totalOut;
  // เรียง ASC (เก่าก่อน → ใหม่หลัง) สำหรับคำนวณ running balance
  const sortedAsc = movements.slice().sort((a, b) => new Date(a.movement_date) - new Date(b.movement_date));
  const movementsWithBalance = [];
  let runningBalance = opening;
  for (const m of sortedAsc) {
    const amt = Number(m.amount || 0);
    runningBalance += amt;
    movementsWithBalance.push({ ...m, running_balance: runningBalance });
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📊 รายงานการเคลื่อนไหวบัญชีธนาคาร</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: "#fee2e2", color: "#991b1b" }}>{message}</div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>บัญชี:</label>
        <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ ...inp, minWidth: 280 }}>
          <option value="">-- เลือกบัญชี --</option>
          {accounts.map(a => (
            <option key={a.account_id} value={a.account_id}>
              {a.bank_name} · {a.account_no} · {a.account_name}
            </option>
          ))}
        </select>
        <label style={{ fontSize: 13, fontWeight: 600 }}>ช่วง:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <button onClick={fetchMovements} disabled={loading}
          style={{ padding: "7px 16px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>
      </div>

      {/* Balance summary */}
      {acc && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
          <Card label="ยอดยกมา" value={fmtNum(opening)} color="#6b7280" sub={acc.opening_date ? fmtDate(acc.opening_date) : ""} />
          <Card label="💰 รับเข้า (DR)" value={fmtNum(totalIn)} color="#059669" />
          <Card label="📤 จ่ายออก (CR)" value={fmtNum(totalOut)} color="#dc2626" />
          <Card label="💵 ยอดคงเหลือ" value={fmtNum(currentBalance)} color="#7c3aed" highlight />
        </div>
      )}

      {/* Movements table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : movements.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
            {accountId ? "ไม่มีรายการเคลื่อนไหวในช่วงนี้" : "เลือกบัญชีก่อน"}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}>วัน-เวลา</th>
                <th style={th}>เลขที่เอกสาร</th>
                <th style={th}>ประเภท</th>
                <th style={th}>คู่ค้า / Vendor</th>
                <th style={th}>วิธี</th>
                <th style={th}>หมายเหตุ</th>
                <th style={{ ...th, textAlign: "right" }}>DR</th>
                <th style={{ ...th, textAlign: "right" }}>CR</th>
                <th style={{ ...th, textAlign: "right" }}>คงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening balance row */}
              <tr style={{ borderTop: "1px solid #e5e7eb", background: "#fef9c3", fontWeight: 600 }}>
                <td style={td}>{acc?.opening_date ? fmtDate(acc.opening_date) : "-"}</td>
                <td style={{ ...td }} colSpan={5}>📌 ยอดยกมา</td>
                <td style={tdNum}>-</td>
                <td style={tdNum}>-</td>
                <td style={{ ...tdNum, color: opening >= 0 ? "#059669" : "#dc2626" }}>{fmtNum(opening)}</td>
              </tr>
              {movementsWithBalance.map((m, i) => {
                const amt = Number(m.amount || 0);
                const isIn = amt >= 0;
                const dr = isIn ? Math.abs(amt) : 0;
                const cr = !isIn ? Math.abs(amt) : 0;
                return (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb", background: isIn ? "#f0fdf4" : "#fef2f2" }}>
                    <td style={td}>{fmtDate(m.movement_date)}</td>
                    <td style={{ ...td, fontFamily: "monospace", color: "#0369a1", fontWeight: 600 }}>{m.doc_no || "-"}</td>
                    <td style={td}>{m.movement_type}</td>
                    <td style={td}>{m.counterparty || "-"}</td>
                    <td style={td}>{m.payment_method || "-"}</td>
                    <td style={{ ...td, fontSize: 12, color: "#6b7280" }}>{m.note || ""}</td>
                    <td style={{ ...tdNum, color: "#059669", fontWeight: 700 }}>{dr > 0 ? fmtNum(dr) : "-"}</td>
                    <td style={{ ...tdNum, color: "#dc2626", fontWeight: 700 }}>{cr > 0 ? fmtNum(cr) : "-"}</td>
                    <td style={{ ...tdNum, color: m.running_balance >= 0 ? "#059669" : "#dc2626", fontWeight: 700 }}>{fmtNum(m.running_balance)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
              <tr>
                <td colSpan={6} style={{ ...td, textAlign: "right" }}>รวม {movements.length} รายการ</td>
                <td style={{ ...tdNum, color: "#059669" }}>{fmtNum(totalIn)}</td>
                <td style={{ ...tdNum, color: "#dc2626" }}>{fmtNum(totalOut)}</td>
                <td style={{ ...tdNum, color: currentBalance >= 0 ? "#059669" : "#dc2626" }}>{fmtNum(currentBalance)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, color, sub, highlight }) {
  return (
    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: highlight ? `2px solid ${color}` : "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: highlight ? 22 : 18, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const tdNum = { padding: "8px", fontSize: 13, textAlign: "right", fontFamily: "monospace" };
