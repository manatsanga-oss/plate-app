import React, { useEffect, useMemo, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/cheque-receive-api";
const ACC_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api"; // list_bank_accounts

const fmt = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = v => {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);

// บันทึกผ่านเช็ครับ — รายการใบเสร็จที่รับชำระเป็นเช็ค (daily_receipts.cheque > 0)
// บันทึกวันที่นำเช็คไปฝาก + ธนาคาร/บัญชีที่ฝาก (cheque_receive_clearings ผ่าน cheque-receive-api)
export default function ChequeReceivePage({ currentUser }) {
  const now = new Date();
  const defFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10); // ย้อนหลัง 3 เดือน
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(defFrom);
  const [dateTo, setDateTo] = useState(todayISO());
  const [statusTab, setStatusTab] = useState("all"); // all | pending | cleared
  const [bankAccounts, setBankAccounts] = useState([]);
  const [message, setMessage] = useState("");
  // modal บันทึก/แก้ไขผ่านเช็ค
  const [modalRow, setModalRow] = useState(null);
  const [depositDate, setDepositDate] = useState(todayISO());
  const [bankId, setBankId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRows();
    fetch(ACC_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_bank_accounts", include_inactive: "false" }),
    }).then(r => r.json())
      .then(d => setBankAccounts((Array.isArray(d) ? d : []).filter(a => a && a.account_id)))
      .catch(() => setBankAccounts([]));
    /* eslint-disable-next-line */
  }, []);

  async function post(body) {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function fetchRows() {
    setLoading(true); setMessage("");
    try {
      const data = await post({ action: "list_cheque_receipts", date_from: dateFrom, date_to: dateTo });
      const arr = (Array.isArray(data) ? data : []).filter(r => r && r.receipt_no);
      if (data && !Array.isArray(data) && data.error) throw new Error(data.error);
      setRows(arr);
    } catch { setMessage("❌ โหลดไม่สำเร็จ — ตรวจว่า workflow cheque-receive-api ถูก import + Active แล้ว"); setRows([]); }
    setLoading(false);
  }

  const bankLabelOf = (a) => [a.bank_name, a.account_no, a.account_name].filter(Boolean).join(" · ");

  function openRecord(r) {
    setModalRow(r);
    setDepositDate(r.deposit_date ? String(r.deposit_date).slice(0, 10) : todayISO());
    setBankId(r.bank_account_id ? String(r.bank_account_id) : "");
    setNote(r.clearing_note || "");
  }

  async function saveClearing() {
    if (!modalRow) return;
    if (!depositDate) { setMessage("❌ กรุณาระบุวันที่ฝากเช็ค"); return; }
    if (!bankId) { setMessage("❌ กรุณาเลือกธนาคารที่ฝาก"); return; }
    const bank = bankAccounts.find(a => String(a.account_id) === String(bankId));
    setSaving(true); setMessage("");
    try {
      const data = await post({
        action: "save_cheque_clearing",
        receipt_no: modalRow.receipt_no,
        receipt_date: String(modalRow.receipt_date || "").slice(0, 10),
        customer_name: modalRow.customer_name || "",
        cheque_amount: Number(modalRow.cheque) || 0,
        deposit_date: depositDate,
        bank_account_id: Number(bankId),
        bank_label: bank ? bankLabelOf(bank) : "",
        note,
        created_by: currentUser?.name || currentUser?.username || "system",
      });
      const ok = data?.[0]?.receipt_no || data?.receipt_no;
      if (ok) {
        setMessage(`✅ บันทึกผ่านเช็ค ${modalRow.receipt_no} แล้ว`);
        setModalRow(null);
        fetchRows();
      } else {
        setMessage("❌ บันทึกไม่สำเร็จ — ตรวจว่า workflow cheque-receive-api ถูก import + Active แล้ว");
      }
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
    setSaving(false);
  }

  async function cancelClearing(r) {
    if (!window.confirm(`ยกเลิกการผ่านเช็คของใบเสร็จ ${r.receipt_no}?\n(รายการจะกลับเป็น "รอฝาก")`)) return;
    try {
      const data = await post({ action: "cancel_cheque_clearing", receipt_no: r.receipt_no });
      if (data?.[0]?.receipt_no || data?.receipt_no) {
        setMessage(`✅ ยกเลิกการผ่านเช็ค ${r.receipt_no} แล้ว`);
        fetchRows();
      } else setMessage("❌ ยกเลิกไม่สำเร็จ");
    } catch { setMessage("❌ ยกเลิกไม่สำเร็จ"); }
  }

  const visible = useMemo(() => rows.filter(r => {
    if (statusTab === "pending") return !r.deposit_date;
    if (statusTab === "cleared") return !!r.deposit_date;
    return true;
  }), [rows, statusTab]);

  const sum = useMemo(() => ({
    count: rows.length,
    total: rows.reduce((s, r) => s + (Number(r.cheque) || 0), 0),
    pending: rows.filter(r => !r.deposit_date).length,
    pendingTotal: rows.filter(r => !r.deposit_date).reduce((s, r) => s + (Number(r.cheque) || 0), 0),
  }), [rows]);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">🏦 บันทึกผ่านเช็ครับ</div>
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
        รายการใบเสร็จที่รับชำระเป็นเช็ค (จากไฟล์ใบเสร็จรายวัน) — บันทึกวันที่นำเช็คไปฝากและธนาคารที่ฝาก
      </div>

      {message && (
        <div style={{ padding: "8px 14px", borderRadius: 8, marginBottom: 10, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10, padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 12, color: "#6b7280" }}>วันที่ใบเสร็จ</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span style={{ fontSize: 12, color: "#6b7280" }}>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <button onClick={fetchRows} disabled={loading}
          style={{ padding: "7px 16px", background: "#072d6b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          🔍 ค้นหา
        </button>
        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          {[{ k: "all", l: "ทั้งหมด" }, { k: "pending", l: "รอฝาก" }, { k: "cleared", l: "ผ่านเช็คแล้ว" }].map(t => (
            <button key={t.k} onClick={() => setStatusTab(t.k)}
              style={{ padding: "6px 14px", borderRadius: 16, border: "1px solid #d1d5db", cursor: "pointer", fontSize: 12, fontWeight: statusTab === t.k ? 700 : 400, background: statusTab === t.k ? "#072d6b" : "#fff", color: statusTab === t.k ? "#fff" : "#374151" }}>
              {t.l}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#374151" }}>
          เช็ครวม <b>{sum.count}</b> ใบ · <b style={{ color: "#dc2626" }}>{fmt(sum.total)}</b> บาท
          <span style={{ marginLeft: 12 }}>รอฝาก <b style={{ color: "#b45309" }}>{sum.pending}</b> ใบ · {fmt(sum.pendingTotal)} บาท</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>ไม่มีรายการรับชำระเป็นเช็คในช่วงที่เลือก</div>
        ) : (
          <table className="data-table" style={{ fontSize: 13, width: "100%" }}>
            <thead>
              <tr>
                <th>#</th><th>วันที่ใบเสร็จ</th><th>เลขที่ใบเสร็จ</th><th>สาขา</th><th>ลูกค้า</th>
                <th style={{ textAlign: "right" }}>ยอดเช็ค</th><th>สถานะใบเสร็จ</th><th>ผ่านเช็ค</th><th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr key={r.receipt_no} style={{ background: r.deposit_date ? undefined : "#fffbeb" }}>
                  <td>{i + 1}</td>
                  <td>{fmtDate(r.receipt_date)}</td>
                  <td style={{ fontWeight: 600, fontFamily: "monospace" }}>{r.receipt_no}</td>
                  <td>{r.branch_code || "-"}</td>
                  <td>{r.customer_name || "-"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{fmt(r.cheque)}</td>
                  <td>
                    <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, background: r.receipt_status === "ยกเลิก" ? "#fee2e2" : "#d1fae5", color: r.receipt_status === "ยกเลิก" ? "#991b1b" : "#065f46" }}>
                      {r.receipt_status || "ปกติ"}
                    </span>
                  </td>
                  <td>
                    {r.deposit_date ? (
                      <div style={{ fontSize: 12 }}>
                        <div style={{ color: "#065f46", fontWeight: 700 }}>✓ ฝากแล้ว {fmtDate(r.deposit_date)}</div>
                        <div style={{ color: "#0369a1" }}>{r.bank_label || "-"}</div>
                        {r.cleared_by && <div style={{ color: "#9ca3af", fontSize: 11 }}>โดย {r.cleared_by}</div>}
                      </div>
                    ) : (
                      <span style={{ padding: "2px 10px", borderRadius: 10, fontSize: 11, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>รอฝาก</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.deposit_date ? (
                      <>
                        <button onClick={() => openRecord(r)} style={{ padding: "3px 10px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, marginRight: 4 }}>แก้ไข</button>
                        <button onClick={() => cancelClearing(r)} style={{ padding: "3px 10px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>ยกเลิก</button>
                      </>
                    ) : (
                      <button onClick={() => openRecord(r)}
                        style={{ padding: "4px 12px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                        🏦 บันทึกผ่านเช็ค
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal บันทึกผ่านเช็ค */}
      {modalRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => !saving && setModalRow(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", padding: 22, borderRadius: 12, width: 460, maxWidth: "95vw" }}>
            <h3 style={{ margin: "0 0 4px", color: "#072d6b" }}>🏦 บันทึกผ่านเช็ครับ</h3>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
              ใบเสร็จ <b style={{ color: "#374151" }}>{modalRow.receipt_no}</b> · {fmtDate(modalRow.receipt_date)} · {modalRow.customer_name || "-"}
            </div>
            <div style={{ padding: "8px 12px", background: "#fef2f2", borderRadius: 8, marginBottom: 14, fontSize: 14 }}>
              ยอดเช็ค: <b style={{ color: "#dc2626", fontSize: 17 }}>{fmt(modalRow.cheque)}</b> บาท
            </div>

            <label style={lbl}>วันที่ฝากเช็ค *</label>
            <input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} style={{ ...inp, width: "100%", marginBottom: 10 }} />

            <label style={lbl}>ธนาคาร/บัญชีที่ฝาก *</label>
            <select value={bankId} onChange={e => setBankId(e.target.value)} style={{ ...inp, width: "100%", marginBottom: 10 }}>
              <option value="">-- เลือกบัญชีธนาคาร --</option>
              {bankAccounts.map(a => (
                <option key={a.account_id} value={a.account_id}>{bankLabelOf(a)}</option>
              ))}
            </select>

            <label style={lbl}>หมายเหตุ</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="เช่น เลขที่เช็ค / สาขาธนาคาร" style={{ ...inp, width: "100%" }} />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setModalRow(null)} disabled={saving}
                style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={saveClearing} disabled={saving || !depositDate || !bankId}
                style={{ padding: "8px 20px", background: (saving || !depositDate || !bankId) ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: (saving || !depositDate || !bankId) ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {saving ? "กำลังบันทึก..." : "💾 บันทึกผ่านเช็ค"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13, boxSizing: "border-box" };
const lbl = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#374151" };
