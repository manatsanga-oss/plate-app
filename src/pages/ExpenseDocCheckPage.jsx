import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/accounting-api";

function fmt(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v); if (isNaN(d)) return String(v).slice(0, 10);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

async function postAPI(body) {
  const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

export default function ExpenseDocCheckPage({ currentUser }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [receivedFilter, setReceivedFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState({});

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const data = await postAPI({ action: "list_expense_doc_check", date_from: dateFrom, date_to: dateTo, received_filter: receivedFilter });
      setRows(Array.isArray(data) ? data.filter(r => r && r.expense_doc_id) : []);
      setSelected({});
    } catch { setRows([]); setMessage("❌ โหลดไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  async function toggleSelected(received) {
    const ids = Object.keys(selected).filter(k => selected[k]).map(Number);
    if (!ids.length) { setMessage("เลือกรายการก่อน"); return; }
    if (!window.confirm(`${received ? "บันทึกว่ารับเอกสารแล้ว" : "ยกเลิกการรับเอกสาร"} ${ids.length} รายการ?`)) return;
    try {
      await postAPI({
        action: "toggle_expense_doc_received",
        expense_doc_ids: ids,
        doc_received: received,
        doc_received_by: currentUser?.username || currentUser?.name || "system",
      });
      setMessage(`✅ ${received ? "บันทึกรับเอกสาร" : "ยกเลิกรับเอกสาร"} ${ids.length} รายการสำเร็จ`);
      fetchData();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
  }

  const total = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  const totalReceived = rows.filter(r => r.doc_received).reduce((s, r) => s + Number(r.total || 0), 0);
  const countReceived = rows.filter(r => r.doc_received).length;
  const selCount = Object.keys(selected).filter(k => selected[k]).length;
  const selTotal = rows.filter(r => selected[r.expense_doc_id]).reduce((s, r) => s + Number(r.total || 0), 0);

  function toggleAll(check) {
    if (check) {
      const next = {};
      rows.forEach(r => { next[r.expense_doc_id] = true; });
      setSelected(next);
    } else {
      setSelected({});
    }
  }

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📑 ตรวจสอบเอกสารค่าใช้จ่าย</h2>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <span>สถานะ:</span>
        <select value={receivedFilter} onChange={e => setReceivedFilter(e.target.value)} style={inp}>
          <option value="all">ทั้งหมด</option>
          <option value="received">✅ รับแล้ว</option>
          <option value="not_received">⏳ ยังไม่รับ</option>
        </select>
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: message.startsWith("✅") ? "#15803d" : "#b91c1c", background: message.startsWith("✅") ? "#dcfce7" : "#fef2f2", borderRadius: 6 }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        <Card label="📋 ใบทั้งหมด" value={rows.length} color="#1e40af" />
        <Card label="✅ รับเอกสารแล้ว" value={`${countReceived}/${rows.length}`} color="#059669" />
        <Card label="💰 ยอดรวม" value={fmt(total)} color="#7c3aed" />
        <Card label="✅ ยอดที่รับเอกสารแล้ว" value={fmt(totalReceived)} color="#059669" highlight />
      </div>

      {selCount > 0 && (
        <div style={{ padding: "10px 14px", background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8, marginBottom: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span>เลือก <strong>{selCount}</strong> รายการ · ยอดรวม <strong style={{ color: "#dc2626" }}>{fmt(selTotal)}</strong></span>
          <button onClick={() => toggleSelected(true)} style={{ ...btnBlue, background: "#059669" }}>✅ บันทึกรับเอกสาร</button>
          <button onClick={() => toggleSelected(false)} style={{ ...btnBlue, background: "#dc2626" }}>🚫 ยกเลิกรับเอกสาร</button>
          <button onClick={() => setSelected({})} style={{ ...btnBlue, background: "#9ca3af" }}>ล้างเลือก</button>
        </div>
      )}

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={{ ...th, width: 40, textAlign: "center" }}>
                <input type="checkbox" checked={rows.length > 0 && selCount === rows.length} onChange={e => toggleAll(e.target.checked)} />
              </th>
              <th style={th}>#</th>
              <th style={th}>เลขที่เอกสาร</th>
              <th style={th}>วันที่</th>
              <th style={th}>ผู้รับ</th>
              <th style={{ ...th, textAlign: "right" }}>ยอด</th>
              <th style={th}>วิธีจ่าย</th>
              <th style={th}>วันที่จ่าย</th>
              <th style={th}>เลขจ่าย</th>
              <th style={{ ...th, textAlign: "center" }}>สถานะเอกสาร</th>
              <th style={th}>รับโดย</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={11} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
            {rows.map((r, i) => {
              const isRcv = !!r.doc_received;
              return (
                <tr key={r.expense_doc_id} style={{ borderTop: "1px solid #e5e7eb", background: selected[r.expense_doc_id] ? "#fef3c7" : (isRcv ? "#ecfdf5" : undefined) }}>
                  <td style={{ ...td, textAlign: "center" }}>
                    <input type="checkbox" checked={!!selected[r.expense_doc_id]}
                      onChange={e => setSelected(s => ({ ...s, [r.expense_doc_id]: e.target.checked }))} />
                  </td>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#072d6b" }}>{r.expense_doc_no || "-"}</td>
                  <td style={td}>{fmtDate(r.doc_date)}</td>
                  <td style={td}>{r.vendor_name || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626", fontWeight: 700 }}>{fmt(r.total)}</td>
                  <td style={td}>{r.payment_method || "-"}</td>
                  <td style={td}>{r.paid_at ? fmtDate(r.paid_at) : "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{r.paid_doc_no || "-"}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {isRcv ? (
                      <span style={{ padding: "3px 10px", background: "#10b981", color: "#fff", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>✅ รับแล้ว</span>
                    ) : (
                      <span style={{ padding: "3px 10px", background: "#fef3c7", color: "#92400e", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>⏳ ยังไม่รับ</span>
                    )}
                  </td>
                  <td style={{ ...td, fontSize: 11, color: "#6b7280" }}>
                    {isRcv ? `${r.doc_received_by || "-"} · ${r.doc_received_at ? new Date(r.doc_received_at).toLocaleDateString("th-TH") : "-"}` : "-"}
                  </td>
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr style={{ background: "#fef9c3", fontWeight: 700 }}>
                <td colSpan={5} style={{ ...td, textAlign: "right" }}>รวม {rows.length} ใบ</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{fmt(total)}</td>
                <td colSpan={5}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, color, highlight }) {
  return (
    <div style={{ padding: "12px 14px", background: "#fff", borderRadius: 10, border: highlight ? `2px solid ${color}` : "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: highlight ? 22 : 18, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

const inp = { padding: "7px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 };
const th = { padding: "10px 8px", textAlign: "left", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 12 };
const btnBlue = { padding: "7px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
