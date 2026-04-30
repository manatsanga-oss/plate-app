import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

export default function ReceiveReceiptPage({ currentUser }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("active"); // active | received | returned | all
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState({});

  async function post(body) {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function fetchData() {
    setLoading(true);
    try {
      const data = await post({
        action: "get_submission_batches",
        date_from: dateFrom || null,
        date_to: dateTo || null,
        status: filterStatus,
        keyword: search.trim(),
      });
      setBatches(Array.isArray(data) ? data : []);
    } catch { setBatches([]); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [filterStatus]);

  async function markBatchReceived(batch) {
    if (!window.confirm(`บันทึกรับคืน batch ${batch.batch_code}?\n${batch.items?.length || 0} รายการ`)) return;
    try {
      await post({
        action: "mark_batch_received_back",
        batch_id: batch.batch_id,
        by: currentUser?.username || currentUser?.name || "system",
      });
      setMessage(`✅ บันทึกรับคืน ${batch.batch_code} สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
  }

  async function markBatchReturned(batch) {
    if (!window.confirm(`บันทึกส่งคืนลูกค้า batch ${batch.batch_code}?\n${batch.items?.length || 0} รายการ`)) return;
    try {
      await post({
        action: "mark_batch_returned",
        batch_id: batch.batch_id,
        by: currentUser?.username || currentUser?.name || "system",
      });
      setMessage(`✅ บันทึกส่งคืนลูกค้า ${batch.batch_code} สำเร็จ`);
      fetchData();
    } catch { setMessage("❌ บันทึกไม่สำเร็จ"); }
  }

  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
  }
  function fmtNum(v) { return Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function batchStatus(b) {
    if (b.status === "cancelled") return { label: "ยกเลิก", color: "#dc2626", bg: "#fee2e2" };
    if (b.returned_at) return { label: "✅ ส่งคืนลูกค้าแล้ว", color: "#065f46", bg: "#dcfce7" };
    if (b.received_back_at) return { label: "📥 รับคืนแล้ว · รอส่งลูกค้า", color: "#1e40af", bg: "#dbeafe" };
    return { label: "⏳ ส่งแล้ว · รอรับคืน", color: "#92400e", bg: "#fef3c7" };
  }

  // Total
  const grandItems = batches.reduce((s, b) => s + (b.items?.length || 0), 0);
  const grandTotal = batches.reduce((s, b) => s + Number(b.total_amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">📥 บันทึกรับ/ส่งคืน งานรับเรื่องงานทะเบียน</h2>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", marginBottom: 12, borderRadius: 8, background: message.startsWith("✅") ? "#d1fae5" : "#fee2e2", color: message.startsWith("✅") ? "#065f46" : "#991b1b" }}>
          {message}
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>วันที่ส่ง:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />
        <span>ถึง</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }}>
          <option value="active">⏳ รอรับคืน + รับแล้วรอส่งลูกค้า</option>
          <option value="pending">⏳ รอรับคืนเท่านั้น</option>
          <option value="received">📥 รับคืนแล้ว · รอส่งลูกค้า</option>
          <option value="returned">✅ ส่งคืนลูกค้าแล้ว</option>
          <option value="all">ทั้งหมด</option>
        </select>

        <input type="text" placeholder="🔍 ค้นหา (เลข batch, supplier)"
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchData()}
          style={{ flex: 1, minWidth: 220, padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />

        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 18px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔍 ค้นหา"}
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13 }}>
        <span>📦 batch: <strong>{batches.length}</strong></span>
        <span>📋 รายการรวม: <strong>{grandItems}</strong></span>
        <span>💰 ยอดสุทธิรวม: <strong style={{ color: "#dc2626" }}>{fmtNum(grandTotal)}</strong></span>
      </div>

      {/* Batches list */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
      ) : batches.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "#9ca3af", background: "#fff", borderRadius: 10, border: "1px dashed #d1d5db" }}>
          ไม่มี batch ที่ส่งแล้ว
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {batches.map(b => {
            const st = batchStatus(b);
            const isOpen = !!expanded[b.batch_id];
            return (
              <div key={b.batch_id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                {/* Batch header — colored bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#1e3a8a", color: "#fff" }}>
                  <button onClick={() => setExpanded(p => ({ ...p, [b.batch_id]: !p[b.batch_id] }))}
                    style={{ background: "transparent", color: "#fff", border: "none", cursor: "pointer", fontSize: 14, padding: 0 }}>
                    {isOpen ? "▼" : "▶"}
                  </button>
                  <strong style={{ fontFamily: "monospace", fontSize: 16, color: "#fff" }}>{b.batch_code}</strong>
                  <span style={{ background: "#cbd5e1", color: "#1e293b", padding: "2px 10px", borderRadius: 6, fontSize: 12 }}>{fmtDate(b.submission_date)}</span>
                  <span style={{ flex: 1 }}>📍 {b.destination || "-"} · {b.items?.length || 0} รายการ</span>
                  <span style={{ background: st.bg, color: st.color, padding: "3px 12px", borderRadius: 12, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{st.label}</span>
                  <strong style={{ color: "#fbbf24", fontSize: 15 }}>฿ {fmtNum(b.total_amount)}</strong>
                  <span style={{ fontSize: 11, color: "#cbd5e1" }}>by {b.created_by || "-"}</span>
                </div>

                {/* Action buttons */}
                {b.status !== "cancelled" && !b.returned_at && (
                  <div style={{ padding: "10px 14px", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    {!b.received_back_at && (
                      <button onClick={() => markBatchReceived(b)}
                        style={{ padding: "8px 18px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                        📥 บันทึกรับคืน
                      </button>
                    )}
                    {b.received_back_at && (
                      <>
                        <span style={{ alignSelf: "center", fontSize: 12, color: "#1e40af" }}>📥 รับคืนแล้ว: {fmtDate(b.received_back_at)} โดย {b.received_back_by || "-"}</span>
                        <button onClick={() => markBatchReturned(b)}
                          style={{ padding: "8px 18px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                          ✅ บันทึกส่งคืนลูกค้า
                        </button>
                      </>
                    )}
                  </div>
                )}
                {b.returned_at && (
                  <div style={{ padding: "10px 14px", borderTop: "1px solid #e5e7eb", background: "#dcfce7", fontSize: 12, color: "#065f46" }}>
                    ✅ ส่งคืนลูกค้าแล้ว: {fmtDate(b.returned_at)} โดย {b.returned_by || "-"} · 📥 รับคืน: {fmtDate(b.received_back_at)} โดย {b.received_back_by || "-"}
                  </div>
                )}

                {/* Items detail (when expanded) */}
                {isOpen && b.items?.length > 0 && (
                  <div style={{ padding: "10px 14px", borderTop: "1px solid #e5e7eb" }}>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <thead style={{ background: "#f3f4f6" }}>
                        <tr>
                          <th style={{ padding: "6px 10px", textAlign: "left" }}>เลขที่รับเรื่อง</th>
                          <th style={{ padding: "6px 10px", textAlign: "left" }}>ลูกค้า</th>
                          <th style={{ padding: "6px 10px", textAlign: "left" }}>เลขถัง</th>
                          <th style={{ padding: "6px 10px", textAlign: "left" }}>ทะเบียน</th>
                          <th style={{ padding: "6px 10px", textAlign: "left" }}>รายการ</th>
                          <th style={{ padding: "6px 10px", textAlign: "right" }}>ยอด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.items.map((it, i) => (
                          <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                            <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#0369a1" }}>{it.receipt_no || "-"}</td>
                            <td style={{ padding: "6px 10px" }}>{it.customer_name || "-"}</td>
                            <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>{it.chassis_no || "-"}</td>
                            <td style={{ padding: "6px 10px" }}>{it.plate_number || "-"}</td>
                            <td style={{ padding: "6px 10px" }}>{it.income_name || it.income_type || "-"}</td>
                            <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtNum(it.net_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
