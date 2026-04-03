import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api";

export default function HondaDepositPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_honda_deposits" }),
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.rows) ? data.rows : [];
      setRows(list);
    } catch {
      setMessage("โหลดข้อมูลไม่สำเร็จ");
    }
    setLoading(false);
  }

  const filtered = rows.filter(r => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (r.customer_code || "").toLowerCase().includes(s) ||
      (r.customer_name || "").toLowerCase().includes(s) ||
      (r.vin || "").toLowerCase().includes(s) ||
      (r.deposit_doc_no || "").toLowerCase().includes(s)
    );
  });

  const totalRemaining = filtered.reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">รายงานเงินมัดจำคงเหลือ HONDA</div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="ค้นหา รหัสลูกค้า / ชื่อ / ตัวถัง / เลขที่ใบมัดจำ"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, minWidth: 320 }}
        />
        <button onClick={fetchData} disabled={loading} className="btn-primary" style={{ padding: "8px 18px", fontSize: 13 }}>
          {loading ? "กำลังโหลด..." : "Refresh"}
        </button>
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          {filtered.length} รายการ | ยอดคงเหลือรวม: <b style={{ color: "#072d6b" }}>{totalRemaining.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</b>
        </span>
      </div>

      {message && <div style={{ color: "#b91c1c", marginBottom: 8, fontSize: 13 }}>{message}</div>}

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={th}>#</th>
              <th style={th}>รหัสลูกค้า</th>
              <th style={th}>ชื่อลูกค้า</th>
              <th style={th}>หมายเลขตัวถัง</th>
              <th style={th}>วันที่</th>
              <th style={th}>เลขที่ใบมัดจำ</th>
              <th style={{ ...th, textAlign: "right" }}>รับมัดจำ</th>
              <th style={{ ...th, textAlign: "right" }}>คงเหลือ</th>
              <th style={th}>ผู้บันทึก</th>
              <th style={th}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: "#9ca3af" }}>กำลังโหลดข้อมูล...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: "#9ca3af" }}>ไม่พบข้อมูล</td></tr>
            ) : (
              filtered.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{r.customer_code}</td>
                  <td style={td}>{r.customer_name}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.vin}</td>
                  <td style={td}>{formatDate(r.deposit_date)}</td>
                  <td style={td}>{r.deposit_doc_no}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.deposit_amount)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, color: "#072d6b" }}>{fmt(r.remaining_amount)}</td>
                  <td style={td}>{r.recorded_by}</td>
                  <td style={{ ...td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.remark}>{r.remark}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap", fontSize: 12 };
const td = { padding: "8px", whiteSpace: "nowrap" };
const fmt = v => Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 });
function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear() + 543;
  return `${dd}/${mm}/${yy}`;
}
