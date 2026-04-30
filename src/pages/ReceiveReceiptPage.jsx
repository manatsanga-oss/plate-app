import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/registrations-api";

export default function ReceiveReceiptPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all | pending | received | returned
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState({});

  async function post(body) {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function fetchData() {
    setLoading(true);
    setSelected({});
    try {
      const data = await post({ action: "list_receipt_receive", status: filterStatus });
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [filterStatus]);

  const kw = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!kw) return true;
    const hay = [r.receipt_no, r.customer_name, r.chassis_no, r.plate_number, r.brand].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(kw);
  });

  const selectedIds = filtered.filter(r => selected[r.receipt_no]).map(r => r.receipt_no);

  function toggleOne(no) { setSelected(s => ({ ...s, [no]: !s[no] })); }
  function toggleAll() {
    if (filtered.every(r => selected[r.receipt_no])) {
      const next = { ...selected };
      filtered.forEach(r => delete next[r.receipt_no]);
      setSelected(next);
    } else {
      const next = { ...selected };
      filtered.forEach(r => { next[r.receipt_no] = true; });
      setSelected(next);
    }
  }

  async function markAs(action) {
    if (selectedIds.length === 0) { setMessage("เลือกรายการก่อน"); return; }
    const label = action === "mark_received_back" ? "รับคืนจากสำนักงาน" : "ส่งคืนลูกค้า";
    if (!window.confirm(`${label} ${selectedIds.length} รายการ?`)) return;
    setSaving(true);
    try {
      await post({
        action,
        receipt_nos: selectedIds,
        by: currentUser?.username || currentUser?.name || "system",
      });
      setMessage(`✅ ${label} สำเร็จ ${selectedIds.length} รายการ`);
      fetchData();
    } catch { setMessage("❌ ทำรายการไม่สำเร็จ"); }
    setSaving(false);
  }

  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v).slice(0, 10);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
  }

  function statusBadge(r) {
    if (r.returned_to_customer_at) return <span style={{ display: "inline-block", padding: "2px 10px", background: "#dcfce7", color: "#065f46", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>✅ ส่งคืนลูกค้าแล้ว</span>;
    if (r.received_back_at) return <span style={{ display: "inline-block", padding: "2px 10px", background: "#dbeafe", color: "#1e40af", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>📥 รับคืนแล้ว</span>;
    return <span style={{ display: "inline-block", padding: "2px 10px", background: "#fef3c7", color: "#92400e", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>⏳ รอรับคืน</span>;
  }

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
        <span style={{ fontSize: 13, fontWeight: 600 }}>สถานะ:</span>
        {[
          ["all", "ทั้งหมด"],
          ["pending", "⏳ รอรับคืน"],
          ["received", "📥 รับคืนแล้ว"],
          ["returned", "✅ ส่งคืนลูกค้าแล้ว"],
        ].map(([v, label]) => (
          <button key={v} onClick={() => setFilterStatus(v)}
            style={{ padding: "5px 14px", background: filterStatus === v ? "#072d6b" : "#e5e7eb", color: filterStatus === v ? "#fff" : "#374151", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            {label}
          </button>
        ))}

        <input type="text" placeholder="🔍 ค้นหา (เลขที่รับเรื่อง, ลูกค้า, เลขถัง, ทะเบียน)"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 280, padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "Tahoma", fontSize: 13 }} />

        <button onClick={fetchData} disabled={loading}
          style={{ padding: "7px 16px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {loading ? "..." : "🔄 รีเฟรช"}
        </button>
      </div>

      {/* Action bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "12px 14px", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <strong style={{ fontSize: 13 }}>เลือก {selectedIds.length} รายการ</strong>
        <div style={{ flex: 1 }} />
        <button onClick={() => markAs("mark_received_back")} disabled={selectedIds.length === 0 || saving}
          style={{ padding: "8px 16px", background: selectedIds.length === 0 ? "#9ca3af" : "#1e40af", color: "#fff", border: "none", borderRadius: 8, cursor: selectedIds.length === 0 ? "not-allowed" : "pointer", fontWeight: 600 }}>
          📥 บันทึกรับคืน
        </button>
        <button onClick={() => markAs("mark_returned_to_customer")} disabled={selectedIds.length === 0 || saving}
          style={{ padding: "8px 16px", background: selectedIds.length === 0 ? "#9ca3af" : "#059669", color: "#fff", border: "none", borderRadius: 8, cursor: selectedIds.length === 0 ? "not-allowed" : "pointer", fontWeight: 600 }}>
          ✅ บันทึกส่งคืนลูกค้า
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "#072d6b", color: "#fff" }}>
              <tr>
                <th style={th}><input type="checkbox" checked={filtered.length > 0 && filtered.every(r => selected[r.receipt_no])} onChange={toggleAll} /></th>
                <th style={th}>เลขที่รับเรื่อง</th>
                <th style={th}>วันที่รับเรื่อง</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>เลขตัวถัง</th>
                <th style={th}>ทะเบียน</th>
                <th style={th}>สาขา</th>
                <th style={th}>วันรับคืน</th>
                <th style={th}>วันส่งคืนลูกค้า</th>
                <th style={th}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.receipt_no} style={{ borderTop: "1px solid #e5e7eb", background: selected[r.receipt_no] ? "#fef9c3" : "transparent" }}>
                  <td style={td}><input type="checkbox" checked={!!selected[r.receipt_no]} onChange={() => toggleOne(r.receipt_no)} /></td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#0369a1" }}>{r.receipt_no || "-"}</td>
                  <td style={td}>{fmtDate(r.receive_date)}</td>
                  <td style={td}>{r.customer_name || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.chassis_no || "-"}</td>
                  <td style={td}>{r.plate_number || "-"}</td>
                  <td style={td}>{r.branch_name || r.branch_code || "-"}</td>
                  <td style={td}>{fmtDate(r.received_back_at)}</td>
                  <td style={td}>{fmtDate(r.returned_to_customer_at)}</td>
                  <td style={td}>{statusBadge(r)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: "#f3f4f6", fontWeight: 700 }}>
              <tr>
                <td colSpan={9} style={{ ...td, textAlign: "right" }}>รวม {filtered.length} รายการ</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

const th = { padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600 };
const td = { padding: "8px 12px", fontSize: 12, color: "#1f2937" };
