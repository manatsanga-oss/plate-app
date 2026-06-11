import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

export default function BankMovementsPage({ currentUser }) {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [movements, setMovements] = useState([]);
  const [priorSum, setPriorSum] = useState(0); // ผลรวมรายการก่อน date_from (สำหรับยอดยกมาของช่วง)
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [message, setMessage] = useState("");
  const [ccDetail, setCcDetail] = useState(null); // { date, rows, loading }
  const [editDate, setEditDate] = useState(null); // { original_date, current_settlement, hasOverride }
  const [savingDate, setSavingDate] = useState(false);

  function openEditDate(originalDate, currentSettlement, hasOverride) {
    setEditDate({
      original_date: originalDate,
      settlement_date: currentSettlement || originalDate,
      hasOverride: !!hasOverride,
    });
  }

  async function saveOverride() {
    if (!editDate?.settlement_date) return;
    setSavingDate(true);
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_cc_settlement_override",
          account_id: Number(accountId),
          original_date: editDate.original_date,
          settlement_date: editDate.settlement_date,
          updated_by: currentUser || "",
        }),
      });
      setEditDate(null);
      await fetchMovements();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSavingDate(false);
  }

  async function deleteOverride() {
    if (!window.confirm("ลบการแก้วันที่ — กลับเป็น auto +1 วันทำการ ?")) return;
    setSavingDate(true);
    try {
      await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_cc_settlement_override",
          account_id: Number(accountId),
          original_date: editDate.original_date,
        }),
      });
      setEditDate(null);
      await fetchMovements();
    } catch { setMessage("❌ ลบไม่สำเร็จ"); }
    setSavingDate(false);
  }

  // doc_no = 'CC-YYMMDD' หรือ 'CC-YYMMDD-SCY01' → { date: '20YY-MM-DD', branch: 'SCY01' }
  function parseCc(docNo) {
    const m = String(docNo || "").match(/^CC-(\d{2})(\d{2})(\d{2})(?:-(.+))?$/);
    if (!m) return null;
    return { date: `20${m[1]}-${m[2]}-${m[3]}`, branch: m[4] || "" };
  }
  async function openCcDetail(originalDateISO, settlementDateStr, hasOverride, branch = "") {
    setCcDetail({ date: originalDateISO, settlement: settlementDateStr, hasOverride, branch, rows: [], loading: true });
    try {
      const res = await fetch(API_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_credit_card_detail",
          account_id: Number(accountId),
          receipt_date: originalDateISO,
          branch,
        }),
      });
      const data = await res.json();
      setCcDetail({ date: originalDateISO, settlement: settlementDateStr, hasOverride, branch, rows: Array.isArray(data) ? data : [], loading: false });
    } catch {
      setCcDetail({ date: originalDateISO, settlement: settlementDateStr, hasOverride, branch, rows: [], loading: false });
    }
  }

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
      // วันสุดท้ายก่อนช่วงที่เลือก — สำหรับคำนวณยอดยกมาสะสม
      const prev = new Date(dateFrom + "T00:00:00");
      prev.setDate(prev.getDate() - 1);
      const prevISO = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
      const [res, resPrior] = await Promise.all([
        fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "list_bank_movements",
            account_id: Number(accountId),
            date_from: dateFrom,
            date_to: dateTo,
          }),
        }),
        // รายการทั้งหมดก่อนช่วง → ยอดยกมา = opening_balance + ผลรวมนี้ (ใช้ action เดียวกัน เลขตรงกับตารางแน่นอน)
        fetch(API_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "list_bank_movements",
            account_id: Number(accountId),
            date_from: "2000-01-01",
            date_to: prevISO,
          }),
        }),
      ]);
      const data = await res.json();
      setMovements(Array.isArray(data) ? data : []);
      const prior = await resPrior.json().catch(() => []);
      setPriorSum((Array.isArray(prior) ? prior : []).reduce((s, m) => s + Number(m.amount || 0), 0));
    } catch { setMessage("❌ โหลดไม่สำเร็จ"); setMovements([]); setPriorSum(0); }
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
  // ยอดยกมาของช่วง = ยอดตั้งต้นบัญชี + รายการสะสมทั้งหมดก่อนวันเริ่มช่วง (เช่น เดือน 5 = ยอดปิด 30/04)
  const opening = Number(acc?.opening_balance || 0) + priorSum;
  // วันที่ของยอดยกมา: วันก่อนเริ่มช่วง — แต่ถ้าช่วงเริ่มก่อน/เท่ากับวันเปิดบัญชี ใช้วันเปิดบัญชีเดิม
  const prevOfFrom = (() => {
    if (!dateFrom) return acc?.opening_date || "";
    const d = new Date(dateFrom + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const openingDateLabel = acc?.opening_date && String(acc.opening_date).slice(0, 10) >= dateFrom ? acc.opening_date : prevOfFrom;
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
          <Card label="ยอดยกมา" value={fmtNum(opening)} color="#6b7280" sub={openingDateLabel ? fmtDate(openingDateLabel) : ""} />
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
                <td style={td}>{openingDateLabel ? fmtDate(openingDateLabel) : "-"}</td>
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
                    <td style={{ ...td, fontFamily: "monospace", color: "#0369a1", fontWeight: 600 }}>
                      {String(m.doc_no || "").startsWith("CC-") ? (
                        <span style={{ cursor: "pointer", textDecoration: "underline" }}
                              onClick={() => { const cc = parseCc(m.doc_no); if (cc) openCcDetail(cc.date, String(m.movement_date).slice(0, 10), false, cc.branch); }}>
                          {m.doc_no}
                        </span>
                      ) : (m.doc_no || "-")}
                    </td>
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

      {/* Edit settlement date popup */}
      {editDate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100 }}
             onClick={() => setEditDate(null)}>
          <div onClick={e => e.stopPropagation()}
               style={{ background: "#fff", borderRadius: 10, width: 420, padding: 20 }}>
            <h3 style={{ margin: "0 0 12px", color: "#072d6b" }}>✏️ แก้วันที่เงินเข้าบัญชี</h3>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
              วันที่รับชำระ (ใบเสร็จ): <strong>{editDate.original_date}</strong>
            </div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>วันที่เงินเข้าบัญชี:</label>
            <input type="date" value={editDate.settlement_date}
                   onChange={e => setEditDate({ ...editDate, settlement_date: e.target.value })}
                   style={{ ...inp, width: "100%", marginTop: 6, marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {editDate.hasOverride && (
                <button onClick={deleteOverride} disabled={savingDate}
                        style={{ padding: "7px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                  🗑️ ลบ override (กลับ auto)
                </button>
              )}
              <button onClick={() => setEditDate(null)} disabled={savingDate}
                      style={{ padding: "7px 14px", background: "#9ca3af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                ยกเลิก
              </button>
              <button onClick={saveOverride} disabled={savingDate}
                      style={{ padding: "7px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
                {savingDate ? "..." : "💾 บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CC Detail Popup */}
      {ccDetail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}
             onClick={() => setCcDetail(null)}>
          <div onClick={e => e.stopPropagation()}
               style={{ background: "#fff", borderRadius: 10, maxWidth: 1100, width: "92%", maxHeight: "85vh", overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: "#072d6b" }}>💳 รายละเอียดรับชำระบัตรเครดิต — {ccDetail.date}{ccDetail.branch ? ` · ${ccDetail.branch}` : ""}</h3>
              <button onClick={() => setCcDetail(null)} style={{ padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ ปิด</button>
            </div>
            {ccDetail.loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
            ) : ccDetail.rows.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#f0f4f9" }}>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>วันที่รับชำระ</th>
                    <th style={th}>เลขที่ใบเสร็จ</th>
                    <th style={th}>ลูกค้า</th>
                    <th style={th}>เลขใบขาย</th>
                    <th style={th}>เลขที่บัญชี</th>
                    <th style={{ ...th, textAlign: "right" }}>ยอดเงิน</th>
                    <th style={th}>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {ccDetail.rows.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>{fmtDate(r.original_date || r.receipt_date)}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{r.receipt_no || "-"}</td>
                      <td style={td}>{r.customer_name || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{r.sale_invoice_no || "-"}</td>
                      <td style={{ ...td, fontFamily: "monospace" }}>{r.bank_account_no || "-"}</td>
                      <td style={{ ...tdNum, fontWeight: 700 }}>{fmtNum(r.amount)}</td>
                      <td style={td}>{r.note || "-"}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                    <td colSpan={6} style={{ ...td, textAlign: "right" }}>รวม {ccDetail.rows.length} รายการ</td>
                    <td style={tdNum}>{fmtNum(ccDetail.rows.reduce((s, r) => s + Number(r.amount || 0), 0))}</td>
                    <td style={td}></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
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
