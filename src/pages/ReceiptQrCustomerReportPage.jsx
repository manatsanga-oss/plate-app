import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// รายงานลูกค้าสแกน QR กรอกข้อมูลผ่าน LINE (Report Admin)
// แสดงรายชื่อลูกค้าที่สแกน QR แล้วกรอกข้อมูลผ่าน LIFF ทั้งหมด
// กรอง: ช่วงวันที่ / สถานะ / สาขา — ข้อมูลจาก receipt_requests (action: list_requests)
// ============================================================================
const RECEIPT_API = "https://n8n-new-project-gwf2.onrender.com/webhook/receipt-requests-api";

const STATUS_LABEL = { pending: "รอลูกค้ากรอก", filled: "ลูกค้ากรอกแล้ว", issued: "ออกใบเสร็จแล้ว", cancelled: "ยกเลิก" };

const fmtDT = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
};

function monthFirstDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ReceiptQrCustomerReportPage() {
  const [dateFrom, setDateFrom] = useState(monthFirstDay());
  const [dateTo, setDateTo] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchData() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(RECEIPT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_requests", date_from: dateFrom, date_to: dateTo }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      const data = raw.trim() ? JSON.parse(raw) : {};
      const obj = Array.isArray(data) ? data[0] : data;
      const list = Array.isArray(obj?.rows) ? obj.rows : Array.isArray(obj) ? obj : [];
      setRows(list);
      if (!list.length) setMessage("ไม่พบข้อมูลในช่วงวันที่ที่เลือก");
    } catch (e) {
      setMessage("โหลดข้อมูลไม่สำเร็จ: " + (e.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const branches = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => { const b = (r.branch_name || r.branch_code || "").trim(); if (b) s.add(b); });
    return [...s].sort();
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (branchFilter) {
      const b = (r.branch_name || r.branch_code || "").trim();
      if (b !== branchFilter) return false;
    }
    return true;
  }), [rows, statusFilter, branchFilter]);

  const counts = useMemo(() => {
    const c = { total: filtered.length, pending: 0, filled: 0, issued: 0 };
    filtered.forEach((r) => { if (c[r.status] !== undefined) c[r.status] += 1; });
    return c;
  }, [filtered]);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }} className="no-print">📱 รายงานลูกค้าสแกน QR (กรอกผ่าน LINE)</h2>

      {/* ตัวกรอง */}
      <div className="no-print" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <label style={lbl}>ตั้งแต่วันที่</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>ถึงวันที่</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={lbl}>สถานะ</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inp}>
            <option value="">ทั้งหมด</option>
            <option value="filled">ลูกค้ากรอกแล้ว</option>
            <option value="issued">ออกใบเสร็จแล้ว</option>
            <option value="pending">รอลูกค้ากรอก</option>
          </select>
        </div>
        <div>
          <label style={lbl}>สาขา</label>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={inp}>
            <option value="">ทั้งหมด</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <button onClick={fetchData} disabled={loading} style={btn("#2563eb")}>
          {loading ? "โหลด…" : "🔍 แสดงรายงาน"}
        </button>
        <button onClick={() => window.print()} style={btn("#475467")}>🖨️ พิมพ์</button>
      </div>

      {/* หัวรายงานตอนพิมพ์ */}
      <div className="print-only" style={{ display: "none", marginBottom: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>รายงานลูกค้าสแกน QR (กรอกผ่าน LINE)</div>
        <div style={{ fontSize: 13 }}>
          ช่วงวันที่ {fmtDT(dateFrom).split(" ")[0]} – {fmtDT(dateTo).split(" ")[0]}
          {statusFilter ? ` • สถานะ: ${STATUS_LABEL[statusFilter]}` : ""}
          {branchFilter ? ` • สาขา: ${branchFilter}` : ""}
        </div>
      </div>

      {/* สรุปจำนวน */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <SummaryChip label="ทั้งหมด" value={counts.total} color="#344054" bg="#f2f4f7" />
        <SummaryChip label="ลูกค้ากรอกแล้ว" value={counts.filled} color="#175cd3" bg="#eff8ff" />
        <SummaryChip label="ออกใบเสร็จแล้ว" value={counts.issued} color="#067647" bg="#ecfdf3" />
        <SummaryChip label="รอลูกค้ากรอก" value={counts.pending} color="#b54708" bg="#fffaeb" />
      </div>

      {message && <div className="no-print" style={{ margin: "8px 0", color: message.startsWith("โหลด") ? "#b42318" : "#667085" }}>{message}</div>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14, background: "#fff" }}>
          <thead>
            <tr>
              {["#", "เลขอ้างอิง", "วันที่สร้าง", "สาขา", "ชื่อลูกค้า", "เบอร์โทร", "ชื่อ LINE", "วันที่กรอก", "สถานะ", "เลขใบเสร็จ"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.ref_no || i}>
                <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
                <td style={td}>{r.ref_no}</td>
                <td style={td}>{fmtDT(r.created_at)}</td>
                <td style={td}>{r.branch_name || r.branch_code || "-"}</td>
                <td style={td}>{r.customer_name || "-"}</td>
                <td style={td}>{r.phone || "-"}</td>
                <td style={td}>{r.line_display_name || "-"}</td>
                <td style={td}>{fmtDT(r.filled_at)}</td>
                <td style={{ ...td, textAlign: "center" }}>
                  <span style={statusChip(r.status)}>{STATUS_LABEL[r.status] || r.status}</span>
                </td>
                <td style={td}>{r.invoice_no || "-"}</td>
              </tr>
            ))}
            {!filtered.length && !loading && (
              <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#98a2b3" }}>ไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: #fff; }
        }
      `}</style>
    </div>
  );
}

function SummaryChip({ label, value, color, bg }) {
  return (
    <div style={{ padding: "8px 16px", borderRadius: 10, background: bg, color, fontWeight: 700, fontSize: 14 }}>
      {label}: {value.toLocaleString()}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#475467", marginBottom: 4 };
const inp = { padding: "8px 10px", fontSize: 14, border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff" };
const btn = (bg) => ({ padding: "9px 16px", fontSize: 14, fontWeight: 700, color: "#fff", background: bg, border: "none", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" });
const th = { border: "1px solid #e4e7ec", background: "#f9fafb", padding: "8px 10px", textAlign: "left", whiteSpace: "nowrap", fontSize: 13 };
const td = { border: "1px solid #e4e7ec", padding: "7px 10px", verticalAlign: "top" };
const statusChip = (status) => {
  const map = { pending: ["#b54708", "#fffaeb"], filled: ["#175cd3", "#eff8ff"], issued: ["#067647", "#ecfdf3"], cancelled: ["#667085", "#f2f4f7"] };
  const [color, bg] = map[status] || ["#667085", "#f2f4f7"];
  return { color, background: bg, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" };
};
