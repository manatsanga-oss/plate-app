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

export default function DeliveryFeePage({ currentUser }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editRow, setEditRow] = useState(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  async function fetchData() {
    setLoading(true); setMessage("");
    try {
      const data = await postAPI({ action: "list_delivery_fees", date_from: dateFrom, date_to: dateTo });
      setRows(Array.isArray(data) ? data.filter(r => r && r.id) : []);
    } catch { setRows([]); setMessage("❌ โหลดไม่สำเร็จ"); }
    setLoading(false);
  }
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  async function doSearch(kw) {
    if (!kw.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data = await postAPI({ action: "search_moto_sales_for_link", search: kw.trim() });
      setSearchResults(Array.isArray(data) ? data.filter(r => r && r.id) : []);
    } catch { setSearchResults([]); }
    setSearching(false);
  }

  async function linkSale(saleInvoiceNo) {
    if (!editRow) return;
    try {
      await postAPI({
        action: "link_delivery_fee_sale",
        expense_id: editRow.id,
        sale_invoice_no: saleInvoiceNo,
        linked_by: currentUser?.username || currentUser?.name || "system",
      });
      setMessage(`✅ จับคู่กับ ${saleInvoiceNo || "(ล้าง)"} สำเร็จ`);
      setEditRow(null); setSearch(""); setSearchResults([]);
      fetchData();
    } catch { setMessage("❌ ไม่สำเร็จ"); }
  }

  const total = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const matched = rows.filter(r => r.matched_invoice_no).length;
  const unmatched = rows.length - matched;
  const manual = rows.filter(r => r.linked_manual).length;

  return (
    <div className="page-container">
      <div className="page-topbar">
        <h2 className="page-title">🚚 บันทึกค่านำพา</h2>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: 12, background: "#f1f5f9", borderRadius: 8 }}>
        <span>ตั้งแต่:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inp} />
        <span>ถึง:</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inp} />
        <button onClick={fetchData} disabled={loading} style={btnBlue}>{loading ? "..." : "🔄 รีเฟรช"}</button>
        <button onClick={async () => {
            if (!window.confirm("Import รายการ 'ค่านำพา' จากตาราง daily_expenses เข้าตาราง delivery_fees?\n(เฉพาะรายการใหม่ที่ยังไม่ import + auto-match กับ moto_sales)")) return;
            try {
              const res = await postAPI({ action: "import_delivery_fees_from_expenses" });
              const r = Array.isArray(res) ? res[0] : res;
              setMessage(`✅ Import ${r?.imported || 0} รายการ · auto-match ${r?.auto_linked || 0} ใบ`);
              fetchData();
            } catch { setMessage("❌ Import ไม่สำเร็จ"); }
          }} style={{ ...btnBlue, background: "#7c3aed", marginLeft: "auto" }}>
          📥 Import จาก daily_expenses
        </button>
      </div>

      {message && <div style={{ padding: 10, marginBottom: 10, color: message.startsWith("✅") ? "#15803d" : "#b91c1c", background: message.startsWith("✅") ? "#dcfce7" : "#fef2f2", borderRadius: 6 }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
        <Card label="📋 รายการค่านำพา" value={rows.length} color="#1e40af" />
        <Card label="✅ จับคู่ได้" value={`${matched}/${rows.length}`} color="#059669" />
        <Card label="⚠️ ยังไม่จับคู่" value={unmatched} color="#b91c1c" />
        <Card label="✏️ จับคู่เอง" value={manual} color="#7c3aed" />
        <Card label="💰 ยอดรวม" value={fmt(total)} color="#059669" highlight />
      </div>

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ background: "#072d6b", color: "#fff" }}>
            <tr>
              <th style={th}>#</th>
              <th style={th}>เลขที่จ่าย</th>
              <th style={th}>วันที่จ่าย</th>
              <th style={th}>ผู้รับ</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดเงิน</th>
              <th style={{ ...th, textAlign: "right" }}>ยอดจ่ายจริง</th>
              <th style={{ ...th, textAlign: "right" }}>หัก ณ ที่จ่าย</th>
              <th style={th}>หมายเหตุ</th>
              <th style={th}>เลขเครื่อง (ดึงจาก note)</th>
              <th style={{ ...th, background: "#16a34a" }}>เลขใบขาย (matched)</th>
              <th style={{ ...th, background: "#16a34a" }}>วันขาย</th>
              <th style={{ ...th, background: "#16a34a" }}>ลูกค้า</th>
              <th style={{ ...th, background: "#16a34a" }}>รุ่น</th>
              <th style={{ ...th, textAlign: "center" }}>สถานะ</th>
              <th style={{ ...th, textAlign: "center" }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={15} style={{ padding: 20, textAlign: "center" }}>กำลังโหลด...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={15} style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>ไม่มีข้อมูล</td></tr>}
            {rows.map((r, i) => {
              const isMatched = !!r.matched_invoice_no;
              const isManual = !!r.linked_manual;
              return (
                <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb", background: isMatched ? (isManual ? "#f3e8ff" : "#ecfdf5") : "#fef2f2" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontFamily: "monospace", color: "#0369a1" }}>{r.payment_no || "-"}</td>
                  <td style={td}>{fmtDate(r.payment_date)}</td>
                  <td style={td}>{r.pay_to || "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#dc2626", fontWeight: 700 }}>{fmt(r.total_amount)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#0f766e", fontWeight: 600 }}>{fmt(r.cash_amount)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#7c3aed" }}>{fmt(r.withholding_tax)}</td>
                  <td style={{ ...td, fontSize: 11, maxWidth: 200, wordBreak: "break-word" }}>{r.note || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "#92400e" }}>{r.engine_no_in_note || "-"}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: isMatched ? "#065f46" : "#9ca3af" }}>{r.matched_invoice_no || "-"}</td>
                  <td style={td}>{fmtDate(r.matched_sale_date)}</td>
                  <td style={{ ...td, fontSize: 11 }}>{r.matched_customer || "-"}</td>
                  <td style={{ ...td, fontSize: 11 }}>{r.matched_brand && r.matched_model_series ? `${r.matched_brand} · ${r.matched_model_series}` : "-"}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    {!isMatched ? (
                      <span style={{ padding: "2px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>⚠️ ยังไม่จับคู่</span>
                    ) : isManual ? (
                      <span style={{ padding: "2px 8px", background: "#a78bfa", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>✏️ Manual</span>
                    ) : (
                      <span style={{ padding: "2px 8px", background: "#10b981", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>✅ Auto</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button onClick={() => { setEditRow(r); setSearch(""); setSearchResults([]); }}
                      style={{ padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✏️ แก้ไข</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}
             onClick={() => setEditRow(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "95%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff" }}>
              <h3 style={{ margin: 0 }}>✏️ จับคู่ใบขาย — {editRow.payment_no}</h3>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
                ผู้รับ: {editRow.pay_to} · ยอด {fmt(editRow.total_amount)} · note: <span style={{ fontFamily: "monospace" }}>{editRow.note}</span>
                {editRow.matched_invoice_no && <span> · ปัจจุบันจับคู่: <strong>{editRow.matched_invoice_no}</strong></span>}
              </div>
            </div>
            <div style={{ padding: 14, overflow: "auto", flex: 1 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") doSearch(search); }}
                  placeholder="🔍 ค้นหา: เลขใบขาย, เลขเครื่อง, เลขถัง, ชื่อลูกค้า"
                  style={{ ...inp, flex: 1 }} />
                <button onClick={() => doSearch(search)} disabled={searching || !search.trim()} style={btnBlue}>
                  {searching ? "..." : "🔍 ค้นหา"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: "#072d6b" }}>ผลค้นหา ({searchResults.length})</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead style={{ background: "#f0f4f9" }}>
                      <tr>
                        <th style={th}>เลขใบขาย</th>
                        <th style={th}>วันที่</th>
                        <th style={th}>ลูกค้า</th>
                        <th style={th}>เลขเครื่อง</th>
                        <th style={th}>เลขถัง</th>
                        <th style={th}>รุ่น</th>
                        <th style={{ ...th, textAlign: "center" }}>เลือก</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map(s => (
                        <tr key={s.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                          <td style={{ ...td, fontFamily: "monospace", fontWeight: 600, color: "#0369a1" }}>{s.invoice_no}</td>
                          <td style={td}>{fmtDate(s.sale_date)}</td>
                          <td style={td}>{s.customer_name || "-"}</td>
                          <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{s.engine_no || "-"}</td>
                          <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{s.chassis_no || "-"}</td>
                          <td style={td}>{[s.brand, s.model_series].filter(Boolean).join(" · ")}</td>
                          <td style={{ ...td, textAlign: "center" }}>
                            <button onClick={() => linkSale(s.invoice_no)}
                              style={{ padding: "4px 12px", background: "#059669", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>✅ จับคู่</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div style={{ padding: 12, borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "space-between" }}>
              {editRow.matched_invoice_no && (
                <button onClick={() => linkSale("")} style={{ padding: "8px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  🚫 ล้างการจับคู่
                </button>
              )}
              <button onClick={() => setEditRow(null)} style={{ marginLeft: "auto", padding: "8px 14px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 6, cursor: "pointer" }}>ปิด</button>
            </div>
          </div>
        </div>
      )}
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
