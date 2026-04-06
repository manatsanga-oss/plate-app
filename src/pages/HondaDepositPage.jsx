import React, { useEffect, useState } from "react";

const API_URL = "https://n8n-new-project-gwf2.onrender.com/webhook/spare-parts-api";

export default function HondaDepositPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [repairDeposits, setRepairDeposits] = useState([]);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const [depRes, ordRes, repRes] = await Promise.all([
        fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_honda_deposits" }) }),
        fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_spare_orders" }) }),
        fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_repair_deposits" }) }),
      ]);
      const depData = await depRes.json();
      const ordData = await ordRes.json();
      const repData = await repRes.json();
      const list = Array.isArray(depData) ? depData : Array.isArray(depData?.items) ? depData.items : Array.isArray(depData?.rows) ? depData.rows : [];
      setRows(list);
      const ordList = Array.isArray(ordData) ? ordData : Array.isArray(ordData?.items) ? ordData.items : Array.isArray(ordData?.rows) ? ordData.rows : [];
      setOrders(ordList);
      const repList = Array.isArray(repData) ? repData : [];
      setRepairDeposits(repList);
    } catch {
      setMessage("โหลดข้อมูลไม่สำเร็จ");
    }
    setLoading(false);
  }

  function hasOrder(deposit_doc_no) {
    return orders.some(o => o.deposit_doc_no === deposit_doc_no);
  }

  const filtered = rows.filter(r => {
    if (search.trim()) {
      const s = search.toLowerCase();
      const match = (r.customer_code || "").toLowerCase().includes(s) ||
        (r.customer_name || "").toLowerCase().includes(s) ||
        (r.vin || "").toLowerCase().includes(s) ||
        (r.deposit_doc_no || "").toLowerCase().includes(s);
      if (!match) return false;
    }
    if (filterStatus === "ordered") return hasOrder(r.deposit_doc_no);
    if (filterStatus === "not_ordered") return !hasOrder(r.deposit_doc_no);
    // กรองตามประเภทมัดจำ
    if (filterType === "spare") return !repairDeposits.some(rd => rd.deposit_doc_no === r.deposit_doc_no);
    if (filterType === "repair") return repairDeposits.some(rd => rd.deposit_doc_no === r.deposit_doc_no);
    return true;
  });

  const totalRemaining = filtered.reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0);
  const countAll = rows.length;
  const countOrdered = rows.filter(r => hasOrder(r.deposit_doc_no)).length;
  const countNotOrdered = rows.filter(r => !hasOrder(r.deposit_doc_no)).length;
  const countRepair = repairDeposits.length;
  const countSpare = rows.length - countRepair;

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

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { key: "all", label: "ทั้งหมด", count: countAll, bg: "#072d6b" },
          { key: "ordered", label: "สั่งแล้ว", count: countOrdered, bg: "#10b981" },
          { key: "not_ordered", label: "ยังไม่ได้สั่ง", count: countNotOrdered, bg: "#f59e0b" },
        ].map(f => (
          <button key={f.key} onClick={() => { setFilterStatus(f.key); setFilterType("all"); }}
            style={{
              padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
              background: filterStatus === f.key && filterType === "all" ? f.bg : "#e5e7eb",
              color: filterStatus === f.key && filterType === "all" ? "#fff" : "#374151",
            }}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { key: "all", label: "ทุกประเภท", count: countAll, bg: "#6b7280" },
          { key: "spare", label: "เงินมัดจำอะไหล่", count: countSpare, bg: "#3b82f6" },
          { key: "repair", label: "เงินมัดจำตีราคาซ่อม", count: countRepair, bg: "#8b5cf6" },
        ].map(f => (
          <button key={f.key} onClick={() => { setFilterType(f.key); setFilterStatus("all"); }}
            style={{
              padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
              background: filterType === f.key ? f.bg : "#e5e7eb",
              color: filterType === f.key ? "#fff" : "#374151",
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
              <th style={th}>รหัสลูกค้า</th>
              <th style={th}>ชื่อลูกค้า</th>
              <th style={th}>หมายเลขตัวถัง</th>
              <th style={th}>วันที่</th>
              <th style={th}>เลขที่ใบมัดจำ</th>
              <th style={{ ...th, textAlign: "right" }}>รับมัดจำ</th>
              <th style={{ ...th, textAlign: "right" }}>คงเหลือ</th>
              <th style={th}>เลขที่ใบประเมิน</th>
              <th style={th}>สถานะตีราคา</th>
              <th style={th}>ผู้บันทึก</th>
              <th style={th}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} style={{ textAlign: "center", padding: 24, color: "#9ca3af" }}>กำลังโหลดข้อมูล...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: "center", padding: 24, color: "#9ca3af" }}>ไม่พบข้อมูล</td></tr>
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
                  <td style={td}>{(() => { const rd = repairDeposits.find(rd => rd.deposit_doc_no === r.deposit_doc_no); return rd ? rd.estimate_no : "-"; })()}</td>
                  <td style={td}>{repairDeposits.some(rd => rd.deposit_doc_no === r.deposit_doc_no)
                    ? <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, background: "#ede9fe", color: "#7c3aed", fontWeight: 600 }}>ตีราคาซ่อม</span>
                    : "-"}</td>
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
