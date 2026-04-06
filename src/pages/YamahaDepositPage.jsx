import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/yamaha-deposit-api";
const ORDER_API = "https://n8n-new-project-gwf2.onrender.com/webhook/yamaha-spare-api";

export default function YamahaDepositPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const [depRes, ordRes] = await Promise.all([
        fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }),
        fetch(ORDER_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_yamaha_orders" }) }),
      ]);
      const depData = await depRes.json();
      const ordData = await ordRes.json();
      setRows(Array.isArray(depData) ? depData : []);
      const ordList = Array.isArray(ordData) ? ordData : Array.isArray(ordData?.items) ? ordData.items : [];
      setOrders(ordList);
    } catch {
      setMessage("โหลดข้อมูลไม่สำเร็จ");
    }
    setLoading(false);
  }

  function hasOrder(receipt_no) {
    return orders.some(o => o.deposit_doc_no === receipt_no);
  }

  const filtered = rows.filter(r => {
    if (search.trim()) {
      const s = search.toLowerCase();
      const match = (r.receipt_no || "").toLowerCase().includes(s) ||
        (r.customer_name || "").toLowerCase().includes(s);
      if (!match) return false;
    }
    if (filterStatus === "ordered") return hasOrder(r.receipt_no);
    if (filterStatus === "not_ordered") return !hasOrder(r.receipt_no);
    return true;
  });

  const totalRemaining = filtered.reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0);
  const countAll = rows.length;
  const countOrdered = rows.filter(r => hasOrder(r.receipt_no)).length;
  const countNotOrdered = rows.filter(r => !hasOrder(r.receipt_no)).length;

  return (
    <div className="page-container">
      <div className="page-topbar">
        <div className="page-title">รายงานเงินมัดจำคงเหลือ YAMAHA</div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="ค้นหา เลขที่ใบเสร็จ / ชื่อลูกค้า"
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

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { key: "all", label: "ทั้งหมด", count: countAll, bg: "#072d6b" },
          { key: "ordered", label: "สั่งแล้ว", count: countOrdered, bg: "#10b981" },
          { key: "not_ordered", label: "ยังไม่ได้สั่ง", count: countNotOrdered, bg: "#f59e0b" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterStatus(f.key)}
            style={{
              padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
              background: filterStatus === f.key ? f.bg : "#e5e7eb",
              color: filterStatus === f.key ? "#fff" : "#374151",
            }}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {message && <div style={{ color: "#b91c1c", marginBottom: 8, fontSize: 13 }}>{message}</div>}

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#072d6b", color: "#fff" }}>
              <th style={th}>#</th>
              <th style={th}>เลขที่ใบเสร็จ</th>
              <th style={th}>วันที่</th>
              <th style={th}>ชื่อลูกค้า</th>
              <th style={th}>ประเภท</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดมัดจำ</th>
              <th style={{ ...th, textAlign: "right" }}>ชำระแล้ว</th>
              <th style={{ ...th, textAlign: "right" }}>คงเหลือ</th>
              <th style={th}>text30</th>
              <th style={th}>custom_field</th>
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
                  <td style={td}>{r.receipt_no}</td>
                  <td style={td}>{formatDate(r.deposit_date)}</td>
                  <td style={td}>{r.customer_name}</td>
                  <td style={td}>{r.deposit_type || "-"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.deposit_amount)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(r.paid_amount)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, color: "#072d6b" }}>{fmt(r.remaining_amount)}</td>
                  <td style={td}>{r.text30 || "-"}</td>
                  <td style={td}>{r.custom_field || "-"}</td>
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
