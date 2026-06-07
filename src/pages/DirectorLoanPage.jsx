import React, { useEffect, useMemo, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";
const RECEIVABLE_TYPE = "ลูกหนี้"; // ประเภทบัญชีที่ใช้แทนเงินให้กู้ยืมกรรมการ

const text = (v) => (v ?? "").toString().trim();
const num = (v) => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const baht = (v) => num(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const thaiDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
};

async function apiPost(payload) {
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  return raw.trim() ? JSON.parse(raw) : null;
}

export default function DirectorLoanPage({ currentUser }) {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // dialog state: { mode: 'pay'|'receive', loan_account_id, other_account_id, transfer_date, amount, note }
  const [dialog, setDialog] = useState(null);

  // filter for history
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(todayISO());
  const [filterAcc, setFilterAcc] = useState(""); // กรองตามบัญชีลูกหนี้ ("" = ทุกบัญชี)

  async function loadAll() {
    setLoading(true); setMessage("");
    try {
      const [ba, tx] = await Promise.all([
        apiPost({ action: "list_bank_accounts", include_inactive: "false" }),
        apiPost({ action: "bank_transfer", op: "list", date_from: dateFrom, date_to: dateTo }),
      ]);
      setBankAccounts(Array.isArray(ba) ? ba : []);
      setTransfers(Array.isArray(tx) ? tx : []);
    } catch { setMessage("โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [dateFrom, dateTo]);

  // แยกบัญชีลูกหนี้ vs บัญชีปกติ
  const loanAccounts = useMemo(() => bankAccounts.filter((b) => b.account_type === RECEIVABLE_TYPE), [bankAccounts]);
  const otherAccounts = useMemo(() => bankAccounts.filter((b) => b.account_type !== RECEIVABLE_TYPE), [bankAccounts]);

  // index บัญชี → ดู type ของ from/to ในประวัติ
  const accById = useMemo(() => {
    const m = new Map();
    for (const b of bankAccounts) m.set(String(b.account_id), b);
    return m;
  }, [bankAccounts]);

  // กรองประวัติ: เฉพาะรายการที่มีบัญชีลูกหนี้เป็น from หรือ to
  const directorTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const f = accById.get(String(t.from_account_id));
      const to = accById.get(String(t.to_account_id));
      return f?.account_type === RECEIVABLE_TYPE || to?.account_type === RECEIVABLE_TYPE;
    });
  }, [transfers, accById]);

  // สรุปยอดลูกหนี้รวม (= opening + ที่จ่ายเข้า - ที่รับจาก ลูกหนี้)
  const totals = useMemo(() => {
    let count = loanAccounts.length;
    let opening = loanAccounts.reduce((s, a) => s + num(a.opening_balance), 0);
    // คำนวณยอดเคลื่อนไหวจาก transfers — เพิ่มเมื่อโอนเข้า ลูกหนี้, ลดเมื่อโอนออกจาก ลูกหนี้
    let movement = 0;
    for (const t of directorTransfers) {
      const f = accById.get(String(t.from_account_id));
      const to = accById.get(String(t.to_account_id));
      const amt = num(t.amount);
      if (to?.account_type === RECEIVABLE_TYPE) movement += amt;
      if (f?.account_type === RECEIVABLE_TYPE) movement -= amt;
    }
    return { count, current: opening + movement };
  }, [loanAccounts, directorTransfers, accById]);

  // ยอดคงเหลือแยกรายบัญชี (opening + เคลื่อนไหวของบัญชีนั้น)
  const perAccount = useMemo(() => {
    const mvt = new Map();
    for (const a of loanAccounts) mvt.set(String(a.account_id), 0);
    for (const t of directorTransfers) {
      const f = String(t.from_account_id), to = String(t.to_account_id), amt = num(t.amount);
      if (mvt.has(to)) mvt.set(to, mvt.get(to) + amt);
      if (mvt.has(f)) mvt.set(f, mvt.get(f) - amt);
    }
    return loanAccounts.map((a) => ({ ...a, current: num(a.opening_balance) + (mvt.get(String(a.account_id)) || 0) }));
  }, [loanAccounts, directorTransfers]);

  // ประวัติที่กรองตามบัญชีลูกหนี้ที่เลือก
  const viewTransfers = useMemo(() => {
    if (!filterAcc) return directorTransfers;
    return directorTransfers.filter((t) => String(t.from_account_id) === String(filterAcc) || String(t.to_account_id) === String(filterAcc));
  }, [directorTransfers, filterAcc]);

  function openPay() {
    if (loanAccounts.length === 0) { setMessage("⚠️ ยังไม่มีบัญชี \"ลูกหนี้\" — สร้างก่อนที่หน้าบัญชีธนาคาร"); return; }
    setDialog({ mode: "pay", loan_account_id: loanAccounts[0].account_id, other_account_id: "", transfer_date: todayISO(), amount: "", note: "" });
  }
  function openReceive() {
    if (loanAccounts.length === 0) { setMessage("⚠️ ยังไม่มีบัญชี \"ลูกหนี้\" — สร้างก่อนที่หน้าบัญชีธนาคาร"); return; }
    setDialog({ mode: "receive", loan_account_id: loanAccounts[0].account_id, other_account_id: "", transfer_date: todayISO(), amount: "", note: "" });
  }

  async function saveTransfer() {
    const d = dialog;
    if (!d.loan_account_id) { alert("เลือกบัญชีลูกหนี้กรรมการ"); return; }
    if (!d.other_account_id) { alert(d.mode === "pay" ? "เลือกบัญชีที่จ่ายออก" : "เลือกบัญชีที่รับเงินเข้า"); return; }
    if (!num(d.amount) || num(d.amount) <= 0) { alert("ระบุจำนวนเงิน"); return; }
    // pay: เงินจากบัญชีบริษัท (other) → บัญชีลูกหนี้กรรมการ
    // receive: เงินจากบัญชีลูกหนี้กรรมการ → เข้าบัญชีบริษัท (other)
    const from_account_id = d.mode === "pay" ? d.other_account_id : d.loan_account_id;
    const to_account_id   = d.mode === "pay" ? d.loan_account_id  : d.other_account_id;
    try {
      const r = await apiPost({
        action: "bank_transfer", op: "save",
        transfer_id: null,
        transfer_date: d.transfer_date || todayISO(),
        from_account_id: Number(from_account_id),
        to_account_id: Number(to_account_id),
        amount: num(d.amount),
        fee: 0,
        note: d.note || "",
        created_by: currentUser?.username || currentUser?.name || "system",
      });
      const ok = r?.transfer_id || r?.[0]?.transfer_id || r?.transfer_doc_no;
      if (!ok) throw new Error("บันทึกไม่สำเร็จ");
      setDialog(null);
      setMessage(`✅ บันทึก${d.mode === "pay" ? "จ่ายเงิน" : "รับเงิน"}เรียบร้อย ${r?.transfer_doc_no || r?.[0]?.transfer_doc_no || ""}`);
      await loadAll();
    } catch (e) { alert("บันทึกไม่สำเร็จ: " + (e.message || e)); }
  }

  async function cancelTransfer(t) {
    if (!window.confirm(`ยกเลิกรายการ ${t.transfer_doc_no || t.transfer_id}? ระบบจะคืนเงินกลับบัญชีต้นทาง`)) return;
    try {
      await apiPost({ action: "bank_transfer", op: "cancel", transfer_id: t.transfer_id });
      setMessage("✅ ยกเลิกแล้ว");
      await loadAll();
    } catch { alert("ยกเลิกไม่สำเร็จ"); }
  }

  return (
    <div style={{ padding: 20, background: "#fbf7f1", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 24, color: "#333" }}>👔 บันทึกเงินให้กู้ยืมกรรมการ</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={openPay} style={btnRed}>💸 บันทึกจ่ายเงิน</button>
          <button onClick={openReceive} style={btnGreen}>💵 บันทึกรับเงิน</button>
        </div>
      </div>

      {message && (
        <div style={{ padding: "8px 14px", marginBottom: 12, background: message.startsWith("✅") ? "#dcfce7" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b", borderRadius: 6, fontSize: 14 }}>{message}</div>
      )}

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
        <KPI label="📋 บัญชีลูกหนี้กรรมการ" value={String(totals.count)} unit="บัญชี" color="#0369a1" />
        <KPI label="💰 ลูกหนี้คงเหลือรวม" value={baht(totals.current)} unit="บาท" color={totals.current >= 0 ? "#dc2626" : "#16a34a"} />
        {perAccount.map((a) => (
          <KPI key={a.account_id} label={`👤 ${a.account_name}`} value={baht(a.current)} unit="บาท" color={a.current >= 0 ? "#dc2626" : "#16a34a"} />
        ))}
      </div>

      {/* History */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "#072d6b" }}>📋 ประวัติการบันทึก ({viewTransfers.length})</h3>
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
            <span>บัญชี:</span>
            <select value={filterAcc} onChange={(e) => setFilterAcc(e.target.value)} style={{ padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 4 }}>
              <option value="">ทุกบัญชี</option>
              {loanAccounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.account_name}</option>)}
            </select>
            <span>ช่วงวันที่:</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 4 }} />
            <span>ถึง</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 4 }} />
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead style={thead}>
              <tr>
                <th style={th}>วันที่</th>
                <th style={th}>เลขที่</th>
                <th style={th}>ประเภท</th>
                <th style={th}>บัญชีลูกหนี้</th>
                <th style={th}>จ่ายออก / รับเข้า บัญชี</th>
                <th style={{ ...th, textAlign: "right" }}>DR (เพิ่มลูกหนี้)</th>
                <th style={{ ...th, textAlign: "right" }}>CR (ลดลูกหนี้)</th>
                <th style={th}>หมายเหตุ</th>
                <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (<tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด...</td></tr>)
                : viewTransfers.length === 0 ? (<tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>ไม่มีรายการในช่วงนี้</td></tr>)
                : viewTransfers.map((t) => {
                  const f = accById.get(String(t.from_account_id));
                  const to = accById.get(String(t.to_account_id));
                  const isPay = to?.account_type === RECEIVABLE_TYPE; // โอนเข้าลูกหนี้ = จ่าย
                  const loanAcc = isPay ? to : f;
                  const otherAcc = isPay ? f : to;
                  return (
                    <tr key={t.transfer_id}>
                      <td style={td}>{thaiDate(t.transfer_date)}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{t.transfer_doc_no || t.transfer_id}</td>
                      <td style={td}>
                        <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: isPay ? "#fee2e2" : "#dcfce7", color: isPay ? "#dc2626" : "#16a34a" }}>
                          {isPay ? "💸 จ่ายเงิน" : "💵 รับเงิน"}
                        </span>
                      </td>
                      <td style={td}>{loanAcc?.account_name || `#${isPay ? t.to_account_id : t.from_account_id}`}</td>
                      <td style={td}>{otherAcc?.account_name || `#${isPay ? t.from_account_id : t.to_account_id}`}<br />
                        <span style={{ fontSize: 11, color: "#64748b" }}>{otherAcc?.account_type || "-"}</span>
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{isPay ? baht(t.amount) : "-"}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{!isPay ? baht(t.amount) : "-"}</td>
                      <td style={{ ...td, fontSize: 12, color: "#475569" }}>{t.note || "-"}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <button onClick={() => cancelTransfer(t)} style={{ ...btnSm, background: "#ef4444" }}>✕ ยกเลิก</button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            {viewTransfers.length > 0 && (() => {
              let drSum = 0, crSum = 0;
              for (const t of viewTransfers) {
                const isPay = accById.get(String(t.to_account_id))?.account_type === RECEIVABLE_TYPE;
                if (isPay) drSum += num(t.amount); else crSum += num(t.amount);
              }
              return (
                <tfoot>
                  <tr style={{ background: "#f1f5f9", fontWeight: 700 }}>
                    <td style={td} colSpan={5}>รวม{filterAcc ? " (เฉพาะบัญชีที่เลือก)" : ""} · สุทธิ {baht(drSum - crSum)}</td>
                    <td style={{ ...td, textAlign: "right", color: "#dc2626" }}>{baht(drSum)}</td>
                    <td style={{ ...td, textAlign: "right", color: "#16a34a" }}>{baht(crSum)}</td>
                    <td style={td} colSpan={2}></td>
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
      </div>

      {/* Loan accounts list */}
      <div style={{ ...card, marginTop: 14 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#072d6b" }}>📒 บัญชีลูกหนี้กรรมการ ({loanAccounts.length})</h3>
        {loanAccounts.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>
            ยังไม่มีบัญชี · ไปที่เมนู <b>บัญชีธนาคาร</b> เพื่อเพิ่ม (เลือกประเภท "ลูกหนี้")
          </div>
        ) : (
          <table style={table}>
            <thead style={thead}>
              <tr>
                <th style={th}>ชื่อบัญชี</th>
                <th style={th}>เลขที่บัญชี</th>
                <th style={{ ...th, textAlign: "right" }}>ยอดยกมา</th>
                <th style={th}>วันที่ยกมา</th>
                <th style={{ ...th, textAlign: "right" }}>คงเหลือปัจจุบัน</th>
              </tr>
            </thead>
            <tbody>
              {perAccount.map((a) => (
                <tr key={a.account_id}>
                  <td style={{ ...td, fontWeight: 600 }}>{a.account_name}</td>
                  <td style={td}>{a.account_no}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{baht(a.opening_balance)}</td>
                  <td style={td}>{thaiDate(a.opening_date)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: a.current >= 0 ? "#dc2626" : "#16a34a" }}>{baht(a.current)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pay/Receive dialog */}
      {dialog && (
        <Modal onClose={() => setDialog(null)}
          title={dialog.mode === "pay" ? "💸 บันทึกจ่ายเงิน (บริษัทจ่ายให้กรรมการ)" : "💵 บันทึกรับเงิน (กรรมการคืนเงินบริษัท)"}>
          <div style={{ padding: 10, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
            <b>การบันทึก:</b> {dialog.mode === "pay"
              ? "เงินออกจากบัญชีบริษัท → เข้าบัญชีลูกหนี้กรรมการ (เพิ่มลูกหนี้)"
              : "เงินออกจากบัญชีลูกหนี้กรรมการ → เข้าบัญชีบริษัท (ลดลูกหนี้)"}
          </div>
          <Form>
            <Field label="วันที่ *"><input type="date" value={dialog.transfer_date} onChange={(e) => setDialog({ ...dialog, transfer_date: e.target.value })} style={inp} /></Field>

            <Field label={dialog.mode === "pay" ? "บัญชีลูกหนี้กรรมการ (รับเข้า) *" : "บัญชีลูกหนี้กรรมการ (จ่ายออก) *"}>
              <select value={dialog.loan_account_id} onChange={(e) => setDialog({ ...dialog, loan_account_id: e.target.value })} style={inp}>
                {loanAccounts.map((b) => (
                  <option key={b.account_id} value={b.account_id}>{b.account_name} ({b.account_no})</option>
                ))}
              </select>
            </Field>

            <Field label={dialog.mode === "pay" ? "จ่ายออกจาก (เงินสด/เงินสดย่อย/บัญชีธนาคาร) *" : "รับเงินเข้า (เงินสด/เงินสดย่อย/บัญชีธนาคาร) *"}>
              <select value={dialog.other_account_id} onChange={(e) => setDialog({ ...dialog, other_account_id: e.target.value })} style={inp}>
                <option value="">— เลือกบัญชี —</option>
                {otherAccounts.map((b) => (
                  <option key={b.account_id} value={b.account_id}>
                    {b.account_name}{b.account_no ? ` · ${b.account_no}` : ""} · {b.account_type}{b.bank_name && b.bank_name !== "-" ? ` (${b.bank_name})` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="จำนวนเงิน (บาท) *"><input type="number" value={dialog.amount} onChange={(e) => setDialog({ ...dialog, amount: e.target.value })} style={inp} placeholder="0.00" /></Field>
            <Field label="หมายเหตุ"><textarea value={dialog.note} onChange={(e) => setDialog({ ...dialog, note: e.target.value })} style={{ ...inp, minHeight: 60 }} /></Field>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => setDialog(null)} style={btnGrey}>ยกเลิก</button>
              <button onClick={saveTransfer} style={dialog.mode === "pay" ? btnRed : btnGreen}>💾 บันทึก</button>
            </div>
          </Form>
        </Modal>
      )}
    </div>
  );
}

const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thead = { background: "#072d6b" };
const th = { padding: "10px 12px", color: "#fff", textAlign: "left", fontSize: 12, fontWeight: 700 };
const td = { padding: "10px 12px", borderBottom: "1px solid #eef2f7" };
const inp = { width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" };
const btnGreen = { padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
const btnRed = { padding: "8px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
const btnGrey = { padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" };
const btnSm = { padding: "3px 10px", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 };

function Modal({ children, onClose, title }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, padding: 22, width: "min(520px, 96vw)", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 14px", color: "#072d6b" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
function Form({ children }) { return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>; }
function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
function KPI({ label, value, unit, color }) {
  return (
    <div style={{ padding: 12, background: "#fff", borderRadius: 8, border: `2px solid ${color}`, textAlign: "center" }}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#64748b" }}>{unit}</div>
    </div>
  );
}
